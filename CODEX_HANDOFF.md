# Hermes unattended-build handoff

## Executive summary

- **Highest completed phase:** Phase 5 — CI and developer experience, including the ordered
  post-Phase-3 deterministic-fault hardening.
- **Status:** implementation and local validation are green. No dashboard, RL, CARLA, ROS 2,
  Autoware, real-log training, cloud deployment, hardware integration, or real-vehicle interface was
  started.
- **Branch:** `feat/unattended-evidence-core`.
- **Implementation checkpoint:** `267a88e5193b226b60eeefd42e2a0e1ee5c6ae6c`.
- **Environment:** Conda `hermes-dev`, Python 3.11.15, editable `hermes-autonomy` 0.1.0.
- **Simulator:** MetaDrive 0.4.3 from clean `third_party/metadrive` commit
  `85e5dadc6c7436d324348f6e3d8f8e680c06b4db`.
- **Remote actions:** none. Nothing was pushed, published, deployed, purchased, or configured
  remotely.

Hermes remains a simulation-only prototype. Every retained final artifact reports
`NOT_AUTHENTICATED`; none is road-safety, certification, compliance, or deployment evidence.

## Starting and ending snapshot

| Item | Starting state | Ending state |
|---|---|---|
| Branch | `main` | `feat/unattended-evidence-core` |
| Commit | `c181509a691b132cb732a50c24612f6bd40bafca` | implementation checkpoint `267a88e5193b226b60eeefd42e2a0e1ee5c6ae6c`; the final documentation-only handoff commit is `HEAD` at delivery |
| Tests | 26 passing | 269 passing |
| Ruff | passing | passing |
| Doctor | working | no `FAIL`; 18 `PASS` and 1 optional `NOT_AVAILABLE` in the clean activated environment |

The repository was clean at the baseline. The final `git status --short`, after committing this
handoff, is expected and subsequently verified to produce no output; the exact final `HEAD` is
reported in the delivery response because a commit cannot embed its own content-derived SHA.

## Phase and commit history

| Phase/checkpoint | Result | Local commit |
|---|---|---|
| Phase 0 package and doctor | complete | `c181509` |
| Unattended build plan | complete | `430ef0c` |
| Phase 1 deterministic evidence core | complete | `635c246` |
| Phase 2 pinned MetaDrive adapter | complete | `638a951` |
| Phase 3 shield, challenges, comparison | complete | `862b98f` |
| Phase 4 faults + Phase 5 CI/dev hardening | complete | `267a88e` |

No predecessor gate was skipped.

## Attempted, completed, blocked, and deferred scope

| Scope | Status | Evidence |
|---|---|---|
| Phase 1 deterministic evidence core | completed | fake PASS/HOLD/CONDITIONAL cases, stored verification, tamper rejection, deterministic replay |
| Phase 2 bounded MetaDrive adapter | completed | real 0.4.3 headless smoke, clean pinned source, stored artifact verification |
| Phase 3 shield and challenges | completed | lead-vehicle and cut-in baseline/shielded artifacts and compatible comparisons |
| P3 deterministic fault hardening | completed | all seven mechanisms covered, replay verified, deterministic companion files |
| Phase 5 CI/developer experience | completed locally | exact CI command set, Make targets, strict markers, runbook; no remote workflow run |
| Dashboard, RL, CARLA, ROS 2, Autoware, cloud, hardware, real vehicle | deferred by scope | no implementation started |
| Blocked work | none | all prioritized predecessor gates passed |

## Architecture and key decisions

The simulator-neutral path is `strict scenario -> orchestrator -> policy candidate -> deterministic
shield -> fault wrappers -> adapter -> canonical trace -> offline verifiers -> release gate -> atomic
artifact bundle`. Domain models, evidence, verification, gate logic, comparison, shields, and faults
do not import the external MetaDrive package or runtime adapters; simulator runtime coupling stays
in `src/hermes/adapters/` and the MetaDrive policy wrapper. A data-only, import-safe compatibility
declaration supplies recorded profile constants to both runtime and stored verification.

