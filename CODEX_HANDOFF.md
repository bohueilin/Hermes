# Hermes Phase 6 Codex handoff

## Current reviewer-comprehension addendum — 2026-08-13

The sections below preserve the original Phase 6 evidence-workbench handoff at `be57bb1`. The
current presentation-only iteration is on `feat/phase6-reviewer-comprehension`:

| Item | Current recorded result |
|---|---|
| Iteration start | `be57bb126d6339efe0d8184304620aab64a680a6` |
| Design freeze | `685b92df37e88a3232384fec4d57f5e9d8e5e089` |
| UX implementation | `e2eab3421973fb3d9ca554bc6da3f8953e3442de` |
| Submission-state hardening | `80439c5382cf5e0744cdcec7402633e4bcc81e1e` |
| Intermediate Browser-DOM Timeline parity fix | `cbced6e57670ae7aaf63f9ce875122ac7471e348` |
| Stable explicit H2-anchor fix / current pre-doc HEAD | `0fe3459ac87b78a023bb477ebf1210b2a9d31792` |
| Task 3 full suite | 746 passed |
| Final full / non-MetaDrive suites | 756 passed / 756 passed |
| Final focused 13-file matrix | 506 passed |
| Final installs / Ruff / doctor | both editable installs succeeded; Ruff passed; 17 PASS / 1 intended WARN / 1 DISPLAY NOT_AVAILABLE / 0 FAIL |
| Final CLI / artifact immutability | six reviews + three comparisons matched contracts; 100 canonical files unchanged |
| Task 3 adversarial result | GO; A01–A15 passed; no P0/P1 reproduced |
| Automated correctness | `OBSERVED` |
| Browser DOM structural walkthrough | `OBSERVED` for initial/PASS/HOLD/INVALID/Timeline/Provenance/limitations/compatible/incompatible states; no exception/leak |
| Manual visual review | `NOT YET OBSERVED` |
| Accessibility audit | `NOT YET OBSERVED` |
| Human comprehension | `NOT YET OBSERVED` |
| Remote actions | none |

The workbench now uses `Review` / `Compare` / `Evidence limitations`; Review contains
`Select & Verify`, `Overview`, `Evidence`, `Timeline`, and `Provenance`. Findings use six
requiredness-first groups, Timeline adds four presentation-only presets and supporting-event jump,
and compatible comparisons require mixed-outcome/no-advancement synthesis. Invalid quarantine and
the public ReviewEnvelope/ComparisonEnvelope 1.0 authority are unchanged.

Selection remains exact root-relative manual input. No picker/autocomplete was added because the
facade has no descriptor-safe discovery API; discovery first requires its own reviewed contract and
the deterministic synchronized bounded-LRU predecessor. The existing cache/session growth remains
accepted P2: 43 explicit selections previously reached 41 cache entries, 43 active sessions, and
about 251 MB peak RSS; restart recovers memory.

The current human-review package and final-iteration ledger are in:

- `PHASE6_DESIGN_ITERATION_HANDOFF.md`;
- `docs/PHASE6_USABILITY_TEST_PLAN.md`;
- `docs/PHASE6_HUMAN_OBSERVATION_TEMPLATE.md`; and
- `docs/PHASE6_VISUAL_REVIEW_CHECKLIST.md`.

The documentation-wave results are recorded in `PHASE6_DESIGN_ITERATION_HANDOFF.md`: 756 full, 756
non-MetaDrive, and 506 focused tests passed; both editable installs, repository Ruff, and
diff/cached checks passed; doctor reported 17 PASS, one intended 15-entry dirty-tree WARN, one
optional DISPLAY `NOT_AVAILABLE`, and no FAIL. Six review and three comparison CLI cases matched
their expected contracts, and 100 canonical files across ten retained artifact directories were
unchanged before/after. Do not treat those automated results, the historical 720-test results
below, or Task 3's 746-test result above as participant, screen-reader, contrast, or visual evidence.

The browser DOM walkthrough reproduced a first-Timeline-mount mismatch (radio indicated Decision
evidence while projection showed All tracks). Commit `cbced6e` fixed it RED-first; 88 scoped tests
and two independent targeted tests passed, and fresh DOM inspection confirmed All tracks plus the
exact 16-track multiselect. The in-app screenshot backend reported visibility false and returned
uniformly blank images, so no pixel/manual visual, 200% visual reflow, CSS focus, screen-reader,
contrast, accessibility-audit, or human-comprehension result is claimed.

