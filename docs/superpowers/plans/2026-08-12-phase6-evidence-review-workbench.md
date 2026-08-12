# Hermes Phase 6 Evidence Review Workbench Implementation Plan

> **For Codex:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to execute this plan task-by-task in this chat. Apply superpowers:test-driven-development for every behavior change, and superpowers:verification-before-completion before each checkpoint or completion claim.

**Goal:** Deliver a local-only, read-only Hermes Evidence Review Workbench that reviews and compares already stored simulation artifacts through the existing stored-verification and comparison authorities, while preserving independent trust states and quarantining invalid stored claims.

**Architecture:** Extend the existing no-follow capture once so it returns immutable capture identity and digest metadata from the same descriptor snapshot. A framework-independent `hermes.review` package maps that verified inspection into strict frozen `ReviewEnvelope` and `ComparisonEnvelope` 1.0 models, then a small projection layer feeds both the CLI and an optional Streamlit workbench. The UI imports only the public review API; it never parses artifacts, runs a policy/simulator, or implements gate/verifier/comparison semantics.

**Tech stack:** Python 3.11, Pydantic 2 strict/frozen models, Typer/Rich CLI, Streamlit 1.x in optional `workbench` extra, pytest, Ruff, stdlib descriptor APIs and `ipaddress`.

**Frozen source of truth:** `PHASE6_DESIGN_FREEZE_HANDOFF.md`, `docs/PHASE6_REVIEW_ENVELOPE_CONTRACT.md`, `docs/PHASE6_ARCHITECTURE_AND_TRUST_MODEL.md`, `VALIDATION_MATRIX.md`, and `docs/PHASE6_REQUIREMENTS_TRACEABILITY.md` at commit `0ad1f5c`.

**Non-negotiable invariants:** The existing stored verifier alone decides integrity. Existing `compare_artifacts` alone decides compatibility and dimension status. Invalid evidence cannot expose an accepted stored verdict, finding, metric, timeline, or provenance. Current authenticity is always `NOT_AUTHENTICATED`; authorization is `NOT_EVALUATED`; deployment permission is `NONE`; scope is `SIMULATION_ONLY`. Source artifact bytes never change. Review paths never import or launch adapters, policies, runtime, or MetaDrive. No remote action is allowed.

---

## Task 1: Extend the single-capture verification seam and core evidence-profile metadata

**Files:**

- Modify: `src/hermes/evidence/verification.py`
- Modify: `src/hermes/gates/release.py`
- Modify: `src/hermes/evidence/__init__.py` only if a deliberately public capture type is exported
- Test: `tests/unit/test_artifact_verification.py`
- Test: `tests/unit/test_verifiers_and_gate.py`
- Create: `tests/unit/test_review_capture.py`

**Step 1: Write failing capture-result tests.**

Add tests that call the new root-contained inspection entry point and assert:

- the artifact root is an existing real directory and selection is a non-empty lexical string
  relative to that root;
- absolute selections, empty/`.` selections, empty segments, `..`, repeated separators,
  backslash aliases, a symlink root, selected-directory symlink, and intermediate symlink fail
  closed before any artifact claim is accepted;
- the canonical ten-file inventory is captured in `REQUIRED_ARTIFACT_FILES` order;
- each inventory entry exposes byte size, SHA-256, and private metadata identity from the same descriptor read;
- observed and computed bundle roots and observed/computed trace roots come from the same captured payloads;
- invalid/missing bundles retain only actually captured inventory and nullable roots without fabricating identity;
- replacing or mutating a file during capture is detected;
- existing `inspect_artifact(Path)` and `verify_artifact(Path)` behavior and limits remain backward compatible;
- no artifact path is reopened to populate inventory or roots.

Run the focused tests and record the expected RED caused by the missing API/type:

```bash
conda run -n hermes-dev python -m pytest -q \
  tests/unit/test_review_capture.py \
  tests/unit/test_artifact_verification.py
```

**Step 2: Implement one immutable capture result, not a second reader.**

Refactor `_read_exact_files` around a frozen internal capture object. Keep byte payloads private to verification, but return immutable public/session metadata sufficient for review:

```python
@dataclass(frozen=True, slots=True)
class _CapturedFileState:
    file_name: str
    size_bytes: int
    observed_sha256: str
    metadata_identity: tuple[int, int, int, int, int, int]


@dataclass(frozen=True, slots=True)
class ArtifactInspection:
    verification: ArtifactVerification
    snapshot: VerifiedArtifactSnapshot | None
    _captured_files: tuple[_CapturedFileState, ...]
    observed_bundle_digest: str | None
    computed_bundle_digest: str | None
    observed_trace_digest: str | None
    computed_trace_digest: str | None
    stored_claim_files: tuple[str, ...]
```

The exact names may vary if the final model remains equally narrow and immutable, but these
semantics may not. Descriptor metadata is an internal handoff only: do not export the private
capture-state type from `hermes.evidence`, `hermes.review`, package `__all__`, portable models, or
serialization. `review.facade` copies it into its own non-exported `CaptureIdentity` session type.
Add recursive API/serialization tests proving that device, inode, mode, mtime, and ctime cannot
escape. Implement a descriptor-relative root-contained entry point such as:

```python
inspect_artifact_under_root(
    artifact_root: Path,
    selected_relative_path: str,
) -> ArtifactInspection
```

Validate the lexical selection once in the review facade, pass the exact validated string to the
internal capture seam, and traverse directory components with `O_DIRECTORY | O_NOFOLLOW` relative
to the already opened real root. Preserve that exact string as the portable locator and cache-key
component. Reuse the same selected-directory descriptor to capture required files. Do not resolve
a selected path and then reopen it by pathname. Preserve the current 16 MiB/file, 64 MiB total,
10,000-event, and 1 MiB/event-line limits exactly.

**Step 3: Write failing evidence-profile tests.**

Assert an immutable, versioned profile registry adjacent to `EXPECTED_FINDINGS_BY_PROFILE` exposes profile order and requiredness:

- `legacy` 1.0: trace, collision, boundary, progress required; acceleration/jerk optional; fault coverage not applicable;
- `fault_coverage` 1.0: the same plus required fault coverage.

Assert `apply_release_gate` results and existing expected-finding validation are unchanged.

**Step 4: Implement the minimal core registry.**

Add a frozen specification type and `EVIDENCE_REQUIREMENTS_BY_PROFILE` (or equivalent) in `src/hermes/gates/release.py`. Do not change gate precedence, finding status, artifact schema, or persisted gate results.

**Step 5: Run focused and regression tests.**

```bash
conda run -n hermes-dev python -m pytest -q \
  tests/unit/test_review_capture.py \
  tests/unit/test_artifact_verification.py \
  tests/unit/test_verifiers_and_gate.py
conda run -n hermes-dev python -m ruff check \
  src/hermes/evidence/verification.py \
  src/hermes/gates/release.py \
  tests/unit/test_review_capture.py
```

Expected: focused suite GREEN; all existing verifier/gate assertions unchanged.

---

## Task 2: Implement strict immutable ReviewEnvelope and ComparisonEnvelope 1.0 models

**Files:**

- Create: `src/hermes/review/__init__.py`
- Create: `src/hermes/review/models.py`
- Create: `tests/unit/test_review_models.py`
- Create: `tests/fixtures/review/` golden JSON files only if deterministic fixtures improve clarity

**Step 1: Write contract tests before models.**

Cover every frozen discriminator and invariant from the normative contract:

- `extra="forbid"`, `frozen=True`, strict types, finite numbers only;
- exact enums and constants;
- source-inventory and source-reference ordering/deduplication;
- categorized observed/computed digest separation;
- `ExactValue`, `ActionValue`, `ObservationValue`, `StringListValue`, threshold-expression union, and metric-value union;
- trust records exactly once and in the frozen order;
- invalid-envelope quarantine constraints;
- 19-item v1/v2 metric registry and 16-track timeline registry;
- `NOT_AVAILABLE` cannot carry zero/success and must carry a reason;
- comparison dimension-value union, dedicated hard-failure and availability-summary deltas, side-qualified references, and incompatible-empty constraints;
- recursive forbidden keys: winner, score, approval, deployment grant, absolute path, device, inode, mode, mtime, ctime, generated time;
- canonical JSON is byte-identical for equivalent inputs and includes no non-deterministic values.

