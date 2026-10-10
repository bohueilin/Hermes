// NF-03 packaging (plan Task C4): the hosted site carries the recorded capacity viewer as a second page at
// network-flows/capacity/, check-dist holds that page to the root page's rules, and the offline single file never
// reaches the capacity modules.

import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readdirSync, readFileSync, realpathSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

import { checkSite, COPY_MODULES, labelsFromContracts } from "../tools/check-dist.mjs";
import { APP_MAX_BYTES } from "../tools/media.mjs";
import { releaseProblems } from "../tools/release-sidecar.mjs";
import { buildHtml, buildSite, moduleGraph, MODULE_MARKER, SITE_CAPACITY_BOOT, SITE_CONTENT_SECURITY_POLICY } from "../tools/pack.mjs";

const PLAYGROUND_ROOT = fileURLToPath(new URL("../", import.meta.url));
const REPO_ROOT = realpathSync(fileURLToPath(new URL("../../../", import.meta.url)));
const labels = labelsFromContracts(REPO_ROOT);
const CAPACITY_INDEX = "network-flows/capacity/index.html";
const CAPACITY_BOOT = "network-flows/capacity/boot.js";
const CAPACITY_MODULES = [
  "src/ui/capacity-app.js", "src/ui/depot-capacity-page.js", "src/ui/depot-capacity-view.js", "src/ui/depot-capacity-bench.js", "src/ui/depot-capacity-guided.js", "src/data/depot-capacity-study.js",
  "src/model/depot-capacity-contract.js", "src/model/depot-capacity.js", "src/model/depot-capacity-verify.js",
];
const STYLESHEET = '<link rel="stylesheet" href="../../styles.css">';
const VISUAL_STYLESHEET = '<link rel="stylesheet" href="./visual.css">';
const BOOT_SCRIPT = '<script type="module" src="./boot.js"></script>';
const site = buildSite(PLAYGROUND_ROOT);
const variant = (path, text) => {
  const files = new Map(site);
  if (text === null) files.delete(path);
  else files.set(path, text);
  return files;
};
const problemsOf = (files) => checkSite(files, { requiredLabels: labels });

