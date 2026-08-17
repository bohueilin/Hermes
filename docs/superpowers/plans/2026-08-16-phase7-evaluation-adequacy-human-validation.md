# Hermes Phase 7 Evaluation Adequacy and Human Validation Implementation Plan

> **For Codex:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to execute this plan task-by-task in this chat. Apply superpowers:test-driven-development for every behavior change, superpowers:requesting-code-review after every task, and superpowers:verification-before-completion before each checkpoint or completion claim.

**Goal:** Add a stored-evidence-only declared-question adequacy assessment and repair the human-validation instrument without changing Hermes release-gate decisions, canonical review/comparison schemas, or simulation-only authority boundaries.

**Architecture:** Add strict, framework-independent `hermes.adequacy` models, plan capture, a single-pass pure assessor, and one public application service. Reuse the existing review facade's immutable one-capture verification and structural comparison, then invoke a separately bounded `hermes.provenance.git` inspector only after valid/compatible evidence and valid plans. Expose the result through a lazy local CLI. Separately generate the forced one-event availability fixture and version the human-study instrument; no workbench adequacy surface and no human-outcome promotion are included.

**Tech stack:** Python 3.11, Pydantic 2 strict/frozen models, PyYAML strict loading, Typer/Rich CLI, stdlib descriptor-relative I/O, stdlib bounded `subprocess.Popen`, pytest, Ruff, existing fake adapter, pinned headless MetaDrive 0.4.3.

**Frozen source of truth:** `PHASE7_EVALUATION_ADEQUACY_AND_HUMAN_VALIDATION_DESIGN.md` and `PHASE7_CLAUDE_FEEDBACK_DISPOSITION.md` at approved design commit `4eb87654f79654843169d00a656dd2c6f8092de4`.

**Clean baseline:** isolated branch `codex/phase7-evaluation-adequacy-human-validation`; 756 tests passing; Ruff passing; doctor 18 PASS and 1 optional `NOT_AVAILABLE`; no tracked changes; ignored retained bundles copied locally; pinned MetaDrive checkout linked read-only; no remote action.

**Non-negotiable invariants:** Adequacy is a claim precondition, not a release gate, verifier, winner score, safety claim, approval, or deployment permission. Every artifact side is freshly captured exactly once. Invalid evidence returns baseline-first quarantine before plan or Git access. Incompatibility returns before plan or Git access. Criteria status, local-history ordering, and interpretation remain independent. Local history is rewritable and `NOT_AUTHENTICATED`. No adequacy import enters gates, verifiers, adapters, policies, shields, faults, runtime, or workbench. No generated bundle is staged. No main-cohort or favorable human-comprehension claim is created without real participants.

**Commit discipline for every task:** Before each listed commit, stage only the task's exact reviewed
allowlist, then run and inspect all four commands below. The staged-name list must contain no ignored
artifact, cache, generated environment, user-owned root prompt, or unrelated concurrent change.

```bash
git status --short
git diff --cached --name-only
git diff --cached --check
git diff --cached --stat
```

The pair-plan freeze adds the stronger requirement that the index contains exactly its three named
additions, no rename/copy, and its sole parent is the protocol-registration commit.

---

## Task 1: Freeze strict adequacy contracts and canonical serialization

**Files:**

- Create: `src/hermes/adequacy/__init__.py`
- Create: `src/hermes/adequacy/models.py`
- Create: `tests/unit/test_adequacy_models.py`
- Modify: `tests/unit/test_architecture_boundaries.py`

### Step 1: Write the model RED

- [ ] Add strict/frozen tests for protocol, discovery entry, pair plan, captured source identity, reduced side/event facts, registration evidence, criterion records, adequacy assessment, and `EvaluationAdequacyEnvelope` 1.0.
- [ ] Assert `extra="forbid"`, strict finite numbers, exact enums/literals, ordered tuples, no absolute paths/filesystem metadata/timestamps/session IDs, and canonical JSON determinism.
- [ ] Assert aggregation cross-product: `FAIL > NOT_AVAILABLE > PASS`; all-pass always means `ADEQUATE`; registration changes interpretation only; invalid/incompatible mean null assessment plus `NO_INTERPRETATION`.
- [ ] Assert every positive local-ordering record is still `NOT_AUTHENTICATED` and carries exactly `Rewritable local history; no external timestamp.`
- [ ] Assert package `__init__.py` is documentation-only and importing `adequacy.models` succeeds while `subprocess` and `hermes.provenance.git` are bombed.

Run:

```bash
conda run -n hermes-dev python -m pytest -q \
  tests/unit/test_adequacy_models.py \
  tests/unit/test_architecture_boundaries.py -k 'adequacy or provenance'
```

Expected RED: `hermes.adequacy` does not exist.

### Step 2: Implement only the immutable contracts

- [ ] Use one private Pydantic base with `extra="forbid"`, `frozen=True`, `strict=True`, and `allow_inf_nan=False`.
- [ ] Keep protocol/ledger/pair-plan source models distinct from captured source identity.
- [ ] Model reduced assessment inputs inside adequacy; pure code must not import `VerifiedArtifactSnapshot` or review projection models.
- [ ] Define exact `AdequacyStatus`, `RegistrationStatus`, `Interpretation`, criterion status, observation disposition, and plan-evaluation states.
- [ ] Provide a canonical UTF-8 serializer using the existing canonical JSON primitive without changing review/comparison serializers.
- [ ] Keep both package initializers side-effect-free; no eager public API export.

### Step 3: Verify and commit

