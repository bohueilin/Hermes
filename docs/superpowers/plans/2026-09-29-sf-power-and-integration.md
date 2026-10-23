# SF power experiment and FleetLab integration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the approved SF power-headroom experiment, correct the recorded UI, improve map-review readiness, and prepare City Explorer's integration into FleetLab.

**Architecture:** Keep the existing graph/resource engine, recorded v1 runs and comparator unchanged. Add a frozen six-arm study runner and separate read-only analysis/publication projection. A versioned City Explorer remains a separate route under the existing site; the owner approved the new top-level City Explorer tab and live integration on 29 September.

**Tech Stack:** Existing Python 3.11/SciPy, Node 22, vanilla modules and MapLibre. No new provider or backend.

**Spec:** `docs/FLEETLAB_FINAL_PROPOSAL_2026-09-29.md` (owner approved building). Integration placement was presented before implementation: top-level City Explorer + homepage SF feature card, same-tab `/city-explorer/`, internal Start here/City atlas/Decision notebook/Replay studio and return to FleetLab. Placement and publication are now explicitly approved. Preserve all existing experiences.

## Global Constraints

- Simulation only; no real vehicle connection, operator calibration, real-world safety or deployment authority.
- Current recorded graph/engine/comparator/scientific results remain reproducible. Outputs go into new directories.
- Six arms: layouts A, AB, B at 200 and 400 kW total. Eight ports, 50 kW port limit, four turnaround slots, 100 vehicles, 1200 requests, 30 kWh initial, 48 kWh target, 8-hour horizon, unchanged frozen 220-node pool and site nodes.
- Four fresh preflight seeds, 24 fresh evaluation seeds. Immutable full input tape reused across all six arms of each seed. One evaluation pass; no replacement seeds or cells.
- Primary estimand is the seed-paired interaction of AB−A at 400 versus 200 kW; 95% paired-t interval; ±1 pp practical band; B-only secondary.
- Invalid/incomplete evidence and scientific map eligibility remain separate from a descriptive statistical classification.
- All 144 main arm summaries included; detailed replay for all six configurations of the first evaluation seed. Raw evidence retained locally.
- Memory ceiling 4 GB; estimated route table ceiling 2 GB. Measure full preparation/verification/disk cost separately from engine cost.
- No new simulator/dependency or paid call. The latest owner instruction authorizes the additive website integration and publication; retain unrelated notes and historical evidence. The scientific study amendment remains held.
- Work in this already isolated linked worktree. Use explicit source snapshots for review while pre-existing source is untracked; no indiscriminate staging.

## Review Focus

- A forged/rehashed summary or mismatched protocol must fail packaging; validate against captured run and fresh verifier.
- A missing/invalid arm must not silently shrink n or produce a successful primary interaction.
- B-only and 400-kW recorded replay must show the actual sites and energy metadata, without baseline-A hardcoding.
- Changing selected study while data loads must not display a stale experiment or trace.
- Added navigation/headers must not break existing hash routes, offline edition, mobile menu or rollback.

## Task 1: Frozen study runner and independent analysis

**Files:** Create `apps/fleetlab-city/citylib/power_protocol.py`, `power_study.py`, `power_analysis.py`, `tools/power-study.py`, `tests/test_power_study.py`; keep `engine.py`, `compare.py`, `runner.py`, `verify.py` unchanged.

**Interfaces:** `power_protocol.make_protocol(root: Path) -> dict`; `power_study.freeze_study(root: Path, out: Path) -> dict`; `power_study.execute_study(root: Path, frozen: Path, mode: str) -> dict`; `power_analysis.analyze_study(root: Path, frozen: Path, mode: str) -> dict`. CLI modes freeze/preflight/evaluate/analyze with explicit root/output arguments. The frozen directory owns protocol, tapes, mode-specific arms and analysis; a run cannot replace existing artifacts.

