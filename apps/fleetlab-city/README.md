# FleetLab city explorer

A separate static simulation application, integrated as the City Explorer tab in FleetLab: sourced SF roads, a synthetic one-versus-two-depot experiment, and recorded vehicle inspection. **Map qualification is incomplete; results are diagnostic and do not authorize operational decisions. The owner separately authorized publication of the educational website on 29 September 2026.**

Current local continuation (30 September): temporal fleet integration and the
fixed full-fleet engineering resource check are complete; explicit source-edge
connectors have a separate model 4 and verified fixtures. A complete temporal map
bundle and candidate-specific inspection worksheet now validate locally. They
are **not yet integrated into the public viewer**. Use the current
[`FLEETLAB_TEMPORAL_CANDIDATE_BUNDLE_V1.md`](../../docs/FLEETLAB_TEMPORAL_CANDIDATE_BUNDLE_V1.md)
and SF completion status for exact versions, tests and remaining work. Historical
setup/release notes below retain their original scope. The stopped power-study
retry was consumed; no further evaluation is authorized by these packaging tools.

Start from the repository root. Python 3.11 and Node 22 are the tested targets; the wheel lock is specifically macOS arm64. Other platforms require their own resolved wheel hashes and validation, not removing `--require-hashes`.

```bash
python3.11 -m venv build/fleetlab-city/venv
build/fleetlab-city/venv/bin/python -m pip install --require-hashes -r apps/fleetlab-city/requirements.lock.txt
npm --prefix apps/fleetlab-city ci
build/fleetlab-city/venv/bin/python apps/fleetlab-city/tools/city.py validate-fixtures
npm --prefix apps/fleetlab-city test
```

The exact frozen source files already exist locally under `build/fleetlab-city/sources/`; preserve them together with `config/sf-v1.json`. They are deliberately not committed. A different machine needs a copy of those public-source snapshots, including `osm-fetch.json`, `districts-metadata.json`, and the query. Fetching today's endpoints will not reproduce yesterday's snapshot. The source hash check will refuse it; register a new version to use new data.

The checked-in specification contains the frozen source-node pool, depot identities, seeds, and assumptions. Outputs are immutable directories: use a new destination for each reproduction. The first import command refuses an existing pack.

```bash
build/fleetlab-city/venv/bin/python apps/fleetlab-city/tools/city.py import-sf --config apps/fleetlab-city/config/sf-v1.json
build/fleetlab-city/venv/bin/python apps/fleetlab-city/tools/city.py qualify-pack --manifest build/fleetlab-city/packs/sf-v1/manifest.json
build/fleetlab-city/venv/bin/python apps/fleetlab-city/tools/city.py benchmark --spec apps/fleetlab-city/experiments/spike-100-v1.json
build/fleetlab-city/venv/bin/python apps/fleetlab-city/tools/city.py run-pair --spec apps/fleetlab-city/experiments/sf-depots-v1.json --out build/fleetlab-city/runs/my-evaluation
build/fleetlab-city/venv/bin/python apps/fleetlab-city/tools/city.py verify-run --run build/fleetlab-city/runs/my-evaluation
build/fleetlab-city/venv/bin/python apps/fleetlab-city/tools/city.py build-viewer --runs build/fleetlab-city/runs/my-evaluation --out dist/my-city-review
build/fleetlab-city/venv/bin/python apps/fleetlab-city/tools/city.py check-dist --site dist/my-city-review
build/fleetlab-city/venv/bin/python apps/fleetlab-city/tools/city.py serve --site dist/my-city-review --port 4173
```

Expected qualification exit: `qualify-pack` exits **1** because frozen source-support/human gates fail. `run-pair` also exits **1** with `BLOCKED_MAP_QUALIFICATION`, even when all 34 runs verify. Do not hide these failures. `verify-run` tests internal consistency; `check-dist` tests the local package; neither confers operational readiness. Exit **2** indicates a malformed/unsupported input or blocked optional provider.

To inspect the already-built reviewed package:

```bash
build/fleetlab-city/venv/bin/python apps/fleetlab-city/tools/city.py serve --site dist/city-explorer-reviewed --port 4173
```

