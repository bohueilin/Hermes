# Bay Area 3D fleet simulation handoff

Completed locally on 2026-09-19 UTC. This extends the preceding FleetLab redesign and operational simulation wave. It does not deploy a site or modify the Hermes evidence core.

## Repository snapshot

- Worktree: `/Users/bohueilin/Documents/GitHub/Hermes-playground`.
- Branch: `feat/fleetlab-playground`.
- HEAD: `fb07b66ddaa786020f2176efdb82727bd55c5d4b`, unchanged.
- Prior uncommitted redesign/operations work preserved. Current changes remain uncommitted and unstaged; no remote, PR, push or publication action.
- The initial `/Users/bohueilin/Documents/GitHub/Hermes-fleetlab` worktree was not edited.
- Current explicit user requests authorize new map/model/3D behavior; they supersede historical invented-place-only and presentation-only constraints for this isolated playground extension. No Phase 6 artifact contract or trust state changed.

## Delivered

1. True x/y/z WebGL vehicle and depot meshes, depth testing and a perspective camera. Orbit, tilt, zoom, whole-area reset, named-place focus and selected-car follow. SVG flat fallback is explicit. Vehicle table and native controls remain available.
2. All 18 selectable locations: San Francisco, SFO Airport, Daly City, Colma, Broadmoor, Brisbane, South San Francisco, San Bruno, Millbrae, Burlingame, San Mateo, Menlo Park, Palo Alto, Los Altos, Mountain View, Sunnyvale, San Jose and SJC Airport. Key/all/hidden label modes avoid covering the road geometry. At least two anchors are required for inter-place demand.
3. Frozen OpenStreetMap-derived roads, place/airport coordinates and coastline outlines. Real road path distance drives simulated travel and energy. Map attribution links to OSM; the complete derived database can be downloaded locally from both packages. No runtime map service or account.
4. Configurable I-PACE/Ojai fleet share and individual battery, charge acceptance, kWh/km, boarding and software/cleaning/upload factors. Published context is distinct from operational assumptions. Same road-speed rules and up-to-four-rider party capacity for both types.
5. Stationary boarding, pickup/passenger/depot routes, per-vehicle energy and finite sequential depot work. Completed, unfinished and unserved requests remain separate. Per-type and per-pickup-place outcome tables, measured depot service/wait and shared-demand fleet/depot/mix comparisons.
6. Revised learning catalog: 44 examples and lessons, comprising 12 Fleet day lessons and the unchanged 32 regional presets. A practical walkthrough and source/assumption guides accompany it.

The 3D view enlarges vehicles/depots and spaces stationary cars into display slots so they remain visible and selectable. Moving cars follow the recorded road polyline; stationary display offsets never change route distances, battery, dispatch or results. Grid spacing is 5 km. This is operational animation, not terrain, building-footprint, collision, sensor or driving-physics simulation.

## Sources and implementation

