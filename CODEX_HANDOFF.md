# FleetLab visual experience — October 10, 2026

Current implementation and release status: [October 10 handoff](docs/FLEETLAB_VISUAL_EXPERIENCE_HANDOFF_2026-10-10.md). Next proposed Network Flows lesson: [NF-04 design specification](docs/FLEETLAB_NETWORK_FLOWS_NEXT_DESIGN_SPEC_2026-10-10.md). These dated records supersede older website navigation and publication status below; they do not clear SF qualification, Q1/Q8/N2 or physical deployment boundaries.

---

# FleetLab audit response, September 28, 2026

## September 29 enhancement — atlas layout, fleet insights and owner contact

Current enhancement is live as production `ed4b1d68-3130-4833-9f93-b170c8f3cbb9`,
source `773f36b42b22eae032c4465d6f8af13ea1572c66`; complete package
`build/fleetlab-city/launch-integration-v2/site`.
35 City Node / 122 City Python / 66 focused combined Node tests pass; the clean
viewer and local combined package pass. Review is clear. Publication and device
results are recorded in `docs/FLEETLAB_CITY_INTEGRATION_RELEASE_2026-09-29.md`.
The updated next-phase brief `docs/FLEETLAB_NEXT_PHASE_BRIEF_V3.md` explains the
100-vehicle population and lists SF acceptance evidence still required before
new cities. Existing site, map/experiment records and offline bytes are preserved.


## City Explorer integration — 29 September 2026

The owner approved additive City Explorer navigation and live website publication. The combined release preserves all established sections and offline bytes; only root boot/index/headers are intentionally changed. Live production `b592d5a8-c89c-4b42-99ca-e6d256bd2408` is verified: all 9,934 served payloads match; source implementation commit `3236065`. Current release and remaining scientific/device work: `docs/FLEETLAB_CITY_INTEGRATION_RELEASE_2026-09-29.md`. The power-study execution amendment and map/human qualification remain held. This website authorization does not authorize Hermes workbench or physical deployment.

This is the current wave. Earlier sections are historical where they differ. The owner
explicitly requested assessment of an external audit, implementation of supported changes,
build/test/validation, a repository push and live publication. The audit's own approval
language and business assumptions are review material, not authority. Current user scope
supersedes the historical Phase 6 no-push/no-publication rule for this static site.

## Assessment and implementation decisions

| Finding | Decision and evidence |
|---|---|
| F01: unclear hero | Agree with the comprehension problem. Updated wording is **Test fleet decisions. In simulation.** The subhead names a browser-based teaching simulator for autonomous-vehicle fleet operations and tells the visitor what to do. The primary CTA opens Fleet day; it does not claim to execute it. Metadata agrees. The proposed implication that this is a prerequisite for changing a real fleet is avoided. |
| F02: discoverability | Add Scale lab as the seventh header link, including mobile. The walkthrough already has footer and Approach entry points; no duplicate eighth primary destination is needed. Existing URLs, idle-on-entry behavior and active-link/focus semantics remain. |
| F03: inconsistent names | Agree, but keep **Four-area experiments** for root navigation, H1 and document title. Generic **Paired experiments** would blur the distinction from Fleet day and Scale lab, which also support paired tests. Lesson-specific headings remain intentional. |
| F04: float artifacts | **Not reproduced; no formatting change.** Production DOM attribute/value/valueAsNumber and accessibility text show `1.6` and `0.02`; input/blur/run retains `1.6`. No default number input has more than eight fractional digits. The default run reproduces 95/284 completed, 176 unserved, four waiting and nine in progress, seed 42. Unconditional rounding would alter legitimate submitted values or obscure a threshold; a failing reproduction is needed before changing this path. Existing numerical pins remain. |
| F05: personal provenance | Personal byline deferred pending the owner's optional preference; no new personal claim is published. The footer now explains that FleetLab belongs to Hermes, an independent simulation and evidence-review project, and discloses AI assistance. The Approach page already explained Hermes; the audit's claim that no page did so was inaccurate. Do not call Hermes a company or research studio without evidence. |
| Caption size and contrast | Increase selected welcome/brand/disclosure captions and teaching chips to 11px. The cited `#526762` on `#fafbf7` measures **5.8145:1**, not a 4.5:1 failure. This is a readability improvement; existing semantic/status colors and contrast tests remain. |
| Reduced motion | Already implemented: static poster, no automatic download/play with reduced motion, explicit manual play. Existing film tests verify this. No duplicate behavior added. |
| Long-run feedback | Already implemented: running heading, live progress status and Cancel. Painted browser check observed **0 of 20 runs finished** and Cancel; the completed four-area result remains VALID / UNCHANGED / NO_RECOMMENDATION. A spinner is unnecessary to communicate this state. |
| First-run guidance | Move the existing **Your first three minutes** section immediately after the welcome/film caption. Preserve its instruction sequence and explicit run action. No auto-run, result fabrication or new deep-link execution semantics. |

Retain the warm ivory/teal design and four separate teaching models. Defer a new methodology
hub, filter persistence, dark-mode controls and social-image work: they are separate product
increments, not established defects in this release. Existing light-theme overrides and
literal surfaces mean a dark switch is more than exposing one token block. No named common
dispatcher, live-looking homepage result band, cinematic rebrand, pitch overlay, unverified
endorsement or operator-adoption claim is added. Numerical outcomes remain in their model
and run context. The audit's comparative superlatives are not evidence of market leadership.

Human comprehension and first-run completion tests are sound proposed research; no
participants were recruited or outcomes measured here. No field performance claim is made.
The current owner request concerns the existing website; Q8 and the model roadmap remain
separate queued work.

## Repository and validation

Started at `2f1ad0620f055e07e39ba0df5f91fa6364e56f8f` on
`codex/fleetlab-welcome-design`. Remote `github/feat/fleetlab-playground` was fetched at
`756c26991c95be94ed6b12bc9d92ff68ed8d343f`, an ancestor; the earlier welcome release's two
local commits are included in the authorized fast-forward push. The unrelated untracked
owner note is preserved and excluded. Protected model/core/instrument/runtime/data/legacy
and Python source remain byte-for-byte unchanged from this wave's base.

- Focused tests: 97 tests, 96 pass, one existing TODO, zero fail. Changed navigation/naming
  assertions failed before implementation. A second old six-link expectation was found
  in the full suite and updated to seven; its route behavior test then passed.
- First full performance-enabled serial run: 1,973 tests, 1,970 pass, two fail, one existing
  TODO, 277.98 s. Failures: the old six-link expectation and `experimentSteps on the
  reference preset: every gap...`, at 8.19 ms against 8 ms. One isolated timing rerun passed
  at **7.49 ms**. No timing threshold or numerical pin was changed.
- Second full performance-enabled serial run: 1,973 tests, 1,971 pass, one fail, one
  existing TODO, 283.195 s. The previous failing timing test passed; unchanged
  `run_window` failed at **12.36 ms** against 8 ms, then its isolated rerun also failed
  at **11.56 ms**. `run_pair` passed both. No threshold was relaxed.
- Diagnostic comparison after navigating our browser to `about:blank`: the exported
  baseline `2f1ad06` and candidate each passed both unchanged runtime benchmarks.
  Baseline: **5.80 / 5.50 ms**; candidate: **5.35 / 5.63 ms** for window/pair. Other
  desktop processes were active during the earlier failures. This supports timing
  variability; it does not establish which process or mechanism caused a delay.
- Final full performance-enabled serial suite with our browser paused: **1,973 tests,
  1,972 pass, zero fail/cancel/skip, one existing TODO**, **284.799 s**. Runtime window
  and pair read **6.62 / 6.08 ms**; experiment steps read **6.41 ms**. Earlier failures
  remain recorded above; a passing run does not establish a hard real-time guarantee.
- Python parity/boundary gate: **89 pass**, 5.32 s, with `FLEET_PLAYGROUND_BASE=bca4ccd`
  and this checkout's `PYTHONPATH`. Ruff and whitespace checks pass. Node 22.22.0,
  Python 3.11.15 in `hermes-dev`; no dependency installation needed.
- Doctor: 17 PASS, one expected dirty-tree WARN, one optional display NOT_AVAILABLE.
- Independent read-only code review: no outstanding findings. Painted header checks at
  768 and 1101px specifically address the reviewer's breakpoint concerns.
- Painted Chromium: 1440x900, 390x844, 768x1000, 1101x900 and 375x812. No page overflow;
  seven menu links fit and selecting Scale closes the menu. Welcome boundary remains
  above the fold on both phone sizes (bottom 606.67 and 631.83 CSS px respectively).
- Root experiments nav/H1/title agree. Progress and Cancel observed. Completed result:
  `playground-spec:34d504c1`, VALID / UNCHANGED / NO_RECOMMENDATION; wait p90 -3.4 s,
  interval -10.2 to +0.4, margin 30 s.
- At 375px, intake reproduces `scale-spec:1aa8c833`, +0.185, interval +0.172 to +0.196;
  Result receives focus and a named, focusable region contains the wide result table.
- Hosted package: **99 files / 3,366,216 bytes**, inventory SHA-256
  `201969c35585b755d0d4b2c8e10c6a7cb74b576fd8285e2ba3c81e2e86a3a63a`.
- Offline package: **2,424,861 bytes**, SHA-256
  `169388571013337332b33aad79d7e4576e6490f07ec70322ced188dfd0c8c130`.
  Growth **101 bytes** against 2,424,760; below the 4,096-byte wave stop. Reserved bytes
  remain 135,904; unassigned headroom is 60,675. Both package checks pass; no assets,
  dependencies, tracking, accounts, storage or remote ingestion were added.

Commands are the same full Node, scoped Python, Ruff, doctor and both distribution gates
listed in the welcome release below. Logs, browser measurements and screenshots for this
wave are ignored under `dist/audit-validation/`; they are not uploaded or committed.

## Publication

**Published and verified.** Source **`e90764a99661a579de3dc976afedc45e7417f49a`** was
pushed without force to `github/feat/fleetlab-playground`, fast-forwarding `756c269`.
The push includes the earlier welcome source and records commits. No PR or main merge.
Production **`f4018c2a-3127-4807-af90-3a4ae0f33faa`** serves https://fleetlab.pages.dev/;
immutable address https://f4018c2a.fleetlab.pages.dev/. Wrangler 4.135.0 uploaded four
changed files, reused 94 public files and applied `_headers`; Pages metadata confirms
Production, source `e90764a`, branch `feat/fleetlab-playground`.

Both packages were rebuilt from a committed-source export and match all **99 hosted
files** and the offline HTML exactly. The initial isolated export omitted the contracts
module needed by `check-dist`; that validation invocation stopped with “no label tuple.”
Including the same commit's `src/hermes/fleet/contracts.py` in the local validation export
resolved the harness setup; both distribution checks then passed. It is not a site file.
Wrangler's dirty-tree warning refers to the preserved unrelated untracked owner note;
the committed rebuild proves the uploaded input. Only `dist/site` was uploaded.

**98/98 public files match by SHA-256 and bytes on both addresses. All six configured
response headers match.** Painted production checks show the revised welcome and seven
navigation links. Scale entry stays idle; intake then reproduces `scale-spec:1aa8c833`,
+0.185, interval +0.172 to +0.196, and focuses Result without page overflow. Four-area
navigation, root H1 and title agree. Fleet day reproduces **95 completed, 176 unserved,
four waiting and nine in progress of 284 requests**, seed 42; numeric inputs show 1.6
and 0.02. These hosted interactions supplement the local viewport checks above.

Rollback target: **`1e1202c9-4fa0-4b46-a5f7-22863b48aafb`**, source `347bcfb`,
https://1e1202c9.fleetlab.pages.dev/. All six Production deployments remain available.
The records-only follow-up to this source changes no deployed input. Source and release
records are on the authorized release branch; other worktrees have not been moved.

Limits remain: no physical-device, Safari, Firefox, screen-reader, CPU-throttled performance,
Core Web Vitals, full painted lesson sweep, human comprehension study or broad Python-suite
claim. The static release has no operational deployment authority and is NOT_EVIDENCE.

---

# Historical welcome design release, September 28, 2026

This section records the prior welcome release. The current audit-response section above
supersedes it where they differ. The existing build queue and undecided model work remain.

## Current wave

The owner requested a welcoming, professional visual refresh, build, test, validation and
publication of the existing static FleetLab experience. Work started at `756c269`, whose
site inputs match `1aeaace`, on `codex/fleetlab-welcome-design`. An unrelated untracked owner
note was preserved. No push, PR, simulator execution, backend, dependency or data change.
The current deployment instruction supersedes the historical Phase 6 publication restriction
for the static playground only. The architecture amendment records this scope decision.

Warm ivory and teal unify the welcome, teaching panels, catalog and results. The existing
concept film is framed beside the welcome; direct links enter Fleet day and Scale lab.
A compact mobile menu retains six destinations. Scale result tables receive named keyboard
scroll regions. The synthetic teaching boundary is visible on entry. No model, core,
instrument, runtime, data, legacy implementation or numerical pin changed.

## Validation before publication

- Final serial Node suite with performance enabled: **1,973 tests, 1,972 pass, zero fail,
  zero skipped, one existing TODO**, 280.65 seconds, Node 22.22.0.
- Python parity and boundary suite with `FLEET_PLAYGROUND_BASE=bca4ccd` and this checkout's
  `PYTHONPATH`: **89 pass**, 4.97 seconds, Python 3.11.15. Ruff and `git diff --check` pass.
- Doctor in `hermes-dev` with this checkout's `PYTHONPATH`: 17 PASS, one WARN for intended
  working-tree changes, one optional display NOT_AVAILABLE. No simulator was launched.
- Independent code review found a tablet background/order conflict; fixed and reviewed
  again with no remaining findings. Painted 768 and 900 px checks confirm the fix.
- Tests first exposed missing direct Scale entry, missing welcome boundary, missing mobile
  menu state and missing table focus. These fail before implementation and pass afterward.
  The old exact palette pin was updated for the intended colors; contrast checks were kept.
- Painted Chromium at 1440x900 and 375x812: all three Scale defaults reproduce their labels
  and readings, Run stays in the first screen, focus moves to Result, no page overflow.
  Named wide result regions take focus. Held intake preserves its HOLD despite an improved
  primary measure. Mobile navigation opens, closes and navigates correctly.
- Fleet day: 95/284 completed, 176 unserved, four waiting, nine in progress, seed 42.
  Street comparison: 37 to 41 completed of 71, with +37.5 km empty distance; mixed trade-off.
  Four-area default: `playground-spec:34d504c1`, VALID / UNCHANGED / NO_RECOMMENDATION;
  wait p90 -3.4 seconds, interval -10.2 to +0.4 against a 30-second margin.
- Catalog filtering to Scale lab and searching intake returns one of 59 lessons.
  Film playback/pause and pause on navigation pass. Product approach has no page overflow.
- Hosted package: **99 files / 3,366,116 bytes**. Inventory SHA-256:
  `b039c11c4c3d76cdfe358041feb85ae903491390e43b697768c47a58186e45d5`.
- Offline package: **2,424,760 bytes**, SHA-256
  `8bb4ea9b2f03346458755bd5bc203a2e7b0f006f86b0fc7f6dc01ae7a64d97d7`.
  Growth 16,410 bytes versus 2,408,350; below the 20,000 wave stop. 135,904 reserved bytes
  remain untouched; 60,776 bytes remain unassigned under the hard cap. Both distribution
  checks pass, including policy, URLs, copy, tokens, labels and hosted file inventory.

Reproduce from the repository root (Python commands run in `hermes-dev`):

```sh
FLEET_PLAYGROUND_PERF=1 node --test --test-concurrency=1 playground/fleetlab/test/*.test.mjs
FLEET_PLAYGROUND_BASE=bca4ccd PYTHONPATH="$PWD/src" PYTHONDONTWRITEBYTECODE=1 python -m pytest -q -p no:cacheprovider tests/unit/test_fleet_playground_parity.py tests/unit/test_fleet_playground_boundaries.py
PYTHONPATH="$PWD/src" python -m ruff check --no-cache .
PYTHONPATH="$PWD/src" python -m hermes doctor
node playground/fleetlab/tools/pack.mjs --site dist/site
node playground/fleetlab/tools/check-dist.mjs --site dist/site
node playground/fleetlab/tools/pack.mjs --out dist/fleetlab-playground.html
node playground/fleetlab/tools/check-dist.mjs dist/fleetlab-playground.html
git diff --check
```

## Publication and remaining checks

**Published and read back.** Source `347bcfbd3dc20b830f1a59eeda3fc80403d894d0`, Production
`1e1202c9-4fa0-4b46-a5f7-22863b48aafb`, stable https://fleetlab.pages.dev/ and immutable
https://1e1202c9.fleetlab.pages.dev/. Wrangler 4.135.0 uploaded four changed files and reused
94 files, then applied `_headers`. Pages metadata uses `feat/fleetlab-playground`; source
is committed locally on `codex/fleetlab-welcome-design` and **has not been pushed**.

Both packages were rebuilt from a `git archive` export of this commit; all 99 hosted files
and the offline HTML match the checked worktree packages exactly. **98/98 public files**
match by bytes and SHA-256 on **both** deployment addresses. All six configured response
headers match `_headers`, including `connect-src 'none'` and frame-embedding denial.
Initial Python urllib readback received HTTP 403; curl on the same public URLs completed
the entire readback successfully. No access-control setting was changed.

