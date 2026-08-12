# Codex Prompt — Implement Hermes Phase 6 Evidence Review Workbench

Implement the approved Phase 6 design. Do not merely produce a plan.

## Authorization condition

Proceed only when all are true:

- `PHASE6_DESIGN_FREEZE_HANDOFF.md` exists.
- It recommends GO or CONDITIONAL GO with no unresolved P0 design blocker.
- The repository is on `feat/phase6-evidence-workbench`.
- The working tree is clean or contains only explicitly reviewed design-freeze changes.
- Current tests and Ruff are green.

If a P0 design blocker remains, stop implementation, update the handoff, and continue only safe documentation or test-design work.

## Repository and environment

```text
Repository: /Users/bohueilin/Documents/GitHub/Hermes
Conda: hermes-dev
Python: 3.11
```

## Read before editing

1. `AGENTS.md`
2. `PHASE6_DESIGN_FREEZE_HANDOFF.md`
3. `PROJECT_BRIEF.md`
4. `BUILD_PLAN.md`
5. `VALIDATION_MATRIX.md`
6. All `docs/PHASE6_*.md`
7. Current verification, comparison, CLI, schema, artifact-capture, and architecture-test implementation.

Treat the approved design-freeze contracts as authoritative. If actual code requires a material deviation, record it and preserve the trust boundary. Do not silently weaken a gate.

## Product objective

Build a local, read-only Evidence Review Workbench that consumes the existing stored-verification and comparison core through versioned immutable review envelopes.

Required invariant:

> The workbench may explain evidence, but it may not create, modify, repair, rerun, approve, or deploy it.

## Milestone 1 — immutable review core

Implement a framework-independent review layer.

Required capabilities:

- exact artifact selection under an allowed artifact root;
- path containment and run-directory validation;
- reuse of the existing no-follow immutable capture;
- reuse of existing stored verification;
- `ReviewEnvelope v1` assembly;
- invalid-evidence quarantine;
- evidence-sufficiency representation;
- source references;
- exact metric, threshold, operator, and unit representation;
- assumptions, unavailable evidence, and residual limitations;
- current trust states: `NOT_AUTHENTICATED`, `NOT_EVALUATED`, `NONE`, `SIMULATION_ONLY`;
- artifact byte immutability.

Do not add UI dependencies until this milestone and its tests are green.

### Review CLI

Implement the design-frozen command, expected shape:

```bash
hermes review-artifact <artifact-dir> \
  --artifact-root artifacts \
  --format text|json
```

Requirements:

- JSON emits exactly one versioned envelope.
- Valid `PASS`, `CONDITIONAL`, and `HOLD` artifacts remain reviewable.
- Invalid evidence exits 30.
- Path, configuration, and unsupported-version errors exit 40.
- No simulator import or launch.
- No artifact write.
- Stored `PASS` is quarantined after integrity failure.

## Milestone 2 — comparison review core

Implement a framework-independent comparison facade that:

- verifies both artifacts independently;
- invokes existing compatibility and comparison logic;
- creates `ComparisonEnvelope v1`;
- exposes improvements, regressions, unchanged results, and availability deltas;
- emits no winner score;
- emits no chart payload when incompatible;
- preserves source references.

### Comparison CLI

Expected shape:

```bash
hermes review-compare <baseline-dir> <candidate-dir> \
  --artifact-root artifacts \
  --format text|json
```

Exit behavior:

- invalid evidence: 30;
- incompatible evidence: 40;
- valid comparison: 0 unless the approved design specifies another non-policy exit model.

Do not alter existing `hermes compare` semantics unless the design freeze explicitly requires a backward-compatible refactor.

## Milestone 3 — local workbench

Install the approved UI framework under an optional `workbench` dependency extra. Do not make it a core runtime dependency.

Expected launcher shape:

```bash
hermes workbench \
  --artifact-root artifacts \
  --host 127.0.0.1 \
  --port 8501 \
  --no-browser
```

Requirements:

- loopback only;
- reject `0.0.0.0`, `::`, non-loopback hostnames, or remote bind requests;
- no telemetry or external service;
- no database;
- no upload control;
- no artifact write endpoint;
- no run, approve, promote, sign, repair, or deploy control;
- UI consumes only immutable review and comparison envelopes;
- artifact-derived text is escaped;
- caches are digest- and schema-keyed;
- changed artifacts invalidate the session.

## Required screens

### 1. Artifact intake and verification

Show:

- exact relative path;
- run ID;
- bundle digest;
- verification progress and status;
- schema support;
- authenticity and simulation boundary.

Do not present the stored gate verdict as accepted before verification completes.

### 2. Review summary

Mandatory trust strip:

```text
Gate verdict
Evidence integrity
Evidence authenticity
Authorization status
Deployment permission
Scope
```

Then show gate rationale, hard failures, soft failures, evidence sufficiency, and residual limitations.

### 3. Findings and evidence coverage

Each finding must display:

- ID;
- verifier and version;
- category;
- status and severity;
- exact value and display value;
- unit;
- threshold and operator;
- first failure time;
- supporting sequences;
- availability;
- gate consequence.

