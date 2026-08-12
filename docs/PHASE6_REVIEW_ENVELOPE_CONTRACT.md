# Hermes Portable Review Contracts 1.0

## 1. Normative status and invariants

This is the exact implementation contract for portable ReviewEnvelope 1.0 and
ComparisonEnvelope 1.0. Every model is strict, frozen, finite-number-only, rejects unknown fields,
and requires every field listed below. A field is nullable only where its type explicitly includes
null. There are no implicit defaults. Arrays preserve the ordering stated here and reject duplicate
stable IDs or duplicate source references.

Portable canonical JSON uses UTF-8, sorted object keys, compact separators, canonical finite
numbers, and one trailing newline at CLI emission. For the same captured bytes, selected relative
path, Hermes version, and review schema, the portable envelope is byte-identical regardless of
inode or touched filesystem timestamps. Copying identical bytes to another selected relative path
intentionally produces a different locator-bound envelope.

The workbench consumes verified stored evidence. It is not a verifier, gate, simulator, policy
runtime, artifact editor, approval system, or deployment authority.

## 2. Portable versus non-exported session state

### 2.1 Non-exported CaptureIdentity

CaptureIdentity is owned by review.facade, never serialized, and contains ordered
CaptureFileIdentity records:

| Field | Type | Rule |
|---|---|---|
| file_name | ArtifactFileName | Canonical inventory order |
| device | integer | Non-negative |
| inode | integer | Non-negative |
| mode | integer | Non-negative |
| size_bytes | integer | Non-negative |
| mtime_ns | integer | Non-negative |
| ctime_ns | integer | Non-negative |
| observed_sha256 | Sha256 | From captured bytes |

The allowed absolute root remains non-exported runtime configuration. selected_relative_path and
selected_directory_name are explicit OBSERVED locator fields in PortableArtifactIdentity and remain
separate from manifest_run_id.

### 2.2 Cache contract

Portable cache key is exactly:

~~~
(computed_bundle_digest_sha256, review_schema_version, hermes_version, selected_relative_path)
~~~

An envelope is cacheable only when verification.integrity is INTERNALLY_CONSISTENT and its
computed bundle digest is non-null. Every INVALID_EVIDENCE envelope is non-cacheable even when a
complete capture produced a non-null computed digest; partial/null-digest captures are also
non-cacheable. The cached value is the portable locator-bound envelope and contains no filesystem
metadata.
Before every cached render, the facade reopens the current selection through allowed-root
containment and performs a full capture and stored verification. A metadata or digest difference
invalidates the active session and its presentation projection. A different computed bundle digest
selects a different cache entry.

## 3. Common enums and scalar types

| Type | Exact values/rule |
|---|---|
| EvidenceCategory | OBSERVED, COMPUTED, GATE_DECISION, ASSUMPTION, NOT_AVAILABLE, AUTHENTICITY, RESIDUAL_RISK |
| ArtifactFileName | manifest.json, execution-context.json, scenario.resolved.yaml, gate-config.resolved.yaml, events.jsonl, metrics.json, findings.json, verdict.json, trace.sha256, bundle.sha256 |
| Sha256 | lowercase string matching exactly 64 hexadecimal characters |
| Scalar | null, string, boolean, integer, or finite JSON number; arrays/objects forbidden |
| Availability | AVAILABLE, NOT_AVAILABLE, NOT_APPLICABLE |
| Requiredness | REQUIRED, OPTIONAL, NOT_APPLICABLE |
| Verdict | PASS, CONDITIONAL, HOLD, INVALID_EVIDENCE |
| Integrity | UNVERIFIED, INTERNALLY_CONSISTENT, INVALID_EVIDENCE |
| ComparisonStatus | IMPROVED, REGRESSED, UNCHANGED, NOT_COMPARABLE |
| SourceType | MANIFEST, EXECUTION_CONTEXT, SCENARIO, GATE_CONFIG, EVENT, METRIC, FINDING, VERDICT, TRACE_DIGEST, BUNDLE_DIGEST |
| ComparisonSide | BASELINE, CANDIDATE |

Every displayed scalar is rendered inside exactly one categorized record. Presentation labels,
table cells, cards, and chart points inherit the category of their containing record; they do not
receive an independent category or combine categories.

## 4. Exact common models

### 4.1 ToolInfo

| Field | Type | Rule |
|---|---|---|
| hermes_distribution | string | Required constant hermes-autonomy |
| hermes_version | string | Installed distribution version |
| review_schema_version | string | Required constant 1.0 |
| category | COMPUTED | Required constant |

### 4.2 SourceInventoryItem

Portable inventory deliberately excludes path and filesystem metadata.

SourceFileObservation:

| Field | Type/rule |
|---|---|
| file_name | ArtifactFileName |
| size_bytes | non-negative integer |
| category | required OBSERVED |

CategorizedDigest:

| Field | Type/rule |
|---|---|
| algorithm | required constant SHA-256 |
| value | Sha256 |
| category | required COMPUTED |

| Field | Type | Rule |
|---|---|---|
| file | SourceFileObservation | file_name ArtifactFileName; size_bytes non-negative integer; category OBSERVED |
| observed_sha256 | CategorizedDigest | algorithm SHA-256; value Sha256; category COMPUTED |

