// Packs the playground into one offline HTML file (contract section 9, design section 9.4).
// Two bundles come from one rewriter: the page bundle from src/ui/app.js and the worker bundle from
// src/runtime/worker.js. Each module runs inside its own function scope, in topological order, with its
// import and export statements rewritten to local bindings. No eval, no network, no dependency.
//
// Usage: node playground/fleetlab/tools/pack.mjs --out dist/fleetlab-playground.html [--playground <dir>]
//        node playground/fleetlab/tools/pack.mjs --site dist/site [--playground <dir>]   (a folder for a static host)
// Exit 0 on success, 1 on a bundling error, 2 on a usage error or a refused output path (nothing written).

import { existsSync, lstatSync, mkdirSync, readdirSync, readFileSync, realpathSync, statSync, writeFileSync } from "node:fs";
import { basename, dirname, join, relative, resolve, sep } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import vm from "node:vm";

/** The design section 9.4 content security policy, verbatim. */
export const CONTENT_SECURITY_POLICY =
  "default-src 'none'; script-src 'unsafe-inline'; worker-src blob:; style-src 'unsafe-inline'; img-src data:; " +
  "connect-src 'none'; form-action 'none'; base-uri 'none'";

/** Marker comment written before every module in a bundle; check-dist reads it to find module text. */
export const MODULE_MARKER = "// fleetlab-module: ";

/**
 * The hosted folder's policy (`--site`): the page, its modules, the worker and the stylesheet come from the site's own
 * origin and nothing comes from anywhere else. Inline scripts are refused; style attributes on chart nodes need
 * `'unsafe-inline'` in style-src, as in the packed file.
 */
export const SITE_CONTENT_SECURITY_POLICY =
  "default-src 'none'; script-src 'self'; worker-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; " +
  "connect-src 'none'; form-action 'none'; base-uri 'none'";

/** Response headers a static host serves for the folder (the `_headers` format): the policy again, with frame-ancestors. */
export const SITE_HEADERS = [
  "/*",
  `  Content-Security-Policy: ${SITE_CONTENT_SECURITY_POLICY}; frame-ancestors 'none'`,
  "  X-Frame-Options: DENY",
  "  X-Content-Type-Options: nosniff",
  "  Referrer-Policy: no-referrer",
  "  Cross-Origin-Opener-Policy: same-origin",
  "  Cache-Control: public, max-age=600",
  "",
].join("\n");

/** The hosted folder's boot module: the development shell's inline script as a file, so the policy can refuse inline code. */
export const SITE_BOOT = [
  'import { start } from "./src/ui/app.js";',
  'start({ studio: true, createWorker: () => new Worker(new URL("./src/runtime/worker.js", import.meta.url), { type: "module" }) });',
  "",
].join("\n");

/** Throwable build error with a clear message. */
export class PackError extends Error {
  constructor(message) {
    super(message);
    this.name = "PackError";
  }
}

const ID_CHAR = /[A-Za-z0-9_$]/;
const REGEX_AFTER_WORDS = new Set([
  "return", "typeof", "instanceof", "in", "of", "new", "delete", "void", "throw", "case", "do", "else", "yield", "await",
]);

/**
 * Masks a JavaScript source: comment, string, template-text and regular-expression characters become spaces
 * (newlines kept, delimiters kept), so keyword scans see code only. Output length equals input length.
 * With `{commentsOnly: true}` only comments are masked.
 */
