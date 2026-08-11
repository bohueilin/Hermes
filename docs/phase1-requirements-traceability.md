# Phase 1 Requirements Traceability

| ID | Hazard or requirement | Scenario/input | Component and verifier | Automated evidence/test | Gate consequence |
|---|---|---|---|---|---|
| P1-01 | Nominal bounded behavior is reproducible | `fake_nominal.yaml`, seed 7 | Fake adapter, baseline policy, all verifiers | `test_phase1_scenarios_publish_self_verified_artifacts`; `events.jsonl`, `trace.sha256` | `PASS` / 0 when all configured criteria pass |
| P1-02 | Collision cannot be averaged away | `fake_collision.yaml` | `CollisionVerifier` / `collision.zero` | Gate precedence and CLI tests; finding sequences in `findings.json` | `HOLD` / 20 |
| P1-03 | Road-boundary violation cannot be averaged away | `fake_boundary.yaml` | `BoundaryVerifier` / `boundary.within_tolerance` | Verifier, integration, and CLI tests | `HOLD` / 20 |
| P1-04 | Soft comfort degradation remains visible | `fake_soft_degradation.yaml` | `ComfortVerifier` / `comfort.acceleration` | Verifier and four-outcome CLI tests | `CONDITIONAL` / 10; human review, no deployment permission |
| P1-05 | Required unavailable evidence never becomes zero/pass | `unavailable_progress` test scenario | `ProgressVerifier` / `progress.required` | `test_explicitly_unavailable_required_progress_fails_closed_as_valid_hold`; metric/finding reason | Valid evidence, `HOLD` / 20 |
| P1-06 | Candidate and executed actions remain distinct | Every event | Policy → shield → trace | Policy/no-op tests; strict event schema | Evidence input to verifiers/gate |
| P1-07 | Runtime failure cannot masquerade as evidence | Injected adapter, policy, close, and writer failures | Orchestrator lifecycle, stager | Integration exception/cleanup tests | Operational error / 40; no final directory |
| P1-08 | Evidence must be exact and complete | Missing/truncated/duplicate events and files | Trace and artifact verifier | Tamper matrix, including refreshed outer digests | `INVALID_EVIDENCE` / 30 |
| P1-09 | Derived decisions are not trusted | Forged metrics/findings/verdict | Pure metric recomputation, verifier suite, gate | Coherent-envelope tamper tests | `INVALID_EVIDENCE` / 30 |
| P1-10 | Scenario/gate/component substitution is detectable | Modified resolved YAML, component context, or manifest | Hashed run context and manifest cross-checks | Context-substitution tests after detached-root refresh | `INVALID_EVIDENCE` / 30 |
| P1-11 | Missing/contradictory safety facts cannot default safe | Removed `collision_count`; contradictory state/raw facts | Strict `VehicleState`, typed `VerifierFacts`, semantic trace verifier | Full-rehash adversarial tests | `INVALID_EVIDENCE` / 30 |
| P1-12 | Unsafe output paths and overwrite are forbidden | Traversal/control/invalid slug, linked root, existing/raced destination | Artifact destination validator, exclusive writer lock, native atomic no-replace rename | Run-ID, root/destination symlink, existing destination, and publication-race tests | Configuration error / 40 |
| P1-13 | Stored verification never reruns a simulator | Any completed bundle | `evidence.verification` only | Import guard and bomb adapter tests | Preserves stored verdict if integrity is valid |
| P1-14 | Deterministic content excludes execution metadata | Two nominal run IDs, same inputs | Canonical trace and deterministic outputs | Byte comparison of context/events/metrics/findings/verdict/trace | Identical deterministic digest/verdict |
| P1-15 | Thresholds cannot waive collision zero | Gate configuration | Strict hard-rule schema | Relaxed/duplicate/weighted-rule rejection tests | Configuration error; never PASS |
| P1-16 | Full verifier suite is mandatory | Missing/duplicate/unknown finding | Release gate structural check | Gate finding-set tests | `INVALID_EVIDENCE` |
| P1-17 | Missing soft or safety evidence cannot become success | One-event jerk; unavailable collision finding | Separate structured comfort findings and fail-closed gate | One-event and hard-evidence availability regression tests | `CONDITIONAL` or `INVALID_EVIDENCE`; never `PASS` |
| P1-18 | Stored verification uses one stable file snapshot | Concurrent replacement/path-reopen attempt | Directory-relative `O_NOFOLLOW` descriptors, double reads, metadata/inventory stability | Descriptor-only snapshot regression test | Changed or linked evidence is invalid |
| P1-19 | Episode completeness cannot be shortened or extended | Early `HORIZON` claim or event count above recorded horizon | Trace semantic verifier and bounded `RunContext` | Coherent-rehash early-horizon and overlong-trace tests | `INVALID_EVIDENCE` / 30 |
| P1-20 | Policy inputs and latency claims remain truthful | Contradictory observation summary or relabeled fake latency | Prior-state observation checks and policy-config latency binding | Full-rehash observation/latency substitution tests | `INVALID_EVIDENCE` / 30 |
| P1-21 | Malformed filesystem entries cannot block review | FIFO substituted for a required file | Nonblocking no-follow descriptor open plus regular-file check | Timeout-backed FIFO regression | Prompt `INVALID_EVIDENCE`; no hang |