Inventory contains 0..10 unique items in ArtifactFileName order. A valid internally consistent
envelope has exactly ten. Invalid capture lists only files actually captured; it never fabricates
missing items.

### 4.3 PortableArtifactIdentity

Manifest identity is derived from captured manifest/content. Locator fields never substitute for
manifest identity.

| Field | Type | Rule |
|---|---|---|
| locator | LocatorInfo | selected_relative_path, selected_directory_name, category OBSERVED |
| manifest_identity | ManifestIdentityInfo | run_id, created_at_utc, evidence_schema_version, scenario_schema_version (each nullable), category OBSERVED |
| observed_bundle_digest | DigestInfo or null | value Sha256, semantic OBSERVED_CLAIM, category OBSERVED |
| computed_bundle_digest | DigestInfo or null | value Sha256, semantic COMPUTED_FROM_CAPTURE, category COMPUTED; present only with all inputs |
| observed_trace_digest | DigestInfo or null | value Sha256, semantic OBSERVED_CLAIM, category OBSERVED |
| computed_trace_digest | DigestInfo or null | value Sha256, semantic COMPUTED_FROM_EVENTS, category COMPUTED |
| source_inventory | array[SourceInventoryItem] | 0..10 actually captured items in canonical order |

DigestInfo fields are algorithm required SHA-256, value Sha256, semantic as restricted above, and
category. LocatorInfo and ManifestIdentityInfo are categorized records so no computed scalar
inherits OBSERVED merely by sharing an artifact container.

### 4.4 SourceReference and SideReference

SourceReference:

| Field | Type | Rule |
|---|---|---|
| source_type | SourceType | Required |
| file_name | ArtifactFileName | Required and type-consistent |
| json_pointer | string or null | RFC 6901 pointer |
| event_sequence | integer or null | Non-negative only for EVENT; null otherwise |

It resolves only inside the captured snapshot and never reopens a path.

SideReference contains side: ComparisonSide and reference: SourceReference. Comparison references
must always be side-qualified. Reference arrays sort by file inventory order, event_sequence
(null first), then json_pointer and reject duplicates.

### 4.5 ExactValue and ActionValue

ExactValue supports scalar values only:

| Field | Type | Rule |
|---|---|---|
| machine_value | Scalar | Required |
| canonical_text | string or null | Exact stored/recomputed lexical form |
| display_text | string | Full deterministic non-truncated rendering |
| unit | string or null | Required |

ActionValue is not an ExactValue:

| Field | Type | Rule |
|---|---|---|
| steering | finite number | -1 through 1 |
| throttle | finite number | 0 through 1 |
| brake | finite number | 0 through 1 |

Presentation may truncate artifact-derived text beyond 1,024 Unicode scalar values only in a
non-authoritative projection record with displayed_text, truncated=true, and original_length.
The portable envelope's machine/canonical/full display value and captured source drill-down remain
complete.

### 4.6 DiagnosticItem and LimitationItem

DiagnosticItem fields are id, code, text, impact, category, and source_references.
All are required; id/code/text/impact are non-empty strings; category is any EvidenceCategory;
source_references is an ordered array.

LimitationItem fields are id, text, impact, category, and source_references. category is required
RESIDUAL_RISK, AUTHENTICITY, or NOT_AVAILABLE. IDs are unique and arrays sort by id.

AssumptionItem fields are id, text, impact, category required ASSUMPTION, and source_references.
UnavailableEvidenceItem fields are evidence_id, label, reason, requiredness, consequence
GateConsequence, category required NOT_AVAILABLE, and source_references. IDs are unique; arrays
preserve profile order for unavailable evidence and sort assumptions by id.

### 4.7 ThresholdClause and ThresholdExpression

ThresholdClause:

| Field | Type | Rule |
|---|---|---|
| left_operand | string | Stable operand ID |
| transforms | non-empty array of IDENTITY, ABSOLUTE_VALUE, ALL_EVENTS, MAX_OVER_EVENTS, DURATION_TRUE, FINITE_DIFFERENCE, or FINAL_EVENT | Applied in listed order |
| operator | EQ, NE, LT, LTE, GT, GTE, IS_TRUE, or IS_FALSE | Required |
| right_operand | ExactValue or null | Null only for unary/invariant operators |
| configuration_sources | array[SourceReference] | Verified config sources |
| evidence_sources | array[SourceReference] | Verified event/metric evidence sources |

ThresholdExpression is a discriminator union:

| Variant | Exact fields/rules |
|---|---|
| ClauseExpression | kind CLAUSE; label string; clause ThresholdClause; children empty; invariant null |
| GroupExpression | kind ALL_OF or ANY_OF; label string; clause null; children 1..N ThresholdExpression; invariant null |
| InvariantExpression | kind INVARIANT; label string; clause null; children empty; invariant InvariantRule |

InvariantRule fields are operator (COMPLETE or ALL_OBSERVED), configuration_sources ordered
array[SourceReference], and evidence_sources ordered array[SourceReference]. This union can encode
every threshold registry row. UI renders but never evaluates it.

## 5. Review-specific models

### 5.1 VerificationInfo

| Field | Type | Rule |
|---|---|---|
| integrity | Integrity | Completed portable envelope is INTERNALLY_CONSISTENT or INVALID_EVIDENCE |
| verified_by | string | Required stable verifier identity |
| errors | array[DiagnosticItem] | Verification order; empty when valid |
| first_mismatch_sequence | integer or null | Non-negative |
| stored_claims_quarantined | boolean | True on invalid evidence when stored verdict/findings/metrics exist |
| category | COMPUTED | Required |

