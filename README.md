![Hermes, winged messenger of the gods, watching a sensor-equipped autonomous vehicle trace a lit, waypointed path across a valley at sunrise](Hermes_Github.png)

# Hermes

Hermes is a simulation-only autonomous-driving scenario and safety-evidence lab.

> **Autonomy policy proposes → environment executes → verifiers evaluate → gate decides → trace proves.**

Hermes is designed to make an autonomy experiment reproducible and reviewable: it preserves the scenario, versions, candidate action, executed action, findings, metrics, release verdict, and evidence-integrity checks in one bundle.

## Phase 9 — FleetLab: fleet operations simulation and experimentation

FleetLab asks a different question from the rest of Hermes: **not "how does the vehicle behave?"
but "what happens to the service when an offboard policy changes across the fleet?"** Queues,
demand, dispatch, depot capacity and service turnaround — discrete-event simulation, not vehicle
physics.

It is built around one idea: **an experiment is only worth running if its claim was fixed before
its result existed.** An `ExperimentSpec` freezes the question, the single variation axis, the
primary estimand with its equivalence margin, the guardrails and the seed set. A hashed world tape
guarantees baseline and candidate meet the same exogenous demand — the tape is built from the
*declared* scenario, so the variation axis cannot leak into the world it is measured against. The
`DecisionRecord` then binds to all three digests, so the claim a reviewer reads afterwards is the
claim that was preregistered.

```text
$ hermes fleet demo

Experiment:      fleet-005-turnaround
Question:        Does a 25% longer depot service turnaround degrade rider wait p90
                 beyond the declared equivalence margin?
Variation axis:  parameter:service_duration_s  (baseline 1800 -> candidate 2250)
Replications:    10 paired seeds  (seed set 748c0bfe0a22)

VALIDITY:        VALID
OUTCOME:         REGRESSED

Primary metric   wait.p90_s: mean delta +826.1 (median +768.0), 95% CI [+735.9, +919.2]
                 baseline 793.1 -> candidate 1619.3
Guardrail        unserved.fraction: mean delta +0.057  [REGRESSED]

RECOMMENDATION:  HOLD
Deployment permission: NONE
```

That run takes **0.50 s**, and reproduces from a clean clone on the four core dependencies alone —
no simulator, no numpy, no stored fixtures. Measured 2026-08-31: **33 of 33 tests pass** in a fresh
clone and virtualenv, and the decision-record digest `84ff1c91b600f29e…` comes back **bit-identical**
to the development checkout.

The recommendation is deliberately **non-compensatory**: a guardrail regression HOLDs a result even
when the primary metric improves, because reducing wait time while stranding riders is not a win.
`INCONCLUSIVE` is a first-class outcome — stochastic evidence does not always support a directional
answer, and a platform that cannot say so will manufacture one. Of the twelve specified operational
invariants, eight are checked inside every replication and replay determinism is checked before any
of them run; the remaining three await the charging model. A violation yields `INVALID_EXPERIMENT`
with no partial result — a broken run must not be reported as a weak one, because "the dispatcher
double-assigned a vehicle" is not "the fleet is slow".

**Everything here is `SIMULATION_ONLY` and `SYNTHETIC_UNCALIBRATED`.** A FleetLab result is a
screening input to a next test, never a launch decision, and `deployment_permission` is always
`NONE`.

| Document | What it is |
|---|---|
| [HERMES_PHASE9_FLEET_SIMULATION_PRD.md](HERMES_PHASE9_FLEET_SIMULATION_PRD.md) | The requirements document: personas, fidelity lanes, domain and event model, experiment semantics, scenario catalog, acceptance criteria |
| [docs/plans/2026-08-30-fleet-metric-contract-design.md](docs/plans/2026-08-30-fleet-metric-contract-design.md) | Design for a shared metric contract — and the defect in the code above that motivates it |

