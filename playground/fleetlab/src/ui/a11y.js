// Accessibility helpers (design §7.7): the polite live region and its throttle, keyboard shortcuts scoped to the focused
// region with the "?" list, focus return, roving tabindex, tab order, reduced motion, and inert sheets by layout.

import { el } from "./dom.js";
import { A11Y, PLAYBACK } from "./labels.js";

/** Media queries for the design §7.2 breakpoints and the system reduced-motion setting. */
export const QUERIES = Object.freeze({
  desktop: "(min-width: 1280px)",
  tablet: "(min-width: 768px)",
  reducedMotion: "(prefers-reduced-motion: reduce)",
});

/** A visually hidden polite live region appended to `parent`; `announce(text)` replaces what it says. */
export function createLiveRegion(parent) {
  const node = el("div", { class: "fl-sr-only", role: "status", "aria-live": "polite", "aria-atomic": "true" });
  parent.appendChild(node);
  return { node, announce: (text) => { node.textContent = text; } };
}

/**
 * The announcement throttle of design §7.7, as a store listener `(state, action)`: it speaks `describe(state)` on pause,
 * on a step or jump, and during play at most once per simulated hour. Returns true when it spoke.
 */
export function createAnnouncer(live, describe) {
  let lastHour = null;
  return (state, action) => {
    const hour = Math.floor(state.clock_s / 3600);
    const started = state.playing && (action.type === "playback/play" || action.type === "playback/toggle");
    if (started) lastHour = hour;
    const paused = !state.playing && ["playback/pause", "playback/toggle", "clock/advance"].includes(action.type);
    // A reduced-motion step moves the clock with clock/set tagged reason "step"; an untagged clock/set is a scrub.
    const stepped = action.type === "clock/step" || action.type === "clock/jump" || (action.type === "clock/set" && action.reason === "step");
    const hourly = state.playing && action.type === "clock/advance" && hour !== lastHour;
    if (!paused && !stepped && !hourly) return false;
    lastHour = hour;
    live.announce(describe(state));
    return true;
  };
}

const EDITABLE = new Set(["input", "select", "textarea"]);
const SHIFTED = { "<": ",", ">": "." };

/** A keydown's shortcut id: the key (" ", "[", "ArrowLeft"), or "Shift+," and "Shift+." for shifted comma and period. */
export function shortcutId(event) {
  if (event.key in SHIFTED) return `Shift+${SHIFTED[event.key]}`;
  if (event.shiftKey && (event.key === "," || event.key === ".")) return `Shift+${event.key}`;
  return event.key;
}

/**
 * Binds `bindings` ({shortcut id: handler(event)}) to keydown inside `region` only, so shortcuts never apply globally
 * (design §7.7). Keys typed into a field are left alone; "?" toggles `help` when one is given. Returns an unbind function.
 */
export function bindShortcuts(region, bindings, help = null) {
  const onKey = (event) => {
    if (event.ctrlKey || event.metaKey || event.altKey || EDITABLE.has(event.target.localName)) return;
    const id = shortcutId(event);
    const handler = id === "?" && help !== null ? () => help.toggle() : bindings[id];
    if (handler === undefined) return;
    event.preventDefault();
    handler(event);
  };
  region.addEventListener("keydown", onKey);
  return () => region.removeEventListener("keydown", onKey);
}

/** Remembers the focused element; the returned function moves focus back to it while it is still on the page. */
export function rememberFocus(doc = globalThis.document) {
  const previous = doc.activeElement;
  return () => {
    if (previous && previous !== doc.body && previous.isConnected) previous.focus();
  };
}

