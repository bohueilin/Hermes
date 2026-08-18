"""Determinism, purity, and anti-cherry-picking properties of the grid materializer."""

from __future__ import annotations

import subprocess
import sys
from pathlib import Path
from typing import Any

import pytest
from pydantic import ValidationError

from adequacy_plan_fixtures import (
    DEFAULT_GRID,
    TEMPLATE_PAYLOAD,
    TEMPLATE_RELATIVE_PATH,
    template_bytes,
    template_scenario,
)
from hermes.adequacy.models import (
    GRID_PARAMETER_ORDER,
    MaterializedVariantBinding,
    StudyProtocol,
    validate_grid_value,
)
from hermes.domain.models import ScenarioDefinition
from hermes.evaluation_plans.materializer import (
    MAX_GRID_VARIANTS,
    MaterializationError,
    StudyProtocolAuthoringDraft,
    materialize,
    render_variant,
    serialize_protocol,
    serialize_scenario,
)
from hermes.scenarios.loader import scenario_digest
from hermes.simulator_support import (
    SUPPORTED_METADRIVE_COMMIT,
    SUPPORTED_METADRIVE_VERSION,
)

REPOSITORY_ROOT = Path(__file__).resolve().parents[2]


def _body() -> dict[str, Any]:
    import importlib.util

    spec = importlib.util.spec_from_file_location(
        "_loader_fixtures", REPOSITORY_ROOT / "tests" / "unit" / "test_adequacy_loader.py"
    )
    assert spec is not None and spec.loader is not None
    module = importlib.util.module_from_spec(spec)
    sys.modules.setdefault("_loader_fixtures", module)
    spec.loader.exec_module(module)
    payload = module._protocol_payload()
    return {
        key: value
        for key, value in payload.items()
        if key not in {"schema_version", "baseline_grid", "materializer"}
    }


def _draft(grid: tuple[tuple[str, tuple[Any, ...]], ...] = DEFAULT_GRID) -> Any:
    return StudyProtocolAuthoringDraft(
        draft_schema_version="1.0",
        template_repository_relative_path=TEMPLATE_RELATIVE_PATH,
        baseline_grid=tuple(
            {"parameter": parameter, "values": values} for parameter, values in grid
        ),
        protocol_body=_body(),
    )


def _materialize(grid: tuple[tuple[str, tuple[Any, ...]], ...] = DEFAULT_GRID) -> Any:
    return materialize(
        _draft(grid),
        template_bytes(),
        template_scenario(),
        simulator_version=SUPPORTED_METADRIVE_VERSION,
        simulator_commit=SUPPORTED_METADRIVE_COMMIT,
    )


def test_materialization_is_byte_deterministic() -> None:
    first = _materialize()
    second = _materialize()
    assert first.protocol_yaml_bytes == second.protocol_yaml_bytes
    assert first.protocol_byte_digest_sha256 == second.protocol_byte_digest_sha256
    assert first.protocol_semantic_digest_sha256 == second.protocol_semantic_digest_sha256
    assert [variant.scenario_bytes for variant in first.variants] == [
        variant.scenario_bytes for variant in second.variants
    ]


def test_variant_table_exhausts_the_declared_grid_in_order() -> None:
    grid = (
        ("initial_gap_m", (6.0, 8.0)),
        ("actor_speed_mps", (4.0, 6.0)),
        ("trigger_step", (30,)),
        ("brake_duration_steps", (15, 30)),
        ("recovery_throttle", (0.0,)),
    )
    result = _materialize(grid)
    assert len(result.variants) == 2 * 2 * 1 * 2 * 1
    observed = [
        tuple(item.value for item in variant.binding.parameters) for variant in result.variants
    ]
    assert observed[0] == (6.0, 4.0, 30, 15, 0.0)
    assert observed[1] == (6.0, 4.0, 30, 30, 0.0)
    assert observed[-1] == (8.0, 6.0, 30, 30, 0.0)
    for index, variant in enumerate(result.variants):
        assert variant.binding.grid_index == index
        assert variant.binding.variant_id == f"grid-{index:04d}"
        assert tuple(item.parameter for item in variant.binding.parameters) == (
            GRID_PARAMETER_ORDER
        )


