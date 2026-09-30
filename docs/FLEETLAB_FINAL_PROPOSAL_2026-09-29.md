# FleetLab — recommended next phase and build plan

**29 September 2026 · Proposal for owner review · No implementation authorization inferred**

This responds to Fable's `FLEETLAB_NEXT_EXPERIMENTS_PROPOSAL_2026-09-29.md` (SHA-256 `1f45905aa56133c7f80f5ad8e2d6d1b170a5feefd0e6e771fd4ab9bfb8b19445`). The audit is review input, not an instruction to execute its experiments. The owner asked for recommendations and plans before building.

Review baseline: `codex/fleetlab-city-sf`, HEAD `7e1da7cb72ca0e08fe46ead83db07adfce0e757e`, with the existing uncommitted City Explorer overlay. Current final viewer release: `7450c2aaf5e5ca90e2f5cbf6cf7d05cf6520f11b1f92267bbdf511c557ce2926`. This review adds this proposal and read-only evidence summaries; it changes no application code, simulation contract, recorded run, release package or live site.

## Recommendation

**Adopt Fable's emphasis on operating conditions, but simplify the first experiment.** Test whether the depot-layout effect changes when total charging power doubles from 200 to 400 kW. Keep ports, fleet, initial energy, requests, sites and map fixed. Run map qualification as a separate workstream. Correct misleading language and establish the experiment protocol before new runs.

The learning question becomes: **“Does spreading the same resources across two depots help differently when charging power is scarce?”** This is concrete for Operations, Fleet Management and Depot Partnerships, and exposes an engineering mechanism a visitor can inspect.

Do not select a new default scenario by searching for an attractive completion rate. Do not introduce operator vehicle parameters, a new city, or a 3D driving engine in this phase. A diagnostic result on the old map remains diagnostic regardless of its statistical interval.

## 1. What I accept, correct and defer in Fable's audit

| Finding or recommendation | Assessment and proposed action |
|---|---|
| Charging queues strongly shape the existing result | **Verified.** Across 12 baseline runs, mean charging-queue time is 225.390 minutes per vehicle; all depot queues total 235.437 minutes of a 480-minute shift. About 65.917 vehicles remain queued at the horizon; completion averages 50.979%. Candidate figures are 223.612, 235.904, 65.833 and 52.090%. Say “nearly half the shift in depot queues,” not “most time waiting for charging.” |
| Low-energy case is mislabeled as a reserve breach | **Verified correction.** Both arms record two `no_reachable_depot` violations. Recorded energy checkpoints remain above the 12 kWh reserve: minima 15.054 and 14.780 kWh. Propose exact violation labels and a dated correction note. Existing records are retained. |
| “60 kWh EV” implies modeled battery capacity | **Verified limitation.** The engine never reads `capacity_kwh`; charging is capped at the 48 kWh target. Present recorded energy, initial energy and charge target; identify 60 kWh as unused descriptive metadata. Do not silently add capacity physics to the old model. |
| Lower demand is generally adverse to two depots | **Too broad.** The recorded lower-demand case is one seed, with a −1.5 percentage-point completion difference. It establishes that case only. Fable's three-seed pilots do not replace a declared evaluation. |
| Cross-leg history affects the old model too | **Verified.** There are 12,724 reversals toward the preceding node among 30,818 comparable nonempty departures after arrival, across the 24 main arms. This measures direction changes, not 12,724 illegal maneuvers. |
| Preserve explicit pool and site identities | **Verified and essential.** Reapplying the current selection rule on v2 retains only 75 of the original 220 nodes and moves both sites. That would confound a map comparison. |
| Four pool nodes are one-way traps | **Partly verified, definition unresolved.** A direct check using the current v1 router finds two original pool nodes unable to reach either depot. Do not certify the audit's broader count of four without its exact test. Show reachability, immobility and affected denominators explicitly; shared inputs do not prove these defects cancel in the treatment effect. |
| Human source review needs a result contract | **Verified.** Current binding deliberately requires `NOT_RUN` and empty results. Introduce a separate versioned review result and derived qualification decision; do not mutate the frozen candidate checklist into a pass. |
| No person has observed the UI / devices all NOT_RUN | **Incorrect as a blanket statement.** The owner has used the site; browser observations and a physical Pixel v2 playback/restart are recorded. The final v3 Pixel sweep, touch/accessibility checks and five-person formative study remain pending. |
| More seeds cannot reach +2 pp | **Overstated.** The current interval is below the practical margin; further repetitions of this same configuration are not the priority. Future estimates are not mathematically fixed by these 12 observations. |
| Existing protocol fully establishes predeclaration | **Needs strengthening.** Inputs/specification were frozen, but decision thresholds live in code rather than the protocol. Record thresholds, analysis version, populations and exclusions before new evaluation. A local commit documents a checkpoint, not independent proof of when knowledge was acquired. |
| Legacy named-product values are invented | **Confirmed in one inspected surface.** `vehicle-profiles.js` explicitly associates illustrative 90 kWh / 150 kW values with Ojai, with disclaimers. Review that presentation separately before a Waymo demonstration; use anonymous parameter profiles for experimental arms. Do not silently change the protected legacy edition. |
| Vehicle classes and maneuver-level work should wait | **Agree.** The gallery remains sourced context. A direction sketch, linear energy sensitivity and a measured vehicle model are different deliverables. |

