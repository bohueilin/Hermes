# Hermes Phase 7 — Claude Feedback Disposition

**Date:** 2026-08-15

**Repository:** `bohueilin/Hermes`

**Reviewed HEAD:** `9efb811fde6ce122ec83836f782f3d861f626f37`

**Source design:** `PHASE7_EVALUATION_ADEQUACY_AND_HUMAN_VALIDATION_DESIGN.md`

**Claude report:** private attachment supplied by Bo-Huei on 2026-08-15

**Status:** `OWNER APPROVED 2026-08-16 — TEST-FIRST IMPLEMENTATION AUTHORIZED`

## 1. Evaluation method

Codex read the complete report, reproduced the material artifact facts, inspected the cited source,
and commissioned three independent read-only audits covering adequacy semantics, human-study
integrity, and architecture boundaries. Claude's suggestions are not treated as authority; each is
classified against current repository evidence.

No source, test, scenario, config, artifact, third-party file, Git index, or remote state was changed
while producing this ledger.

## 2. Verified report-wide facts

- All 43 retained artifact directories were inspected read-only.
- Recorded override reasons across them are only `SPEED_CAP` (178) and
  `STALE_OBSERVATION` (4).
- No retained bundle records `TTC_BELOW_THRESHOLD`.
- No retained `findings.json` contains a `NOT_AVAILABLE` finding.
- The cut-in baseline reaches policy-input TTC at or below 2.0 seconds at sequences 35 and 36;
  its minimum is 1.8155836417275437 seconds at sequence 36.
- The cut-in candidate never enters that band, records `SPEED_CAP` at sequences 20, 26, and 32,
  records no target-TTC reason, and has stored minimum TTC 8.49579415469856 seconds.
- Both cut-in verdicts are `HOLD`; the candidate's route, acceleration, and jerk dimensions regress.
- Configured `trigger_step` 30 means policy-input phase remains `PRE_TRIGGER` at sequence 30 and
  first becomes `BRAKING` at sequence 31.
- Current shield code suppresses all reasons when its binary32-normalized output equals the policy
  action, so recorded-reason absence alone cannot prove a trigger predicate was false.

## 3. Required-finding dispositions

| ID | Disposition | Evidence-backed decision | Design and test consequence |
|---|---|---|---|
| P0-1 cut-in causal over-credit | `ACCEPT WITH MODIFICATION` | The stored deltas are factual, but pre-trigger `SPEED_CAP` and zero target-TTC overrides prevent attributing them to the TTC mechanism. | Extend the moratorium to cut-in. Retain Task 7 only as a deliberately non-causal mixed-delta interpretation task. Require exact confound/no-causality language and treat causal attribution as a critical misconception. |
| P0-2 no mixed fixture if cut-in withdrawn | `ACCEPT WITH MODIFICATION` | The consequence is real only if Task 7 is removed. | Keep the revised cut-in Task 7; Tasks 1–9 remain the comprehension denominator. Record this choice explicitly in the instrument and pilot gate. |
| P1-1 silent reason/action-equality channel | `ACCEPT WITH MODIFICATION` | Condition exposure and observable intervention are different facts. Raw float inequality also over-credits binary32-only changes. | Split target-condition exposure from recorded intervention. Keep criterion statuses `PASS/FAIL/NOT_AVAILABLE`, add typed observation dispositions, and define material action change after deterministic binary32 normalization of candidate fields. A condition can pass while intervention observation fails with `CONDITION_MET_NO_RECORDED_INTERVENTION`. |
| P1-2 actuation-delay and other confounds | `ACCEPT WITH MODIFICATION` | `ACTUATION_DELAY_COMPENSATION` can brake before the target band and prevent target entry. Empty recorded reasons do not prove predicates were false. | Freeze compensation at 0.0. Recompute every non-target trigger predicate from stored observations plus captured config and require it false through treatment divergence; also require no recorded non-target reason. Cover speed, stale age, boundary, emergency-stop, and delay predicates. |
| P1-3 registration compressed into adequacy | `ACCEPT` | `NOT_AVAILABLE` is evidence absence, not missing registration. | Adequacy becomes criteria-only using `FAIL > NOT_AVAILABLE > PASS`. All criteria PASS means `ADEQUATE`; registration and interpretation remain independent. Missing registration yields `ADEQUATE + REGISTRATION_NOT_ESTABLISHED + DESCRIPTIVE_ONLY`, never a declared-question claim. |
| P1-4 local Git ordering over-trusted/on wrong layer | `ACCEPT WITH MODIFICATION` | Local history is mechanically inspectable but author-rewritable, unauthenticated, and not an external timestamp. `subprocess` does not belong in adequacy core or review. | Rename positive status `LOCAL_HISTORY_ORDERING_VERIFIED`; always show `NOT_AUTHENTICATED` plus a rewritable-history limitation. Add `hermes.provenance.git` as the new bounded Git-process boundary. `hermes.adequacy.api` is the public production composition service and accepts no caller-supplied inspector/result; it passes only immutable output into pure assessment. Defer migration of the three legacy Git helpers because their policies differ; do not broaden the registration inspector to arbitrary Git commands. |
| P1-5 one-event availability fixture | `ACCEPT WITH MODIFICATION` | With the current legacy profile, optional jerk is unavailable only for fewer than two events, so the requested 3/1/1/1/1 fixture is necessarily one event. | State that this shape is forced, not preferred. Scope Task 4 to single-artifact label, requiredness, reason, consequence, and trust comprehension—no timeline-scrubbing or comparison inference. Make parity exact across seven findings, metrics, sufficiency, gate/integrity, and the one event's route-progress `NOT_AVAILABLE` projection. Do not claim comparison availability-delta coverage. |

