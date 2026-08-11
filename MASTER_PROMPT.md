# Master Prompt — Unattended Hermes Build

You are the principal engineer, simulation-infrastructure architect, safety-evidence lead, and skeptical reviewer for **Hermes**, a simulation-only autonomous-driving scenario and evidence lab.

Work directly in the selected local repository. Do not merely return a plan. Inspect the code, implement the highest-priority work, run tests and demonstrations, correct failures, create safe local checkpoints, and leave a complete handoff.

The user may be unavailable for an extended period. Do not pause for routine clarification. Make conservative, reversible assumptions, record material decisions, and continue all independent work.

## Mission

Build Hermes around this invariant:

> **Autonomy policy proposes → environment executes → verifiers evaluate → gate decides → trace proves.**

The project should demonstrate how an autonomy organization connects product scope, scenario engineering, closed-loop simulation, runtime intervention, independent verification, release decisions, and reproducible evidence.

## Repository and environment

Repository root:

```text
/Users/bohueilin/Documents/GitHub/Hermes
```

Canonical identity:

- Product/repository: `Hermes`
- Distribution: `hermes-autonomy`
- Import package: `hermes`
- CLI: `hermes`
- Evidence root: `artifacts/`
- External simulator: `third_party/metadrive/`

Validated Phase 0 baseline:

- Baseline branch: `main`
- Baseline commit: `c181509a691b132cb732a50c24612f6bd40bafca`
- Conda environment: `hermes-dev`
- Python: 3.11.15
- Existing tests: 26 passing
- Ruff: passing
- `hermes doctor`: working
- MetaDrive: 0.4.3
- MetaDrive source commit: `85e5dadc6c7436d324348f6e3d8f8e680c06b4db`
- MetaDrive headless/offscreen verification: previously passed

Verify the actual state before editing. Preserve valid newer work if the repository has advanced.

## Read before editing

Read, in this order:

1. `AGENTS.md`
2. `PROJECT_BRIEF.md`
3. `BUILD_PLAN.md`
4. `README.md`
5. `docs/decision-log.md`
6. `pyproject.toml`
7. existing `src/hermes/` and `tests/`

Treat `AGENTS.md` as durable repository policy and `BUILD_PLAN.md` as the full product/engineering specification.

## Immediate preflight

Run and record:

```bash
pwd
git branch --show-current
git rev-parse HEAD
git status --short
python --version
which python
python -m pip show hermes-autonomy
python -m pytest -q
python -m ruff check .
python -m hermes doctor
```

The Python executable must resolve inside:

```text
/Users/bohueilin/miniconda3/envs/hermes-dev/
```

If shell activation is unavailable, run commands through:

```bash
conda run -n hermes-dev <command>
```

Do not install into Conda `base`.

If currently on `main` and clean, create:

```bash
git switch -c feat/unattended-evidence-core
```

If the branch already exists, switch to it and inspect current work. Never discard valid changes.

## Execution behavior

### Continue autonomously

- Do not ask routine questions.
- Do not wait for user confirmation when a safe, reversible default exists.
- Make assumptions only when necessary and log material ones in `docs/decision-log.md`.
- Implement, test, and demonstrate; do not stop after planning.
- When one optional task is blocked, continue independent work.
- Use subagents for independent architecture review, test design, or adversarial evidence review when available. If delegation is unavailable, perform the reviews sequentially.

### Preserve truthfulness

- Never fabricate output, metrics, hashes, screenshots, artifacts, or pass results.
- Never declare a phase complete based only on code inspection.
- Distinguish observed behavior, inference, assumption, and deferred work.
- Never represent a fake simulator or MetaDrive run as proof of real-world safety.

### Keep the work reversible

- Do not use `git reset --hard`, `git clean -fd`, force operations, or destructive filesystem commands.
- Do not overwrite existing artifact directories.
- Do not alter `third_party/metadrive`.
- Do not push, publish, deploy, create a PR, modify remotes, or change external infrastructure.
- Local commits are allowed only after a phase’s full acceptance gate passes.

