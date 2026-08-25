"""Immutable review/comparison registry for evidence-schema-3 metric leaves.

The storage identifier, display grouping, typed accessor, and RFC 6901 locator are kept
separate on purpose.  In particular, dotted identifiers are never used as Python attributes
or JSON pointers.
"""

from __future__ import annotations

from dataclasses import dataclass
from types import MappingProxyType
from typing import Literal

from hermes.domain.models import RunMetricsV3

SCHEMA2_TOLERANCE_LABEL = "illustrative_prototype_tolerances_not_for_real_vehicle_use"

MetricValueKind = Literal["SCALAR", "COUNT", "BOOLEAN", "MEASUREMENT", "STRING_COUNT_MAP", "ENUM"]
MetricDirection = Literal["LOWER", "HIGHER", "FALSE_PREFERRED", "DESCRIPTIVE"]


@dataclass(frozen=True, slots=True)
class MetricLeafSpec:
    leaf_id: str
    display_id: str
    accessor: tuple[str, ...]
    json_pointer: str
    value_kind: MetricValueKind
    unit: str | None
    authoritative_view: str
    direction: MetricDirection
    abs_tol: float = 0.0
    rel_tol: float = 0.0
    tolerance_label: str = SCHEMA2_TOLERANCE_LABEL
    criticality: Literal["UNASSIGNED"] = "UNASSIGNED"
    gating: Literal[False] = False


def _leaf(
    leaf_id: str,
    *,
    display_id: str | None = None,
    kind: MetricValueKind,
    unit: str | None,
    view: str,
    direction: MetricDirection,
) -> MetricLeafSpec:
    accessor = tuple(leaf_id.split("."))
    return MetricLeafSpec(
        leaf_id=leaf_id,
        display_id=display_id or leaf_id,
        accessor=accessor,
        json_pointer="/" + "/".join(accessor),
        value_kind=kind,
        unit=unit,
        authoritative_view=view,
        direction=direction,
    )


