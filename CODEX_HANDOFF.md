# Hermes Codex Handoff

## 1. Executive summary

- **Highest completed phase:** Phase 3 — deterministic safety shield, two bounded MetaDrive
  challenge scenarios, stored shield replay, and stored-artifact comparison.
- **Overall status:** `GREEN` for implementation and local evidence validation; the Phase 3
  checkpoint commit is intentionally still pending in this snapshot.
- **Result:** Hermes now preserves policy proposal, shield-selected execution, simulator outcome,
  verifier findings, gate decision, and replayable evidence as separate reviewable surfaces across
  both the deterministic fake adapter and pinned MetaDrive 0.4.3.
- **Most important limitation:** this is simulation-only prototype evidence. The retained Phase 3
  runs were dominated by the illustrative `5.5 m/s` speed-cap rule; they do not establish a complete
  shield, realistic traffic behavior, perception performance, road safety, certification,
  compliance, or deployment permission.
- **Remote actions:** none. No push, pull request, deployment, publication, purchase, remote
  configuration change, or infrastructure mutation was performed.

## 2. Repository state

| Field | Observed value |
|---|---|
| Repository root | `/Users/bohueilin/Documents/GitHub/Hermes` |
| Starting branch | `main` |
| Starting commit | `c181509a691b132cb732a50c24612f6bd40bafca` |
| Ending branch | `feat/unattended-evidence-core` |
| Current committed HEAD | `638a951278d7b6ab5ffaad4bb514fc7447fa9b62` |
| Ending Phase 3 state | validated but uncommitted; checkpoint commit pending |
| Working tree | dirty only with the intended Phase 3 source, tests, and documentation listed below |
| Generated evidence | under ignored `artifacts/`; not staged |
| External simulator | `third_party/metadrive` clean at its recorded commit |

The Phase 3 artifacts truthfully record repository commit `638a951278d7b6ab5ffaad4bb514fc7447fa9b62`
and `repository_dirty: true` because they were generated before the Phase 3 checkpoint commit. Both
stored comparisons therefore emit the expected dirty-worktree warning.

## 3. Environment

| Field | Observed value |
|---|---|
| Python executable | `/Users/bohueilin/miniconda3/envs/hermes-dev/bin/python3.11` |
| Python version | 3.11.15 |
| Environment | Conda `hermes-dev` |
| Hermes distribution | `hermes-autonomy` 0.1.0, editable |
| MetaDrive | 0.4.3 from `third_party/metadrive` |
| MetaDrive commit | `85e5dadc6c7436d324348f6e3d8f8e680c06b4db` |
| OS / architecture | `macOS-26.5.2-arm64-arm-64bit` / `arm64` |

## 4. Phase status

| Phase | Status | Acceptance result | Local commit |
|---|---|---|---|
| Phase 0 — doctor/bootstrap | COMPLETE, pre-existing | package and doctor baseline preserved | `c181509` |
| Build-plan checkpoint | COMPLETE | unattended plan and gates recorded | `430ef0c` |
| Phase 1 — evidence core | COMPLETE | all four verdict paths, tamper rejection, deterministic repeat, stored replay green | `635c246` |
| Phase 2 — MetaDrive adapter | COMPLETE | real headless smoke/run, pinned provenance, stored replay, deterministic repeat green | `638a951` |
| Phase 3 — shield/challenges | COMPLETE, UNCOMMITTED | 221 tests, Ruff, doctor, two real challenge pairs, repeats, replay, and comparison green | pending |
| Optional P3 hardening | DEFERRED | comparison was pulled forward because Phase 3 required it; CI and additional fault injection were not attempted | none |
| Dashboard, RL, CARLA, ROS 2, Autoware, HIL, real logs | DEFERRED | explicitly out of current scope | none |

No predecessor gate was skipped.

## 5. Architecture implemented

- **Simulator-neutral contracts:** strict Pydantic domain models preserve observations, vehicle
  state, candidate and executed actions, termination, findings, measurements, manifests, and gate
  results without importing MetaDrive.
- **Strict scenario/config loading:** duplicate YAML keys, unknown fields, non-finite values, and
  contradictions are rejected. Scenario schema 1.0 remains byte-compatible with Phase 1/2;
  MetaDrive challenge schema 2.0 requires one typed challenge and forbids fake hazards.
