# Hermes Phase 7 — Implementation Handoff

**Status:** `PHASE 7A COMPLETE — 7B INSTRUMENT READY, HUMAN EVIDENCE NOT YET OBSERVED`

**Scope:** simulation-only, local, non-authoritative. Nothing in this handoff
establishes real-world safety, certification, compliance, authenticity,
authorization, or deployment permission.

## 1. Snapshot

| Item | Start | End |
|---|---|---|
| Branch | `codex/phase7-evaluation-adequacy-human-validation` | same |
| HEAD | `0caed90150a5b403227c97bf21c7c809181ee3cf` | `a820525` (see §9) |
| Tests collected/passing | 1166 | **1245** |
| Ruff | passing | passing |
| Doctor | 17 PASS / 1 WARN / 1 NOT_AVAILABLE | same |
| MetaDrive | 0.4.3 @ `85e5dadc6c7436d324348f6e3d8f8e680c06b4db`, clean | same |
| Artifact directories | 43 | 131 (88 new, all ignored local outputs) |

## 2. What was built

### 2.1 One shared MetaDrive evidence-configuration builder

`src/hermes/adapters/metadrive_config.py` is the single source of the trace-bound
adapter evidence configuration. Planning predeclares per-variant adapter identity
through it without launching a simulator; `MetaDriveAdapter` uses the identical
builder at runtime, snapshots it to immutable canonical bytes before the
environment is constructed, hands the environment independent deep clones, and
returns fresh copies from `evidence_config`.

Verified byte-identical against retained evidence: re-running the retained lead
baseline reproduces trace digest
`504dfbcdd8f4239f1b9f2a5e94fa64f8a1a6ac108543e46ace12b251aa409bd1` and adapter
config digest `4bf4f0051f46a079abf3d208773ea9ed668e0888f81c1b70f24752adcd9bc4a3`.
No historical artifact meaning changed.

### 2.2 Plan-record schema 2.0 with per-variant identity

The MetaDrive evidence config embeds the scenario challenge payload, so every
grid point records a different adapter-config digest. One global digest could not
describe a multi-variant grid truthfully. Schema 2.0 therefore adds a frozen
template identity, the complete predeclared variant table, an explicit
`config_digest_scope` per component, per-variant binding on every discovery
entry, and end-to-end selected-variant binding on the pair plan.

`EvaluationAdequacyEnvelope` stays 1.0 and the public eight-argument API is
unchanged. Plan-record schema 1.0 is a rejection input only.

### 2.3 Pure authoring compiler

`src/hermes/evaluation_plans/materializer.py` renders every declared grid variant
deterministically from one reviewed template, computes each variant's exact
bytes, scenario digest, and adapter digest, and emits a strict protocol. It
imports no simulator and launches no process.

### 2.4 Frozen-vs-installed simulator preflight

`src/hermes/evaluation_plans/preflight.py` fails closed before the first
discovery attempt and again before each primary run. Without it, a drifted
simulator pin would invalidate every predeclared adapter digest one attempt at a
time and burn the whole grid into an append-only ledger that may never be
deleted.

### 2.5 Deterministic human scoring

The Task 7 checklist named exact values but never said how a moderator marks a
spoken answer against them. `docs/PHASE7_HUMAN_VALIDATION_PLAN.md` now carries a
scoring match rule keyed by item type, binding every task: authority values,
directions, named reasons/counts, and the non-causal conclusion are `CRITICAL`;
exact numeric values and event sequences are `SUPPORTING` and never flip an
attempt. Protocol version `P7-HV-1.1`; Task 7 is `P7-T07-v2` / `P7-T07-A2`.

## 3. Evidence generation — the complete disclosed record

Five protocol versions were registered. Every one is committed, including the
three that found nothing and the one whose assessment failed. See
`evaluation-plans/DISCOVERY_RESULTS.md` for the full record.

