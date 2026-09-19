#!/usr/bin/env python3
"""Fetch the checked-in bounded queries; cached raw responses are never published."""

import argparse
import hashlib
import json
import urllib.parse
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
HERE = Path(__file__).parent
CACHE = ROOT / "artifacts/street-map"
ENDPOINT = "https://overpass-api.de/api/interpreter"


def fetch(name):
    query = (HERE / f"{name}-query.txt").read_text()
    request = urllib.request.Request(
        ENDPOINT,
        data=urllib.parse.urlencode({"data": query}).encode(),
        headers={"User-Agent": "HermesFleetLabStreetExtract/1.0"},
    )
    with urllib.request.urlopen(request, timeout=120) as response:
        raw = response.read(40_000_001)
    if len(raw) > 40_000_000:
        raise ValueError("Response exceeds 40 MB source bound")
    data = json.loads(raw)
    if data.get("remark"):
        raise ValueError(data["remark"])
    CACHE.mkdir(parents=True, exist_ok=True)
    (CACHE / f"{name}.json").write_bytes(raw)
    print(
        name,
        len(raw),
        "bytes",
        len(data["elements"]),
        "elements",
        data.get("osm3s"),
        hashlib.sha256(raw).hexdigest(),
    )


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("name", choices=["downtown", "corridors"])
    fetch(parser.parse_args().name)
