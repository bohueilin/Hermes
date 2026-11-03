# Phase 8 WP-2 composite-scenario feasibility design note

**Status:** design decision only; no scenario or runtime implementation is authorized in
Phase 3.

## Decision

Defer both proposed WP-2 additions:

- `cut_out_reveal` / `cut_out_reveal_stopped`; and
- `slow_lead_closing`.

The current contracts cannot represent either case truthfully. The cut-out case requires two
simultaneously measured actors with stable identities, roles, and an evidence-bound selection
of the front actor. Hermes currently stores one unlabeled challenge actor and one front-object
pair. The slow-lead case requires a genuinely constant-speed actor and persistent steady phase;
the existing `lead_vehicle_hard_brake` kind always has a legal, in-horizon brake interval.

Therefore no Phase-3 Python, scenario YAML, schema, fixture, calibration, or generated-evidence
change is approved by this work package. This is the execution plan's authorized successful
design-note exit, not a claim that the scenarios are unnecessary.

## Evidence classification and scope

| Classification | Meaning in this note |
|---|---|
| Observed | Directly established by the current source at checkpoint `689d9326833d23f8fcf9340589e313e3c8ffdefd`. |
| Inferred | A consequence of combining observed contracts; it is not a new runtime measurement. |
| Recommended | A future design direction requiring owner approval before implementation. |
| Unresolved | A product, evidence, compatibility, or calibration choice that the current code cannot decide. |

This note is simulation-only. It does not establish real-road safety, production readiness,
an SAE automation level, certification, regulatory compliance, or deployment permission.
Any future thresholds remain illustrative until separately calibrated in the simulator for
the exact decision being evaluated. Simulation evidence is not real-world validation.

## Observed blocker: the current challenge evidence has one actor identity slot

The singularity is repeated across the whole evidence path rather than being confined to one
adapter helper:

| Current contract | Observed source | Consequence |
|---|---|---|
| One scenario field, `ScenarioDefinition.challenge: ChallengeConfig | None` | `src/hermes/domain/models.py::ScenarioDefinition` | A scenario carries one discriminated challenge instance, not a roster or composite. |
| One discriminated union member at a time | `src/hermes/domain/models.py::ChallengeConfig` | `lead_vehicle_hard_brake`, `cut_in_near_field`, and `stationary_lead` each describe one actor. |
| One fixed manager actor name, `ACTOR_NAME = "hermes_challenge_actor"` | `src/hermes/adapters/metadrive_challenge.py::ACTOR_NAME` | There is no persisted stable ID or role for a second actor. |
| One manager actor and one snapshot | `HermesChallengeManager._actor`, `.actor`, `._snapshot`, and `.snapshot` in `src/hermes/adapters/metadrive_challenge.py` | Actor existence, scheduling, measurement, and disappearance checks all refer to the same object. |
| One `ChallengeActorState` | `src/hermes/adapters/metadrive_challenge.py::ChallengeActorState` | The state has one front pair, one longitudinal/lateral pose, one speed, and one phase. It has no actor ID or role. |
| One adapter projection | `src/hermes/adapters/metadrive.py::MetaDriveAdapter._challenge_observation_fields` | The snapshot is flattened into one `front_distance_m` / `front_relative_speed_mps` pair and one `challenge_actor_*` tuple. |
| One observation representation | `src/hermes/domain/models.py::Observation` | The typed policy/fault/review input has singular front, challenge geometry, speed, and phase fields. |
| One summary projection | `src/hermes/runtime/orchestrator.py::_observation_summary` | Input and result each contain exactly one front pair and one challenge tuple. |
| One phase schedule and continuity chain | `src/hermes/evidence/trace.py::_expected_challenge_phase`, `_verify_observation_summary`, and `_verify_fault_challenge_evidence` | Each step's singular input challenge fields must equal the prior step's singular result fields. |

`measure_challenge_actor` measures the manager's named actor only. It projects actual oriented
bounding boxes and velocities into the ego frame. `front_distance_m` and
`front_relative_speed_mps` are paired and present only when that actor's center is ahead and
its oriented box laterally overlaps the ego box. These are sound measurements for one actor;
they are not a nearest-object search across multiple actors.

