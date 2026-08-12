# Hermes Phase 6 Requirements Traceability

Milestones are M1 review models/capture, M2 review CLI/comparison, M3 workbench, and M4 adversarial
validation/handoff. Test names are frozen targets for Stage 2.

| Requirement | Owner | Milestone | Automated test / evidence | Envelope field | UI surface | Failure result | Residual limitation |
|---|---|---|---|---|---|---|---|
| P6-F-001 exact root-contained selection | review.facade | M1 | test_review_rejects_outside_root_and_traversal | artifact.selected_relative_path | Intake | Exit 40 | User can select stale in-root artifact |
| P6-F-002 one no-follow immutable capture | evidence.verification + review.facade | M1 | test_review_uses_one_descriptor_snapshot_without_reopen | artifact.source_inventory; verification | Intake/provenance | INVALID / 30 | Privileged host outside assurance |
| P6-F-003 ReviewEnvelope 1.0 | review.models/facade | M1 | test_review_envelope_golden_and_strict | entire envelope | All | Contract failure | Tool bug possible |
| P6-F-004 independent trust states | review.models | M1 | test_review_rejects_missing_trust_field | trust; gate; verification | Persistent trust strip | Contract failure | Reviewer may ignore labels |
| P6-F-005 invalid claim quarantine | review.facade | M1 | test_tampered_stored_pass_is_quarantined | verification.stored_claims_quarantined; gate | Invalid page | INVALID / 30 | Coherent full rewrite |
| P6-F-006 findings/rationale/event support | review.facade | M1 | test_findings_preserve_core_semantics_and_events | gate; findings | Summary/findings | Contract/test failure | Source facts not authenticated |
| P6-F-007 core-owned sufficiency | gate profile metadata + review.facade | M1 | test_legacy_and_fault_requiredness_profiles | evidence_sufficiency | Summary/findings | No accepted envelope | Profile policy may be inadequate |
| P6-F-008 exact values/thresholds | review.projection | M1 | test_compound_threshold_and_rounding_edges | findings.measured/threshold; metrics | Findings/metrics | Contract/test failure | Human numeric misread |
| P6-F-009 recorded vs authenticated provenance | review.facade | M1 | test_provenance_never_implies_authenticity | provenance; trust.authenticity | Provenance | Contract/test failure | Producer can self-assert provenance |
| P6-F-009A explicit assumptions | review.facade | M1 | test_assumptions_are_exact_categorized_records | assumptions | Summary/limitations | Contract failure | Assumptions remain product interpretations |
| P6-F-009B explicit unavailable evidence | review.facade | M1 | test_unavailable_array_matches_sufficiency_items | unavailable_evidence | Summary/findings/timeline | Contract failure | Source evidence may remain coarse |
| P6-F-010 review CLI JSON/text | CLI lazy review handlers | M2 | test_review_artifact_cli_json_text_and_exits | entire envelope | CLI | 30/40 by class | Text interpretation |
| P6-F-011 existing compare core only | review.facade | M2 | test_review_compare_delegates_to_compare_artifacts | comparison fields | Comparison | Invalid 30; incompatible 40 | Compatibility core defect |
| P6-F-012 render all verdict classes | workbench.app | M3 | test_workbench_renders_four_gate_states | gate.verdict; verification | Summary/invalid | Render test failure | Visual comprehension |
| P6-F-013 action tracks | review.projection | M1/M3 | test_v1_v2_action_track_availability | timeline.tracks | Timeline | Explicit NOT_AVAILABLE | Schema 1 lacks separate permission |
| P6-F-014 observation tracks | review.projection | M1/M3 | test_v1_v2_observation_track_availability | timeline.tracks | Timeline | Explicit NOT_AVAILABLE | Schema 1 lacks raw/delivered/result |
| P6-F-015 read-only/local-only | workbench.launcher/app | M3 | test_workbench_read_only_and_loopback_only | Runtime policy; trust | All | Exit 40 or HOLD | Other local processes may access |
| P6-T-001 NOT_AUTHENTICATED | review.models | M1 | test_authenticity_is_mandatory_constant | trust.authenticity | Trust strip/provenance | Contract failure | No origin authentication |
| P6-T-002 scope and permission persistent | review.models/app | M1/M3 | test_scope_permission_on_every_view | trust.scope/deployment_permission | Persistent frame | Render failure | No physical permission |
| P6-T-003 PASS language bounded | review.projection/app | M3 | test_pass_copy_contains_no_prohibited_claim | gate.verdict; limitations | Summary | Content test failure | User overgeneralization |
| P6-T-004 no UI gate/verifier | architecture test | M3 | test_workbench_import_boundary | N/A | N/A | CI failure/HOLD | Shared-core defect |
| P6-T-005 no raw artifact UI parse | architecture + mutation tests | M3 | test_workbench_uses_public_review_api_only | source references | Drill-down | CI failure/HOLD | Captured projection defect |
| P6-T-006 no simulator/policy execution | CLI/import boundary | M2/M3 | test_review_commands_bomb_runtime_imports | limitation item | About | CI failure/HOLD | External unrelated process |
| P6-T-007 zero source-byte change | facade/workbench | M1/M3 | test_review_preserves_before_after_hashes | source_inventory | Provenance | CI failure/HOLD | Files outside artifact root |
| P6-T-008 mutation invalidates session | facade cache | M1/M3 | test_same_path_replacement_invalidates_session | computed bundle identity | Intake | Session cleared/full recapture | Cache defect |
| P6-T-009 reject public bind | workbench.launcher | M3 | test_host_accepts_numeric_loopback_only | Runtime config | Launch | Exit 40 | Local access remains |
| P6-T-010 inert artifact content | projection/app | M3 | test_xss_markdown_ansi_payloads_are_inert | Display strings | All text surfaces | Render failure | Framework sanitizer defect |
| P6-T-011 missing is not zero | review.models/projection | M1/M3 | test_not_available_has_reason_and_chart_gap | sufficiency/findings/metrics/timeline | Findings/timeline | Contract/test failure | Reviewer can dismiss limitation |
| P6-T-012 incompatible no chart | review.facade/app | M2/M3 | test_incompatible_comparison_has_no_deltas_or_chart | compatibility; chart_series | Comparison | Exit 40 | Compatibility core defect |
| P6-T-013 no winner score | review.models/app | M2/M3 | test_comparison_schema_has_no_winner_or_score | Field absent | Comparison | Contract test failure | Reviewer can make own ranking |
| P6-T-014 identity/digests visible | review.facade/app | M1/M3 | test_identity_and_both_bundle_roots_render | artifact | Summary/provenance | Contract/render failure | Hashes not signatures |
| P6-P1-001 filters presentation only | workbench.app | M3 | test_timeline_filter_does_not_change_envelope | timeline; immutable gate/findings | Timeline | Render/state test failure | Reviewer can hide rows visually |
| P6-P1-002 portable JSON no local leakage | review.models/CLI | M1/M2 | test_portable_json_has_no_absolute_path_or_time | entire envelope | Export/CLI | Contract failure | Relative path remains identifying |
| P6-P1-003 captured source references | review.facade | M1 | test_source_references_resolve_only_in_capture | source_references | Drill-down | Invalidate session | In-memory corruption |
| P6-P1-004 configured/documented bounds | review.models/facade | M1 | test_core_limits_invalid_and_shape_limits_unavailable | diagnostics or no envelope | Intake | Core INVALID / 30; unsupported review shape / 40 | Review denial within core-valid shapes |
| P6-P1-005 non-color accessibility | workbench.app | M3 | test_statuses_have_text_and_table_equivalent | All status fields | All | Accessibility test failure | Assistive-tech variance |
| P6-P1-006 deterministic unchanged review | review.models/facade | M1 | test_same_bytes_path_tool_schema_is_byte_identical | entire envelope | CLI/UI parity | Test failure | Path/tool/schema intentionally changes key |
| P6-P1-007 comprehension walkthrough | demo/runbook | M4 | documented actual participant script | All | All | CONDITIONAL HOLD until recorded | Small sample, local prototype |

## Cross-cutting acceptance

- The canonical source bundle is exactly REQUIRED_ARTIFACT_FILES.
- Existing IntegrityStatus.INVALID maps to portable INVALID_EVIDENCE without changing the enum.
- Review commands return 0 for valid PASS, CONDITIONAL, and HOLD; 30 for invalid evidence; 40 for
  path/configuration/operational/incompatible cases.
- Legacy verify-artifact and compare exits remain unchanged.
- Every row above requires an implemented automated test before Phase 6 completion. P6-P1-007 also
  requires actual human observations; fabricated usability results are forbidden.