The retained-state browser document object model (DOM) walkthrough additionally covered initial
UNVERIFIED, nominal PASS, collision HOLD, INVALID quarantine with no stored-PASS leak,
Timeline/action accountability, Provenance/limitations, compatible mixed comparison, and
incompatible fail-closed comparison without exception/leak. This remains structural DOM evidence,
not pixel/manual visual or accessibility evidence.

A second browser P2 showed stale Streamlit-generated H2 permalinks after radio reruns. Commit
`0fe3459` gives all seven primary H2s explicit stable anchors. Its targeted test failed then passed;
83 focused tests and two independent targeted tests passed, with Ruff/diff clean. Code/test closure
and narrow DOM closure are complete: fresh cross-section DOM observed Overview `#overview`, Timeline
`#timeline`, Compare `#compare`, and exception-text count 0. This does not promote manual visual,
accessibility, or human-comprehension status.

## 1. Executive summary

- **Phase attempted:** Phase 6 — local Evidence Review Workbench.
- **Highest completed milestone:** implementation, independent adversarial review, security
  hardening, and final local validation.
- **Verdict:** **GO** for the Phase 6 local, read-only, simulation-only scope.
- **Branch:** `feat/phase6-evidence-workbench`.
- **Starting commit:** `9e257a0cf0ddbdbf601b8a01deebe4de52de9763`.
- **Implementation/adversarial checkpoint:**
  `90fb7d891a233fea9fe5de915060873851da1d70`.
- **Ending commit:** the documentation-only `docs: finalize Phase 6 validation and handoff`
  commit is `HEAD` at delivery; its exact content-derived SHA is reported in the delivery response.
- **Working tree:** clean after the final local documentation commit and post-commit checks.
- **Remote actions:** none. Nothing was pushed, published, deployed, or configured remotely.

Hermes now reviews retained evidence through one immutable, verifier-owned path shared by the API,
CLI, and optional Streamlit workbench. The workbench does not run a simulator, policy, verifier
replacement, approval flow, or deployment action. The final adversarial decision is GO with no open
P0 or P1 finding. One restart-recoverable, explicit-selection-only cache-growth risk remains accepted
at P2.

## 2. Product boundary

Phase 6 remains:

- simulation and closed-lab only;
- local and loopback-only;
- read-only over explicitly selected artifact directories;
- unable to launch a simulator or policy from review;
- unable to edit, repair, approve, promote, release, or deploy anything;
- `NOT_AUTHENTICATED` for all current evidence;
- `NOT_EVALUATED` for authorization;
- `NONE` for deployment permission; and
- `SIMULATION_ONLY` in scope.

A Hermes `PASS` is a release-gate result over internally consistent stored simulation evidence. It
is not an authenticity, road-safety, certification, compliance, authorization, or deployment claim.

## 3. Design-freeze decisions

| Decision | Final choice | Rationale | Document |
|---|---|---|---|
| Canonical bundle inventory | Exactly 10 files | One contract shared with stored verification; no workbench-specific bundle | `docs/PHASE6_REVIEW_ENVELOPE_CONTRACT.md` |
| `ReviewEnvelope` version | `1.0` | Strict, deterministic, portable, category-bearing review contract | same |
| `ComparisonEnvelope` version | `1.0` | Exact compatible/incompatible union with no winner score | same |
| Evidence-sufficiency model | Core-owned required/optional/not-applicable plus availability and consequence | Prevents UI inference or missing-as-success presentation | same |
| UI framework | Streamlit | Locally testable with AppTest and cleanly optional | `docs/PHASE6_ARCHITECTURE_AND_TRUST_MODEL.md` |
| Optional dependency model | `workbench` extra | Core/CLI remain importable without Streamlit | `pyproject.toml` |
| Artifact-root policy | Explicit, canonical non-symlink directory; exact relative selection text | Fail-closed containment and no newest-run discovery | architecture document |
| Cache policy | Digest/schema/tool/locator key plus private capture identity; consistent evidence only | Cache is non-authoritative and mutation invalidates the session | envelope contract |
| Resource bounds | 16 MiB/file, 64 MiB/bundle, 10,000 events, 1 MiB/event line | Existing verifier ceilings, enforced before accepted review | envelope contract |
| Local bind policy | Numeric loopback only; default `127.0.0.1:8501` | No public or multi-user Phase 6 deployment | architecture document |

