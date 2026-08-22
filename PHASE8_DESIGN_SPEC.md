# Hermes Phase 8 — Design Spec: Agentic Workflows for ADAS Development

**Status:** For design review. Implemented through the FCW/AEB slice; §10 lists what is
specified but not yet built.
**Audience:** Design reviewers, AV simulation/validation engineers, platform PMs.
**Scope boundary:** Simulation only. No physical vehicle, no CAN, no standards or
certification claim. Every threshold in this document is illustrative.

---

## 1. Problem

Agentic AI is obviously useful across AV development — triage, curation, regression
authoring, analysis. The obstacle is not capability. It is that an AV development pipeline
is a *governed* pipeline: a change to the regression suite, or to what counts as a passing
run, is a safety-relevant act. Teams that would benefit most from agents are the ones least
able to accept "the model decided."

So the design question is not "what can an agent do here." It is:

> **Where exactly is the boundary between what an agent may propose and what only a
> deterministic system or a human may decide — and how is that boundary enforced, rather
> than merely intended?**

A boundary that lives in a prompt is a suggestion. A boundary that lives in the tool layer
is a property of the system.

## 2. Thesis

> Model proposes. Environment verifies. Gate decides. Trace proves. **Capability is not
> permission.**

Every design decision below follows from taking that literally.

## 3. Non-goals

- Any claim of production ADAS capability, standards compliance, or certification.
- An LLM anywhere in the real-time control loop.
- Perception. Object state is simulator ground truth.
- Scale. This is a single-host reference implementation, not a fleet platform.
- Replacing human judgment on high-consequence decisions. The design deliberately keeps a
  human in the loop at exactly one place and makes that place explicit.

## 4. Users and jobs

| Persona | Job to be done |
|---|---|
| ADAS/systems engineer | "When I change a controller, tell me whether I improved safety without buying it with false interventions or comfort." |
| Simulation/validation engineer | "When a failure is found, make it reproducible, varied, and permanently part of regression coverage." |
| Release reviewer | "Let me decide on evidence, not on demo quality or agent prose." |
| Developer using agentic automation | "Let me say 'investigate this late-AEB failure and add coverage' and get a reviewable proposal, not a pile of stitched-together scripts." |
| **Platform integrator** | **"Let me discover what agents and tools exist, configure them, and integrate them into my own pipeline without reading your source."** |

The last one is the productization requirement, and it is why tool discoverability, typed
envelopes and file-based configuration are design requirements rather than polish.

## 5. Architecture

Eight layers. The agentic layer sits *around* the loop, never inside it.

```
Scenario library (versioned, digest-identified)
        │
Simulator adapter (MetaDrive, commit-pinned, deterministic)
        │
ADAS functions (FCW, AEB — ordinary DrivingPolicy implementations)
        │
Fault injection (deterministic, content-digest seeded)
        │
Evidence (hash-chained trace, digest-bound identity)
        │
Offline evaluators (independent oracle, gate-config thresholds)
        │
Release gate (non-compensatory, ordered precedence)
        │
Agentic layer ── deterministic tool layer ── approval boundary
```

Two structural choices worth defending:

**ADAS functions are policies, not a new controller API.** Phase 8 adds no parallel
contract. An ADAS function implements the existing `DrivingPolicy` protocol, so it inherits
the whole evidence, verification and comparison stack for free and cannot accidentally sit
outside it.

**Evaluators read only stored evidence.** They never touch the simulator. A bundle can be
re-judged years later, on a machine with no simulator installed, and produce the same
verdict. This is what makes the evidence auditable rather than merely produced.

## 6. The agent authority model — the core design

Three tiers, enforced in the tool layer:

| Tier | Meaning | Enforcement |
|---|---|---|
| **READ** | Query evidence | Free to call; results carry citations |
| **EXECUTE** | Spend simulation budget | Workflow budget with a consumption ledger; `dry_run` default |
| **MUTATE** | Change canonical repository state | Refuses without an approval record bound to the draft's **content digest** |

### 6.1 Why enforcement is in the tool layer

`promote_regression` refuses identically whether it is called by a scripted agent, a live
model, a desktop coding agent, or a person at the CLI. If the check lived in the agent's
instructions, a different front-end would bypass it, and "we told the model not to" is not a
control. This is the single most important design decision in the phase.

### 6.2 Why approval binds to a content digest, not a name

