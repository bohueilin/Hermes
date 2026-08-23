"""The paired experiment loop: the product, with the engine as a means.

Both arms replay the same materialized world per seed; the declared axis is the only
difference. The result is a distribution of paired deltas, a bootstrap CI on the one
preregistered primary metric, thresholded guardrails, and outcome semantics that are allowed
to say INCONCLUSIVE — never a forced winner, never a composite score.
"""

from __future__ import annotations

import json
from pathlib import Path

from hermes.fleet.contracts import (
    DecisionRecord,
    ExperimentOutcome,
    ExperimentSpec,
    ExperimentValidity,
    FleetRecommendation,
    FleetScenarioConfig,
    Guardrail,
    InvalidityReason,
    MetricComparison,
    PrimaryMetric,
)
from hermes.fleet.engine import run_fleet, run_metrics
from hermes.fleet.invariants import check_invariants
from hermes.fleet.world import _u64, build_tape, tape_digest

#: Limitations are part of the record, not a footnote. Every export carries all of them.
LIMITATIONS: tuple[str, ...] = (
    "Synthetic demand and travel model; no calibration to any real operation.",
    "Single regime (nominal); no stress-regime coverage in this experiment.",
    "The CI measures Monte Carlo variation under the synthetic model only - not model-form "
    "or real-world uncertainty.",
    "Decision owner is the author (AUTHOR_SELF_TEST); no independent user has run this.",
    "Screening input to a next test; never a launch decision.",
)


class FleetExperimentError(ValueError):
    """Actionable failure while resolving or running an experiment."""


def apply_axis(spec: ExperimentSpec, value: float) -> FleetScenarioConfig:
    """Resolve one arm's scenario from the declared variation axis.

    Only ``parameter:<field>`` is implemented; the field must exist on the scenario, so a
    typo is a loud configuration error rather than two identical arms passing trivially.
    """
    kind, _, field_name = spec.variation_axis.partition(":")
    if kind != "parameter":
        raise FleetExperimentError(
            f"variation axis kind '{kind}' is not implemented in the spike (only parameter:)"
        )
    if field_name not in type(spec.scenario).model_fields:
        raise FleetExperimentError(
            f"variation axis names unknown scenario field '{field_name}'"
        )
    current = getattr(spec.scenario, field_name)
    cast = type(current)(value)
    return spec.scenario.model_copy(update={field_name: cast})


def _bootstrap_ci(
    deltas: list[float], resamples: int, key: str
) -> tuple[float, float]:
    """95% percentile bootstrap over paired replications (never over individual requests),
    seeded from the spec digest so the interval itself is reproducible."""
    n = len(deltas)
    means: list[float] = []
    for i in range(resamples):
        total = 0.0
        for j in range(n):
            total += deltas[_u64(key, "bootstrap", i, j) % n]
        means.append(total / n)
    means.sort()
    low_index = max(0, int(round(0.025 * resamples)) - 1)
    high_index = min(resamples - 1, int(round(0.975 * resamples)))
    return means[low_index], means[high_index]


def _compare(
    metric: str,
    role: str,
    baseline_runs: list[dict[str, float]],
    candidate_runs: list[dict[str, float]],
) -> MetricComparison | None:
    """Paired comparison for one metric; None when any replication lacks it (the caller
    reports NOT_AVAILABLE rather than substituting zero)."""
    if any(metric not in run for run in baseline_runs + candidate_runs):
        return None
    baseline = [run[metric] for run in baseline_runs]
    candidate = [run[metric] for run in candidate_runs]
    deltas = [c - b for b, c in zip(baseline, candidate, strict=True)]
    ordered = sorted(deltas)
    mid = len(ordered) // 2
    median = (
        ordered[mid]
        if len(ordered) % 2
        else (ordered[mid - 1] + ordered[mid]) / 2
    )
    return MetricComparison(
        metric=metric,
        role=role,  # type: ignore[arg-type]
        baseline_mean=sum(baseline) / len(baseline),
        candidate_mean=sum(candidate) / len(candidate),
        paired_deltas=tuple(deltas),
        mean_delta=sum(deltas) / len(deltas),
        median_delta=median,
    )


def _resolve_outcome(
    primary: MetricComparison, metric: PrimaryMetric
) -> ExperimentOutcome:
    """Equivalence semantics: UNCHANGED is a positive claim requiring the whole CI inside
    the preregistered region; a CI that straddles a boundary is INCONCLUSIVE."""
    low, high = primary.ci_low, primary.ci_high
    assert low is not None and high is not None
    margin = metric.equivalence_margin
    # Normalise so that negative deltas are always "better".
    if metric.direction == "higher_is_better":
        low, high = -high, -low
    if high < -margin:
        return ExperimentOutcome.IMPROVED
    if low > margin:
        return ExperimentOutcome.REGRESSED
    if -margin <= low and high <= margin:
        return ExperimentOutcome.UNCHANGED
    return ExperimentOutcome.INCONCLUSIVE