```bash
conda run -n hermes-dev python -m pytest -q \
  tests/unit/test_adequacy_models.py \
  tests/unit/test_architecture_boundaries.py -k 'adequacy or provenance'
conda run -n hermes-dev python -m ruff check \
  src/hermes/adequacy tests/unit/test_adequacy_models.py \
  tests/unit/test_architecture_boundaries.py
git diff --check
```

Expected: GREEN with no source imports outside the approved direction.

Commit: `feat: add Phase 7 adequacy contracts`

---

## Task 2: Add bounded, strict, no-follow plan capture and parsing

**Files:**

- Create: `src/hermes/adequacy/loader.py`
- Create: `tests/unit/test_adequacy_loader.py`
- Modify: `tests/unit/test_architecture_boundaries.py`

### Step 1: Write capture/parser REDs

- [ ] Test a real canonical plan root plus exact protocol, ledger, and pair selections captured in protocol → ledger → pair order without directory scans.
- [ ] Reject empty, `.`, absolute, root-prefixed, repeated-separator, backslash, NUL, `..`, symlink root/selection/intermediate, root replacement, directory swap, and mutation-during-capture cases.
- [ ] Reject duplicate YAML/JSON keys, YAML aliases/tags/implicit dates, UTF-8 BOM, noncanonical JSONL, unknown fields/schema/claim/role/challenge, nonfinite or huge scalars, oversized file/total/record, and cross-record digest/config/threshold contradictions.
- [ ] Assert captured byte digest and semantic digest are deterministic and public callers cannot pass parsed plans or source bytes.

Run:

```bash
conda run -n hermes-dev python -m pytest -q tests/unit/test_adequacy_loader.py
```

Expected RED: loader/capture API is missing.

### Step 2: Implement the minimal plan boundary

- [ ] Freeze and export these v1 resource constants, derived from three expected sub-100-KiB local
  records with at least a tenfold safety margin: `MAX_PLAN_FILE_BYTES = 1 * 1024 * 1024`,
  `MAX_PLAN_TOTAL_BYTES = 3 * 1024 * 1024`, `MAX_PLAN_LINE_BYTES = 64 * 1024`,
  `MAX_DISCOVERY_ATTEMPTS = 1024`, and `MAX_PLAN_STRING_SCALARS = 4096`. Test each exact boundary
  and boundary-plus-one; changing a limit requires a contract/test update.
- [ ] Implement `validate_plan_root`, one exact lexical-selection validator, descriptor-relative `O_NOFOLLOW` traversal, bounded read, metadata-before/after mutation checks, and immutable source identity.
- [ ] Reuse only the strict YAML primitive where safe; keep Phase 7 validation in this loader.
- [ ] Parse JSONL one canonical object per bounded line, require deterministic attempt order and uniqueness, and calculate source-byte/semantic/selection-evidence digests.
- [ ] Normalize raw YAML/JSON/Pydantic/OS exceptions into one typed invalid-plan error; do not leak low-level exceptions.
- [ ] Do not import review, provenance, subprocess, simulator, runtime, gates, or shields.

### Step 3: Verify and commit

```bash
conda run -n hermes-dev python -m pytest -q \
  tests/unit/test_adequacy_loader.py \
  tests/unit/test_adequacy_models.py
conda run -n hermes-dev python -m ruff check \
  src/hermes/adequacy/loader.py tests/unit/test_adequacy_loader.py
git diff --check
```

Commit: `feat: add strict adequacy plan capture`

---

## Task 3: Implement the pure one-pass lead-TTC assessor

**Files:**

- Create: `src/hermes/adequacy/assessment.py`
- Create: `tests/unit/test_adequacy_assessment.py`
- Modify: `tests/unit/test_architecture_boundaries.py`

### Step 1: Write semantic REDs

- [ ] Build adequacy-owned typed fixtures for the retained lead negative control and synthetic edge cases; do not read artifacts inside pure unit tests.
- [ ] Assert `c`, `d`, `p`, `e`, and `q` exactly, including sequence 30 `PRE_TRIGGER` and first possible `BRAKING` input at 31.
- [ ] Assert missing front signals are `NOT_AVAILABLE`, present nonclosing input is available `FAIL`, and absent `c`/`d` keeps prefix/confound scans nonempty according to frozen endpoints.
- [ ] Separate condition exposure, reason-only, same-binary32 action, material target response, and target/non-target co-occurrence into exact observation dispositions.
- [ ] Recompute speed, staleness, boundary, emergency-stop, and delay predicates through `e`; require delay compensation exactly `0.0`.
- [ ] Assert missing baseline counterpart at defined `c`/`d` is an available arm-alignment `FAIL`, not operational/unavailable.
- [ ] Assert unfavorable metrics/verdict do not affect adequacy.
- [ ] Assert one monotonic scan visits at most `B + C`, emits bounded representative references, and stays exact at 10,000 events per side.

Run:

```bash
conda run -n hermes-dev python -m pytest -q tests/unit/test_adequacy_assessment.py
```

Expected RED: pure assessor is missing.

### Step 2: Implement the minimal scanner

- [ ] Implement local deterministic IEEE-754 binary32 normalization with `struct`; do not import shield code.
- [ ] Compute input TTC only from named policy-input distance and relative speed.
- [ ] Use one increasing index per side; no sorting, rescans, cross product, or aggregate-per-event reference joins.
- [ ] Return ordered typed criteria with exact machine/canonical/display values, units, rules, rationale, sequence references, total counts, and bounded representative references.
- [ ] Apply criterion precedence independently from registration and interpretation.
- [ ] Keep pure code free of I/O, Git, `subprocess`, review/evidence verification, gates, runtime, adapters, policies, shields, and faults.

### Step 3: Verify and commit

