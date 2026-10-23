# FleetLab packet review: design, N2 and data (independent, read-only)

**Status (2026-09-26).** This is an independent, read-only review of `docs/FLEETLAB_DESIGN_DATA_AND_N2_REVIEW_2026-09-25.md` ("the packet") and of `docs/plans/2026-09-25-fleetlab-n2-design.md` ("the draft"; "draft N" is a line of that file, and the packet reproduces it as Appendix A). "Packet LN" is a packet line. The review answers the packet's §9 request. Its scope is the FleetLab source at HEAD `7dbb6cb`, the live site's DOM, the N2 design and experiment registration, and the Waymo Open Dataset (WOD) pilot. The application source is identical to `345b427`.

This is a review, not an implementation. The review itself changed no repository file or git state. Afterwards, at the owner's request, two in-place packet corrections (L385, L424) were committed separately in `bff69d7`; this file and the Codex brief `docs/plans/2026-09-26-fleetlab-d1-and-n2-s0-codex-brief.md` were committed after that. No N2 code exists and none was written. No data was downloaded, no terms were accepted, no account was signed into, no gcloud command was run and nothing was deployed. Some web and live-site checks ran on 2026-09-26 UTC.

## 0. Method and evidence base

**Inspected**
- The packet (919 lines) and the draft (236 lines). The draft's SHA-256 is `c574b8df…`, identical to Appendix A.
- `playground/fleetlab/` at `7dbb6cb`. `git diff --stat 345b427 7dbb6cb -- playground/` is empty.
- Git-ignored records: `artifacts/fleetlab-regional-power/release-node.txt` (lines 12480–12486: 1,792 tests, 1,791 passes, 1 TODO), `demo/observed-results.json`, the setup files, and `dist/`.
- The live site, https://fleetlab.pages.dev/, through its DOM and text. Twelve served files hash-match the checkout. Screenshots were blank because the document stayed hidden, so no visual rendering is claimed.
- The primary external sources listed in §4.

**Probes.** Throwaway Node and Python scripts ran in a session scratchpad outside the repo. They import modules by `file://` URL and write nothing to the repository.
- F1: `node probe4.mjs background 51`, `node probe4.mjs airport 78`, `node emu-run.mjs 7`, `node emu-parity.mjs`. The emulation is a scratch engine copy with an approach cap, not N2.
- Other findings and experiment: `p1`/`p2`, which call the real `computeVerdict`; `probe-f3.mjs`; `capture-records.mjs`; `replay-count.mjs`, which counts simulator calls; `probe1-3.mjs`; `analog.mjs` (existing engine plus an SFO wave, seeds 9001–9012); `toy-hub.mjs`, a hand model of the draft's rules and not FleetLab code; `instrument-sensitivity.mjs`; `r2-counterexample.mjs`; `null-bytes.mjs`; `seedcorr.mjs`; `r1-scan.mjs`.
- Design: `contrast.mjs`, `strip.mjs`, `parity.mjs`, `budget.mjs`.
- Data: `tfrecord-framing.mjs`, `delay-knob.mjs`, and a trimmed public `scenario.proto` run under protobuf 5.29.6.
- Packaging: `node playground/fleetlab/tools/pack.mjs --out <scratch>/…` gave 2,543,655 bytes, with the output written outside the repository.
- No probe used seeds 2001–2012 or 3001–3012.

**Tests re-run.** Only the packet's focused command:

`node --test --test-concurrency=1 playground/fleetlab/test/airport-demand.test.mjs playground/fleetlab/test/bay-experiment.test.mjs playground/fleetlab/test/regional-power.test.mjs playground/fleetlab/test/resource-observations.test.mjs`

Result: 24 pass, 0 fail, skip or TODO, on Node v22.22.0. `git status` was unchanged afterward.

**Not checked**
- Visual rendering, autoplay, reduced-motion or dark-mode emulation, and browser timings.
- Any user study.
- WOD object inventory, object sizes and billing.
- gcloud execution, TensorFlow under emulation, and `map.proto`.
- The new host's 88-payload readback: only the former host's artifact exists locally.
- N2 runtime behavior, which does not exist. N2 claims are design reasoning, hand traces or labeled emulations and toys.

**Tags**
- **[V]** Verified in code, data, a probe or a primary source.
- **[I]** Inference.
- **[P]** Preference.
- **[D]** Owner decision.

Toy and analog numbers are [V] as outputs and [I] as N2 predictions. Paths are relative to `playground/fleetlab/` unless they start with `docs/`, `tools/fleet_playground/` or `artifacts/`.

## 1. Product and design verdict

**Verdict.** The packet puts the problem in the right place: coherence, not palette. The editorial studio is a sound discovery layer. It leaves open the two things that decide whether a visitor understands a result: which model produced the number, and which recorded vehicle behavior explains it [I].

I recommend a **studio skin on a casebook skeleton** [P]:
- Keep the calm front door.
- Make one bounded case the unit of the product: question → optional expectation → run → verdict → one explaining strip → limit → next case.
- Feature the Austin HOLD case, with its copy stating that every N1 Austin setup inherits a 2-minute observation delay and a one-port-per-depot outage over [60,120) (`regional-power.js:20`; `resource-observations.js:3-4`) [V]. If that disclosure makes the case too muddy, feature OPS-01 until an R5-clean Austin configuration exists [P].
- Make Fleet day result-first *before* renaming navigation.

### Three largest comprehension problems

| # | Problem | Evidence | Screen-level change [P] | Test |
|---|---|---|---|---|
| 1 | **No one can tell which model produced a number.** | Six nav labels (`src/ui/studio.js:124`) and eight routes (`src/ui/routes.js:2-11`) sit over three engines behind four model/geography configurations: the Bay engine on OSM geography, the same Bay engine on an Austin schematic (`src/model/regional-power.js:17-21`), Street lab, and the older four-area engine (`studio.js:191`) [V]. The boundary strip omits Austin (`:134`) and is hidden on workspaces (`:185`) [V]. Home card "Would two more bays actually help?" (`:60`) opens the four-area engine, while Fleet day asks the same question in Bay (`src/ui/operations-lab.js:150`) [V]. The walkthrough runs the older engine (`studio.js:179,199`) [V]. No text states non-affiliation, although operator vehicles are named (`:52`) [V]. | A **model header** under every workspace H1 (model · geography class · engine version · "not interchangeable with …"). Rename "Experiments" to "Four-area workbench". Fix home card 02. Add a non-affiliation line on Method and the vehicle panel. | DOM test: every route shows a header whose version equals the result's provenance. Study task: "Which model made this number?" |
| 2 | **Fleet day buries the result, then animates away from it.** | Share, Austin and Launch accordions plus a 347 px learning block precede the workspace (`operations-lab.js:161`) [V]. The page has 8 run flows and 6 primary-styled buttons [V]. Run jumps to the stage and auto-replays (`:219-220`) [V]. Outcome cards sit ~1,970 px lower at 1280 px, and ~2.7 viewports lower at 400 px [V: DOM]. The default day is 284 = 95 completed + 176 unserved + 4 waiting + 9 in progress; the last two appear only in a note [V]. | Move Share into the result header. Give Austin and Launch aliased routes. After Run, focus a **Result summary** placed directly under the question, with no auto-replay. It shows a partition sentence, a fleet time-budget bar (pickup travel 40.8%, passenger trips 19.0%, queued to charge 13.0%, charging 11.7% [V: `budget.mjs`]) and "Follow the car that waited longest". The bar is a projection of recorded frames, computed by a tested, model-side pure function and labeled descriptive with no registered metric, so the UI does not become a second metric engine (packet L202). Merge the four comparisons into one "Compare one change". | Browser protocol at 1280×720 and 400×812: summary visible without scrolling. At most one enabled primary per state. Budget sums to fleet × horizon. |
| 3 | **Numbers are not tied to mechanism, and the best lesson is unreadable.** | The car trace is a select defaulting to `car-1` (`operations-lab.js:212`) [V]. The Austin comparison prints raw enums and floats (`src/ui/regional-power-view.js:9,69,71`). The probe reproduces `UNCHANGED`, `HOLD`, `0.00190972222222222` and `unfinished_visits REGRESSED 0.3333333333333333 0` [V]. No catalog lesson covers Austin power [V]. | A vehicle-time strip under the summary. A generated sentence: "Deadline priority changed completion by +0.19 points (95% interval −0.24 to +0.62), inside the ±2.00-point equivalence band → UNCHANGED. Unfinished depot visits rose 0.33 per seed; allowed 0 → HOLD." (UNCHANGED means the whole interval lies inside the band, `src/instrument/outcome.js:19-26`; interval from `observed-results.json` [V].) Exact values behind a disclosure. Austin lessons. | Sentence values, including interval ends, equal the analysis fields. Near-threshold fixtures: rounding never flips a margin. Study task: "Name the displaced harm." |

### Editorial studio versus the strongest alternative

The strongest alternative is a **Casebook**: registered cases, one bench to run them on, and a session notebook [P]. It promotes pieces the four-area app already ships but hides [V]:
- a freeze-and-run sheet and verdict card (`src/ui/experiment.js:1-35,1214-1221`);
- a one-changed-axis check (`:57-63`);
- 20 operations cases (`src/model/ops-cases.js`);
- a two-arm fork chart (`src/ui/charts.js:1182-1187`);
- a session log (`src/ui/store.js:140,483`).

Catalog records already carry question, controls, outputs, lesson and limits (`simulation-catalog.js:17-47`) [V].

**Where it wins:** time to first insight (the gap between expectation and outcome appears under Run), conceptual integrity (one grammar instead of two idioms plus a question-less "Open lab"), and build cost [I].

**Where it loses:** it risks implying live operations, because the case copy role-plays an operations lead [I].

