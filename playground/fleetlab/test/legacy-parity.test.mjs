import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { describe, test } from "node:test";
import { fileURLToPath } from "node:url";

import { sha256Hex } from "../src/core/sha256.js";
import {
  canonicalEvents,
  eventsDigest,
  legacyInvariants,
  legacyMetrics,
  runLegacyFleet,
  travelSeconds,
} from "../src/legacy/profile.js";
import { importLegacyWorlds } from "../src/legacy/world-import.js";

const FIXTURE_DIR = new URL("../../../tests/fixtures/fleet_playground/", import.meta.url);

// Contract section 5.1: every legacy fixture file and the worlds it must hold.
const LEGACY_FILES = {
  "legacy_fleet005_seed101.json": ["baseline", "candidate"],
  "legacy_analytical.json": ["analytical"],
  "legacy_collision.json": ["collision"],
  "legacy_precheck_world_fed_axis.json": ["precheck", "paired"],
  "legacy_fl11_horizon_crash.json": ["crash"],
  "legacy_defect.json": ["defect", "defect_seed101"],
};

/** Load and import one fixture written by the Python regenerator; a missing file is a failure, never a skip. */
function loadWorlds(file) {
  const path = fileURLToPath(new URL(file, FIXTURE_DIR));
  assert.ok(existsSync(path), `legacy fixture is missing: ${path}`);
  return importLegacyWorlds(JSON.parse(readFileSync(path, "utf8")));
}

/** Count events by kind, as the fixture's `event_counts` does. */
function countByKind(events) {
  const counts = {};
  for (const [, kind] of events) counts[kind] = (counts[kind] ?? 0) + 1;
  return counts;
}

/** Metric maps must hold the same keys and bit-identical doubles (Object.is keeps -0 apart from 0). */
function assertMetricsExact(actual, expected, label) {
  assert.deepEqual(Object.keys(actual).sort(), Object.keys(expected).sort(), `${label}: metric keys`);
  for (const [name, value] of Object.entries(expected)) {
    assert.ok(Object.is(actual[name], value), `${label}: ${name} expected ${value}, got ${actual[name]}`);
  }
}

/** Compare event logs entry by entry and report the first differing index with both entries. */
function assertEventsExact(actual, expected, label) {
  const shared = Math.min(actual.length, expected.length);
  for (let i = 0; i < shared; i++) {
    const a = actual[i];
    const e = expected[i];
    if (a.length !== 3 || a[0] !== e[0] || a[1] !== e[1] || a[2] !== e[2]) {
      assert.fail(`${label}: first differing event at index ${i}: expected ${JSON.stringify(e)}, got ${JSON.stringify(a)}`);
    }
  }
  if (actual.length !== expected.length) {
    const i = shared;
    assert.fail(
      `${label}: event logs differ in length (expected ${expected.length}, got ${actual.length}); first differing index ${i}: ` +
        `expected ${JSON.stringify(expected[i] ?? null)}, got ${JSON.stringify(actual[i] ?? null)}`,
    );
  }
}

