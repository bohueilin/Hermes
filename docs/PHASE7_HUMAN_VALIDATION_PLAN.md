# Hermes Phase 7 Human Validation Plan

## Status, purpose, and authority

Protocol version: `P7-HV-1.0`.

Human comprehension, manual visual quality, accessibility, expert critique, pilot, and main-cohort
outcomes are `NOT YET OBSERVED`. This is a prospective moderator instrument, not a study result.
It evaluates bounded comprehension of stored `SIMULATION_ONLY` evidence. Deployment permission is
`NONE`; nothing in this protocol establishes safety, authenticity, authorization, approval,
certification, or physical-hardware permission.

The North Star is correct unassisted bounded-advancement reasoning by declared non-author
reviewers, within a per-attempt bound frozen before the main cohort, with zero critical trust
misconceptions. Tasks 1–9 only form the North Star denominator. Task 10 is excluded from the North
Star and is reported as a separate scoped accessibility observation.

## Fixed authority contract for every relevant task

Every relevant answer records all seven dimensions separately:

| Dimension | Current valid-evidence value |
|---|---|
| Gate verdict | Frozen exactly in each task scoring checklist |
| Evidence integrity | Frozen exactly in each task scoring checklist |
| Origin | NOT_AUTHENTICATED |
| Authorization | NOT_EVALUATED |
| Deployment permission | NONE |
| Scope | SIMULATION_ONLY |
| Authoritative status | NOT_DEFINED |

Each task checklist freezes its exact Gate verdict and Evidence integrity value (or both exact side
values for a pair). The other five values are fixed above. These fields never collapse into
“trusted,” “approved,” “safe,” or “deployable.” A response is correct only when it satisfies every
item in that task's checklist; partial credit does not enter the North Star numerator.

The six independent study status fields are maintained exactly as `Automated correctness`,
`Manual visual quality`, `Accessibility`, `Expert critique`, `Pilot human comprehension`, and
`Main-cohort human comprehension`. Automated correctness is test-derived; it cannot be promoted by
prose. The latter five remain `NOT YET OBSERVED` unless their named protocols actually run.

## Session prerequisites

- Start a fresh loopback-only workbench process for each participant; no remote ingestion, upload,
  simulator execution, artifact write, or public bind.
- Freshly verify every exact registry-bound fixture before the session. Stop on a digest,
  inventory, run-ID, schema, profile, gate, or integrity mismatch; never repair or substitute it.
- Record participant ID, declared non-author status and role, protocol version, assigned order,
  browser/version, viewport, input method, and any named assistive technology.
- Pilot task order, maximum session duration, and break rule are frozen before use.
- Tasks 1–9 are deterministically counterbalanced by participant-order assignment. Every session
  preserves its assigned order. Record fatigue and carryover observations.
- Main-cohort eligibility: 6–10 declared non-author participants spanning the frozen role coverage.
- Pilot cohort: 2–3 declared non-author participants.

Frozen eligible roles: PRODUCT, SAFETY, SIMULATION, ENGINEERING. The main cohort must include at
least one eligible participant from each frozen role. A participant declares exactly one primary
frozen role for slicing. Eligible means age 18 or older, explicit consent, declared non-author of
the Hermes Phase 7 instrument, answer keys, fixtures, and implementation, no access to the frozen
answer keys before scoring, and no role as moderator for that scored session. Anyone who authored
or materially reviewed any of those surfaces is ineligible for the participant numerator and
denominator. Eligibility is recorded before task exposure and is not changed based on performance.

Neutral introduction:

> Hermes displays stored simulation evidence and its limits. Use only what the interface shows to
> explain the decision. Treat each question as open; the interface and evidence may be invalid,
> unavailable, or insufficient.

## Assistance, correction, and completion

Allowed assistance states are exactly:

```text
UNASSISTED
NEUTRAL_PROMPT
INSTRUCTIONAL_ASSISTANCE
NOT_COMPLETED
NOT_RUN
```

