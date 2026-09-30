"""Anonymous arithmetic and direction choices; never an operator or driving model.

No file, simulator, network, artifact or existing experiment access. All numerical
inputs are explicit. Bounds are teaching-interface limits, not engineering limits.
"""

import copy
import math

SCHEMA = "fleetlab.vehicle-readiness/1.0.0"
STATION_BOUNDS = {
    "distance_km": (0, 10000),
    "battery_kwh_per_km": (0.001, 5),
    "service_hours": (0, 168),
    "aux_battery_kw": (0, 100),
    "usable_capacity_kwh": (1, 1000),
    "start_kwh": (0, 1000),
    "target_kwh": (0, 1000),
    "site_grid_kw": (0.001, 100000),
    "ports": (1, 10000),
    "active_ports": (1, 10000),
    "port_grid_kw": (0.001, 2000),
    "vehicle_acceptance_battery_kw": (0.001, 2000),
    "charging_efficiency": (0.000001, 1),
}
DIRECTION_BOUNDS = {
    "body_heading_deg": (0, 360),
    "vehicle_length_m": (0.01, 50),
    "vehicle_width_m": (0.01, 10),
    "bay_length_m": (0.01, 1000),
    "bay_width_m": (0.01, 1000),
}
STATION_OUTPUTS = (
    "demand_energy_kwh", "after_service_kwh", "energy_deficit_kwh",
    "battery_charge_kwh", "grid_charge_kwh", "charging_loss_kwh", "final_kwh",
    "effective_battery_kw", "effective_grid_kw", "unused_grid_share_kw",
    "charging_hours", "cycle_hours", "service_time_fraction", "site_grid_saturation_kw",
)


def _number(value, key, lower, upper, *, integer=False, exclusive_upper=False):
    if type(value) not in (int, float):
        raise ValueError(f"{key} must be a finite number in its named unit")
    if value < lower or value > upper or (exclusive_upper and value == upper):
        raise ValueError(f"{key} outside supported teaching bounds")
    if not math.isfinite(value):
        raise ValueError(f"{key} must be a finite number in its named unit")
    if integer and type(value) is not int:
        raise ValueError(f"{key} must be an integer")


def _mapping(inputs, allowed):
    if not isinstance(inputs, dict):
        raise ValueError("inputs must be a mapping")
    if set(inputs) - set(allowed):
        raise ValueError("unsupported input keys; units are part of each field name")


def _numeric_fields(inputs, bounds, integers=()):
    for key, (lower, upper) in bounds.items():
        if inputs.get(key) is not None:
            _number(
                inputs[key], key, lower, upper,
                integer=key in integers, exclusive_upper=key.endswith("heading_deg"),
            )


def _result(kind, inputs):
    return {
        "schema": SCHEMA,
        "kind": kind,
        "scope": "SIMULATION_ONLY",
        "evidence": "ILLUSTRATIVE_CALCULATION",
        "authenticity": "NOT_AUTHENTICATED",
        "authorization": "NOT_EVALUATED",
        "deployment_permission": "NONE",
        "inputs": copy.deepcopy(inputs),
        "availability": "NOT_AVAILABLE",
        "missing_fields": [],
    }


