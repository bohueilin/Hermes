# Hermes Phase 6 Threat Model

## 1. Scope, assets, actors, and boundaries

Scope is local, read-only review of stored Hermes simulation artifacts. Assets are source bytes,
captured identity/digests, recomputed decisions, independent trust labels, envelopes, reviewer
understanding, filesystem containment, and existing verifier/gate semantics. Actors include an
honest reviewer, mistaken or malicious producer, stale-evidence selector, content attacker, and
developer who duplicates semantics. A compromised host/verifier is outside assurance.

Boundaries are selection to allowed-root containment; entries to no-follow capture; captured bytes
to existing verifier/compare core; core results to immutable envelope/projection; safe projection
to local Streamlit; and rendered semantics to reviewer interpretation.

Classification is exact: P0 can create a false accepted result, corrupt evidence, cross a security/
network boundary, or violate a non-negotiable authority boundary; P1 can materially mislead or deny
review without directly accepting false evidence; P2 is residual comprehension/assurance debt.
Implementation HOLD applies when any P0 lacks prevention, fail-closed behavior, and an automated
test.

## 2. Threat register

| ID | Class | Threat | Prevention | Detection | Fail behavior | Required test | Residual risk |
|---|---|---|---|---|---|---|---|
| T01 | P0 | Traversal/absolute path escape | Resolve non-symlink root; reject absolute/parent selections | Path unit tests | Exit 40; no capture | parent/sibling/absolute/encoded cases | Compromised process |
| T02 | P0 | Symlink root/directory/file escape | O_NOFOLLOW directory-relative opens | Symlink fixtures | Exit 40 selection or core INVALID / 30 | root, directory, ten file cases | Platform primitive availability |
| T03 | P0 | File mutates during capture | Descriptor double read + metadata identity | Injected race | Core INVALID / 30 | byte/size/mtime mutation | Privileged host |
| T04 | P0 | Entry/directory replacement | Inventory and fstat/stat identity checks | Swap race | Core INVALID / 30 | inode and directory swap | Kernel/filesystem defect |
| T05 | P0 | Stale cache at same path | Locator-bound digest key; full recapture/verify before every cached render | Replacement tests | Invalidate session/projection | same path different bytes | Cache defect |
| T06 | P0 | Invalid stored PASS accepted | Verify before projection; quarantine | phase1-tampered | INVALID_EVIDENCE / 30 | corrupt stored PASS | Coherent rewrite |
| T07 | P1 | Coherent full-bundle forgery | Mandatory NOT_AUTHENTICATED; no consequence control | Not locally detectable | Internally consistent only | coherent rehash retains trust labels | Future signature |
| T08 | P1 | False policy/simulator facts treated as replayed | Persistent no-reexecution limitation | Content/comprehension tests | No origin/deployment claim | limitation every view | Attestation/reexecution deferred |
| T09 | P0 | UI duplicates gate/verifier | Public review API only; AST boundary | Import/parity tests | CI fail/HOLD | AST and golden fixtures | Shared-core defect |
| T10 | P0 | CLI/UI divergence | Same envelope/projection | Golden render tests | CI fail/HOLD | four verdict classes | Framework defect |
| T11 | P0 | UI infers requiredness | Versioned core profile metadata | Profile tests | REVIEW_UNAVAILABLE / 40 | legacy/fault five-state cases | Profile policy defect |
| T12 | P0 | Missing evidence shown as zero/success | Typed NOT_AVAILABLE | Projection tests | Explicit unavailable/gap | TTC/jerk/progress | Reviewer discounts gap |
| T13 | P0 | Schema-1 fields inferred | Contracted unavailable tracks | v1/v2 golden tests | Explicit NOT_AVAILABLE | action/observation tracks | Legacy evidence coarse |
| T14 | P0 | UI parses threshold/decides result | Exact core threshold registry | AST/parity tests | REVIEW_UNAVAILABLE / 40 | all seven findings | Registry defect |
| T15 | P1 | Rounding reverses threshold relation | Full ExactValue; adaptive display precision | Edge fixtures | Show exact value/operator | below/equal/above/noise | Human misread |
| T16 | P0 | XSS/Markdown/control injection | Safe text APIs; no raw HTML; projection truncation only | Payload render tests | Inert visible text | script/img/javascript/SVG/ANSI | Framework vulnerability |
| T17 | P0 | Malformed/oversized artifact exhausts verifier | Existing 16 MiB/file, 64 MiB total, 10k event, 1 MiB/line core ceilings | Existing boundary tests | Core INVALID / 30 | each core limit +1 | DoS within limits |
| T18 | P1 | Core-valid shape cannot be represented | 64 finding/metric and depth-16 envelope budgets | Shape boundary tests | REVIEW_UNAVAILABLE / UNSUPPORTED_REVIEW_SHAPE / 40; no envelope | each shape limit +1 | Review denial only |
| T19 | P1 | Long text hides content | Full portable value; projection truncates after 1,024 with marker/length | Projection tests | Preserve source/full value | 1,024 and 1,025 scalars | Reviewer may not expand |
| T20 | P0 | Timeline semantic decimation | Portable all <=10k events; deterministic pagination | Count parity | REVIEW_UNAVAILABLE if envelope construction fails | 10k events and pagination | Rendering cost |
| T21 | P0 | Comparison skips independent verification | Verify both before compare_artifacts | Invalid+valid tests | Exit 30; no ComparisonEnvelope | both side permutations | Verification defect |
| T22 | P0 | Incompatible comparison charts/ranks | Compatibility first | Mismatch fixtures | Exit 40; no deltas/arrays/charts | scenario/gate/fault/repo mismatch | Compatibility defect |
| T23 | P1 | Comparison hides regression | One-to-one core mapping/partition | Lead/cut-in goldens | CI failure | TTC better + route/comfort worse | Reviewer cherry-picking |
| T24 | P0 | Winner/score compensates hard failure | No score/winner fields | Recursive forbidden-key test | Contract rejection | schema/content scan | Reviewer forms own view |
| T25 | P1 | Intervention count ranked | DESCRIPTIVE / NOT_COMPARABLE | Pair goldens | Descriptive only | 0→36 and 0→3 | Reviewer overinterprets |
| T26 | P0 | Recorded provenance appears authenticated | Separate records/categories | Content tests | NOT_AUTHENTICATED | provenance golden | User ignores label |
| T27 | P0 | PASS implies deployment authority | Mandatory trust records | Comprehension/content tests | PASS remains prototype; permission NONE | prohibited-language scan | User ignores warning |
| T28 | P1 | Newest artifact appears authoritative | Exact selection; NOT_DEFINED | Selection tests | No auto-selection | multiple artifacts | User chooses stale |
| T29 | P0 | Source drill-down reopens changed path | Captured snapshot references; full recapture before cached render | Mutation tests | Invalidate session | mutate then drill | In-memory corruption |
| T30 | P0 | Workbench writes artifact | No write API/control; read-only capture | Before/after hashes | CI fail/HOLD | all views/cache | Temp files outside root |
| T31 | P0 | Review imports/launches runtime | Lazy CLI imports + boundaries | Import bombs | CI fail/HOLD | adapters/policies/runtime/metadrive | Unrelated process |
| T32 | P0 | Public/LAN bind | ipaddress numeric loopback only | Host/socket tests | Exit 40 | 127/8, ::1; wildcard/hostname/LAN/public | Other local process |
| T33 | P1 | Telemetry/external asset leak | gatherUsageStats false; no remote dependencies | Config/network-deny tests | Startup/test failure | denied egress launch | Supply chain |
| T34 | P1 | Directory/manifest run ID mismatch hidden | Show selected locator and manifest identity separately | phase1-tampered | Preserve mismatch | phase1-tampered vs phase1-nominal | User confusion |

