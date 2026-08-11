# Hermes — End-to-End Hackathon Build Plan

## 1. Product definition

**Hermes** is a simulation-only autonomous-driving scenario and safety-evidence lab.

**Product thesis:**

> Autonomy policy proposes → simulator verifies → gate decides → trace proves.

Hermes helps an autonomy product leader, safety reviewer, simulation engineer, or developer answer a specific question:

> Given a defined operational design domain, scenario, policy version, simulator version, and release-gate configuration, what happened, which requirements held or failed, and what evidence supports the advancement decision?

Hermes is intentionally not “a self-driving car in a weekend.” The prototype teaches the connective tissue required to build world-class autonomy software: architecture, scenarios, simulation, fault injection, verifiers, evidence provenance, release gates, hardware constraints, and cross-functional decision-making.

## 2. Canonical project naming

| Surface | Value |
|---|---|
| Product | `Hermes` |
| GitHub repository | `bohueilin/Hermes` |
| Local repository | `~/Projects/Hermes` |
| Python distribution | `hermes-autonomy` |
| Python package | `hermes` |
| CLI | `hermes` |
| Module CLI | `python -m hermes.cli` |
| Source root | `src/hermes/` |
| Evidence directory | `artifacts/` |
| Run ID prefix | `hermes-` |

Use **Hermes** in prose and repository naming. Use lowercase `hermes` in Python code and commands.

## 3. Repository strategy

Create and own the application repository:

```text
bohueilin/Hermes
```

Treat driving simulators and full autonomy stacks as dependencies or reference architectures rather than copying them into the product code.

| Repository | Role in the learning path | Timing |
|---|---|---|
| `metadriverse/metadrive` | Lightweight closed-loop simulator for the working MVP | Start here |
| `metadriverse/metadrive-scenario` | Scenario/log extensions | After deterministic MVP |
| `carla-simulator/carla` | Higher-fidelity sensors, actors, maps, and rendering | Phase 2 extension |
| `carla-simulator/scenario_runner` | Repeatable scenario execution and standards-oriented testing | With CARLA |
| `autowarefoundation/autoware` | Full ROS 2 autonomy-stack reference and later adapter target | Architecture study, then advanced integration |
| `waymo-research/waymo-open-dataset` | Offline perception, motion, and data-lifecycle learning | Optional extension |

## 4. What the prototype must demonstrate

Hermes should expose three connected loops.

### Runtime loop

```text
Observe → estimate world state → propose action → apply safety shield → execute → observe outcome
```

### Development loop

```text
Scenario or field signal → reproduce → diagnose → change policy/software → regress → compare → advance or hold
```

### Safety and evidence loop

```text
Hazard → requirement → scenario → verifier → evidence → gate → residual-risk owner
```

The user journey is:

1. Select a scenario, policy, seed, fault profile, and gate configuration.
2. Run a closed-loop simulation.
3. Inspect the candidate action and the action actually executed.
4. Inspect any runtime safety-shield intervention and reason code.
5. Review safety, mission, comfort, and system metrics.
6. Receive `PASS`, `CONDITIONAL`, `HOLD`, or `INVALID_EVIDENCE`.
7. Compare baseline and candidate policy versions.
8. Export and independently verify the evidence bundle.

## 5. Reference architecture

```text
Scenario YAML + ODD + Seed
          │
          ▼
  Run Orchestrator
          │
          ▼
 SimulatorAdapter ───────────────► MetaDrive
          ▲                            │
          │                            ▼
  Executed Action              Observation / World State
          ▲                            │
          │                            ▼
   Safety Shield ◄──────── Candidate Driving Policy
          │                            │
          └──────────────┬─────────────┘
                         ▼
                 Event / Trace Recorder
                         │
       ┌─────────────────┼─────────────────┐
       ▼                 ▼                 ▼
 Safety Verifiers   Mission/Comfort   System Verifiers
       └─────────────────┼─────────────────┘
                         ▼
                    Release Gate
                         │
                         ▼
        PASS / CONDITIONAL / HOLD / INVALID
                         │
                         ▼
          Hash-Chained Evidence Bundle
                         │
                         ▼
                Streamlit Review UI
```

### Architectural separation

- **Candidate policy:** proposes steering, throttle, and brake.
- **Safety shield:** may override the proposal using explicit deterministic rules.
- **Simulator adapter:** translates Hermes domain objects to a simulator API.
- **Offline verifiers:** independently evaluate the actual run.
- **Release gate:** issues a deterministic verdict from evidence and configuration.
- **Trace layer:** proves the scenario, versions, events, metrics, and decision were not silently altered.