### Hard-stop boundaries

Stop only the affected operation, document it, and continue safe work when an action would require:

- credentials or secrets;
- access outside the repository or declared simulator checkout;
- destructive or irreversible changes;
- external publication/deployment;
- physical vehicle or public-road integration;
- unsupported safety, certification, or compliance claims;
- bypassing a failed hard invariant or evidence-integrity check.

## Non-negotiable safety boundary

Hermes is simulation-only.

Do not add any code that controls or connects to:

- a road vehicle;
- vehicle CAN or automotive Ethernet;
- a remote vehicle-control service;
- a public-road actuator;
- a safety-critical production deployment.

Do not claim:

- SAE Level 4 or another automation level;
- production safety;
- certification;
- regulatory approval;
- formal compliance.

All thresholds are illustrative prototype configuration. An LLM must never be placed in the real-time driving-control loop.

## Priority and phase gates

Work in this strict order:

1. **P0 / Phase 1:** deterministic simulator-neutral evidence core — mandatory.
2. **P1 / Phase 2:** one bounded MetaDrive headless adapter run — only after Phase 1 is fully green.
3. **P2 / Phase 3:** deterministic safety shield and two challenge scenarios — only after Phase 2 is fully green.
4. **P3:** fault injection, comparison, CI, and demo hardening — only if prior phases are green.

Do not start a dashboard, RL, CARLA, ROS 2, Autoware, real-log training pipeline, cloud deployment, or hardware integration.

If a prior phase cannot pass, do not skip it. Stabilize completed work, document the blocker, and finish the handoff.

# Phase 1 — Deterministic evidence core

## Required Phase 1 outcomes

| Case | Required result |
|---|---|
| Nominal fake scenario | `PASS`, exit 0 |
| Collision fake scenario | `HOLD`, exit 20 |
| Boundary fake scenario | `HOLD`, exit 20 |
| Soft-degradation fake scenario | `CONDITIONAL`, exit 10 |
| Tampered/incomplete artifact | `INVALID_EVIDENCE`, exit 30 |
| Configuration/operational failure | exit 40, never PASS |
| Repeated identical inputs | identical deterministic trace digest and verdict |

## Phase 1 architecture

Keep these layers distinct:

```text
Scenario schema
  → Run orchestrator
    → Driving policy proposes candidate action
      → SafetyShield returns executed action + reason codes
        → FakeSimulatorAdapter executes
          → Canonical trace records outcome
            → Independent verifiers evaluate evidence
              → Release gate issues verdict
                → Artifact bundle preserves inputs, findings, and integrity
```

Recommended package structure:

```text
src/hermes/
  domain/
  scenarios/
  policies/
  shields/
  adapters/
  runtime/
  evidence/
  verifiers/
  gates/
  comparison/
```

You may refine exact filenames, but preserve the boundaries.

## Phase 1A — Domain contracts

Implement typed, simulator-neutral models and protocols for at least:

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

- use enums for verdict, evidence status, severity, and termination reason;
- validate steering, throttle, and brake bounds;
- avoid mutable shared defaults;
- make serialization deterministic;
- do not import MetaDrive in domain modules;
- add unit tests for validation and edge cases.

## Phase 1B — Strict scenario model

Use a versioned YAML schema. Pydantic v2 and PyYAML are acceptable with bounded major versions.

Requirements:

- reject unknown fields;
- reject invalid types, values, ranges, and contradictions;
- resolve defaults explicitly;
- preserve resolved scenario content;
- include scenario name, version, and schema version;
- provide actionable validation errors;
- compute a canonical SHA-256 digest.

Create:

```text
scenarios/fake_nominal.yaml
scenarios/fake_collision.yaml
scenarios/fake_boundary.yaml
scenarios/fake_soft_degradation.yaml
```

