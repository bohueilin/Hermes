"""Read-only fresh verification and complete-block, seed-paired power diagnostics."""

import math
import statistics
import time
from collections import defaultdict
from pathlib import Path

from .contracts import digest, load_json
from .power_protocol import ARM_IDS, check_resources
from .power_study import bound_spec, capture_arm, capture_study
from .verify import quantile


def classify_interval(low, high):
    if low > 1:
        return "MATERIAL_POSITIVE"
    if high < -1:
        return "MATERIAL_NEGATIVE"
    if low >= -1 and high <= 1:
        return "BOUNDED_SMALL"
    return "UNRESOLVED"


def paired_t_interval(values):
    if len(values) < 2 or any(v is None or not math.isfinite(v) for v in values):
        return None
    from scipy.stats import t

    mean = statistics.mean(values)
    half = float(t.ppf(0.975, len(values) - 1)) * statistics.stdev(values) / math.sqrt(len(values))
    low, high = mean - half, mean + half
    return {
        "mean": mean,
        "low": low,
        "high": high,
        "n": len(values),
        "unit": "percentage_points",
        "classification": classify_interval(low, high),
        "zero_excluded": low > 0 or high < 0,
        "method": "95% paired Student t interval; seed-level interaction; df=n-1",
    }


def primary_analysis(rows, seeds):
    expected = {(s, arm) for s in seeds for arm in ARM_IDS}
    actual = [(r["seed"], r["arm"]) for r in rows]
    reasons = []
    if len(set(seeds)) != len(seeds):
        reasons.append("Duplicate seed schedule")
    if set(actual) != expected or len(actual) != len(expected):
        reasons.append("Missing, duplicate or foreign six-arm block")
    if any(not r.get("eligible") for r in rows):
        reasons.append("Invalid, incomplete or hard-violation arm")
    if reasons:
        return None, reasons
    by_key = {(r["seed"], r["arm"]): r["metrics"] for r in rows}
    values = []
    for seed in seeds:
        metrics = [by_key[seed, arm] for arm in ARM_IDS]
        denominators = [m["created"] for m in metrics]
        if len(set(denominators)) != 1 or not denominators[0]:
            return None, ["Unavailable or mismatched created-request denominator"]
        # Integer-count difference avoids cancellation of completion fractions.
        counts = {arm: by_key[seed, arm]["completed"] for arm in ARM_IDS}
        values.append(
            100
            * ((counts["ab-400"] - counts["a-400"]) - (counts["ab-200"] - counts["a-200"]))
            / denominators[0]
        )
    result = paired_t_interval(values)
    if result is None:
        return None, ["Fewer than two complete seeds"]
    result["seed_interactions_pp"] = [
        {"seed": s, "value": v} for s, v in zip(seeds, values, strict=True)
    ]
    return result, []


