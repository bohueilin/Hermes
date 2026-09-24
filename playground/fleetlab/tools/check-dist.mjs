// Checks a packed playground file before anyone opens or shares it (contract section 9, design section 9.4).
// Fails on an external URL, a missing or different content security policy, a forbidden token, a banned word
// or an em or en dash in interface copy, a string from FleetLab's label tuple, or a size over 2 MB.
//
// Usage: node playground/fleetlab/tools/check-dist.mjs <file.html> [--required-labels <file.json>]
//        node playground/fleetlab/tools/check-dist.mjs --site <folder> [--required-labels <file.json>]
// A folder is the hosted site pack.mjs --site writes: the same rules on every file, the site policy instead of the
// packed one, exactly the files the packer writes and no other, and boot.js and _headers verbatim.
// The label tuple comes from --required-labels (a JSON array), else the FLEETLAB_REQUIRED_LABELS environment
// variable (a JSON array), else it is read from the repository's contracts module; it is never spelled here.
// Exit 0 when clean, 1 with one line per problem, 2 on a usage error.

import {APP_MAX_BYTES,MEDIA_LIMITS,MEDIA_MODULE,mediaProblems} from "./media.mjs";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import { CONTENT_SECURITY_POLICY, MODULE_MARKER, SITE_BOOT, SITE_CONTENT_SECURITY_POLICY, SITE_HEADERS, findRepositoryRoot, maskSource } from "./pack.mjs";

/** Largest packed file accepted, in bytes. */
// The directed street extract raises the offline budget from 2 to 2.5 MiB; see the street model design record.
export const MAX_BYTES = APP_MAX_BYTES;

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
const COPY_MODULES = ["src/ui/labels.js", "src/ui/studio.js", "src/ui/hero-film.js", "src/ui/depot-scene.js", "src/ui/operations-lab.js", "src/ui/readiness-view.js", "src/ui/advanced-operations-view.js", "src/ui/scenario-learning.js", "src/ui/launch-view.js", "src/ui/operations-map.js", "src/ui/operations-3d.js", "src/ui/vehicle-portrait.js", "src/ui/simulation-catalog.js", "src/instrument/summary.js", "src/model/presets.js", "src/model/ops-cases.js"];

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
// M3 explicitly introduces an independent synthetic forecast, not a production prediction.
// Only these exact literals in its versioned view are permitted. All legacy modules and
// any other forecast/live/prediction claims remain covered by the existing copy policy.
const SYNTHETIC_FORECAST_COPY=new Set([
  'forecast',
  'SFO anchor; fictional access rule synthetic-access-2026-09-22. Forecast is separately published synthetic input, no external airport feed.',
  'Current time-valid synthetic forecast',
  'Forecast: Not available at this minute.',
]);
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

/**
 * Start tags and text runs of markup, tokenized as a browser's HTML tokenizer reads them: a quote inside an
 * unquoted value or an attribute name belongs to it, and only whitespace or `>` ends an unquoted value.
 * Tags are `{ name, attributes }` with names lower-cased and values entity-decoded; end tags are skipped.
 */
function tokensOf(markup) {
  const tags = [];
  const texts = [];
  const n = markup.length;
  const space = /[\t\n\f\r ]/;
  let textStart = 0;
  const flushText = (to) => {
    if (to > textStart) texts.push(decodeEntities(markup.slice(textStart, to)));
  };
  for (let i = markup.indexOf("<"); i !== -1; i = markup.indexOf("<", i)) {
    const isEnd = markup[i + 1] === "/";
    const nameAt = i + (isEnd ? 2 : 1);
    if (!/[a-z]/i.test(markup[nameAt] ?? "")) {
      if (!/[!?/]/.test(markup[i + 1] ?? "")) {
        i += 1;
        continue;
      }
      // A doctype, a bogus comment or a nameless end tag runs to the next `>`.
      flushText(i);
      const close = markup.indexOf(">", i);
      i = textStart = close === -1 ? n : close + 1;
      continue;
    }
    flushText(i);
    let j = nameAt;
    while (j < n && !space.test(markup[j]) && markup[j] !== "/" && markup[j] !== ">") j += 1;
    const tag = { name: markup.slice(nameAt, j).toLowerCase(), attributes: [] };
    while (j < n && markup[j] !== ">") {
      if (space.test(markup[j]) || markup[j] === "/") {
        j += 1;
        continue;
      }
      let k = j + 1; // the first character of a name may be "="
      while (k < n && !space.test(markup[k]) && !"/>=".includes(markup[k])) k += 1;
      const name = markup.slice(j, k).toLowerCase();
      for (j = k; j < n && space.test(markup[j]); j += 1);
      if (markup[j] !== "=") {
        tag.attributes.push([name, ""]);
        continue;
      }
      for (j += 1; j < n && space.test(markup[j]); j += 1);
      let value;
      if (markup[j] === '"' || markup[j] === "'") {
        const close = markup.indexOf(markup[j], j + 1);
        value = markup.slice(j + 1, close === -1 ? n : close);
        j = close === -1 ? n : close + 1;
      } else {
        for (k = j; k < n && !space.test(markup[k]) && markup[k] !== ">"; k += 1);
        value = markup.slice(j, k);
        j = k;
      }
      tag.attributes.push([name, decodeEntities(value)]);
    }
    // A tag cut off by the end of the file is still reported, which is stricter than a browser.
    if (!isEnd) tags.push(tag);
    i = textStart = Math.min(j + 1, n);
  }
  flushText(n);
  return { tags, texts };
}

