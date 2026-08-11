# Hermes Decision Log

## 2026-08-11 — Phase 0 environment doctor and package bootstrap

### Scope

Implement only the Python package scaffold and truthful environment doctor. Simulator execution,
policies, safety shields, release gates, evidence bundles, and dashboards remain later-phase work.

### Decisions

- Use distribution `hermes-autonomy`, import package `hermes`, and console command `hermes`.
- Require Python 3.11 for the package. The verified environment is Conda environment `hermes-dev`.
- Keep MetaDrive external to Hermes. The doctor cross-checks distribution/source version 0.4.3,
  representative asset sentinels, source path, clean nested Git revision, and the recorded pin
  without launching a simulation. Asset integrity remains unverified because the 0.4.3 bundle has
  no checksum manifest.
- Treat the official MetaDrive headless verification script as an upstream runtime diagnostic, not
  standalone proof. The user reported that it passed before Phase 0; the doctor independently
  imports its prerequisites and finds a graphics pipe, while explicitly not claiming rendering ran.
- Resolve the actual current Git root instead of enforcing the recommended `~/Projects/Hermes`
  path. This workspace is `/Users/bohueilin/Documents/GitHub/Hermes`.
- Exit successfully for `WARN` and `NOT_AVAILABLE`, but exit nonzero for any `FAIL`. Every failure
  includes an actionable remediation.

### Observed initial state

- Python in `hermes-dev`: 3.11.15.
- MetaDrive distribution: 0.4.3, imported from `third_party/metadrive`.
- MetaDrive source and recorded `SIMULATOR_COMMIT`:
  `85e5dadc6c7436d324348f6e3d8f8e680c06b4db`.
- The root Git repository has no commits yet and all starter files are untracked. Until an initial
  validated commit exists, Git provenance is `NOT_AVAILABLE` and the working tree is `WARN` dirty.
- Optional `DISPLAY`/`WAYLAND_DISPLAY` variables are unset on macOS. This is reported as
  `NOT_AVAILABLE` and is not treated as an offscreen prerequisite failure.

### Reversibility and follow-up

The doctor probes are simulator-light and isolated in `src/hermes/doctor.py`; later phases can
reuse their structured results without changing the three supported CLI entry paths. Phase 0 does
not implement `sim-smoke` or artifact verification commands.

## 2026-08-11 — Phase 1 deterministic evidence core

### Scope

Implement the complete simulator-neutral scenario-to-evidence path before integrating MetaDrive.
MetaDrive and Panda3D remain absent from Phase 1 runtime and stored verification.

### Decisions

- Use strict Pydantic v2 models and a shared bounded PyYAML loader. Reject duplicate keys,
  aliases/anchors, merge keys, unknown fields, non-finite values, type coercion in persisted
  evidence, and missing verifier-critical safety facts.
- Treat `max_collision_count: 0` and `max_offroad_duration_s: 0.0` as non-relaxable schema
  invariants. Gate completeness requires exactly one finding from each versioned Phase 1 verifier;
  weighted aggregate scoring is not used.
- Bind scenario/gate digests, adapter/policy/shield configuration digests, verifier-suite digest,
  seed, frequency, and horizon into every event's hash material.
- Treat the recorded horizon as an evidence-completeness invariant, cross-check observation
  summaries against the initial or prior executed state, and require fake/baseline policy latency
  to match its configuration and remain labeled `simulated`.
- Add `execution-context.json` and `findings.json` to make component inputs and complete verifier
  outputs independently inspectable. Add `bundle.sha256` to bind manifest bytes without a
  self-digest cycle; the seven originally required evidence files remain present.
- Define `trace.sha256` as the final event hash. The manifest separately hashes exact companion
  bytes.
- Fail closed as `HOLD` when otherwise valid evidence explicitly marks required progress
  `NOT_AVAILABLE`; unavailable soft evidence produces `CONDITIONAL`, and unavailable required
  collision/boundary evidence is `INVALID_EVIDENCE`. Missing schema-required raw evidence is
  corruption and therefore `INVALID_EVIDENCE`.
