"""Release header gate: HEAD each published path and compare it with the staged _headers policy.

Design rule: the /* block is the only security baseline. Pages matches path rules against the
raw request path but serves the file found at the decoded path, so a percent-encoded spelling
of any path gets only /*. Path rules may relax or annotate that baseline; never rely on one to
restrict.

Usage: check-headers.py SITE BASE_URL OUTPUT_JSON
"""

import datetime
import json
import subprocess
import sys
from pathlib import Path

import certifi

BASELINE = (
    "content-security-policy", "x-frame-options", "x-content-type-options", "permissions-policy",
)
ROUTES = ("capacity", "software-delivery", "delivery-order", "rebalancing", "dispatch")
BRAND = (
    "brand.mjs", "brand.css", "visitor.mjs", "visitor-families.mjs", "visitor.css",
    "enhancement-media.mjs", "enhancement-motion.mjs", "enhancement-media.css",
)
MEDIA = (
    "fleetlab-logo.png", "readiness.jpg", "shared-delivery.webp", "favicon.png",
    "apple-touch-icon.png", "fleetlab-logo-64.png", "fleetlab-logo-128.png",
    "r1-nf05.mp4", "r1-nf05.webp", "r1-nf06.mp4", "r1-nf06.webp",
)
DIAGRAMS = (
    "D-01-depot-scenario.webp", "D-02-crossed-priorities.webp",
    "D-03-staffing-queue.webp", "D-05-opportunity-cost.webp",
)


def fields(block):
    return {
        key.strip().lower(): value.strip()
        for line in block.splitlines()[1:]
        if ":" in line
        for key, value in [line.strip().split(":", 1)]
    }


def encoded(path):
    """The same path with its first letter percent-encoded, a spelling that only /* matches."""
    return "/%" + format(ord(path[1]), "02X") + path[2:]


def rows(site):
    """Every (path, expected headers, status) row for a staged site: canonical, then encoded."""
    text = (site / "_headers").read_text().strip()
    blocks = {block.split("\n", 1)[0]: fields(block) for block in text.split("\n\n")}
    root = blocks["/*"]
    missing = [name for name in BASELINE if name not in root]
    if missing:
        raise ValueError(f"/* lacks the security baseline: {', '.join(missing)}")
    city = {**root, **blocks["/city-explorer/*"]}
    selection = json.loads((site / "publication.json").read_text())
    current, rollback = selection["current"]["path"], selection["rollback"]["path"]
    package = json.loads((site / "downloads/teaching-package.json").read_text())
    source = package["source_offer"]["path"]
    manifest = json.loads((site.parent / "review/integration-manifest.json").read_text())
    checks = [
        ("/", root), ("/boot.js", root), ("/city-explorer/", city), (f"/{current}/", city),
        (f"/{current}/data/catalog.json", city), ("/city-explorer/sources/", city),
        ("/city-explorer/releases/", city), (f"/{rollback}/", {**city, **blocks[f"/{rollback}/*"]}),
        ("/downloads/fleetlab-offline", {**root, **blocks["/downloads/fleetlab-offline"]}),
        (f"/{source}", {**root, **blocks[f"/{source}"]}),
        ("/downloads/teaching-package.json",
         {**root, **blocks["/downloads/teaching-package.json"]}),
        ("/network-flows/capacity/visual.css", root),
        ("/network-flows/rebalancing/visual.css", root),
        ("/network-flows/fleet-day/", root), ("/src/ui/methodology-explainer.js", root),
        ("/network-flows/", root), ("/network-flows/ota-sharing/", root), ("/sitemap.xml", root),
        ("/network-flows/hub.css", root),
    ]
    for route in ROUTES:
        for name in ("", "boot.js", "release.json"):
            checks.append((f"/network-flows/{route}/{name}", root))
        if route != "capacity":
            checks.append((f"/src/runtime/{route}-worker.js", root))
    # The depot lab is a top-level hosted route with its own boot, sidecar and worker.
    checks += [(path, root) for path in (
        "/depot-readiness/", "/depot-readiness/boot.js", "/depot-readiness/release.json",
        "/depot-readiness/visual.css", "/src/runtime/depot-lab-worker.js",
    )]
    checks += [(f"/{name}", root) for name in BRAND]
    checks += [(f"/site-media/{name}", root) for name in MEDIA]
    checks += [(f"/diagrams/{name}", root) for name in DIAGRAMS]
    checks += [(f"/{name}", root) for name in manifest["files"] if name.startswith("tiles/")]
    checks += [(f"/{name}", root) for name in manifest["files"]
               if name.startswith("enhancement-media/")]
    result = [(path, expected, 200) for path, expected in checks]
    result.append(("/__fleetlab_missing_page__", {**root, "cache-control": "no-store"}, 404))
    missing_source = (
        "network-flows/sources/"
        + ("0" if not source.endswith("0" * 64 + ".json.gz") else "1") * 64 + ".json.gz"
    )
    for path in ("/network-flows/sources/", "/" + missing_source):
        result.append((path, {**root, "cache-control": "no-store", "content-type": "text/html",
                              "content-disposition": None}, 404))
    # Crafted spellings must still receive the root baseline; nothing stricter can be assumed.
    baseline = {name: root[name] for name in BASELINE}
    crafted = ["/city-explorer/", f"/{rollback}/", "/downloads/fleetlab-offline", f"/{source}"]
    result += [(encoded(path), baseline, 200) for path in crafted]
    result.append(("/downloads/fleetlab%2Doffline", baseline, 200))
    return result


def curl_head(url):
    """(transport ok, status, final response headers); --path-as-is keeps the spelling sent."""
    response = subprocess.run(
        ["curl", "--cacert", certifi.where(), "--silent", "--show-error", "--head",
         "--path-as-is", "--location",
         "--max-redirs", "3", "--max-time", "60", "-w", "\n%{http_code}", url],
        capture_output=True, text=True,
    )
    header_text, _, status = response.stdout.rpartition("\n")
    section = header_text.strip().replace("\r\n", "\n").split("\n\n")[-1]
    return response.returncode == 0, status, fields(section)


def check(base, checks, head=curl_head):
    report = []
    for path, expected, status in checks:
        transport_ok, actual_status, actual = head(base.rstrip("/") + path)
        mismatches = {
            key: {"expected": value, "actual": actual.get(key)}
            for key, value in expected.items()
            if (actual.get(key, "").split(";", 1)[0].strip().lower()
                if key == "content-type" and value is not None else actual.get(key)) != value
        }
        report.append({
            "path": path, "status": actual_status, "transport_ok": transport_ok,
            "matches": transport_ok and not mismatches and actual_status == str(status),
            "mismatches": mismatches, "headers": actual,
        })
    return report


def main(argv):
    site, base, output = Path(argv[1]), argv[2], Path(argv[3])
    report = check(base, rows(site))
    result = {
        "url": base,
        "captured_at_utc": datetime.datetime.now(datetime.UTC).isoformat(),
        "total": len(report),
        "matched": sum(row["matches"] for row in report),
        "checks": report,
    }
    output.write_text(json.dumps(result, indent=2) + "\n")
    print(json.dumps({key: value for key, value in result.items() if key != "checks"}))
    for row in report:
        if not row["matches"]:
            print(json.dumps(row))
    return 0 if result["matched"] == result["total"] else 1


if __name__ == "__main__":
    sys.exit(main(sys.argv))