- **Adapter boundary:** the deterministic fake adapter is an architectural test double.
  `MetaDriveAdapter` lazily validates the exact external version, source, commit, and cleanliness,
  owns reset/step/close, and uses adapter version 1.1 only for challenge runs.
- **Policy/permission boundary:** the installed MetaDrive IDM policy proposes a binary32-compatible
  candidate. The no-op or deterministic shield returns the executed action and ordered reason codes;
  MetaDrive receives exactly the trace-bound executed action.
- **Challenge actor manager:** the lead actor receives fixed native dynamic actions on a scheduled
  neutral/brake/recovery sequence. The cut-in uses a deterministic smoothstep
  `scripted_kinematic_replay`. Both use a fixed actor name and seed and explicitly record
  `behavior_realism_claim: false`.
- **Ground-truth challenge signals:** front bumper gap and actor-relative longitudinal speed are
  derived from the named actor's actual oriented geometry and velocity projected into the ego frame.
  This is simulator ground truth, not a perception claim. TTC exists only for a laterally overlapping,
  ahead, closing actor.
- **Orchestration:** one simulator-neutral pipeline composes scenario, adapter, policy, shield,
  trace, metrics, verifiers, gate, and atomic artifact publication. Operational failures do not
  become policy verdicts or partial bundles.
- **Evidence:** canonical JSON and SHA-256 bind every event to a constant run context and previous
  event. A bundle digest binds manifest and companion bytes. Wall-clock publication metadata is kept
  out of deterministic event content.
- **Verifiers/gate:** trace, collision, boundary, destination-plus-progress, acceleration, and jerk
  findings feed a non-compensatory gate. Collision and boundary hard failures force `HOLD`; missing
  evidence is `NOT_AVAILABLE`, never zero or success.
- **Independent stored replay:** artifact verification captures required files once through
  descriptor-relative no-follow reads, rejects mutations during capture, reruns metrics/verifiers/
  gate without a simulator, and replays every deterministic shield decision from stored policy-input
  evidence.
- **Comparison:** `hermes compare` first verifies both immutable snapshots, fails closed on invalid
  or incompatible inputs, and reports verdict, hard failures, collision, TTC, progress, comfort,
  latency, interventions, and evidence availability without rerunning MetaDrive.

## 6. Major decisions and assumptions

| Decision | Rationale and consequence | Decision log |
|---|---|---|
| Local hashes are called tamper-evident, never tamper-proof | A party able to rewrite the whole bundle can recompute local hashes; authenticity remains `NOT_AUTHENTICATED` | `docs/decision-log.md` |
| Destination fact and configured progress are both required | Prevents numeric route progress from fabricating mission completion; the MetaDrive gate uses illustrative 95% progress | `docs/decision-log.md` |
| Challenge adapter is 1.1; nominal remains 1.0 | Binds the additional actor manager and signal mappings without silently changing old artifact meaning | `docs/decision-log.md` |
| Shield reasons exist only when the action changes | Keeps `override_reasons` semantically exact even when a rule triggers against an already-identical full-brake candidate | `docs/decision-log.md` |
| Override count counts changed-action events | A separate histogram counts reasons, because one event may have multiple reasons | `docs/decision-log.md` |
| Cut-in is scripted kinematic replay | MetaDrive 0.4.3 has no reliable stock scheduled near-field cut-in primitive; the closest deterministic mechanism is used and labeled non-realistic | `docs/decision-log.md` |
| Comparison compatibility is fail-closed | Scenario, gate, adapter, policy, simulator, seed, cadence, platform, evidence schema, and repository commit must match; shield identity may differ intentionally | `docs/decision-log.md` |
| Intervention changes are descriptive | More interventions are not automatically safer; comparison reports them as `NOT_COMPARABLE` | `docs/decision-log.md` |

All shield and gate thresholds are versioned configuration labeled illustrative. No real-vehicle
control surface, network call, telemetry, LLM control loop, or physical actuator integration was
added.

## 7. Files created or changed

### Phase 1 and Phase 2, committed

