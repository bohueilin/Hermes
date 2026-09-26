# Codex brief: FleetLab release D1 and the N2 S0 contract addendum

**Date:** 2026-09-26.
**Owner authority:** sending this brief to Codex is the owner's explicit, current instruction for the work, commits, deployment and pushes described here, and nothing beyond them.
**Checkout:** the `Hermes-fleetlab` worktree of `bohueilin/Hermes`, branch `codex/fleetlab-regional-power`, at the commit that added this file. Code pointers below were verified at `7dbb6cb`; the application source (`playground/`) is unchanged from there through this brief's commit.

## 0. What this brief asks for

Two independent tracks:

| Part | Track | Output | Deploys? |
|---|---|---|---|
| A | **S0: N2 WP0 contract addendum.** Documentation only. | A complete corrected N2 design (v2): owner decisions, contract texts, metric dictionary, transition table and hand-traced fixtures. | No |
| B–D | **D1: result-first Fleet day and model identity.** Presentation only, over unchanged engines. | Build, test and validate; deploy to https://fleetlab.pages.dev/; verify the live site; record; push. | Yes |

If Part A reaches a stop condition, record it and continue with Part B. A Part B failure never blocks committing Part A.

**Out of scope:**
- any N2 code (`curb-resources.js`, `event-demand.js`, `pickup-metrics.js`, the v2 adapter);
- the execution seam (X1) and experiment registration (S1);
- anything touching Waymo Open Dataset data, terms, parsers, TensorFlow or Waymax. Never run `pip install waymax`: that PyPI name belongs to an unrelated third-party package;
- the Home hero redesign, catalog learning paths and the P3 navigation restructure. These wait for a prototype and study. The single relabel in B.2.6 **is** in scope;
- dark mode, new dependencies, analytics, accounts, a backend or any network access;
- raising the 2,621,440-byte offline limit or changing `.gitignore`;
- merging to `main`, opening a PR, force-pushing, rewriting history, or touching other worktrees.

## 1. Read first

1. `docs/FLEETLAB_PACKET_REVIEW_2026-09-26.md`: the independent review this brief implements. Its §2 (N2 contract texts, fixtures, G1–G6) is normative for Part A, except where §2 of this brief refines it. For Part B, **B.2 of this brief is the complete D1 change list**. Other review §1 and P1 items are out of scope; see B.0 "Deviations".
2. `docs/FLEETLAB_DESIGN_DATA_AND_N2_REVIEW_2026-09-25.md`: the packet the review answers.
3. `docs/plans/2026-09-25-fleetlab-n2-design.md`: N2 draft v1. **Never edit it.** Its SHA-256 is `c574b8df41d0378363e18f75452f09e15a2cf62581e8fb01f6f365229d7e25bf`.
4. `docs/FLEETLAB_CLOUDFLARE_DEPLOYMENT.md`, `CODEX_HANDOFF.md` (top section) and `HERMES_SOURCE_OF_TRUTH.md` §7.5.
5. `AGENTS.md`.

**Precedence.** This brief is the owner's explicit current instruction. It overrides AGENTS.md in exactly two places:
- the no-push and no-deploy rule, for the steps in Parts C–D;
- the §18 full gates. The scoped B.4 gates replace them for this playground-only work.

Do not `pip install` anything, and do not modify the `hermes-dev` environment. All other AGENTS.md git discipline applies.

If code inspection contradicts the review or this brief, do not silently deviate. Record the disagreement with file:line evidence in the relevant deliverable's decision log, then follow the evidence.

## 2. Owner decisions adopted by sending this brief

These apply to N2 only; legacy behavior is unchanged.

