# FleetLab D1 release and N2 S0 handoff — September 26, 2026

D1 is live at **https://fleetlab.pages.dev/** from source
`b99ab046ee0ee233c1e9d0db32dfa850c08cad8a`. Production
`dd4bfa44-7226-4502-9d66-01bb1790f2b6`; immutable
https://dd4bfa44.fleetlab.pages.dev/. Branch: `codex/fleetlab-d1-result-first`.
Part A design commit: `76439c617f6d647b7ad441834a37199f2ec68454`.
The owner's explicit brief authorizes these commits, this deployment, and only normal
pushes to this branch and `feat/fleetlab-playground` after an ancestry check. The records
commit follows deployment by the brief's exception; final remote refs/task report establish
push completion. Other worktrees, main, regional-power branch, remotes and PRs are untouched.
The only untracked entry remains the preserved owner's `FleetLab-ChatGPT-review-and-next-phase.md`.

[Release record](docs/FLEETLAB_D1_RELEASE_2026-09-26.md) has inventories, per-item byte tally,
rewrite reasons, browser evidence, privacy dispositions and publication receipts.
D1 changes only UI/tests/package-copy inventory: result-first partition/focus; no autoplay;
shared effective motion; version/geography/stale labels; five compatible setup controls;
Four-area names/non-affiliation; field-driven Austin verdict/resource text with exact disclosure.
No model, instrument, core or runtime source changed.

[N2 v2](docs/plans/2026-09-26-fleetlab-n2-design-v2.md) is complete design-only S0:
19 fixture groups, owner choices, dictionaries/ownership/versions/accounting. G2 remains
**OPEN pending S1**. Independent review corrections are included. No N2 implementation,
registration, external data, terms acceptance, package install or execution seam was run.
V1 SHA-256 remains `c574b8df41d0378363e18f75452f09e15a2cf62581e8fb01f6f365229d7e25bf`;
v2 is `da7b80690711116dc7a11874db4199468f2581ab6c5e87d4251698ead48d383d`.

Executed commands and outcomes (Node22.22.0; activated hermes-dev Python3.11.15):

```bash
FLEET_PLAYGROUND_PERF=1 node --test --test-concurrency=1 playground/fleetlab/test/*.test.mjs
node playground/fleetlab/tools/pack.mjs --site dist/site
node playground/fleetlab/tools/check-dist.mjs --site dist/site
node playground/fleetlab/tools/pack.mjs --out dist/fleetlab-playground.html
node playground/fleetlab/tools/check-dist.mjs dist/fleetlab-playground.html
# hermes-dev was activated; correct worktree src was confirmed immediately before:
FLEET_PLAYGROUND_BASE=bca4ccd PYTHONPATH="$PWD/src" PYTHONDONTWRITEBYTECODE=1 python -m pytest -q -p no:cacheprovider tests/unit/test_fleet_playground_parity.py tests/unit/test_fleet_playground_boundaries.py
PYTHONPATH="$PWD/src" python -m ruff check --no-cache .
git diff --check
npx --yes wrangler@4.135.0 whoami
npx --yes wrangler@4.135.0 pages deploy dist/site --project-name fleetlab --branch feat/fleetlab-playground --commit-hash b99ab046ee0ee233c1e9d0db32dfa850c08cad8a --commit-dirty=false
python3 artifacts/fleetlab-d1/verify_public.py https://fleetlab.pages.dev b99ab046ee0ee233c1e9d0db32dfa850c08cad8a
curl -sSI https://fleetlab.pages.dev/
npx --yes wrangler@4.135.0 pages deployment list --project-name fleetlab --json
```

Baseline Node1,792 total/1,791 pass/1TODO; final **1,827 total/1,826 pass/1TODO**, zero
fail/cancel/skip;35 added tests. No performance retry. Python**89 pass** in5.31s; Ruff clean.
Both packages pass; static90 files/3,189,179 bytes; offline**2,551,878 bytes**, **+8,223**
against11,264 allowance. All89 public hashes match. Actual CSP retains `connect-src 'none'`,
nosniff/frame denial/no-referrer/same-origin opener policy. No new security-scan claim.

Real browser: native and packed1280×720/400×812 keyboard Run focus/visibility and no jump;
Fleet and Street no autoplay, explicit Play; effective reduced-motion whole-minute replay;
all5 setup-model links idle/correct focus; native/packed Austin60% table480/77/391/11/1 and
12-seed+0.19-point CI−0.24 to+0.62 UNCHANGED, unfinished+0.33/allowance0 HOLD. Offline-over-HTTP
default Bay passes; hosted Bay95/176/4/9=284 focused/paused and Austin checks pass. No console
errors. System-media emulation is unavailable in the supported browser API, so browser motion
uses the actual in-app override, complemented by system/override automated tests. No AT,
other-browser, physical-device or direct-file claim. In-app motion controls remain reachable
only in Four-area views. No full Python suite/doctor was rerun; retained-fixture failures below
remain historical, not new release failures. Wrangler's dirty warning was solely the preserved
untracked owner note; all public source was committed and that file is not in the pack.

Offline SHA-256 `219203088d3ec9a4c7ae7536ac3651ffb541555dbd6aac0994ec8db0f7acdfc8`.
Public manifest SHA-256 `b613c8dabab9e75e14e87c5ba447e5a036f627662359bcf02993f71bb2de6104`.
Readback receipt SHA-256 `9a48697f50bf0160de26803bad1c04abb26686ddbd5834931a1010664a099980`.
Rollback target `f08b6b6f-c5d0-44f7-905b-5f16087fbc85`; no rollback needed.

Recommendation: retain the bounded D1 release; review v2 before more model work.
Top risks + mitigations: unregistered N2 parameters → S1; execution responsiveness → X1;
unmeasured learning impact → P0 study. Next3 actions: S1 owner decisions; separately approved
X1 seam; scope P2 vehicle-time strip, P0 Home/catalog prototype/study and R0 no-data lessons.

---

# FleetLab address and review follow-up — September 25 Pacific / September 26 UTC, 2026

Canonical public site: **https://fleetlab.pages.dev/**. New Production
`f08b6b6f-c5d0-44f7-905b-5f16087fbc85` serves the unchanged application source
`345b427cdddeb6e8946542c66786d3acbaacaa5c`; immutable address
https://f08b6b6f.fleetlab.pages.dev/. The old project/address is preserved with no redirect.
The owner explicitly requested this address change; it supersedes older local-only website
restrictions. Cloudflare does not support changing a Pages hostname in place.

The [self-contained Claude review packet](docs/FLEETLAB_DESIGN_DATA_AND_N2_REVIEW_2026-09-25.md)
contains the shipped context, live design audit, editorial-studio proposal, bounded Waymo
Motion research runbook, independent N2 audit and full unchanged N2 draft. There is no WOD
importer/data use in current product code. No dataset was downloaded, agreement accepted,
research runtime installed or N2/redesign code implemented. Four P1 N2 contract gaps and one
P2 wait-label correction should be resolved before an implementation freeze.

Validation for this follow-up: both current package checks passed; all 88 new-host public
payloads matched SHA-256; actual headers include restrictive CSP, nosniff, frame denial,
no-referrer and same-origin opener policy; the new-host browser default run returned 95/284,
with 176 unserved, 4 waiting and 9 in progress. The new-host Austin 60% shift reproduced
77/480 completed, 391 unserved, 11 waiting and 1 in progress. The independent audit's focused Node command
passed 24/24. Existing full release tests below remain commit-bound to unchanged source;
the full suite was not rerun for this address/documentation change. Python fixture limitations
remain disclosed. No other-worktree or main changes; owner's untracked note preserved.

Executed address commands:

```bash
node playground/fleetlab/tools/check-dist.mjs --site dist/site
node playground/fleetlab/tools/check-dist.mjs dist/fleetlab-playground.html
npx --yes wrangler@4.135.0 pages project create fleetlab --production-branch feat/fleetlab-playground --force
npx --yes wrangler@4.135.0 pages deploy dist/site --project-name fleetlab --branch feat/fleetlab-playground --commit-hash 345b427cdddeb6e8946542c66786d3acbaacaa5c --commit-dirty=false
npx --yes wrangler@4.135.0 pages deployment list --project-name fleetlab --json
python3 artifacts/fleetlab-design-review/verify_public.py https://fleetlab.pages.dev 345b427cdddeb6e8946542c66786d3acbaacaa5c
```

