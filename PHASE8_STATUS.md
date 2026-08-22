# Hermes Phase 8 — Overall Status

**Branch:** `feat/phase8-adas-lab` · **Base:** `feat/phase6-reviewer-comprehension` @ `4eb8765`
**Head:** `65363ae` · **Date:** 2026-08-22

One page to answer "where are we". For *what to do next* see
[PHASE8_HANDOFF.md §5](PHASE8_HANDOFF.md); for *why it is shaped this way* see
[PHASE8_DESIGN_SPEC.md](PHASE8_DESIGN_SPEC.md); for *how to run it* see
[PHASE8_GETTING_STARTED.md](PHASE8_GETTING_STARTED.md).

---

## 1. In one paragraph

Phase 8 adds an ADAS development loop to Hermes: an FCW + AEB controller runs on real
MetaDrive physics, its behaviour is judged by an offline oracle that is independent of the
controller, the judgement folds into the existing non-compensatory release gate, and a failed
run can be turned into a new committed regression case through a path that an agent can drive
but cannot complete alone. The thing being demonstrated is not that an agent can do ADAS work.
It is that an agent can be given real authority over a safety-relevant workflow **without**
being given authority over the verdict — because every step it takes lands in front of a
deterministic check it does not control.

---

## 2. Numbers

| | |
|---|---|
| Commits on branch | 33 |
| Files changed | 68 (+11,347 / −154) |
| Tests | **965 passing** (18 drive real MetaDrive) |
| Lint | ruff clean repo-wide |
| Doctor | 17 PASS / 1 WARN / 1 NOT_AVAILABLE |
| New source packages | `adas/`, `agents/`, `regression/`, `fixtures/`, `verifiers/adas.py` |
| New test files | 14 |
| Working tree | clean; fresh clone reproduces every demo |

---

## 3. What exists, and the command that proves it

Each row is backed by a re-runnable command. Nothing is listed that I have not run.

| Capability | Proof |
|---|---|
| ADAS controller on real physics, evaluated and gated | `make demo-adas` |
| Evaluation catches controllers broken on purpose | `make demo-seeded-defects` → 5 passed |
| A safety metric cannot be bought with a false intervention | `make demo-adas-tradeoff` |
| A failure becomes a committed regression case | `make demo-flywheel` |
| The oracle generalises to geometry it was not written for | `make demo-cut-in` |
| An agent proposes; the classifier decides | `hermes agent triage <run>` |
| Every agent claim carries a re-resolvable citation | `hermes agent check-citations <run>` |
| The mutation boundary refuses without an approval | `PHASE8_GETTING_STARTED.md` §3 |
| Bitwise determinism at fixed seed and host | `PHASE8_GETTING_STARTED.md` §5 |
| Fresh clone reproducibility | `hermes fixtures regenerate` → 961 pass |

### 3.1 The four demos, and what each is actually evidence of

**Demo 1 — `make demo-adas`.** An ADAS controller is an ordinary `DrivingPolicy`; ADAS
findings are ordinary findings; the gate did not learn anything new about ADAS. This is
evidence that the extension did not require special-casing the trust machinery.

**Demo 2 — `make demo-seeded-defects`.** Three controllers, each broken in exactly one way by
configuration alone, each caught by *its own named criterion* — plus a baseline control, so
"the gate caught it" cannot collapse into "the gate always fails". This is the only evidence
that the evaluation discriminates rather than merely runs.

**Demo 3 — `make demo-adas-tradeoff`.** A candidate that brakes far earlier improves minimum
TTC from 1.17 s to 4.67 s on the threat scenario. On a collision-and-TTC scorecard it ships.
The gate holds it anyway, on `adas.aeb.no_false_intervention` — because of what it does when
nothing is there. This is the clearest statement of what a non-compensatory gate buys you.

**Demo 4 — `make demo-flywheel`.** Failed run → triage → draft → validate → approve → promote
→ rerun. The derived case must *discriminate*, and it does: `HOLD` for the defect that
provoked it (a_req 6.83 m/s², 114% of authority), `CONDITIONAL` for the baseline (2.71, 45%).

