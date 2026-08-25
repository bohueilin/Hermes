"""Shared fault-mechanism and policy-identity eligibility predicates."""

from __future__ import annotations

from hermes.domain.models import FaultConfig

_METADRIVE_OBSERVATION_FAULT_POLICY = ("adas-longitudinal", "1.0")


def has_observation_faults(config: FaultConfig | None) -> bool:
    """Whether a fault profile modifies, delays, freezes, or drops observations."""
    return config is not None and (
        config.observation_delay_steps > 0
        or config.frozen_observation_interval is not None
        or bool(config.dropped_observation_steps)
        or config.observation_noise is not None
    )


def supports_metadrive_observation_faults(policy_name: str, policy_version: str) -> bool:
    """Only the Hermes ADAS policy consumes the delivered observation truthfully."""
    return (policy_name, policy_version) == _METADRIVE_OBSERVATION_FAULT_POLICY


def metadrive_observation_fault_policy_error(
    policy_name: str,
    policy_version: str,
) -> str:
    """Return the shared live/stored rejection text for an ineligible identity."""
    return (
        "MetaDrive observation faults require policy adas-longitudinal 1.0; "
        f"{policy_name} {policy_version} would not truthfully affect the delivered "
        "observation"
    )