The browser opened the production welcome with painted frames. All three production Scale
runs reproduce `scale-spec:b4c7f5da` (+62.6, interval +60.6 to +64.4),
`scale-spec:1aa8c833` (+0.185, interval +0.172 to +0.196) and `scale-spec:443de567`
(-12,992.0, interval -13,394.8 to -12,545.8); each focuses Result without page overflow.
The production phone welcome/menu and Fleet day run were also exercised. The viewport
was restored after QA. The self-contained offline build loaded and ran intake with `scale-spec:1aa8c833`, +0.185, interval +0.172 to +0.196;
focus moved to Result and there was no page overflow. The deployment command was:

```sh
npx --yes wrangler@4.135.0 pages deploy dist/site --project-name fleetlab --branch feat/fleetlab-playground --commit-hash 347bcfbd3dc20b830f1a59eeda3fc80403d894d0 --commit-dirty=false
```

Wrangler warned about the unrelated untracked owner note. No tracked source changes were
present, and the committed-export equality check verifies the uploaded source independently.
Rollback: previous Production `77922688-6d87-4d15-94bf-442beab31712`, source `1aeaace`,
immutable https://77922688.fleetlab.pages.dev/. No rollback or remote Git action occurred.
This records-only follow-up changes no site input.

Q1 remains **partially complete**: these are painted Chromium checks, not CPU-throttled
phone measurements. No physical phone, Safari, Firefox, screen reader, complete painted
59-lesson sweep, ten-run resize-observer accounting, security scan or broad Python suite
is claimed. Browser elapsed values include automation overhead and are not instrumented
press-to-paint timings. Q8's simulated-period replay remains queued. No private preparation
material is included in the public site or release record. Results remain NOT_EVIDENCE,
simulation only, decision authority NONE; nothing here establishes real-world safety.

Local logs, screenshots and inventory are ignored under `dist/validation/` and are not
part of the public package. Do not stage them or the unrelated untracked owner note.

---

# Historical handoff before the welcome release, September 28, 2026

Read this section before any FleetLab work. It covers every FleetLab wave up to 2026-09-28: what is live, what is public, what waits for the owner and what to build next. It was updated on 2026-09-28 with the owner's answers to the four questions of section 7.0, the heading fix release and the push. The state of 2026-09-27 was read on that day between about 22:30 and 23:15 Pacific time from git, the pins files, the records of the `Hermes-scale` worktree and read-only inventories of the live site, the branches and deployments, and the plans. Rows marked "measured for this handoff" were taken at about 23:10 to 23:15 Pacific on that day. Later on 2026-09-27 the lead added a sweep of the lesson links in a real browser and a second full serial run at `1aeaace`, and committed the records in one documents commit on top of `1aeaace`, which is `44569f8`. On 2026-09-28 the lead made the privacy commit `0bc2f25`, deployed `1aeaace` as Production `77922688`, committed these records in one records commit on top of `0bc2f25`, and right after that commit pushed the branch head to github. The sections below describe that commit and that push as made. A record cannot name the hash of the commit that holds it, so this file calls it "the records commit of 2026-09-28".

FleetLab is an independent, synthetic teaching simulator under `playground/fleetlab/`: static HTML, CSS and JavaScript with no backend, no account, no storage and no network request beyond its own files. It is not affiliated with any operator, vehicle maker, regulator or utility. Every result is NOT_EVIDENCE, simulation only, decision authority NONE. The repository is public.

## 1. Read this first

| Item | State |
|---|---|
| Live address | https://fleetlab.pages.dev/ (stable) and https://77922688.fleetlab.pages.dev/ (immutable) |
| Deployment | Cloudflare Pages project `fleetlab`, Direct Upload, Production deployment `77922688-6d87-4d15-94bf-442beab31712`, uploaded with Wrangler 4.135.0 on 2026-09-28 on the owner's answer B (section 7.0). The upload held 98 files and `_headers`: 1 file new to the host (`src/ui/studio.js`) and 97 files already held. The Pages branch label reads `feat/fleetlab-playground`; it is a label, not the git branch of the source. Rollback target: `19e17ac6-d617-4789-9260-ca259c53e076`, the Scale lab release of 2026-09-27 from source `c08f60d` (section 2.4). The project holds four Production deployments: `77922688`, `19e17ac6`, `dd4bfa44` and `f08b6b6f` |
| Deployed source | `1aeaacecb25e17853f852d7bbd7141ff75d9cb69`, "fix: reset the Fleet day heading when a launch lesson opens". The lead built the site from a `git archive` export of that commit. It is one commit past `c08f60d`, the Scale lab source of 2026-09-27, and changes one site file, `src/ui/studio.js` (27 bytes more in each package), and one test file |
| What that source contains | The D1 release (`b99ab04`) plus 18 later commits: the D1 release record `790573e` (public since the D1 release), N2 design documents, the offline packer change `8e04b49`, the T1 teaching frames (`caaf8f2`, with records up to `c79eccf`), the eight Scale lab commits (`2caeac6` to `c08f60d`) and the heading fix `1aeaace`. The site has 10 route addresses and 59 lessons: 18 Fleet day, 6 Street lab, 32 four-area, 3 Scale lab |
| Branch head now | The records commit of 2026-09-28, on top of the privacy commit `0bc2f25` (2026-09-28), the documents commit `44569f8` (2026-09-27) and `1aeaace`. None of the three documents commits changes a site input, so the site inputs of the branch head equal those of `1aeaace`, the deployed source. No site input is undeployed |
| Pushed | **Yes.** On the owner's answer A, the lead pushed the branch head to github on 2026-09-28, right after the records commit, as a fast-forward of `feat/fleetlab-playground` from `790573e`. The push published 20 commits, the deployed source `1aeaace` among them (section 3). The remote branch `github/feat/fleetlab-playground` stands at the records commit, and 0 commits of the branch head are on no remote. No remote branch named `claude/fleetlab-scale-lab` was created. A push does not deploy. The public default branch `main` (`bca4ccd`) still has no `playground/` folder |
| Tests at the deployed source `1aeaace`, whose site inputs the branch head keeps | Two full serial runs with the performance flag, each 1,969 tests, 1,967 pass, 1 fail, 1 existing todo. Run 1, while other work loaded the machine, 342.8 s: the failure was the response reserve timing test, "timing on the reference laptop" in `test/scale-response.test.mjs`, longest block 9.34 ms against a limit of 8 ms. Run 2, machine otherwise idle, 292.9 s: the failure was a four-area runtime timing test that this wave did not change, "run_window and run_pair gaps on the reference preset" in `test/runtime.test.mjs`, largest run_window gap 11.34 ms against 8 ms. Each failure passed its one isolated rerun, the second at 5.73 ms (run_window) and 5.52 ms (run_pair). No run at `1aeaace` failed a test other than a timing test. A full run at `1aeaace` with zero failures is not recorded. Measured for this handoff at `1aeaace`, Node v22.22.0: the studio test and the four Scale test files without the flag, 101 tests, 95 pass, 6 skipped (the timing tests behind the flag), 0 fail; Python parity and boundary 89 pass in 5.02 s; `ruff check` all checks passed; `git diff --check` clean; both package checks OK |
| Tests at `c08f60d`, the previous release | Full serial Node suite with the performance flag: 1,968 tests, 1,967 pass, 0 fail, 0 cancelled, 0 skipped, 1 existing todo, in 281.9 s. The four Scale test files: 92 of 92. Python parity and boundary tests: 89 pass. `ruff check`: all checks passed |
| Readback | At the release of 2026-09-28: 98 of 98 public files match the local package by SHA-256 and size on both addresses. Hosted package 99 files with `_headers`, 3,349,629 bytes, inventory SHA-256 `dd3c2f2a659b18a0caacf5df639238916719f8a5294e653c2566ac39328e94b5`; offline file 2,408,350 bytes, SHA-256 `ccd3f7a01a3ddd03dd8a58336c52da32a50ec1c7b0b27a297b5e82496877325a`; both package checks OK, run with the repository's tools, which are identical at `1aeaace`. Response headers unchanged and verified. Earlier, measured for this handoff on 2026-09-27 at 23:13 Pacific: 98 of 98 public files on the stable address against a fresh build of a `git archive` export of `c08f60d`, whose hosted inventory SHA-256 is `5c071dc69e353f6118ab43078c12d2470c9d709cf2ac7c501fe4fb807c669da3` (99 files with `_headers`, 3,349,602 bytes) |
| Hosted checks of 2026-09-28 | In the in-app browser with the pane hidden, so no frame was painted. The fix works: after airport-preparation, and after cleaning, the region-launch lesson shows the main heading "Fleet day" and the document title "Rehearse commissioning in Region B". The three labs record `scale-spec:b4c7f5da`, `scale-spec:1aa8c833` and `scale-spec:443de567`. Fleet day default seed 42 on a fresh load reads 95 completed, 176 unserved, 4 waiting and 9 in progress of 284 requests; the cleaning lesson setup reads 82 of 284 requests, which is that lesson and not a regression. The three press times were 4,725 ms, 1,058 ms and 2,660 ms against 4,790 ms, 1,103 ms and 2,656 ms on the previous deployment `19e17ac6` in the same session and conditions, so no regression; both sets are slower than the readings of 2026-09-27 because of the state of the pane. A same-origin fetch that the tester attempted was refused by the page's own policy `connect-src 'none'`, as intended. No application console error |
| Owner decisions | **Ratified by the owner on 2026-09-28** (answer C, "accept all"), as recommended: the 25 decisions of the Scale lab design (table 7.2), its package decisions D1 to D11 and the T1 exceptions T-E1 to T-E5 (table 7.3). Decision 3 grants the 7,548 bytes over the lead's target. Still open, with their recommended defaults holding until the related work starts: O7 (merge to `main` and CI), O8 (custom domain, automation), O9 (each N2 step and T2 item), O10 (licence), O11 (Austin lesson ids) and every pending N2 decision (OD-7 to OD-18, OD-20 to OD-26, C-32, G2). Section 7 lists them |
| Uncommitted | Nothing of this wave. The records of 2026-09-28 are in the records commit of 2026-09-28; the privacy edits are in `0bc2f25`; the ten document files of 2026-09-27 are in `44569f8`: five modified (`CODEX_HANDOFF.md`, `HERMES_SOURCE_OF_TRUTH.md`, `docs/FLEETLAB_CLOUDFLARE_DEPLOYMENT.md`, `playground/fleetlab/ARCHITECTURE.md`, `playground/fleetlab/README.md`) and five new under `docs/`. None of them is a site input |
| Not yet done | The owner's look in a visible browser (O1): no painted frame of any page of the Scale lab release or of `77922688` has been seen at any stage, because every browser check so far ran with the pane hidden (section 2.1). Q1, acceptance in a visible browser (design gates 5 and 6: a pane of 1440 by 900 px and a throttled phone), then Q8, an operating view of one simulated period: the next builds by the owner's choice (answer D). Also: a full serial run at `1aeaace` with zero failures, a screen reader, Safari, Firefox, a security scan, the broad Python suite, and the lesson snapshot declared again for 59 lessons |

State in one line: the heading fix is live as `77922688` and reads back byte for byte, its source is public on `feat/fleetlab-playground`, and the owner has ratified the Scale lab and T1 decisions; it waits for the owner's look in a visible browser, then Codex takes Q1 and Q8.

## 2. Deployment status

### 2.1 What https://fleetlab.pages.dev/ serves today

Since 2026-09-28 the stable address serves `1aeaace` as Production `77922688`. It differs from the Scale lab release `c08f60d` of 2026-09-27 in one site file, `src/ui/studio.js`, which fixes the launch lesson heading (the fixed row of the defect table below). The sweeps and tables of this section were made against `c08f60d`; since no other site file changed, every other fact of this section holds for `1aeaace`.

Two sweeps of the lesson links ran after the deployment of `c08f60d` on 2026-09-27.

In a real browser. The lead opened the stable address https://fleetlab.pages.dev/ in the in-app browser (Chromium engine) with the pane hidden, so no frame was painted, and opened every lesson link of the catalog (59) and the 9 page routes by changing the address hash, with no reload between them. Result: 0 error pages; 59 lessons by page (Fleet day 18, Street lab 6, Four-area experiments 29, Four-area workspace 3, Scale lab 3); 6 header links; no console error; exactly one lesson whose main heading did not match its document title, `#/fleet-day?lesson=region-launch` opened after another Fleet day lesson (the first known defect below).

On the fake DOM. Every public file was downloaded from the stable address, checked against the release inventory and mounted on the repository's fake DOM (no layout, no paint), then visited route by route and lesson by lesson. Result: 10 route visits, 59 lesson visits and 4 deliberately bad links; 0 error pages from a good link; 0 network attempts, 0 engine run calls, 0 storage or cookie accesses and 0 exceptions over 78 navigations. It saw the same heading defect. The fake DOM measures structure and text, not what a browser paints.

Neither sweep painted a frame, and neither did the hosted checks of 2026-09-28 (section 1). No person has looked at any page of the Scale lab release or of `77922688` with a visible pane.

Header, footer and head of every page.

| Place | Content |
|---|---|
| Header | A monogram and "FleetLab by Hermes", a "SIMULATION LAB" status mark, a "Skip to main content" link and 6 navigation links: Overview, Fleet day, Street lab, Four-area experiments, Learning catalog, Product approach. There is no Scale lab link in the header or the footer, by design decision 1 of the Scale lab |
| Footer | "FleetLab / Hermes", a creator credit line, 3 links (Learning catalog, Product approach, Guided walkthrough) and "Simulation for learning and exploration" |
| Head | Title "FleetLab \| Fleet operations, made visible", a meta content security policy, and description and Open Graph text that describe 18 Bay Area places and two vehicle profiles. That text predates the Scale lab |

Pages, as the live `src/ui/routes.js` defines them.

| Address | Document title (before " · FleetLab by Hermes") | Main heading | What a visitor finds |
|---|---|---|---|
| empty, `#/overview` | Overview | Every great ride starts with a ready fleet. | A concept film labelled "Concept illustration · not simulation output" with a Play film button; a depot stage explorer with 4 stages; 4 decision cards in a two by two grid, the fourth ("Fleet scaling") opening the Scale lab; a three-step first-visit guide; a model boundary section |
| `#/fleet-day` | Fleet day | Fleet day | A result-first synthetic Bay Area day on frozen OpenStreetMap routes: 18 places, a vehicle profile mix, a 3D map with camera controls, a timeline, a result summary, comparisons of fleet and depot size, vehicle profiles, staffing and bays and one operating policy, the Austin power and readiness stress lab (TX-AUS-01), the Region B launch rehearsal, an attributed map download, and the line "Fleet day stops at 120 cars. For what changes as a fleet scales, open the Scale lab." |
| `#/street-lab` | Street lab | Street lab | Directed San Francisco streets with block queues in 5 s steps: 6 corridor presets, Run street scenario, Compare route policies, a 3D view, an attributed street map download |
| `#/experiments` | Four-area workbench | Run an A/B test | The paired A/B workbench. It loads UC-08a (4 against 6 cleaning bays at SF-1) without running, then offers a six-step declared test and Freeze and run |
| `#/regional` | Four-area workspace | Explore a day | The four-area sandbox: Run window and replay |
| `#/walkthrough` | Guided walkthrough | One question, one day, one verdict. | The presenter over OPS-01, about 6 min, in 4 chapters: Operations, Analytics, Simulation, Product sense |
| `#/catalog` | Learning catalog | Which lesson answers my question? | 59 lesson cards, each with its teaching frame and a "Run this lesson" link; search; a model filter with 5 options; a question family filter with 10 options; "Start here"; a glossary of 20 terms |
| `#/approach` | Product approach | Start with the operator. Work back to the model. | People and decisions, a worked product hypothesis, a roadmap, evaluation questions, a non-affiliation sentence |
| `#/scale-lab` | Scale lab | Density ladder: one depot cell, five fleet sizes | The three Scale labs behind one chooser; the table below |
| an unknown route or a bad lesson link | Link could not be loaded | This setup needs attention. | The reason, the sentence that no simulation was run, and one button, "Open the overview" |

Lessons by model. Every lesson address opens its page with one visible main heading and a document title of the form "lesson title · FleetLab by Hermes", and runs nothing.

| Model | Lessons | Address form | Lesson ids |
|---|---:|---|---|
| Fleet day | 18 | `#/fleet-day?lesson=<id>` | bay-area, vehicle-mix, fleet-day, weather-day, rush-hour, depot-count, cleaning, charging, shared-power, software, upload, full-cycle, staffing-readiness, power-redistribution, deadline-charging, resource-freshness, airport-preparation, region-launch |
| Street lab | 6 | `#/street-lab?lesson=<id>` | street-first, street-harrison, street-stockton, street-van-ness, street-embarcadero, street-lombard |
| Four-area experiments | 32 | 29 on `#/experiments?lesson=<id>`, 3 on `#/regional?lesson=<id>` | On `#/regional`: bay_teaching_map, L1, L3. On `#/experiments`: L2a, L2b, UC-01, UC-02, UC-03, UC-05, UC-08a, UC-08b, UC-10, OPS-01 to OPS-20 |
| Scale lab | 3 | `#/scale-lab?lesson=<id>` | density-ladder, fleet-intake, response-reserve |
| Total | 59 | | |

