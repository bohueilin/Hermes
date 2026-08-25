"""The failure-to-regression flywheel, and the two ways it must refuse.

The flywheel's value is not that it can add a scenario. It is that it will not add the wrong
one: not a duplicate of coverage that already exists, and not one that quietly weakens the
coverage it claims to extend. Those refusals are what let a human approve a proposal without
having to re-derive it themselves.
"""

from __future__ import annotations

from pathlib import Path

import pytest

from hermes.regression.builder import (
    assess_coverage,
    derive_scenario_payload,
    scenario_yaml_bytes,
)
from hermes.regression.floor import enforce_floor, mandatory_minimum_violations
from hermes.regression.models import DraftState
from hermes.scenarios.loader import load_scenario, parse_scenario_yaml


@pytest.fixture
def source(repository_root: Path):
    return load_scenario(repository_root / "scenarios" / "adas" / "aeb_lead_hard_brake.yaml")


def _derived(source, **overrides):
    payload = derive_scenario_payload(
        source,
        observed_gap_m=overrides.pop("gap", 28.8),
        observed_ego_speed_mps=overrides.pop("speed", 18.5),
        scenario_name=overrides.pop("name", "derived_probe"),
        trigger_finding_id="adas.aeb.brake_onset_margin",
    )
    for key, value in overrides.items():
        payload[key] = value
    return parse_scenario_yaml(scenario_yaml_bytes(payload).decode("utf-8"))


# --- derivation ------------------------------------------------------------------------


def test_the_draft_starts_at_the_observed_failure_geometry(source) -> None:
    """A regression case should reach the failure immediately, not drive up to it."""
    derived = _derived(source, gap=28.8, speed=18.5)

    assert derived.challenge.initial_gap_m == 28.8
    assert derived.initial_state.speed_mps == 18.5
    assert source.challenge.initial_gap_m != 28.8


def test_the_draft_preserves_everything_it_did_not_derive(source) -> None:
    """The diff a reviewer reads should be the starting conditions and nothing else."""
    derived = _derived(source)

    assert derived.challenge.kind == source.challenge.kind
    assert derived.challenge.actor_speed_mps == source.challenge.actor_speed_mps
    assert derived.control.frequency_hz == source.control.frequency_hz
    assert derived.adas.enabled == source.adas.enabled
    assert derived.adas.expected_aeb.kind == source.adas.expected_aeb.kind


def test_the_draft_is_tagged_as_a_regression_and_keeps_its_source_tags(source) -> None:
    derived = _derived(source)

    assert "regression" in derived.tags
    assert set(source.tags) <= set(derived.tags)


def test_derivation_is_deterministic(source) -> None:
    """The same evidence yields the same bytes, so the content digest is stable."""
    first = scenario_yaml_bytes(
        derive_scenario_payload(
            source,
            observed_gap_m=28.8,
            observed_ego_speed_mps=18.5,
            scenario_name="derived_probe",
            trigger_finding_id="adas.aeb.brake_onset_margin",
        )
    )
    second = scenario_yaml_bytes(
        derive_scenario_payload(
            source,
            observed_gap_m=28.8,
            observed_ego_speed_mps=18.5,
            scenario_name="derived_probe",
            trigger_finding_id="adas.aeb.brake_onset_margin",
        )
    )

    assert first == second


def test_a_derived_gap_is_clamped_into_the_schema_bounds(source) -> None:
    """A gap of zero is a collision, not a scenario."""
    derived = _derived(source, gap=0.0)

    assert derived.challenge.initial_gap_m >= 1.0


def test_stationary_lead_derivation_preserves_its_schedule_free_contract(source) -> None:
    """A generic challenge draft must not invent a trigger unsupported by its kind."""
    payload = source.model_dump(mode="json")
    payload["name"] = "stationary_regression_source"
    payload["challenge"] = {
        "kind": "stationary_lead",
        "actor_control_mode": "scripted_kinematic_replay",
        "behavior_realism_claim": False,
        "initial_gap_m": 40.0,
        "initial_lane_delta": 0,
    }
    stationary = parse_scenario_yaml(scenario_yaml_bytes(payload).decode("utf-8"))

    derived_payload = derive_scenario_payload(
        stationary,
        observed_gap_m=28.8,
        observed_ego_speed_mps=18.5,
        scenario_name="stationary_regression_derived",
        trigger_finding_id="adas.aeb.threat_response",
    )

    derived = parse_scenario_yaml(scenario_yaml_bytes(derived_payload).decode("utf-8"))
    assert derived.challenge is not None
    assert derived.challenge.kind == "stationary_lead"
    assert derived.challenge.initial_gap_m == 28.8


# --- coverage gap ----------------------------------------------------------------------


def test_a_proposal_matching_existing_coverage_is_refused(source, repository_root) -> None:
    """The flywheel closes gaps; a duplicate costs simulation time forever."""
    from hermes.regression.builder import committed_suite

    near_duplicate = _derived(
        source,
        gap=source.challenge.initial_gap_m,
        speed=source.initial_state.speed_mps,
    )

    assessment = assess_coverage(
        candidate=near_duplicate, suite=committed_suite(repository_root)
    )

    assert assessment.covered
    assert assessment.matching_scenario == source.name


def test_a_materially_different_proposal_is_a_gap(source, repository_root) -> None:
    from hermes.regression.builder import committed_suite

    sharper = _derived(source, gap=12.0, speed=18.5)

    assessment = assess_coverage(candidate=sharper, suite=committed_suite(repository_root))

    assert assessment.covered is False


