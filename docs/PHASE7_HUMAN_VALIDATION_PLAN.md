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

## Fixed authority answer for every relevant task

Every relevant answer records all seven dimensions separately:

| Dimension | Current valid-evidence value |
|---|---|
| Gate verdict | Artifact-specific: PASS, CONDITIONAL, HOLD, or INVALID_EVIDENCE |
| Evidence integrity | Artifact-specific: INTERNALLY_CONSISTENT or INVALID_EVIDENCE |
| Origin | NOT_AUTHENTICATED |
| Authorization | NOT_EVALUATED |
| Deployment permission | NONE |
| Scope | SIMULATION_ONLY |
| Authoritative status | NOT_DEFINED |

These fields never collapse into “trusted,” “approved,” “safe,” or “deployable.”

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

Expected answer: gate `PASS`, integrity `INTERNALLY_CONSISTENT`, and the seven authority dimensions
above. PASS is not a safety, authentication, approval, certification, or deployment claim.

Authority response: use the fixed seven-field answer above.

## Task 2 — Non-compensatory collision HOLD

Prompt version: P7-T02-v1

Answer-key version: P7-T02-A1

Fixture: `handoff-p1-collision`.

Prompt: Explain why the decision is HOLD and identify its first supporting event.

Expected answer: the collision hard invariant controls; positive findings cannot compensate. The
participant states the seven authority dimensions.

Authority response: use the fixed seven-field answer above.

## Task 3 — Invalid-evidence quarantine

Prompt version: P7-T03-v1

Answer-key version: P7-T03-A1

Fixture: `phase1-tampered`.

Prompt: Explain which claims can be accepted after verification.

Expected answer: integrity and gate are `INVALID_EVIDENCE`; stored verdict/findings/metrics/timeline
and provenance claims are quarantined. No stored PASS is accepted. The seven authority dimensions
remain separate.

Authority response: use the fixed seven-field answer above.

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

The participant also reports all seven authority dimensions.

Authority response: use the fixed seven-field answer above.

## Task 5 — Action accountability

Prompt version: P7-T05-v1

Answer-key version: P7-T05-A1

Fixture: `handoff-p4-fault`. Evidence schema: 2.0. Scenario schema: 3.0.

Prompt: Distinguish candidate, permitted, and executed actions and attribute shield and control-fault
effects to their correct boundaries.

Expected answer: candidate is policy intent; permitted is shield output; executed is post-fault
simulator input. A control fault is not attributed to the shield. The seven authority dimensions
are explicit.

Authority response: use the fixed seven-field answer above.

## Task 6 — CONDITIONAL without permission

Prompt version: P7-T06-v1

Answer-key version: P7-T06-A1

Fixture: `handoff-p1-conditional`.

Prompt: Explain the outcome, required follow-up, and authority.

Expected answer: hard criteria pass, a soft criterion needs review, and CONDITIONAL does not grant
permission. Authorization remains NOT_EVALUATED and deployment permission NONE.

Authority response: use the fixed seven-field answer above.

## Task 7 — Non-causal mixed comparison

Prompt version: P7-T07-v1

Answer-key version: P7-T07-A1

Fixtures: `handoff-p3-cutin-baseline` → `handoff-p3-cutin-shielded`.

Prompt: Report the exact factual changes, then identify every interpretation the comparison does
not support.

Expected answer: minimum TTC is `1.8155836417275437 → 8.49579415469856 s`; verdict is unchanged
`HOLD`; the candidate records `SPEED_CAP at sequences 20, 26, and 32`; the candidate never entered
the TTC target band; it records zero TTC_BELOW_THRESHOLD target reasons; and it includes
pre-trigger SPEED_CAP confounding. The result is descriptive and non-causal.

Reject: engagement.

Reject: mechanism exercised.

Reject: causal.

Reject: winner.

Reject: safer.

Reject: advancement.

The participant must also reject any safety or mechanism-effect claim and state all seven authority
dimensions.

Authority response: use the fixed seven-field answer above.

## Task 8 — Provenance is not authenticated origin

Prompt version: P7-T08-v1

Answer-key version: P7-T08-A1

Fixture: `handoff-p2-metadrive`.

Prompt: Explain what recorded Git/simulator identity and local hashes establish and what they do
not establish.

Expected answer: they support internally consistent recorded identity and tamper evidence; they do
not authenticate origin, authorize promotion, or grant deployment permission.

Authority response: use the fixed seven-field answer above.

## Task 9 — Incompatible evidence

Prompt version: P7-T09-v1

Answer-key version: P7-T09-A1

Fixtures: `handoff-p3-lead-baseline` → `handoff-p3-cutin-shielded`.

Prompt: Decide whether deltas, ranking, or advancement may be inferred.

Expected answer: evidence is `INCOMPATIBLE`; no deltas, rank, winner, mechanism claim, or advancement
is available. Each side is independently reviewed before comparison. The seven authority fields
remain explicit.

Authority response: use the fixed seven-field answer above.

## Task 10 — Scoped keyboard and screen-reader observation

Prompt version: P7-T10-v1

Answer-key version: P7-T10-A1

Fixture: `handoff-phase5-demo`; representative nominal review only. No comparison is included.

Prompt: Complete the named keyboard-only nominal review flow and the named screen-reader nominal
review flow; record browser and assistive-technology versions, focus/order/name/state, blockers,
and assistance.

Expected result format: a scoped observation, not a general accessibility or WCAG claim. Task 10 is
excluded from the North Star denominator.

Authority response: use the fixed seven-field answer above.

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

Evidence custodian: Bo-Huei Lin.

Deletion owner: Bo-Huei Lin.

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