- Evidence/domain/runtime packages under `src/hermes/{domain,evidence,gates,verifiers,runtime}/`.
- Fake and MetaDrive adapters under `src/hermes/adapters/`; baseline and installed-IDM policy
  wrappers under `src/hermes/policies/`; no-op shield under `src/hermes/shields/`.
- Strict scenarios under `scenarios/fake_*.yaml` and `scenarios/metadrive_nominal.yaml`.
- Versioned gate configuration under `config/gates.phase1.yaml` and `config/gates.phase2.yaml`.
- CLI composition and tests under `src/hermes/cli.py` and `tests/{unit,integration,cli}/`.
- Architecture, traceability, runbook, learning, validation, decision-log, and execution documents.

### Phase 3, currently created

- `config/shield.phase3.yaml`
- `docs/phase3-safety-shield.md`
- `scenarios/metadrive_lead_vehicle_hard_brake.yaml`
- `scenarios/metadrive_cut_in_near_field.yaml`
- `src/hermes/adapters/metadrive_challenge.py`
- `src/hermes/comparison/__init__.py`
- `src/hermes/comparison/compare.py`
- `src/hermes/shields/config.py`
- `src/hermes/shields/deterministic.py`
- `tests/cli/test_phase3_cli.py`
- `tests/unit/test_comparison.py`
- `tests/unit/test_deterministic_shield.py`
- `tests/unit/test_metadrive_challenge.py`
- `tests/unit/test_shield_config.py`

### Phase 3, currently modified

- `CODEX_HANDOFF.md`
- `README.md`
- `docs/DEMO_RUNBOOK.md`
- `docs/decision-log.md`
- `docs/phase1-requirements-traceability.md`
- `src/hermes/adapters/metadrive.py`
- `src/hermes/cli.py`
- `src/hermes/domain/models.py`
- `src/hermes/evidence/metrics.py`
- `src/hermes/evidence/trace.py`
- `src/hermes/evidence/verification.py`
- `src/hermes/runtime/orchestrator.py`
- `src/hermes/scenarios/loader.py`
- `tests/cli/test_phase1_cli.py`
- `tests/integration/test_metadrive_run.py`
- `tests/unit/test_artifact_verification.py`
- `tests/unit/test_canonical_trace.py`
- `tests/unit/test_scenarios.py`
- `tests/unit/test_verifiers_and_gate.py`

### Intentionally untouched/untracked from source control

- `third_party/metadrive/` source and assets were not modified.
- Generated `artifacts/<run-id>/`, caches, editable-install metadata, environments, and simulator
  assets are ignored and were not staged.
- Git remotes and external infrastructure were not changed.

## 8. Dependencies

Only the following runtime dependencies were added during the unattended build; Phase 2 and Phase 3
added no Python dependency:

| Dependency | Version bound | Why |
|---|---|---|
| Pydantic | `>=2.10,<3` | strict simulator-neutral contracts and evidence/config validation |
| PyYAML | `>=6.0,<7` | strict versioned scenario, gate, and shield YAML loading |

Typer, Rich, pytest, and Ruff were already part of the Phase 0 package. MetaDrive remains an external,
pinned checkout/install rather than a new `pyproject.toml` dependency.

## 9. Commands executed and current validation

These final gate results were rerun in Conda `hermes-dev` after the last test-expectation correction:

| Exact command | Exit | Actual observed result |
|---|---:|---|
| `conda run --no-capture-output -n hermes-dev python -m pip install -e '.[dev]'` | 0 | editable `hermes-autonomy==0.1.0` built and installed; requirements already satisfied |
| `conda run --no-capture-output -n hermes-dev python -m pytest -q` | 0 | **221 passed in 2.67 s** |
| `conda run --no-capture-output -n hermes-dev python -m ruff check .` | 0 | **All checks passed** |
| `conda run --no-capture-output -n hermes-dev python -m hermes doctor` | 0 | **17 PASS, 1 WARN, 1 NOT_AVAILABLE, 0 FAIL** |
| `git diff --check` | 0 | no whitespace errors |
| `conda run --no-capture-output -n hermes-dev python -m hermes sim-smoke --headless` | 0 | MetaDrive 0.4.3 at pinned commit; five headless steps completed |

