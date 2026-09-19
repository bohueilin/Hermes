# FleetLab public release: 2026-09-19 UTC

## Scope and authorization

The user explicitly requested GitHub publication and a public Cloudflare website for interviews. That authorizes publishing this isolated static playground and supersedes the historical local-only/no-push rule for this release. It does not authorize a production fleet connection, change the Hermes evidence workbench, or establish real-world validation.

Repository worktree: `Hermes-playground`, branch `feat/fleetlab-playground`. Release starting commit: `fb07b66ddaa786020f2176efdb82727bd55c5d4b`. Package identity remains `hermes-autonomy` / `hermes`, version `0.1.0`. Other worktrees are untouched.

## Delivered experience

- A clearer independent-project introduction, creator attribution, larger visual hierarchy and a short demo path. The design takes inspiration from the whitespace, restrained navigation and prominent actions observed at [Waymo](https://waymo.com/), with FleetLab's own identity and original code-native illustration.
- All preceding Bay Area 3D work: 18 city/airport locations, frozen attributed OSM roads, I-PACE/Ojai profiles, per-car replay, weather/demand/energy/depot constraints, comparisons and 44 lessons across two teaching models.
- A discoverable root README, descriptive sharing metadata and a JavaScript-disabled explanation.
- [Exact Cloudflare owner steps](FLEETLAB_CLOUDFLARE_DEPLOYMENT.md) and [repository integration recommendation](FLEETLAB_REPOSITORY_RECOMMENDATION.md).

## Publication boundary

Cloudflare receives only `dist/site`. The public app executes locally in each visitor's browser, has no persistence or analytics code, and its CSP denies data connections. Runtime modules and stylesheet are served from the same site. The offline HTML remains separately buildable. Map source/license metadata and the attributed-data download remain available.

The local Google traffic companion is committed as separate tooling but is not hosted or called by the public page. No Google credential was present in the reviewed source. No external model, paid map service or CARLA process is needed to use the site.

## Validation before publication

| Check | Result |
|---|---|
| Focused Python playground parity/boundaries | 89 passed |
| Optional local traffic companion tests | 14 passed |
| Ruff | Passed |
| Hermes doctor | 17 PASS; expected uncommitted-tree WARN; optional display NOT_AVAILABLE |
| JavaScript | 1,564 passed, 0 failed, 2 skipped, 1 existing TODO; 1,567 tests |
| Static package | 59 files, 1,442,639 bytes; distribution checks passed |
| Offline package | 1,865,973 bytes; distribution checks passed; below 2 MiB cap |
| Offline SHA-256 | `3793539586933ce75cf840573f61e8889b691bd134a08d3fc8a1d44703d48c1d` |
| Whitespace and publication payload | Passed; scoped credential-pattern checks found no matches |
| Browser | Desktop and 390px phone layout; 3D run and next-activity step; no error logs in those flows |

The broad Python suite is **not claimed green**. The preceding redesign wave recorded 186 failed, 1,433 passed, 1 skipped, 55 deselected and 42 errors due to historical evidence-fixture prerequisites. No Python core or existing CI implementation changes in this release. See the [earlier validation record](FLEETLAB_REDESIGN_HANDOFF_2026-09-18.md).

## Release identity and external verification

The completed deployment, source commit, package checks and browser observations are recorded here after publication.
