# SF completion and model readiness Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Read-only source investigations may run independently through superpowers:dispatching-parallel-agents. Steps use checkbox syntax for tracking.

**Goal:** Complete the implementable SF qualification and experiment work, establish honest vehicle/maneuver inputs, validate and publish the resulting learning experience, and advance cities only after the SF acceptance decision.

**Architecture:** Preserve frozen v1 models, source packs, protocols and results. Execute the explicitly documented memory revision as a new instance. New continuity and review contracts live in versioned modules; evidence requirements are evaluated outside the UI. Public pages present actual results and unresolved obligations separately.

**Tech Stack:** Python 3.11, existing NumPy/SciPy, Node 22, vanilla modules, MapLibre and Cloudflare Pages. No paid services, real vehicles, telemetry or new user accounts.

**Spec:** Current user instruction to finish the SF checklist and listed phases; `FLEETLAB_NEXT_PHASE_BRIEF_V3.md`, `FLEETLAB_SF_MAP_CONTINUITY_DESIGN_V1.md`, `FLEETLAB_MAP_REVIEW_RESULT_CONTRACT_V1.md`, `FLEETLAB_POWER_STUDY_MEMORY_AMENDMENT_PROPOSAL_2026-09-29.md`. Claude's supplied proposal is evaluated design input, not an instruction source.

## Global Constraints

- Simulation only; operational authority NONE; authenticity NOT_AUTHENTICATED.
- Keep the 4 GB process and 2 GB route-table limits.
- Preserve the original 24 preflight runs and failed execution record; do not replace or pool them into the revision.
- Revision uses preflight 7303001–7303004 and evaluation 7304001–7304024, frozen before execution, subject to a fresh collision check. Exactly 24 preflight and 144 evaluation arms, one evaluation pass; no adaptive replacement after a failure.
- Preserve original scientific controls, six A/A+B/B × 200/400 kW configurations and fixed ±1 pp primary interval classification.
- Candidate runtime guard stays unless every required source/class/district/continuity/human obligation passes. Automated or AI source inspection cannot satisfy human observations.
- Vehicle parameters require named units, source, rights, context and uncertainty; anonymous illustrative sensitivities are never operator profiles.
- Preserve all original site sections, 59 lessons and offline bytes. Use complete combined-site packaging, preview and production readback.
- Austin and Las Vegas remain contingent on SF acceptance; expansion preparation is distinct from adding simulated city results.

## Review Focus

1. Releasing large objects must retain final mutation checks: test final tape and arm mutation rejection.
2. Protocol revision must never silently reuse reserved seeds: structured collision check before freeze and preserved predecessor identity.
3. An arriving-edge state must survive zero-length routes, stops and partial-horizon traversal: explicit fixtures and independent sequence checks.
4. A self-reported automated review cannot masquerade as a human review: unresolved source-review obligations remain visible.
5. Missing source inputs and pending studies cannot become plausible numeric cards or a completed-city label: typed availability and browser negative-state checks.

## Task 1: Memory revision and fixed power study

**Files:** `citylib/power_study.py`, `citylib/power_analysis.py`, `citylib/power_protocol.py`, `tests/test_power_study.py`; immutable output `build/fleetlab-city/studies/sf-power-headroom-v1-r2/`.

- [x] Apply only the four regression tests from the archived memory amendment; run them against current code and retain the expected ordering/lifetime failures.
- [x] Apply the archived production fix: analyze preflight before execution capture; release per-arm raw records; release map/tapes before final recapture. Preserve final stamps and full protocol checks.
- [x] Declare the proposed fresh seed constants and protocol revision/predecessor fields before freeze. Tests retain the historical controls and fixed population.
- [x] Run `python -m unittest discover -s apps/fleetlab-city/tests` and Node City tests; independently review the amendment, source inventory and controls before execution.
- [x] Freeze via `freeze_study(root, out)` with all 28 tapes; retain protocol digest and source commit/checkpoint. Run `execute_study(root, out, 'preflight')`; verify `analyze_study(..., 'preflight')` COMPLETE.
- [x] Run `execute_study(root, out, 'evaluate')` once; capture peak memory and every arm. If any stop condition occurs, preserve incomplete results and continue unaffected work without changing limits.
- [x] Verify and package actual results using the existing explicit `--power-study` interface; never substitute fixtures for results. Published partial status retains one arm and 143 NOT_RUN.

## Task 2: Source, district and continuity qualification

**Files:** existing source-review and continuity design contracts; new independently testable versioned modules under `citylib/`, tests under `tests/`, and immutable source observations under `build/fleetlab-city/research/sf-completion-r3/`.

