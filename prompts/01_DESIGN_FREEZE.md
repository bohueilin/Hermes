# Codex Master Prompt — Hermes Phase 6 Design Freeze

Act as a principal autonomy-infrastructure architect, safety-evidence systems designer, product strategist, security reviewer, and senior Python maintainer.

Execute the Phase 6 **design freeze only**. Do not implement the workbench or add a UI dependency during this prompt.

## Repository

```text
/Users/bohueilin/Documents/GitHub/Hermes
```

## Environment

```text
Conda environment: hermes-dev
Python: 3.11
```

## Starting context

The supplied Phase 6 handoff reports:

- Phases 0–5 are implemented.
- Completed branch: `feat/unattended-evidence-core`.
- Design-review HEAD: `9e257a0cf0ddbdbf601b8a01deebe4de52de9763`.
- 273 tests pass.
- Ruff passes.
- `hermes doctor` reports no WARN or FAIL.
- MetaDrive 0.4.3 is pinned and locally validated.
- No remote action occurred.

Verify all of this from the actual repository. Preserve valid newer work. Do not reset to the historical commit.

## Required branch

Work on:

```text
feat/phase6-evidence-workbench
```

If it does not exist, create it from the current reviewed Phase 5 HEAD. If it exists, inspect and preserve valid work. Do not push or modify remotes.

## Read before editing

Read in this order:

1. `AGENTS.md`
2. `CURRENT_STATE_HANDOFF.md`
3. `PROJECT_BRIEF.md`
4. `BUILD_PLAN.md`
5. `VALIDATION_MATRIX.md`
6. `docs/PHASE6_PRODUCT_REQUIREMENTS.md`
7. `docs/PHASE6_ARCHITECTURE_AND_TRUST_MODEL.md`
8. `docs/PHASE6_REVIEW_ENVELOPE_CONTRACT.md`
9. `docs/PHASE6_UX_INFORMATION_ARCHITECTURE.md`
10. `docs/PHASE6_THREAT_MODEL.md`
11. `docs/PHASE6_REQUIREMENTS_TRACEABILITY.md`
12. `docs/PHASE6_AUTHENTICITY_DESIGN.md`
13. Existing Phase 1–5 architecture, decision, traceability, README, handoff, and schema documents.
14. Current implementation and tests for evidence capture, verification, comparison, CLI, gates, verifiers, and artifact publication.

## Execution behavior

Do not merely summarize the supplied documents. Inspect the current repository and update the design to match actual code.

Make safe, reversible decisions without asking routine questions. Record material changes in the decision log.

Do not:

- implement workbench production code;
- add Streamlit, FastAPI, or another UI dependency;
- modify artifact bytes or schema semantics;
- change verdict precedence;
- implement signing;
- launch MetaDrive;
- start deferred scenario, RL, CARLA, ROS, cloud, or hardware work;
- push, create a PR, or modify remotes.

## Design-freeze objective

Produce an implementation-ready, internally consistent Phase 6 specification for a local, read-only Evidence Review Workbench that cannot become a parallel evidence authority.

Required product statement:

> The workbench is a consumer of verified stored evidence. It is not a verifier, gate, simulator, policy runtime, artifact editor, approval system, or deployment authority.

## Required workstream A — inspect current contracts

Inspect and document:

- completed-run file inventory;
- evidence, scenario, findings, verdict, and execution-context schemas;
- artifact no-follow capture and mutation detection;
- stored verification entry points and return types;
- comparison compatibility and output types;
- CLI JSON/text conventions and exit codes;
- current trust/authenticity fields;
- current evidence availability representation;
- current event/source-reference capability;
- current package dependency boundaries;
- existing architecture tests.

For each item, identify:

- observed implementation;
- design implication;
- gap for Phase 6;
- whether a code change will be required in Stage 2.

## Required workstream B — reconcile canonical bundle contract

The expected Phase 5 completed bundle is:

