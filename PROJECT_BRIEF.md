# Hermes — Phase 6 Product Brief

## Product identity

**Repository:** `bohueilin/Hermes`
**Distribution:** `hermes-autonomy`
**Python package:** `hermes`
**Positioning:** Scenario-to-evidence control plane for simulation-based autonomy development.

## Product thesis

> **Autonomy policy proposes → environment executes → verifiers evaluate → gate decides → trace proves.**

For current Hermes, the trace supports an internally consistent advancement decision. It does not independently authenticate the producer, re-execute the policy or simulator, establish real-world safety, or grant deployment permission.

## Problem

Before Phase 6, Hermes produced structured, independently re-verifiable simulation evidence, but
reviewers had to consume legacy CLI output and raw files. That made it difficult to answer quickly
and accurately:

- what was tested;
- what the policy proposed, the shield permitted, and the environment executed;
- which evidence was observed versus computed;
- which requirements failed or lacked evidence;
- why the release gate issued its verdict;
- whether a candidate improved one dimension while regressing another;
- whether the artifact is internally consistent, authenticated, authorized, or deployable.

A conventional dashboard can worsen this problem by turning a recomputed gate verdict into a generic green status, hiding missing evidence, or reimplementing evidence logic in the presentation layer.

## Primary user

An autonomy product leader, safety reviewer, simulation engineer, autonomy developer, or release owner reviewing a completed Hermes artifact or compatible baseline/candidate pair within a constrained simulation ODD.

## Phase 6 product objective

Hermes now provides a **local, read-only Evidence Review Workbench** that makes existing evidence
understandable without weakening its integrity model.

The workbench answers:

1. What exact artifact was reviewed?
2. Did stored verification accept it as internally consistent?
3. What gate verdict was recomputed, and why?
4. Which findings were hard failures, soft failures, warnings, or unavailable?
5. What evidence was required versus available?
6. Which event sequences support each finding?
7. What did candidate, permitted, and executed actions show?
8. What improved and regressed in a compatible comparison?
9. Is the artifact authenticated?
10. What does the result not establish?

## Core trust states

Phase 6 completed implementation and adversarial hardening at checkpoint `90fb7d8`. The complete
and non-MetaDrive selections each passed 720 tests, and independent reviewers returned GO with no
open P0/P1. The delivered implementation uses strict immutable portable
`ReviewEnvelope`/`ComparisonEnvelope` version 1.0, a framework-independent review core, and
optional Streamlit `>=1.37,<2`.

The workbench must always expose these independently:

| Dimension | Phase 6 value or domain |
|---|---|
| Gate verdict | `PASS`, `CONDITIONAL`, `HOLD`, `INVALID_EVIDENCE` |
| Evidence integrity | `INTERNALLY_CONSISTENT`, `INVALID_EVIDENCE`, transient `UNVERIFIED` |
| Evidence authenticity | `NOT_AUTHENTICATED` |
| Authorization | `NOT_EVALUATED` |
| Deployment permission | `NONE` |
| Scope | `SIMULATION_ONLY` |

## Core jobs to be done

Authoritative/supersession status is independently fixed at `NOT_DEFINED` for Phase 6; this is
separate from authorization `NOT_EVALUATED`.

1. Select one exact artifact under an allowed local artifact root.
2. Capture and verify it without mutation or simulator rerun.
3. Review verdict, rationale, findings, evidence sufficiency, provenance, and limitations.
4. Drill from a finding or metric to supporting event sequences.
5. Inspect candidate, permitted, and executed actions over time.
6. Compare two independently verified and compatible artifacts.
7. Export a machine-readable review envelope without modifying the source bundle.

## Existing product assets

The canonical bundle is exactly the ten names in REQUIRED_ARTIFACT_FILES. The review facade retains
source inventory and observed/computed bundle roots from the same descriptor-safe capture. It may
not reopen files for presentation.

The pre-Phase 6 foundation provides:

- strict versioned scenarios and evidence;
- deterministic fake and MetaDrive adapters;
- candidate/permitted/executed actions;
- deterministic shield and fault replay;
- independent stored verification;
- hard-invariant release semantics;
- compatible stored comparison;
- tamper and false-pass tests;
- local CI/developer workflows.

Phase 6 reuses these capabilities rather than recreating them.

## Phase 6 scope

### Delivered scope