### Exact current observation-summary field set

For a challenge trace, `src/hermes/evidence/trace.py::_CHALLENGE_OBSERVATION_SUMMARY_FIELDS`
requires exact set equality with these 18 fields:

```text
input_sequence
input_simulation_time_s
speed_mps
lateral_offset_m
route_progress_pct
observation_age_s
front_distance_m
front_relative_speed_mps
challenge_actor_longitudinal_m
challenge_actor_lateral_offset_m
challenge_actor_speed_mps
challenge_phase
result_front_distance_m
result_front_relative_speed_mps
result_challenge_actor_longitudinal_m
result_challenge_actor_lateral_offset_m
result_challenge_actor_speed_mps
result_challenge_phase
```

The first six are `_OBSERVATION_SUMMARY_FIELDS`; the remaining 12 add input/result front and
challenge evidence. There is no actor identifier, role, roster, selected-front identifier,
occlusion state, visibility state, or per-actor overlap field. The `challenge_actor_*` tuple
is semantically unlabeled beyond “the” configured challenge actor.

Evidence schema 1.0 uses `TraceEvent` and verifies exact summary fields, paired front values,
phase schedule, sequence-zero declarations, and input-to-prior-result continuity through
`verify_complete_trace` → `_verify_observation_summary`. Evidence schema 2.0 uses
`TraceEventV2`; `_verify_fault_event` binds typed raw, delivered, and result `Observation`
objects, reconstructs the summary exactly, and calls `_verify_fault_challenge_evidence` for
the same singular challenge schedule and continuity. `verify_event_chain` also requires one
unchanged evidence schema, contiguous sequence, strictly increasing time, and hash continuity.

This version dispatch is explicit in `src/hermes/evidence/trace.py::verify_complete_trace` and
`src/hermes/evidence/verification.py::_parse_events`; the artifact parser supports evidence
versions `1.0` and `2.0` only.

### Why identity switching is not evidence of a cut-out reveal

Silently changing the meaning of the singular fields from the swerving lead to the revealed
stopped actor would create an unprovable identity discontinuity:

1. Before the reveal, the fields would describe actor A, the occluding/swerving lead.
2. After the reveal, the same unlabeled fields would describe actor B, the stopped hazard.
3. The current trace would contain no `actor_id`, role, selector decision, or roster from which
   an offline verifier could prove when or why the switch occurred.
4. The continuity checker would only prove that the same field names match the prior result.
   It cannot prove that their physical subject stayed the same or that a subject change was
   correct.
5. A producer could substitute an arbitrary object while preserving internally consistent
   numbers and hashes. The trace would prove internal consistency of the substitution, not
   the intended composite geometry.

Tracking actor A for the whole run preserves identity but omits the revealed stopped actor's
required geometry and threat. Tracking actor B for the whole run preserves identity but omits
the lead's outward swerve and the occlusion/reveal relationship. Either fixed choice reduces
the proposed composite case to incomplete single-actor evidence.

The current `front_*` fields cannot rescue this design. They are the paired front projection
of the same actor passed to `measure_challenge_actor`; no current selector searches all
eligible actors, records which actor won, or proves deterministic tie-breaking. Current
nearest-object tracking must not be claimed because it does not exist in this challenge path.

## Decision options and disposition

| Option | Cost / compatibility effect | Disposition |
|---|---|---|
| Evidence schema 3.0 actor roster | Highest initial cost: new typed evidence models, event/artifact dispatch, verification, fault provenance, review and comparison support, migrations, and broad tests. Provides reusable multi-actor semantics rather than a one-off encoding. | **Recommended future contract, pending owner approval.** Do not silently approve or implement it in Phase 3. |
| Challenge-specific flat extension under current schema | Smaller code footprint, for example separate `occluder_*` and `revealed_actor_*` fields. It hard-codes one composite shape, duplicates selection semantics, and risks falsely treating changed bytes/meaning as compatible with evidence schemas 1.0/2.0. | Owner-selectable fallback only if the roster's cost is rejected. It still needs explicit versioning and historical-bundle protection. |
| Switch nearest-object identity in existing fields | No actor ID, role, selection evidence, or identity-transition proof; defeats the existing continuity chain's intended meaning. | **Reject.** |
| Keep one fixed designated actor in existing fields | Preserves one identity but necessarily omits either the swerve/occlusion actor or the revealed stopped threat. | **Reject.** |
| Defer and decompose into existing single-actor scenarios | Lowest risk. Existing `cut_in_near_field` and `stationary_lead` cases can exercise isolated lateral-entry and stopped-object behavior. | **Honest interim coverage.** It is not composite equivalence and must not be reported as `cut_out_reveal_stopped` coverage. |