```bash
conda run -n hermes-dev python -m pytest -q \
  tests/unit/test_adequacy_assessment.py \
  tests/unit/test_adequacy_models.py
conda run -n hermes-dev python -m ruff check \
  src/hermes/adequacy/assessment.py tests/unit/test_adequacy_assessment.py
git diff --check
```

Commit: `feat: assess declared lead TTC adequacy`

---

## Task 4: Reuse the review facade's exact current captures

**Files:**

- Modify: `src/hermes/review/facade.py`
- Create: `tests/unit/test_review_adequacy.py`
- Modify: `tests/unit/test_review_facade.py`
- Modify: `tests/unit/test_review_comparison.py`

### Step 1: Write one-capture/failure-precedence REDs

- [ ] Add a private pair result that holds baseline/candidate `_ReviewedArtifact` plus the existing core comparison; it is not exported from `hermes.review`.
- [ ] Assert baseline and candidate each call `_review_result` once, never reopen, and baseline-first invalid result returns before comparison.
- [ ] Assert candidate invalid is returned only after one valid baseline capture; both invalid returns baseline.
- [ ] Assert valid incompatible evidence returns the existing comparison without plan/Git responsibilities.
- [ ] Assert current public review/compare models and canonical bytes are unchanged.

Run:

```bash
conda run -n hermes-dev python -m pytest -q \
  tests/unit/test_review_adequacy.py \
  tests/unit/test_review_facade.py \
  tests/unit/test_review_comparison.py
```

Expected RED: private captured-pair orchestration is missing.

### Step 2: Implement the narrow private seam

- [ ] Extract only enough private orchestration to reuse current `_InspectionCapture` snapshots and `compare_artifacts` once.
- [ ] Preserve current caches, fresh-capture identity, invalid quarantine, projected public API, and unbounded-cache P2 decision.
- [ ] Do not import adequacy or provenance from review.
- [ ] Do not edit `review/models.py`, `review/projection.py`, or `review/__init__.py`.

### Step 3: Verify and commit

```bash
conda run -n hermes-dev python -m pytest -q \
  tests/unit/test_review_adequacy.py \
  tests/unit/test_review_facade.py \
  tests/unit/test_review_comparison.py \
  tests/integration/test_review_artifacts.py
conda run -n hermes-dev python -m ruff check \
  src/hermes/review/facade.py tests/unit/test_review_adequacy.py
git diff --check
```

Commit: `refactor: expose private current review pair`

---

## Task 5: Add the bounded local Git registration boundary

**Files:**

- Create: `src/hermes/provenance/__init__.py`
- Create: `src/hermes/provenance/git.py`
- Create: `tests/unit/test_provenance_git.py`
- Modify: `tests/unit/test_architecture_boundaries.py`

### Step 1: Write process-boundary REDs

- [ ] Test a temporary Git repository with protocol commit followed by a direct sole-parent pair-plan commit changing exactly ledger, pair, and selected scenario.
- [ ] Assert exact file-at-commit bytes, ancestry, parents, three-path diff, discovery commit strings, primary shared commit strings, and clean registration paths establish `LOCAL_HISTORY_ORDERING_VERIFIED` while authenticity remains false.
- [ ] Assert wrong repository, missing commit/path, divergent history, merge/multiple parent, protocol-after-discovery, dirty registration paths, unexpected change/path/status, and content mismatch return `REGISTRATION_NOT_ESTABLISHED` without changing criteria.
- [ ] Assert exact fixed argv/env/cwd, resolved executable once, no shell/hooks/network/writes/replace refs, five-second deadline, one-MiB stdout+stderr cap, terminate-then-kill, and no unbounded `subprocess.run(capture_output=True)`.
- [ ] Assert NUL byte parsing rejects rename/copy, unknown status, malformed arity, newline/tab/leading-dash ambiguity, timeout, cap breach, missing executable, and malformed Git responses with typed operational failure.

Run:

```bash
conda run -n hermes-dev python -m pytest -q tests/unit/test_provenance_git.py
```

Expected RED: provenance package is missing.

### Step 2: Implement command-specific inspection

- [ ] Keep `provenance.__init__` documentation-only.
- [ ] Resolve one trusted Git executable immediately before first use.
- [ ] Implement only fixed `rev-parse`, `show`, `rev-list --parents -n 1`, `diff-tree --no-commit-id -r --name-status -z`, `merge-base --is-ancestor`, and `status --porcelain=v1 -z --untracked-files=all` operations.
- [ ] Read bounded chunks through `Popen`; compare bytes rather than commit timestamps.
- [ ] Return immutable registration evidence for historical non-establishment; raise one typed operational error only for unsafe execution/parsing.
- [ ] Do not modify or consolidate doctor/runtime/MetaDrive Git helpers.

### Step 3: Verify and commit

```bash
conda run -n hermes-dev python -m pytest -q \
  tests/unit/test_provenance_git.py \
  tests/unit/test_architecture_boundaries.py -k 'provenance or subprocess or workbench'
conda run -n hermes-dev python -m ruff check \
  src/hermes/provenance tests/unit/test_provenance_git.py \
  tests/unit/test_architecture_boundaries.py
git diff --check
```

Commit: `feat: verify bounded local registration ordering`

---

## Task 5A: Freeze fresh-selection derivation before public composition

This checkpoint closes an implementation-discovered design gap: no canonical bundle stores fresh
selection observations, so they must never be copied or invented by the API. The protocol owns the
derivation and the pure scanner computes it in its existing baseline pass.

**Files:**