export function maskSource(src, { commentsOnly = false, literals = null } = {}) {
  const out = src.split("");
  const n = src.length;
  const blank = (from, to) => {
    for (let k = from; k < to; k += 1) if (out[k] !== "\n") out[k] = " ";
  };
  const keepLiteral = (from, to) => {
    if (literals) literals.push([from, to]);
  };
  const templateBraceDepth = []; // one entry per open `${`, holding the brace depth inside it
  let i = 0;
  let lastSignificant = ""; // last non-space code character, or a word
  const scanTemplateText = () => {
    // i is just after a backtick or a closing `}` of a substitution.
    const start = i;
    while (i < n) {
      const c = src[i];
      if (c === "\\") {
        i += 2;
        continue;
      }
      if (c === "`") {
        keepLiteral(start, i);
        if (!commentsOnly) blank(start, i);
        i += 1;
        lastSignificant = "`";
        return;
      }
      if (c === "$" && src[i + 1] === "{") {
        keepLiteral(start, i);
        if (!commentsOnly) blank(start, i);
        i += 2;
        templateBraceDepth.push(0);
        lastSignificant = "{";
        return;
      }
      i += 1;
    }
    throw new PackError("unterminated template literal");
  };
  while (i < n) {
    const c = src[i];
    const d = src[i + 1];
    if (c === "/" && d === "/") {
      const end = src.indexOf("\n", i);
      const stop = end === -1 ? n : end;
      blank(i, stop);
      i = stop;
      continue;
    }
    if (c === "/" && d === "*") {
      const end = src.indexOf("*/", i + 2);
      if (end === -1) throw new PackError("unterminated block comment");
      blank(i, end + 2);
      i = end + 2;
      continue;
    }
    if (c === '"' || c === "'") {
      let j = i + 1;
      while (j < n && src[j] !== c) {
        if (src[j] === "\\") j += 1;
        else if (src[j] === "\n") throw new PackError("unterminated string literal");
        j += 1;
      }
      if (j >= n) throw new PackError("unterminated string literal");
      keepLiteral(i + 1, j);
      if (!commentsOnly) blank(i + 1, j);
      i = j + 1;
      lastSignificant = c;
      continue;
    }
    if (c === "`") {
      i += 1;
      scanTemplateText();
      continue;
    }
    if (templateBraceDepth.length > 0 && (c === "{" || c === "}")) {
      const top = templateBraceDepth.length - 1;
      if (c === "{") templateBraceDepth[top] += 1;
      else if (templateBraceDepth[top] === 0) {
        templateBraceDepth.pop();
        i += 1;
        scanTemplateText();
        continue;
      } else templateBraceDepth[top] -= 1;
      lastSignificant = c;
      i += 1;
      continue;
    }
    if (c === "/") {
      const regexStart = lastSignificant === "" || /^[(,=:[!&|?{};+\-*%<>~^]$/.test(lastSignificant) ||
        REGEX_AFTER_WORDS.has(lastSignificant);
      if (regexStart) {
        let j = i + 1;
        let inClass = false;
        while (j < n) {
          const r = src[j];
          if (r === "\\") j += 1;
          else if (r === "\n") throw new PackError("unterminated regular expression");
          else if (r === "[") inClass = true;
          else if (r === "]") inClass = false;
          else if (r === "/" && !inClass) break;
          j += 1;
        }
        if (!commentsOnly) blank(i + 1, j);
        i = j + 1;
        while (i < n && ID_CHAR.test(src[i])) i += 1;
        lastSignificant = "/regex";
        continue;
      }
      lastSignificant = "/";
      i += 1;
      continue;
    }
    if (ID_CHAR.test(c)) {
      let j = i;
      while (j < n && ID_CHAR.test(src[j])) j += 1;
      lastSignificant = src.slice(i, j);
      i = j;
      continue;
    }
    // Two adjacent `+` or `-` form a `++` or `--` punctuator (maximal munch); a `/` after one is division.
    if ((c === "+" || c === "-") && lastSignificant === c && src[i - 1] === c) lastSignificant = c + c;
    else if (!/\s/.test(c)) lastSignificant = c;
    i += 1;
  }
  return out.join("");
}

/** Finds whole-word keyword positions in masked code, skipping property accesses such as `a.import`. */
function keywordPositions(masked, word) {
  const found = [];
  let at = masked.indexOf(word);
  while (at !== -1) {
    const before = masked[at - 1];
    const after = masked[at + word.length];
    const isWord = (before === undefined || !ID_CHAR.test(before)) && (after === undefined || !ID_CHAR.test(after));
    let k = at - 1;
    while (k >= 0 && /\s/.test(masked[k])) k -= 1;
    const isProperty = k >= 0 && masked[k] === "." && masked[k - 1] !== ".";
    if (isWord && !isProperty) found.push(at);
    at = masked.indexOf(word, at + word.length);
  }
  return found;
}

const skipSpace = (s, i) => {
  while (i < s.length && /\s/.test(s[i])) i += 1;
  return i;
};

function readIdentifier(s, i) {
  const m = /^[A-Za-z_$][A-Za-z0-9_$]*/.exec(s.slice(i));
  return m ? { name: m[0], end: i + m[0].length } : null;
}

/** Reads a quoted specifier at `i` (masked text keeps the quotes; the value comes from the source). */
function readSpecifier(masked, src, i, what) {
  const q = masked[i];
  if (q !== '"' && q !== "'") throw new PackError(`${what}: expected a quoted module specifier`);
  const close = masked.indexOf(q, i + 1);
  return { value: src.slice(i + 1, close), end: close + 1 };
}

function readFrom(masked, src, i, what) {
  i = skipSpace(masked, i);
  const word = readIdentifier(masked, i);
  if (!word || word.name !== "from") throw new PackError(`${what}: expected "from"`);
  return readSpecifier(masked, src, skipSpace(masked, word.end), what);
}

function endStatement(masked, i) {
  const j = skipSpace(masked, i);
  return masked[j] === ";" ? j + 1 : i;
}

/** Parses `{ a, b as c }` in masked text; returns pairs [left, right] and the index after `}`. */
function readBraceList(masked, i, what) {
  const close = masked.indexOf("}", i);
  if (close === -1) throw new PackError(`${what}: unterminated brace list`);
  const pairs = [];
  for (const part of masked.slice(i + 1, close).split(",")) {
    const text = part.trim();
    if (text === "") continue;
    const m = /^([A-Za-z_$][A-Za-z0-9_$]*)(?:\s+as\s+([A-Za-z_$][A-Za-z0-9_$]*))?$/.exec(text);
    if (!m) throw new PackError(`${what}: unsupported binding "${text}"`);
    pairs.push([m[1], m[2] ?? m[1]]);
  }
  return { pairs, end: close + 1 };
}

const STATEMENT_START = /^(?:const|let|var|function|class|async|export|import|if|for|while|do|switch|try|throw|return)(?![A-Za-z0-9_$])/;

/**
 * Names declared by `const a = 1, b = 2;` starting at the first name; destructuring is refused. The declaration
 * must end with a top-level `;`: a line that ends a value and is followed by a new statement (or the end of the
 * source) before any `;` is refused, so a later statement's names can never leak into the exports.
 */
function declaredNames(masked, i, what) {
  const first = readIdentifier(masked, i);
  if (!first) throw new PackError(`${what}: destructuring exports are not supported`);
  const names = [first.name];
  const noSemicolon = () => new PackError(`${what}: exported declarations must end with a semicolon`);
  let depth = 0;
  for (let j = first.end; j < masked.length; j += 1) {
    const c = masked[j];
    if (c === "(" || c === "[" || c === "{") depth += 1;
    else if (c === ")" || c === "]" || c === "}") depth -= 1;
    else if (c === ";" && depth === 0) return names;
    else if (c === "\n" && depth === 0) {
      let k = j - 1;
      while (k >= 0 && /\s/.test(masked[k])) k -= 1;
      const endsValue = k >= 0 && /[A-Za-z0-9_$)\]}"'`]/.test(masked[k]);
      const next = skipSpace(masked, j);
      if (endsValue && (next >= masked.length || STATEMENT_START.test(masked.slice(next, next + 9)))) throw noSemicolon();
    } else if (c === "," && depth === 0) {
      const next = readIdentifier(masked, skipSpace(masked, j + 1));
      if (!next) throw new PackError(`${what}: destructuring exports are not supported`);
      names.push(next.name);
    }
  }
  throw noSemicolon();
}