## Recommended future evidence contract: schema 3.0 actor roster

The owner should consider a new **evidence schema 3.0** rather than changing the meaning of
schema 1.0 or 2.0. The following is a recommendation, not an approved schema.

Each delivered observation should carry an immutable actor roster with, at minimum:

- stable `actor_id`, unique for the episode and unchanged across input/result steps;
- declared `role`, such as `OCCLUDING_LEAD` or `REVEALED_STATIONARY_HAZARD`;
- measured ego-frame actor-center longitudinal and lateral position;
- measured actor speed and longitudinal relative speed;
- measured oriented-box lateral-overlap state and in-path state;
- measured bumper gap when the actor is a positive in-path front candidate, otherwise an
  explicit unavailable value/reason rather than a fabricated number;
- actor-specific truthful phase; and
- owner-defined visibility/occlusion evidence sufficient to distinguish “geometrically behind”
  from “not observable to the controller.”

The observation must also carry `selected_front_actor_id`, or explicit `NOT_AVAILABLE` when no
front actor is eligible. The recommended selector is deterministic:

1. consider actors with positive-ahead geometry and measured in-path overlap;
2. select the smallest non-negative measured bumper gap;
3. break an exact gap tie by a documented stable key, recommended lexicographic `actor_id`;
4. persist both the chosen ID and the measured candidates so offline verification can recompute
   the choice rather than trust it; and
5. derive the policy-facing front pair from the selected roster entry only.

The precise positive-ahead predicate, equality/tolerance treatment, and tie-break key remain
owner decisions. They must be identical in runtime projection and offline verification.

Schema 3.0 must preserve all evidence views needed for replay and review:

- **raw:** complete simulator-produced roster before faults;
- **delivered:** complete policy/shield roster after deterministic delay, freeze, dropout, and
  any owner-approved per-actor transform;
- **result:** complete post-execution roster;
- **summary:** a version-3 projection containing the selected-front ID/pair and actor-roster
  evidence without reusing the version-1/2 field set; and
- **review:** typed actor rows, selection rationale, timeline tracks, and citations pointing to
  the exact raw/delivered/result actor entries and selector fields.

The composite challenge scheduler would then use stable actors A and B throughout the episode:
actor A performs the scripted outward swerve, actor B remains stopped, and evidence records both
independently before, during, and after the reveal. Visibility and controller delivery must not
be inferred merely from lane overlap; they need an explicit owner-approved contract.

## Compatibility strategy

1. Freeze evidence schema 1.0 and 2.0 model shapes, canonical bytes, hash material, exact field
   sets, verification behavior, and review interpretation.
2. Do **not** globally add fields to or reinterpret
   `src/hermes/evidence/trace.py::_CHALLENGE_OBSERVATION_SUMMARY_FIELDS`. Its exact-set check is a
   compatibility boundary for historical challenge bundles.
3. Add parallel version-3 models and constructors rather than mutating `TraceEvent` or
   `TraceEventV2`: for example versioned observation/roster, run context, event, manifest,
   execution context, metrics/findings documents, and explicit parser maps.
4. Dispatch by the stored `evidence_schema_version` at creation, parsing, trace verification,
   artifact verification/recomputation, review projection, and comparison. Never infer a
   version from the presence of new fields.
5. Continue verifying historical schema-1/2 bundles byte-for-byte and semantically with their
   original code paths. Add golden fixtures proving a version-3 implementation changes none of
   their canonical serialization, trace digests, file digests, or verdict recomputation.
