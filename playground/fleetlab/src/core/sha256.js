// Synchronous SHA-256 (FIPS 180-4) over UTF-8 bytes, with a prefix hasher that caches whole blocks.
// Web Crypto is asynchronous, and keyed randomness needs a synchronous, exact hash (design P-2).

const K = new Int32Array([
  0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
  0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
  0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
  0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
  0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
  0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
  0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
  0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
]);

const IV = new Int32Array([
  0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19,
]);

/** Compress one 64-byte block of `block` at `offset` into the 8-word state `H` (32-bit words). */
function compress(H, block, offset, W) {
  for (let t = 0; t < 16; t++) {
    const o = offset + 4 * t;
    W[t] = (block[o] << 24) | (block[o + 1] << 16) | (block[o + 2] << 8) | block[o + 3];
  }
  for (let t = 16; t < 64; t++) {
    const w2 = W[t - 2];
    const w15 = W[t - 15];
    const s1 = ((w2 >>> 17) | (w2 << 15)) ^ ((w2 >>> 19) | (w2 << 13)) ^ (w2 >>> 10);
    const s0 = ((w15 >>> 7) | (w15 << 25)) ^ ((w15 >>> 18) | (w15 << 14)) ^ (w15 >>> 3);
    W[t] = (s1 + W[t - 7] + s0 + W[t - 16]) | 0;
  }
  let a = H[0];
  let b = H[1];
  let c = H[2];
  let d = H[3];
  let e = H[4];
  let f = H[5];
  let g = H[6];
  let h = H[7];
  for (let t = 0; t < 64; t++) {
    const sigma1 = ((e >>> 6) | (e << 26)) ^ ((e >>> 11) | (e << 21)) ^ ((e >>> 25) | (e << 7));
    const choose = (e & f) ^ (~e & g);
    const t1 = (h + sigma1 + choose + K[t] + W[t]) | 0;
    const sigma0 = ((a >>> 2) | (a << 30)) ^ ((a >>> 13) | (a << 19)) ^ ((a >>> 22) | (a << 10));
    const majority = (a & b) ^ (a & c) ^ (b & c);
    const t2 = (sigma0 + majority) | 0;
    h = g;
    g = f;
    f = e;
    e = (d + t1) | 0;
    d = c;
    c = b;
    b = a;
    a = (t1 + t2) | 0;
  }
  H[0] = (H[0] + a) | 0;
  H[1] = (H[1] + b) | 0;
  H[2] = (H[2] + c) | 0;
  H[3] = (H[3] + d) | 0;
  H[4] = (H[4] + e) | 0;
  H[5] = (H[5] + f) | 0;
  H[6] = (H[6] + g) | 0;
  H[7] = (H[7] + h) | 0;
}

/** Hash bytes `src[start, end)` into state `H`, then pad for a message of `totalLength` bytes. */
function finish(H, W, pad, src, start, end, totalLength) {
  let offset = start;
  for (; end - offset >= 64; offset += 64) compress(H, src, offset, W);
  const rest = end - offset;
  pad.fill(0);
  for (let k = 0; k < rest; k++) pad[k] = src[offset + k];
  pad[rest] = 0x80;
  const blocks = rest < 56 ? 1 : 2;
  const lengthOffset = blocks * 64 - 8;
  const bits = totalLength * 8;
  const high = Math.floor(bits / 4294967296);
  const low = bits >>> 0;
  pad[lengthOffset] = high >>> 24;
  pad[lengthOffset + 1] = high >>> 16;
  pad[lengthOffset + 2] = high >>> 8;
  pad[lengthOffset + 3] = high;
  pad[lengthOffset + 4] = low >>> 24;
  pad[lengthOffset + 5] = low >>> 16;
  pad[lengthOffset + 6] = low >>> 8;
  pad[lengthOffset + 7] = low;
  compress(H, pad, 0, W);
  if (blocks === 2) compress(H, pad, 64, W);
}

