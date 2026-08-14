# Hermes Decision Log

## 2026-08-13 — Implement reviewer comprehension and keep human gates open

### Scope

Implement the frozen presentation hierarchy and adversarially test it without changing the public
review facade, ReviewEnvelope/ComparisonEnvelope 1.0, gate, verifier, threshold, compatibility,
artifact capture, or local/read-only/simulation-only authority boundary. Add an executable future
human-review package, but do not infer visual, accessibility, or comprehension outcomes.

### Decisions

- Implement top-level `Review`, `Compare`, and `Evidence limitations`, with `Select & Verify`,
  `Overview`, `Evidence`, `Timeline`, and `Provenance` as ordered Review destinations. Keep stable
  keyed navigation and the submitted locator visible.
- Keep Tier 1 gate/integrity separate from Tier 2 origin `NOT_AUTHENTICATED`, authorization
  `NOT_EVALUATED`, deployment permission `NONE`, scope `SIMULATION_ONLY`, and authoritative status
  `NOT_DEFINED`. Persist the no-approval/deployment sentence throughout the workbench.
- Retain blank exact root-relative manual selection. No picker/autocomplete is implemented because
  there is no descriptor-safe discovery facade. Require a separately reviewed discovery contract
  and deterministic synchronized bounded LRU before any listing/autocomplete scale increase.
- Render Overview in decision-narrative order, findings in the frozen six-group order, and typed
  required/optional/not-applicable unavailable explanations. Keep every failed required finding
  visible even when another detail group is selected.
- Add Timeline presets `Decision evidence`, `Action accountability`, `Fault behavior`, and
  `All tracks`, plus an explicit first-supporting-event jump. They change only presentation state.
- Require compatible comparison sections for gate, hard failures, improvements, regressions,
  unchanged, not comparable, availability changes, and advancement interpretation. Use specific
  TTC/route/acceleration/jerk synthesis only when those exact typed partitions support it; otherwise
  use generic non-fabricating mixed-trade-off copy.
- Preserve strict invalid quarantine on every Review and Compare route. Bound and categorize
  persistent artifact-derived identity/rationale text; label missing manifest identity
  `NOT_AVAILABLE` rather than OBSERVED.
- On invalid Verify, reset all presentation drill-down/filter/jump state while preserving the last
  accepted submitted review. On invalid Compare, preserve the last accepted baseline/candidate pair
  and freshly recapture it for display.
- Create the future 6–10 participant Tasks 1–10 plan, blank observation template, and executable
  visual/accessibility checklist. A required-unavailable visual/human fixture must be separately
  approved; no retained bundle may be mutated or fabricated to fill that gap.

### Observed evidence and residuals

- Local commits: `685b92d` (design freeze), `e2eab34` (implementation), and `80439c5`
  (submission-state hardening).
- Task 3 ran A01–A15 and reported GO with no P0/P1 reproduced. It recorded 136 focused workbench/
  projection/architecture tests, 223 review/capture/comparison/CLI/artifact/launcher tests, and 746
  full tests passing; Ruff and diff checks passed.
- One broader presentation-only Timeline reference set after navigation retained all prior exact
  references and byte-identical facade/core/hash state; it remains at most P2.
- The existing P2 cache/session-growth decision is unchanged. The 43-selection observation (41
  cache, 43 active, about 251 MB peak RSS) remains restart-recoverable; the LRU is a predecessor for
  discovery or material scale increase.
- Automated correctness is `OBSERVED`. Manual visual review, accessibility audit, and human
  comprehension remain `NOT YET OBSERVED`; no WCAG claim is made.
- A later in-app browser DOM walkthrough found a first-Timeline-mount mismatch: the preset radio
  indicated `Decision evidence` while projection contained `All tracks`. Commit `cbced6e`
  (`fix: align timeline preset and projection`) aligned the default to `All tracks` through a
  failing targeted test, then 88 scoped and two independent targeted passing tests. Fresh browser
  DOM confirmed the All tracks radio and exact 16-track multiselect agree.
- Browser DOM structural parity is `OBSERVED` for that control/projection seam only. The screenshot
  backend reported visibility false and uniformly blank images, so pixel/manual visual review, 200%
  visual reflow, CSS focus, screen reader, contrast, accessibility audit, and human comprehension
  remain `NOT YET OBSERVED`.
- A second browser P2 exposed stale dynamic H2 permalinks after radio reruns. Commit `0fe3459`
  closes the implementation seam by assigning explicit stable anchors to all seven primary H2s.
  One targeted test failed then passed; 83 focused and two independent targeted tests passed, with
  Ruff/diff clean. Fresh cross-section browser DOM observed Overview `#overview`, Timeline
  `#timeline`, Compare `#compare`, and exception-text count 0. The finding is closed rather than
  accepted.
