"""Fleet experiment spec-file authoring and stored-record loading."""

from __future__ import annotations

import json
from pathlib import Path

import pytest
from tests.unit.test_fleet_contracts_and_world import small_spec

from hermes.fleet.authoring import (
    MAX_SPEC_BYTES,
    SpecAuthoringError,
    load_decision_record,
    load_experiment_spec,
    parse_experiment_spec_yaml,
    render_experiment_template,
)
from hermes.fleet.cli import fleet_005_spec
from hermes.fleet.experiment import run_experiment

_ERROR_LABELS = (
    "WHAT FAILED",
    "WHY",
    "HOW TO FIX",
    "WHICH CONFIG FIELD",
)


def test_the_committed_fleet_005_spec_is_the_in_code_spec() -> None:
    repository_root = Path(__file__).parents[2]
    path = repository_root / "config/fleet/fleet-005-turnaround.yaml"

    assert load_experiment_spec(path).spec_digest() == fleet_005_spec().spec_digest()


def test_a_rendered_template_round_trips_to_the_same_digest() -> None:
    for spec in (fleet_005_spec(), small_spec()):
        rendered = render_experiment_template(spec)

        assert parse_experiment_spec_yaml(rendered).spec_digest() == spec.spec_digest()


def test_the_committed_invalid_example_fails_at_authoring_time_with_the_fix() -> None:
    repository_root = Path(__file__).parents[2]
    path = repository_root / "config/fleet/examples/invalid-unregistered-metric.yaml"

    with pytest.raises(SpecAuthoringError) as exc_info:
        load_experiment_spec(path)

    error = exc_info.value
    message = str(error)
    assert "INVALID_EXPERIMENT_SPEC" in message
    for label in _ERROR_LABELS:
        assert label in message
    assert "wait.p95_s" in message
    assert "primary_metric.name" in message
    assert "wait.p90_s" in message
    assert error.field == "primary_metric.name"
    assert error.source == str(path)


def test_malformed_yaml_is_an_authoring_error_not_a_yaml_exception() -> None:
    documents = (
        "value: &shared 1\ncopy: *shared\n",
        "value: 1\nvalue: 2\n",
        "- not\n- a\n- mapping\n",
    )

    for document in documents:
        with pytest.raises(SpecAuthoringError) as exc_info:
            parse_experiment_spec_yaml(document)

        error = exc_info.value
        assert error.field == "<document>"
        assert "WHICH CONFIG FIELD:  <document>" in str(error)
        for label in _ERROR_LABELS:
            assert label in str(error)


def test_malformed_yaml_errors_render_as_exactly_five_labelled_lines() -> None:
    documents = (
        "value: 1\nvalue: 2\n",
        "value: [1,\n",
    )

    for document in documents:
        with pytest.raises(SpecAuthoringError) as exc_info:
            parse_experiment_spec_yaml(document)

        lines = str(exc_info.value).splitlines()
        assert len(lines) == 5
        assert sum(line.startswith("INVALID_EXPERIMENT_SPEC:") for line in lines) == 1
        for label in _ERROR_LABELS:
            assert sum(line.startswith(f"{label}:") for line in lines) == 1


def test_an_author_controlled_newline_cannot_spoof_an_error_label() -> None:
    payload = fleet_005_spec().model_dump(mode="json")
    injected_name = "wait.p95_s\nHOW TO FIX: injected"
    payload["primary_metric"] = {
        **payload["primary_metric"],
        "name": injected_name,
    }

    with pytest.raises(SpecAuthoringError) as exc_info:
        parse_experiment_spec_yaml(json.dumps(payload))

    error = exc_info.value
    lines = str(error).splitlines()
    assert "\nHOW TO FIX: injected" in error.what
    assert len(lines) == 5
    assert sum(line.startswith("HOW TO FIX:") for line in lines) == 1


def test_an_extra_key_and_a_missing_key_name_the_field() -> None:
    payload = fleet_005_spec().model_dump(mode="json")
    cases = (
        ({**payload, "extra_field": "no"}, "extra_field"),
        (
            {key: value for key, value in payload.items() if key != "primary_metric"},
            "primary_metric",
        ),
        (
            {**payload, "scenario": {**payload["scenario"], "horizon_s": "long"}},
            "scenario.horizon_s",
        ),
        ({**payload, "seeds": [*payload["seeds"][:3], "bad", *payload["seeds"][4:]]}, "seeds[3]"),
    )

    for invalid, expected_field in cases:
        with pytest.raises(SpecAuthoringError) as exc_info:
            parse_experiment_spec_yaml(json.dumps(invalid))

        assert exc_info.value.field == expected_field


def test_an_oversized_spec_is_rejected_before_parsing(tmp_path: Path) -> None:
    path = tmp_path / "oversized.yaml"
    path.write_text("x" * (MAX_SPEC_BYTES + 1), encoding="utf-8")

    with pytest.raises(SpecAuthoringError) as exc_info:
        load_experiment_spec(path)

    assert str(MAX_SPEC_BYTES) in str(exc_info.value)


def test_a_path_resolution_failure_is_an_authoring_error(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    path = Path("controlled-spec.yaml")

    def fail_expansion(_path: Path) -> Path:
        raise RuntimeError("controlled expansion failure")

    monkeypatch.setattr(Path, "expanduser", fail_expansion)

    with pytest.raises(SpecAuthoringError) as exc_info:
        load_experiment_spec(path)

    assert exc_info.value.source == str(path)
    assert "controlled expansion failure" in str(exc_info.value)


def test_runtime_and_os_errors_during_resolve_are_authoring_errors(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    path = Path("controlled-resolve-spec.yaml")

    for failure in (
        RuntimeError("controlled RuntimeError during resolution"),
        OSError("controlled OSError during resolution"),
    ):
        reason = str(failure)

        def fail_resolution(
            _path: Path,
            *,
            strict: bool = False,
            _failure: Exception = failure,
        ) -> Path:
            raise _failure

        with monkeypatch.context() as scoped:
            scoped.setattr(Path, "resolve", fail_resolution)
            with pytest.raises(SpecAuthoringError) as exc_info:
                load_experiment_spec(path)

        assert exc_info.value.source == str(path)
        assert reason in str(exc_info.value)


def test_a_written_decision_record_reloads_to_the_same_digest(tmp_path: Path) -> None:
    record = run_experiment(small_spec(), out_dir=tmp_path)
    path = tmp_path / "probe-experiment" / "decision-record.json"

    loaded = load_decision_record(path)
    assert loaded.record_digest() == record.record_digest()

    payload = json.loads(path.read_text(encoding="utf-8"))
    invalid_path = tmp_path / "invalid-record.json"
    invalid_path.write_text(
        json.dumps({**payload, "spec_digest": "z" + payload["spec_digest"][1:]}),
        encoding="utf-8",
    )
    with pytest.raises(SpecAuthoringError):
        load_decision_record(invalid_path)

    changed = "0" if payload["spec_digest"][0] != "0" else "1"
    changed_path = tmp_path / "changed-record.json"
    changed_path.write_text(
        json.dumps({**payload, "spec_digest": changed + payload["spec_digest"][1:]}),
        encoding="utf-8",
    )
    changed_record = load_decision_record(changed_path)
    assert changed_record.spec_digest != record.spec_digest
    assert changed_record.record_digest() != record.record_digest()
