// FleetLab's key function `_u64` (src/hermes/fleet/world.py), design P-2 and T-3.

import { prefixHasher, sha256, utf8Bytes } from "./sha256.js";

/** Describe a rejected key part without calling its own conversion methods. */
function describePart(part) {
  if (part === null) return "null";
  if (Array.isArray(part)) return "an array";
  if (typeof part === "number") return `the non-integer or unsafe number ${String(part)}`;
  return `a value of type ${typeof part}`;
}

/** Join key parts with "|" as Python `str(part)` would; parts must be strings or safe integers. */
export function keyString(parts) {
  if (!Array.isArray(parts)) throw new TypeError("keyString expects an array of key parts");
  const rendered = new Array(parts.length);
  for (let i = 0; i < parts.length; i++) {
    const part = parts[i];
    if (typeof part === "string") {
      rendered[i] = part;
    } else if (typeof part === "number" && Number.isSafeInteger(part)) {
      rendered[i] = String(part);
    } else {
      throw new TypeError(
        `key part ${i} must be a string or a safe integer, got ${describePart(part)}; ` +
          "fix it by passing integer engine units or text",
      );
    }
  }
  return rendered.join("|");
}

/** First 8 digest bytes as an unsigned 64-bit big-endian integer. */
function head64(digest) {
  const high = ((digest[0] << 24) | (digest[1] << 16) | (digest[2] << 8) | digest[3]) >>> 0;
  const low = ((digest[4] << 24) | (digest[5] << 16) | (digest[6] << 8) | digest[7]) >>> 0;
  return (BigInt(high) << 32n) | BigInt(low);
}

/** Unsigned 64-bit key value (BigInt, 0 to 2^64 - 1): first 8 bytes of SHA-256 of the key string. */
export function u64(...parts) {
  return head64(sha256(utf8Bytes(keyString(parts))));
}

/** Top 16 bits of `u64(...parts)`, an integer 0 to 65535. */
export function u16(...parts) {
  return Number(u64(...parts) >> 48n);
}

/** Top 32 bits of `u64(...parts)`, an integer 0 to 2^32 - 1. */
export function u32(...parts) {
  return Number(u64(...parts) >> 32n);
}

/** Returns `(...rest) => u64(...prefixParts, ...rest)` (BigInt) through a cached prefix hasher. */
export function keyedU64Source(...prefixParts) {
  const prefixText = prefixParts.length === 0 ? "" : `${keyString(prefixParts)}|`;
  const hasher = prefixHasher(prefixText);
  return (...rest) => {
    if (rest.length === 0) return u64(...prefixParts);
    return head64(hasher(keyString(rest)));
  };
}
