# Hermes Decision Log

## 2026-08-12 — Freeze the minimal non-portable review runtime API

- **Decision:** Expose the portable `LocatorInfo`, one frozen four-field `ReviewCacheKey`, and the
  narrowly typed `ReviewUnavailableError` / `UNSUPPORTED_REVIEW_SHAPE` pair. Keep the allowed root
  as a facade argument/private runtime value and reuse the existing CLI taxonomy for all other
  failures.
- **Why:** Implementation-plan preflight found that the portable envelopes and cache tuple were
  exact, but the phrase “session locator/cache-key types and typed operational review errors” left
  room for competing public APIs. The minimal surface preserves the frozen tuple and exit contract
  without serializing an absolute root or creating a second error system.
- **Consequence:** Task 2 has an exact model/test target; Task 3 still owns root/selection validation,
  capture identity, caching, and error-to-CLI mapping.
- **Supersedes:** No prior decision; this clarifies the Phase 6 design freeze.

## 2026-08-12 — Phase 6 evidence-review design freeze

### Scope

Freeze an implementation-ready local, read-only Evidence Review Workbench design without adding
production Python, tests, dependencies, signing, artifact migration, or simulator execution.

### Decisions

- Retain the exact ten-file REQUIRED_ARTIFACT_FILES contract.
- Extend the existing descriptor-safe capture/facade narrowly so source inventory and observed/
  computed roots come from the same captured bytes; never reopen artifacts for presentation.
- Define strict immutable portable ReviewEnvelope and ComparisonEnvelope version 1.0. Exclude
  generated time and absolute paths; quarantine gate/findings/metrics on invalid evidence.
- Keep gate, integrity, authenticity, authorization, deployment permission, scope, and authority
  independent. Map core INVALID to portable INVALID_EVIDENCE without renaming the core enum.
- Expose requiredness from versioned verifier-profile metadata: hard findings required, comfort
  findings optional, and legacy fault coverage not applicable. Do not change gate precedence.
- Project structured simple/compound thresholds from verified configuration; UI never parses the
  existing threshold string or decides pass/fail.
- Select optional Streamlit >=1.37,<2 after evaluating a custom standard-library server and static
  report alternative. Keep review core framework-independent.
- Preserve the verifier as sole integrity authority at 16 MiB/file, 64 MiB total, 10,000 events,
  and 1 MiB/line. Review passes no stricter capture limit. Operational envelope budgets are
  64 findings, 64 metrics, depth 16, and 1,024 projection display scalars; unsupported core-valid
  shape is REVIEW_UNAVAILABLE / 40 with no envelope and unchanged gate/integrity.
- Accept only numeric loopback addresses via ipaddress; disable telemetry and remote dependencies.
- Make review CLI exits operation-oriented: valid PASS/CONDITIONAL/HOLD exit 0, invalid 30, and
  path/configuration/operational/incompatible 40. Preserve legacy command exits.
- Use compare_artifacts as the only comparison core; provide no winner score and no delta/chart
  payload after incompatibility.
- Record CONDITIONAL GO with no unresolved P0. The controlling user request says “Perform four
  internal stages in this one chat,” “Do not wait for human approval between stages unless a
  genuine unresolved P0 blocker...,” and after GO/CONDITIONAL GO, “continue automatically to
  Stage 6B.” This explicit instruction overrides the generic AGENTS separate-approval gate.

The full frozen register is docs/PHASE6_DECISION_LOG_SEED.md.

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

## 2026-08-11 — Phase 3 deterministic shield, challenges, and stored comparison

### Scope

Make candidate policy intent, shield-selected execution, and observed simulator consequences
separately reviewable. Add only the two required bounded MetaDrive challenges and a simulator-free
comparison of compatible stored artifacts. This phase does not authorize physical control or make a
road-safety, behavior-realism, certification, compliance, or deployment-readiness claim.

### Decisions

- Use a strict deterministic shield version 1.0 whose complete threshold configuration is canonical,
  digest-bound, and labeled `illustrative_simulation_only_not_real_vehicle_limits`. Support only the
  six specified ordered reasons: `TTC_BELOW_THRESHOLD`, `SPEED_CAP`, `STALE_OBSERVATION`,
  `BOUNDARY_RISK`, `EMERGENCY_STOP`, and `ACTUATION_DELAY_COMPENSATION`.
- Treat a missing required observation as invalid input rather than a stale/safe default.
  `STALE_OBSERVATION` applies to the age of an otherwise valid typed observation. Treat the configured
  actuation-delay value as an additional TTC margin, not as evidence that a delay fault was modeled.