## 4. Architecture implemented

```text
explicit artifact root + exact relative selection
→ descriptor-relative, no-follow immutable capture
→ existing stored verification / comparison core
→ immutable ReviewEnvelope / ComparisonEnvelope
→ bounded inert presentation projection
→ shared CLI or loopback-only read-only workbench
```

`hermes.evidence.verification` owns bounded capture and stored recomputation. `hermes.review.models`
owns strict portable schemas. `hermes.review.projection` maps one captured snapshot without reopening
artifact paths. `hermes.review.facade` owns validated roots, exact locators, private capture identity,
cache/session invalidation, and comparison reuse. The CLI and workbench import the public review
surface. Workbench code cannot import adapters, policies, runtime, shields, faults, gates, verifiers,
or MetaDrive, and automated AST/import/process/network tests enforce that boundary.

## 5. Files changed

The authoritative implementation inventory is:

```bash
git diff --name-status 9e257a0cf0ddbdbf601b8a01deebe4de52de9763..HEAD
```

It is grouped as follows:

- **Root/config:** Phase 6 prompts, plans, policy/handoff files, README, and the optional Streamlit
  extra in `pyproject.toml`.
- **Review core:** hardened capture in `src/hermes/evidence/verification.py`; immutable gate/review
  registries; new `src/hermes/review/{models,projection,facade}.py` and package exports.
- **Workbench:** new `src/hermes/workbench/{launcher,app}.py` and package boundary.
- **CLI:** review/compare/workbench commands, lazy imports, stable exit taxonomy, and safe bounded
  text projection.
- **Tests:** schema, capture/TOCTOU, facade/cache, projection, comparison, CLI, AppTest, 10,000-event
  paging, architecture/import, loopback, immutability, and retained-artifact integration coverage.
- **Documentation:** Phase 6 architecture, contract, PRD, UX, threat/authenticity, traceability,
  decision log, demo runbook, design handoff, adversarial report, and this final handoff.

No generated artifact, simulator checkout, virtual environment, cache, or package metadata was
staged.

## 6. Dependencies

| Dependency | Version bound | Extra/runtime | Why added |
|---|---|---|---|
| Streamlit | `>=1.37,<2` | optional `workbench` | Local six-screen reviewer UI and AppTest |

The runtime dependencies remain Pydantic, PyYAML, Rich, and Typer. No cloud SDK, database, ML stack,
telemetry package, authentication service, upload stack, or signing dependency was added.

## 7. Review and comparison contracts

### `ReviewEnvelope`

- **Version:** `1.0`.
- **Key fields:** categorized artifact identity/inventory/digests; integrity; five independent trust
  dimensions; gate identity/verdict; evidence sufficiency; exact findings/metrics; complete bounded
  timeline; recorded provenance; diagnostics; assumptions; unavailable evidence; limitations.
- **Invalid behavior:** returns a portable `INVALID_EVIDENCE` envelope with safe partial identity,
  diagnostics, empty accepted findings/metrics/timeline, and `QUARANTINED` provenance. A stored PASS
  is never rendered as accepted.
- **Determinism:** strict sorted/registry order, canonical JSON, exact values/units/references, no
  filesystem metadata in portable output, and no review timestamp.
- **Review-time state:** root path, descriptor identities, active session, and cache remain private
  and non-serialized.

### `ComparisonEnvelope`

- **Version:** `1.0`.
- Both sides are independently captured and reviewed before the existing comparison core runs.
- Incompatible evidence returns reasons/warnings and safe side identity with no deltas or charts.
- Compatible evidence projects all 11 core dimensions exactly once: eight outcome dimensions are
  partitioned into improvement, regression, unchanged, or not-comparable, while verdict, hard
  failures, and evidence availability use three dedicated records.
- **Winner score:** absent. Intervention count is descriptive, not ordinal.

## 8. Trust semantics

The CLI and every workbench evidence surface keep these values separate:

| Dimension | Phase 6 value or source |
|---|---|
| Gate verdict | `PASS`, `CONDITIONAL`, `HOLD`, or `INVALID_EVIDENCE` from the existing gate |
| Integrity | `INTERNALLY_CONSISTENT`, `INVALID_EVIDENCE`, or transient `UNVERIFIED` |
| Authenticity | `NOT_AUTHENTICATED` |
| Authorization | `NOT_EVALUATED` |
| Deployment permission | `NONE` |
| Scope | `SIMULATION_ONLY` |
| Authoritative status | `NOT_DEFINED` |