Question families in the catalog filter, lessons each: depot work and capacity 14; roads and streets 9; demand, crowds and weather 9; fleet size and supply 6; energy and charging 5; launching a new area 5; reading a run and a result 4; recall, release and depot choice 4; scaling the fleet 3. Evidence chips over the 59 lessons: 10 "One replay", 11 "One seed, same demand", 38 "Paired test".

The three Scale labs. The chooser order is the story order. Each lab has one primary button, "Run the paired test", with Cancel and a progress meter during a press; before a press its status reads "Nothing has run yet. Press Run the paired test."

| | Density ladder | Fleet intake | Response reserve |
|---|---|---|---|
| Main heading | Density ladder: one depot cell, five fleet sizes | From delivered to in service | Response reserve for an area-wide event |
| Model version | scale-density-1.0.0 | scale-intake-1.0.0 | scale-response-1.0.0 |
| Geography | Nine neighbouring places of the Fleet day road map | A fictional market as weekly counts, no map | A fictional market as counts, no map |
| Paired seeds | 10 (31001 to 31010) | 12 (7001 to 7012) | 12 (3001 to 3012) |
| Controls a reader sets, defaults in brackets | Comparison of 3 depot plans (capacity); street load at the first rung 0.64 to 0.72 of car time in steps of 0.02 (0.68); depot load at the first rung 0.40 to 0.60 of capacity at the busier site in steps of 0.05 (0.50) | The other arm, site power ordered for the middle or the end of its lead range (middle); site power lead time 24 to 56 weeks (48); ports lead time 16 to 28 weeks (24) | Event load 1.2 to 1.6 times capacity, declared step 0.1 (1.3); lever, reserve staff or a directive (reserve); lever lands after 15 to 240 min in steps of 15 (45) |
| Default press label | `scale-spec:b4c7f5da` | `scale-spec:1aa8c833` | `scale-spec:443de567` |
| Map credit on the page | "© OpenStreetMap contributors" linked to the copyright page, the licence name "ODbL" and the road table sentence, in every state | none | none |

Entry points to the Scale lab: the fourth Overview card ("Open the Scale lab", `#/scale-lab`); the Fleet day introduction ("open the Scale lab" after "Fleet day stops at 120 cars."); the catalog "Start here" entry for the density ladder; 3 catalog cards; the catalog model filter "Scale lab" and the question family "Scaling the fleet". The plain `#/scale-lab` address shows the last Scale lab lesson opened in the session, and the density ladder on a fresh load.

Teaching frames of the T1 wave, public since the deployment `19e17ac6` of 2026-09-27 (feature commit `caaf8f2`). They were recorded as local only until the Scale lab deployment carried them.

| Feature | What is on the page |
|---|---|
| A frame for every lesson | 59 of 59 lessons: chips for question family, model, evidence type and test kind; "What & why", "How we simulate", "Learning & ops takeaway" with "What to look for" and "Ops takeaway to test"; a "Limits and what this misses" disclosure; the sentence that numbers from different models are not interchangeable |
| Page frames | 21 frames for pages and panels outside a lesson |
| Lesson titles | A lesson link puts the lesson title in the main heading |
| Edited marker | "Setup changed from this lesson. The frame still describes the lesson setup." after an edit |
| Glossary | "Words used here", 20 terms, with first-use tooltips for p90, paired seeds, guardrail, margin, unserved and empty distance |
| Run readings | After a run, a sentence built only from recorded fields: outcome words, the guardrail that stopped a change, a next test |
| Casebook readings | 20 pinned readings for OPS-01 to OPS-20, each tied to its seed-set labels |
| Exact values | "Exact values" disclosures beside readings |

What the site never does, with the evidence.

| Claim | Evidence |
|---|---|
| No network request from the page beyond its own files | Response policy `connect-src 'none'`, `form-action 'none'`, `default-src 'none'`; 0 occurrences of `fetch(`, `XMLHttpRequest`, `WebSocket`, `EventSource`, `sendBeacon`, `importScripts` or `serviceWorker` in the downloaded code; 0 attempts in the fake DOM visits |
| No storage and no cookies | 0 occurrences of `localStorage`, `sessionStorage`, `indexedDB`, `document.cookie` or `caches.` |
| No telemetry | No analytics or tag script. `src/ui/analytics.js` is the Analytics chapter of the four-area app, not telemetry |
| No account and no form that submits | No sign-in; `form-action 'none'` |
| No foreign code or media | `script-src 'self'`, `worker-src 'self'`, `media-src 'self'`, `img-src 'self' data:` |
| No simulation on arrival | 0 run messages in 69 arrivals. The page does post one lookup table warm-up (`warm_tables`) to its own engine worker at load; it builds two memoized tables and produces no result. This dates from 2026-09-14 |
| Downloads are made in the page | Map, setup and result downloads are `data:application/json` links built from in-page data |
| Package check | `node playground/fleetlab/tools/check-dist.mjs --site` on the copy of `c08f60d` downloaded on 2026-09-27 plus the built `_headers`: OK, 99 files, 3,349,602 bytes. At `1aeaace`, the package of the release of 2026-09-28: OK, 99 files, 3,349,629 bytes |

The concept film on the Overview has no source until it plays; playing loads `media/fleet-film.mp4` (1,079,939 bytes) from the same origin. Read from the code; not verified in a browser in this pass.

Response headers, read with `curl -I` on 2026-09-27 on both addresses and verified unchanged at the release of 2026-09-28: status 200; `content-security-policy: default-src 'none'; script-src 'self'; worker-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; media-src 'self'; connect-src 'none'; form-action 'none'; base-uri 'none'; frame-ancestors 'none'`; `x-frame-options: DENY`; `x-content-type-options: nosniff`; `referrer-policy: no-referrer`; `cross-origin-opener-policy: same-origin`; `cache-control: public, max-age=600`. Pages adds `access-control-allow-origin: *` on both and `x-robots-tag: noindex` on the immutable address. `/index.html` answers 308 to `/`. Any unknown path, `/_headers` included, answers 200 with the page itself, so the site has no 404 page and a status code alone proves nothing in a readback.

Known defects of the live site, with the one fixed on 2026-09-28 first.

| Defect | Where | State |
|---|---|---|
| After another Fleet day lesson, `#/fleet-day?lesson=region-launch` kept the previous lesson's main heading while the document title and the launch panel named the launch lesson. A fresh load was right | `src/ui/studio.js` | **Fixed in `1aeaace` and live since `77922688` (2026-09-28).** On the live site, checked with the pane hidden: after airport-preparation, and after cleaning, the launch lesson shows the main heading "Fleet day" and the document title "Rehearse commissioning in Region B". Both sweeps of 2026-09-27 saw the defect. The lead confirmed it on the live site after a reload and from three starting pages, and reproduced it on the fake DOM at the T1 head `c79eccf` and at `c08f60d` with identical results. The previous Production `dd4bfa44` (D1) does not set the heading per lesson at all, so the defect came in with the T1 teaching frames and became public with `19e17ac6` |
| Going back to a lesson address discards the recorded result and the edited setup | `src/ui/studio.js`; Scale lab and Fleet day | Open |
| After a Fleet day lesson, the plain `#/fleet-day` keeps the lesson title in the main heading while the document title reads "Fleet day" | Navigation keeps a loaded setup by rule | Open, by rule |
| The document title of `#/experiments` reads "Four-area workbench"; the header link reads "Four-area experiments" | Routes and header | Open |
| The meta description and Open Graph text predate the Scale lab | `index.html` | Open |
| A leftover D1 label, "Regional experiment model" | `src/ui/depot-scene.js:106` | Open, D1 follow-up D1R-5 |
| The Scale lab items of section 9 (decimals, typed steps, one rounding row) | Scale lab | Open |

### 2.2 Deployment history

Wrangler lists 4 deployments on project `fleetlab` and 10 on project `fleetlab-playground`. All 14 are Production and carry the label `feat/fleetlab-playground`. Dates come from the release records or, where none names the deployment, from the source commit.

Project `fleetlab`, stable address https://fleetlab.pages.dev/.

| Deployment | Source | Wave and date | Record | Source pushed | Role now |
|---|---|---|---|---|---|
| `77922688-6d87-4d15-94bf-442beab31712` | `1aeaace` | Launch lesson heading fix, 2026-09-28 | Section 1 of this file and source of truth section 7.5, entry of 2026-09-28 (in the records commit of 2026-09-28) | Yes, on 2026-09-28 | Production. Its 98 public files equal a build of `1aeaace` (99 files with `_headers`, 3,349,629 bytes) |
| `19e17ac6-d617-4789-9260-ca259c53e076` | `c08f60d` | T1 teaching frames plus the Scale lab, 2026-09-27 | `docs/FLEETLAB_SCALE_LAB_RELEASE_2026-09-27.md` (in `44569f8`) | Yes, on 2026-09-28 | **Rollback target** (section 2.4). Its 98 public files equal a build of `c08f60d` (99 files with `_headers`, 3,349,602 bytes), measured on 2026-09-27 while it was Production |
| `dd4bfa44-7226-4502-9d66-01bb1790f2b6` | `b99ab04` | D1 result-first Fleet day, 2026-09-26 | `docs/FLEETLAB_D1_RELEASE_2026-09-26.md` | Yes | Former rollback target, until 2026-09-28. Its 89 public files equal a build of `b99ab04` (90 files, 3,189,179 bytes) |
| `f08b6b6f-c5d0-44f7-905b-5f16087fbc85` | `345b427` | Regional power stress lab, first release of the new project, 2026-09-25 Pacific | Source of truth section 7.5, "Current address and review follow-up" | Yes | Former rollback target |

Project `fleetlab-playground`, former address https://fleetlab-playground.pages.dev/.

| Deployment | Source | Wave and date | Record |
|---|---|---|---|
| `6265159a-a13e-4ca7-9f9c-4acde9bcf6e7` | `345b427` | Regional power stress lab, 2026-09-25 Pacific. Still this project's Production | Source of truth section 7.5, "Publication follow-up" |
| `e72ae87d-6b96-47a0-950d-4d4a87b8bb95` | `96fde5b` | Design release: addressable lessons and setup sharing, 2026-09-24 Pacific | `docs/FLEETLAB_REVIEW_AND_NEXT_PHASE_2026-09-25.md` |
| `40858080-b229-44f1-8169-4f8b4faf5c86` | `7874c7e` | Depot M1 to M4 and scenario learning, 2026-09-24 | `docs/FLEETLAB_DEPOT_RELEASE_2026-09-24.md` |
| `ccb82b11-986c-4ad1-8658-e1bc30917992` | `f85a28f` | Homepage film, 2026-09-19 | `docs/FLEETLAB_FILM_RELEASE_2026-09-19.md` |
| `0b302024-3840-474c-a806-f11792740267` | `10863f2` | Street congestion lab, 2026-09-19 | `docs/FLEETLAB_STREET_RELEASE_2026-09-19.md` |
| `5f2ce6b9-c91c-4f8c-b935-1fba64af954a` | `b65895d` | Bay Area 3D public release, 2026-09-19 | `docs/FLEETLAB_PUBLIC_RELEASE_2026-09-19.md` |
| `b6e30d08-d7a2-40e4-a46b-a44dc08d98fb` | `fb07b66` | Isometric world and presenter walk, commit of 2026-09-16 | none names this id |
| `7071bf6b-19c0-46ff-8009-6fd9a59b77c4` | `fb07b66` | The same source, an earlier upload | none names this id |
| `f4de0997-b50d-4efd-9960-6a8beceb4877` | `f5fac85` | Route shield fix, commit of 2026-09-16 | none names this id |
| `42fc13c3-d280-468d-92cb-0495edc497b8` | `abfad09` | Operations casebook, commit of 2026-09-15 | none names this id |

Every source in the second table and `345b427` and `b99ab04` are contained in `github/feat/fleetlab-playground`, and since the push of 2026-09-28 so are `c08f60d` and `1aeaace`.

### 2.3 The former address

https://fleetlab-playground.pages.dev/ still serves `345b427`, the regional power release of 2026-09-25: three releases behind, with no D1, no teaching frames, no Scale lab and no heading fix. Its `src/ui/studio.js` equals the blob at `345b427` (measured for this handoff on 2026-09-27), and 71 of the 98 public files of `c08f60d` match. There is no redirect: Cloudflare Pages cannot rename a `pages.dev` hostname, so the owner moved to the new project `fleetlab` on 2026-09-25 Pacific and kept the old one for existing links. Since `0bc2f25`, line 3 of `playground/fleetlab/README.md` links the stable address https://fleetlab.pages.dev/.

### 2.4 Rollback

The rollback target is `19e17ac6-d617-4789-9260-ca259c53e076` (the Scale lab release of 2026-09-27, source `c08f60d`). Its immutable address https://19e17ac6.fleetlab.pages.dev/ still answered on 2026-09-28: the hosted checks of that day timed the three labs there (section 1). A rollback is an owner action in the Cloudflare dashboard: Workers & Pages, project `fleetlab`, Deployments, the three-dot menu of `19e17ac6`, "Rollback to this deployment". Then check the stable address: `src/ui/studio.js` must equal `git show c08f60d:playground/fleetlab/src/ui/studio.js`, and the 98 public files of a `c08f60d` build must read back (99 files with `_headers`, 3,349,602 bytes, inventory SHA-256 `5c071dc69e353f6118ab43078c12d2470c9d709cf2ac7c501fe4fb807c669da3`; section 5 gives the method). A rollback to `19e17ac6` brings back the launch lesson heading defect of section 2.1. A rollback rewrites no git history. Preview deployments are not rollback targets. The former target `dd4bfa44` (D1, source `b99ab04`) stays a Production deployment of the project and is checked the same way against a `b99ab04` build (89 public files). After the next deployment, the rollback target becomes `77922688`.

### 2.5 Not yet deployed

No site input is undeployed: the site inputs of the branch head equal those of `1aeaace`, which is live as `77922688`. The launch lesson heading fix, the first row of this table on 2026-09-27, went live on 2026-09-28. The rows below are records, which are not site inputs, and designed or queued work.

| Work | Form | Where it lives | Effect on the site if deployed |
|---|---|---|---|
| Scale lab records, the privacy edits and this section | The ten document files of `44569f8`, the privacy commit `0bc2f25` and the records commit of 2026-09-28 | `claude/fleetlab-scale-lab`, and `feat/fleetlab-playground` on github since the push of 2026-09-28 | None. The site is built only from `src`, `styles.css`, `index.html`, `media` and `tools` under `playground/fleetlab/`, so the site inputs of these commits equal those of `1aeaace` |
| README release lines and Scale lab paragraph, ARCHITECTURE item 45 and the deployment guide status paragraph | Committed edits, in `44569f8`, `0bc2f25` and the records commit of 2026-09-28 | `playground/fleetlab/README.md`, `playground/fleetlab/ARCHITECTURE.md`, `docs/FLEETLAB_CLOUDFLARE_DEPLOYMENT.md` | None. None of them is a site input |
| The offline single-file page | Built locally, never hosted | `dist/fleetlab-playground.html`, ignored. Since 22:48 Pacific on 2026-09-27 it holds a build of `1aeaace` made in the worktree; the release of 2026-09-28 was built from an export | Not a hosted file. Its size is the byte budget of section 8 |
| Lesson snapshot for 59 lessons | Not declared | Outside the tree; it still counts 56 | None |
| N2: finite pickup resources and preparation from published event estimates | Design v2.1 only | `docs/plans/2026-09-26-fleetlab-n2-design-v2.1.md` and the audit | Reserved bytes: X1 8,192, S2 65,536, S5 32,768. No N2 module exists |
| P2 remainder (vehicle-time strip, D1 follow-ups), R0 no-data lessons, P0 prototype and study, P3 navigation rename | Designed | `docs/FLEETLAB_PACKET_REVIEW_2026-09-26.md`, the audit | Not built |
| T2 teaching follow-ups and 19 lesson proposals | Queued | `docs/FLEETLAB_T1_RELEASE_2026-09-26.md`, `docs/FLEETLAB_N2_V2_DESIGN_FEEDBACK.md` | Not built |
| Scale lab candidates: an operating view of one simulated period, side-preserving numbers on every page, more demand draws, road class withdrawal | Candidates; the operating view is Q8, which the owner chose on 2026-09-28 to follow Q1 | `docs/FLEETLAB_SCALE_LAB_HANDOFF_2026-09-27.md` section 11 | Not built |
| Scale lab options declined for this wave | Declined | Design sections 11 and 12, decision 21 | Not built |
| Demo plan phases C and D; map motion phase 4 | Approved, deliberately unbuilt | Source of truth section 7.5 | Not built |
| Release automation workflow; a custom domain | A template in the deployment guide | `docs/FLEETLAB_CLOUDFLARE_DEPLOYMENT.md` | No workflow and no credential exist |
| Evidence-path fixes FL-1 to FL-11 | Python, not the site | `docs/plans/2026-09-13-fleetlab-playground-design.md` section 14 | None on the site; they belong to a Phase 9 branch |

## 3. Git and remote status

The remote is named `github`. Its default branch is `main`. The facts below were read with read-only commands and local copies of the remote branches, with no fetch, and then moved forward by the push that the lead ran on 2026-09-28 right after the records commit. The push is described as made.

