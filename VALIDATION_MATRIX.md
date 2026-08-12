# Hermes Phase 6 Validation Matrix

## 1. Purpose

This matrix is the human acceptance gate for the Phase 6 design freeze and implementation. Passing existing tests is necessary but not sufficient. Every claim must be backed by an actual command, test, fixture, or clearly labeled manual observation.

## 2. Baseline preflight

| Check | Command | Required result |
|---|---|---|
| Repository | `pwd` | `/Users/bohueilin/Documents/GitHub/Hermes` |
| Environment | `python --version && which python` | Python 3.11 in `hermes-dev` |
| Branch | `git branch --show-current` | `feat/phase6-evidence-workbench` |
| Status | `git status --short` | Clean before each major stage |
| Current history | `git log --oneline --decorate -8` | Phase 0–5 history preserved |
| Install | `python -m pip install -e ".[dev]"` | Exit 0 |
| Tests | `python -m pytest -q` | Current full suite passes |
| Ruff | `python -m ruff check .` | All checks pass |
| Doctor | `python -m hermes doctor` | No FAIL |
| Whitespace | `git diff --check` | Exit 0 |

## 3. Design-freeze gate

| Requirement | Evidence | Pass condition |
|---|---|---|
| Canonical bundle | Code, schema, and document inspection | One ten-file inventory across Phase 6 docs |
| Review schema | `PHASE6_REVIEW_ENVELOPE_CONTRACT.md` | Versioned, normative, no unresolved P0 field |
| Trust states | Contract and UX docs | Verdict, integrity, authenticity, authorization, permission, and scope are separate |
| Evidence sufficiency | Contract and traceability | Requiredness owned by core, not UI |
| Framework choice | Decision log | One choice with rationale and test strategy |
| Dependency rule | Architecture doc | Enforceable UI-to-review-only import boundary |
| Threat model | Threat doc | Prevention, detection, failure, test, and residual risk mapped |
| UI information architecture | UX doc | Invalid, unavailable, comparison, and provenance states defined |
| No implementation | Git diff | No workbench production module or UI dependency added |
| Design handoff | `PHASE6_DESIGN_FREEZE_HANDOFF.md` | GO, CONDITIONAL GO, or HOLD and exact next prompt |

## 4. Review core acceptance

### 4.1 Valid evidence classes

Use actual artifact names when present. Substitute generated fixtures only when absent.

| Case | Example artifact | Required review result |
|---|---|---|
| PASS | `artifacts/handoff-phase5-demo` | Integrity `INTERNALLY_CONSISTENT`; gate `PASS`; authenticity `NOT_AUTHENTICATED`; deployment `NONE` |
| CONDITIONAL | `artifacts/handoff-p1-conditional` | Integrity valid; gate `CONDITIONAL`; soft failures visible |
| HOLD | `artifacts/handoff-p1-collision` | Integrity valid; gate `HOLD`; collision hard failure and event references visible |
| INVALID | `artifacts/phase1-tampered` | Integrity invalid; stored verdict quarantined; exit 30 |
| MetaDrive | `artifacts/handoff-p2-metadrive` | Same review contract; no simulator import or rerun |
| Fault | `artifacts/handoff-p4-fault` | Coverage result and mission HOLD both visible |

Expected command shape:

```bash
hermes review-artifact artifacts/<run-id> \
  --artifact-root artifacts \
  --format json
```

### 4.2 Envelope checks

- [ ] One parseable JSON document.
- [ ] Review schema version present.
- [ ] Artifact run ID and relative path present.
- [ ] Bundle and trace digests present.
- [ ] Recomputed gate result present.
- [ ] Stored result not treated as accepted after verification failure.
- [ ] Trust-state fields present.
- [ ] Evidence sufficiency present.
- [ ] Findings include source references.
- [ ] Numeric values include unit, threshold, and operator when applicable.
- [ ] Residual limitations present.
- [ ] No absolute local path in shareable envelope unless explicitly classified as local diagnostic metadata.

## 5. Comparison acceptance

| Pair | Required result |
|---|---|
| lead baseline vs shielded | Compatible; TTC improvement and mission or comfort regression both visible; unchanged verdict visible |
| cut-in baseline vs shielded | Compatible; same bidirectional trade-off behavior |
| incompatible scenarios, gates, or fault profiles | Exit 40; one incompatibility envelope; no chart payload |
| invalid plus valid | Exit 30; invalid artifact identified; no comparison claim |

Expected shape:

```bash
hermes review-compare \
  artifacts/handoff-p3-lead-baseline \
  artifacts/handoff-p3-lead-shielded \
  --artifact-root artifacts \
  --format json
```

- [ ] No winner score.
- [ ] Improvements listed.
- [ ] Regressions listed.
- [ ] Unchanged outcomes listed.
- [ ] Evidence availability deltas listed.
- [ ] Both artifact identities and digests listed.
- [ ] Compatibility basis listed.

## 6. Artifact immutability

For each representative artifact:

```bash
find artifacts/<run-id> -type f -maxdepth 1 -print0 | sort -z | \
  xargs -0 shasum -a 256 > /tmp/hermes-before.sha256

hermes review-artifact artifacts/<run-id> --artifact-root artifacts --format json \
  > /tmp/hermes-review.json

find artifacts/<run-id> -type f -maxdepth 1 -print0 | sort -z | \
  xargs -0 shasum -a 256 > /tmp/hermes-after.sha256

diff -u /tmp/hermes-before.sha256 /tmp/hermes-after.sha256
```