Key decisions were to keep host wall-clock timing out of deterministic evidence, store simulated
latency with an explicit source, preserve schema-1 bytes while adding schema 2/3 contracts, fail
closed on unsupported/mixed schemas, bind observation noise to source packets so held observations
stay held, and reject MetaDrive IDM observation faults rather than claim interception of native
simulator state.

## Files and dependencies

The authoritative inventory is `git diff --name-status c181509..267a88e`. It includes:

- root/build: `.github/workflows/ci.yml`, `Makefile`, `pyproject.toml`, `README.md`,
  `VALIDATION_MATRIX.md`, `CODEX_HANDOFF_TEMPLATE.md`, and the project policy/planning documents;
- configuration/scenarios: three versioned gate/shield configs and eight fake/MetaDrive YAML
  scenarios;
- implementation: new simulator-neutral packages under `src/hermes/{domain,scenarios,runtime,
  evidence,verifiers,gates,comparison,shields,faults,policies}`, MetaDrive/fake adapters, and the
  extended CLI/error layer;
- tests: CLI, unit, and integration coverage under `tests/`; real MetaDrive launch remains a
  manual `make sim-smoke` gate rather than part of the default automated suite; and
- documentation: Phase 1 architecture/traceability, Phase 2 adapter evidence, Phase 3 shield,
  Phase 4/5 hardening, decision log, PM material, unattended execution, and demo runbook.

Runtime dependencies are `pydantic>=2.10,<3` for strict typed schemas, `PyYAML>=6.0,<7` for
versioned configuration, and the existing Typer/Rich CLI stack. Development extras remain bounded
to pytest 8 and Ruff. No database, web framework, dashboard, ML stack, or cloud SDK was added.

## What Phase 4 and Phase 5 added

- Scenario schema 3.0 and sibling evidence schema 2.0, preserving legacy schema-1 bytes/digests.
- Strict, simulator-neutral observation delay, frozen observation, dropped/held observation,
  bounded source-packet noise, control delay, steering saturation, and brake saturation.
- Typed raw/delivered/result observation evidence and distinct candidate/permitted/executed actions.
- Exact stored-only replay of deterministic shield and fault transforms.
- Required fault-coverage finding, including every scheduled freeze/dropout step.
- MetaDrive IDM observation-fault rejection before adapter construction; action faults remain the
  only truthful supported faults for that installed-policy profile.
- Fault-profile comparison compatibility, explicit schema-version dispatch, deterministic artifact
  fixtures, and coherent-rehash negative tests.
- Stable CLI errors: `USAGE_ERROR`, `CONFIGURATION_ERROR`, `OPERATIONAL_ERROR`,
  `INVALID_EVIDENCE`, and `INCOMPATIBLE_EVIDENCE`.
- `make check`, no-overwrite `make demo-phase1`, local/manual `make sim-smoke`, strict pytest
  markers, and PR-safe `.github/workflows/ci.yml` excluding real MetaDrive tests.
- Lowercase `docs/demo-runbook.md`, the Phase 4/5 design record, decision log, and requirements
  traceability.

The exact runtime order is:

```text
raw observation -> observation faults -> candidate -> shield-permitted action
-> control delay -> saturation -> executed action -> simulator result
```

## Final validation results

All commands below were run from `/Users/bohueilin/Documents/GitHub/Hermes` on 2026-08-11.

| Command | Exit | Observed result |
|---|---:|---|
| `python -m pip install -e ".[dev]"` | 0 | editable `hermes-autonomy==0.1.0` installed |
| `python -m pip show hermes-autonomy` | 0 | version 0.1.0; editable project location is this repository |
| `python -m pytest -q` | 0 | **269 passed in 4.52 s** (final standalone run) |
| `python -m pytest -q -m "not metadrive"` | 0 | **269 passed in 4.53 s** |
| `python -m ruff check .` | 0 | **All checks passed** |
| `make check` in activated `hermes-dev` | 0 | Ruff green; **269 passed in 4.34 s**; doctor green |
| `make demo-phase1 DEMO_RUN_ID=phase5-demo-final` | 0 | run and stored verification both `PASS` |
| `make sim-smoke` | 0 | MetaDrive 0.4.3, pinned commit, 5 headless steps |
| three `doctor` entry paths | 0 each | all three executed successfully |
| `git diff --check` | 0 | no whitespace errors |