The first create attempt, without the Pages routing opt-out, failed while the CLI attempted
to delegate to Workers; it created no project/deployment. Installed Wrangler source confirmed
that this create command's `--force` only bypasses that platform delegation, not an overwrite
or Git operation. Project list was rechecked before the successful retry. Do not add the
flag to future deploy commands. The untracked owner file explains the deployment dirty-tree
warning; application paths and package bytes were unchanged.

Readback records: ignored `artifacts/fleetlab-design-review/published-readback.json` and
`fleetlab-headers.txt`. Original N2 SHA-256 remains
`c574b8df41d0378363e18f75452f09e15a2cf62581e8fb01f6f365229d7e25bf`.
The new Pages project has no earlier rollback release yet; historical old-project deployments
cannot be selected as new-project rollback targets. Use the updated
[publishing runbook](docs/FLEETLAB_CLOUDFLARE_DEPLOYMENT.md) for future releases.

# Previous-address FleetLab Austin release — September 25 Pacific / September 26 UTC, 2026

Published at **https://fleetlab-playground.pages.dev/** from source
`345b427cdddeb6e8946542c66786d3acbaacaa5c`, Production deployment
`6265159a-a13e-4ca7-9f9c-4acde9bcf6e7`. Source was pushed normally to
`feat/fleetlab-playground` and `codex/fleetlab-regional-power`; main is unchanged.

The [Austin runbook](docs/FLEETLAB_REGIONAL_POWER.md) describes the delivered N0/N1 slice.
The [N2 design draft](docs/plans/2026-09-25-fleetlab-n2-design.md) proposes one finite
event-pickup hub and explicit boarding metrics; no N2 implementation is approved or claimed.

Release validation: **1,791 Node passed** with performance enabled, zero fail/skip/cancel,
one existing TODO; **89 scoped Python passed**, Ruff and both packages passed. All **88 public
payloads** match. Hosted Austin replay/comparison, no-autorun sharing, the default Bay flow
and response security headers were verified. Broader Python retained-fixture failures remain
disclosed. See the final regional publication addendum below for commands, hashes and limits.

# Previous FleetLab design release — September 25, 2026 UTC

Published at **https://fleetlab-playground.pages.dev/** from source `96fde5b862119c9bbcd7a2ae76450f8dee616f93`,
deployment `e72ae87d-6b96-47a0-950d-4d4a87b8bb95`. The normal GitHub push targets
`feat/fleetlab-playground`; main is unchanged. The owner explicitly authorized publication.

The [complete review and next-phase brief](docs/FLEETLAB_REVIEW_AND_NEXT_PHASE_2026-09-25.md) covers the entire FleetLab trajectory,
accepted/rejected Muse feedback, shipped enhancements, exact release identity, validation,
known limits, all 56 lesson links and a ready-to-use ChatGPT review prompt.

Fresh release checks: **1,778 Node passed**, zero fail/skip/cancel and one existing browser-only
TODO; **89 Python playground parity/boundary passed**; Ruff, static/offline package checks and
whitespace passed. All **84 public files** match the local build. Response security headers
and live navigation, sharing, direct-lesson, invalid-link and deterministic-run flows passed.
The full repository Python fixture gate remains non-green: 1,433 pass, 186 fail, 42 errors,
56 skip. No Python or protected-path change. Native file-browser execution, real assistive
technology, cross-browser/device and page-load lab coverage remain unverified. A small existing
Street-panel literal-null rendering defect was observed and recorded for follow-up.

The [pre-publication report](docs/FLEETLAB_DESIGN_ENHANCEMENTS_HANDOFF_2026-09-24.md)
is preserved as a historical checkpoint. Publication records follow the deployed source in a
documentation-only commit; that does not change the served package.

# Previous M1–M4 release — September 24, 2026

The [depot milestones release](docs/FLEETLAB_DEPOT_RELEASE_2026-09-24.md) is published at
**https://fleetlab-playground.pages.dev/** from source `7874c7ed1453b97123946b43b153f80a7228088c`,
deployment `40858080-b229-44f1-8169-4f8b4faf5c86`. M1–M4 add staffing-aware readiness,
two charging treatments, compatible paired evaluation, resource observations, synthetic airport
preparation and configuration-driven launch rehearsal through the existing browser architecture.
The 56-lesson catalog connects each question, assumption and outcome to a fleet decision.

Observed gates: **1,714 Node tests pass**, zero fail/skip, one existing browser-only TODO
manually exercised; **89 Python parity/boundary tests pass**; Ruff, static and offline checks
pass. Final security scan `1d70bf64-6294-45d9-bb71-29588f1fbfa8` has complete scoped coverage,
zero findings and no deferred candidates. All **80 public files** match the reviewed package;
security headers, new lesson/stale flows and existing Fleet day/Street/regional flows were
checked live. Offline direct-file browser execution remains untested because browser policy
blocks it; no full unrelated Python/MetaDrive pass or zero-risk guarantee is claimed.

Code was committed in `Hermes-depot-m1` on `codex/fleetlab-m2-m3` and pushed without force
to `github/feat/fleetlab-playground` before Direct Upload. The final documentation-only commit
records publication and does not change deployed bytes. Main and other worktrees are unchanged;
no PR or main merge. The current user authorized this publication. All simulation outputs
remain `NOT_EVIDENCE`, simulation-only, deployment permission `NONE`; Python evidence contracts
are unchanged. See the release record for commands, package digests, controls, limitations and
rollback, and [M4 local instructions](docs/FLEETLAB_DEPOT_LAUNCH.md) for the reproducible demo.

## Previous homepage film release — historical

The [original AV homepage film](docs/FLEETLAB_FILM_RELEASE_2026-09-19.md) is published at **https://fleetlab-playground.pages.dev/** from source `f85a28f69a8a8819fea620d06837ae530a390030`, deployment `ccb82b11-986c-4ad1-8658-e1bc30917992`. The 16-second Blender film connects a waterfront ride, charging-depot readiness and the wider fleet. It includes preference-aware motion, pause and an offline poster. All 68 served files match the checked package. Public movie playback and the default Fleet day run were verified. JavaScript: 1,626 pass, zero failures, two skips, one existing TODO. Python parity/boundaries: 89 pass. Ruff and both distribution checks pass. The release record contains exact commands, media/offline hashes, visual and negative results, limitations and publication provenance. The [design rationale](docs/FLEETLAB_HOMEPAGE_FILM.md) and [authoring workflow](tools/fleet-film/README.md) explain the product framing and original assets.

The earlier [Street lab model and design record](docs/FLEETLAB_STREET_LAB.md) and [directed street data record](docs/FLEETLAB_STREET_MAP_DATA.md) describe the downtown SF, SFO and East Bay enhancement. Its release validation and publication identity are recorded in [the Street lab release handoff](docs/FLEETLAB_STREET_RELEASE_2026-09-19.md). These changes extend only the isolated static playground; Hermes Python, evidence contracts and main-branch integration remain unchanged. The whole Python suite's historical missing-fixture failures are not represented as passing. No real-fleet performance or safety claim is made.

See the [preceding public release record](docs/FLEETLAB_PUBLIC_RELEASE_2026-09-19.md) for the earlier Bay Area publication state, the [Cloudflare guide](docs/FLEETLAB_CLOUDFLARE_DEPLOYMENT.md) for owner steps, and the [repository recommendation](docs/FLEETLAB_REPOSITORY_RECOMMENDATION.md) for main integration. The explicit user request authorizes static publication and a feature-branch push. The [Bay Area 3D handoff](docs/FLEETLAB_BAY_AREA_3D_HANDOFF_2026-09-19.md) and [earlier operations wave](docs/FLEETLAB_OPERATIONS_HANDOFF_2026-09-19.md) preserve the preceding local-only checkpoints. The historical Hermes handoff below is unchanged.

# Hermes Phase 6 Codex handoff

## FleetLab experience redesign addendum — 2026-09-18

