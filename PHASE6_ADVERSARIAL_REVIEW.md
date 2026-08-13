# Hermes Phase 6 adversarial review

## 1. Executive verdict

**Final verdict: GO.**

The review base was the independently reviewed Task 5 checkpoint. Four P1 defects were reproduced:
mutable release-gate and portable-model registries contradict the frozen semantic contract, and two
untrusted-but-bounded artifact shapes can escape the public facade as exceptions instead of a
quarantined `INVALID_EVIDENCE` envelope. The text CLI also emits artifact-controlled bidirectional
format controls invisibly. All four P1 findings are closed with RED-first regressions. A P2
artifact-switch presentation-state issue was also closed. The remaining P2 process-lifetime cache
growth requires repeated explicit local selections, is restart-recoverable, and is documented as an
accepted Phase 6 availability residual. No open P0 or P1 remains.

Final gates are `720 passed` for both the complete and non-MetaDrive test selections, `488 passed`
for the focused Phase 6 adversarial matrix, Ruff clean, doctor 17 PASS / one expected dirty-tree WARN
/ one optional display NOT_AVAILABLE, and `git diff --check` clean. Independent reviewers returned
GO for the core/facade/workbench fixes and the CLI hardening. No original artifact bytes, remote,
simulator, browser, or server action was used during remediation.

## 2. Repository snapshot and observed architecture

- Repository: `/Users/bohueilin/Documents/GitHub/Hermes`
- Branch: `feat/phase6-evidence-workbench`
- Review base: `99c75124521bb98dbfad11cf1f6cc2b8528ce9cd`
  (`feat: add local read-only evidence workbench`)
- Python: `3.11.15` from `/Users/bohueilin/miniconda3/envs/hermes-dev/bin/python`
- Entry tree at review start: clean; `git diff --check` passed.
- Review architecture observed:
  untrusted locator -> descriptor-relative immutable capture -> stored verification/compare core ->
  immutable portable envelope -> safe presentation projection -> loopback-only read-only workbench.
- The review CLI and workbench consume the same public `hermes.review` facade. Workbench code is
  presentation-only and the optional Streamlit dependency is isolated from core imports.
- **Audit protocol deviation:** one read-only review subprocess mistakenly called `os.utime` on
  `artifacts/handoff-phase5-demo/events.jsonl` at 2026-08-12 17:50:32 -0700 instead of on its
  temporary copy. This changed that file's mtime/ctime only; no attempt was made to conceal or
  reconstruct metadata. Immediate SHA-256 readback of all ten bundle files matched their prior
  content, `git status` showed no artifact-content change, and fresh facade review remained
  `INTERNALLY_CONSISTENT` / `PASS` with bundle digest `fd42b839...13334`, trace digest
  `f515c162...a234e`, 40 events, and 16 tracks. All later corruption probes used temporary copies.

## 3. P0 findings

No P0 finding was reproduced. The registry mutation can create a false accepted result after code
already executing inside the process mutates the contract; arbitrary in-process code execution is
outside the threat model's compromised-host boundary. It is therefore classified P1 contract
integrity rather than P0 artifact-driven false acceptance.

## 4. P1 findings

### C6-01 / T09, T14 — mutable normative registries can alter accepted gate and envelope semantics

- **Severity:** P1 (reproduced immutable-contract violation); `CLOSED`.
- **Surface:** `src/hermes/gates/release.py` lines 46-61 and
  `src/hermes/review/models.py` lines 85-321 at the review base.
- **Precondition and capability:** code already executing in the local Hermes Python process imports
  the public modules and mutates an exposed dictionary or set. A compromised host remains outside
  assurance, but an ordinary co-resident importer or accidental in-process mutation is not required
  to bypass Python protections because the registries are directly writable.
- **Expected behavior:** the frozen release profile and review-schema registries are immutable for
  the lifetime of the process. A missing hard collision finding remains invalid, and a MANIFEST
  source can never be rebound to `events.jsonl`.
