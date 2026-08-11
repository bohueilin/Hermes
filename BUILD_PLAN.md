# Hermes — Comprehensive Codex Build Plan

## 1. Executive intent

Hermes is a simulation-only autonomous-driving scenario and safety-evidence lab.

> **Autonomy policy proposes → environment executes → verifiers evaluate → gate decides → trace proves.**

The build should teach and demonstrate the connective tissue of a world-class autonomy organization:

- explicit operational design domain boundaries;
- simulator-neutral software contracts;
- deterministic scenario execution;
- candidate-versus-executed action accountability;
- independent safety, mission, comfort, and system verifiers;
- evidence provenance and integrity;
- release-gate semantics;
- reproducible developer workflows;
- progression from software simulation toward hardware-aware validation.

The prototype must not optimize for visual spectacle before it establishes trustworthy evidence semantics.

## 2. Current validated baseline

The plan begins after Hermes Phase 0.

| Item | Validated state |
|---|---|
| Repository root | `/Users/bohueilin/Documents/GitHub/Hermes` |
| Baseline branch | `main` |
| Baseline commit | `c181509a691b132cb732a50c24612f6bd40bafca` |
| Distribution | `hermes-autonomy` |
| Package | `hermes` |
| CLI | `hermes` |
| Conda environment | `hermes-dev` |
| Python | 3.11.15 |
| Existing tests | 26 passing |
| Ruff | Passing |
| Doctor | 18 PASS, 1 acceptable NOT_AVAILABLE |
| MetaDrive | 0.4.3 |
| MetaDrive commit | `85e5dadc6c7436d324348f6e3d8f8e680c06b4db` |
| MetaDrive validation | Headless and offscreen launch passed |

Before implementation, Codex must verify the actual current state and preserve any valid changes made after this baseline.

## 3. Product definition

### 3.1 Primary user

An autonomy product leader, safety reviewer, simulation engineer, autonomy developer, or release owner evaluating whether a policy or software change is ready to advance within a constrained operational design domain.

### 3.2 Core user question

> Given a scenario, seed, policy version, environment implementation, and release-gate configuration, what happened, which requirements held or failed, and what evidence supports the advancement decision?

### 3.3 Core user journey

1. Select a scenario, simulator adapter, policy, shield, seed, fault profile, and gate configuration.
2. Execute a bounded closed-loop run.
3. Inspect the observation, candidate action, executed action, and override reason at each step.
4. Review safety, mission, comfort, and system findings.
5. Receive `PASS`, `CONDITIONAL`, `HOLD`, or `INVALID_EVIDENCE`.
6. Independently verify the stored artifact without rerunning the simulator.
7. Compare baseline and candidate runs.
8. Export a self-contained evidence bundle for review.

### 3.4 Non-goals

- Public-road driving or physical vehicle control.
- A full production perception, prediction, planning, and controls stack.
- SAE automation-level claims.
- Certification, regulatory approval, or formal safety-case completion.
- Photorealistic rendering as the first milestone.
- End-to-end neural driving.
- RL before deterministic verifiers and gates are trustworthy.
- Cloud deployment, fleet operations, or external telemetry.

## 4. Canonical naming

| Surface | Value |
|---|---|
| Product | `Hermes` |
| Repository | `bohueilin/Hermes` |
| Distribution | `hermes-autonomy` |
| Import package | `hermes` |
| CLI | `hermes` |
| Module CLI | `python -m hermes` or `python -m hermes.cli` |
| Source root | `src/hermes/` |
| Evidence root | `artifacts/` |
| External simulator | `third_party/metadrive/` |

## 5. Product and engineering principles

### 5.1 Evidence before aesthetics

A functioning CLI, verifiable artifact, and trustworthy negative path are more important than a dashboard or polished animation.

### 5.2 Hard invariants cannot be averaged away

A collision, hard boundary violation, or invalid evidence bundle cannot be compensated for by progress, comfort, or an aggregate score.

### 5.3 Capability is not permission

A policy may be capable of proposing an action. A shield determines whether the proposed action may execute. Verifiers determine whether the resulting behavior met requirements. The gate determines whether the software version may advance.

### 5.4 Candidate action is not executed action

Hermes must preserve both, even when they are equal. This distinction is essential for runtime interventions, post-incident analysis, and verifier integrity.

