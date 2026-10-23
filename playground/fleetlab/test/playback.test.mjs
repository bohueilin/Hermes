// Playback over a real run_window log (design §7.4, §7.7): seek determinism, interpolation, reduced-motion stepping,
// speeds, jumps, scrubber bounds, the slow-device switch and the transport region on the fake DOM.

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { after, before, describe, test } from "node:test";

import { installFakeDom } from "./helpers/fake-dom.mjs";
import { presetScenario, windowPayload } from "./helpers/model-payloads.mjs";
import { PRESETS } from "../src/model/presets.js";
import * as labels from "../src/ui/labels.js";
import {
  JUMPS,
  MAX_FRAME_GAP_MS,
  SLOW_FRAME_MS,
  SLOW_SPAN_MS,
  SNAPSHOT_STEP_S,
  createPlayback,
  frameAt,
  gridCeil,
  gridFloor,
  legPermille,
  renderTransport,
  scrubberBounds,
  scrubberTicks,
  snapshotIndex,
} from "../src/ui/playback.js";
import { createInitialState, createStore } from "../src/ui/store.js";

let payload;
let uninstall;

before(async () => {
  payload = await windowPayload();
  uninstall = installFakeDom();
});

after(() => uninstall());

/** A frame scheduler the test drives: `flush(ts)` runs the callbacks queued so far with timestamp `ts`. */
function manualScheduler() {
  let next = 1;
  const queue = new Map();
  return {
    request(cb) {
      const id = next++;
      queue.set(id, cb);
      return id;
    },
    cancel(id) {
      queue.delete(id);
    },
    flush(ts) {
      const callbacks = [...queue.values()];
      queue.clear();
      for (const cb of callbacks) cb(ts);
      return callbacks.length;
    },
    get pending() {
      return queue.size;
    },
  };
}

/** A store holding the default preset and, unless `withLog` is false, the real run payload. */
function setup({ reduced = false, withLog = true } = {}) {
  const scenario = presetScenario();
  const store = createStore(createInitialState({ presetId: "bay_teaching_map", scenario, reducedMotionSystem: reduced }));
  if (withLog) {
    store.dispatch({ type: "run/queued", id: "r1" });
    store.dispatch({ type: "run/done", id: "r1", payload });
  }
  const scheduler = manualScheduler();
  const playback = createPlayback({ store, scheduler });
  return { store, scheduler, playback, scenario };
}

describe("snapshots and interpolation", () => {
  test("snapshotIndex finds the last snapshot at or before the clock", () => {
    const log = payload.log;
    assert.equal(log.snapshots[0].t, 18000);
    assert.equal(snapshotIndex(log, 18000), 0);
    assert.equal(snapshotIndex(log, 18299), 0);
    assert.equal(snapshotIndex(log, 18300), 1);
    // 66,650 lies in the snapshot at 66,600: (66,600 - 18,000) / 300 = 162.
    assert.equal(log.snapshots[snapshotIndex(log, 66650)].t, 66600);
    assert.equal(snapshotIndex(log, 0), 0);
    assert.equal(snapshotIndex(log, 10 ** 9), log.snapshots.length - 1);
  });

  test("legPermille is the snapshot formula and clamps to 0..1000", () => {
    const leg = { t0: 1000, t1: 4000 };
    assert.equal(legPermille(leg, 1000), 0);
    assert.equal(legPermille(leg, 2000), 333); // floor(1000 × 1000 / 3000)
    assert.equal(legPermille(leg, 4000), 1000);
    assert.equal(legPermille(leg, 9000), 1000);
    assert.equal(legPermille(leg, 0), 0);
    assert.equal(legPermille({ t0: 5, t1: 5 }, 5), 1000);
  });

  test("at a snapshot second the interpolated frame equals the snapshot", () => {
    const log = payload.log;
    for (const index of [0, 50, 162, 300]) {
      const snap = log.snapshots[index];
      const frame = frameAt(log, snap.t);
      assert.equal(frame.snapshot_t, snap.t);
      assert.equal(frame.at_s, snap.t);
      assert.deepEqual(frame.cars, snap.cars);
      assert.deepEqual(frame.depots, snap.depots);
    }
  });

  test("between snapshots each leg moves linearly from its own start and end seconds", () => {
    const log = payload.log;
    const snap = log.snapshots[162];
    const clock_s = snap.t + 150;
    const frame = frameAt(log, clock_s);
    assert.equal(frame.interpolated, true);
    assert.equal(frame.at_s, clock_s);
    let moved = 0;
    frame.cars.forEach((car, i) => {
      const before = snap.cars[i];
      assert.equal(car.id, before.id);
      assert.equal(car.state, before.state, "interpolation never invents a state change");
      if (before.leg === undefined) {
        assert.equal(car, before);
        return;
      }
      const expected = Math.min(1000, Math.floor(((clock_s - before.leg.t0) * 1000) / (before.leg.t1 - before.leg.t0)));
      assert.equal(car.leg.done_permille, expected);
      assert.ok(car.leg.done_permille >= before.leg.done_permille);
      if (car.leg.done_permille > before.leg.done_permille) moved += 1;
    });
    assert.ok(moved > 0, "some legs progress in 150 s");
  });

  test("without interpolation the frame is the snapshot, whatever the clock inside it", () => {
    const log = payload.log;
    const snap = log.snapshots[162];
    for (const offset of [0, 1, 150, 299]) {
      const frame = frameAt(log, snap.t + offset, { interpolate: false });
      assert.equal(frame.at_s, snap.t);
      assert.deepEqual(frame.cars, snap.cars);
    }
  });

  test("the grid helpers count 5-minute steps from the window start", () => {
    const w = { start_s: 18000, end_s: 122400 };
    assert.equal(gridFloor(w, 66650), 66600);
    assert.equal(gridCeil(w, 66650), 66900);
    assert.equal(gridFloor(w, 66600), 66600);
    assert.equal(gridCeil(w, 66600), 66600);
    assert.equal(SNAPSHOT_STEP_S, 300);
  });
});