- Select full braking for every supported trigger, with corrective steering toward lane center only
  for boundary risk. Preserve the candidate exactly when no rule changes it, quantize changed action
  components to MetaDrive's binary32 precision, and record reasons only when candidate and executed
  actions differ.
- Count shield interventions by changed-action events, not by number of reasons. Preserve a separate
  ordered reason histogram because one event can have multiple applicable rules. Do not rank a higher
  or lower intervention count as inherently safer.
- Introduce strict scenario schema 2.0 for MetaDrive challenges while keeping Phase 1/2 scenario
  serialization backward-compatible. Challenge scenarios cannot include fake hazards, and their
  scheduled transition windows must fit within the bounded horizon. Use MetaDrive adapter version
  1.1 for challenges while retaining version 1.0 for the Phase 2 nominal profile.
- Implement `lead_vehicle_hard_brake` with a fixed-name, fixed-seed `TrafficDefaultVehicle` receiving
  native MetaDrive dynamic actions on an exact neutral/brake/recovery schedule. Keep installed IDM
  deceleration enabled; do not create an artificially faulted baseline. Record
  `behavior_realism_claim: false` even though the actor uses simulator dynamics.
- Implement `cut_in_near_field` as a smooth, fixed `scripted_kinematic_replay` because the pinned
  stock traffic manager has no reliable scheduled near-field cut-in primitive. Set position,
  velocity, and heading through MetaDrive replay-style surfaces and record
  `behavior_realism_claim: false`; never relabel this as native traffic-agent behavior.
- Derive front gap and relative speed from the named actor's actual oriented bounding boxes and
  world-frame velocities projected into the ego frame. Require the actor to be ahead and laterally
  overlapping for a paired front signal. A negative actor-minus-ego longitudinal speed means closing;
  compute TTC only for finite paired closing evidence. Otherwise report `minimum_ttc_s` as
  `NOT_AVAILABLE` with a reason.
- Extend stored verification, not the online simulator, as the evidence authority. Reconstruct the
  deterministic shield from its stored strict configuration, replay every decision from the stored
  observation summary and candidate action, and require exact executed actions and ordered reasons.
  Reconstruct the supported challenge adapter profile without importing MetaDrive.
- Compare only independently verified descriptor-safe snapshots. Require equal evidence, scenario,
  gate, adapter, policy, seed, cadence, simulator, platform, and available repository-commit
  identities; intentionally allow shield identity/configuration to differ. Warn for dirty or unknown
  worktree state, but refuse unavailable or different commits.
- Report comparison dimensions as `IMPROVED`, `REGRESSED`, `UNCHANGED`, or `NOT_COMPARABLE` across
  verdict, hard failures, collision, TTC, progress, acceleration, jerk, latency, intervention details,
  and evidence availability. Missing evidence remains non-comparable, and intervention differences
  remain descriptive. Exit 30 for invalid input evidence, 40 for incompatible valid evidence or
  configuration/operational failure, and 0 only when valid compatible evidence is compared.

### Observed acceptance and limitation boundary

Completed 2026-08-11 commands produced four real, independently verified development bundles plus
byte-identical same-host repeats of their eight deterministic evidence files:

- lead baseline: `CONDITIONAL`, digest `504dfbcdd8f4239f1b9f2a5e94fa64f8a1a6ac108543e46ace12b251aa409bd1`;
- lead shielded: `CONDITIONAL`, digest `7324adbd7fa824f5dd834be2b321e3a5e4da36fbdac6eca99b7ae0c92d49f380`;
- cut-in baseline: `HOLD`, digest `00137f7fda53afa3531531bfeae6a8635b95b271707185c6922431633a8a5ef5`; and
- cut-in shielded: `HOLD`, digest `7a0f0c7954a4257dca7fa2e4d2fbc0c53317b77f846174f7b033da029653e1ae`.

Both comparisons reported improved minimum TTC alongside regressed route completion, acceleration,
and jerk. Verdict, hard failures, and collision count did not improve. The observed overrides were
36 and 3 `SPEED_CAP` events respectively; no real shielded artifact emitted
`TTC_BELOW_THRESHOLD`. The cut-in runs retained a non-compensatory required-progress failure.