/**
 * Whether a module-level `let` or `var` binding `name` is assigned anywhere besides its declaration initializer
 * (`=`, compound assignment, `++` or `--`). Scope-insensitive, so a shadowing local counts too: that refuses loudly
 * rather than silently. Destructuring assignment is not detected.
 */
function reassigned(masked, name) {
  const id = name.replace(/\$/g, "\\$");
  const before = "(?<![A-Za-z0-9_$.])";
  const after = "(?![A-Za-z0-9_$])";
  const writes = new RegExp(
    `${before}${id}\\s*(?:\\*\\*|<<|>>>|>>|&&|\\|\\||\\?\\?|[-+*/%&|^])?=(?![=>])|${before}${id}\\s*(?:\\+\\+|--)|(?:\\+\\+|--)\\s*${id}${after}`,
    "g",
  );
  const initializers = new RegExp(`\\b(?:let|var)\\s+${id}\\s*=(?![=>])`, "g");
  return (masked.match(writes) ?? []).length > (masked.match(initializers) ?? []).length;
}

/** Whether `name` is declared with `let` or `var` in the masked module text. */
function declaredMutable(masked, name) {
  return new RegExp(`\\b(?:let|var)\\s+${name.replace(/\$/g, "\\$")}(?![A-Za-z0-9_$])`).test(masked);
}

/**
 * Parses one module's import and export statements.
 * Returns {imports, exports, edits}: imports [{specifier, kind: "named"|"namespace"|"bare", pairs?, name?}],
 * exports [{kind: "local", local, exported} | {kind: "reexport", specifier, imported, exported} |
 * {kind: "star", specifier} | {kind: "starAs", specifier, exported}], edits [{start, end, text}] to apply to the source.
 * Throws PackError on import.meta, a dynamic import, default imports or exports, and unsupported forms.
 */
