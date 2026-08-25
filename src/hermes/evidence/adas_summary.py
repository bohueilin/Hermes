"""Immutable simulator-neutral facts derived from typed schema-3 ADAS evidence."""

from __future__ import annotations

import math
from collections import Counter
from dataclasses import dataclass

from hermes.domain.enums import (
    BrakeSource,
    EvidenceAvailability,
    TerminationReason,
    WarningLevel,
)
from hermes.domain.models import ScenarioDefinition, TraceEventV3
from hermes.gates.config import GateConfig
from hermes.shields.deterministic import SUPPORTED_OVERRIDE_REASONS


@dataclass(frozen=True, slots=True)
class LongitudinalFact:
    """One typed input or execution fact with an explicit clock and source view."""

    sequence: int
    time_s: float
    speed_mps: float
    gap_m: float | None
    relative_speed_mps: float | None
    brake: float = 0.0

    @property
    def closing_mps(self) -> float:
        return (
            max(0.0, -self.relative_speed_mps)
            if self.relative_speed_mps is not None
            else 0.0
        )

    @property
    def in_path(self) -> bool:
        return self.gap_m is not None and self.relative_speed_mps is not None

    def ttc_s(self) -> float | None:
        if not self.in_path or self.closing_mps <= 0.0:
            return None
        assert self.gap_m is not None
        return self.gap_m / self.closing_mps

    def required_deceleration_mps2(self, standoff_m: float) -> float | None:
        if not self.in_path or self.closing_mps <= 0.0:
            return None
        assert self.gap_m is not None
        usable_gap_m = self.gap_m - standoff_m
        if usable_gap_m <= 0.0:
            return math.inf
        return (self.closing_mps * self.closing_mps) / (2.0 * usable_gap_m)


@dataclass(frozen=True, slots=True)
class CollisionContactFact:
    sequence: int
    time_s: float
    residual_speed_mps: float


@dataclass(frozen=True, slots=True)
class AdasRunSummary:
    """Evidence facts shared by schema-3 metrics and config-relative ADAS verifiers."""

    event_count: int
    simulation_duration_s: float
    collision_count: int
    collision_contacts: tuple[CollisionContactFact, ...]
    first_collision_residual_speed_mps: float | None
    max_abs_lateral_offset_m: float
    offroad_duration_s: float
    route_progress_values: tuple[float, ...]
    route_progress_complete: bool
    max_abs_acceleration_mps2: float
    all_jerk_mps3: tuple[float, ...]
    policy_latencies_ms: tuple[float, ...]
    shield_override_count: int
    shield_override_reasons: tuple[tuple[str, int], ...]
    termination_reason: TerminationReason
    fault_application_counts: tuple[tuple[str, int], ...]
    observation_ages_s: tuple[float, ...]
    control_latencies_ms: tuple[float, ...]
    control_fill_count: int
    steering_saturation_count: int
    brake_saturation_count: int
    minimum_result_ttc_s: float | None
    minimum_result_lead_distance_m: float | None
    policy_samples: tuple[LongitudinalFact, ...]
    threatening_policy_samples: tuple[LongitudinalFact, ...]
    positive_braking_steps: tuple[LongitudinalFact, ...]
    aeb_onset_facts: tuple[LongitudinalFact, ...]
    warning_onset_count: int
    first_warning_time_s: float | None
    first_warning_ttc_s: float | None
    aeb_onset_count: int
    first_aeb_onset_execution_sequence: int | None
    first_aeb_onset_execution_time_s: float | None
    first_aeb_onset_source_sequence: int | None
    first_aeb_onset_ttc_s: float | None
    first_aeb_onset_required_decel_mps2: float | None
    aeb_decelerations_mps2: tuple[float, ...]
    aeb_jerks_mps3: tuple[float, ...]
    fcw_enabled: bool
    aeb_enabled: bool
    false_fcw_exposure: bool
    false_aeb_exposure: bool


def _policy_fact(event: TraceEventV3) -> LongitudinalFact:
    delivered = event.observation_fault_evidence.delivered_observation
    return LongitudinalFact(
        sequence=event.sequence,
        time_s=event.adas_decision_input_time_s,
        speed_mps=delivered.vehicle_state.speed_mps,
        gap_m=delivered.front_distance_m,
        relative_speed_mps=delivered.front_relative_speed_mps,
    )


