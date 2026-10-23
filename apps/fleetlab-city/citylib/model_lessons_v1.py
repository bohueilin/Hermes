"""Fixed anonymous examples, generated and checked without city or simulator access."""

import math

from .contracts import digest
from .vehicle_readiness_v1 import direction_fixture, station_sensitivity

SCHEMA = "fleetlab.model-lessons/1.0.0"


def _projection():
    station_cases = []
    for site_kw in (100, 200, 400, 800):
        for acceptance_kw in (20, 40, 80):
            inputs = {
                "distance_km": 40, "battery_kwh_per_km": 0.2,
                "service_hours": 2, "aux_battery_kw": 1,
                "usable_capacity_kwh": 60, "start_kwh": 30, "target_kwh": 48,
                "site_grid_kw": site_kw, "ports": 8, "active_ports": 8,
                "port_grid_kw": 50, "vehicle_acceptance_battery_kw": acceptance_kw,
                "charging_efficiency": 0.9,
            }
            station_cases.append({
                "id": f"site-{site_kw}-acceptance-{acceptance_kw}",
                "label": f"{site_kw} kW site · {acceptance_kw} kW battery acceptance",
                "result": station_sensitivity(inputs),
            })
    direction_cases = []
    for case_id, label, bidirectional, reverse in (
        ("forward-only", "Forward exit only", False, False),
        ("reverse-permitted", "Conventional vehicle · reverse permitted", False, True),
        ("reverse-forbidden", "Bidirectional vehicle · reverse forbidden", True, False),
    ):
        inputs = {
            "body_heading_deg": 90, "bidirectional": bidirectional,
            "vehicle_length_m": 4, "vehicle_width_m": 2,
            "bay_length_m": 6, "bay_width_m": 3,
            "exits": [
                {"id": "forward", "heading_deg": 90, "motion": "forward",
                 "permitted": True, "dwell_s": 12, "dwell_basis": "USER_SUPPLIED"},
                {"id": "reverse", "heading_deg": 270, "motion": "reverse",
                 "permitted": reverse, "dwell_s": 4, "dwell_basis": "USER_SUPPLIED"},
            ],
        }
        direction_cases.append({"id": case_id, "label": label,
                                "result": direction_fixture(inputs)})
    return {
        "schema": SCHEMA,
        "scope": "SIMULATION_ONLY",
        "evidence": "ILLUSTRATIVE_CALCULATION",
        "verification": "INTERNALLY_CONSISTENT",
        "authenticity": "NOT_AUTHENTICATED",
        "authorization": "NOT_EVALUATED",
        "deployment_permission": "NONE",
        "decision_authority": "NONE",
        "title": "Vehicle and station lessons",
        "description": (
            "Twelve anonymous input sensitivities and three explicit exit-permission fixtures."
        ),
        "station_cases": station_cases,
        "direction_cases": direction_cases,
        "limitations": [
            "All values and rectangles are original synthetic teaching assumptions, "
            "not measured specifications.",
            "No San Francisco demand, routes, fleet result, operator calibration "
            "or vehicle brand is used.",
            "Fixed occupancy, constant acceptance and efficiency; no queue, taper "
            "or charge-time auxiliary draw.",
            "Direction diagrams show permission choices, not swept paths, clearance, "
            "safety or steering physics.",
            "Build checks establish reproducible arithmetic only; they do not "
            "authenticate inputs or authorize deployment.",
        ],
        "source_references": [
            {"label": "EPA: EV test electricity includes AC charging losses",
             "url": "https://www.fueleconomy.gov/feg/pdfs/EPA%20test%20procedure%20for%20EVs-PHEVs-11-14-2017.pdf",
             "use": "Explains why test-cycle wall energy is not substituted "
                    "for battery-side consumption."},
            {"label": "SFMTA: passenger loading zones",
             "url": "https://www.sfmta.com/getting-around/drive-park/loading-and-short-term-parking/white-zonespassenger-loading",
             "use": "Context only: curb permission and time restrictions "
                    "require separate evidence."},
        ],
    }


def verify_model_lessons(data):
    """Check fixed population, exact core reproduction, digest and energy ledger.

    This is an internal-consistency check, not independent source authentication.
    A caller cannot alter assumptions and relabel them as these fixed examples.
    """
    if not isinstance(data, dict):
        raise ValueError("model lessons must be a mapping")
    content = {key: value for key, value in data.items() if key != "content_digest"}
    try:
        if data.get("content_digest") != digest(content) or content != _projection():
            raise ValueError("model lessons do not match the verified fixed projection")
        for case in data["station_cases"]:
            r = case["result"]
            p = r["inputs"]
            checks = (
                (r["grid_charge_kwh"], r["battery_charge_kwh"] + r["charging_loss_kwh"]),
                (p["start_kwh"] + r["battery_charge_kwh"],
                 r["demand_energy_kwh"] + r["final_kwh"]),
                (r["effective_battery_kw"] * r["charging_hours"], r["battery_charge_kwh"]),
            )
            if not all(math.isclose(a, b, rel_tol=1e-12, abs_tol=1e-12) for a, b in checks):
                raise ValueError("model lessons energy ledger failed")
    except (KeyError, TypeError, OverflowError) as exc:
        raise ValueError("malformed model lessons") from exc


def build_model_lessons():
    """Return a fresh JSON-ready projection; no files or live experiments accessed."""
    data = _projection()
    data["content_digest"] = digest(data)
    verify_model_lessons(data)
    return data