describe("legacy profile parity with FleetLab's exported worlds", () => {
  for (const [file, names] of Object.entries(LEGACY_FILES)) {
    describe(file, () => {
      test("holds exactly the declared worlds", () => {
        assert.deepEqual([...loadWorlds(file).keys()].sort(), [...names].sort());
      });

      for (const name of names) {
        test(`world ${name}`, () => {
          const world = loadWorlds(file).get(name);
          const { expected } = world;
          const label = `${file} ${name}`;
          if (expected.error !== null) {
            assert.throws(
              () => runLegacyFleet(world.scenario, world.tape, { dispatchMode: world.dispatchMode }),
              (error) => {
                assert.equal(error.name, expected.error, `${label}: error type`);
                if (error.name === "ValueError") assert.equal(error.message, "list.remove(x): x not in list");
                return true;
              },
            );
            return;
          }
          const log = runLegacyFleet(world.scenario, world.tape, { dispatchMode: world.dispatchMode });
          const events = canonicalEvents(log);
          assertEventsExact(events, expected.events, label);
          assert.equal(eventsDigest(events), expected.events_digest, `${label}: events digest`);
          assert.equal(sha256Hex(JSON.stringify(expected.events)), expected.events_digest, `${label}: fixture digest is over JSON.stringify(events)`);
          assert.deepEqual(countByKind(events), expected.event_counts, `${label}: event counts`);
          assertMetricsExact(legacyMetrics(log), expected.metrics, label);
          assert.deepEqual(legacyInvariants(log), expected.invariant_violations, `${label}: invariant violations`);
        });
      }
    });
  }

  test("only the seeded-defect worlds hold invariant violations", () => {
    for (const [file, names] of Object.entries(LEGACY_FILES)) {
      for (const name of names) {
        const { dispatchMode, expected } = loadWorlds(file).get(name);
        if (expected.error !== null) continue;
        assert.equal(expected.invariant_violations.length > 0, dispatchMode === "defect_double_assign", `${file} ${name}`);
      }
    }
    assert.deepEqual(loadWorlds("legacy_defect.json").get("defect").expected.invariant_violations, [
      "I2: vehicle v-0 overlaps r1 and r2 (700 < 1200)",
    ]);
  });

  test("the crash world is an error world and the others are normal", () => {
    assert.equal(loadWorlds("legacy_fl11_horizon_crash.json").get("crash").expected.error, "ValueError");
    for (const [file, names] of Object.entries(LEGACY_FILES)) {
      if (file === "legacy_fl11_horizon_crash.json") continue;
      for (const name of names) assert.equal(loadWorlds(file).get(name).expected.error, null, `${file} ${name}`);
    }
  });
});