Worktrees of the one repository. Folder names are siblings of the main checkout unless noted.

| Worktree | Branch | Head | FleetLab website | Working tree |
|---|---|---|---|---|
| `Hermes` (main checkout) | `main` | `bca4ccd` | No; holds the Phase 9 Python FleetLab lane merge | Clean |
| `Hermes-scale` | `claude/fleetlab-scale-lab` | The records commit of 2026-09-28 | Yes; its site inputs equal the deployed source `1aeaace` | The records of 2026-09-28 are committed in the records commit. Ignored `dist/` holds a `1aeaace` build made in the worktree |
| `Hermes-fleetlab` | `codex/fleetlab-t1-teaching-frame` | `c79eccf` | Yes, the T1 head | One untracked owner note at the root, never read and never staged |
| `Hermes-playground` | `feat/fleetlab-playground` | `6b376fb` | Yes, the website branch | Clean; 34 commits behind its upstream since the push of 2026-09-28 (14 behind `790573e` before it), 0 ahead. Fast-forward it before anyone works there |
| `Hermes-depot-m1` | `codex/fleetlab-m2-m3` | `4b7a276` | Yes, the depot wave | Clean |
| `Hermes-adas` | `feat/phase8-lead-decelerates` | `579ca12` | No, Phase 8 | Not inspected |
| A Phase 7 worktree outside the repository folder | `codex/phase7-evaluation-adequacy-human-validation` | `56ed606` | No, Phase 7 | Not inspected |

One stash entry exists, on `feat/phase8-lead-decelerates`. It is not FleetLab work.

Branches. "On no remote" counts commits reachable from the head and from no remote branch, after the push of 2026-09-28. Every other branch in the table is an ancestor of `c08f60d`, so every one of them is in the deployed source; `claude/fleetlab-scale-lab` holds `c08f60d` and four commits past it: `1aeaace`, `44569f8`, `0bc2f25` and the records commit of 2026-09-28.

| Local branch | Head | Same-named remote head | On no remote | Deployed | State |
|---|---|---|---:|---|---|
| `claude/fleetlab-scale-lab` | The records commit of 2026-09-28 | none; its head is `github/feat/fleetlab-playground` | 0 | `1aeaace` yes (`77922688`); `c08f60d` was `19e17ac6`; the documents commits change no site input | **Deployed at `1aeaace`; pushed to `feat/fleetlab-playground` on 2026-09-28** |
| `codex/fleetlab-t1-teaching-frame` | `c79eccf` | none | 0 | Inside `19e17ac6` and `77922688` | Contained in `github/feat/fleetlab-playground` since 2026-09-28 |
| `codex/fleetlab-packer-comment-strip` | `8e04b49` | none | 0 | Offline file only | Contained in `github/feat/fleetlab-playground` since 2026-09-28 |
| `codex/fleetlab-d1-result-first` | `82df3b5` | `790573e` | 0 | D1 source `b99ab04` is `dd4bfa44` | 3 ahead, 0 behind its remote namesake; the 3 extra commits are documents, public on `feat/fleetlab-playground` since 2026-09-28 |
| `codex/fleetlab-regional-power` | `b1c12b6` | `b1c12b6` | 0 | `345b427` is `6265159a` and `f08b6b6f` | Pushed, in sync |
| `feat/fleetlab-playground` | `6b376fb` (local), the records commit of 2026-09-28 (remote) | The records commit of 2026-09-28 | 0 | The label of every deployment | Pushed on 2026-09-28; the local copy is 34 behind and needs a fast-forward |
| `codex/fleetlab-m2-m3` | `4b7a276` | none | 0 | `96fde5b` is `e72ae87d` | Contained in remote branches |
| `codex/fleetlab-depot-readiness-m1` | `7e0389d` | none | 0 | Superseded | Contained in remote branches |
| `feat/phase9-metric-contract` | `9daacef` | `9daacef` | 0 | Not a website | Python lane; pushed and merged onto `main` |
| `feat/phase9-fleetlab` | `1c202af` | `1c202af` | 0 | Not a website | Python spike lane; pushed |
| `main` | `bca4ccd` | `bca4ccd` | 0 | Not a website | Pushed, in sync. `1aeaace` is 56 commits ahead of it, `44569f8` 57 commits, `0bc2f25` 58 commits, and the records commit of 2026-09-28 59 commits |

The 20 commits that the push of 2026-09-28 published, oldest first. Before the push they were on no remote.

| Wave | Commits | Site effect |
|---|---|---|
| N2 design documents and audit | `4ba5626`, `62547a8`, `82df3b5` | None |
| Offline packer route A | `8e04b49` | The offline file only |
| T1 teaching frames | `caaf8f2` (implementation), `0497b9b`, `45efd43`, `c79eccf` (records) | Hosted since `19e17ac6` |
| Scale lab | `2caeac6`, `05113ab`, `953ebce`, `9fdb160`, `27f6014`, `1a81ae8`, `319b4a9`, `c08f60d` | Hosted since `19e17ac6` |
| Heading fix | `1aeaace` | One site file, hosted since `77922688` |
| Records | `44569f8` (2026-09-27), the privacy commit `0bc2f25` (2026-09-28) and the records commit of 2026-09-28 | None; they change no site input |

The push, as a record of what was run. The owner gave the push word on 2026-09-28 (answer A of section 7.0) after row P1 of section 9 was raised; row P2 was resolved in `0bc2f25`. Right after the records commit, the lead ran from the `Hermes-scale` worktree, with no `--force`:

```bash
git merge-base --is-ancestor github/feat/fleetlab-playground HEAD && echo "fast-forward: yes"
git push github HEAD:refs/heads/feat/fleetlab-playground
```

The ancestry check came first; the push was a fast-forward of `feat/fleetlab-playground` from `790573e` to the records commit of 2026-09-28. It published the 20 commits above, the deployed source `1aeaace` among them, and with them the source of `19e17ac6`. It created no remote branch named `claude/fleetlab-scale-lab`. A push does not deploy: the Pages project uses Direct Upload. To check the remote from any checkout, `git ls-remote --heads github feat/fleetlab-playground` prints the hash of the records commit of 2026-09-28. The local branch `feat/fleetlab-playground` in the `Hermes-playground` worktree stays at `6b376fb`, behind its upstream; fast-forward it before anyone works there.

## 4. What was done in this wave

Research. The site taught one market on one day and could not show what changes when a fleet grows by a factor of five to ten. The research reduced that question to mechanisms: density with diminishing returns; the limit moving from street to depot; vehicles arriving in weeks while site power, ports, stalls and staff arrive after their own lead times; a release gate building a stock that leaves as a wave; one fleet with several counts (delivered, integrated, validated, released, accepted, in service); pooling that pays on independent load; one area-wide event that defeats pooling; a fix that helps only if it lands before the queue forms. Two findings shaped the design. First, the engines that move single cars cannot show scale, because Fleet day stops at 120 cars; so two labs are count models with no map, and the third reruns the Fleet day engine at five sizes and calls itself a cell of at most 120 cars. Second, a lesson reads only in one band of its inputs: a prototype of the response queue showed its lesson in 15 to 19 percent of sampled settings with every input free and in about 90 percent with staffing derived from a sizing rule. So each lab has one governing ratio that the reader sets; the lab derives the rest and refuses a setup outside the band with a reason. Public facts set orders of magnitude in the design only; no page cites a public source or sets a lab number beside a public count.

Design. `docs/plans/2026-09-27-fleetlab-scale-lab-design.md`: the shell, three labs, package decisions D1 to D11, a byte ledger and 25 owner decisions. Three reviews of the design (feasibility; honesty and privacy; teaching value) returned 3 blockers, 25 important and 33 minor findings; design section 14 gives the disposition of each.

Build. Seven local commits on `c79eccf`: `2caeac6` the shell (route `#/scale-lab`, one generic view, the shared paired contract `src/model/scale-contract.js`, the ladder chart, three stub labs, entry points, pin edits for 56 to 59 lessons); `05113ab` a press is void when a declared guardrail is missing or a shipped control does not read as declared; `953ebce` reading rules (refusals in the absence form, the interval sentence, next tests the page can honour, side-preserving numbers); `9fdb160` the story order, the thesis line and "Set by the inputs, not found by the run" under the verdict; `27f6014` the response reserve; `1a81ae8` the fleet intake; `319b4a9` the density ladder. No existing file under `src/core`, `src/model`, `src/instrument`, `src/legacy`, `src/runtime` or `src/data` changed; four new page-only files were added under `src/model`. At `319b4a9`: 1,937 tests, 1,936 pass, 1 existing todo; offline 2,403,901 bytes.

Independent review. It ran as a stage of the same assisted workflow as the build; no independent human review has taken place. Seven lenses, one of them on packaging and security, read `c79eccf..319b4a9`. Each critical or important finding went to two verifiers, one running code and one reading. 13 findings were confirmed by both, 0 refuted, 25 minor listed. The 13 are 9 distinct defects. None moved a verdict number. None of the 1,937 tests at `319b4a9` caught any of them.

| # | Defect | Fix in `c08f60d` |
|---|---|---|
| 1 | A readout with no strip said "lies left of the band" and "left is better" over numbers all to the right | `renderVerdictReadout` option `plotted`, default true; the Scale lab passes false, so the caption names the measure and declared direction only and the outcome sentence states the interval as printed |
| 2 | At 375 px the page scrolled sideways after a press: 522 px wide (response reserve), 406 px (density ladder) | `.scale-lab .fl-readout { grid-template-columns: minmax(0, 1fr); }` |
| 3 | Density ladder bars drawn over both lines | Every bar series drawn before every line series and its points |
| 4 | Two of three fleet intake lines drawn alike | Filled points (swatch `line`), ring points (`line-ring`), square points (`line-square`) |
| 5 | Fleet intake booked the whole depot door stock to depot induction in any week with a place left over (1,819.5 vehicle-weeks where the split gives 290) | The stock is split between the induction rate and the resource that holds the next tranche. Control rows in `test/scale-intake.pins.json`: depot induction 290 and site power 20,106.17 vehicle-weeks |
| 6 | Floating point residue and a 17-digit minutes-to-clear in the response reserve | A lever that removes nothing returns the no-lever value exactly; minutes to clear read 0 on a day with nothing waiting at the event end; tiny cells print at two significant digits |
| 7 | A caption claimed rounded rows sum to the total | "before each is rounded to a whole vehicle-week" |
| 8 | No visible map credit on the density ladder | `LAB.map` and `LAB.credit`: the attribution link, the licence name ODbL and the credit sentence in every state |
| 9 | Side-preserving numbers of `953ebce` reached only some surfaces of the four-area card | Opt-in: `metricValueText` and `valueWithMinutes` take `against`, default `null`, which gives the text of `c79eccf` byte for byte; `runLine` passes it only when `tools.sided`; only the Scale lab opts in. `test/scale-lab.legacy-text.pins.json` holds 900 pairs of number text and 19 verdict views of the older pages, with inputs in `test/helpers/legacy-text.mjs` |

Fixes. `c08f60d` fixed all 9 test-first and added 31 tests (1,937 to 1,968) and 4,422 bytes. After the fix pass the lead also replaced a test that read git history and wrote temporary files with the pinned text test; gave the second chart line ring points; named the density rungs by number ("24" to "120", under "Fleet size, cars") and made a chart draw every label when all fit; and changed the declared change of a directive to "every vehicle request moved into the event". That last change moved the labels, digests and interval ends of the two pinned directive setups, now `scale-spec:16d331de` (load 1.3, directive, 180 min) and `scale-spec:2f4598cb` (load 1.2, directive, 240 min), and no mean. The default press labels did not move. Each lab stays at version 1.0.0.

Deployment. On the owner's instruction of 2026-09-27 the lead deployed `c08f60d` as `19e17ac6`. The upload held 98 files and `_headers`: 25 new to the host and 73 already held. It went ahead before design gate 5 (a browser pane of 1440 by 900 px with painted frames and the tab order) and gate 6 (a throttled phone) had passed; the deployment followed the owner's instruction, not the design's rule. Hosted smoke: all three labs pressed and recorded `scale-spec:b4c7f5da`, `scale-spec:1aa8c833` and `scale-spec:443de567` (one press each: 1,044 ms, 102 ms, 513 ms); Fleet day seed 42 read 95 completed, 176 unserved, 4 waiting and 9 in progress of 284 requests; a teaching-frame lesson opened by its link; no console error.

After the deployment. Two sweeps of the lesson links ran (section 2.1): the lead's sweep of all 59 lesson links and the 9 page routes on the stable address in the in-app browser (Chromium engine) with the pane hidden, and an inventory stage's sweep on the fake DOM with the modules downloaded from the live site. Both found one defect older than the Scale lab: the launch lesson heading of section 2.1. The lead confirmed it on the live site after a reload and from three starting pages, reproduced it on the fake DOM at `c79eccf` and at `c08f60d` with identical results, and saw that D1 (`dd4bfa44`) sets no heading per lesson at all, so the defect came in with the T1 teaching frames and became public with this deployment. `1aeaace` fixes it: in `applyLesson` of `src/ui/studio.js`, a launch lesson now calls `operations.setLesson(null)` before it hands itself to the Launch panel. A new test in `test/studio.test.mjs` failed first with "after airport-preparation the page heading names the page, not airport-preparation" and passes after. `1aeaace` was not deployed that day. Two full serial runs at `1aeaace` each read 1,967 of 1,969 tests passing with one timing failure that passed its one isolated rerun (section 5). The records were committed in one documents commit on top of `1aeaace`, `44569f8`, which changes no site input.

On 2026-09-28. The owner answered the four questions of section 7.0: "A yes, B yes, C accept all, D Q1 then Q8". Section 7.0 gives what each answer did. The privacy commit `0bc2f25` removed personal framing from both READMEs, the rollback heading of the deployment guide and seven older FleetLab records; the byline stays (rows O6 and P2). The release: the lead built the site from a `git archive` export of `1aeaacecb25e17853f852d7bbd7141ff75d9cb69`, whose site inputs equal those of the branch head, and deployed it with Wrangler 4.135.0 to project `fleetlab` as Production `77922688-6d87-4d15-94bf-442beab31712`, immutable https://77922688.fleetlab.pages.dev/. The upload held 98 files and `_headers`: 1 file new to the host (`src/ui/studio.js`) and 97 files already held. Hosted package 99 files and 3,349,629 bytes, offline file 2,408,350 bytes, both package checks OK. 98 of 98 public files read back by SHA-256 and size on both addresses, and the response headers are unchanged. The hosted checks, with the pane hidden, show the launch lesson heading fixed, the three default labels and Fleet day 95 completed of 284 requests reproduced, and press times with no regression against `19e17ac6` (section 1). The launch lesson heading defect is fixed on the live site, and the rollback target is now `19e17ac6`. The records of the day were committed in the records commit of 2026-09-28 on top of `0bc2f25`. Right after that commit the lead pushed the branch head to github as a fast-forward of `feat/fleetlab-playground` from `790573e`, publishing 20 commits (section 3).

The three labs.

| | Density ladder | Fleet intake | Response reserve |
|---|---|---|---|
| Lesson link | `#/scale-lab?lesson=density-ladder` | `#/scale-lab?lesson=fleet-intake` | `#/scale-lab?lesson=response-reserve` |
| Question | At which fleet size does one depot cell pass its capacity, and does siting matter at equal capacity? | Which gate keeps delivered vehicles out of rider service, and when is the slowest depot resource ordered? | How does a pooled support team staffed for ordinary days meet one area-wide event? |
| Model | The Fleet day engine through its public function at 24, 48, 72, 96 and 120 cars in one cell of nine places, equal requests per car, 8 hours a run, hours 5 to 8 measured | Weekly counts over 104 weeks: integration, validation, a release gate and depot intake; places open in tranches; site power, ports, stalls and staff each have a lead time | Counts only: one pooled team at 2,000, 6,000 and 20,000 vehicles with 2, 6 and 20 agents on one staffing rule; the event moves a share of the same requests into three hours |
| Governing ratio | Street load and depot load at the first rung | Room in weeks between the slowest depot resource and the next gate, over the tranche interval: 6.00 at the default; the lab reads from 2.0 | Event load: work offered inside the event over what the pool can answer |
| Primary measure | Completed trips per 100 car-hours in hours 5 to 8, higher is better, margin 3 | In-service fraction of plan, higher is better, margin 0.02 | Stopped vehicle-minutes per 1,000 vehicles, lower is better, margin 5 percent of the rates-only value (861.558 at the default) |
| Guardrails | Prompt pickup fraction (allowance 0.02); unfinished depot visits per 100 cars (5); stored energy per car in kWh (2) | Idle weeks per ordered place (13) | Late responder call fraction (0.05 on the change) |
| Controls in every press | A null control replayed by fresh engine runs; a non-binding control with the in-step depot doubled | A null control; a non-binding order control; a non-binding deliveries control | A null control with a reserve of zero agents; an ample pool control; a guardrail control |
| Default press | Control 54.6, tested 117.2, change +62.6 trips per 100 car-hours, 95% interval +60.6 to +64.4; VALID, IMPROVED, ADVANCE_TO_NEXT_TEST | Control 0.570, other arm 0.754, change +0.185 of plan, interval +0.172 to +0.196, idle weeks +5.6 of 13; VALID, IMPROVED, ADVANCE_TO_NEXT_TEST. The other arm ("end") improves more, passes the idle allowance and is held: `scale-spec:a0b5e327` | No lever 17,737.9, reserve 4,745.8, change -12,992.0 stopped vehicle-minutes per 1,000 vehicles, interval -13,394.8 to -12,545.8; VALID, IMPROVED, ADVANCE_TO_NEXT_TEST |
| Press to recorded result, desktop browser pane of 1024 by 768 px, hidden, no throttle, three presses | 113 engine runs, never more than 120; 966 to 1,034 ms, first chart after 51 to 70 ms | 111 to 115 ms | 477 to 491 ms |
| Items under "What this model cannot know" | 4 | 6 | 6 |