describe("the controller", () => {
  test("seek is deterministic: the same clock gives the same frame from any earlier position", () => {
    const a = setup();
    const b = setup();
    a.playback.seek(20000);
    a.playback.seek(66650);
    b.playback.seek(110000);
    b.playback.seek(66650);
    assert.equal(a.store.getState().clock_s, 66650);
    assert.deepEqual(a.playback.frame(), b.playback.frame());
    assert.deepEqual(a.playback.frame(), frameAt(payload.log, 66650));
  });

  test("seek clamps to the window through the store", () => {
    const { store, playback } = setup();
    playback.seek(5);
    assert.equal(store.getState().clock_s, 18000);
    playback.seek(999999);
    assert.equal(store.getState().clock_s, 122400);
  });

  test("before a run there is no frame and play does nothing", () => {
    const { store, playback, scheduler } = setup({ withLog: false });
    assert.equal(playback.frame(), null);
    playback.play();
    assert.equal(store.getState().playing, false);
    assert.equal(scheduler.pending, 0);
    assert.equal(playback.autoplay(), false);
  });

  test("play advances the clock by elapsed real time times the speed", () => {
    const { store, playback, scheduler } = setup();
    playback.seek(60000);
    playback.setSpeed(900);
    playback.play();
    assert.equal(scheduler.pending, 1);
    scheduler.flush(1000); // the first frame only records its timestamp
    assert.equal(store.getState().clock_s, 60000);
    scheduler.flush(1100); // 100 ms × 900 = 90 s
    assert.equal(store.getState().clock_s, 60090);
    playback.setSpeed(3600);
    scheduler.flush(1116); // 16 ms × 3600 / 1000 = 57.6 s: 57 now, 0.6 carried
    assert.equal(store.getState().clock_s, 60147);
    scheduler.flush(1132); // 0.6 + 57.6 = 58.2: 58 more
    assert.equal(store.getState().clock_s, 60205);
    playback.pause();
    assert.equal(scheduler.pending, 0, "pausing stops the frame loop");
  });

  test("the four speeds, faster and slower", () => {
    const { store, playback } = setup();
    for (const speed of [60, 300, 900, 3600]) {
      playback.setSpeed(speed);
      assert.equal(store.getState().speed, speed);
    }
    assert.throws(() => playback.setSpeed(120), TypeError);
    playback.faster();
    assert.equal(store.getState().speed, 3600);
    playback.slower();
    playback.slower();
    assert.equal(store.getState().speed, 300);
    playback.setSpeed(60);
    const { scheduler } = setup();
    assert.equal(scheduler.pending, 0);
  });

  test("a long gap between frames advances at most the gap limit and never counts as a slow frame", () => {
    const { store, playback, scheduler } = setup();
    playback.seek(60000);
    playback.setSpeed(60);
    playback.play();
    scheduler.flush(0);
    scheduler.flush(10000); // a 10 s gap moves only MAX_FRAME_GAP_MS × 60 / 1000 = 15 s
    assert.equal(store.getState().clock_s, 60000 + (MAX_FRAME_GAP_MS * 60) / 1000);
    assert.equal(playback.simplified, false);
  });

  test("playing to the window end stops", () => {
    const { store, playback, scheduler } = setup();
    playback.seek(122400 - 30);
    playback.setSpeed(3600);
    playback.play();
    scheduler.flush(0);
    scheduler.flush(100); // 360 s requested, clamped at the end
    assert.equal(store.getState().clock_s, 122400);
    assert.equal(store.getState().playing, false);
    assert.equal(scheduler.pending, 0);
  });

  test("steps of 5 minutes and 1 hour, and the three jumps", () => {
    const { store, playback } = setup();
    playback.seek(60000);
    playback.step("5min", 1);
    assert.equal(store.getState().clock_s, 60300);
    playback.step("1h", -1);
    assert.equal(store.getState().clock_s, 56700);
    assert.deepEqual(JUMPS, ["am_peak", "pm_peak", "d2_first_wave"]);
    // Peak windows of the default preset start at 07:00 and 16:00: 7 × 3600, 16 × 3600, 86,400 + 7 × 3600.
    const expected = { am_peak: 25200, pm_peak: 57600, d2_first_wave: 111600 };
    for (const target of JUMPS) {
      playback.jump(target);
      assert.equal(store.getState().clock_s, expected[target], target);
    }
    assert.throws(() => playback.jump("noon"), TypeError);
  });

  test("keyboard shortcuts: Space, comma and period, Shift for an hour, brackets for speed, arrows only when allowed", () => {
    const { store, playback } = setup();
    const key = (k, extra = {}) => {
      let prevented = false;
      const handled = playback.handleKey({ key: k, shiftKey: false, preventDefault: () => (prevented = true), ...extra }, extra.options);
      return { handled, prevented };
    };
    playback.seek(60000);
    assert.deepEqual(key(" "), { handled: true, prevented: true });
    assert.equal(store.getState().playing, true);
    key(" ");
    assert.equal(store.getState().playing, false);
    key(",");
    assert.equal(store.getState().clock_s, 59700);
    key(".", { shiftKey: true });
    assert.equal(store.getState().clock_s, 63300);
    key(">");
    assert.equal(store.getState().clock_s, 66900);
    key("<");
    assert.equal(store.getState().clock_s, 63300);
    key("]");
    assert.equal(store.getState().speed, 3600);
    key("[");
    assert.equal(store.getState().speed, 900);
    assert.deepEqual(key("ArrowRight"), { handled: false, prevented: false });
    assert.equal(store.getState().clock_s, 63300);
    key("ArrowRight", { options: { arrows: true } });
    assert.equal(store.getState().clock_s, 63600);
    key("ArrowLeft", { shiftKey: true, options: { arrows: true } });
    assert.equal(store.getState().clock_s, 60000);
    assert.equal(key(".", { ctrlKey: true }).handled, false);
    let listed = 0;
    key("?", { options: { onShortcuts: () => (listed += 1) } });
    assert.equal(listed, 1);
  });
});