- Canonical bundle contract reconciliation.
- `ReviewEnvelope v1` and `ComparisonEnvelope v1`.
- Framework-independent review facade.
- Read-only review and comparison CLI JSON surfaces.
- Local-only reviewer workbench.
- Artifact identity, integrity, trust, provenance, findings, evidence sufficiency, timeline, and comparison views.
- Negative and human-factors tests.
- Design-only future authenticity specification.
- Core-owned evidence requiredness and structured simple/compound threshold projection.

### Out of scope

- Artifact mutation, repair, migration, or annotation.
- Scenario execution or simulator launch from the UI.
- Policy execution or training.
- Threshold or gate editing.
- Approve, promote, release, or deploy controls.
- Multi-user accounts, cloud hosting, remote ingestion, or database persistence.
- Evidence signing in the same implementation wave.
- New scenario families except tests needed to validate the reviewer surface.
- RL, CARLA, ROS 2, Autoware, real-log training, hardware-in-the-loop, or physical vehicle integration.

## Product principles

1. **Verification before visualization.** Stored verdicts are not shown as accepted until independent verification completes.
2. **No parallel authority.** The UI consumes one canonical review facade.
3. **Trust dimensions stay separate.** Integrity, authenticity, authorization, and deployment permission are not interchangeable.
4. **Missing evidence is visible.** `NOT_AVAILABLE` is not zero.
5. **Hard failures remain non-compensatory.** No chart or score can average away a collision.
6. **Comparison is multidirectional.** Improvements and regressions appear together.
7. **Exact identity matters.** No automatic “latest artifact” authority.
8. **Simulation-only is persistent.** Scope and limitations appear on every review.

## Smallest useful release

A reviewer can:

- review one verified artifact;
- review an invalid/tampered artifact without seeing a trusted stored `PASS`;
- compare two compatible artifacts;
- drill into supporting events;
- see `NOT_AUTHENTICATED`, `NOT_EVALUATED`, deployment permission `NONE`, and `SIMULATION_ONLY` on every view.

No approval or write action exists.

## Delivered local interfaces

Selections are exact relative paths under the configured artifact root; they are not prefixed with
`artifacts/` and are never chosen automatically.

```bash
hermes review-artifact handoff-phase5-demo \
  --artifact-root artifacts \
  --format json

hermes review-compare \
  handoff-p3-lead-baseline \
  handoff-p3-lead-shielded \
  --artifact-root artifacts \
  --format text

hermes workbench \
  --artifact-root artifacts \
  --host 127.0.0.1 \
  --port 8501 \
  --no-browser
```

The CLI and workbench consume the same immutable facade. A review performs a fresh root-contained
capture and stored verification, never a simulator/policy run or artifact write.

## Success metrics for Phase 6

### Correctness

- 100% parity between CLI review envelope and UI-displayed verdict/findings for test fixtures.
- Zero artifact bytes changed after review.
- All invalid-evidence fixtures remain quarantined.
- All incompatible comparisons render no misleading charts.

### Reviewer comprehension

A new reviewer can answer:

- why the gate issued the verdict;
- which hard requirement failed;
- which evidence was unavailable;
- what the shield changed;
- what improved and regressed;
- whether the artifact is authenticated;
- whether the verdict grants deployment permission.

### Developer quality

- Complete and non-MetaDrive test selections passed 720 tests at the adversarial-hardening
  checkpoint; Ruff and the focused Phase 6 matrix passed.
- UI dependencies remain optional.
- Workbench binds to loopback only.
- No simulator starts during review tests.
- Review commands exit 0 for valid PASS, CONDITIONAL, and HOLD reviews; invalid evidence exits 30;
  path/configuration/operational/incompatible cases exit 40. Legacy command exits do not change.

## Accepted residual risk

The process-local facade cache and active-session maps currently grow with each explicit selection.
The adversarial review classified this as P2 availability debt because Hermes performs no artifact
discovery or automatic loading, requires a local reviewer to submit each selection, and recovers on
process restart. Add a deterministic synchronized LRU before materially increasing single-user
artifact scale. This residual does not change evidence, bypass verification, or expand the
local-only scope.

## Executive narrative

Hermes does not become more credible merely by drawing prettier charts. Phase 6 makes the existing evidence legible while preserving the distinction among capability, permission, verification, evidence, authenticity, and residual risk.
