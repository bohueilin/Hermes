# Hermes Phase 6 Reviewer-Comprehension Usability Test Plan

## Status and purpose

**Human-comprehension status: `NOT YET OBSERVED`.**

This is a prospective, moderated test plan. It contains no participant result and does not establish
reviewer readiness, accessibility, safety, authenticity, authorization, or deployment permission.
Use it to learn whether a reviewer can reason correctly from the local, read-only Hermes workbench
without mistaking presentation for evidence authority.

The core reasoning path under test is:

```text
What artifact?
→ Has it been verified?
→ What did the gate decide?
→ Why?
→ Which evidence supports the decision?
→ What evidence was unavailable?
→ What happened at the relevant events?
→ What does the result not establish?
```

## Cohort and sampling

Recruit **6–10 future participants** across product, safety, simulation, and engineering roles.
Include at least one participant from each role family and, when available, one keyboard-only user
and one screen-reader user. A participant may cover more than one role or access need, but the
moderator must record each role and assistive technology explicitly.

Participants should understand autonomy development or high-consequence evidence review but need
not know Hermes internals. Exclude anyone who implemented the screen being evaluated from the
primary comprehension measure; they may join a separate expert critique.

## Study setup

Run from a clean local checkout in the `hermes-dev` Python 3.11 environment:

```bash
cd /Users/bohueilin/Documents/GitHub/Hermes
conda activate hermes-dev
python -m pip install -e ".[dev,workbench]"
hermes workbench \
  --artifact-root artifacts \
  --host 127.0.0.1 \
  --port 8501 \
  --no-browser
```

Open `http://127.0.0.1:8501/` in a supported local browser. Record browser/version, operating
system, viewport, zoom, display scaling, input method, and assistive technology. Do not use a public
bind, remote artifact, upload, simulator run, policy run, or modified source bundle.

Before every session, independently record the exact root-relative locator and bundle digest for
each retained artifact used. Never auto-select a newest, official, recommended, or authoritative
artifact. If an expected fixture is absent or no longer verifies as described, stop that task and
record the discrepancy rather than substituting or repairing evidence.

## Moderator protocol

1. Read the neutral introduction; do not teach the trust model before testing it.
2. Ask the participant to think aloud, but do not correct an answer until it is recorded.
3. Record the participant's exact words, navigation path, time, errors, assistance, and evidence
   location in `docs/PHASE6_HUMAN_OBSERVATION_TEMPLATE.md`.
4. Distinguish unassisted success, success after a neutral prompt, and moderator-assisted success.
5. Trigger the task-specific stop conditions immediately. Preserve the screen state and exact
   quote; do not continue a workflow that could normalize an authority misconception.
6. Debrief only after all eligible tasks are complete.

Neutral introduction:

> Hermes reviews stored simulation evidence. Please use what the workbench shows to explain the
> decision and its limits. Treat every question as open; the interface may be wrong or unclear.

## Task 1 — Nominal PASS

Artifact: `handoff-phase5-demo`

Ask the participant to select and verify the artifact, then explain the result to a release owner.

Expected answers:

- exact selected directory and manifest run identity are distinguishable;
- gate verdict is `PASS`;
- integrity is `INTERNALLY_CONSISTENT`;
- origin/authenticity is `NOT_AUTHENTICATED`;
- authorization is `NOT_EVALUATED`;
- deployment permission is `NONE`;
- scope is `SIMULATION_ONLY`; and
- PASS is neither approval nor real-world safety evidence.

**Immediate stop:** any participant says PASS means authenticated, approved, safe, certified,
road-ready, authoritative, or deployable.

## Task 2 — Collision HOLD

Artifact: `handoff-p1-collision`

Ask the participant why advancement was held and to open the first supporting event.

Expected answers:

- collision is a non-compensatory hard failure;
- the first supporting event can be found from Evidence and opened in Timeline;
- route progress cannot compensate for the collision; and
- a `HOLD` can still be based on `INTERNALLY_CONSISTENT` evidence.

**Immediate stop:** the participant treats progress, a score, or another passing signal as
overriding the collision.

## Task 3 — Tampered evidence

Artifact: `phase1-tampered`

Ask what can and cannot be used for a decision.

Expected answers:

- the result is `INVALID_EVIDENCE`;
- any stored PASS is quarantined;
- stored findings, metrics, normal timeline, and accepted provenance are not decision evidence; and
- invalid evidence is rejection, not a low score.

**Immediate stop:** the participant uses a quarantined claim for a decision or describes invalid
evidence as a weak but usable score.

## Task 4 — NOT_AVAILABLE

Use a separately approved, independently verified fixture that contains typed required-unavailable,
optional-unavailable, and not-applicable items. No retained source artifact currently establishes
all three presentation states. Do not mutate a retained bundle or fabricate a run to perform this
task. Until a suitable fixture exists, record this task as `NOT RUN — FIXTURE NOT AVAILABLE`.

Expected answers:

- required unavailable is distinguished from optional unavailable;
- not applicable is distinguished from both unavailable states;
- the reason and gate consequence are stated; and
- missing evidence is not read as zero, blank, false, infinity, pass, or a flat line.