export function parseModule(src, label = "module") {
  const masked = maskSource(src);
  const imports = [];
  const exports = [];
  const edits = [];
  for (const at of keywordPositions(masked, "import")) {
    const what = `${label}: import at offset ${at}`;
    let i = skipSpace(masked, at + 6);
    if (masked[i] === ".") throw new PackError(`${label}: import.meta is not allowed in bundled code`);
    if (masked[i] === "(") throw new PackError(`${label}: dynamic import( is not allowed in bundled code`);
    if (masked[i] === '"' || masked[i] === "'") {
      const spec = readSpecifier(masked, src, i, what);
      imports.push({ specifier: spec.value, kind: "bare" });
      edits.push({ start: at, end: endStatement(masked, spec.end), text: "" });
      continue;
    }
    if (masked[i] === "*") {
      i = skipSpace(masked, i + 1);
      const as = readIdentifier(masked, i);
      if (!as || as.name !== "as") throw new PackError(`${what}: expected "as" after "*"`);
      const name = readIdentifier(masked, skipSpace(masked, as.end));
      if (!name) throw new PackError(`${what}: expected a namespace name`);
      const spec = readFrom(masked, src, name.end, what);
      imports.push({ specifier: spec.value, kind: "namespace", name: name.name });
      edits.push({ start: at, end: endStatement(masked, spec.end), text: "" });
      continue;
    }
    if (masked[i] === "{") {
      const list = readBraceList(masked, i, what);
      const spec = readFrom(masked, src, list.end, what);
      imports.push({ specifier: spec.value, kind: "named", pairs: list.pairs });
      edits.push({ start: at, end: endStatement(masked, spec.end), text: "" });
      continue;
    }
    throw new PackError(`${what}: default imports and other import forms are not supported`);
  }
  for (const at of keywordPositions(masked, "export")) {
    const what = `${label}: export at offset ${at}`;
    let i = skipSpace(masked, at + 6);
    const removeKeyword = { start: at, end: i, text: "" };
    if (masked[i] === "{") {
      const list = readBraceList(masked, i, what);
      const j = skipSpace(masked, list.end);
      const word = readIdentifier(masked, j);
      if (word && word.name === "from") {
        const spec = readFrom(masked, src, list.end, what);
        for (const [imported, exported] of list.pairs) exports.push({ kind: "reexport", specifier: spec.value, imported, exported });
        edits.push({ start: at, end: endStatement(masked, spec.end), text: "" });
      } else {
        for (const [local, exported] of list.pairs) {
          const mutable = declaredMutable(masked, local) && reassigned(masked, local);
          exports.push({ kind: "local", local, exported, mutable });
        }
        edits.push({ start: at, end: endStatement(masked, list.end), text: "" });
      }
      continue;
    }
    if (masked[i] === "*") {
      i = skipSpace(masked, i + 1);
      const as = readIdentifier(masked, i);
      if (as && as.name === "as") {
        const name = readIdentifier(masked, skipSpace(masked, as.end));
        if (!name) throw new PackError(`${what}: expected a namespace name`);
        const spec = readFrom(masked, src, name.end, what);
        exports.push({ kind: "starAs", specifier: spec.value, exported: name.name });
        edits.push({ start: at, end: endStatement(masked, spec.end), text: "" });
      } else {
        const spec = readFrom(masked, src, i, what);
        exports.push({ kind: "star", specifier: spec.value });
        edits.push({ start: at, end: endStatement(masked, spec.end), text: "" });
      }
      continue;
    }
    let word = readIdentifier(masked, i);
    if (!word) throw new PackError(`${what}: unsupported export form`);
    if (word.name === "default") throw new PackError(`${what}: default exports are not supported`);
    if (word.name === "async") word = readIdentifier(masked, skipSpace(masked, word.end));
    if (word && word.name === "function") {
      let j = skipSpace(masked, word.end);
      if (masked[j] === "*") j = skipSpace(masked, j + 1);
      const name = readIdentifier(masked, j);
      if (!name) throw new PackError(`${what}: exported function needs a name`);
      exports.push({ kind: "local", local: name.name, exported: name.name });
      edits.push(removeKeyword);
      continue;
    }
    if (word && word.name === "class") {
      const name = readIdentifier(masked, skipSpace(masked, word.end));
      if (!name) throw new PackError(`${what}: exported class needs a name`);
      exports.push({ kind: "local", local: name.name, exported: name.name });
      edits.push(removeKeyword);
      continue;
    }
    if (word && (word.name === "const" || word.name === "let" || word.name === "var")) {
      const mutable = word.name !== "const"; // a let or var export can change after an importer reads it
      for (const name of declaredNames(masked, skipSpace(masked, word.end), what)) {
        exports.push({ kind: "local", local: name, exported: name, mutable });
      }
      edits.push(removeKeyword);
      continue;
    }
    throw new PackError(`${what}: unsupported export form`);
  }
  edits.sort((a, b) => a.start - b.start);
  return { imports, exports, edits };
}

/** Resolves a relative specifier against the importing file; bare and absolute specifiers are refused. */
function resolveSpecifier(fromFile, specifier, sourceRoot) {
  if (!specifier.startsWith("./") && !specifier.startsWith("../")) {
    throw new PackError(`${fromFile}: only relative module specifiers are supported, found "${specifier}"`);
  }
  const target = resolve(dirname(fromFile), specifier);
  if (!target.startsWith(sourceRoot + sep)) {
    throw new PackError(`${fromFile}: "${specifier}" resolves outside ${sourceRoot}`);
  }
  if (!existsSync(target) || !statSync(target).isFile()) {
    throw new PackError(`${fromFile}: cannot find module "${specifier}"`);
  }
  return target;
}