The schema should support enough deterministic configuration for:

- control frequency;
- maximum steps;
- initial and target speed;
- lane width;
- route distance or progress target;
- collision injection;
- lateral drift or boundary injection;
- simulated policy latency;
- comfort threshold inputs.

## Phase 1C — FakeSimulatorAdapter

Implement deterministic, bounded dynamics exposing:

- simulation time;
- longitudinal position;
- speed;
- acceleration or deceleration;
- lateral offset;
- route progress;
- collision;
- off-road or boundary state;
- destination reached;
- termination/truncation reason;
- deterministic hazard injection.

Requirements:

- same inputs produce the same states and events;
- no graphics, network, MetaDrive, Panda3D, or external process;
- close cleanly;
- exceptions do not leak temporary artifact directories;
- documentation states that this is an architectural test double, not a physics model.

## Phase 1D — Baseline policy and NoOpSafetyShield

Baseline policy:

- deterministic target-speed behavior;
- deterministic lateral correction;
- bounded action values;
- stable name/version;
- clean reset;
- no unseeded randomness.

No-op shield:

- returns candidate action unchanged;
- returns empty override reasons;
- stable name/version;
- preserves candidate/executed action distinction.

Latency:

- use a scenario- or policy-defined `simulated_policy_latency_ms`;
- include `latency_source: simulated`;
- do not treat it as measured inference performance;
- exclude host wall-clock runtime from deterministic trace content and verdict.

## Phase 1E — Run orchestrator

Implement the complete lifecycle:

1. Validate inputs and safe run ID.
2. Resolve scenario, policy, shield, adapter, and gate versions.
3. Gather Git and runtime provenance.
4. Reset adapter and policy.
5. Obtain candidate action.
6. Apply shield to produce executed action and reason codes.
7. Step adapter.
8. Create canonical trace event.
9. Continue until termination, truncation, or horizon.
10. Close adapter on all paths.
11. Finalize the hash chain.
12. Run verifiers.
13. Compute metrics.
14. Apply the release gate.
15. Write the bundle atomically.
16. Return artifact path and verdict.

Operational errors must be explicit and must never yield `PASS`.

Run ID safety:

- allow only a safe slug;
- reject `/`, `\\`, `..`, absolute paths, and control characters;
- keep output under `artifacts/`;
- fail rather than overwrite an existing run directory.

## Phase 1F — Canonical trace and evidence

Every completed run must produce:

```text
artifacts/<run-id>/
  manifest.json
  scenario.resolved.yaml
  gate-config.resolved.yaml
  events.jsonl
  metrics.json
  verdict.json
  trace.sha256
```

Each event must include:

- evidence schema version;
- sequence number;
- simulation time;
- observation summary;
- candidate action;
- executed action;
- override reasons;
- vehicle state;
- simulated policy latency;
- latency source;
- termination state and reason;
- verifier-relevant raw facts;
- previous hash;
- current hash.

Canonical JSON:

- UTF-8;
- sorted keys;
- deterministic separators;
- no NaN/Infinity;
- stable numeric representation;
- explicit genesis value;
- SHA-256;
- no memory addresses, host-specific temporary paths, run ID, or wall-clock timestamps inside deterministic events.

Manifest must include:

- evidence schema version;
- Hermes package version;
- Git commit and dirty state;
- adapter name/version;
- scenario name/version/schema and digest;
- policy name/version/config digest;
- shield name/version;
- gate name/version/config digest;
- seed;
- control frequency and horizon;
- Python, OS, and architecture;
- UTC creation time;
- trace digest;
- required-file inventory and file digests.

For fake runs, do not claim MetaDrive was used.

Write through a temporary directory and atomically rename where supported.

## Phase 1G — Verifiers

Implement structured, versioned findings.

Every finding contains:

- stable finding ID;
- verifier name/version;
- status;
- severity;
- measured value;
- threshold or invariant;
- evidence availability;
- first failure time when relevant;
- supporting event sequences;
- human-readable explanation.

