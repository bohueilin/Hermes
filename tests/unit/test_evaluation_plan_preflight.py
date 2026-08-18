"""The frozen-vs-installed simulator identity gate that protects the append-only ledger."""

from __future__ import annotations

import importlib.util
import json
import sys
from pathlib import Path
from typing import Any

import pytest

from hermes.adequacy.models import StudyProtocol
from hermes.evaluation_plans.preflight import (
    ResolvedSimulatorIdentity,
    SimulatorIdentityMismatchError,
    require_frozen_simulator_identity,
    resolve_installed_simulator_identity,
)
from hermes.simulator_support import (
    SUPPORTED_METADRIVE_COMMIT,
    SUPPORTED_METADRIVE_VERSION,
)

REPOSITORY_ROOT = Path(__file__).resolve().parents[2]


def _protocol() -> StudyProtocol:
    spec = importlib.util.spec_from_file_location(
        "_preflight_fixtures", REPOSITORY_ROOT / "tests" / "unit" / "test_adequacy_loader.py"
    )
    assert spec is not None and spec.loader is not None
    module = importlib.util.module_from_spec(spec)
    sys.modules.setdefault("_preflight_fixtures", module)
    spec.loader.exec_module(module)
    return StudyProtocol.model_validate_json(json.dumps(module._protocol_payload()))


def _resolver(version: str, commit: str, name: str = "metadrive") -> Any:
    def resolve(repository_root: Path) -> ResolvedSimulatorIdentity:
        del repository_root
        return ResolvedSimulatorIdentity(name=name, version=version, commit=commit)

    return resolve


def test_matching_installed_identity_passes_and_is_returned() -> None:
    protocol = _protocol()
    identity = require_frozen_simulator_identity(
        protocol,
        REPOSITORY_ROOT,
        resolver=_resolver(SUPPORTED_METADRIVE_VERSION, SUPPORTED_METADRIVE_COMMIT),
    )
    assert identity.version == SUPPORTED_METADRIVE_VERSION
    assert identity.commit == SUPPORTED_METADRIVE_COMMIT


@pytest.mark.parametrize(
    ("version", "commit", "name", "expected"),
    (
        ("0.4.4", SUPPORTED_METADRIVE_COMMIT, "metadrive", "version"),
        (SUPPORTED_METADRIVE_VERSION, "f" * 40, "metadrive", "commit"),
        (SUPPORTED_METADRIVE_VERSION, SUPPORTED_METADRIVE_COMMIT, "carla", "name"),
    ),
)
def test_drifted_installed_identity_fails_closed(
    version: str, commit: str, name: str, expected: str
) -> None:
    protocol = _protocol()
    with pytest.raises(SimulatorIdentityMismatchError) as error:
        require_frozen_simulator_identity(
            protocol, REPOSITORY_ROOT, resolver=_resolver(version, commit, name)
        )
    message = str(error.value)
    assert expected in message
    assert "every predeclared adapter-config digest would be wrong" in message


def test_unsupported_resolver_result_fails_closed() -> None:
    protocol = _protocol()
    with pytest.raises(SimulatorIdentityMismatchError, match="unsupported value"):
        require_frozen_simulator_identity(
            protocol, REPOSITORY_ROOT, resolver=lambda root: "0.4.3"
        )


def test_unavailable_simulator_is_a_typed_preflight_failure(monkeypatch: Any) -> None:
    def explode(repository_root: Path) -> ResolvedSimulatorIdentity:
        raise SimulatorIdentityMismatchError("installed simulator identity is unavailable: x")

    protocol = _protocol()
    with pytest.raises(SimulatorIdentityMismatchError, match="unavailable"):
        require_frozen_simulator_identity(protocol, REPOSITORY_ROOT, resolver=explode)


@pytest.mark.metadrive
def test_real_installed_identity_matches_the_repository_pin() -> None:
    identity = resolve_installed_simulator_identity(REPOSITORY_ROOT)
    assert identity.name == "metadrive"
    assert identity.version == SUPPORTED_METADRIVE_VERSION
    assert identity.commit == SUPPORTED_METADRIVE_COMMIT
    assert identity.commit == (
        (REPOSITORY_ROOT / "SIMULATOR_COMMIT").read_text(encoding="utf-8").strip()
    )