**Graft onto packet §4** [P]:
- **C1. One case grammar for all 56 IDs.** "Test" cases have a registered spec. "Look" cases have one observable and no verdict. `?lesson=` URLs resolve to cases (`src/ui/routes.js:14-44`) [V].
- **C2. Fixed reveal order:** verdict, then binding guardrail, then fork strip, then limits, then next case.
- **C3. No spoilers.** The shared-power card currently shows its takeaway before the run (`simulation-catalog.js:28,70`) [V].
- **C4. An optional, unscored expectation**, labelled "Your call before the run".
  - Evidence: [Crouch et al. 2004](https://works.swarthmore.edu/fac-physics/203/) and [Brod 2021](https://pmc.ncbi.nlm.nih.gov/articles/PMC8642250/); the latter finds evidence mostly for simpler learning [V]. Transfer to this setting is [I], so make it a study condition.
  - Tests ban "predict" in regional copy (`test/learn.test.mjs:21`), while Bay copy says "synthetic forecast" [V]. Pick one rule [D].
- **C5. A session-only notebook** that never enters share links.
- **C6. A registered featured case.** Candidates are Austin 60%, or OPS-01: the primary improved but the case HOLDs, with harm 2,364.4 s against 1,800 allowed [V].
- **C7. Every path includes a clean advance.** Of the 20 OPS cases, 4 advance, 14 HOLD and 2 need more runs [V].

Do not graft role-play, scores, persistent storage or engine-hiding pages.

### Element critique

- **Homepage.** Current order: film, caption, depot explorer, facts, three cards pointing at three engines, a repeated primary action (`studio.js:38,65`), then scope. There are three taglines (`index.html:6`, `studio.js:35-36`) [V].
  - Replace the proposed concept-illustration hero with a **pinned prepared strip**: Austin at 60%, seed 1001, the car with the longest charging queue, labeled "Prepared example · recorded by model <version>, seed 1001 · includes the inherited 2-minute observation delay and 60–120 min port outage · Run it yourself →". This meets the packet's own prepared-example rule and needs only ~15 segments [I, from `strip.mjs`].
  - Move the film below the fold.
  - Reuse "See what keeps a car from its next rider" (`operations-lab.js:113`).
  - Add a "Guided tour" entry. [P]
- **Lesson discovery.** Today it is one flat grid with a 9 px model and ID row (`styles.css:1071`) and three names for one page [V]. Add paths. Rename "Read simulation evidence carefully" to "Read a simulated result carefully", because results carry the `NOT_EVIDENCE` label. Start path 2 with Austin. Add a ≥13 px "Runs in: <model>" badge. [P]
- **Workspace.** The ~280 px setup column already exists (`styles.css:1082`) [V]. Contrary to packet L171, single runs have no registered primary or guardrails (`operations-lab.js:261-264`) [V]. Lead with the partition and time budget [P].
- **Result explanation.**
  - Capture-on frames record `blocked_reason`, `power_kw` and `port_id` (`src/model/bay-operations.js:238-240`). Frame-derived blocked minutes equal the aggregate exactly (`OTHER_RESOURCE` 9668 = 9668) [V].
  - Metrics, readiness and visits are identical with capture on and off [V: `parity.mjs`]. A one-seed capture-on replay can therefore supply the fork without a second engine [I].
  - Austin car-1 sits in `queued_charging / OTHER_RESOURCE` from minute 95 to 257, and the blocking resource is not itemized [V]. Label it "specific constraint not itemized by this model", and show the power cap as co-occurring, not causal [P].
- **Typography.** Body text is 14 px (`styles.css:116-123`). 32% of Fleet day's visible characters are 10–11 px [V]. Use 16–18 px body and ≥13 px data labels, and keep the 64–80 px display size to Home only; a 28–32 px workspace H1 lets question, Run and summary fit in 720 px [P].
- **Visual language.** The "signature" strip partly ships already: `carTimelineChart` and `carForkCharts` (`src/ui/charts.js:1155,1187`) read the older engine's intervals (`src/model/engine.js:18`) [V]. Adapt that grammar to Bay frames: six state families, hatched queue time, one car plus the fleet budget [P]. The CSS contains 193 unique hex values [V].
- **Motion.** `data-motion` (`src/ui/a11y.js:143-150`) only affects `fl-*` CSS (`styles.css:647-661`). The replay, Street lab and film read only the system query (`operations-lab.js:52,220`; `street-lab.js:144`; `hero-film.js:37`) [V]. Use one preference and no auto-replay, and focus plus announce the result instead of calling `scrollIntoView` [P].
- **Mobile.** At 400 px the header and strip take ~36% of an 812 px viewport, and 2,058 px of controls come before the stage [V]. Below 600 px: a 56 px header with a Menu, ordered question, Run, summary, strip, map/table toggle, then collapsed settings [P].
- **Dark mode.** A later light block (`styles.css:664-672`) overrides the dark block (`:81-107`) [V]. Delete it or implement it [D].

### Token contrast (WCAG 2.x [relative luminance and contrast ratio](https://www.w3.org/TR/WCAG22/#dfn-contrast-ratio), `contrast.mjs`) [V]

| Pair | Ratio | ≥4.5 | ≥3 |
|---|---:|---|---|
| Ink `#15272A` on canvas `#F7F8F5` | 14.53 | pass | pass |
| White on action `#00665C` | 6.87 | pass | pass |
| Baseline `#2356A8` on white | 7.08 | pass | pass |
| Amber `#8A4B00` on canvas | 6.38 | pass | pass |
| Red `#A52B3C` on white | 6.98 | pass | pass |
| **Baseline `#2356A8` vs candidate `#00665C`** | **1.03** | fail | fail |

- The two arms have nearly equal lightness (L\* 37.6 vs 38.3), so they merge in greyscale and print [V]. A tritan simulation (the [Machado et al. 2009](https://doi.org/10.1109/TVCG.2009.113) model) also merges them [I; not a user test].
- Distinguish arms by line and marker (dashed hollow baseline, solid filled candidate) with direct labels [P].
- Never use the action teal for the candidate arm; it visually endorses it [P].
- One option is a `#6B7C8F` dashed baseline (4.28:1 on white) with a `#2356A8` solid candidate [P].
- I did not check the palette against any reference brand.

### Screen-level change list [P]

| Screen | Change | Verify |
|---|---|---|
| Home | Prepared strip; film below the fold; model-bound question cards; Guided tour; one tagline | Pin test; first viewport at 1280×720 and 400×812 |
| Every workspace | Model header replaces the global strip | DOM test per route |
| Fleet day, top | Share moves into the result header; Austin and Launch get aliased routes | Old setup links load byte-identical configs |
| Fleet day, after Run | Focus the Result summary; no auto-replay; one "Compare one change" step | Visible without scrolling; budget sum; ≤1 enabled primary |
| Fleet day and Austin trace | Strip from frames; click shows the exact frame | Segments sum to H; blocked minutes equal the aggregate |
| Austin comparison | Verdict sentence; fork from a one-seed capture-on replay | Rounding fixtures; parity check before render; no chart when incompatible |
| Catalog | Paths, badges, IDs moved into details, Austin lessons | All 56 legacy IDs resolve |
| Motion and tokens | One motion preference; ~30 color tokens; action color never an arm | No autoplay under `data-motion="reduce"`; hex-literal lint |

**Acceptance gaps in packet §4**
- The 5–8 reviewer study needs a task script, a rubric, a definition of "without coaching", two named audiences, and a pass rule fixed in advance [I].
- Tests run on a fake DOM (`test/helpers/fake-dom.mjs`) with no browser runner, so layout and timing claims need a written browser protocol [V].
- Missing items [P]:
  - a route × state inventory;
  - an alias registry tested across the 8 routes, 56 lessons and 5 share models (`studio.js:154-156`), including a `regional-power` setup opening the new Austin route byte-identically;
  - a scripted first five minutes;
  - a decision on which engine the walkthrough uses.
- Byte plan [P]: one allocation table against the 77,785 bytes of offline headroom, keeping a 12,000-byte floor (so at most 65,785 bytes are allocated). Proposed: P1 ≤8,192; P2 ≤15,360; X1 ≤8,192; S2+S5 combined ≤28,672; R0 ≤5,120; total 65,536. Each WP's stop condition cites its own number (see §5).

## 2. N2 technical audit

All five findings are **upheld with corrections**. The diagnoses are right, but the packet's amendment texts are not yet contracts. The replacement texts below are ready to paste once D-F1a/b, G3 and G5 are decided; the F1 step-5 text and the F2 classification text are written as one consistent rule (curb-first at each request's turn). All fixtures are design fixtures; exact creation minutes need a validated external demand tape (draft 59).

### F1: curb blocking versus the line-204 energy fallback

**Verdict: agree with changes.**

**Evidence** [V]
- `src/model/bay-operations.js:204` runs `if(waiting.length)for(const v of available){blocked.add(v.id);if(v.soc_kwh<target(v)-1e-8&&startVisit(v,minute))settle(v,minute);}`. It blocks every remaining car and starts a full cleaning, charging and upload visit for each car below target (`:137-151,167`).
- Dispatch skips rather than breaks (`:189,191,198`). `startVisit` unstages the car (`:142`) before same-minute preparation (`:206-215`). `blocked` is never cleared (`:116`, `:262`).
- In probe `background 51`, one request needing 27.57 kWh sent three idle cars to depots, and 13.05 kWh trips then waited until H.
- In probe `airport 78`, staging went from `[car-2,car-4]` to `[]`.
- In an emulation (not N2), a one-slot cap with line 204 unchanged drained 5 of 6 cars; the amended rule drained none [N2 relevance I].

Draft 93 leaves approach-refused hub requests waiting, which is exactly what line 204 keys on. The drained cars are feasible for that hub request. Unstaging affects only the forecast arm, which confounds the comparison [I].

**The packet's amendment**
- Its absolute guarantee ("full approach capacity alone does not … mark a vehicle energy-blocked") is unattainable under skip semantics [V: hand trace and design-rule model]. Counterexample with the approach full: B at C holds 12.0 kWh and D at W holds 10.5. The FIFO requests are H (Hub→W), then G (C→W). H is refused at the curb, so G takes B. D fails H, so an end-of-pass trigger blocks D. With the approach uncapped, nothing is blocked.
- Only minute-level suppression gives the absolute guarantee, and it loses legacy recovery.
- The amendment also defers the predicate, never places the fallback, conflicts with draft 101, and its trace cannot distinguish it from skip plus an unchanged line 204.

**Replacement wording.** Replaces draft 93; step 6 then begins "Forecast preparation follows 5a".

> **5. Dispatch (t < H), one pass.** Process every request waiting at the start of step 5 in the declared FIFO order (G5); each receives exactly one F2 outcome at its own turn. For a hub request, check the curb first: if inbound + queued ≥ approach capacity, record `APPROACH_FULL` for `[t,t+1)`, evaluate the energy screen only to set the descriptive `idle_feasible_vehicle` flag, reserve nothing, consume no vehicle and continue. Otherwise apply the existing energy screen to `available` vehicles — the range lower bound over those vehicles, then the per-vehicle pickup + trip + nearest-depot return + reserve check, with existing tolerances — and select the nearest passing vehicle under the declared tie rule (G3); a hub assignment reserves an approach slot. If no vehicle passes, record `ENERGY_INFEASIBLE`, leave the request waiting and continue. When `available` is empty, assignment stops, but the same pass still classifies each remaining waiting request (`APPROACH_FULL` for a hub request with no free slot, otherwise `NO_AVAILABLE_VEHICLE`).
>
> **5a. Energy-recovery fallback (pinned).** After the pass and before preparation, let `A` = vehicles still available and `R` = requests still waiting. Re-evaluate the step-5 energy screen at this point over the final `A`: range lower bound computed over `A`, then the per-vehicle check, with the existing tolerances. 5a fires iff `t < H`, `A ≠ ∅`, and some `r ∈ R` fails that screen for every `v ∈ A`. It applies, in stable vehicle order, to exactly `E = {v ∈ A : v fails the screen for every r ∈ R}`: each joins the energy-blocked set and, if below target, starts the existing depot visit with the existing depot choice and reachability check. A vehicle that passes the screen for any waiting request is neither blocked nor sent to a depot. The trigger reads the energy screen, never a request's recorded reason code: an approach refusal is never itself a trigger or a reason to enter `E`, and a hub request recorded as `APPROACH_FULL` that also fails the screen for every `v ∈ A` can trigger 5a. Fallback reports list each triggering request with both its reason code and its screen result. Because refusals change later assignments, they can indirectly change which vehicles 5a reaches, so fallback blocks and visits in minutes with ≥1 refusal are reported as a separate descriptive count. Inbound, queued, boarding, on-trip and at-depot vehicles are exempt; staged vehicles follow D-F1b. The post-trip required-visit trigger is unchanged.
>
> **Parity and metrics.** Legacy Bay, Austin, airport and launch replays are byte-identical. A differential test asserts that in every N2 minute without a refusal, 5a selects exactly the set the legacy `waiting.length > 0` rule selects from the same end-of-pass state. `energy_blocked_vehicle_count` keeps its meaning. `APPROACH_FULL` remains the reason code and is reported only under `approach_refused_*` fields, never as a rejected action or energy blocking.

Rename "blocked" to "approach-refused" in draft 97 and draft 136.

**Decisions**
- **D-F1a [D]:** trigger timing — end-of-pass, examination-time, or minute-level suppression. I recommend end-of-pass [P].
- **D-F1b [D]:** staged vehicles in `E`.
  - Option 1: keep the legacy release; draft 101 then reads "…until assigned, sent on a depot visit by rule 5a, or the run ends".
  - Option 2: exempt staged vehicles from 5a. With the G1 eligibility fix and no idle energy draw (draft 99), this keeps draft 101 true and avoids churn. I recommend exemption [P].

**Fixture.** Setup:
- The draft's §4 schematic, with 4 km edges and depots at W and E.
- Vehicles use 0.25 kWh/km with reserve 8 and target 64.
- Approach capacity is 1, held by an inbound car. Staging is 0. The arm is reactive.
- Cars: K at E with 10.5 kWh, B at C with 12.0, and D at W with 8.5 (not yet blocked).
- FIFO requests: H (Hub→W), then X (W→N, infeasible for every car), then G (E→C).

Results as (assignments, blocked set, visits):

| Rule | Result |
|---|---|
| Amended | **(1, {D}, 1)** |
| (a) Skip, line 204 unchanged | (1, {B,D}, 2) |
| (b) Break on refusal | (0, {K,B,D}, 3) |
| (c) Fire only if a non-refused request waits | (1, {B,D}, 2) |
| (d) Minute suppression | (1, {}, 0) |

Add the counterexample as a fifth case. It separates end-of-pass (1,{D},1) from examination-time (1,{},0) and from uncapped (2,{},0) [V: design-rule model].

### F2: overflow metric and rejected actions

**Verdict: agree with changes.**

**Evidence** [V]
- **`rejected_actions`** is failed power proposals plus candidate-port rejections (`src/model/bay-experiment-contract.js:91`). A port rejection is recorded only when the planner sees the port as eligible but the truth rejects it (`src/model/resource-observations.js:50-55`). In the probe, 94 ordinary refusal minutes (`NO_FRESH_ELIGIBLE_RESOURCE`) produced no rejected action; the 12 recorded actions were `RESOURCE_UNHEALTHY` candidate-port rejections. The definition text (`bay-experiment-contract.js:34`) is broader than this.
- **Strict harm.** Harm is compared with a strict `>` (`src/instrument/guardrails.js:15-17,26`), so one extra action in 1 of 12 seeds means HOLD.
- **Nulls.** The shared instrument treats `null` as 0 (`src/instrument/paired.js:11-13`); only the Bay precheck (`bay-experiment-contract.js:110`) stops that.
- **Early exit.** The dispatch loop stops once cars run out (`bay-operations.js:189`), so a record of attempts alone misses requests.

**Reasoning**
- **Attribution.** Vehicle-first precedence changes with the evaluation point [V: reference traces], and it lets the treatment reclassify the same wait. Curb-first, with a descriptive `idle_feasible_vehicle` flag, is steadier [P].
- **What the metric measures.** It measures exposure, not delay. Reactive cars hold slots while driving 7–13 minutes, while staged cars start at zero distance, so the metric may rarely regress [I]. Consider making it descriptive [D].
- **Rejected actions.** Inside the N2 whitelist, `rejected_actions` is probably 0 [V: 0 with `outage_ports=0`; N2 I]. Merging refusals into it would make it the binding guardrail.
- **Denominator: all eligible `N`** [P]. At N=116, 0.02 tolerates 2 blocked hub requests per seed; at N=88 it tolerates 1 [V]. A hub-only denominator would not invalidate registered cells, but its tolerance would drift between cells [V].

**Replacement wording.** Insert after draft 97, and amend draft 93 and 97 so that `APPROACH_FULL` is a per-minute request state:

> **Approach blocking (`pickup-metrics-1.0.0`, N2 only).** For each `t < H`, every eligible request waiting at the start of step 5 gets exactly one outcome for `[t,t+1)`, judged at its own turn in the single FIFO pass, including requests reached after vehicles run out: `ASSIGNED`, `APPROACH_FULL` (hub request, no free approach slot, whether or not a vehicle is available), `NO_AVAILABLE_VEHICLE` or `ENERGY_INFEASIBLE`. `APPROACH_FULL` carries a descriptive `idle_feasible_vehicle` flag (an available, possibly staged, vehicle was feasible at that turn); it reserves nothing, consumes no vehicle and does not end the pass. Step-3 expiries and minute `H` are unclassified. Outcome request-minutes equal request-minutes waiting at the start of step 5.
>
> **Guardrail.** Unique eligible hub requests with ≥1 `APPROACH_FULL` minute ÷ all eligible requests `N`; limit +0.02, with the frozen request equivalent recorded per cell. It measures curb exposure, not delay. Before evaluation, on tuning seeds, each cell using it must show baseline headroom ≥0.02 below its ceiling (eligible hub requests ÷ `N`); otherwise the owner registers, before evaluation, a minutes-based limit or descriptive status, with a rationale.
>
> **Rejected actions.** Curb capacity refusals (`APPROACH_FULL`, full staging, no usable berth) are waiting, never rejected actions. The v2 dictionary restates `rejected_actions` as failed charging-power proposals plus candidate-port rejections for ports the planner sees as eligible but truth rejects; the v1 text stays untouched because it is embedded in v1 exports (`bay-experiment-contract.js:119`). Any other refused curb proposal (unknown berth, duplicate owner, a second concurrent reservation outside the declared staging→approach and approach→berth transfers, admission to an unusable berth), or any accepted reservation breaking a §4 invariant, is `INVALID_SIMULATION`. The N2 adapter rejects missing or non-finite required metrics before calling the shared instrument.

Draft 190 must also say what "invalid reservations that grant no capacity" expects [D].

**Fixture.**
- **Setup:** one berth; approach capacity 1, held by X (inbound, arriving at 103); staging 0; patience 12.
- **Vehicle:** car A becomes available at central at minute 100.
- **Waiting at 100 (FIFO):** h1 (hub, created at 98), b1 (central→north, created at 99), h2 (hub, created at 100). Background request b2 is created at 101.

| Reading | APPROACH_FULL minutes | Unique blocked | NO_AVAILABLE_VEHICLE minutes |
|---|---:|---:|---:|
| Amended (curb-first, at turn); b1 `ASSIGNED`; rejected +0 | 4 | 2 | 1 |
| Packet rule at turn | 1 | 1 | 4 |
| Packet rule on a pre-dispatch snapshot | 2 | 2 | 3 |
| Packet rule after the pass (hides the curb block) | 0 | 0 | 5 |
| Current loop, attempts only | 1 | 1 | only 1 of 4 original minutes classified |

Two further readings fail differently. Merging refusals into rejected actions gives +1 and a HOLD. A generic break never assigns b1. [V: reference model for the original four minutes; the b2 rows are hand-traced.]

The unique-blocked guardrail value does not separate the amended reading from the pre-dispatch snapshot (both 2); only the minutes column does, so the fixture must assert minutes as well as unique counts. Pin `trips_between_visits` high enough (for example 99) that car A's trip completion triggers no required visit inside the fixture window.

### F3: exogenous versus realized dwell

**Verdict: agree with changes; the framing needs correcting.**

**Evidence** [V]
- **Boarding time is an outcome.** It is set on arrival as ceil(assigned profile) plus airport dwell (`bay-operations.js:159-161`).
- **The forecast arm changes vehicle type.** Type follows index (`:105-106`) and staging walks the array in order (`:208-210`), so 61 of 74 staged cars were Ojai.
- **The current code does not falsely reject pairs.** It compares a 5-field exogenous tuple (`bay-experiment-contract.js:84,108`) plus whole-config equality (`:102`). All 12 of 12 seeds passed, even though 92 requests had different `boarding_min`.
- **The risk is draft 134's "dwell fields" wording.** No per-request dwell field exists; the only candidate is the realized outcome. That invites two wrong implementations:
  - **(A) Compare realized duration or start.** This rejects 12/12 seeds. Even with default profiles, comparing start rejects 12/12.
  - **(B) Precompute duration into the tape.** This passes every check and silently erases the berth cost [I].
- **Profiles must differ after rounding.** Values of 1.2 and 2 both round to 2.

**Replacement wording** (replaces draft 134's second sentence):

> **Pair inputs versus outcomes.** A request field is exogenous iff the tape builder sets it and the simulator never writes it. Pair validation compares, per potential party and request in stable ID order, at least `id`, `source_kind`, `event_id`, `release_minute`, `walk_minutes`, `created_minute`, `pickup_node`, `dropoff_node`, `trip_distance_km`, `trip_route_id`, and the nonconverted and post-`I` reconciliation rows. Whole frozen-config equality apart from `events.policy` establishes the shared boarding requirement: profile `boarding_minutes`, fleet composition and placement, integer `curb.additional_dwell_min`, and the boarding rule under `curb-resources-1.0.0`. N2 has no per-party dwell draw.
>
> **Realized boarding.** `boarding_min = ceil(profile[assigned type].boarding_minutes) + (hub origin ? curb.additional_dwell_min : 0)`, fixed at `boarding_started_minute` and unchanged by drain-on-close. For hub requests the berth is held over `[start, start + boarding_min)`. It is null, never 0, if boarding never starts. Each run recomputes the rule and the hub berth intervals; a mismatch is `INVALID_SIMULATION`. All simulator-written fields are outcomes: never compared across arms, copied between arms or precomputed into the tape. Legacy v1 pair checks and the airport `pickup_dwell_min` rule are unchanged.

Also:
- Draft 130: realized durations are outcomes.
- Draft 140: "rounded up (ceil)".
- Draft 192: reject changed profile minutes or dwell; do not compare outcomes.
- Cross-reference packet L614.

**Fixture**
- **Setup:** Vegas schematic at 60 km/h. car-1 is an Ojai (4.2, which rounds to 5) at the west depot. car-2 is an I-PACE (2) at the east depot. One hub party P is ready at minute 20. Curb: one berth, approach 1, staging 1, dwell 2. Forecast count 1, wave at minute 20. Pinned: array-order staging and same-minute zero-distance admission.
- **Candidate arm:** car-1 is staged; P boards 20→27 (7 min); car-2 is then re-staged, which exercises packet trace (e).
- **Baseline arm:** car-2 drives 6 min; P boards 26→30 (4 min).
- **Expected:** the pair is compatible and both per-run checks hold.
- **Wrong implementations:** (A) falsely rejects the pair. (B), with a precomputed 4, fails 4 ≠ 7. Omitting ceil (6.2) still departs at 27 (`bay-operations.js:170,247`), so only a field-level check catches it.
- **Caveat:** with nearest-first staging, car-2 serves in both arms and the fixture no longer discriminates [V: hand trace]. The fixture therefore depends on G3's preparation order: pin array-order staging for N2 in G3, or, if G3 chooses nearest-first, replace this fixture with a two-party variant whose expected tuples are hand-traced before S0 closes [I: the two-party remedy is not yet traced].

### F4: accounting with capture disabled

**Verdict: agree with changes.**

**Evidence** [V]
- `capture:false` drops logs and frames (`bay-operations.js:118,238`). Requests, visits, metrics and extensions stay byte-identical.
- Paired arms and replays run with `capture:false` (`bay-experiment-contract.js:127,129,135`). The replay canonical form ignores new top-level keys (`:124`), and `per_seed` exports extensions wholesale (`:131`).
- Airport staging history exists only when capture is on. The nearest one-owner precedent, port reservation (`resource-observations.js:66`), records ownership only in frames (`bay-systems.js:37`; `bay-operations.js:238-240`), and its only test reads capture-on frames (`test/advanced-operations.test.mjs:37`).
- Mitigation that exists but does not reach N2: capture invariance is tested for current outputs (`test/bay-operations.test.mjs:22`), and drafts 50 and 65 separate accounting from logging. Neither makes N2 records capture-invariant.

**Replacement wording.** Insert after draft 126. Set draft 134 to "every seed and both arms". Set draft 175 to keep per-arm record counts and digests.

> **Accounting records are not visual capture.** N2 accounting records are required output of every N2 run — single runs, both arms of every seed, replays and controls — and are byte-identical with `capture` true or false. `capture:false` omits only frames and narrative text, which is rendered from the records for curb, request-lifecycle and blocker events. Non-N2 output is unchanged. The record version joins the draft-173 composite identity.
>
> Records, ordered by a per-run `seq`:
> 1. existing request rows plus the draft-105 fields, `picked_up_minute` and `unserved_minute`;
> 2. half-open ownership intervals `{resource_kind, resource_id, vehicle_id, request_id?, start_minute, start_seq, end_minute?, end_seq?, end_reason}`, with `end_reason` ∈ {`BERTH_ADMITTED`, `EXCHANGED_TO_APPROACH`, `NONHUB_TRAVEL_STARTED`, `BOARDING_COMPLETED`, `OPEN_AT_H`}, plus `DEPOT_VISIT_STARTED` only if D-F1b keeps the staging release; zero-length intervals are kept, and holdings at `H` stay open;
> 3. one blocking run per maximal consecutive refusal run;
> 4. per-vehicle energy rows by purpose, including partial legs.
>
> **Validation and retention.** Before a seed enters statistics, a module reading only these records, visits and the frozen tapes recomputes partitions, completion, blocked requests and minutes, terminal inventory and per-vehicle energy balance (1e-6 kWh). It checks single holder, capacities, no double holding, usable berths, admission order (arrival minute, reservation `seq`, vehicle ID), one approach interval per hub assignment, and one berth interval per hub boarding start. Any failure or mismatch with engine values is `INVALID_EXPERIMENT`; this shows internal consistency, not model validity. Validation runs inside the cancellable step iterator. The v2 compact export keeps recomputed metrics, record counts and a SHA-256 of canonical records (identity, not authentication), with no per-minute series. A configuration whose config-derived worst-case record count exceeds a declared cap is rejected before tape construction.

**Size [I].**
- About 330–350 rows per arm at defaults.
- An N2-sized proxy of the current airport comparison (40 cars, H=240, intake 180, 12 seeds) downloads as 3,942,898 pretty-printed characters; `area_timeline` is 93.5% of its 1,223,320-character compact form [V: proxy run, not the shipped 24-car demo].
- Keeping digests instead of series is therefore a net saving.

**Fixture.**
- **Setup:** H=6; one berth; approach capacity 1; road speed 100 km/h. Hub parties r1 and r2 are both ready at 0. One car per depot: the east leg takes 4 minutes, the west leg 5. Boarding takes 3 minutes.
- **Expected:**
  - The east car takes r1. Its approach interval is `[0,4)` and ends with `BERTH_ADMITTED`; its berth interval is still open at H.
  - r2 is blocked over `[0,4)`. The west car takes it at 4, and its approach interval is open at H with 3.2 km driven.
  - Within target: 1. Pending: 1. Completion: 0/2.
  - Records are identical under both capture modes. Deleting the berth interval yields `INVALID_EXPERIMENT`.
- **How the alternatives fail:**
  - Log-path records produce zero intervals. The completeness check then fails, because r1's `boarding_started` survives, instead of passing vacuously.
  - Closing intervals at H loses two holdings.
  - Running dispatch before admission yields a 5-minute blocking run.
  - Booking only completed legs records the west car's pickup as 0 km.

The minimal enforceable form [P] extends the existing capture deepEqual tests to N2 records and adds a check of one berth interval per boarding.

### F5: abandonment and "observed" wait

**Verdict: agree with changes.**

**Evidence** [V]
- Expiry marks a request unserved at `minute − created ≥ ceil(patience)`. It stores no timestamp; the only trace is a capture-gated event (`bay-operations.js:183,118`).
- So abandonment − creation is always ceil(patience). The offset set was `[1]` over 54 requests at patience 1, and `[3]` at patience 2.5.
- Expiry also runs at `t = H`.
- The v1 formula adds `H − created` for requests that never arrive, and calls that time "observed" (`bay-experiment-contract.js:89,31`).
- In all 18 sampled demo runs, the maximum equals exactly H minus the creation minute of the earliest unserved request: 121–127 (airport) and 440 (Austin), against actual arrival waits of 40–54.
- Airport seed 1003: the candidate is 4 minutes worse on actual arrival wait, yet harm is 0. The guardrail measures when the first abandonment-bound request was created.
- Unserved already counts as missed in `airport-demand.js:43` and `launch-contract.js:95`, which matches draft 116 and contradicts draft 119.

**Replacement wording:**

> (1) After draft 105: "Add nullable `unserved_minute` to every **N2** request row (the assignment-patience removal minute; 'abandoned' means exactly this status), recorded in every N2 run including `capture:false`. Check: assignment, arrival, boarding and departure are null, and `unserved_minute = created_minute + ceil(patience_minutes) ≤ H`."
>
> (2) Draft 95: "Patience expiry still runs at `t = H`, before classification; a boundary exactly at `H` is abandoned with `unserved_minute = H`."
>
> (3) Draft 107 and draft 136: "`max_request_wait_min` keeps its v1 key, formula, population and 5-minute limit, and is labeled **historical max arrival-or-horizon age** in N2. Minutes after `unserved_minute` are a horizon-age convention that penalizes non-service, not observed waiting. For requests assigned but not arrived at `H`, it is a right-censored arrival wait; for requests unassigned at `H`, it is elapsed age with the outcome unresolved. Each run (arm × seed) records the ID and terminal status of the request attaining the maximum (ties: earliest creation, then ID) in the v2 per-seed summary. The v1 text and bytes are unchanged."
>
> (4) Draft 116 missed rule: "no boarding start, and abandoned or `created + T ≤ H`."
>
> (5) Replace draft 119 with **terminal boarding status** — exactly one of `BOARDED`, `ABANDONED`, `CENSORED_ASSIGNED`, `CENSORED_UNASSIGNED`, summing to `N` and independent of the target partition — and **boarding wait (descriptive)**: exact when boarded; right-censored (≥ `H − created`) when censored-assigned; `H − created` with no terminal event, not a bound, when censored-unassigned; none when abandoned. Never pool these into one mean, percentile or maximum; always show the four status counts beside any wait distribution.

Scope (1) to N2. Unscoped, it would change legacy single-run download bytes (`src/ui/regional-power-view.js:57`) [V].

**Fixture (needs an injected demand tape):**
- **Setup:** Vegas schematic at 45 km/h, where east→hub takes 8 minutes. H = I = 20, T = 8, patience 3. One car starts at east. Hub parties E, A, D, B and C are created at minutes 0, 1, 16, 17 and 18.
- **Expected:**

| Party | What happens | Terminal status |
|---|---|---|
| E | Boards at 8: exact wait 8, within target | `BOARDED` |
| A | Abandons at 4 | `ABANDONED` |
| D | Assigned at 18; arrival is due at 24, after H | `CENSORED_ASSIGNED` |
| B | Abandons at 20 = H | `ABANDONED` |
| C | Still waiting at H, age 2 | `CENSORED_UNASSIGNED` |

  The within/late/missed/pending partition is 1/0/2/2. The historical maximum is 19, set by A.
- **How the alternatives fail:**
  - Draft 119 as written reports an "observed" 19 for A, which left at minute 4.
  - Pooling all values gives a maximum of 8.
  - Without expiry at H, the partition becomes missed 1, pending 3.
  - A "fixed" historical metric reports 8.

### Additional contract gaps

An independent search looked for gaps the packet missed, and an independent re-check upheld all six gaps below, with corrections; none was refuted. The search also rejected 12 candidates as unreachable or already covered, among them fallback on approach-holding cars, idle energy drift, the partition sum, and the bootstrap under restart.

| ID | Gap | Verified evidence | Replacement | Fixture | Sev. |
|---|---|---|---|---|---|
| **G1** | Preparation eligibility omits the passenger trip. Draft 101's staging-exit claim is already false. | Preparation checks the leg, hub→depot and reserve (`bay-operations.js:212`). Dispatch also counts the trip (`:195`). The fallback releases staging (`:204`→`:142`) [V]. SFO at 35% SOC: 18 cars staged, 0 served. But SFO's depot sits at the hub; on Vegas the affected band is about 18–22% SOC [V: arithmetic]. Draft 99 already claims trip reserve checks [V]. | Require, after the leg, energy for max over declared destinations d of (trip(hub,d) + return(d, nearest depot)) + reserve. Staging exits per D-F1b. Name the SOC values and `trips_between_visits` in draft 140. Legacy unchanged. | I-PACE at west, 16.0 kWh, no request waiting after step 5. The current rule stages it (15.88 needed); the amended rule does not (18.36). | P2 |
| **G2** | The registered cells do not isolate what their labels claim. | The wave minute is undefined in draft 140. The separated cell's forecasts are ambiguous in draft 144/147. The controls' release condition is missing from draft 149 [V]. In the overlap cell the target is 6 over minutes 65–129 whether f2 is true or false; f2 alters only 125–129 [V]. With cap 6 below count 28, a count error cannot be expressed [V]. Leftover stock carries over [V]. | Give full tapes and explicit wave minutes for every cell (legacy convention: release + walk, `airport-demand.js:4-5`). Relabel the overlap false cell. Any false-alarm cell starts with empty staging, e.g. separated 60/130, event-2 conversion 0, **no event-1 forecast**. Freeze one patience value, stated explicitly in every cell's tape. | Assert the desired-stock timelines before runs; record per-publication trips after. | P2 |
| **G3** | Exact graph ties let the tie rule decide supply. Placement is unchosen. | Central is exactly 4 km from all four other nodes [V]. Ties go to the lowest index, 82/82 in a probe (`bay-operations.js:186,193-197`). Preparation uses array order, and index-block types make ties favor Ojai [V]. Drafts 134, 140 and 192 require placement to be frozen but do not choose one [V]. | Pin N2 placement, e.g. car-i → depots[(i−1) mod 2]. Declare the tie rule and preparation order as frozen policy (N2 only; amend drafts 93 and 101). Interleave vehicle types [P/D]. | Relabeling pair: array order drives 12 empty km; swapped IDs drive 4 km. | P2 |
| **G4** | Legacy wait and trip averages change meaning once a curb queue exists. | Both derive from `picked_up_minute` (`bay-operations.js:259`), and `trip_minutes` = boarding + drive (`:172`). They agree today and would diverge by the curb queue time [V]. Shown at `operations-lab.js:266,291` [V]. | Keep the names but label them arrival-based. Add boarding-start wait and queue minutes. Use "Boarding outcome pending" and "Waiting for assignment" (as in `launch-view.js:10,20`). | Berth closed over [0,12): arrival 6, boarding 12, completion 26. Legacy 6/20; queue 6. | P3 |
| **G5** | Same-minute request order is unpinned. | The airport path sorts by `id.localeCompare` (`bay-operations.js:85`); other paths keep generation order (`:87`) [V]. In the demo the lexically first request was served earlier 9 of 9 times, and airport before background 8 of 8 [V]. | An N2-only declared order that does not depend on ID spelling, or a keyed tie draw [P; D, since any fixed order favors a cohort]. | Five tied cars, four slots, with an ID-rename mutation run on an injected fixed demand tape (draft 59), so only ID strings differ (draft 75 keys draws by event ID, so renaming without a fixed tape changes the realizations). | P3 |
| **G6** | Keyed-draw independence (draft 75) is untested, and background keys depend on generation order. | `draw()` has no event dimension (`airport-demand.js:23`). Background is keyed by array index (`bay-operations.js:67`). With 24 rows ahead, 47 of 51 background origin–destination pairs change [V]. A shift encoding passes all three proposed fixtures [V]. | Key events by (seed, pinned event-ID map, party, channel) and each background request by (seed, background ordinal, channel), both through the shipped SHA-256 `src/core/keyed.js`, N2-versioned. (Keying background by its ordinal through the existing LCG first draw would be bit-identical to v1 and keep the cross-seed correlation in §3.) Register the cross-seed independence check. Exclude the hub from background places. Legacy generator unchanged. | Conversion 0.7→0 leaves other rows byte-identical. A release shift moves ready minutes by exactly +35. Keys are unique. SFO v1 is unchanged. | P3 |

**R6 ordering** [P]. Draft 93's "may join the same admission pass" points at a pass that has already run. Pin instead:
- two admission passes, one before and one after dispatch and preparation;
- at most one boarding start per berth per minute, so `b = 0` cannot admit a whole queue;
- no admission, dispatch or preparation at `H`.

**Minute-100 fixture** (2 berths, approach 4). Entering t = 100: berth B1 holds car-3 (boarding since 96, b = 4, ends 100); B2 holds car-7 (ends 102); car-11 is queued (arrived 99, reservation r10, b = 0); car-9 (r12) arrives at 100 and car-5 (r13) at 104; car-20 is staged at the hub; hub requests q-40, q-41 and q-42 appear at 100.
- Step 1: car-3 departs; B1 is free; car-9 joins the queue.
- Pass A: car-11 is admitted to B1 and, with b = 0, boards and departs at 100. B1 has used its one start for minute 100.
- Dispatch: q-40 gets car-20 (0 km, r14, queued at 100); q-41 gets a central car (r15); the approach is now full, so q-42 is `APPROACH_FULL`.
- Preparation: one car is repositioned to refill staging.
- Pass B: B1 cannot start again at 100 and B2 is busy, so car-9 and then car-20 stay queued. At 101, pass A admits car-9 to B1.

Release-and-continue would board car-9 at 100, and with more b = 0 vehicles would admit several in one minute, so the fixture separates the one-start rule from it [V: hand trace]. It does not exercise pass B's benefit, so add a single-request case: with a staged car and idle berths, the request boards at t with pass B, and at t+1 without it [V: toy]. Alternatively, reject hub `b = 0` [D].

## 3. Experiment critique

| Allowed before any evaluation seed | Forbidden (post-hoc) |
|---|---|
| Reactive-arm headroom per cell (tuning seeds) | Changing the primary, a cell, a threshold or a denominator after evaluation results |
| Non-treatment positive controls that must read IMPROVED | Choosing metrics or parameters because they show a forecast effect, even on tuning seeds |
| Exact null and byte-identity controls; a seed-independence check | Relaxing a guardrail after a HOLD |
| Saturation and headroom checks with frozen pass rules | Adding seeds after INCONCLUSIVE, other than a pre-registered extension |
| Logged, classified correctness fixes | Adding mechanisms to rescue a null result; tuning after registration without a new version and seed block |

Check rules must not depend on forecast-arm results [P]. This review's toy and analog probes did print forecast effects. The ceiling argument below uses reactive evidence only, and those forecast numbers must not steer registration [I].

| Topic | Position and evidence | Recommended wording or action |
|---|---|---|
| **Completion primary** (ceiling and sensitivity) | Agree with changes. Saturation depends on the inherited patience (default 12, `src/model/operations.js:15`). In the analog, reactive completion is 0.8214 at patience 12, where abandonment dominates. At patience 60 or 240 it is 1.0000 in all 12 seeds: interval [0,0], UNCHANGED [V analog; I for N2]. The toy's dwell-6 cell (reactive 0.803) is not at ceiling [V toy]; whether any cell is informative is established only by the reactive-headroom and positive-control checks, not by forecast-arm effects. | "Before evaluation, on tuning seeds, each cell passes a frozen informativeness check: reactive headroom, exact nulls, and a registered non-treatment positive control that reads IMPROVED. A failing cell is redesigned for all cells together, or given a separately registered primary." Capacity controls need a separately versioned control axis, because drafts 130 and 192 allow only `events.policy` to differ [V]. |
| **Detectable effect** | New. IMPROVED requires the whole interval to sit above +0.02 (`src/instrument/outcome.js:19-26`). At N1 noise (sd 0.0148), a true +0.020 reads INCONCLUSIVE, and the smallest shift that reads IMPROVED is 0.028, roughly 0.02 + 0.54·sd [V]. | Register the tuning sd and the smallest detectable gain. Size positive controls at ≥0.05. Tell readers that "no recommendation" does not mean "no improvement". |
| **Inherited parameters** | Correction. Drafts 134 and 140 freeze these values but do not state or justify them. The defaults are: start hour 7 (legs started in minutes 0–179 run at rush ×1.25 and demand ×1.6); SOC 65/85; 3 trips between visits; 4 × 50 kW chargers (`operations.js:14-19`; `bay-operations.js:49-50,64`) [V]. N1 overrode several of them (`regional-power.js:18-19`) [V]. | Name each in draft 140 with a rationale: patience, time-of-day modulation disabled, traffic, speed, SOC, trips between visits, chargers, the R5 literal, and the G3 placement. |
| **Cohort and horizon** | Agree with R3, extended. N1 counts ~480 requests through H=480 with no drain. N2 counts ~116 created before I=180, with a 60-minute drain. So 0.02 is ~9.6 requests per seed in N1 but ~2.3 in N2 [V/I]. | "N2 keeps N1's decision rule, not its estimand; the two are never shown as each other's baseline or trend." Use new versioned definition text. |
| **Seed independence** (new; found in an independent re-check) | Adjacent seeds give nearly identical demand. P(same origin at request index k) is 0.978 for Bay and 0.979 for Austin, against 0.200 if independent [V: `seedcorr.mjs`]. Cause: the first draw of an LCG seeded with seed XOR a multiple of k (`bay-operations.js:51,67-68`). Separately, Austin creation minutes are identical across seeds by construction: `requests_per_hour` 60 is exactly one per minute (`regional-power.js:18`; `bay-operations.js:64-65`) [V]. N1's 12 seeds therefore approximate one realization, so the sd above likely understates variability [I]. | An N2-versioned, well-mixed keyed background draw (as in G6), plus a registered cross-seed independence check. Leave legacy unchanged. Different seed blocks do not fix this. |
| **Boarding guardrails and granularity** | Agree with changes. Harm is a point-estimate mean of per-seed deltas, compared strictly, with no interval (`paired.js:24-48`; `guardrails.js:15-41`) [V]. A limit of 0.02 is ~2.3 all-request or ~1.2 background requests per seed. SE is ~0.0003–0.005, so false HOLDs are unlikely and the thresholds are value judgements [V/I]. | Record each threshold's request equivalent per cell. Denominators: all eligible `N` and all eligible background requests. All required. |
| **The four existing guardrails** | New. Max wait is pinned by abandoned requests: in the analog it is 135.33 in both arms with every delta 0, and it is fragile (F5) [V]. Both N1 HOLDs came from legacy guardrails: the 60% HOLD from zero-tolerance unfinished visits (+0.333 against 0), and the outage HOLD from terminal energy (5.39 kWh against a 5 kWh allowance; `bay-experiment-contract.js:68`) [V]. Preparation trips cost ~1.0–2.2 kWh each, which is real pressure on that 5 kWh limit [I]. | APPROACH_FULL is not a rejected action. Each HOLD names its guardrail and whether it is legacy or curb. The owner re-affirms tolerances before evaluation [D]. |
| **Background displacement** | Agree with R2; I prefer a guardrail [P]. I fed constructed maps (event timely +20, background timely −10, background completion unchanged) to the real `computeVerdict`. All seven guardrails were WITHIN, the primary was +0.0431 IMPROVED, and the result was **ADVANCE_TO_NEXT_TEST** while background within-target fell from 0.8333 to 0.6667. Adding the guardrail gives HOLD [V]. In a two-car hand trace, the displacement came from replenishment and vanished under a depletable budget [V: that trace only]; initial preparation also diverts supply, so a budget does not remove displacement in general [I]. | "Required `background_boarding_within_target_fraction`: background requests with boarding start − creation ≤ T ÷ all eligible background requests (late, missed and pending stay in the denominator). Max harm 0.02, ~1.2 requests per seed. Event gains cannot offset it." Decide together with R1 [D]. |
| **Forecast replenishment (R1)** | Agree with changes. The target is a standing `min(capacity,count)` (`airport-demand.js:34-36`). Assignment deletes the car from staging (`bay-operations.js:199`), and staging refills every minute (`:206-214`) [V]. With count 1: 18/100 seeds exceeded it, maximum 2 trips; a wider window gave 3 trips in 15/100 [V]. Counts of 28 against capacity 6 saturate the target [V]. | "A replenished staging target, not a one-time allocation: min(staging capacity, sum of visible counts). Staged vehicles count whichever publication caused them. Expiry stops additions and removes nothing." Per-minute detail only for the selected single run. Preparation order is frozen policy [P/D]. Airport v1 unchanged. |
| **False-forecast cell** | Disagree as registered (G2). The overlap false cell differs from the true cell for only 5 minutes [V]. Moving to separated timing helps only at short patience, and still inherits leftover stock [V: hand trace]. | Relabel it. Add a false-alarm cell with no preceding true forecast. |
| **Finite inbound reservations (R4)** | Agree with changes. Reactive admission is at most min(berths/b, A/d). Arithmetic on draft values, since no Vegas package exists [I]: 4/d is 0.571 per minute from central, 0.444 from east and 0.308 from west/north, against a berth rate of 0.5, so the approach binds except from central. With dwell 6 (berth rate 0.25) it never binds. The forecast arm can commit A + S = 10 cars against 4 [I]. In the toy, about 2/3 of the gain comes from zero-distance staging and 1/3 from staging outside the cap [V toy]. Assigned requests cannot abandon (draft 97), so completion reacts to the curb only through pre-assignment patience [I]. Each wave is about 5× berth capacity, but completion is bounded by assignments made within patience, so offered load is the wrong basis for resizing [I]. | "The forecast arm can commit up to A + S vehicles; this asymmetry is part of the treatment." Register an isolation cell with approach = fleet size (40), asserting zero APPROACH_FULL (+26 executions); this needs a declared, control-only exception to draft 79's 1–24 approach bound, registered before evaluation. Report abandonments after a refusal separately. Resize only on tuning seeds, with disclosure. |
| **Fresh defaults (R5)** | Agree with changes. `defaultResources()` has a 2-minute delay and one port per depot out over [60,120) (`resource-observations.js:3-4`), and N1 inherited it (`regional-power.js:20`) [V]. Delay 0 with no outage gives 3,840/3,840 eligible port-minutes; an outage of 0/0 fails validation (`:13`) [V]. Round-robin placement would put cars at the hub (`bay-operations.js:106-107`) [V]. | Omit `resources` in N2 v1 and report those metrics as "not modeled", not zero (draft 107). Otherwise require the exact literal (`delay_min:0`, `outage_ports:0`, `outage_start_min:0`, `outage_end_min:1`). Pin depot-only placement. |
| **Seed protocol (R8)** | Agree with changes. The Bay engine has not used the proposed blocks, so they remain fresh for N2 as R8 says. But the same integers are the four-area teaching model's public seed sets 2 and 3 (`seedSet(k,n)` = 1000k+1…, `src/model/presets.js:14-21`), with pinned verdicts (`test/ops-cases.pins.json:3`) [V]. That is a different engine and RNG, so this is a labeling hazard, not contamination [I]. The n=12 percentile interval covers ~0.93 [I: 400-replication Monte Carlo, SE ≈0.013; theory ≈0.91], and discrete deltas give degenerate intervals [V]. Cells share seeds, so their evidence is correlated [I]. | State that freshness is model-scoped, or use 2501–2512 and 3501–3512 [P]. The record holds: commit; identities; digests; primary and guardrails (direction, limit, denominator, null rule, request equivalent); bootstrap settings; seed lists plus the grep used; check results; dispositions; an append-only inspection log. |
| **Dispositions** | New. UNCHANGED at ceiling has a zero-width interval, and INCONCLUSIVE maps to RUN_MORE_EXPERIMENTS (`recommendation.js:30`) [V]. | Show headroom next to UNCHANGED; below the smallest detectable gain, call it uninformative. For INCONCLUSIVE: either no extension, or one pre-registered extension with a stated combined analysis (the cap is 40 seeds, `bay-experiment-contract.js:59-60`) [D]. No pooling. |
| **Null and positive controls** | Agree. Reactive versus forecast-with-staging-0 is byte-identical apart from `airport.policy`, in both capture modes, with every delta 0 [V: seeds 9001–9003 and 9501–9502]. N2 needs the forecast arm to have no other channel [I]. | "Controls are byte-identical except enumerated policy fields; a failure is a defect, never a result." |
| **Budget (R7)** | Agree. Each 12-seed comparison runs 26 executions [V]. That gives 130 for five cells, 182 with the two controls, and 208 with the isolation cell [V/I]. 249,600 vehicle-minutes per comparison at 40 cars [V]. N1 per-seed exports are 99.6% of the comparison, and one power trace is 94.9% of an arm [V]. | Compact v2 per-seed records hold fixed-size scalars only. Stop thresholds [P]: compact export ≤256 KiB; single run without frames ≤1 MiB; per-WP package allocations with a 12,000-byte floor. Scope the 50 ms rule to N2: the N1 data-URL encode already takes ~55 ms in Node [V]. |

## 4. Data-learning critique

**Verdict.** The Motion pilot advances part of one lesson at most, and it should not run now [I/P]. It teaches data literacy: the difference between an observation, a missing observation and a model. It cannot calibrate any FleetLab input, and three of the four proposed lessons need no data.

| Lesson (packet L234–239) | Needs WOD? | Assessment |
|---|---|---|
| 1. A missing track is not a stopped car | Partly | Synthetic tracks with a declared missingness mechanism teach the concept [P]. Only the real magnitude needs recordings; objects valid only in the future exist per the spec [V]. Public display waits on rights questions Q2–Q3. |
| 2. Replay is not a counterfactual | No | Needs altered-ego replay, which the runbook defers [V]. Packet L202 bars the vehicle-time strip from introducing "a second simulation or metric engine"; extending that to altered-ego replay in the browser is an inference [I]. A labeled synthetic scene works [P]. |
| 3. Street motion is not depot readiness | No | Needs only the public schema (four object types; no weather, depot or energy fields) and FleetLab's own config [V]. |
| 4. A delay assumption can move service harm | No; WOD would hurt | `traffic_multiplier` and `road_speed_kph` already exist (`src/model/operations.js:15,41`), and OPS-16 already runs ×1.3 vs ×2.0 [V]. Completed trips out of 284: 95 by default, 78 at ×1.5, 46 at ×3.0 [V]. A WOD-derived value suggests a calibration the packet denies, and may count as Derivative IP [V terms; I]. |

**Four activities.**
- **Observed tracks** show what a cohort contains under stated filters. They cannot show city or hour distributions, because timestamps start at zero and each scene has an arbitrary origin, nor anything about vehicle performance ([FAQ](https://waymo.com/intl/es/open/faq/)) [V].
- **Replay** reconstructs tracker estimates; any interpolation is model content [I].
- **Simulation** is conditional on the declared actor models. Waymax's license covers its outputs and bars validating real vehicles [V].
- **FleetLab sensitivity** shows how results respond to an assumed input. It is not calibration.

**Where the packet blurs them.**
- **B1:** the "bridge" (L239, L280). A value is either assumed, in which case no WOD is needed, or derived, which would be a calibration claim with no valid transfer. Drop the bridge [P].
- **B2:** the chosen first lesson (L282) needs no data.
- **B3:** Lesson 2 needs machinery the pilot excludes.
- **B4:** L279 imports driving-policy evaluation, which is not a FleetLab question.
- **B5:** the SDC track mixes manual and autonomous driving and must be excluded from pooled statistics [V: FAQ]. The packet does not address this.

**Unavailable inputs** (confirmed and extended) [V schema; I]. Each FleetLab input below has no counterpart in the published Motion schema (FleetLab paths relative to `playground/fleetlab/`):
- road-link, hour and weather attribution for travel (`src/model/operations.js:14-15`: `start_hour`, `weather`, `traffic_multiplier`);
- Street-lab flow, incidents and curb dwell (`src/model/street-simulation.js:4,17`: `background_per_hour`, incident window, `boarding_seconds`, `curb_bays`);
- rider requests and airport waves (`operations.js:14`: `requests_per_hour`; `src/model/airport-demand.js:3-5`);
- vehicle energy and boarding (`src/model/vehicle-profiles.js:13-17`; `operations.js:18-19`: battery, SOC, reserve);
- depot and charging work (`src/model/depot-readiness.js:6`; `operations.js:16-17`; `src/model/resource-observations.js:3-4`; `src/model/site-power.js:6-12`);
- fleet identity;
- a geography that registers to FleetLab's OSM maps.

No FleetLab source references WOD, TensorFlow or Waymax [V].

**Sampling and missingness hazards.** I mirrored the parser on synthetic proto2 records [V unless marked]:
1. **Missing values read as zero.** A missing velocity comes back as 0.0 m/s, and an unset `current_time_index` passes. Require `HasField`, and require the index to equal 10.
2. **Unchecked invariants:** map-state length, index ranges, duplicate IDs, `TYPE_UNSET`, t0 = 0 and Δt ≈ 0.1 s.
3. **Silent parsing:** unknown fields parse without error.
4. **Late size cap:** the 50 MiB cap applies after materialization, so pre-check the header length.
5. **Speed and heading:** there are two speed estimators, and heading wraps at ±π [V/I].
6. **Not a simple random sample** [V/I]:
   - missingness is informative;
   - stops are censored;
   - windows overlap with **no segment-identity field**;
   - track IDs are per scene;
   - the frame is a single shard;
   - `tracks_to_predict` is curated.
7. **Format details:**
   - lidar shards break the caps;
   - releases before 1.3.0 use the older signal alignment;
   - keep centers in float64;
   - describe the frame as "per-scene arbitrary-origin ENU ('global' in Waymo's wording)".

**Format and platform.**
- The 1.3.1 SDC routes exist only as tf.Example `path_samples/*`; `scenario.proto` has no route field [V]. A Scenario pilot, which avoids tf.Example's 128-object truncation, therefore gains nothing from 1.3.1.
- No public 1.3.1 Scenario path was found. That is not proof of absence [V].
- The host is arm64 macOS, but the 1.6.7 wheel is manylinux x86_64 only and pins TensorFlow 2.13 [V]. **There is no native install path.**
- Recommended [P]: a TensorFlow-free reader. It uses Apache-2.0 protos at a pinned commit (not `wdl_limited`) and TFRecord framing with CRC32C, already checked against the standard check value `0xe3069283` ([CRC-32/ISCSI in the CRC catalogue](https://reveng.sourceforge.io/crc-catalogue/17plus.htm#crc.cat.crc-32-iscsi)) and against a flipped bit. Add a golden synthetic TFRecord that must pass before any real byte is read.

**Publication questions** for the owner, counsel or Waymo (open-dataset@waymo.com) [D]:
1. Is a free public teaching site, including its offline package, "Non-commercial" and outside "Production Systems"?
2. Which clause, if any, permits aggregate charts for unregistered visitors?
3. Is a lesson page a "research publication", and how small is a "small extract"?
4. Is a replay, pre-rendered or rendered in the browser, a viewable copy?
5. Would a derived parameter make setup links (`src/ui/setup-sharing.js:21-31`), exports or the offline pack Derivative IP?
6. Is a public WOD parser Derivative IP, and must its fixtures be synthetic?
7. May notebook outputs reach an unregistered reviewer?
8. What process makes a synthetic scene "not made using the Dataset"?
9. May Waymax outputs be shown publicly?
10. Can scenes be geolocated by OSM matching?
11. Where must attribution appear without implying endorsement?
12. What must be deleted on revocation, including offline copies?

**Runbook corrections**
- **L313:** drop ADC login, or check `billing/quota_project` and add `--disable-quota-project`. It writes a quota project by default, which contradicts L298.
- **L321:** `--manifest-path` appends and never retries OK or skipped items. Use a fresh manifest and abort if the destination exists.
- **L318–322:** enforce the 1 GiB cap in the script.
- **L302–304:** require Scenario, non-lidar and not `*_20s`, and drop the route rationale.
- **L305:** verify with the object's own CRC32C or MD5.
- **L331–332:** use the protos only (the notebook imports `wdl_limited`), and note the arm64 limitation.
- **L372–374:** segment identity is unavailable; name the hash; exclude the SDC track.
- **L385 (security):** the PyPI package named `waymax` is not Waymo's. It is a single 0.0.1 upload dated 2026-09-02 whose summary reads "Bug Bounty PoC for Waymo" ([PyPI JSON](https://pypi.org/pypi/waymax/json)) [V]. A plain `pip install waymax` would install a third party's proof-of-concept package, a dependency-confusion risk. Install only from the official git URL at a pinned commit, and never vendor it (LICENSE §2.c). The packet now carries this warning at L385 (corrected in place 2026-09-26).
- **L396:** default-deny derived parameters.
- **L403–411:** add a platform gate; get rights answers before any WOD lesson draft; write the synthetic lesson first.

### External-claim check (2026-09-26; no sign-in) [V]

| Packet claim | Result | Source |
|---|---|---|
| Motion 1.3.1 (Oct 2025) adds SDC paths; Perception 1.4.3/2.0.1; E2E 1.0.0 (L252) | Confirmed; the English page redirects to sign-in | [Download listing](https://waymo.com/intl/es/open/download/) |
| TFRecord Scenario/tf.Example; 91 samples at 10 Hz; hidden test future; per-scene ENU metres (L258, L368) | Confirmed; Waymo calls it a "global frame" | [Motion spec](https://waymo.com/intl/es/open/data/motion/) |
| March 2025 non-commercial terms (L266) | Confirmed; the summary omits the non-assert, privacy, license-back, ToS and litigation clauses | [Terms](https://waymo.com/open/terms/) |
| WOD code Apache-2.0 except `wdl_limited` (L270) | Confirmed | [README](https://raw.githubusercontent.com/waymo-research/waymo-open-dataset/master/README.md) |
| Waymax license covers outputs (L270) | Confirmed; also bars conveying unmodified materials | [Waymax LICENSE](https://raw.githubusercontent.com/waymo-research/waymax/main/LICENSE) |
| Mixed manual/autonomous data (L272) | Confirmed | [FAQ](https://waymo.com/intl/es/open/faq/) |
| 1.6.7 wheel is Linux x86-64 only (L332) | Confirmed; pins TensorFlow 2.13 | [PyPI JSON](https://pypi.org/pypi/waymo-open-dataset-tf-2-12-0/1.6.7/json) |
| Sim Agents tutorial parses Scenario records (L331) | Confirmed; imports `wdl_limited` | [Notebook](https://raw.githubusercontent.com/waymo-research/waymo-open-dataset/master/tutorial/tutorial_sim_agents.ipynb) |
| Waymax 1.3.1 configs use tf.Example with SDC paths (L302–304) | Confirmed | [config.py](https://raw.githubusercontent.com/waymo-research/waymax/main/waymax/config.py), [tf.Example spec](https://waymo.com/intl/es/open/data/motion/tfexample/) |
| gcloud flags and `objects describe` (L309–326) | Confirmed by syntax check only; not executed | [cp](https://docs.cloud.google.com/sdk/gcloud/reference/storage/cp), [describe](https://docs.cloud.google.com/sdk/gcloud/reference/storage/objects/describe) |
| Billing project charged without Requester Pays (L298) | Confirmed; the ADC default quota project adds the same risk | [Requester Pays](https://docs.cloud.google.com/storage/docs/requester-pays), [ADC](https://docs.cloud.google.com/sdk/gcloud/reference/auth/application-default/login) |
| ScenarioNet 1.2.0; Waymax demo 1.1.0 (L385, L387) | Confirmed; ScenarioNet's path holds 20 s segments | [ScenarioNet](https://scenarionet.readthedocs.io/en/latest/waymo.html), [Waymax demo](https://waymo-research.github.io/waymax/docs/notebooks/data_demo.html) |
| Parser field names (L334–376) | Confirmed, with the proto2 default gaps above | [scenario.proto](https://raw.githubusercontent.com/waymo-research/waymo-open-dataset/master/src/waymo_open_dataset/protos/scenario.proto) |
| Perception Parquet without maps; E2E eight cameras (L259–260) | Confirmed | [Perception](https://waymo.com/intl/fil/open/data/perception/), [E2E](https://waymo.com/intl/es/open/data/e2e/) |
| Waymax access steps, boxes, IDM, metrics (L296, L385) | Confirmed | [Waymax README](https://raw.githubusercontent.com/waymo-research/waymax/main/README.md) |

Not verified: object sizes, the per-version inventory, Requester Pays status, and billing behavior.

**Recommendation for data work** [P].
- **Now:** Lessons 3 and 4, a synthetic Lesson 1 with an independence log, and the runbook corrections. No data and no terms are needed.
- **Defer:** acquisition, until four conditions hold:
  - Q1–Q4 are answered, or the owner accepts a private-only outcome;
  - a platform passes the golden fixture;
  - billing is checked;
  - a Scenario non-lidar object of 1 GiB or less is identified.

  Then run a spike of one day or less: one shard, 20 records, a private report.
- **Gating rule (one rule everywhere):** a private one-shard spike needs Q1–Q4 answered, or a private-only outcome accepted. Any WOD-based lesson draft or public artifact needs Q1–Q5 answered.
- **Drop:** the bridge, driving-policy simulation, a WOD-backed Lesson 2, and Perception/E2E.

**Data stop conditions.** Stop the data work, preserving any private findings, if:
- the only suitable Scenario object exceeds the caps, or is lidar-split or a `*_20s` segment;
- the reader fails the golden fixture, CRC or invariant checks;
- any request needs a billing project;
- an output needs location, time of day, depot, demand or energy information;
- a public artifact is proposed before Q1–Q5 are answered;
- a result is framed as vehicle performance or safety.

## 5. A smaller, stronger next-phase plan

The plan has four tracks:
- **P**: presentation, over existing engines only;
- **S**: N2 semantics, as documents and fixtures;
- **X**: deterministic execution;
- **R**: optional data research.

S and X never touch presentation, and P never touches model math. Priority order across tracks: S0 and P0 first, in parallel; X1 next, since S2 needs it; P1–P2 before S5; R0 whenever capacity allows; R1 only if its gates pass. Byte allocations follow the §1 table.

| WP | Depends on | Deliverable | Measurable acceptance | Stop condition |
|---|---|---|---|---|
| **P0** Prototype and inventories | — | Prototype of Home, one Austin case, one comparison and the narrow result; route × state and naming inventories; alias-registry spec; scripted first five minutes; study protocol; byte allocation table | Every route × state (including unavailable, invalid, canceled, stale and empty-population) has a named render in the prototype; study protocol frozen with task script, rubric and pass rule before any session; allocation table sums to ≤65,785 bytes | Needs an engine change, or a primary invented for single runs |
| **P0s** Formative study | P0 | 5–8 reviewers across two named audiences, run with the frozen protocol | Tasks: name the question, changed input, result, displaced harm and simulation limit without coaching; pass rule ≥4 of 5 per task, fixed in advance; counts and individual failures reported, no population claims | Protocol changed after the first session (restart with a new version) |
| **P1** Result-first Fleet day and model identity | P0 | Model header; relabels; Austin and Launch routes; Result summary with a model-side, tested time-budget projection; no auto-replay; one motion preference; non-affiliation line | Summary visible after Run at 1280×720 and 400×812; ≤1 enabled primary per state; moved setups byte-identical; offline delta ≤8,192 bytes | A legacy link fails; delta >8,192 bytes; or the summary needs a new metric engine |
| **P2** Explained result | P1 | Strip; Austin sentences and lessons; one-seed capture-on fork | Segments sum to H; blocked minutes equal the aggregate; sentences equal fields; parity holds before fork; offline delta ≤15,360 bytes | Parity fails; a second metric engine is needed; or delta >15,360 bytes |
| **P3** Navigation rename (optional) | P2 and P0s | Lessons/Labs/Method behind aliases | All 8 routes, 56 lessons and 5 share models resolve; old setup links load byte-identical configs | It would coincide with an N2 build, or P0s did not pass |
| **S0** WP0 addendum | — | Corrected draft: §2 texts, G1–G6, R1/R4/R5/R6, transition/ownership table, metric dictionary, version table, decisions | Every §2 fixture and packet traces (a)–(e) hand-traced to expected tuples | Any fixture still admits two readings |
| **S1** Experiment registration | S0 | Registration record; per-cell tapes; guardrails including background within-target; dispositions; seeds | No undeclared inherited value; request equivalents recorded; nothing depends on forecast-arm results | Choices cannot be fixed without seeing forecast effects |
| **X1** Execution seam | — | Step iterator and cancellation over existing models; reuse or reject the shipped Worker host (`src/runtime/host.js`, `src/runtime/protocol.js`) | Legacy parity; chunk-schedule equality; no simulation task >50 ms and cancel acknowledged within one step (p95 input→visible cancel ≤100 ms, max ≤200 ms over ≥20 offsets, per draft 161) under a written browser protocol; no N2 policy; offline delta ≤8,192 bytes | Parity breaks; the budgets cannot be met within bounded inputs; or delta >8,192 bytes |
| **S2** N2 model and accounting | S0, S1, X1 | One graph, two waves, one hub; v2 metrics; capture-invariant records; validation module | S0 fixtures pass as tests; records identical across capture modes; legacy bytes unchanged; independence checks pass | Needs UI-side computation, or legacy bytes change |
| **S3** Pre-evaluation checks | S2 | Tuning-seed report: informativeness, null identity, approach headroom, seed independence, detectable gain | Each check passes its frozen rule | The only fix is post-hoc |
| **S4** Registered campaign | S3 | All cells and controls, including null and adverse | Each reported separately; HOLDs attributed; no pooling | A null control not byte-identical, or any `INVALID_*` result, halts the campaign as a defect (logged correctness fix, new version, new seed block); results are never selectively reported |
| **S5** N2 review surface | S4; P2 headroom | Compact review/share UI | S2+S5 offline delta ≤28,672 bytes combined; compact export ≤256 KiB | Offline headroom below 12,000 bytes, or the S2+S5 allocation exceeded |
| **R0** No-data lessons | P0 | Lessons 3 and 4, synthetic Lesson 1, runbook corrections | No WOD bytes or terms; offline delta ≤5,120 bytes | A lesson needs WOD bytes, dataset terms, or a new engine |
| **R1** Private one-shard spike (gated) | R0; Q1–Q4 answered, or private-only accepted | Private report on 20 records | Golden fixture first; CRCs and invariants pass; versions recorded | Any §4 data stop condition |

**Defer**
- **Waymax, MetaDrive and ScenarioNet:** licensing is restrictive, arm64 support is unknown, and no lesson needs them.
- **Perception and E2E:** no teaching use.
- **WOD-derived parameters:** no valid transfer, and possible Derivative IP.
- **Raising the offline limit or reworking the packer:** needs its own review. The page already carries at least 201,294 comment characters and 364,028 bytes of modules duplicated in the worker (`tools/pack.mjs:487-500,741-760`) [V].
- **A navigation rename during N2.**
- **Extra N2 mechanisms added to rescue a null result.**
- **Dark mode.**

## 6. Packet errata

N2 amendment corrections (F1–F5) are in §2. Other corrections:

| Packet location | Says | Actually | Evidence |
|---|---|---|---|
| L424 | Absolute local checkout path | A home-directory path in a tracked public document. **Fixed in place 2026-09-26** (line count unchanged). Older tracked docs, including `AGENTS.md`'s canonical repository root, still carry the same path by design | Packet [V] |
| L426 | HEAD `86d1214` | That was HEAD at audit time; the current HEAD, `7dbb6cb`, is the commit that added the packet | `git rev-parse` [V] |
| L54, L64 | Website and working branches | `github/feat/fleetlab-playground` equals HEAD, but the local branch is 9 commits behind. `codex/fleetlab-regional-power` has no upstream. Refs are last-known; nothing was fetched | `git branch -vv` [V] |
| L70–77 | Austin "Full power" | Every N1 setup inherits a 2-minute observation delay and a one-port-per-depot outage over [60,120), so "Full power" is not a healthy control | `src/model/regional-power.js:20` [V] |
| N1 record | 16 repeatability arms | 8 ran: 2 per comparison, so 104 calls = 96 + 8 | `tools/fleet_playground/regional_power_demo.mjs:30`; probe [V] |
| R4 | Cites draft 83, 93, 101 | Its admission-order point relies on draft 92 | Draft [V] |
| R7; draft 155, 163 | Seam avoids a new CSP capability | Both CSPs already allow workers, and a Worker host already ships | `tools/pack.mjs:18,30,48,761`; `src/runtime/host.js:1-2` [V] |
| Draft 175 | 65,536-byte decode limit | 65,536 is the envelope/export limit; the 32,768-character cap binds first on decode | `src/ui/setup-codec.js:23-24,212-259` [V] |
| R1 (L531) | "Several" trips from count 1 | Nuance: the demo maximum is 2; 3 only with a wider window | `r1-scan.mjs` [V] |
| §4 | The strip is a new component | The older workbench already ships timeline and fork charts | `src/ui/charts.js:1155,1187` [V] |
| §4 (L171) | Lead with primary and guardrails | Single runs have no registered primary | `operations-lab.js:261-264` [V] |
| §4 tokens | Blue baseline, teal candidate | 1.03:1 lightness contrast; teal is also the action color | `contrast.mjs` [V] |
| R8 | The seeds are fresh | Addition, not a contradiction: unused by the Bay engine, but the integers coincide with the four-area teaching model's public seed sets 2 and 3. State freshness as model-scoped, or pick 2501–2512 / 3501–3512 [P] | `src/model/presets.js:14-21` [V] |
| L252, L302–304 | 1.3.1 routes motivate the pilot | Routes exist only in tf.Example | Proto [V] |
| L313 | ADC login | Writes a quota project by default, contradicting L298 | ADC reference [V] |
| L321 | Manifest makes transfers resumable | It appends to an existing file and never retries OK or skipped items | `cp` reference [V] |
| L354–361 | Missing is not zero | Proto2 defaults make a missing velocity 0.0 | Probe [V] |
| L376 | "Scene-local" coordinates | Waymo calls it a "global" frame, with a per-scene arbitrary origin | Spec [V] |
| L385 | Waymax install left unspecified | PyPI `waymax` is an unrelated bug-bounty proof-of-concept upload. **Security note added in place 2026-09-26** | [PyPI JSON](https://pypi.org/pypi/waymax/json) [V] |

Two minor items: `tools/check-dist.mjs:3` says "2 MB" where the limit is 2.5 MiB, and the packet has 919 lines, not 920.

## Recommendation

- **Presentation.** Adopt the **studio skin on a casebook skeleton**. Order the work:
  1. a result-first Fleet day with a model header;
  2. the explained Austin case;
  3. optionally, the navigation rename.
- **N2.** Hold the freeze until the S0 addendum lands. The five findings are right, but freeze the §2 replacement texts, not the packet's amendments, together with:
  - G1–G6;
  - the R4 commitment asymmetry;
  - the R6 two-pass ordering;
  - the background within-target guardrail;
  - a registration record with pre-evaluation checks.
- **Execution seam.** Build it independently, after checking whether the shipped Worker host already provides it.
- **WOD.** Do no WOD data work now. Publish the three no-data lessons, and gate any private spike on rights answers and a working TensorFlow-free reader. [P]

## Top risks + mitigations

- **The primary may not be informative.** In the existing-engine analog and the toy hub, completion hits the ceiling at long patience and is driven by abandonment at short patience [V analog/toy; I for N2]. The smallest readable gain is about 0.02 + 0.54·sd: 0.028 at N1's sd, likely a lower bound because N1's seeds are correlated [V formula and N1 sd; I for N2].
  - *Mitigation:* reactive-only informativeness checks and positive controls, frozen before evaluation. Label UNCHANGED uninformative when headroom is short.
- **Correlated seeds overstate precision.** In the current Bay and Austin generators, adjacent seeds share ~98% of background origins [V for the legacy generator; I for N2 if it reuses that generator].
  - *Mitigation:* keyed N2 background draws and a registered independence check.
- **Inherited lifecycle behavior contaminates the mechanism.** In current code, line 204 drains cars and unstages them, array-order ties decide supply, and preparation ignores trip energy [V current code; I for N2 until the S0 wording lands].
  - *Mitigation:* the 5a, G1 and G3 wording with discriminating fixtures, before any code.
- **Legacy artifacts decide the guardrails.** Max wait is set by the earliest abandonment in all 18 sampled runs [V]. Both N1 HOLDs came from legacy guardrails: one from zero-tolerance unfinished visits, the other from terminal energy against a 5 kWh allowance [V].
  - *Mitigation:* the F5 relabel, HOLD attribution, and owner re-affirmation before evaluation.
- **Polish implies validity, or models get mixed.**
  - *Mitigation:* a model header on every route, honest `OTHER_RESOURCE` copy, versioned prepared examples, and a non-affiliation line.
- **Data-rights overreach.**
  - *Mitigation:* a private spike only after Q1–Q4 (or an accepted private-only outcome); no WOD-based lesson draft or public artifact before Q1–Q5; derived parameters are default-denied.
- **Package budget.** Only 77,785 bytes of offline headroom remain [V].
  - *Mitigation:* the §1 allocation table (65,536 bytes allocated, 12,000-byte floor), per-WP stop conditions, and digest-only paired retention.

## Next 3 actions

1. **Decide in one sitting:**
   - D-F1a and D-F1b;
   - whether F2's approach metric is a guardrail or descriptive;
   - the G3 tie and placement rules;
   - the G5 request order;
   - the background within-target guardrail;
   - patience and the other inherited values;
   - which engine the walkthrough uses.
2. **Write the S0 WP0 addendum** from the §2 replacement texts and G1–G6, with every fixture hand-traced to expected tuples. No production code.
3. **Start P0 in parallel:** prototype, inventories, alias-registry spec, study protocol and byte plan. From the data track, publish only the no-data lessons plan.
