"""Frozen-vs-installed simulator identity preflight for Phase 7 evidence generation.

Every predeclared per-variant adapter-config digest is computed from the simulator
version and commit frozen into the protocol. A real run records the *installed*
identity instead. If the installed pin has drifted, every variant's recorded digest
would contradict its predeclared value.

That failure must not be discovered one attempt at a time. The discovery ledger is
append-only and its failed attempts may never be deleted, so an environment drift
would otherwise burn the whole grid into immutable evidence and force a new protocol
version for a reason that has nothing to do with the declared question.

This preflight therefore runs once before the first discovery attempt, and again
immediately before each primary run, and fails as a typed operational error that
writes no ledger entry.
"""

from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path

from hermes.adequacy.models import StudyProtocol


class SimulatorIdentityMismatchError(RuntimeError):
    """The installed simulator identity contradicts the frozen protocol expectation."""


@dataclass(frozen=True, slots=True)
class ResolvedSimulatorIdentity:
    """The simulator identity a run would actually record right now."""

    name: str
    version: str
    commit: str


def resolve_installed_simulator_identity(repository_root: Path) -> ResolvedSimulatorIdentity:
    """Resolve the installed MetaDrive identity through the normal runtime path."""
    # Imported lazily: this module must stay importable, and usable for the
    # non-simulator half of a preflight, without a MetaDrive installation present.
    from hermes.adapters.metadrive import (
        MetaDriveUnavailableError,
        _load_dependencies,
    )

    try:
        dependencies = _load_dependencies(repository_root)
    except MetaDriveUnavailableError as exc:
        raise SimulatorIdentityMismatchError(
            f"installed simulator identity is unavailable: {exc}"
        ) from exc
    return ResolvedSimulatorIdentity(
        name="metadrive",
        version=dependencies.simulator_version,
        commit=dependencies.simulator_commit,
    )


def require_frozen_simulator_identity(
    protocol: StudyProtocol,
    repository_root: Path,
    *,
    resolver: object | None = None,
) -> ResolvedSimulatorIdentity:
    """Fail closed unless the installed simulator matches the protocol expectation.

    Returns the resolved identity so a caller can record exactly what it verified.
    """
    expectation = protocol.expected_components.simulator
    resolve = resolver or resolve_installed_simulator_identity
    identity = resolve(repository_root)  # type: ignore[operator]
    if not isinstance(identity, ResolvedSimulatorIdentity):
        raise SimulatorIdentityMismatchError(
            "simulator identity resolver returned an unsupported value"
        )
    mismatches: list[str] = []
    if identity.name != expectation.name:
        mismatches.append(f"name: frozen={expectation.name!r}, installed={identity.name!r}")
    if identity.version != expectation.version:
        mismatches.append(
            f"version: frozen={expectation.version!r}, installed={identity.version!r}"
        )
    if identity.commit != expectation.source_commit:
        mismatches.append(
            f"commit: frozen={expectation.source_commit!r}, installed={identity.commit!r}"
        )
    if mismatches:
        raise SimulatorIdentityMismatchError(
            "installed simulator identity contradicts the frozen protocol expectation; "
            "every predeclared adapter-config digest would be wrong. "
            "Restore the pinned simulator or register a new protocol version. "
            + "; ".join(mismatches)
        )
    return identity
