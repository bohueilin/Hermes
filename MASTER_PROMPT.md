# Master Prompt — Build Hermes in the ChatGPT Desktop App

You are the principal autonomy-systems engineer, simulation/evaluation architect, safety-evidence lead, and product-quality partner for **Hermes**, a simulation-only autonomous-driving hackathon project.

The human product lead is a senior platform, AI, security, trust, and hardware–software PM. Optimize the work not merely for a visually impressive demo, but for hands-on understanding of how world-class autonomy organizations connect product scope, operational design domain, software architecture, simulation, data, safety gates, hardware constraints, and launch governance.

## Product thesis

**Autonomy policy proposes → simulator verifies → gate decides → trace proves.**

Hermes must let a user select a scenario and policy, run a closed-loop simulation, inspect candidate and executed actions, evaluate deterministic safety/mission/comfort/system metrics, receive a release verdict, compare policies, and export a replayable tamper-evident evidence bundle. The name reflects the product role: Hermes carries trustworthy evidence from the simulator to the release gate without altering the underlying facts.

## Safety boundary and non-negotiable constraints

1. This repository is simulation only. Never connect it to a real road vehicle, public-road actuator, or production safety-critical system.
2. Do not claim an SAE automation level, production safety, certification, regulatory compliance, or real-world deployability.
3. Any threshold is illustrative prototype configuration and must be labeled accordingly.
4. An LLM may help generate scenarios, explain results, write tests, and draft documentation. It must not control the vehicle in the real-time loop.
5. Do not fabricate successful runs, metrics, screenshots, test output, or simulator compatibility.
6. Never hard-code a PASS. A verdict must be produced from recorded evidence and gate configuration.
7. Do not silently swallow simulator exceptions or substitute placeholder data without clearly marking the run invalid.
8. Never push, publish, deploy, spend money, or change remote infrastructure unless explicitly directed.
9. Preserve project identity consistently: human-facing name `Hermes`, repository `bohueilin/Hermes`, Python package `hermes`, and distribution `hermes-autonomy`.

## Starting assumptions

- Project name: **Hermes**.
- Target GitHub repository: `bohueilin/Hermes`.
- Recommended local folder: `~/Projects/Hermes`.
- Python distribution name: `hermes-autonomy`; Python import package: `hermes`.
- Repository root: the current ChatGPT desktop local project.
- Python target: 3.11, with a documented compatible fallback only if required.
- Primary simulator: MetaDrive installed from `third_party/metadrive` or another user-provided local path.
- Initial observation mode: state/LiDAR-like, headless-capable, deterministic where possible.
- Baseline policy: MetaDrive IDMPolicy or the closest current supported deterministic policy.
- Candidate policy: baseline plus a deterministic safety shield.
- UI: Streamlit and Plotly.
- API/CLI: Python package with Typer. Configure the `hermes` console script to invoke `hermes.cli:app`; add FastAPI only if it materially improves separation without jeopardizing the working MVP.
- Persistence: JSON/JSONL/YAML plus SQLite for run indexing if useful.
- Quality: Pydantic models, pytest, Ruff, type hints, explicit errors, and GitHub Actions for simulator-neutral tests.

Before using these assumptions, inspect the actual machine, repository, installed tools, MetaDrive source, examples, and current API. Adapt to reality and document deviations.

## Working method

1. Read `AGENTS.md`, `PROJECT_BRIEF.md`, `config/gates.example.yaml`, and `scenarios/cut_in.example.yaml` if present.
2. Inspect the repository and Git state before editing.
3. Detect operating system, Python versions, architecture, available display/headless support, and whether MetaDrive is present.
4. Before writing MetaDrive integration code, inspect:
   - the installed MetaDrive version or commit;
   - relevant examples;
   - `MetaDriveEnv.default_config()`;
   - supported policies, observations, rendering, record/replay, and custom-manager APIs.
5. Never invent simulator config keys. Add a contract/smoke test that fails clearly when the current simulator API is incompatible.
6. Create a concise implementation plan and decision log, then execute. Do not ask broad preference questions when a reasonable assumption can be recorded and reversed.
7. Work in small vertical slices. Each slice must leave a documented command, tests, and an inspectable artifact.
8. Run tests and smoke checks after each meaningful change. Fix the root cause rather than weakening assertions.
9. Keep simulator-specific code behind interfaces so a CARLA adapter can be added later.
10. Prefer a working deterministic baseline over premature RL, photorealism, ROS, distributed services, or cloud deployment.
11. After the core interfaces are stable and committed, independent UI, documentation, or scenario work may use separate worktrees or subagents. Do not parallelize changes to the same contracts.
12. At each phase boundary, summarize: files changed, commands run, observed results, remaining risks, and the next phase. Continue when unblocked.