Doctor's sole warning was the expected pending Phase 3 dirty worktree. Optional display availability
was `NOT_AVAILABLE` because `DISPLAY`/`WAYLAND_DISPLAY` is unset; the headless/offscreen prerequisite
check passed. Doctor does not launch the simulator.

One intermediate full test run after tuning the illustrative speed cap from 8.5 to 5.5 found two
stale fixed-count expectations: `219 passed, 2 failed`. The tests were corrected to assert behavioral
invariants (actual changed-action count and presence of speed-cap/TTC reasons) instead of the obsolete
constant; the final 221-test gate above is the post-correction result.

## 10. Phase 1 demonstrations and regressions

The current verifier was rerun against every retained Phase 1 bundle without launching MetaDrive:

| Run | Actual verdict | Verify exit | Artifact | Trace digest |
|---|---|---:|---|---|
| Nominal | `PASS` | 0 | `artifacts/phase1-nominal` | `f515c16243d2b07c8a4b4ffd286edd5ff1c4ffa9486d3b28d034b40420ba234e` |
| Nominal repeat | `PASS` | 0 | `artifacts/phase1-nominal-repeat` | `f515c16243d2b07c8a4b4ffd286edd5ff1c4ffa9486d3b28d034b40420ba234e` |
| Collision | `HOLD` | 20 | `artifacts/phase1-collision` | `ecaa3b9222612044349b643c44406c2088cfb335b07f7bf4da56ac587bb76a24` |
| Boundary | `HOLD` | 20 | `artifacts/phase1-boundary` | `19cdf5e895c06d5bee9a250a9c236039543a1b17d503bd9a31547f9ec101e694` |
| Soft degradation | `CONDITIONAL` | 10 | `artifacts/phase1-conditional` | `dfd8cc47423f8b93e70da1f5bcac00d21f363aec4a435da8ca9518b111704158` |
| Modified artifact | `INVALID_EVIDENCE` | 30 | `artifacts/phase1-tampered` | rejected |

- Collision recorded one collision and failed hard invariant `collision.zero`; progress could not
  compensate.
- Boundary recorded maximum lateral offset 1.75 m and 0.1 s off-road, failing hard invariant
  `boundary.within_tolerance`; progress could not compensate.
- Soft degradation kept hard criteria green but recorded 6.0 m/s² maximum acceleration, failing the
  illustrative soft comfort requirement.
- The tampered bundle modifies sequence-0 executed action evidence. Verification identified first
  mismatched sequence 0, event/file/bundle digest mismatches, and recomputed metrics/findings/verdict
  inconsistencies. It did not rerun an adapter.
- Nominal and repeat have the same trace digest and all eight deterministic files
  (`execution-context.json`, resolved scenario/gate, events, metrics, findings, verdict, trace root)
  were byte-identical. Run ID and creation metadata remain permitted manifest/bundle differences.

The regenerated Phase 1 regression bundles retained during Phase 2 also reverified under the final
Phase 3 code as `PASS`, `HOLD`, `HOLD`, and `CONDITIONAL`, with the same corresponding trace digests.

## 11. Phase 2 MetaDrive result

| Item | Actual result |
|---|---|
| API/source reconnaissance | complete against installed MetaDrive 0.4.3 source/default configuration |
| Real smoke | exit 0; reset, installed IDM proposal, five headless steps, close |
| Nominal verdict | `PASS`, exit 0 |
| Nominal artifact | `artifacts/phase2-metadrive-nominal` |
| Nominal trace | `2b5009971c37c1eb65c9cc2830596689b5a25904a9b52b524d5bf77305848987` |
| Nominal metrics | 165 events / 16.5 s; collision 0; off-road 0 s; route 96.05972167673185%; max acceleration 2.777194976808275 m/s²; max jerk 2.8324127194660598 m/s³ |
| Independent replay | `INTERNALLY_CONSISTENT`, `PASS`, `NOT_AUTHENTICATED`; no MetaDrive import/rerun |
| Repeat | `artifacts/phase2-metadrive-repeat`; same trace and 8/8 deterministic files byte-identical |
| Unsupported evidence | front distance and relative speed explicitly `NOT_AVAILABLE` in nominal Phase 2 |
| Simulator checkout | clean at `85e5dadc6c7436d324348f6e3d8f8e680c06b4db` |