**Built:** the FLEET-005 slice — preregistered specs, the hashed world tape, enforced invariants,
bootstrap confidence intervals over paired replications, and a replayable decision record.
**Not built:** five of the six flagship scenarios, the charging model, the policy SDK, the
experiment registry, and the Studio front end. Nineteen of the twenty P0 acceptance criteria
remain open.


## Phase 8 — ADAS development and agentic workflow lab

Phase 8 extends Hermes into a simulation-based **ADAS development and agentic workflow lab**:
forward collision warning and automatic emergency braking, evaluated by an independent offline
oracle, with an agentic layer whose authority boundary is enforced in code rather than in a prompt.

**Start here:** [HERMES_SOURCE_OF_TRUTH.md](HERMES_SOURCE_OF_TRUTH.md) — the single status,
runbook, coordination and next-steps document for all Hermes work. Every conversation reads it
first and updates it last; there is deliberately no other status document.

Reference documents (deep material, not status):

| Document | What it is |
|---|---|
| [PHASE8_DESIGN_SPEC.md](PHASE8_DESIGN_SPEC.md) | The design, the agent authority model, acceptance criteria, and open questions for review |
| [PHASE8_IMPLEMENTATION_NOTE.md](PHASE8_IMPLEMENTATION_NOTE.md) | What was built and measured, decisions forced by the code, deviations, and where the work is thinnest |
| [PHASE8_BASELINE_AUDIT.md](PHASE8_BASELINE_AUDIT.md) | The Sprint 0 survey of the existing codebase and its compatibility risks |

### The three things worth looking at

**1. The evaluation is shown to catch controllers that are broken on purpose.** A release gate
that has never failed is indistinguishable from one that cannot fail, so three controllers -
each broken in exactly one way, expressed purely as configuration - must each be caught by
their own named criterion:

| Controller | Scenario | Detected by its named criterion | Verdict, and what drove it |
|---|---|---|---|
| `baseline` | threat | — (braking began at 50% of authority) | CONDITIONAL (comfort) |
| `defect_late_braking` | threat | `adas.aeb.brake_onset_margin` (108%) — **soft** | HOLD, driven by `progress.required` |
| `defect_no_aeb` | threat | `adas.aeb.threat_response` — **hard** | HOLD, driven by that finding |
| `defect_over_braking` | nominal | `adas.aeb.no_false_intervention` — **hard** | HOLD, driven by that finding |

The second row is worth reading carefully rather than skimming. `brake_onset_margin` correctly
detects the late-braking defect, but it is a *soft* criterion, so on its own it would produce
CONDITIONAL. The HOLD comes from the vehicle failing to complete its mission — a plausible
consequence of braking late, but not the same statement. Whether late braking that still avoids
contact should be a hard failure is an open design question, not a settled one.

**2. A candidate cannot buy a safety metric with a false intervention.** Same scenario, same
seed, declared variation axis `policy`:

```
threat scenario    minimum_ttc_s   1.17 s -> 4.67 s          IMPROVED
nominal scenario   verdict         CONDITIONAL -> HOLD       REGRESSED
                   hard_failures   [] -> [adas.aeb.no_false_intervention]
```

The candidate improves the safety metric you were looking at, and the gate holds it anyway
because of what it does when nothing is there.

**3. The agent's authority boundary is enforced in the tool layer.** `promote_regression`
refuses to change canonical state without an approval record bound to the draft's **content
digest**, and refuses identically whether it is called by a scripted agent, a live model, a
desktop coding agent, or a person at the CLI. An agent's triage proposal is recorded *beside*
the deterministic classification, never in place of it.

**4. A failure becomes a regression case, and a human decides.** `make demo-flywheel` runs the
canonical workflow end to end:

```
failed run -> triage -> draft -> validate -> approve -> promote -> rerun
```

The draft is derived from the geometry the trace records at the failing event, so it *starts*
at the failure rather than driving up to it. It is refused promotion until an approval exists,
and the approval binds to the draft's exact bytes. The derived case then fails for the
controller that provoked it and passes for one without the defect — a regression case that
cannot discriminate grows the suite and detects nothing.

