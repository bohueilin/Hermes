# Hermes

**A simulation-only lab for deciding whether an autonomy change is safe to advance — and for proving the decision afterwards.**

> Model proposes. Environment verifies. Gate decides. Trace proves.
> Capability is not permission.

Hermes runs a driving policy against a pinned physics simulator, judges the run with verifiers
that are independent of the policy, resolves those judgements through a release gate that
cannot be talked out of a failure, and writes the whole thing to a hash-chained evidence bundle
that can be re-checked later without re-running anything.

It is a personal project, built in twelve days, and it is not a product. What follows tries to
be precise about which parts are real.

---

## 1. The problem it is actually about

A quality gate's value is invisible in its normal output. Every passing run looks the same
whether the gate is rigorous or vacuous — the artifact is identical either way. So adoption
becomes a matter of belief, and belief decays: the first time the gate blocks something
inconvenient, the argument is "the gate is wrong," and there is usually nothing in the product
to answer with.

Hermes takes that as the design problem rather than as a documentation problem. The consequence
is that **the demo which sells the tool is the one where things break correctly**, and the gate's
own failure suite is a ten-second user-runnable artifact rather than an internal test:

```bash
make demo-seeded-defects
```

Three controllers, each broken in exactly one way by configuration alone, each of which must be
caught by *its own named criterion* — plus a baseline control, so "the gate caught it" cannot
quietly mean "the gate always fails."

---

## 2. What is in it

### Simulation

MetaDrive 0.4.3, vendored and pinned to commit `85e5dadc`. The adapter refuses to start unless
the package version, its distribution metadata, its import path, the vendored checkout's git
HEAD, the recorded `SIMULATOR_COMMIT`, and a hardcoded constant all agree — **and** the vendored
tree is clean. Provenance fails closed rather than being recorded after the fact.

Physics runs at a 0.02 s step that Hermes imposes rather than inherits, and a control frequency
is rejected unless it divides 50 Hz exactly. That rule is enforced at three independent layers,
including offline verification that never imports the simulator.

A scenario is a strict, frozen, `extra="forbid"` document in four schema versions, identified by
a digest over schema-aware canonical JSON — so adding schema 4.0 did not invalidate evidence
published under 1.0.

**Honestly scoped:** one straight map block, zero traffic density, no sensor or perception model,
five ADAS scenarios, one seed, 10 Hz. Front-object distance and closing speed come from
simulator ground-truth bounding boxes, not from perception. This is a harness with a physics
engine attached; it is not a simulation stack.

### The safety layer

Three distinct action fields, never collapsed: `candidate_action` (what the policy proposed),
`permitted_action` (what the shield allowed), `executed_action` (what actually ran).

The release gate resolves an **ordered, non-compensatory** precedence chain — eleven branches,
no score, no weight, no average anywhere in it, so a good number structurally cannot offset a
hard failure:

```
trace invalid ──────────── INVALID_EVIDENCE
safety evidence missing ── INVALID_EVIDENCE
collision ──────────────── HOLD
boundary ───────────────── HOLD
fault coverage ─────────── HOLD
progress ───────────────── HOLD
any other hard invariant ─ HOLD
any soft criterion ─────── CONDITIONAL
otherwise ──────────────── PASS
```

Hard invariants are `Literal`-typed in the gate config (`max_collision_count: Literal[0]`), so
configuration cannot relax them. Missing evidence is a first-class `NOT_AVAILABLE` tri-state
that is never zero and never a pass.

Trust is decomposed rather than aggregated. Gate verdict, integrity, and five separate trust
records — authenticity, authorization, deployment permission, scope, authoritative status — are
reported independently, because in a review tool **the aggregate is the failure mode**. A single
status light is what users ask for and the thing that ruins the tool.

### Evidence

Every run writes a ten-file bundle with a hash-chained `events.jsonl` and digests binding the
scenario, gate config, policy config, adapter config and fault config. Re-verification recomputes
the shield, the fault transforms, the metrics, every verifier and the gate from stored bytes.

**It does not re-run the simulator or the policy** — their outputs are inputs to the check, not
reproduced facts. And hashing detects partial edits, nothing more: anyone who can rewrite a whole
bundle can recompute every digest. The code says so structurally — `AuthenticityStatus` has
exactly one member, `NOT_AUTHENTICATED`, because there is no signing and no trust anchor. The
enum cannot express a claim the system cannot support.

### ADAS

Forward collision warning and automatic emergency braking, as an ordinary driving policy.

AEB stages on **required deceleration**, `a_req = closing² / (2 · usable_gap)`, rather than on
time-to-collision. A braking lead makes TTC optimistic, so a TTC-staged AEB intervenes late in
exactly the scenario that matters most; a test pins two situations with identical 2.0 s TTC that
stage differently.

Four findings, two hard (`threat_response`, `no_false_intervention`) and two soft
(`brake_onset_margin`, `warning_timing`). The oracle's thresholds live in a separate config from
the controller's, so a controller cannot pass by being configured to agree with itself.

**Honestly scoped:** two longitudinal functions over ground-truth object state. There is no
perception. `warning_timing` does not verify a warning — the trace has no field for the warning
signal, so it confirms only that the run presented the declared closing geometry, and the finding
message says exactly that. Every threshold is an analytical guess: MetaDrive's brake dynamics are
uncalibrated, and measured peak deceleration runs near 13 m/s² against a *declared* 6 m/s²
authority that the simulator does not enforce. Percentages "of braking authority" are ratios to
that unenforced number.

### The agent layer

**There is no language model in this repository.** The runtime dependencies are pydantic, PyYAML,
rich and typer. `AgentRuntime` is a one-method Protocol — the seam a model would sit behind — and
`ScriptedAgent` is a deterministic stand-in that applies an explicit, inspectable rule.

