# FleetLab SF city slice implementation plan

> Execution: `superpowers:executing-plans`, inline with test-first implementation and a fresh final reviewer. User approved implementation of assessment revision 2, section 7, in this task. No further design-choice round is needed.

**Goal:** a source-accounted San Francisco atlas, reproducible local depot experiment, and welcoming recorded-run inspector, isolated from the existing FleetLab.

**Architecture:** source snapshots → inventory and directed graph → frozen scenario → single-owner runner → event verifier → comparison → immutable viewer projections. Display geometry never supplies routing or a gate decision. Each stage has explicit failed/incomplete states.

**Spec:** owner-provided *FleetLab Next Phase Assessment*, revision 2, September 28, 2026, especially sections 3 and 7. The private original is outside the repository. Its technical requirements are restated here and in the pack/run contracts; personal discussion is not copied.

**Stack:** Python 3.11, Node 22, pinned SUMO qualification, optional local MapLibre display, static same-origin viewer. Local CPU; no paid services or accounts needed. Exact installed versions and lock hashes belong in validation.

## Global constraints and G0 freeze

- Base `7e1da7cb72ca0e08fe46ead83db07adfce0e757e`; worktree already isolated, new branch `codex/fleetlab-city-sf`. Preserve the owner's untracked note.
- Scope: `apps/fleetlab-city/**`, this plan, three `docs/FLEETLAB_CITY_*` records, and additive architecture/source-of-truth/handoff entries. Generated outputs only in ignored `build/fleetlab-city` and `dist` subdirectories.
- No protected root Python, legacy models/data/tools, root dependencies, headers, navigation, or deployed files change. No upload/push/public deployment in this slice.
- Root Phase 6 rules describe the evidence workbench. Ruling: the current explicit user approval authorizes this separate simulation subsystem, not a change to the workbench's artifact, execution, or trust contracts.
- NOT_EVIDENCE / SIMULATION_ONLY / NOT_AUTHENTICATED / decision authority NONE. No operator association, field prediction or production safety claim.
- Freeze comprehensive scope before import: SF municipal boundary including islands, passenger-car motor roads, separately labeled routing buffer. Every candidate source ID must have included/excluded/unsupported/quarantined disposition. Denominator is the independently enumerated unfiltered snapshot inventory; both record counts and geodesic lengths reported by road class and official district.
- Routing support: unsupported eligible length ≤2% overall and ≤5% in every district/class; mandatory routes have zero unsupported semantics. Missing official district coverage blocks its gate. No road deletion or threshold relaxation to pass. Excluded nonmotor/private roads are still inventoried with reasons.
- Source topology uses shared source IDs, not geometric intersections. CRS round trip ≤0.5 m at declared control points; this is transform accuracy only. At least 200 stratified topology checks and 100 OD checks, with unresolved critical routes disabled. Automated checks and human map inspection remain separately labeled.
- Scenario: eight hours (07:00–15:00 America/Los_Angeles), 100 identical generic EVs, 1,200 synthetic requests, no pooling, 15-minute unassigned patience, identical initial states. A: 8 ports/200 kW/4 turnaround slots; A+B: 4+4 ports/100+100 kW/2+2 slots. No automatic starting relocation.
- Initial EV assumptions: 60 kWh, 50% initial SOC, 0.18 kWh/km +1 kW auxiliary outside storage, 50 kW port maximum, 80% charge target, 20% reserve, 35% return trigger. Six-minute turnaround every fourth completed trip; turnaround before charging, no simultaneous resource ownership.
- Tune only on 42/43/44. Freeze amendments with reasons before 1001–1012 evaluation. Show charging/turnaround activity and contention. Separate lower/higher demand, energy and resource-load sensitivity cases. Frozen demand/background inputs precede both arms.
- Metrics: all-created completion denominator; completed + unserved + waiting + assigned/in-progress = created. Boarded wait population/count separate; undefined quantities null with reason. Paired bootstrap 2,000 resamples, 95% interval; completion practical margin +2 pp. Guardrails: zero hard violations; empty km/completed relative increase upper bound ≤10%; boarded wait-p90 upper bound ≤60 s; per-zone pooled harm >5 pp veto; <30 requests/arm/zone blocks city-wide support. No joint-confidence claim.
- G2 qualifies microscopic SUMO semantics before selecting it. A distinct graph/resource model is allowed only with a documented feasibility decision and visible absence of endogenous traffic interactions. No implicit engine parity.
- Budget limits are ceilings, not spend targets: $75/month total; no paid inference by default. Fireworks optional local draft authoring cannot change states, metrics or outcomes.
- Legacy offline ≤2,621,440 bytes; retain 135,904-byte reserves. New viewer first view ≤3 MiB, useful map+limits ≤3 s under 20 Mbps/50 ms cold cache; complete road pack ≤250 MiB; pair replay ≤20 MiB compressed; all 12 summaries ≤1 MiB; optional generic vehicle art ≤500 KiB compressed.
- Named-machine targets: 100 vehicles/60 min ≤5 wall min, ≤4 GiB; eight-hour arm ≤40 wall min, ≤4 GiB. Viewer p95 frame ≤33 ms, selection ≤100 ms, loaded seek ≤250 ms, desktop memory ≤512 MiB where instrumentable.
- Required visual checks: 1440×900, 768×1000, 390×844; keyboard, reduced motion, no WebGL, missing data, incompatible/invalid/incomplete results. Human five-participant study and unavailable physical browsers/devices are NOT_RUN, never inferred.