Open `http://127.0.0.1:4173/`. The atlas has routing/source/scenario layers, the notebook shows all pairs and sensitivities, and replay selects one of 100 vehicles in either arm. `?renderer=flat` bypasses MapLibre and provides the flat map path. The server binds loopback, handles single byte Range requests, and sends the scoped CSP. It rejects public bind addresses and traversal/symlinks.

Additional local checks:

```bash
build/fleetlab-city/venv/bin/python apps/fleetlab-city/tools/qualify-routing.py
build/fleetlab-city/venv/bin/python apps/fleetlab-city/tools/rebuild-check.py
build/fleetlab-city/venv/bin/python apps/fleetlab-city/tools/city.py explain --run build/fleetlab-city/runs/sf-depots-v1/seed-1001-baseline --provider template
npm --prefix apps/fleetlab-city run test:browser
```

`qualify-routing.py` compares 100 supported-graph OD queries and repeats an eight-hour run exactly. `rebuild-check.py` writes a new pack and compares five semantic products. It is a one-time immutable reproduction command; choose another output path to run again. Browser evidence checking validates the recorded local browser observations; it does not launch a browser or claim unavailable devices were tested.

See `docs/FLEETLAB_CITY_PACK_V1.md`, `docs/FLEETLAB_CITY_RUN_V1.md`, and `docs/FLEETLAB_CITY_SF_VALIDATION.md` for contracts, results and remaining gates. The existing `playground/fleetlab/` app, root Python package, headers and legacy release path remain separate. No push or deployment command is part of this slice.

## September 29 visitor-experience update

Use `dist/city-explorer-v2-reviewed/` for the enhanced local reviewer package. It adds
street-level controls/labels, automatic trace loading and restart, full shift history,
vehicle discovery, descriptive trip/depot summaries and explicitly entered fare assumptions.
It uses the same frozen SF runs and does not change simulation or recommendation semantics.

```bash
build/fleetlab-city/venv/bin/python apps/fleetlab-city/tools/city.py serve --site dist/city-explorer-v2-reviewed --port 4173
```

Read `docs/FLEETLAB_CITY_PRESENTER_GUIDE.md` for the demonstration narrative and
`docs/FLEETLAB_CITY_UX_V2_VALIDATION.md` for current checks and remaining device/map gates.
The older `dist/city-explorer-reviewed/` and original validation logs remain historical evidence.
`dist/city-explorer-v2/` is a mutable UI prototype and must not be deployed or used as the final release identity.

## September 29 qualification and launch-preparation update

The latest reviewed package is `dist/city-explorer-v3-final/`, served on loopback port 4173.
It adds the guided start page, sourced Ojai/Zoox design references, and a separately identified
SF v2 qualification candidate. Recorded fleet results still use the unchanged SF v1 pack.
The candidate is map-only: fleet execution is rejected until cross-leg restriction history
is specified and validated. Its remaining class, district and human-review gates stay visible.

Read `docs/FLEETLAB_CITY_V3_VALIDATION.md` for the current evidence,
`docs/FLEETLAB_SF_MAP_RESEARCH_V3.md` for source research and simulator recommendations,
and `docs/FLEETLAB_NEXT_PHASE_BRIEF_V3.md` for a portable brainstorming handoff.
`docs/FLEETLAB_CITY_LAUNCH_PREPARATION.md` documents the separate local Pages stage,
proposed header/navigation diffs and rehearsed rollback. No public switch has occurred.

## Additive hosted integration

City Explorer is a separate `/city-explorer/` application. The FleetLab root
retains its Overview film and all existing lessons. `hosted/integration.mjs`
adds native same-tab navigation, an Overview card and a catalog entry; it does
not import City maps or recordings. The offline teaching edition is unchanged.

`tools/build-source-offer.py` exports the complete corresponding SF map packs,
captured sources and transformation code with ODbL notices and exact member
hashes. `tools/integrate-site.py` creates a new immutable combined tree. It
permits exactly three established hosted files to change (`index.html`,
`boot.js`, `_headers`), verifies every other existing file and preserves the
separate offline file. Original local-only staging reports describe the
intermediate unchanged copy; `review/integration-manifest.json` is the final
hosted inventory. City `release.json` records the build's review scope; the
separate publication record records the owner's website-release decision.

See `docs/FLEETLAB_CITY_INTEGRATION_RELEASE_2026-09-29.md` for actual checks,
release paths, publication identity and rollback. The separate power-study
execution amendment is still held; no uncomputed SF power results are shown.
