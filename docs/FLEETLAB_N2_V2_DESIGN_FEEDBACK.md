# FleetLab design audit: N2 v2 contract, teaching clarity and next implementation steps

**Status, 2026-09-26.** This is a read-only design audit that the owner requested before any further implementation. It covers two reviews: the N2 v2 contract review (§0 to §10, Appendix A) and a teaching-clarity review of the live site with a three-part articulation of every simulation and lesson (§11, §12, Appendix B). §13 turns both into ordered Codex tasks. The owner's decisions of 2026-09-26 are recorded throughout.

**What was reviewed:**
- `docs/plans/2026-09-26-fleetlab-n2-design-v2.md` ("v2": 618 lines, SHA-256 `da7b8069…d383d`, committed at `76439c6`). It was checked against:
  - the owner decisions in brief §2;
  - the packet review;
  - the immutable v1 (SHA-256 `c574b8df…7e25bf`, re-checked unchanged);
  - the shipped source at `790573e`. Model code is unchanged since `345b427`.
- `docs/FLEETLAB_D1_RELEASE_2026-09-26.md` and the live D1 release (Production `dd4bfa44`, source `b99ab04`).
- For teaching clarity: the live site as a first-time viewer would meet it (two real-browser walkthroughs), the lesson catalog (56 lessons), each simulation's source and copy, and model runs, test pins and recorded artifacts used to ground every learning statement.

**How it was reviewed.** For the teaching-clarity review (§11, §12, Appendix B): two live walkthroughs, a copy and byte lane, and ten articulation lanes, each checked by an adversarial verifier. A critic then checked the sections, two fix rounds closed all 28 critic issues, and a final verification ran 516 copy-rule checks with 0 violations. For the N2 review, ten review lanes ran: three on fixtures, plus coherence, metrics and experiment design, feasibility, simplicity and scope, a reactive-only toy spike, a D1 audit, and the review surface. A second, independent verifier checked each lane, and a final critic checked this document against the verified material. Each finding is used as its verifier adjusted it. Where verifiers disagreed, or where this synthesis chose between lanes, the text marks it [P] or [D].

**What did not happen.** Nothing was implemented. No repository file, git state or deployment changed, and probes ran only in review scratch space. N2 does not exist, so no N2 runtime behavior is described as observed.

**Tags:**
- **[V]**: verified by source reading or an executed probe, and confirmed by the verifier.
- **[I]**: inference.
- **[P]**: reviewer preference.
- **[D]**: needs an owner decision.

**TOY** means a throwaway reactive-only hand model of the v2 hub rules (seeds 9101–9112). **ANALOG** means the existing legacy Bay engine, run reactive-only. Neither is an N2 result.

Other conventions: severities are the verifier-adjusted ones; `v2:L<n>` is a v2 line; source paths are relative to `playground/fleetlab/`; `OD-n` refers to the decision table in §9.

## Start here

**What this document is.** A design audit of FleetLab, written 2026-09-26 against commit `790573e`, with D1 live. It has four parts:

| Part | Sections | Purpose |
|---|---|---|
| N2 contract review | §0 to §10, Appendix A | Review of the N2 event-curb-lab design (v2), with the owner's decisions recorded, and the Codex prompt for v2.1 |
| Teaching clarity | §11 | Why the site is hard to follow, and the three-part teaching frame that fixes it |
| What each simulation teaches | §12 (start with §12.0), Appendix B | Every simulation and all 56 lessons in three parts: What & why, How we simulate, What you learn and the ops takeaway, grounded in model runs and test-pinned verdicts |
| Implementation plan | §13 | The ordered tasks for Codex, each with a copy-ready prompt |

### For the owner

**Short answer to "what does each simulation teach?":** §12.0, one table.

**Decisions recorded 2026-09-26:**
- **OD-1:** route A, offline-only comment removal in the packer.
- **OD-3:** G3 fix B.
- **OD-4:** integer share arithmetic.
- **OD-5:** nearest-eligible preparation.
- **OD-6:** checker split.
- **OD-19:** S1a before X1; S1b before any forecast-arm run; S5 after S4.

**Decisions needed next** (recommended defaults in the cited sections):

| Decision | Recommended | Needed before |
|---|---|---|
| **OD-2** per-work-package byte budgets, including teaching package T (61,440 B stop, 53,248 target; this is OD-T3) | §4.6 table plus package T | Task 3 (T1) and X1 |
| **OD-T1, OD-T2, OD-T4 to OD-T7**, the teaching-frame choices | Yes to all (§11.6 table) | Task 3 (T1) |
| OD-7 to OD-18 and OD-20 to OD-26, the N2 choices | PENDING with defaults (§9.2); most belong to S1 | Later N2 steps |

### For Codex: do these in order

Each task is separate. Run them one at a time. Each starts from the previous task's final commit, so the branches stay on one line of history.

1. **Task 1: N2 design v2.1 (docs only).** Prompt: §10. The owner's DECIDED ODs are already in it.
2. **Task 2: packer route A (tooling).** Prompt: §13.2. It frees about 300 KB of offline-package headroom that T1 and N2 need.
3. **Task 3: T1 teaching frame (presentation only, deployable).** Prompt: §13.3. Prerequisites: Task 2 is in its history, and OD-2 and OD-T1 to OD-T7 are recorded in the launching message.
4. **Later, each needing its own approval:** S1a registration (docs), the X1 execution seam, S2 (N2 model), S1b checks, S4 evaluation, then S5 (N2 review surface), and the T2 teaching follow-ups (§13.4).

**Evidence pointers.** Mentions of review scratch folders (for example `teaching-review/...`, `n2v2-review/...`, `fix-round/...`) name the audit's throwaway probes. They are not in the repository. Re-derive a value with your own probe instead of looking for them.

**Rules for every task:**
- v1 and v2 of the N2 design are immutable.
- Never stage, edit or delete the owner's untracked note `FleetLab-ChatGPT-review-and-next-phase.md`.
- Stage only by explicit path.
- No force-push, history rewrite, `main` merge or PR.
- Push or deploy only when the launching message says so.
- The repository is public: no personal data, tokens or absolute home paths.

## 0. Verdict and the five things to fix first

> **Owner decisions recorded 2026-09-26.** The owner accepted the recommended defaults for **OD-1** (budget route A), **OD-3** (G3 fix B), **OD-4** (integer share arithmetic), **OD-5** (nearest-eligible preparation), **OD-6** (checker split) and **OD-19** (S1a before X1; S1b before any forecast-arm run; S5 after S4). They are applied as contract in §9.2 and in the §10 prompt. All other ODs stay PENDING with their recommended defaults. The next decision needed is **OD-2** (per-work-package byte allocation), before X1.

v2 is careful and mostly coherent:
- Every hand-traced tuple in §9 reproduced under its stated setup: 19 of 19 fixture groups, re-derived by three fixture lanes and three verifiers [V]. Three qualifiers apply:
  - R6 reproduces only with injected b values that the §3.3 rule cannot produce.
  - F3, F4, F5 and G4 reproduce only at start_hour 0, which v2 never states.
  - G2 was checked for arithmetic only, at an assumed lead of 30.
- The brief §2 decisions appear in §3–§5 and §7 without contradiction [V].
- The direction is right: one engine, and no computation in the UI.

It is still not ready to implement. The problems fall into two groups:
- **Two P1 problems.** The byte budget would very likely stop implementation partway through S2 [I, from measured history]. The primary-informativeness check cannot tell whether a cell can show a gain at all.
- **A cluster of P2 problems in the decision contract.** These would leave several required guardrails structurally unable to change. They must be settled before any forecast-arm run.

| Step | Recommendation | Condition to lift the hold |
|---|---|---|
| v2.1 (docs only) | **Proceed now** (prompt in §10) | none |
| S1 registration, in two parts (amends the order at v2:L578 and L604 [D, OD-19]) | **Hold finalization**; drafting may start | **S1a**, frozen before X1: the P1-B bound, the SD definition, the placebo control, the guardrail-class method, OD-16, OD-18, OD-20 and OD-22. **S1b**, after S2 and before any forecast-arm run: the OD-11 to OD-14 and OD-17 values, from reactive-only and tape-only runs on the real engine |
| X1 execution seam | **Hold** | Budget route and per-work-package allocation recorded (OD-1, OD-2); S1a frozen. X1 stays main-thread under its 8,192-byte stop |
| N2 implementation (S2 onward) | **Hold** | v2.1 approved; budget re-baselined, with the packer change landed if route A; S1a frozen; X1 accepted. Forecast-arm runs wait for S1b |

**The five things to fix first**

1. **Decide the package budget.**
   - The combined S2+S5 allocation of 28,672 bytes is smaller than every earlier slice that added a model, which cost +29,898 to +58,753 packed bytes [V].
   - N2 is estimated at 52.5 / 81.8 / 118.5 KB (low / likely / high) [I].
   - Recommended: a separately reviewed, offline-only removal of full-line comments in the packer (a comment is removed only when its first and last lines hold no tokens). It measured −300,476 bytes, with the byte limit and the hosted site unchanged [V][D]. (§1 P1-A, §4)
2. **Replace "headroom" with a curb-capacity bound, and classify the guardrails, before any forecast-arm run.**
   - In the TOY, reactive headroom overstates the reachable gain by 1.8–9× at b=4 and by up to about 23× at b=8.
   - Three of the eight required guardrails look structurally dead or near-dead, and two are dominated by depot-visit timing. This is [I] from TOY and ANALOG evidence.
   - Register four things: a tape-only bound, a paired-SD detectable gain, a placebo-divergence control, and the re-decisions of F2 and F5. (§1 P1-B, §6)
3. **Settle three G3 details.**
   - Integer-percent arithmetic: float `ceil(i·s)` misassigns vehicle types at 26 (percent, car) pairs [V].
   - The type/depot confound: at a 50% share, every Ojai starts west and every I-PACE starts east [V].
   - Array-order preparation: it is distance-blind, so §9.9 costs 12 km of empty driving versus 4 km [V].
   - Recommended owner re-decision: a depot-major type rule ("fix B"), integer p, and nearest-eligible preparation [P][D]. (§2 C-01 to C-04)
4. **Make the record contract buildable.**
   - Split the independent checker into runtime invariants plus test-time policy verification. As written, it needs a partial second dispatch engine [I][D].
   - Pin these: record production rules, state enums, the publication schema, one `screen()` definition, the accumulation order, and a distinct state for an unavailable required metric. (§2, §4.5)
5. **Write v2.1 fresh, with the fixture corrections.**
   - 46–55 lines of v2 lose the space before a number. For example, `b2` is a request ID in one fixture and a boarding time in another, and R6 puts berth `B1` beside boarding `b2` [V].
   - R6's boarding times cannot be produced by the §3.3 b rule [V].
   - G1 needs a third energy point [V].
   - The §9 preamble needs literal time-of-day and seam settings [V]. (§3, §10)

## 1. Blocking issues (P1)

Two findings keep P1 after verification. Both concern items that v2 carries forward from review proposals. Neither re-opens a brief §2 decision.

### P1-A. The N2 byte allocation very likely cannot hold N2 (measured history [V], estimate [I]; FEAS-1, FEAS-2; supported by SS-SCOPE and N2S-04)

**Problem.** v2:L586 carries forward the review's proposed stop budgets:
- X1 ≤ 8,192 bytes;
- combined N2 model and review additions (S2+S5) ≤ 28,672 bytes;
- a 12,000-byte unallocated floor.

Every earlier feature slice that added a model cost more than 28,672 packed bytes. The packer does not minify. The likely N2 size is larger than all remaining offline headroom.

**Evidence**

| Measurement | Value | Tag |
|---|---|---|
| Offline size at `790573e` (matches the D1 record) | 2,551,878 bytes; headroom 69,562 below 2,621,440 | [V] |
| Packed delta per historical slice (each commit packed with its own tools) | readiness +29,898; charging/resources/airport +58,753; launch +58,285; lessons/setup +44,846; Austin +32,759; D1 +8,223 | [V] |
| Closest analog, `277d8e4` (new demand, resource ownership, metrics, paired contract, view) | +58,753, i.e. 2.05× the allocation. It had no accounting records, checker, region package or setup model | [V] |
| N2 estimate by measured analogy (§4.2) | low 52.5 KB, likely 81.8 KB, high 118.5 KB; S2 alone likely ~59 KB | [I] |
| Most bytes N2 could get without a packer or limit change | 31,962 if the P2 remainder and R0 are kept; 49,370 if both are cancelled | [V arithmetic] |

The estimate may be low [I]. The one analog that was corrected (invariants.js) had double-subtracted comments; its code is about 27.4 KB, not 20.8 KB [V].

**Recommended fix.**
- Before X1, the owner records one budget route (§4.6) and a per-work-package allocation.
- Each allocation carries per-piece stop sub-budgets taken from the "likely" column.
- Re-measure once, after the first module lands.
- Recommended route: A [P][D].

**Replacement wording for v2:L586.** Replace from "Offline hard limit" to the end of that paragraph:

> Offline hard limit remains 2,621,440 bytes. Post-D1 measured offline size is 2,551,878 bytes (source `b99ab04`), leaving 69,562 bytes. Earlier model slices measured +29,898 (readiness), +32,759 (Austin regional power) and +58,753 (charging, resources and airport) packed bytes. By measured analogy N2 is estimated at 52.5 KB (low), 81.8 KB (likely) and 118.5 KB (high); S2 alone is likely about 59 KB. The review's combined S2+S5 allocation of 28,672 bytes is superseded. N2 does not start until the owner records one budget route [[OD-1]] and a per-work-package allocation with stop sub-budgets derived from measured estimates [[OD-2]]. A work package stops when it exceeds its own sub-budget; moving deep checks to test-only and cutting review scope come before any request for more bytes, and no required behavior is removed silently.

**Owner decision:** yes, OD-1 and OD-2 [D]. This replaces a review proposal (tagged [P] in review §1). It does not re-open brief §2.

### P1-B. Reactive headroom does not show whether a cell can detect a gain (TS-2)

**Problem.** v2 §10 (v2:L560, L563) judges whether the primary is informative from three things: reactive headroom (1 − completion), exact nulls and a positive control. Under v2's own rules, any preparation policy is capped by curb turnover:
- approach capacity is freed only when a car is admitted to a berth (v2:L114);
- assigned requests never abandon (v2:L113);
- a staged car still passes the curb-first check (v2:L115, L127);
- dispatch order is FIFO.

So most of the 1 − completion gap is out of reach of any preparation policy [I].

**Evidence.** All numbers below are TOY outputs (reactive only). What they imply for N2 is [I].

| TOY cell (b=4 unless noted) | 1 − completion | Bound gain (zero hub travel) | Exact paired detectable gain | Headroom ÷ bound gain |
|---|---|---|---|---|
| Overlap, patience 12 | 0.358 | 0.041 | 0.023 | 8.7 |
| Overlap, patience 60 | 0.171 | 0.061 | 0.025 | 2.8 |
| Separated, patience 12 | 0.279 | 0.082 | 0.025 | 3.4 |
| Separated, patience 60 | 0.007 | 0.007 | 0.026 | 1.0 |
| b=8, overlap, any patience | 0.283–0.387 | 0.017 | 0.021–0.024 | about 17–23 |

What else was established:
- A tape-only calculation matched the zero-travel run in 192 of 192 seed-cells [V, TOY].
- With the shipped bootstrap, a mean gain reads IMPROVED only above roughly 0.02 + 0.56–0.58·sd for the tested delta patterns [V, instrument arithmetic].
- In the TOY, the b=8 overlap cell cannot read IMPROVED at all: its largest per-seed gain, 0.019, is below the 0.02 margin.
- The magnitudes do not carry over to N2. With travel legs ×1.25, the b=4 bounds rise to 0.058–0.124 and the b=8 overlap bound to 0.024 [V, TOY sensitivity]. S1 must compute them from the frozen literals.

**Recommended fix.** Add a registered, treatment-independent capacity-bound check. Replacement wording for the right-hand cell of the v2 §10 row "Primary informativeness / positive controls":

> Before any forecast-arm run, for each registered cell and tuning seed, compute offline the tape-only curb-capacity bound B: completion with zero hub travel under the frozen tapes (events, background, publications and condition tape), the approach and berth capacities, the minimum b across profiles, patience, I, H and v2's FIFO dispatch order, with background counted complete. B is a registration calculation, cross-checked against at least one hand trace; it never enters statistics and is not a second lifecycle. A cell is informative for the primary only if mean(B − reactive completion) exceeds the registered smallest detectable gain by the frozen factor [[OD-16]]; otherwise the cell is redesigned, or given a separately registered primary, before evaluation. The smallest detectable gain uses the paired seed-delta SD of the largest registered non-treatment contrast in that cell with the frozen bootstrap options; the √2 × single-arm value is reported beside it. The positive control acts on the resource that binds in reactive diagnostics and must read IMPROVED. B is shown beside every UNCHANGED or INCONCLUSIVE result. No forecast-arm result sets a check threshold. Exact same-policy null controls remain required. A failed cell is redesigned or given a separately registered primary, never rescued by favorable-metric selection.

**Owner decision:** this is an S1 registration choice, which brief §2 left open. It is not a re-decision [D].

### Also gating, at P2 (details in §2 and §6)

**Before any forecast-arm run:**
- F2 refusal-guardrail saturation (TS-1, MX-5)
- F5 historical max wait (MX-2)
- Noise in terminal energy and unfinished visits (MX-1, MX-7)
- `rejected_actions` as a structural zero
- A placebo-divergence control
- The b=8 and isolation cells (TS-3, TS-7)
- Which SD defines the detectable gain (TS-5)
- A fleet-starvation check (TS-8)

**Before v2.1 fixtures:** the G3 confound and preparation order (SS-H1, SS-H2); R6 parameters (FXA-1); G1's third point (FB-2); v2 text integrity (D1R-1).

**Before X1 and S2:** the checker split (COH-01), the workload envelope (SS-ENV), the model-side projection (N2S-03, C-27) and display retention, which counts toward X1's peak-heap measurement (N2S-02, C-28).

**Before S5:** the copy gate, placement and verdict generator (N2S-01, N2S-04 to N2S-06).

## 2. Contract corrections (P2/P3)

The table consolidates findings; source finding IDs are in brackets. Severity is verifier-adjusted. Decision-contract items appear in §6 and review-surface items in §7; this table only points to them.

| id | v2 ref | issue | fix |
|---|---|---|---|
| C-01 (P3) | v2:L56 (G3) | Computing `s=p/100` as a float and then `ceil(i·s)` misassigns vehicle types at 26 (p, i) pairs within bounds. Example: p=28 swaps cars 25 and 26, giving a 25-car fleet 8 Ojai instead of the exact 7 [V] [FB-3, COH-09, SS-SHARE] | **DECIDED 2026-09-26 (OD-4).** N2 requires an integer `ojai_share_pct` p. Compute `ceil(i·p/100)` with the integer product formed first (0 mismatches), or `floor((i·p+99)/100)`. Fixture under the DECIDED fix B: at p=28 and V=51, integer arithmetic gives `car-49` I-PACE and `car-51` Ojai, and `car-48` I-PACE and `car-50` Ojai. Float arithmetic swaps both pairs while the Ojai total stays 15 [V, probe] |
| C-02 (note) | v2:L56 | The N2 Ojai count is `ceil(V·s)`; legacy uses `round` (V=10, p=33 gives 4 vs 3) [V] [FB-11] | Add one disclosure sentence to §3.1 |
| C-03 (P2) | v2:L56, L258, L457 | Type is confounded with depot. At s=.5 and V=40, west holds 20 Ojai and 0 I-PACE, east 0 and 20. Across integer shares, 41 of 99 give a per-depot gap above one car [V]. Pairing keeps the decision valid, but `by_vehicle_type` and any attribution to type cannot be interpreted [I] [SS-H1] | **DECIDED 2026-09-26 (OD-3): fix B**, which applies the owner rule along a depot-major ordering (exact rule in §9.2 OD-3). The total stays `ceil(V·p/100)` and F3 is unchanged. Fix B is not prefix-stable, so fixture tuples must name V. Fix A (depot-local ordinal) would also need a re-decision of brief §4 item 8, because F3 could no longer derive two types from G3. Alternatively, keep the rule and label `by_vehicle_type` as depot-confounded |
| C-04 (P2) | v2:L123, L387, L465, DL7 | Array-order preparation is a second car-selection rule that ignores distance. In §9.9 it costs 12 km of empty driving versus 4 km, depending only on the index [V]. An illustrative initial six-car fill costs 40.97 km versus 33.94 km, assuming cars start at depots [V arithmetic] [SS-H2] | **DECIDED 2026-09-26 (OD-5):** choose the nearest eligible, available, non-staged car by route km to the hub, ties to the lowest stable index. Give F3 an entering state in which `car-2` is unavailable until minute 1; the tuple stays (true,4,7) [I, hand trace]. Flip §9.9 so 4 km is expected and 12 km becomes the ruled-out array reading. Rewrite DL7, v2:L387 and L465. §9.18 packet(e) changes narrative only: `car-2` (east) stages first and arrives at 6, and `car-1` arrives at 18 rather than 16; the tuple is unchanged [I, hand trace] |
| C-05 (P3) | v2:L115–L119 | The energy-screen formula omits the max over the set, and "the screen" is never defined once for turns, flags, 5a and E. The km and kWh tolerances differ, which leaves a band where the range test fails but the per-car test passes [V] [COH-06] | Insert one definition covering `maximumRange(X)`, `rangeOK(r,X)` (+1e−8 km), `pass(r,v)` (+1e−8 kWh) and `screen(r,v,X)`. At a turn, X is the remaining available set including arrived staged cars; in 5a, X is the final A. Define `idle_feasible_vehicle`, the 5a trigger and E from it. Keep the legacy tolerances for parity |
| C-06 (note) | v2:L123 (G1) | G1 uses a kWh tolerance but the dispatch range uses km. A staged car admitted at the G1 edge can be ENERGY_INFEASIBLE for the farthest event destination [V probe] | Define G1 as `screen()` on the predicted arrival SOC, or drop the +1e−8 in G1 (new code, no parity at stake) |
| C-07 (note) | v2:L119–L123 | The preparation loop's stop and skip rules are implicit. "Skip cars already at the hub" can never trigger in N2 [I] [COH-07, SS-DEAD] | Add: "Recompute stock after each start; stop at desired stock; skip ineligible cars." Replace the hub skip with the invariant "an available non-staged car at the hub is INVALID_SIMULATION" |
| C-08 (note) | v2:L114 | The third component of the admission key is never read, because `reservation_seq` is unique [V] | Order admission by `(arrival_minute, reservation_seq)` |
| C-09 (P3) | DL9 (v2:L47), L143, L149 | A hub arrival at H and a non-hub arrival at H are treated differently, and the split falls exactly along cohorts. At the suggested defaults it has no effect: the latest non-hub arrival is minute 203–211 against H=240, and within-target cannot flip while H−I ≥ T [V, analytic]. It does matter when H−I ≤ T−1, as in F5 and §9.17 [COH-05, FC-8] | Keep DL9 [P]. Register H−I ≥ T in S1 (the defaults give 60 ≥ 10). Disclose the cohort-asymmetric terminal statuses and add a non-hub-arrival-at-H fixture (§3). A uniform "no boarding at H" rule is also valid [P], but it adds a lifecycle state and requires edits to §6.2 and §6.3 [OD-9] |
| C-10 (P3) | v2:L84, L345, L555, L570 | Travel has a time-of-day factor. The engine multiplies travel by 1.25 during clock hours 07–10 and 16–19 (`bay-operations.js:49–50,122`). The default start_hour 7 puts minutes 0–179 inside that window, and no switch exists. The §9 preamble states the intent without a mechanism [V; real-engine legs matched 73/73, 69/69, 128/128, 139/139] [FXA-3, FB-1, FC-6, FC-10] | In §3.1, add a closed N2 literal that disables both demand and travel modulation [OD-20]. In the §9 preamble, set `start_hour=0, traffic_multiplier=1, weather=clear`. Add travel ×1.25, demand ×peak_multiplier and `ojai_share_pct` 50 to the §10 inherited-values list |
| C-11 (P3) | v2:L76, L179, L188 | H derived from `duration_hours` does not round-trip for 27 integer horizons (250 becomes 251) [V] [MX-10] | Use integer `horizon_min` and `intake_min`. Reject the config if `Math.ceil(duration_hours*60)` differs from H |
| C-12 (P2) | v2:L302–L311 | Checks 2 and 4 of the checker cover refusal flags, ENERGY_INFEASIBLE versus ASSIGNED, the chosen car and preparation completeness. Together with 5a, they would need a partial second dispatch engine, which v2:L22 and L578 forbid [I] [COH-01, FEAS-7] | **DECIDED 2026-09-26 (OD-6):** split runtime checks from test-time verification as in §4.5 (this reverses v2's full validation on every arm). Results carry their check level. A browser-only run outside the Node-checked registered set never shows an accepted recommendation (v2:L584, L599). Add the refusal-free legacy-minus-staged differential (already at v2:L121) to the §7 check list [OD-6] |
| C-13 (P3) | v2:L287–L300 | Record production is underdetermined in four places: when FALLBACK_PASS is emitted; the scope of VEHICLE_TRANSITION (depot stages); how an approach slot is selected; and whether 0-km ENERGY_LEG rows exist, which changes per-kind counts and the digest [V] [COH-02, FB-10] | Add one record-production table covering emission conditions, seq order within a minute, "lowest free approach slot", and the 0-km leg rule (choose emit or omit; if emitted, all values 0). Zero-duration settlement is already pinned at v2:L109. DISPATCH_PASS is optional, because curb occupancy can be derived from ownership intervals |
| C-14 (P3) | v2:L135–L169, L291–L292 | REQUEST has a single `status` field while three partitions are required. VEHICLE_TRANSITION has no state enum. `REQUIRED_DEPOT_VISIT` is an orphan target [V] [COH-03, N2S-08] | Add explicit `lifecycle_state`, `terminal_boarding_status` and `target_category`, each verified by the checker against the recorded times. Freeze a vehicle enum with its legacy mapping. The B2 mapping at v2:L246 stays |
| C-15 (P3) | v2:L82–L99, L112, L123, L498 | Several things are unstated: the publication record schema; v1:L77's forecast validity rule, which v2 dropped despite promising at L17 to restate retained sections; the background ordinal; the mapping functions; and ID derivation. The legacy `request-${n}` counter would break "stable IDs" [V] [COH-04, FB-4] | Restate the publication row, its bounds and its validity rule; decide whether lead is global or per row. Background ordinals are 1-based in (minute, within-minute index) order over [0,I). Event destination is `floor(u·4)`. The weighted background destination follows the legacy subtract-accumulate procedure verbatim (`bay-operations.js:69–70`). IDs are pure functions of (source_kind, ordinals) |
| C-16 (P3) | v2:L233, L308 | The 16-digit preparation km and kWh values depend on accumulation order: summing per leg gives 21.65685424949238, a global per-minute accumulator gives …376. The engine and checker could disagree in the last ulp and produce a spurious INVALID_EXPERIMENT [V] [FC-4] | Pin the rule: sum over PREPARATION ENERGY_LEG records in seq order of each leg's executed amount, accumulated per minute as in `bay-operations.js:245–246`. The checker uses the same rule, and exact equality is kept. Apply the same rule to executed-distance comparisons, because F4's exact sqrt(32) is a float coincidence of four equal steps |
| C-17 (P3) | v2:L162, L256, L308 | Post-trip reachability blocks are counted in `energy_blocked_vehicle_count` but produce no record [V] [COH-10] | Add a `post_trip_block` field to the completing VEHICLE_TRANSITION and an invariant expecting 0 |
| C-18 (P2) | v2:L74, L175, L191 | `rejected_actions` is structurally zero under any charging policy other than the counterexample one (0 in 36 ANALOG runs). Without the charging extension it becomes "not modeled", which would block every comparison. No §7 record carries rejections [V] [MX-8, MX-11, metrics lane missed item] | Require the charging extension in N2 with a named policy that is not the counterexample [OD-15]. Declare `rejected_actions` a structural-zero sanity guardrail whose digested extension count the checker matches. Charging diagnostics are null ("not modeled") when the extension is omitted, never 0 |
| C-19 (P3) | v2:L175, L277, L279, L584 | An unavailable required guardrail is handled three ways. v2:L175 blocks the comparison; v2:L279 implies NO_RECOMMENDATION; the shared instrument ignores NOT_EVALUABLE and would recommend ADVANCE. `compareMetric` also treats null as 0 [V] [MX-3, MX-4, N2S-06] | Owner decision [D, OD-25]; the verifiers disagreed. Common to both readings: a missing, null or nonfinite required value blocks the comparison, shows no outcome, chart or recommendation, and never reaches the instrument; rewrite v2:L279 to match. Reading 1 (metrics verifier, v2:L584): label it a distinct "required metric unavailable" state [P, recommended]. Reading 2 (review-surface verifier, v2:L175 and the Bay adapter precedent `bay-experiment-contract.js:110`): label it INVALID_EXPERIMENT. The legacy adapter currently merges the two. A descriptive key that is null in any arm or seed is excluded and shown as "Not available" |
| C-20 (P3) | v2:L183, L197 | "Equality is within" is actually decided by IEEE rounding. N=100 with 50→48 in all 12 seeds reads REGRESSED at 0.020000000000000018 [V] [MX-9] | State the double-precision semantics and pin both tie fixtures. Do not add exact-rational arithmetic in the adapter |
| C-21 (P3) | v2:L235, L445–L451 | `desired_staging_stock_by_minute` omits the lead gate that step 6 applies. The G2 timelines assume lead ≥ 30 and H ≥ 165 [V] [FB-7] | Clarification of brief §2 R1 for owner confirmation [D, OD-26]: "visible" includes an opened preparation window (t ≥ wave − lead), as step 6 and legacy `forecastTarget` already apply. Change L235 to "min(S, sum of counts for visible publications whose preparation window is open)". The §9.8 preamble states lead=30 and H ≥ 165 |
| C-22 (P2) | v2:L76, L313, L315, L580 | Most of the declared bounds (1–120 cars, H ≤ 1440, ≤ 1,000 parties) fail the cap Rmax ≤ 500,000. At the suggested demand and H=240, the largest accepted fleet is 85. V=120 is accepted only with I ≤ 156 and no events, or I ≤ 76 with 80 parties. The 10M request-minute cap can never bind [V] [SS-ENV, FEAS missed item] | State the accepted envelope as the Rmax inequality itself: 16·Qmax + P + 4·Qmax·H + 12·V·(H+1) + 48 ≤ 500,000, or re-derive the coefficients after X1. V·(H+1) ≤ 41,666 and Qmax·H ≤ 125,000 are only necessary bounds (each term alone), not a sufficient test: V=120 and V=172 pass both at the suggested demand but fail Rmax [V, critic probe]. Worked limit: at the suggested demand and H=240, V ≤ 85. Align the §3.1 bounds with it. Name the workload for the large-fleet measurement, or measure at 85 vehicles. Drop the request-minute cap |
| C-23 (P3) | v2:L311, L313, L580 | At the worst case Rmax=369,568 with an Rmax-weighted record mix, cost is 40 MB of heap, 27 MB of canonical JSON and about 340 ms to serialize and hash. If every element were a full record: 84 MB, 92.6 MB and 1.15 s [V, synthetic] [FEAS-5] | Name incremental hashing: `sha256Stream`, plus a sorted-key variant of `jsonPieces`. Revise the admission cap to a measured bound after X1 |
| C-24 (P3) | v2:L311, L315 | The suggested default single-run export uses an estimated 70–90% of the 1 MiB cap, which holds about 4,200–5,500 keyed elements [I] [FEAS-6] | Keep the explicit failure, which is intended. Add a compact positional encoding or a separately capped full-record export, and measure it in the X1/S2 spike |
| C-25 (P3) | v2:L185–L237 | About 40 of roughly 135 new keys are aliases or duplicates [V] [SS-MET] | Cut the per-cohort lifecycle family (keep the run-level lifecycle partition), the four fraction aliases, and the `dispatch_outcome_request_min.APPROACH_FULL` alias. Keep `approach_refused_request_min` (the F2 minutes-based fallback key, also rendered) and `terminal_unused_staged_vehicles` (rendered in the §7.3 preparation line). Keep a dictionary entry for everything the UI renders (v2:L175, L177) |
| C-26 (P2) | v2:L177, L281, L563 | The sentences "No recommendation is not no effect" and "primary at its ceiling" need paired descriptives and registered headroom values that v2 never lists [V] [N2S-11] | In §6.4, list exactly these 7 paired descriptives: `cohorts.events.boarding_within_target_fraction`, `cohorts.events.completion_fraction`, `approach_refused_request_min`, `preparation_starts`, `preparation_distance_km`, `terminal_unused_staged_vehicles`, `berth_idle_usable_min`. The frozen spec carries each cell's registered pre-evaluation results; the surface prints them, never recomputes them, and labels which come from tuning seeds and which from evaluation seeds (§7.3) |
| C-27 (P2) | v2:L175, L177, L576, L584 | The timeline needs interval arithmetic that v2 assigns to no one: draining berth-minutes, the inbound-versus-queued split, and per-request queue minutes. None of these is a dictionary key [V] [N2S-03] | Add one pure model-side projection over §7 records, tested for exact equality with the §6.2 totals. Add its outputs to §6.2 under `pickup-metrics`, following the v2:L235 "single-run detail only" precedent |
| C-28 (P2) | v2:L311, L584 | After a comparison, no records remain from which to draw the state views [V] [N2S-02] | Append to v2:L311; do not replace it. The comparison keeps its replayed first-seed pair for display. Inspecting another seed re-runs it and draws only if both arms' accounting digests match the stored ones. The retained pair counts toward X1's peak-heap measurement. A one-seed, two-arm run already exists as the descriptive n=1 comparison |
| C-29 (P2) | v2:L9, L584, L586 | The treatment name uses "forecast", which `tools/check-dist.mjs:67` bans in interface copy. The only exemption covers exact literals in one other module. COPY_MODULES (`:40`) is an allow-list. The design H-6 word list (win, score, beats, cost) also applies [V] [N2S-01, FEAS-8] | Add a copy policy to §11 [OD-10]. Interface names: "Respond to requests" and "Stage from published crowd estimates". "Forecast" appears only in identifiers, versions and exported keys. Add the N2 view module to COPY_MODULES, and add a rendered-text copy test over filled templates |
| C-30 (P3) | v2:L580 | Running the Bay engine in a worker would add about 300 KB to the offline file: 13 Bay modules, 298,210 raw bytes, 176,375 of them the Bay map [V] [FEAS-4, N2S-12] | State: "N2.0 runs the cooperative main-thread runner; a Worker needs a separate packer decision." An N2-only engine that avoided the map import would cost far less [I] |
| C-31 (P3) | v2:L321–L337; brief §4 item 7 | There are six new identity literals. The pickup metrics and B2 always change together, and composing metric versions into the model string breaks the legacy convention [V] [SS-H4] | Owner re-decision of brief §4 item 7 [OD-8]. Merge the pickup keys into `bay-systems-metrics-2.0.0`, stored where legacy stores `metric_version`. Keep `event-demand`, `curb-resources`, and the accounting version and digest. If the condition tape is deferred, defer `curb-condition` rather than folding it |
| C-32 (P3) | v2:L289–L298 | Some record kinds duplicate structure: REQUEST_TRANSITION and VEHICLE_TRANSITION share one field list; ENERGY_DELIVERY re-books energy already in stage rows; DISPATCH_RUN nests flag segments; FALLBACK_PASS stores the full A and R lists every time it fires [I] [SS-REC and a missed scope item] | One TRANSITION kind. A per-vehicle reconciliation row instead of ENERGY_DELIVERY. Key runs on (outcome, idle_feasible_vehicle). FALLBACK_PASS keeps only triggering requests, E, newly blocked IDs and visit attempts [P] |
| C-33 (P3) | v2:L199, L560 | Two contingencies can only arise after reactive tuning runs, and neither has a pre-declared mechanism: failed refusal headroom, and a failed primary-informativeness or positive-control check [V] [COH-08] | Declare both paths in v2.1 (keys, normalization, decision rule, redesign procedure), so that S1 only chooses values |
| C-34 (P3) | v2:L76, L559 | An approach bound of 1–24 plus a control-only exception of 40 is two concepts [P] [SS-APPR] | Use a single fixed 1–120 bound [P] [OD-22]. The isolation cell is redesigned anyway (§6) |
| C-35 (P3) | v2:L578, L618; review S5 | v2 builds the UI before registered evaluation, while the review makes S5 depend on S4. A static page cannot log inspections, and seeds 3501–3512 are already public [V] [N2S-10] | **DECIDED 2026-09-26 (OD-19):** S5 after S4, with the S1a/S1b split. Add a DL row. If v2's order is kept, protection is procedural: do not build, test or publish runs on evaluation seeds before S4 |
| C-36 (P3) | v2:L600 | v2 says S0 verification is recorded "in the task handoff", but no committed document holds the commands or outputs [V] [D1R-6] | Add the commands and outputs to the D1 record or a dated SoT entry, then point v2.1 at that entry |
| C-37 (P2) | 46–55 lines of v2 | Separators are missing before numbers: `created97`, `approach1`, `b2`, `targetT10`, `car1` versus `car-1`. R6 puts berth `B1` and `B2` beside boarding values `b4`, `b0` and `b2` [V] [D1R-1] | Write v2.1 with separators, `name=value` parameters and backticked `car-1` IDs. Add a lint to the doc gate that exempts real identifiers (`event1`, `r1`, `h1`, `b1`, `B1`, `q40`) |
| C-38 (note) | v2:L258 | `by_vehicle_type` is described by "assigned vehicle type", but legacy filters by each vehicle's own type (`bay-operations.js:264`) [V] | Say "starting vehicle type" |
| C-39 (note) | throughout | Symbols are overloaded: A, S, E, H, K and "target" each mean several things [P] [COH-11] | Rename the capacities C_app and C_stg; rename fixture actors that collide; define "staged car" and "staging owner" once |
| C-40 (P3) | front matter | There is no implementer summary and no pending-decision table; 28 lines exceed 600 characters [P] [SS-H3] | Add §0 (a one-page implementer summary) and §0.1 (a decision table). The invariants must read "no dispatch, preparation or hub berth admission at H", not "nothing starts at H", which contradicts DL9, and "inbound + arrived staged ≤ S" |
| C-41 (note) | v2:L586 | Post-D1 headroom is not restated. The P1 presentation items deferred from D1 have no allocation: aliased routes, time-budget bar, Follow the car, merged comparison, type scale, arm colors, Home hero, catalog paths [V] [FEAS-9, D1R-9] | Restate the 69,562-byte headroom. Fund or drop the deferred items under OD-2 |
| C-42 (P2) | v2:L584 | The review surface is underspecified: placement, verdict text, the distinction from the airport wave, the request trace, and the focus contract [V] [N2S-05 to N2S-09] | See §7 |
| C-43 (P2) | v2 §6.1, §10 | The informativeness of the decision contract (primary and guardrails) [V/I] [MX-1, MX-2, MX-5 to MX-7, TS-1 to TS-8] | See §6 |
| C-44 (note) | DL4 (v2:L42), §3.1 | DL4 cites `region-package.js:41–42` for Euclidean edge lengths; the computation is at `:33`, with shortest declared paths at `:36–42`. "Stable node-ID order" for route ties could be read as declared order, but the helper compares IDs lexically (`localeCompare(…,'en')`, `:37`) [V] [FC-9] | Correct the citation. State: "Route ties settle by lexical node ID; the frozen graph has no equal-length alternative paths." |
| C-45 (P3) | v2 §6.2 | Several descriptive diagnostics saturate in the TOY cells: 100% idle-feasible refusal minutes, every abandonment preceded by a refusal, and unique refusals that do not change with patience. A reader could over-read them [V as TOY] [TS-9] | The S1 tuning report states, per cell, which diagnostics are saturated. The UI keeps the "temporal association, not causal attribution" label |
| C-46 (note) | v2 §1, §6.2 | At b=4 the TOY is limited by approach reservations, not berths, so any gain would come from approach turnover rather than berth management [V as TOY; I for N2] [TS-11] | S1 reports the binding resource per cell (berth utilization, inbound versus queued approach share, idle-feasible refusal share) from reactive tuning runs; the review surface shows it next to results |
| C-47 (note) | v2 §6.1, §6.4 | Gains for one event can offset losses for the other inside the pooled primary, and nothing guards this. Guardrail statuses carry no noise scale [V] [MX-12] | Descriptive only, no rule change: show per-event deltas behind "Descriptive changes" (§5, §7.5) and each guardrail's per-seed standard error beside its status. An event-level guardrail may be added only if registered in S1 before tuning |
| C-48 (note) | v2 §11 (X1) | Adding curb-first classification, the staged exemption, new preparation and two admission passes as conditionals inside the legacy steps would make the minute loop hard to read in one pass and legacy parity hard to argue [P] [SS-SEAM] | In X1, express the minute loop as named steps; N2 supplies its own dispatch, 5a, preparation and admission step functions, selected once per run and sharing move, settle and startVisit. One loop and one energy ledger, not a second engine |
| C-49 (P3) | v2:L584 | There is no after-run statement of what the result cannot establish [V] [N2S-14] | Add the always-visible "What this result does not show" list (§7.5), without repeating `modelHeader`'s "not interchangeable" sentence. Optional (about 0.6 KB): embed each registered cell's comparison digest so a browser re-run can report "reproduces the registered result". This needs S5 after S4 (OD-19) |
| C-50 (P3) | v2 §11 | S5 depends on D1 residuals that are not named as prerequisites [V] [N2S-15] | Name them: shared verdict generator, focus-safe busy pattern, jump buttons, exported chart helpers, the two leftover "regional" strings, and the exact-value norm (rounded inline, exact in a disclosure). N2 may add at most one catalog lesson that opens the panel without running; if it does, change the 56-lesson pin (`test/navigation.test.mjs:14`) to 57 explicitly |

## 3. Fixture audit

**Result:** every tuple reproduces under its stated setup [V]. The problems are about which wrong implementations a fixture can catch, and about settings an implementer would have to guess. "PASS" means the arithmetic is exact as written.

**§9 preamble (P3).** State these literals and seams once:
- `start_hour=0, traffic_multiplier=1, weather=clear`. No fixture minute reaches 420 (07:00), so no leg enters the ×1.25 window [V].
- "Unit-state injection with the complete entering state stated. Fleet placement and type are injected unless the fixture is labeled G3." This label problem is systemic: F5, G4 and packet(d) all put a single car at east, but G3 places `car-1` at west [V].
- "Unit-graph seam: the test harness may inject the five-node graph with every declared edge exactly 4 km. The public region validator rejects it." DL4 already declares this graph; only the mechanism is missing [V].
- A shared realization for reserve 8 and target 64: battery_kwh=80, reserve_soc_pct=10, charge_target_pct=80, and energy_kwh_per_km=0.25 on every profile that the cars in the fixture use [V].

| Fixture | Arithmetic | Verdict | Corrections (exact) |
|---|---|---|---|
| 9.1 F1 | (1,{D},1) and all counter-readings reproduce [V] | PASS; P3 realization; note on one label | Use the preamble realization. With s ∈ {0,1}, one profile override suffices. K, B and D indices are arbitrary; the result does not depend on them [V]. Relabel: "break on refusal, then legacy fallback (0,{K,B,D},3); break with end-of-pass 5a (0,{D},1)" |
| 9.1 timing counterexample | (1,{D},1) / (1,{},0) / (2,{},0) [V] | PASS | none |
| 9.2 F2 | Window tuple (1,4,2,1,0,0); fraction 2/5; the three wrong orders reproduce [V] | PASS; note | Add the tape literals: exactly x, h1, b1, h2, b2 (N=5); I=120, H=140; h1 and h2 go hub→west; b2 goes west→east. Out-of-window runs are already covered at v2:L374 |
| 9.3 F3 | (true,4,7); arrivals 20 and 26 [V, at start_hour 0 or 12] | PASS; depends on C-04 | Under the default start_hour 7 the reactive arm arrives at 28 and departs at 32; the preamble literal fixes this. If C-04 is adopted, set `car-2` unavailable until minute 1; the tuple stays (true,4,7) [I, hand trace]. Fix B keeps F3's types; fix A does not |
| 9.4 F4 | Ownership triple, refusal [1,5), 3.2 km west, sqrt(32) km east [V] | PASS; P3 | (1) The seam is a record-free "unavailable until minute 1" state (no visit, request or energy record). (2) Any b ≥ 3, for example I-PACE boarding=1 and dwell=2. (3) Assert r1 NO_AVAILABLE_VEHICLE at minute 0. (4) State that the west car's SOC is below its charge target (for example 65%/85%), or assert blocked={} and visits=0. Otherwise the legacy-fallback reading is not excluded [V]. (5) Distance equality follows the C-16 accumulation rule. Optional: assert idle-feasible refusal minutes = 4 |
| 9.5 F5 | (1,0,2,2), statuses (1,2,1,1), max 19 by A [V, with east placement] | PASS; P3 | The seam label comes from the preamble. Add approach=1 and berths=1. Optional asserts: 3 of 5 refused (A, B, C) and 2 abandoned after refusal. Do not switch to west placement at speed 60: that keeps the aggregate tuples but changes D's row and the dispatch counts |
| 9.6 R6, minute 100 | The logic reproduces (1,2,1,2,2,1), but only with b values injected [V] | **Parameters cannot be realized (P2)** | The §3.3 rule yields at most two hub b values, and R6 needs three (4, 2, 0). Replacement under the DECIDED fix B (OD-3): V=24, ojai_share_pct=20 (Ojai = `car-1`, `car-8`, `car-11`, `car-18`, `car-21`; `car-3`, `car-7`, `car-9` and `car-20` are I-PACE) [V, probe], additional dwell=0, I-PACE boarding=4, Ojai boarding=0, staging ≥ 1, q40–q42 hub→west. Entering minute 100: B1 holds `car-3` [96,100) with b=4; B2 holds `car-7` [98,102) with b=4; `car-11` has been queued since 99. Pass A at 101 admits `car-9` to B1 [101,105); at 102 it admits `car-20` to B2 [102,106). The minute-100 tuple is unchanged [V]. Write b as `b=4`, never `b4` beside `B1` |
| 9.6 R6, pass-B benefit | (20,20,20,20); without pass B the last two become 21 [V] | PASS | none |
| 9.7 G1 | 15.87764501987817 / 18.36 [V] | **Does not discriminate (P2)** | Add a third point: the same car at 18.0 kWh gives (0,0,18.0). Three wrong readings start preparation there: omitting the destination→depot return (16.44), averaging over destinations (16.78…), and substituting a hub return (17.80…) [V]. Do not claim to rule out the decoupled-maxima reading: it equals 18.36 on this graph and is conservative [V] |
| 9.8 G2 (OPEN) | Timelines reproduce at lead=30 [V] | Still OPEN pending S1; P3 | State lead=30 (any lead ≥ 30 gives the same result) and H ≥ 165. Align v2:L235 with the lead gate (C-21) |
| 9.9 G3 | First six cars match; 12 km vs 4 km [V] | PASS; P3; depends on C-03 and C-04 | Add the integer fixture from C-01. Observable: the sum of executed distance over PICKUP and PREPARATION ENERGY_LEG records in [10,24), plus the 0-km leg rule (C-13). "Busy until at least 24" requires b ≥ 2. "Identical ipace and ojai profiles". Under C-04, 4 km becomes the expected result under both indexings. Under fix B, the tuples name V |
| 9.10 G4 | (6,12,18,26) at start_hour 0; (8,12,18,28) at start_hour 7 [V] | PASS with the preamble literal; note | V=2, s=.5; `car-2` (I-PACE, boarding 4) at east wins by distance. If the condition tape is deferred, the closure must be replaced by an extra blocking request, which changes N and the fraction assertions |
| 9.11 G5 | All five u64 keys exact; (4,1,0,1) [V] | PASS; note | Add "staging=0 and no visible publication; remaining feasible cars are counted at the end of step 5". This fixture does not need berth closure |
| 9.12 G6 | Every draw exact; 680 distinct strings and 680 distinct u64 values [V] | PASS; P3 | Pin the mappings, ordinals and ID derivation (C-15). Add seed-42 background ordinal 4: origin draw .8064631570596248 → east; destination draw .6054420692380518 → central under the weighted rule (a uniform rule gives north) [V]. Note that the 680-key enumeration uses campaign sizes |
| 9.13 Staged-vehicle 5a | (true,{S,D},18,{D},{D},1,{S}); single-car variant (true,{S},18,{},{},0,{S}) [V] | PASS; note | Use the preamble realization; inject SOC S=12.5 and D=8.5; the unit graph comes through the seam |
| 9.14 Packet(a) | (1,1,0,0,0) [V] | **Does not discriminate (P3)** | "Skip, plus an unchanged line-204 fallback" gives the identical tuple. Add spare car E at east with 11.5 kWh. Expected `(unique hub refused, refusal request-min in [2,3), background assigned, blocked, visits, rejected)=(1,1,1,0,0,0)`. Unchanged line 204 gives blocked=1, visits=1. Break or examination-time fallback gives assigned=0, blocked=2, visits=2 [V]. State that no supply was available before t=2 |
| 9.15 Packet(b) | ([10,11],1,1) [V] | **Does not discriminate (P3)** | The tuple has no identities, so index-first admission gives the same result. §9.6 already rules out lexical ordering; nothing rules out index-first. Make the tuple per reservation, with labels that oppose seq: `((seq20, car-3, start 10), (seq21, car-2, start 11))` under an injected state. G3-consistent alternative: seq20=`car-4` at east, seq21=`car-3`. Declare the entering state injected (it cannot be reached otherwise) and state H |
| 9.16 Packet(c) | (15,15,4,2) [V] | PASS; P3; depends on OD-7 | State approach ≥ 2 (or injection), H, and two types whose ceil(boarding) differs by 3 (for example boarding 5 and 2, dwell 0). Moves to N2.1 if the condition tape is deferred |
| 9.17 Packet(d) | Z (20,null,CENSORED_ASSIGNED,MISSED); Y (16,20,0,BOARDED) [V] | PASS; P3 | The K bullet's visit check cannot fail when trips_between_visits=99. Set trips_between_visits=1 for K; expect 0 visits and unfinished_visits=0; dropping the t<H gate gives 1 [V]. K is reachable at 45 km/h, since hub→east takes 8 min. Add a non-hub-arrival-at-H bullet: background W→N created at 12, car at east depot, 60 km/h, arriving at 20=H, I-PACE boarding=2. Expected `(20,20,2,null,BOARDED,WITHIN,0)`; a hub request with the same times is CENSORED_ASSIGNED/MISSED (DL9, OD-9) |
| 9.18 Packet(e) | (1,3,1,21.65685424949238,5.414213562373095) [V, per-leg sum] | PASS; P3 | Pin the summation (C-16). b=2 requires boarding=2 and dwell=0. With trips_between_visits=1, `car2` also starts a visit at 26, so do not assert terminal unfinished_visits=0 |
| 9.19 R2 | Through the shipped `computeVerdict`: IMPROVED, background boarding REGRESSED, HOLD; without R2, ADVANCE_TO_NEXT_TEST [V] | PASS; P3 | Use 12 identical replications. Normative: the decision strings. Machine values at n=12: interval [0.04310344827586199, 0.04310344827586199], harm 0.16666666666666674. Treat 5/116 and 1/6 as explanatory. These values change at n=40 |

## 4. Feasibility and architecture

### 4.1 Bytes: what is measured [V]

| Quantity | Bytes |
|---|---|
| Offline file at `790573e` | 2,551,878 (limit 2,621,440; headroom 69,562) |
| Page bundle | 2,065,239: 84 modules; wrappers 40,984 plus the poster data URL 43,595 |
| Worker literal | 391,110: 23 modules, all duplicated from the page; 16,881 of it is JSON escaping |
| CSS | 94,079 |
| Hosted site code without media | 2,076,562 (site headroom 544,878; not the binding constraint) |
| Remaining planning allocations after D1 | X1 8,192 + S2+S5 28,672 + P2 remainder 12,288 + R0 5,120 = 54,272, leaving a floor of 15,290 against the 12,000 minimum |

The binding constraint is the offline file, not the hosted site [V].

### 4.2 N2 estimate by measured analogy [I]

| Piece | Analog | Low | Likely | High |
|---|---|---:|---:|---:|
| event-demand | airport-demand 4,177 + makeDemand | 5,000 | 7,500 | 11,000 |
| curb-resources + condition | resource-observations 6,993 + site-power 2,240 | 5,000 | 7,500 | 10,000 |
| lifecycle changes | earlier bay-operations additions of +5,013 and +3,211 | 4,000 | 6,500 | 9,000 |
| accounting records | depot-readiness 13,692 | 3,000 | 5,000 | 8,000 |
| independent runtime checker (full §7) | invariants.js code ≈ 27,400 | 8,000 | 13,000 | 20,000+ |
| pickup + B2 metrics and dictionary | bay-systems 8,597 | 5,000 | 8,000 | 11,000 |
| v2 adapter / strict reader | bay-experiment-contract, +13,344 when introduced | 4,000 | 6,500 | 9,000 |
| setup model | setup-codec +986 (Austin) | 1,000 | 2,000 | 3,500 |
| review UI + CSS + integration | regional-power-view, 17,512 when introduced | 14,000 | 20,000 | 28,000 |
| Vegas package / provenance | region-package 4,899 | 2,000 | 3,300 | 5,000 |
| wrappers for 7–9 new modules | measured median 292–298 each | 1,500 | 2,500 | 4,000 |
| **Total** | | **52,500** | **81,800** | **118,500** |

The review surface lane sketched the S5 UI at about 7.8 KB, reusing shared helpers. Its verifier called that optimistic against the 20,960-byte Austin panel [I].

### 4.3 Packer option (route A) [V, with corrections]

| Variant (scratch copy, not the repo) | Offline bytes | Reclaimed |
|---|---:|---:|
| Current | 2,551,878 | 0 |
| **Full-line comments only** | **2,251,402** | **300,476** |
| + blank and trailing whitespace | 2,248,531 | 303,347 |
| All comments + indentation | 2,136,498 | 415,380 |

What was checked, by two independent methods (a pack-time hook, and acorn post-processing of the packed HTML):
- identical tokens across all 107 page and worker module renders;
- the packed worker reproduces the event-log digest (10,153 events), the world digest, metrics and series;
- the page bundle initializes;
- `check-dist` reports 0 problems.

The review's proposed guard is **unsafe**. The rule "drop a line whose masked code is empty and that begins with `//`, `/*`, `*` or `*/`" fails on a block comment that starts after code on the same line. Removing its inner and closing lines leaves the comment open; the result still compiles but behaves differently [V, constructed counterexample]. Required rules:
- Remove a comment only when both its first and last lines hold no tokens.
- Add a pack-time token-equality or compile check.
- Make stripping an opt-in passed only from `buildHtml`. Then `bundle()` callers, including `test/pack.test.mjs:208`, stay byte-identical [I].
- Record that the offline file becomes a behavior-equivalent build, not a byte-faithful concatenation of the source. No current document or test requires byte fidelity [V].

This change needs its own tooling review (review §5) [D].

### 4.4 Runtime and memory

| Item | Value | Tag |
|---|---|---|
| One arm, 40 cars / 240 min, capture off, warm, Node | 4.2–11.4 ms (airport analog and Austin) | [V] |
| Austin 12-seed comparison (26 executions + bootstrap) | 434–465 ms total; longest step 28–38.6 ms; export 3,119,068 bytes | [V] |
| One arm, 120 cars / 1,440 min | 39–76 ms. Not admissible for N2 under Rmax; relevant only to X1 legacy parity | [V] |
| Suggested 208-execution campaign | about 4–7 s in Node; browser probably 1–3× that, unmeasured | [I] |
| Keyed draw | 0.94 µs, about 1 ms per arm | [V] |
| Realistic accounting elements per arm | about 2,800–3,500; about 0.74 MB canonical at 3,000 | [I] |
| Worst-case Rmax memory | see C-23 | [V synthetic] |

Implications:
- Minute-level cooperative yields are required. v2:L580 already requires them.
- Browser timing for each arm at 40 vehicles and at the named large-fleet workload (C-22) belongs in X1 acceptance.
- A Worker is out of scope (C-30).

### 4.5 Checker: runtime versus test-time split [I; owner decision OD-6]

| Check | Runtime, every arm and seed | Test-time: fixtures, differentials, Node campaign harness |
|---|---|---|
| Reconciliation, three partitions, chronology, patience expiry | yes | none |
| One outcome per waiter-minute; maximal runs; totals | yes | none |
| APPROACH_FULL iff hub and occupancy ≥ capacity at the turn (guardrail input) | yes. Occupancy is derived from ownership intervals and end reasons plus earlier hub assignments in §3.2 order; no new record is needed [I, logical derivation] | F2, R6 |
| NO_AVAILABLE_VEHICLE iff no car is available at the turn | yes, from vehicle states (DISPATCH_PASS is an optional convenience) [I] | F2 |
| ENERGY_INFEASIBLE versus ASSIGNED; the chosen car; `idle_feasible_vehicle` | engine-reported | F1, 9.14, G5; refusal-free legacy differential |
| 5a trigger and E membership | structure only: E ⊆ A, E ∩ staged = ∅, visits ⊆ E | F1 and its counterexample, 9.13, 9.14; legacy-minus-staged differential (v2:L121) |
| Preparation start is internally consistent (visible support, stock < desired, G1 energy) | yes, from PREPARATION_START fields and routes | none |
| Preparation completeness (enough starts; no eligible car skipped) | engine-reported | G1, G3, F3, 9.18 |
| Ownership, capacities, FIFO, one start per berth per minute, drain | yes | 9.15, 9.16 |
| b rule; no dispatch, preparation or hub admission at H; staged persistence | yes | F3, 9.17 |
| Energy balance, summaries, digests (C-16 accumulation) | yes | F4 capture equality |

The engine-reported items feed only descriptive metrics: idle-feasible refusal minutes, dispatch-outcome minutes, fallback counts and energy-blocked counts. So the split weakens no guardrail [I].

The runtime subset is estimated at 4–7 KB, against about 13 KB or more for the full §7 checker [I].

Two conditions if this is adopted:
- Every result carries its check level.
- Browser-only runs outside the Node-checked registered set never show an accepted recommendation.

### 4.6 The budget decision the owner must make (OD-1, OD-2)

| Route | Measured effect | Fits likely N2? | Cost and risk |
|---|---|---|---|
| **A (recommended [P])**: separately reviewed, offline-only removal of full-line comments (a comment is removed only when its first and last lines hold no tokens). Limit unchanged, `--site` unchanged | 2,551,878 → 2,251,402; headroom 69,562 → 370,038 [V] | Yes | One tooling review. The offline file loses comments and stops being byte-faithful. The per-comment guard and the pack-time check are mandatory |
| B: keep packer and limit; cut scope | 31,962 available (keeping P2 and R0) or 49,370 (cancelling both) [V] | Only if N2 lands below its low estimate after test-only deep checks and a minimal UI [I] | Loses the trace, the condition tape and most of the review UI |
| C: raise `APP_MAX_BYTES` (`media.mjs:2`) | As chosen | Yes | Reclaims nothing. Hosted visitors pay the same N2 bytes under A and C; only the offline file differs. Precedent: 2 MiB → 2.5 MiB |
| D: share modules between page and worker in the packer | Up to about 390 KB | Yes | Larger architecture change; rewrites the worker-literal tests; needed only for a Worker |

Recommended allocation under route A [P], after re-measuring once the packer change lands:

| Package | Stop budget (bytes) |
|---|---:|
| X1 (main thread) | 8,192 |
| S2 model, accounting, runtime checker, adapter | 65,536 |
| S5 review surface | 32,768 |
| P2 remainder, including or re-planning the D1-deferred P1 items (C-41) | 12,288 |
| R0 | 5,120 |
| Unallocated floor | 12,000 |
| **Total** | **135,904** (leaves about 234,134 of the 370,038) |

The review-surface lane proposed a different S5 split (8,192 now, 20,480 later, N2S-04). This synthesis chose the feasibility lane's single 32,768-byte S5 budget [P]; OD-2 decides.

## 5. Scope: what N2.0 must contain vs N2.1

The rule for each item: is it needed to answer "does preparation improve service under finite boarding capacity, and where does it displace harm", or to keep that answer valid? Tests cost no package bytes, so every fixture stays.

| Area | Item | N2.0 | N2.1 / cut | Rationale |
|---|---|---|---|---|
| Region | Vegas graph, package, provenance | Keep | | The hub's asymmetric access is the mechanism under test |
| Demand | Keyed event and background tapes, publications, reconciliation (G5, G6, R1) | Keep | | Owner decisions; the basis of pairing |
| Curb | Approach, berth and staging ownership; the b rule; two admission passes (R6) | Keep | | This is the finite-capacity mechanism |
| Curb | Condition tape (berth closure and recovery; §9.16) | Keep under route A | Defer to N2.1 under route B | Deferring re-decides brief §4 items 7 and 8 [D, OD-7]. G4 then needs an extra blocking request that changes N and its fractions; G5 needs no closure; drop the 9.14 variant |
| Policy | Curb-first classification + DISPATCH_RUN; 5a (D-F1a/b); replenished target + G1 | Keep | | Owner decisions |
| Policy | Preparation order; type rule | Change per C-03 and C-04 | | One selection rule; no confound [D] |
| Policy | Hub skip; third admission key; 10M request-minute cap | | Cut | Unreachable or cannot bind |
| Decision | Primary + 8 guardrails | Keep, with S1 structural classes (§6.3) | | Integrity gates. The F2 and F5 re-decisions may make two of them descriptive |
| Metrics | Cohorts all / background / events with W/L/M/Pn and the four statuses | Keep | | "Where is harm displaced" |
| Metrics | Per-event cohorts event_1 / event_2 | Keep computed; render only behind the "Descriptive changes" disclosure (MX-12) [P] | | Needed for the false-alarm cell, and a gain for one event can offset a loss for the other inside the pooled primary. Null-safe per C-19 |
| Metrics | Aliases and duplicates (C-25) | | Cut | Two values that must stay equal |
| Records | 9 kinds → merged per C-32 | Keep (merged) | | Needed by the checker |
| Checker | Runtime subset + test-time deep checks (§4.5) | Keep | | Keeps the guarantee without a second engine [D] |
| Identity | `event-demand`, `curb-resources`, accounting version, merged B2 metrics | Keep | `curb-condition` defers with its tape | C-31 [D] |
| Execution | X1 step iterator, main thread | Keep (separate approval) | Worker: later packer decision | C-30 |
| UI | Compact panel: question, identity, facts, cell picker, lead line, guardrail table, curb timeline, limits, arrival-versus-boarding line, downloads | Keep | | Needed to read the result (v2:L584) |
| UI | Selected-request trace | Keep under route A (about 1.2 KB [I]) | Defer under route B | v2:L584 asks for it; the budget decides [OD-23] |
| UI | N2 setup-link sharing | | Defer [P] | The envelope row is conditional (v2:L335) and `studio.js` would need a new model entry |
| Bounds | Approach 1–24 + control-only 40 exception | Fixed 1–120 [P] | | One concept (OD-22) |

**Simplicity rationale.** Three kinds of trim remove whole concepts without touching a decision-relevant guarantee:
- merging identities that always change together;
- cutting aliases;
- replacing unreachable branches with invariants.

The larger scope choices, the condition tape and the trace, are budget questions and should follow OD-1.

**Capability preserved.** Every recommendation keeps these:
- the primary and all required guardrails, with their status recorded honestly;
- accounting on every arm and seed, with a runtime checker;
- the strict v2 reader;
- capture and replay equality;
- legacy byte parity (Bay, Austin, airport, launch, setup);
- all 19 fixture groups;
- NOT_EVIDENCE, SIMULATION_ONLY and permission NONE.

## 6. Experiment design risks to settle in S1

### 6.1 TOY spike: reactive arm only (seeds 9101–9112; not N2)

The TOY is a throwaway hand model of the v2 hub rules:
- the v2 §3.1 graph at 38 km/h, with ceil-minute legs;
- 40 cars; 2 berths; approach 4; b=4;
- keyed demand through the shipped `keyed.js`, and the shipped bootstrap.

It has no energy, 5a, depot visits or charging. No forecast arm was built or run. The outputs reproduced exactly under a second run [V as TOY outputs]. Every N2 implication is [I].

| TOY observation | Values | Why it matters for N2 [I] |
|---|---|---|
| Bound gain vs detectable gain, b=4 | Overlap 0.041 / 0.043 / 0.050 / 0.061 vs 0.023–0.025 (patience 12/20/30/60). Separated 0.082 / 0.087 / 0.079 / 0.007 vs 0.025–0.027 | Only b=4 separated at patience 12–20 (about 3.3×) and overlap at patience 12–30 (about 1.8–2.1×) look informative |
| b=8 (longer boarding) | Overlap bound 0.017 at every patience (IMPROVED impossible). Separated 0.035 / 0.035 / 0.014 / 0.017 | The b=8 overlap cell is at best marginal (0.024 with ×1.25 legs) |
| Isolation cell (approach 40) | Separated completion 1.000, bound 0.000. Overlap bound 0.031 / 0.036 / 0.020 / 0.001 vs detectable 0.028 / 0.025 / 0.028 / 0.021 | Requests are assigned at creation and never abandon; they wait up to 48–62 min in the physical hub queue. Completion saturates whatever preparation does, so the cell cannot attribute a gain to the A+S cap |
| Refusal guardrail | Never-refused event requests = 4.0 (overlap) and 8.0 (separated), sd 0. That is exactly approach capacity × wave openings. Refused fraction does not change with patience. Nominal headroom 0.035 / 0.069 passes the F2 rule | The openers are unrefusable in both arms, so the guardrail cannot move. This holds only while the fleet does not bind: at fleet ≤ 12, never-refused reaches 16–23 |
| Binding resource at b=4 | Berth utilization during the wave 0.56–0.76; approach holdings pinned at 4; an idle car existed in 100% of refusal minutes | Approach turnover binds, not berths. A positive control must act on approach |
| Positive controls (reactive vs reactive) | Berths 3 and dwell 0: UNCHANGED (dwell 0 INCONCLUSIVE twice). Approach 6 and 8: IMPROVED except separated patience 60. Approach 8 at overlap patience 12/20: 0.041 / 0.043 < 0.05 | A fixed 0.05 control size may be unreachable |
| Fleet availability | No depot visits: at least 19 cars free during the wave. Crude depot-visit sensitivity: 8–17 | Starvation relative to A+S=10 is plausible on the real engine. Measure it |
| Single-arm vs paired SD | Single-arm 0.028–0.031; paired contrasts 0.001–0.014 | Using single-arm SD overstates the detectable gain by about 0.008–0.014 |

### 6.2 Analytic and ANALOG numbers

| Source | Values | Tag |
|---|---|---|
| Shipped bootstrap, 12 seeds | Smallest mean reading IMPROVED: 0.0286 / 0.0375 / 0.0462 at sd 0.0148 / 0.03 / 0.045 | [V] |
| N2 graph arithmetic, base cell | Forecast gain bounded at about 3–7 requests per seed (0.026–0.063); b=8 about 2–4 (0.017–0.034) | [I] |
| Preparation leg energy (I-PACE/Ojai) | Central 0.96/1.08, east 1.36/1.53, west or north 1.92/2.16 kWh. S=6 surplus stock: 5.76–12.96 kWh of **consumption** | [V arithmetic] |
| ANALOG placebo (cleaning 8→9 min, same demand) | unfinished_visits REGRESSED (harm 0.25), i.e. HOLD. Per-seed terminal energy +20 to +27 kWh with no change in trips | [V ANALOG] |
| ANALOG with no in-horizon visits | terminal = initial − consumed, exactly; 1.94–2.19 kWh per completed trip | [V ANALOG] |
| ANALOG charging policies | 0 rejected actions in 36 runs | [V ANALOG] |
| Max wait (proof on v2 §4) | Regime A: paired delta exactly 0, provided H − c* is at least the largest arrival wait. Regime B: set by one request per seed (a constructed 27-min shift gives harm 5.25, i.e. REGRESSED). The measure never sees curb queueing | [V logic]; which regime N2 is in: [I] |

### 6.3 Guardrail informativeness

| Required guardrail (v2 §6.1) | Structural class | Recommended S1 handling |
|---|---|---|
| All-request boarding within target (decline ≤ 0.02) | Live [I] | Keep |
| Background completion (decline ≤ 0.02) | Live only if starvation is possible [I] | Record minimum available cars during the wave against A+S. Consider a fleet-constrained cell |
| Background boarding within target (R2, decline ≤ 0.02) | Live [I]; the R2 fixture works [V] | Keep (binding) |
| `approach_refused_request_fraction` (F2, rise ≤ 0.02) | Near-dead without starvation: the unrefused requests are the wave openers, which both arms serve [I, TOY]. Harm ≤ mean reactive headroom, so it cannot read REGRESSED when headroom ≤ 0.02 [V]. Harm ≤ 0 when the unrefused requests are only wave openers and the fleet does not bind [I, TOY] | Re-decide F2 [OD-11]. Use a saturation test and strict > 0.02. If saturated, make it descriptive. The minutes-based fallback needs its own attainability check: in the TOY a faster-turnover change moved it the same way in every seed |
| `max_request_wait_min` (F5, rise ≤ 5 min) | Exactly 0 or a single-request trip-wire; blind to curb waits [V logic] | Re-decide F5: make it descriptive; keep its label and the attaining request [OD-12] |
| `unfinished_visits` (limit 0) | Dominated by noise; a placebo HOLD on the ANALOG [V] | Record the placebo false-HOLD rate. Reaffirm knowingly, or make it descriptive [OD-14] |
| `terminal_energy_kwh` (decline ≤ 5 kWh) | Dominated by depot-visit quanta, about ±20–27 kWh per seed [V ANALOG]. Sign indeterminate: visits refund consumption [I] | Decide after the placebo control [OD-13]. Reaffirm with the consumption floor stated, or make it descriptive and pre-register a normalized preparation-energy measure. **Not** "no in-horizon visits" and not an absolute consumption limit: both would near-certainly HOLD any improved primary (about 2 kWh per trip) |
| `rejected_actions` (limit 0) | Structural zero under any non-counterexample policy [V]; "not modeled" without the extension | Treat as a sanity guardrail (C-18) |

So only the first three measure the treatment's service trade-off [I]. S1 should record each guardrail's class and evidence. The UI must never present "eight guardrails within allowance" as eight independent protections.

### 6.4 Cell-level risks

| Risk | Recommended S1 handling |
|---|---|
| The b=8 longer-boarding cell in overlap timing cannot plausibly read IMPROVED | Do not register it with the completion primary. Use separated timing with patience ≤ 20 only if the bound passes, or give it its own primary |
| The isolation cell (approach = fleet) saturates completion through the no-abandonment rule | Redesign it, or give it a separately registered primary. If kept, set approach = fleet+1, or restate "zero APPROACH_FULL" as "while holdings < fleet". Disclose the regime change |
| Patience 60 saturates the separated cells | Justify patience as a rider assumption first. Use the bound only as a feasibility screen: short-list 12 or 20, and never choose the value that maximizes the bound |
| Magnitudes depend on inherited literals (legs ×1.25) | Compute every check on the frozen literals (C-10) |
| Starvation changes which regime the refusal guardrail and background harm are in | Measure minimum available cars, NO_AVAILABLE_VEHICLE and ENERGY_INFEASIBLE request-minutes, and depot-occupied cars on reactive tuning seeds |
| Same-policy null controls are byte-identical, so they cannot reveal false HOLDs | Register a reactive-versus-reactive placebo-divergence control, with the perturbation and seeds fixed in advance |

### 6.5 Decisions for S1, with recommended defaults

| ID | Decision | Recommended default |
|---|---|---|
| OD-11 | F2 refusal guardrail (re-decision) | Saturation test: reactive never-refused count equals A × openings. Strict > 0.02 on the registered aggregate. If saturated, the metric becomes descriptive. A minutes-based limit only after its own attainability check |
| OD-12 | F5 historical max age (re-decision) | Descriptive, keeping its key, label and attaining request |
| OD-13 | Terminal energy | Decide after the placebo control. Default: descriptive, plus a pre-registered normalized preparation-energy measure [P] |
| OD-14 | Unfinished visits | Reaffirm limit 0 with exposure and the placebo false-HOLD rate stated. Make it descriptive if the placebo trips it [P] |
| OD-15 | Charging extension and rejected actions | Required extension; named non-counterexample policy; structural-zero sanity guardrail |
| OD-16 | Informativeness factor, B − reactive against the detectable gain | Owner chooses the number before inspection. Reviewers propose no value; 1.5× is a suggested floor [P] |
| OD-17 | Cells and patience | Drop b=8 overlap from the primary; redesign isolation; screen patience 12 or 20; keep G2 OPEN until the tapes are frozen |
| OD-18 | Placebo-divergence control and guardrail classes | Register both before any forecast-arm run |
| OD-20 | Time of day | Disable demand and travel modulation in N2 |
| new (TS-5) | Detectable-gain SD | Paired seed-delta SD of the largest registered non-treatment contrast; report the √2 × single-arm value beside it |
| existing (v2 §10) | Seed blocks | 2501–2512 for tuning, 3501–3512 for evaluation, as v2 §10 recommends |
| new (FC-5) | Replication count for machine-value fixtures | n=12 |

### 6.6 What is allowed before evaluation

- **Allowed:**
  - tape-only bound calculations;
  - reactive-only runs on tuning seeds;
  - reactive-versus-reactive placebo and non-treatment positive controls;
  - same-policy null controls;
  - fixture and differential tests;
  - the cross-seed independence check on keyed draws.
- **Not allowed until the S1 rules are frozen:** any forecast-arm run (tuning or evaluation) that could inform thresholds, cells, patience or guardrail status. Relaxing a guardrail after a HOLD. Choosing patience to maximize a bound. Offering or preloading evaluation seeds in any UI before S4.
- **After the freeze:** forecast-arm tuning runs are logged in the append-only inspection log (v2:L567). Outcome-informed tuning needs a new version and a new seed block.

## 7. N2 experience design

### 7.1 Where it lives

| Option | Verdict |
|---|---|
| A. Closed panel in "Other experiments" only (v2:L584) | Not enough. After one run the panel starts about 5,000 px down at 1280 and about 8,900 px at 400, roughly 136 tab stops from Run [V, one live observation, not re-observed] |
| B. A new route | Defer to P3, together with the Austin and Launch aliases. It would reverse D1's "no new routes" |
| **C. A, plus jump buttons near the Fleet day question, plus setup and lesson deep links** | **Recommended [P].** Buttons, not `#fragment` links, because the hash is the router: `#curb-lab` opens the route-error page [V] |

Implementation details:
- Order the panels Austin → N2 → Launch. N2 is closed by default. The panel `id` is used only for `aria-controls` and tests.
- A `regional-curb` setup link needs a model entry in `studio.js`. Without one, `studio.js:235` routes it to "simulation" and `:248` throws [V]. The setup-codec allow-list and the "five legacy setup models" pin must change explicitly.
- An exclusive `details name` accordion is optional, because it would close an open Austin result.

### 7.2 Arm names and copy [OD-10]

- Interface names: **"Respond to requests"** (baseline) and **"Stage from published crowd estimates"** (candidate). The word "forecast" stays in identifiers, versions and exported keys only.
- Avoid the H-6 words: "cost", "wins", "score", "better option". Write "preparation distance and energy".
- Before any run, show one visible sentence: "Unlike the airport wave option above, this hub has a finite approach lane and pickup berths, and on time means boarding began within T minutes of the request, not the arrival time the airport wave scores. Results are not interchangeable." [V: airport scores arrival (`airport-demand.js:42`), uses inclusive expiry (`:35`) and has near-identical defaults (`:4`)]

### 7.3 Result-first summary templates

These come from one shared, dictionary-driven verdict generator, which Austin should also use (N2S-06). Values use the existing threshold-preserving formatter. Fractions are shown as points of a named population. Negatives use U+2212.

**Lead line (always first):**

| Result | Template |
|---|---|
| Hold (guardrail) | "Hold: {k} required guardrail(s) regressed ({labels, dictionary order}). → HOLD" |
| Hold (primary) | "Hold: completion fell beyond the {m}-point regression margin. → HOLD" |
| Advance | "Advance to the next simulation test: completion rose beyond the +{m}-point margin and all {g} required guardrails stayed within their allowances. → ADVANCE_TO_NEXT_TEST" |
| Inconclusive | "Run more experiments: the completion interval crosses a margin boundary and no required guardrail regressed. → RUN_MORE_EXPERIMENTS" |
| Unchanged | "No recommendation: completion stayed inside the ±{m}-point band. No recommendation is not no effect; the changes below still happened. → NO_RECOMMENDATION" |
| Required metric unavailable | "Required metric unavailable ({label}: {reason}). No outcome, chart or recommendation is shown." Not a verdict; its label (distinct state or INVALID_EXPERIMENT) is OD-25 (C-19) |

**Following lines:**

- **Primary:** "{B} changed completion by {±d} points (95% interval {lo} to {hi}) versus {A}, {inside the ±m band / above the +m margin / below the −m margin / crossing a margin boundary} → {OUTCOME}."
- **Ceiling.** Label the source of each value; do not overclaim (N2S-11). "On tuning seeds, {A} completed {b_t}% and the registered capacity-bound gap was {g} points against a smallest detectable gain of {d} points; this cell was registered as {informative / uninformative for the primary} before evaluation. On these evaluation seeds {A} completed {b_e}%."
- **Background harm (always shown):** "Background riders, who never use the hub: on-time boarding {fell/rose} by {d} points and completion by {d} points per seed; allowed decline up to 2.00 points each → {within allowance / HOLD}. Gains for event riders cannot offset these."
- **Refusal (in the registered mode):** "Requests turned away at least once by a full approach {rose/fell} by {d} points of all requests ({pa}% vs {pb}%); allowed rise up to 2.00 points → {status}. Being turned away is exposure, not a measured delay." In descriptive mode the ending is "(descriptive in this cell, registered before evaluation)".
- **Guardrail rows:** "{label} {fell/rose} by {h} {unit}; allowed {decline/rise} up to {L} {unit} → {status}." If the change helps: "(no harm; …)". With L=0: "allowed rise: none". Equality counts as within, subject to C-20.
- **Arrival versus boarding** (v2:L584; legacy labels kept): "Arrival-based completed-request wait (legacy measure): {x} min. On-time boarding share: {y}%." Show it beside the boarding measures; do not hide it (N2S-16 correction).
- **Preparation:** "Staging trips: {B} started {p} ({km} km, {kWh} kWh); {u} staged cars were unused at minute {H}. {A} never stages."

### 7.4 Signature visualization: the two-arm curb timeline

**Data source.** One pure projection over the §7 records and frozen tapes (C-27). After a comparison it uses the retained first-seed pair (C-28). The UI only formats and places marks.

| Row | Records | Encoding | Must equal (test) |
|---|---|---|---|
| Requests (shared) | REQUEST creation, source, event | Per-minute ticks in three labeled marks | `cohorts.C.requests` |
| Estimates (B only) | Publication tape | Bar over [published, expires); tick at wave − lead | Tape |
| Berths B1..Bk | OWNERSHIP_INTERVAL BERTH; condition tape | Solid blocks. A closed berth is a labeled grey band; a block on the band means draining. Zero-length intervals get a visible marker. OPEN_AT_H has an open end. Hatch is reserved for "not available" | `berth_occupied_min`, `berth_usable_min`, `berth_idle_usable_min` |
| Approach | OWNERSHIP_INTERVAL APPROACH split at arrival | Inbound and queued step lines, with a capacity rule at A | `approach_inbound_min`, `approach_queue_min` |
| Turned away | DISPATCH_RUN APPROACH_FULL | Count step; a darker tick where a car passed the screen | Refusal request-min; idle-feasible request-min |
| Staging | STAGING intervals, PREPARATION_START | Stock against S, desired (dashed), a ^ at each start. Arm A shows "0 all day" | `preparation_starts`, terminal staging holdings |

**Chart reuse.** Export the plot, lane, step, table and legend helpers from `src/ui/charts.js` rather than duplicating them (about 7.3 KB). Three additions are needed [V]:
- a minute-tick option: the current minimum step of 6 h gives a single tick at H=240;
- a zero-length marker: `charts.js:1118` currently skips zero-length intervals;
- text model limits: `limitsChip` throws on unknown keys.

**Readability.** Arms are distinguished by position and labels, never by color alone. Each chart has a Table toggle that gives exact values and an accessible alternative.

### 7.5 Disclosure

- **Default, before a run:**
  - the summary label phrased as the question, and the heading;
  - a short identity line: name · geography · package ID · seed [P, OD-21];
  - the provenance line (NOT_EVIDENCE, permission NONE);
  - the airport-wave sentence;
  - "Resource observations are not modeled in this setup.";
  - the facts line (V, k, A, S, I, H, T; only the policy differs);
  - the cell picker (registered cells only), the actions, and the status.
- **Default, after a run:** result heading, lead line, primary, background, refusal and ceiling lines, the 8-row guardrail table, the timeline, the trace, and a limits list. The limits list must not repeat `modelHeader`'s "not interchangeable" sentence. It covers: approach is a reservation cap, not road spillback; walking is a declared delay; one fictional hub; no abandonment after assignment; resources and standby energy are not modeled.
- **Behind details:** exact version components, graph, tapes, inherited literals, clock definitions (I, H, T, exclusive expiry, the [t, t+1) minute), up to 7 descriptive deltas, exact values, the per-seed table, status breakdowns and the run-level lifecycle partition, per-event (event 1 / event 2) deltas (MX-12), reconciliation, terminal holdings, starts per estimate, and downloads with their sizes.
- **Not in N2.0:** a 3D map, Play, replay or animation; all-vehicle tables; `by_place`, `by_vehicle_type`, charging and readiness tables; any winner, score or "closest guardrail" ranking; per-request cross-arm deltas; pooled wait histograms.

### 7.6 Request trace

The default request is a **pre-registered illustrative rule**, for example the first event request of the cell [P, OD-24]. It is not the historical-max attaining request. That request is usually the earliest abandoned or unassigned one, and its value is a horizon penalty rather than a wait: in F5, A attains 19 against an abandonment wait of 3 [V]. Keep the max-age request as a quick pick, labeled as an age convention.

The same request identity is shown in both arms, side by side.

| Stage | Source | When null |
|---|---|---|
| Event ends / walk | Release minute; declared walk (never drawn as an interval) | "not applicable (background request)" |
| Requested | `created_minute` | never null |
| Waited | This request's DISPATCH_RUN rows, including minutes when a car passed the screen | "none" |
| Assigned | Minute, vehicle and type; "was staged" when the staging interval ended EXCHANGED_TO_APPROACH | "not reached: abandoned at {u}" or "not reached by {H}" |
| Arrived / queued / boarding / departed / completed | REQUEST times and projection durations (dictionary entries per C-27) | "car still driving at {H}", "no curb at this pickup", "still queued at {H}", "trip under way at {H}" |
| Outcome | Explicit `terminal_boarding_status` and `target_category` (C-14) | Never blank. Censored ages are labeled as bounds |

### 7.7 Focus, status and states (N2S-09; do not copy Austin)

The live Austin panel has three problems [mechanism V in code; live values observed once in a hidden tab, not re-observed]:
- focus drops to BODY after Compare, because the pressed button is disabled;
- `role=status` updates every 15–40 ms;
- the verdict sits 3,623 px below Run at 400 px width.

The N2 contract:
- Never disable the focused control; use `aria-disabled` with a busy guard. Cancel stays enabled while running.
- `role=status` announces phase changes only (started, checking replay, computing interval, recorded, canceled). Arm counts go in a non-live progress element.
- On completion, focus moves to the result heading. The browser's minimal scroll is allowed; no smooth scroll.
- On cancel, focus returns to the control that started the run, and the previous result stays, marked with its settings.
- On an invalid result or a digest mismatch, focus moves to the alert.
- No Play, autoplay, animation or motion control.

Acceptance happens in real browsers at 1280 and 400 (v2:L590). Fake-DOM tests are unit guards only.

### 7.8 Low-fi wireframes

**1280, after "Compare 12 paired seeds"**

```
Fleet day (top)
# How many trips can your fleet serve today?
[Run fleet day >]  status
Other experiments on this page: (Austin power stress) (Event curb lab) (Launch rehearsal)
   ^ secondary buttons: open that panel and focus its heading; never run anything
...
## Other experiments on this page
> Regional stress lab: Austin power and readiness                       (closed)
v Event curb lab: does staging cars before a crowd help at a busy pickup curb?
  ### Does staging cars before an event help when pickup berths are limited,
      and whose service pays for it?                     (focus target)
  Event curb lab . fictional Las Vegas-inspired schematic . {package} . seed {s}
  [> model components]  Simulation only . NOT_EVIDENCE . permission NONE [Share]
  Unlike the airport wave option above, this hub has a finite approach lane ...
  Resource observations are not modeled in this setup.
  {V} cars . {k} berths . approach {A} . staging {S} . I {I} . H {H} . T {T}
  Cell [registered cell v]  [Run one seed, both policies] [Compare 12] [Cancel]
  +--------------------------------------------------------------------------+
  | #### Result . 12 paired seeds . VALID                    (focus target)  |
  | {lead line}  {primary}  {background}  {refusal}  {ceiling if registered} |
  | Guardrail                         Change    Allowed          Status      |
  |  (8 rows, dictionary order; direction and unit in every row)             |
  | {arrival-based wait (legacy)} beside {on-time boarding share}           |
  | [> Descriptive changes] [> Exact values] [> Per-seed table]              |
  +--------------------------------------------------------------------------+
  | Curb timeline . seed {s} . digest matches the comparison      [Table]   |
  | min 0     60     120     180|I    240|H                                  |
  | Requests   . . :||||| :|||||  . .                                        |
  | Estimates (B only)   [----)  [----)                                      |
  | -- A: Respond to requests --                                             |
  | B1 ..[##][#]|..   B2 ..[#][=closed=#=]..   Approach cap / queued / inbound|
  | Turned away ::|||::        Staging  0 all day                            |
  | -- B: Stage from published crowd estimates --                            |
  | B1 / B2 / Approach as above   Staging cap; desired - - ; stock __/''\__ ^ |
  +--------------------------------------------------------------------------+
  | Follow one request [{id} . event 1 . registered example  v]             |
  | Stage | A: Respond to requests | B: Stage from estimates                 |
  +--------------------------------------------------------------------------+
  What this result does not show (always visible, 4-5 bullets)
  [> Inputs, estimates, versions and clocks]  [Download records . {size}]
> Launch rehearsal: configure a region and test commissioning           (closed)
```

**400**

```
# How many trips can your fleet serve today?
[Run fleet day >]  status
Other experiments on this page:
(Austin power stress) (Event curb lab) (Launch rehearsal)
...
v Event curb lab: does staging cars before a crowd help ...
  ### Does staging cars before an event help when berths are limited?
  identity (short) [> components]   provenance   [Share]
  airport-wave sentence; resources sentence; facts line (wraps)
  Cell [ v ]
  [Run one seed, both policies]
  [Compare 12 paired seeds] [Cancel]     <- Run within ~one viewport of the heading
  #### Result . VALID
  lead / primary / background / refusal
  Guardrail            Change   Status
    allowed ... (under each label)       x 8
  Curb timeline (arms stacked on one minute axis; 48 px label gutter) [Table]
  Follow one request: stages as rows; long reasons wrap under their row
  What this result does not show (list)
  [> details]  [Download . size]
> Launch rehearsal (closed)
```

## 8. D1: what shipped, audit notes and follow-ups

### 8.1 What shipped [V]

| Item | Value |
|---|---|
| Release | Production `dd4bfa44` at fleetlab.pages.dev; source `b99ab04`; records `790573e`; rollback target `f08b6b6f` |
| Offline bytes | 2,543,655 → 2,551,878 (+8,223, within the 11,264 D1 limit, 3,041 spare); source subtotal +8,026 |
| Static package | 89 files / 3,181,153 bytes → 90 / 3,189,179 |
| Digests | Offline `219203088d…cdfc8`; static index `97ec391c…0cbe` (equals the live `/`); manifest `b613c8da…6104`; readback receipt `9a48697f…9980` (89/89 match) |
| Tests | 1,792 → 1,827 (1,826 pass, 0 fail, 1 TODO). 36 new names, 1 renamed |
| Final serial PERF gate | Re-run on a scratch archive of HEAD: 1,827 / 1,826 / 1 TODO, with a per-test outcome set identical to the recorded log |
| Protected paths | No change under `src/model`, `src/instrument`, `src/core` or `src/runtime` |
| Pushes | Both refs at `790573e`; the website branch fast-forwarded from `b1c12b6` |
| Privacy | Diff scan has zero hits; 7 benign "token" lines; no home paths |

### 8.2 Audit notes (verifier-adjusted)

| id | Sev | Note |
|---|---|---|
| D1R-1 | P2 | The missing-separator defect in v2 (C-37). v2.1 fixes it as a new file, so v2 and its historical hash citations stay untouched |
| D1R-2 | P3 | Record L100, "No deployment claim is made…", contradicts the receipt at L141. Other points are cosmetic: privacy dispositions are split across three places, and there are missing spaces in the record, SoT, CODEX_HANDOFF and the deployment doc. Recording the push outcome belongs in the *next* docs commit, because a commit cannot record its own push |
| D1R-3 | note | The final serial suite started about 2 min 20 s before the 20-byte Street focus fix landed. The re-run above shows this had no effect. Process fix: bind every gate log to a tree identity, and re-run after the last source edit |
| D1R-4 | P3 | Untested: the four-area header's version rule (before a run, after a frozen experiment, stale); Fleet day's version before a run; the primary-action count in states other than post-run; exact share-focus equality (only containment is tested); the non-affiliation line |
| D1R-5 | P3 | Leftover relabels: `depot-scene.js:106` ("Regional experiment model"), `operations-lab.js:169` ("regional A/B workbench") and `:216` ("regional experiments"). The Austin "Regional stress lab" label predates D1 and is used by the hosted-check runbook, so it is not a leftover |
| D1R-6 | P3 | Same as C-36 |
| D1R-7, D1R-8 | note | The extra non-PERF run was 1,812 tests on a tree still under edit. The `check-dist.mjs` COPY_MODULES addition was required by the brief but is not listed in the record |
| D1R-9, D1R-10 | note | Plan N2 from 69,562 bytes of headroom. The motion control is not reachable from Fleet day (disclosed) |
| missed | note | The record's test-rewrite log does not name the operations-lab test that was renamed |

### 8.3 Follow-ups (none is N2 work)

1. **Docs-only record cleanup.** Items: D1R-2 (the L100 sentence, one privacy table, the push outcome, spaces), D1R-7/D1R-8 disclosures, the renamed test, the D1R-3 disclosure, and the S0 commands and outputs (C-36).
2. **Presentation slice.** Funded from the P2 remainder, before S5 or inside its budget:
   - the D1R-4 tests;
   - the D1R-5 relabels;
   - the shared verdict generator, fixing Austin's allowance direction. Live: "Terminal energy rose by 3.94 kWh; allowed 5" [V live], where a rise is a benefit (`bay-experiment-contract.js:68`);
   - Austin's lead line, which is dropped on a guardrail HOLD;
   - raw 17-digit floats shown inline;
   - verdict placement;
   - the focus-safe busy pattern;
   - the exported chart helpers;
   - motion-control reachability.
3. **Allocation.** The D1-deferred P1 items need an allocation under OD-2 (C-41).

## 9. Recommended sequence and owner decisions

### 9.1 Sequence with gates

| # | Step | Gate to pass before the next step |
|---|---|---|
| 0 | Owner reads this feedback and records OD-1 to OD-10 (at least the budget route, G3 items, checker split and copy policy) | Decisions written into the §10 prompt's launching message, or left as PENDING |
| 1 | **v2.1, docs only** (§10) | v1 and v2 hashes unchanged; separator lint clean; changed fixtures re-derived by an uncommitted probe; owner review of v2.1 |
| 2 | If route A: separate packer tooling brief and review | Per-comment guard with the adversarial case; pack-time token or compile check; worker parity; `check-dist` 0; allocation table re-baselined once |
| 3 | **S1a: register rules and mechanisms** (docs): tape-only bound, detectable-gain SD, guardrail classes, placebo control, contingency paths (C-33), time-of-day literal, patience screen, seed blocks, G2 tapes | Owner approval. Frozen before any forecast-arm run |
| 4 | **X1: execution seam** (separate approval; main thread) | Legacy byte parity; deterministic cancellation; retained heap measured, including the display pair; within 8,192 bytes |
| 5 | **S2: model, accounting, runtime checker, adapter**, fixtures first | All §9 fixtures; runtime checker; differentials; legacy parity; within the S2 sub-budgets |
| 6 | **S1b: reactive-only and tape-only checks** on the real engine | Every cell classified informative or not; guardrail classes and placebo false-HOLD rate recorded; OD-11 to OD-17 finalized; all before any forecast-arm run |
| 7 | **S4: registered evaluation** (Node campaign harness, full checks) | Every registered cell reported without selection; inspection log |
| 8 | **S5: review surface** (after S4, recommended; OD-19) | Copy gate with the new module listed; rendered-text copy test; real-browser focus and status at 1280 and 400; within budget |

### 9.2 Owner decisions

| ID | Decision | Recommended default | Needed before | Source |
|---|---|---|---|---|
| OD-1 | Package budget route A / B / C / D | **DECIDED 2026-09-26 (owner): A** — reviewed offline-only removal of full-line comments (per-comment rule), −300,476 bytes; delivered as a separate tooling task (§13, Task 2) | X1 | FEAS-1/2/3 |
| OD-2 | Per-WP allocation and stop sub-budgets, including the D1-deferred items | §4.6 table [P] | X1 | FEAS-3, FEAS-9 |
| OD-3 | G3 type rule (**re-decision** of brief §2 G3) | **DECIDED 2026-09-26 (owner): fix B: order cars depot-major (all west-depot cars by index, then all east-depot cars by index) and give each its rank j = 1..V; car at rank j is an Ojai iff ceil(j*p/100) - ceil((j-1)*p/100) = 1, computed in integer arithmetic; placement stays car i at depots[(i-1) mod 2]; total Ojai = ceil(V*p/100); not prefix-stable, so fixture tuples name V; at V=40, p=50 the first six are (`car-1`,Ojai,west), (`car-2`,Ojai,east), (`car-3`,I-PACE,west), (`car-4`,I-PACE,east), (`car-5`,Ojai,west), (`car-6`,Ojai,east); F3 (V=2, p=50) keeps `car-1` Ojai and `car-2` I-PACE** | v2.1 fixtures | SS-H1 |
| OD-4 | G3 arithmetic (clarification) | **DECIDED 2026-09-26 (owner):** integer `ojai_share_pct` p (0–100); every share computation uses integer arithmetic (integer product first) | v2.1 | FB-3, COH-09 |
| OD-5 | G3 preparation order (**re-decision**) | **DECIDED 2026-09-26 (owner):** nearest eligible, available, non-staged car by route km to the hub, ties to the lowest stable index; F3 entering state `car-2` unavailable until minute 1 | Any tuning seed | SS-H2 |
| OD-6 | Checker split (reverses v2's every-arm full validation) | **DECIDED 2026-09-26 (owner):** runtime invariants on every arm and seed + test-time and Node-campaign policy checks per §4.5; results carry their check level | S2 | COH-01, FEAS-7 |
| OD-7 | Condition tape in N2.0 (brief §4 items 7 and 8 if deferred) | Keep under route A; defer under B | v2.1 | SS-SCOPE |
| OD-8 | Identity list (brief §4 item 7) | Merge pickup metrics into B2 metrics; keep the accounting identity | v2.1 | SS-H4 |
| OD-9 | Arrival at H (DL9) | Keep DL9, register H−I ≥ T, add the fixture | v2.1 | COH-05, FC-8 |
| OD-10 | Interface copy for the arms | "Respond to requests" / "Stage from published crowd estimates" | S5 (text in v2.1) | N2S-01 |
| OD-11 | F2 refusal guardrail (**re-decision**) | §6.5 | Any forecast-arm run | TS-1, MX-5, TS-10 |
| OD-12 | F5 max age (**re-decision**) | Descriptive | Any forecast-arm run | MX-2 |
| OD-13 | Terminal energy | Decide after the placebo; default descriptive + normalized measure [P] | Any forecast-arm run | MX-1 |
| OD-14 | Unfinished visits | Reaffirm with the placebo rate stated, or descriptive | Any forecast-arm run | MX-7 |
| OD-15 | Charging extension; rejected actions | Required; named policy; sanity guardrail | v2.1 | MX-8, MX-11 |
| OD-16 | Informativeness factor | Owner's number; 1.5× suggested floor [P] | S1a | TS-2 |
| OD-17 | Cells and patience | Drop b=8 overlap; redesign isolation; patience 12 or 20 by screen | S1b | TS-3/4/7 |
| OD-18 | Placebo control; guardrail classes | Register both | S1a | metrics lane missed item |
| OD-19 | Ordering: S1 split and S5 placement | **DECIDED 2026-09-26 (owner):** S1a (rules and mechanisms) frozen before X1; S1b (values from reactive-only and tape-only runs) after S2 and before any forecast-arm run; S5 after S4 | X1 plan | N2S-10 |
| OD-20 | Time of day | Disabled for demand and travel | v2.1 | C-10 |
| OD-21 | D1 B.2.1/B.2.2 presentation re-decision (short identity + disclosure; H3 panels) | Yes, low priority [P] | S5 | N2S-13 |
| OD-22 | Approach bound | Fixed 1–120 [P] | S1a | SS-APPR |
| OD-23 | Trace and setup sharing in N2.0 | Trace per OD-1; sharing deferred [P] | S5 | SS-SCOPE |
| OD-24 | Default traced request | Pre-registered illustrative rule | S5 | N2S-08 |
| OD-25 | "Required metric unavailable": a distinct state, or INVALID_EXPERIMENT (C-19; the verifiers disagreed) | Distinct state [P]; both readings block the comparison | v2.1 | MX-3, MX-4, review-surface verifier |
| OD-26 | R1 clarification: "visible" includes an opened preparation window (C-21) | Confirm | v2.1 | FB-7 |
| (existing) | G2 cell tapes | Still OPEN pending S1 | S1a | v2 §9.8 |

## 10. Copy-ready Codex prompt for v2.1

Paste everything inside the block, and state in the launching message which ODs you have DECIDED (the rest stay PENDING) and whether Codex may commit. The prompt is self-contained. This document (docs/FLEETLAB_N2_V2_DESIGN_FEEDBACK.md) holds the background for every correction it lists.

```text
TASK: Produce the FleetLab N2 design v2.1 (documentation only).

You are working in the Hermes-fleetlab checkout of the Hermes repository (website source root playground/fleetlab/), on the currently checked-out branch. Create exactly one new design document:
  docs/plans/<YYYY-MM-DD>-fleetlab-n2-design-v2.1.md   (use the date you run)
It restates and corrects docs/plans/2026-09-26-fleetlab-n2-design-v2.md ("v2") using the review's recommended corrections listed below. The owner status of each recommendation is recorded only by the OD placeholders in §0.1 and by the message that launches this task. No implementation.

HARD RULES
1. Docs only. Do not create or edit anything under playground/, tests, tools, packages, CI or Python paths. No N2 code, no packer change, no experiment registration, no deploy, no push.
2. v1 and v2 are immutable. Before and after, run:
     shasum -a 256 docs/plans/2026-09-25-fleetlab-n2-design.md    -> c574b8df41d0378363e18f75452f09e15a2cf62581e8fb01f6f365229d7e25bf
     shasum -a 256 docs/plans/2026-09-26-fleetlab-n2-design-v2.md -> da7b80690711116dc7a11874db4199468f2581ab6c5e87d4251698ead48d383d
   Never edit a historical hash citation in any other document.
3. The owner brief's §2 decisions (docs/plans/2026-09-26-fleetlab-d1-and-n2-s0-codex-brief.md: D-F1a, D-F1b, F2, G3, G5, R2, R1, R4, R5, R6, F5, G6) and v2's current text stay operative, EXCEPT where an OD is DECIDED. The owner DECIDED on 2026-09-26: OD-1, OD-3, OD-4, OD-5, OD-6 and OD-19. Apply these as contract (class e below). Any further OD becomes DECIDED only if the launching message says so.
4. Route every correction into exactly one class, and record the class in Appendix A:
   (a) TEXT: consistency, precision and completeness corrections that change no decision. Apply directly.
   (b) BRIEF-§2 RE-DECISION OR CLARIFICATION still PENDING (OD-11, OD-12, OD-26): keep the brief §2 text as the operative contract; add a boxed "PENDING OWNER RE-DECISION OD-n" block with the exact replacement text and every fixture delta it causes.
   (c) REVERSAL OF v2 OR OF BRIEF §4 still PENDING (OD-7, OD-8, OD-25, and C-32's record merge): keep v2's text operative; add a boxed "PENDING OWNER DECISION OD-n" block the same way.
   (d) S1-DEFERRED (OD-13, OD-14, OD-15's policy name, OD-16, OD-17, OD-18, OD-20, OD-22, G2, and the P1-B bound, SD and placebo mechanisms): record only as rows in v2.1 §10 "Open for S1" carrying the new recommendation. Never write them into §3-§7 as contract.
   Every OD appears exactly once in §0.1 as:
     [[OWNER DECISION OD-<n> | question | options | recommended default | class | status: PENDING or DECIDED <date>]]
   (e) DECIDED (OD-1, OD-3, OD-4, OD-5, OD-6, OD-19): apply as contract; the §0.1 entry shows "status: DECIDED 2026-09-26"; §0.2 records which brief §2 or v2 text each one replaces; re-derive every affected fixture.
   If the launching message marks another OD DECIDED, treat it the same way. OD-2, OD-9, OD-10, OD-21, OD-23 and OD-24 are neutral placeholders: write the surrounding text neutrally, keeping v2's reading where v2 has one.
5. The repository is public: no personal data, emails, tokens, account IDs or absolute home paths.
6. Text integrity (C-37): always a space or "=" between a word and a number; parameters as name=value (approach=1, staging=1, b=2, T=10, H=40); vehicle IDs in source form in backticks (`car-1`); request and berth IDs in backticks (`r1`, `B1`). Never use one symbol for two things within a fixture. Restate every retained section so v2.1 stands alone.
7. Any new or changed fixture value must be re-derived by an uncommitted script using the v2 rules and shipped helpers (src/core/keyed.js, src/instrument/*). Write it under a NEW name, for example artifacts/fleetlab-n2-s0/fixture-values-v2.1.mjs and .json. Do not modify, regenerate or delete the existing files in artifacts/fleetlab-n2-s0/ (fixture-values.mjs, fixture-values.json, fixture-values-recheck.json): v2's quoted values depend on them. Quote exact values. Never commit the script.
8. Git discipline: stay on the current branch; no checkout, switch, reset, stash, clean, rebase, merge or push. Never stage, edit or delete FleetLab-ChatGPT-review-and-next-phase.md. Commit only if the launching message says so. If it does, stage only by explicit path (the v2.1 file and, if authorized, HERMES_SOURCE_OF_TRUTH.md) after reviewing `git status --short` and `git diff --cached --stat`.

READ FIRST
v2; v1 (docs/plans/2026-09-25-fleetlab-n2-design.md); the owner brief (§2, §4); docs/FLEETLAB_PACKET_REVIEW_2026-09-26.md; docs/FLEETLAB_D1_RELEASE_2026-09-26.md. Read-only source for citations: playground/fleetlab/src/model/{bay-operations,bay-experiment-contract,bay-systems,airport-demand,region-package,operations,vehicle-profiles}.js, src/instrument/*.js, src/core/keyed.js, src/ui/{charts,regional-power-view,studio,model-identity}.js, tools/{check-dist,pack}.mjs.

REQUIRED STRUCTURE
- First line: "DRAFT v2.1 for owner review; design only; no N2 implementation authorized".
- §0 Implementer summary, at most one page. It covers:
  - the question and the treatment;
  - the units to build and the surfaces left untouched;
  - an 8-row minute-loop table (step, rule in at most 15 words, decision ID, fixture ID);
  - the invariants: inbound + queued <= approach capacity; inbound + arrived staged <= staging capacity; occupied <= installed berths; one holding per car; one boarding start per berth per minute; no dispatch, preparation or hub berth admission at H;
  - the selection rules, record kinds and identities;
  - the workload envelope and budgets;
  - a fixture index, the stop conditions and a section map.
- §0.1 Owner decisions (all placeholders).
- §0.2 Changes from v2 (v2 lines -> v2.1 section -> correction ID -> class -> reason).
- §1-§12 as in v2, corrected.
- Appendix A: a conformance table mapping every correction ID below to its class, v2.1 section, and APPLIED / PENDING OD-n / NOT APPLIED status, with file:line evidence.

OWNER DECISIONS TO PLACEHOLDER (recommended defaults in brackets; class in parentheses)
OD-1 budget route: DECIDED 2026-09-26 = route A, a separately reviewed, offline-only removal of full-line comments in tools/pack.mjs. A comment is removed only when its first and last lines hold no tokens, with a pack-time token-equality check; measured -300,476 bytes; limit and --site unchanged. The packer change itself is a separate tooling task, not part of v2.1 (e).
OD-2 per-work-package stop budgets [X1 8,192; S2 65,536; S5 32,768; P2 remainder 12,288, including the D1-deferred items; R0 5,120; floor 12,000; re-measure after route A lands. Alternative S5 split: 8,192 + 20,480] (neutral).
OD-3 G3 type rule: DECIDED 2026-09-26 = fix B. Order cars depot-major (all west-depot cars by index, then all east-depot cars by index) and give each a rank j = 1..V. The car at rank j is an Ojai iff ceil(j*p/100) - ceil((j-1)*p/100) = 1, in integer arithmetic. Placement stays car i at depots[(i-1) mod 2]; the Ojai total is ceil(V*p/100). The rule is not prefix-stable, so fixture tuples name V. At V=40, p=50 the first six are `car-1` Ojai west, `car-2` Ojai east, `car-3` I-PACE west, `car-4` I-PACE east, `car-5` Ojai west, `car-6` Ojai east. F3 (V=2, p=50) keeps `car-1` Ojai and `car-2` I-PACE (e).
OD-4 G3 integer arithmetic: DECIDED 2026-09-26 = integer ojai_share_pct p (0-100); every share computation forms the integer product first (e).
OD-5 preparation order: DECIDED 2026-09-26 = the nearest eligible, available, non-staged car by route km to the hub; ties to the lowest stable index (e).
OD-6 checker split: DECIDED 2026-09-26 = the table under C-12 (e).
OD-7 condition tape in N2.0 [keep under route A; defer under route B, which re-decides brief §4 items 7 and 8] (c).
OD-8 identities [merge the pickup metrics into bay-systems-metrics-2.0.0; keep event-demand, curb-resources and the accounting version] (c).
OD-9 arrival at H [keep DL9; S1 registers H-I >= T] (neutral).
OD-10 interface arm names ["Respond to requests" / "Stage from published crowd estimates"] (neutral).
OD-11 F2 refusal guardrail [saturation test: the reactive never-refused count equals approach capacity x wave openings. Strict > 0.02 on the registered aggregate; descriptive if saturated; a minutes-based limit only after its own attainability check] (b).
OD-12 F5 historical max age [descriptive; keep its key, label and attaining request] (b).
OD-13 terminal energy [decide after the placebo control; default descriptive, plus a pre-registered normalized preparation-energy measure] (d).
OD-14 unfinished visits [reaffirm limit 0 with the placebo false-HOLD rate stated, or make it descriptive] (d).
OD-15 charging extension and rejected_actions [extension required, with a named non-counterexample policy; rejected_actions becomes a structural-zero sanity guardrail] (d for the policy name).
OD-16 informativeness factor [the owner's number, chosen before inspection; 1.5 suggested floor] (d).
OD-17 cells and patience [drop the b=8 overlap cell from the completion primary; redesign the isolation cell; screen patience 12 or 20] (d).
OD-18 placebo-divergence control and guardrail classes [register both before any forecast-arm run] (d).
OD-19 ordering: DECIDED 2026-09-26 = S1a before X1; S1b after S2 and before any forecast-arm run; S5 after S4 (e).
OD-20 time of day [disabled for demand and travel] (d).
OD-21 short identity line for the N2 panel [yes, low priority] (neutral).
OD-22 approach bound [a single fixed 1-120; drop the control-only exception] (d).
OD-23 request trace and N2 setup-link sharing in N2.0 [trace per OD-1; sharing deferred] (neutral).
OD-24 default traced request [a pre-registered illustrative rule, e.g. the first event request of the cell] (neutral).
OD-25 required metric unavailable [a distinct state, not INVALID_EXPERIMENT; both readings block the comparison] (c).
OD-26 R1 clarification ["visible" includes an opened preparation window, t >= wave - lead] (b).
G2 stays OPEN pending S1.

CORRECTIONS (class in parentheses; apply per rule 4)

Mechanism and lifecycle
- C-01 (e, OD-4) integer G3 arithmetic. Fixture under the DECIDED fix B: at p=28 and V=51, integer arithmetic gives `car-49` I-PACE and `car-51` Ojai (west ranks 25, 26), and `car-48` I-PACE and `car-50` Ojai (east ranks 50, 51). A float ceil(j*0.28) swaps both pairs, while the Ojai total stays 15 either way, so a count check alone cannot catch it. Re-derive with the probe.
- C-02 (a) disclose that the N2 Ojai count is ceil(V*p/100) while legacy uses round.
- C-03 (e, OD-3) type/depot confound: under the brief §2 rule, at p=50 every Ojai starts west and every I-PACE east. Apply fix B as contract (OD-3 above) and re-derive §9.9, R6 and C-01 under it, naming V; add a per-depot balance assertion (V=40, p=50: 10 Ojai at each depot).
- C-04 (e, OD-5) nearest-eligible preparation, applied as contract, with these fixture deltas:
  - F3 entering state: `car-2` unavailable until minute 1; expected (true,4,7).
  - §9.9 flipped: 4 km expected, 12 km becomes the ruled-out array reading.
  - DL7 and the v2 sentences that call array order essential.
  - §9.18 narrative: `car-2` stages first and arrives at 6; `car-1` arrives at 18 rather than 16; the tuple is unchanged.
- C-05 (a) one screen() definition:
  - maximumRange(X) is the max over X; rangeOK(r,X) uses +1e-8 km; pass(r,v) uses +1e-8 kWh; screen(r,v,X) combines them.
  - At a turn, X is the remaining available cars, including arrived staged cars. In 5a, X is the final A.
  - idle_feasible_vehicle, the 5a trigger and E are all defined from screen(). Legacy tolerances are kept.
- C-06 (a) G1 is defined as screen() on the predicted arrival SOC.
- C-07 (a) preparation loop: recompute stock after each start; stop at desired stock; skip ineligible cars. Replace the unreachable hub skip with the invariant "an available non-staged car at the hub is INVALID_SIMULATION".
- C-08 (a) admission order is (arrival_minute, reservation_seq).
- C-09 (neutral, OD-9) keep DL9; disclose the cohort-asymmetric terminal statuses; add the non-hub-arrival-at-H fixture (see packet(d) under Fixtures).
- C-10 (a for fixtures; d for the literal, OD-20) the engine multiplies travel by 1.25 in clock hours 07-10 and 16-19 (bay-operations.js:49-50,122), and the default start_hour 7 puts minutes 0-179 inside that window. Add travel x1.25, demand peak_multiplier and ojai_share_pct 50 to the §10 inherited-values list.
- C-11 (a) use integer horizon_min and intake_min; reject a config whose duration_hours does not round-trip (27 integer horizons fail today).

Records, checker, metrics
- C-12 (e, OD-6) checker split, applied as contract per this table:
    | Check | Runtime, every arm and seed | Test-time: fixtures, differentials, Node campaign harness |
    |---|---|---|
    | Reconciliation, three partitions, chronology, patience expiry | yes | none |
    | One outcome per waiter-minute; maximal runs; totals | yes | none |
    | APPROACH_FULL iff hub and occupancy ≥ capacity at the turn (guardrail input) | yes. Occupancy is derived from ownership intervals and end reasons plus earlier hub assignments in §3.2 order; no new record is needed [I, logical derivation] | F2, R6 |
    | NO_AVAILABLE_VEHICLE iff no car is available at the turn | yes, from vehicle states (DISPATCH_PASS is an optional convenience) [I] | F2 |
    | ENERGY_INFEASIBLE versus ASSIGNED; the chosen car; `idle_feasible_vehicle` | engine-reported | F1, 9.14, G5; refusal-free legacy differential |
    | 5a trigger and E membership | structure only: E ⊆ A, E ∩ staged = ∅, visits ⊆ E | F1 and its counterexample, 9.13, 9.14; legacy-minus-staged differential (v2:L121) |
    | Preparation start is internally consistent (visible support, stock < desired, G1 energy) | yes, from PREPARATION_START fields and routes | none |
    | Preparation completeness (enough starts; no eligible car skipped) | engine-reported | G1, G3, F3, 9.18 |
    | Ownership, capacities, FIFO, one start per berth per minute, drain | yes | 9.15, 9.16 |
    | b rule; no dispatch, preparation or hub admission at H; staged persistence | yes | F3, 9.17 |
    | Energy balance, summaries, digests (C-16 accumulation) | yes | F4 capture equality |
  Conditions: every result carries its check level; browser-only runs outside the Node-checked registered set never show an accepted recommendation; add the refusal-free legacy-minus-staged differential (v2:L121) to the check list.
- C-13 (a) a record-production table: emission conditions; seq order within a minute; lowest free approach slot; one 0-km ENERGY_LEG rule (emit or omit; if emitted, every value is 0).
- C-14 (a) explicit lifecycle_state, terminal_boarding_status and target_category fields, verified by the checker; a frozen vehicle-state enum with its legacy mapping; remove the orphan REQUIRED_DEPOT_VISIT target.
- C-15 (a) restate:
  - the publication row, its bounds and v1:L77's validity rule; say whether lead is global or per row;
  - background ordinals, 1-based in (minute, within-minute index) order over [0,I);
  - event destination floor(u*4);
  - the weighted background destination, as the legacy subtract-accumulate procedure verbatim (bay-operations.js:69-70);
  - IDs as pure functions of (source_kind, ordinals).
- C-16 (a) canonical accumulation for the engine, checker and fixtures: sum each PREPARATION ENERGY_LEG's executed amount in seq order, accumulated per minute as in bay-operations.js:245-246. Keep exact equality. Use the same rule for executed distance.
- C-17 (a) a post_trip_block field on the completing transition, with a zero invariant.
- C-18 (d, OD-15) rejected_actions is structurally zero under any charging policy except the counterexample one. Charging diagnostics are null ("not modeled") when the extension is omitted, never 0.
- C-19 (c, OD-25) a missing, null or nonfinite required value blocks the comparison and never reaches the instrument; rewrite v2:L279 to match. Its label (a distinct state vs INVALID_EXPERIMENT) is the PENDING decision.
- C-20 (a) state IEEE-double tie semantics and pin two tie fixtures (N=100 with 50 -> 48 in all 12 seeds reads REGRESSED at 0.020000000000000018).
- C-21 (b, OD-26) add the lead gate to desired_staging_stock_by_minute; §9.8 states lead=30 and H >= 165.
- C-22 (a) state the accepted workload envelope as the Rmax inequality itself: 16*Qmax + P + 4*Qmax*H + 12*V*(H+1) + 48 <= 500,000 (or re-derive the coefficients after X1).
  - V*(H+1) <= 41,666 and Qmax*H <= 125,000 are only necessary bounds.
  - Worked limit: at the suggested demand and H=240, V <= 85.
  - Align the §3.1 bounds with the envelope; drop the 10M request-minute cap; name the large-fleet measurement workload.
- C-23 (a) name incremental hashing (sha256Stream plus a sorted-key jsonPieces); revise the admission cap to a measured bound after X1.
- C-24 (a) reconcile the 1 MiB single-run export cap: either a compact positional encoding or a separately capped full-record export, measured in the X1/S2 spike.
- C-25 (a) cut the per-cohort lifecycle family (keep the run-level partition), the four fraction aliases and the dispatch_outcome_request_min.APPROACH_FULL alias. Keep approach_refused_request_min and terminal_unused_staged_vehicles. Keep a dictionary entry for everything rendered.
- C-26 (a) §6.4 lists exactly these 7 paired descriptives: cohorts.events.boarding_within_target_fraction, cohorts.events.completion_fraction, approach_refused_request_min, preparation_starts, preparation_distance_km, terminal_unused_staged_vehicles, berth_idle_usable_min. The frozen spec carries each cell's registered pre-evaluation results; the surface prints them and never recomputes them.
- C-27 (a) one pure model-side projection over the §7 records, tested for exact equality with the §6.2 totals. Add its outputs to §6.2 as single-run detail: draining berth-minutes, per-request queue minutes, and per-minute inbound and queued series.
- C-28 (a) append to v2's retention paragraph; do not replace it:
  - the comparison keeps its replayed first-seed pair for display;
  - inspecting another seed re-runs it and draws only if both arms' accounting digests match;
  - the retained pair counts toward X1's peak-heap measurement.
- C-31 (c, OD-8) identities.
- C-32 (c) merged record kinds: one TRANSITION kind; a per-vehicle reconciliation row instead of ENERGY_DELIVERY; runs keyed on (outcome, idle_feasible_vehicle); FALLBACK_PASS keeps only triggering requests, E, newly blocked IDs and visit attempts.
- C-33 (a) declare the contingency paths for failed refusal headroom and for a failed informativeness or positive-control check (keys, normalization, decision rule, redesign procedure), so that S1 only chooses values.
- C-38 (a) by_vehicle_type is by starting vehicle type.
- C-39 (a) rename overloaded symbols: the approach and staging capacities become C_app and C_stg, and colliding fixture actors are renamed. Define "staged car" and "staging owner" once.
- C-44 (a) DL4 citation: region-package.js:33 (edge lengths) and :36-42 (paths). Route ties settle by lexical node ID (:37).
- C-45 (d) S1 declares the saturated diagnostics per cell.
- C-46 (d) S1 reports the binding resource per cell.
- C-47 (a) per-event deltas go behind "Descriptive changes", and each guardrail's per-seed standard error sits beside its status. An event-level guardrail is added only if registered before tuning.

Budget, architecture, UI
- C-29 (a for the ban and COPY_MODULES; neutral for names, OD-10) copy policy:
  - "forecast" is banned in interface copy (tools/check-dist.mjs:67) and appears only in identifiers, versions and exported keys;
  - add the N2 view module to COPY_MODULES (check-dist.mjs:40) and add a rendered-text copy test;
  - avoid win, score, beats and cost.
- C-30 (a) N2.0 runs the cooperative main-thread runner; a Worker needs a separate packer decision.
- C-34 (d, OD-22) approach bound.
- C-35 (e, OD-19) ordering, applied as contract, with a DL row for the S1a/S1b split and for S5 after S4.
- C-36 (a) point the S0 verification at a committed record (the D1 record or a dated source-of-truth entry).
- C-40 (a) §0 and §0.1 as required above.
- C-41 (a) replace v2:L586 from "Offline hard limit" to the end of that paragraph with:
    > Offline hard limit remains 2,621,440 bytes. Post-D1 measured offline size is 2,551,878 bytes (source `b99ab04`), leaving 69,562 bytes. Earlier model slices measured +29,898 (readiness), +32,759 (Austin regional power) and +58,753 (charging, resources and airport) packed bytes. By measured analogy N2 is estimated at 52.5 KB (low), 81.8 KB (likely) and 118.5 KB (high); S2 alone is likely about 59 KB. The review's combined S2+S5 allocation of 28,672 bytes is superseded. N2 does not start until the owner records one budget route [[OD-1]] and a per-work-package allocation with stop sub-budgets derived from measured estimates [[OD-2]]. A work package stops when it exceeds its own sub-budget; moving deep checks to test-only and cutting review scope come before any request for more bytes, and no required behavior is removed silently.
- C-42 (a, with OD-10/21/23/24 placeholders) review surface:
  - a closed panel between Austin and Launch, plus jump buttons near the Fleet day question (buttons, not #fragment links, because the hash is the router);
  - a regional-curb setup model registered in studio.js and setup-codec, with the legacy five-model pins changed explicitly;
  - one shared, dictionary-driven verdict generator with direction-aware allowances and an always-present lead line;
  - a visible sentence distinguishing the airport wave;
  - the request trace with a pre-registered default request;
  - a focus, status and cancel contract: never disable the focused control; role=status announces phase changes only;
  - arrival-based averages shown with their legacy labels, beside the boarding measures.
- C-48 (a) X1 expresses the minute loop as named step functions; N2 supplies its own dispatch, 5a, preparation and admission steps, selected once per run.
- C-49 (a) an always-visible "What this result does not show" list after the timeline, not repeating modelHeader's sentence. Optional: a registered-digest match, which depends on OD-19.
- C-50 (a) name S5's presentation prerequisites. N2 may add at most one catalog lesson; if it does, the 56-lesson pin (test/navigation.test.mjs:14) changes to 57 explicitly.

Decision contract (§6, §10; class d unless stated)
P1-B: replace the right-hand cell of the v2 §10 row "Primary informativeness / positive controls" with:
    > Before any forecast-arm run, for each registered cell and tuning seed, compute offline the tape-only curb-capacity bound B: completion with zero hub travel under the frozen tapes (events, background, publications and condition tape), the approach and berth capacities, the minimum b across profiles, patience, I, H and v2's FIFO dispatch order, with background counted complete. B is a registration calculation, cross-checked against at least one hand trace; it never enters statistics and is not a second lifecycle. A cell is informative for the primary only if mean(B − reactive completion) exceeds the registered smallest detectable gain by the frozen factor [[OD-16]]; otherwise the cell is redesigned, or given a separately registered primary, before evaluation. The smallest detectable gain uses the paired seed-delta SD of the largest registered non-treatment contrast in that cell with the frozen bootstrap options; the √2 × single-arm value is reported beside it. The positive control acts on the resource that binds in reactive diagnostics and must read IMPROVED. B is shown beside every UNCHANGED or INCONCLUSIVE result. No forecast-arm result sets a check threshold. Exact same-policy null controls remain required. A failed cell is redesigned or given a separately registered primary, never rescued by favorable-metric selection.
Also add to §10 "Open for S1":
- guardrail structural classes, recorded before any forecast-arm run (OD-18);
- a reactive-versus-reactive placebo-divergence control (OD-18);
- starvation measurements: minimum available cars, NO_AVAILABLE_VEHICLE and ENERGY_INFEASIBLE request-minutes, and depot-occupied cars;
- OD-11 to OD-14 (OD-11 and OD-12 as class-b PENDING boxes);
- cells per OD-17; H-I >= T (OD-9);
- the list of what is allowed before evaluation: tape-only bounds; reactive-only tuning runs; reactive-versus-reactive placebo and non-treatment positive controls; same-policy nulls; fixture and differential tests; the cross-seed independence check. No forecast-arm run until the S1 rules are frozen.

Fixtures (§9; class a unless stated)
Preamble:
- start_hour=0, traffic_multiplier=1, weather=clear;
- unit-state injection with the complete entering state; placement and type are injected unless the fixture is labeled G3;
- the unit-graph seam mechanism (test harness only; the public region validator rejects it);
- a shared realization: battery_kwh=80, reserve_soc_pct=10, charge_target_pct=80, energy_kwh_per_km=0.25.

Per fixture:
- F1: use that realization. Relabel the counter-readings "break on refusal, then legacy fallback (0,{K,B,D},3)" and "break with end-of-pass 5a (0,{D},1)".
- F2: tape literals x, h1, b1, h2, b2 (N=5); I=120; H=140; h1 and h2 go hub->west; b2 goes west->east.
- F3: per the C-04 PENDING box.
- F4:
  - a record-free "unavailable until minute 1" seam;
  - b >= 3 (e.g. I-PACE boarding=1, dwell=2);
  - assert r1 NO_AVAILABLE_VEHICLE at minute 0;
  - west SOC below its charge target, or assert blocked={} and visits=0.
- F5: approach=1, berths=1. Optional: 3 of 5 refused and 2 abandoned after refusal.
- R6 minute 100, re-parameterized under the DECIDED fix B (the earlier V=22, p=10 version breaks under fix B: `car-11` becomes an I-PACE and `car-20` an Ojai).
  - Parameters: V=24, ojai_share_pct=20 (fix B Ojai = `car-1`, `car-8`, `car-11`, `car-18`, `car-21`; `car-3`, `car-7`, `car-9` and `car-20` are I-PACE), additional dwell=0, I-PACE boarding=4, Ojai boarding=0, staging >= 1, q40-q42 hub->west.
  - Entering state: `car-3` holds B1 [96,100) with b=4; `car-7` holds B2 [98,102) with b=4; `car-11` has been queued since 99.
  - Pass A at 101 admits `car-9` to B1 [101,105); at 102 it admits `car-20` to B2 [102,106).
  - The minute-100 tuple (1,2,1,2,2,1) is unchanged.
- G1: add a third point, the same car at 18.0 kWh -> (0,0,18.0). Name the three readings it rejects: omitted destination->depot return (16.44), destination average (16.78...), hub-return substitution (17.80...). Do not claim to reject the decoupled-maxima reading (it equals 18.36 here).
- G2: lead=30 and H >= 165; still OPEN.
- G3: add the integer fixture (C-01). Observable = the sum of executed distance over PICKUP and PREPARATION ENERGY_LEG records in [10,24), plus the 0-km leg rule. b >= 2; identical profiles. Under the DECIDED OD-5, 4 km is the expected result under both indexings and 12 km is the ruled-out array reading; restate the first-six tuples under fix B with V named.
- G4: V=2, s=0.5, `car-2` I-PACE boarding=4 at east.
- G5: staging=0 and no visible publication; remaining feasible cars are counted at the end of step 5.
- G6: pinned mappings, plus seed-42 background ordinal 4 (origin east; destination central under the weighted rule, north under a uniform rule).
- 9.13: literal config; injected SOC S=12.5 and D=8.5; unit graph through the seam.
- Packet(a): add spare car E at east with 11.5 kWh.
  - Expected (unique hub refused, refusal request-min in [2,3), background assigned, blocked, visits, rejected) = (1,1,1,0,0,0).
  - An unchanged line 204 gives blocked=1, visits=1. A break or an examination-time fallback gives assigned=0, blocked=2, visits=2.
  - No supply is available before t=2.
- Packet(b): a per-reservation tuple with vehicle labels opposing reservation order, under a declared injected state; state H.
- Packet(c): approach >= 2 or injection; H; boarding 5 and 2 with dwell=0. Moves to N2.1 if OD-7 defers the condition tape.
- Packet(d):
  - trips_between_visits=1 for K; expect 0 visits (1 without the t<H gate).
  - Add a non-hub-arrival-at-H bullet: background W->N created at 12, car at the east depot, 60 km/h, arriving at 20=H, I-PACE boarding=2 -> (20,20,2,null,BOARDED,WITHIN,0). A hub request with the same times is CENSORED_ASSIGNED/MISSED.
- Packet(e): canonical summation (C-16); do not assert terminal unfinished_visits=0; narrative per C-04 if OD-5 is decided.
- R2: n=12; the decision strings are normative. Machine values: interval [0.04310344827586199, 0.04310344827586199], harm 0.16666666666666674.

SOURCE OF TRUTH
If the launching message authorizes records, add one dated entry to HERMES_SOURCE_OF_TRUTH.md §7.5 naming v2.1 and its SHA-256. Update in place; add no other status document.

VERIFY BEFORE REPORTING
- Both shasum checks are unchanged, and the original artifacts/fleetlab-n2-s0/ files are unchanged (compare their SHA-256 before and after).
- Separator lint, both checks reviewed:
    grep -nE '\b(at|created|until|limit|speed|boarding|approach|staging|dwell|published|wave|expiry|expires|count|lead|arrival|arrives|departs|with|has|needs|reserve|battery|target|release|final|to|versus|allowance|size|all|through|every|default)[0-9]' <v2.1 file>   -> must return nothing
    grep -nE '\b([bHITSAV][0-9]+|car[0-9]+|target[A-Z][0-9]+)\b' <v2.1 file>   -> review every hit outside backticks. Allowed identifiers: event1, event2, r1, r2, h1, h2, b1 and b2 as request IDs in backticks, B1, B2, q40, q41, q42.
- git diff --check is clean; the privacy scan (emails, home paths, token-like strings) is clean.
- All 19 fixture groups are present with exact tuples; every OD placeholder is in §0.1 with its class; Appendix A covers every correction ID above (C-01 to C-50, P1-B and the fixtures).
- git status shows only v2.1, the optional source-of-truth edit and pre-existing untracked files.

REPORT
- The v2.1 path, SHA-256 and line count.
- Corrections by class, each APPLIED / PENDING / NOT APPLIED, with evidence.
- Probe commands and their exact outputs.
- Confirmation that v1, v2 and the original S0 probe files are unchanged and that nothing under playground/ changed.
```

## 11. Teaching clarity: UX evaluation and the three-part frame

**Status, 2026-09-26.** This is a read-only teaching-clarity review the owner asked for. The owner's problem: it is hard to tell what each simulation or lesson is trying to teach. The owner wants every simulation and every lesson to say three things clearly:

1. **What & why**: the fleet-operations question, and why an operator cares.
2. **How we simulate**: the mechanics in plain words, what changes, what stays the same, and what is synthetic or out of scope.
3. **Learning & ops takeaway**: what the reader should learn from what this model actually produces, and what a fleet-management or ops-optimization team would test next in its own operation.

**What was reviewed:**
- Two live walkthroughs of https://fleetlab.pages.dev/ at 1024 and 1280 px. A second agent moved the shared browser tab partway through, so both lanes redid the affected runs in private tabs; nothing below comes from the disturbed tab.
- A content-architecture and byte lane, with its own verifier.
- Nine per-simulation articulation lanes, each re-run by an independent verifier: Fleet day core, depot work, depot experiments, Austin and launch, Street lab, four-area Learn and experiments, casebook OPS-01 to OPS-10, casebook OPS-11 to OPS-20, framing surfaces, and planned N2.

This section uses every finding as its verifier left it: corrections applied, refuted claims dropped (listed in 11.8), unresolved items marked. The checkout `codex/fleetlab-d1-result-first @ 790573e` was not changed, and probes ran only in `teaching-review/`. Source paths are relative to `playground/fleetlab/`.

**Honesty frame.** Every number here is output of FleetLab's synthetic, uncalibrated teaching models: NOT_EVIDENCE, simulation-only, deployment permission NONE, no affiliation with any operator or vehicle maker. An "ops takeaway" is something an ops team would test or check in its own operation. It is never advice proven by this model.

**Tags:** [V] verified by a run, a pinned test or a source read, and confirmed by a verifier. [I] inference. [P] proposal. [D] needs an owner decision.

**The short version for Codex:**
1. The teaching content mostly exists, but it is hidden, in the wrong slot, or never shown. Fleet day's collapsed "Learning notes" already follow a what / test / hold fixed / read / why / next pattern. The 20 casebook lessons exist only in `test/ops-cases.pins.json`. The catalog "Learn" row is not a learning on 38 of 56 cards [V].
2. Build one shared **TeachingFrame** with exactly three parts, fed by one page-only data module, `src/ui/teaching-frames.js`. Render it on every catalog card, on every surface header before a run, and on lesson deep-link arrival. After a run, show a **"What this run shows"** line generated from recorded result fields only [P].
3. Pre-run text never states a direction or a verdict. Directions appear only in (a) the line generated from the reader's own run, or (b) a casebook reading that shows only after a run whose frozen label matches the pins (OD-T1) [P].
4. Ship it as presentation-only slice **T1** (11.6), after the decided route A packer change, with a 60 KiB stop budget. It makes no model edits, adds no lessons and keeps the 56 lesson ids [P].
5. The lane files in `teaching-review/` and the Appendix B LEARN lines contain directional "learn" strings with numbers. Do not paste them into static fields. 11.7 says how to split each one, 11.6 gives the copy precedence between §11, §12 and Appendix B, and 11.8 lists claims that verification refuted [V].

### 11.1 What a first-time viewer experiences today

Each row answers three questions: can a first-time viewer tell the What & why, the How, and the takeaway after a run? Quotes are under 20 words. All rows are [V] from the live walkthroughs, confirmed by fake-DOM mounts and source reads.

| Surface | What & why | How we simulate | Takeaway after a run |
|---|---|---|---|
| **Overview** `#/overview` | Partly. The hero is a slogan: "Every great ride starts with a ready fleet." The three real questions sit about 2.4 screens down (y about 1,831 at 1024 px). | Fragments only: "Real geography, simulated operations". The depot explainer names the regional model, but its call to action opens Fleet day, a different model. | None. The cards ask "Would two more bays actually help?" and never answer or link to the lesson that does. |
| **Learning catalog** `#/catalog` | The question, yes. The why, never: "Start with a question. Know what to change, what to watch and what the result cannot tell you." | Change and Watch list knobs, not the test. 31 of 56 cards print engine ids, such as "One declared change: parameter:SUP-1.SF. 40 → 52." Six cards say "1 guardrails". | Not a learning on 38 of 56 cards. 20 OPS cards show the situation, 6 Street cards show an instruction, and 12 cards share two generic sentences. |
| **Fleet day** default | What, yes: "How many trips can your fleet serve today?" Why, only inside collapsed Learning notes (block 11 of 12, y about 6,303 of 6,847). | No mechanics sentence on the first screen. Line 2 is a version string. Mechanics are spread over four collapsed sections. | None. "95 completed · 176 unserved · 4 waiting · 9 in progress = 284 requests" is never read for the viewer. A setup named "A regular service day" leaves 62% of requests unserved without comment, so it reads as a broken simulator. |
| **Fleet day comparisons** (capacity, vehicle mix, staffing, paired policy) | Partly | Partly | Numbers without a sentence. Capacity: "No tested depot count met the 95% end-of-day completion target." Staffing: "Descriptive only; no confidence interval, winner or recommendation." yet 3,208 of 3,208 queued minutes lacked a worker. Paired: raw "UNCHANGED" then "NO_RECOMMENDATION" under a 24-row table. |
| **Lesson deep links** (`cleaning`, `weather-day`, `staffing-readiness`, `region-launch`, `street-lombard`, `OPS-07`) | Lost on arrival. Only the tab title changes, the h1 stays generic, and the select reads "Custom or shared setup". OPS-07's hero still says it "compares four and six cleaning bays at SF-1". | The lesson's settings are applied silently. | 12 of 18 Fleet day lessons show the generic guide "Where is vehicle time being lost before the next rider?" Previous results stay on screen marked "(stale: previous settings)". |
| **Austin power panel** | Good question, no operator stake: "What happens when charging power falls during the shift?" | The port outage and observation delay that apply in every condition are disclosed only after a run. The intro is jargon: "Compare existing capped redistribution with deadline/aged priority…" | "Austin shift recorded. Inspect power, required work and complete request populations." After a run, the overall recommendation appears only in collapsed JSON; the comparison's guardrail line ends "→ HOLD" (test-pinned, `regional-power-d1.test.mjs:40-47`). Unrounded floats appear, such as 436.13622410777884. The panel sits collapsed about 4,069 to 4,175 px down, depending on width. |
| **Launch rehearsal panel** | The site's best framing: "How much service is lost when planned charging capacity is commissioned late?" plus a visible "Why it matters". | Visible Test and Hold fixed rows, but config shown as raw values. | Leads with the one metric that did not move. Region B, seed 42: "changed within-target pickups by 0", while completed trips fell 34 to 29. |
| **Street lab** | Partly: "One blocked street. A citywide ripple." The operator stake appears only at the bottom. | Hidden in three collapsed sections. "Five-second replay" reads as a video length. | "No universal winner is computed." The demo button runs one rule and does not compare. "Largest road queue, all links" is actually a network total. The AV panel prints a literal "null". |
| **Four-area workbench** `#/experiments` (UC-08a) | Question, but no stake: "Test a depot capacity decision." | A form with engine ids ("parameter:DEP-3.SF-1", "wait.p90_s") and "Teaching-model axis: FleetLab cannot run this" on the site's own default. | Gates end at "UNCHANGED" then "NO_RECOMMENDATION". SF-1's own bay-wait change, the real lesson, is never shown. |
| **Casebook case** (OPS-01, OPS-07) | A good situation, but 722 px and 288 words sit above "1 QUESTION". The header still describes the 4 vs 6 bay example. | A "What stands for what" table in codes (DEP-3.EB-1, POL-3). Watch lines run 63 to 122 words of panel instructions. | The verdict matches the pins, but the pinned lesson is never shown. The only plain sentence is "a guardrail was harmed; hold". |
| **Four-area workspace and Learn** `#/regional` | No question: "Follow the fleet through a day." This page is not in the nav. | Short notes such as "Charging: not modelled (cars never run low)". | "33 min in every replication" with no reading. 7 of 11 Learn moments end "Run it and see." |
| **Guided walkthrough** | The situation comes last. The opener "One day. Four ways to understand it." names no question, and OPS-01's situation arrives in chapter 4. | The best How on the site: one rule per beat. | The only trade-off sentence on the site ("What it trades…"). It ends with a list of product-design refusals, not an ops next step. The disabled Next button has about 1.0:1 label contrast. |
| **Product approach** | The strongest: "Start with the operator. Work back to the model." | A clear method. | The loop is not closed. It links to UC-08a, which shows no depot number. |
| **N2 event curb lab** (planned, not built) | The draft question is abstract and uses "forecast", which is banned on the page. | The pre-run design is a list of symbols (V, k, A, S, I, H, T). | Risk: a completion-only primary can hide a timeliness change. The shipped airport sister lesson moved on-time pickups from 34% to 50% while completion read UNCHANGED and the result was HOLD (model output, seeds 1001 to 1012). |

**Numbers that sum up the experience [V]:**
- **Words before the first Run control:**
  - Overview: 43 (before its call to action)
  - Fleet day: 64 to 67
  - Street lab: 62 before the demo button, about 392 before "Run street scenario"
  - Four-area workbench: 222 before "Run window", 355 before "Freeze and run"
  - Walkthrough: about 156 before "Prepare"
  - Austin: about 218
  - Launch: about 449, plus a required Validate click
- **Two run buttons with different names:** Street lab and the workbench each have two, and the workbench pair does different things. "Run window" replays the baseline day, while "Freeze and run" runs the A/B test.
- **Lessons shown on the site:** 0 of the 20 pinned casebook lessons. 0 of 56 catalog cards state a why.
- **After-run takeaways:** Only the Austin comparison and the launch lead line state what moved, and on the Region B template the launch line leads with the measure that did not move (on the default Peninsula template both measures move); the walkthrough adds the only trade-off sentence ("What it trades"). The trade-off sentence renders only in the Present readout, which only runs OPS-01. The Experiment verdict card (`src/ui/experiment.js:645`, used at `:1443`) has no trade-off section.

**Defects found on the way (presentation only; fixed in T1.6):**
- Literal "null" in the Street AV panel (`src/ui/street-lab.js:116`).
- The weather chip reads "Clear" while the select says Rain before a run (`src/ui/operations-lab.js:117`).
- "Largest road queue, all links" labels a network total (`street-lab.js:137`).
- The completed-trip wait label hides that it includes the pickup drive (`operations-lab.js:272`).
- The walkthrough's disabled Next label has about 1.0:1 contrast.
- Unrounded floats appear in the Austin and paired tables.
- The verdict card's limits list says "Travel variation is 0 in this preset", which is false for every OPS case (`src/ui/labels.js:1084` via `experiment.js:579`).

### 11.2 Root causes

Only causes with evidence are listed. Each names what the frame (11.3) fixes.

- **R1. Model-first labels and naming.** One model has seven names:
  - "Four-area workbench" (`src/ui/studio.js:128`)
  - "Four-area workspace" (`src/ui/routes.js:9`)
  - "Four-area experiments" (`src/ui/simulation-catalog.js:54`)
  - "four-area teaching model" (`studio.js:63`)
  - "Open regional example" (`simulation-catalog.js:72`)
  - "WORKSPACE / REGIONAL OPERATIONS" (`studio.js:197`)
  - "Regional experiment model" (`src/ui/depot-scene.js:106`)

  "FleetLab" means both the site and an outside harness ("Teaching-model axis: FleetLab cannot run this", `labels.js:32`). Fleet day hosts three different contracts (bay operations, the Austin composite, launch rehearsal) under one "Fleet day" chip. The walkthrough is organized by discipline ("Operations", "Analytics", "Simulation", "Product sense"), not by the question [V]. *Fix:* frames lead with the question; one model badge with one sentence each (11.4); canonical names (OD-T5).
- **R2. Five-field cards list controls and outputs instead of purpose.** Cards render question / Change / Watch / Learn / Limits (`simulation-catalog.js:69-71`). No field holds the why. "Held fixed" appears on no card. Whether the result is one replay or a 20-seed paired test is never shown. Four-area Change rows print engine units, such as `parameter:POL-3. 88200 → 93600` for 00:30 to 02:00 [V]. *Fix:* three parts plus an evidence chip; plain change text from the existing `differenceText` (`experiment.js:261`).
- **R3. The Learn slot holds the wrong content.** Four kinds of text share one label:
  - the situation on 20 OPS cards (`simulation-catalog.js:45`, `lesson:p.situation`);
  - an instruction on 6 Street cards (`:40`, `lesson:p.action`);
  - one of two generic sentences on 12 cards (8 and 4 copies);
  - an unlinked principle on the 12 base Fleet day cards.

  The extension cards splice "Next experiment:" into Learn (`:17`) [V]. *Fix:* part 3 has typed fields (look_for, ops_takeaway) and a generated after-run line.
- **R4. The lesson is lost on arrival.** `studio.js:246` only sets `document.title`. `setConfig` forces the preset select to `custom` (`operations-lab.js:172`). `decisionForConfig` maps all 12 core lessons to the generic 'day' guide (`src/ui/scenario-learning.js:12`), and that guide is a closed details element placed after the model boundary (`operations-lab.js:59`, `:169`) [V]. *Fix:* the deep-link arrival contract (11.3.8).
- **R5. Results come out as tokens, and no sentence reads them.** Examples:
  - raw enums (`labels.js:537-540`);
  - metric keys ("Inspect these guardrails: unfinished_visits (REGRESSED)", `scenario-learning.js:24`);
  - negative "harm" that means the candidate did better (`advanced-operations-view.js:72`);
  - unrounded floats (`regional-power-view.js:11`);
  - "NOT_EVIDENCE · Authority: NONE".

  "Descriptive only" has come to mean "say nothing", even when the model has the answer, as with staffing's 3,208 of 3,208 worker-blocked minutes [V]. *Fix:* a generated "What this run shows" line with plain-word maps (11.3.4).
- **R6. Teaching content exists but is hidden or withheld.**
  - Fleet day's guide is collapsed at the bottom.
  - The Austin and launch panels sit about 4,000 px down.
  - The 20 measured casebook lessons are withheld by a casebook rule stricter than H-9 itself. `src/model/ops-cases.js:10-11` says "Never a lesson or a direction", while design H-9 (design doc line 85) allows a direction "only when a pinned fixture test asserts that direction" [V].

  *Fix:* a visible frame at the top, and a pinned casebook reading gated on a matching run (OD-T1).
- **R7. Setups change hidden inputs or say something the run does not do [V].**
  - The Staffing situation silently changes four inputs, and the page header still says "18 places".
  - bay-area, fleet-day and vehicle-mix load the identical default run: vehicle-mix's patch `ojai_share_pct:50` equals the default.
  - rush-hour changes two settings, and its `start_hour:16` alone changes nothing in 11 of 11 seeds.
  - 4 of 6 depot-work patches change two settings.
  - Street presets move only the hotspot (`street-lab.js:23`), yet the text describes "a burst of background traffic" and "a lower general-traffic discharge rate" (`src/model/street-simulation.js:9-10`).
  - Austin's "Full power control" includes a port outage.
  - OPS-10 asks a question its run cannot answer, because there is no dry arm (`ops-cases.js:828`).

  *Fix:* in T1, each `how` states exactly what the patch changes. Patch changes themselves are T2.
- **R8. Null and mixed results read as broken [V].**
  - The default day completes about 32% of requests (11-seed mean) with no statement that it is deliberately over-demanded.
  - UC-08a reads UNCHANGED although SF-1's own bay wait p90 fell from about 3,519 to 1,882 s in 20 of 20 paired seeds (log-derived).
  - Freshness cuts rejected reservations from 17.7 to 10.3 per run and halves false-ready port-minutes (32 to 16), with zero service change.
  - Airport staging improves on-time pickups while completion reads UNCHANGED.

  *Fix:* look_for lines name the measure that did move, and the result line says "within the margin", not "unchanged".
- **R9. Unexplained semantics [V].**
  - p90, guardrail, allowance, margin and paired seeds are never defined.
  - HOLD reads as "reject" even for conditions nobody chooses (L1, UC-05, OPS-06, OPS-14).
  - The INCONCLUSIVE reason "the interval is too wide to call" (`labels.js:500`) misdescribes OPS-04, whose interval is narrow, entirely above zero, and only straddles the margin edge.
  - The page never says that each four-area case keeps one fixed set of invented riders, keyed on the scenario name (`src/model/world.js:225`), so seeds vary travel times only.

  *Fix:* the glossary (11.3.6), plain-word maps, and a condition/decision tag.
- **R10. Four-area and Fleet day are confused [V].** Three different "fleet day" promises: "Run a fleet day" (overview), "Follow the fleet through a day" (workspace), and "How many trips can your fleet serve today?" (Fleet day). They are different models, and their numbers are not interchangeable. The claim that four-area is the only paired surface is false: Fleet day's paired policy experiment has a 0.02 margin, 2,000 resamples and guardrails (`src/model/bay-experiment-contract.js:53-74`). *Fix:* model badges and a "not interchangeable" line in each How.
- **R11. The copy gate has blind spots.** `tools/check-dist.mjs` scans only the string literals of the 23 `COPY_MODULES` (`:40`) plus rendered attributes. It does not apply H-6.

  Leaks that reach the page today:
  - `src/model/launch-rehearsal.js:19` (em dash)
  - `src/model/launch-contract.js:25` and `:29` (en dashes)
  - `src/model/bay-experiment-contract.js:60` and `:62` (en dashes in error text shown as "Experiment unavailable")
  - `src/model/bay-operations.js:275` (en dashes in assumption text)
  - runtime-built "prediction error port minutes" (`advanced-operations-view.js:11` from the key at `bay-systems.js:11`)
  - "airport forecast" (`advanced-operations-view.js:81`)
  - H-6 "winner" (`launch-view.js:20`, `readiness-view.js:35`, `street-lab.js:140`)
  - H-6 "decision-grade" (`street-lab.js:61`)

  H-6 is tested on `labels.js`, the four-area root, OPS records, Learn, the walkthrough, experiment-ui and analytics, but not on Fleet day, Street lab, the catalog, readiness, launch, Austin or the advanced view [V]. *Fix:* T1.1.
- **R12. Casebook framing buries the question [V].**
  - The workbench header is always the UC-08a text (`studio.js:202`).
  - The SITUATION block runs 1,436 to 2,095 rendered characters before the question (`experiment.js:1125-1150`).
  - Watch lines are checklists for panels the reader has not seen.
  - OPS-15 opens "The OPS-14 world: …", which assumes the reader ran OPS-14.

  *Fix:* case-aware header; the frame first; proxy, outside-model and watch behind one disclosure.

### 11.3 The three-part teaching frame (design)

#### 11.3.1 The component [P]

The frame is one component, `frameView(frame, view)`, exported from `src/ui/teaching-frames.js`. Every surface uses it, and it replaces `decisionView` (`scenario-learning.js:13`) and the catalog's five-field block.

It renders `section.teaching-frame` containing:
- a heading row with the lesson title, a family chip, a model badge, an evidence chip, and a condition or decision tag (four-area only);
- three labeled parts in fixed order;
- a `details` element titled "Limits and what this misses".

Parts are named in text, never by color alone. Absent values render as `not available: <reason>` (H-5), never 0, empty or "null".

| # | Part label (exact) | Pre-run content | After-run content |
|---|---|---|---|
| 1 | **What & why** | `what_why` | same |
| 2 | **How we simulate** | `how` | same |
| 3 | **Learning & ops takeaway** | "What to look for": `look_for`. "Ops takeaway to test": `ops_takeaway`. | "What this run shows": the generated line (11.3.4). For paired tests, "Next test to try": a generated line. Then "Ops takeaway to test": `ops_takeaway`. Only after a matching pinned run (OD-T1): "Casebook reading, checked by tests". |

The owner asked for exactly three parts, and the table keeps them to three. Part 3's label avoids the word "recommendation", which is already the instrument's recorded field (HOLD, ADVANCE_TO_NEXT_TEST and so on) [P, from the architecture verifier].

**§11 labels are canonical.** The part labels above (OD-T6), the evidence chip texts (11.3.2 `evidence`), the condition and decision tags and the family names in 11.4 are the only UI labels T1 ships. §12 and Appendix B use these labels and do not define their own (for example, not "What and why / How it runs / Learn and test next", and not "demand, time and weather shocks"). See the copy precedence rule in 11.6.

#### 11.3.2 Field definitions and length caps [P]

| Field | Part | Cap | Rule | Enforced by (new test) |
|---|---|---|---|---|
| `id` | none | none | Equals a `simulationCatalog()` id or a surface key | key-set equality |
| `family` | chip | none | One of the 8 families in 11.4 | enum |
| `model` | badge | none | "Fleet day", "Street lab", "Four-area experiments", plus a contract subtitle for extensions | enum |
| `evidence` | chip | none | `replay`, `one-seed` or `paired`, rendered as "One replay", "One seed, same demand" or "Paired test, {n} seeds". `{n}` is read from the spec at render time and is never typed (today 20 on four-area and casebook tests, 12 on the Fleet day charging, charger-status and airport contracts). Staffing, capacity, mix, launch and the Street compare are `one-seed` | enum |
| `kind` | tag | none | `decision` or `condition`, rendered as "Decision test" or "Condition test"; four-area and casebook only. It changes how HOLD is worded | enum |
| `what_why` | 1 | **<= 160** | The ops question plus why an operator cares. Setting numbers are allowed; result numbers are not | caps; banned words; H-6; dashes; VERDICT_CLAIMS |
| `how` | 2 | **<= 220** | Names the model and the evidence type; what changes, with values; what stays the same ("stays the same" or "all else the same", never "hold fixed"); one synthetic or out-of-scope clause. It must say so when a patch changes two settings | same |
| `look_for` | 3 | **`look_for` + `ops_takeaway` <= 240** | Which measures to read and in what order. No direction words, no verdict words, no result digits | same, plus DIRECTION, plus the digit rule |
| `ops_takeaway` | 3 | (shared cap) | Follows the wording rule in 11.3.5 | same, plus a prefix check |
| `limits` | disclosure | none | `null` means "use the model-owned limits" (OPS `outsideModel`, the shared Street string, the decision limits). New text is required for the 12 base Fleet day lessons, the 12 non-OPS four-area presets and the 6 extension lessons (729 B today) | non-empty after resolution |
| run line (generated) | 3 | **<= 240** | Built from recorded fields only (11.3.4) | fixture test |
| next test (generated) | 3 | **<= 160** | From the `NEXT` map, keyed by the reason the existing chain selects (`experiment.js:384`) | fixture test |
| `reading` (optional) | 3 | **<= 240** for each of sets 1 to 3 once filled | OPS only. A template, not static text: static words only for clauses that hold on all three pinned sets, plus numeric slots filled from the reader's own verdict with the existing formatters (slot legend in 11.3.4). It states pinned directions and numbers. Shown only when the run's frozen label equals one of that case's pinned labels (sets 1 to 3) and the outcome and recommendation match | per-set equality with `test/ops-cases.pins.json` (11.5.4 test 5) |

**Digit rule for `look_for` and `ops_takeaway`:** no digits once depot ids (SF-1, SF-2, SJ-1, EB-1), clock times (HH:MM), `p90` and lesson ids are removed [P].

**Why this split:** a static caption may state a direction only when a pinned fixture test asserts it (H-9, design doc line 85, as written). The casebook adds that its preset copy "never names a verdict or a direction" (design doc line 603). Static fields are therefore direction-free. Directions come only from the reader's own run (always allowed: it is that run's data) or from a gated, test-asserted reading [V rule text; P design].

#### 11.3.3 Where it renders [P]

| Context | Where (module:line today) | What shows |
|---|---|---|
| **Catalog card** | `simulation-catalog.js:69-72` (replaces question/dl/limits/CTA) | Chips, title, the three parts (pre-run content), limits disclosure, one call to action "Run this lesson". A four-area card keeps its generated change line inside How ("Changes: " + `differenceText`, with the plural fixed and the UC-05 route rows summarized). When `differenceText` is empty (UC-01, whose two arms are identical), the line reads "Changes: none; both arms use the same setting." Generated text never uses the word "null" for a missing or empty value; the lesson title "Null check" is unaffected. Search covers title plus frame text. The filter is by family first, model second. |
| **Panel header before a run** | Fleet day `.ops-intro` (`operations-lab.js:167`). Readiness and advanced panels. Launch (`launch-view.js:64`, replacing `decisionView`). Austin (under the h2, `regional-power-view.js:109-121`). Street lede and preset heading (`street-lab.js:56`, `:73`). Four-area intros (`studio.js:197`, `:202`) and the experiment situation block (`experiment.js:1125-1150`). Learn cases (`learn.js`, above the moment rail). | The lesson frame when `?lesson=` is present or a case is loaded; otherwise the surface frame. For Fleet day, it replaces the closed Learning notes (OD-T2) and stays before `.ops-result-summary` (D1 result-first order kept). For casebook cases, the frame comes first and proxy, outside-model and watch move into one disclosure. |
| **After-run takeaway** | Fleet day `.ops-result-summary` (the partition line stays). Capacity, mix and readiness comparisons. Advanced paired view (replaces `comparisonLearning`, `advanced-operations-view.js:75`). Austin comparison (added above the test-pinned verdict lines, which stay). Launch (replaces the lead sentence at `launch-view.js:36`). Street results ("3 / READ THE TRADE-OFF"). Four-area verdict card (`renderVerdictCard`, `experiment.js:645`: a new section plus the existing `tradeOffSentence`). | "What this run shows", then "Next test to try" (paired only), then "Ops takeaway to test", then, gated, "Casebook reading". Exact values (enums, metric keys, unrounded numbers, version strings, JSON) move behind a closed "Exact values" disclosure. |
| **Lesson deep-link arrival** | `studio.js:212-217`, `:246-248`; `operations-lab.js:172`; `street-lab.js:89`; four-area header | 11.3.8. |

#### 11.3.4 After-run line: generated, never written ahead [P; rules from the verifiers]

**Canonical.** The hard rules, the plain-word maps, the next-test map and the templates in this subsection are the only run-line contract. §12 and Appendix B point here with their field lists; they do not restate a template or a map, and where an older copy differs, this subsection wins (copy precedence, 11.6).

**Hard rules:**
1. Use only recorded fields plus display arithmetic: differences, sums, percentages and unit conversion with the existing formatters (`valueWithMinutes`, `fmt`, `thresholdFormat`). Aggregating over frames or logs counts as new computation and belongs in T2.
2. Order: INVALID first ("Invalid run: {reason}. No result can be read."). Then any one-seed or descriptive note. Then the result.
3. **HOLD wording depends on the cause.** `resolveRecommendation` (`src/instrument/recommendation.js:25-31`) returns HOLD for a regressed primary even when no guardrail regressed. The line must say "Held because the main result regressed" in that case, and never name a guardrail that did not regress. This corrects a refuted draft generator.
4. A NOT_EVALUABLE guardrail renders as "{n} guardrail not available: {reason}". It is never counted as "within" (H-5).
5. `kind: condition` plus HOLD renders "Held: this condition harms service past an allowance". The overflow steps in rule 11 keep this wording.
6. **Guardrail harm:** show the signed change and the allowance in words ("Bay wait p90 at SF-2 went past its allowance"). Put the signed harm number under Exact values with the note: "Harm is signed so that a negative value means the candidate did better."
7. **Mixed trade-off.** When two reported measures moved in directions that each help one aim and hurt the other (for example, more finished journeys and more empty distance), prefix the line with "Mixed trade-off". Never name a winner (H-6).
8. **Nulls.** A stage with `completed_count` 0 renders "no finished visit reached this step", never "not available min".
9. **Rounding.** Round with the existing threshold-preserving formatter. If rounding would put a value on the other side of the margin, show one more decimal.
10. **Field sources.** `{primary_words}` and each guardrail's words come from `metricWords(key)` (`src/ui/charts.js:242`). A seconds metric whose margin is 60 s or more is shown in minutes (`format.signed(v / 60, 1)` plus " min"); otherwise the value uses `metricValueText` and the margin `thresholdText` (`src/ui/experiment.js:203`, `:210`). The exact seconds sit under Exact values.
    - **A nonzero value never reads as zero.** This is the repo convention (`metricValueText` via `format.nonzero`, `experiment.js:203`). When the minutes form of a nonzero value would show 0.0 (under 3 s), the line shows that value in seconds with `metricValueText` instead. On the pins this happens twice: OPS-11 set 1 shows -1.3 s where the minutes form gave 0.0 min, and OPS-09 set 2 shows -2.1 s [V, `teaching-review/fix-round/round2/runline2.mjs`].
    - **Capitals.** `metricWords` returns lowercase words. When they start a sentence (the guardrail clause), the first letter is capitalized: "Bay wait p90 at SF-2 went past its allowance."
11. **Length: at most 240 characters.** Apply these steps in order, each only while the line is still over 240:
    1. Replace the named guardrail clause with "{n} guardrails went past their allowances; see the guardrail table." (for one guardrail: "1 guardrail went past its allowance; see the guardrail table.").
    2. On a HOLD caused by a guardrail, shorten the recommendation sentence to "Held.", because the clause before it already gives the cause. **Condition tests (rule 5):** replace the guardrail clause and the recommendation sentence together with "Held: this condition harms service past {n} allowances; see the guardrail table." (for one guardrail: "Held: this condition harms service past an allowance; see the guardrail table."). Rule 5's wording survives the overflow, and the line still names no guardrail.
    3. Move the interval and margin under Exact values: "{primary_words} {delta}; interval and margin under Exact values."

    Measured on all 60 pinned casebook lines (20 cases, sets 1 to 3), using the field sources in rule 10, the exact verdict values and OPS-06 and OPS-11 as condition tests (the 11.7 ledger):
    - 31 fit as written, 6 need step 1, 23 need steps 1 and 2, and none needs step 3.
    - The longest line is 238 characters.
    - The condition lines measure 206 (OPS-06) and 223 to 225 (OPS-11) characters after step 2.
    - Marking every weather, crowd, closure and demand-surge case as a condition test (OPS-06, OPS-09, OPS-11, OPS-13, OPS-14, OPS-16, OPS-17) gives the same step counts, with a longest line of 240.
    - Step 1 alone leaves 23 lines over 240, so step 2 is required. Step 3 guards reader-built experiments with longer metric words.

    [V, `teaching-review/fix-round/round2/runline2.mjs`, read-only on `test/ops-cases.pins.json`; output in `runline2.out.txt`.]

**Plain-word maps** (the enum stays under Exact values):

| Recorded | Shown |
|---|---|
| IMPROVED / REGRESSED / UNCHANGED | Improved beyond the margin / Worse beyond the margin / Within the margin |
| INCONCLUSIVE | Interval crosses the margin, not decided |
| ADVANCE_TO_NEXT_TEST | Advance to the next simulation test, not a rollout |
| HOLD (guardrail) / HOLD (primary) / HOLD (condition) | Held because a guardrail went past its allowance / Held because the main result regressed / Held: this condition harms service past an allowance |
| RUN_MORE_EXPERIMENTS / NO_RECOMMENDATION | Run more paired seeds before reading a direction / No recommendation: nothing moved beyond the margin |
| INCONCLUSIVE reason (replaces `labels.js:500`) | the interval crosses the margin; run more paired seeds or test a larger step |

The INCONCLUSIVE text uses a comma, not a colon, because the Paired template adds a colon after `{outcome_plain}`. An earlier draft produced a double colon ("...margin: not decided: wait p90...").

**Next test map** (keyed by the reason the existing chain already selects):

| Reason | Next test to try |
|---|---|
| guardrail harmed | Relieve {guardrail} as its own change, then retry this one with both declared. ({guardrail} is the first REGRESSED guardrail's words, rule 10.) |
| primary regressed | Keep the current setting and look for the resource this change took time from. |
| improved | Repeat on another seed set and another rider draw, then read measures no guardrail covered. |
| inconclusive | Add paired seeds or test a larger step of the same setting. |
| unchanged | Check whether the queue this change relieved held cars riders needed, then test the resource that did. |
| invalid | Fix the invalid run first. |

**Templates by evidence type, with filled examples.** Every filled example is model output from a verified run, and each is at most 240 characters.

| Evidence | Template | Filled example |
|---|---|---|
| Paired | `{outcome_plain}: {primary_words} {delta} (95% interval {lo} to {hi}; margin {m}). {guardrail_clause} {recommendation_plain}.` | OPS-01, seed set 1 [V pins, `teaching-review/fix-round/round2/runline2.mjs`] (231 chars): "Improved beyond the margin: wait p90 in San Francisco, D1 16:00 to 19:00 -26.1 min (95% interval -32.0 min to -19.2 min; margin 1 min). Bay wait p90 at SF-2 went past its allowance. Held because a guardrail went past its allowance." |
| Paired, three guardrails past their allowances | same, after overflow steps 1 and 2 (rule 11) | OPS-19, seed set 1 [V pins, same probe] (204 chars): "Worse beyond the margin: wait p90 in San Francisco, D2 07:00 to 09:00 +14.0 min (95% interval +10.1 min to +17.7 min; margin 1 min). 3 guardrails went past their allowances; see the guardrail table. Held." Written in full, naming all three guardrails, the line is 318 characters. |
| Paired, condition test | same, after overflow steps 1 and 2, condition form (rules 5, 10 and 11) | OPS-11, seed set 1 [V pins, same probe] (223 chars): "Interval crosses the margin, not decided: wait p90 in San Francisco, D2 07:00 to 09:00 -1.3 s (95% interval -5.5 min to +5.3 min; margin 1 min). Held: this condition harms service past 2 allowances; see the guardrail table." |
| Paired, null | same | UC-08a [V, `test/presets.test.mjs:121`] (178 chars): "Within the margin: wait p90 -3.4 s (95% interval -10.2 s to +0.4 s; margin 30 s). Every guardrail stayed within its allowance. No recommendation: nothing moved beyond the margin." |
| Fleet day replay | `{c} of {n} requests completed in this replay; {u} unserved, {w} waiting and {p} in progress at the end. Seed {s}, one replay.` | [V, pinned `test/d1-presentation.test.mjs:24`] "95 of 284 requests completed in this replay; 176 unserved, 4 waiting and 9 in progress at the end. Seed 42, one replay." Do not add "find the resource before adding fleet": in the default day fleet size is the largest lever (refuted; see 11.8). |
| One seed, same demand (capacity) | list per trial plus target clause | [V] "Same demand, seed 42: 12, 24, 36 and 48 cars completed 60, 95, 147 and 197 of 284; 1 to 6 depots completed 79, 95, 103, 105, 111 and 109. No tested depot count reached 95%. One seed." |
| One seed (staffing) | baseline, worker and bay arms, plus blocker minutes | [V] "Seed 42, 240 min: baseline 26 of 179 trips, one more worker 36, one more bay 26. Queued clean minutes: no free worker 3,208, no free bay 0, both 0. One seed; descriptive." |
| One seed (launch) | `Seed {s}, {template} template: commissioning {d} min late changed completed trips by {dc} ({c0} to {c1}), late pickups by {dl}, missed pickups by {dm} and on time pickups by {dw} ({w0} to {w1}). One seed; descriptive.` It leads with completed trips and names the template. The `({w0} to {w1})` pair is left out when that change is 0 | Region B, the `region-launch` lesson. Model output [V, `teaching-review/fix-round/peninsula-launch.mjs`] (185 chars): "Seed 42, Region B template: commissioning 90 min late changed completed trips by -5 (34 to 29), late pickups by -5, missed pickups by +5 and on time pickups by 0. One seed; descriptive." |
| One seed (launch, Peninsula) | same | Model output [V, same probe] (198 chars): "Seed 42, Peninsula template: commissioning 90 min late changed completed trips by -5 (36 to 31), late pickups by -3, missed pickups by +4 and on time pickups by -1 (25 to 24). One seed; descriptive." The Launch panel opens on Peninsula (`launch-view.js:56`, `let config=createLaunchConfig('peninsula')`), so this is the line a first-time reader sees. |
| One seed (Street compare) | mixed-trade-off rule | [V] "Mixed trade-off, same demand, seed 42: queue-aware routes finished 41 vs 37 of 71 journeys, with +37.5 km empty distance and +2 vehicles in the busiest-moment queue total. One seed." |
| Replay (Austin run) | counts plus zero-power minutes | [V] "77 of 480 requests completed and 391 unserved; plugged-in cars got 0 kW for 120 vehicle-min. 60% power condition, seed 42, one replay." |

The Austin comparison keeps its test-pinned sentences (`test/regional-power-d1.test.mjs:40-47`) unchanged. T1 adds a plain line above them.

**Casebook reading template (T1.7, OD-T1; OPS-01 shown).** This paragraph is canonical for every casebook reading: the slot legend, the fill rules and the OPS-01 wording. Appendix B.8 supplies the per-case wording for OPS-02 to OPS-20 (the part of each LEARN line before "Ops check:") in this slot syntax, and its slot legend restates this one. Appendix B.8's OPS-01 row repeats the template below; where the two ever differ, this one wins (copy precedence, 11.6). An earlier Appendix B.8 wording said the next morning "gains", which can read as a longer wait.

A reading is stored as a template. Its static words are limited to clauses that hold on all three pinned sets, and every result number is a slot filled from the reader's own verdict.

**Slot legend:**
- `{set}`: the seed set of the matched label (1, 2 or 3).
- `{primary:u}`: the absolute primary mean delta.
- `{gN:u}`: the absolute harm of guardrail N, in declared order.
- `{b.<metric>:u}` and `{c.<metric>:u}`: a stored descriptive's baseline and candidate values.
- Units `u`:
  - `min` shows seconds as minutes to 1 decimal (the minutes half of `valueWithMinutes`, `experiment.js:433`);
  - `s` shows seconds to 1 decimal;
  - `pts` shows a share x100 to 1 decimal;
  - `n` shows a count to 1 decimal.
- A nonzero value never fills as zero (rule 10). A reading shows only after a run that matches a pinned set, so its values are that set's pinned values. Test 5 therefore checks this per set, and a clause whose `min` slot would show 0.0 on any set is written with `s` and a static "s" instead.
- Direction words are static and must hold on all three sets, so the sign lives in the static word and every slot is an absolute value.
- A declared setting that is the same on all three sets, such as an allowance, may stay static text. Test 5 checks it against each set's pinned `max_harm` or margin.

`Seed set {set}: SF evening wait p90 fell {primary:min} min while SF-2 bay wait p90 rose {g1:min} min, past its 30 min allowance, so the call is HOLD. SF wait p90 the next morning also fell {g2:min} min, inside its allowance.`

Filled from the pins with the exact verdict values [V, `teaching-review/fix-round/round2/reading2.mjs`]. On all three sets the primary is negative, SF-2 is REGRESSED with a positive harm and a pinned `max_harm` of 1,800 s (30 min), and the next-morning guardrail is WITHIN with a negative harm:
- Set 1 (203 chars): 26.1, 39.4 and 13.9 min.
- Set 2 (203 chars): 29.2, 44.2 and 11.4 min.
- Set 3 (203 chars): 31.9, 38.1 and 12.3 min.

The earlier draft said the next morning "gained 13.9 min", which can read as a longer wait; the harm is negative, so the wait fell.

#### 11.3.5 "Ops takeaway to test": the wording rule [P]

1. Start with "An ops team would", followed by one verb from this set: test, check, measure, compare, log, size, map, write, give. The frame test and the section checker both check the prefix and the verb: `/^An ops team would (test|check|measure|compare|log|size|map|write|give)\b/`.
2. Name something this lesson makes visible, and a place the team would look: "in its own records", "in its own operation", "against its own peak".
3. Never "should", "must", "proves", "shows that", "safe" or "guarantee". Never an instruction to change a fleet. Never a claim about real performance.
4. Stay direction-free (the DIRECTION regex; 11.5.1) and digit-free. Do not presuppose a direction the model can refute. Example: "Find the resource … before adding fleet" is refuted, because fleet size dominates the default day.
5. Guardrail words stay neutral ("guarding empty distance"). H-6 words such as "cost" or "win" are banned, and check-dist does not catch them, so the new test must.

#### 11.3.6 Glossary for unavoidable jargon [P]

Show it once per surface as a `details` element titled "Words used here", and inline as `abbr` text on first use. Every entry passes the banned-word, H-6 and dash rules and is at most 160 characters.

| Term | Entry |
|---|---|
| p90 | p90: 9 in 10 results are at or under this value. A p90 wait of 20 min means at most 1 rider in 10 waited longer. |
| Paired seeds | Paired seeds: both runs share the same riders and random draws, so a difference comes from the one changed setting. |
| Margin | Margin: the smallest change in the main result that the test treats as real. It is set before the run. |
| Guardrail | Guardrail: a measure the change must not harm past its allowance, set before the run. One harmed guardrail stops the change. |
| Allowance | Allowance (max harm): how far a guardrail may move the wrong way before the change is stopped. |
| Beyond the margin | Improved or worse beyond the margin: the whole 95% interval sits past the margin on the good or the bad side. |
| Within the margin | Within the margin: the whole 95% interval sits inside the margin. |
| Crosses the margin | Interval crosses the margin: the test cannot decide yet. |
| Held | Held (HOLD): a guardrail or the main result went the wrong way past its limit. For a condition nobody chooses, it means the condition harms service. |
| Advance | Advance to the next test: the main result improved and every evaluated guardrail stayed within its allowance. The next step is another simulation test. |
| No recommendation | No recommendation: nothing moved beyond the margin. It is not proof that the change has no effect. |
| Unserved | Unserved: a rider with no car assigned within the patience time, who then left. |
| Waiting, in progress | Waiting and in progress: requests still open when the run ends. They are counted, not dropped. |
| One replay | One replay: a single run on one seed. It describes one day and cannot tell noise from an effect. |
| Same riders | Same riders: in Four-area experiments, each case keeps one fixed set of invented riders; seeds vary travel times only. Another set of riders can change a call. |
| Empty distance | Empty distance: km driven with no rider on board, to reach a pickup or a depot. |
| Recall, release | Recall and release: at day 2 00:30 idle cars head to their depot. At 05:45 ready cars outside their home area drive home. |
| NOT_EVIDENCE | NOT_EVIDENCE: every number is invented teaching output from an uncalibrated model, not a measurement of any fleet. |

The recall entry follows the verified model: ready cars at a depot stay dispatchable overnight, and the 05:45 release moves only ready cars outside their home area (`src/model/policies.js` `releasesHome`) [V].

#### 11.3.7 Reading order (every surface) [P]

1. Title row: lesson title, family chip, model badge, evidence chip. The version string moves off Fleet day's line 2 into the model identity element; `d1-presentation.test.mjs:26` only checks that the element contains it.
2. **What & why.**
3. **How we simulate.**
4. **Learning & ops takeaway**, pre-run: What to look for, then Ops takeaway to test.
5. One primary Run control with one verb per surface. The Fleet day test requires exactly one enabled primary button (`d1-presentation.test.mjs:25`), so the frame adds none. Street lab's "Start the street demo" and "Run street scenario" become one Run button plus "Compare route policies". That one Run button stays inside `.street-intro`, because `street-lab.test.mjs:53-60` clicks `.street-intro button` and expects focus on `.street-results h2` with no scroll.
6. Result summary: the partition or verdict line, then "What this run shows", "Next test to try", "Ops takeaway to test", and, gated, the casebook reading.
7. Tables and charts.
8. Closed disclosures: "Exact values", "Limits and what this misses", "Words used here".

**Target:** at most 130 words from the h1 to the Run control on any surface. The 21 exemplar frames measure 87 to 113 words [V, `teaching-review/fix-round/round2/check11r2.mjs`]. On Fleet day the frame replaces the lede and the version line, which are part of today's 64 words, so the frame must be the only prose between the title row and the Run control [P].

#### 11.3.8 Lesson deep-link arrival contract [P]

When a route carries `?lesson=<id>`:
- **Heading.** The frame heading shows the lesson title, and the h1 or panel heading names the lesson. The select shows the lesson name, for example "Lesson: Cleaning capacity and queues", not "Custom or shared setup".
- **Results.** Results from a different setup are cleared to the pre-run state rather than shown as "(stale: previous settings)".
- **Panels.** For lessons that open a panel far down the page (`region-launch`; future Austin lessons), open the panel, then move focus and scroll to the panel heading, as `studio.js:248` already does for shared setups.
- **Status.** Street lab shows "Lesson loaded: {title}. Press Run when ready." instead of "Shared settings loaded…" (`street-lab.js:89`).
- **Four-area cases.** `kind: ops` presets render a case-aware header in place of the UC-08a text (`studio.js:202`). `L2a` and `L2b` both open Learn case L2, so `learn.js` shows the frame of the preset id that was opened (default `L2a`) [V gap].
- **Edits.** If the reader then edits a setting, the frame stays and a note appears: "Setup changed from this lesson. The frame still describes the lesson setup."

#### 11.3.9 Low-fi wireframes

**Catalog card, desktop** (grid of 3 at 1280 px, about 380 px per card):

```
+--------------------------------------------------------+
| [Depot work and capacity] [Fleet day] [One replay]     |
| cleaning                                               |
| Cleaning capacity and queues                           |
|--------------------------------------------------------|
| WHAT & WHY                                             |
| Cars wait for a cleaning bay between trips. Do fewer   |
| bays and more frequent visits keep cars from riders    |
| long enough to change service?                         |
| HOW WE SIMULATE                                        |
| Fleet day with 1 cleaning bay per depot and a depot    |
| visit every 2 trips: two changes at once. Demand,      |
| fleet and places stay the same. ... One replay.        |
| LEARNING & OPS TAKEAWAY                                |
| What to look for: Read completed and unserved          |
|   requests before the average wait, ...                |
| Ops takeaway to test: An ops team would test cleaning  |
|   cadence and bay count as separate changes.           |
| > Limits and what this misses                          |
| [ Run this lesson -> ]                                 |
+--------------------------------------------------------+
```

**Catalog card, 400 px** (one column, 16 px gutters, chips wrap, nothing truncated):

```
+--------------------------------------+
| [Depot work and capacity]            |
| [Fleet day] [One replay]             |
| Cleaning capacity and queues         |
| WHAT & WHY                           |
| Cars wait for a cleaning bay between |
| trips. Do fewer bays and more ...    |
| HOW WE SIMULATE                      |
| Fleet day with 1 cleaning bay per    |
| depot and a depot visit every 2 ...  |
| LEARNING & OPS TAKEAWAY              |
| What to look for: ...                |
| Ops takeaway to test: ...            |
| > Limits and what this misses        |
| [ Run this lesson -> ]  (full width) |
+--------------------------------------+
```

**Panel header before a run, desktop** (Fleet day with `?lesson=fleet-day`):

```
FLEET DAY  [Fleet size and supply] [One seed, same demand]
Fleet size versus trip demand                    (h1)
+------------------+-------------------+-------------------+
| WHAT & WHY       | HOW WE SIMULATE   | LEARNING & OPS    |
| Is this fleet    | Run the day, then | What to look for: |
| short of cars or | press Compare     | Compare how ...   |
| of depot         | fleet & depot     | Ops takeaway to   |
| capacity? ...    | sizes: ...        | test: An ops ...  |
+------------------+-------------------+-------------------+
[ Run fleet day ]   Lesson: Fleet size versus trip demand v
Result summary: The default day has more requests than 24
cars can serve, so the limits show. Read all four counts.
```

**Panel header before a run, 400 px:** the same three parts stack in order (What & why, How we simulate, Learning & ops takeaway) with no clamping. The Run control follows the three parts at full width. The limits disclosure sits below the result summary.

**After-run takeaway, desktop** (four-area verdict card, OPS-01):

```
WHAT THIS RUN SHOWS               [Paired test, 20 seeds]
Improved beyond the margin: wait p90 in San Francisco, D1
16:00 to 19:00 -26.1 min (95% interval -32.0 min to -19.2
min; margin 1 min). Bay wait p90 at SF-2 went past its
allowance. Held because a guardrail went past its allowance.
NEXT TEST TO TRY
Relieve bay wait p90 at SF-2 as its own change, then retry
this one with both declared.
OPS TAKEAWAY TO TEST
An ops team would size the overnight depot wave before
staging peak cars, and set the allowed overnight bay wait
first.
CASEBOOK READING, CHECKED BY TESTS      (gated, OD-T1)
Seed set 1: SF evening wait p90 fell 26.1 min while SF-2
bay wait p90 rose 39.4 min, past its 30 min allowance, so
the call is HOLD. SF wait p90 the next morning also fell
13.9 min, inside its allowance.     (numbers filled from
                                     the reader's verdict)
> Exact values   > Limits and what this misses
```

**After-run takeaway, 400 px:** the same blocks stack, each label on its own line. The chip moves under the "WHAT THIS RUN SHOWS" label. The verdict gate chain and tables follow below. Nothing scrolls horizontally.

#### 11.3.10 Exemplar frames (verified strings)

Every string below passes the exact rules in 11.5.1, the length caps, the prefix rule, and the direction and digit rules for part 3. The checker is `teaching-review/fix-round/round2/check11r2.mjs`, which parses this section directly: 208 strings, 0 problems [V]. It also enforces the 11.3.5 verb set, the shared house words (11.5.1) and the claimed lengths. Grounding comes from verifier-confirmed runs [V]. Lengths are shown as what_why / how / look_for+ops_takeaway.

**Surface frames**
- **Fleet day (`day`), 152/188/227**
  - W: How many ride requests can this fleet complete in an 8 hour day, and what keeps a car from its next rider? The answer points to the lever worth testing.
  - H: One synthetic 8 hour day from 07:00 on OpenStreetMap Bay Area roads: requests, pickups, trips, then depot cleaning, charging and upload. One replay per setting, fixed seed. Not calibrated.
  - L: Read completed, unserved, waiting and in progress together, then compare fleet and depot sizes to see which one moves completed trips.
  - O: An ops team would measure where its own vehicle time goes before buying cars or depot sites.
  - Grounding: seed 42 fleet time is 40.8% empty pickup driving, 19.0% carrying riders, and 28.4% at or queued for depot work (model output) [V].
- **Street lab (`street`), 160/203/240**
  - W: One constrained street can trap fleet vehicles in road queues. Street lab asks how many rider journeys still finish, and whether routing around the queue helps.
  - H: Synthetic traffic on frozen OpenStreetMap SF streets. Each block holds a finite queue, and a full block stops the one behind it. Presets move the hotspot only; Compare runs two route rules on one demand.
  - L: Read finished and expired journeys before pickup wait, which averages boarded riders only. Then find where the busiest queues sit.
  - O: An ops team would test a routing or pickup change on its own trip records with empty distance as a guardrail.
  - Note: the street lane's version of this what_why used "can hold". That trips VERDICT_CLAIMS (`\bhold\b`); "trap" fixes it.
- **Four-area experiments (`workbench`), 147/178/237**
  - W: Four schematic Bay Area zones share 120 cars and four depots. Ask one fleet or depot question and see whether rider wait moves, and what it trades.
  - H: Invented riders from day 1 05:00 to day 2 10:00, with an overnight recall. An experiment changes one setting, replays the same riders on 20 travel seeds and reads the paired gap.
  - L: Read the recommendation with its guardrails, not the main result alone. Each case keeps one set of invented riders.
  - O: An ops team would check what a result suggests measuring in its own operation, and not treat it as a reason to change it.
  - The earlier ops line used "use", which is outside the rule 1 verb set (11.3.5). The first replacement ended "change that operation" (133 characters); with this L that is 249 against the 240 shared cap, so "that operation" became "it".
- **Four-area day (`four-area`), 100/150/228**
  - W: Follow one four-area day to see where riders wait and which depot queues, before testing any change.
  - H: One replay of the chosen scenario with travel variation at 0, so every replay repeats. Moments mark the peaks, the 00:30 recall and the 05:45 release.
  - L: Read rider wait by area and hour next to bay wait by depot and hour, and ask whether the longest queue overlaps a rider peak.
  - O: An ops team would map its own waits and depot queues by hour before choosing which constraint to test.
- **Austin power lab (`regional-power`), 149/182/236**
  - W: A depot loses part or all of its charging power for 90 minutes mid shift. How many trips does the fleet lose, and can charging order protect service?
  - H: Fictional Austin-inspired map, 40 cars, 2 depots, 8 hours. Site A power drops in minutes 90 to 180; Site B keeps 120 kW. Every run also has 1 port per depot out in minutes 60 to 120.
  - L: Run each power condition and compare completed and unserved requests, then check whether the charging order comparison moves either.
  - O: An ops team would check whether its depots sit at their power cap all day before planning for an event.
- **Launch rehearsal (`launch`), 154/203/231.** No longer a plain alias of `region-launch`: the panel opens on the Peninsula template (`launch-view.js:56`), while the lesson runs Region B, so the H is its own; W, L and O reuse the `region-launch` strings. After a run, the line names the template (11.3.4).
  - W: If new charging ports come online 90 minutes late, how much rider service is lost? Launch teams need to know which commissioning dates carry service risk.
  - H: Two runs of the chosen template, Peninsula by default or fictional Region B, on the same demand seed: ports commissioned at minute 0 versus minute 90. All else the same. Setup checks are not inspections.
  - L: Read completed trips and late or missed pickups first; on time pickups made before the delay window cannot show it.
  - O: An ops team would give each port commissioning task an owner and a date, then rehearse a slip against its own peak.
- **Reference panels (`reference-panels`), 142/209/234.** The frame sits above the FLEET-005 and two-zone probe panels in every Experiment view (`experiment.js:1448-1461`). The panels are quoted records, not runs. Their own wording (`labels.js:33-35`) is design §1.3 exact copy and stays equal to it unless an OD changes the design. The frame calls their source "the reference harness", never "FleetLab", so the site's own name keeps one meaning (R1).
  - W: How does a committed test record read next to a teaching run? These panels quote two outside records so you can compare how a test is written.
  - H: Quoted text only: nothing here runs. FLEET-005 is a committed decision record and the two-zone probe is an exploratory run, both from the reference harness, a separate tool whose world differs from this model.
  - L: Read each record's question and axis, then the differences list: verdict rules are shared; the world and random draws are not.
  - O: An ops team would compare how a record states its question and guardrails with how it writes its own tests.

**Situation presets** (Fleet day "Start with a situation", `operations-lab.js:23-30`, select at `:67`). The select has 9 options: 8 presets and the disabled "Custom or shared setup". Each preset gets a `SURFACE_FRAMES` key. Five alias an existing frame because their patch is identical; three need their own text, because their patches match no lesson:

| Option (preset id) | Patch against the default day | Frame |
|---|---|---|
| A regular service day (`balanced`) | none | alias of `day` |
| Optional model: charging (`charging`) | `advancedOperationsDemoConfig('charging')` | alias of `charging` (= `power-redistribution`) |
| Optional model: resources (`resources`) | `advancedOperationsDemoConfig('resources')` | alias of `resources` (= `resource-freshness`) |
| Optional model: airport (`airport`) | `advancedOperationsDemoConfig('airport')` | alias of `airport` (= `airport-preparation`) |
| Staffing: an empty bay needs a worker (`staffing`) | `depotReadinessDemoConfig()` | alias of `staffing` (= `staffing-readiness`) |
| A rainy evening peak (`rain`) | start 15:00, rain, 45 requests an hour | `preset:rain`, below |
| A busy depot (`depot`) | 32 cars, 1 depot, 1 charger, 1 cleaning bay, visit every 2 trips | `preset:depot`, below |
| More ports, limited power (`power`) | 32 cars, 80 kW ports, 40 kW site power, visit every 2 trips | `preset:power`, below |
| Custom or shared setup (disabled) | whatever was loaded | the `day` frame plus the 11.3.8 "Setup changed" note |

Setting values are from a source read of `operations-lab.js:23-30`, `bay-operations.js:15` and the weather table at `bay-operations.js:48` [V]. The three new frames carry no result numbers.
- **`preset:rain`, 147/219/230**
  - W: Rain at the evening peak slows every trip while more riders ask for one. Which part of the fleet day gives way first: cars, charging or depot work?
  - H: Fleet day with three changes at once: start 15:00 instead of 07:00, rain (declared: travel x1.3, energy x1.12, demand x1.12) and base demand 45 requests an hour instead of 30. Fleet and places stay the same. One replay.
  - L: Read completed and unserved requests first, then where cars spend time: pickup driving, charging or a depot queue. Three settings change at once.
  - O: An ops team would log trip time and requests by weather and hour in its own records.
- **`preset:depot`, 136/215/239**
  - W: One depot serves 32 cars with 1 charger and 1 cleaning bay, and cars visit every 2 trips. Which depot step keeps cars from riders first?
  - H: Fleet day with five changes at once: 32 cars instead of 24, 1 depot instead of 2, 1 charger instead of 4, 1 cleaning bay instead of 2, a visit every 2 trips instead of 3. Synthetic demand stays the same. One replay.
  - L: Read completed and unserved requests, then the queue minutes at each depot stage to see which step cars wait for. Five settings change at once.
  - O: An ops team would log which depot step each waiting car needs before adding a charger or a bay.
- **`preset:power`, 148/217/220**
  - W: Four 80 kW ports share one 40 kW site cap at each depot. When the cap, not the port rating, sets charging speed, how long are cars kept from riders?
  - H: Fleet day with four changes at once: 32 cars instead of 24, 80 kW ports instead of 50, 40 kW site power instead of 120, a visit every 2 trips instead of 3. Ports, depots and synthetic demand stay the same. One replay.
  - L: Read charging queue minutes and delivered energy next to completed trips, and compare each port's rating with its share of the site cap.
  - O: An ops team would compare port ratings with its site power cap before adding ports.
  - The W's "the cap, not the port rating, sets charging speed" is arithmetic on the settings: one 80 kW port alone exceeds the 40 kW cap, and both vehicle profiles accept more than 80 kW (`vehicle-profiles.js:15-16`) [V].

**Lesson frames**
- **fleet-day, 119/183/240**
  - W: Is this fleet short of cars or of depot capacity? Buying the wrong one leaves riders unserved and ties up scarce sites.
  - H: Run the day, then press Compare fleet & depot sizes: the same requests replay with 12, 24, 36 and 48 cars, then 1 to 6 depots. Only that count changes. Demand and sites are synthetic.
  - L: Compare how completed trips respond to cars and to depots, and note whether any tested depot count reaches the completion target.
  - O: An ops team would check how much car time goes to empty pickup driving before sizing a fleet or adding a site.
- **cleaning, 135/190/219**
  - W: Cars wait for a cleaning bay between trips. Do fewer bays and more frequent visits keep cars from riders long enough to change service?
  - H: Fleet day with 1 cleaning bay per depot and a depot visit every 2 trips: two changes at once. Demand, fleet and places stay the same. Clean time is fixed and staff are unlimited. One replay.
  - L: Read completed and unserved requests before the average wait, which counts completed trips only. Then compare queue minutes at each depot stage.
  - O: An ops team would test cleaning cadence and bay count as separate changes.
- **staffing-readiness, 141/176/211**
  - W: Cars wait for cleaning. Does the depot need another cleaning worker or another bay? Adding the wrong one leaves riders waiting just the same.
  - H: One seed, same demand: 16 cars, 1 depot, 18 min base cleaning after every trip. Baseline has 1 worker and 3 bays; one arm adds a worker, the other adds a bay. Descriptive only.
  - L: Read the blocker minutes first: what each queued clean was waiting for. Then compare completed trips in the three runs.
  - O: An ops team would log what each waiting car lacks, a worker or a bay, before adding either.
  - T1 must lift the blocker table out of its collapsed per-arm details (`readiness-view.js:44`).
  - The W now equals the Appendix B WW for this lesson. The earlier W began "Should the depot add...", which breaks the house-word rule that §11 and §12 now share (11.5.1).
- **power-redistribution, 132/175/221**
  - W: Some cars accept less power than their share. Can the depot pass that unused power to other cars and get them back to riders sooner?
  - H: 12 paired seeds, 4 hours, 24 cars, 8 ports sharing 120 kW; I-PACE accepts 10 kW. Equal shares versus redistributing unused power. All else the same; linear charging, no taper.
  - L: Read completion against its margin, then charging minutes and unfinished energy per seed; a rule can move energy without freeing cars in time.
  - O: An ops team would check that a charging rule frees a car before its next peak.
- **region-launch, 154/188/231**
  - W: If new charging ports come online 90 minutes late, how much rider service is lost? Launch teams need to know which commissioning dates carry service risk.
  - H: Two runs on Region B with the same demand seed: ports commissioned at minute 0 versus minute 90. All else the same. Sites, tasks and owners are fictional; setup checks are not inspections.
  - L: Read completed trips and late or missed pickups first; on time pickups made before the delay window cannot show it.
  - O: An ops team would give each port commissioning task an owner and a date, then rehearse a slip against its own peak.
- **street-first, 140/192/230**
  - W: Bridge rush: when 1st Street backs up toward the Bay Bridge, how many rider journeys still finish, and are East Bay trips the only ones hit?
  - H: Defaults: 24 AVs, 36 rider requests an hour, 900 other vehicles an hour, most on 1st Street, and a 75% capacity loss from minute 15 to 90. Compare route policies runs both rules on one demand.
  - L: Read finished and expired journeys with empty distance and nearby queues; a detour can trade one measure against another.
  - O: An ops team would test a routing rule on bridge-bound legs in its own trip records, guarding empty distance.
- **street-van-ness, 135/180/217**
  - W: Van Ness signals: if a signal corridor slows trips, can a larger fleet make up the lost service, or does the street still set the pace?
  - H: Van Ness with the shared synthetic 90 second signal cycle and imported OSM turn restrictions; no signal control or BRT lane. Run 12, 24, 36 and 48 AVs on the same seed and compare.
  - L: Compare pickup wait and expiries with ride time at each fleet size, and compare ride time with a run that has no other traffic.
  - O: An ops team would compare ride time with a no traffic baseline before blaming a corridor.
  - This replaces the refuted "street-limited" framing: with no other traffic the ride is 23.1 min against 24.4 min at defaults, so this day is supply-limited [V].
- **UC-08a, 104/193/240**
  - W: Would two more cleaning bays at SF-1 shorten rider waits, or is the bay not what keeps cars from riders?
  - H: Four-area experiments: SF-1 with 4 or 6 cleaning bays, same riders, 20 paired seeds that vary travel times only. Rider wait p90 is the main result, 30 s margin; unserved share is the guardrail.
  - L: Read rider wait p90 against its margin. A depot change can relieve its own queue while rider wait stays inside the margin.
  - O: An ops team would check whether cars queued at a depot are the ones riders need at the peak before adding bays there.
  - The card does not show SF-1's own bay wait today. Adding that row changes the spec digest, so it is T2.
- **L2b, 151/159/201**
  - W: The L2a bay cut with one extra rule written first: SJ-1 bay wait may not grow by more than 10 minutes. Does a rule declared in advance change the call?
  - H: Identical arms and seeds to L2a: SJ-1 cleaning bays 3 to 1, with 12 San Jose cars. Added guardrail: SJ-1 bay wait p90, max harm 600 s, declared before the run.
  - L: Compare this card's recommendation with L2a's: the runs are the same, only the declared guardrails differ.
  - O: An ops team would write a guardrail for the resource it cuts before running any capacity test.
- **OPS-01, 139/160/230**
  - W: Evening peak in San Francisco: few free cars, long waits. Would 12 more cars help riders, and what do they add to the overnight depot wave?
  - H: Only the SF fleet changes, 40 to 52 cars all run. Same riders and roads, 20 paired seeds. Extra cars sleep at SF-1 and SF-2. Staff and charging are not modeled.
  - L: Read the evening wait against its margin, then each guardrail: extra cars also join the overnight depot queue.
  - O: An ops team would size the overnight depot wave before staging peak cars, and set the allowed overnight bay wait first.
  - "Parking is outside the model" was refuted; depot stalls are modeled.
- **OPS-07, 144/185/201**
  - W: After the recall, launch cars queue into the night for one cleaning bay. Would 3 bays put more East Bay cars on the road for the second morning?
  - H: Only the launch depot bays change, 1 to 3; stalls, fleet and demand stay the same. Same riders, 20 paired seeds that vary travel only. Staff, opening hours and charging are not modeled.
  - L: Read when the depot queue happens next to when riders need cars, and where ready cars go overnight.
  - O: An ops team would check when a depot queue clears relative to the morning release before buying bays.

**Intro and label copy** (all checked):
- **Overview hero lede:** "Riders wait when cars are busy elsewhere. Find out which work between rides limits service: driving, charging, cleaning or a street queue."
- **Catalog intro:**
  - h1: "Which lesson answers my question?"
  - Why line: "Every lesson answers one fleet operations question. Find yours by the decision you face, not by the model behind it."
- **Walkthrough intro:**
  - h1: "One question, one day, one verdict."
  - Text: "OPS-01 asks whether 52 San Francisco cars instead of 40 change evening rider wait. Watch the day, read the verdict, then see what it trades and what to test next."
  - T1 changes only this intro h1 and paragraph. Every walkthrough structure change (a beat 0, chapter renames, the chapter 3 reorder, a next-test line on the last beat, moving the refusals behind a disclosure, a `specSentence` built from `differenceText`) is OD-T7 or T2, not T1 (see OD-T7).
- **Fleet day pre-run summary** (replaces "…see the complete request partition"): "The default day has more requests than 24 cars can serve, so the limits show. Read all four counts together." Grounding [V]: 24 cars complete 32% on average over 11 seeds; 72 cars complete 90%.
- **Label fixes:**
  - "Queued on all streets at the busiest moment"
  - "Mean wait of completed trips, pickup drive included"
  - "Neither route rule is ranked overall." (replaces "No universal winner is computed.")
  - "What would make this ready for a real decision?" (replaces "decision-grade")
  - "Runs in this four-area model only": an added element next to the axis tag, not a replacement. `labels.js:31-35` (verdict footer, axis tag, FLEET-005 and probe panel chips) are design §1.3 exact-copy rows pinned by `labels.test.mjs:333`, so T1 leaves them unchanged. Rewording them needs a same-commit design edit and its own OD.
  - "What this walkthrough leaves out" (heading for the refusal list behind a disclosure): OD-T7, not T1, because it changes the last beat.

### 11.4 Information architecture: which simulation answers which ops question

All 56 lessons map exactly once onto 8 question families [V, `teaching-review/framing/families.mjs`: catalog 56, assigned 56, unique 56]. In the table below, the "Lesson ids" column lists each id once; the "Open first" column repeats one of them per family. The family questions follow the shared house-word rule (11.5.1), so none says "should". I renamed the fifth family from "Demand, time and weather shocks" to "Demand, crowds and weather", because OPS-13 and OPS-16 change travel and curb time rather than demand [P, following the verifier's note].

| Ops question (family) | Where it is answered (model, evidence) | Lesson ids | Open first |
|---|---|---|---|
| **Do we have enough cars, and where do they start the day?** (Fleet size and supply) | Fleet day capacity and mix comparisons (one seed, same demand); four-area paired tests (20 seeds) | `fleet-day`, `vehicle-mix`, `UC-02`, `OPS-01`, `OPS-10`, `OPS-18` | `fleet-day` |
| **Which depot step holds cars back: workers, bays, cleaning, software or upload?** (Depot work and capacity) | Fleet day replays; staffing contract (one seed, three arms); four-area paired tests | `cleaning`, `depot-count`, `software`, `upload`, `staffing-readiness`, `L2a`, `L2b`, `UC-08a`, `UC-08b`, `UC-10`, `OPS-11`, `OPS-12`, `OPS-19`, `OPS-20` | `staffing-readiness` |
| **Is charging power, port count or charging order the limit?** (Energy and charging) | Fleet day replays; paired charging and charger-status contracts (12 seeds); Austin power lab (panel only, no lesson id) | `charging`, `shared-power`, `power-redistribution`, `deadline-charging`, `resource-freshness` | `shared-power` |
| **When do cars come in and go out, and which depot does each one use?** (Recall, release and depot choice) | Four-area paired tests | `L3`, `OPS-02`, `OPS-03`, `OPS-04` | `OPS-02` |
| **What does a surge, a crowd or rain do, and who absorbs it?** (Demand, crowds and weather) | Fleet day replays; airport contract (12 seeds); four-area paired tests | `rush-hour`, `weather-day`, `L1`, `OPS-09`, `OPS-13`, `OPS-14`, `OPS-15`, `OPS-16`, `airport-preparation`; planned N2 `event-curb-staging` (S5; 57th lesson) | `OPS-14` |
| **Does a street queue or a closure limit service, and does routing help?** (Roads and streets) | Street lab (one seed, same demand compare); four-area paired tests; Fleet day geography | `street-first`, `street-harrison`, `street-stockton`, `street-van-ness`, `street-embarcadero`, `street-lombard`, `bay-area`, `UC-05`, `OPS-17` | `street-first` |
| **What does a launch need: cars, depot space, commissioned ports?** (Launching a new area) | Launch rehearsal (one seed); four-area paired tests | `region-launch`, `OPS-05`, `OPS-06`, `OPS-07`, `OPS-08` | `OPS-05` |
| **How do I read a replay, a paired test and a null result?** (Reading a run and a result) | Four-area replay and tests; Fleet day trace | `bay_teaching_map`, `UC-01`, `UC-03`, `full-cycle` | `UC-01` |

**Recommended entry path for newcomers [P].** Add a "Start here" row at the top of the catalog and a matching hero call to action on the overview.
1. `fleet-day`: one whole day, then the capacity comparison. It is the clearest single picture of what moves completed trips (12 to 48 cars: 60 to 197 of 284; 1 to 6 depots: 79 to 111; seed 42) [V].
2. `staffing-readiness`: the cleanest binding-resource contrast. One more worker gives +10 trips and one more bay gives 0, on seed 42 and on all 12 held-out seeds [V].
3. **Guided walkthrough (OPS-01)**: how a paired test with guardrails reaches HOLD even when riders gain.

"Next" row:
- `L2a` then `L2b`: the same runs, and only the declared guardrail changes the call.
- `UC-08a` then `UC-10`: a depot fix that does not reach riders, against one that does (UC-10: -193.0 s, ADVANCE_TO_NEXT_TEST) [V].
- `street-first`: a routing trade-off.

After that, browse by question family.

**Model badges** (one sentence each, all checked):
- "Fleet day: a minute by minute synthetic Bay Area day with batteries, charging and depot work. One replay per setting; comparisons rerun the same demand."
- "Street lab: directed San Francisco streets with finite block queues in 5 second steps. It compares two route rules on one demand."
- "Four-area experiments: four schematic zones over a day and a night, with no charging. Each lesson is a frozen paired test on 20 seeds."
- "Fleet day also hosts separate contracts: staffing, charging, charger status, airport wave, launch rehearsal and the Austin power lab."
- Shown once on the catalog and in every limits disclosure: "Each model has its own assumptions, so numbers from different models are not interchangeable."

**Naming (OD-T5) [P].** The model's reader-facing name is "Four-area experiments", with two modes: "Explore a day" (the `#/regional` view) and "Run an A/B test" (the `#/experiments` view). "Open regional example" becomes "Run this lesson". Routes, route keys and lesson ids stay unchanged, and no test pins the nav strings being renamed [V, grep of `test/`].

### 11.5 Copy rules and content architecture

#### 11.5.1 Exact rule lists (copied from the checkout) [V]

- **H-3 banned words** (`tools/check-dist.mjs:67`): `/\b(predict(?:s|ed|ing|ion|ions|ive)?|forecast(?:s|ed|ing|er|ers)?|expected\s+traffic|live|real[\s-]?time|monitoring)\b/i`.
  - Its only exemption is `SYNTHETIC_FORECAST_COPY` (`:71-76`), four literals allowed only in `src/ui/advanced-operations-view.js` string literals (`:346`).
  - The test copies are `/\b(predict|forecast|live|real-time|realtime|real time|monitoring)\b|expected traffic/i` (`test/labels.test.mjs:313`, `test/app.test.mjs:23`) and `/\b(predict\w*|forecast\w*|…)\b|expected traffic/i` (`test/ops-cases.test.mjs:22`).
- **Dashes** (`check-dist.mjs:77`): `/[\u2013\u2014]/`. New frame copy uses ASCII only: hyphen-minus for negatives (the U+2212 in the shipped D1 Austin sentences is existing copy, left as is).
- **H-6** (`labels.test.mjs:315` = `app.test.mjs:24` = `ops-cases.test.mjs:23`): `/\b(wins?|winners?|beats|scores?|scoring|gauges?|grades?|leaderboards?|revenue|costs?)\b|better option|best configuration/i`. check-dist does **not** apply H-6.
- **H-9 VERDICT_CLAIMS** (`ops-cases.test.mjs:26`): `/\b(improved|regressed|unchanged|inconclusive|advance_to_next_test|run_more_experiments|no_recommendation|hold)\b|\breads? (lower|higher|no change)\b|\bguardrails? (within|regress)|\bas OPS-\d\d shows\b|\bis expected to\b|\bthe harm\b/i`.
- **H-9 DIRECTION** (`test/captions.test.mjs:19`, `test/present.test.mjs:52`): `/\b(lower|higher|unchanged|more|fewer|less|rises?|rising|falls?|falling|longer|shorter|slower|faster|increases?|increased|decreases?|decreased|grows?|drops?|up|down|above|below|better|worse)\b/i`.
- **House words (shared with §12's house rule):** `/\b(should|prove[sn]?|guarantee\w*|safe|safety|monitor\w*)\b/i` applies to every proposed on-page string in §11 and §12. This is a copy rule of this document, not a regex in the checkout; the new `teaching-frames.test.mjs` test 3 enforces it. The `ops_takeaway` list in 11.3.5 rule 3 is wider and also bans "must" and "shows that".
- **Scope today:**
  - `check-dist` scans the string literals of the 23 `COPY_MODULES` (`check-dist.mjs:40`) and the rendered visible text plus `aria-label`, `aria-description`, `aria-roledescription`, `title`, `alt` and `placeholder`.
  - VERDICT_CLAIMS runs only on OPS records.
  - DIRECTION runs only on captions and walkthrough strings.

**Traps found in drafts [V]:**
- "hold fixed", "can hold" and "HOLD" trip `\bhold\b`.
- "pick up" and "set up" trip DIRECTION (`up`); write "pickup".
- "write it down" trips `down`.
- "faster", "more" and "fewer" are fine in `what_why`, but not in part 3.
- "cost" and "grade" (as in "decision-grade") are H-6.
- "forecast" appears in policy identifiers. OD-10's arm names keep it out of visible text.

**Compliance of this section [V].** `teaching-review/fix-round/round2/check11r2.mjs` parses this section and applies every regex above to its 208 proposed on-page strings: 21 frames, intros, labels, chips, family names and family questions, maps, next-test lines, run-line rule strings, glossary, badges, filled examples, the UC-01 change line and the casebook reading filled for sets 1 to 3. Every string also gets the shared house words. Frame fields also get VERDICT_CLAIMS and the engine-id regex, and part 3 also gets DIRECTION, the digit rule, the prefix and verb rule (11.3.5 rule 1), the rule 3 words and the caps; claimed lengths are compared with measured ones. Filled run-line examples are also checked for a lowercase sentence start and the old double colon, and the section for the old Launch default line number (the default is at `launch-view.js:56`). A mutated copy (a "Should" W, a lowercase guardrail clause, the old INCONCLUSIVE colon, "FleetLab harness", the old line number, a wrong reading length) gives 8 problems, so the checks fire. The earlier `section11/check.mjs` checked only the prefix, not the verb, so it passed a line that used "use". Result: 0 problems, all ASCII, no personal data or home paths. What is not covered: verifier-corrected strings in the lane files. Those pass the H-3, H-6 and dash lists (per their verifiers), but not every lane applied VERDICT_CLAIMS or DIRECTION, so T1 must run the new test on them.

#### 11.5.2 COPY_MODULES changes [P]

**T1.1 is UI-layer only.** T1 changes no `src/model` file, so every model-origin leak is fixed where it is rendered, and the rendered-text test covers what the static scan cannot see. Running check-dist's own `literalsOf` over the candidate modules [V, `teaching-review/critic-s11-s12/lit.mjs`, re-run 2026-09-26] gives:

| Module | `literalsOf` problems today | T1 action |
|---|---|---|
| `src/ui/teaching-frames.js` | new | **Add** to COPY_MODULES. It holds almost all new copy. |
| `src/model/street-simulation.js` | 0 of 149 literals | **Add** (OD-T4). It is clean, so adding it edits only `tools/check-dist.mjs`. |
| `src/model/launch-contract.js` (`:25`, `:29`: en dashes in validation messages) | 2 | Not added. Map each message to a clean display string at render. |
| `src/model/bay-experiment-contract.js` (`:60`, `:62`: en dashes in RangeError text shown as "Experiment unavailable"; `:27`: the literal `forecast`, a policy id that feeds the airport spec digest) | 3 | Not added. Map the error text at render. The policy id is never shown; the OD-10 arm names label it. |
| `src/model/launch-rehearsal.js:19` ("Region B [em dash] synthetic", the `region.label` inside the launch config object) | 1 | Not added. Map the region label at render. Editing it at source is a config change, not a copy change. |
| `src/model/bay-operations.js` (`:275` assumption text with en dashes; `:279` assumption text containing "forecast"; `:97` the state label "Forecast preparation"; the policy literal `forecast`) | 4 | Not added. Map both assumption texts and the state label at render; the policy id is never shown. |
| `src/ui/experiment.js` | 0 of 911 | Not added in T1. Its rendered verdict card and situation block are covered by `copy-surfaces.test.mjs`. |
| `src/ui/learn.js`, `src/ui/present.js` | 1 each: the object-key literal `aria-live` matches `\blive\b` | Not added in T1. Adding them first needs check-dist to skip attribute-name literals (`aria-*`), recorded as its own tool change. Their rendered text is covered by `copy-surfaces.test.mjs`. |

**T1.1 work, in the UI layer:**
1. **Display map for model-origin text.** One function in `src/ui/` turns each known model message (the four validation and error strings, the region label, the two assumption texts, the "Forecast preparation" state label) into a clean display string at render. Its fallback turns an en dash between numbers into " to " and any other en or em dash into ", ". The model strings and every digest stay as they are.
2. **Runtime label maps**, because the static scan cannot see runtime-built labels:
   - `record()` keys: show "Port-minutes of status error" for the key at `bay-systems.js:11`.
   - Policy options: use the OD-10-style arm names.
   - The changed-axis line: "Changed setting: airport preparation, reactive to staged".
3. **`test/copy-surfaces.test.mjs`** scans rendered text (11.5.4), including one invalid launch setup and one invalid paired-experiment request, so the mapped messages are covered.

**Model literal edits move to T2.** Fixing these strings at source, and adding the four model files to COPY_MODULES, is a T2 item. It must prove that the ops and presets pins and the pinned setup digests (`d1-presentation.test.mjs:31-36`) are unchanged.

#### 11.5.3 One teaching-frame data module [P]

`src/ui/teaching-frames.js` imports only `./dom.js`, and `./labels.js` if needed. Model and runtime modules already cannot import `ui` (`test/boundaries.test.mjs:42-50`), so the module never reaches the worker bundle.

Keep frame text out of `src/model/presets.js` and `src/model/ops-cases.js`. Both pack into the page and the worker, and the measured cost is 2.05 times higher there (11,740 B against 24,086 B for 20 OPS frames) [V]. The casebook rule also keeps lessons off OPS records (`ops-cases.test.mjs:112-118`).

```js
// Plain text only; ASCII punctuation; no en or em dash. Full-line comments cost 0 offline bytes under route A.
const f=(family,evidence,what_why,how,look_for,ops_takeaway,limits=null,kind=null)=>
  Object.freeze({family,evidence,what_why,how,look_for,ops_takeaway,limits,kind});
export const LESSON_FRAMES=Object.freeze({/* 56 keys = simulationCatalog() ids */});
export const SURFACE_FRAMES=Object.freeze({/* day, street, workbench, four-area, walkthrough, regional-power;
  staffing, charging, deadlines, resources, airport (these five alias LESSON_FRAMES entries);
  launch (own how for the Peninsula default, region-launch strings otherwise); reference-panels;
  one key per situation preset: preset:balanced, preset:charging, preset:resources, preset:airport,
  preset:staffing (aliases), preset:rain, preset:depot, preset:power (own text); 11.3.10 */});
export const GLOSSARY=Object.freeze({/* 11.3.6 */});
export const OUTCOME_WORDS=Object.freeze({/* 11.3.4 maps */}), NEXT_TEST=Object.freeze({/* 11.3.4 */});
export const CASEBOOK_READINGS=Object.freeze({/* OPS-01..OPS-20: {labels:[set1,set2,set3], outcome, recommendation,
  template}; the template uses the 11.3.4 slot legend ({set}, {primary:u}, {gN:u}, {b.<metric>:u}, {c.<metric>:u}),
  holds only clauses true on all three sets, and each slot reads the reader's verdict: the seed set, the primary mean
  delta, a guardrail harm, or a stored descriptive's baseline or candidate value. Declared settings the same on all
  three sets (such as an allowance) may be static. Wording: 11.3.4 for OPS-01, Appendix B.8 for OPS-02..OPS-20;
  T1.7, OD-T1 */});
export function frameView(frame,view){/* section.teaching-frame: chips, three parts, limits details */}
export function runLine(frame,result){/* generated line + next test; 11.3.4; no new metrics */}
```

**What moves into the module:**
- the 7 `decisions` in `scenario-learning.js`, which are deleted there (`decisionForConfig` keeps returning surface keys);
- the catalog's five fields;
- the four surface intros (`studio.js:197`, `:202`, `:205`; `street-lab.js:56`), with two constraints: the model identity header built at `studio.js:147` ("Schematic four-area Bay Area zones ...; not road geometry") stays inside `.workspace-intro`, and one Run button stays inside `.street-intro` (both test-pinned; 11.5.4);
- the extension limits.

**What stays where it is:**
- OPS records (situation, proxy, watch, outsideModel), shown behind the case disclosure;
- `STREET_PRESETS` titles and questions;
- `LEARN_LOOK` and `LEARN_FINDINGS` (`labels.js:1728`, `:1746`; fixture-asserted by `captions.test.mjs:116-136`);
- the Austin verdict sentences pinned by `regional-power-d1.test.mjs`;
- the design §1.3 exact-copy strings in `labels.js:31-35` (verdict footer, axis tag, FLEET-005 and probe panel chips).

**Grounding sidecar (ships 0 bytes).** `test/teaching-frames.grounding.json`, keyed by frame id. Each entry is `{source: run|pin|fixture, command, config_or_patch, seeds, numbers, lane_file}`. A test asserts that every frame id has an entry. The numeric learnings from the lane files live here until they are pinned (T2).

#### 11.5.4 Tests [V baseline, P changes]

**Baseline.** In a full scratch copy of the checkout, `node --test` runs 1,817 tests with 0 failures (2 skipped, 1 todo) [V, architecture verifier]. The earlier "1,593 tests with 40 failures" baseline came from an incomplete copy; do not use it.

**Rewrite:**
- `test/simulation-catalog.test.mjs:14` (the field loop over question, controls, outputs, lesson, limits): loop over the frame fields instead.
- `test/scenario-learning.test.mjs:6-15` (decision fields, and the text "Fleet optimization decision" and "Next experiment"): replace with frame and `runLine` assertions.
- `test/scenario-learning.test.mjs:16-20` asserts that the learning note contains the raw key `terminal_energy_kwh`. The plain-word version shows metric words instead, so rewrite it to assert the words and keep the "no winner, deploy or guarantee" check.
- `test/d1-presentation.test.mjs:21` (`.ops-scenario-learning` closed): only under OD-T2. Replace it with "the frame is visible and precedes `.ops-result-summary`". Keep `:19-20`, `:24` and `:25` unchanged.

These are the only expected breaks. A measured edited copy broke exactly the first two [V].

**Unchanged and must stay green:**
- `test/navigation.test.mjs:14` (56 lessons)
- `test/ops-cases.test.mjs` (record keys; VERDICT_CLAIMS on records; pins)
- `test/regional-power-d1.test.mjs:40-47` (Austin sentences)
- `test/present.test.mjs:151-154` (4 chapters, 11 beats; T1 adds no beat), `:925-930` (the last beat's refusals) and `:978` (`specSentence` arguments): T1 changes no walkthrough structure (OD-T7)
- `test/captions.test.mjs`
- `test/experiment-ui.test.mjs:490` and `test/labels.test.mjs:385` (`RECOMMENDATION_REASONS` keys are kept)
- `test/labels.test.mjs:70` and `:333`: `RENDERED_ROWS` must equal the design §1.3 exact-copy table, and `labels.js:31-35` (verdict footer, axis tag, FLEET-005 and probe panel chips) are rows of it. T1 leaves those values unchanged and adds "Runs in this four-area model only" as a separate element [V]
- `test/street-lab.test.mjs:53-60` clicks `.street-intro button`: keep one Run button inside `.street-intro`; its click moves focus to `.street-results h2` without scrolling
- `test/d1-presentation.test.mjs:47` requires `.workspace-intro` to match `/Schematic four-area Bay Area zones.*not road geometry/` on the operations, depots and tour pages: keep the model identity header (`studio.js:147`) inside `.workspace-intro` when the four-area intros are replaced
- `test/d1-presentation.test.mjs:31-36` (the five pinned setup digests)

**New `test/teaching-frames.test.mjs`:**
1. `LESSON_FRAMES` keys equal the `simulationCatalog()` ids; the `SURFACE_FRAMES` keys are complete, including `launch`, `reference-panels` and one `preset:*` key for each of the 8 situation presets.
2. Caps (11.3.2).
3. H-3, H-6, dashes and the house words (11.5.1) on every string; VERDICT_CLAIMS on all four frame fields; DIRECTION, the digit rule and the prefix plus verb rule (`/^An ops team would (test|check|measure|compare|log|size|map|write|give)\b/`, 11.3.5 rule 1) on part 3.
4. `runLine` on fixture results:
   - IMPROVED with a guardrail HOLD;
   - HOLD from a regressed primary with no guardrail;
   - HOLD with 3 REGRESSED guardrails, taken from the OPS-17 or OPS-19 set 1 pins, which must come out in the overflow form of rule 11;
   - a condition-test HOLD with 2 REGRESSED guardrails (OPS-06 or OPS-11 set 1), which must keep "this condition harms service" after the overflow steps;
   - a seconds primary with a margin of 60 s or more and a nonzero delta under 3 s (OPS-11 set 1, -1.3 s), which must render in seconds and never as "0.0 min";
   - UNCHANGED; INCONCLUSIVE; a NOT_EVALUABLE guardrail; INVALID; one-seed; replay with nulls.

   Each output is at most 240 characters and passes H-3, H-6, dashes and the house words. It never contains "null", "undefined", "NaN", ": not decided:" or a float with more than 2 decimals, never shows a nonzero recorded value as zero, starts every sentence with a capital letter or a digit, and never names a guardrail whose status is not REGRESSED. A second loop runs `runLine` on all 60 pinned casebook verdicts (20 cases, sets 1 to 3) and asserts the 240 cap on each.
5. `CASEBOOK_READINGS`, for each of seed sets 1, 2 and 3 separately: the set's label, outcome and recommendation equal `test/ops-cases.pins.json`; the reading filled from that set's pinned verdict has every numeric slot equal to that set's pinned value after formatting; every static clause holds on that set (for example "fell" needs a negative mean delta); every static declared number (such as OPS-01's 30 min allowance) equals that set's pinned `max_harm` or margin; no slot fills a nonzero value as zero; and the filled text is at most 240 characters. Extend `assertPinned` to cover any descriptive a reading cites, because it does not compare descriptives today [V].
6. Every frame id has a grounding entry.
7. Negative gate: a fixture verdict whose frozen label matches none of the case's three pinned labels, or whose outcome or recommendation differs from the pinned set, renders no "Casebook reading" element.

**New `test/copy-surfaces.test.mjs`.** Mount on the fake DOM, after fixture runs where a surface has one: Fleet day (with each situation preset), Street lab, the catalog, readiness, launch (both templates, plus one invalid setup), Austin, the advanced view (plus one invalid paired-experiment request), the four-area workbench with its reference panels, the four-area workspace, the Overview, Product approach and the walkthrough. Apply H-3, H-6 and dashes to all rendered text, and VERDICT_CLAIMS to the pre-run `.teaching-frame` part text. This closes the H-6 gap from R11 and covers the model-origin strings that T1.1 maps at render.

#### 11.5.5 Byte estimates under route A (DECIDED) [V measured, I estimated, P budget]

Measurements come from the architecture lane's scratch packs (`node tools/pack.mjs --out`). The verifier rebuilt each variant byte-identically. Baseline: 2,551,878 offline bytes; current headroom 69,562 (`APP_MAX_BYTES` 2,621,440).

| Item | Bytes | Tag |
|---|---:|---|
| (a) 56 lesson frames replace the 5 catalog fields | +31,057 | V |
| (b) 12 surface frames replace the decisions and 4 intros | +2,204 | V |
| (c) run-line generator; only 1 call site actually wired | +2,390 | V |
| (a)+(b)+(c) at typical / at maximum lengths | +35,651 / +40,931 | V |
| (d) 20 casebook readings (typical / maximum) | +5,726 / +5,726 | V |
| Subtotal measured, typical / maximum | **+41,377 / +46,657** | V |
| Same text placed in `ops-cases.js` (for contrast) | +47,997 for (a)+(b)+(c) | V |
| Remaining call sites (Fleet day replay, capacity, mix, readiness, launch, Austin run and compare, Street single and compare, four-area card) | +2,500 to +4,000 | I |
| Glossary (18 entries, 1,876 B raw) plus rendering | about +2,300 | I (raw measured) |
| Plain-word maps and next-test lines (985 B raw) | about +1,200 | I (raw measured) |
| Chips, family filter, "Start here" row, model badges | about +1,500 | I |
| Deep-link plumbing and the "Setup changed" note | about +1,200 | I |
| CSS for the frame, chips and 400 px stacking | +2,000 to +3,000 | I |
| Extension-lesson limits carried into frames (the measured variants dropped them) | +729 | V |
| Surface frames added in the fix round: `launch` (own H; W, L and O reuse the `region-launch` strings), `reference-panels`, `preset:rain`, `preset:depot`, `preset:power`, plus 5 preset alias keys (2,547 B of new raw text) | about +3,000 | I (raw measured) |
| **Estimated total** (measured subtotal plus 14,429 to 16,929 unmeasured) | **about 55,800 to 58,300 typical; about 61,100 to 63,600 at maximum lengths** | I |

With the fix-round frames, the maximum-length projection reaches the 61,440 stop, so plan on trim 2 below from the start and hold four-area text near trim 1's 80% of caps.

**Budget (OD-T3) [P].** Register package **T** in the OD-2 table with a **stop budget of 61,440 bytes (60 KiB)**, CSS included, and a working target of 53,248 (52 KiB). Measure again after every T1 work item.

**This budget is canonical.** §12 and Appendix B cite it ("package T, stop 61,440 B, target 53,248, per §11.5.5") and set no budget of their own; a 48 KiB stop would leave only about 2.5 KB at maximum lengths. The estimate above covers only the 20 OPS readings (item d, 5,726 B, measured as static text; stored as templates with slot names they are expected to stay close to that [I]). **T1 ships no non-OPS pinned readings.** Readings for the 36 non-OPS lessons are T2; each needs its own pins and its own byte line in OD-2 before it ships.

**Planned trims, applied in order if the projection passes 61,440:**
1. Hold four-area `how` and `look_for` to about 80% of their caps. Frame text averages about 540 B raw per frame [V].
2. Derive the four-area `how` from `differenceText`, saving up to about 6 KB [V estimate from the architecture lane].
3. Defer T1.7 readings (5,726 B).

**Placement against the other budgets.** Route A gives 370,038 of headroom [V]. The OD-2 plan uses 135,904 [V, §4.6]. After T's stop budget, 172,694 remain unassigned. Without route A, T alone would fit in today's 69,562, but it would leave about 6,000 to 13,800 bytes, and N2's 135,904 could not fit at all. So T1 lands after the route A packer change. Under route A, full-line comments in `teaching-frames.js` cost 0 offline bytes.

### 11.6 Implementation slice T1 "teaching frame" (presentation-only)

**Scope.** T1 adds the three-part frame, the generated after-run line, the deep-link contract, the copy-gate fixes and the comprehension defect fixes. It changes no model code, no lesson patch, no preset or spec, and no route. It adds no lesson and keeps the 56 lesson ids.

**Dependencies:**
- The route A packer change has landed and the budget table has been re-measured (§9.1 step 2).
- OD-T3 is registered in OD-2.
- T1 touches `operations-lab.js`, so land it before X1 edits that file, or rebase X1 on T1 [P].
- N2's S5 later reuses `frameView` and adds `SURFACE_FRAMES['event-curb']` from the N2 verifier's corrected copy. S5 stays after S4 (OD-19).
- Only T1.7 waits on OD-T1. T1.5 waits on OD-T2 for Fleet day only.

**Ordered work items:**

| # | Item | Main files | Output |
|---|---|---|---|
| T1.0 | Re-baseline | none | Full serial PERF `node --test` green (the D1 record: 1,827 tests, 1,826 pass, 1 existing TODO; re-baseline after Task 2); `check-dist` OK; pack bytes recorded |
| T1.1 | Copy-gate hardening, UI layer only (11.5.2) | `tools/check-dist.mjs` (COPY_MODULES gains only `src/ui/teaching-frames.js` and `src/model/street-simulation.js`), a `src/ui/` display map for model-origin text, `street-lab.js:61,:140`, `launch-view.js:20`, `readiness-view.js:35`, `advanced-operations-view.js` label maps, `test/copy-surfaces.test.mjs` | Two modules added; model-origin strings mapped to clean display text at render; H-6 leaks fixed in UI files; rendered-text test green; no `src/model` file changed, so every digest is unchanged by construction |
| T1.2 | Frame module skeleton | `src/ui/teaching-frames.js`, `test/teaching-frames.test.mjs`, grounding sidecar | Schema, `frameView`, `runLine`, maps, glossary; tests green with the exemplar frames (11.3.10) and placeholders marked `not available: frame pending` |
| T1.3 | Catalog migration | `simulation-catalog.js`, its test | Cards render the frame; family filter first; "Start here" row; one call to action; plain change text; plural fix; limits disclosure |
| T1.4 | Deep-link arrival | `studio.js:212-248`, `operations-lab.js:172`, `street-lab.js:89`, `learn.js` | The 11.3.8 contract |
| T1.5 | Surface headers | `operations-lab.js:59,:167-169` (OD-T2), readiness, advanced, `launch-view.js:64`, `regional-power-view.js:109-121`, `street-lab.js:56,:73`, `studio.js:39-72,:94,:197,:202,:205`, `experiment.js:1125-1150`, `labels.js:500,:682,:1084` (not `labels.js:31-35`, which are design §1.3 exact copy) | Visible frame before every Run control; casebook disclosure reorder; case-aware header; the model identity header stays in `.workspace-intro` and a Run button stays in `.street-intro`; walkthrough: intro h1 and paragraph only (OD-T7) |
| T1.6 | After-run line and defects | every call site in 11.3.3; `renderVerdictCard` adds a section and `tradeOffSentence`; `launch-view.js:36`; `advanced-operations-view.js:75`; `street-lab.js:116,:137`; `operations-lab.js:117,:219,:272`; walkthrough Next contrast; "Exact values" disclosures | Generated lines everywhere; enums, keys, floats and version strings moved to "Exact values"; the defects in 11.1 fixed; `full-cycle` preselects the first car with a ready event (car-7 at seed 42 [V]; check whether an operations-lab test pins the car-1 default [I]) |
| T1.7 | Casebook readings (OD-T1) | `CASEBOOK_READINGS`, pins test extension | 20 reading templates (11.3.4), each at most 240 characters once filled on each of sets 1 to 3, with numbers filled from the reader's verdict; gated on label and verdict match; 16 of 20 pinned lessons exceed 240 today and must be shortened [V] |
| T1.8 | Content fill | `teaching-frames.js`, sidecar | 56 lesson frames and every `SURFACE_FRAMES` key in 11.5.3 (the 12 base keys, `reference-panels` and the 8 `preset:*` keys), written under the copy precedence rule below, each with a grounding entry |
| T1.9 | Gates | none | Full tests, `check-dist`, pack bytes, a 400 px and keyboard pass, a contrast check, and a live check of 6 deep links (acceptance 1 to 11) |

**Acceptance criteria (measurable):**
1. 56 of 56 catalog cards render the three parts with non-empty fields.
   - 0 cards whose part-3 text equals the case situation or the street action.
   - 0 part-3 strings duplicated across cards.
   - 0 visible matches on cards for engine ids. The regex is `/parameter:|policy:|\b(SUP|DEP|RD|DEM|POL|RID)-\d|\b[a-z]+_[a-z_]+\b|\b[a-z]+\.[a-z_]+\d*_s\b/`; depot ids such as SF-1 are allowed. It runs on card text with the 56 lesson ids removed first: the card's meta row shows the lesson id (`simulation-catalog.js:69`), and `bay_teaching_map` matches `\b[a-z]+_[a-z_]+\b`. On the proposed copy that id is the only match [V, `teaching-review/critic-s11-s12/engid.mjs`].
   - 0 cards that say "1 guardrails".
2. Every lesson and surface frame string passes the checks in 11.5.4 test 3 and the caps (100%).
3. For each of the 56 ids, arriving at its deep link on the fake DOM:
   - the frame title equals the lesson title;
   - the frame precedes the first Run control in DOM order;
   - the select does not read "Custom or shared setup".

   Live checks at 1280x800 and 400x800: the What & why text is visible without scrolling on `fleet-day`, `cleaning`, `street-lombard` and `OPS-07`; on `region-launch`, focus lands on the launch panel heading.
4. At most 130 words from the h1 (or panel heading) to the named Run control on every surface, counted on the fake DOM, with the frame as the only prose there. Count only visible prose (headings, paragraphs, list items, `dt` and `dd`) outside closed `details`, form controls (labels, inputs, selects, buttons) and tables. The named control per surface:
   - Fleet day: "Run fleet day" (`operations-lab.js:66`); staffing: "Compare staffing and bays"; advanced paired view: "Run paired policy experiment";
   - Launch: "Rehearse commissioning delay" (`launch-view.js:62`), counted after "3. Validate setup" has passed, so the check table is excluded;
   - Austin: "Run Austin shift" (`regional-power-view.js:118`);
   - Street lab: the one Run button inside `.street-intro`;
   - four-area workbench: "Freeze and run"; four-area workspace: "Run window"; walkthrough: "Prepare"; Overview: the hero call to action.

   A surface not listed names its control in the T1.9 report before the count runs. Exactly one enabled primary button on Fleet day.
5. Every run surface renders "What this run shows" after a fixture run. The fixture set in 11.5.4 test 4 passes, and no raw enum is used as a heading.
6. The only tests that change are the ones listed in 11.5.4. `navigation.test.mjs:14` still asserts 56. `ops-cases`, `regional-power-d1`, `present` and `captions` stay unchanged and green. The full suite is green.
7. Pack bytes grow by no more than 61,440 against the post-route-A baseline, and `check-dist` reports 0 problems.
8. No en or em dash, H-3 word or H-6 word appears in the rendered text of any mounted surface, and no VERDICT_CLAIMS match appears in pre-run frame text. `copy-surfaces.test.mjs` checks this on every surface listed in 11.5.4, including the Overview, Product approach, the walkthrough, the four-area workspace and the reference panels.
9. No horizontal scroll at 400 px: on every surface and on the catalog, `document.documentElement.scrollWidth <= document.documentElement.clientWidth` at a 400x800 viewport (live check), and nothing in a frame is truncated.
10. The walkthrough's disabled Next label has a contrast ratio of at least 4.5:1 against its background, measured from computed colors in the live check.
11. Negative casebook gate: for every OPS case, a fixture verdict whose frozen label matches none of the three pinned labels, or whose outcome or recommendation differs from the pinned set, shows no "Casebook reading" element (11.5.4 test 7).

**Stop conditions:**
- A frame sentence needs a number that no run, pin or fixture supports: drop the clause, never estimate it.
- The byte projection passes 61,440 after all three trims: stop and report.
- An item needs a model edit, a patch or preset change, a spec digest change, a new metric, or aggregation over frames or logs: move it to T2 and continue.
- A pinned reading cannot be matched to a label, or OD-T1 is not recorded: skip T1.7.
- A test outside the list in 11.5.4 must change: stop and ask.
- The D1 result-first order or the single-primary-button assertion would break: stop.
- Any change would alter the lesson count or a lesson id: stop (that belongs to T2 or S5).

**What T1 must not do:**
- invent or estimate results;
- show exploratory or unpinned numbers in static copy;
- compute new measures in the UI;
- add routes, lessons or presets;
- change lesson patches, presets or specs;
- touch model logic;
- raise `APP_MAX_BYTES`;
- use "recommendation" as a part label;
- show a pinned casebook reading before a matching run;
- present a teaching result as real-world advice.

**T2 candidates (outside T1; each needs owner approval and, where noted, new pins) [P]:**
- **Lesson setup fixes** in `simulation-catalog.js`:
  - `rush-hour` on one axis (`peak_multiplier` 2.4);
  - `bay-area` contrasts SF and SFO;
  - `vehicle-mix` opens the mix comparison;
  - split the `cleaning` bundle, simplify `shared-power`, align it with "More ports, limited power".

  Each change alters that lesson's results, so re-ground it first.
- **A "Compare with the regular day (same seed)" action** for single-axis Fleet day lessons.
- **New model metrics, each with a test and a version-pin check:**
  - `vehicle_minutes_by_activity`, accumulated in the minute loop and independent of capture;
  - Street stuck-versus-working minutes, and the top off-corridor queues;
  - paired mechanism descriptives through `descriptiveNames` plus `bayMetricMap`;
  - an SF-1 bay-wait row for UC-08a (changes its spec digest).
- **Pinned findings for non-OPS lessons**, following the `test/ops-cases.pins.json` pattern.
- **Pin exploratory variants, then consider them as lessons:**
  - variants: OPS-02b, OPS-10b, the OPS-12 SF-2 contrast, OPS-19 plus a second service bay, OPS-20 plus a capacity-aware rule;
  - lessons: `demand-ceiling`, `charge-cap`, `visit-cadence`, `busy-depot-binding-stage`, `cleaning-binding`, `redistribution-headroom`, `freshness-window-vs-delay`, two Austin lessons, `street-fleet-share`, `L3b`, the UC-02 ladder, `UC-05b`.
  - Every new lesson changes the 56 pin.
- **Pin four-area readings on at least 3 rider draws**, not only 3 seed sets. L3's direction and UC-08a's call change with the rider draw [V].
- **Pinned readings for the 36 non-OPS lessons.** None ship in T1. Each needs its pins and its own byte line in OD-2 (11.5.5).
- **Model literal edits** (moved out of T1.1): fix the dashes and banned words at source in `launch-contract.js:25,:29`, `bay-experiment-contract.js:60,:62`, `launch-rehearsal.js:19` and `bay-operations.js:97,:275,:279`, then add those modules to COPY_MODULES. Prove the ops and presets pins and the setup digests (`d1-presentation.test.mjs:31-36`) unchanged. The policy id `forecast` (`bay-experiment-contract.js:27`) feeds the airport spec digest, so it needs a check-dist allowlist entry rather than an edit. Adding `learn.js` and `present.js` first needs check-dist to skip `aria-*` attribute-name literals.
- **Walkthrough structure (OD-T7):** a beat 0, chapter renames ("1 What happened" and so on), the chapter 3 reorder (arms beat first), a next-test line on the last beat, the refusals behind a "What this walkthrough leaves out" disclosure, and a `specSentence` built from `differenceText`. These change `present.test.mjs:151-154`, `:925-930` or `:978`.
- **Rewording the design §1.3 exact-copy rows** (`labels.js:31-35`): needs a same-commit edit of design §1.3 and its own OD.

**Copy precedence (canonical for T1) [P].** When sources disagree, T1 uses this order:
1. **§11 owns the contracts:** the component and part labels (OD-T6), evidence chips, condition and decision tags, family names (11.4), the run-line rules, plain-word maps, next-test map and templates (11.3.4), the casebook slot legend (11.3.4), the glossary, the copy rules and house words (11.5.1) and the budget (11.5.5). §12 and Appendix B point to these and never restate a different version.
2. **§11 owns the scope of every change:** T1, T2 or an OD, per the scope above, the T2 list and the OD table below. A §12 page-fix bullet that rewords the design §1.3 rows in `labels.js:31-35`, or that moves the walkthrough refusals behind a "What this walkthrough leaves out" disclosure, is T2 or OD work (OD-T7, and the T2 item for the design §1.3 rows), whatever its §12 label. Under OD-T2 the Fleet day frame replaces the closed Learning notes; the §12.1 lesson banner, a separate element beside them, applies only if OD-T2 is declined.
3. **`what_why` and `how`:** the 11.3.10 string wins where one exists. Otherwise use the Appendix B WW and HOW for that lesson, as corrected in the §12 fix round (VERDICT_CLAIMS applied to every pre-run WW and HOW).
4. **Intro and label copy:** the 11.3.10 intro and label strings (the Overview hero lede, the catalog intro, the walkthrough intro, the Fleet day pre-run summary and the label fixes) win over §12 surface copy for the same element. Generated text never uses "null" for a missing or empty value (11.3.3, 11.5.4 test 4).
5. **`look_for` and `ops_takeaway`:** derive them from the Appendix B LEARN line by the 11.7 split (a direction-free `look_for`, an `ops_takeaway` that follows 11.3.5, and the numbers to the grounding sidecar). Never paste an Appendix B LEARN line into a static field: most carry directions and unpinned numbers, and their "Ops check:" framing does not meet the 11.3.5 prefix rule.
6. **Casebook readings (T1.7):** the slot legend, the fill rules and the OPS-01 reading in 11.3.4 are canonical. For OPS-02 to OPS-20 the reading is the Appendix B.8 LEARN text before "Ops check:", written in that slot syntax and checked by 11.5.4 test 5. Appendix B.8's OPS-01 row repeats 11.3.4; where they differ, 11.3.4 wins.
7. **Numbers:** static frame fields carry setting values only, never result numbers (11.3.2). Pinned results reach the page only through the generated run line or a gated casebook reading. Every other number stays in `test/teaching-frames.grounding.json` as a T2 finding candidate.
8. **Never** reuse a claim listed in 11.8.

**Copy-ready instruction for Codex (T1):**

> Read §11 of FLEETLAB_N2_V2_DESIGN_FEEDBACK.md. After the route A packer change lands and package T (61,440 B stop) is recorded in OD-2, implement slice T1 exactly as §11.6 orders it (T1.0 to T1.9) on a new branch. Treat §11.3 as the component contract (its run-line templates, maps and next-test map are canonical), §11.5 as the copy and test contract, Appendix B as the per-lesson copy source and §11.7 as the rule for splitting it, all under the §11.6 copy precedence rule: §11 decides whether a change is T1, T2 or an OD; §11.3.10 strings win for `what_why`, `how`, intros and labels; `look_for` and `ops_takeaway` are derived from Appendix B LEARN by the §11.7 split; casebook readings follow the §11.3.4 slot legend, with §11.3.4 wording for OPS-01 and Appendix B.8 wording for OPS-02 to OPS-20; never paste an Appendix B LEARN line into a static field, and never reuse a claim listed in §11.8. Keep T1.1 in the UI layer and add only `teaching-frames.js` and `street-simulation.js` to COPY_MODULES. Do not edit model logic, lesson patches, presets, specs, routes or lesson ids. Skip T1.7 unless OD-T1 is recorded. Stop on any §11.6 stop condition and report. Before each commit, run `node --test "playground/fleetlab/test/*.test.mjs"`, `node tools/check-dist.mjs` and the pack byte measurement. Do not push or deploy.

**New owner decisions (defaults recommended [D]):**

| ID | Decision | Recommended default | Gates |
|---|---|---|---|
| OD-T1 | Allow a pinned casebook reading after a run whose frozen label and verdict match the pins. This is H-9 as written; record it in the design doc's "H-9 on the page" paragraph | Yes | T1.7 |
| OD-T2 | Fleet day frame visible at the top, replacing the closed Learning notes (rewrite `d1-presentation.test.mjs:21`; keep result-first order). If declined, the frame renders as a separate element above the Run control (the §12.1 lesson banner), the closed Learning notes stay and `:21` is unchanged | Yes | T1.5 for Fleet day |
| OD-T3 | Package T stop budget 61,440 B (target 53,248) in OD-2 | Yes | T1.0 |
| OD-T4 | Add only `src/ui/teaching-frames.js` and `src/model/street-simulation.js` to COPY_MODULES in T1; map model-origin leaks to clean display text at render; move model literal edits to T2 (11.5.2) | Yes | T1.1 |
| OD-T5 | Canonical names: "Four-area experiments", with "Explore a day" and "Run an A/B test" (routes unchanged) | Yes | T1.3, T1.5 |
| OD-T6 | Part labels "What & why", "How we simulate", "Learning & ops takeaway" | Yes | T1.2 |
| OD-T7 | Walkthrough: T1 changes only the intro h1 and paragraph. A beat 0, the chapter renames, the chapter 3 reorder, a last-beat next-test line, the refusals behind a disclosure and a `specSentence` from `differenceText` are OD-T7 or T2, because `present.test.mjs:151-154` pins the chapter keys and `BEAT_ORDER.length` 11, `:925-930` pins the last beat and `:978` the `specSentence` arguments. Defer them | Yes | T1.5 |

### 11.7 Lesson copy ledger (input for T1.8)

**How to use the lane files.** Each articulation lane wrote a single directional "learn" string with numbers. For T1, split it three ways:
1. A direction-free `look_for` naming the measures.
2. An `ops_takeaway` that follows 11.3.5.
3. The numbers, which go into the grounding sidecar as a finding candidate (T2 pin, or T1.7 for OPS).

When a verifier's corrected string exists, it replaces the lane string.

**Per-lesson source.** Appendix B (§12) collects the verifier-corrected WW, HOW and LEARN for every lesson id, so it is the per-lesson copy source for T1.8, and the lane files below are its grounding trail. Apply the same three-way split to each Appendix B LEARN line, and follow the copy precedence rule in 11.6: an 11.3.10 string wins over Appendix B, and no Appendix B LEARN line is pasted into a static field. Appendix B LEARN lines are source and after-run text, so passing DIRECTION is not their contract (an earlier B.10 `event-curb-staging` line tripped it). Each derived `look_for` must pass DIRECTION and the digit rule on its own (11.5.4 test 3). The casebook LEARN lines are also the per-case reading templates for OPS-02 to OPS-20 (11.3.4).

**Sources:**
- Fleet day core: `fleet-core-verify/copy.mjs`, plus the verdict texts
- Depot work: `depot-work-verify/copy-fix.json`
- Depot experiments: the verdict texts
- Austin and launch: the verdict texts
- Street: `street-verify/corrected-copy.json`
- Four-area: `four-area-learn-exp-verify/corrected-copy.json`
- Casebook: `casebook-1-verify/corrected.json` and `casebook-2-verify/corrected.json`
- Framing: the verdict texts in `framing-verify`
- N2: `n2-planned-verify/corrected.json`

Evidence codes: R = replay, S = one seed, same demand, P20 or P12 = paired with that many seeds.

| id | Family | Ev. | Must apply before shipping (verifier corrections) | Finding status |
|---|---|---|---|---|
| bay-area | Roads | R | The patch `{}` equals the default; `how` names the SF and SFO button. Confound: SF-SFO trips are 22 km | T2 pin (+17.4 trips over 11 seeds; charger queue 13.6 to 53.7 min) |
| vehicle-mix | Supply | S | The patch is a no-op, so name the Compare action. Depot-time gap comes mainly from recharge energy, not cleaning or upload factors | T2 |
| fleet-day | Supply | S | "No tested depot count (1 to 6)"; trips per car fall from about 48 cars on | T2 (default partition pinned) |
| weather-day | Demand | R | Rain = travel x1.3, energy x1.12, demand x1.12; the demand is not the same as the regular day; fix the chip | T2 (travel alone -13.4 trips, 11 seeds) |
| rush-hour | Demand | R | Two settings change; `start_hour` 16 alone changes nothing (11 of 11 seeds). Setup starts at 65% charge, not "charged" | T2, after the patch fix |
| depot-count | Depot | S | The 95% target is fixed; "none meets it" is a valid answer; each site bundles bays, ports and power | T2 |
| cleaning | Depot | R | Two changes; the loss comes from cadence (mostly extra depot drives), not bays | T2 |
| charging | Energy | R | Site power binds (120 kW over 4 ports = 30 kW); more ports under the same cap lost trips in 8 of 10 seeds | T2 |
| shared-power | Energy | R | `charger_kw` 80 is inert; energy delivered is about 390 kWh at 2, 4 or 8 ports | T2 |
| software | Depot | R | Duration alone changes nothing; every-2nd-visit exactly equals the default because no 2nd visit finishes within 8 h | T2 |
| upload | Depot | R | The loss is mostly transfer time (30 min alone -4.9 trips) | T2 |
| full-cycle | Reading | R | Preselect the first car with a ready event (car-7); cadence trades trips for end-of-day energy, never "tomorrow" | T2 |
| staffing-readiness | Depot | S | "Caps the day near 32%" refuted (8 workers and 8 bays: 96 of 179); M1 has no shifts | T2 (seed 42 and 12 seeds: +10 and 0) |
| power-redistribution | Energy | P12 | Unfinished energy 610 to 660 kWh against a 480 kWh window ceiling (seed 42) | T2 (repo `tools/demo-depot.mjs` digest) |
| deadline-charging | Energy | P12 | Deadlines are visit start +45, 90 or 135 min; serial power fill; missed deadlines rose | T2 |
| resource-freshness | Energy | P12 | The outage does bind (23.0% vs 20.1%); a rejected try costs no time | T2 |
| airport-preparation | Demand | P12 | On time = car arrival, not boarding; staging runs in minutes 70 to 120; -23.7 kWh = +18.0 consumed and -5.7 charged | T2 |
| region-launch | Launch | S | Net late-to-missed only (10 late became missed, 5 missed became late); on time = one first trip per car | T2 |
| street-first | Roads | S | Volume-driven (38 finished with no incident, 46 at half traffic); about 63% of background traffic runs on 1st Street | T2 |
| street-harrison | Roads | S | At 24 AVs the detour moves AVs, not the queue; ops line uses test framing | T2 (fleet-share holds on 3 seeds) |
| street-stockton | Roads | S | The incident interacts with traffic (44 / 46 / 31); drop the 25% claim | T2 |
| street-van-ness | Roads | S | Supply-limited; 30 OSM turn restrictions apply | T2 |
| street-embarcadero | Roads | S | "Routing helps little" (+1 to +6), not "cannot help" | T2 |
| street-lombard | Roads | S | Hyde gateway trips are SFO-bound; crooked links run at 40.2 km/h; `peak_queued` is a network total | T2 |
| bay_teaching_map | Reading | R | At sigma 0.15 the same riders give 0.58% unserved; the 4.03% came from UC-01's different riders | T2 |
| L1 | Demand | P20 | Condition test; "same declared total" (counted totals differ) | presets pin (verdict only) |
| L2a | Depot | P20 | "For lack of cars" refuted (20 more San Jose cars: -554 s) | presets pin |
| L2b | Depot | P20 | Show next to L2a | presets pin (HOLD from SJ-1 guardrail) |
| L3 | Recall | P20 | IMPROVED on this rider draw only; the robust part is that SF-2 gets no visits; ties go by depot id | presets pin (sets 1 to 3); draw caveat required |
| UC-01 | Reading | P20 | The baseline gap comes from the rider draw, not travel variation | presets pin |
| UC-02 | Supply | P20 | Morning peak only; size varies by rider draw | presets pin |
| UC-03 | Reading | P20 | none | presets pin |
| UC-05 | Roads | P20 | Condition test; the baseline is free flow x1.0, not the map's evening | presets pin |
| UC-08a | Depot | P20 | SF-1 queue halved (log-derived); other rider draws read INCONCLUSIVE | presets pin |
| UC-08b | Depot | P20 | none | presets pin |
| UC-10 | Depot | P20 | SF-2 gets no visits under the rule | presets pin |
| OPS-01 | Supply | P20 | Depot parking is modeled | T1.7 eligible |
| OPS-02 | Recall | P20 | The p50 covers about 22 riders | T1.7 |
| OPS-03 | Recall | P20 | HOLD on 3 of 4 other rider draws: add a caveat | T1.7, with caveat |
| OPS-04 | Recall | P20 | The direction changes with the rider draw; availability is a share of the whole fleet | T1.7, with caveat |
| OPS-05 | Launch | P20 | none | T1.7 |
| OPS-06 | Launch | P20 | Condition test | T1.7 |
| OPS-07 | Launch | P20 | The last queued car starts at 03:30 with 1 bay, 01:24 with 3 bays; "no clear rider benefit" | T1.7 |
| OPS-08 | Launch | P20 | The primary reads REGRESSED on 3 of 4 other draws; SF-1 wins ties by id | T1.7, with caveat |
| OPS-09 | Demand | P20 | State the pinned HOLD reason (whole-run unserved) | T1.7 |
| OPS-10 | Supply | P20 | "About twice the dry day" (ratio 2.1 to 2.5 across sets) | T1.7; the dry-day clause needs the OPS-10b pin |
| OPS-11 | Depot | P20 | About half the visits fall in the recall window, not "most"; condition test | T1.7 |
| OPS-12 | Depot | P20 | The SF-2 contrast is exploratory; keep it off the page | T1.7 |
| OPS-13 | Demand | P20 | Only pickups by cars already in SF pay the curb time | T1.7 |
| OPS-14 | Demand | P20 | Day 1 peaks and the day 2 morning only; name both guardrails | T1.7 |
| OPS-15 | Demand | P20 | Drop the exploratory served split from the page | T1.7 |
| OPS-16 | Demand | P20 | Day 1 only; 5 to 6 in 100 | T1.7 |
| OPS-17 | Roads | P20 | Drop the evening clause until pinned | T1.7 |
| OPS-18 | Supply | P20 | Drop the day 1 clause until pinned | T1.7 |
| OPS-19 | Depot | P20 | Availability from 06:00 to 07:00, not "06:00 readiness" | T1.7 |
| OPS-20 | Depot | P20 | A turned-away car goes to the nearest depot with a free stall | T1.7 |

**All four-area and casebook rows, plus the surface How:** each case keeps one fixed rider draw, so seeds vary travel times only [V, `world.js:225`]. The run window is day 1 05:00 to day 2 10:00; evening knobs never reach day 2's evening.

**`kind` for casebook and four-area frames.** The ledger marks L1, UC-05, OPS-06 and OPS-11 as condition tests. OPS-09, OPS-13, OPS-14, OPS-16 and OPS-17 also change a condition nobody chooses (rain, crowds, an event, a closure); R9 names OPS-14 among them. T1.8 sets `kind` for each of them in its frame and records the reason in its grounding entry [D]. The run-line cap holds either way (11.3.4 rule 11).

### 11.8 Claims refuted or corrected during verification (do not reuse)

- Fleet day "find the resource that held those cars before adding fleet" is refuted. In the default day, 12 more cars add 52 completed trips, while tripling every depot resource adds 17 (seed 42) [V].
- The default Fleet day is an 8 hour window from 07:00, not "one day".
- M1 has cleaning workers and no shifts.
- Depots leave for charging on an energy-blocked trigger too: 2 of 29 visits at seed 42, 9 of 28 in heat.
- "The fleet's capacity is its cars minus the depot path" is refuted: empty pickup driving (41.6%) takes more car time than the depot path (33.8%).
- "Unannounced changes drive 3 of 6 depot lessons" is refuted: the unannounced change is the whole effect only in `cleaning`.
- Visit cadence is not the largest depot lever: charging power alone adds +25.5 trips [V].
- "Freshness failed ports were not binding" is refuted (no outage: 23.0% vs 20.1%).
- The draft run-line generator named guardrails on a HOLD from a regressed primary, and counted NOT_EVALUABLE guardrails as within. Both are refuted.
- Austin: most lost trips come from requests made after power returns, not during the cut. The deadline policy fills power serially, so the "about 15 kW each" explanation is wrong. The 240 kW contrast raises both depots for the whole shift.
- Street: removing the incident changes completions by -1 to +2, not -2 to +1. Van Ness is supply-limited, not street-limited. "Largest road queue" is a network total.
- Four-area:
  - L3's IMPROVED does not hold across rider draws.
  - UC-05's baseline is free-flowing highways.
  - "Travel variation raises unserved from 0.50% to 4.03%" is false.
  - "The only surface with paired tests" is false.
- Casebook:
  - OPS-07's clock times measured the last arrival, not the last queued car.
  - OPS-10b does not share SF riders with OPS-10.
  - OPS-13 "every SF pickup" is wrong.
  - Recall and release semantics were misdescribed.
  - The verdict card has no trade-off section today.
- UC-08a "capacity where it does not bind" is misgrounded: SF-1's queue did shrink, and riders did not feel it.
- N2: the approach cap, not berths, limits the TOY. The timing order reverses at patience 60. ADVANCE needs the whole interval above +2 points.
- Test baseline: 1,817 tests with 0 failures, not 1,593 with 40. COPY_MODULES is at `check-dist.mjs:40`, not `:38`. The worker copy costs about 7% more from JSON escaping, not 5%.

## 12. What each simulation teaches

This section explains every FleetLab simulation surface in three parts:

1. **What & why:** the fleet-operations question, and why an operator would care.
2. **How we simulate:** the model mechanics in plain language, what changes, what stays fixed, and what is synthetic or out of scope.
3. **What you learn and the fleet-ops takeaway:** what this model actually produced, and what an ops team would test next in its own operation.

Appendix B gives the same three parts for each of the 56 catalog lessons and for the proposed new lessons.

### 12.0 At a glance: what each simulation teaches

One table for the owner. Numbers are **model output** from the named runs: synthetic, NOT_EVIDENCE, and not calibrated to any operation. Takeaways are things an ops team would **test in its own operation**, not proven advice. Details, evidence and proposed on-page copy are in 12.1 to 12.10; the 56 lessons are in Appendix B.

| Simulation (lessons) | What & why | How we simulate | What you learn → ops takeaway to test |
|---|---|---|---|
| **Fleet day** (12.1; 12 lessons) | With this fleet, service area and depots, how many ride requests get served, and what keeps each car from its next rider? | One synthetic 8-hour Bay Area day in 1-minute steps. 24 cars and 18 real places on OpenStreetMap roads. Synthetic demand with rush-hour peaks, and nearest-car dispatch with an energy check. Depot visits cover software, cleaning, charging and upload. The same seed gives the same riders. | The default day is over capacity: 95 of 284 requests completed (seed 42, test-pinned). A rider is on board about a fifth of car time; about 40% is empty driving to pickups, and the charging queue dominates depot time. At 24 cars, fleet size is the biggest lever: 48 cars lift completion from 32% to 66% (11 seeds). **→** Measure where vehicle minutes go before choosing between more cars and more depot capacity. |
| **Depot work** (12.2; 6 lessons) | Which depot step holds cars back from riders, and would another site, bay, port or station help? | The Fleet day default with one lesson setting changed. Each depot step (software, cleaning, charging, upload) has its own queue at each depot. 10 seeds, each compared with the default on the same riders. | The depot path takes about a third of car time (33.8%). At the defaults the charging queue is the constraint, because the site power cap spreads 120 kW over 4 ports (30 kW each). A 200 kW site adds about 7 trips. Extra cleaning bays or upload stations change almost nothing, and more ports under the same power cap change nothing. **→** Find the step where cars actually wait; check power per port, not port count. |
| **Paired depot experiments** (12.3; 5 lessons: staffing, power sharing, deadline charging, stale status, airport staging) | Does one depot operating rule return more cars to riders on the same demand, without breaking something else? | A 4-hour synthetic window with one fictional depot. Exactly one policy setting changes, and both arms see identical riders. 12 paired seeds. The main result is completion, with a 2-point margin, plus guardrails that must not get worse. Staffing is a one-seed, three-arm comparison. | One more cleaning worker adds 10 trips; one more bay adds 0, because every queued minute was "no free worker". Sharing spare charger power changes nothing when the whole site is short of energy. Deadline charging readies a few cars and delays others. Ignoring stale charger status fixes the symptom, not the outage. Airport staging gets more cars there on time, but two guardrails (unfinished depot work, stored energy) hold the change. **→** Diagnose the blocker before adding capacity, confirm a rule has room to work, and read every guardrail before the headline. |
| **Austin regional power** (12.4; no lesson yet, 2 proposed) | When one depot loses charging power mid-shift, how many trips are lost, when, and can charging order recover any? | A fictional 5-node, Austin-inspired region: 40 cars, 2 depots, 480 requests over 8 hours. Only Site A's power changes (100, 60, 20 or 0% in minutes 90 to 180). Every condition also carries a short port outage and a 2-minute status delay. Charging order is compared on 12 paired seeds. | The lab is depot-bound by design: 39 of 40 cars are charging or queued by minute 90. A full outage removes about 8 trips, mostly after power returns. Charging order moves completion by under 1 point in every condition, and it shifts harm onto unfinished depot work or stored energy. **→** Check whether depots sit at their power cap through peaks, and measure a power event over its recovery period. |
| **Launch rehearsal** (12.5; 1 lesson) | If new chargers are switched on later than planned, how much rider service does a launch lose, and where does it show? | The Fleet day engine for 4 hours, in fictional Region B or the Peninsula template. All ports are installed but not commissioned. They switch on at minute 0 in the baseline and after a delay (default 90 min) in the candidate. One seed, descriptive; a zero delay is an exact null check. | A 90-minute slip cuts completed trips from 34 to 29 (Region B, seed 42) and turns late pickups into missed ones. Meanwhile on-time pickups stay at 24, and that is the measure the page leads with today. **→** Treat each commissioning task as a service-capacity item with an owner and a date, and read completed and missed trips over the slip window. |
| **Street lab** (12.6; 6 lessons) | What does one constrained downtown street do to a fleet: how many journeys finish, where cars get stuck, and does routing around the queue help? | A frozen San Francisco street extract in 5-second steps. Every link is a finite queue with spillback and signals. 24 cars, synthetic riders and 900 background vehicles per hour, plus an incident on the named street. Routing rules are compared on the same demand. | Most presets are driven by background traffic, not by their named incident; only Stockton is an incident case. Queue-aware routing helps a little in 26 of 30 runs but adds empty distance in 28 of 30. Large gains appear only where cars were stuck entering a full block. The largest queue can sit on a neighbouring street. **→** Classify each corridor as supply-, street- or pickup-exit-limited against a no-traffic run, and carry empty distance as a guardrail on any detour rule. |
| **Four-area workbench and workspace** (12.7; 12 lessons) | In a coarse four-zone Bay Area model with overnight depot cycles, does one fleet or depot change move rider wait beyond a stated margin, and what does it trade? | A discrete-event model from day 1 05:00 to day 2 10:00: 4 areas, 4 depots, 120 cars, an overnight recall and a morning release. One declared change, 20 paired seeds, a practical margin, and guardrails written before the run. | A depot fix can halve its own bay queue and still leave rider wait unchanged (UC-08a); moving bays to the depot that needs them helps (UC-10). Declared guardrails decide verdicts (L2a vs L2b). Conditions such as evening slowdowns outweigh any single lever. **→** Write guardrails before the run, run an A/A check first, and re-check any direction on other demand draws. |
| **Operations casebook** (12.8; 20 cases) | Twenty situations an ops lead meets (SF peaks, a new-area launch, rain, crowds, police activity): does the proposed change help riders without breaking something else? | The four-area model, with each situation played through its settings. One change per case, 20 paired seeds, and verdicts pinned in tests on three seed sets. | 14 of 20 cases read HOLD, and in 7 of those the main result alone would not have stopped the change. The effect often lands elsewhere: on a depot, the next morning or a neighbouring area. In OPS-01, 12 more SF cars cut evening wait but overload SF-2 overnight. **→** Treat every fleet change as a depot change, and guard the neighbouring area and the whole run, not only the window of concern. |
| **Guided walkthrough and framing pages** (12.9) | The one idea behind the site: riders wait when cars are busy somewhere else. Which resource limits rider service, and does a change help riders without harming something else? | The walkthrough replays OPS-01 (four-area model, seed 1001) and walks one whole decision: question, day, verdict and trade-off. Overview, catalog and Product approach introduce the three models, which are not interchangeable. | Car count is not service capacity. A result is a main measure plus guardrails, and guardrails can decide. One replay is a story, not a result. **→** Start from the ops question, not the model; the 56 lessons map onto 8 question families (§11.4). |
| **N2 event curb lab** (12.10; planned, not built) | When two event crowds leave one pickup hub with a limited approach lane and few berths, does staging cars ahead of time from published crowd estimates board more riders on time, and who absorbs the cost? | Planned: the Fleet day engine on a fictional Las Vegas-inspired graph, with a capped approach lane, boarding berths and staging. Only the dispatch policy differs between the two arms. Results are read only after the registered pre-evaluation checks. | No N2 results exist. A rough reactive-only toy model suggests the approach lane, held by cars still driving in, limits riders more than berths do. If so, staging may help mostly by removing drive-in time [I]. **→** Measure whether cars driving in hold the pickup approach before adding berths or staging, and count staging trips, energy and unused staged cars. |

**Conventions for this section and Appendix B**

- **Source.** Checkout `codex/fleetlab-d1-result-first` @ `790573e`, read-only.
- **Grounding.** Every number is **model output** from a named run and seed set, a test pin, or a recorded artifact. The probes are in the review scratch folders `teaching-review/<group>/`. A second reviewer re-ran each group in `teaching-review/<group>-verify/`. This section applies the verifier's corrections and leaves out any claim the verifier refuted.
- **Status of results.** Everything is synthetic teaching output: NOT_EVIDENCE, simulation only, deployment permission NONE. Nothing is calibrated to any operation or affiliated with any operator or vehicle maker.
- **Ops takeaways are test ideas.** Each takeaway is something a team would test or check in its own operation. None of it is proven advice. In Appendix B LEARN lines the takeaway is marked "Ops check:" (some rows keep "Ops:" or "Ops test:") and names something to check, not an instruction. The static `ops_takeaway` field uses the §11.3.5 form, "An ops team would <verb> ...".
- **UI labels follow §11 OD-T6.** The page's part labels are "What & why", "How we simulate" and "Learning & ops takeaway". The three part names above are this document's headings, not page labels.
- **Precedence: §11 is canonical.** §11 owns the templates, the plain-word maps and the Next test map (§11.3.4), the labels (OD-T6), the evidence enum and the family names (§11.3.2, §11.4), the byte budget (§11.5.5) and this rule:
  - **what_why and how:** the §11.3.10 exemplar wins where one exists. Otherwise use the Appendix B WW and HOW, with the VERDICT_CLAIMS fixes applied.
  - **look_for and ops_takeaway:** derive them per §11.7 by splitting the Appendix B LEARN line into a direction-free look_for, an ops_takeaway in the §11.3.5 form, and numbers for the grounding sidecar. Appendix B LEARN is never pasted into a static field; it is only a pinned-reading or after-run source.
  - **After-run lines:** generated per §11.3.4 only. Each surface below lists the fields its line may read and keeps no second template.
  - **Intro and label copy:** the §11.3.10 intro and label strings (Overview hero lede, catalog intro, walkthrough intro, Fleet day pre-run summary, label fixes) win over the surface copy below for the same element. Generated text never uses "null" for a missing or empty value.
  - **Casebook readings:** §11.3.4 owns the slot legend, the fill rules and the OPS-01 reading (§11.6 item 6). For OPS-02 to OPS-20 the reading is the Appendix B.8 LEARN text before "Ops check:", in that slot syntax. B.8 restates the §11.3.4 legend, and its OPS-01 row carries §11.3.4's template verbatim; `teaching-review/fix-round/check12r2.mjs` checks both against the §11 file. Where they differ, §11.3.4 wins.
  - **Scope:** §11 decides whether a change is T1, T2 or an OD (§11.6 item 2). A page-fix bullet below that rewords the design §1.3 rows in `labels.js:31-35`, or that moves the walkthrough refusals behind a disclosure, is OD or T2 work, and each such bullet says so.
- **Copy limits.** Proposed on-page copy is capped at 160 characters for what_why, 220 for how, and 240 for learn (learning plus ops check). The same 240 cap applies to look_for plus ops_takeaway, and to a casebook reading once its slots are filled on each seed set.
- **Copy rules checked.** Every proposed on-page string was run against the exact expressions in the checkout, as §11.5.1 lists them:
  - three distinct H-3 banned-word lists: the build gate `tools/check-dist.mjs:67`; the narrower test copy in `test/labels.test.mjs:313` (= `test/app.test.mjs:23`); and the broader `BANNED` in `test/ops-cases.test.mjs:22` (`predict\w*`, `forecast\w*` and so on);
  - dashes, `tools/check-dist.mjs:77`;
  - H-6, `test/labels.test.mjs:315` (= `test/app.test.mjs:24` = `test/ops-cases.test.mjs:23`);
  - VERDICT_CLAIMS (`test/ops-cases.test.mjs:26`) on every pre-run what_why and how (WW and HOW in Appendix B), not only on casebook lines, and on every static part-3 line;
  - DIRECTION (`test/captions.test.mjs:19`) and the §11.3.2 digit rule on every static part-3 line (look_for, ops_takeaway, and a pre-run card or header learn line) and on walkthrough lines;
  - the §11.3.5 prefix and verb set on every static ops_takeaway;
  - the §11.5.1 house words on every string, and DIRECTION plus the digit rule on an Appendix B LEARN that is shown before a run (`event-curb-staging`).

  The checker is `teaching-review/fix-round/check12r2.mjs` (round 2; the round-1 `check12.mjs` still passes). It also checks that every header this section says is a §11.3.10 frame, the intro strings, the B.8 slot legend and the OPS-01 reading equal the current §11 text. The casebook readings are filled on sets 1 to 3 by `teaching-review/fix-round/readings.mjs`, which reads the templates from Appendix B.8 itself.
- **House rule for this copy.** No "should", "prove", "guarantee", "safe/safety" or "monitor". These house words are shared with §11.5.1 (`/\b(should|prove[sn]?|guarantee\w*|safe|safety|monitor\w*)\b/i`), which applies them to every proposed on-page string in §11 and §12; the §11.3.10 staffing-readiness what_why now equals the Appendix B WW ("Does the depot need ..."). The §12 checker also flags "proved". Negatives use the ASCII hyphen, and no en or em dash appears. Punctuation is ASCII only: "x1.6", not a multiplication sign, and "plus or minus", not a plus-minus sign. Appendix B gives the result for each string.
- **H-9 gate on learn lines.** A learn line that names a direction or a verdict is shown in only two cases:
  - **(a)** after the reader's own run, filled from recorded fields; or
  - **(b)** as a pinned reading, when a test asserts every direction and number in the line. Precedents are LEARN_LOOK/LEARN_FINDINGS in `captions.test.mjs:116-136` and, for the casebook, `test/ops-cases.pins.json` sets 1 to 3. A casebook reading is a slot template filled from the reader's own verdict (12.8).

  Before a run, a card shows what_why, how, and the direction-free look_for and ops_takeaway (§11.3.2). The Appendix B status column names the gate each learn line needs.
- **Model-output label.** A learn line that begins "Seed 42:" or "N seeds:" sits under a "What this run shows (synthetic model output)" label. The container carries that label wherever the 240-character cap leaves no room for it in the line.
- **Where the copy lives.** All frames go in one page-only module, `src/ui/teaching-frames.js`. In T1, `COPY_MODULES` (`tools/check-dist.mjs:40`) gains only that module and `src/model/street-simulation.js`, whose literals are already clean (0 problems under check-dist's own `literalsOf`), as §11.5.2 sets out.
  - T1 edits no `src/model` literal. The leaked strings are mapped to clean display strings at render, in the UI layer, with runtime label maps: the en dashes in `launch-contract.js:25` and `:29` and in `bay-experiment-contract.js:60` and `:62`; "forecast" in `bay-experiment-contract.js:27` (a policy id that feeds the airport spec digest) and in `bay-operations.js` ("Forecast preparation" at `:97`, and the assumption text at `:275` to `:279`, which also carries en dashes); and the region label at `launch-rehearsal.js:19`, which sits inside the launch config, so fixing it at source is a config change, not a copy change.
  - `test/copy-surfaces.test.mjs` scans the rendered text instead of adding those model files to `COPY_MODULES`.
  - Editing any of those model literals at source is T2, except the policy id `forecast`, which needs a check-dist allowlist entry rather than an edit (§11.6 T2 list). A T2 source edit comes with proof that the ops and presets pins and the pinned setup digests (`test/d1-presentation.test.mjs:31-36`) are unchanged.
  - `src/ui/learn.js` and `src/ui/present.js` join `COPY_MODULES` only after check-dist learns to skip attribute-name literals such as `aria-live`, recorded as a tool change.
- **Budget.** §12 sets no budget of its own: package T, stop 61,440 B (target 53,248), per §11.5.5, after route A. T1 ships no non-OPS pinned readings; those are T2 and need their own byte line in OD-2. Every new lesson beyond 56 needs owner approval and an explicit change to `test/navigation.test.mjs:14`.

### 12.1 Fleet day core

**What & why.** Fleet day asks the first capacity question a robotaxi-style operator faces: with this fleet, service area and depots, how many ride requests get done, and what keeps each car from its next rider? At any minute a car is doing one of these:

- driving empty to a pickup;
- boarding;
- carrying a rider;
- driving to a depot;
- queueing at the depot;
- being worked on (software, cleaning, charging, upload);
- sitting idle.

The operator's levers are slow and capital-heavy: more cars, more or faster depots, a tighter zone, a different vehicle profile, or a different depot cadence. The model lets a reader see which constraint binds in a synthetic service window.

**How we simulate.** One synthetic 8-hour window at one-minute resolution. The default starts at 07:00 with seed 42 (`bay-operations.js:15-16`, `operations.js:12-20`).

- **Demand.** 30 requests per hour, raised to 1.6 times that in 07-10 and 16-19. Origins are uniform over the 18 places, and destinations favour nearby places. The same seed gives identical requests across the fleet, depot and mix trials (`test/bay-operations.test.mjs:87-92`).
- **Roads.** Frozen OpenStreetMap major-road routes join 18 anchors: 153 place pairs, median 26.1 km, longest SF to San Jose at 77.9 km. Travel minutes = ceil(km / 38 km/h x 60 x traffic x weather), with synthetic traffic x1.25 in the peaks. There are no one-way, turn or access rules.
- **Dispatch.** The nearest car with energy for pickup + trip + return to a depot + a 15% reserve gets the request. The 12-minute patience limits only the wait to be assigned; the pickup drive itself is unbounded.
- **Depot trigger.** A car heads to its nearest depot in three cases: after 3 trips; at reserve; or when it is idle, below the 85% target, and short of energy for every waiting request (`bay-operations.js:165`, `:204`).
- **Depot work.** The stages run in series:
  - software on every 2nd visit: 12 min, 1 station;
  - cleaning: 8 min, 2 bays;
  - charging to 85%, at min(port 50 kW, vehicle limit, site 120 kW / active ports), with 4 ports;
  - upload: 6 min, 2 stations.
- **Fleet.** 24 cars, 50% I-PACE (84 kWh, 100 kW, 0.24 kWh/km) and 50% Ojai (90 kWh, 150 kW, 0.27 kWh/km, cleaning x1.25, upload x1.2). The Ojai values are invented (`vehicle-profiles.js:11`). Cars start at 65% charge.
- **Weather.** Rain multiplies travel by 1.3, energy by 1.12 and demand by 1.12. Heat uses 1.05, 1.25 and 1.05. Demand is regenerated, so weather runs are compared by counts, not on the same demand.
- **What changes.** Each lesson patch changes 0 to 2 settings; everything else and the seed stay fixed.
- **Out of scope.** Calibrated demand, pricing, rebalancing, a pickup-time cap, staff shifts (the optional staffing lesson adds cleaning workers only, with no shifts), charge taper, lanes, collisions, real traffic, and anything past the end of the window.

**What you learn and the fleet-ops takeaway.**

1. **The default window has more requests than 24 cars can reach, and the page never says so.**
   - Model output, seed 42: 95 completed, 176 unserved, 4 waiting and 9 in progress, of 284. This is pinned in `test/d1-presentation.test.mjs:24` and `test/d1-model-parity.test.mjs:9`.
   - Model output, seeds 1-10 and 42: 81 to 100 completed of 276 to 304; mean completion 32%.
2. **Most car time is not rider time.** Model output, seed 42:
   - empty pickup driving 40.8%;
   - rider on board 19.0%;
   - depot work 15.2%;
   - depot queue 13.2% (almost all of it the charger queue);
   - idle 5.2%;
   - driving to a depot 4.9%;
   - boarding 1.7%.

   Pickups average 25.4 km against 12.6 km trips (11 seeds). Model output, seed 42: median pickup drive 37 min; 32% of completed trips had more than 60 min of it; mean wait to be assigned 5.8 min.
3. **Throughput is capped in the tested range.** Model output, 11 seeds: base demand of 15, 30, 45 and 60 requests per hour gives 97, 93, 96 and 101 completed trips, while unserved requests rise from 39 to 466.
4. **Fleet size is the largest lever at 24 cars.** Model output, 11 seeds:
   - 24, 48 and 72 cars reach 32%, 66% and 90% completion.
   - The mean pickup falls from 25.4 to 14.4 to 5.1 km, so more cars help mainly by shortening empty pickups.
   - Trips per car start to fall from about 48 cars on (3.99 at 48, 3.63 at 72).

   Depot levers matter less at this fleet size:
   - Faster charging (150 kW ports, 600 kW per site) adds about 25 trips (11/11 seeds), and about 23 at the same total site power.
   - Going from 2 to 6 depots adds about 18 (range 14 to 26, 11/11).
   - Sensitivity at seed 42: +12 cars gives +52 trips; tripling every depot resource gives +17.
5. **Weather mostly acts through travel time.** Model output, 11 seeds:
   - Rain gives 11.9 fewer completed trips (10/11 seeds) and 44 more unserved.
   - The travel factor alone removes 13.4 (11/11).
   - The demand lift alone removes only 1.3 (7/11) but adds 33 unserved.
   - The effects do not add up.
   - Rain also shortens depot time (107.5 to 96.7 min on site) because fewer cars reach depots.
   - Heat removes 7.8. At seed 42, 9 of 28 heat depot visits were triggered by a car short of energy, not by the trip count.
6. **A vehicle profile's value depends on which charging cap binds.**
   - At 50 kW ports: all Ojai against all I-PACE changes completed trips by -8 to +2, but uses 85 kWh more (11/11) and 8.9 min more depot time (11/11). The Ojai 150 kW limit never engages at these ports.
   - At 150 kW ports with 600 kW sites the depot-time order reverses: -4.3 min (11/11).
   - The depot-time gap comes mainly from the extra energy each Ojai recharges, not from its cleaning and upload factors.
7. **Depot cadence trades trips for stored energy.** Model output, 11 seeds: visiting after 2 trips instead of 3 gives 14.6 fewer trips (11/11) and 126 kWh more fleet energy at the end of the run (10/11). Both settings end below their starting energy in 11/11 seeds. A multi-day plan would have to cover that shortfall; it is not modeled.
8. **The shortage does not clear after the peak.** Model output, 11 seeds:
   - Unserved share is 70-79% for requests created 08:00-10:00 and still 62-72% for 10:00-15:00.
   - Starting at 16:00 instead of 07:00 changes nothing (11/11), because both windows contain 3 peak hours.
   - Raising the peak from 1.6x to 2.4x adds 74 requests and about 1 completed trip.

**Takeaways an ops team would test in its own operation:**

- Measure where vehicle time goes (empty to pickup, with a rider, to a depot, queued, being worked on) before choosing between fleet and depot spending.
- Find which lever moves completion at your own fleet size, because the answer shifts as the fleet grows. At 48 cars, depot counts 1 to 6 give 168 to 236 completed trips (seed 42).
- Treat a pickup-distance cap as a dispatch policy to test. FleetLab does not model one.
- When narrowing a service zone, check depot charging at the same time.
- Build weather playbooks around travel-time assumptions first.
- Track end-of-window fleet energy as a guardrail on depot cadence.

**Proposed on-page copy** (surface header on `#/fleet-day`; lesson banners in Appendix B.1)

- **Pre-run header:** the §11.3.10 surface frame `day`, verbatim (lengths 152/188/227). §11 wins on any difference; this section's earlier what_why and how drafts are withdrawn.
  - what_why: "How many ride requests can this fleet complete in an 8 hour day, and what keeps a car from its next rider? The answer points to the lever worth testing."
  - how: "One synthetic 8 hour day from 07:00 on OpenStreetMap Bay Area roads: requests, pickups, trips, then depot cleaning, charging and upload. One replay per setting, fixed seed. Not calibrated."
  - look_for: "Read completed, unserved, waiting and in progress together, then compare fleet and depot sizes to see which one moves completed trips."
  - ops_takeaway: "An ops team would measure where its own vehicle time goes before buying cars or depot sites."
- **T2 pinned-finding candidate.** Pre-run header uses the §11 frame; this numeric line is a T2 pinned-finding candidate. It goes into `test/teaching-frames.grounding.json` and is never shown before a run: "Model output, seed 42: 24 cars complete 95 of 284 requests; empty pickup driving fills 41% of car time. Ops teams would measure their own empty and depot share before adding cars or sites." Only 95 of 284 is test-pinned (`test/d1-presentation.test.mjs:24`); the 41% share comes from a frame-sum probe.
- **After a run:** the page shows only the generated §11.3.4 line ("Fleet day replay"). This section keeps no second template.
- **Fields.** The line reads only existing fields, with no new model computation:
  - `config.fleet_size` and `config.seed`;
  - from `result.metrics`: `completed_trips`, `total_requests`, `unserved_requests`, `pending_requests` and `in_progress_trips`.

  Beneath the line, not in it: `avg_wait_min_completed` (labelled "wait incl. pickup drive"), `avg_depot_onsite_min`, `service_breakdown.charging.avg_queue_min`, `initial_energy_kwh` and `final_energy_kwh`. A null renders as "not available: <reason>" (H-5), never 0 or "null".
- **Where it renders.**
  - The visible frame replaces the closed "Learning notes" (OD-T2, which rewrites `d1-presentation.test.mjs:21`) and stays before `.ops-result-summary`, so the result-first order is kept (§11.3.3). When `?lesson=` is present it shows the lesson frame plus the one control to press next, above the Run button; otherwise it shows the `day` frame. If OD-T2 is declined, the frame renders instead as a separate lesson banner above the Run control, the closed Learning notes stay and `:21` is unchanged (§11.6).
  - Keep the lesson name in the situation select; it shows "Custom" today (`operations-lab.js:172`).
  - Add a "Compare with the regular day (same seed)" action for single-axis lessons, reusing `simulateBayAreaOperations` (T2 in §11.6).
  - Label the wait figure "wait incl. pickup drive".
  - Use the §11.3.10 Fleet day pre-run summary: "The default day has more requests than 24 cars can serve, so the limits show. Read all four counts together."
  - Fix the pre-run weather chip, which reads "Clear" while Rain is selected (`operations-lab.js:117`).
  - Optional model metric (T2 in §11.6): vehicle-minutes by activity. Accumulate it inside the minute loop, not from frames, because the capacity and mix trials run with `capture:false`. Check the version pin at `test/d1-model-parity.test.mjs:15`.

- **rush-hour alternates (T1).** Appendix B.1's rush-hour copy assumes the one-axis patch `{peak_multiplier:2.4}`, which is a T2 lesson setup fix. T1 changes no patch, so the shipped patch stays `{start_hour:16, requests_per_hour:45}` and T1 uses these:
  - how: "This lesson starts at 16:00 and raises base demand from 30 to 45 per hour. Peaks run 07-10 and 16-19 at 1.6x demand and 1.25x travel. Both 8 hour windows contain 3 peak hours, so start time alone changes nothing."
  - learn (the LEARN source for the §11.7 split; its numbers are a T2 pin candidate): "Model output, 11 seeds: 149 more requests give about 3 more completed trips (range -11 to +18) and 141 more unserved. In the default day, 70-79% go unserved at 08-10 and 62-72% after the peak. Ops check: peak or all-day gap?"

**Lessons:** `bay-area`, `fleet-day`, `weather-day`, `rush-hour`, `vehicle-mix`, `full-cycle`. NEW: `demand-ceiling`, `charge-cap`.

**Evidence:** `teaching-review/fleet-core/` probe.mjs, probe2-5.mjs and dom-probe.mjs. Verified in `fleet-core-verify/` v1-v4.mjs and dom.mjs (all numbers reproduce). Live check: `#/fleet-day?lesson=weather-day` on the deployed site gave 78/221/5/14 = 318, matching seed 42.

### 12.2 Depot work

**What & why.** How much of the fleet's day goes to work between rides, and which step holds cars back? Before a car can serve again it drives to a depot and passes up to four steps in order: a software update (on scheduled visits only), cleaning, charging and trip-data upload. Every minute spent driving there, queueing or being worked on is a minute the car cannot serve riders. The usual remedies (another site, more bays, ports or stations) only help if they target the step where cars actually wait. Otherwise the money goes to a resource that is not the constraint.

**How we simulate.** The Fleet day default (12.1) with each lesson's patch.

- **Settings that change.** Four of the six patches change two settings at once:
  - `cleaning` sets 1 bay and a visit every 2 trips;
  - `software` sets 30 min and every visit;
  - `upload` sets 30 min and 1 station;
  - `shared-power` sets 80 kW ports and a 40 kW site. The port change does nothing: the 40 kW site alone gives identical results in 10/10 seeds.
- **Stages.** Each stage has its own first-come-first-served queue per depot.
- **What stays fixed.** Demand (keyed by seed and places), geography, the dispatch rule and the fleet.
- **How the review ran it.** 10 seeds (42, 1-9), each lesson paired against the default and against one remedy on the same seed. The results are descriptive means, ranges and sign counts, with no confidence intervals.
- **Out of scope.** Staff shifts, charge taper, failed or rolled-back updates, bandwidth, tariffs and grid behaviour.

**What you learn and the fleet-ops takeaway.**

1. **The depot path is about a third of car time.**
   - Model output, 10 seeds: driving to, waiting at and working in depots fills 33.8% of car-minutes (range 32.2 to 36.1).
   - Driving to pickups is larger, at 41.6%.
   - Cutting depot work to a UI-legal minimum raised completed trips from 93.0 to 122.3 (10/10 seeds). That is about what 30 cars deliver with default depot work (122.0).
   - Faster charging power alone (350 kW ports, 1,000 kW site) gives +25.5 (10/10), so charging is most of that gain.
2. **Charging, capped by site power, is the default queue.**
   - Model output, seed 42: the charging queue is 15.1 min, cleaning 0.4 and upload 0.
   - 120 kW shared by 4 active ports is 30 kW each, below the 50 kW port rating.
   - A 200 kW site adds 7.2 trips (9/10 seeds).
   - Starting cars at 85% charge adds 10.0 (10/10).
3. **Capacity added off the constraint does nothing or moves the queue.**
   - Extra cleaning bays or upload stations beyond 2 change trips by less than 1.
   - More update or upload stations move the queue to charging (software, seed 42: charging queue 0 to 10.7 min).
   - Under a fixed power cap, more ports hurt: 8 ports at 120 kW give 4.8 fewer trips (10/10). At 40 kW, 2, 4 and 8 ports deliver the same energy (389.9 / 390.5 / 390.8 kWh) but finish 7.3, 5.6 and 3.0 visits.
4. **Bundled patches hide the driver.**
   - Only in `cleaning` is the unannounced change the whole effect: cadence alone gives -14.7 trips, the bay change alone -0.6.
   - `upload` is mostly transfer time: 30 min alone gives -4.9, 1 station alone -0.1.
   - `software` is an interaction: each change alone gives 0 or -1.8, both together -6.5.
5. **Visit cadence moves trips and energy together.** Model output, 10 seeds, against every 3 trips:
   - every 2 trips: 14.7 fewer trips, mostly from extra drives to the depot;
   - every 6 trips: 7.1 more trips, but cars short of energy for a waiting trip rise from 2.2 to 22.7, and end-of-run energy falls from 1,134 to 1,042 kWh;
   - every 6, 10 and 20 trips give identical results, because the trip-count trigger never fires in an 8-hour window.
6. **Adding sites is not the fix here.** Model output, 10 seeds: no depot count from 1 to 6 reaches the fixed 95% target, and each added depot adds fewer trips (82.3, 93.0, 101.7, 106.6, 109.6, 111.0). At 8 requests per hour the first sufficient count changes from seed to seed, so no single number is a site plan.

**Takeaways an ops team would test in its own operation:**

- Measure the depot path as fleet time: drive, queue and work per stage, counting unfinished visits.
- Rank stages by queue minutes, add capacity only at the longest queue, then re-read the next stage.
- Before buying ports, compare the delivered kW per charging car with the nameplate rating.
- Treat visit, update and upload cadence as separate policies, changed one at a time, each with energy guardrails.
- Test fleet supply before sites. Separately, test one site's resources added to an existing depot, to tell distance apart from capacity.

**Proposed on-page copy** (depot-work lesson banner header; per-lesson copy in Appendix B.2)

Depot work has no surface of its own in §11: its lessons open Fleet day, so the page shows the `day` frame plus each lesson's frame. If a group header is kept, it uses this direction-free frame (L+O 237):

- what_why: "Every few rides a car goes to a depot to be cleaned, charged and cleared of trip data, and on some visits updated. Those minutes are capacity riders never see."
- how: "Cars visit the nearest depot after a set number of trips or when low. Up to four steps run in order, each with limited bays, ports or stations and its own queue. Demand, fleet and routes stay fixed."
- look_for: "Read the wait before each depot step, then check whether changing the step with the longest wait moves completed trips."
- ops_takeaway: "An ops team would measure queue minutes at each depot stage in its own records before adding bays, ports or stations."
- **T2 pinned-finding candidate.** Pre-run header uses the §11 frame (or the direction-free frame above); this numeric line is a T2 pinned-finding candidate. It goes into `test/teaching-frames.grounding.json` and is never shown before a run: "Model output, 10 seeds: a third of car time goes to depot visits (driving, waiting, work). Cutting that work to a minimum gave 122 trips vs 93, about what 30 cars deliver. Ops check: find the longest queue, then recheck." The 10-seed numbers come from a probe; no test pins them.
- **After a run:** the page shows only the generated §11.3.4 line ("Fleet day replay"). The per-stage fields below fill the queue table under the line, not the line itself.
- **Fields.**
  - Line: `completed_trips`, `total_requests`, `unserved_requests`, `pending_requests`, `in_progress_trips` and the seed.
  - Queue table: `avg_depot_turnaround_min`, `avg_active_service_min`, and `q_<stage>` = `result.metrics.service_breakdown.<stage>.avg_queue_min`, shown as "N min". When that stage's `completed_count` is 0, render "no finished visit reached this step" (§11.3.4 rule 8). The default software stage is always 0, because no second visit finishes inside 8 hours.
  - `max_queue` is the maximum over depots and stages; the unfinished visits at the end are counted, not dropped.
- **Page fixes.**
  - Explain why the default software row is empty.
  - Show `energy_blocked_vehicle_count`, `final_energy_kwh`, `energy_delivered_kwh` and `max_queue` outside the raw JSON (`operations-lab.js:218`).
  - Reword the `depot-count` question: the target is fixed at 95%, and "none met it" is a valid answer.
  - Make the home depot explainer name the Fleet day stages. It currently says "This regional model excludes staffing and charging" (`depot-scene.js:7`).

**Lessons:** `depot-count`, `cleaning`, `charging`, `shared-power`, `software`, `upload`. NEW: `visit-cadence`, `busy-depot-binding-stage`, `cleaning-binding`. `cleaning-binding` is proposed as the replacement setting for `cleaning`.

**Evidence:** `teaching-review/depot-work/` run-*.mjs. Verified in `depot-work-verify/` v-*.mjs (every number reproduces, apart from queue share: 11.8%, not 11.9%).

### 12.3 Paired depot experiments (M1-M3, airport)

**What & why.** Does one depot operating change return more cars to riders on the same demand, without harming something else? The five changes tested are:

- a cleaning worker versus a cleaning bay;
- passing unused charger power to cars that can take it;
- charging by readiness deadline;
- ignoring charger status reports that are too old;
- staging cars ahead of an airport wave.

Each change uses scarce labour, power or cars, and a change that helps one measure can quietly hurt another. The surface teaches three steps: diagnose before intervening, confirm a rule has room to work, and read every guardrail before the headline.

**How we simulate.** Each lesson loads a demo config: `depotReadinessDemoConfig` (`bay-operations.js:300`) or `advancedOperationsDemoConfig(kind)` (`bay-experiment-contract.js:38`). All run a synthetic 4-hour window with one fictional depot.

- **Staffing** uses `analyzeDepotReadiness`: three arms on one pregenerated demand, one seed.
  - The arms are the baseline, +1 qualified cleaning worker, and +1 cleaning bay.
  - It reports completed-trip deltas and queued minutes split by exclusive blocker (no free worker, no free bay, both).
  - It is descriptive only.
- **Charging, freshness and airport** use the paired adapter (`freezeBayExperiment`).
  - **What changes.** Exactly one policy field changes; the spec is frozen and digest-checked.
  - **Seeds.** 12 held-out evaluation seeds (1001-1012). Tuning seeds 42-44 are declared and kept disjoint; no tuning phase runs.
  - **Checks.** The run confirms both arms see identical external demand.
  - **Primary measure.** Completed trips over all requests, practical margin 0.02, with a 2,000-resample bootstrap interval on the mean paired difference.
  - **Guardrails.** Max request wait (5 min), unfinished visits (0), terminal energy (5 kWh) and rejected actions (0). The airport lesson adds non-airport completion and airport pickups within target.
  - **Decision rule.** Any regressed guardrail gives HOLD (`recommendation.js:24-31`).
- **Not part of the result.** The replay the reader watches uses seed 42, a tuning seed.
- **Synthetic or out of scope.** Linear charging, fixed deadline tiers, synthetic status reports, a fictional airport access rule, and no shifts, money figures or real feeds.

**What you learn and the fleet-ops takeaway.**

1. **Diagnose before adding capacity (staffing).**
   - Model output, seed 42: one more worker lifts completed trips from 26 to 36 of 179; one more bay leaves 26. All 3,208 queued task-minutes were "no free worker".
   - Seeds 1001-1012 repeat this exactly: +10 and 0 on every seed.
   - The constraint moves as resources are added. With 3 bays, a 4th worker adds nothing because bays become the blocker.
   - More of both keeps helping: 8 and 8 complete 96, 16 and 16 complete 120 (exploratory, seed 42).
   - Visit frequency is a separate large lever: a visit every 2nd trip gives 50, every 4th gives 92 (seed 42).
2. **A rule needs room to work (power redistribution).**
   - Model output, seeds 1001-1012: UNCHANGED, NO_RECOMMENDATION. Completion is 23.0% in both arms, although delivered energy rose from 440.7 to 455.4 kWh per run.
   - At seed 42 the 24 cars still at the depot at the end needed 610 to 660 kWh more, against a whole-window site ceiling of 480 kWh.
   - Starting cars at 70% (exploratory) turns the same rule into IMPROVED, ADVANCE_TO_NEXT_TEST: completion 46.2% to 54.2%, interval +7.0 to +9.0 points.
3. **Priority rules shift who waits (deadline charging).**
   - Model output, 12 seeds: completion 23.0% to 23.5%, inside the margin.
   - Cars ready by deadline go from 0 to 2 per run, but missed deadlines rise from 24.8 to 26.0, and plugged-in cars sit at 0 kW for 1,263 car-minutes (none before).
   - Deadlines are visit start + 45, 90 or 135 min, by car.
   - At seed 42, 64% of queued-and-charging car-minutes were past the 60-minute aging limit, so the aging rule, not deadlines, set most of the order.
4. **Fixing a symptom is not fixing the outage (freshness).**
   - Model output, 12 seeds: rejected reservations fall from 17.7 to 10.3 and false-ready port-minutes from 32 to 16, while completion stays at 20.1%.
   - The outage itself does lower completion: with no outage it is 23.0%.
   - Neither rule repairs a port, and a rejected try moves to the next port in the same minute at no time penalty.
   - With a 12-minute report delay against a 10-minute validity window, fresh-only delivers 0 kWh: REGRESSED, HOLD (exploratory).
5. **Guardrails decide (airport).**
   - Model output, 12 seeds: primary UNCHANGED, recommendation HOLD.
   - Cars reaching airport riders within 10 min rise from 34% to 50%. This measures car arrival, not boarding.
   - Unfinished visits rise by 0.75 (limit 0), and stored energy at the end falls by 23.7 kWh (limit 5).
   - The staging cap binds: wave estimates of 28, 14 and 6 give identical paired differences.
6. **The harness is exact when nothing changes.** All four paired null controls give exactly 0, with interval [0, 0].
7. **Counterexample controls on these lessons:**
   - Overcommitting power has every one of 229 power proposals rejected, delivers 0 kWh, completes 24 of 135, and the run is still VALID.
   - Deferring, skipping or cancelling cleaning drops staffing completions from 26 to 16. Skip and cancel fail MANDATORY_WORK_POLICY.
   - (Model output, seed 42.)

**Takeaways an ops team would test in its own operation:**

- Log blocked depot minutes by cause before adding staff or bays, and log again after each change.
- Before tuning charge order or sharing, confirm a faster charge can release a car within the window that matters.
- Report the delayed group beside the prioritised one.
- Keep the status validity window longer than the status delay.
- Judge staging on the whole system, and treat any guardrail breach as a hold.
- Run an A/A null control first.

**Proposed on-page copy** (header for the paired and readiness panels; per-lesson copy in Appendix B.3)

In §11 these panels alias their lesson frames (`staffing`, `charging`, `deadlines`, `resources` and `airport` in `SURFACE_FRAMES`). If a shared header is kept, it uses this direction-free frame (L+O 232):

- what_why: "Does one depot rule return more cars to riders on the same demand, without harming rider wait, depot work or stored energy?"
- how: "Both arms replay the same synthetic riders on 12 held-out seeds; one policy setting changes. Primary: completed share of all requests, 2 point margin. A guardrail past its limit stops the change."
- look_for: "Read completion against its margin, then every guardrail: a rule can move energy, rejections or pickups without freeing cars."
- ops_takeaway: "An ops team would log what each waiting car lacks in its own depot records before choosing a rule to test."
- **T2 pinned-finding candidate.** Pre-run header uses the §11 frame (the aliased lesson frame, or the direction-free frame above); this numeric line is a T2 pinned-finding candidate. It goes into `test/teaching-frames.grounding.json` and is never shown before a run: "Model output: in all four paired demos completion stayed inside its margin while the mechanism moved: more energy, fewer rejections, more airport pickups within target. Ops check: find what holds cars back first." Its directions come from the demo digests (eb54e3e4, 0820f908, 47a2006b, 8b1ddd9f), which no test pins.
- **After a run:** the page shows only the generated §11.3.4 line: "Paired" for the charging, freshness and airport contracts, and "One seed (staffing)" for staffing. Words come from the §11.3.4 plain-word maps and Next test map. HOLD wording follows its cause (§11.3.4 rule 3), and a NOT_EVALUABLE guardrail is never counted as within (rule 4).
- **Fields.**
  - Paired: `replications` (read from the spec), completed share of all requests in each arm, `mean_delta`, `ci_low`, `ci_high`, the margin, `outcome`, `recommendation`, and `guardrail_statuses`, naming a guardrail only when it is REGRESSED. The signed harm, with the note "Harm is signed so that a negative value means the candidate did better.", goes under Exact values (§11.3.4 rule 6), not in the line.
  - Staffing: seed, horizon, completed trips of all requests in each arm, and baseline queued task-minutes by exclusive blocker (no free worker, no free bay, both).
  - Focus measure per treatment, shown beneath the line:
    - redistribution: stored energy at the end (kWh);
    - deadlines: unfinished depot visits;
    - freshness: "Rejected reservations and power proposals";
    - airport: cars reaching airport riders within target.
  - Policy display names (a runtime label map in the UI layer, T1.1; OD-10-style arm names):
    - equal_share: "Equal power shares"
    - redistribute: "Redistribute unused power"
    - deadline: "Deadline first"
    - last_known: "Last-known status"
    - fresh_only: "Fresh status only"
    - reactive: "Respond to requests"
    - the airport staging policy: "Staged from a declared wave estimate"
- **Page fixes.**
  - Show only the instrument that matches the loaded lesson; staffing currently offers a paired run that errors.
  - Stop rendering runtime copy leaks. In T1 they are mapped to clean display strings at render in the UI layer: "forecast" in the axis and option labels, "prediction error port minutes" (label map, `bay-systems.js:11`), en dashes in RangeError text, and "winner" in `readiness-view.js:35` (a UI edit). Source edits in `src/model` are T2 (section 12 conventions).
  - Drop "A primary improvement cannot compensate for them." when the primary did not improve.
  - Owner decision: add mechanism metrics (energy delivered, false-ready port-minutes, zero-power car-minutes, cars ready by deadline) as paired descriptives. This needs `bayMetricMap` changes, and a digest change only if they are declared in the spec (T2).

**Lessons:** `staffing-readiness`, `power-redistribution`, `deadline-charging`, `resource-freshness`, `airport-preparation`. NEW: `redistribution-headroom`, `freshness-window-vs-delay`.

**Evidence:** `teaching-review/depot-experiments/` paired.mjs, staffing*.mjs and variants*.mjs, cross-checked with the repo tool `node tools/demo-depot.mjs <treatment>`. Digests: eb54e3e4085050ec, 0820f90872c54a1d, 47a2006bb775f099 and 8b1ddd9f13db8551. Verified in `depot-experiments-verify/` pv.mjs, staff.mjs and sweep.mjs.

### 12.4 Austin regional power

**What & why.** What happens to rider service when one depot's charging power falls short partway through a shift, and can a no-hardware change (the order in which cars charge) recover any of it? Planners need three answers: how many trips a power event removes, when they are lost, and whether the event or the all-day power cap is the larger limit.

**How we simulate.**

- **Region and fleet.** A fictional, Austin-inspired 5-node schematic, not imported roads. Two fictional depots: Site A (North) and Site B (East).
  - 40 cars, 50% Ojai.
  - 60 requests per hour for 8 hours (480 requests).
  - Cars start at 35% charge, charge to 85%, and visit a depot after every trip.
  - Each depot has 8 ports of 80 kW under a 120 kW site cap (`regional-power.js:9-21`).
- **What changes.** Only Site A's cap, and only in minutes 90 to 180: 100%, 60%, 20% or 0%. Site B stays at 120 kW.
- **Built into every condition, including "Full power control".** A 1-port-per-depot outage in minutes 60 to 120 and a 2-minute status delay (`resource-observations.js:3-4`). The page reveals these only after a run.
- **The two buttons.**
  - "Run Austin shift" runs one condition on one seed. The panel default is 60%.
  - "Compare Austin charging policies" is a paired A/B on 12 seeds: capped redistribution against deadline priority with aged-job protection. Margin plus or minus 2 points, 2,000 resamples, and the four standard guardrails.
- **Out of scope.** Real sites, grid or tariff behaviour, charge taper, heat, and sending cars to the unaffected depot as a policy.

**What you learn and the fleet-ops takeaway.**

1. **The lab is depot-bound by design.** Model output, seed 42: by minute 90, 39 of 40 cars are charging or queued. Completion is about 16%, and the page never says why.
2. **A power cut costs trips mostly after power returns.**
   - Model output, seed 42: 83, 77, 77 and 73 of 480 completed for full, 60%, 20% and outage.
   - Model output, seeds 1001-1012: 78.7, 76.9, 72.3 and 70.8.
   - The outage removes 7.9 trips and is worse than full on 10 of 12 seeds. At 60% the effect is mixed: 6 seeds worse, 2 equal, 4 better.
   - Completed trips by when the request was made, full vs outage:
     - minutes 0-90: 40.1 vs 40.1
     - 90-180: 1.4 vs 0.6
     - 180-300: 17.7 vs 12.0
     - 300-480: 19.5 vs 18.1

     The damage shows up in the recovery period.
3. **The all-day cap is the binding limit.**
   - Model output, 12 seeds: raising the site cap at both depots to 240 kW for the whole shift lifts mean completed trips from 78.7 to 214.3.
   - That adds about 1,920 kWh of nominal energy, against the 180 kWh the outage removes. So this shows which limit binds; it is not a like-for-like comparison.
4. **Charge order moves little and shifts harm.**
   - Deadline priority changes completion by +0.50, +0.19, +0.69 and +0.59 points: UNCHANGED in all four conditions.
   - It is HOLD at 60% (unfinished visits +0.33 per seed) and at outage (stored energy -5.39 kWh against a 5 kWh allowance).
   - These four mean deltas and verdicts reproduce exactly from `artifacts/fleetlab-regional-power/demo/observed-results.json`, digests included.
   - Probe, seeds 1001-1012: missed deadlines rise by 4.7 to 5.8 per seed.
   - Probe, seeds 1001-1012 (mechanism): deadline mode fills power serially, up to 80 kW for the first car and 0 kW for most others. Zero-power vehicle-minutes go from 120 (765 in the outage condition) to about 4,400-5,000.

**Takeaways an ops team would test in its own operation:**

- Check whether its depots sit at their power cap through peak hours before tuning charge order.
- Measure a power event's effect over the recovery period, not only the event window.
- Before trusting a priority rule, check whether deadlines are reachable at the power each car actually receives.
- Test sending cars to the unaffected depot as its own declared experiment; this model has no such policy.

**Proposed on-page copy** (panel header; lessons in Appendix B.4)

- **Pre-run header:** the §11.3.10 surface frame `regional-power`, verbatim (lengths 149/182/236). §11 wins on any difference.
  - what_why: "A depot loses part or all of its charging power for 90 minutes mid shift. How many trips does the fleet lose, and can charging order protect service?"
  - how: "Fictional Austin-inspired map, 40 cars, 2 depots, 8 hours. Site A power drops in minutes 90 to 180; Site B keeps 120 kW. Every run also has 1 port per depot out in minutes 60 to 120."
  - look_for: "Run each power condition and compare completed and unserved requests, then check whether the charging order comparison moves either."
  - ops_takeaway: "An ops team would check whether its depots sit at their power cap all day before planning for an event."
- **T2 pinned-finding candidate.** Pre-run header uses the §11 frame; this numeric line is a T2 pinned-finding candidate. It goes into `test/teaching-frames.grounding.json` and is never shown before a run: "Model output, 12 seeds: the outage removed 7.9 trips, mostly after power returned, and charging order moved completion less than the 2 point margin. Ops check: whether depots sit at their power cap all day." The artifact holds only the baseline means (the 7.9 is their difference); the timing clause comes from probes. The earlier draft's "a higher all-day power cap moved far more" is withdrawn: the 240 kW contrast raises both depots for the whole shift (about 1,920 kWh nominal against the 180 kWh the outage removes), so it is not comparable.
- **After a run:** the page shows only generated §11.3.4 lines: "Replay (Austin run)" for Run Austin shift, and "Paired" for Compare, placed above the test-pinned verdict sentences (`test/regional-power-d1.test.mjs:40-47`), which stay unchanged.
- **Fields.**
  - Run: `r.metrics.completed_trips`, `total_requests`, `unserved_requests`, and `r.extensions.charging.zero_power_vehicle_min`, plus the condition label and seed.
  - Compare: `r.analysis.primary.mean_delta`, `ci_low` and `ci_high` through the existing `thresholdFormat` (scale 100), the margin, `r.analysis.outcome`, and `guardrail_statuses` filtered to REGRESSED.
- **Page fixes.**
  - Add a catalog entry.
  - Give the condition question an answer: a side-by-side condition view built from the recorded artifact, or a lesson that sets each condition explicitly.
  - Show the inherited port outage before the run.
  - Round the floats (`regional-power-view.js:11` prints 436.13622410777884).
  - Map the en dashes from `bay-experiment-contract.js:60` and `:62`, which reach the status line when seeds are invalid, to clean display text at render (T1, UI layer). Fixing the model literal is T2.

**Lessons:** none in the catalog today. NEW: `austin-power-stress`, `austin-deadline-priority` (framed as stress variants of `shared-power` and `deadline-charging`, and cross-linked to them).

**Evidence:** `teaching-review/austin-launch/` probe-austin-*.mjs. Verified in `austin-launch-verify/` p-verify1.mjs and p-verify2.mjs (loss-by-request-window table, serial fill, missed deadlines).

### 12.5 Launch rehearsal

**What & why.** In this model, installed chargers add capacity only once commissioned. If new ports are switched on later than planned, how much rider service does a launch lose, and in which measures does it show? Launch teams sequence installation and commissioning tasks with owners. A slip changes how many cars can charge when demand arrives.

**How we simulate.** The Fleet day engine, run for 4 hours with 24 cars, 45 requests per hour and a 10-minute pickup target, seed 42.

- **Templates.** Region B is fictional and uses straight-line km. The Peninsula template uses real Bay anchors.
- **Region B depots.**
  - North: 120 kW site, 3 ports of 60 kW, 3 bays, 2 workers.
  - South: 60 kW site, 2 ports of 35 kW, 1 bay, 1 worker.
- **Cars.** Start at 35% charge, charge to 85%, and visit a depot after every trip.
- **What changes.** All 5 ports start installed but not commissioned. Their commissioning events fire at minute 0 in the baseline and at minute 0 + delay (default 90) in the candidate.
- **What stays fixed.** Region, demand, sites, tasks and seed. External requests are checked identical (`launch-rehearsal.js:72`), and a delay of 0 is an exact null treatment.
- **Setup checks.** An uninstalled port gives a REJECTED action with no capacity. A missing task owner fails setup validation and blocks the rehearsal.
- **Out of scope.** Real inspections, permits, launch authority, and any statistical confidence (one seed, descriptive).

**What you learn and the fleet-ops takeaway.**

1. **A slip removes the trips that arrive while cars wait for power.**
   - Model output, Region B, seed 42, delay 90: completed trips fall from 34 to 29 of 179.
   - Late pickups fall from 11 to 6 and missed pickups rise from 139 to 144. At request level, 10 late riders became missed and 5 missed riders became late.
   - The charging queue grows by 449 task-minutes, and end energy falls by 198 kWh.
   - At minute 89 of the delayed arm, all 24 cars sit in charging queues at 0 kW; the baseline has 5 charging, 18 queued and 1 at upload.
2. **The headline measure hides it.** On-time pickups stay at 24 in both arms. They are exactly one per car: each car's first trip, made before its first depot visit (all first visits start by minute 49). The current page leads with this measure and says "changed within-target pickups by 0" (`launch-view.js:36`).
3. **It holds across seeds.**
   - Model output, seeds 1-10, delay 90: Region B loses 5 to 6 completed trips in every run and the Peninsula 3 to 5, while on-time pickups move by -2 to +2.
   - Longer slips remove more: 180 or 240 minutes remove 10, and the two give identical service because a 240-minute slip leaves the ports off for the whole shift.
   - A 30-minute slip changes completed trips by 0.
4. **The baseline is also constrained.** Even with immediate commissioning, 18 of 24 cars are queued at minute 89. All-day port count and site power already limit service.

**Takeaways an ops team would test in its own operation:**

- Treat each port's commissioning task as a service-capacity item with a named owner and date, and rehearse a plausible slip against the local demand peak.
- Read completed trips and late-to-missed pickups over the slip window, not on-time pickups made before it.
- Keep a zero-delay run as a negative control.

**Proposed on-page copy** (Launch panel header)

- **Pre-run header:** the §11.3.10 surface frame `launch`, verbatim (lengths 154/203/231). §11 wins on any difference. It is template-agnostic: the Launch panel opens on the Peninsula template (`launch-view.js:56`), while the `region-launch` lesson runs Region B. This section's earlier what_why, which opened "Installed chargers count only once commissioned." as if it were a real-world fact, is withdrawn; stated as a model rule, it reads "In this model, installed chargers add capacity only once commissioned."
  - what_why: "If new charging ports come online 90 minutes late, how much rider service is lost? Launch teams need to know which commissioning dates carry service risk."
  - how: "Two runs of the chosen template, Peninsula by default or fictional Region B, on the same demand seed: ports commissioned at minute 0 versus minute 90. All else the same. Setup checks are not inspections."
  - look_for: "Read completed trips and late or missed pickups first; on time pickups made before the delay window cannot show it."
  - ops_takeaway: "An ops team would give each port commissioning task an owner and a date, then rehearse a slip against its own peak."
- **T2 pinned-finding candidate.** Pre-run header uses the §11 frame; this numeric line is a T2 pinned-finding candidate. It goes into `test/teaching-frames.grounding.json` and is never shown before a run: "Model output, Region B, seed 42: completed trips fell from 34 to 29 and missed pickups rose by 5. On-time pickups held at 24. Ops check: track each port commissioning date as a service risk and rehearse a slip." `test/launch-rehearsal.test.mjs` pins only the delay-0 null, and the line describes Region B, not the default Peninsula run the reader sees.
- **After a run:** the page shows only the generated §11.3.4 line ("One seed (launch)"), which leads with completed trips and names the template. It replaces the lead sentence at `launch-view.js:36`.
- **Fields.** `r.spec.delay_minutes`, the seed, the template name (region label mapped at render), per-arm completed trips and on-time pickups (baseline and candidate), and `r.comparison.deltas.completed_trips`, `pickup_missed`, `pickup_late` and `pickup_within_target`, signed by the existing formatter (ASCII "+" and hyphen-minus). Completed trips come first. The canonical line is §11.3.4 "One seed (launch)".
- **Page fixes.**
  - Replace the circular "Next experiment: Try Region B" (`scenario-learning.js:10`).
  - Remove "winner" (`launch-view.js:20`, a UI edit).
  - Map the em dash in the Region B label (`launch-rehearsal.js:19`, inside the launch config's `region.label`) and the en dashes in the range messages (`launch-contract.js:25`, `:29`) to clean display text at render (T1, UI layer). Source edits are T2.
  - Rename the "Candidate minus baseline" column "Change".
  - Scroll to and focus the panel when a lesson opens it (`studio.js:215`, `:248`).

**Lessons:** `region-launch`.

**Evidence:** `teaching-review/austin-launch/` probe-launch.mjs and probe-launch-timing.mjs. Verified in `austin-launch-verify/`. Test pins: `test/launch-rehearsal.test.mjs` (delay 0 null; planned ports without events add no service).

### 12.6 Street lab

**What & why.** What does one constrained downtown street do to a robotaxi-style fleet? The lab asks how many rider journeys still finish (including SFO-bound and East Bay-bound ones), how long pickups take, where vehicles get stuck, and whether routing around the queue helps on identical demand. Fleet time spent in a road queue delays the rider on board or the next pickup. A routing rule can add empty distance, or move the queue instead of removing it.

**How we simulate.** A frozen OpenStreetMap extract: 1,646 nodes, 2,343 directed links and 154 turn restrictions, with Market Street excluded.

- **Queues.** Each link is a first-in-first-out queue, stepped every 5 s.
  - Storage = floor(length x lanes / 7.5 m).
  - Discharge is 0.32 vehicles per second per lane.
  - Signal-tagged links are green 45 s of every 90 s.
  - A car leaves only when the next link has room (spillback).
  - A journey whose first link is full waits outside the network ("pending").
- **Fleet.** 24 AVs dispatched to the nearest available car by straight-line distance.
  - Requests expire after 30 min unassigned.
  - 2 off-road pickup berths with a 60 s dwell.
  - An 8-minute turnaround after each trip.
  - No repositioning.
- **Demand.** 36 requests per hour, about half starting at the hotspot anchor. Destinations: 40% SFO, 40% East Bay, 20% local.
- **Background traffic.** 900 vehicles per hour:
  - 60% on the focus hotspot's route;
  - 20% spread over all six hotspot routes (so about 63% on the focus route);
  - 20% gateway trips from the hotspot anchor.
- **Incident.** 75% discharge loss on the hotspot links from minute 15 to 90.
- **Route rules.** Free-flow takes the shortest free-flow time. Queue-aware adds current queues, full blocks and an incident penalty. Both are chosen only when a leg starts.
- **Comparison.** "Compare route policies" uses identical requests and background traffic (`test/street-simulation.test.mjs:20-25`).
- **Presets.** A preset changes only the hotspot. Preset buttons keep the reader's other edits; lesson links reset them.
- **Out of scope.** Individual pedestrians, buses and deliveries (represented only as lost capacity), lane changes, ramp metering, curb permission, charging, continuous rerouting, calibration, and multi-seed statistics on the page.

**What you learn and the fleet-ops takeaway.** Model output: 30 preset x seed pairs (seeds 42, 1, 2, 3, 4) plus sweeps. The reproducible limitation is that each run is one synthetic 2-hour day per seed.

1. **Most presets are not driven by their incident.**
   - Removing the 75% incident changes free-flow completions by -1 to +2 of 71 in five presets (seed 42).
   - Background volume drives First (49 finished with no other traffic, 37 at 900/h) and Embarcadero (44 and 14).
   - Stockton is the one incident case, and only together with traffic: 44 finish with no incident, 46 with no other traffic, 31 with both.
2. **Queue-aware routing mostly helps a little and nearly always adds empty distance.**
   - Completions: up in 26 of 30 pairs, level in 3, down in 1 (range -1 to +19).
   - Empty km rise in 28 of 30.
   - Large gains appear only in Stockton (+12 to +19), where AVs were stuck waiting to enter a full block at the pickup: 503 of 507 AV-minutes of entry wait were at the Chinatown anchor.
3. **Each preset has a different limit.**
   - Van Ness is supply-limited. 12, 24 and 36 AVs finish 22, 43 and 50, while the ride stays about 24 min, and 23.1 min with no other traffic.
   - First is street-limited. The ride is 28.2 min against 21.2 with no other traffic.
   - Stockton is pickup-exit-limited.
   - A flat ride time as the fleet grows does not by itself show a street limit; compare against a no-traffic run.
4. **Averages can hide a collapse.** In Embarcadero, mean pickup wait stays near 15 min while completions fall from 44 to 14 and 16 riders expire. The mean counts boarded riders only.
5. **The biggest queue can be off the named street.** Lombard seed 42: at the busiest moment 57 of 120 queued vehicles are on Hyde Street, against 25 on Lombard. They are SFO-bound gateway trips leaving the Lombard pickup. Capacity loss of 0, 75 or 95% on Lombard leaves 39 of 71 finished.
6. **The fleet moves the queue only at scale.**
   - At 24 AVs, queue-aware routes change the Harrison peak by 0 to 8 vehicles.
   - At 60 AVs and 120 requests per hour, it falls by 16 to 21 (seeds 42, 1, 2).
   - Seed 42 at 60 AVs: 126 vs 121 of 252 finished, with 202 km more empty distance.
7. **Label trap.** "Largest road queue, all links" (`summary.peak_queued`) is the total queued on all links at the busiest 5-second step, not one queue.

**Takeaways an ops team would test in its own operation:**

- Diagnose each corridor as supply-limited, street-limited or pickup-exit-limited, using a no-traffic baseline.
- Carry empty distance and neighbour-street queues as guardrails on any detour rule.
- On event days, judge by finished, expired and unfinished journeys.
- Re-test detours as fleet share grows.
- Never act on one seed: across five seeds, the sign of the empty-km change flips in First (-24 to +59 km).

**Proposed on-page copy** (Street lab header, replacing the lede)

- **Pre-run header:** the §11.3.10 surface frame `street`, verbatim (lengths 160/203/240). §11 wins on any difference. Its what_why says "trap": this section's earlier "can hold" draft tripped VERDICT_CLAIMS (`\bhold\b`) and is withdrawn.
  - what_why: "One constrained street can trap fleet vehicles in road queues. Street lab asks how many rider journeys still finish, and whether routing around the queue helps."
  - how: "Synthetic traffic on frozen OpenStreetMap SF streets. Each block holds a finite queue, and a full block stops the one behind it. Presets move the hotspot only; Compare runs two route rules on one demand."
  - look_for: "Read finished and expired journeys before pickup wait, which averages boarded riders only. Then find where the busiest queues sit."
  - ops_takeaway: "An ops team would test a routing or pickup change on its own trip records with empty distance as a guardrail."
- **After a run:** the page shows only generated §11.3.4 lines. After Compare route policies it uses "One seed (Street compare)" with the mixed-trade-off rule (rule 7). A single run uses the "Fleet day replay" pattern with Street's fields. This section keeps no second template.
- **Fields.**
  - Single run: `summary.completed`, `requests`, `expired`, `waiting` and `in_progress`, `config.duration_minutes`, and the seed.
  - Beneath the line, not in it: `summary.peak_queued` (labelled "Queued on all streets at the busiest moment"), `focus_label` and `focus_peak_queued` (from `network.hotspots` and `result.hotspots`), and `summary.pending`, the road journeys still waiting to enter a full first block at the end.
  - `off_corridor_min` = `summary.peak_queued` minus the sum of the six hotspot peaks, shown beneath the line only when it is positive: "At least {off_corridor_min} queued vehicles at the busiest moment were outside the six named corridors." This is a valid lower bound; it gives 49 for Lombard seed 42.
  - Compare: `comparison.*` (completed journeys per arm, empty km change, and busiest-moment queue change).
- **Page fixes.**
  - Keep one Run button inside `.street-intro` when the lede is replaced and "Start the street demo" and "Run street scenario" merge into one Run button (§11.3.7 item 5). `street-lab.test.mjs:53-60` clicks `.street-intro button` and expects focus on `.street-results h2` without scrolling; it is on the §11.5.4 must-stay-green list.
  - Rename "Largest road queue, all links" to "Queued on all streets at the busiest moment" (§11.3.10 label fixes).
  - Fix the literal "null" line (`street-lab.js:116`).
  - Replace "decision-grade" (`:61`) and "winner" (`:140`) with "What would make this ready for a real decision?" and "Neither route rule is ranked overall." (§11.3.10 label fixes).
  - When opened from a lesson, the status reads "Lesson loaded: {title}. Press Run when ready." (`:89`; §11.3.8).
  - State "Presets move the hotspot only", or give each preset a visible, declared setting change.
  - Put completed and expired journeys ahead of pickup wait.
  - Explain what "pending" journeys are.
  - Add an H-6 test for `street-lab.js`.

**Lessons:** `street-first`, `street-harrison`, `street-stockton`, `street-van-ness`, `street-embarcadero`, `street-lombard`. NEW: `street-fleet-share`.

**Evidence:** `teaching-review/street/` probe.mjs to probe7.mjs. Verified in `street-verify/` v1-v8.mjs. The Van Ness framing was refuted and is corrected here. Live Lombard check: 39/71 vs 43/71, matching exactly.

### 12.7 Four-area workbench and workspace

**What & why.** A deliberately coarse four-zone model: San Francisco, Peninsula, San Jose and East Bay, with depots SF-1, SF-2, SJ-1 and EB-1, 120 cars, and an overnight recall and morning release. It asks one fleet or depot question at a time. Does rider wait move beyond a stated margin, and what does the change trade on declared guardrails? Fleet and depot levers interact across areas and across the overnight cycle. A paired A/B with guardrails declared in advance is the habit that stops a team buying capacity that never reaches riders, or accepting a metric that improved only because riders left.

**How we simulate.** A discrete-event engine (`src/model/engine.js`) runs from day 1 05:00 to day 2 10:00, with metrics counted from 06:00.

- **Riders.** Synthetic Poisson requests per area and hour, peaking 07:00-09:00 and 16:00-19:00.
- **Demand is keyed on the scenario name, not the seed** (`world.js:225`). Every seed of a preset sees the same riders, and different presets see different riders.
- **Travel.** Two routes per zone pair, with hourly congestion multipliers. Legs between areas carry no in-area segment.
- **Travel variation.** 0 in Sandbox and Learn (every replay repeats), 0.15 in preset experiments (seeds vary travel times only).
- **Rules.**
  - The nearest idle car is dispatched, and a rider unassigned after 10 minutes leaves.
  - A car visits a depot every 10 trips: a 20-min clean, plus a 45-min service every 3rd visit.
  - At D2 00:30 idle cars are recalled to a depot. Cars ready at a depot can be dispatched overnight.
  - At 05:45 only cars standing at a depot outside their home area drive home.
- **Defaults.**
  - Fleet: SF 40, Peninsula 24, San Jose 32, East Bay 24.
  - Depots, as stalls / cleaning bays / service bays: SF-1 60/4/2, SF-2 30/2/1, SJ-1 30/3/1, EB-1 30/2/1.
- **Experiment.**
  - One declared change.
  - Baseline and candidate share a world per seed.
  - 20 paired seeds (1001-1020).
  - A 2,000-resample bootstrap interval keyed on the spec digest.
- **Verdict rules.**
  - Outcome: IMPROVED, REGRESSED, UNCHANGED or INCONCLUSIVE (`outcome.js:23-26`).
  - Recommendation (`recommendation.js:27-31`): HOLD if any guardrail regressed or the primary regressed; ADVANCE_TO_NEXT_TEST if the primary improved; RUN_MORE_EXPERIMENTS if it is inconclusive; otherwise NO_RECOMMENDATION.
- **How it differs from Fleet day.** There is no energy, staff, software or road geometry. On the other hand, it covers two days with recall and release. Fleet day's extension lessons also run paired experiments, so this is not the only paired surface.

**What you learn and the fleet-ops takeaway.** The 11 pinned verdicts (`test/presets.test.mjs:112-124`) reproduce exactly: seed set 1, 20 seeds, sigma 0.15, 2,000 resamples. Every verdict describes one rider draw per preset.

1. **The harness adds no noise of its own.** UC-01 gives a 0 s difference with interval [0, 0].
2. **A depot fix can shorten its own queue and still not reach riders.**
   - UC-08a (SF-1, 4 to 6 bays): SF-1's own bay wait p90 falls from 3,518.6 to 1,882.0 s (20 of 20 seeds; derived from the logs, not pinned). Rider wait p90 is UNCHANGED at -3.4 s (interval -10.2 to +0.4).
   - UC-10 is the positive control: moving 2 bays to SJ-1, which had 1, lowers rider wait p90 by 193.0 s (interval -237.6 to -143.2), ADVANCE_TO_NEXT_TEST, and SJ-1 bay wait p90 from 25,697.7 to 7,804.1 s.
3. **Declared guardrails decide.**
   - L2a and L2b are the same runs (San Jose evening p90 +25.3 s). L2a reads RUN_MORE_EXPERIMENTS. L2b adds an SJ-1 bay wait guardrail (harm 3,088.2 s against 600 s) and reads HOLD.
   - UC-03's wait p90 "improves" by 572.8 s only because unserved rises from 2.65% to 4.44%; the guardrail catches it.
4. **Conditions dwarf single levers.**
   - L1: a peaked demand shape adds 3,479.2 s to evening wait p90.
   - UC-05: evening highways going from free flow (x1.0) to x1.6 add 4,947.5 s to San Jose's evening p90. The map's own evening already reads 5,045.4 s, so this is measured from free flow.
   - Levers tried under the slowdown recover at most 187 s.
5. **Cars per area matter in the morning peak.**
   - Each 8 extra San Jose cars (16 to 24, 24 to 32, 32 to 40) cut morning p90 by 743, 801 and 991 s. The last two steps are exploratory.
   - Evening effects are much smaller: 20 more San Jose cars move L2's evening p90 by only 554 s.
6. **Depot rules move load.**
   - L3's nearest-depot rule reads IMPROVED on this preset's riders (SF morning p90 -646.5 s).
   - On four other rider draws it reads IMPROVED, INCONCLUSIVE with HOLD, INCONCLUSIVE, and REGRESSED with HOLD.
   - What holds in every draw: SF-2 gets no visits (the tie-break goes to SF-1 by id), and another lot fills.
7. **The rider draw is an unstated limit.**
   - UC-08a's UNCHANGED becomes INCONCLUSIVE on two other draws.
   - Verdict classes held on three draws for L1, L2a, UC-02, UC-03, UC-05, UC-08b and UC-10.
   - The Sandbox Bay map reads 0.50% unserved at sigma 0 and 0.58% at sigma 0.15. UC-01's riders read 4.16% even at sigma 0. The baseline gap between presets comes from the rider draw, not from travel variation.

**Takeaways an ops team would test in its own operation:**

- Build a baseline of wait and unserved share by area and hour, and bay wait by depot and hour.
- Run an A/A check first.
- Write guardrails before the run, including the resource being cut and every depot a rule can fill.
- Check whether a depot queue overlaps rider peaks before adding bays.
- Treat demand shape and slowdowns as exposure tests, then test responses with the condition held in both arms.
- Size fleets with a ladder.
- Decide the smallest practical difference first.
- Re-check any directional result on other demand draws.

**Proposed on-page copy** (workbench and workspace header, replacing `studio.js:197` and `:202`)

- **Pre-run header:** the §11.3.10 surface frame `workbench` (lengths 147/178/237), and the `four-area` frame on the Explore a day view. §11 wins on any difference; this section's earlier how and learn drafts are withdrawn.
  - what_why: "Four schematic Bay Area zones share 120 cars and four depots. Ask one fleet or depot question and see whether rider wait moves, and what it trades."
  - how: "Invented riders from day 1 05:00 to day 2 10:00, with an overnight recall. An experiment changes one setting, replays the same riders on 20 travel seeds and reads the paired gap."
  - look_for: "Read the recommendation with its guardrails, not the main result alone. Each case keeps one set of invented riders."
  - ops_takeaway: "An ops team would check what a result suggests measuring in its own operation, and not treat it as a reason to change it."
- **Must stay green (§11.5.4):** the model identity header built at `studio.js:147` ("Schematic four-area Bay Area zones ...; not road geometry") stays inside `.workspace-intro` when the intros at `studio.js:197` and `:202` are replaced, because `d1-presentation.test.mjs:47` matches it on the operations, depots and tour pages.
- **After a run:** the page shows only the generated §11.3.4 "Paired" line. This section keeps no second template.
- **Fields.**
  - `primary_words` = `metricWords(key)` (`charts.js:242`).
  - The numbers come through `valueWithMinutes` (`experiment.js:433`).
  - A guardrail is named, with `metricWords`, only when its status is REGRESSED. A HOLD from a regressed primary names no guardrail (§11.3.4 rule 3).
  - Length: at most 240 characters, reached by the overflow steps of §11.3.4 rule 11, which are not restated here. OPS-17 and OPS-19 each regress 3 guardrails on set 1.
  - The next test comes from the §11.3.4 Next test map.
  - "Model output; not evidence about a real fleet." sits in a fixed footer.
  - UC-01's change text is empty: render the §11.3.3 string "Changes: none; both arms use the same setting." (canonical), never "Result: ." or the word "null" (§11.5.4 test 4).
- **Page fixes.**
  - Use one model name, "Four-area experiments". Retire "workbench", "workspace" and "regional example".
  - **Not T1: needs a same-commit edit of design §1.3 and its own OD (§11.6).** Stop calling the outside harness "FleetLab" in reader copy and use "the reference harness". `labels.js:31-35` (verdict footer, axis tag, FLEET-005 and probe panel chips) are design §1.3 exact-copy rows pinned by `labels.test.mjs:333`, so T1 leaves them unchanged and only adds "Runs in this four-area model only" as a separate element next to the axis tag (§11.3.10 label fixes). The §11.3.10 `reference-panels` frame is new text that no design row pins, and it already says "the reference harness". The model header's "not interchangeable with other FleetLab models" (`model-identity.js:5`, built at `studio.js:147`) names this site's own models, not the outside harness, so it stays.
  - Show plain recommendation reasons before the enums.
  - Tag L1 and UC-05 as "Exposure test".
  - Beside the interval, say "20 seeds vary travel only; every seed sees the same riders; baselines of different presets are not comparable".
  - Remove "Travel variation is 0 in this preset" from the verdict card's limitations list, where it is false for every experiment (`labels.js:1084`).
  - Add a test binding each learn line's outcome word and "about" numbers to the pinned run (T2: T1 ships no non-OPS pinned readings).

**Lessons:** `bay_teaching_map`, `L1`, `L2a`, `L2b`, `L3`, `UC-01`, `UC-02`, `UC-03`, `UC-05`, `UC-08a`, `UC-08b`, `UC-10`. NEW: `L3b`, `UC-02-ladder`, `UC-05b`.

**Evidence:** `teaching-review/four-area-learn-exp/` run-presets.mjs, probes.mjs and probes2.mjs. Verified in `four-area-learn-exp-verify/` draw-robust.mjs, sigma-iso.mjs, uc05-context.mjs and l2-cars.mjs. SF-1 queue: `framing-verify/`.

### 12.8 Operations casebook

**What & why.** Twenty situations an operations lead meets, in five themes:

- San Francisco core peaks (OPS-01 to 04);
- a new-area launch (05 to 08);
- rain (09 to 12);
- crowds (13 to 16);
- police activity (17 to 20).

Each case is one proposed change, tested with a primary declared in advance ("what counts as helping riders") and guardrails with a maximum harm ("what it must not break"). The reader plays the ops lead. The lesson running through the casebook is that the effect often lands somewhere other than the obvious measure: on a depot, on the next morning, on a neighbouring area, or on a depot gate.

**How we simulate.** The four-area engine (12.7), with each situation played through its knobs as a proxy. Each proxy part is shown as "stands for / set as / misses".

- **Shared worlds.**
  - Rain world: congestion x1.35 on every road class on day 1 from 13:00 to 23:00, in-area pickups 2 min slower, and SF demand 75 per hour in peaks and 19 off-peak.
  - Event world: SF peak demand of 90.
  - Launch world: 12 East Bay cars, and EB-1 with 12 stalls, 1 cleaning bay and 1 service bay.
- **Run window.** Day 1 05:00 to day 2 10:00, so a knob set "on both days" acts on the day 1 peaks and the day 2 morning only.
- **What changes.** One axis. Everything else stays fixed, including the request stream, which is keyed by the case slug.
- **Seeds.** Seeds and seed sets vary travel only (sigma 0.15). Each run uses 20 paired seeds and 2,000 resamples.
- **Verdict rules.** As in 12.7. Any regressed guardrail gives HOLD.
- **Out of scope everywhere.** Staff and shifts, depot hours, charging, cancellations after assignment, repositioning, and effects that switch on partway through a day.

**What you learn and the fleet-ops takeaway.**

- **Reproduction.** All 20 cases reproduce `test/ops-cases.pins.json` exactly on seed sets 1, 2 and 3 (60 runs): label, outcome, recommendation, mean, interval and every guardrail harm.
- **Tally, seed set 1** (identical words on sets 2 and 3).
  - Outcomes: IMPROVED 7, REGRESSED 7, INCONCLUSIVE 5, UNCHANGED 1.
  - Recommendations: HOLD 14, ADVANCE_TO_NEXT_TEST 4, RUN_MORE_EXPERIMENTS 2.
  - In 7 of the 14 HOLDs the primary alone would not have held the change:
    - IMPROVED with HOLD: OPS-01, 05, 15;
    - INCONCLUSIVE with HOLD: OPS-08, 09, 11;
    - UNCHANGED with HOLD: OPS-20.

Across cases:

1. **A street gain often lands on a depot.**
   - OPS-01: +12 SF cars cut evening wait p90 by 1,565.6 s. SF-2 bay wait rises 2,364.4 s against a 1,800 s allowance, so HOLD. The next morning also improved (-832.1 s), so the HOLD rests on the chosen 30-minute allowance.
   - Also OPS-05 (EB-1 turns cars away) and OPS-15 (EB-1 bays and lot).
2. **A depot rule moves load to another depot without a clear rider change (OPS-08).** SF-1 takes the night wave (its lot and bay wait guardrails regress), while the primary is INCONCLUSIVE (+71.9 s, interval -123.7 to +257.2, a worse point estimate). The primary reads REGRESSED on 3 of 4 other demand draws.
3. **Harm moves to other hours and areas.**
   - OPS-06: SF unserved +3.1 points, from a surge next door.
   - OPS-14: East Bay unserved +14.2 to +16.6 points from an SF event.
   - OPS-18: harm lands on the next morning.
   - OPS-09 and OPS-11: only a whole-run or readiness guardrail catches it.
4. **Unserved share, not the wait tail, shows a shortage.** A rider with no car in 10 minutes leaves and is not in the wait figure (OPS-14, OPS-16).
5. **Some changes land only on a resource.** OPS-20 leaves rider wait inside its band while 1.6 to 1.9 cars per run are turned away; only a zero-limit gate guardrail sees it.
6. **INCONCLUSIVE carries information.** OPS-04's interval sits wholly above zero (+22.6 to +118.1 s) but straddles the +30 s margin. OPS-07 cuts EB-1 bay wait by 3,767 s with no clear rider benefit.
7. **Guardrail status can differ by seed set.** OPS-16's SF wait guardrail regresses only on set 3. OPS-18's Peninsula wait is WITHIN on set 2, and its SF unserved regresses only on set 3.
8. **Demand-draw limit.** Every case uses one fixed demand trace. On four other demand draws (OPS-01 to 10, exploratory):
   - OPS-03 reads HOLD on 3 of 4;
   - OPS-04 ranges from below zero to REGRESSED with HOLD;
   - OPS-08's primary reads REGRESSED on 3 of 4;
   - the other seven hold their recommendation.
   - OPS-11 to 20 have not been tested on other draws.

**Takeaways an ops team would test in its own operation:**

- Treat every fleet change as a depot change: size the overnight wave first.
- Guard the neighbouring area and the whole run, not only the window of concern.
- Decide the guardrail list as policy before the run. OPS-02 flips to HOLD on all three seed sets once a 06:00-07:00 readiness guardrail is added (exploratory).
- Check when a depot queue happens relative to release and peak.
- Scope depot rules to the area they fix.
- Split weather scenarios into demand and speed.
- Read INCONCLUSIVE as a prompt to check the margin and the mechanism.

**Proposed on-page copy** (casebook header in the catalog and above the SITUATION block)

- what_why: "Twenty situations an ops lead meets: peaks, recalls, launches, rain, crowds and police activity. Each tests one change and what it pushes elsewhere."
- how: "You play the ops lead. One setting changes; both runs see the same riders, and 20 paired seeds vary only travel times. A 95% interval must clear the margin; any guardrail past its max harm stops the change."
- learn: "Read every guardrail, not only the main result: in these cases the main result and a guardrail can point different ways, on a depot, a neighbour area or the next morning. Invented numbers, not advice."
  - This replaces the earlier "On 3 seed sets, checked by tests: effects often land later or elsewhere ...". The tests assert verdicts only, not that generalization, and pre-run casebook header copy must never name a direction (design line 603).
- **After a run:** the generated §11.3.4 "Paired" line (12.7), then the gated casebook reading:
  - when `view.label` equals one of the case's three pinned labels and the outcome and recommendation match: "Casebook reading, checked by tests", followed by the case's reading template filled for that seed set: §11.3.4's template for OPS-01, the Appendix B.8 template for the other 19;
  - otherwise: "Your setup differs from {id}, so only this run is described."
- **Gate (needs owner decision OD-T1, recommended yes).**
  - `{reading}` is the case's reading template, shown only after a run: for OPS-01 the §11.3.4 casebook reading template (canonical; B.8 repeats it), and for the other cases the Appendix B.8 LEARN template up to "Ops check:". The "Ops check:" clause is the source for the static ops_takeaway (rewritten to the §11.3.5 form) and is not repeated in the reading.
  - It accepts all three pinned labels, since "Use another seed set" reaches sets 2 and 3.
  - **Readings are slot templates.** Static words plus numeric slots filled from the reader's own verdict, in the §11.3.4 slot legend (canonical; B.8 restates it): the seed set, the primary mean delta, guardrail harms in declared order, and a stored descriptive's baseline or candidate value, the same slot sources as the §11.5.3 schema. A declared setting that is the same on all three sets, such as an allowance, may stay static text; test 5 checks it against each set's pinned `max_harm` or margin. Seconds show as minutes through the minutes half of `valueWithMinutes`, so no number is retyped; for example, the page shows +2,964.8 s where the design doc prints 2964.9. A clause stays static only when it holds on all three sets, and every direction word is such a clause.
  - **Test** (extends §11.5.4 test 5): for each of sets 1, 2 and 3, fill the reading from that set's verdict, then assert every number against that set's pins, every static direction and status against all three sets, every static declared number (such as OPS-01's 30 min allowance) against that set's pinned `max_harm` or margin, that no nonzero value fills as zero, and a filled length of at most 240. Extend `assertPinned` (`test/ops-cases.test.mjs:47-58`) to compare any stored descriptive a reading cites (OPS-08's turn-away slots, OPS-19's cleaning bay wait bound), as §11.5.4 test 5 asks.
  - Probe-only clauses are dropped from the templates; Appendix B.8 names each one.
  - Pre-run lines pass VERDICT_CLAIMS, and case records carry no lesson field (`test/ops-cases.test.mjs:112-116`).
- **Page fixes.**
  - Make the workbench header case-aware; today it always describes the 4 vs 6 bay example (`studio.js:202`).
  - Catalog: Learn shows the situation, not a lesson (`simulation-catalog.js:45`); Change and Watch use engine ids (`:43-44`).
  - Put the question and what_why first, with proxy, "Outside this model" and Watch behind a disclosure.
  - **Not T1:** "Teaching-model axis: FleetLab cannot run this" (`labels.js:32`) is a design §1.3 exact-copy row pinned by `labels.test.mjs:333`. Rewording it needs a same-commit edit of design §1.3 and its own OD (§11.6), the same OD as in 12.7. In T1 the row stays, and "Runs in this four-area model only" is added beside it.
  - The Experiment verdict card has no trade-off or takeaway section; `tradeOffSentence` renders only in the walkthrough readout. Add the generated §11.3.4 "Paired" line to `renderVerdictCard` (`experiment.js:645`), with plain metric words instead of raw ids.
  - Distinguish "straddles the margin" from "crosses zero" in the INCONCLUSIVE reason (`labels.js:500`).
  - Fix the design-doc unit slips: max harm 2 cars at `:655` and 1 car at `:684`.

**Lessons:** `OPS-01` to `OPS-20`. NEW: `OPS-02b`, `OPS-10b`, `OPS-12-contrast`, `OPS-19-followup`, `OPS-20-followup`.

**Evidence:** `teaching-review/casebook-1/` and `casebook-2/` (verify-pins, probes, variants). Verified in `casebook-1-verify/` (pins3.mjs, draws.mjs, mech.mjs) and `casebook-2-verify/` (verify30.mjs, explore-verify.mjs, pickups.mjs, card.mjs).

### 12.9 Guided walkthrough and framing pages

**What & why.** The site as a whole teaches one idea: riders wait when cars are busy somewhere else, whether driving, charging, cleaning, queued at a depot or held in a street queue. Every lesson is a version of one question: which resource actually limits rider service, and does a proposed change help riders without harming something else? Cars, bays, ports and sites are slow to add, and the busiest resource is often not the one that limits riders. Today the Overview, catalog, walkthrough and Product approach pages name models, knobs and a theme ("Every great ride starts with a ready fleet."), but never state this question. A newcomer meets 56 cards without knowing which decision each one informs.

**How we simulate.** Three separate, synthetic, browser-only models whose results are not interchangeable:

- **Fleet day** (12.1 to 12.5): an 8-hour Bay Area window with energy and depot work. It runs one replay per setting, plus same-demand capacity and mix trials, and opt-in paired extensions.
- **Street lab** (12.6): SF block queues, one seed, a same-demand routing comparison.
- **Four-area experiments** (12.7, 12.8): one declared change, 20 paired seeds.

The guided walkthrough (`#/walkthrough`) plays OPS-01 at seed 1001, with its verdict computed over seeds 1001-1020. It is the only surface that walks a whole decision: question, day, verdict, trade-off. All 56 lessons map exactly once onto 8 ops-question families:

- Fleet size and supply (6);
- Depot work and capacity (14);
- Energy and charging (5);
- Recall, release and depot choice (4);
- Demand, crowds and weather (9);
- Roads and streets (9);
- Launching a new area (5);
- Reading a run and a result (4).

These are the §11.4 family names.

**What you learn and the fleet-ops takeaway.** All model output:

1. **Car count is not service capacity, and the binding resource depends on fleet size.**
   - Default Fleet day, seed 42: 12, 24, 36 and 48 cars complete 60, 95, 147 and 197 of 284.
   - At 24 cars, 1 to 6 depots give 79 to 111. At 48 cars they give 168 to 236.
2. **A result is a main measure plus guardrails, and guardrails can decide.**
   - OPS-01 (20 paired seeds): IMPROVED (-1,565.6 s), HOLD on SF-2 overnight bay wait.
   - Seed 1001's baseline shows the mechanism: at 02:00, 21 cars queue at SF-2 with 25 of 30 stalls full. One car waits 250 min for a bay and is ready at 05:54, after the 05:45 release.
   - The walkthrough replays the 40-car baseline. Half of the 12 extra cars are homed at SF-2.
3. **A depot fix can shorten its own queue without reaching riders.** UC-08a against UC-10 (12.7).
4. **Depot efficiency is not rider service.** UC-08b cuts bay wait p90 from 7,466.5 to 4,963.1 s, while rider wait moves -32.2 s: INCONCLUSIVE.
5. **Declared guardrails shape the verdict.** L2a against L2b.
6. **One replay is a story, not a result.** OPS-01 baseline wait p90 ranges from 2,418 to 2,772 s across seeds 1001-1005.
7. **Most casebook changes are held by a guardrail.** 14 of 20 read HOLD: 13 with a guardrail past its limit, and in 7 of those the main result alone would not have held the change (12.8); OPS-13 is held by its main result alone.

**Takeaways an ops team would test in its own operation:**

- Before adding capacity, sweep one resource at a time on identical demand, and rerun the sweep after each change.
- Plan where extra peak cars sleep.
- Add bays where the queue reaches riders, not only where a queue exists.
- Give every depot-efficiency project a rider-facing primary.
- Declare guardrails for every resource a change can load.
- Treat one replay as descriptive.
- For routing changes, track empty distance. Street default, seed 42: +4 completed trips and +37.5 empty km under queue-aware routing. Other seeds give 0 to +6 trips and -38.5 to +59.1 km.

**Proposed on-page copy**

- Site header (Overview hero). Its what_why is the §11.3.10 Overview hero lede, verbatim; §11 wins on any difference, and this section's earlier hero line is withdrawn. The catalog intro is the catalog block below, whose what_why equals the §11.3.10 catalog why line.
  - what_why (Overview hero lede, §11.3.10): "Riders wait when cars are busy elsewhere. Find out which work between rides limits service: driving, charging, cleaning or a street queue."
  - how: "Three synthetic browser models: Fleet day (an 8 hour Bay Area window with energy and depot work), Street lab (block queues) and Four-area experiments (20 paired seeds). Each lesson says what stays fixed."
  - learn: "Each lesson ends with what the run showed, what it trades and a next test. Read the main result with its guardrails: a change can help riders in one place and overload a depot in another. Teaching output, not evidence."
- Overview decision cards (`studio.js:62-64`):
  - card 01 what_why: "Riders go unserved when every car is busy. Is the limit the number of cars, charging or depot time?"
  - card 01 how: "Fleet day: one synthetic 8 hour Bay Area window. Compare 12 to 48 cars, then 1 to 6 depots, on identical demand. One replay per setting."
  - card 01 learn: "See which change moves completed trips at this fleet size, and rerun the sweep at other fleet sizes. Test the resource that limits riders before adding one that is merely busy."
  - card 02 what_why: "Bays are slow to add. Extra bays help riders when the bay queue is what delays them."
  - card 02 how: "Four-area experiments: SF-1 with 4 or 6 cleaning bays on the same demand, 20 paired seeds. Rider wait p90 is the main result; unserved share is the guardrail."
  - card 02 learn: "Read rider wait next to SF-1's own bay wait. A depot queue can shrink while rider wait stays inside the margin. Then ask whether the cars in that queue were ones riders needed."
  - card 03 what_why: "A constrained ramp can trap cars across several upstream blocks. Does that street queue limit rider service?"
  - card 03 how: "Street lab: directed SF streets with finite queues and a 75% capacity loss at the ramp from 16:15 to 17:30. Free-flow and queue-aware routing run on the same demand, one seed."
  - card 03 learn: "Read completed trips, pickup wait and empty distance together: a routing change can move them in different directions."
- Catalog (h1 "Which lesson answers my question?"; filter by operations-question family first, model second; card rows use the OD-T6 part labels "What & why / How we simulate / Learning & ops takeaway", with limits in a disclosure; one CTA, "Run this lesson"; the evidence chip comes from the §11.3.2 enum, `replay`, `one-seed` or `paired`, rendered as "One replay", "One seed, same demand" or "Paired test, {n} seeds"; {n} is read from the spec at render time: 12 on the Fleet day paired contracts, 20 on four-area experiments. Staffing, capacity, mix, launch and Street compare are `one-seed`):
  - catalog what_why: "Every lesson answers one fleet operations question. Find yours by the decision you face, not by the model behind it."
  - catalog how: "Each card says what changes, what stays fixed, which model runs it, and whether the result is one replay, one seed on the same demand or a paired test."
  - catalog learn: "Each card names the decision it informs and what to read. After a run, the card shows what happened and a next test to try."
- Walkthrough, T1 (intro copy only, per OD-T7). The h1 and paragraph are the §11.3.10 intro copy; §11 wins on any difference. Nothing else in the walkthrough changes in T1.
  - Intro h1: "One question, one day, one verdict."
  - Intro paragraph: "OPS-01 asks whether 52 San Francisco cars instead of 40 change evening rider wait. Watch the day, read the verdict, then see what it trades and what to test next."
- Walkthrough structure proposals: **T2 or OD-T7, not T1.** Each one changes a pinned test: `present.test.mjs:151-154` pins the chapter keys and `BEAT_ORDER.length` 11, `:925-930` pins the last beat's refusal list, and `:978` pins the `specSentence` arguments.
  - New beat 0 (in T1 its content stays in the intro):
    - beat 0 what_why: "OPS-01 asks: does starting the day with 52 San Francisco cars instead of 40 change San Francisco rider wait p90 in the day 1 evening peak?"
    - beat 0 how: "Both arms run the same synthetic day and night with the same riders; only the San Francisco car count differs. 20 paired seeds, a 60 s margin and two guardrails are frozen first."
    - beat 0 learn: "The verdict chapter shows the call, and the last chapter names what it trades. A guardrail past its limit stops the change, whatever the main result shows."
  - Chapter renames, listed under OD-T7: "1 What happened", "2 What the test says", "3 How it is simulated", "4 What to test next".
  - Chapter 3 reorder: the arms beat first.
  - The last beat adds the Next test line (§11.3.4 map).
  - The product-design refusal list moves behind a disclosure titled "What this walkthrough leaves out" (the §11.3.10 label fix, which §11 also assigns to OD-T7).
  - `specSentence` uses `differenceText` instead of the axis id.
- Product approach worked example (UC-08a):
  - approach what_why: "Depot leads add bays to cut depot delay. The question that matters is whether riders notice."
  - approach how: "UC-08a: SF-1 with 4 or 6 cleaning bays, same demand, 20 paired seeds. Rider wait p90 is the main result, with a 30 s margin; unserved share is the guardrail."
  - approach learn: "If SF-1's own bay wait shrinks while rider wait stays inside the margin, the bays relieved a queue riders did not feel. Check when queued cars are needed before adding capacity."
  - Role rows get "Try:" links:
    - market lead: `fleet-day`, `OPS-01`, `UC-02`;
    - depot lead: `UC-08a`, `UC-08b`, `staffing-readiness`;
    - planning partner: `depot-count`, `region-launch`, `OPS-05` to `OPS-08`.
- **Next test line:** the §11.3.4 Next test map is canonical. It is keyed by the reason the existing chain already selects (`experiment.js:384`) and is used by every paired after-run line. This section's earlier map, whose texts differed from §11's, is withdrawn.
- **One-replay after-run line** (Fleet day, Street): the §11.3.4 "Fleet day replay" template, with Street's fields on Street lab. No second template is kept here.
- **Page fixes.**
  - Link the walkthrough from the Overview hero.
  - Link each depot explorer stage to the lesson that answers it:
    - Arrive: L3 and OPS-08;
    - Clean: UC-08a and UC-08b;
    - Service: OPS-19;
    - Ready: OPS-04.
  - Replace raw metric keys in `scenario-learning.js:24` with `metricWords`.

**Lessons:** none of its own. The walkthrough plays `OPS-01` (12.8). The Overview cards link `fleet-day` (12.1), `UC-08a` (12.7) and `street-first` (12.6).

**Evidence:** `teaching-review/framing/` probe-*.mjs and fill-template.mjs. Verified in `framing-verify/` v-*.mjs, which refuted the original UC-08a reading and corrected it here.

### 12.10 N2 event curb lab (planned)

**What & why.** Two event crowds leave one pickup hub close together. The hub has a capped approach lane and a few boarding berths. Two questions:

1. Does moving cars toward the hub ahead of time, from published crowd estimates ("Stage from published crowd estimates"), get more riders boarded on time than dispatching only when requests appear ("Respond to requests")?
2. Who absorbs the harm? The candidates are background riders who never use the hub, requests turned away by a full approach, staging distance and energy, staged cars left unused, and depot work pushed past the horizon.

Event egress is a recurring surge, and pre-positioning is the intuitive lever. But staging uses the same finite curb and fleet. The lab is built so that null, mixed and adverse results are all useful answers, and a favourable result is not acceptance.

**How we simulate.** No N2 model exists, so nothing N2 has been run. The planned mechanics (v2 design, `L109-L127`):

- **Engine and graph.** One Bay lifecycle and energy ledger with opt-in curb ownership, on a fictional Las Vegas-inspired graph (west, north, central, east and hub). Depots are west and east. One-minute steps.
- **Riders.** Background riders travel only between the ordinary places. Two event waves are hub-only pickups.
- **Curb rules.**
  - Dispatch is curb-first. If cars driving in plus cars queued already fill the approach cap, a hub request is turned away for that minute and keeps waiting.
  - Arrived cars take free berths, at most one boarding start per berth per minute.
  - In the staging arm only, the hub keeps up to S cars staged once an estimate's window opens; staging picks the nearest eligible car (OD-5).
- **On time** means boarding began within T min of the request, not car arrival.
- **What changes.** Only `events.policy`.
- **What stays fixed.** Region, seed, every rider row, the estimate and condition tapes, the fleet and placement.
- **Synthetic.** The graph, demand, walking, dwell, access, vehicles and estimates. The approach is a reservation cap, not road spillback. Riders never abandon after assignment.
- **Suggested, unregistered values.** Fleet 40, horizon 240, T 10, 2 berths, approach 4, staging 6, two waves of 40 parties, background 20 per hour. Seeds: tuning 2501-2512 and evaluation 3501-3512, margin 0.02. S1 freezes these.
- **Grounding used here instead of N2 runs.**
  - The prior audit's reactive-only rough model of the planned hub rules (no energy, depots or staging arm; seeds 9101-9112).
  - The shipped airport lesson (12.3).

**What you learn and the fleet-ops takeaway.** The lab will answer, per registered cell:

- Q1. Did staging move completion outside the plus or minus 2-point band? (primary)
- Q2. Did event riders board on time more often? (descriptive, shown right under the lead line)
- Q3. Who paid? Background rows count against the result and cannot be offset by event gains.
- Q4. Could this cell have shown a gain at all?
- Q5. In a false-alarm cell, what does staging use up when the crowd never comes?

How to read each result:

- **ADVANCE_TO_NEXT_TEST:** the whole 95% interval of the completion change sat above +2 points, and every required guardrail stayed within its allowance. The next step is another simulation test, not a rollout.
- **HOLD:** name who paid.
- **NO_RECOMMENDATION:** compare the curb-room line with the smallest detectable change. A small reachable gap can mean the curb already limits boarding, or that nearly every rider is already served.
- **RUN_MORE_EXPERIMENTS:** only the registered extension rule may add seeds.

What the grounding runs show (not N2 results):

1. **The approach cap, held by cars still driving in, limits riders, not berths or car supply.**
   - Rough model, seeds 9101-9112, overlap timing, patience 12, 4-minute boarding: completion 0.642, event on-time boarding 0.049. An idle car existed in every minute a rider was turned away.
   - A third berth or zero dwell: +0.005, UNCHANGED.
   - An approach cap of 8: +0.041, IMPROVED, but event on-time boarding +0.000, because assigned riders never give up in this model.
   - Only zero drive time lifted both: +0.041 completion and +0.094 on-time boarding.
2. **Timing interacts with rider patience.** Separated waves leave more room than overlapping ones at patience 12 to 30 (bound gap 0.082 vs 0.041 at patience 12). At patience 60 the order reverses (0.007 vs 0.061).
3. **Completion can stay flat while timeliness moves.** Airport lesson, seeds 1001-1012: on-time pickups rose from 0.343 to 0.504, completion was UNCHANGED, and the result was HOLD.
   - Of the 23.7 kWh drop in end energy, +18.0 kWh was extra driving (+67 km per seed) and 5.7 kWh was less charging. A null-treatment run reads 0 on every guardrail.

**Takeaways an ops team would test in its own operation:**

- Measure whether cars driving in hold the pickup-zone approach before adding berths or staging.
- Judge staging on on-time boarding for event and non-event riders together.
- Count staging trips, km, kWh and unused staged cars.
- Test a crowd estimate that is wrong or never materialises.
- Test more than one timing and patience level.

**Proposed on-page copy** (planned panel header; lesson card in Appendix B.10)

- what_why: "Two crowds leave one event hub close together and the curb has few pickup berths. Does staging cars early help riders board on time, and whose service pays?"
- how: "One fictional Las Vegas-inspired hub, two synthetic crowd waves, a capped approach lane and few berths. Both runs share every rider, car and seed; only the policy differs. No real venue or road spillback."
- learn: "Staging only shortens the drive to the hub; it adds no berths or lane space. Read the lead line, then on-time boarding for event and background riders, then staging km. If the curb left little room, staging could not lift completion."
- **After a run:** the §11.3.4 "Paired" line, led by the §11.3.4 map words (for ADVANCE_TO_NEXT_TEST: "Advance to the next simulation test, not a rollout"). This section keeps no second template or lead line; the earlier draft ran to 646 characters before filling, against the 240 cap.
- **Fields, shown in a table beneath the line, not in it:**
  - event riders boarding within {T} min, as the change in points against Respond to requests;
  - background riders, who never use the hub: the change in on-time boarding and in completion, each with its allowed decline;
  - staging trips, km and kWh per seed, and staged cars unused at minute {H};
  - the largest completion gain this curb left room for (tuning seeds, set before evaluation);
  - the smallest change this test can detect.
- **Arm names:** "Respond to requests" and "Stage from published crowd estimates". "Forecast" is allowed only in identifiers.
- **Required before implementation:**
  - Add the N2 view module to `COPY_MODULES`.
  - Label each guardrail row with what it measures; only three of the eight measure the service trade-off.
  - Add one pre-run sentence: "Unlike the airport wave option above, on time here means boarding began within {T} min of the request, not car arrival."
  - Record the owner-accepted decisions (OD-10 to OD-14, OD-18, OD-24, OD-25, P1-B) in the audit file, which still lists only OD-1, 3, 4, 5, 6 and 19 as decided.
  - Note OD-17 (drop the long-boarding overlap cell) beside that example.

**Lessons:** none yet. NEW: `event-curb-staging`, the one permitted 57th lesson, with an explicit change to `test/navigation.test.mjs:14` from 56 to 57.

**Evidence:** `teaching-review/n2-planned/` (grid.mjs, tapebound.mjs, teleport.mjs, toycheck.mjs, airport-ref*.mjs). Verified in `n2-planned-verify/` (levers.mjs, airport-energy2.mjs, airport-null.mjs).

## 13. Implementation plan and Codex prompts

The owner's decisions recorded on 2026-09-26 make the next three tasks concrete. Run them in order, one at a time. Each starts from the previous task's final commit.

| # | Task | Kind | Prompt | Needs before start | Deploys? |
|---|---|---|---|---|---|
| 1 | N2 design v2.1 | Docs only | §10 | Nothing more; OD-1/3/4/5/6/19 are embedded as DECIDED | No |
| 2 | Packer route A: offline-only removal of full-line comments | Tooling | §13.2 | Nothing (independent of Task 1, but run after it to keep one line of history) | No (the hosted site is unchanged) |
| 3 | T1 teaching frame | Presentation | §13.3 | Task 2 committed; OD-2 with package T; OD-T1, OD-T2 and OD-T4 to OD-T7 | Only if the launching message authorizes it |

### 13.1 Task 1: N2 design v2.1

Use the §10 prompt as written. Suggested launching message:

```text
Execute the §10 prompt in docs/FLEETLAB_N2_V2_DESIGN_FEEDBACK.md. The owner's DECIDED ODs (OD-1, OD-3, OD-4, OD-5, OD-6, OD-19) are already embedded; every other OD stays PENDING. You may commit only the v2.1 file by explicit path. Do not push.
```

### 13.2 Task 2: packer route A

Suggested launching message: "Execute the §13.2 prompt in docs/FLEETLAB_N2_V2_DESIGN_FEEDBACK.md. Commit on a new branch after all gates pass. Do not push."

```text
TASK: Offline-only removal of full-line comments in the FleetLab packer (budget route A; owner DECIDED 2026-09-26 as OD-1).

Read first: docs/FLEETLAB_N2_V2_DESIGN_FEEDBACK.md §4.1, §4.3 and §4.6. The offline single-file package (node playground/fleetlab/tools/pack.mjs --out <file>) is 2,551,878 bytes against an unchanged 2,621,440-byte limit (APP_MAX_BYTES in playground/fleetlab/tools/media.mjs:2). A scratch experiment during the design audit removed full-line comments from the offline build only. The result was 2,251,402 bytes, 300,476 fewer. Code tokens were identical across all 107 page and worker module renders, and the packed worker reproduced the event-log digest (10,153 events), world digest, metrics and series. The page bundle initialized, and check-dist reported 0 problems. This task makes that change properly, with checks built into the build.

HARD RULES
1. Scope:
   - Allowed: playground/fleetlab/tools/pack.mjs; a new helper under playground/fleetlab/tools/ only if it has real reuse or nontrivial logic (otherwise inline it); new or changed tests under playground/fleetlab/test/; the docs named in rule 7.
   - Not allowed: any change under playground/fleetlab/src/, to APP_MAX_BYTES, or to the --site output bytes. No new dependency of any kind (runtime or dev).
2. Opt-in and offline-only. Pass stripping only from the offline HTML build path (buildHtml or its equivalent). bundle() and its other callers, including test/pack.test.mjs (~:206-208, which asserts that comment text such as "/* export function ghost() {} */" survives bundle()), must stay byte-identical. Hash the full --site output before and after; it must not change.
3. Per-comment rule. The line-level guard first proposed in the audit is UNSAFE: a block comment that starts after code on the same line would be left open.
   - Remove a comment only when both its first line and its last line hold no code tokens.
   - Detection must be lexer-aware: never treat // or /* inside a string, a template literal (including nested ${} expressions) or a regular-expression literal as a comment.
   - Keep any license, @preserve, sourceMappingURL or sourceURL comment if one exists (check and report).
   - Keep directives such as "use strict".
4. Built-in verification that fails the pack on any mismatch. For every module, check that the stripped text has exactly the same token sequence as the original, using a small zero-dependency tokenizer written for this purpose. If you judge a tokenizer insufficient, add a compile check per module (node:vm SourceTextModule or equivalent) and state why. Either way, rule 5 applies too.
5. Acceptance tests:
   a. Stripper unit tests for these adversarial cases:
      - a block comment that starts after code on the same line;
      - a block comment that ends before code on the same line;
      - comment markers inside single-quoted, double-quoted and template strings, including ${} nesting;
      - regex literals containing // or /*;
      - URLs inside strings;
      - multi-line JSDoc blocks;
      - a line comment at end of file with no trailing newline;
      - CRLF input.
   b. For a fixed seed, the packed offline worker reproduces the event-log digest, world digest, metrics and series produced by the unpacked source.
   c. The page bundle of the stripped offline file initializes on the fake DOM (test/helpers/fake-dom.mjs).
   d. check-dist reports 0 problems for both outputs:
        node playground/fleetlab/tools/check-dist.mjs --site dist/site
        node playground/fleetlab/tools/check-dist.mjs dist/fleetlab-playground.html
   e. The full suite passes with the previous counts plus the new tests, zero failures:
        FLEET_PLAYGROUND_PERF=1 node --test --test-concurrency=1 playground/fleetlab/test/*.test.mjs
      If a wall-clock performance test fails in the full run, re-run it once in isolation and record both results. It is a blocker only if the isolated run also fails.
6. Measure and record:
   - offline bytes before and after (report the exact delta; about -300 KB is expected);
   - --site hash equality;
   - the new offline headroom against 2,621,440.
7. Documentation:
   - One short paragraph in docs/FLEETLAB_CLOUDFLARE_DEPLOYMENT.md stating that the offline file is a behavior-equivalent build with full-line comments removed, not a byte-faithful concatenation of the source, and how that is checked.
   - One dated entry in HERMES_SOURCE_OF_TRUTH.md §7.5. Update in place; add no new status document.
8. Git discipline:
   - Create a new branch from the current HEAD, for example codex/fleetlab-packer-comment-strip.
   - Stage only by explicit path, after reviewing `git status --short` and `git diff --cached --stat`.
   - Never stage, edit or delete the owner's untracked FleetLab-ChatGPT-review-and-next-phase.md, dist/ or artifacts/.
   - Commit only after every gate passes.
   - Do not push, deploy or open a PR unless the launching message says so. No force, no history rewrite.
9. The repository is public: no personal data, emails, tokens or absolute home paths in code, tests or docs.

STOP CONDITIONS
- Any module's token check fails and cannot be fixed without weakening the per-comment rule.
- --site output bytes change.
- The worker digest check or check-dist fails.
- The change would need a dependency or an edit under src/.
Stop, record the evidence and report.

REPORT
- The stripper design and the verification method, with the reason for that choice.
- The adversarial test list.
- Offline bytes before and after, and the new headroom.
- --site hash equality.
- Suite counts.
- Any comment kinds kept, and why.
- Commit SHA, or the reason for stopping.
```

### 13.3 Task 3: T1 teaching frame

Suggested launching message, to edit before sending: "Execute the §13.3 prompt in docs/FLEETLAB_N2_V2_DESIGN_FEEDBACK.md. OD-2: package T stop 61,440 B, target 53,248 (OD-T3); the other packages as in the §4.6 table. OD-T1, OD-T2, OD-T4, OD-T5, OD-T6 and OD-T7: Yes, as recommended in §11.6. Commit on a new branch after all gates pass. [Deploy authorized: yes / no.]"

```text
TASK: Implement slice T1 "teaching frame" in FleetLab. Presentation only; no model changes.

PRECONDITIONS. Check each one; if any fails, stop and report.
- Task 2 (the offline-only packer comment removal, route A) is committed in this branch's history, and its offline byte gain is recorded.
- The launching message records OD-2 package T (stop 61,440 bytes, target 53,248; this is OD-T3) and the owner's answers to OD-T1, OD-T2 and OD-T4 to OD-T7.
- If OD-T1 is not recorded, skip T1.7. If OD-T2 is declined, use its declined path (§11.6 OD table).

READ FIRST
docs/FLEETLAB_N2_V2_DESIGN_FEEDBACK.md: "Start here", §11 in full, §12 (especially §12.0), Appendix B, and §8.3 (D1 follow-ups). Also docs/FLEETLAB_D1_RELEASE_2026-09-26.md for how D1 was built, gated and published.

WHAT TO BUILD
Implement T1.0 to T1.9 in the order §11.6 gives. The contracts:
- §11.3 is the component contract. Its run-line templates, plain-word maps and next-test map are canonical.
- §11.5 is the copy and test contract, and §11.5.5 is the byte budget.
- Appendix B is the per-lesson copy source, used under the §11.6 "Copy precedence" rule and split per §11.7.
- Never paste an Appendix B LEARN line into a static field. Never reuse a claim listed in §11.8.
- Keep T1.1 in the UI layer. Add only src/ui/teaching-frames.js and src/model/street-simulation.js to COPY_MODULES.

Where a D1 follow-up from §8.3 item 2 falls inside a file T1 already touches, close it too:
- the leftover "regional" labels (D1R-5);
- the Austin guardrail direction wording, which the canonical run-line generator replaces;
- raw floats and enums moved under "Exact values";
- the focus-safe busy pattern (never disable the focused control);
- record whether the motion control is reachable from Fleet day. Add a control only if it fits trivially; otherwise list it for T2.

WHAT T1 MUST NOT DO
- Invent or estimate results, or show unpinned numbers in static copy.
- Compute new measures in the UI.
- Edit model logic, lesson patches, presets, specs, routes or lesson ids. There are exactly 56 lessons.
- Raise APP_MAX_BYTES.
- Show a casebook reading before a matching run.
- Present a teaching result as real-world advice.
- Delete a test. Rewriting an assertion is allowed only for the tests §11.5.4 lists; log each rewrite with its reason.

GATES (run all before any commit that is meant to ship)
  FLEET_PLAYGROUND_PERF=1 node --test --test-concurrency=1 playground/fleetlab/test/*.test.mjs
  node playground/fleetlab/tools/pack.mjs --site dist/site
  node playground/fleetlab/tools/check-dist.mjs --site dist/site
  node playground/fleetlab/tools/pack.mjs --out dist/fleetlab-playground.html
  node playground/fleetlab/tools/check-dist.mjs dist/fleetlab-playground.html
  # in an activated hermes-dev shell; first confirm PYTHONPATH="$PWD/src" python -c 'import hermes;print(hermes.__file__)' points at this worktree's src/
  FLEET_PLAYGROUND_BASE=bca4ccd PYTHONPATH="$PWD/src" PYTHONDONTWRITEBYTECODE=1 python -m pytest -q -p no:cacheprovider tests/unit/test_fleet_playground_parity.py tests/unit/test_fleet_playground_boundaries.py
  git diff --check

Gate rules:
- A wall-clock performance failure in the full run is re-run once in isolation. It is a blocker only if the isolated run also fails.
- Acceptance is §11.6 criteria 1 to 11.
- Package growth is at most 61,440 bytes against the post-Task-2 baseline; apply the §11.5.5 trims in order if needed.
- test/d1-model-parity.test.mjs stays green and unchanged: 95/284 and Austin 480/77/391/11/1.
- Real-browser checks at 1280x720 and 400x812 per §11.6 criteria 3, 9 and 10. Record exactly what was and was not tested.

RECORDS
- Create docs/FLEETLAB_T1_RELEASE_<YYYY-MM-DD>.md, modelled on the D1 record: preflight and baseline, decision log, byte tally per work item, test-rewrite log, gates, browser evidence, privacy dispositions, deviations.
- Add one dated entry to HERMES_SOURCE_OF_TRUTH.md §7.5 and a new top section in CODEX_HANDOFF.md. No other new status documents.

GIT
- Create a new branch from the current HEAD, e.g. codex/fleetlab-t1-teaching-frame.
- Stage only by explicit path. Never stage artifacts/, dist/, caches or the owner's untracked FleetLab-ChatGPT-review-and-next-phase.md.
- Before each commit, review `git status --short`, `git diff --cached --check` and `git diff --cached --stat`.
- Run this privacy scan on the staged diff and record the disposition of every hit:
    grep -nE '^\+.*(/Users/|/home/|/private/|/var/folders|@gmail|@hotmail|api[_-]?key|secret|password|bearer|CLOUDFLARE_API_TOKEN|BEGIN [A-Z ]*PRIVATE KEY)'
- No force-push, history rewrite, main merge or PR.

DEPLOY AND PUSH: only if the launching message explicitly authorizes them. Follow the same procedure as docs/plans/2026-09-26-fleetlab-d1-and-n2-s0-codex-brief.md §6 and §7:
1. Commit the source.
2. Repack and re-check dist/site from the committed HEAD.
3. Run `npx --yes wrangler@4.135.0 whoami`, then:
     npx --yes wrangler@4.135.0 pages deploy dist/site --project-name fleetlab --branch feat/fleetlab-playground --commit-hash "$(git rev-parse HEAD)" --commit-dirty=false
4. Readback: copy artifacts/fleetlab-d1/verify_public.py to artifacts/fleetlab-t1/ with its own output path and verify every payload hash. Check the headers with curl -sSI. In a hosted browser, check the parity numbers (Fleet day 95/284; Austin 480/77/391/11/1) and six lesson deep links.
5. The rollback target is the current production deployment, dd4bfa44-7226-4502-9d66-01bb1790f2b6.
6. Only after the readback passes: push the branch, then fast-forward feat/fleetlab-playground after an ancestry check.
If wrangler authentication is missing, stop and ask the owner to run `npx --yes wrangler@4.135.0 login`. Never handle a token.

STOP CONDITIONS
- Any §11.6 stop condition.
- A change to the parity test values.
- The byte budget would be exceeded after the trims.
- Deploy readback fails. Stop, report, and leave rollback to the owner.

REPORT
- Commits with SHAs.
- Each work item's status.
- Acceptance criteria 1 to 11, each with evidence.
- Bytes: baseline, final and per-item tally.
- Test counts and rewrites.
- Browser checks done and not done.
- Privacy dispositions.
- Deploy and readback results, if authorized.
- Deviations, and the T2 items noticed.
```

### 13.4 After T1

These are separate steps. Each needs its own owner approval and prompt. The order follows §9.1 as amended by OD-19.

1. **S1a registration (docs).** Covers the tape-only curb-capacity bound, the detectable-gain SD, the guardrail-class method, the placebo-divergence control, OD-16, OD-18, OD-20, OD-22 and the G2 tapes. It is frozen before X1.
2. **X1 execution seam.** Main thread; named step functions (C-48); legacy byte parity; deterministic cancellation; within its OD-2 budget.
3. **S2 N2 model, accounting, runtime checker and adapter.** Fixtures come first, and the checker is split per OD-6.
4. **S1b.** Reactive-only and tape-only checks on the real engine finalize OD-11 to OD-14 and OD-17, before any forecast-arm run.
5. **S4 registered evaluation.** Every cell is reported without selection.
6. **S5 N2 review surface**, after S4. It reuses T1's frame and generator (§7, §12.10).
7. **T2 teaching follow-ups** (the §11.6 T2 list): lesson-setup fixes, pinned findings for non-OPS lessons, new lessons (the Appendix B NEW rows), walkthrough restructuring (OD-T7) and model-side metrics. Each needs owner approval and, where it changes results, new pins.
8. **D1 record cleanup** (§8.3 item 1): a small docs-only commit that can run any time.

### 13.5 Known residual notes from verification

These are low-severity items left for the implementer's judgment. None blocks Task 1, 2 or 3.

- **Reference panels.** The frame calls their source "the reference harness", while the unchanged `labels.js:33-35` chips still say "Measured in FleetLab". Until the OD that renames them, add a bridging clause or leave the frame's source name out.
- **Group-header frames.** §12.2 and §12.3 propose optional group-header frames that are not in §11's SURFACE_FRAMES list. Treat them as T2 unless they are added to SURFACE_FRAMES with tests.
- **N2 staging line.** The Appendix B.10 `event-curb-staging` LEARN line is source text for S5, not a pre-run field, and it has no ops clause yet. Resolve it when S5 is designed.

## Recommendation

1. **N2: design sound, not yet implementation-ready.** Run Task 1 (v2.1, docs only) now, with the owner's six decisions embedded. Hold X1 and N2 code until S1a is frozen and OD-2 is recorded.
2. **Budget: land Task 2 next.** Route A (offline-only removal of full-line comments) frees about 300 KB of offline headroom with the hosted site and byte limit unchanged. Without it, neither T1 nor N2 fits.
3. **Teaching clarity is the largest user-facing gap, and the next deployable release.** Most teaching content already exists but is hidden, misplaced or never shown (§11.1, §11.2). Ship T1 (Task 3) before any N2 user interface: the three-part frame on every catalog card and surface, the generated "What this run shows" line after every run, and the lesson deep-link arrival contract.
4. **Keep the honesty rules.**
   - Static copy carries no unpinned result numbers.
   - Results reach the page only from the reader's own run or from test pins.
   - Every ops takeaway is phrased as something an ops team would test.
   - Every result stays NOT_EVIDENCE, simulation-only, with deployment permission NONE.

## Top risks + mitigations

| Risk | Mitigation |
|---|---|
| The byte budget runs out partway through T1 or S2 | Task 2 first; package T stop at 61,440 B with ordered trims (§11.5.5); OD-2 allocations and per-work-package stop sub-budgets (§4.6) |
| Page copy promises a result the reader's run does not show | Static fields are direction-free and digit-free; after-run lines are generated only from recorded fields; casebook readings are templates gated to matching pinned verdicts on each seed set (§11.3.4, §11.6) |
| Ops takeaways read as real-world advice | The "An ops team would check …" form with a tested verb set; NOT_EVIDENCE and the limits stay visible (§11.3.5) |
| T1 breaks pinned tests or D1 behavior | The expected-break and must-stay-green lists (§11.5.4); stop on any test outside the list; the model-parity test must stay unchanged |
| A structurally dead guardrail or saturated N2 cell is read as evidence | Guardrail classes, the capacity bound and a placebo control are registered in S1 before any forecast-arm run (§6) |
| The N2 checker becomes a second engine | The checker split is DECIDED (OD-6): runtime invariants plus test-time policy verification (§4.5) |
| The packer change breaks behavior | The per-comment rule, built-in token or compile checks, worker digest parity, adversarial tests and --site byte identity (§13.2) |
| A teaching result is read as external validity | Synthetic labels, model identity headers, limits lists and the "not interchangeable" rule on every surface |

## Next 3 actions

1. **Owner:** record OD-2 (including package T) and OD-T1, OD-T2 and OD-T4 to OD-T7 (recommended: yes to all) in the Task 3 launching message. Tasks 1 and 2 need nothing more.
2. **Codex:** Task 1 (§10), then Task 2 (§13.2), each committed and not pushed.
3. **Codex:** Task 3 (§13.3), T1 teaching frame, deployed only if the launching message authorizes it. Then draft S1a (§13.4).

## Appendix A. N2 review: refuted or withdrawn findings and evidence ledger

### Refuted or withdrawn (one line each)

No finding was refuted outright. The following claims or sub-claims were refuted, withdrawn or downgraded by the verifiers and are not used above as originally stated:

- MX-1 "terminal energy HOLDs the forecast arm by construction": not established, because the sign is indeterminate. Remedies (b), a consumption limit, and (c), no in-horizon visits, are withdrawn as anti-primary.
- MX-3/MX-4 labeling of "required metric unavailable": unresolved between verifiers (v2:L584 versus v2:L175); see OD-25.
- MX-2 "value equals H minus the earliest non-arrival" stated without its qualifier: corrected. It needs H − c* to be at least the largest arrival wait.
- MX-5 "0/0 when a cell has no event requests": refuted. v2 defines 0/N.
- FB-1 "S1 covers only demand time-of-day": refuted. v2:L555 and L570 cover travel.
- FB-6 "the unit graph needs an undeclared, prohibited seam": refuted. DL4 declares it; only the mechanism is missing.
- FB-9 "G1 needs ojai share 0": refuted. Unit-state injection is already declared.
- FB-4 fix wording "first option whose cumulative weight ≥ draw": withdrawn. Pin the legacy subtract loop verbatim instead.
- FC-1 "no fixture rules out lexical-ID admission": refuted. §9.6 does; only index-first is uncovered.
- FC-7(d) "no destination gives an 8-minute leg at 45 km/h": refuted. Hub→east takes 8 minutes.
- FC-4 "a 1e-9 fixture tolerance as the fix": demoted to a fallback only.
- FXA-2 "option (b) keeps F5's table": refuted. D's row and the dispatch counts change.
- FXA-3 "no config literal delivers the intent" and "F4's result mimics the counter-reading": overstated. start_hour 0 delivers it, and the mimicry is only partial.
- COH-02 "zero-distance transitions are underdetermined" and "curb-first needs a new DISPATCH_PASS record": refuted by v2:L109 and by derivation from ownership intervals.
- COH-03 "the UI reads request status strings": unsupported by grep.
- COH-05 legacy proxy count "1 arrival at H per arm": not reproduced; the verifier got 11. The conclusion is unaffected.
- COH-07 "implementers may exclude staged cars from background dispatch": refuted. v2:L119, L123, L158 and §9.9 state eligibility.
- COH-08 "S1 deferrals force post-registration code changes": mostly refuted. S1 precedes code; only the post-tuning contingencies remain.
- FEAS-2 invariants.js analog of 20,776 code bytes: corrected to about 27,400 (comments were double-subtracted).
- FEAS-3 line-level comment guard: refuted as unsafe. Route C "every visitor downloads more": refuted. The poster was counted twice in the 475 KB breakdown.
- FEAS-5 84 MB / 92.6 MB / 1.15 s as the Rmax case: replaced by the Rmax-weighted 40 MB / 27 MB / ~340 ms.
- FEAS-6 "~0.9 MB default export": likely double-counts request data.
- SS-H1 recommendation of fix A: withdrawn. It breaks brief §4 item 8.
- SS-ENV "V=120 rejected at H=240 with any 20/hour background": overstated. I ≤ 156 is accepted.
- SS-MET "move rendered measures into UI-derived views": withdrawn. It conflicts with v2:L175 and L177.
- SS-H3 proposed invariant "nothing starts at H": withdrawn. It contradicts DL9.
- TS-2 "headroom overstates reachable gain 4–20×": corrected to 1.8–9× at b=4 and up to about 23× at b=8.
- TS-3 "b=8 cannot read IMPROVED": holds in the TOY only; on the real engine it is at best marginal.
- TS-7: its mechanism was incomplete. Assignment at creation with no abandonment explains the saturation.
- TS-8 "fleet never binds": does not survive the depot-visit sensitivity run.
- N2S-02 fix wording that "replaces" the retention sentence: withdrawn. It must append.
- N2S-06 and N2S spec rendering NOT_EVALUABLE as a NO_RECOMMENDATION verdict: withdrawn. Both remaining readings block the comparison; the label is OD-25.
- N2S-10 "log browser inspections": infeasible on a static page with no network or storage.
- N2S-11 ceiling sentence mixing tuning and evaluation values: withdrawn; replaced by labeled sources.
- N2S-16 "arrival-based averages export-only": withdrawn. v2:L584 requires arrival versus boarding.
- N2S-08 default trace request = historical-max attaining request: withdrawn. It usually shows a horizon penalty.
- D1R-2 "appended rather than completed in place" and "push outcome missing from the record": refuted. The first satisfies the brief; the second is structural.
- D1R-3 "only d1-presentation ran pre-fix": refuted. More files did, but a full re-run shows no effect.
- D1R-5 "Austin 'Regional stress lab' is a relabel leftover": refuted. It predates D1 and is used by the runbook.
- D1R-1 "update the v2 hash citations after an editorial pass": withdrawn. v2.1 is a new file, and historical citations stay.

### Evidence ledger (claim → status → source)

| Claim | Status | Source |
|---|---|---|
| All 19 §9 fixture groups reproduce under their stated setups | V | fixtures-a, fixtures-b and fixtures-c lanes, each with an independent verifier mini-lifecycle |
| R6 needs three hub b values; the §3.3 rule gives at most two | V | FXA-1; `bay-operations.js:28–29`; v2:L105, L419 |
| The G1 16 and 18.36 kWh points separate only the legacy screen; 18.0 separates three more readings | V | FB-2 probe |
| Float `ceil(i·s)` misassigns at 26 (p, i) pairs; integer-first is exact | V | FB-3, COH-09, SS-SHARE probes |
| At 50%, west holds all Ojai and east all I-PACE (20/0 vs 0/20 at V=40) | V | SS-H1 probe |
| §9.9: 12 vs 4 km depending on index | V | SS-H2, fixtures-b |
| F3 keeps (true,4,7) with nearest-eligible preparation and `car-2` from minute 1 | I (hand trace) | SS-H2 verifier |
| Travel ×1.25 in rush windows; default start_hour 7 | V (real-engine legs 73/73, 69/69, 128/128, 139/139) | FXA-3, FC-6; `bay-operations.js:49–50,122`; `operations.js:14` |
| The full §7 checker needs a partial second dispatch engine | I | COH-01 and its verifier |
| Latest non-hub arrival 203–211 < H=240; within-target cannot flip while H−I ≥ T | V (analytic) | COH-05 |
| Offline 2,551,878 bytes; headroom 69,562 | V | feasibility, d1-record-audit, n2-surface |
| Historical packed deltas +29,898 to +58,753 | V (historic trees re-packed) | FEAS-1 and its verifier |
| N2 estimate 52.5 / 81.8 / 118.5 KB | I | FEAS-2 |
| Comment removal −300,476 with token equality, worker parity and `check-dist` 0 | V (two methods) | FEAS-3 and its verifier |
| The proposed line-level guard is unsafe | V (constructed counterexample) | FEAS-3 verifier |
| Largest fleet 85 at the suggested demand; request-minute cap cannot bind | V | SS-ENV, FEAS missed item |
| Rmax-weighted memory 40 MB / 27 MB / ~340 ms | V (synthetic) | FEAS-5 verifier |
| Arm 4–11 ms; 12-seed comparison 434–465 ms (Node) | V | FEAS-10 |
| TOY never-refused = A × openings | V as TOY; I for N2 | TS-1 |
| TOY tape-only bound = zero-travel run in 192/192 seed-cells | V as TOY | TS-2 |
| IMPROVED needs a mean of about 0.02 + 0.56–0.58·sd (tested delta patterns) | V | MX-6, TS-5 |
| ANALOG placebo HOLD on unfinished_visits; ±20–27 kWh terminal-energy swings | V as ANALOG | MX-1 and MX-7 verifiers |
| rejected_actions is 0 under legitimate charging policies | V as ANALOG plus source | metrics verifier; `charging-allocation.js:25–53` |
| Max-wait regime proof | V (logic); regime placement I | MX-2 |
| The instrument ignores NOT_EVALUABLE; `compareMetric` treats null as 0 | V | MX-3, MX-4; `guardrails.js`, `paired.js` |
| Tie resolution decided by IEEE rounding | V | MX-9 |
| `duration_hours` fails to round-trip for 27 horizons | V | MX-10 |
| R2 fixture via the shipped `computeVerdict`; machine values depend on n | V | FC-5, MX-12 |
| "Forecast" is banned in interface copy; COPY_MODULES is an allow-list | V | N2S-01, FEAS-8; `check-dist.mjs:40,67,346` |
| `charts.js` skips zero-length intervals and gives a single tick at H=240 | V | N2S-03 |
| `#curb-lab` opens the route-error page; a `regional-curb` setup link would throw | V | N2S-05; `routes.js:17–26`; `studio.js:235,248` |
| The airport wave scores arrival and uses inclusive expiry | V | N2S-07; `airport-demand.js:35,42` |
| Austin focus drops to BODY; status updates every 15–40 ms; verdict 3,623 px below Run at 400 | Mechanism V in code; live values from one hidden-tab observation, not re-observed | n2-surface observations; `regional-power-view.js:142–153` |
| D1 bytes, tests, digests, pushes, protected paths | V | d1-record-audit and its verifier |
| D1 final gate reproduces on the committed tree | V | D1R-3 verifier (full serial PERF re-run) |
| 46–55 v2 lines lack a separator before a number; 0 in v1, the review and the brief | V | D1R-1 |
| v1 and v2 SHA-256 values | V (re-checked for this synthesis) | `shasum -a 256` |
| Base-cell gain 3–7 requests; b=8 cell 2–4 | I | MX-6 and its verifier |
| TOY depot sensitivity: minimum available cars 8–17 | V as TOY | TS-8 verifier |

## Appendix B. Lesson cards (all 56 lessons, plus proposed new lessons)

**Coverage check:** all 56 catalog lesson ids appear exactly once below (56 covered; missing: none). 19 NEW proposals follow in their surface tables. Ids were checked against `simulationCatalog()` at 790573e.

**How to read the tables.**

- **Columns.** Each row gives a short summary of the three parts, the evidence, the exact proposed on-page copy (WW = what_why, HOW = how, LEARN = learning plus ops check), and the copy-rule result.
- **Titles.** Existing lessons keep their catalog title. NEW rows are proposals.
- **Numbers.** Every number is **model output** with its seeds named, synthetic and NOT_EVIDENCE. "Ops" lines are things a team would test in its own operation.
- **Copy-rule status.** "Pass" means the string was checked against the exact expressions listed in the section 12 conventions: all three H-3 lists, dashes, H-6 and the house words on every line, plus VERDICT_CLAIMS on every WW and HOW. The H-9 note names the gate the LEARN line needs:
  - "pin" means the numbers go in `test/teaching-frames.grounding.json` with a test before the line is shown as a fixed reading; otherwise it renders after the reader's run from recorded fields. Every "pin" and "pinned verdict" reading outside the casebook is T2: T1 ships no non-OPS pinned readings (budget, section 12 conventions).
  - "after run" means it is only ever shown after a run.
- **LEARN is a source, not a static field.** Per the §11 precedence rule (section 12 conventions), WW and HOW apply where §11.3.10 has no exemplar. Today §11.3.10 has lesson frames for `fleet-day`, `cleaning`, `staffing-readiness`, `power-redistribution`, `region-launch`, `street-first`, `street-van-ness`, `UC-08a`, `L2b`, `OPS-01` and `OPS-07`; for those ids its strings win over the WW and HOW below. LEARN feeds three places: the direction-free look_for, the ops_takeaway (the "Ops check:" clause rewritten to "An ops team would <verb> ...", §11.3.5), and the grounding sidecar. It is never pasted into a static field. The casebook LEARN lines are slot templates for the gated after-run reading (B.8).
- **Rush-hour.** The B.1 rush-hour copy is T2: it assumes the one-axis patch `{peak_multiplier:2.4}`. T1 keeps the shipped patch and uses the 12.1 alternates.
- **"Fix" notes** name the page or patch defect the card depends on.
- **New lessons and the lesson count.** Adding catalog ids changes the 56-lesson pin (`test/navigation.test.mjs:14`) and the byte budget (package T). Recommended handling of the NEW rows:
  1. **Ship as a new catalog lesson:** `event-curb-staging`, the one permitted 57th lesson, with N2.
  2. **Ship as a changed setting, not a new id:** `cleaning-binding` replaces the `cleaning` patch; the `rush-hour` patch becomes one axis (`demand-ceiling` can absorb the old version); `charge-cap` becomes step 2 of `vehicle-mix`.
  3. **Ship as a "Try next" action on an existing lesson** (no new id), after pinning: `OPS-02b`, `OPS-10b`, `OPS-12-contrast`, `OPS-19-followup`, `OPS-20-followup`, `L3b`, `UC-02-ladder`, `UC-05b`, `redistribution-headroom`, `freshness-window-vs-delay`, `street-fleet-share`, `visit-cadence`, `busy-depot-binding-stage`.
  4. **Owner decision (new ids, count to 59):** `austin-power-stress` and `austin-deadline-priority`. The Austin panel has no catalog entry today, so the alternative is one Austin lesson that replaces nothing and needs the count raised by one.

### B.1 Fleet day core

| id | title | What & why | How we simulate | What you learn / ops takeaway | Evidence (short) | Proposed on-page copy (3 short lines) | Copy-rule status |
|---|---|---|---|---|---|---|---|
| `bay-area` | Real Bay Area routes in 3D | How service-zone geography sets empty pickup driving; the zone can matter as much as fleet size. | Patch {} loads the default window (24 cars, 18 places, seed 42). The teaching step is the SF and SFO place button. Frozen OSM major roads, 153 pairs. SF and SFO only also changes trip length (22 km), so it is not the same demand. | Model output, 11 seeds: all 18 places give 25.4 km pickups for 12.6 km trips. SF and SFO only adds 17.4 trips (11/11) and cuts wait by 32 min, but the charger queue grows from 13.6 to 53.7 min, and the rider share also rises because trips are longer. Ops: check empty-mile share and depot charging together before reshaping a zone. | fleet-core probe.mjs, probe3.mjs; verify v2.mjs | WW: "How far riders are from free cars sets how far cars drive empty. Before choosing a service zone, an operator needs to know how much car time goes to pickups."<br>HOW: "Same fleet and demand rate; only the served places change. Trips follow frozen OSM major roads between 18 anchors, with no turn rules, one-way streets or local access. Run all 18, then SF and SFO only."<br>LEARN: "Model output, 11 seeds: all 18 places give 25 km pickups for 13 km trips. SF and SFO only (22 km trips) adds about 17 trips, but charger queues grow from about 14 to 54 min. Ops check: does a tighter zone move the bottleneck?" | Pass: H-3 (all three lists), dash, H-6, house words, VERDICT_CLAIMS on WW and HOW. Lengths 157/201/225 (caps 160/220/240). H-9: pin (11-seed or seed-42 probe numbers). Fix: patch {} is the same run as fleet-day; set place_ids or name the SF and SFO step in the banner. |
| `vehicle-mix` | I-PACE versus Ojai assumptions | Does the vehicle profile change fleet output, and through which assumption: energy, depot work time or charge limit? | The patch equals the default (50% Ojai). The teaching step is Compare I-PACE, mixed, Ojai: 0/50/100% Ojai on identical requests. Ojai values are invented; linear charging, no taper. | Model output: seed 42 gives 95/95/92 trips and 975/1,051/1,101 kWh. Over 11 seeds, all Ojai against all I-PACE: -3.3 trips (range -8 to +2), +85 kWh and +8.9 min on site (11/11). At 150 kW ports the order reverses (-4.3 min, 11/11). The depot-time gap is mainly recharge energy, not the cleaning or upload factors. Ops: find which charging cap binds before crediting a charge rating. | fleet-core probe3-5.mjs; verify v3.mjs | WW: "Does a vehicle type change fleet output, and through which assumption? Planners compare energy use, depot work time and charge limits, not names."<br>HOW: "Press Compare I-PACE, mixed, Ojai: the same requests replay with 0, 50 and 100% Ojai. Profiles differ in battery size, energy per km, charge limit, and cleaning and upload time. Ojai values are invented."<br>LEARN: "Model output, 11 seeds: all Ojai vs all I-PACE moves completed trips by -8 to +2, yet always uses more energy and depot time. Its 150 kW limit never binds at 50 kW ports. Ops check: which charging cap binds first?" | Pass: H-3 (all three lists), dash, H-6, house words, VERDICT_CLAIMS on WW and HOW. Lengths 145/203/213 (caps 160/220/240). H-9: pin (11-seed or seed-42 probe numbers). Fix: the patch should open the mix comparison; lead with vehicle profile assumptions, not brand names. |
| `fleet-day` | Fleet size versus trip demand | How many requests can this fleet complete, and what would more cars or more depots add? | Patch {} (default). Compare fleet & depot sizes replays identical requests with 12/24/36/48 cars at 2 depots, and with 1-6 depots at 24 cars. Target: 95% of all requests by the end of the window. One seed. | Model output, seed 42: 60/95/147/197 completed; 1-6 depots give 79 to 111; no tested depot count meets 95% (all 11 seeds). Over 11 seeds, 24/48/72 cars reach 32/66/90% completion, and pickup km falls 25.4/14.4/5.1. Ops: size a fleet against a service target plus a utilization guardrail, after measuring the empty pickup share. | fleet-core probe.mjs, probe3.mjs; pin d1-presentation.test.mjs:24 | WW: "How many requests can this fleet complete, and what would more cars add? Counting cars alone hides how much time each car spends away from riders."<br>HOW: "Run the day, then press Compare fleet & depot sizes: the same requests replay with 12, 24, 36 and 48 cars, then 1 to 6 depots. Only that count changes. Demand and depot sites are synthetic."<br>LEARN: "Model output, seed 42: 12, 24, 36 and 48 cars complete 21, 33, 52 and 69% of 284 requests. No tested depot count (1 to 6) reaches 95%. Ops check: how much car time is empty pickup driving before sizing a fleet?" | Pass: H-3 (all three lists), dash, H-6, house words, VERDICT_CLAIMS on WW and HOW. Lengths 146/189/210 (caps 160/220/240). H-9: pin (deterministic seed-42 trials; the ladder assumes the default 24 cars). Fix: name the compare button in the banner; say the default window is over-demanded. |
| `weather-day` | Rain and hot-weather service | Rain slows travel, raises energy use and adds riders at once: which effect removes the most completed service? | Patch {weather:rain}: travel x1.3, energy x1.12, demand x1.12 (heat: 1.05/1.25/1.05). Demand regenerates (284 to 318 requests at seed 42), so compare counts. No grip, visibility or sensor model. | Model output, seed 42: 78 of 318 against 95 of 284 completed (the deployed site matches). Over 11 seeds: rain -11.9 trips and +44 unserved; travel alone -13.4 (11/11); demand alone -1.3 but +33 unserved; the effects do not add up. Ops: start weather playbooks with travel-time assumptions, and track unserved separately. | fleet-core probe2-3.mjs; live check; verify v2.mjs | WW: "Rain slows trips, raises energy use and adds riders at once. An ops team needs to know which of these removes the most completed service."<br>HOW: "Rain multiplies travel time by 1.3, energy by 1.12 and demand by 1.12; heat uses 1.05, 1.25 and 1.05. Demand changes too, so compare counts. Declared multipliers only: no grip, visibility or sensor model."<br>LEARN: "Model output, 11 seeds: rain averages 12 fewer completed trips and 44 more unserved. Slower travel alone removes about 13; extra demand alone mostly adds unserved. Ops test: weather-adjusted travel times first." | Pass: H-3 (all three lists), dash, H-6, house words, VERDICT_CLAIMS on WW and HOW. Lengths 137/204/210 (caps 160/220/240). H-9: pin (11-seed or seed-42 probe numbers). Fix: the pre-run chip reads Clear while Rain is selected (operations-lab.js:117). |
| `rush-hour` | Morning and evening peaks | Can a fleet sized for average demand absorb a peak, and does the shortage clear afterward? | The current patch {start_hour:16, requests_per_hour:45} changes two things, and the 16:00 start alone is inert (11/11 seeds). Recommended patch: {peak_multiplier:2.4}, one axis. Peaks run 07-10 and 16-19, with travel x1.25. | Model output, 11 seeds: the current patch adds 149 requests, +3 completed (range -11 to +18) and +141 unserved. A 2.4x peak adds 74 requests, about +1 completed and +71 unserved. Default: 70-79% unserved at 08-10 and 62-72% after the peak. Ops: split unserved by hour to separate peak-only from all-day gaps. | fleet-core probe3.mjs, probe5.mjs; verify v2.mjs | WW: "Can a fleet sized for average demand absorb a peak, and does the shortage clear afterward? Charging and depot plans depend on the answer."<br>HOW: "This lesson raises the 07-10 and 16-19 peak from 1.6x to 2.4x base demand; start time, base demand and fleet stay fixed. Peak hours also slow travel by 1.25x. Demand is synthetic."<br>LEARN: "Model output, 11 seeds: a 2.4x peak adds 74 requests but about 1 more completed trip, while unserved rises by 71. Ops check: if the fleet is short all day, a peak plan alone will not close the gap." | Pass: H-3 (all three lists), dash, H-6, house words, VERDICT_CLAIMS on WW and HOW. Lengths 137/179/197 (caps 160/220/240). H-9: pin (11-seed or seed-42 probe numbers). T2: this copy assumes the one-axis patch {peak_multiplier:2.4}, a T2 lesson setup fix; its HOW would be false under the shipped patch. T1 keeps {start_hour:16, requests_per_hour:45} and uses the 12.1 alternates (how with "contain", 212 characters). |
| `full-cycle` | Follow a car through its day | Fleet totals hide single car timelines. Following one car shows where its minutes go. | Patch {trips_between_visits:2}. Pick a car and step through its stages; the replay is one-minute snapshots. The UI preselects car-1, which never completes a cycle at seed 42. | Model output, seed 42: 21 of 24 cars complete a depot cycle. car-7 is ready at 09:02 after 2 trips and 50 min on site (80 min away from riders). Over 11 seeds against the default: -14.6 trips (11/11) and +126 kWh end energy (10/11). Ops: weigh depot cadence against completed trips and end-of-window energy together. | fleet-core probe2.mjs, probe4.mjs; verify v1.mjs | WW: "Fleet totals hide single car days. Following one car shows where its minutes go: empty driving, rider trips, depot queues and depot work."<br>HOW: "Cars visit a depot after 2 trips instead of 3. Choose a car, then use Next activity or a stage button to step through pickup, trip, depot drive, cleaning, charging and upload."<br>LEARN: "Model output, seed 42: car-7 is ready again at 09:02 after 2 trips and a 50 min depot visit. Over 11 seeds, visiting after 2 trips gives 15 fewer trips but 126 kWh more energy at the end. Ops check: weigh both." | Pass: H-3 (all three lists), dash, H-6, house words, VERDICT_CLAIMS on WW and HOW. Lengths 137/175/210 (caps 160/220/240). H-9: pin (11-seed or seed-42 probe numbers). Fix: preselect the first car with a ready event (car-7) and pin it in a test; announce the car switch that stage buttons cause. |
| `demand-ceiling` NEW | More requests, same trips | Does more demand bring more trips, or only more riders left waiting? Where is the throughput ceiling? | Patch {requests_per_hour:60} against the default 30. Fleet, depots, places and seed stay fixed; requests regenerate, so compare counts. | Model output, 11 seeds: 15/30/45/60 requests per hour give 97/93/96/101 completed, with unserved rising from 39 to 466 (tested range only). Ops: estimate trips per car-day before planning demand growth, and read unserved as the growth signal. | fleet-core probe5.mjs; verify v2.mjs | WW: "If demand doubles, does the fleet complete more trips or leave more riders waiting? Knowing the ceiling shows an operator when demand growth outruns supply."<br>HOW: "Same fleet, depots and places; only base demand changes, from 30 to 60 requests per hour. Replay both runs on the same seed and compare completed, unserved and wait. Demand is synthetic."<br>LEARN: "Model output, 11 seeds: 15, 30, 45 and 60 requests per hour give 97, 93, 96 and 101 completed trips on average, while unserved rises from 39 to 466. Ops check: find the fleet's ceiling before growing demand." | Pass: H-3 (all three lists), dash, H-6, house words, VERDICT_CLAIMS on WW and HOW. Lengths 156/186/207 (caps 160/220/240). H-9: pin (11-seed or seed-42 probe numbers). Better as the replacement for the current rush-hour patch than as a new id. |
| `charge-cap` NEW | Which charging limit binds? | A vehicle fast-charge rating helps only if ports and site power allow it. Which cap binds? | Patch {charger_kw:150, site_power_kw:600}, then the mix comparison. Linear charging; no taper, tariff or grid model. | Model output, 11 seeds: faster depots add 25.1 trips (11/11), and on-site time falls from 107.5 to 43.1 min. All Ojai then spends 4.3 min less on site than all I-PACE (11/11), against 8.9 more at 50 kW ports. At the same total site power, faster ports still add 22.6. Ops: identify the binding cap before crediting a charge rating or buying ports. | fleet-core probe4-5.mjs; verify v3.mjs | WW: "A vehicle's fast-charge rating helps only if depot ports and site power allow it. Planners need to know which limit binds before choosing vehicles or chargers."<br>HOW: "Raise port power from 50 to 150 kW and site power from 120 to 600 kW, then compare all I-PACE, mixed and all Ojai on the same requests. Linear charging; no taper, losses or heat."<br>LEARN: "Model output, 11 seeds: faster depots add about 25 trips and cut depot time from 107 to 43 min. All Ojai then spends 4 min less on site than all I-PACE, not 9 min more as at 50 kW ports. Ops: find the binding cap." | Pass: H-3 (all three lists), dash, H-6, house words, VERDICT_CLAIMS on WW and HOW. Lengths 159/178/213 (caps 160/220/240). H-9: pin (11-seed or seed-42 probe numbers). Better as step 2 of vehicle-mix than as a new id. |

### B.2 Depot work

| id | title | What & why | How we simulate | What you learn / ops takeaway | Evidence (short) | Proposed on-page copy (3 short lines) | Copy-rule status |
|---|---|---|---|---|---|---|---|
| `depot-count` | How many depots are sufficient? | Is a shortfall about too few depot sites or too few cars? Sites are the slowest and largest commitment. | Patch {depot_count:1}. Compare fleet & depot sizes runs 1-6 depots (24 cars) and 12-48 cars (1 depot) on the same demand. Each depot bundles bays, ports and 120 kW. The target is fixed at 95%. | Model output, seed 42: 1-6 depots give 27.8 to 39.1% (39.1 at 5 depots, 38.4 at 6), and 48 cars at one depot give 59.2%. No count meets 95% in 10/10 seeds. Mean trips for 1-6 depots: 82.3/93.0/101.7/106.6/109.6/111.0. At 8 requests per hour the first sufficient count changes with the seed. Ops: compare completion gained per added depot with per added car, and add one site's resources to an existing depot to separate distance from capacity. | depot-work run-depot-count.mjs, run-extra.mjs; verify v-depots.mjs | WW: "Is a service shortfall about too few depots or too few cars? Each depot adds bays, ports and power, so its value depends on which one limits service."<br>HOW: "The same demand runs with 1 to 6 depots (fleet fixed) and 12 to 48 cars (one depot). Every added depot brings its own bays, ports and site power. Target: 95% of all requests done by the end of the run."<br>LEARN: "Model output, seed 42: no depot count reaches 95%; 1 to 6 depots give 28% to 39%, while 48 cars at one depot give 59%. Over 10 seeds each added depot adds fewer trips. Ops check: test fleet supply first." | Pass: H-3 (all three lists), dash, H-6, house words, VERDICT_CLAIMS on WW and HOW. Lengths 149/201/203 (caps 160/220/240). H-9: pin (10-seed probe). Fix: the question promises a chosen target, but it is fixed at 95% (bay-operations.js:292). |
| `cleaning` | Cleaning capacity and queues | Does cleaning keep cars from riders? More bays or faster cleans matter only if cars wait to be cleaned. | The patch bundles {cleaning_bays:1, trips_between_visits:2}. Cleaning is fixed-time, first come first served, with unlimited staff. The measured drop comes entirely from the cadence change. | Model output, 10 seeds: the lesson gives -14.7 trips against the default (10/10), mostly from extra drives to the depot. +1 bay gives 0.0; a 4-min clean gives +0.4. Seed 42 queues: cleaning 2.7 min, charging 17.8 min. Cleaning is not the constraint here. Ops: compare the cleaning queue with the other stages, and test visit frequency separately from bay count. | depot-work run-lessons.mjs, run-decomp.mjs; verify v-lessons.mjs, v-sw.mjs | WW: "Does cleaning keep cars from riders? More bays or a faster clean both raise cleaning throughput, but they only matter if cars wait to be cleaned."<br>HOW: "Every depot visit includes a fixed-time clean in a limited number of bays, first come first served. This lesson sets 1 bay per depot and a visit every 2 trips; all else stays at the default day."<br>LEARN: "Model output, seed 42: cars wait 2.7 min to clean but 17.8 to charge. A 2nd bay or a 4 min clean shows no consistent change (10 seeds); the 15 trip drop comes from visiting every 2 trips. Ops check: find the longest queue." | Pass: H-3 (all three lists), dash, H-6, house words, VERDICT_CLAIMS on WW and HOW. Lengths 145/194/222 (caps 160/220/240). H-9: pin. Fix: replace this patch with cleaning-binding and move the cadence change to visit-cadence. |
| `charging` | Battery and charging constraints | Can a fleet that starts low recharge in time for its next rider? Charging is the longest depot step. | Patch {initial_soc_pct:40} (default 65). Linear charging at min(port kW, vehicle limit, site kW / active ports). Remedies: +4 ports at 120 kW, a 200 kW site, 8 ports at 400 kW. | Model output: over 10 seeds, -11.4 trips against the default, and energy-short cars rise from 2.2 to 18.6. Seed 42: charging queue 38.7 against 15.1 min, and 14-17 cars at or driving to depots in 07-10 (default: 2 or fewer). +4 ports at 120 kW gives -4.2 (8/10 lower); 200 kW gives +19.1 (10/10). Ops: check delivered kW per charging car before adding ports, and test charged or staggered starts (an 85% start gives +10.0, 10/10). | depot-work run-lessons.mjs, run-profile.mjs; verify v-lessons.mjs, v-more.mjs | WW: "Can a fleet that starts the day low on battery recharge in time for the next rider? Charging is the longest depot step, so it sets how fast cars come back."<br>HOW: "Cars start at 40% instead of 65%. Charging is linear: each car gets the lowest of port kW, its own limit and site kW split across active ports. No taper, heat or battery wear."<br>LEARN: "Model output, seed 42: 14 to 17 cars are at or driving to depots in the 07:00 to 10:00 peak (default: 2 or fewer). 4 more ports under the same 120 kW lost trips in 8 of 10 seeds; 200 kW added 19. Ops check: kW per car first." | Pass: H-3 (all three lists), dash, H-6, house words, VERDICT_CLAIMS on WW and HOW. Lengths 155/175/224 (caps 160/220/240). H-9: pin. Fix: the controls list omits site power, which is the binding control (simulation-catalog.js:27). |
| `shared-power` | Charge ports versus site power | Under a capped site, do extra ports help? Port count is visible; the kW cap sets how fast cars refill. | Patch {chargers:4, charger_kw:80, site_power_kw:40}. The 80 kW port change does nothing (40 kW alone is identical in 10/10). Sweep 2/4/8 ports at 40 kW, then 160 and 320 kW with 4 ports. | Model output, 10 seeds: -17.7 trips against the default. 2/4/8 ports deliver 389.9/390.5/390.8 kWh and finish 7.3/5.6/3.0 visits; 8 against 2 ports gives -6.8 (10/10). 160 kW gives +24.1 and 320 kW +37.2 (10/10). Ops: measure delivered kW per car against nameplate, and test site power before ports. | depot-work run-lessons.mjs, run-profile.mjs; verify v-lessons.mjs | WW: "If a depot's power supply is capped, do extra charge ports help? Port count is easy to see; the site kW limit is what sets how fast cars refill."<br>HOW: "4 ports rated 80 kW share 40 kW per depot, split equally among charging cars. Compare 2, 4 or 8 ports at 40 kW, then raise site power with 4 ports. Demand and fleet stay fixed."<br>LEARN: "Model output, 10 seeds: energy delivered stays near 390 kWh at 2, 4 or 8 ports, and 8 ports finish fewer visits than 2. Raising site power to 160 kW added 24 trips on average. Ops check: delivered kW before ports." | Pass: H-3 (all three lists), dash, H-6, house words, VERDICT_CLAIMS on WW and HOW. Lengths 144/176/213 (caps 160/220/240). H-9: pin. Fix: simplify the patch to {site_power_kw:40}, and align it with the More ports, limited power situation (82 trips, seed 42). |
| `software` | Software-update scheduling | How much rider time does an update policy take? Length and cadence both add depot minutes. | The patch bundles {software_minutes:30, software_every_visits:1} (default: 12 min, every 2nd visit, 1 station). The update runs first; there are no failed or rolled-back updates. | Model output: over 10 seeds, -6.5 trips against the default (10/10). Seed 42: the update queue is 30.6/9.2/2.8 min at 1/2/4 stations, while the charging queue goes 0/0.3/10.7. Either change alone gives 0 or -1.8, so the effect is an interaction. Every 2nd visit restores the default exactly, because no 2nd visit finishes inside 8 h. Ops: express an update policy as depot minutes per car per day, test cadence and duration separately, and check the next stage. | depot-work run-lessons.mjs, run-decomp.mjs, run-sw-check.mjs; verify v-sw.mjs | WW: "How much rider time does a software update policy take? Update length and how often cars get one both add depot minutes before a car is ready."<br>HOW: "Updates run first on scheduled visits, at a fixed time, in limited stations per depot. This lesson sets 30 min on every visit (default: 12 min, every 2nd visit). No failed or rolled-back updates."<br>LEARN: "Model output, seed 42: 31 min queue at 1 update station, 3 min at 4, but charging then queues 11 min. Every 2nd visit equals the default (10 seeds): none finishes in 8 h. Ops check: update minutes per car per day, and the next stage." | Pass: H-3 (all three lists), dash, H-6, house words, VERDICT_CLAIMS on WW and HOW. Lengths 142/195/233 (caps 160/220/240). H-9: pin. Fix: explain the empty default software row (operations-lab.js:284). |
| `upload` | Trip-data transfer bottlenecks | Can moving trip data off a car keep it from riders? Upload is the last step, so it holds a clean, charged car. | The patch bundles {upload_minutes:30, upload_bays:1} (default: 6 min, 2 stations). Upload takes a fixed time after charging; no bytes, bandwidth or retries are modeled. | Model output: over 10 seeds, -8.0 trips against the default (10/10); seed 42 upload queue 16.0 min. 2 stations give +3.1 (10/10), and charging queues 11.8 min again; a 4th station adds 0.7 more. 30 min alone gives -4.9 and 1 station alone -0.1, so the loss is mostly transfer time. Ops: time the transfer itself before adding stations, and check whether upload has to block release. | depot-work run-lessons.mjs, run-decomp.mjs; verify v-lessons.mjs | WW: "Can moving trip data off a car keep it from riders? Upload is the last depot step, so a slow transfer holds a car that is already clean and charged."<br>HOW: "Upload takes a fixed time in limited stations per depot, after charging. This lesson sets 30 min and 1 station (default: 6 min, 2 stations). No bytes, bandwidth sharing or retries."<br>LEARN: "Model output, seed 42: charged cars wait 16 min for the upload station. A 2nd station cuts that to under 1 min (+3 trips, 10 of 10 seeds) and charging queues 12 min again; a 4th adds little. Ops check: the transfer time itself." | Pass: H-3 (all three lists), dash, H-6, house words, VERDICT_CLAIMS on WW and HOW. Lengths 148/180/227 (caps 160/220/240). H-9: pin. |
| `visit-cadence` NEW | Depot visit cadence | How often cars visit a depot decides how much of the fleet is off the road, and how much is short of energy. | Patch {trips_between_visits:2}, compared with 3 (the default) and 6. Everything else stays fixed. | Model output, 10 seeds, against every 3: every 1 gives -22.9, every 2 -14.7, every 4 +4.7, every 6 +7.1 trips. At 6, energy-short cars rise from 2.2 to 22.7, and end energy falls from 1,134 to 1,042 kWh. 6, 10 and 20 give identical results (the trip trigger never fires in 8 h). Ops: test visit triggers as a policy, with energy-short cars and end energy as guardrails. | depot-work run-cadence.mjs; verify v-more.mjs | WW: "How often do cars need to come in? Frequent visits keep cars clean and charged but off the road; rare visits keep them serving until batteries run low."<br>HOW: "Cars visit a depot after 2, 3 or 6 trips, or sooner when low. Every visit runs the same four steps. Demand, fleet, depots and all resources stay fixed."<br>LEARN: "Model output, 10 seeds: every 2 trips gave 15 fewer trips than every 3. Every 6 gave 7 more, the same as no trip trigger, but 23 of 24 cars at some point lacked energy for a waiting trip. Ops check: energy beside trips." | Pass: H-3 (all three lists), dash, H-6, house words, VERDICT_CLAIMS on WW and HOW. Lengths 151/151/219 (caps 160/220/240). H-9: pin. Cross-link full-cycle, which uses the same cadence-2 patch. |
| `busy-depot-binding-stage` NEW | Add capacity where cars wait | Which depot step needs the next resource? Uses the existing A busy depot situation, which has no lesson. | Patch {fleet_size:32, depot_count:1, trips_between_visits:2, chargers:1, cleaning_bays:1}. Add 1 cleaning bay, or separately add 3 ports. | Model output: seed 42 completes 80 of 284, with a charging queue of 92.5 min and a cleaning queue of 8.1. +1 bay cuts the cleaning queue to 0.9, but trips are unchanged in 9/10 seeds. +3 ports gives +12.9 (10/10). Ops: rank stages by queue minutes, fund the longest first, and re-check whether the queue moved. | depot-work run-presets.mjs; verify v-more.mjs | WW: "Which depot step needs the next resource? Read where cars actually wait before adding a bay or a port."<br>HOW: "A busy single depot: 32 cars, 1 cleaning bay, 1 charge port, a visit every 2 trips. Add one cleaning bay, or separately add 3 ports. Demand and everything else stay fixed."<br>LEARN: "Model output, seed 42: the extra bay cut the clean wait from 8 to 1 min, yet trips were unchanged in 9 of 10 seeds. 3 more ports added 13 trips on average. Ops check: read the queue table, then add to that step." | Pass: H-3 (all three lists), dash, H-6, house words, VERDICT_CLAIMS on WW and HOW. Lengths 102/171/211 (caps 160/220/240). H-9: pin. Could attach to the existing busy-depot situation instead of a new id. |
| `cleaning-binding` NEW | More cleaning bays or a faster clean? | A setting where cleaning really is the queue, so bay count and process time can be compared. | Patch {cleaning_bays:1, trips_between_visits:2, cleaning_minutes:24, site_power_kw:200}. Compare 2 bays with a 12-min clean. This stress setting gives -21.5 trips against the default. | Model output, 10 seeds: seed 42 cleaning queue 45.5 min. 2 bays give +10.1 and a 12-min clean +13.0 (both 10/10). The 12-min clean exceeds 2 bays by +2.9 (8 up, 2 equal), because shorter work also shortens each stay. Queues do not clear fully (seed 42: 11.7 and 15.3 min). Ops: when cleaning is the longest queue, compare process time with an added bay, then re-check charging. | depot-work run-cleaning-bind2.mjs; verify v-more.mjs | WW: "When cleaning is slow, is a second bay or a faster clean the stronger fix? Both double how many cars can be cleaned per hour."<br>HOW: "A 24 min clean in 1 bay per depot, a visit every 2 trips, and 200 kW site power so charging is not the queue. Compare 2 bays at 24 min with 1 bay at 12 min."<br>LEARN: "Model output, 10 seeds: a 2nd bay added 10 trips and a 12 min clean added 13, since shorter work also returns each car sooner. Ops check: process time against bay count, when cleaning is the queue." | Pass: H-3 (all three lists), dash, H-6, house words, VERDICT_CLAIMS on WW and HOW. Lengths 125/156/197 (caps 160/220/240). H-9: pin. Replaces the cleaning patch (no new id needed). |

### B.3 Paired depot experiments (M1-M3, airport)

| id | title | What & why | How we simulate | What you learn / ops takeaway | Evidence (short) | Proposed on-page copy (3 short lines) | Copy-rule status |
|---|---|---|---|---|---|---|---|
| `staffing-readiness` | Staffing: workers versus bays | Is a cleaning queue short of people or of bays? Adding the resource that is not binding returns no cars. | depotReadinessDemoConfig: 16 cars, 1 depot, 4 h, 45 req/h, a clean after every trip (18 min base), 3 bays and 1 worker, charging made non-binding. analyzeDepotReadiness runs baseline, +1 worker and +1 bay; one seed; descriptive; no shifts. | Model output, seed 42: 26/36/26 of 179 completed. All 3,208 queued task-minutes were no-free-worker, and the max-wait check fails (215 min against 60). Seeds 1001-1012: +10 and 0 on every seed. Exploratory: the blocker moves to bays after 3 workers; 8+8 give 96 and 16+16 give 120; a visit every 2nd or 4th trip gives 50 or 92. Ops: log blocked minutes by exclusive cause, add the most-blocked resource, then re-log. | depot-experiments staffing.mjs, staffing-sweep.mjs; verify staff.mjs, sweep.mjs | WW: "Cars wait for cleaning. Does the depot need another cleaning worker or another bay? Adding the wrong one leaves riders waiting just the same."<br>HOW: "One seed, same demand: 16 cars, 1 depot, 18 min base cleaning after every trip. Baseline has 1 worker and 3 bays; one arm adds a worker, the other adds a bay. Descriptive only."<br>LEARN: "Model output, seed 42: one more worker completed 36 of 179 trips vs 26; one more bay stayed at 26. Every queued cleaning minute lacked a worker. Ops check: log what each waiting car lacks before adding capacity." | Pass: H-3 (all three lists), dash, H-6, house words, VERDICT_CLAIMS on WW and HOW. Lengths 141/176/211 (caps 160/220/240). H-9: pin (seed 42 and seeds 1001-1012 are deterministic). Fix: the paired section errors on this lesson; rename M1 in reader copy; remove winner at readiness-view.js:35. |
| `power-redistribution` | Use acceptance-limited power shares | Can unused charger power, stranded by cars that accept less than their share, be passed on to return cars sooner? | Charging demo: 24 cars, 4 h, 35 req/h, a visit after every trip, 8 ports of 80 kW sharing 120 kW, I-PACE accepts 10 kW, 35% start. Paired: equal share against redistribute, 12 held-out seeds, margin 0.02. | Model output, seeds 1001-1012: UNCHANGED, NO_RECOMMENDATION. Completion is 23.0% in both arms; delivered energy goes from 440.7 to 455.4 kWh; 24 visits are unfinished in both. Seed 42: the cars at the depot needed 610-660 kWh against a 480 kWh window ceiling. At a 70% start the rule is IMPROVED, ADVANCE (+8.0 points). Ops: measure stranded kW per session, then trial redistribution where a faster charge can release a car in time. | digest eb54e3e4085050ec (tools/demo-depot.mjs); depot-experiments paired.mjs; verify pv.mjs, one.mjs | WW: "Some cars accept less power than their share. Can the depot pass that unused power to other cars and get them back to riders sooner?"<br>HOW: "12 paired seeds, 4 hours, 24 cars, 8 ports sharing 120 kW; I-PACE accepts 10 kW. Equal shares vs redistributing unused power. All else fixed; linear charging, no taper."<br>LEARN: "Model output, seeds 1001 to 1012: energy delivered rose from 441 to 455 kWh per run, yet completion stayed 23.0% and 24 visits were unfinished in both arms. Ops check: whether faster charging releases a car before the run ends." | Pass: H-3 (all three lists), dash, H-6, house words, VERDICT_CLAIMS on WW and HOW. Lengths 132/168/227 (caps 160/220/240). H-9: pin (digest-stable paired run; add a pin test like ops-cases.pins.json). Fix: show energy delivered in the paired view. |
| `deadline-charging` | Prioritize readiness deadlines | When power is short, does charging the cars needed soonest first help, and who waits longer? | Same config. Paired: redistribute against deadline. Deadlines are visit start + 45/90/135 min by car. Jobs queued 60 min or more go oldest first, and deadline mode also reorders the port queue. 12 seeds. | Model output: +0.48 points (interval +0.29 to +0.67), UNCHANGED. Ready by deadline 0 to 2; missed 24.8 to 26.0; zero-power car-minutes 0 to 1,263. Seed 42: 64% of queued-and-charging car-minutes were past the aging limit. At a 70% start: IMPROVED but HOLD (unfinished +0.25). Ops: report the delayed group beside the prioritised one, and set aging against typical session length. | digest 0820f90872c54a1d; depot-experiments paired.mjs, variants.mjs; verify pv.mjs | WW: "When power is short, does charging the cars needed soonest first help? Reordering can speed some cars and delay others."<br>HOW: "Same 24 cars, 8 ports, 120 kW. Redistribution vs deadline-first charging; jobs waiting 60 min or more go oldest first. Deadlines are tiers by car (45, 90 or 135 min after the visit starts)."<br>LEARN: "Model output, 12 seeds: completion 23.0% to 23.5%, inside the 2-point margin. Cars ready by deadline 0 to 2 per run, but missed deadlines 24.8 to 26 and idle plugged-in time 0 to 1,263 car-min. Ops check: who waits longer." | Pass: H-3 (all three lists), dash, H-6, house words, VERDICT_CLAIMS on WW and HOW. Lengths 119/189/222 (caps 160/220/240). H-9: pin. Fix: the replay loads the candidate arm and is not labelled; no guardrail covers zero-power time. |
| `resource-freshness` | Stale resource status and recovery | With late status reports, does ignoring stale charger status cut wasted reservations and return cars sooner? | 24 cars, 8 ports of 80 kW, 120 kW site. Ports 1-4 fail from minute 10 to 100. Reports come every 5 min, arrive 8 min late and stay valid 10 min. Paired last_known against fresh_only, 12 seeds. A rejected try moves on in the same minute. | Model output: completion 20.1% in both arms (UNCHANGED). Rejected reservations fall from 17.7 to 10.3, and false-ready port-minutes from 32 to 16. With no outage completion is 23.0%, so the outage itself removes service, but neither rule repairs a port. A 12-min delay against the 10-min window gives fresh-only 0 kWh: REGRESSED, HOLD. Ops: keep the validity window above the status delay, and track rejections as their own measure. | digest 47a2006bb775f099; depot-experiments paired.mjs, variants.mjs; verify pv.mjs | WW: "Charger status reports arrive late. Does it help to stop counting a charger once its last report is too old? Stale counts make the planner try failed ports."<br>HOW: "4 of 8 ports fail from minute 10 to 100. Status arrives 8 min late and stays valid 10 min. Last-known vs fresh-only status. A rejected try moves to the next port in the same minute."<br>LEARN: "Model output, 12 seeds: rejected tries fell from 17.7 to 10.3 per run, yet completion held at 20.1% because a rejected try takes no time here. Ops check: keep the validity window above your status delay." | Pass: H-3 (all three lists), dash, H-6, house words, VERDICT_CLAIMS on WW and HOW. Lengths 156/181/203 (caps 160/220/240). H-9: pin. Fix: the prediction error port minutes label leaks H-3 at runtime (bay-systems.js:11); RESOURCE_PROPOSAL_FEASIBILITY FAIL reads as a broken run. |
| `airport-preparation` | Prepare for a synthetic airport wave | Does staging cars before a synthetic airport wave protect pickups without draining other areas and depots? | Airport demo: SFO, Menlo Park and Palo Alto; 24 cars at 85%; a wave of 40 passengers with 70% conversion. The candidate stages up to 6 cars from a separately published estimate between minutes 70 and 120, and never sees actual requests. Within target means the car arrives within 10 min, not boarding. 12 seeds. | Model output: completion -1.0 points, UNCHANGED; recommendation HOLD. Within target rises from 34% to 50%. Unfinished visits rise by 0.75 (limit 0), and stored energy falls by 23.7 kWh (limit 5), of which 18.0 kWh is extra driving. Estimates of 28, 14 and 6 give identical results, because the staging cap binds. Ops: size the staging pool first, and judge staging on the whole system with an energy reserve. | digest 8b1ddd9f13db8551; depot-experiments airport-check.mjs; verify pv.mjs; n2-planned-verify airport-energy2.mjs | WW: "A synthetic arrival wave reaches SFO. Does staging cars before riders ask help? Airport pickups may improve while other areas and depot work pay for it."<br>HOW: "Same passenger wave and 24 cars in both arms. Reactive dispatch vs staging up to 6 cars from a declared wave estimate; the policy never sees actual requests. Fictional access rule."<br>LEARN: "Model output, 12 seeds: cars reaching airport riders within 10 min rose from 34% to 50%, but unfinished depot visits and stored energy passed their limits, so the result is HOLD. Ops check: size staging with an energy reserve." | Pass: H-3 (all three lists), dash, H-6, house words, VERDICT_CLAIMS on WW and HOW. Lengths 152/180/226 (caps 160/220/240). H-9: pin. Fix: forecast appears in runtime axis and option labels (advanced-operations-view.js:57, :81). |
| `redistribution-headroom` NEW | When does sharing unused power help? | When does redistribution return cars? Only if faster charging finishes a car before it is needed. | power-redistribution with cars starting at 70% instead of 35% in both arms; same seeds, ports, power and guardrails. | Model output, seeds 1001-1012: IMPROVED, ADVANCE_TO_NEXT_TEST, 46.2% to 54.2% (interval +7.0 to +9.0 points); ready by deadline 26.8 to 48.3; every guardrail within. Ops: check that a faster charge can release a car in the window that matters before judging a charging rule. | depot-experiments variants.mjs; verify pv.mjs (digest 225bbc8d429c1cbf) | WW: "When does sharing unused power actually return cars to riders? Only if faster charging finishes a car before it is needed."<br>HOW: "The power-redistribution demo with one change held in both arms: cars start the day at 70% battery instead of 35%. Same 12 paired seeds, ports, power and demand."<br>LEARN: "Model output, 12 seeds: completion 46.2% to 54.2% (interval +7.0 to +9.0 pts), all guardrails within limits, so advance to a next test. At a 35% start the same rule stayed within the margin. Ops check: whether a car can finish in time." | Pass: H-3 (all three lists), dash, H-6, house words, VERDICT_CLAIMS on WW and HOW. Lengths 122/161/235 (caps 160/220/240). H-9: pin first (exploratory). Ship as a Try a 70% start action on power-redistribution. |
| `freshness-window-vs-delay` NEW | Freshness window shorter than status delay | What if status reports arrive later than they stay valid? A strict freshness rule idles healthy chargers. | resource-freshness with a 12-min status delay (window 10) in both arms; same outage, ports and demand. | Model output, seeds 1001-1012: REGRESSED, HOLD. Completion falls from 20.1% to 17.3%; fresh-only delivers 0 kWh (last-known 453.3); terminal-energy harm is 449.3 kWh. A 2-min delay gives identical arms; a 10-min delay gives a harm of 4.71, just under the limit. Ops: measure your status delay and keep the validity window above it. | depot-experiments variants.mjs; verify pv.mjs (digest 18633c5114907703) | WW: "What if status reports arrive later than they stay valid? A strict freshness rule can idle healthy chargers."<br>HOW: "The resource-freshness demo with the status delay set to 12 min, above the 10 min validity window, in both arms. Last-known vs fresh-only; same outage, ports and demand."<br>LEARN: "Model output, 12 seeds: fresh-only delivered 0 kWh, completion fell from 20.1% to 17.3% and stored energy passed its limit: HOLD. Ops check: a validity window longer than your status delay." | Pass: H-3 (all three lists), dash, H-6, house words, VERDICT_CLAIMS on WW and HOW. Lengths 108/169/189 (caps 160/220/240). H-9: pin first (exploratory). Ship as a Try a longer delay action on resource-freshness. |

### B.4 Austin regional power

The Austin panel has no catalog lesson today. Both rows below are NEW.

| id | title | What & why | How we simulate | What you learn / ops takeaway | Evidence (short) | Proposed on-page copy (3 short lines) | Copy-rule status |
|---|---|---|---|---|---|---|---|
| `austin-power-stress` NEW | Austin: a mid-shift depot power cut | How many trips does a 90-minute power loss at one depot remove, and is it the largest limit? | 5-node fictional schematic, 40 cars, 60 req/h, 8 h, 35% start. Site A runs at 100/60/20/0% in minutes 90-180. Every condition also has a 1-port outage per depot in minutes 60-120. The lesson sets each condition explicitly, because the panel default is 60%. | Model output: seed 42 gives 83/77/77/73 of 480. Over 12 seeds: 78.7/76.9/72.3/70.8. The outage removes 7.9 (10/12 seeds worse), mostly from requests made after power returns (minutes 180-300: 17.7 against 12.0). 240 kW at both depots all shift gives 214.3, which shows the binding limit but is not a like-for-like comparison. Ops: check whether depots sit at their cap through peaks, and measure recovery after an event. | austin-launch probe-austin-single.mjs, -sweep.mjs, -headroom.mjs; verify p-verify1.mjs; observed-results.json baseline means | WW: "A depot loses 40%, 80% or all of its power for 90 minutes mid-shift. How many trips does the fleet lose, and is that its biggest limit?"<br>HOW: "Synthetic Austin-inspired map, 40 cars, 2 depots, 8 hours. Site A power drops in minutes 90 to 180; Site B keeps 120 kW. Every run also has 1 port per depot out in minutes 60 to 120."<br>LEARN: "Model output: seed 42 completed 83, 77, 77 and 73 of 480 requests. Over 12 seeds the outage removed 7.9 trips, mostly after power returned; a 240 kW all-day cap at both depots added about 136, but that is not like for like (about 1,920 kWh nominal against the roughly 180 kWh the outage removes). Ops check: the all-day power cap next to the outage." (Source and after-run text only; never a static field.) | Pass: H-3 (all three lists), dash, H-6, house words, VERDICT_CLAIMS on WW and HOW. Lengths 135/182/232 (caps 160/220/240). H-9: pin (12-seed means equal the artifact baseline_mean x 480). Owner decision on a new id; stress variant of shared-power. |
| `austin-deadline-priority` NEW | Austin: deadline charging during a power cut | Can charging the car with the earliest deadline first protect service during a power cut, and what does it trade? | Paired, 12 seeds 1001-1012: capped redistribution against deadline priority with 60-min aged-job protection. Deadlines are 45/90/135 min after visit start. Margin plus or minus 2 points; four guardrails. Tuning seeds are declared but not run. | Model output: +0.50/+0.19/+0.69/+0.59 points, UNCHANGED everywhere. HOLD at 60% (unfinished +0.33) and at outage (energy -5.39 against 5). These deltas and verdicts match observed-results.json, digests included. Probe, seeds 1001-1012: missed deadlines rise by 4.7 to 5.8 per seed, and serial fill leaves most plugged-in cars at 0 kW. Ops: check deadline feasibility at the power each car receives, and treat charge order as secondary to power and ports. | artifacts/fleetlab-regional-power/demo/observed-results.json; regional-power-d1.test.mjs:40-47; verify p-verify2.mjs | WW: "During a depot power cut, does charging the car with the earliest readiness deadline first return more cars to riders? A no-hardware change ops could try."<br>HOW: "Paired runs on 12 seeds: power shared across plugged-in cars versus full power to the earliest deadline first (cars waiting 60 min go first). Same demand, power window and ports. The margin is 2 points."<br>LEARN: "Model output: completion moved +0.19 to +0.69 points in all four conditions, inside the 2-point band; HOLD at 60% (unfinished visits) and outage (end energy). Ops check: deadlines reachable at the power each car gets." | Pass: H-3 (all three lists), dash, H-6, house words, VERDICT_CLAIMS on WW and HOW. Lengths 154/202/217 (caps 160/220/240). H-9: pinned by the recorded artifact; add a test for all four conditions. The missed-deadlines clause is a probe (p-verify2), not in the artifact, so it moved out of LEARN to make room for the ops check. Owner decision on a new id; stress variant of deadline-charging. |

### B.5 Launch rehearsal

| id | title | What & why | How we simulate | What you learn / ops takeaway | Evidence (short) | Proposed on-page copy (3 short lines) | Copy-rule status |
|---|---|---|---|---|---|---|---|
| `region-launch` | Rehearse commissioning in Region B | How much rider service does a launch lose when installed ports are commissioned late, and which measure shows it? | Region B template: a fictional region with 2 depots (120 kW with 3 ports of 60 kW; 60 kW with 2 ports of 35 kW), 24 cars, 45 req/h, 4 h, 35% start, a visit after every trip, 10-min target, seed 42. Commissioning at minute 0 against minute 90; a delay of 0 is an exact null. One seed, descriptive. | Model output: 34 to 29 completed of 179. Late pickups fall from 11 to 6 and missed rise from 139 to 144 (10 late riders became missed, 5 missed became late). On-time stays at 24 in both arms (one first trip per car). Queue +449 task-min; energy -198 kWh. Seeds 1-10: Region B loses 5 to 6 and the Peninsula 3 to 5 in every run. Ops: treat each commissioning date as a service item with an owner, read completed and late-to-missed over the slip window, and keep a zero-delay control. | austin-launch probe-launch.mjs, probe-launch-timing.mjs; verify; pin launch-rehearsal.test.mjs (delay 0 null) | WW: "If new charging ports come online 90 minutes late, how much rider service is lost? Launch teams need to know which commissioning dates carry service risk."<br>HOW: "Two runs on Region B with the same demand seed: ports commissioned at minute 0 versus minute 90. All else fixed. Sites, tasks and owners are fictional; setup checks are not inspections."<br>LEARN: "Model output, seed 42: completed trips fell from 34 to 29; late pickups fell from 11 to 6 as missed rose by 5. On-time pickups held at 24, one per car before its first depot visit. Ops: give each port task a date; test a slip." | Pass: H-3 (all three lists), dash, H-6, house words, VERDICT_CLAIMS on WW and HOW. Lengths 154/185/226 (caps 160/220/240). H-9: pin (seed 42 and seeds 1-10 deterministic). Fix: the current line leads with within-target by 0 (launch-view.js:36); the next step is circular; dash leaks at launch-rehearsal.js:19 and launch-contract.js:25; the lesson link does not scroll to the panel. |

### B.6 Street lab

| id | title | What & why | How we simulate | What you learn / ops takeaway | Evidence (short) | Proposed on-page copy (3 short lines) | Copy-rule status |
|---|---|---|---|---|---|---|---|
| `street-first` | Bridge rush | When 1st Street backs up toward the Bay Bridge, how many journeys still finish, and are East Bay trips the only ones hurt? | Hotspot first: 24 AVs, 36 req/h, 900 background vehicles/h (about 63% on 1st Street), 75% loss in minutes 15-90, 120 min from 16:00 with no rush multiplier. Compare route policies on identical demand. | Model output, seed 42: 37/71, or 41/71 with queue-aware routes. No incident gives 38; half the traffic gives 46 (0 pending). Five seeds: 0 to +4 completed, mostly East Bay (9 to 13 of 23; SFO 14 in both); empty km -24 to +59 (up in 4/5). The ride is 28.2 min against 21.2 with no traffic, so volume makes this corridor street-limited. Ops: separate recurrent from incident delay, and test routing on bridge legs with empty distance as a guardrail. | street probe.mjs, probe2-4.mjs; verify v-*.mjs | WW: "Bridge rush: when 1st Street backs up toward the Bay Bridge, how many rider journeys still finish, and are East Bay trips the only ones hit?"<br>HOW: "Defaults: 24 AVs, 36 rider requests/h, 900 other vehicles/h with about 60% on 1st Street, 75% capacity loss from minute 15 to 90. Compare route policies runs both rules on the same demand."<br>LEARN: "Seed 42: 37 of 71 journeys finished; 38 with no incident, 46 at half the other traffic: volume drives this queue. Queue-aware routes added 0 to 4 over five seeds, mostly East Bay, usually adding empty km. Ops: test it on bridge legs." | Pass: H-3 (all three lists), dash, H-6, house words, VERDICT_CLAIMS on WW and HOW. Lengths 140/188/233 (caps 160/220/240). H-9: pin (seed-42 compare in a new street pins file; five-seed ranges as descriptive). Fix: the title implies rush-hour demand the model does not add. |
| `street-harrison` | SoMa ramp feeders | Does a detour around a jammed ramp approach help service, or move the queue to neighbouring streets? | Hotspot harrison: 84 links, 4.7 km, 29 signal-tagged. Queue-aware weight = travel + 11.25 s per signal + queue / discharge + 90 s if the next block is full + an incident penalty, chosen when a leg starts. | Model output, seed 42: 48 against 50. Five seeds: -1 to +3, with empty km +17 to +78 (up in all five). Corridor legs go from 74/106 to 64/108, but the corridor peak is 119 against 117 and off-corridor queue 1,038 against 1,062 vehicle-min. At 95% loss the gain is +16 to +22 (seeds 42/1/2). Ops: test a severity-triggered detour, with empty distance and neighbour queues as guardrails. | street probe.mjs, probe2-4.mjs, probe6.mjs; verify | WW: "SoMa ramp feeders: if AVs detour around a jammed Harrison and Bryant approach, does service improve, or does the queue just move to the next street?"<br>HOW: "Defaults with the incident and about 60% of other traffic on Harrison, Bryant, Essex and 4th. Queue-aware routes weigh current queues, full blocks and the incident when each leg starts."<br>LEARN: "Seed 42: queue-aware routes finished 50 vs 48 journeys (-1 to +3 over five seeds) and added 17 to 78 empty km; nearby corridor queues barely moved. At 95% loss the gain was 16 to 22 (three seeds). Ops: test severity triggers." | Pass: H-3 (all three lists), dash, H-6, house words, VERDICT_CLAIMS on WW and HOW. Lengths 148/185/225 (caps 160/220/240). H-9: pin (seed-42 compare in a new street pins file; five-seed ranges as descriptive). Fix: Where did the queue move? shows only the current run, with no per-corridor comparison. |
| `street-stockton` | Chinatown friction | When crossings, buses and deliveries slow a pickup street, how much service is lost, and does dwell matter as much? | Hotspot stockton: 40 links, 1-2 lanes. Friction is a discharge loss in minutes 15-90; individual pedestrians and buses are not modeled. About half of pickups start at Chinatown. Sweeps: loss 0-95%, dwell 30-300 s. | Model output, seed 42: 44 with no incident, 46 with no other traffic, 31 with both. Loss 0/25/50/75/95% gives 44/43/35/31/29 (the 25% drop varies 1 to 7 by seed). Queue-aware routes add +12 to +19 (five seeds), with empty km +106 to +234; 503 of 507 AV-min of entry wait were at the Chinatown anchor. Dwell 60 to 300 s removes only 5. Ops: test pickup-exit placement or exit-aware routing before dwell reductions. | street probe.mjs, probe3-4.mjs; verify | WW: "Chinatown friction: when crossings, buses and deliveries slow how fast Stockton Street discharges, how much fleet service is lost near the pickup?"<br>HOW: "Friction is a capacity loss on Stockton and its tunnel from minute 15 to 90; pedestrians and buses are not modeled one by one. Try 0, 50 and 95% loss, then pickup dwell, then compare routes."<br>LEARN: "Seed 42: 44 of 71 finished with no incident, 46 with no other traffic, 31 with both. Queue-aware routes restored 44 by sending AVs out on streets with room, adding 106 to 234 empty km over five seeds. Ops: test pickup exits." | Pass: H-3 (all three lists), dash, H-6, house words, VERDICT_CLAIMS on WW and HOW. Lengths 146/190/224 (caps 160/220/240). H-9: pin (seed-42 compare in a new street pins file; five-seed ranges as descriptive). Fix: the entry-wait mechanism shows only per AV, never in the summary. |
| `street-van-ness` | Van Ness signals | If a signal corridor slows trips, can a larger fleet make up the lost service? | Hotspot van-ness: 97 links, 60 signal-tagged, on the same 90 s cycle as every tagged link. 30 imported OSM turn restrictions touch it; no BRT or signal control is modeled. Fleet sweep 12-60 AVs. | Model output, seed 42: 12/24/36/48/60 AVs finish 22/43/50/50/50, and pickup wait falls from 29.6 to 6.4 min. The ride is 23.7-24.5 min at every size, and 23.1 with no traffic, so the corridor adds little and the day is supply-limited. Queue-aware routes add +1 to +3. Ops: compare ride time with a no-traffic baseline before blaming the street, and test fleet size first. | street probe4.mjs, probe2.mjs; verify (framing refuted and corrected) | WW: "Van Ness signals: if a signal corridor slows trips, can a larger fleet make up the lost service, or does the street still set the pace?"<br>HOW: "Defaults on Van Ness. Signals use the shared synthetic 90 second cycle and imported turn restrictions apply; no signal control is modeled. Run 12, 24, 36 and 48 AVs on the same seed and compare."<br>LEARN: "Seed 42: 12 AVs finished 22 of 71, 24 finished 43, 36 finished 50. Pickup wait fell from 29.6 to 9.5 min. Rides stayed near 24 min, 23 with no other traffic, so this day is supply-limited. Ops: test fleet size first." | Pass: H-3 (all three lists), dash, H-6, house words, VERDICT_CLAIMS on WW and HOW. Lengths 135/194/216 (caps 160/220/240). H-9: pin (seed-42 compare in a new street pins file; five-seed ranges as descriptive). Fix: the cause text claims a lower discharge rate the model does not set (street-simulation.js:9). |
| `street-embarcadero` | Waterfront event | When event traffic fills the waterfront near a pickup point, what happens to service, including SFO trips? | Hotspot embarcadero. No event burst is added: event pressure is the Other road traffic input (about 63% on the corridor). Sweep 0-2,400 background vehicles/h. | Model output, seed 42: 0/450/900/1,350/1,800/2,400 per h give 44/17/14/14/12/11 completed; SFO-bound 14/5/2/3/2/1 of 26; pending 0 to 3,498. Mean pickup wait stays 13.6-15.8 min throughout, because it counts boarded riders only. The no-incident control also gives 14. Queue-aware routes add +1 to +6. Ops: judge event days by finished, expired and unfinished journeys, and test staging pickups off the event street (not modeled). | street probe4.mjs, probe3.mjs; verify | WW: "Waterfront event: when event traffic fills The Embarcadero near the pickup point, what happens to rider service, including trips to SFO?"<br>HOW: "Event pressure is the Other road traffic setting: about 60% of it runs along The Embarcadero, and about half of pickups start at the Ferry Building approach. Try 0, 450 and 900 vehicles/h."<br>LEARN: "Seed 42: 44 of 71 finished with no other traffic, 17 at 450/h, 14 at 900/h; SFO-bound fell from 14 to 2. Pickup wait stayed near 15 min because it counts boarded riders only. Ops: test pickups off the event street." | Pass: H-3 (all three lists), dash, H-6, house words, VERDICT_CLAIMS on WW and HOW. Lengths 136/188/214 (caps 160/220/240). H-9: pin (seed-42 compare in a new street pins file; five-seed ranges as descriptive). Fix: the cause text describes a traffic burst the preset does not set. |
| `street-lombard` | Lombard visitor queue | Does a slow, famous block tie up the fleet, or do vehicles lose time on the streets around it? | Hotspot lombard: 16 links (13 single-lane, 3 three-lane, 25-48 km/h; the crooked links are 40.2 km/h). Queue by street at the busiest frame, plus a trace of the queued Hyde blocks. | Model output, seed 42: at the busiest moment 120 are queued, 57 on Hyde and 25 on Lombard. Queue vehicle-min: 5,968 off the corridor against 3,361 on it. The 189 background trips through queued Hyde blocks are SFO-bound gateway trips. Loss of 0/75/95% gives 39/39/39, since 10 of 96 AV legs touch Lombard. Queue-aware routes add 0 to +4, with empty km +15 to +81. Ops: map where fleet vehicles queue on pickup exits before targeting a famous hotspot. | street probe2.mjs, probe5.mjs; live page check; verify | WW: "Lombard visitor queue: does a slow, famous block tie up the fleet, or do vehicles lose time on the streets around it?"<br>HOW: "Defaults with the incident and about 60% of other traffic on Lombard. Use Largest queue, then Inspect a block, to see which street holds the most queued vehicles."<br>LEARN: "Seed 42: Lombard peaked at 32 queued vehicles, but at the busiest moment 57 of 120 queued vehicles were on Hyde Street, an exit from the Lombard pickup. 0 to 95% loss left 39 of 71 finished. Ops: check pickup exits first." | Pass: H-3 (all three lists), dash, H-6, house words, VERDICT_CLAIMS on WW and HOW. Lengths 117/162/221 (caps 160/220/240). H-9: pin (seed-42 compare in a new street pins file; five-seed ranges as descriptive). Fix: the result cards cannot show the Hyde queue; the literal null line (street-lab.js:116). |
| `street-fleet-share` NEW | Fleet share: when does routing move the queue? | At what fleet size does routing AVs around a jam start to move the street queue itself? | Harrison hotspot at defaults, then 60 AVs and 120 req/h. Compare route policies at both sizes. | Model output: at 24 AVs the Harrison peak changes by 0 to -8 (seeds 42/1/2); at 60 AVs by -16 to -21. Seed 42 at 60 AVs: corridor queue -12%, other streets +6%, 126 against 121 of 252 finished, +202 empty km. Ops: re-test detour rules as fleet share grows, with neighbour-street queues as a guardrail. | street probe6.mjs; verify (holds on seeds 1 and 2) | WW: "Fleet share: at what fleet size does routing AVs around a jam start to move the queue itself, not just the AVs?"<br>HOW: "Harrison hotspot with defaults, then 60 AVs and 120 rider requests/h. Compare route policies at both sizes; read the corridor peak and the largest road queue."<br>LEARN: "Seeds 42, 1, 2: at 24 AVs the Harrison peak moved 0 to 8 vehicles under queue-aware routes; at 60 AVs it fell 16 to 21. Seed 42 at 60 AVs: 126 vs 121 of 252 finished, 202 km more empty. Ops: re-test detours at scale." | Pass: H-3 (all three lists), dash, H-6, house words, VERDICT_CLAIMS on WW and HOW. Lengths 111/158/216 (caps 160/220/240). H-9: pin first. Queue vehicle-minutes are not a summary field, so the UI uses corridor peak and total queued only. |

### B.7 Four-area workbench and workspace

| id | title | What & why | How we simulate | What you learn / ops takeaway | Evidence (short) | Proposed on-page copy (3 short lines) | Copy-rule status |
|---|---|---|---|---|---|---|---|
| `bay_teaching_map` | Bay teaching map | Before changing anything, where does a normal two-day cycle lose rider time, and which depot queues? | Sandbox replay of the default map: 120 cars (SF 40, PEN 24, SJ 32, EB 24) and four depots. Sigma is 0, so seeds 1001-1003 are byte-identical. | Model output, sigma 0: 1,795 requests, 9 unserved (0.50%). Wait p90 is 1,968 s overall and 3,946.8 s in the 16-19 evening; San Jose is the longest area (2,191.2 s). SF-2 bay wait p90 is 11,890.8 s, and its longest single wait of 15,022 s is pinned. Bay queues form only between D2 00:00 and 07:00, but overnight riders feel the recall (D2 00-07 p90 2,102 s on 282 requests). Ops: build this baseline by area, hour and depot before testing levers. | four-area default-replay.mjs; verify baymap-detail.mjs; pin presets.test.mjs:194-221 | WW: "Before changing anything: where does a normal fleet day lose time? A baseline shows which area waits longest and which depot queues."<br>HOW: "120 cars in four zones, four depots, peaks from 07:00 and 16:00, a depot visit every 10 trips, recall at D2 00:30, release at 05:45. Travel variation is 0, so every replay repeats."<br>LEARN: "In this replay the evening peak and San Jose wait longest, and SF-2's bay queue builds overnight while few riders are out. An ops team would first map its own waits and depot queues by hour." | Pass: H-3 (all three lists), dash, H-6, house words, VERDICT_CLAIMS on WW and HOW. Lengths 132/180/190 (caps 160/220/240). H-9: pin (directional baseline facts; presets.test.mjs:194-221 pins only the envelope). Fix: generic question and Learn (simulation-catalog.js:42, :45). |
| `L1` | Peak and off-peak with the same fleet | With the same fleet and the same declared daily total, does peaked timing matter? An average can hide an evening shortfall. | L1 scenario. One change: DEM-5 flat to peaked. The declared total is 1,763 in both arms; the counted totals are 1,754 and 1,806, partly because of the warm-up hour. Primary: evening p90 16-19, margin 60 s; guardrail unserved. This is an exposure test, not a decision. | Model output, seed set 1: REGRESSED, HOLD. 856.3 to 4,335.5 s (+3,479.2, interval 3,380.3 to 3,587.0); unserved 0.03% to 4.67%. The same holds on two other rider draws. Pinned moment: 1.89 cars at a depot in the 17:00 hour against 6.50 at 20:00. Ops: measure peak-to-average by area and hour, and size and schedule to peak windows. | four-area run-presets.mjs, probes2.mjs P9; captions.test.mjs L1 pins | WW: "Same fleet, same declared daily total: does it matter when riders ask? Fleets are sized for peaks, and a daily average can hide an evening shortfall."<br>HOW: "Flat versus peaked demand with the same declared total. Primary: rider wait p90 from 16:00 to 19:00, 60 s margin. Guardrail: unserved share. 20 paired seeds."<br>LEARN: "In this model the peak lifts evening wait p90 from about 14 to 72 minutes and unserved from 0.03% to 4.7%. HOLD means this fleet does not absorb the peak, not a choice. Ops check: size and schedule to peak windows." | Pass: H-3 (all three lists), dash, H-6, house words, VERDICT_CLAIMS on WW and HOW. Lengths 149/157/214 (caps 160/220/240). H-9: pinned verdict (test/presets.test.mjs:113); add a learn-line test binding its outcome word and about-numbers to the pin. Tag it Exposure test. |
| `L2a` | Bays are not always the bottleneck | With San Jose at 12 cars, does cutting SJ-1 from 3 bays to 1 raise San Jose evening wait? | San Jose at 12 cars, a visit every 5 trips. One change: SJ-1 bays 3 to 1. Primary: SJ p90 16-19, margin 60 s; unserved guardrail. | Model output: INCONCLUSIVE, RUN_MORE_EXPERIMENTS. +25.3 s (interval -135.3 to 209.2); SJ-1 bay wait p90 297.5 to 3,385.6 s. 100 seeds: +90.9 (7.7 to 173.2). Twenty more San Jose cars move the evening p90 by only -554 s, so lack of cars is not the whole story. Ops: find what drives the wait (cars, traffic or depots) before cutting capacity, and guard the queue you cut. | four-area run-presets.mjs, probes.mjs P3; verify l2-cars.mjs | WW: "San Jose runs with 12 cars. Does cutting SJ-1 from 3 cleaning bays to 1 make its riders wait longer? Find what binds before cutting capacity."<br>HOW: "12 San Jose cars, a depot visit every 5 trips. One change: SJ-1 bays 3 to 1. Primary: San Jose wait p90, 16:00 to 19:00, 60 s margin. 20 paired seeds."<br>LEARN: "San Jose riders already wait about 96 minutes at p90 this evening. Cutting bays moves that by +25 s, interval -135 to +209 s: unresolved. Ops check: what binds before cutting bays, and a guardrail on the queue you cut." | Pass: H-3 (all three lists), dash, H-6, house words, VERDICT_CLAIMS on WW and HOW. Lengths 141/150/218 (caps 160/220/240). H-9: pinned verdict (test/presets.test.mjs:114); add a learn-line test binding its outcome word and about-numbers to the pin. |
| `L2b` | Bays are not always the bottleneck, with a bay wait guardrail | Does declaring a depot guardrail before the run change what the same experiment recommends? | L2a plus an SJ-1 bay wait p90 guardrail, max harm 600 s, declared first. | Model output: INCONCLUSIVE, HOLD. The rider delta is the same +25.3 s. The SJ-1 guardrail regressed (harm 3,088.2 s against 600). The interval prints -148.6 to 189.7 because the bootstrap is keyed on the spec digest. Ops: include the resource being cut as a guardrail before any capacity reduction. | four-area run-presets.mjs; presets.test.mjs:65 | WW: "L2a with one extra rule written first: SJ-1 bay wait may not grow by more than 10 minutes. Does a rule declared in advance change the recommendation?"<br>HOW: "Identical arms and seeds to L2a. Added guardrail: SJ-1 bay wait p90, max harm 600 s, declared before the run."<br>LEARN: "Rider wait reads as in L2a, but SJ-1 bay wait p90 grows from about 5 to 56 minutes, so the recommendation becomes HOLD. Ops check: a guardrail on the resource you cut, written before the run." | Pass: H-3 (all three lists), dash, H-6, house words, VERDICT_CLAIMS on WW and HOW. Lengths 149/109/191 (caps 160/220/240). H-9: pinned verdict (test/presets.test.mjs:115); add a learn-line test binding its outcome word and about-numbers to the pin. Add the one-line note on why the two intervals differ. |
| `L3` | Evening depot visit in San Jose | When a depot visit comes due, home depot or the nearest one? The rule moves load and shapes next-morning supply. | Evening highways x1.6 (16-19), local roads x1.3. One change: depot assignment from home to nearest. Primary: SF p90 D2 07-09. Guardrails: congested empty driving, SJ-1 lot, unserved. | Model output on this preset's riders: IMPROVED, ADVANCE, -646.5 s (interval -949.7 to -341.8) on sets 1-3. Four other rider draws read IMPROVED, INCONCLUSIVE with HOLD, INCONCLUSIVE, and REGRESSED with HOLD. In every draw SF-2 gets no visits (the tie-break goes to SF-1 by id; seed 1001: 47 to 0) and another lot fills (EB-1 73% to 98% here). Ops: guard every depot lot and check visits per depot before changing an assignment rule. | four-area run-presets.mjs, probes2.mjs P8; verify draw-robust.mjs | WW: "When a depot visit comes due, does a car do better at its home depot or the nearest one? The rule moves load between depots and shapes next-morning supply."<br>HOW: "Evening highway slowdown set. One change: home depot to nearest depot. Primary: San Francisco wait p90, D2 07:00 to 09:00. Guardrails: congested empty driving, SJ-1 lot, unserved."<br>LEARN: "With this preset's riders, nearest depot lowers SF morning wait p90 by about 11 minutes; 3 of 4 other rider draws read worse. In every draw SF-2 gets no visits and another lot fills. Ops check: a guardrail per depot." | Pass: H-3 (all three lists), dash, H-6, house words, VERDICT_CLAIMS on WW and HOW. Lengths 155/179/216 (caps 160/220/240). H-9: pinned verdict (test/presets.test.mjs:116); add a learn-line test binding its outcome word and about-numbers to the pin. The direction is not robust across rider draws: pin the load-shift claim on 3 or more draws. Fix: the Learn story follows a San Jose car while the verdict comes from SF-2. |
| `UC-01` | Null check | Does the harness read no change when nothing changes? | Bay map settings at sigma 0.15; DEP-7 is 10 in both arms. Primary: whole-run p90, margin 30 s; unserved guardrail. | Model output: UNCHANGED, NO_RECOMMENDATION. 0 s (interval 0 to 0); 0 of 20 paired deltas are non-zero. Its baseline differs from the Bay map because the preset name draws different riders (4.16% unserved even at sigma 0), not because of travel variation. Ops: run an A/A test before any A/B, and treat any non-zero difference as a harness defect. | four-area run-presets.mjs; summary.test.mjs:142-162; verify sigma-iso.mjs | WW: "Does the test say no change when nothing changes? A null check shows the harness is not inventing differences."<br>HOW: "Both arms set trips between depot visits to 10. Same riders and travel draws in both arms. Primary: rider wait p90, 30 s margin. 20 paired seeds."<br>LEARN: "Every paired gap is 0 s: UNCHANGED. Later experiments start from a harness that adds no noise of its own. Ops check: run an A/A test in your own tooling before any A/B." | Pass: H-3 (all three lists), dash, H-6, house words, VERDICT_CLAIMS on WW and HOW. Lengths 110/145/168 (caps 160/220/240). H-9: pinned verdict (test/presets.test.mjs:117); add a learn-line test binding its outcome word and about-numbers to the pin. Fix: the catalog renders 10 to 10 as a declared change; the change text is empty in the after-run line. |
| `UC-02` | How many cars does San Jose need? | With San Jose at 16 cars (half the map's 32), do 8 more cut its morning wait, and do the neighbours gain too? | One change: SUP-1.SJ 16 to 24. Primary: SJ p90 D1 07-09, margin 60 s. Guardrails: unserved share for all areas and for SF. | Model output: IMPROVED, ADVANCE. -743.0 s (interval -901.4 to -593.0); SF unserved 8.88% to 6.14%. Sets 2/3: -783.8 and -798.9. IMPROVED on other rider draws too, though the size varies (-743 to -1,920 s). Ops: sweep sizes on the same demand, and read the neighbours as guardrails. Moving cars at a fixed total is not one axis in this model. | four-area run-presets.mjs, probes.mjs P4; verify draw-robust.mjs | WW: "San Jose starts with 16 cars, half the map's 32. Do 8 more cut its morning wait, and do neighbours gain too? A first fleet sizing question for one area."<br>HOW: "One change: San Jose cars 16 to 24; other areas stay the same. Primary: San Jose wait p90, 07:00 to 09:00, 60 s margin. Guardrails: unserved share, all areas and San Francisco."<br>LEARN: "Wait p90 falls by about 12 minutes (interval 10 to 15) and unserved falls in San Francisco too. Probe runs at 24 to 32 and 32 to 40 cars show no plateau yet. Ops check: sweep sizes before choosing one." | Pass: H-3 (all three lists), dash, H-6, house words, VERDICT_CLAIMS on WW and HOW. Lengths 152/176/201 (caps 160/220/240). H-9: pinned verdict (test/presets.test.mjs:118); add a learn-line test binding its outcome word and about-numbers to the pin. The ladder clause is a probe: pin it (see UC-02-ladder) or drop it. |
| `UC-03` | Rider patience and the population trap | Can a wait metric look better because riders gave up? | One change: RID-1 patience 1,200 to 300 s. Primary: whole-run p90, margin 30 s; unserved guardrail 0.01. | Model output: IMPROVED, HOLD. -572.8 s (interval -656.8 to -490.5); unserved 2.65% to 4.44% (harm 0.0179 against 0.01); riders counted 1,785.5 to 1,752.5. The same holds on sets 2 and 3 and on two other draws. Ops: report wait percentiles beside unserved share and the number of riders measured, and treat patience as something to measure. | four-area run-presets.mjs; presets.test.mjs:82-95 | WW: "Can a wait metric improve because riders gave up? Watching only wait percentiles can reward lost riders."<br>HOW: "One change: rider patience 20 to 5 minutes. Primary: rider wait p90, 30 s margin. Guardrail: unserved share, max harm 1 point. 20 paired seeds."<br>LEARN: "Wait p90 falls by about 10 minutes while unserved rises from 2.7% to 4.4%, so the recommendation is HOLD: fewer riders are counted. Ops check: read wait beside unserved and population size." | Pass: H-3 (all three lists), dash, H-6, house words, VERDICT_CLAIMS on WW and HOW. Lengths 104/143/189 (caps 160/220/240). H-9: pinned verdict (test/presets.test.mjs:119); add a learn-line test binding its outcome word and about-numbers to the pin. |
| `UC-05` | End-of-day highway slowdown | How exposed is San Jose's evening service to slower highways? This is a condition, not a decision. | RD-3 evening highways from 1.0 (free flow) to 1.6 in both directions, 16-19. The map's own evening sits between (x1.6 out of SF, x1.2 elsewhere). Primary: SJ p90 17-20; guardrails unserved and available fleet. | Model output: REGRESSED, HOLD. 828.1 to 5,775.5 s (+4,947.5), where the map's default evening gives 5,045.4 s; unserved 0 to 4.74%. Probes with the slowdown in both arms: +8 SJ cars gives -187 s and nearest depot -80 s (both INCONCLUSIVE). Ops: map which areas depend on highway trips, then test responses with the condition held fixed. | four-area run-presets.mjs, probes.mjs P5; verify uc05-context.mjs | WW: "How much of San Jose's evening wait comes from slow highways? This compares free-flowing highways with a x1.6 slowdown: a condition, not a decision."<br>HOW: "One change: every highway from free flow (x1.0) to x1.6, 16:00 to 19:00; the map's own evening sits between. Primary: San Jose wait p90, 17:00 to 20:00, 60 s margin. Guardrails: unserved, available fleet."<br>LEARN: "San Jose wait p90 rises from about 14 minutes on free-flowing highways to 96 at x1.6. HOLD means the condition harms service, not a choice. In probes, 8 more cars recover about 3 minutes. Ops check: which areas depend on highway trips." | Pass: H-3 (all three lists), dash, H-6, house words, VERDICT_CLAIMS on WW and HOW. Lengths 148/204/235 (caps 160/220/240). H-9: pinned verdict (test/presets.test.mjs:120); add a learn-line test binding its outcome word and about-numbers to the pin. The probe clause (8 more cars) is exploratory: pin it or drop it. Tag it Exposure test. |
| `UC-08a` | Depot throughput: more cleaning bays at SF-1 | Would 2 more cleaning bays at SF-1 shorten rider waits, or does the queue they fix not reach riders? | One change: DEP-3.SF-1 4 to 6. Primary: whole-run p90, margin 30 s; unserved guardrail. This is the workbench default example. | Model output: UNCHANGED, NO_RECOMMENDATION. -3.4 s (interval -10.2 to 0.4); 17 of 20 seeds do not move. SF-1's own bay wait p90 falls from 3,518.6 to 1,882.0 s (20/20 seeds, derived from logs). Other rider draws read INCONCLUSIVE, never IMPROVED. UC-10 is the positive control. Ops: check whether the queued cars are the ones riders need at the peak before adding bays. | four-area run-presets.mjs, probes.mjs P2; framing-verify v-*.mjs (SF-1 queue); verify draw-robust.mjs | WW: "Would two more cleaning bays at SF-1 shorten rider waits? Bays are slow to add, so check that they reach riders first."<br>HOW: "One change: SF-1 cleaning bays 4 to 6. Primary: rider wait p90 over the whole run, 30 s margin. Guardrail: unserved share. 20 paired seeds."<br>LEARN: "SF-1's own bay wait p90 halves (about 59 to 31 min, 20 of 20 seeds), yet rider wait p90 moves -3 s (interval -10 to 0): UNCHANGED. A shorter depot queue did not reach riders. Ops check: who waits in that queue?" | Pass: H-3 (all three lists), dash, H-6, house words, VERDICT_CLAIMS on WW and HOW. Lengths 118/139/210 (caps 160/220/240). H-9: pinned verdict (test/presets.test.mjs:121); add a learn-line test binding its outcome word and about-numbers to the pin. The SF-1 queue clause needs a pinned descriptive (an SF-1 bay wait metric) first. Fix: the home card promises bay wait and turnaround the preset does not declare. |
| `UC-08b` | Depot throughput: a shorter clean | Would a 15-min clean return cars to riders sooner, as an alternative to more bays? | One change: DEP-4 1,200 to 900 s at every depot. Primary: whole-run p90, margin 30 s; unserved guardrail. | Model output: INCONCLUSIVE, RUN_MORE_EXPERIMENTS. -32.2 s (interval -69.8 to 0.7); bay wait p90 7,466.5 to 4,963.1 s; turnaround p90 8,950.6 to 6,403.8 s. 100 seeds: -35.7 (-53.0 to -19.7), which straddles the margin. The class holds on other draws. Ops: fix the smallest rider change worth acting on before running, and compare a faster process with added bays on the same primary. | four-area run-presets.mjs, probes.mjs P3 | WW: "Would a 15 minute clean instead of 20 return cars to riders sooner? A faster process is an alternative to more bays."<br>HOW: "One change: clean time 20 to 15 minutes at every depot. Primary: rider wait p90 over the whole run, 30 s margin. Guardrail: unserved share. 20 paired seeds."<br>LEARN: "Depot turnaround p90 falls by about 42 minutes, but rider wait p90 moves -32 s (interval -70 to +1): unresolved. With 100 seeds it stays near the margin. Ops check: set the margin that matters first." | Pass: H-3 (all three lists), dash, H-6, house words, VERDICT_CLAIMS on WW and HOW. Lengths 116/156/199 (caps 160/220/240). H-9: pinned verdict (test/presets.test.mjs:122); add a learn-line test binding its outcome word and about-numbers to the pin. The 100-seed clause is a probe: pin it or drop it. Fix: the INCONCLUSIVE reason says too wide, but the interval straddles the margin. |
| `UC-10` | Pool the bays or spread them? | With the same 11 bays, pool them at SF-1 or spread them to SJ-1? | Nearest depot with capacity rule. DEP-3 6/2/1/2 to 4/2/3/2; the candidate is the default layout. Primary: whole-run p90; three guardrails. | Model output: IMPROVED, ADVANCE. -193.0 s (interval -237.6 to -143.2); SJ-1 bay wait p90 25,697.7 to 7,804.1 s; SF-2 lot 0% in both arms (no visits under this rule). The class holds on other draws. Ops: place bays where the routing rule sends cars, and check visits per depot before counting a depot's capacity. | four-area run-presets.mjs, probes2.mjs P8 | WW: "Same 11 cleaning bays: pool 6 at SF-1 with 1 at SJ-1, or spread them 4 and 3? A layout choice that adds no capacity."<br>HOW: "Rule: nearest depot with a free stall. One change: bays 6, 2, 1, 2 to 4, 2, 3, 2 at SF-1, SF-2, SJ-1, EB-1. Primary: rider wait p90, 30 s margin. Three guardrails."<br>LEARN: "Spreading lowers wait p90 by about 3 minutes and SJ-1 bay wait p90 from 7.1 to 2.2 hours. SF-2 gets no visits in either layout under this rule. Ops check: put bays where your routing sends cars." | Pass: H-3 (all three lists), dash, H-6, house words, VERDICT_CLAIMS on WW and HOW. Lengths 116/163/194 (caps 160/220/240). H-9: pinned verdict (test/presets.test.mjs:123); add a learn-line test binding its outcome word and about-numbers to the pin. Fix: the question does not say the candidate is the default layout. |
| `L3b` NEW | Home or nearest depot, every lot guarded | Does L3's recommendation stand when every depot the rule can fill is guarded? | The L3 spec plus an EB-1 lot peak guardrail (0.1), declared first. | Model output (probe, one rider draw): IMPROVED, HOLD; the EB-1 lot guardrail harm is 0.258 against 0.1. Other draws change which lot fills. Ops: give every depot a lot and queue guardrail before changing an assignment rule. | four-area probes.mjs P1 (playground-spec:ce8b1fb8); verify | WW: "L3 depot rule change with the EB-1 lot guarded too. Does the recommendation stand when every depot the rule can fill is watched?"<br>HOW: "Identical to L3 plus one guardrail declared first: EB-1 lot peak share, max harm 10 points, the same limit SJ-1 has."<br>LEARN: "In one rider draw SF morning wait still improves, but EB-1 lot peak rises 26 points and the recommendation becomes HOLD. Ops check: a guardrail at each depot the rule can fill." | Pass: H-3 (all three lists), dash, H-6, house words, VERDICT_CLAIMS on WW and HOW. Lengths 128/116/176 (caps 160/220/240). H-9: pin first on 3 or more rider draws. Ship as a Try this guardrail action on L3. |
| `UC-02-ladder` NEW | San Jose fleet ladder | How much does each step of 8 San Jose cars buy in the morning peak, and where does it level off? | Three one-change specs on UC-02's scenario name (same riders): SJ 16 to 24, 24 to 32, 32 to 40. Primary: SJ p90 07-09. | Model output (probes, same riders): -743.0, -801.0 and -991.3 s, all IMPROVED with guardrails within. This is the morning peak only; evening effects are much smaller. Ops: extend the ladder until the step falls below the margin, and add bays and lots as guardrails at larger sizes. | four-area probes.mjs P4 (ef9b0f8c, 36d43bbe); verify | WW: "How much does each step of 8 San Jose cars buy in the morning peak, and where does it level off? Sizing needs a curve, not one point."<br>HOW: "Three one-change experiments on the same riders: 16 to 24, 24 to 32 and 32 to 40 San Jose cars. Primary: San Jose wait p90, 07:00 to 09:00, 60 s margin."<br>LEARN: "In probe runs each step lowers morning wait p90 by about 12, 13 and 17 minutes, so no plateau yet at 40. Evening effects are much smaller. Ops check: extend the ladder and add bays and lots as guardrails." | Pass: H-3 (all three lists), dash, H-6, house words, VERDICT_CLAIMS on WW and HOW. Lengths 133/152/204 (caps 160/220/240). H-9: pin first. Ship as a chained Next step after UC-02. |
| `UC-05b` NEW | Respond to a slowdown with the condition fixed | Once a slowdown is known, which lever recovers San Jose's evening service? | UC-05 scenario with x1.6 in both arms. Axis SUP-1.SJ 32 to 40 (variant: nearest depot). | Model output (probes): +8 SJ cars gives -187.2 s (interval -338.8 to -37.0); nearest depot gives -80.3 s (-260.7 to 117.4). Both are INCONCLUSIVE and small against +4,947.5 s from free flow (about +730 s from the map's own evening). Ops: look for levers that act before the slowdown starts, such as pre-positioning (not modeled). | four-area probes.mjs P5 (e678b382, e4660a96); verify uc05-context.mjs | WW: "Once a highway slowdown is known, which lever recovers San Jose's evening service? Test a response, not the condition."<br>HOW: "Slowdown x1.6 set in both arms. One change: San Jose cars 32 to 40. Primary: San Jose wait p90, 17:00 to 20:00, 60 s margin. Same guardrails as UC-05."<br>LEARN: "In a probe run 8 more cars lower wait p90 by about 3 minutes, interval 0.6 to 5.6, against an 82 minute harm from free flow: unresolved. Ops check: levers that act before the slowdown starts." | Pass: H-3 (all three lists), dash, H-6, house words, VERDICT_CLAIMS on WW and HOW. Lengths 118/150/191 (caps 160/220/240). H-9: pin first. Ship as a Try a response action on UC-05. |

### B.8 Operations casebook

Pre-run lines (WW, HOW) are shown before a run and clear VERDICT_CLAIMS. LEARN lines are after-run readings, gated to the case's pinned labels (OD-T1).

Each OPS-01 to OPS-20 LEARN is a slot template (12.8 gate). The words before "Ops check:" are the `CASEBOOK_READINGS` text; for OPS-01 they are §11.3.4's canonical template, verbatim (§11.6 item 6); the "Ops check:" clause is the source for the static ops_takeaway, rewritten to the §11.3.5 form.

**Slot legend** (restated verbatim from §11.3.4, which is canonical; where they differ, §11.3.4 wins):
- `{set}`: the seed set of the matched label (1, 2 or 3).
- `{primary:u}`: the absolute primary mean delta.
- `{gN:u}`: the absolute harm of guardrail N, in declared order.
- `{b.<metric>:u}` and `{c.<metric>:u}`: a stored descriptive's baseline and candidate values.
- Units `u`:
  - `min` shows seconds as minutes to 1 decimal (the minutes half of `valueWithMinutes`, `experiment.js:433`);
  - `s` shows seconds to 1 decimal;
  - `pts` shows a share x100 to 1 decimal;
  - `n` shows a count to 1 decimal.
- A nonzero value never fills as zero (rule 10). A reading shows only after a run that matches a pinned set, so its values are that set's pinned values. Test 5 therefore checks this per set, and a clause whose `min` slot would show 0.0 on any set is written with `s` and a static "s" instead.
- Direction words are static and must hold on all three sets, so the sign lives in the static word and every slot is an absolute value.
- A declared setting that is the same on all three sets, such as an allowance, may stay static text. Test 5 checks it against each set's pinned `max_harm` or margin.
- Filled lengths per set come from `teaching-review/fix-round/readings.mjs`, which fills each template from `test/ops-cases.pins.json` at 790573e with the repo's own `format.number`.

| id | title | What & why | How we simulate | What you learn / ops takeaway | Evidence (short) | Proposed on-page copy (3 short lines) | Copy-rule status |
|---|---|---|---|---|---|---|---|
| `OPS-01` | Evening crunch: more cars in San Francisco | Evening shortage in San Francisco: do 12 more cars help riders, and what do they add to the overnight depot wave? | SUP-1.SF 40 to 52 all run (6 more homed at each SF depot). Primary: SF p90 D1 16-19, margin 60 s. Guardrails: SF-2 bay wait (1,800 s) and SF p90 D2 07-09 (120 s). | Model output, set 1: IMPROVED, HOLD. 4,172.1 to 2,606.5 s (-1,565.6, interval -1,922.4 to -1,149.4). SF-2 bay wait +2,364.4 s REGRESSED; next morning -832.1 s WITHIN; SF-2 lot 76% to 95%. Sets 2/3 agree, and it is HOLD on four other demand draws. Ops: size the overnight depot wave before adding peak cars, and set the overnight allowance explicitly. | pins 089edeff; casebook-1 verify-pins.mjs; live browser run; verify pins3.mjs | WW: "Evening peak in San Francisco: few free cars, long waits. Would 12 more cars help riders, and what do they add to the overnight depot wave?"<br>HOW: "Only the SF fleet changes, 40 to 52 cars all day. Same riders and 20 paired seeds in both runs. Extra cars sleep at SF-1 and SF-2 stalls. Staff and charging for them are not modeled."<br>LEARN: "Seed set {set}: SF evening wait p90 fell {primary:min} min while SF-2 bay wait p90 rose {g1:min} min, past its 30 min allowance, so the call is HOLD. SF wait p90 the next morning also fell {g2:min} min, inside its allowance. Ops check: the overnight depot wave." | Pass: H-3 (all three lists), dash, H-6, house words, VERDICT_CLAIMS on WW and HOW. Lengths 139/182 (caps 160/220); LEARN is a slot template of 261 characters, filled 240/240/240 on sets 1/2/3 (cap 240); the reading alone fills to 203 on each set, as §11.3.4 records. The reading is §11.3.4's canonical OPS-01 template, verbatim (§11.6 item 6); the earlier "the next morning gains too" could read as a longer wait and is withdrawn, and the ops clause is shortened to fit. H-9: after run only, gated to the three pinned labels (set 1 089edeff); slots filled from the reader's verdict; static clauses hold on sets 1 to 3, and the static 30 min allowance equals the pinned `max_harm` of 1,800 s on each set. All clauses are pinned. |
| `OPS-02` | Late night recall: 00:30 or 02:00 | Would a 02:00 recall instead of 00:30 serve late-night SF riders faster without harming the night queue or the morning? | POL-3 00:30 to 02:00; the release stays at 05:45. Primary: SF p50 D2 00:30-02:00, margin 60 s. Guardrails: SF morning p90 and SF-2 bay wait. | Model output: IMPROVED, ADVANCE. -357.9 s (interval -429.2 to -292.2). About 22 SF requests fall in the window, with 0 unserved in either arm. SF-2 bay wait +859.3 s (set 1), WITHIN. With a 06:00-07:00 readiness guardrail added it reads HOLD on all three sets (OPS-02b). Ops: agree the guardrail set, including morning readiness, before judging a recall change. | pins 5e6da8a7; casebook-1 probe.mjs, probe-ops02-sets.mjs; verify | WW: "Riders still request after midnight. Would recalling cars at 02:00 instead of 00:30 serve them faster, and does the later depot wave spill into the morning?"<br>HOW: "Only the recall time moves, 00:30 to 02:00 on day 2; the 05:45 release stays. Same riders and 20 paired seeds. No closing time surge, night crew hours or charging windows."<br>LEARN: "Seed set {set}: a 02:00 recall gives late night SF riders pickups {primary:min} min faster (p50); SF-2 bay wait p90 rises {g2:min} min, inside its 30 min limit. Ops check: rerun with a 06:00 fleet readiness guardrail." | Pass: H-3 (all three lists), dash, H-6, house words, VERDICT_CLAIMS on WW and HOW. Lengths 156/171 (caps 160/220); LEARN is a slot template of 217 characters, filled 199/199/199 on sets 1/2/3 (cap 240). H-9: after run only, gated to the three pinned labels (set 1 5e6da8a7); slots filled from the reader's verdict; static clauses hold on sets 1 to 3. The about-22-riders clause was a probe and is dropped; the SF-2 rise fills per set (14.3, 22.0 and 21.5 min). |
| `OPS-03` | Defer depot visits through the evening peak | Would visiting depots every 15 trips instead of 10 serve more SF riders in the evening peak? | DEP-7 10 to 15 all day (the model cannot defer only in the peak). Primary: SF unserved share D1 16-19, margin 1 point. Three guardrails. | Model output: IMPROVED, ADVANCE. -3.23 points (interval -4.24 to -2.22); SF-2 bay wait +801 s, WITHIN. About half that rise is composition (daytime visits fall from 15.7 to 3.3). HOLD on 3 of 4 other demand draws, from the SF-2 guardrail. Ops: read depot waits by window, track cabin condition, and rerun on other demand before a next test. | pins bea8dbfd; casebook-1 probe-visits.mjs; verify draws.mjs | WW: "Depot visits every 10 trips take SF cars off the street in the evening peak. Would visiting every 15 trips serve more riders, and what happens at the depots?"<br>HOW: "Only the cleaning cadence changes, 10 to 15 trips, for every car at every hour; the model cannot defer only in the peak. Same riders and 20 paired seeds. Cabin condition is not modeled."<br>LEARN: "Seed set {set}: every 15 trips serves {primary:pts} more of every 100 SF evening requests, and SF-2 bay wait p90 rises {g2:min} min, inside its 30 min limit for this set of riders. Ops check: read depot waits by window and track cabin condition." | Pass: H-3 (all three lists), dash, H-6, house words, VERDICT_CLAIMS on WW and HOW. Lengths 157/185 (caps 160/220); LEARN is a slot template of 245 characters, filled 227/227/226 on sets 1/2/3 (cap 240). H-9: after run only, gated to the three pinned labels (set 1 bea8dbfd); slots filled from the reader's verdict; static clauses hold on sets 1 to 3. The composition clause is left out of the copy; the draw caveat goes in the limits. |
| `OPS-04` | Release cars to home areas earlier | Would releasing Peninsula cars at 05:00 instead of 05:45 help San Francisco in the morning peak? | POL-4 05:45 to 05:00; the recall stays at 00:30. Primary: SF p90 D2 07-09, margin 30 s. Guardrails: PEN p90 and congested empty driving. | Model output: INCONCLUSIVE, RUN_MORE_EXPERIMENTS. +63.7 s (interval +22.6 to +118.1); sets 2/3 give +39.3 and +50.8, each interval above zero but straddling +30 s. Free SF cars in 06:00-07:00 go from about 30 to 27 of 120 (probe). On other demand draws the direction ranges from below zero to REGRESSED. Ops: map where ready cars wait before moving a release, and test releasing toward demand (not modeled). | pins 4134c2a4; casebook-1 probe.mjs; verify draws.mjs | WW: "Peninsula cars sleep at SF depots and go home at 05:45. Would releasing them at 05:00 put San Francisco in better shape for the morning peak?"<br>HOW: "Only the release time moves, 05:45 to 05:00 on day 2; the recall stays at 00:30. Same riders and 20 paired seeds. The release sends cars to a home area, not to where requests start."<br>LEARN: "Seed set {set}: with a 05:00 release, SF morning wait p90 rises {primary:s} s for this set of riders; its interval sits above zero but straddles the 30 s margin. An earlier release is not earlier readiness here. Ops check: see where ready cars wait." | Pass: H-3 (all three lists), dash, H-6, house words, VERDICT_CLAIMS on WW and HOW. Lengths 141/181 (caps 160/220); LEARN is a slot template of 249 characters, filled 238/238/238 on sets 1/2/3 (cap 240). H-9: after run only, gated to the three pinned labels (set 1 4134c2a4); slots filled from the reader's verdict; static clauses hold on sets 1 to 3. The ready-cars-leave clause was a probe and is dropped. The direction does not generalize across demand draws, so the template says "for this set of riders". |
| `OPS-05` | Launch fleet size with a 12 stall depot | Would 18 launch cars instead of 12 serve East Bay riders better on the second morning, and can the small depot take them? | SUP-1.EB 12 to 18; EB-1 has 12 stalls, 1 cleaning bay and 1 service bay. Primary: EB p90 D2 07-09. Guardrails: EB unserved, EB-1 diversions (max 2 cars) and EB-1 bay wait (1,800 s). | Model output: IMPROVED, HOLD. -412.5 s (interval -641.4 to -171.4). Diversions +4.25 and bay wait +4,795.3 s, both REGRESSED; EB-1 lot 97% to 100%. Sets 2/3 agree, and it is HOLD on other draws. Ops: plan launch fleet and launch depot capacity as one decision. | pins bfaabbfa; casebook-1 verify-pins.mjs; verify | WW: "A new East Bay launch opens with 12 cars and a small depot. Would 18 cars serve riders better on the second morning, and can the depot take them?"<br>HOW: "Only the East Bay fleet changes, 12 to 18 cars. The depot stays at 12 stalls, 1 cleaning bay, 1 service bay. Same riders and 20 paired seeds. No staged delivery or demand ramp."<br>LEARN: "Seed set {set}: 6 more cars shorten East Bay morning wait p90 by {primary:min} min, but the 12 stall, one bay depot turns away {g2:n} cars a run and its bay wait p90 rises {g3:min} min. Ops check: size the launch depot with the fleet." | Pass: H-3 (all three lists), dash, H-6, house words, VERDICT_CLAIMS on WW and HOW. Lengths 145/176 (caps 160/220); LEARN is a slot template of 234 characters, filled 213/214/213 on sets 1/2/3 (cap 240). H-9: after run only, gated to the three pinned labels (set 1 bfaabbfa); slots filled from the reader's verdict; static clauses hold on sets 1 to 3. Fix: the design doc :655 prints the max harm as 0.000002; it is 2 cars. |
| `OPS-06` | Launch demand above plan | If launch demand arrives 50% above plan, what happens to East Bay riders and to the area next door? A stress test. | DEM-1.EB 30 to 45 (day 1 peaks and the day 2 morning); 12 cars; nearest idle dispatch across areas. Primary: EB p90 D1 07-09. Guardrails: EB and SF unserved. | Model output: REGRESSED, HOLD. +951.0 s (interval +748.3 to +1,182.3); EB unserved +4.8 and SF unserved +3.1 points, both REGRESSED. SF-home cars serving East Bay riders in the D1 morning rise from 24.65 to 33.20 (probe). Ops: stress-test a launch plan at 1.5x demand with the neighbouring area guarded. | pins c35d4d31; casebook-1 probe.mjs; verify mech.mjs | WW: "Launch demand arrives 50 percent above plan on a 12 car fleet. What happens to East Bay riders, and to the area next door?"<br>HOW: "Only East Bay peak demand changes, 30 to 45 requests an hour; fleet and depot stay small. Same seeds. Dispatch sends the nearest idle car, so cars cross area lines. A stress test, not a decision."<br>LEARN: "Seed set {set}: at 45 requests an hour East Bay morning wait p90 rises {primary:min} min, and San Francisco leaves {g2:pts} more of every 100 riders unserved, past its 1 point limit. Ops check: put a guardrail on the neighbouring area in any launch plan." | Pass: H-3 (all three lists), dash, H-6, house words, VERDICT_CLAIMS on WW and HOW. Lengths 122/195 (caps 160/220); LEARN is a slot template of 254 characters, filled 236/236/236 on sets 1/2/3 (cap 240). H-9: after run only, gated to the three pinned labels (set 1 c35d4d31); slots filled from the reader's verdict; static clauses hold on sets 1 to 3. The dispatch-borrows clause was a probe (mech.mjs) and is dropped. |
| `OPS-07` | One cleaning bay or three at the launch depot | Would 3 cleaning bays instead of 1 at the launch depot put more East Bay cars on the road for the second morning? | DEP-3.EB-1 1 to 3. Primary: EB p90 D2 07-09. Guardrails: EB-1 bay wait (600 s), EB availability 06:00-09:00, EB unserved. | Model output: INCONCLUSIVE, RUN_MORE_EXPERIMENTS. +146.5 s (interval -19.5 to +321.8); the point estimate is worse on all three sets. EB-1 bay wait harm -3,767.2 s. Probe: the last queued car starts at D2 03:30 with 1 bay and 01:24 with 3; no first task starts after 05:45 in either arm. Ops: check when a queue happens relative to the release and the peak, and where ready cars go. | pins 33571abe; casebook-1 probe-visits.mjs; verify (corrected times) | WW: "After the recall, launch cars queue into the night for one cleaning bay. Would 3 bays put more East Bay cars on the road for the second morning?"<br>HOW: "Only the launch depot bays change, 1 to 3; stalls, fleet and demand stay. Same riders and 20 paired seeds. Staff, opening hours and charging are not modeled."<br>LEARN: "Seed set {set}: 3 bays cut EB-1 bay wait p90 by {g1:min} min, yet East Bay morning wait shows no clear benefit: its interval crosses the margin. Ops check: ask when a queue happens and where ready cars go." | Pass: H-3 (all three lists), dash, H-6, house words, VERDICT_CLAIMS on WW and HOW. Lengths 144/157 (caps 160/220); LEARN is a slot template of 205 characters, filled 197/197/197 on sets 1/2/3 (cap 240). H-9: after run only, gated to the three pinned labels (set 1 33571abe); slots filled from the reader's verdict; static clauses hold on sets 1 to 3. The queue-clears clause was a probe and is dropped. |
| `OPS-08` | Launch lot overflow: nearest depot with a free stall | With 6 stalls for 12 launch cars, would sending cars to the nearest depot with a free stall help East Bay riders? | Depot rule from home to nearest with a free stall, for the whole fleet; the SF-1/SF-2 tie goes to SF-1. Primary: EB p90 D2 07-09. Guardrails: congested empty driving, SF-1 lot and SF-1 bay wait. | Model output: INCONCLUSIVE, HOLD. +71.9 s (interval -123.7 to +257.2). SF-1 lot +46 points and bay wait +8,268.1 s, both REGRESSED; diversions 5.25 to 0.15; SF-2 lot 66.5% to 0. The primary reads REGRESSED on 3 of 4 other draws. Ops: scope a depot rule to the area it fixes, and guard every depot that could receive overflow. | pins f6c229cb; casebook-1 verify-pins.mjs; verify draws.mjs | WW: "The launch lot has 6 stalls for 12 cars, so cars get turned away. Would sending every car to the nearest depot with a free stall help East Bay riders?"<br>HOW: "Only the depot rule changes, home depot to nearest free stall, for the whole fleet. SF-1 and SF-2 are equally near, so ties go to SF-1. Same riders and 20 paired seeds."<br>LEARN: "Seed set {set}: turn-aways fall from {b.depot.diversions:n} to {c.depot.diversions:n} a run, but SF-1 takes the San Francisco night wave: its bay wait p90 rises {g3:min} min, while East Bay riders see no clear change. Ops check: scope the rule." | Pass: H-3 (all three lists), dash, H-6, house words, VERDICT_CLAIMS on WW and HOW. Lengths 150/168 (caps 160/220); LEARN is a slot template of 244 characters, filled 199/199/199 on sets 1/2/3 (cap 240). H-9: after run only, gated to the three pinned labels (set 1 f6c229cb); slots filled from the reader's verdict; static clauses hold on sets 1 to 3. The turn-away slots read the stored depot.diversions descriptive: extend assertPinned to check it. |
| `OPS-09` | Rain: slower curbside pickups in San Francisco | Does a slower rainy-day curb change the SF evening peak, and where else does it show up? | Rain world; RD-2.SF 360 to 540 s all day. Primary: SF p90 D1 16-19. Guardrails: whole-run unserved (1 point) and SF evening unserved. | Model output: INCONCLUSIVE, HOLD. -126.7 s (interval -398.7 to +138.6); whole-run unserved +1.16 points, REGRESSED. Probe: SF morning unserved 3.4 to 13.05; SJ 40.2 to 47.85; PEN 27.95 to 32.6. Ops: measure a suspected mechanism by hour and by area, and keep a whole-run guardrail. | pins 70a21ebe; casebook-1 probe.mjs; verify | WW: "Rain slows roads and wet curbs slow pickups. Does a slower San Francisco curb change the evening peak, and where else does it show up?"<br>HOW: "In a rain world (slower roads 13:00 to 23:00, more SF requests all day), only SF pickup and short trip time changes, 6 to 9 min, all day. Same riders and 20 paired seeds."<br>LEARN: "Seed set {set}: 9 min pickups leave the SF evening wait tail with no clear change, but whole run unserved rises {g1:pts} points, past its 1 point limit. Ops check: keep a whole run guardrail." | Pass: H-3 (all three lists), dash, H-6, house words, VERDICT_CLAIMS on WW and HOW. Lengths 134/170 (caps 160/220); LEARN is a slot template of 191 characters, filled 182/182/182 on sets 1/2/3 (cap 240). H-9: after run only, gated to the three pinned labels (set 1 70a21ebe); slots filled from the reader's verdict; static clauses hold on sets 1 to 3. The area and hour clause was a probe and is dropped. |
| `OPS-10` | Rain: more cars for San Francisco | On a rainy day, would 8 extra SF cars serve more riders, and what do they ask of the depots overnight? | Rain world; SUP-1.SF 40 to 48. Primary: whole-run unserved share, margin 0.5 point. Guardrails: availability 06:00-07:00, SF-2 blocked time (max 0), empty share. | Model output: IMPROVED, ADVANCE. Unserved 12.20% to 9.22% (-2.99, interval -3.23 to -2.69); every guardrail within; served +61.85. Dry twin (OPS-10b, exploratory): +29.45 served; the demand lift alone gives +56.6. Ops: split rain into demand and road speed before sizing weather-contingent cars. | pins 22831304; casebook-1 probe.mjs, probe-variants.mjs; verify | WW: "On a rainy day with more San Francisco requests, would 8 extra SF cars serve more riders, and what do they ask of the depots overnight?"<br>HOW: "In a rain world (slower roads, 2 min longer pickups, about 25 percent more SF requests all day), only the SF fleet changes, 40 to 48 cars. Same riders and 20 paired seeds."<br>LEARN: "Seed set {set}: 8 more cars lower whole run unserved by {primary:pts} points, with every guardrail inside its limit: 06:00 to 07:00 availability, SF-2 stall blocking and empty driving. Ops check: split rain into demand and road speed before sizing." | Pass: H-3 (all three lists), dash, H-6, house words, VERDICT_CLAIMS on WW and HOW. Lengths 135/171 (caps 160/220); LEARN is a slot template of 248 characters, filled 234/234/234 on sets 1/2/3 (cap 240). H-9: after run only, gated to the three pinned labels (set 1 22831304); slots filled from the reader's verdict; static clauses hold on sets 1 to 3. The copy uses pinned clauses only; the dry-day comparison waits for OPS-10b to be pinned. Fix: the situation asks a question the run cannot answer (ops-cases.js:828). |
| `OPS-11` | Rain: wet interiors and 30 minute cleans | Does a 30-min rainy-day clean reach riders the next morning, or stay inside the depot? | Rain world; DEP-4 20 to 30 min at every depot. Primary: SF p90 D2 07-09. Guardrails: whole-run unserved, availability 06:00-07:00, SF-2 bay wait (900 s). | Model output, sets 1-3: INCONCLUSIVE, HOLD. -1.3 s (interval -328.1 to +320.8), then +173.4 and -3.9. SF-2 bay wait harm 5,613.8/6,333.3/5,248.4 s and availability harm 0.030/0.040/0.030, both REGRESSED. About 53% of depot visits arrive in the recall window. Ops: watch the overnight queue and early readiness when clean time grows. | pins c23a8ba8; casebook-2 rerun.mjs, sets23.mjs; verify verify30.mjs, mech.mjs | WW: "Rain makes each depot clean take 30 minutes, not 20. Does the longer clean reach riders the next morning, or stay inside the depot?"<br>HOW: "Rain world: slower roads and pickups, more SF requests. One change: clean time 20 to 30 min at every depot. Primary: SF p90 wait, day 2 07:00 to 09:00. Guardrails include available share, 06:00 to 07:00."<br>LEARN: "On 3 seed sets: no clear shift in SF morning wait, while SF-2 bay wait and the 06:00 to 07:00 available share pass their limits. Ops check: when clean time grows, watch the overnight queue and early readiness first." | Pass: H-3 (all three lists), dash, H-6, house words, VERDICT_CLAIMS on WW and HOW. Lengths 131/203 (caps 160/220); LEARN is a slot template of 215 characters, filled 215/215/215 on sets 1/2/3 (cap 240). H-9: after run only, gated to the three pinned labels (set 1 c23a8ba8); slots filled from the reader's verdict; static clauses hold on sets 1 to 3. No slots: every clause is static and pinned on 3 sets. |
| `OPS-12` | Rain: add bays where the queue reaches riders | Is the longest queue (SF-2) where 2 more bays reach SF riders, or would the same bays do more elsewhere? | Rain world plus 30-min cleans; DEP-3.SJ-1 3 to 5. Primary: SF p90 D2 07-09. Guardrails: whole-run unserved, empty share, SJ p90. | Model output: IMPROVED, ADVANCE. -550.8 s (interval -777.1 to -311.2), then -436.1 and -392.2; every guardrail within. The same bays at SF-2 read INCONCLUSIVE on 3 sets (OPS-12-contrast, exploratory). Ops: rank bay sites by their rider effect on the same demand. | pins 1505ff49; casebook-2 explore3.mjs; verify explore-verify.mjs | WW: "SF-2 has the longest rain-night queue. Is it where 2 more cleaning bays reach SF riders, or would the same bays at another depot do more?"<br>HOW: "Rain world with 30 min cleans at every depot. One change: SJ-1 cleaning bays 3 to 5, while SF-2 keeps the longest queue. Primary: SF p90 wait, day 2 07:00 to 09:00."<br>LEARN: "Seed set {set}: 2 more bays at SJ-1 lower SF morning p90 wait by {primary:min} min, with every guardrail inside its limit. Ops check: rank bay sites by their effect on riders, not by queue length." | Pass: H-3 (all three lists), dash, H-6, house words, VERDICT_CLAIMS on WW and HOW. Lengths 137/164 (caps 160/220); LEARN is a slot template of 196 characters, filled 182/182/182 on sets 1/2/3 (cap 240). H-9: after run only, gated to the three pinned labels (set 1 1505ff49); slots filled from the reader's verdict; static clauses hold on sets 1 to 3. The SF-2 contrast stays off the page until OPS-12-contrast is pinned. |
| `OPS-13` | Crowded curbs slow every downtown pickup | Which rider waits feel a 10-min instead of 6-min in-area pickup and trip time downtown? | RD-2.SF 360 to 600 s all run; it applies only to legs that start and end in SF. Primary: SF p90 D1 07-09. Guardrails: SF unserved and SF evening p90 (120 s). | Model output: REGRESSED, HOLD. +1,037.5 s (interval +897.8 to +1,166.3); sets 2/3 give +1,071.2 and +1,030.7. The evening p90 moves +37.6/+26.8/+106.1 s, WITHIN. About 74% of evening SF pickups are by cars from other areas (probe). Ops: aim curb fixes at the windows with many in-area trips. | pins 83a51e1f; casebook-2 rerun.mjs; verify pickups.mjs | WW: "Crowded downtown curbs slow every SF pickup by a car already in SF. Which rider waits feel a 10 minute in-area trip and pickup time instead of 6?"<br>HOW: "One change: SF in-area trip and pickup time 6 to 10 min, all run. Legs between areas skip it. Primary: SF p90 wait, day 1 07:00 to 09:00. Guardrails: SF unserved share, SF evening wait."<br>LEARN: "Seed set {set}: SF morning p90 wait {primary:min} min higher; the evening wait stays inside its 2 min limit. Ops check: aim curb fixes at in-area peaks." | Pass: H-3 (all three lists), dash, H-6, house words, VERDICT_CLAIMS on WW and HOW. Lengths 145/185 (caps 160/220); LEARN is a slot template of 152 characters, filled 139/139/139 on sets 1/2/3 (cap 240). H-9: after run only, gated to the three pinned labels (set 1 83a51e1f); slots filled from the reader's verdict; static clauses hold on sets 1 to 3. The skip-the-curb clause (a code rule plus a probe) is dropped; the HOW already says legs between areas skip it. |
| `OPS-14` | An event lets out in San Francisco | When a stadium event lets out in SF, do East Bay riders, who share the same cars, feel it? | DEM-1.SF 60 to 90 (day 1 peaks and the day 2 morning). Primary: EB unserved share D1 16-19. Guardrails: EB p90 and SF unserved. | Model output: REGRESSED, HOLD. EB unserved +14.5 points (interval +12.1 to +17.0), then +14.2 and +16.6; EB p90 WITHIN; SF unserved +15 to +16 points, REGRESSED. Probe: SF riders served +34 and EB -13.5. Ops: on event nights, guard each neighbour's unserved share, not only its wait tail. | pins cec780af; casebook-2 explore2.mjs; verify | WW: "A stadium event lets out in SF. Do riders in the East Bay, which shares the same cars, feel the SF surge?"<br>HOW: "One change: SF peak requests 60 to 90 per hour, day 1 peaks and day 2 morning. The nearest idle car serves any area. Primary: East Bay unserved share, day 1 16:00 to 19:00. Guardrails: EB wait, SF unserved."<br>LEARN: "Seed set {set}: East Bay leaves {primary:pts} more of every 100 evening requests unserved, while its p90 wait stays inside its 2 min limit. A rider with no car in 10 min leaves and is not in the wait. Ops check: watch the neighbour's unserved share." | Pass: H-3 (all three lists), dash, H-6, house words, VERDICT_CLAIMS on WW and HOW. Lengths 105/206 (caps 160/220); LEARN is a slot template of 249 characters, filled 236/236/236 on sets 1/2/3 (cap 240). H-9: after run only, gated to the three pinned labels (set 1 cec780af); slots filled from the reader's verdict; static clauses hold on sets 1 to 3. Fix: the repo proxy says both days (ops-cases.js:1307); the run ends at D2 10:00. |
| `OPS-15` | The neighbour adds cars for an event next door | Do 8 cars added to protect East Bay riders on an SF event night stay in the East Bay? | Event world; SUP-1.EB 24 to 32, all homed at EB-1. Primary: EB unserved D1 16-19. Guardrails: EB-1 bay wait, EB-1 lot, SF unserved. | Model output: IMPROVED, HOLD. EB unserved -5.3 points (interval -7.2 to -3.4); EB-1 bay wait +2,877 s and lot +13.8 points, both REGRESSED. Probe: only about 30% of the extra EB-car pickups are East Bay riders, and 2 to 2.6 SF riders are served per EB rider. Ops: count where added cars pick up, and whether their depot can take them overnight. | pins f06dffe7; casebook-2 explore2.mjs; verify pickups.mjs | WW: "On an SF event night the East Bay lead adds 8 cars to protect East Bay riders. Do the added cars stay in the East Bay?"<br>HOW: "Event world: SF at 90 peak requests per hour. One change: East Bay cars 24 to 32, all homed at EB-1. Nearest idle dispatch can send any car anywhere. Primary: East Bay evening unserved share."<br>LEARN: "Seed set {set}: East Bay evening unserved falls {primary:pts} points and SF unserved falls too, while EB-1 bay wait and lot peak pass their limits. Ops check: count where the added cars pick up, and whether their home depot can take them overnight." | Pass: H-3 (all three lists), dash, H-6, house words, VERDICT_CLAIMS on WW and HOW. Lengths 118/191 (caps 160/220); LEARN is a slot template of 248 characters, filled 234/234/234 on sets 1/2/3 (cap 240). H-9: after run only, gated to the three pinned labels (set 1 f06dffe7); slots filled from the reader's verdict; static clauses hold on sets 1 to 3. The pickup-split clause stays off the page until pinned. Fix: the situation opens with The OPS-14 world. |
| `OPS-16` | Streets full of people in the evening peak | When crowds slow driving inside every area, does it show in wait times or in unserved riders? | RD-3 in-area evening 1.3 to 2.0 (day 1 16-19 only; all areas and depot entries). Primary: map-wide unserved D1 17-20. Three guardrails. | Model output: REGRESSED, HOLD. +5.8 points (interval +4.6 to +6.9), then +5.35 and +5.8. Loaded congestion and whole-run unserved REGRESSED; SF p90 -7.6/-105.6/+199.6 s (REGRESSED on set 3 only). Ops: track unserved share by area and rider time in slow traffic. | pins 607e34c7; casebook-2 rerun.mjs, sets23.mjs; verify | WW: "Evening crowds and a street festival slow driving inside every area. Does that show up in wait times, or in riders left unserved?"<br>HOW: "One change: in-area traffic x1.3 to x2.0, day 1 16:00 to 19:00, in all four areas and on depot entries at once. Primary: map-wide unserved share, day 1 17:00 to 20:00."<br>LEARN: "Seed set {set}: {primary:pts} more of every 100 riders unserved map-wide in the evening, and more rider time in slow traffic; SF p90 wait shows no steady direction across the 3 seed sets. Ops check: track unserved share by area." | Pass: H-3 (all three lists), dash, H-6, house words, VERDICT_CLAIMS on WW and HOW. Lengths 129/167 (caps 160/220); LEARN is a slot template of 228 characters, filled 214/214/214 on sets 1/2/3 (cap 240). H-9: after run only, gated to the three pinned labels (set 1 607e34c7); slots filled from the reader's verdict; static clauses hold on sets 1 to 3. The SF p90 guardrail regresses on set 3 only, so the template states no direction for it. |
| `OPS-17` | Highway closure between SF and the Peninsula | When a police closure shuts H1, how much do Peninsula riders feel it, and where do their cars sleep? | RD-1.H1 1,500 to 5,400 s all run, so all SF-PEN legs use L1; Peninsula cars rehome to SJ-1. Primary: PEN p90 D1 07-09. Three guardrails. | Model output: REGRESSED, HOLD. +709.8 s (interval +298.7 to +1,170.2), then +943.7 and +915.1. PEN unserved and SJ-1 diversions (about 10 per run) REGRESSED; SJ-1 lot 80% to 100%. The evening rise is smaller (probe, +303 to +456 s). Ops: pre-stage cars in the cut-off area (not modeled), and check the backup depot's stalls and bays. | pins 1b429508; casebook-2 explore3.mjs; verify mech.mjs | WW: "A police closure shuts highway H1 between SF and the Peninsula. How much do Peninsula riders feel it in the morning, when their cars have gone to SF?"<br>HOW: "One change: H1 from 25 to 90 min, so every SF to Peninsula leg uses local route L1. Depot homes follow route times, so Peninsula cars move to SJ-1. Primary: Peninsula p90 wait, day 1 07:00 to 09:00."<br>LEARN: "Seed set {set}: Peninsula morning p90 wait {primary:min} min higher, and SJ-1, where Peninsula cars now sleep, turns {g3:n} cars away per run. Ops check: staging cars in the cut-off area (not modeled here) and the backup depot." | Pass: H-3 (all three lists), dash, H-6, house words, VERDICT_CLAIMS on WW and HOW. Lengths 149/198 (caps 160/220); LEARN is a slot template of 227 characters, filled 211/212/212 on sets 1/2/3 (cap 240). H-9: after run only, gated to the three pinned labels (set 1 1b429508); slots filled from the reader's verdict; static clauses hold on sets 1 to 3. The evening clause stays off the page until pinned. The ops clause names staging as not modeled here. |
| `OPS-18` | Cars held at incident scenes in San Francisco | When 6 of SF's 40 cars are held at scenes all run, do riders feel it the same morning or the next? | SUP-1.SF 40 to 34 all run. Primary: SF p90 D2 07-09. Guardrails: SF unserved and PEN p90 (300 s). | Model output: REGRESSED, HOLD. +860.6 s (interval +620.8 to +1,098.6), then +806.7 and +692.0. PEN wait REGRESSED on sets 1 and 3 and WITHIN on set 2; SF unserved REGRESSED on set 3 only. The day 1 morning is UNCHANGED (probe, +0.8 s). Ops: plan backfill for the next morning's peak, and watch the neighbour's next morning too. | pins a940e907; casebook-2 explore3.mjs; verify | WW: "Police activity keeps 6 of SF's 40 cars at scenes for the whole run. When do SF riders feel it: the same morning or the next?"<br>HOW: "One change: SF fleet 40 to 34 cars, whole run. Day 1 starts with every car idle at home; day 2 starts where the recall and depot queues left the fleet. Primary: SF p90 wait, day 2 07:00 to 09:00."<br>LEARN: "Seed set {set}: SF p90 wait on the day 2 morning is {primary:min} min higher. Ops check: plan backfill for the next morning peak, not only the same day, and watch the neighbour's next morning too." | Pass: H-3 (all three lists), dash, H-6, house words, VERDICT_CLAIMS on WW and HOW. Lengths 125/195 (caps 160/220); LEARN is a slot template of 196 characters, filled 183/183/183 on sets 1/2/3 (cap 240). H-9: after run only, gated to the three pinned labels (set 1 a940e907); slots filled from the reader's verdict; static clauses hold on sets 1 to 3. The day 1 clause stays off the page until pinned. Disclose the guardrail differences across seed sets. |
| `OPS-19` | A service check every second depot visit | What does a 45-min service every 2nd depot visit instead of every 3rd do to the next morning? | DEP-8 3 to 2 on the existing service bays (SF-1 has 2, the others 1). Primary: SF p90 D2 07-09. Guardrails: SF unserved, availability 06:00-07:00, SF-2 unfinished visits. | Model output: REGRESSED, HOLD. +841.0 s (interval +605.0 to +1,059.5), then +833.3 and +715.7; every guardrail REGRESSED on every set. Cleaning bay wait moves +38.7 s while turnaround p90 goes from 7,371.7 to 13,559.3 s. Probe: a second SF-2 service bay reads INCONCLUSIVE. Ops: name the service-bay queue in a guardrail, and look for the next binding resource. | pins f1a88379; casebook-2 explore3.mjs; verify | WW: "After police activity every car needs a service check more often. What does a 45 min service every 2nd depot visit, not every 3rd, do to the next morning?"<br>HOW: "One change: service every 3rd visit to every 2nd, on the service bays the map has (SF-1 2, SF-2 1, SJ-1 1, EB-1 1). The 00:30 recall sends the fleet through them. Primary: SF p90 wait, day 2 07:00 to 09:00."<br>LEARN: "Seed set {set}: SF morning p90 wait {primary:min} min higher and 06:00 to 07:00 availability {g2:pts} points lower, while cleaning bay wait moves under 1 min. Ops check: name the service bay queue in a guardrail." | Pass: H-3 (all three lists), dash, H-6, house words, VERDICT_CLAIMS on WW and HOW. Lengths 154/206 (caps 160/220); LEARN is a slot template of 212 characters, filled 195/195/195 on sets 1/2/3 (cap 240). H-9: after run only, gated to the three pinned labels (set 1 f1a88379); slots filled from the reader's verdict; static clauses hold on sets 1 to 3. The cleaning-bay clause holds on all three sets (+38.7, +15.0 and +24.9 s): extend assertPinned to check the descriptive. |
| `OPS-20` | A staging area on two thirds of the SF-1 lot | When police staging takes 40 of SF-1's 60 stalls, do SF riders feel it next morning, or only the depot gate? | DEP-2.SF-1 60 to 20 under the home-depot rule. A turned-away car drives to the nearest depot with a free stall (all 32 set-1 turn-aways went to SF-2). Primary: SF p90 D2 07-09. Guardrails: diversions (max 0) and empty share. | Model output: UNCHANGED, HOLD. -14.0 s (interval -32.7 to +3.5), then -17.9 and -19.4; diversions 1.6/1.8/1.9, REGRESSED. Probe: the capacity-aware rule cuts turn-aways but raises SF morning p90 by +548 to +735 s. Ops: keep zero-tolerance gate guardrails when lots shrink, and test rule changes fleet-wide. | pins 800a66ff; casebook-2 explore3.mjs; verify mech.mjs | WW: "A police staging area takes 40 of SF-1's 60 stalls all run. Do SF riders feel it next morning, or only the depot gate?"<br>HOW: "One change: SF-1 stalls 60 to 20. Cars still go to their home depot; a car turned away drives to the nearest depot with a free stall. Primary: SF p90 wait, day 2 07:00 to 09:00. Guardrail: turn-aways, max 0."<br>LEARN: "Seed set {set}: SF morning wait stays inside its 1 min band, while {g1:n} cars per run are turned away at SF-1. Only the zero-limit gate guardrail sees it. Ops check: keep a gate guardrail when lots shrink." | Pass: H-3 (all three lists), dash, H-6, house words, VERDICT_CLAIMS on WW and HOW. Lengths 118/207 (caps 160/220); LEARN is a slot template of 206 characters, filled 199/199/199 on sets 1/2/3 (cap 240). H-9: after run only, gated to the three pinned labels (set 1 800a66ff); slots filled from the reader's verdict; static clauses hold on sets 1 to 3. All clauses are pinned. |
| `OPS-02b` NEW | Late recall, guarded for 06:00 readiness | Do the guardrails written before a run decide the call? The same late recall, with a readiness guardrail added. | The OPS-02 spec plus fleet.available_fraction for D2 06:00-07:00, higher is better, max harm 0.02. Same slug and seeds; sets 1-3. | Model output (exploratory): IMPROVED, HOLD on all three sets (facaebdf, 885a636a, e83257d1). Readiness harm 0.031/0.034/0.039 against 0.02. It is HOLD on 3 of 4 other demand draws. Ops: agree the guardrail set, including morning readiness, before evaluating any recall change. | casebook-1 probe-variants.mjs, probe-ops02-sets.mjs; verify variants.mjs | WW: "A later recall keeps cars out for late riders. What changes if the team also guards how many cars are free from 06:00 to 07:00 on day 2?"<br>HOW: "Same case as OPS-02, same slug and 20 paired seeds, plus one guardrail: the fleet available share from 06:00 to 07:00 on day 2 may fall by at most 2 points."<br>LEARN: "The late night gain stays, but the share of the fleet free from 06:00 to 07:00 falls about 3 points, past the 2 point limit, so the recommendation changes. Ops check: the guardrails you write before the run decide the call." | Pass: H-3 (all three lists), dash, H-6, house words, VERDICT_CLAIMS on WW and HOW. Lengths 136/156/223 (caps 160/220/240). Pre-run lines clear VERDICT_CLAIMS. H-9: pin all three labels first. Ship as a Try this guardrail action on OPS-02 (no new id). |
| `OPS-10b` NEW | Rain twin: the same 8 cars on a dry day | Answers OPS-10's own question: do extra cars add more rides in rain than on a dry day? | The OPS-10 spec on the dry Bay map, same slug. SF requests are redrawn at the dry rate; PEN, SJ and EB streams are identical. A separate experiment, read beside OPS-10. | Model output (exploratory): IMPROVED, ADVANCE; unserved -1.55 points; served +29.45 (sets 2/3: +25.3, +25.4), against +61.85 in rain. Decomposition: roads and pickups only +34.3; demand lift only +56.6. Ops: split a weather scenario into demand and speed, and size weather cars to the demand lift. | casebook-1 probe-variants.mjs (09c1214b); verify | WW: "OPS-10 asks whether extra cars add more rides in rain than on a dry day. This twin runs the same 8 cars on the dry teaching map."<br>HOW: "Same slug, 20 paired seeds and 40 to 48 SF cars, on the Bay teaching map with no rain changes, so SF requests are redrawn at the dry rate. Read it beside OPS-10; the two are separate experiments."<br>LEARN: "8 cars serve about 29 more rides on the dry map, against about 62 in the rain world. Runs that split the rain show the demand lift, not the slower roads, adds most of that. Ops check: size weather cars to the demand lift." | Pass: H-3 (all three lists), dash, H-6, house words, VERDICT_CLAIMS on WW and HOW. Lengths 128/195/221 (caps 160/220/240). Pre-run lines clear VERDICT_CLAIMS. H-9: pin first. Ship as a twin run on OPS-10 (no new id). |
| `OPS-12-contrast` NEW | Rain: the same 2 bays at SF-2 | The comparison OPS-12 promises: do 2 bays at the longest queue (SF-2) reach riders the way SJ-1 bays do? | The OPS-12 spec with the axis DEP-3.SF-2 2 to 4; primary, guardrails, slug and seeds unchanged; sets 1-3. | Model output (exploratory): INCONCLUSIVE, RUN_MORE_EXPERIMENTS on all three sets: +45.2 s (interval -237.7 to 361.3), +31.9 and -18.4; every guardrail within. Ops: compare candidate bay sites on the rider metric with the same demand before choosing one. | casebook-2 explore3.mjs (a786e77f, 25f189ea, 7dafe843); verify explore-verify.mjs | WW: "The longest queue is at SF-2. Do 2 more cleaning bays there reach SF riders the way 2 bays at SJ-1 do?"<br>HOW: "Rain world with 30 min cleans at every depot. One change: SF-2 cleaning bays 2 to 4. Primary: SF p90 wait, day 2 07:00 to 09:00, with the same margin, guardrails and demand draws."<br>LEARN: "Exploratory, 3 seed sets: no clear change in SF morning wait (mean shifts +45, +32 and -18 s). Ops check: compare candidate bay sites on the rider metric before choosing one." | Pass: H-3 (all three lists), dash, H-6, house words, VERDICT_CLAIMS on WW and HOW. Lengths 102/179/174 (caps 160/220/240). Pre-run lines clear VERDICT_CLAIMS. H-9: pin first. Ship as a second-arm button on OPS-12 (no new id). |
| `OPS-19-followup` NEW | A second service bay at SF-2 | After OPS-19, does relieving SF-2's single service bay bring the SF morning wait back? | Base DEP-8=2; axis DEP-5.SF-2 1 to 2; primary and guardrails as in OPS-19; sets 1-3. | Model output (exploratory): INCONCLUSIVE, RUN_MORE_EXPERIMENTS: -155.9 s (interval -324.1 to 16.8), -32.2 and -121.1. SF-2 unfinished visits fall by 2.15 to 2.7, and the availability guardrail stays within. Ops: after relieving one depot bottleneck, re-measure and look for the next binding resource. | casebook-2 explore3.mjs (8c00c6f8, e9292dd8, 45028bd5); verify | WW: "With a service every 2nd visit, SF-2 has a single service bay. Does a second service bay there bring the SF morning wait back?"<br>HOW: "Base: a 45 min service every 2nd depot visit. One change: SF-2 service bays 1 to 2. Primary: SF p90 wait, day 2 07:00 to 09:00. Guardrails: SF unserved, 06:00 to 07:00 available share, SF-2 unfinished visits."<br>LEARN: "Exploratory, 3 seed sets: SF-2 unfinished visits fall by 2 or more, yet the SF morning wait gives no clear answer. Ops check: look for the next binding resource after fixing the first." | Pass: H-3 (all three lists), dash, H-6, house words, VERDICT_CLAIMS on WW and HOW. Lengths 126/208/184 (caps 160/220/240). Pre-run lines clear VERDICT_CLAIMS. H-9: pin first. Ship as a Try next action on OPS-19 (no new id). |
| `OPS-20-followup` NEW | A capacity-aware depot rule on the small lot | The obvious gate fix, a rule that sends cars to a depot with a free stall: does it help SF riders? | Base DEP-2.SF-1=20; axis depot rule home to nearest with a free stall, for every car; primary and guardrails as in OPS-20; sets 1-3. | Model output (exploratory): REGRESSED, HOLD: +642.6 s (interval 341.3 to 963.3), +735.4 and +548.1; diversions fall by 1.45 to 1.75. The rule changes every car's depot choice (policies.js assignDepot). Ops: evaluate a depot-rule change on fleet-wide next-morning service, not only at the gate that prompted it. | casebook-2 explore3.mjs (4309124b, 02f5fbf3, 054b63df); verify | WW: "With SF-1 at 20 stalls, cars get turned away at the gate. Does a depot rule that sends cars to a depot with a free stall help SF riders?"<br>HOW: "Base: SF-1 at 20 of its 60 stalls. One change: depot rule from home depot to nearest depot with a free stall, for every car. Primary: SF p90 wait, day 2 07:00 to 09:00."<br>LEARN: "Exploratory, 3 seed sets: turn-aways fall, but SF morning p90 wait is 9 to 12 min higher; the rule changes every car's depot choice, not only SF-1's. Ops check: test a gate fix on next morning service." | Pass: H-3 (all three lists), dash, H-6, house words, VERDICT_CLAIMS on WW and HOW. Lengths 136/168/201 (caps 160/220/240). Pre-run lines clear VERDICT_CLAIMS. H-9: pin first. Ship as a Try next action on OPS-20 (no new id). |

### B.9 Guided walkthrough and framing pages

These pages have no catalog lessons of their own. The walkthrough plays `OPS-01` (B.8). The overview decision cards link `fleet-day` (B.1), `UC-08a` (B.7) and `street-first` (B.6). All framing copy (site header, overview cards, catalog intro, walkthrough intro, approach worked example) is in 12.9 and passes the same checks, including DIRECTION for the walkthrough lines and the static card lines. The walkthrough structure proposals in 12.9 (beat 0, chapter renames and reorder, the last-beat Next test line, the refusal list behind a "What this walkthrough leaves out" disclosure, and a `specSentence` built from `differenceText`) are T2 or OD-T7, not T1: they change `present.test.mjs:151-154`, `:925-930` or `:978`. T1 changes only the walkthrough intro h1 and paragraph. The Next test map lives in §11.3.4 only.

### B.10 N2 event curb lab (planned)

| id | title | What & why | How we simulate | What you learn / ops takeaway | Evidence (short) | Proposed on-page copy (3 short lines) | Copy-rule status |
|---|---|---|---|---|---|---|---|
| `event-curb-staging` NEW | Stage cars for an event crowd at a busy curb | At a busy event curb, does staging cars from published crowd estimates get riders boarded on time, or does it move the wait to background riders, the approach queue, and staging km and kWh? | Planned (no model yet). Two paired runs share every rider, car, estimate tape and seed; only events.policy differs. Curb-first dispatch; a capped approach counts cars driving in; at most one boarding start per berth per minute; staging keeps up to S cars at the hub once the window opens (nearest eligible car, OD-5). On time means boarding began within T min. Seeds: tuning 2501-2512, evaluation 3501-3512. | No N2 result exists. Grounding (not N2): in the rough model (seeds 9101-9112, overlap, patience 12), an idle car existed in every refusal minute. A third berth gave +0.005; approach cap 8 gave +0.041 completion but +0.000 on-time; only zero drive time gave both (+0.041, +0.094). The airport lesson shows timeliness can move (34% to 50%) while completion is UNCHANGED and the result is HOLD. Ops: measure whether cars driving in hold the approach before adding berths or staging, and judge staging on event and background on-time boarding together. | n2-planned grid.mjs, teleport.mjs, toycheck.mjs; verify levers.mjs, airport-energy2.mjs | WW: "At a busy event curb, does staging cars from published crowd estimates help riders board on time, or does it move the wait to other riders and the curb queue?"<br>HOW: "Two runs share riders, cars and seeds. Only the policy changes: respond to requests, or stage up to {S} cars at the hub. At most {A} cars may drive to or queue at the curb, which has {k} berths. One fictional hub."<br>LEARN: "If it advances, test a crowd that never arrives. If it holds, read who paid. If nothing changed, compare the curb room line with the smallest change this test can detect; if the room is smaller, this cell could not show a staging gain." | Pass: H-3 (all three lists), dash, H-6, house words, VERDICT_CLAIMS on WW and HOW. Lengths 158/213/235 (caps 160/220/240). H-9: direction-free before a run (conditional reading guide; passes DIRECTION and the digit rule; the earlier "never shows up" and "below" tripped DIRECTION). After the run, the §11.3.4 "Paired" line (12.10) fills from registered fields only; no N2 numbers before registered evaluation (OD-19). Lengths are counted with the {S}, {A}, {k} placeholders unfilled. |