describe("reduced motion", () => {
  test("seek lands on the snapshot grid and the frame is never interpolated", () => {
    const { store, playback } = setup({ reduced: true });
    playback.seek(66650);
    assert.equal(store.getState().clock_s, 66600);
    const frame = playback.frame();
    assert.equal(frame.interpolated, false);
    assert.deepEqual(frame.cars, payload.log.snapshots[162].cars);
  });

  test("the in-app override wins: turning reduced motion off restores interpolation", () => {
    const { store, playback } = setup({ reduced: true });
    store.dispatch({ type: "motion/override", value: false });
    playback.seek(66650);
    assert.equal(store.getState().clock_s, 66650);
    assert.equal(playback.frame().interpolated, true);
  });

  test("play advances one 5-minute step per real second, whatever the speed", () => {
    const { store, playback, scheduler } = setup({ reduced: true });
    store.dispatch({ type: "clock/set", clock_s: 60050 }); // off the grid, as a mode switch can leave it
    playback.setSpeed(3600);
    playback.play();
    assert.equal(store.getState().clock_s, 60000, "play first lands on the grid");
    scheduler.flush(0);
    scheduler.flush(500);
    assert.equal(store.getState().clock_s, 60000);
    scheduler.flush(1000);
    assert.equal(store.getState().clock_s, 60300);
    scheduler.flush(1999);
    assert.equal(store.getState().clock_s, 60300);
    scheduler.flush(2000);
    assert.equal(store.getState().clock_s, 60600);
    scheduler.flush(9000); // a long gap still moves one step, never several
    assert.equal(store.getState().clock_s, 60900);
  });

  test("steps move between grid seconds from an off-grid clock", () => {
    const { store, playback } = setup({ reduced: true });
    store.dispatch({ type: "clock/set", clock_s: 66650 });
    playback.step("5min", -1);
    assert.equal(store.getState().clock_s, 66600);
    store.dispatch({ type: "clock/set", clock_s: 66650 });
    playback.step("5min", 1);
    assert.equal(store.getState().clock_s, 66900);
    playback.step("1h", 1);
    assert.equal(store.getState().clock_s, 70500);
  });

  test("no autoplay with reduced motion; autoplay works with full motion", () => {
    const reduced = setup({ reduced: true });
    assert.equal(reduced.playback.autoplay(), false);
    assert.equal(reduced.store.getState().playing, false);
    const full = setup();
    assert.equal(full.playback.autoplay(), true);
    assert.equal(full.store.getState().playing, true);
  });
});