The current `feat/fleetlab-playground` worktree contains a local website redesign and a product/simulation audit.
See [the redesign handoff](docs/FLEETLAB_REDESIGN_HANDOFF_2026-09-18.md) for actual validation, package digests,
browser observations, unresolved fixture failures and remaining model limitations. This is a separate playground
presentation wave, not a new Phase 6 evidence contract. The historical handoff below is preserved.

## Current reviewer-comprehension addendum — 2026-08-13

The sections below preserve the original Phase 6 evidence-workbench handoff at `be57bb1`. The
current presentation-only iteration is on `feat/phase6-reviewer-comprehension`:

| Item | Current recorded result |
|---|---|
| Iteration start | `be57bb126d6339efe0d8184304620aab64a680a6` |
| Design freeze | `685b92df37e88a3232384fec4d57f5e9d8e5e089` |
| UX implementation | `e2eab3421973fb3d9ca554bc6da3f8953e3442de` |
| Submission-state hardening | `80439c5382cf5e0744cdcec7402633e4bcc81e1e` |
| Intermediate Browser-DOM Timeline parity fix | `cbced6e57670ae7aaf63f9ce875122ac7471e348` |
| Stable explicit H2-anchor fix / current pre-doc HEAD | `0fe3459ac87b78a023bb477ebf1210b2a9d31792` |
| Task 3 full suite | 746 passed |
| Final full / non-MetaDrive suites | 756 passed / 756 passed |
| Final focused 13-file matrix | 506 passed |
| Final installs / Ruff / doctor | both editable installs succeeded; Ruff passed; 17 PASS / 1 intended WARN / 1 DISPLAY NOT_AVAILABLE / 0 FAIL |
| Final CLI / artifact immutability | six reviews + three comparisons matched contracts; 100 canonical files unchanged |
| Task 3 adversarial result | GO; A01–A15 passed; no P0/P1 reproduced |
| Automated correctness | `OBSERVED` |
| Browser DOM structural walkthrough | `OBSERVED` for initial/PASS/HOLD/INVALID/Timeline/Provenance/limitations/compatible/incompatible states; no exception/leak |
| Manual visual review | `NOT YET OBSERVED` |
| Accessibility audit | `NOT YET OBSERVED` |
| Human comprehension | `NOT YET OBSERVED` |
| Remote actions | none |

The workbench now uses `Review` / `Compare` / `Evidence limitations`; Review contains
`Select & Verify`, `Overview`, `Evidence`, `Timeline`, and `Provenance`. Findings use six
requiredness-first groups, Timeline adds four presentation-only presets and supporting-event jump,
and compatible comparisons require mixed-outcome/no-advancement synthesis. Invalid quarantine and
the public ReviewEnvelope/ComparisonEnvelope 1.0 authority are unchanged.

Selection remains exact root-relative manual input. No picker/autocomplete was added because the
facade has no descriptor-safe discovery API; discovery first requires its own reviewed contract and
the deterministic synchronized bounded-LRU predecessor. The existing cache/session growth remains
accepted P2: 43 explicit selections previously reached 41 cache entries, 43 active sessions, and
about 251 MB peak RSS; restart recovers memory.

The current human-review package and final-iteration ledger are in:

- `PHASE6_DESIGN_ITERATION_HANDOFF.md`;
- `docs/PHASE6_USABILITY_TEST_PLAN.md`;
- `docs/PHASE6_HUMAN_OBSERVATION_TEMPLATE.md`; and
- `docs/PHASE6_VISUAL_REVIEW_CHECKLIST.md`.

The documentation-wave results are recorded in `PHASE6_DESIGN_ITERATION_HANDOFF.md`: 756 full, 756
non-MetaDrive, and 506 focused tests passed; both editable installs, repository Ruff, and
diff/cached checks passed; doctor reported 17 PASS, one intended 15-entry dirty-tree WARN, one
optional DISPLAY `NOT_AVAILABLE`, and no FAIL. Six review and three comparison CLI cases matched
their expected contracts, and 100 canonical files across ten retained artifact directories were
unchanged before/after. Do not treat those automated results, the historical 720-test results
below, or Task 3's 746-test result above as participant, screen-reader, contrast, or visual evidence.

The browser DOM walkthrough reproduced a first-Timeline-mount mismatch (radio indicated Decision
evidence while projection showed All tracks). Commit `cbced6e` fixed it RED-first; 88 scoped tests
and two independent targeted tests passed, and fresh DOM inspection confirmed All tracks plus the
exact 16-track multiselect. The in-app screenshot backend reported visibility false and returned
uniformly blank images, so no pixel/manual visual, 200% visual reflow, CSS focus, screen-reader,
contrast, accessibility-audit, or human-comprehension result is claimed.

The retained-state browser document object model (DOM) walkthrough additionally covered initial
UNVERIFIED, nominal PASS, collision HOLD, INVALID quarantine with no stored-PASS leak,
Timeline/action accountability, Provenance/limitations, compatible mixed comparison, and
incompatible fail-closed comparison without exception/leak. This remains structural DOM evidence,
not pixel/manual visual or accessibility evidence.

A second browser P2 showed stale Streamlit-generated H2 permalinks after radio reruns. Commit
`0fe3459` gives all seven primary H2s explicit stable anchors. Its targeted test failed then passed;
83 focused tests and two independent targeted tests passed, with Ruff/diff clean. Code/test closure
and narrow DOM closure are complete: fresh cross-section DOM observed Overview `#overview`, Timeline
`#timeline`, Compare `#compare`, and exception-text count 0. This does not promote manual visual,
accessibility, or human-comprehension status.

## 1. Executive summary

- **Phase attempted:** Phase 6 — local Evidence Review Workbench.
- **Highest completed milestone:** implementation, independent adversarial review, security
  hardening, and final local validation.
- **Verdict:** **GO** for the Phase 6 local, read-only, simulation-only scope.
- **Branch:** `feat/phase6-evidence-workbench`.
- **Starting commit:** `9e257a0cf0ddbdbf601b8a01deebe4de52de9763`.
- **Implementation/adversarial checkpoint:**
  `90fb7d891a233fea9fe5de915060873851da1d70`.
- **Ending commit:** the documentation-only `docs: finalize Phase 6 validation and handoff`
  commit is `HEAD` at delivery; its exact content-derived SHA is reported in the delivery response.
- **Working tree:** clean after the final local documentation commit and post-commit checks.
- **Remote actions:** none. Nothing was pushed, published, deployed, or configured remotely.

Hermes now reviews retained evidence through one immutable, verifier-owned path shared by the API,
CLI, and optional Streamlit workbench. The workbench does not run a simulator, policy, verifier
replacement, approval flow, or deployment action. The final adversarial decision is GO with no open
P0 or P1 finding. One restart-recoverable, explicit-selection-only cache-growth risk remains accepted
at P2.

## 2. Product boundary

Phase 6 remains:

- simulation and closed-lab only;
- local and loopback-only;
- read-only over explicitly selected artifact directories;
- unable to launch a simulator or policy from review;
- unable to edit, repair, approve, promote, release, or deploy anything;
- `NOT_AUTHENTICATED` for all current evidence;
- `NOT_EVALUATED` for authorization;
- `NONE` for deployment permission; and
- `SIMULATION_ONLY` in scope.

A Hermes `PASS` is a release-gate result over internally consistent stored simulation evidence. It
is not an authenticity, road-safety, certification, compliance, authorization, or deployment claim.

## 3. Design-freeze decisions