- Final Task 4 validation installed both editable extras and recorded 756 full tests, 756
  non-MetaDrive tests, and 506 focused Phase 6 tests. Repository Ruff and diff/cached checks passed;
  doctor reported 17 PASS, one intended 15-entry dirty-tree WARN, one optional DISPLAY
  `NOT_AVAILABLE`, and 0 FAIL. Six review and three comparison CLI cases matched their expected
  contracts; 100 canonical files across ten retained artifact directories were byte-identical
  before/after; no simulator/policy or remote action occurred.
- The complete browser document object model (DOM) retained-state walkthrough observed initial
  UNVERIFIED, PASS, HOLD, INVALID quarantine without stored-PASS leakage, Timeline/action
  accountability, Provenance/limitations, compatible mixed comparison, incompatible fail-closed
  comparison, and exact anchor hrefs without exception/leak. Pixel/manual visual, 200% reflow,
  visible CSS focus, screen-reader, contrast, accessibility-audit, and human-comprehension statuses
  remain `NOT YET OBSERVED`.

### Consequence

The completed presentation iteration may proceed only to an independently verified missing-evidence
fixture and the recorded manual visual, accessibility, and human-comprehension protocols. It may
not be represented as adding evidence authority, accessibility conformance, human validation,
approval, or deployment permission. No remote action is authorized.

## 2026-08-13 — Freeze the Phase 6 reviewer-comprehension design iteration

### Scope

Freeze the repository-aware presentation delta before production implementation. This decision
changes information architecture and reviewer copy only; it does not change the public review
facade, portable envelopes, verifier, gate, comparison authority, artifact contract, dependencies,
or read-only/local-only boundary.

### Decisions

- Replace six peer-level screens with top-level `Review`, `Compare`, and `Evidence limitations`.
  Within Review, use `Select & Verify`, `Overview`, `Evidence`, `Timeline`, and `Provenance`, in that
  order. Keep the submitted root-relative locator visible across the Review workflow.
- Present Tier 1 **Decision state** as gate verdict and evidence integrity. Present Tier 2
  **Authority boundaries** as origin `NOT_AUTHENTICATED`, authorization `NOT_EVALUATED`, deployment
  permission `NONE`, scope `SIMULATION_ONLY`, and authoritative status `NOT_DEFINED`. Do not combine
  the statuses. Persist this exact sentence: `This is a simulation evidence decision, not an
  approval or deployment authorization.`
- Reject a picker, directory list, and autocomplete for this iteration. The public facade has no
  descriptor-safe root discovery API, so UI-side directory enumeration would bypass the no-follow
  capture boundary and introduce new filesystem-discovery authority. A future safe discovery API
  would require explicit design and containment, symlink, replacement-race, lexical-order,
  no-default, and non-authority-language tests.
- Listing or autocomplete would materially increase single-user selection volume and therefore
  triggers the accepted bounded-cache predecessor: implement a deterministic synchronized bounded
  LRU before adding that discovery surface. Until both prerequisites are approved, retain blank
  root-relative manual entry, the inert example `handoff-phase5-demo`, separate draft/submitted
  values, submitted-selection confirmation, explicit Verify, and exact recovery copy.
- Order Overview as artifact, gate, rationale, integrity and independent authority boundaries,
  required unavailable evidence, limitations, then a technical-identity cue. Put hashes, versions,
  and detailed inventory in Provenance.
- Group Evidence in this exact order: `Failed required evidence`; `Required but unavailable`;
  `Soft failures and warnings`; `Passing required evidence`; `Optional evidence`; `Not applicable`.
  Use envelope-provided status, requiredness, severity/hard-invariant, and sufficiency only; the UI
  must not evaluate thresholds or infer gate/profile semantics.
- Freeze the availability copy: required unavailable means the selected verifier profile required
  a signal that could not be computed; optional unavailable does not control the current gate but
  remains a limitation; not applicable means the verifier is not required or evaluated under the
  selected profile. Missing evidence is never zero, false, blank, infinity, a flat line, or pass.
- Add Timeline presets `Decision evidence`, `Action accountability`, `Fault behavior`, and
  `All tracks`. Provide an explicit finding-to-first-supporting-event action that opens Timeline,
  moves to the containing page, and activates relevant tracks. If no supporting event exists,
  report it as unavailable. Filtering remains presentation-only.
- Require every compatible comparison to render, in order, `Gate outcome`, `Hard-failure change`,
  `What improved`, `What regressed`, `What was unchanged`, `What was not comparable`,
  `Evidence availability changes`, and `Advancement interpretation`. Mixed outcomes must be called
  a mixed trade-off with no overall advancement claim. Intervention count remains descriptive;
  never produce a winner, aggregate score, recommendation, promotion, or deployment conclusion.