Activated-environment doctor output was **18 PASS, 1 NOT_AVAILABLE, 0 WARN, 0 FAIL**. The sole
`NOT_AVAILABLE` is optional `DISPLAY`/`WAYLAND_DISPLAY`; the independent headless prerequisites
check passed with `CocoaGraphicsPipe`. Direct commands launched from the parent base shell still
truthfully warned that its environment variables identify Conda base, even though the explicit
Python executable was `hermes-dev`; `conda run -n hermes-dev make check` removed that shell-context
warning.

The three equivalent doctor paths were:

```bash
hermes doctor
python -m hermes doctor
python -m hermes.cli doctor
```

## Phase 1 gate demonstrations

These exact commands were run in `hermes-dev`; every artifact was then independently checked from
stored files only:

```bash
hermes run --simulator fake --scenario scenarios/fake_nominal.yaml \
  --policy baseline --seed 7 --run-id phase1-nominal
hermes verify-artifact artifacts/phase1-nominal
hermes run --simulator fake --scenario scenarios/fake_collision.yaml \
  --policy baseline --seed 7 --run-id phase1-collision
hermes run --simulator fake --scenario scenarios/fake_boundary.yaml \
  --policy baseline --seed 7 --run-id phase1-boundary
hermes run --simulator fake --scenario scenarios/fake_soft_degradation.yaml \
  --policy baseline --seed 7 --run-id phase1-conditional
hermes verify-artifact artifacts/phase1-tampered
```

| Case | Actual result | Exit | Artifact / digest |
|---|---|---:|---|
| nominal | `PASS` | 0 | `artifacts/phase1-nominal` / `f515c16243d2b07c8a4b4ffd286edd5ff1c4ffa9486d3b28d034b40420ba234e` |
| collision | `HOLD` | 20 | `artifacts/phase1-collision` / `ecaa3b9222612044349b643c44406c2088cfb335b07f7bf4da56ac587bb76a24` |
| boundary | `HOLD` | 20 | `artifacts/phase1-boundary` / `19cdf5e895c06d5bee9a250a9c236039543a1b17d503bd9a31547f9ec101e694` |
| soft degradation | `CONDITIONAL` | 10 | `artifacts/phase1-conditional` / `dfd8cc47423f8b93e70da1f5bcac00d21f363aec4a435da8ca9518b111704158` |
| modified executed action | `INVALID_EVIDENCE` | 30 | `artifacts/phase1-tampered`; first mismatched sequence reported |

`artifacts/phase1-nominal-repeat` produced the same deterministic event bytes, trace digest,
metrics, findings, and verdict as nominal. Run identity, creation time, and manifest bundle digest
were correctly excluded from that identity claim.

## Current-code demonstrations

All final artifacts below recorded clean repository commit `267a88e...` and independently verified
as `INTERNALLY_CONSISTENT` without rerunning the simulator.