All bundles record the pre-Phase-3 repository commit `638a951278d7b6ab5ffaad4bb514fc7447fa9b62`
and `repository_dirty: true`; comparison therefore warns and these bundles are development evidence,
not a clean-commit release candidate. MetaDrive ground truth is not a perception-system claim, the
scripted cut-in is not a behavior model, same-host repeatability is not cross-platform bitwise
determinism, stored verification does not replay simulator dynamics, and local SHA-256 remains
tamper-evident rather than independently authenticated. Full metrics and reproducibility conditions
are recorded in `docs/phase3-safety-shield.md`.

## 2026-08-11 — Phase 4 deterministic fault injection and Phase 5 hardening

### Scope

Add simulator-neutral observation/control faults only after the Phase 3 checkpoint was green, then
complete the prescribed local targets, PR-safe CI, schema/version checks, structured CLI errors,
and demo documentation. Dashboard, RL, CARLA, ROS 2, Autoware, cloud deployment, hardware, and real
logs remain deferred.

### Decisions

- Introduce scenario schema 3.0 and sibling evidence schema 2.0 models rather than adding optional
  fields to schema 1.0. This preserves legacy bytes/digests while requiring typed raw/delivered/result
  observations and candidate/permitted/executed actions for fault runs.
- Apply observation faults before policy/shield evaluation, then apply control delay and saturation
  after the shield. Shield metrics compare candidate to permitted action so actuator faults cannot
  masquerade as shield interventions.
- Bind bounded counter noise to the source observation packet. Delay, freeze, and held-last delivery
  therefore preserve sensor values even while delivery time and observation age advance.
- Treat startup control fill as explicitly `NOT_AVAILABLE` latency because it has no originating
  candidate. Subsequent control latency is derived from trace-bound simulated times.
- Require every configured mechanism and every scheduled freeze/dropout step to occur. Early
  termination or an untriggered configured saturation produces required fault coverage
  `NOT_AVAILABLE` and a non-compensatory `HOLD`.
- Reconstruct and replay the exact fault and shield transforms from stored evidence. Bind adapter
  result sequence/time/freshness and preserve Phase 3 actor/phase checks for schema-3 MetaDrive
  challenge evidence. Mixed or unsupported evidence schemas return `INVALID_EVIDENCE` rather than
  raising out of verification.
- Reject MetaDrive IDM observation faults before adapter construction because that policy reads
  native simulator state, not the Hermes observation. Permit only action delay/saturation for that
  installed-policy profile.
- Keep candidate policy proposals and simulator consequences as trace inputs. Offline verification
  does not rerun either component, and local hashes remain `NOT_AUTHENTICATED`; exact shield/fault
  replay must not be described as full policy/dynamics replay.
- Make fault identity/configuration part of comparison compatibility. Valid bundles with different
  fault profiles are not ranked against each other.
- Standardize CLI errors as `USAGE_ERROR`, `CONFIGURATION_ERROR`, `OPERATIONAL_ERROR`,
  `INVALID_EVIDENCE`, or `INCOMPATIBLE_EVIDENCE`, preserving verdict exits 0/10/20/30,
  operational/configuration exit 40, and doctor 0/1.
- Keep `make check` as the full local gate; add artifact-safe `make demo-phase1` and local/manual
  `make sim-smoke`. PR CI installs `.[dev]`, runs Ruff, and excludes tests marked `metadrive`.

## 2026-08-11 — Final adversarial contract corrections

### Decisions

- Require every release-gate caller to select a closed `VerifierProfile`; do not infer the Phase 4
  contract from whichever findings happen to be present and do not provide a silent legacy
  default. Runtime selects the fault-coverage profile from the resolved fault scenario, while
  stored verification also treats schema-2 execution context as requiring that profile. Omitting
  `fault.coverage.required` therefore yields `INVALID_EVIDENCE` instead of a possible legacy PASS.
- Emit exactly one canonical error envelope for `hermes compare --format json` when two valid
  artifacts are incompatible. Preserve the full comparison under error details and exit 40; never
  append Rich human output that makes stdout invalid JSON.
- Keep stored verification free of runtime-adapter and external-simulator imports. The recorded
  MetaDrive support declaration is immutable data in `hermes.simulator_support`; an AST boundary
  test prevents evidence, gate, or verifier modules from importing `hermes.adapters` or the
  external `metadrive` package.

### Observed result

The two reviewer regressions and architecture boundary checks pass inside the 273-test suite.
Clean-checkpoint fake, MetaDrive, challenge, fault, stored-verification, comparison, tamper, and
determinism demonstrations were regenerated at `3c32c529e8be7127fbd71ecc467da007b2f72d5f`.