- Modify: `PHASE7_EVALUATION_ADEQUACY_AND_HUMAN_VALIDATION_DESIGN.md`
- Modify: `src/hermes/adequacy/models.py`
- Modify: `src/hermes/adequacy/loader.py`
- Modify: `src/hermes/adequacy/assessment.py`
- Modify: `tests/unit/test_adequacy_models.py`
- Modify: `tests/unit/test_adequacy_loader.py`
- Modify: `tests/unit/test_adequacy_assessment.py`
- Modify: `tests/unit/test_architecture_boundaries.py`

### Step 1: Write contract and derivation REDs

- [ ] Add one strict protocol-owned v1 `selection_evidence` definition covering event domain,
  required signals, closing/value expressions, aggregation, tie-break, unit/operator/threshold
  source, source file, and exact pointers.
- [ ] Remove synthetic `fresh_selection_observations` and `fresh_selection_evidence_sha256` from
  `AssessmentSide`; prove extra fields are rejected.
- [ ] Add a strict typed selection-evidence result that distinguishes numeric observed,
  available-no-finite-closing, and required-signal-missing states. Require valid/selected discovery
  attempts to carry the numeric state and expose `SELECTION_EVIDENCE_AVAILABLE` plus
  `SELECTION_EVIDENCE_OBSERVED` and `SELECTION_EVIDENCE_THRESHOLD_MATCHED` to ordered
  validity/exclusion rules; observed values above the declared LTE threshold cannot be selected.
- [ ] Derive minimum finite closing TTC over all BRAKING baseline inputs with earliest-sequence tie
  break; missing paired signals are `NOT_AVAILABLE`, while available nonclosing/no-finite-TTC is an
  available reproduction `FAIL`.
- [ ] Freeze the exact missing-signal reason and source pointers including `/sequence`; RED mixed
  missing-plus-finite inputs (missing remains sticky), non-null earliest-sequence ties, and finite
  input division overflow (available no-finite result, never nonfinite JSON).
- [ ] Prove typed selection-result/digest exact match, value/sequence/status/outcome/digest mismatch,
  empty selected-observed evidence rejection, and no second baseline scan at the 10,000-event
  boundary.

### Step 2: Implement the narrow correction

- [ ] Keep derivation in pure `assessment.py`; API/review/loader cannot derive artifact facts.
- [ ] Compute SHA-256 over canonical JSON for the complete typed selection-evidence result using
  the frozen adequacy canonical primitive; typed empty states must have distinct digests.
- [ ] Extend the existing scan result with private derived evidence; do not add plan/Git authority or
  change the public Phase 6 review/comparison schemas.
- [ ] Preserve the existing scanner-only `assess_lead_ttc_adequacy`; add the pair-aware pure helper
  in Task 6 after plan/run identities are available.

### Step 3: Verify and commit

```bash
conda run -n hermes-dev python -m pytest -q \
  tests/unit/test_adequacy_models.py \
  tests/unit/test_adequacy_loader.py \
  tests/unit/test_adequacy_assessment.py \
  tests/unit/test_architecture_boundaries.py -k 'adequacy or provenance'
conda run -n hermes-dev python -m ruff check \
  src/hermes/adequacy tests/unit/test_adequacy_models.py \
  tests/unit/test_adequacy_loader.py tests/unit/test_adequacy_assessment.py
git diff --check
```

Commit: `fix: derive fresh selection evidence from stored events`

---

## Task 5B: Correct the captured-versus-declared adequacy boundary

**Files:**

- Modify: `PHASE7_EVALUATION_ADEQUACY_AND_HUMAN_VALIDATION_DESIGN.md`
- Modify: `docs/superpowers/plans/2026-08-16-phase7-evaluation-adequacy-human-validation.md`

### Step 1: Freeze the pre-API correction

- [ ] Keep strict protocol/pair-plan expectations separate from permissive immutable captured
  facts; a valid observed mismatch must reach a criterion rather than fail plan-shaped validation.
- [ ] Make public side state safe and event-free, with requested locator, run/schema identity,
  observed/computed bundle and trace roots, trust planes, and diagnostics.
- [ ] Freeze adequacy-owned captured repository, component, simulator, scenario, shield/config,
  execution, and scanner-side records; do not substitute declared configuration for absent captured
  configuration.
- [ ] Preserve valid schema-1 fake/cut-in/role/config mismatches as completed `FAIL` or
  `NOT_AVAILABLE`; reserve unsupported-shape exit 40 for schema/event structures V1 cannot map.
- [ ] Separate pure non-I/O syntax screening from the existing authoritative artifact, plan, and
  repository boundary checks and freeze combined-failure precedence.

### Step 2: Review and commit

- [ ] Obtain independent semantic review before Task 6 code begins.
- [ ] Commit only the two design/plan files.

Commit: `docs: separate observed adequacy facts from plan expectations`

---

## Task 6: Compose the public adequacy API with frozen failure precedence

**Files:**

- Create: `src/hermes/adequacy/api.py`
- Create: `tests/unit/test_adequacy_api.py`
- Modify: `src/hermes/adequacy/models.py`
- Modify: `src/hermes/adequacy/assessment.py`
- Modify: `tests/unit/test_adequacy_models.py`
- Modify: `tests/unit/test_adequacy_assessment.py`
- Modify: `tests/unit/test_review_adequacy.py`
- Modify: `tests/unit/test_architecture_boundaries.py`

### Step 1: Write application-service REDs

- [ ] Assert the exact eight-argument public API and no inspector/result/parsed-plan/capture/snapshot injection seam.
- [ ] Assert pure non-I/O lexical screening of all eight arguments → baseline capture → candidate
  capture → incompatibility → protocol/ledger/pair capture → captured-fact mapping → Git once →
  pure assessment.