**5. The evaluation generalises.** `make demo-cut-in` runs two cut-in scenarios that differ
only in geometry — one a threat, one not — and are classified oppositely with no change to any
ADAS or verifier code. The oracle never inspects the challenge kind, so the split can only come
from the geometry. Each scenario also passes the defect the other one catches, which is what
makes the pair worth its simulation time rather than redundant.

`make demo-stationary` applies the same test to the classic stopped-object complement: the
same static actor and longitudinal gap are in the ego lane for the AEB threat and one lane
away for the nominal twin. The baseline avoids contact in the threat case and never brakes
for the adjacent object; deliberately broken controllers fail only the named criterion their
opposite twin is designed to expose.

`make demo-fcw-stationary` uses the same nominal twin with a longer in-lane gap, showing
warning-due geometry before controller PARTIAL AEB staging; this remains a geometry-coverage
check, not a warning-output verification.

`make demo-steady-lead` measures the same oracle on a constant-speed moving lead, separating
a closing threat from a same-speed following nominal while verifying stored actor-speed constancy.

`make demo-adjacent-pass` holds the closing-threat numbers fixed and moves the actor one lane
over, verifying no front pair or false intervention through the ego's measured pass.

`make demo-lead-decelerates` verifies a declared one-time lead deceleration remains nominal and
exposes the geometry-blind actor-presence braking defect.

### Phase 8 commands

```bash
make demo-adas                             # threat and nominal scenarios, gate-evaluated
make demo-cut-in                           # the same oracle on a manoeuvre it never saw
make demo-stationary                       # classic stopped in-path / adjacent-object pair
make demo-fcw-stationary                   # stationary FCW warning-margin / adjacent-object pair
make demo-steady-lead                      # moving steady-lead threat / following nominal pair
make demo-adjacent-pass                    # identical moving tuple separated by lane placement
make demo-lead-decelerates                 # scripted lead deceleration / false-braking diagonal
hermes agent tools                         # discoverable tool catalogue with permissions
hermes agent triage <run-id>               # proposal vs deterministic classification
hermes agent check-citations <run-id>      # re-resolve every citation against the evidence
hermes compare <base> <cand> --variation-axis policy
hermes regression draft <run-id>           # derive a regression case from a failure
hermes regression approve <draft> --approver <you> --rationale <why>
hermes regression promote <draft> --execute
hermes fixtures regenerate                 # restore the test fixtures on a fresh clone
```

Phase 8 is **partial**: FCW and AEB are implemented and evaluated, with the agentic layer,
the regression flywheel, and `RunMetricsV3` (evidence schema 3.0) closed; ACC, LKA, combined
assist, and the remaining workbench panels are not. See [HERMES_SOURCE_OF_TRUTH.md](HERMES_SOURCE_OF_TRUTH.md) §11 for what
remains. Two scenarios and one seed are a reference implementation, not a safety case.

## Safety boundary

Hermes is for simulation and closed-lab learning only. It must not connect to a physical road vehicle, public-road actuator, remote-control channel, CAN bus, or production safety-critical system. Prototype thresholds are illustrative and are not certification or real-world safety evidence.

## Current status