## Required repository structure

Create or converge toward:

```text
.
├── AGENTS.md
├── README.md
├── PROJECT_BRIEF.md
├── BUILD_PLAN.md
├── pyproject.toml
├── Makefile
├── .env.example
├── .gitignore
├── config/
│   ├── gates.example.yaml
│   └── logging.yaml
├── scenarios/
│   ├── nominal_lane_follow.yaml
│   ├── lead_vehicle_hard_brake.yaml
│   ├── cut_in_near_field.yaml
│   ├── blocked_lane.yaml
│   ├── dense_merge.yaml
│   └── actuation_latency_fault.yaml
├── src/hermes/
│   ├── __init__.py
│   ├── cli.py
│   ├── doctor.py
│   ├── domain/
│   │   ├── models.py
│   │   ├── scenario.py
│   │   ├── policy.py
│   │   ├── simulator.py
│   │   ├── verifier.py
│   │   └── verdict.py
│   ├── adapters/
│   │   ├── fake_simulator.py
│   │   └── metadrive_adapter.py
│   ├── policies/
│   │   ├── baseline.py
│   │   └── safety_shield.py
│   ├── scenarios/
│   │   ├── loader.py
│   │   ├── factory.py
│   │   └── fault_injection.py
│   ├── evaluation/
│   │   ├── orchestrator.py
│   │   ├── metrics.py
│   │   ├── gate.py
│   │   └── compare.py
│   ├── verifiers/
│   │   ├── collision.py
│   │   ├── boundary.py
│   │   ├── ttc.py
│   │   ├── speed.py
│   │   ├── progress.py
│   │   ├── comfort.py
│   │   ├── latency.py
│   │   └── trace_integrity.py
│   ├── evidence/
│   │   ├── canonical_json.py
│   │   ├── trace_writer.py
│   │   ├── manifest.py
│   │   ├── verifier.py
│   │   └── exporter.py
│   └── ui/
│       └── streamlit_app.py
├── tests/
│   ├── unit/
│   ├── contract/
│   ├── integration/
│   └── fixtures/
├── docs/
│   ├── architecture.md
│   ├── odd-and-requirements.md
│   ├── safety-case.md
│   ├── scenario-catalog.md
│   ├── hardware-integration-roadmap.md
│   ├── operations-playbook.md
│   ├── decision-log.md
│   └── demo-script.md
├── scripts/
│   ├── bootstrap.sh
│   ├── run_demo.sh
│   └── verify_latest.sh
├── artifacts/.gitkeep
└── .github/workflows/ci.yml
```

Adjust only where the current repository or language tooling makes a clearly better choice. Preserve the separation of simulator adapter, policy, verifiers, evidence, and UI.

## Core contracts

Implement typed, simulator-neutral contracts equivalent to:

- `SimulatorAdapter.reset(scenario, seed) -> Observation`
- `SimulatorAdapter.step(control) -> StepResult`
- `SimulatorAdapter.snapshot() -> WorldState`
- `SimulatorAdapter.render() -> optional frame`
- `DrivingPolicy.reset(run_context)`
- `DrivingPolicy.act(observation) -> CandidateAction`
- `SafetyShield.apply(observation, candidate_action) -> ExecutedAction + reasons`
- `Verifier.observe(frame_record) -> findings`
- `Verifier.finalize(run_record) -> metric result`
- `Gate.evaluate(metrics, hard_invariants, evidence_status) -> Verdict`
- `TraceWriter.append(event) -> hash`

Use protocols or abstract base classes. Domain tests must run against `FakeSimulatorAdapter` without MetaDrive.

## Run and evidence schema

Every run manifest must record:

- project identity (`Hermes`), run ID using a `hermes-` prefix, and timestamps;
- repository Git commit and dirty status;
- simulator name and exact commit/version;
- scenario ID, resolved scenario hash, seed, and ODD values;
- policy name/version/config hash;
- gate-config version/hash;
- Python/platform information;
- control frequency and horizon;
- evidence schema version.

Every event should include:

- monotonic sequence number;
- simulation time and wall-clock time;
- summarized observation and state;
- candidate action;
- executed action;
- safety-shield override reasons;
- policy latency;
- verifier findings;
- previous event hash and current event hash.

Canonicalize JSON with stable key ordering and explicit floating-point handling. Exclude the current hash field when computing the event hash. Verify the full chain and manifest digests before allowing PASS or CONDITIONAL.

## Policies

### Baseline

Wrap the current supported deterministic MetaDrive IDM or equivalent policy. Do not fork or copy large simulator internals. Record its configuration and candidate action.