| Version | Threshold | Variants | Discovery outcome | Assessment |
|---|---:|---:|---|---|
| v1 | 2.0 s | 18 | no valid attempt | — |
| v2 | 2.0 s | 32 | no valid attempt | — |
| v3 | 2.0 s | 15 | no valid attempt | — |
| v4 | 4.0 s | 9 | selected `grid-0000` | `INADEQUATE` (mis-declared policy digest) |
| v5 | 4.0 s | 9 | selected `grid-0000` | **`ADEQUATE`** |

### 3.1 The substantive negative finding

Across 65 registered baseline attempts in versions 1-3, the `metadrive-idm`
policy never let the policy-input TTC fall below about **3.11 s** in a
lead-vehicle hard-brake encounter. The search is bracketed on both sides: the
minimum is flat near 3.11 s at 30-40 m initial gap and rises to 10.3 s at 100 m.

A deterministic shield with a 2.0 s TTC threshold therefore **cannot** engage in
this scenario family at all. The retained `handoff-p3-lead-*` pair does not
merely happen to lack a TTC intervention — the intervention is structurally
unreachable at that threshold. This is the finding that justified the Phase 7
showcase moratorium, now established by measurement rather than inference.

### 3.2 The positive result

v5 asks the same question at a 4.0 s threshold, above the measured floor, frozen
before any v5 run existed. All seventeen criteria pass.

- Pair: `handoff-p7b-lead-baseline` → `handoff-p7b-lead-candidate`
- Adequacy `ADEQUATE`, disposition `TARGET_INTERVENTION_RECORDED`
- Registration `LOCAL_HISTORY_ORDERING_VERIFIED`, interpretation
  `DECLARED_QUESTION_ONLY`
- Candidate override reasons: exactly `{"TTC_BELOW_THRESHOLD": 3}` at sequences
  66, 70, 74 — **the first `TTC_BELOW_THRESHOLD` override recorded anywhere in
  this repository's evidence**
- No `SPEED_CAP`, `STALE_OBSERVATION`, `BOUNDARY_RISK`, `EMERGENCY_STOP`, or
  `ACTUATION_DELAY_COMPENSATION` reason anywhere; every non-target predicate
  recomputed from stored observations is false through the divergence
- Exact common-prefix equality across all 66 events through sequence 65; first
  divergence at 66
- The fresh primary baseline reproduced the selected discovery observation
  exactly: `3.1221979708407908 s` at sequence 74
- Both arms remain at gate verdict `HOLD`. Adequacy is not a gate.

### 3.3 Negative control and fail-closed behaviour

`handoff-p3-lead-baseline` → `handoff-p3-lead-shielded` against the same plan:
`INADEQUATE`, disposition `TARGET_INTERVENTION_CONFOUNDED`, interpretation
`DESCRIPTIVE_ONLY`, registration `REGISTRATION_NOT_ESTABLISHED`. Diagnostics name
the confounds: available BRAKING inputs never entered the band, 36 target-evidence
violations precede any divergence, 73 non-target predicate or reason violations,
zero qualifying target events.

`phase1-tampered` as baseline: exit 30, `assessment: null`, no criteria.

## 4. Commit topology

```text
fc63bd3  protocol v5 registration (clean tree)
   |
cb6d669  pair-plan freeze — sole parent fc63bd3, adds exactly three paths:
         discovery ledger, pair plan, selected scenario
   |
         primary baseline and candidate both run at cb6d669, clean tree
```

Both primary manifests record `cb6d66954a277eb21d3100eb555222f9acc0c16a` with
`repository_dirty: false`.

## 5. Regeneration commands

Frozen for the record. Run from the repository root at commit `cb6d669`:

```bash
conda run -n hermes-dev hermes run \
  --simulator metadrive \
  --scenario scenarios/metadrive_lead_vehicle_hard_brake_adequacy_v2.yaml \
  --policy metadrive-idm --seed 7 --run-id handoff-p7b-lead-baseline \
  --gate-config config/gates.phase2.yaml --headless --shield noop
```

```bash
conda run -n hermes-dev hermes run \
  --simulator metadrive \
  --scenario scenarios/metadrive_lead_vehicle_hard_brake_adequacy_v2.yaml \
  --policy metadrive-idm --seed 7 --run-id handoff-p7b-lead-candidate \
  --gate-config config/gates.phase2.yaml --headless --shield deterministic \
  --shield-config config/shield.phase7.lead_ttc.v2.yaml
```