def project_run(run, inputs):
    """Reduce verified event records; no routing, policy execution, or verdict logic."""
    horizon, spec = run["elapsed_s"], run["spec"]
    states = {v["id"]: ("idle", None, 0) for v in inputs["initial"]}
    minutes, site_minutes = defaultdict(float), defaultdict(lambda: defaultdict(float))
    sites = {
        s["id"]: {
            **s,
            "charge_starts": 0,
            "charge_ends": 0,
            "charged_kwh": 0.0,
            "allocated_energy_kwh": 0.0,
            "peak_allocated_kw": 0.0,
            "available_capacity_kwh": s["power_kw"] * horizon / 3600,
            "final_charge_queue": 0,
            "final_turnaround_queue": 0,
        }
        for s in spec["sites"]
    }
    # Exact clipped charge integration uses recorded leg distances and storage boundaries.
    energy = {
        v["id"]: {
            "initial": v["energy"],
            "distance": 0.0,
            "active": 0.0,
            "since": 0,
            "stored": False,
            "charged": 0.0,
            "power": 0.0,
            "power_at": 0,
            "site": None,
        }
        for v in inputs["initial"]
    }
    power_at = {s: (0, 0.0) for s in sites}
    checkpoints = {}
    open_pickups, closed_empty = {}, defaultdict(float)
    request_source = {r["id"]: r for r in inputs["requests"]}
    requests = {
        r["id"]: {
            "id": r["id"],
            "zone": r["zone"],
            "state": "not_created",
            "boarded_wait_s": None,
            "pickup_empty_km": 0.0,
        }
        for r in inputs["requests"]
    }
    violations, unreachable = [], []
    immobile = set(states)

    def integrate_charge(vid, t):
        v = energy[vid]
        if v["power"]:
            active = v["active"] + (0 if v["stored"] else v["power_at"] - v["since"])
            current = (
                v["initial"]
                - v["distance"] / 1000 * spec["drive_kwh_per_km"]
                - active / 3600 * spec["aux_kw"]
                + v["charged"]
            )
            added = max(
                0, min(v["power"] * (t - v["power_at"]) / 3600, spec["target_kwh"] - current)
            )
            v["charged"] += added
            sites[v["site"]]["charged_kwh"] += added
        v["power_at"] = t

    for e in run["events"]:
        t, kind, vid = e["t"], e["kind"], e.get("vehicle")
        if kind == "state":
            old, old_site, since = states[vid]
            dt = (t - since) / 60
            minutes[old] += dt
            site_minutes[old_site or "UNASSIGNED"][old] += dt
            states[vid] = (e["after"], e.get("site"), t)
        elif kind == "leg_start":
            if e["purpose"] == "pickup":
                open_pickups[vid] = e["request"]
            v = energy[vid]
            if v["stored"]:
                v.update(stored=False, since=t)
        elif kind == "leg_end":
            if states[vid][0] != "passenger":
                closed_empty[vid] += e["distance_m"]
            if vid in open_pickups:
                requests[open_pickups.pop(vid)]["pickup_empty_km"] += e["distance_m"] / 1000
            v = energy[vid]
            v["distance"] += e["distance_m"]
            if e["distance_m"] > 0:
                immobile.discard(vid)
            if states[vid][0] == "returning":
                v["active"] += t - v["since"]
                v["stored"] = True
        elif kind in ("charge_start", "charge_end"):
            sites[e["site"]]["charge_starts" if kind == "charge_start" else "charge_ends"] += 1
            if kind == "charge_end":
                integrate_charge(vid, t)
                energy[vid]["power"] = 0
        elif kind == "charge":
            site = e["site"]
            last, power = power_at[site]
            sites[site]["allocated_energy_kwh"] += power * (t - last) / 3600
            power_at[site] = (t, sum(e["powers_kw"]))
            sites[site]["peak_allocated_kw"] = max(
                sites[site]["peak_allocated_kw"], sum(e["powers_kw"])
            )
            for who, v in energy.items():
                if v["site"] == site:
                    integrate_charge(who, t)
                    v["power"] = 0
            for who, power in zip(e["vehicles"], e["powers_kw"], strict=True):
                energy[who].update(power=power, power_at=t, site=site)
        elif kind == "energy":
            checkpoints[vid] = e
            if e["distance_m"] > 0:
                immobile.discard(vid)
        elif kind in ("created", "assigned", "boarded", "completed", "unserved"):
            record = requests[e["request"]]
            record["state"] = {"created": "waiting", "boarded": "in_progress"}.get(kind, kind)
            if kind == "boarded":
                record["boarded_wait_s"] = t - request_source[e["request"]]["t"]
            if kind == "unserved" and e.get("reason") == "unreachable on supported graph":
                unreachable.append(e["request"])
        elif kind == "violation":
            violations.append(e)
    for vid, rid in open_pickups.items():
        requests[rid]["pickup_empty_km"] += (checkpoints[vid]["empty_m"] - closed_empty[vid]) / 1000
    for vid, (state, site, since) in states.items():
        dt = (horizon - since) / 60
        minutes[state] += dt
        site_minutes[site or "UNASSIGNED"][state] += dt
        if state in ("queue_charge", "queue_turnaround"):
            sites[site][
                "final_charge_queue" if state == "queue_charge" else "final_turnaround_queue"
            ] += 1
        integrate_charge(vid, horizon)
    for site, (last, power) in power_at.items():
        item = sites[site]
        item["allocated_energy_kwh"] += power * (horizon - last) / 3600
        item["unused_capacity_kwh"] = item["available_capacity_kwh"] - item["charged_kwh"]
        item["mean_used_kw"] = item["charged_kwh"] * 3600 / horizon if horizon else None
        item["mean_unused_kw"] = item["power_kw"] - item["mean_used_kw"] if horizon else None
    zones = {
        z: {"created": 0, "completed": 0, "states": {}}
        for z in sorted(set(inputs["zones"].values()) | {"UNASSIGNED"})
    }
    for row in requests.values():
        if row["state"] != "not_created":
            z = zones.setdefault(row["zone"], {"created": 0, "completed": 0, "states": {}})
            z["created"] += 1
            z["completed"] += row["state"] == "completed"
            z["states"][row["state"]] = z["states"].get(row["state"], 0) + 1
    waits = [r["boarded_wait_s"] for r in requests.values() if r["boarded_wait_s"] is not None]
    created = sum(r["state"] != "not_created" for r in requests.values())
    empty = sum(e["empty_m"] for e in checkpoints.values()) / 1000
    return {
        "state_minutes": dict(minutes),
        "state_minutes_by_site": {s: dict(m) for s, m in site_minutes.items()},
        "sites": sites,
        "request_states": {
            s: sum(r["state"] == s for r in requests.values())
            for s in ("not_created", "waiting", "assigned", "in_progress", "completed", "unserved")
        },
        "zones": zones,
        "requests": list(requests.values()),
        "empty_km_per_created_request": empty / created if created else None,
        "boarded_wait": {
            "population": "conditional on boarding under this treatment",
            "n": len(waits),
            "p50_s": quantile(waits, 0.5),
            "p90_s": quantile(waits, 0.9),
        },
        "reachability": {
            "unreachable_requests": len(unreachable),
            "request_ids": unreachable,
            "immobile_vehicle_count": len(immobile),
            "immobile_vehicle_ids": sorted(immobile),
            "stranded_at_horizon": sum(s[0] == "stranded" for s in states.values()),
            "definition": (
                "immobile means zero recorded distance; not proof of route unreachability"
            ),
        },
        "violations": violations,
    }


