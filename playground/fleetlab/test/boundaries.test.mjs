// Boundary rules R4 and R5 (design section 9.2, contract section 2), plus the label-tuple and dash scans.
// Every rule scans whatever files exist, so modules added later are covered without editing this file.

import assert from "node:assert/strict";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { dirname, join, relative, resolve, sep } from "node:path";
import { describe, test } from "node:test";
import { fileURLToPath } from "node:url";

import { maskSource, parseModule } from "../tools/pack.mjs";

const PLAYGROUND_ROOT = fileURLToPath(new URL("../", import.meta.url));
const REPO_ROOT = fileURLToPath(new URL("../../../", import.meta.url));
const SRC = join(PLAYGROUND_ROOT, "src");
const FOLDERS = ["core", "instrument", "legacy", "model", "runtime", "ui"];

/** FleetLab's label tuple, read from its source so this test never spells the strings (design H-8). */
function requiredLabels() {
  const source = readFileSync(join(REPO_ROOT, "src/hermes/fleet/contracts.py"), "utf8");
  const block = source.match(/REQUIRED_LABELS: tuple\[str, \.\.\.\] = \(([\s\S]*?)\n\)/);
  assert.ok(block, "REQUIRED_LABELS tuple found in contracts.py");
  const labels = [...block[1].matchAll(/"([^"]+)"/g)].map((m) => m[1]);
  assert.equal(labels.length, 5);
  return labels;
}

function filesUnder(dir, keep = () => true) {
  if (!existsSync(dir)) return [];
  const out = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) out.push(...filesUnder(path, keep));
    else if (keep(path)) out.push(path);
  }
  return out.sort();
}

const sourceFiles = (folder) => filesUnder(join(SRC, folder), (p) => p.endsWith(".js"));
const label = (path) => relative(PLAYGROUND_ROOT, path).split(sep).join("/");

/** Folders each source folder may import from (contract section 2). */
const ALLOWED = {
  core: ["core"],
  instrument: ["core", "instrument"],
  legacy: ["core", "legacy"],
  model: ["core", "model"],
  runtime: ["core", "instrument", "model", "legacy", "runtime"],
  ui: ["core", "instrument", "model", "runtime", "ui"],
};

/** The one exception: model/experiment.js may import the instrument. */
function allowedEdge(fromFolder, fromFile, toFolder) {
  if (ALLOWED[fromFolder].includes(toFolder)) return true;
  return fromFolder === "model" && fromFile === "src/model/experiment.js" && toFolder === "instrument";
}

/** Line of a match offset, for readable failures. */
const lineOf = (text, index) => text.slice(0, index).split("\n").length;

/**
 * Finds the first match of `pattern` (global) in `text` that is a real use: not a property access such as
 * `scenario.window`, and not an object key such as `window:`. With `anyPosition`, every match counts.
 */
function findUse(text, pattern, anyPosition = false) {
  for (const m of text.matchAll(pattern)) {
    if (anyPosition) return m;
    let k = m.index - 1;
    while (k >= 0 && /\s/.test(text[k])) k -= 1;
    if (k >= 0 && text[k] === "." && text[k - 1] !== ".") continue;
    if (/^\s*:/.test(text.slice(m.index + m[0].length)) && !/\?\s*$/.test(text.slice(0, m.index))) continue;
    return m;
  }
  return null;
}

// R4 tokens for core, instrument, legacy and model, matched on code with comments and strings masked. Global names
// may appear as property names (`scenario.window`); storage, crypto.subtle and Math.random count anywhere.
const R4_TOKENS = [
  [/\bMath\s*\.\s*random\b/g, "Math.random", true],
  [/\bDate\b/g, "Date"],
  [/\bperformance\b/g, "performance"],
  [/\b(?:setTimeout|setInterval|setImmediate|clearTimeout|clearInterval|requestAnimationFrame|queueMicrotask)\b/g, "a timer"],
  [/\bwindow\b/g, "window"],
  [/\bdocument\b/g, "document"],
  [/\bglobalThis\b/g, "globalThis"],
  [/\b(?:localStorage|sessionStorage|indexedDB)\b/g, "storage", true],
  [/\bfetch\b/g, "fetch"],
  [/\bcrypto\s*\.\s*subtle\b/g, "crypto.subtle", true],
];