/**
 * The module graph reachable from `entryFile` in dependency order (a module after everything it imports):
 * `{root, entry, order, records}`, each record `{file, label, src, parsed, deps, id, exportNames, mutableExports}`.
 * `sourceRoot` bounds resolution and names modules by their path from its parent, for example `src/ui/labels.js`.
 */
export function moduleGraph(entryFile, sourceRoot) {
  const root = resolve(sourceRoot);
  const entry = resolve(entryFile);
  if (!existsSync(entry)) throw new PackError(`entry module not found: ${relative(root, entry) || entry}`);
  const order = [];
  const records = new Map();
  const visiting = new Set();
  const visit = (file, chain) => {
    if (records.has(file)) return;
    if (visiting.has(file)) {
      throw new PackError(`import cycle: ${[...chain, file].map((f) => relative(root, f)).join(" -> ")}`);
    }
    visiting.add(file);
    const label = relative(dirname(root), file).split(sep).join("/"); // for example src/ui/labels.js
    const src = readFileSync(file, "utf8");
    const parsed = parseModule(src, label);
    const deps = new Map();
    for (const item of [...parsed.imports, ...parsed.exports]) {
      if (!item.specifier) continue;
      const target = resolveSpecifier(file, item.specifier, root);
      deps.set(item.specifier, target);
      visit(target, [...chain, file]);
    }
    visiting.delete(file);
    const record = { file, label, src, parsed, deps, id: `__fleetlab_m${order.length}` };
    records.set(file, record);
    order.push(record);
    record.exportNames = exportNamesOf(record, records);
  };
  visit(entry, []);
  return { root, entry, order, records };
}

/**
 * Bundles the module graph reachable from `entryFile` into one classic script defining `const <globalName>`
 * as the entry module's namespace. `sourceRoot` bounds resolution and names modules in marker comments.
 */
export function bundle(entryFile, { sourceRoot, globalName }) {
  const { entry, order, records } = moduleGraph(entryFile, sourceRoot);

  const parts = [`const ${globalName} = (() => {`, `"use strict";`];
  for (const record of order) parts.push(MODULE_MARKER + record.label, renderModule(record, records));
  parts.push(`return ${records.get(entry).id};`, `})();`, "");
  const code = parts.join("\n");
  assertNoModuleSyntax(code, globalName);
  assertCompiles(code, globalName);
  return code;
}

/**
 * Compiles (never runs) a rendered bundle, so any masker misreading that leaves invalid code fails the pack
 * instead of the browser. node:vm is a build-time parser here; nothing of it reaches the page.
 */
export function assertCompiles(code, label = "bundle") {
  try {
    new vm.Script(code, { filename: `${label}.js` });
  } catch (err) {
    throw new PackError(`${label}: the bundle does not compile: ${err.message}`);
  }
}

/**
 * Map from exported name to a getter expression, computed once dependencies are known. Also sets
 * `record.mutableExports`, the exported names bound to a `let` or `var` that can change after import.
 */
function exportNamesOf(record, records) {
  const names = new Map();
  const mutable = new Set();
  record.mutableExports = mutable;
  const depOf = (specifier) => records.get(record.deps.get(specifier));
  for (const ex of record.parsed.exports) {
    if (ex.kind === "star") {
      const dep = depOf(ex.specifier);
      for (const [name] of dep.exportNames) {
        if (names.has(name)) continue;
        names.set(name, `${dep.id}.${name}`);
        if (dep.mutableExports.has(name)) mutable.add(name);
      }
    }
  }
  for (const ex of record.parsed.exports) {
    let expression;
    let isMutable = false;
    if (ex.kind === "local") {
      expression = ex.local;
      isMutable = ex.mutable === true;
    } else if (ex.kind === "reexport") {
      const dep = depOf(ex.specifier);
      if (!dep.exportNames.has(ex.imported)) {
        throw new PackError(`${record.label}: ${dep.label} does not export "${ex.imported}"`);
      }
      expression = `${dep.id}.${ex.imported}`;
      isMutable = dep.mutableExports.has(ex.imported);
    } else if (ex.kind === "starAs") expression = depOf(ex.specifier).id;
    else continue;
    names.set(ex.exported, expression);
    if (isMutable) mutable.add(ex.exported);
    else mutable.delete(ex.exported);
  }
  return names;
}