- **Observed behavior:** removing `collision.zero` from `LEGACY_EXPECTED_FINDINGS` changes the same
  reduced retained finding set from `INVALID_EVIDENCE` to `PASS`. Rebinding
  `SOURCE_FILES["MANIFEST"]` changes a previously rejected `SourceReference` into an accepted model.
- **Reviewer harm / authority boundary:** release-gate semantics and portable schema validation can
  drift without a version change. The diagnostic proof can create a false accepted gate result, but
  artifact bytes alone cannot perform the mutation and arbitrary process-code execution is outside
  assurance.
- **Initial status:** `REPRODUCED`.
- **RED evidence:** focused mutation tests produced `14 failed, 2 passed, 139 deselected`; every
  failure was the intended `Failed: DID NOT RAISE` against a mutable mapping/set, while the two
  exact-content/order controls passed.
- **Regression owner:** `tests/unit/test_verifiers_and_gate.py` and
  `tests/unit/test_review_models.py`.
- **Smallest in-scope fix:** freeze outer and nested release-gate mappings with
  `MappingProxyType`; freeze review-model mappings with `MappingProxyType` and mutable sets with
  `frozenset`, without changing any registry contents or decision logic.
- **Closure evidence:** all ten review-model mappings/sets and all four public/outer/nested gate
  mutation surfaces now reject in-place mutation while exact values, insertion order, and the legacy
  profile alias remain unchanged. The two owning modules pass `155` tests; scoped Ruff and
  `git diff --check` pass. Deliberate module-global rebinding by compromised in-process code remains
  outside assurance.

### C6-02 / T17 — malformed implicit YAML scalars escape quarantine

- **Severity:** P1 (review denial / fail-closed defect); `CLOSED`.
- **Surface:** `src/hermes/evidence/verification.py` scenario and gate resolved-YAML parse blocks at
  review-base lines 1078-1098.
- **Precondition and capability:** an explicitly selected artifact contains a bounded UTF-8 YAML
  document whose implicit scalar constructor raises raw `ValueError`; examples include the date-like
  scalar `2026-99-99` or an integer beyond Python's configured decimal-conversion limit.
- **Expected behavior:** stored verification records a bounded diagnostic and the public facade
  returns a quarantined `INVALID_EVIDENCE` envelope with no accepted claims.
- **Observed behavior:** public `review_artifact` raises `ValueError: month must be in 1..12` instead
  of returning an envelope. Gate configuration has the analogous path.
- **Reviewer harm:** one selected untrusted artifact can deny review and break CLI/UI operation.
- **Initial status:** `REPRODUCED` on a temporary copy; originals were untouched.
- **Regression owner:** `tests/unit/test_artifact_verification.py` and facade parity coverage.
- **Smallest in-scope fix:** normalize raw `ValueError` from the two already bounded parse calls into
  verification diagnostics at the verification boundary; do not relax the strict loader.
- **RED / closure evidence:** the scenario date and 5,000-digit gate scalar regressions initially
  raised raw `ValueError` (`2` of the combined `3` failing tests). The parse-call-scoped fix now
  returns fixed-size diagnostics and invalid evidence. A fresh public-facade readback returned
  `INVALID_EVIDENCE`, zero findings, zero metrics, and zero timeline events. Verification and retained
  review integration pass `36` tests; the broader owning set passes `78`.

### C6-03 / T15, T17 — finite extreme trace values can overflow derived metrics

- **Severity:** P1 (review denial / fail-closed defect); `CLOSED`.
- **Surface:** the unguarded stored recomputation block in
  `src/hermes/evidence/verification.py` review-base lines 1261-1298.
- **Precondition and capability:** an explicitly selected, coherently chain-rehashed trace contains
  schema-valid finite acceleration values `1e308` then `-1e308`. Their finite difference over the
  control interval overflows the derived jerk to infinity.
- **Expected behavior:** a derived-value validation or arithmetic failure becomes a verification
  diagnostic and quarantined `INVALID_EVIDENCE`; no partial recomputation is accepted.
- **Observed behavior:** public `review_artifact` raises Pydantic `ValidationError` for
  `Measurement` instead of returning an envelope.