### 5.5 Determinism is a product feature

Identical scenario content, adapter version, policy version, shield version, gate configuration, and seed must produce identical deterministic trace content and verdict.

### 5.6 Missing evidence is explicit

A metric that cannot be computed is `NOT_AVAILABLE` with a reason. It is never silently represented as zero, false, or pass.

### 5.7 Local hashing has limits

Hash chaining detects accidental or unsophisticated modification. It does not prove independent authenticity when an attacker can rewrite the bundle and recompute all hashes. Hermes must state that limitation.

### 5.8 Simulation fidelity is scoped

The fake simulator validates software architecture, not physics. MetaDrive adds closed-loop dynamics and simulator integration, but it still does not prove real-world performance.

## 6. Constrained prototype ODD

| Dimension | Initial boundary |
|---|---|
| Road structure | Lane-structured procedural roads |
| Lighting | Daylight |
| Weather | Clear |
| Dynamic actors | Vehicles only |
| Speed | Scenario-configured bounded range |
| Observation | State and LiDAR-like context when supported |
| Maps | Procedural MetaDrive maps |
| Faults | Delay, dropout, stale observations, bounded noise, actuator saturation |
| Exclusions | Pedestrians, emergency vehicles, construction, severe weather, unstructured roads |
| Deployment | Simulation only |

The ODD must be present in scenario or project documentation and remain narrower than any claims made in the demo.

## 7. Target architecture

```text
Scenario YAML + ODD + Seed + Gate Config
                    │
                    ▼
             Run Orchestrator
                    │
        ┌───────────┴───────────┐
        ▼                       ▼
 Driving Policy          Runtime Safety Shield
        │ candidate              │ executed + reason
        └───────────┬───────────┘
                    ▼
             SimulatorAdapter
                    │
                    ▼
 Observation / Vehicle State / Termination
                    │
                    ▼
             Canonical Trace Writer
                    │
        ┌───────────┼─────────────┐
        ▼           ▼             ▼
 Safety Verifiers  Mission      Comfort/System
        └───────────┼─────────────┘
                    ▼
                Release Gate
                    │
                    ▼
 PASS / CONDITIONAL / HOLD / INVALID_EVIDENCE
                    │
                    ▼
       Versioned, hash-chained evidence bundle
                    │
                    ▼
     Independent artifact verification / comparison
```

### 7.1 Layer responsibilities

| Layer | Responsibility | Forbidden coupling |
|---|---|---|
| Domain | Stable types and contracts | No MetaDrive imports |
| Scenario | Strict schema and resolved inputs | No silent unknown fields |
| Policy | Candidate action proposal | No gate decisions |
| Shield | Deterministic action permission/override | No post-hoc metric rewriting |
| Adapter | Translate domain commands to environment | No release policy |
| Trace | Canonical event serialization and chaining | No simulator rerun |
| Verifier | Independent requirement evaluation | No access to mutable simulator internals |
| Gate | Verdict precedence and rationale | No direct simulator dependencies |
| CLI | Composition and human-readable output | No business logic concentration |

## 8. Recommended repository structure

```text
Hermes/
├── AGENTS.md
├── BUILD_PLAN.md
├── MASTER_PROMPT.md
├── PROJECT_BRIEF.md
├── README.md
├── CODEX_HANDOFF.md                 # generated by Codex
├── Makefile
├── pyproject.toml
├── SIMULATOR_COMMIT
├── artifacts/
│   └── .gitkeep
├── config/
│   ├── gates.example.yaml
│   ├── gates.phase1.yaml
│   └── gates.phase2.yaml
├── docs/
│   ├── decision-log.md
│   ├── phase1-architecture.md
│   ├── phase1-requirements-traceability.md
│   ├── phase2-metadrive-adapter.md
│   ├── demo-runbook.md
│   └── PM_SKILLS_MATRIX.md
├── scenarios/
│   ├── fake_nominal.yaml
│   ├── fake_collision.yaml
│   ├── fake_boundary.yaml
│   ├── fake_soft_degradation.yaml
│   ├── metadrive_nominal.yaml
│   ├── lead_vehicle_hard_brake.yaml
│   └── cut_in_near_field.yaml
├── src/hermes/
│   ├── __init__.py
│   ├── __main__.py
│   ├── cli.py
│   ├── doctor.py
│   ├── domain/
│   │   ├── contracts.py
│   │   ├── enums.py
│   │   └── models.py
│   ├── scenarios/
│   │   ├── loader.py
│   │   └── schema.py
│   ├── policies/
│   │   ├── baseline.py
│   │   └── metadrive_idm.py
│   ├── shields/
│   │   ├── noop.py
│   │   └── deterministic.py
│   ├── adapters/
│   │   ├── fake.py
│   │   └── metadrive.py
│   ├── runtime/
│   │   ├── orchestrator.py
│   │   └── registry.py
│   ├── evidence/
│   │   ├── artifacts.py
│   │   ├── canonical.py
│   │   ├── trace.py
│   │   └── verification.py
│   ├── verifiers/
│   │   ├── boundary.py
│   │   ├── collision.py
│   │   ├── comfort.py
│   │   ├── integrity.py
│   │   ├── latency.py
│   │   └── progress.py
│   ├── gates/
│   │   └── release.py
│   └── comparison/
│       └── compare.py
└── tests/
    ├── unit/
    ├── contract/
    ├── integration/
    └── cli/
```