Current core IntegrityStatus.INVALID maps to portable INVALID_EVIDENCE without renaming the core
enum. Existing stored verification remains the sole integrity authority.

### 5.2 TrustInfo and TrustRecord

TrustInfo has one field, records: array[TrustRecord], containing exactly five records in this order:
authenticity, authorization, deployment_permission, scope, authoritative_status.

TrustRecord:

| Field | Type |
|---|---|
| dimension | authenticity, authorization, deployment_permission, scope, or authoritative_status |
| value | dimension-specific exact value in table below |
| category | dimension-specific exact category in table below |
| explanation | non-empty string |

| Dimension | Value | Category |
|---|---|---|
| authenticity | NOT_AUTHENTICATED | AUTHENTICITY |
| authorization | NOT_EVALUATED | ASSUMPTION |
| deployment_permission | NONE | RESIDUAL_RISK |
| scope | SIMULATION_ONLY | ASSUMPTION |
| authoritative_status | NOT_DEFINED | ASSUMPTION |

Scope is ASSUMPTION because SIMULATION_ONLY is the Phase 6 product-boundary interpretation, not a
fact independently observed from arbitrary artifact bytes.

### 5.3 GateConsequence

| Field | Type | Rule |
|---|---|---|
| triggered | boolean | Whether this item is non-passing and activates a gate rule |
| effect | NO_EFFECT, INVALID_EVIDENCE, HOLD, CONDITIONAL, or CONFIGURED_MISSING_REQUIRED_EVIDENCE | Exact core rule |
| result_if_controlling | Verdict or null | Null for NO_EFFECT; resolved actual configured verdict otherwise |
| source | FIXED_GATE_PRECEDENCE, GATE_CONFIG_MISSING_REQUIRED_EVIDENCE, or PROFILE_NOT_APPLICABLE | Required |
| listed_in_hard_failures | boolean | Exact membership in GateResult.hard_failures |
| listed_in_soft_failures | boolean | Exact membership in GateResult.soft_failures |
| listed_in_supporting_findings | boolean | Exact membership in GateResult.supporting_finding_ids |
| configuration_references | array[SourceReference] | Empty unless config/profile controls effect |

The review core projects actual consequence; UI never simulates hypothetical precedence.

### 5.4 GateInfo

| Field | Type/rule |
|---|---|
| verdict | Verdict |
| category | required GATE_DECISION |
| accepted_recomputation | boolean; true only when internally consistent |
| gate_name | non-empty string or null |
| gate_version | non-empty string or null |
| gate_config_digest_sha256 | Sha256 or null |
| rationale | ordered array[non-empty string] |
| hard_failure_ids | unique array[string] preserving GateResult order |
| soft_failure_ids | unique array[string] preserving GateResult order |
| supporting_finding_ids | unique array[string] preserving GateResult order |
| residual_limitation_ids | unique array[string] matching envelope limitations |

On invalid quarantine, identity is populated only if safely verified; all ID arrays are empty.

### 5.5 SufficiencySummary and SufficiencyItem

SufficiencySummary:

| Field | Type |
|---|---|
| required_and_available | non-negative integer |
| required_but_unavailable | non-negative integer |
| optional_and_available | non-negative integer |
| optional_and_unavailable | non-negative integer |
| not_applicable | non-negative integer |

SufficiencyItem fields:

| Field | Type |
|---|---|
| evidence_id, label | non-empty string |
| requirement | Requiredness |
| availability | Availability |
| reason | string or null |
| consequence | GateConsequence |
| category | OBSERVED, COMPUTED, or NOT_AVAILABLE |
| source_references | array[SourceReference] |

NOT_APPLICABLE requires requirement and availability both NOT_APPLICABLE. Other valid combinations
map one-to-one to the four named summary counts. Items preserve verifier-profile order.

EvidenceSufficiency:

| Field | Type/rule |
|---|---|
| profile_name | non-empty string or null |
| profile_version | non-empty string or null |
| summary | SufficiencySummary |
| items | array[SufficiencyItem] in profile order |
| category | required COMPUTED |

Invalid quarantine uses null profile, zero counts, and no items.

### 5.6 FindingItem

| Field | Type/rule |
|---|---|
| finding_id, verifier_name, verifier_version, label, explanation | non-empty string |
| category | COMPUTED or NOT_AVAILABLE |
| status | PASS, FAIL, or NOT_AVAILABLE |
| severity | INFO, WARNING, ERROR, or CRITICAL |
| hard_invariant | boolean |
| measured | ExactValue; unavailable has machine_value null |
| threshold | ThresholdExpression |
| threshold_source_text | non-empty verified audit string |
| first_failure_simulation_time_s | finite non-negative number or null |
| supporting_event_sequences | unique increasing array[non-negative integer] |
| evidence_availability | AVAILABLE or NOT_AVAILABLE |
| requiredness | Requiredness |
| consequence | GateConsequence |
| source_references | ordered array[SourceReference] |

Items preserve selected profile order and finding IDs are unique.

### 5.7 MetricValue and MetricItem

MetricValue is a discriminator union on `kind`:

**ScalarMetricValue**

