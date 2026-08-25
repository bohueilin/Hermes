"""Phase 1 shield that permits every validated candidate unchanged."""

from hermes.domain.models import Action, JsonValue, Observation, ScenarioDefinition


class NoOpShield:
    name = "noop"
    version = "1.0"

    @property
    def evidence_config(self) -> dict[str, JsonValue]:
        return {}

    def reset(self, scenario: ScenarioDefinition, seed: int) -> None:
        del scenario, seed

    def apply(self, observation: Observation, candidate: Action) -> tuple[Action, tuple[str, ...]]:
        del observation
        return candidate, ()