- [ ] Assert invalid baseline/candidate/both produce safe identity, null plan fields with `PLAN_NOT_EVALUATED`, no criteria, no plan read, no Git, and exit-30 semantics.
- [ ] Assert incompatibility produces reasons, null plan fields, no criteria, no plan read/Git, and exit-40 semantics.
- [ ] Assert invalid plan and unsupported evidence schema/event structure perform no Git and
  normalize to typed exit-40 outcomes; valid schema-1 fake/cut-in/role/config mismatches remain
  completed criterion results.
- [ ] Assert Git operational errors occur only after valid/compatible sides and valid plans.
- [ ] Assert artifact-vs-plan identity mismatch becomes completed available criterion `FAIL`/exit 0; registration non-establishment does not alter criteria.
- [ ] Assert the pure pair helper emits deterministic run-ID, shared primary repository-commit,
  execution, component, baseline-shield, and fresh-selection-reproduction criteria before the
  existing eleven scanner criteria. It must not compare the primary pair-plan commit to the earlier
  `implementation_base_commit`.
- [ ] Assert the exact 17 IDs/order frozen in the design. For the first six rows, test every named
  input group and `FAIL > NOT_AVAILABLE > PASS` precedence: shared nonhex primary commit, dirty
  `None`/`True`, nullable fake simulator tuple, challenge mismatch, baseline shield digest, and all
  three fresh-selection outcomes/digest bindings.
- [ ] Assert missing or unequal primary repository commits remain existing incompatibility with no
  plan/criteria/Git; only a shared available nonhex string reaches repository-identity `FAIL`.
- [ ] Assert snapshot-to-adequacy mapping copies only typed stored facts and does not mutate source models.
- [ ] Assert public `SideReviewState` is event-free and retains exact safe run/schema/digest/trust
  state for invalid and incompatible output; requested plan selections are always present and the
  plan-not-evaluated reason is typed.
- [ ] Assert exact `RequestedPlanSelections`, `SideIdentity`, and envelope
  `plan_evaluation_reason` field types/cross-products, including UNVERIFIED all-null, consistent
  four-root equality, invalid partial-root retention, evaluated-null-reason, and exact invalid vs
  incompatible reasons.
- [ ] Assert missing/nonhex repository provenance, dirty `None`/`True`, fake simulator absence,
  cut-in/no challenge, swapped shield roles, and runtime-valid nonzero delay become the frozen
  compatibility or criterion outcomes—never plan-model construction errors.
- [ ] Assert absent captured candidate configuration is never replaced by the declared config;
  assert exact `c/d/p/q/e`, `EVIDENCE_NOT_AVAILABLE`, and every row in the frozen override matrix,
  including the ordinary never-unavailable intervention/count rows becoming `NOT_AVAILABLE` under
  this explicit override.
- [ ] Assert fake/no-challenge and cut-in phases are representable: with captured candidate config
  present, zero BRAKING samples and absent target condition are available `FAIL`; only missing
  paired inputs on a BRAKING event create required-signal `NOT_AVAILABLE`; absent candidate config
  follows the explicit override matrix.
- [ ] Assert exact captured phase mapping: fake `None`; lead PRE_TRIGGER/BRAKING/RECOVERY; cut-in
  PRE_TRIGGER/CUT_IN/POST_CUT_IN. A cut-in PRE_TRIGGER prefix must complete criteria, never produce
  unsupported-shape exit 40.
- [ ] Assert malformed syntax wins before capture; invalid baseline wins over defective plan/repo
  roots; incompatibility wins over plan/repo filesystem defects; invalid plan wins over unavailable
  Git; and valid flow resolves Git once immediately before use.
- [ ] Assert API roots accept only absolute normalized `Path` spellings, CLI-relative normalization
  remains deferred to Task 7, Cc/Cf/NUL and noncanonical roots fail `INVALID_REQUEST`, and the pure
  lexical screen performs no filesystem/Git/executable operation.

Run:

```bash
conda run -n hermes-dev python -m pytest -q \
  tests/unit/test_adequacy_api.py \
  tests/unit/test_review_adequacy.py
```

Expected RED: public application service is missing.

### Step 2: Implement the sole production composition root

- [ ] Public import remains `from hermes.adequacy.api import assess_review_pair_adequacy`.
- [ ] Construct the existing private review facade and concrete Git inspector internally; pass only immutable reduced facts to pure assessment.
- [ ] Keep strict declared expectation types unchanged; add separate adequacy-owned captured types
  and a scanner-only reduction rather than reusing plan validators on stored observations.
- [ ] Keep every identity/reproduction comparison in a pure assessment helper accepting only
  adequacy-owned protocol/ledger/pair/side models; `api.py` only maps and orders operations.
- [ ] Keep fake registration injection only in a non-public pure helper for tests.
- [ ] Define only `AdequacyServiceError` plus the exhaustive `INVALID_REQUEST`, `INVALID_PLAN`,
  `UNSUPPORTED_EVIDENCE_SHAPE`, and `OPERATIONAL_FAILURE` kinds; raw dependency exceptions never
  escape and every kind carries exit code 40.
- [ ] Return one `EvaluationAdequacyEnvelope` for invalid, incompatible, or completed outcomes; normalize invalid-plan, unsupported-shape, and operational exceptions into typed service errors.
- [ ] Preserve gate/integrity/authenticity/authorization/deployment/scope/authoritative-status fields exactly.

### Step 3: Verify and commit