| ID | Decision |
|---|---|
| D-F1a | The energy-recovery fallback 5a fires at the **end of the dispatch pass** (review §2, F1). |
| D-F1b | **Staged vehicles stay in `A`** for the 5a trigger and range bound, **but are never members of `E`**, so they are never blocked or sent to a depot by 5a. The F1 differential test becomes "legacy set minus staged vehicles". F4's `end_reason` set **excludes** `DEPOT_VISIT_STARTED`. Draft v1 line 101 stays true. |
| F2 | The approach-refused metric is a **guardrail**: unique eligible hub requests with ≥1 `APPROACH_FULL` minute ÷ all eligible requests `N`, limit +0.02. The review's pre-evaluation headroom rule applies; if it fails, the owner registers a minutes-based limit or descriptive status **before** evaluation. Curb refusals are never `rejected_actions`. Invalid curb proposals and accepted reservations that break an invariant are `INVALID_SIMULATION` (this answers draft line 190's open question). |
| G3 | Depots `[west, east]`. Car `i` goes to `depots[(i−1) mod 2]`. With Ojai share `s`, car `i` is an Ojai iff `ceil(i·s) − ceil((i−1)·s) = 1` (so at 50/50, odd cars are Ojai). The tie rule is the existing lowest stable vehicle index. Preparation order is array order. All are frozen, declared N2 policy. |
| G5 | Same-minute requests are ordered by a **keyed tie draw** through `src/core/keyed.js`. The key is `(seed, 'n2-same-minute-order', source-kind literal, integer ordinals)`: never the ID string, only safe integers or fixed literals, no `\|` characters, and a channel literal distinct from every other N2 draw. |
| R2 | A **required background boarding-within-target guardrail**, max harm 0.02; event gains cannot offset it. |
| R1 | Forecast preparation keeps a **replenished staging target** `min(staging capacity, sum of visible counts)`, not a depletable budget. |
| R4 | Adopt the review's wording: the forecast arm can commit up to `A + S` vehicles, and this asymmetry is part of the treatment. |
| R5 | N2 v1 **omits `resources`**. Those metrics are reported as "not modeled", never 0. |
| R6 | **Two admission passes** (one before, one after dispatch and preparation). **At most one boarding start per berth per minute.** `b = 0` is allowed. No admission, dispatch or preparation at `H`. |
| F5 | Terminal boarding status is exactly one of `BOARDED`, `ABANDONED`, `CENSORED_ASSIGNED`, `CENSORED_UNASSIGNED`. The historical max-wait guardrail keeps its v1 value and is relabeled "historical max arrival-or-horizon age". |
| G6 | N2 events and background requests use keyed draws through `src/core/keyed.js` with distinct channel literals, plus a registered cross-seed independence check. The legacy generator is unchanged. |