Every default press reads an improvement because of how each readable band was chosen, and each lab says so under the verdict in "Set by the inputs, not found by the run". The 95 percent interval is a nominal bootstrap label; at 12 seeds the response reserve measured 90.0 to 93.5 percent coverage. No shipped control estimates a false alarm rate. The fleet intake idle allowance of 13 weeks and the default site power lead time of 48 weeks were chosen with sight of outcomes, and the model notes say so.

## 5. How to reproduce every gate

Environment. Node 22 or later; every recorded run used Node v22.22.0. There is no install step and no package file for the site. Pins compare doubles that come through `Math.log`, `Math.exp` and `**`, so a change of Node version can move them; `test/scale-response.pins.json` records v22.22.0. The Python gates need the project's `hermes-dev` environment (Python 3.11), with `PYTHONPATH="$PWD/src"` (the editable install may point at another checkout) and `FLEET_PLAYGROUND_BASE=bca4ccd` (without it the boundary check R6 skips). Timed tests run only with `FLEET_PLAYGROUND_PERF=1` and need an idle machine; one isolated rerun of a timing test that failed under load is the recorded practice. The second run at `1aeaace` shows that a timing test can also fail on an otherwise idle machine and pass its isolated rerun. `test/packed.test.mjs` writes the ignored `dist/` inside the repository. Run everything from the root of the worktree.

| Gate | Command | Expected at `c08f60d` (the previous release, `19e17ac6`) | At `1aeaace` (deployed as `77922688`; the site inputs of the branch head) |
|---|---|---|---|
| Full serial suite | `FLEET_PLAYGROUND_PERF=1 node --test --test-concurrency=1 playground/fleetlab/test/*.test.mjs` | 1,968 tests, 1,967 pass, 0 fail, 1 existing todo (the browser-only layout check at 400 px), 281.9 s | Two recorded runs, each 1,969 tests, 1,967 pass, 1 fail, 1 existing todo. Run 1, machine loaded by other work, 342.8 s: the response reserve timing test failed, longest block 9.34 ms against 8 ms. Run 2, machine otherwise idle, 292.9 s: "run_window and run_pair gaps on the reference preset" (`test/runtime.test.mjs`, not changed by this wave) failed, largest run_window gap 11.34 ms against 8 ms. Each passed its one isolated rerun. No other test failed. A full run with zero failures at `1aeaace` is not recorded |
| Isolated timing rerun, response reserve | `FLEET_PLAYGROUND_PERF=1 node --test --test-concurrency=1 --test-name-pattern="timing on the reference laptop" playground/fleetlab/test/scale-response.test.mjs` | Pass | Pass (recorded in the message of `1aeaace`) |
| Isolated timing rerun, four-area runtime | `FLEET_PLAYGROUND_PERF=1 node --test --test-concurrency=1 --test-name-pattern="run_window and run_pair gaps on the reference preset" playground/fleetlab/test/runtime.test.mjs` | Passed inside the clean full run | Pass: 5.73 ms (run_window) and 5.52 ms (run_pair) against 8 ms |
| Scale tests | `FLEET_PLAYGROUND_PERF=1 node --test --test-concurrency=1 playground/fleetlab/test/scale-lab.test.mjs playground/fleetlab/test/scale-density.test.mjs playground/fleetlab/test/scale-intake.test.mjs playground/fleetlab/test/scale-response.test.mjs` | 34, 21, 17 and 20 tests: 92 of 92, about 125 s | Same. Without the flag, with `test/studio.test.mjs` added: 101 tests, 95 pass, 6 skipped, 0 fail, 20.7 s (measured for this handoff) |
| Hosted package | `node playground/fleetlab/tools/pack.mjs --site dist/site` then `node playground/fleetlab/tools/check-dist.mjs --site dist/site` | 99 files, 3,349,602 bytes, inventory SHA-256 `5c071dc69e353f6118ab43078c12d2470c9d709cf2ac7c501fe4fb807c669da3`, OK | 99 files, 3,349,629 bytes, inventory SHA-256 `dd3c2f2a659b18a0caacf5df639238916719f8a5294e653c2566ac39328e94b5`, OK |
| Offline package | `node playground/fleetlab/tools/pack.mjs --out dist/fleetlab-playground.html` then `node playground/fleetlab/tools/check-dist.mjs dist/fleetlab-playground.html` | 2,408,323 bytes, SHA-256 `4828cded63f5c23f99a8d13cc32716f587717f57847dd79bdba59215786800b5`, OK | 2,408,350 bytes, SHA-256 `ccd3f7a01a3ddd03dd8a58336c52da32a50ec1c7b0b27a297b5e82496877325a`, OK |
| Python parity and boundary | `FLEET_PLAYGROUND_BASE=bca4ccd PYTHONPATH="$PWD/src" PYTHONDONTWRITEBYTECODE=1 python -m pytest -q -p no:cacheprovider tests/unit/test_fleet_playground_parity.py tests/unit/test_fleet_playground_boundaries.py` | 89 passed | 89 passed in 5.02 s (measured for this handoff) |
| Lint | `PYTHONPATH="$PWD/src" python -m ruff check --no-cache .` | All checks passed | All checks passed |
| Whitespace | `git diff --check` | Clean | Clean |
| Model parity | Inside the suite, `test/d1-model-parity.test.mjs` | Fleet day seed 42, 24 cars, 8 hours: 95 completed, 176 unserved, 4 waiting, 9 in progress of 284 requests; Austin 60 percent shift: 77 of 480 completed, 391 unserved, 11 waiting, 1 in progress | Same |

Byte checkpoints of the offline package in this wave, in bytes: baseline `c79eccf` 2,318,855; `2caeac6` 2,357,617; `05113ab` 2,358,553; `953ebce` 2,359,746; `9fdb160` 2,360,022; `27f6014` 2,376,259; `1a81ae8` 2,391,500; `319b4a9` 2,403,901; `c08f60d` 2,408,323; `1aeaace` 2,408,350.

A timing harness that watched the whole page for changes made the fixed build look 4 to 8 times slower than the commit before it; a harness that watched only the status line showed no difference. Time a press against the status line.

Rebuild the deployed package and prove it equals the live site. `pack.mjs` looks for a `.git` entry above the playground folder, so an export needs an empty `.git` folder at its root. The readback of 2026-09-27 was made this way from an export of `c08f60d`, and the release of 2026-09-28 was built from an export of `1aeaace` in the same way. The block below checks the live source `1aeaace`. To check the rollback target `19e17ac6` on its immutable address, export `c08f60d` instead and expect the offline SHA-256 `4828cded63f5c23f99a8d13cc32716f587717f57847dd79bdba59215786800b5` and the inventory line `99 files 3349602 bytes 5c071dc69e353f6118ab43078c12d2470c9d709cf2ac7c501fe4fb807c669da3`.

```bash
EXPORT=$(mktemp -d); OUT=$(mktemp -d)
git archive 1aeaacecb25e17853f852d7bbd7141ff75d9cb69 playground/fleetlab | tar -x -C "$EXPORT"
mkdir "$EXPORT/.git"
(cd "$EXPORT" && node playground/fleetlab/tools/pack.mjs --site "$OUT/site" && node playground/fleetlab/tools/pack.mjs --out "$OUT/fleetlab-playground.html")
shasum -a 256 "$OUT/fleetlab-playground.html"   # expect ccd3f7a01a3ddd03dd8a58336c52da32a50ec1c7b0b27a297b5e82496877325a
python3 - "$OUT/site" <<'EOF'
import hashlib, os, sys
root = sys.argv[1]; rows = []
for d, _, files in os.walk(root):
    for f in files:
        p = os.path.join(d, f); b = open(p, 'rb').read()
        rows.append((os.path.relpath(p, root).replace(os.sep, '/'), hashlib.sha256(b).hexdigest(), len(b)))
rows.sort(key=lambda r: r[0].encode())
data = b''.join(f'{p}\0{h}\0{n}\n'.encode() for p, h, n in rows)
print(len(rows), 'files', sum(r[2] for r in rows), 'bytes', hashlib.sha256(data).hexdigest())
EOF
# expect: 99 files 3349629 bytes dd3c2f2a659b18a0caacf5df639238916719f8a5294e653c2566ac39328e94b5
cd "$OUT/site"
for f in $(find . -type f ! -name _headers | sed 's|^\./||' | sort); do
  if [ "$f" = index.html ]; then u=https://fleetlab.pages.dev/; else u="https://fleetlab.pages.dev/$f"; fi
  [ "$(curl -s "$u" | shasum -a 256 | cut -d' ' -f1)" = "$(shasum -a 256 "$f" | cut -d' ' -f1)" ] || echo "MISMATCH $f"
done
# expect no MISMATCH line over 98 files; then read the headers
curl -sI https://fleetlab.pages.dev/
```

Compare file hashes, never status codes: a missing file answers 200 with the page. Do not assume the worktree `dist/site` equals the deployment: the release of 2026-09-28 was built from an export, and a readback is made from an export.

## 6. How to deploy next time

Each deployment needs the owner's explicit word, naming the source commit. A push does not deploy and a deployment does not push. The owner runs any Cloudflare login; no token belongs in the repository or in chat. The full procedure is `docs/FLEETLAB_CLOUDFLARE_DEPLOYMENT.md`. The lead corrected its status paragraph again on 2026-09-28: it names Production `77922688` from `1aeaace` as current, `19e17ac6` (source `c08f60d`) as the rollback target, four Production deployments in the project, and the source as pushed. Its commands stand. Its rollback heading was corrected in `0bc2f25` (row P2 of section 9 is resolved).

1. Commit every reviewed change first. Confirm the site inputs equal the commit: `git diff --quiet HEAD -- playground/fleetlab/src playground/fleetlab/styles.css playground/fleetlab/index.html playground/fleetlab/media playground/fleetlab/tools`. Wrangler warns on any uncommitted file in the tree, including owner notes; record the warning and its cause.
2. Run the gates of section 5 on an idle machine: the full serial suite, both packs and both checks, the Python gates and `git diff --check`.
3. `npx --yes wrangler@4.135.0 whoami`
4. `npx --yes wrangler@4.135.0 pages deploy dist/site --project-name fleetlab --branch feat/fleetlab-playground --commit-hash "$(git rev-parse HEAD)" --commit-dirty=false`. Deploy `dist/site` only: never `dist`, the source folder or the repository root. Never add `--force`; it was used once, for `pages project create`, and only to skip a platform delegation.
5. `npx --yes wrangler@4.135.0 pages deployment list --project-name fleetlab`: the new deployment is Production with the intended source hash.
6. Read back every public file on the stable and the immutable address with the loop of section 5 (request `/` for `index.html`), read the response headers, and press each Scale lab (expect the three default labels), run Fleet day seed 42 (95 of 284), open one lesson by its link, and check the console.
7. Record the release: a dated release record under `docs/`, a new top entry of source of truth section 7.5 with the header rows corrected, and a new top section of this file. The rollback target becomes the previous Production (`77922688` after the next deployment). The records commit follows the deployment because the deployment id exists only afterwards; it changes no site input.

No site input is undeployed, so no release is pending. The release of 2026-09-28 (`77922688` from `1aeaace`) was built from an export and read back and checked as in step 6; its acceptance was Q4 of section 8.1. The next release carries the first site bytes of Q8 or of another item of section 8.1, with that item's own acceptance, and needs the owner's word naming its source commit.

## 7. Decisions that wait for the owner

Section numbers in this file refer to this top section. The older sections below its first line that is exactly "---" are history. In particular the Phase 6 section "7. Review and comparison contracts" (`ReviewEnvelope` 1.0 and `ComparisonEnvelope` 1.0) describes work that is built and closed with a GO verdict: the code is in `src/hermes/review/` (`facade.py`, `models.py`, `projection.py`), and `compare_review_artifacts` already reviews both sides before it compares them. Nothing in that section waits for a decision.

### 7.0 The owner's answers of 2026-09-28

On 2026-09-28 the owner answered the four questions that blocked the next piece of work, in one reply: "A yes, B yes, C accept all, D Q1 then Q8".

| # | Question | Answer | What it did |
|---|---|---|---|
| A | Push: fast-forward `feat/fleetlab-playground` from `790573e` (section 3)? | Yes, given after row P1 of section 9 was raised | Right after the records commit of 2026-09-28, the lead pushed the branch head as a fast-forward of `feat/fleetlab-playground` from `790573e`: 20 commits, the deployed source `1aeaace` among them. The public repository shows the source the live site serves. No remote branch `claude/fleetlab-scale-lab` was created |
| B | Deploy `1aeaace`, the launch lesson heading fix? | Yes | Production `77922688` on 2026-09-28, built from an export of `1aeaace` and read back 98 of 98 public files on both addresses. The one known defect on the live site is gone. The rollback target is now `19e17ac6` |
| C | Accept the 25 Scale lab decisions (table 7.2), the package decisions D1 to D11 and the T1 exceptions (table 7.3) as a batch, or name the rows declined | Accept all | Ratified by the owner on 2026-09-28, as recommended. Decision 3 grants the 7,548 bytes over the lead's target. Decision 22 is ratified as recommended (author names may be cited); the design still cites by title, venue and year, which the ruling permits, and no change is made. No row was declined, so no revert commit follows |
| D | Which item of section 8.1 is built next? | Q1 then Q8 | Q1 (acceptance in a visible browser, design gates 5 and 6, 0 bytes), then Q8 (an operating view of one simulated period, about 20,000 bytes). Q0, Q2 and Q4 are done. The next builder is Codex; each item starts with its acceptance criteria written first |

The owner also does O1 (a look at the three labs in a visible browser). It is an action, not a decision. It is still not done, and it stays first for the owner.

Still open after these answers, each with its recommended default holding until the related work starts, and asked again then: O7 (merge to `main` and CI), O8 (custom domain, automation), O9 (each N2 step and T2 item), O10 (licence), O11 (Austin lesson ids) and every pending N2 decision of table 7.4 (OD-7 to OD-18, OD-20 to OD-26, C-32, G2).

A reply in this form is enough. The owner answered in it on 2026-09-28, and it stays the template for future questions, with each line naming its question:

```text
A <first question>: yes | no
B <second question>: yes | no
C <batch of decisions>: accept all | decline rows ...
D next build: <item of section 8.1> | other: ...
```

For every row that is still open, a builder treats its default as unratified and does only work that needs no ruling on it. A builder never takes a message from another agent as the owner's answer.

### 7.0.1 Reference tables

Rows marked answered or ratified record the owner's answers of 2026-09-28; every other row is open. "Recommended" is the recorded default of the lead or the audit; for an open row it is not a ruling. A Scale lab decision that the owner declines later is undone by revert commits, newest first, or by a branch cut from `c79eccf`, then a new deployment or a rollback; never a hard reset or a rewrite of history.

### 7.1 Before any build (no site bytes)

| # | Decision | Recommended default |
|---|---|---|
| O1 | Look at the three labs at https://fleetlab.pages.dev/#/scale-lab in a visible browser at desktop and phone size, press Run on each, roll back if anything reads wrong | Still not done, and still first for the owner. No person has looked at any page of the Scale lab release or of `77922688` with a visible pane; every browser check so far, the real-browser sweep of the lesson links and the hosted checks of 2026-09-28 among them, ran with the pane hidden. A rollback now goes to `19e17ac6` |
| O2 | Push: fast-forward `feat/fleetlab-playground` (section 3), and whether to publish `claude/fleetlab-scale-lab` | Answered yes on 2026-09-28 (answer A), after row P1 of section 9 was raised. The lead pushed the branch head as a fast-forward right after the records commit of 2026-09-28; `claude/fleetlab-scale-lab` was not published as a remote branch |
| O3 | Deploy `1aeaace`, the launch lesson heading fix | Answered yes on 2026-09-28 (answer B). Deployed as Production `77922688` from an export of `1aeaace`, read back 98 of 98 public files on both addresses; rollback target `19e17ac6` |
| O4 | Rule on the 25 Scale lab decisions, first decision 3 (bytes) and decision 15 (release scope) | Answered on 2026-09-28 (answer C): all 25 ratified as recommended, with the package decisions D1 to D11. Table 7.2 |
| O5 | Accept the T1 exceptions, now public | Answered on 2026-09-28 (answer C): T-E1 to T-E5 ratified as recommended. Table 7.3 |
| O6 | Personal framing in tracked records | Resolved on the owner's instruction of 2026-09-28: personal framing was removed from `playground/fleetlab/README.md`, the root `README.md`, the rollback heading of `docs/FLEETLAB_CLOUDFLARE_DEPLOYMENT.md` and seven older FleetLab records; the README now links https://fleetlab.pages.dev/ and names the current release. The author byline stays, as on the live site. Earlier commits on the remote still hold the old wording in their history |
| O7 | Merge the playground work to `main`, and a CI step for `node --test` | Open. Owner decision. `main` is an ancestor of `c08f60d`. First run the Node suite and the Python gates with `FLEET_PLAYGROUND_BASE=bca4ccd` |
| O8 | Optional: a custom domain; release automation through a repository workflow with a Pages token | Open. Optional. No workflow and no credential exist. Never deploy from untrusted pull request code |
| O9 | Approval of each N2 step (S1a, X1, S2, S1b, S3, S4, S5) and of each T2 item | Open. Each needs its own approval and prompt |
| O10 | A licence for the public repository | Open. The owner's choice |
| O11 | Two Austin lesson ids (`austin-power-stress`, `austin-deadline-priority`) or one Austin lesson | Open. No default. Either choice moves the lesson count past 59; the N2 lesson is already reserved as lesson 60 |

