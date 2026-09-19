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

- **Stable public site:** [fleetlab-playground.pages.dev](https://fleetlab-playground.pages.dev/).
- **Immutable deployment address:** [5f2ce6b9.fleetlab-playground.pages.dev](https://5f2ce6b9.fleetlab-playground.pages.dev/).
- **Deployment ID:** `5f2ce6b9-c91c-4f8c-b935-1fba64af954a`, Production, source branch `feat/fleetlab-playground`.
- **Published source commit:** [`b65895dccc0259d1abf012da65354e1ff700874e`](https://github.com/bohueilin/Hermes/commit/b65895dccc0259d1abf012da65354e1ff700874e).
- GitHub accepted the normal feature-branch push from `fb07b66` to `b65895d`. Cloudflare lists the same source commit. Main was not merged or modified.
- All **58 publicly served files** match the local checked package byte for byte, totaling **1,442,247 bytes**. The 59th file is the 392-byte `_headers` configuration; its CSP, frame restriction and content-type protection were verified as HTTP response headers.
- Anonymous HTTPS requests returned the new page and matching assets. A fresh browser opened the stable public address, ran the default 24-AV / 2-depot / seed-42 day, paused, and advanced to the next activity. Native WebGL was visible and the tested flow produced no browser error logs.
- Local desktop and 390px phone checks showed no horizontal document overflow. Phone replay, camera controls and named-city labels remained available.
- A Python urllib probe received Cloudflare `403 / 1010`; the normal browser and curl client succeeded. No Cloudflare security setting was weakened. Public-file comparisons used unauthenticated curl requests.
- A documentation-only follow-up records these facts after deployment; it does not change the published application bytes.

## Commands and review

```bash
node --test playground/fleetlab/test/*.test.mjs
node --test tools/fleetlab-traffic/test/*.test.mjs
FLEET_PLAYGROUND_BASE=bca4ccd PYTHONPATH="$PWD/src" PYTHONDONTWRITEBYTECODE=1 python -m pytest -q tests/unit/test_fleet_playground_parity.py tests/unit/test_fleet_playground_boundaries.py
python -m ruff check .
python -m hermes doctor
node playground/fleetlab/tools/pack.mjs --site dist/site
node playground/fleetlab/tools/check-dist.mjs --site dist/site
node playground/fleetlab/tools/pack.mjs --out dist/fleetlab-playground.html
node playground/fleetlab/tools/check-dist.mjs dist/fleetlab-playground.html
git diff --check
git diff --cached --check
git push github feat/fleetlab-playground
npx --yes wrangler@4.135.0 pages deploy dist/site --project-name fleetlab-playground --branch feat/fleetlab-playground --commit-hash b65895dccc0259d1abf012da65354e1ff700874e --commit-dirty=false
```

JavaScript ran under Node `22.22.0`; Python checks used the existing isolated validation environment and doctor used `hermes-dev` (Python `3.11.15`, MetaDrive `0.4.3`). This is a record of executed commands, not a request to reinstall or alter the environments.

The bounded release review found one README scope issue: the original 2D renderer and Python verdict parity were described as applying to the entire playground. That is corrected to explicitly describe **Regional experiments**. The final review found no additional blocking publication defect. It checked navigation cleanup, experiment preservation, static payload separation and the source/assumption boundary; it was not an exhaustive numerical audit or a whole-repository security review.

## Recommendation

Share the stable public address for interviews. Keep FleetLab under `playground/fleetlab`, and review main integration separately from the working public release.

## Top risks and mitigations

- Illustrative operations can be mistaken for operator performance: retain the model scope, source attribution and editable-assumption labels.
- Inherited core tests limit a main-merge claim: resolve the historical fixture prerequisites before claiming all Hermes checks pass.
- Hosted source can drift on later updates: keep publishing explicit, attach the source commit and repeat the public-file check.

## Next three actions

1. Demonstrate **Overview → Simulation → Run fleet day → Product approach** in the interview.
2. Review the published feature branch for integration into main.
3. Optionally configure a custom subdomain or future GitHub publishing workflow using the Cloudflare guide; no account setup is needed for the current public link.