Read-only calculations are saved in `build/fleetlab-city/validation/proposal-review-20260929/recorded-evidence.json` and `pool-routes.json`. Code inspection covered the engine, input generator, comparator, verifier, package builder, candidate binding, current UI labels and legacy vehicle profiles. No new fleet simulation was executed for this review. Fable's pilot performance/effect numbers remain externally reported hints, not independently reproduced evaluation evidence.

## 2. Three approaches considered

| Approach | Benefit | Cost / limitation | Decision |
|---|---|---|---|
| Fable's baseline-only selection grid, then selected-point evaluation | Can identify an operating point with less queuing | “Nearest” is unspecified; completion-band selection is arbitrary; multiple parameters can change; some grid cells duplicate effective power; substantial follow-on sensitivity scope | Keep as a possible later calibration study, not the first build |
| Fixed power × depot-layout experiment, plus map work | One interpretable mechanism; no outcome-based cell selection; existing engine can execute it | Remains conditional on the frozen, unqualified map and initial state | **Recommended** |
| Finish all map qualification before any new operational experiment | Avoids spending on a map that will change | Source review can block useful learning for an uncertain duration | Required before qualified SF conclusions, but not before a bounded diagnostic power experiment |

## 3. First experiment: power headroom × depot layout

### Fixed design

Use the frozen v1 graph, 220 nodes, site A/B coordinates, 100 initial vehicles, 1,200 requests, eight-hour horizon and 30 kWh initial energy. Keep 8 total ports, 50 kW per-port limit, 4 turnaround slots, the 48 kWh target, reserve/return thresholds and dispatch policy fixed. Preserve inaccessible nodes and report their effect; filtering them would be another intervention.

| Layout | 200 kW condition | 400 kW condition |
|---|---|---|
| A only — reference | A: 8 ports, 200 kW, 4 slots | A: 8 ports, 400 kW, 4 slots |
| A + B — main comparison | Each: 4 ports, 100 kW, 2 slots | Each: 4 ports, 200 kW, 2 slots |
| B only — location control | B: 8 ports, 200 kW, 4 slots | B: 8 ports, 400 kW, 4 slots |

These are six arms per seed. At 400 kW the eight 50 kW ports can use the declared site capacity; this is a **power-headroom test**, not proof that charging stops limiting service. In Fable's proposed grid, 600 kW with eight such ports still delivers at most 400 kW. Also, 25 kW per vehicle describes the existing eight-occupied-port condition, not every charging moment: when fewer ports are occupied the current engine can allocate more, up to 50 kW per port.

### Protocol and sampling

- Propose **24 fresh evaluation seeds**, fixed before evaluation: 144 main arms. This is an exploratory compute budget, not a claim of statistical power. An inconclusive interval is retained; do not extend the sample after seeing it.
- Reserve four separate preflight seeds for null/compatibility/resource-accounting and performance checks. Register generator version, namespace and exact tapes; avoid all previously inspected City seed blocks. Numeric non-overlap with unrelated legacy generators alone is not proof of statistical independence.
- Generate one immutable demand/initial-state tape per seed and reuse its exact digest in all six arms. Only depot resource specifications differ. Freeze analysis and protocol digests into the new-run context/specification without changing old records.
- Preserve all main arms. A failed or hard-violation arm makes that seed's six-arm block ineligible for the primary complete-block analysis; report it, its cause and incomplete coverage. Never silently drop failures, replace seeds or claim the planned analysis completed. Repair-and-rerun requires a new named study version.
- Reproduce the original 34 arms first in a new directory. Compare scientific run/input/metric digests. Execution timestamps, measured runtime and their enclosing bundle digests are expected to differ; do not require incidental metadata to match.