Exact filenames may change when justified, but boundaries must remain recognizable.

## 9. Unattended execution strategy

### 9.1 Branch strategy

Use a dedicated feature branch:

```bash
git switch -c feat/unattended-evidence-core
```

If that branch already exists, switch to it and inspect current work. Do not discard valid changes.

### 9.2 Priority queue

| Priority | Work | Advancement rule |
|---|---|---|
| P0 | Phase 1 deterministic evidence core | Mandatory; all gates green |
| P1 | Phase 2 MetaDrive bounded nominal adapter | Only after P0 |
| P2 | Phase 3 safety shield + two challenge scenarios | Only after P1 |
| P3 | Faults, compare command, CI, demo hardening | Only after P2 |
| Deferred | Dashboard, RL, CARLA, ROS, hardware | Do not start |

### 9.3 Checkpoints

After each phase:

1. Run focused tests.
2. Run full tests and lint.
3. Run real demo commands.
4. Verify stored artifacts independently.
5. Update requirements traceability.
6. Update decision log and handoff.
7. Inspect Git diff.
8. Create a local commit only when green.

### 9.4 Blocker handling

- If one scenario is blocked, continue core infrastructure and other scenarios.
- If network access is blocked, use existing dependencies or standard library; document any deferred dependency.
- If MetaDrive behaves differently from documentation, inspect installed source and adapt to observed APIs.
- If a phase gate cannot pass, do not proceed to dependent phases.
- Preserve failing artifacts only when clearly labeled and useful for diagnosis.

## 10. Phase 1 — Deterministic simulator-neutral evidence core

### 10.1 Objective

Prove the complete Hermes control and evidence loop without MetaDrive, graphics, or external services.

Required outcomes:

| Scenario/evidence condition | Verdict |
|---|---|
| Nominal fake run | `PASS` |
| Deterministic collision | `HOLD` |
| Deterministic boundary violation | `HOLD` |
| Soft degradation with hard invariants satisfied | `CONDITIONAL` |
| Modified/incomplete evidence | `INVALID_EVIDENCE` |

### 10.2 Workstream A — Domain contracts

Implement typed, simulator-neutral models and protocols for:

- `Observation`
- `VehicleState`
- `Action`
- `StepResult`
- `EpisodeResult`
- `ScenarioDefinition`
- `SimulatorAdapter`
- `DrivingPolicy`
- `SafetyShield`
- `Verifier`
- `Finding`
- `GateResult`
- `TraceEvent`
- `ArtifactManifest`

Requirements:

- bounded action validation;
- explicit enum values for verdicts, status, severity, termination reason, and evidence availability;
- serialization-safe values;
- no simulator imports;
- type hints on public interfaces;
- unit tests for validation and edge cases.

### 10.3 Workstream B — Strict scenario schema

Use a versioned YAML schema, preferably Pydantic v2 and PyYAML.

Required behavior:

- reject unknown fields;
- reject invalid types and ranges;
- reject contradictory parameters;
- resolve defaults explicitly;
- preserve resolved scenario content;
- include scenario and schema versions;
- produce actionable validation errors;
- compute a canonical scenario digest.

Create:

```text
scenarios/fake_nominal.yaml
scenarios/fake_collision.yaml
scenarios/fake_boundary.yaml
scenarios/fake_soft_degradation.yaml
```

