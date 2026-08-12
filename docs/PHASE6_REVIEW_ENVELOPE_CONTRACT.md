# Hermes ReviewEnvelope v1 and ComparisonEnvelope v1 Contract

## 1. Status

This document is the normative Phase 6 review contract after design freeze. Codex must reconcile field names with current typed conventions and record any changes before implementation.

## 2. Design goals

- Immutable representation of recomputed stored verification.
- Framework-independent.
- Suitable for CLI JSON and local UI.
- Explicit trust and evidence semantics.
- Source-linked.
- No simulator rerun.
- No artifact mutation.
- No second gate or verifier.

## 3. ReviewEnvelope v1 top-level shape

Illustrative structure:

```yaml
review_schema_version: "1.0"
review_tool:
  hermes_version: "..."
  hermes_git_commit: "..."
  review_contract_version: "1.0"
review_session:
  generated_at_utc: "..."
  artifact_root_label: "artifacts"
artifact_identity: {}
verification: {}
trust: {}
gate: {}
evidence_sufficiency: {}
findings: []
metrics: []
event_index: {}
provenance: {}
assumptions: []
unavailable_evidence: []
residual_limitations: []
source_inventory: []
```

Review-time fields such as `generated_at_utc` are not part of the source bundle’s deterministic identity.

## 4. Artifact identity

Required fields:

```yaml
run_id: string
relative_artifact_path: string
bundle_digest_sha256: string
trace_digest_sha256: string
creation_time_utc: string | null
source_evidence_schema_version: string
source_scenario_schema_version: string
required_file_inventory:
  - file_name: string
    digest_sha256: string
```

Rules:

- no auto-derived authority from creation time;
- no absolute path in portable JSON by default;
- local diagnostic absolute path may exist only in non-exported runtime state;
- exact bundle digest is the primary source identity.

## 5. Verification

```yaml
status: UNVERIFIED | INTERNALLY_CONSISTENT | INVALID_EVIDENCE
verified_by: string
first_failure:
  code: string | null
  message: string | null
  file: string | null
  event_sequence: integer | null
stored_verdict_quarantined: boolean
```

For invalid evidence:

- `stored_verdict_quarantined` must be true when a stored verdict exists;
- the gate section must not represent the stored claim as accepted;
- recomputed findings or metrics include only safely derived invalidity diagnostics.

## 6. Trust

```yaml
authenticity: NOT_AUTHENTICATED
authorization: NOT_EVALUATED
deployment_permission: NONE
scope: SIMULATION_ONLY
authoritative_status: NOT_DEFINED
```

These fields are mandatory in Phase 6. Missing trust fields are a review-contract error, not an invitation for UI defaults.

## 7. Gate result

```yaml
verdict: PASS | CONDITIONAL | HOLD | INVALID_EVIDENCE
gate_name: string
gate_version: string
gate_config_digest_sha256: string
rationale: string
hard_failure_ids: [string]
soft_failure_ids: [string]
supporting_finding_ids: [string]
residual_limitations: [string]
```

Rules:

- use the recomputed gate result;
- hard failures remain non-compensatory;
- no aggregate winner or “safety score” is introduced;
- invalid evidence supersedes the stored policy verdict for review presentation.

## 8. Evidence sufficiency

```yaml
profile_name: string
profile_version: string
summary:
  required_and_available: integer
  required_but_unavailable: integer
  optional_and_available: integer
  optional_and_unavailable: integer
  not_applicable: integer
items:
  - evidence_id: string
    label: string
    requirement: REQUIRED | OPTIONAL | NOT_APPLICABLE
    availability: AVAILABLE | NOT_AVAILABLE
    reason: string | null
    gate_consequence: string
    source_references: []
```

Requiredness is core-owned. The UI cannot infer or override it.

## 9. Finding model

```yaml
finding_id: string
verifier_name: string
verifier_version: string
category: OBSERVED | COMPUTED | GATE_DECISION | ASSUMPTION | NOT_AVAILABLE | AUTHENTICITY | RESIDUAL_RISK
status: PASS | FAIL | WARN | NOT_AVAILABLE
severity: string
label: string
explanation: string
measured:
  machine_value: number | string | boolean | null
  canonical_text: string | null
  display_text: string
  unit: string | null
threshold:
  operator: string | null
  machine_value: number | string | null
  canonical_text: string | null
  display_text: string | null
first_failure_simulation_time_s: number | null
supporting_event_sequences: [integer]
evidence_availability: AVAILABLE | NOT_AVAILABLE
gate_consequence: string
source_references: []
```