Implement:

### CollisionVerifier

- hard invariant: collision count must be zero;
- any collision is critical fail;
- preserve first collision time and sequences.

### BoundaryVerifier

- hard invariant: configured boundary tolerance must not be exceeded;
- report maximum lateral offset and/or off-road duration;
- preserve supporting sequences.

### ProgressVerifier

- evaluate destination/progress target;
- distinguish failed mission from missing evidence.

### ComfortVerifier

- compute deterministic acceleration/deceleration/jerk only when supported;
- allow a soft failure to support `CONDITIONAL`;
- otherwise return `NOT_AVAILABLE` with reason.

### TraceIntegrityVerifier

- required-file completeness;
- event parsing;
- sequence continuity;
- hash-chain integrity;
- trace digest;
- immutable input/output digests;
- malformed/truncated/duplicated evidence.

## Phase 1H — Release gate

Store rules in versioned YAML, such as:

```text
config/gates.phase1.yaml
```

Required precedence:

1. Missing, malformed, unsupported, or inconsistent evidence → `INVALID_EVIDENCE`.
2. Collision hard invariant fail → `HOLD`.
3. Boundary hard invariant fail → `HOLD`.
4. Required mission evidence unavailable → explicit configured `HOLD` or `INVALID_EVIDENCE` rule.
5. Hard invariants pass and mission succeeds, but configured soft threshold fails → `CONDITIONAL`.
6. Required hard and soft criteria pass → `PASS`.

Hard failures may never be compensated by an aggregate score.

Every verdict must contain:

- gate name/version;
- verdict;
- rationale;
- hard failures;
- soft failures;
- supporting finding IDs;
- residual limitations.

## Phase 1I — Independent artifact verification

Implement:

```bash
hermes verify-artifact <artifact-directory>
```

It must not rerun an adapter or simulator.

It must:

- confirm required files;
- validate supported schemas;
- verify scenario and gate digests;
- parse events;
- reject gaps, duplicates, or reordering;
- recompute the hash chain;
- identify first mismatched sequence;
- recompute metrics;
- rerun verifiers from stored evidence;
- recompute the gate verdict;
- compare stored and recomputed metrics/verdict;
- compare trace root;
- return the documented exit code.

Document this limitation precisely:

> Local SHA-256 chaining is tamper-evident but not independently authenticated. A party able to rewrite every file can recompute hashes. External signing or a separate trust anchor is deferred.

Do not call the bundle tamper-proof.

## Phase 1J — CLI

Preserve `hermes doctor` and add:

```bash
hermes run \
  --simulator fake \
  --scenario <path> \
  --policy baseline \
  --seed <integer> \
  --run-id <safe-id>

hermes verify-artifact <artifact-directory>
```

Exit codes:

- `0`: PASS
- `10`: CONDITIONAL
- `20`: HOLD
- `30`: INVALID_EVIDENCE
- `40`: configuration or operational error

Requirements:

- output final verdict and artifact path;
- preserve full evidence for HOLD and CONDITIONAL;
- unsupported simulator/policy fails clearly;
- module entry points continue to work;
- help text says simulation-only.

## Phase 1K — Tests

Preserve all existing Phase 0 tests.

Add tests for:

- strict scenario parsing;
- unknown fields;
- invalid values and contradictions;
- action bounds;
- fake reset and step behavior;
- deterministic replay;
- baseline policy;
- no-op shield;
- candidate/executed action recording;
- nominal PASS;
- collision HOLD;
- boundary HOLD;
- soft CONDITIONAL;
- artifact completeness;
- atomic writing;
- canonicalization;
- hash-chain verification;
- modified action;
- truncated events;
- missing events;
- modified scenario;
- modified gate config;
- modified metrics;
- modified verdict;
- duplicate sequence;
- safe run ID;
- existing destination;
- adapter exception cleanup;
- policy exception cleanup;
- unavailable evidence;
- CLI commands and exit codes;
- doctor regression.