- [Map provenance and reproduction](FLEETLAB_BAY_AREA_MAP_DATA.md): OSM base 2026-09-19T02:37:34Z. 51,408 source ways; 174 retained shared road chains, 918 vertices, 153 unique route pairs and 282 coastline fragments. Checked-in database 176,375 bytes, SHA-256 `19fce9dabb761048f2f5f5db66b3c7e12d10eff9152603d28ceae09da1b003dd`. Queries, extraction and source hashes: `tools/map-data/`.
- [Vehicle facts and assumptions](FLEETLAB_VEHICLE_PROFILES.md), citing official [Jaguar retail specification](https://media.jlr.com/corporate/en-us/news/2018/03/2019-jaguar-i-pace), [Ojai introduction](https://waymo.com/blog/2026/05/welcoming-riders-in-the-ojai/) and [rider capacity](https://support.google.com/waymo/answer/9059053?hl=en-GB).
- Pure-data → map facade → new `bay-operations.js` → recorded frames/results → 3D/DOM projection. `vehicle-profiles.js` separates sourced metadata and editable parameters. Original `operations.js`, regional engine, instrument and golden fixtures remain unchanged.
- The import-boundary checker adds an inert data folder; only the map facade may import it. Distribution checks allow exact provenance metadata and the OSM copyright link while retaining external-load, network, storage and dynamic-code bans. CSP connection policy is unchanged.
- Google traffic remains the separate optional local companion. Its content is not incorporated into the OSM replay. [Google/CARLA research](FLEETLAB_GOOGLE_TRAFFIC_CARLA_RESEARCH.md) remains applicable; no CARLA installation or integration was attempted.

## Validation and review

| Check | Observed result |
|---|---|
| Full JavaScript suite | 1,564 passed, 0 failed, 2 skipped, 1 existing TODO; 1,567 total |
| Focused Python playground parity and boundaries | 89 passed |
| Ruff | Passed |
| Hermes doctor | 17 PASS, 1 expected dirty-tree WARN, 1 optional display NOT_AVAILABLE |
| Static package | 59 files, 1,440,370 bytes; policy/URLs/tokens/copy/labels pass |
| Offline package | 1,863,704 bytes; below 2,097,152-byte cap; same checks pass |
| Offline SHA-256 | `f065a8265ae36dfad9c4b10c315ce4a91f6817115a9d948fe52800dde70938ba` |
| Diff whitespace | Passed |
| Browser | Native WebGL observed in static and single-file packages; both compute matching default outcomes. No browser error logs in tested flows. |
| Responsive | Desktop 1280×900 and phone 390×844; no horizontal document overflow. Camera controls, city focus, flat view, replay/stage steps, vehicle/depot comparisons and map-data download inspected. |
| Download | Browser wrote `fleetlab-bay-area-osm-odbl.json`; parsed 18 places and retained ODbL/source metadata. |

Actual final commands:

```sh
node --test playground/fleetlab/test/*.test.mjs
FLEET_PLAYGROUND_BASE=bca4ccd PYTHONPATH="$PWD/src" PYTHONDONTWRITEBYTECODE=1 /tmp/hermes-fleetlab-redesign-venv/bin/python -m pytest -q tests/unit/test_fleet_playground_parity.py tests/unit/test_fleet_playground_boundaries.py
PYTHONDONTWRITEBYTECODE=1 /tmp/hermes-fleetlab-redesign-venv/bin/python -m ruff check .
# doctor used the existing hermes-dev Conda environment
PYTHONPATH="$PWD/src" PYTHONDONTWRITEBYTECODE=1 python -m hermes doctor
node playground/fleetlab/tools/pack.mjs --site dist/site
node playground/fleetlab/tools/check-dist.mjs --site dist/site
node playground/fleetlab/tools/pack.mjs --out dist/fleetlab-playground.html
node playground/fleetlab/tools/check-dist.mjs dist/fleetlab-playground.html
git diff --check
```

Logs and screenshots: `artifacts/fleetlab-bay-area-3d-review/`. The broader Python suite is not claimed green: earlier missing historical evidence fixtures remain documented in the preceding redesign handoff; this wave changes no Python evidence implementation.

Independent review closed three concrete issues:

- Co-located extra depots initially received no cars. A red regression reproduced `[46,0,0,53,0,0]` visits across six sites. Dynamic least unfinished inbound/on-site load among equally nearest depots now uses all six; reserve distance stays unchanged. In the specified two-location constrained reproduction, 2 versus 6 sites complete 99 versus 267 trips. These are scenario outputs, not operator forecasts.
- Repeated growing-array copies made 120-car redraw expensive. Appending vertices reduced the reviewer's median CPU-only redraw from approximately 99 ms to 4.5 ms before GPU/layout costs.
- Parked vehicles overlapped. Display slots now provide 120 unique positions in the 120-car probe, while moving interpolation and input frames remain exact. Both flat selection and 3D hit/follow targets use the displayed positions.

A final phone screenshot exposed perspective clipping at San Jose. The overview now fits the actual projected place coordinates with a margin, verified by a new narrow-viewport regression and a corrected phone screenshot showing San Jose.

No outstanding material finding from the bounded map, model and UI reviews. This is not a full security scan or real-user usability study.

## Default scenario observation

24 AVs, 12 I-PACE/12 Ojai, 18 places, 2 hypothetical depots, 8 hours starting 07:00, seed 42: 284 requests; 95 completed, 176 unserved, 4 waiting, 9 in progress. Completed mean trip 24.31 minutes; completed pickup wait 52.31 minutes; completed on-site depot time 104.87 minutes. 15 visits complete and 14 remain censored. These figures illustrate the model, not real service.

The long pickup mean is possible because patience applies to assignment waiting, not the whole pickup journey. The UI labels this **Assignment patience**; an arrival-time SLA and cancellation policy remain future model work. Per-type and place outcome populations are documented in the profile guide.

## Recommendation

Use this as a transparent fleet-operations product prototype. A hiring-manager walkthrough can show the decision, one recorded car, one constrained depot and a same-demand comparison, then identify the measurement and calibration needed next. It demonstrates product framing and inspectable assumptions without claiming ownership of a commercial fleet or validated AV performance.

## Top risks and mitigations

- **Model mistaken for service coverage or navigation:** labels state simulation locations; roads are sparse, undirected teaching paths and airport access is absent. Representative-to-road access, up to 0.781 km, is excluded explicitly.
- **Vehicle assumptions mistaken for specifications:** Ojai 90 kWh/150 kW are editable illustrations; I-PACE 84 kWh modeled usable energy is distinct from the published 90 kWh nominal reference. Both use the same speed rules; no brand bonus.
- **Overinterpreted capacity result:** shared demand, unfinished populations, completed-only means and bounded depot trials are visible. Charging lacks taper/thermal behavior; staffing, within-city last-mile access, calibrated demand and real traffic remain outside the model.

## Next three actions

1. Open the local site, run a Bay Area day, use **Follow selected car**, and inspect a recorded trip and depot stage.
2. Restrict to a corridor, change one vehicle or depot assumption, and compare identical demand; inspect both service and unfinished work.
3. Before making operational claims, obtain permitted demand/traffic/depot measurements and validated vehicle parameters, then define calibration and acceptance criteria. Public deployment remains a separate action.
