# Phase 8 WP-4 — `RunMetricsV3` migration-pricing design note

**Status:** design/pricing only; no V3 implementation is authorized in Phase 3

**Audited tree:** `70599a7d7c0afb7e76fa4921ba255497e19326c4`

**Governing contract:** Phase 8 PRD §0-A.6 and §12; §0-A amendments are normative

## 1. Decision and non-goals

`RunMetricsV3` is not a metrics-file-only addition. Evidence versions are bundle-wide, and the
current verifier rejects mixed versions. A truthful V3 therefore requires coordinated V3 models
for metrics, run context, execution context, events, manifest, and findings, plus producer,
verification, review, comparison, workbench, CLI, and agent-tool support.

This note only prices that migration. It does **not**:

- add or change a Pydantic model, evidence schema, scenario schema, verifier, gate, threshold,
  policy, adapter, trace, fixture, or artifact;
- rewrite or rebaseline historical evidence;
- resolve the deferred multi-actor observation contract from WP-2;
- claim simulator evidence as real-vehicle safety, certification, or production validation; or
- edit this branch's deliberately stale `HERMES_SOURCE_OF_TRUTH.md`.

### Recommendation requiring owner approval

1. Allocate evidence schema **3.0** to the PRD's normative `RunMetricsV3` plus typed ADAS event
   evidence. WP-2 also reserved 3.0 for a future actor roster
   (`PHASE8_WP2_COMPOSITE_SCENARIO_DESIGN_NOTE.md:129-142,300-316`). Move that unresolved roster
   contract to evidence V4 unless the owner deliberately combines both migrations. Combining them
   would block metrics on a separate, unresolved multi-actor identity decision.
2. Use one unified ADAS V3 shape for both ADAS profiles. Today no-fault ADAS emits evidence V1,
   while faulted ADAS emits V2. A naïve `V3(V2)` inheritance chain would make a fault identity
   mandatory for a no-fault run. Instead, require V2-style raw/delivered/result observation and
   permitted/executed action evidence on every V3 event; emit truthful pass-through evidence when
   no fault is configured; and make context/manifest fault identity all-or-none, present exactly
   when `scenario.faults` is present.
3. Dispatch by the declared evidence schema (or exact model type), never by broad base-class
   `isinstance` tests. Shared mechanics may use a base protocol, but schema selection may not.
4. Issue review schema 2 for evidence V3 while preserving review schema 1 for V1/V2. The PRD
   requires every §12 metric to enter the direction/tolerance/criticality registry and the V3
   comparison/workbench change. Issue a versioned core comparison schema 2 and review-comparison
   schema 2 rather than silently changing their current V1 shapes. The owner chooses the approved
   formulas and version transition, not whether the normative metrics participate.

All four recommendations remain owner decisions. No implementation should begin until they and the
unresolved metric contracts in §5 are frozen.

## 2. Binding target from the PRD

The binding parts of the target are:

- evidence schema is `"3.0"` across the complete bundle;
- `RunMetricsV3` is a typed schema, not an open dictionary;
- typed function submodels exist for `adas.fcw`, `adas.aeb`, `adas.acc`, `adas.lka`, and
  `adas.assist`, with flat snake_case fields inside each submodel;
- every metric that can be undefined uses an availability-wrapped typed measurement with a reason
  and unit rather than a sentinel or fabricated zero; legacy finite-float values can reuse
  `Measurement`, while counts/booleans need integral/boolean wrappers;
- `TraceEventV3` retains the authoritative per-step hash chain and adds typed warning,
  intervention, mode, and brake-source evidence;
- AEB metrics count only AEB-attributed braking;
- TTC is undefined when closing speed is not positive, and ACC headway is undefined below 1 m/s;
- `ttc.minimum_s` maps to existing `minimum_ttc_s`; control saturation maps to separate steering
  and brake counts; V3 jerk has explicit lineage to current `max_abs_jerk_mps3` but not identical
  semantics; observation age is expressed in seconds; and
- comparison dimensions and workbench support land in the same gated change as V3.

The current ordinary simulation bundle has an exact ten-file inventory. `adas-config.resolved.yaml`
need not be added because the controller's complete `evidence_config` is already stored and
digest-bound in `execution-context.json`. The normative PRD nevertheless requires
`agent-trace.jsonl` plus `agent-report.json` when agents ran, and `telemetry.parquet` for
failure-mining/regression runs. V3 therefore needs an approved artifact-profile/use-case inventory:
ten base files for an ordinary run, the two agent files when applicable, and telemetry when
applicable. `required_files`, `file_digests`, capture limits, exact extra/missing-file rejection,
comparison compatibility, and workbench readers must all bind the selected profile. Under today's
single global inventory, even a normatively required “optional” file invalidates the bundle.

## 3. Six coordinated V3 model families

The plan's six-pair count remains correct on the post-WP3 tree.

| Family | V1 / V2 definitions | Required V3 responsibility |
|---|---|---|
| Metrics | `RunMetrics` / `RunMetricsV2`, `src/hermes/domain/models.py:619,644` | Typed common/system metrics and all five ADAS function submodels. |
| Run identity | `RunContext` / `RunContextV2`, `:656,677` | Bind schema 3 into every event; make fault identity all-or-none. |
| Execution identity | `ExecutionContext` / `ExecutionContextV2`, `:703,714` | Preserve complete policy, shield, verifier-suite, and optional fault identity/config. |
| Per-step evidence | `TraceEvent` / `TraceEventV2`, `:722,744` | Preserve V2 provenance, add typed ADAS decision and brake attribution, remain hash-chained. |
| Manifest | `ArtifactManifest` / `ArtifactManifestV2`, `:755,811` | Identify schema 3, bind optional fault identity consistently, retain exact inventory/digests. |
| Findings wrapper | `FindingsDocument` / `FindingsDocumentV2`, `:820,827` | Carry schema 3 even if the individual `Finding` model remains unchanged. |

