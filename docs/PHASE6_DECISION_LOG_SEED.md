# Hermes Phase 6 Decision Log Seed

Codex must confirm, amend, or reject each decision during design freeze. Record observed code evidence and rationale.

## D6-001 — Next wave

**Proposed decision:** Build a local, read-only Evidence Review Workbench before scenario expansion or learned-policy work.

**Rationale:** Current evidence is rich enough to demonstrate all verdict classes and mixed trade-offs; reviewer comprehension is the highest product-leverage gap.

## D6-002 — Two-stage execution

**Proposed decision:** Freeze contracts before implementation.

**Rationale:** UI semantics can accidentally become a parallel authority.

## D6-003 — Canonical bundle

**Proposed decision:** Use the current ten-file Phase 5 bundle inventory and correct older seven-file docs.

## D6-004 — Trust-state separation

**Proposed decision:** Gate verdict, integrity, authenticity, authorization, deployment permission, and scope are independent mandatory fields.

## D6-005 — Authenticity

**Proposed decision:** All Phase 6 artifacts remain `NOT_AUTHENTICATED`; signing is design-only.

## D6-006 — Review core

**Proposed decision:** Add framework-independent `ReviewEnvelope v1` and `ComparisonEnvelope v1` facades over the existing verification and compare core.

## D6-007 — UI dependency

**Proposed default:** Streamlit under an optional `workbench` extra, subject to design-freeze evaluation.

**Decision criteria:** local startup, testability, cache control, escaping, accessibility, dependency weight, and review-core independence.

## D6-008 — Local-only

**Proposed decision:** Workbench binds only to loopback and rejects wildcard or non-loopback host.

## D6-009 — Artifact identity

**Proposed decision:** Bundle digest, not path or creation time, is primary identity. Do not auto-select latest.

## D6-010 — Artifact writes

**Proposed decision:** No source-bundle writes, annotations, repair, migration, or normalization.

## D6-011 — Evidence sufficiency

**Proposed decision:** Requiredness is core-owned and versioned; UI only renders it.

## D6-012 — Comparison

**Proposed decision:** No winner score. Mandatory improvements, regressions, unchanged outcomes, and availability deltas.

## D6-013 — Numeric precision

**Proposed decision:** Preserve machine value and display value; show threshold, operator, unit, version, and source.

## D6-014 — Cache

**Proposed decision:** Local in-memory cache keyed by bundle digest, review schema, and tool version; invalidate on mutation.

## D6-015 — Authority

**Proposed decision:** Phase 6 displays `Authoritative status: NOT_DEFINED`.

## D6-016 — Human comprehension

**Proposed decision:** Use a scripted review gate but report only actual participant observations.

## D6-017 — Deferred scope

**Proposed decision:** No signing, approvals, cloud, scenario expansion, RL, CARLA, ROS, or hardware in Phase 6.
