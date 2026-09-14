import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { describe, test } from "node:test";

import { installFakeDom } from "./helpers/fake-dom.mjs";
import { presetScenario, windowPayload } from "./helpers/model-payloads.mjs";
import { DEFAULT_PRESET_ID } from "../src/model/presets.js";
import {
  bindShortcuts,
  createAnnouncer,
  createLiveRegion,
  createShortcutHelp,
  roving,
  syncSheetInert,
  tabbables,
  watchReducedMotion,
} from "../src/ui/a11y.js";
import { REGION_IDS, start } from "../src/ui/app.js";
import { mountControls } from "../src/ui/controls.js";
import { clock } from "../src/ui/format.js";
import { mountInspector } from "../src/ui/inspector.js";
import * as uiLabels from "../src/ui/labels.js";
import { createInitialState, createStore } from "../src/ui/store.js";

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

  test("every control rule applies the 44 px target as min-height and min-width", () => {
    const controls = [".fl-button", ".fl-segmented button", ".fl-knobs-toggle", ".fl-strip__short", "input", "select", "summary"];
    for (const selector of controls) {
      const rules = RULES.filter((rule) => rule.selectors?.includes(selector));
      for (const name of ["min-height", "min-width"]) {
        const applies = rules.some((rule) => rule.context.length === 0 && rule.declarations.some((d) => d.name === name && d.value === "var(--target)"));
        assert.ok(applies, `${selector} has ${name}: var(--target) outside any media block`);
        for (const rule of rules) {
          for (const d of rule.declarations.filter((decl) => decl.name === name)) assert.equal(d.value, "var(--target)", `${rule.prelude} ${name}`);
        }
      }
    }
  });

  test("a disclosure summary keeps its marker and centres its text in the 44 px target", () => {
    const rules = RULES.filter((rule) => rule.selectors?.some((s) => /(^|[\s>+~,])summary(?![\w-])/.test(s)));
    const base = rules.filter((rule) => rule.context.length === 0 && rule.selectors.includes("summary"));
    const all = rules.flatMap((rule) => rule.declarations);
    // A flex or grid summary loses its disclosure triangle in Chromium and WebKit, and ::marker cannot bring it back.
    for (const d of all.filter((decl) => decl.name === "display")) assert.equal(d.value, "list-item", `summary display ${d.value}`);
    assert.ok(base.some((rule) => rule.declarations.some((d) => d.name === "display" && d.value === "list-item")));
    assert.ok(!all.some((d) => d.name === "list-style" || d.name === "list-style-type"), "the marker is not removed");
    const padding = base.flatMap((rule) => rule.declarations).filter((d) => d.name === "padding-block").map((d) => d.value);
    assert.ok(padding.includes("calc((var(--target) - 1lh) / 2)"), `padding-block centres one line: ${padding.join(" | ")}`);
    // The fallback for a browser without the lh unit still reaches 44 px for a 14 px line at line-height 1.45.
    const fallback = Number.parseFloat(padding[0]);
    assert.ok(2 * fallback + 14 * 1.45 >= Number.parseFloat(THEMES.light["--target"]), `fallback padding ${padding[0]}`);
  });

  test("every summary the interface builds is a tappable control under the 44 px rule", () => {
    const dir = new URL("../src/ui/", import.meta.url);
    const builders = readdirSync(dir).filter((file) => file.endsWith(".js") && /el\("summary"/.test(readFileSync(new URL(file, dir), "utf8")));
    // The Model limits chip and the six Experiment setup blocks (design §5.8, §7.6).
    assert.ok(builders.includes("charts.js") && builders.includes("experiment.js"), builders.join(","));
    // The target rule names the summary element itself, so no class a builder puts on a summary can escape it.
    const target = RULES.find((rule) => rule.context.length === 0 && rule.selectors?.includes(".fl-button") && rule.declarations.some((d) => d.name === "min-height"));
    assert.ok(target.selectors.includes("summary"), target.prelude);
    for (const rule of RULES.filter((r) => r.selectors?.some((s) => /summary(?![\w-])/.test(s)))) {
      for (const d of rule.declarations.filter((decl) => ["min-height", "min-width", "height", "max-height"].includes(decl.name))) {
        assert.equal(d.value, "var(--target)", `${rule.prelude} ${d.name}: ${d.value}`);
      }
    }
  });

  test("the teaching-model strip stacks above every overlay, and fixed overlays start below it (design H-1)", () => {
    const zIndex = (rules) => rules.flatMap((rule) => rule.declarations).filter((d) => d.name === "z-index").map((d) => Number(d.value));
    const stripRules = RULES.filter((rule) => rule.selectors?.includes(".fl-strip"));
    const [stripZ] = zIndex(stripRules);
    assert.ok(Number.isInteger(stripZ), "the strip declares a z-index");
    const fixed = new Set(
      RULES.filter((rule) => rule.declarations.some((d) => d.name === "position" && d.value === "fixed")).flatMap((rule) => rule.selectors),
    );
    assert.ok(fixed.size > 0);
    const names = (selector) => [...fixed].filter((f) => new RegExp(`${f.replace(/[.[\]()*+?^$|\\]/g, "\\$&")}(?![\\w-])`).test(selector));
    const overlayRules = RULES.filter((rule) => rule.selectors?.some((s) => names(s).length > 0));
    for (const z of zIndex(overlayRules)) assert.ok(z < stripZ, `a fixed overlay at z-index ${z} is under the strip at ${stripZ}`);
    for (const z of zIndex(RULES.filter((rule) => !stripRules.includes(rule)))) assert.ok(z < stripZ, `z-index ${z} is under the strip`);

    const top = (d) => (d.name === "top" || d.name === "inset-block-start" ? d.value : ["inset", "inset-block"].includes(d.name) ? d.value.split(/\s+(?![^(]*\))/)[0] : null);
    for (const selector of fixed) {
      const rules = overlayRules.filter((rule) => rule.selectors.some((s) => names(s).includes(selector)));
      assert.ok(
        rules.some((rule) => rule.context.length === 0 && rule.selectors.includes(selector) && rule.declarations.some((d) => top(d) === "var(--strip-block)")),
        `${selector} starts at var(--strip-block) on a phone`,
      );
      for (const rule of rules) {
        for (const d of rule.declarations.filter((decl) => top(decl) !== null)) {
          assert.equal(top(d), "var(--strip-block)", `${rule.context.join(" ") || "base"} ${rule.prelude} ${d.name}: ${d.value}`);
        }
      }
    }
    // The phone strip is one block-level target tall; the token must cover it and its padding and rule.
    const decl = (name) => stripRules.flatMap((rule) => rule.declarations).find((d) => d.name === name)?.value;
    const padding = decl("padding-block").split(/\s+/).map(Number.parseFloat);
    const stripHeight = Number.parseFloat(THEMES.light["--target"]) + padding[0] + (padding[1] ?? padding[0]) + Number.parseFloat(decl("border-bottom"));
    const short = RULES.find((rule) => rule.context.length === 0 && rule.selectors?.includes(".fl-strip__short") && rule.declarations.some((d) => d.name === "display"));
    assert.equal(short?.declarations.find((d) => d.name === "display").value, "block", "the phone strip button is a block, so no line box adds height");
    assert.ok(Number.parseFloat(THEMES.light["--strip-block"]) >= stripHeight, `--strip-block ${THEMES.light["--strip-block"]} covers the ${stripHeight} px phone strip`);
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
    // rem and em at the 16 px default; ch at 1em, an upper bound for any Latin font.
    const pxPer = { px: 1, rem: 16, em: 16, ch: 16 };
    const widestOf = (value) => Math.max(0, ...[...value.matchAll(/(\d*\.?\d+)(px|rem|em|ch)\b/g)].map((m) => Number(m[1]) * pxPer[m[2]]));
    assert.deepEqual(["30rem", "12.5em", "25ch", "199px"].map(widestOf), [480, 200, 400, 199]);
    for (const rule of RULES) {
      const minWidth = Math.max(0, ...rule.context.map((c) => Number(c.match(/min-width:\s*(\d+)px/)?.[1] ?? 0)));
      for (const d of rule.declarations.filter((decl) => widthLike.test(decl.name))) {
        const widest = widestOf(d.value);
        assert.ok(widest < 200 || minWidth >= 768, `${rule.prelude} ${d.name}: ${d.value}`);
      }
    }
  });

  test("sentence-length chips wrap at 400 px; only short register and verdict chips keep one line", async () => {
    const { MODEL_LIMITS } = await import("../src/ui/labels.js");
    // At 12 px monospace (about 7.2 px a character) the longest model-limits chip is wider than a 400 px screen.
    assert.ok(Math.max(...Object.values(MODEL_LIMITS).map((s) => s.length)) * 7.2 > 400 - 32);
    const sentenceChips = [".fl-limits-chip", ".fl-teaching-chip"];
    for (const chip of sentenceChips) {
      const rules = RULES.filter((rule) => rule.selectors?.some((s) => new RegExp(`\\${chip}(?![\\w-])`).test(s)));
      for (const rule of rules) {
        for (const d of rule.declarations.filter((decl) => decl.name === "white-space")) {
          assert.ok(!["nowrap", "pre"].includes(d.value), `${rule.prelude} white-space: ${d.value} would keep ${chip} on one line`);
        }
      }
      const own = rules.filter((rule) => rule.context.length === 0 && rule.selectors.includes(chip)).flatMap((rule) => rule.declarations);
      for (const [name, value] of [["white-space", "normal"], ["overflow-wrap", "anywhere"], ["max-width", "100%"]]) {
        assert.ok(own.some((d) => d.name === name && d.value === value), `${chip} sets ${name}: ${value}, so no parent's nowrap is inherited`);
      }
    }
    const oneLine = new Set([".fl-chip-replay", ".fl-chip-across", ".fl-verdict-chip", ".fl-sr-only"]);
    for (const rule of RULES.filter((r) => r.declarations.some((d) => d.name === "white-space" && d.value === "nowrap"))) {
      assert.ok(rule.selectors.every((s) => oneLine.has(s)), `white-space: nowrap only on short chips, not ${rule.prelude}`);
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

/**
 * Builds the development shell's body from index.html's two ids, then builds the shell against it with `buildShell`, the
 * part of `start` that lays out the regions (`start` then mounts the interface, which this minimal document cannot
 * hold; test/app.test.mjs runs the whole of `start` on the full fake DOM).
 */
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
    const { buildShell } = await import("../src/ui/app.js");
    return { root, strip, shell: buildShell() };
  } finally {
    if (previous === undefined) delete globalThis.document;
    else globalThis.document = previous;
  }
}

const classesOf = (node) => (node.getAttribute("class") ?? "").split(/\s+/).filter(Boolean);

describe("interface checks that arrive with the interface modules", () => {
  test("every control has an accessible name from labels.js", async () => {
    const { doc, root, store, cleanup } = mountedShell();
    try {
      store.dispatch({ type: "run/queued", id: "w", total: 2 });
      store.dispatch({ type: "run/done", id: "w", payload: await windowPayload() });
      store.dispatch({ type: "inspector/open", target: { depot: "SJ-1" } });
      const controls = root.querySelectorAll("button, input, select");
      assert.ok(controls.length > 200);
      const names = new Set(
        controls.map((node) => {
          const id = node.getAttribute("id");
          const byLabel = id ? doc.querySelector(`label[for="${id}"]`) : null;
          const name = node.getAttribute("aria-label") ?? byLabel?.textContent ?? node.textContent;
          assert.ok(name.trim().length > 0, `a ${node.localName} without a name`);
          assert.doesNotMatch(name, /[\u2013\u2014]/);
          return name;
        }),
      );
      const expected = [
        uiLabels.HONESTY.stripPhoneHint,
        uiLabels.KNOB_PANEL.runWindow,
        uiLabels.KNOB_PANEL.closeKnobs,
        uiLabels.INSPECTOR.close,
        ...Object.values(uiLabels.KNOB_PANEL.groups),
        ...Object.values(uiLabels.CHARTS.phoneSegments),
      ];
      for (const name of expected) assert.ok(names.has(name), name);
    } finally {
      cleanup();
    }
  });

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

  test("single-column grid areas follow the DOM and tab order of src/ui/app.js", async () => {
    const { root } = await startShell();
    const areaOf = (name) => RULES.filter((rule) => rule.selectors?.includes(`.${name}`)).flatMap((rule) => rule.declarations).find((d) => d.name === "grid-area")?.value;
    const domAreas = root.children.map((node) => areaOf(classesOf(node)[0])).filter(Boolean);
    assert.ok(domAreas.includes("transport") && domAreas.includes("side"));
    const layouts = RULES.filter((rule) => rule.selectors?.includes(".fl-app")).flatMap((rule) =>
      rule.declarations
        .filter((d) => d.name === "grid-template-areas")
        .map((d) => ({ where: rule.context.join(" ") || "base", rows: [...d.value.matchAll(/"([^"]*)"/g)].map((m) => m[1].trim().split(/\s+/)) })),
    );
    const singleColumn = layouts.filter(({ rows }) => rows.every((row) => row.length === 1));
    assert.ok(singleColumn.length >= 2, "the phone and tablet layouts are single-column");
    for (const { where, rows } of singleColumn) {
      const positions = rows.map(([name]) => domAreas.indexOf(name));
      assert.ok(positions.every((i) => i !== -1), `${where}: every area names a shell region`);
      assert.deepEqual(positions, [...positions].sort((a, b) => a - b), `${where}: ${rows.join(", ")} follows ${domAreas.join(", ")}`);
    }
  });

  test("Run window closes the knobs in tab order, and tab stops follow the design 7.7 region order", () => {
    const { root, shell, cleanup } = mountedShell();
    try {
      const regionOf = (node) => REGION_IDS.findIndex((id) => shell.regions[id].contains(node));
      const order = tabbables(root);
      const positions = order.map(regionOf);
      assert.equal(positions[0], -1, "the teaching strip's phone button comes first");
      assert.deepEqual(positions, [...positions].sort((a, b) => a - b), "tab stops never go back to an earlier region");
      const knobs = order.filter((node) => regionOf(node) === REGION_IDS.indexOf("knobs"));
      assert.ok(knobs.length > 5);
      assert.equal(knobs.at(-1).textContent, uiLabels.KNOB_PANEL.runWindow);
      assert.ok(!order.some((node) => shell.regions.inspector.contains(node)), "the closed inspector holds no tab stop");
    } finally {
      cleanup();
    }
  });

  test("modes sit after the top bar and Run window closes the knobs in tab order", () => {
    const { root, shell, cleanup } = mountedShell();
    try {
      const order = tabbables(root);
      const topbar = order.filter((node) => shell.regions.topbar.contains(node));
      assert.deepEqual(
        topbar.slice(0, 3).map((node) => node.textContent),
        [uiLabels.MODES.learn.name, uiLabels.MODES.sandbox.name, uiLabels.MODES.experiment.name],
        "the three modes are the top bar's first tab stops",
      );
      assert.ok(topbar.slice(0, 3).every((node) => node.parentNode.getAttribute("role") === "group"));
      assert.equal(order.indexOf(topbar[0]), 1, "the modes follow the teaching strip's phone button");
      const run = order.findIndex((node) => node.textContent === uiLabels.KNOB_PANEL.runWindow && shell.regions.knobs.contains(node));
      assert.ok(order.slice(0, run).some((node) => shell.regions.knobs.contains(node)));
      assert.ok(shell.regions.map.contains(order[run + 1]), "the map follows Run window");
    } finally {
      cleanup();
    }
  });

  test("the NOW panel is a named tab stop between the transport and the charts (design 7.7, G3)", () => {
    const { root, shell, cleanup } = mountedShell();
    try {
      const order = tabbables(root);
      const now = shell.regions.now;
      assert.ok(order.includes(now), "the NOW panel itself takes focus");
      assert.equal(now.getAttribute("aria-label"), uiLabels.REGISTERS.nowThisReplay);
      const at = order.indexOf(now);
      assert.ok(shell.regions.transport.contains(order[at - 1]) || shell.regions.segmented.contains(order[at - 1]), "it follows the transport");
      const regionOf = (node) => REGION_IDS.findIndex((id) => shell.regions[id].contains(node));
      assert.ok(order.slice(at + 1).every((node) => regionOf(node) >= REGION_IDS.indexOf("now")), "nothing after it goes back to an earlier region");
    } finally {
      cleanup();
    }
  });

  test("the desktop knob column never animates its transform (G11: no band after a narrow page is widened)", () => {
    const desktop = RULES.filter((rule) => rule.context.includes("@media (min-width: 1280px)") && rule.selectors?.includes(".fl-knobs"));
    const decls = desktop.flatMap((rule) => rule.declarations);
    assert.ok(decls.some((d) => d.name === "transform" && d.value === "none"));
    assert.ok(decls.some((d) => d.name === "transition" && d.value === "none"), "the sheet's slide from the phone layout must not run inside the column");
  });

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

  test("polite announcement region speaks on pause, on step, and at most once per simulated hour during play", () => {
    const uninstall = installFakeDom();
    try {
      const live = createLiveRegion(document.body);
      assert.equal(live.node.getAttribute("aria-live"), "polite");
      assert.equal(live.node.getAttribute("class"), "fl-sr-only");
      const spoken = [];
      const store = createStore(createInitialState({ presetId: DEFAULT_PRESET_ID, scenario: presetScenario() }));
      const speak = { announce: (text) => { spoken.push(text); live.announce(text); } };
      store.subscribe(createAnnouncer(speak, (state) => clock(state.clock_s)));
      store.dispatch({ type: "playback/play" });
      // 36 frames of 5 simulated minutes from D1 05:00 reach D1 08:00; the hour changes three times.
      for (let i = 0; i < 36; i += 1) store.dispatch({ type: "clock/advance", seconds: 300 });
      assert.deepEqual(spoken, ["D1 06:00", "D1 07:00", "D1 08:00"]);
      store.dispatch({ type: "playback/pause" });
      store.dispatch({ type: "clock/set", clock_s: 30000 }); // a scrub to D1 08:20 is not announced
      store.dispatch({ type: "clock/step", unit: "5min", direction: 1 });
      store.dispatch({ type: "clock/jump", target: "pm_peak" });
      assert.deepEqual(spoken.slice(3), ["D1 08:00", "D1 08:25", "D1 16:00"]);
      assert.equal(live.node.textContent, "D1 16:00");
    } finally {
      uninstall();
    }
  });

  test("with reduced motion, the playback steps are spoken and a plain scrub is not (design §7.7)", async () => {
    const { createPlayback } = await import("../src/ui/playback.js");
    const uninstall = installFakeDom();
    try {
      for (const reducedMotion of [{ system: true, override: null }, { system: false, override: true }]) {
        const spoken = [];
        const store = createStore(createInitialState({ presetId: DEFAULT_PRESET_ID, scenario: presetScenario(), reducedMotionSystem: reducedMotion.system }));
        if (reducedMotion.override !== null) store.dispatch({ type: "motion/override", value: reducedMotion.override });
        const scheduler = { request: () => 1, cancel: () => {} };
        const playback = createPlayback({ store, scheduler });
        store.subscribe(createAnnouncer({ announce: (text) => spoken.push(text) }, (state) => clock(state.clock_s)));
        const start = store.getState().clock_s;
        playback.step("5min", 1);
        assert.equal(store.getState().clock_s, start + 300, "the step moved the clock");
        playback.step("1h", 1);
        playback.step("1h", -1);
        playback.step("5min", -1);
        assert.deepEqual(spoken, [clock(start + 300), clock(start + 3900), clock(start + 300), clock(start)], JSON.stringify(reducedMotion));
        store.dispatch({ type: "clock/set", clock_s: start + 1200 }); // a scrub
        assert.equal(spoken.length, 4, "a plain clock/set scrub is not announced");
      }
    } finally {
      uninstall();
    }
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

/** The shell on a fake DOM at desktop width with the knob panel and the inspector mounted on the default preset. */
function mountedShell() {
  const uninstall = installFakeDom(globalThis, { media: { "(min-width: 1280px)": true, "(min-width: 768px)": true } });
  const doc = uninstall.dom.document;
  const root = doc.createElement("div");
  root.setAttribute("id", "fleetlab-root");
  const strip = doc.createElement("div");
  strip.setAttribute("id", "fleetlab-teaching-strip");
  root.appendChild(strip);
  doc.body.appendChild(root);
  const shell = start({ createWorker: () => null });
  const store = createStore(createInitialState({ presetId: DEFAULT_PRESET_ID, scenario: presetScenario() }));
  const controls = mountControls({ store, region: shell.regions.knobs });
  const inspector = mountInspector({ store, region: shell.regions.inspector });
  const cleanup = () => {
    controls.destroy();
    inspector.destroy();
    // start() schedules idle work (the G8 table build); destroying it before the fake DOM goes keeps that work from
    // running against a removed document after the test.
    shell.destroy();
    uninstall();
  };
  return { doc, root, shell, store, cleanup };
}

describe("a11y.js helpers", () => {
  test("shortcuts apply only inside their region and never while typing; ? lists them and returns focus", () => {
    const uninstall = installFakeDom();
    try {
      const section = () => document.body.appendChild(document.createElement("section"));
      const map = section();
      const other = section();
      const inMap = map.appendChild(document.createElement("button"));
      const field = map.appendChild(document.createElement("input"));
      const outside = other.appendChild(document.createElement("button"));
      const calls = [];
      const help = createShortcutHelp(document.body);
      bindShortcuts(map, { " ": () => calls.push("play"), "Shift+,": () => calls.push("back an hour"), "]": () => calls.push("faster") }, help);
      const key = (target, init) => target.dispatchEvent(new KeyboardEvent("keydown", { bubbles: true, cancelable: true, ...init }));
      key(outside, { key: " " });
      key(field, { key: " " });
      key(inMap, { key: " " });
      key(inMap, { key: "<", shiftKey: true });
      key(inMap, { key: "]" });
      assert.deepEqual(calls, ["play", "back an hour", "faster"]);

      inMap.focus();
      assert.equal(help.node.hidden, true);
      key(inMap, { key: "?", shiftKey: true });
      assert.equal(help.node.hidden, false);
      assert.equal(help.node.hasAttribute("inert"), false);
      assert.deepEqual(help.node.querySelectorAll("li").map((li) => li.textContent), uiLabels.PLAYBACK.shortcutList);
      assert.equal(document.activeElement.textContent, uiLabels.A11Y.closeShortcuts);
      key(document.activeElement, { key: "Escape" });
      assert.equal(help.node.hidden, true);
      assert.equal(help.node.hasAttribute("inert"), true);
      assert.equal(document.activeElement, inMap);
    } finally {
      uninstall();
    }
  });

  test("roving tabindex keeps one tab stop and wraps around", () => {
    const uninstall = installFakeDom();
    try {
      const items = [0, 1, 2].map(() => document.body.appendChild(document.createElement("button")));
      assert.equal(roving(items, 0), 0);
      assert.deepEqual(items.map((b) => b.getAttribute("tabindex")), ["0", "-1", "-1"]);
      assert.equal(roving(items, -1, { focus: true }), 2);
      assert.deepEqual(items.map((b) => b.getAttribute("tabindex")), ["-1", "-1", "0"]);
      assert.equal(document.activeElement, items[2]);
    } finally {
      uninstall();
    }
  });

  test("reduced motion: the system setting reaches the store and the in-app override sets data-motion", () => {
    const query = "(prefers-reduced-motion: reduce)";
    const uninstall = installFakeDom(globalThis, { media: { [query]: true } });
    try {
      const root = document.createElement("div"); // stands in for :root
      const store = createStore(createInitialState({ presetId: DEFAULT_PRESET_ID, scenario: presetScenario() }));
      const stop = watchReducedMotion(store, root);
      assert.equal(store.getState().reducedMotion.system, true);
      assert.equal(root.hasAttribute("data-motion"), false, "without an override the CSS media query applies");
      store.dispatch({ type: "motion/override", value: false });
      assert.equal(root.getAttribute("data-motion"), "full");
      store.dispatch({ type: "motion/override", value: true });
      assert.equal(root.getAttribute("data-motion"), "reduce");
      store.dispatch({ type: "motion/override", value: null });
      assert.equal(root.hasAttribute("data-motion"), false);
      uninstall.dom.media.set(query, false);
      assert.equal(store.getState().reducedMotion.system, false);
      stop();
    } finally {
      uninstall();
    }
  });

  test("a sheet is inert only while it is off screen in the phone or tablet layout", () => {
    const uninstall = installFakeDom();
    try {
      const sheet = document.createElement("aside");
      const inert = (layout, open) => {
        syncSheetInert(sheet, layout, open);
        return sheet.hasAttribute("inert");
      };
      assert.deepEqual([inert("phone", false), inert("phone", true), inert("tablet", false), inert("tablet", true), inert("desktop", false)], [true, false, true, false, false]);
    } finally {
      uninstall();
    }
  });

  test("every class the knob panel and the inspector set is defined in styles.css", async () => {
    const { root, store, cleanup } = mountedShell();
    try {
      store.dispatch({ type: "run/queued", id: "w", total: 2 });
      store.dispatch({ type: "run/done", id: "w", payload: await windowPayload() });
      const selectorText = RULES.flatMap((rule) => rule.selectors ?? []).join(" ");
      for (const target of [{ depot: "SJ-1" }, { car: "SF-017" }]) {
        store.dispatch({ type: "inspector/open", target });
        for (const node of root.querySelectorAll("[class]")) {
          for (const name of classesOf(node)) assert.match(selectorText, new RegExp(`\\.${name}(?![\\w-])`), `styles.css defines .${name}`);
        }
      }
    } finally {
      cleanup();
    }
  });
});