def artifact_stamp(path):
    """Detect replacement/mutation through end of a read-only review session."""
    records = {}
    for item in Path(path).iterdir():
        if item.is_symlink() or not item.is_file():
            raise ValueError("symlink or foreign entry in arm directory")
        stat = item.stat()
        records[item.name] = (
            stat.st_dev,
            stat.st_ino,
            stat.st_size,
            stat.st_mtime_ns,
            stat.st_ctime_ns,
        )
    return records


def secondary_analysis(rows, seeds):
    by_key = {(r["seed"], r["arm"]): r for r in rows}

    def interval(values, unit):
        result = paired_t_interval(values)
        if result is not None:
            result.pop("classification")
            result.update(
                unit=unit, method="95% paired Student t interval across seed diagnostics; df=n-1"
            )
        return result

    results = []
    for power in (200, 400):
        for layout in ("ab", "b"):
            reference, candidate = f"a-{power}", f"{layout}-{power}"
            completion, empty, boarded, common = [], [], [], []
            matched_counts = []
            for seed in seeds:
                a, b = by_key[seed, reference], by_key[seed, candidate]
                am, bm = a["metrics"], b["metrics"]
                completion.append(100 * (bm["completed"] - am["completed"]) / am["created"])
                ae, be = am["empty_km_per_completed"], bm["empty_km_per_completed"]
                empty.append(100 * (be / ae - 1) if ae and be is not None else None)
                aw, bw = am["wait_p90_s"], bm["wait_p90_s"]
                boarded.append(bw - aw if aw is not None and bw is not None else None)
                ar = {r["id"]: r for r in a["diagnostics"]["requests"] if r["state"] == "completed"}
                br = {r["id"]: r for r in b["diagnostics"]["requests"] if r["state"] == "completed"}
                matched = sorted(ar.keys() & br.keys())
                matched_counts.append({"seed": seed, "n": len(matched)})
                common.append(
                    statistics.mean(
                        br[r]["boarded_wait_s"] - ar[r]["boarded_wait_s"] for r in matched
                    )
                    if matched
                    else None
                )
            results.append(
                {
                    "reference": reference,
                    "candidate": candidate,
                    "role": "secondary; cannot replace A reference or primary interaction",
                    "completion_delta_pp": interval(completion, "percentage_points"),
                    "empty_per_completed_change_percent": interval(empty, "percent"),
                    "boarded_wait_p90_delta_s": interval(boarded, "seconds"),
                    "common_completed_wait": {
                        "population": "conditional on completed in both arms; treatment-dependent",
                        "matched_counts": matched_counts,
                        "mean_delta_s": interval(common, "seconds"),
                    },
                    "historical_guardrails": {
                        "version": "fleetlab.city-comparison/1.0.0",
                        "empty_change_allowance_percent": 10,
                        "boarded_wait_allowance_s": 60,
                        "zone_delta_floor_pp": -5,
                        "zone_min_n": 30,
                        "status": "DESCRIPTIVE_ONLY; no simultaneous coverage or qualification",
                    },
                    "unavailable": (
                        "Null interval means a conditional population/denominator "
                        "is unavailable in at least one seed"
                    ),
                }
            )
    return results