| Field | Type/rule |
|---|---|
| kind | required constant SCALAR |
| value | ExactValue |

**StringCountMapMetricValue**

| Field | Type/rule |
|---|---|
| kind | required constant STRING_COUNT_MAP |
| values | object whose keys are unique non-empty strings and values are non-negative integers; keys serialize in Unicode code-point order; empty object permitted |

MetricItem is:

| Field | Type/rule |
|---|---|
| metric_id, label | non-empty string |
| category | COMPUTED or NOT_AVAILABLE |
| value | MetricValue |
| availability | AVAILABLE or NOT_AVAILABLE |
| unavailable_reason | non-empty string only when unavailable; null otherwise |
| desired_direction | HIGHER, LOWER, TARGET, DESCRIPTIVE, or NONE from core metadata |
| source_references | ordered array[SourceReference] |

For a scalar, the ExactValue unit must equal the registry unit. A map's registry unit applies to
each count. Non-Measurement fields and both count maps are always AVAILABLE, category COMPUTED,
with null unavailable_reason. For an AVAILABLE Measurement, value is ScalarMetricValue with the
finite numeric machine value and stored unit, category is COMPUTED, and unavailable_reason is
null. For a NOT_AVAILABLE Measurement, category and availability are NOT_AVAILABLE,
unavailable_reason is the exact non-empty stored Measurement.reason, and value is
ScalarMetricValue containing ExactValue(machine_value=null, canonical_text=null,
display_text="NOT_AVAILABLE", unit=the stored Measurement.unit). Missing measurements are never
zero. Each source_references array begins with the exact metrics.json pointer shown below and then
contains the ordered EVENT references used by the stated transform; references are never inferred
from an uncaptured source.

The supported metric registry is exact and ordered. Schema 1 emits rows 1-13; schema 2 emits rows
1-19. This is below the immutable 64-item envelope budget. `evidence_schema_version` is
intentionally excluded because PortableArtifactIdentity already carries the evidence schema; it is
not duplicated as a metric. No other RunMetrics field is excluded.

| # | metric_id | value kind | unit | direction | metrics.json source and exact event transform |
|---:|---|---|---|---|---|
| 1 | event_count | SCALAR | events | DESCRIPTIVE | `/event_count`; count all captured events |
| 2 | simulation_duration_s | SCALAR | s | DESCRIPTIVE | `/simulation_duration_s`; final event `/simulation_time_s` |
| 3 | collision_count | SCALAR | collisions | LOWER | `/collision_count`; MAX_OVER_EVENTS `/vehicle_state/collision_count` |
| 4 | max_abs_lateral_offset_m | SCALAR | m | LOWER | `/max_abs_lateral_offset_m`; MAX_OVER_EVENTS ABS `/vehicle_state/lateral_offset_m` |
| 5 | offroad_duration_s | SCALAR | s | LOWER | `/offroad_duration_s`; SUM_OVER_EVENTS of `1 / run_context.control_frequency_hz` where `/vehicle_state/offroad` is true |
| 6 | route_completion_pct | SCALAR | % | HIGHER | `/route_completion_pct`; when every `/raw_facts/route_progress_available` is true, MAX_OVER_EVENTS `/vehicle_state/route_progress_pct`; otherwise the stored Measurement is NOT_AVAILABLE |
| 7 | minimum_ttc_s | SCALAR | s | HIGHER | `/minimum_ttc_s`; MIN_OVER_ELIGIBLE_EVENTS of distance divided by negative relative speed using the result-prefixed observation_summary pair when those keys exist for that event, otherwise the unprefixed pair; eligible only for finite distance >=0 and finite relative speed <0; no eligible pair is NOT_AVAILABLE with the recomputed reason |
| 8 | max_abs_acceleration_mps2 | SCALAR | m/s^2 | LOWER | `/max_abs_acceleration_mps2`; MAX_OVER_EVENTS ABS `/vehicle_state/acceleration_mps2` |
| 9 | max_abs_jerk_mps3 | SCALAR | m/s^3 | LOWER | `/max_abs_jerk_mps3`; MAX_OVER_ADJACENT_EVENTS ABS acceleration delta divided by `1 / run_context.control_frequency_hz`; fewer than two events is NOT_AVAILABLE |
| 10 | p95_policy_latency_ms | SCALAR | ms | LOWER | `/p95_policy_latency_ms`; nearest-rank p95 over `/policy_latency_ms` |
| 11 | shield_override_count | SCALAR | overrides | DESCRIPTIVE | `/shield_override_count`; count events where candidate_action differs from permitted_action for schema 2 or executed_action for schema 1 |
| 12 | shield_override_reasons | STRING_COUNT_MAP | occurrences | DESCRIPTIVE | `/shield_override_reasons`; sorted counts of supported strings across `/override_reasons` |
| 13 | termination_reason | SCALAR | null | DESCRIPTIVE | `/termination_reason`; final event `/termination_reason`; exact TerminationReason string |
| 14 | fault_application_counts | STRING_COUNT_MAP | occurrences | DESCRIPTIVE | `/fault_application_counts`; schema 2 only; sorted counts across both `/observation_fault_evidence/applied_faults` and `/control_fault_evidence/applied_faults` |
| 15 | max_observation_age_s | SCALAR | s | LOWER | `/max_observation_age_s`; schema 2 only; MAX_OVER_EVENTS `/observation_fault_evidence/delivered_observation/observation_age_s` |
| 16 | p95_control_latency_ms | SCALAR | ms | LOWER | `/p95_control_latency_ms`; schema 2 only; nearest-rank p95 of AVAILABLE `/control_fault_evidence/control_latency_ms/value`; no available sample is NOT_AVAILABLE |
| 17 | control_fill_count | SCALAR | events | DESCRIPTIVE | `/control_fill_count`; schema 2 only; exact `CONTROL_DELAY_FILL` count in fault_application_counts |
| 18 | steering_saturation_count | SCALAR | events | LOWER | `/steering_saturation_count`; schema 2 only; exact `STEERING_SATURATION` count in fault_application_counts |
| 19 | brake_saturation_count | SCALAR | events | LOWER | `/brake_saturation_count`; schema 2 only; exact `BRAKE_SATURATION` count in fault_application_counts |