/** Write the 8-word state as 32 big-endian bytes. */
function stateBytes(H) {
  const out = new Uint8Array(32);
  for (let i = 0; i < 8; i++) {
    const word = H[i];
    out[4 * i] = word >>> 24;
    out[4 * i + 1] = word >>> 16;
    out[4 * i + 2] = word >>> 8;
    out[4 * i + 3] = word;
  }
  return out;
}

/** Encode `text` as UTF-8 into `buffer` at `offset`; returns bytes written. Lone surrogates become U+FFFD. */
function encodeUtf8Into(text, buffer, offset) {
  let at = offset;
  const length = text.length;
  for (let i = 0; i < length; i++) {
    let code = text.charCodeAt(i);
    if (code < 0x80) {
      buffer[at++] = code;
      continue;
    }
    if (code < 0x800) {
      buffer[at++] = 0xc0 | (code >> 6);
      buffer[at++] = 0x80 | (code & 0x3f);
      continue;
    }
    if (code >= 0xd800 && code <= 0xdfff) {
      const next = i + 1 < length ? text.charCodeAt(i + 1) : 0;
      if (code <= 0xdbff && next >= 0xdc00 && next <= 0xdfff) {
        code = 0x10000 + ((code - 0xd800) << 10) + (next - 0xdc00);
        i++;
        buffer[at++] = 0xf0 | (code >> 18);
        buffer[at++] = 0x80 | ((code >> 12) & 0x3f);
        buffer[at++] = 0x80 | ((code >> 6) & 0x3f);
        buffer[at++] = 0x80 | (code & 0x3f);
        continue;
      }
      code = 0xfffd;
    }
    buffer[at++] = 0xe0 | (code >> 12);
    buffer[at++] = 0x80 | ((code >> 6) & 0x3f);
    buffer[at++] = 0x80 | (code & 0x3f);
  }
  return at - offset;
}

/** UTF-8 bytes of `text` (lone surrogates become U+FFFD, as `TextEncoder` does). */
export function utf8Bytes(text) {
  if (typeof text !== "string") throw new TypeError("utf8Bytes expects a string");
  const buffer = new Uint8Array(text.length * 3);
  const written = encodeUtf8Into(text, buffer, 0);
  return buffer.slice(0, written);
}

/** SHA-256 digest (32 bytes) of `bytes`, synchronous, FIPS 180-4. */
export function sha256(bytes) {
  if (!(bytes instanceof Uint8Array)) throw new TypeError("sha256 expects a Uint8Array");
  const H = new Int32Array(IV);
  finish(H, new Int32Array(64), new Uint8Array(128), bytes, 0, bytes.length, bytes.length);
  return stateBytes(H);
}

/** Lowercase hexadecimal SHA-256 (64 characters) of the UTF-8 bytes of `text`. */
export function sha256Hex(text) {
  const digest = sha256(utf8Bytes(text));
  let hex = "";
  for (let i = 0; i < 32; i++) hex += (digest[i] < 16 ? "0" : "") + digest[i].toString(16);
  return hex;
}

/**
 * Returns `(suffix) => sha256(utf8(prefix + suffix))` (32 bytes). The state after every whole 64-byte
 * block of the prefix is computed once, so each call hashes only the prefix tail and the suffix.
 */
export function prefixHasher(prefix) {
  const prefixBytes = utf8Bytes(prefix);
  const cachedLength = prefixBytes.length - (prefixBytes.length % 64);
  const W = new Int32Array(64);
  const cached = new Int32Array(IV);
  for (let offset = 0; offset < cachedLength; offset += 64) compress(cached, prefixBytes, offset, W);
  const tail = prefixBytes.slice(cachedLength);
  const state = new Int32Array(8);
  const pad = new Uint8Array(128);
  let work = new Uint8Array(256);
  work.set(tail, 0);
  return (suffix) => {
    if (typeof suffix !== "string") throw new TypeError("prefixHasher suffix must be a string");
    const needed = tail.length + suffix.length * 3;
    if (work.length < needed) {
      work = new Uint8Array(needed * 2);
      work.set(tail, 0);
    }
    const end = tail.length + encodeUtf8Into(suffix, work, tail.length);
    state.set(cached);
    finish(state, W, pad, work, 0, end, cachedLength + end);
    return stateBytes(state);
  };
}