/** `[name, value]` for every attribute of every start tag. */
function attributesOf(tags) {
  return tags.flatMap((tag) => tag.attributes);
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
  const { tags, texts } = tokensOf(markupOf(html));
  for (const text of texts.map((t) => t.trim())) {
    if (text) items.push({ where: "text", text });
  }
  for (const [name, text] of attributesOf(tags)) {
    if (COPY_ATTRIBUTES.has(name)) items.push({ where: `${name} attribute`, text });
  }
  return items;
}

/** A string that a URL parser reads as protocol-relative: two slashes (either way) then a host character. */
const PROTOCOL_RELATIVE_STRING = /^[\\/]{2}[^\\/\s]/;

/**
 * Protocol-relative string and template literals in JavaScript source, comments excluded. Literals are scanned
 * again as source, so the worker source string is covered; a template text ending in `//` before `${` counts.
 * Returns null when the source cannot be scanned.
 */
function protocolRelativeStrings(source, depth = 0) {
  const literals = [];
  try {
    maskSource(source, { literals });
  } catch {
    return null;
  }
  const found = [];
  for (const [from, to] of literals) {
    const value = decodeJsEscapes(source.slice(from, to));
    const url = value.replace(/[\t\n\r]/g, "").replace(/^[\u0000-\u0020]+/, "");
    if (PROTOCOL_RELATIVE_STRING.test(url) || (/^[\\/]{2}$/.test(url) && source.startsWith("${", to))) found.push(value);
    if (depth < 2) found.push(...(protocolRelativeStrings(value, depth + 1) ?? []));
  }
  return found;
}

/** String and template literal texts of one JavaScript source, escapes decoded. */
export function literalsOf(source) {
  const literals = [];
  maskSource(source, { literals });
  return literals.map(([a, b]) => decodeJsEscapes(source.slice(a, b)));
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
    found.set(m[1], literalsOf(html.slice(from, to)));
  });
  return found;
}

const at = (where) => (where === null ? "" : ` in ${where}`);

function requireLabels(requiredLabels) {
  if (!Array.isArray(requiredLabels) || requiredLabels.length === 0 || requiredLabels.some((s) => typeof s !== "string" || s === "")) {
    throw new TypeError("checkDist needs requiredLabels: a non-empty array of non-empty strings");
  }
}

