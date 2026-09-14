import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, test } from "node:test";

const CSS = readFileSync(new URL("../styles.css", import.meta.url), "utf8");
const DARK_MEDIA = "@media (prefers-color-scheme: dark)";
const REDUCE_MEDIA = "@media (prefers-reduced-motion: reduce)";

/** Splits text on a separator that is outside parentheses. */
function splitTopLevel(text, separator) {
  const parts = [];
  let depth = 0;
  let start = 0;
  for (let i = 0; i < text.length; i++) {
    if (text[i] === "(") depth++;
    else if (text[i] === ")") depth--;
    else if (depth === 0 && text.startsWith(separator, i)) {
      parts.push(text.slice(start, i));
      start = i + separator.length;
    }
  }
  parts.push(text.slice(start));
  return parts.map((part) => part.trim()).filter(Boolean);
}

/** Parses `name: value` declarations; `important` records a trailing !important. */
function declarations(body) {
  return splitTopLevel(body, ";").map((item) => {
    const colon = item.indexOf(":");
    const raw = item.slice(colon + 1).trim();
    return { name: item.slice(0, colon).trim(), value: raw.replace(/\s*!important$/, ""), important: raw.endsWith("!important") };
  });
}

/** Flattens the stylesheet into rules, each with its enclosing at-rule preludes as `context`. */
function parseRules(text, context = []) {
  const rules = [];
  let i = 0;
  for (;;) {
    const open = text.indexOf("{", i);
    if (open === -1) return rules;
    const prelude = text.slice(i, open).trim();
    let depth = 1;
    let j = open + 1;
    for (; depth > 0; j++) {
      if (text[j] === "{") depth++;
      else if (text[j] === "}") depth--;
    }
    const body = text.slice(open + 1, j - 1);
    if (prelude.startsWith("@media")) {
      rules.push(...parseRules(body, [...context, prelude]));
    } else if (prelude.startsWith("@keyframes")) {
      rules.push({ prelude, context, declarations: parseRules(body).flatMap((frame) => frame.declarations) });
    } else {
      rules.push({ prelude, context, selectors: splitTopLevel(prelude, ","), declarations: declarations(body) });
    }
    i = j;
  }
}

