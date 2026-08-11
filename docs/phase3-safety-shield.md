# Phase 3 deterministic safety shield and challenge scenarios

## Scope and safety boundary

Phase 3 makes the policy-proposal and runtime-permission boundary explicit:

```text
installed IDM proposes candidate action
  -> deterministic shield selects executed action and reason codes
  -> MetaDrive executes the selected action
  -> trace records candidate, executed action, reasons, and observed consequences
  -> offline verifiers and the release gate evaluate stored evidence
```

This is a simulation-only prototype. The thresholds in `config/shield.phase3.yaml` are
illustrative and are not real-vehicle limits, road-safety evidence, certification criteria, or
deployment permission. The shield is not a complete safety system and does not replace the
independent verifiers or the release gate. Collision and hard boundary findings retain their
non-compensatory `HOLD` precedence.

## Deterministic shield

The shield is `deterministic` version `1.0`. Its strict, versioned configuration is bound into the
execution context and event-chain run context by a canonical configuration digest. Unknown fields,
duplicate YAML keys, non-finite values, and out-of-range thresholds are rejected.

The checked-in configuration is labeled
`illustrative_simulation_only_not_real_vehicle_limits` and defines:

| Rule | Trigger in the checked-in configuration | Stable reason code | Selected action |
|---|---|---|---|
| Front-object TTC | Paired front gap and closing relative speed produce TTC `<= 2.0 s` | `TTC_BELOW_THRESHOLD` | Full brake; retain candidate steering unless boundary risk also applies |
| Speed cap | Ego speed `> 5.5 m/s` | `SPEED_CAP` | Full brake; retain candidate steering unless boundary risk also applies |
| Observation age | Observation age `> 0.2 s` | `STALE_OBSERVATION` | Full brake; retain candidate steering unless boundary risk also applies |
| Boundary margin | Absolute lane offset `>= boundary_tolerance_m - 0.3 m` | `BOUNDARY_RISK` | Full brake and binary32 steering magnitude `0.5` toward lane center |
| Emergency stop | `emergency_stop_active: true` | `EMERGENCY_STOP` | Full brake; disabled in the checked-in configuration |
| Actuation-delay margin | TTC is above `2.0 s` and at most `2.25 s` | `ACTUATION_DELAY_COMPENSATION` | Full brake; the `0.25 s` value is a configured TTC margin, not a modeled delay fault |

The full-brake command is `1.0`. Trigger evaluation and reason serialization use the stable order
shown above. Multiple simultaneous triggers preserve every applicable reason rather than collapsing
them into a generic intervention.

A missing required observation is a schema or operational error; it is not treated as a stale
observation or a safe default. `STALE_OBSERVATION` applies only to a valid typed observation whose
recorded age exceeds the configured limit. Front-object TTC is unavailable when the required pair of
signals or a closing relationship is unavailable.

Every event preserves `candidate_action` and `executed_action`, including when they are equal.
`override_reasons` is non-empty exactly when the selected action differs from the candidate. If a
rule triggers but the candidate already equals the selected action, the trace records no override.
Executed commands are converted to IEEE-754 binary32 before MetaDrive execution so the trace-bound
action matches the simulator action precision.

Metrics keep two different intervention views:

- `shield_override_count` counts events where candidate and executed actions differ; and
- `shield_override_reasons` is a reason-code histogram, so one overridden event may increment
  several reason counts.

Intervention counts are descriptive. More or fewer interventions are not, by themselves, safety
improvements.

## MetaDrive challenge scenarios

Challenge scenarios use strict scenario schema `2.0`, require the MetaDrive adapter, forbid fake
hazards, and require the scheduled transition window to fit inside the bounded horizon. The
challenge adapter has version `1.1`; the Phase 2 nominal MetaDrive adapter remains version `1.0`.
Both checked-in scenarios use 10 Hz control, a 300-step horizon, an 8.0 m/s ego target, zero initial
ego speed, the pinned MetaDrive 0.4.3 runtime, and the existing headless fixed-map configuration.

### `lead_vehicle_hard_brake`

Source: `scenarios/metadrive_lead_vehicle_hard_brake.yaml`.

- A fixed-name, fixed-seed `TrafficDefaultVehicle` begins in the ego lane with a configured 10 m
  bumper gap and 8 m/s speed.
- The Hermes challenge manager sends a neutral longitudinal command before step 30, a native
  MetaDrive full-brake command of `-1.0` for 15 steps, then a recovery throttle command of `1.0`.