describe("the slow-device fallback", () => {
  const playFrames = (scheduler, count, spacing, start = 0) => {
    for (let i = 0; i <= count; i += 1) scheduler.flush(start + i * spacing);
    return start + count * spacing;
  };

  test(`frames averaging above ${SLOW_FRAME_MS} ms for ${SLOW_SPAN_MS / 1000} s switch to 5-minute drawing`, () => {
    const { playback, scheduler } = setup();
    let changes = 0;
    playback.onChange(() => (changes += 1));
    playback.seek(30000);
    playback.setSpeed(60);
    playback.play();
    // 59 frames of 50 ms span 2,950 ms: not yet 3 s.
    const end = playFrames(scheduler, 59, 50);
    assert.equal(playback.simplified, false);
    scheduler.flush(end + 50); // 3,000 ms at 50 ms each
    assert.equal(playback.simplified, true);
    assert.equal(changes, 1);
    assert.equal(playback.frame().interpolated, false);
  });

  test("frames at 40 ms or faster never switch, and a gap resets the measurement", () => {
    const { playback, scheduler } = setup();
    playback.seek(30000);
    playback.setSpeed(60);
    playback.play();
    playFrames(scheduler, 200, 40);
    assert.equal(playback.simplified, false);
    const { playback: other, scheduler: s2 } = setup();
    other.seek(30000);
    other.setSpeed(60);
    other.play();
    const end = playFrames(s2, 40, 60); // 2,400 ms of slow frames
    s2.flush(end + MAX_FRAME_GAP_MS + 1); // a gap
    playFrames(s2, 40, 60, end + MAX_FRAME_GAP_MS + 1); // another 2,400 ms: never 3 s in a row
    assert.equal(other.simplified, false);
  });

  test("Use full drawing turns the fallback off for good", () => {
    const { playback, scheduler } = setup();
    playback.seek(30000);
    playback.setSpeed(60);
    playback.play();
    const end = playFrames(scheduler, 70, 50);
    assert.equal(playback.simplified, true);
    playback.useFullDrawing();
    assert.equal(playback.simplified, false);
    playFrames(scheduler, 200, 50, end + 50);
    assert.equal(playback.simplified, false);
    assert.equal(playback.frame().interpolated, true);
  });
});