The six V3 types need not inherit V2 mechanically. Shared mixins/protocols are safer where V2's
required fault fields conflict with no-fault V3. What matters is one canonical V3 shape and exact
version dispatch, not an inheritance aesthetic.

## 4. Dispatch and construction impact map

### 4.1 Four literal verification maps, plus event parsing

`src/hermes/evidence/verification.py` has four version-to-class maps that currently accept only
1.0 and 2.0:

| Stored document | Current dispatch |
|---|---|
| `manifest.json` | `verification.py:1048-1052` |
| `execution-context.json` | `verification.py:1093-1096` |
| `metrics.json` | `verification.py:1097` |
| `findings.json` | `verification.py:1098-1101` |

`_parse_versioned_model` (`:233-267`) is already generic. The fifth closed dispatch is the manual
event parser at `:486-530`; it must add `TraceEventV3` while retaining canonical-line,
run-context-version, size, count, and unknown-version checks.

### 4.2 The `isinstance` trap is wider than metric computation

| Surface | Current sites | V3 failure if unchanged |
|---|---|---|
| Artifact writer | `evidence/artifacts.py:202-207,254-263` | `ExecutionContextV3(ExecutionContextV2)` silently emits V2 findings and manifest wrappers. |
| Artifact inventory | `evidence/artifacts.py:39-52`; `evidence/verification.py:358-373,1123-1126` | One global exact file tuple cannot express the PRD's conditional agent and telemetry profiles; required files would be rejected as extras. |
| Metric computation | `evidence/metrics.py:134-146,161` | `TraceEventV3(TraceEventV2)` follows the V2 branch and drops every V3 metric. |
| Producer | `runtime/orchestrator.py:185-288,384-476,594-610` | Fault presence, not ADAS evidence capability, chooses V1/V2 construction and verifier event tuple. |
| Trace type/semantics | `evidence/trace.py:24,527-534,610-618,659-676,760,875-884,912-915` | `TraceEventLike` omits a standalone V3; exact `"2.0"` branches send V3 through legacy semantics; continuity/base checks can accept or reject the wrong shape. |
| Stored snapshot/replay | `evidence/verification.py:104-110,575-603,686-690,1197-1205,1288-1300,1338-1385` | Snapshot/document unions omit standalone V3; V3 is misclassified during fault replay, manifest checks, profile correction, event filtering, and expected-findings wrapping. |
| Verifier routing/types | `verifiers/__init__.py:103,143,192,224,315-328,331-452`; `verifiers/adas.py:107-118,481-492` | Event tuple annotations and profile routing assume legacy/V2 shapes; standalone V3 can be rejected or routed through the wrong oracle view. |
| Agent tools | `agents/tools.py:131-141,341-389,422-464` | WP-3 stale-observation replay parses only V2; V3 would silently lose its causal proof and nested metric citations. |

The fix is an explicit per-schema registry or an exact V3-before-V2 dispatch at every selection
boundary. Tests must assert the **exact returned class**, not merely `isinstance(..., V2)`.

`compute_metrics(events)` is also a closed API, not just a type annotation. Config-relative fields
(false/missed events, required windows, function-enabled availability, ACC target headway, and gate
oracle values) cannot be independently recomputed from events alone. The owner must choose one of
two explicit contracts: (a) pass canonically resolved scenario, gate, and execution context into a
pure computation, changing callers in `runtime/orchestrator.py:594`,
`evidence/verification.py:1338`, and `verifiers/__init__.py:103,143,192,224`; or (b) add the exact
oracle/applicability facts to typed V3 events and independently verify those facts from the resolved
inputs. Copying heterogeneous `Finding.measurement` values into metrics is not an alternative.

### 4.3 Runtime evidence seam and attribution

`AdasDecision` already contains typed warning, intervention, mode, brake source, TTC, required
deceleration, and reasons (`src/hermes/adas/interfaces.py:122-133`). The runner currently persists
only `Action` and does not read the policy's last decision (`runtime/orchestrator.py:360-404`). V3
needs a protocol-safe evidence capability exposed by a policy interface; it must not import or
special-case the concrete ADAS policy class.

A single unqualified `brake_source` field is insufficient:

- the scripted driver or ADAS function produces the candidate action;
- the deterministic shield can change the permitted brake; and
- a control-delay fault can execute an action from an earlier permitted sequence.

The V3 design must distinguish candidate, permitted, and executed attribution, or store enough
typed source data to derive and verify all three. Executed attribution must follow
`ControlFaultEvidence.executed_from_sequence`; a shield attribution must be justified by the exact
candidate-to-permitted change. Offline verification must replay both the action and attribution.
Warning/intervention/mode are input-time policy outputs; result geometry is post-step. Their clocks
and observation views must never be conflated.

## 5. Proposed 47-metric contract matrix

This matrix covers the PRD body's 44 display metrics plus three normative additions. It is a
**proposal and decision ledger**, not a frozen schema. `TBD` in either tolerance column is an
intentional owner decision: the PRD requires absolute and relative materiality tolerances for every
metric but does not provide them. `M` means the existing numeric `Measurement`; `AV[T]` means a new
generic availability wrapper. The existing `Measurement.value` accepts any finite float, so it
cannot truthfully type a count or boolean: V3 needs an integral `CountMeasurement` (`CM`) and a
`BooleanMeasurement` (`BM`), or an equivalent generic `AvailableValue[T]`, without changing the
legacy `Measurement` contract. Whether to add those wrappers or rename a boolean into a numeric
count/flag is an owner decision; fractional counts must be rejected.

### 5.1 Common longitudinal safety (7)