SCHEMA2_METRIC_REGISTRY: tuple[MetricLeafSpec, ...] = (
    # The exact nineteen-leaf V2-compatible prefix.
    _leaf("event_count", kind="COUNT", unit="events", view="TRACE", direction="DESCRIPTIVE"),
    _leaf(
        "simulation_duration_s",
        kind="SCALAR",
        unit="s",
        view="EXECUTION_CLOCK",
        direction="DESCRIPTIVE",
    ),
    _leaf(
        "collision_count",
        display_id="collision.count",
        kind="COUNT",
        unit="collisions",
        view="RESULT_VIEW",
        direction="LOWER",
    ),
    _leaf(
        "max_abs_lateral_offset_m", kind="SCALAR", unit="m", view="RESULT_VIEW", direction="LOWER"
    ),
    _leaf("offroad_duration_s", kind="SCALAR", unit="s", view="RESULT_VIEW", direction="LOWER"),
    _leaf(
        "route_completion_pct", kind="MEASUREMENT", unit="%", view="RESULT_VIEW", direction="HIGHER"
    ),
    _leaf(
        "minimum_ttc_s",
        display_id="ttc.minimum_s",
        kind="MEASUREMENT",
        unit="s",
        view="RESULT_VIEW",
        direction="HIGHER",
    ),
    _leaf(
        "max_abs_acceleration_mps2",
        kind="MEASUREMENT",
        unit="m/s^2",
        view="RESULT_VIEW",
        direction="LOWER",
    ),
    _leaf(
        "max_abs_jerk_mps3", kind="MEASUREMENT", unit="m/s^3", view="RESULT_VIEW", direction="LOWER"
    ),
    _leaf(
        "p95_policy_latency_ms",
        kind="MEASUREMENT",
        unit="ms",
        view="POLICY_EXECUTION",
        direction="LOWER",
    ),
    _leaf(
        "shield_override_count",
        kind="COUNT",
        unit="overrides",
        view="SHIELD_EXECUTION",
        direction="DESCRIPTIVE",
    ),
    _leaf(
        "shield_override_reasons",
        kind="STRING_COUNT_MAP",
        unit="occurrences",
        view="SHIELD_EXECUTION",
        direction="DESCRIPTIVE",
    ),
    _leaf(
        "termination_reason", kind="ENUM", unit=None, view="RESULT_VIEW", direction="DESCRIPTIVE"
    ),
    _leaf(
        "fault_application_counts",
        kind="STRING_COUNT_MAP",
        unit="occurrences",
        view="FAULT_EXECUTION",
        direction="DESCRIPTIVE",
    ),
    _leaf(
        "max_observation_age_s",
        kind="MEASUREMENT",
        unit="s",
        view="DELIVERED_INPUT_VIEW",
        direction="LOWER",
    ),
    _leaf(
        "p95_control_latency_ms",
        display_id="system.control_latency_p95_ms",
        kind="MEASUREMENT",
        unit="ms",
        view="EXECUTED_ACTION_VIEW",
        direction="LOWER",
    ),
    _leaf(
        "control_fill_count",
        kind="COUNT",
        unit="events",
        view="FAULT_EXECUTION",
        direction="DESCRIPTIVE",
    ),
    _leaf(
        "steering_saturation_count",
        display_id="system.control_saturation_count",
        kind="COUNT",
        unit="events",
        view="EXECUTED_ACTION_VIEW",
        direction="LOWER",
    ),
    _leaf(
        "brake_saturation_count",
        display_id="system.control_saturation_count",
        kind="COUNT",
        unit="events",
        view="EXECUTED_ACTION_VIEW",
        direction="LOWER",
    ),
    # Eight new top-level leaves.
    _leaf(
        "collision_occurred",
        display_id="collision.occurred",
        kind="BOOLEAN",
        unit=None,
        view="RESULT_VIEW",
        direction="FALSE_PREFERRED",
    ),
    _leaf(
        "ttc_at_warning_s",
        display_id="ttc.at_warning_s",
        kind="MEASUREMENT",
        unit="s",
        view="DELIVERED_INPUT_VIEW",
        direction="DESCRIPTIVE",
    ),
    _leaf(
        "ttc_at_brake_onset_s",
        display_id="ttc.at_brake_onset_s",
        kind="MEASUREMENT",
        unit="s",
        view="DELIVERED_INPUT_VIEW",
        direction="DESCRIPTIVE",
    ),
    _leaf(
        "impact_residual_speed_mps",
        display_id="impact.residual_speed_mps",
        kind="MEASUREMENT",
        unit="m/s",
        view="RESULT_VIEW",
        direction="LOWER",
    ),
    _leaf(
        "minimum_lead_distance_m",
        display_id="distance.minimum_lead_m",
        kind="MEASUREMENT",
        unit="m",
        view="RESULT_VIEW",
        direction="HIGHER",
    ),
    _leaf(
        "p95_observation_age_s",
        display_id="system.observation_age_p95_s",
        kind="MEASUREMENT",
        unit="s",
        view="DELIVERED_INPUT_VIEW",
        direction="LOWER",
    ),
    _leaf(
        "sensor_invalid_count",
        display_id="system.sensor_invalid_count",
        kind="COUNT",
        unit="events",
        view="DELIVERED_INPUT_VIEW",
        direction="LOWER",
    ),
    _leaf(
        "runtime_error_count",
        display_id="system.runtime_error_count",
        kind="COUNT",
        unit="errors",
        view="RUNTIME",
        direction="LOWER",
    ),
    # Thirty-four leaves in the typed ADAS namespace.
    _leaf(
        "adas.fcw.warning_count",
        display_id="fcw.warning_count",
        kind="COUNT",
        unit="warnings",
        view="DELIVERED_INPUT_VIEW",
        direction="DESCRIPTIVE",
    ),
    _leaf(
        "adas.fcw.first_warning_time_s",
        display_id="fcw.first_warning_time_s",
        kind="MEASUREMENT",
        unit="s",
        view="INPUT_CLOCK",
        direction="DESCRIPTIVE",
    ),
    _leaf(
        "adas.fcw.false_warning_count",
        display_id="fcw.false_warning_count",
        kind="COUNT",
        unit="warnings",
        view="DELIVERED_INPUT_VIEW",
        direction="LOWER",
    ),
    _leaf(
        "adas.fcw.missed_warning",
        display_id="fcw.missed_warning",
        kind="BOOLEAN",
        unit=None,
        view="DELIVERED_INPUT_VIEW",
        direction="FALSE_PREFERRED",
    ),
    _leaf(
        "adas.fcw.warning_chatter_count",
        display_id="fcw.warning_chatter_count",
        kind="COUNT",
        unit="transitions",
        view="DELIVERED_INPUT_VIEW",
        direction="LOWER",
    ),
    _leaf(
        "adas.aeb.intervention_count",
        display_id="aeb.intervention_count",
        kind="COUNT",
        unit="interventions",
        view="EXECUTED_ACTION_VIEW",
        direction="DESCRIPTIVE",
    ),
    _leaf(
        "adas.aeb.first_intervention_time_s",
        display_id="aeb.first_intervention_time_s",
        kind="MEASUREMENT",
        unit="s",
        view="EXECUTION_CLOCK",
        direction="DESCRIPTIVE",
    ),
    _leaf(
        "adas.aeb.max_deceleration_mps2",
        display_id="aeb.max_deceleration_mps2",
        kind="MEASUREMENT",
        unit="m/s^2",
        view="RESULT_VIEW",
        direction="DESCRIPTIVE",
    ),
    _leaf(
        "adas.aeb.max_jerk_mps3",
        display_id="aeb.max_jerk_mps3",
        kind="MEASUREMENT",
        unit="m/s^3",
        view="RESULT_VIEW",
        direction="LOWER",
    ),
    _leaf(
        "adas.aeb.false_intervention_count",
        display_id="aeb.false_intervention_count",
        kind="COUNT",
        unit="interventions",
        view="EXECUTED_ACTION_VIEW",
        direction="LOWER",
    ),
    _leaf(
        "adas.aeb.missed_intervention",
        display_id="aeb.missed_intervention",
        kind="BOOLEAN",
        unit=None,
        view="EXECUTED_ACTION_VIEW",
        direction="FALSE_PREFERRED",
    ),
    _leaf(
        "adas.aeb.required_decel_at_onset_mps2",
        display_id="aeb.required_decel_at_onset_mps2",
        kind="MEASUREMENT",
        unit="m/s^2",
        view="DELIVERED_INPUT_VIEW",
        direction="DESCRIPTIVE",
    ),
    _leaf(
        "adas.acc.headway_target_s",
        display_id="acc.headway_target_s",
        kind="MEASUREMENT",
        unit="s",
        view="CONFIGURATION",
        direction="DESCRIPTIVE",
    ),
    _leaf(
        "adas.acc.headway_minimum_s",
        display_id="acc.headway_minimum_s",
        kind="MEASUREMENT",
        unit="s",
        view="RESULT_VIEW",
        direction="HIGHER",
    ),
    _leaf(
        "adas.acc.headway_mae_s",
        display_id="acc.headway_mae_s",
        kind="MEASUREMENT",
        unit="s",
        view="RESULT_VIEW",
        direction="LOWER",
    ),
    _leaf(
        "adas.acc.speed_error_mae_mps",
        display_id="acc.speed_error_mae_mps",
        kind="MEASUREMENT",
        unit="m/s",
        view="RESULT_VIEW",
        direction="LOWER",
    ),
    _leaf(
        "adas.acc.cut_in_recovery_s",
        display_id="acc.cut_in_recovery_s",
        kind="MEASUREMENT",
        unit="s",
        view="RESULT_VIEW",
        direction="LOWER",
    ),
    _leaf(
        "adas.acc.max_acceleration_mps2",
        display_id="acc.max_acceleration_mps2",
        kind="MEASUREMENT",
        unit="m/s^2",
        view="RESULT_VIEW",
        direction="LOWER",
    ),
    _leaf(
        "adas.acc.max_deceleration_mps2",
        display_id="acc.max_deceleration_mps2",
        kind="MEASUREMENT",
        unit="m/s^2",
        view="RESULT_VIEW",
        direction="LOWER",
    ),
    _leaf(
        "adas.acc.max_jerk_mps3",
        display_id="acc.max_jerk_mps3",
        kind="MEASUREMENT",
        unit="m/s^3",
        view="RESULT_VIEW",
        direction="LOWER",
    ),
    _leaf(
        "adas.lka.lateral_error_mae_m",
        display_id="lka.lateral_error_mae_m",
        kind="MEASUREMENT",
        unit="m",
        view="RESULT_VIEW",
        direction="LOWER",
    ),
    _leaf(
        "adas.lka.lateral_error_max_m",
        display_id="lka.lateral_error_max_m",
        kind="MEASUREMENT",
        unit="m",
        view="RESULT_VIEW",
        direction="LOWER",
    ),
    _leaf(
        "adas.lka.lane_crossing_count",
        display_id="lka.lane_crossing_count",
        kind="COUNT",
        unit="crossings",
        view="RESULT_VIEW",
        direction="LOWER",
    ),
    _leaf(
        "adas.lka.steering_oscillation_count",
        display_id="lka.steering_oscillation_count",
        kind="COUNT",
        unit="oscillations",
        view="EXECUTED_ACTION_VIEW",
        direction="LOWER",
    ),
    _leaf(
        "adas.lka.max_lateral_accel_mps2",
        display_id="lka.max_lateral_accel_mps2",
        kind="MEASUREMENT",
        unit="m/s^2",
        view="RESULT_VIEW",
        direction="LOWER",
    ),
    _leaf(
        "adas.lka.max_lateral_jerk_mps3",
        display_id="lka.max_lateral_jerk_mps3",
        kind="MEASUREMENT",
        unit="m/s^3",
        view="RESULT_VIEW",
        direction="LOWER",
    ),
    _leaf(
        "adas.lka.degraded_count",
        display_id="lka.degraded_count",
        kind="COUNT",
        unit="transitions",
        view="FUNCTION_STATE",
        direction="LOWER",
    ),
    _leaf(
        "adas.lka.curve_steady_state_error_m",
        display_id="lka.curve_steady_state_error_m",
        kind="MEASUREMENT",
        unit="m",
        view="RESULT_VIEW",
        direction="LOWER",
    ),
    _leaf(
        "adas.assist.mode_transition_count",
        display_id="assist.mode_transition_count",
        kind="COUNT",
        unit="transitions",
        view="FUNCTION_STATE",
        direction="DESCRIPTIVE",
    ),
    _leaf(
        "adas.assist.degraded_count",
        display_id="assist.degraded_count",
        kind="COUNT",
        unit="transitions",
        view="FUNCTION_STATE",
        direction="LOWER",
    ),
    _leaf(
        "adas.assist.takeover_request_count",
        display_id="assist.takeover_request_count",
        kind="COUNT",
        unit="requests",
        view="FUNCTION_STATE",
        direction="LOWER",
    ),
    _leaf(
        "adas.assist.disengagement_count",
        display_id="assist.disengagement_count",
        kind="COUNT",
        unit="transitions",
        view="FUNCTION_STATE",
        direction="LOWER",
    ),
    _leaf(
        "adas.assist.route_completion_pct",
        display_id="assist.route_completion",
        kind="MEASUREMENT",
        unit="%",
        view="RESULT_VIEW",
        direction="HIGHER",
    ),
    _leaf(
        "adas.assist.constraint_violation_count",
        display_id="assist.constraint_violation_count",
        kind="COUNT",
        unit="violations",
        view="FUNCTION_STATE",
        direction="LOWER",
    ),
)