### Analysis and outcomes

For each seed, compute:

`interaction = [completion(A+B, 400) − completion(A, 400)] − [completion(A+B, 200) − completion(A, 200)]`.

Report percentage points and a 95% paired-t interval across seed-level interactions. Freeze an illustrative practical band of ±1 percentage point for this interaction; it is distinct from the old experiment's +2-point improvement threshold. Preflight must verify the statistic on hand-computable and null fixtures. B-only comparisons are secondary location diagnostics and cannot replace the A reference after results are seen.

Use mutually exclusive descriptive classifications:

1. **Material positive interaction:** interval entirely above +1 point.
2. **Material negative interaction:** interval entirely below −1 point.
3. **Bounded small interaction:** interval wholly within −1 to +1 points, under the declared sampling assumptions.
4. **Unresolved:** all remaining cases.

Report exclusion of zero separately. Fable's proposed “interval excludes zero” and “interval inside ±1” categories can both be true; they must not be competing outcomes. None of these descriptive labels changes map eligibility, verifier results or deployment permission.

Use all created requests for completion/unserved denominators and all initial vehicles for fleet time/energy. Report requests still waiting, assigned or aboard at the fixed horizon separately. Use empty kilometres per created request alongside the existing completion-normalized quantity. Report charge and turnaround queues separately, by site, including terminal queues and available-but-unused site power. Include every zone, including UNASSIGNED, with counts and uncertainty caveats.

Wait among boarded requests and wait among requests served in both arms are **conditional diagnostics**. Both populations depend on treatment; neither substitutes for a fleet-wide customer-welfare estimand. Label metric direction explicitly: higher completion is beneficial, while higher unserved fraction, empty distance or wait is adverse. Retain existing guardrails as separately versioned diagnostics; do not copy Fable's one-sign harm rule across unlike metrics or imply simultaneous 95% protection across many checks.

### Budget and stop rules

The main experiment is 144 arms. Up to 24 preflight arms plus 34 reproduction arms bring the initial ceiling to 202 arms, excluding any separately proposed future sensitivity study. At the audit's rough 32 MB per arm, allow at least 7 GB for raw outputs plus explicit packaging/headroom; measure real disk needs before execution. Engine-only seconds do not include routing preparation, verification, JSON writing, packaging or human review. Benchmark first; do not promise an end-to-end runtime under an hour from Fable's estimate.

Keep the 4 GB measured process-memory limit and 2 GB estimated routing-table limit. Stop the affected work for a scientific reproduction mismatch, incompatible tape, unexpected runtime failure, resource-limit breach, touched evaluation seed, or hard violation. Expected map-incomplete status is distinct from invalid evidence or an execution error. Do not classify every nonzero exit as an acceptable INCOMPLETE result.

Do not append all five historical sensitivities to this first study automatically. Retain and display them as historical single-seed cases. Replication, staggered initial energy and anonymous energy intensity each require their own declared scope and budget.

## 4. Map qualification and stop continuity

This workstream is necessary even if the power experiment is inconclusive.

**Source review.** Prioritize the restriction records driving trunk and living-street failures, including Lombard Street, Maiden Lane and Bridgeview Paseo. Fable's 20-way suggestion is a triage hypothesis, not a promise that those roads can legitimately be restored. The captured candidate has 24 unsupported trunk ways, including 21 named Lombard Street, and two unsupported living-street ways. Keep the complete source ledger and required stratified review; meeting a class percentage does not close district, semantic or mandatory-route gates.

**Review contract.** Define immutable results keyed to pack digest, source feature/relation, reviewer, observation date, source reference, disposition, rationale and affected routes. Validate allowed states, required sample coverage, conflicts, stale-source rejection and result-to-gate derivation. A fresh qualification envelope consumes the unchanged candidate plus review results. A reviewer cannot simply set the pack to PASS.

**District scope recommendation.** Preserve the complete captured road inventory and unresolved gap geometry. Keep cross-Bay/SFO service outside the scenario, as already approved. Retain UNASSIGNED in zone outputs and vetoes for any remaining scenario requests. Use official jurisdiction evidence to define an explicit scenario/service boundary separately from district polygons; do not assign a bridge to the nearest district or reduce coverage denominators after inspecting outcomes. Any boundary/pool revision needs a new version and quantified population changes.