def summarize_adas_run(
    events: tuple[TraceEventV3, ...],
    scenario: ScenarioDefinition,
    gate_config: GateConfig,
) -> AdasRunSummary:
    """Derive immutable facts only from typed trace fields and resolved inputs."""
    if (
        type(events) is not tuple
        or not events
        or any(type(event) is not TraceEventV3 for event in events)
    ):
        raise ValueError("ADAS summary requires an exact nonempty TraceEventV3 tuple")
    if (
        type(scenario) is not ScenarioDefinition
        or scenario.schema_version != "4.0"
        or scenario.adas is None
    ):
        raise ValueError("ADAS summary requires an exact schema-4 ADAS scenario")
    if (
        type(gate_config) is not GateConfig
        or gate_config.schema_version != "2.0"
        or gate_config.adas is None
    ):
        raise ValueError("ADAS summary requires an exact schema-2 ADAS gate")

    frequency_hz = events[0].run_context.control_frequency_hz
    dt = 1.0 / frequency_hz
    policy_samples = tuple(_policy_fact(event) for event in events)
    policy_by_sequence = {event.sequence: event for event in events}
    threshold = (
        gate_config.adas.threat_authority_fraction
        * scenario.control.max_braking_mps2
    )
    threatening_policy_samples = tuple(
        sample
        for sample in policy_samples
        if (
            (required := sample.required_deceleration_mps2(
                gate_config.adas.oracle_standoff_m
            ))
            is not None
            and required >= threshold
        )
    )

    result_ttc_samples: list[float] = []
    result_lead_distances: list[float] = []
    collision_contacts: list[CollisionContactFact] = []
    first_collision_residual_speed_mps: float | None = None
    prior_collision_count = 0
    for event in events:
        result = event.result_observation
        if (
            result.front_distance_m is not None
            and result.front_relative_speed_mps is not None
        ):
            result_lead_distances.append(result.front_distance_m)
            if result.front_relative_speed_mps < 0.0:
                result_ttc_samples.append(
                    result.front_distance_m / -result.front_relative_speed_mps
                )
        if event.vehicle_state.collision_count > 0:
            collision_contacts.append(
                CollisionContactFact(
                    sequence=event.sequence,
                    time_s=event.simulation_time_s,
                    residual_speed_mps=event.vehicle_state.speed_mps,
                )
            )
        if (
            first_collision_residual_speed_mps is None
            and event.vehicle_state.collision_count > prior_collision_count
        ):
            first_collision_residual_speed_mps = event.vehicle_state.speed_mps
        prior_collision_count = event.vehicle_state.collision_count

    positive_braking_steps: list[LongitudinalFact] = []
    aeb_active: list[bool] = []
    aeb_onsets: list[tuple[TraceEventV3, TraceEventV3]] = []
    previous_aeb_active = False
    previous_warning_active = False
    warning_onset_count = 0
    first_warning_time_s: float | None = None
    first_warning_ttc_s: float | None = None
    for event in events:
        warning_active = event.adas_decision.warning is not WarningLevel.NO_WARNING
        if warning_active and not previous_warning_active:
            warning_onset_count += 1
            if first_warning_time_s is None:
                first_warning_time_s = event.adas_decision_input_time_s
                first_warning_ttc_s = event.adas_decision.time_to_collision_s
        previous_warning_active = warning_active

        if event.executed_action.brake > 0.0:
            source_sequence = event.control_fault_evidence.executed_from_sequence
            source_event = (
                policy_by_sequence.get(source_sequence)
                if source_sequence is not None
                else None
            )
            if source_event is None:
                raise ValueError(
                    "positive executed brake requires an originating V3 source event"
                )
            source = _policy_fact(source_event)
            positive_braking_steps.append(
                LongitudinalFact(
                    sequence=event.sequence,
                    time_s=event.simulation_time_s,
                    speed_mps=source.speed_mps,
                    gap_m=source.gap_m,
                    relative_speed_mps=source.relative_speed_mps,
                    brake=event.executed_action.brake,
                )
            )

        active = (
            event.executed_brake_source is BrakeSource.AEB
            and event.executed_action.brake > 0.0
        )
        aeb_active.append(active)
        if active and not previous_aeb_active:
            source_sequence = event.control_fault_evidence.executed_from_sequence
            source_event = (
                policy_by_sequence.get(source_sequence)
                if source_sequence is not None
                else None
            )
            if source_event is None:
                raise ValueError(
                    "executed AEB onset requires an originating V3 source event"
                )
            aeb_onsets.append((event, source_event))
        previous_aeb_active = active

    accelerations = tuple(event.vehicle_state.acceleration_mps2 for event in events)
    all_jerks = tuple(
        abs(accelerations[index] - accelerations[index - 1]) / dt
        for index in range(1, len(events))
    )
    aeb_jerks = tuple(
        abs(accelerations[index] - accelerations[index - 1]) / dt
        for index in range(1, len(events))
        if aeb_active[index]
    )
    aeb_decelerations = tuple(
        max(0.0, -event.vehicle_state.acceleration_mps2)
        for event, active in zip(events, aeb_active, strict=True)
        if active
    )

    fault_counts = Counter(
        reason
        for event in events
        for reason in (
            *event.observation_fault_evidence.applied_faults,
            *event.control_fault_evidence.applied_faults,
        )
    )
    control_latencies = tuple(
        float(latency.value)
        for event in events
        if (
            (latency := event.control_fault_evidence.control_latency_ms).availability
            is EvidenceAvailability.AVAILABLE
            and latency.value is not None
        )
    )
    override_counts = Counter(
        reason
        for event in events
        for reason in event.override_reasons
        if reason in SUPPORTED_OVERRIDE_REASONS
    )
    route_progress_values = tuple(
        event.vehicle_state.route_progress_pct
        for event in events
        if (
            event.raw_facts.route_progress_available
            and event.raw_facts.route_progress_pct is not None
        )
    )
    first_onset = aeb_onsets[0] if aeb_onsets else None
    first_onset_event = first_onset[0] if first_onset is not None else None
    first_onset_source = first_onset[1] if first_onset is not None else None
    aeb_onset_facts = tuple(
        LongitudinalFact(
            sequence=event.sequence,
            time_s=event.control_fault_evidence.execution_time_s,
            speed_mps=_policy_fact(source).speed_mps,
            gap_m=_policy_fact(source).gap_m,
            relative_speed_mps=_policy_fact(source).relative_speed_mps,
            brake=event.executed_action.brake,
        )
        for event, source in aeb_onsets
    )
    enabled = frozenset(scenario.adas.enabled)
    return AdasRunSummary(
        event_count=len(events),
        simulation_duration_s=events[-1].simulation_time_s,
        collision_count=max(event.vehicle_state.collision_count for event in events),
        collision_contacts=tuple(collision_contacts),
        first_collision_residual_speed_mps=first_collision_residual_speed_mps,
        max_abs_lateral_offset_m=max(
            abs(event.vehicle_state.lateral_offset_m) for event in events
        ),
        offroad_duration_s=sum(dt for event in events if event.vehicle_state.offroad),
        route_progress_values=route_progress_values,
        route_progress_complete=len(route_progress_values) == len(events),
        max_abs_acceleration_mps2=max(abs(value) for value in accelerations),
        all_jerk_mps3=all_jerks,
        policy_latencies_ms=tuple(event.policy_latency_ms for event in events),
        shield_override_count=sum(
            event.candidate_action != event.permitted_action for event in events
        ),
        shield_override_reasons=tuple(sorted(override_counts.items())),
        termination_reason=events[-1].termination_reason,
        fault_application_counts=tuple(sorted(fault_counts.items())),
        observation_ages_s=tuple(
            event.observation_fault_evidence.delivered_observation.observation_age_s
            for event in events
        ),
        control_latencies_ms=control_latencies,
        control_fill_count=fault_counts["CONTROL_DELAY_FILL"],
        steering_saturation_count=fault_counts["STEERING_SATURATION"],
        brake_saturation_count=fault_counts["BRAKE_SATURATION"],
        minimum_result_ttc_s=(min(result_ttc_samples) if result_ttc_samples else None),
        minimum_result_lead_distance_m=(
            min(result_lead_distances) if result_lead_distances else None
        ),
        policy_samples=policy_samples,
        threatening_policy_samples=threatening_policy_samples,
        positive_braking_steps=tuple(positive_braking_steps),
        aeb_onset_facts=aeb_onset_facts,
        warning_onset_count=warning_onset_count,
        first_warning_time_s=first_warning_time_s,
        first_warning_ttc_s=first_warning_ttc_s,
        aeb_onset_count=len(aeb_onsets),
        first_aeb_onset_execution_sequence=(
            first_onset_event.sequence if first_onset_event is not None else None
        ),
        first_aeb_onset_execution_time_s=(
            first_onset_event.control_fault_evidence.execution_time_s
            if first_onset_event is not None
            else None
        ),
        first_aeb_onset_source_sequence=(
            first_onset_source.sequence if first_onset_source is not None else None
        ),
        first_aeb_onset_ttc_s=(
            first_onset_source.adas_decision.time_to_collision_s
            if first_onset_source is not None
            else None
        ),
        first_aeb_onset_required_decel_mps2=(
            first_onset_source.adas_decision.required_deceleration_mps2
            if first_onset_source is not None
            else None
        ),
        aeb_decelerations_mps2=aeb_decelerations,
        aeb_jerks_mps3=aeb_jerks,
        fcw_enabled="fcw" in enabled,
        aeb_enabled="aeb" in enabled,
        false_fcw_exposure=(
            scenario.adas.expected_fcw is not None
            and scenario.adas.expected_fcw.kind == "none"
        ),
        false_aeb_exposure=(
            scenario.adas.expected_aeb is not None
            and scenario.adas.expected_aeb.kind == "forbidden"
        ),
    )
