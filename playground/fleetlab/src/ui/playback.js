// Playback over a run_window log (design §7.4, §7.7, contract 6.4 and 8). Run first, then replay: this module only reads
// the log the engine already computed. It never runs the model, and scrubbing never recomputes anything.
//
// Seeking finds the nearest earlier 300-second snapshot. With full motion a car on a leg is placed by linear
// interpolation from the leg's own start and end seconds, which gives exactly the snapshot's done_permille at the
// snapshot second. Interpolation never invents a state change: a car whose leg ends before the next snapshot waits at
// done_permille 1000 until that snapshot. With reduced motion (or the slow-device fallback) nothing is interpolated:
// cars jump between 5-minute snapshots.
//
// The clock lives in the store (`clock_s`, `playing`, `speed`); this controller dispatches store actions and drives a
// frame loop on an injectable scheduler, so tests control every frame.

import { el, setText } from "./dom.js";
import * as format from "./format.js";
import { PLAYBACK, REGISTERS, STATES, speedText } from "./labels.js";
import { SPEEDS, isReducedMotion } from "./store.js";

/** Seconds between playback snapshots (contract 6.4). */
export const SNAPSHOT_STEP_S = 300;

/** Frames averaging above this many milliseconds switch to simplified drawing (design §7.7). */
export const SLOW_FRAME_MS = 40;

/** How long, in real milliseconds, frames must average above SLOW_FRAME_MS before the switch. */
export const SLOW_SPAN_MS = 3000;

/** Real milliseconds per 5-minute step while playing with reduced motion (design §7.4). */
export const REDUCED_STEP_REAL_MS = 1000;

/**
 * A gap between two frames longer than this many milliseconds (a hidden tab, a paused debugger) is not a slow frame:
 * it resets the slow-device measurement and advances the clock by at most this much real time.
 */
export const MAX_FRAME_GAP_MS = 250;

/** Jump targets in store order (design §7.4). */
export const JUMPS = Object.freeze(["am_peak", "pm_peak", "d2_first_wave"]);

/** Index of the last snapshot at or before `clock_s` (0 when the clock is before the first one); integer seconds. */
export function snapshotIndex(log, clock_s) {
  const snaps = log.snapshots;
  if (!Array.isArray(snaps) || snaps.length === 0) throw new Error("a playback log needs snapshots");
  let lo = 0;
  let hi = snaps.length - 1;
  if (clock_s <= snaps[0].t) return 0;
  while (lo < hi) {
    const mid = Math.ceil((lo + hi) / 2);
    if (snaps[mid].t <= clock_s) lo = mid;
    else hi = mid - 1;
  }
  return lo;
}

/** Leg progress in per-mille at second `t_s` from the leg's start and end seconds, clamped to 0..1000. */
export function legPermille(leg, t_s) {
  if (leg.t1 <= leg.t0) return 1000;
  const permille = Math.floor(((t_s - leg.t0) * 1000) / (leg.t1 - leg.t0));
  return Math.min(1000, Math.max(0, permille));
}

/**
 * The frame to draw at `clock_s`: `{clock_s, snapshot_t, at_s, interpolated, cars, depots}`. `at_s` is the second the
 * positions describe (the clock with interpolation, the snapshot second without); each car keeps its snapshot fields,
 * and a car on a leg gets `leg.done_permille` at `at_s`.
 */
export function frameAt(log, clock_s, { interpolate = true } = {}) {
  const snap = log.snapshots[snapshotIndex(log, clock_s)];
  const at_s = interpolate ? Math.max(clock_s, snap.t) : snap.t;
  const cars = snap.cars.map((car) => {
    if (car.leg === undefined) return car;
    const done_permille = interpolate ? legPermille(car.leg, at_s) : car.leg.done_permille;
    return done_permille === car.leg.done_permille ? car : { ...car, leg: { ...car.leg, done_permille } };
  });
  return { clock_s, snapshot_t: snap.t, at_s, interpolated: interpolate, cars, depots: snap.depots };
}

/** The 5-minute grid second at or before `clock_s`, counted from the window start. */
export function gridFloor(window, clock_s) {
  return window.start_s + Math.floor((clock_s - window.start_s) / SNAPSHOT_STEP_S) * SNAPSHOT_STEP_S;
}

/** The 5-minute grid second at or after `clock_s`, counted from the window start. */
export function gridCeil(window, clock_s) {
  return window.start_s + Math.ceil((clock_s - window.start_s) / SNAPSHOT_STEP_S) * SNAPSHOT_STEP_S;
}