// R5 tokens for ui, matched on code with comments masked and strings kept, so `el["innerHTML"]` is caught too.
const R5_TOKENS = [
  [/\bfetch\b/g, "fetch"],
  [/\bWebSocket\b/g, "WebSocket"],
  [/\bsendBeacon\b/g, "sendBeacon"],
  [/\bXMLHttpRequest\b/g, "XMLHttpRequest"],
  [/\bEventSource\b/g, "EventSource"],
  [/\bimport\s*\(/g, "dynamic import("],
  [/\beval\b/g, "eval"],
  [/\bnew\s+Function\b/g, "new Function"],
  [/\binnerHTML\b/g, "innerHTML"],
  [/\bouterHTML\b/g, "outerHTML"],
  [/\binsertAdjacentHTML\b/g, "insertAdjacentHTML"],
  [/\bdocument\s*\.\s*write(?:ln)?\b/g, "document.write"],
  [/\blocalStorage\b/g, "localStorage"],
  [/\bsessionStorage\b/g, "sessionStorage"],
  [/\bindexedDB\b/g, "indexedDB"],
  [/\bdocument\s*\.\s*cookie\b/g, "document.cookie"],
];

describe("R4 import graph", () => {
  for (const folder of FOLDERS) {
    test(`src/${folder} imports only what contract section 2 allows`, () => {
      const problems = [];
      for (const file of sourceFiles(folder)) {
        const name = label(file);
        let parsed;
        try {
          parsed = parseModule(readFileSync(file, "utf8"), name);
        } catch (err) {
          problems.push(`${name}: ${err.message}`);
          continue;
        }
        const specifiers = [...parsed.imports, ...parsed.exports].map((item) => item.specifier).filter(Boolean);
        for (const specifier of specifiers) {
          if (!specifier.startsWith("./") && !specifier.startsWith("../")) {
            problems.push(`${name}: imports "${specifier}", which is not a relative path inside src/`);
            continue;
          }
          const target = resolve(dirname(file), specifier);
          const inside = relative(SRC, target).split(sep);
          if (inside[0] === ".." || !FOLDERS.includes(inside[0]) || !target.endsWith(".js")) {
            problems.push(`${name}: imports "${specifier}", outside the six source folders`);
            continue;
          }
          if (!allowedEdge(folder, name, inside[0])) {
            problems.push(`${name}: imports src/${inside.join("/")}, but ${folder} may not import ${inside[0]}`);
          }
        }
      }
      assert.deepEqual(problems, []);
    });
  }

  test("the rule table itself refuses the directions the contract forbids", () => {
    assert.equal(allowedEdge("core", "src/core/stats.js", "model"), false);
    assert.equal(allowedEdge("model", "src/model/engine.js", "instrument"), false);
    assert.equal(allowedEdge("model", "src/model/experiment.js", "instrument"), true);
    assert.equal(allowedEdge("instrument", "src/instrument/paired.js", "ui"), false);
    assert.equal(allowedEdge("legacy", "src/legacy/profile.js", "runtime"), false);
    assert.equal(allowedEdge("runtime", "src/runtime/host.js", "ui"), false);
    assert.equal(allowedEdge("ui", "src/ui/app.js", "legacy"), false);
    assert.equal(allowedEdge("ui", "src/ui/app.js", "runtime"), true);
  });
});

describe("R4 tokens in core, instrument, legacy and model", () => {
  for (const folder of ["core", "instrument", "legacy", "model"]) {
    test(`src/${folder} uses no clock, randomness, page globals, storage or network`, () => {
      const problems = [];
      for (const file of sourceFiles(folder)) {
        const code = maskSource(readFileSync(file, "utf8"));
        for (const [pattern, name, anyPosition] of R4_TOKENS) {
          const use = findUse(code, pattern, anyPosition);
          if (use) problems.push(`${label(file)}:${lineOf(code, use.index)} uses ${name}`);
        }
      }
      assert.deepEqual(problems, []);
    });
  }

  test("the token scan sees code, not comments, strings or property names", () => {
    const scan = (source) => R4_TOKENS.filter(([pattern, , anyPosition]) => findUse(maskSource(source), pattern, anyPosition)).map(([, name]) => name);
    assert.deepEqual(scan("const t = Date.now();"), ["Date"]);
    assert.deepEqual(scan("const r = Math.random();"), ["Math.random"]);
    assert.deepEqual(scan("setTimeout(f, 1);"), ["a timer"]);
    assert.deepEqual(scan("const w = globalThis.document;"), ["globalThis"]);
    assert.deepEqual(scan("const s = window.localStorage;"), ["window", "storage"]);
    assert.deepEqual(scan('// Date and window in a comment\nconst help = "time window";'), []);
    assert.deepEqual(scan("const end = scenario.window.end_s; const o = { window: 1 };"), []);
  });
});

describe("R5 tokens in ui", () => {
  test("src/ui uses no network, dynamic code, markup injection or storage", () => {
    const problems = [];
    for (const file of sourceFiles("ui")) {
      const code = maskSource(readFileSync(file, "utf8"), { commentsOnly: true });
      for (const [pattern, name] of R5_TOKENS) {
        const use = code.match(new RegExp(pattern.source));
        if (use) problems.push(`${label(file)}:${lineOf(code, use.index)} uses ${name}`);
      }
    }
    assert.deepEqual(problems, []);
  });

  test("the ui scan keeps strings, so a bracketed property name is caught", () => {
    const code = maskSource('// innerHTML in a comment is fine\nnode["innerHTML"] = text;', { commentsOnly: true });
    assert.ok(R5_TOKENS.some(([pattern]) => new RegExp(pattern.source).test(code)));
    assert.ok(!R5_TOKENS.some(([pattern]) => new RegExp(pattern.source).test(maskSource("// innerHTML only", { commentsOnly: true }))));
  });
});

describe("text scans", () => {
  test("no file under playground/ contains a string from the label tuple (R8, design H-8)", () => {
    const labels = requiredLabels();
    const problems = [];
    for (const file of filesUnder(PLAYGROUND_ROOT)) {
      const text = readFileSync(file, "utf8");
      labels.forEach((value, index) => {
        if (text.includes(value)) problems.push(`${label(file)} contains entry ${index} of the label tuple`);
      });
    }
    assert.ok(filesUnder(PLAYGROUND_ROOT).length > 0);
    assert.deepEqual(problems, []);
  });

  test("src/ui/labels.js holds no em or en dash, written or escaped", () => {
    const file = join(SRC, "ui/labels.js");
    if (!existsSync(file)) return; // scanned as soon as the file exists
    const text = readFileSync(file, "utf8");
    const problems = [];
    text.split("\n").forEach((line, index) => {
      if (/[\u2013\u2014]|\\u201[34]|\\u\{201[34]\}|&[mn]dash;/i.test(line)) problems.push(`src/ui/labels.js:${index + 1}`);
    });
    assert.deepEqual(problems, []);
  });
});