**Immediate stop:** missing evidence is interpreted as zero or pass.

## Task 5 — Action accountability

Use `handoff-p3-lead-shielded` or another compatible retained shield/fault artifact whose digest was
recorded at session start. Ask the participant to use the `Action accountability` Timeline preset
and explain one changed action.

Expected answers:

- candidate action;
- shield-permitted action;
- executed action;
- override reason; and
- which action the simulator executed.

For a fault case, the participant must not attribute a control delay or saturation to the shield.

**Immediate stop:** candidate, permitted, and executed actions are collapsed into one action or
actuator-fault behavior is attributed to the shield.

## Task 6 — Mixed lead comparison

Pair:

```text
handoff-p3-lead-baseline
handoff-p3-lead-shielded
```

Ask for a decision summary suitable for a product review.

Expected answers:

- minimum time to collision (TTC) improved;
- route completion, acceleration, and jerk regressed;
- the gate verdict did not improve;
- there is no overall winner; and
- overall advancement is not established.

**Immediate stop:** the interface causes a blanket “candidate is safer,” winner, recommendation,
promotion, or overall-advancement conclusion.

## Task 7 — Mixed cut-in comparison

Pair:

```text
handoff-p3-cutin-baseline
handoff-p3-cutin-shielded
```

Use the same mixed-outcome comprehension gate as Task 6. Also ask what the scenario proves.

Expected answers:

- TTC improved while route/comfort outcomes regressed;
- the `HOLD` verdict did not improve;
- there is no winner or advancement claim; and
- scripted kinematic replay does not establish realistic traffic behavior.

**Immediate stop:** the participant infers overall safety, realistic cut-in behavior, or a policy
promotion conclusion.

## Task 8 — Provenance versus origin

Use `handoff-p2-metadrive` and ask what the recorded repository, simulator, adapter, policy, and
digest fields establish.

Expected answers:

- those fields are recorded provenance;
- the evidence origin remains `NOT_AUTHENTICATED`;
- a local hash is not a producer signature; and
- recorded provenance is not authorization or deployment permission.

**Immediate stop:** self-asserted provenance or a hash is described as authenticated origin.

## Task 9 — Incompatible comparison

Pair:

```text
handoff-p3-lead-baseline
handoff-p3-cutin-shielded
```

Ask the participant to explain why no delta is shown and what remains possible.

Expected answers:

- both artifacts can be reviewed independently;
- the pair is incompatible for delta analysis;
- no metric change, chart, winner, or advancement conclusion is available; and
- incompatibility is not evidence that either artifact is invalid.

**Immediate stop:** the participant infers deltas or ranks the pair despite incompatibility.

## Task 10 — Accessibility workflow

For keyboard and screen-reader users, ask the participant to complete a representative end-to-end
flow without pointer-only assistance:

1. enter and verify `handoff-phase5-demo`;
2. read Tier 1 decision state and Tier 2 authority boundaries;
3. open one finding and inspect a supporting event;
4. use the synchronized Timeline table; and
5. complete the compatible lead comparison.

Record focus order, visible focus, control names/states, expansion/collapse behavior, error/status
announcements, heading navigation, table semantics, 200% zoom/reflow, and any horizontal-scroll
dependency. This task is an observation protocol, not a WCAG conformance audit.

**Immediate stop:** essential trust/decision content or the completion path is unavailable to the
participant's input or assistive technology.

## Measures and prospective acceptance gate

Record per task:

- completion without assistance, after neutral prompt, or with moderator assistance;
- time to first correct decision summary;
- wrong turns and recovery;
- exact answer for gate, integrity, authenticity, authorization, permission, and scope;
- correct hard-failure and unavailable-evidence interpretation;
- correct mixed-comparison synthesis;
- confidence before moderator correction; and
- severity and persistence of every misconception.

Do not reduce the study to one composite score. Report task-level evidence and role/accessibility
patterns separately. The prospective gate requires zero critical trust misconceptions across the
observed cohort: no PASS-as-safe/authenticated/approved/deployable, no quarantined-claim use, no
missing-as-zero/pass, and no comparison-winner claim. Any such result is a stop condition and keeps
the iteration on `HOLD` for human comprehension until redesigned and retested.

## Evidence handling and status promotion

- Preserve completed observation records without participant names or unnecessary personal data.
- Link every finding to participant ID, task, artifact locator/digest, timestamp, screenshot or
  note location, and moderator intervention.
- Separate product/visual findings from verifier, integrity, security, and accessibility findings.
- Assign a residual-risk owner and retest criterion to each unresolved issue.
- Do not promote human comprehension from `NOT YET OBSERVED` until real sessions covering the
  planned cohort are completed, reviewed, and summarized **and every critical task—including Task 4
  `NOT_AVAILABLE`—has an executable independently verified fixture and observed result**. Cohort
  completion alone is insufficient. If any critical fixture or result is missing, the status remains
  `NOT YET OBSERVED`.
- Automated correctness, browser screenshots, and AppTest results are not substitutes for the
  moderated participant evidence defined here.
