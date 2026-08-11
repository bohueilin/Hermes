# Hermes

Hermes is a simulation-only autonomous-driving scenario and safety-evidence lab.

> **Autonomy policy proposes → environment executes → verifiers evaluate → gate decides → trace proves.**

Hermes is designed to make an autonomy experiment reproducible and reviewable: it preserves the scenario, versions, candidate action, executed action, findings, metrics, release verdict, and evidence-integrity checks in one bundle.

## Safety boundary

Hermes is for simulation and closed-lab learning only. It must not connect to a physical road vehicle, public-road actuator, remote-control channel, CAN bus, or production safety-critical system. Prototype thresholds are illustrative and are not certification or real-world safety evidence.

## Current status

Phase 0 is complete:

- Python 3.11 `hermes-dev` environment;
- installable `hermes-autonomy` package;
- `hermes` CLI;
- environment doctor;
- Git and simulator provenance checks;
- MetaDrive 0.4.3 installation and headless/offscreen prerequisite validation;
- 26 passing tests and clean Ruff baseline;
- baseline commit `c181509a691b132cb732a50c24612f6bd40bafca`.

The next mandatory milestone is the deterministic simulator-neutral evidence core.

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

## Current working command

```bash
hermes doctor
```

The optional display check may be `NOT_AVAILABLE` in a headless shell; the dedicated headless/offscreen prerequisite check is the relevant result.

## Target Phase 1 commands

After the evidence core is implemented:

```bash
hermes run \
  --simulator fake \
  --scenario scenarios/fake_nominal.yaml \
  --policy baseline \
  --seed 7 \
  --run-id phase1-nominal

hermes verify-artifact artifacts/phase1-nominal
```

Expected Phase 1 cases:

| Case | Verdict | Exit code |
|---|---|---:|
| Nominal | `PASS` | 0 |
| Soft degradation | `CONDITIONAL` | 10 |
| Collision or hard boundary violation | `HOLD` | 20 |
| Invalid/inconsistent evidence | `INVALID_EVIDENCE` | 30 |
| Configuration/operational failure | error | 40 |

## Evidence bundle

Every completed run must preserve:

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

Stored artifact verification must not rerun a simulator.

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

1. Deterministic fake-simulator evidence core.
2. Bounded MetaDrive headless adapter.
3. Deterministic runtime shield and challenge scenarios.
4. Fault injection, comparison, CI, and demo hardening.
5. Later: dashboard, CARLA, ROS 2/Autoware, RL experiments, and hardware-aware validation.

Later phases may begin only after their predecessor gates pass.

## Integrity limitation

Hermes uses canonical serialization and local SHA-256 chaining to make modification detectable. This is tamper-evident, not independently authenticated; a party able to rewrite the entire bundle can recompute hashes. External signing or an independent trust anchor is deferred.
