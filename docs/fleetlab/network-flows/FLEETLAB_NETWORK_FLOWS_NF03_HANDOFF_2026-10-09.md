# FleetLab NF-03 depot capacity study and P0 completion: built handoff

**Date: 2026-10-09. Owner: Bo-Huei Lin. Built by Claude (Fable 5.1 lead; Opus 5.5 implementers and reviewers).**

This implements the owner's next-phase design (`FLEETLAB_NETWORK_FLOWS_NEXT_PHASE_DESIGN_2026-10-09.md`, kept outside the repository): the bounded P0 completion pass on the visitor redesign, and NF-03, "Better scheduling, more bandwidth, or more charging power?", a reproducible and independently checked twelve-visit depot capacity study with a recorded comparison viewer. Design decisions and enhancements are recorded in `docs/plans/2026-10-09-fleetlab-depot-capacity-study-design.md`; the task plan is `docs/plans/2026-10-09-fleetlab-depot-capacity-study.md`.

**Status: built, tested and validated locally; committed on a local branch; nothing pushed, integrated into a City package, previewed on Cloudflare or published.** The branch is `claude/fleetlab-depot-capacity-study` in the worktree `Hermes-capacity` (sibling of the main checkout), seventeen commits on top of the redesign branch `claude/fleetlab-visitor-redesign` at `7aaa2ac`. The working tree is clean. Trust state is unchanged: `SIMULATION_ONLY`, `NOT_EVIDENCE`, `NOT_AUTHENTICATED`, `NOT_EVALUATED`, decision authority and deployment permission `NONE`. SF qualification stays HOLD; no city, renderer, solver, runtime model service, telemetry or CSP change was added.

## 1. Summary

| Item | Redesign baseline (`7aaa2ac`) | Built (`c2e507f`) |
|---|---:|---:|
| Teaching Node suite | 2,055 tests, 2,046 pass, 0 fail | 2,136 tests, 2,127 pass, 0 fail, 8 skipped, 1 todo |
| City Node | 63 pass | 66 pass |
| City Python, locked environment | 321 OK | 325 OK |
| Hermes playground boundary suite (`FLEET_PLAYGROUND_BASE=bca4ccd`) | 41 pass | 41 pass |
| Ruff, `git diff --check` | clean | clean |
| Offline edition | 2,533,188 B | 2,543,123 B (cap 2,621,440; 78,317 under; the 50,000 B reserve holds) |
| Hosted site code, excluding media | 2,362,259 B | 2,531,744 B (89,696 under the cap); 118 files, 3,644,361 B with media |
| `check-dist` | OK both editions | OK both editions |
| NF-03 study | none | 72 of 72 cells accepted; quarter-second repeat agrees in all 36 |

The City Python figure uses the locked environment under `build/fleetlab-city/venv` of the `Hermes-fleetlab` worktree (scipy and pyproj installed), which the design asked for; the `hermes-dev` environment still lacks those packages and was not used as a gate.

## 2. NF-03: what was built

### Protocol as frozen

Twelve distinct visits A1 to D3 in three waves (0, 600, 1,200 s); departure targets arrival plus A 600, B 900, C 1,320, D 360 s; blocking upload, energy to target, independent 120 s local step after upload; horizon 5,400 s. Regimes: data-heavy (60 / 7.5 / 45 / 15 decimal GB, no energy), energy-heavy (6 / 0.75 / 4.5 / 1.5 GB and 6 / 2 / 4 / 1 kWh), mixed (data-heavy uploads with the energy-heavy energy). Treatments: base (1 Gbps useful uplink, two 60 kW ports, 60 kW site feed), more bandwidth (2 Gbps), more power (120 kW site feed); per-vehicle upload cap 2 Gbps recorded and verified in every treatment. Rules: first come first served, equal uplink share (whole-byte remainder rotated over the eligible ring), departure deadline first, shortest upload first; serial rules never interrupt a started upload; ties by arrival then stable ID. Charging: FIFO port admission by arrival then ID, a port held until the target, per-port grant min(port cap, site feed over occupied ports). Quanta 1,000 ms primary and 250 ms refinement. Boundary order: close the previous slot and record completions and releases, register arrivals, readiness, deadline events, allocate. Policies see only arrived visits, their remaining work and deadlines.