**Continuity contract recommendation.** Carry incoming edge and relevant restriction-prefix history across pickup, drop-off, queue and depot stops. A stop does not automatically erase turn obligations. Permit a history reset only at a specifically modeled and reviewed connector/maneuver boundary, recorded explicitly. If no legal continuation exists, record unroutable/stranded and stop the affected route; being trapped does not establish permission to reverse.

Before production implementation, inspect fixed recorded routes as a compatibility study, without changing dispatch. Distinguish proposed-path rejection, rerouted distance/time and absence of a legal continuation. This is not a fleet counterfactual because altered travel times would change subsequent dispatch and queues.

Implement continuity under a new model/verifier contract, with a restriction spanning a stop, zero-length legs, depot connectors, no/only restrictions and no-route fixtures. Verify the full per-vehicle sequence independently. Historical runs lacking the required state must retain their old verdict and receive a separate compatibility assessment; 12,724 direction reversals are not automatically 12,724 violations of an as-yet-unwritten rule.

Fable reports roughly 9% unroutable boundaries under a blanket reversal ban, yet says a 0.5% unroutable trigger would probably not fire. Those statements cannot justify skipping the next stage without reconciling the policy and denominator. Adopt no such prediction. Continuity correctness is required regardless of a small aggregate time effect.

For a future qualified-map rerun, compare depot layouts **within** each map using identical fixed inputs where compatible. Present map-to-map changes as a separate model/coverage sensitivity. Do not relax the existing comparator's equal-pack check to make incomparable runs pass.

## 5. Product and presentation changes

Keep the existing visual language and guided entry. The next design effort should make reasoning visible:

- **A correction strip in methodology:** dated explanations of the low-energy event label, unused capacity metadata and historical single-seed sensitivities. Derive event labels from recorded violation codes.
- **Experiment cards:** “Depot locations — recorded study” and “Charging power × depot locations — new diagnostic study.” Show question, one changed factor, controls, map/model identity and eligibility. A selector chooses verified recorded results; it does not pretend to launch a run.
- **One result story:** paired outcomes → vehicle-time breakdown → site queues/energy → districts including UNASSIGNED → a vehicle/request trace. Show adverse and inconclusive results without a winner badge.
- **Visible controls and thresholds:** exact units, sample size, practical band and horizon available beside the result; deeper protocol and evidence remain expandable. Use symbols/text as well as color.
- **Vehicle gallery:** retain Ojai/Zoox as dated public design references. Use anonymous names for numerical model arms. Review legacy named-product parameters in a separate proposed patch before a Waymo demo.

Layout labels and depot markers must derive from each recorded site's configuration: the B-only control must never inherit today's hard-coded “one depot A” presentation. Pair/study selection must retain exact identities and reject incompatible data.

Preserve hosting limits during packaging. Export summary results for **all 144 main arms**, but initially include detailed browser replays for all six configurations of the **first evaluation seed**, selected in the protocol before results. Retain the complete raw evidence locally and state exactly which replay records are packaged; never substitute another repeat silently. Naively exporting 100 separate vehicle files plus gzip siblings for all 144 arms would already create 28,800 files before other assets, exceeding the current 20,000-file staging budget. Check the combined current/prior release inventory, 25 MiB asset limit, initial-transfer and per-comparison replay budgets. Expanding hosted replay coverage later requires a reviewed chunking/packaging design, not deletion of experimental evidence.

First-time visitors should be able to explain the controlled change, why stationary vehicles matter, what varies across seeds, which results are conditional, and what the model cannot establish. Observe the current build before revising it, then compare comprehension using an open question first, a written rubric and an independent second scorer. Five participants provide formative findings, not statistical launch approval. Complete the actual v3 Pixel, touch and accessibility checks separately.

## 6. Implementation sequence after approval