### 10.4 Workstream C — Fake simulator

Implement deterministic bounded dynamics sufficient to expose:

- longitudinal position;
- speed;
- acceleration/deceleration;
- lateral offset;
- route progress;
- collision state;
- off-road state;
- destination reached;
- termination and truncation reasons;
- deterministic hazard injection.

The fake simulator must be clearly documented as an architectural test double rather than a physics model.

### 10.5 Workstream D — Baseline policy and no-op shield

Baseline policy:

- stable name and version;
- deterministic target-speed control;
- deterministic lateral correction;
- bounded steering, throttle, and brake;
- no unseeded randomness;
- explicit simulated latency metadata.

No-op shield:

- returns candidate action unchanged;
- returns an empty override-reason list;
- stable name and version;
- preserves candidate/executed action separation.

### 10.6 Workstream E — Run orchestrator

The orchestrator must:

1. validate inputs;
2. resolve scenario, gate, policy, shield, and adapter versions;
3. initialize the adapter and policy;
4. gather repository provenance;
5. request a candidate action;
6. apply the shield;
7. execute the action;
8. record a canonical event;
9. continue to bounded completion;
10. close the adapter on every path;
11. finalize the trace;
12. run verifiers;
13. compute metrics;
14. apply the gate;
15. write the bundle atomically;
16. return verdict and artifact path.

Operational failures must never produce `PASS`.

### 10.7 Workstream F — Canonical trace

Each event must include:

- evidence schema version;
- sequence number;
- simulation time;
- observation summary;
- candidate action;
- executed action;
- override reasons;
- vehicle state;
- simulated policy latency and source;
- termination state;
- verifier-relevant raw facts;
- previous hash;
- current hash.

Canonicalization rules:

- UTF-8;
- sorted keys;
- deterministic separators;
- no NaN or Infinity;
- stable numeric representation;
- explicit genesis value;
- SHA-256;
- no wall-clock time or run ID in deterministic event content.

### 10.8 Workstream G — Evidence bundle

Required files:

```text
manifest.json
scenario.resolved.yaml
gate-config.resolved.yaml
events.jsonl
metrics.json
verdict.json
trace.sha256
```

Manifest requirements:

- evidence schema version;
- Hermes version;
- Git commit and dirty state;
- adapter name/version;
- scenario name/version/schema and digest;
- policy name/version/config digest;
- shield name/version;
- gate name/version/config digest;
- seed;
- control frequency;
- horizon;
- Python/platform/architecture;
- UTC creation time;
- trace digest;
- required-file inventory and digests.

Write through a temporary directory and atomically rename. Reject unsafe run IDs and existing destinations.

### 10.9 Workstream H — Verifiers

Implement:

#### CollisionVerifier

- hard invariant: collision count equals zero;
- critical failure;
- first failure time and event sequences.

#### BoundaryVerifier

- hard invariant: configured boundary tolerance not exceeded;
- maximum lateral offset/off-road duration;
- supporting event sequences.

#### ProgressVerifier

- destination or progress target;
- distinguish failure from unavailable evidence.

#### ComfortVerifier

- acceleration, deceleration, or jerk when supported;
- soft threshold may produce `CONDITIONAL`;
- explicit `NOT_AVAILABLE` when signal is absent.

#### TraceIntegrityVerifier

- required files;
- sequence continuity;
- event-chain integrity;
- digest consistency;
- malformed/truncated evidence.

### 10.10 Workstream I — Release gate

Precedence:

1. Invalid, missing, malformed, or inconsistent evidence → `INVALID_EVIDENCE`.
2. Collision hard invariant failed → `HOLD`.
3. Boundary hard invariant failed → `HOLD`.
4. Required mission evidence unavailable → explicit configured `HOLD` or `INVALID_EVIDENCE` rule.
5. Hard invariants pass, mission succeeds, soft threshold fails → `CONDITIONAL`.
6. Hard invariants and required soft criteria pass → `PASS`.

Every verdict must include rationale, supporting finding IDs, hard failures, soft failures, and residual limitations.

### 10.11 Workstream J — Artifact verification

`hermes verify-artifact <dir>` must not rerun any simulator.

It must:

- validate required files;
- verify scenario and gate digests;
- parse and validate events;
- check sequence continuity;
- recompute the hash chain;
- identify the first mismatch;
- recompute metrics;
- rerun verifiers from stored events;
- recompute the verdict;
- compare stored metrics and verdict;
- verify the trace root;
- use exit code `30` for invalid evidence.

### 10.12 Workstream K — CLI

Required commands:

```bash
hermes doctor
hermes run --simulator fake --scenario <path> --policy baseline --seed <n> --run-id <id>
hermes verify-artifact <artifact-dir>
```

Exit codes:

| Code | Meaning |
|---:|---|
| 0 | PASS |
| 10 | CONDITIONAL |
| 20 | HOLD |
| 30 | INVALID_EVIDENCE |
| 40 | Configuration or operational error |

CLI help must state simulation-only scope.

### 10.13 Phase 1 negative tests

Automate:

- one modified executed action;
- truncated event file;
- missing event file;
- modified scenario;
- modified gate configuration;
- modified metrics;
- modified verdict;
- duplicate sequence;
- path traversal run ID;
- existing run ID;
- adapter exception;
- policy exception;
- unavailable evidence.

### 10.14 Phase 1 determinism test

Same scenario content, adapter version, policy version, shield version, gate config, and seed under different run IDs must produce identical:

- events;
- final event hash;
- trace digest;
- metrics;
- findings;
- verdict.

Creation timestamp, run ID, and host execution duration may differ.

### 10.15 Phase 1 documentation

Create/update:

- `README.md`;
- `docs/phase1-architecture.md`;
- `docs/phase1-requirements-traceability.md`;
- `docs/decision-log.md`;
- `docs/PM_SKILLS_MATRIX.md`;
- `CODEX_HANDOFF.md`.

### 10.16 Phase 1 acceptance commands

```bash
python -m pip install -e ".[dev]"
python -m pytest -q
python -m ruff check .
python -m hermes doctor
git diff --check

hermes run \
  --simulator fake \
  --scenario scenarios/fake_nominal.yaml \
  --policy baseline \
  --seed 7 \
  --run-id phase1-nominal

hermes verify-artifact artifacts/phase1-nominal

hermes run \
  --simulator fake \
  --scenario scenarios/fake_collision.yaml \
  --policy baseline \
  --seed 7 \
  --run-id phase1-collision

hermes verify-artifact artifacts/phase1-collision

hermes run \
  --simulator fake \
  --scenario scenarios/fake_boundary.yaml \
  --policy baseline \
  --seed 7 \
  --run-id phase1-boundary

hermes run \
  --simulator fake \
  --scenario scenarios/fake_soft_degradation.yaml \
  --policy baseline \
  --seed 7 \
  --run-id phase1-conditional
```

Then create and verify a tampered copy and run a repeated nominal case.

### 10.17 Phase 1 advancement gate

All must be true:

- all tests pass;
- Ruff passes;
- doctor has no failure;
- nominal `PASS` exit 0;
- collision `HOLD` exit 20;
- boundary `HOLD` exit 20;
- soft degradation `CONDITIONAL` exit 10;
- tampered bundle `INVALID_EVIDENCE` exit 30;
- repeated inputs produce identical trace digest;
- stored verification never reruns a simulator;
- no MetaDrive runtime is used;
- no generated artifacts are staged.

Only then create the local commit:

```text
feat: add deterministic evidence core
```

## 11. Phase 2 — MetaDrive headless adapter

### 11.1 Objective

Replace the fake environment with one bounded, deterministic MetaDrive run while preserving the same contracts, trace, verifiers, gate, artifact format, and CLI semantics.

### 11.2 API reconnaissance

Before implementation, inspect the installed MetaDrive 0.4.3 source and examples:

- `MetaDriveEnv.default_config()`;
- headless verification example;
- policy examples;
- environment reset/step signatures;
- observation shape and `info` fields;
- vehicle state accessors;
- collision/off-road/destination flags;
- deterministic seeding controls;
- clean shutdown behavior.

Write `docs/phase2-metadrive-adapter.md` with observed APIs. Do not use keys copied from another release without verification.

### 11.3 Adapter contract

Implement `MetaDriveAdapter` behind `SimulatorAdapter`.

It must:

- avoid MetaDrive imports at package import time when not selected;
- validate simulator availability;
- construct a bounded headless environment;
- translate Hermes actions to MetaDrive action format;
- translate observation and vehicle state into Hermes models;
- expose collision, off-road, route progress, destination, termination, and truncation when supported;
- label unsupported fields `NOT_AVAILABLE`;
- close the environment on every path;
- record MetaDrive version and source commit;
- leave `third_party/metadrive` unchanged.

### 11.4 Phase 2 CLI

Add:

```bash
hermes sim-smoke --headless
```

and support:

```bash
hermes run \
  --simulator metadrive \
  --scenario scenarios/metadrive_nominal.yaml \
  --policy metadrive-idm \
  --seed 7 \
  --run-id phase2-metadrive-nominal \
  --headless
```

The smoke command is a bounded integration check, not a substitute for the full evidence run.

### 11.5 MetaDrive policy

Prefer an installed deterministic MetaDrive policy such as IDM when the observed API supports it. Wrap it rather than copying simulator internals.

Record:

- policy name/version;
- relevant configuration;
- candidate action;
- any policy limitation.

If a built-in policy cannot be integrated cleanly through the desired interface, implement a small deterministic Hermes policy against supported state rather than modifying MetaDrive.

### 11.6 Phase 2 verifiers

Reuse Phase 1 verifiers. Add adapter-specific evidence mapping tests, not adapter-specific gate rules.

For unsupported metrics:

- use `NOT_AVAILABLE`;
- explain why;
- do not fail unless gate configuration explicitly requires the signal.

### 11.7 Phase 2 tests

Unit/contract tests should mock or fake MetaDrive surfaces so most CI remains headless and fast.

Add one explicit local integration test or command for the real simulator.

Test:

- adapter import behavior;
- config validation;
- reset and step translation;
- action bounds;
- state mapping;
- termination mapping;
- close on normal and exceptional paths;
- provenance capture;
- artifact verification without MetaDrive rerun.

### 11.8 Phase 2 acceptance gate

All must be true:

- Phase 1 remains green;
- `hermes sim-smoke --headless` succeeds;
- one MetaDrive nominal run completes;
- evidence bundle is complete;
- stored artifact verifies without simulator rerun;
- MetaDrive version/commit are accurate;
- unsupported evidence is explicit;
- repeated seed behavior is documented with declared tolerance;
- `third_party/metadrive` remains clean;
- no generated artifact is staged.

Then create:

```text
feat: add MetaDrive headless adapter
```

## 12. Phase 3 — Deterministic safety shield and challenge scenarios

### 12.1 Objective

Demonstrate that Hermes can distinguish:

- what a baseline policy proposed;
- what a deterministic runtime shield permitted;
- what the simulator executed;
- whether the intervention improved safety evidence;
- what residual regressions remain.

### 12.2 Safety shield

Implement configurable rules for supported evidence:

- TTC below threshold;
- speed above configured cap;
- stale or missing observation;
- road-boundary risk;
- emergency stop;
- optional actuation-delay compensation.

Each override must produce a stable reason code:

```text
TTC_BELOW_THRESHOLD
SPEED_CAP
STALE_OBSERVATION
BOUNDARY_RISK
EMERGENCY_STOP
ACTUATION_DELAY_COMPENSATION
```

Requirements:

- candidate and executed actions preserved;
- every override and non-override path tested;
- thresholds stored in versioned configuration;
- shield intervention count and reason distribution included in metrics;
- no claim that the shield is sufficient for real-world safety.

### 12.3 Challenge scenarios

Implement only simulator-supported deterministic scenarios:

1. `lead_vehicle_hard_brake`
2. `cut_in_near_field`

Optional after those pass:

3. `blocked_lane`
4. `actuation_latency_fault`

For each scenario, define:

- hazard under test;
- scenario parameters;
- expected baseline weakness;
- expected shield behavior;
- hard and soft verifier expectations;
- reproducibility envelope;
- known simulator limitation.

### 12.4 Comparison command

Add a machine-readable comparison surface, for example:

```bash
hermes compare artifacts/<baseline> artifacts/<candidate>
```

Compare:

- verdict;
- collision;
- minimum TTC when available;
- progress;
- comfort;
- policy latency source;
- shield overrides;
- evidence availability;
- adapter and scenario compatibility.

Do not compare incompatible scenarios or gate configurations without a clear warning.

### 12.5 Phase 3 acceptance gate