## 3. Resource and availability boundary

Only existing stored verification decides integrity: 16 MiB per required file, 64 MiB total,
10,000 events, and 1 MiB per event line. Review never passes stricter limits into capture/parser.

Review structural budgets are operational: 64 findings, 64 metric items, generated model depth 16,
and projection display truncation after 1,024 Unicode scalars. A core-valid unsupported shape is
REVIEW_UNAVAILABLE / UNSUPPORTED_REVIEW_SHAPE / exit 40 with no portable envelope and no change to
gate/integrity. The portable timeline retains all core-valid events; UI pagination cannot hide
total counts.

## 4. Required trust statements

Gate verdict, integrity, NOT_AUTHENTICATED, NOT_EVALUATED, deployment NONE, SIMULATION_ONLY, and
authoritative NOT_DEFINED remain separate. A Hermes PASS is only a prototype gate verdict.
Internal consistency is not authenticity. Stored verification does not reexecute policy/simulator.
SHA-256 is tamper-evident, not authenticated. Simulation evidence grants no physical permission.

## 5. Unresolved-P0 audit

Design-level unresolved P0: none after the corrected portable contract, resource-authority split,
threshold/consequence registry, comparison mapping, and cache recapture rule. Stage 6B remains
CONDITIONAL GO until every P0 row has its specified automated regression. Any missing or failing P0
test returns implementation to HOLD.

