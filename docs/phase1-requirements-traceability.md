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