Any prompt removes the attempt from the unassisted numerator. Neutral clarification may restate
the task but may not name an answer or evidence value. Instructional help begins when the moderator
supplies an answer, location, or interpretation. Record exact prompt words and time. Correction may
occur only after the scored attempt is closed or an immediate-stop condition fires. Record exact
correction words and time. A scored task is never repeated after teaching its answer. Record every
protocol deviation. Record withdrawal and completion state.

Technical invalidation is `NOT_RUN_TECHNICAL`: it remains denominator-visible, blocks 100%
executable-instrument coverage, and must be corrected and rerun under the unchanged frozen protocol
before cohort closure.

## Timing and scoring

- Pilot median hypothesis (single-artifact): <=120 seconds — PROPOSED.
- Pilot median hypothesis (accountability/comparison): <=240 seconds — PROPOSED.
- Frozen per-attempt numerator bound: TBD_BEFORE_MAIN_COHORT.
- The cohort-median hypotheses are not per-attempt timeouts.

The hypotheses remain proposed until reviewed after a 2–3-person non-author pilot and frozen before
main-cohort recruitment/results. Numerator: exact count of assigned Tasks 1–9 completed correctly,
UNASSISTED, and within the frozen bound. Denominator: every assigned Tasks 1–9 opportunity. Only
protocol-defined withdrawals may be excluded, and every exclusion is reported explicitly. Never
exclude an eligible attempt because it is incorrect. Report raw eligible participant and task
counts, withdrawals, assistance, conditions, and unfavorable outcomes. Report task,
participant-role, and accessibility slices separately. No composite score. Never turn the small raw
count into an unqualified population percentage.

Proposed readiness hypotheses are: At least 80% correct unassisted eligible critical attempts —
PROPOSED; the two cohort-median timing hypotheses above; Zero critical trust misconceptions —
PROPOSED; and 100% executable critical fixture coverage — PROPOSED.

`READY_FOR_PILOT` requires complete executable Tasks 1–10 and the required owner-operated expert,
manual visual, and accessibility prerequisites. `READY_FOR_MAIN_COHORT` additionally requires the
2–3-person non-author pilot, resolved material defects, frozen thresholds/prompts/order/analysis/
stops, and unchanged fixture digests. Material prompt, key, fixture, UI, or threshold changes
exclude pilot results and require the revised protocol to be frozen again before recruitment.

`READY_FOR_PILOT` also requires no open P0/P1 instrument or authority finding and zero tolerance
for any authority label or state mismatch, hidden required failure, keyboard trap or unreachable
critical control, or fixture digest mismatch. `READY_FOR_MAIN_COHORT` requires no open P0/P1
instrument finding and preserves the same zero-tolerance conditions; none may be accepted as
risk-owned debt for recruitment.

## Task 1 — Nominal PASS and authority

Prompt version: P7-T01-v1

Answer-key version: P7-T01-A1

Fixture: `handoff-phase5-demo`.

Prompt: Verify the exact artifact, explain the stored decision, and state what it authorizes.

Scoring checklist — correct only if every item is satisfied:

- select fixture and manifest run ID `handoff-phase5-demo`;
- report gate PASS and integrity INTERNALLY_CONSISTENT;
- state that PASS is not a safety, authentication, approval, certification, authorization, or
  deployment claim; and
- report the exact seven-field authority state below.

Required authority state: Gate verdict PASS; Evidence integrity INTERNALLY_CONSISTENT; Origin
NOT_AUTHENTICATED; Authorization NOT_EVALUATED; Deployment permission NONE; Scope SIMULATION_ONLY;
Authoritative status NOT_DEFINED.

Required source references: `manifest.json /run_id`, `verdict.json /verdict`, `bundle.sha256`
whole-file pointer `""`, and `trace.sha256` whole-file pointer `""`.

## Task 2 — Non-compensatory collision HOLD

Prompt version: P7-T02-v1

Answer-key version: P7-T02-A1

Fixture: `handoff-p1-collision`.

Prompt: Explain why the decision is HOLD and identify its first supporting event.

Scoring checklist — correct only if every item is satisfied:

- report gate HOLD and integrity INTERNALLY_CONSISTENT;
- identify that `collision.zero` is REQUIRED / FAIL / AVAILABLE, measured 1.0 count against
  LTE 0 count, with a hard-invariant HOLD consequence;
- identify that sequence 11 remains 0 collisions and the first supporting collision is sequence
  12 at 1.3 s; and
- state the exact rationale: `Collision hard invariant failed; positive soft results cannot
  compensate.` Positive results do not compensate for the hard failure.

Required authority state: Gate verdict HOLD; Evidence integrity INTERNALLY_CONSISTENT; Origin
NOT_AUTHENTICATED; Authorization NOT_EVALUATED; Deployment permission NONE; Scope SIMULATION_ONLY;
Authoritative status NOT_DEFINED.

Required source references: `events.jsonl /vehicle_state/collision_count @ sequence 12`,
`gate-config.resolved.yaml /hard/max_collision_count`, `metrics.json /collision_count`,
`findings.json /findings/1`, and `verdict.json /verdict`.

## Task 3 — Invalid-evidence quarantine

Prompt version: P7-T03-v1

Answer-key version: P7-T03-A1

Fixture: `phase1-tampered`.

Prompt: Explain which claims can be accepted after verification.

Scoring checklist — correct only if every item is satisfied:

- select locator `phase1-tampered` and distinguish it from manifest run ID `phase1-nominal`;
- report gate INVALID_EVIDENCE and integrity INVALID_EVIDENCE;
- identify observed bundle root
  `6eac41695c890dd08758bc6da95e8ae0092d9120057af4693fc64847017d97de` versus computed bundle
  root `831f22ed419e4b13ce5d0a1aa3bc1444b2ca523d60edb8d4c75eaa7491e1d61e`, and observed trace
  root `f515c16243d2b07c8a4b4ffd286edd5ff1c4ffa9486d3b28d034b40420ba234e` with no accepted
  computed trace root;
- state that the bundle mismatch, events digest mismatch, and sequence-0 hash mismatch quarantine
  stored verdict, findings, metrics, timeline, and recorded provenance; no stored PASS is accepted;
  and
- report the exact seven-field authority state below.

Required authority state: Gate verdict INVALID_EVIDENCE; Evidence integrity INVALID_EVIDENCE;
Origin NOT_AUTHENTICATED; Authorization NOT_EVALUATED; Deployment permission NONE; Scope
SIMULATION_ONLY; Authoritative status NOT_DEFINED.

Required source references: `bundle.sha256` whole-file pointer `""`, `manifest.json /run_id`,
`events.jsonl` whole-event pointer `""` at sequence 0, and the three
`ARTIFACT_VERIFICATION_ERROR` diagnostics. Quarantined stored fields are not cited as accepted
facts.

## Task 4 — Evidence availability and consequence

Prompt version: P7-T04-v1

Answer-key version: P7-T04-A1

Fixture: `handoff-p7-evidence-availability`.

Task 4: classification, reason, and consequence only. No timeline scrubbing is required. No
comparison-availability inference is required.

Prompt: Classify one required-unavailable, one optional-unavailable, and one not-applicable signal;
give each reason and gate consequence, then explain the overall HOLD.

Expected answer:

- `progress.required`: REQUIRED / NOT_AVAILABLE, reason `route progress explicitly unavailable`,
  effect `CONFIGURED_MISSING_REQUIRED_EVIDENCE`, controlling result HOLD;
- `comfort.jerk`: OPTIONAL / NOT_AVAILABLE, reason
  `at least two events are required to compute jerk`, `effect=CONDITIONAL`,
  `result_if_controlling=CONDITIONAL`, `listed_in_soft_failures=true`, and
  `listed_in_supporting_findings=true`;
- `fault.coverage.required`: NOT_APPLICABLE / NOT_APPLICABLE under legacy profile, consequence
  `NO_EFFECT`; and
- the overall verdict remains HOLD because required progress unavailability has higher precedence.

Scoring checklist — correct only if every item is satisfied:

- classify and explain all three rows exactly as listed above;
- distinguish REQUIRED / NOT_AVAILABLE, OPTIONAL / NOT_AVAILABLE, and NOT_APPLICABLE without
  replacing any with zero, false, blank, or pass;
- report gate HOLD and integrity INTERNALLY_CONSISTENT, with required progress unavailability
  controlling over the subordinate comfort consequence; and
- report the exact seven-field authority state below.

Required authority state: Gate verdict HOLD; Evidence integrity INTERNALLY_CONSISTENT; Origin
NOT_AUTHENTICATED; Authorization NOT_EVALUATED; Deployment permission NONE; Scope SIMULATION_ONLY;
Authoritative status NOT_DEFINED.

Required source references: `findings.json /findings/3`, `metrics.json /route_completion_pct`,
`findings.json /findings/5`, `metrics.json /max_abs_jerk_mps3`, and the
`fault.coverage.required` sufficiency row shown by the review envelope.

## Task 5 — Action accountability

Prompt version: P7-T05-v1

Answer-key version: P7-T05-A1

Fixture: `handoff-p4-fault`. Evidence schema: 2.0. Scenario schema: 3.0.

Prompt: Distinguish candidate, permitted, and executed actions and attribute shield and control-fault
effects to their correct boundaries.

Scoring checklist — correct only if every item is satisfied:

- report gate HOLD and integrity INTERNALLY_CONSISTENT;
- at event 9 at 1.0 s, report candidate brake 0.9897080762989154, steering
  -0.5511323602891678, throttle 0.0 and permitted brake 1.0, steering -0.5511323809623718,
  throttle 0.0; attribute the `SPEED_CAP` override only to the candidate-to-permitted shield
  boundary;
- at event 9, report observation delivery from sequence 8, delivered-from time 0.8 s, age
  0.09999999999999998 s, with `OBSERVATION_DELAY` and `OBSERVATION_NOISE`;
- do not claim a same-row causal chain: `CONTROL_DELAY` carries the event-9 permitted action into
  event 10 at 1.1 s, where `executed_from_sequence 9`, `executed_from_candidate_time_s 0.9`,
  `execution_time_s 1.0`, pre-saturation brake 1.0, steering -0.5511323809623718, throttle 0.0,
  and control latency 99.99999999999997 ms are recorded;
- at event 10, report executed brake 0.5, steering -0.25, throttle 0.0 and attribute
  `CONTROL_DELAY`, `STEERING_SATURATION`, and `BRAKE_SATURATION` to the permitted-to-executed
  control-fault boundary, never to the shield; and
- report the exact seven-field authority state below.

Required authority state: Gate verdict HOLD; Evidence integrity INTERNALLY_CONSISTENT; Origin
NOT_AUTHENTICATED; Authorization NOT_EVALUATED; Deployment permission NONE; Scope SIMULATION_ONLY;
Authoritative status NOT_DEFINED.

Required source references: `events.jsonl /candidate_action @ sequence 9`,
`events.jsonl /permitted_action @ sequence 9`, `events.jsonl /override_reasons @ sequence 9`,
`events.jsonl /observation_fault_evidence/applied_faults @ sequence 9`,
`events.jsonl /observation_fault_evidence/delivered_from_sequence @ sequence 9`,
`events.jsonl /observation_fault_evidence/delivered_from_time_s @ sequence 9`,
`events.jsonl /observation_fault_evidence/delivered_observation/observation_age_s @ sequence 9`,
`events.jsonl /executed_action @ sequence 10`,
`events.jsonl /control_fault_evidence/applied_faults @ sequence 10`,
`events.jsonl /control_fault_evidence/executed_from_sequence @ sequence 10`,
`events.jsonl /control_fault_evidence/executed_from_candidate_time_s @ sequence 10`,
`events.jsonl /control_fault_evidence/execution_time_s @ sequence 10`,
`events.jsonl /control_fault_evidence/control_latency_ms/value @ sequence 10`, and
`events.jsonl /control_fault_evidence/pre_saturation_action @ sequence 10`.

## Task 6 — CONDITIONAL without permission

Prompt version: P7-T06-v1

Answer-key version: P7-T06-A1