- Separate artifact validity from policy judgment: a valid HOLD/CONDITIONAL bundle reports
  `INTERNALLY_CONSISTENT` and returns 20/10; corruption returns 30.
- Stage, stored-only self-verify, and then atomically rename with a platform-native no-replace
  primitive. Stored verification reads a stable no-follow descriptor snapshot and cross-binds
  component context to the hashed run context. Never overwrite a final destination;
  adapter/policy/cleanup/write failures return 40 and publish nothing.
- Remap Click/Typer usage errors to configuration exit 40. Preserve Phase 0 doctor exits 0/1; the
  Hermes phase verdict contract is 0/10/20/30/40.

### Security and evidence limitation

Coherent whole-bundle rewriting remains possible for an actor who can recompute every local hash.
Hermes therefore reports authenticity as `NOT_AUTHENTICATED` and describes local SHA-256 as
tamper-evident, never tamper-proof.

## 2026-08-11 — Phase 2 pinned MetaDrive headless adapter

### Scope

Run one bounded MetaDrive 0.4.3 nominal scenario through the existing candidate, trace, verifier,
gate, artifact, and stored-verification contracts. Challenge scenarios and the runtime safety
shield remain Phase 3.

### Decisions

- Keep MetaDrive lazy and external. Production selection validates distribution/source version,
  imported source location, clean nested checkout, `SIMULATOR_COMMIT`, and the exact Hermes-supported
  commit before environment construction.
- Retain MetaDrive's `EnvInputPolicy` for execution. Instantiate the installed
  `IDMPolicy(env.agent, seed)` separately so Hermes captures the candidate before shield evaluation
  and sends the selected action back through `env.step()`.
- Apply the scenario target (`8.0 m/s` / `28.8 km/h`) to both installed IDM speed fields, disable
  lane changes for the bounded nominal route, and keep IDM deceleration enabled. Bind these settings
  and the binary32 candidate-action conversion into policy evidence.
- Use only source-verified 0.4.3 keys: physics-only rendering flags, fixed `"S"` map, one seed,
  zero traffic/accidents, fixed spawn lane, bounded horizon, continuous checked actions, 0.02-second
  physics step, and an exact integer decision repeat.
- Support zero initial speed in Phase 2 rather than inventing a velocity-vector mapping. Reject
  unsupported control frequencies and initial speeds before producing evidence.
- Derive physical acceleration from speed deltas, cumulative position from planar displacement,
  direct lane offset from named lane coordinates after reset-state validation, and route progress
  from the reset-normalized named completion signal. Bind both mappings and never force progress to
  100 on destination. Unexplained terminal states fail operationally.
- Record front distance and relative speed as trace-bound `NOT_AVAILABLE` signals with reasons.
  Do not reinterpret the installed IDM's internal sensing as Hermes evidence.
- Bind MetaDrive name, version, exact source commit, stable source identity, resolved adapter
  configuration, policy backend, clipping and binary32 action precision, and upstream IDM
  limitation into component configuration digests. Cross-check the manifest during
  simulator-free stored verification.
- Reuse all six verifiers and the non-compensatory release gate. Change only the residual dynamics
  limitation so MetaDrive evidence does not claim fake dynamics and fake evidence does not claim
  MetaDrive physics.
- Version `ProgressVerifier` as 1.1 and require destination reached plus configured progress. The
  illustrative Phase 2 gate uses 95% because the named destination signal occurs at about 96.06%
  normalized progress; a horizon truncation above 95% still receives `HOLD`. Older pre-1.1
  prototype bundles must be regenerated rather than interpreted under changed semantics.

### Observed acceptance

The five-step real smoke passed. The bounded nominal run reached its destination in 165 events /
16.5 simulated seconds and produced `PASS` with zero collision/off-road evidence. Stored replay
returned `INTERNALLY_CONSISTENT` / `PASS` without importing MetaDrive. A repeated seed-7 run produced
the same trace digest and byte-identical deterministic evidence files on this host. This does not
establish cross-platform bitwise physics determinism or any real-world safety property.