Same-host bitwise identity was observed. Cross-platform physics bitwise identity is not claimed;
cross-platform acceptance is categorical equality plus documented numeric tolerance.

## 12. Phase 3 shield and challenge evidence

All eight retained challenge bundles independently verify as `INTERNALLY_CONSISTENT` and
`NOT_AUTHENTICATED` without importing or rerunning MetaDrive. Verification returns the stored policy
verdict exit (`10` for `CONDITIONAL`, `20` for `HOLD`), not a false exit-0 PASS.

### Lead-vehicle hard-brake artifacts

| Artifact | Verdict / exit | Events / duration | Collision | Minimum TTC | Route | Max accel | Max jerk | Overrides | Trace digest |
|---|---|---|---:|---:|---:|---:|---:|---|---|
| `artifacts/phase3-lead-baseline` | `CONDITIONAL` / 10 | 197 / 19.7 s | 0 | 11.585881563948043 s | 96.46240046030904% | 12.640056610081958 m/s² | 125.50792694062345 m/s³ | 0 / none | `504dfbcdd8f4239f1b9f2a5e94fa64f8a1a6ac108543e46ace12b251aa409bd1` |
| `artifacts/phase3-lead-baseline-repeat` | `CONDITIONAL` / 10 | 197 / 19.7 s | 0 | 11.585881563948043 s | 96.46240046030904% | 12.640056610081958 m/s² | 125.50792694062345 m/s³ | 0 / none | `504dfbcdd8f4239f1b9f2a5e94fa64f8a1a6ac108543e46ace12b251aa409bd1` |
| `artifacts/phase3-lead-shielded` | `CONDITIONAL` / 10 | 271 / 27.1 s | 0 | 13.338911253788899 s | 96.23402341003727% | 13.168830871576347 m/s² | 159.3982696536189 m/s³ | 36 / `SPEED_CAP: 36` | `7324adbd7fa824f5dd834be2b321e3a5e4da36fbdac6eca99b7ae0c92d49f380` |
| `artifacts/phase3-lead-shielded-repeat` | `CONDITIONAL` / 10 | 271 / 27.1 s | 0 | 13.338911253788899 s | 96.23402341003727% | 13.168830871576347 m/s² | 159.3982696536189 m/s³ | 36 / `SPEED_CAP: 36` | `7324adbd7fa824f5dd834be2b321e3a5e4da36fbdac6eca99b7ae0c92d49f380` |

Both lead runs satisfied hard criteria and failed the illustrative acceleration and jerk soft
thresholds, hence `CONDITIONAL`. The lead actor used native MetaDrive dynamic actions on the fixed
brake schedule, but the baseline IDM retained a large TTC; this evidence does not demonstrate a
TTC-triggered shield intervention.

### Near-field cut-in artifacts

| Artifact | Verdict / exit | Events / duration | Collision | Minimum TTC | Route | Max accel | Max jerk | Overrides | Trace digest |
|---|---|---|---:|---:|---:|---:|---:|---|---|
| `artifacts/phase3-cutin-baseline` | `HOLD` / 20 | 300 / 30.0 s | 0 | 1.8155836417275437 s | 84.88178621406203% | 12.683377265917573 m/s² | 128.41591835005693 m/s³ | 0 / none | `00137f7fda53afa3531531bfeae6a8635b95b271707185c6922431633a8a5ef5` |
| `artifacts/phase3-cutin-baseline-repeat` | `HOLD` / 20 | 300 / 30.0 s | 0 | 1.8155836417275437 s | 84.88178621406203% | 12.683377265917573 m/s² | 128.41591835005693 m/s³ | 0 / none | `00137f7fda53afa3531531bfeae6a8635b95b271707185c6922431633a8a5ef5` |
| `artifacts/phase3-cutin-shielded` | `HOLD` / 20 | 300 / 30.0 s | 0 | 8.49579415469856 s | 84.39151677812995% | 13.003747463227677 m/s² | 157.565283775339 m/s³ | 3 / `SPEED_CAP: 3` | `7a0f0c7954a4257dca7fa2e4d2fbc0c53317b77f846174f7b033da029653e1ae` |
| `artifacts/phase3-cutin-shielded-repeat` | `HOLD` / 20 | 300 / 30.0 s | 0 | 8.49579415469856 s | 84.39151677812995% | 13.003747463227677 m/s² | 157.565283775339 m/s³ | 3 / `SPEED_CAP: 3` | `7a0f0c7954a4257dca7fa2e4d2fbc0c53317b77f846174f7b033da029653e1ae` |

