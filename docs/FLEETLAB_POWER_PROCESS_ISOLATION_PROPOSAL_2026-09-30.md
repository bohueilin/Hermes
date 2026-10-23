# SF power study — process isolation proposal

**October 4 accepted scope:** [SF acceptance closure](FLEETLAB_SF_ACCEPTANCE_2026-10-04.md) is the current milestone. Static release and Git updates are authorized; Austin and new scientific execution are deferred. See the [current release record](FLEETLAB_SF_CLARITY_RELEASE_2026-10-04.md). Older proposal language below is historical, not approval.

**October 4 decision review:** read [the October 4 handoff](FLEETLAB_HANDOFF_2026-10-04.md)
before approving this historical proposal. The owner has requested alignment on
resource purpose, runtime and SF/Austin dependencies. No production requirement
for 4 GB was established; the categorical rejection of a disclosed larger-budget
revision below is no longer the current recommendation. Per-arm isolation and
the 251-arm ceiling remain unapproved. The handoff compares a larger-budget warm
workflow with isolation; no new policy, implementation, freeze or run is implied.

30 September 2026. **Proposed amendment; no new scientific execution authorized
or performed.** The one-time fresh-process retry of `sf-power-headroom-v1-r2`
has already been consumed. This proposal does not resume it or replace its
failed ledger. The user goal remains finish SF and deploy, then complete Austin.

## Decision and reason

Recommend a new named instance, **`sf-power-isolated-v1-r3`**, with a fresh
process for each arm. Preflight analysis and final evaluation analysis also run
in separate processes. The lightweight supervisor holds identities and small
status records, never a routing graph or raw recordings. All twelve frozen
scientific source files remain unchanged. New orchestration code will have its
own version, tests, review and source hashes before the new protocol is frozen.
Process isolation adds repeated map/router setup and disk I/O. Total execution
time is not yet qualified; the proposal prioritizes preserving the memory limit
over reusing a warm process. The arm ceiling is not a runtime guarantee.

The alternative is to retain the power study as incomplete. Increasing limits,
resuming the old evaluation, replacing selected cells, shrinking demand or
changing the simulator/map are rejected: they would change the approved
experiment or hide the resource failure.

The prior retry completed `7304001-a-200` with a valid recording, then stopped
at **4,046,569,472 bytes**. The process had performed complete preflight analysis
before capturing the execution graph and preparing its route tables. Lifetime
fixes removed references, but allocator/process state still carried through.
This supports testing process separation. It does not establish that retained
allocator memory was the only cause, or that every future arm will fit.

## Measured read-only qualification

The disposable probe uses the existing immutable r2 map, protocol, tapes and
recordings. Simulator entry points are replaced in that probe process with a
function that raises; its self-test checks the guard. It performs no engine
execution, creates no new arm and writes nothing into a study directory.

It validates the full frozen capture, prepares the unchanged router, then fills
every pair of the 220-node pool. All initial, request and depot nodes are in that
pool. This covers the possible cache keys for these frozen tapes without
running dispatch. It then freshly verifies and canonically serializes two
existing recordings: the stopped evaluation arm and the largest existing
preflight JSON by byte size (`7303004-a-400`, selected by that explicit resource
criterion, not its operational outcome).

| Stage | Process peak bytes |
|---|---:|
| Full frozen capture | 1,487,912,960 |
| Prepared router | 1,849,245,696 |
| All 48,400 route pairs; 48,180 cached nonidentical pairs | 2,205,155,328 |
| Verify/serialize retained evaluation recording | 2,591,703,040 |
| Verify/serialize largest retained preflight recording | **2,736,013,312** |

The complete diagnostic took **26.206 seconds** and left **1,263,986,688 bytes
(31.60%)** below the unchanged process limit. Actual route arrays total
492,798,240 bytes, below the 2 GB routing-table limit. The route population
contains 47,308 nonempty routes, 872 unavailable pairs and 220 zero-length pairs;
none was removed to improve coverage. Both stored verification results and
canonical run bytes reproduce. All 167 protected study/map files and twelve
scientific sources remained byte-identical, with their filesystem identities
also checked after computation.

Evidence: `build/fleetlab-city/research/power-isolation-20260930/`.
`read-only-probe.py` is a retained disposable diagnostic, not the production
executor. `cold-r1/report.json` binds the stage measurements, source identities,
all protected-file hashes and exact records. The final resource measurement
does not include future engine allocations, different event populations or
production-worker overhead. Future execution remains unproven and must retain
the stop rules. Do not describe this as a completed study or an execution pass.

## Proposed immutable scientific contract