Phases 0–6 are implemented. The Phase 6 evidence authority was delivered on
`feat/phase6-evidence-workbench`; the presentation-only reviewer-comprehension iteration is on
`feat/phase6-reviewer-comprehension`. The simulator-neutral evidence
pipeline supports a deterministic fake adapter, a pinned MetaDrive 0.4.3 physics run with an
installed IDM policy, trace-bound deterministic-shield decisions for two bounded MetaDrive
challenge scenarios, schema-2 evidence for deterministic observation/control faults, and a local
read-only Evidence Review Workbench. Phase 6 adds immutable portable review/comparison envelopes,
root-contained review CLI commands, and an optional Streamlit UI that consumes the same verified
facade. The implementation and adversarial-hardening checkpoint is `90fb7d8`; both the complete and
non-MetaDrive selections passed 720 tests, with independent review GO and no open P0/P1. No remote
CI run is claimed. On the later reviewer-comprehension branch, commits `685b92d`, `e2eab34`, and
`80439c5` reorganize the workbench into Review/Compare/Evidence limitations, add task-oriented
evidence and Timeline presentation, and harden submitted-state handling. An independent automated
audit recorded 746 passing tests and no reproduced P0/P1. Manual visual review, accessibility audit,
and human comprehension remain `NOT YET OBSERVED`. A subsequent browser DOM walkthrough found a
first-Timeline-mount radio/projection mismatch; `cbced6e` fixed it RED-first, with 88 scoped and two
independent targeted tests passing and fresh DOM parity. Pixel screenshots were unsupported/blank,
so no manual visual or accessibility result is inferred. A second browser P2—stale dynamic H2
permalinks after radio reruns—was fixed in `0fe3459` with explicit anchors for all seven H2s, one
RED/one GREEN, 83 focused, and two independent targeted passes. Fresh DOM observed Overview
`#overview`, Timeline `#timeline`, Compare `#compare`, and zero exception text. Cloud/multi-user
review, authenticity, and RL work remain deferred.

The final pre-documentation-commit checkpoint installed both `.[dev,workbench]` and `.[dev]`, then
recorded 756 full tests, 756 non-MetaDrive tests, and 506 tests in the focused 13-file Phase 6
matrix. Repository Ruff and diff/cached checks passed; doctor reported 17 PASS, one intended
15-entry dirty-tree WARN, one optional DISPLAY `NOT_AVAILABLE`, and no FAIL. Six review and three
comparison CLI cases matched their expected contracts, and all 100 canonical files across ten
retained artifact directories were byte-identical before and after. The browser document object
model (DOM) retained-state walkthrough covered initial UNVERIFIED, PASS, HOLD, INVALID quarantine,
Timeline/action accountability, Provenance/limitations, compatible mixed comparison, incompatible
fail-closed comparison, and stable anchor hrefs without exception or stored-PASS leakage.
Pixel/manual visual quality, 200% reflow, visible CSS focus, screen-reader behavior, contrast,
accessibility audit, and human comprehension remain `NOT YET OBSERVED`.

The fake adapter is an architectural test double, not a vehicle-physics model. MetaDrive remains
lazy and optional: fake runs, stored artifact verification, and stored artifact comparison do not
import or launch it. The cut-in challenge is explicitly a scripted kinematic replay with no behavior
realism claim.

## Canonical identity

| Surface | Value |
|---|---|
| Product/repository | `Hermes` |
| Intended GitHub repository | `bohueilin/Hermes` |
| Distribution | `hermes-autonomy` |
| Package | `hermes` |
| CLI | `hermes` |
| Module entry points | `python -m hermes`, `python -m hermes.cli` |
| Evidence root | `artifacts/` |
| External simulator | `third_party/metadrive/` |

## Environment

```bash
cd /Users/bohueilin/Documents/GitHub/Hermes
conda activate hermes-dev
python --version
which python
python -m pip install -e ".[dev]"
```

Install the optional local workbench only when needed:

```bash
python -m pip install -e ".[dev,workbench]"
```

## Environment doctor

```bash
hermes doctor
```

The optional display check may be `NOT_AVAILABLE` in a headless shell; the dedicated headless/offscreen prerequisite check is the relevant result.

## Phase 1 commands

```bash
hermes run \
  --simulator fake \
  --scenario scenarios/fake_nominal.yaml \
  --policy baseline \
  --seed 7 \
  --run-id phase1-nominal

hermes verify-artifact artifacts/phase1-nominal
```

The equivalent module entry paths remain available:

```bash
python -m hermes run --simulator fake --scenario scenarios/fake_nominal.yaml \
  --policy baseline --seed 7 --run-id module-nominal
python -m hermes.cli verify-artifact artifacts/module-nominal
```

Expected Phase 1 cases:

| Case | Verdict | Exit code |
|---|---|---:|
| Nominal | `PASS` | 0 |
| Soft degradation | `CONDITIONAL` | 10 |
| Collision or hard boundary violation | `HOLD` | 20 |
| Invalid/inconsistent evidence | `INVALID_EVIDENCE` | 30 |
| Configuration/operational failure | error | 40 |

Hermes reports stable `USAGE_ERROR`, `CONFIGURATION_ERROR`, `OPERATIONAL_ERROR`,
`INVALID_EVIDENCE`, and `INCOMPATIBLE_EVIDENCE` categories. Usage/configuration/operational and
incompatible-evidence failures exit `40`; invalid evidence exits `30`; malformed commands never
print `PASS`. The `doctor` command preserves its Phase 0 contract: `0` when no check is `FAIL`,
otherwise `1`.

A valid `HOLD` or `CONDITIONAL` bundle remains internally consistent and independently
verifiable; its verification command returns the policy verdict exit code. Corruption instead
returns `INVALID_EVIDENCE` / `30`.

## Phase 2 MetaDrive commands

```bash
hermes sim-smoke --headless

hermes run \
  --simulator metadrive \
  --scenario scenarios/metadrive_nominal.yaml \
  --policy metadrive-idm \
  --seed 7 \
  --run-id phase2-metadrive-nominal \
  --headless

hermes verify-artifact artifacts/phase2-metadrive-nominal
```

`sim-smoke` is an operational reset/IDM/step/close probe, not a release verdict. The full run
records MetaDrive version and exact source commit inside the trace-bound adapter configuration and
cross-checks the manifest. Unsupported front-distance and relative-speed signals are recorded as
`NOT_AVAILABLE`; they are not synthesized as zero. The observed nominal run is simulation-only and
does not establish road safety, certification, compliance, or deployment readiness.

MetaDrive runs default to the versioned `config/gates.phase2.yaml`. Its illustrative mission rule
requires both the named destination fact and at least 95% normalized named route progress; progress
alone cannot pass. The installed IDM target (`8.0 m/s` in the nominal scenario), disabled lane
changes, enabled deceleration, float32 action conversion, and adapter signal mappings are bound into
the execution context.

## Phase 3 shield and challenge commands

Run a challenge once with the no-op baseline and once with the deterministic shield, using unique
run IDs because Hermes never overwrites an artifact directory:

```bash
hermes run \
  --simulator metadrive \
  --scenario scenarios/metadrive_lead_vehicle_hard_brake.yaml \
  --policy metadrive-idm \
  --seed 7 \
  --run-id phase3-lead-baseline \
  --headless

hermes run \
  --simulator metadrive \
  --scenario scenarios/metadrive_lead_vehicle_hard_brake.yaml \
  --policy metadrive-idm \
  --seed 7 \
  --run-id phase3-lead-shielded \
  --headless \
  --shield deterministic \
  --shield-config config/shield.phase3.yaml

hermes verify-artifact artifacts/phase3-lead-baseline
hermes verify-artifact artifacts/phase3-lead-shielded
hermes compare artifacts/phase3-lead-baseline artifacts/phase3-lead-shielded
```

The exact shield reasons are `TTC_BELOW_THRESHOLD`, `SPEED_CAP`, `STALE_OBSERVATION`,
`BOUNDARY_RISK`, `EMERGENCY_STOP`, and `ACTUATION_DELAY_COMPENSATION`. All thresholds are strict,
versioned, and labeled illustrative. Every event preserves both candidate and executed actions;
reasons are present exactly when an override changes the action. Stored verification replays the
shield decision from trace-bound inputs without rerunning MetaDrive.