## 10. Metric model

```yaml
metric_id: string
label: string
category: COMPUTED | OBSERVED | NOT_AVAILABLE
machine_value: number | string | boolean | null
canonical_text: string | null
display_text: string
unit: string | null
availability: AVAILABLE | NOT_AVAILABLE
unavailable_reason: string | null
desired_direction: HIGHER | LOWER | TARGET | DESCRIPTIVE | NONE
source_references: []
```

The desired direction must come from existing comparison semantics or a versioned core registry. It must not be guessed by UI.

## 11. Event index and timeline

The envelope may contain an index rather than every raw event.

```yaml
event_count: integer
simulation_start_s: number
simulation_end_s: number
key_sequences: [integer]
tracks:
  - track_id: string
    label: string
    availability: AVAILABLE | NOT_AVAILABLE
    points:
      - sequence: integer
        simulation_time_s: number
        value: number | string | boolean | null
        category: OBSERVED | COMPUTED | NOT_AVAILABLE
        source_reference: {}
```

For large traces, the review API may provide paginated event-detail methods. Pagination must not change envelope verdict or finding semantics.

## 12. Provenance

Separate recorded provenance from authenticated origin.

```yaml
recorded:
  hermes_version: string
  hermes_git_commit: string
  hermes_git_dirty: boolean
  adapter_name: string
  adapter_version: string
  simulator_name: string | null
  simulator_version: string | null
  simulator_source_commit: string | null
  policy_name: string
  policy_version: string
  shield_name: string
  shield_version: string
  fault_profile_name: string | null
  gate_profile_name: string
  scenario_name: string
  scenario_version: string
authenticated_origin:
  status: NOT_AUTHENTICATED
  signer_id: null
  signature_id: null
```

## 13. Source references

```yaml
source_type: MANIFEST | EXECUTION_CONTEXT | SCENARIO | GATE_CONFIG | EVENT | METRIC | FINDING | VERDICT | TRACE_DIGEST | BUNDLE_DIGEST
file_name: string
event_sequences: [integer]
json_pointer: string | null
```

Source references are explanatory links. They do not authorize the UI to reopen unverified raw files outside the captured session.

## 14. Assumptions and residual limitations

Each item:

```yaml
id: string
category: ASSUMPTION | RESIDUAL_RISK
text: string
source_references: []
impact: string
```

Required Phase 6 residual limitations include:

- not authenticated;
- no policy or simulator re-execution;
- simulation-only;
- no deployment permission;
- simulator, asset, or fidelity limitations when applicable.

## 15. Invalid-evidence envelope

An invalid envelope still contains:

- review schema and tool identity;
- artifact locator or identity when safely known;
- verification failure;
- mandatory trust states;
- quarantine state;
- source inventory safely captured;
- residual limitations.

It must not present stored policy findings, metrics, or verdict as accepted recomputation.

## 16. Determinism and canonical JSON

For unchanged bundle bytes and the same Hermes review-contract implementation:

- semantic envelope content should be stable;
- review generation time may differ;
- local path diagnostics may differ and should not enter portable output;
- JSON mode should use deterministic field ordering and serialization when practical.

## 17. Unsupported versions

- Fail closed.
- Return actionable version information.
- Do not silently reinterpret newer schemas.
- No UI migration or repair.

## 18. ComparisonEnvelope v1

Illustrative shape:

```yaml
comparison_schema_version: "1.0"
comparison_tool: {}
baseline_identity: {}
candidate_identity: {}
baseline_verification: {}
candidate_verification: {}
compatibility:
  status: COMPATIBLE | INCOMPATIBLE
  reasons: []
verdict_delta: {}
hard_failure_delta: {}
improvements: []
regressions: []
unchanged: []
evidence_availability_deltas: []
source_references: []
residual_limitations: []
```

## 19. Comparison rules

- Both artifacts independently verify.
- Compatibility uses existing core semantics.
- Invalid evidence returns an invalid result before comparison.
- Incompatible evidence contains no metric-delta or chart payload.
- No winner score.
- Improvements and regressions are both mandatory when present.
- Intervention counts are descriptive.
- Desired direction is core-owned.

## 20. Contract tests

- JSON schema or typed validation.
- Golden PASS, HOLD, CONDITIONAL, and INVALID envelopes.
- Missing trust field rejection.
- Exact numeric threshold cases.
- Source-reference validity.
- Same-bundle semantic repeat.
- Unsupported schema rejection.
- CLI and UI parity.
- Incompatible comparison has no delta payload.
