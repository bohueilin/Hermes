// Checks a packed playground file before anyone opens or shares it (contract section 9, design section 9.4).
// Fails on an external URL, a missing or different content security policy, a forbidden token, a banned word
// or an em or en dash in interface copy, a string from FleetLab's label tuple, or a size over 2 MB.
//
// Usage: node playground/fleetlab/tools/check-dist.mjs <file.html> [--required-labels <file.json>]
// The label tuple comes from --required-labels (a JSON array), else the FLEETLAB_REQUIRED_LABELS environment
// variable (a JSON array), else it is read from the repository's contracts module; it is never spelled here.
// Exit 0 when clean, 1 with one line per problem, 2 on a usage error.

import { existsSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import { CONTENT_SECURITY_POLICY, MODULE_MARKER, findRepositoryRoot, maskSource } from "./pack.mjs";

/** Largest packed file accepted, in bytes. */
export const MAX_BYTES = 2 * 1024 * 1024;

/** The one http URL allowed: the SVG namespace name, an identifier that is never requested. */
const SVG_NAMESPACE = "http://www.w3.org/2000/svg";

/** Text that may precede the SVG namespace name: an xmlns attribute value or a createElementNS argument. */
const SVG_NAMESPACE_CONTEXT = /(?:\bxmlns(?::[\w.-]+)?\s*=\s*["']?|\bcreateElementNS\s*\(\s*\\?["'`])$/;

/** Attributes a browser resolves as URLs; a prefixed name such as xlink:href counts by its local part. */
const URL_ATTRIBUTES = new Set(["src", "href", "action", "formaction", "poster", "srcset", "imagesrcset", "data", "background", "cite", "ping", "manifest"]);

/** Protocol-relative references in CSS: url(, image-set( (any candidate) and @import. */
const CSS_REMOTE = [/(?:url\(|image-set\(|@import)\s*["']?\s*\/\//i, /image-set\([^;{}<]*?,\s*(?:url\(\s*)?["']?\s*\/\//i];

/** Attributes whose values are interface copy (design H-3). */
const COPY_ATTRIBUTES = new Set(["aria-label", "aria-description", "aria-roledescription", "title", "alt", "placeholder"]);

/** Modules whose string literals are interface copy or export-format copy (contract sections 4 and 8). */
const COPY_MODULES = ["src/ui/labels.js", "src/instrument/summary.js"];

const FORBIDDEN_TOKENS = [
  [/\bfetch\s*\(/, "fetch("],
  [/\bWebSocket\b/, "WebSocket"],
  [/\bsendBeacon\b/, "sendBeacon"],
  [/\bXMLHttpRequest\b/, "XMLHttpRequest"],
  [/\bEventSource\b/, "EventSource"],
  [/\bimport\s*\(/, "import("],
  [/\bimport\s*\.\s*meta\b/, "import.meta"],
  [/\beval\s*\(/, "eval("],
  [/\bnew\s+Function\b/, "new Function"],
  [/\binnerHTML\b/, "innerHTML"],
  [/\bouterHTML\b/, "outerHTML"],
  [/\binsertAdjacentHTML\b/, "insertAdjacentHTML"],
  [/\bdocument\s*\.\s*write/, "document.write"],
  [/\blocalStorage\b/, "localStorage"],
  [/\bsessionStorage\b/, "sessionStorage"],
  [/\bindexedDB\b/, "indexedDB"],
  [/\bdocument\s*\.\s*cookie\b/, "document.cookie"],
  [/<script\b[^>]*\bsrc\s*=/i, "<script src"],
  [/<link\b/i, "<link"],
  [/<(?:iframe|object|embed|base)\b/i, "an embedding or base element"],
  [/@import\b/, "@import"],
];

// Design H-3, as whole words ignoring case, with their inflections.
const BANNED_WORDS = /\b(predict(?:s|ed|ing|ion|ions|ive)?|forecast(?:s|ed|ing|er|ers)?|expected\s+traffic|live|real[\s-]?time|monitoring)\b/i;
const DASHES = /[\u2013\u2014]/;

const ENTITIES = {
  amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: "\u00a0", mdash: "\u2014", ndash: "\u2013",
  colon: ":", sol: "/", bsol: "\\", lpar: "(", rpar: ")", comma: ",", period: ".", tab: "\t", newline: "\n",
};

/** Decodes character references as a browser does: numeric ones with or without `;`, out-of-range ones to U+FFFD. */
function decodeEntities(text) {
  return text.replace(/&(?:#x([0-9a-f]+);?|#([0-9]+);?|([a-z][a-z0-9]*);)/gi, (whole, hex, dec, name) => {
    if (name !== undefined) return ENTITIES[name.toLowerCase()] ?? whole;
    const code = hex !== undefined ? parseInt(hex, 16) : parseInt(dec, 10);
    return code > 0 && code <= 0x10ffff ? String.fromCodePoint(code) : "\uFFFD";
  });
}

/** The HTML with comments removed and script and style contents emptied, so only markup and text remain. */
function markupOf(html) {
  return html.replace(/<!--[\s\S]*?-->/g, "").replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1>/gi, "<$1></$1>");
}

/** `[name, value]` for every attribute of every tag: names lower-cased, quoted or unquoted values entity-decoded. */
function attributesOf(markup) {
  const found = [];
  for (const tag of markup.matchAll(/<[a-z][^\s/>]*((?:[^>"']|"[^"]*"|'[^']*')*)>/gi)) {
    for (const m of tag[1].matchAll(/([^\s"'<>/=]+)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+))/g)) {
      found.push([m[1].toLowerCase(), decodeEntities(m[2] ?? m[3] ?? m[4])]);
    }
  }
  return found;
}

/** URL candidates of a srcset value, split as a browser splits them (a data URL may hold commas). */
function srcsetUrls(value) {
  const urls = [];
  let i = 0;
  while (i < value.length) {
    while (i < value.length && /[\s,]/.test(value[i])) i += 1;
    const start = i;
    while (i < value.length && !/\s/.test(value[i])) i += 1;
    const url = value.slice(start, i);
    urls.push(url.replace(/,+$/, ""));
    if (url.endsWith(",")) continue;
    for (let depth = 0; i < value.length && !(value[i] === "," && depth === 0); i += 1) depth += { "(": 1, ")": -1 }[value[i]] ?? 0;
  }
  return urls.filter(Boolean);
}

/** Whether a URL attribute value holds a protocol-relative reference (tabs and newlines are ignored, as browsers do). */
function isProtocolRelative(name, value) {
  const urls = name === "srcset" || name === "imagesrcset" ? srcsetUrls(value) : name === "ping" ? value.split(/\s+/) : [value];
  return urls.some((url) => /^[\\/]{2}/.test(url.replace(/[\t\n\r]/g, "").replace(/^[\u0000-\u0020]+/, "")));
}

function decodeJsEscapes(text) {
  return text.replace(/\\(u\{[0-9a-fA-F]+\}|u[0-9a-fA-F]{4}|x[0-9a-fA-F]{2}|[\s\S])/g, (whole, body) => {
    if (body[0] === "u" && body[1] === "{") return String.fromCodePoint(parseInt(body.slice(2, -1), 16));
    if (body[0] === "u" && body.length === 5) return String.fromCharCode(parseInt(body.slice(1), 16));
    if (body[0] === "x" && body.length === 3) return String.fromCharCode(parseInt(body.slice(1), 16));
    return { n: "\n", t: "\t", r: "\r" }[body] ?? body;
  });
}

/** Visible copy of the HTML: text nodes (title included) and aria-label, title, alt and placeholder values, quoted or not. */
export function visibleCopy(html) {
  const items = [];
  const markup = markupOf(html);
  for (const m of markup.matchAll(/>([^<]+)</g)) {
    const text = decodeEntities(m[1]).trim();
    if (text) items.push({ where: "text", text });
  }
  for (const [name, text] of attributesOf(markup)) {
    if (COPY_ATTRIBUTES.has(name)) items.push({ where: `${name} attribute`, text });
  }
  return items;
}

/** String and template literal texts of the named module sections in the page script, escapes decoded. */
export function moduleCopy(html, modules = COPY_MODULES) {
  const found = new Map();
  const marker = new RegExp(`^${MODULE_MARKER.replace(/[/]/g, "\\/")}(\\S+)$`, "gm");
  const starts = [...html.matchAll(marker)];
  starts.forEach((m, index) => {
    if (!modules.includes(m[1])) return;
    const from = m.index + m[0].length;
    let to = index + 1 < starts.length ? starts[index + 1].index : html.length;
    const end = html.slice(from, to).search(/^return __fleetlab_m\d+;$/m);
    if (end !== -1) to = from + end;
    const section = html.slice(from, to);
    const literals = [];
    maskSource(section, { literals });
    found.set(m[1], literals.map(([a, b]) => decodeJsEscapes(section.slice(a, b))));
  });
  return found;
}

/**
 * Checks packed HTML text. `requiredLabels` is FleetLab's label tuple, passed in by the caller.
 * Returns an array of problem strings; empty means clean.
 */
export function checkDist(html, { requiredLabels, byteLength = Buffer.byteLength(html) }) {
  if (!Array.isArray(requiredLabels) || requiredLabels.length === 0 || requiredLabels.some((s) => typeof s !== "string" || s === "")) {
    throw new TypeError("checkDist needs requiredLabels: a non-empty array of non-empty strings");
  }
  const problems = [];
  if (byteLength > MAX_BYTES) problems.push(`size: ${byteLength} bytes is over the ${MAX_BYTES} byte limit`);

  // Scanned after decoding character references, which never removes a literal scheme, so this covers the raw text too.
  const decoded = decodeEntities(html);
  for (const m of decoded.matchAll(/https?:/gi)) {
    const rest = decoded.slice(m.index, m.index + SVG_NAMESPACE.length + 1);
    const namespaceName = rest.startsWith(SVG_NAMESPACE) && !/[A-Za-z0-9._~/?#%:@-]/.test(rest[SVG_NAMESPACE.length] ?? "");
    if (namespaceName && SVG_NAMESPACE_CONTEXT.test(decoded.slice(Math.max(0, m.index - 80), m.index))) continue;
    problems.push(`external URL: ${JSON.stringify(decoded.slice(m.index, m.index + 60))}`);
  }
  // Attributes are read from markup only, so script text such as `const data = x; // note` is never taken for one.
  for (const [name, value] of attributesOf(markupOf(html))) {
    const local = name.slice(name.lastIndexOf(":") + 1);
    if (URL_ATTRIBUTES.has(local) && isProtocolRelative(local, value)) {
      problems.push(`external URL: a protocol-relative reference in ${name} ${JSON.stringify(value.slice(0, 60))}`);
    }
  }
  if (CSS_REMOTE.some((pattern) => pattern.test(decoded))) problems.push("external URL: a protocol-relative reference in CSS");

  const policies = [...html.matchAll(/<meta\b[^>]*http-equiv\s*=\s*["']?Content-Security-Policy["']?[^>]*>/gi)];
  const head = /<head\b[^>]*>/i.exec(html);
  if (policies.length === 0) problems.push("policy: no Content-Security-Policy meta element");
  else if (policies.length > 1) problems.push(`policy: ${policies.length} Content-Security-Policy meta elements, expected 1`);
  else {
    const content = /\scontent\s*=\s*"([^"]*)"/i.exec(policies[0][0]);
    if (!content || decodeEntities(content[1]) !== CONTENT_SECURITY_POLICY) {
      problems.push(`policy: content differs from the design policy: ${JSON.stringify(content ? content[1] : null)}`);
    }
    if (!head || policies[0].index !== head.index + head[0].length) {
      problems.push("policy: the Content-Security-Policy meta element is not the first child of <head>");
    }
  }

  for (const [pattern, name] of FORBIDDEN_TOKENS) {
    if (pattern.test(html)) problems.push(`forbidden token: ${name}`);
  }

  const copy = visibleCopy(html);
  const modules = moduleCopy(html);
  if (!modules.has("src/ui/labels.js")) problems.push("labels: no src/ui/labels.js module found in the page script");
  for (const [name, texts] of modules) for (const text of texts) copy.push({ where: `${name} string`, text });
  for (const { where, text } of copy) {
    const word = BANNED_WORDS.exec(text);
    if (word) problems.push(`banned word: "${word[0]}" in ${where} ${JSON.stringify(text.slice(0, 80))}`);
    if (DASHES.test(text)) problems.push(`dash: an em or en dash in ${where} ${JSON.stringify(text.slice(0, 80))}`);
  }

  requiredLabels.forEach((label, index) => {
    if (html.includes(label)) problems.push(`required label: entry ${index} of the label tuple appears in the file`);
  });
  // Quoted excerpts must never repeat a label string, so every message is redacted.
  return problems.map((problem) =>
    requiredLabels.reduce((text, label, index) => text.split(label).join(`[label tuple entry ${index}]`), problem),
  );
}

/** Reads FleetLab's label tuple from the repository's contracts module without spelling it. */
export function labelsFromContracts(repoRoot) {
  const path = join(repoRoot, "src/hermes/fleet/contracts.py");
  if (!existsSync(path)) return null;
  const block = readFileSync(path, "utf8").match(/REQUIRED_LABELS: tuple\[str, \.\.\.\] = \(([\s\S]*?)\n\)/);
  return block ? [...block[1].matchAll(/"([^"]+)"/g)].map((m) => m[1]) : null;
}

/** Command-line entry. Returns the exit status. */
export function main(argv, { env = process.env, cwd = process.cwd(), log = console.log, error = console.error } = {}) {
  let file = null;
  let labelsFile = null;
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] === "--required-labels") labelsFile = argv[++i];
    else if (file === null && !argv[i].startsWith("--")) file = argv[i];
    else {
      error(`check-dist: unexpected argument ${argv[i]}`);
      return 2;
    }
  }
  if (!file) {
    error("check-dist: usage: check-dist.mjs <file.html> [--required-labels <file.json>]");
    return 2;
  }
  let requiredLabels;
  try {
    if (labelsFile) requiredLabels = JSON.parse(readFileSync(resolve(cwd, labelsFile), "utf8"));
    else if (env.FLEETLAB_REQUIRED_LABELS) requiredLabels = JSON.parse(env.FLEETLAB_REQUIRED_LABELS);
    else {
      const root = findRepositoryRoot(dirname(fileURLToPath(import.meta.url)));
      requiredLabels = root ? labelsFromContracts(root) : null;
    }
  } catch (err) {
    error(`check-dist: cannot read the label tuple: ${err.message}`);
    return 2;
  }
  if (!Array.isArray(requiredLabels) || requiredLabels.length === 0) {
    error("check-dist: no label tuple: pass --required-labels or FLEETLAB_REQUIRED_LABELS");
    return 2;
  }
  const path = resolve(cwd, file);
  if (!existsSync(path)) {
    error(`check-dist: no such file ${path}`);
    return 2;
  }
  const bytes = readFileSync(path);
  const problems = checkDist(bytes.toString("utf8"), { requiredLabels, byteLength: bytes.length });
  if (problems.length > 0) {
    for (const problem of problems) error(`check-dist: ${problem}`);
    error(`check-dist: FAILED with ${problems.length} problem(s) in ${path}`);
    return 1;
  }
  log(`check-dist: OK ${path} (${bytes.length} bytes; policy, URLs, tokens, copy and labels checked)`);
  return 0;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  process.exitCode = main(process.argv.slice(2));
}
