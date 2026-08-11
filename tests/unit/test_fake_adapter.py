from __future__ import annotations

from pathlib import Path

import pytest

from hermes.adapters.fake import FakeSimulatorAdapter
from hermes.domain.enums import TerminationReason
from hermes.domain.models import Action
from hermes.scenarios.loader import load_scenario


def test_fake_adapter_is_deterministic_for_same_resolved_inputs(repository_root: Path) -> None:
    scenario = load_scenario(repository_root / "scenarios" / "fake_nominal.yaml")
    action = Action(steering=0.0, throttle=0.5, brake=0.0)

    histories = []
    for _ in range(2):
        adapter = FakeSimulatorAdapter()
        histories.append(
            [
                adapter.reset(scenario, seed=7),
                adapter.step(action).observation,
                adapter.step(action).observation,
            ]
        )
        adapter.close()

    assert histories[0] == histories[1]
    assert histories[0][2].vehicle_state.position_m == pytest.approx(0.045)


def test_fake_collision_and_boundary_hazards_are_observable(repository_root: Path) -> None:
    action = Action(steering=0.0, throttle=0.0, brake=0.0)
    expectations = [
        ("fake_collision.yaml", TerminationReason.COLLISION),
        ("fake_boundary.yaml", TerminationReason.OFF_ROAD),
    ]

    for filename, expected_reason in expectations:
        scenario = load_scenario(repository_root / "scenarios" / filename)
        adapter = FakeSimulatorAdapter()
        adapter.reset(scenario, seed=7)
        result = None
        for _ in range(13):
            result = adapter.step(action)
        assert result is not None
        assert result.terminated is True
        assert result.termination_reason is expected_reason
        adapter.close()


def test_fake_adapter_enforces_horizon_and_lifecycle(repository_root: Path) -> None:
    scenario = load_scenario(repository_root / "scenarios" / "fake_nominal.yaml")
    short = scenario.model_copy(
        update={"control": scenario.control.model_copy(update={"horizon_steps": 1})}
    )
    adapter = FakeSimulatorAdapter()

    with pytest.raises(RuntimeError, match="reset"):
        adapter.step(Action(steering=0.0, throttle=0.0, brake=0.0))
    adapter.reset(short, seed=7)
    result = adapter.step(Action(steering=0.0, throttle=0.0, brake=0.0))

    assert result.truncated is True
    assert result.termination_reason is TerminationReason.HORIZON
    adapter.close()
    adapter.close()
    with pytest.raises(RuntimeError, match="closed"):
        adapter.step(Action(steering=0.0, throttle=0.0, brake=0.0))


def test_fake_adapter_rejects_non_fake_scenario(repository_root: Path) -> None:
    scenario = load_scenario(repository_root / "scenarios" / "fake_nominal.yaml")
    metadrive_scenario = scenario.model_copy(update={"adapter": "metadrive"})

    with pytest.raises(ValueError, match="fake"):
        FakeSimulatorAdapter().reset(metadrive_scenario, seed=7)
