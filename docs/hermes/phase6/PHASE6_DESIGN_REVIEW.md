# Hermes Phase 6 Design Review

## 1. Executive verdict

**CONDITIONAL GO**

Begin one tightly scoped next wave:

> **Phase 6 — Read-only Evidence Review Workbench with an explicit trust-state contract.**

Do not begin evidence signing, broad scenario expansion, or learned-policy work in the same implementation wave.

The condition is that the workbench must be a one-way consumer of the existing verification and comparison core. It must not:

- implement a second gate;
- independently recompute findings outside the approved core;
- mutate artifacts;
- launch the simulator;
- run a policy;
- edit thresholds;
- approve promotion;
- imply that a `PASS` verdict means a vehicle is safe or deployable.

A local read-only workbench may precede authenticated evidence only while it is non-authoritative, loopback-only, and permanently labels every current bundle `NOT_AUTHENTICATED`. Multi-user review, official approval, publication, promotion, or externally trusted evidence should remain blocked until a separate authenticity phase.

## 2. Strongest elements of the existing design

### Non-compensatory release semantics

A collision or boundary failure cannot be offset by progress, comfort, or an aggregate score.

### Candidate, permitted, and executed action accountability

Hermes preserves what the policy proposed, what the shield permitted, and what the environment executed.

### Raw, delivered, and result observations

Fault injection distinguishes the source observation, transformed policy input, and resulting environment state.

### Simulator-neutral dependency direction

Domain, evidence, verifier, gate, shield, fault, and comparison layers remain independent of MetaDrive runtime.

### Explicit unavailable evidence

Unsupported signals are `NOT_AVAILABLE`, not synthesized as zero or pass.

### Determinism as a product feature

Deterministic companion evidence is separated from run identity and wall-clock metadata.

### Adversarial contract coverage

The current design tests coherent rehash, mixed schemas, missing findings, malformed events, false-pass paths, and comparison-envelope correctness.

### Claim discipline

The cut-in is labeled scripted, shield outcomes are reported as mixed, cross-platform determinism is not claimed, and local hashing is not called authenticated evidence.

## 3. Critical findings

### P0.1 — “Trust” is not one state

Hermes must keep separate:

1. recorded behavior;
2. internal consistency;
3. authenticity;
4. provenance;
5. authorization;
6. advancement or deployment permission.

Phase 6 implements or exposes the first two. Current values for the others remain:

```text
Evidence authenticity: NOT_AUTHENTICATED
Authorization status: NOT_EVALUATED
Deployment permission: NONE
Scope: SIMULATION_ONLY
```

### P0.2 — A coherent bundle can still be false

Local hashes do not prevent a complete rewrite and rehash. Stored verification also does not rerun the policy or simulator. The workbench must say:

```text
Internally consistent with stored evidence
```

not:

```text
Execution independently verified
```

### P0.3 — UI can become a parallel authority

Primary risks:

- UI-specific gate logic;
- chart-derived verdict;
- direct artifact parsing after verification;
- stale cached result;
- duplicated comparison logic;
- hidden unavailable evidence.

Mitigation: one immutable review envelope produced by the existing core.

### P0.4 — Bundle documentation drift

Some older documents list seven files, while the completed Phase 5 contract has ten. Freeze one canonical inventory before building a second consumer.

### P1.1 — Gate sufficiency is configuration-dependent

A technically valid gate can operate with unavailable optional evidence. The review surface should show required versus available evidence without silently changing verdict semantics.

### P1.2 — Comparison can be mistaken for winner selection

The reported shield runs improved minimum TTC while route completion, acceleration, and jerk regressed and verdicts did not improve. The UI must show multidirectional trade-offs, not “shielded is better.”

### P1.3 — Provenance is recorded but unauthenticated

Commits, versions, configurations, and digests are useful recorded provenance. They are not independently verified origin.

### P1.4 — Authority and supersession are undefined

Do not auto-select “latest.” Show exact run ID, path, digests, commit, creation time, and:

```text
Authoritative status: NOT_DEFINED
```

### P1.5 — Numeric presentation can change perceived evidence

Preserve exact value, display value, unit, threshold, operator, verifier version, and source event.

### P2

- limited scenario breadth;
- no learned policy;
- no authenticated signing;
- no human approval workflow;
- no remote CI result;
- no cross-platform deterministic claim;
- no photorealistic replay.

These are later-phase concerns, not Phase 6 blockers.

## 4. Option decision matrix

| Option | Immediate product value | Integrity leverage | Architecture leverage | Delivery complexity | False-confidence risk | Order |
|---|---:|---:|---:|---:|---:|---:|
| Read-only workbench | 5 | 3 | 5 | 3 | 3, controllable | 1 |
| Evidence authenticity | 3 | 5 | 4 | 4 | 2 | 2 |
| Scenario expansion | 3 | 2 | 3 | 3 | 3 | 3 |
| Learned policy | 4 | 2 | 3 | 5 | 5 | 4 |

## 5. Recommended next wave

### Product objective

Enable a reviewer to answer, from stored evidence only:

1. What was tested?
2. What happened?
3. What did the policy propose, permit, and execute?
4. Which requirements passed, failed, or lacked evidence?
5. Why did the gate issue its verdict?
6. Is the artifact internally consistent?
7. Is the artifact authenticated?
8. What does the result not establish?
9. How does a candidate differ from a compatible baseline?

### Smallest useful scope

1. Review one artifact.
2. Compare two compatible artifacts.
3. Drill from a finding or metric to supporting event sequences.

### Explicitly excluded

- run controls;
- simulator playback;
- threshold editing;
- gate editing;
- comments or approvals;
- signing;
- cloud upload;
- user accounts;
- remote sharing;
- artifact mutation.

## 6. Architecture