Approving "the cut-in regression scenario" and then editing the file before promotion is the
obvious attack and the easy accident. An approval record names a SHA-256 of the draft's exact
bytes; any edit invalidates it. The digest is over raw bytes rather than a parsed form, so an
edit that happens to parse identically still invalidates.

### 6.3 What an approval approves — and what it does not

An approval record approves **a repository change**. It is not a gate verdict, not evidence
approval, and not deployment permission. The repository already keeps five trust axes
separate — verdict, integrity, authenticity, authorization, deployment permission — and the
approval subsystem must not collapse them. The CLI says so explicitly on every triage output.

### 6.4 Why the agent's answer never replaces the deterministic one

`classify_failure` is a pure function of stored evidence with a fixed precedence rule
(upstream wins: observation > planning > control > system). An agent produces a *proposal*
carrying the same taxonomy plus a rationale and citations. Both are recorded. A reviewer sees
agreement or disagreement, rather than one confident answer whose provenance has been
laundered away.

This is also what makes agent quality measurable — see §8.

### 6.5 Why `dry_run` defaults to true

An execution tool whose default is to execute will eventually be called by accident. Every
EXECUTE and MUTATE tool returns a resolved plan — instance count, simulated seconds, budget
remaining, destination path — without side effects. This is what makes an agent's proposal
reviewable *before* it is expensive or irreversible.

### 6.6 Why budgets live with the tools

The PRD's example parameter grid alone resolves to 2,304 scenario instances. An agent that
can trigger sweeps without a ceiling is a cost and denial-of-service channel. The ledger
records consumption alongside the evidence the workflow produced.

## 7. Evaluation design

### 7.1 The oracle is not the controller

Threat labels are recomputed from the stored trace and judged against thresholds held in
**gate configuration**, deliberately distinct from the controller's own trigger points. The
oracle's threat threshold sits *below* the controller's intervention threshold, so a
controller that intervenes exactly at its configured point is still judged in time.

Without this separation an evaluation only ever confirms that the controller did what it was
configured to do.

### 7.2 Criteria are physical where possible, not tuned

The brake-onset criterion is **required deceleration at first brake command against the
vehicle's braking authority**, not a time-to-collision threshold. At a fraction of 1.0 the
question is: *had the controller already waited past the point where its own brakes could
stop it?*

Two reasons this is better than a TTC floor:

- It is speed-independent. The same 2.0 s TTC leaves margin at 10 m/s and none at 30 m/s.
- It is answerable from the trace without reference to what the controller intended, so the
  threshold cannot be quietly fitted to the controller under test.

Measured: a timely controller begins braking at 50% of authority; one seeded to brake late
begins at 108%.

### 7.3 The gate is non-compensatory

Hard invariants cannot be bought off with good soft results. A candidate cannot improve its
collision count by braking constantly, because false intervention in an oracle-labelled
threat-free scenario is itself a hard failure.

### 7.4 Nominal exposure is a design requirement, not coverage padding

A suite made only of threat scenarios rewards a controller for braking and nothing else, so
an over-braking candidate looks perfect. At least one scenario must present a lead the oracle
labels threat-free — and it must present *closing geometry*, because a scenario with no
in-path object gives an over-braking controller nothing to react to.

## 8. Acceptance criteria and success metrics

### 8.1 For the evaluation itself: the seeded-defect suite

A gate that has never failed is indistinguishable from one that cannot fail. Three
controllers, each broken in exactly one way, expressed purely as configuration:

| Defect | Scenario | Must be caught by |
|---|---|---|
| `late_braking` | threat | `adas.aeb.brake_onset_margin` |
| `no_aeb` | threat | `adas.aeb.threat_response` |
| `over_braking` | nominal | `adas.aeb.no_false_intervention` |

The test requires the *named* criterion to fail, not merely that the run failed. A defect
that trips some unrelated invariant was caught by luck.

### 8.2 For the agentic workflow: triage accuracy against ground truth

"The triage agent is helpful" is an opinion. "The triage agent proposed the correct category
for 3 of 3 seeded defects" is a metric, computed deterministically from stored evidence.

Because a deterministic classifier exists, every agent proposal has a ground truth to be
scored against. **This is the design property that makes agent quality measurable at all**,
and it generalises: any agent skill that proposes something a deterministic system can also
compute gets a free accuracy metric.

### 8.3 For evidence quality

- Determinism: N ≥ 3 identical repeats produce bitwise-identical trace, metrics and verdict.
- Citation validity: every citation re-resolves against the bundle it names, with value drift
  detected. An uncited claim fails closed.