**Demo 5 — `make demo-cut-in`.** The evaluators in `verifiers/adas.py` never inspect
`challenge.kind`; they compute required deceleration from observed gap and closing speed. That
is a *claim* about generalisation, so it is now tested: two scenarios using the same cut-in
manoeuvre, differing only in geometry, classified oppositely with **no change to any ADAS or
verifier code**. The near case measures a peak required deceleration of 2.77 m/s² (46% of
authority) and the far case 0.03 m/s² (under 1%), against a 30% threat threshold.

The pair is complementary rather than redundant, which is what earns it its simulation time:

| | baseline | late_braking | no_aeb | over_braking |
|---|---|---|---|---|
| **cut_in_near** (threat) | pass | `brake_onset_margin` | **`threat_response` → HOLD** | pass |
| **cut_in_far** (nominal) | pass | pass | pass | **`no_false_intervention` → HOLD** |

Each scenario *passes* the defect the other one catches. A scenario that failed every
defective controller would add cost without adding information.

---

## 4. Two things I would not want a reviewer to misread

**The HOLD in demo 4 is not driven by the ADAS finding.** On the late-braking defect the
findings are:

```
FAIL  hard=True   progress.required          <- this is what makes it HOLD
FAIL  hard=False  adas.aeb.brake_onset_margin <- this is what detects the defect
PASS  hard=True   adas.aeb.threat_response   <- it did brake, and did avoid contact
```

The defect is correctly detected by its named criterion, but `brake_onset_margin` is **soft**,
so on its own it would produce CONDITIONAL, not HOLD. The HOLD comes from the vehicle failing
to complete the mission — a plausible downstream consequence of braking late, but not the same
statement. Whether late braking that still avoids contact should be a hard failure is
[design-spec open question 2](PHASE8_DESIGN_SPEC.md) and is genuinely open: making it hard
requires the scenario to declare whether a severity-reducing late intervention is acceptable,
and nothing declares that today.

**Comfort is not under control.** Every demo lands CONDITIONAL on `comfort.acceleration` and
`comfort.jerk`, with measured peak |a| around 13 m/s² against a configured 6 m/s² authority.
`ControlConfig` limits are declared but not enforced on the simulator, and MetaDrive's brake
dynamics are uncalibrated. This is PRD Risk 8, it is open, and it means **every threshold in
`config/gates.adas.yaml` is an analytical guess rather than a measured one.**

---

## 5. Defects found and fixed along the way

Three were pre-existing faults in the Phase 0–6 codebase that Phase 8 would have inherited
silently; two were introduced by Phase 8's own float-dense scenarios and caught by it.

| Defect | Why it mattered |
|---|---|
| **The release gate failed open** (`235efec`) | `soft_nonpassing` filtered on `not hard_invariant`, so a hard finding in a profile without its own precedence branch was reported **PASS while failing**. The first failing ADAS hard invariant would have shipped as a pass. |
| **Scenario identity used a forked serializer** (`e78d42f`) | `scenarios/loader.py` had a private `json.dumps` missing the canonical `-0.0 → 0.0` normalization, so two YAML files describing the same scenario produced different digests — splitting one scenario into two identities and making two runs of it incomparable. |
| **The suite could not run on a fresh clone** (`10343bf`) | 127 failed / 593 passed / 40 errors, because eight test modules read gitignored fixtures nothing regenerated. Every "suite green" claim was unverifiable off one machine. |
| **A derived spawn speed was not float32-exact** (`cdb4637`) | 18.515 m/s round-trips through MetaDrive's float32 storage as 18.514999…, failing the adapter's reset check. Fixed by projecting to binary32 and comparing against the same projection — the check stays *exact*. |
| **A geometry tolerance used the wrong error model** (`65363ae`) | The observed gap is a difference of two float32 *positions*, so its error is an ulp of the position, not of the gap. A fixed 1e-6 m tolerance held at 40 m by luck and failed at 28.816 m by 1.4e-6 — reporting a trace contradiction that existed only in the check. Now derived from float32 spacing at the compared magnitude. |

