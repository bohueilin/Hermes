# FleetLab Street lab release handoff

## Scope and authorization

The requested street-level downtown San Francisco enhancement is implemented on `feat/fleetlab-playground` in the isolated FleetLab static site. The user's prior explicit GitHub and Cloudflare publication instructions continue to apply. They override the historical local-only prohibition for this playground publication only. No physical-system connection, Hermes Python change, evidence-contract change or main-branch merge is included.

Starting commit: `6440deb4b6d6186acf80687e6f39965b4764484e`. Repository: `bohueilin/Hermes`; remote: `github`. The [model guide](FLEETLAB_STREET_LAB.md), [map provenance](FLEETLAB_STREET_MAP_DATA.md) and [implementation plan](plans/2026-09-19-street-bottleneck-lab.md) describe the change and its boundaries.

## Validation before publication

| Check | Observed result |
| --- | --- |
| Full JavaScript suite | 1,599 pass; zero failures; two skipped; one existing TODO; 1,602 total |
| Focused Python parity/boundary suite | 89 pass |
| Street source extraction tests | Four pass |
| Repository Ruff | Pass |
| Whitespace and protected path review | Pass; `src/hermes`, `pyproject.toml`, `.github`, `.gitignore`, `Makefile` unchanged from starting commit |
| Environment doctor | 17 PASS; one working-tree-dirty WARN before commit; one optional display NOT_AVAILABLE; no FAIL |
| Static package | 65 files, 1,840,597 bytes; distribution checker passes |
| Offline package | 2,265,316 bytes; distribution checker passes under explicit 2.5 MiB cap |
| Offline SHA-256 | `e7ab93e105b6d593f00a115845d72a4d133fd55d03e82ec856f3243a5eb64900` |
| OSM data module | 328,545 bytes; SHA-256 `ad3beda588b8a1c3145d52b558c228d9e0c07816ca33a8ddf2cda95bb5876399` |
| Browser | Real WebGL rendering; scenario/run/queue inspection/comparison; desktop and 390 px phone checks; no horizontal page overflow; temporary viewport restored |
| Independent review | Capacity, lifecycle, stale state, catalog focus and long-edge viewport findings resolved with regression tests |

Commands used:

```sh
node --test playground/fleetlab/test/*.test.mjs
node playground/fleetlab/tools/pack.mjs --site dist/site
node playground/fleetlab/tools/check-dist.mjs --site dist/site
node playground/fleetlab/tools/pack.mjs --out dist/fleetlab-playground.html
node playground/fleetlab/tools/check-dist.mjs dist/fleetlab-playground.html
python -m unittest discover -s tools/street-map-data -p 'test_*.py'
FLEET_PLAYGROUND_BASE=bca4ccd PYTHONPATH="$PWD/src" PYTHONDONTWRITEBYTECODE=1 python -m pytest -q tests/unit/test_fleet_playground_parity.py tests/unit/test_fleet_playground_boundaries.py
python -m ruff check .
python -m hermes doctor
git diff --check
```

Python parity/boundary and lint checks used the existing validation environment; doctor used `hermes-dev` with Python 3.11.15 and MetaDrive 0.4.3. No dependency installation or core changes were needed. The broad Python suite was not repeated: the preceding release documented missing historical evidence-fixture failures. This is not a claim that the whole Hermes Python suite passes. See [the previous public release](FLEETLAB_PUBLIC_RELEASE_2026-09-19.md).

## Worked default comparison

One 120-minute synthetic First Street stress case, seed 42, 24 AVs and 71 realized requests:

| Metric | Free-flow routing | Queue-aware routing |
| --- | --- | --- |
| Completed passenger journeys | 37 | 41 |
| Waiting / in progress | 12 / 22 | 10 / 20 |
| Boarded riders | 50 | 53 |
| Mean pickup time, boarded cohort | 19.0833 min | 18.6447 min |
| Mean passenger time, completed cohort | 28.2342 min | 25.8760 min |
| Actual empty pickup distance | 465.5231 km | 503.0071 km |
| Peak queued road vehicles | 138 | 140 |
| Road journeys waiting to enter at horizon | 640 | 614 |

The candidate completes four more journeys but adds approximately 37.5 km of empty driving and slightly increases the largest road queue. This is a mixed trade-off on one seed, not an optimal policy or real fleet performance. All six default hotspot cases ran successfully; their different demand locations and roads make cross-case outcomes descriptive, not a controlled corridor ranking.

## Publication

Published and verified on September 19, 2026 UTC:

| Item | Verified identity |
| --- | --- |
| Published source commit | `10863f28c73236ce2c9a15db35f270e05226cb16` |
| GitHub source | [feat/fleetlab-playground](https://github.com/bohueilin/Hermes/tree/feat/fleetlab-playground) |
| Pages project / production branch | `fleetlab-playground` / `feat/fleetlab-playground` |
| Deployment ID | `0b302024-3840-474c-a806-f11792740267` |
| Immutable deployment | [0b302024.fleetlab-playground.pages.dev](https://0b302024.fleetlab-playground.pages.dev/) |
| Stable interview link | **[fleetlab-playground.pages.dev](https://fleetlab-playground.pages.dev/)** |
| Upload | Only `dist/site`; nine new/changed assets uploaded, 55 reused, `_headers` applied separately |
| Public file readback | All 64 served files byte-equal to the validated package, totaling 1,840,205 served bytes. `index.html` was checked via canonical `/`; Cloudflare redirects the explicit filename. |
| Public headers | Expected CSP with `connect-src 'none'`, frame restrictions, `nosniff` and no-referrer confirmed |
| Public browser | WebGL default run, Largest queue, same-demand comparison and candidate replay verified; no stale block observations after a new run |
| Main branch | Remains `bca4ccd4d881e58904e59bb1b1ff594442099654`; no merge or PR created |

The feature commit was pushed to `github` before deployment. A subsequent documentation-only checkpoint records this readback; it does not change the deployed site bytes. The public upload contains no source checkout, raw OSM response, Python artifact or credential. The [Cloudflare owner guide](FLEETLAB_CLOUDFLARE_DEPLOYMENT.md) remains the publishing runbook; no owner action is required for the current Pages address.

## Recommendation

Demonstrate **Street lab → Bridge rush → Largest queue → Compare route policies**. Show a queue and one AV before explaining fleet outcomes.

## Top risks and mitigations

- Synthetic demand/capacity/signals: label every result as a teaching experiment; calibrate one corridor in SUMO before expanding planning claims.
- Incomplete access/turn/curb rules: keep gateway and restriction limitations visible; do not present these routes as navigation or operating permissions.
- Separate street and depot engines: test a versioned coupling and repeated paired experiments before interpreting combined service/energy capacity.

## Next three actions

1. Share the verified stable interview link and use the Street lab walkthrough.
2. Use the worked mixed trade-off for the interview, with scope and cohort limits explicit.
3. Prioritize approved traffic calibration, curb data and depot coupling over additional visual fidelity.