| PRD display | Proposed canonical field | Type | Unit | Availability and authoritative source/formula | Direction | Abs tol | Rel tol | Criticality / gate linkage | Status |
|---|---|---|---|---|---|---|---|---|---|
| `collision.count` | `collision_count` | int | collisions | Always; maximum result `vehicle_state.collision_count` (existing). | lower | TBD | TBD | Critical; `collision.zero` HOLD path. | Binding reuse. |
| `collision.occurred` | `collision_occurred` | bool or `AV[bool]` | none | Derived from `collision_count > 0`; redundant with count. | false preferred | TBD | TBD | Critical; same collision invariant. | Owner: retain redundant field and availability type. |
| `ttc.minimum_s` | `minimum_ttc_s` | M | s | Result-view paired closing front geometry; unavailable with no paired closing evidence (existing lineage). | higher | TBD | TBD | Safety indicator; exact criticality TBD. | Binding name; preserve result view. |
| `ttc.at_warning_s` | `ttc_at_warning_s` | M | s | Delivered-input TTC at first non-`NO_WARNING` V3 policy output; unavailable if no warning or TTC undefined. | descriptive | TBD | TBD | Warning-timing linkage; criticality TBD. | Proposed; input view must be frozen. |
| `ttc.at_brake_onset_s` | `ttc_at_brake_onset_s` | M | s | Delivered-input TTC at first executed AEB-attributed positive brake onset; unavailable without such onset or closing TTC. | descriptive | TBD | TBD | AEB timing linkage; criticality TBD. | Proposed; onset edge/attribution owner approval. |
| `impact.residual_speed_mps` | `impact_residual_speed_mps` | M | m/s | Ego result speed at first collision-count increment; unavailable when no contact occurs. | lower | TBD | TBD | Critical in severity-reduction cases; calibrated gate threshold remains separate. | Proposed contact edge; owner approval. |
| `distance.minimum_lead_m` | `minimum_lead_distance_m` | M | m | Minimum result-view in-path front gap; unavailable when no in-path lead is observed. | higher | TBD | TBD | Safety indicator; exact criticality TBD. | Proposed. |

### 5.2 FCW submodel (5)

| PRD display | Proposed canonical field | Type | Unit | Availability and authoritative source/formula | Direction | Abs tol | Rel tol | Criticality / gate linkage | Status |
|---|---|---|---|---|---|---|---|---|---|
| `fcw.warning_count` | `adas.fcw.warning_count` | CM | warnings | Count warning onset edges in typed V3 warning output; unavailable when FCW is disabled. | descriptive | TBD | TBD | Coverage/timing; criticality TBD. | Proposed. |
| `fcw.first_warning_time_s` | `adas.fcw.first_warning_time_s` | M | s | Input event time of first warning; unavailable with FCW disabled or no warning. | descriptive | TBD | TBD | Timing; exact threshold comes from scenario/gate oracle. | Proposed. |
| `fcw.false_warning_count` | `adas.fcw.false_warning_count` | CM | warnings | Warning onset during oracle-labeled threat-free intervals; unavailable without applicable nominal exposure. | lower | TBD | TBD | Oracle-relative; gate criticality TBD. | Owner: shared oracle summary and applicability. |
| `fcw.missed_warning` | `adas.fcw.missed_warning` | BM | none | No warning in a scenario-authored, oracle-verified required window; unavailable when warning is not required. | false preferred | TBD | TBD | Required-warning failure; exact class TBD. | Owner: boolean availability representation. |
| `fcw.warning_chatter_count` | `adas.fcw.warning_chatter_count` | CM | transitions | Count warning re-entry edges inside a frozen hysteresis/chatter window; unavailable if FCW disabled. | lower | TBD | TBD | Quality/comfort; criticality TBD. | Owner: chatter window/formula. |

### 5.3 AEB submodel (8)

| PRD display | Proposed canonical field | Type | Unit | Availability and authoritative source/formula | Direction | Abs tol | Rel tol | Criticality / gate linkage | Status |
|---|---|---|---|---|---|---|---|---|---|
| `aeb.intervention_count` | `adas.aeb.intervention_count` | CM | interventions | Count AEB-attributed executed-brake onset edges; unavailable when AEB disabled. | descriptive | TBD | TBD | Context-dependent; false/missed split below. | Proposed. |
| `aeb.first_intervention_time_s` | `adas.aeb.first_intervention_time_s` | M | s | Input/execution time contract at first AEB-attributed onset; unavailable with no AEB intervention. | descriptive | TBD | TBD | Brake timing; criticality TBD. | Owner: input versus execution clock. |
| `aeb.max_deceleration_mps2` | `adas.aeb.max_deceleration_mps2` | M | m/s^2 | Maximum measured ego deceleration over executed AEB-attributed intervals; unavailable without AEB execution. | descriptive | TBD | TBD | Feasibility/comfort; not the configured authority. | Owner: interval boundary and sign/filter. |
| `aeb.max_jerk_mps3` | `adas.aeb.max_jerk_mps3` | M | m/s^3 | Central difference/derivative of filtered acceleration only over AEB-attributed intervals; unavailable without enough samples. | lower | TBD | TBD | Comfort/emergency allowance; exact class TBD. | Owner: filter, window, endpoints. |
| `aeb.false_intervention_count` | `adas.aeb.false_intervention_count` | CM | interventions | AEB onset during oracle-labeled threat-free intervals; unavailable without nominal exposure. | lower | TBD | TBD | Hard failure/HOLD for threat-free false intervention. | Binding oracle concept; shared-summary design TBD. |
| `aeb.missed_intervention` | `adas.aeb.missed_intervention` | BM | none | No AEB onset inside a scenario-authored, oracle-verified required window; unavailable when AEB is not required. | false preferred | TBD | TBD | Required-scenario hard failure. | Owner: boolean availability representation. |
| `aeb.required_decel_at_onset_mps2` | `adas.aeb.required_decel_at_onset_mps2` | M | m/s^2 | Typed delivered-input required deceleration at first AEB onset; unavailable without onset/applicable geometry. | descriptive | TBD | TBD | Calibrated onset evidence; controller and oracle thresholds remain distinct. | Binding addition; view/onset edge TBD. |
| unnamed post-intervention re-approach | **owner must name** | M | m or m/s or s TBD | Must quantify renewed approach after AEB release/hold from stored trace; unavailable without a completed intervention and defined re-approach window. | TBD | TBD | TBD | Intended release-hysteresis evidence; class TBD. | Blocking owner decision: name, quantity, formula, window. |