6. Reject or mark cross-evidence-version comparisons not comparable unless a separately approved
   semantic normalization proves equivalent dimensions. Current comparison already fails closed
   when manifest evidence versions differ.
7. Treat a challenge-specific flat extension as versioned evidence too. Adding it “under” 1.0 or
   2.0 would break exact summary validation and canonical hashes while disguising a semantic
   change as compatibility.
8. Do not auto-migrate stored bundles. If migration is approved, retain the source bundle,
   produce a separately identified derived bundle, record the transformation and tool version,
   and never claim byte identity or newly observed evidence.

## Exact future implementation and migration surface

The following inventory prices the change; it does not authorize work.

| Surface | Current symbols / files requiring design or versioned extension |
|---|---|
| Domain and scenario models | `Observation`, `ChallengeConfig`, `ScenarioDefinition`, `ObservationFaultEvidence`, `RunContext`/`RunContextV2`, `ExecutionContext`/`ExecutionContextV2`, `TraceEvent`/`TraceEventV2`, `RunMetrics`/`RunMetricsV2`, `ArtifactManifest`/`ArtifactManifestV2`, and `FindingsDocument`/`FindingsDocumentV2` in `src/hermes/domain/models.py`; strict schema loading/digest stripping in `src/hermes/scenarios/loader.py`. Add distinct composite and steady-slow-lead scenario contracts only after evidence semantics are approved. |
| MetaDrive challenge runtime | `ACTOR_NAME`, `ChallengeActorState`, `measure_challenge_actor`, `_validated_challenge`, `create_challenge_environment`, nested `HermesChallengeManager`, and `HermesChallengeMetaDriveEnv.hermes_challenge_state` in `src/hermes/adapters/metadrive_challenge.py`. Multi-actor spawn, stable IDs/roles, scheduling, disappearance checks, measurement, and selection are all new behavior. |
| MetaDrive adapter | `MetaDriveAdapter._challenge_observation_fields` plus adapter evidence/config projections in `src/hermes/adapters/metadrive.py`. It must return a typed roster and selected-front evidence without simulator leakage into neutral layers. |
| Orchestrator | `_observation_summary`, `_build_execution_context`, `_execute_episode`, schema-specific event creation, metric/finding dispatch, and bundle staging in `src/hermes/runtime/orchestrator.py`. Candidate, permitted, executed, raw, delivered, result, and reviewable selection evidence must remain distinct. |
| Trace construction and semantics | `create_trace_event`, `create_trace_event_v2`, `_OBSERVATION_SUMMARY_FIELDS`, `_CHALLENGE_OBSERVATION_SUMMARY_FIELDS`, `_expected_observation_summary_fields`, `_expected_challenge_phase`, `_verify_observation_summary`, `_verify_fault_event`, `_verify_fault_challenge_evidence`, `verify_event_chain`, `verify_complete_trace`, and `events_jsonl_bytes` in `src/hermes/evidence/trace.py`. Add a separate v3 path; preserve v1/v2 byte semantics. |
| Artifact write/read/version dispatch | `write_bundle` in `src/hermes/evidence/artifacts.py`; `_parse_versioned_model`, `_parse_events`, profile checks, version-consistency checks, recomputed metrics/findings/verdict, and model maps in `src/hermes/evidence/verification.py`. Every stored file carrying `evidence_schema_version` needs explicit v3 dispatch and mixed-version rejection. |
| Metrics and findings | `compute_metrics` and minimum-TTC front-pair selection in `src/hermes/evidence/metrics.py`; ADAS finding construction in `src/hermes/verifiers/adas.py`; suite dispatch in `src/hermes/verifiers/__init__.py::run_verifiers_for_profile`. Metrics must cite the selected actor and reject a selector/roster contradiction. |
| Verifier profile and release registry | `VerifierProfile`, `EXPECTED_FINDINGS_BY_PROFILE`, `EVIDENCE_REQUIREMENTS_BY_PROFILE`, and `select_verifier_profile` in `src/hermes/gates/release.py` define the profile enum, expected-finding/evidence registry, and profile selection. Preserve exact suite/registry agreement when adding v3; `src/hermes/verifiers/__init__.py` remains the suite dispatcher. |
| ADAS projection and controller | `AdasObservation` and `project_observation` in `src/hermes/adas/interfaces.py`, the FCW/AEB state machines in `src/hermes/adas/functions.py`, and `AdasLongitudinalPolicy` in `src/hermes/adas/policy.py`. The policy may consume the selected front pair, but selection must be an evidence-bound environment/verifier contract rather than private policy state. |
| Offline ADAS oracle | `_Sample`, `_samples`, `_threat_samples`, `adas_threat_response`, `adas_brake_onset_margin`, `adas_no_false_intervention`, and `adas_warning_timing` in `src/hermes/verifiers/adas.py`. Recompute selected-front consistency from stored roster before using gap/relative speed. Do not make kind-specific threat exceptions. |
| Shield | `observation_ttc_s` and `DeterministicSafetyShield.apply` in `src/hermes/shields/deterministic.py`. The shield must consume the same delivered selected actor as the policy and leave evidence of any override; it must not run an independent unrecorded selector. |
| Fault transforms | `DeterministicFaultInjector.process_observation` and typed `FaultedObservation` in `src/hermes/faults/deterministic.py`, plus schema-2 raw/delivered/result binding in `src/hermes/evidence/trace.py`. Define whether actor rosters are delayed/frozen/dropped atomically and whether any noise applies per actor; prove IDs, roles, selector, and provenance cannot drift. |
| Regression flywheel | `_scenario_signature`, `_failure_geometry`, `derive_scenario_payload`, and coverage/floor handling in `src/hermes/regression/builder.py` and `src/hermes/regression/floor.py`. A composite draft needs actor-specific failure geometry and cannot collapse to the singular `front_distance_m`. |
| Review envelope, projection, timeline, citations | Evidence-version/profile pairings, source-reference pointer allowlists, `ObservationValue`, timeline invariants, and comparison-envelope validation in `src/hermes/review/models.py`; `_observation`, `_ttc_references`, `_ttc_point`, `_point_for_track`, `_timeline`, metrics/findings citations, and schema dispatch in `src/hermes/review/projection.py`; facade and workbench consumers under `src/hermes/review/facade.py` and `src/hermes/workbench/`. Add typed per-actor display and selected-front rationale; never hide roster conflicts behind a scalar TTC. |
| Comparison | Evidence-version compatibility and all dimension/reference projections in `src/hermes/comparison/compare.py` and review comparison models/projection. Preserve fail-closed cross-version behavior until normalization is explicitly approved and tested. |
| Tests and fixtures | Scenario/domain, MetaDrive challenge/adapter, canonical trace, schema gating, fault run, artifact verification/versioning, ADAS function/verifier/shield, metrics, regression, review model/projection/comparison/workbench, seeded-defect, integration, determinism, and architecture-boundary tests under `tests/`; fixture recipes in `config/phase8-fixture-registry.yaml` and `src/hermes/fixtures/registry.py`; historical bundles used by tests. Add malformed/ambiguous selector and identity-transition failures, not only happy paths. |

