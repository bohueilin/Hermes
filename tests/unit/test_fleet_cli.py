"""Fleet CLI metric-contract and experiment-authoring behavior."""

import errno
import os
from pathlib import Path

import pytest
from tests.unit.test_fleet_demo_digest import (
    FLEET_005_RECORD_DIGEST,
    FLEET_005_SPEC_DIGEST,
)
from typer.testing import CliRunner

from hermes.cli import app
from hermes.fleet.metrics import METRIC_REGISTRY_VERSION, Availability, definitions, resolve

runner = CliRunner()


def test_metrics_list_prints_every_registered_definition_from_the_registry() -> None:
    """The metrics command renders every field from the registered contract."""
    result = runner.invoke(app, ["fleet", "metrics", "list"])

    assert result.exit_code == 0
    registered_definitions = definitions()
    assert (
        f"Metric registry {METRIC_REGISTRY_VERSION} - {len(registered_definitions)} metrics "
        "- simulation only; synthetic; not a forecast"
    ) in result.output

    previous_index = -1
    conditional_definitions = [
        definition
        for definition in registered_definitions
        if definition.availability is Availability.CONDITIONAL
    ]
    always_definitions = [
        definition
        for definition in registered_definitions
        if definition.availability is Availability.ALWAYS
    ]
    assert len(conditional_definitions) == 3
    assert len(always_definitions) == 7

    for definition in registered_definitions:
        definition_index = result.output.index(definition.name)
        assert definition_index > previous_index
        previous_index = definition_index
        assert f"unit: {definition.unit}" in result.output
        assert f"direction: {definition.direction.value}" in result.output
        assert f"aggregation: {definition.aggregation.value}" in result.output
        assert f"population: {definition.population}" in result.output
        assert f"availability: {definition.availability.value}" in result.output
        assert ", ".join(surface.value for surface in definition.surfaces) in result.output
        if definition.absent_when is not None:
            assert f"absent when: {definition.absent_when}" in result.output
        if definition.alias_of is not None:
            assert f"alias of {definition.alias_of}" in result.output
        if definition.descriptive_rank is not None:
            assert f"descriptive rank {definition.descriptive_rank}" in result.output


def test_metrics_list_is_deterministic() -> None:
    """The metrics command emits stable contract text on repeated invocations."""
    first = runner.invoke(app, ["fleet", "metrics", "list"])
    second = runner.invoke(app, ["fleet", "metrics", "list"])

    assert first.exit_code == 0
    assert second.exit_code == 0
    assert first.output == second.output


def test_a_conditional_metric_groups_availability_and_absence_before_surfaces() -> None:
    result = runner.invoke(app, ["fleet", "metrics", "list"])
    definition = resolve("wait.p50_s")
    expected = (
        f"  availability: {definition.availability.value}\n"
        f"  absent when: {definition.absent_when}\n"
        "  surfaces: "
    )

    assert result.exit_code == 0
    assert expected in result.output


def test_experiment_validate_accepts_the_committed_spec() -> None:
    repository_root = Path(__file__).parents[2]
    path = repository_root / "config/fleet/fleet-005-turnaround.yaml"
    primary = resolve("wait.p90_s")

    result = runner.invoke(app, ["fleet", "experiment", "validate", str(path)])

    assert result.exit_code == 0
    assert "VALID fleet-005-turnaround" in result.output
    assert f"Spec digest: {FLEET_005_SPEC_DIGEST}" in result.output
    assert f"Primary: wait.p90_s ({primary.unit}, {primary.direction.value}" in result.output


def test_experiment_validate_rejects_the_committed_invalid_example() -> None:
    repository_root = Path(__file__).parents[2]
    path = repository_root / "config/fleet/examples/invalid-unregistered-metric.yaml"

    result = runner.invoke(app, ["fleet", "experiment", "validate", str(path)])

    assert result.exit_code == 40
    for expected in (
        "[CONFIGURATION_ERROR]",
        "INVALID_EXPERIMENT_SPEC",
        "WHAT FAILED",
        "WHY",
        "HOW TO FIX",
        "WHICH CONFIG FIELD",
        "wait.p95_s",
        "primary_metric.name",
        "wait.p90_s",
        "Exit code: 40",
    ):
        assert expected in result.output


def test_experiment_run_reproduces_the_demo_digest_from_the_committed_spec(
    tmp_path: Path,
) -> None:
    repository_root = Path(__file__).parents[2]
    path = repository_root / "config/fleet/fleet-005-turnaround.yaml"

    result = runner.invoke(
        app,
        ["fleet", "experiment", "run", str(path), "--out-dir", str(tmp_path)],
    )

    assert result.exit_code == 0
    assert (tmp_path / "fleet-005-turnaround" / "decision-record.json").exists()
    assert result.output.splitlines()[-1] == f"Record digest:   {FLEET_005_RECORD_DIGEST}"


def test_experiment_inspect_redigests_a_stored_record(tmp_path: Path) -> None:
    repository_root = Path(__file__).parents[2]
    spec_path = repository_root / "config/fleet/fleet-005-turnaround.yaml"
    run_result = runner.invoke(
        app,
        ["fleet", "experiment", "run", str(spec_path), "--out-dir", str(tmp_path)],
    )
    record_path = tmp_path / "fleet-005-turnaround" / "decision-record.json"

    result = runner.invoke(app, ["fleet", "experiment", "inspect", str(record_path)])

    assert run_result.exit_code == 0
    assert result.exit_code == 0
    assert result.output.splitlines()[-1] == f"Record digest:   {FLEET_005_RECORD_DIGEST}"

    invalid_path = tmp_path / "invalid-record.json"
    invalid_path.write_text("{}", encoding="utf-8")
    invalid_result = runner.invoke(
        app,
        ["fleet", "experiment", "inspect", str(invalid_path)],
    )
    assert invalid_result.exit_code == 40
    assert "[CONFIGURATION_ERROR]" in invalid_result.output


def test_experiment_template_prints_a_loadable_spec() -> None:
    from hermes.fleet.authoring import parse_experiment_spec_yaml

    result = runner.invoke(app, ["fleet", "experiment", "template"])

    assert result.exit_code == 0
    assert (
        parse_experiment_spec_yaml(result.output).spec_digest()
        == FLEET_005_SPEC_DIGEST
    )


def test_experiment_errors_name_a_missing_file_only_as_given(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    repository_root = Path(__file__).parents[2]
    monkeypatch.chdir(repository_root)

    for command, given in (
        ("validate", "config/fleet/does-not-exist.yaml"),
        ("inspect", "experiments/does-not-exist/decision-record.json"),
    ):
        result = runner.invoke(app, ["fleet", "experiment", command, given])

        assert result.exit_code == 40
        assert "[CONFIGURATION_ERROR]" in result.output
        assert "Exit code: 40" in result.output
        assert given in result.output
        assert str(repository_root.resolve()) not in result.output
        assert str(Path.home()) not in result.output
        assert os.strerror(errno.ENOENT) in result.output