- The control mode is recorded as `metadrive_dynamic_action`.
- `behavior_realism_claim` is explicitly `false`. A repeatable scheduled command is not a claim
  about realistic human braking behavior or real traffic distributions.

### `cut_in_near_field`

Source: `scenarios/metadrive_cut_in_near_field.yaml`.

- A fixed-name, fixed-seed actor begins one lane width to the configured side, with a 10 m initial
  longitudinal gap and 4 m/s speed.
- Starting at step 30, Hermes applies a deterministic smoothstep lateral transition for 10 control
  steps while advancing the actor longitudinally at the configured speed.
- The actor pose, heading, and velocity are set through MetaDrive's replay-style kinematic surfaces;
  the control mode is recorded as `scripted_kinematic_replay`.
- `behavior_realism_claim` is explicitly `false`. This scenario is a reproducible geometry and
  control challenge, not a behavioral traffic-agent model.

The stock traffic manager does not provide a reliable scheduled near-field cut-in primitive in the
pinned release. The scripted kinematic replay is the closest supported deterministic mechanism and
must not be presented as native traffic behavior.

### Scenario acceptance specifications

These expectations define what the scenarios are intended to expose; they are not preassigned
verdicts. The release gate still evaluates only the evidence produced by each run.

| Requirement | `lead_vehicle_hard_brake` | `cut_in_near_field` |
|---|---|---|
| Hazard under test | A same-lane lead actor receives a scheduled hard-brake command while the ego closes | A slower adjacent-lane actor follows a scheduled near-field lateral transition into the ego lane |
| Scenario parameters | Seed 7; 10 m initial bumper gap; actor 8 m/s; trigger step 30; 15 braking steps; full-brake command; recovery throttle 1.0 | Seed 7; 10 m longitudinal gap; actor 4 m/s; one-lane lateral offset; trigger step 30; 10 transition steps; smoothstep kinematic replay |
| Expected baseline weakness | The unshielded IDM may preserve less TTC margin and may still fail illustrative comfort criteria; no collision or verdict is presumed | The unshielded IDM may enter a short-TTC closing state and may fail to finish the route inside the bounded horizon; no collision or verdict is presumed |
| Expected shield behavior | The 5.5 m/s illustrative speed cap should create visible candidate/executed differences and `SPEED_CAP` reasons; a TTC reason is expected only if the actual policy-input TTC reaches the configured threshold | Supported rules should create visible, reason-coded overrides when actual policy-input signals cross a configured threshold; the shield is not expected to guarantee route completion or comfort |
| Hard verifier expectation | Any collision, hard boundary breach, invalid termination, required-progress failure, or invalid evidence remains non-compensatory and cannot be offset by TTC or intervention counts | Same; in particular, TTC improvement cannot compensate for a required-progress failure |
| Soft verifier expectation | Acceleration, jerk, TTC availability/value, and simulated policy latency are reported independently and may remain `CONDITIONAL` | Acceleration, jerk, TTC availability/value, and simulated policy latency are reported independently and may remain `CONDITIONAL` when hard criteria pass |
| Reproducibility envelope | Same repository/simulator commits, host platform, Python version, scenario/gate/shield config, adapter/policy versions, seed, cadence, and horizon. Repeat deterministic evidence files must be byte-identical on this host; cross-platform bitwise physics determinism is not claimed | Same |
| Known simulator limitation | The fixed command schedule is repeatable but is not a realistic human-driver model or evidence about real braking distributions | Scripted kinematic replay is geometry/control replay, not native traffic-agent behavior or a real cut-in distribution |

## Actual-actor geometry, relative speed, and TTC

Challenge evidence is derived from the named actor's simulator ground-truth geometry and velocity,
not from a perception model or the installed IDM policy's private sensing:

1. Normalize the ego heading and project both oriented vehicle bounding boxes into the ego frame.
2. Treat the actor as a front object only when its center is ahead and the two oriented boxes
   overlap laterally.
3. Compute `front_distance_m` as the non-negative actor-rear to ego-front bumper gap.
4. Compute `front_relative_speed_mps` as actor longitudinal speed minus ego longitudinal speed,
   with both world-frame velocities projected onto the ego heading. A negative value means closing.
5. Compute TTC only for a finite paired gap with negative relative speed:
   `front_distance_m / -front_relative_speed_mps`.