- **Reviewer harm:** one bounded selected trace can deny review across API, CLI, and UI.
- **Initial status:** `REPRODUCED` on a temporary copy with a coherently refreshed event chain,
  trace digest, manifest digests, and detached bundle digest.
- **Regression owner:** `tests/unit/test_artifact_verification.py` and facade parity coverage.
- **Smallest in-scope fix:** catch deterministic untrusted-data arithmetic/model validation errors
  around recomputation, record one bounded diagnostic, skip accepted comparison of recomputed
  claims, and return invalid evidence. Do not catch programmer-control exceptions or weaken event
  validation.
- **RED / closure evidence:** the finite-extreme regression initially raised Pydantic
  `ValidationError` (the third of `3` failing tests). The recomputation boundary now catches only
  `ArithmeticError` and Pydantic `ValidationError`, emits a fixed artifact-independent diagnostic,
  and quarantines all claims. Public-facade readback returned `INVALID_EVIDENCE`, zero findings,
  zero metrics, and zero timeline events. The unchanged retained-artifact suite remains green.

### C6-05 / T16, T19 — text CLI projection is neither format-control-safe nor bounded

- **Severity:** P1 (material reviewer-deception risk); `CLOSED`.
- **Surface:** `_neutralize_artifact_text` and `_review_record_json` in `src/hermes/cli.py` at
  review-base lines 142-151 and 408-438.
- **Precondition and capability:** an internally consistent artifact contains a valid string such as
  a run ID or provenance value with Unicode category `Cf` (including U+202E RIGHT-TO-LEFT OVERRIDE or
  U+2066/U+2069 isolate controls), or artifact text longer than 1,024 Unicode scalars.
- **Expected behavior:** every Cc/Cf control is rendered as a deterministic visible uppercase
  `\\uNNNN` escape in text output; literal backslash sequences remain literal.
- **Observed behavior:** `_neutralize_artifact_text` returns raw U+202E and a coherently rehashed
  retained copy emits it invisibly in `review-artifact --format text`. A valid 1,025-scalar run ID
  is emitted in full, without a truncation flag or original-scalar count. The workbench projector
  already neutralizes Cc/Cf and applies the 1,024-scalar contract.
- **Reviewer harm:** terminal bidi reordering can visually spoof labels or artifact identity, while
  long content can bury later integrity/trust lines, even though the core result is unchanged.
- **Initial status:** `REPRODUCED`; the direct probe returned raw U+202E with no visible escape.
- **Regression owner:** `tests/cli/test_review_cli.py`.
- **Smallest in-scope fix:** route every human-text artifact scalar through the shared bounded safe
  projection, expose explicit truncation/original-count metadata, and make nested canonical-record
  text neutralize Cc/Cf without changing JSON output. Preserve current uppercase C0/C1 and literal
  backslash behavior.
- **RED / closure evidence:** four direct/nested boundary tests failed, two exception-message tests
  failed, and separate mapping-key and colliding-key regressions each failed before implementation.
  Text review and comparison now escape every Unicode Cc/Cf control visibly, bound each input scalar
  at 1,024 with explicit length metadata, and preserve colliding truncated keys with a deterministic
  index. Canonical JSON remains full and byte-exact. The final CLI/architecture/projection/facade/
  comparison gate passes `152` tests; Ruff, import-deprecation, and diff checks pass.

## 5. P2 findings

### C6-04 / T17 — process-lifetime facade cache and session maps are unbounded

- **Severity:** P2 availability and assurance debt; accepted residual for Phase 6.
- **Evidence:** 43 explicit retained selections in one fresh facade process produced 41 cached
  envelopes, 43 active sessions, and about 251 MB peak resident memory. Growth is linear.
- **Why not P1:** artifact directory contents are never discovered or auto-loaded; the local reviewer
  must explicitly type and submit each exact selection, and restarting the local process recovers
  all memory. T17 already records denial within valid limits as residual risk.
- **Recommended hardening:** a later deterministic synchronized LRU cap for `_cache` and `_active`,
  preserving full recapture before every render and exact canonical-envelope equality after
  eviction. It is not required to close Phase 6 GO.

### C6-06 / T28 — event drill-down presentation state survives a new artifact submission