An LLM may draft scenarios, explain evidence, generate tests, or summarize failures. It must not control the simulated vehicle in the real-time loop.

## 6. Constrained prototype ODD

The initial operational design domain must be narrow and explicit.

| Dimension | MVP boundary |
|---|---|
| Roads | Procedural, lane-structured roads |
| Lighting | Daylight |
| Weather | Clear |
| Dynamic actors | Vehicles only |
| Speed | Scenario-defined bounded range |
| Observation | State and LiDAR-like surrounding information |
| Maps | Procedural MetaDrive maps |
| Faults | Observation delay/dropout, control delay, actuator saturation |
| Exclusions | Pedestrians, emergency vehicles, severe weather, unstructured roads, construction |
| Deployment | Simulation only |

Do not label Hermes as SAE Level 4 or claim production safety. The project verdicts describe prototype evidence status, not a real-world automation classification.

## 7. MVP scenario catalog

| Scenario | Hazard under test | Primary evidence |
|---|---|---|
| Nominal lane following | Basic route or control failure | Progress, speed, boundary status |
| Lead vehicle hard braking | Rear-end collision | Collision, minimum TTC, harsh braking |
| Near-field cut-in | Inadequate gap handling | TTC, unsafe-gap duration, collision, override reason |
| Blocked lane | Unsafe response or deadlock | Collision, progress, stuck duration |
| Dense merge | Interaction and route-planning weakness | Collision, progress, unsafe-gap duration |
| Actuation latency | Delayed control and overshoot | End-to-end latency, collision, boundary, missed deadline |

Stretch scenarios:

- Frozen or dropped observations
- Low-friction surface
- Real-log replay
- Construction detour
- Occluded pedestrian in CARLA
- Map inconsistency
- Compute-overload or thermal-throttling proxy

## 8. Policies

### Baseline

Wrap MetaDrive’s supported deterministic IDM or closest stable equivalent. Do not build a perception-planning-control stack from scratch for the MVP.

### Candidate

Create a shielded baseline policy:

```text
Baseline IDM proposal + deterministic Hermes safety shield
```

The shield may override the candidate action when:

- Estimated TTC is below the configured threshold.
- Vehicle speed exceeds the scenario speed cap.
- An observation is stale, missing, or frozen.
- Road-boundary risk is detected.
- An emergency-stop condition is active.
- Actuation delay makes the pending command unsafe.

Every intervention emits a reason code:

```text
TTC_BELOW_THRESHOLD
STALE_OBSERVATION
SPEED_CAP
BOUNDARY_RISK
EMERGENCY_STOP
ACTUATION_DELAY_COMPENSATION
```

Record both candidate and executed actions. Otherwise, the shield could hide policy weakness and make the policy appear safer than it is.

### Optional learned-policy extension

After the deterministic MVP is complete, add a small PPO policy. Evaluate it through the same hard invariants and gate. A valuable demonstration is that a policy can improve simulator reward yet receive `HOLD` because it violates a safety invariant.

## 9. Metrics and gate design

### Hard invariants

Any hard-invariant failure results in `HOLD`; corrupt or incomplete evidence results in `INVALID_EVIDENCE`.

- Collision count equals zero.
- Off-road duration stays within the configured prototype tolerance.
- Wrong-way duration stays within tolerance when measurable.
- Required event completeness is satisfied.
- Trace hash chain verifies.
- Simulator or policy failures are reported, not hidden.
- Scenario, policy, gate, repository, and simulator versions are identifiable.

### Safety leading indicators

- Minimum TTC
- Unsafe-gap duration
- Emergency-braking count
- Safety-shield override count and reasons
- Boundary-risk duration

### Mission metrics

- Route completion
- Destination reached
- Stuck duration
- Episode termination reason
- Progress per unit time

### Comfort metrics

- Longitudinal acceleration
- Lateral acceleration when available
- Maximum jerk
- Harsh-braking events

### System-quality metrics

- Policy p50, p95, and p99 latency
- Missed control deadlines
- Dropped observations
- Stale observations
- Replay-determinism delta
- Evidence completeness

### Gate semantics

```python
if not trace_integrity or not required_evidence_complete:
    verdict = "INVALID_EVIDENCE"
elif any_hard_invariant_failed:
    verdict = "HOLD"
elif weighted_score >= pass_threshold:
    verdict = "PASS"
elif weighted_score >= conditional_threshold:
    verdict = "CONDITIONAL"
else:
    verdict = "HOLD"
```