def _guardrail_regressions(
    results: list[MetricComparison], guardrails: tuple[Guardrail, ...]
) -> list[str]:
    regressed: list[str] = []
    by_name = {r.metric: r for r in results}
    for rail in guardrails:
        result = by_name.get(rail.metric)
        if result is None:
            continue
        harm = result.mean_delta if rail.direction == "lower_is_better" else -result.mean_delta
        if harm > rail.max_harm:
            regressed.append(rail.metric)
    return regressed


def resolve_recommendation(
    outcome: ExperimentOutcome, guardrail_regressions: tuple[str, ...]
) -> FleetRecommendation:
    """Non-compensatory: a guardrail regression holds the candidate whatever the primary
    says — an improvement bought with collateral harm is not an improvement."""
    if guardrail_regressions:
        return FleetRecommendation.HOLD
    if outcome is ExperimentOutcome.IMPROVED:
        return FleetRecommendation.ADVANCE_TO_NEXT_TEST
    if outcome is ExperimentOutcome.REGRESSED:
        return FleetRecommendation.HOLD
    if outcome is ExperimentOutcome.INCONCLUSIVE:
        return FleetRecommendation.RUN_MORE_EXPERIMENTS
    return FleetRecommendation.NO_RECOMMENDATION


#: Metrics reported descriptively beside the primary — never part of the claim.
_DESCRIPTIVE_METRICS: tuple[str, ...] = (
    "wait.p50_s",
    "requests.served",
    "requests.unserved",
    "fleet.utilization_fraction",
    "depot.queue_p90_s",
    "business_proxy.served_trips",
    "business_proxy.unserved_demand",
)


def run_experiment(
    spec: ExperimentSpec,
    *,
    out_dir: Path | None = None,
    dispatch_mode: str = "nearest",
) -> DecisionRecord:
    """Run the full preregistered experiment and return (and optionally export) the record."""
    baseline_scenario = apply_axis(spec, spec.baseline_value)
    candidate_scenario = apply_axis(spec, spec.candidate_value)
    world_digest = tape_digest(spec.scenario, spec.seeds)

    def invalid(reason: InvalidityReason, detail: str) -> DecisionRecord:
        record = DecisionRecord(
            experiment_id=spec.experiment_id,
            decision_owner=spec.decision_owner,
            question=spec.question,
            spec_digest=spec.spec_digest(),
            world_tape_digest=world_digest,
            seed_set_digest=spec.seed_set_digest(),
            replications=len(spec.seeds),
            variation_axis=spec.variation_axis,
            baseline_value=spec.baseline_value,
            candidate_value=spec.candidate_value,
            validity=ExperimentValidity.INVALID_EXPERIMENT,
            invalidity_reason=reason,
            invalidity_detail=detail[:300],
            outcome=None,
            recommendation=FleetRecommendation.NO_RECOMMENDATION,
            primary=None,
            guardrail_results=(),
            guardrail_regressions=(),
            descriptives=(),
            calibration_state=spec.calibration_state,
            limitations=LIMITATIONS,
        )
        _export(record, out_dir)
        return record

    # Determinism precheck (invariant 12): the same seed must replay identically, or every
    # downstream delta is noise wearing a confidence interval.
    probe = build_tape(baseline_scenario, spec.seeds[0])
    first = run_metrics(run_fleet(baseline_scenario, probe, dispatch_mode=dispatch_mode))
    second = run_metrics(run_fleet(baseline_scenario, probe, dispatch_mode=dispatch_mode))
    if first != second:
        return invalid(
            InvalidityReason.REPLICATION_MISMATCH,
            "identical seed produced different metrics on replay",
        )

    baseline_runs: list[dict[str, float]] = []
    candidate_runs: list[dict[str, float]] = []
    for seed in spec.seeds:
        # One tape per seed; both arms see the same one. The tape is built from the
        # *declared* scenario, so the axis cannot leak into the exogenous world.
        tape = build_tape(spec.scenario, seed)
        for scenario, runs in (
            (baseline_scenario, baseline_runs),
            (candidate_scenario, candidate_runs),
        ):
            log = run_fleet(scenario, tape, dispatch_mode=dispatch_mode)
            violations = check_invariants(log)
            if violations:
                return invalid(
                    InvalidityReason.INVARIANT_VIOLATION,
                    f"seed {seed}: {violations[0]}",
                )
            runs.append(run_metrics(log))

    primary = _compare(
        spec.primary_metric.name, "PRIMARY", baseline_runs, candidate_runs
    )
    if primary is None:
        return invalid(
            InvalidityReason.NOT_COMPARABLE,
            f"primary metric {spec.primary_metric.name} unavailable in some replication",
        )
    low, high = _bootstrap_ci(
        list(primary.paired_deltas), spec.bootstrap_resamples, spec.spec_digest()
    )
    primary = primary.model_copy(update={"ci_low": low, "ci_high": high})

    guardrail_results = [
        result
        for rail in spec.guardrails
        if (result := _compare(rail.metric, "GUARDRAIL", baseline_runs, candidate_runs))
    ]
    regressions = _guardrail_regressions(guardrail_results, spec.guardrails)
    descriptives = [
        result
        for name in _DESCRIPTIVE_METRICS
        if name != spec.primary_metric.name
        and (result := _compare(name, "DESCRIPTIVE", baseline_runs, candidate_runs))
    ]

    outcome = _resolve_outcome(primary, spec.primary_metric)
    recommendation = resolve_recommendation(outcome, tuple(regressions))

    record = DecisionRecord(
        experiment_id=spec.experiment_id,
        decision_owner=spec.decision_owner,
        question=spec.question,
        spec_digest=spec.spec_digest(),
        world_tape_digest=world_digest,
        seed_set_digest=spec.seed_set_digest(),
        replications=len(spec.seeds),
        variation_axis=spec.variation_axis,
        baseline_value=spec.baseline_value,
        candidate_value=spec.candidate_value,
        validity=ExperimentValidity.VALID,
        outcome=outcome,
        recommendation=recommendation,
        primary=primary,
        guardrail_results=tuple(guardrail_results),
        guardrail_regressions=tuple(regressions),
        descriptives=tuple(descriptives),
        calibration_state=spec.calibration_state,
        limitations=LIMITATIONS,
    )
    _export(record, out_dir)
    return record


