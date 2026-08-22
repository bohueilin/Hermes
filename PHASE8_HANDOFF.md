# Hermes Phase 8 — Implementation Handoff

**Branch:** `feat/phase8-adas-lab`
**Base:** `feat/phase6-reviewer-comprehension` @ `4eb87654f79654843169d00a656dd2c6f8092de4`
**Governing document:** `HERMES_PHASE7_ADAS_AGENTIC_WORKFLOW_PRD.md` (local-only, untracked) — §0-A normative
**Sprint 0 audit:** [PHASE8_BASELINE_AUDIT.md](PHASE8_BASELINE_AUDIT.md)
**Date:** 2026-08-21

> **Status: partial, and larger than when this note was first written.** Complete: Sprint 0,
> Sprint 0.5, Sprint 1a, the FCW + AEB slice of Sprint 1, the seeded-defect acceptance suite,
> the agentic tool layer with triage and approvals, and baseline-versus-candidate comparison.
> Not started: ACC, LKA, combined assist, `RunMetricsV3`, failure mining, the remaining agents,
> the workbench panels. Nothing below is claimed as done that is not backed by a re-runnable
> command.
>
> **Read [PHASE8_DESIGN_SPEC.md](PHASE8_DESIGN_SPEC.md) and
> [PHASE8_IMPLEMENTATION_NOTE.md](PHASE8_IMPLEMENTATION_NOTE.md) first** — they supersede this
> file's §1 and §2 for anything built after the FCW/AEB slice.

---

## 1. What this branch delivers

A schema-4.0 ADAS scenario, run by an FCW + AEB controller on real MetaDrive physics,
producing a hash-chained evidence bundle whose ADAS findings are computed by an independent
offline oracle and folded into the existing non-compensatory release gate.

Concretely, this now works:

```bash
make demo-adas
```

- **`scenarios/adas/aeb_lead_hard_brake.yaml`** — ego follows a lead at matched speed from
  40 m until the lead brakes hard. Measured: braking begins at 50% of braking authority,
  **zero collisions**, all four ADAS findings PASS, verdict CONDITIONAL on comfort.
  *(This scenario was rewritten after it was found to be measuring nothing — see the
  implementation note §2.1.)*
- **`scenarios/adas/adas_nominal_no_lead.yaml`** and **`adas_nominal_slow_closing.yaml`** —
  threat-free exposure with and without a lead present. Measured: **zero braking steps**, no
  false intervention, and inapplicable metrics reported `NOT_AVAILABLE` rather than as
  passing numbers.

### 1.1 Three defects found in the existing codebase, and fixed

These were not Phase 8 features; they were pre-existing faults that Phase 8 would have
silently inherited. Each was fixed test-first and proven behaviour-preserving.

| Defect | Consequence had it shipped |
|---|---|
| **The release gate failed open** (`235efec`). `soft_nonpassing` filtered on `not hard_invariant`, so a hard finding registered in a profile without its own precedence branch fell through to `PASS` **while failing**. | The first failing ADAS hard invariant — `adas.aeb.threat_response`, `adas.aeb.no_false_intervention` — would have been reported as PASS. |
| **Scenario identity used a forked canonical serializer** (`e78d42f`). `scenarios/loader.py` had a private `json.dumps` without `evidence/canonical.py`'s `-0.0 → 0.0` normalization. Two YAML files describing the *same* scenario produced different digests. | `scenario_digest` feeds `RunContext` and the fail-closed comparison check, so one scenario split into two identities and two runs of it became incomparable. Phase 8's float-dense scenarios and parameter grid raise the exposure sharply. |
| **The Phase 0–6 suite could not run on a fresh clone** (`10343bf`). Eight test modules read gitignored `artifacts/` fixtures that nothing regenerated: 127 failed / 593 passed / 40 errors. | Every "suite green" claim was unverifiable off this one machine, and any digest change would have taken the suite red with no way back. |

### 1.2 Delivered work, by sprint

**Sprint 0 — baseline audit.** [PHASE8_BASELINE_AUDIT.md](PHASE8_BASELINE_AUDIT.md), 1,100 lines:
all twelve §38 answers, every §0-A repo reference verified (none refuted; §0-A.2.2, §0-A.7.3
and §0-A.9.7 corrected in detail), a ranked register of ten critical compatibility risks, a
cross-cutting duplication map, the test inventory and immutable contract set, and a decision
log recording the AGENTS.md §16 conflict that §0-A.7.10 resolves.

