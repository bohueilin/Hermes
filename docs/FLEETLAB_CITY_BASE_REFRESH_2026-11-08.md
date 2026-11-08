# FleetLab City base refresh — November 8, 2026

Provenance record for the `base_release` pin in `apps/fleetlab-city/deploy/approved-inputs.json`.

## Why

The release recipe builds the hosted City explorer from a pinned City base generation. It never rebuilds the viewer from `apps/fleetlab-city/web/`. The Phase 2 design-audit edits to `web/style.css` and `web/city-map.mjs` therefore never reached the 4b039be release. Those edits are the forest-green depot markers and legend swatch, the green flat-map fallback squares, and the tighter initial atlas camera. Live verification on November 8 found the markers still red. On November 8 the owner chose to derive a new base rather than override the colours in hosted CSS.

## What changed

The script under Reproduce copies the previous base and replaces only `style.css` and `city-map.mjs` with the current `web/` files. It regenerates their gzip twins with the same producer as the original generation, which it reproduces byte-for-byte. It also records the previous manifest digest as `presentation_refresh_of`. It refuses any other changed path and checks that the source generation is unmodified. It is kept here rather than in `apps/fleetlab-city/tools/`, because files there count toward the exact integration-source byte ceiling.

| | Release manifest SHA-256 |
|---|---|
| Previous base | `c56bda6b509105c5bee778980c01d13028401bc03fc8b49b4948f65c6f18f63f` |
| Refreshed base | `8610d83314372a4ce311c807f6ea9aca1904f2b61bb7304dd8456654a50d8c01` |

The build's City base inventory digest, pinned as `INPUT_DIGESTS.city_base` in `apps/fleetlab-city/test/stage-check.mjs`, changes from `4fa335d226090aae63350a50f3af481d91df3f16d920ecacb22828d0b16c2550` to `feeb7cc74eaf9f159b32b0522017708fe936f24c3a001465ea7b51c8d7f60def`.

| File | Bytes | SHA-256 |
|---|---:|---|
| `style.css` | 45,711 | `1e0a25f5fc4e095e26233b094ee1e5134939834bd78a6350896b7187cd3857f7` |
| `style.css.gz` | 10,470 | `f3feeb9cc3dde826f6fd80295ba85ab37c26e2f24695d4556aa79c3edc14e5dd` |
| `city-map.mjs` | 11,322 | `268282d437f9c6ff0ab6cfce0db88111f539ebeeebdd3b3618de49d385ea5398` |
| `city-map.mjs.gz` | 4,063 | `ef9bcdc4ee254ee0960ad4a4b259ab1bf0d19d996c4cc78936a68c07db13673d` |

All other 4,941 files are byte-identical to the previous base, including every `data/` file. The net change is +92 B. No map data, scientific arm, threshold, vehicle profile, source offer or qualification result changed. SF qualification remains HOLD.

## Reproduce

From the repository root, with the pinned Python 3.11.15, save the script below as `refresh-viewer-presentation.py` and run `python -B refresh-viewer-presentation.py --source <previous base generation> --out <new absent directory>`. Two runs produced byte-identical trees.

```python
#!/usr/bin/env python3
"""Derive a new City base whose presentation files match web/ source; run from the repo root.

Only the files in REFRESHED (and their gzip twins) are replaced. Every other byte, including
all scientific data, must stay identical, and the old manifest digest is recorded.
"""

import argparse
import gzip
import importlib.util
import json
from pathlib import Path

spec = importlib.util.spec_from_file_location(
    "launch", Path("apps/fleetlab-city/tools/prepare-launch.py").resolve()
)
launch = importlib.util.module_from_spec(spec)
spec.loader.exec_module(launch)
WEB = Path("apps/fleetlab-city/web").resolve()
REFRESHED = ("city-map.mjs", "style.css")


def refresh(source, out):
    source, out = Path(source), Path(out)
    if out.exists() or source.resolve() == out.resolve() or source.resolve() in out.resolve().parents:
        raise ValueError("new output must be separate and absent")
    release, before = launch.verify_viewer(source, "original")
    if "hosting_projection" in release or "hosted_presentation" in release:
        raise ValueError("select an original review viewer, not a projected or branded one")
    launch.safe_copy(source, out, before)
    for name in REFRESHED:
        data = (WEB / name).read_bytes()
        (out / name).write_bytes(data)
        # Same producer as the original generation's gzip twins (Python gzip, fixed mtime).
        (out / (name + ".gz")).write_bytes(gzip.compress(data, mtime=0))
    release["presentation_refresh_of"] = before["release.json"]["sha256"]
    release["files"] = {k: v for k, v in launch.inventory(out).items() if k != "release.json"}
    launch.write_json(out / "release.json", release)
    launch.verify_viewer(out, "refreshed original")
    allowed = {n for name in REFRESHED for n in (name, name + ".gz")}
    if set(release["files"]) != set(before) - {"release.json"} or any(
        before[k] != v for k, v in release["files"].items() if k not in allowed
    ):
        raise ValueError("refresh changed more than the presentation files")
    if launch.inventory(source) != before:
        raise ValueError("source viewer mutated")
    return {"source_manifest": before["release.json"]["sha256"],
            "manifest": launch.sha_file(out / "release.json")}


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--source", type=Path, required=True)
    parser.add_argument("--out", type=Path, required=True)
    print(json.dumps(refresh(**vars(parser.parse_args())), indent=2))
```
