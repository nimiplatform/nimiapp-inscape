// W-c01 — ULID id generator.
//
// Crockford base32 alphabet without I, L, O, U. 26 characters: first
// 10 encode the millisecond timestamp, last 16 encode randomness.
// Monotonic within the same millisecond: subsequent calls in the same
// ms increment the random tail so generated ids remain lexicographically
// sorted in monotonic call order.
//
// No external dependency. Uses Web Crypto when available for the
// random tail; falls back to a deterministic pseudo-random source so
// the generator never throws.

const ENCODING = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
const ENCODING_LEN = ENCODING.length; // 32
const TIME_LEN = 10;
const RANDOM_LEN = 16;
const ULID_LEN = TIME_LEN + RANDOM_LEN;
const MAX_TIME = 2 ** 48 - 1;

interface UlidCryptoLike {
  readonly getRandomValues: (out: Uint8Array) => Uint8Array;
}

function pickCrypto(): UlidCryptoLike | null {
  const candidate = (globalThis as { crypto?: UlidCryptoLike }).crypto;
  if (candidate && typeof candidate.getRandomValues === 'function') {
    return candidate;
  }
  return null;
}

let fallbackCounter = 0;

function fallbackRandomBytes(out: Uint8Array): Uint8Array {
  // Deterministic-but-mixing fallback: XOR a 64-bit Lehmer-style
  // counter into each byte. Output is NOT cryptographically secure;
  // it exists to keep the generator monotonic when Web Crypto is
  // absent (Node REPL without --experimental-webcrypto, etc.).
  for (let i = 0; i < out.length; i += 1) {
    fallbackCounter = (fallbackCounter * 48271 + 1) >>> 0;
    out[i] = fallbackCounter & 0xff;
  }
  return out;
}

function getRandomBytes(out: Uint8Array): Uint8Array {
  const cryptoLike = pickCrypto();
  if (cryptoLike) return cryptoLike.getRandomValues(out);
  return fallbackRandomBytes(out);
}

function encodeTime(ms: number): string {
  if (!Number.isFinite(ms) || ms < 0 || ms > MAX_TIME) {
    throw new Error(`ulid time out of range: ${ms}`);
  }
  let value = Math.floor(ms);
  const out = new Array<string>(TIME_LEN);
  for (let i = TIME_LEN - 1; i >= 0; i -= 1) {
    const mod = value % ENCODING_LEN;
    out[i] = ENCODING.charAt(mod);
    value = (value - mod) / ENCODING_LEN;
  }
  return out.join('');
}

function encodeRandomFromBytes(bytes: Uint8Array): string {
  // Pack the random bytes into a base32 string by repeatedly reading
  // 5-bit chunks from a big-endian buffer.
  const out = new Array<string>(RANDOM_LEN);
  let bitBuffer = 0;
  let bitCount = 0;
  let byteIdx = 0;
  for (let i = 0; i < RANDOM_LEN; i += 1) {
    while (bitCount < 5 && byteIdx < bytes.length) {
      bitBuffer = (bitBuffer << 8) | bytes[byteIdx]!;
      bitCount += 8;
      byteIdx += 1;
    }
    const shift = bitCount - 5;
    const chunk = (bitBuffer >> shift) & 0x1f;
    bitBuffer &= (1 << shift) - 1;
    bitCount -= 5;
    out[i] = ENCODING.charAt(chunk);
  }
  return out.join('');
}

function bumpEncodedRandom(encoded: string): string {
  // Treat the random suffix as a base32 number and add 1; carry into
  // higher digits as needed. Wraps to all-zero if the entire tail is
  // 'Z' — which only happens after 32^16 increments inside one
  // millisecond, vastly outside realistic use.
  const chars = encoded.split('');
  for (let i = chars.length - 1; i >= 0; i -= 1) {
    const idx = ENCODING.indexOf(chars[i]!);
    if (idx < ENCODING_LEN - 1) {
      chars[i] = ENCODING.charAt(idx + 1);
      return chars.join('');
    }
    chars[i] = '0';
  }
  return chars.join('');
}

let lastTime = -1;
let lastRandom = '';

export interface NewUlidOptions {
  readonly now?: Date;
}

export function newUlid(options: NewUlidOptions = {}): string {
  const now = options.now ?? new Date();
  if (!(now instanceof Date)) {
    throw new Error('newUlid: options.now must be a Date when provided');
  }
  const ms = now.getTime();
  if (!Number.isFinite(ms)) {
    throw new Error('newUlid: options.now is not a valid Date');
  }
  let randomEncoded: string;
  if (ms === lastTime && lastRandom.length === RANDOM_LEN) {
    randomEncoded = bumpEncodedRandom(lastRandom);
  } else {
    const bytes = new Uint8Array(10);
    getRandomBytes(bytes);
    randomEncoded = encodeRandomFromBytes(bytes);
  }
  lastTime = ms;
  lastRandom = randomEncoded;
  return encodeTime(ms) + randomEncoded;
}

export const ULID_PATTERN = /^[0-9A-HJKMNP-TV-Z]{26}$/;
export const ULID_LENGTH = ULID_LEN;
export const ULID_ALPHABET = ENCODING;

export function isUlid(value: unknown): value is string {
  return typeof value === 'string' && ULID_PATTERN.test(value);
}