Every portable/displayed evidence item is categorized as `OBSERVED`, `COMPUTED`, `GATE_DECISION`,
`ASSUMPTION`, `NOT_AVAILABLE`, `AUTHENTICITY`, or `RESIDUAL_RISK`. Color is never the sole carrier.

## 9. Commands executed and results

Final validation used Python 3.11.15 in Conda environment `hermes-dev`:

| Command | Exit | Actual result |
|---|---:|---|
| `python -m pip install -e ".[dev,workbench]"` | 0 | editable `hermes-autonomy==0.1.0`; Streamlit 1.61.1 available |
| `python -m pip install -e ".[dev]"` | 0 | core development install remains valid without requiring the optional UI |
| `python -m pytest -q` | 0 | **720 passed** |
| `python -m pytest -q -m "not metadrive"` | 0 | **720 passed**; real simulator tests were not launched |
| focused Phase 6 adversarial matrix | 0 | **488 passed** |
| representative negative/trust-boundary matrix | 0 | **39 passed** |
| `python -m ruff check .` | 0 | all checks passed |
| `python -m hermes doctor` | 0 | 17 PASS, one expected dirty-tree WARN, one optional display `NOT_AVAILABLE`, no FAIL |
| `git diff --check` | 0 | no whitespace errors |

Six retained valid envelopes emitted **12,801** source-reference instances; every reference resolved
against the already captured typed documents without a path reopen.

The 488-test focused command was:

```bash
python -m pytest -q \
  tests/unit/test_review_capture.py \
  tests/unit/test_artifact_verification.py \
  tests/unit/test_verifiers_and_gate.py \
  tests/unit/test_review_models.py \
  tests/unit/test_review_facade.py \
  tests/unit/test_review_projection.py \
  tests/unit/test_review_comparison.py \
  tests/integration/test_review_artifacts.py \
  tests/unit/test_architecture_boundaries.py \
  tests/unit/test_workbench_launcher.py \
  tests/unit/test_workbench_projection.py \
  tests/integration/test_workbench_smoke.py \
  tests/cli/test_review_cli.py
```

The exact 17-node negative/trust-boundary command is recorded in section 13. The representative
public CLI commands were:

```bash
hermes review-artifact handoff-phase5-demo --artifact-root artifacts --format json
hermes review-artifact handoff-p1-conditional --artifact-root artifacts --format json
hermes review-artifact handoff-p1-collision --artifact-root artifacts --format json
hermes review-artifact phase1-tampered --artifact-root artifacts --format json
hermes review-artifact handoff-p2-metadrive --artifact-root artifacts --format json
hermes review-artifact handoff-p4-fault --artifact-root artifacts --format json
hermes review-compare handoff-p3-lead-baseline handoff-p3-lead-shielded \
  --artifact-root artifacts --format json
hermes review-compare handoff-p3-cutin-baseline handoff-p3-cutin-shielded \
  --artifact-root artifacts --format json
hermes review-compare handoff-p3-lead-baseline handoff-p3-cutin-shielded \
  --artifact-root artifacts --format json
```

## 10. Review artifact demonstrations

All valid cases report `NOT_AUTHENTICATED`, `NOT_EVALUATED`, `NONE`, and `SIMULATION_ONLY`.
Review-operation exit is 0 even when the gate is `CONDITIONAL` or `HOLD`; invalid integrity exits 30.