### 5.4 ACC submodel (8)

ACC is not implemented in this phase. The V3 schema should still carry a typed ACC submodel; its
fields must be `NOT_AVAILABLE` with a precise “ACC not enabled/implemented” reason, never zero.

| PRD display | Proposed canonical field | Type | Unit | Availability and authoritative source/formula | Direction | Abs tol | Rel tol | Criticality / gate linkage | Status |
|---|---|---|---|---|---|---|---|---|---|
| `acc.headway_target_s` | `adas.acc.headway_target_s` | M | s | Configured target when ACC enabled; otherwise unavailable. | descriptive | TBD | TBD | Configuration/exposure; class TBD. | Proposed. |
| `acc.headway_minimum_s` | `adas.acc.headway_minimum_s` | M | s | Minimum valid headway only when ego speed is at least 1 m/s and an in-path lead exists. | higher | TBD | TBD | Safety; class TBD. | Binding availability floor; formula TBD. |
| `acc.headway_mae_s` | `adas.acc.headway_mae_s` | M | s | MAE against target over valid GAP_CONTROL samples; unavailable without valid samples. | lower | TBD | TBD | Tracking; class TBD. | Proposed. |
| `acc.speed_error_mae_mps` | `adas.acc.speed_error_mae_mps` | M | m/s | MAE against target speed over valid ACC samples; unavailable when ACC disabled. | lower | TBD | TBD | Tracking; class TBD. | Proposed. |
| `acc.cut_in_recovery_s` | `adas.acc.cut_in_recovery_s` | M | s | Time from oracle/actor cut-in edge to approved headway recovery; unavailable without a qualifying cut-in and recovery. | lower | TBD | TBD | Recovery; class TBD. | Owner: trigger and recovery band/window. |
| `acc.max_acceleration_mps2` | `adas.acc.max_acceleration_mps2` | M | m/s^2 | Maximum measured positive acceleration over ACC-attributed execution intervals. | lower | TBD | TBD | Comfort; class TBD. | Proposed attribution contract. |
| `acc.max_deceleration_mps2` | `adas.acc.max_deceleration_mps2` | M | m/s^2 | Maximum measured deceleration over ACC-attributed execution intervals. | lower | TBD | TBD | Comfort; class TBD. | Proposed attribution contract. |
| `acc.max_jerk_mps3` | `adas.acc.max_jerk_mps3` | M | m/s^3 | Approved filtered central-difference jerk over ACC-attributed intervals. | lower | TBD | TBD | Comfort; class TBD. | Owner: shared jerk algorithm/window. |

### 5.5 LKA submodel (8)

LKA is not implemented in this phase. Every field is explicitly unavailable until typed lateral
decision/road-curvature evidence and an enabled LKA capability exist.

| PRD display | Proposed canonical field | Type | Unit | Availability and authoritative source/formula | Direction | Abs tol | Rel tol | Criticality / gate linkage | Status |
|---|---|---|---|---|---|---|---|---|---|
| `lka.lateral_error_mae_m` | `adas.lka.lateral_error_mae_m` | M | m | MAE from typed lane-relative result state over valid LKA samples. | lower | TBD | TBD | Tracking; class TBD. | Proposed. |
| `lka.lateral_error_max_m` | `adas.lka.lateral_error_max_m` | M | m | Maximum absolute valid lateral error while LKA is enabled. | lower | TBD | TBD | Boundary/tracking; class TBD. | Proposed. |
| `lka.lane_crossing_count` | `adas.lka.lane_crossing_count` | CM | crossings | Count verified lane-boundary crossing edges; unavailable without typed lane geometry. | lower | TBD | TBD | Safety; class TBD. | Owner: boundary/crossing semantics. |
| `lka.steering_oscillation_count` | `adas.lka.steering_oscillation_count` | CM | oscillations | Count steering reversals meeting approved amplitude/window criteria. | lower | TBD | TBD | Quality/comfort; class TBD. | Owner: amplitude/window. |
| `lka.max_lateral_accel_mps2` | `adas.lka.max_lateral_accel_mps2` | M | m/s^2 | Maximum absolute lateral acceleration over valid LKA execution samples. | lower | TBD | TBD | Comfort/stability; class TBD. | Owner: derivation/filter. |
| `lka.max_lateral_jerk_mps3` | `adas.lka.max_lateral_jerk_mps3` | M | m/s^3 | Approved filtered central difference of lateral acceleration. | lower | TBD | TBD | Comfort/stability; class TBD. | Owner: filter/window. |
| `lka.degraded_count` | `adas.lka.degraded_count` | CM | transitions | Count entries into an LKA-degraded state from typed mode/function evidence. | lower | TBD | TBD | Reliability; class TBD. | Owner: LKA-specific degradation state. |
| `lka.curve_steady_state_error_m` | `adas.lka.curve_steady_state_error_m` | M | m | Steady-state lateral error on a qualified curved segment after a frozen settling window. | lower | TBD | TBD | Curve-tracking acceptance; class TBD. | Binding addition; owner must set segment/settling window. |

### 5.6 Combined-assistance submodel (6)

The combined supervisor is not implemented. Its typed submodel remains present but unavailable until
the mode transition table and minimal-risk-manoeuvre semantics are implemented.