### 7.2 The 25 Scale lab decisions

State: Ratified 2026-09-28. Every row was taken at the lead's recommendation and was ratified by the owner on 2026-09-28 (answer C, "accept all"), as recommended, together with the package decisions D1 to D11. The column "Recommended" keeps the recommendation that was ratified. Design section 12 holds each row in full; the handoff of the wave condenses them to 13 rows.

| # | Decision | Commit | Recommended |
|---:|---|---|---|
| 1 | The shell with its defaults: the "VERDICT" title with the chip "Teaching run, not a decision record", the sticky Run bar on phones, the ninth question family, two glossary entries, two by two grids on the Overview and in the catalog, frames kept in the lab files, the shared contract under `src/model`, leaving the page cancels a press, declared directions before a run in one marked span, no download and no setup link, metric names as display phrases, the Result heading scrolled to the top; one route and 6 header links | `2caeac6` | Ratify all; look at the grids and the directions before a run in a browser first |
| 2 | Lesson count 56 to 59; the lesson reserved for the next model becomes lesson 60; the out-of-tree snapshot declared again | `2caeac6` | Approve |
| 3 | Bytes: growth 89,468, which is 7,548 over the lead's target of 81,920 and 2,692 under the lead's hard stop of 92,160; the density ladder stands 31 bytes past its own limit of 17,408 | all eight | Grant the 7,548; keep the 2,692 as the room of this wave; more than that takes a trim first or a new line from the owner |
| 4 | Keyed draws in the response reserve: one keyed draw per simulated minute, expanded by a local stream that is a pure function of that draw | `27f6014` | Accept. The rule is item 45 of `ARCHITECTURE.md` (in `44569f8`). The alternative redraws every pin and adds about 1 s per press |
| 5 | A missing declared guardrail voids the press | `05113ab` | Approve |
| 6 | A refusal prints in the absence form, capped at 240 characters | `953ebce` | Approve |
| 7 | Side-preserving numbers, opt-in, only the Scale lab | `953ebce`, `c08f60d` | Approve as opt-in; a site-wide rule is a later wave with its own pins |
| 8 | Next tests and reasons the page can honour | `953ebce`, `c08f60d` | Approve |
| 9 | The declared test calls the 95 percent interval a nominal bootstrap label | `953ebce` | Approve |
| 10 | Four copy corrections, one a glossary entry every page shows | `9fdb160` | Approve |
| 11 | Response reserve design: pools of 2, 6 and 20 agents; 12 seeds; three controls every press; the lean pool in the table and out of the chart; the landing time table; the rates-only note | `27f6014`, `c08f60d` | Approve |
| 12 | Fleet intake design: the governing ratio; release week fixed; the weeks ahead table; two hand checks; idle allowance 13 weeks and default site power lead time 48 weeks, chosen with sight of outcomes; the deliveries lever as a control | `1a81ae8`, `c08f60d` | Approve |
| 13 | Density ladder design: trips between depot visits held at 2 (Fleet day default 3); the depot load column; the chart shows car time; a ceiling of 0.9; control arms reuse ladder runs, so a press is 113 engine runs; the engine's car-mix key stays an identifier | `319b4a9`, `c08f60d` | Approve |
| 14 | The set of repository documents of the wave | `44569f8` | Approve |
| 15 | Push and deployment scope: one deployment published T1 and the Scale lab together, before gates 5 and 6 | deployed; pushed on 2026-09-28 | One word covered the deployment; the push was a separate word, given on 2026-09-28 (answer A) |
| 16 | The requests declined in design section 11: setup links, a result download, a header change, protected file edits, a second verdict engine, money, fleets past 120 cars on the Fleet day engine, a combined arm | none | Let them stand; any can be reopened later |
| 17 | A shipped control that does not read as declared voids the press | `05113ab` | Approve |
| 18 | What follows from the inputs under the verdict, the assumption sentence, captions, titles | `9fdb160` | Approve |
| 19 | The thesis line and the story order; the bare link opens the density ladder, the slowest lab | `9fdb160` | Approve; nothing runs on arrival |
| 20 | The road table row names the map project and its open licence | `319b4a9` | Approve, and confirm the row is enough for the licence |
| 21 | Three options declined for this wave: the lagging depot comparison, pickup distance as a siting primary, the lean pool as a lever | none built | Decline for this wave; each needs its own sweep |
| 22 | Whether citations in the design carry the names of authors | held on the cautious side | The lead recommended yes, and the owner ratified it: author names may be cited. The design still cites by title, venue and year, which the ruling permits; no change is made |
| 23 | `LAB.map` and `LAB.credit`: the attribution link, ODbL and a credit sentence outside every disclosure, in every state | `c08f60d` | Approve, and confirm it is enough for the licence |
| 24 | Option `plotted` of `renderVerdictReadout`; the Scale lab passes false | `c08f60d` | Approve |
| 25 | Short numbers in the Scale lab: a value that would round to zero prints at two significant digits, never more than 12 decimals; older pages keep the exact double | `c08f60d` | Approve for the Scale lab; a site-wide rule is a later wave with its own pins |

### 7.3 T1 exceptions, public since `19e17ac6`

State: Ratified 2026-09-28. The owner ratified T-E1 to T-E5 as recommended (answer C). OD-T1 to OD-T7 were decided yes on 2026-09-26. The T1 record gave its wave no deployment authority; the Scale lab deployment published it.

| # | Item | Recommended |
|---|---|---|
| T-E1 | The walkthrough shows 146 visible words before Prepare (153 with an inherited lesson context) against a cap of 130 | Accept as the explicit OD-T7 scope exception; the fix is walkthrough structure, a T2 item |
| T-E2 | Package T grew 60,902 bytes: 7,654 over the 53,248 target, 538 under the 61,440 stop | Accept as an explicit review decision |
| T-E3 | Fractions keep three decimals where the frame contract requires; exact signed seconds at a threshold boundary | Accept as exceptions to a generic two-decimal rule |
| T-E4 | Recorded interpretations of that wave's lead (unchanged `ops-cases.test.mjs`, exact machine JSON excluded from the copy scan, OD-T7 over the word cap, Situation content retained, first ready car as a navigation default) | Accept as recorded; ratified by the owner on 2026-09-28 |
| T-E5 | T1 went public with the Scale lab | The owner's instruction of 2026-09-27 covered the deployment; the scope stays decision 15 |

### 7.4 N2 decisions still pending

Still open after the answers of 2026-09-28; answer C did not cover them. Decided and not repeated: OD-1 (packer route A, landed as `8e04b49`), OD-2 (byte budgets), OD-3, OD-4, OD-5, OD-6, OD-19 (order: S1a before X1; S1b after S2 and before any forecast-arm run; S5 after S4).

| Id | Decision | Recommended default | Needed before |
|---|---|---|---|
| OD-7 | Condition tape (berth closure and recovery) in N2.0 | Keep, under route A | S2 |
| OD-8 | Identities | Merge pickup metrics into `B2`; keep event, curb and accounting identities | S2 |
| OD-9 | Arrival at the horizon H | Keep DL9; register H minus I at least T | S1 |
| OD-10 | Arm names on the page | "Respond to requests" and "Stage from published crowd estimates" | S5 |
| OD-11 | Role of the approach refusal guardrail F2 | Strict harm above 0.02 only where attainable; descriptive if the cell saturates | Any forecast-arm run |
| OD-12 | Role of the historical maximum age F5 | Descriptive; keep key, label and attaining request | Any forecast-arm run |
| OD-13 | Terminal energy | Decide after the placebo control; default descriptive plus a normalized preparation energy measure | Any forecast-arm run |
| OD-14 | Unfinished visits | Reaffirm limit 0 with the placebo false HOLD rate stated, or make descriptive | Any forecast-arm run |
| OD-15 | Charging policy and `rejected_actions` | A named charging policy; `rejected_actions` a structural zero sanity guardrail | S1 |
| OD-16 | Informativeness factor | The owner's number before inspection; 1.5 suggested floor | S1a |
| OD-17 | Cells and patience | Drop the b=8 overlap completion cell; redesign isolation; patience 12 or 20 min by screen | S1b |
| OD-18 | Placebo control and guardrail classes | Register both | S1a |
| OD-20 | Time of day | Disable demand and travel modulation with a closed N2 literal | S1a |
| OD-21 | Short N2 identity line | Yes, low priority | S5 |
| OD-22 | Approach bound | Fixed 1 to 120, no control-only exception | S1a |
| OD-23 | Trace and setup sharing scope | Trace under route A; sharing deferred | S5 |
| OD-24 | Default traced request | First event request of the cell, registered before tuning | S5 |
| OD-25 | A required metric that is unavailable | A distinct blocked state; both readings block the instrument | S2 |
| OD-26 | "Visible" includes an opened preparation window | Include it | S1 |
| C-32 | Merge of record kinds | Pending | S2 |
| G2 | Cell tapes and stock timelines | Registered in S1; OPEN until then | S1a |

S1 registration also needs the owner's choices of patience, every inherited parameter as a literal, seed blocks (recommended 2501 to 2512 and 3501 to 3512, because 2001 to 2012 and 3001 to 3012 are public four-area seed sets), the condition matrix, a false-alarm cell, the isolation cell, the curb-capacity bound B, refusal ceiling headroom, a cross-seed independence check, detectable effect and dispositions, an INCONCLUSIVE extension (none, or one preregistered with at most 40 seeds), tolerances and nulls, control execution counts, a registration and inspection log, and which engine the walkthrough runs.

## 8. The next plan

### 8.1 The build queue, in recommended order

Zero-byte work and owner gates first, then small fixes of what is live, then the candidates, then the reserved tracks. Take one item at a time, with its acceptance criteria written first. Q0, Q2 and Q4 are done. By the owner's choice of 2026-09-28 (answer D), Q1 is next and Q8 follows it; the next builder is Codex.

| Order | Item | Bytes | Blocked by | Done when |
|---|---|---|---|---|
| Q0 | Documents commit | 0 | Nothing | Done: the documents commit `44569f8` on top of `1aeaace` is made. It changes no site input (the site inputs equal those of `1aeaace`); on 2026-09-27 its records named `c08f60d` as live and `1aeaace` as not deployed; rows R1 to R4 of section 9 are corrected; the source of truth is updated in place. Its criteria also were: `git diff --cached --check` clean; the staged privacy scan, with the repository pattern and the patterns added for this wave, with zero unexplained hits; `artifacts/`, `dist/` and owner notes not staged. This file is part of that commit and records no result of those staged checks |
| Q1 | Acceptance in a visible browser (design gates 5 and 6) | 0 | Nothing. Next, by the owner's choice of 2026-09-28 (answer D) | At 1440 by 900 px with painted frames: Run inside the first screen, thesis line above the heading, focus on the Result heading after Run, tab order equal to document order, Overview and catalog grids two by two. At 375 by 812 px with 4 and 6 times throttling: press to painted result, first chart and longest task for each lab recorded in place of the estimates (density ladder 4 to 13 s, fleet intake 0.4 to 0.8 s, response reserve 1.8 to 2.9 s); wide tables scroll inside their region, which takes focus; the resize observer count after ten presses. Also open: a screen reader, Safari, Firefox, and a look at the lesson pages with a visible pane. The real-browser sweep of all 59 lesson links is done (section 2.1), but with the pane hidden, so it painted no frame |
| Q2 | Owner rulings and the push | 0 | The owner | Done on 2026-09-28: answers A to D of section 7.0, and rows O2 to O5 of section 7.1 answered; the source of truth records each answer. O7 to O11 and the N2 decisions of table 7.4 stay open |
| Q3 | Declare the lesson snapshot again for 59 lessons | 0 | Nothing | A digest over 59 resolved lesson records is recorded; the 56 older records equal the T1 snapshot (SHA-256 `cb290591f6a208974c269200a6da2d7a0002b2303d8ec540b821aba69c8d2f94`) byte for byte |
| Q4 | Deploy `1aeaace`, from the documents commit on top of it | 27, measured | The owner's word (O3), given on 2026-09-28 | Done on 2026-09-28 as Production `77922688`, built from an export of `1aeaace`: run 2 of section 5 (machine otherwise idle, one timing failure that passed its one isolated rerun) meets the first criterion; both packages checked; 98 of 98 public files read back on both addresses; the launch heading checked in the in-app browser with the pane hidden; rollback target `19e17ac6` recorded. The criteria were: a full serial run of the 1,969 tests on an idle machine whose only failures, if any, are timing tests that each pass their one isolated rerun, every failure and rerun recorded (the two runs so far each had one such failure, section 5); both packages checked at the deployed commit; every public file read back on both addresses; the launch heading checked in a browser; rollback target `19e17ac6` recorded |
| Q5 | Small Scale lab open items: back navigation keeps the recorded result and edited setup; a typed ratio past 12 decimals is not echoed whole; the event load control accepts only its declared step; fleet intake table 1 rounding; the last-decimal nudge of `sidedText` | A few hundred, estimated; inside the 2,692 room | A wave that names `src/model/scale-*.js` first if it edits them (the event load step is declared at `src/model/scale-response.js:214`; `sidedText` is in `src/ui/experiment.js`) | Each fix behind a test that failed first for the right reason; `test/scale-lab.legacy-text.pins.json` unchanged; the three default labels unchanged unless the wave declares it |
| Q6 | Side-preserving numbers on every page | About 1,500 | Owner approval of a site-wide rule | One rule on every surface of the four-area pages (verdict card, chart summaries, hidden summary, walkthrough chip), so no value prints two ways on one card; the pinned case of an interval end of -30.04 s against a 30 s margin no longer prints "-30.0 s" beside IMPROVED; every moved pin listed with its reason |
| Q7 | More than one demand draw | Small; near 0 if pins only | Owner approval as a T2 item | Four-area readings pinned on at least 3 rider draws in the pattern of `test/ops-cases.pins.json`; a reading shows only where its label and verdict match a pin; a changed direction on another draw is reported, not hidden (L3's direction and UC-08a's call already change with the draw) |
| Q8 | An operating view of one simulated period | About 20,000 | Q1 first. The owner chose it on 2026-09-28 (answer D) | Every number is a field of the recorded fleet intake result; no new engine and no measure computed in the interface; the page calls itself a replay of a simulated period; nothing runs on arrival; absence reads "not available: reason"; no banned word, "live", "real-time" and "monitoring" included; no sideways scroll at 375 px; its own byte line |
| Q9 | N2, in the order of OD-19: S1a registration (documents) first, then X1, S2 (fixtures first), S1b, S3 and S4, S5 last | Stops: X1 8,192; S2 65,536; S5 32,768 (reserved) | Owner approval of each step; the decisions of 7.4 | X1: legacy byte parity, deterministic cancellation, identical outputs synchronous, chunked, capture on and off and cancel then restart, no simulation task over 50 ms, cancellation p95 at most 100 ms and maximum 200 ms over at least 20 offsets at 40 and 85 vehicles. S2: the 19 fixture groups of N2 section 9 as tests first; legacy Bay, Austin, airport, launch and setup bytes unchanged. S1b: every cell classified before any forecast-arm run. S3 and S4: every registered cell reported, null and adverse results kept. S5: a closed panel between Austin and Launch inside Fleet day; no "forecast", "win", "score", "beats" or "cost" in copy; at most one N2 lesson (59 to 60) |
| Q10 | P2 remainder: the vehicle-time strip and the open D1 follow-ups | Stop 12,288 (reserved) | Owner approval | Strip segments sum to H; blocked minutes equal the aggregate; sentences equal fields |
| Q11 | R0 no-data lessons: lessons 3 and 4, a synthetic lesson 1, runbook corrections | Stop 5,120 (reserved) | Owner approval | No external dataset bytes or terms; stop if a lesson needs dataset bytes, dataset terms or a new engine |
| Q12 | T2 teaching follow-ups, one at a time | Per item; pinned readings for the 36 non-OPS lessons about 10,300, estimated from 5,726 bytes for 20 OPS readings | Owner approval per item | New pins where a result changes; its own byte line; the lesson count pin moves only with a new lesson id |
| Q13 | Withdraw a road class fleet-wide | About 25,000 | A wave that names the protected files first | Every older pin kept; its own byte line |
| Q14 | Evidence-path fixes FL-1 to FL-11 (Python instrument, not the site) | 0 site bytes | Work on a Phase 9 branch, never the playground branch | FL-1 and FL-11: `apply_axis` rejects an axis that feeds the world. FL-2: a registry version bump with a recorded re-baseline of the FLEET-005 digest. FL-3: an unavailable guardrail is recorded as not evaluable, never skipped. FL-4 and FL-5: invariants check every transition and event kind |
| Q15 | Demo plan phases C and D; map motion phase 4 | Not estimated | Owner approval | Not written beyond the scope lines of source of truth section 7.5 |
| Q16 | P0 prototype and formative study; optional P3 navigation rename | Not estimated | Owner approval; P3 only after the study passes and never during an N2 build | A study of 5 to 8 reviewers with a frozen protocol, pass rule 4 of 5 per task |