Both cut-in runs exhausted the 300-step horizon without the required destination fact/95% progress,
so hard finding `progress.required` forced `HOLD`. The shielded run improved stored minimum TTC but
slightly reduced progress and worsened acceleration/jerk. The cut-in is scripted kinematic replay,
not native traffic behavior.

### Candidate/executed visibility and supported reasons

Every event stores candidate and executed actions separately. The retained shielded evidence has
36 changed-action events in the lead run and 3 in the cut-in run. Each actual retained override was
caused by `SPEED_CAP`; no retained event fabricated an unused TTC/boundary/staleness/emergency/delay
reason. The implementation and unit tests support the exact ordered reason vocabulary:

```text
TTC_BELOW_THRESHOLD
SPEED_CAP
STALE_OBSERVATION
BOUNDARY_RISK
EMERGENCY_STOP
ACTUATION_DELAY_COMPENSATION
```

### Stored comparisons

Both comparison commands exited 0, found the inputs compatible, and warned that both artifacts
recorded a dirty worktree:

| Dimension | Lead baseline → shield | Cut-in baseline → shield |
|---|---|---|
| Verdict | `UNCHANGED` (`CONDITIONAL`) | `UNCHANGED` (`HOLD`) |
| Hard-failure set | `UNCHANGED` (empty) | `UNCHANGED` (`progress.required`) |
| Collision | `UNCHANGED` (0 → 0) | `UNCHANGED` (0 → 0) |
| Minimum TTC | `IMPROVED` (11.585881563948043 → 13.338911253788899 s) | `IMPROVED` (1.8155836417275437 → 8.49579415469856 s) |
| Route completion | `REGRESSED` (96.46240046030904 → 96.23402341003727%) | `REGRESSED` (84.88178621406203 → 84.39151677812995%) |
| Maximum acceleration | `REGRESSED` | `REGRESSED` |
| Maximum jerk | `REGRESSED` | `REGRESSED` |
| Policy latency/source | `UNCHANGED` at simulated 10 ms | `UNCHANGED` at simulated 10 ms |
| Interventions | `NOT_COMPARABLE`, descriptive 0 → 36 | `NOT_COMPARABLE`, descriptive 0 → 3 |
| Evidence availability | `UNCHANGED`, all compared measurements available | `UNCHANGED`, all compared measurements available |

This is a trade-off result, not a blanket shield win: TTC improved, comfort and progress regressed,
and the policy verdict did not improve.

### Determinism

For lead baseline, lead shielded, cut-in baseline, and cut-in shielded, the corresponding seed-7
repeat produced the same trace digest and 8/8 byte-identical deterministic evidence files. Manifest
timestamps/run IDs and the resulting bundle digest are intentionally different. Phase 1 nominal and
Phase 2 nominal repeats passed the same check.

## 13. Review-driven corrections

The implementation incorporated independent review findings before the final 221-test gate:

- count override events separately from the reason histogram;
- suppress reasons when a triggered rule would not change an already-identical candidate action;
- preserve Phase 1/2 schema-1 serialization and trace compatibility while adding schema-2 challenge
  fields;
- bind both policy-input and post-step challenge actor evidence, include terminal post-step TTC, and
  enforce phase schedule/continuity during stored replay;
- replay the deterministic shield offline and reject a coherently rehashed forged shield decision;
- inspect each artifact through one stable descriptor-safe snapshot to remove verification/comparison
  time-of-check/time-of-use gaps;
- fail comparison closed on invalid/incompatible evidence and keep intervention deltas descriptive;
- replace stale fixed intervention-count assertions after the configured speed-cap change with
  behavioral assertions over actual override events and reason content; and