The last one is worth a note on process: my first fix for it was a relative tolerance that
worked but was still a number I picked. The second fix derives the tolerance from the
representation, and is *tighter* than the relative one at every magnitude. When a tolerance
has to be chosen rather than derived, that is usually a sign the error model is wrong.

---

## 6. Where the code lives

```
src/hermes/adas/         FCW + AEB + scripted driver, as an ordinary DrivingPolicy
  functions.py             the controllers; AEB stages on required deceleration
  policy.py                projection to a simulator action (binary32 quantised)
src/hermes/verifiers/adas.py   four offline evaluators — the oracle, independent of the controller
src/hermes/agents/       the agentic layer
  contracts.py             tool catalogue, permission tiers, budgets, failure taxonomy
  tools.py                 8 tools; MUTATE ones refuse without an approval record
  approval.py              approvals bound to a content digest
  triage.py                agent proposal recorded *beside* the deterministic classification
src/hermes/regression/   the failure-to-regression flywheel
  builder.py               derive a case from the trace geometry at the failing event
  floor.py                 the requirement floor: may add coverage, never subtract
config/gates.adas.yaml   oracle thresholds — deliberately distinct from controller thresholds
config/adas/             baseline + three seeded defects, each broken in exactly one way
scenarios/adas/          3 of 12 P0 scenarios
```

---

## 7. Scope: what is and is not claimed

**Delivered:** FCW, AEB, the offline oracle, the seeded-defect suite, the agent tool layer
with permission tiers and approvals, deterministic triage, checkable citations,
baseline-vs-candidate comparison on a declared variation axis, and the regression flywheel end
to end.

**Not started:** ACC, LKA, combined assist; `RunMetricsV3` / evidence schema 3.0; the
remaining P0 scenarios and the new `ChallengeConfig` kinds several of them need; ADAS fault
wiring; the release-brief agent; workbench panels; interesting-event detection and parameter
sweeps.

On scenario counts: the PRD's P0 catalog is **22 named entries plus four nominal entries**
added by §0-A amendment 6 — not the 12 an earlier revision of the handoff claimed. Five
scenarios are committed, of which three match named entries (`lead_hard_brake`, `cut_in_near`,
`cut_in_far`).

**Not claimed, ever:** this is simulation only. No physical vehicle, no CAN, no public-road
control, no real-time LLM in a control loop, no standards or certification claim. Every
threshold is illustrative. Two-to-three scenarios at one seed are not a safety case, and
`adas.fcw.warning_timing` does not verify a warning output — the trace has no field for the
warning signal, so it confirms only that the run presented the declared closing geometry.

---

## 8. Two-day plan

**Day 2 — in progress.** Two more P0 scenarios delivered (`cut_in_near`, `cut_in_far`),
extending the seeded-defect suite to five cases and adding the generalisation test. Remaining:
the one-page narrative and the architecture diagram.

**Day 1 — complete.**
- Trade-off demo (`make demo-adas-tradeoff`) — the false-intervention story ✓
- Failure-to-regression flywheel (`make demo-flywheel`) — closed end to end ✓
- Both latent float32 defects it surfaced, fixed and pinned by tests ✓

**Day 2 — proposed, in priority order.** See [PHASE8_HANDOFF.md §5](PHASE8_HANDOFF.md) for the
full list with the landmines attached to each.
1. The one-page narrative: what Hermes is, why authority ≠ capability, the three demos in
   order. This is the artefact that carries the work to someone who will not run it.
2. An architecture diagram — the five trust axes and where the agent sits relative to them.
3. `RunMetricsV3` **or** two more P0 scenarios — one deepens the evidence model, the other
   broadens coverage. Not both.

Deliberately **not** on the list: MetaDrive brake calibration. It is the highest-value
*engineering* item and the lowest-value *narrative* one, and it invalidates thresholds
everywhere it touches. Starting it on the last day would leave the demos mid-retune.