All thresholds remain in versioned YAML and are labeled as illustrative prototype values.

## 10. Exact local bootstrap

```bash
mkdir -p ~/Projects/Hermes/third_party
cd ~/Projects/Hermes

git init
git branch -M main

python3.11 -m venv .venv
source .venv/bin/activate
python -m pip install --upgrade pip

git clone https://github.com/metadriverse/metadrive.git third_party/metadrive
python -m pip install -e third_party/metadrive
python -m metadrive.pull_asset
python -m metadrive.examples.verify_headless_installation
python -m metadrive.examples.profile_metadrive

git -C third_party/metadrive rev-parse HEAD > SIMULATOR_COMMIT
```

Create the GitHub repository after confirming the local root is correct:

```bash
gh repo create bohueilin/Hermes \
  --private \
  --source=. \
  --remote=origin \
  --description "Simulation-only autonomous-driving scenario and safety-evidence lab"
```

Do not push generated simulator assets, virtual environments, datasets, videos, or run artifacts.

## 11. ChatGPT Desktop setup

1. Open the ChatGPT Desktop app.
2. Create a local project using `~/Projects/Hermes` as the primary folder.
3. Select Codex for implementation work.
4. Keep approval-based execution enabled.
5. Paste the full contents of `MASTER_PROMPT.md`.
6. Require an environment assessment before code changes.
7. Require Phase 0 and Phase 1 acceptance gates before MetaDrive-specific expansion.
8. Use separate chats for architecture, simulator integration, verifiers, UI, tests, and executive demo after contracts stabilize.

## 12. Implementation sequence

### Phase 0 — Environment doctor and repository bootstrap

Implement:

```bash
hermes doctor
```

Report:

- Python version and virtual environment
- Operating system and CPU architecture
- MetaDrive import and exact commit
- Simulator assets
- Headless-rendering status
- Git commit and dirty state
- Writable artifact directory
- Optional display availability

**Acceptance gate:** every failure is actionable; unavailable dependencies are never shown as green.

### Phase 1 — Simulator-neutral vertical slice

Create typed contracts:

```python
SimulatorAdapter.reset()
SimulatorAdapter.step()
SimulatorAdapter.snapshot()
SimulatorAdapter.render()
SimulatorAdapter.close()
DrivingPolicy.reset()
DrivingPolicy.act()
SafetyShield.apply()
Verifier.observe()
Verifier.finalize()
Gate.evaluate()
TraceWriter.append()
```

Build `FakeSimulatorAdapter` before MetaDrive integration.

**Acceptance gate:** a deterministic fake ten-step run produces a valid evidence bundle and verdict.

### Phase 2 — Evidence integrity

Each run exports:

```text
artifacts/<hermes-run-id>/
├── manifest.json
├── scenario.resolved.yaml
├── gate-config.resolved.yaml
├── events.jsonl
├── metrics.json
├── verdict.json
├── trace.sha256
└── replay.gif or representative frames
```

The manifest records:

- Project name and `hermes-` run ID
- Repository commit and dirty state
- Simulator commit/version
- Scenario ID, resolved hash, seed, and ODD
- Policy name, version, and configuration hash
- Gate configuration version and hash
- Python and platform information
- Control frequency and horizon
- Evidence schema version

Add a tamper test by changing one event and requiring `INVALID_EVIDENCE`.

**Acceptance gate:** altered evidence can never receive `PASS` or `CONDITIONAL`.

### Phase 3 — MetaDrive nominal run

Implement:

```bash
hermes sim-smoke --headless
```

The command must load a procedural environment, run a deterministic policy, collect state, export evidence, save a representative replay or frames, and close cleanly.

Before integration, inspect the installed MetaDrive source, examples, and `MetaDriveEnv.default_config()`. Do not invent configuration keys.

**Acceptance gate:** one real MetaDrive run completes from the documented CLI.

### Phase 4 — Baseline and safety shield

Implement:

```text
BaselineIDMPolicy
ShieldedIDMPolicy
```

Test every override and no-override path independently.

**Acceptance gate:** every override reason is visible in evidence and covered by unit tests.

### Phase 5 — Scenario factory and fault injection

Use simulator-neutral YAML schemas and adapter translation.

Fault wrappers:

```text
ObservationDelay
ObservationDropout
FrozenObservation
BoundedObservationNoise
ControlDelay
SteeringSaturation
BrakeSaturation
```