The second challenge is `scenarios/metadrive_cut_in_near_field.yaml`. Its actor movement is recorded
as `scripted_kinematic_replay` with `behavior_realism_claim: false`; it must not be presented as
native or realistic traffic behavior. Challenge front gap and relative speed come from the named
actor's actual oriented geometry and velocity in the simulator. TTC exists only for a laterally
overlapping front actor with a negative, closing relative speed; missing TTC remains
`NOT_AVAILABLE`. Challenge events preserve both policy-input and post-step actor/front state, so
minimum TTC includes the terminal observation while stored shield replay remains bound to the
actual policy input.

`hermes compare` first independently verifies both stored bundles. It returns `30` for invalid
evidence and `40` for incompatible valid evidence or configuration/operational failure. Compatible
comparisons report verdict, hard failures, collision, TTC, progress, comfort, latency, intervention,
and evidence-availability trade-offs; intervention counts are descriptive rather than ordinal.
See `docs/phase3-safety-shield.md` for exact rules, compatibility requirements, and limitations.

## Phase 4 deterministic fault command

```bash
hermes run \
  --simulator fake \
  --scenario scenarios/fake_fault_injection.yaml \
  --policy baseline \
  --seed 7 \
  --run-id phase4-fault-demo

hermes verify-artifact artifacts/phase4-fault-demo
```

Scenario schema `3.0` and evidence schema `2.0` distinguish raw/delivered/result observations and
candidate/shield-permitted/executed actions. Supported faults are observation delay, freeze,
dropout/hold-last, bounded source-packet noise, control delay, steering saturation, and brake
saturation. Every configured mechanism and scheduled freeze/dropout step must be exercised or the
required fault-coverage finding forces `HOLD`.

Stored verification exactly replays the shield and fault transformations without a simulator.
Candidate policy proposals and simulator results remain trace inputs; the policy and simulator are
not re-executed. MetaDrive IDM observation faults are rejected because that policy reads native
simulator state; only action delay/saturation are truthful for that profile. See
`docs/phase4-fault-and-ci-hardening.md` for the complete semantics and evidence boundary.

## Phase 6 evidence review

Review selections are exact POSIX-relative paths beneath the configured artifact root. Do not
prefix them with `artifacts/`, and Hermes never auto-selects a newest run.

```bash
hermes review-artifact handoff-phase5-demo \
  --artifact-root artifacts \
  --format text

hermes review-compare \
  handoff-p3-lead-baseline \
  handoff-p3-lead-shielded \
  --artifact-root artifacts \
  --format json

hermes workbench \
  --artifact-root artifacts \
  --host 127.0.0.1 \
  --port 8501 \
  --no-browser
```

The review CLI and workbench perform a fresh descriptor-relative, no-follow capture and invoke the
same stored verification facade. They never rerun a simulator or policy and never write, repair,
normalize, sign, approve, promote, or deploy an artifact. The workbench accepts numeric loopback
addresses only and disables Streamlit usage telemetry.

Every review keeps these states separate:

| Dimension | Phase 6 result |
|---|---|
| Gate verdict | `PASS`, `CONDITIONAL`, `HOLD`, or `INVALID_EVIDENCE` |
| Integrity | `INTERNALLY_CONSISTENT`, `INVALID_EVIDENCE`, or transient `UNVERIFIED` |
| Authenticity | `NOT_AUTHENTICATED` |
| Authorization | `NOT_EVALUATED` |
| Deployment permission | `NONE` |
| Scope | `SIMULATION_ONLY` |

Invalid evidence quarantines stored verdicts, findings, metrics, and timeline claims. Compatible
comparison shows improvements, regressions, unchanged outcomes, and evidence-availability deltas
without a winner score. The independent adversarial review closed all reproduced P1 findings; its
remaining accepted P2 is linear process-lifetime growth of explicitly selected review cache/session
entries. Restarting the single-user local process recovers that memory; a bounded synchronized LRU
is recommended before substantially increasing artifact scale.

