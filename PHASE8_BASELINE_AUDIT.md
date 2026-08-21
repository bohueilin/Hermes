# Hermes Phase 8 — Sprint 0 Baseline Audit

**Deliverable of:** PRD §31 Sprint 0 / §39 "Before coding" (`HERMES_PHASE7_ADAS_AGENTIC_WORKFLOW_PRD.md`)
**Effort:** Phase 8 — ADAS Development & Agentic Workflow Lab (renumbered from "Phase 7"; see §0-A.1)
**Date:** 2026-08-20
**Author:** Claude Opus 5 (coding agent), under `Hermes_Phase8_ADAS_Opus5_Implementation_Master_Prompt.md`
**Status:** Complete. No feature code was written before this document existed.

> **Scope note.** This document audits the repository as it actually is. Where the PRD's §0-A
> amendments assert a repository fact, that assertion is verified here against source and marked
> CONFIRMED, PARTIAL, or CORRECTED. §0-A *decisions* are not re-litigated; only its *repo
> references* are checked, as §0-A itself requires.

---

## 1. Repository snapshot

| Item | Value |
|---|---|
| Base branch | `feat/phase6-reviewer-comprehension` |
| **Base commit** | **`4eb87654f79654843169d00a656dd2c6f8092de4`** ("docs: approve Phase 7 evaluation adequacy design") |
| Phase 8 branch | `feat/phase8-adas-lab` (created from the above) |
| Working tree at branch creation | Clean except pre-existing untracked files (see below) |
| Python | 3.11.15 |
| Package | `hermes-autonomy` 0.1.0, import package `hermes`, console command `hermes` |
| MetaDrive | 0.4.3, source commit `85e5dadc6c7436d324348f6e3d8f8e680c06b4db` (matches `SIMULATOR_COMMIT`) |
| Key deps | pydantic 2.13.4, PyYAML 6.0.3, rich 14.3.4, typer 0.27.1, pytest 8.4.2, ruff 0.16.2, streamlit 1.61.1 |
| Source size | 19,190 lines across `src/hermes` (excluding `__pycache__`) |
| Tests | 35 test files, ~465 test functions, **756 collected test cases** |
| Local evidence bundles | 43 directories under `artifacts/` (gitignored; usable as Phase 0–6 fixtures) |

Pre-existing untracked files at branch creation (not created by Phase 8, not staged):
`HERMES_PHASE7_ADAS_AGENTIC_WORKFLOW_PRD.md`, `Hermes_Phase8_ADAS_Opus5_Implementation_Master_Prompt.md`,
`Hermes_Phase6_Reviewer_Comprehension_Iteration_Master_Prompt.md`, `Hermes_PRD_Phase6_Product_Requirements.pdf`,
`Hermes_Github.png`, `sandbox/`.

### 1.1 Baseline gate evidence (all run on the Phase 8 branch, before any code change)

| Gate | Command | Result |
|---|---|---|
| Tests | `python -m pytest -q` | **756 passed** in 23.67 s, exit 0 |
| Tests (no-simulator selection) | `python -m pytest -q -m "not metadrive"` | **756 passed** — identical set |
| Lint (tracked tree) | `python -m ruff check src tests` | **All checks passed!** |
| Lint (whole repo) | `python -m ruff check .` | 2 errors, both inside untracked `sandbox/mujoco/` — pre-existing, outside Phase 8 scope |
| Doctor | `python -m hermes doctor` | **16 PASS, 2 WARN, 1 NOT_AVAILABLE** (WARNs: conda env not activated in this shell; git worktree dirty due to the untracked files above) |
| Real simulator | `python -m hermes sim-smoke --headless` | **Smoke status: OK**, metadrive 0.4.3, 5 headless steps, exit 0 |

Exact reproduction (see §2 for why `PYTHONPATH` is mandatory):

```bash
cd /Users/bohueilin/Documents/GitHub/Hermes && PYTHONDONTWRITEBYTECODE=1 PYTHONPATH="$PWD/src" /Users/bohueilin/miniconda3/envs/hermes-dev/bin/python -m pytest -p no:cacheprovider -q
```

### 1.2 The `metadrive` pytest marker is declared but unused

`pyproject.toml` declares a `metadrive` marker ("requires a real local MetaDrive installation"), but
**no test carries it**: `-m "metadrive"` collects 0 tests and deselects all 756.
`tests/integration/test_metadrive_run.py` exercises the adapter against a hand-written `_Env`/`_Agent`
double defined in the test file, not against real MetaDrive.

**Consequence for Phase 8:** *no test in the repository exercises real MetaDrive physics.* The entire
756-test suite is simulator-free and would pass on a machine with no simulator at all. Sprint 1a
adapter work and the Risk 8 brake-dynamics calibration are therefore the first real-simulator work in
the project's history, and they cannot lean on existing coverage. Any calibration constant derived
from real MetaDrive must be recorded as evidence and pinned by a test that runs against the *double*,
with the real-simulator measurement kept as a separately-marked, host-dependent check.

---

## 2. CRITICAL operational hazard: the `hermes-dev` environment resolves to the Phase 7 worktree

The `hermes-dev` conda environment contains an editable install whose `.pth` points at the **read-only
Phase 7 worktree**, not at this checkout:

```
$ cat .../envs/hermes-dev/lib/python3.11/site-packages/__editable__.hermes_autonomy-0.1.0.pth
/Users/bohueilin/.codex/worktrees/Hermes/phase7-evaluation-adequacy-human-validation/src
```

Running `python -m hermes` or `python -m pytest` in this checkout **without** an explicit
`PYTHONPATH` imports Phase 7 code while reading Phase 8 tests and scenarios. Verified:

- bare: `hermes.__file__` → `.../phase7-evaluation-adequacy-human-validation/src/hermes/__init__.py`
- with `PYTHONPATH=$PWD/src`: `hermes.__file__` → `/Users/bohueilin/Documents/GitHub/Hermes/src/hermes/__init__.py` ✔

`metadrive` resolves correctly either way (its editable finder maps to this checkout's
`third_party/metadrive`).

