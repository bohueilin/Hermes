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