### 4. Event and action timeline

Show aligned tracks for:

- raw observation;
- delivered observation;
- result observation;
- candidate action;
- permitted action;
- executed action;
- override and fault reasons;
- collision and off-road;
- speed and progress;
- TTC when available;
- simulated latency;
- verifier-triggering events.

Never show `NOT_AVAILABLE` as zero.

### 5. Provenance, integrity, and limitations

Show recorded provenance separately from authenticated origin:

- Hermes version, commit, and dirty state;
- adapter, simulator, version, and commit;
- scenario, gate, policy, shield, and fault versions and digests;
- trace and bundle roots;
- asset-integrity limitation;
- authenticity status;
- authority status `NOT_DEFINED`;
- deployment permission `NONE`.

### 6. Comparison

Show:

- baseline and candidate identities;
- compatibility;
- verdicts;
- hard failures;
- improvements;
- regressions;
- unchanged outcomes;
- evidence-availability deltas;
- source-linked details.

No “better policy” label or aggregate winner.

## Architecture tests

Add an AST or equivalent static test that fails if workbench modules import:

- simulator adapters;
- policies;
- shields;
- faults;
- gates;
- verifier implementations;
- raw artifact parsers outside the approved review facade.

Add a test that review and workbench paths do not import or launch MetaDrive.

## Artifact immutability tests

For every review path:

- hash all source bundle files before review;
- review through CLI, core, and workbench test harness;
- hash after review;
- require byte identity.

Test artifact mutation during review and after cached review. The session must invalidate and refuse stale results.

## Required negative tests

Implement every P0 negative test in `VALIDATION_MATRIX.md`, including:

- symlink escape;
- path traversal;
- directory swap under same path;
- missing companion;
- unsupported or mixed schema;
- malformed, duplicate, or reordered events;
- stored `PASS` plus corrupted trace;
- modified metrics, findings, or verdict;
- XSS payload;
- resource bounds;
- rounding edge;
- `NOT_AVAILABLE` metric;
- incompatible comparison;
- filter or sort cannot change verdict;
- missing trust state;
- non-loopback bind rejection;
- no artifact writes;
- no simulator launch.

## Existing artifact cases

Use retained artifacts when available:

```text
artifacts/handoff-phase5-demo
artifacts/handoff-p1-collision
artifacts/handoff-p1-conditional
artifacts/phase1-tampered
artifacts/handoff-p2-metadrive
artifacts/handoff-p3-lead-baseline
artifacts/handoff-p3-lead-shielded
artifacts/handoff-p3-cutin-baseline
artifacts/handoff-p3-cutin-shielded
artifacts/handoff-p4-fault
```

When absent, generate the minimum fixture through existing CLI commands outside the workbench. Never let the UI generate a run.

## Documentation

Update actual repository documents to match implementation:

- `README.md`;
- `PROJECT_BRIEF.md`;
- `BUILD_PLAN.md`;
- all Phase 6 design docs;
- decision log;
- requirements traceability;
- demo runbook;
- `CODEX_HANDOFF.md`.

Document:

- local launch command;
- optional dependency installation;
- trust-state meanings;
- internal consistency versus authenticity;
- local-only and read-only scope;
- no deployment permission;
- integrity limitations;
- comparison limitations.

## Validation commands

Run and fix:

```bash
python -m pip install -e ".[dev,workbench]"
python -m pytest -q
python -m pytest -q -m "not metadrive"
python -m ruff check .
python -m hermes doctor
git diff --check
```

Run review CLI demonstrations against available PASS, HOLD, CONDITIONAL, INVALID_EVIDENCE, MetaDrive, shield-comparison, and fault artifacts.

Launch the workbench on loopback with no browser and execute the framework-supported smoke or test harness. Do not claim a manual visual result unless actually inspected.

## Local commits

Create only after each gate is green:

```text
feat: add immutable evidence review facade
feat: add local read-only evidence workbench
test: harden workbench trust boundaries
```

Do not push.

## Stop conditions

Stop and report HOLD if:

- a second gate or verifier becomes necessary;
- artifacts must be mutated;
- CLI and UI semantics diverge;
- invalid evidence can show accepted PASS;
- `NOT_AUTHENTICATED` cannot be mandatory;
- the UI needs simulator or policy execution;
- local-only binding cannot be enforced;
- canonical bundle contract remains unresolved;
- current core tests must be weakened;
- deferred scope becomes required.

## Required completion report

Update `CODEX_HANDOFF.md` using the template and report:

1. Architecture and framework decision actually implemented.
2. Files changed and dependencies added.
3. ReviewEnvelope and ComparisonEnvelope versions.
4. Test and Ruff results.
5. Artifact immutability results.
6. PASS, HOLD, CONDITIONAL, and INVALID review examples.
7. Comparison examples and mixed trade-offs.
8. XSS, path, TOCTOU, and resource negative results.
9. Local launcher and bind result.
10. Known limitations.
11. Git status and local commits.
12. Exact next prompt: adversarial review.