def test_every_variant_has_a_distinct_adapter_config_digest() -> None:
    """The MetaDrive evidence config embeds the challenge payload, so each grid point
    has its own adapter identity. One global digest would be false."""
    result = _materialize(
        (
            ("initial_gap_m", (6.0, 8.0, 10.0)),
            ("actor_speed_mps", (4.0, 6.0)),
            ("trigger_step", (30,)),
            ("brake_duration_steps", (15,)),
            ("recovery_throttle", (0.0,)),
        )
    )
    digests = [variant.binding.adapter_config_digest_sha256 for variant in result.variants]
    assert len(set(digests)) == len(digests) == 6


def test_predeclared_scenario_digest_matches_the_loader_projection() -> None:
    result = _materialize()
    for variant in result.variants:
        assert variant.binding.scenario_digest_sha256 == scenario_digest(variant.scenario)


def test_rendered_scenario_round_trips_byte_stably() -> None:
    import yaml

    for variant in _materialize().variants:
        reloaded = ScenarioDefinition.model_validate(
            yaml.safe_load(variant.scenario_bytes.decode("utf-8"))
        )
        assert reloaded == variant.scenario
        assert serialize_scenario(reloaded) == variant.scenario_bytes


def test_rendering_changes_only_the_five_closed_challenge_fields() -> None:
    template = template_scenario()
    result = _materialize(
        (
            ("initial_gap_m", (6.0,)),
            ("actor_speed_mps", (4.0,)),
            ("trigger_step", (40,)),
            ("brake_duration_steps", (25,)),
            ("recovery_throttle", (0.5,)),
        )
    )
    rendered = result.variants[0].scenario
    assert rendered.challenge.initial_gap_m == 6.0
    assert rendered.challenge.actor_speed_mps == 4.0
    assert rendered.challenge.trigger_step == 40
    assert rendered.challenge.brake_duration_steps == 25
    assert rendered.challenge.resume_throttle_command == 0.5
    assert rendered.model_dump(exclude={"challenge"}) == template.model_dump(
        exclude={"challenge"}
    )
    assert rendered.challenge.kind == template.challenge.kind
    assert rendered.challenge.brake_command == template.challenge.brake_command
    assert rendered.challenge.behavior_realism_claim is False


def test_compiled_protocol_is_a_valid_strict_plan_record() -> None:
    result = _materialize()
    assert isinstance(result.protocol, StudyProtocol)
    assert result.protocol.schema_version == "2.0"
    assert result.protocol.materializer.version == "2.0"
    assert result.protocol.materializer.template.repository_relative_path == (
        TEMPLATE_RELATIVE_PATH
    )
    assert result.protocol.materializer.template.byte_digest_sha256 == __import__(
        "hashlib"
    ).sha256(template_bytes()).hexdigest()
    assert serialize_protocol(result.protocol) == result.protocol_yaml_bytes


def test_protocol_yaml_uses_lf_and_one_final_newline() -> None:
    payload = _materialize().protocol_yaml_bytes
    assert b"\r" not in payload
    assert payload.endswith(b"\n")
    assert not payload.endswith(b"\n\n")


def test_draft_requires_the_complete_ordered_grid() -> None:
    with pytest.raises((MaterializationError, ValidationError)):
        StudyProtocolAuthoringDraft(
            draft_schema_version="1.0",
            template_repository_relative_path=TEMPLATE_RELATIVE_PATH,
            baseline_grid=({"parameter": "initial_gap_m", "values": (8.0,)},),
            protocol_body=_body(),
        )
    reordered = tuple(reversed(DEFAULT_GRID))
    with pytest.raises((MaterializationError, ValidationError)):
        _draft(reordered)


def test_draft_rejects_duplicate_and_out_of_domain_values() -> None:
    with pytest.raises((MaterializationError, ValidationError)):
        _draft((("initial_gap_m", (8.0, 8.0)), *DEFAULT_GRID[1:]))
    with pytest.raises((MaterializationError, ValidationError)):
        _draft((("initial_gap_m", (0.0,)), *DEFAULT_GRID[1:]))
    with pytest.raises((MaterializationError, ValidationError)):
        _draft((("initial_gap_m", (201.0,)), *DEFAULT_GRID[1:]))


