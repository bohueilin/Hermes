# FleetLab metric contract and operator view — design

**Status:** sequencing steps 1–2 implemented across `1164f2e`, `60380b4`, `2afe4a0`, and
`872ae2b`; `metrics list` landed at `d569672`; spec-file authoring is in this Stage 1 change;
steps 3–4 are not started.
**Date:** 2026-08-30.
**Scope:** `src/hermes/fleet/` only. No `SimulatorAdapter` involvement, no
`ScenarioDefinition` change, no `evidence_schema_version` change. Additive, per Phase 9 PRD §37.

---

## 1. The problem

FleetLab metric names are bare strings that cross three boundaries with nothing binding them.

| Boundary | Location | What it does |
|---|---|---|
| Producer | `engine.py:240` `run_metrics` | Returns `dict[str, float]`: seven unconditional keys plus three conditional |
| Experiment layer | `experiment.py:167` `_DESCRIPTIVE_METRICS` | Hardcodes seven of those names in a tuple |
| Author | `contracts.py:82` `PrimaryMetric.name`, `contracts.py:96` `Guardrail.metric` | Accepts *any* string matching `min_length=1, max_length=64` |

Three consequences, all reachable today:

1. **Late failure on a typo.** A spec naming `wait.p95_s` validates cleanly, runs the determinism
   precheck, executes replications, and only then raises `primary metric wait.p95_s unavailable in
   some replication`. The spec was wrong at authoring time and the system said so at run time.
2. **Undeclared aliases.** `requests.served` and `business_proxy.served_trips` are the same
   integer under two names; so are `requests.unserved` and `business_proxy.unserved_demand`.
   Nothing records whether that is intentional. A comparison table can show a change "twice."
3. **No shared definition for a second consumer.** Any surface that displays fleet metrics —
   a report, a review page, an operator view — must re-derive unit, direction, and the meaning of
   absence from reading `run_metrics`. Two consumers can disagree silently.

Point 3 is the load-bearing one. **A consumer and the simulator that disagree about what
`wait.p90_s` means will silently disagree about whether a change worked.** Pre-production
experimentation is only worth running if the metric it reports is the metric anyone else reads.

Absence is already handled honestly — `run_metrics` omits a metric whose population is empty
rather than inventing a zero, and `_compare` returns `None` so the layer above reports
NOT_AVAILABLE. That discipline is correct and this design preserves it; what is missing is a
*declaration* of which metrics may legitimately be absent and why.

---

## 2. Design: `MetricDefinition` registry

One typed, versioned definition per metric, resolved by every producer and consumer.

Each definition carries:

- `name` — the canonical key, pattern-constrained to the existing `namespace.metric` shape.
- `unit` and `direction` (`lower_is_better` / `higher_is_better`) — today these live only in
  `PrimaryMetric`, restated by whoever authors a spec, and are absent for every descriptive metric.
- `population` — what the metric is computed over (completed requests, all vehicles, service-queue
  entries). This is what makes absence explainable.
- `aggregation` — count, fraction, mean, or a named percentile.
- `availability` — `ALWAYS`, or `CONDITIONAL` with the stated condition. The three conditional
  metrics (`wait.p50_s`, `wait.p90_s`, `depot.queue_p90_s`) become declared, not discovered.
- `calibration_state` — inherits the existing `CalibrationState` enum.
- `surfaces` — which consumers may display it. A business proxy is not a service metric and
  should not silently appear where one is expected.
- `alias_of` — set where a name is a deliberate alias, resolving consequence 2 by forcing the
  question at registration.

**Enforcement, in order of value:**

1. `ExperimentSpec` validation rejects a `primary_metric.name` or `guardrail.metric` that is not
   registered. The typo fails at authoring, with the registry's names available for the message.
   This is the change that pays for the design.
2. `_DESCRIPTIVE_METRICS` becomes a registry query, not a tuple that drifts from `run_metrics`.
3. A test asserts the registry and `run_metrics` agree exactly — every produced key is registered,
   every `ALWAYS` metric is produced by the analytical fixture.

The registry is versioned as its own schema, independent of `FleetScenarioConfig` 0.1 and
`DecisionRecord` 0.1, and the resolved registry version is recorded in the decision record so a
replay can tell whether a metric's meaning moved.

**Why a registry rather than an enum:** metrics carry properties (unit, direction, population,
availability), not just identity, and specs are authored in YAML by name. An enum would give
name-checking without the shared definition, which is the part that matters.

---

## 3. Design: static operator view