Run and capture RED:

```bash
conda run -n hermes-dev python -m pytest -q tests/unit/test_review_models.py
```

**Step 2: Implement the exact Pydantic model graph.**

Use one private base model:

```python
class ReviewModel(BaseModel):
    model_config = ConfigDict(
        extra="forbid",
        frozen=True,
        strict=True,
        allow_inf_nan=False,
    )
```

Implement the exact types and validation rules from
`docs/PHASE6_REVIEW_ENVELOPE_CONTRACT.md`; do not simplify structured values into
`dict[str, Any]`. Export portable `ReviewEnvelope`, `ComparisonEnvelope`, `LocatorInfo`, the exact
runtime `ReviewCacheKey`, canonical serializer, `ReviewUnavailableReason`, and
`ReviewUnavailableError` from `hermes.review.__init__`. Do not invent another public locator or
parallel path/configuration error taxonomy. Keep Streamlit and workbench imports entirely absent.

**Step 3: Add deterministic serialization.**

Reuse `canonical_json_bytes` and provide one API that returns canonical UTF-8 JSON with the CLI adding exactly one trailing newline. Reject unsupported review-schema versions; do not migrate or normalize.

**Step 4: Run model tests and static checks.**

```bash
conda run -n hermes-dev python -m pytest -q tests/unit/test_review_models.py
conda run -n hermes-dev python -m ruff check \
  src/hermes/review/models.py tests/unit/test_review_models.py
```

Expected: GREEN, with explicit tests for every model variant and quarantine rule.

---

## Task 3: Build the framework-independent review facade and projection with single-artifact parity

**Files:**

- Create: `src/hermes/review/facade.py`
- Create: `src/hermes/review/projection.py`
- Modify: `src/hermes/review/__init__.py`
- Create: `tests/unit/test_review_facade.py`
- Create: `tests/unit/test_review_projection.py`
- Create: `tests/integration/test_review_artifacts.py`

**Step 1: Write failing facade tests for representative valid and invalid artifacts.**

Use retained bundles and temporary copies to assert:

- nominal fake and MetaDrive artifacts produce internally consistent envelopes without simulator execution;
- collision/boundary remain `HOLD`, soft degradation remains `CONDITIONAL`, and fault artifact remains `HOLD` with passing fault coverage;
- `phase1-tampered` returns `INVALID_EVIDENCE`, preserves the selected-directory versus manifest-run-ID mismatch when safely captured, and quarantines stored `PASS`/findings/metrics/provenance;
- mandatory trust records always exist independently of verdict;
- every finding gets profile-requiredness, exact threshold expression, consequence memberships, exact measurement/unit/operator, and source sequences;
- metric order/value kinds and timeline track order match the frozen registries;
- schema 1 permitted/raw/delivered/result/fault tracks are explicit unavailable tracks;
- schema 2 separates candidate/permitted/executed and raw/delivered/result observations;
- source references never cause a path reopen;
- reviewing through core changes no bundle byte;
- two repeated reviews at the same locator are byte-identical even after metadata-only touch;
- the cache key is exactly `(computed_bundle_digest, review_schema_version, hermes_version,
  selected_relative_path)`;
- identical bytes at a different relative locator never share a cache entry;
- metadata-only touch or same-byte replacement forces a full recapture and invalidates active
  session/projection state even when the rebuilt portable JSON is byte-identical;
- a changed digest invalidates the session projection; invalid envelopes never enter the cache;
- before every comparison render, both baseline and candidate receive the same independent full
  recapture and metadata/digest invalidation behavior;
- a coherently rewritten and completely rehashed bundle may remain `INTERNALLY_CONSISTENT`, but
  always remains `NOT_AUTHENTICATED`, `NOT_EVALUATED`, permission `NONE`, and `SIMULATION_ONLY`;
- core-valid unsupported projection shape raises `REVIEW_UNAVAILABLE / UNSUPPORTED_REVIEW_SHAPE` without changing core integrity/verdict.