/** Scrubber geometry: `{min, max, step, warmup: {start_s, end_s, fraction}}` for a scenario window (seconds). */
export function scrubberBounds(scenario) {
  const { start_s, end_s } = scenario.window;
  const warmEnd = Math.min(end_s, Math.max(start_s, scenario.warmup_end_s));
  return {
    min: start_s,
    max: end_s,
    step: SNAPSHOT_STEP_S,
    warmup: { start_s, end_s: warmEnd, fraction: (warmEnd - start_s) / (end_s - start_s) },
  };
}

/** A 6-hour tick closer than this to the window start or end is left out, so its label never meets an end label. */
export const TICK_END_CLEARANCE_S = 7200;

/** A 6-hour tick this close to either end is marked near the edge; a phone hides it (its labels are closer together). */
export const TICK_NEAR_EDGE_S = 18000;

/**
 * Scrubber tick seconds: the window start, every 6-hour boundary inside it at least TICK_END_CLEARANCE_S from both ends,
 * and the window end, as the design §7.2 transport wireframe spaces them.
 */
export function scrubberTicks(scenario) {
  const { start_s, end_s } = scenario.window;
  const ticks = [start_s];
  for (let t = Math.ceil((start_s + 1) / 21600) * 21600; t < end_s; t += 21600) {
    if (t - start_s >= TICK_END_CLEARANCE_S && end_s - t >= TICK_END_CLEARANCE_S) ticks.push(t);
  }
  if (ticks[ticks.length - 1] !== end_s) ticks.push(end_s);
  return ticks;
}

/** The browser frame scheduler, read when a controller is made. */
function defaultScheduler() {
  const g = globalThis;
  if (typeof g.requestAnimationFrame !== "function") throw new Error("playback needs a frame scheduler");
  return { request: (cb) => g.requestAnimationFrame(cb), cancel: (id) => g.cancelAnimationFrame(id) };
}

/**
 * A playback controller over `store` (src/ui/store.js). `scheduler` is `{request(callback), cancel(id)}` whose
 * callbacks receive a millisecond timestamp (requestAnimationFrame by default). Returns the controller; see each
 * method's comment. The log and window come from the store's run and scenario.
 */
