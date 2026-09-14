// Interface entry: builds the teaching-model strip (design H-1) and the empty region containers of design
// section 7.2, with the class names styles.css defines. Later modules render one region each from the store.

import { el } from "./dom.js";
import * as labels from "./labels.js";

/** Shell regions in document order, which is the design section 7.7 tab order; `now` and `across` sit in `side`. */
export const REGION_IDS = Object.freeze([
  "topbar",
  "knobs",
  "map",
  "transport",
  "segmented",
  "now",
  "across",
  "charts",
  "inspector",
  "footer",
]);

/** Phone groups of the segmented control (design section 7.2), as `data-phone-group` values on `.fl-app`. */
export const PHONE_GROUPS = Object.freeze(["now", "charts", "across"]);

const PHONE_GROUP_LABEL_PATHS = { now: "CHARTS.phoneSegments.now", charts: "CHARTS.phoneSegments.charts", across: "CHARTS.phoneSegments.all" };

/** Reads a required string from labels.js by dotted path, with a clear error when it is missing. */
function label(path) {
  let value = labels;
  for (const key of path.split(".")) value = value == null ? undefined : value[key];
  if (typeof value !== "string" || value === "") {
    throw new Error(`src/ui/labels.js must provide a non-empty string at ${path}`);
  }
  return value;
}

/** Fills the strip: the full sentence, and a phone button that opens the popover. It has no dismiss control. */
function buildTeachingStrip(strip) {
  strip.setAttribute("role", "note");
  strip.setAttribute("aria-label", label("HONESTY.stripPhone"));
  const full = el("p", { class: "fl-strip__full" }, label("HONESTY.strip"));
  const popover = el("p", { id: "fleetlab-teaching-popover", class: "fl-popover", "data-open": "false" }, label("HONESTY.popover"));
  popover.hidden = true;
  const toggle = el(
    "button",
    {
      type: "button",
      class: "fl-strip__short",
      "aria-expanded": "false",
      "aria-controls": "fleetlab-teaching-popover",
      "aria-label": label("HONESTY.stripPhoneHint"),
      on: {
        click: () => {
          const open = popover.hidden;
          popover.hidden = !open;
          popover.setAttribute("data-open", open ? "true" : "false");
          toggle.setAttribute("aria-expanded", open ? "true" : "false");
        },
      },
    },
    label("HONESTY.stripPhone"),
  );
  strip.replaceChildren(full, toggle, popover);
}

/** Builds the phone segmented control; each button shows one group by setting `data-phone-group` on the root. */
function buildSegmented(root) {
  const buttons = PHONE_GROUPS.map((group) =>
    el(
      "button",
      {
        type: "button",
        "data-group": group,
        "aria-pressed": group === root.getAttribute("data-phone-group") ? "true" : "false",
        on: { click: () => showPhoneGroup(root, buttons, group) },
      },
      label(PHONE_GROUP_LABEL_PATHS[group]),
    ),
  );
  return el("div", { id: "fleetlab-region-segmented", class: "fl-segmented", role: "group" }, buttons);
}

function showPhoneGroup(root, buttons, group) {
  root.setAttribute("data-phone-group", group);
  for (const button of buttons) {
    button.setAttribute("aria-pressed", button.getAttribute("data-group") === group ? "true" : "false");
  }
}

function region(tag, id, className, labelPath) {
  return el(tag, { id: `fleetlab-region-${id}`, class: className, "aria-label": labelPath ? label(labelPath) : null });
}

/**
 * Starts the interface. `createWorker` is the engine worker factory (contract section 9). The page document must
 * hold `#fleetlab-root` with `#fleetlab-teaching-strip` inside it. Returns `{root, strip, regions, createWorker}`.
 */
export function start({ createWorker } = {}) {
  if (typeof createWorker !== "function") throw new TypeError("start needs a createWorker factory");
  const doc = globalThis.document;
  const root = doc.getElementById("fleetlab-root");
  const strip = doc.getElementById("fleetlab-teaching-strip");
  if (!root || !strip || strip.parentNode !== root) {
    throw new Error('start needs an element with id "fleetlab-teaching-strip" inside one with id "fleetlab-root"');
  }
  root.setAttribute("class", "fl-app");
  strip.setAttribute("class", "fl-strip");
  if (!PHONE_GROUPS.includes(root.getAttribute("data-phone-group"))) root.setAttribute("data-phone-group", "now");
  buildTeachingStrip(strip);

  const regions = {
    topbar: region("header", "topbar", "fl-topbar", "TOP_BAR.product"),
    knobs: region("aside", "knobs", "fl-knobs", "KNOB_PANEL.heading"),
    map: region("section", "map", "fl-map", "MAP.name"),
    transport: region("section", "transport", "fl-transport", "PLAYBACK.transportName"),
    segmented: buildSegmented(root),
    now: region("section", "now", "fl-now", "REGISTERS.nowThisReplay"),
    across: region("section", "across", "fl-across", "CHARTS.phoneSegments.all"),
    charts: region("section", "charts", "fl-charts", "CHARTS.phoneSegments.charts"),
    inspector: region("aside", "inspector", "fl-drawer fl-inspector", "MODES.inspect.name"),
    footer: region("footer", "footer", "fl-footer"),
  };
  regions.inspector.hidden = true;
  regions.inspector.setAttribute("inert", "");
  regions.inspector.setAttribute("data-open", "false");
  const side = el("div", { class: "fl-side" }, [regions.now, regions.across]);

  root.replaceChildren(
    strip,
    regions.topbar,
    regions.knobs,
    regions.map,
    regions.transport,
    regions.segmented,
    side,
    regions.charts,
    regions.inspector,
    regions.footer,
  );
  return { root, strip, regions, createWorker };
}