Registry metric IDs are unique and emitted only in the order above. Map keys are data, not metric
IDs, and do not consume additional MetricItem budget entries. All scalar values use ExactValue;
objects are permitted only through StringCountMapMetricValue.

### 5.8 Timeline, Track, Point, and ObservationValue

Timeline fields are event_count, simulation_start_s, simulation_end_s, tracks, and category
OBSERVED. event_count is 0..10,000; times are finite non-negative or null and null together only
for zero events.

Track:

| Field | Type/rule |
|---|---|
| track_id, label | non-empty string |
| category | OBSERVED, COMPUTED, or NOT_AVAILABLE |
| availability | AVAILABLE or NOT_AVAILABLE |
| unavailable_reason | non-empty string only when track unavailable; null otherwise |
| value_kind | SCALAR, ACTION, OBSERVATION, or STRING_LIST |
| points | array[Point] sorted by sequence |
| source_references | ordered array[SourceReference] |

An unavailable track has category NOT_AVAILABLE and no points. An available track may contain
unavailable points for per-event measurement gaps.

ObservationValue is the exact review representation of the current Observation model:

| Field | Type |
|---|---|
| sequence | non-negative integer |
| simulation_time_s | finite non-negative number |
| position_m | finite number |
| speed_mps | finite non-negative number |
| acceleration_mps2 | finite number |
| lateral_offset_m | finite number |
| route_progress_pct | finite number 0..100 |
| collision_count | non-negative integer |
| offroad | boolean |
| destination_reached | boolean |
| front_distance_m | finite non-negative number or null |
| front_relative_speed_mps | finite number or null |
| observation_age_s | finite non-negative number |
| challenge_actor_longitudinal_m | finite number or null |
| challenge_actor_lateral_offset_m | finite number or null |
| challenge_actor_speed_mps | finite non-negative number or null |
| challenge_phase | PRE_TRIGGER, BRAKING, RECOVERY, CUT_IN, POST_CUT_IN, or null |

StringListValue has values: unique array[string] preserving stored reason order.

Point:

| Field | Type/rule |
|---|---|
| sequence | non-negative integer |
| simulation_time_s | finite non-negative number |
| category | OBSERVED, COMPUTED, or NOT_AVAILABLE |
| availability | AVAILABLE or NOT_AVAILABLE |
| unavailable_reason | non-empty string only when unavailable; null otherwise |
| scalar_value | ExactValue or null |
| action_value | ActionValue or null |
| observation_value | ObservationValue or null |
| string_list_value | StringListValue or null |
| source_reference | SourceReference |

Exactly one value field is non-null and matches Track.value_kind. At an unavailable SCALAR point,
scalar_value is ExactValue with machine_value null and explicit unit; the point category is
NOT_AVAILABLE. ACTION, OBSERVATION, and STRING_LIST points cannot be individually unavailable.

Portable timeline retains every verified event and all contract-required semantic points through
the core maximum 10,000; it is never semantically decimated. UI may page/filter deterministically
while always showing total event/point counts.

### 5.8.1 Frozen timeline track registry

Tracks appear exactly in this order; there is no arbitrary event-object dump.