**Sprint 0.5 — contract hardening.** The gate fail-open fix; an import-provenance guard that
fails loudly when the suite is run against a different checkout (the `hermes-dev` editable
install points at the read-only Phase 7 worktree — see §4.1).

**Sprint 1a — schema and adapter foundations.**
- Scenario **schema 4.0** (`3d90c91`): the first version permitting a scripted challenge and
  a fault profile together, plus optional `tags`, `odd`, `adas` and `requirements` blocks.
  The validator's terminal bare `else:` held the schema-3 rules, so it was restructured into
  an explicit `elif == "3.0"` plus a 4.0 branch. Enforces the MetaDrive decision-interval
  rule (divisors of 50 Hz) at load time.
- **Trace-layer version gates** (`f7e9025`): the observation-summary field set and the
  schema-2 fault-evidence rule both admit 4.0 without changing how 1.0/2.0/3.0 resolve.
- **Moving ego spawn** (`ad922fc`): schema-4.0 scenarios may start already travelling, so an
  AEB case at 20 m/s does not spend its horizon accelerating from rest.
- **Fixture regeneration** (`10343bf`): `config/phase8-fixture-registry.yaml` plus
  `hermes fixtures list|regenerate|verify`.

**Sprint 1 (FCW + AEB slice).**
- `src/hermes/adas/` — the longitudinal stack as an ordinary `DrivingPolicy` (`dd30b9b`).
- `src/hermes/verifiers/adas.py` — four offline evaluators, gate-config schema 2.0 oracle
  thresholds, two new verifier profiles, one shared profile selector (`a6abe7f`).
- CLI policy registry replacing the hardcoded simulator→policy binding.

### 1.3 Design decisions worth knowing

- **AEB stages on required deceleration**, `a_req = closing² / (2·usable_gap)`, not on TTC.
  A lead that is itself braking makes TTC optimistic, so a TTC-staged AEB intervenes late in
  exactly the flagship scenario. A test pins it: two situations with identical TTC of 2.0 s
  but different required deceleration stage differently.
- **Staging thresholds are fractions of the scenario's braking authority**, so a threshold
  means the same thing at any configured limit.
- **The oracle is not the controller.** Threat labels are recomputed from the stored trace
  and judged against gate-config thresholds whose threat fraction (0.3) sits below the
  controller's own partial-brake fraction (0.4). A controller cannot pass by being configured
  to agree with itself.
- **Brake attribution is provable, not inferred.** `DriverConfig.max_brake` defaults to zero,
  so in a default FCW/AEB run every braking command in the trace is AEB-attributable by
  construction. Raising it opts into ambiguous attribution.
- **AEB release requires positive evidence of safety** — a distance margin *and* a TTC
  margin. An undefined TTC alone is not a release criterion; it occurs the instant closing
  speed touches zero, mid-intervention.
- **Two ADAS profiles, not one.** A schema-4.0 scenario may declare `adas` and `faults`
  together; a profile's expected finding set is matched for exact equality, so folding both
  into one profile would have silently dropped fault-coverage checking.

---

## 2. Required final evidence (PRD §39)

**1. Commit / checkpoint.** Branch `feat/phase8-adas-lab`, 29 commits from
`4eb87654f79654843169d00a656dd2c6f8092de4`. Head at time of writing: `cdb4637`.

**2. Changed-file summary.** 57 files changed, 9115 insertions(+), 105 deletions(-). New packages: `src/hermes/adas/` (6 files),
`src/hermes/agents/` (6), `src/hermes/fixtures/` (2), `src/hermes/verifiers/adas.py`. New
assets: `config/adas/` (4 controller configs), `config/gates.adas.yaml`,
`config/phase8-fixture-registry.yaml`, `config/phase8-seeded-defects.yaml`, `scenarios/adas/`
(3). New tests: 10 files. Modified: `domain/models.py`, `evidence/{trace,verification}.py`,
`gates/{config,release}.py`, `comparison/compare.py`, `scenarios/loader.py`,
`adapters/metadrive.py`, `runtime/orchestrator.py`, `cli.py`, `verifiers/__init__.py`, and two
existing test files (both extended, no assertion deleted).

**3. Tests.** `947 passed` (`pytest -q`), of which 14 carry the `metadrive` marker and run
against the real simulator. `pytest -q -m "not metadrive"` is the selection CI runs. Ruff
clean repo-wide. Doctor 16 PASS / 2 WARN.

