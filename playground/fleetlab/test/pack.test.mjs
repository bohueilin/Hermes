// R3 and the packer (contract section 9, design sections 9.2 and 9.4): the module rewriter on a scratch graph,
// its refusals, the worker source escaping, the output path rules, and check-dist on crafted files.

import assert from "node:assert/strict";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  realpathSync,
  statSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { basename, dirname, join, relative } from "node:path";
import { describe, test } from "node:test";
import { fileURLToPath } from "node:url";
import vm from "node:vm";

import { checkDist, main as checkDistMain, MAX_BYTES } from "../tools/check-dist.mjs";
import {
  assertCompiles,
  assertNoModuleSyntax,
  buildHtml,
  bundle,
  checkOutputPath,
  CONTENT_SECURITY_POLICY,
  findRepositoryRoot,
  main as packMain,
  PackError,
  parseModule,
} from "../tools/pack.mjs";

const PLAYGROUND_ROOT = fileURLToPath(new URL("../", import.meta.url));
const REPO_ROOT = realpathSync(fileURLToPath(new URL("../../../", import.meta.url)));

/** FleetLab's label tuple, read from its source so this test never spells the strings (design H-8). */
function requiredLabels() {
  const source = readFileSync(join(REPO_ROOT, "src/hermes/fleet/contracts.py"), "utf8");
  const block = source.match(/REQUIRED_LABELS: tuple\[str, \.\.\.\] = \(([\s\S]*?)\n\)/);
  assert.ok(block, "REQUIRED_LABELS tuple found in contracts.py");
  const labels = [...block[1].matchAll(/"([^"]+)"/g)].map((m) => m[1]);
  assert.equal(labels.length, 5);
  return labels;
}

/** A fresh scratch folder outside the repository (FLEETLAB_SCRATCH, else TMPDIR, else /tmp). */
function scratch(name) {
  const base = process.env.FLEETLAB_SCRATCH ?? process.env.TMPDIR ?? "/tmp";
  mkdirSync(base, { recursive: true });
  const dir = realpathSync(mkdtempSync(join(base, `fleetlab-${name}-`)));
  assert.ok(!dir.startsWith(REPO_ROOT + "/"), "scratch folder must lie outside the repository");
  return dir;
}

function writeTree(root, files) {
  for (const [path, text] of Object.entries(files)) {
    mkdirSync(dirname(join(root, path)), { recursive: true });
    writeFileSync(join(root, path), text);
  }
}

/** Every file under `root` with its contents, for before-and-after comparisons (R3). */
function snapshot(root) {
  const out = new Map();
  const walk = (dir) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const path = join(dir, entry.name);
      if (entry.isSymbolicLink()) out.set(relative(root, path), "symlink");
      else if (entry.isDirectory()) walk(path);
      else out.set(relative(root, path), readFileSync(path, "utf8"));
    }
  };
  walk(root);
  return out;
}

const EM_DASH = "\u2014";
const EN_DASH = "\u2013";

// A scratch module graph that uses every supported form. Strings, comments, a regular expression and a template
// hold the words import and export, which the rewriter must leave alone.
const GRAPH = {
  "src/core/a.js": [
    '// import { nothing } from "./nowhere.js"; export const trap = 1;',
    "export function add(x, y) {",
    "  return x + y;",
    "}",
    "export const K = 2, J = 3;",
    "export class Counter {",
    "  constructor() { this.n = 0; }",
    "  inc() { this.n += 1; return this.n; }",
    "}",
    "let hidden = 5;",
    "function inner() { return hidden * 2; }",
    "export { hidden as visible, inner };",
    "export let mutable = 1;",
    "export function bump() { mutable += 1; return mutable; }",
    'export const words = ["import x from \\"y\\"", `export ${"default"} z`, /import|export/.source];',
    "/* export function ghost() {} */",
  ].join("\n"),
  "src/core/c.js": ['export const C1 = "c1";', "export function cfn() { return C1 + \"!\"; }"].join("\n"),
  "src/core/side.js": "globalThis.sideOrder = (globalThis.sideOrder ?? []).concat(\"side\");\n",
  "src/core/b.js": [
    'import "./side.js";',
    'import { add, K as KAY } from "./a.js";',
    "import * as A from './a.js';",
    "import {",
    "  Counter,",
    "  inner as twice,",
    '} from "./a.js";',
    "export const sum = add(KAY, A.J);",
    'export { visible, bump as bumpA } from "./a.js";',
    'export * from "./c.js";',
    'export * as cns from "./c.js";',
    "export async function later() { return twice(); }",
    "export function* gen() { yield new Counter().inc(); }",
    "export const readMutable = () => A.mutable;",
    "globalThis.sideOrder = globalThis.sideOrder.concat(\"b\");",
  ].join("\n"),
  "src/ui/labels.js": 'export const HONESTY = Object.freeze({ strip: "Teaching model" });\n',
  "src/ui/app.js": [
    'import { sum, visible, bumpA, C1, cfn, cns, later, gen, readMutable } from "../core/b.js";',
    'import { HONESTY } from "./labels.js";',
    "export { sum, visible, C1, cns };",
    "export const results = { cfn: cfn(), gen: [...gen()], strip: HONESTY.strip };",
    "export function mutate() { bumpA(); return readMutable(); }",
    "export { later };",
    "export function start({ createWorker }) { return createWorker(); }",
  ].join("\n"),
  "src/runtime/worker.js": [
    'import { add } from "../core/a.js";',
    'const closing = "</script><!-- end";',
    "self.onmessage = (event) => postMessage({ sum: add(event.data, 1), closing });",
    "export const ready = true;",
  ].join("\n"),
  "styles.css": ":root { --ink: #14181F; }\n",
  "index.html": [
    "<!doctype html>",
    '<html lang="en">',
    "<head>",
    '<meta charset="utf-8">',
    "<title>Scratch playground</title>",
    '<link rel="stylesheet" href="./styles.css">',
    "</head>",
    "<body>",
    '<div id="fleetlab-root"></div>',
    '<script type="module">',
    'import { start } from "./src/ui/app.js";',
    'start({ createWorker: () => new Worker(new URL("./src/runtime/worker.js", import.meta.url), { type: "module" }) });',
    "</script>",
    "</body>",
    "</html>",
    "",
  ].join("\n"),
};