```text
Untrusted artifact directory
→ read-only no-follow snapshot
→ existing stored verification
→ immutable ReviewEnvelope
→ presentation projection
→ local read-only UI
```

Comparison:

```text
Artifact A → verify ┐
                    ├→ existing compatibility and compare core
Artifact B → verify ┘
                              ↓
                   ComparisonEnvelope
                              ↓
                       read-only UI
```

## 7. Trust model

Current trusted computing base:

- local host;
- installed Hermes verifier;
- selected repository checkout;
- existing schema, verifier, and gate implementation.

Untrusted:

- artifact path;
- artifact content;
- artifact producer;
- artifact labels;
- user assumption that newest means authoritative.

## 8. Product and UX information architecture

### Artifact intake

Show exact artifact identity, verification state, schema support, bundle digest, authenticity, and simulation boundary.

### Review summary

Show:

- gate verdict;
- internal consistency;
- authenticity;
- authorization;
- deployment permission;
- scope;
- rationale;
- hard and soft failures;
- evidence sufficiency;
- residual limitations.

### Findings

Show verifier/version, evidence category, status, severity, exact value, threshold/operator, first failure, source sequences, and gate consequence.

### Timeline

Show raw, delivered, and result observations plus candidate, permitted, and executed actions, fault and shield reasons, safety facts, progress, TTC, latency, and finding events.

### Provenance

Show recorded code, simulator, scenario, policy, shield, fault, gate, and digest identity, while separating authenticated origin.

### Comparison

Show improvements, regressions, unchanged outcomes, and evidence-availability deltas. No winner.

## 9. Evidence categories

Every displayed item is classified:

- `OBSERVED`
- `COMPUTED`
- `GATE_DECISION`
- `ASSUMPTION`
- `NOT_AVAILABLE`
- `AUTHENTICITY`
- `RESIDUAL_RISK`

## 10. Preventing parallel authority

1. One verification entry point.
2. One comparison entry point.
3. Immutable review envelope.
4. UI dependency restrictions.
5. No artifact writes.
6. Digest-bound sessions.
7. CLI and UI parity tests.
8. No approval control.
9. No threshold editing.
10. No simulator execution.
11. Invalid-artifact quarantine.
12. Static architecture test.

## 11. Future authenticity design

Design now, implement later:

- detached Ed25519 signature;
- canonical attestation over bundle digest, manifest digest, schema version, repository identity, commit, signer, scope, and signing time;
- private key in Keychain or hardware-backed storage;
- independent trust policy;
- rotation and revocation;
- signature state separate from authorization and deployment permission.

## 12. Acceptance gates

### Architecture

- one canonical review schema;
- one bundle inventory;
- existing core remains source of truth;
- UI imports only review layer;
- artifact bytes unchanged;
- no simulator launch;
- existing tests and Ruff remain green.

### Trust and semantics

- integrity separate from verdict;
- mandatory `NOT_AUTHENTICATED`;
- deployment permission `NONE`;
- invalid artifact never shows accepted PASS;
- missing evidence never zero;
- evidence categories visible;
- evidence sufficiency visible;
- simulation-only persistent.

### Functional

Correctly review:

- fake PASS;
- collision HOLD;
- boundary HOLD;
- soft CONDITIONAL;
- tampered INVALID;
- MetaDrive PASS;
- lead comparison;
- cut-in comparison;
- deterministic fault HOLD.

## 13. Required negative tests

- mutation after verification;
- directory swap under same path;
- symlink escape;
- traversal;
- missing companion;
- unsupported or mixed schema;
- malicious HTML or JavaScript;
- oversized events;
- duplicate or reordered events;
- corrupt trace plus stored PASS;
- incompatible comparison;
- threshold rounding;
- unavailable TTC;
- filter or sort cannot alter verdict;
- artifact write attempt;
- missing authenticity field;
- stale artifact;
- mixed-trade-off comparison.

## 14. Stop conditions

Stop if:

- UI must mutate evidence;
- UI implements a second gate or verifier;
- CLI and UI diverge;
- invalid evidence can display authoritative PASS;
- authentication is implied;
- simulator execution becomes required;
- immutable capture cannot be maintained;
- canonical bundle remains unresolved;
- a remote or multi-user deployment is proposed;
- scope expands to scenarios, RL, or hardware;
- verdict cannot be separated from deployment permission.

## 15. Phased implementation

### Phase 6.0 — contract freeze

- canonical bundle;
- trust vocabulary;
- review schemas;
- evidence sufficiency;
- framework decision;
- acceptance and threat model.

### Phase 6.1 — review facade

- artifact snapshot and verification facade;
- review and comparison envelopes;
- CLI JSON and text;
- parity tests.

### Phase 6.2 — minimal local workbench

- artifact intake;
- summary;
- findings;
- provenance;
- event drill-down.

### Phase 6.3 — compatible comparison

- independent verification;
- compatibility;
- mixed trade-offs;
- no winner.

### Phase 6.4 — adversarial and human-factors hardening

- stale cache;
- TOCTOU;
- XSS;
- resource bounds;
- numeric precision;
- prohibited-language scan;
- comprehension script.

### Phase 6.5 — authenticity design gate

Decide signer, key custody, trust policy, rotation, revocation, and first signing environment. Do not implement it inside Phase 6.

## 16. Product narrative

Hermes becomes more compelling by demonstrating:

1. nominal internally consistent PASS;
2. hard failure HOLD;
3. tamper INVALID;
4. same contract across MetaDrive;
5. runtime intervention accountability;
6. mixed trade-off honesty;
7. fault coverage plus mission failure;
8. mandatory unauthenticated and no-deployment labels.

## Recommendation

Freeze the contract first, then build a framework-independent review facade, then add a local read-only workbench. Run an independent adversarial review before declaring Phase 6 complete.
