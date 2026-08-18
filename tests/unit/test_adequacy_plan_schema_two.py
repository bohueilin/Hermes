"""Schema-2.0 plan-record identity: digest scope and per-variant cross-record binding."""

from __future__ import annotations

import importlib.util
import json
import sys
from pathlib import Path
from typing import Any

import pytest
from pydantic import ValidationError

from hermes.adequacy.loader import InvalidPlanError, capture_evaluation_plans
from hermes.adequacy.models import ComponentExpectation, StudyProtocol

REPOSITORY_ROOT = Path(__file__).resolve().parents[2]
_DIGEST = "a" * 64
_COMMIT = "b" * 40


def _mutate_pair_on_disk(path: Path, field: str, value: str) -> None:
    """Change one frozen pair-plan identity after the plan set is already written."""
    import yaml

    payload = yaml.safe_load(path.read_text(encoding="utf-8"))
    payload["expected_pair"][field] = value
    path.write_text(
        yaml.safe_dump(payload, allow_unicode=True, sort_keys=False), encoding="utf-8"
    )


def _loader_fixtures() -> Any:
    spec = importlib.util.spec_from_file_location(
        "_plan_loader_fixtures", REPOSITORY_ROOT / "tests" / "unit" / "test_adequacy_loader.py"
    )
    assert spec is not None and spec.loader is not None
    module = importlib.util.module_from_spec(spec)
    sys.modules.setdefault("_plan_loader_fixtures", module)
    spec.loader.exec_module(module)
    return module


@pytest.mark.parametrize(
    ("component", "scope"),
    (
        ("POLICY", "MATERIALIZED_VARIANT"),
        ("POLICY", "NOT_APPLICABLE"),
        ("GATE", "MATERIALIZED_VARIANT"),
        ("ADAPTER", "FIXED"),
        ("ADAPTER", "NOT_APPLICABLE"),
        ("SIMULATOR", "FIXED"),
        ("SIMULATOR", "MATERIALIZED_VARIANT"),
    ),
)
def test_component_rejects_a_digest_scope_it_does_not_own(component: str, scope: str) -> None:
    with pytest.raises(ValidationError, match="config_digest_scope"):
        ComponentExpectation(
            component=component,
            name="x",
            version="1.0",
            config_digest_scope=scope,
            config_digest_sha256=_DIGEST if scope == "FIXED" else None,
            source_commit=_COMMIT if scope == "NOT_APPLICABLE" else None,
        )


def test_adapter_scope_rejects_a_global_config_digest() -> None:
    with pytest.raises(ValidationError, match="rejects a global config digest"):
        ComponentExpectation(
            component="ADAPTER",
            name="metadrive",
            version="1.1",
            config_digest_scope="MATERIALIZED_VARIANT",
            config_digest_sha256=_DIGEST,
            source_commit=None,
        )


def test_simulator_scope_requires_a_source_commit() -> None:
    with pytest.raises(ValidationError, match="requires source_commit"):
        ComponentExpectation(
            component="SIMULATOR",
            name="metadrive",
            version="0.4.3",
            config_digest_scope="NOT_APPLICABLE",
            config_digest_sha256=None,
            source_commit=None,
        )


def test_protocol_requires_variants_to_exhaust_the_declared_grid() -> None:
    fixtures = _loader_fixtures()
    payload = fixtures._protocol_payload()
    payload["materializer"]["variants"] = payload["materializer"]["variants"][:0] or [
        payload["materializer"]["variants"][0]
    ]
    payload["baseline_grid"][0]["values"] = [8.0, 9.0]
    with pytest.raises(ValidationError, match="exhaust the declared Cartesian grid"):
        StudyProtocol.model_validate_json(json.dumps(payload))


def test_protocol_rejects_a_variant_whose_braking_window_overruns_the_horizon() -> None:
    fixtures = _loader_fixtures()
    payload = fixtures._protocol_payload()
    payload["planned_execution"]["horizon_steps"] = 40
    with pytest.raises(ValidationError, match="braking window"):
        StudyProtocol.model_validate_json(json.dumps(payload))


@pytest.mark.parametrize(
    "field",
    (
        "materialized_variant_id",
        "adapter_config_digest_sha256",
        "scenario_byte_digest_sha256",
        "scenario_digest_sha256",
    ),
)
def test_ledger_entry_must_bind_its_predeclared_variant(tmp_path: Path, field: str) -> None:
    fixtures = _loader_fixtures()
    selections = fixtures._write_valid_plans(tmp_path)
    protocol, ledger, pair = fixtures._load_plan_payloads(tmp_path, selections)
    ledger[0][field] = "c" * (40 if field == "materialized_variant_id" else 64)
    if field == "materialized_variant_id":
        ledger[0][field] = "grid-9999"
    fixtures._write_plan_payloads(tmp_path, selections, protocol, ledger, pair)
    with pytest.raises(InvalidPlanError, match="predeclared materialized variant"):
        capture_evaluation_plans(tmp_path, *selections)


def test_pair_plan_cannot_select_an_undeclared_variant(tmp_path: Path) -> None:
    fixtures = _loader_fixtures()
    selections = fixtures._write_valid_plans(tmp_path)
    _mutate_pair_on_disk(
        tmp_path / selections[2], "selected_materialized_variant_id", "grid-4242"
    )
    with pytest.raises(InvalidPlanError, match="undeclared materialized variant"):
        capture_evaluation_plans(tmp_path, *selections)


@pytest.mark.parametrize(
    "field", ("scenario_byte_digest_sha256", "adapter_config_digest_sha256")
)
def test_pair_plan_selected_identity_must_match_the_variant(
    tmp_path: Path, field: str
) -> None:
    fixtures = _loader_fixtures()
    selections = fixtures._write_valid_plans(tmp_path)
    _mutate_pair_on_disk(tmp_path / selections[2], field, "d" * 64)
    with pytest.raises(InvalidPlanError, match="contradicts"):
        capture_evaluation_plans(tmp_path, *selections)


def test_valid_schema_two_plans_capture_cleanly(tmp_path: Path) -> None:
    fixtures = _loader_fixtures()
    selections = fixtures._write_valid_plans(tmp_path)
    result = capture_evaluation_plans(tmp_path, *selections)
    assert result.protocol.schema_version == "2.0"
    assert result.protocol.materializer.version == "2.0"
    assert result.pair_plan.schema_version == "2.0"
    assert all(entry.schema_version == "2.0" for entry in result.ledger)
    selected = result.pair_plan.expected_pair.selected_materialized_variant_id
    assert result.protocol.materializer.variant_by_id(selected) is not None
    assert result.protocol.expected_components.adapter.config_digest_scope == (
        "MATERIALIZED_VARIANT"
    )
    assert result.protocol.expected_components.adapter.config_digest_sha256 is None