## 4. Non-blocking-finding dispositions

| ID | Disposition | Decision |
|---|---|---|
| P2-1 primary-baseline reproduction | `ACCEPT WITH MODIFICATION` | Freeze a canonical selection-evidence digest and exact selected criterion observations in the ledger. The fresh primary baseline must reproduce those observations exactly; do not use normal comparison across different registration commits. |
| P2-2 LRU before pilot | `ACCEPT` | Fresh process per participant bounds study exposure. Defer LRU until after the pilot; measure RSS and cache/active high-water marks across the exact task sequence and promote only if the frozen budget is exceeded or timing is perturbed. |
| P2-3 O(N) not falsifiable | `ACCEPT WITH MODIFICATION` | Specify the **new adequacy core** as `O(B + C)` with one monotonic scan, bounded summary references, and a deterministic visit-counter test at 10,000 events. Do not claim existing stored verification is linear or use a wall-clock-only proof. |
| P3-1 phase convention | `ACCEPT` | Use policy-input `observation_summary.challenge_phase`; configured trigger 30, first input `BRAKING` 31. |
| P3-2 exit-code precedent | `ACCEPT` | Cite D6-021. Valid `ADEQUATE`, `INADEQUATE`, and `NOT_AVAILABLE` are completed operations and exit 0; invalid is 30; incompatible/invalid-plan/operational is 40. Canonical JSON is the programmatic contract. |
| P3-3 selected-scenario promotion wording | `ACCEPT` | Every discovery variant remains repository-external. Exactly one rule-selected, digest-identical scenario may be materialized at the declared tracked path as one of the three allowed pair-plan-commit additions. |

## 5. Owner-question decisions

| Question | Decision |
|---|---|
| External plan or scenario-embedded adequacy | Keep external versioned plan and separate assessor/CLI. |
| Descriptive deltas or suppression | Preserve factual deltas. Replace “Advancement interpretation” with non-authoritative comparison wording, place the causal limitation before directional copy, and prohibit causal attribution. |
| V1 scope | Lead-only assessor. Keep retained lead and cut-in pairs as different negative controls; do not generalize to cut-in adequacy. |
| Exact prefix | Keep exact same-platform/same-commit equality; independently reproduced on both retained pairs. |
| LRU timing | Post-pilot unless measured study-process growth violates the frozen budget. |
| Fixture portability | Local digest-bound registry is sufficient for Phase 7; external portable fixtures remain future work. |
| Pilot thresholds | Keep as non-binding hypotheses until pilot data; freeze before the main cohort. |
| Cohort | 6–10 non-authors supports only raw-count, role-bounded claims. Never report a percentage without numerator and denominator. |
| Pre-recruitment zero-tolerance findings | No authority label/state mismatch, hidden required failure, keyboard trap/unreachable critical control, or fixture digest mismatch. |

