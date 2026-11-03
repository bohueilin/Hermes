# Phase 4 deterministic faults and Phase 5 developer hardening

## Scope and safety boundary

This hardening remains simulation-only. Fault values and all gate thresholds are illustrative; they
are not vehicle limits, road-safety evidence, certification evidence, or deployment permission.
No dashboard, RL system, real-log training pipeline, hardware integration, or real-vehicle control
surface is included.

## Runtime ordering

Hermes applies the configured components in one explicit order:

```text
adapter raw observation
  -> deterministic observation faults
  -> policy candidate action
  -> deterministic shield permitted action
  -> deterministic control delay
  -> steering/brake saturation
  -> adapter executed action
  -> adapter result observation
```

Evidence schema `2.0` keeps all three actions distinct: `candidate_action`, `permitted_action`, and
`executed_action`. It also preserves the raw, delivered, and result observations, source sequence
and time, candidate and execution time, simulated control latency, pre-saturation action, and exact
ordered reason codes. Legacy artifacts retain evidence schema `1.0` and their deterministic bytes.

Scenario schema `3.0` binds one strict fault profile into the resolved scenario. The same profile is
also bound into the execution context and manifest by name, version, configuration, and SHA-256
digest. Comparisons fail closed when fault profiles differ.

## Supported deterministic faults

| Fault | Evidence reason | Semantics |
|---|---|---|
| Observation delay | `OBSERVATION_DELAY_WARMUP`, `OBSERVATION_DELAY` | Deliver a prior source packet; warmup reuses sequence 0 |
| Frozen observation | `OBSERVATION_FROZEN` | Hold one source packet for every configured interval step |
| Dropped observation | `OBSERVATION_DROPOUT_HOLD_LAST` | Hold the last delivered source packet on each configured step |
| Bounded observation noise | `OBSERVATION_NOISE` | SHA-256 counter noise bounded per declared field and seed |
| Control delay | `CONTROL_DELAY_FILL`, `CONTROL_DELAY` | Use neutral startup fill, then a prior permitted command |
| Steering saturation | `STEERING_SATURATION` | Clamp the delayed command to configured absolute steering |
| Brake saturation | `BRAKE_SATURATION` | Clamp the delayed command to configured maximum brake |

Noise is bound to the source packet rather than the delivery time. A delayed, frozen, or held-last
packet therefore retains the same sensed speed/lateral values while delivery sequence, delivery
time, and observation age continue to advance truthfully.

The demonstration profile is `scenarios/fake_fault_injection.yaml`. Every configured mechanism and
every scheduled freeze/dropout step must be observed. Early termination before a scheduled step
produces `fault.coverage.required = NOT_AVAILABLE`, which is a required finding and forces `HOLD`.
An absent saturation event also fails coverage rather than fabricating an intervention.

## Stored-only verification

Artifact verification does not import or launch a simulator. For schema-2 fault evidence it:

- validates the complete event chain and typed raw/delivered/result observations;
- binds raw and result sequence, time, freshness, state, challenge actor fields, and phase schedule;
- reconstructs the strict fault profile and replays every observation and action transform exactly;
- replays the deterministic shield from the delivered observation and stored candidate;
- recomputes metrics, the seven-finding verifier suite, and the non-compensatory release gate; and
- rejects mixed schemas, missing versions, unsupported versions, changed schedules, or coherent
  rewrites that contradict the deterministic transforms.

Policy proposals remain trace inputs: stored verification does not re-execute the policy or
simulator. A party able to rewrite the entire bundle can choose new candidate inputs and recompute
local hashes. Hermes therefore reports `NOT_AUTHENTICATED`; the hash chain is tamper-evident, not an
independent trust anchor. External signing and independent policy/dynamics replay are deferred.

The installed MetaDrive IDM policy reads native simulator state rather than the Hermes observation
object. Hermes therefore rejects schema-3 MetaDrive profiles containing observation delay,
freeze/dropout, or observation noise before adapter construction. Control delay and saturation are
the only truthful fault classes for that policy profile. Schema-3 MetaDrive challenge evidence still
receives the same actor-pairing, initial-gap, phase-schedule, and continuity checks as Phase 3.

## Metrics and gate behavior

Schema-2 metrics add:

- reason counts for every applied fault;
- maximum observation age;
- p95 simulated control latency;
- startup-fill count; and
- steering/brake saturation counts.

Shield intervention metrics compare candidate to permitted action, never candidate to faulted
executed action. Control faults cannot inflate the shield intervention count.

The Phase 1 hard-invariant precedence remains unchanged. Fault coverage is an additional required
finding. Collision/boundary failures, missing progress, and missing fault coverage cannot be
compensated by another metric.

## Developer and CI contract

Local gates:

```bash
make check
make demo-phase1 DEMO_RUN_ID=<unique-lowercase-id>
make sim-smoke
```

`make check` runs Ruff, the complete pytest suite, and doctor. `demo-phase1` refuses overwrite,
runs the deterministic nominal fake scenario, and independently verifies the published artifact.
`sim-smoke` is a local/manual MetaDrive reset/IDM/step/close probe, not a policy verdict.

`.github/workflows/ci.yml` is repository configuration only. It installs `.[dev]`, runs Ruff, and
runs `pytest -m "not metadrive"` on Python 3.11. Real MetaDrive/assets are intentionally excluded
from PR-safe CI; injected adapter-contract tests still run.

The CLI exposes stable error categories and exits:

| Error | Exit |
|---|---:|
| `USAGE_ERROR` | 40 |
| `CONFIGURATION_ERROR` | 40 |
| `OPERATIONAL_ERROR` | 40 |
| `INVALID_EVIDENCE` | 30 |
| `INCOMPATIBLE_EVIDENCE` | 40 |

Human output includes the stable code, message, and exit code. JSON comparison failures include
`error`, `message`, `exit_code`, and optional structured `details`.