## Observed blocker: `lead_vehicle_hard_brake` is not a steady slow lead

`src/hermes/domain/models.py::LeadVehicleHardBrakeChallenge` requires
`brake_duration_steps` in `[1, 10000]`; there is no zero-duration or disabled brake schedule.
`ScenarioDefinition.reject_contradictory_configuration` requires
`trigger_step + brake_duration_steps <= control.horizon_steps`.

At the current `adas_nominal_slow_closing` boundary:

```text
horizon_steps       = 200
trigger_step        = 199
brake_duration_steps = 1
```

This is legal because `199 + 1 == 200`. In
`HermesChallengeManager._before_lead_step`, steps before 199 execute `[0.0, 0.0]` and use
`PRE_TRIGGER`; step 199 executes `[0.0, -1.0]` and uses `BRAKING`. In
`src/hermes/evidence/trace.py::_expected_challenge_phase`, sequence 199 requires input phase
`PRE_TRIGGER` and result phase `BRAKING`, exactly reflecting the real final-step brake.

Moving the trigger to 200 is invalid because `200 + 1 > 200`. The current model has no legal
never-firing trigger. Moreover, pre-trigger `[0.0, 0.0]` is a dynamic actor coasting with
neutral action. It is not a contract that actively preserves constant world speed, and its
`PRE_TRIGGER` phase does not state steady motion.