### 8.2 Bytes

The offline cap is 2,621,440 bytes (`APP_MAX_BYTES` in `playground/fleetlab/tools/media.mjs`). Of the room under it, 135,904 bytes are reserved: X1 8,192; S2 65,536; S5 32,768; P2 remainder 12,288; R0 5,120; an unallocated floor of 12,000. Do not spend them on other work.

| State | Offline bytes | Left under the cap | Unassigned after the reserve |
|---|---:|---:|---:|
| `c08f60d`, the previous release (`19e17ac6`) | 2,408,323 | 213,117 | 77,213 |
| `1aeaace`, deployed as `77922688`, and the branch head (the same site inputs) | 2,408,350 | 213,090 | 77,186 |

Estimates against the unassigned room at `1aeaace`: Q6 about 1,500 leaves about 75,686; Q8 about 20,000 leaves about 55,686; Q12 readings about 10,300 leave about 45,386; Q13 about 25,000 leaves about 20,386. Q5 draws on the Scale lab room, which the lead set at 2,692 bytes under the wave's hard stop at `c08f60d` (decision 3, ratified on 2026-09-28) (2,665 once the 27 bytes of `1aeaace` are counted) and which sits inside the unassigned room. The audit estimates the N2 model plus review at 52,500 (low), 81,800 (likely) and 118,500 (high) bytes against 98,304 for S2 and S5 together; at the high estimate it passes those stops by 20,196. The rule for that case: a work package stops above its own budget, deep checks move to test-only and review scope is cut before more bytes are asked for; required behaviour is never removed silently.

### 8.3 Designed but not built

| Item | Where designed | State |
|---|---|---|
| N2 model (one fictional event graph, two event cohorts, one constrained hub) | N2 v2.1 (901 lines, SHA-256 `8bb68d09da0b6738b02cdf179a8993dfda4b00aa2cdce5cde23fef7fa33d75de`) and the audit | Design only; no implementation, registration or execution seam authorized |
| N2 fixture contracts, 19 groups | N2 section 9 | Hand-traced and re-derived by a probe; G2 is the only OPEN family |
| The N2 review surface and its lesson `event-curb-staging` | N2 section 11 | Planned; lesson 60 |
| P2 vehicle-time strip, Austin sentences and lessons, one-seed capture-on fork | Packet review section 5 | Not built |
| R0 no-data lessons; P0 prototype and study; P3 rename | Packet review section 5 | Not built |
| T2 teaching follow-ups; 19 new lesson proposals | Audit section 11.6 and Appendix B; T1 record | Queued; each new id moves the lesson count pin |
| Scale lab options out for now: backlog and longest wait at the landing minute (574 bytes); fixed inputs of the response reserve as controls; a shared helper for invalid results; a stale mark naming the changed control; a model fault seam for a fleet intake hand check | Design sections 11 and 14.3 | Out for this wave |
| A second model file per lab, `src/model/scale-<lab>-engine.js` | Plan section 1.1 | Reserved in the copy-scan list (3 of its 34 names); used by no lab |
| A study of the false alarm rate of the Scale lab instrument | Model notes section 8 | Not done; no shipped control estimates one |
| Release automation and a custom domain | Deployment guide | Template only |

### 8.4 Never build or claim

| Area | Never |
|---|---|
| Scope and safety | A connection to a road vehicle, vehicle bus, remote control channel or production safety-critical system; any claim of an automation level, road readiness, production safety, certification, compliance, regulatory approval or deployment permission; a language model in a real-time control loop (AGENTS.md section 5) |
| Status of results | A result presented as anything but NOT_EVIDENCE, simulation only, decision authority NONE; a teaching run exported as a decision record (exports must fail `DecisionRecord` and `ExperimentSpec` validation); a claim that a hash authenticates a producer |
| Claims about the world | Any claim about a real fleet, operator, depot, city or past event; a lab number set beside another lab's number; a lab fleet size set to a current public count; a public source cited on a page; two public figures joined into a ratio; a threshold read as a standard |
| Decision integrity | A second verdict engine; statistics in interface code; a UI-only score or winner; a guardrail offset by a primary gain or by another guardrail; a verdict beside a missing guardrail or a failed control; a forecast-arm run before S1 rules freeze; seeds added because a result is inconclusive; pooled cells; a favourable metric chosen after the fact; patience tuned to create a gain |
| Rejected designs | A real basemap or street tiles; live or real data feeds; points, badges, leaderboards, a single score or gauge; colour-only verdicts; a rendered 3D city, vehicle models or textures; a movable camera, lighting or a day and night tint; a language model in the page; an imported traffic simulator; WebGL for the isometric picture; rerunning an experiment when a knob changes; revenue or cost panels; Python in the browser; guided-tour modals on first load |
| N2 scope | Extra hubs, road spillback, rerouting, post-assignment abandonment, Street coupling, combined power and weather stress, pricing, an optimizer, RL or language model policy, live maps or events, external data ingestion, cloud or backends, physical control; mechanisms added to rescue a null result |
| External data | Dataset-derived parameters; acquiring, accepting the terms of or installing tooling for an external driving dataset |
| Scale lab scope (decision 16, ratified by the owner on 2026-09-28) | Setup sharing through links; a result download; a header navigation change; a fleet past 120 cars on the Fleet day engine; money, fares or energy prices; a combined arm |
| Architecture and bytes | Passing the offline cap; spending the reserved bytes on other work; any runtime dependency, network service, telemetry, account or backend; importing the playground from `src/hermes`, or changing `src/hermes`, `pyproject.toml`, `.gitignore`, `Makefile` or `.github` from the playground branch |
| Tests and pins | Deleting a prior test to make new work pass; rewriting a pin after a Node version change without a reason; changing the model parity values of section 5 |

## 9. Known open items and risks

Privacy and records.

| # | Item | Action |
|---|---|---|
| P1 | The commits pushed on 2026-09-28 add two lines that name a real operator's open dataset, each to say it was not used (in the T1 section of this file and in the T1 record); the public branch already carried the same name elsewhere | Answered: the owner gave the push word on 2026-09-28 (answer A) after this row was raised. The two lines are public since the push |
| P2 | Personal framing in `playground/fleetlab/README.md`, the root `README.md`, the rollback heading of `docs/FLEETLAB_CLOUDFLARE_DEPLOYMENT.md` and seven older FleetLab records; the README's former address and older release line | Resolved on 2026-09-28 in `0bc2f25` (O6). The byline stays. The pushed history of earlier commits still holds the old wording |
| R1 | `docs/FLEETLAB_CLOUDFLARE_DEPLOYMENT.md` named D1 as current (Production `dd4bfa44`, rollback `f08b6b6f`) and said the project had one Production deployment | Corrected by the lead on 2026-09-27, in the documents commit: the status paragraph names the Scale lab Production `19e17ac6` from `c08f60d` as current, D1 `dd4bfa44` as the rollback target, three Production deployments in the project, and `1aeaace` as committed and not deployed. The rollback heading was corrected in `0bc2f25` (row P2). Corrected again on 2026-09-28, in the records commit of 2026-09-28: the status paragraph names Production `77922688` from `1aeaace` as current, `19e17ac6` as the rollback target, four Production deployments in the project, and the source as pushed |
| R2 | Source of truth header rows: "Checkouts" opened with the FleetLab worktree on `codex/fleetlab-d1-result-first`; "Remote" described the D1 push plan; "Design review and next phase" pointed to N2 v2, not v2.1 | Corrected on 2026-09-27 (Checkouts, Remote, Playground, Design review and Last updated rows), in the documents commit. Confirmed against git with read-only commands on 2026-09-27: `Hermes-fleetlab` on `codex/fleetlab-t1-teaching-frame` at `c79eccf`; `Hermes-adas` on `feat/phase8-lead-decelerates` at `579ca12`; `Hermes-playground` at `6b376fb`, 14 commits behind `790573e`; `github/feat/fleetlab-playground` at `790573e`, an ancestor of `c08f60d`; `main` and `github/main` at `bca4ccd`, whose tree has no `playground/` folder; 16 commits of `c08f60d` and 17 of `1aeaace` on no remote; `docs/plans/2026-09-26-fleetlab-n2-design-v2.1.md` present. The rows now also name the documents commit. Corrected again on 2026-09-28 (Playground, Checkouts, Remote, Design review and Last updated rows) for the release `77922688`, the push and the owner's answers |
| R3 | The Scale lab release record gave the N2 document range as starting at `76439c6`, which was already in the D1 source; the range after `b99ab04` starts at `790573e` | Corrected on 2026-09-27, in the documents commit. Confirmed against `git log b99ab04..c08f60d`: the row lists `790573e`, `4ba5626`, `62547a8`, `82df3b5`, the D1 release record and N2 design commits of that range |
| R4 | Some drafts carried the state of `319b4a9` or said nothing was deployed | Corrected on 2026-09-27, in the documents commit: each record was read against section 1 of this file and names `c08f60d` as deployed and `1aeaace` as not deployed; every record that mentions the documents commit describes it as made. Numbers of `319b4a9` stay only where a record labels them as that commit or as the state before the review. On 2026-09-28, in the records commit of that day, this section, the source of truth, the deployment guide, the playground README, ARCHITECTURE item 45 and the Scale lab handoff were corrected again: `1aeaace` deployed as `77922688`, rollback target `19e17ac6`, the source pushed and the decisions ratified |

Site and code.

| # | Item | Size |
|---|---|---|
| S1 | No person has looked at the pages in a visible browser; no painted frame, no 1440 by 900 px, no throttled or physical phone, no screen reader, Safari or Firefox | Process gate, Q1 |
| S2 | The launch lesson heading defect was live from `19e17ac6` until 2026-09-28. Both sweeps after that deployment saw it; it came in with the T1 teaching frames (`c79eccf`) | Fixed in `1aeaace` and live since `77922688` (2026-09-28), checked on the live site with the pane hidden; Q4 done |
| S3 | Back to a lesson address discards the recorded result and edited setup (`src/ui/studio.js`) | Small |
| S4 | A typed governing ratio of more than 12 decimals is echoed whole in the density ladder inputs table | Small |
| S5 | Where 12 decimals still read on a threshold, `sidedText` moves the last decimal one step toward the value's side, off by under 1e-12 | Small |
| S6 | The event load control declares step 0.1 and accepts typed steps of 0.01 | Small |
| S7 | Fleet intake table 1 can print a row one off from its two parts after rounding; its caption makes no sum claim | Small |
| S8 | Older pages print a long raw number for a tiny value (the site rule, held by existing tests) | A wave of its own |
| S9 | The out-of-tree lesson snapshot of the T1 wave still counts 56 lessons | Q3 |
| S10 | No 404 page; the `#/experiments` title and header link disagree; meta and Open Graph text predate the Scale lab; one D1 label remains in `src/ui/depot-scene.js:106` | Small |
| S11 | The four `src/model/scale-*.js` files now count as existing protected files, so a fix inside them needs a wave that names them first | Rule |

Environment and process.

| # | Item | Mitigation |
|---|---|---|
| E1 | Timed tests fail now and then. At `1aeaace`: the response reserve timing test read 9.34 ms against 8 ms on a loaded machine, and the four-area runtime test "run_window and run_pair gaps on the reference preset", which this wave did not change, read 11.34 ms against 8 ms on an otherwise idle machine; each passed its one isolated rerun, the second at 5.73 ms and 5.52 ms. The T1 record shows the same family of timing tests needing isolated retries before (18.78 ms and 10.87 ms) | Run the flagged suite serially on an idle machine; rerun one failure in isolation before believing it; record every failure and its rerun. Accept a full run whose only failures are timing tests that pass their one isolated rerun (Q4) |
| E2 | The worktree `dist/` holds a `1aeaace` build made in the worktree; the release of 2026-09-28 was built from an export | Rebuild from an export of the deployed commit for any readback (section 5) |
| E3 | The `Hermes-playground` worktree is 34 commits behind its upstream since the push of 2026-09-28 | Fast-forward it (it is clean) before anyone works there |
| E4 | The local ref `refs/remotes/github/HEAD` points to the Phase 7 branch while the remote default is `main` | Name branches explicitly; do not trust the local default |
| E5 | Four deployments of `fleetlab-playground` are named by no record | Table 2.2 lists them |
| E6 | The review that found the 9 defects was a stage of the same assisted workflow; it did not read `c08f60d` or the T1 wave | Q1, and an independent human review when the owner wants one |
| E7 | A green suite missed 9 defects; the fake DOM computes no layout and paints nothing. The real-browser lesson sweep ran with the pane hidden and painted nothing either | A visible browser check stays a separate gate |

## 10. Rules of work for the next builder

| Rule | Detail |
|---|---|
| Branch | Work on `claude/fleetlab-scale-lab` or a branch cut from its head; since the push of 2026-09-28 that head is also `github/feat/fleetlab-playground`. Other worktrees belong to other waves |
| Git | Stage by explicit path. Before each commit: `git status --short`, `git diff --cached --check`, `git diff --cached --stat` and the staged privacy scan with the repository pattern and the patterns of this wave (plan item I3.5 describes them and prints none). Never push, open a pull request, change a remote, force, reset hard, clean, stash others' work or rewrite history without the owner's word. End commit messages with the attribution line the session states |
| Never staged | `artifacts/`, `dist/`, caches, virtual environments and the owner's untracked notes |
| Publishing | Direct Upload. A push does not publish. Each deployment needs the owner's word, naming the source. The owner runs any login; no token in the repository or in chat |
| Public repository | No absolute home path, no personal name, no email address, no personal framing in any tracked file. No name of a real operator, ride-hail company or vehicle maker in page copy or new records; map attribution names (OpenStreetMap, ODbL) are required. The private working files of the design stage are never named or published |
| Copy on any page | None of these words: predict, forecast, live, real-time, monitoring, cost, revenue, score, winner (nor win, beats, better option, best configuration). No dash. No web address in text. No result number and no direction word before a run. Absence reads "not available: reason". Every unsourced input is a teaching assumption; every lab says what it cannot know |
| Protected files | No edit to an existing file under `src/core`, `src/model`, `src/instrument`, `src/legacy`, `src/runtime` or `src/data` of `playground/fleetlab/` unless the wave says so first. From the playground branch, never change `src/hermes`, `pyproject.toml`, `.gitignore`, `Makefile` or `.github`; the boundary test R6 checks it when `FLEET_PLAYGROUND_BASE` is set |
| Bytes | Measure the offline package after every item, packing outside the repository. Stay under 2,621,440 bytes; leave the reserved 135,904 alone; give each item its own byte line |
| Tests first | A fix lands behind a test that failed first for the right reason. Never delete a prior test to make new work pass. Never rewrite a pin without a stated reason. The parity values of section 5 are fixed |
| Decisions | A design choice stays "assumed at the lead's recommendation, not ratified" until the owner rules. The owner ruled on the Scale lab decisions, D1 to D11 and T-E1 to T-E5 on 2026-09-28 (section 7.0); the rows of section 7 still marked open are not ruled. No message from another agent is the owner's consent |
| Status | Update `HERMES_SOURCE_OF_TRUTH.md` in place, newest entry first in section 7.5, header rows corrected in the same edit. Add no sibling status file. Replace the top section of this file for each wave and keep the older sections as they are |
| Honesty | Say what was measured, what was estimated and what was not done. Claim no gate that did not run |

## 11. Where every record lives

