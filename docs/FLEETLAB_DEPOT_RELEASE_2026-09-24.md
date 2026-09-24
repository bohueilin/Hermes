# FleetLab depot milestones: verified release, September 24, 2026

M1–M4 and scenario learning are published at **https://fleetlab-playground.pages.dev/**.
The current user explicitly authorized M2/M3, then M4, testing, repository updates and
conditional publication. This supersedes the original M1-only/no-publication request.
The website remains a static, synthetic teaching application. Its simulation results
are `NOT_EVIDENCE`, scope simulation-only, deployment permission `NONE`.

## Release identity

| Item | Observed value |
|---|---|
| Published source | `7874c7ed1453b97123946b43b153f80a7228088c` |
| Source checkpoints | M1 `7e0389d`; M2/M3 `277d8e4`; M4 and scenario learning `7874c7e` |
| Website branch | `feat/fleetlab-playground` in `bohueilin/Hermes` |
| Implementation worktree | `Hermes-depot-m1`, branch `codex/fleetlab-m2-m3` |
| Deployment ID | `40858080-b229-44f1-8169-4f8b4faf5c86` |
| Immutable deployment | https://40858080.fleetlab-playground.pages.dev/ |
| Pages project / production branch | `fleetlab-playground` / `feat/fleetlab-playground` |
| Upload | Wrangler 4.135.0 Direct Upload of `dist/site`; 18 assets uploaded, 62 reused; `_headers` applied separately |
| Public readback | **80/80 files** match local SHA-256 values; root document requested through `/` |
| Previous deployment | `ccb82b11-986c-4ad1-8658-e1bc30917992`, source `f85a28f69a8a8819fea620d06837ae530a390030` |

The release source was pushed without force before deployment. A subsequent documentation-only
commit records these observed results; the branch head therefore need not equal the deployed
application source. Main remains `bca4ccd4d881e58904e59bb1b1ff594442099654`. No main merge or PR.
The original website checkout remains untouched at `6b376fb`; other worktrees were not migrated.

## What visitors can learn

- **M1:** finite cleaning workers and bays constrain required serial work. Compare an extra
  worker separately from an extra bay, inspect blockers and unfinished work.
- **M2:** compare equal-share charging with capped redistribution, then separately compare
  redistribution with deadline/aged-job priority. Power proposals are checked before use.
  Paired evaluation validates producer, versions, populations and comparable external demand.
- **M3:** inspect fictional charging-port truth separately from unknown/stale observations and
  leases. Test independently published synthetic SFO forecasts against reactive preparation,
  including finite staging, reserve, non-airport service and terminal-energy guardrails.
- **M4:** configure Peninsula or fictional Region B through the same lifecycle, validate owned
  setup tasks, then compare commissioning times. Inspect planned, installed, commissioned and
  usable capacity without treating setup checks as operating authorization.

The catalog has **56 lessons**: 18 Fleet day, six Street lab and 32 regional examples.
Each names its decision, changed assumption, observations, interpretation and limits.
Fleet day, Street lab, regional experiments and Python evidence remain distinct systems.
No engine, framework, backend, telemetry or runtime dependency was added.

Exact local commands, demonstrations, version tables and metric populations:
[M1 readiness](FLEETLAB_DEPOT_READINESS.md), [M2/M3 operating experiments](FLEETLAB_DEPOT_M2_M3.md),
[M4 launch rehearsal](FLEETLAB_DEPOT_LAUNCH.md). New semantics are named opt-in extensions;
historical defaults, fixture expectations, event boundaries and regional instrument semantics remain.

## Validation

| Check | Actual result |
|---|---|
| Full Node suite, performance enabled, serialized | 1,715 total; **1,714 pass**, zero fail/cancel/skip, one existing browser-only TODO; 245 suites; 144.226 s |
| Relevant Python parity/boundary suite | **89 pass**, 9.29 s |
| Ruff and whitespace | Pass |
| Environment doctor, before final documentation commit | 16 PASS, 2 WARN (shell still names Conda base despite explicit `hermes-dev` Python; documentation edits uncommitted), one optional display NOT_AVAILABLE, no FAIL |
| Static package | **81 files, 3,105,220 bytes** including fixed media; checker passes |
| Offline HTML | **2,466,050 bytes**; checker passes under unchanged 2.5 MiB application budget |
| Offline SHA-256 | `926ade802ecc7e0f44c13c856741cb734a9cc8e4b9a6a3f2b0a82cc70d6e7c78` |
| Root document SHA-256 | `97ec391c70a0df2ce392065692128c23a5876848a3369ea723acee1031a50cbe` |
| Sorted path/hash manifest SHA-256 | `e0fa675cf40d19668e84c396dd91fcb1295f56276d7e361a82256c4b9be1d712` |
| Independent model/UI review | Three comparison-boundary defects and three UI defects fixed; focused regressions and re-review passed |
| Final security diff scan | Complete scoped coverage; 20 changed source files plus supporting controls; **zero findings**, no deferred candidates |

