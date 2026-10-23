// Canonical JSON and the teaching-run spec digest (design section 6, "Spec digest and seed sets").

import { sha256Hex } from "./sha256.js";

/** True for an object literal or an object with a null prototype. */
function isPlainObject(value) {
  if (value === null || typeof value !== "object") return false;
  const proto = Object.getPrototypeOf(value);
  return proto === Object.prototype || proto === null;
}

/** Serialize one value; `path` names the location for error messages. */
function write(value, path) {
  if (value === null) return "null";
  if (typeof value === "boolean") return value ? "true" : "false";
  if (typeof value === "string") return JSON.stringify(value);
  if (typeof value === "number") {
    if (!Number.isSafeInteger(value) || Object.is(value, -0)) {
      throw new TypeError(
        `canonical JSON at ${path} holds ${String(Object.is(value, -0) ? "-0" : value)}; ` +
          "fix it by storing a safe integer in engine units",
      );
    }
    return String(value);
  }
  if (Array.isArray(value)) {
    const items = [];
    for (let i = 0; i < value.length; i++) {
      if (!(i in value)) throw new TypeError(`canonical JSON at ${path}[${i}] is a hole in the array`);
      items.push(write(value[i], `${path}[${i}]`));
    }
    return `[${items.join(",")}]`;
  }
  if (isPlainObject(value)) {
    const keys = Object.keys(value).sort();
    const members = keys.map((key) => `${JSON.stringify(key)}:${write(value[key], `${path}.${key}`)}`);
    return `{${members.join(",")}}`;
  }
  throw new TypeError(`canonical JSON at ${path} cannot hold a value of type ${typeof value}`);
}

/** Canonical JSON text: sorted keys, no whitespace, safe integers only; throws on anything else. */
export function canonicalJson(value) {
  return write(value, "$");
}

/** Lowercase hexadecimal SHA-256 (64 characters) of `canonicalJson(spec)` as UTF-8. */
export function specDigest(spec) {
  return sha256Hex(canonicalJson(spec));
}

/** The only displayed form of a spec digest: `playground-spec:` plus its first 8 hexadecimal characters. */
export function specHashLabel(digest) {
  if (typeof digest !== "string" || !/^[0-9a-f]{64}$/.test(digest)) {
    throw new TypeError("specHashLabel expects a 64-character lowercase hexadecimal digest");
  }
  return `playground-spec:${digest.slice(0, 8)}`;
}
