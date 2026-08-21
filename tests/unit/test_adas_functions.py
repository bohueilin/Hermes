"""Behavioural contracts of the ADAS longitudinal functions.

These are the properties that make the evidence downstream mean anything: TTC is undefined
rather than clamped, AEB stages on required deceleration rather than TTC, releasing an
intervention needs positive evidence of safety, stale observations degrade explicitly, and
the fused command always satisfies the Action invariant.
"""

from __future__ import annotations

import pytest

from hermes.adas.functions import (
    AutomaticEmergencyBraking,
    ForwardCollisionWarning,
    ScriptedLongitudinalDriver,
)
from hermes.adas.interfaces import (
    AdasObservation,
    AebConfig,
    BrakeSource,
    DriverConfig,
    FcwConfig,
    InterventionLevel,
    WarningLevel,
)
from hermes.adas.policy import project_to_action

CONTROL_PERIOD_S = 0.1


def _observation(
    *,
    speed: float = 20.0,
    gap: float | None = 40.0,
    relative_speed: float | None = -20.0,
    age: float = 0.0,
    sequence: int = 0,
) -> AdasObservation:
    return AdasObservation(
        sequence=sequence,
        simulation_time_s=sequence * CONTROL_PERIOD_S,
        ego_speed_mps=speed,
        ego_acceleration_mps2=0.0,
        observation_age_s=age,
        lead_distance_m=gap,
        lead_relative_speed_mps=relative_speed,
    )


# --- observation semantics -------------------------------------------------------------


def test_ttc_is_undefined_rather_than_clamped_when_not_closing() -> None:
    """A non-closing lead has no time to collision; a clamp would read as a huge margin."""
    assert _observation(relative_speed=0.0).time_to_collision_s() is None
    assert _observation(relative_speed=5.0).time_to_collision_s() is None
    assert _observation(gap=None, relative_speed=None).time_to_collision_s() is None


def test_ttc_never_divides_by_zero_across_the_closing_boundary() -> None:
    for relative_speed in (-1e-12, 0.0, 1e-12, -0.0):
        _observation(relative_speed=relative_speed).time_to_collision_s()


def test_ttc_is_gap_over_closing_speed_when_closing() -> None:
    assert _observation(gap=40.0, relative_speed=-20.0).time_to_collision_s() == 2.0


def test_required_deceleration_is_undefined_when_not_closing() -> None:
    observation = _observation(relative_speed=1.0)

    assert observation.required_deceleration_mps2(standoff_m=2.0) is None


def test_required_deceleration_grows_as_the_gap_closes() -> None:
    far = _observation(gap=40.0).required_deceleration_mps2(standoff_m=2.0)
    near = _observation(gap=10.0).required_deceleration_mps2(standoff_m=2.0)

    assert far is not None and near is not None
    assert near > far


def test_required_deceleration_is_infinite_once_the_standoff_is_consumed() -> None:
    observation = _observation(gap=1.0)

    assert observation.required_deceleration_mps2(standoff_m=2.0) == float("inf")


def test_lead_in_path_follows_the_adapter_signal_availability_convention() -> None:
    """The adapter reports a front distance only while the actor overlaps the ego lane."""
    assert _observation(gap=30.0, relative_speed=-5.0).lead_in_path
    assert not _observation(gap=None, relative_speed=None).lead_in_path


# --- forward collision warning ---------------------------------------------------------


def test_fcw_stages_advisory_then_urgent_as_ttc_falls() -> None:
    fcw = ForwardCollisionWarning(FcwConfig())

    assert fcw.step(_observation(gap=100.0))[0] is WarningLevel.NO_WARNING
    assert fcw.step(_observation(gap=50.0))[0] is WarningLevel.ADVISORY
    assert fcw.step(_observation(gap=20.0))[0] is WarningLevel.URGENT_WARNING


def test_fcw_stays_silent_without_a_lead() -> None:
    fcw = ForwardCollisionWarning(FcwConfig())

    level, reasons = fcw.step(_observation(gap=None, relative_speed=None))

    assert level is WarningLevel.NO_WARNING
    assert reasons == ()


def test_fcw_stays_silent_below_the_minimum_ego_speed() -> None:
    fcw = ForwardCollisionWarning(FcwConfig())

    assert fcw.step(_observation(speed=0.5, gap=5.0))[0] is WarningLevel.NO_WARNING


def test_fcw_degrades_explicitly_on_a_stale_observation() -> None:
    """Stale data must produce a named degraded state, never a silent all-clear."""
    fcw = ForwardCollisionWarning(FcwConfig())
    fcw.step(_observation(gap=20.0))

    level, reasons = fcw.step(_observation(gap=20.0, age=2.0))

    assert level is WarningLevel.NO_WARNING
    assert "FCW_DEGRADED_STALE_OBSERVATION" in reasons