test("the hosted site holds the capacity page, its boot module and every capacity module unchanged", () => {
  assert.equal(labels.length, 5);
  assert.equal(site.get(CAPACITY_BOOT), SITE_CAPACITY_BOOT);
  assert.equal(SITE_CAPACITY_BOOT, 'import { startCapacity } from "../../src/ui/capacity-app.js";\nstartCapacity();\n');
  const page = site.get(CAPACITY_INDEX);
  const head = /<head\b[^>]*>/i.exec(page);
  assert.ok(page.startsWith(`<meta http-equiv="Content-Security-Policy" content="${SITE_CONTENT_SECURITY_POLICY}">`, head.index + head[0].length), "the site policy is the first element in head");
  assert.deepEqual(page.match(/<link\b[^>]*>/gi), [STYLESHEET,VISUAL_STYLESHEET]);
  assert.deepEqual(page.match(/<script\b[^>]*>[\s\S]*?<\/script\s*>/gi), [BOOT_SCRIPT]);
  assert.ok(page.includes(`${STYLESHEET}\n${VISUAL_STYLESHEET}\n</head>`) && page.includes(`${BOOT_SCRIPT}\n</body>`));
  assert.ok(!/import\s*\{|startCapacity/.test(page), "no inline script is left");
  assert.ok(page.includes('<div id="capacity-root" class="fl-app"></div>'));
  assert.ok(page.includes("<title>Scheduling or capacity? | FleetLab</title>"));
  for (const path of CAPACITY_MODULES) assert.equal(site.get(path), readFileSync(join(PLAYGROUND_ROOT, path), "utf8"), path);
  for (const record of moduleGraph(join(PLAYGROUND_ROOT, "src/ui/capacity-app.js"), join(PLAYGROUND_ROOT, "src")).order) {
    assert.equal(site.get(record.label), record.src, record.label);
  }
});

test("check-dist accepts the real site, and the site code stays under the byte cap", () => {
  assert.deepEqual(problemsOf(site), []);
  const codeBytes = [...site.values()].filter((v) => typeof v === "string").reduce((sum, text) => sum + Buffer.byteLength(text), 0);
  assert.ok(codeBytes < APP_MAX_BYTES, `${codeBytes} bytes of site code`);
});

test("check-dist refuses a changed capacity boot, a second script, a missing capacity file and a fetch in the entry", () => {
  const expect = (files, pattern) => {
    const problems = problemsOf(files);
    assert.ok(problems.some((p) => pattern.test(p)), `expected ${pattern} in ${JSON.stringify(problems)}`);
  };
  expect(variant(CAPACITY_BOOT, SITE_CAPACITY_BOOT.replace("startCapacity();", "startCapacity;;")), /^boot: network-flows\/capacity\/boot\.js differs/);
  expect(variant(CAPACITY_INDEX, site.get(CAPACITY_INDEX).replace("</body>", "<script>startCapacity()</script>\n</body>")), /^network-flows\/capacity\/index\.html: expected exactly one module script/);
  expect(variant(CAPACITY_INDEX, null), /^file: network-flows\/capacity\/index\.html is missing/);
  expect(variant(CAPACITY_BOOT, null), /^file: network-flows\/capacity\/boot\.js is missing/);
  expect(variant("src/ui/capacity-app.js", `${site.get("src/ui/capacity-app.js")}const study = fetch("./study.json");\n`), /^forbidden token in src\/ui\/capacity-app\.js: fetch\(/);
  expect(variant("src/data/depot-capacity-study.js", `${site.get("src/data/depot-capacity-study.js")}export const more = import("./x.js");\n`), /^forbidden token in src\/data\/depot-capacity-study\.js: import\(/);
});

test("the copy rules name every capacity interface and model module; the generated study manifest gets the generic rules", () => {
  for (const dir of ["ui", "model"]) {
    for (const name of readdirSync(join(PLAYGROUND_ROOT, "src", dir)).filter((n) => /^depot-capacity.*\.js$/.test(n))) assert.ok(COPY_MODULES.includes(`src/${dir}/${name}`), name);
  }
  for (const path of ["src/ui/capacity-app.js", "src/ui/depot-capacity-page.js", "src/ui/depot-capacity-view.js", "src/model/depot-capacity-contract.js", "src/model/depot-capacity.js", "src/model/depot-capacity-verify.js"]) {
    assert.ok(COPY_MODULES.includes(path), path);
  }
  assert.ok(!COPY_MODULES.includes("src/data/depot-capacity-study.js"));
});

test("the offline single file never reaches the capacity viewer and stays within the cap", () => {
  const html = buildHtml(PLAYGROUND_ROOT);
  assert.ok(!html.includes(`${MODULE_MARKER}src/ui/capacity-app.js`));
  assert.ok(!new RegExp(`^${MODULE_MARKER.replace(/[/]/g, "\\/")}\\S*depot-capacity`, "m").test(html), "no depot-capacity module marker");
  assert.ok(!html.includes(".fl-capacity-bench"), "hosted bench CSS is absent");
  assert.ok(!html.includes("fleetlab.capacity-release/"), "release sidecar is absent");
  assert.ok(Buffer.byteLength(html) <= APP_MAX_BYTES - 50_000, "the offline reserve remains available");
});

test("capacity packages route-local CSS with strict missing, changed and unexpected-file checks", () => {
  const path = "network-flows/capacity/visual.css";
  assert.ok(site.has(path), "hosted capacity stylesheet is packaged");
  assert.equal(site.get(path), readFileSync(join(PLAYGROUND_ROOT, "capacity/visual.css"), "utf8"));
  assert.ok(problemsOf(variant(path, null)).some(p => p.includes(path) && p.includes("missing")));
  assert.ok(problemsOf(variant(path, site.get(path) + "\n.changed {}" )).some(p => p.startsWith("provenance:")));
  assert.ok(problemsOf(variant("network-flows/capacity/extra.css", "body{}" )).some(p => p.includes("unexpected")));
});

test("release sidecar binds actual source, versions and accepted study records without changing the manifest", () => {
  const path = "network-flows/capacity/release.json";
  assert.ok(site.has(path), "a source-bound release sidecar is packaged");
  const release = JSON.parse(site.get(path));
  assert.equal(release.source_commit, execFileSync("git", ["rev-parse", "HEAD"], {cwd:REPO_ROOT,encoding:"utf8"}).trim());
  assert.match(release.source_tree, /^[a-f0-9]{40}$/);
  assert.match(release.versions.projection, /^depot-capacity-projection\//);
  assert.equal(Object.keys(release.accepted_records).length, 72);
  assert.equal(release.scientific_source_commit, null);
  assert.equal(release.authenticity, "NOT_AUTHENTICATED");
  assert.ok(!Object.hasOwn(release.emitted_files, path), "sidecar digest is non-self-referential");
  assert.equal(release.emitted_files["src/data/depot-capacity-study.js"].sha256,
    createHash("sha256").update(readFileSync(join(PLAYGROUND_ROOT,"src/data/depot-capacity-study.js"))).digest("hex"));
  assert.ok(!site.get(path).includes(REPO_ROOT), "no machine paths are published");
  assert.ok(problemsOf(variant(path, null)).some(p => p.includes("release.json") && p.includes("missing")));
  release.accepted_records[Object.keys(release.accepted_records)[0]] = "0".repeat(64);
  assert.ok(problemsOf(variant(path, JSON.stringify(release))).some(p => p.startsWith("provenance:")));
});

test("explicit release source rejects a fabricated commit or uncommitted source", () => {
  assert.throws(() => buildSite(PLAYGROUND_ROOT,{sourceCommit:"0".repeat(40)}), /source commit/);
});

test("a recomputed sidecar checksum cannot conceal changed study identities or an undeclared field", () => {
  const path="network-flows/capacity/release.json";
  const sorted=value=>value&&typeof value==="object"&&!Array.isArray(value)
    ? Object.fromEntries(Object.keys(value).sort().map(key=>[key,sorted(value[key])]))
    : Array.isArray(value)?value.map(sorted):value;
  for(const alter of [
    r=>{r.workload_digest="0".repeat(64);},
    r=>{r.versions.projection="invented/1.0.0";},
    r=>{r.accepted_records[Object.keys(r.accepted_records)[0]]="0".repeat(64);},
    r=>{r.source_files["capacity/visual.css"].sha256="0".repeat(64);},
    r=>{r.unreviewed_field="unexpected";},
  ]) {
    const release=JSON.parse(site.get(path));
    delete release.release_digest;
    alter(release);
    release.release_digest=createHash("sha256").update(JSON.stringify(sorted(release))).digest("hex");
    assert.ok(problemsOf(variant(path,JSON.stringify(release))).some(p=>p.startsWith("provenance:")));
  }
});

test("resealing an altered capacity HTML body cannot disconnect it from reviewed source", () => {
  const files=new Map(site),path=CAPACITY_INDEX,releasePath="network-flows/capacity/release.json";
  const page=files.get(path).replace("</body>","<h1>Unreviewed result text</h1>\n</body>");
  files.set(path,page);
  const release=JSON.parse(files.get(releasePath));
  release.emitted_files[path]={bytes:Buffer.byteLength(page),sha256:createHash("sha256").update(page).digest("hex")};
  delete release.release_digest;
  const canonical=value=>JSON.stringify(value,(_key,item)=>item&&typeof item==="object"&&!Array.isArray(item)
    ?Object.fromEntries(Object.keys(item).sort().map(key=>[key,item[key]])):item);
  release.release_digest=createHash("sha256").update(canonical(release)).digest("hex");
  files.set(releasePath,canonical(release));
  assert.ok(releaseProblems(files,{playground:PLAYGROUND_ROOT}).some(p=>/capacity page/.test(p)));
  assert.ok(problemsOf(files).some(p=>/capacity page/.test(p)));
});