export function createPlayback({ store, scheduler = defaultScheduler() } = {}) {
  if (store === null || typeof store !== "object" || typeof store.dispatch !== "function") {
    throw new TypeError("createPlayback needs a store");
  }
  let frameId = null;
  let lastTs = null;
  let simCarry = 0;
  let realCarry = 0;
  let samples = [];
  let sampleSum = 0;
  let simplified = false;
  let fullChosen = false;
  const listeners = new Set();

  const state = () => store.getState();
  const log = () => state().run.log;
  const reduced = () => isReducedMotion(state());
  const notify = () => {
    for (const fn of [...listeners]) fn(controller);
  };
  const resetMeasure = () => {
    samples = [];
    sampleSum = 0;
  };

  const schedule = () => {
    if (frameId === null) frameId = scheduler.request(tick);
  };
  const stopLoop = () => {
    if (frameId !== null) scheduler.cancel(frameId);
    frameId = null;
    lastTs = null;
    simCarry = 0;
    realCarry = 0;
    resetMeasure();
  };

  /** Records one frame duration; switches to simplified drawing when frames average above the limit for the span. */
  function measure(dt) {
    if (fullChosen || simplified) return;
    samples.push(dt);
    sampleSum += dt;
    while (samples.length > 1 && sampleSum - samples[0] >= SLOW_SPAN_MS) sampleSum -= samples.shift();
    if (sampleSum >= SLOW_SPAN_MS && sampleSum / samples.length > SLOW_FRAME_MS) {
      simplified = true;
      resetMeasure();
      notify();
    }
  }

  function tick(ts) {
    frameId = null;
    const s = state();
    if (!s.playing || log() === null) {
      lastTs = null;
      return;
    }
    if (lastTs === null) {
      lastTs = ts;
      schedule();
      return;
    }
    const raw = Math.max(0, ts - lastTs);
    lastTs = ts;
    const dt = Math.min(raw, MAX_FRAME_GAP_MS);
    if (raw > MAX_FRAME_GAP_MS) resetMeasure();
    if (reduced()) {
      // One 5-minute step per real second, landing on the snapshot grid.
      realCarry = Math.min(realCarry + raw, REDUCED_STEP_REAL_MS);
      if (realCarry >= REDUCED_STEP_REAL_MS) {
        realCarry = 0;
        const target = gridFloor(s.scenario.window, s.clock_s) + SNAPSHOT_STEP_S;
        store.dispatch({ type: "clock/advance", seconds: target - s.clock_s });
      }
    } else {
      if (raw <= MAX_FRAME_GAP_MS) measure(raw);
      simCarry += (dt * s.speed) / 1000;
      const whole = Math.floor(simCarry);
      simCarry -= whole;
      if (whole > 0) store.dispatch({ type: "clock/advance", seconds: whole });
    }
    if (state().playing) schedule();
  }

  const unsubscribe = store.subscribe((s) => {
    if (s.playing && log() !== null) schedule();
    else if (!s.playing && (frameId !== null || lastTs !== null)) stopLoop();
  });

  const controller = {
    /** Seek to integer seconds `clock_s` (clamped by the store); reduced motion lands on the snapshot at or before it. */
    seek(clock_s) {
      const s = state();
      const target = reduced() ? gridFloor(s.scenario.window, clock_s) : Math.round(clock_s);
      store.dispatch({ type: "clock/set", clock_s: target });
    },
    /** Start playing; does nothing without a log. With reduced motion the clock first lands on the snapshot grid. */
    play() {
      if (log() === null) return;
      const s = state();
      if (reduced() && gridFloor(s.scenario.window, s.clock_s) !== s.clock_s) {
        store.dispatch({ type: "clock/set", clock_s: gridFloor(s.scenario.window, s.clock_s) });
      }
      store.dispatch({ type: "playback/play" });
    },
    /** Pause. */
    pause() {
      store.dispatch({ type: "playback/pause" });
    },
    /** Play or pause. */
    toggle() {
      if (state().playing) controller.pause();
      else controller.play();
    },
    /**
     * Start playing on the page's own initiative (a Learn moment, a verdict seed). Reduced motion never autoplays;
     * returns whether playback started.
     */
    autoplay() {
      if (reduced() || log() === null) return false;
      controller.play();
      return state().playing;
    },
    /** Set the speed in simulated seconds per real second: 60, 300, 900 or 3600. */
    setSpeed(speed) {
      store.dispatch({ type: "playback/speed", speed });
    },
    /** One speed up. */
    faster() {
      store.dispatch({ type: "playback/faster" });
    },
    /** One speed down. */
    slower() {
      store.dispatch({ type: "playback/slower" });
    },
    /** Step `unit` ("5min" or "1h") in `direction` 1 or -1; reduced motion moves between snapshot grid seconds. */
    step(unit, direction) {
      const s = state();
      if (!reduced()) {
        store.dispatch({ type: "clock/step", unit, direction });
        return;
      }
      const size = unit === "1h" ? 3600 : unit === "5min" ? SNAPSHOT_STEP_S : null;
      if (size === null) throw new TypeError(`unknown step ${String(unit)}`);
      if (direction !== 1 && direction !== -1) throw new TypeError("step direction is 1 or -1");
      const w = s.scenario.window;
      const target = direction > 0 ? gridFloor(w, s.clock_s) + size : gridCeil(w, s.clock_s) - size;
      // Tagged as a step, so the live region speaks it as design §7.7 asks; an untagged clock/set is a scrub and stays silent.
      store.dispatch({ type: "clock/set", clock_s: target, reason: "step" });
    },
    /** Jump to `am_peak`, `pm_peak` or `d2_first_wave` (the peak windows of the scenario). */
    jump(target) {
      if (!JUMPS.includes(target)) throw new TypeError(`unknown jump ${String(target)}`);
      store.dispatch({ type: "clock/jump", target });
    },
    /** The frame to draw now, or null before a run (see frameAt). */
    frame() {
      const current = log();
      if (current === null) return null;
      return frameAt(current, state().clock_s, { interpolate: !reduced() && !simplified });
    },
    /** Whether the slow-device fallback is on. */
    get simplified() {
      return simplified;
    },
    /** Leave the slow-device fallback; it does not switch on again for this controller. */
    useFullDrawing() {
      fullChosen = true;
      if (!simplified) return;
      simplified = false;
      notify();
    },
    /**
     * Handle a playback shortcut (design §7.7) from a keydown event; returns true and prevents the default when handled.
     * `arrows` lets ArrowLeft and ArrowRight step time (only the transport and timeline pass it). `?` calls
     * `onShortcuts` when given. Modifier chords with Control, Meta or Alt are never handled.
     */
    handleKey(event, { arrows = false, onShortcuts = null } = {}) {
      if (event.ctrlKey || event.metaKey || event.altKey) return false;
      const key = event.key;
      let done = true;
      if (key === " " || key === "Spacebar") controller.toggle();
      else if (key === "," || key === "<") controller.step(event.shiftKey || key === "<" ? "1h" : "5min", -1);
      else if (key === "." || key === ">") controller.step(event.shiftKey || key === ">" ? "1h" : "5min", 1);
      else if (key === "[") controller.slower();
      else if (key === "]") controller.faster();
      else if (arrows && key === "ArrowLeft") controller.step(event.shiftKey ? "1h" : "5min", -1);
      else if (arrows && key === "ArrowRight") controller.step(event.shiftKey ? "1h" : "5min", 1);
      else if (key === "?" && typeof onShortcuts === "function") onShortcuts();
      else done = false;
      if (done && typeof event.preventDefault === "function") event.preventDefault();
      return done;
    },
    /** Subscribe to controller changes (the slow-device switch); returns an unsubscribe function. */
    onChange(fn) {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },
    /** Stop the frame loop and detach from the store. */
    destroy() {
      stopLoop();
      unsubscribe();
      listeners.clear();
    },
  };
  if (state().playing && log() !== null) schedule();
  return controller;
}


