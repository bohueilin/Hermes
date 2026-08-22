# Phase 8 — How to run and test it

Ten minutes, in order. Every command is copy-pasteable and every one prints something you can
check against what this page says it should print.

---

## 0. One-time setup

```bash
conda activate hermes-dev
cd ~/Documents/GitHub/Hermes
```

**This matters more than it looks.** Two ways it goes wrong:

| Symptom | Cause |
|---|---|
| `No module named hermes` | You are in the `base` environment. Activate `hermes-dev`. |
| Everything *appears* to work but results look unfamiliar | The `hermes-dev` editable install resolves `hermes` to a **different checkout** (the Phase 7 worktree). |

The second is the dangerous one. `make` now guards against both — it sets `PYTHONPATH` to this
checkout and refuses to start otherwise:

```bash
make preflight
```

Nothing printed, exit 0, means you are pointed at the right code. If you prefer to run
commands by hand rather than through `make`, set this once per shell:

```bash
export PYTHONPATH="$PWD/src"
```

Everything below assumes you have done that. Without it, `python -m hermes` runs the wrong tree.

---

## 1. Does the whole thing still work?

```bash
make test        # expect: 965 passed
make lint        # expect: All checks passed!
make doctor      # expect: 17 PASS, 1 WARN, 1 NOT_AVAILABLE
```

`make test` runs everything including 14 tests that drive **real MetaDrive physics**. To run
only the simulator-free selection — what CI runs:

```bash
python -m pytest -q -m "not metadrive"
```

---

## 2. The five demos, in order of what they prove

### Demo 1 — an ADAS controller runs and is evaluated

```bash
make demo-adas
```

Runs two scenarios and triages the first. **What to look for:**

- `Verdict: CONDITIONAL` on both — the controller passes every hard ADAS invariant and is held
  for review on comfort only.
- `AGENT INTERPRETATION` and `DETERMINISTIC FACT` printed as *separate lines*. That separation
  is the point: the agent's reading never replaces the deterministic one.

### Demo 2 — the evaluation catches controllers broken on purpose

```bash
make demo-seeded-defects
```

**What to look for:** `5 passed`. Three controllers, each broken in exactly one way by
configuration alone, each caught by its own named criterion — plus a baseline control case, so
"the gate caught it" cannot just mean "the gate always fails".

To watch one fail by hand:

```bash
python -m hermes run --simulator metadrive --headless \
  --scenario scenarios/adas/aeb_lead_hard_brake.yaml \
  --policy adas-longitudinal --policy-config config/adas/defect_late_braking.yaml \
  --gate-config config/gates.adas.yaml --seed 7 --run-id demo-late
```

Expect `Verdict: HOLD` and `adas.aeb.brake_onset_margin` among the supporting findings: the
controller began braking when stopping already required **more deceleration than it has**.

### Demo 3 — a candidate cannot buy a safety metric with a false intervention

```bash
make demo-adas-tradeoff
```

**This is the one to show people.** Expect:

```
verdict        REGRESSED   CONDITIONAL -> HOLD
hard_failures  REGRESSED   [] -> ['adas.aeb.no_false_intervention']
```

The candidate brakes far earlier. On the threat scenario that *improves* minimum time-to-collision
from 1.17 s to 4.67 s — on a collision-and-TTC scorecard it ships. The gate holds it anyway,
because of what it does when nothing is there.

### Demo 4 — a failure becomes a regression case

```bash
make demo-flywheel
```

The canonical workflow end to end. **What to look for:**

- `Coverage: GAP` — the proposal is not a duplicate of existing coverage.
- The draft's `[VALIDATED]` state — it passed the requirement floor, so it does not weaken
  the coverage it derives from.
- `Approval: none` in the listing — nothing has been promoted, and nothing can be until a
  human records a decision.

To carry it through to promotion:

```bash
DRAFT=$(ls drafts | head -1)
python -m hermes regression promote "$DRAFT"          # refused: APPROVAL_REQUIRED
python -m hermes regression approve "$DRAFT" --approver "$(whoami)" \
  --rationale "Reproduces the late-braking failure at the observed geometry."
python -m hermes regression promote "$DRAFT"          # dry run: shows the plan
python -m hermes regression promote "$DRAFT" --execute
```

The last one writes into `scenarios/adas/`. Undo with
`rm scenarios/adas/*_regression_*.yaml && rm -rf drafts config/phase8-approvals.yaml`.

### Demo 5 — the evaluation generalises to a manoeuvre it was not written for

```bash
make demo-cut-in
```

