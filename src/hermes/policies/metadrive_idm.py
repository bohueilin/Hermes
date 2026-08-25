"""Hermes wrapper around the installed MetaDrive 0.4.3 IDMPolicy."""

from __future__ import annotations

from hermes.adapters.metadrive import MetaDriveAdapter
from hermes.domain.models import Action, JsonValue, Observation, ScenarioDefinition


class MetaDriveIDMPolicy:
    """Expose a native IDM proposal before Hermes shield and execution boundaries."""

    name = "metadrive-idm"
    version = "1.0"

    def __init__(self, adapter: MetaDriveAdapter) -> None:
        self._adapter = adapter
        self._scenario: ScenarioDefinition | None = None

    @property
    def evidence_config(self) -> dict[str, JsonValue]:
        if self._scenario is None:
            raise RuntimeError("MetaDrive IDM policy must be reset before evidence config")
        return {
            "backend": "metadrive.policy.idm_policy.IDMPolicy",
            "backend_version": self._adapter.simulator_version,
            "deceleration_enabled": True,
            "known_limitation": "upstream IDM internal fallback is not structurally surfaced",
            "lane_change_enabled": False,
            "output_clipping": "componentwise_bounds_then_ieee754_binary32",
            "simulated_policy_latency_ms": self._scenario.control.simulated_policy_latency_ms,
            "target_speed_km_h": self._scenario.control.target_speed_mps * 3.6,
            "target_speed_mps": self._scenario.control.target_speed_mps,
        }

    @property
    def simulated_latency_ms(self) -> float:
        if self._scenario is None:
            raise RuntimeError("MetaDrive IDM policy must be reset before latency is read")
        return self._scenario.control.simulated_policy_latency_ms

    def reset(self, scenario: ScenarioDefinition, seed: int) -> None:
        del seed
        if scenario.adapter != "metadrive":
            raise ValueError("MetaDrive IDM policy requires adapter: metadrive")
        self._scenario = scenario

    def act(self, observation: Observation) -> Action:
        del observation
        if self._scenario is None:
            raise RuntimeError("MetaDrive IDM policy must be reset before act")
        return self._adapter.propose_idm_action()