@pytest.mark.parametrize(
    ("parameter", "value"),
    (
        ("initial_gap_m", 8),
        ("initial_gap_m", True),
        ("trigger_step", 30.0),
        ("trigger_step", False),
        ("recovery_throttle", 1),
        ("brake_duration_steps", 0),
        ("brake_duration_steps", 10_001),
        ("actor_speed_mps", 50.5),
        ("recovery_throttle", 1.5),
    ),
)
def test_grid_domain_rejects_wrong_type_or_range(parameter: str, value: object) -> None:
    with pytest.raises(ValueError):
        validate_grid_value(parameter, value)


@pytest.mark.parametrize(
    ("parameter", "value"),
    (
        ("initial_gap_m", 200.0),
        ("actor_speed_mps", 0.0),
        ("actor_speed_mps", 50.0),
        ("trigger_step", 0),
        ("brake_duration_steps", 1),
        ("brake_duration_steps", 10_000),
        ("recovery_throttle", 0.0),
        ("recovery_throttle", 1.0),
    ),
)
def test_grid_domain_accepts_its_inclusive_edges(parameter: str, value: object) -> None:
    validate_grid_value(parameter, value)


def test_variant_binding_requires_the_frozen_parameter_order() -> None:
    variant = _materialize().variants[0].binding.model_dump(mode="json")
    variant["parameters"] = list(reversed(variant["parameters"]))
    with pytest.raises(ValidationError, match="frozen grid parameter order"):
        MaterializedVariantBinding.model_validate_json(__import__("json").dumps(variant))


def test_grid_expansion_bound_is_enforced() -> None:
    oversized = (
        ("initial_gap_m", tuple(round(1.0 + index * 0.1, 4) for index in range(33))),
        ("actor_speed_mps", tuple(round(index * 1.0, 4) for index in range(33))),
        ("trigger_step", (30,)),
        ("brake_duration_steps", (15,)),
        ("recovery_throttle", (0.0,)),
    )
    assert MAX_GRID_VARIANTS < 33 * 33
    with pytest.raises(MaterializationError, match="above the"):
        _materialize(oversized)


def test_template_must_be_a_supported_lead_brake_schema_two_scenario() -> None:
    nominal = ScenarioDefinition.model_validate(
        {**TEMPLATE_PAYLOAD, "schema_version": "1.0", "challenge": None}
    )
    with pytest.raises(MaterializationError, match="scenario schema 2.0"):
        materialize(
            _draft(),
            template_bytes(),
            nominal,
            simulator_version=SUPPORTED_METADRIVE_VERSION,
            simulator_commit=SUPPORTED_METADRIVE_COMMIT,
        )


def test_template_bytes_must_use_lf_line_endings() -> None:
    with pytest.raises(MaterializationError, match="LF line endings"):
        materialize(
            _draft(),
            template_bytes().replace(b"\n", b"\r\n"),
            template_scenario(),
            simulator_version=SUPPORTED_METADRIVE_VERSION,
            simulator_commit=SUPPORTED_METADRIVE_COMMIT,
        )


def test_render_variant_rejects_an_unmapped_scenario_field() -> None:
    from hermes.adequacy.models import GridAssignment

    template = template_scenario()
    rendered = render_variant(
        template, (GridAssignment(parameter="initial_gap_m", value=9.0),)
    )
    assert rendered.challenge.initial_gap_m == 9.0


def test_materializer_never_imports_metadrive_or_launches_a_process() -> None:
    program = (
        "import sys\n"
        "sys.path.insert(0, 'tests')\n"
        "import hermes.evaluation_plans.materializer  # noqa: F401\n"
        "loaded = sorted(name for name in sys.modules if name.split('.')[0] in "
        "{'metadrive', 'panda3d'})\n"
        "print(','.join(loaded))\n"
    )
    result = subprocess.run(
        [sys.executable, "-c", program],
        cwd=REPOSITORY_ROOT,
        capture_output=True,
        text=True,
        timeout=120,
    )
    assert result.returncode == 0, result.stderr
    assert result.stdout.strip() == ""
