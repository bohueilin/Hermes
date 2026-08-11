# Hermes

Hermes is a simulation-only autonomous-driving scenario and safety-evidence lab.

> **Autonomy policy proposes → environment executes → verifiers evaluate → gate decides → trace proves.**

Hermes is designed to make an autonomy experiment reproducible and reviewable: it preserves the scenario, versions, candidate action, executed action, findings, metrics, release verdict, and evidence-integrity checks in one bundle.

## Safety boundary

Hermes is for simulation and closed-lab learning only. It must not connect to a physical road vehicle, public-road actuator, remote-control channel, CAN bus, or production safety-critical system. Prototype thresholds are illustrative and are not certification or real-world safety evidence.

## Current status

Phase 0 remains intact, and the Phase 1 deterministic evidence core is implemented on the
feature branch. Phase 1 adds strict scenario and gate schemas, a deterministic fake adapter,
baseline policy, no-op shield, canonical trace chaining, independent verifiers, non-compensatory
gate precedence, atomic evidence publication, and stored-only artifact verification.

The fake adapter is an architectural test double, not a vehicle-physics model. MetaDrive is not
imported or launched by Phase 1 runs or artifact verification.

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

Hermes remaps command-line usage and type-validation failures to configuration exit `40`; malformed
commands never print `PASS`. The `doctor` command preserves its Phase 0 contract: `0` when no check
is `FAIL`, otherwise `1`.

A valid `HOLD` or `CONDITIONAL` bundle remains internally consistent and independently
verifiable; its verification command returns the policy verdict exit code. Corruption instead
returns `INVALID_EVIDENCE` / `30`.

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
checks episode-horizon completeness, observation-summary consistency, and the fake policy's
explicitly simulated latency source.

## Development workflow

```bash
python -m pytest -q
python -m ruff check .
python -m hermes doctor
git diff --check
```

Read before editing:

- `AGENTS.md` — durable repository rules;
- `PROJECT_BRIEF.md` — product scope and success criteria;
- `BUILD_PLAN.md` — gated implementation roadmap;
- `MASTER_PROMPT.md` — unattended Codex execution brief;
- `VALIDATION_MATRIX.md` — human acceptance checklist.

## Roadmap

1. Deterministic fake-simulator evidence core (implemented in Phase 1).
2. Bounded MetaDrive headless adapter (strictly gated on Phase 1 acceptance).
3. Deterministic runtime shield and challenge scenarios.
4. Fault injection, comparison, CI, and demo hardening.
5. Later: dashboard, CARLA, ROS 2/Autoware, RL experiments, and hardware-aware validation.

Later phases may begin only after their predecessor gates pass.

## Integrity limitation

Hermes uses canonical serialization and local SHA-256 chaining to make modification detectable. This is tamper-evident, not independently authenticated; a party able to rewrite the entire bundle can recompute hashes. External signing or an independent trust anchor is deferred.
