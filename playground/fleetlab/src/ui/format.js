// Number and time formatting for the interface. Deterministic: no locale APIs, ASCII digits, a comma for thousands,
// a period for decimals and a hyphen-minus for negatives, so tabular columns line up with `tabular-nums`.
// Absence is never 0, blank or a dash: it reads `not available: <reason>` (design H-5).

import { specHashLabel } from "../core/canon.js";
import { roundHalfEven } from "../core/stats.js";
import { absentValue, UNITS } from "./labels.js";

const DAY_S = 86400;

/** Throw unless `value` is a finite number. */
function finite(value, name) {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new TypeError(`${name} must be a finite number, got ${String(value)}`);
  }
}

/** Throw unless `digits` is an integer from 0 to 6 (the declared precision). */
function precision(digits) {
  if (!Number.isInteger(digits) || digits < 0 || digits > 6) {
    throw new RangeError(`precision must be an integer from 0 to 6, got ${String(digits)}`);
  }
}

/** Two-digit zero-padded integer. */
function two(n) {
  return n < 10 ? `0${String(n)}` : String(n);
}

/** Digits of a non-negative integer with a comma every three places. */
function grouped(integer) {
  const text = String(integer);
  let out = "";
  for (let i = 0; i < text.length; i++) {
    if (i > 0 && (text.length - i) % 3 === 0) out += ",";
    out += text[i];
  }
  return out;
}

/** Simulated clock `D1 18:30` from integer seconds since day 1 00:00 (seconds below a minute are dropped). */
export function clock(t_s) {
  finite(t_s, "clock seconds");
  if (t_s < 0) throw new RangeError("clock seconds must not be negative");
  const whole = Math.floor(t_s);
  const day = Math.floor(whole / DAY_S) + 1;
  const inDay = whole % DAY_S;
  return `D${String(day)} ${two(Math.floor(inDay / 3600))}:${two(Math.floor((inDay % 3600) / 60))}`;
}

/** Scrubber tick `D1 05` from seconds since day 1 00:00 (the hour the second falls in). */
export function clockHour(t_s) {
  finite(t_s, "clock seconds");
  if (t_s < 0) throw new RangeError("clock seconds must not be negative");
  const whole = Math.floor(t_s);
  return `D${String(Math.floor(whole / DAY_S) + 1)} ${two(Math.floor((whole % DAY_S) / 3600))}`;
}

/** Hour-of-day clock `16:00` from an integer hour 0 to 24 (24 closes a window at midnight). */
export function hourClock(hour) {
  if (!Number.isInteger(hour) || hour < 0 || hour > 24) throw new RangeError(`hour must be 0 to 24, got ${String(hour)}`);
  return `${two(hour)}:00`;
}

/** Session wall clock `14:02` from integer hours (0-23) and minutes (0-59) that the caller reads. */
export function sessionClock(hours, minutes) {
  if (!Number.isInteger(hours) || hours < 0 || hours > 23) throw new RangeError("hours must be 0 to 23");
  if (!Number.isInteger(minutes) || minutes < 0 || minutes > 59) throw new RangeError("minutes must be 0 to 59");
  return `${two(hours)}:${two(minutes)}`;
}

/**
 * A number with fixed decimals (default 0), thousands grouped, never `-0`. Rounds the exact decimal expansion of the
 * double half to even, as Python's `f"{x:.1f}"` does, so 0.15 at 1 digit is `0.1` and 2.675 at 2 digits is `2.67`.
 * Magnitudes from 1e21 up are refused (JavaScript switches to exponent notation there).
 */
export function number(value, digits = 0) {
  finite(value, "value");
  precision(digits);
  if (Math.abs(value) >= 1e21) throw new RangeError(`value must be below 1e21 in magnitude, got ${String(value)}`);
  const [integerPart, fractionPart] = Math.abs(value).toFixed(100).split(".");
  const kept = BigInt(integerPart + fractionPart.slice(0, digits));
  const rest = fractionPart.slice(digits);
  const up = rest[0] > "5" || (rest[0] === "5" && (/[1-9]/.test(rest.slice(1)) || kept % 2n === 1n));
  const scaled = kept + (up ? 1n : 0n);
  const unit = 10n ** BigInt(digits);
  let text = grouped(scaled / unit);
  if (digits > 0) text += `.${String(scaled % unit).padStart(digits, "0")}`;
  return value < 0 && scaled !== 0n ? `-${text}` : text;
}

/** A delta with an explicit sign: `+826.1`, `-25.5`, and `0.0` with no sign when it rounds to zero. */
export function signed(value, digits = 0) {
  const text = number(value, digits);
  if (text.startsWith("-")) return text;
  return /[1-9]/.test(text) ? `+${text}` : text;
}

/** An integer count with thousands grouped: `2,628`. */
export function count(value) {
  if (!Number.isSafeInteger(value)) throw new TypeError(`count must be a safe integer, got ${String(value)}`);
  return number(value, 0);
}

/** Duration in whole minutes (half to even): `77 min` from seconds. */
export function minutes(seconds) {
  finite(seconds, "seconds");
  return `${number(roundHalfEven(seconds / 60), 0)} ${UNITS.minutes}`;
}

/** Duration in hours and whole minutes: `2 h 20 min`, `2 h`, or `50 min` under an hour, from seconds. */
export function hoursMinutes(seconds) {
  finite(seconds, "seconds");
  if (seconds < 0) throw new RangeError("a duration must not be negative");
  const total = roundHalfEven(seconds / 60);
  const h = Math.floor(total / 60);
  const m = total % 60;
  if (h === 0) return `${String(m)} ${UNITS.minutes}`;
  if (m === 0) return `${String(h)} ${UNITS.hours}`;
  return `${String(h)} ${UNITS.hours} ${String(m)} ${UNITS.minutes}`;
}

/** Seconds with a declared precision: `30 s`, `2,628.2 s`. */
export function seconds(value, digits = 0) {
  return `${number(value, digits)} ${UNITS.seconds}`;
}

/** A fraction as a percentage with a declared precision: `percent(0.031, 1)` is `3.1%`. */
export function percent(fraction, digits) {
  finite(fraction, "fraction");
  precision(digits);
  return `${number(fraction * 100, digits)}${UNITS.percent}`;
}

/** A multiplier from per-mille: 1600 is `×1.6`, 1000 is `×1.0`, 1250 is `×1.25`. */
export function multiplier(permille) {
  if (!Number.isSafeInteger(permille) || permille < 0) throw new TypeError("multiplier expects non-negative integer per-mille");
  const whole = Math.floor(permille / 1000);
  let fraction = String(permille % 1000).padStart(3, "0").replace(/0+$/, "");
  if (fraction.length === 0) fraction = "0";
  return `${UNITS.times}${String(whole)}.${fraction}`;
}

/** The only displayed form of a spec digest: `playground-spec:` plus 8 characters. */
export function specLabel(digest) {
  return specHashLabel(digest);
}

/** Absent value text: `not available: <reason>`. */
export function absent(reason) {
  return absentValue(reason);
}

/**
 * A metric value as text: a finite number through `formatter`, or `{absent: reason}` as `not available: <reason>`.
 * Anything else throws, so a missing value can never render as 0, blank or a dash.
 */
export function valueText(value, formatter) {
  if (typeof value === "number" && Number.isFinite(value)) return formatter(value);
  if (value !== null && typeof value === "object" && typeof value.absent === "string") return absentValue(value.absent);
  throw new TypeError("a displayed value must be a finite number or {absent: reason}");
}
