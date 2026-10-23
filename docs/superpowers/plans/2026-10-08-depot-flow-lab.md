# Depot flow lab implementation plan

> For agentic workers: execute inline with the executing-plans skill. The owner approved building after the October 8 proposal and ChatGPT review.

**Goal:** Ship a reviewable first Network Flows lesson: two invented depot visits, three upload rules, exact reproducible readiness outcomes and independently checked records.

**Architecture:** Isolated integer event model → accepted allocation ledger → independent read-only verifier → comparison eligibility → accessible static UI. The UI never supplies verification or policy authority.

**Tech stack:** Existing dependency-free browser JavaScript, Node test runner, existing hosted/offline packer. No solver or new runtime dependency.

**Spec:** October 8 Network Flows proposal, with the corrections recorded below. Earlier proposal status is historical; the current user instruction authorizes this implementation. SF qualification and recorded studies remain unchanged.

## Accepted ChatGPT review decisions

- Terminate a faulty policy arm as `policy_error`, preserving partial diagnostics. Never silently clamp or retry allocations. Withhold the new comparison even when prior intervals pass conservation.
- Use safe bounded integer seconds, useful bytes, bytes/s, joules and joules/s. Reject unsupported precision and no-progress schedules. Completion and zero-work dependencies settle before deadlines.
- Verify service intervals and task completions independently; do not trust producer totals or a producer PASS. Keep execution status, policy status, validity and comparison eligibility distinct.
- Add individual ideal earliest-readiness lower bounds. A bound beyond a deadline proves individual impossibility in this model; a bound within it does not establish joint feasibility.
- Explain the size/urgency confound: B is both smaller and earlier due. This does not isolate why earliest-deadline ordering helps. Equal sharing is a full baseline.
- Distinguish last finished task, dependency path and the value of added capacity. The last requires a matched intervention; no automatic winner or operational recommendation.
- Keep the next milestone (NF-02 + NF-03 + one size-uncertainty stress) as a proposed study. Work classes, data deadlines/backlog, fairness by visit, solver formulations and solver version claims remain future work. No unused solver dependencies.

## Global constraints

- Preserve all prior pages, model contracts, SF traces, qualification HOLD and the Overview animation. No new city.
- Scope: `SIMULATION_ONLY`; evidence `NOT_EVIDENCE`; authenticity `NOT_AUTHENTICATED`; authorization `NOT_EVALUATED`; authority and operational deployment permission `NONE`.
- Default fixture `/2`: A 75 GB, 6 kWh, due 900 s; B 7.5 GB, zero energy, due 300 s. Both arrive at zero, post-upload step 120 s. Preserve `/1` 10 kWh fixture.
- Selectable uplink 1/0.5 Gbps, B upload 7.5/15/45 GB, charger 60/20 kW. Prospective common horizon for all rules in each configuration. No randomness.
- Optional guess stays in page memory; Run never requires it. Results only after Run. Changes, cancellation, invalid input and policy errors cannot inherit an earlier favorable result.
- Captions, headers, named scroll regions, text task histories, exact event inspection, 44 px controls, readable typography, no page overflow at 320 px. DOM checks do not establish human accessibility qualification.
- Building a local package is separate from publishing it. Prepare a concrete integrated preview and release evidence before any required publication decision; never replace the root with a teaching-only package.

## Review focus

Numerical boundaries, zero-work ordering, independent verifier mutations, stale result isolation, routes/catalog preservation, offline size and integrated-host preservation.

### Task 1: Bounded event model and independent verification

Files: new `playground/fleetlab/src/model/depot-flow.js`, `depot-flow-verify.js`, `test/depot-flow.test.mjs`.

Contract: `flowScenario(options)`, `simulateFlow(scenario, rule, options)`, `verifyFlow(record)`, `runFlowComparison(options)`; immutable input snapshot, bounded ledgers, separate status fields. Policies receive current observations only. Verifier reconstructs allocations and completions without producer helper imports.

Write literal default/variation tests first, then 36 configurations and original fixture; add equality, zero work, horizon censoring, overflow, malformed allocation at zero/mid-service and mutation tests. Run `node --test playground/fleetlab/test/depot-flow.test.mjs`.

### Task 2: Accessible lesson and lifecycle

Files: new `src/ui/depot-flow-lab.js`, `test/depot-flow-ui.test.mjs`; existing stylesheet.

Input board, three rule definitions, optional guess, Run/Cancel, simultaneous outcomes, individual lower bounds, static timelines with semantic tables, exact event cursor, task/wait histories, checks and JSON export. Inject scheduling/run functions for lifecycle tests. Keep completed prior results and partial new diagnostics separately labeled.

Run focused UI tests for pre-run state, default results, changed inputs, cancellation, supersession, verifier rejection, route departure/disposal, captions and exports.

### Task 3: Additive site integration

Files: routes, studio, catalog, teaching frames, root index metadata, hosted integration copy/CSS; focused integration tests.

Add Depot flow lab peer navigation, Overview decision card, catalog item/model/filter and Fleet day contextual links. Use count-free model copy. Preserve unknown-route handling and all existing pages. Test direct lesson route, navigation and catalog routing. Check navigation layout at desktop and phone widths.

### Task 4: Build and validate review packages

Run relevant teaching/City/Hermes regression gates, offline and hosted packaging/checks. Verify new UI in real browser at wide, intermediate and phone widths, keyboard paths and reduced motion. Extend the integrated-site preservation contract with a precise reviewed module allowlist only if necessary; preserve city release bytes. Record failures honestly and fix affected implementation.

### Task 5: Final review and handoff

Obtain a fresh scoped code review after implementation as required by executing-plans, fix important findings, rerun affected tests. Record actual results, package paths, Git/publication state and residual human qualification limits in `docs/FLEETLAB_NETWORK_FLOWS_HANDOFF_2026-10-08.md`. Prepare the exact next NF-02/03 study questions without running it.