Totals checked: 382.5 GB of upload work in data-heavy and mixed; 39 kWh in energy-heavy and mixed. Analytic fixture: A1 and D1 need 75 GB by 480 s and the link carries 60 GB by then; in every data-heavy and mixed base cell at least one of them misses its target (checked in the manifest).

### Modules

- `playground/fleetlab/src/model/depot-capacity-contract.js`: versions `depot-capacity-study/1.0.0`, `depot-capacity/1.0.0`, `depot-capacity-rules/1.0.0`, `depot-capacity-metrics/1.0.0`, `depot-capacity-record/1.0.0`, `depot-capacity-verifier/1.0.0`; frozen workload, treatments, protocol; scenario builder and validator (any field that differs from the frozen workload is refused, including `-0`); canonical text and record digest (SHA-256); the 72 planned cells, cell ids, workload digest and `studyStatus`.
- `src/model/depot-capacity.js`: slot engine with integer bytes and joules per slot. Each slot records `upload` and `charge` as useful rates per second and `grant_bytes`, `unused_bytes`, `grant_j`, `unused_j` as amounts per slot, plus `ports`. Policy errors end a cell with one diagnostic; cancellation is honored.
- `src/model/depot-capacity-verify.js`: independent reconstruction that imports no engine code: eligible set, holder per rule, equal-share ring, vehicle cap, port admission with at most two ports and no duplicates, per-port grants, useful service, unused amounts, dependencies, arrivals, completions, readiness and deadlines in boundary order, totals, execution state. Every per-slot object must hold exactly the reconstruction's keys with positive values. Output: `visits` (ready time, outcome class, lateness, last prerequisite with ties, unfinished work) and `metrics` (on time, late, unfinished at a reached deadline, pending, missed, final or censored lateness, utilization of uplink, site feed and ports).
- `tools/capacity-study.mjs`: runs the 72 cells sequentially, verifies, digests, writes the manifest module, optional per-cell records (under `dist/` or outside the repository only) and a separate benchmark file; stops at the first unaccepted cell and never fills or drops one.
- `src/data/depot-capacity-study.js`: generated manifest (83,594 B): protocol, workload digest, 36 primary cells with digest, verification summary, metrics and per-visit rows; 36 refinement cells with digest and verification; refinement agreement per primary cell; status. No timestamps, so regeneration is byte-identical (tested).
- `src/ui/depot-capacity-view.js` (13,155 B): pure projection (cards, reading sentence and withholding rules, cursor state with recorded wait reasons, merged allocation spans, first allocation difference, first readiness difference, example visits, `verifiedCell`).
- `src/ui/depot-capacity-page.js` (30,916 B), `src/ui/capacity-app.js`, `capacity/index.html`: the viewer.
- Packaging: `tools/pack.mjs --site` writes the viewer as a second page at `network-flows/capacity/` (shared `styles.css` and `src/` tree); `tools/check-dist.mjs --site` holds that page to the same policy, copy and token rules; the offline file excludes the capacity modules (tested). `apps/fleetlab-city/tools/integrate-site.py --flow-update` declares the nine capacity files in `CAPACITY_ADDED`, pins the two generated page files by content, and labels the release `depot-capacity-nf03-2026-10-09`. `apps/fleetlab-city/hosted/integration.mjs` adds the hosted links.

### Results: the 36 primary cells (on time / missed targets / total late minutes, all lateness final)

| Workload | Capacity | First come, first served | Equal uplink share | Departure deadline first | Shortest upload first |
|---|---|---:|---:|---:|---:|
| Data-heavy | Base | 3 / 9 / 105 | 3 / 9 / 132.3 | 3 / 9 / 70 | 8 / 4 / 63 |
| Data-heavy | More bandwidth | 9 / 3 / 13.5 | 9 / 3 / 1.5 | 12 / 0 / 0 | 9 / 3 / 1.5 |
| Data-heavy | More power | 3 / 9 / 105 | 3 / 9 / 132.3 | 3 / 9 / 70 | 8 / 4 / 63 |
| Energy-heavy | Base | 6 / 6 / 45 | 6 / 6 / 45 | 6 / 6 / 45 | 6 / 6 / 45 |
| Energy-heavy | More bandwidth | 6 / 6 / 45 | 6 / 6 / 45 | 6 / 6 / 45 | 6 / 6 / 45 |
| Energy-heavy | More power | 9 / 3 / 3 | 9 / 3 / 3 | 9 / 3 / 3 | 9 / 3 / 3 |
| Mixed | Base | 2 / 10 / 107 | 3 / 9 / 142.6 | 1 / 11 / 96 | 6 / 6 / 88 |
| Mixed | More bandwidth | 6 / 6 / 45 | 6 / 6 / 45 | 6 / 6 / 45 | 6 / 6 / 45 |
| Mixed | More power | 3 / 9 / 105 | 3 / 9 / 132.3 | 1 / 11 / 72 | 6 / 6 / 65 |

