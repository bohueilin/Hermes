# Hermes Phase 6 Validation Matrix

## 1. Purpose

This matrix is both the recorded acceptance gate for Phase 6 and a rerunnable regression checklist.
Every claim is backed by an actual command, test, fixture, or clearly labeled manual observation;
no human-participant result is inferred from automated coverage.

### Completed implementation/adversarial checkpoint

| Item | Recorded result |
|---|---|
| Branch | `feat/phase6-evidence-workbench` |
| Checkpoint HEAD | `90fb7d891a233fea9fe5de915060873851da1d70` |
| Complete tests | 720 passed |
| Non-MetaDrive selection | 720 passed |
| Focused Phase 6 adversarial matrix | 488 passed |
| Ruff / diff check | passed |
| Doctor | 17 PASS, one expected dirty-tree WARN, one optional display NOT_AVAILABLE, no FAIL |
| Adversarial decision | GO; no open P0/P1 |
| Accepted residual | P2 process-lifetime cache/session growth after explicit selections |

## 2. Baseline preflight

| Check | Command | Required result |
|---|---|---|
| Repository | `pwd` | `/Users/bohueilin/Documents/GitHub/Hermes` |
| Environment | `python --version && which python` | Python 3.11 in `hermes-dev` |
| Branch | `git branch --show-current` | `feat/phase6-evidence-workbench` |
| Status | `git status --short` | Clean before each major stage |
| Current history | `git log --oneline --decorate -8` | Phase 0–6 history preserved |
| Install | `python -m pip install -e ".[dev]"` | Exit 0 |
| Tests | `python -m pytest -q` | Current full suite passes |
| Ruff | `python -m ruff check .` | All checks pass |
| Doctor | `python -m hermes doctor` | No FAIL |
| Whitespace | `git diff --check` | Exit 0 |

## 3. Historical design-freeze gate (completed before implementation)

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
| Stage isolation | Design-freeze commit diff | Only contract/design documents changed at that historical checkpoint; implementation followed later |
| Design handoff | `PHASE6_DESIGN_FREEZE_HANDOFF.md` | Recorded decision, no unresolved P0, and exact next prompt |
| Portable determinism | Contract inspection | No generated timestamp, absolute path, or filesystem metadata; unchanged bytes/selected relative path/tool/schema produce byte-identical JSON |
| Captured identity | Architecture/contract inspection | Source inventory and observed/computed roots use the same captured bytes; no reopen |
| Resource authority | Threat/architecture docs | Existing verifier alone determines INVALID; review-shape failure is REVIEW_UNAVAILABLE / 40 |
| Stage 6A scope | Design-freeze commit diff | Documentation only at that historical checkpoint; implementation followed in later commits |

## 4. Review core acceptance

### 4.1 Valid evidence classes

Use actual artifact names when present. Substitute generated fixtures only when absent.

| Case | Example artifact | Required review result |
|---|---|---|
| PASS | `handoff-phase5-demo` | Integrity `INTERNALLY_CONSISTENT`; gate `PASS`; authenticity `NOT_AUTHENTICATED`; deployment `NONE` |
| CONDITIONAL | `handoff-p1-conditional` | Integrity valid; gate `CONDITIONAL`; soft failures visible |
| HOLD | `handoff-p1-collision` | Integrity valid; gate `HOLD`; collision hard failure and event references visible |
| INVALID | `phase1-tampered` | Integrity invalid; stored verdict quarantined; exit 30 |
| MetaDrive | `handoff-p2-metadrive` | Same review contract; no simulator import or rerun |
| Fault | `handoff-p4-fault` | Coverage result and mission HOLD both visible |

Every case separately exposes gate verdict, integrity, authenticity `NOT_AUTHENTICATED`,
authorization `NOT_EVALUATED`, deployment permission `NONE`, and scope `SIMULATION_ONLY`.

Expected command shape:

```bash
hermes review-artifact handoff-phase5-demo \
  --artifact-root artifacts \
  --format json
```

### 4.2 Envelope checks

- [x] One parseable JSON document.
- [x] Review schema version present.
- [x] Artifact run ID and relative path present.
- [x] Bundle and trace digests present.
- [x] Recomputed gate result present.
- [x] Stored result not treated as accepted after verification failure.
- [x] Trust-state fields present.
- [x] Evidence sufficiency present.
- [x] Findings include source references.
- [x] Numeric values include unit, threshold, and operator when applicable.
- [x] Residual limitations present.
- [x] No absolute local path in the portable envelope.

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
  handoff-p3-lead-baseline \
  handoff-p3-lead-shielded \
  --artifact-root artifacts \
  --format json
```

- [x] No winner score.
- [x] Improvements listed.
- [x] Regressions listed.
- [x] Unchanged outcomes listed.
- [x] Evidence availability deltas listed.
- [x] Both artifact identities and digests listed.
- [x] Compatibility basis listed.

## 6. Artifact immutability

For each representative artifact:

```bash
find artifacts/handoff-phase5-demo -type f -maxdepth 1 -print0 | sort -z | \
  xargs -0 shasum -a 256 > /tmp/hermes-before.sha256