| Decision | Final choice | Rationale | Document |
|---|---|---|---|
| Canonical bundle inventory | Exactly 10 files | One contract shared with stored verification; no workbench-specific bundle | `docs/PHASE6_REVIEW_ENVELOPE_CONTRACT.md` |
| `ReviewEnvelope` version | `1.0` | Strict, deterministic, portable, category-bearing review contract | same |
| `ComparisonEnvelope` version | `1.0` | Exact compatible/incompatible union with no winner score | same |
| Evidence-sufficiency model | Core-owned required/optional/not-applicable plus availability and consequence | Prevents UI inference or missing-as-success presentation | same |
| UI framework | Streamlit | Locally testable with AppTest and cleanly optional | `docs/PHASE6_ARCHITECTURE_AND_TRUST_MODEL.md` |
| Optional dependency model | `workbench` extra | Core/CLI remain importable without Streamlit | `pyproject.toml` |
| Artifact-root policy | Explicit, canonical non-symlink directory; exact relative selection text | Fail-closed containment and no newest-run discovery | architecture document |
| Cache policy | Digest/schema/tool/locator key plus private capture identity; consistent evidence only | Cache is non-authoritative and mutation invalidates the session | envelope contract |
| Resource bounds | 16 MiB/file, 64 MiB/bundle, 10,000 events, 1 MiB/event line | Existing verifier ceilings, enforced before accepted review | envelope contract |
| Local bind policy | Numeric loopback only; default `127.0.0.1:8501` | No public or multi-user Phase 6 deployment | architecture document |

## 4. Architecture implemented

```text
explicit artifact root + exact relative selection
→ descriptor-relative, no-follow immutable capture
→ existing stored verification / comparison core
→ immutable ReviewEnvelope / ComparisonEnvelope
→ bounded inert presentation projection
→ shared CLI or loopback-only read-only workbench
```

`hermes.evidence.verification` owns bounded capture and stored recomputation. `hermes.review.models`
owns strict portable schemas. `hermes.review.projection` maps one captured snapshot without reopening
artifact paths. `hermes.review.facade` owns validated roots, exact locators, private capture identity,
cache/session invalidation, and comparison reuse. The CLI and workbench import the public review
surface. Workbench code cannot import adapters, policies, runtime, shields, faults, gates, verifiers,
or MetaDrive, and automated AST/import/process/network tests enforce that boundary.

## 5. Files changed

The authoritative implementation inventory is:

```bash
git diff --name-status 9e257a0cf0ddbdbf601b8a01deebe4de52de9763..HEAD
```

It is grouped as follows:

- **Root/config:** Phase 6 prompts, plans, policy/handoff files, README, and the optional Streamlit
  extra in `pyproject.toml`.
- **Review core:** hardened capture in `src/hermes/evidence/verification.py`; immutable gate/review
  registries; new `src/hermes/review/{models,projection,facade}.py` and package exports.
- **Workbench:** new `src/hermes/workbench/{launcher,app}.py` and package boundary.
- **CLI:** review/compare/workbench commands, lazy imports, stable exit taxonomy, and safe bounded
  text projection.
- **Tests:** schema, capture/TOCTOU, facade/cache, projection, comparison, CLI, AppTest, 10,000-event
  paging, architecture/import, loopback, immutability, and retained-artifact integration coverage.
- **Documentation:** Phase 6 architecture, contract, PRD, UX, threat/authenticity, traceability,
  decision log, demo runbook, design handoff, adversarial report, and this final handoff.

No generated artifact, simulator checkout, virtual environment, cache, or package metadata was
staged.

## 6. Dependencies

| Dependency | Version bound | Extra/runtime | Why added |
|---|---|---|---|
| Streamlit | `>=1.37,<2` | optional `workbench` | Local six-screen reviewer UI and AppTest |

The runtime dependencies remain Pydantic, PyYAML, Rich, and Typer. No cloud SDK, database, ML stack,
telemetry package, authentication service, upload stack, or signing dependency was added.

## 7. Review and comparison contracts

### `ReviewEnvelope`

- **Version:** `1.0`.
- **Key fields:** categorized artifact identity/inventory/digests; integrity; five independent trust
  dimensions; gate identity/verdict; evidence sufficiency; exact findings/metrics; complete bounded
  timeline; recorded provenance; diagnostics; assumptions; unavailable evidence; limitations.
- **Invalid behavior:** returns a portable `INVALID_EVIDENCE` envelope with safe partial identity,
  diagnostics, empty accepted findings/metrics/timeline, and `QUARANTINED` provenance. A stored PASS
  is never rendered as accepted.
- **Determinism:** strict sorted/registry order, canonical JSON, exact values/units/references, no
  filesystem metadata in portable output, and no review timestamp.
- **Review-time state:** root path, descriptor identities, active session, and cache remain private
  and non-serialized.

### `ComparisonEnvelope`

- **Version:** `1.0`.
- Both sides are independently captured and reviewed before the existing comparison core runs.
- Incompatible evidence returns reasons/warnings and safe side identity with no deltas or charts.
- Compatible evidence projects all 11 core dimensions exactly once: eight outcome dimensions are
  partitioned into improvement, regression, unchanged, or not-comparable, while verdict, hard
  failures, and evidence availability use three dedicated records.
- **Winner score:** absent. Intervention count is descriptive, not ordinal.

## 8. Trust semantics

The CLI and every workbench evidence surface keep these values separate:

| Dimension | Phase 6 value or source |
|---|---|
| Gate verdict | `PASS`, `CONDITIONAL`, `HOLD`, or `INVALID_EVIDENCE` from the existing gate |
| Integrity | `INTERNALLY_CONSISTENT`, `INVALID_EVIDENCE`, or transient `UNVERIFIED` |
| Authenticity | `NOT_AUTHENTICATED` |
| Authorization | `NOT_EVALUATED` |
| Deployment permission | `NONE` |
| Scope | `SIMULATION_ONLY` |
| Authoritative status | `NOT_DEFINED` |

Every portable/displayed evidence item is categorized as `OBSERVED`, `COMPUTED`, `GATE_DECISION`,
`ASSUMPTION`, `NOT_AVAILABLE`, `AUTHENTICITY`, or `RESIDUAL_RISK`. Color is never the sole carrier.

## 9. Commands executed and results

Final validation used Python 3.11.15 in Conda environment `hermes-dev`:

| Command | Exit | Actual result |
|---|---:|---|
| `python -m pip install -e ".[dev,workbench]"` | 0 | editable `hermes-autonomy==0.1.0`; Streamlit 1.61.1 available |
| `python -m pip install -e ".[dev]"` | 0 | core development install remains valid without requiring the optional UI |
| `python -m pytest -q` | 0 | **720 passed** |
| `python -m pytest -q -m "not metadrive"` | 0 | **720 passed**; real simulator tests were not launched |
| focused Phase 6 adversarial matrix | 0 | **488 passed** |
| representative negative/trust-boundary matrix | 0 | **39 passed** |
| `python -m ruff check .` | 0 | all checks passed |
| `python -m hermes doctor` | 0 | 17 PASS, one expected dirty-tree WARN, one optional display `NOT_AVAILABLE`, no FAIL |
| `git diff --check` | 0 | no whitespace errors |

Six retained valid envelopes emitted **12,801** source-reference instances; every reference resolved
against the already captured typed documents without a path reopen.

The 488-test focused command was:

```bash
python -m pytest -q \
  tests/unit/test_review_capture.py \
  tests/unit/test_artifact_verification.py \
  tests/unit/test_verifiers_and_gate.py \
  tests/unit/test_review_models.py \
  tests/unit/test_review_facade.py \
  tests/unit/test_review_projection.py \
  tests/unit/test_review_comparison.py \
  tests/integration/test_review_artifacts.py \
  tests/unit/test_architecture_boundaries.py \
  tests/unit/test_workbench_launcher.py \
  tests/unit/test_workbench_projection.py \
  tests/integration/test_workbench_smoke.py \
  tests/cli/test_review_cli.py
```

The exact 17-node negative/trust-boundary command is recorded in section 13. The representative
public CLI commands were:

```bash
hermes review-artifact handoff-phase5-demo --artifact-root artifacts --format json
hermes review-artifact handoff-p1-conditional --artifact-root artifacts --format json
hermes review-artifact handoff-p1-collision --artifact-root artifacts --format json
hermes review-artifact phase1-tampered --artifact-root artifacts --format json
hermes review-artifact handoff-p2-metadrive --artifact-root artifacts --format json
hermes review-artifact handoff-p4-fault --artifact-root artifacts --format json
hermes review-compare handoff-p3-lead-baseline handoff-p3-lead-shielded \
  --artifact-root artifacts --format json
hermes review-compare handoff-p3-cutin-baseline handoff-p3-cutin-shielded \
  --artifact-root artifacts --format json
hermes review-compare handoff-p3-lead-baseline handoff-p3-cutin-shielded \
  --artifact-root artifacts --format json
```