Every visit becomes ready in every cell, so no lateness is censored. Observed negative controls: more site power changes nothing in the data-heavy workload (records identical slot by slot except the declared field); more bandwidth changes no charging slot in the energy-heavy workload. Observed sensitivity: data-heavy base shortest-upload-first reaches 8 of 12 against 3 for the other rules, and in the mixed workload departure deadline first has the fewest on time with the second-fewest late minutes, a trade-off the viewer states rather than ranks. The 250 ms repeat reproduces every ready time and outcome class in all 36 primary cells; no completion lands inside a one-second slot because every frozen quantity divides the one-second grants exactly, so this agreement is a property of this fixture, not a general time-step adequacy claim.

Literal wave-1 schedules under data-heavy base: first come first served A1 600, B1 660, C1 1,020, D1 1,140 s (D1 late by 780); departure deadline first D1 240, A1 720 (late by 120), B1 780, C1 1,740 (late by 420, because wave-2 visits with earlier targets are served first).

### Verification evidence

- 31 model and study tests: frozen workload and rejections; hand-derived literal schedules; two ports under the site cap with exact slot entries at 0, 239, 240, 719 and 720 s; arrival at an upload release (shortest-upload at 1,200 s: B3 takes the link ahead of C2); deadline equal to completion counts on time; zero work; conservation and dependencies across all 36 primary cells; information fairness (no observation names a later wave; upload grants identical between data-heavy and mixed under the serial rules); treatment isolation; negative controls; refinement agreement; the analytic fixture; eleven deliberate corruptions (duplicate grant, two visits on one port, early post completion, altered total, substituted workload, wrong rule label, wrong remainder rotation, power above the port cap, zero-valued entries, `-0`, moved arrival) each rejected; six policy errors; digest determinism; the runner's completeness, determinism, failure stop and place rule.
- An adversarial spec review wrote an independent simulator from the protocol text and reproduced all 72 cells event by event and slot by slot, plus nine whole-record forgeries built under wrong rules, all rejected by the verifier. A code-quality review followed; its findings (unit-suffixed field names, a leak in the cell generator, test scaffolding, readability) were applied.
- Benchmark (sequential, Node 22, this Mac): 72 cells in 8.95 s wall, peak RSS 274 MB; canonical records 786,901 to 1,278,905 B at 1,000 ms and 3,220,040 to 5,124,012 B at 250 ms; the full record set is about 160 MB and lives under `dist/`, not in Git. In a browser, loading a comparison (four cells reconstructed, verified and digest-matched) took 445 to 540 ms in headless Chromium.

## 3. What visitors see

Hosted route `/network-flows/capacity/` (not in the offline edition; the depot flow lessons say so). Page order: breadcrumb (Explore / Depot readiness & data / Scheduling or capacity?), title, lede, boundary line; workload chips (Data-heavy, Energy-heavy, Mixed) with the regime's question, a "Different rule" select, **Load comparison**, "What is held fixed?" (twelve-visit table, resources, rules); status ("No comparison loaded." until Load); four matched cards (Base, Different rule, More bandwidth, More power), each naming its changed field, with on-time count, missed targets, total lateness and capacity used, marked "Loaded and matched" only after the digests match; a one-sentence reading built from the counts (withheld when the quarter-second repeat disagrees or lateness is censored), for example: "Under the data-heavy workload, departure deadline first leaves on-time readiness at 3 of 12 with 62.3 fewer late minutes; more bandwidth takes on-time readiness from 3 to 9 of 12; more site power changes nothing."; "Which vehicles changed, and why?" with a contrast picker, improving, regressing and unchanged examples, a deterministically selected affected visit (earliest arrival then ID among visits whose outcome class differs), the first allocation difference stated separately from the first readiness difference, a per-visit table, Play (hidden under reduced motion), Previous and Next event, a slider, resource boards for both cells (uplink holders and shares, both ports with kilowatts, site feed used of available, the selected visit's prerequisite chain in words, its recorded wait reason) and two twelve-lane timelines; a logical depot map naming every stage of a real turnaround and marking which ones this model carries, with the measurement each excluded stage would need; the full 36-cell table with refinement agreement and digest prefixes; exact record JSON and checks for loaded cells with a download button; model and limits; and the closing question "What would we have to measure at a real depot before using this result?".

