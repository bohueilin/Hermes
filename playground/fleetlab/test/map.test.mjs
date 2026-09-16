// The schematic map on the fake DOM with a real run_window payload (design §7.3, §8.2, §8.3, §7.7).

import assert from "node:assert/strict";
import { after, before, describe, test } from "node:test";

import { installFakeDom } from "./helpers/fake-dom.mjs";
import { presetScenario, referencePayload, referenceScenario, windowPayload } from "./helpers/model-payloads.mjs";
import * as format from "../src/ui/format.js";
import * as labels from "../src/ui/labels.js";
import {
  AREA_ORDER,
  CARS_PER_BLOCK,
  EDGE_FAMILIES,
  FAMILY_CLASS,
  FAMILY_ORDER,
  FLOOR_UNITS_PER_CAR,
  GEOMETRIES,
  PHONE_QUERY,
  VIEW,
  bandedDirections,
  chevronCount,
  chevronLevel,
  createMap,
  familyKey,
  familyOf,
  frameModel,
  frameModelCounts,
  mapModel,
  mountMap,
  placeCar,
  placeShields,
  routeGeometry,
  unitBlocks,
  yardRects,
} from "../src/ui/map.js";
import { createPlayback, frameAt } from "../src/ui/playback.js";
import { createInitialState, createStore } from "../src/ui/store.js";

let payload;
let scenario;
let uninstall;

before(async () => {
  payload = await windowPayload();
  scenario = presetScenario();
  uninstall = installFakeDom();
});

after(() => uninstall());

/** A map in the document, updated at `clock_s` with the real log (or none). */
function drawn({ clock_s = 66600, withLog = true, pinnedCar = null, interpolate = true, handlers = {} } = {}) {
  const map = createMap(handlers);
  document.body.appendChild(map.element);
  const log = withLog ? payload.log : null;
  const input = { scenario, log, frame: withLog ? frameAt(log, clock_s, { interpolate }) : null, clock_s, pinnedCar, seed: withLog ? payload.log.seed : null };
  const model = map.update(input);
  return { map, model, input, redraw: (changes) => map.update({ ...input, ...changes }) };
}

const textOf = (node) => node.textContent;
const cellText = (row, selector) => row.querySelector(selector).textContent;
/** Every heading and value one table twin shows, as one string, so two twins can be compared cell by cell. */
const tableText = (table) =>
  [
    table.querySelector("caption").textContent,
    ...table.querySelectorAll("tr").map((row) => row.querySelectorAll("th").concat(row.querySelectorAll("td")).map(textOf).join(" · ")),
  ].join(" | ");

/** The interval segment a car is on at second `t`, found directly in the log. */
function segmentAt(log, carId, t) {
  const iv = log.intervals[carId].find((i) => i.t0 <= t && t < i.t1 && Array.isArray(i.segments));
  return iv?.segments.find((s) => s.t0 <= t && t < s.t1) ?? null;
}