- **Severity:** P2 presentation-state debt; `CLOSED` as low-risk defense in depth.
- **Evidence:** after inspecting sequence 10 for artifact A, submitting artifact B leaves
  `inspect_event_requested` set and renders freshly recaptured B sequence 0 without a new inspect
  action. The active envelope is not stale and no false core result appears; timeline filters already
  reset correctly on artifact change.
- **Recommended hardening:** reset the inspect-event flag and sequence when a new single-artifact
  submission is accepted, and add an AppTest asserting no event row until a new explicit inspect
  click. This is not required to close Phase 6 GO because identity, recapture, and facts remain exact.
- **Closure evidence:** the regression first failed with the request flag still true, then passed
  after the accepted Verify branch reset the two presentation-only fields. It proves artifact B's
  fresh identity, no drill-down rows before a new click, and exact sequence 0 after that click.
  Owning AppTests pass `21`; the focused workbench set passes `108`.

## 6. Reproduction commands

Entry snapshot:

```bash
conda run -n hermes-dev python --version
conda run -n hermes-dev which python
git branch --show-current
git rev-parse HEAD
git status --short
git log --oneline --decorate -8
git diff --check
```

Contained gate-registry reproduction (the mutation exists only in the subprocess):

```bash
conda run -n hermes-dev python -c "from pathlib import Path; from hermes.evidence.verification import inspect_artifact; from hermes.gates.release import apply_release_gate, LEGACY_EXPECTED_FINDINGS, VerifierProfile; s=inspect_artifact(Path('artifacts/handoff-phase5-demo')).snapshot; reduced=tuple(f for f in s.findings.findings if f.finding_id != 'collision.zero'); before=apply_release_gate(reduced,s.gate_config,expected_profile=VerifierProfile.LEGACY); print('before', before.verdict, before.hard_failures); LEGACY_EXPECTED_FINDINGS.pop('collision.zero'); after=apply_release_gate(reduced,s.gate_config,expected_profile=VerifierProfile.LEGACY); print('after', after.verdict, after.hard_failures, after.supporting_finding_ids)"
```

Observed output:

```text
before INVALID_EVIDENCE ('gate.finding-set',)
after PASS () ()
```

Contained portable-model reproduction:

```bash
conda run -n hermes-dev python -c "from hermes.review.models import SourceReference, SOURCE_FILES; from pydantic import ValidationError; payload=dict(source_type='MANIFEST', file_name='events.jsonl', event_sequence=None, json_pointer=''); exec(\"try:\\n SourceReference(**payload); print('before ACCEPTED')\\nexcept ValidationError:\\n print('before REJECTED')\"); SOURCE_FILES['MANIFEST']='events.jsonl'; print('after', SourceReference(**payload))"
```

Observed result: the invalid source is rejected before mutation and accepted after mutation.

Malformed YAML facade reproduction used a temporary retained-bundle copy whose scenario name was
replaced with `2026-99-99`. `review_artifact` returned:

```text
ValueError month must be in 1..12
```

Finite-extreme facade reproduction used a temporary retained-bundle copy, set consecutive stored
accelerations to `1e308` and `-1e308`, and coherently refreshed the event chain, trace, manifest,
and bundle digests. `review_artifact` returned:

```text
ValidationError 1 validation error for Measurement
```

Text-sanitizer reproduction:

```bash
conda run -n hermes-dev python -c "from hermes.cli import _neutralize_artifact_text; value='honest-\\u202eSSAP :tcidrev etaG'; rendered=_neutralize_artifact_text(value); print(repr(rendered)); print('contains_raw_bidi', '\\u202e' in rendered, 'contains_visible_escape', r'\\u202E' in rendered)"
```

Observed output:

```text
'honest-\u202eSSAP :tcidrev etaG'
contains_raw_bidi True contains_visible_escape False
```

## 7. Evidence and disposition

The C6-01 result was reproduced twice in fresh subprocesses, so neither mutation persisted into the
controller process or repository. Source inspection confirms validators read these globals at model
validation time and `apply_release_gate` reads the mutable profile mapping on every call. C6-02 and
C6-03 operated only on fresh `/private/tmp` copies. C6-05 was independently confirmed at the direct
sanitizer seam after a full CLI reproduction by the UI/CLI reviewer. Original retained artifact
bytes and the tracked tree remained unchanged; the one retained-file timestamp deviation is
disclosed in section 2.