Load semantics are explicit: Load selects accepted cells of the recorded study and reconstructs them in the browser with the same deterministic engine; each record is verified independently and its canonical digest compared with the committed manifest; any mismatch names the cell and keeps the previous accepted comparison. There is no custom-setup action.

Hosted entries: the lab-links row gains "Scheduling or capacity?" next to City Explorer; a "Next lesson: Scheduling or capacity?" line sits under the Compare help text on both depot flow lessons (restored after every lesson change); Explore carries the recorded-study entries (City and capacity) after the lesson grid.

## 4. P0 completion pass

- **First screen** of both depot flow lessons: question as the H1, one summary paragraph built from the setup, the readiness definition, a compact setup table (NF-02 folds its two constant columns into the caption), Compare with "Change the setup" beside it; rule explanations, the optional guess and the chips in disclosures below. Desktop uses a two-column hero (question left, setup and Compare right).
- **After comparison**: headline and trade-off, compact outcomes, timeline with a resource board (uplink holder and share, charger, the followed vehicle's recorded wait reason under each rule) and the readiness chains, next test, then Capacity bound, task histories, checks and ledger as disclosures. The vehicle-to-follow control exists on both lessons; NF-02 shows every rule on desktop and one selected rule on phones.
- **Explore**: four topic chips replace the Topic select and the tall topic cards; one filter row; count row with Clear filters; the lab row scrolls horizontally on phones; shorter lede.
- **Reduced motion**: nothing advances on a timer; Play is hidden and Next event steps one recorded event while revealing the timeline up to the cursor.
- **Film**: starts only on the Play film button; any interruption (leaving Home, scrolling away, hiding the tab, a motion preference change) requires another click.
- **Home order**: copy, starting points, film, caption, browse in the DOM on every width; the desktop grid places the film beside the copy with the caption under it, without CSS `order`.
- A direct NF-01 to NF-02 route sequence test guards the three defects closed in the redesign.

Measured on the hosted-style preview (site build plus the hosted stylesheet and entries), Chromium in the app's browser pane:

| Check | Result |
|---|---|
| Compare button, NF-01, 375 by 812 | 736 to 787 px (inside the first screen) |
| Compare button, NF-02, 375 by 812 | 759 to 810 px (inside, 2 px spare) |
| Compare button, NF-01 and NF-02, 1366 by 768 | 420 to 470 px; 511 to 562 px |
| Explore first lesson title, 375 wide | top at 784 px |
| Capacity page, 375 wide | Load at 1,062 px after the title, lede and chips; no overflow; no control under 44 px; Load completes |
| 683 by 384 (200% zoom proxy), lab and capacity page | no horizontal overflow, no control under 44 px, Compare below the fold at 622 px as the design allows at zoom |
| Home keyboard order, desktop | primary action, Explore, Fleet day, the SF card actions, Street lab, Play film, Browse, About; film source unset until a click |
| Console | no errors on any inspected route |

The hosted stylesheet previously forced 16 px on the lab's definition, help and status lines and 20 px on the lede, which undid the phone budget; those overrides are now excluded, and the City entry blocks on Explore moved below the lesson grid for the same reason.

## 5. Departures from the design and plan

- The manifest module is a plain object literal without `trust` (the scope label is part of the required-label tuple the site checks refuse); refinement cells carry digest and verification only; primary cells omit the redundant ready-time map. Trust fields remain on every record and the viewer reads them from the contract.
- Per-slot amount fields carry unit suffixes (`grant_bytes`, `unused_bytes`, `grant_j`, `unused_j`) so rates and amounts cannot be confused at 250 ms.
- The hosted capacity link is a "Next lesson" line under Compare rather than a third chooser link, which would push Compare below the phone fold; the lab chooser keeps the two offline lessons.
- Under reduced motion the Play button is hidden rather than relabelled, so only one "Next event" control exists.
- The reading sentence states trade-offs ("but with N fewer late minutes") and never ranks; it is withheld on refinement disagreement, censored lateness or a missing cell.
- Two narrow test exceptions: `src/ui/capacity-app.js` may import the generated data module; `tools/capacity-study.mjs` may import four `fs` functions to write outputs. Both are pinned by negative tests.
- The 24-permutation serial reference and any solver were not built (the design places them after the study is stable).
- Two commits carry an "Opus 5.5" attribution trailer written by the implementing model (`0c0a039`, `4297030`); history was not rewritten.

## 6. Not done and open risks

- No visitor sessions, screen-reader listening, physical phone, cross-engine or human comprehension evidence. AI review counts as zero human observations.
- No City release package, no Wrangler preview, no readback, no publication, no release receipt change, no push.
- The design's `hermes-dev` City Python result is unchanged (missing scipy and pyproj); the locked environment is the gate.
- Shares at or below about 0.29 of the uplink draw at the 4 px minimum bar height on the timelines; exact shares remain in the spans table.
- On tablets (768 to 999 px) the Home caption sits 40 px under the film, the hero's own gap.
- The offline edition grew by 9,935 B (the lab's resource board and the hosted-link text); it stays 28,317 B inside the 50,000 B reserve.

## 7. Owner's integration and publication steps (not performed)

1. Inspect the branch: `git -C ../Hermes-capacity log --oneline 7aaa2ac..claude/fleetlab-depot-capacity-study` and `git diff --stat 7aaa2ac..claude/fleetlab-depot-capacity-study`. Merge or rebase onto `codex/fleetlab-city-sf` as the lane requires; no history was rewritten here.
2. Gates from the repository root with the locked City environment: the teaching suite, City Node and Python suites, ruff, `git diff --check`, and the boundary suite with `FLEET_PLAYGROUND_BASE=bca4ccd`.
3. Build both editions: `node playground/fleetlab/tools/pack.mjs --site dist/<site>` and `--out dist/<offline>.html`, then `check-dist` on each. Optionally regenerate the manifest (`node playground/fleetlab/tools/capacity-study.mjs --write-module`) and confirm Git reports no change.
4. Integrate with the runbook: `apps/fleetlab-city/tools/integrate-site.py --flow-update --client-update dist/<site> --source-commit <exact commit> ...` with the preserved original root and readback, the current City viewer, the sanitized rollback and the complete source offer. The tool copies the capacity files, pins the generated page, and labels the release `depot-capacity-nf03-2026-10-09`. Package only `site/` from the integration manifest.
5. Preview with the pinned Wrangler wrapper, read back every byte and header, check `/network-flows/capacity/` loads under the root policy and that Load completes, and inspect phone width; then the production branch alias, readback again, and the receipt commit, each under the owner's explicit authorization.

## 8. Rollback

The main checkout and the redesign branch are untouched. To discard the work: `git worktree remove ../Hermes-capacity` and delete the branches `claude/fleetlab-depot-capacity-study`, `claude/fleetlab-p0-completion` and `claude/fleetlab-capacity-release-tooling` (the last two are merged into the first). `dist/` outputs under the worktree are untracked.

## 9. Commits on the branch (oldest first)

`aa252dc` docs: design addendum and plan · `0c0a039` release tooling and hosted links · `1d7cf2e` contract, engine, verifier · `5c6cbe8` merge · `41d323c` first screen and resource board · `5e6cb01` runner and manifest · `bc22fe6` reduced motion, film, Home order · `03f4485` NF-02 setup, desktop hero, desktop board · `4c06baa` engine review findings and slimmer manifest · `121b49a` Explore topics and route test · `9f1bf5a` caption and one stepping control · `4297030` viewer · `0c2e4f6` stream P review fixes · `006e8fa` packaging and site checks · `776ebb0` merge · `c2e507f` hosted entries and viewer stepping · plus this documentation commit.

## 10. Method

Two streams in separate worktrees (P0 pass; study), each task test-first with a fresh implementing agent, an adversarial spec review and a code-quality review, fixes applied, then a merge, full gates, a hosted-style preview measured in the browser, and this report. Baselines were reproduced before building. Every number above comes from a committed manifest, a test run or a browser measurement on this Mac.