Fixture: `handoff-p1-conditional`.

Prompt: Explain the outcome, required follow-up, and authority.

Scoring checklist — correct only if every item is satisfied:

- report gate CONDITIONAL and integrity INTERNALLY_CONSISTENT;
- identify that `comfort.acceleration` is OPTIONAL / FAIL / AVAILABLE and the sole controlling soft
  finding, measured 6.0 m/s^2 against `max_abs_acceleration_mps2 <= 4.0` after
  `ABSOLUTE_VALUE + MAX_OVER_EVENTS`;
- report that first support is sequence 12 at 1.3 s, with effect CONDITIONAL and
  result_if_controlling CONDITIONAL;
- state the exact rationale: `Hard criteria passed, but illustrative soft criteria failed or are
  NOT_AVAILABLE and require human review; Hermes grants no deployment permission.`; and
- state that CONDITIONAL requires review. CONDITIONAL does not grant permission, authorization, or
  deployment permission.

Required authority state: Gate verdict CONDITIONAL; Evidence integrity INTERNALLY_CONSISTENT;
Origin NOT_AUTHENTICATED; Authorization NOT_EVALUATED; Deployment permission NONE; Scope
SIMULATION_ONLY; Authoritative status NOT_DEFINED.

Required source references: `events.jsonl /vehicle_state/acceleration_mps2 @ sequence 12`,
`gate-config.resolved.yaml /soft/max_abs_acceleration_mps2`,
`metrics.json /max_abs_acceleration_mps2`, `findings.json /findings/4`, and
`verdict.json /verdict`.

## Task 7 — Non-causal mixed comparison

Prompt version: P7-T07-v1

Answer-key version: P7-T07-A1

Fixtures: `handoff-p3-cutin-baseline` → `handoff-p3-cutin-shielded`.

Prompt: Report the exact factual changes, then identify every interpretation the comparison does
not support.

Scoring checklist — correct only if every item is satisfied:

- report comparison COMPATIBLE, baseline Gate verdict HOLD / Evidence integrity
  INTERNALLY_CONSISTENT, candidate Gate verdict HOLD / Evidence integrity
  INTERNALLY_CONSISTENT, and unchanged verdict `HOLD → HOLD`;
- report minimum TTC: 1.8155836417275437 → 8.49579415469856 s (IMPROVED);
- report route completion: 84.88178621406203 → 84.39151677812995 % (REGRESSED);
- report maximum absolute acceleration: 12.683377265917573 → 13.003747463227677 m/s^2
  (REGRESSED);
- report maximum absolute jerk: 128.41591835005693 → 157.565283775339 m/s^3 (REGRESSED);
- report `SPEED_CAP at sequences 20, 26, and 32`, the exact candidate override histogram
  `{SPEED_CAP: 3}`, and zero recorded `TTC_BELOW_THRESHOLD` reasons;
- state that the stored review evidence does not demonstrate TTC-target intervention or mechanism
  engagement; phase labels, the shield's configured TTC threshold, and target-band recomputation
  are not exposed by the approved participant interface and therefore are not scored; and
- characterize the mixed result as descriptive and non-causal, with no aggregate winner or
  advancement inference.

Reject: engagement.

Reject: mechanism exercised.

Reject: causal.

Reject: winner.

Reject: safer.

Reject: advancement.

The participant must also reject any safety or mechanism-effect claim.

Required authority state: baseline Gate verdict HOLD / Evidence integrity INTERNALLY_CONSISTENT;
candidate Gate verdict HOLD / Evidence integrity INTERNALLY_CONSISTENT; Origin NOT_AUTHENTICATED;
Authorization NOT_EVALUATED; Deployment permission NONE; Scope SIMULATION_ONLY; Authoritative
status NOT_DEFINED.

Required source references: `BASELINE metrics.json /minimum_ttc_s`,
`CANDIDATE metrics.json /minimum_ttc_s`, both sides' `metrics.json /route_completion_pct`,
`metrics.json /max_abs_acceleration_mps2`, and `metrics.json /max_abs_jerk_mps3`; both sides'
`verdict.json /verdict`; `CANDIDATE events.jsonl /override_reasons @ sequences 20, 26, and 32`;
and `CANDIDATE metrics.json /shield_override_reasons`.

