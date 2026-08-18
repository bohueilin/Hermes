"""Shared schema-2.0 Phase 7 plan fixtures built through the real materializer.

Tests use these helpers so every fixture carries a genuine predeclared variant
table: real rendered scenario bytes, real scenario digests, and real per-variant
adapter-config digests. Hand-written digests would let a fixture drift away from
what the loader actually enforces.
"""

from __future__ import annotations

import hashlib
from typing import Any

from hermes.adapters.metadrive_config import ADAPTER_EVIDENCE_CONFIG_PROJECTION
from hermes.domain.models import ScenarioDefinition
from hermes.evaluation_plans.materializer import (
    MATERIALIZER_ALGORITHM,
    MATERIALIZER_VERSION,
    OUTPUT_SERIALIZATION,
    PROTOCOL_SERIALIZATION,
    StudyProtocolAuthoringDraft,
    materialize,
    serialize_scenario,
)
from hermes.simulator_support import (
    SUPPORTED_METADRIVE_COMMIT,
    SUPPORTED_METADRIVE_VERSION,
)

TEMPLATE_RELATIVE_PATH = "evaluation-plans/templates/lead_ttc_engagement.template.yaml"

TEMPLATE_PAYLOAD: dict[str, Any] = {
    "schema_version": "2.0",
    "name": "lead_ttc_engagement_template",
    "version": "1.0",
    "description": "Illustrative simulation-only lead-brake template for declared-question search.",
    "adapter": "metadrive",
    "control": {"frequency_hz": 10, "horizon_steps": 300, "target_speed_mps": 8.0},
    "initial_state": {"speed_mps": 0.0, "lateral_offset_m": 0.0},
    "road": {"destination_distance_m": 20.0, "boundary_tolerance_m": 1.5},
    "hazards": {},
    "challenge": {
        "kind": "lead_vehicle_hard_brake",
        "actor_control_mode": "metadrive_dynamic_action",
        "behavior_realism_claim": False,
        "initial_gap_m": 10.0,
        "actor_speed_mps": 8.0,
        "trigger_step": 30,
        "brake_duration_steps": 15,
        "brake_command": -1.0,
        "resume_throttle_command": 0.0,
    },
}

DEFAULT_GRID: tuple[tuple[str, tuple[Any, ...]], ...] = (
    ("initial_gap_m", (8.0,)),
    ("actor_speed_mps", (8.0,)),
    ("trigger_step", (30,)),
    ("brake_duration_steps", (15,)),
    ("recovery_throttle", (0.0,)),
)


def template_scenario() -> ScenarioDefinition:
    return ScenarioDefinition.model_validate(TEMPLATE_PAYLOAD)


def template_bytes() -> bytes:
    return serialize_scenario(template_scenario())


def materializer_payload(
    protocol_body: dict[str, Any],
    grid: tuple[tuple[str, tuple[Any, ...]], ...] = DEFAULT_GRID,
) -> dict[str, Any]:
    """Return the frozen materializer block plus baseline grid for one protocol body."""
    draft = StudyProtocolAuthoringDraft(
        draft_schema_version="1.0",
        template_repository_relative_path=TEMPLATE_RELATIVE_PATH,
        baseline_grid=tuple(
            {"parameter": parameter, "values": values} for parameter, values in grid
        ),
        protocol_body=protocol_body,
    )
    result = materialize(
        draft,
        template_bytes(),
        template_scenario(),
        simulator_version=SUPPORTED_METADRIVE_VERSION,
        simulator_commit=SUPPORTED_METADRIVE_COMMIT,
    )
    return result.protocol.model_dump(mode="json")


def upgrade_protocol_payload(
    payload: dict[str, Any],
    grid: tuple[tuple[str, tuple[Any, ...]], ...] = DEFAULT_GRID,
) -> dict[str, Any]:
    """Return one schema-1.0-shaped protocol payload upgraded to a valid schema 2.0."""
    body = {
        key: value
        for key, value in payload.items()
        if key not in {"schema_version", "baseline_grid", "materializer"}
    }
    upgraded = materializer_payload(body, grid)
    return upgraded


def variant_bindings(payload: dict[str, Any]) -> list[dict[str, Any]]:
    materializer = payload["materializer"]
    assert isinstance(materializer, dict)
    return list(materializer["variants"])


def component_scope(component: str) -> str:
    return {
        "POLICY": "FIXED",
        "GATE": "FIXED",
        "ADAPTER": "MATERIALIZED_VARIANT",
        "SIMULATOR": "NOT_APPLICABLE",
    }[component]


def frozen_materializer_constants() -> dict[str, str]:
    return {
        "version": MATERIALIZER_VERSION,
        "algorithm": MATERIALIZER_ALGORITHM,
        "output_serialization": OUTPUT_SERIALIZATION,
        "protocol_serialization": PROTOCOL_SERIALIZATION,
        "adapter_config_projection": ADAPTER_EVIDENCE_CONFIG_PROJECTION,
    }


def sha256_hex_of(payload: bytes) -> str:
    return hashlib.sha256(payload).hexdigest()


def grid_for_count(count: int) -> tuple[tuple[str, tuple[Any, ...]], ...]:
    """Return a singleton-plus-one grid whose Cartesian product is exactly ``count``."""
    if count < 1:
        raise ValueError("count must be positive")
    gaps = tuple(round(1.0 + index * 0.1, 4) for index in range(count))
    return (
        ("initial_gap_m", gaps),
        ("actor_speed_mps", (8.0,)),
        ("trigger_step", (30,)),
        ("brake_duration_steps", (15,)),
        ("recovery_throttle", (0.0,)),
    )


def recompiled_payload(
    protocol_payload: dict[str, Any],
    grid: tuple[tuple[str, tuple[Any, ...]], ...],
) -> dict[str, Any]:
    """Recompile one already-upgraded protocol payload against a different grid."""
    return upgrade_protocol_payload(protocol_payload, grid)


def rebind_entry_to_variant(entry: dict[str, Any], variant: dict[str, Any]) -> dict[str, Any]:
    """Point one ledger entry at its predeclared variant identity."""
    entry["materialized_variant_id"] = variant["variant_id"]
    entry["adapter_config_digest_sha256"] = variant["adapter_config_digest_sha256"]
    entry["scenario_byte_digest_sha256"] = variant["scenario_byte_digest_sha256"]
    entry["scenario_digest_sha256"] = variant["scenario_digest_sha256"]
    entry["parameters"] = [dict(item) for item in variant["parameters"]]
    return entry
