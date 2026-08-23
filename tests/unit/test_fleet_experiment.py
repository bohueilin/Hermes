"""The paired experiment loop: preregistration honoured, refusals working, replay exact.

The properties a decision meeting depends on: the outcome comes from the preregistered
equivalence region; a guardrail regression is non-compensatory; an invariant violation voids
the evidence with no partial outcome; and the same spec replays to a bit-identical record.
"""

from __future__ import annotations

from tests.unit.test_fleet_contracts_and_world import small_spec

from hermes.fleet.contracts import (
    ExperimentOutcome,
    ExperimentValidity,
    FleetRecommendation,
    InvalidityReason,
    MetricComparison,
    PrimaryMetric,
)
from hermes.fleet.experiment import (
    _resolve_outcome,
    resolve_recommendation,
    run_experiment,
)

_METRIC = PrimaryMetric(
    name="wait.p90_s", unit="s", direction="lower_is_better", equivalence_margin=30.0
)


def _primary(ci_low: float, ci_high: float) -> MetricComparison:
    return MetricComparison(
        metric="wait.p90_s",
        role="PRIMARY",
        baseline_mean=100.0,
        candidate_mean=100.0,
        paired_deltas=(0.0,),
        mean_delta=(ci_low + ci_high) / 2,
        median_delta=(ci_low + ci_high) / 2,
        ci_low=ci_low,
        ci_high=ci_high,
    )


# --- equivalence semantics -------------------------------------------------------------


def test_a_ci_entirely_below_the_margin_is_improved() -> None:
    assert _resolve_outcome(_primary(-80.0, -40.0), _METRIC) is ExperimentOutcome.IMPROVED


def test_a_ci_entirely_above_the_margin_is_regressed() -> None:
    assert _resolve_outcome(_primary(40.0, 80.0), _METRIC) is ExperimentOutcome.REGRESSED


def test_a_ci_inside_the_equivalence_region_is_unchanged() -> None:
    assert _resolve_outcome(_primary(-20.0, 25.0), _METRIC) is ExperimentOutcome.UNCHANGED


def test_a_ci_straddling_a_boundary_is_inconclusive_not_unchanged() -> None:
    """The oldest lie in experimentation: 'no significant difference' read as 'no
    difference'. A CI that crosses the margin supports neither claim."""
    assert _resolve_outcome(_primary(-20.0, 45.0), _METRIC) is ExperimentOutcome.INCONCLUSIVE


def test_direction_is_normalised_for_higher_is_better_metrics() -> None:
    metric = _METRIC.model_copy(update={"direction": "higher_is_better"})
    assert _resolve_outcome(_primary(40.0, 80.0), metric) is ExperimentOutcome.IMPROVED


# --- the recommendation is non-compensatory --------------------------------------------


def test_a_guardrail_regression_holds_even_an_improved_candidate() -> None:
    assert (
        resolve_recommendation(ExperimentOutcome.IMPROVED, ("unserved.fraction",))
        is FleetRecommendation.HOLD
    )


def test_clean_outcomes_map_to_their_recommendations() -> None:
    assert (
        resolve_recommendation(ExperimentOutcome.IMPROVED, ())
        is FleetRecommendation.ADVANCE_TO_NEXT_TEST
    )
    assert resolve_recommendation(ExperimentOutcome.REGRESSED, ()) is FleetRecommendation.HOLD
    assert (
        resolve_recommendation(ExperimentOutcome.INCONCLUSIVE, ())
        is FleetRecommendation.RUN_MORE_EXPERIMENTS
    )
    assert (
        resolve_recommendation(ExperimentOutcome.UNCHANGED, ())
        is FleetRecommendation.NO_RECOMMENDATION
    )


# --- refusals and replay ---------------------------------------------------------------


def test_a_seeded_dispatcher_defect_voids_the_evidence_with_no_partial_outcome() -> None:
    record = run_experiment(small_spec(), dispatch_mode="defect_double_assign")
    assert record.validity is ExperimentValidity.INVALID_EXPERIMENT
    assert record.invalidity_reason is InvalidityReason.INVARIANT_VIOLATION
    assert record.outcome is None
    assert record.primary is None
    assert record.recommendation is FleetRecommendation.NO_RECOMMENDATION
    assert record.deployment_permission == "NONE"


def test_the_same_spec_replays_to_a_bit_identical_record() -> None:
    """Replayability is the decision record's whole claim to trust."""
    spec = small_spec()
    assert run_experiment(spec).record_digest() == run_experiment(spec).record_digest()


def test_a_valid_experiment_carries_its_preregistration_digests(tmp_path) -> None:
    spec = small_spec()
    record = run_experiment(spec, out_dir=tmp_path)
    assert record.validity is ExperimentValidity.VALID
    assert record.spec_digest == spec.spec_digest()
    assert record.seed_set_digest == spec.seed_set_digest()
    assert record.replications == len(spec.seeds)
    assert record.labels[0] == "SIMULATION_ONLY"
    exported = tmp_path / spec.experiment_id / "decision-record.json"
    assert exported.exists()


def test_the_primary_metric_carries_a_ci_and_descriptives_do_not_claim() -> None:
    record = run_experiment(small_spec())
    assert record.primary is not None
    assert record.primary.ci_low is not None and record.primary.ci_high is not None
    assert all(item.role == "DESCRIPTIVE" for item in record.descriptives)
    assert all(item.ci_low is None for item in record.descriptives)