**Rule for all Phase 8 work:** always prefix with `PYTHONPATH="$PWD/src"`, and never modify the
`hermes-dev` `.pth` (that would break the owner's in-flight Phase 7 environment).

**Recommended Sprint 1 hardening (not yet applied):** add an import-provenance guard to
`tests/conftest.py` asserting `Path(hermes.__file__).is_relative_to(repository_root/"src")`, so a
mis-rooted run fails loudly instead of silently testing the wrong tree. This is additive and pins no
existing behavior.

---

## 3. Answers to PRD §38 — Open Questions

### Q1. What scenario abstraction already exists and should be extended?

`ScenarioDefinition` (`src/hermes/domain/models.py:259`), loaded by
`src/hermes/scenarios/loader.py` / `yaml_loader.py`, YAML under repo-root `scenarios/`.

```python
schema_version: Literal["1.0", "2.0", "3.0"]        # models.py:262 — string literals, confirmed
name:  Annotated[str, Field(pattern=r"^[a-z][a-z0-9_]{0,63}$")]
version: str; description: str
adapter: Literal["fake", "metadrive"]
control: ControlConfig; initial_state: InitialState; road: RoadConfig
hazards: HazardConfig = HazardConfig()
challenge: ChallengeConfig | None = None            # discriminated union, discriminator="kind"
faults:    FaultConfig | None = None                # single object, not a list
```

`ChallengeConfig` (`models.py:253`) is `Annotated[LeadVehicleHardBrakeChallenge | CutInNearFieldChallenge, Field(discriminator="kind")]`
— exactly two members today: `kind="lead_vehicle_hard_brake"` and `kind="cut_in_near_field"`.
There is **no** `seed` field (seed is a `--seed` run parameter) and **no** `requirements`/expected-property
concept. `ControlConfig` (`models.py:116`) already carries `frequency_hz`, `horizon_steps`,
**`target_speed_mps`**, `max_acceleration_mps2` (default 3.0), `max_braking_mps2` (default 6.0),
`lateral_response_mps`, `simulated_policy_latency_ms`.

**Extend as schema `"4.0"`** by adding members to the `ChallengeConfig` union and optional `odd`,
`tags`, `adas`, `requirements` blocks. See §6.1 for the validator restructuring this forces.

### Q2. What controller/action interface already exists?

`DrivingPolicy` (`src/hermes/domain/contracts.py:49`), a `@runtime_checkable` Protocol:

```python
name: str; version: str
evidence_config -> dict[str, JsonValue]     # property
simulated_latency_ms -> float               # property
reset(scenario: ScenarioDefinition, seed: int) -> None
act(observation: Observation) -> Action
```

§0-A.2.1 CONFIRMED verbatim. Sibling protocols in the same file: `SimulatorAdapter` (:18),
`SafetyShield` (:69), `Verifier` (:85). ADAS functions implement `DrivingPolicy`; scenario-dependent
targets are read from `scenario.control` in `reset()`, which already exists.

### Q3. Which fault mechanisms can be reused directly?

All seven, unchanged. `FaultConfig` (`models.py:172`) fields, cross-checked against the coverage
verifier `_fault_coverage` (`verifiers/__init__.py:309-330`):

| # | Field | Trace reason |
|---|---|---|
| 1 | `observation_delay_steps` | `OBSERVATION_DELAY` |
| 2 | `frozen_observation_interval` | `OBSERVATION_FROZEN` |
| 3 | `dropped_observation_steps` | `OBSERVATION_DROPOUT_HOLD_LAST` |
| 4 | `observation_noise` | `OBSERVATION_NOISE` |
| 5 | `control_delay_steps` | `CONTROL_DELAY` |
| 6 | `max_abs_steering` | `STEERING_SATURATION` |
| 7 | `max_brake` | `BRAKE_SATURATION` |

§0-A.5.4 CONFIRMED. **Delays are expressed in whole control steps**, not milliseconds — so §0-A.3.7's
ms→steps quantization is a *presentation/authoring* conversion (`steps = round(ms * f_hz / 1000)`),
and the underlying evidence stays step-based. `FaultConfig` also has
`label: Literal["illustrative_simulation_faults_not_real_vehicle_limits"]` and its own
`schema_version: Literal["1.0"]`. Only fault family 8 (lane-estimate degradation) is new — and it is a
designated drop-to-P1 item under §0-A.9.2.

### Q4. Which current metrics can be generalized?

`RunMetrics` (`models.py:459`, `evidence_schema_version: Literal["1.0"]`) and
`RunMetricsV2(RunMetrics)` (`models.py:484`, `Literal["2.0"]`). Existing fields:

`event_count`, `simulation_duration_s`, `collision_count`, `max_abs_lateral_offset_m`,
`offroad_duration_s`, `route_completion_pct`, `minimum_ttc_s`, `max_abs_acceleration_mps2`,
`max_abs_jerk_mps3`, `p95_policy_latency_ms`, `shield_override_count`, `shield_override_reasons`,
`termination_reason` — plus V2's `fault_application_counts`, `max_observation_age_s`,
`p95_control_latency_ms`, `control_fill_count`, `steering_saturation_count`, `brake_saturation_count`.

**`Measurement` already exists** (`models.py:360`) with exactly the shape §0-A.6.1 asks for:
`availability: EvidenceAvailability`, `value: FiniteFloat | None`, `unit: str | None`,
`reason: str | None`, with a validator forbidding value-without-availability and
reason-without-unavailability. `minimum_ttc_s`, `route_completion_pct`, both comfort metrics and both
latency metrics are already `Measurement`-wrapped. §0-A.6.1's metric mapping table CONFIRMED:
`ttc.minimum_s` → `minimum_ttc_s`; jerk → `max_abs_jerk_mps3`;
`system.control_saturation_count` → `steering_saturation_count` + `brake_saturation_count`;
`system.observation_age_p95_ms` → `max_observation_age_s` lineage (seconds, per §0-A.4.2).

`RunMetricsV3(RunMetricsV2)` with `evidence_schema_version: Literal["3.0"]` is the established
subclass-and-override pattern.

### Q5. How should ADAS metrics fit existing `metrics.json` conventions?

As typed `RunMetricsV3` fields with flat snake_case names and `Measurement` wrappers for anything that
can be undefined — never an open key-value namespace. `metrics.json` is one of the ten
`REQUIRED_ARTIFACT_FILES` and is digest-bound; the whole bundle must carry a single
`evidence_schema_version` (`verification.py:1197` rejects "artifact files contain mixed
evidence_schema_version values"), so V3 metrics imply V3 run context, V3 trace events and a V3
execution context together.

### Q6. How should ADAS findings fit existing `findings.json`?

As `Finding` objects produced by free functions in `src/hermes/verifiers/`, registered in a
`VerifierIdentity` tuple and enumerated in a **new** `VerifierProfile`. This is the single most
unforgiving contract in the repo — see §6.2. `Finding` carries `finding_id`, `verifier`,
`verifier_version`, `status`, `severity`, `hard_invariant`, `threshold_or_invariant`, `message`,
`event_sequences`, `first_failure_time_s`, `measurement`. §0-A.5.3's "each requirement compiles to
exactly one `Finding`, `hard` maps to `hard_invariant`" is structurally supported.

### Q7. Can the existing `compare` command support metric-family extensions?

**Not as written.** Two blockers, both in `src/hermes/comparison/compare.py`:

1. `_compatibility` (:57–180) fails closed on **26 equality checks**, including `policy name`,
   `policy version`, `policy configuration digest`, `seed`, `simulator commit`, `Python version`,
   `platform`, `architecture`, and `repository commit`. Comparing two different controllers is
   structurally impossible today. §0-A.7.10 CONFIRMED.
2. `_ordered_numeric_status` (:186–195) is a bare strict comparison — `candidate == baseline` →
   UNCHANGED, else improved/regressed by direction. **No tolerance band anywhere.** §0-A.7.7 CONFIRMED.

Metric direction is *already* modelled, but in two places (see §7): `METRIC_REGISTRY`
(`review/models.py:138`, `{name: (unit, direction, kind)}` with `HIGHER`/`LOWER`/`DESCRIPTIVE`) and
`_MEASUREMENT_DIMENSIONS` (`compare.py:493`, `(name, higher_is_better)` pairs). §0-A.7.7's metric
registry should extend `METRIC_REGISTRY` with materiality tolerance + criticality class and become the
single source both consume.

### Q8. What is the smallest additive change to the evidence bundle?

`REQUIRED_ARTIFACT_FILES` (`evidence/artifacts.py:39`) is exactly the ten files AGENTS.md §6 lists.
**`faults.resolved.yaml` has never existed** — §0-A.6.3's "drop" instruction is satisfied by simply not
adding it; fault config is embedded in `scenario.resolved.yaml` and digest-bound as
`fault_config_digest` on `RunContextV2` (`models.py:523`). CORRECTED, in the amendment's favour.

**There is no "optional file" escape hatch.** Bundle capture enumerates the directory and is
*bidirectionally* exact (`verification.py:345-351`):

```python
expected_names = set(REQUIRED_ARTIFACT_FILES)
missing    = sorted(expected_names - initial_names)
unexpected = sorted(initial_names - expected_names)
...
if unexpected:
    errors.append("unexpected artifact entries: " + ", ".join(unexpected))
```

Dropping *any* extra file into a bundle directory — a "derived, non-authoritative"
`adas-events.jsonl`, a "recommended" `telemetry.parquet`, `agent-trace.jsonl` — makes the bundle fail
verification. §24's "Optional:" file list is therefore not implementable as written.

The smallest credible additive change is **zero new files**:

- `adas-config.resolved.yaml` → fold into `execution-context.json`; the controller's `evidence_config`
  already flows into `policy_config_digest` (`orchestrator.py:190,201`), so nothing is lost.
- ADAS discrete events → derive on demand from `events.jsonl` rather than persisting a second stream.

If Phase 8 genuinely needs new files (agent provenance under §0-A.6.4 does), the correct move is an
explicit, schema-gated **optional-artifact allowlist** — a real mechanism added to `artifacts.py`,
`verification.py` capture, the manifest, `review/models.py::ARTIFACT_FILES` + `ArtifactFileName`, and
`review/projection.py`'s source map (§7), with the allowlist empty for evidence schemas 1.0/2.0 so
existing bundles stay byte-identical. That is a Sprint-sized change, not a free addition — budget it
before promising §0-A.6.4/§0-A.6.5 artifacts.

### Q9. Which review-workbench components can be reused?

`src/hermes/review/` (facade 246 + models 2,825 + projection 2,113 lines) and
`src/hermes/workbench/app.py` (**2,130 lines** — §0-A.9.5's "~2,100" CONFIRMED). The framework-independent
core / Streamlit split is real and enforced by `tests/unit/test_architecture_boundaries.py`. Reuse:
`METRIC_REGISTRY`, `DesiredDirection`, the availability/requiredness vocabulary, and the comparison
envelope. `SourceReference`/`LocatorInfo` are the model for §0-A.8.6's citation schema, but note the
gap: `SourceReference` (`review/models.py:607`) has exactly four fields, so of the five proposed
citation fields only the locator and source identity have an existing home — `run_id`,
`quoted_value` and `bundle_digest` are new.
**`REVIEW_SCHEMA_VERSION = "1.0"`** (`review/models.py:23`) with `Literal["1.0"]` at :380, :466, :2233
and `comparison_schema_version: Literal["1.0"]` at :2597 — an envelope bump touches all of them plus
~240 review/workbench test functions.

### Q10. What existing CLI verbs should be extended rather than duplicated?

Registered typer commands (`src/hermes/cli.py`): `doctor` (:121), `run` (:242), `sim-smoke` (:353),
`verify-artifact` (:400), `review-artifact` (:712), `review-compare` (:768), `workbench` (:865),
`compare` (:914). §0-A.9.7's verb list CONFIRMED exactly; `compare` takes positional bundle dirs.

`run` already has `--simulator --scenario --policy --seed --run-id --gate-config --headless --shield
--shield-config`. Note for §0-A.9.7's "required flags" list: `--simulator`, `--scenario`, `--policy`,
`--seed` and `--run-id` are required, but **`--gate-config` is optional** (`cli.py:253-256`) and
defaults to `config/gates.phase1.yaml` for the fake adapter and `config/gates.phase2.yaml` for
MetaDrive. Phase 8 examples should either pass it explicitly or not describe it as required.

**CORRECTION to §0-A.9.7:** `--policy` is *not* a registry today — `cli.py:282` is
`expected_policy = "baseline" if simulator == "fake" else "metadrive-idm"` and rejects anything else.
However the runtime already supports injection: `execute_fake_run(policy_factory=BaselinePolicy)`
(`orchestrator.py:648`) and `execute_metadrive_run(policy_factory=...)` (`orchestrator.py:675`). So the
work is a **CLI-level policy registry that passes `policy_factory=` through** — modelled exactly on the
existing `shield_factory` pattern (`cli.py:316-321`) — not a runtime change. Smaller than the
amendment implies.

### Q11. Which tests represent immutable Phase 0–6 contracts?

See §5 for the full inventory. Summary: 35 files / ~465 functions / 756 cases. The immutable set is
dominated by evidence-integrity and review-envelope tests; Phase 6 review/workbench tests alone are
~240 functions (`test_review_models.py` 79, `test_workbench_projection.py` 45, `test_review_cli.py` 35,
`test_workbench_smoke.py` 27, `test_review_capture.py` 21, `test_review_facade.py` 16, others).

### Q12. How does the repository currently represent human approval or review state?

**It does not.** A whole-source search for `approval|approve|sign_off|signoff|reviewer_decision|acknowledg`
in `src/hermes` returns exactly **three** hits, and all three are disclaimers *denying* that review is
approval:

- `cli.py:520` — "Review authority: stored simulation evidence only; not an approval, …"
- `workbench/app.py:128` — "This is a simulation evidence decision, not an approval or deployment authorization."
- `review/projection.py:1250` — "The review cannot be treated as an official approval or attestation."

Phase 8's approval subsystem (§0-A.8.2) is therefore **greenfield**, and it lands next to hard
statements that Hermes grants no approval. See the decision in §9.3 for how to build it without
eroding the Phase 6 trust-state contract.

The digest-bound registry pattern §0-A.8.2 says to reuse is documented in this checkout at
`PHASE7_EVALUATION_ADEQUACY_AND_HUMAN_VALIDATION_DESIGN.md:1132-1136`: a committed
`config/phase7-fixture-registry.yaml` that "binds locator, manifest run ID, bundle/trace digest,
schema/profile, task mapping, and generation command", freshly validated before every session. That
maps cleanly onto an approval registry keyed by `draft_content_digest`.

---

## 4. §0-A amendment verification

Verified against source at base commit `4eb8765`. Only repo *references* are checked; §0-A *decisions*
stand as written.

| Amendment | Claim | Verdict | Evidence |
|---|---|---|---|
| 0-A.1.3 | Base is `feat/phase6-reviewer-comprehension`; `main` holds only Phase 0 | CONFIRMED | Branch created from `4eb8765`; `main` not touched |
| 0-A.2.1 | `DrivingPolicy` members `name, version, evidence_config, simulated_latency_ms, reset(scenario, seed), act(observation)` | CONFIRMED | `contracts.py:49-64`, verbatim |
| 0-A.2.1 | ACC target speed readable from the scenario `control` block | CONFIRMED | `ControlConfig.target_speed_mps`, `models.py:121` |
| 0-A.2.2 | Evaluators are `Verifier` implementations under `src/hermes/verifiers/` | **PARTIAL / CORRECTED** | The `Verifier` Protocol (`contracts.py:85`) is **defined but never implemented or referenced anywhere**. The real pattern is module-level functions returning `Finding`, registered via `VerifierIdentity` tuples and `run_phase1_verifiers` / `run_phase4_verifiers`. See §9.2 |
| 0-A.2.3 | Run context requires shield identity, so "disabled" must be a null shield | CONFIRMED | `RunContext.shield_name/shield_version/shield_config_digest` are **non-optional**, `models.py:508-510` |
| 0-A.2.3 | ADAS runs use a passthrough/noop shield | CONFIRMED — **already the default** | `NoOpShield` exists (`shields/noop.py`) and is the default in the CLI (`cli.py:263`) *and* both run entry points (`orchestrator.py:649,676`). Zero new work |
| 0-A.2.4 | `Action` invariant: throttle/brake mutually exclusive, steering ∈ [-1,1] | CONFIRMED | `models.py` `Action`; adapter projects via `throttle=max(0,l)`, `brake=max(0,-l)` (`metadrive.py:510-511`) |
| 0-A.3.1 | TTC undefined when `closing_speed <= 0`, matching `observation_ttc_s` | CONFIRMED | `shields/deterministic.py`; `minimum_ttc_s` defaults to a `NOT_AVAILABLE` `Measurement` (`models.py:469-475`) |
| 0-A.3.6 | Existing `ControlConfig` limits `max_acceleration_mps2` 3.0, `max_braking_mps2` 6.0 | CONFIRMED | `models.py:122-123` |
| 0-A.3.7 | 10/25/50 Hz valid, 30/60 Hz invalid at the 0.02 s physics step | CONFIRMED — **validator already exists** | `metadrive.py:285-291` `_decision_repeat` requires `1/(f·0.02)` to be an exact integer ≥ 1. Valid f are the divisors of 50: {1,2,5,10,25,50}. Note **20 Hz is also invalid** (50/20 = 2.5). Missing only from the *scenario* validator |
| 0-A.4.1 | Existing `challenge_actor_*` observation convention | CONFIRMED | `_CHALLENGE_OBSERVATION_SUMMARY_FIELDS`, `trace.py:172-185` |
| 0-A.4.2 | `observation_age_s` in seconds | CONFIRMED | `Observation.observation_age_s`; `RunMetricsV2.max_observation_age_s` |
| 0-A.5 | Strict versioned `ScenarioDefinition`, `Literal["1.0","2.0","3.0"]` strings, discriminated `ChallengeConfig`, single `FaultConfig`, seed as run parameter | CONFIRMED | `models.py:253-272` |
| 0-A.5.4 | Fault families 1–7 already exist as `FaultConfig` fields in `src/hermes/faults/deterministic.py` | CONFIRMED in substance, **file reference corrected** | The seven fields are real, but `FaultConfig` is defined in `domain/models.py:172-188`; `faults/deterministic.py` only imports it and implements the transforms. Coverage verifier: `verifiers/__init__.py:309-330` |
| 0-A.5.5 | Scenario YAML lives under repo-root `scenarios/`, never in the code package | CONFIRMED | 9 YAML files in `scenarios/`; `src/hermes/scenarios/` contains only `loader.py`, `yaml_loader.py` |
| 0-A.6.2 | `events.jsonl` is the hash-chained per-step TraceEvent stream | CONFIRMED | `trace.py:40-73` (schema 1.0) and `:75-110` (schema 2.0); hash = SHA-256 of canonical JSON excluding `current_hash`, chained by `previous_hash` |
| 0-A.6.3 | Drop `faults.resolved.yaml`; fault config already digest-bound as `fault_config_digest` | CONFIRMED (vacuously) | It was never in `REQUIRED_ARTIFACT_FILES` (`artifacts.py:39-50`); `fault_config_digest` is real (`models.py:523`) |
| 0-A.6.3 | Every added required file must be registered in required-files/manifest/digests with matching verification | CONFIRMED — **and understated** | The inventory is duplicated in **five** places. See §7 |
| 0-A.6.4 / 0-A.6.5 | Add `agent-trace.jsonl`, `agent-report.json`, `telemetry.parquet` to the bundle | **BLOCKED as written** | Bundle capture rejects *any* file outside `REQUIRED_ARTIFACT_FILES` as "unexpected artifact entries" (`verification.py:347-351`). §24's "Optional:" list is not implementable; an explicit optional-artifact allowlist mechanism must be built first (§3 Q8, §6.6) |
| 0-A.7.3 | The per-run gate implements "dimensions 1–6 plus coverage" | **PARTIAL** | `gates/release.py:110-275` implements trace integrity, collision, boundary, fault coverage, progress, and soft comfort. §13 dimensions **2 (false interventions), 4 (lane control) and 5 (degraded behaviour)** have no gate representation today; dimension 7 (regressions) has none because there is no release-level gate at all. Phase 8 builds more than the amendment implies |
| 0-A.7.4 | The closed-profile gate returns `INVALID_EVIDENCE` for unknown finding IDs | CONFIRMED — **and stricter** | `release.py:127-136`: `set(by_id) != set(expected_findings)` — a *missing* expected finding is equally fatal, and each finding's `(verifier, verifier_version, hard_invariant)` triple must match exactly |
| 0-A.7.7 | "regressed" diverges from the existing strict-inequality comparator | CONFIRMED | `compare.py:186-195`, no tolerance |
| 0-A.7.10 | `_compatibility` requires identical policy identity/config/seed/commit and forbids comparing controllers | CONFIRMED | `compare.py:57-180`, 26 equality checks + repository-commit check |
| 0-A.8.2 | Reuse the digest-bound registry pattern from the approved Phase 7 design | CONFIRMED as a **design only** | Described at `PHASE7_EVALUATION_ADEQUACY_AND_HUMAN_VALIDATION_DESIGN.md:1132-1136`. There is **no implementation and no registry file** in this checkout — `config/` holds only the four gate/shield YAMLs. Phase 8 reuses the documented pattern, not code |
| 0-A.9.1 | Adapter hardcodes a straight map, forces `speed_mps: 0.0`, spawns one actor, supports two kinds | CONFIRMED, all four | `"map": "S"` (`metadrive.py:307`); `raise ValueError("Phase 2 MetaDrive scenarios require initial speed_mps: 0.0")` (`:295-299`); one `challenge_payload`; two `ChallengeConfig` members |
| 0-A.9.5 | The existing workbench is ~2,100 lines | CONFIRMED | `workbench/app.py` = 2,130 lines |
| 0-A.9.7 | Extend the real typer surface: `doctor, run, sim-smoke, verify-artifact, review-artifact, review-compare, workbench, compare`; `compare` keeps positional dirs | CONFIRMED | `cli.py` command registrations |
| 0-A.9.7 | "ADAS functions are selected via `--policy` **registrations**" | **CORRECTED** | No registry exists; `cli.py:282` hardcodes one policy per simulator. But `policy_factory` injection already exists in the orchestrator, so this is a CLI-registry addition, not a runtime change |

**No §0-A repo reference was refuted.** Three are corrected in detail (0-A.2.2, 0-A.7.3, 0-A.9.7) and
one (0-A.2.3) turns out to need no work at all.

---

## 5. Test inventory and the immutable Phase 0–6 contract set

35 test files, **465 test functions**, **756 collected cases** (parametrisation accounts for the
difference). No test carries the `metadrive` marker (§1.2).

### 5.1 Inventory

| File | Fns | Contract pinned |
|---|--:|---|
| `tests/unit/test_review_models.py` | 79 | Review/comparison envelope models, digest-role and identity invariants |
| `tests/unit/test_workbench_projection.py` | 45 | Presentation projection: exact values, units, thresholds, availability |
| `tests/cli/test_review_cli.py` | 35 | `review-artifact` / `review-compare` output and CLI/UI parity |
| `tests/integration/test_workbench_smoke.py` | 27 | End-to-end workbench over real bundles |
| `tests/unit/test_doctor.py` | 22 | Environment diagnostics |
| `tests/unit/test_review_capture.py` | 21 | Immutable no-follow capture, path containment, TOCTOU |
| `tests/unit/test_artifact_verification.py` | 20 | Bundle verification, quarantine, integrity failure modes |
| `tests/unit/test_architecture_boundaries.py` | 16 | AST dependency rules (UI must not import adapters/policies/shields/gates/verifiers) |
| `tests/unit/test_review_facade.py` | 16 | Facade contract shared by CLI and UI |
| `tests/unit/test_verifiers_and_gate.py` | 15 | Verifier findings + non-compensatory gate precedence |
| `tests/unit/test_scenarios.py` | 13 | Scenario schema, strict loading, **golden schema-1.0 digests** |
| `tests/unit/test_canonical_trace.py` | 13 | Canonical JSON, hash chain, **one golden SHA-256** |
| `tests/integration/test_fake_run.py` | 12 | Full fake run → bundle → verification |
| `tests/unit/test_workbench_launcher.py` | 11 | Loopback-only bind behaviour |
| `tests/integration/test_fault_run.py` | 10 | Schema-3 fault run end-to-end |
| `tests/unit/test_comparison.py` | 9 | Fail-closed compatibility + delta semantics |
| `tests/unit/test_review_comparison.py` | 9 | Comparison envelope, incompatibility reasons |
| `tests/cli/test_phase1_cli.py` | 9 | `run` / `verify-artifact` behaviour and exit codes |
| `tests/unit/test_metadrive_adapter.py` | 8 | Adapter config, decision repeat, observation mapping |
| `tests/unit/test_metadrive_challenge.py` | 8 | Scripted challenge-actor behaviour |
| `tests/unit/test_fault_injection.py` | 7 | Deterministic fault transforms |
| `tests/unit/test_domain_models.py` | 7 | `Action`/`Observation`/`Measurement` invariants |
| `tests/unit/test_deterministic_shield.py` | 7 | Shield braking logic, TTC convention |
| `tests/unit/test_review_projection.py` | 6 | Projection envelope shape |
| `tests/unit/test_gate_config.py` | 5 | Gate-config schema `"1.0"` |
| `tests/unit/test_artifact_schema_version.py` | 5 | Evidence schema version acceptance/rejection |
| `tests/unit/test_reviewer_comprehension_docs.py` | 5 | Docs/anchor consistency |
| `tests/cli/test_cli_errors.py` | 5 | Error taxonomy and exit codes |
| `tests/unit/test_fake_adapter.py` | 4 | Fake adapter determinism |
| `tests/unit/test_cli.py` | 4 | CLI wiring |
| `tests/unit/test_policy_and_shield.py` | 3 | `DrivingPolicy` / `SafetyShield` protocol conformance |
| `tests/integration/test_metadrive_run.py` | 3 | MetaDrive run path **against an in-test `_Env` double** |
| `tests/unit/test_shield_config.py` | 2 | Shield-config schema `"1.0"` |
| `tests/integration/test_review_artifacts.py` | 2 | Review over stored bundles |
| `tests/cli/test_phase3_cli.py` | 2 | `compare` CLI surface |

### 5.2 The immutable set

These pin evidence, gate or comparison **semantics**; changing an assertion here is a silent breaking
change and is forbidden by §39. They may gain companions, never edits:

`test_scenarios.py` (golden digests + strict loading), `test_canonical_trace.py` (canonical JSON and
hash chain), `test_artifact_verification.py`, `test_artifact_schema_version.py`,
`test_verifiers_and_gate.py` (non-compensatory precedence), `test_comparison.py` +
`test_review_comparison.py` (fail-closed compatibility), `test_review_capture.py` (path containment,
symlink rejection, TOCTOU), `test_architecture_boundaries.py` (layering), `test_domain_models.py`
(`Action` invariant), `test_fault_injection.py` + `test_fault_run.py` (fault determinism),
`test_cli_errors.py` (exit codes).

Implementation-detail tests that may legitimately evolve alongside a versioned change: the workbench
projection/rendering tests, `test_doctor.py`, `test_workbench_launcher.py`,
`test_reviewer_comprehension_docs.py`.

Golden literals that will break loudly on any canonical-serialisation drift — exactly 7 hex digests in
3 files: `test_canonical_trace.py:367`, `test_review_comparison.py:335-340` (4, in expected message
text), `test_scenarios.py:59,62` (2 scenario digests).

### 5.3 Impact map for the four planned Phase 8 changes

| Change | Test files that must be extended (not edited away) |
|---|---|
| (a) New required bundle file | `test_review_capture.py`, `test_workbench_smoke.py`, `test_fake_run.py` |
| (b) `evidence_schema_version` → `"3.0"` | `test_artifact_schema_version.py`, `test_comparison.py`, `test_review_comparison.py`, `test_review_models.py`, `test_review_capture.py`, `test_workbench_projection.py`, `test_review_artifacts.py`, `test_fault_run.py`, `test_review_cli.py` |
| (c) Scenario `schema_version` → `"4.0"` | the 16 files matching `schema_version`, notably `test_scenarios.py`, `test_canonical_trace.py`, `test_metadrive_adapter.py`, `test_metadrive_challenge.py`, `test_fault_injection.py` |
| (d) Comparison variation axis | `test_comparison.py`, `test_review_comparison.py`, `test_review_models.py`, `test_workbench_projection.py`, `test_workbench_smoke.py`, `test_phase3_cli.py`, `test_metadrive_run.py`, `test_review_cli.py` |

Measured precisely, `evidence_schema_version` appears **37 times across those 9 files**
(`test_artifact_schema_version.py` 12, `test_fault_run.py` 10, `test_review_models.py` 5,
`test_comparison.py` 4, the rest 1–2 each). Because a 3.0 bump is *additive and version-gated*, tests
that construct 1.0/2.0 bundles keep passing unchanged; the work is widening the acceptance allowlists
(§6.3) and adding 3.0 cases beside the existing ones. Change (c) should still land before (b), because
a schema-4.0 scenario is the only thing that will *produce* a 3.0 bundle to test against.

---

## 6. Extension points and compatibility risks

### Risk register

| # | Severity | Risk | Lands in |
|---|---|---|---|
| 6.0 | CRITICAL | Any new optional scenario field changes every existing scenario digest → all 43 bundles invalid | Sprint 1a |
| 6.1 | CRITICAL | No schema version allows `challenge` + `faults`; `"4.0"` falls into the schema-3 `else:` branch; two trace gates keyed to `"2.0"`/`"3.0"` | Sprint 1a |
| 6.2 | CRITICAL | Verifier profile set is closed, doubly registered, and selected in two independent places | Sprint 1 |
| 6.3 | CRITICAL | Review layer rejects `evidence_schema_version "3.0"` | Sprint 1 |
| 6.4 | CRITICAL | Comparison compatibility is a tested fail-closed contract (26 checks) that §0-A.7.10 deliberately relaxes | Sprint 2 |
| 6.5 | CRITICAL | Release gate **fails open** for a registered hard finding with no precedence branch | Sprint 0.5 |
| 6.6 | CRITICAL | Verification hardcodes policy/adapter identity + config byte-for-byte; ADAS runs self-verify as INVALID_EVIDENCE | Sprint 1a/1 |
| 6.7 | MINOR | Trace-level `latency_source` policy-name allowlist stops firing for new policies (the guarantee is still enforced policy-agnostically in `verification.py`) | Sprint 1 |
| 6.8 | CRITICAL | `compute_metrics` `isinstance` dispatch would silently return `RunMetricsV2` for a V3 trace | Sprint 1 |
| 6.9 | CRITICAL | Review layer encodes per-schema metric sets as prefix slices, freezes `(schema, profile)` pairs, exact-matches the comparison dimension tuple, and couples comparison to review schema version | Sprints 1–2 |
| 6.10 | MAJOR | Gate-config / shield-config schemas pinned at `"1.0"` | Sprint 2 |
| 6.11 | MAJOR | MetaDrive adapter: straight map, zero spawn speed, one actor, two kinds, no lane-relative state | Sprint 1a |
| 6.12 | MAJOR | `telemetry.parquet` needs an undeclared dependency | Sprint 4 |
| 6.13 | MINOR | No ego driver model exists | Sprint 1 |
| 6.14 | MAJOR | Brake actuator lag under the noop shield forces ADAS onto schema-2+ trace events, which are currently bound to fault scenarios | Sprint 1a/1 |

**The single highest risk**, and the one least visible from the PRD: *the repository is a tightly
digest-bound, exact-equality machine in far more places than the amendments assume.* Five of the nine
criticals (6.0, 6.3, 6.6, 6.8, 6.9) are cases where a natural, idiomatic extension compiles, passes its
own new tests, and then either silently produces wrong evidence or invalidates existing evidence. The
mitigation discipline for all of them is identical: **write the test that pins the old behaviour first,
then version-gate the new behaviour, and never widen a check that pre-4.0 evidence depends on.**

### 6.0 CRITICAL — adding *any* optional scenario field silently invalidates every existing bundle

`src/hermes/scenarios/loader.py:36-43`:

```python
def _resolved_scenario_payload(scenario: ScenarioDefinition) -> dict[str, object]:
    """Return schema-aware content without changing established v1 identities."""
    resolved = scenario.model_dump(mode="json")      # <-- dumps EVERY field
    if scenario.schema_version == "1.0":
        resolved.pop("challenge")
    if scenario.schema_version in {"1.0", "2.0"}:
        resolved.pop("faults")
    return resolved
```

`scenario_digest` is SHA-256 over this payload. Adding §0-A.5.1's optional `odd`, `tags`, `adas` and
`requirements` blocks to `ScenarioDefinition` puts them in `model_dump()` for **1.0/2.0/3.0 scenarios
too**, changing their digests. The blast radius:

- `verification.py:1179` — `if context.run_context.scenario_digest != scenario_digest(scenario):` —
  re-verification recomputes the digest from the stored `scenario.resolved.yaml` and compares it to the
  stored run context. **All 43 existing `artifacts/` bundles would become invalid evidence**, including
  the `handoff-*` fixtures the Phase 6 review tests and the Phase 7 human-validation plan depend on.
- `compare.py:73` — scenario digest is a fail-closed compatibility check.
- `tests/unit/test_scenarios.py:56-77` — a golden test pinning
  `fake_nominal.yaml` → `c8d4e793…` and `metadrive_nominal.yaml` → `675413578f…`, which also asserts
  `"challenge:" not in resolved_scenario_yaml(...)` and `"faults:" not in ...`.

**Mitigation (mandatory, Sprint 1a):** extend the existing pop-list pattern so every 4.0-only field is
removed for `schema_version in {"1.0", "2.0", "3.0"}`. The mechanism already exists and is documented
in the function's own docstring — it just has to be extended in the same commit that adds the fields.
Pin it with a test that re-verifies a pre-existing bundle end-to-end, not only the two golden digests.

### 6.1 CRITICAL — no existing schema version allows `challenge` **and** `faults` together

`ScenarioDefinition.reject_contradictory_configuration` (`models.py:274-345`):

- `schema_version == "1.0"` → challenge forbidden, faults forbidden
- `schema_version == "2.0"` → **faults forbidden**, challenge **required**, adapter must be metadrive
- `else:` (today only `"3.0"`) → **faults required and enabled**

ADAS needs both at once (a lead-vehicle challenge under observation delay). Three consequences:

1. **Adding `"4.0"` to the `Literal` puts it in the `else:` branch**, which would reject any ADAS
   scenario without an enabled fault profile. The validator must be restructured to an explicit
   `elif self.schema_version == "3.0":` plus a new `"4.0"` branch, with 1.0/2.0/3.0 behaviour proven
   byte-identical by tests written *before* the change.
2. `trace.py:274-283` selects the **exact permitted `observation_summary` field set** by
   `scenario.schema_version == "2.0"` → challenge fields, else the 6 base fields, and raises
   `TraceIntegrityError` on any mismatch. A 4.0 challenge scenario would be handed the *base* field set
   and fail trace integrity; and every new ADAS observation field (curvature, lead relative
   acceleration, in-path flag) must be added to a new 4.0 field set or it will fail the same check.
3. `trace.py:537` requires `scenario.schema_version != "3.0"` → `TraceIntegrityError("schema-2 fault
   trace requires a schema-3 fault scenario")`. A 4.0 scenario with faults fails here.

**A schema-4.0 ADAS scenario with a challenge and a fault trips all three simultaneously.** This is the
single highest-risk item in Phase 8 and it lands in Sprint 1a, before any controller work.

Also required: `_CHALLENGE_PHASES` (`trace.py:186-192` = `PRE_TRIGGER, BRAKING, RECOVERY, CUT_IN,
POST_CUT_IN`) needs new members for `stationary_lead`, `cut_out_reveal`, `lead_accelerate`,
`steady_lead`.

### 6.2 CRITICAL — the verifier profile set is closed and doubly registered

Adding ADAS findings requires, in `gates/release.py`, all three of:

1. new `VerifierProfile` members (`:15`, currently only `LEGACY`, `FAULT_COVERAGE`),
2. entries in `EXPECTED_FINDINGS_BY_PROFILE` (`:56`) enumerating the **complete** finding set with each
   `(verifier, version, hard_invariant)` triple, and
3. entries in `EVIDENCE_REQUIREMENTS_BY_PROFILE` (`:82`) — a *separate* mapping consumed by the review
   facade; a missing key is a `KeyError`, not a graceful default.

Profile selection is **auto-derived from "does the scenario have faults" in two independent places**:
`orchestrator.py:582-584` and `verification.py:1307-1309`. If Phase 8 extends one and not the other,
the run-time verdict and the re-verification verdict silently disagree. Both must move to a shared
selector.

### 6.3 CRITICAL — `evidence_schema_version "3.0"` is rejected by the review layer

`review/models.py:567`:

```python
if self.manifest_identity.evidence_schema_version not in {"1.0", "2.0"}:
    raise ValueError("retained manifest identity requires a supported evidence schema")
```

Every ADAS bundle at evidence schema 3.0 would fail to build a review envelope, breaking
`review-artifact`, `review-compare` and the workbench. Additionally `verification.py:1197` forbids
mixed versions inside one bundle, so metrics/trace/run-context/execution-context must move to 3.0
together — a single coordinated change set, exactly as §0-A.6.1 requires.

### 6.4 CRITICAL — comparison compatibility is a deliberate, tested fail-closed contract

`compare.py:_compatibility` enforces 26 equality checks plus a repository-commit check. Relaxing it to
a declared variation axis (§0-A.7.10) changes a safety contract that AGENTS.md §16 states as a rule
("Fail closed for incompatible evidence"). It gets its own test suite and comparison schema bump, and
lands **before** any ADAS baseline-vs-candidate run. See the conflict record in §9.1.

Note the fail-closed set also includes `Python version`, `platform` and `architecture` — consistent
with §0-A.7.8's decision that cross-platform bitwise identity is an explicit non-goal.

### 6.5 CRITICAL — the release gate fails **open** for an unhandled hard finding

`gates/release.py` resolves the verdict by an ordered precedence chain: trace → safety-unavailable →
collision → boundary → fault-coverage → progress-unavailable → progress → soft → PASS. The soft bucket
is (`:193-197`):

```python
soft_nonpassing = [
    finding for finding in findings
    if not finding.hard_invariant and finding.status is not FindingStatus.PASS
]
```

A **hard** finding (`hard_invariant=True`) that is correctly registered in
`EXPECTED_FINDINGS_BY_PROFILE` but has **no explicit branch** in the chain is excluded from
`soft_nonpassing` by the `not finding.hard_invariant` filter, matches no earlier branch, and therefore
falls through to `verdict = Verdict.PASS` **while failing**.

This is not exploitable today — the two existing profiles enumerate exactly the six/seven findings that
do have branches — but it goes live the moment Phase 8 registers its first hard ADAS finding
(`aeb.no_false_intervention`, `collision.severity_bounded`, …). A failing AEB invariant would be
reported as PASS.

**Mitigation (Sprint 1, before any ADAS finding is registered):** add a catch-all branch — any
`hard_invariant` finding whose status is not PASS yields HOLD (NOT_AVAILABLE yields the configured
missing-evidence verdict) — and a test that registers a synthetic unhandled hard finding and asserts
the verdict is not PASS. This *strengthens* an existing contract, so it is permitted under §39.

### 6.6 CRITICAL — stored-evidence verification hardcodes component identity and config

`evidence/verification.py:717-736` re-derives the expected execution context and compares it
byte-for-byte:

```python
if context.adapter.name == "fake":
    expected_policy_config = {
        "target_speed_mps": scenario.control.target_speed_mps,
        "simulated_policy_latency_ms": expected_latency,
    }
    if context.policy.name != "baseline" or context.policy.version != "1.0":
        errors.append("execution-context.json contains an unsupported fake policy")
    ...
    if canonical_json_bytes(context.policy.config) != canonical_json_bytes(expected_policy_config):
        errors.append("execution-context.json baseline policy configuration is unsupported")
```

and at `:881-885` does the same byte-exact comparison for the **entire MetaDrive adapter config**.
Consequences:

- **Any ADAS policy run on the fake adapter self-verifies as INVALID_EVIDENCE** (CLI exit 30) even
  when the run is clean, because its name is not `baseline` and its `evidence_config` carries
  controller tunables.
- **Any Sprint 1a adapter config addition** (nonzero spawn velocity, curved map, actuator-lag metadata)
  breaks MetaDrive verification for every run.
- The shield allowlist (`:544-558`) admits only `("noop","1.0")` and `("deterministic","1.0")` — the
  §0-A.2.3 noop decision is safe here, but a new shield would not be.

**Mitigation:** these branches must become schema-4.0-aware — keep the exact legacy expectations for
scenarios at 1.0/2.0/3.0, and for 4.0 verify the *shape and digest binding* of the policy/adapter
config rather than a hardcoded literal. This is unavoidable work in Sprint 1a and Sprint 1, and it must
not be done by loosening the pre-4.0 path.

### 6.7 MINOR — the trace's policy-name `latency_source` allowlist stops firing (guarantee is preserved elsewhere)

`evidence/trace.py:788-794`:

```python
if event.run_context.policy_name in {"baseline", "metadrive-idm"} and (
    event.latency_source != "simulated"
):
    raise TraceIntegrityError(...)
```

A new ADAS policy name does not match the allowlist, so this particular check stops firing.

**But the guarantee is not lost.** `verification.py:901-910` enforces
`event.latency_source == "simulated"` for **every event of every run**, gated only on the policy config
carrying a valid `simulated_policy_latency_ms` (required for all runs); the policy name is used solely
to pick the error wording. Every published run is self-verified through that path
(`execute_*_run` → verify → publish), and `tests/unit/test_artifact_verification.py:421-438` pins it
("fake adapter latency_source must be simulated").

So this is redundancy loss, not a weakened contract, and it is **not** a §39 violation. Phase 8 should
still extend the trace-level allowlist to registered ADAS policies so the two layers stay in agreement,
but it is a tidy-up, not a blocker.

> **Correction record.** This item was initially graded CRITICAL on the strength of the trace-level
> allowlist alone. Re-checking found the second, policy-agnostic enforcement site in `verification.py`.
> Graded down to MINOR and removed from the Sprint 0.5 gating work.

### 6.8 CRITICAL — `compute_metrics` would silently drop every ADAS metric

`evidence/metrics.py:142-161` dispatches on `isinstance`:

```python
if not isinstance(events[0], TraceEventV2):
    return RunMetrics(**common)
...
return RunMetricsV2(**common, ...)
```

A `TraceEventV3` subclassing `TraceEventV2` — the natural, established modelling choice — passes the
V2 `isinstance` check and returns a **`RunMetricsV2`**, dropping every ADAS field with no error and no
failing test. The bundle would then be internally consistent and simply missing the metrics Phase 8
exists to produce.

**Mitigation:** dispatch on V3 *before* V2, and add a test asserting that a V3 event stream yields
`RunMetricsV3`. The same most-derived-first ordering applies to every other `isinstance(…, TraceEventV2)`
site.

### 6.9 CRITICAL — the review layer encodes per-schema metric sets as prefix slices

`review/models.py:2418-2422`:

```python
expected_metrics = (
    METRIC_ORDER[:13] if schema == "1.0" else METRIC_ORDER if schema == "2.0" else ()
)
if tuple(item.metric_id for item in self.metrics) != expected_metrics:
    raise ValueError("metrics must match the evidence-schema registry")
```

An evidence schema of `"3.0"` falls into `else ()` — the envelope would require **zero** metrics and
reject any bundle that has them. Two more closed sets compound this:

- `review/models.py:2333` — `if (schema, profile) not in {("1.0","legacy"), ("2.0","fault_coverage")}`
  → "evidence schema and sufficiency profile must use the frozen pairing".
- `review/projection.py:1565-1578` — `_COMPARISON_DIMENSION_ORDER` is an 11-tuple compared for **exact
  equality**, with positional slicing (`_COMPARISON_PARTITION_ORDER = _COMPARISON_DIMENSION_ORDER[2:-1]`,
  and a further `[:6]` at :1981). Adding an ADAS comparison dimension anywhere but one specific
  position silently mis-partitions the chart series; adding one without updating the tuple raises.

And `review/models.py:2615` forces `tool.review_schema_version == comparison_schema_version`, so
**§0-A.7.10's "comparison schema version bump" cannot be done in isolation** — it drags the whole review
envelope version with it. `REVIEW_SCHEMA_VERSION` (`review/models.py:23`) is likewise not the source of
truth: the literal `"1.0"` is hardcoded at ~13 sites and the constant has a single reader (`:394`).

Finally, `review/models.py:2105-2114` **re-derives** comparison status with its own private copy of the
strict comparator. A tolerance-aware core (§0-A.7.7) that returns UNCHANGED where the envelope's copy
computes REGRESSED will fail envelope validation. Core and envelope must share one comparator.

**Consequence for planning:** §0-A.9.5's "P0 = summary + longitudinal + comparison panels" is the right
call, but even the minimal path requires structural change in `review/models.py` — this is the single
most under-budgeted area in the PRD.

### 6.10 MAJOR — gate-config and shield-config schemas are pinned at `"1.0"`

`gates/config.py:36` and `shields/config.py:23` are both `schema_version: Literal["1.0"]`.
§0-A.7.2's gate-config schema 2.0 requires widening the gate literal and versioning the four files in
`config/` (`gates.example.yaml`, `gates.phase1.yaml`, `gates.phase2.yaml`, `shield.phase3.yaml`).

### 6.11 MAJOR — MetaDrive adapter constraints (Sprint 1a)

| Constraint | Site | Change |
|---|---|---|
| Straight map hardcoded | `metadrive.py:307` `"map": "S"` | curved-map support, schema-4.0 gated |
| Initial speed forced to 0.0 | `metadrive.py:295-299` | allow nonzero spawn speed; the reset check at `:436-448` already compares observed vs scenario speed and stays valid |
| One challenge actor | single `_challenge_payload` | multi-actor support |
| Two scripted kinds | `metadrive_challenge.py` | four new kinds |
| No lane-relative state | observation builder `metadrive.py:465-490` | add `curvature_1pm`, lead relative acceleration, in-path flag, lane validity |

Partial credit on the observation contract: `Observation` (`models.py:58-76`) **already carries**
`front_distance_m`, `front_relative_speed_mps`, `observation_age_s`, the three `challenge_actor_*`
fields and `challenge_phase`; and **`ego_acceleration_mps2` already exists** as
`observation.vehicle_state.acceleration_mps2` (`models.py:50`). Of §0-A.4.1's four requested additions,
only `curvature_1pm`, lead relative acceleration and the in-path flag are genuinely new.

All of it must be gated on schema ≥ 4.0 so 1.0/2.0/3.0 behaviour stays byte-identical (§0-A.5.5,
§0-A.9.10).

### 6.12 MAJOR — `telemetry.parquet` needs an undeclared dependency

`pyproject.toml` declares only pydantic, PyYAML, rich and typer. `pyarrow` 24.0.0 and `pandas` 3.0.5
are present in `hermes-dev` only **transitively** (via streamlit). Making `telemetry.parquet` required
(§0-A.6.5) means declaring a real dependency — a fresh `pip install -e .` would otherwise fail at
runtime. `.gitignore` also excludes `*.parquet` globally; harmless while `artifacts/*` is ignored, but
any committed fixture parquet would need an explicit negation.

### 6.13 MINOR — the ego driver model does not exist

There is no scripted ego driver; the policy is the sole source of `Action`. §0-A.3.2's deterministic
longitudinal driver for FCW/AEB-only scenarios is new code, best placed **inside** the ADAS policy
(as the non-intervening baseline behaviour it overrides) so it stays within the `DrivingPolicy`
contract rather than becoming a second action source in the run loop.

### 6.14 MAJOR — the brake actuator lag forces ADAS runs onto schema-2+ trace events

§0-A.3.7's first-order brake actuator lag belongs in the run loop between `shield.apply` and
`adapter.step` (`orchestrator.py:352-360`), alongside the existing control-fault transform, so it is
recorded as executed-action evidence. It must not live inside the policy, or AEB metrics would measure
commanded rather than applied braking.

But `trace.py:745-755` constrains where it can be recorded:

```python
permitted_action = (
    event.permitted_action if isinstance(event, TraceEventV2) else event.executed_action
)
if event.run_context.shield_name == "noop" and (
    event.candidate_action != permitted_action or event.override_reasons
):
    raise TraceIntegrityError("no-op shield evidence is contradictory ...")
```

On a **schema-1** event, `permitted_action` *is* `executed_action`, so under the noop shield —
precisely the configuration §0-A.2.3 mandates for ADAS — `candidate_action` must equal
`executed_action`. Any actuator lag would make them differ and raise. On a **schema-2+** event
`permitted_action` is its own field, so `candidate == permitted` still holds while `executed` may
legitimately differ; that is exactly how the existing control-delay fault is represented.

**Therefore ADAS runs must emit `TraceEventV2`/`V3`, never schema-1 events.** And since schema-2 events
are today hard-bound to schema-3 *fault* scenarios (`trace.py:537`), Sprint 1a's schema-4.0 work must
unlock V2+ events for ADAS scenarios that declare **no** faults — otherwise every nominal-exposure
scenario is stuck on schema-1 events and cannot carry actuator lag, `permitted_action`,
`result_observation` or control-latency evidence. This is a hard sequencing constraint, not a detail.

---

## 7. Cross-cutting duplication map

A per-subsystem reading cannot see these. Each row is a literal that exists in more than one place and
must be changed in lockstep.

| Concept | Sites |
|---|---|
| Bundle file inventory (10 files) | `evidence/artifacts.py:39` `REQUIRED_ARTIFACT_FILES`; `review/models.py:41` `ArtifactFileName` (closed `Literal`); `review/models.py:73` `ARTIFACT_FILES`; `review/projection.py:94` source-type→filename map; `verification.py:1065` `manifest.required_files != REQUIRED_ARTIFACT_FILES` |
| Metric direction / unit | `review/models.py:138` `METRIC_REGISTRY`; `comparison/compare.py:493` `_MEASUREMENT_DIMENSIONS` |
| Verifier-profile selection | `orchestrator.py:582-584`; `verification.py:1307-1309` |
| `evidence_schema_version` allowlist | `verification.py:228-244` and `:492-514`; `review/models.py:567` `{"1.0","2.0"}`; `trace.py:709` |
| Scenario `schema_version` gates | `models.py:288-345` validator; `trace.py:282` (`== "2.0"`); `trace.py:537` (`!= "3.0"`); `scenarios/loader.py:39-42` (digest pop-list, §6.0) |
| Challenge-phase vocabulary (`PRE_TRIGGER, BRAKING, RECOVERY, CUT_IN, POST_CUT_IN`) | `Observation.challenge_phase` closed `Literal`, `models.py:69-76`; `_CHALLENGE_PHASES`, `trace.py:186-192` |
| Schema version literals `"1.0"` | `gates/config.py:36`; `shields/config.py:23`; `FaultConfig` `models.py:175`; `REVIEW_SCHEMA_VERSION` `review/models.py:23` + `Literal["1.0"]` at :380, :466, :2233; `comparison_schema_version` :2597 |

---

## 8. Implementation sequence

Every sprint's exit criterion includes **the full Phase 0–6 suite green** (§0-A.9.10) and ruff clean on
`src`/`tests`.

**Sprint 0.5 — close the gate fail-open before extending anything.** Pure hardening, permitted
under §39 because it closes a hole rather than loosening a guarantee, and it must land before the
first ADAS finding exists: the release-gate catch-all for unhandled hard findings (§6.5) — otherwise
the first failing ADAS hard invariant is reported as PASS. Behaviour is unchanged for both existing
profiles, which enumerate only findings that already have precedence branches.

Optionally also the `tests/conftest.py` import-provenance guard (§2).

**Sprint 1a — schema + adapter foundations (§0-A.9.1).** Highest risk, no controller code.
Order: (a) failing tests pinning 1.0/2.0/3.0 validation and digests byte-for-byte, including an
end-to-end re-verification of an existing `artifacts/` bundle; (b) extend
`_resolved_scenario_payload`'s pop-list for every 4.0-only field (§6.0) **in the same commit that adds
the fields**; (c) restructure the scenario validator and add `"4.0"` permitting challenge+faults
(§6.1); (d) 4.0 branches in `trace.py:282` and `:537` plus a 4.0 observation-summary field set and new
`_CHALLENGE_PHASES` members in *both* the `Observation.challenge_phase` literal and `trace.py`;
(e) make the schema-4.0 branches of `verification.py`'s adapter/policy identity checks (§6.6) shape-
and digest-based while leaving the pre-4.0 branches byte-identical; (f) nonzero spawn speed;
(g) four new `ChallengeConfig` kinds; (h) lane-relative observation fields (only `curvature_1pm`, lead
relative acceleration and the in-path flag are genuinely new); (i) control-frequency rule in the
scenario validator (divisors of 50). Multi-actor and curved maps stay P1-tagged until needed.
Then the Risk 8 brake-dynamics calibration against real MetaDrive, recorded as evidence, with scenario
speeds/gaps and AEB thresholds derived from the measured decel-vs-speed curves.

**Sprint 1 — FCW + AEB.** `RunMetricsV3` + `TraceEventV3` + evidence schema 3.0 across the bundle —
including the `review/models.py:567` allowlist, the `(schema, profile)` frozen pairing at `:2333`, and
the `expected_metrics` prefix-slice at `:2418` (§6.3, §6.9) — plus most-derived-first dispatch in
`compute_metrics` (§6.8). New verifier functions + `ADAS_P0_LONGITUDINAL` registered in *both*
`EXPECTED_FINDINGS_BY_PROFILE` and `EVIDENCE_REQUIREMENTS_BY_PROFILE`, behind one shared profile
selector replacing the two copies in `orchestrator.py` and `verification.py` (§6.2). CLI policy
registry passing `policy_factory`. Deterministic ego driver inside the policy. Brake actuator lag in
the run loop — with the `trace.py:745-755` permitted-vs-executed check taught about it, since ADAS runs
use the noop shield (§6.14). Command arbitration per §0-A.2.4 producing a *projected* `Action` (never
throttle>0 with brake>0, which is a pydantic error, not a clamp). The 48-hour MVP (§0-A.9.3) is the
first slice of this sprint.

**Sprint 2 — ACC + two-stage gate + comparison axis.** `a_cmd = min(a_speed, a_gap)` with hysteresis;
gate-config schema 2.0; the release-level gate; the declared-variation-axis change to
`_compatibility` **with its own test suite and comparison schema bump, before any baseline-vs-candidate
ADAS run**. Budget this larger than §0-A.7.10 implies: the comparison schema version is hard-coupled to
the review envelope version (`review/models.py:2615`), the review envelope re-derives comparison status
with its own comparator copy (`:2105-2114`) that must be unified with the tolerance-aware core, and the
comparison dimension tuple is exact-equality-checked and positionally sliced in the projection
(§6.9). Also: the metric registry with tolerances, unifying `METRIC_REGISTRY` and
`_MEASUREMENT_DIMENSIONS` (§7); the deterministic threat oracle and nominal-exposure scenarios; the
minimal longitudinal timeline panel (§0-A.9.5).

**Sprint 3 — 12-scenario P0 suite + faults + determinism harness.** Seven existing faults wired to ADAS
observations; N = 3 bitwise repeat harness emitting `NONDETERMINISM`; the seeded-defect suite
(§0-A.9.9) of 3–5 deliberately degraded controllers the gate must flag.

**Sprint 4 — failure mining + regression promotion.** `failure/classifier.py` with the
OBSERVATION > PLANNING > CONTROL > SYSTEM precedence; trace-anchored window extraction; draft
lifecycle; the approval registry.

**Sprint 5 — agentic layer.** `AgentRuntime` protocol with `ScriptedAgent` as the only CI runtime;
approval enforcement inside `promote_regression`; budgets; `dry_run`; the citation schema and
deterministic citation checker.

**Sprint 6 — workbench P0 panels + demo runbook + docs.**

**P0 cut line (§0-A.9.2):** if core quality is not credible, drop LKA, combined assist, curved geometry,
lane-estimate degradation, and the analyst/brief agents to P1 — and restate the §1.2/§37 portfolio
claims accordingly.

---

## 9. Decision log and recorded conflicts

### 9.1 AGENTS.md §16 "Fail closed for incompatible evidence" vs §0-A.7.10

AGENTS.md is precedence level 2; the current user instruction (this master prompt, which makes §0-A
normative) is level 1. §0-A.7.10 wins and the comparison variation axis is implemented as specified.
**Recorded here as required by AGENTS.md §3.** Mitigation: the relaxation is narrow (exactly one
declared component may differ; scenario digest, seed, gate-config digest, adapter and simulator
identity must still match), it is version-gated by a comparison schema bump, and the existing
fail-closed tests are kept and joined by new ones rather than edited.

### 9.2 §0-A.2.2 "Verifier implementations" — following the real pattern

The `Verifier` Protocol at `contracts.py:85` is dead code: nothing implements or references it.
**Decision:** Phase 8 ADAS evaluators follow the *actual* in-repo pattern — module-level functions in
`src/hermes/verifiers/` returning `Finding`, registered in a `VerifierIdentity` tuple and a
`VerifierProfile`. This satisfies the amendment's intent (no new `evaluators/` or `metrics/` package)
without introducing a second, inconsistent verifier style. If the owner prefers the Protocol be made
real, that is a separate, repo-wide refactor and is out of Phase 8 scope.

### 9.3 The approval subsystem must not erode the Phase 6 trust-state contract

AGENTS.md §8 forbids compressing gate verdict / integrity / authenticity / authorization / deployment
permission into a generic "approved". Phase 8's approval record approves **a repository change** (the
promotion of a draft scenario into the canonical regression suite). It is not evidence approval, not a
gate verdict, and not deployment permission. **Decision:** name it accordingly
(`regression_promotion_approval`), keep it entirely outside the five trust-state fields, and keep the
workbench read-only — it displays approval state and never collects it (§0-A.8.2).

### 9.4 PRD §4.3's disclaimer tokens — reuse the existing trust model, do not add a parallel one

Of the four tokens §4.3 asks every surface to expose, only `SIMULATION_ONLY` exists in the repository.
A full-repo search finds `NOT_PRODUCTION_VALIDATED`, `NOT_SAFETY_CERTIFIED` and
`NO_PHYSICAL_VEHICLE_CONTROL` **only inside the PRD itself**. What does exist is a richer, tested
model — the AGENTS.md §8 five-field trust state, implemented as a closed literal
(`review/models.py:817`: `Literal["NOT_AUTHENTICATED","NOT_EVALUATED","NONE","SIMULATION_ONLY","NOT_DEFINED"]`),
rendered by CLI (`cli.py:670`) and workbench (`app.py:124`), and asserted by at least five tests —
plus the CLI banner at `cli.py:33` ("SIMULATION-ONLY PROTOTYPE — illustrative thresholds; not
road-safety, certification, compliance, or deployment evidence").

§4.3 explicitly defers to this ("If existing Hermes evidence-state conventions provide a better
canonical representation, Phase 7 should reuse them instead of inventing a parallel trust model").
**Decision:** Phase 8 reuses the existing trust-state records and banner; it does not introduce the
four-token block, which would both duplicate and weaken the existing separation of verdict /
integrity / authenticity / authorization / deployment permission.

### 9.5 Environment

Phase 8 runs with `PYTHONPATH="$PWD/src"` against the `hermes-dev` interpreter. The `hermes-dev`
`.pth` is **not** modified, because it belongs to the owner's in-flight Phase 7 environment.

---

## 10. What Sprint 0 deliberately did not do

- No feature code, no schema change, no test change. The only repository change so far is this
  document and the new branch.
- The Phase 7 worktree at `~/.codex/worktrees/Hermes/phase7-evaluation-adequacy-human-validation` was
  **not** read, checked out, merged or modified. Its adequacy machinery is not consumed. The only
  Phase 7 material read is the root-level `PHASE7_EVALUATION_ADEQUACY_AND_HUMAN_VALIDATION_DESIGN.md`,
  which is a tracked file of this checkout, consulted solely for the digest-bound registry pattern
  §0-A.8.2 names.
- No MetaDrive brake-dynamics calibration was performed; that is Sprint 1a work (Risk 8) and its
  numbers must not be guessed here.
- No remote git operation of any kind.