| Field | Proposed value / preserved constraint |
|---|---|
| New study ID | `sf-power-isolated-v1-r3` |
| Predecessor protocol | `9a738e81dec4c14b1b6e2a000cb1c4cf4833a005445e1b3e1e9caddb57ceaa3a` |
| Predecessor disposition | Resource-stopped; one recorded evaluation arm and 143 NOT_RUN; never pooled into the revision |
| New preflight seeds | `7305001`–`7305004`, six arms per seed = **24 arms** |
| New evaluation seeds | `7306001`–`7306024`, six arms per seed = **144 arms** |
| Evaluation pass | Exactly one; only after complete compatible preflight and fresh analysis |
| Scientific model/map | Original frozen v1 model and graph, explicitly diagnostic/unqualified |
| Fleet/demand/horizon | 100 vehicles; 1,200 requests per tape; 8 hours; same 220 nodes and A/B sites |
| Resource cells | A, A+B and B at 200/400 kW; eight total ports; 50 kW per port; four turnaround slots |
| Energy/control policy | Original 30 kWh initial and 48 kWh target, reserve/return thresholds, dispatch and turnaround assumptions unchanged |
| Primary | `(AB400 − A400) − (AB200 − A200)`, seed-paired completion percentage points |
| Analysis | Original fixed 24-block, 95% paired Student t interval; ±1 pp practical band; no optional stopping |
| Limits | 4,000,000,000 bytes per process; 2,000,000,000 route-table bytes; no increase |
| Authority | SIMULATION_ONLY; NOT_AUTHENTICATED; deployment/operational authority NONE |

The proposed seed blocks were declared before execution. A fresh structured
scan found no collisions in the repository's existing scenario tapes or
experiment/protocol seed registries. The report is `proposed-seed-scan.json`.
Repeat that scan immediately before freezing; a conflict stops the freeze and
requires an explicit replacement declaration before results are generated.
These numbers are currently proposed, not materialized frozen tapes or completed
experiments. Numeric disjointness is not proof of stochastic independence.

The campaign accounting is explicit: 34 historical reproduction arms, 24
original-study preflight arms, 24 r2 preflight arms and one r2 evaluation arm
have been recorded: **83 existing arms**. Adding 24 new preflight and 144 new
evaluation arms gives a maximum of **251**, compared with the previous 226-arm
ceiling. Previously unused evaluation tapes remain retained; no existing result
is replaced or silently pooled.

## Required implementation and verification before any new run

1. Add versioned orchestration beside the frozen source files. Do not patch the
   old protocol generator or analyzer in place, or monkey-patch scientific
   functions in the production executor. The new protocol binds the original
   science, new supervisor/worker sources, complete input tapes and predecessor.
2. Use one sequential fresh worker per arm. The worker independently captures
   the frozen protocol/map/tape, prepares its router, calls the unchanged engine
   and verifier, and writes a new immutable bundle. The supervisor retains only
   the bounded summary and child identity. No overlapping arm processes.
3. Verify actual scientific output parity on small deterministic fixtures,
   process separation, source/tape mutation refusal, child failure, missing or
   malformed output, over-limit reports, partial bundle preservation, exact
   ordered schedule and no automatic retry. Verify complete-block analysis and
   rejection of incomplete populations through the new capture interface.
4. Preserve every launch attempt and terminal status. A child crash, invalid or
   partial record, hard violation, incompatibility, source mutation or resource
   stop ends the stage. Any bundle written before failure remains diagnostic;
   it cannot make a stopped stage complete. No replacement seed/cell is run.
5. Run existing regression gates and one independent review of the complete
   change. Retain every earlier failure. Only after approval and those gates may
   a new immutable protocol/tape directory be frozen and executed.
6. After complete evaluation, perform fresh analysis in a separate process and
   integrate its compatible results with the existing site. A partial result
   stays partial. Preserve all original FleetLab content and old study evidence;
   use the established combined-site preview/production readback workflow.

The worker implementation and its final source hashes are not yet available.
This is a measured implementation/execution proposal, not a claim that an
untested executor is ready. Approval covers the specified design and bounded
budget; it does not waive implementation tests, review, scientific integrity,
resource limits or any city-acceptance gate.

## Scope boundary and decision needed

This repair does not adopt the administrative boundary proposal, supply a source
license, create human observations, calibrate named vehicles or qualify SF.
The original power study uses its original graph intentionally; switching it to
the temporal candidate would change the experiment. SF map/device/visitor work
remains a separate requirement before Austin.

Approval is required by the accepted final proposal's rule that a repair/rerun
uses a new named study, and by the r2 protocol stop rule: **“no replacement
seeds/cells; repair requires a new named study.”** The previously approved
one-time retry has been consumed. This proposal asks for a new declared study
and a larger total campaign ceiling, not a second use of that approval.

**Recommendation:** approve the specified process-isolated revision, with
implementation review and successful preflight required before its evaluation.

**Top risks + mitigations:** read-only memory headroom is not an execution
guarantee; preserve measured stop rules and all failures. Cold workers must not
change scientific behavior; verify parity and keep science bytes unchanged.
An exploratory result on an unqualified map cannot establish an operator,
regulatory or safety recommendation; retain those limitations in the UI.

**Next 3 actions:** obtain the revision/budget decision; implement and review
the isolated execution/analysis path; freeze and run only the approved schedule,
then validate and publish its actual complete or incomplete result.