## Review focus

1. Incomplete imports or unsupported restrictions cannot masquerade as a qualified city; independent inventory-loss and turn-path fixtures.
2. Horizon truncation, unreachable/late requests and missing denominators remain visible; conservation and censoring fixtures.
3. Corrupted, reordered or incompatible artifacts cannot become accepted comparison evidence; hash/schema/event/pose fixtures.
4. Depot resource fragmentation may harm service; null and hand-computed capacity-harm fixtures, no universal monotonicity assumption.
5. Missing map/replay files, no WebGL and narrow keyboard layouts still permit honest inspection; missing chunks never fabricate motion.

## Task 1 — baseline, contracts, source accounting (G0/G1)

Files: `citylib/contracts.py`, `citylib/pack.py`, `citylib/routing.py`, `config/sf-v1.json`, `schemas/*.json`, `tests/test_pack.py`, `tests/test_contracts.py`, pack contract.

- [x] Record actual environment, baseline commands, protected-source digest, existing package sizes and failures.
- [x] Write failing topology/grade-separation, restrictions, island/buffer, Unicode/left-hand, inventory-loss and schema/hash tests; run `python -m unittest discover -s apps/fleetlab-city/tests -v` and retain red log.
- [x] Implement `import_pack(source, boundary, districts, config)`, `qualify_pack(pack)`, and `Graph.route(start, end)` with edge-state turn constraints; no invented crossings or permissive unsupported rules.
- [x] Fetch pinned public snapshots with timestamps/hashes/rights; preserve full candidate inventory and classify all roads. Produce structured coverage and human report. Run fixtures and actual source qualification; report failures without shrinking scope.

## Task 2 — engine audition and frozen operational experiment (G2)

Files: `citylib/engine.py`, `citylib/inputs.py`, `citylib/sumo_probe.py`, `experiments/*.json`, `tests/test_engine.py`, run contract.

- [x] Red fixtures for capacity 1 vs 2, power/reserve, conserved states, null runs, exogenous input independence, interruption and explicit teleport/drop counters.
- [ ] Pin and audition SUMO/netconvert/TraCI locally, including zero/nonzero background. Record supported resource/stop/route semantics and runtime, then select the engine with a documented reason.
- [x] Implement `freeze_inputs(pack, spec, seed)` and `run_arm(pack, inputs, arm, spec)` with one clock, lossless events and declared pose samples. Prevent state changes by viewer/authoring.
- [x] Run tuning-only mechanism cases, freeze any justified amendment before evaluation, and benchmark on this machine.

