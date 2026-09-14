import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, test } from "node:test";
import { fileURLToPath } from "node:url";

import { REFERENCE_PANELS } from "../src/model/reference-panels.js";

const FIXTURE_PATH = fileURLToPath(new URL("../../../tests/fixtures/fleet_playground/reference_panels.json", import.meta.url));
const MODULE_PATH = fileURLToPath(new URL("../src/model/reference-panels.js", import.meta.url));

/** First path where two JSON-shaped values differ (numbers by Object.is, keys in order), or null. */
function firstDifference(actual, expected, path = "$") {
  if (typeof expected === "number") return Object.is(actual, expected) ? null : path;
  if (expected === null || typeof expected !== "object") return actual === expected ? null : path;
  if (actual === null || typeof actual !== "object" || Array.isArray(actual) !== Array.isArray(expected)) return path;
  if (Object.keys(actual).join("\n") !== Object.keys(expected).join("\n")) return `${path} (keys)`;
  for (const key of Object.keys(expected)) {
    const found = firstDifference(actual[key], expected[key], `${path}.${key}`);
    if (found !== null) return found;
  }
  return null;
}

/** Whether a value and everything under it is frozen. */
function deeplyFrozen(value) {
  if (value === null || typeof value !== "object") return true;
  return Object.isFrozen(value) && Object.values(value).every(deeplyFrozen);
}

describe("reference panels", () => {
  test("the literal equals the regenerator's fixture, every number by Object.is", () => {
    const fixture = JSON.parse(readFileSync(FIXTURE_PATH, "utf8"));
    assert.equal(firstDifference(REFERENCE_PANELS, fixture), null);
    assert.deepStrictEqual(REFERENCE_PANELS, fixture);
    // A distinct double would fail: the fixture's FLEET-005 candidate mean is not a short decimal.
    assert.ok(Object.is(REFERENCE_PANELS.fleet005.primary.candidate_mean, fixture.fleet005.primary.candidate_mean));
  });

  test("is frozen at every depth", () => {
    assert.ok(deeplyFrozen(REFERENCE_PANELS));
    assert.throws(() => {
      "use strict";
      REFERENCE_PANELS.probe.primary.mean_delta = 1;
    }, TypeError);
  });

  test("the module is a literal: it reads no file and imports only the schema's freezer", () => {
    const source = readFileSync(MODULE_PATH, "utf8");
    const imports = [...source.matchAll(/^import .*$/gm)].map((m) => m[0]);
    assert.deepEqual(imports, ['import { deepFreeze } from "./schema.js";']);
    for (const token of ["readFileSync", "fetch", "import(", "JSON.parse", "node:"]) {
      assert.ok(!source.includes(token), `module holds ${token}`);
    }
  });
});