**4. Deterministic-repeat evidence.** N = 3 identical repeats of
`scenarios/adas/aeb_lead_hard_brake.yaml`, seed 7, same host, pinned `SIMULATOR_COMMIT`:

```
Trace digest: 1603319fbd213b018576a672d34097935c9758dcb42db8ab6edd26ab9de99861   (×3)
identical across N=3: events.jsonl, metrics.json, findings.json, verdict.json, trace.sha256
```

Cross-platform bitwise identity remains an explicit non-goal (§0-A.7.8).

**5. Scenario list.** 3 of the 12 P0 scenarios: `adas_aeb_lead_hard_brake` (threat),
`adas_nominal_no_lead` and `adas_nominal_slow_closing` (threat-free nominal exposure, the
latter with a lead present so an over-braking controller has something to react to). The
remaining 9 are listed in §5.

**6. Fault coverage.** **None wired to ADAS yet.** The seven existing fault transforms are
intact and schema 4.0 permits `adas` + `faults` together, with `ADAS_P0_LONGITUDINAL_FAULT`
registered to keep coverage checking — but no ADAS fault scenario has been authored or run.

**7. Baseline/candidate demonstrations.** **Delivered.** `make demo-adas-tradeoff`: a candidate
that brakes far earlier improves minimum TTC from 1.17 s to 4.67 s on the threat scenario and
is still HELD on the nominal scenario for `adas.aeb.no_false_intervention`. The declared
variation axis (§0-A.7.10) is implemented for the core comparator; the review-envelope path
still uses the strict rule.

**8. Agentic workflow demonstration.** **Partially delivered.** Tool layer, permission tiers,
budgets, approvals, deterministic triage and the citation checker are built and tested
(`hermes agent tools|triage|check-citations`). The scenario-curator, regression-builder,
analyst and release-brief agents are not.

**9–10. Limitations and residual risks.** §4.

**11. Demo runbook.** §3.

**12. Reproduction commands.** §3.

---

## 3. Reproduction and demo runbook

Every command assumes the environment note in §4.1.

```bash
cd /Users/bohueilin/Documents/GitHub/Hermes
export HERMES_PY=/Users/bohueilin/miniconda3/envs/hermes-dev/bin/python
export PYTHONPATH="$PWD/src"
```

**Restore the test fixtures on a fresh clone** (needs a clean worktree; the five MetaDrive
fixtures additionally need `third_party/metadrive` vendored):

```bash
$HERMES_PY -m hermes fixtures regenerate
```

**Full gates:**

```bash
$HERMES_PY -m pytest -q && $HERMES_PY -m ruff check . && $HERMES_PY -m hermes doctor
```

**Demo 1 — AEB against a hard-braking lead:**

```bash
$HERMES_PY -m hermes run --simulator metadrive --headless --scenario scenarios/adas/aeb_lead_hard_brake.yaml --policy adas-longitudinal --gate-config config/gates.adas.yaml --seed 7 --run-id adas-threat-demo
```

**Demo 2 — no false intervention when nothing is there:**

```bash
$HERMES_PY -m hermes run --simulator metadrive --headless --scenario scenarios/adas/adas_nominal_no_lead.yaml --policy adas-longitudinal --gate-config config/gates.adas.yaml --seed 7 --run-id adas-nominal-demo
```

**Review either bundle:**

```bash
$HERMES_PY -m hermes review-artifact adas-threat-demo --artifact-root artifacts --format text
```

**Determinism check (N = 3):** run Demo 1 three times with different `--run-id`s and compare
`events.jsonl` byte-for-byte.

---

## 4. Limitations and residual risks

### 4.1 Environment — read this first

The `hermes-dev` conda environment's editable install resolves `hermes` to the **Phase 7
worktree**, not this checkout:

```
.../envs/hermes-dev/.../__editable__.hermes_autonomy-0.1.0.pth
  → /Users/bohueilin/.codex/worktrees/Hermes/phase7-evaluation-adequacy-human-validation/src
```

Always run with `PYTHONPATH="$PWD/src"`. Never edit that `.pth` — it belongs to the owner's
in-flight Phase 7 environment. `tests/unit/test_import_provenance.py` fails loudly if this is
got wrong.

### 4.2 What the evidence does and does not establish

- Simulation only. No physical vehicle, CAN, or road claim. No standards or certification
  claim. Every threshold is illustrative.
- The ADAS findings establish that **this controller, on these two scenarios, at this seed,
  under MetaDrive 0.4.3** braked when the oracle saw a threat and stayed quiet when it did
  not. Two scenarios are not a safety case.