/** The most cars a route direction ever holds at one snapshot of a run: `Map("H1|SF>PEN" -> peak)`. */
function peakConcurrency(log) {
  const peak = new Map();
  for (const snap of log.snapshots) {
    const counts = new Map();
    for (const car of snap.cars) {
      const place = placeCar(log, car, snap.t);
      if (place.kind !== "route") continue;
      const key = `${place.route}|${place.dir}`;
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
    for (const [key, cars] of counts) if (cars > (peak.get(key) ?? 0)) peak.set(key, cars);
  }
  return peak;
}

/** The transform a car glyph must carry: its point along the route's visible segment, and its direction's heading. */
function carTransform(route, dir, fraction, geometry = GEOMETRIES.wide) {
  const { pA, pB, ux, uy } = routeGeometry(route, geometry);
  const forward = dir === `${route.a}>${route.b}`;
  const f = forward ? fraction : 1 - fraction;
  const angle = (Math.atan2(forward ? uy : -uy, forward ? ux : -ux) * 180) / Math.PI;
  const round = (n) => Math.round(n * 10) / 10;
  return `translate(${String(round(pA.x + (pB.x - pA.x) * f))} ${String(round(pA.y + (pB.y - pA.y) * f))}) rotate(${String(round(angle))})`;
}

/** Every car of a frame with where the map places it, as `{car, place}`. */
function placements(log, frame) {
  return frame.cars.map((car) => ({ car, place: placeCar(log, car, frame.at_s) }));
}

describe("static structure of the default preset", () => {
  test("four yards, twelve routes (six highways with casing and centre rule) and four depot tiles", () => {
    const { map } = drawn();
    assert.equal(map.svg.querySelectorAll(".fl-yard").length, 4);
    assert.deepEqual(map.svg.querySelectorAll("[data-area]").map((g) => g.getAttribute("data-area")), ["SF", "PEN", "SJ", "EB"]);
    const routes = map.svg.querySelectorAll("g[data-route]");
    assert.equal(routes.length, 12);
    assert.equal(map.svg.querySelectorAll(".fl-route-highway__casing").length, 6);
    assert.equal(map.svg.querySelectorAll(".fl-route-highway__centre").length, 6);
    assert.equal(map.svg.querySelectorAll(".fl-route-local").length, 6);
    const tiles = map.svg.querySelectorAll(".fl-depot-tile");
    assert.equal(tiles.length, 4);
    assert.deepEqual(map.svg.querySelectorAll("g[data-depot]").map((g) => g.getAttribute("data-depot")), ["SF-1", "SF-2", "SJ-1", "EB-1"]);
    assert.equal(map.svg.querySelector('[data-area="PEN"] g[data-depot]'), null, "Peninsula has no depot, only its yard");
  });

  test("route shields carry the fictional id and free-flow minutes, as in design §1.3", () => {
    const { map } = drawn();
    // Shields live in their own layer, painted after the yards (review: the Peninsula yard covered the H of H4).
    const shield = (id) => map.svg.querySelector(`[data-layer="shields"] [data-role="shield"][data-route-id="${id}"] text`).textContent;
    assert.equal(shield("H2"), "H2 · 55 min");
    // Design §2.9 highway minutes.
    const minutes = { H1: 25, H2: 55, H3: 20, H4: 30, H5: 40, H6: 50 };
    for (const [id, m] of Object.entries(minutes)) assert.equal(shield(id), labels.routeShield({ routeId: id, freeFlow: `${m} min` }));
    assert.equal(map.svg.querySelectorAll('[data-role="shield"]').length, 6, "only highways carry a shield");
  });

  test("a local route is labelled on focus or hover, and its label hides again", () => {
    const { map } = drawn();
    const local = map.svg.querySelector('g[data-route="L2"]');
    const label = local.querySelector('[data-role="local-label"]');
    assert.equal(label.getAttribute("visibility"), "hidden");
    assert.equal(label.textContent, "L2 · 110 min");
    local.dispatchEvent(new PointerEvent("pointerenter"));
    assert.equal(label.getAttribute("visibility"), "visible");
    local.dispatchEvent(new PointerEvent("pointerleave"));
    assert.equal(label.getAttribute("visibility"), "hidden");
    local.focus();
    assert.equal(label.getAttribute("visibility"), "visible");
  });

  test("the corner stamp, the legend and the THIS REPLAY chip with the seed", () => {
    const { map } = drawn();
    assert.equal(map.element.querySelector(".fl-map__stamp").textContent, labels.MAP.cornerStamp);
    assert.equal(map.element.querySelector('[data-role="unit-legend"]').textContent, labels.MAP.unitBarLegend);
    assert.equal(map.element.querySelector('[data-role="unit-legend"]').textContent, "1 block = 5 cars");
    const chip = map.element.querySelector(".fl-chip-replay");
    assert.equal(chip.hidden, false);
    assert.equal(chip.textContent, `THIS REPLAY · seed ${String(payload.log.seed)}`);
    assert.equal(map.element.querySelector('[data-role="nothing-run"]').hidden, true);
  });
});

describe("shields, legend and the phone geometry (review: design-fidelity lens)", () => {
  const boxOf = (b) => ({ x0: b.x0, y0: b.y0, x1: b.x1, y1: b.y1 });
  const overlaps = (a, b) => Math.min(a.x1, b.x1) - Math.max(a.x0, b.x0) > 0 && Math.min(a.y1, b.y1) - Math.max(a.y0, b.y0) > 0;

  for (const name of ["wide", "phone"]) {
    test(`${name}: every shield clears every yard, every other shield and the view box, and sits on its route`, () => {
      const geometry = GEOMETRIES[name];
      const shields = placeShields(scenario.routes, geometry);
      const highways = scenario.routes.filter((r) => r.cls === "HIGHWAY");
      assert.equal(shields.size, highways.length);
      const yards = yardRects(geometry);
      for (const route of highways) {
        const box = boxOf(shields.get(route.id));
        for (const yard of yards) assert.ok(!overlaps(box, yard), `${route.id} shield over the ${yard.id} yard`);
        for (const other of highways) if (other !== route) assert.ok(!overlaps(box, boxOf(shields.get(other.id))), `${route.id} x ${other.id}`);
        assert.ok(box.x0 >= 0 && box.y0 >= 0 && box.x1 <= geometry.view.width && box.y1 <= geometry.view.height, `${route.id} inside the view`);
        // The shield centre lies on the route's visible segment.
        const { pA, pB, ux, uy } = routeGeometry(route, geometry);
        const s = shields.get(route.id);
        const along = (s.x - pA.x) * ux + (s.y - pA.y) * uy;
        const off = Math.abs((s.x - pA.x) * -uy + (s.y - pA.y) * ux);
        assert.ok(along > 0 && along < Math.hypot(pB.x - pA.x, pB.y - pA.y) && off < 0.01, `${route.id} on its route`);
        // Wide enough for its words at the geometry's character width.
        assert.ok(s.width >= labels.routeShield({ routeId: route.id, freeFlow: format.minutes(route.free_flow_s) }).length * geometry.charPx);
      }
    });

    test(`${name}: no flow band passes under a shield`, () => {
      const geometry = GEOMETRIES[name];
      const map = createMap({ matchMedia: () => ({ matches: name === "phone" }) });
      document.body.appendChild(map.element);
      map.update({ scenario, log: payload.log, frame: frameAt(payload.log, 66600), clock_s: 66600, pinnedCar: null, seed: payload.log.seed });
      assert.equal(map.geometry(), name);
      const shields = [...placeShields(scenario.routes, geometry).values()].map(boxOf);
      let bands = 0;
      for (const line of map.svg.querySelectorAll('[data-role="flow"] line, [data-role="flow"] path')) {
        bands += 1;
        const pts = line.localName === "line"
          ? [[line.getAttribute("x1"), line.getAttribute("y1")], [line.getAttribute("x2"), line.getAttribute("y2")]].map(([x, y]) => [Number(x), Number(y)])
          : [...line.getAttribute("d").matchAll(/(-?[\d.]+) (-?[\d.]+)/g)].map((m) => [Number(m[1]), Number(m[2])]);
        const [a, b] = [pts[0], pts[pts.length > 2 ? 2 : 1]];
        for (let i = 0; i <= 20; i += 1) {
          const x = a[0] + ((b[0] - a[0]) * i) / 20;
          const y = a[1] + ((b[1] - a[1]) * i) / 20;
          for (const box of shields) assert.ok(!(x > box.x0 && x < box.x1 && y > box.y0 && y < box.y1), `${line.getAttribute("data-family")} band under a shield at ${String(x)},${String(y)}`);
        }
      }
      // A band is left only where the fallback fires: one direction of H1 on the wide map, none on the phone, where
      // the same corridor is drawn at twice the length and every car is its own mark.
      assert.equal(bands > 0, name === "wide", `${name}: ${String(bands)} bands at 18:30`);
      map.destroy();
    });
  }

  test("shields are painted after the yards and routes, hidden from assistive technology, and hovering one opens its route", () => {
    const { map } = drawn({ clock_s: 66600 });
    const layers = map.svg.children.map((n) => n.getAttribute("data-layer"));
    // Cars paint above the yards they leave and below the shields, so a mark never covers a route id (design §7.3).
    assert.deepEqual(layers, ["routes", "yards", "cars", "shields", "pinned"]);
    assert.equal(map.svg.querySelectorAll('[data-layer="routes"] [data-role="shield"]').length, 0);
    const shield = map.svg.querySelector('[data-role="shield"][data-route-id="H4"]');
    assert.equal(shield.getAttribute("aria-hidden"), "true");
    assert.equal(map.svg.querySelector('g[data-route="H4"]').getAttribute("aria-label"), shield.querySelector("text").textContent);
    shield.dispatchEvent(new PointerEvent("pointerenter"));
    const tooltip = map.element.querySelector(".fl-tooltip");
    assert.equal(tooltip.getAttribute("data-open"), "true");
    assert.equal(tooltip.getAttribute("data-route"), "H4");
    shield.dispatchEvent(new PointerEvent("pointerleave"));
    assert.equal(tooltip.getAttribute("data-open"), "false");
  });

  test("the legend names each family with a swatch in unit-bar row order, and rows and bands carry a non-hue cue", () => {
    const { map } = drawn({ clock_s: 66600 });
    const items = map.element.querySelectorAll('[data-role="family-legend"] > li');
    assert.deepEqual(items.map((li) => li.getAttribute("data-family")), [...FAMILY_ORDER]);
    items.forEach((li) => {
      const family = li.getAttribute("data-family");
      assert.equal(li.textContent, labels.MAP.families[family]);
      const swatch = li.querySelector('svg[data-role="swatch"]');
      assert.equal(swatch.getAttribute("class"), FAMILY_CLASS[family]);
      assert.equal(swatch.getAttribute("aria-hidden"), "true");
      assert.match(swatch.getAttribute("style") ?? "", /flex: none/, "a narrow legend row cannot squeeze the swatch");
      assert.ok(swatch.querySelector("polygon, circle, rect"), `${family} key glyph`);
      assert.equal(swatch.querySelectorAll(".fl-glyph-edge").length > 0, EDGE_FAMILIES.includes(family), `${family} ink edge`);
    });
    assert.equal(map.element.querySelector('[data-role="unit-legend"]').textContent, labels.MAP.unitBarLegend);
    // Shape keys: triangle, diamond, circle, square, as design §8.2 draws the families.
    assert.deepEqual(FAMILY_ORDER.map((f) => familyKey(f)[0].localName), ["polygon", "polygon", "circle", "rect"]);
    assert.notEqual(familyKey("riderWork")[0].getAttribute("points"), familyKey("emptyDrive")[0].getAttribute("points"));
    // Every yard starts its rows with the same keys, in the same order.
    for (const area of AREA_ORDER) {
      const keys = map.svg.querySelectorAll(`[data-area="${area}"] [data-role="row-keys"] > g`);
      assert.deepEqual(keys.map((k) => k.getAttribute("data-family")), [...FAMILY_ORDER]);
    }
    // Rider work is a solid band and a filled block; empty driving is hollow in both.
    for (const node of map.svg.querySelectorAll('[data-role="flow"] [data-family="riderWork"]')) {
      assert.equal(node.localName, "line");
      assert.equal(node.getAttribute("stroke-width"), "4");
    }
    // A band is drawn only where the fallback fires, so the hollow cue is asserted at D1 19:00, the clock at which
    // the one banded direction carries an empty-driving car beside its rider work.
    const hollow = drawn({ clock_s: 68400 }).map.svg.querySelectorAll('[data-role="flow"] [data-family="emptyDrive"]');
    assert.ok(hollow.length > 0, "the banded direction carries empty driving at D1 19:00");
    for (const node of hollow) {
      assert.equal(node.getAttribute("data-shape"), "hollow");
      assert.equal(node.getAttribute("fill"), "none");
    }
    for (const block of map.svg.querySelectorAll('[data-role="unit-bars"] g[data-family="emptyDrive"] rect[data-block]')) assert.equal(block.getAttribute("fill"), "none");
    for (const block of map.svg.querySelectorAll('[data-role="unit-bars"] g[data-family="riderWork"] rect[data-block]')) assert.equal(block.getAttribute("fill"), "currentColor");
  });

  test("below 768 px the map draws its phone geometry at about one unit per CSS pixel, and follows the media query", () => {
    let listener = null;
    const list = {
      matches: false,
      addEventListener: (type, fn) => { if (type === "change") listener = fn; },
      removeEventListener: (type, fn) => { if (listener === fn) listener = null; },
    };
    const queries = [];
    const map = createMap({ matchMedia: (query) => { queries.push(query); return list; } });
    document.body.appendChild(map.element);
    assert.deepEqual(queries, [PHONE_QUERY]);
    assert.equal(PHONE_QUERY, "(max-width: 767.98px)");
    map.update({ scenario, log: payload.log, frame: frameAt(payload.log, 66600), clock_s: 66600, pinnedCar: "SF-017", seed: payload.log.seed });
    assert.equal(map.svg.getAttribute("viewBox"), `0 0 ${String(VIEW.width)} ${String(VIEW.height)}`);
    list.matches = true;
    listener({ matches: true });
    assert.equal(map.geometry(), "phone");
    const phone = GEOMETRIES.phone;
    assert.equal(map.svg.getAttribute("viewBox"), `0 0 ${String(phone.view.width)} ${String(phone.view.height)}`);
    // A 400 px screen leaves 400 - 2 × 16 gutter - 2 × 12 padding - 2 border = 342 px for the map: one unit is about 1 px.
    const scale = 342 / phone.view.width;
    assert.ok(scale >= 1 && scale < 1.02);
    for (const text of map.svg.querySelectorAll("text")) assert.ok(Number(text.getAttribute("font-size")) * scale >= 11, `text ${text.textContent} at ${text.getAttribute("font-size")}`);
    // Every yard, tile and pinned glyph lies inside the phone view box; unit blocks and glyphs keep their size.
    for (const rect of map.svg.querySelectorAll(".fl-yard, .fl-depot-tile")) {
      const x = Number(rect.getAttribute("x"));
      const y = Number(rect.getAttribute("y"));
      assert.ok(x >= 0 && y >= 0 && x + Number(rect.getAttribute("width")) <= phone.view.width && y + Number(rect.getAttribute("height")) <= phone.view.height);
    }
    for (const block of map.svg.querySelectorAll('[data-role="unit-bars"] rect[data-block="full"]')) assert.ok(Number(block.getAttribute("height")) * scale >= 7);
    assert.ok(map.svg.querySelector('[data-layer="pinned"] g[data-car="SF-017"]'), "the pinned car is redrawn");
    for (const tile of map.svg.querySelectorAll("g[data-depot]")) {
      const area = tile.closest("[data-area]").getAttribute("data-area");
      const yard = yardRects(phone).find((r) => r.id === area);
      const rect = tile.querySelector(".fl-depot-tile");
      assert.ok(Number(rect.getAttribute("x")) >= yard.x0 && Number(rect.getAttribute("x")) + Number(rect.getAttribute("width")) <= yard.x1, `${tile.getAttribute("data-depot")} inside its yard`);
    }
    assert.equal(map.svg.style.maxWidth, `${String(phone.maxWidthPx)}px`);
    list.matches = false;
    listener({ matches: false });
    assert.equal(map.geometry(), "wide");
    assert.equal(map.svg.style.maxWidth, "");
    map.destroy();
    assert.equal(listener, null, "destroy stops following the query");
  });
});

describe("congestion chevrons", () => {
  test("bins at ×1.0, ×1.2, ×1.3, ×1.6 and ×2.0 with the default ×1.3 threshold", () => {
    assert.deepEqual([1000, 1200, 1300, 1600, 2000].map((m) => chevronLevel(m, 1300)), [0, 1, 2, 2, 3]);
    assert.deepEqual([1199, 1299, 1999].map((m) => chevronLevel(m, 1300)), [0, 1, 2]);
    // A threshold below ×1.2 still draws at least 2 for every congested multiplier.
    assert.deepEqual([1000, 1100, 1150, 1200].map((m) => chevronLevel(m, 1100)), [0, 2, 2, 2]);
    // A threshold at ×2.0 leaves ×1.2 to ×1.99 at level 1.
    assert.deepEqual([1600, 2000].map((m) => chevronLevel(m, 2000)), [1, 3]);
    assert.equal(chevronCount(2, 119), 4); // 2 × floor(119 / 40)
    assert.equal(chevronCount(0, 400), 0);
    assert.equal(chevronCount(3, 39), 0);
  });

  test("drawn chevrons per direction are level × whole 40 px of visible route, never a hue or a dash", () => {
    // D1 18:30 is hour 18: H2 away from SF ×1.6 (level 2), toward SF ×1.2 (level 1), contract 6.2 defaults.
    const { map } = drawn({ clock_s: 66600 });
    const h2 = scenario.routes.find((r) => r.id === "H2");
    const { length } = routeGeometry(h2);
    const g = map.svg.querySelector('g[data-route="H2"]');
    assert.equal(g.querySelectorAll('.fl-chevron[data-dir="SF>SJ"]').length, 2 * Math.floor(length / 40));
    assert.equal(g.querySelectorAll('.fl-chevron[data-dir="SJ>SF"]').length, 1 * Math.floor(length / 40));
    assert.ok(g.getAttribute("class").split(" ").includes("fl-route--congested"), "neutral casing step");
    for (const chevron of g.querySelectorAll(".fl-chevron")) {
      assert.equal(chevron.getAttribute("stroke-dasharray"), null);
      assert.equal(chevron.getAttribute("style"), null);
    }
  });

  test("chevrons are static inside an hour and change when the clock crosses it", () => {
    const { map, redraw } = drawn({ clock_s: 64800 });
    const first = map.svg.querySelector('g[data-route="H2"] .fl-chevron');
    redraw({ clock_s: 68399, frame: frameAt(payload.log, 68399) });
    assert.equal(map.svg.querySelector('g[data-route="H2"] .fl-chevron'), first, "same nodes within hour 18");
    redraw({ clock_s: 68400, frame: frameAt(payload.log, 68400) }); // hour 19: ×1.3 both ways, level 2 each
    const g = map.svg.querySelector('g[data-route="H2"]');
    const n = Math.floor(routeGeometry(scenario.routes.find((r) => r.id === "H2")).length / 40);
    assert.equal(g.querySelectorAll('.fl-chevron[data-dir="SF>SJ"]').length, 2 * n);
    assert.equal(g.querySelectorAll('.fl-chevron[data-dir="SJ>SF"]').length, 2 * n);
    redraw({ clock_s: 43200, frame: frameAt(payload.log, 43200) }); // noon: ×1.0 everywhere
    assert.equal(map.svg.querySelectorAll(".fl-chevron").length, 0);
    assert.equal(map.svg.querySelectorAll(".fl-route--congested").length, 0);
  });

  test("the route tooltip gives the planned time for a departure now in each direction", () => {
    const { map } = drawn({ clock_s: 66600 });
    map.svg.querySelector('g[data-route="H2"]').focus();
    const tooltip = map.element.querySelector(".fl-tooltip");
    assert.equal(tooltip.getAttribute("data-open"), "true");
    const away = tooltip.querySelector('[data-dir="SF>SJ"]').children.map(textOf);
    // Contract 6.3 check: H2 from 66,600 at ×1.6 then ×1.3 plans 1,800 + 2,828 = 4,628 s, shown as 77 min.
    assert.deepEqual(away, ["H2 San Francisco to San Jose", "Leaving now, D1 18:30: 77 min (55 min free-flow, slowed by your traffic profile)"]);
    map.svg.querySelector('g[data-route="H2"]').blur();
    assert.equal(tooltip.getAttribute("data-open"), "false");
  });
});

describe("yards: unit bars, waiting and unserved riders", () => {
  test("unit block arithmetic: one block per 5 cars, the rest as fifths of a block", () => {
    assert.equal(CARS_PER_BLOCK, 5);
    assert.deepEqual(unitBlocks(0), { full: 0, partialFifths: 0 });
    assert.deepEqual(unitBlocks(1), { full: 0, partialFifths: 1 });
    assert.deepEqual(unitBlocks(5), { full: 1, partialFifths: 0 });
    assert.deepEqual(unitBlocks(23), { full: 4, partialFifths: 3 });
    assert.deepEqual(unitBlocks(30), { full: 6, partialFifths: 0 });
    assert.throws(() => unitBlocks(-1), RangeError);
    assert.throws(() => unitBlocks(2.5), RangeError);
  });

  test("drawn blocks match the family counts, and only the under-3:1 families carry the ink edge", () => {
    const { map, model } = drawn({ clock_s: 66600 });
    for (const area of AREA_ORDER) {
      for (const [family, cars] of Object.entries(model.areas[area].families)) {
        const row = map.svg.querySelector(`[data-area="${area}"] [data-role="unit-bars"] g[data-family="${family}"]`);
        assert.equal(row.getAttribute("class"), FAMILY_CLASS[family]);
        const { full, partialFifths } = unitBlocks(cars);
        const blocks = row.querySelectorAll("rect[data-block]");
        assert.equal(blocks.filter((b) => b.getAttribute("data-block") === "full").length, full, `${area} ${family}`);
        assert.equal(blocks.filter((b) => b.getAttribute("data-block") !== "full").length, partialFifths > 0 ? 1 : 0);
        if (partialFifths > 0) assert.equal(blocks.at(-1).getAttribute("data-block"), `fifths-${String(partialFifths)}`);
        const edges = row.querySelectorAll("rect.fl-glyph-edge").length;
        assert.equal(edges, EDGE_FAMILIES.includes(family) ? blocks.length : 0, `${area} ${family} edges`);
      }
    }
  });

  test("an unserved rider shows as a hold-coloured cross with the count and the word, folded after 10 minutes", () => {
    const log = payload.log;
    const first = log.requests.filter((r) => r.state === "UNSERVED").sort((a, b) => a.unserved_s - b.unserved_s)[0];
    const at = Math.ceil(first.unserved_s / 300) * 300; // the next snapshot second
    const recent = (t) => log.requests.filter((r) => r.origin === first.origin && r.unserved_s !== null && r.unserved_s <= t && r.unserved_s > t - 600).length;
    const { map, redraw } = drawn({ clock_s: at, interpolate: false });
    const marker = map.svg.querySelector(`[data-area="${first.origin}"] [data-role="unserved"]`);
    // An SVG node hides only through the attribute: a browser keeps .hidden on SVG as an expando CSS never sees.
    assert.equal(marker.hasAttribute("hidden"), false);
    assert.equal(marker.getAttribute("class"), "fl-unserved");
    assert.ok(marker.querySelector("path"), "the cross");
    assert.equal(marker.querySelector("text").textContent, labels.unservedCount(recent(at)));
    assert.match(marker.querySelector("text").textContent, /^\d+ unserved$/);
    let later = at + 600;
    while (recent(later) > 0) later += 300;
    redraw({ clock_s: later, frame: frameAt(log, later, { interpolate: false }) });
    assert.equal(marker.hasAttribute("hidden"), true, "folded into the tally");
    const row = map.table.querySelector(`tr[data-area="${first.origin}"]`);
    const lastHour = log.requests.filter((r) => r.origin === first.origin && r.unserved_s !== null && r.unserved_s <= later && r.unserved_s > later - 3600).length;
    assert.equal(cellText(row, '[data-col="unserved"]'), format.count(lastHour));
  });
});

describe("the table twin", () => {
  test("equals the snapshot at a clock: depots, cars by family, flows, waiting riders and routes", () => {
    const log = payload.log;
    const snap = log.snapshots[162];
    const t = snap.t; // D1 18:30
    const { map } = drawn({ clock_s: t, interpolate: false });
    const table = map.table;

    for (const d of snap.depots) {
      const row = table.querySelector(`tr[data-depot="${d.id}"]`);
      const parking = log.depots.find((x) => x.id === d.id).parking;
      assert.equal(cellText(row, '[data-col="held"]'), `${String(d.stalls_held)}/${String(parking)}`);
      assert.equal(cellText(row, '[data-col="queue"]'), String(d.queue + d.gate));
      assert.equal(cellText(row, '[data-col="inBays"]'), String(d.clean_busy + d.service_busy));
      assert.equal(cellText(row, '[data-col="ready"]'), String(d.ready));
    }

    // Expected counts straight from the snapshot and the interval segments at second t.
    const areas = Object.fromEntries(AREA_ORDER.map((a) => [a, { riderWork: 0, emptyDrive: 0, available: 0, atDepot: 0 }]));
    const flows = {};
    for (const car of snap.cars) {
      const family = familyOf(car.state);
      if (car.leg === undefined) {
        const area = car.location.area ?? car.location.depot.split("-")[0];
        areas[area][family] += 1;
        continue;
      }
      const seg = segmentAt(log, car.id, t);
      if (seg?.kind === "ROUTE") {
        const key = `${seg.key}|${seg.dir}`;
        flows[key] ??= { riderWork: 0, emptyDrive: 0 };
        flows[key][family] += 1;
      } else if (seg?.kind === "IN_AREA") areas[seg.key.slice(3)][family] += 1;
      else if (seg?.kind === "ACCESS") areas[seg.key.split("-")[1]][family] += 1;
      else areas[(car.leg.from.area ?? car.leg.from.depot).split("-")[0]][family] += 1;
    }
    let total = 0;
    for (const area of AREA_ORDER) {
      const row = table.querySelector(`tr[data-area="${area}"]`);
      for (const family of Object.keys(areas[area])) {
        assert.equal(cellText(row, `[data-family="${family}"]`), String(areas[area][family]), `${area} ${family}`);
        total += areas[area][family];
      }
      const waiting = log.requests.filter((r) => r.origin === area && r.time_s <= t && !(r.assigned_s !== null && r.assigned_s <= t) && !(r.unserved_s !== null && r.unserved_s <= t)).length;
      assert.equal(cellText(row, '[data-col="waiting"]'), String(waiting), `${area} waiting`);
    }
    for (const row of table.querySelectorAll('tbody[data-section="routes"] tr')) {
      const expected = flows[`${row.getAttribute("data-route")}|${row.getAttribute("data-dir")}`] ?? { riderWork: 0, emptyDrive: 0 };
      assert.equal(cellText(row, '[data-family="riderWork"]'), String(expected.riderWork));
      assert.equal(cellText(row, '[data-family="emptyDrive"]'), String(expected.emptyDrive));
      total += expected.riderWork + expected.emptyDrive;
    }
    assert.equal(total, snap.cars.length, "the partition sums to the fleet");
    assert.ok(Object.keys(flows).length > 0, "some cars are on routes at 18:30");

    const h2 = table.querySelector('tr[data-route="H2"][data-dir="SF>SJ"]');
    assert.equal(cellText(h2, "th"), "H2 San Francisco to San Jose");
    assert.equal(cellText(h2, '[data-col="planned"]'), "77 min");
    assert.equal(cellText(h2, '[data-col="level"]'), labels.CHEVRON_LEVELS[2]);
    assert.equal(table.querySelectorAll('tbody[data-section="routes"] tr').length, 24, "twelve routes in two directions");
    assert.equal(table.querySelector("caption .fl-chip-replay").textContent, labels.thisReplayChip(log.seed));
  });

  test("the map model agrees with the table and uses the frame second", () => {
    const log = payload.log;
    const frame = frameAt(log, 66750, { interpolate: false });
    const model = mapModel({ scenario, log, frame, clock_s: 66750 });
    assert.equal(model.at_s, 66600);
    assert.equal(model.hour, 18);
    const inAreas = AREA_ORDER.reduce((n, a) => n + Object.values(model.areas[a].families).reduce((x, y) => x + y, 0), 0);
    const onRoutes = model.routes.reduce((n, r) => n + r.directions.reduce((x, d) => x + d.riderWork + d.emptyDrive, 0), 0);
    assert.equal(inAreas + onRoutes, frame.cars.length);
  });

  test("is visually hidden until the Table toggle is on", () => {
    const { map } = drawn();
    const wrap = map.element.querySelector('[data-role="table-twin"]');
    const toggle = map.element.querySelector('button[aria-pressed]');
    assert.equal(wrap.getAttribute("class"), "fl-sr-only");
    assert.equal(toggle.textContent, labels.CHARTS.table);
    assert.equal(toggle.getAttribute("aria-label"), labels.MAP.tableToggle);
    toggle.click();
    assert.equal(wrap.getAttribute("class"), "fl-scroll");
    assert.equal(toggle.getAttribute("aria-pressed"), "true");
    toggle.click();
    assert.equal(wrap.getAttribute("class"), "fl-sr-only");
  });

  test("before a run: the static map, the nothing-run text, and absent replay values that are never 0", () => {
    const { map } = drawn({ withLog: false, clock_s: 18000 });
    assert.equal(map.element.querySelector('[data-role="nothing-run"]').hidden, false);
    assert.equal(map.element.querySelector('[data-role="nothing-run"]').textContent, labels.STATES.nothingRun);
    assert.equal(map.element.querySelector(".fl-chip-replay").hidden, true);
    assert.equal(map.svg.querySelectorAll("g[data-route]").length, 12);
    assert.equal(map.svg.querySelectorAll('[data-role="unit-bars"] rect').length, 0);
    const absent = `not available: ${labels.ABSENT_REASONS.notRunYet}`;
    const sf = map.table.querySelector('tr[data-area="SF"]');
    assert.deepEqual(sf.querySelectorAll("td").map(textOf), Array(6).fill(absent));
    assert.deepEqual(map.table.querySelector('tr[data-depot="SJ-1"]').querySelectorAll("td").map(textOf), Array(4).fill(absent));
    const h1 = map.table.querySelector('tr[data-route="H1"][data-dir="SF>PEN"]');
    assert.equal(cellText(h1, '[data-col="planned"]'), "25 min");
    assert.equal(cellText(h1, '[data-family="riderWork"]'), absent);
  });

  test("stays current: at every clock it equals a twin drawn by a map built fresh on that frame", () => {
    // The twin is redrawn only when one of the numbers it watches has moved, and that watch list is kept by hand
    // beside drawTable. A map built fresh draws its twin unconditionally, so it is the reference the kept one is
    // held to: a number that stopped being watched would freeze here at the value its frame was built on.
    const log = payload.log;
    const start = log.snapshots[150].t;
    const { map, input } = drawn({ clock_s: start });
    const seen = new Set();
    for (let i = 1; i <= 60; i += 1) {
      const clock_s = start + i * 60;
      const frame = frameAt(log, clock_s);
      map.update({ ...input, frame, clock_s });
      const fresh = createMap();
      document.body.appendChild(fresh.element);
      fresh.update({ ...input, frame, clock_s });
      assert.equal(tableText(map.table), tableText(fresh.table), `the twin at ${format.clock(clock_s)}`);
      seen.add(tableText(map.table));
      fresh.destroy();
    }
    assert.ok(seen.size > 1, "the numbers moved across the window, so a twin that had frozen would have been caught");
  });

  test("watches one number for every number it draws, so a cell cannot be added without its watch", () => {
    const { map } = drawn({ clock_s: 66600 });
    const cells = map.table.querySelectorAll("td").length;
    const depots = map.table.querySelectorAll('tbody[data-section="depots"] tr').length;
    // One watched number per value cell, plus each lot's parking, which shares the held cell with the stalls held,
    // plus the seed in the caption. A cell drawn but not watched would keep the value its frame was built on.
    assert.equal(map.tableValues(), cells + depots + 1);
  });
});

describe("one model for one frame (design §5.9)", () => {
  test("a render computes one model, and the regions drawing that frame are handed the same one", () => {
    const log = payload.log;
    const frame = frameAt(log, 66600);
    const input = { scenario, log, frame, clock_s: 66600, pinnedCar: null, seed: log.seed };
    const map = createMap();
    document.body.appendChild(map.element);
    const before = { ...frameModelCounts };
    const drawnModel = map.update(input);
    assert.equal(frameModelCounts.computed - before.computed, 1, "one render, one model");

    // The NOW panel and the announcer draw the frame the map drew, so they are handed that model rather than walking
    // the fleet again. Position is a pure function of the frame, so the shared model is the model each would compute.
    const shared = frameModel({ scenario, log, frame, clock_s: 66600 });
    assert.equal(shared, drawnModel, "the same model object, not a copy");
    assert.equal(frameModelCounts.computed - before.computed, 1, "the second caller computed nothing");
    assert.equal(frameModelCounts.reused - before.reused, 1);
    assert.deepEqual(shared, mapModel({ scenario, log, frame, clock_s: 66600 }), "and it equals the model computed directly");

    // A different second is a different frame and is never answered with the model of the one before it.
    const next = frameAt(log, 66900);
    const later = map.update({ ...input, frame: next, clock_s: 66900 });
    assert.equal(frameModelCounts.computed - before.computed, 2);
    assert.notEqual(later.at_s, drawnModel.at_s);
    assert.deepEqual(later, mapModel({ scenario, log, frame: next, clock_s: 66900 }));
  });

  test("mounted on a store, one clock change computes one model", () => {
    const store = createStore(createInitialState({ presetId: "bay_teaching_map", scenario }));
    const playback = createPlayback({ store, scheduler: { request: () => 1, cancel: () => {} } });
    const region = document.createElement("section");
    document.body.appendChild(region);
    const map = mountMap(region, { store, playback });
    store.dispatch({ type: "run/queued", id: "r" });
    store.dispatch({ type: "run/done", id: "r", payload });
    const before = frameModelCounts.computed;
    store.dispatch({ type: "clock/set", clock_s: 66600 });
    assert.equal(frameModelCounts.computed - before, 1);
    map.destroy();
  });

  test("a destroyed map drops the frame it was drawing, so the run's log is not held after it", () => {
    const log = payload.log;
    const frame = frameAt(log, 66600);
    const map = createMap();
    document.body.appendChild(map.element);
    map.update({ scenario, log, frame, clock_s: 66600, pinnedCar: null, seed: log.seed });

    const held = { ...frameModelCounts };
    frameModel({ scenario, log, frame, clock_s: 66600 });
    assert.equal(frameModelCounts.reused - held.reused, 1, "while the map is up, the model is there to be handed back");

    map.destroy();
    const dropped = { ...frameModelCounts };
    frameModel({ scenario, log, frame, clock_s: 66600 });
    assert.equal(frameModelCounts.reused - dropped.reused, 0, "the memo went with the map");
    assert.equal(frameModelCounts.computed - dropped.computed, 1);
  });
});

describe("the pinned car", () => {
  test("is drawn with its state glyph, a surface ring and a 2 px focus ring, named for screen readers", () => {
    const log = payload.log;
    const snap = log.snapshots[162];
    for (const car of snap.cars.filter((c, i, all) => all.findIndex((x) => x.state === c.state) === i)) {
      const { map } = drawn({ clock_s: snap.t, pinnedCar: car.id, interpolate: false });
      const g = map.svg.querySelector(`[data-layer="pinned"] g[data-car="${car.id}"]`);
      assert.ok(g, car.id);
      assert.equal(g.getAttribute("data-state"), car.state);
      assert.equal(g.getAttribute("aria-label"), labels.pinnedCarName({ car: car.id, state: labels.MAP.carStates[car.state] }));
      const ring = g.querySelector('[data-role="focus-ring"]');
      assert.equal(ring.getAttribute("stroke-width"), "2");
      assert.equal(g.querySelector('[data-role="surface-ring"]').getAttribute("class"), "fl-glyph-ring");
      const family = familyOf(car.state);
      assert.ok(g.querySelector(`.${FAMILY_CLASS[family]}`));
      const edged = g.querySelectorAll(".fl-glyph-edge").length > 0;
      assert.equal(edged, EDGE_FAMILIES.includes(family), `${car.state} ink edge`);
    }
  });

  test("a pinned car on a route moves along it between snapshots", () => {
    const log = payload.log;
    const snap = log.snapshots[162];
    const onRoute = snap.cars.find((c) => c.leg && segmentAt(log, c.id, snap.t)?.kind === "ROUTE" && segmentAt(log, c.id, snap.t + 120)?.kind === "ROUTE");
    assert.ok(onRoute, "a car on a route segment at 18:30");
    const { map, redraw } = drawn({ clock_s: snap.t, pinnedCar: onRoute.id });
    // The pinned glyph, not the car layer's mark of the same car: both move, and this test is about the pinned one.
    const at = () => map.svg.querySelector(`[data-layer="pinned"] g[data-car="${onRoute.id}"]`).getAttribute("transform");
    const first = at();
    redraw({ clock_s: snap.t + 120, frame: frameAt(log, snap.t + 120) });
    assert.notEqual(at(), first, "interpolated");
    redraw({ clock_s: snap.t + 120, frame: frameAt(log, snap.t + 120, { interpolate: false }) });
    assert.equal(at(), first, "reduced motion stays at the snapshot position");
  });

  test("a pinned car on a route points the way its own mark does, whatever it is doing there", () => {
    // The rotation follows where a car is, not what it is doing: a pinned TO_DEPOT car on a route turns with the
    // route, so the pinned glyph covers its own mark in the cars layer instead of sitting unrotated on top of it.
    const log = payload.log;
    const banded = bandedDirections(log, scenario.routes, GEOMETRIES.wide);
    let checked = 0;
    for (const snap of log.snapshots) {
      if (checked === 3) break;
      const found = snap.cars.find((c) => {
        if (c.leg === undefined || c.state !== "TO_DEPOT") return false;
        const place = placeCar(log, c, snap.t);
        return place.kind === "route" && !banded.has(`${place.route}|${place.dir}`);
      });
      if (found === undefined) continue;
      const { map } = drawn({ clock_s: snap.t, pinnedCar: found.id, interpolate: false });
      const mark = map.svg.querySelector(`[data-layer="cars"] g[data-car="${found.id}"]`);
      const rotation = mark.getAttribute("transform").match(/rotate\((-?[\d.]+)\)$/);
      assert.ok(rotation, mark.getAttribute("transform"));
      assert.equal(map.svg.querySelector(`[data-layer="pinned"] g[data-car="${found.id}"] g`).getAttribute("transform"), `rotate(${rotation[1]})`, found.id);
      checked += 1;
    }
    assert.equal(checked, 3, "three pinned TO_DEPOT cars on routes were drawn");
  });
});

describe("cars on routes: one mark per driving car (design §7.3 as amended)", () => {
  const glyphsOf = (map) => map.svg.querySelectorAll('[data-layer="cars"] g[data-car]');
  const markOf = (map, car) => map.svg.querySelector(`[data-layer="cars"] g[data-car="${car}"]`);

  test("the layer paints between the yards and the shields, hidden from assistive technology", () => {
    const { map } = drawn({ clock_s: 66600 });
    const layer = map.svg.querySelector('[data-layer="cars"]');
    assert.equal(layer.getAttribute("aria-hidden"), "true");
    assert.equal(layer.getAttribute("tabindex"), null);
    assert.ok(glyphsOf(map).length > 0, "cars are drawn at D1 18:30");
  });

  test("one glyph for every car on a route that draws marks, and none for a standing or at-depot car", () => {
    const log = payload.log;
    const snap = log.snapshots[162];
    const { map, input } = drawn({ clock_s: snap.t, interpolate: false });
    const banded = bandedDirections(log, scenario.routes, GEOMETRIES.wide);
    const all = placements(log, input.frame);
    const marks = all.filter(({ place }) => place.kind === "route" && !banded.has(`${place.route}|${place.dir}`));
    const standing = all.filter(({ place }) => place.kind === "area");
    const atDepot = all.filter(({ place }) => place.kind === "depot");
    assert.ok(marks.length > 50, `${String(marks.length)} cars on routes at D1 18:30`);
    assert.ok(standing.length > 0 && atDepot.length > 0, "and cars standing in an area and sitting at a depot");
    assert.deepEqual(glyphsOf(map).map((g) => g.getAttribute("data-car")).sort(), marks.map(({ car }) => car.id).sort());
    // The honesty line of the whole layer: the model gives an area no inside geography, so a car standing in one
    // stays a unit bar and a car at a depot stays part of the tile's micro-bar. Neither is ever placed on the map.
    for (const { car } of [...standing, ...atDepot]) assert.equal(markOf(map, car.id), null, car.id);
  });

  test("a glyph sits at placeCar's fraction along its route, points along its direction, and carries its state", () => {
    const log = payload.log;
    const snap = log.snapshots[162];
    const { map, input } = drawn({ clock_s: snap.t, interpolate: false });
    const banded = bandedDirections(log, scenario.routes, GEOMETRIES.wide);
    let checked = 0;
    for (const { car, place } of placements(log, input.frame)) {
      if (place.kind !== "route" || banded.has(`${place.route}|${place.dir}`)) continue;
      const node = markOf(map, car.id);
      const route = scenario.routes.find((r) => r.id === place.route);
      assert.equal(node.getAttribute("transform"), carTransform(route, place.dir, place.fraction), car.id);
      assert.equal(node.getAttribute("data-state"), car.state);
      assert.equal(node.getAttribute("class"), `fl-car ${FAMILY_CLASS[familyOf(car.state)]}`);
      // The surface ring design §8.2 asks for, then the state's own glyph: a 10 px mark inside a 2 px panel ring.
      const [ring, glyph] = node.children;
      assert.equal(ring.getAttribute("class"), "fl-glyph-ring");
      assert.equal(ring.getAttribute("r"), "9");
      assert.equal(glyph.localName, "polygon");
      assert.equal(node.children.length, 2);
      checked += 1;
    }
    assert.ok(checked > 50, `${String(checked)} glyphs checked`);
  });

  test("only the four driving states are ever drawn, so a route mark is only ever a triangle or a diamond", () => {
    const log = payload.log;
    const banded = bandedDirections(log, scenario.routes, GEOMETRIES.wide);
    const drawnStates = new Set();
    const logStates = new Set();
    for (const clock_s of [25200, 43200, 66600, 68400, 111600]) {
      const { map, input } = drawn({ clock_s });
      for (const node of glyphsOf(map)) drawnStates.add(node.getAttribute("data-state"));
      for (const { car, place } of placements(log, input.frame)) {
        if (place.kind === "route" && !banded.has(`${place.route}|${place.dir}`)) logStates.add(car.state);
      }
    }
    assert.deepEqual([...drawnStates].sort(), [...logStates].sort());
    for (const state of drawnStates) assert.ok(["ENROUTE_PICKUP", "ON_TRIP", "TO_DEPOT", "REPOSITIONING"].includes(state), state);
    assert.ok(drawnStates.size >= 2, [...drawnStates].join(","));
  });

  test("a car whose rounded place has not moved keeps its exact transform string; a moved one takes one write", () => {
    const log = payload.log;
    const snap = log.snapshots[162];
    const banded = bandedDirections(log, scenario.routes, GEOMETRIES.wide);
    const moving = snap.cars.find((c) => {
      if (c.leg === undefined) return false;
      const here = placeCar(log, c, snap.t);
      const later = placeCar(log, c, snap.t + 120);
      return here.kind === "route" && later.kind === "route" && here.route === later.route
        && !banded.has(`${here.route}|${here.dir}`) && here.fraction !== later.fraction;
    });
    assert.ok(moving, "a car still on the same route two minutes later");
    const { map, redraw } = drawn({ clock_s: snap.t });
    const node = markOf(map, moving.id);
    const before = node.getAttribute("transform");
    const writes = [];
    const write = node.setAttribute.bind(node);
    node.setAttribute = (name, value) => {
      writes.push(name);
      write(name, value);
    };

    redraw({});
    assert.deepEqual(writes, [], "the same second drawn again costs an unchanged car nothing");
    assert.equal(node.getAttribute("transform"), before);

    redraw({ clock_s: snap.t + 120, frame: frameAt(log, snap.t + 120) });
    assert.deepEqual(writes, ["transform"], "a move is one composed attribute, never a translate and a rotate");
    assert.notEqual(node.getAttribute("transform"), before);
    assert.equal(markOf(map, moving.id), node, "the same node is moved, never rebuilt");
    assert.match(node.getAttribute("transform"), /^translate\(-?[\d.]+ -?[\d.]+\) rotate\(-?[\d.]+\)$/);
  });

  test("with interpolation off every glyph is at its snapshot position, and the same clock drawn twice is identical", () => {
    const log = payload.log;
    const snap = log.snapshots[162];
    const clock_s = snap.t + 150; // between two snapshots: reduced motion steps on the 5-minute grid
    const { map, input } = drawn({ clock_s, interpolate: false });
    assert.equal(input.frame.at_s, snap.t, "the frame is the snapshot second, with no new code path in the map");
    const banded = bandedDirections(log, scenario.routes, GEOMETRIES.wide);
    let checked = 0;
    for (const { car, place } of placements(log, input.frame)) {
      if (place.kind !== "route" || banded.has(`${place.route}|${place.dir}`)) continue;
      const route = scenario.routes.find((r) => r.id === place.route);
      assert.equal(markOf(map, car.id).getAttribute("transform"), carTransform(route, place.dir, place.fraction), car.id);
      checked += 1;
    }
    assert.ok(checked > 0);
    // Position is a pure function of (log, clock_s): a second map drawn on the same clock is identical, mark for mark.
    const twin = createMap();
    document.body.appendChild(twin.element);
    twin.update({ ...input, frame: frameAt(log, clock_s, { interpolate: false }) });
    const marks = (m) => m.svg.querySelectorAll('[data-layer="cars"] g[data-car]').map((g) => [g.getAttribute("data-car"), g.getAttribute("data-state"), g.getAttribute("transform")]);
    assert.deepEqual(marks(twin), marks(map));
    twin.destroy();
  });

  test("the layer adds no tab stop, so the schematic is still exactly one (design §7.7)", () => {
    const { map } = drawn({ clock_s: 66600, pinnedCar: "SF-017" });
    assert.ok(glyphsOf(map).length > 0);
    const stops = [map.svg, ...map.svg.querySelectorAll("*")].filter((node) => node.getAttribute("tabindex") !== null && node.tabIndex >= 0);
    assert.equal(stops.length, 1);
    assert.notEqual(stops[0].closest('[data-layer="cars"]'), stops[0]);
    assert.equal(map.svg.querySelectorAll('[data-layer="cars"] [tabindex]').length, 0);
    assert.equal(map.svg.querySelectorAll('[data-layer="cars"] [data-focus-key]').length, 0);
  });

  test("car marks use only the mark classes and the two route hues, never a status colour or a dash", () => {
    const allowed = new Set(["fl-car", "fl-glyph-ring", "fl-fam-rider", "fl-fam-empty"]);
    for (const clock_s of [25200, 43200, 66600, 68400, 111600]) {
      const { map } = drawn({ clock_s });
      const layer = map.svg.querySelector('[data-layer="cars"]');
      for (const node of [layer, ...layer.querySelectorAll("*")]) {
        for (const cls of (node.getAttribute("class") ?? "").split(/\s+/).filter(Boolean)) {
          assert.ok(allowed.has(cls), `car element class ${cls} at ${String(clock_s)}`);
        }
        for (const name of node.getAttributeNames()) {
          assert.doesNotMatch(node.getAttribute(name), /--(hold|pass|cond|invalid|car-depot|car-available)|dasharray/, `${name} at ${String(clock_s)}`);
          assert.notEqual(name, "stroke-dasharray");
        }
      }
      assert.ok(layer.querySelectorAll("g[data-car]").length > 0, `cars drawn at ${String(clock_s)}`);
    }
  });
});

describe("the route fallback: where a direction draws a band instead of marks", () => {
  test("a direction bands exactly when its route is shorter than three units a car at its peak", () => {
    const log = payload.log;
    const peak = peakConcurrency(log);
    assert.equal(FLOOR_UNITS_PER_CAR, 3);
    assert.ok(peak.size > 0);
    for (const geometry of [GEOMETRIES.wide, GEOMETRIES.phone]) {
      const banded = bandedDirections(log, scenario.routes, geometry);
      for (const [key, cars] of peak) {
        const route = scenario.routes.find((r) => r.id === key.slice(0, key.indexOf("|")));
        const room = routeGeometry(route, geometry).length;
        assert.equal(banded.has(key), room < FLOOR_UNITS_PER_CAR * cars, `${key} at ${geometry.name}: ${room.toFixed(1)} units for ${String(cars)} cars`);
      }
      // A direction this run never puts a car on is never banded: there is nothing to draw either way.
      for (const key of banded) assert.ok(peak.has(key), key);
    }
  });

  test("the default preset bands one direction of H1 on the wide map and nothing on the phone (measured)", () => {
    assert.deepEqual([...bandedDirections(payload.log, scenario.routes, GEOMETRIES.wide)], ["H1|PEN>SF"]);
    assert.equal(bandedDirections(payload.log, scenario.routes, GEOMETRIES.phone).size, 0);
    // Why the two differ: the wide map draws the San Francisco to Peninsula corridor at 50 units and the phone at 104.
    const h1 = scenario.routes.find((r) => r.id === "H1");
    assert.equal(Math.round(routeGeometry(h1, GEOMETRIES.wide).length), 50);
    assert.equal(Math.round(routeGeometry(h1, GEOMETRIES.phone).length), 104);
  });

  test("every scenario of this preset draws its routes at the same lengths, which is what the kept answer rests on", () => {
    // bandedDirections keeps its answer per log and geometry and does not key on the routes it is handed, because a
    // log's routes are fixed by the run that made it. That is only safe while no scenario can move a route: if one
    // ever did, the decision would differ and a kept set would be wrong. This fails here first, loudly.
    const referenced = referenceScenario();
    assert.deepEqual(referenced.routes.map((r) => r.id), scenario.routes.map((r) => r.id));
    for (const geometry of [GEOMETRIES.wide, GEOMETRIES.phone]) {
      for (const route of scenario.routes) {
        const other = referenced.routes.find((r) => r.id === route.id);
        assert.deepEqual([other.a, other.b], [route.a, route.b], `${route.id} endpoints`);
        assert.equal(routeGeometry(other, geometry).length, routeGeometry(route, geometry).length, `${route.id} at ${geometry.name}`);
      }
    }
  });

  test("the design 5.9 reference fleet bands both directions of H1 wide, and writes a reason for each", async () => {
    const reference = await referencePayload();
    const referenced = referenceScenario();
    assert.equal(reference.log.cars.length, 150);
    assert.deepEqual([...bandedDirections(reference.log, referenced.routes, GEOMETRIES.wide)].sort(), ["H1|PEN>SF", "H1|SF>PEN"]);
    assert.equal(bandedDirections(reference.log, referenced.routes, GEOMETRIES.phone).size, 0);
    const map = createMap();
    document.body.appendChild(map.element);
    map.update({ scenario: referenced, log: reference.log, frame: frameAt(reference.log, 66600), clock_s: 66600, pinnedCar: null, seed: reference.log.seed });
    const reasons = map.element.querySelectorAll('[data-role="crowded-route"]');
    // Two banded directions, two reasons, in the scenario's own direction order. One reason for the route would
    // leave the reader to guess which way a band that is drawn down the middle of the corridor counts.
    assert.deepEqual(reasons.map((n) => n.getAttribute("data-route")), ["H1", "H1"]);
    assert.deepEqual(reasons.map((n) => n.getAttribute("data-dir")), ["SF>PEN", "PEN>SF"]);
    assert.deepEqual(reasons.map(textOf), [
      labels.MAP.crowdedRoute({ routeId: "H1", from: labels.MAP.areas.SF, to: labels.MAP.areas.PEN }),
      labels.MAP.crowdedRoute({ routeId: "H1", from: labels.MAP.areas.PEN, to: labels.MAP.areas.SF }),
    ]);
    assert.ok(map.svg.querySelectorAll('[data-layer="cars"] g[data-car]').length > 0);
    map.destroy();
  });

  test("the decision is made once for the run: the same directions band at every clock", () => {
    const log = payload.log;
    const banded = bandedDirections(log, scenario.routes, GEOMETRIES.wide);
    const { map, redraw } = drawn({ clock_s: 25200 });
    for (const clock_s of [25200, 43200, 66600, 68400, 90000, 111600]) {
      const frame = frameAt(log, clock_s);
      redraw({ clock_s, frame });
      const marks = new Set(map.svg.querySelectorAll('[data-layer="cars"] g[data-car]').map((g) => g.getAttribute("data-car")));
      for (const { car, place } of placements(log, frame)) {
        const drawsAMark = place.kind === "route" && !banded.has(`${place.route}|${place.dir}`);
        assert.equal(marks.has(car.id), drawsAMark, `${car.id} at ${format.clock(clock_s)}`);
      }
    }
  });

  test("a banded direction keeps today's flow band, and the direction beside it still draws marks", () => {
    const log = payload.log;
    const { map, model, input } = drawn({ clock_s: 66600 });
    const banded = bandedDirections(log, scenario.routes, GEOMETRIES.wide);
    const h1 = model.routes.find((r) => r.id === "H1");
    const bandDir = h1.directions.find((d) => banded.has(`H1|${d.dir}`));
    const markDir = h1.directions.find((d) => !banded.has(`H1|${d.dir}`));
    assert.ok(bandDir !== undefined && markDir !== undefined, "H1 draws one of each at the default preset");
    assert.ok(bandDir.riderWork + bandDir.emptyDrive > 0, "the banded direction carries cars at D1 18:30");
    // The band counts the banded direction's cars, and only those.
    const band = map.svg.querySelectorAll('g[data-route="H1"] [data-role="flow"] [data-cars]');
    assert.equal(band.reduce((n, node) => n + Number(node.getAttribute("data-cars")), 0), bandDir.riderWork + bandDir.emptyDrive);
    const marks = placements(log, input.frame).filter(({ place }) => place.kind === "route" && place.route === "H1" && place.dir === markDir.dir);
    assert.equal(marks.length, markDir.riderWork + markDir.emptyDrive);
    for (const { car } of marks) assert.ok(map.svg.querySelector(`[data-layer="cars"] g[data-car="${car.id}"]`), car.id);
  });

  test("a route whose directions both draw marks carries no flow band at all", () => {
    const { map, model } = drawn({ clock_s: 66600 });
    for (const r of model.routes) {
      if (r.id === "H1") continue;
      assert.equal(map.svg.querySelectorAll(`g[data-route="${r.id}"] [data-role="flow"] *`).length, 0, `${r.id} draws its cars as marks, so its band is gone`);
    }
  });
});

describe("what the map now says out loud (the motion plan's H-a to H-d)", () => {
  test("the map carries its first model-limits chip: traffic on the hour, and areas as points", () => {
    const { map } = drawn({ clock_s: 66600 });
    const chip = map.element.querySelector(".fl-limits-chip");
    assert.ok(chip, "the map carries a model-limits chip");
    assert.equal(chip.getAttribute("data-role"), "model-limits");
    const limits = chip.querySelectorAll("[data-limit]");
    assert.deepEqual(limits.map((n) => n.getAttribute("data-limit")), ["hourlyTraffic", "areasArePoints"]);
    assert.deepEqual(limits.map(textOf), [labels.MODEL_LIMITS.hourlyTraffic, labels.MODEL_LIMITS.areasArePoints]);
  });

  test("the legend carries both encodings at once: one mark is one car, and one block is five", () => {
    const { map } = drawn({ clock_s: 66600 });
    assert.equal(map.element.querySelector('[data-role="unit-legend"]').textContent, labels.MAP.unitBarLegend);
    assert.equal(map.element.querySelector('[data-role="mark-legend"]').textContent, labels.MAP.oneMarkOneCar);
    assert.equal(labels.MAP.oneMarkOneCar, "One mark is one car on a route. Cars inside an area are drawn as blocks of 5.");
  });

  test("each banded direction carries its written reason, in visible text, and names a drawing limit", () => {
    const { map, model } = drawn({ clock_s: 66600 });
    const banded = bandedDirections(payload.log, scenario.routes, GEOMETRIES.wide);
    const reasons = map.element.querySelectorAll('[data-role="crowded-route"]');
    // The default preset bands H1 one way only, so the reason has to name that way. The same corridor draws marks
    // toward the Peninsula at this very clock, and a reason written for the whole route would contradict them.
    assert.deepEqual([...banded], ["H1|PEN>SF"]);
    assert.deepEqual(reasons.map((n) => n.getAttribute("data-route")), ["H1"]);
    assert.deepEqual(reasons.map((n) => n.getAttribute("data-dir")), ["PEN>SF"]);
    assert.equal(reasons[0].textContent, labels.MAP.crowdedRoute({ routeId: "H1", from: labels.MAP.areas.PEN, to: labels.MAP.areas.SF }));
    assert.equal(reasons[0].textContent, "H1 Peninsula to San Francisco is short on this schematic, so the cars going that way are drawn as a band.");
    assert.equal(reasons[0].hidden, false);
    const theOtherWay = model.onRoutes.filter((car) => car.route === "H1" && car.dir === "SF>PEN");
    assert.ok(theOtherWay.length > 0, "H1 carries cars the other way at D1 18:30");
    for (const car of theOtherWay) assert.ok(map.svg.querySelector(`[data-layer="cars"] g[data-car="${car.id}"]`), car.id);
  });

  test("before a run nothing is banded and no reason is written, and the chip stands all the same", () => {
    const { map } = drawn({ withLog: false, clock_s: 18000 });
    assert.equal(map.element.querySelectorAll('[data-role="crowded-route"]').length, 0);
    assert.equal(map.svg.querySelectorAll('[data-layer="cars"] g[data-car]').length, 0);
    assert.ok(map.element.querySelector(".fl-limits-chip"), "the limits are about the model, not about a replay");
  });
});

describe("no status colour and no fourth hue on routes", () => {
  test("route marks use only neutral classes and the rider-work and empty-drive hues", () => {
    const allowed = new Set(["fl-route", "fl-route--highway", "fl-route--local", "fl-route--congested", "fl-route-highway__casing", "fl-route-highway__centre", "fl-route-local", "fl-chevron", "fl-mono", "fl-fam-rider", "fl-fam-empty"]);
    for (const clock_s of [25200, 43200, 66600, 68400, 111600]) {
      const log = payload.log;
      const pinned = log.snapshots[Math.floor((clock_s - 18000) / 300)].cars.find((c) => c.leg && segmentAt(log, c.id, clock_s)?.kind === "ROUTE");
      const { map } = drawn({ clock_s, pinnedCar: pinned?.id ?? null });
      const layer = map.svg.querySelector('[data-layer="routes"]');
      const nodes = [layer, ...layer.querySelectorAll("*")];
      for (const node of nodes) {
        for (const cls of (node.getAttribute("class") ?? "").split(/\s+/).filter(Boolean)) {
          assert.ok(allowed.has(cls), `route element class ${cls} at ${String(clock_s)}`);
        }
        for (const name of node.getAttributeNames()) {
          assert.doesNotMatch(node.getAttribute(name), /--(hold|pass|cond|invalid|car-depot|car-available)|dasharray/, `${name} at ${String(clock_s)}`);
          assert.notEqual(name, "stroke-dasharray");
        }
      }
      // Cars are marks in their own layer now, so what the route layer must keep carrying at every clock is its
      // geometry and its chevrons; the cars themselves are asserted on the layer that draws them.
      assert.ok(map.svg.querySelectorAll('[data-layer="cars"] g[data-car]').length > 0, `cars drawn at ${String(clock_s)}`);
      if (pinned !== undefined) {
        const g = map.svg.querySelector(`[data-layer="pinned"] g[data-car="${pinned.id}"]`);
        const hues = g.querySelectorAll(".fl-fam-rider, .fl-fam-empty, .fl-fam-available, .fl-fam-depot").map((n) => n.getAttribute("class"));
        assert.ok(hues.every((c) => c === "fl-fam-rider" || c === "fl-fam-empty"), `pinned car on a route uses ${hues.join(",")}`);
      }
      assert.equal(map.svg.querySelectorAll(".fl-unserved").filter((n) => n.closest('[data-layer="routes"]')).length, 0);
    }
  });

  test("status colour appears only on unserved riders, and all map text follows the copy rules", () => {
    const { map } = drawn({ clock_s: 66600 });
    for (const node of map.element.querySelectorAll("[class]")) {
      const classes = node.getAttribute("class");
      if (/fl-unserved/.test(classes)) assert.equal(node.getAttribute("data-role"), "unserved");
    }
    const text = [map.element, ...map.element.querySelectorAll("*")].flatMap((n) => [n.textContent ?? "", ...["aria-label", "title"].map((a) => n.getAttribute(a) ?? "")]).join(" ");
    assert.doesNotMatch(text, /[\u2013\u2014]/);
    assert.doesNotMatch(text, /\b(predict|forecast|live|real-time|monitoring|wins?|winner|beats|score|gauge|grade|leaderboard|revenue|cost)\b|expected traffic|better option|best configuration/i);
  });
});

describe("roving focus and shortcuts", () => {
  const press = (key, extra = {}) => {
    const target = document.activeElement;
    const event = new KeyboardEvent("keydown", { key, bubbles: true, cancelable: true, ...extra });
    target.dispatchEvent(event);
    return event;
  };
  const active = () => document.activeElement;
  const tabStops = (map) => map.svg.querySelectorAll('[tabindex="0"]');

  test("the svg root is never a tab stop of its own, so the schematic is exactly one stop (design §7.7)", () => {
    for (const { map } of [drawn(), drawn({ clock_s: 66600 })]) {
      // An explicit -1: a browser otherwise makes the overflow-hidden svg a focusable scroller before the area group.
      assert.equal(map.svg.getAttribute("tabindex"), "-1");
      const stops = [map.svg, ...map.svg.querySelectorAll("*")].filter((node) => node.getAttribute("tabindex") !== null && node.tabIndex >= 0);
      assert.equal(stops.length, 1, stops.map((node) => node.getAttribute("data-focus-key") ?? node.localName).join(","));
      assert.notEqual(stops[0], map.svg);
    }
  });

  test("one tab stop; arrows move between areas; Enter goes in; arrows cycle depots and routes; Escape comes out", () => {
    const { map } = drawn();
    assert.equal(tabStops(map).length, 1);
    assert.equal(tabStops(map)[0].getAttribute("data-area"), "SF");
    map.svg.querySelector('[data-area="SF"]').focus();
    press("ArrowRight");
    assert.equal(active().getAttribute("data-area"), "EB");
    press("ArrowDown");
    assert.equal(active().getAttribute("data-area"), "SJ");
    press("ArrowLeft");
    assert.equal(active().getAttribute("data-area"), "PEN");
    press("ArrowLeft"); // nothing west of the Peninsula
    assert.equal(active().getAttribute("data-area"), "PEN");
    press("ArrowUp");
    assert.equal(active().getAttribute("data-area"), "SF");
    assert.equal(tabStops(map).length, 1);

    const escape = press("Enter");
    assert.equal(escape.defaultPrevented, true);
    assert.equal(active().getAttribute("data-depot"), "SF-1");
    press("ArrowRight");
    assert.equal(active().getAttribute("data-depot"), "SF-2");
    press("ArrowRight");
    assert.equal(active().getAttribute("data-route"), "H1");
    // Focus opens the route tooltip; Enter toggles it closed and open again, on the focused route.
    const tooltip = map.element.querySelector(".fl-tooltip");
    assert.equal(tooltip.getAttribute("data-open"), "true");
    press("Enter");
    assert.equal(tooltip.getAttribute("data-open"), "false");
    press("Enter");
    assert.equal(tooltip.getAttribute("data-open"), "true");
    assert.equal(tooltip.getAttribute("data-route"), "H1");
    press("ArrowLeft");
    press("ArrowLeft");
    press("ArrowLeft"); // wraps to the last route touching SF
    assert.equal(active().getAttribute("data-route"), "L3");
    assert.equal(tabStops(map).length, 1);
    press("Escape");
    assert.equal(active().getAttribute("data-area"), "SF");
    assert.deepEqual(map.focusState(), { level: "areas", area: "SF", index: 0, key: "area:SF" });
  });

  test("Enter selects a depot, I opens Inspect for it, and I opens the pinned car from an area", () => {
    const calls = [];
    const { map } = drawn({ pinnedCar: "SF-017", handlers: { onInspect: (t) => calls.push(["inspect", t]), onSelect: (s) => calls.push(["select", s]) } });
    map.svg.querySelector('[data-area="SJ"]').focus();
    press("i");
    press("Enter");
    press("Enter");
    press("I");
    assert.deepEqual(calls, [
      ["inspect", { car: "SF-017" }],
      ["select", { depot: "SJ-1" }],
      ["inspect", { depot: "SJ-1" }],
    ]);
  });

  test("a click or tap on a depot tile opens its inspector, and on the pinned glyph opens the car's (G1)", () => {
    const calls = [];
    const { map, redraw } = drawn({ pinnedCar: "SF-017", handlers: { onInspect: (t) => calls.push(["inspect", t]), onSelect: (s) => calls.push(["select", s]) } });
    map.svg.querySelector('g[data-depot="SJ-1"] rect').dispatchEvent(new Event("click", { bubbles: true }));
    const glyph = map.svg.querySelector('[data-layer="pinned"] g[data-car="SF-017"]');
    assert.equal(glyph.getAttribute("class"), "fl-pinned-car");
    const hit = glyph.querySelector('circle[data-role="hit"]');
    assert.equal(hit.getAttribute("r"), "22", "a 44 px pointer and touch target");
    assert.equal(hit.getAttribute("class"), "fl-hit");
    glyph.querySelector('[data-role="surface-ring"]').dispatchEvent(new Event("click", { bubbles: true }));
    assert.deepEqual(calls, [["inspect", { depot: "SJ-1" }], ["inspect", { car: "SF-017" }]]);
    redraw({});
    assert.equal(map.svg.querySelector('[data-layer="pinned"] g[data-car="SF-017"]'), glyph, "the same glyph is moved, not rebuilt, while the car keeps its state");
    redraw({ pinnedCar: null });
    assert.equal(map.svg.querySelector('[data-layer="pinned"] g'), null);
  });

  test("playback shortcuts reach the handler only while the map has focus", () => {
    const keys = [];
    const { map } = drawn({ handlers: { onKey: (event) => keys.push(event.key) === 0 } });
    document.body.dispatchEvent(new KeyboardEvent("keydown", { key: " ", bubbles: true }));
    assert.deepEqual(keys, []);
    map.svg.querySelector('[data-area="EB"]').focus();
    press(" ");
    press(",");
    assert.deepEqual(keys, [" ", ","]);
  });

  test("mounted on a store, the map follows the clock and its keys drive playback", () => {
    const store = createStore(createInitialState({ presetId: "bay_teaching_map", scenario }));
    const scheduler = { request: () => 1, cancel: () => {} };
    const playback = createPlayback({ store, scheduler });
    const region = document.createElement("section");
    document.body.appendChild(region);
    const map = mountMap(region, { store, playback });
    assert.equal(region.querySelector('[data-role="nothing-run"]').hidden, false);
    store.dispatch({ type: "run/queued", id: "r" });
    store.dispatch({ type: "run/done", id: "r", payload });
    assert.equal(region.querySelector('[data-role="nothing-run"]').hidden, true);
    store.dispatch({ type: "clock/set", clock_s: 66600 });
    const h2 = map.table.querySelector('tr[data-route="H2"][data-dir="SF>SJ"]');
    assert.equal(cellText(h2, '[data-col="planned"]'), "77 min");
    map.svg.querySelector('[data-area="SF"]').focus();
    press(".");
    assert.equal(store.getState().clock_s, 66900);
    press(" ");
    assert.equal(store.getState().playing, true);
    store.dispatch({ type: "fork/pin", car: "SF-017" });
    assert.ok(region.querySelector('[data-layer="pinned"] g[data-car="SF-017"]'));
    press("I");
    assert.deepEqual(store.getState().inspector, { car: "SF-017" });
    map.destroy();
  });
});