## 10. Review artifact demonstrations

All valid cases report `NOT_AUTHENTICATED`, `NOT_EVALUATED`, `NONE`, and `SIMULATION_ONLY`.
Review-operation exit is 0 even when the gate is `CONDITIONAL` or `HOLD`; invalid integrity exits 30.

| Artifact path | Gate | Integrity | Authenticity | Exit | Computed bundle digest | Events / findings / metrics / tracks |
|---|---|---|---|---:|---|---|
| `artifacts/handoff-phase5-demo` | `PASS` | `INTERNALLY_CONSISTENT` | `NOT_AUTHENTICATED` | 0 | `fd42b8399ba32853a587a63fee7aba9803c5918539b6053b1554937abcc13334` | `40 / 6 / 13 / 16` |
| `artifacts/handoff-p1-conditional` | `CONDITIONAL` | `INTERNALLY_CONSISTENT` | `NOT_AUTHENTICATED` | 0 | `752ba4725930d62335c1469ceebee6f7517d24265f8c945f68e45d2e7cb41cb4` | `39 / 6 / 13 / 16` |
| `artifacts/handoff-p1-collision` | `HOLD` | `INTERNALLY_CONSISTENT` | `NOT_AUTHENTICATED` | 0 | `723e814d0aea399dc2590dd0f1d5b09b20a03a28cadb49c062610894049ae27c` | `13 / 6 / 13 / 16` |
| `artifacts/phase1-tampered` | `INVALID_EVIDENCE` | `INVALID_EVIDENCE` | `NOT_AUTHENTICATED` | 30 | `831f22ed419e4b13ce5d0a1aa3bc1444b2ca523d60edb8d4c75eaa7491e1d61e` | `0 / 0 / 0 / 0` |
| `artifacts/handoff-p2-metadrive` | `PASS` | `INTERNALLY_CONSISTENT` | `NOT_AUTHENTICATED` | 0 | `78b6b15f96b3e2c3aacdbd525031cd82b54ccf7f17e162b36cff9dfba436ab42` | `165 / 6 / 13 / 16` |
| `artifacts/handoff-p4-fault` | `HOLD` | `INTERNALLY_CONSISTENT` | `NOT_AUTHENTICATED` | 0 | `83ba9b39b764fb3f09f9fc70f2adfb42415a73ef3b43b655c1a639d49761c43f` | `20 / 7 / 19 / 16` |

The tampered bundle reports bundle/events/current-event-hash mismatches, quarantines its stored PASS,
and exposes no accepted finding, metric, timeline, or stored provenance claim. The fault artifact's
seven-mechanism coverage finding passes; missing mission progress causes its HOLD.

## 11. Comparison demonstrations

| Artifact pair | Status / exit | Verdicts | Improvement | Regressions | Availability deltas | Other |
|---|---|---|---|---|---|---|
| `artifacts/handoff-p3-lead-baseline` → `artifacts/handoff-p3-lead-shielded` | `COMPATIBLE` / 0 | `CONDITIONAL` → `CONDITIONAL` | minimum TTC `11.585881563948043` → `13.338911253788899 s` | route completion, max acceleration, max jerk | none | collision/latency/source/verdict unchanged; intervention descriptive; 6 charts |
| `artifacts/handoff-p3-cutin-baseline` → `artifacts/handoff-p3-cutin-shielded` | `COMPATIBLE` / 0 | `HOLD` → `HOLD` | minimum TTC `1.8155836417275437` → `8.49579415469856 s` | route completion, max acceleration, max jerk | none | same unchanged/not-comparable partition; 6 charts |
| `artifacts/handoff-p3-lead-baseline` → `artifacts/handoff-p3-cutin-shielded` | `INCOMPATIBLE` / 40 | `CONDITIONAL` → `HOLD`; both sides internally consistent | none | none | no deltas permitted | scenario/adapter-config mismatch; zero deltas/charts |

These are mixed trade-offs, not shield wins. No UI-specific winner is computed.

## 12. Artifact immutability

- The representative matrix hashed every file in ten retained artifact directories before and after
  nine review/compare commands. Every aggregate directory hash was identical.
- Capture tests cover file growth, partial reads, selected/intermediate/root swaps, symlink swaps,
  root replacement, rename-back probes, unsupported descriptor operations, and descriptor cleanup.
- Metadata-only touch or same-byte replacement forces full recapture and invalidates active review;
  changed bytes/digest at the same locator never return the cached envelope. Both comparison sides
  receive the same pre-render check.
- Cache identity includes computed bundle digest, review-schema version, Hermes version, and exact
  relative locator; device/inode/mode/size/mtime/ctime remain facade-private and cannot serialize.
- Only internally consistent, non-null-digest envelopes are cacheable; invalid evidence is never
  cached.

One adversarial reviewer accidentally touched only the mtime/ctime of retained
`handoff-phase5-demo/events.jsonl`. No bytes changed; all ten SHA-256 values matched, Git content
status stayed clean, and immediate/final facade review retained the same PASS, bundle digest, trace
digest, 40 events, and 16 tracks. The deviation is disclosed in `PHASE6_ADVERSARIAL_REVIEW.md`; no
metadata reconstruction was attempted.

## 13. Security and negative tests

| Category | Result | Residual limitation |
|---|---|---|
| Path and symlink | absolute/empty/dot/traversal/alias/NUL and symlink root/selection/components reject before review/process launch | explicitly selected local root is still operator-provided |
| TOCTOU and cache | swaps, growth, replacement, touch, recapture, key isolation, FD cleanup pass | OS/host compromise is outside assurance |
| Invalid stored PASS | quarantined envelope, diagnostics, no accepted result | no repair/migration feature by design |
| XSS/control content | inert Streamlit TextColumn; Cc/Cf/ANSI-visible CLI; exact 1,024-scalar bound and metadata | JSON intentionally preserves exact full portable content |
| Resource bounds | 16 MiB/file, 64 MiB total, 10,000 events, 1 MiB/line; deterministic 10k paging | valid-limit work can still consume local resources |
| Numeric precision | machine/canonical/display values and units preserved; thresholds/tree/source refs exact | display is non-authoritative |
| `NOT_AVAILABLE` | explicit availability, reason, category; never zero/false/blank/Python `None` | source-permitted absence remains absence |
| Dependency boundary | AST and clean-process bombs cover runtime/adapters/policies/MetaDrive and prohibited authority/I/O calls | Python process compromise remains out of scope |
| Local-only bind | numeric loopback only; public/hostname binds reject before child process | no authentication because no multi-user service exists |
| Simulator isolation | full non-MetaDrive suite, import bombs, source-byte checks, no reset/step or simulator launch | review recomputes stored verifiers/gate but does not reexecute policy/simulator |

Adversarial hardening also made the release/review registries immutable and converted malformed YAML
constructor errors or finite-value derived-metric overflow into bounded quarantined invalid evidence.

The exact representative negative command was:

```bash
python -m pytest -q \
  tests/cli/test_review_cli.py::test_review_text_neutralizes_all_c0_c1_controls_and_ansi_from_artifact_text \
  tests/cli/test_review_cli.py::test_review_text_bounds_each_direct_scalar_at_input_scalar_boundary \
  tests/cli/test_review_cli.py::test_review_cli_rejects_nonexact_or_root_prefixed_selection \
  tests/cli/test_review_cli.py::test_review_commands_reject_missing_or_symlink_artifact_root \
  tests/cli/test_review_cli.py::test_workbench_cli_rejects_public_bind_as_configuration_error_without_streamlit \
  tests/unit/test_review_capture.py::test_root_contained_capture_rejects_symlink_root_selected_directory_and_intermediate_directory \
  tests/unit/test_review_capture.py::test_root_contained_capture_detects_mutation_without_reopening_artifact_paths \
  tests/unit/test_review_capture.py::test_root_contained_capture_rejects_directory_swap_after_descriptor_traversal \
  tests/unit/test_review_capture.py::test_root_contained_capture_rejects_configured_root_replacement_after_open \
  tests/unit/test_review_facade.py::test_changed_artifact_bytes_never_return_prior_cached_envelope \
  tests/integration/test_workbench_smoke.py::test_workbench_review_and_comparison_preserve_every_source_bundle_byte \
  tests/integration/test_workbench_smoke.py::test_workbench_active_rerun_recaptures_mutated_bundle_and_invalidates_review \
  tests/integration/test_workbench_smoke.py::test_workbench_apptest_performs_no_network_browser_or_child_process \
  tests/integration/test_workbench_smoke.py::test_workbench_apptest_bombs_runtime_simulator_policy_and_adapter_imports \
  tests/unit/test_architecture_boundaries.py::test_review_surfaces_bomb_runtime_and_simulator_imports \
  tests/integration/test_review_artifacts.py::test_retained_valid_artifacts_project_without_simulator_execution \
  tests/integration/test_review_artifacts.py::test_retained_tampered_artifact_quarantines_stored_pass
# 39 passed
```

