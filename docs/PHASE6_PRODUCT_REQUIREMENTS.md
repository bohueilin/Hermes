# Hermes Phase 6 Product Requirements

## 1. Purpose

Define the product requirements for a local, read-only Evidence Review Workbench that makes existing Hermes simulation evidence understandable without weakening its verifier, gate, integrity, or provenance boundaries.

## 2. Decision

**CONDITIONAL GO** for implementation after design freeze.

## 3. Primary personas

### Autonomy product or release leader

Needs a concise, defensible advancement narrative with explicit hard failures, trade-offs, unavailable evidence, and residual risk.

### Safety reviewer

Needs requirement-level findings, source events, gate precedence, evidence sufficiency, and integrity versus authenticity separation.

### Simulation or autonomy engineer

Needs exact scenario, policy, shield, fault, and simulator provenance, timelines, candidate, permitted, and executed actions, and reproducible failure references.

### Developer-infrastructure owner

Needs schema and version identity, artifact digests, deterministic versus review-time separation, validation errors, and comparison compatibility.

## 4. Jobs to be done

1. Review one exact artifact.
2. Determine whether it is internally consistent.
3. Understand the recomputed gate verdict.
4. Identify hard, soft, warning, and unavailable findings.
5. Inspect evidence requiredness and coverage.
6. Drill to source events.
7. Inspect runtime interventions and fault transforms.
8. Compare compatible baseline and candidate artifacts.
9. Understand provenance and limitations.
10. Avoid interpreting the result as authenticated or deployable.

## 5. P0 functional requirements

| ID | Requirement |
|---|---|
| P6-F-001 | Select an exact artifact under an allowed local root without auto-selecting “latest.” |
| P6-F-002 | Capture artifact through the existing no-follow immutable verification path. |
| P6-F-003 | Produce `ReviewEnvelope v1` from recomputed stored verification. |
| P6-F-004 | Preserve gate verdict, integrity, authenticity, authorization, permission, and scope as separate fields. |
| P6-F-005 | Quarantine stored verdict and findings when evidence is invalid. |
| P6-F-006 | Expose hard and soft findings, rationale, supporting event sequences, and gate consequence. |
| P6-F-007 | Expose evidence sufficiency from core-owned requiredness. |
| P6-F-008 | Expose exact metric values, units, thresholds, operators, and display precision. |
| P6-F-009 | Expose recorded provenance separately from authenticated origin. |
| P6-F-010 | Review CLI emits canonical JSON and readable text. |
| P6-F-011 | Compare two independently verified compatible artifacts through the existing compare core. |
| P6-F-012 | Workbench displays PASS, CONDITIONAL, HOLD, and INVALID evidence. |
| P6-F-013 | Workbench displays candidate, permitted, and executed actions over time. |
| P6-F-014 | Workbench displays raw, delivered, and result observations when the evidence schema supports them. |
| P6-F-015 | Workbench remains read-only and local-only. |

## 6. P0 trust and safety requirements

| ID | Requirement |
|---|---|
| P6-T-001 | Every current artifact displays `NOT_AUTHENTICATED`. |
| P6-T-002 | Every view displays `SIMULATION_ONLY` and deployment permission `NONE`. |
| P6-T-003 | `PASS` is labeled `Gate verdict: PASS`, never generic “safe,” “trusted,” or “approved.” |
| P6-T-004 | UI does not implement gate or verifier logic. |
| P6-T-005 | UI does not parse raw artifacts outside the review facade. |
| P6-T-006 | Review does not launch simulator or policy. |
| P6-T-007 | Review changes zero source artifact bytes. |
| P6-T-008 | Artifact mutation invalidates cached or reviewed state. |
| P6-T-009 | Public network bind is rejected. |
| P6-T-010 | Artifact-controlled content cannot execute HTML or script. |
| P6-T-011 | Missing evidence is never presented as zero. |
| P6-T-012 | Incompatible comparisons produce no misleading charts. |
| P6-T-013 | No winner score is produced. |
| P6-T-014 | Exact identity and digests remain visible. |

## 7. P1 requirements

| ID | Requirement |
|---|---|
| P6-P1-001 | Event timeline supports filtering and drill-down without altering verdict semantics. |
| P6-P1-002 | Review envelope can be exported as JSON without absolute local path leakage. |
| P6-P1-003 | Source references identify files and event sequences. |
| P6-P1-004 | Resource limits are configurable and documented. |
| P6-P1-005 | Accessibility does not rely on color alone. |
| P6-P1-006 | Review state is deterministic for an unchanged bundle and tool version. |
| P6-P1-007 | Human-comprehension walkthrough is documented. |

## 8. Non-functional requirements

### Correctness

- Same verified artifact and tool version produce semantically identical envelope.
- CLI and UI values match exactly.
- Existing gate and verifier semantics remain unchanged.

### Security

- Path containment.
- No-follow capture.
- TOCTOU rejection.
- XSS-safe rendering.
- Resource bounds.
- Loopback only.

### Performance

- Current retained artifacts review interactively on the development machine.
- Large inputs fail safely or stream within documented limits.
- No simulator startup cost.

### Maintainability

- UI framework optional.
- Review core testable without UI.
- Versioned schemas.
- Import boundary enforced.

## 9. Product language requirements

Approved examples:

```text
Gate verdict: PASS
Evidence integrity: INTERNALLY_CONSISTENT
Evidence authenticity: NOT_AUTHENTICATED
Authorization status: NOT_EVALUATED
Deployment permission: NONE
Scope: SIMULATION_ONLY
```

Prohibited state labels:

```text
Safe
Trusted
Approved
Certified
Road-ready
Deployable
Level 4
```

## 10. Success criteria

- P0 requirements implemented and tested.
- No open P0 adversarial finding.
- Existing suite remains green.
- Representative PASS, CONDITIONAL, HOLD, INVALID, MetaDrive, and fault artifacts review correctly.
- Lead and cut-in comparisons remain mixed-trade-off reports.
- Artifact immutability proven.
- Local-only launch proven.
- Workbench contains no write or approval path.