- `adas.fcw.warning_timing` does **not** verify the warning output. The trace has no field
  for the warning signal, so it confirms only that the run presented the closing geometry the
  scenario declares. The finding message says this; do not let it be read as more.
- **Comfort is not under control.** Both demos land CONDITIONAL on `comfort.acceleration` and
  `comfort.jerk`. Measured peak |a| reaches ~13 m/s² against a configured 6 m/s² authority:
  `ControlConfig` limits are declared but **not enforced on the simulator**, and MetaDrive's
  brake dynamics are uncalibrated. This is PRD Risk 8 and it is open — see §5.

### 4.3 Residual risks

| Risk | Status |
|---|---|
| **MetaDrive brake dynamics are uncalibrated** (PRD Risk 8). AEB thresholds were chosen analytically, not derived from measured decel-vs-speed curves, so they may be trivially passable or unachievable at other speeds. | **Open.** Highest-priority remaining ADAS work. |
| **ADAS metrics are not in `metrics.json`.** They live only as finding measurements. `RunMetricsV3` and evidence schema 3.0 are not implemented. | Open — see §5, and audit §6.3/§7 for why it is six model subclasses plus four dispatch maps, not a literal bump. |
| **The review/workbench layer has not been touched.** It renders ADAS bundles as legacy evidence. | Open. Audit §6.9 is the map; it is the most under-budgeted area in the PRD. |
| **Only two scenarios, one seed, no faults, no sweeps.** | Open. |
| **`scenarios/cut_in.example.yaml` and `config/gates.example.yaml` fail validation outright** (21 and 8 errors). A live trap for anyone reaching for "the example" as a template. | Open — audit §6.15. Refresh or delete them. |
| **`*.parquet` is gitignored and pyarrow/pandas are undeclared dependencies**, present only transitively via streamlit. | Open — audit §6.12, blocks §0-A.6.5. |

---

## 5. What remains, in the order I would do it

