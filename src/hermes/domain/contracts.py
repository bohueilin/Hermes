"""Runtime-checkable protocol boundaries for Hermes components."""

from __future__ import annotations

from typing import Protocol, runtime_checkable

from hermes.domain.models import Action, Finding, Observation, ScenarioDefinition, StepResult


@runtime_checkable
class SimulatorAdapter(Protocol):
    name: str
    version: str

    def reset(self, scenario: ScenarioDefinition, seed: int) -> Observation:
        """Start one bounded deterministic episode."""

    def step(self, action: Action) -> StepResult:
        """Execute one normalized action."""

    def close(self) -> None:
        """Release adapter resources on every path."""


@runtime_checkable
class DrivingPolicy(Protocol):
    name: str
    version: str

    @property
    def simulated_latency_ms(self) -> float:
        """Deterministic simulated latency metadata, never host wall-clock timing."""

    def reset(self, scenario: ScenarioDefinition, seed: int) -> None:
        """Reset policy-local state for a run."""

    def act(self, observation: Observation) -> Action:
        """Propose, but do not execute, an action."""


@runtime_checkable
class SafetyShield(Protocol):
    name: str
    version: str

    def reset(self, scenario: ScenarioDefinition, seed: int) -> None:
        """Reset shield-local state for a run."""

    def apply(self, observation: Observation, candidate: Action) -> tuple[Action, tuple[str, ...]]:
        """Return the permitted action and explicit override reasons."""


@runtime_checkable
class Verifier(Protocol):
    name: str
    version: str

    def verify(self, events: tuple[object, ...], scenario: ScenarioDefinition) -> Finding:
        """Evaluate immutable stored-domain evidence, never simulator internals."""