- add the per-scenario baseline weakness, expected shield/verifier behavior, reproducibility
  envelope, exact observed metrics/digests, mixed trade-offs, dirty provenance, and absence of a real
  TTC override to `docs/phase3-safety-shield.md` and the decision record.

The final evidence-integrity re-review and architecture/product-safety re-review both returned
**GO with no release-blocking findings**. The evidence review independently ran a 92-test adversarial
subset, the 221-test full suite, Ruff, doctor, diff checks, all eight stored verifications, and the
four repeat comparisons. Review residuals are preserved below rather than converted into claims.

## 14. Known limitations and residual risks

| Limitation/risk | Observed impact | Mitigation or next step |
|---|---|---|
| Simulation is not real-world validation | All verdicts apply only to bounded configured simulation evidence | Keep simulation-only banner and require a separate safety case before any closed-lab hardware work |
| Illustrative speed cap dominates Phase 3 interventions | Retained shield runs show only `SPEED_CAP`; no real run exercises each reason | Add targeted simulator scenarios/fault injection only in a later approved phase; do not generalize current benefit |
| Cut-in is scripted replay | Reproducible geometry challenge is not realistic traffic-agent behavior | Preserve `scripted_kinematic_replay` and `behavior_realism_claim: false`; evaluate a supported behavioral model later |
| Lead scenario remains easy for installed IDM | Baseline minimum TTC is 11.59 s and no TTC reason triggers | Tune a future bounded challenge without disabling IDM safeguards or fabricating behavior |
| Ground-truth actor signal | TTC evidence does not measure perception accuracy, uncertainty, or occlusion | Keep signal source explicit; add a separate perception evidence contract if scoped later |
| Comfort/progress regressions | Shielded evidence increases acceleration/jerk and slightly lowers route completion; cut-in remains `HOLD` | Treat comparison as a trade-off and keep non-compensatory gate precedence |
| Local hash trust | Integrity is internally consistent but authenticity is `NOT_AUTHENTICATED` | External signing/separate trust anchor remains deferred |
| MetaDrive IDM internal fallback | Upstream broad fallback is not structurally surfaced | Record limitation in policy context; do not claim complete candidate-policy introspection |
| Cross-platform determinism | Same-host bytes match; Panda3D/physics may differ by platform | Require categorical equality plus documented `1e-5` numeric agreement; do not claim cross-platform bitwise identity |
| Dirty provenance in retained artifacts | Comparison emits dirty-worktree warning and artifacts identify Phase 2 commit | After checkpoint, use new run IDs to create clean-commit evidence if desired; never rewrite current bundles |
| No independent CI in this phase | Validation is local on one macOS arm64 host | Add CI only under later hardening scope, keeping simulator availability explicit |

There are no blockers for the completed Phase 3 local implementation. Optional hardening remains
deferred by scope, not represented as complete.

## 15. Local commits

```text
638a951 (HEAD -> feat/unattended-evidence-core) feat: add MetaDrive headless adapter
635c246 feat: add deterministic evidence core
430ef0c docs: define unattended Hermes build plan
c181509 (main) chore: establish Hermes Phase 0 foundation
```

The intended next checkpoint message is `feat: add safety shield and challenge scenarios`; it had
not been created when this handoff snapshot was written. No commit was pushed.

## 16. Final Git status

At handoff drafting time, `git status --short` showed the following intended Phase 3 change set:

```text
 M CODEX_HANDOFF.md
 M README.md
 M docs/DEMO_RUNBOOK.md
 M docs/decision-log.md
 M docs/phase1-requirements-traceability.md
 M src/hermes/adapters/metadrive.py
 M src/hermes/cli.py
 M src/hermes/domain/models.py
 M src/hermes/evidence/metrics.py
 M src/hermes/evidence/trace.py
 M src/hermes/evidence/verification.py
 M src/hermes/runtime/orchestrator.py
 M src/hermes/scenarios/loader.py
 M tests/cli/test_phase1_cli.py
 M tests/integration/test_metadrive_run.py
 M tests/unit/test_artifact_verification.py
 M tests/unit/test_canonical_trace.py
 M tests/unit/test_scenarios.py
 M tests/unit/test_verifiers_and_gate.py
?? config/shield.phase3.yaml
?? docs/phase3-safety-shield.md
?? scenarios/metadrive_cut_in_near_field.yaml
?? scenarios/metadrive_lead_vehicle_hard_brake.yaml
?? src/hermes/adapters/metadrive_challenge.py
?? src/hermes/comparison/
?? src/hermes/shields/config.py
?? src/hermes/shields/deterministic.py
?? tests/cli/test_phase3_cli.py
?? tests/unit/test_comparison.py
?? tests/unit/test_deterministic_shield.py
?? tests/unit/test_metadrive_challenge.py
?? tests/unit/test_shield_config.py
```