| Order / track_id | Value/category | Schema 1.0 | Schema 2.0 | Exact source/derivation |
|---|---|---|---|---|
| 1 raw_observation | OBSERVATION / OBSERVED | NOT_AVAILABLE track | AVAILABLE | observation_fault_evidence.raw_observation |
| 2 delivered_observation | OBSERVATION / OBSERVED | NOT_AVAILABLE track | AVAILABLE | observation_fault_evidence.delivered_observation |
| 3 result_observation | OBSERVATION / OBSERVED | NOT_AVAILABLE track | AVAILABLE | result_observation |
| 4 candidate_action | ACTION / OBSERVED | AVAILABLE | AVAILABLE | candidate_action |
| 5 permitted_action | ACTION / OBSERVED | NOT_AVAILABLE track; never inferred | AVAILABLE | permitted_action |
| 6 executed_action | ACTION / OBSERVED | AVAILABLE | AVAILABLE | executed_action |
| 7 override_reasons | STRING_LIST / OBSERVED | AVAILABLE | AVAILABLE | override_reasons, including empty list |
| 8 observation_fault_reasons | STRING_LIST / OBSERVED | NOT_AVAILABLE track | AVAILABLE | observation_fault_evidence.applied_faults |
| 9 control_fault_reasons | STRING_LIST / OBSERVED | NOT_AVAILABLE track | AVAILABLE | control_fault_evidence.applied_faults |
| 10 collision_count | SCALAR / OBSERVED | AVAILABLE | AVAILABLE | vehicle_state.collision_count |
| 11 offroad | SCALAR / OBSERVED | AVAILABLE | AVAILABLE | vehicle_state.offroad |
| 12 speed_mps | SCALAR / OBSERVED | AVAILABLE | AVAILABLE | vehicle_state.speed_mps |
| 13 route_progress_pct | SCALAR / OBSERVED or NOT_AVAILABLE point | AVAILABLE track | AVAILABLE track | vehicle_state.route_progress_pct only when raw_facts.route_progress_available; otherwise null point with reason |
| 14 ttc_s | SCALAR / COMPUTED or NOT_AVAILABLE point | AVAILABLE track | AVAILABLE track | per event, choose result_front_* summary keys when both exist, else front_* keys; compute distance / -relative_speed only for finite distance >=0 and relative_speed <0; otherwise null point with exact no-paired-closing reason |
| 15 policy_latency_ms | SCALAR / OBSERVED | AVAILABLE | AVAILABLE | policy_latency_ms; latency_source must remain simulated for supported profiles |
| 16 verifier_triggering_findings | STRING_LIST / COMPUTED | AVAILABLE | AVAILABLE | finding IDs whose supporting_event_sequences contain sequence, in profile order |

observation_summary, raw_facts, ObservationFaultEvidence delivery/source metadata, and
ControlFaultEvidence provenance are not exposed as additional version-1 tracks. They remain
available through exact SourceReferences/drill-down and may require a later review-schema version.
The registry is curated and lossless only for its declared semantics, not an arbitrary event dump.

### 5.9 Provenance

RecordedProvenance has status ACCEPTED or QUARANTINED; category OBSERVED when accepted and
NOT_AVAILABLE when quarantined; source_references; and these required nullable fields:
hermes_version, hermes_git_commit, hermes_git_dirty, repository_provenance_reason, adapter_name,
adapter_version, adapter_config_digest, simulator_name, simulator_version, simulator_commit,
policy_name, policy_version, policy_config_digest, shield_name, shield_version,
shield_config_digest, fault_name, fault_version, fault_config_digest, gate_name, gate_version,
gate_config_digest, scenario_name, scenario_version, scenario_schema_version, scenario_digest,
python_version, platform, and architecture.

For ACCEPTED, every field required by the verified source schema is non-null; only source-defined
optional simulator/fault/repository fields may be null, and source_references are present. For
QUARANTINED, every provenance field is null and source_references is empty. This prevents an invalid
bundle from exposing unverified provenance as accepted fact.

AuthenticatedOrigin fields are status (NOT_AUTHENTICATED), signer_id null, signature_id null,
category AUTHENTICITY.

Provenance contains recorded and authenticated_origin, with no other fields.

## 6. Exact threshold registry

The review core projects this table from verified configuration. No other projection is supported
in version 1.0.

| Finding ID | Expression | Exact clauses / sources |
|---|---|---|
| trace.integrity | InvariantExpression | invariant.operator COMPLETE; configuration source scenario horizon; evidence sources events.jsonl and trace.sha256 |
| collision.zero | ClauseExpression | left collision_count; transforms [MAX_OVER_EVENTS]; operator LTE; right gate.hard.max_collision_count; GATE_CONFIG /hard/max_collision_count; events evidence source; current schema fixes 0 |
| boundary.within_tolerance | GroupExpression ALL_OF, three ClauseExpression children | (1) left lateral_offset_m; transforms [ABSOLUTE_VALUE, MAX_OVER_EVENTS]; LTE right computed min(gate hard max offset, scenario road tolerance), with both config pointers and event evidence source; (2) left offroad; transforms [ALL_EVENTS]; IS_FALSE, events evidence source; (3) left offroad; transforms [DURATION_TRUE]; LTE gate hard max offroad duration, GATE_CONFIG pointer and events evidence source; current schema fixes 0.0 |
| progress.required | GroupExpression ALL_OF | (1) left destination_reached; transforms [FINAL_EVENT]; IS_TRUE; final event evidence source; (2) left route_completion_pct; transforms [MAX_OVER_EVENTS]; GTE gate hard minimum progress, GATE_CONFIG pointer and metrics/events evidence sources; unavailable consequence references /hard/missing_required_evidence |
| comfort.acceleration | ClauseExpression | left acceleration_mps2; transforms [ABSOLUTE_VALUE, MAX_OVER_EVENTS]; LTE gate soft max acceleration; GATE_CONFIG pointer and events evidence source |
| comfort.jerk | ClauseExpression | left acceleration_mps2; transforms [FINITE_DIFFERENCE, ABSOLUTE_VALUE, MAX_OVER_EVENTS]; LTE gate soft max jerk; GATE_CONFIG pointer plus execution-context control frequency and events evidence sources |
| fault.coverage.required | InvariantExpression | invariant.operator ALL_OBSERVED; configuration source SCENARIO /faults; evidence source events.jsonl fault reason fields; NOT_APPLICABLE in legacy |

The boundary measured value remains max_abs_lateral_offset_m, but all three actual verifier/gate
clauses are presented. UI does not recompute off-road duration or conjunction truth.