## Task 3 — verification, paired decisions, complete schedule (G3)

Files: `citylib/verify.py`, `citylib/compare.py`, `tests/test_verify.py`, `tests/test_compare.py`, `tools/city.py`.

- [x] Red tests for event reorder/loss, impossible occupancy/energy, metric population/censoring, incompatible pairs, sparse zones and guardrail interval precedence.
- [x] Implement `verify_run(directory)` from stored events and frozen inputs; compare recomputed metrics with stored summaries. Shared parsing/schema is disclosed, not independent organizational validation.
- [x] Implement `compare_pairs(verified_pairs, protocol)` and all 12 required seeds plus separately named sensitivity cases. Preserve all failed runs and every seed's result.
- [x] Persist deterministic content hashes and exact reproduction commands. Required failed runs leave G3 incomplete.

## Task 4 — atlas, decision notebook, replay and local package (G4)

Files: `web/*`, `test/*.test.mjs`, `tools/city.py`, `citylib/package.py`, scoped npm lock.

- [x] Red projection, pose-gap, malformed-data, schema-refusal, Range and rollback tests.
- [x] Build welcoming ivory/teal responsive UI with source/support/scenario masks, honest status labels, comparison table and selected-vehicle recorded trace. Future cities are clearly planned cards.
- [x] Implement data validation and immutable viewer projections, same-origin network manifest, loopback Range server and standalone package checker. Stage compatible viewer+manifest+pack+schema rollback rehearsal.
- [ ] Validate real painted screens and interactions on available browser paths; record actual byte/runtime/network/frame observations and unsupported checks.

## Task 5 — optional authoring, regression, review and handoff

Files: `citylib/explain.py`, `tests/test_explain.py`, validation record, additive handoff/source-of-truth/architecture notes.

- [ ] Red template/provider failure, hostile reference, budget-expiry and attempted gate override tests; deterministic fallback independent of key/account. Paid adapter qualification is optional and NOT_RUN without explicit paid invocation.
- [ ] Run complete new suite, full serial legacy Node suite without simulation/browser load, scoped legacy Python tests, Ruff/doctor and both unchanged packages. Retain initial failures; no timing-pin relaxation.
- [x] Fresh read-only final review; fix important findings with red-to-green regressions.
- [ ] Deliver actual commands/results, source hashes/rights, exact costs, screenshots, unresolved gates and local reproduction/deployment-preparation package. No release-ready claim while required gates are missing.

## Execution ledger

- G0 start: baseline HEAD above; 14-core Apple arm64 Mac, 64 GiB RAM, macOS 26 kernel Darwin 25.5.0; Node 22.22.0/npm 10.9.4, Python 3.11.15 available in `hermes-dev`, 102 GiB available disk. Existing editable Python install points at another worktree: all legacy checks must explicitly set this checkout's `PYTHONPATH`.
- Existing Phase 6/historical release approval rules reconciled: current task authorizes an isolated local SF simulation slice. Public deployment, shared billing settings and optional paid inference are outside this implementation's default actions.
- Plan execution uses the existing linked worktree and an isolated branch; no new worktree needed. Progress and retained logs live under `build/fleetlab-city/validation` to honor the document's allowed output paths.

- G0 path ruling (before relocation): protected `test_r2_playground_holds_no_python_manifest_or_node_modules` covers all of `playground/`, not only the old app. Initial scoped gate after scaffolding: 88 pass / 1 fail, retained in `legacy-baseline-python.log`. Per assessment §7.4 equivalent sibling relocation, the entire new namespace is `apps/fleetlab-city/`. Root tests and old boundaries remain unchanged; all proposed commands use this prefix. Risk: downstream readers must use the updated command path.
- G1 red: two module-import errors before implementation (`g1-red.log`); fifteen meaningful fixtures pass after implementation. One intermediate fixture error was macOS `/var` symlink handling in temporary test paths; canonicalized the selected fixture root, preserving symlink refusal inside artifacts.