The [audit's risk register](PHASE8_BASELINE_AUDIT.md) is the working map; each item below
names the finding that governs it. Items 1–4 are the P0 cut line (§0-A.9.2); 5–7 are beyond it.

**1. MetaDrive brake-dynamics calibration (Risk 8).** Measure decel-vs-speed under full brake
across the 0–30 m/s ODD, record it as evidence, and re-derive scenario speeds/gaps and the
AEB authority fractions from the measured curves. Until this is done every threshold in
`config/gates.adas.yaml` and `AebConfig` is an analytical guess, and the comfort story in
§4.2 cannot be fixed. **Do this before authoring more scenarios**, or they will be re-tuned.

**2. `RunMetricsV3` and evidence schema 3.0** (audit §6.3, §6.8, §7). Six V1/V2 model pairs in
`domain/models.py` each declare their own `evidence_schema_version` literal, and
`verification.py` holds four literal `{"1.0": …, "2.0": …}` dispatch maps. Also:
`compute_metrics` dispatches on `isinstance(events[0], TraceEventV2)`, so a `TraceEventV3`
subclassing V2 would silently return `RunMetricsV2` and drop every ADAS metric with no error —
dispatch most-derived-first. And `review/models.py:567` allowlists `{"1.0","2.0"}`, `:2333`
freezes `(schema, profile)` pairs, and `:2418` encodes per-schema metric sets as prefix slices
with `else ()`.

**3. The remaining 10 P0 scenarios** (§0-A.9.2, §0-A.7.6): `fcw_stationary_lead`,
`aeb_stationary_lead`, `slow_lead_closing`, `cut_in_near`, `cut_in_far`,
`cut_out_reveal_stopped`, plus the nominal set `fcw_aeb_nominal_following`,
`adjacent_lane_pass`, `non_in_path_stationary_object`, `decelerating_but_safe_lead`. Several
need the new `ChallengeConfig` kinds (`stationary_lead`, `cut_out_reveal`, `lead_accelerate`,
`steady_lead`) — **not yet implemented**; the union still has exactly two members. Keep the
nominal share at ≥ 30% of suite sim-time.

**4. Wire the seven existing faults to ADAS scenarios.** Schema 4.0 already permits it and
`ADAS_P0_LONGITUDINAL_FAULT` is registered. Note `orchestrator.py:514-528` bars observation
faults on the MetaDrive adapter — that restriction was written for the IDM policy, which
ignores the observation entirely; the ADAS controller does not, so the restriction should be
revisited rather than worked around.

**5. ACC, the two-stage gate, and the comparison variation axis** (§0-A.7.10). Budget the
comparison work larger than the amendment implies: `review/models.py:2615` forces
`comparison_schema_version == review_schema_version`, so it cannot be bumped in isolation;
`:2105-2114` re-derives comparison status with a private copy of the strict comparator that a
tolerance-aware core would disagree with; and `projection.py:1565-1578` compares the
dimension tuple for exact equality and slices it positionally.

**6. Failure mining, regression promotion, the approval registry** (§0-A.8.2). Note the
repository has **no** approval concept today — the only three matches for "approval" are
disclaimers denying that review is approval. Keep the new record outside the five trust-state
fields and name it for what it approves (a repository change), per audit §9.3.

**7. The agentic layer** (§0-A.8) — entirely greenfield, and the workbench P0 panels.

### 5.1 Landmines the next implementer should not rediscover

1. **Any new model field can invalidate stored evidence.** This bit twice: scenario fields
   (audit §6.0) and gate-config fields (fixed in `a6abe7f`). `scenario_digest` and
   `gate_config_digest` hash `model_dump()`, and both are re-derived during verification.
   Every version-only field must be stripped for older versions — see `_SCHEMA_4_ONLY_FIELDS`
   in `scenarios/loader.py` and `_SCHEMA_2_ONLY_FIELDS` in `gates/config.py`.
2. **Bundle capture is bidirectionally exact.** `verification.py:347` rejects *any* file not
   in `REQUIRED_ARTIFACT_FILES` as "unexpected artifact entries", so §24's "Optional:" list is
   not implementable. `agent-trace.jsonl` and `telemetry.parquet` must become schema-gated
   required files.
3. **A verifier profile's finding set is matched for exact equality.** A missing expected
   finding is as fatal as an unknown one, and each finding's `(verifier, version,
   hard_invariant)` triple must match. Register in **both** `EXPECTED_FINDINGS_BY_PROFILE` and
   `EVIDENCE_REQUIREMENTS_BY_PROFILE`.
4. **MetaDrive stores actions as float32** and the adapter aborts when the accepted action
   differs from the requested one. Quantize any new command path to binary32.
5. **Regenerating fixtures needs a clean worktree.** `repository_dirty` comes from
   `git status --porcelain --untracked-files=normal`, and dirty provenance changes comparison
   output. The tool refuses by default.
6. **Profile selection lives in one place now** (`select_verifier_profile`). It used to exist
   as two copies that could drift into disagreeing about a run's own verdict. Keep it single.

---

## 6. Acceptance gates (PRD §30, read as 8A–8D)

| Gate | Status |
|---|---|
| **8A — ADAS core** | **Partial.** FCW ✓, AEB ✓, ACC ✗, LKA ✗ (P1), combined assist ✗ (P1). 2 of 12+ scenarios. Canonical metrics ✗ (`RunMetricsV3` not implemented). Deterministic repeats ✓ (N = 3 bitwise). Evidence bundles ✓. Baseline/candidate comparison ✗. |
| **8B — Failure / regression platform** | **Partial.** Failure taxonomy ✓ with a deterministic classifier. Seeded-defect acceptance suite ✓. Regression promotion ✓ end to end — draft authoring, coverage-gap assessment, requirement floor, approval boundary, promotion. Interesting-event detection ✗, scenario parameterisation and sweeps ✗, ADAS release scorecard ✗. |
| **8C — Agentic workflow** | **Mostly delivered.** Failure-triage agent ✓, deterministic tool contracts ✓, mutation approval boundary ✓, agent cannot set gate verdict ✓ (pinned by test), scenario-curator workflow ✓ (coverage-gap assessment), regression builder ✓. Release-brief generation ✗, complete evidence provenance ✗ (`agent-trace.jsonl` blocked on the bundle's exact-inventory rule). |
| **8D — Portfolio quality** | **Partial.** Demo runbook ✓ (§3), explicit limitations ✓ (§4), no unsupported production claims ✓, reproducible setup ✓, automated tests green ✓. README walkthrough, architecture diagram and screenshots ✗. |

Under §0-A.9.2's staging condition, LKA, combined assist, curved geometry, lane-estimate
degradation and the analyst/brief agents remain the designated drop-to-P1 items. If the phase
were to stop here, §1.2/§37's portfolio claims must be restated to cover FCW/AEB only.