| PRD display | Proposed canonical field | Type | Unit | Availability and authoritative source/formula | Direction | Abs tol | Rel tol | Criticality / gate linkage | Status |
|---|---|---|---|---|---|---|---|---|---|
| `assist.mode_transition_count` | `adas.assist.mode_transition_count` | CM | transitions | Count edges in typed supervisor mode; unavailable without combined assistance. | descriptive | TBD | TBD | Reliability; class TBD. | Proposed. |
| `assist.degraded_count` | `adas.assist.degraded_count` | CM | transitions | Count entries to `DEGRADED`; unavailable without combined assistance. | lower | TBD | TBD | Reliability; class TBD. | Proposed. |
| `assist.takeover_request_count` | `adas.assist.takeover_request_count` | CM | requests | Count typed takeover requests if that concept remains; unavailable otherwise. | lower | TBD | TBD | PRD now prefers deterministic MRM; class TBD. | Owner: retain, rename, or deprecate. |
| `assist.disengagement_count` | `adas.assist.disengagement_count` | CM | transitions | Count entries to disengaged/MRM execution. | lower | TBD | TBD | Failure vs expected handoff needs gate rule. | Owner: transition/gate semantics. |
| `assist.route_completion` | `adas.assist.route_completion_pct` | M | % | Route completion for a combined-assistance run; unavailable without route evidence/function. | higher | TBD | TBD | Mission completion; may duplicate top-level field. | Owner: duplication and exact name. |
| `assist.constraint_violation_count` | `adas.assist.constraint_violation_count` | CM | violations | Count typed supervisor constraint violations. | lower | TBD | TBD | Safety/reliability; class TBD. | Owner: constraint registry. |

### 5.7 System quality (5)

| PRD display | Proposed canonical field | Type | Unit | Availability and authoritative source/formula | Direction | Abs tol | Rel tol | Criticality / gate linkage | Status |
|---|---|---|---|---|---|---|---|---|---|
| `system.observation_age_p95_ms` (superseded to seconds) | `p95_observation_age_s` | M | s | Nearest-rank p95 of delivered observation age; unavailable only if no delivered samples. Preserve current `max_observation_age_s` separately for V2 lineage. | lower | TBD | TBD | Freshness/reliability; class TBD. | Binding seconds; owner confirms p95 name versus max retention. |
| `system.control_latency_p95_ms` | `p95_control_latency_ms` | M | ms | Current V2 lineage: nearest-rank p95 of all available source-backed control-latency samples; unavailable only when that collection is empty. | lower | TBD | TBD | Reliability; class TBD. | Proposed reuse; owner approves final mapping/formula. |
| `system.sensor_invalid_count` | `sensor_invalid_count` | CM | events | Count typed invalid-sensor input events; unavailable until invalidity evidence exists. | lower | TBD | TBD | Reliability; class TBD. | Owner: invalidity registry/source. |
| `system.control_saturation_count` | `steering_saturation_count` + `brake_saturation_count` | two non-negative ints | events | Existing applied-fault counts, retained separately as the PRD mapping requires. | lower | TBD | TBD | Reliability/authority; class TBD. | Binding split; V3 pass-through runs truthfully report zero. |
| `system.runtime_error_count` | `runtime_error_count` | CM | errors | Count typed runtime errors retained in evidence; unavailable because successful bundles currently abort rather than record errors. | lower | TBD | TBD | Likely critical/invalid evidence; exact semantics TBD. | Owner: whether errors can coexist with a valid bundle. |

### 5.8 Blocking semantic decisions exposed by the matrix

Before code, the owner must freeze:

1. the exact canonical name, quantity, trigger, and window for post-AEB re-approach;
2. whether redundant common fields such as `collision_occurred` and function-specific route
   completion are persisted or derived only for display;
3. integral and boolean availability wrappers (or approved numeric replacements) that reject
   fractional counts without altering legacy `Measurement`;
4. the V3 observation-age field (`p95_observation_age_s`) while retaining V2 max-age semantics;
5. the acceleration filter, central-difference window, endpoint rule, and attribution boundary for
   every jerk metric;
6. delivered-input versus result-output source views and exact warning/brake-onset clocks;
7. one pure oracle/evaluation summary shared by config-relative metrics and findings. Current
   `adas.aeb.threat_response` measurements are heterogeneous (`threat steps` or `m/s`), so copying
   findings into metrics is invalid;
8. unavailable representation for the unimplemented ACC/LKA/assist families; and
9. units, direction, absolute tolerance, relative tolerance, and criticality for all 47 registry
   rows.

The calibrated numeric braking authority and controller fractions are already bound through the
resolved scenario and policy config digests. Their human curve citations live in YAML comments and
are **not** present in `scenario.resolved.yaml`; V3 must not claim the comment itself is hash-bound.
`required_decel_at_onset_mps2` must use stored typed delivered-input evidence, never a fallback to
`ControlConfig.max_braking_mps2 == 6.0`.

### 5.9 Required scenario/gate and suite-aggregation contracts

The current scenario contract is not sufficient to recompute every row above.
`FcwExpectation` has only `kind` and optional `before_ttc_s`, while `AebExpectation` has only
`kind` (`domain/models.py:309-326`). Neither stores the complete required/forbidden time windows
that the normative false/missed definitions require. Adding defaulted fields to schema-4 scenarios
would change their resolved dumps and digests, violating the legacy-byte contract. Recommendation:

- add a versioned scenario-schema-5 ADAS expectation/window contract and preserve schema 1–4
  resolved bytes through the loader's strip/version rules;
- migrate only scenarios selected for V3 production, recording their new scenario digests;
- retain the old schema-4 scenarios/readers for historical V1/V2 evidence; and
- add exact scenario and gate JSON-pointer citations to every config-relative metric and finding.

