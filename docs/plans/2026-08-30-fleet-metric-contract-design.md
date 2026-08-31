# FleetLab metric contract and operator view — design

**Status:** design proposal, not implemented.
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