```text
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

Inspect code to confirm or correct this. Update every Phase 6 document so one canonical inventory remains. Identify and correct older seven-file documentation.

Do not migrate existing artifacts in this stage.

## Required workstream C — freeze trust-state semantics

Define independent, versioned fields for:

```text
Gate verdict
Evidence integrity
Evidence authenticity
Authorization status
Deployment permission
Scope
```

Phase 6 defaults must be:

```text
Evidence authenticity: NOT_AUTHENTICATED
Authorization status: NOT_EVALUATED
Deployment permission: NONE
Scope: SIMULATION_ONLY
```

Define exact wording for internally consistent versus authenticated evidence. Prohibit generic “trusted,” “safe,” “approved,” and “deployable” labels.

## Required workstream D — freeze ReviewEnvelope v1

Update `docs/PHASE6_REVIEW_ENVELOPE_CONTRACT.md` into a normative implementation contract.

It must define:

- schema version;
- envelope/tool identity;
- artifact identity;
- integrity and trust states;
- recomputed gate result;
- evidence sufficiency;
- findings;
- metrics and numeric precision;
- event/timeline references;
- observed/computed/assumption/unavailable/residual-risk categories;
- provenance;
- residual limitations;
- source references;
- invalid-evidence representation;
- deterministic versus review-time metadata;
- JSON canonicalization expectations;
- backward/unsupported-version behavior.

Use examples, but no production implementation code.

## Required workstream E — freeze ComparisonEnvelope v1

Define:

- two independently verified artifact identities;
- compatibility result;
- verdict delta;
- hard-failure delta;
- improvements;
- regressions;
- unchanged outcomes;
- evidence-availability deltas;
- source references;
- incompatibility representation;
- explicit absence of a winner score.

## Required workstream F — evidence sufficiency

Inspect how current gate/verifier profiles represent required evidence.

Define a core-owned representation for:

- required and available;
- required but unavailable;
- optional and available;
- optional and unavailable;
- not applicable.

Do not let the UI infer requiredness. Do not silently change existing verdict semantics.

If implementation must extend a core result type, specify the exact minimal extension and compatibility behavior.

## Required workstream G — component and dependency boundaries

Freeze:

- review facade;
- comparison facade;
- presentation projection;
- workbench UI;
- authenticity provider;
- artifact-root/path policy;
- cache policy;
- source-reference service.

Define an enforceable import rule. The UI may import only review-layer APIs and UI framework modules. It must not import gates, verifiers, adapters, policies, shields, faults, or raw artifact parsers.

Specify an AST or equivalent architecture test.

## Required workstream H — framework decision

Evaluate at least:

1. Streamlit as an optional local workbench dependency.
2. A minimal server-rendered local alternative.

Use these criteria:

- review-core independence;
- testability without a browser;
- local-only bind enforcement;
- XSS/escaping behavior;
- no direct artifact reads in UI;
- dependency weight;
- startup simplicity for a hackathon demo;
- cache control;
- accessibility and table/timeline support.

Record one decision and rationale in `docs/PHASE6_DECISION_LOG_SEED.md` or the repository decision log.

Do not install the selected framework in this prompt.

## Required workstream I — UX and information architecture

Freeze screens and required content for:

1. Artifact intake and verification.
2. Review summary.
3. Findings and evidence sufficiency.
4. Event/action timeline.
5. Provenance, integrity, and limitations.
6. Compatible comparison.

For each screen, specify:

- purpose;
- source fields;
- evidence category;
- empty/invalid/error state;
- prohibited language;
- drill-down behavior;
- accessibility requirement;
- exact trust labels.

## Required workstream J — threat model and limits

Update `docs/PHASE6_THREAT_MODEL.md` with:

- assets;
- actors;
- trust boundaries;
- credible false-pass paths;
- path/symlink/TOCTOU threats;
- stale cache;
- XSS;
- resource exhaustion;
- numeric rounding;
- invalid stored PASS;
- comparison cherry-picking;
- provenance/authenticity confusion;
- simulation-fidelity confusion;
- public-bind risk.

For every threat, map prevention, detection, failure behavior, test, and residual risk.

## Required workstream K — validation and stop conditions

Update `VALIDATION_MATRIX.md` with exact:

- design-freeze checks;
- implementation commands;
- review CLI cases;
- workbench launch check;
- fixture coverage;
- negative tests;
- human-comprehension script;
- artifact immutability check;
- dependency-boundary check;
- no-simulator check;
- local-only network check;
- stop conditions.

## Required workstream L — requirements traceability

Update `docs/PHASE6_REQUIREMENTS_TRACEABILITY.md` to map every P0/P1 requirement to:

- owning component;
- implementation milestone;
- test;
- review-envelope field;
- UI surface;
- failure result;
- residual limitation.

## Required workstream M — future authenticity design

Keep authenticity implementation out of scope, but make `docs/PHASE6_AUTHENTICITY_DESIGN.md` implementation-ready for a later phase.

It must distinguish:

- integrity;
- authenticity;
- signer authorization;
- provenance;
- advancement permission;
- deployment permission.

Define a minimal detached Ed25519 attestation model, key custody, trust policy, rotation, revocation, and UX semantics. Do not add code or dependencies.

## Required workstream N — project/status documentation

Update:

- `PROJECT_BRIEF.md`;
- `BUILD_PLAN.md`;
- Phase 6 README draft;
- decision log;
- current-state handoff when repository facts differ.

Do not rewrite validated Phase 1–5 history unnecessarily.

## Validation

Run:

```bash
python -m pip install -e ".[dev]"
python -m pytest -q
python -m ruff check .
python -m hermes doctor
git diff --check
```

Do not launch MetaDrive.

Confirm no production Python module or UI dependency was added during design freeze.

## Required output file

Create:

```text
PHASE6_DESIGN_FREEZE_HANDOFF.md
```

Use `PHASE6_DESIGN_FREEZE_HANDOFF_TEMPLATE.md` as the minimum structure. It must include:

1. Executive GO/CONDITIONAL GO/HOLD recommendation for implementation.
2. Starting and ending branch/commit/status.
3. Actual repository contracts inspected.
4. Canonical bundle decision.
5. ReviewEnvelope and ComparisonEnvelope decisions.
6. Trust vocabulary.
7. Evidence-sufficiency decision.
8. Framework decision.
9. Component/dependency boundaries.
10. Threat-model changes.
11. Validation results.
12. Unresolved decisions.
13. Files changed.
14. Git status.
15. Exact next prompt to run.

## Git

A local design-freeze commit is allowed only when all checks pass:

```text
docs: freeze Phase 6 review contracts
```

Do not push.

## Stop condition

Stop after the design freeze. Do not implement the review facade, CLI, or workbench in this prompt.