## 6. Revised implementation boundary

```text
CLI (lazy entrypoint)
└── public hermes.adequacy.api application service
    ├── bounded RegistrationGitInspector from hermes.provenance.git
    ├── existing review facade for one-capture artifact snapshots
    └── pure hermes.adequacy assessment using captured plans + immutable ordering result
```

Rules:

- `hermes.adequacy.models`, `loader`, and `assessment` import no `subprocess`, concrete Git
  inspector, simulator, runtime, adapter, policy, shield, fault, or workbench code.
- `hermes.adequacy.api` is the sole public production composition service and exposes no inspector
  or registration-result injection seam.
- `hermes.review.*` imports no `subprocess` or concrete registration inspector.
- `hermes.provenance.git` is the sole new Git subprocess boundary; the separately approved
  `workbench.launcher` process boundary remains unchanged.
- CLI imports the public Phase 7 API lazily and does not create a second composition path.
- Workbench receives only fixed non-causality copy/order/heading changes; it does not compute or
  ingest adequacy in v1.
- Existing `review/models.py` and `review/projection.py` are removed from the Phase 7 allowlist.
- Legacy Git-helper consolidation is deferred to a separate parity-tested change.

## 7. Second-audit closures

Three independent read-only reviewers inspected the revised design. Their residual findings were
accepted and closed in the design before owner presentation:

| Finding | Closure |
|---|---|
| Human immediate-stop wording could imply recorded intervention proves causation | Stop on causal attribution even when intervention is recorded; displayed comparison evidence alone cannot prove engagement/effect. |
| Public inspector/result injection could forge local-history status | Public API accepts neither; `adequacy.api` constructs the production inspector and passes immutable output only to a non-public pure helper. |
| Registration still appeared inside an adequacy criterion | Removed local-history registration from criteria; only captured declared identity-string consistency remains. |
| Git operational failure could mask invalid evidence | Frozen order is lexical validation → baseline/candidate verification → compatibility → plan capture/validation → one Git inspection → criteria. |
| Package initialization could transitively load the process boundary | Adequacy/provenance `__init__` files are side-effect-free; pure-submodule import bombs prove no transitive Git/subprocess load. |
| Line-delimited Git parsing was ambiguous for hostile filenames | Tree/status operations are NUL-delimited, byte/arity parsed, streaming bounded, and reject rename/copy/unknown/malformed paths/statuses. |
| End-to-end `O(B + C)` overclaimed current verification | The deterministic visit bound now applies only to the new adequacy core; existing verification complexity is measured at the resource ceiling and any optimization is a separate parity-reviewed design. |
| Plan/criterion/registration mismatch outcomes overlapped | A field-level table assigns request, integrity, compatibility, plan validity, artifact-versus-plan criteria, missing signals, Git ordering, and Git operations one primary result/exit path. |
| Missing `c`/`d` made scan ranges and confound status ambiguous | Frozen `p`, `e`, and `q` endpoints keep prefix/confound checks executable over full traces when boundaries are absent; the status table freezes every boundary-dependent criterion outcome. |
| Baseline could terminate before candidate-defined `c`/`d` | Missing counterpart is an available arm-alignment `FAIL` and completed exit-0 assessment; early-termination tests cover both sides. |

## 8. Approval state and next gate

Claude's report authorized disposition and design revision only. Codex revised the design and
completed independent architecture, human-instrument, and adequacy-semantics re-reviews; all
reported residuals were closed and the final semantic re-review returned `GO`.

Bo-Huei explicitly approved the revised Phase 7 design on 2026-08-16. Codex will now create a
dedicated isolated worktree, write the detailed TDD implementation plan, and execute it task by task.