describe("the transport region", () => {
  function mount(options) {
    const env = setup(options);
    const region = document.createElement("section");
    document.body.appendChild(region);
    const transport = renderTransport(region, env);
    return { ...env, region, transport };
  }
  const buttonByText = (region, text) => region.querySelectorAll("button").find((b) => b.textContent === text);

  test("scrubber bounds span the window with the warm-up shaded and labelled", () => {
    const scenario = presetScenario();
    const bounds = scrubberBounds(scenario);
    // Window D1 05:00 to D2 10:00: 18,000 to 122,400 s; warm-up ends 21,600, so 3,600 / 104,400 of the track.
    assert.deepEqual(bounds, { min: 18000, max: 122400, step: 300, warmup: { start_s: 18000, end_s: 21600, fraction: 3600 / 104400 } });
    // D1 06 (21,600 s) sits 1 h after the window start, closer than the 2 h clearance, so its label would meet D1 05.
    assert.deepEqual(scrubberTicks(scenario), [18000, 43200, 64800, 86400, 108000, 122400]);
    const { region } = mount();
    const range = region.querySelector('input[type="range"]');
    assert.equal(range.getAttribute("min"), "18000");
    assert.equal(range.getAttribute("max"), "122400");
    assert.equal(range.getAttribute("step"), "300");
    assert.equal(range.getAttribute("aria-label"), labels.PLAYBACK.scrubber);
    assert.equal(range.value, "18000");
    assert.equal(range.getAttribute("aria-valuetext"), "D1 05:00");
    // The warm-up band is inside the scrubber: a sibling behind the range input in one track box, never below it.
    const band = region.querySelector('[data-role="warmup-band"]');
    assert.equal(band.getAttribute("class"), "fl-scrubber__band");
    assert.equal(band.getAttribute("aria-hidden"), "true");
    assert.equal(band.parentNode, range.parentNode, "the band and the input share the track box");
    assert.equal(range.parentNode.getAttribute("class"), "fl-scrubber");
    assert.equal(range.getAttribute("class"), "fl-scrubber__input");
    assert.equal(band.style.getPropertyValue("--warmup"), String(3600 / 104400));
    assert.equal(region.querySelector("svg"), null, "no separate warm-up drawing under the slider");
    assert.equal(region.querySelector('[data-role="warmup"]').textContent, labels.REGISTERS.warmUp);
    const tickNodes = region.querySelectorAll('[data-role="ticks"] span');
    assert.deepEqual(tickNodes.map((s) => s.textContent), ["D1 05", "D1 12", "D1 18", "D2 00", "D2 06", "D2 10"]);
    assert.equal(region.querySelector('[data-role="ticks"]').getAttribute("class"), "fl-small-label fl-mono fl-scrubber__ticks");
    // Ends align with the track ends; D2 06 is 4 h from the end, so a phone hides it.
    assert.equal(tickNodes[0].style.left, "0");
    assert.equal(tickNodes.at(-1).style.right, "0");
    assert.deepEqual(tickNodes.map((s) => s.hasAttribute("data-near-edge")), [false, false, false, false, true, false]);
    for (const tick of tickNodes.slice(1, -1)) assert.equal(tick.style.transform, "translateX(-50%)");
  });

  test("scrubber ticks keep 2 h from both ends in every preset, so no inner label meets an end label", () => {
    for (const preset of PRESETS) {
      const ticks = scrubberTicks(preset.scenario);
      const { start_s, end_s } = preset.scenario.window;
      assert.equal(ticks[0], start_s, preset.id);
      assert.equal(ticks.at(-1), end_s, preset.id);
      for (const t of ticks.slice(1, -1)) {
        assert.equal(t % 21600, 0, `${preset.id} ${String(t)} is a 6-hour boundary`);
        assert.ok(t - start_s >= 7200 && end_s - t >= 7200, `${preset.id} ${String(t)} clears both ends`);
      }
    }
    // The CSS keeps tick labels on one line (an absolute span sized to its text) and hides near-edge ticks below 768 px.
    const css = readFileSync(new URL("../styles.css", import.meta.url), "utf8");
    assert.match(css, /\.fl-scrubber__ticks > span \{[^}]*width: max-content/);
    assert.match(css, /@media \(max-width: 767\.98px\) \{\s*\.fl-scrubber__ticks > \[data-near-edge\] \{ display: none; \}/);
  });

  test("controls dispatch through the controller and the clock text follows the store", () => {
    const { region, store } = mount();
    const clock = region.querySelector(".fl-clock");
    assert.equal(clock.textContent, "D1 05:00");
    const range = region.querySelector('input[type="range"]');
    range.value = "66600";
    range.dispatchEvent(new Event("input", { bubbles: true }));
    assert.equal(store.getState().clock_s, 66600);
    assert.equal(clock.textContent, "D1 18:30");
    buttonByText(region, labels.PLAYBACK.forwardHour).click();
    assert.equal(clock.textContent, "D1 19:30");
    buttonByText(region, labels.PLAYBACK.back5).click();
    assert.equal(store.getState().clock_s, 69900);
    buttonByText(region, labels.PLAYBACK.jumps.pm_peak).click();
    assert.equal(store.getState().clock_s, 57600);
    buttonByText(region, labels.speedText(300)).click();
    assert.equal(store.getState().speed, 300);
    const pressed = region.querySelectorAll("button[data-speed]").filter((b) => b.getAttribute("aria-pressed") === "true");
    assert.deepEqual(pressed.map((b) => b.textContent), [labels.speedText(300)]);
    const play = buttonByText(region, labels.PLAYBACK.play);
    play.click();
    assert.equal(play.textContent, labels.PLAYBACK.pause);
    assert.equal(play.getAttribute("aria-pressed"), "true");
  });

  test("keyboard shortcuts work while the transport has focus, and arrows step time there", () => {
    const { region, store } = mount();
    const forward = buttonByText(region, labels.PLAYBACK.forward5);
    forward.focus();
    forward.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowRight", bubbles: true, cancelable: true }));
    assert.equal(store.getState().clock_s, 18300);
    forward.dispatchEvent(new KeyboardEvent("keydown", { key: ".", shiftKey: true, bubbles: true, cancelable: true }));
    assert.equal(store.getState().clock_s, 21900);
    const range = region.querySelector('input[type="range"]');
    range.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowRight", bubbles: true, cancelable: true }));
    assert.equal(store.getState().clock_s, 21900, "the range input steps itself, so the transport does not");
    const list = region.querySelector("#fleetlab-shortcuts");
    assert.equal(list.hidden, true);
    forward.dispatchEvent(new KeyboardEvent("keydown", { key: "?", bubbles: true, cancelable: true }));
    assert.equal(list.hidden, false);
    assert.deepEqual(list.querySelectorAll("li").map((li) => li.textContent), [...labels.PLAYBACK.shortcutList, labels.PLAYBACK.shortcutsScope]);
    // A key pressed outside the transport does nothing.
    document.body.dispatchEvent(new KeyboardEvent("keydown", { key: ".", bubbles: true, cancelable: true }));
    assert.equal(store.getState().clock_s, 21900);
  });

  test("before a run the time controls are disabled", () => {
    const { region } = mount({ withLog: false });
    assert.equal(buttonByText(region, labels.PLAYBACK.play).disabled, true);
    assert.equal(region.querySelector('input[type="range"]').disabled, true);
    assert.equal(buttonByText(region, labels.speedText(900)).disabled, false);
  });

  test("the slow-device notice shows both labels and its button returns to full drawing", () => {
    const { region, playback, scheduler } = mount();
    const notice = region.querySelector('[data-role="slow-device"]');
    assert.equal(notice.hidden, true);
    playback.seek(30000);
    playback.setSpeed(60);
    playback.play();
    for (let i = 0; i <= 70; i += 1) scheduler.flush(i * 50);
    assert.equal(notice.hidden, false);
    assert.deepEqual(notice.children.map((n) => n.textContent), [labels.STATES.simplifiedDrawing, labels.STATES.useFullDrawing]);
    notice.querySelector("button").click();
    assert.equal(notice.hidden, true);
    assert.equal(playback.simplified, false);
  });

  test("destroy drops the transport's store subscription and key listeners", () => {
    const { region, store, transport } = mount();
    const clock = region.querySelector(".fl-clock");
    const forward = buttonByText(region, labels.PLAYBACK.forward5);
    const press = (key) => forward.dispatchEvent(new KeyboardEvent("keydown", { key, bubbles: true, cancelable: true }));
    press(".");
    assert.equal(store.getState().clock_s, 18300, "before destroy a shortcut on the transport steps the clock");
    assert.equal(clock.textContent, "D1 05:05");
    transport.destroy();
    press(".");
    assert.equal(store.getState().clock_s, 18300, "a shortcut on a destroyed transport steps nothing");
    store.dispatch({ type: "clock/set", clock_s: 40000 });
    assert.equal(clock.textContent, "D1 05:05", "a destroyed transport no longer follows the store");
  });
});

describe("boundaries", () => {
  test("playback imports no model or runtime module, so it cannot run the model", () => {
    const source = readFileSync(new URL("../src/ui/playback.js", import.meta.url), "utf8");
    const imports = [...source.matchAll(/^import .* from "([^"]+)";$/gm)].map((m) => m[1]);
    assert.deepEqual(imports.sort(), ["./dom.js", "./format.js", "./labels.js", "./store.js"]);
  });
});