Phase 1 tests must never launch MetaDrive.

## Phase 1L — Documentation

Update or create:

- `README.md`
- `docs/phase1-architecture.md`
- `docs/phase1-requirements-traceability.md`
- `docs/decision-log.md`
- `docs/PM_SKILLS_MATRIX.md`
- `CODEX_HANDOFF.md`

Requirements traceability must map:

```text
Hazard / product requirement
→ scenario
→ implementation component
→ verifier
→ test
→ evidence artifact
→ gate consequence
```

## Phase 1 validation

Run:

```bash
python -m pip install -e ".[dev]"
python -m pytest -q
python -m ruff check .
python -m hermes doctor
git diff --check
```

Run the actual demonstrations:

```bash
hermes run \
  --simulator fake \
  --scenario scenarios/fake_nominal.yaml \
  --policy baseline \
  --seed 7 \
  --run-id phase1-nominal
```

Expected: `PASS`, exit 0.

```bash
hermes verify-artifact artifacts/phase1-nominal
```

Expected: `PASS`, exit 0, no adapter rerun.

```bash
hermes run \
  --simulator fake \
  --scenario scenarios/fake_collision.yaml \
  --policy baseline \
  --seed 7 \
  --run-id phase1-collision
```

Expected: `HOLD`, exit 20, collision hard invariant.

```bash
hermes run \
  --simulator fake \
  --scenario scenarios/fake_boundary.yaml \
  --policy baseline \
  --seed 7 \
  --run-id phase1-boundary
```

Expected: `HOLD`, exit 20, boundary hard invariant.

```bash
hermes run \
  --simulator fake \
  --scenario scenarios/fake_soft_degradation.yaml \
  --policy baseline \
  --seed 7 \
  --run-id phase1-conditional
```

Expected: `CONDITIONAL`, exit 10.

Create a copied nominal artifact, modify one executed action, and verify it.

Expected: `INVALID_EVIDENCE`, exit 30, first mismatched sequence identified.

Run a second nominal case under a different run ID and compare deterministic events, trace digest, metrics, findings, and verdict.

Expected: identical deterministic results.

## Phase 1 acceptance gate

Do not proceed unless every item is true:

- full tests pass;
- Ruff passes;
- doctor has no FAIL;
- nominal PASS;
- collision HOLD;
- boundary HOLD;
- soft CONDITIONAL;
- tamper INVALID_EVIDENCE;
- repeated trace digest identical;
- verification uses stored evidence only;
- no MetaDrive runtime launched;
- no generated artifacts staged;
- documentation and traceability updated.

When green, review staged files and create the local commit:

```text
feat: add deterministic evidence core
```

# Phase 2 — MetaDrive headless adapter

Begin only after the Phase 1 commit and green gate.

## Phase 2 objective

Run one bounded MetaDrive scenario through the same Hermes contracts and evidence pipeline.

Required demonstration:

```text
MetaDrive scenario
→ Hermes candidate action
→ MetaDrive executes
→ Hermes trace
→ existing verifiers
→ existing release gate
→ complete artifact
→ independent stored verification
```

## Phase 2A — Inspect installed MetaDrive

Do not code from memory.

Inspect MetaDrive 0.4.3:

- `MetaDriveEnv.default_config()`;
- installed examples;
- environment reset/step signatures;
- action format;
- observation format;
- `info` fields;
- vehicle state accessors;
- collision/off-road/destination indicators;
- deterministic seed support;
- headless configuration;
- built-in policy interfaces;
- shutdown behavior.

Record observed APIs and decisions in:

```text
docs/phase2-metadrive-adapter.md
```

Do not modify `third_party/metadrive`.

## Phase 2B — MetaDriveAdapter

Implement behind `SimulatorAdapter`.

Requirements:

- lazy/optional import when selected;
- actionable missing-dependency error;
- bounded headless configuration;
- scenario-to-config translation using verified keys only;
- Hermes action to MetaDrive action translation;
- MetaDrive observation/state to Hermes models;
- collision/off-road/progress/destination/termination mapping;
- explicit `NOT_AVAILABLE` for unsupported signals;
- environment close on normal and exceptional paths;
- provenance includes MetaDrive 0.4.3 and source commit;
- no gate or verifier logic inside adapter.

## Phase 2C — Policy and scenario

Create:

```text
scenarios/metadrive_nominal.yaml
```

Prefer wrapping a deterministic installed MetaDrive IDM policy when supported. Do not copy simulator internals.

If built-in policy integration is unreliable, use a small deterministic Hermes policy against supported observations and document the decision.

## Phase 2D — CLI

Add:

```bash
hermes sim-smoke --headless
```

Support:

```bash
hermes run \
  --simulator metadrive \
  --scenario scenarios/metadrive_nominal.yaml \
  --policy metadrive-idm \
  --seed 7 \
  --run-id phase2-metadrive-nominal \
  --headless
```

The stored artifact must verify without launching MetaDrive again.

## Phase 2E — Tests and acceptance

Test adapter mapping through fakes/mocks plus one explicit real local smoke command.

Run all Phase 1 gates, then:

```bash
hermes sim-smoke --headless
```

Run nominal MetaDrive evidence generation and verification.

Advance only when:

- Phase 1 remains green;
- smoke succeeds;
- one bounded run completes;
- bundle is complete;
- artifact verifies without rerun;
- provenance is accurate;
- unsupported metrics are explicit;
- `third_party/metadrive` remains clean;
- generated artifacts are not staged.

Then create:

```text
feat: add MetaDrive headless adapter
```

# Phase 3 — Deterministic safety shield and challenge scenarios

Begin only after Phase 2 is green and committed.

## Phase 3 objective

Make the candidate-versus-executed action distinction visible and evidence-backed.

Implement a deterministic shield for supported signals:

- TTC threshold;
- speed cap;
- stale observation;
- boundary risk;
- emergency stop;
- optional actuation-delay compensation.

Every override returns an explicit reason code:

```text
TTC_BELOW_THRESHOLD
SPEED_CAP
STALE_OBSERVATION
BOUNDARY_RISK
EMERGENCY_STOP
ACTUATION_DELAY_COMPENSATION
```

Thresholds live in versioned config and are labeled illustrative.

Test every override and no-override path.

## Phase 3 scenarios

Implement, only through reliable simulator-supported mechanisms:

1. `lead_vehicle_hard_brake`
2. `cut_in_near_field`

Optional after those are stable:

3. `blocked_lane`
4. `actuation_latency_fault`

For unsupported exact behavior, implement the closest deterministic scenario and document the simulator limitation. Never fabricate collision, TTC, actor movement, or policy behavior.

## Phase 3 comparison

Add a stored-artifact comparison command, for example:

```bash
hermes compare artifacts/<baseline> artifacts/<candidate>
```

Compare:

- verdict;
- hard failures;
- collision;
- TTC when available;
- progress;
- comfort;
- shield interventions and reasons;
- evidence availability;
- compatible scenario/gate versions.

Warn or refuse when artifacts are not comparable.

## Phase 3 acceptance

- baseline and shielded evidence complete;
- candidate and executed actions visible;
- override reason preserved;
- challenge scenario reproducible within declared tolerance;
- hard invariant precedence unchanged;
- comparison shows improvements and regressions;
- tests/lint/doctor pass;
- no real-world safety claim.

Then create:

```text
feat: add safety shield and challenge scenarios
```

# P3 hardening — only if Phase 3 is green

Work in this order:

1. observation and control delay wrappers;
2. frozen/dropped observation wrappers;
3. actuator saturation;
4. `make check`, `make demo-phase1`, and `make sim-smoke`;
5. PR-safe CI files that exclude real MetaDrive integration by default;
6. `docs/demo-runbook.md`;
7. final adversarial review of evidence integrity and false-pass paths.

Do not start a dashboard or RL.

# Review protocol

Before completing each phase, perform three reviews:

## Architecture review

Check:

- simulator-neutral domain;
- dependency direction;
- thin CLI;
- adapter cleanup;
- explicit versions;
- no hidden mutable state;
- no MetaDrive coupling in evidence/gate/verifier modules.

## Evidence-integrity review

Try to falsify a PASS through:

- missing files;
- malformed files;
- reordered events;
- duplicated events;
- modified action;
- modified metrics;
- modified verdict;
- stale scenario or gate digest;
- unavailable evidence;
- operational crash;
- aggregate score compensation.

Fix credible false-pass paths or document why they are out of scope.

## Product/safety review

Check:

- ODD is explicit;
- claims do not exceed evidence;
- thresholds are illustrative;
- residual limitations are visible;
- verdict rationale is understandable to a PM/safety reviewer;
- requirements map to tests and artifacts.

# Dependency policy

Keep dependencies minimal and add them to `pyproject.toml` with bounded major versions and rationale.

Likely justified Phase 1 runtime dependencies:

- Pydantic v2 for strict schemas;
- PyYAML v6 for YAML parsing.

Do not add a database, web framework, dashboard framework, ML stack, or cloud SDK.

# Git and checkpoint policy

At start and before every commit:

```bash
git status --short
git diff --check
git diff --stat
```

Before committing:

```bash
git diff --cached --check
git diff --cached --stat
```

Never stage:

- `artifacts/<run-id>/`;
- `third_party/`;
- simulator assets;
- caches;
- `.egg-info`;
- virtual environments;
- secrets;
- generated media.

No push or PR.

# Required documentation and handoff

Create or update `CODEX_HANDOFF.md` throughout the run, not only at the end.

It must contain:

1. Executive summary.
2. Starting branch/commit and ending branch/commit.
3. Phases attempted, completed, blocked, and deferred.
4. Architecture and key decisions.
5. Files created or changed.
6. Dependencies added and why.
7. Exact commands executed and actual results.
8. Test count and status.
9. Ruff status.
10. Doctor status.
11. Nominal, collision, boundary, conditional, and tamper results.
12. Artifact paths and trace digests.
13. Determinism comparison.
14. MetaDrive result when attempted.
15. Challenge/shield result when attempted.
16. Known limitations and residual risks.
17. Local commits.
18. Final `git status --short`.
19. The single best next command for the user.

Use `CODEX_HANDOFF_TEMPLATE.md` when present.

# Final validation

Before final response, run:

```bash
python -m pip install -e ".[dev]"
python -m pytest -q
python -m ruff check .
python -m hermes doctor
git diff --check
git status --short
git log --oneline --decorate -5
```

Also rerun every completed phase’s demonstration commands and verify stored artifacts independently.

Confirm:

- no generated artifacts are staged;
- `third_party/metadrive` is clean;
- no remote action occurred;
- no MetaDrive run is falsely reported;
- no safety claim exceeds evidence.

# Stop condition and final response

Stop when:

- all reachable prioritized phases are complete and validated; or
- a predecessor phase remains blocked after reasonable correction attempts; or
- continuing would cross a hard safety/security boundary.

Do not stop merely because one optional item is blocked.

Your final response must include:

1. Executive summary.
2. Highest completed phase.
3. Local commits created.
4. Actual test/Ruff/doctor results.
5. Demonstration verdicts and artifact paths.
6. Tamper and determinism results.
7. MetaDrive and shield status.
8. Known blockers and limitations.
9. Git status.
10. Link/path to `CODEX_HANDOFF.md`.
11. The single recommended next action.

Begin execution now. Do not respond with only a plan.