| Artifact path | Gate | Integrity | Authenticity | Exit | Computed bundle digest | Events / findings / metrics / tracks |
|---|---|---|---|---:|---|---|
| `artifacts/handoff-phase5-demo` | `PASS` | `INTERNALLY_CONSISTENT` | `NOT_AUTHENTICATED` | 0 | `fd42b8399ba32853a587a63fee7aba9803c5918539b6053b1554937abcc13334` | `40 / 6 / 13 / 16` |
| `artifacts/handoff-p1-conditional` | `CONDITIONAL` | `INTERNALLY_CONSISTENT` | `NOT_AUTHENTICATED` | 0 | `752ba4725930d62335c1469ceebee6f7517d24265f8c945f68e45d2e7cb41cb4` | `39 / 6 / 13 / 16` |
| `artifacts/handoff-p1-collision` | `HOLD` | `INTERNALLY_CONSISTENT` | `NOT_AUTHENTICATED` | 0 | `723e814d0aea399dc2590dd0f1d5b09b20a03a28cadb49c062610894049ae27c` | `13 / 6 / 13 / 16` |
| `artifacts/phase1-tampered` | `INVALID_EVIDENCE` | `INVALID_EVIDENCE` | `NOT_AUTHENTICATED` | 30 | `831f22ed419e4b13ce5d0a1aa3bc1444b2ca523d60edb8d4c75eaa7491e1d61e` | `0 / 0 / 0 / 0` |
| `artifacts/handoff-p2-metadrive` | `PASS` | `INTERNALLY_CONSISTENT` | `NOT_AUTHENTICATED` | 0 | `78b6b15f96b3e2c3aacdbd525031cd82b54ccf7f17e162b36cff9dfba436ab42` | `165 / 6 / 13 / 16` |
| `artifacts/handoff-p4-fault` | `HOLD` | `INTERNALLY_CONSISTENT` | `NOT_AUTHENTICATED` | 0 | `83ba9b39b764fb3f09f9fc70f2adfb42415a73ef3b43b655c1a639d49761c43f` | `20 / 7 / 19 / 16` |

The tampered bundle reports bundle/events/current-event-hash mismatches, quarantines its stored PASS,
and exposes no accepted finding, metric, timeline, or stored provenance claim. The fault artifact's
seven-mechanism coverage finding passes; missing mission progress causes its HOLD.

## 11. Comparison demonstrations

| Artifact pair | Status / exit | Verdicts | Improvement | Regressions | Availability deltas | Other |
|---|---|---|---|---|---|---|
| `artifacts/handoff-p3-lead-baseline` → `artifacts/handoff-p3-lead-shielded` | `COMPATIBLE` / 0 | `CONDITIONAL` → `CONDITIONAL` | minimum TTC `11.585881563948043` → `13.338911253788899 s` | route completion, max acceleration, max jerk | none | collision/latency/source/verdict unchanged; intervention descriptive; 6 charts |
| `artifacts/handoff-p3-cutin-baseline` → `artifacts/handoff-p3-cutin-shielded` | `COMPATIBLE` / 0 | `HOLD` → `HOLD` | minimum TTC `1.8155836417275437` → `8.49579415469856 s` | route completion, max acceleration, max jerk | none | same unchanged/not-comparable partition; 6 charts |
| `artifacts/handoff-p3-lead-baseline` → `artifacts/handoff-p3-cutin-shielded` | `INCOMPATIBLE` / 40 | `CONDITIONAL` → `HOLD`; both sides internally consistent | none | none | no deltas permitted | scenario/adapter-config mismatch; zero deltas/charts |

These are mixed trade-offs, not shield wins. No UI-specific winner is computed.

## 12. Artifact immutability

- The representative matrix hashed every file in ten retained artifact directories before and after
  nine review/compare commands. Every aggregate directory hash was identical.
- Capture tests cover file growth, partial reads, selected/intermediate/root swaps, symlink swaps,
  root replacement, rename-back probes, unsupported descriptor operations, and descriptor cleanup.
- Metadata-only touch or same-byte replacement forces full recapture and invalidates active review;
  changed bytes/digest at the same locator never return the cached envelope. Both comparison sides
  receive the same pre-render check.
- Cache identity includes computed bundle digest, review-schema version, Hermes version, and exact
  relative locator; device/inode/mode/size/mtime/ctime remain facade-private and cannot serialize.
- Only internally consistent, non-null-digest envelopes are cacheable; invalid evidence is never
  cached.

One adversarial reviewer accidentally touched only the mtime/ctime of retained
`handoff-phase5-demo/events.jsonl`. No bytes changed; all ten SHA-256 values matched, Git content
status stayed clean, and immediate/final facade review retained the same PASS, bundle digest, trace
digest, 40 events, and 16 tracks. The deviation is disclosed in `PHASE6_ADVERSARIAL_REVIEW.md`; no
metadata reconstruction was attempted.

## 13. Security and negative tests