Required result: no diff.

Also automate this in tests for core and workbench harnesses.

## 7. Path, symlink, and TOCTOU negative tests

| Test | Required result |
|---|---|
| `../` traversal | configuration or path error, exit 40 |
| absolute path outside allowed root | reject |
| symlink required file outside bundle | invalid or reject |
| symlink artifact directory outside root | reject |
| directory swapped after verification | session invalidated |
| file changed during capture | invalid evidence |
| same path, different bundle | new digest and full re-verification |
| cached envelope after mutation | cache miss or invalidation |

## 8. Invalid-artifact quarantine

For every invalid fixture:

- [ ] Primary status is `INVALID_EVIDENCE`.
- [ ] Stored `PASS` is not shown as accepted.
- [ ] First mismatch or actionable failure is shown.
- [ ] Findings or metrics from untrusted stored files are not presented as recomputed accepted results.
- [ ] No green trust banner appears.
- [ ] Authenticity is not promoted.

## 9. Numeric integrity

Create fixtures with measured values:

- immediately below threshold;
- equal to threshold;
- immediately above threshold;
- floating representation noise.

Required:

- [ ] Exact value inspectable.
- [ ] Display value cannot change apparent comparison.
- [ ] Operator visible.
- [ ] Unit visible.
- [ ] Verifier version visible.
- [ ] Supporting events visible.

## 10. `NOT_AVAILABLE` integrity

- [ ] Missing TTC is displayed `NOT_AVAILABLE`, not `0`, infinity, blank, or pass.
- [ ] Unavailable reason displayed.
- [ ] Required or optional status displayed.
- [ ] Gate consequence displayed.
- [ ] Chart has a gap or annotation rather than a zero point.

## 11. XSS and content-injection tests

Inject into allowed artifact strings:

```text
<script>alert(1)</script>
<img src=x onerror=alert(1)>
[click](javascript:alert(1))
<svg onload=alert(1)>
ANSI escape sequences
very long repeated text
```

Required:

- [ ] Rendered as text or safely sanitized.
- [ ] No script execution.
- [ ] No raw HTML use for evidence content.
- [ ] Long content bounded or truncated with safe expansion.
- [ ] Terminal output escapes control characters.

## 12. Resource-bound tests

Design freeze must select documented limits after inspecting current artifacts.

Test:

- oversized companion file;
- excessive event count;
- deeply nested JSON or YAML;
- oversized string;
- many findings or metrics.

Required result: bounded failure with no partial accepted review.

## 13. Architecture and dependency checks

- [ ] Workbench imports only review-layer APIs plus framework.
- [ ] Review core does not import framework.
- [ ] Review path does not import MetaDrive.
- [ ] Review path does not instantiate adapters or policies.
- [ ] No UI gate or verifier implementation exists.
- [ ] AST or import-boundary test passes.

## 14. Local-only workbench launch

Expected shape:

```bash
hermes workbench \
  --artifact-root artifacts \
  --host 127.0.0.1 \
  --port 8501 \
  --no-browser
```

Required:

- [ ] Binds only to loopback.
- [ ] `0.0.0.0` rejected.
- [ ] `::` rejected.
- [ ] No telemetry or external network call.
- [ ] No upload, write, approve, run, sign, or deploy control.
- [ ] Startup does not launch simulator.
- [ ] Shutdown is clean.

## 15. Workbench functional cases

- [ ] Intake waits for verification before accepting gate result.
- [ ] Mandatory trust strip appears on every run view.
- [ ] PASS, HOLD, CONDITIONAL, and INVALID render distinctly.
- [ ] Findings table source-links to event sequences.
- [ ] Timeline distinguishes raw, delivered, result, candidate, permitted, and executed values.
- [ ] Provenance distinguishes recorded origin from authenticated origin.
- [ ] Comparison shows both directions.
- [ ] Incompatible comparison renders no misleading chart.
- [ ] No automatic latest artifact is selected.
- [ ] Filtering and sorting change presentation only.

## 16. Human comprehension script

Ask a reviewer to answer from the workbench:

1. What exact artifact and digest are being reviewed?
2. Why did the gate issue its verdict?
3. Which hard requirement failed?
4. Which evidence was unavailable?
5. What did the shield change?
6. What improved and regressed?
7. Is the bundle authenticated?
8. Does the verdict authorize real-world deployment?

Record only actual observations. Do not invent a usability-test participant or success rate.

## 17. Full quality gate

```bash
python -m pip install -e ".[dev,workbench]"
python -m pytest -q
python -m pytest -q -m "not metadrive"
python -m ruff check .
python -m hermes doctor
git diff --check
git status --short
```

## 18. Stop conditions

Phase 6 is HOLD when any is true:

- UI has a separate gate or verifier.
- Source bundle bytes change.
- CLI and UI parity fails.
- Invalid artifact displays accepted PASS.
- Authenticity is implied.
- Public bind is allowed.
- Simulator or policy launches during review.
- Canonical bundle remains inconsistent.
- Requiredness is inferred by UI.
- Existing evidence tests are weakened.
- P0 adversarial finding remains open.