- baseline and shielded runs both produce complete evidence;
- challenge scenario is deterministic enough for the declared use;
- candidate and executed action difference is visible;
- override reason is preserved;
- hard invariant precedence remains intact;
- the shield cannot change stored verifier results after the run;
- comparison reports improvements and regressions;
- all tests and lint pass;
- no unsupported safety claim is made.

Then create:

```text
feat: add safety shield and challenge scenarios
```

## 13. Phase 4 — Fault injection and hardening

Only begin after Phase 3 is green.

Implement simulator-neutral wrappers for:

- observation delay;
- observation dropout;
- frozen observation;
- bounded observation noise;
- control delay;
- steering saturation;
- brake saturation.

Requirements:

- fault configuration captured in resolved scenario and manifest;
- candidate time and execution time distinguished;
- latency source labeled simulated or measured;
- deterministic tests;
- fault findings and gate consequences documented.

## 14. Phase 5 — CI and developer experience

Add GitHub Actions only as repository files; do not push or enable external settings.

PR-safe CI should run without MetaDrive assets:

```bash
python -m pip install -e ".[dev]"
python -m ruff check .
python -m pytest -q -m "not metadrive"
```

Add:

- test markers;
- `make check`;
- `make demo-phase1`;
- `make sim-smoke`;
- structured CLI error messages;
- deterministic fixtures;
- artifact schema version tests.

Keep real MetaDrive integration explicit and local/manual unless a reliable runner is available.

## 15. Deferred roadmap

### Dashboard

A Streamlit dashboard may later show scenario selection, verdicts, timelines, replay, trace integrity, and policy comparison. It must consume stored artifacts rather than become the source of truth.

### Learned policy

A small PPO extension may demonstrate reward versus invariant mismatch only after deterministic gates are trustworthy.

### CARLA and ScenarioRunner

Add a higher-fidelity adapter for cameras, LiDAR, weather, pedestrians, and standards-oriented scenarios.

### ROS 2 and Autoware

Map Hermes contracts to localization, perception, planning, control, and diagnostics messages.

### Hardware-aware validation

Progress to processor-in-the-loop and closed-lab hardware only with explicit sensor-to-action latency, clock synchronization, compute, memory, power, thermal, and actuator-response budgets.

### External trust anchor

Add signatures or an independent append-only store when evidence authenticity, not merely local tamper indication, is required.

## 16. Test strategy

### Test pyramid

| Layer | Purpose | Simulator required? |
|---|---|---:|
| Unit | Models, schemas, hashing, gate, policy, shield | No |
| Contract | Adapter and verifier interfaces | No |
| Integration | Fake run and artifact verification | No |
| Simulator integration | Bounded MetaDrive smoke and nominal run | Yes |
| End-to-end demo | Scenario → evidence → independent verification | Depends |

### Required categories

- positive path;
- negative path;
- malformed input;
- boundary values;
- deterministic repeat;
- exception cleanup;
- evidence unavailability;
- hard-invariant precedence;
- tamper detection;
- CLI exit codes;
- provenance correctness;
- backward-compatible evidence schema handling or explicit rejection.

## 17. Artifact and schema versioning

Use explicit versions for:

- evidence schema;
- scenario schema;
- gate config;
- adapter;
- policy;
- shield;
- verifier;
- Hermes package.

Verification must reject unsupported schema versions with an actionable error. Never silently reinterpret a newer format.

## 18. Security and abuse-resistance review

Threats to consider:

- artifact path traversal;
- overwriting evidence;
- malformed JSON/YAML resource exhaustion;
- NaN/Infinity canonicalization ambiguity;
- duplicate or reordered events;
- recomputed hashes after tampering;
- falsified provenance;
- missing verifier evidence;
- policy/shield version ambiguity;
- aggregate score masking hard failure;
- stale scenario/gate digest;
- simulator crash presented as normal completion.

Mitigations should be tested and documented. Do not overstate local hashing as protection against a malicious bundle author.

## 19. PM learning agenda

Hermes should leave explicit artifacts demonstrating product-leadership skills.