```bash
conda run -n hermes-dev python -m pytest -q \
  tests/unit/test_adequacy_api.py \
  tests/unit/test_adequacy_models.py \
  tests/unit/test_review_adequacy.py \
  tests/unit/test_adequacy_assessment.py \
  tests/unit/test_adequacy_loader.py \
  tests/unit/test_provenance_git.py \
  tests/unit/test_architecture_boundaries.py
conda run -n hermes-dev python -m ruff check \
  src/hermes/adequacy src/hermes/provenance \
  tests/unit/test_adequacy_api.py tests/unit/test_adequacy_models.py \
  tests/unit/test_adequacy_assessment.py tests/unit/test_review_adequacy.py \
  tests/unit/test_architecture_boundaries.py
git diff --check
```

Commit: `feat: compose stored evidence adequacy service`

---

## Task 7: Add CLI parity and the fixed non-causality presentation boundary

**Files:**

- Modify: `src/hermes/cli.py`
- Modify: `src/hermes/workbench/app.py`
- Create: `tests/cli/test_adequacy_cli.py`
- Modify: `tests/cli/test_review_cli.py`
- Modify: `tests/unit/test_workbench_projection.py`
- Modify: `tests/integration/test_workbench_smoke.py`
- Modify: `tests/unit/test_architecture_boundaries.py`

### Step 1: Write CLI/presentation REDs

- [ ] Test `hermes assess-adequacy BASELINE CANDIDATE` with explicit repository/artifact/plan roots and exact protocol/ledger/pair selections.
- [ ] Assert completed `ADEQUATE`, `INADEQUATE`, and `NOT_AVAILABLE` all exit 0; invalid stored evidence exits 30; incompatible/invalid plan/unsupported/operational exit 40.
- [ ] Assert JSON is one canonical full envelope exactly equal to API bytes; text uses existing Cc/Cf neutralization, 1,024-input-scalar bounds, explicit truncation/original length, and never implies gate pass/safety/registration/deployment.
- [ ] Bomb runtime/adapters/policies/MetaDrive/workbench imports during the lazy command path.
- [ ] Assert existing `review-compare` JSON bytes remain unchanged.
- [ ] Assert CLI and workbench show `Stored deltas are descriptive; comparison alone does not establish challenge engagement or causal treatment effect` before directional synthesis.
- [ ] Assert workbench heading is `Descriptive comparison interpretation`, old heading is absent, retained cut-in has factual deltas but no engagement/causal/winner claim, and no adequacy state/computation/import exists in workbench.

Run:

```bash
conda run -n hermes-dev python -m pytest -q \
  tests/cli/test_adequacy_cli.py \
  tests/cli/test_review_cli.py \
  tests/unit/test_workbench_projection.py \
  tests/integration/test_workbench_smoke.py
```

Expected RED: command/fixed copy/heading are missing.

### Step 2: Implement narrow renderers

- [ ] Lazy-import `hermes.adequacy.api` inside the command function.
- [ ] Reuse existing canonical JSON and bounded artifact-text helpers; do not create a second sanitizer.
- [ ] Render typed integrity/compatibility/adequacy/registration/interpretation/trust/criteria/limitations without score or winner.
- [ ] Add only fixed comparison limitation/order/heading changes to the workbench; never import adequacy there.

### Step 3: Verify and commit

```bash
conda run -n hermes-dev python -m pytest -q \
  tests/cli/test_adequacy_cli.py \
  tests/cli/test_review_cli.py \
  tests/unit/test_workbench_projection.py \
  tests/integration/test_workbench_smoke.py \
  tests/unit/test_architecture_boundaries.py
conda run -n hermes-dev python -m ruff check \
  src/hermes/cli.py src/hermes/workbench/app.py \
  tests/cli/test_adequacy_cli.py tests/cli/test_review_cli.py \
  tests/unit/test_workbench_projection.py \
  tests/integration/test_workbench_smoke.py
git diff --check
```

Commit: `feat: expose adequacy CLI and comparison limits`

---

## Task 8: Freeze the lead protocol, disclose discovery, and generate the real primary pair

**Files before discovery:**

- Create: `evaluation-plans/lead_ttc_engagement.protocol.v1.yaml`
- Create: `config/shield.phase7.lead_ttc.yaml`
- Create: `tests/integration/test_phase7_artifacts.py`

**Exactly three files in the pair-plan freeze commit:**

- Create: `evaluation-plans/lead_ttc_engagement.discovery.v1.jsonl`
- Create: `evaluation-plans/lead_ttc_engagement.pair.v1.yaml`
- Create: `scenarios/metadrive_lead_vehicle_hard_brake_adequacy_v1.yaml`

### Step 1: Write retained-control and real-node REDs

- [ ] Test retained lead returns `INADEQUATE` using a test-only protocol/ledger/pair fixture built
  under `tmp_path` whose run/scenario/component declarations match the retained artifacts and whose
  registration deliberately remains `REGISTRATION_NOT_ESTABLISHED`; never pass the production P7
  pair plan, which is bound to different primary identities. Retained cut-in remains
  descriptive/noncausal.
- [ ] Add a `@pytest.mark.metadrive` node that is skipped unless
  `HERMES_RUN_REAL_METADRIVE=1`, then refuses missing/wrong MetaDrive 0.4.3/source commit and never
  substitutes fake. The default/full/CI suite must remain simulator-free.
- [ ] Assert protocol is strict, complete finite grid/tie-break/exclusion/materializer/selection digest, lead-only, seed 7, 10 Hz, 300 steps, delay compensation zero, and candidate config frozen.
- [ ] Assert primary target run IDs/directories are absent before execution and artifacts are never staged.

Run focused RED before creating protocol/config:

```bash
conda run -n hermes-dev python -m pytest -q \
  tests/integration/test_phase7_artifacts.py -k 'retained or protocol'
```

### Step 2: Freeze all implementation and the protocol-registration commit

