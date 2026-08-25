"""The ADAS longitudinal stack, exposed as an ordinary ``DrivingPolicy``.

Phase 8 deliberately does not introduce a parallel controller contract. An ADAS function is
a policy: it proposes an action, the environment executes it, verifiers evaluate the stored
trace, and the gate decides. Everything below is state that lives inside one policy.

Command arbitration (PRD §0-A.2.4) is fixed priority:

    AEB EMERGENCY_BRAKE  >  AEB PARTIAL_BRAKE  >  driver / ACC longitudinal

Brake always wins over throttle. The fused command is projected onto ``Action``, whose
invariant forbids simultaneous throttle and brake - that invariant is a hard pydantic
failure rather than a clamp, so the projection happens here explicitly rather than being
left to chance.
"""

from __future__ import annotations

from hermes.adas.decision import AdasLongitudinalDecisionKernel
from hermes.adas.decision import project_to_action as project_to_action
from hermes.adas.interfaces import (
    AdasControllerConfig,
    AdasDecision,
    AdasDecisionEvidence,
    AdasObservation,
)
from hermes.domain.models import Action, JsonValue, Observation, ScenarioDefinition


class AdasLongitudinalPolicy:
    """FCW + AEB over a scripted longitudinal driver.

    Implements the existing ``DrivingPolicy`` protocol: ``name``, ``version``,
    ``evidence_config``, ``simulated_latency_ms``, ``reset(scenario, seed)`` and
    ``act(observation)``.
    """

    name = "adas-longitudinal"
    version = "1.0"

    def __init__(self, config: AdasControllerConfig | None = None) -> None:
        self._config = config or AdasControllerConfig()
        self._kernel = AdasLongitudinalDecisionKernel(self._config)
        self._latency_ms = 10.0
        self._last_decision: AdasDecision | None = None
        self._last_decision_evidence: AdasDecisionEvidence | None = None

    @property
    def evidence_config(self) -> dict[str, JsonValue]:
        """The digest-bound controller configuration.

        This is what ``policy_config_digest`` binds, and therefore what a baseline and a
        candidate are permitted to differ in under the declared variation axis.

        The scenario-owned values every policy reports - the tracked speed and the simulated
        latency - are included alongside the controller tunables, matching the existing
        policies. Stored-evidence verification reads ``simulated_policy_latency_ms`` from
        here and cross-checks it against every trace event's recorded latency.
        """
        return {
            **self._config.model_dump(mode="json"),
            "target_speed_mps": self._kernel.target_speed_mps,
            "simulated_policy_latency_ms": self._latency_ms,
        }

    @property
    def simulated_latency_ms(self) -> float:
        return self._latency_ms

    @property
    def last_decision(self) -> AdasDecision | None:
        """The most recent decision, for trace-event evidence."""
        return self._last_decision

    @property
    def last_decision_evidence(self) -> AdasDecisionEvidence | None:
        """The most recent decision bound to the exact delivered policy input."""
        return self._last_decision_evidence

    @property
    def controller_config(self) -> AdasControllerConfig:
        return self._config

    def reset(self, scenario: ScenarioDefinition, seed: int) -> None:
        del seed  # the controller is deterministic and draws no randomness
        self._latency_ms = scenario.control.simulated_policy_latency_ms
        self._kernel.reset(scenario)
        self._last_decision = None
        self._last_decision_evidence = None

    def decide(self, observation: AdasObservation) -> AdasDecision:
        """Run the enabled functions and arbitrate, without touching policy plumbing."""
        decision = self._kernel.decide(observation)
        self._last_decision_evidence = AdasDecisionEvidence(
            input_sequence=observation.sequence,
            input_time_s=observation.simulation_time_s,
            decision=decision,
        )
        self._last_decision = decision
        return decision

    def act(self, observation: Observation) -> Action:
        action, evidence = self._kernel.step(observation)
        self._last_decision_evidence = evidence
        self._last_decision = evidence.decision
        return action