- G1 actual import: 69,027 highway-tagged records reconcile; 21,528 included, 46,957 excluded, 542 unsupported. Whole-source pack ~109 MiB. Unsupported eligible length 1.936%; class gates fail (primary, trunk, living street), and 13.159 km of municipal roads are outside the trimmed district polygons. These records remain UNASSIGNED; no official-district gate substitution. Pack is a review artifact, not experiment-ready.
- G2 measured SUMO 1.27.1 microscopic traffic auditions: 100 controlled vehicles, 3,600 simulated seconds, zero/100 background arrivals per hour; 1.852/2.027 s wall; 100/200 maximum concurrent, zero teleport or insertion backlog. This qualifies only the grid traffic probe. Full SF netconvert: 32.77 s, 435 unresolved restriction-direction, 62 from-edge and 124 to-edge mapping warnings (among other modeled geometry warnings). SUMO city semantics/depot-controller remain unqualified.
- Ruling: deliver the explicitly permitted graph/resource review runner with a distinct model ID and prominent no-endogenous-traffic limit while SF/SUMO qualification remains open. The grid probe is not evidence of full-city or depot-controller readiness. Cost if wrong: results may miss traffic/depot interactions; recommendations remain blocked and the SUMO qualification is retained as required follow-up.
- Routing performance: initial A* one-hour run 100.76 s; a pinned SciPy 1.16.3 edge-state Dijkstra table preserves restrictions and prepares in 2.92 s. Eight-hour tuning arms then run in ~4 s, below 4 GiB. Initial large-run verification caught pose/time mismatch on zero-length source edges. A failing zero-edge fixture reproduced it; movement now consumes the graph's declared edge time, including its 0.01-second minimum. Old failed runs retained.
- Corrected tuning 42/43/44: all six arms independently recompute successfully. Charging, turnaround and resource contention are nonzero; no parameter amendment is needed. Protocol, depot positions, seed schedule and sensitivity set are frozen before evaluation. No candidate advantage was used to select parameters.

- Final review found five reproducible integrity gaps (charging, request endpoints, stale packaged comparison, occupancy, pose annotations). Regressions reproduced them; interval-based verification and protocol-bound fresh packaging fix them. All 34 real runs pass the strengthened verifier. The brief does not permit treating this as producer authentication.
- 100 supported-graph OD checks pass; an eight-hour run exactly repeats its semantic digest. A second immutable import reproduces graph, coverage, source inventory, geometry and roads digests. Independent human map inspection remains NOT_RUN.
- Reviewed package: `dist/city-explorer-reviewed`, 4,834 files, 1,790,700-byte compressed first view, 3.33–3.39 MB per complete replay pair, largest file 22,272,149 bytes. No upload. Actual screenshots at all three requested viewports plus malformed/missing/incompatible/partial-data checks are retained. Browser latency/memory, physical devices, hardware WebGL-loss, reduced-motion preference and the human study remain NOT_RUN.
- F0 template and mocked authoring rejection work. Live F1 transport/price/atomic-budget qualification is deliberately unimplemented, refuses invocation, and remains optional NOT_RUN. No paid calls or key lookup occurred; actual task spend $0.
- The required routing/class/district/human gates fail or remain open, so this is a local review build and blocker report, not an engineering-complete or release-ready slice. The graph model also now rejects nonzero background/incident tapes instead of silently ignoring them.
- Read `docs/FLEETLAB_CITY_SF_VALIDATION.md` and `apps/fleetlab-city/README.md` for final command results, observed timing failures, reproduction, source licensing and next qualification actions. Legacy files have only additive documentation changes. Original owner note is preserved.

- Final legacy timing gate: full serial suite 1,969 pass / 3 timing failures / 1 existing TODO; focused performance/runtime follow-up 50 pass / 3 timing failures; scale-response timing also failed separately. Unrelated CPU-heavy work was observed, but causality is not assumed. Preserve the thresholds and report this gate unresolved; complete a quiet-machine run before release. The new Python suite is 54/54, Node 6/6, scoped legacy Python 89/89, and whole-checkout Ruff passes.
