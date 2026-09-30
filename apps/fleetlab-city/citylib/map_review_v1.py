"""Bounded, checkpoint-bound review projection; no identity authentication or road authority.

All captures are embedded UTF-8 text. There is deliberately no external path resolver.
The caller supplies frozen requirements and an independently retained history checkpoint.
"""

import re
from datetime import datetime

from .contracts import canonical, digest, load_json, sha

FIELDS = ("observations", "resolutions", "captures")
GATES = ("source_accounting", "class_budgets", "district_scope", "continuity")
METHODS = {"human source inspection", "automated reconciliation", "field observation"}
DISPOSITIONS = {"SOURCE_CONFIRMED", "SOURCE_CONFLICT", "UNRESOLVED", "NOT_REVIEWED"}
LIMIT = 4096


def require(condition, message):
    if not condition:
        raise ValueError(message)


def text(value, name, limit=20000):
    require(isinstance(value, str) and 0 < len(value) <= limit, f"invalid {name}")
    return value


def timestamp(value):
    text(value, "timestamp", 64)
    try:
        parsed = datetime.fromisoformat(value)
    except ValueError as exc:
        raise ValueError("invalid timestamp") from exc
    require(parsed.tzinfo is not None, "timestamp must include timezone")


def identity(value):
    require(
        isinstance(value, dict) and set(value) == {"pack", "graph", "checklist", "sources"},
        "invalid candidate identity",
    )
    for item in value.values():
        require(
            isinstance(item, str) and re.fullmatch(r"[0-9a-f]{64}", item),
            "invalid candidate digest",
        )


def indexed(items, label):
    require(isinstance(items, list) and len(items) <= LIMIT, f"unbounded {label}")
    result = {}
    for item in items:
        require(isinstance(item, dict), f"invalid {label} record")
        key = text(item.get("id"), "id", 200)
        require(key not in result, f"duplicate {label} ID")
        result[key] = item
    return result


def evidence(record, captures):
    refs = record.get("evidence")
    require(
        isinstance(refs, list) and 0 < len(refs) <= 100, "missing or unbounded captured evidence"
    )
    require(all(isinstance(x, str) and x in captures for x in refs), "missing capture")
    require(len(set(refs)) == len(refs), "duplicate capture reference")


def common_record(record, candidate, obligations, captures):
    require(record.get("candidate") == candidate, "stale candidate")
    require(record.get("source_snapshot") == candidate["sources"], "stale source snapshot")
    require(
        isinstance(record.get("claim"), str) and record["claim"] in obligations,
        "unknown frozen obligation",
    )
    timestamp(record.get("timestamp"))
    text(record.get("rationale"), "rationale")
    text(record.get("interpretation"), "interpretation")
    evidence(record, captures)


def validate_review(path, requirements, expected_checkpoint, gate_evidence):
    """Reject malformed records with the same validation error as semantic failures."""
    try:
        return _validate_review(path, requirements, expected_checkpoint, gate_evidence)
    except (TypeError, KeyError, RecursionError, OverflowError) as exc:
        raise ValueError("malformed or excessively nested review data") from exc


