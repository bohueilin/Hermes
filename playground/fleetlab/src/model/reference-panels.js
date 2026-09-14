// The two quoted FleetLab reference panels (contract section 5.2; design sections 1.3, 7.2 and Appendix A.9): the
// FLEET-005 record (measured) and the two-zone probe (exploratory), each as the design section 7.2 projection. Written
// from tests/fixtures/fleet_playground/reference_panels.json, which only the regenerator writes; this module never reads
// it. test/reference-panels.test.mjs requires deep equality with the fixture. Numbers are in each metric's unit and are
// the fixture's doubles exactly.

import { deepFreeze } from "./schema.js";

/** The frozen panels `{format, format_version, fleet005, probe}`; values in each metric's unit (seconds, counts, fractions). */
export const REFERENCE_PANELS = deepFreeze({
  format: "fleet-playground-reference-panels",
  format_version: 1,
  fleet005: {
    experiment_id: "fleet-005-turnaround",
    question: "Does a 25% longer depot service turnaround degrade rider wait p90 beyond the declared equivalence margin?",
    variation_axis: "parameter:service_duration_s",
    baseline_value: 1800,
    candidate_value: 2250,
    replications: 10,
    validity: "VALID",
    invalidity_reason: null,
    outcome: "REGRESSED",
    recommendation: "HOLD",
    primary: {
      metric: "wait.p90_s",
      direction: "lower_is_better",
      equivalence_margin: 30,
      baseline_mean: 793.1,
      candidate_mean: 1619.2500000000002,
      mean_delta: 826.15,
      median_delta: 768,
      ci_low: 735.9100000000001,
      ci_high: 919.1899999999998,
    },
    guardrails: [
      {
        metric: "unserved.fraction",
        direction: "lower_is_better",
        max_harm: 0.02,
        mean_delta: 0.0565410199556541,
        regressed: true,
      },
    ],
    descriptives: [
      {
        metric: "wait.p50_s",
        baseline_mean: 273.3,
        candidate_mean: 302.7,
        mean_delta: 29.4,
      },
      {
        metric: "requests.served",
        baseline_mean: 451,
        candidate_mean: 425.5,
        mean_delta: -25.5,
      },
      {
        metric: "requests.unserved",
        baseline_mean: 0,
        candidate_mean: 25.5,
        mean_delta: 25.5,
      },
      {
        metric: "depot.queue_p90_s",
        baseline_mean: 3000.7400000000007,
        candidate_mean: 10086.43,
        mean_delta: 7085.69,
      },
    ],
    suppressed: ["fleet.utilization_fraction", "business_proxy.served_trips", "business_proxy.unserved_demand"],
  },
  probe: {
    experiment_id: "bay-area-bay-outage-probe",
    question: "If the shared depot loses half its service bays, does rider wait p90 across San Francisco and San Jose degrade beyond the declared margin?",
    variation_axis: "parameter:service_bays",
    baseline_value: 4,
    candidate_value: 2,
    replications: 10,
    validity: "VALID",
    invalidity_reason: null,
    outcome: "UNCHANGED",
    recommendation: "NO_RECOMMENDATION",
    primary: {
      metric: "wait.p90_s",
      direction: "lower_is_better",
      equivalence_margin: 60,
      baseline_mean: 4487.6900000000005,
      candidate_mean: 4487.6900000000005,
      mean_delta: 0,
      median_delta: 0,
      ci_low: 0,
      ci_high: 0,
    },
    guardrails: [
      {
        metric: "unserved.fraction",
        direction: "lower_is_better",
        max_harm: 0.02,
        mean_delta: 0,
        regressed: false,
      },
    ],
    descriptives: [
      {
        metric: "wait.p50_s",
        baseline_mean: 1444.35,
        candidate_mean: 1444.35,
        mean_delta: 0,
      },
      {
        metric: "requests.served",
        baseline_mean: 131.7,
        candidate_mean: 131.7,
        mean_delta: 0,
      },
      {
        metric: "requests.unserved",
        baseline_mean: 97.3,
        candidate_mean: 97.3,
        mean_delta: 0,
      },
      {
        metric: "depot.queue_p90_s",
        baseline_mean: 146.33999999999997,
        candidate_mean: 2628.1599999999994,
        mean_delta: 2481.8199999999993,
      },
    ],
    suppressed: ["fleet.utilization_fraction", "business_proxy.served_trips", "business_proxy.unserved_demand"],
  },
});