The post-calibration tree already uses gate-config schema 2 for the current ADAS oracle
(`gates/config.py:35-83`). It does not contain the full 47-row materiality/criticality registry,
required-window rules, nominal-exposure threshold, or release-level aggregation contract. Adding
those fields in place would rebaseline every stored/current ADAS gate digest. Recommendation: use
gate-config schema 3 for the complete V3 comparison/release contract, retain schema 2 unchanged,
and label every new threshold illustrative simulation criteria rather than real-vehicle limits.
An owner-approved in-place schema-2 rebaseline is possible but must be treated as a deliberate full
ADAS digest change, not an additive default.

False-event normalization is a required suite-level consumer of the two run-level false-event
counts; it is not a 48th §12 display metric. The release/comparison evidence must independently
derive and retain:

- false events per nominal scenario-run = total false onset events / qualifying nominal runs;
- false events per simulated kilometre = total false onset events / qualifying travelled km; and
- threat-free exposure share = oracle-labelled threat-free simulation time / total suite
  simulation time, with the PRD's minimum of 30% enforced by the release-level gate.

The current trace has a cumulative `VehicleState.position_m` odometer (MetaDrive integrates world
distance at `adapters/metadrive.py:601-613`). The owner must freeze whether qualifying distance is
the verified final-minus-initial odometer, a new typed run metric, or a suite-only derived value,
and must define zero-distance behavior. Nominal run identity, threat-free time, distance, and every
source bundle digest must be bound into the suite manifest/release evidence. This prices a suite
aggregator and release-level gate in addition to per-run `RunMetricsV3`.

The same suite layer must cover the full declared parameter grid plus the PRD's three-seed
robustness sweep and retain worst-case-per-template aggregation. That three-distinct-seed sweep is
different from same-seed N=3 determinism. A same-host repeat mismatch in canonical
events/metrics/verdict or trace hashes must emit the required `NONDETERMINISM` evidence failure and
force `INVALID_EVIDENCE`; it cannot be averaged away by the robustness sweep.

## 6. Review, comparison, workbench, CLI, and agent impact

| Contract | Current closed surface | Required V3 disposition |
|---|---|---|
| Accepted evidence versions | `review/models.py:647-648` | Accept 3.0 only in the new review schema; retain 1.0/2.0. |
| Schema/profile pairs | `review/models.py:152-159,2493-2496` | Add both ADAS profiles paired with V3; retain historical ADAS V1/V2 pairs. |
| Fault provenance | `review/models.py:2513-2521` | Enforce V3 all-or-none identity against scenario fault presence. |
| Metric order | `review/models.py:2579-2583`; `review/projection.py:948-950` | Replace positional `[:13]`/“else V2” logic with explicit `METRIC_ORDER_BY_EVIDENCE_SCHEMA`. |
| Metric registry | `review/models.py:197-321` | Add every approved V3 ID, type, unit, direction, event pointer, auxiliary pointer, and availability rule. |
| Source allowlists | `review/models.py:1569-1582,2603-2669` | Admit exact scenario/gate pointers for oracle/config-relative metrics; never allow an unrestricted source type. |
| Projection duplication | `review/projection.py:124-201,840-955` | Extend or centralize duplicated order/metadata/measurement declarations. |
| Finding links | `review/projection.py:640-653` | Add ADAS metric citations only for V3; historical V1/V2 ADAS findings have no metrics counterpart. |
| Core comparison | `comparison/compare.py:81-87,237-301,359-365,524-560` | Add a versioned V2 output and approved direction/absolute/relative tolerance/criticality registry for every normative metric; keep cross-schema comparison not comparable. |
| Review comparison | `review/models.py:406-422,2092-2219,2767-2787`; `review/projection.py:1666-1700,2021-2026` | Add review-comparison schema 2 with the same complete, versioned dimension order and exact shape. |
| Review cache/facade | `review/models.py:23,455-475,543-547,2394-2396`; `review/facade.py:149-157` | Key and emit review schema 2 for V3 without changing V1 output/cache identity. |
| CLI/workbench | `cli.py` verify/review/compare paths; `workbench/app.py:894` | Rendering is largely list-driven, but add end-to-end V3 tests and fail closed on unsupported shapes. |
| Agent tools | `agents/tools.py:131-141,341-389,422-464` | Parse V3 events/context, retain WP-3 causal stale proof, and emit exact nested metric citations. |

Nested metrics require three separate, frozen identifiers. A dotted PRD/display ID is not a Python
attribute and is not an RFC 6901 pointer. The V3 registry must bind, per row:

| Role | FCW example | Top-level example |
|---|---|---|
| Stable metric ID | `adas.fcw.warning_count` | `collision_count` |
| Typed model accessor path | `("adas", "fcw", "warning_count")` | `("collision_count",)` |
| JSON pointer | `/adas/fcw/warning_count` | `/collision_count` |

Projection must traverse the accessor tuple; `getattr(snapshot.metrics,
"adas.fcw.warning_count")` is invalid. Review validation must allow exactly the registered pointer,
including proper RFC 6901 escaping, and compare/workbench output must use the stable metric ID.
Every matrix row's final owner freeze includes all three values. This registry should be shared by
review validation and projection rather than duplicated as independently drifting literals.

Tolerance-based regression is normative, not optional. The current comparator marks every
strictly worse numeric delta as `REGRESSED` (`comparison/compare.py:237-301`). Core comparison V2
must instead freeze, for every metric:

- the good/bad direction and criticality class;
- absolute and relative materiality tolerances;
- the combination formula (recommended candidate:
  `materiality = max(abs_tolerance, rel_tolerance * abs(baseline))`, so an exact-zero baseline is
  governed by the absolute tolerance);
- strict boundary behavior at exactly the tolerance;
- integer/count and boolean transitions;
- availability transitions (both unavailable, newly available, and available-to-unavailable);
- unit mismatch and undefined-denominator behavior; and
- the release-level rule that a critical regression produces HOLD.