## 7. Exact consequence registry

| Finding/profile/status | effect | result_if_controlling | source |
|---|---|---|---|
| trace.integrity non-PASS | INVALID_EVIDENCE | INVALID_EVIDENCE | FIXED_GATE_PRECEDENCE |
| collision.zero FAIL | HOLD | HOLD | FIXED_GATE_PRECEDENCE |
| collision.zero NOT_AVAILABLE | INVALID_EVIDENCE | INVALID_EVIDENCE | FIXED_GATE_PRECEDENCE |
| boundary.within_tolerance FAIL | HOLD | HOLD | FIXED_GATE_PRECEDENCE |
| boundary.within_tolerance NOT_AVAILABLE | INVALID_EVIDENCE | INVALID_EVIDENCE | FIXED_GATE_PRECEDENCE |
| progress.required FAIL | HOLD | HOLD | FIXED_GATE_PRECEDENCE |
| progress.required NOT_AVAILABLE | CONFIGURED_MISSING_REQUIRED_EVIDENCE | resolved HOLD or INVALID_EVIDENCE | GATE_CONFIG_MISSING_REQUIRED_EVIDENCE |
| comfort.acceleration FAIL/NOT_AVAILABLE | CONDITIONAL | CONDITIONAL | FIXED_GATE_PRECEDENCE |
| comfort.jerk FAIL/NOT_AVAILABLE | CONDITIONAL | CONDITIONAL | FIXED_GATE_PRECEDENCE |
| fault.coverage.required non-PASS in fault_coverage | HOLD | HOLD | FIXED_GATE_PRECEDENCE |
| fault.coverage.required in legacy | NO_EFFECT | null | PROFILE_NOT_APPLICABLE |
| any PASS | NO_EFFECT | null | FIXED_GATE_PRECEDENCE or PROFILE_NOT_APPLICABLE |

The three membership flags copy actual GateResult arrays and make no claim that every supporting
finding controlled final precedence. The UI never infers a controlling cause or hypothetical
verdict from these flags.

## 8. ReviewEnvelope exact top level

| Field | Type | Rule |
|---|---|---|
| review_schema_version | string | 1.0 |
| tool | ToolInfo | Required |
| artifact | PortableArtifactIdentity | Required |
| verification | VerificationInfo | Required |
| trust | TrustInfo | Required |
| gate | GateInfo | Required |
| evidence_sufficiency | EvidenceSufficiency | Required |
| findings | array[FindingItem] | Required |
| metrics | array[MetricItem] | Required |
| timeline | Timeline | Required |
| provenance | Provenance | Required |
| diagnostics | array[DiagnosticItem] | Required |
| assumptions | array[AssumptionItem] | Required |
| unavailable_evidence | array[UnavailableEvidenceItem] | Required; exactly the NOT_AVAILABLE sufficiency items |
| residual_limitations | array[LimitationItem] | Required |

No generated time, duration, absolute path, dev/inode/mode/mtime/ctime, cache state, port, browser
state, or session ID is portable. The two relative locator fields are intentionally portable.

Invalid evidence contains safely derived tool/artifact partial inventory and nullable roots,
VerificationInfo, mandatory
TrustInfo, GateInfo verdict INVALID_EVIDENCE with accepted_recomputation false, zero/empty
sufficiency, empty findings/metrics/timeline, QUARANTINED provenance, diagnostics, and limitations.
Stored PASS/findings/metrics are not accepted.

## 9. Review-shape availability versus integrity

Existing verification ceilings remain authoritative: 16 MiB per required file, 64 MiB total,
10,000 events, and 1 MiB per event line. Exceeding them produces core INVALID_EVIDENCE.

Phase 6 structural projection budgets are operational only: at most 64 FindingItems, 64
MetricItems, generated review-model nesting depth 16, and 1,024 displayed Unicode scalars before
non-authoritative truncation. If an internally consistent core snapshot cannot fit finding,
metric, or structural envelope bounds, facade returns typed REVIEW_UNAVAILABLE with reason
UNSUPPORTED_REVIEW_SHAPE, exit 40, emits no ReviewEnvelope, and never changes integrity or gate.
Timeline has no lower review event limit and supports all core-valid events.

## 10. Comparison models

### 10.1 CompatibilityInfo and SideSummary

CompatibilityInfo fields are status (COMPATIBLE or INCOMPATIBLE), reasons, warnings, and category
COMPUTED. Reason/warning arrays preserve core order.

SideSummary fields are side, artifact PortableArtifactIdentity, integrity, gate_verdict, category
COMPUTED, and source_references array[SideReference].

### 10.2 DimensionDelta, HardFailureDelta, AvailabilityDelta, ChartSeries

DimensionValue is a discriminator union:

| Variant | Exact fields |
|---|---|
| ScalarDeltaValue | kind SCALAR; value ExactValue |
| MeasurementDeltaValue | kind MEASUREMENT; availability AVAILABLE or NOT_AVAILABLE; value finite number or null; reason null when available and non-empty when unavailable |
| StringListValue | kind STRING_LIST; values unique array[string] sorted lexicographically |
| InterventionValue | kind INTERVENTION; count non-negative integer; reasons object whose keys are sorted unique strings and values non-negative integers |
| AvailabilityMapValue | kind AVAILABILITY_MAP; values object with exactly minimum_ttc_s, route_completion_pct, max_abs_acceleration_mps2, max_abs_jerk_mps3, p95_policy_latency_ms mapped to AVAILABLE or NOT_AVAILABLE |