The workbench information architecture is now:

```text
Review
  Select & Verify
  Overview
  Evidence
  Timeline
  Provenance
Compare
Evidence limitations
```

Selection is still a blank-by-default exact root-relative text entry followed by explicit Verify.
There is no picker or autocomplete because the public facade has no descriptor-safe discovery API;
adding discovery also requires the bounded-LRU predecessor. The selected locator stays visible,
findings use requiredness-first groups, Timeline has Decision evidence / Action accountability /
Fault behavior / All tracks presets, and compatible comparisons always show improvements and
regressions together with a no-overall-advancement interpretation.

Human review artifacts are:

- `docs/PHASE6_USABILITY_TEST_PLAN.md` — prospective Tasks 1–10 for 6–10 participants;
- `docs/PHASE6_HUMAN_OBSERVATION_TEMPLATE.md` — blank evidence record; and
- `docs/PHASE6_VISUAL_REVIEW_CHECKLIST.md` — executable visual, keyboard, screen-reader, contrast,
  table, focus, and 200% zoom/reflow checks.

Automated correctness does not promote those manual gates. No WCAG or reviewer-readiness claim is
made without actual observation.

## Evidence bundle

Every completed run must preserve:

```text
artifacts/<run-id>/
  manifest.json
  execution-context.json
  scenario.resolved.yaml
  gate-config.resolved.yaml
  events.jsonl
  metrics.json
  findings.json
  verdict.json
  trace.sha256
  bundle.sha256
```

`trace.sha256` is the final event-chain root. `bundle.sha256` binds the canonical manifest and all
companion bytes without a self-reference cycle. Stored artifact verification validates schemas,
digests, event semantics, metrics, complete findings, and the recomputed gate result without
rerunning a simulator. Completed-run publication uses a platform-native atomic no-replace rename;
Hermes fails safely if that primitive is unavailable. Verification captures required files through
no-follow directory-relative descriptors and rejects a bundle that changes during capture. It also
checks episode-horizon completeness, observation-summary consistency, the fake policy's explicitly
simulated latency source, and exact deterministic-shield replay when applicable.

## Development workflow

```bash
make check
make demo-phase1 DEMO_RUN_ID=<unique-lowercase-id>
make sim-smoke
git diff --check
```

PR-safe CI runs Python 3.11, installs `.[dev]`, runs Ruff, and runs
`pytest -m "not metadrive"`. Real MetaDrive validation remains an explicit local/manual gate.

Read before editing:

- `AGENTS.md` — durable repository rules;
- `PROJECT_BRIEF.md` — product scope and success criteria;
- `BUILD_PLAN.md` — executed gated plan and durable Phase 6 boundaries;
- `MASTER_PROMPT.md` — unattended Codex execution brief;
- `VALIDATION_MATRIX.md` — human acceptance checklist.

## Roadmap

1. Deterministic fake-simulator evidence core (implemented in Phase 1).
2. Bounded MetaDrive headless adapter (implemented in Phase 2).
3. Deterministic runtime shield, two bounded challenge scenarios, and stored evidence comparison
   (implemented in Phase 3).
4. Deterministic fault injection and fail-closed fault coverage (implemented in Phase 4).
5. PR-safe CI and developer-experience hardening (implemented in Phase 5).
6. Immutable review envelopes, root-contained review CLI, and local read-only workbench
   (implemented and adversarially hardened in Phase 6).
7. Reviewer-comprehension presentation and human-review package (implementation automated-audit
   green; manual visual, accessibility, and participant evidence still open).

Cloud/multi-user review, RL, CARLA, ROS 2, Autoware, hardware integration, and real-log training
remain deferred.

## Integrity limitation

Hermes uses canonical serialization and local SHA-256 chaining to make modification detectable. This is tamper-evident, not independently authenticated; a party able to rewrite the entire bundle can recompute hashes. External signing or an independent trust anchor is deferred.