- [x] Add tests for exact arm resources, immutable shared tapes, duplicate/disjoint seeds, protocol/input/spec mismatch, zero-variance paired interval, classification boundaries, invalid/missing block refusal, wrong map/model and resource limits.
- [x] Use this hand-checkable primary fixture: per-seed layout completion AB−A = 1 pp at 200 and 3 pp at 400; interaction must be 2 pp. Constant interactions produce low=mean=high=2 and MATERIAL_POSITIVE. An interval [0.2,0.8] is BOUNDED_SMALL, not MATERIAL_POSITIVE. An interval [0.2,1.2] is UNRESOLVED.
- [x] Confirm focused tests fail for absent implementation; implement using existing `execute_arm`, `scientific_spec`, `verify`, canonical digest, bounded no-follow capture. Do not implement alternate simulator or verifier.
- [x] Search existing source/artifacts for proposed seed IDs before freeze. Proposed preflight 7301001–7301004; evaluation 7302001–7302024; if collision exists report before any freeze. Record generator/version, scientific spec, all controls, model/pack/input/protocol identities, analysis methods and stop rules. Protocol hash must enter each new run spec without a self-referential hash.
- [x] Freeze all tapes before any execution. Reject tampered frozen inputs/protocol, foreign directories, repeat execution and mismatched complete/partial inventories. Record execution failures honestly; keep invalid arms and stop affected evaluation. A freeze or study result cannot grant map eligibility.
- [x] Project event-derived state minutes by type/site, charging energy/starts/ends, site available/used power, final queues, route reachability/immobility, all request states, zones including UNASSIGNED, per-request empty distance and conditional boarded waits. Freshly verify captures; bind analysis to exact complete protocol and run set. Never trust edited stored metrics alone.
- [x] Analysis JSON uses schema `fleetlab.power-analysis/1.0.0`, id `sf-power-headroom-v1`, `protocol_digest`, `pack_digest`, `model`, `mode`, `seeds`, `arms`, `cells`, `zones`, `primary`, `analysis_status`, `map_eligibility: BLOCKED_MAP_QUALIFICATION`, `decision_authority: NONE`, `scope: SIMULATION_ONLY`. Arm IDs: `a-200`, `ab-200`, `b-200`, `a-400`, `ab-400`, `b-400`; each arm row records seed, layout, total_power_kw, input/run digest, verification/violations, metrics/state/site summaries. Primary includes mean/low/high/n/unit/classification/zero_excluded and method; missing full schedule sets primary null and explicit reasons.
- [x] Test and self-review. Report exact commands/output and public JSON structure. Do not execute SF preflight/evaluation; parent first reproduces old runs, reviews implementation and freezes protocol. Do not commit independently.

## Task 2: Correct labels and present both studies with compatible replay

**Files:** Modify `citylib/package.py`, `web/app.mjs`, `web/replay.mjs`, `web/view-model.mjs`, `web/index.html`, `web/style.css`, `web/vehicle-concepts.mjs`; create focused `web/power-study.mjs`, Node tests and Python package projection tests. Exact Task 1 output sample supplied before implementation.

**Interfaces:** Add optional `power_study` input to viewer builder; export analysis/protocol projection and first-evaluation-seed six-arm vehicle traces only after fresh validation. Extend catalogue with versioned study metadata and configuration-derived recording identities, site IDs, energy metadata and files. Existing catalogue without study remains supported. UI consumes only checked catalogue/file data.

- [x] Add negative packaging test: edited summary with regenerated hashes but no matching run must be rejected; no valid analysis when arm set missing. Check paired per-comparison compression and total current/prior file budgets.
- [x] Replace blanket reserve wording with violation-code labels aggregated from verification. Recorded energy displays kWh and charge target; unused nominal capacity is labeled in methodology, not a modeled gauge. Add dated correction note; preserve all historical run bytes.
- [x] Test wrong configuration/state and stale selection responses before changes. B-only must use only depot B; 400-kW rows must state actual resources; existing recorded A/AB replay still works.
- [x] Add study selector and readable question/controls/result/resource-time/site-queue/zone panels. Show all 144 arm summaries, exact thresholds, fixed denominators and conditional wait explanations. First-seed replay scope visible; unavailable repeats explain missing replay and never substitute another seed.
- [x] Connect selected configuration to Replay using recorded sites and layout labels. Make older replay defaults backward compatible. Maintain viewer-entered fares and unavailable safety metrics.
- [x] Run focused Node/Python tests, then self-review and report; no public deployment or shared legacy changes in this task.

**Integration limit:** Software/projection tests and independent review pass. The actual 144-arm SF result, new power package and its measured combined budget remain held pending an approved execution revision; no fixture is presented as SF evidence.

## Task 3: Map qualification design and prioritized evidence