- [ ] Create the protocol/config through failing tests, review exact bytes/digests, and ensure every Phase 7 code/config/test change needed by primary execution is committed.
- [ ] Run full suite, Ruff, doctor, diff, and status.
- [ ] Commit protocol/config/test changes as the clean protocol-registration commit. Record its exact SHA and source digests.
- [ ] From this point until the pair-plan commit, do not modify tracked code, config, tests, policy, shield, verifier, gate, adapter, runtime, or protocol.

Commit: `test: freeze Phase 7 lead adequacy protocol`

### Step 3: Run baseline-only bounded discovery outside tracked source

- [ ] Snapshot hashes of all retained control bundles.
- [ ] Generate every grid scenario deterministically in a repository-external temporary directory.
- [ ] Run only no-op baseline arms, in declared order, using unique discovery IDs and the exact clean protocol-registration HEAD.
- [ ] Append every attempt, command, environment identity, scenario bytes/digest, run/bundle/trace digests, verification, observations, valid/exclusion, and selection result to an external append-only ledger candidate.
- [ ] Select exactly one attempt by the protocol rule; never inspect candidate outcome.
- [ ] Rehash controls and confirm byte identity.

### Step 4: Create the sole-parent pair-plan freeze commit

- [ ] Materialize only the selected scenario at the declared tracked path and prove its bytes/digest equal the selected ledger entry.
- [ ] Create the final canonical discovery ledger and pair plan with predeclared primary IDs `handoff-p7-lead-baseline` and `handoff-p7-lead-candidate`.
- [ ] Verify the index contains exactly the three approved paths, no rename/copy, and the parent is exactly the protocol-registration commit.
- [ ] Commit exactly these three additions and nothing else.

Commit: `test: register Phase 7 lead adequacy pair`

### Step 5: Run both fresh primary arms once at the pair-plan commit

- [ ] Assert both ignored target directories absent and worktree clean at pair-plan HEAD.
- [ ] Run fresh baseline, then prove its canonical typed selection-evidence result/digest equal the selected discovery entry before candidate interpretation.
- [ ] Run candidate once with the frozen config; retain/report any failure without retuning.
- [ ] Fresh-verify both bundles, assert identical repository commit, structural compatibility, unique canonical ten-file inventories, and unchanged retained-control hashes.
- [ ] Run public API/CLI and record criteria, registration, interpretation, run IDs, bundle/trace digests, command, wall time, RSS, and source hashes.
- [ ] Run the explicit real MetaDrive node:

```bash
HERMES_RUN_REAL_METADRIVE=1 conda run -n hermes-dev python -m pytest -q -m metadrive \
  tests/integration/test_phase7_artifacts.py::test_phase7_real_metadrive_primary_pair
```

No favorable metric/verdict result is required. Any retry requires a new version/design decision.

---

## Task 9: Generate the one-event availability fixture and repair the human instrument

**Files:**

- Create: `scenarios/fake_evidence_availability.yaml`
- Create: `config/phase7-fixture-registry.yaml`
- Create: `tests/integration/test_phase7_fake_availability.py`
- Create: `docs/PHASE7_HUMAN_VALIDATION_PLAN.md`
- Create: `docs/PHASE7_HUMAN_OBSERVATION_TEMPLATE.md`
- Create: `docs/PHASE7_COHORT_SYNTHESIS_TEMPLATE.md`
- Create: `docs/PHASE7_MANUAL_VISUAL_RECORD.md`
- Create: `docs/PHASE7_ACCESSIBILITY_RECORD.md`
- Create: `docs/PHASE7_HUMAN_VALIDATION_HANDOFF.md`
- Create: `docs/PHASE7_REQUIREMENTS_TRACEABILITY.md`
- Create: `tests/unit/test_phase7_docs.py`
- Modify: `docs/PHASE6_USABILITY_TEST_PLAN.md`
- Modify: `docs/PHASE6_DEMO_RUNBOOK.md`
- Modify: `docs/decision-log.md`
- Modify: `tests/unit/test_workbench_projection.py`
- Modify: `tests/integration/test_workbench_smoke.py`

### Step 1: Write fixture/instrument REDs

- [ ] Assert normal fake execution with forced `horizon_steps: 1`, `unavailable_progress: true`, baseline policy, no-op shield, seed 7, and Phase 1 gate.
- [ ] Assert exact seven findings and 3/1/1/1/1 sufficiency: required progress unavailable/HOLD; optional jerk unavailable because one sample; fault coverage not applicable; all other expected rows available.
- [ ] Assert exact metrics, `HOLD`, `INTERNALLY_CONSISTENT`, canonical ten files, typed route-progress timeline `NOT_AVAILABLE`, CLI/workbench parity, review immutability, and no comparison-delta claim.
- [ ] Assert registry exact locator/run ID/bundle/trace/schema/profile/gate/integrity/task/command and fresh verification of every Task 1–10 fixture.
- [ ] Assert the ten tasks, Tasks 1–9 denominator, seven authority fields, assistance states, timing bounds, immediate stops, privacy/deletion, Task 4 scope, Task 5 schema-2 fixture, Task 6 `CONDITIONAL`, Task 7 noncausal answer, and Task 10 exclusion from North Star.
- [ ] Assert blank observation template contains no expected answers; automated strings cannot promote manual/accessibility/expert/pilot/cohort status.

Run RED:

```bash
conda run -n hermes-dev python -m pytest -q \
  tests/integration/test_phase7_fake_availability.py \
  tests/unit/test_phase7_docs.py
```

### Step 2: Implement fixture normally and freeze registry

