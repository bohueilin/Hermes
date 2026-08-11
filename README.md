# Hermes

Hermes is a simulation-only autonomous-driving scenario and safety-evidence lab.

> **Autonomy policy proposes → environment executes → verifiers evaluate → gate decides → trace proves.**

Hermes is designed to make an autonomy experiment reproducible and reviewable: it preserves the scenario, versions, candidate action, executed action, findings, metrics, release verdict, and evidence-integrity checks in one bundle.

## Safety boundary

Hermes is for simulation and closed-lab learning only. It must not connect to a physical road vehicle, public-road actuator, remote-control channel, CAN bus, or production safety-critical system. Prototype thresholds are illustrative and are not certification or real-world safety evidence.

## Current status

Phase 0 remains intact, and the committed Phase 1 and Phase 2 foundations support the Phase 3
implementation on the feature branch. The same simulator-neutral evidence pipeline now supports a
deterministic fake adapter, a pinned MetaDrive 0.4.3 physics run with an installed IDM policy, and
trace-bound deterministic-shield decisions for two bounded MetaDrive challenge scenarios.

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

1. Deterministic fake-simulator evidence core (implemented and committed in Phase 1).
2. Bounded MetaDrive headless adapter (implemented in Phase 2).
3. Deterministic runtime shield, two bounded challenge scenarios, and stored evidence comparison
   (implemented on the feature branch; acceptance depends on the documented gates and observed
   artifacts).

Later phases may begin only after their predecessor gates pass.

## Integrity limitation

Hermes uses canonical serialization and local SHA-256 chaining to make modification detectable. This is tamper-evident, not independently authenticated; a party able to rewrite the entire bundle can recompute hashes. External signing or an independent trust anchor is deferred.