Run and capture RED:

```bash
conda run -n hermes-dev python -m pytest -q \
  tests/unit/test_review_facade.py \
  tests/integration/test_review_artifacts.py
```

**Step 2: Implement projection registries in the review core.**

Implement immutable registries for:

- the seven exact threshold expressions and consequences;
- the profile-ordered sufficiency items;
- the 19 supported metric fields and their value kinds, units, availability, source references, and direction;
- the 16 timeline tracks and schema-specific availability;
- residual limitations, assumptions, unavailable-evidence items, and recorded/authenticated provenance.

Projection must consume only `ArtifactInspection` and its verified `VerifiedArtifactSnapshot`; it must never parse files or threshold strings and must never call gates or verifiers.

**Step 3: Implement facade orchestration and quarantine.**

Provide public APIs with explicit root and selection, for example:

```python
review_artifact(artifact_root: Path, selected_relative_path: str) -> ReviewEnvelope
compare_review_artifacts(
    artifact_root: Path,
    baseline_relative_path: str,
    candidate_relative_path: str,
) -> ComparisonEnvelope
```

The facade validates the real root and exact relative selection strings, calls the single-capture
stored-verification entry point, selects a cache key only for internally consistent results with
non-null computed digest, and constructs the invalid envelope solely from safe capture metadata and
verifier diagnostics. It rejects aliases rather than normalizing them. Cache use always follows a
fresh full capture/verification and private `CaptureIdentity` comparison.

**Step 4: Implement presentation-only helpers.**

`projection.py` may group/sort/page already typed records and create explicit truncated-display records. It may not alter counts, verdicts, statuses, thresholds, exact values, or source references. Test 1,024/1,025 Unicode scalars and threshold-adjacent formatting.

**Step 5: Run focused and artifact-integration tests.**

```bash
conda run -n hermes-dev python -m pytest -q \
  tests/unit/test_review_models.py \
  tests/unit/test_review_facade.py \
  tests/unit/test_review_projection.py \
  tests/integration/test_review_artifacts.py
conda run -n hermes-dev python -m ruff check src/hermes/review tests/unit/test_review_*.py
```

Expected: all representative single-artifact cases GREEN, no artifact mutation, no simulator call.

**Step 6: Checkpoint commit after review-core review and full regression.**

Before committing, run:

```bash
conda run -n hermes-dev python -m pytest -q
conda run -n hermes-dev python -m ruff check .
git diff --check
git status --short
git add \
  docs/superpowers/plans/2026-08-12-phase6-evidence-review-workbench.md \
  src/hermes/evidence/verification.py src/hermes/evidence/__init__.py \
  src/hermes/gates/release.py src/hermes/review \
  tests/unit/test_review_capture.py tests/unit/test_review_models.py \
  tests/unit/test_review_facade.py tests/unit/test_review_projection.py \
  tests/unit/test_artifact_verification.py tests/unit/test_verifiers_and_gate.py \
  tests/integration/test_review_artifacts.py
git diff --cached --check
git diff --cached --stat
```

Stage only Task 1–3 files plus this plan and commit:

```bash
git commit -m "feat: add immutable evidence review facade"
```

---

## Task 4: Map the existing comparison core and add review CLI commands with import isolation

**Files:**

- Modify: `src/hermes/review/facade.py`
- Modify: `src/hermes/review/projection.py`
- Modify: `src/hermes/cli.py`
- Modify: `src/hermes/cli_errors.py` only if a stable `REVIEW_UNAVAILABLE` code is needed
- Modify: `tests/unit/test_comparison.py` only for non-breaking core assertions
- Create: `tests/unit/test_review_comparison.py`
- Create: `tests/cli/test_review_cli.py`
- Modify: `tests/unit/test_architecture_boundaries.py`

**Step 1: Write failing comparison-envelope tests.**

Assert both sides independently capture/verify before comparison; invalid either-side cases exit the facade path without a `ComparisonEnvelope`. For compatible inputs, call `compare_artifacts` exactly once and map all 11 dimensions exactly once:

1. verdict to dedicated `verdict_delta`;
2. hard failures to dedicated `HardFailureDelta`;
3–10 to exactly one status partition;
11. evidence availability to dedicated `availability_summary_delta`, with optional per-metric details.

Assert lead and cut-in pairs show TTC improvement beside route/acceleration/jerk regressions, unchanged verdict, and descriptive interventions. Assert incompatible pairs have reasons but null dedicated deltas and empty partitions/details/charts. Recursively forbid winner/score fields.

**Step 2: Implement exact comparison mapping.**

Map, but never recompute, `ArtifactComparison`. Preserve measurement availability/reasons in `MeasurementDeltaValue`, hard-failure added/removed sets, comparison core order, explanations, side-qualified references, and chart eligibility. Do not introduce a UI winner or composite score.

**Step 3: Write failing CLI and import-bomb tests.**

Test:

- `review-artifact ... --artifact-root ... --format json|text`;
- `review-compare ... --artifact-root ... --format json|text`;
- every command selection is the exact relative string under `--artifact-root`; absolute,
  empty/`.`, traversal, repeated-separator, backslash, and alias inputs fail with CLI/API parity;
- valid PASS/CONDITIONAL/HOLD review operations exit 0;
- invalid evidence exits 30 with one canonical diagnostic result and no accepted stored PASS;
- incompatible/path/config/unsupported/review-unavailable errors exit 40;
- JSON stdout contains exactly one canonical document and no Rich banner/noise;
- text stdout neutralizes ANSI and all C0/C1 control characters from artifact-derived strings;
- CLI and public facade JSON are byte-equivalent;
- importing `hermes.cli`, invoking review commands, and importing `hermes.review` do not load `hermes.adapters`, `hermes.policies`, `hermes.runtime`, or `metadrive`;
- existing `run`, `sim-smoke`, `verify-artifact`, and `compare` behavior remains unchanged.

**Step 4: Lazy-load run-only and review-only dependencies.**

Move runtime, shield, comparison, and stored-verification imports into only the handlers that need them. Keep top-level CLI imports limited to general Typer/Rich/error/doctor/domain types. New review handlers import the public `hermes.review` API locally. Do not make existing command exits operation-oriented.

**Step 5: Run focused CLI/comparison/import tests.**

```bash
conda run -n hermes-dev python -m pytest -q \
  tests/unit/test_review_comparison.py \
  tests/cli/test_review_cli.py \
  tests/unit/test_architecture_boundaries.py \
  tests/cli/test_phase1_cli.py \
  tests/cli/test_cli_errors.py
conda run -n hermes-dev python -m ruff check src/hermes/cli.py src/hermes/review tests/cli/test_review_cli.py
```

Expected: review exits follow the operation contract; legacy exits retain verdict semantics; import bombs stay silent.

---

## Task 5: Add the optional local-only Streamlit workbench

**Files:**

- Modify: `pyproject.toml`
- Create: `src/hermes/workbench/__init__.py`
- Create: `src/hermes/workbench/launcher.py`
- Create: `src/hermes/workbench/app.py`
- Modify: `src/hermes/cli.py`
- Create: `tests/unit/test_workbench_launcher.py`
- Create: `tests/unit/test_workbench_projection.py`
- Create: `tests/integration/test_workbench_smoke.py`
- Modify: `tests/unit/test_architecture_boundaries.py`

**Step 1: Write failing launcher and architecture tests.**

Assert:

- `127.0.0.1`, another `127/8` literal, and `::1` are accepted;
- `0.0.0.0`, `::`, hostnames including `localhost`, LAN, link-local, and public addresses are rejected before process creation with exit 40;
- port must be 1–65535;
- generated Streamlit command/config disables usage stats, honors `--no-browser`, and binds only the validated literal;
- workbench modules import only standard library, Streamlit, and public `hermes.review`;
- no `unsafe_allow_html`, raw HTML, upload widget, write endpoint, run/policy/simulator controls, or approval/sign/promote/deploy action exists.

Run and capture RED:

```bash
conda run -n hermes-dev python -m pytest -q \
  tests/unit/test_workbench_launcher.py \
  tests/unit/test_architecture_boundaries.py
```