describe("analytical world (hand-derived, independent of any fixture)", () => {
  // tests/unit/test_fleet_analytical_fixture.py: one vehicle starting in zone a; a<->b 600 s; in-zone pickup 120 s;
  // every multiplier 1.0; service after every 2 trips, one bay, 500 s; horizon 4000 s; max wait 1000 s.
  const scenario = {
    name: "analytical",
    horizon_s: 4000,
    zones: ["a", "b"],
    travel_time_s: { "a->b": 600, "b->a": 600 },
    vehicle_count: 1,
    max_wait_s: 1000,
    trips_between_service: 2,
    service_bays: 1,
    service_duration_s: 500,
    in_zone_pickup_s: 120,
    travel_sigma: 0,
  };
  const tape = {
    seed: 0,
    demand: [
      { request_id: "r1", time_s: 0, origin: "a", destination: "b" },
      { request_id: "r2", time_s: 100, origin: "b", destination: "a" },
      { request_id: "r3", time_s: 2000, origin: "a", destination: "b" },
    ],
    travel_multiplier: new Map([["r1", 1.0], ["r2", 1.0], ["r3", 1.0]]),
  };
  // The analytical event log, derived step by step in the first test below.
  const ANALYTICAL_EVENTS = [
    [0, "REQUEST_CREATED", "r1"],
    [0, "REQUEST_ASSIGNED", "r1"],
    [100, "REQUEST_CREATED", "r2"],
    [120, "PICKUP_COMPLETED", "r1"],
    [720, "TRIP_COMPLETED", "r1"],
    [720, "REQUEST_ASSIGNED", "r2"],
    [840, "PICKUP_COMPLETED", "r2"],
    [1440, "TRIP_COMPLETED", "r2"],
    [1440, "SERVICE_QUEUE_ENTERED", "v-0"],
    [1440, "SERVICE_STARTED", "v-0"],
    [1940, "SERVICE_COMPLETED", "v-0"],
    [2000, "REQUEST_CREATED", "r3"],
    [2000, "REQUEST_ASSIGNED", "r3"],
    [2120, "PICKUP_COMPLETED", "r3"],
    [2720, "TRIP_COMPLETED", "r3"],
  ];
  /** A tape of `[request_id, time_s, origin, destination]` rows, every multiplier 1.0. */
  const unitTape = (rows) => ({
    seed: 0,
    demand: rows.map(([request_id, time_s, origin, destination]) => ({ request_id, time_s, origin, destination })),
    travel_multiplier: new Map(rows.map(([request_id]) => [request_id, 1.0])),
  });
  /** A request's final `_Request` fields. */
  const request = (request_id, time_s, origin, destination, state, assigned_vehicle_id, pickup_time_s) => ({
    request_id,
    time_s,
    origin,
    destination,
    state,
    assigned_vehicle_id,
    pickup_time_s,
  });

  test("event log, pickups, completions and service", () => {
    const log = runLegacyFleet(scenario, tape);
    // Pushes in tape order: r1 created t0 (seq 0), deadline 1000 (1); r2 100 (2), 1100 (3); r3 2000 (4), 3000 (5).
    // t0     r1 created; v-0 idle in a: pickup 0 + 120 = 120 (seq 6), drop-off 120 + 600 = 720 (seq 7).
    // t100   r2 created; no idle car, it waits.
    // t720   r1 completes; v-0 in b, 1 trip < 2, idle; r2 assigned: pickup 720 + 120 = 840, drop-off 840 + 600 = 1440.
    // t1000  r1 deadline: completed, nothing. t1100 r2 deadline: assigned, nothing.
    // t1440  r2 completes; v-0 in a, 2 trips: queue entered, its own try at 1440 finds the bay free, service to
    //        1440 + 500 = 1940.
    // t2000  r3 created; v-0 idle in a: pickup 2000 + 120 = 2120, drop-off 2120 + 600 = 2720. t3000 deadline: nothing.
    assert.deepEqual(canonicalEvents(log), ANALYTICAL_EVENTS);
    // FleetLab sets pickup_time_s at assignment.
    assert.deepEqual([...log.requests.values()].map((r) => r.pickup_time_s), [120, 840, 2120]);
    const completed = Object.fromEntries(log.events.filter(([, kind]) => kind === "TRIP_COMPLETED").map(([t, , id]) => [id, t]));
    assert.deepEqual(completed, { r1: 720, r2: 1440, r3: 2720 });
    // Busy time runs from assignment to drop-off: (720 - 0) + (1440 - 720) + (2720 - 2000) = 2160.
    assert.equal(log.vehicles.get("v-0").busy_total_s, 2160);
    assert.deepEqual(log.service_queue_waits_s, [0]);
    assert.equal(log.max_bays_in_use, 1);
    assert.deepEqual(legacyInvariants(log), []);
  });

  test("final vehicle and request state follow _Vehicle and _Request", () => {
    const log = runLegacyFleet(scenario, tape);
    // v-0: r1 and r2 make two trips, so the service at 1440 resets trips_since_service to 0; r3 makes it 1 < 2 and
    // completed_trips 3. r3 drops off in b at 2720, which clears current_request_id and leaves the car IDLE.
    // busy_since_s is r3's assignment second 2000; busy_total_s is 720 + 720 + 720 = 2160.
    assert.deepEqual([...log.vehicles.values()], [
      {
        vehicle_id: "v-0",
        zone: "b",
        status: "IDLE",
        trips_since_service: 1,
        completed_trips: 3,
        busy_since_s: 2000,
        busy_total_s: 2160,
        current_request_id: null,
      },
    ]);
    assert.deepEqual([...log.requests.values()], [
      request("r1", 0, "a", "b", "COMPLETED", "v-0", 120),
      request("r2", 100, "b", "a", "COMPLETED", "v-0", 840),
      request("r3", 2000, "a", "b", "COMPLETED", "v-0", 2120),
    ]);
  });

  test("metrics", () => {
    const metrics = legacyMetrics(runLegacyFleet(scenario, tape));
    // Waits: r1 120 - 0 = 120, r2 840 - 100 = 740, r3 2120 - 2000 = 120; sorted [120, 120, 740].
    // p50: position (3 - 1) * 0.5 = 1.0, so 120 + (740 - 120) * 0.0 = 120.
    // p90: position (3 - 1) * 0.9 = 1.8; 1.8 - 1 is the double nearest 0.8; 620 * that rounds to 496; 120 + 496 = 616.0.
    // Utilization: 2160 / (4000 * 1) = 0.54. Queue waits [0]: position 0, so 0.
    assert.deepEqual(Object.keys(metrics), [
      "requests.total",
      "requests.served",
      "requests.unserved",
      "unserved.fraction",
      "fleet.utilization_fraction",
      "business_proxy.served_trips",
      "business_proxy.unserved_demand",
      "wait.p50_s",
      "wait.p90_s",
      "depot.queue_p90_s",
    ]);
    const expected = {
      "requests.total": 3.0,
      "requests.served": 3.0,
      "requests.unserved": 0.0,
      "unserved.fraction": 0.0, // 0 unserved / 3 requests
      "fleet.utilization_fraction": 0.54,
      "business_proxy.served_trips": 3.0,
      "business_proxy.unserved_demand": 0.0,
      "wait.p50_s": 120.0,
      "wait.p90_s": 616.0,
      "depot.queue_p90_s": 0.0,
    };
    assertMetricsExact(metrics, expected, "analytical");
  });

  test("a world with no requests has unserved fraction 0.0 and no wait or queue metrics", () => {
    // unserved / len(requests) if requests else 0.0; no completed request, so no wait percentiles; no service start.
    const metrics = legacyMetrics(runLegacyFleet(scenario, { seed: 0, demand: [], travel_multiplier: new Map() }));
    assert.ok(Object.is(metrics["unserved.fraction"], 0));
    assert.ok(Object.is(metrics["fleet.utilization_fraction"], 0)); // 0 busy seconds / 4000
    assert.ok(!("wait.p90_s" in metrics) && !("wait.p50_s" in metrics) && !("depot.queue_p90_s" in metrics));
  });

  test("a doubled service delays r3 exactly the hand-computed amount", () => {
    // Service 1000 s ends at 1440 + 1000 = 2440 > 2000, so r3 waits and is assigned at 2440: pickup 2440 + 120 = 2560.
    const log = runLegacyFleet({ ...scenario, service_duration_s: 1000 }, tape);
    assert.deepEqual([...log.requests.values()].map((r) => r.pickup_time_s), [120, 840, 2560]);
  });

  test("travel seconds round exact halves to even, as Python round does", () => {
    // No exported world holds a product base x multiplier that is exactly an even integer plus one half, so this case
    // is hand-derived. 0.1875 is 3/16, exact in binary: 120 x 0.1875 = 22.5 and 600 x 0.1875 = 112.5, both exact.
    // Python round(22.5) = 22 and round(112.5) = 112 (halves to the even neighbour); round-half-up would give 23 and
    // 113. An odd lower neighbour rounds up either way: 120 x 0.0625 = 7.5 gives 8.
    assert.equal(travelSeconds(scenario, "a", "a", 0.1875), 22);
    assert.equal(travelSeconds(scenario, "a", "b", 0.1875), 112);
    assert.equal(travelSeconds(scenario, "a", "a", 0.0625), 8);
    // max(1, ...): 120 x 0.001 = 0.12 rounds to 0, so the floor of one second applies.
    assert.equal(travelSeconds(scenario, "a", "a", 0.001), 1);

    // The same halves through the engine: r1 (multiplier 0.1875) is assigned at 0, picked up at 0 + 22 = 22 and
    // dropped in b at 22 + 112 = 134. v-0 has 1 trip < 2, so it is idle and takes r2 (in b, multiplier 1.0) at 134:
    // pickup 134 + 120 = 254, drop-off 254 + 600 = 854, second trip, service 854 to 854 + 500 = 1354. r3 at 2000 as
    // before: pickup 2120, drop-off 2720. Busy time (134 - 0) + (854 - 134) + (2720 - 2000) = 1574.
    const halves = { ...tape, travel_multiplier: new Map([["r1", 0.1875], ["r2", 1.0], ["r3", 1.0]]) };
    const log = runLegacyFleet(scenario, halves);
    assert.deepEqual([...log.requests.values()].map((r) => r.pickup_time_s), [22, 254, 2120]);
    assert.deepEqual(
      log.events.filter(([, kind]) => kind === "TRIP_COMPLETED").map(([t, , id]) => [t, id]),
      [[134, "r1"], [854, "r2"], [2720, "r3"]],
    );
    assert.equal(log.vehicles.get("v-0").busy_total_s, 1574);
  });

  test("a deadline for a skipped arrival raises FleetLab's ValueError (FL-11)", () => {
    // Horizon 1000: r3 at 2000 > 1000 is skipped and never joins the waiting list, but still WAITING at its deadline
    // 3000, so waiting.remove raises.
    assert.throws(
      () => runLegacyFleet({ ...scenario, horizon_s: 1000 }, tape),
      (error) => error.name === "ValueError" && error.message === "list.remove(x): x not in list",
    );
  });

  test("an arrival exactly at the horizon is still created and served", () => {
    // Horizon 2000: r3 arrives at 2000 and the guard is now_s > horizon_s; 2000 > 2000 is false, so r3 is created,
    // assigned and served exactly as with horizon 4000. Nothing in the event log depends on the horizon after that.
    assert.deepEqual(canonicalEvents(runLegacyFleet({ ...scenario, horizon_s: 2000 }, tape)), ANALYTICAL_EVENTS);
  });

  test("a wait deadline in the same second as a later arrival pops first (tape push order)", () => {
    // Pushes in tape order, REQUEST_CREATED then WAIT_DEADLINE per request: r1 0/1, r2 2/3, r3 4/5, r4 6/7.
    // t0     r1 created; v-0 idle in a: pickup 0 + 120 = 120, drop-off 120 + 600 = 720.
    // t100   r2 created and t200 r3 created; no idle car, both wait.
    // t720   r1 completes in b, 1 trip < 2, idle; r2 (first waiting) assigned: pickup 720 + 120 = 840, drop-off 1440.
    // t1000  r1 deadline and t1100 r2 deadline: neither is waiting.
    // t1200  r3's deadline (1200, seq 5) pops before r4's creation (1200, seq 6): r3 is still waiting, so it is
    //        unserved first, then r4 is created and waits.
    // t1440  r2 completes in a, 2 trips: queue, own try at 1440 wins the bay, service to 1440 + 500 = 1940.
    // t1940  service completes, v-0 idle in a; r4 (a) assigned: pickup 1940 + 120 = 2060, drop-off 2060 + 600 = 2660.
    // t2200  r4 deadline: assigned, nothing.
    const log = runLegacyFleet(scenario, unitTape([["r1", 0, "a", "b"], ["r2", 100, "b", "a"], ["r3", 200, "a", "b"], ["r4", 1200, "a", "b"]]));
    assert.deepEqual(canonicalEvents(log), [
      [0, "REQUEST_CREATED", "r1"],
      [0, "REQUEST_ASSIGNED", "r1"],
      [100, "REQUEST_CREATED", "r2"],
      [120, "PICKUP_COMPLETED", "r1"],
      [200, "REQUEST_CREATED", "r3"],
      [720, "TRIP_COMPLETED", "r1"],
      [720, "REQUEST_ASSIGNED", "r2"],
      [840, "PICKUP_COMPLETED", "r2"],
      [1200, "REQUEST_UNSERVED", "r3"],
      [1200, "REQUEST_CREATED", "r4"],
      [1440, "TRIP_COMPLETED", "r2"],
      [1440, "SERVICE_QUEUE_ENTERED", "v-0"],
      [1440, "SERVICE_STARTED", "v-0"],
      [1940, "SERVICE_COMPLETED", "v-0"],
      [1940, "REQUEST_ASSIGNED", "r4"],
      [2060, "PICKUP_COMPLETED", "r4"],
      [2660, "TRIP_COMPLETED", "r4"],
    ]);
    // Service reset the counter after r2; r4 makes it 1. Busy time 720 + 720 + (2660 - 1940) = 2160.
    assert.deepEqual(log.vehicles.get("v-0"), {
      vehicle_id: "v-0",
      zone: "b",
      status: "IDLE",
      trips_since_service: 1,
      completed_trips: 3,
      busy_since_s: 1940,
      busy_total_s: 2160,
      current_request_id: null,
    });
    assert.deepEqual([...log.requests.values()], [
      request("r1", 0, "a", "b", "COMPLETED", "v-0", 120),
      request("r2", 100, "b", "a", "COMPLETED", "v-0", 840),
      request("r3", 200, "a", "b", "UNSERVED", null, null),
      request("r4", 1200, "a", "b", "COMPLETED", "v-0", 2060),
    ]);
  });

  describe("the seeded double-assign defect", () => {
    // One car v-0 starts in a. r1 (b->a) at 0: pickup 0 + 600 (a->b) = 600, drop-off 600 + 600 = 1200; its pickup
    // sets v-0 ON_TRIP in r1's origin, b. r2 (a->b) at 700: no car is idle, so the defect takes the smallest-id busy
    // car once, v-0, still on r1 and in b: pickup 700 + 600 (b->a) = 1300, drop-off 1300 + 600 = 1900.
    const defectTape = unitTape([["r1", 0, "b", "a"], ["r2", 700, "a", "b"]]);

    test("assigns the busy car at 700 and picks up from the zone set at pickup", () => {
      const log = runLegacyFleet(scenario, defectTape, { dispatchMode: "defect_double_assign" });
      // At 1200 r1 drops off in a (1 trip); at 1300 r2's pickup moves v-0 to a; at 1900 it drops off in b, 2 trips:
      // queue and service 1900 to 2400.
      assert.deepEqual(canonicalEvents(log), [
        [0, "REQUEST_CREATED", "r1"],
        [0, "REQUEST_ASSIGNED", "r1"],
        [600, "PICKUP_COMPLETED", "r1"],
        [700, "REQUEST_CREATED", "r2"],
        [700, "REQUEST_ASSIGNED", "r2"],
        [1200, "TRIP_COMPLETED", "r1"],
        [1300, "PICKUP_COMPLETED", "r2"],
        [1900, "TRIP_COMPLETED", "r2"],
        [1900, "SERVICE_QUEUE_ENTERED", "v-0"],
        [1900, "SERVICE_STARTED", "v-0"],
        [2400, "SERVICE_COMPLETED", "v-0"],
      ]);
      assert.deepEqual([...log.requests.values()].map((r) => r.pickup_time_s), [600, 1300]);
      // busy_since_s is overwritten to 700 by r2's assignment, so r1 adds 1200 - 700 = 500 and r2 adds
      // 1900 - 700 = 1200: busy_total_s 1700. The service resets trips_since_service to 0.
      assert.deepEqual(log.vehicles.get("v-0"), {
        vehicle_id: "v-0",
        zone: "b",
        status: "IDLE",
        trips_since_service: 0,
        completed_trips: 2,
        busy_since_s: 700,
        busy_total_s: 1700,
        current_request_id: null,
      });
      // Spans by (assigned, completed): r1 [0, 1200], r2 [700, 1900]; 700 < 1200.
      assert.deepEqual(legacyInvariants(log), ["I2: vehicle v-0 overlaps r1 and r2 (700 < 1200)"]);
      // Utilization 1700 / (4000 * 1) = 0.425.
      assert.ok(Object.is(legacyMetrics(log)["fleet.utilization_fraction"], 0.425));
    });

    test("nearest dispatch on the same tape waits for r1 and reports nothing", () => {
      // r2 waits until r1 drops off in a at 1200; v-0 has 1 trip < 2, is idle, and takes r2 (origin a) at 1200:
      // pickup 1200 + 120 = 1320.
      const log = runLegacyFleet(scenario, defectTape);
      assert.deepEqual([...log.requests.values()].map((r) => r.pickup_time_s), [600, 1320]);
      assert.deepEqual(legacyInvariants(log), []);
    });
  });
});
