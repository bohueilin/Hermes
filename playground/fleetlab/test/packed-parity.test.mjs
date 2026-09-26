// Actual offline artifact parity: source runtime payloads and fake-DOM initialization.
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";
import { test } from "node:test";
import vm from "node:vm";
import { buildHtml, buildSite, bundle } from "../tools/pack.mjs";
import { installFakeDom } from "./helpers/fake-dom.mjs";
import { presetScenario, runThroughWorkerHandler } from "./helpers/model-payloads.mjs";

const root = fileURLToPath(new URL("../", import.meta.url));
const html = buildHtml(root);
const workerSource = JSON.parse(/const FLEETLAB_WORKER_SOURCE = ("(?:[^"\\]|\\.)*");/.exec(html)[1]);
const digest = (value) => createHash("sha256").update(JSON.stringify(value)).digest("hex");

test("offline stripping is opt-in; default bundle and native site retain source comments", () => {
  const options = { sourceRoot: `${root}src`, globalName: "Worker" };
  const original = bundle(`${root}src/runtime/worker.js`, options);
  assert.equal(bundle(`${root}src/runtime/worker.js`, { ...options, stripComments: false }), original);
  assert.ok(original.includes("// Engine worker entry"));
  assert.ok(!workerSource.includes("// Engine worker entry"));
  const site = buildSite(root);
  assert.ok(site.get("src/runtime/worker.js").includes("// Engine worker entry"));
});

test("packed offline worker matches native fixed-seed event digest, world digest, metrics and series", async () => {
  const messages = [];
  const queue = [];
  class WorkerGlobalScope {
    postMessage(message) { messages.push(structuredClone(message)); }
  }
  const self = new WorkerGlobalScope();
  const context = vm.createContext({ self, WorkerGlobalScope, performance: { now: () => 0 }, setTimeout: (fn) => queue.push(fn) });
  new vm.Script(workerSource).runInContext(context);
  const request = { type: "run_window", id: "offline-parity", scenario: presetScenario(), seeds: [1001], logSeed: 1001 };
  const native = (await runThroughWorkerHandler(request)).payload;
  context.requestJSON = JSON.stringify(request);
  new vm.Script("self.onmessage({ data: JSON.parse(requestJSON) });").runInContext(context);
  let result;
  for (let turn = 0; turn < 1000; turn += 1) {
    while (queue.length) queue.shift()();
    await new Promise((resolve) => setImmediate(resolve));
    result = messages.find((m) => m.id === request.id && (m.type === "result" || m.type === "error"));
    if (result) break;
  }
  assert.ok(result, "worker responds within the bounded queue drain");
  assert.equal(result.type, "result", result.message);
  const packed = result.payload;
  assert.ok(native.log.events.length > 1000);
  assert.equal(digest(packed.log.events), digest(native.log.events), "event-log SHA-256");
  assert.deepEqual(packed.runs.map((r) => r.world_digest), native.runs.map((r) => r.world_digest));
  assert.deepEqual(packed.runs.map((r) => r.metrics), native.runs.map((r) => r.metrics));
  assert.deepEqual(packed.runs.map((r) => r.series), native.runs.map((r) => r.series));
  assert.deepEqual(packed, native, "all payload fields match, including log events");
});

test("the actual stripped offline page initializes its studio on the fake DOM", async () => {
  const context = vm.createContext({ console, performance, setTimeout, clearTimeout, URL, URLSearchParams, Blob });
  const uninstall = installFakeDom(context);
  const document = uninstall.dom.document;
  const shell = document.createElement("div");
  shell.id = "fleetlab-root";
  const strip = document.createElement("div");
  strip.id = "fleetlab-teaching-strip";
  shell.append(strip);
  document.body.append(shell);
  context.Worker = class {
    constructor() { queueMicrotask(() => this.onmessage?.({ data: { type: "ready" } })); }
    postMessage() {}
    terminate() {}
  };
  let app;
  try {
    const script = /<script>\n([\s\S]*)\n<\/script>/.exec(html)[1];
    app = new vm.Script(script).runInContext(context);
    await app.host.ready;
    assert.ok(app.studio.element.isConnected);
    assert.ok(document.querySelectorAll("button").length > 10, "real studio controls mounted");
    assert.ok(app.studio.element.textContent.includes("FleetLab"));
  } finally {
    app?.destroy();
    uninstall();
  }
});
