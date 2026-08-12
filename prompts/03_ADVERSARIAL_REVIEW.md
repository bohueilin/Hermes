# Codex Prompt — Adversarial Review of Hermes Phase 6

Act as an independent principal security engineer, safety-evidence reviewer, frontend trust-and-safety reviewer, and skeptical autonomy release owner.

Review the completed Phase 6 implementation. Begin with review and evidence collection. Do not immediately rewrite code.

## Repository

```text
/Users/bohueilin/Documents/GitHub/Hermes
```

## Primary question

> Can the Phase 6 workbench cause a reasonable reviewer to trust, approve, compare, or interpret evidence more strongly than the verified core supports?

## Required review areas

### 1. Parallel-authority risk

Verify that:

- UI does not implement gate logic;
- UI does not implement verifier logic;
- UI does not parse raw artifacts outside the approved facade;
- CLI and UI consume the same immutable envelopes;
- filters, sorting, pagination, or chart transforms cannot change verdict or finding counts.

### 2. Invalid-evidence quarantine

Attempt:

- corrupt trace with stored PASS;
- forged metrics, findings, and verdict;
- missing file;
- mixed schema;
- duplicate or reordered event;
- coherent rehash where the current integrity design permits it.

Confirm that invalid evidence never displays a trusted stored PASS. Confirm the UI states the limitation of coherent full-bundle rewrite.

### 3. Artifact mutation and TOCTOU

Attempt:

- replace a file after verification;
- swap the artifact directory under the same path;
- symlink required files outside the root;
- mutate during capture;
- reuse stale cache after mutation.

Confirm session invalidation and byte immutability.

### 4. Path and local-network boundary

Attempt:

- `..` traversal;
- absolute path outside root;
- symlink escape;
- alternate path aliases;
- public bind `0.0.0.0`;
- IPv6 wildcard `::`;
- non-loopback hostname.

Confirm fail-closed behavior.

### 5. XSS and content injection

Inject artifact-controlled strings containing:

- HTML tags;
- script payloads;
- Markdown links;
- SVG payloads;
- terminal escape sequences;
- extremely long text.

Confirm safe escaping and bounded rendering.

### 6. Trust semantics

Confirm every review exposes separately:

- gate verdict;
- integrity;
- authenticity;
- authorization;
- deployment permission;
- simulation scope.

Search source and UI for prohibited overclaims:

- safe;
- trusted;
- approved;
- certified;
- deployable;
- road-ready;
- Level 4.

Distinguish legitimate explanatory uses from product-state labels.

### 7. Evidence sufficiency

Verify requiredness is produced by the core, not inferred by UI. Test required-but-unavailable, optional-unavailable, and not-applicable cases.

Confirm missing evidence is never displayed as zero.

### 8. Numeric integrity

Test values immediately above and below thresholds. Confirm exact values, operators, units, and verifier versions remain inspectable and rounding does not change apparent pass or fail.

### 9. Comparison integrity

Review lead and cut-in comparisons. Confirm:

- both artifacts independently verify;
- incompatible evidence produces no chart payload;
- TTC improvements and mission or comfort regressions appear together;
- unchanged verdict is visible;
- no winner score exists;
- intervention counts are descriptive only.

### 10. Simulator isolation

Use import tracing, mocks, or architecture tests to prove review and UI paths do not import or launch MetaDrive, FakeSimulatorAdapter, policies, or simulator runtime.

### 11. Resource boundaries

Test oversized or high-event-count artifacts within safe temporary fixtures. Confirm bounded parsing, useful error output, and no silent partial review.

### 12. Accessibility and human factors

Confirm:

- status is not color-only;
- labels are explicit;
- invalid state is primary;
- unavailable evidence is visually distinct;
- source references are navigable;
- no automatic latest artifact is selected;
- local path and digest identity remain visible.

## Required output

Create:

```text
PHASE6_ADVERSARIAL_REVIEW.md
```

Structure:

1. Executive verdict: GO, CONDITIONAL GO, or HOLD.
2. Observed architecture.
3. P0 findings.
4. P1 findings.
5. P2 findings.
6. Reproduction commands.
7. Evidence supporting each finding.
8. Recommended fixes.
9. Tests missing.
10. Residual risk.

## Fix policy

After documenting findings:

- fix validated P0 and P1 issues that stay within Phase 6 scope;
- add regression tests first or alongside the fix;
- do not add authenticity, approval, cloud, scenario, RL, or hardware features;
- rerun full validation;
- update the review with closure status.

Do not push.