| Artifact | Actual verdict | Trace digest |
|---|---|---|
| `artifacts/phase5-demo-final` | `PASS` | `f515c16243d2b07c8a4b4ffd286edd5ff1c4ffa9486d3b28d034b40420ba234e` |
| `artifacts/phase2-metadrive-final` | `PASS` | `2b5009971c37c1eb65c9cc2830596689b5a25904a9b52b524d5bf77305848987` |
| `artifacts/phase3-lead-baseline-final` | `CONDITIONAL` | `504dfbcdd8f4239f1b9f2a5e94fa64f8a1a6ac108543e46ace12b251aa409bd1` |
| `artifacts/phase3-lead-shielded-final` | `CONDITIONAL` | `7324adbd7fa824f5dd834be2b321e3a5e4da36fbdac6eca99b7ae0c92d49f380` |
| `artifacts/phase3-cutin-baseline-final` | `HOLD` | `00137f7fda53afa3531531bfeae6a8635b95b271707185c6922431633a8a5ef5` |
| `artifacts/phase3-cutin-shielded-final` | `HOLD` | `7a0f0c7954a4257dca7fa2e4d2fbc0c53317b77f846174f7b033da029653e1ae` |
| `artifacts/phase4-fault-final` | `HOLD` | `0943edb0e80c0fbd821b7d544c0da05d204fe86c8a48447bf53eb885d4d8c47d` |
| `artifacts/phase4-fault-final-repeat` | `HOLD` | `0943edb0e80c0fbd821b7d544c0da05d204fe86c8a48447bf53eb885d4d8c47d` |

The Phase 3 lead and cut-in comparisons both remained compatible. In both cases the shielded trace
had improved minimum TTC, regressed route completion/acceleration/jerk, and an unchanged policy
verdict. This is a mixed trade-off, not a blanket shield win. The retained interventions were only
`SPEED_CAP` (36 lead events and 3 cut-in events); no real run fabricated a TTC override.

The fresh fault demonstration produced 20 events / 2.0 simulated seconds and:

- `fault.coverage.required = PASS` for all seven configured mechanisms and scheduled steps;
- maximum observation age `0.30000000000000004 s`;
- p95 simulated control latency `100.00000000000009 ms`;
- one startup control fill;
- 19 steering saturations and 19 brake saturations; and
- `HOLD` because required mission progress failed, not because fault coverage failed.

The two fault artifacts had **8/8 byte-identical deterministic companion files**. Manifest run ID,
creation time, and bundle digest are intentionally nondeterministic metadata.

## Tamper and false-pass results

The final focused adversarial command passed **7 tests**. It covered:

- coherent full-chain rewrites of executed action, command source/latency, fault reasons, and the
  permitted-action delay chain;
- mixed schema-2/schema-1 traces returning `INVALID_EVIDENCE` rather than raising;
- changed result sequence/time/freshness; and
- deterministic companion-file identity.

The complete suite also covers missing/unsupported nested schema versions, missing files,
malformed/duplicate/reordered events, forged metrics/findings/verdict, context substitutions,
early terminal fault schedules, challenge actor/phase contradictions, and verifier filesystem race
conditions.

## Known limitations and non-blocking warnings

- Local SHA-256 is tamper-evident, not authenticated. An author who rewrites a complete bundle can
  recompute hashes.
- Offline verification treats candidate policy proposals and simulator results as trace inputs. It
  exactly replays shield/fault transforms, metrics, verifiers, and gate logic, but does not reexecute
  the policy or simulator.
- MetaDrive assets are present, but upstream provides no checksum manifest; asset integrity is not
  independently verified.
- MetaDrive IDM observation faults are unsupported and fail configuration validation because IDM
  reads native simulator state. This is an explicit truthfulness boundary, not a missing silent path.
- Phase 3 cut-in motion is scripted kinematic replay with `behavior_realism_claim: false`.
- Same-host deterministic physics was observed; cross-platform bitwise MetaDrive determinism is not
  claimed.
- `artifacts/phase4-fault-demo-dev` is a stale development artifact created before source-packet
  noise and full-schedule coverage corrections. It now correctly verifies invalid and is not an
  acceptance artifact. `phase4-fault-final*` are authoritative.
- The GitHub Actions file was validated locally through its exact commands; no remote workflow was
  enabled or run because remote mutation was outside authorization.

There is no blocker for the completed local scope.

## Repository state and next action

Generated artifacts remain ignored and unstaged. `third_party/metadrive` is clean. No remote action
occurred. Final `git status --short` after the handoff commit: **no output (clean)**.

**Recommended next action:** run `git diff main...HEAD` to review the complete local branch and its
handoff, then decide whether to push/open a PR. Do not begin dashboard or RL work in the same
review.