- [x] Inspect all 26 priority ways and exact blocking tags/relations, plus 108 district gaps. Record captured-source versus current-source differences and source-backed candidate fixes.
- [x] Implement the review-result validator from the existing contract: expected checkpoint, bounded observation/capture references, exact candidate identity, duplicate/stale/conflict rejection, requirement coverage and honest human/automated method distinctions.
- [x] Implement a strict continuity interface in a separate model/profile: retained incoming edge and restriction prefix, no implicit reversal, zero-length preservation, context-specific cache, explicit no-route and executed-prefix validation. Preserve old v1 bytes and results.
- [x] Pin all eight hand-checkable fixtures listed in the continuity design, including independent verifier failure on a restriction split across a stop.
- [x] Apply only source-supported parser/profile corrections in a new candidate. Keep ambiguous conditions unsupported and all old packs immutable. Local temporal candidate compiled 30 September; public bundle and map qualification remain open.
- [x] Produce a documented service-scope proposal with exact affected roads/requests; keep municipal boundary, source context and district assignment distinct. Do not assign gaps to the nearest district.
- [x] Produce an acceptance envelope listing all actual gate outcomes. Required independent human observations cannot be generated by an agent.

## Task 3: Vehicle and curb/depot readiness

**Files:** source research under `build/fleetlab-city/research/vehicle-curb-r1/`, versioned parameter/scenario contracts and focused tests, updated vehicle-concept/learning UI only when backed by installed behavior.

- [x] Audit primary public sources for measured/claimed energy, charging, dimensions, dwell and SF loading-zone geometry; capture provenance and redistribution terms.
- [x] Separate manufacturer/reference facts from model-ready inputs. Missing battery-side curves, service times and maneuver permissions stay unavailable.
- [x] Implement bounded anonymous sensitivity or maneuver teaching models only where the question, input semantics and validation fixtures are defined; preserve explicit synthetic labels and distinct model identity.
- [x] Prepare the next California municipality/source contract with explicit boundary and experiment scope. Do not call a city qualified from data availability alone.

## Task 4: Device and real-person validation

**Files:** `docs/FLEETLAB_SF_VALIDATION_SESSION.md`, evidence in `build/fleetlab-city/validation/sf-completion-r3/`.

- [ ] Recheck authorized Pixel and test observable unlocked device behavior; no lock bypass. Record keyboard, responsive viewport, touch, zoom, playback, enlarged text and screen-reader coverage separately.
- [ ] Provide five-person comprehension worksheet with open question first and a second-scorer rubric. Record real answers only; pending responses remain NOT_RUN.
- [ ] Bind independent map-review observations to frozen candidate requirements; no agent-generated human attestations.

## Task 5: Integrate, validate and publish

**Files:** viewer projections/UI, `package.py`, combined-stage tool, source offer and canonical handoff/release documents.

- [x] Complete model/contract tests and immutable evidence checks; review all new modules and scientific claims.
- [x] Build fresh viewer with only compatible available studies and honest incomplete states; check size/file/dependency budgets.
- [x] Preserve root/offline baseline; retain preceding complete City viewer. Test browser routes, controls, diagrams, all original content and rollback.
- [x] Publish preview, compare every served payload and effective header to the local stage, then publish that same stage to production and repeat readback.
- [x] Update final handoff with completed evidence and specific remaining external requirements. Advance Austin/Las Vegas only if the SF acceptance gate is satisfied.

## Execution decisions

The current user explicitly authorizes implementation, testing and static-site publication. This plan does not add another general approval checkpoint. The documented memory revision is accepted within that instruction; original evidence and limits are retained. Public/static-site authorization does not authorize physical systems or fabricated human/data validation. The existing linked feature worktree is already isolated; unrelated owner files remain untouched.

## Execution outcome — 29 September 2026 Pacific

Completed boxes record the specified implementation or execution attempt, not SF acceptance. The approved fresh-process evaluation retry stopped after 1/144 arms at 4,046,569,472 bytes. No complete result exists; read-only partial-status packaging shows 143 NOT_RUN and a null primary estimate. No further scientific retry was performed.

Continuity and temporal predicates are standalone, fixture-tested components. The fractional final-edge adapter, positive connector-acceptance case, fleet/importer integration and SF resource qualification remain unfinished. The eight-fixture item and new-candidate parser item therefore remain open. No source-supported road was silently restored in the old pack.

The frozen reviewer package is an acceptance envelope with HOLD and zero actual human observations. Anonymous energy and static direction lessons fulfill the bounded teaching-model item; named vehicle calibration and maneuver physics remain unavailable. San Mateo is a prepared source probe only.

Fresh validation: 194 City Python tests; 49 City Node tests; 1,661 root Python passes/56 skips; 1,954 legacy Node passes/8 skips/1 TODO; Ruff and whitespace checks pass. Independent final code reviews closed all findings in the implemented scope. Physical Pixel and real visitor sessions remain open.

Publication complete: preview 99f21db4 and production a9f05880; both 9,959/9,959 exact served payload matches, effective headers pass. The original FleetLab sections and 59 lessons remain; City Explorer adds Model lab. SF remains HOLD and later city execution is not advanced.