def test_fcw_holds_through_the_release_margin_instead_of_chattering() -> None:
    config = FcwConfig()
    fcw = ForwardCollisionWarning(config)
    fcw.step(_observation(gap=50.0))

    # Just past the advisory threshold but inside the release margin.
    ttc = config.advisory_ttc_s + config.release_ttc_margin_s / 2.0
    level, reasons = fcw.step(_observation(gap=ttc * 20.0))

    assert level is WarningLevel.ADVISORY
    assert "FCW_HELD_BY_RELEASE_HYSTERESIS" in reasons


def test_fcw_counts_each_warning_episode_once() -> None:
    fcw = ForwardCollisionWarning(FcwConfig())
    for _ in range(4):
        fcw.step(_observation(gap=20.0))

    assert fcw.warning_count == 1


# --- automatic emergency braking -------------------------------------------------------


def _aeb(config: AebConfig | None = None, authority: float = 6.0) -> AutomaticEmergencyBraking:
    return AutomaticEmergencyBraking(config or AebConfig(), max_braking_mps2=authority)


def test_aeb_does_not_intervene_on_a_distant_lead() -> None:
    level, brake, _ = _aeb().step(_observation(gap=200.0), control_period_s=CONTROL_PERIOD_S)

    assert level is InterventionLevel.NO_INTERVENTION
    assert brake == 0.0


def test_aeb_stages_partial_before_emergency_as_required_deceleration_rises() -> None:
    """The staging property: authority fractions, not TTC thresholds."""
    # Closing at 20 m/s with a 2 m standoff against 6 m/s^2 authority: staging boundaries
    # sit at a_req = 2.4 (partial) and 4.2 (emergency), i.e. gaps of roughly 85 m and 50 m.
    none = _aeb().step(_observation(gap=200.0), control_period_s=CONTROL_PERIOD_S)[0]
    partial = _aeb().step(_observation(gap=60.0), control_period_s=CONTROL_PERIOD_S)[0]
    emergency = _aeb().step(_observation(gap=26.0), control_period_s=CONTROL_PERIOD_S)[0]

    assert none is InterventionLevel.NO_INTERVENTION
    assert partial is InterventionLevel.PARTIAL_BRAKE
    assert emergency is InterventionLevel.EMERGENCY_BRAKE


def test_aeb_stages_on_required_deceleration_not_on_ttc() -> None:
    """Two situations with identical TTC but different required deceleration.

    TTC = gap / closing. Holding TTC at 2.0 s, a slower approach with a proportionally
    smaller gap needs far more deceleration to stop in the distance available. A TTC-staged
    controller cannot tell these apart; this one must.
    """
    high_speed = _observation(gap=60.0, relative_speed=-30.0, speed=30.0)
    low_speed = _observation(gap=20.0, relative_speed=-10.0, speed=10.0)

    assert high_speed.time_to_collision_s() == low_speed.time_to_collision_s() == 2.0
    fast = _aeb().step(high_speed, control_period_s=CONTROL_PERIOD_S)[0]
    slow = _aeb().step(low_speed, control_period_s=CONTROL_PERIOD_S)[0]

    assert fast is InterventionLevel.EMERGENCY_BRAKE
    assert slow is InterventionLevel.PARTIAL_BRAKE


def test_aeb_does_not_release_merely_because_ttc_became_undefined() -> None:
    """The release trap: closing speed touching zero mid-intervention is not safety."""
    aeb = _aeb()
    aeb.step(_observation(gap=20.0), control_period_s=CONTROL_PERIOD_S)
    for _ in range(20):  # exhaust the minimum hold
        aeb.step(_observation(gap=20.0), control_period_s=CONTROL_PERIOD_S)

    level, brake, reasons = aeb.step(
        _observation(gap=3.0, relative_speed=0.0), control_period_s=CONTROL_PERIOD_S
    )

    assert level is not InterventionLevel.NO_INTERVENTION
    assert brake > 0.0
    assert "AEB_HELD_THREAT_NOT_CLEARED" in reasons


def test_aeb_releases_once_distance_and_ttc_both_clear() -> None:
    aeb = _aeb()
    aeb.step(_observation(gap=20.0), control_period_s=CONTROL_PERIOD_S)
    for _ in range(20):
        aeb.step(_observation(gap=20.0), control_period_s=CONTROL_PERIOD_S)

    level, brake, reasons = aeb.step(
        _observation(gap=80.0, relative_speed=1.0), control_period_s=CONTROL_PERIOD_S
    )

    assert level is InterventionLevel.NO_INTERVENTION
    assert brake == 0.0
    assert "AEB_RELEASED_THREAT_CLEARED" in reasons


def test_aeb_honours_its_minimum_hold_time() -> None:
    aeb = _aeb(AebConfig(minimum_hold_s=1.0))
    aeb.step(_observation(gap=20.0), control_period_s=CONTROL_PERIOD_S)

    level, _, reasons = aeb.step(
        _observation(gap=500.0, relative_speed=5.0), control_period_s=CONTROL_PERIOD_S
    )

    assert level is not InterventionLevel.NO_INTERVENTION
    assert "AEB_MINIMUM_HOLD_ACTIVE" in reasons


