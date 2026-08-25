from __future__ import annotations

import pytest

from hermes.domain.models import FaultConfig
from hermes.faults.eligibility import (
    has_observation_faults,
    supports_metadrive_observation_faults,
)


def _faults(**mechanisms) -> FaultConfig:
    return FaultConfig.model_validate(
        {
            "schema_version": "1.0",
            "name": "eligibility_probe",
            "version": "1.0",
            "label": "illustrative_simulation_faults_not_real_vehicle_limits",
            **mechanisms,
        }
    )


@pytest.mark.parametrize(
    "mechanism",
    [
        {"observation_delay_steps": 1},
        {
            "frozen_observation_interval": {
                "start_step": 1,
                "duration_steps": 1,
            }
        },
        {"dropped_observation_steps": [1]},
        {"observation_noise": {"speed_mps_bound": 0.1}},
    ],
)
def test_each_observation_side_mechanism_requires_eligible_policy(mechanism) -> None:
    assert has_observation_faults(_faults(**mechanism)) is True


@pytest.mark.parametrize(
    "control_only",
    [
        {"control_delay_steps": 1},
        {"max_abs_steering": 0.5},
        {"max_brake": 0.5},
    ],
)
def test_control_side_mechanisms_are_not_observation_faults(control_only) -> None:
    assert has_observation_faults(_faults(**control_only)) is False


def test_no_fault_profile_has_no_observation_faults() -> None:
    assert has_observation_faults(None) is False


@pytest.mark.parametrize(
    ("name", "version", "supported"),
    [
        ("adas-longitudinal", "1.0", True),
        ("adas-longitudinal", "2.0", False),
        ("metadrive-idm", "1.0", False),
        ("arbitrary-custom-policy", "1.0", False),
    ],
)
def test_metadrive_observation_fault_policy_identity_is_exact(
    name: str,
    version: str,
    supported: bool,
) -> None:
    assert supports_metadrive_observation_faults(name, version) is supported