def station_sensitivity(inputs):
    """One service block from start energy, then one stationary recharge to target.

    The focal vehicle receives an equal grid-power share at fixed active-port
    occupancy. Acceptance is battery-side; port/site ratings are grid-side. No
    queue, taper, charge-time auxiliary draw, charging en route or fleet forecast.
    """
    _mapping(inputs, STATION_BOUNDS)
    _numeric_fields(inputs, STATION_BOUNDS, ("ports", "active_ports"))
    r = _result("station_sensitivity", inputs)
    r.update(dict.fromkeys(STATION_OUTPUTS))
    r["bottlenecks"] = []
    r["equations"] = {
        "demand_energy_kwh": "distance_km * battery_kwh_per_km + service_hours * aux_battery_kw",
        "effective_battery_kw": (
            "min(site_grid_kw / active_ports * charging_efficiency, "
            "port_grid_kw * charging_efficiency, vehicle_acceptance_battery_kw)"
        ),
        "battery_charge_kwh": "target_kwh - (start_kwh - demand_energy_kwh)",
        "grid_charge_kwh": "battery_charge_kwh / charging_efficiency",
        "charging_hours": "battery_charge_kwh / effective_battery_kw",
        "cycle_hours": "service_hours + charging_hours",
        "site_grid_saturation_kw": (
            "active_ports * min(port_grid_kw, "
            "vehicle_acceptance_battery_kw / charging_efficiency)"
        ),
    }
    r["limitations"] = [
        "Explicit user inputs are not independently measured or authenticated.",
        "Consumption is battery-side propulsion; auxiliary battery draw is separate.",
        "Fixed active-port occupancy and constant acceptance/efficiency; no queue or taper.",
        "Service completes before recharge; no charging en route or reserve policy is inferred.",
        "No autonomy, safety, operator throughput, site feasibility or deployment conclusion.",
    ]
    r["missing_fields"] = [key for key in STATION_BOUNDS if inputs.get(key) is None]
    if r["missing_fields"]:
        return r
    p = inputs
    if not p["start_kwh"] <= p["target_kwh"] <= p["usable_capacity_kwh"]:
        raise ValueError("require start_kwh <= target_kwh <= usable_capacity_kwh")
    if p["active_ports"] > p["ports"]:
        raise ValueError("active_ports must not exceed installed ports")
    if p["distance_km"] > 0 and p["service_hours"] == 0:
        raise ValueError("positive distance requires positive service_hours")
    demand = p["distance_km"] * p["battery_kwh_per_km"]
    demand += p["service_hours"] * p["aux_battery_kw"]
    r["demand_energy_kwh"] = demand
    if demand > p["start_kwh"]:
        r.update(availability="NOT_FEASIBLE", energy_deficit_kwh=demand - p["start_kwh"])
        return r
    after = p["start_kwh"] - demand
    efficiency = p["charging_efficiency"]
    grid_share = p["site_grid_kw"] / p["active_ports"]
    caps = {
        "SITE_GRID_SHARE": grid_share * efficiency,
        "PORT_GRID_LIMIT": p["port_grid_kw"] * efficiency,
        "VEHICLE_BATTERY_ACCEPTANCE": p["vehicle_acceptance_battery_kw"],
    }
    battery_power = min(caps.values())
    battery_charge = p["target_kwh"] - after
    grid_charge = battery_charge / efficiency
    charge_hours = battery_charge / battery_power
    cycle_hours = p["service_hours"] + charge_hours
    r.update(
        availability="COMPUTED",
        after_service_kwh=after,
        energy_deficit_kwh=0,
        battery_charge_kwh=battery_charge,
        grid_charge_kwh=grid_charge,
        charging_loss_kwh=grid_charge - battery_charge,
        final_kwh=after + battery_charge,
        effective_battery_kw=battery_power,
        effective_grid_kw=battery_power / efficiency,
        unused_grid_share_kw=max(0, grid_share - battery_power / efficiency),
        charging_hours=charge_hours,
        cycle_hours=cycle_hours,
        service_time_fraction=p["service_hours"] / cycle_hours if cycle_hours else None,
        site_grid_saturation_kw=p["active_ports"] * min(
            p["port_grid_kw"], p["vehicle_acceptance_battery_kw"] / efficiency
        ),
        bottlenecks=[key for key, value in caps.items() if value == battery_power],
    )
    return r