def test_coverage_ignores_scenarios_with_a_different_expectation(source) -> None:
    """A threat-free scenario never covers a threat scenario, however close the geometry."""
    threat = _derived(source, gap=30.0, speed=20.0)
    payload = threat.model_dump(mode="json")
    payload["name"] = "threat_free_twin"
    payload["adas"]["expected_aeb"] = {"kind": "forbidden"}
    twin = parse_scenario_yaml(scenario_yaml_bytes(payload).decode("utf-8"))

    assessment = assess_coverage(candidate=threat, suite=(twin,))

    assert assessment.covered is False


# --- the requirement floor -------------------------------------------------------------


def test_a_draft_that_drops_a_function_is_rejected(source) -> None:
    """The authority-laundering channel: add coverage on paper, remove it in fact."""
    payload = _derived(source).model_dump(mode="json")
    payload["adas"]["enabled"] = ["fcw"]
    weakened = parse_scenario_yaml(scenario_yaml_bytes(payload).decode("utf-8"))

    violations = enforce_floor(source, weakened)

    assert any(item.rule == "no_function_removal" for item in violations)


def test_a_draft_that_drops_the_aeb_expectation_is_rejected(source) -> None:
    payload = _derived(source).model_dump(mode="json")
    payload["adas"].pop("expected_aeb")
    weakened = parse_scenario_yaml(scenario_yaml_bytes(payload).decode("utf-8"))

    violations = enforce_floor(source, weakened)

    rules = {item.rule for item in violations}
    assert "no_aeb_expectation_weakening" in rules
    assert "aeb_expectation_required" in rules


def test_a_draft_that_inverts_the_aeb_expectation_is_rejected(source) -> None:
    """Flipping required to forbidden asserts the opposite of the coverage it extends."""
    payload = _derived(source).model_dump(mode="json")
    payload["adas"]["expected_aeb"] = {"kind": "forbidden"}
    inverted = parse_scenario_yaml(scenario_yaml_bytes(payload).decode("utf-8"))

    violations = enforce_floor(source, inverted)

    assert any(item.rule == "no_aeb_expectation_inversion" for item in violations)


def test_a_draft_that_drops_a_tag_is_rejected(source) -> None:
    """Dropping a tag silently removes the scenario from suite selections."""
    payload = _derived(source).model_dump(mode="json")
    payload["tags"] = ["regression"]
    weakened = parse_scenario_yaml(scenario_yaml_bytes(payload).decode("utf-8"))

    violations = enforce_floor(source, weakened)

    assert any(item.rule == "no_tag_removal" for item in violations)


def test_a_faithful_draft_passes_the_floor(source) -> None:
    assert enforce_floor(source, _derived(source)) == ()


def test_a_scenario_enabling_aeb_without_an_expectation_fails_the_minimum(source) -> None:
    payload = _derived(source).model_dump(mode="json")
    payload["adas"] = {"enabled": ["aeb"]}
    bare = parse_scenario_yaml(scenario_yaml_bytes(payload).decode("utf-8"))

    violations = mandatory_minimum_violations(bare)

    assert any(item.rule == "aeb_expectation_required" for item in violations)


def test_a_non_adas_scenario_has_no_mandatory_minimum(repository_root: Path) -> None:
    nominal = load_scenario(repository_root / "scenarios" / "fake_nominal.yaml")

    assert mandatory_minimum_violations(nominal) == ()


# --- draft records ---------------------------------------------------------------------


def test_editing_a_draft_after_it_was_recorded_is_detected(tmp_path: Path) -> None:
    """The draft record's digest is what an approval binds to; it must stay honest."""
    import json

    from hermes.regression.builder import RegressionDraftError, load_draft

    directory = tmp_path / "regression-probe"
    directory.mkdir()
    (directory / "scenario.yaml").write_text("name: original\n", encoding="utf-8")
    record = {
        "schema_version": "1.0",
        "draft_id": "regression-probe",
        "state": DraftState.VALIDATED.value,
        "scenario_name": "original_probe",
        "scenario_content_digest": "0" * 64,
        "provenance": {
            "source_run_id": "run",
            "source_bundle_digest": "a" * 64,
            "source_scenario_name": "src",
            "source_scenario_digest": "b" * 64,
            "trigger_finding_id": "adas.aeb.threat_response",
        },
        "rationale": "probe",
    }
    (directory / "draft.json").write_text(json.dumps(record), encoding="utf-8")

    with pytest.raises(RegressionDraftError, match="edited since it was recorded"):
        load_draft(directory)


@pytest.mark.parametrize(
    ("state", "promotable"),
    [
        (DraftState.DRAFT, False),
        (DraftState.VALIDATED, True),
        (DraftState.APPROVED, True),
        (DraftState.REJECTED, False),
        (DraftState.PROMOTED, False),
    ],
)
def test_only_a_validated_or_approved_draft_is_promotable(
    state: DraftState, promotable: bool
) -> None:
    from hermes.regression.models import DraftProvenance, RegressionDraft

    draft = RegressionDraft(
        draft_id="regression-probe",
        state=state,
        scenario_name="probe_scenario",
        scenario_content_digest="0" * 64,
        provenance=DraftProvenance(
            source_run_id="run",
            source_bundle_digest="a" * 64,
            source_scenario_name="src",
            source_scenario_digest="b" * 64,
            trigger_finding_id="adas.aeb.threat_response",
        ),
        rationale="probe",
    )

    assert draft.is_promotable is promotable