- Reproducibility: the fixture set regenerates from committed recipes on a fresh clone.

## 9. Design decisions and rejected alternatives

| Decision | Alternative rejected | Why |
|---|---|---|
| AEB stages on required deceleration | Stage on TTC | TTC is optimistic when the lead is itself braking — exactly the flagship case. A TTC-staged AEB intervenes late where it matters most. |
| Thresholds as fractions of braking authority | Absolute m/s² | A threshold then means the same thing at any configured authority, and ports across vehicle configurations. |
| Scripted driver never brakes by default | Let it brake | Makes every brake in the trace AEB-attributable by construction, so an offline verifier that sees only the trace can count interventions without guessing. |
| Two ADAS verifier profiles | One profile covering both | A profile's expected finding set is matched for exact equality; folding fault-carrying and fault-free ADAS into one profile would silently drop fault-coverage checking. |
| Controller config as a loadable file | Constructor arguments | Makes defects expressible as data, gives comparison a declared variation axis, and is the developer-facing configuration surface. |
| `ScriptedAgent` as the only CI runtime | Test against a live model | A live model's output is a non-deterministic draft. Every artifact downstream of an agent must be reproducible without re-invoking it. |
| Version-gated schema evolution | Migrate stored evidence | Digests are bound into every trace event. Migration would invalidate history; gating preserves it. |

## 10. Specified but not yet built

Listed so a reviewer knows what is design and what is code.

- **ACC, LKA, combined L2 assist.** Designated drop-to-P1 under the PRD's staging rule.
- **`RunMetricsV3` / evidence schema 3.0.** ADAS metrics currently live as finding
  measurements rather than in `metrics.json`.
- **Baseline-versus-candidate comparison.** The declared variation axis is specified but the
  fail-closed compatibility check still forbids comparing two controllers.
- **Failure mining and the regression flywheel.** Tool contracts exist; window extraction and
  draft authoring do not.
- **Scenario curator, evaluation analyst, release brief agents.** Only triage is built.
- **Agent provenance artifact** (`agent-trace.jsonl`) — blocked on the bundle's exact-inventory
  rule; needs a schema-gated optional-artifact mechanism.
- **Workbench panels.** The review UI renders ADAS bundles as legacy evidence.
- **MetaDrive brake-dynamics calibration.** Thresholds are analytically derived, not measured.

## 11. Open questions for review

These are the places I am least confident, and where review would be most useful.

1. **Is content-digest approval the right granularity?** It correctly invalidates on edit,
   but it means a whitespace change forces re-approval. Should approval bind to a canonical
   form instead, accepting that a semantically-identical edit then passes silently?

2. **Should `adas.aeb.brake_onset_margin` be hard or soft?** It is currently soft. Braking
   past the point of avoidance is arguably a safety failure even when contact is avoided —
   but making it hard would wrongly fail severity-reduction scenarios where avoidance is
   kinematically infeasible from the start, and those are not yet tagged.

3. **How should an agent/deterministic disagreement be surfaced?** Today both are recorded
   and a reviewer compares them. Should a disagreement block a downstream release brief, or
   is blocking too strong for what may be a taxonomy gap rather than an error?

4. **Is triage accuracy against seeded defects a real metric or a tautology?** The scripted
   agent applies the same precedence rule as the classifier, so 3/3 is unsurprising. It
   becomes meaningful with a live model — but then it is no longer deterministic. What is the
   right way to report agent quality that is both meaningful and reproducible?

5. **Does the nominal-exposure requirement scale?** One threat-free scenario is enough to
   catch a crude over-braking defect. The PRD calls for ≥ 30% of suite simulated time to be
   oracle-labelled threat-free. Is a time-share the right unit, or should it be per-scenario?

6. **Where should ODD violation be enforced?** Scenarios declare an ODD and validation checks
   the target speed against it, but nothing checks whether the *run* stayed inside it. Should
   leaving the declared ODD be a finding, and should it be hard?

## 12. What this establishes, and what it does not

**Establishes:** that a deterministic authority boundary for agents in an ADAS evaluation
pipeline can be specified, implemented and tested; that agent proposals can be scored against
deterministic ground truth; that an evaluation can be shown to catch deliberately broken
controllers on their own named criteria.

**Does not establish:** anything about real vehicle behaviour, calibrated dynamics,
perception, scale, or the behaviour of a live language model in this role. Two scenarios and
one seed are a reference implementation, not a safety case.