When the actor is not ahead or does not laterally overlap, both front-object fields are `null`.
When a paired front object is not closing, the fields remain observable but no TTC sample is
created. `minimum_ttc_s` is the minimum valid closing sample in the stored trace; when there is no
such sample it is `NOT_AVAILABLE` with a reason, never zero or success.

Each challenge event records both the policy-input actor state and the post-step result actor state:
longitudinal position in the ego frame, lateral offset, speed, front pair, and phase
(`PRE_TRIGGER`, `BRAKING`, `RECOVERY`, `CUT_IN`, or `POST_CUT_IN`). `minimum_ttc_s` is computed from
post-step results, including the terminal observation; policy-input fields remain the source for
offline shield replay. The stored trace verifier enforces exact fields, finite values, paired front
signals, the scenario-specific phase schedule, initial gap/speed agreement, and continuity from
each result to the next policy input.

## Stored replay verification

`hermes verify-artifact` does not import or rerun MetaDrive. It captures required files through one
stable, no-follow descriptor snapshot and then validates the canonical bytes, schemas, digests,
event chain, component profiles, metrics, findings, and gate result.

For deterministic-shield evidence, stored verification additionally:

1. validates the exact strict shield configuration from `execution-context.json`;
2. reconstructs each shield input from the stored observation summary;
3. reapplies the deterministic shield to the stored candidate action; and
4. requires the recomputed executed action and ordered reason tuple to match the event exactly.

The challenge adapter version, actor-manager identity, fixed actor seed, scenario parameters, and
actual-actor signal mappings are also reconstructed from stored inputs and cross-checked without a
simulator import. A coherently rehashed but incorrect shield decision is therefore
`INVALID_EVIDENCE`, not a different policy verdict. Local hashes remain tamper-evident rather than
independently authenticated; an actor able to rewrite the whole bundle can recompute local hashes.

## Stored artifact comparison

Compare a baseline and shielded bundle only after both verify independently:

```bash
hermes verify-artifact artifacts/phase3-lead-baseline
hermes verify-artifact artifacts/phase3-lead-shielded
hermes compare artifacts/phase3-lead-baseline artifacts/phase3-lead-shielded
hermes compare artifacts/phase3-lead-baseline artifacts/phase3-lead-shielded \
  --format json
```

`table` and canonical `json` output are supported. Comparison uses the same stable stored snapshots
as artifact verification and never reruns a simulator.

Compatibility is fail-closed. The following must match before Hermes compares outcomes:

- evidence schema version;
- scenario digest, name, version, and schema version;
- gate configuration digest, name, and version;
- adapter name, version, and configuration digest;
- policy name, version, and configuration digest;
- seed, control frequency, and horizon;
- simulator name, version, and source commit;
- Python version, platform, and architecture; and
- an available, equal Hermes repository commit.

The baseline and candidate may intentionally have different shield names, versions, and
configuration digests. Run IDs and creation timestamps are not compatibility dimensions. A dirty
or unknown repository worktree state produces a warning; it does not silently erase the recorded
commit requirement.

For compatible evidence, Hermes reports `IMPROVED`, `REGRESSED`, `UNCHANGED`, or
`NOT_COMPARABLE` for:

- policy verdict and hard-failure set;
- collision count;
- minimum TTC and route completion;
- maximum absolute acceleration and jerk;
- policy latency value and latency-source compatibility;
- shield intervention count and reason histogram; and
- measurement evidence availability.

Missing measurements remain `NOT_COMPARABLE`, not numeric zero. Applicability transitions such as
"no closing TTC sample" to "closing TTC sample" are descriptive and `NOT_COMPARABLE`, never labeled
an improvement or regression. Intervention differences are likewise descriptive and
`NOT_COMPARABLE`. A hard-failure set that adds and removes different failures is not collapsed into
a misleading count.

Comparison exit codes are:

| Exit | Meaning |
|---:|---|
| `0` | Both artifacts are valid and compatible; inspect every reported dimension and trade-off |
| `30` | At least one artifact is invalid, so no comparison is made; JSON requests receive a canonical error envelope |
| `40` | Artifacts are valid but incompatible, the requested output format is unsupported, or an operational/configuration error occurred |

## Reproducible commands