## 14. Workbench launch

```bash
hermes workbench --artifact-root artifacts --host 127.0.0.1 --port 8501 --no-browser
```

---

## Regional power implementation addendum — 2026-09-24 Pacific / 09-25 UTC

This addendum describes the current FleetLab website work. The Phase 6 checkpoint above is
historical; its clean-tree and completion statements do not describe this working tree.

### Executive summary and scope

- **Request:** read the supplied regional simulation brief and build. Its embedded prompts were
  treated as proposal content; the user's explicit “build, go” authorized the recommended N0/N1
  Austin slice. The later region and dataset proposals remain deferred.
- **Highest milestone:** N0 code/contract mapping and N1 synthetic Austin site-power demo,
  paired evaluation, recorded vehicle inspection, setup sharing, exports and local packages.
- **Verdict:** ready for local feature review; **HOLD repository-wide green/integration claims**.
- **Branch:** `codex/fleetlab-regional-power` in the existing `Hermes-fleetlab` worktree.
- **Starting and ending HEAD:** `4b7a2768d93891fab95383d4c20cf828f56b2557`.
- **Working tree:** intentionally dirty. No commits, staging, merge, push, PR, deployment,
  publication, remote edits or changes to another worktree.
- **Baseline selection:** the opening worktree was on `feat/phase9-metric-contract` at
  `9daacef` without the website. The inspected `codex/fleetlab-m2-m3` tip supplied the newer
  release, including application source `96fde5b862119c9bbcd7a2ae76450f8dee616f93`.
  The new local branch starts there. The owner's untracked
  `FleetLab-ChatGPT-review-and-next-phase.md` remains untouched.

### Product boundary and design decisions

Browser calculations are **SIMULATION_ONLY / NOT_EVIDENCE / deployment permission NONE**.
No Python `ReviewEnvelope`, `ComparisonEnvelope`, canonical bundle, verifier, gate or workbench
behavior changed. No new Phase 6 bundle or trust-state demonstration was generated. Experiment
recommendations such as `HOLD` concern the existing browser policy experiment; they are not
Hermes evidence-gate verdicts or release authority. Hashes identify content and do not
authenticate it. The UI uses synthetic locations and operating inputs, with no real airport
access, vehicle safety, commercial coverage, calibration or affiliation claim.

The Phase 6 design/implementation gate applies to that separate review product. This task
adds to the existing website teaching model; the conflict and scope decision are recorded in
`docs/plans/2026-09-25-regional-power.md`. No Phase 6 prompt was executed.

| Decision | Implementation |
|---|---|
| Regional package | `region-package-1.0.0`, pinned five-node Austin schematic, two fictional depot identities, explicit local-meter to kilometer conversion, graph shortest paths |
| Source registry | Synthetic status per input family, units, transformation/version, graph digest, missing measured fields; timezone is a display label only |
| Power contract | `site-power-profile-1.0.0`; 1–48 contiguous integer half-open intervals exactly covering `[0,H)`, finite fractions in `[0,1]`, one known site |
| Allocation boundary | Apply external current cap before existing policy allocation; policy sees the current scalar, not the future power tape |
| Accounting | No energy after H; terminal frame retains last cap for context; no thermal, auxiliary, loss or taper mechanism added |
| Experiment | Existing completion primary and paired mean-harm guardrails; graph digest/source version bound into the regional spec; no new winner score |
| Sharing | Distinct strict `regional-power` codec, current/last-run/last-experiment snapshots, no automatic execution; older setup models unchanged |
| Interface | Existing native DOM and CSS, compact Fleet day panel, recorded-minute/vehicle inspection; no framework or dependency added |
| Responsiveness | Yield between full arms and bootstrap steps; cancellation at those boundaries; retain measured per-arm stall limitation |

### Architecture and changed surfaces

`region-package.js` and `site-power.js` validate explicit opt-in inputs. The existing
`bay-operations.js` lifecycle and `bay-systems.js` charging/accounting consume them.
`regional-power.js` supplies demo configurations. `bay-experiment-contract.js` retains the
statistical and validity authority. `regional-power-view.js` renders results; it does not
implement a second simulator, allocation policy or comparison method.

- Model: three new regional/power modules and narrow opt-in hooks in the three Bay modules.
- Interface: regional panel, operations integration, sharing/codec/studio options and styles.
- Validation: three new test files, 13 tests; existing distribution checker includes new UI copy.
- Development tool: `tools/fleet_playground/regional_power_demo.mjs`, outside the read-only
  browser tree. Writes only requested local rehearsal output.
- Documentation: the plan, `docs/FLEETLAB_REGIONAL_POWER.md`, `HERMES_SOURCE_OF_TRUTH.md`
  §7.5 and this addendum.
- Unchanged: Python implementation/tests, `pyproject.toml`, existing evidence contracts,
  numerical defaults, lesson routes and publication configuration.

### Actual commands and validation

Python commands below used Python 3.11 through
`artifacts/fleetlab-regional-power/venv/bin/python`, with `PYTHONPATH="$PWD/src"` so imports
resolve this worktree. The local environment uses the existing dependency set; the shared
Conda environment's editable installation was not repointed.

| Command | Exit | Actual result |
|---|---:|---|
| `python -m pip install --no-deps --no-build-isolation -e '.[dev,workbench]'` | 0 | Installed local editable `hermes-autonomy` 0.1.0 in the artifact-local venv |
| `node --test 'playground/fleetlab/test/*.test.mjs'` | 0 | **1,779 passed, 0 failed, 2 skipped, 1 todo**; 1,782 tests, 245 suites |
| `FLEET_PLAYGROUND_PERF=1 node --test playground/fleetlab/test/performance.test.mjs` | 0 | **9/9 passed** in isolation |
| `FLEET_PLAYGROUND_BASE=bca4ccd PYTHONDONTWRITEBYTECODE=1 python -m pytest -q tests/unit/test_fleet_playground_parity.py tests/unit/test_fleet_playground_boundaries.py` | 0 | **89 passed** |
| `python -m pytest -q` | 1 | **1,433 passed, 186 failed, 42 errors, 56 skipped**; repeats the recorded broader fixture-failure baseline |
| `python -m ruff check .` | 0 | All checks passed |
| `python -m hermes doctor` | 0 | **16 PASS, 2 WARN, 1 optional NOT_AVAILABLE**; ambient Conda `base` label and dirty tree warnings; no simulator launched |
| `git diff --check` | 0 | No whitespace errors |
| `node tools/fleet_playground/regional_power_demo.mjs --out artifacts/fleetlab-regional-power/demo` | 0 | Four conditions × 12 evaluation seeds × two policies, 16 replay probes and one development replay |
| `node playground/fleetlab/tools/pack.mjs --out dist/fleetlab-regional-power.html` | 0 | 2,543,655 bytes; below unchanged 2,621,440-byte application budget |
| `node playground/fleetlab/tools/check-dist.mjs dist/fleetlab-regional-power.html` | 0 | Offline package checks passed |
| `node playground/fleetlab/tools/pack.mjs --site dist/regional-site` | 0 | 89 files, 3,181,153 bytes |
| `node playground/fleetlab/tools/check-dist.mjs --site dist/regional-site` | 0 | Static package checks passed |