What is real is the substrate a model would need:

- A typed catalogue of eight tools across three permission tiers (READ / EXECUTE / MUTATE), with
  `dry_run=True` the default on both non-READ tools.
- One `ToolResult` envelope with a closed error vocabulary, and a constructor invariant making it
  structurally impossible for a failure to present as an empty success.
- A budget ledger that charges every call and names the exhausted dimension on refusal.
- Every claim carrying a citation that `hermes agent check-citations` re-resolves against the
  bundle.
- An agent's proposal recorded **beside** the deterministic classification, never in place of it.
- `promote_regression` refusing to change canonical state without an approval bound to the
  SHA-256 of the draft's exact bytes — so an edit after approval invalidates the approval rather
  than silently shipping something else.

**Honestly scoped:** the refusal lives in the function rather than in a prompt, which is the
interesting part — but it is a boundary, not a sandbox. The registry path is a caller-supplied
argument, and anything with filesystem write access bypasses the tool entirely. No model has ever
exercised the path. Triage is a straight-line sequence of four tool calls: no planning, no tool
selection, no iteration.

### The regression flywheel

```
failed run → triage → draft → validate → approve → promote → rerun
```

A draft is derived from the geometry the trace records *at the failing event*, so the new case
starts at the failure instead of driving up to it. A **requirement floor** enforces that a draft
may add coverage and never subtract it — closing an authority-laundering channel where a proposal
that reads as added coverage quietly drops an expectation, after which everything passes forever.

The derived case has to *discriminate*: fail for the controller that provoked it, pass for one
without the defect. A regression case that cannot do that grows the suite and detects nothing.

---

## 3. Five things you can run

| Command | What it demonstrates |
|---|---|
| `make demo-adas` | An ADAS controller running on real physics, gate-evaluated |
| `make demo-seeded-defects` | The evaluation catching controllers broken on purpose |
| `make demo-adas-tradeoff` | A candidate held despite improving the headline safety metric |
| `make demo-flywheel` | A failure becoming a committed regression case, with a human in the loop |
| `make demo-cut-in` | The oracle classifying a manoeuvre it was never written for |

The trade-off one is the most interesting. A candidate that brakes far earlier improves minimum
time-to-collision on the threat scenario from **1.17 s to 4.67 s** — on a collision-and-TTC
scorecard it ships. The gate holds it anyway, on `adas.aeb.no_false_intervention`, because of
what it does when nothing is there. The comparison output has no aggregate score and no winner
field; it partitions dimensions into improved, regressed, unchanged and not-comparable, and lets
the trade-off stand as a trade-off.

---

## 4. What this is not

Stated here rather than in a footnote, because most of these are things a reader would otherwise
assume:

- **Not a safety case.** No ISO 26262, no ASIL decomposition, no HARA, no regulation, no
  assessor, no vehicle. Every threshold is illustrative, and the gate config schema *requires*
  the literal label `illustrative_prototype_thresholds_not_for_real_vehicle_use`.
- **Not authenticated.** Tamper-evident against partial edits; nothing more.
- **Not a simulation of the world.** One straight map, no traffic, no sensor model, one seed.
- **Not an agent framework.** No model, no orchestration loop, no skill abstraction.
- **Not machine learning.** No model, no training, no dataset, no RL — by explicit design.
- **Not reproducible off this host, yet.** A clean clone reports **144 failed / 761 passed**;
  `hermes fixtures regenerate` brings that to **24 failed / 883 passed**; the residual needs the
  vendored simulator, which is gitignored and not a declared dependency. CI has never run against
  this branch. This is the sharpest weakness in the project and it is being stated rather than
  discovered.

---

## 5. How it was built, and by whom

The repository is 67 commits over twelve days, 22.3k lines of source and 19.8k lines of tests.
That is not a hand-authored rate and it should not be presented as one.

Hermes was **specified by me and implemented largely by coding agents** — Codex and Claude —
working from written specifications. The prompts, phase specs, build plan and handoff documents
are committed in the repository root; the working method is visible rather than hidden.

The part worth evaluating is therefore not the typing. It is the specification and the judgement:

- A 2,362-line PRD with personas, explicit non-goals, a sprint plan, named risks, acceptance
  gates, and eleven open questions I could not resolve.
- An adversarial review of the gate that found a **real fail-open** — a hard finding registered
  in a profile without its own precedence branch fell through to PASS *while failing* — and
  closed it before the first ADAS invariant made it reachable.
- Catching myself fitting a threshold to the controller under test, and replacing a tuned
  time-to-collision criterion with a physics-derived one.
- Rewriting the flagship scenario after noticing it measured nothing: at a 10 m gap the emergency
  began at step 0, so a timely controller and a deliberately broken one behaved identically.
- A `VALIDATION_MATRIX.md` that writes `NOT YET OBSERVED` against manual review, accessibility
  audit and human comprehension — in the same table as rows reading "passed."

For anyone assessing this: reviewing generated work adversarially, and knowing what to reject, is
the skill the project actually evidences.

---

## 6. Where to go next

| Document | For |
|---|---|
| [PHASE8_GETTING_STARTED.md](PHASE8_GETTING_STARTED.md) | Ten minutes, every command copy-pasteable |
| [PHASE8_STATUS.md](PHASE8_STATUS.md) | Where the work stands and what is not claimed |
| [PHASE8_DESIGN_SPEC.md](PHASE8_DESIGN_SPEC.md) | The design and its open questions |
| [PHASE8_HANDOFF.md](PHASE8_HANDOFF.md) | What remains, and the landmines attached to each |
| [README.md](README.md) | The full command surface |

---

*Simulation-only prototype. Illustrative thresholds. Not road-safety, certification, compliance,
or deployment evidence.*