## Evidence interpretation

- `PASS` means only that configured illustrative criteria passed for the recorded fake scenario,
  seed, and component versions.
- `CONDITIONAL` is a review state, not automatic advancement or deployment permission.
- `HOLD` is a policy judgment over internally consistent evidence.
- `INVALID_EVIDENCE` means no policy judgment can be made.
- `NOT_AVAILABLE` is a signal/finding availability state with a mandatory reason, never numeric zero.

## Phase 2 extension

| ID | Hazard or requirement | Scenario/input | Component and verifier | Automated/observed evidence | Gate consequence |
|---|---|---|---|---|---|
| P2-01 | Simulator integration must preserve candidate → shield → execution ordering | `metadrive_nominal.yaml`, seed 7 | Installed IDM wrapper, no-op shield, `MetaDriveAdapter` | Candidate/executed event fields; adapter/policy tests; real nominal trace | Existing six-finding gate only |
| P2-02 | Headless configuration must use verified 0.4.3 APIs and remain bounded | Fixed `"S"` map, 10 Hz, horizon 300 | Lazy adapter configuration translator | Exact-config unit test; `hermes sim-smoke --headless` | Operational failure / 40 if unsupported |
| P2-03 | Native simulator actions and facts cannot be silently reinterpreted | Throttle/brake, speed, lane, crash, off-road, route, destination | MetaDrive mapping layer | Action and collision/off-road/destination/horizon mapping tests | Invalid/operational on contradictory or missing required facts |
| P2-04 | Simulator provenance must be exact and trace-bound | MetaDrive 0.4.3 at pinned 40-character commit | Runtime provenance validator and stored profile validator | Manifest/context assertions; real artifact; doctor | Operational error before publication or `INVALID_EVIDENCE` |
| P2-05 | Unsupported surrounding-object signals must remain unavailable | No selected stable named front-distance/relative-speed API | Adapter component context | Unit assertion and stored config validation | No fabricated metric or pass |
| P2-06 | Stored verification must remain simulator-free | Completed MetaDrive bundle | `evidence.verification` support profile | Test rejects any MetaDrive import; real `verify-artifact` | Preserves verdict only when internally consistent |
| P2-07 | Simulator/policy failure must close owned native state | Injected step exception | Orchestrator + adapter cleanup | Environment close and IDM destroy regression test; no artifact | Operational error / 40 |
| P2-08 | Same-seed behavior must be measured, not assumed | Two seed-7 run IDs | Canonical event pipeline | Same-host byte-identical context/events/metrics/findings/verdict/trace | Same bounded `PASS`; cross-platform tolerance `1e-5` |
| P2-09 | Numeric progress cannot substitute for mission completion | Destination at 96.06%; synthetic 100% horizon truncation | `ProgressVerifier` 1.1 plus `gates.phase2.yaml` | Raw route mapping bound in context; destination-required unit test; real final fact | `PASS` only with destination and at least 95%; otherwise `HOLD` |

## Phase 3 extension

