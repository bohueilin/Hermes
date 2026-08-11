# Hermes Unattended Codex Execution Protocol

## Purpose

This protocol is designed for an extended Codex run while the user is unavailable. It prioritizes safe, reversible progress and truthful evidence over breadth.

## Recommended ChatGPT Desktop setup

- Product mode: Codex.
- Environment: Local.
- Primary folder: `/Users/bohueilin/Documents/GitHub/Hermes`.
- Branch: `feat/unattended-evidence-core`.
- Permission boundary: repository-scoped workspace access.
- Network: unnecessary after likely Phase 1 dependencies are preinstalled.
- Full-disk or unrestricted access: not required.

Local mode is recommended for this run because `third_party/metadrive/` is ignored by Git and already installed from the local checkout. A fresh worktree may not include ignored simulator files without additional setup.

## Agent operating model

Codex should behave as four coordinated roles:

1. **Principal implementer** — owns architecture and working code.
2. **Verification lead** — attempts to falsify PASS and INVALID_EVIDENCE behavior.
3. **Simulation integration reviewer** — inspects installed MetaDrive APIs before adapter work.
4. **PM/safety reviewer** — checks ODD, requirements traceability, claims, and residual risk.

When subagents are available, delegate independent reviews. The main agent remains accountable for integration and final validation. When subagents are unavailable, perform the roles sequentially.

## Priority discipline

### P0 — Must complete

- strict scenario schema;
- simulator-neutral contracts;
- deterministic fake adapter;
- policy and no-op shield;
- canonical trace;
- evidence bundle;
- independent verifiers;
- release gate;
- independent artifact verification;
- PASS/HOLD/CONDITIONAL/INVALID demonstrations;
- determinism and tamper tests;
- documentation and handoff.

### P1 — Continue only after P0

- MetaDrive API reconnaissance;
- headless smoke command;
- bounded nominal adapter run;
- accurate provenance;
- independent stored verification.

### P2 — Continue only after P1

- deterministic shield;
- hard-brake and cut-in scenarios;
- explicit override reasons;
- baseline/candidate comparison.

### P3 — Optional hardening

- fault wrappers;
- comparison refinements;
- Make targets;
- CI files;
- demo runbook;
- adversarial review.

### Explicitly deferred

- dashboard;
- RL;
- CARLA;
- ROS 2;
- Autoware;
- hardware-in-the-loop;
- public-road or physical vehicle integration.

## Decision policy

### Make a local assumption when

- the choice is reversible;
- it does not change safety claims;
- it does not expand scope;
- it does not require credentials or external infrastructure;
- tests can reveal whether the choice is wrong.

Examples:

- exact internal filename;
- whether to use dataclass or Pydantic for an internal object;
- test fixture organization;
- deterministic numeric rounding policy, when documented and tested.

### Log a material decision when

- it affects evidence semantics;
- it changes gate precedence;
- it changes schema compatibility;
- it changes simulator interpretation;
- it introduces or removes a dependency;
- it trades fidelity for determinism;
- it changes a user-visible CLI contract.

### Stop the affected action when

- destructive data loss is possible;
- a secret or credential is needed;
- the operation leaves the repository boundary;
- remote publication or deployment is needed;
- physical vehicle control is implicated;
- a false safety claim would result;
- a hard invariant would need to be bypassed.

Continue other safe tasks.

## Phase checkpoint protocol

At the start of each phase:

1. Read the phase requirements.
2. Inspect current implementation and tests.
3. Update `CODEX_HANDOFF.md` with intended scope.
4. Create a focused task list.
5. Run the current green baseline.

During implementation:

- run focused tests frequently;
- keep modules small and boundaries explicit;
- update the decision log as decisions are made;
- keep generated evidence ignored;
- preserve exception cleanup;
- verify negative paths, not only happy paths.

At phase completion:

1. Run full tests.
2. Run Ruff.
3. Run doctor.
4. Run `git diff --check`.
5. Execute the real demo commands.
6. Independently verify artifacts.
7. Run adversarial tamper/determinism checks.
8. Update traceability and handoff.
9. Inspect Git status and diff.
10. Create a local commit only when all gates pass.

## Failure handling

### Test failure

- reproduce with the narrowest test;
- identify whether code or test expectation is wrong;
- fix root cause rather than weakening the assertion;
- rerun focused and full suites;
- record any changed contract.

### MetaDrive failure

- inspect installed 0.4.3 source and examples;
- print/inspect `default_config()`;
- reduce to a bounded smoke case;
- confirm headless mode;
- verify close behavior;
- do not edit MetaDrive source;
- if blocked, preserve Phase 1 and document the exact failure.

### Evidence mismatch

- never patch the stored verdict to match expectations;
- recompute from deterministic events;
- identify which digest or recomputation differs;
- fix canonicalization/provenance semantics;
- add a regression test.

### Nondeterminism

- isolate wall-clock or host-specific data;
- remove it from deterministic trace content;
- seed all supported random sources;
- use explicit numeric normalization;
- document simulator tolerance when exact equality is not feasible.

### Dependency/network blocker

- check whether standard library or an installed dependency is sufficient;
- do not vendor an unreviewed library;
- do not weaken validation to avoid a dependency;
- document the blocker and continue independent work.

## Safe Git behavior

Allowed:

- create/switch feature branch;
- inspect diff/status/log;
- stage reviewed files;
- create local checkpoint commits after green gates.

Forbidden:

- push;
- PR creation;
- force operations;
- reset hard;
- clean destructive;
- rewrite history;
- change remote URLs;
- commit generated evidence or simulator assets.

## Required local commits

Create only when applicable and green:

```text
docs: define unattended Hermes build plan
feat: add deterministic evidence core
feat: add MetaDrive headless adapter
feat: add safety shield and challenge scenarios
docs: add demo runbook and handoff
```

Do not create empty or misleading phase commits.

## Handoff quality bar

The user should be able to return, open `CODEX_HANDOFF.md`, and answer:

- What actually works?
- Which phase is green?
- Which commands reproduce it?
- What evidence was produced?
- What failed and why?
- What local commits exist?
- What is the single next action?

The handoff must never require reconstructing progress from chat history alone.