| Step | Proposed files / deliverables | Acceptance before proceeding |
|---|---|---|
| 0. Evidence and copy reconciliation | Dated correction note; `web/app.mjs`, `replay.mjs`, gallery/model text; exact source inventory and local checkpoint | Labels match observed codes/metadata; legacy payloads and recorded scientific digests unchanged; source commit or inventory recorded truthfully |
| 1. Freeze the new study | New experiment specification, protocol, seed/tape registry and versioned analysis contract under `apps/fleetlab-city/` | Hand-checkable estimand/outcome/eligibility fixtures; 34-arm scientific reproduction; no evaluation result inspected |
| 2. Preflight, then one evaluation | Small orchestration extension around existing engine/runner plus a separate read-only analysis module; new immutable output directories | Resource and input pairing checks pass; 24 complete seed blocks or an explicit incomplete result; every arm verified; no seed/cell replacement |
| 3. Notebook presentation | Versioned catalogue extension, study selector, resource-time and zone tables, configuration-derived site labels, declared replay subset | Wrong-map/protocol combinations rejected; unavailable/invalid/empty states tested; complete summary coverage; correct B-only markers; stable selection and clear conditional metrics; packaging budgets; responsive and keyboard QA |
| M1. Map/review design alongside steps 0–3 | Prioritized source ledger, district policy proposal, review-result schema, static continuity report | All proposed semantics written and testable; no candidate fleet execution unlocked by a UI change |
| M2. Map/continuity implementation | New routing/runner/verifier contract and immutable qualification envelope | Independent cross-stop fixtures; map class/district/source gates; explicit pool changes; qualified rerun separately authorized in scope |
| 4. Launch review | New versioned viewer/data package, rights record, device/participant findings, hosted preview/readback and rollback | Preserve existing legacy edition; effective CSP and data headers checked; source distribution/attribution disposition recorded; public switch remains a separate decision |

Planning allowance: roughly **4–7 focused engineer-days** for steps 0–3 and validation if the existing contracts remain reusable; **2–4 days** for M1 design/static analysis. M2 has no credible fixed completion date before source semantics are resolved. These are effort estimates, not elapsed-time promises. New experimental scope is more than “no schema work”: protocol binding, six-arm orchestration, analysis outputs and catalogue compatibility require explicit contracts even when the simulation engine is unchanged.

Local commits should include only reviewed source/docs after applicable gates, excluding generated data, dependencies, caches and the owner's unrelated note. A local commit is already permitted by repository instructions; it need not become a separate permission ritual. This review itself makes no commit because the owner requested a proposal before building.

## 7. Rights, hosting and deferred fidelity

The repo already records OSM/ODbL and DataSF/CC0 metadata and displays attribution; Fable is correct that this is not a completed redistribution assessment. Inventory the actual exported road databases, derived geometries and viewer assets, then record attribution and source/share-alike disposition before public distribution. OSMF distinguishes internal use, interactive maps and database outputs; “before any build leaves this machine” is not a sufficient license analysis. See [OSMF attribution guidance](https://osmfoundation.org/wiki/Licence/Attribution_Guidelines) and [Produced Work guidance](https://osmfoundation.org/wiki/Licence/Community_Guidelines/Produced_Work_-_Guideline). No blanket license clearance is claimed here.

Keep SUMO, MetaDrive, MuJoCo and world-model imagery deferred from this implementation. The earlier tool recommendations describe possible future uses, not validated FleetLab integrations. The existing SUMO audition has not qualified a traffic model. Choose a new simulator only for a named question the graph/resource model cannot answer, with its own adapter and data validation. Do not treat the current concept gallery as simulated vehicle classes.

Anonymous energy-intensity sensitivity can follow this study if its decision value is clear. It remains a parameter sensitivity; measured vehicle classes require independent inputs, charging/energy constraints and a new model version. Staggered initial energy should likewise be a separate declared intervention rather than silently changing the base case.

## Recommendation

Approve **corrections + the fixed 200/400 kW diagnostic study + map/review/continuity design + targeted notebook comprehension improvements**. Hold operator vehicle models, new cities, maneuver simulation and production publication outside this build scope.

## Top risks + mitigations

1. **A polished result conceals structural error:** keep old-map eligibility blocked, retain complete populations and failed arms, and separate statistical summaries from qualification.
2. **Several changes make the result uninterpretable:** isolate power in the first study; version map, pool and continuity changes separately; retain matched input tapes.
3. **Scope expands into an open-ended simulation platform:** six declared arms, 24 evaluation seeds, bounded preflight, no automatic sensitivity expansion, and no new engine/service dependency.
4. **Visitors mistake named concepts for measured vehicles:** retain sourced reference cards; separate anonymous numerical profiles and exact model limitations.

## Next 3 actions

1. Owner reviews this proposal, particularly the fixed-power experiment and strict stop-continuity default, before implementation.
2. After approval, freeze the protocol and correction inventory, reproduce the recorded baseline, then execute the bounded study once.
3. Complete map source review and device/comprehension observations; use the resulting evidence to decide the next qualified simulation and launch scope.
