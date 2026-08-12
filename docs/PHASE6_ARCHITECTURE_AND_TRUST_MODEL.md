# Hermes Phase 6 Architecture and Trust Model

## 1. Architectural objective

Add reviewer comprehension without adding a second evidence authority.

## 2. One-way data flow

```text
Untrusted local artifact path
        │
        ▼
Artifact-root containment
        │
        ▼
No-follow immutable capture
        │
        ▼
Existing stored verification
        │
        ├── schema validation
        ├── digest validation
        ├── event semantics
        ├── recomputed metrics and findings
        ├── recomputed gate verdict
        └── evidence availability
        │
        ▼
ReviewEnvelope v1
        │
        ├── review CLI
        └── presentation projection
                   │
                   ▼
           local read-only UI
```

## 3. Trust boundaries

### Boundary A — filesystem path to artifact capture

Artifact paths and contents are untrusted.

Controls:

- allowed artifact root;
- canonical containment;
- no-follow file descriptors;
- directory-relative opens;
- mutation detection;
- file inventory and bounds;
- no writes.

### Boundary B — artifact bytes to stored verifier

The verifier is trusted code running on a trusted local host. Artifact inputs may be malformed or malicious.

Controls:

- strict schema versions;
- fail-closed parsing;
- sequence continuity;
- digest and semantic replay;
- bounded resources;
- explicit invalid evidence.

### Boundary C — verifier result to review envelope

The review assembler must preserve semantics exactly.

Controls:

- typed immutable models;
- schema version;
- golden parity tests;
- source references;
- no UI formatting in the core result.

### Boundary D — review envelope to UI

The UI is not trusted to decide evidence semantics.

Controls:

- no gate or verifier imports;
- no raw artifact access;
- exact values plus display values;
- mandatory trust strip;
- escaped content;
- digest-keyed state.

### Boundary E — UI to reviewer

The reviewer can be misled by color, labels, ordering, rounding, or omitted limitations.

Controls:

- explicit language;
- no generic green trust state;
- no winner score;
- limitations persistent;
- unavailable evidence visible;
- source drill-down.

## 4. Trust-state model

### Gate verdict

A recomputed policy advancement result under the installed Hermes gate.

### Evidence integrity

Whether the stored bundle is internally consistent under the installed verifier.

### Evidence authenticity

Whether an independently trusted identity signed the bundle. Phase 6 value: `NOT_AUTHENTICATED`.

### Authorization

Whether the signer or reviewer was authorized to approve a specific action. Phase 6 value: `NOT_EVALUATED`.

### Deployment permission

Whether a real system may be deployed. Phase 6 value: `NONE`.

### Scope

Evidence domain. Phase 6 value: `SIMULATION_ONLY`.

## 5. Component boundaries

### Review facade

Inputs:

- artifact directory;
- allowed root;
- review options.

Outputs:

- `ReviewEnvelope v1`.

Dependencies:

- existing artifact capture;
- existing stored verification;
- schema and version registry;
- review models.

Forbidden:

- UI framework;
- simulator;
- policy;
- artifact write.

### Comparison facade

Inputs:

- two verified artifacts or review identities.

Outputs:

- `ComparisonEnvelope v1`.

Dependencies:

- existing compatibility and compare core.

Forbidden:

- winner score;
- UI-specific metric selection;
- comparing invalid or incompatible artifacts.

### Presentation projection

Converts the envelope to view-ready groups, timeline points, labels, and display precision.

Forbidden:

- changing status, verdict, threshold, or source relationship.

### Workbench

Renders projection only.

Forbidden:

- raw file parsing;
- gate or verifier imports;
- simulator or policy launch;
- artifact mutation;
- approval actions.

## 6. Dependency rule

Allowed:

```text
workbench → review → existing verification, comparison, and domain models
```

Forbidden:

```text
workbench → gates
workbench → verifiers
workbench → adapters
workbench → policies
workbench → shields
workbench → faults
workbench → evidence raw parsers
review → workbench framework
```

Enforce with an AST or import-graph test.

## 7. Artifact snapshot and cache identity

A path is a locator, not an identity.

Review identity should include:

```text
bundle digest
trace digest
review schema version
Hermes review tool version
```

Cache:

- local in-memory preferred;
- keyed by the identity above;
- invalidated after file stat or digest change;
- never keyed by path alone;
- no persistent database in Phase 6.

## 8. Evidence sufficiency

The review core exposes requiredness. The UI only renders it.

```text
required_and_available
required_but_unavailable
optional_and_available
optional_and_unavailable
not_applicable
```

Requiredness must be derived from versioned gate or verifier profile data.

## 9. Error and invalid-state architecture

### Configuration or path error

- exit 40;
- no review envelope claiming evidence status unless the approved contract defines an operational envelope;
- actionable reason.

### Invalid evidence

- exit 30;
- integrity `INVALID_EVIDENCE`;
- stored verdict quarantined;
- first mismatch or failure when available;
- authenticity remains not authenticated;
- no accepted findings from forged companion files.

### Incompatible comparison

- exit 40;
- compatibility reasons;
- no delta or chart payload.

## 10. Local network model

- loopback bind only;
- no TLS or accounts in local Phase 6;
- no remote access;
- no upload;
- no telemetry;
- no external API.

A multi-user service is a separate architecture requiring authentication, authorization, signing or trust policy, persistence, audit, and threat review.

## 11. Residual trust limitations

Even after Phase 6:

- a coherent bundle author can rewrite and rehash evidence;
- stored policy or simulator facts are not re-executed;
- provenance is recorded, not authenticated;
- simulation fidelity remains constrained;
- `PASS` grants no physical deployment permission.