Therefore `scenarios/adas/adas_nominal_slow_closing.yaml` overstates its evidence when its
comments describe a steady/threat-free-throughout exposure. The scheduled final-step brake is
the **lead actor's** real brake and proves that actor is not steady through the horizon. It does
not by itself prove that ego/AEB braking was due or occurred: candidate/executed ego action and
the offline findings answer those separate questions. In the scenario comments, “nothing is
due: no warning, no braking” contextually describes the expected ego FCW/AEB response, not the
lead actor's command, so the actor brake alone does not contradict that response claim.

The existing case still cannot prove the proposed true `slow_lead_closing` semantics. This note
does not edit it. A comment-only correction would change the source YAML bytes but not the
value-based `scenario_digest`, because comments are absent from the parsed
`ScenarioDefinition`; changing bound values such as `description`, `trigger_step`, or another
schedule field would change that digest. Any bound-field correction or rebaseline remains an
owner-approved migration decision because the scenario is part of seeded-defect coverage.

Its `adas.expected_fcw.kind: none` is also not evidence that no warning was emitted.
`AdasLongitudinalPolicy` computes an `AdasDecision.warning` internally, but `TraceEvent` and
`TraceEventV2` store actions and observations, not the warning output. Accordingly,
`src/hermes/verifiers/adas.py::adas_warning_timing` returns `NOT_AVAILABLE` when the scenario
declares no required warning. It explicitly describes itself as a geometry-coverage check, not
a warning-output check.

### Recommended future slow-lead contract

Add a distinct owner-approved challenge kind such as `steady_slow_lead` with
`actor_control_mode: scripted_kinematic_replay`, an explicit constant `actor_speed_mps`, no
hidden brake trigger, and one truthful persistent phase such as `STEADY`. The scheduler should
deterministically set the actor pose/velocity according to that contract at every control step,
and the trace should verify persistent phase, declared initial speed, result speed, and
input-to-result continuity. This is separate from the evidence-v3 roster decision: a
single-actor steady kind can be designed independently, but its scenario, semantics,
calibration, and historical-coverage migration still require owner approval.

If “no FCW” is an acceptance requirement rather than merely “no warning required,” future
evidence must store the FCW output with attribution and verify it. `expected_fcw: none` must not
be upgraded from `NOT_AVAILABLE` to proof of absence without that evidence.

## Owner decisions required before code

1. **Evidence contract:** approve evidence schema 3.0 actor roster, choose a separately versioned
   smaller flat extension, or continue deferral/decomposition.
2. **Actor identity and roles:** define stable ID lifetime, uniqueness, allowed roles, and how
   declared scenario actors bind to spawned simulator objects and stored evidence.
3. **Front selector:** define positive-ahead/in-path eligibility, bumper-gap calculation,
   equality tolerance, tie-break, no-candidate result, and whether selection occurs before or
   after visibility filtering.
4. **Occlusion and visibility:** decide whether the controller receives ground-truth actors,
   visible actors only, or separate truth/perception rosters; define reveal timing and evidence.
5. **Fault behavior per actor:** decide atomic delay/freeze/dropout semantics, actor-field noise,
   stable-ID behavior, selection recomputation versus delivery, and required raw/delivered/result
   provenance.
6. **Review representation:** approve roster tables, roles, selected-front explanation, timeline
   transitions, per-actor citations, and quarantine behavior on roster/selector conflict.
7. **Migration and rebaseline:** decide whether any existing scenario text is corrected, whether
   bundles are retained versus regenerated, how cross-version comparison behaves, and which
   golden identities must remain byte-identical.