**Deferred to S1, not decided here:** patience and every other inherited parameter (review §3); seed blocks (the review recommends 2501–2512 and 3501–3512, because 2001–2012 and 3001–3012 coincide with the four-area teaching model's public seed sets); the condition matrix, the false-alarm cell and the isolation cell; dispositions and any INCONCLUSIVE extension; re-affirming tolerances. Which engine the walkthrough runs belongs to the later P0 work. List each of these in v2 under "Open for S1" with the review's recommendation.

## 3. Part 0: preflight

1. Record the following:
   - `git rev-parse HEAD`
   - `git status --short -b`
   - `node --version`
   - the Python check below

   For Python, run `conda activate hermes-dev` in the shell used for the Python gates. Confirm that `python --version` reports 3.11, and that `PYTHONPATH="$PWD/src" python -c 'import hermes;print(hermes.__file__)'` prints this worktree's `src/`. Without `PYTHONPATH`, the environment's editable install imports another worktree.

   The only untracked file must be the owner's `FleetLab-ChatGPT-review-and-next-phase.md`. Never stage, edit or delete it.

2. Set the scan base, the commit that added this brief:
   ```bash
   BASE=$(git log -1 --format=%H -- docs/plans/2026-09-26-fleetlab-d1-and-n2-s0-codex-brief.md)
   ```
3. Create the branch `codex/fleetlab-d1-result-first` from HEAD.
4. Run `npx --yes wrangler@4.135.0 whoami`. If authentication is missing, continue with Parts A and B. Deploy is then blocked: ask the owner to run `npx --yes wrangler@4.135.0 login`. Never handle a token.
5. Take the baseline before any edit, from the repository root:
   ```bash
   FLEET_PLAYGROUND_PERF=1 node --test --test-concurrency=1 playground/fleetlab/test/*.test.mjs
   node playground/fleetlab/tools/pack.mjs --site dist/site
   node playground/fleetlab/tools/check-dist.mjs --site dist/site
   node playground/fleetlab/tools/pack.mjs --out dist/fleetlab-playground.html
   node playground/fleetlab/tools/check-dist.mjs dist/fleetlab-playground.html
   ```
   Record the pass, fail, skip and TODO counts and the offline byte size. The expected offline size is 2,543,655 bytes, which is 77,785 bytes of headroom. The recorded N1 baseline is 1,792 tests: 1,791 pass, 1 TODO. Record any difference before changing anything.
6. **Model parity.** Add the committed test `playground/fleetlab/test/d1-model-parity.test.mjs` and run it now. It must pass on unchanged source, and it stays in the suite as a D1 gate. It asserts, through exported model functions only:
   - **Fleet day:** `simulateBayAreaOperations(defaultBayAreaConfig())`. Seed 42, version `fleetlab-bay-operations-1.0.0`. Completed 95, unserved 176, waiting (`pending_requests`) 4, in progress 9, total 284.
   - **Austin at 60% power**, which is the Austin panel's single "Run Austin shift", not the comparison: `simulateBayAreaOperations(regionalPowerDemoConfig('moderate'))`. Seed 42, `condition_id` `tx-aus-moderate-v1` (depot-1 at 0.6 for minutes [90,180) of 480), `charging.policy` `redistribute`. Completed 77, unserved 391, waiting 11, in progress 1, total 480.
   - Each partition sums to its total.

   Use static imports from `../src/model/bay-operations.js` and `../src/model/regional-power.js`, as `test/regional-power-ui.test.mjs` does. Test files cost no package bytes.

## 4. Part A: S0, the N2 WP0 contract addendum (documentation only)

**Deliverable:** `docs/plans/2026-09-26-fleetlab-n2-design-v2.md`. It is a complete, self-contained corrected N2 design that supersedes v1 for implementation. Its first line: "DRAFT v2 for owner review; design only; no N2 implementation authorized". It contains:

1. **Change log.** Every v1 line or section changed, with the finding that caused it (F1–F5, G1–G6, R1–R8).
2. **Decisions.** The §2 table above.
3. **Lifecycle.** The pinned minute order: the merged F1 step 5 and 5a text with the D-F1b refinement; the F2 per-request classification (curb-first at each request's turn, and the whole pass is classified); R6 two-pass admission; the G1 preparation-eligibility rule; the G5 order.
4. **Transition and ownership table.** Request states × events, and vehicle and resource states × events. Give each transition's guard, effect, emitted record and invariant.
5. **Metric dictionary.** Every N2 metric and guardrail, each with:
   - key and version;
   - exact numerator, denominator and population;
   - null rule and unit;
   - whether it is legacy or new;
   - either guardrail (direction, limit, and request equivalent at the suggested defaults) or descriptive.
6. **Accounting records (F4).** Kinds, fields, the `end_reason` set, capture invariance, validation checks, retention and size caps.
7. **Version table.** Every identity: `region-package`, `event-demand`, `curb-resources`, `curb-condition`, `pickup-metrics`, `bay-systems-metrics`, paired format v2, and the accounting-record version. Say what each changes and which legacy bytes stay identical.
8. **Fixtures.**
   - Include every fixture in review §2: F1–F5, the minute-100 R6 trace and G1–G6.
   - Include packet traces (a)–(e) from packet line 608.
   - Add a **staged-vehicle 5a fixture** for D-F1b.
   - Each fixture is hand-traced to exact expected tuples and names the readings it rules out.
   - Fixtures that are not about G5 give distinct creation minutes, so they do not depend on the keyed order.
   - G5 and G6 may be stated as property assertions. Any keyed values used must be computed by an uncommitted script under `artifacts/fleetlab-n2-s0/` and quoted.
   - The F3 fixture uses G3 as decided: car-1 is an Ojai at west.
   - G2 is marked `OPEN pending S1`, because its cell tapes belong to registration.
9. **Open for S1.** The list at the end of §2.

**Acceptance.**
- No fixture admits two readings; any `OPEN` fixture states both readings.
- Every metric has a population and a null rule.
- Nothing contradicts §2.
- v1 is byte-unchanged; check with `shasum -a 256`.

**Commit** Part A together with a short dated entry in `HERMES_SOURCE_OF_TRUTH.md` §7.5, per the file's same-commit rule. Run the privacy scan (B.4) on the staged diff first. Record the resulting SHA as `PARTA_SHA`. Commit message: `docs: freeze FleetLab N2 WP0 contract addendum (v2 draft)`.

## 5. Part B: D1, result-first Fleet day and model identity

### B.0 Boundaries and deviations

- **Do not modify** any file under `playground/fleetlab/src/model/`, `src/instrument/`, `src/core/` or `src/runtime/`. UI code may *import* from them; `test/boundaries.test.mjs` allows that.
- No new dependency, asset, font, network request or CSP relaxation. `connect-src 'none'` stays.
- Loading any setup link never runs a simulation. Editing inputs marks old results stale; it never relabels them. The Launch panel keeps its existing discard-on-edit behavior, recorded in the inventory.
- All 56 lesson IDs and all five setup-sharing models keep working, with byte-identical loaded configurations: `fleet-day`, `launch-rehearsal`, `regional-power`, `street-lab`, `regional`.

**Byte budget: at most 11,264 bytes of offline-package growth for all of D1.** That is P1's 8,192 plus 3,072 of P2 for the Austin sentence. Stop and trim if you exceed it; never raise the limit. The packer does not minify and keeps comments:
- keep JSDoc to one line and prefer ASCII;
- delete replaced output code;
- reuse `format.js` number/signed/nonzero and `bayModelVersion` (`src/model/bay-experiment-contract.js:48`);
- after each item, measure with `pack.mjs --out` to a `dist/` path and keep a running tally in the release record.

**Copy rules.** `tools/check-dist.mjs` rejects en and em dashes and bans some words in scanned copy modules (lines ~40, 67 and 77). Write negative numbers with U+2212 or an ASCII hyphen. Define each shared string once, in a module listed in `check-dist.mjs:40`.

**Deviations from the review's P1, by owner decision.** D1 ships before the P0 prototype and study.
- **Kept:** the model header; the relabel; a partition-first Result summary; no auto-replay; one motion preference; the non-affiliation line; at most one primary action per state; the readable Austin verdict.
- **Deferred:** aliased Austin and Launch routes; the model-side time-budget bar; "Follow the car that waited longest"; a merged "Compare one change"; type-scale changes; arm colors; the Home hero; catalog paths.

### B.1 Inventories first

Start the release record `docs/FLEETLAB_D1_RELEASE_2026-09-26.md` before coding. It holds:
- a route × state inventory: every route and panel × ready / running / completed / stale / canceled / invalid / unavailable / empty population, naming what each renders today and after D1;
- a setup-link compatibility list for the five share models;
- the byte tally;
- a test-rewrite log (see B.3).

The record is committed with the D1 source in C.1 and completed in place in D.1.

### B.2 The complete D1 change list

**1. Model identity header.** Add one line (not a `<main>` element) to each surface below: model name · geography · version · "Results are not interchangeable with other FleetLab models."

| Surface | Geography label | Version shown before a run / after a run |
|---|---|---|
| Fleet day | OpenStreetMap Bay Area roads, 18 places | `bayModelVersion(config)` / `result.version` |
| Austin panel | Fictional Austin-inspired schematic (not imported roads) | `bayModelVersion(config)` / `result.version` (the full composite string, including `region-package-1.0.0`) |
| Launch panel | From the selected template: Peninsula = "OpenStreetMap Bay Area routes (Peninsula template)"; Region B = "Fictional compact Region B (synthetic km)" | The exported launch version constant / the result's version |
| Street lab | OpenStreetMap San Francisco street extracts | UI literal `street-lab-v1`; a test asserts it equals `result.version` after a run |
| Four-area workbench, Four-area workspace, Guided walkthrough | Schematic four-area Bay Area zones (San Francisco, Peninsula, San Jose, East Bay); not road geometry | The four-area `MODEL_VERSION` (see `src/model/experiment.js:47`, `src/ui/setup-codec.js:179`) / the experiment `spec.model_version` where one exists |

After an edit, the header keeps the displayed result's version, marked stale.

Fix the global boundary strip (`src/ui/studio.js:134`). Its "Region B is fictional" refers to the Launch template, it omits Austin, and it is hidden on workspaces. Rewrite it accurately or retire it. If you retire it, update its use on the error path (`studio.js:244`).

**2. Fleet day is result-first.**
- New order: question and Run → **Result summary** (with an empty state before the first run) → workspace (controls + stage) → outcome detail → learning block (collapsed) → **"Other experiments on this page"**, containing the Austin panel and then the Launch panel.
- Today the Austin panel, Launch panel and learning block come before the workspace (`src/ui/operations-lab.js:161`).
- Do not add routes.
- Give the Launch panel an `h2`; it has none today. Its `h2` and the Austin panel's heading are the focus targets for their setup links.

**3. Share controls.** Today one control, inserted by `studio.js:154,157`, serves `fleet-day`, `launch-rehearsal` and `regional-power`. Split it:
- a Fleet day control (model `fleet-day`) in the Result summary header;
- one control inside the Launch panel;
- one control inside the Austin panel.

All three keep page `simulation`, so URLs and decoded configs stay byte-identical. A `launch-rehearsal` or `regional-power` link calls `loaded()` on that panel's own control, opens that panel, and focuses its heading without running.

**4. No jump, no autoplay after Run.**
- Remove the post-run `stage.scrollIntoView` and the automatic `resume()` (`operations-lab.js:219-220`). Replay starts only on Play.
- Street lab follows the same rule: no post-run autoplay (`src/ui/street-lab.js:144`).
- After a successful run, focus the Result summary heading and announce completion in the existing `role=status` element.
- The summary leads with a partition sentence built only from result fields: "{completed} completed · {unserved} unserved · {waiting} waiting · {in progress} in progress = {total} requests". For the default day this reads 95 · 176 · 4 · 9 = 284.

**5. One motion preference.** The effective preference is `isReducedMotion(store.getState())` (`src/ui/store.js:157`): the in-app override if set, otherwise the system setting.
- Pass it from `mountStudio` into `createOperationsLab`, `createStreetLab` and `createHeroFilm`, replacing their system-only reads (`operations-lab.js:52`, `street-lab.js:12,144`, `hero-film.js:37`). Keep each factory's injectable `reducedMotion` option so existing tests keep working.
- Under reduced motion, Play advances in whole-minute steps with no interpolation, as the four-area player does (`src/ui/playback.js:196-203`), and the hero film never autoplays.
- Record in the release record whether the in-app motion control (`app.js:685-692`) can be reached outside the four-area workspace.

**6. One primary action per state.** On Fleet day, at most one enabled primary-styled button is visible in any state. Comparisons use the secondary style.

**7. Relabel and non-affiliation.**
- Rename the older engine's display names so each starts with "Four-area":
  - the nav label (`studio.js:124`) and route title (`src/ui/routes.js:6`) become "Four-area workbench";
  - the route title "Regional workspace" (`routes.js:9`) becomes "Four-area workspace";
  - the share label, the catalog model label and the catalog heading "Regional experiments" (`studio.js:156`, `simulation-catalog.js:41,59`) become "Four-area experiments".

  Paths (`experiments`, `regional`), page IDs and setup model IDs never change.
- Home cards that open the four-area engine must say so; the review flags card 02 at `studio.js:60`.
- Add one line on Product approach and near the vehicle profiles: "Independent teaching project. Not affiliated with or endorsed by any operator or vehicle maker named here."

**8. Readable Austin verdict.** Currently the comparison output (`src/ui/regional-power-view.js:9,69-71`) prints raw enums and floats. Replace it with generated sentences built only from analysis fields. Completion values display ×100 as "percentage points"; every threshold check uses the unscaled machine values. Example for 60% power (default 12 seeds):

> "Deadline priority changed completion by +0.19 percentage points (95% interval −0.24 to +0.62), inside the ±2.00-point equivalence band → UNCHANGED. Unfinished depot visits rose by 0.33 per seed; allowed 0 → HOLD."

Rules:
- **Outcome** (higher-is-better primary, `src/instrument/outcome.js:19-26`):
  - IMPROVED when `ci_low > +margin`;
  - REGRESSED when `ci_high < −margin`;
  - UNCHANGED when `−margin ≤ ci_low` and `ci_high ≤ +margin` (edges inclusive);
  - INCONCLUSIVE otherwise.
- **Guardrail verbs follow each guardrail's declared direction.** For higher-is-better guardrails, harm is a fall. The outage condition must therefore read "terminal energy fell by 5.39 kWh; allowed 5".
- **Guardrail status:** REGRESSED means harm > allowance (strict). NOT_EVALUABLE reads "not evaluable", never 0.
- **HOLD** lists every REGRESSED guardrail with its harm, unit and allowance. If none regressed, it says the primary regressed.
- **Other recommendations:** give one sentence each for ADVANCE_TO_NEXT_TEST, RUN_MORE_EXPERIMENTS and NO_RECOMMENDATION. The single-seed descriptive, invalid and same-policy control states keep their existing text (`regional-power-view.js:66-67`).
- **Exact values:** keep exact machine values behind a disclosure.
- **Resource disclosure:** build it from the submitted config's `resources`, for example: "This setup includes a {delay_min}-minute resource-observation delay and {outage_ports} charging port(s) per depot out from minute {start} to {end}." Defaults come from `regional-power.js:20` and `resource-observations.js:3-4`.
- **Rounding:** a displayed value may never appear on the other side of a margin or limit than its exact value. Show more digits when needed.

### B.3 Tests (Node, fake DOM)

Add or extend tests so that:

- **Model headers:** every surface in B.2.1 shows its header, with the per-surface version rule; Launch follows its template; the header is not a `<main>`.
- **Fleet day order and Run:** DOM order is question → Result summary → workspace, with "Other experiments" last. After Run, `document.activeElement` is the summary heading, playback is paused, and a spy on `scrollIntoView` records no call. The same no-autoplay rule holds for Street lab.
- **Partition:** the sentence equals the result fields and sums to the total.
- **Share:** each share model's link decodes to the same bytes as before, loads into the right control and panel, focuses that panel's heading and never runs.
- **Austin:** take expected strings from the computed analysis fields, not hand arithmetic (the 60% `ci_high` is stored as `0.006249999999999999` and renders +0.62). Cover:
  - all four outcomes and all four recommendations;
  - multiple REGRESSED guardrails and NOT_EVALUABLE;
  - an outage fixture where terminal energy falls;
  - synthetic near-threshold fixtures: exactly at the margin (inside), just outside, harm equal to the allowance (within), and just above it;
  - a setup whose `resources` differ from the defaults.
- **Motion:** under reduced motion, Play steps whole minutes with no interpolation and the film does not autoplay.
- **Primary actions:** at most one enabled primary per Fleet day state.
- **Compatibility:** all 56 lesson URLs resolve; legacy setup bytes are unchanged; `d1-model-parity.test.mjs` passes.

**Existing tests.** Rewriting assertions for behavior D1 deliberately removes is expected, not a stop condition. Known cases:
- `test/operations-lab.test.mjs:60-72`, which expects playing after Run;
- `test/street-lab.test.mjs:7-9` and `test/street-sharing.test.mjs:10`, which expect Street lab autoplay;
- `test/simulation-catalog.test.mjs:12`, which filters on the old model label "Regional experiments".

Never delete a test. Log each rewrite, with its reason, in the release record.

### B.4 Validation gates

```bash
FLEET_PLAYGROUND_PERF=1 node --test --test-concurrency=1 playground/fleetlab/test/*.test.mjs
node playground/fleetlab/tools/pack.mjs --site dist/site
node playground/fleetlab/tools/check-dist.mjs --site dist/site
node playground/fleetlab/tools/pack.mjs --out dist/fleetlab-playground.html
node playground/fleetlab/tools/check-dist.mjs dist/fleetlab-playground.html
# in the activated hermes-dev shell:
FLEET_PLAYGROUND_BASE=bca4ccd PYTHONPATH="$PWD/src" PYTHONDONTWRITEBYTECODE=1 python -m pytest -q -p no:cacheprovider tests/unit/test_fleet_playground_parity.py tests/unit/test_fleet_playground_boundaries.py
PYTHONPATH="$PWD/src" python -m ruff check --no-cache .
git diff --check
```

- **Node:** no new failure, skip or cancellation versus the baseline. If a wall-clock budget fails in the full `PERF=1` run, re-run it once in isolation: `FLEET_PLAYGROUND_PERF=1 node --test playground/fleetlab/test/performance.test.mjs`. Record both results; it is a blocker only if the isolated run also fails.
- **Python:**
  - Before recording, repeat the preflight `hermes.__file__` check.
  - Expect 89 passed.
  - The full `python -m pytest -q` and `python -m hermes doctor` are **not** D1 gates. If you run them anyway, compare against the retained-fixture baseline (1,433 passed, 186 failed, 42 errors, 56 skipped; `CODEX_HANDOFF.md`). Known baseline failures are not a stop condition.
- **Offline package:** size recorded, delta ≤11,264 bytes, `check-dist` OK for both packages.
- **Privacy scan.** Run it on the staged diff before every commit and on the committed range before every push. Record each hit's disposition in the release record; no unapproved hit may remain.
  ```bash
  PAT='/Users/|/home/|/private/|/var/folders|@gmail|@hotmail|api[_-]?key|secret|password|bearer|CLOUDFLARE_API_TOKEN|BEGIN [A-Z ]*PRIVATE KEY'
  git diff --cached | grep -nE "^\+.*($PAT)"
  git diff "$BASE"..HEAD | grep -nE "^\+.*($PAT)"
  git diff "$BASE"..HEAD | grep -n '^+.*token'
  ```
  The last command lists added lines that mention `token`; review each by hand, since existing code has variables named `token`.
- **Browser checks** need a real browser. If none is available, stop before deploy and report. Run against the native source and against the packed `dist/site` over local HTTP.
  - **Blocking:**
    - after keyboard Run, the Result summary heading is focused and fully visible without page scroll at 1280×720;
    - no autoplay after Run on Fleet day and Street lab;
    - Play works, and under emulated reduced motion it steps whole minutes;
    - every share-model link loads without running and focuses its panel;
    - the Austin run and comparison read as in C.3;
    - no console errors.
  - **Best effort:** repeat the focus and visibility check at 400×812, and test the offline file over HTTP. If a viewport or file cannot be tested, record exactly what was not tested and why.

  Never claim assistive-technology, other-browser or device support you did not test.

## 6. Part C: deploy (only if every B.4 gate passed)

1. Run the privacy scan on the staged diff. Commit the D1 source, the tests and the B.1 release-record sections: `feat(fleetlab): result-first Fleet day, model identity and readable Austin verdict`. The tree must be clean except for the owner's note.
2. Re-run `pack.mjs --site dist/site` and `check-dist.mjs --site dist/site` on the committed HEAD. Then deploy, exactly as in `docs/FLEETLAB_CLOUDFLARE_DEPLOYMENT.md`:
   ```bash
   npx --yes wrangler@4.135.0 whoami
   FLEETLAB_COMMIT=$(git rev-parse HEAD)
   npx --yes wrangler@4.135.0 pages deploy dist/site --project-name fleetlab --branch feat/fleetlab-playground --commit-hash "$FLEETLAB_COMMIT" --commit-dirty=false
   ```
3. **Readback of https://fleetlab.pages.dev/:**
   - **Payload hashes.** Never overwrite the earlier readback record:
     ```bash
     mkdir -p artifacts/fleetlab-d1
     cp artifacts/fleetlab-design-review/verify_public.py artifacts/fleetlab-d1/verify_public.py
     ```
     Change the copy's output path to `artifacts/fleetlab-d1/published-readback.json`, then run it from the repository root:
     ```bash
     python3 artifacts/fleetlab-d1/verify_public.py https://fleetlab.pages.dev "$FLEETLAB_COMMIT"
     ```
     Every public file must match `dist/site`. If the script is missing, write an equivalent under `artifacts/fleetlab-d1/`.
   - **Headers.** Check with `curl -sSI https://fleetlab.pages.dev/`: a restrictive CSP with `connect-src 'none'`, nosniff, frame denial, no-referrer and same-origin opener policy.
   - **Hosted browser: Fleet day.** Run fleet day. The summary must read 95 · 176 · 4 · 9 = 284, focus must land on it, and nothing may autoplay.
   - **Hosted browser: Austin.** Open "Regional stress lab: Austin power and readiness"; the condition stays at the default 60%.
     - Press "Run Austin shift". The horizon table must read 480 / 77 / 391 / 11 / 1.
     - Press "Compare Austin charging policies" with the default 12 seeds. The sentence must read +0.19, −0.24 to +0.62, UNCHANGED, and a HOLD on unfinished visits of 0.33 against an allowed 0.
4. Record the new Production deployment ID and immutable URL. The previous Production, `f08b6b6f-c5d0-44f7-905b-5f16087fbc85`, is the rollback target.
5. If the readback fails, stop and report. The owner can roll back from **Workers & Pages → fleetlab → Deployments → Rollback** to `f08b6b6f`. Do not upload again until a fix passes B.4 again.

## 7. Part D: records and push

1. Update in place; create no new status documents:
   - `HERMES_SOURCE_OF_TRUTH.md`: the Playground row, a dated §7.5 entry and Last updated. The records follow the deploy because the deployment ID only exists afterwards; say so, as an exception to the same-commit rule.
   - `CODEX_HANDOFF.md`: a new top section with the actual commands, counts, bytes, digests, deployment ID, negative results and limitations. Use no absolute local paths.
   - `docs/FLEETLAB_CLOUDFLARE_DEPLOYMENT.md`: current production and source.
   - `docs/FLEETLAB_D1_RELEASE_2026-09-26.md`: completed.
2. Run the privacy scan on the staged diff, then commit: `docs(fleetlab): record D1 release and verification`.
3. Push.
   - **If D1 deployed and the readback passed:**
     ```bash
     git fetch github
     git diff "$BASE"..HEAD | grep -nE "^\+.*($PAT)"   # must be clean (dispositions recorded)
     git push github codex/fleetlab-d1-result-first
     git merge-base --is-ancestor github/feat/fleetlab-playground HEAD && git push github HEAD:feat/fleetlab-playground
     ```
     The second push must be a fast-forward. If it is not, stop and report; never force.
   - **If D1 was not deployed, or the readback failed:** keep the D1 commits local. Push only Part A, and do not move `feat/fleetlab-playground`:
     ```bash
     git push github "$PARTA_SHA":refs/heads/codex/fleetlab-d1-result-first
     ```
     Explain in the final report.
   - Never check out or modify the local `feat/fleetlab-playground` branch in its other worktree. No `main` merge and no PR.

**Git discipline:**
- Stage explicit paths only; never `git add -A` or `git add .`.
- Never stage `artifacts/`, `dist/`, caches or the owner's note.
- Before every commit, review `git status --short`, `git diff --cached --check` and `git diff --cached --stat`.
- Add no co-author trailer.

## 8. Stop conditions (any part)

Stop the affected item, record the blocker with evidence, and continue independent safe work if:

- a change needs edits under `src/model`, `src/instrument`, `src/core` or `src/runtime`;
- `d1-model-parity.test.mjs` fails;
- the D1 byte budget would be exceeded;
- a lesson URL or setup link breaks, or loading a link runs a simulation;
- a test fails for a reason other than a deliberate B.3 rewrite, and cannot be fixed within D1;
- no real browser is available for the blocking checks;
- wrangler authentication is missing;
- the readback mismatches;
- the website branch cannot fast-forward;
- any step would need WOD data, dataset terms, N2 code, a new dependency or a `.gitignore` change.

## 9. Final report to the owner

Include:
- the branch and commits (SHAs, including `PARTA_SHA`);
- Part A status, with any `OPEN` fixtures;
- D1 changes, one line each;
- test counts against the baseline, and the test rewrites made;
- Python and Ruff results;
- offline bytes and delta, with the per-item tally;
- the browser checks actually performed, and those not performed;
- the deployment ID, immutable URL, readback results and pushes;
- privacy-scan dispositions;
- deviations from this brief, with reasons;
- next steps: S1 registration (the owner decides patience, inherited values and seed blocks); the X1 execution seam; the P2 remainder (the vehicle-time strip); the P0 prototype and study for the Home and catalog; the R0 no-data lessons.