- Preserve strict invalid-evidence quarantine across all Review surfaces. Safely captured inventory
  is a capture diagnostic, not accepted provenance: suppress it from Overview and normal invalid
  content. If retained in a technical Provenance diagnostic, isolate it and label every value
  `CAPTURED_DIAGNOSTIC`; never use it to imply an accepted result.
- Keep the current public facade and version 1.0 ReviewEnvelope/ComparisonEnvelope authoritative.
  This is a presentation-only design iteration; CLI and UI must continue consuming the same facade,
  and no UI gate, verifier, comparison, threshold, artifact parser, or discovery path is allowed.

### Human-validation status

Human comprehension, manual visual review, and accessibility audit remain `NOT YET OBSERVED`.
Automated coverage must not be represented as human evidence or WCAG conformance. The future
usability plan, observation template, and visual-review checklist must retain this status until
actual observations are recorded.

### Consequence and implementation gate

The two documentation files freeze the implementation target. Production and test changes may
proceed only in the later implementation task and must preserve the established one-way review
architecture, strict quarantine, read-only/local-only scope, and authority boundaries.

## 2026-08-12 — Implement and adversarially close Phase 6 evidence review

### Scope

Implement the frozen local, read-only Evidence Review Workbench through the public review facade,
review/compare CLI commands, optional Streamlit UI, adversarial remediation, and pre-final
validation. Do not add signing, approval, promotion, deployment, remote ingestion, a database, or
simulator/policy execution to review.

### Decisions

- Keep `ReviewEnvelope` and `ComparisonEnvelope` 1.0 as the only portable review contracts. Both
  CLI and UI consume `hermes.review`; neither reconstructs gate, verifier, threshold, requiredness,
  or comparison semantics.
- Add `review-artifact` and `review-compare` with exact root-relative selections, canonical JSON,
  readable bounded text, and operation-oriented exits 0/30/40. Preserve all legacy command exits.
- Add Streamlit only under `.[workbench]` at `>=1.37,<2`. Launch it through a validated argument
  vector on numeric loopback only, with usage telemetry disabled and no upload/write/remote action.
- Implement six explicit workbench screens and require a deliberate Verify or Compare action. Keep
  every active render behind fresh capture/stored verification and reset event-drill-down state on
  artifact change.
- Freeze every normative review/gate registry transitively. Normalize bounded artifact-derived
  YAML constructor and derived-metric representation failures into fixed diagnostics plus
  quarantined `INVALID_EVIDENCE`; do not mask programmer-control exceptions.
- Neutralize every Unicode `Cc`/`Cf` control in human CLI output and bound each artifact-derived
  input scalar at 1,024 with explicit original-length metadata. Preserve full byte-exact canonical
  JSON.
- Accept C6-04 as P2 for Phase 6: process-local facade cache/session maps remain unbounded. Require
  a deterministic synchronized LRU before materially increasing single-user artifact scale.
- Continue to expose authenticity `NOT_AUTHENTICATED`, authorization `NOT_EVALUATED`, deployment
  permission `NONE`, scope `SIMULATION_ONLY`, and authoritative status `NOT_DEFINED`. Do not add
  attestation or consequence controls.

### Observed implementation checkpoint

Checkpoint `90fb7d891a233fea9fe5de915060873851da1d70` passed 720 complete tests, 720 tests under the
non-MetaDrive selection, and 488 focused Phase 6 adversarial tests. Ruff and diff checks passed.
Independent core/facade/workbench and CLI reviewers returned GO with no P0-P3 in their remediated
scopes. The final adversarial verdict is GO with no open P0 or P1.

Automated review did not launch a simulator, policy, Streamlit server, or browser and did not use a
remote service. No human-comprehension result is claimed; the demo runbook remains the manual
observation protocol.

## 2026-08-12 — Close review-facade source and session seams

- **Decision:** Preserve a four-field safely parsed manifest identity on invalid inspection; approve
  the existing underscore-prefixed single-capture result as the sole facade handoff for private
  descriptor identity; retain the selected verifier profile on `VerifiedArtifactSnapshot`; and
  treat METRIC-first references as the collection-specific ordering rule.
- **Why:** A source-to-envelope implementation map proved that the public inspection intentionally
  lacked the private cache identity, invalid inspections discarded the manifest run ID needed to
  expose directory/run mismatch, and recomputing the verifier profile in presentation would create
  a second selection authority. The generic file-order rule also contradicted the exact metric rule.
- **Consequence:** No second parser, verifier, gate, or public filesystem-identity model is added.
  Invalid evidence exposes only schema-valid manifest identity fields; all other claims remain
  quarantined. Metric references remain deterministic and duplicate-free.
- **Supersedes:** This narrows, without weakening, the design-freeze capture and source-reference
  rules.

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