SCHEMA2_METRIC_BY_ID = MappingProxyType({item.leaf_id: item for item in SCHEMA2_METRIC_REGISTRY})

_RAW_COUNT_LEAF_IDS = frozenset(
    {
        "event_count",
        "collision_count",
        "shield_override_count",
        "control_fill_count",
        "steering_saturation_count",
        "brake_saturation_count",
    }
)


def metric_leaf_uses_wrapper(spec: MetricLeafSpec) -> bool:
    """Whether the storage leaf retains value/availability/reason siblings."""

    return spec.value_kind in {"MEASUREMENT", "BOOLEAN"} or (
        spec.value_kind == "COUNT" and spec.leaf_id not in _RAW_COUNT_LEAF_IDS
    )


def metric_leaf_value(metrics: RunMetricsV3, spec: MetricLeafSpec) -> object:
    """Read one registered leaf through its exact typed accessor path."""

    current: object = metrics
    for token in spec.accessor:
        current = getattr(current, token)
    return current


def _validate_registry() -> None:
    if len(SCHEMA2_METRIC_REGISTRY) != 61 or len(SCHEMA2_METRIC_BY_ID) != 61:
        raise RuntimeError("schema-2 metric registry must contain exactly 61 unique leaves")
    for spec in SCHEMA2_METRIC_REGISTRY:
        if spec.json_pointer != "/" + "/".join(spec.accessor):
            raise RuntimeError(f"invalid metric pointer for {spec.leaf_id}")


_validate_registry()

__all__ = [
    "MetricLeafSpec",
    "SCHEMA2_METRIC_BY_ID",
    "SCHEMA2_METRIC_REGISTRY",
    "SCHEMA2_TOLERANCE_LABEL",
    "metric_leaf_value",
    "metric_leaf_uses_wrapper",
]