| Capability | Evidence produced by project |
|---|---|
| ODD definition | Scenario/ODD boundaries and exclusions |
| Requirements | Traceability matrix from hazard to gate |
| Architecture | Simulator-neutral contracts and adapter boundary |
| Safety reasoning | Hard invariant precedence and residual limitations |
| Verifier integrity | Tamper, unavailable-evidence, and false-pass tests |
| Developer infrastructure | Reproducible CLI, tests, artifacts, provenance |
| Hardware awareness | Roadmap for latency, compute, power, thermal, sensors |
| XFN leadership | Decision log and release ownership model |
| Launch discipline | PASS/CONDITIONAL/HOLD/INVALID semantics |
| Incident readiness | Supporting event sequences and replayable evidence |

## 20. Executive demo sequence

### Demo 1 — Evidence integrity

- run nominal fake scenario;
- show `PASS`;
- independently verify artifact;
- show trace digest.

### Demo 2 — Hard invariant

- run collision scenario;
- show `HOLD`;
- identify first collision event;
- explain why progress cannot compensate.

### Demo 3 — Tamper detection

- modify one event in a copied artifact;
- show `INVALID_EVIDENCE`;
- identify first hash mismatch.

### Demo 4 — Real simulator integration

- run bounded MetaDrive nominal scenario;
- show same evidence schema and verifiers;
- verify artifact without simulator rerun.

### Demo 5 — Runtime intervention

- compare baseline and shielded challenge run;
- show candidate action, executed action, reason code, improved safety evidence, and any comfort/mission regression.

### Executive close

> Hermes does not declare a system safe because a simulated vehicle completed a route. It turns a policy change into a reproducible scenario, records what was proposed and executed, evaluates independent requirements, issues an explicit advancement decision, and preserves the trace for review.

## 21. Risks and mitigations

| Risk | Mitigation |
|---|---|
| Codex builds visuals before evidence | Phase gates prohibit dashboard before core |
| MetaDrive API drift | Inspect installed 0.4.3 source before coding |
| Fake simulator is mistaken for fidelity | Document it as an architectural test double |
| Hash chain creates false assurance | State tamper-evident/authenticity limitation |
| Nondeterministic timing breaks trace | Use simulated latency; separate host diagnostics |
| Collision is averaged away | Hard-invariant precedence |
| Missing signal becomes zero | Explicit `NOT_AVAILABLE` |
| User-supplied path escapes artifacts | Strict slug and path containment validation |
| Simulator crash looks like HOLD/PASS | Operational error, incomplete artifact invalid |
| Codex stalls on optional blocker | Continue independent work, record blocker |
| Third-party simulator is modified | Enforce clean external checkout |
| Generated evidence enters Git | Ignore artifacts and review staged diff |
| Scope expands to real hardware | Non-negotiable simulation-only boundary |

## 22. Required unattended handoff

At completion, `CODEX_HANDOFF.md` must contain:

1. Executive summary.
2. Starting and ending branch/commit.
3. Phases attempted, completed, and deferred.
4. Architecture and major decisions.
5. Files changed.
6. Dependencies added.
7. Commands executed and actual outputs summarized.
8. Test and Ruff results.
9. Doctor result.
10. Demo run IDs, artifact paths, verdicts, and trace digests.
11. Tamper and determinism results.
12. MetaDrive result when attempted.
13. Known failures and limitations.
14. Git status and local commits.
15. The single best next command for the user.

## 23. Definition of success for this unattended run

The run is successful when Phase 1 is fully complete and reviewable. Phase 2 and Phase 3 are valuable only if their predecessor gates are green.

A partial run is still useful when:

- all completed work is tested;
- incomplete work is isolated and clearly labeled;
- no false pass is claimed;
- the handoff makes the next step unambiguous.

## Recommendation

Build the deterministic evidence core first, then attach MetaDrive through the same adapter contract, then demonstrate a runtime shield on a reproducible challenge scenario. This sequence maximizes learning and credibility while keeping the project reversible and auditable.

## Top risks and mitigations

The highest risks are false confidence from simulation, weak verifier integrity, nondeterministic evidence, and premature scope expansion. Control them through narrow ODD boundaries, independent verification, hard-invariant precedence, explicit evidence availability, gated phases, and truthful limitations.

## Next three actions

1. Apply the updated instruction pack and create `feat/unattended-evidence-core`.
2. Open a Codex Local chat in the Hermes repository with repository-scoped permissions and paste `MASTER_PROMPT.md`.
3. On return, inspect `CODEX_HANDOFF.md`, run the validation matrix, and review local commits before any push.