def test_aeb_holds_the_brake_at_standstill() -> None:
    """Releasing at zero speed would let the driver re-accelerate into the obstacle."""
    aeb = _aeb()
    aeb.step(_observation(gap=8.0), control_period_s=CONTROL_PERIOD_S)
    aeb.step(_observation(gap=8.0, speed=0.05), control_period_s=CONTROL_PERIOD_S)

    level, brake, reasons = aeb.step(
        _observation(gap=8.0, speed=0.0, relative_speed=0.0),
        control_period_s=CONTROL_PERIOD_S,
    )

    assert level is InterventionLevel.EMERGENCY_BRAKE
    assert brake > 0.0
    assert "AEB_STANDSTILL_HOLD" in reasons


def test_aeb_degrades_explicitly_on_a_stale_observation() -> None:
    aeb = _aeb()

    level, brake, reasons = aeb.step(
        _observation(gap=10.0, age=2.0), control_period_s=CONTROL_PERIOD_S
    )

    assert level is InterventionLevel.NO_INTERVENTION
    assert brake == 0.0
    assert "AEB_DEGRADED_STALE_OBSERVATION" in reasons


def test_aeb_counts_each_intervention_episode_once() -> None:
    aeb = _aeb()
    for _ in range(5):
        aeb.step(_observation(gap=20.0), control_period_s=CONTROL_PERIOD_S)

    assert aeb.intervention_count == 1


def test_aeb_staging_scales_with_the_scenario_braking_authority() -> None:
    """A threshold expressed as a fraction of authority means the same at any limit."""
    weak = _aeb(authority=3.0).step(_observation(gap=60.0), control_period_s=CONTROL_PERIOD_S)
    strong = _aeb(authority=12.0).step(_observation(gap=60.0), control_period_s=CONTROL_PERIOD_S)

    assert weak[0] is not InterventionLevel.NO_INTERVENTION
    assert strong[0] is InterventionLevel.NO_INTERVENTION


# --- scripted driver and arbitration ---------------------------------------------------


def test_driver_accelerates_towards_the_target_and_holds_in_the_deadband() -> None:
    driver = ScriptedLongitudinalDriver(DriverConfig())
    driver.reset(20.0)

    throttle, brake, source = driver.step(_observation(speed=10.0))
    held = driver.step(_observation(speed=20.0))

    assert throttle > 0.0 and brake == 0.0 and source is BrakeSource.NONE
    assert held == (0.0, 0.0, BrakeSource.NONE)


def test_driver_does_not_brake_by_default() -> None:
    """Every brake in a default FCW/AEB run is therefore AEB-attributable by construction."""
    driver = ScriptedLongitudinalDriver(DriverConfig())
    driver.reset(5.0)

    throttle, brake, source = driver.step(_observation(speed=20.0))

    assert (throttle, brake, source) == (0.0, 0.0, BrakeSource.NONE)


def test_driver_braking_is_attributed_to_the_driver_not_to_aeb() -> None:
    """AEB metrics count only aeb-attributed braking; misattribution would inflate them."""
    driver = ScriptedLongitudinalDriver(DriverConfig(max_brake=0.3))
    driver.reset(5.0)

    _, brake, source = driver.step(_observation(speed=20.0))

    assert brake > 0.0
    assert source is BrakeSource.DRIVER


@pytest.mark.parametrize(
    ("throttle", "brake"),
    [(1.0, 1.0), (0.5, 0.5), (1.0, 0.01), (0.0, 0.0), (2.0, 0.0), (0.0, 5.0)],
)
def test_projection_always_satisfies_the_action_invariant(throttle: float, brake: float) -> None:
    """Action forbids simultaneous throttle and brake as a hard error, not a clamp."""
    action = project_to_action(throttle=throttle, brake=brake)

    assert not (action.throttle > 0.0 and action.brake > 0.0)
    assert 0.0 <= action.throttle <= 1.0
    assert 0.0 <= action.brake <= 1.0
    assert -1.0 <= action.steering <= 1.0


def test_projection_lets_brake_win_over_throttle() -> None:
    action = project_to_action(throttle=1.0, brake=0.4)

    # Commands are quantised to binary32 so MetaDrive reads back exactly what was
    # requested, so 0.4 is not representable exactly here.
    assert action.brake == pytest.approx(0.4)
    assert action.throttle == 0.0


def test_projection_is_exactly_representable_as_binary32() -> None:
    """The adapter aborts the run when the accepted action differs from the requested one."""
    import struct

    action = project_to_action(throttle=0.0, brake=0.9158437251382487)

    for value in (action.steering, action.throttle, action.brake):
        assert struct.unpack("!f", struct.pack("!f", value))[0] == value