The owner must approve that formula and every registry value. Regardless of the formula chosen,
all 47 normative display metrics must be represented in the comparison/workbench change. The PRD
requires higher/lower classification; a `descriptive` direction may suppress ordinal ranking only
under an explicit written PRD override and may not silently omit the metric. Preserve
the current unversioned `ArtifactComparison` bytes for V1/V2 and introduce an explicit core
`ArtifactComparisonV2` (or an equivalently versioned envelope) for V3 pairs; `hermes compare`
currently emits the unversioned core shape directly, so versioning only the review projection is
insufficient.

The review model currently projects V3 as an empty metric tuple, while projection treats every
non-1.0 schema as V2. A naïve V3 parser would therefore make the producer and review validator
disagree. Review support must be complete before V3 producer activation.

The current review envelope caps the metric tuple at 64 items (`review/models.py:2411-2417`). A
literal “append 47” implementation would exceed that cap: 19 + 47 = 66. The mapping above reuses
four existing display rows (`collision_count`, `minimum_ttc_s`, `p95_control_latency_ms`, and the
control-saturation display mapped to the two existing saturation counters), so the proposed
canonical order is 19 existing fields plus 43 new fields = 62. That leaves only two slots. The
owner must approve this exact deduplication and headroom; adding redundant aliases or another
metric requires a review-cap decision rather than silent truncation.

## 7. Backward compatibility, digests, fixtures, and rollback

### Historical contract

- Freeze V1/V2 models, canonical bytes, event hashes, parsers, independent recomputation, review
  schema 1 output, and comparison behavior.
- Continue reading valid historical ADAS V1/V2 evidence. V3 is a producer upgrade, not a forced
  migration.
- Do not rewrite or “compatibility-accept” the six intentionally invalid pre-suite-binding ADAS
  bundles recorded in `PHASE8_IMPLEMENTATION_NOTE.md:316-331`.
- Keep V1/V2 versus V3 comparison fail-closed. A baseline and candidate must both be rerun as V3
  at the same repository commit for a V3 comparison.

### Expected V3 identity change

Newly emitted ADAS V3 runs will change:

- `execution-context.json` and its run-context identity;
- every event's canonical bytes and hash, `events.jsonl`, `trace.sha256`, and trace digest;
- `metrics.json`;
- the findings document's schema wrapper even if finding bodies are identical;
- `manifest.json`, companion file digests, and `bundle.sha256`; and
- core comparison, review, and review-comparison output identities under their required V2 shapes.

The complete normative contract needs scenario expectation windows and the tolerance/exposure gate
registry described in §5.9. Migrated ADAS scenarios and gates therefore receive new resolved bytes
and digests under the recommended scenario-schema-5/gate-schema-3 approach. Historical schema-4
scenario and gate-schema-2 bytes remain unchanged. Verdict bytes may remain equal, but that is a
measurement to record, not an assumption.

### Fixture and fleet disposition

The 13 registered fixture recipes contain no ADAS policy/scenario. Their bytes and digests should
not change. Any fixture delta is a stop condition, not a reason to regenerate. Preserve the current
ignored artifact fleet in place and compare its integrity inventory before/after; never delete,
mutate, or relax checks to make old evidence green. Preserve the existing V2 N=3 record and append
a separately labelled V3 N=3 record.

### Rollback

Producer activation is the reversible switch. Once a V3 bundle has been published, V3
read/verify/review support must remain even if production rolls back to V1/V2. A rollback that
makes published evidence unreadable is not acceptable.

## 8. Proposed implementation and commit order

1. **Owner contract freeze.** Resolve evidence-number allocation, unified fault/no-fault V3,
   the 47-row field/type/formula/tolerance/criticality registry, review/comparison versions, and
   actor-roster disposition.
2. **Legacy pins and RED tests.** Pin representative V1/V2 canonical bytes, digests, review
   envelopes, registered fixture identities, and fleet integrity. Add failing V3, mixed-version,
   unknown-version, and exact-return-type tests.
3. **Resolved input contracts.** Add the approved scenario expectation windows under a new
   scenario version and the complete gate/comparison/exposure registry under a new gate version,
   preserving old resolved bytes. Add six strict V3 document models and explicit schema registries
   without activating any producer. Validate optional fault identity all-or-none.
4. **Typed V3 trace seam.** Add protocol-safe ADAS decision evidence, candidate/permitted/executed
   attribution, V3 event creation, source/time continuity, hashing, and mutation tests.
5. **Serialization and independent verification.** Add all four maps, event parser, bundle writer,
   version/profile-specific base/agent/telemetry inventory, trace semantics, stored
   policy/fault/action replay, manifest binding, and corruption tests. Prove every V3 dispatch
   returns V3 rather than V2.
6. **Shared metric derivation.** Add the approved pure summary/metric computation and make any
   config-relative verifier consume the same summary. Test every availability and view boundary.
7. **Consumers before production.** Add review schema 2, exact citations, CLI/workbench support,
   agent V3 parsing, core comparison schema 2, and review-comparison schema 2. Verify every approved
   metric and synthetic V3 bundle end to end with the frozen tolerance registry.
8. **Single producer selector.** Emit legacy no-fault as V1, non-ADAS fault as V2, and both ADAS
   profiles as V3. Exercise no-fault pass-through and configured-fault evidence.
9. **Real evidence acceptance.** Run representative no-fault and delayed-fault MetaDrive ADAS
   scenarios N=3; keep all seeded defects caught by their named findings/triage categories; verify
   registered fixture identity and the complete artifact fleet.
10. **Controlled publication.** Record every changed V3 digest and preserved V1/V2 identity.
    Retain V3 readers on rollback.

Each stage is one concern, follows RED/GREEN TDD for behavior, and runs the full suite, the complete
YAML-derived seeded suite, and Ruff against the exact commit tree. Producer activation cannot land
before independent V3 verification, review, agent, and workbench support.