Commands run from the release checkout (Node 22.22.0 and Python 3.11 in `hermes-dev`):

```bash
FLEET_PLAYGROUND_PERF=1 node --test --test-concurrency=1 playground/fleetlab/test/*.test.mjs
FLEET_PLAYGROUND_BASE=bca4ccd PYTHONPATH="$PWD/src" PYTHONDONTWRITEBYTECODE=1 \
  python -m pytest -q tests/unit/test_fleet_playground_parity.py tests/unit/test_fleet_playground_boundaries.py
python -m ruff check .
python -m hermes doctor
node playground/fleetlab/tools/pack.mjs --site dist/site
node playground/fleetlab/tools/check-dist.mjs --site dist/site
node playground/fleetlab/tools/pack.mjs --out dist/fleetlab-playground.html
node playground/fleetlab/tools/check-dist.mjs dist/fleetlab-playground.html
git diff --check
```

The settled release run passed unchanged performance budgets. An earlier concurrent run
contained a test/module edit race and a wall-time scheduling outlier (28.79 ms wall, 3.43 ms
CPU); neither was hidden by deleting tests or weakening limits. The existing layout TODO
was manually exercised locally at a 400-pixel viewport: 385-pixel content, no page overflow.
The full unrelated Python/MetaDrive suite was not rerun or represented as passing.

Final security scan `1d70bf64-6294-45d9-bb71-29588f1fbfa8` covers immutable range
`f85a28f..7874c7e`. It reports complete coverage and no reportable vulnerabilities, not proof
of zero risk or a cloud-account audit. Measured scan usage: total 9,202,140 tokens; input
9,172,754, including 8,660,352 cached input; output 29,386. These are tool-reported cumulative
review usage, not a price. The earlier M1–M3 scan `c37f68ed-0c6b-44c8-a4fb-f99e6e260580`
remains sealed with zero findings and its partial-coverage marker; it was not rewritten.
Two older architecture claims were corrected in documentation after review: package size/media
policy, and the distinction between the packer's exact manifest and the checker's path-shape checks.

## Browser and hosting acceptance

- Local desktop and narrow-layout checks exercised input validation, stale-result removal,
  immediate versus delayed commissioning, zero-delay control, replayed port state, rejected
  uninstalled-resource actions, catalog treatment selection and paired results.
- On the public build, the default Fleet day ran with vehicle/replay/depot outcomes. Region B
  seed 42 with a 120-minute delay reproduced all documented numbers: 179 requests in each arm,
  completed trips 34→29, within-target pickups 24→26, unfinished tasks 42→49 and queue
  task-minutes 3,512→4,158. This mixed one-seed result receives no winner or confidence claim.
- Keyboard removal of a setup owner immediately removed old output/downloads and produced
  `TASK_OWNER FAIL`. The deadline lesson selected `charging_deadlines`; 12 held-out seeds
  returned `UNCHANGED / NO_RECOMMENDATION`. The airport lesson selected reactive→forecast;
  one evaluation seed displayed descriptive-only text with no interval or recommendation.
- Existing hosted Street lab ran, inspected its largest queue and compared routes (37→41
  completed journeys in that descriptive run). The separate regional worker completed its
  20-pair comparison, returning `UNCHANGED / NO_RECOMMENDATION` with a -10.2 s to +0.4 s
  wait-p90 interval. Those populations are not combined with Bay results.
- All 80 public payloads matched the reviewed build. Response headers include same-origin
  script/worker/media, `connect-src 'none'`, `frame-ancestors 'none'`, `X-Frame-Options: DENY`,
  `nosniff`, no-referrer and same-origin opener policy. Cloudflare also supplies its own
  network-error-reporting headers; application code adds no telemetry.
- Direct offline `file://` browser execution remains blocked by browser policy and is not
  claimed as tested for this release. Offline packaging, policy and worker parity passed.

## Limits and rollback

Serial work, one cleaning skill, FIFO resource queues, synthetic demand/forecast assumptions,
constant charge-acceptance caps, local-minute calendars and one-minute resolution remain.
There is no optimized universal scheduler, taper, tariff model, live feed, calibrated airport
model, physical commissioning, Waymo operations model or real vehicle control. M4 is a
configuration/commissioning rehearsal, not a production region launch system. Operator manual
touches and first-pass setup success remain unavailable until a usability study measures them.

For a future authorized rollback, select the prior immutable production deployment
`ccb82b11-986c-4ad1-8658-e1bc30917992` in Pages, then verify its source and public assets.
Alternatively rebuild the prior source in a separate clean worktree and upload only its checked
`dist/site`. Do not reset shared worktrees or assume moving a Git branch changes Direct Upload.
The current release was not rolled back. See [publication steps](FLEETLAB_CLOUDFLARE_DEPLOYMENT.md).

Recommendation: use the learning catalog to choose one constraint and inspect both service and
unfinished work. Top risk: descriptive synthetic results can be overgeneralized; visible model,
population and authority limits address that risk. Next three learning actions: compare workers
with bays, test one charging/forecast treatment, then rehearse Region B commissioning.