```bash
conda run -n hermes-dev hermes assess-adequacy \
  handoff-p7b-lead-baseline handoff-p7b-lead-candidate \
  --repository-root . --artifact-root artifacts \
  --plan-root evaluation-plans \
  --protocol lead_ttc_engagement.protocol.v5.yaml \
  --discovery-ledger lead_ttc_engagement.discovery.v5.jsonl \
  --pair-plan lead_ttc_engagement.pair.v5.yaml --format json
```

Real-simulator acceptance:

```bash
conda run -n hermes-dev python -m pytest -q -m metadrive \
  tests/integration/test_phase7_artifacts.py
```

## 6. Gates

| Gate | Result |
|---|---|
| `python -m pytest -q` | **1245 passed** |
| `python -m pytest -q -m "not metadrive"` | 1239 passed, 6 deselected |
| `python -m pytest -q -m metadrive tests/integration/test_phase7_artifacts.py` | 5 passed |
| `python -m ruff check .` | All checks passed |
| `python -m hermes doctor` | 17 PASS, 1 WARN (conda env), 1 NOT_AVAILABLE (display) |
| `git diff --check` | clean |
| `third_party/metadrive` | clean at the pinned commit |

## 7. Claude review findings dispositioned in this implementation

| Finding | Disposition |
|---|---|
| P1-1 no scoring match rule | Implemented — type-keyed rule, protocol versioned, template fields added, cross-document tests |
| P1-2 no installed-vs-frozen simulator preflight | Implemented — `hermes.evaluation_plans.preflight`, gated before discovery and each primary run |
| P1-4 (from the earlier review) Git boundary on the wrong layer | Already implemented by Codex as `hermes.provenance.git`; verified present |
| P2-1 no primary-baseline reproduction check | Implemented — enforced by the assessor criterion `fresh_baseline_selection_reproduces_selected_discovery` and by a dedicated acceptance node |
| P1-2 (design) actuation-delay confound | Verified enforced: `ShieldConfiguration` pins `actuation_delay_compensation_s` to `0.0` and the assessor recomputes every non-target predicate |

A pre-existing test-isolation defect was also fixed: the workbench `AppTest`
import bomb ran in-process and leaked its meta-path blocker into the rest of the
pytest session, so any later test that legitimately imported an adapter, policy,
runtime, or MetaDrive module failed depending on ordering.

## 8. Limitations and non-claims

- Adequacy is a claim precondition, not a gate, verifier, winner score, or
  deployment decision. Exit 0 means a completed assessment.
- `ADEQUATE` means `DECLARED_QUESTION_ONLY` for one pair, one plan, one bounded
  simulation, on one platform.
- Registration ordering is evidenced by local Git history, which is rewritable by
  the same author it defends against and carries no external timestamp. Evidence
  remains `NOT_AUTHENTICATED`.
- The 4.0 s threshold is illustrative and was chosen above a measured floor. It
  is not a safety criterion, and the 2.0 s question remains closed as unreachable.
- `behavior_realism_claim: false`. MetaDrive dynamics do not establish real-world
  behaviour.
- Human comprehension, manual visual quality, and accessibility remain
  `NOT YET OBSERVED`. `HUMAN_EVIDENCE_OBSERVED` and `COMPREHENSION_GATE_MET`
  remain `NOT PROMOTED`. No participant has been run.
- `handoff-p7-lead-*` (the v4 attempt) and all discovery artifacts are retained
  unchanged as failure evidence.

## 9. Next actions

1. Owner review of this handoff and of `evaluation-plans/DISCOVERY_RESULTS.md`.
2. Independent adversarial review of the Phase 7A implementation before any
   recruitment, per the amendment's approval gates.
3. Phase 7B remains gated: `P7-HV-07` stays `BLOCKED` until the Task 7 / Task 8
   contract amendment is approved, and `READY_FOR_PILOT` is not met.