DimensionDelta fields: dimension_id, status, baseline_value DimensionValue, candidate_value
DimensionValue, unit, explanation, desired_direction, category COMPUTED, and source_references
array[SideReference]. Both sides use the same variant. Unknown shapes produce REVIEW_UNAVAILABLE /
exit 40.

HardFailureDelta is dedicated and exact: status ComparisonStatus; baseline_ids and candidate_ids
unique lexicographically sorted array[string]; removed_ids and added_ids unique lexicographically
sorted array[string]; explanation string; category COMPUTED; source_references
array[SideReference]. It is not a DimensionDelta and is never placed in a partition array.

AvailabilityDelta fields: metric_id, baseline_availability, candidate_availability,
baseline_reason, candidate_reason, category COMPUTED, and source_references.

ChartSeries fields: dimension_id, baseline_numeric_value, candidate_numeric_value, unit, category
COMPUTED, and source_references. Values are finite numbers. Only compatible numeric dimensions
with AVAILABLE values may appear.

### 10.3 One-to-one core dimension mapping

| Core order/name | Envelope destination | Chart eligible |
|---:|---|---|
| 1 verdict | dedicated verdict_delta | No |
| 2 hard_failures | dedicated hard_failure_delta | No |
| 3 collision_count | exactly one status partition array | Yes |
| 4 minimum_ttc_s | exactly one status partition using MeasurementDeltaValue | Yes when both available |
| 5 route_completion_pct | exactly one status partition using MeasurementDeltaValue | Yes when both available |
| 6 max_abs_acceleration_mps2 | exactly one status partition using MeasurementDeltaValue | Yes when both available |
| 7 max_abs_jerk_mps3 | exactly one status partition using MeasurementDeltaValue | Yes when both available |
| 8 p95_policy_latency_ms | exactly one status partition using MeasurementDeltaValue | Yes when both available and source-compatible |
| 9 policy_latency_source | exactly one status partition array | No |
| 10 shield_interventions | exactly one status partition array, normally NOT_COMPARABLE | No |
| 11 evidence_availability | dedicated availability_summary_delta using AvailabilityMapValue | No |

Dedicated fields are never duplicated in partition arrays. Partition arrays are improvements,
regressions, unchanged_outcomes, and not_comparable. Each sorts by the core order above, not by
label. availability_summary_delta is never duplicated in a partition. Supplemental
availability_deltas has 0..5 items, sorts by minimum_ttc_s, route_completion_pct,
max_abs_acceleration_mps2, max_abs_jerk_mps3, p95_policy_latency_ms and contains an item only when
availability or unavailable reason differs. Chart series follows core order.

### 10.4 ComparisonEnvelope exact top level

| Field | Type |
|---|---|
| comparison_schema_version | required constant 1.0 |
| tool | ToolInfo |
| baseline | SideSummary |
| candidate | SideSummary |
| compatibility | CompatibilityInfo |
| verdict_delta | DimensionDelta or null |
| hard_failure_delta | HardFailureDelta or null |
| availability_summary_delta | DimensionDelta or null |
| improvements | array[DimensionDelta] |
| regressions | array[DimensionDelta] |
| unchanged_outcomes | array[DimensionDelta] |
| not_comparable | array[DimensionDelta] |
| availability_deltas | array[AvailabilityDelta] |
| chart_series | array[ChartSeries] |
| residual_limitations | array[LimitationItem] |

Incompatible means verdict_delta, hard_failure_delta, and availability_summary_delta null and every
partition/detail/chart array empty. Invalid input emits no ComparisonEnvelope: return canonical INVALID_EVIDENCE CLI error with
the invalid side's ReviewEnvelope diagnostic, exit 30. There is no winner, score, safety score, or
recommendation field.

## 11. CLI and unsupported versions

review-artifact and review-compare support text or json. Valid PASS, CONDITIONAL, and HOLD review
operations exit 0. Invalid evidence exits 30. REVIEW_UNAVAILABLE, path, configuration, operational,
and incompatible comparison exit 40. Legacy run/verify-artifact/compare exits do not change.

Unsupported source/review versions fail closed. No implicit upgrade, migration, repair,
normalization, or best-effort interpretation is permitted.

## 12. Required contract tests

- strict unknown-field/nullability/finite-number/enum tests for every model above;
- canonical byte identity after touch/replacement with identical bytes at the same relative path;
- a changed selected relative path intentionally changes only locator-bound identity/cache entry;
- portable recursive forbidden-field scan for absolute path and filesystem metadata;
- full recapture before every cached render and digest-change invalidation;
- existing verifier-ceiling behavior remains unchanged;
- core-valid unsupported review shape returns REVIEW_UNAVAILABLE / 40 without envelope or changed
  gate/integrity;
- complete <=10,000-event portable timeline and deterministic UI pagination;
- schema-1 unavailable versus schema-2 separated tracks; ActionValue action tracks;
- exact seven-finding threshold and consequence registries;
- every comparison core dimension mapped exactly once and side-qualified references;
- incompatible comparison has no deltas/arrays/charts;
- invalid stored PASS quarantine; no winner/score fields.