**Files:** New `docs/FLEETLAB_SF_MAP_CONTINUITY_DESIGN_V1.md` and `docs/FLEETLAB_MAP_REVIEW_RESULT_CONTRACT_V1.md`; optional bounded read-only tool/output under `tools/` and `build/fleetlab-city/validation/power-v1/`. No candidate execution guard removal.

- [x] Specify per-vehicle incoming-edge/prefix state, zero-length-leg behavior, stop/depot boundary behavior, explicit reviewed connector resets, no-route outcomes and an independent sequence verifier under a future model version.
- [x] Specify immutable review results with pack/source digest, reviewer/observation/rationale/disposition and stale/conflicting/insufficient review rejection. Existing NOT_RUN checklist stays immutable; no human review is fabricated.
- [x] Emit source-backed priority queue with complete restriction/gap identities and constraints; keep UNASSIGNED and full source inventory. Separate city/service boundary from district polygons. Document unresolved source conditions honestly.
- [x] Read-only static boundary report must distinguish direction changes from violations and avoid presenting fixed-dispatch route inspection as a fleet counterfactual. No real-world legality inferred from absent continuation.

## Task 4: Approved additive hosted integration

**Files:** A narrowly scoped hosted navigation/homepage patch, City Explorer return link, integration tests and launch tooling. Preserve existing legacy offline payload and production bundle. Inspect current packager before choosing hosted-only injection versus source build flag.

- [x] If approved, place City Explorer after Fleet day in main navigation and add one SF homepage card. Same-tab `/city-explorer/`; mobile Explore menu includes it; current URL/model state semantics remain unchanged.
- [x] Keep City Explorer module/data loads scoped to its route. FleetLab brand returns to root; City Explorer home remains a clear separate action. No iframe, shared simulator state, operator endorsement or browser pop-up.
- [x] Record exact intended legacy hosted-file exceptions and root route-header exception; original 99-file baseline retained for rollback. Offline bundle unchanged. Current immutable stage tool must not silently bless modified legacy inventory.
- [x] Validate root/city routes, query/hash deep links, reload/Back, active navigation, keyboard/menu operation, unrelated legacy paths, package budgets and rollback. Prepare and validate a concrete combined stage before the authorized publication.

## Task 5: Reproduction, controlled execution, QA and handoff

**Files:** New validation logs, immutable run directories, docs and final viewer/stage; source overlay inventory and local reviewed commits only after gates.

- [x] Before new simulation: run baseline 86 Python/15 Node tests, root Ruff and record current source snapshot. Reproduce old 34-arm scientific digests in a fresh directory with no changed engine/comparator.
- [x] Review Task 1, freeze protocol before inputs are evaluated, record the reviewed protocol/source checkpoint (inventory or local commit after applicable gates), then preflight. Record elapsed/memory/disk and actual stopped/complete state. Launch evaluation once only if eligible preflight and reproduction pass.
- [ ] Verify all new arms and summary binding. Run fresh code review before packaging. Build immutable viewer; byte-compare old scientific records and preserved legacy/offline baselines.
- [ ] Browser desktop/mobile/tablet and Pixel if accessible; do not claim human/phone checks from emulation. Run legacy regression/timing suite after heavy jobs finish. Record pending participant and hosting checks.
- [ ] Update handoff, source-of-truth and presenter guide with actual results, limitations, integration plan/choice and rollback. Publish the reviewed existing SF study after integration gates; the separate power study remains held.

## Execution rulings

Owner's explicit “proceed with building” approves the prior written proposal and its sequence; this plan makes that work concrete and does not require another general implementation permission. Only shared-site placement is pending. Use sequential implementer/reviewer tasks with isolated ownership; the parent may do independent read-only research, reproduction and documentation meanwhile. Existing source is untracked, so source snapshots and task diffs supplement HEAD-based review until reviewed checkpoints can be committed safely. No worker commits or stages unrelated work.


## Additive website release outcome

Task 4 and the authorized website publication are complete. Production
`b592d5a8-c89c-4b42-99ca-e6d256bd2408`, source `3236065`, passed full9,934-file
preview and production readback, scoped headers and browser smoke checks.
The scientific main evaluation in Task 5 remains held independently; the owner
has not approved its execution amendment. Pixel and participant checks remain
explicitly NOT_RUN. See the integration release record for full evidence.