function renderModule(record, records) {
  const { src, parsed } = record;
  let body = "";
  let at = 0;
  for (const edit of parsed.edits) {
    body += src.slice(at, edit.start) + edit.text;
    at = edit.end;
  }
  body += src.slice(at);
  const header = [];
  for (const imp of parsed.imports) {
    const dep = records.get(record.deps.get(imp.specifier));
    if (imp.kind === "namespace") header.push(`const ${imp.name} = ${dep.id};`);
    if (imp.kind === "named") {
      for (const [imported] of imp.pairs) {
        if (!dep.exportNames.has(imported)) {
          throw new PackError(`${record.label}: ${dep.label} does not export "${imported}"`);
        }
        // A named import is copied once; a mutable export read that way would go stale where native ESM stays live.
        if (dep.mutableExports.has(imported)) {
          throw new PackError(
            `${record.label}: "${imported}" is a mutable export of ${dep.label}; import it with import * as NS and read NS.${imported}`,
          );
        }
      }
      const bindings = imp.pairs.map(([imported, local]) => (imported === local ? local : `${imported}: ${local}`));
      if (bindings.length > 0) header.push(`const { ${bindings.join(", ")} } = ${dep.id};`);
    }
  }
  const getters = [...record.exportNames].map(([name, expression]) => `get ${name}() { return ${expression}; }`);
  return [
    `const ${record.id} = (function () {`,
    ...header,
    body,
    `return Object.freeze({ __proto__: null${getters.map((g) => `, ${g}`).join("")} });`,
    `})();`,
  ].join("\n");
}

/** Throws when bundled code still holds an import, export or import.meta outside strings and comments. */
export function assertNoModuleSyntax(code, label = "bundle") {
  const masked = maskSource(code);
  if (/\bimport\s*\.\s*meta\b/.test(masked)) throw new PackError(`${label}: leftover import.meta`);
  for (const word of ["import", "export"]) {
    const positions = keywordPositions(masked, word);
    if (positions.length > 0) {
      const line = masked.slice(0, positions[0]).split("\n").length;
      throw new PackError(`${label}: leftover ${word} on bundle line ${line}`);
    }
  }
}

/** Walks up from `start` to the directory holding `.git` (a directory, or a file in a worktree). */
export function findRepositoryRoot(start) {
  let dir = resolve(start);
  for (;;) {
    if (existsSync(join(dir, ".git"))) return dir;
    const parent = dirname(dir);
    if (parent === dir) return null;
    dir = parent;
  }
}

/** Whether `path` names a directory entry (a symbolic link counts, even a dangling one). */
function entryExists(path) {
  try {
    lstatSync(path);
    return true;
  } catch (err) {
    if (err.code === "ENOENT" || err.code === "ENOTDIR") return false;
    throw err;
  }
}

/**
 * Resolves symlinks and letter case on the longest existing prefix of `path`, with the operating system's own
 * spelling (`realpathSync.native`). The walk stops at any existing entry, so a dangling symbolic link is resolved
 * and throws ENOENT instead of being treated as a plain missing name.
 */
function realPathOf(path) {
  const rest = [];
  let dir = resolve(path);
  while (!entryExists(dir)) {
    rest.unshift(basename(dir));
    const parent = dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return join(realpathSync.native(dir), ...rest);
}

/**
 * Decides whether `outPath` may be written: outside the repository root, or inside `<root>/dist/`.
 * Returns {ok: true, path} or {ok: false, reason}. A path through a dangling symbolic link is refused.
 */
export function checkOutputPath(outPath, repoRoot) {
  let target;
  try {
    target = realPathOf(outPath);
  } catch (err) {
    return { ok: false, reason: `refusing a path that cannot be resolved (${err.code ?? err.message}), such as a broken symbolic link: ${outPath}` };
  }
  if (!target.toLowerCase().endsWith(".html")) return { ok: false, reason: `output must be an .html file: ${target}` };
  const location = locationRule(target, repoRoot);
  return location.ok ? { ok: true, path: target } : location;
}

/** The one place rule: a real path outside the repository, or inside `<root>/dist/`; anything else is refused. */
function locationRule(target, repoRoot) {
  const root = realpathSync.native(repoRoot);
  if (target !== root && !target.startsWith(root + sep)) return { ok: true };
  const inside = relative(root, target).split(sep);
  if (inside[0] === "dist" && inside.length > 1) return { ok: true };
  const area = inside[0] === "artifacts" || inside[0] === "experiments" ? `the repository's ${inside[0]}/ folder` : "the repository";
  return { ok: false, reason: `refusing to write inside ${area}: ${target}. Write outside the repository or under dist/.` };
}

/** The first entry under `dir` that the site manifest `files` does not name (a symbolic link always counts), or null. */
function foreignEntry(dir, files, prefix = "") {
  const paths = [...files.keys()];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const rel = prefix + entry.name;
    if (entry.isSymbolicLink()) return rel;
    if (entry.isDirectory()) {
      if (!paths.some((p) => p.startsWith(`${rel}/`))) return rel;
      const inner = foreignEntry(join(dir, entry.name), files, `${rel}/`);
      if (inner !== null) return inner;
    } else if (!entry.isFile() || !files.has(rel)) return rel;
  }
  return null;
}