**Step 2: Add the optional dependency only.**

In `pyproject.toml`:

```toml
workbench = [
    "streamlit>=1.37,<2",
]
```

Do not add Streamlit to core dependencies.

**Step 3: Implement the loopback-only launcher, exact app handoff, and CLI command.**

Use `ipaddress.ip_address(host).is_loopback`; reject hostnames rather than resolving DNS. The
launcher validates and resolves the non-symlink artifact root through the public review-root
validator, resolves the installed absolute `src/hermes/workbench/app.py` path, and starts exactly:

```text
<sys.executable> -m streamlit run <absolute-app.py>
  --server.address <validated-loopback>
  --server.port <validated-port>
  --server.headless <true|false>
  --browser.gatherUsageStats false
  --
  --artifact-root <validated-absolute-real-root>
```

The app uses a strict `argparse` parser over only the arguments after Streamlit's `--`, rejects a
missing root, duplicates, unknown arguments, non-absolute paths, symlinks, and a root that no longer
matches facade validation, and has no cwd/environment/default-root fallback. Only the public facade
receives user selections. Make process creation injectable; any launcher or app-argument validation
failure happens before process/server creation. Unit tests assert the exact child argv and all
missing/duplicate/tampered cases. Keep generated cache/config/state outside artifact directories.

**Step 4: Write failing UI projection/render tests.**

Test view-model/render helpers without a browser:

- intake has no auto-selected newest artifact and no stored verdict before verification;
- mandatory trust strip displays text labels, not color alone;
- invalid is primary and contains no accepted stored PASS/findings/metrics/timeline/provenance;
- findings, metrics, sufficiency, timeline, provenance, and comparisons retain exact labels/units/operators/source references;
- pagination/filter/sort cannot mutate the immutable envelope or counts;
- HTML, script, Markdown links, SVG, ANSI escapes, and 1,025-character strings render as inert text with explicit truncation metadata;
- status has table/text equivalents and unavailable evidence is visibly distinct;
- comparison cannot hide regressions or produce a winner.

**Step 5: Implement the smallest six-screen Streamlit app.**

`app.py` consumes public review objects and projection helpers only. It revalidates the one strict
absolute root argument, accepts exact relative artifact selection by text entry only, never lists or
discovers run directories, never auto-selects any artifact, and offers no file upload. Render:

1. intake/verification;
2. review summary/trust strip;
3. findings/evidence coverage;
4. event/action timeline with deterministic paging;
5. provenance/integrity/limitations;
6. compatible comparison.

Use `st.text`, `st.write`, `st.dataframe`, and chart APIs with artifact strings treated as data. Never use `unsafe_allow_html=True` or interpolate artifact content into Markdown/HTML.

**Step 6: Install optional extra and run workbench tests.**

```bash
conda run -n hermes-dev python -m pip install -e '.[dev,workbench]'
conda run -n hermes-dev python -m pytest -q \
  tests/unit/test_workbench_launcher.py \
  tests/unit/test_workbench_projection.py \
  tests/integration/test_workbench_smoke.py \
  tests/unit/test_architecture_boundaries.py
conda run -n hermes-dev python -m ruff check src/hermes/workbench tests/unit/test_workbench_*.py
```

**Step 7: Checkpoint commit after full regression.**

Run full tests/Ruff/diff checks, stage only reviewed Task 4–5 files, inspect cached diff, then commit:

```bash
git add \
  pyproject.toml src/hermes/cli.py src/hermes/cli_errors.py \
  src/hermes/review src/hermes/workbench \
  tests/unit/test_architecture_boundaries.py tests/unit/test_comparison.py \
  tests/unit/test_review_comparison.py \
  tests/unit/test_workbench_launcher.py tests/unit/test_workbench_projection.py \
  tests/cli/test_review_cli.py tests/integration/test_workbench_smoke.py
git diff --cached --check
git diff --cached --stat
git commit -m "feat: add local read-only evidence workbench"
```

---

## Task 6: Execute the adversarial review and close validated P0/P1 findings

**Files:**