const RULES = parseRules(CSS.replace(/\/\*[\s\S]*?\*\//g, ""));

/** Custom properties declared by top-level `:root` (light) and by `:root` inside the dark media block. */
function themeTokens() {
  const tokensOf = (context) =>
    Object.fromEntries(
      RULES.filter((rule) => rule.prelude === ":root" && rule.context.join() === context)
        .flatMap((rule) => rule.declarations)
        .filter((d) => d.name.startsWith("--"))
        .map((d) => [d.name, d.value]),
    );
  const light = tokensOf("");
  return { light, dark: { ...light, ...tokensOf(DARK_MEDIA) } };
}

const THEMES = themeTokens();

/** WCAG 2 relative luminance of a #RRGGBB colour. */
function luminance(hex) {
  assert.match(hex, /^#[0-9a-f]{6}$/i, `a six-digit hex colour, got ${hex}`);
  const channel = (offset) => {
    const c = parseInt(hex.slice(offset, offset + 2), 16) / 255;
    return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * channel(1) + 0.7152 * channel(3) + 0.0722 * channel(5);
}

/** WCAG contrast ratio of two #RRGGBB colours. */
function contrast(a, b) {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

/** Contrast of two tokens in one theme. */
function tokenContrast(theme, fg, bg) {
  return contrast(THEMES[theme][fg], THEMES[theme][bg]);
}

// Design section 8.1 and 8.2, value for value.
const DESIGN_TOKENS = {
  light: {
    "--ground": "#F7F8FA", "--panel": "#FFFFFF", "--panel-alt": "#EEF1F5", "--ink": "#14181F", "--muted": "#5C6673",
    "--faint": "#8A93A0", "--faint-text": "#666D77", "--rule": "#DDE2E8", "--rule-strong": "#C3CBD5",
    "--accent": "#1F5FD4", "--accent-soft": "#E8EEFB", "--pass": "#2C784C", "--pass-bg": "#E4F0E9",
    "--cond": "#935F00", "--cond-bg": "#F6EDDA", "--hold": "#C0392B", "--hold-bg": "#F8E6E3",
    "--invalid": "#5C6673", "--invalid-bg": "#E7EAEE",
    "--car-rider": "#2a78d6", "--car-empty": "#eb6834", "--car-available": "#1baf7a", "--car-depot": "#eda100",
  },
  dark: {
    "--ground": "#0F1319", "--panel": "#161B23", "--panel-alt": "#1C222C", "--ink": "#E6EAF0", "--muted": "#9BA5B4",
    "--faint": "#6E7885", "--faint-text": "#9BA5B4", "--rule": "#262D38", "--rule-strong": "#38414F",
    "--accent": "#7BA5F0", "--accent-soft": "#1A2437", "--pass": "#6FBF8E", "--pass-bg": "#16281E",
    "--cond": "#D9A441", "--cond-bg": "#2B2314", "--hold": "#E8776A", "--hold-bg": "#2E1917",
    "--invalid": "#9BA5B4", "--invalid-bg": "#1F252E",
    "--car-rider": "#3987e5", "--car-empty": "#d95926", "--car-available": "#199e70", "--car-depot": "#c98500",
  },
};

const SURFACES = ["--ground", "--panel", "--panel-alt"];

// Every text colour and each surface it may sit on. [foreground, background, where]
const TEXT_PAIRS = [
  ...["--ink", "--muted", "--faint-text"].flatMap((fg) => SURFACES.map((bg) => [fg, bg, "body text"])),
  ["--pass", "--pass-bg", "verdict chip"],
  ["--cond", "--cond-bg", "verdict chip"],
  ["--hold", "--hold-bg", "verdict chip"],
  ["--invalid", "--invalid-bg", "verdict chip"],
  ...SURFACES.map((bg) => ["--hold", bg, "unserved riders word in yards, tables and ledgers"]),
  ["--ink", "--panel-alt", "UNCHANGED and NO_RECOMMENDATION chip"],
  ["--panel", "--ink", "THIS REPLAY chip and tooltip"],
  ["--panel", "--accent", "primary button"],
  ["--ink", "--accent-soft", "selected segment"],
];

// Ratios printed in design section 8.1 and 8.2, to two decimals. [theme, foreground, background, ratio]
const DOCUMENTED = [
  ["light", "--ink", "--panel", 17.79], ["dark", "--ink", "--panel", 14.31],
  ["light", "--muted", "--panel", 5.83], ["dark", "--muted", "--panel", 6.94],
  ["light", "--faint", "--panel", 3.11], ["dark", "--faint", "--panel", 3.86],
  ["light", "--faint-text", "--panel", 5.23], ["light", "--faint-text", "--ground", 4.92],
  ["light", "--faint-text", "--panel-alt", 4.61],
  ["dark", "--faint-text", "--panel", 6.94], ["dark", "--faint-text", "--ground", 7.48],
  ["dark", "--faint-text", "--panel-alt", 6.42],
  ["light", "--pass", "--pass-bg", 4.6], ["dark", "--pass", "--pass-bg", 7.02],
  ["light", "--cond", "--cond-bg", 4.65], ["dark", "--cond", "--cond-bg", 6.9],
  ["light", "--hold", "--hold-bg", 4.51], ["dark", "--hold", "--hold-bg", 5.74],
  ["light", "--invalid", "--invalid-bg", 4.83], ["dark", "--invalid", "--invalid-bg", 6.19],
  ["light", "--car-rider", "--panel", 4.42], ["dark", "--car-rider", "--panel", 4.75],
  ["light", "--car-empty", "--panel", 3.2], ["dark", "--car-empty", "--panel", 4.45],
  ["light", "--car-available", "--panel", 2.82], ["dark", "--car-available", "--panel", 5.07],
  ["light", "--car-depot", "--panel", 2.17], ["dark", "--car-depot", "--panel", 5.63],
];

describe("design tokens in styles.css", () => {
  test("light and dark token values equal design 8.1 and 8.2", () => {
    for (const theme of ["light", "dark"]) {
      for (const [name, value] of Object.entries(DESIGN_TOKENS[theme])) {
        assert.equal(THEMES[theme][name]?.toLowerCase(), value.toLowerCase(), `${theme} ${name}`);
      }
    }
  });

  test("the dark media block holds only :root token overrides", () => {
    const darkRules = RULES.filter((rule) => rule.context.includes(DARK_MEDIA));
    assert.deepEqual(darkRules.map((rule) => rule.prelude), [":root"]);
    assert.ok(darkRules[0].declarations.every((d) => d.name.startsWith("--")));
  });

  test("system font stacks and tabular numbers", () => {
    assert.equal(THEMES.light["--font-ui"], 'ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif');
    assert.equal(THEMES.light["--font-mono"], 'ui-monospace, "SF Mono", Menlo, Consolas, monospace');
    const mono = RULES.find((rule) => rule.selectors?.includes(".fl-mono"));
    assert.ok(mono.declarations.some((d) => d.name === "font-variant-numeric" && d.value === "tabular-nums"));
    assert.doesNotMatch(CSS, /@import|@font-face|url\(/, "no web fonts and no external resources");
  });
});

describe("contrast", () => {
  for (const theme of ["light", "dark"]) {
    test(`${theme}: every text pair is at least 4.5:1`, () => {
      for (const [fg, bg, where] of TEXT_PAIRS) {
        const ratio = tokenContrast(theme, fg, bg);
        assert.ok(ratio >= 4.5, `${theme} ${fg} on ${bg} (${where}) is ${ratio.toFixed(2)}:1`);
      }
    });

    test(`${theme}: non-text marks reach 3:1 where the design requires it`, () => {
      // --faint is for gridlines and marks on panels only (design 8.1); the focus ring sits on any surface.
      assert.ok(tokenContrast(theme, "--faint", "--panel") >= 3);
      for (const bg of SURFACES) assert.ok(tokenContrast(theme, "--accent", bg) >= 3, `focus ring on ${bg}`);
    });
  }

  test("documented ratios of design 8.1 and 8.2 match the computed ratios to two decimals", () => {
    for (const [theme, fg, bg, documented] of DOCUMENTED) {
      const computed = Math.round(tokenContrast(theme, fg, bg) * 100) / 100;
      assert.equal(computed, documented, `${theme} ${fg} on ${bg}`);
    }
  });

  test("light Available and At a depot sit under 3:1, so glyphs carry a 1 px ink edge", () => {
    assert.ok(tokenContrast("light", "--car-available", "--panel") < 3);
    assert.ok(tokenContrast("light", "--car-depot", "--panel") < 3);
    const edge = RULES.find((rule) => rule.selectors?.includes(".fl-glyph-edge"));
    assert.deepEqual(
      edge.declarations.filter((d) => d.name.startsWith("stroke")).map((d) => [d.name, d.value]),
      [["stroke", "var(--ink)"], ["stroke-width", "1px"]],
    );
  });
});

describe("focus, targets, strip and narrow layout", () => {
  test("focus is a 2 px ring with a 2 px ground-coloured offset; targets are 44 px", () => {
    const focus = RULES.find((rule) => rule.prelude === ":focus-visible");
    const get = (name) => focus.declarations.find((d) => d.name === name)?.value;
    assert.equal(get("outline"), "2px solid var(--accent)");
    assert.equal(get("outline-offset"), "2px");
    assert.equal(get("box-shadow"), "0 0 0 2px var(--ground)");
    assert.equal(THEMES.light["--target"], "44px");
    assert.ok(Number.parseInt(THEMES.light["--gutter"], 10) >= 16);
  });

  test("no rule hides the teaching-model strip", () => {
    const stripRules = RULES.filter((rule) => rule.selectors?.some((s) => /\.fl-strip(?![\w-])/.test(s)));
    assert.ok(stripRules.length > 0);
    for (const rule of stripRules) {
      for (const d of rule.declarations) {
        assert.ok(!(d.name === "display" && d.value === "none"), rule.prelude);
        assert.ok(!(d.name === "visibility" && d.value !== "visible"), rule.prelude);
        assert.ok(!(d.name === "opacity" && d.value !== "1"), rule.prelude);
      }
    }
    const base = stripRules.find((rule) => rule.context.length === 0);
    assert.ok(base.declarations.some((d) => d.name === "display" && d.value === "block" && d.important));
  });

  test("widths of 200 px or more appear only at 768 px and wider", () => {
    const widthLike = /^(min-)?(width|inline-size)$|^flex-basis$|^grid-template-columns$/;
    for (const rule of RULES) {
      const minWidth = Math.max(0, ...rule.context.map((c) => Number(c.match(/min-width:\s*(\d+)px/)?.[1] ?? 0)));
      for (const d of rule.declarations.filter((decl) => widthLike.test(decl.name))) {
        const widest = Math.max(0, ...[...d.value.matchAll(/(\d+(?:\.\d+)?)px/g)].map((m) => Number(m[1])));
        assert.ok(widest < 200 || minWidth >= 768, `${rule.prelude} ${d.name}: ${d.value}`);
      }
    }
  });

  test("the stylesheet carries no readable copy and no dash characters", () => {
    assert.ok(RULES.every((rule) => rule.declarations.every((d) => d.name !== "content")));
    assert.doesNotMatch(CSS, /[\u2013\u2014]/);
  });
});

describe("motion", () => {
  const isReduced = (rule) =>
    rule.context.includes(REDUCE_MEDIA) || rule.selectors?.some((s) => s.startsWith(':root[data-motion="reduce"]'));
  const motionDecls = RULES.flatMap((rule) =>
    rule.declarations.filter((d) => /^(transition|animation)/.test(d.name) || d.name === "will-change").map((d) => ({ rule, d })),
  );

  test("durations and easing tokens stay in the design 8.4 ranges", () => {
    assert.equal(THEMES.light["--ease-out"], "cubic-bezier(0.23, 1, 0.32, 1)");
    const ms = (name) => Number(THEMES.light[name].match(/^(\d+)ms$/)[1]);
    assert.ok(ms("--dur-press") >= 100 && ms("--dur-press") <= 160);
    assert.ok(ms("--dur-tooltip") >= 125 && ms("--dur-tooltip") <= 200);
    assert.ok(ms("--dur-drawer") >= 200 && ms("--dur-drawer") <= 300);
  });

  test("transitions animate only transform or opacity, with the ease-out curve and a duration token", () => {
    assert.ok(motionDecls.length > 0);
    for (const { rule, d } of motionDecls) {
      const where = `${rule.prelude} ${d.name}: ${d.value}`;
      assert.doesNotMatch(d.value, /infinite/, where);
      if (d.value === "none") continue;
      assert.equal(d.name, "transition", `only the transition shorthand animates: ${where}`);
      for (const item of splitTopLevel(d.value, ",")) {
        const [property, duration, easing, ...rest] = item.split(/\s+(?![^(]*\))/);
        assert.ok(["transform", "opacity"].includes(property), where);
        assert.match(duration, /^var\(--dur-(press|tooltip|drawer)\)$/, where);
        assert.equal(easing, "var(--ease-out)", where);
        assert.deepEqual(rest, [], where);
      }
    }
  });

  test("keyframes, if any, change only transform or opacity", () => {
    for (const rule of RULES.filter((r) => r.prelude.startsWith("@keyframes"))) {
      for (const d of rule.declarations) assert.ok(["transform", "opacity"].includes(d.name), rule.prelude);
    }
  });

  test("reduced motion is written per element for the system setting and for the in-app setting", () => {
    const reduceBlock = RULES.filter((rule) => rule.context.includes(REDUCE_MEDIA));
    assert.ok(reduceBlock.length > 0, "a prefers-reduced-motion block exists");
    assert.ok(reduceBlock.every((rule) => rule.selectors.every((s) => !s.includes("*"))), "no global kill switch");

    const stopsTransition = (selector) =>
      RULES.some((rule) => rule.selectors?.includes(selector) && rule.declarations.some((d) => d.name === "transition" && d.value === "none"));
    const animated = motionDecls.filter(({ rule, d }) => !isReduced(rule) && d.value !== "none");
    for (const { rule } of animated) {
      for (const selector of rule.selectors) {
        assert.ok(stopsTransition(`:root:not([data-motion="full"]) ${selector}`), `system reduced motion for ${selector}`);
        assert.ok(stopsTransition(`:root[data-motion="reduce"] ${selector}`), `in-app reduced motion for ${selector}`);
        const system = reduceBlock.find((r) => r.selectors.includes(`:root:not([data-motion="full"]) ${selector}`));
        assert.ok(system, `${selector} override sits inside the prefers-reduced-motion block`);
      }
    }
  });
});

/** A minimal document for the shell: elements with attributes, children, text and click listeners. */
class FakeElement {
  constructor(tag) {
    this.tagName = tag.toUpperCase();
    this.attributes = new Map();
    this.children = [];
    this.parentNode = null;
    this.textContent = "";
    this.hidden = false;
    this.listeners = {};
  }
  setAttribute(name, value) { this.attributes.set(name, String(value)); }
  getAttribute(name) { return this.attributes.has(name) ? this.attributes.get(name) : null; }
  hasAttribute(name) { return this.attributes.has(name); }
  get firstChild() { return this.children[0] ?? null; }
  appendChild(child) {
    if (child.parentNode) child.parentNode.children = child.parentNode.children.filter((c) => c !== child);
    child.parentNode = this;
    this.children.push(child);
    return child;
  }
  removeChild(child) { this.children = this.children.filter((c) => c !== child); child.parentNode = null; return child; }
  replaceChildren(...nodes) { for (const c of this.children) c.parentNode = null; this.children = []; for (const n of nodes) this.appendChild(n); }
  addEventListener(type, fn) { (this.listeners[type] ??= []).push(fn); }
  click() { for (const fn of this.listeners.click ?? []) fn({ type: "click" }); }
  *walk() { yield this; for (const c of this.children) yield* c.walk(); }
}

/** Builds the development shell's body from index.html's two ids, then runs `start` against it. */
async function startShell() {
  const root = new FakeElement("div");
  root.setAttribute("id", "fleetlab-root");
  const strip = new FakeElement("div");
  strip.setAttribute("id", "fleetlab-teaching-strip");
  root.appendChild(strip);
  const doc = {
    createElement: (tag) => new FakeElement(tag),
    getElementById: (id) => [...root.walk()].find((node) => node.getAttribute("id") === id) ?? null,
  };
  const previous = globalThis.document;
  globalThis.document = doc;
  try {
    const { start } = await import("../src/ui/app.js");
    return { root, strip, shell: start({ createWorker: () => null }) };
  } finally {
    if (previous === undefined) delete globalThis.document;
    else globalThis.document = previous;
  }
}

const classesOf = (node) => (node.getAttribute("class") ?? "").split(/\s+/).filter(Boolean);

describe("interface checks that arrive with the interface modules", () => {
  test("every control has an accessible name from labels.js", { todo: "needs src/ui/labels.js and the controls" });

  test("shell regions follow design 7.7 order: strip, top bar, knobs, map, transport, NOW, charts, footer", async () => {
    const { root } = await startShell();
    assert.equal(root.getAttribute("class"), "fl-app");
    const order = root.children.map((node) => classesOf(node)[0]);
    assert.deepEqual(order, ["fl-strip", "fl-topbar", "fl-knobs", "fl-map", "fl-transport", "fl-segmented", "fl-side", "fl-charts", "fl-drawer", "fl-footer"]);
    const side = root.children.find((node) => classesOf(node).includes("fl-side"));
    assert.deepEqual(side.children.map((node) => classesOf(node)[0]), ["fl-now", "fl-across"]);
    for (const node of root.walk()) {
      if (["SECTION", "ASIDE", "HEADER"].includes(node.tagName)) assert.ok(node.getAttribute("aria-label"), `${classesOf(node)[0]} has a name`);
    }
    const inspector = root.children.find((node) => classesOf(node).includes("fl-inspector"));
    assert.ok(inspector.hidden && inspector.hasAttribute("inert"), "the closed inspector drawer is hidden and inert");
  });

  test("modes sit after the top bar and Run window closes the knobs in tab order", { todo: "needs src/ui/controls.js" });

  test("every class the shell sets is defined in styles.css", async () => {
    const { root } = await startShell();
    const selectorText = RULES.flatMap((rule) => rule.selectors ?? []).join(" ");
    for (const node of root.walk()) {
      for (const name of classesOf(node)) {
        assert.match(selectorText, new RegExp(`\\.${name}(?![\\w-])`), `styles.css defines .${name}`);
      }
    }
  });

  test("the teaching strip keeps its sentence and its phone popover toggles open and closed", async () => {
    const { strip } = await startShell();
    assert.equal(strip.getAttribute("role"), "note");
    const [full, toggle, popover] = strip.children;
    assert.deepEqual([full, toggle, popover].map((n) => classesOf(n)[0]), ["fl-strip__full", "fl-strip__short", "fl-popover"]);
    assert.ok(full.textContent.length > 0 && popover.textContent.length > 0);
    assert.ok(popover.hidden);
    toggle.click();
    assert.equal(popover.hidden, false);
    assert.equal(popover.getAttribute("data-open"), "true");
    assert.equal(toggle.getAttribute("aria-expanded"), "true");
    toggle.click();
    assert.equal(popover.hidden, true);
    assert.equal(toggle.getAttribute("aria-expanded"), "false");
  });

  test("the phone segmented control shows one group at a time through data-phone-group", async () => {
    const { root } = await startShell();
    assert.equal(root.getAttribute("data-phone-group"), "now");
    const segmented = root.children.find((node) => classesOf(node).includes("fl-segmented"));
    const [, charts, across] = segmented.children;
    charts.click();
    assert.equal(root.getAttribute("data-phone-group"), "charts");
    assert.deepEqual(segmented.children.map((b) => b.getAttribute("aria-pressed")), ["false", "true", "false"]);
    across.click();
    assert.equal(root.getAttribute("data-phone-group"), "across");
    // styles.css hides by group in the phone media block; "now" is the default, reached through :not() on the others.
    const phoneRules = RULES.filter((rule) => rule.context.some((c) => c.includes("max-width: 767.98px"))).flatMap((rule) => rule.selectors);
    const groups = new Set(phoneRules.flatMap((s) => [...s.matchAll(/data-phone-group="(\w+)"/g)].map((m) => m[1])));
    assert.deepEqual([...groups].sort(), ["across", "charts"]);
    for (const group of ["charts", "across"]) {
      assert.ok(phoneRules.some((s) => s.includes(`:not([data-phone-group="${group}"])`)), `${group} is hidden unless selected`);
    }
    assert.ok(phoneRules.some((s) => s.includes('[data-phone-group="across"] .fl-now')), "the NOW panel hides when another group shows");
  });

  test("the development shell nests the strip inside the root, so the grid holds the strip area", () => {
    const html = readFileSync(new URL("../index.html", import.meta.url), "utf8");
    assert.match(html, /<div id="fleetlab-root" class="fl-app"[^>]*>\s*<div id="fleetlab-teaching-strip" class="fl-strip"><\/div>\s*<\/div>/);
  });

  test("polite announcement region speaks on pause, on step, and at most once per simulated hour during play", {
    todo: "needs src/ui/a11y.js",
  });

  test("reduced-motion reducer: the in-app setting wins over the system setting", async () => {
    const { createInitialState, isReducedMotion, reduce } = await import("../src/ui/store.js");
    let state = createInitialState({ presetId: "p", scenario: { window: { start_s: 0, end_s: 3600 } }, reducedMotionSystem: true });
    assert.equal(isReducedMotion(state), true);
    state = reduce(state, { type: "motion/override", value: false });
    assert.equal(isReducedMotion(state), false, "override off beats system on");
    state = reduce(state, { type: "motion/system", reduced: false });
    state = reduce(state, { type: "motion/override", value: true });
    assert.equal(isReducedMotion(state), true, "override on beats system off");
  });

  test("no horizontal page scroll at 400 px", { todo: "browser smoke, local only (design 9.5)" });
});
