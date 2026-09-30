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

- [ ] Apply only the four regression tests from the archived memory amendment; run them against current code and retain the expected ordering/lifetime failures.
- [ ] Apply the archived production fix: analyze preflight before execution capture; release per-arm raw records; release map/tapes before final recapture. Preserve final stamps and full protocol checks.
- [ ] Declare the proposed fresh seed constants and protocol revision/predecessor fields before freeze. Tests retain the historical controls and fixed population.
- [ ] Run `python -m unittest discover -s apps/fleetlab-city/tests` and Node City tests; independently review the amendment, source inventory and controls before execution.
- [ ] Freeze via `freeze_study(root, out)` with all 28 tapes; retain protocol digest and source commit/checkpoint. Run `execute_study(root, out, 'preflight')`; verify `analyze_study(..., 'preflight')` COMPLETE.
- [ ] Run `execute_study(root, out, 'evaluate')` once; capture peak memory and every arm. If any stop condition occurs, preserve incomplete results and continue unaffected work without changing limits.
- [ ] Verify and package actual results using the existing explicit `--power-study` interface; never substitute fixtures for results.

## Task 2: Source, district and continuity qualification

**Files:** existing source-review and continuity design contracts; new independently testable versioned modules under `citylib/`, tests under `tests/`, and immutable source observations under `build/fleetlab-city/research/sf-completion-r3/`.

- [ ] Inspect all 26 priority ways and exact blocking tags/relations, plus 108 district gaps. Record captured-source versus current-source differences and source-backed candidate fixes.
- [ ] Implement the review-result validator from the existing contract: expected checkpoint, bounded observation/capture references, exact candidate identity, duplicate/stale/conflict rejection, requirement coverage and honest human/automated method distinctions.
- [ ] Implement a strict continuity interface in a separate model/profile: retained incoming edge and restriction prefix, no implicit reversal, zero-length preservation, context-specific cache, explicit no-route and executed-prefix validation. Preserve old v1 bytes and results.
- [ ] Pin all eight hand-checkable fixtures listed in the continuity design, including independent verifier failure on a restriction split across a stop.
- [ ] Apply only source-supported parser/profile corrections in a new candidate. Keep ambiguous conditions unsupported and all old packs immutable.
- [ ] Produce a documented service-scope proposal with exact affected roads/requests; keep municipal boundary, source context and district assignment distinct. Do not assign gaps to the nearest district.
- [ ] Produce an acceptance envelope listing all actual gate outcomes. Required independent human observations cannot be generated by an agent.

## Task 3: Vehicle and curb/depot readiness

**Files:** source research under `build/fleetlab-city/research/vehicle-curb-r1/`, versioned parameter/scenario contracts and focused tests, updated vehicle-concept/learning UI only when backed by installed behavior.

- [ ] Audit primary public sources for measured/claimed energy, charging, dimensions, dwell and SF loading-zone geometry; capture provenance and redistribution terms.
- [ ] Separate manufacturer/reference facts from model-ready inputs. Missing battery-side curves, service times and maneuver permissions stay unavailable.
- [ ] Implement bounded anonymous sensitivity or maneuver teaching models only where the question, input semantics and validation fixtures are defined; preserve explicit synthetic labels and distinct model identity.
- [ ] Prepare the next California municipality/source contract with explicit boundary and experiment scope. Do not call a city qualified from data availability alone.

## Task 4: Device and real-person validation

**Files:** `docs/FLEETLAB_SF_VALIDATION_SESSION.md`, evidence in `build/fleetlab-city/validation/sf-completion-r3/`.

- [ ] Recheck authorized Pixel and test observable unlocked device behavior; no lock bypass. Record keyboard, responsive viewport, touch, zoom, playback, enlarged text and screen-reader coverage separately.
- [ ] Provide five-person comprehension worksheet with open question first and a second-scorer rubric. Record real answers only; pending responses remain NOT_RUN.
- [ ] Bind independent map-review observations to frozen candidate requirements; no agent-generated human attestations.

## Task 5: Integrate, validate and publish

**Files:** viewer projections/UI, `package.py`, combined-stage tool, source offer and canonical handoff/release documents.

- [ ] Complete model/contract tests and immutable evidence checks; review all new modules and scientific claims.
- [ ] Build fresh viewer with only compatible available studies and honest incomplete states; check size/file/dependency budgets.
- [ ] Preserve root/offline baseline; retain preceding complete City viewer. Test browser routes, controls, diagrams, all original content and rollback.
- [ ] Publish preview, compare every served payload and effective header to the local stage, then publish that same stage to production and repeat readback.
- [ ] Update final handoff with completed evidence and specific remaining external requirements. Advance Austin/Las Vegas only if the SF acceptance gate is satisfied.

## Execution decisions

The current user explicitly authorizes implementation, testing and static-site publication. This plan does not add another general approval checkpoint. The documented memory revision is accepted within that instruction; original evidence and limits are retained. Public/static-site authorization does not authorize physical systems or fabricated human/data validation. The existing linked feature worktree is already isolated; unrelated owner files remain untouched.
