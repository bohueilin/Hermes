# Hermes Validation Matrix

Use this matrix after the unattended Codex run. Do not accept a phase based only on Codex's summary; rerun the relevant commands.

## 1. Repository and environment

| Check | Command | Pass condition |
|---|---|---|
| Correct repository | `pwd` | `/Users/bohueilin/Documents/GitHub/Hermes` |
| Correct environment | `which python` | path contains `/envs/hermes-dev/` |
| Correct Python | `python --version` | Python 3.11.x |
| Feature branch | `git branch --show-current` | not `main` during development |
| No accidental remote action | `git remote -v` and handoff | no unexpected remote changes/push |
| Third-party clean | `git -C third_party/metadrive status --short` | no output |
| Generated evidence ignored | `git status --short` | no `artifacts/<run-id>` staged/untracked |

## 2. Quality gates

Run:

```bash
cd /Users/bohueilin/Documents/GitHub/Hermes
conda activate hermes-dev
python -m pip install -e ".[dev]"
python -m pytest -q
python -m ruff check .
python -m hermes doctor
git diff --check
```

| Gate | Pass condition |
|---|---|
| Install | editable install succeeds |
| Tests | all tests pass; count reported |
| Ruff | no violations |
| Doctor | no FAIL; optional display may be NOT_AVAILABLE |
| Whitespace | `git diff --check` produces no error |

## 3. Architecture review

| Requirement | Evidence to inspect | Pass condition |
|---|---|---|
| Domain is simulator-neutral | imports under `src/hermes/domain` | no MetaDrive import |
| Adapter boundary | `SimulatorAdapter` and implementations | fake and MetaDrive implement same contract |
| Thin CLI | `src/hermes/cli.py` | orchestration delegated to modules |
| Candidate vs executed action | models/events | both always present |
| Explicit shield reason | events/findings | override reason codes preserved |
| Independent gate | gate module | consumes findings, not simulator objects |
| Stored verification | verification module | no simulator rerun |
| Explicit unavailable evidence | enums/findings | `NOT_AVAILABLE` with reason |

## 4. Phase 1 commands

Delete or choose unique run IDs before rerunning; Hermes should refuse overwrite.

### Nominal

```bash
hermes run \
  --simulator fake \
  --scenario scenarios/fake_nominal.yaml \
  --policy baseline \
  --seed 7 \
  --run-id review-phase1-nominal
echo "exit=$?"
```

Expected: `PASS`, exit `0`.

### Collision

```bash
hermes run \
  --simulator fake \
  --scenario scenarios/fake_collision.yaml \
  --policy baseline \
  --seed 7 \
  --run-id review-phase1-collision
echo "exit=$?"
```

Expected: `HOLD`, exit `20`, collision hard invariant.

### Boundary

```bash
hermes run \
  --simulator fake \
  --scenario scenarios/fake_boundary.yaml \
  --policy baseline \
  --seed 7 \
  --run-id review-phase1-boundary
echo "exit=$?"
```

Expected: `HOLD`, exit `20`, boundary hard invariant.

### Conditional

```bash
hermes run \
  --simulator fake \
  --scenario scenarios/fake_soft_degradation.yaml \
  --policy baseline \
  --seed 7 \
  --run-id review-phase1-conditional
echo "exit=$?"
```

Expected: `CONDITIONAL`, exit `10`, no hard invariant failure.

### Independent verification

```bash
hermes verify-artifact artifacts/review-phase1-nominal
echo "exit=$?"
```

Expected: `PASS`, exit `0`, no simulator invocation.

## 5. Evidence-bundle review

```bash
find artifacts/review-phase1-nominal -maxdepth 1 -type f -print | sort
```

Required:

```text
manifest.json
scenario.resolved.yaml
gate-config.resolved.yaml
events.jsonl
metrics.json
verdict.json
trace.sha256
```

Inspect:

```bash
python -m json.tool artifacts/review-phase1-nominal/manifest.json
python -m json.tool artifacts/review-phase1-nominal/metrics.json
python -m json.tool artifacts/review-phase1-nominal/verdict.json
head -n 2 artifacts/review-phase1-nominal/events.jsonl
```