- Create: `PHASE6_ADVERSARIAL_REVIEW.md`
- Create or modify: targeted tests under `tests/unit/`, `tests/cli/`, and `tests/integration/`
- Modify: production files only for reproduced, in-scope P0/P1 fixes

**Step 1: Review before rewriting.**

Use `prompts/03_ADVERSARIAL_REVIEW.md` as the checklist. Inspect implementation and attempt to reproduce parallel authority, stale state, traversal/symlinks, directory replacement, artifact writes, invalid stored PASS, schema confusion, hidden unavailable evidence, threshold rounding, XSS/content injection, resource exhaustion, comparison cherry-picking, public bind, and simulator imports.

Record each candidate with severity, exact reproduction, observed evidence, expected fail-closed behavior, and initial status in `PHASE6_ADVERSARIAL_REVIEW.md` before editing production code.

**Step 2: For every validated P0/P1, add a failing regression test first.**

Run the narrow test and confirm RED for the expected reason—not syntax/import/setup failure. Then implement the smallest fix without expanding scope or weakening the existing core.

**Step 3: Run the complete negative matrix.**

At minimum cover:

- traversal, absolute paths, symlink root/directory/file, directory swap, and mutation during capture;
- missing/extra files, mixed/unsupported schema, malformed/duplicate/reordered events;
- stored PASS with corrupt trace/digests and modified metrics/findings/verdict;
- stale cache after replacement and metadata-only touch behavior;
- HTML/script/Markdown/SVG/ANSI/long text;
- exact below/equal/above threshold presentation;
- required/optional/not-applicable unavailable states;
- incompatible comparisons and mixed trade-offs;
- core size/event/line bounds and operational projection bounds;
- no artifact-byte changes through facade, CLI, or workbench harness;
- loopback rejection and no simulator/runtime imports or launches.

**Step 4: Update closure status and checkpoint.**

Every P0 must be closed. Every P1 must be closed or explicitly accepted with rationale, owner, and limitation. Run full tests/Ruff/doctor/diff checks and commit:

```bash
git status --short
git diff --name-only <task-6-base>..HEAD
git diff --name-only
# Review both lists, then run one explicit git add command naming only each validated
# Task 6 production/test path plus PHASE6_ADVERSARIAL_REVIEW.md. Never add a test directory.
git diff --cached --check
git diff --cached --stat
git commit -m "test: harden workbench trust boundaries"
```

The explicit Task 6 allowlist is derived from the documented reproduced findings because exact
regression filenames are not known until review. It may include only `PHASE6_ADVERSARIAL_REVIEW.md`,
the already declared Phase 6 production files, and individually named Phase 6 test files inspected
in the Task 6 review package. Whole-directory `git add` and unrelated pre-existing paths are
forbidden.

---

## Task 7: Final validation, demonstrations, documentation, and clean local handoff

**Files:**

- Modify: `README.md`
- Modify: `PROJECT_BRIEF.md`
- Modify: `BUILD_PLAN.md`
- Modify: `CURRENT_STATE_HANDOFF.md`
- Modify: `VALIDATION_MATRIX.md`
- Modify: `README_PHASE6_DRAFT.md` if retained
- Modify: `docs/PHASE6_ARCHITECTURE_AND_TRUST_MODEL.md`
- Modify: `docs/PHASE6_REVIEW_ENVELOPE_CONTRACT.md` only for implementation-conforming clarifications
- Modify: `docs/PHASE6_UX_INFORMATION_ARCHITECTURE.md`
- Modify: `docs/PHASE6_THREAT_MODEL.md`
- Modify: `docs/PHASE6_REQUIREMENTS_TRACEABILITY.md`
- Modify: `docs/PHASE6_DEMO_RUNBOOK.md`
- Modify: `docs/decision-log.md`
- Modify: `CODEX_HANDOFF.md`
- Modify: `PHASE6_DESIGN_FREEZE_HANDOFF.md` only if final status reconciliation requires it

**Step 1: Run final install and gates from the correct environment.**

