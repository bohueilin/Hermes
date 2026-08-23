"""The world tape: every exogenous fact, materialized and hashed before either arm runs.

The rigor requirement is stable exogenous identity across arms — both arms must experience
the same world, so the policy or parameter under test is the only difference. Keyed streams
alone can silently break that: a disturbance keyed to *whichever vehicle the policy selects*
changes when the assignment changes, which quietly decouples the arms. So the tape is
materialized up front from purely exogenous identities (the request, never the chosen
vehicle), hashed, and handed to both arms read-only.

What is fixed and what varies (the preregistered answer, not an accident of code):
- The demand trace — arrival times, origins, destinations — is derived deterministically
  from the scenario alone and is identical across every replication and both arms.
- The per-request travel-time multiplier varies by replication seed, keyed by
  (seed, "travel", request_id). It is the only stochastic input in the spike, so the CI over
  paired deltas measures Monte Carlo variation in travel conditions, nothing else.
"""

from __future__ import annotations

import hashlib
import math
from dataclasses import dataclass

from hermes.evidence.canonical import canonical_json_bytes
from hermes.fleet.contracts import FleetScenarioConfig


@dataclass(frozen=True)
class RequestEvent:
    request_id: str
    time_s: int
    origin: str
    destination: str


@dataclass(frozen=True)
class WorldTape:
    """One replication's complete exogenous world. Read-only by construction."""

    seed: int
    demand: tuple[RequestEvent, ...]
    #: request_id -> travel-time multiplier for that request's trip legs.
    travel_multiplier: dict[str, float]


def _u64(*parts: object) -> int:
    """Deterministic 64-bit integer from a keyed identity — the stream key function."""
    digest = hashlib.sha256("|".join(str(part) for part in parts).encode()).digest()
    return int.from_bytes(digest[:8], "big")


def _unit_interval(*parts: object) -> float:
    """Uniform in (0, 1), exclusive of the endpoints so log/ppf transforms stay finite."""
    return (_u64(*parts) + 1) / (2**64 + 2)


def _standard_normal(*parts: object) -> float:
    """Box-Muller from two keyed uniforms — no shared generator state, so draw order in one
    arm can never desynchronise the other."""
    u1 = _unit_interval(*parts, "u1")
    u2 = _unit_interval(*parts, "u2")
    return math.sqrt(-2.0 * math.log(u1)) * math.cos(2.0 * math.pi * u2)


def build_demand_trace(scenario: FleetScenarioConfig) -> tuple[RequestEvent, ...]:
    """The demand trace, from the scenario alone — identical for every seed and both arms.

    Arrivals are exponential inter-arrival times per zone, drawn from keys of
    (scenario name, zone, index): deterministic, order-independent, and unaffected by
    anything either arm does.
    """
    events: list[RequestEvent] = []
    for zone_index, zone in enumerate(scenario.zones):
        rate_per_s = scenario.demand_per_zone_per_hour / 3600.0
        time_s = 0.0
        index = 0
        while True:
            gap = -math.log(_unit_interval(scenario.name, "arrival", zone, index)) / rate_per_s
            time_s += gap
            if time_s >= scenario.horizon_s:
                break
            destination_pick = _u64(scenario.name, "destination", zone, index) % (
                len(scenario.zones) - 1
            )
            destinations = [z for z in scenario.zones if z != zone]
            events.append(
                RequestEvent(
                    request_id=f"r-{zone_index}-{index}",
                    time_s=int(time_s),
                    origin=zone,
                    destination=destinations[destination_pick],
                )
            )
            index += 1
    events.sort(key=lambda e: (e.time_s, e.request_id))
    return tuple(events)


def build_tape(scenario: FleetScenarioConfig, seed: int) -> WorldTape:
    """Materialize one replication's world: shared demand plus seed-varying disturbances."""
    demand = build_demand_trace(scenario)
    multipliers = {
        event.request_id: math.exp(
            scenario.travel_sigma * _standard_normal(seed, "travel", event.request_id)
        )
        for event in demand
    }
    return WorldTape(seed=seed, demand=demand, travel_multiplier=multipliers)


def tape_digest(scenario: FleetScenarioConfig, seeds: tuple[int, ...]) -> str:
    """One digest over the full preregistered world: the shared trace and every seed's
    materialized disturbances. Any change to what either arm will experience changes this."""
    payload = {
        "demand": [
            [event.request_id, event.time_s, event.origin, event.destination]
            for event in build_demand_trace(scenario)
        ],
        "travel": {
            str(seed): {
                request_id: round(value, 12)
                for request_id, value in sorted(
                    build_tape(scenario, seed).travel_multiplier.items()
                )
            }
            for seed in seeds
        },
    }
    return hashlib.sha256(canonical_json_bytes(payload)).hexdigest()