def _validate_exits(exits):
    if not isinstance(exits, list) or not 1 <= len(exits) <= 8:
        raise ValueError("exits must contain between 1 and 8 choices")
    ids = set()
    allowed = {"id", "heading_deg", "motion", "permitted", "dwell_s", "dwell_basis"}
    for e in exits:
        _mapping(e, allowed)
        if not isinstance(e.get("id"), str) or not 1 <= len(e["id"]) <= 80:
            raise ValueError("each exit needs a nonempty id of at most 80 characters")
        if e["id"] in ids:
            raise ValueError("duplicate exit id")
        ids.add(e["id"])
        if e.get("heading_deg") is not None:
            _number(e["heading_deg"], "heading_deg", 0, 360, exclusive_upper=True)
        if e.get("motion") is not None and e["motion"] not in ("forward", "reverse"):
            raise ValueError("exit motion must be forward or reverse")
        if e.get("permitted") is not None and type(e["permitted"]) is not bool:
            raise ValueError("exit permitted must be a boolean")
        if e.get("dwell_s") is not None:
            _number(e["dwell_s"], "dwell_s", 0, 86400)
        if e.get("dwell_basis") is not None and e["dwell_basis"] not in (
            "USER_SUPPLIED", "MEASURED_USER_SUPPLIED",
        ):
            raise ValueError("unsupported declared dwell_basis")


def direction_fixture(inputs):
    """Static, body-aligned rectangular fit plus explicitly permitted axial exits.

    Heading is clockwise from north, degrees [0, 360). A reverse exit changes
    travel heading, never body yaw. Conventional vehicles may reverse. Neither
    a declared permission nor a static fit establishes a feasible driving path.
    """
    required = [*DIRECTION_BOUNDS, "bidirectional", "exits"]
    _mapping(inputs, required)
    _numeric_fields(inputs, DIRECTION_BOUNDS)
    if inputs.get("bidirectional") is not None and type(inputs["bidirectional"]) is not bool:
        raise ValueError("bidirectional must be a boolean")
    if inputs.get("exits") is not None:
        _validate_exits(inputs["exits"])
    r = _result("direction_fixture", inputs)
    r.update(
        body_heading_deg=inputs.get("body_heading_deg"),
        static_footprint_fits=None,
        longitudinal_total_margin_m=None,
        lateral_total_margin_m=None,
        geometric_maneuver_feasibility="NOT_EVALUATED",
        options=[],
        limitations=[
            "Static rectangles have aligned axes; margins are total spare lengths, not clearance.",
            "No swept path, steering, door/access aisle, traffic or collision dynamics.",
            "Supplied permission and dwell provenance are declarations, not legal verification.",
            "Bidirectional capability does not grant permission; conventional reverse is allowed.",
            "Exit dwell is user supplied; no driving or direction-switch time is inferred.",
        ],
    )
    r["missing_fields"] = [key for key in required if inputs.get(key) is None]
    if r["missing_fields"]:
        return r
    longitudinal = inputs["bay_length_m"] - inputs["vehicle_length_m"]
    lateral = inputs["bay_width_m"] - inputs["vehicle_width_m"]
    fits = longitudinal >= 0 and lateral >= 0
    r.update(
        static_footprint_fits=fits,
        longitudinal_total_margin_m=longitudinal,
        lateral_total_margin_m=lateral,
    )
    for e in inputs["exits"]:
        option = {
            "id": e["id"], "availability": "NOT_AVAILABLE", "reason": None,
            "travel_heading_deg": None, "dwell_s": None, "declared_dwell_basis": None,
        }
        needed = ("heading_deg", "motion", "permitted", "dwell_s", "dwell_basis")
        missing = [key for key in needed if e.get(key) is None]
        if e.get("permitted") is False:
            option["reason"] = "EXIT_NOT_PERMITTED"
        elif missing:
            option.update(reason="MISSING_EXIT_INPUTS", missing_fields=missing)
        elif not fits:
            option["reason"] = "STATIC_FOOTPRINT_DOES_NOT_FIT"
        else:
            travel = (inputs["body_heading_deg"] + (180 if e["motion"] == "reverse" else 0)) % 360
            if travel != e["heading_deg"]:
                option["reason"] = "HEADING_CHANGE_NOT_MODELED"
            else:
                option.update(
                    availability="COMPUTED", travel_heading_deg=travel,
                    dwell_s=e["dwell_s"], declared_dwell_basis=e["dwell_basis"],
                )
        r["options"].append(option)
    if any(o["availability"] == "COMPUTED" for o in r["options"]):
        r["availability"] = "COMPUTED"
    return r
