# Hermes Current-State Handoff after Phase 6

## 1. Executive summary

Hermes is a simulation-only autonomous-driving scenario and safety-evidence lab. Its product thesis is:

> **Autonomy policy proposes → environment executes → verifiers evaluate → gate decides → trace proves.**

Phases 0–6 are implemented and locally validated. Hermes now includes a **local, read-only Evidence
Review Workbench** that consumes existing stored verification and comparison results without
creating a parallel evidence authority. The implementation/adversarial checkpoint is `90fb7d8`;
independent reviewers returned GO with no open P0/P1.

## 2. Canonical identity and environment

| Surface | Current value |
|---|---|
| Product/repository | `Hermes` / intended `bohueilin/Hermes` |
| Local repository | `/Users/bohueilin/Documents/GitHub/Hermes` |
| Distribution | `hermes-autonomy` |
| Import package | `hermes` |
| CLI | `hermes` |
| Conda environment | `hermes-dev` |
| Python | 3.11.15 |
| Simulator | MetaDrive 0.4.3 |
| MetaDrive source commit | `85e5dadc6c7436d324348f6e3d8f8e680c06b4db` |
| Evidence root | `artifacts/` |

## 3. Validated Phase 6 implementation/adversarial checkpoint

| Item | Observed state |
|---|---|
| Branch | `feat/phase6-evidence-workbench` |
| Checkpoint HEAD | `90fb7d891a233fea9fe5de915060873851da1d70` |
| Working tree | Clean |
| Remote action | None; nothing pushed, published, deployed, or enabled remotely |
| Full tests | 720 passed |
| Non-MetaDrive tests | 720 passed |
| Focused Phase 6 adversarial matrix | 488 passed |
| Ruff | All checks passed |
| Doctor | 17 PASS, 1 expected dirty-tree WARN, 1 optional display NOT_AVAILABLE, 0 FAIL |
| Adversarial decision | GO; no open P0/P1 |

This is the committed implementation/adversarial checkpoint before the final documentation commit,
not a substitute for inspecting the actual branch, commit, and working tree.

## 4. Completed implementation

### Historical Phase 6 design-freeze snapshot — 2026-08-12

The observed starting branch was feat/phase6-evidence-workbench at
27cc5a08931cc1d659128bfebd0bd1ca7e9aefee with a clean tree. The package remained
hermes-autonomy 0.1.0 with Python target 3.11. The supplied and observed regression baseline was
273 passing tests, Ruff passing, and doctor 18 PASS / 1 optional NOT_AVAILABLE. Stage 6A was
documentation-only by design. Its ending validation recorded 273 passed in 3.97 s, Ruff all checks passed,
doctor 17 PASS / 1 intentional dirty-worktree WARN / 1 optional NOT_AVAILABLE / no FAIL, and
git diff --check exit 0.

### Phase 0 — foundation

- Python src-layout package.
- Typer/Rich CLI.
- Equivalent entry paths: `hermes`, `python -m hermes`, and `python -m hermes.cli`.
- Environment doctor for Python, Conda, Git, MetaDrive, assets, simulator commit, writable artifacts, and headless prerequisites.

### Phase 1 — deterministic evidence core

- Simulator-neutral contracts.
- Strict versioned YAML scenarios.
- Deterministic fake simulator.
- Deterministic baseline policy and no-op shield.
- Candidate and executed action separation.
- Canonical JSON and SHA-256 event chain.
- Atomic/no-overwrite artifact publication.
- Stored-only artifact verification.
- Collision, boundary, progress, comfort, trace-integrity, and fault-coverage findings.
- Verdicts: `PASS`, `CONDITIONAL`, `HOLD`, `INVALID_EVIDENCE`.

### Phase 2 — MetaDrive adapter

- Lazy optional adapter behind the same domain contract.
- Pinned MetaDrive 0.4.3 source and commit provenance.
- Bounded headless nominal run with installed IDM policy.
- Stored verification without importing or relaunching MetaDrive.
- Unsupported signals remain explicit `NOT_AVAILABLE`.

### Phase 3 — shield and challenge scenarios

- Deterministic shield with reason codes:
  - `TTC_BELOW_THRESHOLD`
  - `SPEED_CAP`
  - `STALE_OBSERVATION`
  - `BOUNDARY_RISK`
  - `EMERGENCY_STOP`
  - `ACTUATION_DELAY_COMPENSATION`
- Lead-vehicle hard-brake and scripted near-field cut-in challenges.
- Candidate, shield-permitted, and executed action preservation.
- Stored comparison that shows improvements and regressions rather than a winner score.

### Phase 4 — deterministic fault injection

Runtime order:

```text
Raw observation
→ observation faults
→ policy candidate
→ shield-permitted action
→ control delay
→ saturation
→ executed action
→ simulator result
```

Supported wrappers:

- observation delay;
- freeze;
- dropped/held-last observation;
- bounded source-packet noise;
- control delay;
- steering saturation;
- brake saturation.

Stored verification replays deterministic shield and fault transforms from stored evidence.

### Phase 5 — CI and developer experience

- `make check`.
- no-overwrite Phase 1 demo target.
- local/manual MetaDrive smoke target.
- PR-safe GitHub Actions configuration.
- strict pytest markers.
- schema-version tests.
- deterministic fixtures.
- structured CLI errors.
- demo runbook and architecture/traceability documentation.

### Phase 6 — local evidence review workbench

- Strict frozen portable `ReviewEnvelope` and `ComparisonEnvelope` version 1.0.
- One framework-independent review facade shared by CLI and UI.
- Exact root-contained artifact selection with descriptor-relative, no-follow capture.
- Invalid-evidence quarantine: stored verdict/findings/metrics/timeline are not accepted after
  verification failure.