```bash
conda run -n hermes-dev python -m pip install -e '.[dev,workbench]'
conda run -n hermes-dev python -m pytest -q
conda run -n hermes-dev python -m pytest -q -m 'not metadrive'
conda run -n hermes-dev python -m ruff check .
conda run -n hermes-dev python -m hermes doctor
git diff --check
```

Record exact outputs/counts; never reuse the historical 273 count after the suite changes.

**Step 2: Demonstrate exact review cases without writing source artifacts.**

Run JSON and selected text views for:

- `handoff-phase5-demo` PASS;
- `handoff-p1-conditional` CONDITIONAL;
- `handoff-p1-collision` and boundary HOLD;
- `phase1-tampered` INVALID_EVIDENCE / 30 with stored PASS quarantined;
- `handoff-p2-metadrive` PASS without simulator execution;
- lead and cut-in compatible mixed comparisons;
- `handoff-p4-fault` HOLD with passing fault coverage;
- one incompatible valid comparison / 40.

Capture exact envelope digests, exits, key trust fields, and mixed dimension summaries in `CODEX_HANDOFF.md`.

**Step 3: Smoke the local launcher safely.**

Start with no browser on an unused loopback port, confirm a listener only on the requested loopback address, exercise the supported Streamlit smoke/test harness, then terminate it cleanly. Also demonstrate `0.0.0.0`, `::`, `localhost`, and a non-loopback address fail before server startup. Do not claim manual visual QA unless the UI was actually inspected.

**Step 4: Prove immutability and import isolation.**

Hash every file of the representative source bundles before and after core/CLI/workbench demonstrations; require byte identity. Run the process-level import bomb for review commands and record that adapters/policies/runtime/MetaDrive were absent.

**Step 5: Reconcile documentation and handoff from actual results.**

Use `CODEX_HANDOFF_TEMPLATE.md`. Include exact branch/commits, architecture, optional dependency, commands, test counts, artifact paths/digests, negative results, launcher command, scope/trust boundaries, unresolved P1/P2, no-remote statement, and next recommendation. Do not rewrite validated Phase 0–5 history or claim authenticity/approval/deployment permission.

**Step 6: Independent final review and final local commit.**

Request a fresh spec-compliance and code-quality review. Fix any validated in-scope blocker with a regression test and rerun affected/full gates. Inspect staging:

```bash
git status --short
git add README.md PROJECT_BRIEF.md BUILD_PLAN.md CURRENT_STATE_HANDOFF.md \
  VALIDATION_MATRIX.md README_PHASE6_DRAFT.md CODEX_HANDOFF.md \
  PHASE6_ADVERSARIAL_REVIEW.md PHASE6_DESIGN_FREEZE_HANDOFF.md \
  docs/PHASE6_ARCHITECTURE_AND_TRUST_MODEL.md \
  docs/PHASE6_REVIEW_ENVELOPE_CONTRACT.md \
  docs/PHASE6_UX_INFORMATION_ARCHITECTURE.md \
  docs/PHASE6_THREAT_MODEL.md docs/PHASE6_REQUIREMENTS_TRACEABILITY.md \
  docs/PHASE6_DEMO_RUNBOOK.md docs/decision-log.md
git diff --cached --check
git diff --cached --stat
```

Commit only when all required gates pass:

```bash
git commit -m "docs: finalize Phase 6 validation and handoff"
```

The implementation plan under `docs/superpowers/plans/` is intentionally tracked once in the Task
1–3 checkpoint. Never stage the git-ignored `.superpowers/sdd/` workspace, generated outputs,
caches, package metadata, artifacts, or unrelated user files. The final documentation allowlist
above stages only paths that actually changed; omit unchanged paths rather than manufacturing edits.

Then rerun `git status --short`, `git log --oneline --decorate -8`, `python -m hermes doctor`, and `git diff --check`. Leave the branch local, clean, unpushed, undeployed, and ready for user review.

**Final launch command to report:**

```bash
conda run -n hermes-dev hermes workbench \
  --artifact-root artifacts \
  --host 127.0.0.1 \
  --port 8501 \
  --no-browser
```

**Next-phase recommendation:** conduct the separately scoped authenticity design review before any multi-user, approval, promotion, or externally authoritative workflow.
