"""Stable enum values used across adapters, evidence, verifiers, and gates."""

from enum import StrEnum


class Verdict(StrEnum):
    """Release-gate outcomes, ordered by explicit precedence elsewhere."""

    PASS = "PASS"
    CONDITIONAL = "CONDITIONAL"
    HOLD = "HOLD"
    INVALID_EVIDENCE = "INVALID_EVIDENCE"


class EvidenceAvailability(StrEnum):
    """Whether a signal was actually available for evaluation."""

    AVAILABLE = "AVAILABLE"
    NOT_AVAILABLE = "NOT_AVAILABLE"


class WarningLevel(StrEnum):
    """Forward-collision warning output bound into schema-3 evidence."""

    NO_WARNING = "NO_WARNING"
    ADVISORY = "ADVISORY"
    URGENT_WARNING = "URGENT_WARNING"


class InterventionLevel(StrEnum):
    """Automatic emergency braking output bound into schema-3 evidence."""

    NO_INTERVENTION = "NO_INTERVENTION"
    PARTIAL_BRAKE = "PARTIAL_BRAKE"
    EMERGENCY_BRAKE = "EMERGENCY_BRAKE"


class BrakeSource(StrEnum):
    """Typed origin of a candidate, permitted, or executed braking command."""

    NONE = "none"
    DRIVER = "driver"
    AEB = "aeb"
    ACC = "acc"
    SHIELD = "shield"


class AdasMode(StrEnum):
    """Supervisory mode of the simulated assistance stack."""

    OFF = "OFF"
    AVAILABLE = "AVAILABLE"
    ACTIVE = "ACTIVE"
    DEGRADED = "DEGRADED"


class FindingStatus(StrEnum):
    """Result of evaluating one independent requirement."""

    PASS = "PASS"
    FAIL = "FAIL"
    NOT_AVAILABLE = "NOT_AVAILABLE"


class Severity(StrEnum):
    """Finding consequence classification."""

    INFO = "INFO"
    WARNING = "WARNING"
    ERROR = "ERROR"
    CRITICAL = "CRITICAL"


class TerminationReason(StrEnum):
    """Why an adapter episode stopped."""

    NONE = "NONE"
    DESTINATION_REACHED = "DESTINATION_REACHED"
    COLLISION = "COLLISION"
    OFF_ROAD = "OFF_ROAD"
    HORIZON = "HORIZON"
    OPERATIONAL_ERROR = "OPERATIONAL_ERROR"


class IntegrityStatus(StrEnum):
    """Whether a stored bundle is internally self-consistent."""

    INTERNALLY_CONSISTENT = "INTERNALLY_CONSISTENT"
    INVALID = "INVALID"


class AuthenticityStatus(StrEnum):
    """Local hash chains do not provide an independent trust anchor."""

    NOT_AUTHENTICATED = "NOT_AUTHENTICATED"