/** A scratch repository: a `.git` marker, a playground folder holding the graph, and an artifacts folder. */
function fakeRepository(name, graph = GRAPH) {
  const root = scratch(name);
  mkdirSync(join(root, ".git"));
  mkdirSync(join(root, "artifacts"));
  mkdirSync(join(root, "experiments"));
  writeFileSync(join(root, "README.md"), "scratch\n");
  const playground = join(root, "playground/fleetlab");
  writeTree(playground, graph);
  return { root, playground };
}

function runClassic(code, context) {
  return vm.runInNewContext(code, context, { filename: "bundle.js" });
}

describe("module rewriter", () => {
  test("page and worker bundles run as classic scripts with the exported behaviour", () => {
    const { playground } = fakeRepository("bundle");
    const sourceRoot = join(playground, "src");
    const page = bundle(join(sourceRoot, "ui/app.js"), { sourceRoot, globalName: "FleetLabPage" });
    const context = {};
    const ns = runClassic(`${page}\nFleetLabPage;`, context);

    // add(K = 2, J = 3) = 5; visible is hidden = 5; inner doubles it to 10.
    assert.equal(ns.sum, 5);
    assert.equal(ns.visible, 5);
    assert.equal(ns.C1, "c1");
    assert.equal(ns.cns.cfn(), "c1!");
    assert.deepEqual(Object.keys(ns.cns).sort(), ["C1", "cfn"]);
    assert.deepEqual(JSON.parse(JSON.stringify(ns.results)), { cfn: "c1!", gen: [1], strip: "Teaching model" });
    // A live export: bump() raises mutable from 1 to 2 and the namespace getter sees it.
    assert.equal(ns.mutate(), 2);
    assert.equal(typeof ns.later, "function");
    assert.equal(ns.start({ createWorker: () => "made" }), "made");
    // The side-effect import ran once, before the module that imports it.
    assert.deepEqual([...context.sideOrder], ["side", "b"]);
    assert.ok(Object.isFrozen(ns));
    assert.throws(() => {
      "use strict";
      ns.sum = 1;
    });
    // Words inside strings, templates, regular expressions and comments survive untouched.
    assert.ok(page.includes('"import x from \\"y\\""'));
    assert.ok(page.includes("/* export function ghost() {} */"));

    const worker = bundle(join(sourceRoot, "runtime/worker.js"), { sourceRoot, globalName: "FleetLabWorker" });
    const posted = [];
    const workerContext = { self: {}, postMessage: (message) => posted.push(message) };
    const workerNs = runClassic(`${worker}\nFleetLabWorker;`, workerContext);
    assert.equal(workerNs.ready, true);
    workerContext.self.onmessage({ data: 41 });
    assert.equal(posted[0].sum, 42);
  });

  test("the parser reports each supported form", () => {
    const parsed = parseModule(GRAPH["src/core/b.js"], "b.js");
    assert.deepEqual(
      parsed.imports.map((i) => [i.kind, i.specifier]),
      [["bare", "./side.js"], ["named", "./a.js"], ["namespace", "./a.js"], ["named", "./a.js"]],
    );
    assert.deepEqual(parsed.imports[3].pairs, [["Counter", "Counter"], ["inner", "twice"]]);
    assert.deepEqual(
      parsed.exports.map((e) => [e.kind, e.exported ?? null]),
      [
        ["local", "sum"],
        ["reexport", "visible"],
        ["reexport", "bumpA"],
        ["star", null],
        ["starAs", "cns"],
        ["local", "later"],
        ["local", "gen"],
        ["local", "readMutable"],
      ],
    );
    assert.deepEqual(
      parseModule(GRAPH["src/core/a.js"]).exports.map((e) => e.exported),
      ["add", "K", "J", "Counter", "visible", "inner", "mutable", "bump", "words"],
    );
  });

  test("refuses import.meta, dynamic import and default forms", () => {
    const refusals = [
      ['const u = new URL("./w.js", import.meta.url);', /import\.meta/],
      ['const m = await import("./x.js");', /dynamic import\(/],
      ["const m = import (name);", /dynamic import\(/],
      ["export default function f() {}", /default exports/],
      ['import d from "./x.js";', /default imports/],
      ["export const { a, b } = obj;", /destructuring/],
      // Without a semicolon a later statement's names must never become exports (native ESM has only a and secret).
      ["export const a = 1\nconst b = 2, c = 3\nexport function secret() { return c }", /must end with a semicolon/],
      ["export const a = 1\nconst b = 2, c = 3;", /must end with a semicolon/],
      ["export let n = 1\nlet m = 2, k = 3;", /must end with a semicolon/],
      ["export const a = 1", /must end with a semicolon/],
      ['export const s = "x"\nfunction f() {}', /must end with a semicolon/],
    ];
    for (const [source, message] of refusals) {
      assert.throws(() => parseModule(source, "bad.js"), (err) => err instanceof PackError && message.test(err.message), source);
    }
    // The same words inside a string or a comment are not code.
    assert.doesNotThrow(() => parseModule('const s = "import.meta and import(x)"; // import.meta'));
  });

  test("declarations that continue across lines still parse, with semicolons ending them", () => {
    const source = [
      "export const f =",
      "  function () { return 1; };",
      "export const g = 1 +",
      "  2;",
      "export const h = [",
      "  1,",
      "];",
      "export const a = 1,",
      "  b = 2;",
      "export const t = `x",
      "const y`;",
    ].join("\n");
    assert.deepEqual(parseModule(source).exports.map((e) => e.exported), ["f", "g", "h", "a", "b", "t"]);
  });

  test("a postfix ++ or -- before a division keeps the rest of the line as code", () => {
    const dir = scratch("postinc");
    writeTree(dir, {
      "src/ui/app.js": [
        "let n = 4;",
        "let m = 9;",
        "export const half = n++ / 2; export const third = m-- / 3;",
        "export const unary = 1 + +/ab/.source.length;",
        "export const after = [n, m];",
      ].join("\n"),
    });
    assert.deepEqual(parseModule(readFileSync(join(dir, "src/ui/app.js"), "utf8")).exports.map((e) => e.exported), ["half", "third", "unary", "after"]);
    const code = bundle(join(dir, "src/ui/app.js"), { sourceRoot: join(dir, "src"), globalName: "P" });
    const ns = runClassic(`${code}\nP;`, {});
    assert.equal(ns.half, 2); // 4 / 2, then n is 5
    assert.equal(ns.third, 3); // 9 / 3, then m is 8
    assert.equal(ns.unary, 3); // 1 + "ab".length
    assert.deepEqual([...ns.after], [5, 8]);
  });

  test("a bundle that does not compile fails the pack, and compiling runs nothing", () => {
    assert.throws(() => assertCompiles("const a = ;", "P"), (err) => err instanceof PackError && /P: the bundle does not compile/.test(err.message));
    assert.throws(() => assertCompiles("const P = 1;\nexport const third = 3;", "P"), /does not compile/);
    const probe = `fleetlabCompileProbe${String(process.pid)}`;
    assert.doesNotThrow(() => assertCompiles(`globalThis.${probe} = true;`));
    assert.equal(globalThis[probe], undefined);
  });

  test("a named import of a mutable export is refused; namespace imports stay live", () => {
    const counter = "export let count = 0;\nexport function inc() { count += 1; }\n";
    const cases = [
      [{ "src/ui/app.js": 'import { count, inc } from "./m.js";\nexport function after() { inc(); return count; }', "src/ui/m.js": counter }, /"count" is a mutable export of src\/ui\/m\.js/],
      [{ "src/ui/app.js": 'import { total } from "./r.js";', "src/ui/r.js": 'export { count as total } from "./m.js";', "src/ui/m.js": counter }, /"total" is a mutable export of src\/ui\/r\.js/],
      [{ "src/ui/app.js": 'import { count } from "./r.js";', "src/ui/r.js": 'export * from "./m.js";', "src/ui/m.js": counter }, /"count" is a mutable export of src\/ui\/r\.js/],
      [{ "src/ui/app.js": 'import { value } from "./m.js";', "src/ui/m.js": "let v = 0;\nexport function set(x) { v = x; }\nexport { v as value };" }, /"value" is a mutable export/],
      [{ "src/ui/app.js": 'import { value } from "./m.js";', "src/ui/m.js": "var v = 0;\nexport function bump() { v++; }\nexport { v as value };" }, /"value" is a mutable export/],
    ];
    for (const [graph, message] of cases) {
      const dir = scratch("mutable");
      writeTree(dir, graph);
      assert.throws(
        () => bundle(join(dir, "src/ui/app.js"), { sourceRoot: join(dir, "src"), globalName: "P" }),
        (err) => err instanceof PackError && message.test(err.message),
      );
    }
    const dir = scratch("mutable-live");
    writeTree(dir, {
      "src/ui/app.js": 'import * as M from "./m.js";\nimport { fixed } from "./m.js";\nexport function after() { M.inc(); return [M.count, fixed]; }',
      "src/ui/m.js": `${counter}let f = 7;\nexport { f as fixed };\n`,
    });
    const ns = runClassic(`${bundle(join(dir, "src/ui/app.js"), { sourceRoot: join(dir, "src"), globalName: "P" })}\nP;`, {});
    assert.deepEqual([...ns.after()], [1, 7]);
  });

  test("a bundle that still holds module syntax is refused", () => {
    assert.throws(() => assertNoModuleSyntax("const a = 1;\nexport const b = 2;"), /leftover export/);
    assert.throws(() => assertNoModuleSyntax('import { a } from "./a.js";'), /leftover import/);
    assert.throws(() => assertNoModuleSyntax("const u = import.meta.url;"), /leftover import\.meta/);
    assert.doesNotThrow(() => assertNoModuleSyntax('const o = { a: 1 }; o.import = "export";'));
  });

  test("refuses bare specifiers, missing exports, cycles and a leftover import.meta in the graph", () => {
    const cases = [
      [{ "src/ui/app.js": 'import { x } from "node:fs";' }, /only relative module specifiers/],
      [{ "src/ui/app.js": 'import { nope } from "./l.js";', "src/ui/l.js": "export const yes = 1;" }, /does not export "nope"/],
      [{ "src/ui/app.js": 'import { b } from "./b.js"; export const a = 1;', "src/ui/b.js": 'import { a } from "./app.js"; export const b = 1;' }, /import cycle/],
      [{ "src/ui/app.js": 'import { w } from "./w.js";', "src/ui/w.js": "export const w = import.meta.url;" }, /import\.meta/],
      [{ "src/ui/app.js": 'export function load() { return import("./w.js"); }' }, /dynamic import\(/],
    ];
    for (const [graph, message] of cases) {
      const dir = scratch("refuse");
      writeTree(dir, graph);
      assert.throws(
        () => bundle(join(dir, "src/ui/app.js"), { sourceRoot: join(dir, "src"), globalName: "P" }),
        (err) => err instanceof PackError && message.test(err.message),
      );
    }
  });
});

describe("packed HTML", () => {
  test("policy first in head, styles inlined, worker source escaped, start call with the Blob factory", () => {
    const { playground } = fakeRepository("html");
    const html = buildHtml(playground);
    assert.ok(html.includes(`<head><meta http-equiv="Content-Security-Policy" content="${CONTENT_SECURITY_POLICY}">`));
    assert.ok(html.includes("<style>\n:root { --ink: #14181F; }\n\n</style>"));
    assert.ok(!/<link\b/i.test(html));
    assert.ok(!html.includes("import.meta"));
    assert.ok(!html.includes('type="module"'));
    // The only </script> and <!-- in the file are the real closing tag; the worker's copies are escaped.
    assert.equal(html.split("</script>").length - 1, 1);
    assert.ok(!html.includes("<!--"));
    const literal = /const FLEETLAB_WORKER_SOURCE = ("(?:[^"\\]|\\.)*");/.exec(html);
    assert.ok(literal, "worker source literal present");
    assert.ok(!literal[1].includes("<"));
    const workerSource = JSON.parse(literal[1]);
    assert.ok(workerSource.includes('"</script><!-- end"'));

    // Run the page script as the browser would, with fakes for Worker, Blob and URL.
    const script = /<script>\n([\s\S]*)\n<\/script>/.exec(html)[1];
    const made = [];
    class FakeBlob {
      constructor(parts, options) {
        this.parts = parts;
        this.options = options;
      }
    }
    const context = {
      Blob: FakeBlob,
      URL: { createObjectURL: (blob) => (made.push(blob), "blob:fake") },
      Worker: class {
        constructor(url) {
          this.url = url;
        }
      },
    };
    const worker = runClassic(`${script}\nnull;`, context);
    assert.equal(worker, null);
    assert.equal(made.length, 1);
    assert.equal(made[0].parts[0], workerSource);
    assert.deepEqual({ ...made[0].options }, { type: "text/javascript" });

    // The worker source itself runs as a classic script.
    const posted = [];
    const workerContext = { self: {}, postMessage: (m) => posted.push(m) };
    runClassic(workerSource, workerContext);
    workerContext.self.onmessage({ data: 1 });
    assert.deepEqual({ ...posted[0] }, { sum: 2, closing: "</script><!-- end" });
  });

  test("the page bundle may not carry </script>", () => {
    const graph = { ...GRAPH, "src/ui/labels.js": 'export const HONESTY = { strip: "</script>" };\n' };
    const { playground } = fakeRepository("close");
    writeTree(playground, graph);
    assert.throws(() => buildHtml(playground), /page bundle contains <\/script/);
  });
});

describe("output path rules and R3", () => {
  const quiet = { log: () => {}, error: () => {} };

  test("outside the repository and under dist/ are written; only the output appears", () => {
    const { root, playground } = fakeRepository("paths-ok");
    const outside = scratch("outside");
    const before = snapshot(root);
    const beforeOutside = snapshot(outside);

    assert.equal(packMain(["--out", join(outside, "page.html"), "--playground", playground], { cwd: root, ...quiet }), 0);
    assert.equal(packMain(["--out", "dist/fleetlab-playground.html", "--playground", playground], { cwd: root, ...quiet }), 0);

    const after = snapshot(root);
    const added = [...after.keys()].filter((k) => !before.has(k));
    assert.deepEqual(added, ["dist/fleetlab-playground.html"]);
    for (const [path, text] of before) assert.equal(after.get(path), text, `${path} unchanged`);
    assert.deepEqual([...snapshot(outside).keys()].filter((k) => !beforeOutside.has(k)), ["page.html"]);
    assert.equal(readFileSync(join(outside, "page.html"), "utf8"), buildHtml(playground));
  });

  test("artifacts, experiments and every other in-repository path exit 2 with nothing written", () => {
    const { root, playground } = fakeRepository("paths-refused");
    mkdirSync(join(root, "dist"));
    symlinkSync(join(root, "artifacts"), join(root, "dist/escape"));
    const before = snapshot(root);
    const refused = [
      "artifacts/fleetlab.html",
      "experiments/fleetlab.html",
      "playground/fleetlab/fleetlab.html",
      "fleetlab.html",
      "dist/../artifacts/fleetlab.html",
      "dist/escape/fleetlab.html",
      "distribution/fleetlab.html",
      join(scratch("not-html"), "fleetlab.js"),
    ];
    for (const out of refused) {
      const errors = [];
      const code = packMain(["--out", out, "--playground", playground], { cwd: root, log: () => {}, error: (m) => errors.push(m) });
      assert.equal(code, 2, out);
      assert.match(errors.join("\n"), /refusing|must be an \.html/, out);
    }
    assert.match(checkOutputPath(join(root, "artifacts/x.html"), root).reason, /artifacts\/ folder/);
    assert.match(checkOutputPath(join(root, "experiments/x.html"), root).reason, /experiments\/ folder/);
    assert.deepEqual(snapshot(root), before);
    assert.equal(packMain([], { cwd: root, ...quiet }), 2);
  });

  test("a dangling symbolic link under dist/ is refused and nothing is written through it", () => {
    const { root, playground } = fakeRepository("paths-dangling");
    mkdirSync(join(root, "dist"));
    symlinkSync("../artifacts/via-symlink.html", join(root, "dist/page.html"));
    const before = snapshot(root);
    const errors = [];
    const code = packMain(["--out", "dist/page.html", "--playground", playground], { cwd: root, log: () => {}, error: (m) => errors.push(m) });
    assert.equal(code, 2);
    assert.match(errors.join("\n"), /refusing/);
    assert.equal(existsSync(join(root, "artifacts/via-symlink.html")), false);
    assert.equal(checkOutputPath(join(root, "dist/page.html"), root).ok, false);
    assert.deepEqual(snapshot(root), before);
  });

  test("an output that exists and is not a regular file is refused; a regular file is rewritten", () => {
    const { root, playground } = fakeRepository("paths-not-file");
    mkdirSync(join(root, "dist/folder.html"), { recursive: true });
    const errors = [];
    assert.equal(packMain(["--out", "dist/folder.html", "--playground", playground], { cwd: root, log: () => {}, error: (m) => errors.push(m) }), 2);
    assert.match(errors.join("\n"), /not a regular file/);
    assert.equal(packMain(["--out", "dist/again.html", "--playground", playground], { cwd: root, ...quiet }), 0);
    assert.equal(packMain(["--out", "dist/again.html", "--playground", playground], { cwd: root, ...quiet }), 0);
    assert.equal(readFileSync(join(root, "dist/again.html"), "utf8"), buildHtml(playground));
  });

  test("a differently cased spelling of the repository is still the repository", (t) => {
    const { root, playground } = fakeRepository("paths-case");
    const upper = join(dirname(root), basename(root).toUpperCase());
    if (upper === root || !existsSync(upper)) {
      t.skip("case-sensitive file system");
      return;
    }
    const before = snapshot(root);
    assert.match(checkOutputPath(join(upper, "artifacts/via-case.html"), root).reason, /artifacts\/ folder/);
    assert.match(checkOutputPath(join(root, "artifacts/via-case.html"), upper).reason, /artifacts\/ folder/);
    assert.equal(checkOutputPath(join(upper, "ARTIFACTS/via-case.html"), root).ok, false);
    assert.equal(checkOutputPath(join(upper, "dist/x.html"), root).ok, true);
    assert.equal(packMain(["--out", join(upper, "artifacts/via-case.html"), "--playground", playground], { cwd: root, ...quiet }), 2);
    assert.deepEqual(snapshot(root), before);
    const lowerRepo = REPO_ROOT.toLowerCase();
    if (lowerRepo !== REPO_ROOT && existsSync(lowerRepo)) {
      assert.equal(checkOutputPath(join(lowerRepo, "artifacts/x.html"), REPO_ROOT).ok, false);
    }
  });

  test("the real repository refuses its artifacts folder before building anything", () => {
    assert.equal(findRepositoryRoot(PLAYGROUND_ROOT) !== null, true);
    const target = join(REPO_ROOT, "artifacts", "fleetlab-pack-refusal-check.html");
    assert.equal(packMain(["--out", target], { cwd: REPO_ROOT, ...quiet }), 2);
    assert.equal(existsSync(target), false);
    assert.equal(checkOutputPath(join(REPO_ROOT, "experiments/x.html"), REPO_ROOT).ok, false);
    assert.equal(checkOutputPath(join(REPO_ROOT, "dist/x.html"), REPO_ROOT).ok, true);
  });

  test("a missing worker entry is a clear error and writes nothing", () => {
    const graph = { ...GRAPH };
    delete graph["src/runtime/worker.js"];
    const { root, playground } = fakeRepository("no-worker");
    const errors = [];
    const out = join(scratch("no-worker-out"), "page.html");
    assert.equal(packMain(["--out", out, "--playground", playground], { cwd: root, log: () => {}, error: (m) => errors.push(m) }), 0);
    const bare = fakeRepository("no-worker-2", graph);
    const out2 = join(scratch("no-worker-out-2"), "page.html");
    assert.equal(
      packMain(["--out", out2, "--playground", bare.playground], { cwd: bare.root, log: () => {}, error: (m) => errors.push(m) }),
      1,
    );
    assert.match(errors.join("\n"), /src\/runtime\/worker\.js does not exist yet/);
    assert.equal(existsSync(out2), false);
  });

  test("R3: only tools/pack.mjs imports fs; check-dist.mjs imports existsSync and readFileSync by name only", () => {
    const FS = "[\"'`](?:node:)?fs(?:/promises)?[\"'`]";
    const fsUses = new RegExp(`\\bfrom\\s*${FS}|\\bimport\\s*\\(?\\s*${FS}|\\brequire\\s*\\(\\s*${FS}`, "g");
    const namedImports = new RegExp(`\\bimport\\s*([^;]*?)\\s*from\\s*${FS}`, "g");
    const readOnly = ["existsSync", "readFileSync"];
    /** Problems with one file's use of fs; `allowRead` permits only `import { existsSync, readFileSync } from "node:fs"`. */
    const fsProblems = (text, allowRead) => {
      const uses = [...text.matchAll(fsUses)].length;
      const allowed = !allowRead
        ? 0
        : [...text.matchAll(namedImports)].filter((m) => {
            const names = /^\{([^}]*)\}$/.exec(m[1].trim());
            const list = names ? names[1].split(",").map((s) => s.trim()).filter(Boolean) : [];
            return /["'`]node:fs["'`]$/.test(m[0]) && list.length > 0 && list.every((name) => readOnly.includes(name));
          }).length;
      return uses === allowed ? [] : [`${uses - allowed} import or require of fs beyond existsSync and readFileSync`];
    };
    // The check names no write call, so an unlisted one (openSync, cp, truncate, mkdtemp) cannot slip past it.
    const refused = [
      'import { openSync, writeSync } from "node:fs";',
      'import * as fs from "fs";',
      "import fs from 'node:fs/promises';",
      'const { cp } = await import("node:fs");',
      'const fs = require("fs");',
      "const { truncate } = require(`node:fs/promises`);",
      'export { mkdtempSync } from "node:fs";',
      'import "node:fs";',
      'import { existsSync, readFileSync, openSync } from "node:fs";',
      'import { readFileSync as writeFileSync } from "node:fs";',
      'import { existsSync, readFileSync } from "node:fs";\nconst fs = require("node:fs");',
    ];
    for (const probe of refused) assert.notDeepEqual(fsProblems(probe, true), [], probe);
    assert.deepEqual(fsProblems('import { existsSync, readFileSync } from "node:fs";', true), []);
    assert.notDeepEqual(fsProblems('import { existsSync, readFileSync } from "node:fs";', false), []);
    assert.deepEqual(fsProblems('import { join } from "node:path";\nconst note = "fsync";', false), []);

    const offenders = [];
    const walk = (dir) => {
      for (const entry of readdirSync(dir, { withFileTypes: true })) {
        const path = join(dir, entry.name);
        const name = relative(PLAYGROUND_ROOT, path);
        if (entry.isDirectory()) walk(path);
        else if (/\.[mc]?js$/.test(entry.name) && name !== "tools/pack.mjs") {
          offenders.push(...fsProblems(readFileSync(path, "utf8"), name === "tools/check-dist.mjs").map((problem) => `${name}: ${problem}`));
        }
      }
    };
    for (const folder of ["src", "tools"]) if (existsSync(join(PLAYGROUND_ROOT, folder))) walk(join(PLAYGROUND_ROOT, folder));
    assert.deepEqual(offenders, []);
  });

  test("R3: no playground code writes files except tools/pack.mjs", () => {
    const writers = /\b(writeFileSync|writeFile|appendFileSync|appendFile|createWriteStream|mkdirSync|mkdir|rmSync|rm|unlinkSync|unlink|renameSync|rename|copyFileSync|copyFile|cpSync|symlinkSync|truncateSync)\s*\(/;
    const offenders = [];
    const walk = (dir) => {
      for (const entry of readdirSync(dir, { withFileTypes: true })) {
        const path = join(dir, entry.name);
        if (entry.isDirectory()) walk(path);
        else if (/\.(m?js)$/.test(entry.name) && path !== join(PLAYGROUND_ROOT, "tools/pack.mjs") && writers.test(readFileSync(path, "utf8"))) {
          offenders.push(relative(PLAYGROUND_ROOT, path));
        }
      }
    };
    for (const folder of ["src", "tools"]) if (existsSync(join(PLAYGROUND_ROOT, folder))) walk(join(PLAYGROUND_ROOT, folder));
    assert.deepEqual(offenders, []);
  });
});

describe("check-dist", () => {
  const labels = requiredLabels();
  const { playground } = fakeRepository("check");
  const valid = buildHtml(playground);
  const withBody = (extra) => valid.replace("</body>", `${extra}\n</body>`);
  const withLabels = (text) => valid.replace('strip: "Teaching model"', `strip: ${JSON.stringify(text)}`);

  const expectProblem = (html, pattern) => {
    const problems = checkDist(html, { requiredLabels: labels });
    assert.ok(problems.some((p) => pattern.test(p)), `expected ${pattern} in ${JSON.stringify(problems)}`);
  };

  test("a clean packed file passes, and the SVG namespace name is not a URL", () => {
    assert.deepEqual(checkDist(valid, { requiredLabels: labels }), []);
    assert.deepEqual(checkDist(withBody('<svg xmlns="http://www.w3.org/2000/svg"></svg>'), { requiredLabels: labels }), []);
    // Script text is not markup, a data URL may hold "//", createElementNS may name the namespace, and an
    // out-of-range character reference is not a crash.
    const clean = [
      "<script>const data = compute(); // note\nimg.src = url; // set it</script>",
      '<img srcset="data:image/png;base64,//8AAA 1x" alt="">',
      '<script>document.createElementNS("http://www.w3.org/2000/svg", "svg");</script>',
      '<p title="a &#x110000; b">c &#0; d</p>',
    ];
    for (const extra of clean) assert.deepEqual(checkDist(withBody(extra), { requiredLabels: labels }), [], extra);
  });

  test("external URLs", () => {
    expectProblem(withBody('<a href="https://example.org/">x</a>'), /^external URL/);
    expectProblem(withBody("<p>see http://example.org</p>"), /^external URL/);
    expectProblem(withBody('<svg xmlns="http://www.w3.org/2000/svg/../evil"></svg>'), /^external URL/);
    expectProblem(withBody('<img src="//example.org/a.png">'), /^external URL: a protocol-relative/);
    // Character references are decoded first, with or without the semicolon.
    expectProblem(withBody('<a href="https&#58;//example.org/">x</a>'), /^external URL: "https:\/\/example/);
    expectProblem(withBody('<img src="http&colon;//example.org/a.png">'), /^external URL: "http:\/\/example/);
    expectProblem(withBody('<a href="http&#58//example.org/">x</a>'), /^external URL: "http:\/\/example/);
    // The namespace name is allowed only as an xmlns value or a createElementNS argument.
    expectProblem(withBody('<img src="http://www.w3.org/2000/svg">'), /^external URL: "http:\/\/www\.w3\.org/);
    // Protocol-relative references in any URL attribute, prefixed, unquoted, spaced, encoded or in a later srcset candidate.
    expectProblem(withBody('<svg><image xlink:href="//example.org/a.png"/></svg>'), /^external URL: a protocol-relative reference in xlink:href/);
    expectProblem(withBody('<img srcset="data:image/png;base64,AA 1x, //example.org/b.png 2x">'), /^external URL: a protocol-relative reference in srcset/);
    expectProblem(withBody("<img src=//example.org/a.png>"), /^external URL: a protocol-relative reference in src/);
    expectProblem(withBody('<a href=" &#47;&#47;example.org/">x</a>'), /^external URL: a protocol-relative reference in href/);
    expectProblem(withBody('<form action="/\t/example.org/"></form>'), /^external URL: a protocol-relative reference in action/);
    expectProblem(withBody('<video poster="//example.org/a.png"></video>'), /^external URL: a protocol-relative reference in poster/);
    // CSS: url(, every image-set( candidate, and @import.
    expectProblem(withBody('<i style="background:url( //example.org/a.png)"></i>'), /^external URL: a protocol-relative reference in CSS/);
    expectProblem(withBody('<style>b{background:image-set("//example.org/a.png" 1x)}</style>'), /^external URL: a protocol-relative reference in CSS/);
    expectProblem(withBody('<style>b{background:image-set("a.png" 1x, "//example.org/b.png" 2x)}</style>'), /^external URL: a protocol-relative reference in CSS/);
    expectProblem(withBody('<style>@import "//example.org/a.css";</style>'), /^external URL: a protocol-relative reference in CSS/);
    expectProblem(valid.replace("FLEETLAB_WORKER_SOURCE = \"", 'FLEETLAB_WORKER_SOURCE = "https://example.org/w.js '), /^external URL/);
  });

  test("a missing, different, duplicated or misplaced policy", () => {
    const meta = `<meta http-equiv="Content-Security-Policy" content="${CONTENT_SECURITY_POLICY}">`;
    expectProblem(valid.replace(meta, ""), /^policy: no Content-Security-Policy/);
    expectProblem(valid.replace("connect-src 'none'", "connect-src *"), /^policy: content differs/);
    expectProblem(valid.replace("</head>", `${meta}</head>`), /^policy: 2 Content-Security-Policy/);
    expectProblem(valid.replace(`<head>${meta}`, `<head><meta charset="utf-8">${meta}`), /^policy: .*not the first child/);
  });

  test("forbidden tokens anywhere in the file, the worker source included", () => {
    expectProblem(withBody("<script>document.body.innerHTML = 1;</script>"), /^forbidden token: innerHTML/);
    expectProblem(valid.replace('const FLEETLAB_WORKER_SOURCE = "', 'const FLEETLAB_WORKER_SOURCE = "fetch(\\"/x\\"); '), /^forbidden token: fetch\(/);
    expectProblem(valid.replace('const FLEETLAB_WORKER_SOURCE = "', 'const FLEETLAB_WORKER_SOURCE = "import(\\"./x.js\\"); '), /^forbidden token: import\(/);
    expectProblem(withBody("<script>localStorage.x = 1;</script>"), /^forbidden token: localStorage/);
    expectProblem(withBody('<script src="app.js"></script>'), /^forbidden token: <script src/);
    expectProblem(withBody("<script>eval('1');</script>"), /^forbidden token: eval\(/);
  });

  test("banned words and dashes in text, title, aria-label, title attributes and labels strings", () => {
    const word = "Live";
    expectProblem(withBody(`<p>${word} view</p>`), /^banned word: "Live" in text/);
    expectProblem(valid.replace("<title>Scratch playground</title>", "<title>Demand forecast</title>"), /^banned word: "forecast" in text/);
    expectProblem(withBody('<button aria-label="Real-time map"></button>'), /^banned word: "Real-time" in aria-label attribute/);
    expectProblem(withBody('<span title="monitoring panel"></span>'), /^banned word: "monitoring" in title attribute/);
    // Unquoted attribute values are copy too, entity-decoded.
    expectProblem(withBody("<button aria-label=Live>x</button>"), /^banned word: "Live" in aria-label attribute/);
    expectProblem(withBody("<span title=monitoring></span>"), /^banned word: "monitoring" in title attribute/);
    expectProblem(withBody("<img alt=real-time>"), /^banned word: "real-time" in alt attribute/);
    expectProblem(withBody("<input placeholder=Forecasts>"), /^banned word: "Forecasts" in placeholder attribute/);
    expectProblem(withBody("<i aria-roledescription=Predictive></i>"), /^banned word: "Predictive" in aria-roledescription attribute/);
    expectProblem(withBody("<i aria-description=a&mdash;b></i>"), /^dash: .* in aria-description attribute/);
    expectProblem(withLabels("We predict nothing"), /^banned word: "predict" in src\/ui\/labels\.js string/);
    expectProblem(withLabels("Expected traffic profile"), /^banned word: "Expected traffic"/);
    assert.deepEqual(checkDist(withLabels("delivery and alive"), { requiredLabels: labels }), []);

    expectProblem(withBody(`<p>a ${EM_DASH} b</p>`), /^dash: .* in text/);
    expectProblem(withBody("<p>a &mdash; b</p>"), /^dash: .* in text/);
    expectProblem(withBody(`<i aria-label="a ${EN_DASH} b"></i>`), /^dash: .* in aria-label attribute/);
    // An escaped dash in a labels string is still a dash on screen.
    expectProblem(valid.replace('strip: "Teaching model"', 'strip: "a \\u2014 b"'), /^dash: .* src\/ui\/labels\.js string/);
    expectProblem(valid.replace("// fleetlab-module: src/ui/labels.js", "// fleetlab-module: src/ui/other.js"), /^labels: no src\/ui\/labels\.js/);
  });

  test("a string from the label tuple", () => {
    for (const label of labels) expectProblem(withBody(`<p>${label}</p>`), /^required label: entry \d of the label tuple/);
    expectProblem(withLabels(labels[2]), /^required label/);
    assert.throws(() => checkDist(valid, { requiredLabels: [] }), TypeError);
  });

  test("a file over 2 MB", () => {
    const big = withBody(`<p>${"x".repeat(MAX_BYTES)}</p>`);
    expectProblem(big, /^size: \d+ bytes is over the 2097152 byte limit/);
  });

  test("the command line exits 0 on a clean file and 1 on crafted violations, labels from argument or environment", () => {
    const dir = scratch("check-cli");
    const cleanPath = join(dir, "clean.html");
    const dirtyPath = join(dir, "dirty.html");
    const labelsPath = join(dir, "labels.json");
    writeFileSync(cleanPath, valid);
    writeFileSync(dirtyPath, withBody(`<p>${labels[0]} ${EM_DASH} http://example.org</p>`));
    writeFileSync(labelsPath, JSON.stringify(labels));
    const env = { FLEETLAB_REQUIRED_LABELS: JSON.stringify(labels) };
    const errors = [];
    const logs = [];
    const io = { log: (m) => logs.push(m), error: (m) => errors.push(m) };
    assert.equal(checkDistMain([cleanPath], { env, ...io }), 0);
    assert.match(logs.join("\n"), /check-dist: OK/);
    assert.equal(checkDistMain([dirtyPath, "--required-labels", labelsPath], { env: {}, ...io }), 1);
    for (const pattern of [/check-dist: required label/, /check-dist: dash/, /check-dist: external URL/, /FAILED with 3 problem/]) {
      assert.match(errors.join("\n"), pattern);
    }
    assert.ok(!errors.join("\n").includes(labels[0]), "messages never repeat the label");
    assert.equal(checkDistMain([], { env, ...io }), 2);
    assert.equal(checkDistMain([join(dir, "missing.html")], { env, ...io }), 2);
    assert.equal(statSync(cleanPath).size, Buffer.byteLength(valid));
  });
});