| Category | Result | Residual limitation |
|---|---|---|
| Path and symlink | absolute/empty/dot/traversal/alias/NUL and symlink root/selection/components reject before review/process launch | explicitly selected local root is still operator-provided |
| TOCTOU and cache | swaps, growth, replacement, touch, recapture, key isolation, FD cleanup pass | OS/host compromise is outside assurance |
| Invalid stored PASS | quarantined envelope, diagnostics, no accepted result | no repair/migration feature by design |
| XSS/control content | inert Streamlit TextColumn; Cc/Cf/ANSI-visible CLI; exact 1,024-scalar bound and metadata | JSON intentionally preserves exact full portable content |
| Resource bounds | 16 MiB/file, 64 MiB total, 10,000 events, 1 MiB/line; deterministic 10k paging | valid-limit work can still consume local resources |
| Numeric precision | machine/canonical/display values and units preserved; thresholds/tree/source refs exact | display is non-authoritative |
| `NOT_AVAILABLE` | explicit availability, reason, category; never zero/false/blank/Python `None` | source-permitted absence remains absence |
| Dependency boundary | AST and clean-process bombs cover runtime/adapters/policies/MetaDrive and prohibited authority/I/O calls | Python process compromise remains out of scope |
| Local-only bind | numeric loopback only; public/hostname binds reject before child process | no authentication because no multi-user service exists |
| Simulator isolation | full non-MetaDrive suite, import bombs, source-byte checks, no reset/step or simulator launch | review recomputes stored verifiers/gate but does not reexecute policy/simulator |

Adversarial hardening also made the release/review registries immutable and converted malformed YAML
constructor errors or finite-value derived-metric overflow into bounded quarantined invalid evidence.

The exact representative negative command was:

```bash
python -m pytest -q \
  tests/cli/test_review_cli.py::test_review_text_neutralizes_all_c0_c1_controls_and_ansi_from_artifact_text \
  tests/cli/test_review_cli.py::test_review_text_bounds_each_direct_scalar_at_input_scalar_boundary \
  tests/cli/test_review_cli.py::test_review_cli_rejects_nonexact_or_root_prefixed_selection \
  tests/cli/test_review_cli.py::test_review_commands_reject_missing_or_symlink_artifact_root \
  tests/cli/test_review_cli.py::test_workbench_cli_rejects_public_bind_as_configuration_error_without_streamlit \
  tests/unit/test_review_capture.py::test_root_contained_capture_rejects_symlink_root_selected_directory_and_intermediate_directory \
  tests/unit/test_review_capture.py::test_root_contained_capture_detects_mutation_without_reopening_artifact_paths \
  tests/unit/test_review_capture.py::test_root_contained_capture_rejects_directory_swap_after_descriptor_traversal \
  tests/unit/test_review_capture.py::test_root_contained_capture_rejects_configured_root_replacement_after_open \
  tests/unit/test_review_facade.py::test_changed_artifact_bytes_never_return_prior_cached_envelope \
  tests/integration/test_workbench_smoke.py::test_workbench_review_and_comparison_preserve_every_source_bundle_byte \
  tests/integration/test_workbench_smoke.py::test_workbench_active_rerun_recaptures_mutated_bundle_and_invalidates_review \
  tests/integration/test_workbench_smoke.py::test_workbench_apptest_performs_no_network_browser_or_child_process \
  tests/integration/test_workbench_smoke.py::test_workbench_apptest_bombs_runtime_simulator_policy_and_adapter_imports \
  tests/unit/test_architecture_boundaries.py::test_review_surfaces_bomb_runtime_and_simulator_imports \
  tests/integration/test_review_artifacts.py::test_retained_valid_artifacts_project_without_simulator_execution \
  tests/integration/test_review_artifacts.py::test_retained_tampered_artifact_quarantines_stored_pass
# 39 passed
```

## 14. Workbench launch

```bash
hermes workbench --artifact-root artifacts --host 127.0.0.1 --port 8501 --no-browser
```

- **Bound address:** numeric loopback `127.0.0.1` only.
- **Port:** 8501 by default; validated integer 1–65535.
- **Browser behavior:** disabled by the exact command above.
- **External network behavior:** none required; telemetry disabled; public binds reject.
- **Manual inspection at the original `90fb7d8` checkpoint:** **no**. That validation used pure row
  projections, launcher/process injection, and Streamlit AppTest; it launched no server, browser,
  simulator, or policy. The later reviewer-comprehension checkpoint did use a real loopback server
  and browser DOM walkthrough, then stopped the server cleanly and confirmed port 8501 closed. It
  still launched no simulator or policy and produced no pixel/manual visual evidence.

## 15. Adversarial review