## Task 8 — Provenance is not authenticated origin

Prompt version: P7-T08-v1

Answer-key version: P7-T08-A1

Fixture: `handoff-p2-metadrive`.

Prompt: Explain what recorded Git/simulator identity and local hashes establish and what they do
not establish.

Scoring checklist — correct only if every item is satisfied:

- select fixture and manifest run ID `handoff-p2-metadrive` and report gate PASS / integrity
  INTERNALLY_CONSISTENT;
- report recorded Hermes 0.1.0 commit
  `3c32c529e8be7127fbd71ecc467da007b2f72d5f`, dirty false; recorded MetaDrive adapter 1.0;
  and recorded simulator `metadrive` 0.4.3 commit
  `85e5dadc6c7436d324348f6e3d8f8e680c06b4db`;
- state that the recorded identities and local hashes support internal consistency and tamper
  evidence only; they do not authenticate origin, authorize promotion, or grant deployment
  permission; and
- report the exact seven-field authority state below.

Required authority state: Gate verdict PASS; Evidence integrity INTERNALLY_CONSISTENT; Origin
NOT_AUTHENTICATED; Authorization NOT_EVALUATED; Deployment permission NONE; Scope SIMULATION_ONLY;
Authoritative status NOT_DEFINED.

Required source references: `manifest.json /hermes_version`, `manifest.json /repository_commit`,
`manifest.json /repository_dirty`, `manifest.json /adapter_name`, `manifest.json /adapter_version`,
`manifest.json /simulator_name`, `manifest.json /simulator_version`,
`manifest.json /simulator_commit`, `bundle.sha256` whole-file pointer `""`, and `trace.sha256`
whole-file pointer `""`.

## Task 9 — Incompatible evidence

Prompt version: P7-T09-v1

Answer-key version: P7-T09-A1

Fixtures: `handoff-p3-lead-baseline` → `handoff-p3-cutin-shielded`.

Prompt: Decide whether deltas, ranking, or advancement may be inferred.

Scoring checklist — correct only if every item is satisfied:

- independently report baseline Gate verdict CONDITIONAL / Evidence integrity
  INTERNALLY_CONSISTENT and candidate Gate verdict HOLD / Evidence integrity
  INTERNALLY_CONSISTENT;
- report comparison INCOMPATIBLE and state that INCOMPATIBLE does not mean either side is
  INVALID_EVIDENCE;
- identify all three exact mismatches: scenario digest baseline
  `a3b738431af234f4d2751667e8fee869307bc7c6d32b69fa71b602d340b48aaf` versus candidate
  `5d96994b9a1efd7626f162d852501a7c51c358e865be24a5c7929c2de5129e32`; scenario name
  `lead_vehicle_hard_brake` versus `cut_in_near_field`; and adapter-config digest baseline
  `4bf4f0051f46a079abf3d208773ea9ed668e0888f81c1b70f24752adcd9bc4a3` versus candidate
  `d8e9e31b3f069fb9cbd26d5331747255315a112109af29345ccd6e1fddf0b999`;
- state that no deltas, verdict delta, charts, rank, winner, mechanism claim, or advancement may be
  inferred; and
- report the exact seven-field authority state below.

Required authority state: baseline Gate verdict CONDITIONAL / Evidence integrity
INTERNALLY_CONSISTENT; candidate Gate verdict HOLD / Evidence integrity INTERNALLY_CONSISTENT;
Origin NOT_AUTHENTICATED; Authorization NOT_EVALUATED; Deployment permission NONE; Scope
SIMULATION_ONLY; Authoritative status NOT_DEFINED.

Required source references: both sides' `manifest.json /scenario_digest`,
`manifest.json /scenario_name`, and `manifest.json /adapter_config_digest`; BASELINE and CANDIDATE
`verdict.json /verdict`; and each side's independently verified bundle and trace roots.

## Task 10 — Scoped keyboard and screen-reader observation

