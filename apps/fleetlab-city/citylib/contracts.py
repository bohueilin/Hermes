"""Canonical, bounded local teaching artifacts. Hashes do not authenticate producers."""

import hashlib
import json
import math
import os
import re
from pathlib import Path

SCHEMAS = {
    f"fleetlab.{name}/1.0.0"
    for name in (
        "city-pack",
        "city-scenario",
        "city-run",
        "city-metrics",
        "city-comparison",
        "generated-explanation",
    )
}
MAX_BYTES = 256 * 1024 * 1024


def canonical(value):
    return json.dumps(
        value, ensure_ascii=False, sort_keys=True, separators=(",", ":"), allow_nan=False
    ).encode("utf-8")


def digest(value):
    return hashlib.sha256(canonical(value)).hexdigest()


def sha(data):
    return hashlib.sha256(data).hexdigest()


def _pairs(pairs):
    result = {}
    for key, value in pairs:
        if key in result:
            raise ValueError(f"duplicate JSON key: {key}")
        result[key] = value
    return result


def decode(data):
    def invalid(value):
        raise ValueError(f"nonfinite number: {value}")

    return json.loads(data, object_pairs_hook=_pairs, parse_constant=invalid)


def read_bytes(path, max_bytes=MAX_BYTES):
    path = Path(path)
    if path.is_symlink() or any(p.is_symlink() for p in path.parents):
        raise ValueError("symlink refused")
    try:
        fd = os.open(path, os.O_RDONLY | os.O_NOFOLLOW)
    except OSError as exc:
        raise ValueError(f"cannot capture {path.name}: {exc.strerror}") from exc
    with os.fdopen(fd, "rb") as stream:
        before = os.fstat(stream.fileno())
        if before.st_size > max_bytes:
            raise ValueError("artifact exceeds size bound")
        data = stream.read(max_bytes + 1)
        after = os.fstat(stream.fileno())
    fields = ("st_ino", "st_dev", "st_size", "st_mtime_ns", "st_ctime_ns")
    if len(data) > max_bytes or any(getattr(before, f) != getattr(after, f) for f in fields):
        raise ValueError("artifact changed during capture")
    return data


def load_json(path, max_bytes=MAX_BYTES):
    return decode(read_bytes(path, max_bytes))


def save_json(path, data):
    path = Path(path)
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_bytes(canonical(data) + b"\n")


def _name(name):
    if not re.fullmatch(r"[A-Za-z0-9][A-Za-z0-9_.-]*\.json", name) or name == "manifest.json":
        raise ValueError("unsafe artifact filename")


def write_bundle(path, schema, files, metadata=None):
    if schema not in SCHEMAS:
        raise ValueError("unsupported schema")
    for name in files:
        _name(name)
    path = Path(path)
    path.mkdir(parents=True, exist_ok=False)
    inventory = {}
    for name, value in sorted(files.items()):
        data = canonical(value) + b"\n"
        (path / name).write_bytes(data)
        inventory[name] = {"sha256": sha(data), "bytes": len(data)}
    manifest = {
        "schema": schema,
        "files": inventory,
        "metadata": metadata or {},
        "scope": "SIMULATION_ONLY",
        "evidence": "NOT_EVIDENCE",
        "authenticity": "NOT_AUTHENTICATED",
        "decision_authority": "NONE",
    }
    manifest["content_digest"] = digest(manifest)
    save_json(path / "manifest.json", manifest)
    return manifest


def read_bundle(path):
    path = Path(path)
    manifest_bytes = read_bytes(path / "manifest.json", 1024 * 1024)
    manifest = decode(manifest_bytes)
    if manifest.get("schema") not in SCHEMAS:
        raise ValueError("unsupported schema")
    claimed = manifest.get("content_digest")
    if claimed != digest({k: v for k, v in manifest.items() if k != "content_digest"}):
        raise ValueError("manifest digest mismatch")
    inventory = manifest.get("files")
    if not isinstance(inventory, dict) or len(inventory) > 1024:
        raise ValueError("invalid bundle inventory")
    out = {"manifest.json": manifest}
    for name, record in inventory.items():
        _name(name)
        data = read_bytes(path / name)
        if len(data) != record["bytes"] or sha(data) != record["sha256"]:
            raise ValueError(f"digest/size mismatch: {name}")
        out[name] = decode(data)
        if isinstance(out[name], dict) and str(out[name].get("schema", "")).split("/")[0] in {
            s.split("/")[0] for s in SCHEMAS
        }:
            validate_document(out[name])
    if read_bytes(path / "manifest.json") != manifest_bytes:
        raise ValueError("manifest changed during capture")
    return out


def finite(value, minimum=None, maximum=None):
    if isinstance(value, bool) or not isinstance(value, (int, float)) or not math.isfinite(value):
        raise ValueError("expected finite number")
    if minimum is not None and value < minimum or maximum is not None and value > maximum:
        raise ValueError("number outside allowed range")
    return value


def validate_document(value):
    """Structural v1 boundary; semantic invariants belong to the event verifier."""
    from jsonschema import Draft202012Validator

    schema = value.get("schema")
    if schema not in SCHEMAS:
        raise ValueError("unsupported document schema")
    name = schema.split("/")[0].removeprefix("fleetlab.")
    definition = load_json(
        Path(__file__).resolve().parents[1] / "schemas" / f"{name}-v1.schema.json"
    )
    try:
        canonical(value)  # JSON Schema number alone would admit NaN in Python.
        Draft202012Validator(definition).validate(value)
    except Exception as exc:
        raise ValueError(f"{schema}: invalid document structure") from exc
    return value