The oracle in `verifiers/adas.py` never looks at `challenge.kind` — it works from observed gap
and closing speed alone. These two scenarios use the **same** cut-in manoeuvre and differ only
in geometry. **What to look for:** the near case brakes and passes every hard ADAS finding; the
far case never brakes at all (`brake_onset_margin` reports NOT_AVAILABLE, which is the honest
answer rather than a pass). No ADAS or verifier code changed to support either.

The two tests it then runs are the point: the pair must separate by geometry, and each
scenario must *pass* the defect the other one catches.

---

## 3. The agent surface

```bash
python -m hermes agent tools
```

The tool catalogue with a permission on every row: **READ** freely, **EXECUTE** within a budget,
**MUTATE** only with a recorded approval.

```bash
python -m hermes agent triage demo-late
python -m hermes agent check-citations demo-late
```

Triage prints the agent's proposal against the deterministic classification, every claim with a
citation, and states explicitly that no human decision has been recorded. `check-citations`
re-resolves each citation against the bundle — expect `All N citations resolved and matched.`

### See the mutation boundary refuse

The most important behaviour in the agentic layer is a refusal, so it is worth seeing:

```bash
python - <<'PY'
from pathlib import Path
from hermes.agents.tools import ToolContext, promote_regression

context = ToolContext(repository_root=Path.cwd(), artifact_root=Path.cwd() / "artifacts")
draft = Path("/tmp/draft.yaml")
draft.write_text(Path("scenarios/adas/adas_nominal_no_lead.yaml").read_text())

result = promote_regression(context, draft_id="my-draft", draft_path=draft, dry_run=False)
print("ok:", result.ok)
print("error:", result.error.code.value, "-", result.error.detail)
PY
```

Expect `ok: False` and `APPROVAL_REQUIRED`. It refuses identically whether an agent, a model, or
you at the keyboard calls it — that is the whole design.

---

## 4. Reading a result

Every run writes a bundle under `artifacts/<run-id>/`:

```bash
python -m hermes review-artifact demo-late --artifact-root artifacts --format text
```

Or look directly:

```bash
cat artifacts/demo-late/verdict.json | python -m json.tool | head -20
```

The four ADAS findings to look for:

| Finding | Asks |
|---|---|
| `adas.aeb.threat_response` | Under a real threat, did it brake and avoid contact? **(hard)** |
| `adas.aeb.no_false_intervention` | With no threat, did it stay quiet? **(hard)** |
| `adas.aeb.brake_onset_margin` | Did braking begin while stopping was still achievable? (soft) |
| `adas.fcw.warning_timing` | Did the run actually present the declared warning exposure? (soft) |

A hard finding failing means `HOLD`. A soft one means `CONDITIONAL` — held for human review.

---

## 5. Prove it is reproducible

```bash
for i in 1 2 3; do
  python -m hermes run --simulator metadrive --headless \
    --scenario scenarios/adas/aeb_lead_hard_brake.yaml \
    --policy adas-longitudinal --policy-config config/adas/baseline.yaml \
    --gate-config config/gates.adas.yaml --seed 7 --run-id "det-$i" | grep "Trace digest"
done
```

Expect the **same digest three times**. Same host, pinned simulator commit — cross-platform
identity is an explicit non-goal.

Clean up: `rm -rf artifacts/det-* artifacts/demo-late`

---

## 6. If something breaks

| Symptom | Fix |
|---|---|
| `No module named hermes` | `conda activate hermes-dev` |
| `make` refuses with a preflight message | Follow the message; it names the exact command |
| A test wants a fixture that is absent | `make fixtures` |
| A clean clone reports ~144 failures | Expected. Run `make fixtures`; the residual ~24 need the vendored simulator, which is gitignored and not a declared dependency |
| `run ID must be 1-64 lowercase ASCII...` | Run IDs allow letters, digits and hyphens — no underscores |
| MetaDrive fails to import | `third_party/metadrive` must be vendored; run `make doctor` |
| A demo exits non-zero | `hermes run` encodes the verdict in its exit status: 0 PASS, 10 CONDITIONAL, 20 HOLD, 30 invalid evidence. Only 30 is a real failure. |

---

## 7. Where to read next

| Document | For |
|---|---|
| [PHASE8_STATUS.md](PHASE8_STATUS.md) | Where the work stands, and what is deliberately not claimed |
| [PHASE8_DESIGN_SPEC.md](PHASE8_DESIGN_SPEC.md) | Why the design is shaped this way, and open questions |
| [PHASE8_IMPLEMENTATION_NOTE.md](PHASE8_IMPLEMENTATION_NOTE.md) | What was built, measured, and where it is thin |
| [PHASE8_HANDOFF.md](PHASE8_HANDOFF.md) | Status against the acceptance gates |
| [PHASE8_BASELINE_AUDIT.md](PHASE8_BASELINE_AUDIT.md) | The survey of the pre-existing codebase |