hermes review-artifact handoff-phase5-demo --artifact-root artifacts --format json \
  > /tmp/hermes-review.json

find artifacts/handoff-phase5-demo -type f -maxdepth 1 -print0 | sort -z | \
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

- [x] Primary status is `INVALID_EVIDENCE`.
- [x] Stored `PASS` is not shown as accepted.
- [x] First mismatch or actionable failure is shown.
- [x] Findings or metrics from untrusted stored files are not presented as recomputed accepted results.
- [x] No green trust banner appears.
- [x] Authenticity is not promoted.

## 9. Numeric integrity

Create fixtures with measured values:

- immediately below threshold;
- equal to threshold;
- immediately above threshold;
- floating representation noise.

Required:

- [x] Exact value inspectable.
- [x] Display value cannot change apparent comparison.
- [x] Operator visible.
- [x] Unit visible.
- [x] Verifier version visible.
- [x] Supporting events visible.

## 10. `NOT_AVAILABLE` integrity

- [x] Missing TTC is displayed `NOT_AVAILABLE`, not `0`, infinity, blank, or pass.
- [x] Unavailable reason displayed.
- [x] Required or optional status displayed.
- [x] Gate consequence displayed.
- [x] Chart has a gap or annotation rather than a zero point.

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

- [x] Rendered as text or safely sanitized.
- [x] No script execution.
- [x] No raw HTML use for evidence content.
- [x] Long presentation text is bounded with explicit truncation/original-length metadata while
  canonical JSON remains exact.
- [x] Terminal output visibly escapes Unicode Cc/Cf control characters.

## 12. Resource-bound tests

The design freeze selected documented limits after inspecting retained artifacts.

Test:

- oversized companion file;
- excessive event count;
- deeply nested JSON or YAML;
- oversized string;
- many findings or metrics.

Required result: bounded failure with no partial accepted review.

Existing verifier limits remain 16 MiB/file, 64 MiB total, 10,000 events, and 1 MiB/event line;
test each core boundary+1 as INVALID_EVIDENCE. Review passes no stricter limit. Test operational
envelope boundaries 64 findings, 64 metrics, and depth 16 at boundary+1 as REVIEW_UNAVAILABLE /
UNSUPPORTED_REVIEW_SHAPE / exit 40 with no portable envelope and unchanged integrity/gate. Test
projection text at 1,024/1,025 scalars for explicit truncation while portable/source values remain
complete. Test a 10,000-event portable timeline and deterministic pagination without decimation.

## 13. Architecture and dependency checks

- [x] Workbench imports only review-layer APIs plus framework.
- [x] Review core does not import framework.
- [x] Review path does not import MetaDrive.
- [x] Review path does not instantiate adapters or policies.
- [x] No UI gate or verifier implementation exists.
- [x] AST or import-boundary test passes.

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

- [x] Binds only to loopback.
- [x] `0.0.0.0` rejected.
- [x] `::` rejected.
- [x] Numeric 127/8 and `::1` accepted through ipaddress; hostnames rejected.
- [x] LAN, link-local, and public literals rejected.
- [x] No telemetry or external network call.
- [x] No upload, write, approve, run, sign, or deploy control.
- [x] Startup does not launch simulator.
- [ ] Shutdown is clean.

The shutdown item remains an explicit manual launcher check; automated finalization did not start a
real server or browser. Launcher argument and subprocess behavior are covered without network use.

## 14A. Review CLI exit matrix

| Command result | Required exit |
|---|---:|
| review-artifact valid PASS | 0 |
| review-artifact valid CONDITIONAL | 0 |
| review-artifact valid HOLD | 0 |
| review-artifact invalid evidence | 30 |
| review-compare compatible | 0 |
| review-compare invalid side | 30 |
| review path/configuration/operational failure | 40 |
| review-compare incompatible valid artifacts | 40 |

Legacy run, verify-artifact, and compare exits must remain unchanged.

## 15. Workbench functional cases

- [x] Intake waits for verification before accepting gate result.
- [x] Mandatory trust strip appears on every run view.
- [x] PASS, HOLD, CONDITIONAL, and INVALID render distinctly.
- [x] Findings table source-links to event sequences.
- [x] Timeline distinguishes raw, delivered, result, candidate, permitted, and executed values.
- [x] Provenance distinguishes recorded origin from authenticated origin.
- [x] Comparison shows both directions.
- [x] Incompatible comparison renders no misleading chart.
- [x] No automatic latest artifact is selected.
- [x] Filtering and pagination change presentation only.

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

No separate human-participant session is claimed at the `90fb7d8` checkpoint. Deterministic
Streamlit AppTest coverage verifies the six screens and required trust content; a future usability
study remains distinct from implementation acceptance.

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

None of these stop conditions was present at the implementation/adversarial checkpoint. The open P2
cache/session growth residual is availability debt, requires repeated explicit local selections,
and does not change the GO decision for the single-user local scope.