## 9. Next-phase acceptance matrix

| Concern | Required proof |
|---|---|
| Resolved inputs | Required/forbidden windows, oracle thresholds, metric tolerances, criticality, and nominal-exposure rules are schema-versioned, digest-bound, and cited exactly; legacy scenario/gate bytes stay unchanged. |
| Model/version exactness | All six V3 document types validate canonical 3.0; unknown and mixed versions fail closed. |
| Derived dispatch | Exact types from metrics, writer, parser, replay, and findings/manifest factories are V3, never silently V2. |
| Legacy compatibility | Representative V1/V2 canonical bytes/digests and all 13 registered fixture identities remain unchanged. |
| No-fault V3 | Pass-through raw/delivered/result and permitted/executed evidence is truthful; no synthetic fault identity is claimed. |
| Faulted V3 | Fault identity exactly matches scenario/config; source sequence/time/age and action origin replay independently. |
| ADAS trace evidence | Warning/intervention/mode and all brake-source stages are typed, hash-bound, and replay-verified. |
| Metrics | All 47 approved display rows and their canonical leaves have exact ID/accessor/pointer/type/unit/view/formula/availability/direction/tolerance/criticality; unsupported functions are unavailable, not zero. |
| Suite normalization | False-event rates per nominal run and simulated km plus threat-free exposure share recompute from cited bundles; zero distance and the 30% minimum are tested. |
| Tamper handling | Coherently rehashed changes to decision, attribution, metric, source, config, or finding evidence are rejected by independent recomputation. |
| Artifact profiles | Ordinary, agent-run, and mining/regression inventories accept exactly their required files; cross-profile missing/extra files and digest mutations fail closed. |
| Review/agents | Review schema 2 resolves every source citation; WP-3 stale-observation causal proof remains available under V3. |
| Comparison | V3-to-V3 uses approved tolerances; V1/V2-to-V3 is explicitly not comparable; dimension shape is versioned. |
| Real determinism | On one pinned host, N=3 yields byte-identical canonical events, metrics, and verdict plus equal trace hashes; manifest timestamps/bundle roots are reported separately. |
| Operational gates | Full pytest, complete seeded named-finding suite, Ruff, doctor, MetaDrive smoke, V3 verify/review, and fleet scan are recorded. |

Primary regression surfaces include `tests/unit/test_artifact_schema_version.py`,
`test_canonical_trace.py`, `test_artifact_verification.py`, `test_review_models.py`,
`test_review_projection.py`, `test_review_adas_support.py`, `test_comparison.py`,
`test_review_comparison.py`, and `test_agent_tools.py`; plus
`tests/integration/test_fault_run.py`, `test_review_artifacts.py`,
`test_stationary_lead_observation_delay.py`, the complete YAML-derived seeded suite, and the review
CLI tests. Add dedicated scenario/gate-version, artifact-profile, suite-normalization, and core
comparison-V2 tests rather than hiding those contracts inside one end-to-end case.

## 10. Risks and mitigations

| Risk | Mitigation |
|---|---|
| V3 silently serialized or computed as V2 | Exact schema registry, V3-first dispatch, and exact-type tests at every boundary. |
| No-fault ADAS gains a fabricated fault identity | Unified V3 with pass-through event evidence and optional all-or-none context/manifest fault identity. |
| Metrics and findings drift | One pure, stored-input evaluation summary with exact scenario/gate citations. |
| Required windows or tolerances exist only in prose | Version and digest-bind scenario-schema-5 windows plus gate-schema-3 registry before V3 production. |
| Fractional values pass as counts | Use an integral availability wrapper and review kind; mutation-test non-integral values. |
| Warning and AEB metrics use the wrong observation clock | Freeze delivered-input versus result-view semantics per row and mutation-test both. |
| Driver, AEB, shield, and delayed actions are misattributed | Store/derive candidate, permitted, and executed attribution through the action-origin chain. |
| Undefined functions look perfect | Typed unavailable measurements with reasons for disabled/unimplemented FCW/ACC/LKA/assist capability. |
| Review or agents accept V3 but omit its evidence | Complete review schema 2, conditional citations, agent replay, and workbench tests before producer activation. |
| Core comparison changes without a version | Emit comparison V2 for V3 pairs and preserve the current V1 output for V1/V2 pairs. |
| Conditional agent/telemetry files are rejected or omitted | Bind a version/profile/use-case inventory into manifest, capture, compatibility, and workbench verification. |
| Historical evidence becomes unreadable | Preserve V1/V2 readers and bytes; never rewrite bundles; retain V3 readers after rollback. |
| Schema number collision with WP-2 roster | Owner assigns metrics to V3 and roster to V4, or explicitly approves a combined scope before code. |
| Calibration provenance is overstated | Bind measured numeric authority/config; label YAML comment citations as human-readable, not hashed evidence. |

## 11. Owner decisions required before implementation

1. Approve evidence V3 for metrics/typed ADAS and V4 for the deferred actor roster, or select a
   combined scope.
2. Approve the unified no-fault/fault V3 representation and exact fault-presence validators.
3. Freeze every unresolved entry in the 47-row matrix, especially boolean availability,
   integral-count availability, re-approach, jerk, observation view/clock, oracle summary, units,
   and the full tolerance/criticality registry.
4. Approve review schema 2, core comparison schema 2, and review-comparison schema 2, including
   exact tolerance and availability-transition semantics for every normative metric.
5. Approve the versioned scenario-window and gate-registry migration, false-event suite
   normalization/distance source, and conditional base/agent/telemetry artifact profiles.
6. Decide the disposition of historical invalid ADAS bundles; the engineering recommendation is
   preservation without compatibility relaxation or rebaseline.

Until those decisions are made, implementing `RunMetricsV3` would encode product semantics by
accident. The correct Phase 3 outcome is this priced, testable migration boundary—not code.