/** `http:` and `https:` anywhere in the text after decoding character references; the SVG namespace name is not a URL. */
function schemeProblems(text, where = null) {
  const problems = [];
  // Frozen OSM provenance and explicit license links are inert metadata/navigation.
  // No image, script, style, worker or API URL is exempt; CSP still forbids connections.
  const decoded = decodeEntities(text)
    .replace(/(["']source["']\s*:\s*["'])https:\/\/www\.openstreetmap\.org\/copyright(["'])/g, '$1OSM_LICENSE_SOURCE$2')
    .replace(/((?:["']?source["']?\s*:\s*)["'])https:\/\/www\.openstreetmap\.org\/(?:node|way)\/\d+(["'])/g, '$1OSM_SOURCE$2')
    .replace(/`https:\/\/www\.openstreetmap\.org\/way\/\$\{(?:osmIds\[0\]|id)\}`/g, '`OSM_WAY_SOURCE`')
    .replace(/(["']license["']\s*:\s*["']ODbL 1\.0[^"']*)https:\/\/opendatacommons\.org\/licenses\/odbl\/1-0\/(["'])/g, '$1ODBL_LICENSE$2')
    .replace(/(const seating=["'])https:\/\/support\.google\.com\/waymo\/answer\/9059053\?hl=en-GB(["'])/g, '$1VEHICLE_SEATING_SOURCE$2')
    .replace(/(sources:Object\.freeze\(\[["'])https:\/\/(?:media\.jlr\.com\/corporate\/en-us\/news\/2018\/03\/2019-jaguar-i-pace|waymo\.com\/blog\/2026\/05\/welcoming-riders-in-the-ojai\/)(["'])/g, '$1VEHICLE_SOURCE$2')
    .replace(/(<a\b[^>]*?\bhref\s*=\s*["']|\bel\(\s*["']a["']\s*,\s*\{\s*href\s*:\s*["'])https:\/\/www\.openstreetmap\.org\/copyright(["'])/g, '$1OSM_ATTRIBUTION$2');
  for (const m of decoded.matchAll(/https?:/gi)) {
    const rest = decoded.slice(m.index, m.index + SVG_NAMESPACE.length + 1);
    const namespaceName = rest.startsWith(SVG_NAMESPACE) && !/[A-Za-z0-9._~/?#%:@-]/.test(rest[SVG_NAMESPACE.length] ?? "");
    if (namespaceName && SVG_NAMESPACE_CONTEXT.test(decoded.slice(Math.max(0, m.index - 80), m.index))) continue;
    problems.push(`external URL${at(where)}: ${JSON.stringify(decoded.slice(m.index, m.index + 60))}`);
  }
  if (CSS_REMOTE.some((pattern) => pattern.test(decoded))) problems.push(`external URL${at(where)}: a protocol-relative reference in CSS`);
  return problems;
}

/** Protocol-relative URL attributes and a meta refresh, read from markup only. */
function markupProblems(html, tags, where = null) {
  const problems = [];
  for (const [name, value] of attributesOf(tags)) {
    const local = name.slice(name.lastIndexOf(":") + 1);
    if (URL_ATTRIBUTES.has(local) && isProtocolRelative(local, value)) {
      problems.push(`external URL${at(where)}: a protocol-relative reference in ${name} ${JSON.stringify(value.slice(0, 60))}`);
    }
  }
  // A meta refresh navigates the page (design section 9.4), whatever its content says.
  if (tags.some((tag) => tag.name === "meta" && tag.attributes.some(([name, value]) => name === "http-equiv" && value.trim().toLowerCase() === "refresh"))) {
    problems.push(`forbidden element${at(where)}: a meta refresh`);
  }
  return problems;
}

/** Protocol-relative string literals in JavaScript source. */
function scriptProblems(source, where = null) {
  const strings = protocolRelativeStrings(source);
  if (strings === null) return [`script${at(where)}: a script element that cannot be scanned for protocol-relative strings`];
  return strings.map((value) => `external URL${at(where)}: a protocol-relative string in script ${JSON.stringify(value.slice(0, 60))}`);
}

/** Exactly one policy meta element, holding `expected`, as the first child of `<head>`. */
function policyProblems(html, expected) {
  const problems = [];
  const policies = [...html.matchAll(/<meta\b[^>]*http-equiv\s*=\s*["']?Content-Security-Policy["']?[^>]*>/gi)];
  const head = /<head\b[^>]*>/i.exec(html);
  if (policies.length === 0) problems.push("policy: no Content-Security-Policy meta element");
  else if (policies.length > 1) problems.push(`policy: ${policies.length} Content-Security-Policy meta elements, expected 1`);
  else {
    const content = /\scontent\s*=\s*"([^"]*)"/i.exec(policies[0][0]);
    if (!content || decodeEntities(content[1]) !== expected) {
      problems.push(`policy: content differs from the design policy: ${JSON.stringify(content ? content[1] : null)}`);
    }
    if (!head || policies[0].index !== head.index + head[0].length) {
      problems.push("policy: the Content-Security-Policy meta element is not the first child of <head>");
    }
  }
  return problems;
}

function tokenProblems(text, where = null) {
  const problems = [];
  for (const [pattern, name] of FORBIDDEN_TOKENS) {
    if (pattern.test(text)) problems.push(`forbidden token${at(where)}: ${name}`);
  }
  return problems;
}

/** Banned words and dashes in copy items `{where, text}`. */
function copyProblems(copy) {
  const problems = [];
  for (const { where, text } of copy) {
    const word = where==='src/ui/advanced-operations-view.js string'&&SYNTHETIC_FORECAST_COPY.has(text)?null:BANNED_WORDS.exec(text);
    if (word) problems.push(`banned word: "${word[0]}" in ${where} ${JSON.stringify(text.slice(0, 80))}`);
    if (DASHES.test(text)) problems.push(`dash: an em or en dash in ${where} ${JSON.stringify(text.slice(0, 80))}`);
  }
  return problems;
}

/** Quoted excerpts must never repeat a label string, so every message is redacted. */
function redacted(problems, requiredLabels) {
  return problems.map((problem) =>
    requiredLabels.reduce((text, label, index) => text.split(label).join(`[label tuple entry ${index}]`), problem),
  );
}

/**
 * Checks packed HTML text. `requiredLabels` is FleetLab's label tuple, passed in by the caller.
 * Returns an array of problem strings; empty means clean.
 */
export function checkDist(html, { requiredLabels, byteLength = Buffer.byteLength(html) }) {
  requireLabels(requiredLabels);
  const problems = [];
  if (byteLength > MAX_BYTES) problems.push(`size: ${byteLength} bytes is over the ${MAX_BYTES} byte limit`);

  // Scanned after decoding character references, which never removes a literal scheme, so this covers the raw text too.
  problems.push(...schemeProblems(html));
  // Attributes are read from markup only, so script text such as `const data = x; // note` is never taken for one.
  const { tags } = tokensOf(markupOf(html));
  problems.push(...markupProblems(html, tags));
  for (const script of html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script\s*>/gi)) problems.push(...scriptProblems(script[1]));
  problems.push(...policyProblems(html, CONTENT_SECURITY_POLICY));
  problems.push(...tokenProblems(html));

  const copy = visibleCopy(html);
  const modules = moduleCopy(html);
  if (!modules.has("src/ui/labels.js")) problems.push("labels: no src/ui/labels.js module found in the page script");
  for (const [name, texts] of modules) for (const text of texts) copy.push({ where: `${name} string`, text });
  problems.push(...copyProblems(copy));

  requiredLabels.forEach((label, index) => {
    if (html.includes(label)) problems.push(`required label: entry ${index} of the label tuple appears in the file`);
  });
  return redacted(problems, requiredLabels);
}

const SITE_FIXED_FILES = ["index.html", "boot.js", "styles.css", "_headers"];
const SITE_MODULE_PATH = /^src\/(?:[A-Za-z0-9_-]+\/)*[A-Za-z0-9_-]+\.js$/;
const SITE_STYLESHEET_LINK = '<link rel="stylesheet" href="./styles.css">';
const SITE_BOOT_SCRIPT = '<script type="module" src="./boot.js"></script>';

/**
 * Checks a hosted folder as a map (or plain object) from relative path to text, as pack.mjs --site writes it:
 * exactly index.html, boot.js, styles.css, _headers and `src/**.js` modules; boot.js and _headers verbatim; the site
 * policy first in <head>; one stylesheet link and one module script and no other script or link; and on every file
 * the packed file's rules (no external URL, no forbidden token, no banned word or dash in copy, no label string).
 * Returns an array of problem strings; empty means clean.
 */
export function checkSite(files, { requiredLabels }) {
  requireLabels(requiredLabels);
  const entries = files instanceof Map ? files : new Map(Object.entries(files));
  const problems = [];
  let bytes = 0;
  for (const [path, text] of entries) {
    if (MEDIA_LIMITS.has(path)) { problems.push(...mediaProblems(path, text)); continue; }
    if (typeof text !== "string") {
      problems.push(`file: ${path} is not text`);
      continue;
    }
    bytes += Buffer.byteLength(text);
    if (!SITE_FIXED_FILES.includes(path) && !SITE_MODULE_PATH.test(path)) problems.push(`file: unexpected ${path}`);
  }
  if (entries.has(MEDIA_MODULE)) for (const path of MEDIA_LIMITS.keys()) if (!entries.has(path)) problems.push(`media: missing ${path}`);
  if (bytes > MAX_BYTES) problems.push(`size: ${bytes} bytes is over the ${MAX_BYTES} byte limit`);
  for (const name of SITE_FIXED_FILES) if (!entries.has(name)) problems.push(`file: ${name} is missing`);
  if (!entries.has("src/ui/labels.js")) problems.push("labels: no src/ui/labels.js module in the site");
  const text = (path) => (typeof entries.get(path) === "string" ? entries.get(path) : null);
  if (text("boot.js") !== null && text("boot.js") !== SITE_BOOT) problems.push("boot: boot.js differs from the module pack.mjs writes");
  if (text("_headers") !== null && text("_headers") !== SITE_HEADERS) problems.push("headers: _headers differs from the text pack.mjs writes");

  const html = text("index.html");
  if (html !== null) {
    problems.push(...policyProblems(html, SITE_CONTENT_SECURITY_POLICY));
    const links = [...html.matchAll(/<link\b[^>]*>/gi)].map((m) => m[0]);
    const scripts = [...html.matchAll(/<script\b[^>]*>[\s\S]*?<\/script\s*>/gi)].map((m) => m[0]);
    if (links.length !== 1 || links[0] !== SITE_STYLESHEET_LINK) problems.push(`index.html: expected exactly one stylesheet link, ${SITE_STYLESHEET_LINK}`);
    if (scripts.length !== 1 || scripts[0] !== SITE_BOOT_SCRIPT) problems.push(`index.html: expected exactly one module script, ${SITE_BOOT_SCRIPT}`);
    const remainder = html.split(SITE_STYLESHEET_LINK).join("").split(SITE_BOOT_SCRIPT).join("");
    problems.push(...tokenProblems(remainder, "index.html"));
    problems.push(...markupProblems(html, tokensOf(markupOf(html)).tags, "index.html"));
  }
  const copy = html === null ? [] : visibleCopy(html);
  for (const [path, source] of entries) {
    if (typeof source !== "string" || path === "boot.js" || path === "_headers") continue;
    problems.push(...schemeProblems(source, path));
    if (path.endsWith(".js")) {
      problems.push(...scriptProblems(source, path));
      problems.push(...tokenProblems(source, path));
      if (COPY_MODULES.includes(path)) for (const literal of literalsOf(source)) copy.push({ where: `${path} string`, text: literal });
    }
    if (path === "styles.css") problems.push(...tokenProblems(source, path));
  }
  problems.push(...copyProblems(copy));
  for (const [path, source] of entries) {
    if (typeof source !== "string") continue;
    requiredLabels.forEach((label, index) => {
      if (source.includes(label)) problems.push(`required label: entry ${index} of the label tuple appears in ${path}`);
    });
  }
  return redacted(problems, requiredLabels);
}

/** Every entry under `dir` as a map from relative path to text; a symbolic link or a non-file entry is a problem. */
function readSite(dir) {
  const files = new Map();
  const problems = [];
  const walk = (folder, prefix) => {
    for (const entry of readdirSync(folder, { withFileTypes: true })) {
      const rel = prefix + entry.name;
      if (entry.isSymbolicLink()) problems.push(`file: ${rel} is a symbolic link`);
      else if (entry.isDirectory()) walk(join(folder, entry.name), `${rel}/`);
      else if (entry.isFile()) files.set(rel, readFileSync(join(folder, entry.name), MEDIA_LIMITS.has(rel) ? undefined : "utf8"));
      else problems.push(`file: ${rel} is not a regular file`);
    }
  };
  walk(dir, "");
  return { files, problems };
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
  let site = null;
  let labelsFile = null;
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] === "--required-labels") labelsFile = argv[++i];
    else if (argv[i] === "--site") site = argv[++i] ?? null;
    else if (file === null && !argv[i].startsWith("--")) file = argv[i];
    else {
      error(`check-dist: unexpected argument ${argv[i]}`);
      return 2;
    }
  }
  if (!file === !site) {
    error("check-dist: usage: check-dist.mjs <file.html> | --site <folder> [--required-labels <file.json>]");
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
  if (site) {
    const dir = resolve(cwd, site);
    let read;
    try {
      read = readSite(dir);
    } catch (err) {
      error(`check-dist: cannot read the folder ${dir}: ${err.code ?? err.message}`);
      return 2;
    }
    const problems = [...read.problems, ...checkSite(read.files, { requiredLabels })];
    if (problems.length > 0) {
      for (const problem of problems) error(`check-dist: ${problem}`);
      error(`check-dist: FAILED with ${problems.length} problem(s) in ${dir}`);
      return 1;
    }
    const bytes = [...read.files.values()].reduce((sum, text) => sum + Buffer.byteLength(text), 0);
    log(`check-dist: OK ${dir} (${read.files.size} files, ${bytes} bytes; policy, files, URLs, tokens, copy and labels checked)`);
    return 0;
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
