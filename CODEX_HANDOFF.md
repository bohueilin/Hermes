# Hermes Codex Handoff

## Executive summary

- Highest completed gate: Phase 2 MetaDrive headless adapter.
- Status: Phase 0 preserved; Phase 1 committed at `635c246`; Phase 2 acceptance green.
- Result: the same Hermes evidence pipeline now supports the deterministic fake test double and a
  bounded, pinned MetaDrive 0.4.3 physics run with an installed IDM candidate policy.
- Checkpoint: `feat: add MetaDrive headless adapter` (the commit containing this handoff).
- Remote actions: none. No push, PR, deployment, purchase, or infrastructure mutation occurred.

## Repository and environment

| Field | Observed value |
|---|---|
| Repository | `/Users/bohueilin/Documents/GitHub/Hermes` |
| Branch | `feat/unattended-evidence-core` |
| Phase 0 commit | `c181509a691b132cb732a50c24612f6bd40bafca` |
| Phase 1 commit | `635c246ef2f1eba84fde315d60c1b4f2bcba8634` |
| Python | 3.11.15 in Conda `hermes-dev` |
| Hermes | 0.1.0 editable |
| MetaDrive | 0.4.3 from `third_party/metadrive` |
| Simulator commit | `85e5dadc6c7436d324348f6e3d8f8e680c06b4db` |
| Platform | macOS arm64 |

## Phase status

| Phase | Status | Acceptance result |
|---|---|---|
| Phase 0 | COMPLETE | Package/doctor baseline preserved |
| Phase 1 | COMPLETE, COMMITTED | Fake evidence core and all four verdict paths green |
| Phase 2 | COMPLETE, CHECKPOINT READY | Real smoke, nominal run, stored replay, provenance, repeat seed green |
| Phase 3 | NOT STARTED | Gated on the Phase 2 checkpoint commit |
| Optional hardening | NOT STARTED | Gated on earlier phases |

## Phase 2 architecture

- `MetaDriveAdapter` imports MetaDrive only after selection, validates exact supported
  version/source/commit/cleanliness, and owns one reset/step/close lifecycle.
- MetaDrive keeps its external `EnvInputPolicy`. A separately owned installed
  `IDMPolicy(env.agent, seed)` proposes the Hermes candidate; Hermes applies the shield boundary;
  the adapter submits the selected action to `env.step()`.
- The scenario target is applied as `8.0 m/s` / `28.8 km/h`; lane changes are disabled,
  deceleration remains enabled, and candidate actions are clipped then represented at MetaDrive's
  binary32 precision before tracing and execution.
- The adapter maps named speed, position, lane, route, crash, off-road, destination, and horizon
  signals. Reset lane state is validated before direct mapping; raw route progress is normalized
  without a destination-to-100 rewrite. Physical acceleration is a deterministic speed finite difference.
- Front distance and front relative speed are trace-bound as `NOT_AVAILABLE` with reasons.
- MetaDrive name, version, exact commit, stable source identity, resolved headless config, IDM
  backend/clipping/binary32 precision/limitation, seed, and component digests are bound into every
  event context.
- Stored verification has a strict MetaDrive support profile, cross-checks manifest provenance,
  and imports/runs no simulator.
- Existing six verifiers and non-compensatory release-gate precedence are reused; there is no
  adapter-specific gate rule. `ProgressVerifier` 1.1 requires destination plus the configured
  progress threshold; Phase 2 uses an illustrative 95% because the named destination fact occurs
  at 96.06% normalized progress.

## Latest validation

| Check | Actual result |
|---|---|
| Full automated suite | 146 passed in 2.39 s |
| Ruff | all checks passed |
| Doctor | 17 PASS, 1 dirty-tree WARN, 1 optional-display NOT_AVAILABLE, 0 FAIL |
| Real smoke | exit 0; five headless steps; MetaDrive 0.4.3 at pinned commit |
| Phase 1 nominal regression | PASS / 0; v1.1 trace digest `f515c16243d2b07c8a4b4ffd286edd5ff1c4ffa9486d3b28d034b40420ba234e` |
| Phase 1 collision regression | HOLD / 20 |
| Phase 1 boundary regression | HOLD / 20 |
| Phase 1 soft regression | CONDITIONAL / 10 |
| MetaDrive nominal | PASS / 0; 165 events; destination reached at 16.5 simulated seconds |
| Stored MetaDrive replay | INTERNALLY_CONSISTENT, PASS / 0, NOT_AUTHENTICATED |
| Repeat seed 7 | same trace digest and byte-identical deterministic evidence files |
| Third-party status | clean; no files under `third_party/metadrive` changed |

Final Phase 2 nominal trace digest:

```text
2b5009971c37c1eb65c9cc2830596689b5a25904a9b52b524d5bf77305848987
```

Observed nominal metrics: 165 events, 16.5 simulated seconds, zero collision count, zero off-road
duration, 96.05972167673185% normalized named route completion, approximately 2.7772 m/s² maximum absolute
acceleration, approximately 2.8324 m/s³ maximum absolute jerk, and 10 ms explicitly simulated
policy latency.

## Evidence and determinism limits

- This is simulation-only integration evidence, not real-road safety, certification, compliance,
  SAE level, or deployment evidence.
- The nominal zero-traffic route does not demonstrate obstacle response or shield benefit.
- MetaDrive IDM has an upstream broad internal fallback that is not structurally surfaced.
- The current stored verifier supports ProgressVerifier 1.1 mission semantics; older pre-1.1
  prototype artifacts need regeneration and are not silently reinterpreted.
- Same-host runs were byte-identical. Cross-platform acceptance remains exact categorical outcomes
  plus numeric state agreement within `1e-5`; cross-platform bitwise identity is not claimed.
- Local SHA-256 chaining is tamper-evident and internally verifiable, not independently
  authenticated.
- Generated artifacts are ignored and unstaged. The manifest truthfully records the Hermes working
  tree as dirty because it was generated before the Phase 2 checkpoint commit.

## Next action

After confirming the Phase 2 commit exists and the worktree is clean, begin only Phase 3:
deterministic shield reason codes and reliable simulator-supported challenge scenarios. Preserve
the Phase 1/2 gates and do not invent unsupported MetaDrive mechanisms.