## 6. Implementation and adversarial disposition

At implementation checkpoint `90fb7d8`, the full adversarial review returned `GO`: no P0 was
reproduced and no P0 or P1 remains open. The complete suite and the non-MetaDrive-selected suite
each passed 720 tests; the focused Phase 6 adversarial matrix passed 488 tests. Ruff and diff checks
were clean. Automated remediation did not launch a simulator, policy, server, or browser and did
not change artifact bytes.

| Finding | Threat rows | Initial severity | Final disposition |
|---|---|---:|---|
| C6-01 mutable normative gate/review registries | T09, T14 | P1 | Closed: outer/nested mappings and sets reject mutation without changing values or order. Deliberate module rebinding by compromised in-process code remains outside assurance. |
| C6-02 malformed implicit YAML scalar escapes verification | T17 | P1 | Closed: bounded scenario/gate parse `ValueError` becomes a fixed diagnostic and quarantined `INVALID_EVIDENCE`. |
| C6-03 finite extreme trace overflows derived metric | T15, T17 | P1 | Closed: artifact-derived arithmetic/Pydantic validation failure becomes a fixed diagnostic and quarantined `INVALID_EVIDENCE`; programmer-control exceptions remain visible. |
| C6-05 invisible/bounded terminal-text gap | T16, T19 | P1 | Closed: every Unicode `Cc`/`Cf` control is visible, text scalars stop at 1,024 input scalars with loss metadata, mapping-key collisions preserve count/order, and canonical JSON stays exact. |
| C6-06 drill-down state survives artifact switch | T28 | P2 | Closed: explicit Verify resets the event-inspection flag and sequence before rendering the new fresh review. |

T16 remains P0 for executable HTML/script or a crossed renderer boundary. C6-05 was calibrated P1
because it could materially deceive a terminal reviewer but did not execute content, alter the
immutable envelope, or create a false accepted core result.

Likewise, T09/T14/T17 retain their P0 classification for a false accepted result or a broader
authority/resource failure. The reproduced C6-01/02/03 subcases were P1 because they required
already executing in-process code outside artifact assurance or denied one explicit local review
without accepting false evidence.

## 7. Accepted Phase 6 residual

C6-04 remains accepted P2 availability debt: the process-lifetime facade `_cache` and `_active`
maps are unbounded. A 43-explicit-selection probe produced 41 cached envelopes, 43 active sessions,
and about 251 MB peak resident memory. There is no discovery or automatic loading; each selection
requires local reviewer action, every render still recaptures/verifies, and process restart fully
recovers memory. A deterministic synchronized LRU is required before materially increasing the
single-user artifact scale.

This residual does not weaken T01-T06 containment/integrity controls, does not change a verdict,
does not expose an accepted stored PASS after invalidity, and does not alter the Phase 6
`NOT_AUTHENTICATED` / `NOT_EVALUATED` / `NONE` / `SIMULATION_ONLY` boundary.