8. **Scenario acceptance and calibration:** approve entry speeds/gaps, outward-swerve and reveal
   timing, stopped-actor placement, control horizon, repeat count/seeds, measured deceleration
   authority, deterministic tolerances, paired negative controls, and explicit pass/failure
   findings. Choose the lowest simulator fidelity sufficient for these questions and do not
   interpret it as real-world validation.
9. **Steady-lead semantics:** approve the new scripted kind (or equivalent), persistent phase,
   exact constant-speed enforcement/verification, termination expectations, and whether FCW
   output itself must be stored.

## Impact and risk

| Impact / risk | Why it matters | Mitigation |
|---|---|---|
| Historical evidence invalidation | A global summary-field change breaks exact-set checks, canonical bytes, hashes, and possibly stored review interpretation. | Freeze v1/v2; add explicit v3 models/dispatch; run golden historical bundle verification. |
| Actor substitution accepted as valid | Unlabeled scalar fields can hide a producer-selected identity switch. | Stable IDs/roles, full roster, persisted selected ID, offline selector recomputation, failure on discontinuity. |
| Runtime/verifier selector drift | Two plausible nearest-object implementations can choose different actors at ties or overlap boundaries. | One normative algorithm and tolerance contract, shared conformance vectors, adversarial tie/edge tests. |
| Occlusion confused with geometry | “Behind another actor,” “not in lane,” and “not delivered to policy” are different facts. | Separate ground-truth geometry, visibility/occlusion, and delivered-perception semantics. |
| Fault provenance loses actor meaning | Delayed or frozen observations can otherwise mix roster state and selector state from different times. | Transform an observation snapshot atomically; bind every delivered actor and selector to a raw source sequence/time. |
| Review compresses away ambiguity | A scalar TTC chart can look authoritative while hiding which actor supplied it. | Show selected actor ID/role and candidate roster with direct source citations; quarantine contradictions. |
| Scenario-specific schema debt | Flat `occluder_*` fields are initially cheaper but scale poorly to additional actors and roles. | Prefer a reusable roster; if flat fields are selected, version them and document the deliberate scope limit. |
| Slow-lead semantic overclaim | A final-step brake or neutral coasting can be mistaken for constant-speed nominal exposure. | New steady scripted kind, persistent phase, per-step speed verification, measured acceptance evidence. |
| “No warning” overclaim | Warning output is not currently stored. | Keep result `NOT_AVAILABLE`, or version the trace to store attributed FCW output and add an offline verifier. |
| Calibration mistaken for safety evidence | Repeatable simulator results still do not establish public-road safety. | Simulation-only labels, decision-specific calibration, uncertainty/residual-risk record, separate real-world validation authority. |

## Ordered future implementation plan

1. Record the owner decisions above and freeze normative actor, selector, visibility, fault,
   review, versioning, and acceptance contracts before editing production code.
2. Add failing schema/serialization tests for v3 actor IDs/roles/rosters, selected-front
   integrity, unsupported versions, and unchanged v1/v2 canonical bytes and historical bundles.
3. Add version-3 simulator-neutral models and explicit event/artifact dispatch; keep all v1/v2
   constructors, field sets, hashes, parser maps, and verification paths intact.
4. Implement pure measurement and selector functions with adversarial tests for ahead/behind,
   overlap boundaries, equal gaps, disappearing actors, reordered roster input, and no candidate.
5. Extend the MetaDrive challenge manager/adapter for two stable actors and the outward-swerve +
   stopped-reveal schedule; measure both actors at reset/input/result without an LLM or other
   nondeterministic controller in the real-time loop.
6. Extend the orchestrator, faults, trace semantics, metrics/findings, ADAS projection, shield,
   and offline verifier so raw/delivered/result actor identity and front selection are replayable
   and contradictions fail closed.
7. Extend review, citations, timeline, workbench, comparison, regression drafting, and fixture
   regeneration; make invalid selection evidence quarantine stored verdict/findings.
8. Implement the separate `steady_slow_lead` scripted-kinematic contract and per-step steady
   verification. Store FCW output only if the owner approves a corresponding evidence contract.
9. Calibrate and author threat/nominal scenario pairs from measured simulator evidence. Add
   seeded defects whose declared named findings catch identity/selection and response failures.