The initial standard Node baseline was 1,766 passed with the same two skips and one todo.
Optional performance tests run within the whole suite exceeded the old regional p95 8 ms
budget twice (12.76 ms and 8.58 ms); the isolated nine-test timing run passed. Do not describe
the complete opt-in timing suite as green or silently relax its budget. An accessibility
target-size token and the development tool's initial placement inside the browser tree were
fixed; the final standard suite includes those checks. Missing Python fixtures were not
manufactured, regenerated or excluded. Logs are under `artifacts/fleetlab-regional-power/`.

Negative coverage includes gaps/overlaps/versions/sites, interval edges, full-power identity,
zero-power occupied ports, physical cap/energy accounting, resource truth/observation separation,
work and service populations, same-seed replay, malformed shared setups and short-horizon
preset changes. Existing tests cover legacy setup compatibility and browser/Python boundaries.

### Local rehearsal, records and digests

The four tests share 40 vehicles, 480 minutes, two fictional 120 kW sites and 60 requests/hour.
Only the Site A external condition changes: full, 60%, 20%, or zero during `[90,180)`.
Within each test, capped redistribution and deadline/aged priority share external inputs and
evaluation seeds 1001–1012, disjoint from declared tuning seeds 42–44. The practical primary
margin remains 0.02. No operating parameters were tuned against evaluation outcomes.

| Condition | Candidate minus baseline completion fraction | Primary classification | Existing recommendation | Guardrail observation |
|---|---:|---|---|---|
| Full | 0.005034722222222225 | UNCHANGED | NO_RECOMMENDATION | All within |
| 60% | 0.00190972222222222 | UNCHANGED | HOLD | Mean unfinished visits increased by 0.3333333333333333; allowed harm 0 |
| 20% | 0.006944444444444443 | UNCHANGED | NO_RECOMMENDATION | All within |
| Outage | 0.00590277777777778 | UNCHANGED | HOLD | Mean terminal-energy harm 5.392090651592032 kWh; allowed harm 5 |

Complete paired results, intervals, guardrails, per-seed outcomes, required-work inventory,
region provenance and power traces remain in the generated JSON. Completion over all requests
is retained; all-request within-target pickup is explicitly unavailable. These overloaded
synthetic cases are not successful operating plans or calibrated regional forecasts.

| Object | SHA-256 identity |
|---|---|
| Region graph | `fa30de4f4796a8ca254427f9927f9ed9017c888c2fa68e896ed53c4bd9770352` |
| Full experiment spec | `d4d07ad0167b9c42774266bfa3b1d3a784a52163c6de47171a7836a45246a948` |
| 60% experiment spec | `294fa1555ae60ba7f8ee5584f7da50f2be09421462896607a5dd72c79f573f56` |
| 20% experiment spec | `445720105454737f3bdd1e68814dd9ed95961f061f56c296ec4e9e0a278f4445` |
| Outage experiment spec | `3e89005a12e3c4f95652cfc19a2d86ea5f0e5a80b3584c735337417754eb24ab` |
| `demo/observed-results.json` | `5f817632dd1da51c81dd1acb8d397c61db2113c94d1e584a4d67650050da8a5a` |
| `dist/fleetlab-regional-power.html` | `4b7b09fd0a2f4773406b61df2f2faa97d85dc51194575a76a184c80ef416c939` |
| `dist/regional-site/index.html` only, not whole tree | `97ec391c70a0df2ce392065692128c23a5876848a3369ea723acee1031a50cbe` |

Generated exports honestly record source HEAD plus `dirty: true`; the commit alone does not
reconstruct this uncommitted implementation. Rebuilds can change package hashes. The artifacts
are ignored local outputs; none were staged as evidence or fixtures.

### Independent review and browser observations

A separate read-only review found two P2 defects: choosing a condition after loading a short
shared horizon installed a fixed 480-minute profile; paired exports omitted source provenance.
Both were fixed and covered by red/green regression tests. Canonical key-order comparison also
fixes a decoded preset being mislabeled custom. The reviewer independently ran all 13 new
tests successfully; no Critical findings were reported. This was bounded correctness review,
not a repository-wide security scan or evidence of real-world validity.

In the in-app Chromium 152 browser on this Mac, source, static package and the offline package
served over loopback booted. An actual shared last-run setup restored the previous moderate
condition after current controls changed to outage, with no automatic execution. Source and
offline runs matched. At a 400 px viewport, document width remained within the viewport and
wide tables scrolled internally. Recorded results and responsive layout were visually inspected.

Instrumented actual clicks at 1280×720 measured default Bay 34.1 ms, busy-depot Bay 27.6 ms,
Austin replay 48.4 ms, and the 12-seed Austin pair 603.7 ms from click to completed result.
First-frame times were 9.9, 9.7, 11.1 and 10.5 ms respectively; no over-50-ms task was recorded
in these samples. A 120-vehicle comparison recorded individual 62–83 ms tasks. Cancellation
worked between arms (0.3 ms after click dispatch, excluding time waiting for dispatch).
These are bounded observations, not latency guarantees. The UI cannot interrupt a synchronous
arm. Physical mobile devices, other browsers, direct `file://` launch, screen-reader behavior
and formal human usability have not been assessed. The pre-existing cosmetic Street `null`
observation was not reproduced or altered.

### Recommendation, remaining risks and next actions

Review this N1 locally before widening regional scope. Retain the full-suite fixture failures,
timing sensitivity, synchronous-arm cancellation limit, synthetic data and unavailable pickup
metric as explicit limitations. No worker, new primary metric or dataset ingestion is implied.

1. Inspect the default and outage cases, including unfinished work and terminal energy.
2. Address the retained Python fixture baseline before claiming a green repository or integrating.
3. Select one next measured assumption or separately reviewed mechanism; defer additional regions,
   thermal behavior, Street coupling, Waymo/Open Dataset work, cloud, signing and physical hardware.

### Single best next command

```bash
python -m http.server 8765 --bind 127.0.0.1 --directory playground/fleetlab
```

Open `http://127.0.0.1:8765/#/fleet-day`, expand **Regional stress lab: Austin power and
readiness**, and run explicitly. Choose an unused port if 8765 is occupied. At handoff the
static preview is also running on loopback at
`http://127.0.0.1:60689/regional-site/#/fleet-day`. No external service is required.

## Regional publication follow-up — 2026-09-25 Pacific / 09-26 UTC

The owner explicitly requested deployment and GitHub push after receiving the local result
and disclosure of the wider Python fixture failures. That current instruction supersedes
the earlier no-push/local-only restriction for the static website. The release uses the
existing website branch and Cloudflare Pages project; it is not a main merge or authorization
to advance the Python evidence lane. The next-phase design remains a draft only.

The original local-build statements above are historical. Publication succeeded with the
identities and checks below; this does not establish repository-wide green status.

Fresh release checks before commit: `FLEET_PLAYGROUND_PERF=1 node --test --test-concurrency=1
playground/fleetlab/test/*.test.mjs` exited 0 with **1,791 passed, zero failed/skipped/cancelled,
one existing TODO**, 1,792 tests and 245 suites. Website Python parity/boundary checks again
passed **89/89**, Ruff and `git diff --check` passed. Static `dist/site` and offline
`dist/fleetlab-playground.html` were rebuilt and passed both distribution checks at the same
89 files / 3,181,153 bytes and 2,543,655 bytes respectively. The older timing failures remain
part of the record; this run does not establish a latency guarantee. No product code changed
between local handoff and these checks. GitHub website head was still `4b7a276`, main was
`bca4ccd`, and Cloudflare's current Production deployment was still `e72ae87d` from `96fde5b`.

### Published identity and commands

| Surface | Observed identity |
|---|---|
| Application source | `345b427cdddeb6e8946542c66786d3acbaacaa5c` |
| GitHub source branches | `feat/fleetlab-playground` and `codex/fleetlab-regional-power` |
| Production deployment | `6265159a-a13e-4ca7-9f9c-4acde9bcf6e7` |
| Stable address | https://fleetlab-playground.pages.dev/ |
| Immutable address | https://6265159a.fleetlab-playground.pages.dev/ |
| Previous Production / rollback target | `e72ae87d-6b96-47a0-950d-4d4a87b8bb95`, source `96fde5b862119c9bbcd7a2ae76450f8dee616f93` |
| Main unchanged | `bca4ccd4d881e58904e59bb1b1ff594442099654` |

