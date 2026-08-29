# Hermes — Source of Truth

**This is the one file every conversation reads first and updates last.** It supersedes
`PHASE8_STATUS.md`, `PHASE_ALIGNMENT.md`, `PHASE8_HANDOFF.md`, `HERMES_OVERVIEW.md` and
`PHASE8_GETTING_STARTED.md`, all removed on 2026-08-22 (recoverable from git history). Do not
create a new status, handoff, alignment or overview document; edit this one.

| | |
|---|---|
| **Checkouts** | main checkout `…/Hermes` on `main` — **now the integration trunk**: ADAS trunk, FleetLab, and metrics-V3 all merged (but its untracked `artifacts/` is stale — §14; run ADAS validation in the worktree) · FleetLab worktree `…/Hermes-fleetlab` on `feat/phase9-fleetlab` · ADAS worktree `…/Hermes-adas` on **`feat/phase8-metrics-v3`** since 2026-08-25 (canonical `artifacts/` fleet lives there) · Phase 7 codex worktree (read-only) |
| **Remote** | `github` = `https://github.com/bohueilin/Hermes.git` — the only remote; this branch is pushed and in sync |
| **Base of Phase 8** | `feat/phase6-reviewer-comprehension` @ `4eb8765` (2026-08-16) |
| **Phase 8** | FCW/AEB slice complete **+ brake calibration merged 2026-08-24** (`feat/phase8-adas-lab` @ `6b2f375`): measured curve 4–30 m/s, MuJoCo fidelity instrument, Warp kernel, esmini audition; Phase 3 merged @ `a78287e` (stationary-lead pair, ADAS fault wiring, two design notes); **Phase 4 (evidence schema 3.0 / `RunMetricsV3`) complete 2026-08-25, maintenance pass landed and requalified 2026-08-26** on `feat/phase8-metrics-v3` @ `2dda024`, **merged onto `main` 2026-08-26 (`b447fc4`, conflict-free)** — evidence stays commit-bound to `2dda024`; **P0 FCW lane merged 2026-08-27 (`deeca8c`)**: `fcw_stationary_lead`, derived-map adapter change, conditional adapter `1.2`; **steady-lead lane merged 2026-08-28 (`df0e34e`)**: the `steady_lead` kind + measured `slow_lead_closing`/`fcw_aeb_nominal_following` pair — suite **1,521** in the ADAS worktree (§11.1 item 3) |
| **Phase 9** | **FLEET-005 spike built and gated** (2026-08-23) on `feat/phase9-fleetlab`, pushed — `src/hermes/fleet/`, 33 tests, clean-clone green, replayable decision record. The PRD stays local/gitignored |
| **MuJoCo** | sandbox exploration only (`sandbox/mujoco/`, gitignored, never committed, labelled NOT EVIDENCE) |
| **Verification** | merged `main` @ `b447fc4` from the main checkout: **1,443 passed + 8 known artifact-staleness failures** (§14 — the checkout's untracked `artifacts/` predates Phase 3; code proven clean: `src`+`tests` diff vs the verified branch is fleet-only) · ruff clean · doctor 17 PASS / 1 WARN / 1 NOT_AVAILABLE |
| **Published copy** | https://claude.ai/code/artifact/9f41cdb3-b9b1-4721-bc2c-1ab5dabe486b — republish this file path from any conversation with that `url` to update it in place; never publish a second copy |
| **Last updated** | 2026-08-28 |

**Contents:** [0 How to use this file](#0-how-to-use-and-update-this-file) ·
[1 What Hermes is](#1-what-hermes-is) · [2 State at a glance](#2-current-state-at-a-glance) ·
[3 Step-by-step runbook](#3-step-by-step-runbook) · [4 Architecture by layer](#4-architecture-by-layer) ·
[5 History, Phases 0–9](#5-history-phases-09) · [6 ADAS in depth](#6-adas-in-depth-phase-8) ·
[7 MuJoCo and Phase 9](#7-mujoco-sandbox-and-phase-9-fleet-simulation) · [8 What is not claimed](#8-what-is-not-claimed) ·
[9 Defects found and fixed](#9-defects-found-and-fixed) · [10 Coordination rules](#10-coordination-rules-for-parallel-sessions) ·
[11 Next steps](#11-next-steps-by-track) · [12 Landmines](#12-landmines) · [13 Open decisions](#13-open-decisions-that-need-a-human) ·
[14 Housekeeping](#14-housekeeping-and-known-inconsistencies) · [15 Document map](#15-document-map)

---

## 0. How to use and update this file

**Picking up cold, in any conversation:**

```bash
conda activate hermes-dev && cd ~/Documents/GitHub/Hermes
export PYTHONPATH="$PWD/src"      # mandatory — see §3.0; the editable install points elsewhere
git status --short                # expect empty; git log --oneline -1 to see HEAD
make preflight                    # silent + exit 0 = you are on the right checkout
make test                         # expect 965 passed (host with vendored MetaDrive)
```

Then read §2 for numbers, §10 before touching shared code, §11 for what to do next, §12 before
doing it.

**Updating this file — the rules:**

1. Update in place. Every other status-type document was removed so that this one cannot drift
   from a sibling. If a section grows unwieldy, split the *reference* material into a linked doc
   and keep the status here.
2. Every number here is measured, not estimated. When you change code, re-run the relevant
   command and update the figure with the command that produced it. Stale figures have already
   bitten this project four times (§14).
3. Record what you did **and what you deliberately did not do**. The "not claimed" and
   "open decisions" sections are load-bearing; the repository has been audited by an outside
   reader and the overclaims that survived were the expensive ones.
4. Commit this file in the same commit as the work it describes, with the `Last updated` date,
   and republish the artifact (URL in the header) so the readable copy matches the repo.
5. Parallel sessions: read §10 first. Most ways to break Phase 8 are *silent* — a wrong number
   that verifies cleanly, not a red test.

**Ground rules that are not negotiable** (Phase 8 PRD §39; Phase 9 PRD §54; restated because they
erode one small step at a time): simulation only; no CAN, physical-vehicle or public-road claim;
no standards-compliance or certification claim; no weakening of evidence integrity; **no deleting
a prior test to make new work pass**; no agent verdict replacing the deterministic gate; no
language model in a real-time control loop. The Phase 7 worktree is **read-only** (§5.8).

---

## 1. What Hermes is

**A simulation-only lab for deciding whether an autonomy change is safe to advance — and for
proving the decision afterwards.**

> Model proposes. Environment verifies. Gate decides. Trace proves.
> Capability is not permission.

Hermes runs a driving policy against a pinned physics simulator, judges the run with verifiers
that are independent of the policy, resolves those judgements through a release gate that cannot
be talked out of a failure, and writes the whole thing to a hash-chained evidence bundle that can
be re-checked later without re-running anything. It is a personal project, specified by its owner
and implemented largely by coding agents from written specifications (the prompts are committed),
built across twelve days in August 2026. It is not a product.

### 1.1 The problem it is actually about

A quality gate's value is invisible in its normal output. Every passing run looks the same whether
the gate is rigorous or vacuous — the artifact is identical either way. So adoption becomes a
matter of belief, and belief decays: the first time the gate blocks something inconvenient, the
argument is "the gate is wrong," and there is usually nothing in the product to answer with.

Hermes takes that as the design problem. The consequence is that **the demo that sells the tool
is the one where things break correctly**: `make demo-seeded-defects` runs three controllers each
broken in exactly one way, each of which must be caught by *its own named criterion*, plus a
baseline control so "the gate caught it" cannot quietly mean "the gate always fails".

### 1.2 The second idea: trust is decomposed, never aggregated

Gate verdict, integrity, and five separate trust records — authenticity, authorization,
deployment permission, scope, authoritative status — are reported independently, because in a
review tool **the aggregate is the failure mode**. A single status light is what users ask for
and the thing that ruins the tool. The code enforces this structurally: `AuthenticityStatus` has
exactly one member, `NOT_AUTHENTICATED`, because there is no signing and no trust anchor; the enum
cannot express a claim the system cannot support.

---

## 2. Current state at a glance

All figures measured 2026-08-22 at `e6e2c8c`; the command that produced each is shown.

| Measure | Value | Command |
|---|---|---|
| Branch / HEAD | `feat/phase8-adas-lab` | `git branch --show-current; git rev-parse --short HEAD` |
| Phase 8 commits | 36 since `4eb8765` | `git rev-list --count 4eb8765..HEAD` |
| Total commits | 70 | `git rev-list --count HEAD` |
| Phase 8 diff | 74 files, +12,581 / −154 | `git diff --shortstat 4eb8765..HEAD` |
| Remote heads | `feat/phase8-adas-lab` @ `e6e2c8c`, `codex/phase7-…` @ `9d5c0ba` — **nothing else** | `git ls-remote --heads github` |
| Local `main` | `c181509`, Phase 0 only, **not on GitHub** | `git branch -a` |
| Tests | 965 passed; 18 carry the `metadrive` marker | `pytest -q`; `pytest -q -m metadrive --collect-only` |
| Lint | All checks passed | `ruff check .` |
| Doctor | 17 PASS / 1 WARN (no active conda env when invoked by path) / 1 NOT_AVAILABLE (no DISPLAY) | `hermes doctor` |
| Source | 66 files, 22,338 lines | `find src/hermes -name '*.py' \| xargs wc -l` |
| Tests (lines) | 51 files, 19,813 lines | `find tests -name '*.py' \| xargs wc -l` |
| Evidence bundles on disk | 63 under `artifacts/` (gitignored); **13** registered in `config/phase8-fixture-registry.yaml` | `ls -d artifacts/*/ \| wc -l` |
| Scenarios | 9 top-level + 5 under `scenarios/adas/` | `ls scenarios scenarios/adas` |
| Controller configs | `config/adas/{baseline,defect_late_braking,defect_no_aeb,defect_over_braking}.yaml` | |
| Simulator | MetaDrive 0.4.3, vendored at `third_party/metadrive` (gitignored), pinned to `85e5dadc6c7436d324348f6e3d8f8e680c06b4db` | `cat SIMULATOR_COMMIT` |
| Python | 3.11.15 in conda env `hermes-dev`; deps pydantic, PyYAML, rich, typer; extras `dev`, `workbench` | `pyproject.toml` |
| CI | `.github/workflows/ci.yml` — triggers on `main` only; **has never run against this work** | |
| LICENSE | **none** | `ls LICENSE*` |

**Reproducibility off this host — measured, not estimated:**

| From | Result |
|---|---|
| A clean clone, as committed | **144 failed / 761 passed / 42 errors** |
| After `hermes fixtures regenerate` | **24 failed / 883 passed / 40 errors** |
| This development host | 965 passed |

Two causes: `artifacts/` is gitignored, so eight test modules load fixtures by name that nothing
committed can produce (`fixtures regenerate` closes most of the gap); and MetaDrive is **not a
declared dependency** — a vendored, gitignored checkout — so 5 of 13 fixtures cannot regenerate
anywhere the simulator has not been placed by hand. A repository about evidence integrity that
cannot reproduce its own evidence elsewhere is a real contradiction, and it is stated here rather
than discovered by cloning.

---

## 3. Step-by-step runbook

Every command is copy-pasteable and says what it should print.

### 3.0 Setup — read this even if you think you know it

```bash
conda activate hermes-dev
cd ~/Documents/GitHub/Hermes
export PYTHONPATH="$PWD/src"
```

| Symptom | Cause |
|---|---|
| `No module named hermes` | You are in `base`. Activate `hermes-dev`. |
| Everything *appears* to work but results look unfamiliar | **The dangerous one.** The `hermes-dev` editable install (`__editable__.hermes_autonomy-0.1.0.pth`) resolves `hermes` to the **Phase 7 codex worktree**, not this checkout. Without `PYTHONPATH`, `python -m hermes` silently runs a different tree. |

`make` guards against both — it exports `PYTHONPATH` and refuses to start otherwise:

```bash
make preflight        # nothing printed, exit 0 → correct checkout
```

`tests/unit/test_import_provenance.py` fails loudly if the wrong tree is imported. Never edit the
`.pth`; it belongs to the owner's Phase 7 environment.

### 3.1 Verify the whole thing

```bash
make test        # expect: 965 passed
make lint        # expect: All checks passed!
make doctor      # expect: Summary: 17 PASS, 1 WARN, 1 NOT_AVAILABLE
```

`make test` includes 18 tests that drive real MetaDrive physics. What CI runs (simulator-free):

```bash
python -m pytest -q -m "not metadrive"      # 947 tests
```

### 3.2 The six demos, in order of what they prove

**Demo 0 — `make demo-phase1`.** The Phase 1 evidence core on the deterministic fake adapter: run,
then re-verify the bundle from stored bytes. Proves the pipeline without a simulator.

**Demo 1 — `make demo-adas`.** Two ADAS scenarios (threat, then nominal) on real physics, then
triage of the first. Look for `Verdict: CONDITIONAL` on both (every hard ADAS invariant passes;
held on comfort), and `AGENT INTERPRETATION` / `DETERMINISTIC FACT` printed as *separate lines*.

**Demo 2 — `make demo-seeded-defects`.** Expect `7 passed`. Three controllers broken one way each,
run as five cases, each caught by its own named criterion, plus baseline controls. This is the only
evidence that the evaluation *discriminates* rather than merely runs. To watch one fail by hand:

```bash
python -m hermes run --simulator metadrive --headless \
  --scenario scenarios/adas/aeb_lead_hard_brake.yaml \
  --policy adas-longitudinal --policy-config config/adas/defect_late_braking.yaml \
  --gate-config config/gates.adas.yaml --seed 7 --run-id demo-late
```

Expect `Verdict: HOLD`, with `adas.aeb.brake_onset_margin` among the supporting findings. **Read
§6.7 before quoting this** — the HOLD is driven by `progress.required`, not by the ADAS finding.

**Demo 3 — `make demo-adas-tradeoff`.** The one to show people. Expect:

```
verdict        REGRESSED   CONDITIONAL -> HOLD
hard_failures  REGRESSED   [] -> ['adas.aeb.no_false_intervention']
```

A candidate that brakes far earlier improves minimum TTC on the *threat* scenario from
**1.17 s to 4.67 s** (and on the nominal scenario from 18.07 s to 58.40 s). On a collision-and-TTC
scorecard it ships. The gate holds it on the nominal scenario for what it does when nothing is
there. The comparison has no aggregate score and no winner field.

**Demo 4 — `make demo-flywheel`.** Failed run → triage → draft → validate, then stops at the draft
listing. Look for `Coverage: GAP`, the draft's `[VALIDATED]` state (it passed the requirement
floor), and `Approval: none`. Approval and promotion are deliberately manual:

```bash
DRAFT=$(ls drafts | head -1)
python -m hermes regression promote "$DRAFT"            # refused: APPROVAL_REQUIRED
python -m hermes regression approve "$DRAFT" --approver "$(whoami)" \
  --rationale "Reproduces the late-braking failure at the observed geometry."
python -m hermes regression promote "$DRAFT"            # dry run: shows the plan
python -m hermes regression promote "$DRAFT" --execute  # writes into scenarios/adas/
```

Undo: `rm scenarios/adas/*_regression_*.yaml && rm -rf drafts config/phase8-approvals.yaml`.

**Demo 5 — `make demo-cut-in`.** Two scenarios using the *same* cut-in manoeuvre, differing only
in geometry, classified oppositely with **no change to any ADAS or verifier code** — the oracle
never inspects `challenge.kind`. Then two tests: the pair separates by geometry, and each scenario
*passes* the defect the other catches.

### 3.3 The agent surface

```bash
python -m hermes agent tools                 # catalogue: 6 READ, 1 EXECUTE, 1 MUTATE
python -m hermes agent triage demo-late      # proposal recorded beside the deterministic fact
python -m hermes agent check-citations demo-late   # expect: All N citations resolved and matched.
```

The most important behaviour is a refusal, so see it:

```bash
python - <<'PY'
from pathlib import Path
from hermes.agents.tools import ToolContext, promote_regression
context = ToolContext(repository_root=Path.cwd(), artifact_root=Path.cwd() / "artifacts")
draft = Path("/tmp/draft.yaml")
draft.write_text(Path("scenarios/adas/adas_nominal_no_lead.yaml").read_text())
result = promote_regression(context, draft_id="my-draft", draft_path=draft, dry_run=False)
print("ok:", result.ok); print("error:", result.error.code.value, "-", result.error.detail)
PY
```

Expect `ok: False` and `APPROVAL_REQUIRED` — identically for a scripted agent, a model, or you.

### 3.4 Reading a result

```bash
python -m hermes review-artifact demo-late --artifact-root artifacts --format text
cat artifacts/demo-late/verdict.json | python -m json.tool | head -20
```

| Finding | Asks | Kind |
|---|---|---|
| `adas.aeb.threat_response` | Under a real threat, did it brake and avoid contact? | **hard** |
| `adas.aeb.no_false_intervention` | With no threat, did it stay quiet? | **hard** |
| `adas.aeb.brake_onset_margin` | Did braking begin while stopping was still achievable? | soft |
| `adas.fcw.warning_timing` | Did the run present the declared warning exposure? (not the warning itself) | soft |

Hard failing → `HOLD`. Soft failing → `CONDITIONAL`, held for human review.

### 3.5 Prove it is reproducible

```bash
for i in 1 2 3; do
  python -m hermes run --simulator metadrive --headless \
    --scenario scenarios/adas/aeb_lead_hard_brake.yaml \
    --policy adas-longitudinal --policy-config config/adas/baseline.yaml \
    --gate-config config/gates.adas.yaml --seed 7 --run-id "det-$i" | grep "Trace digest"
done
```

Expect the same digest three times (`8bb1c69b…` at `65363ae`; it changes whenever the scenario or
spawn projection changes, which is content-addressing working). Same host, pinned simulator;
cross-platform identity is an explicit non-goal. Clean up: `rm -rf artifacts/det-* artifacts/demo-late`.

### 3.6 Troubleshooting

| Symptom | Fix |
|---|---|
| `No module named hermes` | `conda activate hermes-dev` |
| `make` refuses with a preflight message | Follow it; it names the exact command |
| A test wants a fixture that is absent | `make fixtures` (needs a clean worktree) |
| A clean clone reports ~144 failures | Expected — §2. `make fixtures`; the residual ~24 need the vendored simulator |
| `run ID must be 1-64 lowercase ASCII…` | Letters, digits, hyphens only — no underscores |
| MetaDrive fails to import | `third_party/metadrive` must be vendored; `make doctor` |
| `IndexError: Replacement index 0 out of range` from `engine_core.py:213` | MetaDrive 0.4.3's headless graphics-pipe detection is intermittently empty. Re-run. Seen on display-less hosts; a retry loop on `IndexError` around env construction works around it |
| A demo exits non-zero | `hermes run` exit codes: 0 PASS · 10 CONDITIONAL · 20 HOLD · 30 INVALID_EVIDENCE · 40 operational. Only 30/40 are failures |

---

## 4. Architecture by layer

### 4.1 Simulation

MetaDrive 0.4.3, vendored and pinned. The adapter refuses to start unless the package version, its
distribution metadata, its import path, the checkout's git HEAD, the recorded `SIMULATOR_COMMIT`
and a hardcoded constant all agree — *and* the tree is clean. Provenance fails closed rather than
being recorded after the fact (`adapters/metadrive.py:77-160`).

Physics runs at a 0.02 s step Hermes imposes rather than inherits; a control frequency is rejected
unless it divides 50 Hz exactly (1, 2, 5, 10, 25, 50), enforced at the adapter, at scenario load
(schema 4.0), and in offline verification that never imports the simulator.

Two challenge kinds: `lead_vehicle_hard_brake` (real MetaDrive vehicle dynamics on a scripted
brake schedule) and `cut_in_near_field` (scripted kinematic replay, actor set static and
repositioned each step, lateral smoothstep). Both carry `behavior_realism_claim: false` as a
literal. Front-object distance and closing speed come from ground-truth bounding boxes, not
perception; absent a challenge they are `NOT_AVAILABLE` with a reason, never zero.

**Honestly scoped:** one straight map block (`map='S'`), zero traffic, no sensor model, 10 Hz,
one seed, five ADAS scenarios. This is a harness with a physics engine attached, not a simulation
stack.

### 4.2 Safety layer and release gate

Three distinct action fields, never collapsed: `candidate_action` (policy proposed),
`permitted_action` (shield allowed), `executed_action` (actually ran). The deterministic shield
(Phase 3) has six ordered reasons — `TTC_BELOW_THRESHOLD, SPEED_CAP, STALE_OBSERVATION,
BOUNDARY_RISK, EMERGENCY_STOP, ACTUATION_DELAY_COMPENSATION` — and its decisions are replayed
exactly in verification.

The release gate (`gates/release.py:319-378`) is an **ordered, non-compensatory** chain of eleven
branches with no score, weight or average anywhere in it:

```
01 trace invalid or inconsistent ─── INVALID_EVIDENCE
02 safety evidence missing ───────── INVALID_EVIDENCE
03 collision ─────────────────────── HOLD
04 road boundary ─────────────────── HOLD
05 fault coverage incomplete ─────── HOLD
06 mission progress ──────────────── HOLD
07 any other hard invariant ──────── HOLD
08 any soft criterion ────────────── CONDITIONAL
09 otherwise ─────────────────────── PASS
```

Hard invariants are `Literal`-typed in the gate config (`max_collision_count: Literal[0]`), so
configuration cannot relax them. Missing evidence is a first-class `NOT_AVAILABLE` tri-state.
Branch 07 exists because of a real fail-open found in Phase 8 (§9). Its correctness depends on
`EXPLICITLY_ORDERED_HARD_FINDING_IDS` being kept current by hand — "enforced by construction plus
one hand-maintained convention", not by the type system.

Verifier profiles — `LEGACY`, `FAULT_COVERAGE`, and two ADAS profiles — are matched for **exact
equality** of their finding set; a missing expected finding is as fatal as an unknown one.

### 4.3 Evidence

Every run writes a ten-file bundle: `manifest.json, execution-context.json, scenario.resolved.yaml,
gate-config.resolved.yaml, events.jsonl, metrics.json, findings.json, verdict.json, trace.sha256,
bundle.sha256`. `events.jsonl` is SHA-256 hash-chained from a genesis hash; digests bind scenario,
gate config, policy config, adapter config and fault config. Evidence schema 1.0 and 2.0 (2.0
adds `permitted_action`, fault evidence, `result_observation`); scenario schema 1.0–4.0; gate
config 1.0–2.0; review envelope 1.0.

Re-verification recomputes the shield, fault transforms, metrics, every verifier and the gate
from stored bytes. **It does not re-run the simulator or the policy.** Hashing detects partial
edits and nothing more; anyone who can rewrite a whole bundle can recompute every digest —
`AuthenticityStatus` is permanently `NOT_AUTHENTICATED`.

### 4.4 Faults, comparison, review

Seven deterministic fault transforms (observation delay/drop/freeze/noise, control delay,
steering/brake saturation) with a coverage verifier that forces HOLD when a configured fault never
fired. Baseline-vs-candidate comparison partitions dimensions into improved / regressed /
unchanged / not-comparable — no winner — and fails closed on identity mismatches unless one
**declared variation axis** explains them (Phase 8, core comparator only; the review-envelope
path still uses the strict rule). A read-only Streamlit Evidence Review Workbench (Phase 6)
renders envelopes; its read-only property is enforced by AST tests.

---

## 5. History: Phases 0–9

| Phase | Delivered | Where it lives |
|---|---|---|
| 0 | Package skeleton, `hermes doctor`, Makefile, `SIMULATOR_COMMIT` | `main` @ `c181509` (2026-08-11) |
| 1 | Deterministic evidence core: models, scenario 1.0, gate 1.0, evidence 1.0, hash chain, ten-file bundle, gate, `run`, `verify-artifact` | `feat/unattended-evidence-core` |
| 2 | MetaDrive adapter 1.0, IDM policy, `sim-smoke`; verification never imports the simulator | ″ |
| 3 | Deterministic shield 1.0, scenario 2.0 (challenges), challenge adapter 1.1, `compare` | ″ |
| 4 | Fault injection 1.0, scenario 3.0, evidence 2.0, fault-coverage verifier, CI, error envelope | ″ |
| 5 | Contract closure: closed `VerifierProfile`, `simulator_support.py`; 273 tests | ″ @ `9e257a0` |
| 6 | Review envelopes 1.0, `review-artifact`, `review-compare`, Streamlit workbench; reviewer-comprehension iteration; 756 tests | `feat/phase6-evidence-workbench` → `feat/phase6-reviewer-comprehension` @ `4eb8765` |
| 7 | Evaluation-adequacy assessor, evaluation plans, provenance; 1,245 tests claimed | **codex worktree only** — `codex/phase7-…` @ `9d5c0ba`, 56 commits, **not merged** |
| 8 | ADAS (FCW/AEB) + oracle + seeded defects + agent layer + regression flywheel; 965 tests; then calibration (merged `6b2f375`), Phase 3 (merged `a78287e`), and **evidence schema 3.0 / `RunMetricsV3`** (complete, unmerged) | trunk `feat/phase8-adas-lab` @ `e6e2c8c`; metrics V3 on `feat/phase8-metrics-v3` @ `2dda024` (15 commits from `a78287e`, pushed, unmerged) |
| 9 | Fleet simulation — **FLEET-005 spike built**: contracts, world tape, minimal DES, paired loop, decision record; 33 tests incl. a hand-computed analytical fixture, clean-clone green | `feat/phase9-fleetlab` @ `00b2a48`; PRD stays local |

Design decisions from early phases that still constrain everything: MetaDrive stays external and
unmodified; every event hashes scenario/gate/component digests; hard invariants cannot be
compensated; stored verification is the sole authority and the review layer is a one-way consumer
of it; compatibility fails closed. Phase 5 is labelled differently across older documents
(`CURRENT_STATE_HANDOFF.md` folds it into Phase 4's commit; the codex branch calls it "evidence
contract closure") — the table above follows the commits.

### 5.8 Phase 7 — read-only, unmerged, unaccepted

Lives only at `~/.codex/worktrees/Hermes/phase7-evaluation-adequacy-human-validation` on
`codex/phase7-evaluation-adequacy-human-validation` (pushed, clean tree). Adds
`adequacy/`, `evaluation_plans/`, `provenance/git.py`, `adapters/metadrive_config.py`, the
`assess-adequacy` command, `EvaluationAdequacyEnvelope` 1.0, five protocol versions. Results:
protocols v1–v3 found nothing over 65 attempts (a ~3.11 s TTC floor attributed to IDM
`MAX_LONG_DIST = 30`); v5 `ADEQUATE` at a 4.0 s threshold. **Status: 7A built, not owner-accepted;
7B human validation `BLOCKED`.** Merge-base with Phase 8 is `4eb8765`; Phase 8 contains zero
Phase 7 files. Do not check out, merge, rebase, modify, or consume its adequacy machinery.

### 5.9 Phase 8 — what was delivered, by sprint

- **Sprint 0 — baseline audit** (`PHASE8_BASELINE_AUDIT.md`, 1,108 lines): twelve PRD §38
  answers, every §0-A reference verified, ten-risk register, duplication map, immutable contract
  set.
- **Sprint 0.5 — contract hardening:** the gate fail-open fix (`235efec`); import-provenance guard.
- **Sprint 1a — foundations:** scenario schema 4.0 (`3d90c91`) — first to permit challenge +
  faults together, adds `tags/odd/adas/requirements`, moving ego spawn (`ad922fc`); trace-layer
  version gates (`f7e9025`); fixture registry and `hermes fixtures list|regenerate|verify`
  (`10343bf`).
- **Sprint 1 — FCW/AEB:** `src/hermes/adas/` (`dd30b9b`); `verifiers/adas.py` oracle, gate-config
  2.0, two ADAS profiles, one profile selector (`a6abe7f`); CLI policy registry.
- **Evaluation acceptance:** seeded-defect suite and physics-derived onset criterion (`55c1fdd`).
- **Agentic layer:** tool catalogue, permission tiers, budgets, approvals, triage (`ecde47a`);
  checkable citations (`df802de`).
- **Comparison:** declared variation axis (`801d38d`).
- **Flywheel:** `src/hermes/regression/` end to end (`cdb4637`).
- **Scenarios:** `aeb_lead_hard_brake`, `adas_nominal_no_lead`, `adas_nominal_slow_closing`
  (`ed92f5b`); `adas_cut_in_near`, `adas_cut_in_far` + generalisation test (`176bfdb`).
- **Corrections:** binary32 projection assert (`922d5d1`), float32-derived tolerance (`65363ae`),
  review-surface ADAS rendering and `make` interpreter guard (`f38d885`), README/status
  corrections found by outside audit (`0c16c8f`).

Deep references: [PHASE8_DESIGN_SPEC.md](PHASE8_DESIGN_SPEC.md) (why),
[PHASE8_IMPLEMENTATION_NOTE.md](PHASE8_IMPLEMENTATION_NOTE.md) (what was forced by the code),
[PHASE8_BASELINE_AUDIT.md](PHASE8_BASELINE_AUDIT.md) (the risk register §11 cites).

---

## 6. ADAS in depth (Phase 8)

### 6.1 The functions

Forward collision warning and automatic emergency braking, as an ordinary `DrivingPolicy`
(`adas/functions.py`, `adas/policy.py`). AEB stages on **required deceleration**,
`a_req = closing² / (2 · usable_gap)`, not time-to-collision: a braking lead makes TTC optimistic
exactly when it matters, so a TTC-staged AEB intervenes late in the flagship scenario. A test pins
two situations with identical 2.0 s TTC that stage differently. Staging thresholds are fractions
of `ControlConfig.max_braking_mps2` (default **6.0**, which is an *unmeasured* number — §6.8).
`DriverConfig.max_brake` defaults to zero so every brake command in a default run is
AEB-attributable by construction. AEB release requires positive evidence — a distance margin *and*
a TTC margin.

### 6.2 The oracle

`verifiers/adas.py` recomputes threat labels from the stored trace against thresholds in
`config/gates.adas.yaml` (`threat_authority_fraction: 0.3`, `onset_authority_fraction: 1.0`,
`oracle_standoff_m: 2.0`) — a *separate* file from the controller's own fractions (0.4 partial
brake), so a controller cannot pass by being configured to agree with itself. It never inspects
`challenge.kind`; it works from gap and closing speed alone, which Demo 5 tests.

Known limit: threat labels come from the *realised* trace, which the controller shaped. An early
intervention can prevent the threat from appearing, which would convert a correct intervention
into a "false" one; the mitigation is that the scenario's *declared* expectation decides whether
false-intervention exposure applies. Labelling from omniscient simulator state is the stronger
answer and is not implemented (design spec Q7).

### 6.3 The seeded-defect suite — the evaluation's own acceptance test

`config/phase8-seeded-defects.yaml`: each entry names a controller, the scenario that exposes it,
the finding that must catch it, and the triage category that must be proposed. The test
parametrises from the YAML at collection time so spec and test cannot drift.

| | `baseline` | `defect_late_braking` | `defect_no_aeb` | `defect_over_braking` |
|---|---|---|---|---|
| `aeb_lead_hard_brake` (threat) | pass (onset at 50%) | `brake_onset_margin` (108%) | `threat_response` | — |
| `adas_nominal_slow_closing` | pass | — | — | `no_false_intervention` |
| `adas_cut_in_near` (threat) | pass (46%) | `brake_onset_margin` | **`threat_response` → HOLD** | pass |
| `adas_cut_in_far` (nominal) | pass (<1%) | pass | pass | **`no_false_intervention` → HOLD** |

Three controllers, five cases — not five controllers. The cut-in rows show each scenario *passes*
the defect the other catches, which is what makes a pair worth its simulation time.

### 6.4 Scenarios against the P0 catalog

The Phase 8 PRD P0 catalog is **22 named entries plus four nominal entries** (§0-A amendment 6)
— not 12, as an earlier handoff claimed. Committed: five, of which three match named entries
(`lead_hard_brake` #3, `cut_in_near` #5, `cut_in_far` #6); the two nominal scenarios satisfy the
≥30% threat-free exposure *requirement* without matching named entries. Both cut-in scenarios end
at `DESTINATION_REACHED` after 6–8 s, so `horizon_steps` overstates real exposure.

### 6.5 The agent layer

**There is no language model in this repository.** `AgentRuntime` is a one-method Protocol — the
seam a model would sit behind — and `ScriptedAgent` is a deterministic stand-in. What exists is
the substrate: eight tools (6 READ / 1 EXECUTE / 1 MUTATE) with `dry_run=True` the default on both
non-READ tools; one `ToolResult` envelope with a closed error vocabulary and a constructor
invariant that forbids a failure presenting as an empty success; a budget ledger; citations that
`check-citations` re-resolves; the agent's proposal recorded **beside** the deterministic
classification. `promote_regression` refuses without an approval bound to the SHA-256 of the
draft's exact bytes, so an edit after approval invalidates the approval.

**Honestly scoped:** the refusal lives in the function rather than a prompt — the interesting
part — but it is a boundary, not a sandbox. The registry path is a caller-supplied argument;
filesystem write access bypasses the tool. No model has ever exercised the path. Triage is a
straight-line sequence of four tool calls. Triage accuracy 5/5 is near-tautological (the scripted
agent shares the classifier's mapping — design spec Q4).

### 6.6 The regression flywheel

`failed run → triage → draft → validate → approve → promote → rerun`. `regression/builder.py`
derives a scenario from the trace geometry at the failing event, assesses coverage against the
committed suite (±5 m gap, ±2 m/s speed, same kind and expectation), and `floor.py` enforces that
a draft may add coverage but never subtract it — closing the channel where a proposal that reads
as added coverage quietly drops an expectation. `approve` is a separate verb from `promote`
(deliberate deviation from PRD §0-A.9.7 so the promoter cannot self-approve). The derived case
discriminates: HOLD for `defect_late_braking` (a_req 6.83 m/s², 114%), CONDITIONAL for baseline
(2.71, 45%).

### 6.7 Two things not to misread

**The late-braking HOLD is not driven by the ADAS finding.** On `defect_late_braking`:
`progress.required` (hard) FAILS and drives HOLD; `adas.aeb.brake_onset_margin` (soft) FAILS and
*detects* the defect but alone would yield CONDITIONAL; `threat_response` PASSES — it did brake
and avoid contact. Whether late-but-successful braking should be hard is open (§13).

**`adas.fcw.warning_timing` does not verify a warning.** The trace has no field for the warning
signal; it confirms only that the run presented the declared closing geometry.

### 6.8 Calibration — measured (2026-08-24), with one honest nuance

The debt in the old version of this section is paid. `evidence/calibration/
metadrive-brake-curve-0.4.3.json` (on `feat/phase8-adas-lab`) measures full-brake deceleration
at 14 entry speeds, 4–30 m/s, N=3 bitwise-identical per speed with the three trace SHAs
recorded per entry. At 20 m/s: peak **12.9824 m/s²**, steady **11.5319**, stopping **17.709 m**.
Construction: each committed ADAS scenario now *declares* the measured authority
(`max_braking_mps2: 12.982444763183452`, digest-bound, curve-cited); every oracle/controller/
defect fraction was re-derived in lockstep so all absolute boundaries are bit-identical to
before; the Python default stays 6.0 and a test fails if it moves. Cross-backend: a MuJoCo
3.12 reference instrument disagrees materially (MetaDrive peak 2.26× MuJoCo) — kept as
falsification evidence, not parity. A Warp CPU kernel cross-checks sensitivity
(∂d/∂a = −d/a reproduces the measured steady authority exactly).

**The nuance an adversarial review pinned (keep saying it):** the *authority* is measured; the
*margins* (1.8, 6.0, 2.4/4.2 m/s²) are inherited pre-calibration choices, now explicitly
relabelled as a simulator-relative evaluation boundary rather than a physical stopping limit —
the verifier docstring no longer claims "physically meaningful rather than tuned". Comfort
enforcement was deliberately not added (a full-brake curve is not a command-to-deceleration
map); the decision is recorded in the artifact (`control_config_decision`).


---

## 7. MuJoCo sandbox and Phase 9 fleet simulation

### 7.1 Phase 9 — what the PRD is and is not

`HERMES_PHASE9_FLEET_SIMULATION_PRD.md` (2,769 lines, "Hermes FleetLab", status "Design
proposal / implementation handoff", local, gitignored). Question: *how can internal teams safely
and quickly evaluate offboard fleet and operational changes before launch?* Thesis (L78): **the
right simulation is the lowest-cost model with enough fidelity to answer the decision.**

Four lanes (§7): Lane 0 analytical/unit fixtures (no priority tag); **Lane 1 FleetLab
discrete-event simulation — the primary Phase 9 lane**; Lane 2 MetaDrive, consumed as summary
distributions via a **P1** parameter bridge (live per-trip coupling forbidden in P0); Lane 3
MuJoCo for contact/actuator/articulated physics, bridge **P2**, "should not be used as a generic
ride-hailing fleet engine" (L511). A non-AI fidelity router maps question type to lane (§7.5).

Relationship to Phase 8: **sits beside it as an additive domain.** The PRD proposes a new
`src/hermes/fleet/` tree (§37) with its own `FleetSimulationBackend` Protocol (§38), a separate
"FleetLab schema version", its own outcome semantics (§20: "do not reuse the AV safety verdict
blindly", `deployment_permission: NONE`), and says explicitly: do not force FleetLab through or
mutate `SimulatorAdapter` (L2200, L2235); reuse evidence/publication/review *principles*, not the
vehicle-action schema; land Phase 8 first (§47). **It proposes zero new `ScenarioDefinition`
fields, zero new `adapter` Literal values, and no `evidence_schema_version` change.** It consumes
MetaDrive-derived parameters, not Phase 8 ADAS evidence. Principle 18 (L228), "physical authority
is measured, not assumed", is one line; §6.8 here is its only operationalisation. There is no risk
register. Six P0 fleet scenarios (FLEET-001…006), 20 P0 / 10 P1 / 8 P2 acceptance criteria,
48-hour MVP (§45), one-week build (§46). **Built 2026-08-23 (the narrowed spike from the external design review):** `src/hermes/fleet/`
on `feat/phase9-fleetlab` — preregistered `ExperimentSpec` (single variation axis, primary
metric with an equivalence margin, guardrails, frozen seed set) and a `DecisionRecord` bound to
spec/world-tape/seed-set digests; a materialized, hashed world tape (demand fixed across
replications; per-request travel disturbances vary by seed, keyed to the request, never the
chosen vehicle); the thinnest DES expressing FLEET-005 (nearest dispatch, depot bays); the PRD §17
invariants that have referents in this model (8 of 12 — the three charging-related ones await
the charging model; replay determinism is the `run_experiment` precheck), where any violation
yields `INVALID_EXPERIMENT` with no partial outcome; a seeded
double-assign dispatcher caught by the invariant that names it; bootstrap CI over paired
replications; a non-compensatory recommendation (guardrail regression HOLDs an IMPROVED
primary); an analytical fixture whose three-request world is computed entirely by hand and
asserted exactly, plus a metamorphic service-delay case; `hermes fleet demo` (~0.5 s).
Measured demo result: baseline healthy, +25% turnaround
→ REGRESSED, CI [+736, +919] s on wait p90, guardrail hit → HOLD. 30 tests, all simulator- and
fixture-free; suite 761→794 in the worktree with zero new failures; **33/33 from a clean clone
on core deps only, decision-record digest bit-identical across checkouts.** Everything else in
the PRD (charging, FLEET-001..004/006, policy SDK, forecast seam, Studio, registry) remains
unbuilt.

### 7.2 MuJoCo sandbox — what exists

`sandbox/mujoco/` — gitignored (`.gitignore:50`), never committed on any branch, every record
labelled NOT EVIDENCE. Pinned `mujoco==3.12.0`, `matplotlib==3.11.1`, numpy 2.4.6; macOS arm64,
Python 3.11.15; the sandbox venv has no pydantic and cannot import `hermes`. All outputs under
`sandbox/mujoco/out/`. Determinism claims are same-host/same-version only.

| Experiment | Established |
|---|---|
| A `smoke_test.py` | 1,000 headless steps, ~22.9 µs/step (~87× realtime; varies), 0 warnings across all 7 `mjtWarning` counters |
| B1 `exp1_contacts.py` | dt × solref grid; **`refsafe` silently clamps solref timeconst to `max(t, 2·dt)`**, so "tight" contact at dt 0.010 behaved exactly like default — contact stiffness that changes with timestep is this clamp |
| B2 `exp2_cart.py` | `ctrlrange` clamps the command silently (`data.ctrl` still reads back the over-range value); `forcerange` is in actuator space before `gear`; damping matches closed form to 3 decimals |
| B3 `exp3_scenario.py` | Full replay bit-identical; restart from **`mjSTATE_INTEGRATION`** (111 floats, incl. `qacc_warmstart`) bit-identical; restart from qpos+qvel (41 floats) drifts ~8e-14 — invisible in trajectory, **breaks a content-addressed digest**; seed change diverges from step 0 |
| `pilot_adapter.py` + `pilot_conformance.py` | 1-D longitudinal AEB lead-hard-brake (1400 kg ego, lead on kv=30000 velocity servo, dt 0.01 Euler, autoreset off); all 9 `SimulatorAdapter` members present by kind, exact field-name parity on Action(3)/VehicleState(8)/Observation(10)/VerifierFacts(6)/StepResult(5), checked by **AST over the real `contracts.py`/`models.py`**; two seed-7 episodes yield identical digests |
| `metadrive_brake_probe.py` | The brake measurement in §6.8 |

**Honestly scoped:** `isinstance` conformance was checked against the pilot's *own mirrored*
`runtime_checkable` Protocol (whose `reset` takes a `PilotScenario`), not the real class; the real
files were checked by AST name/kind only, and the recorded SHA-256s of `contracts.py`/`models.py`
are recorded, not asserted. The pilot ignores steering, models no lateral/offroad/ODD, and
`simulator_commit` is `None` (pip wheel). No test, CI step, Makefile target, gate, scenario YAML,
artifacts bundle or pydantic model exists for it; `ruff check sandbox/mujoco` explicitly reports
19 errors (the root `ruff check .` passes because ruff honours `.gitignore`).

**Sim-consult review verdict: Sound** (no sev-1/2). Recorded, not applied: sev-3 `armature=0` on
every geared actuator, the kv=30000 lead must be labelled scripted-kinematic, `Euler` →
`implicitfast`; sev-4 **`fwdinv` never enabled** ("bit-identical ≠ correct" — the single
highest-leverage change), warmstart fine for replay but disable for parallel sampling; sev-5
pyramidal cone, D3 conflates scenario change with chaos.

### 7.3 MuJoCo — the open questions before anything graduates

From `SIMULATION_DESIGN_PACKAGE.md` §6 (all open, owner unassigned): **Q1** the niche — the first
question MuJoCo answers that MetaDrive cannot; **Q2** a `MujocoScenario` contract reviewable like
schema 4.0; **Q3** graduation gates into `src/` (candidates: named scenario family, owner, test
budget, pinned dependency); **Q4** physics defaults frozen at graduation (`implicitfast`,
armature, `fwdinv` + residual, autoreset off); **Q5** one "measured, not assumed" rule for both
the MetaDrive brake debt and MuJoCo contact softness; **Q6** cross-backend claims compare
distributions, not trajectories; **Q7** how the agent layer proposes MuJoCo scenarios under the
same deterministic check. The PRD (§44, §47 step 7) requires "a named buyer/question" before the
MuJoCo bridge leaves P2.

**Correction to an earlier alignment document:** widening `adapter: Literal["fake","metadrive"]`
is a *MuJoCo-graduation* item (sandbox NOTES §3 lists it first), not a Phase 9 fleet-bridge item
— the fleet bridge is parameters, not an adapter. Widening the Literal is digest-neutral (§12
landmine 1 explains why); what ships alongside it is not.

### 7.4 The one genuine overlap between Phase 8 and Phase 9

The brake-authority measurement (§6.8), transferring **one direction, as data, not as a code
change**. Phase 8's largest weakness is an unmeasured authority; Phase 9 needs a real
decel-vs-speed curve for its MetaDrive→FleetLab bridge; the sandbox holds the only instrument.
What should transfer: a probe on the scenario-faithful config producing points at 20 m/s. What
must not: the number as a default edit (§10 rule 3).

---

## 8. What is not claimed

- **Not a safety case.** No ISO 26262, ASIL, HARA, regulation, assessor or vehicle. The gate
  config schema *requires* the literal label `illustrative_prototype_thresholds_not_for_real_vehicle_use`.
- **Not authenticated.** Tamper-evident against partial edits; nothing more.
- **Not a simulation of the world.** One straight map, no traffic, no sensor model, one seed.
- **Not an agent framework.** No model, no orchestration loop, no skill abstraction, no model has
  ever called the EXECUTE or MUTATE tools.
- **Not machine learning.** No model, training, dataset or RL — by design.
- **Not calibrated.** Every "% of braking authority" is a ratio to a declared constant the
  simulator does not enforce.
- **Not reproducible off this host yet** (§2).
- **Not measured on its own success metrics.** The Phase 8 PRD defines 22; roughly one is
  measured, and that one is near-tautological.
- **Not Phase 9 P0.** One vertical slice (FLEET-005) exists; the other 19 P0 criteria do not.
  The PRD's own §52 says not to use its resume claim before P0 is built — a spike is not P0.
- **Not MuJoCo-integrated.** `adapter` is still `Literal["fake","metadrive"]`.

---

## 9. Defects found and fixed

| Defect | Commit | Why it mattered |
|---|---|---|
| Release gate failed open | `235efec` | A hard finding registered in a profile without its own precedence branch fell through to **PASS while failing**. The first failing ADAS hard invariant would have shipped as a pass. |
| Scenario identity used a forked serializer | `e78d42f` | Missing the canonical `-0.0 → 0.0` normalisation; two YAMLs for the same scenario got different digests, making runs incomparable. |
| Suite could not run on a fresh clone | `10343bf` | 127 failed / 593 passed / 40 errors from gitignored fixtures. Partially fixed — §2. |
| Adding a model field silently invalidated stored evidence — twice | `a6abe7f` | `scenario_digest` / `gate_config_digest` hash `model_dump()`; see landmine 1. |
| Derived spawn speed not float32-exact | `cdb4637` | 18.515 → 18.514999… through MetaDrive's float32 storage; fixed by projecting to binary32 and comparing against the same projection — exact, not loosened. |
| Geometry tolerance used the wrong error model | `65363ae` | The observed gap is a difference of two float32 *positions*; a fixed 1e-6 m held at 40 m by luck and failed at 28.816 m. Now derived from float32 spacing — tighter than the interim relative tolerance at every magnitude. |
| README front-page table and status overclaims | `0c16c8f` | HOLD attribution conflated detection with verdict causation; "fresh clone reproduces" was false. Found by auditing as an outside reader. |

---

## 10. Coordination rules for parallel sessions

Phase 8 is the fragile side: 63 bundles under gitignored `artifacts/`, only 13 regenerable.
Almost every rule exists because the failure mode is **silent**.

**Protecting Phase 8**

1. **[SILENT] Do not add, remove or rename any field on `ScenarioDefinition` or anything
   reachable from it** (`domain/models.py:347-370`). Adding it to `_SCHEMA_4_ONLY_FIELDS` does
   **not** protect schema-4.0 bundles — that list strips only for `schema_version != "4.0"`. New
   domains get a new model under a new namespace, keyed by name. (Widening the `adapter` Literal
   alone is digest-neutral — `model_dump()` emits the value, never the type — verified on all 13
   scenarios.)
2. **[SILENT] Do not run `hermes fixtures regenerate --force`, re-run `make demo-*` to green a
   test, or delete `artifacts/`.** Regeneration restores 13 registered fixtures and permanently
   destroys the other 50. Revert the change instead.
3. **[SILENT] Do not change `ControlConfig.max_braking_mps2` (6.0) to a measured value.** See
   §6.8 — it weakens the oracle. Declare measured authority per-scenario in new YAML.
4. **[SILENT] Leave the `dynamics_limitation` strings in `gates/release.py:225-229` byte-identical
   and pass `adapter_name=` explicitly.** MetaDrive is the *unnamed* `else` arm; a dict-lookup
   refactor silently reassigns it, and the `fake` default stamps a false provenance disclaimer
   into `verdict.json`.
5. **[SILENT] Do not `.get()`-refactor the adapter chains in `evidence/verification.py`
   (750/772/943, 1296-1321), and do not import a simulator from `evidence/`, `gates/` or
   `verifiers/`.** The `else` at `:943` is the only thing that fails an unknown adapter closed
   (and has no test). The boundary test blocks only the literal names `hermes.adapters` and
   `metadrive`; add any new engine name to it in the same commit.

**Protecting Phase 9 / MuJoCo from wasted effort**

6. **Work in a separate git worktree.** `orchestrator.py:170` stamps `repository_dirty` from
   `git status --porcelain`; an uncommitted file in this checkout taints every bundle, and a
   differing `repository_commit` makes any comparison `NOT_COMPARABLE`.
7. **Always `PYTHONPATH=<repo>/src`.** §3.0.
8. **Baseline `artifacts/` before and after any change under
   `src/hermes/{domain,evidence,gates,scenarios,runtime,adapters}`:**
   `for d in artifacts/*/; do printf '%s ' "$d"; hermes verify-artifact "$d" | grep -E 'Artifact integrity|Verdict'; done`
   — expect 60 of 63 `INTERNALLY_CONSISTENT` (3 exceptions pre-exist). A green `pytest` cannot
   detect an identity shift.
9. **The adapter seam has one owner.** `fake`/`metadrive` binaries are scattered across
   `verification.py` (750/772/943/958/1298/1308 — the last two have **no `else`**),
   `gates/release.py:225`, `cli.py` (334/371/392/414), `fixtures/registry.py` (63/95/259),
   `agents/tools.py` (312/363/392), `orchestrator.py` (517/531/552/561), `trace.py:831`,
   `domain/models.py` (355/407/414/422/473). Widening `cli.py:334` without `:392` turns a clean
   `CONFIGURATION_ERROR` into a silent MetaDrive run labelled as something else. One owner, one
   commit, this list as the checklist.
10. **Sandbox code is never imported by `src/`** until a deliberate, reviewed graduation (§7.3).

---

## 11. Next steps by track

Each item states how you know it is done and what it will break.

### 11.1 Phase 8 — remaining, in order

> **Phase 3 merged 2026-08-25** (`a78287e`): the `stationary_lead` kind with a measured
> threat/nominal pair, ADAS observation-fault wiring (a delayed observation now degrades the
> baseline into a *named* failure — fault injection proving the evaluation notices), residual-impact
> enforcement, and two owner-facing design notes (WP-2 composite scenarios, WP-4 `RunMetricsV3`).
> Suite 1118; seeded suite 8 named defects / 10 tests.
>
> **Three corrections were made in review, before merge**, each recorded in
> `PHASE8_IMPLEMENTATION_NOTE.md`:
> 1. **`AdasThreatResponseVerifier` 1.0 → 1.1.** Its observable behaviour changed (residual-impact
>    enforcement plus rewritten criterion text) while the version stayed frozen, so one
>    `(name, version)` pair denoted two behaviours. Bumped at all six pins. It was free at that
>    moment because every ADAS bundle was already invalid.
> 2. **A superseded determinism digest** in the implementation note, re-measured to
>    `54b439ca60e67794…` and annotated with *why* it moves, so the next reader re-measures.
> 3. **Fleet disposition recorded: 14 of 14 ADAS bundles are `INVALID`** under two fail-closed
>    corrections (residual-impact enforcement, then verifier-suite identity binding). A fresh run
>    verifies clean, so the pipeline is healthy; what is invalid is historical evidence produced
>    under superseded verifier identities. **Coordination rule 8's "60 of 63" baseline is stale —
>    re-measure before using it.** Regenerating or retiring the 14 is an owner decision.



> **Phase 2 (calibration) executed and merged 2026-08-24** — reviewed with zero critical/important
> findings. The plan file now carries **Phase 3** (review follow-ups, `stationary_lead` and
> `cut_out_reveal` challenge kinds as threat/nominal pairs, ADAS fault wiring):
> `…/Hermes-adas/Hermes_Phase8_ADAS_Execution_Plan.md`
> (local, untracked). Centerpiece: item 1 below (WP-A), with MuJoCo graduated as a *calibration
> instrument* (`[mujoco-cal]`, `fwdinv` + graduation defaults — the sandbox's Q1 niche answered),
> a Warp CPU kernel, an esmini/OpenSCENARIO audition, and a web-verified tool decision table
> (ADOPT/DEMO/LITERATE/AVOID; 45 claims checked, incl. Isaac/Newton/MJWarp/cuOpt/Waymax reality
> on this host). The plan's environment is pre-verified in that worktree.


1. ~~Brake-dynamics calibration~~ **DONE, merged @ `6b2f375`** — see §6.8. Review follow-ups
   (all MINOR) moved into the Phase-3 plan: derive `repeat_bitwise_identical` from data instead
   of hardcoding; record producer argv in evidence; an evidence self-consistency test over the
   curve JSON; docstring on `ControlConfig.max_braking_mps2` noting the default is unenforced;
   decide wire-vs-document for the dead `max_residual_impact_speed_mps` criterion (a gate-config
   field change re-baselines ADAS digests — plan accordingly).
   *(original item, for context)* **Brake-dynamics calibration (PRD Risk 8) — highest engineering value.** Re-run the probe on
   `map='S'`, `traffic_density=0`, 240 m destination, across 0–30 m/s; fix its arithmetic (§6.8);
   commit the curve as an evidence artefact, not a constant; re-derive the AEB authority
   *fractions* alongside the authority so the oracle keeps discriminating — or honestly relabel
   the onset criterion as simulator-relative. Decide whether `ControlConfig` limits should be
   enforced on the simulator. *Done when* every threshold in `config/gates.adas.yaml` cites the
   measurement and `make demo-adas` no longer fails comfort for an uncalibrated reason. *Breaks*
   every trace digest and every fixture — budget a full re-baseline. **Do before authoring more
   scenarios.**
2. ~~`RunMetricsV3` / evidence schema 3.0~~ **DONE 2026-08-25, accepted, unmerged** —
   `feat/phase8-metrics-v3` @ `2dda024` (15 commits from `a78287e`, pushed and in sync;
   **merged onto `main` 2026-08-26 as `b447fc4`**, conflict-free — §13).
   Evidence schema 3.0 produced for exactly the two ADAS profiles (legacy → V1, non-ADAS fault
   → V2 — routing is exact, not inherited); typed decision plus candidate → permitted → executed
   attribution; independent policy/shield/fault/trace/metrics/findings/gate replay;
   `RunMetricsV3` with 46 display rows, 61 review leaves, 19 computed + 27 typed-unavailable;
   review/comparison schema 2 across CLI, workbench, and agent/citation consumers; V3
   `TraceIntegrityVerifier`/`AdasBrakeOnsetVerifier` 1.1. Measured 2026-08-25 at `ab17958`
   (hermes-dev interpreter, `PYTHONPATH="$PWD/src"`): suite **1,410 passed** (`pytest -q`);
   seeded 10/10; ruff clean; fixtures 13/13; fleet 27/27 (12 consistent, 15 invalid). Real
   seed-7 N=3 acceptance evidence lives **out of tree** at
   `…/Hermes-adas-wp7-acceptance/ab179583…/attempt-1` (60 files, composite `cefd7bbc…`) —
   **preserve it; deleting that directory destroys the commit-bound acceptance evidence.**
   Final reviews: spec PASS, quality APPROVED, integrity audit zero findings; independently
   re-verified 2026-08-25 by a six-agent read-only pass (trace hash chains and the 60-file
   composite recomputed from scratch). Full handoff:
   `…/Hermes-adas/.superpowers/sdd/phase4-metrics-v3-implementation-plan/task-7-report.md`
   (ignored dir). *Done-when met:* ADAS `metrics.json` carries the ADAS metrics and
   `review-artifact` renders all 61 leaves.

   > **Maintenance pass landed 2026-08-26** — `2dda024` (`fix: fail closed on untyped verifier
   > profiles and refresh stale V3 prose`), implemented by Codex from the reviewed prompt and
   > independently verified the same day by a six-agent read-only pass. Superseded WP-7 backup
   > stash `c82036c` re-verified byte-identical and dropped (no stash refs remain).
   > `run_verifiers_for_profile` now fails closed — explicit `LEGACY` branch, `ValueError` on
   > anything untyped; both stale V3 prose texts refreshed; both `type: ignore[arg-type]`
   > removed by widening `run_phase4_verifiers` to the three-event union; stored-path profile
   > filters aligned to exact `type()` with the `TraceEventV3` inheritance invariant pinned.
   > Measured at `2dda024` (`pytest -q`): suite **1,418 passed** — 8 additive tests, none
   > removed; seeded 10/10; ruff clean; doctor 17/1/1; fixtures 13/13; fleet 27/27. **Fresh
   > six-run seed-7 requalification** at `…/Hermes-adas-wp7-acceptance/2dda0246…/attempt-1`
   > (60 files, composite `712c3375…`): all eight companion files byte-identical to the
   > `ab179583` attempt, trace digests `3d5866…`/`5eae8e…` reproduced exactly — the
   > zero-behavior-delta proof. **Preserve both acceptance roots byte-for-byte.** Report:
   > `…/Hermes-adas/.superpowers/sdd/phase4-maintenance-pass/maintenance-report.md` (ignored
   > dir). Owner-cut scope stays cut: actor roster, scenario windows, suite normalization,
   > conditional telemetry files, gate-hosted tolerances, post-AEB re-approach. Two Minors
   > logged for a future pass, no action needed: the widened union moves a latent
   > static-typing mismatch one call deeper into `_fault_coverage` (no checker configured, no
   > runtime effect), and the new stored-V2 test type-checks only `events[0]` (schema
   > homogeneity already validated upstream).
3. **P0 scenario catalog** (this note was re-measured 2026-08-26 — the old "four remaining /
   two kinds / touches oracle" text was stale). Done: `aeb_stationary_lead` (+ delay variant,
   Phase 3) and **`fcw_stationary_lead` merged 2026-08-27 (`deeca8c`)** — warning-margin
   envelope on the `stationary_lead` kind, measured margin 2.9 s, geometry coverage only
   (warning-OUTPUT verification is deliberately unimplemented); landed with the
   **derived-map adapter change** (`metadrive_map_for_gap` shared by producer and verifier;
   committed scenarios stay byte-identical on `"S"`; gap 140 → `"SSS"`) and **conditional
   adapter `1.2`** (closed-set version contract, eleven-case matrix; cross-era claim is
   re-verifiability only, never comparability — see the 2026-08-27 decision-log entry).
   Remaining: `slow_lead_closing` + nominals `fcw_aeb_nominal_following`,
   `decelerating_but_safe_lead`, moving `adjacent_lane_pass` — unlocked by the
   **`steady_lead` contract, owner-approved as written 2026-08-27**
   (memo: `…/Hermes-adas/.superpowers/sdd/phase8-p0-fcw-scenarios/steady-lead-owner-memo.md`,
   ignored dir; `decelerating_but_safe_lead` needs the separate `lead_decelerates`
   decision). **Implemented 2026-08-28** on `feat/phase8-steady-lead` (2 commits from
   `deeca8c`: the kind at `de19c19`, the pair `slow_lead_closing` +
   `fcw_aeb_nominal_following` at `de29de7`) and independently verified by a six-agent
   pass: suite **1,521** (+39 fully accounted), an INDEPENDENT rerun reproduced the
   report's trace/events digests bit-for-bit, and the per-step speed check was proven
   non-vacuous against a hash-consistent forgery (typed rejection). Measured: threat
   PARTIAL at seq 10 (2.44 m/s²), four intervention cycles, min gap 4.01 m, zero
   collisions, CONDITIONAL; nominal 61 events, zero braking, gap opens +1.18 m,
   CONDITIONAL. **Both owner calls resolved 2026-08-28**: the measured Decision-8 values
   ACCEPTED and the `actor_speed_mps > 0.0` narrowing RATIFIED; **merged onto `main` as
   `df0e34e`** (conflict-free; the one README overlap merged additively). Report:
   `…/Hermes-adas/.superpowers/sdd/phase8-steady-lead/report.md`.
   **`adjacent_lane_pass` implemented and verified 2026-08-28** on
   `feat/phase8-adjacent-pass` @ `5173daa` (one commit, YAML-only, the catalog's only
   MOVING exact-mirror pair — identical numbers to `slow_lead_closing`, one lane over):
   suite 1,527 (+6 accounted), independent rerun reproduced the report's trace/events
   digests digit-for-digit, front pair absent 61/61 events through the seq-36 overtake,
   stored-lateral sign inversion documented. **Accepted and merged onto `main`
   2026-08-28 as `bd60b5b`** (conflict-free; README merged additively). The
   **`lead_decelerates` contract memo was APPROVED as specified the same day**
   (`…/phase8-adjacent-pass/lead-decelerates-owner-memo.md`: scripted constant-rate
   member, `STEADY→DECELERATING→STEADY`, strictly positive terminal speed per the
   ratified `gt=0.0` rationale; author `decelerating_but_safe_lead` first, ACC flavor
   deferred). Remainder: `decelerating_but_safe_lead` (implementation package in
   preparation) and `cut_out_reveal_stopped` (owner-blocked, actor roster).
   `cut_out_reveal_stopped` stays owner-blocked (actor roster; a future roster needs a NEW
   evidence-schema version — 3.0 is taken by metrics-V3). Oracle is kind-agnostic by test;
   the newer template is `tests/integration/test_stationary_lead_generalisation.py`. Keep
   nominal exposure ≥30% as a designed property (5 threat / 5 nominal tags after the fcw
   pair reuse).
4. ~~Wire the faults to ADAS~~ **DONE** (Phase 3) — observation faults enabled for the exact ADAS
   policy identity, with a measured delay scenario whose baseline degrades into a named finding.
   `orchestrator.py:514-528` bars observation faults on MetaDrive — written for IDM, which ignores
   observations; the ADAS controller does not. Revisit, do not work around.
5. **ACC, two-stage gate, review-envelope variation axis** (`review/models.py:2615`, `:2105-2114`,
   `projection.py:1565-1578` are the traps). Then release-brief agent, sweeps, workbench panels,
   `agent-trace.jsonl` (blocked on the bundle's exact-inventory rule).
6. **Small:** `scenarios/cut_in.example.yaml` and `config/gates.example.yaml` fail validation
   (21 and 8 errors) — refresh or delete; `*.parquet` gitignored with pyarrow/pandas undeclared.

### 11.2 Phase 9 — after the FLEET-005 spike (2026-08-23)

Done: worktree + branch (rule 6) ✓; additive domain, no `SimulatorAdapter` involvement ✓; the
spike with its refusal paths ✓; clean-clone gate ✓. Next, in order:

1. **FLEET-006 with a minimal policy seam** — nearest vs an OR candidate behind a
   `DispatchPolicy` contract with decision-time-only views, latency counted, `[fleet-or]` extra.
2. **FLEET-003 (charger outage) needs the charging model**; author regime pairs and keep
   outcomes separate per regime (no post-hoc MIXED).
3. **Spec-file authoring + `hermes fleet run <spec.yaml>`** so the demo stops being the only
   entry point; then the decision-record Comparison page on the workbench.
4. More analytical fixtures: the hand-computed three-request world exists
   (`test_fleet_analytical_fixture.py`); add an M/M/c depot check against closed form.
5. Development-vs-evaluation seed separation and the leakage defects (ORACLE_LEAKAGE provider)
   when the forecast seam lands.
6. The MetaDrive→FleetLab parameter bridge stays P1 and still needs §11.1 item 1's curve.
7. Decide whether to track the PRD (still gitignored defensively).

### 11.3 MuJoCo — before graduation

1. Name the niche (Q1). Nothing else is justified until this exists.
2. Fix the probe's peak/mean arithmetic and run it at 20 m/s on the scenario-faithful config —
   this is the one artefact with a buyer today.
3. Apply the sim-consult graduation defaults (`implicitfast`, armature, `fwdinv` + logged
   residual) in the sandbox first.
4. Only then: the `adapter` Literal + schema-5.0 `MujocoScenario` block + a `_SCHEMA_5_ONLY_FIELDS`
   strip (landmine 1), a real `MujocoAdapter` returning real pydantic models, mujoco in the
   declared dependencies, the engine name added to the architecture-boundary test, and the
   verification mirror (`verification.py:772-942` is the template — ~170 lines per adapter).

### 11.4 Repository hygiene

- **Add a LICENSE** (owner's choice; MIT or Apache-2.0 usual). Without one the public repo is
  legally unusable by visitors.
- **Decide about `main`** — still Phase 0; not on GitHub; CI only triggers on it.
- **Declare the simulator dependency** or state the clean-clone numbers wherever "tests pass" is
  claimed.
- `git rm --cached Hermes_Fable5_Full_Project_Fresh_Eye_Design_Review_Master_Prompt.md` if its
  `.gitignore` entry reflects intent — it is tracked and public today.

---

## 12. Landmines

1. **Any new model field can invalidate stored evidence.** `scenario_digest` and
   `gate_config_digest` hash `model_dump()` and are re-derived in verification. Every version-only
   field must be stripped for older versions (`_SCHEMA_4_ONLY_FIELDS` in `scenarios/loader.py`,
   `_SCHEMA_2_ONLY_FIELDS` in `gates/config.py`); an unstripped field that dumps to `null` still
   changes every digest, and `verification.py:1147-1150` byte-compares the resolved YAML too.
   Never edit an existing adapter's `evidence_config` — version the adapter instead.
2. **Bundle capture is bidirectionally exact.** `verification.py:347` rejects any file not in
   `REQUIRED_ARTIFACT_FILES`; optional files are not implementable — new files must be schema-gated
   required files.
3. **A verifier profile's finding set is matched for exact equality**, including each finding's
   `(verifier, version, hard_invariant)` triple. Register in both `EXPECTED_FINDINGS_BY_PROFILE`
   and `EVIDENCE_REQUIREMENTS_BY_PROFILE`.
4. **MetaDrive stores actions as float32** and the adapter aborts on any difference between
   requested and accepted action. Quantise every new command path to binary32.
5. **Regenerating fixtures needs a clean worktree.**
6. **Profile selection lives in one place** (`select_verifier_profile`). Keep it single.
7. **Any value derived from a trace crosses a float32 boundary.** Use `_geometry_agrees` in
   `evidence/trace.py` rather than choosing a tolerance. *If you find yourself choosing a
   tolerance, the error model is probably wrong.*
8. **Do not let the promoter self-approve.** `approve` and `promote` are separate verbs on purpose.
9. **A regression case that merely runs is worthless** — it must discriminate.
10. **MetaDrive 0.4.3 can crash on init when fully headless** (`engine_core.py:213`,
    intermittent `IndexError`). Retry on `IndexError` around env construction.
11. **MuJoCo determinism needs `mjSTATE_INTEGRATION`**, not qpos/qvel; and `refsafe` silently
    clamps contact stiffness to the timestep.
12. **Hermes declared `horizon_steps` can overstate exposure** — check `termination_reason`.
13. **`AebConfig` default fractions encode the 20 m/s measured peak specifically.** A scenario
    declaring a different measured authority gets different absolute staging than the documented
    2.4/4.2 m/s²; one silently falling back to the 6.0 Python default stages at 1.11/1.94 m/s².
    Declare authority explicitly in every new ADAS scenario.
14. **`max_braking_mps2` does dual duty**: oracle denominator *and* the generic baseline
    policy's decel-to-pedal divisor (`policies/baseline.py:52`). Committed ADAS runs are
    unaffected (fixed brake constants), but a generic-policy run on an ADAS scenario now
    commands ~46% of the former pedal fraction.
15. ~~`max_residual_impact_speed_mps` is dead~~ **WIRED** (Phase 3) into
    `adas.aeb.threat_response`; still vacuous at verdict level because contact already HOLDs via
    `collision.zero`, which is stated honestly rather than sold as new coverage.
16. **A verifier whose behaviour changes must move its version.** Phase 3 shipped a semantics
    change under a frozen `1.0`, caught in review. Six pins must move together: the identity
    tuple, the four emission sites, and the profile registry. Changing any verifier identity
    re-digests the suite and invalidates every stored ADAS bundle — which is correct, and is why
    the cheapest moment to bump is when the fleet is already invalid.
17. **A single-actor evidence contract cannot express a composite scenario.** The observation
    summary is an exact 18-field set with one unlabelled challenge actor; switching its subject
    mid-run would be an unprovable identity change. See the WP-2 design note before attempting
    `cut_out_reveal`, and note that `adas_nominal_slow_closing` overstates "steady throughout" —
    its lead brakes on the final step.

---

## 13. Open decisions that need a human

| Decision | Why it is open |
|---|---|
| Should `adas.aeb.brake_onset_margin` be a hard invariant? | Soft today; making it hard needs the scenario to declare whether severity-reducing late intervention is acceptable, and nothing declares that. |
| Should `config/phase8-approvals.yaml` be committed? | Gitignored, so approvals are unauditable; committing puts approver names in history. |
| Should promoted regression scenarios auto-commit? | Promotion writes into `scenarios/adas/`; a human commits by hand, deliberately. |
| Should the review envelope honour the declared variation axis? | Core comparator does; review path is strict; they can disagree about the same pair. |
| Is content-digest approval the right granularity? | A whitespace edit forces re-approval. |
| Should the threat oracle read omniscient state rather than the trace? | Stronger; not implemented (§6.2). |
| Phase 7A acceptance and any merge of the codex branch. | Built, not accepted; 7B blocked. |
| ~~Merge `feat/phase8-metrics-v3` onto `main`?~~ **Decided 2026-08-26: merged** (`b447fc4`, conflict-free — only `src/hermes/cli.py` overlapped, additively). Branch-side evidence stands, commit-bound to `2dda024`; the merge commit was deliberately **not** separately requalified (its `src`+`tests` tree is the verified branch plus disjoint fleet files). | Any future claim of merge-commit-bound evidence still needs a fresh six-run attempt at `b447fc4` or later. |
| ~~Authorize the MetaDrive longer-map derivation?~~ **Approved and executed 2026-08-26** — Tasks 0/A landed on `feat/phase8-p0-fcw-scenarios` (`b8defdd` shared derivation in `simulator_support.py`, every committed scenario stays `"S"`; `cae6c28` `fcw_stationary_lead` at 140 m, measured warning-margin 2.9 s, suite 1,471, all gates green; Phase-4 acceptance roots re-verified INTERNALLY_CONSISTENT under the new verifier). **HELD unmerged**: final review found the no-version-bump rule wrong for the declared input space — legacy long-gap (100.5–120 m band) adapter-`1.1`/`"S"` bundles, valid before, are now rejected (the verifier derives `"SSS"` with no version discriminator). | **Resolved 2026-08-27**: conditional adapter `1.2` landed as `fd82ead` and was independently verified (six-agent pass — suite 1,482; eleven-case matrix probed independently: the legacy `1.1`/`"S"` long-gap blocker shape now accepted, crossed/unknown shapes rejected at the correct layer; both acceptance-root composites byte-intact; zero transitional `1.1`/derived-map residue). Branch `feat/phase8-p0-fcw-scenarios` (3 commits from `b447fc4`) **merged onto `main` 2026-08-27 as `deeca8c`** (conflict-free, zero overlapping files). Cross-era claim is RE-VERIFIABILITY only, never comparability. The steady-lead owner memo was **approved as written 2026-08-27** — §11.1 item 3 carries the follow-through. |
| Track the Phase 9 PRD in git? Push `main`? Set a default branch? LICENSE? | §11.4. |
| Name the MuJoCo niche; assign an owner. | Nothing graduates without both. |

---

## 14. Housekeeping and known inconsistencies

- The ADAS worktree's copy of this file is **stale by design** (branched at `7a6cfe6`, before
  the FleetLab updates). The ADAS executor must not edit it; results are folded in here. Two
  entries live in the shared `…/Hermes/.git/info/exclude` (affects all worktrees, no tracked
  file): `third_party` (the ADAS worktree's symlink to the vendored simulator) and
  `/Hermes_Phase8_ADAS_Execution_Plan.md`.

- The ADAS worktree moved to `feat/phase8-metrics-v3` on 2026-08-25 (Phase 4). Its Phase-4
  working papers (task briefs/reports, review diffs, the maintenance-pass prompt and report)
  live under `…/Hermes-adas/.superpowers/sdd/` — ignored by that directory's own `.gitignore`,
  deliberately untracked. The Phase-4 acceptance evidence is **outside git entirely** — TWO
  immutable roots under `…/Hermes-adas-wp7-acceptance/`: `ab179583…/attempt-1` (composite
  `cefd7bbc…`) and `2dda0246…/attempt-1` (composite `712c3375…`); treat both as immutable
  (§11.1 item 2).

- The main checkout `…/Hermes` was switched to `main` (Phase 0) by a parallel session on
  2026-08-22 ~22:09 (`git reflog`); `main` has since become the integration trunk (ADAS trunk,
  FleetLab, metrics-V3 merged). **Its untracked `artifacts/` tree is a stale pre-Phase-3
  generation**: at merged `b447fc4`, exactly 8 named byte-pin tests fail there
  (`test_artifact_verification` ×2, `test_comparison` ×2, `test_fixture_registry` ×1,
  `test_review_projection` ×2, `test_wp6_v3_consumers` ×1 — all reading local
  `phase1-nominal`/`handoff-p4-fault` bundles), while the identical code passes 1,418/1,418 in
  the ADAS worktree, whose `artifacts/` holds the canonical 27-bundle fleet matching the
  tracked registry digests. Run ADAS validation in the worktree; syncing the canonical bundles
  into the main checkout (overwriting its stale strays) is an open housekeeping option — an
  owner call, since it replaces local evidence files.

- `Hermes_Fable5_Full_Project_Fresh_Eye_Design_Review_Master_Prompt.md` is in `.gitignore` (line
  47) **but tracked** (committed in `9efb811`). Public today.
- `HERMES_PHASE9_FLEET_SIMULATION_PRD.md` and `PHASE8_SANDBOX_HANDOFF.md` were gitignored
  defensively on 2026-08-22 because `git add -A` in either session would have committed them.
- `sandbox/mujoco/SIMULATION_DESIGN_PACKAGE.md` §7 and header describe the branch as unpushed
  at `64ef395`; stale — the sandbox session's document, not edited here.
- Stale figures caught and corrected this phase: "12 P0 scenarios" (22 + 4); "comparison ✗"
  (delivered since `801d38d`); a pre-rewrite determinism digest; "fresh clone reproduces every
  demo" (it does not). Treat any number in any other document as suspect unless it cites a
  command.
- `.superpowers/` is ignored by its own nested `.gitignore`, not the root one.
- The Makefile `demo-flywheel` comment previously promised an approval and dry-run step the
  target does not run; corrected 2026-08-22 — the target stops at the listing by design.

---

## 15. Document map

**Status and plan — this file only.** Readable copy: the artifact URL in the header. The
separate "Hermes Evidence Lab" artifact is the portfolio page, not a status document.

**Reference (deep material, linked from here, not status):**

| Document | For |
|---|---|
| [README.md](README.md) | Front door and full command surface |
| [PHASE8_DESIGN_SPEC.md](PHASE8_DESIGN_SPEC.md) | Why Phase 8 is shaped this way; §11 open questions |
| [PHASE8_IMPLEMENTATION_NOTE.md](PHASE8_IMPLEMENTATION_NOTE.md) | Decisions forced by the code; deviations; where it is thin |
| [PHASE8_BASELINE_AUDIT.md](PHASE8_BASELINE_AUDIT.md) | Sprint 0 survey; the risk register (§6) that §11 cites |
| [docs/decision-log.md](docs/decision-log.md), [docs/phase1-…phase4-*.md](docs/) | Phase 0–4 decisions and architecture |
| [docs/PHASE6_*.md](docs/), [BUILD_PLAN.md](BUILD_PLAN.md), [VALIDATION_MATRIX.md](VALIDATION_MATRIX.md) | Phase 6 trust model, threat model, usability plan (`NOT YET OBSERVED` rows), validation matrix |
| [PHASE7_EVALUATION_ADEQUACY_AND_HUMAN_VALIDATION_DESIGN.md](PHASE7_EVALUATION_ADEQUACY_AND_HUMAN_VALIDATION_DESIGN.md) | Phase 7 design (implementation in the codex worktree) |
| `HERMES_PHASE7_ADAS_AGENTIC_WORKFLOW_PRD.md` | Phase 8 PRD — local, gitignored; §0-A normative |
| `HERMES_PHASE9_FLEET_SIMULATION_PRD.md` | Phase 9 PRD — local, gitignored |
| `sandbox/mujoco/{NOTES,SIMULATION_DESIGN_PACKAGE}.md` | MuJoCo sandbox — local, gitignored, NOT EVIDENCE |

**Historical (Phase 5–6 era; superseded as entry points, kept for the record):**
`CURRENT_STATE_HANDOFF.md`, `CODEX_HANDOFF.md`, `PROJECT_BRIEF.md`, `PHASE6_*.md`, `AGENTS.md`,
`MASTER_PROMPT.md`, `prompts/`.

**Removed 2026-08-22, content folded here:** `PHASE8_STATUS.md`, `PHASE_ALIGNMENT.md`,
`PHASE8_HANDOFF.md`, `HERMES_OVERVIEW.md`, `PHASE8_GETTING_STARTED.md`.

---

*Simulation-only prototype. Illustrative thresholds. Not road-safety, certification, compliance,
or deployment evidence.*