/**
 * Decides whether the site folder `outDir` may be written: the same place rule as `checkOutputPath`, a folder rather
 * than an .html file, and, once the manifest `files` is known, a folder that holds nothing the manifest does not name,
 * so a stale or foreign file can never ride along to a host. Returns {ok: true, path} or {ok: false, reason}.
 */
export function checkSitePath(outDir, repoRoot, files = null) {
  let target;
  try {
    target = realPathOf(outDir);
  } catch (err) {
    return { ok: false, reason: `refusing a path that cannot be resolved (${err.code ?? err.message}), such as a broken symbolic link: ${outDir}` };
  }
  if (target.toLowerCase().endsWith(".html")) return { ok: false, reason: `a site is a folder, not an .html file: ${target}` };
  const location = locationRule(target, repoRoot);
  if (!location.ok) return location;
  if (entryExists(target)) {
    if (!lstatSync(target).isDirectory()) return { ok: false, reason: `refusing to write over something that is not a folder: ${target}` };
    const foreign = files === null ? null : foreignEntry(target, files);
    if (foreign !== null) {
      return { ok: false, reason: `refusing to write into a folder that holds an entry the site does not name (${foreign}): ${target}. Empty it first.` };
    }
  }
  return { ok: true, path: target };
}

/** Builds the packed HTML text from the playground folder. */
export function buildHtml(playgroundDir) {
  const dir = resolve(playgroundDir);
  const workerEntry = join(dir, "src/runtime/worker.js");
  if (!existsSync(workerEntry)) {
    throw new PackError("src/runtime/worker.js does not exist yet; the worker bundle cannot be built");
  }
  const sourceRoot = join(dir, "src");
  const pageBundle = bundle(join(dir, "src/ui/app.js"), { sourceRoot, globalName: "FleetLabPage" });
  const workerBundle = bundle(workerEntry, { sourceRoot, globalName: "FleetLabWorker" });
  const cssPath = join(dir, "styles.css");
  if (!existsSync(cssPath)) throw new PackError("styles.css does not exist; it is inlined into the packed file");
  const css = readFileSync(cssPath, "utf8");
  if (/<\/style/i.test(css)) throw new PackError("styles.css contains </style");
  if (/<\/script|<!--/i.test(pageBundle)) throw new PackError("the page bundle contains </script or <!--");
  let html = readFileSync(join(dir, "index.html"), "utf8");
  html = html.replace(/<script\b[\s\S]*?<\/script>\s*/gi, "").replace(/<link\b[^>]*>\s*/gi, "");
  const head = /<head\b[^>]*>/i.exec(html);
  if (!head || !/<\/head>/i.test(html) || !/<\/body>/i.test(html)) {
    throw new PackError("index.html needs <head>, </head> and </body>");
  }
  if (/Content-Security-Policy/i.test(html)) throw new PackError("index.html already declares a policy");
  const meta = `<meta http-equiv="Content-Security-Policy" content="${CONTENT_SECURITY_POLICY}">`;
  const workerLiteral = JSON.stringify(workerBundle).replace(/</g, "\\u003c");
  const script = [
    "<script>",
    `const FLEETLAB_WORKER_SOURCE = ${workerLiteral};`,
    pageBundle,
    'FleetLabPage.start({studio: true, createWorker: () => new Worker(URL.createObjectURL(new Blob([FLEETLAB_WORKER_SOURCE], {type: "text/javascript"})))});',
    "</script>",
  ].join("\n");
  const at = head.index + head[0].length;
  html = html.slice(0, at) + meta + html.slice(at);
  html = html.replace(/<\/head>/i, () => `<style>\n${css}\n</style>\n</head>`);
  html = html.replace(/<\/body>/i, () => `${script}\n</body>`);
  return html;
}

/**
 * The hosted folder as a map from relative path to text (`--site`): every module the page or the worker reaches,
 * unchanged, at its `src/` path; `styles.css`; `index.html` as the development shell with the site policy first in
 * `<head>`, the stylesheet link and one module script for `boot.js`; `boot.js`; and `_headers`. Nothing else, so
 * tests, tools and fixtures never reach a host.
 */