- Core-owned evidence requiredness, exact thresholds, source references, and deterministic timeline
  projection.
- Compatible comparison through the existing compatibility/delta core; no UI winner score.
- Optional Streamlit `>=1.37,<2` workbench with six reviewer screens.
- Numeric loopback-only launcher, disabled usage telemetry, and no remote ingestion.
- No artifact write, repair, migration, signing, approval, promotion, simulator, or policy action.
- Independent adversarial review closed all reproduced P1 findings and one presentation-state P2.

## 5. Canonical evidence bundle

The current Phase 6 implementation consumes the existing ten-file completed-run contract:

```text
artifacts/<run-id>/
  manifest.json
  execution-context.json
  scenario.resolved.yaml
  gate-config.resolved.yaml
  events.jsonl
  metrics.json
  findings.json
  verdict.json
  trace.sha256
  bundle.sha256
```

The design freeze and implementation confirmed this exact inventory against
`REQUIRED_ARTIFACT_FILES`. No alternate seven-file or workbench-specific contract is permitted.

## 6. Demonstrated outcomes

| Case | Result |
|---|---|
| Fake nominal | `PASS` / exit 0 |
| Fake collision | `HOLD` / exit 20 |
| Fake boundary | `HOLD` / exit 20 |
| Fake soft degradation | `CONDITIONAL` / exit 10 |
| Modified artifact | `INVALID_EVIDENCE` / exit 30 |
| MetaDrive nominal | `PASS` |
| Lead baseline and shielded | both `CONDITIONAL` |
| Cut-in baseline and shielded | both `HOLD` |
| Deterministic fault run | `HOLD`; fault coverage passed but mission progress failed |
| Phase 6 review of valid PASS/CONDITIONAL/HOLD | integrity accepted; command exit 0 |
| Phase 6 review of tampered bundle | `INVALID_EVIDENCE`; stored claims quarantined; exit 30 |
| Phase 6 incompatible comparison | no deltas/charts; exit 40 |

Exact root-relative review commands:

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

Observed final artifact names include:

```text
artifacts/handoff-phase5-demo
artifacts/handoff-p2-metadrive
artifacts/handoff-p3-lead-baseline
artifacts/handoff-p3-lead-shielded
artifacts/handoff-p3-cutin-baseline
artifacts/handoff-p3-cutin-shielded
artifacts/handoff-p4-fault
artifacts/handoff-p4-fault-repeat
```

Do not assume every artifact still exists and never auto-select a newest run. A reviewer must submit
an exact selection relative to the configured root; a missing selection fails clearly.

## 7. Strong current boundaries

- Domain, evidence, gate, verifier, shield, fault, and comparison layers are simulator-neutral.
- Stored verification does not rerun the simulator.
- Hard invariants cannot be compensated by aggregate performance.
- Candidate, permitted, and executed actions are distinct.
- Raw, delivered, and result observations are distinct under fault injection.
- Missing signals are `NOT_AVAILABLE`, never zero.
- Comparison reports mixed trade-offs rather than a blanket winner.
- Current artifacts explicitly report `NOT_AUTHENTICATED`.

## 8. Known limitations and unresolved risk

1. Local SHA-256 is tamper-evident, not independently authenticated. A complete bundle can be rewritten and rehashed.
2. Stored verification treats policy proposals and simulator results as trace inputs; it does not re-execute either.
3. Recorded provenance is self-asserted rather than signed.
4. MetaDrive assets have no upstream checksum manifest.
5. MetaDrive IDM observation faults are unsupported because IDM reads native simulator state.
6. The cut-in is scripted kinematic replay with no behavior-realism claim.
7. Same-host determinism was observed; cross-platform bitwise determinism is not claimed.
8. No remote CI execution is claimed.
9. Simulation evidence grants no real-world deployment permission.
10. The process-local review cache and active-session maps have no entry cap. Growth requires
    repeated explicit local selections and is recoverable by restarting the process; add a
    deterministic synchronized LRU before materially increasing artifact scale.

## 9. Phase 6 decision

**GO** for the implemented local, read-only Evidence Review Workbench within the frozen Phase 6
boundary.

The workbench:

- consumes the existing verification and comparison core;
- does not implement a second gate or verifier;
- does not mutate artifacts;
- does not launch a simulator or policy;
- does not edit thresholds;
- cannot approve promotion or deployment;
- labels every current bundle `NOT_AUTHENTICATED`;
- distinguishes gate verdict, internal consistency, authenticity, authorization, and deployment
  permission.

## 10. Required trust vocabulary

A reviewed artifact must expose these independent dimensions:

```text
Gate verdict: PASS | CONDITIONAL | HOLD | INVALID_EVIDENCE
Evidence integrity: INTERNALLY_CONSISTENT | INVALID_EVIDENCE
Evidence authenticity: NOT_AUTHENTICATED
Authorization status: NOT_EVALUATED
Deployment permission: NONE
Scope: SIMULATION_ONLY
```

A green gate verdict must never be presented as “safe,” “trusted,” “approved,” “deployable,” or “road-ready.”

## 11. Next implementation boundary

Do not repeat Phase 6 design or implementation. Preserve the local-only/read-only boundary and run
the documented quality gates before future changes. The smallest optional hardening is a
deterministic synchronized LRU for the accepted P2 cache/session residual. Signing, authorization,
promotion, remote review, scenario expansion, or RL each require a separately authorized phase and
must not be inferred from the Phase 6 GO.