| ID | Hazard or requirement | Scenario/input | Component and verifier | Automated evidence/test | Gate consequence |
|---|---|---|---|---|---|
| P3-01 | Shield thresholds and reasons must be explicit, versioned, and simulation-only | `config/shield.phase3.yaml` | Strict `ShieldConfig`; deterministic shield 1.0 | `test_phase3_shield_config_is_strict_versioned_and_digestible`; malformed/unknown-value parameter cases | Configuration error / 40 before evidence publication |
| P3-02 | Candidate intent must remain distinguishable from permitted execution | Every deterministic-shield event | Orchestrator, `TraceEvent`, semantic trace verifier | Per-rule, no-trigger, multi-trigger, already-selected-action, and reason-order tests in `test_deterministic_shield.py` | Missing, duplicate, unsupported, unordered, or action-inconsistent reasons produce `INVALID_EVIDENCE` / 30 |
| P3-03 | A scheduled lead braking challenge must use simulator dynamics rather than a fabricated trace fact | `metadrive_lead_vehicle_hard_brake.yaml`, fixed seed | `HermesChallengeManager`, named `TrafficDefaultVehicle`, MetaDrive dynamic action | `test_lead_actor_uses_fixed_seed_and_exact_hard_brake_schedule`; adapter actual-state test | Runtime/actor inconsistency is operational error / 40; collision still forces `HOLD` / 20 |
| P3-04 | A cut-in must use the closest reliable deterministic mechanism without a behavior-realism claim | `metadrive_cut_in_near_field.yaml`, fixed seed | Smooth `scripted_kinematic_replay`; `behavior_realism_claim: false` | `test_cut_in_actor_follows_labeled_smooth_kinematic_replay`; strict scenario tests | Unsupported challenge profile is configuration/operational error / 40; observed hard findings keep normal precedence |
| P3-05 | Front gap and relative speed must come from the named actor's actual state | Both schema 2.0 challenges | Oriented-box ego-frame projection and projected world velocities | `test_measure_challenge_actor_uses_oriented_bumpers_and_relative_velocity`; adapter signal-source assertions | Contradictory or malformed actor evidence produces `INVALID_EVIDENCE` / 30 |
| P3-06 | Non-front, non-overlapping, non-closing, or absent TTC evidence must not become zero or success | Cut-in before overlap; any non-closing sample | Paired challenge summary fields; pure `minimum_ttc_s` metric | Non-overlap measurement test; metric and comparison missing-evidence tests | Metric is `NOT_AVAILABLE` with reason; comparison dimension is `NOT_COMPARABLE` |
| P3-07 | Stored verification must reproduce the exact shield decision without simulator access | Deterministic-shield artifact and coherently rehashed forged override | Descriptor-safe artifact snapshot; deterministic shield replay | `test_stored_shield_replay_rejects_coherently_rehashed_forged_override`; simulator import guards | Mismatched executed action or ordered reasons produce `INVALID_EVIDENCE` / 30 |
| P3-08 | Runtime intervention cannot weaken hard-invariant precedence | Baseline and shielded challenge traces | Existing collision/boundary verifiers and release gate | Existing gate-precedence tests remain in the full suite; comparison exposes hard-failure sets | Collision or hard boundary failure remains `HOLD` / 20 regardless of TTC, progress, or intervention count |
| P3-09 | Baseline and shielded evidence must be compatible before outcome ranking | `hermes compare <baseline> <candidate>` | Stable `VerifiedArtifactSnapshot`; fail-closed compatibility check | `test_incompatible_runtime_identity_refuses_metric_comparison`; CLI invalid/incompatible exit test | Invalid input exits 30; incompatible valid input refuses dimensions and exits 40 |
| P3-10 | Comparison must expose improvements, regressions, missing evidence, and intervention trade-offs | Compatible baseline/shielded snapshots | Simulator-free comparison dimensions | Direction, hard-failure replacement, evidence availability, latency-source, and shield-identity tests in `test_comparison.py` | Compatible comparison exits 0; per-dimension status is `IMPROVED`, `REGRESSED`, `UNCHANGED`, or `NOT_COMPARABLE` |
| P3-11 | Actor disappearance or unavailable challenge runtime must not silently fall back | Injected missing actor/factory | Challenge manager and lazy MetaDrive adapter | `test_manager_fails_if_named_challenge_actor_disappears`; `test_adapter_rejects_challenge_when_injected_runtime_has_no_challenge_factory` | Operational error / 40; no completed evidence bundle |