export function buildSite(playgroundDir) {
  const dir = resolve(playgroundDir);
  const workerEntry = join(dir, "src/runtime/worker.js");
  if (!existsSync(workerEntry)) throw new PackError("src/runtime/worker.js does not exist yet; the site cannot be built");
  const sourceRoot = join(dir, "src");
  const files = new Map();
  for (const entry of [join(dir, "src/ui/app.js"), workerEntry]) {
    for (const record of moduleGraph(entry, sourceRoot).order) files.set(record.label, record.src);
  }
  const cssPath = join(dir, "styles.css");
  if (!existsSync(cssPath)) throw new PackError("styles.css does not exist; the site links it");
  files.set("styles.css", readFileSync(cssPath, "utf8"));
  let html = readFileSync(join(dir, "index.html"), "utf8");
  html = html.replace(/<script\b[\s\S]*?<\/script>\s*/gi, "").replace(/<link\b[^>]*>\s*/gi, "");
  const head = /<head\b[^>]*>/i.exec(html);
  if (!head || !/<\/head>/i.test(html) || !/<\/body>/i.test(html)) {
    throw new PackError("index.html needs <head>, </head> and </body>");
  }
  if (/Content-Security-Policy/i.test(html)) throw new PackError("index.html already declares a policy");
  const at = head.index + head[0].length;
  html = html.slice(0, at) + `<meta http-equiv="Content-Security-Policy" content="${SITE_CONTENT_SECURITY_POLICY}">` + html.slice(at);
  html = html.replace(/<\/head>/i, () => '<link rel="stylesheet" href="./styles.css">\n</head>');
  html = html.replace(/<\/body>/i, () => '<script type="module" src="./boot.js"></script>\n</body>');
  files.set("index.html", html);
  files.set("boot.js", SITE_BOOT);
  files.set("_headers", SITE_HEADERS);
  return files;
}

/** Command-line entry. Returns the exit status; writes only the requested output. */
export function main(argv, { cwd = process.cwd(), log = console.log, error = console.error } = {}) {
  let out = null;
  let site = null;
  let playground = resolve(dirname(fileURLToPath(import.meta.url)), "..");
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] === "--out") out = argv[++i] ?? null;
    else if (argv[i] === "--site") site = argv[++i] ?? null;
    else if (argv[i] === "--playground") playground = resolve(cwd, argv[++i] ?? "");
    else {
      error(`pack: unknown argument ${argv[i]}`);
      return 2;
    }
  }
  if (!out === !site) {
    error("pack: usage: pack.mjs --out <file.html> | --site <folder> [--playground <dir>]");
    return 2;
  }
  const repoRoot = findRepositoryRoot(playground);
  if (!repoRoot) {
    error(`pack: no repository root (.git) found above ${playground}`);
    return 2;
  }
  if (site) return writeSite(resolve(cwd, site), { playground, repoRoot, log, error });
  const decision = checkOutputPath(resolve(cwd, out), repoRoot);
  if (!decision.ok) {
    error(`pack: ${decision.reason}`);
    return 2;
  }
  let html;
  try {
    html = buildHtml(playground);
  } catch (err) {
    if (!(err instanceof PackError)) throw err;
    error(`pack: ${err.message}`);
    return 1;
  }
  mkdirSync(dirname(decision.path), { recursive: true });
  // Check again right before writing: the build ran in between, and the file itself must be absent or a regular file.
  const again = checkOutputPath(decision.path, repoRoot);
  if (!again.ok || again.path !== decision.path) {
    error(`pack: ${again.ok ? `the output path changed while building: ${decision.path}` : again.reason}`);
    return 2;
  }
  if (entryExists(decision.path) && !lstatSync(decision.path).isFile()) {
    error(`pack: refusing to write over something that is not a regular file: ${decision.path}`);
    return 2;
  }
  writeFileSync(decision.path, html);
  log(`pack: wrote ${decision.path} (${Buffer.byteLength(html)} bytes)`);
  return 0;
}

/** `--site`: the place rule before building, the build, then the foreign-entry rule right before writing each file. */
function writeSite(outDir, { playground, repoRoot, log, error }) {
  const place = checkSitePath(outDir, repoRoot);
  if (!place.ok) {
    error(`pack: ${place.reason}`);
    return 2;
  }
  let files;
  try {
    files = buildSite(playground);
  } catch (err) {
    if (!(err instanceof PackError)) throw err;
    error(`pack: ${err.message}`);
    return 1;
  }
  const decision = checkSitePath(outDir, repoRoot, files);
  if (!decision.ok || decision.path !== place.path) {
    error(`pack: ${decision.ok ? `the output path changed while building: ${place.path}` : decision.reason}`);
    return 2;
  }
  let bytes = 0;
  for (const [path, text] of files) {
    const file = join(decision.path, ...path.split("/"));
    mkdirSync(dirname(file), { recursive: true });
    if (entryExists(file) && !lstatSync(file).isFile()) {
      error(`pack: refusing to write over something that is not a regular file: ${file}`);
      return 2;
    }
    writeFileSync(file, text);
    bytes += Buffer.byteLength(text);
  }
  log(`pack: wrote ${files.size} files to ${decision.path} (${bytes} bytes)`);
  return 0;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  process.exitCode = main(process.argv.slice(2));
}