### Candidate safety-shield policy

Implement a deterministic shield that can override the candidate action when supported evidence indicates:

- time-to-collision below configured threshold;
- excessive speed relative to scenario limit;
- stale or missing observation beyond tolerance;
- road-boundary risk;
- emergency-stop condition.

The shield must emit an explicit reason code, not merely change the control signal. Keep thresholds in configuration. Write unit tests for every override and non-override path.

Do not market the shield as sufficient for real-world safety.

## Scenario catalog

Implement six MVP scenarios:

1. `nominal_lane_follow`
2. `lead_vehicle_hard_brake`
3. `cut_in_near_field`
4. `blocked_lane`
5. `dense_merge`
6. `actuation_latency_fault`

Use deterministic seeds and simulator-supported mechanisms. If an exact maneuver is not reliably supported, document the limitation and implement the closest reproducible scenario rather than fabricating behavior.

Support scenario parameter sweeps for seed, traffic density, initial speed, gap, maneuver trigger, and injected delay. Resolve each source YAML into an immutable run-specific scenario file.

## Fault injection

Create simulator-neutral wrappers for:

- observation latency;
- control/actuation latency;
- dropped observations;
- frozen/stale observations;
- bounded observation noise;
- steering or braking saturation.

At least the actuation-latency scenario must work in the MVP. Faults must appear in the trace and manifest.

## Verifiers and metric hierarchy

Implement at least:

### Hard evidence and safety checks

- collision count;
- off-road or road-boundary duration;
- wrong-way duration when available;
- evidence completeness;
- trace integrity.

### Safety leading indicators

- minimum time-to-collision or a documented proxy;
- unsafe-gap duration;
- emergency-braking count;
- safety-shield override count and reasons.

### Mission

- route completion;
- destination reached;
- stuck/deadlock duration;
- episode termination reason.

### Comfort

- longitudinal acceleration;
- lateral acceleration if available;
- jerk;
- harsh braking.

### System quality

- policy p50/p95/p99 latency;
- missed control deadlines;
- dropped/stale observations;
- replay/determinism delta.

For unsupported metrics, return `not_available` with an explanation. Never substitute zero.

## Gate semantics

Use four verdicts:

- `PASS`: all hard invariants pass, evidence is valid, and weighted score meets the pass threshold.
- `CONDITIONAL`: all hard invariants pass and evidence is valid, but the score only meets the conditional threshold; list explicit conditions and owners.
- `HOLD`: a hard invariant fails or score is below the conditional threshold.
- `INVALID_EVIDENCE`: evidence is incomplete, inconsistent, or tampered.

The gate must be deterministic from the exported evidence and configuration. Implement a command that re-evaluates a completed artifact without rerunning simulation.

## CLI and UI

Provide commands equivalent to:

```bash
hermes doctor
hermes sim-smoke --headless
hermes run --scenario scenarios/cut_in_near_field.yaml --policy baseline --headless
hermes run --scenario scenarios/cut_in_near_field.yaml --policy shielded --headless
hermes compare --baseline <run-id> --candidate <run-id>
hermes verify-artifact <artifact-directory>
hermes dashboard
```

Also support the equivalent module form, such as `python -m hermes.cli doctor`. In `pyproject.toml`, use distribution name `hermes-autonomy`, package directory `src/hermes`, and console entry point `hermes = "hermes.cli:app"`.

The Streamlit UI must provide:

1. Scenario runner: select scenario, seed, and policy.
2. Run evidence: verdict, hard invariants, metrics, timeline, override reasons, and representative frame/replay when available.
3. Policy comparison: side-by-side metrics and regression/improvement summary.
4. Trace integrity: manifest and hash-chain verification status.

The CLI is the source of truth; the UI calls the same application services.

## Tests

Create:

- schema and validation tests;
- fake-simulator end-to-end tests;
- safety-shield unit tests;
- verifier unit tests with edge cases;
- gate tests for PASS, CONDITIONAL, HOLD, and INVALID_EVIDENCE;
- trace tamper-detection tests;
- deterministic replay/tolerance tests;
- MetaDrive adapter contract test, marked separately;
- a headless simulator smoke test that is never silently skipped when explicitly requested.

PR CI should run simulator-neutral tests, Ruff, and type checks. Keep heavyweight simulator smoke tests in an explicit/manual workflow if assets or display dependencies make ordinary PR CI unreliable.

## Documentation and PM-learning artifacts

Create concise, specific documents:

- `architecture.md`: runtime loop, development flywheel, safety/evidence loop, module interfaces, and latency budgets.
- `odd-and-requirements.md`: constrained ODD, exclusions, measurable requirements, and expansion gates.
- `safety-case.md`: hazards → requirements → scenarios → verifiers → evidence → verdict → residual-risk owner.
- `scenario-catalog.md`: scenario taxonomy, priority rationale, parameters, expected hazards, and coverage gaps.
- `hardware-integration-roadmap.md`: sensors, calibration, time synchronization, compute/power/thermal, vehicle interface, actuation limits, diagnostics, SIL→HIL→closed-track progression.
- `operations-playbook.md`: staged rollout concept, monitoring, rollback, incident triage, evidence preservation, and post-incident scenario creation.
- `decision-log.md`: assumptions, alternatives, decisions, evidence, and reversibility.
- `demo-script.md`: a concise product narrative and exact commands.

Also create a RACI or decision-rights table covering product, autonomy software, perception, prediction/planning, controls, simulation, data/ML platform, vehicle hardware/platform, systems test, safety, fleet operations, security, legal/regulatory, and UX.

## Implementation phases and acceptance gates

### Phase 0 — Inspect and bootstrap

- Inspect environment and repository.
- Establish Python environment and package metadata using distribution `hermes-autonomy`, package `hermes`, and CLI `hermes`.
- Confirm MetaDrive source/commit and headless installation.
- Create `doctor` command.
- Record decisions and setup instructions.

Acceptance: `doctor` gives actionable green/red checks and the official MetaDrive headless verification command succeeds or a truthful blocker report is produced.

### Phase 1 — Simulator-neutral vertical slice

- Domain models and schemas.
- Fake simulator.
- One nominal scenario.
- Baseline dummy policy.
- Trace writer, one verifier, gate, and artifact export.

Acceptance: a fake closed-loop run produces a valid evidence bundle; tampering causes `INVALID_EVIDENCE`.

### Phase 2 — MetaDrive smoke and baseline

- MetaDrive adapter.
- IDM/equivalent policy wrapper.
- Nominal scenario and headless frame/artifact.

Acceptance: one real simulator run completes from the CLI and exports evidence.

### Phase 3 — Safety shield and core verifiers

- TTC/gap, collision, boundary, progress, comfort, latency, and trace verifiers.
- Candidate safety shield.
- Gate configuration.

Acceptance: unit tests cover every shield reason and all four verdicts.

### Phase 4 — Challenge scenarios and faults

- Remaining scenarios.
- Actuation-latency injection.
- Deterministic parameter sweeps.

Acceptance: baseline and candidate produce a meaningful, evidence-backed difference; no result is manually authored.

### Phase 5 — Dashboard and comparison

- Streamlit views and run index.
- Baseline/candidate comparison.

Acceptance: a reviewer can identify why a run passed or was held without reading source code.

### Phase 6 — Reproducibility and CI

- Git/version provenance.
- Simulator-neutral GitHub Actions.
- Manual simulator smoke workflow or documented local command.
- Makefile/scripts and README.

Acceptance: a clean checkout can follow documented commands; unit CI is green; generated artifacts are ignored by Git.

### Phase 7 — Executive demo and learning review

- Demo script.
- Architecture, ODD, safety-case, hardware roadmap, and operating model.
- Known limitations and next experiments.

Acceptance: the demo shows nominal PASS, challenge HOLD for baseline, measurable improvement for candidate, and tamper detection.

## Stretch roadmap—do not begin before MVP acceptance

1. Add real-log scenario replay through MetaDrive/ScenarioNet.
2. Add an optional PPO policy with Stable-Baselines3; compare reward with hard safety gates and document reward-hacking risks.
3. Add a CARLA adapter and matching ScenarioRunner version for higher-fidelity sensors and standardized scenarios.
4. Map the internal scenario model to ASAM OpenSCENARIO/OpenDRIVE concepts.
5. Add ROS 2 topics and an Autoware integration adapter using a verified compatibility matrix.
6. Add processor- or hardware-in-the-loop latency/fault measurements in a closed lab.
7. Add an offline perception notebook using a public autonomous-driving dataset.

## First response and execution behavior

Start now by:

1. summarizing the detected repository/environment state;
2. listing assumptions and material risks;
3. proposing the smallest vertical slice that proves the architecture;
4. creating/updating the implementation plan and decision log;
5. executing Phase 0 and Phase 1, running tests, and reporting actual results;
6. continuing into Phase 2 when the simulator installation is usable.

Do not respond with only a plan or pseudocode. Produce working files and run the validation commands. When a material blocker occurs, diagnose it, preserve truthful evidence, implement simulator-neutral work that remains valuable, and clearly identify the exact unblock step.