- **Review file:** `PHASE6_ADVERSARIAL_REVIEW.md`.
- **Initial verdict:** HOLD while four P1 findings were open.
- **P0 findings:** none.
- **P1 findings, all closed:** mutable semantic registries; malformed implicit YAML scalar escaping
  quarantine; finite extreme derived-metric overflow escaping quarantine; unsafe/unbounded text CLI
  projection.
- **Additional P2 closed:** artifact-switch event-drilldown presentation state.
- **Accepted residual:** P2 process-lifetime `_cache`/`_active` growth. Forty-three explicit local
  selections produced 41 cached/43 active entries and about 251 MB RSS. There is no discovery or
  artifact-only trigger; restart recovers memory. A bounded synchronized LRU is recommended later.
- **Final verdict:** **GO**. Independent fix reviews found no additional P0–P3 findings in their
  remediated core/CLI scopes; C6-04 remains the explicitly accepted open P2 residual above.

## 16. Known limitations

- Local hashes make evidence tamper-evident and internally checkable; they do not authenticate its
  producer or origin.
- Stored verification recomputes metrics, findings, and gate decisions but does not reexecute the
  policy or simulator.
- Repository, simulator, adapter, policy, shield, and fault provenance is recorded/self-asserted,
  not independently attested.
- Results cover simulation and closed-lab evidence only; they do not establish real-world safety,
  certification, compliance, or road readiness.
- Deployment permission is always `NONE`; no approval or promotion semantics exist.
- Portable JSON is locator-bound; private same-host descriptor metadata is deliberately excluded,
  so hostile-host determinism/authenticity is not claimed.
- The retained cut-in scenario is a bounded simulator challenge, not proof of broad traffic realism.
- The workbench is single-user, local, and unauthenticated; no multi-user or approval workflow exists.
- Explicitly reviewing many unique valid locators in one long process can grow cache/session memory;
  restart is the Phase 6 recovery.

## 17. Git state

At delivery:

```bash
git branch --show-current
# feat/phase6-evidence-workbench

git status --short
# no output
```

`third_party/metadrive` remains clean at
`85e5dadc6c7436d324348f6e3d8f8e680c06b4db`; its source declares MetaDrive 0.4.3. The review API,
review/compare CLI, workbench AppTests, and non-MetaDrive suite neither imported nor launched the
simulator. `hermes doctor` did import MetaDrive solely to inspect the optional installed environment;
no adapter, policy, engine, scenario, window, or simulation step was created.

## 18. Local commits

| Commit | Message | Gate satisfied |
|---|---|---|
| `27cc5a0` | `docs: define Hermes Phase 6 evidence workbench plan` | Phase 6 scope pack |
| `0ad1f5c` | `docs: freeze Phase 6 review contracts` | design freeze |
| `943c3bd` | `docs: add Phase 6 implementation plan` | executable reviewed plan |
| `45bbb07` | `feat: extend immutable artifact review capture` | initial capture |
| `36e6c14` | `docs: freeze Phase 6 review runtime API` | API seam freeze |
| `7c16a80`, `1528e9e` | capture hardening fixes | capture review GO |
| `5aeded4`, `0dde754` | facade/sufficiency contract clarifications | projection seams frozen |
| `fd99e57`, `90efa47`, `f81ef31`, `fd57655` | review envelope implementation and fixes | model review GO |
| `7424285` | `feat: add immutable evidence review facade` | facade/projection review GO |
| `ad03cb2` | `feat: add evidence review comparison and CLI` | comparison/CLI review GO |
| `99c7512` | `feat: add local read-only evidence workbench` | workbench review GO |
| `90fb7d8` | `test: harden workbench trust boundaries` | adversarial review GO |
| `HEAD` | `docs: finalize Phase 6 validation and handoff` | final validation and documentation |

All commits are local. No push or pull request occurred.

## 19. Deferred scope

Not started: signature/authenticity implementation; approval, promotion, or release workflow;
scenario expansion; RL; CARLA; ROS/Autoware; cloud services; multi-user hosting; hardware; CAN bus;
vehicle control; or production deployment.

## 20. Recommendation

**Run a separate authenticity design review next, before any multi-user or approval workflow.** Its
predecessor gate is this clean Phase 6 handoff plus an explicit threat model for keys, signer
identity, canonical attestation, revocation, replay, authorization separation, and residual-risk
ownership. Do not treat a future valid signature as authorization or deployment permission.

## 21. Single best next command for the user

```bash
hermes workbench --artifact-root artifacts --host 127.0.0.1 --port 8501 --no-browser
```