A read-only page rendering **one completed simulated run** through the registry: zone wait, fleet
availability, depot queue. Streamlit, reusing the existing `src/hermes/workbench/` pattern and its
`workbench` extra — no new dependency and no new stack.

Deliberately static. No time control, no refresh loop, no streaming. The point it proves is that a
second consumer reads the same definitions the experiment layer reads; a time axis would not
strengthen that claim.

The synthetic label is carried by the contract, not by page furniture:
`FleetScenarioConfig.label` is already the literal
`synthetic_fleet_scenario_not_calibrated_to_any_real_operation`, and `CalibrationState` is already
on the spec. The view renders both. A label that lives in the data cannot be forgotten by a
future page.

---

## 4. What this does not claim

- **Not real time.** It renders a finished run. There is no live feed, and no simulated one.
- **Not monitoring.** No alerting, no thresholds-as-alarms, no on-call, no SLOs.
- **Not calibrated.** `SYNTHETIC_UNCALIBRATED` throughout; no correspondence to any real operation
  is asserted or implied.
- **Not a fleet-management product.** It is one page proving one contract.

Per Phase 9 PRD §20, fleet outcomes stay separate from AV safety verdicts and
`deployment_permission` remains `NONE`.

---

## 5. Test strategy

- Registry/producer agreement, as above.
- Spec validation rejects an unregistered metric name, with the failure asserted at validation time
  rather than run time.
- The existing hand-computed three-request analytical fixture
  (`tests/unit/test_fleet_analytical_fixture.py`) gains registry assertions: every `ALWAYS` metric
  present, every `CONDITIONAL` metric present-or-absent for the declared reason.
- Alias declarations are asserted to produce equal values, so an alias that stops being one fails.
- Decision-record digests must be unchanged where the registry adds no field to recorded output;
  any digest movement is expected, explained, and re-baselined deliberately.

---

## 6. Risks

| Risk | Response |
|---|---|
| The registry becomes a second place to edit, drifting from `run_metrics` | The agreement test makes drift a red test, not a silent divergence |
| Adding `registry_version` to `DecisionRecord` moves its digest | Land it as one deliberate re-baseline, recorded, not as a side effect |
| The operator view grows toward a dashboard | Scope is fixed at one static page; anything more needs a named question first |
| Alias resolution changes displayed metric sets | Aliases are declared explicitly; the alias-equality test guards the semantics |

---

## 7. Sequencing

1. Registry with definitions for the existing ten names, plus the agreement test.
2. Spec validation against the registry; `_DESCRIPTIVE_METRICS` becomes a query.
3. `registry_version` into the decision record; deliberate digest re-baseline.
4. The static operator view.

Steps 1–2 are the design. Steps 3–4 are worth cutting first if time is short.

---

## 8. What was built and what was not (measured)

### Stage 1 — metric contract at authoring time

Stage 1 adds or changes only these product/configuration files:

- `src/hermes/fleet/metrics.py`, `contracts.py`, `experiment.py`, `cli.py`, `authoring.py`, and
  `__init__.py`;
- `config/fleet/fleet-005-turnaround.yaml` and
  `config/fleet/examples/invalid-unregistered-metric.yaml`;
- `tests/unit/test_fleet_demo_digest.py`, `test_fleet_metrics_registry.py`,
  `test_fleet_analytical_fixture.py`, `test_fleet_contracts_and_world.py`,
  `test_fleet_experiment.py`, `test_fleet_cli.py`, and `test_fleet_authoring.py`;
- `README.md`, `HERMES_SOURCE_OF_TRUTH.md`, and this design document.

The added tests are:

- `test_the_fleet_005_demo_record_digest_is_pinned`
- `test_the_fleet_005_spec_digest_is_pinned`
- `test_a_conditional_definition_must_state_when_it_is_absent`
- `test_an_always_definition_must_not_state_an_absence_condition`
- `test_a_metric_name_must_be_namespaced`
- `test_a_definition_is_frozen_and_rejects_unknown_fields`
- `test_metrics_module_imports_nothing_from_the_fleet_package`
- `test_the_hand_computed_world_satisfies_the_registry_declarations`
- `test_every_produced_metric_is_registered_and_in_registration_order`
- `test_every_always_metric_is_produced`
- `test_conditional_metrics_are_absent_for_their_declared_reason`
- `test_declared_aliases_carry_equal_values`
- `test_resolving_an_unknown_name_lists_the_registered_names`
- `test_descriptive_names_are_pinned_to_the_recorded_order`
- `test_the_registry_is_immutable`
- `test_the_registry_fails_closed_on_a_bad_alias`
- `test_an_unregistered_primary_metric_is_rejected_at_authoring_time`
- `test_an_unregistered_guardrail_metric_is_rejected`
- `test_a_direction_contradicting_the_registry_is_rejected`
- `test_a_unit_contradicting_the_registry_is_rejected`
- `test_a_neutral_metric_cannot_carry_a_claim`
- `test_descriptives_come_from_the_registry_not_a_tuple`
- `test_a_metric_added_to_the_registry_appears_without_editing_the_experiment_module`
- `test_metrics_list_prints_every_registered_definition_from_the_registry`
- `test_metrics_list_is_deterministic`
- `test_a_conditional_metric_groups_availability_and_absence_before_surfaces`
- `test_the_committed_fleet_005_spec_is_the_in_code_spec`
- `test_a_rendered_template_round_trips_to_the_same_digest`
- `test_the_committed_invalid_example_fails_at_authoring_time_with_the_fix`
- `test_malformed_yaml_is_an_authoring_error_not_a_yaml_exception`
- `test_malformed_yaml_errors_render_as_exactly_five_labelled_lines`
- `test_an_author_controlled_newline_cannot_spoof_an_error_label`
- `test_an_extra_key_and_a_missing_key_name_the_field`
- `test_an_oversized_spec_is_rejected_before_parsing`
- `test_a_path_resolution_failure_is_an_authoring_error`
- `test_runtime_and_os_errors_during_resolve_are_authoring_errors`
- `test_a_written_decision_record_reloads_to_the_same_digest`
- `test_experiment_validate_accepts_the_committed_spec`
- `test_experiment_validate_rejects_the_committed_invalid_example`
- `test_experiment_run_reproduces_the_demo_digest_from_the_committed_spec`
- `test_experiment_inspect_redigests_a_stored_record`
- `test_experiment_template_prints_a_loadable_spec`

Gate G measured `76 passed`; the architecture boundary gate measured `43 passed, 2 deselected`;
Ruff reported `All checks passed!`; and the artifact-bound full suite measured `186 failed, 1325
passed, 55 deselected, 42 errors` with `SAME_FAILURE_SET`. The pinned identities are:

- FLEET-005 spec: `b68f75d295e4ace1c4f3e470e52fde828a8b433eec2682f66596dbebbd5360c2`
- FLEET-005 decision record:
  `84ff1c91b600f29e3d3661d988339e1654db419d6ba500e7d79e616a58706e7f`

The digest-neutrality proof from Gate G is:

```text
Record digest:   84ff1c91b600f29e3d3661d988339e1654db419d6ba500e7d79e616a58706e7f
DEMO_BYTE_IDENTICAL
```

Clean-clone verification measured 2026-09-03 against the committed Task 6 tip:

```text
6983198
75 passed in 1.30s
Record digest:   84ff1c91b600f29e3d3661d988339e1654db419d6ba500e7d79e616a58706e7f
```

Six implementation deviations from the original design and planning notes are deliberate:

1. `MetricDefinition` has no `calibration_state`. Calibration belongs to the spec inputs and is
   already recorded on `ExperimentSpec` and `DecisionRecord`; copying it onto each metric would
   create competing sources and reverse the required `contracts -> metrics` import direction.
2. Registry order follows producer key order. A separate `descriptive_rank` preserves the existing
   digest-bearing descriptive order. `wait.p90_s`, `requests.total`, and `unserved.fraction` have no
   descriptive rank because adding them would change behavior before the deliberate Stage 2
   re-baseline.
3. Aliases must agree with targets on unit, direction, aggregation, availability, and absence
   semantics. `business_proxy.served_trips` therefore uses `requests`, because it is the same number
   as its target rather than a differently scaled measure.
4. Authoring checks the primary metric's unit as well as its direction. The equivalence margin uses
   that unit, so accepting a mismatch would silently rescale the decision boundary.
5. Authoring failures use `INVALID_EXPERIMENT_SPEC`; the completed-run invalidity value remains
   reserved for evidence voided by invariant or comparability failures.
6. The CLI follows the PRD's `hermes fleet experiment validate|run <yaml>` shape and adds one-step
   `template` and `inspect` commands. `experiment compare`, `scenario list`, `policy list`, and
   `studio` remain unbuilt.

Also deliberately deferred: recording the registry version in `DecisionRecord` and the static
operator view (Stage 2), plus the policy seam (Stage 3). Existing descriptive order, guardrail
overlap, alias double-reporting, and the empty-population `unserved.fraction` behavior are unchanged.