def analyze_study(root: Path, frozen: Path, mode: str) -> dict:
    if mode not in ("preflight", "evaluate"):
        raise ValueError("invalid mode")
    start = time.monotonic()
    protocol, tapes, pack = capture_study(root, frozen)
    path = Path(frozen) / mode
    seeds = protocol["seeds"][mode]
    rows, reasons, run_set = [], [], []
    ledger_digests = {}
    snapshots = {}
    expected_names = {f"{seed}-{arm}" for seed in seeds for arm in ARM_IDS}
    if not path.is_dir() or path.is_symlink():
        reasons.append("Mode execution is missing")
        names = set()
    else:
        names = {p.name for p in path.iterdir()}
        if names - expected_names - {"started.json", "execution.json"}:
            reasons.append("Foreign or duplicate run inventory")
        if names & expected_names != expected_names:
            reasons.append("Incomplete run inventory")
        try:
            execution = load_json(path / "execution.json")
            started = load_json(path / "started.json")
            if (
                execution["status"] != "COMPLETE"
                or execution["protocol_digest"] != protocol["protocol_digest"]
                or started["protocol_digest"] != protocol["protocol_digest"]
                or execution["mode"] != mode
            ):
                reasons.append("Execution failed, partial or protocol-mismatched")
            ledger_digests = {(r["seed"], r["arm"]): r["run_digest"] for r in execution["arms"]}
            scheduled = [(s, a) for s in seeds for a in ARM_IDS]
            if [(r["seed"], r["arm"]) for r in execution["arms"]] != scheduled:
                reasons.append("Execution ledger differs from full schedule")
        except (ValueError, KeyError, TypeError):
            reasons.append("Missing or invalid execution ledger")
    for seed in seeds:
        for arm in ARM_IDS:
            row = {
                "seed": seed,
                "arm": arm,
                "layout": arm.split("-")[0].upper(),
                "total_power_kw": int(arm.split("-")[1]),
                "input_digest": protocol["input_digests"][str(seed)],
                "run_digest": None,
                "verification": "NOT_AVAILABLE",
                "eligible": False,
                "violations": [],
                "metrics": None,
                "diagnostics": None,
            }
            if f"{seed}-{arm}" in names:
                try:
                    check_resources(protocol["limits"]["estimated_route_table_bytes"])
                    arm_path = path / f"{seed}-{arm}"
                    before = artifact_stamp(arm_path)
                    captured, verification = capture_arm(
                        arm_path, tapes[seed], pack, bound_spec(protocol, arm), protocol
                    )
                    if before != artifact_stamp(arm_path):
                        raise ValueError("arm changed during capture/verification")
                    snapshots[arm_path] = before
                    run = captured["run.json"]
                    row.update(
                        run_digest=digest(run),
                        verification=verification["verification"],
                        eligible=verification["recommendation_eligible"],
                        violations=verification["violations"],
                        findings=verification["findings"],
                        metrics=verification["metrics"] if verification["valid"] else None,
                    )
                    if verification["valid"]:
                        row["diagnostics"] = project_run(run, tapes[seed])
                    if ledger_digests.get((seed, arm)) != row["run_digest"]:
                        reasons.append("Execution ledger run digest differs from captured arm")
                    run_set.append(
                        {
                            "seed": seed,
                            "arm": arm,
                            "run_digest": row["run_digest"],
                            "bundle_digest": captured["manifest.json"]["content_digest"],
                        }
                    )
                except (ValueError, KeyError, TypeError, OSError) as exc:
                    row.update(verification="INVALID", error=str(exc))
            rows.append(row)
            # Summaries own their values; release raw records before the next capture.
            captured = run = None
    primary, invalid = primary_analysis(rows, seeds)
    reasons.extend(invalid)
    if reasons:
        primary = None
    cells, zones = [], []
    for arm in ARM_IDS:
        group = [r for r in rows if r["arm"] == arm and r["metrics"] is not None]
        cells.append(
            {
                "arm": arm,
                "available_seeds": len(group),
                "expected_seeds": len(seeds),
                "created": sum(r["metrics"]["created"] for r in group) if group else None,
                "completed": sum(r["metrics"]["completed"] for r in group) if group else None,
            }
        )
        for zone in sorted(set(protocol["zones"].values()) | {"UNASSIGNED"}):
            available = [
                r["diagnostics"]["zones"].get(zone, {"created": 0, "completed": 0})
                for r in group
                if r["diagnostics"]
            ]
            zones.append(
                {
                    "arm": arm,
                    "zone": zone,
                    "created": sum(z["created"] for z in available) if available else None,
                    "completed": sum(z["completed"] for z in available) if available else None,
                    "uncertainty": (
                        "Descriptive pooled counts; no simultaneous "
                        "or map/model uncertainty coverage"
                    ),
                }
            )
    for arm_path, stamp in snapshots.items():
        if artifact_stamp(arm_path) != stamp:
            raise ValueError("arm mutated during analysis")
    # Re-capture frozen inputs/identity at the end to invalidate concurrent mutation.
    # These large inputs have no remaining consumers; retain only the fresh protocol.
    del pack, tapes
    after = capture_study(root, frozen)[0]
    if after != protocol:
        raise ValueError("study mutated during analysis")
    return {
        "schema": "fleetlab.power-analysis/1.0.0",
        "id": protocol["id"],
        "protocol_digest": protocol["protocol_digest"],
        "pack_digest": protocol["pack_digest"],
        "model": protocol["model"],
        "mode": mode,
        "seeds": seeds,
        "arms": rows,
        "run_set": run_set,
        "run_set_digest": digest(run_set),
        "cells": cells,
        "zones": zones,
        "primary": primary,
        "secondary": secondary_analysis(rows, seeds) if not reasons else [],
        "metric_directions": {
            "completion_fraction": "higher beneficial",
            "unserved_fraction": "higher adverse",
            "empty_km_per_created_request": "higher adverse",
            "boarded_wait_s": "higher adverse; conditional",
        },
        "analysis_status": "COMPLETE" if not reasons else "INCOMPLETE",
        "reasons": sorted(set(reasons)),
        "map_eligibility": "BLOCKED_MAP_QUALIFICATION",
        "decision_authority": "NONE",
        "scope": "SIMULATION_ONLY",
        "authenticity": "NOT_AUTHENTICATED",
        "verification_and_analysis_s": time.monotonic() - start,
    }