Final retained public-facade readback preserved these representative oracles:

| Selection | Integrity | Gate | Bundle digest | Events / findings / metrics / tracks |
|---|---|---|---|---|
| `handoff-phase5-demo` | `INTERNALLY_CONSISTENT` | `PASS` | `fd42b839...13334` | `40 / 6 / 13 / 16` |
| `handoff-p1-collision` | `INTERNALLY_CONSISTENT` | `HOLD` | `723e814d...ae27c` | `13 / 6 / 13 / 16` |
| `handoff-p1-conditional` | `INTERNALLY_CONSISTENT` | `CONDITIONAL` | `752ba472...41cb4` | `39 / 6 / 13 / 16` |
| `handoff-p2-metadrive` | `INTERNALLY_CONSISTENT` | `PASS` | `78b6b15f...ab42` | `165 / 6 / 13 / 16` |
| `handoff-p4-fault` | `INTERNALLY_CONSISTENT` | `HOLD` | `83ba9b39...1c43f` | `20 / 7 / 19 / 16` |
| `phase1-tampered` | `INVALID_EVIDENCE` | `INVALID_EVIDENCE` | `831f22ed...d61e` | `0 / 0 / 0 / 0` |

Both retained lead and cut-in comparisons remain compatible and mixed: minimum TTC improves;
route completion, acceleration, and jerk regress; collision count, policy latency, and latency
source remain unchanged; shield interventions remain descriptive/not comparable; each has six chart
series and an unchanged gate verdict. Phase 5 versus MetaDrive remains incompatible with zero delta
partitions and zero chart series.

Independent core-fix review ran 20 targeted and 205 scoped tests, deliberately confirmed that
`RuntimeError`, `TypeError`, `AssertionError`, and `KeyError` are not masked by the recomputation
catch, and returned GO with no P0-P3. Independent CLI review ran 110 focused tests and exhaustively
checked all 228 Unicode Cc/Cf code points, supplementary controls, scalar boundaries, nested and
colliding mapping keys, error paths, canonical JSON parity, and lazy-import boundaries; it returned
GO with no P0-P3.

## 8. Recommended and applied fixes

The applied fixes preserve authority: existing registries are immutable without changed values;
bounded artifact-derived parse/recomputation failures normalize at the existing verification
boundary; terminal text is visibly inert and bounded; and artifact-scoped presentation state resets
on explicit reselection. No gate, verifier, threshold, comparison, authenticity, or deployment
semantics were added.

## 9. Tests missing and tests added

At the review base, tests were missing for release/review registry mutation, YAML constructor
`ValueError`, derived-metric overflow, Unicode Cf terminal controls, 1,024/1,025-scalar CLI bounds,
nested/mapping-key truncation and collision, exact JSON preservation, and artifact-switch drill-down
reset. Those regressions were added to the existing owning test files. The final complete suite is
`720 passed`; the full non-MetaDrive selection is also `720 passed`; the Task 6 focused matrix is
`488 passed`; Ruff and diff checks pass.

## 10. Residual risk

Even after registry hardening, Phase 6 proves only reproducible internal consistency under the
installed stored-verification and gate implementation. A coherent producer rewrite remains locally
undetectable. Origin remains `NOT_AUTHENTICATED`; authorization remains `NOT_EVALUATED`; deployment
permission remains `NONE`; scope remains `SIMULATION_ONLY`; stored review does not rerun policy or
simulator code. A compromised host or verifier remains outside assurance.

The process-local facade cache/session maps are not bounded. Their observed 43-selection peak was
about 251 MB, but no root discovery or automatic loading exists; each selection requires explicit
local reviewer action and restart is fully recoverable. A future synchronized LRU is recommended
before increasing the single-user artifact scale. This accepted P2 does not strengthen evidence,
alter source bytes, bypass verification, or change the Phase 6 local-only scope.