For actuation delay, record both candidate time and execution time.

**Acceptance gate:** the same scenario, seed, policy, and configuration reproduce the same verdict within declared tolerances.

### Phase 6 — Verifier suite

Each verifier result contains:

```text
name
status
measured_value
threshold
severity
first_failure_time
supporting_event_sequences
explanation
```

Implement collision, boundary, TTC, speed, progress, comfort, latency, and trace-integrity verifiers. Unsupported metrics return `NOT_AVAILABLE` plus a reason, never zero.

**Acceptance gate:** each verifier has edge-case tests and points to supporting events.

### Phase 7 — Release gate and independent replay

Implement:

```bash
hermes verify-artifact artifacts/<run-id>
```

This command recomputes the verdict without rerunning MetaDrive.

**Acceptance gate:** the gate is deterministic from the evidence and gate configuration alone.

### Phase 8 — Dashboard

Build four Streamlit views:

1. **Scenario Lab:** scenario, policy, seed, faults, and run controls.
2. **Run Evidence:** verdict, invariants, metric timelines, override reasons, and replay.
3. **Policy Comparison:** baseline versus candidate deltas and regression status.
4. **Trace Integrity:** manifest, digests, event count, hash-chain status, and software versions.

**Acceptance gate:** a reviewer can explain a verdict without reading source code.

### Phase 9 — Tests and CI

PR-level checks:

```bash
ruff check .
pytest -q tests/unit tests/contract
```

Required coverage:

- Schema rejection and unknown fields
- Shield override and no-override paths
- All four verdicts
- Incomplete artifact
- Tampered artifact
- Policy exception
- Simulator exception
- Repeated-seed determinism
- Unsupported metric behavior

Keep heavyweight MetaDrive smoke tests explicit if CI lacks assets or rendering support.

**Acceptance gate:** CI cannot pass fabricated, incomplete, or silently skipped evidence.

### Phase 10 — Documentation and executive demo

Create:

- Architecture and interface document
- ODD and requirements document
- Scenario catalog and prioritization
- Safety-case traceability table
- Hardware-integration roadmap
- Operations and incident playbook
- Decision log
- RACI and decision-rights table
- Exact demo script

**Acceptance gate:** the demo and documents connect user value, system behavior, safety evidence, and release governance.

## 13. Demo sequence

### Demo 1 — Nominal PASS

```bash
hermes run \
  --scenario scenarios/nominal_lane_follow.yaml \
  --policy baseline \
  --headless
```

### Demo 2 — Baseline cut-in HOLD

```bash
hermes run \
  --scenario scenarios/cut_in_near_field.yaml \
  --policy baseline \
  --headless
```

Show the failed invariant or leading indicator and supporting event sequence.

### Demo 3 — Shielded policy improvement

```bash
hermes run \
  --scenario scenarios/cut_in_near_field.yaml \
  --policy shielded \
  --headless
```

Show the candidate action, override reason, executed action, TTC change, collision outcome, comfort tradeoff, and final verdict. A credible result may be `CONDITIONAL` rather than `PASS` if the intervention avoids collision but creates excessive jerk.

### Demo 4 — Tamper detection

```bash
hermes verify-artifact artifacts/tampered-run
```

Expected result:

```text
INVALID_EVIDENCE
Hash mismatch at event sequence <n>
```

### Executive narrative

> Hermes is not valuable because a simulated vehicle completed a route. It demonstrates how an autonomy organization converts a proposed behavior into reproducible scenario evidence, applies independent safety and quality checks, makes an explicit advancement decision, and preserves the trace. The architecture can graduate from lightweight simulation to CARLA, ROS 2, Autoware, and hardware-in-the-loop without rewriting the product logic.

## 14. Skills an autonomy PM leader must build

| Capability | Leadership expectation |
|---|---|
| Product and ODD | Define where the system operates, exclusions, user promise, fallback, and expansion gates |
| Autonomy architecture | Explain and challenge localization, perception, prediction, planning, control, and vehicle interfaces |
| Systems budgets | Own latency, jitter, compute, memory, bandwidth, power, thermal, and actuator-response budgets |
| Simulation strategy | Distinguish open-loop replay from closed-loop simulation and define required fidelity |
| Scenario engineering | Convert hazards, incidents, and uncertainty into reproducible parameterized tests |
| Data and ML lifecycle | Lead logging, consent, labeling, provenance, training/eval separation, and model lineage |
| Safety case | Connect hazards to requirements, scenarios, verifiers, evidence, gates, and residual-risk owners |
| Verifier integrity | Determine whether the evaluator can be fooled, is incomplete, or rewards unsafe shortcuts |
| Hardware integration | Understand sensors, calibration, synchronization, interference, compute, networks, and actuators |
| Developer infrastructure | Drive reproducibility, CI, replay, observability, regression analysis, and artifact lineage |
| Fleet operations | Define monitoring, fallback, remote-assistance boundaries, rollback, and incident response |
| Cross-functional governance | Establish decision rights across autonomy, simulation, safety, hardware, operations, security, legal, and UX |