10. Run focused failure paths, N=3 or owner-approved stronger determinism, the complete suite,
    complete YAML-derived seeded suite, Ruff, doctor, headless simulator smoke, artifact
    verification, historical v1/v2 bundle verification, and review/comparison checks before any
    commit or rebaseline proposal.

## Future acceptance criteria

The work is not complete merely because both actors appear on screen. Future implementation
must demonstrate all of the following:

- the scenario definition binds two declared stable actors to two simulator objects and two
  independently measured roster entries for every relevant raw, delivered, and result step;
- actor IDs and roles never switch, disappear silently, or depend on roster order;
- selected-front identity and pair recompute deterministically from roster evidence, including
  exact tie, overlap-boundary, behind-ego, disappearance, and no-candidate cases;
- the cut-out actor's outward motion and stopped actor's persistent zero speed/pose are both
  trace-verified, as is the owner-approved occlusion/reveal transition;
- the policy, shield, offline oracle, metrics, findings, and review all use/cite the same
  delivered selected actor, while raw and result actor evidence remain distinguishable;
- malformed identity, role, roster, selector, continuity, visibility, and raw/delivered/result
  evidence fail closed before an accepted verdict is displayed;
- schema-1/2 canonical bytes, trace hashes, historical bundle verification, verdict
  recomputation, review envelopes, and same-version comparisons remain unchanged;
- cross-version comparison stays explicitly not comparable unless an approved normalization is
  implemented and independently tested;
- `cut_out_reveal_stopped` has a measured baseline and complementary negative control, with
  named verifier findings and deterministic repeat evidence;
- `steady_slow_lead` maintains the declared actor speed and persistent steady phase for every
  executed step, contains no scheduled braking, and has measured threat-free/response evidence
  consistent with its exact stated acceptance criteria;
- any assertion that no FCW occurred is supported by stored attributed warning output; otherwise
  the warning result remains `NOT_AVAILABLE`; and
- all documentation separates observed simulator evidence, assumptions, unresolved risks, and
  real-world validation that has not occurred.

## Explicitly not implemented in WP-2

- no `cut_out_reveal` challenge kind or `cut_out_reveal_stopped` YAML;
- no `slow_lead_closing` or `steady_slow_lead` YAML/kind;
- no second MetaDrive actor, scheduler, selector, occlusion model, or visibility model;
- no observation, trace-event, summary, evidence-schema, artifact, metric, finding, review, or
  comparison model change;
- no change to `_CHALLENGE_OBSERVATION_SUMMARY_FIELDS` or historical schema-1/2 semantics;
- no ADAS policy, verifier, shield, gate, threshold, or warning-output change;
- no fault, regression, fixture, test, dependency, simulator-source, calibration-evidence, or
  generated-artifact change;
- no edit or rebaseline of `adas_nominal_slow_closing.yaml`; and
- no claim that decomposed single-actor coverage is composite equivalence or that current
  evidence establishes real-world safety.

## Recommendation

Keep WP-2 deferred. Ask the owner to choose between the recommended evidence-schema-3 actor
roster and continued decomposition before implementing the composite scenario. Independently,
approve a distinct scripted `steady_slow_lead` contract before claiming true slow-lead coverage.

## Top risks + mitigations

1. **Compatibility disguised as convenience:** freeze schema 1.0/2.0 and require explicit v3
   dispatch and golden historical verification.
2. **Identity/selection ambiguity:** store complete stable-ID rosters plus the selected ID, then
   recompute selection offline and fail closed on disagreement.
3. **Semantic overclaim:** keep current slow-lead and FCW limitations explicit; require measured
   persistent-speed evidence and stored warning output for stronger claims.

## Next 3 actions

1. Owner selects roster-v3, versioned flat extension, or continued deferral and records actor,
   selector, visibility, fault, review, and migration semantics.
2. Owner approves the separate steady-slow-lead contract and scenario/calibration acceptance
   plan, including whether warning output must become stored evidence.
3. Only after those decisions, execute the ordered versioned implementation plan with historical
   schema-1/2 preservation gates.