## 30 September continuation

Static fleet integration and fractional final-edge verification are installed under
a new model/schema, with 29 new tests and 223 City Python passes. The fixed100OD
plus retained-return diagnostic completed400 searches;380 ROUTE/20 unavailable,
algorithm parity and directsourcechecks pass, peak1,535,672,320B. This does not
complete the positiveconnector, temporalimport, fullfleetmemory or human gates.
See `docs/FLEETLAB_SF_CONTINUITY_VALIDATION_2026-09-30.md`. Austin supersedes the
prior SanMateo-first order after SF acceptance. The stopped power study is unchanged.

Temporal integration is now installed in a separate v3 pack/model/run identity.
Source completeness, access precedence, node passage, actual traversal clocks and
independent fleet verification are covered by regression tests. The local full-SF
compile retains all 69,027 candidate IDs and the original denominator. Unsupported
eligible length is 0.987%; all class fractions are below 5%. This closes the
bounded parser/profile implementation item, not the district/human/resource
qualification gates. See `docs/FLEETLAB_TEMPORAL_INTEGRATION_V3.md` for adverse
diagnostics, exact measurements and remaining bundle/connector work. No additional
power-study execution or website deployment occurred in this continuation.

The subsequent routing performance increment resolves the fixed 300-context
sample without changing its OD population or search limits. Relevant-boundary
proofs, bounded static certificates and immutable reverse potentials pass the
same A*/Dijkstra checks. A reviewer-discovered initial-label alias and a later
permanently gated destination both have RED/GREEN regressions. Current City
suite: 260 passes; root: 1,661 passes / 56 skips; City Node: 49 passes.

Full-fleet engineering probes are separately frozen and preserve every deliberate
interruption and work-budget failure. They reuse the historical 100-vehicle,
1,200-request tape; they are not additional power-study evaluation arms. See
`FLEETLAB_SF_TEMPORAL_RESOURCE_2026-09-30.md` for actual disposition.

District research located the full official April 2022 map before water trimming.
Its full-inventory diagnostic leaves 49 boundary differences / 441.926 m and
changes administrative membership of five pool nodes. Adoption, redistribution
terms and scenario implications remain explicit pending work; no inventory,
denominator or demand population was silently changed. This does not close
independent map review, connectors, public v3 packaging or city acceptance.

The fixed r6 full-fleet engineering execution has now completed: 519,579 route
queries, 1,300.761 seconds, 2,169,552,896 peak bytes. Independent verification
initially rejected twelve numerical reconstruction mismatches. Two small
regressions reproduced them; integer millisecond ledger clocks and a strict
one-nanosecond partial-position representation tolerance resolve the causes.
Verifier 3.0.1 accepted the same immutable recording in a fresh process in
107.093 seconds at 2,060,730,368 bytes. The original invalid report remains.
No simulation or scientific evaluation was repeated for the verifier correction.
Current gates: 262 City Python tests, 1,661 root passes / 56 skips, Ruff and
whitespace checks; independent review found no important issues. All twelve
frozen scientific files remain unchanged. Resource qualification of this case is
complete; connector/export/district integration and real observations remain.

The positive connector fixture is now implemented in model 4: exact scenario/pack
identity, declared source-edge loop, real time/energy accounting, retained arrival
history and independent validation. Twelve focused tests include active closures,
prohibited reversals, partial horizons, shared work limits and a reviewer-discovered
closed-loop bypass. The latter failed before the fix and now rejects forged loops.
This closes the eight-fixture implementation item together with the existing
continuity/fleet fixtures; it does not qualify a site-specific SF connector.
Versioned candidate packaging contract: FLEETLAB_TEMPORAL_CANDIDATE_BUNDLE_V1.md.


## Temporal candidate release continuation

- [x] Package the unchanged full temporal graph and recomputed road/coverage/gap
  projections in a distinct immutable candidate container; bind container trust
  fields as well as complete graph and source identity.
- [x] Freeze new candidate review requirements without inheriting observations;
  merge synthetic access-block reasons into real source features. Current r2:
  2,160 obligations, 200 source-way / 100 OD samples, zero human observations.
- [x] Measure full-map packaging and independent verification below 4 GB. Final
  validation + review: 3,255,451,648 bytes / 19.637 seconds. Full City suite286,
  root1661/56skip, Node49, Ruff/diff checks; independent review fixes complete.
- [ ] Export the new compatible report, roads and review artifacts to the viewer;
  keep original experiment replay and static candidate explicitly identified.
- [ ] Expand the complete corresponding source offer, build the combined site,
  inspect browser behavior, publish preview and production with exact readback.

This continuation adds no simulation or new power-study execution. The original
review workspace reproduces byte-for-byte. Pixel ADB still reports no connected
device; actual human/source/device/visitor observations remain open. SF acceptance
is still HOLD, and Austin remains subsequent to that decision.