Executed successfully, after staged status/diff/whitespace review:

```bash
git commit -m "feat(playground): add Austin regional power stress lab"
git push --atomic github HEAD:refs/heads/codex/fleetlab-regional-power HEAD:refs/heads/feat/fleetlab-playground
node playground/fleetlab/tools/pack.mjs --site dist/site
node playground/fleetlab/tools/check-dist.mjs --site dist/site
npx --yes wrangler@4.135.0 pages deploy dist/site \
  --project-name fleetlab-playground --branch feat/fleetlab-playground \
  --commit-hash 345b427cdddeb6e8946542c66786d3acbaacaa5c --commit-dirty=false
npx --yes wrangler@4.135.0 pages deployment list --project-name fleetlab-playground --json
git ls-remote github refs/heads/feat/fleetlab-playground refs/heads/codex/fleetlab-regional-power refs/heads/main
```

The two source branches both read back at the exact commit above. No force, PR, main merge,
remote-URL change or other-worktree checkout change occurred. Wrangler's dirty warning was
caused by the unrelated owner review file (and later the draft); committed application paths
were clean. Only the 89-file `dist/site` package was uploaded. The offline HTML and index
hashes match the local-build hashes recorded above. Publication documentation and the N2 draft
are a subsequent documentation-only commit; they do not change deployed application bytes.

All **88 public payloads** match their local SHA-256 values. `_headers` is server configuration;
actual responses retain restrictive CSP including `connect-src 'none'`, frame denial,
nosniff, no-referrer and same-origin opener policy. The first Python HTTP probe returned 403;
normal curl requests succeeded without credential/access changes. Logs and per-file hashes
are in ignored `artifacts/fleetlab-regional-power/published-readback.json`,
`public-headers.txt`, `release-node.txt` and `release-deployments.json`.

Hosted browser acceptance: moderate Austin replay **77/480 completed**, with 391 unserved,
11 waiting and one in progress; 12 paired seeds **VALID / UNCHANGED / HOLD**, unfinished-visits
harm **0.3333333333333333**. Last-experiment sharing restored without autorun. Existing default
Bay run remained **95/284**. No console errors were observed during these actions.

### Next design and release recommendation

The requested [N2 design draft](docs/plans/2026-09-25-fleetlab-n2-design.md) proposes two
synthetic event waves at one fictional Las Vegas pickup hub, finite approach/berth capacity,
explicit arrival-versus-boarding events, and responsive execution prerequisites. It includes
versioning, paired experiments, fresh seed discipline, staged acceptance, risks and decisions.
No N2 implementation was performed or approved. The unchanged wider Python fixture gate and
the bounded browser/performance limitations remain disclosed.

Recommendation: use the published N1 demonstration and review N2 before implementation.
Next actions: inspect the live Austin tradeoffs; review the N2 pickup/overflow/closure defaults;
then freeze its metric and execution contracts before authoring implementation tasks.

- **Bound address:** numeric loopback `127.0.0.1` only.
- **Port:** 8501 by default; validated integer 1–65535.
- **Browser behavior:** disabled by the exact command above.
- **External network behavior:** none required; telemetry disabled; public binds reject.
- **Manual inspection at the original `90fb7d8` checkpoint:** **no**. That validation used pure row
  projections, launcher/process injection, and Streamlit AppTest; it launched no server, browser,
  simulator, or policy. The later reviewer-comprehension checkpoint did use a real loopback server
  and browser DOM walkthrough, then stopped the server cleanly and confirmed port 8501 closed. It
  still launched no simulator or policy and produced no pixel/manual visual evidence.

## 15. Adversarial review

- **Review file:** `PHASE6_ADVERSARIAL_REVIEW.md`.
- **Initial verdict:** HOLD while four P1 findings were open.
- **P0 findings:** none.
- **P1 findings, all closed:** mutable semantic registries; malformed implicit YAML scalar escaping
  quarantine; finite extreme derived-metric overflow escaping quarantine; unsafe/unbounded text CLI
  projection.
- **Additional P2 closed:** artifact-switch event-drilldown presentation state.
- **Accepted residual:** P2 process-lifetime `_cache`/`_active` growth. Forty-three explicit local
  selections produced 41 cached/43 active entries and about 251 MB RSS. There is no discovery or
  artifact-only trigger; restart recovers memory. A bounded synchronized LRU is recommended later.
- **Final verdict:** **GO**. Independent fix reviews found no additional P0–P3 findings in their
  remediated core/CLI scopes; C6-04 remains the explicitly accepted open P2 residual above.

## 16. Known limitations

- Local hashes make evidence tamper-evident and internally checkable; they do not authenticate its
  producer or origin.
- Stored verification recomputes metrics, findings, and gate decisions but does not reexecute the
  policy or simulator.
- Repository, simulator, adapter, policy, shield, and fault provenance is recorded/self-asserted,
  not independently attested.
- Results cover simulation and closed-lab evidence only; they do not establish real-world safety,
  certification, compliance, or road readiness.
- Deployment permission is always `NONE`; no approval or promotion semantics exist.
- Portable JSON is locator-bound; private same-host descriptor metadata is deliberately excluded,
  so hostile-host determinism/authenticity is not claimed.
- The retained cut-in scenario is a bounded simulator challenge, not proof of broad traffic realism.
- The workbench is single-user, local, and unauthenticated; no multi-user or approval workflow exists.
- Explicitly reviewing many unique valid locators in one long process can grow cache/session memory;
  restart is the Phase 6 recovery.

## 17. Git state

At delivery:

```bash
git branch --show-current
# feat/phase6-evidence-workbench

git status --short
# no output
```

`third_party/metadrive` remains clean at
`85e5dadc6c7436d324348f6e3d8f8e680c06b4db`; its source declares MetaDrive 0.4.3. The review API,
review/compare CLI, workbench AppTests, and non-MetaDrive suite neither imported nor launched the
simulator. `hermes doctor` did import MetaDrive solely to inspect the optional installed environment;
no adapter, policy, engine, scenario, window, or simulation step was created.

## 18. Local commits

| Commit | Message | Gate satisfied |
|---|---|---|
| `27cc5a0` | `docs: define Hermes Phase 6 evidence workbench plan` | Phase 6 scope pack |
| `0ad1f5c` | `docs: freeze Phase 6 review contracts` | design freeze |
| `943c3bd` | `docs: add Phase 6 implementation plan` | executable reviewed plan |
| `45bbb07` | `feat: extend immutable artifact review capture` | initial capture |
| `36e6c14` | `docs: freeze Phase 6 review runtime API` | API seam freeze |
| `7c16a80`, `1528e9e` | capture hardening fixes | capture review GO |
| `5aeded4`, `0dde754` | facade/sufficiency contract clarifications | projection seams frozen |
| `fd99e57`, `90efa47`, `f81ef31`, `fd57655` | review envelope implementation and fixes | model review GO |
| `7424285` | `feat: add immutable evidence review facade` | facade/projection review GO |
| `ad03cb2` | `feat: add evidence review comparison and CLI` | comparison/CLI review GO |
| `99c7512` | `feat: add local read-only evidence workbench` | workbench review GO |
| `90fb7d8` | `test: harden workbench trust boundaries` | adversarial review GO |
| `HEAD` | `docs: finalize Phase 6 validation and handoff` | final validation and documentation |

All commits are local. No push or pull request occurred.

## 19. Deferred scope

Not started: signature/authenticity implementation; approval, promotion, or release workflow;
scenario expansion; RL; CARLA; ROS/Autoware; cloud services; multi-user hosting; hardware; CAN bus;
vehicle control; or production deployment.

## 20. Recommendation

**Run a separate authenticity design review next, before any multi-user or approval workflow.** Its
predecessor gate is this clean Phase 6 handoff plus an explicit threat model for keys, signer
identity, canonical attestation, revocation, replay, authorization separation, and residual-risk
ownership. Do not treat a future valid signature as authorization or deployment permission.

## 21. Single best next command for the user

```bash
hermes workbench --artifact-root artifacts --host 127.0.0.1 --port 8501 --no-browser
```
