"""Exploratory paired bootstrap and explicit within-model guardrail decisions."""

import random

from .contracts import digest
from .verify import quantile


def paired_interval(values, resamples=2000, seed=20260929):
    if not values or any(v is None for v in values):
        return None
    rng = random.Random(seed)
    n = len(values)
    means = [sum(values[rng.randrange(n)] for _ in range(n)) / n for _ in range(resamples)]
    return {
        "mean": sum(values) / n,
        "low": quantile(means, 0.025),
        "high": quantile(means, 0.975),
        "n": n,
    }


def decide(primary, empty, wait, zones):
    def result(status, reason):
        return {"outcome": status, "reason": reason, "decision_authority": "NONE"}

    if primary is None:
        return result("UNAVAILABLE_PRIMARY", "Completion denominator unavailable")
    if empty is None or wait is None:
        return result(
            "UNAVAILABLE_GUARDRAIL", "Undefined empty-distance or boarded-wait population"
        )
    if empty["low"] > 10 or wait["low"] > 60:
        return result("GUARDRAIL_HARMED", "A guardrail interval lies above its allowance")
    if any(min(z["baseline_n"], z["candidate_n"]) < 30 for z in zones):
        return result(
            "INSUFFICIENT_ZONE_DATA", "Fewer than 30 requests per arm in an analysis zone"
        )
    if any(z["delta_pp"] < -5 for z in zones):
        return result(
            "ZONE_HARM_VETO", "Pooled zone completion worsened by more than 5 percentage points"
        )
    if empty["high"] > 10 or wait["high"] > 60:
        return result("GUARDRAIL_INCONCLUSIVE", "A guardrail interval crosses its allowance")
    if primary["high"] <= 2:
        return result(
            "NO_SUPPORTED_IMPROVEMENT", "Practical improvement above +2 points was not supported"
        )
    if primary["low"] <= 2:
        return result("INCONCLUSIVE", "Completion interval crosses the +2-point practical margin")
    return result(
        "SUPPORTED_WITHIN_MODEL",
        "Completion lower bound exceeds +2 points and all declared guardrails pass",
    )


def compare_pairs(pairs, expected_seeds, pack_qualified):
    base = {
        "schema": "fleetlab.city-comparison/1.0.0",
        "decision_authority": "NONE",
        "scope": "SIMULATION_ONLY",
        "expected_seeds": expected_seeds,
        "pack_qualified": pack_qualified,
        "pairs": [],
    }
    if [p["seed"] for p in pairs] != expected_seeds:
        return {
            **base,
            "eligibility": "INCOMPLETE",
            "outcome": "INCOMPLETE",
            "reason": "Required seed schedule missing or reordered",
        }
    for pair in pairs:
        a, b = pair["baseline"], pair["candidate"]
        if (
            a["input_digest"] != b["input_digest"]
            or a["pack_digest"] != b["pack_digest"]
            or a["model"] != b["model"]
        ):
            return {
                **base,
                "eligibility": "INCOMPATIBLE",
                "outcome": "INCOMPATIBLE",
                "reason": "Paired input/pack/engine mismatch",
            }
        # Only site location/resource split is an intervention. All remaining scientific
        # fields match.
        if digest({k: v for k, v in a["spec"].items() if k != "sites"}) != digest(
            {k: v for k, v in b["spec"].items() if k != "sites"}
        ):
            return {
                **base,
                "eligibility": "INCOMPATIBLE",
                "outcome": "INCOMPATIBLE",
                "reason": "Non-treatment specification differs",
            }
        for kind in ("ports", "power_kw", "slots"):
            if sum(s[kind] for s in a["spec"]["sites"]) != sum(s[kind] for s in b["spec"]["sites"]):
                return {
                    **base,
                    "eligibility": "INCOMPATIBLE",
                    "outcome": "INCOMPATIBLE",
                    "reason": "Total resources differ",
                }
        av, bv = pair["baseline_verification"], pair["candidate_verification"]
        if not av["valid"] or not bv["valid"]:
            return {
                **base,
                "eligibility": "INVALID",
                "outcome": "INVALID",
                "reason": "Run verification failed",
            }
        if a["execution"] != "COMPLETE" or b["execution"] != "COMPLETE":
            return {
                **base,
                "eligibility": "INCOMPLETE",
                "outcome": "INCOMPLETE",
                "reason": "Partial run",
            }
        if not av["recommendation_eligible"] or not bv["recommendation_eligible"]:
            return {
                **base,
                "eligibility": "INVALID",
                "outcome": "INVALID",
                "reason": "Hard invariant or teleport/drop/insertion counter failed",
            }
        base["pairs"].append(
            {"seed": pair["seed"], "baseline": av["metrics"], "candidate": bv["metrics"]}
        )
    deltas = []
    empty = []
    wait = []
    pooled = {}
    for pair in base["pairs"]:
        a, b = pair["baseline"], pair["candidate"]
        deltas.append(
            100 * (b["completion_fraction"] - a["completion_fraction"])
            if a["completion_fraction"] is not None and b["completion_fraction"] is not None
            else None
        )
        empty.append(
            100 * (b["empty_km_per_completed"] / a["empty_km_per_completed"] - 1)
            if a["empty_km_per_completed"] and b["empty_km_per_completed"] is not None
            else None
        )
        wait.append(
            b["wait_p90_s"] - a["wait_p90_s"]
            if a["wait_p90_s"] is not None and b["wait_p90_s"] is not None
            else None
        )
        for z in set(a["zones"]) | set(b["zones"]):
            p = pooled.setdefault(
                z, {"baseline_n": 0, "candidate_n": 0, "baseline_done": 0, "candidate_done": 0}
            )
            for label, m in [("baseline", a), ("candidate", b)]:
                p[label + "_n"] += m["zones"].get(z, {}).get("created", 0)
                p[label + "_done"] += m["zones"].get(z, {}).get("completed", 0)
    zones = [
        {
            "zone": z,
            **p,
            "delta_pp": 100
            * (p["candidate_done"] / p["candidate_n"] - p["baseline_done"] / p["baseline_n"])
            if p["candidate_n"] and p["baseline_n"]
            else 0,
        }
        for z, p in sorted(pooled.items())
    ]
    primary = paired_interval(deltas)
    emp = paired_interval(empty)
    wa = paired_interval(wait)
    result = decide(primary, emp, wa, zones)
    if not pack_qualified:
        result = {
            "outcome": "INCOMPLETE",
            "reason": (
                "Source/routing/semantic map qualification is incomplete; no city recommendation"
            ),
            "decision_authority": "NONE",
        }
    return {
        **base,
        **result,
        "eligibility": "ELIGIBLE" if pack_qualified else "BLOCKED_MAP_QUALIFICATION",
        "primary_pp": primary,
        "empty_change_percent": emp,
        "wait_p90_delta_s": wa,
        "zones": zones,
        "bootstrap": {
            "resamples": 2000,
            "seed": 20260929,
            "interval": 0.95,
            "unit": "paired seed mean",
            "does_not_cover": [
                "source gaps",
                "structural/model uncertainty",
                "real-world calibration",
                "joint guardrail confidence",
            ],
        },
    }