def _export(record: DecisionRecord, out_dir: Path | None) -> None:
    if out_dir is None:
        return
    destination = out_dir / record.experiment_id
    destination.mkdir(parents=True, exist_ok=True)
    (destination / "decision-record.json").write_text(
        json.dumps(record.model_dump(mode="json"), indent=2, sort_keys=True) + "\n",
        encoding="utf-8",
    )
    (destination / "decision-record.txt").write_text(render_record(record), encoding="utf-8")


def render_record(record: DecisionRecord) -> str:
    """The one-page text a decision meeting reads."""
    lines = [
        "FLEET EXPERIMENT DECISION RECORD - " + " / ".join(record.labels),
        "",
        f"Experiment:      {record.experiment_id}",
        f"Question:        {record.question}",
        f"Decision owner:  {record.decision_owner}",
        f"Variation axis:  {record.variation_axis}  "
        f"(baseline {record.baseline_value:g} -> candidate {record.candidate_value:g})",
        f"Replications:    {record.replications} paired seeds  "
        f"(seed set {record.seed_set_digest[:12]})",
        f"Spec digest:     {record.spec_digest[:12]}   "
        f"World tape: {record.world_tape_digest[:12]}",
        f"Calibration:     {record.calibration_state.value}",
        "",
        f"VALIDITY:        {record.validity.value}"
        + (
            f"  ({record.invalidity_reason.value}: {record.invalidity_detail})"
            if record.invalidity_reason
            else ""
        ),
    ]
    if record.primary is not None:
        primary = record.primary
        lines += [
            f"OUTCOME:         {record.outcome.value if record.outcome else 'NONE'}",
            "",
            f"Primary metric   {primary.metric}: mean delta {primary.mean_delta:+.1f} "
            f"(median {primary.median_delta:+.1f}), 95% CI "
            f"[{primary.ci_low:+.1f}, {primary.ci_high:+.1f}]",
            f"                 baseline {primary.baseline_mean:.1f} -> "
            f"candidate {primary.candidate_mean:.1f}",
        ]
        for rail in record.guardrail_results:
            flag = "REGRESSED" if rail.metric in record.guardrail_regressions else "ok"
            lines.append(
                f"Guardrail        {rail.metric}: mean delta {rail.mean_delta:+.3f}  [{flag}]"
            )
        for item in record.descriptives:
            lines.append(
                f"Descriptive      {item.metric}: {item.baseline_mean:.1f} -> "
                f"{item.candidate_mean:.1f} (mean delta {item.mean_delta:+.1f})"
            )
    lines += [
        "",
        f"RECOMMENDATION:  {record.recommendation.value}",
        f"Deployment permission: {record.deployment_permission}",
        "",
        "Limitations:",
        *[f"  - {limitation}" for limitation in record.limitations],
        "",
    ]
    return "\n".join(lines)