Prompt version: P7-T10-v1

Answer-key version: P7-T10-A1

Fixture: `handoff-phase5-demo`; representative nominal review only. No comparison is included.

Prompt: Complete the named keyboard-only nominal review flow and the named screen-reader nominal
review flow; record browser and assistive-technology versions, focus/order/name/state, blockers,
and assistance.

Scoring checklist — correct only if every item is satisfied:

- bind the observation to protocol/task version, implementation commit, registry digest, fresh
  verification, exact fixture/run/digests, and operation command;
- complete both named nominal-review flows and record exact browser/assistive-technology versions,
  focus/order/name/state, blockers, and assistance without generalizing beyond the observed setup;
- report fixture Gate verdict PASS and Evidence integrity INTERNALLY_CONSISTENT while preserving
  all five fixed non-gate authority states; and
- state that the record is not a WCAG claim and Task 10 is excluded from the North Star denominator.

Required authority state: Gate verdict PASS; Evidence integrity INTERNALLY_CONSISTENT; Origin
NOT_AUTHENTICATED; Authorization NOT_EVALUATED; Deployment permission NONE; Scope SIMULATION_ONLY;
Authoritative status NOT_DEFINED.

Required source references: `manifest.json /run_id`, `verdict.json /verdict`, `bundle.sha256`
whole-file pointer `""`, `trace.sha256` whole-file pointer `""`, plus the bound observation record
for the exact Task 10 operation.

## Immediate-stop conditions

Stop, preserve exact quote/state, record correction/deviation, and hold promotion if a participant:

- treats PASS or CONDITIONAL as safe, authenticated, authoritative, approved, or deployable;
- uses quarantined evidence;
- treats a hard failure as compensable;
- reads unavailable as zero, false, blank, infinity, or pass;
- collapses candidate, permitted, and executed actions;
- attributes a control fault to the shield;
- declares a winner, safer, or advancement from mixed comparison;
- attributes a mixed-pair metric delta to the challenge or shield;
- treats a recorded intervention as proof of causal effect;
- asserts TTC-mechanism engagement from comparison evidence alone;
- infers deltas from incompatibility; or
- treats provenance or hash as an origin signature.

Also stop for fixture digest mismatch, failed verification, artifact mutation, contradictory answer
key, moderator teaching, or an essential inaccessible workflow.

## Privacy, custody, and committed-data rule

Participant IDs only. No names, emails, employers, or employer-confidential information in Git.
Warn participants: do not share employer-confidential information. Obtain explicit recording
consent. Store encrypted raw data outside Git and artifacts/.

Evidence custodian: UNASSIGNED — proposed owner requires explicit written acceptance.

Deletion owner: UNASSIGNED — proposed owner requires explicit written acceptance.

Recruitment is blocked until both owners explicitly accept their responsibilities and the accepted
names are recorded in a new reviewed protocol version. This document does not assign either role
by inference.

Recommended deletion: 30 days after accepted synthesis. Only blank templates and de-identified
accepted synthesis may be committed. Separate participant quote verbatim from observer inference.

On unexpected generation exit, oracle mismatch, digest mismatch, or immutability mismatch,
preserve the command, repository state, output, artifact, and diagnostics; mark the instrument
`HOLD`, do not bind the fixture, and retry only through a separately reviewed new scenario/run
version.

## Promotion boundary and bounded reporting

Implementer dry runs establish executability only. Tests, screenshots, expert critique, a pilot,
or partial sessions cannot promote comprehension. `HUMAN_EVIDENCE_OBSERVED` means the frozen main
cohort ran and actual outcomes were recorded. `COMPREHENSION_GATE_MET` is separate and requires all
frozen thresholds, zero critical misconceptions, and 100% executable critical-task coverage. If
evidence exists but the gate fails, report `HOLD AND REDESIGN`.

Any eventual synthesis is bounded to the observed sample, tasks, exact conditions, raw counts,
withdrawals, assistance, deviations, and limitations. It must not generalize to reviewer
populations, Waymo practice, safety readiness, certification, authorization, or deployment.