Key questions to practice:

- What exact ODD does this change support?
- What new behavior can it produce?
- Which hazard does it introduce or mitigate?
- What independent oracle determines correctness?
- What is the oracle’s false-pass risk?
- Which scenarios prove the requirement?
- What happens when data is late, stale, missing, or contradictory?
- What are the p95 and p99 latency implications?
- How does the change affect compute, bandwidth, power, and thermal?
- Is the outcome reproducible?
- Who owns the residual risk?
- What signal triggers rollback?

## 15. Progression from simulation to hardware

### Stage 1 — Lightweight software-in-the-loop

MetaDrive: closed-loop behavior, scenarios, faults, verifiers, evidence, and gates.

### Stage 2 — Higher-fidelity software-in-the-loop

CARLA plus ScenarioRunner: cameras, LiDAR, radar, weather, pedestrians, traffic lights, synchronization, and realistic maps.

### Stage 3 — Full autonomy-stack integration

ROS 2 plus Autoware: topics, messages, transforms, localization, perception objects, trajectories, control commands, and diagnostics.

### Stage 4 — Standards mapping

Map Hermes schemas to ASAM OpenDRIVE and OpenSCENARIO concepts.

### Stage 5 — Processor- and hardware-in-the-loop

Run policy software on target compute while keeping sensors and vehicle dynamics simulated. Measure sensor-to-action latency, clock synchronization, utilization, memory, thermal throttling, frame loss, jitter, and missed deadlines.

### Stage 6 — Closed-lab physical platform

Use a scaled or controlled robotics platform to validate calibration, interference, actuation delay, network faults, power/thermal behavior, emergency stop, and sim-to-real gaps. Do not operate on public roads.

## 16. Recommended ChatGPT Desktop chat structure

1. Hermes bootstrap and environment doctor
2. Domain contracts and fake simulator
3. Evidence integrity and gate
4. MetaDrive adapter and baseline policy
5. Safety shield and verifiers
6. Scenario factory and fault injection
7. Dashboard and comparison
8. Tests and CI
9. ODD, hardware, safety case, and operating model
10. Final demo and adversarial audit

## Recommendation

Build **Hermes on MetaDrive first** with six deterministic scenarios, a deterministic baseline, a safety shield, independent verifiers, a release gate, and hash-chained evidence. Do not start with end-to-end perception, RL, CARLA, ROS, Autoware, or real hardware. The differentiator is the scenario-to-evidence system and the PM leadership model surrounding it.

## Top risks and mitigations

| Risk | Mitigation |
|---|---|
| Simulator installation dominates the project | Start with the fake adapter and evidence vertical slice; keep the first MetaDrive run headless |
| Simulator API drift | Inspect installed source, examples, and `default_config()`; add contract tests |
| Prototype becomes only a visualization | Make CLI, artifact, verifiers, and gate the source of truth |
| Thresholds appear like real safety claims | Store them in YAML and label them illustrative |
| Safety shield hides weak policy behavior | Record both candidate and executed actions plus every override reason |
| Aggregate score masks critical failure | Hard invariants always override the weighted score |
| Evidence is fabricated or incomplete | Require manifest provenance, completeness checks, hash chain, and tamper tests |
| RL distracts from systems learning | Add learned policy only after deterministic acceptance gates pass |
| Architecture cannot graduate to another simulator | Keep policies, verifiers, gate, and evidence behind simulator-neutral contracts |
| Project is misrepresented as production autonomy | Use only Hermes verdicts and state the simulation-only boundary in every demo |

## Next three actions

1. Copy this starter pack into `~/Projects/Hermes`, initialize Git, and create `bohueilin/Hermes` as a private GitHub repository.
2. Install MetaDrive from source and run its headless verification while recording the exact simulator commit.
3. Open `~/Projects/Hermes` in ChatGPT Desktop, paste `MASTER_PROMPT.md`, and require Phase 0–1 acceptance before simulator-specific expansion.
