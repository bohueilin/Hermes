#!/usr/bin/env python3
"""Read-only public byte verification. Hashes show consistency, not authenticity or authority."""

import argparse
import concurrent.futures
import datetime
import hashlib
import json
import subprocess
from pathlib import Path
from urllib.parse import quote, urlparse


def request(base, name):
    path = "/__fleetlab_missing_page__" if name == "404.html" else "/" + name
    if path.endswith("index.html"):
        path = path[:-10]
    elif path.endswith(".html"):
        path = path[:-5]
    url = base.rstrip("/") + quote(path, safe="/")
    result = subprocess.run(
        [
            "curl",
            "--silent",
            "--show-error",
            "--location",
            "--max-redirs",
            "3",
            "--max-time",
            "60",
            "--proto",
            "=https,http",
            "-H",
            "Accept-Encoding: identity",
            "-A",
            "FleetLabReleaseValidation/2.0",
            "-w",
            "\n%{http_code}",
            url,
        ],
        capture_output=True,
    )
    body, _, status = result.stdout.rpartition(b"\n")
    return {
        "status": status.decode(),
        "bytes": len(body),
        "sha256": hashlib.sha256(body).hexdigest(),
        "transport_ok": result.returncode == 0,
    }


def verify(base, records, workers=12):
    def check(item):
        name, expected = item
        actual = request(base, name)
        return {
            "path": name,
            **actual,
            "matches": actual["transport_ok"]
            and actual["status"] == str(expected.get("status", 200))
            and all(actual[k] == expected[k] for k in ("bytes", "sha256")),
        }

    with concurrent.futures.ThreadPoolExecutor(max_workers=workers) as pool:
        results = []
        for row in pool.map(check, records.items()):
            results.append(row)
            if len(results) % 500 == 0:
                print(
                    f"Read back {len(results)}/{len(records)}; "
                    f"mismatches {sum(not r['matches'] for r in results)}",
                    flush=True,
                )
    return {
        "url": base,
        "captured_at_utc": datetime.datetime.now(datetime.UTC).isoformat(),
        "matched": sum(r["matches"] for r in results),
        "total": len(results),
        "files": results,
    }


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--url", required=True)
    group = parser.add_mutually_exclusive_group(required=True)
    group.add_argument("--site", type=Path)
    group.add_argument("--record", type=Path, help="Committed small smoke record")
    parser.add_argument("--smoke", action="store_true")
    parser.add_argument("--output", type=Path, required=True)
    args = parser.parse_args()
    parsed = urlparse(args.url)
    if (
        parsed.scheme not in ("https", "http")
        or not parsed.netloc
        or parsed.query
        or parsed.fragment
    ):
        parser.error("expected an HTTP(S) site base URL")
    if args.site:
        manifest = json.loads((args.site.parent / "review/integration-manifest.json").read_text())
        records = {k: v for k, v in manifest["files"].items() if k != "_headers"}
        records["404.html"] = {**records["404.html"], "status": 404}
        if args.smoke:
            current = manifest["current"]["path"]
            names = [
                "index.html",
                "boot.js",
                current + "/index.html",
                current + "/data/catalog.json",
                "downloads/fleetlab-offline.html",
                "publication.json",
            ]
            records = {k: records[k] for k in names}
        for name, record in records.items():
            data = (args.site / name).read_bytes()
            if len(data) != record["bytes"] or hashlib.sha256(data).hexdigest() != record["sha256"]:
                raise ValueError("local stage differs from its manifest")
    else:
        records = json.loads(args.record.read_text())["files"]
    result = verify(args.url, records)
    args.output.write_text(json.dumps(result, indent=2) + "\n")
    print(json.dumps({k: v for k, v in result.items() if k != "files"}))
    if result["matched"] != result["total"]:
        print(
            "Mismatched public paths:",
            [r["path"] for r in result["files"] if not r["matches"]][:20],
        )
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