def _validate_review(path, requirements, expected_checkpoint, gate_evidence):
    """Return a derived envelope; malformed/stale/mutated input raises ValueError.

    Claimed human identities remain unauthenticated. Automation must declare itself.
    This function cannot discover a dishonest external producer's true identity.
    Gate evidence is supplied by the qualification core, never an observation/UI.
    """
    require(isinstance(requirements, dict), "invalid requirements")
    require(
        requirements.get("schema") == "fleetlab.map-review-requirements/1.0.0",
        "unsupported requirements schema",
    )
    identity(requirements.get("candidate"))
    obligations = indexed(requirements.get("obligations"), "obligations")
    require(bool(obligations), "empty requirement population")
    samples = indexed(requirements.get("samples"), "samples")
    for sample in samples.values():
        require(sample.get("kind") in {"segment", "junction", "od"}, "invalid required sample")
        require(sample.get("claim") in obligations, "unknown sample obligation")
        text(sample.get("stratum"), "sample stratum", 200)
    strata = requirements.get("required_strata")
    require(
        isinstance(strata, list)
        and bool(strata)
        and len(strata) <= 100
        and all(isinstance(s, str) and s for s in strata),
        "invalid required strata",
    )
    require(len(set(strata)) == len(strata), "duplicate required stratum")
    for rule in obligations.values():
        roles = rule.get("resolver_roles")
        require(
            isinstance(roles, list)
            and bool(roles)
            and all(isinstance(x, str) and x for x in roles),
            "missing resolver-role rule",
        )
        require(
            type(rule.get("independent_resolution")) is bool, "missing independent-resolution rule"
        )
    doc = load_json(path, 16 * 1024 * 1024)
    require(
        isinstance(doc, dict) and doc.get("schema") == "fleetlab.map-review-history/1.0.0",
        "unsupported review history schema",
    )
    candidate = requirements["candidate"]
    require(doc.get("candidate") == candidate, "stale candidate")
    require(doc.get("requirements_digest") == digest(requirements), "stale requirements")
    inventories = {field: indexed(doc.get(field), field) for field in FIELDS}
    manifests = doc.get("manifests")
    require(
        isinstance(manifests, list) and 0 < len(manifests) <= 128,
        "missing or unbounded manifest chain",
    )
    prior = None
    first_seen = {field: set() for field in FIELDS}
    for manifest in manifests:
        require(
            isinstance(manifest, dict) and set(manifest) == {*FIELDS, "previous"},
            "invalid manifest",
        )
        require(
            manifest["previous"] == (digest(prior) if prior else None),
            "broken manifest predecessor",
        )
        for field in FIELDS:
            entries = manifest[field]
            require(isinstance(entries, list) and len(entries) <= LIMIT, "unbounded manifest")
            if prior:
                require(entries[: len(prior[field])] == prior[field], "history prefix changed")
            keys = []
            for entry in entries:
                require(
                    isinstance(entry, dict) and set(entry) == {"id", "digest"},
                    "invalid manifest reference",
                )
                key = entry["id"]
                require(isinstance(key, str) and key in inventories[field], "missing record")
                require(entry["digest"] == digest(inventories[field][key]), "record mutation")
                keys.append(key)
            require(len(set(keys)) == len(keys), "duplicate manifest ID")
        visible_observations = {entry["id"] for entry in manifest["observations"]}
        visible_captures = {entry["id"] for entry in manifest["captures"]}
        for field in ("observations", "resolutions"):
            for entry in manifest[field]:
                if entry["id"] in first_seen[field]:
                    continue
                record = inventories[field][entry["id"]]
                refs = record.get("evidence")
                require(
                    isinstance(refs, list)
                    and all(isinstance(x, str) for x in refs)
                    and set(refs).issubset(visible_captures),
                    "future capture reference",
                )
                if field == "resolutions":
                    refs = record.get("observations")
                    require(
                        isinstance(refs, list)
                        and all(isinstance(x, dict) and isinstance(x.get("id"), str) for x in refs)
                        and {x["id"] for x in refs}.issubset(visible_observations),
                        "future observation reference",
                    )
                first_seen[field].add(entry["id"])
        prior = manifest
    for field in FIELDS:
        require(
            [x["id"] for x in prior[field]] == list(inventories[field]),
            "manifest inventory/order mismatch",
        )
    checkpoint = digest(prior)
    require(
        expected_checkpoint is None or expected_checkpoint == checkpoint,
        "expected checkpoint mismatch",
    )
    captures = inventories["captures"]
    for capture in captures.values():
        require(
            set(capture) == {"id", "url", "revision", "text", "sha256"},
            "invalid embedded capture; paths are not supported",
        )
        url = text(capture["url"], "capture URL", 2048)
        require(url.startswith("https://"), "invalid capture URL")
        text(capture["revision"], "captured revision", 256)
        captured_text = text(capture["text"], "capture text", 1024 * 1024)
        require(sha(captured_text.encode("utf-8")) == capture["sha256"], "capture digest mismatch")
    observed = {key: [] for key in obligations}
    segment_samples, od_samples, inspected_strata = set(), set(), set()
    for record in inventories["observations"].values():
        require(
            record.get("schema") == "fleetlab.map-review-result/1.0.0",
            "unsupported observation schema",
        )
        common_record(record, candidate, obligations, captures)
        reviewer = record.get("reviewer")
        require(isinstance(reviewer, dict), "invalid reviewer")
        text(reviewer.get("id"), "reviewer ID", 200)
        text(reviewer.get("role"), "reviewer role", 200)
        require(reviewer.get("kind") in {"HUMAN", "AUTOMATION"}, "invalid reviewer kind")
        require(record.get("method") in METHODS, "unsupported review method")
        human = record["method"] in {"human source inspection", "field observation"}
        require(not human or reviewer["kind"] == "HUMAN", "automation mislabeled as human")
        require(record.get("disposition") in DISPOSITIONS, "invalid disposition")
        require(
            record.get("sample_type") in {"segment", "junction", "od", "exception"},
            "invalid sample type",
        )
        text(record.get("feature"), "source feature", 200)
        text(record.get("stratum"), "stratum", 200)
        text(record.get("proposed_action"), "proposed action")
        observed[record["claim"]].append(record)
        if human and record["disposition"] == "SOURCE_CONFIRMED":
            if record["sample_type"] != "exception":
                sample = samples.get(record["feature"])
                require(
                    sample is not None
                    and sample["kind"] == record["sample_type"]
                    and sample["claim"] == record["claim"]
                    and sample["stratum"] == record["stratum"],
                    "human sample is outside frozen sampling requirements",
                )
            if record["sample_type"] in {"segment", "junction"}:
                segment_samples.add(record["feature"])
                inspected_strata.add(record["stratum"])
            elif record["sample_type"] == "od":
                od_samples.add(record["feature"])
    resolutions = {key: [] for key in obligations}
    for record in inventories["resolutions"].values():
        require(
            record.get("schema") == "fleetlab.map-review-resolution/1.0.0",
            "unsupported resolution schema",
        )
        common_record(record, candidate, obligations, captures)
        resolver = record.get("resolver")
        require(isinstance(resolver, dict), "invalid resolver")
        text(resolver.get("id"), "resolver ID", 200)
        rule = obligations[record["claim"]]
        require(resolver.get("role") in rule["resolver_roles"], "unauthorized resolver role")
        require(resolver.get("kind") in {"HUMAN", "AUTOMATION"}, "invalid resolver kind")
        refs = record.get("observations")
        require(isinstance(refs, list) and 0 < len(refs) <= LIMIT, "missing conflict references")
        ids = []
        for ref in refs:
            require(
                isinstance(ref, dict) and set(ref) == {"id", "digest"},
                "invalid observation reference",
            )
            original = inventories["observations"].get(ref["id"])
            require(
                original is not None
                and original["claim"] == record["claim"]
                and ref["digest"] == digest(original),
                "foreign resolution reference",
            )
            ids.append(ref["id"])
            if rule["independent_resolution"]:
                require(
                    resolver["id"] != original["reviewer"]["id"] and resolver["kind"] == "HUMAN",
                    "independent resolver required",
                )
        require(len(set(ids)) == len(ids), "duplicate resolution reference")
        require(
            any(
                o["interpretation"] == record["interpretation"]
                and o["disposition"] == "SOURCE_CONFIRMED"
                for o in observed[record["claim"]]
            ),
            "unsupported resolution interpretation",
        )
        text(record.get("uncertainty"), "remaining uncertainty")
        resolutions[record["claim"]].append((record, set(ids)))
    states = {}
    for claim, rows in observed.items():
        confirmed = [o for o in rows if o["disposition"] == "SOURCE_CONFIRMED"]
        conflict = any(o["disposition"] == "SOURCE_CONFLICT" for o in rows)
        conflict |= len({o["interpretation"] for o in confirmed}) > 1
        complete_ids = {o["id"] for o in rows}
        resolved = [r for r, refs in resolutions[claim] if refs == complete_ids]
        if len({r["interpretation"] for r in resolved}) > 1:
            resolved = []
            conflict = True
        if conflict:
            states[claim] = "SOURCE_CONFIRMED" if resolved else "CONFLICT"
        elif any(o["disposition"] == "UNRESOLVED" for o in rows):
            states[claim] = "UNRESOLVED"
        else:
            states[claim] = "SOURCE_CONFIRMED" if confirmed else "NOT_REVIEWED"
    reasons = []
    if expected_checkpoint is None:
        reasons.append("No independently retained history checkpoint")
    if len(segment_samples) < 200 or len(od_samples) < 100:
        reasons.append("Required human inspection: at least 200 unique features and 100 OD cases")
    if not set(samples).issubset(segment_samples | od_samples):
        reasons.append("Frozen mandatory sample coverage incomplete")
    if not set(strata).issubset(inspected_strata):
        reasons.append("Required human strata incomplete")
    if any(state != "SOURCE_CONFIRMED" for state in states.values()):
        reasons.append("Source obligations unresolved")
    require(isinstance(gate_evidence, dict), "invalid external gate evidence")
    for gate in GATES:
        if gate_evidence.get(gate) != "PASS":
            reasons.append(f"{gate}: {gate_evidence.get(gate, 'NOT_RUN')}")
    # Verify bounded canonical encoding even for caller-owned requirements/gates.
    require(len(canonical(requirements)) <= 2 * 1024 * 1024, "unbounded requirements")
    return {
        "schema": "fleetlab.map-review-envelope/1.0.0",
        "candidate": candidate,
        "requirements_digest": digest(requirements),
        "checkpoint": checkpoint,
        "integrity": "INTERNALLY_CONSISTENT",
        "history": "ANCHORED" if expected_checkpoint else "UNANCHORED",
        "qualification": "PASS" if not reasons else "HOLD",
        "reasons": reasons,
        "obligations": states,
        "human_samples": {
            "segments": len(segment_samples),
            "od": len(od_samples),
            "strata": sorted(inspected_strata),
        },
        "authenticity": "NOT_AUTHENTICATED",
        "authorization": "NOT_EVALUATED",
        "deployment_permission": "NONE",
        "scope": "SIMULATION_ONLY",
    }
