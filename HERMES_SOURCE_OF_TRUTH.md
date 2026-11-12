# Hermes — Source of Truth

## FleetLab: where we are now (read this first), 2026-11-11

This block is the single entry point for anyone continuing FleetLab: the owner, Codex, Muse, Argon, or a new Claude or Codex session. It summarises the current state and how work is done. The dated sections below it are the release records, newest first. They hold the detail and the evidence trail, and they win where this summary is shorter.

FleetLab is the public teaching website https://fleetlab.pages.dev about the operations of an autonomous-vehicle fleet. It is built from this public repository. Its boundary sentence stays verbatim on the site: "Simplified simulations for learning — not evidence about real-world safety. Nothing here approves deploying a vehicle or policy." The rest of Hermes (Phases 0 to 9, ADAS, MuJoCo, §1 to §15) is separate, and FleetLab work leaves it alone, apart from FleetLab's own §7.5.

### 1. State right now

| What | State |
|---|---|
| Live site | Source `43d415379d611600731ef9d5ae60c93fc4ac3f75`, Pages deployment `febca83c`, uploaded by the owner on the evening of 2026-11-11. `publication.json` names it (checked 2026-11-11) |
| Rollback | Pages deployment `273b73d6` (source `00d834f`), owner-operated, not rehearsed |
| `main` | Contains the live line and its record: PR #31 merged the release branch at `43d4153` as `0df5948` (the same tree), and PR #32 merged this record (`aa360cc`) as `4ec54c7`. The site bytes on `main` are those of `43d4153`; the record commits change documentation only. Start all new work from `main` |
| Release branch | `claude/fleetlab-numbers-webkit-20261111` at `43d4153`. The earlier release branches `claude/fleetlab-fixes-20261110` (`00d834f`), `claude/fleetlab-perf-20261109` (`0b0fb05`) and `codex/fleetlab-ux-impl-20261104` (`5a4dafb`) stay on GitHub |
| Public release record | [docs/releases/fleetlab-current.json](docs/releases/fleetlab-current.json) describes `43d4153` |
| Live verification | Full byte readback 10,186 / 10,186 and headers 100 / 100 on the stable and the immutable host. Offline edition 2,588,236 B, SHA-256 `77534e343a3f53ee79255c079d5ad883eb4ca967540625732cde9b5c7e9f42c3`. Every footer checked reads "Date: Nov 11th, 2026" |
| Daily readback | The owner's Claude Desktop task `fleetlab-daily-readback` runs at 09:00 local and checks every served file against a stage record. It was re-pointed to the `43d4153` record on 2026-11-11; a dry run read 10,186 / 10,186. On a FAIL, read `publication.json` first: a new commit means a deliberate redeploy, so re-point the task; the same commit means the live bytes changed |

### 2. What the site is

- **The studio** (`/#/…`): Home, Fleet day (the operations lab), Street lab, Explore (the catalog of lessons), About & limits, Depot flow, the Scale lab and the walkthrough. All routes live in one document; the inactive ones are `hidden`.
- **Network Flows** (`/network-flows/`): a hub and five lessons, Capacity, Software delivery, Delivery order, Rebalancing and Dispatch. Each is a static page whose lab is mounted by JavaScript.
- **Depot Readiness** (`/depot-readiness/`): the depot lab. Its own text is pinned at 418,159 B of route-local bytes.
- **City Explorer** (`/city-explorer/`): an atlas served from a pinned City base generation.
- **The offline edition** (`downloads/fleetlab-offline.html`): the studio as a single file, pinned by size and SHA-256.

### 3. What happened, in order (details in the sections below)

| Dates | Releases | What |
|---|---|---|
| 2026-09-18 to 10-25 | up to `a1b79cd` | The site, the Scale lab, City Explorer, the visitor redesign, the Network Flows study and the depot lab. `main` became the trunk on 10-23; PR #9 (merged 10-26) reconciled it with the live line |
| 10-26 to 10-27 | `848b420` | Network Flows Step A (tests, bounds and baselines, PR #10) and Step B (priority fixes, PR #11) |
| 10-31 to 11-02 | `9dfc6bc`, `8d2c7ac`, `94a201f` | Corrected lesson copy and site date, catalog readability, and four new tile images (PRs #13 to #19) |
| 11-03 to 11-06 | (no release) | Workspace reorganization and cold archive: docs regrouped into `docs/hermes/` and `docs/fleetlab/`, evidence moved into `…/Hermes-evidence/`, old builds archived to the owner's encrypted drive (November 2 section) |
| 11-04 to 11-08 | `de80555`, `57dd67e`, `ceb3d25`, `e3a5f0c`, `4b039be`, `5a4dafb` | The UX audit waves 1 to 3.5 and the design audit phases 1 to 3: header and navigation contract, footer, motion placement, Fleet day ledger and telemetry, the depot-pipe and turnaround motions (M1, M2), outcome chips, City contrast, green depot markers, and the 2026-11-08 design review (Q1 to Q4). Built on `codex/fleetlab-ux-impl-20261104`; their review records are kept privately |
| 11-09 to 11-10 | `0b0fb05` | A live performance evaluation of `5a4dafb`, then two performance waves. Details in the November 10 section |
| 11-11 | (no release) | `main` reconciled with the live line (PR #27). Four test-only fixes made the concept-motion browser test pass on the CI runner |
| 11-11 | `00d834f` | The fixes wave: the standing website date rule and "Date: Nov 11th, 2026", repeated Limits in Fleet day, the hero shimmer retired, defect (c) D6, and three accessibility fixes. Details in §6 and the November 11 section |
| 11-11 (evening) | `43d4153` | The numbers and WebKit wave: every count names its population (F01 to F04) and Street lab's comparison adds up, WebKit stops fetching hidden routes' images, an accessibility batch, a source offer that no longer varies with the commit, and the City Python suite in CI (PR #31). Details in §6 and the November 11 (evening) section |

**What the performance waves changed** (Chrome 157; 1280×900 and 320×700 with Slow 4G and 4× CPU):
- **Layout shift at mount:** 0.0000 on every studio route, Readiness and Dispatch, and 0.0001 on Rebalancing (desktop), from up to 1.03. City Explorer is unchanged (0.039 desktop, 0.266 mobile).
- **Images fetched by hidden routes:** none now, which saves 1.5 to 1.9 MB per studio route at mount.
- **Street lab:** the run is sliced: 0 Long Tasks in 9 of 10 runs at 4× CPU (one marginal 53 ms task, 3 ms TBT, in the first live Run), against 1.3 and 2.8 s single tasks before.
- **Methodology explainer:** no frames drawn while off screen.
- **Opt-in performance suite:** `FLEET_PLAYGROUND_PERF=1` passes in full.

### 4. Who does what, and the rules that always apply

- **Roles.** The owner decides, gives every go-ahead, runs every upload and holds every credential. As recorded so far, Codex builds and Muse reviews design and words and drafts proposals. Argon and any other agent take the role the owner gives them. Claude sessions have built, measured and recorded releases.
- **Permission.** Never push, open or edit a pull request, merge, upload or go live without the owner's own message naming the exact branch and commit. Agents never hold Cloudflare credentials. This file grants no permission.
- **Git.**
  - Stage named paths only, never `git add -A`. The repository is public: no private material and no local paths in committed files.
  - Merge with a merge commit (`gh pr merge N --merge --match-head-commit <sha>`). Never squash, rebase, force-push, `--admin` or `--auto`; repository auto-merge is off.
- **Bytes.** Every byte ceiling, bound and pin is exact, with 0 B spare. Raising one needs the owner's authorization for that change. Moving headroom between closures is never allowed.
- **Words and colour.** The boundary and honesty copy stays verbatim (`hub-copy.test.mjs`), and the colour lock holds (`colour-lock.test.mjs`): amber and terracotta never mark a new state or warning.
- **Media.** Never use the reserved eighth enhancement slot, and never touch A2 or the held Fleet day film. Settled art verdicts stay settled (October 26 rules). One recorded exception: on 2026-11-11 the owner approved re-pinning `a2-golden.test.mjs` to `39d136f5…` solely because `loading` and `fetchpriority` now come before `src`; A2 keeps its 624 B, attributes and values, with no visual or artwork change.
- **Honesty.** Record only checks that actually ran, with their output, and name what was not checked.
- **Results go in this file (owner rule, 2026-11-11).** Every implementation and its results output are written here so they can be shared: what changed, the checks that ran with their outputs (gates, browser checks, rendered readouts, live readbacks), the merges, and what was not checked. Private reports may hold more detail, but no result may live only there. The file is public: no local paths, credentials or private material.
- **Website date rule (always applies).** Whenever a release goes live, the website footer date must be the exact date it goes live: `apps/fleetlab-city/hosted/integration.mjs` (studio pages), `apps/fleetlab-city/hosted/brand.mjs` (City Explorer and Depot Readiness) and the assertion in `apps/fleetlab-city/test/structural-shell.test.mjs`, with the exact byte ceilings re-measured if the date string's length changes. Never ship a release with a stale footer date. If the upload slips to a later day, change the date and rebuild the stage before uploading. (Owner, 2026-11-10.)
- **Pause scope rule (always applies).** The global "Pause visual motion" control stops all decorative and ambient motion and the lesson videos. Playback a visitor starts (the guided walkthroughs, snapshot stepping, and Fleet day and Street lab replays) is controlled by its own transport buttons, and the global Pause does not stop it. (Owner rule, confirmed 2026-11-11.)
- **Post-run focus rule (always applies).** Focus moved by code after a run or comparison must land on an element that is visible in the viewport: either scroll the focused heading into view, as Fleet day and Street lab do, or leave focus on the visible control. (Owner rule, confirmed 2026-11-11; verified in 18 of 18 browser and width cells.)

### 5. How to change the site safely

1. **Branch from `main` after a fetch**, in a new worktree under `…/Hermes-worktrees/<purpose>`. The local release bench `…/Hermes-worktrees/fleetlab-workbench` (also reached as `…/Hermes-fleetlab`) holds, in its ignored `build/fleetlab-city/`, the pinned Node 22.23.4 toolchain, the City venv (CPython 3.11.15) and the local-only stage inputs. Preserve it. The four stage inputs under it are `delivery-order-20261013/preserved-legacy`, `validation/integration/baseline-readback.json`, `city-base-refresh-20261108b/base` and `source-offer-v8-temporal-final`. The November 2 section describes the rest of the environment.
2. **Know the cost class before proposing** (November 8 section, "What a proposal costs"):
   - a same-length swap needs only the gates;
   - hosted CSS or copy needs a ceiling authorization;
   - Playground source also moves the Offline pin, and possibly the depot route-local pin;
   - a City Explorer viewer change needs a new City base;
   - artwork changes the pinned inventory (41 files, 7,933,679 B).
3. **Where the code is:**
   - The hosted layer is `apps/fleetlab-city/hosted/`:
     - `brand.mjs` and `brand.css`: the header and shell, the readiness context, and the static-page shift rules;
     - `visitor.mjs` and `visitor.css`: hero art, field notes, and the route-scoped images (`syncRouteImages`);
     - `integration.mjs`: the footer date;
     - `site-transform.mjs`: rewrites every page at build.
   - The studio is `playground/fleetlab/src/`.
   - The release tools are `apps/fleetlab-city/deploy/` (`build-release.py`, the locked upload wrapper `wrangler.mjs`, `record-release.mjs`) and `apps/fleetlab-city/tools/` (`readback.py`, `check-headers.py`, `integrate-site.py`).
4. **Patterns new since November 4 that a change must keep:**
   - The studio is decorated in the task that mounts it: the hosted `boot.js` imports `brand.mjs`.
   - Static headers get their final box from the first paint.
   - Images under a hidden route stay lazy until the route shows. Every image is created with `loading` set before `src`: `lazy`, plus `data-eager` for one that should load eagerly, which `syncRouteImages` turns into `loading="eager"` once its route shows. WebKit takes the lazy-loading decision the moment `src` is set, so an image given `src` first is fetched even on a hidden route.
   - On static pages, what follows a hosted insertion stays hidden until it lands, with a 3 s failsafe.
   - A new insertion or image that breaks these patterns brings the layout shift and the transfer back.
5. **Teaching-client files.** The release integrator (`integrate-site.py`) only lets the teaching-client files it declares differ from the preserved legacy site, and the declared set must equal the changed set. A change to any other Playground model or UI file stops the build ("undeclared teaching client change") until it is declared there.
6. **Gates, from a clean committed tree.** The counts at `43d4153`:
   - Stage check 20 / 20 and stage packaging 17 / 17.
   - City Python 375 (City venv).
   - With `FLEETLAB_REQUIRE_CHROME=1`: City Node 349 / 349, Playground 2,978 / 2,987 (8 skipped, 1 todo) and traffic 14 / 14.
   - Run the suites without other heavy work alongside: on 2026-11-11 one City Node test, normally about 40 ms, hit its 60 s timeout while browser checks ran in parallel, and passed when the suite was re-run alone.
   - `ruff check .` and pytest in the `hermes-dev` env with `PYTHONPATH=src`.
   - For a change to hosted bytes, also build a stage from the branch head with `build-release.py` and run `stage-check.mjs --mode after` before asking for a merge. CI never builds a stage.
7. **Byte ceilings, when authorized.**
   - Measure only on a committed, clean tree: an uncommitted tree reads the bound files 9 B low.
   - Write the exact values, amend, rebuild, and repeat until re-writing the commit's own measurement changes nothing. Stopping at "passes" leaves a byte or two of spare.
   - Update every copy. The list is in the November 10 section's Bytes table; `capacity-site.test.mjs` writes the Offline pin with numeric separators, so search both spellings. Two fixtures are derived from caps and move by hand: "cap + 1" literals in `software-delivery-package.test.mjs` and a "cap − 3" literal in `apps/fleetlab-city/tests/test_integration.py`.
   - The compressed source offer no longer varies with the commit. Since the 2026-11-11 numbers wave, `createSourceArchive` in `playground/fleetlab/tools/package-proof.mjs` writes the commit-bound `source` member (commit, tree, state) as a stored, uncompressed deflate block, so the archive's length depends on the offered files only. Before, each amend was a fresh draw of a few bytes, and the loop took 12 to 14 rounds.
8. **CI** (`.github/workflows/ci.yml`, on `macos-26`) runs ruff, pytest without the local fixtures, the three Node suites and, since the 2026-11-11 numbers wave, the City Python suite in its own venv installed from `apps/fleetlab-city/requirements.lock.txt` with `--require-hashes`. The boundary test R6 pins the workflow to its reviewed bytes, so a CI change also changes `_REVIEWED_CI_NODE_JOB` in `tests/unit/test_fleet_playground_boundaries.py`.
   - The runner renders frames slowly. A browser test must wait for frame-driven state (a viewport observer, an animation's `ready` point, a media-query change) rather than read it after a fixed short delay. `concept-pipe-cycle-browser.test.mjs` shows the pattern.
   - A job that gets no runner is cancelled with zero steps. That is not a pass: re-run it.
9. **Release.**
   - Before the stage is built, set the footer date to the day the release will go live (the website date rule in §4). If the upload slips to a later day, change the date, rebuild the stage and re-run the stage check first.
   - The owner uploads the built stage from Terminal with the locked wrapper.
   - The commands are untagged blocks, one per block, with no `#` comments, and the expected output goes in prose. The window must first `cd` into the release worktree: from any other folder the wrapper is not found.
   - Before the exports, `print -r -- ${+CLOUDFLARE_API_TOKEN} ${+CLOUDFLARE_ACCOUNT_ID}` must print `0 0`. A `1` means an export left over in that Terminal tab, which `/bin/zsh -f` inherits: `unset` it in the clean shell (or use a new window) and export the value fresh. This happened once on 2026-11-11 and was cleared before the upload.
   - The agent then runs the full readback and the header check on both hosts, writes the receipt and the compact public record with `record-release.mjs`, and updates this file.
   - Finally, `main` is reconciled through a pull request. The November 2 section gives the full path; the November 10 section shows the latest run.

### 6. Open before new design work (refreshed 2026-11-11)

The 2026-11-10 fixes wave (branch `claude/fleetlab-fixes-20261110`, live since 2026-11-11 as `00d834f`) settled most items. Its report is kept privately with the release evidence.

**Closed, fixed or ruled in that wave:**
- **Scope 1 re-inspection condition:** met (owner ruling, 2026-11-10). Scope 2 items may proceed one by one, each with the owner's approval.
- **R1, the Pause control overlapping content:** closed. Measured on 11 pages at 320, 390, 768 and 1280 px in Chrome 157, and in WebKit 26.6 and Firefox 155: no overlap, clipping or horizontal overflow. Since UX wave 2B the control sits in the page header.
- **Repeated Limits:** fixed for Lessons 15 to 19 and the staffing, charging, resources and airport situations. A Fleet day panel now hides its Limits while the lesson or situation frame above shows the same ones (`operations-lab.js`, with a regression test). The rest of those frames still repeats in the panels ("What & why", "How we simulate" and so on), as does Lesson 20's whole frame in the Launch rehearsal panel; neither was in scope.
- **Hero shimmer:** retired. The decorative sweep on the Software delivery, Delivery order and Rebalancing heroes is removed (`visitor.css`), which takes 632 B off every closure.
- **FL-A4 priority below 768 px:** kept as built (owner ruling): eager and high priority from 768 px, lazy and low below.
- **Defect (c), D6:** fixed. Before its study arrives, Rebalancing reads "No result yet" instead of "Recorded policy · after decision" and "0 min". Dispatch no longer draws an empty takeaway box. Both have regression tests.
- **D1, the depot "Deeper experiment" eyebrow:** closed as an accepted residual. Earlier reviews declined it, and nothing later replaced it. If it is wanted later, rewording the existing eyebrow to "DEEPER EXPERIMENT · STAGE 1" measured −2 B on the depot route-local figure.
- **R13, Delivery PARTIAL:** closed as bookkeeping, not a defect. The two required copy edits targeted text that does not exist in the source, so both items are dropped from the required set and must not reappear on an open list: `specification.notation` (there is no "Specification notation" string) and the `fleet-intake` power and ports controls (they have no "steps of" text; the power input, 24 to 56, and the ports input, 16 to 28, work). (Owner, 2026-11-11.)
- **City Explorer generation `1f560fc7` to `f3adaa72` in `00d834f`:** expected, not a City change. The City base (`city-base-refresh-20261108b/base`) is unchanged; `build-release.py` re-brands it with the release's hosted shell, which carried the Nov 11th footer date and the updated header, and with the release's source commit. Each release therefore gets a new generation hash.
- **Workbench leftovers:** none remain. The tile-swap files went with the 2026-11-03 reorganization.
- **Accessibility fixes:**
  - after a run, Fleet day brings the focused "Result summary" heading into view;
  - the studio's phone menu closes on Escape and returns focus to Menu, as the static pages' menu already did;
  - on the static pages, `main` takes focus from the skip link.

**Closed in the 2026-11-11 numbers and WebKit wave** (branch `claude/fleetlab-numbers-webkit-20261111`, live since the evening of 2026-11-11 as `43d4153`):
- **Numbers reconciliation, F01 to F04.** Every count and percentage on the four pages now names its population:
  - Depot flow lab (`#/depot-flow-lab`): the outcomes table shows each vehicle's deadline in its "ready" column header beside the on-time verdict, counts read "n of N", and the late-minute cell reads either "final total" or "At least …, lower bound (work unfinished)". The headline calls a non-final total "the fewest late minutes so far (at least …)", and the final-result sentence now says "on time" after every count. Depot Readiness already labelled both ("x of d due by end", "at least … (more may follow)") and is unchanged.
  - Fleet day: completion is "% of all N requests"; Unserved reads "n / N, of all requests"; depot time is the mean "over N completed depot visits"; unfinished visits read "n of N started depot visits"; the activity table's columns read "Vehicle-hours" and "Share of N vehicle-hours" (192 on the default day); the vehicle-mix and depot-count comparisons name trips "of requests" and means over completed trips or visits.
  - Street lab: the policy comparison names "Completed journeys, of N requests" and "Requests waiting / in progress at horizon", calls its pickup and passenger rows means, and prints each Change as the difference of the two values shown. Before, the default Bridge rush comparison read 28.2 and 25.9 min with a Change of −2.4 min; it now reads −2.3 min. The morning audit's other Street lab figures (a 4.5% share, a p90 pickup wait rising from 21 to 22 min, a "10%" saving) appear nowhere in the source or the built stage: the Street model computes no percentile, and its p90 pickup wait on that comparison is 38.8 then 37.3 min.
  - Capacity: "Missed" reads "n of N"; capacity reads "% of available bytes used" and "% of available energy used"; a non-final lateness names its unfinished visits.
- **Pause scope:** kept as built and codified as the Pause scope rule in §4.
- **Street lab focus after a run:** fixed under the post-run focus rule in §4. The focused "Result summary" heading is scrolled into view, as on Fleet day.
- **Header focus order at phone width:** fixed. Below 768 px both headers now show the logo, Menu, the opened navigation and Pause in that order, which is their Tab order (CSS `order` only; the desktop header is unchanged).
- **Minor accessibility gaps:** fixed. Lesson-frame part headings sit one level below the frame title (h1 then h2), Rebalancing's explainer heading is an h2, the Fleet day "Conditional holds", Street lab settings and hub limits panels are named landmarks, and each Home "Open setup →" link names its lesson. The wave's own audit also found that the Capacity lesson had no skip link (the 2026-11-10 audit had not covered it); it now has "Skip to lesson" as its first Tab stop.
- **Safari and WebKit image loading:** fixed. Images get `loading` before `src` (`visitor.mjs`, `brand.mjs`, `enhancement-media.mjs`, and the film poster in `hero-film.js`), so WebKit no longer fetches the hidden routes' images: 11 to 22 per studio route before, 0 after, in WebKit 26.6; Chrome 157 and Firefox 155 stay at 0. The A2 figure keeps its 624 bytes and its attributes and values, but `loading` and `fetchpriority` now come before `src`, so its golden hash in `a2-golden.test.mjs` is re-pinned to `39d136f5…` (owner-approved, 2026-11-11).
- **CI:** the City Python suite runs in CI (§5 item 8).

**Still open (owner decisions):**
- **Branch protection on `main`.** Requiring the CI checks before a merge is a repository setting for the owner; the command is in the wave's report.
- **A stage build in CI.** CI still never builds a stage; the stage check runs locally before each merge request.

**Accepted as is:**
- Mobile `/#/catalog` LCP 10.06 s live, above its 7.8 s target (owner, 2026-11-10). No JavaScript tile-holding and no new artwork.
- A 0.004 late layout shift on mobile Rebalancing and Dispatch, from the pages' own `#watch` label.
- The two residuals of the 2026-11-08 design review: no street names at the atlas's opening zoom, and "scroll for all states" on wide screens.

**Measured, with no work started** (from the private performance report):
- Mobile first render waits about 6.9 s for 114 first-party modules on Slow 4G.
- Analytics costs about 0.6 s of mobile DCL.
- City Explorer's client-side redirect costs 0.26 to 0.96 s.
- City Explorer's own mount shift (its masthead) is unchanged.

**Browser and device coverage (2026-11-10):**
- **Chrome 157:** every check.
- **WebKit 26.6 and Firefox 155,** through the Playwright builds already on the owner's Mac, on 8 pages at 1280 and 320 px. Checked: the decoration, the hold release, the Pause control's layout and the image deferral. No site errors. Firefox logs Google Analytics cookies rejected for the `pages.dev` domain. WebKit reports some setup cards on Readiness as `visibility: hidden` through `getComputedStyle`, yet draws them normally (checked by screenshot).
- **Never tested:** real Safari (it needs "Allow remote automation", an owner setting), screen readers, and a physical phone on this candidate.

### 7. Before you start new design or implementation work

1. Read this block, then the two November 11 sections, the November 10 and the November 8 sections (the design state, the tokens, how a design review runs and what a proposal costs), then the October 26 rules.
2. Confirm the live commit: `https://fleetlab.pages.dev/publication.json`. If it is not `43d4153`, a newer release has happened and this block is out of date.
3. Write the proposal with its cost class and the bytes it will move. The owner approves it item by item before anything is built.
4. Build on a new branch from `main` and run the gates. For hosted bytes, also build the stage and run the stage check. Then ask the owner for the push, the pull request and the merge, each naming the branch and commit.
5. After any release, update this block's §1 and §3, add a dated release section below it, and keep the older sections as records.

## November 11, 2026 (evening) — FleetLab release `43d4153` live, production `febca83c`: the numbers and WebKit wave

**Current release identity.** Read this section first. The earlier November 11 section below (`00d834f`) is superseded as the release record; what still applies from it is named at its top.

### Start here: what changed for anyone continuing FleetLab after this release

1. **The ceiling loop is short now.** The compressed source offer no longer varies with the commit (§5 item 7 of the block above). Each of this wave's two candidates needed two stage builds, and a build at a new commit reproduced every stage figure.
2. **Images are created with `loading` before `src`** (§5 item 4). This is what keeps WebKit from fetching hidden routes' images.
3. **CI runs the City Python suite** in its own venv, and R6 pins the workflow bytes (§5 item 8).
4. **The A2 golden was re-pinned once, with the owner's approval,** for attribute order only (§4, Media).

### Live release

| What | State |
|---|---|
| Source | `43d415379d611600731ef9d5ae60c93fc4ac3f75` on `claude/fleetlab-numbers-webkit-20261111`, four commits on top of `1031e93`. PR #31 merged it into `main` as `0df5948` on 2026-11-11 (the same tree). This record followed as #32 from `claude/fleetlab-release-43d4153` (`aa360cc`), merged as `4ec54c7` on 2026-11-11 |
| Production | https://fleetlab.pages.dev/, Pages deployment `febca83c` (https://febca83c.fleetlab.pages.dev/), uploaded by the owner from Terminal with the locked wrapper on the evening of 2026-11-11 |
| City Explorer | Current generation `city-explorer/releases/3c318e266c3d10b0`, rollback generation `d71826cf1aa949ea`. The City base is unchanged; the new generation hash comes from the re-branded hosted shell and source commit, as before |
| Rollback | Pages deployment `273b73d6` (source `00d834f`); before it `d477d470` (`0b0fb05`) |
| Live verification, 2026-11-11 Pacific time (2026-11-12 00:42 to 00:52 UTC), both hosts | `publication.json` names `43d4153…` on both hosts. Offline edition 2,588,236 B, `77534e34…`, on both hosts. Full readback 10,186 / 10,186 files with 0 mismatches, and effective headers 100 / 100, on https://fleetlab.pages.dev and on https://febca83c.fleetlab.pages.dev. In Google Chrome 157 through Playwright, with no request interception, the footer of `/#/home`, `/network-flows/rebalancing/`, `/depot-readiness/` and City Explorer read "Date: Nov 11th, 2026" with `datetime` 2026-11-11 on both hosts (8 of 8). Not done: real Safari, screen readers or a physical phone on this release |
| CI | PR #31 at `43d4153`: "Python 3.11" (1m10s) and "FleetLab Node 22.23.4" (19m23s) passed, the latter including its new "FleetLab City Python suite" step. `main`'s run on `0df5948` passed. #32 at `aa360cc`: both passed (1m11s and 12m45s) |
| Gates at `43d4153` (clean tree, Node 22.23.4, Python 3.11.15) | Stage check 20 / 20, every exact bound at 0 B spare. The wrapper's `deployPreflight` and `verifyStage` pass without credentials. Unit counters 16 / 16. Stage packaging 17 / 17. City Python 375. City Node 349 / 349, on a re-run of the suite alone (in the full run one test timed out once while browser checks ran alongside). Playground 2,978 / 2,987 (8 skipped, 1 TODO, 0 fail). Traffic 14 / 14. Playground with `FLEET_PLAYGROUND_PERF=1`: 3,296 / 3,297 (1 TODO, 0 fail). `ruff check .` clean. pytest (`-m "not metadrive"`, `CI=true`, `PYTHONPATH=src`): 1,447 passed, 228 skipped by the CI fixture guard, 55 deselected |
| Browser checks on the stage | Accessibility audit of 11 pages at 1280 and 320 px: 0 of 22 cells with a gap (12 of 22 on `00d834f`). Post-run focus in view in 18 of 18 cells (Chrome, WebKit and Firefox). Phone header order logo, Menu, Pause in all three. Hidden-route image requests 0 in all 42 route cells (WebKit 26.6, Firefox 155, Chrome 157) |
| Scheduled readback | Re-pointed on 2026-11-11 to the `43d4153` stage record; a dry run of its command read 10,186 / 10,186, exit 0 |
| Evidence | Kept privately outside the repository: the wave's release report (with the rendered F01 to F04 readouts), the stage, the gate receipts, the live readbacks and the browser observations. The stage record is `local-release.json`, SHA-256 `1b5e2323d2df708ec9049b0dbf6ef00cb94f3f0ade151a71c61731a4449e8787`; the stage holds 10,187 files and 1,629,835,064 B |

### Rendered readouts on default fixtures (stage `43d4153`; the live bytes are identical)

Captured from the built stage in Google Chrome 157 at 1280×900. Table cells are separated by │. Every sum, share and difference was checked by hand, and all agree.

| Page and fixture | Element | Rendered text | Check |
|---|---|---|---|
| **F01** `#/depot-flow-lab?lesson=two-vehicles`, "Compare the three rules" | Headline | Equal uplink share and departure deadline first get both vehicles ready on time; first come, first served gets 1 of 2. | |
| | Header | Upload rule │ Ready on time │ Ready late │ Unfinished / pending, of 2 │ Late minutes, all vehicles │ Vehicle A ready · deadline 15 min │ Vehicle B ready · deadline 5 min | |
| | Rows | First come, first served │ 1 of 2 │ 1 of 2 │ 0 / 0 │ 8 min, final total │ 12 min · On time │ 13 min · Late; Equal uplink share │ 2 of 2 │ 0 of 2 │ 0 / 0 │ 0 min, final total │ 13 min · On time │ 4 min · On time; Departure deadline first │ 2 of 2 │ 0 of 2 │ 0 / 0 │ 0 min, final total │ 13 min · On time │ 3 min · On time | B under first come is 13 − 5 = 8 min late |
| **F02** `#/fleet-day` default, seed 42, "Run fleet day" | Summary | 95 completed · 176 unserved · 4 waiting · 9 in progress = 284 requests. … Completion 33.5% of all 284 requests versus the 95% teaching target, not an industry SLA. | 95 + 176 + 4 + 9 = 284; 95 / 284 = 33.5% |
| | Cards and end state | Completed 95 / 284; Unserved 176 / 284, "Of all requests; riders who left before assignment"; "Mean over 15 completed depot visits; includes queues"; "14 of 29 started depot visits unfinished" | 15 + 14 = 29 |
| | Activity table | Recorded activity │ Vehicle-hours │ Share of 192 vehicle-hours; Serving riders │ 39.8 │ 20.7%; Empty pickup / reposition │ 87.7 │ 45.7%; Depot work │ 29.1 │ 15.2%; Depot queues │ 25.4 │ 13.2%; Idle / available │ 9.9 │ 5.2% | 24 × 480 ÷ 60 = 192; 39.8 / 192 = 20.7%; shares total 100.0% |
| **F03** `#/street-lab` default Bridge rush, seed 42 | After "Run street scenario" | 37 of 71 journeys finished in this replay; 0 expired, 12 waiting and 22 in progress at the end. Seed 42, one replay. Pickup wait 19.1 min, "Mean for 50 boarded riders, including pickup dwell"; Passenger leg 28.2 min, "Mean for 37 completed journeys only" | 37 + 0 + 12 + 22 = 71 |
| | After "Compare route policies" | Mixed trade-off, same demand, seed 42: queue-aware routes finished 41 vs 37 of 71 journeys, with +37.5 km empty distance and +2 vehicles in the busiest-moment queue total. One seed. | |
| | Table (Free-flow │ Queue-aware │ Change) | Completed journeys, of 71 requests │ 37 │ 41 │ +4; Mean pickup wait, boarded riders │ 19.1 min │ 18.6 min │ -0.5 min; Mean passenger time, completed only │ 28.2 min │ 25.9 min │ -2.3 min; Empty road distance │ 465.5 km │ 503 km │ +37.5 km; Unavailable vehicle time │ 2,436.6 vehicle-min │ 2,429 vehicle-min │ -7.6 vehicle-min; Queued on all streets at the busiest moment │ 138 vehicles │ 140 vehicles │ +2 vehicles; Requests waiting at horizon │ 12 │ 10 │ -2; Requests in progress at horizon │ 22 │ 20 │ -2 | every Change is the shown difference (on `00d834f` the two mean rows read -0.4 and -2.4) |
| **F04** `/network-flows/capacity/` default, data-heavy workload | Cards: Base; Different rule; More bandwidth; More power | Ready on time 3 of 12, missed 9 of 12 (late 9, unfinished 0), 132.3 min, uplink 57% of available bytes used · site feed not needed; 3 of 12, 9 of 12, 70 min, 57%; 9 of 12, 3 of 12 (late 3, unfinished 0), 1.5 min, 28%; 3 of 12, 9 of 12, 132.3 min, 57% | 3 + 9 = 12; 132.3 − 70 = 62.3 |
| | Reading | Under the data-heavy workload, departure deadline first leaves on-time readiness at 3 of 12 with 62.3 fewer late minutes; more bandwidth takes on-time readiness from 3 to 9 of 12; more site power changes nothing. | matches the cards |
| | Full study, first rows | Data-heavy │ Base │ First come, first served │ 3 of 12 │ 9 of 12 │ 105 min; Data-heavy │ Base │ Equal uplink share │ 3 of 12 │ 9 of 12 │ 132.3 min | the morning audit's 105 and 132.3 min figures are these two rows |

**The morning audit's other figures** (a separate review on 2026-11-11 whose notes were not available; the owner relayed its F02 and F03 items):
- Street lab's "4.5%", a p90 pickup wait rising from 21 to 22 min, and a "10%" saving do not occur in the Street lab source (live or candidate) or the built stage. The Street model computes no percentile; from its records, the default comparison's p90 pickup wait is 38.8 min free-flow and 37.3 min queue-aware. As a share, the passenger-time change is 2.36 / 28.23 = 8.4% of the free-flow mean, and the page prints no percentage. The real defect, the Change column subtracting unrounded means, is fixed.
- Fleet day's paired policy comparison, the studio's other wait-p90 readout, answers "Experiment unavailable: Enable the charging extension before this comparison." on default settings.
- Fleet day's 39.8 is vehicle-hours: 39.8 / 192 = 20.7%, now under the header "Share of 192 vehicle-hours".

### What `43d4153` changed on top of `00d834f`

Four commits:
- `ec77e86`: the changes and their tests, listed in §6 of the block above (F01 to F04 labels, image order for WebKit, the accessibility batch, the stable source offer, the City Python CI step), and this file's §4 rules.
- `6b6ee3c`: the owner-authorized exact ceilings for the first candidate.
- `8896c0d`: the owner's follow-up. Street lab's Change column now subtracts the values it shows and its mean rows say so; Fleet day's share column names its total; the A2 re-pin and both standing rules are recorded as owner-approved in §4.
- `43d4153`: the re-measured exact ceilings (table below).

### Bytes (owner-authorized exact values, 0 B spare)

| Ceiling | `00d834f` | `43d4153` |
|---|---|---|
| `legacy_text_bytes` | 2,625,315 | 2,626,727 (+1,412) |
| Offline edition | 2,587,228 B, `4fdc264e…` | **2,588,236 B, `77534e343a3f53ee79255c079d5ad883eb4ca967540625732cde9b5c7e9f42c3`** (reserve 33,204 B under 2.5 MiB) |
| NF03 closure cap | 595,010 | 595,530 (+520) |
| Stage closures NF04 / delivery order / R1 / R3 / depot | 276,394 / 281,518 / 252,832 / 208,330 / 568,200 | 276,671 / 281,795 / 253,146 / 208,607 / 568,477 |
| Emitted / integration text (stage) | 3,648,811 / 183,622 | 3,650,566 / 183,944 |
| Brand unit | 128,618 | 128,895 (+277) |
| Integration source | 444,482 | 444,804 (+322) |
| Source offer, extracted / compressed (stage) | 4,160,549 / 1,172,408 | 4,163,092 / 1,173,616 |
| `non_city_bytes` | 16,454,222 | 16,458,193 (+3,971) |
| Development baselines | raw 3,577,927; extracted 4,160,490; compressed 1,172,344; integration source 444,482 | raw 3,580,124; extracted 4,163,033; compressed 1,173,557; integration source 444,804 |
| Unchanged | depot route-local 418,159; hosted artwork (41 files, 7,933,679 B); package metadata cap 45,385 | |

All copies moved together, as listed in the November 10 section, with the two derived fixtures of §5 item 7 moved by hand.

### Checkouts and branches (2026-11-11, evening)

| Where | What |
|---|---|
| `…/Hermes-worktrees/fleetlab-numbers-webkit-20261111` | `claude/fleetlab-numbers-webkit-20261111` at `43d4153`, clean; merged into `main` by PR #31 |
| `…/Hermes-worktrees/fleetlab-release-43d4153` | The record branch `claude/fleetlab-release-43d4153` (`aa360cc`, merged by #32), then this results follow-up on `claude/fleetlab-sot-results-20261111`, on top of `main` `4ec54c7` |
| `…/Hermes-worktrees/fleetlab-workbench` | The release workbench, detached at `1031e93`. Its ignored `build/fleetlab-city/` still holds the stage inputs, the Node 22.23.4 toolchain and the City venv |
| `…/Hermes-worktrees/ux-impl-20261104` | Not changed in this wave; the daily readback task runs its `readback.py` |

### Next actions, in order

| # | Action | Who |
|---|---|---|
| 1 | Done 2026-11-11: this record merged as #32 (`4ec54c7`). Merge the results follow-up from `claude/fleetlab-sot-results-20261111` with a merge commit once CI passes | Owner, or an agent on the owner's message naming the branch and commit |
| 2 | Decide the open items in §6 of the block above (branch protection on `main`, a stage build in CI), starting from `main` | Owner |
| 3 | Never tested on this release: real Safari, screen readers, a physical phone | Owner, on request |

## November 11, 2026 — FleetLab release `00d834f` live, production `273b73d6`: the fixes wave and the website date rule

**Superseded as the release record by the November 11 (evening) section above.** Its "Start here" items 1 and 3 still apply. Item 2 no longer does: the compressed source offer is now stable across commits (§5 item 7 of the block above). The November 10 section below is superseded as the release record. Its "Start here" items 2 to 4 and its byte method still apply, except where these sections update them. The November 8 section's design feedback and "Things the next agent must know", the November 2 section's "Start here" block and the October 26 rules apply as before.

### Start here: what changed for anyone continuing FleetLab after 2026-11-11

1. **The footer date is now a standing rule** (§4 and §5.9 of the block above). This release reads "Date: Nov 11th, 2026" (`datetime="2026-11-11"`) on the studio pages, City Explorer and Depot Readiness. The first candidate carried Nov 10th; the upload moved to November 11, so the date was changed and the stage rebuilt before the upload.
2. **The compressed source offer varies by a few bytes from commit to commit.** Two commits with the same tree measured 1,172,405 and 1,172,407 B, and `non_city_bytes` moved with it byte for byte. Each amend in the exact-ceiling loop is therefore a new draw: this release needed 12 rounds after the date change, and the Nov 10th candidate 14. Run the loop with a high round cap (30 was enough) and stop only when re-writing the commit's own measurement changes nothing. Any later amend, including a date change, reopens the loop.
3. **One test moved with a fix.** `d1-presentation.test.mjs` now expects focus on the "Result summary" heading after a Fleet day run, which the accessibility fix brings into view.

### Live release

| What | State |
|---|---|
| Source | `00d834fd3fd3cf66a7c772057bfa682c9aa875ae` on `claude/fleetlab-fixes-20261110`, two commits on top of `823a89f`. It reaches `main` through a pull request from that branch; this record follows in a second pull request from `claude/fleetlab-release-00d834f`, stacked on it |
| Production | https://fleetlab.pages.dev/, Pages deployment `273b73d6` (https://273b73d6.fleetlab.pages.dev/), uploaded by the owner from Terminal with the locked wrapper on 2026-11-11 |
| City Explorer | Current generation `city-explorer/releases/f3adaa721f75b59a`, rollback generation `d71826cf1aa949ea`. The City base is unchanged; the new generation hash comes from the re-branded hosted shell and source commit, as before |
| Rollback | Pages deployment `d477d470` (source `0b0fb05`); before it `9de52270` (`5a4dafb`) |
| Live verification, 2026-11-11, both hosts | `publication.json` 1,800 B, byte-equal to the stage, `source_commit` `00d834f…`, on both hosts. Offline edition 2,587,228 B, `4fdc264e…`, on both hosts. Full readback 10,186 / 10,186 files with 0 mismatches, and effective headers 100 / 100, on https://fleetlab.pages.dev and on https://273b73d6.fleetlab.pages.dev. In a Chromium browser with no request interception, the footer of `/#/home`, `/network-flows/rebalancing/`, `/depot-readiness/` and City Explorer read "Date: Nov 11th, 2026" with `datetime` 2026-11-11 on both hosts (8 of 8). Rebalancing showed its first result, and no stylesheet rule there matches the retired shimmer. Not done: real Safari, screen readers or a physical phone on this release |
| Gates at `00d834f` (clean tree, Node 22.23.4, Python 3.11.15) | Stage check 20 / 20, every exact bound at 0 B spare (the package-metadata cap kept as before). The wrapper's `deployPreflight` and `verifyStage` pass without credentials. Development baselines: 0 fail. Stage packaging 16 / 16. City Python 375. City Node 345 / 345. Playground 2,972 / 2,981 (8 skipped, 1 TODO, 0 fail). Traffic 14 / 14. Playground with `FLEET_PLAYGROUND_PERF=1`: 3,290 / 3,291 (1 TODO, 0 fail). `ruff check .` clean. pytest (`-m "not metadrive"`, `CI=true`, `PYTHONPATH=src`): 1,447 passed, 228 skipped by the CI fixture guard, 55 deselected. Against `0b0fb05`, Playground has +3 tests: the Limits, D6 Rebalancing and D6 Dispatch regression tests |
| Scheduled readback | The daily task `fleetlab-daily-readback` still checks the `0b0fb05` stage record, so it reports FAIL until it is re-pointed (next actions, row 1) |
| Evidence | Kept privately outside the repository: the wave's implementation report, the stage, the gate receipts, the live readbacks and the browser observations. The stage record is `local-release.json`, SHA-256 `50cb7a308174710d3e3e41bfe38cbd7dbd7003b098c9bea019d1e3f99db3bb66`; the stage holds 10,187 files and 1,629,831,093 B |

### What `00d834f` changed on top of `0b0fb05`

Two commits:
- `20eb88d`: the fixes and their tests, listed in §6 of the block above:
  - the footer date;
  - repeated Limits in Fleet day;
  - the hero shimmer retired;
  - defect (c), D6, on Rebalancing and Dispatch;
  - the three accessibility fixes;
  - and this file's date rule and §6.
- `00d834f`: the owner-authorized exact ceilings for `20eb88d` (table below).

### Bytes (owner-authorized exact values, 0 B spare)

| Ceiling | `0b0fb05` | `00d834f` |
|---|---|---|
| `legacy_text_bytes` | 2,624,909 | 2,625,315 (+406) |
| Offline edition | 2,586,822 B, `85f824d5…` | **2,587,228 B, `4fdc264ee55d6c38367240f46dec719e822cd4f9170d2cfc855f615f263b25d8`** (reserve 34,212 B under 2.5 MiB) |
| NF03 closure cap | 595,495 | 595,010 (−485) |
| Stage closures NF04 / delivery order / R1 / R3 / depot | 276,879 / 282,003 / 253,367 / 208,786 / 568,685 | 276,394 / 281,518 / 252,832 / 208,330 / 568,200 |
| Emitted / integration text (stage) | 3,648,910 / 184,106 | 3,648,811 / 183,622 |
| Brand unit | 129,103 | 128,618 (−485) |
| Integration source | 445,023 | 444,482 (−541) |
| Source offer, extracted / compressed (stage) | 4,160,569 / 1,172,318 | 4,160,549 / 1,172,408 |
| `non_city_bytes` | 16,453,825 | 16,454,222 (+397) |
| Development baselines | (see the November 10 section) | raw 3,577,927; extracted 4,160,490; compressed 1,172,344; integration source 444,482 |
| Unchanged | depot route-local 418,159; hosted artwork (41 files, 7,933,679 B); package metadata cap 45,385 | |

All copies moved together, as listed in the November 10 section.

### Checkouts and branches (2026-11-11)

| Where | What |
|---|---|
| `…/Hermes-worktrees/fleetlab-fixes-20261110` | `claude/fleetlab-fixes-20261110` at `00d834f`, clean |
| `…/Hermes-worktrees/fleetlab-release-00d834f` | `claude/fleetlab-release-00d834f`: this record, on top of `00d834f` |
| `…/Hermes-worktrees/fleetlab-workbench` | The release workbench, detached at `823a89f`. Its ignored `build/fleetlab-city/` still holds the stage inputs, the Node 22.23.4 toolchain and the City venv |
| `…/Hermes-worktrees/ux-impl-20261104` | Not touched in this wave |

### Next actions, in order

| # | Action | Who |
|---|---|---|
| 1 | Re-point the daily readback task `fleetlab-daily-readback` to the `00d834f` stage record. Until then it reports FAIL, and its first check, `publication.json`, shows the deliberate redeploy | Owner go-ahead; agent |
| 2 | Merge the fixes pull request from `claude/fleetlab-fixes-20261110`, then this record's pull request, each with a merge commit once CI passes | Owner, or an agent on the owner's message naming each branch and commit |
| 3 | Decide the open items in §6 of the block above, starting from `main` | Owner |
| 4 | Never tested on this release: real Safari, screen readers, a physical phone | Owner, on request |

## November 10, 2026 — FleetLab release `0b0fb05` live, production `d477d470`: two performance waves

**Superseded as the release record by the November 11 section above.** The November 8 section below is superseded as the release record. These parts of it still apply except where this section updates them:
- its "Start here" items 2–4;
- the design feedback;
- "Things the next agent must know" (the City base, exact ceilings, where small changes go, live-verification pitfalls, and the upload procedure).

The November 2 section's "Start here" block and the October 26 rules apply as before.

### Start here: what changed for anyone continuing FleetLab after 2026-11-10

1. **`main` now holds the live line.** The release branch `claude/fleetlab-perf-20261109` (at `0b0fb05`, which contains the 45 commits of `codex/fleetlab-ux-impl-20261104` through `5a4dafb`) is merged into `main` by PR #27 from `claude/fleetlab-main-reconcile-0b0fb05`, merged as `4c0de12` on 2026-11-11, after four test-only fixes made the concept-motion browser test pass on the CI runner. Start new FleetLab work from `main` after a fetch. The November 8 note that `main` is behind the live line no longer applies.
2. **Byte ceilings are still exact, with zero headroom.** The owner authorized new exact values on 2026-11-09 and 2026-11-10 (table below). Any added byte still needs the owner's authorization. The method is unchanged: measure on a clean commit, write the exact values, amend, and repeat until the commit's own measurement needs no change.
   - A dirty tree reads the bound files 9 B low, so never measure there.
   - A loop that stops at "passes" can leave a byte or two of spare; stop only when re-writing changes nothing.
3. **The release integrator declares every teaching client file that may differ from the preserved legacy site.** These are `CLIENT_FIXES` and the flow sets in `apps/fleetlab-city/tools/integrate-site.py`. The declared set must equal the changed set. A change to any other Playground model or UI file stops the release build ("undeclared teaching client change") until it is declared there, with a provenance comment. `0b0fb05` declares `src/model/street-simulation.js` and `src/model/world.js`.
4. **Hidden studio routes no longer fetch their images, and static pages hold content below hosted insertions.**
   - Images: `syncRouteImages` in `hosted/visitor.mjs` keeps every non-lazy image under a `[hidden]` route lazy (marked `data-eager`) until the route shows. It runs after decoration and on every change of a `hidden` attribute.
   - Static pages: `brand.css` hides what follows the readiness context and the field notes until they are inserted, with a 3 s failsafe. On phones, it also hides a static header's links until decoration.
   - A new image or hosted insertion on these paths should follow the same pattern, or it brings back the shifts and transfer that these changes removed.

### Live release

| What | State |
|---|---|
| Source | `0b0fb0566d3f906686c3f4cb14f1a240c5abe081` on `claude/fleetlab-perf-20261109`. Pushed 2026-11-10 on the owner's written authorization naming that branch and commit. Merged into `main` through a pull request from `claude/fleetlab-main-reconcile-0b0fb05`, whose merge commit `d52cc65` joined the two lines on that branch; PR #27 itself merged onto `main` as `4c0de12` |
| Production | https://fleetlab.pages.dev/, Pages deployment `d477d470` (https://d477d470.fleetlab.pages.dev/), uploaded by the owner from Terminal with the locked wrapper on 2026-11-10 |
| City Explorer | Current generation `city-explorer/releases/1f560fc76eb1a729`, rollback generation `d71826cf1aa949ea`. The City base (`city-base-refresh-20261108b/base`) is unchanged from `5a4dafb`; `build-release.py` re-brands that base with the release's hosted shell and source commit, which gives each release a new generation hash. The footer reads "Date: Nov 8th, 2026": `0b0fb05` shipped with the date of `5a4dafb`, before the website date rule |
| Rollback | Pages deployment `9de52270` (source `5a4dafb`); before it `1dfb0f22` (`4b039be`) |
| Live verification, 2026-11-10, both hosts | `publication.json` 1,800 B, byte-equal to the stage, `source_commit` `0b0fb05…`, on both hosts. Offline edition 2,586,822 B, `85f824d5…`, on both hosts. Full readback 10,186 / 10,186 files with 0 mismatches, and effective headers 100 / 100, on https://fleetlab.pages.dev and on https://d477d470.fleetlab.pages.dev. A headless Chrome 157 check with no request interception covered `/#/home`, `/#/catalog`, `/#/street-lab` and `/depot-readiness/` at 1280×900 and 320×700 (Slow 4G, 4× CPU), 3 cold loads each. Mount layout shift was 0.0000 in all 24 loads. The Street lab gave identical results in every run, with 0 Long Tasks in every Compare and in 5 of 6 Runs at 4× (one 53 ms task). The methodology explainer drew 0 frames in 5 s off screen. Not done: Safari, Firefox, screen readers or a physical phone |
| Gates at `0b0fb05` (clean tree, Node 22.23.4, Python 3.11.15) | Stage check 20 / 20, every exact bound at 0 B spare (the package-metadata cap kept as before). Stage packaging 16 / 16. City Python 375. City Node 345 / 345. Playground 2,969 / 2,978 (8 skipped, 1 TODO, 0 fail). Traffic 14 / 14. Playground with `FLEET_PLAYGROUND_PERF=1`: 3,287 / 3,288 (1 TODO, 0 fail, 0 skipped). Against `5a4dafb`'s 3,283 / 3,285, that is +3 tests and +4 passes: +1 test in wave 1 (`methodology-explainer.test.mjs`), +2 in wave 2 (`street-simulation.test.mjs` and `street-lab.test.mjs`), and the `scale-lab.test.mjs` packed-page test, which now passes |
| Scheduled readback | The daily task `fleetlab-daily-readback` still checks the `5a4dafb` stage record, so it will report FAIL until it is re-pointed to the `0b0fb05` record (next actions, row 1) |
| Evidence | Kept privately outside the repository: the performance report and its traces, the stage, the gate receipts and the live readbacks. The stage record is `local-release.json`, SHA-256 `62046314f9e6fdb0e48a4b4fd3be344e05c35c4b9cac520e282362db3df33d48`; the stage holds 10,187 files and 1,629,830,696 B |

### What `0b0fb05` changed on top of `5a4dafb`

Four commits, from a live performance evaluation of `5a4dafb` (mount layout shift, interaction blocking, frames, memory, the opt-in suite):
- `3c6584a`:
  - The studio is decorated in the task that mounts it (`boot.js` imports `brand.mjs`).
  - A static top-level header gets its final box from the first paint.
  - The pre-mount shell fills the first screen.
  - The methodology explainer stops drawing frames while off screen.
- `59aa704`: exact ceilings for `3c6584a`.
- `4342577`:
  - The packed-page tests share one sandbox helper, so the opt-in `scale-lab` packed test passes.
  - `buildWorld` reuses its seed-independent candidate stream.
  - The Street lab runs its day in slices through `runSliced`.
  - Hidden routes' images wait until their route shows, and the concept video drops its duplicate poster.
  - Static pages: the brand-box, phone-header and hold rules described in item 4 above.
- `0b0fb05`: the integrator declaration and exact ceilings for `4342577`.

What changes on the site (Chrome 157 over the DevTools protocol, 1280×900 unthrottled and 320×700 with Slow 4G and 4× CPU):

| Measure | `5a4dafb` | `0b0fb05` |
|---|---|---|
| Mount layout shift (Window A), six studio routes | 0.23–0.96 desktop, 0.14–1.03 mobile | 0.0000 at both widths |
| Window A, Depot Readiness | 0.94 desktop, 0.89 mobile | 0.0000 |
| Window A, Rebalancing and Dispatch | up to 0.67 (Rebalancing, desktop) | 0.0000–0.0001 |
| City Explorer Window A | 0.039 desktop, 0.266 mobile | unchanged |
| Images fetched at mount on a studio route | 2.0–2.7 MB | 0.1–1.2 MB (−1.5 to −1.9 MB) |
| Mobile `/#/catalog` LCP | 12.8 s | 10.06 s live (9.57 s with the changed files served locally) |
| Street lab main-thread block at 4× CPU (Run / Compare) | 1,347 / 2,763 ms in one task | 0 Long Tasks in 9 of 10 runs; one marginal 53 ms task (3 ms TBT) in the first live Run |
| Methodology explainer frames while off screen, per 5 s | 300 | 0 |
| Opt-in `scale-lab` packed test | fails (test sandbox) | passes |

**Accepted as is (owner, 2026-11-10):**
- Mobile `/#/catalog` LCP stays above its 7.8 s target. The catalog hero shares the throttled link with six catalog tiles that start at the same mount. Holding those tiles in JavaScript, or adding smaller hero artwork, was declined.
- The mobile Window B of 0.0040–0.0041 on Rebalancing and Dispatch is page-owned and left as is. It comes from the `#watch` label changing from two lines to one.

### Bytes (owner-authorized exact values, 0 B spare)

| Ceiling | `5a4dafb` | `0b0fb05` |
|---|---|---|
| `legacy_text_bytes` | 2,623,233 | 2,624,909 (+285 explainer, +1,391 Street and world) |
| Offline edition | 2,585,068 B, `d8b5e5f1…` | **2,586,822 B, `85f824d5796a93136caa7d4573c6d710a218203d2757244c0b2d823bcf75a08a`** (reserve 34,618 B under 2.5 MiB) |
| NF03 closure cap | 594,015 | 595,495 |
| Stage closures NF04 / delivery order / R1 / R3 / depot | 275,399 / 280,523 / 251,602 / 207,306 / 567,205 | 276,879 / 282,003 / 253,367 / 208,786 / 568,685 |
| Emitted / integration text (stage) | 3,645,732 / 182,604 | 3,648,910 / 184,106 |
| Integration source | 443,073 | 445,023 |
| Source offer, extracted / compressed (stage) | 4,156,641 / 1,171,061 | 4,160,569 / 1,172,318 |
| `non_city_bytes` | 16,447,636 | 16,453,825 |
| Unchanged | depot route-local 418,159; hosted artwork (41 files, 7,933,679 B); package metadata cap 45,385 | |

All copies moved together:
- the stage-check bounds and their test;
- the Step A unit and development baselines;
- the two production NF03 guards and their two test copies;
- the Offline pin in `package-proof.mjs`, `package-proof.test.mjs`, `stage-check.mjs` and its test, `depot-lab-package.test.mjs`, `enhancement-packaging.test.mjs`, and `capacity-site.test.mjs`. The last one writes the pin with numeric separators (`2_586_822`), so search with and without them.

On `main`, the reconcile also wraps four over-long lines in `apps/fleetlab-city/tools/integrate-site.py` for ruff E501, making it 57 B smaller. The release branch never ran CI, so these lines first met the linter here. `main`'s development baselines in `stepa-baselines.test.mjs` are therefore re-measured lower than the release's: integration source 444,966; development source offer 4,160,454 extracted and 1,172,228 compressed. The stage bounds in `stage-check.mjs` keep the released values until the next release re-pins them.

### Checkouts and branches (2026-11-10)

| Where | What |
|---|---|
| `…/Hermes` | On `main`, fast-forwarded to the reconcile merge once the pull request merged |
| `…/Hermes-worktrees/fleetlab-workbench` | The release workbench, detached at the new `main`. Its ignored `build/fleetlab-city/` still holds the stage inputs, the Node 22.23.4 toolchain and the City venv |
| `…/Hermes-worktrees/ux-impl-20261104` | `codex/fleetlab-ux-impl-20261104`, fast-forwarded locally from `5a4dafb` to `0b0fb05`, clean. Its GitHub copy stays at `5a4dafb`; that branch was not pushed |

Removed on 2026-11-11 after the merge:
- The worktrees `…/Hermes-worktrees/fleetlab-perf-20261109`, `…/Hermes-worktrees/perf-suite-5a4dafb` and `…/Hermes-worktrees/main-reconcile-0b0fb05`.
- The local-only bookmark branch `claude/fleetlab-perf-wave1-59aa704`, whose commit is contained in the release.

The release branch `claude/fleetlab-perf-20261109` and the reconcile branch stay, locally and on GitHub. The released stage and the evidence stay outside the repository. Other worktrees, including the Codex worktrees, the ADAS worktree, the three `Hermes-evidence` release worktrees and the `design-*` worktrees, were not touched; some of them hold uncommitted work that predates this release.

### Next actions, in order

| # | Action | Who |
|---|---|---|
| 1 | Done 2026-11-11 on the owner's go-ahead: the daily readback task `fleetlab-daily-readback` now checks the `0b0fb05` stage record; a dry run of its command matched 10,186 / 10,186 | Owner go-ahead; agent |
| 2 | Choose the next design, content or performance item, starting from `main` | Owner |
| 3 | Never tested, as before: Safari, Firefox, screen readers, real phones on this release | Owner, on request |

## November 8, 2026 — FleetLab release `5a4dafb` live, production `9de52270`: green City depots framed on arrival, design-review fixes, Nov 8th date

**Superseded on 2026-11-10 as the release record by the November 10 section above, and kept as the record of the `5a4dafb` release.** Its "Start here" items 2–4, design feedback and "Things the next agent must know" still apply except where the November 10 section updates them. Its item 1 (`main` behind the live line), its checkouts and its next actions are superseded. The November 2 section's "Start here" block still applies except where these sections update it: the roles, the code map, the local environment and the workspace layout. The October 26 section keeps the rules and the later scopes, which still apply.

### Start here: what changed for anyone continuing FleetLab after 2026-11-08

1. **The live site is built from the release branch, not from `main`.** All six releases since `94a201f` were built and pushed on `codex/fleetlab-ux-impl-20261104`. `main` (`964d413` since PR #24 on 2026-11-09, which added only this section) has none of them: it is 45 commits behind the live line, and its `docs/releases/fleetlab-current.json` still describes `94a201f`. Start any new FleetLab work from `5a4dafb`, not from `main`, until `main` is reconciled (next actions, row 2).
2. **Changes to City Explorer's viewer ship only through a new City base.** See "Things the next agent must know", item 1.
3. **Byte ceilings are exact, with zero headroom.** Any added byte needs the owner's authorization, and every commit moves two of the bounds by a byte or two. See item 2.
4. **The design state is accepted.** The design review of 2026-11-08 closed with the dispositions below. Its two residuals are accepted as they are; do not reopen them without a new owner request. Design reviewers start at "Design feedback" below: the verdicts, the tokens in use, and what a proposal costs.

### Live release

| What | State |
|---|---|
| Source | `5a4dafbe8af299a4ed162fc13c8e4ca5a866b1cb` on `codex/fleetlab-ux-impl-20261104`. Pushed 2026-11-08 as `4b039be..5a4dafb` on the owner's confirmation naming that commit. No pull request; not merged to `main` |
| Production | https://fleetlab.pages.dev/, Pages deployment `9de52270` (https://9de52270.fleetlab.pages.dev/), uploaded by the owner from Terminal |
| City Explorer | Current generation `city-explorer/releases/a4c787459154ac50`, rollback generation `d71826cf1aa949ea`. City base manifest `621e32ee90385fc73a026b42ea2afff1f6e4fb89e09b0b2efb061c9a37ffad7a` |
| Rollback | Pages deployment `1dfb0f22` (source `4b039be`); before it `ba603536` (`e3a5f0c`) |
| Live verification, 2026-11-08 20:32–20:44 UTC, both hosts | `publication.json` 1,800 B, byte-equal to the stage. Readback 10,186 / 10,186 files (1,629,822,397 B, 0 mismatches). Effective headers 100 / 100. 8 pages × 4 widths 32 / 32 (0 overflow, 243 Street labels, 0 clips, 0 collisions). Behavior 11 / 11. City, Readiness, Sources and Walkthrough 52 / 52, including green markers. Footer date 16 / 16. The Q2 and Q4 checks below pass. 0 console errors |
| Gates at `5a4dafb` (clean tree, Node 22.23.4, Python 3.11.15) | Stage check 20 / 20; stage packaging 16 / 16; City Python 375; City Node 340 / 340; Playground 2,966 / 2,975 (8 skipped, 1 TODO, 0 fail); traffic 14 / 14. The 4b039be release's focused suites, matched by subtest name inside the full logs: bytes 12 / 12, validators 45 / 45, motion 92 / 92, related 94 / 94 |
| Scheduled readback | Claude Desktop scheduled task `fleetlab-daily-readback` on the owner's Mac, created 2026-11-08. It runs daily at 09:00 local (09:09 after the app's dispatch delay). It runs `apps/fleetlab-city/tools/readback.py --url https://fleetlab.pages.dev` against the `5a4dafb` stage record, keeps a dated receipt and reports PASS or FAIL. It is read-only. No such job existed before 2026-11-08 (cron, launchd, Codex automations, Claude scheduled tasks and cloud routines were all checked). An earlier note that a 09:00 job was re-pointed to `ceb3d25` has no job behind it |
| Evidence | Release reports, stages, receipts and screenshots are kept privately outside the repository. The stage record is `local-release.json`, SHA-256 `7dcda4e54cc97b8e136796167306c77469c6456bce2844dec574cf36e8b0326d` |

### Releases since `94a201f`

All were uploaded by the owner and verified on both hosts.

| Verified | Source | Pages deployment | Content |
|---|---|---|---|
| 2026-11-04 | `de80555` | `79489c69` | UX audit, wave 1 (A1, D1, A2, B2+B1, E1) |
| 2026-11-06 | `57dd67e` | `e5424a33` | Waves 2C and 2D. Identity, bytes, headers and geometry verified; the browser gate stopped incomplete |
| 2026-11-06 | `ceb3d25` | `36954b5c` | Footer date "Nov 6th, 2026" only |
| 2026-11-06 | `e3a5f0c` | `ba603536` | Waves 3 and 3.5: Fleet day telemetry, legend and map colours |
| 2026-11-08 | `4b039be` | `1dfb0f22` | Design audit phases 1 to 3: hierarchy, final-value outcome chips, Readiness lead, the M1 depot-pipe and M2 turnaround motions. One live check failed: the City depot markers were red, because the Phase 2 viewer edits never shipped (item 1 below) |
| 2026-11-08 | `5a4dafb` | `9de52270` | This release |

### What `5a4dafb` changed on top of `4b039be`

Five commits:
- `17c4bcf`: a re-derived City base, so the Phase 2 viewer presentation ships.
- `0e3c989`: the date.
- `4ea10f8`: the Q2 framing.
- `1d6de97`: the Q4 CSS.
- `5a4dafb`: the exact ceilings.

What changes on the site:
- **City Explorer depots are forest green, `#143c2b`,** in all three places: the map markers, the flat-map fallback squares and the legend swatch. They were red.
- **The interactive atlas opens with both fictional depots in view, below the map toolbar.** The centre is `[-122.4306, 37.7584]` at zoom 12.2; under a 480 px viewport it is `[-122.4306, 37.7683]` at zoom 11.4. The minimum margin to the map edge is 100 / 100 / 70 / 67 px at 1280 / 768 / 390 / 320.
- **The footer reads "Date: Nov 8th, 2026"** (`datetime="2026-11-08"`), on every studio page and on City Explorer and Depot Readiness.
- **Two links that fell back to browser blue are now on-palette `#204f3f`:** "open the Scale lab" and the studio footer's "Map qualification" link.
- **The Result summary focus ring hugs the heading.** It is 2px `#143c2b` with a 4px offset; before, it was the browser's full-width box. Focus still moves there after a run.
- **The Fleet day activity key wraps to two rows from 768 px** instead of clipping a word. Phones keep the compact scrolling strip.

Bytes:
- The Q4 CSS added 156 B to `apps/fleetlab-city/hosted/visitor.css`. That file was already minified, so nothing could be tightened.
- On the owner's authorization, the ceilings moved to the exact measured values of `5a4dafb`, with 0 B spare:
  - every route closure, and emitted, integration and brand text: +156 each;
  - integration source and the extracted source offer: +152 each;
  - the compressed source offer: +56;
  - non-City bytes: 16,447,424 → 16,447,636.
- Depot route-local (418,159 B), hosted artwork (41 files, 7,933,679 B) and the Offline edition (2,585,068 B, `d8b5e5f1…`) are unchanged.

### Design feedback: current state, how a review runs, and what a proposal costs

This is the starting point for any design reviewer or agent proposing visual or wording changes.

**How a design review runs.** This is how the 2026-11-08 review ran:
1. The agent writes a brief: numbered questions, before and after captures at 1280 and 320 px, and the cost of each option (table below). The owner sends it to the design reviewers, currently two.
2. The reviewers answer each item with *keep*, *change* or *drop*, a priority (*must*, *should* or *could*), one line of reasoning, and whether it adds bytes.
3. The owner accepts the verdicts and authorizes any ceiling change.
4. The agent implements the verdicts it agrees with and says where it does not. It reruns every gate and checks each fix in the browser at 1280×900 and 320×700: on the local stage first, then on both live hosts after the owner's upload.
5. Briefs, verdicts and captures are kept privately outside the repository. This section is their public summary.

**The 2026-11-08 verdicts, all live in `5a4dafb`:**

| Item | Verdict | Reasoning | Live result |
|---|---|---|---|
| Q1 depot marker colour | Keep, must | `#143c2b` meets WCAG 1.4.11's 3:1 against supported roads (4.35:1) and unsupported roads (4.03:1). The old `#ad4140` did not (2.06:1 and 1.91:1), and red read as an alarm on a static facility. The badge shape, its white ring and the 12.27:1 white letter keep it apart from roads and controls | Markers, flat squares and legend are `#143c2b` |
| Q2 first view of the atlas | Change, must | Hiding both depots behind an unlabelled Fit control hid the subject of the two-depot comparison | Both depots framed below the toolbar at every width. No banner, no new words |
| Q3 date line | Keep, could | "Date: Nov 8th, 2026" and "Updated Nov 8, 2026" are both 19 bytes | "Date: Nov 8th, 2026" |
| Q4a browser-blue links | Change, must | Default blue (`rgb(0, 0, 238)`) broke the palette | `#204f3f` with a 4px underline offset, reusing the tour-link rule |
| Q4b Result summary focus | Change, should | The full-width box read as an input or an error banner and competed with the numbers. Focus must still move there for keyboard and screen-reader users | A 2px `#143c2b` ring at a 4px offset that hugs the heading, on `:focus-visible` |
| Q4c Fleet day activity key | Change, should | "waiting" was cut to "waitir" at 1280 px | Wraps to two rows from 768 px; phones keep the scrolling strip |
| Other live pages | Keep, must | Home insights, the vehicle-hours ledger, M1, M2, Readiness, Walkthrough and Depot Flow | Unchanged |

**Accepted residuals.** Do not reopen these without a new owner request:
- There are no street names at the atlas's opening zoom. Names draw from zoom 14, and no zoom that shows names fits both depots.
- The activity key's caption still says "scroll for all states" on wide screens.

**Design tokens in use, as measured on the live site:**

| Use | Value |
|---|---|
| Depot markers, the depot legend swatch, the flat-map depot squares, the Result summary focus ring | `#143c2b` |
| In-text links: the tour, "open the Scale lab", "Map qualification" | `#204f3f`, underline offset 4px |
| City roads: supported, unsupported, excluded | `#77a392`, `#bb8b44`, `#b8c2b4` |
| City map land and water | `#f7f5e9`, `#e0eee8` |
| The depot colour before 2026-11-08 | `#ad4140` |

**What a proposal costs.** State the class with every suggestion:

| Class | Examples | What it needs |
|---|---|---|
| Same-length value swap | A colour, or a date such as `Nov 6th` → `Nov 8th` (0 B) | The gates only |
| Hosted CSS or copy | A rule in `apps/fleetlab-city/hosted/visitor.css`, or new words in the hosted shell | The owner's authorization to raise the exact ceilings by the measured bytes (item 2 below) |
| Playground source or styles | `playground/fleetlab/` | As above, plus the Offline edition's pinned size and SHA-256, and the depot route-local bound (418,159 B, fixed) if a depot-route file changes |
| City Explorer viewer | `apps/fleetlab-city/web/` | A new City base and its re-pin (item 1 below). City bytes have no exact ceiling |
| Artwork | Tiles and diagrams | A change to the pinned artwork inventory (41 files, 7,933,679 B) |

**Open design questions.** None remain from the 2026-11-08 review. Never tested, and candidates for the next review: Safari, Firefox, screen readers, live OS reduced-motion toggling, and novice comprehension.

### Things the next agent must know

1. **City Explorer viewer changes need a new City base.**
   - `apps/fleetlab-city/deploy/build-release.py` re-brands a pinned City base generation. It never rebuilds the viewer from `apps/fleetlab-city/web/`, so an edit there ships only after the base is re-derived.
   - The recipe is embedded in [docs/FLEETLAB_CITY_BASE_REFRESH_2026-11-08.md](https://github.com/bohueilin/Hermes/blob/codex/fleetlab-ux-impl-20261104/docs/FLEETLAB_CITY_BASE_REFRESH_2026-11-08.md) on the release branch. It replaces only `style.css` and `city-map.mjs` and their gzip twins, and refuses any other change. Extend its file list deliberately if another viewer file must ship.
   - Then re-pin in three places:
     - `apps/fleetlab-city/deploy/approved-inputs.json` (`base_release`);
     - `apps/fleetlab-city/test/stage-check.mjs` (`INPUT_DIGESTS.city_base`);
     - `apps/fleetlab-city/test/stage-check.test.mjs`: the fixture digest and the 8-character `DIGEST_PREFIXES` entry. This one was missed once.
   - Unit tests read source, so they do not catch an unshipped viewer edit. Compare the served `city-explorer/releases/<id>/` files with `web/`.
   - The current base is in the workbench's ignored `build/fleetlab-city/city-base-refresh-20261108b/base`. It is now a required local stage input, in place of `visitor-preview-20261014/city-explorer/releases/c56bda6b509105c5`. That folder stays, because it is the original the refresh is derived from.
2. **Byte ceilings are exact, with zero headroom.**
   - The commit hash is embedded in the compressed source offer, so `source_offer_compressed_bytes` and `non_city_bytes` move by a byte or two with every commit.
   - The ceilings and their copies are:
     - `apps/fleetlab-city/test/stage-check.mjs` and its test;
     - `apps/fleetlab-city/test/stepa-byte-bounds.test.mjs` and `enhancement-packaging.test.mjs`;
     - `playground/fleetlab/test/stepa-baselines.test.mjs` and `package-proof.test.mjs`;
     - the production nf03 guards in `playground/fleetlab/tools/software-delivery-package.mjs` and `apps/fleetlab-city/tools/integrate-site.py`;
     - two test copies of the nf03 cap that the measuring tool does not update: `apps/fleetlab-city/tests/test_integration.py` and `playground/fleetlab/test/software-delivery-package.test.mjs`.
   - Method: measure from a clean commit, write the exact values, amend, and measure again, until the commit's own measurement needs no change. Raise a ceiling only with the owner's authorization.
3. **Where small changes go.**
   - The footer date lives in `apps/fleetlab-city/hosted/integration.mjs` (studio pages) and `hosted/brand.mjs` (City Explorer and Readiness), and is asserted in `apps/fleetlab-city/test/structural-shell.test.mjs`.
   - Hosted-only CSS fixes go in `hosted/visitor.css`. It loads on every page after the Playground styles, counts toward every route closure, and is not part of the Offline edition.
4. **Live-verification pitfalls (2026-11-08).**
   - The City coverage filters sit in `#atlas-view`, which stays hidden until "City atlas" is opened.
   - `/#/home` → `/#/fleet-day` changes only the fragment, so the DevTools protocol fires no load event.
   - Lazy images inside a closed `<details>` never load, correctly.
   - The global Pause control is disabled for about 200 ms after reduced motion is cleared.
   - Fleet day's run starts only when "Run fleet day" is pressed.
5. **The upload procedure is unchanged.** The owner runs the locked wrapper (`apps/fleetlab-city/deploy/wrangler.mjs`) from Terminal, with the token at a hidden prompt. The script binds the commit, tree, branch, clean tree, pinned Node and the stage record's SHA-256. The wrapper's `verifyStage` can be run as a dry check without credentials.

### Checkouts and branches (2026-11-09)

| Where | What |
|---|---|
| `…/Hermes` | On `main` at `964d413` (the PR #24 merge), clean |
| `…/Hermes-worktrees/ux-impl-20261104` | The release worktree, on `codex/fleetlab-ux-impl-20261104` at `5a4dafb`, clean. Keep it clean: no product commits there without a new owner go-ahead. The upload scripts run from here |
| `…/Hermes-worktrees/fleetlab-workbench` | The release workbench. It is on local branch `claude/sot-cold-archive-done`, which holds the original 2026-11-06 cold-archive record (`898e318`), not on `main` as the November 2 block says. Detach it at `main` once the replayed record merges; its ignored `build/` stays as it is |
| `…/Hermes-worktrees/sot-cold-archive` | The cold-archive record replayed onto `main`, plus this refresh, on `claude/sot-cold-archive-on-main` |
| `…/Hermes-worktrees/ci-ruff-sim102` | The lint fix for `main` CI (next actions, row 4), on `claude/ci-ruff-sim102` |

Removed on 2026-11-09, after PR #24 merged: the build worktree `…/Hermes-worktrees/city-base-refresh-4b039be` and the worktree `…/Hermes-worktrees/sot-release-5a4dafb`. Their local branches stay; the build branch's commits are also on the release branch.

### Next actions, in order

| # | Action | Who |
|---|---|---|
| 1 | Let the 09:00 readback run each day. On a FAIL, check `publication.json` first: a different commit means a deliberate redeploy, so re-point the task to the new record; the same commit means the live bytes changed, so look now (rollback `1dfb0f22`) | Owner; agent on request |
| 2 | Reconcile `main` with the live line: merge `codex/fleetlab-ux-impl-20261104`, then update `docs/releases/fleetlab-current.json`, §7.5 and this section. `main` moved the docs into `docs/hermes/` and `docs/fleetlab/`, while the release branch adds docs at `docs/` and its `approved-inputs.json` provenance paths point at `docs/FLEETLAB_HANDOFF_2026-10-06.md` and `docs/FLEETLAB_CITY_BASE_REFRESH_2026-11-08.md`. Resolve the paths in the same change and rerun the gates | Owner go-ahead naming branch and commit; agent |
| 3 | Choose the next design or content item, starting from `5a4dafb` | Owner |
| 4 | Make `main` CI green again. Since ruff 0.17.4, the Python job's lint step fails with SIM102 at `apps/fleetlab-city/citylib/fleet_trace_v2.py:249`, a file unchanged since 2026-09-30, because CI installs the newest ruff in `ruff>=0.11,<1`. A behaviour-preserving fix is prepared on `claude/ci-ruff-sim102` | Owner go-ahead naming branch and commit; agent |
| 5 | After the replayed cold-archive record merges, detach the workbench at `main` | Agent, on the owner's go-ahead |

Not done on 2026-11-08, on purpose:
- No merge to `main`, and no edit to `docs/releases/fleetlab-current.json`. The owner's guardrail keeps the release worktree untouched.
- No Safari, Firefox or screen-reader testing.
- No change to the two accepted residuals.

## November 2, 2026 — FleetLab release `94a201f` live, production `cdf2bd6e`: new art on four question-family tiles

**Superseded on 2026-11-08 as the release record by the November 8 section above, and kept as the record of the `94a201f` release. Its "Start here" block still applies except where the November 8 section updates it: the roles, the code map, the local environment and the workspace layout. The November 1 section below is the record of the `9dfc6bc` and `8d2c7ac` releases. The October 26 section keeps the rules and the later scopes, which still apply.**

### Start here: how any agent continues FleetLab work

FleetLab is the public teaching website https://fleetlab.pages.dev about autonomous-vehicle fleet operations, built from this public repository (https://github.com/bohueilin/Hermes). It is simplified simulation for learning, and the boundary sentence in the October 26 rules stays verbatim. The rest of Hermes (Phases 0 to 9, ADAS, MuJoCo) is described in §1 to §15, and FleetLab work leaves it alone. The exception is §7.5, FleetLab's own entry, which each release record updates along with the superseded banners and the Checkouts, Remote, Playground and Last updated rows.

**Read in this order:**
1. This block, then the rest of this section: the live release, the open items, and the handoff table with its next actions.
2. The October 26 section: "Rules for anyone continuing this work", actions 2 to 7, and the failure paths. They are the release procedure, with the substitutions listed in this section's handoff. The six-step summary below shows how it ran for `94a201f`. Where they differ, the release sheet governs, then the October 26 section. For example, the sheet puts the go-live message after the preview checks and the owner's phone report, as `848b420` ran, while action 7 lists it before the preview upload.
3. [docs/fleetlab/publishing/FLEETLAB_CLOUDFLARE_DEPLOYMENT.md](docs/fleetlab/publishing/FLEETLAB_CLOUDFLARE_DEPLOYMENT.md), the owner-run upload procedure (its step 4 sets the footer date), and [docs/releases/README.md](docs/releases/README.md), how a release is recorded.
4. [docs/fleetlab/network-flows/FLEETLAB_NETWORK_FLOWS_STEP_A_SPEC_2026-10-25.md](docs/fleetlab/network-flows/FLEETLAB_NETWORK_FLOWS_STEP_A_SPEC_2026-10-25.md) for the byte bounds, baselines and stage check; [docs/fleetlab/handoffs/FLEETLAB_COORDINATED_C2_HANDOFF_2026-10-30.md](docs/fleetlab/handoffs/FLEETLAB_COORDINATED_C2_HANDOFF_2026-10-30.md) §10 for the accepted residuals.
5. Before touching shared code: §0's rules for updating this file, §10 and §12. Skip §0's "Picking up cold" block: it is for the Hermes Python core, and its `make test` count is not a FleetLab gate.

**Who does what.** The owner decides, gives every go-ahead and runs every upload. Agents build, check and record. An agent:
- never uploads and never handles a Cloudflare token;
- never merges or goes live without the owner's own message naming the exact commit (the permission rule in the October 26 section);
- pushes or opens a pull request only on the owner's instruction naming the branch and commit (the October 26 rule).

For `94a201f`, the owner's general instructions ("Test, validate and deploy live", "including to github") were taken as the instruction to push and open. They named no branch or commit. For the 2026-11-03 workspace reorganization, the owner's "go fast and finish all phases, you have my full permission" was taken as the instruction to push, open and merge its two docs-only pull requests, which change no shipped byte and deploy nothing. When unsure, ask. This file grants no permission.

**Where the code is:**

| Path | What |
|---|---|
| `apps/fleetlab-city/hosted/` | the hosted site: the page transforms, with the artwork byte caps in `ARTWORK_GROUPS` (`site-transform.mjs`); the visitor shell (`visitor.mjs`), which imports the topic tiles' titles, questions, image names and lessons from `visitor-families.mjs`; the footer date (`integration.mjs`); the tile pins (`tile-assets.json`) |
| `apps/fleetlab-city/tile-media/` | the 19 tile images; their byte cap is repeated in `apps/fleetlab-city/tools/hosted-brand.py` and `apps/fleetlab-city/test/stepa-byte-bounds.test.mjs` |
| `playground/fleetlab/src/ui/` | the lesson catalog (`simulation-catalog.js`) and its "look for" lines (`teaching-frames.js`) |
| `apps/fleetlab-city/deploy/` | `build-release.py` (builds the release stage); `wrangler.mjs` and `stage-guard.mjs` (the locked upload wrapper the owner runs); `record-release.mjs` (the release receipt); `TOKEN_INPUT.md` |
| `apps/fleetlab-city/tools/` | `readback.py` and `check-headers.py` (byte and header readback of a deployment); `publication-guard.py` (the privacy hook) |
| `apps/fleetlab-city/test/` | the City Node suite; `stage-check.mjs` (the stage bounds); `network-flows-evidence.mjs`; `cdp-browser.mjs` (headless Chrome that resolves only 127.0.0.1) |
| `apps/fleetlab-city/tests/` | the City Python suite |
| `playground/fleetlab/`, `tools/fleetlab-traffic/` | the Playground app and the traffic tools, each with its Node suite |
| `docs/releases/fleetlab-current.json` | the public record of the live release |

**Local environment (on the owner's machine; none of it is in git).** Preserve all of it: a fresh clone can neither build the stage nor pass the local pytest gate without it.
- The release workbench `…/Hermes-worktrees/fleetlab-workbench` (detached on `main`; also reached as `…/Hermes-fleetlab`, a compatibility link) holds, in its ignored `build/fleetlab-city/`:
  - the official Node 22.23.4 toolchain (`toolchain/node-v22.23.4-darwin-arm64/bin`; put it first on `PATH`);
  - the City venv with CPython 3.11.15, SciPy and pyproj (`venv/`), which has no ruff or pytest;
  - the four local-only stage inputs (`delivery-order-20261013/preserved-legacy`, `validation/integration/baseline-readback.json`, `visitor-preview-20261014/city-explorer/releases/c56bda6b509105c5`, `source-offer-v8-temporal-final`).
- The 130 pytest fixtures are listed with their hashes in `…/Hermes-evidence/fleetlab-release-9dfc6bc/dist/coordinated-9dfc6bc/merged-9dfc6bc/fixtures-before.json`. The gates helper copies them from `…/Hermes-fleetlab/artifacts/` into the checkout under test.
- The `hermes-dev` conda env (CPython 3.11.15) runs ruff, pytest and `hermes doctor`. Call its own interpreter, because the City venv may come first on `PATH`. Set `PYTHONPATH=src` from the worktree under test.
- Google Chrome 156 runs the headless checks. `FLEETLAB_REQUIRE_CHROME=1` makes the browser tests fail instead of skipping.
- The agent release helpers used for `94a201f` have a working copy in `…/Hermes-fleetlab/dist/release-tools/`, with a README: gates, stage build and checks, proof package, preview and production checks. Two more sit beside it: the record derivation in `…/Hermes-fleetlab/dist/production-cdf2bd6e/` and the production phone helper in `…/Hermes-fleetlab/dist/merged-94a201f/browser/`. On 2026-11-03 the copy's paths were repointed to the layout below and the owner's account-ID guard test was rerun (`1` for the account, `0` or `shape-BAD` otherwise). The originals stay untouched as evidence in `…/Hermes-evidence/fleetlab-release-94a201f/dist/`.

  The helpers hard-code this machine's paths and several release values. Before reuse, replace the comparison identifiers:
  - `94a201f`;
  - `8d2c7ac`: the live comparison stage and the browser helpers;
  - `ad0396d`: the pre-merge comparison stage;
  - `9dfc6bc` as the gates' diff base.

  Keep the `9dfc6bc` fixture list: it is the only copy, and it is still valid. `stage-checks.sh` also hard-codes the stage-pins artwork expectation (41 records, 7,933,679 B); change it only if the artwork changes.

**Workspace layout, and why it stays this way (reorganization of 2026-11-03).** Every Hermes folder on the owner's machine sits directly in the GitHub folder (`…/`) with a `Hermes` prefix, so a sorted listing keeps them together.

| Folder | What it is | Rule |
|---|---|---|
| `…/Hermes` | The main checkout, on `main`. Every other checkout below is a linked worktree that shares its `.git`. `hermes-dev` loads MetaDrive from its `third_party/`. | Do not move it. Every worktree, the conda env, two symlinks, agent memory and open sessions use this path. |
| `…/Hermes-adas` | A linked worktree on `feat/phase8-lead-decelerates` (merged): the Phase 8 ADAS bench. Its ignored `artifacts/` holds the canonical ADAS bundles (§10), with `sandbox/` and a link into `…/Hermes/third_party`. | Keep it in place. Fold it into `…/Hermes-worktrees/adas` only when ADAS work restarts, updating §10 and §12 in the same change. |
| `…/Hermes-worktrees/` | Working checkouts. `fleetlab-workbench` is the FleetLab release bench: the toolchain, the City venv, the four stage inputs, the 130 fixtures and the release helpers' working copy. | New work goes in `<purpose>`, a release candidate in `release-<sha7>`. Remove a worktree after its merge; the branch stays on GitHub. |
| `…/Hermes-fleetlab` | A relative link to `Hermes-worktrees/fleetlab-workbench`. The owner's account-ID guard line, the release helpers, `hermes-dev`'s editable install and this file use this path. | Keep the link until all four point at the new path. |
| `…/Hermes-evidence/` | A plain folder of frozen evidence, never rebuilt in place: `fleetlab-release-94a201f` (live), `fleetlab-release-8d2c7ac` (rollback), `fleetlab-release-9dfc6bc` (the only fixture list) and `adas-wp7-acceptance`. | Never build or run `git clean` here. Move a worktree only with `git worktree move`. |
| `<archive drive>` | The owner's external drive `Hermes-Archive`: APFS, encrypted with the owner's password, unplugged when not in use. Its `Hermes-cold-archive-2026-11/` holds the superseded builds and older release evidence under their original names, for example `Hermes-stepb-stage/` and `Hermes-tile-bound/`. | Read only. To consult old evidence, connect and unlock the drive. Never rebuild there. |

Why these folders are not inside `…/Hermes`, the main checkout:
- **Git would see them.** Every nested folder would show as untracked, and `.gitignore` is byte-pinned, so a single `git add -A` or force-add could publish evidence or private files to this public repository.
- **A cleanup would delete them.** `git clean -fdx` in the main checkout deletes everything git ignores inside it.
- **Tools would walk into them.** pytest, ruff, editors and agent searches would walk about 130 GB, and pytest could collect or import a nested checkout's copy of `src/` and `tests/` instead of the one under test.

Git's own convention is to keep worktrees beside the main checkout, not inside it.

Why not one umbrella folder holding all of them: it means moving `…/Hermes`, which in turn means repairing every linked worktree, the conda env's MetaDrive install, two absolute symlinks, agent memory keyed on the path, the open sessions and the paths in this file. The only gain would be a shorter listing. The owner and Claude decided on 2026-11-03 to keep this layout.

Status of the reorganization. Its plan, tools and records are in the workbench's ignored `.superpowers/sdd/2026-11-02-workspace-reorganization/`:
- **Done:**
  - the docs regrouped into `docs/hermes/` and `docs/fleetlab/` (PRs #21 and #22);
  - both checkouts on `main`;
  - the release evidence moved into `…/Hermes-evidence/`;
  - merged worktrees parked or removed;
  - 30 merged branches deleted, with a restore list kept privately;
  - the workbench moved. A stage rebuilt at `94a201f` from the moved toolchain and inputs is byte-identical to the retained live stage.
  - Private material moved out of every working tree into a private archive outside the repositories. Its manifests record each file's hash; this file never lists them.
  - The owner's other Physical AI projects (not part of this repository) were grouped in `…/PhysicalAI/`, with compatibility links at two old paths.
- **Done 2026-11-06: the cold archive.** It holds 111.87 GB of superseded builds and older evidence (164 entries listed in `phase1/cold-set.tsv`).
  1. `phase1/archive_tool.py archive` copied it to `<archive drive>/Hermes-cold-archive-2026-11/`. All 164 entries matched when re-hashed on the drive: 724,406 files and 565 links.
  2. A separate `verify` re-hashed everything again, with 164 matches and 0 mismatched or missing.
  3. The owner then deleted the local copy and pruned git's worktree records. Free space went from about 8 GiB to 106 GiB.
  4. The manifests stay in the owner's private archive. The SHA-256 of the sorted, concatenated manifest set is `6815a7d939f4cc1eb21f5a3a3d32d82d2a7970b0693a3508f24b10ef65edc97a`.

  Every phase of the reorganization is now finished.
- **Building a stage:** set `--out` outside any folder Finder is showing. Finder's `.DS_Store` in the build's temporary folder failed two builds on 2026-11-03, once with "projected base release integrity mismatch" and once with "base viewer mutated".

**Gates, with their results at `94a201f`.** Run from a clean committed checkout, with the `hermes-dev` interpreter for the first three:
- `python -m ruff check .`: clean.
- `FLEET_PLAYGROUND_BASE=bca4ccd PYTHONPATH=src python -B -m pytest -q -p no:cacheprovider -m "not metadrive"`: 1,675 passed, 55 deselected, with the 130 fixtures in place. Without `FLEET_PLAYGROUND_BASE`, the boundary test R6 skips.
- `CONDA_DEFAULT_ENV=hermes-dev CONDA_PREFIX=<that env's prefix> PYTHONPATH=src python -m hermes doctor`: 18 PASS, 1 NOT_AVAILABLE. Without `PYTHONPATH=src`, doctor inspects the checkout that `hermes-dev`'s editable install points at (`…/Hermes-fleetlab`), not the one under test.
- `<City venv>/bin/python -B -m unittest discover -s apps/fleetlab-city/tests -q`: 375 OK.
- With `FLEETLAB_REQUIRE_CHROME=1`, `node --test --test-concurrency=1` on:
  - `playground/fleetlab/test/*.test.mjs`: 2,953 tests, 2,944 pass, 8 performance skips, 1 todo;
  - `apps/fleetlab-city/test/*.test.mjs`: 307/307;
  - `tools/fleetlab-traffic/test/*.test.mjs`: 14/14.
- `git diff --check 9dfc6bc HEAD`: clean. That is the base the helper used; a new run should diff against the then-live release.

The gates helper exports `PYTHONPATH`, `FLEET_PLAYGROUND_BASE` and `FLEETLAB_REQUIRE_CHROME` for every command, and the Conda variables for doctor only. CI (`.github/workflows/ci.yml`, on `macos-26`) runs ruff, pytest without the local fixtures, and the three Node suites; the City Node suite there includes some headless-Chrome tests. Only local runs cover the City Python suite, `hermes doctor`, the stage build, `stage-check.mjs`, the network-flows evidence and the release browser checks.

**The release path, as it ran for `94a201f`:**
1. Branch from `github/main`, build, and run the gates.
   - Ask the owner first whether the footer date changes. It is set in `integration.mjs`, inside the built stage, so any change belongs in the pull request.
   - If the change touches hosted bytes, also build a stage from the branch head and run `stage-check.mjs --mode after`, the lesson of the failed `5457181` stage.
2. Push and open the pull request on the owner's instruction (above). The owner sends `Merge #N at <sha7>`. Once both CI jobs pass, merge with `gh pr merge N --merge --match-head-commit <full sha>`: a merge commit, never squash, rebase, `--admin`, `--auto` or `--delete-branch`.
3. On a new detached worktree at the merge commit:
   - build the stage with `build-release.py`, the merge commit and the four inputs (October 26 action 3);
   - run the stage checks, the gates and the browser checks;
   - check the stage inventory against `stage/review/integration-manifest.json`;
   - write the proof package and a release sheet with the owner's upload steps.

   October 26 action 4, the design re-judge, was written for Step B. Neither `8d2c7ac` nor `94a201f` had one, and no rule says when a later change needs one: ask the owner.
4. Preview:
   - the owner uploads the stage to preview (`--branch codex-city-explorer`) and sends the `https://<8 hex>.fleetlab.pages.dev` address;
   - the agent runs the preview checks;
   - the owner checks the preview on their own phone (sheet section 4). With the owner's Pixel connected over USB, the agent can also run its device check.
5. Before production (sheet section 5):
   - the preview checks pass;
   - the owner reports on the phone check;
   - the owner sends a go-live message naming the full commit, project `fleetlab` and branch `feat/fleetlab-playground`;
   - the agent rechecks `main`, CI, the preview results and a clean worktree, then replies.

   For `94a201f` the recheck ran, and main CI needed two re-runs. No go-live message and no owner phone report came; the agent's device check was the only phone check. The only exact-commit step is the wrapper's production prompt, which no agent observed (Owner messages, below).
6. Production and record:
   - the owner uploads the same stage to production (`--branch feat/fleetlab-playground`), typing the commit's first 12 characters at the wrapper's prompt;
   - the agent runs the production checks and writes the receipt with `record-release.mjs`;
   - the agent derives `docs/releases/fleetlab-current.json`, smokes its 128 paths against the stable address, and updates this file;
   - an independent reviewer checks the record and this file against the evidence;
   - on the owner's instruction, the agent pushes the docs-only release-record branch and opens its pull request. The owner's merge message names its head.

**Owner-facing commands.** Give the owner shell steps for a new Terminal.app window running `/bin/zsh -f`:
- use untagged code blocks, one command per block, with no comments, and the expected output in prose;
- in the owner's interactive zsh, `/bin/zsh -f` included, `#` does not start a comment (`INTERACTIVE_COMMENTS` is off). A trailing `# …` becomes arguments to the command and can make a check pass falsely;
- each release worktree's `dist/<stage>/RELEASE-SHEET-<sha7>.md` holds that release's exact steps. The `94a201f` steps were given in chat, with an added account-ID guard.

**Known traps:**
- **CI capacity.** GitHub's macOS arm64 runners can be short. A job "not acquired by Runner" is cancelled with zero steps, and the desktop app may show it as skipped. It is not a pass: re-run it with `gh run rerun <id> --failed`.
- **Measuring.** Measure only from a committed, clean tree and a stage built for that commit (October 26 rules).
- **Staging.** Never `git add -A`; stage named paths. `…/Hermes-fleetlab` has untracked owner files. The publication guard hook exists only in this machine's shared `.git/hooks`. It rejects home-directory paths but not every local path, so check committed text yourself.
- **Browser and phone checks.** The release-tools README covers:
  - the hosted launcher copies;
  - why served bytes are hashed in Node;
  - where the footer-date helpers must sit.

  The phone helpers take an adb serial. Pass the Pixel's (`adb devices -l`), because an Android emulator may also be attached. The production helper drives only the foreground tab and closes it.

### This release: `94a201f`, production `cdf2bd6e`

- **Live:** https://fleetlab.pages.dev serves source `94a201f542c1592f8223735c0ac395e8df2bc0c7` (tree `0d0b49f`), the PR #18 merge commit on `main`. Production deployment `cdf2bd6e` (https://cdf2bd6e.fleetlab.pages.dev); preview `6329a252`.
  - **Readback:** full byte readback of 10,186 of 10,186 served files and 100 of 100 header checks, at the preview, the stable address and the immutable production address. Production was captured 2026-11-03 at 03:28 UTC (stable) and 03:30 UTC (immutable), still November 2 in Pacific time.
  - **Receipt:** [docs/releases/fleetlab-current.json](docs/releases/fleetlab-current.json). Its 128-path smoke subset, which includes all 19 tile files, matched the stable address 128/128 (2026-11-03, 03:34 UTC).
- **What changed for visitors since `8d2c7ac`:** four tile images on Explore, under "Choose a place to start.": Depot operations, Data movement, Paired experiments and Launch & recall now show the owner's new art, byte for byte (`T-07-depot-ops.webp`, `T-09-data-movement.webp`, `T-13-paired-experiments.webp`, `T-15-launch-recall.webp`). The images stay decorative, with empty alt text. Card text, lesson counts and layout are unchanged, and the footer still reads "Date: October 31st, 2026". Hosted artwork grows by 140,414 B to 7,933,679 B. The offline edition is unchanged: 2,568,066 B (`5f222820…`).
- **How the tiles got here:**
  - Codex had swapped the four tiles in `…/Hermes-fleetlab` and stopped for owner review. The swap was never committed, so no release build, which starts from a clean worktree at a `main` commit, could pick it up.
  - **PR #17** (`claude/fleetlab-tile-media-swap`, head `a658fa6`, merged as `5457181`) carries the four tiles byte for byte, `apps/fleetlab-city/hosted/tile-assets.json`, the artwork inventory pin (7,793,265 B to 7,933,679 B), and the tile-media cap re-based from 2,097,152 B to 2,130,908 B in three files: with the four new tiles, the 19-file tile group was 33,756 B over its 2 MiB cap. Codex's alt texts were dropped, so the images stay decorative.
  - The release stage built at `5457181` then failed one stage check: non-City bytes were 16,342,263 B against the Step A bound of 16,203,828 B. That check runs only on a built stage, not in CI, and it was not run on the PR #17 stage before the merge was asked for. Nothing was uploaded.
  - **PR #18** (`claude/fleetlab-tile-stage-bound`, head `ad0396d`, merged as `94a201f`) raises that bound by exactly the new art, +140,414 B, to 16,344,242 B. It changes two files: the stage-check runner `stage-check.mjs` and its test.
- **Release gate for `94a201f`, in the order each step started (UTC):**
  1. CI run `41397988313` passed both jobs on the PR #17 head `a658fa6` (2026-11-02, 06:21).
  2. PR #17 merged as `5457181`, with a merge commit, on the owner's "Merge #17 at a658fa6" (16:51). CI run `41485581972` passed both jobs on `5457181` on `main` (17:08).
  3. Release stage at `5457181`, on a clean detached worktree (`<archive drive>/Hermes-cold-archive-2026-11/Hermes-tile-release-5457181`), 16:53 to 16:59: stage check in `after` mode 19/20, failing only the non-City bound; every other stage and browser check passed. Not uploaded.
  4. CI run `41490239351` on the PR #18 head `ad0396d`: the first attempt got no macOS runner and ran no test; the re-run passed both jobs (18:54).
  5. PR #18 merged as `94a201f`, with a merge commit, on the owner's "Merge #18 at ad0396d" (19:02). Its parents are `5457181` and `ad0396d`, and its tree equals the PR head's.
  6. CI run `41506254698` on `94a201f` on `main`: Python passed (19:04). The FleetLab Node job got no macOS runner on attempts 1 and 2 and ran no step; attempt 3 passed all 12 steps (2026-11-03, 02:54).
  7. Checks at the merged commit, on a clean detached worktree (`…/Hermes-evidence/fleetlab-release-94a201f`), 2026-11-02, 19:03 to 19:18:
     - the stage built by `build-release.py` from the build inputs approved for `9dfc6bc`; `build-inputs.json` differs from `8d2c7ac`'s only in `source_commit`;
     - stage check in `after` mode 20/20; non-City bytes 16,342,265 B, 1,977 B under the bound;
     - the site files differ from the `ad0396d` candidate stage only in embedded commit identity. Against the `8d2c7ac` stage, 17 paths differ and 7 of them beyond commit identity: the four tiles, the source download, the City `release.json` and the teaching package. The total is +140,526 B, of which the tiles are +140,414 B;
     - the network-flows evidence (28 cells) makes the same requests as the `8d2c7ac` record. Apart from timing-dependent fields, only the commit identity, the stage path and the manifest and receipt digests differ. Four screenshots of animated pages differ in size, by 5 B to 3,241 B; screenshots of the same pages also differ between two runs on the same tree (`ad0396d` and `94a201f`);
     - every local gate green with the `8d2c7ac` counts, plus the footer date, catalog and tile checks in headless Chrome.
  8. Preview upload `6329a252` (owner), then the agent's preview checks (2026-11-03, 03:11 to 03:20): readback, headers, the hosted browser check, the footer date, the catalog, the tiles, and the owner's Pixel (03:12). Rechecks before production ran at 03:11 to 03:20: remote `main`, CI, the served identities, a clean worktree, and the stage re-hashed byte-identical.
  9. The production upload `cdf2bd6e` (owner), then the production checks (03:25 to 03:33): identity, both readbacks, both header checks, the hosted browser check, the footer date, the catalog, the tiles, the Pixel again, and the receipt from `apps/fleetlab-city/deploy/record-release.mjs` (03:33:45).
- **Checks at the preview and the stable address** (the immutable address had the identity probe, the readback and the header check only):
  - **Hosted browser check:** the Step B script, byte-identical across the last four releases: 23 cells at each. The production log is line for line the preview's, and no compared field differs from the `8d2c7ac` site checked the same way just before the upload. Chrome resolved only the site's own host. There were no exceptions, no security-policy violations from the site's own code and no overflow at those widths; the only console errors were 22 blocked-host lookups and one `/favicon.ico` 404.
  - **Footer date:** "Date: October 31st, 2026" with `datetime` `2026-10-31`, on Home and About & limits at 320, 390, 768 and 1280 px (8 cells at each); minimum contrast 5.416:1.
  - **Catalog:** "61 of 61" with 61 visible lines at the same four widths, the 25 November 1 lines present, no overflow and no page errors.
  - **Tiles:** at the same four widths, compared with the `8d2c7ac` stage served locally: the nine family tiles load at 1600×1600 and are decorative; the four new ones serve the new bytes and the other five are unchanged; every one of the 19 tile files the host serves equals its pin in `tile-assets.json`; card geometry, chrome, text and the lesson counts (8, 3, 5 and 10) are unchanged; no overflow and no exceptions.
  - **Physical phone:** on the preview and on production, the agent drove one Chrome tab on the owner's USB-connected Pixel: the footer date in view and not covered on both pages, the nine tiles loaded and decorative with every served file equal to its pin, and the four lesson counts. There were no exceptions, security-policy violations or failed site requests. The phone used the real network, so analytics was not blocked. The production run closed its tab. This was agent-operated, not the owner's own look, and is not qualification.
- **Owner messages and the go-live rule:** the permission rule in the October 26 section asks for the owner's own go-live message naming the exact merged commit. For `94a201f`, in order:
  - the request: "one other thing, i previously asked Codex to help update the website image, can you please look into the current state as why it did not get pick up? Test, validate and deploy live.";
  - answers to the agent's questions: "Raise cap, exact art", "Leave images decorative" and "Keep October 31st";
  - "Turn on Auto-fix" for PR #17; "merge, and, is the updated media images deployed on the live site?", which named no commit, so nothing was merged; then "Merge #17 at a658fa6";
  - "Raise by the art only"; "Turn on Auto-fix" for PR #18; "lets deploy to live site", which named no commit; then "Merge #18 at ad0396d";
  - "list out cli steps so i can procee"; the preview address with "test, validate and deploy live (including to github)"; "whats the cli command?"; and the production address.

  No message names a merged commit as the go-live. The only step where the owner types the commit is the wrapper's production prompt, which prints the full commit and requires its first 12 characters, `94a201f542c1`. No agent observed the owner's Terminal, so that step is not independently confirmed. This is recorded as it happened; no go-live line is invented. "including to github" is the instruction for this record's branch and pull request.
- **Publishing:** as on November 1, with one added guard. The steps given to the owner (release sheet section 2, plus an account-ID guard after its step 10) route both uploads through the locked wrapper `apps/fleetlab-city/deploy/wrangler.mjs`, run by the owner in their own Terminal. The procedure reads the token at a hidden prompt and passes it to the wrapper for that one command, and the guard checks the typed account ID against the October 23 owner helper before the upload line. No agent observed the owner's Terminal, and no credential passed through an agent session. The full receipt and the readback, header, browser, tile and phone observation files are kept privately with the release evidence; the committed record binds their hashes.
- **Rollback:** an owner-operated Cloudflare Pages rollback to `9e85c9cc` (source `8d2c7ac`), which restores the November 1 site with the previous four tile images. Not rehearsed. Its checked package is retained untouched in `…/Hermes-evidence/fleetlab-release-8d2c7ac`.
- **Not done or open:**
  - **Stage check before the merge ask.** The stage check that failed at `5457181` runs only on a built stage, and CI does not build one. For any change to hosted bytes, build a stage from the pull request head and run `stage-check.mjs --mode after` before asking for the merge message, or add that step to CI.
  - **CI capacity.** GitHub's macOS arm64 runners were short: four jobs (three FleetLab Node, one Python 3.11) were cancelled without running a step and passed on re-run with no code change. A cancelled job is not a pass; re-run it.
  - **`…/Hermes-fleetlab` leftovers.** Its five uncommitted tracked changes are Codex's swap: the four tile images, now identical to the shipped bytes, and alt texts in `apps/fleetlab-city/hosted/visitor.mjs`, which were not shipped. The four `_backup_2026-10-31` files and the four `tile-candidate-*.webp` originals are untracked. Leave them until the owner decides.
  - **Go-live wording and uploader audit.** As on November 1: the owner's messages named no commit, and the wrapper install output was not captured, so the uploader audit is not reconfirmed.
  - **Carried from November 1:** the residuals (the fixed "Pause visual motion" control, R1, the first future move; the accepted Depot 320 px layout exception), Delivery PARTIAL (R13), the repeated Limits on Lessons 15 and 16, and the items still open from October 27.

### Handoff: where we are now, for Codex (builder) and Muse (design review)

Codex builds. Muse reviews design and words, and drafts proposals. The owner decides, gives every go-ahead and publishes. The rules and the later-scope limits in the October 26 section still bind. Its actions 2 to 7 and its failure paths were written for the Step B release. For any later release, follow them with these substitutions:
- the new pull request in place of PR #11;
- the then-current `main` head in place of `f043995` as the first merge parent;
- `94a201f` in place of `a1b79cd` as the live source;
- Pages deployment `cdf2bd6e` (source `94a201f`) in place of `72e45e9f` as the rollback target;
- a new clean detached worktree at each candidate, with its stage in its ignored `dist/`, as action 3's `<wt>` and in place of the Measuring rule's `<archive drive>/Hermes-cold-archive-2026-11/Hermes-stepb-stage/dist/stepb-<sha7>/`, as `…/Hermes-evidence/fleetlab-release-94a201f` was for this release. Never check out another commit in `…/Hermes-evidence/fleetlab-release-94a201f`, `<archive drive>/Hermes-cold-archive-2026-11/Hermes-tile-release-5457181`, `…/Hermes-evidence/fleetlab-release-8d2c7ac`, `…/Hermes-evidence/fleetlab-release-9dfc6bc` or `<archive drive>/Hermes-cold-archive-2026-11/Hermes-stepb-stage`;
- before freezing the stage, set the footer date (step 4 of the release procedure in [docs/fleetlab/publishing/FLEETLAB_CLOUDFLARE_DEPLOYMENT.md](docs/fleetlab/publishing/FLEETLAB_CLOUDFLARE_DEPLOYMENT.md));
- for a change to hosted bytes, build a stage from the pull request head and run `stage-check.mjs --mode after` before asking for the merge message.

| What | State |
|---|---|
| Live site | `94a201f`, production `cdf2bd6e` (above) |
| `main` | `40eebed`, the PR #19 merge (2026-11-03, 04:02:51 UTC). Main CI run `41575771029` passed both jobs on it (FleetLab Node at 04:17:23 UTC) |
| Release record | Branch `claude/fleetlab-release-record-94a201f` (worktree `…/Hermes-release-94a201f`), merged as PR #19 with a merge commit; the branch is kept. It holds this file's release updates and `docs/releases/fleetlab-current.json`. The updates are this section, the superseded banners on the November 1, October 27 and October 26 sections, the Checkouts, Remote, Playground and Last updated rows, and §7.5 |
| Release evidence | Ignored and local, in `…/Hermes-evidence/fleetlab-release-94a201f/dist/`: the stage, the release sheet, the proof package and the preview and production reports (`tiles-94a201f/`); the merged-commit checks (`merged-94a201f/`); the preview checks (`preview-6329a252/`); and the production checks, the full receipt and the record's derivation script (`production-cdf2bd6e/`). The record's `stable_smoke_sha256` binds `prod-smoke128.json` there. The network-flows evidence is in the same worktree's ignored `build/fleetlab-city/validation/network-flows-94a201f/`. The failed `5457181` stage is in `<archive drive>/Hermes-cold-archive-2026-11/Hermes-tile-release-5457181/dist/`. Keep all of these untouched, with the November 1 list: `…/Hermes-evidence/fleetlab-release-94a201f` is the checked package behind `cdf2bd6e`, and `…/Hermes-evidence/fleetlab-release-8d2c7ac` is the one behind the rollback target `9e85c9cc` |

**Next actions, in order:**

| # | Action | Who |
|---|---|---|
| 1 | Done. The release-record branch was pushed and opened as PR #19 on the owner's "including to github", which named neither the branch nor the commit. The owner sent "Merge #19 at 69e58b7". Asked whether to merge before the PR's FleetLab Node job finished, the owner answered "Merge now". It merged as `40eebed`, with a merge commit, at 04:02:51 UTC. The PR run then passed both jobs on the same tree (Node at 04:09:40 UTC), and main CI on `40eebed` passed both | Owner's word at each step; the agent pushed, opened and merged |
| 2 | Decide what happens to the `…/Hermes-fleetlab` leftovers (above), then rule on the open October 27 re-inspection condition before any Scope 2 or Scope 3 work, and choose the next item. The candidates are the November 1 list, plus a CI step that builds the stage and runs the stage check | Owner |
| 3 | Build the chosen item on a new branch from `github/main`, with the gates, stage check and evidence the October 26 section names. Push or open a pull request only on the owner's instruction naming the branch and commit | Codex, or the agent the owner names |

## November 1, 2026 — FleetLab release `8d2c7ac` live, production `9e85c9cc`; the October 31 release `9dfc6bc` recorded

**Superseded by the November 2 section above; kept as the record of the `9dfc6bc` and `8d2c7ac` releases. Its handoff table and next actions are historical, and the November 2 handoff replaces them.**

- **Live:** https://fleetlab.pages.dev serves source `8d2c7ac6c78768676d78cb07a566548f645f30e1` (tree `e0f4cc7`), the PR #15 merge commit on `main`. Production deployment `9e85c9cc` (https://9e85c9cc.fleetlab.pages.dev); preview `f3918869`.
  - **Readback:** full byte readback of 10,186 of 10,186 served files and 100 of 100 header checks, at the preview, the stable address and the immutable production address. Production was captured 2026-11-01 at 19:39 UTC (stable) and 19:41 UTC (immutable).
  - **Receipt:** [docs/releases/fleetlab-current.json](docs/releases/fleetlab-current.json). Its 128-path smoke subset matched the stable address 128/128 (2026-11-02, 03:13 UTC).
- **What changed for visitors since `848b420`:** two releases.
  - **October 31, `9dfc6bc` (production `c743621d`):** PR #13 and PR #14.
    - Disabled secondary lesson controls have their own softened outline; primary controls keep theirs.
    - Corrected copy for the existing 61 lessons: 69 approved fields, 66 of them in 28 lessons (including the OPS-02 situation) and three in the glossary, which gains entries 21 "Encoded units" and 22 "Decision, condition test". Nine Fleet day frames inherit the corrected Limits.
    - A site date in the shared footer on Home and About & limits, "Date: October 30th, 2026".
  - **November 1, `8d2c7ac` (production `9e85c9cc`):** PR #15.
    - 25 catalog "look for" lines now say concretely what to compare, and the launch page carries the same line as Lesson 20.
    - The footer date reads "Date: October 31st, 2026". The owner chose to keep this spelling.

  No media was added. A2 and the held Fleet day film are untouched, and SF qualification stays HOLD. The offline edition was re-pinned twice, each time on the owner's approval and with zero allowance: 2,566,962 B (`e49c0aba…`) with the corrected copy, then 2,568,066 B (`5f222820…`) with the catalog lines. The other re-pinned bounds are in the PR #13 and PR #15 descriptions.
- **Release gate for `8d2c7ac`, in the order it ran (2026-11-01, UTC):**
  1. CI run `41274962791` passed both jobs on the PR #15 head `ce03966` (05:06).
  2. PR #15 merged as `8d2c7ac`, with a merge commit, on the owner's "Merge #15 at ce03966" (14:42). Its parents are `9dfc6bc` and `ce03966`, and its tree equals the PR head's.
  3. CI run `41317495084` passed both jobs on `8d2c7ac` on `main` (14:57).
  4. Checks at the merged commit, on a clean detached worktree (`…/Hermes-evidence/fleetlab-release-8d2c7ac`):
     - the stage built by `build-release.py` from the build inputs approved for `9dfc6bc`;
     - stage check in `after` mode 20/20;
     - the site files differ from the `ce03966` candidate stage only in embedded commit identity, and from the `9dfc6bc` stage by +2,554 B, all in the intended files;
     - the network-flows evidence (28 cells) differs from the `9dfc6bc` record only in timing-dependent fields;
     - every local gate green, plus the footer date and catalog checks in headless Chrome.
  5. Preview upload `f3918869` (owner), then the agent's preview checks (15:26 to 15:34): readback, headers, the hosted browser check, the footer date and the catalog.
  6. A physical-phone check of the preview: at the owner's request, the agent drove one Chrome tab on the owner's USB-connected Pixel. The first run (18:30 to 18:31) recorded the same results, then stopped on a helper bug, a reused screenshot name; the rerun (18:31 to 18:32) passed. Rechecks before production ran alongside (18:30 to 18:33) and again at 18:50: remote `main`, CI, the served identities, a clean worktree, and the stage re-hashed byte-identical.
  7. The production upload `9e85c9cc` (owner), then the production checks (19:36 to 19:47): identity, both readbacks, both header checks, the hosted browser check, the footer date, the catalog, the Pixel again, and the receipt from `apps/fleetlab-city/deploy/record-release.mjs` (19:46:48).
- **Checks at the preview and the stable address** (the immutable address had the identity probe, the readback and the header check only):
  - **Hosted browser check:** the Step B script, byte-identical across the last three releases: 11 pages at 390 and 1280 px, plus `/publication.json` at 1280 only (23 cells at each). The production log is line for line the preview's, and no compared field differs from the `9dfc6bc` site checked the same way before the upload. Chrome resolved only the site's own host. There were no exceptions, no security-policy violations from the site's own code and no overflow at those widths; the only console errors were 22 blocked-host lookups and one `/favicon.ico` 404.
  - **Footer date:** "Date: October 31st, 2026" with `datetime` `2026-10-31`, on Home and About & limits at 320, 390, 768 and 1280 px (8 cells at each); minimum contrast 5.416:1.
  - **Catalog:** "61 of 61" with 61 visible lines at the same four widths, all 25 new lines present and none of the replaced lines left, with no overflow and no page errors.
  - **Physical phone:** on the preview and on production, the footer date was in view and not covered on both pages, and the catalog showed 61 of 61 with all 25 lines. There were no exceptions, security-policy violations or failed site requests. The phone used the real network, so the analytics script was not blocked. This was agent-operated, not the owner's own look, and is not qualification.
- **Owner messages and the go-live rule:** the permission rule in the October 26 section asks for the owner's own go-live message naming the exact merged commit.
  - For `8d2c7ac`, in order: "test, validate and commit to repo, deploy live"; "Merge #15 at ce03966", the merge instruction, which names the pull request head; "connected to pixel, test, validate and deploy live, lets make sure the Date states: Oct 31, 2026"; "October 31st, 2026", keeping the spelling; "yes full guidance"; and "test and validate: https://9e85c9cc.fleetlab.pages.dev".
  - For `9dfc6bc`: "proceed with production deploy".
  - No message names a merged commit as the go-live. The procedure's only exact-commit step is the wrapper's production prompt, which prints the full commit and requires its first 12 characters. No agent observed the owner's Terminal, so that step is not independently confirmed. This is recorded as it happened; no go-live line is invented.
- **Publishing:** the release sheets route every upload through the locked wrapper `apps/fleetlab-city/deploy/wrangler.mjs`, run by the owner in their own Terminal. The procedure reads the token at a hidden prompt and passes it to the wrapper for that one command; for production, the wrapper prints the full commit and requires its first 12 characters. No agent observed the owner's Terminal, and no credential passed through an agent session. The full receipt and the readback, header, browser and phone observation files are kept privately with the release evidence; the committed record binds their hashes.
- **Rollback:** an owner-operated Cloudflare Pages rollback to `c743621d` (source `9dfc6bc`), which restores the October 31 site: the corrected copy and the "October 30th, 2026" date, without the catalog lines. Not rehearsed. The checked package for that release is retained untouched in `…/Hermes-evidence/fleetlab-release-9dfc6bc`.
- **The October 31 release, `9dfc6bc` (production `c743621d`):**
  - PR #13 merged as `78af8f1` (2026-10-30, 18:27 UTC). Its preview `c4698a05` passed its checks (2026-10-31, 05:15 UTC). The release was then re-cut to add the site date: PR #14 merged as `9dfc6bc` (05:51), and CI passed on `main` for both merges (`41107148373`, `41174228132`).
  - Preview `7f6c4328`: 10,186 of 10,186 files and 100 of 100 headers (18:04 to 18:06), 23 of 23 hosted browser cells, the footer date at 8 of 8 cells. The first footer run reached no page, because the repository's local-only launcher allows only 127.0.0.1; an evidence-only copy whose only change allows the preview host instead of 127.0.0.1 passed. The owner delegated the phone check ("pixel is connected, you check"), and the agent ran it on the owner's Pixel.
  - Uploads: from terminal output the owner pasted, two production attempts were refused by the wrapper's token guard before any upload, and one more preview, `472c87c2`, was uploaded and not read back. The checked preview stayed `7f6c4328`.
  - Production `c743621d`: 10,186 of 10,186 files and 100 of 100 headers at the stable and the immutable address (19:57 to 20:00), and 23 of 23 hosted browser cells with no difference from the preview. The receipt is dated 20:00 UTC. A first identity request from a generic client got a 403; the committed readback client then passed in full, and the cause was not established.
  - Its rollback target was `ac431ba3` (source `848b420`). Its full receipt and evidence stay in `…/Hermes-evidence/fleetlab-release-9dfc6bc` (`dist/coordinated-9dfc6bc/` and `build/fleetlab-city/validation/network-flows-9dfc6bc/`), and its upload records in `…/Hermes-fleetlab/dist/coordinated-date-publication-20261030/`. The committed record now describes `8d2c7ac`, so `9dfc6bc` has no committed receipt of its own.
- **Not done or open:**
  - **Go-live wording.** For both releases the owner's chat messages named no commit (above). The owner may restate the rule, or confirm the wrapper prompt as the exact-commit step.
  - **Uploader audit.** For `9dfc6bc` the owner pasted the install notice: 2 moderate and 1 high, the counts of the October 23 audit; the advisories were not re-identified. For `8d2c7ac` the install output was not captured, so the audit is not reconfirmed.
  - **Residuals.** The fixed "Pause visual motion" control overlaps content at all four checked widths, including the end of the analytics line at phone widths (R1, the first future move). The accepted Depot 320 px layout exception and the other accepted residuals are in [the coordinated handoff](docs/fleetlab/handoffs/FLEETLAB_COORDINATED_C2_HANDOFF_2026-10-30.md), §10.
  - **Delivery PARTIAL.** `specification.notation` and the fleet-intake power and ports controls remain stopped (R13).
  - **Repeated Limits.** On the Fleet day page, Lessons 15 and 16 show their Limits twice: Lesson 15 in its lesson frame and in the always-on Staffing panel, Lesson 16 in its lesson frame and in the default charging panel. This was found during the catalog wave by reading the code and a simulated render, not yet in a browser, and is not fixed.
  - **Still open from October 27.** FL-A4 priority below 768 px and the hero shimmer. Whether the Step B release gate meets the October 26 condition that Scope 2 starts, and Scope 3 commissions anything, only after the Scope 1 re-inspection at the merged commit passes. `main` has no branch protection, and the City Python suite is outside CI.

### Handoff: where we are now, for Codex (builder) and Muse (design review)

Codex builds. Muse reviews design and words, and drafts proposals. The owner decides, gives every go-ahead and publishes. The rules and the later-scope limits in the October 26 section still bind. Its actions 2 to 7 and its failure paths were written for the Step B release. For any later release, follow them with these substitutions:
- the new pull request in place of PR #11;
- the then-current `main` head in place of `f043995` as the first merge parent;
- `8d2c7ac` in place of `a1b79cd` as the live source;
- Pages deployment `9e85c9cc` (source `8d2c7ac`) in place of `72e45e9f` as the rollback target;
- a new clean detached worktree at each candidate, with its stage in its ignored `dist/`, as action 3's `<wt>` and in place of the Measuring rule's `<archive drive>/Hermes-cold-archive-2026-11/Hermes-stepb-stage/dist/stepb-<sha7>/`, as `…/Hermes-evidence/fleetlab-release-8d2c7ac` was for this release. Never check out another commit in `…/Hermes-evidence/fleetlab-release-8d2c7ac`, `…/Hermes-evidence/fleetlab-release-9dfc6bc` or `<archive drive>/Hermes-cold-archive-2026-11/Hermes-stepb-stage`;
- before freezing the stage, set the footer date (step 4 of the release procedure in [docs/fleetlab/publishing/FLEETLAB_CLOUDFLARE_DEPLOYMENT.md](docs/fleetlab/publishing/FLEETLAB_CLOUDFLARE_DEPLOYMENT.md)).

| What | State |
|---|---|
| Live site | `8d2c7ac`, production `9e85c9cc` (above) |
| `main` | `8d2c7ac` until the release-record pull request merges |
| Release record | Branch `claude/fleetlab-release-record-8d2c7ac` (worktree `…/Hermes-release-8d2c7ac`). It holds this file's release updates and `docs/releases/fleetlab-current.json`. The updates are this section, the superseded banners on the October 27 and October 26 sections, the Checkouts, Remote, Playground and Last updated rows, and §7.5. It reaches `main` by pull request with a merge commit |
| Release evidence | Ignored and local. For `8d2c7ac`, in `…/Hermes-evidence/fleetlab-release-8d2c7ac/dist/`: the stage, the release sheet and the reports (`catalog-8d2c7ac/`); the merged-commit checks (`merged-8d2c7ac/`); the preview checks (`preview-f3918869/`); and the production checks, the full receipt and the record's derivation script (`production-9e85c9cc/`). The record's `stable_smoke_sha256` binds `prod-smoke128.json` there (03:13:21Z); `prod-smoke128-final.json` is a 128/128 re-run against this record file (03:18:44Z), kept but not bound. The network-flows evidence is in the same worktree's ignored `build/fleetlab-city/validation/network-flows-8d2c7ac/`. The `ce03966` candidate stage behind the commit-identity comparison was a session copy and is not retained. For `9dfc6bc`, in `…/Hermes-evidence/fleetlab-release-9dfc6bc/dist/coordinated-9dfc6bc/` and that worktree's ignored `build/fleetlab-city/validation/network-flows-9dfc6bc/`. `…/Hermes-fleetlab/dist/coordinated-date-publication-20261030/` holds the `9dfc6bc` upload records and publication report, and the stage-pins helper that the `8d2c7ac` checks also ran. Keep all of these untouched: the two release worktrees are the checked packages behind `9e85c9cc` and the rollback target `c743621d` |

**Next actions, in order:**

| # | Action | Who |
|---|---|---|
| 1 | Push this branch and open its pull request into `main`. The instruction for both is the owner's "Yes, prepare it", given in reply to the question whether to prepare this branch and pull request; it names neither the branch nor the commit, which did not exist yet. Then merge it with a merge commit, never squash or rebase, on the owner's message naming its head commit | Owner's word at each step; the agent pushes, opens and merges |
| 2 | Rule on the open October 27 re-inspection condition before any Scope 2 or Scope 3 work, then choose the next item. Candidates: the pause-control overlap (R1, the accepted first future move); the hosted Staffing panel at 768 px (R3, the second); the repeated Limits on Lessons 15 and 16; network-flows Scope 2 steps 2 to 8 and 10 (R17; step 9, D1, waits for its pin ruling); the two stopped source items (R13); FL-A4 below 768 px and the shimmer. Also decide whether to require the CI checks on `main` | Owner |
| 3 | Build the chosen item on a new branch from `github/main`, with the gates, stage check and evidence the October 26 section names. Push or open a pull request only on the owner's instruction naming the branch and commit | Codex, or the agent the owner names |

## October 27, 2026 — Network-flows Step B live: release `848b420`, production `ac431ba3`

**Superseded by the November 1 and November 2 sections above; kept as the record of the Step B release. Its handoff table and next actions are historical, and the November 2 handoff replaces them.**

- **Live:** https://fleetlab.pages.dev serves source `848b42007e88d2d71debff7fbc31d415df88753c` (tree `752b5a1`), the PR #11 merge commit on `main`. Production deployment `ac431ba3` (https://ac431ba3.fleetlab.pages.dev); preview `8b0b7954`.
  - **Readback:** full byte readback of 10,186 of 10,186 served files and 100 of 100 header checks, at the preview, the stable address and the immutable production address. Production was captured 2026-10-27 at 18:39 UTC.
  - **Receipt:** [docs/releases/fleetlab-current.json](docs/releases/fleetlab-current.json). Its 128-path smoke subset matched the stable address 128/128.
- **What changed for visitors:** network-flows Step B (the October 26 section).
  - A text-only Dispatch hero.
  - Explore ordered 01 to 05.
  - A tinted Capacity hero, with no D-01 decoy and FL-A4 prioritised from 768 px.
  - The global pause reaching the Rebalancing lesson video.
  - One lesson sequence: "LESSON n OF 5", Next and Previous, and the hub Compare lines.
  - One disabled and loading language.
  - Honest Delivery Order states.

  No media was added. A2 and the held Fleet day film are untouched, the offline edition is unchanged (2,565,111 B, `313fa3f1…`), and SF qualification stays HOLD.
- **Release gate, in the order it ran (2026-10-27, UTC):**
  1. CI run `40541049111` passed both jobs on the PR #11 head `031a27b` (16:45).
  2. A fresh six-judge design verdict finished before the merge (17:05).
     - Five judges served the built `1ede8e4` stage locally. The phone craft judge served the same pages, styles and scripts through the `031a27b` tree's hosted-site fixture, under the root CSP only. `1ede8e4` and `031a27b` differ only in `HERMES_SOURCE_OF_TRUTH.md`.
     - Craft (desktop and phone), comprehension, honesty in words and the W4 to W7 verifier are PASS_WITH_RESIDUALS, and re-inspection is PASS. The verifier found no defect in W4 to W7 themselves. There are 0 blockers.
     - This was not a re-judge of the merged candidate, as the October 26 action 4 describes. Step 4's site-file comparison shows the released site files differ from the judged stage only in embedded commit identity.
  3. PR #11 merged as `848b420`, with a merge commit, on the owner's instruction (17:05).
  4. Checks at the merged commit, on a clean detached worktree:
     - the merge's parents are `f043995` and `031a27b`, and its tree equals the PR head tree;
     - the site files differ from the `1ede8e4` stage only in the commit and tree hashes and the values derived from them: `_headers`, `publication.json`, the six `release.json` files, the teaching package, the source offer, and the City Explorer page, release folder and switch module named by the release hash (the retained `merged-848b420/site-diff.txt`);
     - stage check in `after` mode 20/20, with byte figures equal to `1ede8e4` except the compressed offer (1,149,116 B) and non-City (16,193,499 B), each +1 B, the gzip commit-hash variance recorded in Step A;
     - browser evidence matching the plan;
     - viewport test 2/2 with Chrome required;
     - every local gate green.
  5. The proof package was built (17:13), then CI run `40547320136` passed both jobs on `848b420` on `main` (17:24).
  6. Preview upload `8b0b7954` (owner), then the preview readback (18:24). The owner then reported the physical-phone check on the preview as passed.
  7. The owner's go-ahead naming `848b420`, the production upload `ac431ba3` (owner), then the production readback (18:39 stable, 18:41 immutable).
- **Hosted browser check:** headless Chrome under the served headers, at the preview (finished 18:22, before the preview readback) and in production (finished 18:38, before the production readback): 11 pages at 390 and 1280 px, plus `/publication.json` at 1280 only (23 cells per host). Chrome resolved only the site's own host, so the analytics script never loaded and was not exercised under the security policy.
  - No script exceptions, no security-policy violations from the site's own code, no overflow at those widths, and the same results on both hosts. The only console errors were 22 blocked-host lookups and one `/favicon.ico` 404 per host.
  - Against the stable host checked the same way at 18:24, before the owner's phone check and go-ahead (the pre-Step B site, `a1b79cd` per the October 24 record; that check records no commit), the only differences were the intended Step B changes: lesson labels, hub Compare lines, the Capacity FL-A4 priority and D-01 decoy, and the Rebalancing pause.
- **Publishing:**
  - The owner ran both uploads in their own Terminal through the locked wrapper `apps/fleetlab-city/deploy/wrangler.mjs`, with a token injected from Keychain, and typed the production confirmation.
  - No credential passed through an agent session.
  - The full receipt and the readback, header and browser observation files are kept privately with the release evidence; the committed record binds their hashes. The phone check left no observation file.
- **Rollback:** an owner-operated Cloudflare Pages rollback to `72e45e9f` (source `a1b79cd`), which restores the October 24 site without Step B. Not rehearsed. The checked package for that release is retained untouched in `<archive drive>/Hermes-cold-archive-2026-11/Hermes-depot-lab-review-a1b79cd`.
- **Not done or open:**
  - **Owner confirmations.** The eight PR #11 owner confirmations were not answered one by one before the merge, so the release ships them as built. The two real choices, FL-A4 priority below 768 px and the shimmer on three heroes, remain open for Scope 2.
  - **Uploader audit.** It was not reconfirmed for this release, because the wrapper's install output was not captured.
  - **CI and protection.** `main` has no branch protection, and the City Python suite is outside CI.

### Handoff: where we are now, for Codex (builder) and Muse (design review)

Codex builds. Muse reviews design and words, and drafts proposals. The owner decides, gives every go-ahead and publishes. The rules and the later-scope limits in the October 26 section below still bind. Its actions 2 to 7 and its failure paths were written for the Step B release. For any later release, follow them with these substitutions:
- the new pull request in place of PR #11;
- the then-current `main` head in place of `f043995` as the first merge parent;
- `848b420` in place of `a1b79cd` as the live source;
- Pages deployment `ac431ba3` (source `848b420`) in place of `72e45e9f` as the rollback target;
- a new clean detached worktree at each candidate (for example `…/Hermes-scope2-stage`, with stages in its ignored `dist/<name>-<sha7>/`) as action 3's `<wt>`, and in place of the Measuring rule's `<archive drive>/Hermes-cold-archive-2026-11/Hermes-stepb-stage/dist/stepb-<sha7>/`. Never check out another commit in `<archive drive>/Hermes-cold-archive-2026-11/Hermes-stepb-stage`, which stays at `848b420`.

| What | State |
|---|---|
| Live site | `848b420`, production `ac431ba3` (above) |
| `main` | `848b420` until the release-record pull request merges |
| Release record | Branch `codex/fleetlab-release-record-848b420` (worktree `…/Hermes-release-848b420`): this file's release updates (this section, the superseded banners on the October 26 and October 25 sections, the Checkouts, Remote, Playground and Last updated rows, and §7.5), `docs/releases/fleetlab-current.json`, and the "Release-gate verdict, 2026-10-27" list at the end of Step B plan §5. It reaches `main` by pull request with a merge commit |
| Release evidence | Ignored and local, in `<archive drive>/Hermes-cold-archive-2026-11/Hermes-stepb-stage/dist/stepb-848b420/`: the proof package, the release sheet, the full production receipt, the readback and header files (the record's `stable_smoke_sha256` binds `prod-smoke128.json`, captured 18:42:45Z; `prod-smoke128-final.json` is a later 128/128 re-run at 18:55:19Z, kept but not bound), the three browser observations (preview, production, and the `a1b79cd` site before production), the merged-commit gate output (`merged-848b420/`; its browser evidence, `evidence.json` with SHA-256 `39aca3ea…` bound by the proof package and its screenshots, is in the same worktree's ignored `build/fleetlab-city/validation/network-flows-848b420/`), the design verdict (`merge-verdict.json` and its captures) and the record's derivation script, beside the released stage. The proof package names the session copy of the stage check; the retained copy is `merged-848b420/stage-after.json`. Keep that worktree untouched at `848b420`; it is the checked package behind any future rollback to `ac431ba3` |

**Next actions, in order:**

| # | Action | Who |
|---|---|---|
| 1 | Push `codex/fleetlab-release-record-848b420`, open its pull request into `main`, and merge it with a merge commit, never squash or rebase. Push, open and merge each wait for the owner's instruction naming the branch and commit | Owner's word at each step; Codex pushes, opens and merges |
| 2 | Decide the two open Step B choices (FL-A4 priority below 768 px; the hero shimmer); whether to require the CI checks on `main`; and whether to fix the C6 disabled fill on secondary controls now, as a CSS-only Scope 1 follow-up the desktop craft judge recommended, or in Scope 2. Also rule whether the release gate meets the October 26 condition that Scope 2 starts, and Scope 3 commissions anything, only after the Scope 1 re-inspection at the merged commit (its actions 3 and 4) passes, or whether a re-inspection and re-judge at `848b420` come first. The gate to rule on is the `1ede8e4` verdict, re-inspection included, in step 2, and the checks at `848b420` in step 4. Actions 3 to 5 wait for that ruling | Owner |
| 3 | Draft the Scope 2 proposal. The 16:9 hero template comes first, and the proposal also covers the residuals in Step B plan §5, including its "Release-gate verdict, 2026-10-27" list. No new media | Muse |
| 4 | Approve the Scope 2 proposal, item by item | Owner |
| 5 | Build Scope 2 on a new branch from `github/main`, inside the Step A bounds, with the same gates, stage check, evidence and design verdict as Step B. Push or open a pull request only on the owner's instruction. Build each stage in a new worktree, as the substitutions above say | Codex |

Scope 3 (media and re-renders) stays gated as the October 26 section says, and its Scope 1 re-inspection condition waits for the action 2 ruling.

## October 26, 2026 — Network-flows redesign: Step A merged; Step B open as PR #11, not merged and not live

**Superseded for status and next actions by the October 27 section above (Step B live as `848b420`), and now by the November 2 section at the top. The rules, the later scopes and the Step B record below still apply. The tables of state and next actions, and the failure paths, are the October 26 record; reuse them for a later release with the substitutions the November 2 handoff lists.**

### Handoff: where we are, for Codex (builder) and Muse (design review)

Codex builds. Muse reviews design and words, and drafts proposals. The owner decides, gives every go-ahead and publishes. Read this block first, then the Step B record below it, then [PR #11](https://github.com/bohueilin/Hermes/pull/11), whose description holds the full byte tables, the per-commit bytes, the verdict table and the owner confirmations. Where the description and the Step B record disagree, the record wins. The description's depot overflow, once 351 AFTER, was corrected to the `1ede8e4` reading of 355 on the owner's instruction.

**Where this file lives.** Until PR #11 merges, this section, the Step B plan and all Step B code exist only on `codex/fleetlab-network-flows-step-b` (worktree `<archive drive>/Hermes-cold-archive-2026-11/Hermes-stepb`). `main`'s copy of this file still opens with the October 25 section. Any change before the merge goes on that branch. From action 3 on, work from the merged commit on `github/main` after `git fetch github`.

**Words used here.** Scope 1 is this redesign's first scope: Step A (tests and baselines) and Step B (the priority fixes). Scope 2 and Scope 3 are later scopes, listed below.

**Where things stand (checked 2026-10-27 05:12 UTC, the evening of October 26 Pacific):**

| What | State | How it was checked |
|---|---|---|
| Live site | source `a1b79cd`; none of Step B. Production deployment `72e45e9f` per the October 25 record (the deployment ID was not re-checked) | `https://fleetlab.pages.dev/publication.json` reads `source_commit` `a1b79cd137aa802c2bff1459843f550a5d70da83` (it carries no deployment ID); the live hub has none of Step B's "Compare:" lines |
| `main` | `f043995` (Step A merge); no branch protection or rulesets | `git ls-remote github refs/heads/main`; `gh api repos/bohueilin/Hermes/branches/main` (`protected: false`); `gh api repos/bohueilin/Hermes/rulesets` (none) |
| Step B | PR #11, open, from `codex/fleetlab-network-flows-step-b` into `main`; mergeable; not merged | `gh pr view 11` |
| CI on PR #11 | green on `f7da350`, the head when checked: run `40452254803`, both jobs (Python 3.11 and FleetLab Node 22.23.4). The commit that adds this handoff is a later docs-only commit and starts a new run; confirm both jobs are green on the current head before action 2 | `gh run view 40452254803`; `gh pr checks 11 --repo bohueilin/Hermes` |
| Branch head | when checked, `f7da350` (this file's first Step B record, docs only); this handoff is the next docs-only commit on top of it. Both sit on `1ede8e4` (W8, plan only), where every local gate, the stage check and the browser evidence ran. The last commit that changes site files is `0c4633b` (W5); W6 and W7 change only tests | `git log`, `git show --stat` |
| Merge | waits for the owner's instruction; use a merge commit | — |
| Deploy | waits for the owner's go-ahead naming the merged commit; only the owner publishes | — |

**What has been done:**
1. **Reconcile, PR #9:** merged as `b15055c`. `main` holds the live line again, and CI runs real tests on `macos-26`.
2. **Step A, PR #10:** merged as `f043995`. Tests, tooling and baselines only, with no visitor-visible change. It recorded the BEFORE baselines, the bounds, the stage check, the browser-evidence runner and the viewport check. Spec: [docs/fleetlab/network-flows/FLEETLAB_NETWORK_FLOWS_STEP_A_SPEC_2026-10-25.md](docs/fleetlab/network-flows/FLEETLAB_NETWORK_FLOWS_STEP_A_SPEC_2026-10-25.md).
3. **Step B, PR #11:** each change stays inside its Step A bound.
   - It has the five priority fixes (P0-1 to P0-5).
   - It has two riders from earlier owner rulings: #5, Explore ordered 01 to 05 with card 05 reworded; and #13, the global pause reaching the Rebalancing lesson video.
   - It applies the owner decisions D2 to D5 of 2026-10-26. D1 (the depot-page eyebrow) and D6 (defect (c)) are deferred to Scope 2 and are not built.
   - Plan: [docs/fleetlab/network-flows/FLEETLAB_NETWORK_FLOWS_STEP_B_PLAN_2026-10-26.md](docs/fleetlab/network-flows/FLEETLAB_NETWORK_FLOWS_STEP_B_PLAN_2026-10-26.md); its §5 lists every residual. The record below gives bytes, gates, evidence and the design verdict.

**Next actions, in order. Do not skip or reorder; merging alone puts nothing on the live site.**

| # | Action | Who |
|---|---|---|
| 1 | Answer the eight owner confirmations in PR #11 ("Owner confirmations requested"), or accept them as built. Two are real choices: FL-A4 priority below 768 px (width only, as now, or by position in Scope 2) and the hero shimmer on three heroes (keep it as a residual, or remove it now). | Owner |
| 2 | Merge PR #11 with a merge commit, never squash or rebase, only on the owner's instruction. CI must be green on the PR head before the merge, and on the merge commit on `main` after it. | Codex, on the owner's word |
| 3 | At the merged commit, on a clean detached worktree, following Step A spec §4, §9 and §10:<br>• confirm the merge commit's parents are `f043995` and the PR #11 head, that its tree equals the PR #11 head tree, and that `github/main` still points at it;<br>• build the stage with `apps/fleetlab-city/deploy/build-release.py --commit <merged SHA>`, the four local-only inputs and `--out <wt>/dist/stepb-<sha7>`;<br>• run `node apps/fleetlab-city/test/stage-check.mjs --stage <wt>/dist/stepb-<sha7> --mode after`;<br>• run `node apps/fleetlab-city/test/network-flows-evidence.mjs --stage <wt>/dist/stepb-<sha7>/stage --out <wt>/build/fleetlab-city/validation/network-flows-<sha7>` (it refuses to overwrite an existing `evidence.json`);<br>• run `node --test apps/fleetlab-city/test/viewport.test.mjs` with `FLEETLAB_REQUIRE_CHROME=1`, so it cannot skip;<br>• rerun the local gates of the Step B record;<br>• re-inspect at 1280, 768, 390 and 320 px, with the network panel on Capacity and Dispatch. | Codex |
| 4 | Re-judge the merged candidate against BEFORE on the three design axes defined in Step B plan §5: craft, comprehension and honesty in words. A fail on any axis means it is not ready to go live.<br>• The verdict below was judged at `a11a797`. W4 to W7 came after it and were verified, but not re-judged.<br>• The candidate is a local stage with no hosted URL. Codex hands the judge the action-3 evidence folder (`network-flows-<sha7>`: `evidence.json` and first-viewport screenshots of the hub, the five lessons and the depot page at four widths), the BEFORE set `network-flows-b15055c`, PR #11 and plan §5.<br>• Screenshots show no interactive states (loading, disabled, failure, pause). Judge those in a browser against the stage that Codex serves on `127.0.0.1`.<br>• A judge who cannot do that names what was not seen. The verdict goes to the owner. | Muse, or an independent judge |
| 5 | Physical-phone check on that candidate:<br>• the Capacity hero (tint, then art);<br>• Pause visual motion on Rebalancing;<br>• the Dispatch text-only hero;<br>• a Delivery Order edit and Compare;<br>• the depot page at phone width.<br><br>The candidate is not hosted. The owner chooses how it reaches the phone. The runbook's owner-run preview upload through the locked wrapper (`--branch codex-city-explorer`, never the production branch) is one route. Agents publish nothing. | Owner |
| 6 | Build the deploy-ready proof package:<br>• the merged SHA and tree;<br>• the stage path and the four build-input digests;<br>• the integration-manifest and teaching-receipt SHA-256;<br>• the stage check;<br>• the evidence JSON and its SHA-256;<br>• the offline pin;<br>• the rollback target, Pages deployment `72e45e9f` (source `a1b79cd`). | Codex |
| 7 | The owner gives the live go-ahead naming the exact merged commit. Then follow the release procedure in [docs/fleetlab/publishing/FLEETLAB_CLOUDFLARE_DEPLOYMENT.md](docs/fleetlab/publishing/FLEETLAB_CLOUDFLARE_DEPLOYMENT.md), steps 6 to 9, in this order:<br>• the owner uploads that stage to preview through the locked wrapper `apps/fleetlab-city/deploy/wrangler.mjs` (`--branch codex-city-explorer`);<br>• Codex runs the full byte readback (`apps/fleetlab-city/tools/readback.py`) and the header check (`apps/fleetlab-city/tools/check-headers.py`) on the preview;<br>• only if both pass, the owner uploads the same stage to production (`--branch feat/fleetlab-playground`, Cloudflare's production alias);<br>• Codex repeats both checks on production before anyone calls it live.<br><br>Only after a successful production readback does Codex record the release, per [docs/releases/README.md](docs/releases/README.md): the receipt from `apps/fleetlab-city/deploy/record-release.mjs`, the public record `docs/releases/fleetlab-current.json`, and this file. | Owner (go-ahead and both uploads); Codex (readback and record) |

**If something changes or fails:**
- **The owner picks "remove now" for the shimmer at action 1.** That is a new product commit on the PR #11 branch.
  - Codex commits it locally, staging named paths only.
  - Codex reruns the Step B gates, the stage check and the browser evidence at that commit, then reports the new SHA and results to the owner.
  - Codex pushes it, and updates PR #11's tables and this file's Step B record, only on the owner's instruction naming that commit.
  - Action 2 then needs green CI on the new head.
- **CI on the merge commit fails, or any of actions 3 to 6 fails.** Stop. Nothing deploys, and the live site stays at `a1b79cd`. Report what failed, and at which commit, to the owner.
- **The preview readback or header check fails at action 7.** Stop. Production is not uploaded, and the live site stays at `a1b79cd`.
- **The production readback or header check fails at action 7.** The candidate is already public. Do not call it released, and record nothing. Report to the owner.
  - The owner decides whether to roll back to Pages deployment `72e45e9f` (source `a1b79cd`), per the runbook's "Rollback and retained content" section, and carries out any rollback.
  - Codex then reruns the readback and the header check against the restored site.
- **Fixing it.**
  - Codex builds every fix. Muse may propose a design or copy fix first. The owner approves a fix before it is built.
  - The fix goes on a new branch from `github/main`. At its head, Codex reruns the Step B gates, the stage check and the browser evidence. The local pytest with fixtures and the City Python suite are not in CI, so they must run there.
  - Codex pushes and opens the pull request only on the owner's instruction naming the branch and commit. It lands with a merge commit.
  - Then restart at action 2 with that pull request in place of PR #11. At action 3, the merge commit's parents are the previous `main` head and the fix branch head.

**Open owner items outside this sequence (neither blocks the merge):**
- `main` has no branch protection, so CI on `main` is advisory until the owner requires the checks; that is a settings action.
- The City Python suite runs only in local gates and is outside CI, pending a separate owner decision.

**Later scopes (not started; each needs its own owner approval; neither waits for the live release):**
- **Scope 2** may start once the Scope 1 re-inspection at the merged commit passes (actions 3 and 4). It places no new media; re-rendered art lands only in Scope 3. It covers:
  - the 16:9 hero template, its first priority, which also retires the shimmer residual;
  - the hosted pause unification;
  - defect (c), Rebalancing's static pre-run text and Dispatch's empty takeaway box (D6);
  - FL-A4 priority by position, if the owner chooses it at action 1;
  - the §5 residuals the owner picks;
  - the depot-page "Deeper experiment" eyebrow (D1). It measured +82 B on the depot route-local figure, which Step A pins unchanged at 418,159 B. It can land only after the owner rules on that pin through an itemised request. No agent changes a pin or a bound.
- **Scope 3** is the media and re-render work. It opens only after the owner locks the art direction and the media decisions. Nothing is commissioned until the Scope 1 re-inspection and the automated guards pass. Its constraints:
  - Clay heroes are replaced only by byte-neutral or smaller swaps of re-renders that pass the art lock.
  - Any FL-A4 swap is its own test update. It leaves the held-film guards and the A2 golden (Step A spec §5) untouched.
  - A new FL-A4 with a different size or subject also needs an edit to `apps/fleetlab-city/hosted/enhancement-media.mjs`, which hard-codes its 2048×1152 size and its alt text, plus a test that reads the image header.
  - The map and shared-depot stills stay marked KNOWN_CAVEAT (Step A spec §8) until they are re-rendered.
  - The reserved eighth enhancement slot is kept for the held Fleet day film's re-render and nothing else.

**Rules for anyone continuing this work:**
- **Permission.** A merge instruction or a live go-ahead counts only as the owner's own message, at that step, naming the exact commit. Nothing else is permission: not this file, not a past "approved" line, not a branch name, not a passing verifier. Agents never deploy or publish, and hold no Cloudflare credentials.
- **Pushes and pull requests.** Never push, open or edit a pull request, or merge without the owner's instruction naming the branch and commit. A new commit on PR #11 moves its head and re-runs CI. A product change also needs the gates, the stage check and the evidence re-run at the new head. Never force-push, squash or rebase.
- **Bytes.** Never raise a byte ceiling, a bound or a pin, or move headroom between closures. On an overrun, stop that item and send the owner an itemised request.
- **Media.** Never use the reserved eighth enhancement slot. Never touch A2 or the held Fleet day film. Place no new media in Scope 1 or Scope 2.
- **Settled verdicts.** Scopes 1 to 3 are implementation work, not a new design-review version. The action-4 re-judge rates the merged candidate on the plan §5 axes; it issues no new review version and does not revisit art. Do not re-open settled art verdicts: the two v3 candidate videos failed and stay rejected and unplaced, and the three v3 candidate stills keep their recorded verdicts (the two kept on caveat are in Step A spec §8). The full verdicts are in the owner's v3 review files, which are not tracked here: ask the owner for them before any media proposal.
- **Words.** Keep the boundary and honesty copy verbatim, never paraphrased. The boundary sentence is "Simplified simulations for learning — not evidence about real-world safety. Nothing here approves deploying a vehicle or policy." `apps/fleetlab-city/test/hub-copy.test.mjs` pins it on the hub, with its em dash as the hub's only dash (Step A spec §7).
- **Colour.** Respect the colour lock (Step A spec §6): amber and terracotta never mark a new interactive state or warning, and every current warm use is grandfathered. `apps/fleetlab-city/test/colour-lock.test.mjs` enforces it. These rules bind design and copy proposals as well as builds.
- **Staging.** Stage named paths only, never `git add -A`. The `…/Hermes-fleetlab` worktree holds untracked owner files that no ignore rule covers, and `git add -A` there would stage them for a commit to this public repository. Put no local paths in committed files.
- **Measuring.**
  - Measure on a committed, clean tree. On uncommitted edits, each closure and the legacy figure read 9 B low, and emitted text 54 B low (Step A spec §2).
  - Measure only from a stage that `build-release.py` built for that committed candidate (`<archive drive>/Hermes-cold-archive-2026-11/Hermes-stepb-stage/dist/stepb-<sha7>/`). Never use a leftover `dist/site/` pack run, such as those in `<archive drive>/Hermes-cold-archive-2026-11/Hermes-stepb`, `…/Hermes-fleetlab`, `<archive drive>/Hermes-cold-archive-2026-11/Hermes-stepa` and `<archive drive>/Hermes-cold-archive-2026-11/Hermes-reconcile`.
- **Tools.**
  - Put the official Node 22.23.4 first on `PATH`: `build/fleetlab-city/toolchain/node-v22.23.4-darwin-arm64/bin` in `…/Hermes-fleetlab`.
  - Run `build-release.py` and the City Python suite with the City venv's CPython 3.11.15, `build/fleetlab-city/venv` in `…/Hermes-fleetlab`. It has SciPy and pyproj, but not pytest, ruff or Hermes.
  - Run ruff, pytest and `hermes doctor` in the `hermes-dev` conda env, also CPython 3.11.15. It lacks SciPy and pyproj, so it cannot run the City Python suite. Set `PYTHONPATH=src` from the worktree under test, because that env's editable install otherwise imports `hermes` from `…/Hermes-fleetlab`.
  - The toolchain, the City venv and the four local-only stage inputs live under that worktree's ignored `build/fleetlab-city/`. Preserve them.
- **Honesty.** Record only checks that were actually run, with their output, and name anything not checked.

### Step B record

- **What it changes for visitors once released:**
  - a text-only Dispatch hero;
  - Explore ordered 01 to 05, with card 05 reworded;
  - a tinted Capacity hero with no D-01 decoy, with FL-A4 eager at high priority from 768 px;
  - the global pause reaching the Rebalancing lesson video;
  - one lesson sequence ("LESSON n OF 5", Next and Previous, the hub Compare lines);
  - one disabled and loading language, with reasons;
  - honest Delivery Order states.

  Unchanged:
  - no media was added;
  - A2 and the held Fleet day film are untouched;
  - the reserved eighth enhancement slot is unused;
  - no ceiling was raised and no headroom moved between closures.
- **Step A merge details:** PR #10, merge commit `f043995` (parents `b15055c` and `86ce57a`). The base's measured values are the BEFORE baselines: non-City 16,187,445 B and compressed source offer 1,147,688 B. Each is 1 B above `a1b79cd`, because gzip compresses the embedded commit and tree hashes differently. CI run `40283638357` on `86ce57a` passed both jobs.
- **Step B bytes:** stage check in `after` mode at `1ede8e4`, 20 of 20 checks passing, against the BEFORE stage at `b15055c`:

  | Measure | BEFORE | AFTER | Change | Bound |
  |---|---|---|---|---|
  | Capacity (nf03) closure | 537,633 | 537,802 | +169 | 541,729 |
  | Software Delivery (nf04) closure | 221,334 | 220,926 | −408 | 225,430 |
  | Delivery Order closure | 225,063 | 226,062 | +999 | 229,159 |
  | Rebalancing (R1) closure | 196,347 | 196,848 | +501 | 200,443 |
  | Dispatch (R3) closure | 152,391 | 152,851 | +460 | 156,487 |
  | Depot closure; route-local | 513,471; 418,159 | 512,868; 418,159 | −603; 0 | 515,519; pinned |
  | Emitted text | 3,569,285 | 3,573,911 | +4,626 | 3,577,477 |
  | Integration text; source | 129,056; 389,082 | 128,946; 388,890 | −110; −192 | 133,152; 397,274 |
  | Source offer, extracted; compressed | 4,079,740; 1,147,688 | 4,083,602; 1,149,115 | +3,862; +1,427 | 4,104,316; 1,155,879 |
  | Package metadata | 44,361 | 44,361 | 0 | 45,385 |
  | Non-City | 16,187,445 | 16,193,498 | +6,053 | 16,203,828 |
  | Offline edition | 2,565,111 B, `313fa3f1…` | identical | 0 | exact |

  Unit-measured, by the Node suites:
  - brand byte-sum 73,286 B, against a bound of 75,937;
  - legacy text 2,605,859 B (+772), against 2,607,135;
  - raw source and tools 3,557,298 B (+4,029), against 3,569,653.

  The least headroom left is package metadata at 1,024 B and legacy text at 1,276 B. Among the closures it is the depot closure at 2,651 B.
- **Step B local gates** at `1ede8e4`, run with official Node 22.23.4 and CPython 3.11.15:

  | Gate | Result |
  |---|---|
  | `ruff check .` | clean |
  | `pytest -q`, with fixtures, R6 against `bca4ccd` | 1,675 passed, 55 skipped (MetaDrive) |
  | `hermes doctor` | 18 PASS, 1 NOT_AVAILABLE |
  | City Python suite | 375 OK |
  | Playground Node suite | 2,953 tests: 2,944 pass, 0 fail, 8 skipped (performance-gated), 1 todo |
  | City Node suite | 307/307 |
  | Traffic Node suite | 14/14 |

  The pull request records its CI result.
- **Step B browser evidence:** local headless Chrome 156 against the built stage at `1ede8e4`, without its `_headers`.
  - **Capacity at 1280:** FL-A4 is eager, with fetchpriority high and initial priority High, and is the LCP element.
  - **Capacity at 390:** FL-A4 is lazy at Low.
  - **D-01 decoy:** no longer requested at either width.
  - **Pause:** "Pause visual motion" now pauses r1-nf05 as well as FL-V2.
  - **Overflow:** only the depot page overflows, at 320 px: scrollWidth 355 at `1ede8e4`, the recorded exception. `viewport.test.mjs` allows this cell up to 363 (the recorded 355 plus an 8 px engine tolerance), and also fails if the overflow disappears or comes from anything beyond the "Depot content cache (diagnostic field)" select's field, `#share` and the motion control. The earlier Step B runs at `f822bfc`, `145f18d` and `a11a797` read 351, and BEFORE at `b15055c` read 355; the Step A spec records 351 to 355 as run-to-run variance.
  - **Console:** 0 console errors on every page.
  - **Fleet day:** A2 is present, with no V1.
- **Design verdict:** six independent agents judged the tree at `a11a797` fresh, in a real browser. Craft (desktop and phone lenses), comprehension and honesty in words are each PASS_WITH_RESIDUALS; re-inspection PASS; no blocker. The first verdict had rated craft FAIL on the Capacity end-of-lesson link; that and every later finding is fixed. W4 to W7 (the Delivery Order announcer and badge, static `disabled` on four selects, the tighter link sweep) came after the verdict: an independent verifier checked them, but they were not re-judged. The residuals are §5 of the plan.

## October 25, 2026 — FleetLab release `a1b79cd` live; `main` reconciled with the live line

**Superseded by the October 27 section above; kept as the record of that release.**

- **Live:** https://fleetlab.pages.dev serves source `a1b79cd137aa802c2bff1459843f550a5d70da83` (tree `5d890e3`) from branch `codex/fleetlab-depot-lab`. Production deployment `72e45e9f` (https://72e45e9f.fleetlab.pages.dev); preview `241a9eec`. The full byte readback matched 10,186 of 10,186 served files, and 100 of 100 header checks passed, at the preview and the stable address (production captured 2026-10-25 05:03 UTC). The immutable address passed 100 of 100 header checks and a 6-path smoke check; no full byte readback was run there. Receipt: [docs/releases/fleetlab-current.json](docs/releases/fleetlab-current.json), whose 128-path smoke subset matched 128/128.
- **What changed for visitors since `2d01b25`:** the October 23 enhancement release (source `d0df87f`, production `85b02be2`) added the approved media and presentation enhancements. The October 24 release added the Depot Readiness lab at `/depot-readiness/`, published at the owner's instruction without a separate release review; its open items are §9 of [the depot handoff](docs/FLEETLAB_DEPOT_LAB_IMPLEMENTATION_HANDOFF_2026-10-24.md). SF qualification stays HOLD.
- **Rollback:** an owner-operated Cloudflare Pages rollback to the prior production deployment `85b02be2` (source `d0df87f`), which restores the October 23 site without the Depot Readiness lab; not rehearsed. The receipt's City `rollback` entry (`0bdffbf`) is a staged City viewer generation, not a whole-site rollback.
- **Branches:** the live line, `codex/fleetlab-depot-lab` (pushed 2026-10-24 at `f1d130e`), diverged from `main` at `2d01b25`: 12 commits against `main`'s 4 (PR #7 and PR #8). `codex/fleetlab-main-reconcile` merges `main` into the live line with a merge commit, keeps the live receipt, adds the CI change below, and lands on `main` by pull request with a merge commit. After that, `main` is again the trunk: start new work from `github/main` after `git fetch github`.
- **Publishing:** unchanged. Only the owner publishes, through the locked wrapper `apps/fleetlab-city/deploy/wrangler.mjs` and a source-bound stage. Agents hold no Cloudflare credentials.
- **CI:** all 22 completed runs of the CI workflow failed (latest `39990707545`, 2026-10-23), because pytest stopped at collection without NumPy. The reconcile change installs `.[dev,workbench]` (Streamlit brings NumPy), adds `certifi` to the dev extra, and adds a `fleetlab-node` job on Node 22.23.4 (`actions/setup-node` pinned by commit, 45-minute cap) that runs the Playground, City and traffic Node suites. Both jobs run on `macos-26` (Apple silicon): the first hosted run on `ubuntu-latest` (x86-64, run `40257846823`) failed four Python parity pins (`tests/unit/test_fleet_playground_parity.py`) and one Node Scale-lab pin (`playground/fleetlab/test/scale-response.test.mjs`) by low-order floating-point differences. The pins were recorded on Apple-silicon macOS, and FleetLab makes no cross-platform claim for them (as for Hermes evidence, where cross-platform identity is an explicit non-goal), so CI runs on that platform. Linux reproduction of the pins is not claimed, and which factor differs (operating system, CPU architecture or math library) was not isolated. The Python job runs the reference interpreter, CPython 3.11.15, installed by uv 0.12.24: setup-python has no macOS build of 3.11 after 3.11.9, and on 3.11.9 `ipaddress` rejects the IPv4-mapped loopback address `::ffff:127.0.0.1`, failing the workbench launcher test (run `40258723240`). On CI only (`CI=true`), and only when `artifacts/` holds no registered fixture, `tests/conftest.py` skips the 228 tests listed in `tests/fixture_dependent_tests.txt`; that coverage runs only in local gates with the fixtures present, and a local run without fixtures still fails loudly. The City Python suite is not in CI yet, and branch protection is not enabled. The pull request records its CI result and the local gates.
- **Next:** the network-flows redesign. First tests, tooling and baselines, with no visitor-visible change; then the priority fixes to the network-flows lessons; then re-inspection and a deploy-ready proof package. Deployment waits for the owner's go-ahead naming the merged commit. Other items in the October 23 Next line keep their recorded state.

## October 23, 2026 — FleetLab release `2d01b25` live; `main` is the trunk

**Superseded by the October 25 section above; kept as the record of that release.**

- **Live:** https://fleetlab.pages.dev serves source `2d01b25e3df2df2c250fc64caaed14fb9c376c3c` (tree `8ef8d61`). Production deployment `4fd751ea` (https://4fd751ea.fleetlab.pages.dev); preview `973bdaf9`. The full byte readback matched 10,137 of 10,137 served files, and 81 of 81 header checks passed, at each of the preview, immutable and stable addresses (2026-10-23, 16:37–16:43 UTC). Receipt: `docs/releases/fleetlab-current.json` as of `8e6eb7f` (`git show 8e6eb7f:docs/releases/fleetlab-current.json`); since 2026-10-25 the tracked file holds the `a1b79cd` receipt. Its 103-path smoke list matched 103/103 at both production addresses (`apps/fleetlab-city/tools/readback.py --record <that receipt> --url https://fleetlab.pages.dev --output <file>`).
- **What changed for visitors:** the regional verdict card now names the tested change ("Change tested: …"). The rest is client and header hardening plus release tooling, merged in PR #5 and PR #6. The preview was browser-checked at desktop and 375 px width before production, with no console errors. City data, models and numerical pins are unchanged; SF qualification stays HOLD.
- **Rollback:** an owner-operated Cloudflare Pages rollback to the prior production deployment `2fe5a724` (source `4c375a8`); not rehearsed. It also removes this release's hardening, so use it only for a functional break, then fix forward. The package's own `rollback` entry (City release `0bdffbf`) is not the City page that was live before. The new deployment returns 404 for the retired City release paths `24bb784…` and `c56bda6…`; the stable domain may serve cached copies until they expire.
- **Branches:** PR #7 merged `codex/fleetlab-city-sf` into `main` as `b38f415`, with the same tree as the release. `main` is the trunk: start new work from `github/main` after `git fetch github`. Older local refs are stale, including `codex/fleetlab-city-sf` at `6c1e390` in the Hermes-fleetlab worktree. The git branch `feat/fleetlab-playground` is historical; the name survives only as the Cloudflare Pages production-branch label.
- **Publishing:** only the owner publishes, through the locked wrapper `apps/fleetlab-city/deploy/wrangler.mjs` and a source-bound stage. Agents hold no Cloudflare credentials. The raw `npx wrangler` commands in older handoffs are historical; do not run them.
- **CI:** the CI workflow has failed all 20 of its completed runs since 2026-08-25 (`gh run list --workflow CI`). Pytest stops at collection because NumPy is not installed, and many tests also need the untracked `artifacts/` fixtures. No FleetLab JavaScript suite runs in CI. Local gates remain the evidence until a CI fix lands.
- **Next:** (1) a CI change that actually runs tests; (2) the R2 "Who charges first?" lesson, after one owner decision on the packaging budget. Parked: SF Experiment A (map qualification HOLD), R7, N2 and the applied-AI experiments.

## September 29 enhancement — atlas layout, fleet insights and owner contact

Current enhancement is live as production `ed4b1d68-3130-4833-9f93-b170c8f3cbb9`,
source `773f36b42b22eae032c4465d6f8af13ea1572c66`; complete package
`build/fleetlab-city/launch-integration-v2/site`.
35 City Node / 122 City Python / 66 focused combined Node tests pass; the clean
viewer and local combined package pass. Review is clear. Publication and device
results are recorded in `docs/fleetlab/city-explorer/FLEETLAB_CITY_INTEGRATION_RELEASE_2026-09-29.md`.
The updated next-phase brief `docs/fleetlab/city-explorer/FLEETLAB_NEXT_PHASE_BRIEF_V3.md` explains the
100-vehicle population and lists SF acceptance evidence still required before
new cities. Existing site, map/experiment records and offline bytes are preserved.


## City Explorer integration — 29 September 2026

The owner approved additive City Explorer navigation and live website publication. The combined release preserves all established sections and offline bytes; only root boot/index/headers are intentionally changed. Live production `b592d5a8-c89c-4b42-99ca-e6d256bd2408` is verified: all 9,934 served payloads match; source implementation commit `3236065`. Current release and remaining scientific/device work: `docs/fleetlab/city-explorer/FLEETLAB_CITY_INTEGRATION_RELEASE_2026-09-29.md`. The power-study execution amendment and map/human qualification remain held. This website authorization does not authorize Hermes workbench or physical deployment.

**This is the one file every conversation reads first and updates last.** It supersedes
`PHASE8_STATUS.md`, `PHASE_ALIGNMENT.md`, `PHASE8_HANDOFF.md`, `HERMES_OVERVIEW.md` and
`PHASE8_GETTING_STARTED.md`, all removed on 2026-08-22 (recoverable from git history). Do not
create a new status, handoff, alignment or overview document; edit this one.

| | |
|---|---|
| **Checkouts** | **2026-11-10:** see the top section's Checkouts table: `…/Hermes` on `main` at the reconcile merge, the workbench detached at `main`, `ux-impl-20261104` fast-forwarded locally to `0b0fb05`; `fleetlab-perf-20261109`, `perf-suite-5a4dafb` and `main-reconcile-0b0fb05` removed. **2026-11-09:** PR #24 merged. `…/Hermes` is on `main` at `964d413`. The worktrees `…/Hermes-worktrees/city-base-refresh-4b039be` and `…/Hermes-worktrees/sot-release-5a4dafb` were removed; their branches stay. This update is in `…/Hermes-worktrees/sot-cold-archive` on `claude/sot-cold-archive-on-main`, and the CI lint fix is in `…/Hermes-worktrees/ci-ruff-sim102`. The workbench is still on `claude/sot-cold-archive-done` (the top section). **2026-11-08:** the live line is on `codex/fleetlab-ux-impl-20261104` in `…/Hermes-worktrees/ux-impl-20261104` (at `5a4dafb`, clean). The build worktree `…/Hermes-worktrees/city-base-refresh-4b039be` is on local branch `claude/fleetlab-city-base-refresh`. This update is in `…/Hermes-worktrees/sot-release-5a4dafb` on `claude/sot-release-5a4dafb`. The top section lists them. **2026-11-03, workspace reorganization** (the layout and its reasons are in the "Start here" block's "Workspace layout" paragraph): `…/Hermes` and the release workbench `…/Hermes-worktrees/fleetlab-workbench`, still reached as `…/Hermes-fleetlab`, are on `main`. The docs pull requests #21 and #22 merged as `19f039e` and `7bf6ddf`. The live, rollback and fixture-list release worktrees moved into `…/Hermes-evidence/`, and the older evidence and stage worktrees were copied to `<archive drive>/Hermes-cold-archive-2026-11/`, verified twice, and deleted locally on 2026-11-06. The empty release-record worktrees `…/Hermes-release-848b420`, `-8d2c7ac`, `-94a201f`, `…/Hermes-release-record` and `…/Hermes-sot-start-here` were removed; their branches stay on GitHub. **2026-11-02, later:** the "Start here" update is on `claude/fleetlab-sot-start-here` in `…/Hermes-sot-start-here`, cut from `main` at `40eebed`, until it merges. **2026-11-02:** the release-record branch `claude/fleetlab-release-record-94a201f` is in `…/Hermes-release-94a201f`. `…/Hermes-evidence/fleetlab-release-94a201f`, detached at `94a201f`, holds the released stage and its release evidence in its ignored `dist/` and `build/fleetlab-city/validation/`; leave it untouched, like the three locations in the 2026-11-01 note below. `<archive drive>/Hermes-cold-archive-2026-11/Hermes-tile-release-5457181`, detached at `5457181`, holds the stage that failed the non-City bound. The tile work was built in `<archive drive>/Hermes-cold-archive-2026-11/Hermes-tile-swap` on `claude/fleetlab-tile-media-swap` (PR #17) and `<archive drive>/Hermes-cold-archive-2026-11/Hermes-tile-bound` on `claude/fleetlab-tile-stage-bound` (PR #18), both merged. `…/Hermes-fleetlab` is still detached at `41429f5`; its five uncommitted tracked changes are Codex's tile swap (top section). **2026-11-01:** the release-record branch `claude/fleetlab-release-record-8d2c7ac` is in `…/Hermes-release-8d2c7ac`. `…/Hermes-evidence/fleetlab-release-8d2c7ac`, detached at `8d2c7ac`, holds the released stage and its release evidence in its ignored `dist/` and `build/fleetlab-city/validation/`. `…/Hermes-evidence/fleetlab-release-9dfc6bc`, detached at `9dfc6bc`, holds the October 31 stage and evidence in the same two ignored places, and the upload records for that release are in `…/Hermes-fleetlab/dist/coordinated-date-publication-20261030/`. Leave all three untouched (the top section's Release evidence row lists them). `<archive drive>/Hermes-cold-archive-2026-11/Hermes-coordinated-release-78af8f1` holds the superseded `78af8f1` preview evidence. The catalog wave was built in `<archive drive>/Hermes-cold-archive-2026-11/Hermes-catalog-lookfor-lean-b` on `claude/fleetlab-catalog-lookfor-lean-b`, merged as PR #15. A Codex worktree named `fleetlab-catalog-readability`, detached at `9dfc6bc`, holds an earlier uncommitted attempt at that wave; it is kept only as evidence, so do not build from it or clean it. `…/Hermes-fleetlab` is detached at `41429f5`, with five uncommitted tracked changes that predate this release work and belong to no release (`apps/fleetlab-city/hosted/visitor.mjs` and four tile images): leave them. Its ignored `build/fleetlab-city/` still holds the stage inputs, the official Node 22.23.4 toolchain and the City venv. **2026-10-27:** the release-record branch `codex/fleetlab-release-record-848b420` is in `…/Hermes-release-848b420`. `<archive drive>/Hermes-cold-archive-2026-11/Hermes-stepb-stage`, detached at `848b420`, now holds the released stage and the release evidence in its ignored `dist/stepb-848b420/`, and the merged-commit browser evidence in its ignored `build/fleetlab-city/validation/network-flows-848b420/`: leave it untouched (the 2026-10-26 note below, that it is moved to each candidate head, no longer applies). **2026-10-26:** Step B is in `<archive drive>/Hermes-cold-archive-2026-11/Hermes-stepb` on `codex/fleetlab-network-flows-step-b` (PR #11); its ignored `build/fleetlab-city/validation/network-flows-<sha7>/` holds the AFTER browser evidence. `<archive drive>/Hermes-cold-archive-2026-11/Hermes-stepb-stage` is a detached worktree moved to each candidate head; its ignored `dist/stepb-<sha7>/` holds the built stages. `<archive drive>/Hermes-cold-archive-2026-11/Hermes-stepa` (merged as PR #10) and `<archive drive>/Hermes-cold-archive-2026-11/Hermes-stepa-base` (detached at `b15055c`) need no more commits, but keep both: `<archive drive>/Hermes-cold-archive-2026-11/Hermes-stepa-base`'s ignored `dist/stepa-b15055c/` is the BEFORE stage, and `<archive drive>/Hermes-cold-archive-2026-11/Hermes-stepa`'s ignored `build/fleetlab-city/validation/network-flows-b15055c/` is the BEFORE browser evidence. `<archive drive>/Hermes-cold-archive-2026-11/Hermes-reconcile` is merged (PR #9); its ignored `artifacts/` supplied the pytest fixtures for the local gates. `…/Hermes-fleetlab` is now on `codex/fleetlab-depot-lab` at `f1d130e`; keep it, because its ignored `build/fleetlab-city/` holds the four stage inputs, the official Node 22.23.4 toolchain and the City venv. `<archive drive>/Hermes-cold-archive-2026-11/Hermes-depot-lab-review-a1b79cd` (detached at `a1b79cd`) holds, in its ignored `dist/fleetlab-depot-lab-20261024-a1b79cd/`, the retained stage of the live release; leave that worktree and folder untouched, because it is the checked package behind the rollback target `72e45e9f`. **2026-10-25:** once the reconcile pull request merges, `github/main` again holds the whole live FleetLab line (`a1b79cd` and its records); branch new work from it after a fetch. The reconcile worktree is `<archive drive>/Hermes-cold-archive-2026-11/Hermes-reconcile` on `codex/fleetlab-main-reconcile`. **2026-10-23:** `github/main` (`b38f415`) is the trunk and contains the whole FleetLab release line; branch new work from it after a fetch. The main checkout itself is on `codex/fleetlab-integration`, and the worktree notes that follow are 2026-09-28 observations. · main checkout `…/Hermes` on `main`, **now the integration trunk**: ADAS trunk, FleetLab, and metrics-V3 all merged (but its untracked `artifacts/` is stale, see §14; run ADAS validation in the worktree) · FleetLab worktree `…/Hermes-fleetlab` on `codex/fleetlab-welcome-design`, release source `e90764a` plus its records follow-up (audit-response update live as `f4018c2a`; pushed to `github/feat/fleetlab-playground`) · ADAS worktree `…/Hermes-adas` on `feat/phase8-lead-decelerates` at `579ca12` as read on 2026-09-27 (canonical `artifacts/` fleet lives there) · Phase 7 codex worktree (read-only) · FleetLab Playground worktree `<archive drive>/Hermes-cold-archive-2026-11/Hermes-playground` on `feat/fleetlab-playground` (website lineage, previously observed clean at `6b376fb`; the remote advanced again in this release, and this worktree was not moved; fast-forward it before anyone works there) · Depot extension worktree `<archive drive>/Hermes-cold-archive-2026-11/Hermes-depot-m1` on `codex/fleetlab-m2-m3` · **Scale lab worktree `<archive drive>/Hermes-cold-archive-2026-11/Hermes-scale` on `claude/fleetlab-scale-lab`** (cut from the T1 head `c79eccf`; Scale lab source `c08f60d`, deployed 2026-09-27 as `19e17ac6`; `1aeaace`, the Fleet day heading fix, deployed 2026-09-28 as `77922688`; then the documents commit `44569f8`, the privacy commit `0bc2f25` and the records commit of 2026-09-28, which change no site input; branch head pushed on 2026-09-28 as `github/feat/fleetlab-playground`) |
| **Remote** | **2026-11-10:** `claude/fleetlab-perf-20261109` pushed at `0b0fb05` (new branch, no force push) on the owner's written authorization naming that branch and commit, then released as `d477d470`. `claude/fleetlab-main-reconcile-0b0fb05` merges it into `main` through a pull request with a merge commit. `codex/fleetlab-ux-impl-20261104` was not pushed. **2026-11-09:** PR #24 (`claude/sot-release-5a4dafb` at `caa3aad`) merged as `964d413` with a merge commit, on the owner's authorization naming the branch and commit. FleetLab Node passed. The Python job failed at lint, on ruff 0.17.4's SIM102 in an unchanged file, and the owner's authorization covered a docs-only change verified this way. No force push. **2026-11-08:** `codex/fleetlab-ux-impl-20261104` pushed `4b039be..5a4dafb`, with no pull request, no merge to `main` and no force push. It already carried the five earlier releases since `94a201f`. **2026-11-02:** PR #17 merged as `5457181` and PR #18 as `94a201f`, each with a merge commit; `claude/fleetlab-tile-media-swap` pushed `a658fa6` and `claude/fleetlab-tile-stage-bound` pushed `ad0396d` first. Later that evening (04:02:51 UTC on 2026-11-03), PR #19, the release record, merged as `40eebed` with a merge commit; `claude/fleetlab-release-record-94a201f` pushed `69e58b7` first. Earlier, on the evening of 2026-11-01 (05:16 UTC on 2026-11-02), PR #16, the November 1 release record, merged as `ba13068`. No force push. **2026-11-01:** PR #15 merged as `8d2c7ac` with a merge commit; `claude/fleetlab-catalog-lookfor-lean-b` pushed `ce03966` first. **2026-10-30 and 2026-10-31:** PR #13 merged as `78af8f1` and PR #14 as `9dfc6bc`, each with a merge commit. **2026-10-28:** the Step B release record merged as `ac87b7a` (PR #12). No force push. `main` has no branch protection or rulesets. **2026-10-27:** PR #11 merged as `848b420` with a merge commit; `codex/fleetlab-network-flows-step-b` pushed `031a27b` first. No force push. **2026-10-26:** PR #9 and PR #10 merged with merge commits; `codex/fleetlab-network-flows-step-b` pushed and open as PR #11. No force push. `main` has no branch protection or rulesets. **2026-10-25:** `codex/fleetlab-depot-lab` was pushed on 2026-10-24 at `f1d130e` and reaches `main` through the reconcile pull request; no force push. **2026-10-23:** FleetLab work now lands on `main` by pull request (PR #7). The git branch `feat/fleetlab-playground` is no longer the website lineage; the site is published by direct upload (top section). Earlier record: `github`, the public GitHub repository of this project; website lineage tracks `github/feat/fleetlab-playground`. On the owner’s request of 2026-09-28, the audit-response wave fast-forwarded that branch from `756c269` to release source `e90764a`, including the two prior welcome commits; the records-only follow-up is on the same branch. No force push, PR or main merge. A push does not deploy; the separate verified Pages publication is recorded in §7.5. Other checkouts retain their previously observed state. |
| **Base of Phase 8** | `feat/phase6-reviewer-comprehension` @ `4eb8765` (2026-08-16) |
| **Phase 8** | FCW/AEB slice complete **+ brake calibration merged 2026-08-24** (`feat/phase8-adas-lab` @ `6b2f375`): measured curve 4–30 m/s, MuJoCo fidelity instrument, Warp kernel, esmini audition; Phase 3 merged @ `a78287e` (stationary-lead pair, ADAS fault wiring, two design notes); **Phase 4 (evidence schema 3.0 / `RunMetricsV3`) complete 2026-08-25, maintenance pass landed and requalified 2026-08-26** on `feat/phase8-metrics-v3` @ `2dda024`, **merged onto `main` 2026-08-26 (`b447fc4`, conflict-free)** — evidence stays commit-bound to `2dda024`; **P0 FCW lane merged 2026-08-27 (`deeca8c`)**: `fcw_stationary_lead`, derived-map adapter change, conditional adapter `1.2`; **steady-lead lane merged 2026-08-28 (`df0e34e`)**; **adjacent-pass lane merged 2026-08-28 (`bd60b5b`)**; **lead-decelerates lane merged 2026-08-29 (`cb0b535`)** — P0 catalog closed except roster-blocked `cut_out_reveal_stopped` and decision-deferred `acc_lead_decelerates`; suite **1,566** in the ADAS worktree (§11.1 item 3) |
| **Phase 9** | **FLEET-005 spike plus the Stage 1 metric contract and Stage 2 registry provenance/static operator view built and gated** on `feat/phase9-metric-contract` (Stage 1 tip `f2645ae`; forward-only envelope repair `f0e4ded`; handler-coverage tests `aa8f406`; Task 7 record re-baseline `3a7f595`; Task 8 static view `4b2e8b8`; forward-only repairs `18b47db`, `e42ed2c`) — Gate G: **96 passed**; replayable decision record; spec-file authoring, metric-contract CLI, and one loopback-only finished synthetic-run view; **lane merged onto `main` 2026-09-06 (`61a7145`) and pushed**. The PRD has been tracked since `aa04786` |
| **Playground** | **Current: release `0b0fb05` live as `d477d470` since 2026-11-10 (top section), from `claude/fleetlab-perf-20261109`, merged into `main`. Before it, `5a4dafb` as `9de52270` from 2026-11-08, from `codex/fleetlab-ux-impl-20261104`; and from 2026-11-04 to 2026-11-08: `4b039be` as `1dfb0f22`, `e3a5f0c` as `ba603536`, `ceb3d25` as `36954b5c`, `57dd67e` as `e5424a33` and `de80555` as `79489c69`. Then `94a201f` as `cdf2bd6e` from 2026-11-02; before it, `8d2c7ac` as `9e85c9cc` from 2026-11-01, `9dfc6bc` as `c743621d` from 2026-10-31, and `848b420` as `ac431ba3` from 2026-10-27. The rest of this row is the 2026-09-28 record.** **Audit-response update live 2026-09-28** at **https://fleetlab.pages.dev/**, source **`e90764a99661a579de3dc976afedc45e7417f49a`**, Production **`f4018c2a-3127-4807-af90-3a4ae0f33faa`**, immutable https://f4018c2a.fleetlab.pages.dev/. Clear simulation-first welcome, seven header links including Scale lab, consistent Four-area naming, earlier first-run guidance and larger captions; ivory/teal design retained. Protected model/runtime/data and numerical pins unchanged. **Final Node suite: 1,972 pass, zero fail, one existing TODO; 89 Python parity/boundary tests pass.** Earlier timing failures and the controlled comparison remain recorded in the handoff. Both packages and Ruff pass. Hosted 99 files / 3,366,216 bytes; offline 2,424,861 bytes (+101). Committed-source reconstruction matches both packages; **98/98 public files and all six configured response headers match on both addresses**. Painted local viewport checks and hosted representative interactions pass; Q1 remains partial and Q8 queued. Source and release records pushed to `github/feat/fleetlab-playground`. Rollback `1e1202c9` (`347bcfb`). Current record: [CODEX_HANDOFF.md](docs/archive/phase6-pack/CODEX_HANDOFF.md), top section. |
| **MuJoCo** | sandbox exploration only (`sandbox/mujoco/`, gitignored, never committed, labelled NOT EVIDENCE) |
| **Verification** | merged `main` @ `b447fc4` from the main checkout: **1,443 passed + 8 known artifact-staleness failures** (§14 — the checkout's untracked `artifacts/` predates Phase 3; code proven clean: `src`+`tests` diff vs the verified branch is fleet-only) · ruff clean · doctor 17 PASS / 1 WARN / 1 NOT_AVAILABLE |
| **Published copy** | Historical copy: https://claude.ai/code/artifact/9f41cdb3-b9b1-4721-bc2c-1ab5dabe486b — not updated. The current user authorized the existing FleetLab Pages site, not this separate document artifact. |
| **Design review and next phase** | [N2 design v2.1](docs/plans/2026-09-26-fleetlab-n2-design-v2.1.md) is the current N2 design; it supersedes the [v2 draft](docs/plans/2026-09-26-fleetlab-n2-design-v2.md), which superseded immutable v1. It holds 19 fixture groups; OD-1 to OD-6 and OD-19 are decided and the other N2 decisions are pending; **G2 OPEN pending S1**; no N2 implementation approval. The [design audit](docs/FLEETLAB_N2_V2_DESIGN_FEEDBACK.md) holds the next tasks. The [Scale lab design](docs/plans/2026-09-27-fleetlab-scale-lab-design.md) holds 25 owner decisions, taken at the lead's recommendation and ratified by the owner on 2026-09-28 with its package decisions D1 to D11. The FleetLab next plan, open owner decisions and build queue are the top section of [CODEX_HANDOFF.md](docs/archive/phase6-pack/CODEX_HANDOFF.md). The earlier review packet and independent packet review remain historical rationale. No external dataset work; S1, X1, P2 remainder, P0 study and R0 lessons remain separate future work. |
| **Last updated** | 2026-11-11: a "FleetLab: where we are now" block added at the top as the single entry point for owners and agents; PR #27 recorded as merged (`4c0de12`); the daily readback re-pointed to `0b0fb05`. 2026-11-10: FleetLab release `0b0fb05` (production `d477d470`) recorded as live, with its two performance waves, exact ceilings, gates and live readbacks. `main` reconciled with the live line by merge. `docs/releases/fleetlab-current.json` now describes `0b0fb05`. The November 8 section marked superseded. 2026-11-09: the finished cold archive recorded (the 2026-11-06 record, replayed onto `main`); the November 8 section's checkouts and next actions refreshed after PR #24's merge; the Checkouts and Remote rows updated; `main` CI's lint failure recorded with its prepared fix. 2026-11-08: FleetLab release `5a4dafb` (production `9de52270`) recorded as live, together with the five releases since `94a201f` that this file had not recorded. Also recorded for the next agent: the City base, byte-ceiling and design-review state, and the daily 09:00 readback task. `main` reconciliation stays open. 2026-11-02, later: a "Start here" block for any agent added at the top of the November 2 section; the handoff table updated for PR #19's merge as `40eebed` and main CI on it. 2026-11-02: FleetLab release `94a201f` (production `cdf2bd6e`) recorded as live, with its release gate, the failed `5457181` stage before it, and its readbacks; the public record now describes `94a201f`; the handoff refreshed with the next actions. 2026-11-01: FleetLab releases `9dfc6bc` (production `c743621d`, 2026-10-31) and `8d2c7ac` (production `9e85c9cc`, 2026-11-01) recorded as live in turn, with their release gates and readbacks; the public record now describes `8d2c7ac`; the handoff refreshed with the next actions. 2026-10-27: network-flows Step B recorded as live (`848b420`, production `ac431ba3`) with its release gate, readbacks and receipt; the handoff refreshed with the next actions; the release-gate residuals added to Step B plan §5. 2026-10-26: top section rewritten as the Codex and Muse handoff: Step B open as PR #11 (CI green on `f7da350` when checked), not merged and not live (live `publication.json` still reads `a1b79cd`), with the ordered next actions, who does each, the failure paths and the rules; the Step B record's depot overflow corrected to 355 px at `1ede8e4`. Earlier the same day: network-flows Step A recorded as merged (`f043995`, PR #10), the reconcile pull request as merged (`b15055c`, PR #9), and Step B recorded with its byte report, gates, browser evidence and design verdict; the live release is unchanged. 2026-10-25: FleetLab release `a1b79cd`, live as `72e45e9f`, recorded here; `main` reconciled with the live line by merge commit; CI changed to run on Apple-silicon macOS, install the workbench extra, run the FleetLab Node suites on Node 22.23.4 and, on CI only, skip fixture-dependent tests when no fixture is present (its result is recorded on the reconcile pull request). Other tracks retain recorded dates. |

**Contents:** [0 How to use this file](#0-how-to-use-and-update-this-file) ·
[1 What Hermes is](#1-what-hermes-is) · [2 State at a glance](#2-current-state-at-a-glance) ·
[3 Step-by-step runbook](#3-step-by-step-runbook) · [4 Architecture by layer](#4-architecture-by-layer) ·
[5 History, Phases 0–9](#5-history-phases-09) · [6 ADAS in depth](#6-adas-in-depth-phase-8) ·
[7 MuJoCo and Phase 9](#7-mujoco-sandbox-and-phase-9-fleet-simulation) · [8 What is not claimed](#8-what-is-not-claimed) ·
[9 Defects found and fixed](#9-defects-found-and-fixed) · [10 Coordination rules](#10-coordination-rules-for-parallel-sessions) ·
[11 Next steps](#11-next-steps-by-track) · [12 Landmines](#12-landmines) · [13 Open decisions](#13-open-decisions-that-need-a-human) ·
[14 Housekeeping](#14-housekeeping-and-known-inconsistencies) · [15 Document map](#15-document-map)

---

## 0. How to use and update this file

**Picking up cold, in any conversation:**

```bash
conda activate hermes-dev && cd ~/Documents/GitHub/Hermes
export PYTHONPATH="$PWD/src"      # mandatory — see §3.0; the editable install points elsewhere
git status --short                # expect empty; git log --oneline -1 to see HEAD
make preflight                    # silent + exit 0 = you are on the right checkout
make test                         # expect 965 passed (host with vendored MetaDrive)
```

Then read §2 for numbers, §10 before touching shared code, §11 for what to do next, §12 before
doing it.

**Updating this file — the rules:**

1. Update in place. Every other status-type document was removed so that this one cannot drift
   from a sibling. If a section grows unwieldy, split the *reference* material into a linked doc
   and keep the status here.
2. Every number here is measured, not estimated. When you change code, re-run the relevant
   command and update the figure with the command that produced it. Stale figures have already
   bitten this project four times (§14).
3. Record what you did **and what you deliberately did not do**. The "not claimed" and
   "open decisions" sections are load-bearing; the repository has been audited by an outside
   reader and the overclaims that survived were the expensive ones.
4. Commit this file in the same commit as the work it describes, with the `Last updated` date,
   and republish the artifact (URL in the header) so the readable copy matches the repo.
5. Parallel sessions: read §10 first. Most ways to break Phase 8 are *silent* — a wrong number
   that verifies cleanly, not a red test.

**Ground rules that are not negotiable** (Phase 8 PRD §39; Phase 9 PRD §54; restated because they
erode one small step at a time): simulation only; no CAN, physical-vehicle or public-road claim;
no standards-compliance or certification claim; no weakening of evidence integrity; **no deleting
a prior test to make new work pass**; no agent verdict replacing the deterministic gate; no
language model in a real-time control loop. The Phase 7 worktree is **read-only** (§5.8).

---

## 1. What Hermes is

**A simulation-only lab for deciding whether an autonomy change is safe to advance — and for
proving the decision afterwards.**

> Model proposes. Environment verifies. Gate decides. Trace proves.
> Capability is not permission.

Hermes runs a driving policy against a pinned physics simulator, judges the run with verifiers
that are independent of the policy, resolves those judgements through a release gate that cannot
be talked out of a failure, and writes the whole thing to a hash-chained evidence bundle that can
be re-checked later without re-running anything. It is a personal project, specified by its owner
and implemented largely by coding agents from written specifications (the prompts are committed),
built across twelve days in August 2026. It is not a product.

### 1.1 The problem it is actually about

A quality gate's value is invisible in its normal output. Every passing run looks the same whether
the gate is rigorous or vacuous — the artifact is identical either way. So adoption becomes a
matter of belief, and belief decays: the first time the gate blocks something inconvenient, the
argument is "the gate is wrong," and there is usually nothing in the product to answer with.

Hermes takes that as the design problem. The consequence is that **the demo that sells the tool
is the one where things break correctly**: `make demo-seeded-defects` runs three controllers each
broken in exactly one way, each of which must be caught by *its own named criterion*, plus a
baseline control so "the gate caught it" cannot quietly mean "the gate always fails".

### 1.2 The second idea: trust is decomposed, never aggregated

Gate verdict, integrity, and five separate trust records — authenticity, authorization,
deployment permission, scope, authoritative status — are reported independently, because in a
review tool **the aggregate is the failure mode**. A single status light is what users ask for
and the thing that ruins the tool. The code enforces this structurally: `AuthenticityStatus` has
exactly one member, `NOT_AUTHENTICATED`, because there is no signing and no trust anchor; the enum
cannot express a claim the system cannot support.

---

## 2. Current state at a glance

All figures measured 2026-08-22 at `e6e2c8c`; the command that produced each is shown.

| Measure | Value | Command |
|---|---|---|
| Branch / HEAD | `feat/phase8-adas-lab` | `git branch --show-current; git rev-parse --short HEAD` |
| Phase 8 commits | 36 since `4eb8765` | `git rev-list --count 4eb8765..HEAD` |
| Total commits | 70 | `git rev-list --count HEAD` |
| Phase 8 diff | 74 files, +12,581 / −154 | `git diff --shortstat 4eb8765..HEAD` |
| Remote heads | `feat/phase8-adas-lab` @ `e6e2c8c`, `codex/phase7-…` @ `9d5c0ba` — **nothing else** | `git ls-remote --heads github` |
| Local `main` | `c181509`, Phase 0 only, **not on GitHub** | `git branch -a` |
| Tests | 965 passed; 18 carry the `metadrive` marker | `pytest -q`; `pytest -q -m metadrive --collect-only` |
| Lint | All checks passed | `ruff check .` |
| Doctor | 17 PASS / 1 WARN (no active conda env when invoked by path) / 1 NOT_AVAILABLE (no DISPLAY) | `hermes doctor` |
| Source | 66 files, 22,338 lines | `find src/hermes -name '*.py' \| xargs wc -l` |
| Tests (lines) | 51 files, 19,813 lines | `find tests -name '*.py' \| xargs wc -l` |
| Evidence bundles on disk | 63 under `artifacts/` (gitignored); **13** registered in `config/phase8-fixture-registry.yaml` | `ls -d artifacts/*/ \| wc -l` |
| Scenarios | 9 top-level + 5 under `scenarios/adas/` | `ls scenarios scenarios/adas` |
| Controller configs | `config/adas/{baseline,defect_late_braking,defect_no_aeb,defect_over_braking}.yaml` | |
| Simulator | MetaDrive 0.4.3, vendored at `third_party/metadrive` (gitignored), pinned to `85e5dadc6c7436d324348f6e3d8f8e680c06b4db` | `cat SIMULATOR_COMMIT` |
| Python | 3.11.15 in conda env `hermes-dev`; deps pydantic, PyYAML, rich, typer; extras `dev`, `workbench` | `pyproject.toml` |
| CI | `.github/workflows/ci.yml` — pull requests and pushes to `main`. **2026-10-25:** jobs `test` (CPython 3.11.15 via uv, `.[dev,workbench]`, `-m "not metadrive"`, fixture guard) and `fleetlab-node` (Node 22.23.4, three suites), both on `macos-26` because the numerical pins reproduce only on the Apple-silicon macOS platform where they were recorded; status in the top section. Earlier wording ("triggers on `main` only; has never run against this work") was already wrong about the trigger | `gh run list --workflow CI` |
| LICENSE | **none** | `ls LICENSE*` |

**Reproducibility off this host — measured, not estimated:**

| From | Result |
|---|---|
| A clean clone, as committed | **144 failed / 761 passed / 42 errors** |
| After `hermes fixtures regenerate` | **24 failed / 883 passed / 40 errors** |
| This development host | 965 passed |

Two causes: `artifacts/` is gitignored, so eight test modules load fixtures by name that nothing
committed can produce (`fixtures regenerate` closes most of the gap); and MetaDrive is **not a
declared dependency** — a vendored, gitignored checkout — so 5 of 13 fixtures cannot regenerate
anywhere the simulator has not been placed by hand. A repository about evidence integrity that
cannot reproduce its own evidence elsewhere is a real contradiction, and it is stated here rather
than discovered by cloning.

---

## 3. Step-by-step runbook

Every command is copy-pasteable and says what it should print.

### 3.0 Setup — read this even if you think you know it

```bash
conda activate hermes-dev
cd ~/Documents/GitHub/Hermes
export PYTHONPATH="$PWD/src"
```

| Symptom | Cause |
|---|---|
| `No module named hermes` | You are in `base`. Activate `hermes-dev`. |
| Everything *appears* to work but results look unfamiliar | **The dangerous one.** The `hermes-dev` editable install (`__editable__.hermes_autonomy-0.1.0.pth`) resolves `hermes` to the **Phase 7 codex worktree**, not this checkout. Without `PYTHONPATH`, `python -m hermes` silently runs a different tree. |

`make` guards against both — it exports `PYTHONPATH` and refuses to start otherwise:

```bash
make preflight        # nothing printed, exit 0 → correct checkout
```

`tests/unit/test_import_provenance.py` fails loudly if the wrong tree is imported. Never edit the
`.pth`; it belongs to the owner's Phase 7 environment.

### 3.1 Verify the whole thing

```bash
make test        # expect: 965 passed
make lint        # expect: All checks passed!
make doctor      # expect: Summary: 17 PASS, 1 WARN, 1 NOT_AVAILABLE
```

`make test` includes 18 tests that drive real MetaDrive physics. What CI runs (simulator-free):

```bash
python -m pytest -q -m "not metadrive"      # 947 tests
```

### 3.2 The six demos, in order of what they prove

**Demo 0 — `make demo-phase1`.** The Phase 1 evidence core on the deterministic fake adapter: run,
then re-verify the bundle from stored bytes. Proves the pipeline without a simulator.

**Demo 1 — `make demo-adas`.** Two ADAS scenarios (threat, then nominal) on real physics, then
triage of the first. Look for `Verdict: CONDITIONAL` on both (every hard ADAS invariant passes;
held on comfort), and `AGENT INTERPRETATION` / `DETERMINISTIC FACT` printed as *separate lines*.

**Demo 2 — `make demo-seeded-defects`.** Expect `7 passed`. Three controllers broken one way each,
run as five cases, each caught by its own named criterion, plus baseline controls. This is the only
evidence that the evaluation *discriminates* rather than merely runs. To watch one fail by hand:

```bash
python -m hermes run --simulator metadrive --headless \
  --scenario scenarios/adas/aeb_lead_hard_brake.yaml \
  --policy adas-longitudinal --policy-config config/adas/defect_late_braking.yaml \
  --gate-config config/gates.adas.yaml --seed 7 --run-id demo-late
```

Expect `Verdict: HOLD`, with `adas.aeb.brake_onset_margin` among the supporting findings. **Read
§6.7 before quoting this** — the HOLD is driven by `progress.required`, not by the ADAS finding.

**Demo 3 — `make demo-adas-tradeoff`.** The one to show people. Expect:

```
verdict        REGRESSED   CONDITIONAL -> HOLD
hard_failures  REGRESSED   [] -> ['adas.aeb.no_false_intervention']
```

A candidate that brakes far earlier improves minimum TTC on the *threat* scenario from
**1.17 s to 4.67 s** (and on the nominal scenario from 18.07 s to 58.40 s). On a collision-and-TTC
scorecard it ships. The gate holds it on the nominal scenario for what it does when nothing is
there. The comparison has no aggregate score and no winner field.

**Demo 4 — `make demo-flywheel`.** Failed run → triage → draft → validate, then stops at the draft
listing. Look for `Coverage: GAP`, the draft's `[VALIDATED]` state (it passed the requirement
floor), and `Approval: none`. Approval and promotion are deliberately manual:

```bash
DRAFT=$(ls drafts | head -1)
python -m hermes regression promote "$DRAFT"            # refused: APPROVAL_REQUIRED
python -m hermes regression approve "$DRAFT" --approver "$(whoami)" \
  --rationale "Reproduces the late-braking failure at the observed geometry."
python -m hermes regression promote "$DRAFT"            # dry run: shows the plan
python -m hermes regression promote "$DRAFT" --execute  # writes into scenarios/adas/
```

Undo: `rm scenarios/adas/*_regression_*.yaml && rm -rf drafts config/phase8-approvals.yaml`.

**Demo 5 — `make demo-cut-in`.** Two scenarios using the *same* cut-in manoeuvre, differing only
in geometry, classified oppositely with **no change to any ADAS or verifier code** — the oracle
never inspects `challenge.kind`. Then two tests: the pair separates by geometry, and each scenario
*passes* the defect the other catches.

### 3.3 The agent surface

```bash
python -m hermes agent tools                 # catalogue: 6 READ, 1 EXECUTE, 1 MUTATE
python -m hermes agent triage demo-late      # proposal recorded beside the deterministic fact
python -m hermes agent check-citations demo-late   # expect: All N citations resolved and matched.
```

The most important behaviour is a refusal, so see it:

```bash
python - <<'PY'
from pathlib import Path
from hermes.agents.tools import ToolContext, promote_regression
context = ToolContext(repository_root=Path.cwd(), artifact_root=Path.cwd() / "artifacts")
draft = Path("/tmp/draft.yaml")
draft.write_text(Path("scenarios/adas/adas_nominal_no_lead.yaml").read_text())
result = promote_regression(context, draft_id="my-draft", draft_path=draft, dry_run=False)
print("ok:", result.ok); print("error:", result.error.code.value, "-", result.error.detail)
PY
```

Expect `ok: False` and `APPROVAL_REQUIRED` — identically for a scripted agent, a model, or you.

### 3.4 Reading a result

```bash
python -m hermes review-artifact demo-late --artifact-root artifacts --format text
cat artifacts/demo-late/verdict.json | python -m json.tool | head -20
```

| Finding | Asks | Kind |
|---|---|---|
| `adas.aeb.threat_response` | Under a real threat, did it brake and avoid contact? | **hard** |
| `adas.aeb.no_false_intervention` | With no threat, did it stay quiet? | **hard** |
| `adas.aeb.brake_onset_margin` | Did braking begin while stopping was still achievable? | soft |
| `adas.fcw.warning_timing` | Did the run present the declared warning exposure? (not the warning itself) | soft |

Hard failing → `HOLD`. Soft failing → `CONDITIONAL`, held for human review.

### 3.5 Prove it is reproducible

```bash
for i in 1 2 3; do
  python -m hermes run --simulator metadrive --headless \
    --scenario scenarios/adas/aeb_lead_hard_brake.yaml \
    --policy adas-longitudinal --policy-config config/adas/baseline.yaml \
    --gate-config config/gates.adas.yaml --seed 7 --run-id "det-$i" | grep "Trace digest"
done
```

Expect the same digest three times (`8bb1c69b…` at `65363ae`; it changes whenever the scenario or
spawn projection changes, which is content-addressing working). Same host, pinned simulator;
cross-platform identity is an explicit non-goal. Clean up: `rm -rf artifacts/det-* artifacts/demo-late`.

### 3.6 Troubleshooting

| Symptom | Fix |
|---|---|
| `No module named hermes` | `conda activate hermes-dev` |
| `make` refuses with a preflight message | Follow it; it names the exact command |
| A test wants a fixture that is absent | `make fixtures` (needs a clean worktree) |
| A clean clone reports ~144 failures | Expected — §2. `make fixtures`; the residual ~24 need the vendored simulator |
| `run ID must be 1-64 lowercase ASCII…` | Letters, digits, hyphens only — no underscores |
| MetaDrive fails to import | `third_party/metadrive` must be vendored; `make doctor` |
| `IndexError: Replacement index 0 out of range` from `engine_core.py:213` | MetaDrive 0.4.3's headless graphics-pipe detection is intermittently empty. Re-run. Seen on display-less hosts; a retry loop on `IndexError` around env construction works around it |
| A demo exits non-zero | `hermes run` exit codes: 0 PASS · 10 CONDITIONAL · 20 HOLD · 30 INVALID_EVIDENCE · 40 operational. Only 30/40 are failures |

---

## 4. Architecture by layer

### 4.1 Simulation

MetaDrive 0.4.3, vendored and pinned. The adapter refuses to start unless the package version, its
distribution metadata, its import path, the checkout's git HEAD, the recorded `SIMULATOR_COMMIT`
and a hardcoded constant all agree — *and* the tree is clean. Provenance fails closed rather than
being recorded after the fact (`adapters/metadrive.py:77-160`).

Physics runs at a 0.02 s step Hermes imposes rather than inherits; a control frequency is rejected
unless it divides 50 Hz exactly (1, 2, 5, 10, 25, 50), enforced at the adapter, at scenario load
(schema 4.0), and in offline verification that never imports the simulator.

Two challenge kinds: `lead_vehicle_hard_brake` (real MetaDrive vehicle dynamics on a scripted
brake schedule) and `cut_in_near_field` (scripted kinematic replay, actor set static and
repositioned each step, lateral smoothstep). Both carry `behavior_realism_claim: false` as a
literal. Front-object distance and closing speed come from ground-truth bounding boxes, not
perception; absent a challenge they are `NOT_AVAILABLE` with a reason, never zero.

**Honestly scoped:** one straight map block (`map='S'`), zero traffic, no sensor model, 10 Hz,
one seed, five ADAS scenarios. This is a harness with a physics engine attached, not a simulation
stack.

### 4.2 Safety layer and release gate

Three distinct action fields, never collapsed: `candidate_action` (policy proposed),
`permitted_action` (shield allowed), `executed_action` (actually ran). The deterministic shield
(Phase 3) has six ordered reasons — `TTC_BELOW_THRESHOLD, SPEED_CAP, STALE_OBSERVATION,
BOUNDARY_RISK, EMERGENCY_STOP, ACTUATION_DELAY_COMPENSATION` — and its decisions are replayed
exactly in verification.

The release gate (`gates/release.py:319-378`) is an **ordered, non-compensatory** chain of eleven
branches with no score, weight or average anywhere in it:

```
01 trace invalid or inconsistent ─── INVALID_EVIDENCE
02 safety evidence missing ───────── INVALID_EVIDENCE
03 collision ─────────────────────── HOLD
04 road boundary ─────────────────── HOLD
05 fault coverage incomplete ─────── HOLD
06 mission progress ──────────────── HOLD
07 any other hard invariant ──────── HOLD
08 any soft criterion ────────────── CONDITIONAL
09 otherwise ─────────────────────── PASS
```

Hard invariants are `Literal`-typed in the gate config (`max_collision_count: Literal[0]`), so
configuration cannot relax them. Missing evidence is a first-class `NOT_AVAILABLE` tri-state.
Branch 07 exists because of a real fail-open found in Phase 8 (§9). Its correctness depends on
`EXPLICITLY_ORDERED_HARD_FINDING_IDS` being kept current by hand — "enforced by construction plus
one hand-maintained convention", not by the type system.

Verifier profiles — `LEGACY`, `FAULT_COVERAGE`, and two ADAS profiles — are matched for **exact
equality** of their finding set; a missing expected finding is as fatal as an unknown one.

### 4.3 Evidence

Every run writes a ten-file bundle: `manifest.json, execution-context.json, scenario.resolved.yaml,
gate-config.resolved.yaml, events.jsonl, metrics.json, findings.json, verdict.json, trace.sha256,
bundle.sha256`. `events.jsonl` is SHA-256 hash-chained from a genesis hash; digests bind scenario,
gate config, policy config, adapter config and fault config. Evidence schema 1.0 and 2.0 (2.0
adds `permitted_action`, fault evidence, `result_observation`); scenario schema 1.0–4.0; gate
config 1.0–2.0; review envelope 1.0.

Re-verification recomputes the shield, fault transforms, metrics, every verifier and the gate
from stored bytes. **It does not re-run the simulator or the policy.** Hashing detects partial
edits and nothing more; anyone who can rewrite a whole bundle can recompute every digest —
`AuthenticityStatus` is permanently `NOT_AUTHENTICATED`.

### 4.4 Faults, comparison, review

Seven deterministic fault transforms (observation delay/drop/freeze/noise, control delay,
steering/brake saturation) with a coverage verifier that forces HOLD when a configured fault never
fired. Baseline-vs-candidate comparison partitions dimensions into improved / regressed /
unchanged / not-comparable — no winner — and fails closed on identity mismatches unless one
**declared variation axis** explains them (Phase 8, core comparator only; the review-envelope
path still uses the strict rule). A read-only Streamlit Evidence Review Workbench (Phase 6)
renders envelopes; its read-only property is enforced by AST tests.

---

## 5. History: Phases 0–9

| Phase | Delivered | Where it lives |
|---|---|---|
| 0 | Package skeleton, `hermes doctor`, Makefile, `SIMULATOR_COMMIT` | `main` @ `c181509` (2026-08-11) |
| 1 | Deterministic evidence core: models, scenario 1.0, gate 1.0, evidence 1.0, hash chain, ten-file bundle, gate, `run`, `verify-artifact` | `feat/unattended-evidence-core` |
| 2 | MetaDrive adapter 1.0, IDM policy, `sim-smoke`; verification never imports the simulator | ″ |
| 3 | Deterministic shield 1.0, scenario 2.0 (challenges), challenge adapter 1.1, `compare` | ″ |
| 4 | Fault injection 1.0, scenario 3.0, evidence 2.0, fault-coverage verifier, CI, error envelope | ″ |
| 5 | Contract closure: closed `VerifierProfile`, `simulator_support.py`; 273 tests | ″ @ `9e257a0` |
| 6 | Review envelopes 1.0, `review-artifact`, `review-compare`, Streamlit workbench; reviewer-comprehension iteration; 756 tests | `feat/phase6-evidence-workbench` → `feat/phase6-reviewer-comprehension` @ `4eb8765` |
| 7 | Evaluation-adequacy assessor, evaluation plans, provenance; 1,245 tests claimed | **codex worktree only** — `codex/phase7-…` @ `9d5c0ba`, 56 commits, **not merged** |
| 8 | ADAS (FCW/AEB) + oracle + seeded defects + agent layer + regression flywheel; 965 tests; then calibration (merged `6b2f375`), Phase 3 (merged `a78287e`), and **evidence schema 3.0 / `RunMetricsV3`** (complete, unmerged) | trunk `feat/phase8-adas-lab` @ `e6e2c8c`; metrics V3 on `feat/phase8-metrics-v3` @ `2dda024` (15 commits from `a78287e`, pushed, unmerged) |
| 9 | Fleet simulation — **FLEET-005 spike built**: contracts, world tape, minimal DES, paired loop, decision record; 33 tests incl. a hand-computed analytical fixture, clean-clone green | `feat/phase9-fleetlab` @ `00b2a48`; PRD stays local |
| 9P | FleetLab Playground: verdict core with FleetLab-generated vectors; legacy port with event-log parity; teaching model (tables, routes, world, engine, metrics, invariants, experiments); interface with Experiment and Learn; offline packer; the recall acts once and the default fleet was calibrated after a browser run exposed depot gridlock | `feat/fleetlab-playground`; pushed as a branch (first on 2026-09-18, fast-forwarded on 2026-09-28), not merged to `main` |
| 9Q | FleetLab Playground, operations casebook and hosted folder (2026-09-14 and 2026-09-15): twenty preregistered situations in five themes as Experiment presets of kind `ops`, proxies built from the knobs, slugs frozen with their measured verdicts, every seed set 1 verdict pinned and sets 2 and 3 behind a flag, lessons in design §4.4 and never on the page; `pack.mjs --site` writes a folder for a static host and `check-dist.mjs --site` checks it | `feat/fleetlab-playground`; committed later and pushed with the branch, not merged to `main` |
| 9R | FleetLab Playground, map motion phases 1 and 2 (2026-09-15): one map model and one playback frame per drawn frame shared by the map, the NOW panel and the announcer, and a table twin watched value by value instead of by a stringified model; then a cars layer drawing every car on a route as its own mark, with a measured route fallback that keeps a flow band where a corridor is too short and writes the reason, the map's first model-limits chip and a second legend line. No CSS transition, animation, keyframe or `will-change` anywhere; reduced motion uses the existing `interpolate: false` path. Phases 3 (bay cells in the depot tile) and 4 (a day-long bar under the scrubber) are approved but not built | `feat/fleetlab-playground`; committed later and pushed with the branch, not merged to `main` |
| 9S | FleetLab Playground, the isometric world and the Present walkthrough (2026-09-16, the demo plan's phases A and B): a Canvas 2D isometric schematic of the four areas generated at run time from the interval log, with flat platforms, ribbons, one shaded box per car on a route, cubes of five for cars that stand, depot blocks with bay cells (where the motion plan's phase 3 landed), lot fills and written coincidence counts grouped in model space, an HTML overlay carrying every word and the map's twenty roving stops, and the flat SVG schematic kept as the test default, the header toggle and the no-context fallback; then `Present`, a layer over the three modes with its own store key, walking four chapters and eleven beats over one replay of the casebook's OPS-01 behind one `Prepare` and one `Next`, with the depot table taken from the drawer's own reading and the verdict readout composed from the verdict card's own builders. Phases C (the candidate arm drawn in the world with an `A | B` toggle, the day bar, a second seed set beat) and D (the phone polish and the `Try it` handoffs) are approved and deliberately not built, with no scaffolding left for them | `feat/fleetlab-playground`; committed later and pushed with the branch, not merged to `main` |

Design decisions from early phases that still constrain everything: MetaDrive stays external and
unmodified; every event hashes scenario/gate/component digests; hard invariants cannot be
compensated; stored verification is the sole authority and the review layer is a one-way consumer
of it; compatibility fails closed. Phase 5 is labelled differently across older documents
(`CURRENT_STATE_HANDOFF.md` folds it into Phase 4's commit; the codex branch calls it "evidence
contract closure") — the table above follows the commits.

### 5.8 Phase 7 — read-only, unmerged, unaccepted

Lives only at `…/.codex/worktrees/Hermes/phase7-evaluation-adequacy-human-validation` on
`codex/phase7-evaluation-adequacy-human-validation` (pushed, clean tree). Adds
`adequacy/`, `evaluation_plans/`, `provenance/git.py`, `adapters/metadrive_config.py`, the
`assess-adequacy` command, `EvaluationAdequacyEnvelope` 1.0, five protocol versions. Results:
protocols v1–v3 found nothing over 65 attempts (a ~3.11 s TTC floor attributed to IDM
`MAX_LONG_DIST = 30`); v5 `ADEQUATE` at a 4.0 s threshold. **Status: 7A built, not owner-accepted;
7B human validation `BLOCKED`.** Merge-base with Phase 8 is `4eb8765`; Phase 8 contains zero
Phase 7 files. Do not check out, merge, rebase, modify, or consume its adequacy machinery.

### 5.9 Phase 8 — what was delivered, by sprint

- **Sprint 0 — baseline audit** (`PHASE8_BASELINE_AUDIT.md`, 1,108 lines): twelve PRD §38
  answers, every §0-A reference verified, ten-risk register, duplication map, immutable contract
  set.
- **Sprint 0.5 — contract hardening:** the gate fail-open fix (`235efec`); import-provenance guard.
- **Sprint 1a — foundations:** scenario schema 4.0 (`3d90c91`) — first to permit challenge +
  faults together, adds `tags/odd/adas/requirements`, moving ego spawn (`ad922fc`); trace-layer
  version gates (`f7e9025`); fixture registry and `hermes fixtures list|regenerate|verify`
  (`10343bf`).
- **Sprint 1 — FCW/AEB:** `src/hermes/adas/` (`dd30b9b`); `verifiers/adas.py` oracle, gate-config
  2.0, two ADAS profiles, one profile selector (`a6abe7f`); CLI policy registry.
- **Evaluation acceptance:** seeded-defect suite and physics-derived onset criterion (`55c1fdd`).
- **Agentic layer:** tool catalogue, permission tiers, budgets, approvals, triage (`ecde47a`);
  checkable citations (`df802de`).
- **Comparison:** declared variation axis (`801d38d`).
- **Flywheel:** `src/hermes/regression/` end to end (`cdb4637`).
- **Scenarios:** `aeb_lead_hard_brake`, `adas_nominal_no_lead`, `adas_nominal_slow_closing`
  (`ed92f5b`); `adas_cut_in_near`, `adas_cut_in_far` + generalisation test (`176bfdb`).
- **Corrections:** binary32 projection assert (`922d5d1`), float32-derived tolerance (`65363ae`),
  review-surface ADAS rendering and `make` interpreter guard (`f38d885`), README/status
  corrections found by outside audit (`0c16c8f`).

Deep references: [PHASE8_DESIGN_SPEC.md](docs/hermes/phase8/PHASE8_DESIGN_SPEC.md) (why),
[PHASE8_IMPLEMENTATION_NOTE.md](docs/hermes/phase8/PHASE8_IMPLEMENTATION_NOTE.md) (what was forced by the code),
[PHASE8_BASELINE_AUDIT.md](docs/hermes/phase8/PHASE8_BASELINE_AUDIT.md) (the risk register §11 cites).

---

## 6. ADAS in depth (Phase 8)

### 6.1 The functions

Forward collision warning and automatic emergency braking, as an ordinary `DrivingPolicy`
(`adas/functions.py`, `adas/policy.py`). AEB stages on **required deceleration**,
`a_req = closing² / (2 · usable_gap)`, not time-to-collision: a braking lead makes TTC optimistic
exactly when it matters, so a TTC-staged AEB intervenes late in the flagship scenario. A test pins
two situations with identical 2.0 s TTC that stage differently. Staging thresholds are fractions
of `ControlConfig.max_braking_mps2` (default **6.0**, which is an *unmeasured* number — §6.8).
`DriverConfig.max_brake` defaults to zero so every brake command in a default run is
AEB-attributable by construction. AEB release requires positive evidence — a distance margin *and*
a TTC margin.

### 6.2 The oracle

`verifiers/adas.py` recomputes threat labels from the stored trace against thresholds in
`config/gates.adas.yaml` (`threat_authority_fraction: 0.3`, `onset_authority_fraction: 1.0`,
`oracle_standoff_m: 2.0`) — a *separate* file from the controller's own fractions (0.4 partial
brake), so a controller cannot pass by being configured to agree with itself. It never inspects
`challenge.kind`; it works from gap and closing speed alone, which Demo 5 tests.

Known limit: threat labels come from the *realised* trace, which the controller shaped. An early
intervention can prevent the threat from appearing, which would convert a correct intervention
into a "false" one; the mitigation is that the scenario's *declared* expectation decides whether
false-intervention exposure applies. Labelling from omniscient simulator state is the stronger
answer and is not implemented (design spec Q7).

### 6.3 The seeded-defect suite — the evaluation's own acceptance test

`config/phase8-seeded-defects.yaml`: each entry names a controller, the scenario that exposes it,
the finding that must catch it, and the triage category that must be proposed. The test
parametrises from the YAML at collection time so spec and test cannot drift.

| | `baseline` | `defect_late_braking` | `defect_no_aeb` | `defect_over_braking` |
|---|---|---|---|---|
| `aeb_lead_hard_brake` (threat) | pass (onset at 50%) | `brake_onset_margin` (108%) | `threat_response` | — |
| `adas_nominal_slow_closing` | pass | — | — | `no_false_intervention` |
| `adas_cut_in_near` (threat) | pass (46%) | `brake_onset_margin` | **`threat_response` → HOLD** | pass |
| `adas_cut_in_far` (nominal) | pass (<1%) | pass | pass | **`no_false_intervention` → HOLD** |

Three controllers, five cases — not five controllers. The cut-in rows show each scenario *passes*
the defect the other catches, which is what makes a pair worth its simulation time.

### 6.4 Scenarios against the P0 catalog

The Phase 8 PRD P0 catalog is **22 named entries plus four nominal entries** (§0-A amendment 6)
— not 12, as an earlier handoff claimed. Committed: five, of which three match named entries
(`lead_hard_brake` #3, `cut_in_near` #5, `cut_in_far` #6); the two nominal scenarios satisfy the
≥30% threat-free exposure *requirement* without matching named entries. Both cut-in scenarios end
at `DESTINATION_REACHED` after 6–8 s, so `horizon_steps` overstates real exposure.

### 6.5 The agent layer

**There is no language model in this repository.** `AgentRuntime` is a one-method Protocol — the
seam a model would sit behind — and `ScriptedAgent` is a deterministic stand-in. What exists is
the substrate: eight tools (6 READ / 1 EXECUTE / 1 MUTATE) with `dry_run=True` the default on both
non-READ tools; one `ToolResult` envelope with a closed error vocabulary and a constructor
invariant that forbids a failure presenting as an empty success; a budget ledger; citations that
`check-citations` re-resolves; the agent's proposal recorded **beside** the deterministic
classification. `promote_regression` refuses without an approval bound to the SHA-256 of the
draft's exact bytes, so an edit after approval invalidates the approval.

**Honestly scoped:** the refusal lives in the function rather than a prompt — the interesting
part — but it is a boundary, not a sandbox. The registry path is a caller-supplied argument;
filesystem write access bypasses the tool. No model has ever exercised the path. Triage is a
straight-line sequence of four tool calls. Triage accuracy 5/5 is near-tautological (the scripted
agent shares the classifier's mapping — design spec Q4).

### 6.6 The regression flywheel

`failed run → triage → draft → validate → approve → promote → rerun`. `regression/builder.py`
derives a scenario from the trace geometry at the failing event, assesses coverage against the
committed suite (±5 m gap, ±2 m/s speed, same kind and expectation), and `floor.py` enforces that
a draft may add coverage but never subtract it — closing the channel where a proposal that reads
as added coverage quietly drops an expectation. `approve` is a separate verb from `promote`
(deliberate deviation from PRD §0-A.9.7 so the promoter cannot self-approve). The derived case
discriminates: HOLD for `defect_late_braking` (a_req 6.83 m/s², 114%), CONDITIONAL for baseline
(2.71, 45%).

### 6.7 Two things not to misread

**The late-braking HOLD is not driven by the ADAS finding.** On `defect_late_braking`:
`progress.required` (hard) FAILS and drives HOLD; `adas.aeb.brake_onset_margin` (soft) FAILS and
*detects* the defect but alone would yield CONDITIONAL; `threat_response` PASSES — it did brake
and avoid contact. Whether late-but-successful braking should be hard is open (§13).

**`adas.fcw.warning_timing` does not verify a warning.** The trace has no field for the warning
signal; it confirms only that the run presented the declared closing geometry.

### 6.8 Calibration — measured (2026-08-24), with one honest nuance

The debt in the old version of this section is paid. `evidence/calibration/
metadrive-brake-curve-0.4.3.json` (on `feat/phase8-adas-lab`) measures full-brake deceleration
at 14 entry speeds, 4–30 m/s, N=3 bitwise-identical per speed with the three trace SHAs
recorded per entry. At 20 m/s: peak **12.9824 m/s²**, steady **11.5319**, stopping **17.709 m**.
Construction: each committed ADAS scenario now *declares* the measured authority
(`max_braking_mps2: 12.982444763183452`, digest-bound, curve-cited); every oracle/controller/
defect fraction was re-derived in lockstep so all absolute boundaries are bit-identical to
before; the Python default stays 6.0 and a test fails if it moves. Cross-backend: a MuJoCo
3.12 reference instrument disagrees materially (MetaDrive peak 2.26× MuJoCo) — kept as
falsification evidence, not parity. A Warp CPU kernel cross-checks sensitivity
(∂d/∂a = −d/a reproduces the measured steady authority exactly).

**The nuance an adversarial review pinned (keep saying it):** the *authority* is measured; the
*margins* (1.8, 6.0, 2.4/4.2 m/s²) are inherited pre-calibration choices, now explicitly
relabelled as a simulator-relative evaluation boundary rather than a physical stopping limit —
the verifier docstring no longer claims "physically meaningful rather than tuned". Comfort
enforcement was deliberately not added (a full-brake curve is not a command-to-deceleration
map); the decision is recorded in the artifact (`control_config_decision`).


---

## 7. MuJoCo sandbox and Phase 9 fleet simulation

### 7.1 Phase 9 — what the PRD is and is not

`HERMES_PHASE9_FLEET_SIMULATION_PRD.md` (2,769 lines, "Hermes FleetLab", status "Design
proposal / implementation handoff", tracked since `aa04786`). Question: *how can internal teams safely
and quickly evaluate offboard fleet and operational changes before launch?* Thesis (L78): **the
right simulation is the lowest-cost model with enough fidelity to answer the decision.**

Four lanes (§7): Lane 0 analytical/unit fixtures (no priority tag); **Lane 1 FleetLab
discrete-event simulation — the primary Phase 9 lane**; Lane 2 MetaDrive, consumed as summary
distributions via a **P1** parameter bridge (live per-trip coupling forbidden in P0); Lane 3
MuJoCo for contact/actuator/articulated physics, bridge **P2**, "should not be used as a generic
ride-hailing fleet engine" (L511). A non-AI fidelity router maps question type to lane (§7.5).

Relationship to Phase 8: **sits beside it as an additive domain.** The PRD proposes a new
`src/hermes/fleet/` tree (§37) with its own `FleetSimulationBackend` Protocol (§38), a separate
"FleetLab schema version", its own outcome semantics (§20: "do not reuse the AV safety verdict
blindly", `deployment_permission: NONE`), and says explicitly: do not force FleetLab through or
mutate `SimulatorAdapter` (L2200, L2235); reuse evidence/publication/review *principles*, not the
vehicle-action schema; land Phase 8 first (§47). **It proposes zero new `ScenarioDefinition`
fields, zero new `adapter` Literal values, and no `evidence_schema_version` change.** It consumes
MetaDrive-derived parameters, not Phase 8 ADAS evidence. Principle 18 (L228), "physical authority
is measured, not assumed", is one line; §6.8 here is its only operationalisation. There is no risk
register. Six P0 fleet scenarios (FLEET-001…006), 20 P0 / 10 P1 / 8 P2 acceptance criteria,
48-hour MVP (§45), one-week build (§46). **Built 2026-08-23 (the narrowed spike from the external design review):** `src/hermes/fleet/`
on `feat/phase9-fleetlab` — preregistered `ExperimentSpec` (single variation axis, primary
metric with an equivalence margin, guardrails, frozen seed set) and a `DecisionRecord` bound to
spec/world-tape/seed-set digests; a materialized, hashed world tape (demand fixed across
replications; per-request travel disturbances vary by seed, keyed to the request, never the
chosen vehicle); the thinnest DES expressing FLEET-005 (nearest dispatch, depot bays); the PRD §17
invariants that have referents in this model (8 of 12 — the three charging-related ones await
the charging model; replay determinism is the `run_experiment` precheck), where any violation
yields `INVALID_EXPERIMENT` with no partial outcome; a seeded
double-assign dispatcher caught by the invariant that names it; bootstrap CI over paired
replications; a non-compensatory recommendation (guardrail regression HOLDs an IMPROVED
primary); an analytical fixture whose three-request world is computed entirely by hand and
asserted exactly, plus a metamorphic service-delay case; `hermes fleet demo` (~0.5 s).
Measured demo result: baseline healthy, +25% turnaround
→ REGRESSED, CI [+736, +919] s on wait p90, guardrail hit → HOLD. Stage 1 (Task 6 at `6983198`,
closing docs at `f2645ae`) measured **76 passed** in Gate G; the forward-only repair `f0e4ded`
measured **79 passed** and the handler-coverage tests `aa8f406` measure **81 passed**
(`pytest tests/unit/test_fleet_*.py tests/unit/test_import_provenance.py -q -p no:cacheprovider`);
all are simulator- and fixture-free. The full suite in this worktree is artifact-bound and is
not a pass/fail claim: `186 failed, 1330 passed, 55 deselected, 42 errors` (`pytest -q -m "not
metadrive" -p no:cacheprovider`) with the failing node set identical to `aa04786`
(`SAME_FAILURE_SET`) — the earlier "761→794" figure described the spike-era worktree and is
superseded. **80/80 from a clean clone of `aa8f406` on 2026-09-04** — a fresh clone of the
branch and a fresh virtualenv holding only pydantic, PyYAML, rich, typer and pytest;
`pytest tests/unit/test_fleet_*.py -q -p no:cacheprovider`, the fleet files alone, hence one
fewer than Gate G (78/78 at `f0e4ded` the same day; 75/75 at `6983198` on 2026-09-03) —
**decision-record digest bit-identical across checkouts.** Everything else in
the PRD (charging, FLEET-001..004/006, policy SDK, forecast seam, Studio, experiment registry) remains
unbuilt.

**Stage 1 measured 2026-09-03:** the typed metric registry now binds the producer, experiment
layer, authoring validator, and `metrics list` output; the committed FLEET-005 YAML is the in-code
spec by digest; and `hermes fleet experiment template`, `validate`, `run`, and `inspect` provide a
strict, bounded spec-file path. The demo record remains
`84ff1c91b600f29e3d3661d988339e1654db419d6ba500e7d79e616a58706e7f`. Since then, Task 7 records
the registry version and Task 8 provides the static operator view; deliberately not built:
`MetricComparison.metric` is not validated against the registry; descriptive order is not aligned
to producer order; guardrail metrics are not excluded from descriptives; aliases are still
reported beside their targets; and `unserved.fraction = 0.0` on an empty population is unchanged.

**Stage 1 repair, measured 2026-09-04 (`f0e4ded`, forward-only; no history rewritten):** the
five-line authoring envelope's `WHY` line echoed the resolved path carried by an `OSError`, so
`hermes fleet experiment validate config/fleet/does-not-exist.yaml` printed the expanded home
directory although the caller gave a relative path. The three `OSError` sites in
`src/hermes/fleet/authoring.py` now report `exc.strerror` (or the exception type when there is
none) and name the file only as it was given; `SpecAuthoringError.source`, the five lines, exit
code 40 and both pinned digests are unchanged (`DEMO_BYTE_IDENTICAL`). Three tests pin it —
`test_a_missing_spec_is_named_only_as_given`, `test_a_missing_record_is_named_only_as_given`
(a tilde path with `HOME` patched) and `test_experiment_errors_name_a_missing_file_only_as_given`
(`validate` and `inspect`) — each asserting the reason via `os.strerror(errno.ENOENT)`, so a
blank `WHY` line fails them (verified against a copy of the module with `why=""`). Those three
all meet `ENOENT` at `stat()`, so they exercise only the `stat` handler in `_bounded_source`;
`aa8f406` (tests only, no production change) adds
`test_a_spec_read_failure_after_stat_is_named_only_as_given` — a relative spec file passes `stat`
and `Path.read_text` raises an `OSError` carrying the resolved path, reaching the `read_text`
handler in `load_experiment_spec` — and `test_a_record_read_failure_after_stat_is_named_only_as_given`
— a tilde record path with `HOME` patched and `Path.read_bytes`, reaching the `read_bytes` handler
in `load_decision_record` — each pinning `os.strerror(errno.EACCES)`. Measured with single-site
mutants (a copy of the module with one handler restored to `why=str(exc)`): the `read_text`
mutant fails only the spec read-failure test, the `read_bytes` mutant only the record
read-failure test, the three earlier tests survive both, and a `stat` mutant fails all three of
them while both new tests pass — the gap those two close.
Deliberately not changed: the `resolve()` failure site still reports the exception text (a
symlink-loop `RuntimeError` can name a resolved path; two Stage 1 tests pin that text), and the
size cap still `stat`s before reading — the stat-to-read window stays open and descriptor-bounded
reading is a separate task, as it is for `scenarios/loader.py`, which follows the same pattern.

**Task 7, measured 2026-09-04 (`3a7f595`):** the FLEET-005 decision-record digest deliberately
moved from `84ff1c91b600f29e3d3661d988339e1654db419d6ba500e7d79e616a58706e7f` to
`a61950c0ad3b960db1d3c55ff2704ed4a0ab99268330ab2c15ff313bc340aa2f` because every
`DecisionRecord` now records the required metric-registry version; `DecisionRecord` schema is 0.2,
while `ExperimentSpec` and `FleetScenarioConfig` remain 0.1. The `3a7f595` commit body omitted the
required note that `README.md:64` still carried the before digest; this forward-only documentation
commit corrects that undated live output.

**Task 8, measured 2026-09-04 (`4b2e8b8`; repairs `18b47db`, `e42ed2c`):** the static operator view
projects the completed FLEET-005 baseline through the metric registry in registration order,
preserves declared absence reasons, and is loopback-only. It renders one finished synthetic run,
not monitoring or a time axis; the decision-record Comparison page remains open. The FLEET-005
record digest remains
`a61950c0ad3b960db1d3c55ff2704ed4a0ab99268330ab2c15ff313bc340aa2f` and the spec digest remains
`b68f75d295e4ace1c4f3e470e52fde828a8b433eec2682f66596dbebbd5360c2`.

**STOP 2 clean-clone verification, measured 2026-09-04 (`e42ed2c`):** Gate G measured `96 passed
in 2.05s`. The artifact-bound suite measured `186 failed, 1345 passed, 55 deselected, 42 errors in
13.90s` with the same 228 failure/error nodes as `aa04786` (`SAME_FAILURE_SET`), explicitly not a
pass/fail claim. A fresh core-only clone measured `94 passed, 1 skipped in 1.98s`; the sole skip was
the optional Streamlit-dependent render test absent from that environment. It reproduced the full
record digest `a61950c0ad3b960db1d3c55ff2704ed4a0ab99268330ab2c15ff313bc340aa2f` bit-identically.

### 7.2 MuJoCo sandbox — what exists

`sandbox/mujoco/` — gitignored (`.gitignore:50`), never committed on any branch, every record
labelled NOT EVIDENCE. Pinned `mujoco==3.12.0`, `matplotlib==3.11.1`, numpy 2.4.6; macOS arm64,
Python 3.11.15; the sandbox venv has no pydantic and cannot import `hermes`. All outputs under
`sandbox/mujoco/out/`. Determinism claims are same-host/same-version only.

| Experiment | Established |
|---|---|
| A `smoke_test.py` | 1,000 headless steps, ~22.9 µs/step (~87× realtime; varies), 0 warnings across all 7 `mjtWarning` counters |
| B1 `exp1_contacts.py` | dt × solref grid; **`refsafe` silently clamps solref timeconst to `max(t, 2·dt)`**, so "tight" contact at dt 0.010 behaved exactly like default — contact stiffness that changes with timestep is this clamp |
| B2 `exp2_cart.py` | `ctrlrange` clamps the command silently (`data.ctrl` still reads back the over-range value); `forcerange` is in actuator space before `gear`; damping matches closed form to 3 decimals |
| B3 `exp3_scenario.py` | Full replay bit-identical; restart from **`mjSTATE_INTEGRATION`** (111 floats, incl. `qacc_warmstart`) bit-identical; restart from qpos+qvel (41 floats) drifts ~8e-14 — invisible in trajectory, **breaks a content-addressed digest**; seed change diverges from step 0 |
| `pilot_adapter.py` + `pilot_conformance.py` | 1-D longitudinal AEB lead-hard-brake (1400 kg ego, lead on kv=30000 velocity servo, dt 0.01 Euler, autoreset off); all 9 `SimulatorAdapter` members present by kind, exact field-name parity on Action(3)/VehicleState(8)/Observation(10)/VerifierFacts(6)/StepResult(5), checked by **AST over the real `contracts.py`/`models.py`**; two seed-7 episodes yield identical digests |
| `metadrive_brake_probe.py` | The brake measurement in §6.8 |

**Honestly scoped:** `isinstance` conformance was checked against the pilot's *own mirrored*
`runtime_checkable` Protocol (whose `reset` takes a `PilotScenario`), not the real class; the real
files were checked by AST name/kind only, and the recorded SHA-256s of `contracts.py`/`models.py`
are recorded, not asserted. The pilot ignores steering, models no lateral/offroad/ODD, and
`simulator_commit` is `None` (pip wheel). No test, CI step, Makefile target, gate, scenario YAML,
artifacts bundle or pydantic model exists for it; `ruff check sandbox/mujoco` explicitly reports
19 errors (the root `ruff check .` passes because ruff honours `.gitignore`).

**Sim-consult review verdict: Sound** (no sev-1/2). Recorded, not applied: sev-3 `armature=0` on
every geared actuator, the kv=30000 lead must be labelled scripted-kinematic, `Euler` →
`implicitfast`; sev-4 **`fwdinv` never enabled** ("bit-identical ≠ correct" — the single
highest-leverage change), warmstart fine for replay but disable for parallel sampling; sev-5
pyramidal cone, D3 conflates scenario change with chaos.

### 7.3 MuJoCo — the open questions before anything graduates

From `SIMULATION_DESIGN_PACKAGE.md` §6 (all open, owner unassigned): **Q1** the niche — the first
question MuJoCo answers that MetaDrive cannot; **Q2** a `MujocoScenario` contract reviewable like
schema 4.0; **Q3** graduation gates into `src/` (candidates: named scenario family, owner, test
budget, pinned dependency); **Q4** physics defaults frozen at graduation (`implicitfast`,
armature, `fwdinv` + residual, autoreset off); **Q5** one "measured, not assumed" rule for both
the MetaDrive brake debt and MuJoCo contact softness; **Q6** cross-backend claims compare
distributions, not trajectories; **Q7** how the agent layer proposes MuJoCo scenarios under the
same deterministic check. The PRD (§44, §47 step 7) requires "a named buyer/question" before the
MuJoCo bridge leaves P2.

**Correction to an earlier alignment document:** widening `adapter: Literal["fake","metadrive"]`
is a *MuJoCo-graduation* item (sandbox NOTES §3 lists it first), not a Phase 9 fleet-bridge item
— the fleet bridge is parameters, not an adapter. Widening the Literal is digest-neutral (§12
landmine 1 explains why); what ships alongside it is not.

### 7.4 The one genuine overlap between Phase 8 and Phase 9

The brake-authority measurement (§6.8), transferring **one direction, as data, not as a code
change**. Phase 8's largest weakness is an unmeasured authority; Phase 9 needs a real
decel-vs-speed curve for its MetaDrive→FleetLab bridge; the sandbox holds the only instrument.
What should transfer: a probe on the scenario-faithful config producing points at 20 m/s. What
must not: the number as a default edit (§10 rule 3).

---

### 7.5 FleetLab Playground (teaching model, not evidence)

**Performance release, 2026-11-10 (current, published):** source `0b0fb05`, production `d477d470`, merged into `main`. It removes the mount layout shift on the studio routes and static pages, keeps hidden routes from fetching their images, slices the Street lab run, and stops the methodology explainer while off screen. See the November 10 section.

**Design-review release, 2026-11-08 (historical, superseded 2026-11-10 by `d477d470`):** source `5a4dafb`, production `9de52270`. It follows five releases, all built on `codex/fleetlab-ux-impl-20261104` and not yet on `main`: `4b039be` (`1dfb0f22`, 2026-11-08), `e3a5f0c` (`ba603536`), `ceb3d25` (`36954b5c`), `57dd67e` (`e5424a33`) and `de80555` (`79489c69`, 2026-11-04). See the November 8 section.

**Tile art, 2026-11-02 (historical, superseded 2026-11-04 by `79489c69`):** source `94a201f`, production `cdf2bd6e`; four question-family tile images replaced; it follows the catalog lines release, source `8d2c7ac`, production `9e85c9cc`. See the top section.

**Catalog lines, 2026-11-01 (historical, superseded 2026-11-02 by `cdf2bd6e`):** source `8d2c7ac`, production `9e85c9cc`; it follows the October 31 release, source `9dfc6bc`, production `c743621d`. See the November 1 section.

**Corrected lesson copy and site date, 2026-10-31 (historical, superseded 2026-11-01 by `9e85c9cc`):** source `9dfc6bc`, production `c743621d`; it follows network-flows Step B. See the November 1 section.

**Network-flows Step B, 2026-10-27 (historical, superseded 2026-10-31 by `c743621d`):** source `848b420`, production `ac431ba3`; it follows the Depot Readiness lab release, source `a1b79cd`, production `72e45e9f`.

**Depot Readiness lab, 2026-10-24 (historical, superseded 2026-10-27 by `ac431ba3`):** source `a1b79cd`, production `72e45e9f`; it follows the October 23 enhancement release, source `d0df87f`, production `85b02be2`.

**Security and release hardening, 2026-10-23 (historical, superseded 2026-10-23 by `85b02be2` and 2026-10-24 by `72e45e9f`):** source `2d01b25`, production `4fd751ea`.

**Audit response, 2026-09-28 (historical):** Source `e90764a99661a579de3dc976afedc45e7417f49a`, Production `f4018c2a-3127-4807-af90-3a4ae0f33faa`, https://fleetlab.pages.dev/ and https://f4018c2a.fleetlab.pages.dev/. The owner authorized evaluation, supported implementation, validation, push and publication; the external audit’s instructions and business assumptions were treated as review material. Clear simulation-first welcome, Scale lab in seven-link navigation, consistent Four-area experiments naming, first-run guidance moved earlier, project-level provenance and selected 11px captions. Float artifacts were not reproduced; reduced motion and progress/cancel already work. No model, runtime, data, numerical pin or dependency change. Final performance-enabled serial suite: 1,973 tests, 1,972 pass, zero failures, one existing TODO, 284.799 s. Earlier full-run and isolated timing failures, plus the passing baseline/candidate comparison, are retained in the handoff. Python parity/boundaries: 89 pass; Ruff and whitespace pass. Hosted 99 files / 3,366,216 bytes; offline 2,424,861 bytes (+101); both checks pass and committed-source reconstruction matches. All 98 public files and six configured headers match on both addresses. Painted viewport checks span 375, 390, 768, 1101 and 1440px locally. Production checks reproduce intake `scale-spec:1aa8c833` and Fleet day 95/284, with correct navigation, naming and focus. Source pushed without force from local `codex/fleetlab-welcome-design` to `github/feat/fleetlab-playground`, advancing `756c269` to `e90764a`; release-record follow-up changes no site input. No PR or main merge. Rollback `1e1202c9` (source `347bcfb`). Q1 partial, Q8 queued, N2 design-only. Full assessment, commands, negative results and limits: [CODEX_HANDOFF.md](docs/archive/phase6-pack/CODEX_HANDOFF.md), current top section.

**Welcome redesign, 2026-09-28 (historical):** Source `347bcfbd3dc20b830f1a59eeda3fc80403d894d0`, Production `1e1202c9-4fa0-4b46-a5f7-22863b48aafb`, https://fleetlab.pages.dev/ and https://1e1202c9.fleetlab.pages.dev/. The current request authorized visual enhancement, validation and deployment of the existing static site. Ivory/teal surfaces, welcome/film composition, compact phone navigation and keyboard-accessible result regions; six destinations and 59 lessons remain. Protected model/instrument/runtime/data code and pins unchanged. Final performance-enabled serial run: 1,973 tests, 1,972 pass, zero failures, one existing TODO, 280.65 s. Python parity/boundaries: 89 pass; Ruff and whitespace pass. Hosted 99 files / 3,366,116 bytes; offline 2,424,760 bytes, growth 16,410. Both distribution checks pass. Rebuild from committed export equals both packages; 98/98 public files and all configured response headers match on both deployment addresses. Painted checks at 1440x900, 375x812, 768x1000 and 900x1000; all three Scale defaults, held intake, Fleet day, Street comparison, four-area comparison, catalog and film controls exercised. Independent review's tablet issue fixed and re-reviewed. Q1 remains partial; no CPU-throttled phone, physical phone, Safari/Firefox, screen-reader or full painted lesson-sweep claim. Q8 remains queued. Local branch `codex/fleetlab-welcome-design`; no push, PR, backend or dependency. Rollback `77922688` from `1aeaace`. Detailed commands, digests and limitations: current top section of [CODEX_HANDOFF.md](docs/archive/phase6-pack/CODEX_HANDOFF.md). The records-only follow-up does not change site input.

The following dated entries are historical; where they differ from the current release (the tile art, source `94a201f`, production `cdf2bd6e`, first entry of this section), the current release governs.

**Owner's answers, heading fix release and push, 2026-09-28 (deployed, pushed):** The owner answered the four questions of section 7.0 of the FleetLab handoff (top section of [CODEX_HANDOFF.md](docs/archive/phase6-pack/CODEX_HANDOFF.md)) with "A yes, B yes, C accept all, D Q1 then Q8". **A, push:** yes, given after privacy row P1 of the handoff was raised. **B, deploy `1aeaace`:** yes. **C:** the 25 Scale lab design decisions (design section 12), the package decisions D1 to D11 and the T1 exceptions T-E1 to T-E5 are ratified by the owner on 2026-09-28, as recommended. Decision 3 therefore grants the 7,548 bytes over the lead's target. Decision 22 is ratified as recommended (author names may be cited); the design still cites by title, venue and year, which the ruling permits, and no change is made. Not covered by C and still open, with their recommended defaults holding until the related work starts: O7 (merge to `main` and CI), O8 (custom domain, automation), O9 (each N2 step and T2 item), O10 (licence), O11 (Austin lesson ids) and every pending N2 decision (OD-7 to OD-18, OD-20 to OD-26, C-32, G2). **D:** the next builds are Q1 (acceptance in a visible browser, design gates 5 and 6, 0 bytes) then Q8 (an operating view of one simulated period, about 20,000 bytes); Q0, Q2 and Q4 are done. The next builder is Codex, and each item starts with its acceptance criteria written first. **Privacy commit `0bc2f25`:** removed personal framing from both READMEs, the deployment guide's rollback heading and seven older FleetLab records; the byline stays. **Release:** the lead built the site from a `git archive` export of `1aeaacecb25e17853f852d7bbd7141ff75d9cb69` (the site inputs of the branch head equal it) and deployed it with Wrangler 4.135.0 to Pages project `fleetlab`: Production `77922688-6d87-4d15-94bf-442beab31712`, immutable https://77922688.fleetlab.pages.dev/, stable https://fleetlab.pages.dev/, source `1aeaace`, Pages branch label `feat/fleetlab-playground`. The upload held 98 files and `_headers`: 1 file new to the host (`src/ui/studio.js`) and 97 files already held. Hosted package 99 files / 3,349,629 bytes, inventory SHA-256 `dd3c2f2a659b18a0caacf5df639238916719f8a5294e653c2566ac39328e94b5`; offline file 2,408,350 bytes, SHA-256 `ccd3f7a01a3ddd03dd8a58336c52da32a50ec1c7b0b27a297b5e82496877325a`; both package checks OK, run with the repository's tools, which are identical at `1aeaace`. Readback: 98 of 98 public files match by SHA-256 and size on both addresses; response headers unchanged and verified. Hosted checks in the in-app browser with the pane hidden, so no frame was painted: after airport-preparation, and after cleaning, the region-launch lesson shows the main heading "Fleet day" and the document title "Rehearse commissioning in Region B", so the fix works; the three labs record `scale-spec:b4c7f5da`, `scale-spec:1aa8c833` and `scale-spec:443de567`; Fleet day default seed 42 on a fresh load reads 95 completed, 176 unserved, 4 waiting and 9 in progress of 284 requests (the cleaning lesson setup reads 82 of 284 requests, which is that lesson, not a regression); press times 4,725 ms, 1,058 ms and 2,660 ms against 4,790 ms, 1,103 ms and 2,656 ms on the previous deployment `19e17ac6` in the same session and conditions, so no regression, and both sets are slower than the readings of 2026-09-27 because of the state of the pane; a same-origin fetch that the tester attempted was refused by the page's own policy `connect-src 'none'`, as intended; no application console error. Tests at `1aeaace` as already recorded: two full serial runs, each 1,969 tests, 1,967 pass, one existing TODO and one timing failure (9.34 ms and 11.34 ms against 8 ms) that passed its one isolated rerun; Python parity/boundaries 89 pass; `ruff` passes. **Rollback target:** `19e17ac6-d617-4789-9260-ca259c53e076` (source `c08f60d`). The `fleetlab` project holds four Production deployments: `77922688`, `19e17ac6`, `dd4bfa44` and `f08b6b6f`. The launch lesson heading defect is fixed on the live site, and no site input is undeployed. **Push:** right after the records commit of 2026-09-28, which holds this entry, the lead pushed the branch head to github as a fast-forward of `feat/fleetlab-playground` from `790573e`. It published 20 commits: the N2 documents (`4ba5626`, `62547a8`, `82df3b5`), the packer `8e04b49`, the T1 wave (`caaf8f2`, `0497b9b`, `45efd43`, `c79eccf`), the eight Scale lab commits (`2caeac6` to `c08f60d`), `1aeaace`, the documents commits `44569f8` and `0bc2f25`, and the records commit. No remote branch `claude/fleetlab-scale-lab` was created. A push does not deploy. The local branch `feat/fleetlab-playground` in the `Hermes-playground` worktree stays behind its upstream and needs a fast-forward before anyone works there. **Not done:** the owner's look in a visible browser (O1, still first for the owner), Q1, Q8, a zero-failure full run at `1aeaace`, a screen reader, Safari, Firefox, a security scan, the broad Python suite, the lesson snapshot for 59 lessons. Records: [next-builder handoff](docs/archive/phase6-pack/CODEX_HANDOFF.md) (top section), [Scale lab handoff](docs/fleetlab/playground/FLEETLAB_SCALE_LAB_HANDOFF_2026-09-27.md), [deployment guide](docs/fleetlab/publishing/FLEETLAB_CLOUDFLARE_DEPLOYMENT.md).

**Scale lab, 2026-09-27 (deployed; pushed on 2026-09-28):** Branch `claude/fleetlab-scale-lab` in worktree `Hermes-scale`, cut from the T1 head `c79eccf`. Eight commits: `2caeac6` (shell: route `#/scale-lab`, one generic view, shared paired contract, ladder chart), `05113ab`, `953ebce`, `9fdb160` (three amendments), `27f6014` (response reserve lab), `1a81ae8` (fleet intake lab), `319b4a9` (density ladder lab), `c08f60d` (fixes of the independent review). Two labs are count models with no map; one reruns the Fleet day engine at 24 to 120 cars through its public function. No existing file under `src/core`, `src/model`, `src/instrument`, `src/legacy`, `src/runtime` or `src/data` was edited; four new page-only model files were added. Lessons 56 to 59, glossary 18 to 20, header navigation unchanged at 6 links. Gates on the final tree, Node v22.22.0: `FLEET_PLAYGROUND_PERF=1 node --test --test-concurrency=1 playground/fleetlab/test/*.test.mjs` gives 1,968 tests / 1,967 pass / zero fail, cancelled or skipped / one existing TODO (281.9 s); the four Scale test files give 92 of 92 with the flag; Python parity/boundaries 89 pass; `ruff check .` passes; `git diff --check` clean. Packages: hosted 99 files / 3,349,602 bytes; offline 2,408,323 bytes; both `check-dist` runs OK. Bytes: growth 89,468 over the 2,318,855 baseline, which is 7,548 over the lead's target of 81,920 and 2,692 under the lead's hard stop of 92,160; 77,213 bytes remain unassigned after the reserved 135,904 (166,681 before). Independent review after the build: seven lenses, 13 findings confirmed by two verifiers each, none refuted, nine distinct defects, none moving a verdict number, all fixed test-first in `c08f60d` (readout sentence against a strip that is not drawn, sideways scroll on a phone after a press, bars drawn over lines, two chart lines drawn alike, fleet intake depot induction accounting, floating point residue, a caption about rounded sums, missing map credit, and side-preserving numbers that had reached only some surfaces of the four-area card). Side-preserving and short numbers are now opt-in and only the Scale lab opts in, so **no page that existed before this wave prints different text**; `test/scale-lab.legacy-text.pins.json` holds that. Deployment on the owner's instruction of 2026-09-27: Wrangler 4.135.0, project `fleetlab`, Production `19e17ac6-d617-4789-9260-ca259c53e076`, immutable https://19e17ac6.fleetlab.pages.dev/, stable https://fleetlab.pages.dev/; 98 of 98 public files match by SHA-256 on both addresses; response headers verified; hosted presses of all three labs and Fleet day 95/284 reproduced. The deployment also published the T1 teaching frames, which had been local only. Rollback target at that release: `dd4bfa44-7226-4502-9d66-01bb1790f2b6` (since 2026-09-28 it is `19e17ac6`, entry above). **After the deployment:** two sweeps of the lesson links ran. The lead opened all 59 lesson links and the 9 page routes on the stable address in the in-app browser (Chromium engine) with the pane hidden, so no frame was painted, by changing the address hash with no reload: 0 error pages, 59 lessons by page (Fleet day 18, Street lab 6, Four-area experiments 29, Four-area workspace 3, Scale lab 3), 6 header links, no console error. An inventory stage visited the modules downloaded from the live site on the fake DOM: 10 route visits, 59 lesson visits and 4 deliberately bad links, 0 error pages from a good link, 0 network attempts, 0 engine run calls, 0 storage accesses. Both found one defect older than this wave: after another Fleet day lesson, `#/fleet-day?lesson=region-launch` kept the previous lesson's main heading. The lead confirmed it on the live site after a reload and from three starting pages and reproduced it on the fake DOM at `c79eccf` and `c08f60d`; D1 (`dd4bfa44`) sets no heading per lesson, so the defect came in with the T1 teaching frames and became public with this deployment. Commit `1aeaace` fixes it behind a new test in `test/studio.test.mjs` that failed first; on 2026-09-27 it was not deployed and not pushed, and both followed on 2026-09-28 (entry above). Full serial runs with the performance flag at `1aeaace`, twice: each 1,969 tests, 1,967 pass, one existing TODO and one timing failure. Run 1 (machine loaded, 342.8 s): the response reserve timing test, 9.34 ms against 8 ms. Run 2 (machine otherwise idle, 292.9 s): the four-area runtime test "run_window and run_pair gaps on the reference preset", which this wave did not change, 11.34 ms against 8 ms. Each passed its one isolated rerun (the second at 5.73 ms and 5.52 ms). No zero-failure full run at `1aeaace` is recorded. Also at `1aeaace`: Python parity/boundaries 89 pass, `ruff` passes, `git diff --check` clean, both package checks OK (hosted 99 files / 3,349,629 bytes, offline 2,408,350 bytes). **Documents commit:** the records of this wave are committed in one documents commit on top of `1aeaace`, which changes no site input; the deployment guide status paragraph then named `19e17ac6` as current and `dd4bfa44` as the rollback target (corrected again on 2026-09-28). **Decision states:** every design decision was taken at the lead's recommendation; the owner had ratified none on 2026-09-27 and ratified all of them on 2026-09-28 (entry above); the list is section 7 of the handoff. **Not done on 2026-09-27:** push, pull request, a look by a person with a visible pane (no painted frame of any page of this release has been seen), 1440 by 900 px, a throttled or physical phone, a screen reader, Safari, Firefox, a security scan, the broad Python suite, a zero-failure full run at `1aeaace`, a deployment of `1aeaace` (the push and that deployment followed on 2026-09-28, entry above). Records: [next-builder handoff](docs/archive/phase6-pack/CODEX_HANDOFF.md) (top section), [release](docs/fleetlab/playground/FLEETLAB_SCALE_LAB_RELEASE_2026-09-27.md), [handoff](docs/fleetlab/playground/FLEETLAB_SCALE_LAB_HANDOFF_2026-09-27.md), [design](docs/plans/2026-09-27-fleetlab-scale-lab-design.md), [build record](docs/plans/2026-09-27-fleetlab-scale-lab-plan.md), [model notes](docs/fleetlab/playground/FLEETLAB_SCALE_LAB.md).

**T1 teaching frames, 2026-09-26 (local only):** Implementation `caaf8f2d8f02b3df9e68a5a675fa488f99161d6d` adds three-part teaching frames for all 56 unchanged lessons, generated result readings, gated casebook readings and accessible exact-value disclosures. Final serial Node gate: 1,876 tests / 1,875 pass / one existing TODO / zero failures; Python parity/boundaries: 89 pass. Independent scope verification preserves all 47 core/model/instrument files, every resolved lesson setup and existing tests except three authorized copy-assertion rewrites. Browser fold/overflow/focus/contrast checks pass, with the explicit OD-T7 walkthrough exception: 146 fresh visible words before Prepare (153 with inherited context), above 130; structure is deferred. Two review findings about threshold rounding and edited lesson context were fixed and independently approved. Final offline size 2,318,855 bytes, growth 60,902: 538 below the hard stop and 7,654 over the target. Native site: 93 files / 3,249,227 bytes; both distribution checks pass. No push, deploy, new data or N2 engine implementation. The prior public D1 release remains current. Full evidence, exceptions, scope decisions and T2 queue: [T1 release record](docs/fleetlab/publishing/FLEETLAB_T1_RELEASE_2026-09-26.md).

**Offline packer route A, 2026-09-26 (local only):** The offline build removes only complete
comments whose first and last lines contain no code tokens. Every one of 107 module renders
must preserve exact lexical tokens and line terminators and compile before and after removal.
Templates, mixed-boundary comments, directives and protected license/preservation/source-map
comments remain intact; the 84-module inventory found no protected comments. Native site
output is byte-identical (90 files / 3,189,179 bytes; inventory SHA-256
`cf355b9b5544354866e81681a82b8173cf4590bb7dccd86b42a6098cb7ff1603`). Offline size is
**2,257,953 bytes**, down **293,925**, leaving **363,487 bytes** below the unchanged 2,621,440
limit. The exact line terminators and template contents are retained, so the result differs from
the audit scratch estimate. All 86 source files remain unchanged. Fixed-seed packed-worker
parity reproduces all 10,153 events, world digest, metrics and series; the stripped page initializes
on the fake DOM. Both distribution checks pass. Full serial performance-enabled Node suite:
**1,859 tests, 1,858 pass, one existing TODO, zero fail/cancel/skip** (32 new tests). No performance
rerun was needed. The small lexer rejects unsupported Unicode-set regex mode; per-module
compilation supplements token checks. No dependency, source, threshold, push or deployment
change; current public D1 remains unchanged.

**N2 design v2.1, 2026-09-26:** The [standalone v2.1 draft](docs/plans/2026-09-26-fleetlab-n2-design-v2.1.md)
(SHA-256 `8bb68d09da0b6738b02cdf179a8993dfda4b00aa2cdce5cde23fef7fa33d75de`; 901 lines)
restates all 19 fixture groups, all 26 owner-decision entries and the 50-correction conformance
map. OD-1/3/4/5/6/19 remain DECIDED; this launch additionally decides OD-2 using the audit’s
§4.6 budgets, including package T stop 61,440 bytes / target 53,248. The launch records
OD-T1/2/4/5/6/7=Yes for the separate teaching task. All other numbered N2 decisions remain
PENDING; the unnumbered C-32 record merge is also pending. S1 recommendations are not
operative contract. G2 is OPEN. No N2 implementation or registration is authorized by the draft.
The new ignored v2.1 probe re-derives changed type, selection, travel, energy and instrument
values through fixture-specific calculations and shipped helpers; retained hand traces are
explicitly distinguished from executed calculations. Documentary structure, separators, privacy,
table consistency and immutable hashes passed. V1, v2 and all three original S0 probe files are
unchanged. Read-only baseline checks reconfirm 1,827 Node tests (1,826 pass, one existing TODO),
offline 2,551,878 bytes and site 90 files / 3,189,179 bytes, with clean distribution checks.
Only this record and v2.1 change in the documentation commit; no application, packer, test,
Python, owner note, remote, deployment or publication changes belong to this task.

**Design audit and next implementation steps, 2026-09-26:** The read-only
[design audit](docs/FLEETLAB_N2_V2_DESIGN_FEEDBACK.md) reviews the N2 v2 contract (§0-§10) and the
live site's teaching clarity (§11), and explains every simulation and all 56 lessons in three parts:
What & why, How we simulate, and What you learn plus an ops takeaway to test (§12, Appendix B).
All of it is grounded in model runs, test pins or recorded artifacts, and labelled NOT_EVIDENCE.
Owner decisions recorded: OD-1 (packer route A: offline-only removal of full-line comments,
measured -300,476 bytes), OD-3 (G3 fix B, depot-major type order), OD-4 (integer share
arithmetic), OD-5 (nearest-eligible preparation), OD-6 (checker split into runtime invariants and
test-time policy checks) and OD-19 (S1a before X1; S1b before any forecast-arm run; S5 after S4).
Next tasks, in order (§13): Task 1, N2 design v2.1 (docs only); Task 2, the packer route A change;
Task 3, the T1 teaching frame (presentation only, stop budget 61,440 B). Task 3 needs OD-2 and
OD-T1 to OD-T7 first. No application code, deployment or remote branch changed with this entry.

**D1 published, 2026-09-26:** Source `b99ab046ee0ee233c1e9d0db32dfa850c08cad8a`,
Production `dd4bfa44-7226-4502-9d66-01bb1790f2b6`, immutable
https://dd4bfa44.fleetlab.pages.dev/, stable https://fleetlab.pages.dev/.
The [release record](docs/fleetlab/publishing/FLEETLAB_D1_RELEASE_2026-09-26.md) documents result-first Fleet day,
model identities, explicit/reduced replay, separate setup controls, Four-area labels,
non-affiliation and readable Austin decisions. Protected model/instrument/core/runtime
source is unchanged. All56 lessons and5 setup models retained; baseline payload fingerprints
match. Final Node:1,827 tests,1,826 pass,0 fail/skip/cancel,1 existing TODO (baseline1,791 pass).
Python89 pass; Ruff clean; static90 files/3,189,179 bytes; offline2,551,878 (+8,223≤11,264).
Native/packed desktop and mobile-sized keyboard checks, offline HTTP, hosted default Bay
and Austin run/comparison passed;89/89 public hashes and response security headers match.
No system-media emulation was available: browser motion checks used the real in-app override,
with automated system/override precedence tests. No other-device/AT/full-Python claim.

These publication records intentionally follow the source commit and deployment because
its ID exists only afterwards; the owner brief explicitly authorizes this exception to
the same-commit rule. Records precede normal pushes to the D1 branch and the website branch,
with no force and an explicit fast-forward check. The preserved owner note remains untracked.
Rollback target is `f08b6b6f-c5d0-44f7-905b-5f16087fbc85`. N2 remains design-only.

**N2 S0 / WP0 v2 contract addendum, 2026-09-26:** The owner-authorized
[v2 draft](docs/plans/2026-09-26-fleetlab-n2-design-v2.md) is a complete design-only
replacement for implementation planning, with owner decisions, lifecycle/ownership,
metric populations/nulls, capture-independent accounting, version contracts and exact
fixtures. Independent review corrected the F2 holder population and G3 observation
window. G2 cell tapes remain **OPEN pending S1**; patience, inherited values, seeds,
controls and dispositions are unregistered. V1 SHA-256 remains
`c574b8df41d0378363e18f75452f09e15a2cf62581e8fb01f6f365229d7e25bf`.
No N2 implementation, campaign, data acquisition or execution-seam work is authorized
by this draft. D1 release verification is separate and will be recorded after publication.

**Packet review and next brief, 2026-09-26:** An independent read-only review of the
2026-09-25 packet ([review](docs/fleetlab/design/FLEETLAB_PACKET_REVIEW_2026-09-26.md)) upholds N2 findings
F1–F5 with corrected, paste-ready contract texts and discriminating fixtures, adds six
verified gaps (G1–G6), flags that the proposed completion primary may be uninformative
(ceiling or abandonment-driven in analogs) and that seeds 2001–2012/3001–3012 coincide with
the four-area teaching model's seed sets, and recommends no Waymo Open Dataset work now.
Packet corrections in `bff69d7`: L424 no longer carries an absolute local path; L385 warns
that the PyPI name `waymax` is an unrelated third-party package (FleetLab does not use
Waymax). The [Codex brief](docs/plans/2026-09-26-fleetlab-d1-and-n2-s0-codex-brief.md)
scopes Part A (N2 S0 v2 design, docs only) and release D1 (presentation only; no
`src/model`/`src/instrument`/`src/core`/`src/runtime` edits; ≤11,264 offline bytes; model
parity 95/284 and Austin 77/480 as gates). No application code or deployment changed here.

**Current address and review follow-up, 2026-09-25 Pacific / 09-26 UTC:** At the owner's
request, the new `fleetlab` Cloudflare Pages project serves **https://fleetlab.pages.dev/**,
Production **`f08b6b6f-c5d0-44f7-905b-5f16087fbc85`**, immutable
https://f08b6b6f.fleetlab.pages.dev/. Application source remains **`345b427`**. Both existing
packages passed their checks; all **88 public payloads** match; response security headers and
new-host browser runs (Bay **95/284**, Austin 60% **77/480 completed**) passed. The former project/address remains
available with no redirect. No product code changed for the move. This new project starts
with one release; rollback history in the old project is not transferable.

The [requested Claude packet](docs/fleetlab/design/FLEETLAB_DESIGN_DATA_AND_N2_REVIEW_2026-09-25.md) contains
the complete project context, live design observations, an editorial learning-studio proposal,
a step-by-step local Waymo Motion pilot and the independent N2 audit with the unchanged draft.
Current product source uses OSM, public vehicle references and synthetic assumptions, **not
Waymo Open Dataset data**. No acquisition, license acceptance or data-runtime installation
occurred. The N2 audit recommends resolving four P1 contracts and one P2 wait-label issue
before implementation; focused tests passed **24/24**. N2, redesign and data integration remain
proposals. Full release validation below remains applicable to unchanged application bytes;
no new repository-wide green claim is made. Hosting commands and limits are in
`CODEX_HANDOFF.md` and the [publishing runbook](docs/fleetlab/publishing/FLEETLAB_CLOUDFLARE_DEPLOYMENT.md).

**Local regional N0 + N1 build checkpoint, 2026-09-25 UTC:** The owner's “read and
build, go” request implemented the first slice of the regional brief on
`codex/fleetlab-regional-power`, starting from the actual released website lineage at
`4b7a276` (application `96fde5b`). The entry worktree was at `9daacef` with no website;
its untracked owner review file was preserved. Other worktrees and main were untouched.

Fleet day now includes an opt-in Austin-inspired schematic, two fictional depots, versioned
site-power intervals, exact per-minute cap/delivery records, required-work/resource inspection,
strict setup sharing and existing redistribution/deadline paired evaluation. Historical Bay
numerical defaults and all 56 lesson contracts remain supported. The original regional model,
Street model, launch rehearsal and Python evidence contracts remain separate.
[Mechanics and reproduction](docs/fleetlab/playground/FLEETLAB_REGIONAL_POWER.md).

Observed four-condition rehearsal (12 fixed evaluation seeds 1001–1012, separate development
seed 42/tuning declarations 42–44, completion margin 0.02, 2,000 bootstrap resamples):

| Power at Site A during minutes 90–179 | Mean completion baseline → candidate | Primary | Existing recommendation | Binding guardrail |
|---|---|---|---|---|
| Full | 0.163888889 → 0.168923611 | UNCHANGED | NO_RECOMMENDATION | None regressed |
| 60% | 0.160243056 → 0.162152778 | UNCHANGED | HOLD | Mean unfinished visits +0.333333333; allowed 0 |
| 20% | 0.150694444 → 0.157638889 | UNCHANGED | NO_RECOMMENDATION | None regressed |
| Outage | 0.147395833 → 0.153298611 | UNCHANGED | HOLD | Mean terminal-energy harm 5.392090652 kWh; allowed 5 |

These are synthetic model results, not an operating recommendation. All-request within-target
pickup remains unavailable in this experiment; completion is its registered primary. Exact
machine values, frozen inputs, digests and source provenance are in ignored
`artifacts/fleetlab-regional-power/demo/`. The sweep includes 96 primary arms and 16 repeatability
probe arms. No search for favorable evaluation seeds or new winner score occurred.

Validation: standard Node suite **1,779 passed, zero failures, two opt-in performance suites
skipped, one existing browser TODO**; all 13 new regional tests passed. Python website
parity/boundaries **89 passed**, Ruff and static/offline checks passed. Full Python remains
**1,433 passed, 186 failed, 42 errors, 56 skipped**, reproducing the retained-fixture limitation;
no fixture fabrication or regeneration. Doctor: 16 PASS, two WARN (ambient Conda-base label
and dirty worktree), one optional display NOT_AVAILABLE. Tests used a local Python 3.11 venv
with explicit checkout `PYTHONPATH`, without repointing the shared editable environment.

The all-suite optional timing run hit the existing original-regional 8 ms yield budget
(12.76 ms under concurrent tests; 8.58 ms with sequential files). Its isolated performance
suite passed **9/9**; timing sensitivity remains disclosed rather than weakening a check.
Independent code review found two P2 defects and one minor: shared-horizon condition changes,
missing paired-export regional provenance, and order-sensitive preset recognition. All three
were reproduced with failing tests and fixed. No critical findings were reported.

Actual Chromium 152 inspection at 1280×720: default Bay run returned in 34.1 ms, busy-depot
Bay in 27.6 ms, default Austin in 48.4 ms, 12-seed Austin comparison in 603.7 ms; no recorded
long tasks over 50 ms in those samples. A 120-vehicle comparison produced 62–83 ms tasks;
cancel worked between arms (0.3 ms from received cancel click to status change, excluding
any waiting to dispatch the click). This is one local measurement, not an accessibility or
performance certification. At 400 px, the regional setup and result caused no page overflow;
wide data tables scroll inside their containers. Native, static and offline-over-HTTP boot/run,
last-run setup restoration without execution, stale labels and comparison cancellation were
checked. Direct file URLs, physical phones, screen readers and other browsers were not tested.

Offline file: **2,543,655 bytes**, within the unchanged 2,621,440-byte limit. Static folder:
**89 files, 3,181,153 bytes**. No new network capability or dependency. Work remains local and
uncommitted because wider gates are not green; nothing was pushed, merged or published.
The previously verified public release below remained unchanged at that local handoff.

**Publication follow-up, 2026-09-25 Pacific / 09-26 UTC:** The owner subsequently requested deployment and GitHub
push, superseding the earlier local-only scope for this website release. Fresh sequential Node
validation with `FLEET_PLAYGROUND_PERF=1` passed **1,791 tests, zero failed/skipped/cancelled,
one existing TODO**; Python website checks passed **89/89**, with Ruff and both rebuilt
packages passing. The broader Python retained-fixture limitation remains separate and
unchanged. Publication uses the existing website branch and Pages project; main stays separate.
Published application source **`345b427cdddeb6e8946542c66786d3acbaacaa5c`** was pushed
atomically without force to `feat/fleetlab-playground` and `codex/fleetlab-regional-power`.
Cloudflare Production deployment **`6265159a-a13e-4ca7-9f9c-4acde9bcf6e7`** serves
**https://fleetlab-playground.pages.dev/**; immutable address
**https://6265159a.fleetlab-playground.pages.dev/**. All **88 public payloads** matched the
local static package; `_headers` is the 89th deployment file and its security policies were
checked on actual responses. Both remote branches resolved to the release commit; main stayed
at `bca4ccd4d881e58904e59bb1b1ff594442099654`. No PR or main merge occurred.

Hosted browser checks reproduced the moderate seed-42 shift: 480 requests, 77 completed,
391 unserved, 11 waiting and one in progress. The 12-seed comparison reported UNCHANGED/HOLD
with unfinished-visits mean harm 0.3333333333333333. A generated last-experiment setup restored
without execution; the original Bay default still produced 95/284. No console errors were
reported during those actions. Source/static/offline local QA from the build remains applicable;
no new cross-browser, assistive-technology or real-world validity claim is made.

Wrangler warned that the worktree contained the owner's unrelated untracked review; committed
application paths were clean and the deployment package was rebuilt from those paths. The
draft/owner note and all generated artifacts were excluded from the public package. An initial
Python HTTP readback received 403; normal public requests with curl succeeded and matched every
payload. No authentication, credential or access-policy change was made to obtain readback.

[N2 draft](docs/plans/2026-09-25-fleetlab-n2-design.md) recommends a bounded event/curb question,
with arrival versus boarding semantics and deterministic responsive execution before expansion.
It adds no N2 product code and preserves the completion primary. The previous deployment
`e72ae87d-6b96-47a0-950d-4d4a87b8bb95` remains the rollback target; rollback changes served
content through Cloudflare, not Git history. Exact commands and hashes are in `CODEX_HANDOFF.md`.


**Previous design release, published September 25, 2026 UTC.** Explicit owner authorization
superseded the local-only design handoff. Source `96fde5b862119c9bbcd7a2ae76450f8dee616f93`
was pushed normally to the website branch and deployed as Production
`e72ae87d-6b96-47a0-950d-4d4a87b8bb95`; main and unrelated worktrees remain unchanged.
All 84 public payloads match the checked build. Native routes and all 56 lesson links,
complete validated setup snapshots, accessible structure, exact result context and selective
copy improvements are live. No model-engine changes, backend, accounts or telemetry were added.

Fresh release validation: 1,778 Node pass, no fail/skip/cancel, one existing TODO; 89 Python
playground pass; Ruff and static/offline checks pass. Static package 85 files / 3,149,404 bytes;
offline HTML 2,510,896 bytes. Hosted sharing restores 24 versus 48 AV inputs without autorun;
explicit runs reproduce 95/284 versus 197/284. Direct Lombard lesson reproduces 39/71.
Malformed links recover explicitly; history, visible landmarks and security headers verified.
The broader Python fixture gate remains non-green (1,433 pass, 186 fail, 42 errors, 56 skip);
this scoped publication does not establish main-integration readiness. A cosmetic literal-null
text node in an existing Street vehicle panel is recorded for follow-up. No new exhaustive
security scan or unsupported AT/cross-browser/page-load measurement is claimed.

[Full project review, release evidence, limitations and proposed next phases](docs/fleetlab/handoffs/FLEETLAB_REVIEW_AND_NEXT_PHASE_2026-09-25.md).
The following M1–M4 release narrative is a historical September 24 checkpoint.


**M1–M4 and scenario learning, validated and published 2026-09-24.** The active user
goal extends the prior M2/M3 instruction through M4 and authorizes conditional repository
update and existing-site deployment. Main and unrelated worktrees remain untouched.
`depot-launch-1.0.0` adds versioned RegionConfig/DepotConfig, owned setup tasks and dependency
checks, per-site calendars/resources, mock commissioning actions and a second fictional
region through the existing Bay lifecycle. Its result adapter checks producer/model/metric/
rule compatibility, nested populations, unchanged external demand and recorded action/capacity
consistency. Broken actions are rejected separately from invalid simulator state.

The in-app template → configure → validate → rehearse workflow displays actual treatment,
all-request pickup/completion, unfinished work, queue/active time, energy and recorded state.
It invalidates stale results/exports on edits. The catalog now has **56 lessons** (18 Fleet day,
six Street lab, 32 regional), with explicit decision questions, controls, outcomes and limits.
No new engine, framework, backend or runtime dependency. All browser results remain
`NOT_EVIDENCE`, simulation-only, deployment permission `NONE`; Python evidence is separate.
[Exact local commands, demo, model/metric versions and limits](docs/fleetlab/depot/FLEETLAB_DEPOT_LAUNCH.md).

Fresh settled-tree release gates: `FLEET_PLAYGROUND_PERF=1 node --test --test-concurrency=1
playground/fleetlab/test/*.test.mjs`: **1,715 total, 1,714 pass, zero failure/cancel/skip,
one existing browser-only layout TODO, 245 suites, 144.226 seconds**. Relevant Python parity/
boundary **89 pass (9.29 seconds)**; Ruff and `git diff --check` pass. Static package **81 files,
3,105,220 bytes including media**; offline HTML **2,466,050 bytes**, both within unchanged
budgets and passing package checks. An earlier concurrent run saw a test/module edit race and
one 28.79-ms wall/3.43-ms CPU timing outlier; the settled serialized run passed all unchanged
performance limits. No test was deleted or weakened. Independent review found and fixed three
comparison-boundary defects and three UI issues; regressions cover their failure modes.

Local browser acceptance: Region B seed42/delay120 shows completed trips34→29 but on-time
pickups24→26, with unfinished tasks42→49; Peninsula delay0 gives identical outcomes. Recorded
port tables distinguish unreserved from usable. Keyboard owner removal invalidates output
before validation, then `TASK_OWNER` blocks. Deadline catalog loading selects the proper axis;
12 evaluation seeds return the recorded UNCHANGED/NO_RECOMMENDATION. At400px viewport,
content385px has no page overflow. Offline direct-file browser execution remains blocked;
package and worker parity pass. No full unrelated Python/MetaDrive suite is claimed.

The final security scan `1d70bf64-6294-45d9-bb71-29588f1fbfa8` covers immutable range
`f85a28f..7874c7e`: all 20 changed source files and supporting controls reviewed, complete
scoped coverage, zero reportable findings and no deferred candidates. This is not proof of
zero risk or a cloud-account audit. Two older packaging descriptions were corrected in the
final documentation, without changing app bytes. The earlier M1–M3 scan
`c37f68ed-0c6b-44c8-a4fb-f99e6e260580` remains sealed with zero findings and its stale
partial-coverage marker; it was not replaced or rewritten.

Publication is verified: source **`7874c7ed1453b97123946b43b153f80a7228088c`**, deployment
**`40858080-b229-44f1-8169-4f8b4faf5c86`**, stable address
**https://fleetlab-playground.pages.dev/**. Source was pushed without force to the website
branch, then only checked `dist/site` was uploaded through Wrangler 4.135.0. All **80 public
files** match local SHA-256 values; CSP/response headers retain no application network calls,
same-origin scripts/workers/media, anti-framing and nosniff. Cloudflare adds its own network
error reporting headers. Hosted acceptance covered default Fleet day, Region B's exact mixed
outcome, owner-edit invalidation/`TASK_OWNER`, catalog treatment selection, 12-seed deadline
UNCHANGED/NO_RECOMMENDATION, one-seed airport descriptive labeling, Street lab route comparison
and the separate regional worker's 20-pair UNCHANGED result. Offline direct-file UI remains
untested as noted above. Main stays `bca4ccd`; no PR or main merge; other worktrees untouched.
The final docs-only commit records publication, so website branch HEAD can differ from the
deployed app source. [Release commands, digests, review, browser acceptance and rollback](docs/fleetlab/depot/FLEETLAB_DEPOT_RELEASE_2026-09-24.md).
Environment doctor before that documentation commit: 16 PASS, two WARN (active shell names
Conda base; documentation edits dirty), one optional display NOT_AVAILABLE, no FAIL; the
checks used the explicit Python 3.11.15 executable in `hermes-dev`.

**Historical M2/M3 validation checkpoint (superseded by M4 above):**


**M2/M3 implementation and release gate, 2026-09-22.** The current user explicitly
superseded the M1-only/no-publication scope: proceed with M2 and M3, test, update the
repository and deploy the existing site if validation/security gates pass. The older
Phase 6 design-stop/read-only and branch instructions do not govern this authorized
browser extension. Main, Python evidence and unrelated worktrees remain untouched.
M1 is retained at local commit `7e0389d`; current work is isolated on
`codex/fleetlab-m2-m3` in `Hermes-depot-m1`.

Implemented **B2 in two separate treatments**: equal-share versus capped redistribution,
then redistribution versus deadline/aged-job priority. **B3** adds fictional port identity,
commissioning/health truth, sequenced delayed observations, unknown/stale knowledge,
exclusive idempotent leases, current feasibility checks, outage and recovery. **Minimum
B4** adds keyed passenger realization, independently published/expiring forecasts,
finite inbound/staging slots, reserve-constrained preparation and explicit intake/SLA
censoring. Each is an optional version `1.0.0`; `bay-systems-metrics-1.0.0` and paired
format `fleetlab-bay-paired-experiment` version 1 are separate from regional/Python
contracts. The UI projects records, displays actual policy changes and per-seed outcomes,
and cancels/stales comparisons on edits. No framework, backend or runtime dependency.

Paired experiments validate producer/version/configuration/population/demand, replay the
first pair, require all declared metrics, and then reuse existing numeric instrument
math through `model/experiment.js`. One seed remains descriptive. Default evaluation
1001–1012 is disjoint from declared tuning 42–44; margin 0.02 fraction units, 2,000
bootstrap resamples. Model recommendations remain `NOT_EVIDENCE`, simulation-only,
`deployment_permission: NONE`. Positive service differences cannot compensate for
regressed guardrails. [Runbook, definitions and reproducible recipes](docs/fleetlab/depot/FLEETLAB_DEPOT_M2_M3.md).

Observed validation at this checkpoint: Node 22.22.0, performance-enabled full suite
**1,690 total, 1,689 pass, zero fail/skip, one existing browser-only TODO, 245 suites**;
Python 3.11 parity/boundary **89 pass**; Ruff and diff check pass. Static package **77
files / 3,048,314 bytes including existing media** and offline HTML **2,407,765 bytes**
pass existing checks/budgets. No historical test was deleted or weakened. A worker import
that duplicated Bay map bytes was removed; a narrow-screen layout and accidental Python
evidence-label copy were corrected. Independent spec/code review found no critical or
important issue. Direct offline file-URL browser execution remains blocked by browser
policy; offline worker parity and package checks pass. Full unrelated Python/MetaDrive
suite is not represented by these browser release gates.

Local browser acceptance exercised charging and airport paired comparisons, UNKNOWN and
INFERRED_STALE resource tables against current truth, six-slot forecast preparation,
stale-result invalidation and disabled comparison after edits. Mobile viewport showed
no page overflow (375 CSS-pixel content width); visual inspection confirmed readable
forecast/staging and selected-vehicle panels. Airport comparison retained its HOLD for
unfinished-visit/terminal-energy guardrail regressions despite improved airport pickup.

At this historical checkpoint, release security scan and served-build acceptance were pending
and the public build was `f85a28f` / `ccb82b11`; the completed M1–M4 release above supersedes
that state. Remote `github/feat/fleetlab-playground` was observed at `6b376fb` before this work.
A push alone does not deploy this Direct Upload Pages project. No PR or main merge was requested.

**Historical M1 delivery checkpoint (superseded by M2/M3 above):**

**Current browser status, verified 2026-09-22.** This paragraph supersedes the older
Playground-only scope/count/release statements below; Python and ADAS history is unchanged.
The active task started in clean `Hermes-fleetlab` at `9daacef` on
`feat/phase9-metric-contract`, which has no browser app. The clean website worktree
`Hermes-playground` was at `6b376fb`, whose differences from recorded published source
`f85a28f` are documentation only. M1 is isolated in `Hermes-depot-m1` on
`codex/fleetlab-depot-readiness-m1`, based on `6b376fb`. Both pre-existing worktrees
remain clean; no push, merge, PR, remote modification or deployment occurred.

**M1 completed locally:** opt-in `readiness.version = depot-readiness-1.0.0`, producing
`fleetlab-bay-operations-1.0.0+depot-readiness-1.0.0` and
`depot-readiness-metrics-1.0.0`. Every visit records mandatory cleaning, charging and
upload plus scheduled software; a cleaning task acquires a bay and qualified worker
atomically. Completion/release, exclusive blocking, queue/active time, unfinished
work, deadlines at observation end, terminal ownership and rejected policy actions
are recorded. The existing replay and new operator tables project those records.
The historical default remains unchanged; two complete Bay outputs match published
`f85a28f` byte for byte and are pinned in tests. No Python code, historical fixture,
regional statistical instrument, Street lab, map or charging implementation changed.

**Reproduce:** [Fleet day M1 runbook and metric contract](docs/fleetlab/depot/FLEETLAB_DEPOT_READINESS.md).
In Fleet day select **Staffing: an empty bay needs a worker**, **Run fleet day**, then
**Compare staffing and bays**. The comparison needs a fresh submitted replay. Seed 42,
240 minutes, 16 vehicles, one fictional site, the same 179 exogenous requests and the
same required-work rule produced these observations on Node 22.22.0:

| Observed measure | Baseline: 1 worker, 3 bays | Worker treatment: 2 workers, 3 bays | Bay control: 1 worker, 4 bays |
|---|---:|---:|---:|
| Completed / all requests | 26 / 179 | 36 / 179 | 26 / 179 |
| Unserved / waiting / assigned-in-progress | 146 / 7 / 0 | 135 / 7 / 1 | 146 / 7 / 0 |
| Ready by end / started depot visits | 11 / 26 | 22 / 36 | 11 / 26 |
| Unfinished visits / mandatory tasks | 15 / 45 | 14 / 42 | 15 / 45 |
| All-visit queue task-min / active task-min | 3,208 / 260 | 2,857 / 519 | 3,208 / 260 |
| Oldest unfinished task age, min | 220 | 139 | 220 |
| Maximum observed task queue, min | 215 | 135 | 215 |

These are descriptive one-seed results, not hard-coded UI outcomes or statistical
confidence. **All three fail the illustrative 60-minute maximum-wait check** despite
valid simulator state. The extra worker changes service but does not establish an
acceptable staffing plan; the extra bay does not improve this worker-constrained
scenario. Counts of visits/work may change through dispatch consequences. Mean depot
times remain explicitly completed-only; all-visit queue/active totals and unfinished
work accompany them. Browser outputs remain `NOT_EVIDENCE`, simulation-only and
decision authority `NONE`; no deployment authority is added.

**Validation actually run in this worktree:**

- Baseline Node: 1,629 total, 1,626 passed, zero failed, 2 skipped, 1 browser-only TODO.
  Final `node --test playground/fleetlab/test/*.test.mjs`: **1,646 total, 1,643 passed,
  zero failed, 2 skipped, 1 browser-only TODO**, 245 suites. Historical tests retained.
- `FLEET_PLAYGROUND_BASE=bca4ccd PYTHONPATH="$PWD/src" PYTHONDONTWRITEBYTECODE=1`
  with `hermes-dev` Python 3.11 on the two `test_fleet_playground_*` modules:
  **89 passed**, baseline and after changes. Python distribution remains `0.1.0`.
  `python -m ruff check .` passes. Full Python/MetaDrive suite was not rerun for this
  browser-only change; this worktree has only `artifacts/.gitkeep`, no evidence fleet.
- `pack.mjs --site dist/site` and `check-dist.mjs --site dist/site`: **71 files,
  2,992,206 bytes total** (including existing film/poster); unchanged separate budgets.
  Offline `pack.mjs --out dist/fleetlab-playground.html` and checker: **2,349,012 bytes**,
  under the existing 2.5 MiB cap. Baseline sizes were 69 files / 2,963,232 bytes and
  2,319,114 bytes respectively. No budget increase or runtime dependency.
- Local packaged-site browser checks: staffing preset, run, stage jump, selected car,
  worker/bay resource detail, measured comparison, keyboard-driven stale warnings,
  rejected skip policy and named checks; phone viewport/table and expanded exact-JSON
  disclosure without page overflow; no console errors observed in those flows.
  Direct offline `file://` execution was **not browser-tested** because the browser
  URL security policy blocked opening it. Its build and offline security checker pass.
- Independent read-only review found and resolved two P2s: unobserved queues now
  remain unavailable/null; a +1 treatment beyond the maximum is unavailable without
  hiding the other valid trial. Reviewer recheck: 24 focused tests passed; no new
  reporting errors. `git diff --check` passes.

**Published versus local:** read-only served-asset checks matched `f85a28f` for the
Bay engine, operations UI, studio UI, paired instrument and stylesheet. These sample
hashes do not authenticate the deployment ID. `ccb82b11` remains the recorded release;
M1 is **not deployed and has no hosted acceptance result**. No credentials or account
APIs were used. The failed direct-file browser action was not bypassed.

**Limits and deferred work:** only one qualified cleaning pool per site and serial
work; no optional-task execution, successful mandatory cancellation, worker shifts,
parallel scheduler, optimized charging/taper, stale-resource feeds, airport forecasts,
region bring-up or physics. No usability study or production calibration. Four
systems stay separate: Fleet day, Street lab, regional experiments and Python evidence.
The current user's M1 authorization supersedes the older Phase 6 workflow for this
browser extension; the decision and exact metric contracts are in the linked runbook.

**Recommendation:** review the local M1 artifact as a mechanism demonstration; do
not treat the service gain as a guardrail pass. **Top risks + mitigations:** synthetic
assumptions → keep scope/versions visible; censored work → retain full cohorts;
missing measurements → null/Not available; cross-model confusion → strict producer
compatibility and no statistical/evidence reuse. **Next 3 actions:** review the local
comparison, rehearse one binding/nonbinding resource example, and select any next
milestone explicitly. Publishing remains a separate owner-authorized action.

**Historical regional-model description (preceding M1):**

`playground/fleetlab/` is a static page and one offline HTML file for building intuition about fleet and depot
operations. It sits outside `src/hermes/` by design: nothing in `src/hermes/` imports or mentions it, and boundary tests
enforce the design's placement rules R1 to R9.

- **What it teaches.** Cars per area, depots with parking, cleaning and service bays, peak and off-peak demand, highway
  and local routes with hourly congestion, depot assignment, the end-of-service recall and the morning release, from day 1
  05:00 to day 2 10:00. Three Learn cases and seven Experiment presets follow design §4, each with its measured verdict.
- **What it shares with FleetLab.** The verdict rules, proven by `tests/fixtures/fleet_playground/instrument_vectors.json`,
  which FleetLab's own functions generate and both `pytest` and `node --test` check; FleetLab's own world, reproduced by
  the legacy profile against exported worlds (FLEET-005 seed 101 in both arms, collision, precheck, horizon crash, seeded
  defects); and the quoted FLEET-005 and two-zone probe reference panels.
- **What it never is.** A decision record. A playground run is a teaching run; its result summary carries `NOT_EVIDENCE`
  and fails `DecisionRecord` and `ExperimentSpec` validation (R9).
- **Changed during the build, on evidence.** The audited default (90 cars, a recall pending all night) gave 23% unserved and
  depot gridlock in a real run. The recall now acts once (design D-12), and the default is 120 cars, calibrated by a sweep
  with two accepted exceptions (design §2.2). At that default the model does not show two audited lessons: the nearest
  depot reads IMPROVED in the worked example (UC-07), and no depot resource binds while riders need cars (UC-08). The design
  records both, and no Learn caption states an unasserted direction.
- **FleetLab defects found while designing it** (design §14, none fixed here): FL-1 demand and horizon axes never reach the
  world (a silent false UNCHANGED); FL-2 utilization unclipped (clipping moves the pinned FLEET-005 digest); FL-3 an
  unavailable guardrail is skipped silently; FL-4 and FL-5 invariants that cannot fail or check only some events; FL-11 a
  horizon axis shortened below the declared horizon crashes `run_experiment` with an uncaught `ValueError`.
- **Operations casebook (design §4.4, added 2026-09-15).** Twenty situations an operations lead meets, in five themes of
  four: San Francisco core operations, launching a new service area, rain, busy areas with many people, police activity
  and emergency response. The model has none of those things, so each case is a proxy built from the knobs that says on
  the page what it stands for, how it is set and what it misses, with an "Outside this model" list. Each is an Experiment
  preset of kind `ops`, grouped by theme in the chooser, with a SITUATION block on the setup sheet. A record's slug is its
  scenario name and the scenario name keys the demand trace, so every number belongs to its slug; `test/ops-cases.test.mjs`
  pins every spec verbatim and every seed set 1 verdict to `test/ops-cases.pins.json` (sets 2 and 3 behind
  `FLEET_PLAYGROUND_PERF=1`; all three agree on every case). The page never names a verdict or a direction (H-9); the
  measured tables and lessons are in design §4.4, where six cases that did not show (INCONCLUSIVE or UNCHANGED) are read
  as lessons about margins, windows and guardrails, and a list names the model limits the casebook leans on.
- **Map motion, phases 1 and 2 (added 2026-09-15).** A survey of the built page found the map nearly still: over 600
  consecutive frames at 900x, unit bars changed on 10.8% of area-frames and depot bars on 4 of 2,400 depot-frames, and
  the pinned car was the only thing moving continuously. Phase 1 changed nothing on screen and bought the budget: one
  map model and one playback frame per drawn frame, shared by the map, the NOW panel and the announcer, and a table
  twin kept current by one watched number per drawn value. Phase 2 draws every car driving a route as its own mark, at
  the progress the interval log gives it and pointing along its direction, moved by one composed `transform` written
  only when its rounded place changes. The honesty line is where it stops: a car standing in an area stays a unit bar
  and a car at a depot stays part of the depot tile, because the model gives neither a place inside it. A route
  direction whose corridor is too short for its own busiest snapshot keeps its flow band and writes a visible reason,
  decided once per run and geometry so nothing flips mid-playback. The map also carries its first model-limits chip
  (traffic changes on the hour; areas are points) and a second legend line, because it now draws two encodings of one
  quantity at once. No CSS transition, animation, keyframe or `will-change` was added anywhere, and reduced motion
  steps cars on the 5-minute snapshot grid through the `interpolate: false` path that already existed, so the map needs
  no reduced-motion code path of its own. Recorded rather than fixed: a shield is an opaque plate and cars paint below
  it, so a mark's centre sits under a plate on 18.4% of car-frames wide and 37.2% on the phone; and a mark near a route
  end overhangs a yard on 8.33% and 11.95%, where its hues measure 3.90 and 2.82 and its surface ring 1.13:1. Phase 3
  (bay cells) landed on 2026-09-16 as the isometric depot block; phase 4 (a day-long bar under the scrubber) is approved
  and not built.
- **The isometric world (added 2026-09-16, the demo plan's phase A).** The owner asked for 3D as a requirement rather
  than a means. A spike measured three renderers on the built page at 150 cars: WebGL at 0.05 / 0.1 ms of JavaScript a
  frame, Canvas 2D at 0.15 / 0.3, the shipped SVG at 0.13 / 0.3, all far inside design §5.9's 8 ms. Canvas 2D ships,
  because the saving WebGL buys is 0.1 ms of an 8 ms budget against a second renderer and a context-loss path during a
  screen share, and because the 1 px ink edge and the hollow states are native strokes there. The picture is a 2:1
  dimetric projection of the flat schematic's own area centres, generated from the interval log: flat platforms with no
  texture, shoreline, street or building; ribbons at the class offsets with the same chevron congestion encoding; one
  shaded box per car whose place is a route, at `placeCar`'s own fraction and pointing along its ribbon; a cube per five
  cars standing in an area, because the model gives an area no inside geography; a white depot block whose lot fill
  climbs its side faces and whose bay cells fill by elapsed over the task time you set. What keeps it honest: the
  geometry is invented and the caption says so before a run as well as during one; nothing is lit, no camera moves and
  there is no day-and-night tint, because the model has no daylight; exact coincidence is grouped in model space by
  `(route, direction, fraction)` and then by family, so a count is a fact of the log and not of the screen (pinned: on
  the default preset at the recall second five stacks of 22, 18, 9, 9 and 9 carry 67 of the 85 cars on routes, and a key
  rounded to a twentieth of a leg would invent a sixth); the canvas never draws a letter, so every word is HTML over it
  where the copy scans and a screen reader can reach it; the overlay carries the map's twenty roving stops and the map
  is still exactly one tab stop; and no hue is spelled in JavaScript, so all twenty-four face ratios are computed from
  the stylesheet's tokens and pinned in `test/a11y.test.mjs`, with 3:1 held on both route hues in both themes. A
  rendered city, vehicle models, a moving camera, lighting, WebGL, a language model in the loop and an imported traffic
  simulator are each refused in design §1.4 with a reason, and the walkthrough's last beat now puts five of the
  refusals on the page, each with its reason, in the second person.
- **Present, the walkthrough (added 2026-09-16, the demo plan's phase B).** A layer over the three modes, never a
  fourth mode, with its own store key and pure reducers. `Prepare` runs the window once at five seeds and the frozen
  experiment once at twenty paired seeds, in the visitor's own browser through the runtime's ordinary public calls, and
  reports what each took on the visitor's own clock; until both land, `Next` is off and every figure reads
  `not available: nothing has run yet`. After that the model never runs again: each of the eleven beats is a silent
  seek, a pin, an open and a projection. The four chapters are Operations (the evening peak, the hour riders gave up in,
  the recall, a depot ninety minutes later, the release), Analytics (the metric registry under both registers with two
  charts by hour, then the frozen spec in words and the verdict readout), Simulation (which snapshot the frame came
  from, whether its positions are interpolated, read from the frame and not from the option passed in, and then both
  arms of the verdict's own watched seed) and Product sense (the casebook record's situation block verbatim, what the
  run trades as lower one thing and higher another, five refusals with their reasons, and the next casebook question by
  title alone). What keeps it honest: beat clocks are derived from the scenario's declared knobs and never searched, so
  a moved knob moves the beat and a scenario with the release off retitles that beat; no beat starts the clock, so every
  beat teaches from the still frame the script was written around and `Play` stays in the presenter's hands; every
  figure carries exactly one register chip and a verdict figure's chip counts paired seeds, never the window's
  replications; the depot table is the depot drawer's own `depotView` and the readout is the verdict card's own
  builders, so no surface can restate another in different words; and the narration is generated from the run, capped at
  three lines, scanned for direction words over every string, with its four comparing lines pinned on OPS-01 at seed
  1001. A reading card offers a lone visitor the same walk before anything has run.
- **What the demo build did not do.** Phases C and D of the plan are approved and deliberately unbuilt, with no
  scaffolding left behind. Phase C holds the candidate arm drawn in the world with an `A baseline | B candidate` toggle
  at one second (so the arms beat still hides the map region and carries both arms as two lines of numbers), the
  day-long bar under the scrubber with the recall and the release ruled on it, a beat that runs a second seed set, and a
  place for the `Flat` toggle inside `Present`. Phase D holds the phone polish of the presenting layout and the `Try it`
  handoffs into Sandbox and Experiment. Two consequences to say out loud rather than let a viewer notice: the day has no
  strip, so the walk reads clocks; and the change under test is never drawn, only read.
- **Hosted folder.** `pack.mjs --site <folder>` writes a folder for a static host beside the packed file: the modules
  unchanged, `index.html` with a stricter policy (no inline script, everything from the site's own origin), `boot.js` and
  `_headers`; `check-dist.mjs --site` applies the packed file's rules to every file and requires exactly the files the
  packer writes. Putting it online stays an owner action (design §9.4).

## 8. What is not claimed

- **Not a safety case.** No ISO 26262, ASIL, HARA, regulation, assessor or vehicle. The gate
  config schema *requires* the literal label `illustrative_prototype_thresholds_not_for_real_vehicle_use`.
- **Not authenticated.** Tamper-evident against partial edits; nothing more.
- **Not a simulation of the world.** One straight map, no traffic, no sensor model, one seed.
- **Not an agent framework.** No model, no orchestration loop, no skill abstraction, no model has
  ever called the EXECUTE or MUTATE tools.
- **Not machine learning.** No model, training, dataset or RL — by design.
- **Not calibrated.** Every "% of braking authority" is a ratio to a declared constant the
  simulator does not enforce.
- **Not reproducible off this host yet** (§2).
- **Not measured on its own success metrics.** The Phase 8 PRD defines 22; roughly one is
  measured, and that one is near-tautological.
- **Not Phase 9 P0.** One vertical slice (FLEET-005) exists; the other 19 P0 criteria do not.
  The PRD's own §52 says not to use its resume claim before P0 is built — a spike is not P0.
- **Not MuJoCo-integrated.** `adapter` is still `Literal["fake","metadrive"]`.

---

## 9. Defects found and fixed

| Defect | Commit | Why it mattered |
|---|---|---|
| Release gate failed open | `235efec` | A hard finding registered in a profile without its own precedence branch fell through to **PASS while failing**. The first failing ADAS hard invariant would have shipped as a pass. |
| Scenario identity used a forked serializer | `e78d42f` | Missing the canonical `-0.0 → 0.0` normalisation; two YAMLs for the same scenario got different digests, making runs incomparable. |
| Suite could not run on a fresh clone | `10343bf` | 127 failed / 593 passed / 40 errors from gitignored fixtures. Partially fixed — §2. |
| Adding a model field silently invalidated stored evidence — twice | `a6abe7f` | `scenario_digest` / `gate_config_digest` hash `model_dump()`; see landmine 1. |
| Derived spawn speed not float32-exact | `cdb4637` | 18.515 → 18.514999… through MetaDrive's float32 storage; fixed by projecting to binary32 and comparing against the same projection — exact, not loosened. |
| Geometry tolerance used the wrong error model | `65363ae` | The observed gap is a difference of two float32 *positions*; a fixed 1e-6 m held at 40 m by luck and failed at 28.816 m. Now derived from float32 spacing — tighter than the interim relative tolerance at every magnitude. |
| README front-page table and status overclaims | `0c16c8f` | HOLD attribution conflated detection with verdict causation; "fresh clone reproduces" was false. Found by auditing as an outside reader. |
| Fleet metric typos failed only after experiment execution | `2afe4a0` | The authoring boundary now rejects unregistered primary and guardrail metric names before a run can create late, wasted evidence. |
| Fleet aliases were undeclared | `60380b4` | The typed registry records aliases and forces their unit, direction, aggregation, availability, and absence semantics to agree with their targets. |
| Fleet decision records lacked metric-registry provenance | `3a7f595` | A reviewer could not identify which registry defined a valid or invalid record's metrics; the required field and deliberate digest re-baseline close that gap. |

---

## 10. Coordination rules for parallel sessions

Phase 8 is the fragile side: 63 bundles under gitignored `artifacts/`, only 13 regenerable.
Almost every rule exists because the failure mode is **silent**.

**Protecting Phase 8**

1. **[SILENT] Do not add, remove or rename any field on `ScenarioDefinition` or anything
   reachable from it** (`domain/models.py:347-370`). Adding it to `_SCHEMA_4_ONLY_FIELDS` does
   **not** protect schema-4.0 bundles — that list strips only for `schema_version != "4.0"`. New
   domains get a new model under a new namespace, keyed by name. (Widening the `adapter` Literal
   alone is digest-neutral — `model_dump()` emits the value, never the type — verified on all 13
   scenarios.)
2. **[SILENT] Do not run `hermes fixtures regenerate --force`, re-run `make demo-*` to green a
   test, or delete `artifacts/`.** Regeneration restores 13 registered fixtures and permanently
   destroys the other 50. Revert the change instead.
3. **[SILENT] Do not change `ControlConfig.max_braking_mps2` (6.0) to a measured value.** See
   §6.8 — it weakens the oracle. Declare measured authority per-scenario in new YAML.
4. **[SILENT] Leave the `dynamics_limitation` strings in `gates/release.py:225-229` byte-identical
   and pass `adapter_name=` explicitly.** MetaDrive is the *unnamed* `else` arm; a dict-lookup
   refactor silently reassigns it, and the `fake` default stamps a false provenance disclaimer
   into `verdict.json`.
5. **[SILENT] Do not `.get()`-refactor the adapter chains in `evidence/verification.py`
   (750/772/943, 1296-1321), and do not import a simulator from `evidence/`, `gates/` or
   `verifiers/`.** The `else` at `:943` is the only thing that fails an unknown adapter closed
   (and has no test). The boundary test blocks only the literal names `hermes.adapters` and
   `metadrive`; add any new engine name to it in the same commit.

**Protecting Phase 9 / MuJoCo from wasted effort**

6. **Work in a separate git worktree.** `orchestrator.py:170` stamps `repository_dirty` from
   `git status --porcelain`; an uncommitted file in this checkout taints every bundle, and a
   differing `repository_commit` makes any comparison `NOT_COMPARABLE`.
7. **Always `PYTHONPATH=<repo>/src`.** §3.0.
8. **Baseline `artifacts/` before and after any change under
   `src/hermes/{domain,evidence,gates,scenarios,runtime,adapters}`:**
   `for d in artifacts/*/; do printf '%s ' "$d"; hermes verify-artifact "$d" | grep -E 'Artifact integrity|Verdict'; done`
   — expect 60 of 63 `INTERNALLY_CONSISTENT` (3 exceptions pre-exist). A green `pytest` cannot
   detect an identity shift.
9. **The adapter seam has one owner.** `fake`/`metadrive` binaries are scattered across
   `verification.py` (750/772/943/958/1298/1308 — the last two have **no `else`**),
   `gates/release.py:225`, `cli.py` (334/371/392/414), `fixtures/registry.py` (63/95/259),
   `agents/tools.py` (312/363/392), `orchestrator.py` (517/531/552/561), `trace.py:831`,
   `domain/models.py` (355/407/414/422/473). Widening `cli.py:334` without `:392` turns a clean
   `CONFIGURATION_ERROR` into a silent MetaDrive run labelled as something else. One owner, one
   commit, this list as the checklist.
10. **Sandbox code is never imported by `src/`** until a deliberate, reviewed graduation (§7.3).

---

## 11. Next steps by track

Each item states how you know it is done and what it will break.

### 11.1 Phase 8 — remaining, in order

> **Phase 3 merged 2026-08-25** (`a78287e`): the `stationary_lead` kind with a measured
> threat/nominal pair, ADAS observation-fault wiring (a delayed observation now degrades the
> baseline into a *named* failure — fault injection proving the evaluation notices), residual-impact
> enforcement, and two owner-facing design notes (WP-2 composite scenarios, WP-4 `RunMetricsV3`).
> Suite 1118; seeded suite 8 named defects / 10 tests.
>
> **Three corrections were made in review, before merge**, each recorded in
> `PHASE8_IMPLEMENTATION_NOTE.md`:
> 1. **`AdasThreatResponseVerifier` 1.0 → 1.1.** Its observable behaviour changed (residual-impact
>    enforcement plus rewritten criterion text) while the version stayed frozen, so one
>    `(name, version)` pair denoted two behaviours. Bumped at all six pins. It was free at that
>    moment because every ADAS bundle was already invalid.
> 2. **A superseded determinism digest** in the implementation note, re-measured to
>    `54b439ca60e67794…` and annotated with *why* it moves, so the next reader re-measures.
> 3. **Fleet disposition recorded: 14 of 14 ADAS bundles are `INVALID`** under two fail-closed
>    corrections (residual-impact enforcement, then verifier-suite identity binding). A fresh run
>    verifies clean, so the pipeline is healthy; what is invalid is historical evidence produced
>    under superseded verifier identities. **Coordination rule 8's "60 of 63" baseline is stale —
>    re-measure before using it.** Regenerating or retiring the 14 is an owner decision.



> **Phase 2 (calibration) executed and merged 2026-08-24** — reviewed with zero critical/important
> findings. The plan file now carries **Phase 3** (review follow-ups, `stationary_lead` and
> `cut_out_reveal` challenge kinds as threat/nominal pairs, ADAS fault wiring):
> `…/Hermes-adas/Hermes_Phase8_ADAS_Execution_Plan.md`
> (local, untracked). Centerpiece: item 1 below (WP-A), with MuJoCo graduated as a *calibration
> instrument* (`[mujoco-cal]`, `fwdinv` + graduation defaults — the sandbox's Q1 niche answered),
> a Warp CPU kernel, an esmini/OpenSCENARIO audition, and a web-verified tool decision table
> (ADOPT/DEMO/LITERATE/AVOID; 45 claims checked, incl. Isaac/Newton/MJWarp/cuOpt/Waymax reality
> on this host). The plan's environment is pre-verified in that worktree.


1. ~~Brake-dynamics calibration~~ **DONE, merged @ `6b2f375`** — see §6.8. Review follow-ups
   (all MINOR) moved into the Phase-3 plan: derive `repeat_bitwise_identical` from data instead
   of hardcoding; record producer argv in evidence; an evidence self-consistency test over the
   curve JSON; docstring on `ControlConfig.max_braking_mps2` noting the default is unenforced;
   decide wire-vs-document for the dead `max_residual_impact_speed_mps` criterion (a gate-config
   field change re-baselines ADAS digests — plan accordingly).
   *(original item, for context)* **Brake-dynamics calibration (PRD Risk 8) — highest engineering value.** Re-run the probe on
   `map='S'`, `traffic_density=0`, 240 m destination, across 0–30 m/s; fix its arithmetic (§6.8);
   commit the curve as an evidence artefact, not a constant; re-derive the AEB authority
   *fractions* alongside the authority so the oracle keeps discriminating — or honestly relabel
   the onset criterion as simulator-relative. Decide whether `ControlConfig` limits should be
   enforced on the simulator. *Done when* every threshold in `config/gates.adas.yaml` cites the
   measurement and `make demo-adas` no longer fails comfort for an uncalibrated reason. *Breaks*
   every trace digest and every fixture — budget a full re-baseline. **Do before authoring more
   scenarios.**
2. ~~`RunMetricsV3` / evidence schema 3.0~~ **DONE 2026-08-25, accepted, unmerged** —
   `feat/phase8-metrics-v3` @ `2dda024` (15 commits from `a78287e`, pushed and in sync;
   **merged onto `main` 2026-08-26 as `b447fc4`**, conflict-free — §13).
   Evidence schema 3.0 produced for exactly the two ADAS profiles (legacy → V1, non-ADAS fault
   → V2 — routing is exact, not inherited); typed decision plus candidate → permitted → executed
   attribution; independent policy/shield/fault/trace/metrics/findings/gate replay;
   `RunMetricsV3` with 46 display rows, 61 review leaves, 19 computed + 27 typed-unavailable;
   review/comparison schema 2 across CLI, workbench, and agent/citation consumers; V3
   `TraceIntegrityVerifier`/`AdasBrakeOnsetVerifier` 1.1. Measured 2026-08-25 at `ab17958`
   (hermes-dev interpreter, `PYTHONPATH="$PWD/src"`): suite **1,410 passed** (`pytest -q`);
   seeded 10/10; ruff clean; fixtures 13/13; fleet 27/27 (12 consistent, 15 invalid). Real
   seed-7 N=3 acceptance evidence lives **out of tree** at
   `…/Hermes-evidence/adas-wp7-acceptance/ab179583…/attempt-1` (60 files, composite `cefd7bbc…`) —
   **preserve it; deleting that directory destroys the commit-bound acceptance evidence.**
   Final reviews: spec PASS, quality APPROVED, integrity audit zero findings; independently
   re-verified 2026-08-25 by a six-agent read-only pass (trace hash chains and the 60-file
   composite recomputed from scratch). Full handoff:
   `…/Hermes-adas/.superpowers/sdd/phase4-metrics-v3-implementation-plan/task-7-report.md`
   (ignored dir). *Done-when met:* ADAS `metrics.json` carries the ADAS metrics and
   `review-artifact` renders all 61 leaves.

   > **Maintenance pass landed 2026-08-26** — `2dda024` (`fix: fail closed on untyped verifier
   > profiles and refresh stale V3 prose`), implemented by Codex from the reviewed prompt and
   > independently verified the same day by a six-agent read-only pass. Superseded WP-7 backup
   > stash `c82036c` re-verified byte-identical and dropped (no stash refs remain).
   > `run_verifiers_for_profile` now fails closed — explicit `LEGACY` branch, `ValueError` on
   > anything untyped; both stale V3 prose texts refreshed; both `type: ignore[arg-type]`
   > removed by widening `run_phase4_verifiers` to the three-event union; stored-path profile
   > filters aligned to exact `type()` with the `TraceEventV3` inheritance invariant pinned.
   > Measured at `2dda024` (`pytest -q`): suite **1,418 passed** — 8 additive tests, none
   > removed; seeded 10/10; ruff clean; doctor 17/1/1; fixtures 13/13; fleet 27/27. **Fresh
   > six-run seed-7 requalification** at `…/Hermes-evidence/adas-wp7-acceptance/2dda0246…/attempt-1`
   > (60 files, composite `712c3375…`): all eight companion files byte-identical to the
   > `ab179583` attempt, trace digests `3d5866…`/`5eae8e…` reproduced exactly — the
   > zero-behavior-delta proof. **Preserve both acceptance roots byte-for-byte.** Report:
   > `…/Hermes-adas/.superpowers/sdd/phase4-maintenance-pass/maintenance-report.md` (ignored
   > dir). Owner-cut scope stays cut: actor roster, scenario windows, suite normalization,
   > conditional telemetry files, gate-hosted tolerances, post-AEB re-approach. Two Minors
   > logged for a future pass, no action needed: the widened union moves a latent
   > static-typing mismatch one call deeper into `_fault_coverage` (no checker configured, no
   > runtime effect), and the new stored-V2 test type-checks only `events[0]` (schema
   > homogeneity already validated upstream).
3. **P0 scenario catalog** (this note was re-measured 2026-08-26 — the old "four remaining /
   two kinds / touches oracle" text was stale). Done: `aeb_stationary_lead` (+ delay variant,
   Phase 3) and **`fcw_stationary_lead` merged 2026-08-27 (`deeca8c`)** — warning-margin
   envelope on the `stationary_lead` kind, measured margin 2.9 s, geometry coverage only
   (warning-OUTPUT verification is deliberately unimplemented); landed with the
   **derived-map adapter change** (`metadrive_map_for_gap` shared by producer and verifier;
   committed scenarios stay byte-identical on `"S"`; gap 140 → `"SSS"`) and **conditional
   adapter `1.2`** (closed-set version contract, eleven-case matrix; cross-era claim is
   re-verifiability only, never comparability — see the 2026-08-27 decision-log entry).
   Remaining: `slow_lead_closing` + nominals `fcw_aeb_nominal_following`,
   `decelerating_but_safe_lead`, moving `adjacent_lane_pass` — unlocked by the
   **`steady_lead` contract, owner-approved as written 2026-08-27**
   (memo: `…/Hermes-adas/.superpowers/sdd/phase8-p0-fcw-scenarios/steady-lead-owner-memo.md`,
   ignored dir; `decelerating_but_safe_lead` needs the separate `lead_decelerates`
   decision). **Implemented 2026-08-28** on `feat/phase8-steady-lead` (2 commits from
   `deeca8c`: the kind at `de19c19`, the pair `slow_lead_closing` +
   `fcw_aeb_nominal_following` at `de29de7`) and independently verified by a six-agent
   pass: suite **1,521** (+39 fully accounted), an INDEPENDENT rerun reproduced the
   report's trace/events digests bit-for-bit, and the per-step speed check was proven
   non-vacuous against a hash-consistent forgery (typed rejection). Measured: threat
   PARTIAL at seq 10 (2.44 m/s²), four intervention cycles, min gap 4.01 m, zero
   collisions, CONDITIONAL; nominal 61 events, zero braking, gap opens +1.18 m,
   CONDITIONAL. **Both owner calls resolved 2026-08-28**: the measured Decision-8 values
   ACCEPTED and the `actor_speed_mps > 0.0` narrowing RATIFIED; **merged onto `main` as
   `df0e34e`** (conflict-free; the one README overlap merged additively). Report:
   `…/Hermes-adas/.superpowers/sdd/phase8-steady-lead/report.md`.
   **`adjacent_lane_pass` implemented and verified 2026-08-28** on
   `feat/phase8-adjacent-pass` @ `5173daa` (one commit, YAML-only, the catalog's only
   MOVING exact-mirror pair — identical numbers to `slow_lead_closing`, one lane over):
   suite 1,527 (+6 accounted), independent rerun reproduced the report's trace/events
   digests digit-for-digit, front pair absent 61/61 events through the seq-36 overtake,
   stored-lateral sign inversion documented. **Accepted and merged onto `main`
   2026-08-28 as `bd60b5b`** (conflict-free; README merged additively). The
   **`lead_decelerates` contract memo was APPROVED as specified the same day**
   (`…/phase8-adjacent-pass/lead-decelerates-owner-memo.md`: scripted constant-rate
   member, `STEADY→DECELERATING→STEADY`, strictly positive terminal speed per the
   ratified `gt=0.0` rationale; author `decelerating_but_safe_lead` first, ACC flavor
   deferred). **`lead_decelerates` + `decelerating_but_safe_lead` implemented, verified,
   and merged 2026-08-29** (`a721d60` kind / `579ca12` nominal on
   `feat/phase8-lead-decelerates`, merged as `cb0b535`; branch pushed): six-agent
   verification with a live reproduction matching every stored measurement to full
   precision (min gap 20.8293 m, max a_req 0.6016 m/s² standoff-adjusted, min TTC
   4.3542 s, phase windows exact, byte-identical determinism); suite **1,566**
   (+39 fully accounted). Owner RATIFIED 2026-08-29: the three local-only commit
   amendments (no pre-amend SHA ever reached a remote — AGENTS.md §19's blanket
   no-history-rewriting text is Phase-6-era and does not distinguish local/shared;
   ratification covers exactly these three) and the qualified defect-evidence ruling
   (the actor-presence defect's all-hard set {progress.required, no_false_intervention}
   reported beside the hard-ADAS singleton — a strengthening). Known issue carried
   (fix before reuse): the UNUSED `lead_decelerates` arm of
   `tests/unit/test_canonical_trace.py::_fault_challenge_event` swaps input/result
   phases (observable only at `decel_start_step==1`; nothing committed calls it; misuse
   fails loudly). The Task-A WIP stash on the branch is byte-superseded by `579ca12`
   (safe to drop whenever). **P0 catalog position: every entry has its dedicated
   scenario except roster-blocked `cut_out_reveal_stopped` and decision-deferred
   `acc_lead_decelerates`.** Oracle is kind-agnostic by test. Nominal exposure ≥30%
   holds as a designed property (6 threat-tagged / 7 nominal-tagged after this lane).
4. ~~Wire the faults to ADAS~~ **DONE** (Phase 3) — observation faults enabled for the exact ADAS
   policy identity, with a measured delay scenario whose baseline degrades into a named finding.
   `orchestrator.py:514-528` bars observation faults on MetaDrive — written for IDM, which ignores
   observations; the ADAS controller does not. Revisit, do not work around.
5. **ACC, two-stage gate, review-envelope variation axis** (`review/models.py:2615`, `:2105-2114`,
   `projection.py:1565-1578` are the traps). Then release-brief agent, sweeps, workbench panels,
   `agent-trace.jsonl` (blocked on the bundle's exact-inventory rule).
6. **Small:** `scenarios/cut_in.example.yaml` and `config/gates.example.yaml` fail validation
   (21 and 8 errors) — refresh or delete; `*.parquet` gitignored with pyarrow/pandas undeclared.

### 11.2 Phase 9 — after the FLEET-005 spike (2026-08-23)

Done: worktree + branch (rule 6) ✓; additive domain, no `SimulatorAdapter` involvement ✓; the
spike with its refusal paths ✓; clean-clone gate ✓. Next, in order:

1. **FLEET-006 with a minimal policy seam** — nearest vs an OR candidate behind a
   `DispatchPolicy` contract with decision-time-only views, latency counted, `[fleet-or]` extra.
2. **FLEET-003 (charger outage) needs the charging model**; author regime pairs and keep
   outcomes separate per regime (no post-hoc MIXED).
3. **Spec-file authoring is done:** `hermes fleet experiment template`, `validate`, `run`, and
   `inspect` make the committed YAML spec the entry point. **Not done:** the decision-record
   Comparison page on the workbench.
4. More analytical fixtures: the hand-computed three-request world exists
   (`test_fleet_analytical_fixture.py`); add an M/M/c depot check against closed form.
5. Development-vs-evaluation seed separation and the leakage defects (ORACLE_LEAKAGE provider)
   when the forecast seam lands.
6. The MetaDrive→FleetLab parameter bridge stays P1 and still needs §11.1 item 1's curve.
7. **Resolved:** the Phase 9 PRD has been tracked since `aa04786`.
8. **Stage 2 complete:** the decision record records metric-registry provenance with the one
   deliberate digest re-baseline, and the static operator view is the second registry consumer.
   The decision-record Comparison page remains open.
9. **Stage 3:** put dispatch behind a decision-time-only policy seam before adding a candidate.
10. **Playground merge is an owner decision.** The branch is local. Before merging, run the node suite and the parity and
    boundary pytest with `FLEET_PLAYGROUND_BASE=bca4ccd`, and decide on the CI step for `node --test`. Review design D-12
    (the recall acts once) and the use cases whose lessons the calibrated default does not show (UC-07, UC-08).
11. **Evidence-path follow-ups from the playground design** (§14 there): reject world-feeding axes in `apply_axis` (FL-1,
    FL-11); a registry bump for clipped utilization with a recorded re-baseline (FL-2); record not-evaluable guardrails
    instead of skipping them (FL-3); transition-level invariants (FL-4, FL-5).

### 11.3 MuJoCo — before graduation

1. Name the niche (Q1). Nothing else is justified until this exists.
2. Fix the probe's peak/mean arithmetic and run it at 20 m/s on the scenario-faithful config —
   this is the one artefact with a buyer today.
3. Apply the sim-consult graduation defaults (`implicitfast`, armature, `fwdinv` + logged
   residual) in the sandbox first.
4. Only then: the `adapter` Literal + schema-5.0 `MujocoScenario` block + a `_SCHEMA_5_ONLY_FIELDS`
   strip (landmine 1), a real `MujocoAdapter` returning real pydantic models, mujoco in the
   declared dependencies, the engine name added to the architecture-boundary test, and the
   verification mirror (`verification.py:772-942` is the template — ~170 lines per adapter).

### 11.4 Repository hygiene

- **Add a LICENSE** (owner's choice; MIT or Apache-2.0 usual). Without one the public repo is
  legally unusable by visitors.
- ~~**Decide about `main`**~~ **Done 2026-10-23:** `main` is the GitHub default branch and the trunk (PR #7). CI runs on pushes to `main` and on pull requests, but has never passed (top section).
- **Declare the simulator dependency** or state the clean-clone numbers wherever "tests pass" is
  claimed.
- `git rm --cached Hermes_Fable5_Full_Project_Fresh_Eye_Design_Review_Master_Prompt.md` if its
  `.gitignore` entry reflects intent — it is tracked and public today.

---

## 12. Landmines

- **Playground R6 runs only with its base.** `tests/unit/test_fleet_playground_boundaries.py` checks that the playground
  branch never changed `src/hermes/`, `pyproject.toml`, `.gitignore`, `Makefile` or `.github/` only when
  `FLEET_PLAYGROUND_BASE` names the base commit; a plain full-suite run skips that check. The playground parity vectors
  also assert Python 3.11: widening the pin moves FleetLab's means and digests.

1. **Any new model field can invalidate stored evidence.** `scenario_digest` and
   `gate_config_digest` hash `model_dump()` and are re-derived in verification. Every version-only
   field must be stripped for older versions (`_SCHEMA_4_ONLY_FIELDS` in `scenarios/loader.py`,
   `_SCHEMA_2_ONLY_FIELDS` in `gates/config.py`); an unstripped field that dumps to `null` still
   changes every digest, and `verification.py:1147-1150` byte-compares the resolved YAML too.
   Never edit an existing adapter's `evidence_config` — version the adapter instead.
2. **Bundle capture is bidirectionally exact.** `verification.py:347` rejects any file not in
   `REQUIRED_ARTIFACT_FILES`; optional files are not implementable — new files must be schema-gated
   required files.
3. **A verifier profile's finding set is matched for exact equality**, including each finding's
   `(verifier, version, hard_invariant)` triple. Register in both `EXPECTED_FINDINGS_BY_PROFILE`
   and `EVIDENCE_REQUIREMENTS_BY_PROFILE`.
4. **MetaDrive stores actions as float32** and the adapter aborts on any difference between
   requested and accepted action. Quantise every new command path to binary32.
5. **Regenerating fixtures needs a clean worktree.**
6. **Profile selection lives in one place** (`select_verifier_profile`). Keep it single.
7. **Any value derived from a trace crosses a float32 boundary.** Use `_geometry_agrees` in
   `evidence/trace.py` rather than choosing a tolerance. *If you find yourself choosing a
   tolerance, the error model is probably wrong.*
8. **Do not let the promoter self-approve.** `approve` and `promote` are separate verbs on purpose.
9. **A regression case that merely runs is worthless** — it must discriminate.
10. **MetaDrive 0.4.3 can crash on init when fully headless** (`engine_core.py:213`,
    intermittent `IndexError`). Retry on `IndexError` around env construction.
11. **MuJoCo determinism needs `mjSTATE_INTEGRATION`**, not qpos/qvel; and `refsafe` silently
    clamps contact stiffness to the timestep.
12. **Hermes declared `horizon_steps` can overstate exposure** — check `termination_reason`.
13. **`AebConfig` default fractions encode the 20 m/s measured peak specifically.** A scenario
    declaring a different measured authority gets different absolute staging than the documented
    2.4/4.2 m/s²; one silently falling back to the 6.0 Python default stages at 1.11/1.94 m/s².
    Declare authority explicitly in every new ADAS scenario.
14. **`max_braking_mps2` does dual duty**: oracle denominator *and* the generic baseline
    policy's decel-to-pedal divisor (`policies/baseline.py:52`). Committed ADAS runs are
    unaffected (fixed brake constants), but a generic-policy run on an ADAS scenario now
    commands ~46% of the former pedal fraction.
15. ~~`max_residual_impact_speed_mps` is dead~~ **WIRED** (Phase 3) into
    `adas.aeb.threat_response`; still vacuous at verdict level because contact already HOLDs via
    `collision.zero`, which is stated honestly rather than sold as new coverage.
16. **A verifier whose behaviour changes must move its version.** Phase 3 shipped a semantics
    change under a frozen `1.0`, caught in review. Six pins must move together: the identity
    tuple, the four emission sites, and the profile registry. Changing any verifier identity
    re-digests the suite and invalidates every stored ADAS bundle — which is correct, and is why
    the cheapest moment to bump is when the fleet is already invalid.
17. **A single-actor evidence contract cannot express a composite scenario.** The observation
    summary is an exact 18-field set with one unlabelled challenge actor; switching its subject
    mid-run would be an unprovable identity change. See the WP-2 design note before attempting
    `cut_out_reveal`, and note that `adas_nominal_slow_closing` overstates "steady throughout" —
    its lead brakes on the final step.
18. **The FLEET-005 decision-record digest is pinned by
    `test_the_fleet_005_demo_record_digest_is_pinned`.** A moved pin is a deliberate re-baseline
    recorded in the commit and §7.1, never a drive-by update.

---

## 13. Open decisions that need a human

| Decision | Why it is open |
|---|---|
| Should `adas.aeb.brake_onset_margin` be a hard invariant? | Soft today; making it hard needs the scenario to declare whether severity-reducing late intervention is acceptable, and nothing declares that. |
| Should `config/phase8-approvals.yaml` be committed? | Gitignored, so approvals are unauditable; committing puts approver names in history. |
| Should promoted regression scenarios auto-commit? | Promotion writes into `scenarios/adas/`; a human commits by hand, deliberately. |
| Should the review envelope honour the declared variation axis? | Core comparator does; review path is strict; they can disagree about the same pair. |
| Is content-digest approval the right granularity? | A whitespace edit forces re-approval. |
| Should the threat oracle read omniscient state rather than the trace? | Stronger; not implemented (§6.2). |
| Phase 7A acceptance and any merge of the codex branch. | Built, not accepted; 7B blocked. |
| ~~Merge `feat/phase8-metrics-v3` onto `main`?~~ **Decided 2026-08-26: merged** (`b447fc4`, conflict-free — only `src/hermes/cli.py` overlapped, additively). Branch-side evidence stands, commit-bound to `2dda024`; the merge commit was deliberately **not** separately requalified (its `src`+`tests` tree is the verified branch plus disjoint fleet files). | Any future claim of merge-commit-bound evidence still needs a fresh six-run attempt at `b447fc4` or later. |
| ~~Authorize the MetaDrive longer-map derivation?~~ **Approved and executed 2026-08-26** — Tasks 0/A landed on `feat/phase8-p0-fcw-scenarios` (`b8defdd` shared derivation in `simulator_support.py`, every committed scenario stays `"S"`; `cae6c28` `fcw_stationary_lead` at 140 m, measured warning-margin 2.9 s, suite 1,471, all gates green; Phase-4 acceptance roots re-verified INTERNALLY_CONSISTENT under the new verifier). **HELD unmerged**: final review found the no-version-bump rule wrong for the declared input space — legacy long-gap (100.5–120 m band) adapter-`1.1`/`"S"` bundles, valid before, are now rejected (the verifier derives `"SSS"` with no version discriminator). | **Resolved 2026-08-27**: conditional adapter `1.2` landed as `fd82ead` and was independently verified (six-agent pass — suite 1,482; eleven-case matrix probed independently: the legacy `1.1`/`"S"` long-gap blocker shape now accepted, crossed/unknown shapes rejected at the correct layer; both acceptance-root composites byte-intact; zero transitional `1.1`/derived-map residue). Branch `feat/phase8-p0-fcw-scenarios` (3 commits from `b447fc4`) **merged onto `main` 2026-08-27 as `deeca8c`** (conflict-free, zero overlapping files). Cross-era claim is RE-VERIFIABILITY only, never comparability. The steady-lead owner memo was **approved as written 2026-08-27** — §11.1 item 3 carries the follow-through. |
| Track the Phase 9 PRD in git? Push `main`? Set a default branch? LICENSE? | §11.4. |
| Name the MuJoCo niche; assign an owner. | Nothing graduates without both. |

---

## 14. Housekeeping and known inconsistencies

- The ADAS worktree's copy of this file is **stale by design** (branched at `7a6cfe6`, before
  the FleetLab updates). The ADAS executor must not edit it; results are folded in here. Two
  entries live in the shared `…/Hermes/.git/info/exclude` (affects all worktrees, no tracked
  file): `third_party` (the ADAS worktree's symlink to the vendored simulator) and
  `/Hermes_Phase8_ADAS_Execution_Plan.md`.

- The ADAS worktree moved to `feat/phase8-metrics-v3` on 2026-08-25 (Phase 4). Its Phase-4
  working papers (task briefs/reports, review diffs, the maintenance-pass prompt and report)
  live under `…/Hermes-adas/.superpowers/sdd/` — ignored by that directory's own `.gitignore`,
  deliberately untracked. The Phase-4 acceptance evidence is **outside git entirely** — TWO
  immutable roots under `…/Hermes-evidence/adas-wp7-acceptance/`: `ab179583…/attempt-1` (composite
  `cefd7bbc…`) and `2dda0246…/attempt-1` (composite `712c3375…`); treat both as immutable
  (§11.1 item 2).

- The main checkout `…/Hermes` was switched to `main` (Phase 0) by a parallel session on
  2026-08-22 ~22:09 (`git reflog`); `main` has since become the integration trunk (ADAS trunk,
  FleetLab, metrics-V3 merged). **Its untracked `artifacts/` tree is a stale pre-Phase-3
  generation**: at merged `b447fc4`, exactly 8 named byte-pin tests fail there
  (`test_artifact_verification` ×2, `test_comparison` ×2, `test_fixture_registry` ×1,
  `test_review_projection` ×2, `test_wp6_v3_consumers` ×1 — all reading local
  `phase1-nominal`/`handoff-p4-fault` bundles), while the identical code passes 1,418/1,418 in
  the ADAS worktree, whose `artifacts/` holds the canonical 27-bundle fleet matching the
  tracked registry digests. Run ADAS validation in the worktree; syncing the canonical bundles
  into the main checkout (overwriting its stale strays) is an open housekeeping option — an
  owner call, since it replaces local evidence files.

- `Hermes_Fable5_Full_Project_Fresh_Eye_Design_Review_Master_Prompt.md` is in `.gitignore` (line
  47) **but tracked** (committed in `9efb811`). Public today.
- `HERMES_PHASE9_FLEET_SIMULATION_PRD.md` and `PHASE8_SANDBOX_HANDOFF.md` were gitignored
  defensively on 2026-08-22 because `git add -A` in either session would have committed them.
- `sandbox/mujoco/SIMULATION_DESIGN_PACKAGE.md` §7 and header describe the branch as unpushed
  at `64ef395`; stale — the sandbox session's document, not edited here.
- Stale figures caught and corrected this phase: "12 P0 scenarios" (22 + 4); "comparison ✗"
  (delivered since `801d38d`); a pre-rewrite determinism digest; "fresh clone reproduces every
  demo" (it does not). Treat any number in any other document as suspect unless it cites a
  command.
- `.superpowers/` is ignored by its own nested `.gitignore`, not the root one.
- The Makefile `demo-flywheel` comment previously promised an approval and dry-run step the
  target does not run; corrected 2026-08-22 — the target stops at the listing by design.
- Three Stage 1 commits on `feat/phase9-metric-contract` carry no parseable `Co-Authored-By`
  trailer: `1164f2e` and `d569672` hold a literal `\n\n` in the body, so the trailer sits
  mid-line, and `2afe4a0` has none (a `Tests:` trailer instead). Recorded 2026-09-04 and left
  as is — the branch is not rewritten (no amend, rebase or squash);
  `git log aa04786..HEAD --format='%h %(trailers:key=Co-Authored-By)'` shows the gap.

---

## 15. Document map

**Status and plan — this file only.** Readable copy: the artifact URL in the header. The
separate "Hermes Evidence Lab" artifact is the portfolio page, not a status document.

**Reference (deep material, linked from here, not status):**

| Document | For |
|---|---|
| [README.md](README.md) | Front door and full command surface |
| [PHASE8_DESIGN_SPEC.md](docs/hermes/phase8/PHASE8_DESIGN_SPEC.md) | Why Phase 8 is shaped this way; §11 open questions |
| [PHASE8_IMPLEMENTATION_NOTE.md](docs/hermes/phase8/PHASE8_IMPLEMENTATION_NOTE.md) | Decisions forced by the code; deviations; where it is thin |
| [PHASE8_BASELINE_AUDIT.md](docs/hermes/phase8/PHASE8_BASELINE_AUDIT.md) | Sprint 0 survey; the risk register (§6) that §11 cites |
| [docs/hermes/architecture/decision-log.md](docs/hermes/architecture/decision-log.md), [docs/hermes/architecture/phase1-…phase4-*.md](docs/hermes/architecture/) | Phase 0–4 decisions and architecture |
| [docs/hermes/phase6/PHASE6_*.md](docs/hermes/phase6/), [BUILD_PLAN.md](docs/archive/phase6-pack/BUILD_PLAN.md), [VALIDATION_MATRIX.md](docs/archive/phase6-pack/VALIDATION_MATRIX.md) | Phase 6 trust model, threat model, usability plan (`NOT YET OBSERVED` rows), validation matrix |
| [PHASE7_EVALUATION_ADEQUACY_AND_HUMAN_VALIDATION_DESIGN.md](docs/hermes/phase7/PHASE7_EVALUATION_ADEQUACY_AND_HUMAN_VALIDATION_DESIGN.md) | Phase 7 design (implementation in the codex worktree) |
| `HERMES_PHASE7_ADAS_AGENTIC_WORKFLOW_PRD.md` | Phase 8 PRD — private, never in git; since 2026-11-03 in the owner's private archive outside the repositories; §0-A normative |
| [docs/README.md](docs/README.md) | What lives where under `docs/`: `hermes/`, `fleetlab/`, `releases/`, `plans/`, `archive/` |
| [HERMES_PHASE9_FLEET_SIMULATION_PRD.md](docs/hermes/phase9/HERMES_PHASE9_FLEET_SIMULATION_PRD.md) | Phase 9 PRD — tracked since `aa04786` |
| [docs/plans/2026-09-13-fleetlab-playground-design.md](docs/plans/2026-09-13-fleetlab-playground-design.md) | FleetLab Playground design, audited, with D-12, the measured use cases and the operations casebook (§4.4); §14 lists FleetLab defects found |
| [playground/fleetlab/README.md](playground/fleetlab/README.md), [playground/fleetlab/ARCHITECTURE.md](playground/fleetlab/ARCHITECTURE.md) | How to open, pack (one file or a hosted folder) and test the playground; its build contract |
| `sandbox/mujoco/{NOTES,SIMULATION_DESIGN_PACKAGE}.md` | MuJoCo sandbox — local, gitignored, NOT EVIDENCE |

**Historical (Phase 5–6 era; superseded as entry points, kept for the record):** since
2026-11-03 in [docs/archive/phase6-pack/](docs/archive/phase6-pack/): `CURRENT_STATE_HANDOFF.md`,
`CODEX_HANDOFF.md`, `PROJECT_BRIEF.md`, `MASTER_PROMPT.md`, `prompts/` and the Phase 6 agent
instructions as `AGENTS_PHASE6.md`. The Phase 5 set is in `docs/archive/phase5-instructions/`
(its `AGENTS.md` renamed `AGENTS_PHASE5.md`, so Codex never applies it). The root `AGENTS.md` is
now a short pointer to this file.

**Removed 2026-08-22, content folded here:** `PHASE8_STATUS.md`, `PHASE_ALIGNMENT.md`,
`PHASE8_HANDOFF.md`, `HERMES_OVERVIEW.md`, `PHASE8_GETTING_STARTED.md`.

---

*Simulation-only prototype. Illustrative thresholds. Not road-safety, certification, compliance,
or deployment evidence.*


## City explorer status — September 29, 2026

The isolated `apps/fleetlab-city/` experiment is an **unqualified local review build**, not a Hermes evidence workbench extension or production service. It sources an accounted SF road snapshot and records a synthetic 100-vehicle depot experiment. Its graph/resource model has no endogenous traffic. All 12 evaluation pairs and five sensitivity pairs are retained; source-support and human qualification gaps block city recommendations. The six city contracts are separate from the canonical Hermes bundle contract. See `docs/fleetlab/city-explorer/FLEETLAB_CITY_SF_VALIDATION.md` for actual validation, limitations, Git identity and reproduction. Existing legacy behavior, public release and authority boundaries remain unchanged.

### 2026-09-29 — SF visitor-experience enhancement

The current City Explorer review package is `dist/city-explorer-v2-reviewed/`, served locally
at port 4173 (and USB-forwarded port 4175 for Pixel review). The source remains an uncommitted
overlay on `codex/fleetlab-city-sf`. Map/detail controls, replay comprehension and summaries
were enhanced without changing the frozen simulator runs or recommendation gates.
See `docs/fleetlab/city-explorer/FLEETLAB_CITY_UX_V2_VALIDATION.md` for current evidence and
`docs/fleetlab/city-explorer/FLEETLAB_CITY_PRESENTER_GUIDE.md` for the demo narrative and twelve-pair interpretation.
The previous SF validation record remains historical; no public City Explorer release or
physical-device pass is implied by this update.

### 2026-09-29 — SF qualification candidate and launch staging

The current review package is now `dist/city-explorer-v3-final/` on port 4173. Its release
manifest SHA-256 is `7450c2aaf5e5ca90e2f5cbf6cf7d05cf6520f11b1f92267bbdf511c557ce2926`.
It introduces a guided welcome path, sourced vehicle-design learning gallery and separate
SF v2 qualification candidate. Original v1 recorded experiment data remains unchanged.
The v2 routing profile reduces unsupported eligible length to 1.322%, but remaining road
classes, district coverage, human semantics and cross-leg history still block qualification
and candidate fleet execution. Vehicle references are not calibrated operator models.

A local Pages stage retains every legacy file and both compatible viewer releases; a separate
rehearsal verified route headers and rollback. Nothing was published. The original assessment
section 7 release boundary remains in effect. Physical Pixel v2 replay/restart was observed;
the final v3 phone sweep was interrupted by Mac lock and remains pending. Use
`docs/fleetlab/city-explorer/FLEETLAB_CITY_V3_VALIDATION.md` for current evidence and limits,
`docs/fleetlab/city-explorer/FLEETLAB_CITY_LAUNCH_PREPARATION.md` for the concrete launch stage, and
`docs/fleetlab/city-explorer/FLEETLAB_NEXT_PHASE_BRIEF_V3.md` for the next-phase product handoff.

### 2026-09-29 — SF power experiment implementation and v4 corrections

Current review viewer: `dist/city-explorer-v4-final/`, local port **4182**, release
`920887f3fb0841b066f26a996d8c9c157fc47c1e9f2cff0b70837c069c80f0a2`.
It fixes direct Play click bubbling, clarifies recorded energy/violations and adds reviewed
study/export interfaces. Original scientific results remain unchanged. The local combined
stage retains all 99 legacy files and compatible current/prior City releases; shared-site
navigation and publication are unchanged.

The new six-arm power experiment completed 24 preflight arms but **zero evaluation arms**:
evaluation was refused at its initial memory check. A reviewed, unapplied fix and explicit
replacement-study proposal await the owner's decision. No new power-study finding is
available in the viewer. Map continuity and human-review contracts are reviewed design
deliverables; map qualification is still open.

Use `docs/fleetlab/city-explorer/FLEETLAB_SF_POWER_BUILD_VALIDATION_2026-09-29.md` for actual tests/browser evidence
and limitations, `docs/fleetlab/publishing/FLEETLAB_WEBSITE_INTEGRATION_PLAN_2026-09-29.md` for placement, and
`docs/fleetlab/city-explorer/FLEETLAB_POWER_STUDY_MEMORY_AMENDMENT_PROPOSAL_2026-09-29.md` for the pending revision.