/** The "?" shortcut list as a popover in `parent`. Opening focuses its close button; closing or Escape returns focus. */
export function createShortcutHelp(parent) {
  let restore = null;
  const close = el("button", { type: "button", class: "fl-button", on: { click: () => hide() } }, A11Y.closeShortcuts);
  const node = el("div", { class: "fl-popover", role: "dialog", "aria-label": PLAYBACK.shortcuts }, [
    el("h2", { class: "fl-title" }, PLAYBACK.shortcuts),
    el("ul", {}, PLAYBACK.shortcutList.map((line) => el("li", {}, line))),
    el("p", { class: "fl-muted" }, PLAYBACK.shortcutsScope),
    close,
  ]);
  const setOpen = (open) => {
    node.hidden = !open;
    node.toggleAttribute("inert", !open);
    node.setAttribute("data-open", String(open));
  };
  const show = () => {
    restore = rememberFocus();
    setOpen(true);
    close.focus();
  };
  const hide = () => {
    if (node.hidden) return;
    setOpen(false);
    restore?.();
    restore = null;
  };
  node.addEventListener("keydown", (event) => {
    if (event.key !== "Escape") return;
    event.preventDefault();
    hide();
  });
  setOpen(false);
  parent.appendChild(node);
  return { node, toggle: () => (node.hidden ? show() : hide()), close: hide };
}

/** Roving tabindex: item `index` (wrapped around) gets tabindex 0 and the others -1; focuses it when asked. Returns the index. */
export function roving(items, index, { focus = false } = {}) {
  if (items.length === 0) return -1;
  const active = ((index % items.length) + items.length) % items.length;
  items.forEach((item, i) => item.setAttribute("tabindex", i === active ? "0" : "-1"));
  if (focus) items[active].focus();
  return active;
}

/** True when `node` or an ancestor carries the hidden or inert attribute. */
function hiddenOrInert(node) {
  for (let n = node; n !== null && typeof n.hasAttribute === "function"; n = n.parentNode) {
    if (n.hasAttribute("hidden") || n.hasAttribute("inert")) return true;
  }
  return false;
}

/** Elements Tab reaches inside `root` in document order, leaving out tabindex -1, disabled, hidden and inert ones (not CSS). */
export function tabbables(root) {
  return [...root.querySelectorAll("button, input, select, textarea, a[href], [tabindex]")].filter(
    (node) => node.tabIndex >= 0 && !node.disabled && !hiddenOrInert(node),
  );
}

/** The in-app motion attribute for the root: "reduce" or "full" when the override is set, null to follow the system. */
export function motionAttribute(state) {
  const override = state.reducedMotion.override;
  return override === null ? null : override ? "reduce" : "full";
}

/** Feeds the system reduced-motion setting to the store and mirrors the in-app override as `data-motion` on `root`. Returns stop. */
export function watchReducedMotion(store, root = globalThis.document.documentElement) {
  const media = globalThis.matchMedia(QUERIES.reducedMotion);
  const onMedia = (event) => store.dispatch({ type: "motion/system", reduced: event.matches });
  const apply = (state) => {
    const value = motionAttribute(state);
    if (value === null) root.removeAttribute("data-motion");
    else root.setAttribute("data-motion", value);
  };
  media.addEventListener("change", onMedia);
  store.dispatch({ type: "motion/system", reduced: media.matches });
  apply(store.getState());
  const unsubscribe = store.subscribe(apply);
  return () => {
    media.removeEventListener("change", onMedia);
    unsubscribe();
  };
}

/** The design §7.2 layout of the viewport: "desktop", "tablet" or "phone". */
export function currentLayout() {
  if (globalThis.matchMedia(QUERIES.desktop).matches) return "desktop";
  return globalThis.matchMedia(QUERIES.tablet).matches ? "tablet" : "phone";
}

/** Calls `onChange(layout)` whenever a breakpoint query changes; returns stop. */
export function watchLayout(onChange) {
  const lists = [QUERIES.desktop, QUERIES.tablet].map((query) => globalThis.matchMedia(query));
  const handler = () => onChange(currentLayout());
  for (const list of lists) list.addEventListener("change", handler);
  return () => {
    for (const list of lists) list.removeEventListener("change", handler);
  };
}

/** A sheet or drawer is inert only while it is off screen: closed in the phone or tablet layout (design §7.7). */
export function syncSheetInert(sheet, layout, open) {
  sheet.toggleAttribute("inert", layout !== "desktop" && !open);
}