/**
 * Renders the transport region (design §7.4): clock, play and pause, steps, speeds, jumps, the scrubber with the
 * warm-up shaded, the shortcut list and the slow-device notice. Returns `{update, destroy}`; it follows the store and
 * the controller by itself.
 */
export function renderTransport(region, { store, playback }) {
  const clockText = el("span", { class: "fl-clock", role: "timer", "aria-label": PLAYBACK.clock }, "");
  const button = (text, onClick, attrs = {}) => el("button", { type: "button", class: "fl-button", ...attrs, on: { click: onClick } }, text);

  const backHour = button(PLAYBACK.backHour, () => playback.step("1h", -1));
  const back5 = button(PLAYBACK.back5, () => playback.step("5min", -1));
  const playButton = button(PLAYBACK.play, () => playback.toggle(), { "aria-pressed": "false" });
  const forward5 = button(PLAYBACK.forward5, () => playback.step("5min", 1));
  const forwardHour = button(PLAYBACK.forwardHour, () => playback.step("1h", 1));

  const speedButtons = SPEEDS.map((speed) => button(speedText(speed), () => playback.setSpeed(speed), { "data-speed": speed, "aria-pressed": "false" }));
  const speeds = el("div", { role: "group", "aria-label": PLAYBACK.speed }, speedButtons);

  const jumpButtons = JUMPS.map((target) => button(PLAYBACK.jumps[target], () => playback.jump(target), { "data-jump": target }));
  const jumps = el("div", { role: "group", "aria-label": PLAYBACK.jumpsName }, jumpButtons);

  const scrubber = el("input", {
    type: "range",
    class: "fl-scrubber__input",
    "aria-label": PLAYBACK.scrubber,
    on: { input: (event) => playback.seek(Number(event.target.value)) },
  });
  // The warm-up band sits behind the input's transparent track, so the shading is inside the scrubber (design §7.4).
  const warmupBand = el("span", { class: "fl-scrubber__band", "aria-hidden": "true", "data-role": "warmup-band" });
  const track = el("div", { class: "fl-scrubber" }, [warmupBand, scrubber]);
  const warmupLabel = el("span", { class: "fl-small-label", "data-role": "warmup" }, REGISTERS.warmUp);
  const ticks = el("div", { class: "fl-small-label fl-mono fl-scrubber__ticks", "aria-hidden": "true", "data-role": "ticks" });
  const scrub = el("div", { "data-role": "scrubber" }, [track, warmupLabel, ticks]);
  scrub.style.flex = "1 1 100%";
  scrub.style.minWidth = "0";

  const shortcutList = el("ul", { id: "fleetlab-shortcuts", class: "fl-popover", "data-open": "false" }, [
    ...PLAYBACK.shortcutList.map((line) => el("li", {}, line)),
    el("li", { class: "fl-muted" }, PLAYBACK.shortcutsScope),
  ]);
  shortcutList.hidden = true;
  shortcutList.setAttribute("inert", "");
  const setShortcuts = (open) => {
    shortcutList.hidden = !open;
    shortcutList.toggleAttribute("inert", !open);
    shortcutList.setAttribute("data-open", open ? "true" : "false");
    shortcutsButton.setAttribute("aria-expanded", open ? "true" : "false");
  };
  const shortcutsButton = button(PLAYBACK.shortcuts, () => setShortcuts(shortcutList.hidden), {
    "aria-expanded": "false",
    "aria-controls": "fleetlab-shortcuts",
  });

  const slowText = el("span", {}, STATES.simplifiedDrawing);
  const slowButton = button(STATES.useFullDrawing, () => playback.useFullDrawing());
  const slowNotice = el("p", { "data-role": "slow-device" }, [slowText, slowButton]);
  slowNotice.hidden = true;

  region.replaceChildren(clockText, backHour, back5, playButton, forward5, forwardHour, speeds, jumps, shortcutsButton, scrub, slowNotice, shortcutList);

  const onKeydown = (event) => {
    const target = event.target;
    // A range input steps itself with arrow keys, so the transport does not step a second time.
    const arrows = !(target && target.localName === "input");
    const handled = playback.handleKey(event, { arrows, onShortcuts: () => setShortcuts(true) });
    if (!handled && event.key === "Escape" && !shortcutList.hidden) {
      setShortcuts(false);
      shortcutsButton.focus();
    }
  };
  // Space activates a focused button on keyup; the keydown handler already played or paused, so keyup is swallowed.
  const onKeyup = (event) => {
    if ((event.key === " " || event.key === "Spacebar") && typeof event.preventDefault === "function") event.preventDefault();
  };
  region.addEventListener("keydown", onKeydown);
  region.addEventListener("keyup", onKeyup);

  let scenarioSeen = null;
  function layoutScrubber(scenario) {
    const bounds = scrubberBounds(scenario);
    scrubber.setAttribute("min", String(bounds.min));
    scrubber.setAttribute("max", String(bounds.max));
    scrubber.setAttribute("step", String(bounds.step));
    warmupBand.style.setProperty("--warmup", String(bounds.warmup.fraction));
    ticks.replaceChildren(
      ...scrubberTicks(scenario).map((t) => {
        const edge = t === bounds.min || t === bounds.max;
        const nearEdge = !edge && Math.min(t - bounds.min, bounds.max - t) < TICK_NEAR_EDGE_S;
        const tick = el("span", { "data-t": t, "data-near-edge": nearEdge }, format.clockHour(t));
        const fraction = (t - bounds.min) / (bounds.max - bounds.min);
        // Ends align with the track ends; an inner tick centres on the thumb centre at its second (a 16 px thumb).
        if (t === bounds.min) tick.style.left = "0";
        else if (t === bounds.max) tick.style.right = "0";
        else {
          tick.style.left = `calc(8px + (100% - 16px) * ${String(Math.round(fraction * 10000) / 10000)})`;
          tick.style.transform = "translateX(-50%)";
        }
        return tick;
      }),
    );
  }

  function update() {
    const s = store.getState();
    if (s.scenario !== scenarioSeen) {
      scenarioSeen = s.scenario;
      layoutScrubber(s.scenario);
    }
    const hasLog = s.run.log !== null;
    setText(clockText, format.clock(s.clock_s));
    setText(playButton, s.playing ? PLAYBACK.pause : PLAYBACK.play);
    playButton.setAttribute("aria-pressed", s.playing ? "true" : "false");
    for (const control of [backHour, back5, playButton, forward5, forwardHour, scrubber, ...jumpButtons]) control.disabled = !hasLog;
    for (const b of speedButtons) b.setAttribute("aria-pressed", Number(b.getAttribute("data-speed")) === s.speed ? "true" : "false");
    const value = String(s.clock_s);
    if (scrubber.value !== value) scrubber.value = value;
    scrubber.setAttribute("aria-valuetext", format.clock(s.clock_s));
    slowNotice.hidden = !playback.simplified;
  }

  const unsubscribeStore = store.subscribe(update);
  const unsubscribePlayback = playback.onChange(update);
  update();
  return {
    update,
    destroy() {
      unsubscribeStore();
      unsubscribePlayback();
      region.removeEventListener("keydown", onKeydown);
      region.removeEventListener("keyup", onKeyup);
    },
  };
}
