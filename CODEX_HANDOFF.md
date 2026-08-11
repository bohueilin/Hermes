# Hermes Codex Handoff

## 1. Executive summary

- Highest phase completed: Phase 1 acceptance; final review and commit are in progress.
- Overall status: `PARTIAL` until the Phase 1 review/commit checkpoint is complete.
- Result: Hermes now executes deterministic fake scenarios into self-verified, atomic evidence
  bundles and recomputes their verdicts without simulator execution.
- Most important limitation: local hashes prove internal consistency, not independent authenticity;
  the fake adapter is not a physics or real-world performance model.

## 2. Repository state

| Field | Value |
|---|---|
| Repository root | `/Users/bohueilin/Documents/GitHub/Hermes` |
| Starting branch | `feat/unattended-evidence-core` |
| Starting commit | `430ef0ca6492250977702a0b421515f93203d58d` |
| Ending branch | in progress |
| Ending commit | in progress |
| Working tree | dirty with intentional Phase 1 work |
| Remote actions | none |

## 3. Environment

| Field | Observed value |
|---|---|
| Python executable | `/Users/bohueilin/miniconda3/envs/hermes-dev/bin/python` |
| Python version | `3.11.15` |
| Environment | Conda `hermes-dev` |
| Hermes version | `0.1.0` editable |
| MetaDrive | `0.4.3`; not used by Phase 1 runtime |
| MetaDrive source commit | `85e5dadc6c7436d324348f6e3d8f8e680c06b4db` |
| OS/architecture | macOS arm64 |

## 4. Phase status

| Phase | Status | Acceptance result | Commit |
|---|---|---|---|
| Phase 0 | Pre-existing | 26-test baseline and doctor preserved | `c181509` |
| Phase 1 | COMPLETE, UNCOMMITTED | 131 tests; Ruff; doctor; all demos green; three final re-reviews GO | pending |
| Phase 2 | NOT_STARTED | gated on Phase 1 | — |
| Phase 3 | NOT_STARTED | gated on Phase 2 | — |
| P3 hardening | NOT_STARTED | gated | — |

## 5. Architecture implemented

Strict simulator-neutral domain contracts, bounded YAML schemas, deterministic fake adapter,
baseline policy/no-op shield, lifecycle-safe orchestrator, canonical event chain, pure metrics,
six-finding verifier suite, non-compensatory release gate, native atomic no-replace artifact writer, detached bundle
root, and stored-only independent verification. See `docs/phase1-architecture.md`.

## 6. Dependencies

| Dependency | Version bound | Type | Reason |
|---|---|---|---|
| Pydantic | `>=2.10,<3` | runtime | strict typed contracts and persisted schemas |
| PyYAML | `>=6.0,<7` | runtime | bounded versioned scenario/gate YAML |
| Rich | `>=13.7,<15` | runtime | readable truthful terminal output |
| Typer | `>=0.12,<1` | runtime | CLI and stable command surfaces |

## 7. Validation results to date

- Preflight: 26 tests passed; Ruff clean; doctor 18 PASS / 1 acceptable NOT_AVAILABLE.
- Editable install succeeded with Pydantic 2.13.4 and PyYAML 6.0.3 already present.
- Latest full suite: 131 passed in 2.08s.
- Ruff: all checks passed.
- Doctor: 17 PASS, one expected dirty-tree WARN, one optional-display NOT_AVAILABLE, no FAIL.
- `git diff --check`: clean.
- No MetaDrive runtime was launched.

## 8. Demonstration results

| Run | Actual verdict | Exit | Artifact | Trace digest |
|---|---|---:|---|---|
| Nominal | PASS | 0 | `artifacts/phase1-nominal` | `9be051b3d6e3f31c4a69f30d9766bc70a23608623ee4f09e70778740767a5958` |
| Collision | HOLD | 20 | `artifacts/phase1-collision` | `41720038f8115c229c25a5fda78afc2fa3e090b3b25d3e27540e98ecd2392133` |
| Boundary | HOLD | 20 | `artifacts/phase1-boundary` | `47c96008e5c7d0895b5ef71b3b32d6d5fe82017caab86f7a7ce9f37bcfc3b904` |
| Soft degradation | CONDITIONAL | 10 | `artifacts/phase1-conditional` | `d85ec5d7cd439eff600627c69804c80fa19cf231bc89010a349cb3a54feeee5f` |
| Tampered action | INVALID_EVIDENCE | 30 | `artifacts/phase1-tampered` | first mismatch sequence 0 |
| Repeated nominal | PASS | 0 | `artifacts/phase1-nominal-repeat` | same `9be051b3...5958` |

Independent stored verification reproduced PASS/0, both HOLD/20 verdicts, and CONDITIONAL/10
without simulator execution. The tampered copy reported detached-bundle, file-digest, and event-hash
failures. The two nominal runs had byte-identical execution context, events, metrics, findings,
verdict, and trace root; `events.jsonl` SHA-256 was
`233677706116f6b61b0f6b613410890e6238455b4816fe69130c5341d1b7283b`.

## 9. Known limitations

- Simulation only; no real-vehicle, road-safety, certification, or compliance claim.
- Fake dynamics validate architecture, not physics.
- Thresholds are illustrative.
- Local SHA-256 evidence is not independently authenticated.
- CLI usage/type errors are configuration exit 40; Phase 0 doctor remains 0/1.
- Descriptor snapshot checks detect concurrent replacement during capture but do not provide an
  external trust anchor or filesystem immutability after verification returns.

## 10. Git and next action

No push, PR, remote, third-party simulator, or external-infrastructure mutation occurred.

Single best next command while this handoff is in progress:

```bash
conda run -n hermes-dev python -m pytest -q
```
