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

## Implemented evidence at checkpoint 90fb7d8

The table above preserves design-time target names. Implementation sometimes used narrower test
names in the owning modules; the following is the actual evidence map at the adversarially reviewed
checkpoint.

| Requirement group | Actual automated evidence | Status |
|---|---|---|
| P6-F-001/002, P6-T-007 selection, containment, immutable capture | `test_root_contained_capture_returns_canonical_inventory_and_digest_roots`; `test_root_contained_capture_detects_mutation_without_reopening_artifact_paths`; `test_facade_capture_is_the_only_artifact_content_read`; `test_workbench_review_and_comparison_preserve_every_source_bundle_byte` | PASS |
| P6-F-003/004/005, P6-T-001/002/014 envelope, trust, quarantine, identity | `test_models_are_strict_frozen_finite_and_forbid_unknown_fields`; `test_trust_records_are_exactly_once_and_in_frozen_order`; `test_invalid_envelope_quarantines_stored_pass_findings_metrics_timeline_and_provenance`; `test_retained_tampered_artifact_quarantines_stored_pass` | PASS |
| P6-F-006/007/008/009A/009B, P6-T-011 findings, sufficiency, thresholds, unavailable values | `test_gate_consequence_and_sufficiency_reject_false_unavailability`; `test_review_envelope_matches_unavailable_items_and_summary_counts`; `test_finding_rows_preserve_exact_verifier_threshold_unit_sources_and_consequence`; `test_threshold_rows_cover_all_finding_nodes_once_in_deterministic_preorder` | PASS |
| P6-F-009 provenance/authenticity separation | `test_provenance_quarantine_nulls_every_recorded_field`; `test_coherent_rewrite_remains_unauthenticated_and_grants_no_permission`; `test_recorded_provenance_rows_copy_observed_category_per_field` | PASS |
| P6-F-010, P6-P1-002 CLI and canonical portable JSON | `test_review_artifact_json_is_exact_public_facade_bytes_and_operation_exit_zero`; `test_review_artifact_invalid_json_is_exact_quarantined_envelope_and_exit_30`; `test_review_compare_json_is_exact_public_facade_bytes`; `test_public_envelope_serialization_excludes_private_filesystem_and_session_state` | PASS |
| P6-F-011, P6-T-012/013 comparison authority and mixed outcomes | `test_compare_facade_independently_reviews_both_sides_and_calls_core_once`; `test_lead_pair_maps_every_core_dimension_once_with_exact_tradeoffs_and_types`; `test_cutin_pair_retains_hold_and_mixed_tradeoffs_without_a_winner`; `test_incompatible_valid_pair_has_only_core_reasons_and_no_comparison_claims` | PASS |
| P6-F-012/015, P6-T-002/003/009 workbench states and local-only launch | `test_workbench_initial_state_requires_explicit_verify_and_has_six_screens`; `test_workbench_all_review_screens_render_without_exception_and_never_store_envelope`; `test_loopback_validator_accepts_only_numeric_loopback_literals`; `test_loopback_validator_rejects_every_nonliteral_or_nonloopback_host` | PASS |
| P6-F-013/014, P6-P1-001 timeline/schema separation | `test_timeline_registry_has_16_tracks_and_schema_separation_is_explicit`; `test_timeline_pages_are_deterministic_complete_and_do_not_mutate_envelope`; `test_timeline_track_filter_changes_visible_rows_only_and_preserves_envelope`; `test_workbench_new_review_resets_prior_event_drilldown_until_explicit_inspect` | PASS |
| P6-T-004/005/006/010 architecture and inert content | `test_review_layer_never_imports_runtime_simulator_or_workbench`; `test_workbench_modules_import_only_public_review_streamlit_or_standard_library`; `test_workbench_app_avoids_unsafe_streamlit_filesystem_network_and_process_apis`; `test_review_surfaces_bomb_runtime_and_simulator_imports`; `test_text_rows_neutralize_controls_and_report_scalar_truncation`; `test_review_text_neutralizes_unicode_format_controls_in_direct_scalars`; `test_review_text_bounds_each_direct_scalar_at_input_scalar_boundary` | PASS |
| P6-T-008, P6-P1-003/006 cache invalidation, source references, determinism | `test_facade_full_recaptures_then_uses_exact_private_session_and_cache_identity`; `test_changed_artifact_bytes_never_return_prior_cached_envelope`; `test_source_reference_type_relation_rfc6901_order_and_deduplication`; `test_canonical_serialization_is_stable_locator_bound_and_has_no_transport_newline` | PASS |
| P6-P1-004/005 bounds and non-color text equivalents | `test_capture_resource_limits_keep_exact_and_plus_one_semantics`; `test_structural_budgets_fail_with_typed_review_unavailable_error`; `test_timeline_ten_thousand_event_pages_and_track_metadata_remain_bounded`; `test_trust_rows_keep_every_dimension_independent`; `test_workbench_all_review_screens_render_without_exception_and_never_store_envelope` | PASS |
| P6-P1-007 human comprehension walkthrough | Section 9 of the UX document and `PHASE6_DEMO_RUNBOOK.md` | DOCUMENTED; NOT YET OBSERVED |

Pre-final evidence recorded in `PHASE6_ADVERSARIAL_REVIEW.md` is 720 complete tests, 720 under the
non-MetaDrive selection, and 488 focused Phase 6 adversarial tests. Four P1 findings and one P2
presentation-state finding were closed. The only accepted implementation residual is C6-04:
process-local cache/session growth is unbounded and restart-recoverable after explicit selections.
It does not alter portable state, verification, authenticity, authorization, or deployment
permission.

Selections passed to the facade, CLI, or workbench are root-relative. With artifact root
`artifacts`, use `handoff-phase5-demo`, never `artifacts/handoff-phase5-demo`.
