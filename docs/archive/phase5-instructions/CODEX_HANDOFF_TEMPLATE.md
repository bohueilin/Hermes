# Hermes Codex Handoff

> Codex must copy this template to `CODEX_HANDOFF.md` in the repository root and update it throughout the run.

## 1. Executive summary

- Highest phase completed:
- Overall status: `GREEN` / `PARTIAL` / `BLOCKED`
- One-sentence result:
- Single most important limitation:

## 2. Repository state

| Field | Value |
|---|---|
| Repository root | |
| Starting branch | |
| Starting commit | |
| Ending branch | |
| Ending commit | |
| Working tree | clean / dirty |
| Remote actions | none expected |

## 3. Environment

| Field | Observed value |
|---|---|
| Python executable | |
| Python version | |
| Conda/virtual environment | |
| Hermes version | |
| MetaDrive version | |
| MetaDrive source commit | |
| OS/architecture | |

## 4. Phase status

| Phase | Status | Acceptance result | Commit |
|---|---|---|---|
| Phase 0 — doctor/bootstrap | Pre-existing | | `c181509...` |
| Phase 1 — evidence core | | | |
| Phase 2 — MetaDrive adapter | | | |
| Phase 3 — shield/challenges | | | |
| P3 hardening | | | |

Use `COMPLETE`, `PARTIAL`, `BLOCKED`, or `NOT_STARTED`.

## 5. Architecture implemented

Describe:

- domain contracts;
- scenario model;
- adapter boundary;
- policy and shield boundary;
- orchestrator;
- trace and artifact system;
- verifier system;
- release gate;
- independent verification;
- comparison tooling when present.

## 6. Major decisions and assumptions

| Decision or assumption | Rationale | Consequence | Location in decision log |
|---|---|---|---|
| | | | |

## 7. Files changed

### Created

-

### Modified

-

### Intentionally untouched

- `third_party/metadrive/`
- generated artifacts except ignored local evidence
- Git remotes and external infrastructure

## 8. Dependencies

| Dependency | Version bound | Runtime/dev | Why required |
|---|---|---|---|
| | | | |

## 9. Validation results

### Full quality gates

| Command | Exit code | Actual result |
|---|---:|---|
| `python -m pip install -e ".[dev]"` | | |
| `python -m pytest -q` | | |
| `python -m ruff check .` | | |
| `python -m hermes doctor` | | |
| `git diff --check` | | |

Include the exact test count.

## 10. Phase 1 demonstrations

| Run | Expected | Actual verdict | Exit | Artifact path | Trace digest |
|---|---|---|---:|---|---|
| Nominal | PASS | | | | |
| Collision | HOLD | | | | |
| Boundary | HOLD | | | | |
| Soft degradation | CONDITIONAL | | | | |
| Tampered artifact | INVALID_EVIDENCE | | | | |
| Repeated nominal | same digest | | | | |

### Failed hard invariants

- Collision run:
- Boundary run:

### Tamper result

- Modified file/field:
- First mismatch identified:
- Verification behavior:

### Determinism result

- Compared run IDs:
- Event equality:
- Trace-digest equality:
- Metrics equality:
- Findings equality:
- Verdict equality:

## 11. Phase 2 MetaDrive result

| Item | Result |
|---|---|
| API reconnaissance complete | |
| `hermes sim-smoke --headless` | |
| Nominal run verdict | |
| Artifact path | |
| Trace digest | |
| Independent verification | |
| MetaDrive rerun during verification | must be no |
| Unsupported evidence | |
| Determinism/tolerance note | |
| `third_party/metadrive` clean | |

## 12. Phase 3 shield/challenge result

| Item | Baseline | Shielded/candidate |
|---|---|---|
| Scenario | | |
| Verdict | | |
| Collision | | |
| Minimum TTC | | |
| Progress | | |
| Comfort finding | | |
| Override count | | |
| Override reasons | | |
| Artifact path | | |

Explain visible candidate-versus-executed action differences and residual regressions.

## 13. Known limitations and residual risks

| Limitation or risk | Impact | Mitigation/current status | Owner/next step |
|---|---|---|---|
| | | | |

Required reminders:

- simulation is not real-world validation;
- fake dynamics are an architectural test double;
- local hashes are not independent authenticity;
- prototype thresholds are illustrative;
- unsupported signals are explicit.

## 14. Blockers and failed attempts

For each blocker:

- What failed:
- Evidence/output:
- Corrections attempted:
- Why work stopped or was deferred:
- Independent work completed despite blocker:

## 15. Local commits

```text
<git log --oneline --decorate -8>
```

No push or PR should have occurred.

## 16. Final Git status

```text
<git status --short>
```

Explain every remaining modified or untracked file.

## 17. Reproduction commands

Provide the exact commands needed to reproduce every completed demonstration.

## 18. Recommended next action

Provide exactly one highest-leverage next action and its exact command.