Run baseline and shielded evidence with distinct run IDs because artifact publication never
overwrites an existing directory:

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
```

Replace the scenario and run-ID prefix with `metadrive_cut_in_near_field.yaml` and
`phase3-cutin-*` to exercise the cut-in. Do not assume a verdict or improvement from the command
name: verify each generated bundle and inspect candidate/executed actions, reason codes, hard
findings, TTC availability, progress, comfort, and interventions before making a comparison claim.

The implementation has focused unit and CLI coverage in:

- `tests/unit/test_shield_config.py`;
- `tests/unit/test_deterministic_shield.py`;
- `tests/unit/test_metadrive_challenge.py`;
- `tests/unit/test_artifact_verification.py`;
- `tests/unit/test_comparison.py`; and
- `tests/cli/test_phase3_cli.py`.

Before reporting Phase 3 acceptance, run the complete repository gates plus real bounded baseline,
shielded, repeat-seed, stored-verification, and comparison demonstrations. Record the observed
artifact paths, verdicts, digests, metrics, and any warning only after those commands complete.

## Observed Phase 3 acceptance — 2026-08-11

The required commands completed on the declared macOS arm64 host with Python 3.11.15 and pinned
MetaDrive 0.4.3 source commit `85e5dadc6c7436d324348f6e3d8f8e680c06b4db`. Every bundle below verified as
`INTERNALLY_CONSISTENT`; its repeat produced byte-identical `scenario.resolved.yaml`,
`gate-config.resolved.yaml`, `execution-context.json`, `events.jsonl`, `trace.sha256`,
`metrics.json`, `findings.json`, and `verdict.json` on this host.

| Artifact | Events / termination | Verdict | Trace digest | Collision | Minimum TTC | Route | Max acceleration / jerk | Overrides |
|---|---|---|---|---:|---:|---:|---:|---|
| `artifacts/phase3-lead-baseline` | 197 / destination | `CONDITIONAL` | `504dfbcdd8f4239f1b9f2a5e94fa64f8a1a6ac108543e46ace12b251aa409bd1` | 0 | 11.5858815639 s | 96.4624004603% | 12.6400566101 m/s2 / 125.5079269406 m/s3 | 0 |
| `artifacts/phase3-lead-shielded` | 271 / destination | `CONDITIONAL` | `7324adbd7fa824f5dd834be2b321e3a5e4da36fbdac6eca99b7ae0c92d49f380` | 0 | 13.3389112538 s | 96.2340234100% | 13.1688308716 m/s2 / 159.3982696536 m/s3 | 36 `SPEED_CAP` |
| `artifacts/phase3-cutin-baseline` | 300 / horizon | `HOLD` | `00137f7fda53afa3531531bfeae6a8635b95b271707185c6922431633a8a5ef5` | 0 | 1.8155836417 s | 84.8817862141% | 12.6833772659 m/s2 / 128.4159183501 m/s3 | 0 |
| `artifacts/phase3-cutin-shielded` | 300 / horizon | `HOLD` | `7a0f0c7954a4257dca7fa2e4d2fbc0c53317b77f846174f7b033da029653e1ae` | 0 | 8.4957941547 s | 84.3915167781% | 13.0037474632 m/s2 / 157.5652837753 m/s3 | 3 `SPEED_CAP` |

The stored comparisons are compatible and deliberately show trade-offs. Minimum TTC improved in
both pairs. Route completion, maximum acceleration, and maximum jerk regressed in both pairs.
Verdict, hard-failure set, and collision count were unchanged. Intervention counts and reason
histograms remained descriptive and `NOT_COMPARABLE`.

No real shielded artifact emitted `TTC_BELOW_THRESHOLD`: in these observed trajectories, earlier
speed-cap intervention kept the policy-input TTC above the configured TTC trigger. The cut-in
baseline's 1.8156 s minimum is post-step outcome evidence, not proof that the shield saw that value
as its next policy input. The lead runs remained `CONDITIONAL` because of illustrative comfort
findings; the cut-in runs remained `HOLD` because required route progress failed at the horizon.

The artifacts truthfully record repository commit
`638a951278d7b6ab5ffaad4bb514fc7447fa9b62` with `repository_dirty: true`, so comparison emits a
dirty-worktree warning. They are valid development evidence, not a clean-commit release candidate.
At the acceptance checkpoint, `pytest -q` reported 221 passing tests, Ruff passed, doctor reported
17 `PASS`, one expected dirty-worktree `WARN`, one optional-display `NOT_AVAILABLE`, and zero
`FAIL`, the five-step real headless smoke passed, and `third_party/metadrive` remained clean.

These outcomes are host-bounded simulation evidence. Stored replay does not rerun simulator
dynamics, local SHA-256 is not independently authenticated, and none of the observed improvements
establish real-world safety or deployment readiness.