| Bundle property | Pass condition |
|---|---|
| Git provenance | real commit and dirty state recorded |
| Adapter provenance | fake adapter named; no MetaDrive claim |
| Scenario digest | present and verification succeeds |
| Policy/shield/gate versions | explicit |
| Seed and horizon | explicit |
| Candidate/executed action | present in every event |
| Hash chain | previous/current hash in every event |
| Trace digest | matches `trace.sha256` |
| Required files | manifest inventory agrees |

## 6. Tamper test

Make a copy outside the original run, modify one action, and verify.

Expected:

- verdict `INVALID_EVIDENCE`;
- exit `30`;
- first mismatched event sequence identified;
- no simulator rerun.

Also review automated tests for:

- truncated file;
- missing file;
- modified scenario;
- modified gate config;
- modified metrics;
- modified verdict;
- duplicate sequence.

## 7. Determinism test

Run the same nominal scenario with a second run ID.

Expected identical deterministic:

- events excluding non-deterministic metadata;
- final event hash;
- `trace.sha256`;
- metrics;
- findings;
- verdict.

Allowed differences:

- run ID;
- UTC creation time;
- host wall-clock duration.

## 8. Gate-integrity review

| Attempted false pass | Required behavior |
|---|---|
| Collision plus high progress | HOLD |
| Boundary violation plus good comfort | HOLD |
| Missing required evidence | HOLD or INVALID per explicit config; never PASS |
| Modified stored verdict | INVALID_EVIDENCE |
| Policy/adapter exception | operational error, never PASS |
| Unsupported schema version | actionable rejection |
| NaN/Infinity | rejection, not ambiguous serialization |

## 9. Phase 2 MetaDrive validation

Only run when Codex reports Phase 2 complete.

```bash
hermes sim-smoke --headless
echo "exit=$?"
```

Then run the documented MetaDrive nominal command and verify its artifact.

| Check | Pass condition |
|---|---|
| Headless smoke | succeeds |
| Bounded horizon | run terminates predictably |
| Adapter provenance | MetaDrive 0.4.3 and source commit recorded |
| Stored verification | succeeds without launching MetaDrive |
| Unsupported signal | explicit NOT_AVAILABLE |
| Third-party checkout | remains clean |
| Phase 1 regression | all Phase 1 tests/demos remain green |

## 10. Phase 3 shield/challenge validation

Only run when Codex reports Phase 3 complete.

| Check | Pass condition |
|---|---|
| Baseline artifact | complete and verifiable |
| Shielded artifact | complete and verifiable |
| Candidate action | preserved |
| Executed action | preserved |
| Override reasons | explicit stable codes |
| No-override tests | present |
| Hard invariant precedence | unchanged |
| Comparison | reports improvements and regressions |
| Claims | simulation-only and illustrative |

## 11. Documentation review

Required when relevant:

- `CODEX_HANDOFF.md`
- `docs/decision-log.md`
- `docs/phase1-architecture.md`
- `docs/phase1-requirements-traceability.md`
- `docs/phase2-metadrive-adapter.md` when Phase 2 is attempted
- `docs/demo-runbook.md` when demo hardening is attempted
- updated `README.md`

Requirements traceability must connect hazard/requirement to scenario, component, verifier, test, evidence, and gate consequence.

## 12. Git review

```bash
git status --short
git log --oneline --decorate -8
git diff main...HEAD --stat
git diff main...HEAD --check
```

Pass conditions:

- no simulator assets, generated evidence, caches, or secrets in commits;
- checkpoint commits correspond to green phases;
- no push or PR unless the user later requests it;
- remaining working-tree changes are explained in `CODEX_HANDOFF.md`.

## Final acceptance decision

| Decision | Criteria |
|---|---|
| Accept Phase 1 | all Phase 1 gates and evidence review pass |
| Accept Phase 2 | Phase 1 remains green and real headless adapter artifact verifies |
| Accept Phase 3 | Phase 2 remains green and shield/challenge evidence is credible |
| Return for correction | any false pass, unverifiable artifact, hidden unavailable evidence, or unsupported safety claim |