Ignored generated artifacts and editable-install metadata do not appear in this status. The external
MetaDrive checkout separately reports a clean `main` branch.

## 17. Reproduction and verification commands

Artifact publication never overwrites. The run IDs below are already occupied; use new IDs to rerun.

### Full gates

```bash
conda run --no-capture-output -n hermes-dev python -m pip install -e '.[dev]'
conda run --no-capture-output -n hermes-dev python -m pytest -q
conda run --no-capture-output -n hermes-dev python -m ruff check .
conda run --no-capture-output -n hermes-dev python -m hermes doctor
git diff --check
conda run --no-capture-output -n hermes-dev python -m hermes sim-smoke --headless
```

### Phase 1 demonstrations

```bash
hermes run --simulator fake --scenario scenarios/fake_nominal.yaml \
  --policy baseline --seed 7 --run-id phase1-nominal
hermes run --simulator fake --scenario scenarios/fake_collision.yaml \
  --policy baseline --seed 7 --run-id phase1-collision
hermes run --simulator fake --scenario scenarios/fake_boundary.yaml \
  --policy baseline --seed 7 --run-id phase1-boundary
hermes run --simulator fake --scenario scenarios/fake_soft_degradation.yaml \
  --policy baseline --seed 7 --run-id phase1-conditional
hermes verify-artifact artifacts/phase1-nominal
hermes verify-artifact artifacts/phase1-collision
hermes verify-artifact artifacts/phase1-boundary
hermes verify-artifact artifacts/phase1-conditional
hermes verify-artifact artifacts/phase1-tampered
```

### Phase 2 nominal

```bash
hermes run --simulator metadrive --scenario scenarios/metadrive_nominal.yaml \
  --policy metadrive-idm --seed 7 --run-id phase2-metadrive-nominal --headless
hermes verify-artifact artifacts/phase2-metadrive-nominal
```

### Phase 3 lead challenge

```bash
hermes run --simulator metadrive \
  --scenario scenarios/metadrive_lead_vehicle_hard_brake.yaml \
  --policy metadrive-idm --seed 7 --run-id phase3-lead-baseline --headless
hermes run --simulator metadrive \
  --scenario scenarios/metadrive_lead_vehicle_hard_brake.yaml \
  --policy metadrive-idm --seed 7 --run-id phase3-lead-shielded --headless \
  --shield deterministic --shield-config config/shield.phase3.yaml
hermes verify-artifact artifacts/phase3-lead-baseline
hermes verify-artifact artifacts/phase3-lead-shielded
hermes compare artifacts/phase3-lead-baseline artifacts/phase3-lead-shielded
hermes compare artifacts/phase3-lead-baseline artifacts/phase3-lead-shielded --format json
```

### Phase 3 cut-in challenge

```bash
hermes run --simulator metadrive \
  --scenario scenarios/metadrive_cut_in_near_field.yaml \
  --policy metadrive-idm --seed 7 --run-id phase3-cutin-baseline --headless
hermes run --simulator metadrive \
  --scenario scenarios/metadrive_cut_in_near_field.yaml \
  --policy metadrive-idm --seed 7 --run-id phase3-cutin-shielded --headless \
  --shield deterministic --shield-config config/shield.phase3.yaml
hermes verify-artifact artifacts/phase3-cutin-baseline
hermes verify-artifact artifacts/phase3-cutin-shielded
hermes compare artifacts/phase3-cutin-baseline artifacts/phase3-cutin-shielded
hermes compare artifacts/phase3-cutin-baseline artifacts/phase3-cutin-shielded --format json
```

## 18. Single best next action

Review the complete pending Phase 3 checkpoint scope before staging anything:

```bash
git status --short
```