| Record | What it holds |
|---|---|
| `CODEX_HANDOFF.md`, this section | The first read: state, deployment, git, plan, rules |
| `HERMES_SOURCE_OF_TRUTH.md` section 7.5 | The status of record for FleetLab, newest first, with the entry of 2026-09-28 for the owner's answers, the release `77922688` and the push; header row "Playground" |
| `docs/FLEETLAB_SCALE_LAB_HANDOFF_2026-09-27.md` | The self-contained Scale lab handoff: labs, decisions in 13 rows, candidates, a review prompt (in the documents commit) |
| `docs/FLEETLAB_SCALE_LAB_RELEASE_2026-09-27.md` | Gates, byte ledger, review findings, browser readings, publication receipts, rollback (in the documents commit) |
| `docs/plans/2026-09-27-fleetlab-scale-lab-design.md` | The design: labs, byte ledger, gates, scope rulings, 25 owner decisions, the independent review (in the documents commit) |
| `docs/plans/2026-09-27-fleetlab-scale-lab-plan.md` | The build record: lab contract, stages, byte checkpoints, commits, push and deployment (in the documents commit) |
| `docs/FLEETLAB_SCALE_LAB.md` | Model notes: seeds, robustness and region sweeps, interval coverage, what was chosen with sight of outcomes, rejected arms (in the documents commit) |
| `playground/fleetlab/ARCHITECTURE.md` item 45 | The Scale lab build contract and the keyed-draw rule (committed in the documents commit) |
| `playground/fleetlab/README.md` | The playground overview with the Scale lab paragraph (committed in the documents commit; personal framing removed in `0bc2f25`; release lines corrected on 2026-09-28) |
| `playground/fleetlab/test/scale-*.pins.json`, `test/scale-lab.legacy-text.pins.json`, `test/helpers/legacy-text.mjs` | The pinned values of the three labs and the pinned text of the older pages |
| `docs/FLEETLAB_T1_RELEASE_2026-09-26.md` | The T1 teaching frames: acceptance, exceptions, T2 queue |
| `docs/FLEETLAB_D1_RELEASE_2026-09-26.md` | The D1 release, a former rollback target |
| `docs/FLEETLAB_CLOUDFLARE_DEPLOYMENT.md` | The publishing procedure, custom domain and automation template (status paragraph corrected on 2026-09-27 and again on 2026-09-28; rollback heading corrected in `0bc2f25`) |
| `docs/plans/2026-09-26-fleetlab-n2-design-v2.1.md` | The N2 design, design only |
| `docs/FLEETLAB_N2_V2_DESIGN_FEEDBACK.md` | The design audit: N2 review, teaching clarity, three-part explanations of every lesson, 19 lesson proposals, next tasks |
| `docs/FLEETLAB_PACKET_REVIEW_2026-09-26.md` | The P, S, X and R tracks: P2, R0, P0, P3 |
| `docs/plans/2026-09-13-fleetlab-playground-design.md` | The original playground design, rejected designs, defects FL-1 to FL-11 |
| `docs/FLEETLAB_PUBLIC_RELEASE_2026-09-19.md`, `docs/FLEETLAB_STREET_RELEASE_2026-09-19.md`, `docs/FLEETLAB_FILM_RELEASE_2026-09-19.md`, `docs/FLEETLAB_DEPOT_RELEASE_2026-09-24.md`, `docs/FLEETLAB_REVIEW_AND_NEXT_PHASE_2026-09-25.md` | Records of the older releases on the former address |
| `playground/fleetlab/tools/pack.mjs`, `check-dist.mjs`, `media.mjs` | The packer, the package check and the byte and media limits |
| `AGENTS.md`, `CODEX_HANDOFF_TEMPLATE.md` | Repository rules (safety boundary in section 5; this handoff is required by section 21) and the Phase 6 template this section adapts |

## Recommendation

Keep `77922688` live. It fixes the one known defect, it reads back byte for byte on both addresses, and the source it serves is public on `feat/fleetlab-playground` since the push of 2026-09-28. The owner's answers of 2026-09-28 settled the push, the release and the Scale lab and T1 decisions, and chose the next two builds. First, the owner looks at the three labs and a few lesson pages in a visible browser (O1), because no person has seen a painted frame of this release. Then Codex runs Q1, the visible-browser and throttled-phone acceptance of design gates 5 and 6, which costs no bytes. Then Codex builds Q8, the operating view of one simulated period, with its acceptance criteria written first and its own byte line of about 20,000 bytes. Rows O7 to O11 and the N2 decisions of table 7.4 stay open; N2 stays design-only until S1a is approved.

## Top risks + mitigations

| Risk | Mitigation |
|---|---|
| The pages were never seen by a person with a visible pane; a lab could read wrong on a phone | O1 first, then Q1; the rollback to `19e17ac6` is one dashboard action, and it brings back the launch heading defect (section 2.4) |
| Q8 reads as a tool that watches a real fleet, or grows past its byte line | Its acceptance criteria first: every number a field of the recorded fleet intake result, no new engine, the page calls itself a replay of a simulated period, nothing runs on arrival, no banned word ("live", "real-time" and "monitoring" included), no sideways scroll at 375 px, its own byte line |
| A ratified decision is read as covering the rows that stay open | Section 7.0 names what stays open: O7 to O11 and the N2 decisions of table 7.4 |
| The live site and the public branch drift apart after the next change | A push and a deployment stay separate owner words, each naming its commit; every release is read back against a build from an export (sections 5 and 6) |
| The `Hermes-playground` worktree is used while 34 commits behind its upstream | Fast-forward it before anyone works there (row E3) |
| The unassigned bytes are spent by several items at once | Each item gets its own byte line; section 8.2 shows about 20,386 bytes left after the four largest estimates |
| A timing test or a harness misleads | Serial runs on an idle machine, one isolated rerun, and timing against the status line. Both full runs at `1aeaace` had one timing failure that passed in isolation, and a zero-failure full run at `1aeaace` is not recorded |

## Next 3 actions

1. The owner opens https://fleetlab.pages.dev/#/scale-lab in a visible browser at desktop and phone size, presses Run on each lab, opens a few lesson pages, and rolls back to `19e17ac6` if anything reads wrong (O1).
2. Codex runs Q1 (painted frames at 1440 by 900 px, tab order, 375 by 812 px with 4 and 6 times throttling, a look at the lesson pages with a visible pane) with its acceptance criteria written first, and records the readings in the source of truth.
3. Codex builds Q8, the operating view of one simulated period, with its acceptance criteria written first and its own byte line. A deployment of it needs the owner's word naming the source commit, and a push needs a separate word.

---

# FleetLab T1 local teaching handoff — September 26, 2026

Branch: `codex/fleetlab-t1-teaching-frame`. Implementation: `caaf8f2d8f02b3df9e68a5a675fa488f99161d6d`; documentation: `0497b9b`, with unit clarification `45efd43`. Task 1 design commits: `62547a8b9834f0eead16331873ac6a76a041efed`, `82df3b54d265c26bd3f8472e4dc12dca9ca636ef`. Task 2 offline packer: `8e04b498c71c92c3462eb2737af86df5b3f0620c`.

All 56 lesson setups and core/model sources are unchanged. T1 changes explanations, navigation, result presentation and accessible disclosures. N2 v2.1 remains design-only; no new Waymo data. No push, deployment or PR was authorized or performed; the previous public D1 release below remains current. Earlier deployment/push authority in historical sections does not apply to this task.

Final Node: 1,876 tests, 1,875 pass, one existing TODO, zero failures; Python parity/boundaries: 89 pass. Final offline 2,318,855 B (+60,902; 538 B below stop, 7,654 B over target). Static site 93 files / 3,249,227 B. Both check-dist checks and diff/privacy gates pass. Root independently verified 47 immutable sources, all 56 resolved lesson contracts (SHA-256 `cb290591f6a208974c269200a6da2d7a0002b2303d8ec540b821aba69c8d2f94`), 88 old test files with only three allowed rewrites, and frozen N2 design hashes. Independent review’s two P2 findings were fixed and scoped re-review approved. A fresh whole-branch review of `4ba5626..45efd43` approved local acceptance with no Critical or Important findings; its four focused regression checks passed.

Browser: all four required lesson first-screen frames at four viewport sizes; eight routes at both mobile sizes; runtime results, exact disclosures, busy focus, edited context and 7.438:1 disabled Next contrast checked. Criterion 4 has an explicit OD-T7 scope exception: walkthrough 146 fresh/153 inherited words before Prepare; no beat/layout expansion. Precision exceptions preserve canonical fractions and threshold-side integrity. No full 56-route real-browser sweep or hosted readback. Model/data/pin changes, walkthrough structure, rider-draw robustness and Fleet day motion control remain T2.

The self-contained [release/reviewer record](docs/FLEETLAB_T1_RELEASE_2026-09-26.md) contains exact commands, all 11 acceptance dispositions, honest byte checkpoints, failed intermediate checks/retries, review fixes, privacy and next actions. Generated evidence stays under ignored artifacts/fleetlab-t1; the owner's untracked note is untouched. For continuation: review the documented exceptions and remaining package headroom, keep N2 design-only, and obtain a separate explicit release instruction before any remote action.

---

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


## SF city explorer local review slice — September 29, 2026

A separate implementation now lives in `apps/fleetlab-city/`; it preserves the legacy Python/node boundary under `playground/`. Read `docs/FLEETLAB_CITY_SF_VALIDATION.md` first, then the pack/run contracts and subsystem README. Baseline HEAD is `7e1da7cb72ca0e08fe46ead83db07adfce0e757e`; new work is uncommitted on `codex/fleetlab-city-sf`. The new source overlay and generated run/release manifests identify what was tested. The owner's unrelated note is untouched.

All 34 recorded experiment arms pass strengthened event/interval verification; 100 OD checks and exact source/run reproduction pass. Map class/district/semantic gates remain incomplete, so there is no city recommendation, engineering-complete claim, or release approval. The reviewed local static package is `dist/city-explorer-reviewed/`. Browser screenshots, failures, command output and zero-spend ledger are in `build/fleetlab-city/validation/`. The validation document records actual commands, resource limits, all sensitivities, integrity findings/fixes and unperformed browser/human/provider checks. No push, PR or public deployment occurred.

## 2026-09-29 — City Explorer UX v2 follow-up

Owner's SF-first usability requests are implemented under `apps/fleetlab-city/`: deeper
vector zoom and local street labels; larger text; repeat/seed explanations; deterministic
vehicle stories plus all-ID access; active red depot markers; automatic trace loading and
restart; complete operational history through 15:00; queue explanations; whole-shift trip,
distance, depot and energy summaries; explicit visitor-entered gross-fare assumptions;
unavailable safety metrics; and audience-specific review questions.

The final generated package is `dist/city-explorer-v2-reviewed/`. Original runs and the
previous reviewed package are retained. `dist/city-explorer-v2/` was a mutable visual-QA
prototype and its initial release manifest is stale; do not use it as a release identity.
The original loopback URL, http://127.0.0.1:4173/#replay, serves the final package. Port 4175
serves the same bytes for the connected Pixel over ADB reverse. No commit, push or public
deployment was performed; the owner's unrelated review file is preserved.

Read `docs/FLEETLAB_CITY_UX_V2_VALIDATION.md` for exact validation results and residual gaps.
Read `docs/FLEETLAB_CITY_PRESENTER_GUIDE.md` for answers to each visitor-comprehension question,
EV-001's long charging wait, all twelve pair lessons, and the GeoLibre/future-fidelity decision.
New evidence lives under `build/fleetlab-city/validation/ux-v2/`; previous evidence is historical.
The pending Pixel automation issue is macOS Computer Use Accessibility/Screen Recording access,
not USB authorization or machine sleep. No phone-interaction pass or formative-user-study pass
may be inferred from the device connection or successful responsive desktop checks.

UX v2 final gate addendum: 57 new-app Python tests and 11 Node tests pass; all 34 run arms
were freshly verified; all 2,400 projected vehicle views conserve their verified fleet totals.
The full unchanged serial legacy Node/performance suite is now green: **1,972 pass, zero
failures, one existing TODO**, 279.94 seconds. Legacy Python 89/89, both existing distribution
checks, whole-root Ruff and whitespace checks pass. Doctor remains 16 PASS / 2 WARN /
1 optional NOT_AVAILABLE. This successful run does not erase prior timing failures or
establish device, semantic-map, traffic-model or real-world-safety qualification.

## 2026-09-29 — City Explorer v3 qualification and launch preparation

This section supersedes the v2 entry-point and device-blocker notes above. The branch and
base HEAD remain unchanged; implementation is a local, uncommitted source overlay.
The owner's unrelated review note remains untouched. Read
`docs/FLEETLAB_CITY_V3_VALIDATION.md` for the current validation record and
`docs/FLEETLAB_NEXT_PHASE_BRIEF_V3.md` for the next product/simulation brainstorming handoff.

The final viewer is `dist/city-explorer-v3-final/`, with release manifest SHA-256
`7450c2aaf5e5ca90e2f5cbf6cf7d05cf6520f11b1f92267bbdf511c557ce2926`.
Port 4173 serves this package. It adds a guided welcome/learning path, original vehicle
concept illustrations, sourced Ojai/Zoox reference questions, and a separate candidate-map
qualification view. The original 2,429 recorded data files remain identical to v2.

The SF v2 candidate accounts for 2,490 restriction records and supports 431 bounded sequence
rules. Unsupported eligible length falls from 1.936% to 1.322%; primary class support now
passes. Trunk, living-street, district and semantic-review gates remain open. Exact district
inspection exposes 108 gaps / 13.161 km; comparing three official layers did not resolve them.
Candidate fleet execution is explicitly rejected pending a cross-leg history contract.
Candidate reports and road display are bound to the captured graph, source and geometry.
Frozen v1 pack products and the repeated seed-1001 baseline reproduce exactly.

`build/fleetlab-city/launch-stage-v3/` contains a 9,897-file stage with all 99 legacy files
unchanged, current/prior release directories, proposed header/navigation diffs and rollback.
A separate local Pages rehearsal at port 4180 passed root/city CSP, deep-link and rollback
checks. Hosted Pages Range and other hosted readback remain pending; see
`docs/FLEETLAB_CITY_LAUNCH_PREPARATION.md`. Earlier approval of assessment section 7 makes
this preparation only. No push, PR, public deployment or production switch occurred.

The physical Pixel 10 Pro XL / Android 17 rendered the v2 replay and directly restarted its
completed recording through keyboard control of scrcpy. The Mac then locked during the v3
page check; Computer Use reported automatic unlock failure and the owner was asked to unlock.
This is now the immediate device-control blocker. New v3 physical-device, touch, Safari,
screen-reader and participant checks remain unclaimed. Desktop/tablet/narrow browser QA is
recorded separately and does not substitute for physical or human validation.

V3 final gates: 86 city Python tests; 15 browser-logic Node tests; 89 legacy Python parity/
boundary tests; full serial legacy Node/performance suite 1,972 PASS / 0 FAIL / 1 existing TODO
in 295.922 seconds. All 34 recorded arms were freshly verified. Both legacy distribution
checkers, root Ruff and whitespace checks pass. Doctor remains 16 PASS / 2 WARN /
1 optional NOT_AVAILABLE. A separate final review closed the road-display binding finding
with five focused tests including eight rehashed negative cases. Evidence is under
`build/fleetlab-city/validation/launch-v3/`, including a source-overlay inventory and browser
observations. Generated artifacts and local Wrangler caches are not source deliverables.

## 2026-09-29 — SF power-study build and corrected v4 viewer

This section supersedes the current-viewer pointers above. Read
`docs/FLEETLAB_SF_POWER_BUILD_VALIDATION_2026-09-29.md` for the full current record.
The branch/base HEAD remain unchanged and source is uncommitted. No push, PR or public
deployment occurred. The owner's unrelated note remains untouched.

The current corrected review package is `dist/city-explorer-v4-final/`, served at
`http://127.0.0.1:4182/`. Release SHA-256:
`920887f3fb0841b066f26a996d8c9c157fc47c1e9f2cff0b70837c069c80f0a2`.
It corrects violation/energy copy, validates study/replay identity and packaged dependencies,
and fixes a browser-observed Play failure caused by navigation clicks binding to the body.
Direct Play, restart from 15:00, configuration-specific depot markers, viewer fares,
responsive layouts and flat-map fallback were observed passing after the fix. The earlier
`v4-corrections` package/stage is retained as failed browser QA and must not be promoted.

All 34 original scientific runs were reproduced exactly. The six-arm power-study software
and exporter are implemented and reviewed, but **no SF evaluation arm exists**. Original
frozen protocol `181da257329efec546b5df88d6b0ad7a666c0194b18e327546f82ea1961025fd`
completed 24 valid preflight arms, then evaluation was refused before directory creation
at the 4 GB memory gate. An unapplied, independently reviewed lifetime correction preserves
checks and measured 3.153 GB through read-only analysis/capture/routing preparation. The
owner decision on a named revision and 24 additional preflight runs is pending. Keep source,
protocol and tapes frozen; never substitute preflight/toy results for the missing evaluation.
See `docs/FLEETLAB_POWER_STUDY_MEMORY_AMENDMENT_PROPOSAL_2026-09-29.md` and the exact patch,
reports and measurement harness under `.superpowers/sdd/2026-09-29-sf-power-and-integration/`.

The integration plan recommends a same-tab top-level City Explorer and SF homepage card at
`/city-explorer/`; the owner placement question is pending, so no shared navigation edit was
made. `launch-stage-v4-final/` stages current/prior releases and all 99 legacy files unchanged
(9,921 total). Header/nav proposals remain separate; this pair's hosted readback and rollback
rehearsal are not performed. Publication remains a separate release decision.

Two reviewed M1 documents specify cross-leg route history and immutable map-review results;
the source-linked priority queue is complete. No runtime M2 implementation, map guard change,
new human source review, current physical Pixel/touch, Safari or participant pass is claimed.

Validation: 118 City Python tests, 29 Node tests, 89 Hermes parity/boundary tests, both legacy
distribution checks, root Ruff and whitespace checks pass. Broad Hermes baseline is
1,660 pass / 55 skipped / 2 fail: the two failures are exact absolute-checkout-path byte pins,
independently diagnosed without changing assertions/core logic. Doctor remains 16 PASS /
2 WARN / 1 optional NOT_AVAILABLE. Final serial legacy timing suite: 1,972 PASS, zero failures,
one existing TODO, 281.224 seconds. Evidence lives in `build/fleetlab-city/validation/power-v1/`; generated artifacts,
dependencies and caches are not source deliverables.
