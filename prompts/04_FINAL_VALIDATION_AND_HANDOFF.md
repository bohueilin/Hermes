# Codex Prompt — Hermes Phase 6 Final Validation and Handoff

Finalize Phase 6 after implementation and adversarial review.

## Repository

```text
/Users/bohueilin/Documents/GitHub/Hermes
```

## Preconditions

- `PHASE6_DESIGN_FREEZE_HANDOFF.md` exists.
- `PHASE6_ADVERSARIAL_REVIEW.md` exists.
- No open P0 finding remains.
- Any accepted P1 residual risk is explicit.
- Work remains local; no push or deployment occurred.

## Required validation

Run:

```bash
conda activate hermes-dev
cd /Users/bohueilin/Documents/GitHub/Hermes
python -m pip install -e ".[dev,workbench]"
python -m pytest -q
python -m pytest -q -m "not metadrive"
python -m ruff check .
python -m hermes doctor
git diff --check
```

Run the exact review CLI and workbench cases in `VALIDATION_MATRIX.md`.

Verify:

- PASS artifact;
- CONDITIONAL artifact;
- HOLD artifact;
- INVALID_EVIDENCE artifact;
- MetaDrive artifact;
- lead comparison;
- cut-in comparison;
- fault artifact;
- incompatible comparison;
- XSS fixture;
- path, symlink, and TOCTOU fixtures;
- artifact byte identity;
- loopback-only launch;
- no simulator import or launch.

## Documentation reconciliation

Update actual repository documents:

- `README.md`;
- `PROJECT_BRIEF.md`;
- `BUILD_PLAN.md`;
- Phase 6 architecture, contract, UX, threat, authenticity, and traceability docs;
- decision log;
- demo runbook;
- `CODEX_HANDOFF.md`.

Remove language that implies unauthenticated evidence is trusted, safe, approved, or deployable.

## Demo runbook

The final demo should show:

1. Valid nominal artifact with `Gate verdict: PASS` while authenticity remains `NOT_AUTHENTICATED` and deployment permission remains `NONE`.
2. Collision `HOLD` with supporting event sequence.
3. Tampered `INVALID_EVIDENCE`, with stored PASS quarantined.
4. MetaDrive nominal artifact through the same review envelope.
5. Shield comparison with TTC improvement and mission or comfort regression.
6. Fault artifact where coverage passes but mission causes HOLD.
7. Provenance and integrity page explaining recorded versus authenticated origin.

Do not claim a manual visual review unless it was actually performed.

## Required `CODEX_HANDOFF.md`

Use `CODEX_HANDOFF_TEMPLATE.md` and include actual:

- branch and commit history;
- architecture;
- dependencies;
- commands;
- test counts;
- review envelope examples;
- artifact paths and digests;
- negative-test results;
- local launch command;
- screenshots only when actually captured and stored outside source evidence;
- known limitations;
- Git status;
- next recommendation.

## Final local commit

Create only when all gates pass:

```text
docs: finalize Phase 6 validation and handoff
```

Do not push.

## Final response

Report:

1. Executive verdict.
2. What was implemented.
3. Test and validation results.
4. Demonstrated review cases.
5. Remaining limitations.
6. Local commits.
7. Exact command the user should run to launch the workbench.
8. Recommendation for the next phase: authenticity design review before any multi-user or approval workflow.