- [ ] Create the explicit scenario; assert ignored target `artifacts/handoff-p7-evidence-availability` absent; run normal fake pipeline once.
- [ ] Fresh-verify and record exact digests/command in the registry; never edit bundle bytes.
- [ ] Rehash retained controls and confirm unchanged.
- [ ] Make the fixture available to local tests via ignored generated output; tests may regenerate into `tmp_path` and may not depend solely on the retained local copy.

### Step 3: Write the executable human packet

- [ ] Version prompts, exact answers, moderator boundaries, assistance/time/deviation fields, counterbalancing requirements, critical stops, task-level measures, synthesis numerator/denominator, and claim limitations.
- [ ] Mark manual visual, accessibility, expert critique, pilot, and main cohort `NOT YET OBSERVED` unless actually executed with named evidence.
- [ ] Record implementer dry-run only as executability evidence, never human comprehension.
- [ ] Mark Phase 6 plan superseded without rewriting its historical evidence; update demo noncausality language only.

### Step 4: Verify and commit

```bash
conda run -n hermes-dev python -m pytest -q \
  tests/integration/test_phase7_fake_availability.py \
  tests/unit/test_phase7_docs.py \
  tests/unit/test_workbench_projection.py \
  tests/integration/test_workbench_smoke.py
conda run -n hermes-dev python -m ruff check \
  tests/integration/test_phase7_fake_availability.py \
  tests/unit/test_phase7_docs.py
git diff --check
```

Commit: `test: repair Phase 7 human validation instrument`

**Explicit non-completion:** Do not recruit, simulate participants, or mark `HUMAN_EVIDENCE_OBSERVED`/`COMPREHENSION_GATE_MET`. Those require Bo-Huei's later real pilot/main-cohort workflow.

---

## Task 10: Adversarial validation, operational measurement, and Claude handoff

**Files:**

- Create: `PHASE7_IMPLEMENTATION_HANDOFF.md`
- Modify: `CODEX_HANDOFF.md`
- Modify: `docs/PHASE7_HUMAN_VALIDATION_HANDOFF.md`
- Modify: `docs/PHASE7_REQUIREMENTS_TRACEABILITY.md`
- Modify: `docs/decision-log.md`
- Add a summary document outside the tentative allowlist only after recording the exact stale statement and reason.

### Step 1: Run an independent read-only review

- [ ] Commission separate reviewers for adequacy semantics, Git/process/capture security, CLI/workbench authority, generated evidence, and human-instrument truthfulness.
- [ ] Reproduce every P0/P1 before fixing; add a failing regression first; preserve lower-severity residuals with owner and trigger.
- [ ] Confirm no canonical review/comparison/gate bytes or meanings changed.

### Step 2: Measure bounded local operations

- [ ] Run the exact Tasks 1–10 dry-run sequence in a fresh workbench process and record cold/warm review, comparison, adequacy, RSS, `_cache`/`_active` high-water, and mutation recapture.
- [ ] Do not add LRU unless the approved measurement trigger is actually breached and a separate reviewed change is authorized.
- [ ] Record real browser/manual/accessibility status honestly; unsupported observation remains `NOT YET OBSERVED`.

### Step 3: Run fresh final gates

```bash
conda run -n hermes-dev python -m pip install -e '.[dev,workbench]'
conda run -n hermes-dev python -m pytest -q
conda run -n hermes-dev python -m pytest -q -m 'not metadrive'
HERMES_RUN_REAL_METADRIVE=1 conda run -n hermes-dev python -m pytest -q -m metadrive \
  tests/integration/test_phase7_artifacts.py::test_phase7_real_metadrive_primary_pair
conda run -n hermes-dev python -m ruff check .
conda run -n hermes-dev python -m hermes doctor
git diff --check
git diff --cached --check
```

Also:

- [ ] Rehash all retained controls and all new ignored bundles before/after API, CLI, workbench, and tests.
- [ ] Verify exact Phase 7 tracked allowlist, empty staged index before final staging, ignored artifacts absent from index, root user-owned master prompt untouched, and `third_party/metadrive` clean.
- [ ] Confirm assessment imports/run no simulator/runtime/policy/adapter/fault path beyond existing stored verification.

### Step 4: Write the completion/next-cycle packet

- [ ] `PHASE7_IMPLEMENTATION_HANDOFF.md` records start/end SHAs, all Claude dispositions, exact commits/allowlist, RED/GREEN evidence, plan/API/CLI/envelope contracts, discovery attempts, selected scenario, primary runs/digests, adequacy outcomes, real MetaDrive evidence, fixture registry, performance/cache results, test gates, limitations, and Git state.
- [ ] Clearly separate `IMPLEMENTED`, `OBSERVED`, `NOT YET OBSERVED`, `DEFERRED`, and `HOLD`.
- [ ] Include the exact next Claude prompt: inspect the completed implementation read-only, return P0–P3 with code/test/evidence citations, and do not edit.
- [ ] Do not claim READY_FOR_PILOT unless all technical/manual/accessibility prerequisites actually meet §23.2; otherwise list the exact remaining owner-operated prerequisite.

Commit: `docs: finalize Phase 7 implementation handoff`

---

## Final execution rule

Execute Tasks 1–5, Task 5A, Tasks 6–7, then execute Task 9 in full **before** any discovery run. This deliberate
dependency order freezes every reviewed Phase 7 code, config, test, scenario, registry, and protocol
input before Task 8 records `implementation_base_commit`. After that freeze, perform baseline-only
discovery, make the exact three-file pair-plan commit, and generate both primary arms. Task 10 is
read-only review and evidence reconciliation before final documentation. Stop only for an approved
hard-stop condition, an unexpected irreversible/external action, or a broken plan that changes
product semantics.
