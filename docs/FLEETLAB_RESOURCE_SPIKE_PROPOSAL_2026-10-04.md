# SF runner resource spike — proposal, 4 October 2026

**NOT_AUTHORIZED / NOT_EXECUTED.** This is optional research after the current
SF presentation/acceptance-preparation release, not an r3 freeze or permission
to resume r2. See the [Oct 4 handoff](FLEETLAB_HANDOFF_2026-10-04.md) for retained
measurements and projection assumptions. No new engine arm or tape was created
for this proposal.

The near-term requirement is reliable execution on the local research machine,
not parity with unobserved SF production nodes. The old ceiling is
**4,000,000,000 decimal bytes**, not 4 GiB or a reserved container allocation.
64 GiB installed memory does not establish available memory. Neither 8 GB nor
another new ceiling is approved. Keep old failure evidence and frozen limits intact.

The 26.206 s probe included capture/router setup, a full route-cache sweep and
two stored-record verifications. It executed no engine and was not a pure
startup measurement. The previous approximately 37-minute warm and 67–85-minute
isolated cases are projections, not observed complete workloads. Logical file
reads do not establish physical I/O contention because the OS may cache them.

## Smallest useful future comparison

| Design | Reuse boundary | Question |
|---|---|---|
| Warm sequential executor; separate analysis process | Reuse graph/router over successive six-cell blocks | Does memory plateau or grow across arms, and does separating analysis avoid the old combined peak? |
| One process per complete seed block | Six cells in order; worker exits after the block | Does bounded reuse retain most of the setup benefit with acceptable peak and clean release? |
| One process per arm; separate analysis | Worker exits every cell | How much time/I/O buys the most predictable release of memory? |

Proposed **maximum 36 non-evaluation arms**: two already frozen preflight input
tapes × six cells × three designs, in separate new outputs. Preflight inputs
have seen outcomes and are suitable only for resource/parity measurements, not
statistical confirmation. Before any future authorization, bind exact tape and
source digests, fixed six-cell ordering, design order and named output roots in
a short measurement manifest. Exclude all evaluation seeds, including r2's
remaining inputs and the unapproved r3 seeds. No new tape generation is needed.

For each design, measure initialization, engine, verification, serialization,
worker teardown and separate analysis. Record monotonic wall and CPU time;
sampled current RSS and OS peak RSS; parent and child process-tree memory with
shared-memory double-counting caveats; per-cell retained RSS after output objects
are released; page faults, swap pressure, physical read/write bytes where the OS
exposes them; logical input/output bytes; output footprint and free disk before
and after. Report sampling frequency, units and limitations. Keep one executor
at a time; no concurrent browser build or scientific workload during measurement.

Before starting, explicit bounded authorization must set a **spike** memory
guard, maximum 36 arms, wall-clock cap and minimum free-disk reserve based on
current available resources. These values are currently unset, so execution
cannot begin. A spike guard is not the future evaluation ceiling. Abort the
whole spike on guard breach, memory pressure, verifier/parity failure or resource
measurement failure. Preserve every partial record. No automatic retry, adaptive
ceiling increase or replacement input. If a design stops, record it as incomplete
and compare only the evidence actually obtained.

## Selection and later freeze

Verify deterministic event/metric output parity against the same known preflight
inputs and scientific source contract. Distinguish execution metadata from
scientific bytes; declare the comparison before inspection. Analyze retained
records in fresh processes so analysis cannot inflate executor peaks.

Prefer warm execution if both six-cell blocks finish within the approved spike
guard, per-cell retention plateaus within a predeclared tolerance, and parity
holds. Prefer seed-block workers if memory accumulates across blocks but stays
bounded within a block. Use per-arm isolation if within-block retention or peak
makes reuse unreliable. Two blocks can expose growth; they cannot prove a
24-block plateau. If evidence is insufficient, require a separately authorized
bounded extension or choose the measured isolation boundary; do not extrapolate
unlimited safe reuse. Choose the lowest-overhead design satisfying the explicit
resource and parity criteria, not the fastest incomplete run.

A later evaluation ceiling should cover the measured worst relevant phase and
process tree plus a documented margin, while leaving measured host headroom for
the OS and other work. Freeze the exact margin, limit, measured accounting method,
execution granularity and stop rules **before** evaluation. Preserve an honest
distinction between measured limits and OS-enforced limits. Budget and design
approval, engineering implementation/tests and scientific protocol approval are
separate steps; this proposal grants none of them.

The scientific estimand remains `(AB400 − A400) − (AB200 − A200)` in completion
percentage points, with **24 paired seed blocks** as replication units. A
completed study may remain inconclusive. It cannot qualify the temporal map,
calibrate operator performance or close physical/device/visitor acceptance.

**Recommendation:** measure warm execution with separate analysis first as a
candidate, compare all three designs within one explicitly bounded spike, then
choose granularity and memory from observed behavior.

**Top risks + mitigations:** peak undermeasurement → phase and process-tree
metrics; outcome reuse becoming confirmation → preflight-only resource purpose;
new failures being hidden → append-only failure records and no automatic retry.

**Next 3 actions:** approve a bounded spike manifest when desired; execute and
review resource/parity measurements; separately decide whether to freeze a new
evaluation. None is needed to publish the current SF clarity improvements.
