/**
 * Small math / array helpers shared by every game.
 * Kept dependency-free so games can import freely.
 */

export const TAU = Math.PI * 2;

export const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);
export const lerp = (a, b, t) => a + (b - a) * t;
export const inverseLerp = (a, b, v) => (b === a ? 0 : (v - a) / (b - a));
export const remap = (v, a, b, c, d) => lerp(c, d, clamp(inverseLerp(a, b, v), 0, 1));

/** Random float in [min, max). */
export const rand = (min = 0, max = 1) => min + Math.random() * (max - min);
/** Random integer in [min, max] — inclusive on both ends. */
export const randInt = (min, max) => Math.floor(min + Math.random() * (max - min + 1));
export const chance = (p) => Math.random() < p;
export const pick = (arr) => arr[(Math.random() * arr.length) | 0];

/** Fisher-Yates. Returns a new array; never mutates the input. */
export function shuffle(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = (Math.random() * (i + 1)) | 0;
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** `count` distinct items sampled from arr (or the whole array if it is shorter). */
export const sample = (arr, count) => shuffle(arr).slice(0, count);

/** Pick `count` distinct items, preferring ones not in `avoid`. */
export function sampleAvoiding(arr, count, avoid = []) {
  const avoidSet = new Set(avoid);
  const fresh = arr.filter((x) => !avoidSet.has(x));
  const chosen = shuffle(fresh).slice(0, count);
  if (chosen.length < count) {
    chosen.push(...shuffle(arr.filter((x) => !chosen.includes(x))).slice(0, count - chosen.length));
  }
  return shuffle(chosen);
}

export const dist = (x1, y1, x2, y2) => Math.hypot(x2 - x1, y2 - y1);
export const dist2 = (x1, y1, x2, y2) => (x2 - x1) ** 2 + (y2 - y1) ** 2;

export const pointInRect = (px, py, x, y, w, h) => px >= x && px <= x + w && py >= y && py <= y + h;
export const pointInCircle = (px, py, cx, cy, r) => dist2(px, py, cx, cy) <= r * r;

/** Rect helper used all over the UI code. */
export const rect = (x, y, w, h) => ({ x, y, w, h, cx: x + w / 2, cy: y + h / 2 });

/** Deterministic pseudo-random in [0,1) from an integer seed — for stable "wobble". */
export function hashNoise(seed) {
  let t = (seed + 0x6d2b79f5) | 0;
  t = Math.imul(t ^ (t >>> 15), 1 | t);
  t ^= t + Math.imul(t ^ (t >>> 7), 61 | t);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

/** Seeded RNG — same seed always yields the same sequence (used by the jigsaw cutter). */
export function makeRng(seed = 1) {
  let s = seed >>> 0 || 1;
  return () => {
    s ^= s << 13; s >>>= 0;
    s ^= s >>> 17;
    s ^= s << 5; s >>>= 0;
    return s / 4294967296;
  };
}

/** "#ffcc00" + alpha -> "rgba(255,204,0,0.5)". Accepts 3- or 6-digit hex. */
export function withAlpha(hex, alpha) {
  let h = hex.replace('#', '');
  if (h.length === 3) h = h.split('').map((c) => c + c).join('');
  const n = parseInt(h, 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${alpha})`;
}

/** Blend two hex colours; t=0 -> a, t=1 -> b. */
export function mixHex(a, b, t) {
  const pa = parseInt(a.replace('#', ''), 16);
  const pb = parseInt(b.replace('#', ''), 16);
  const r = Math.round(lerp((pa >> 16) & 255, (pb >> 16) & 255, t));
  const g = Math.round(lerp((pa >> 8) & 255, (pb >> 8) & 255, t));
  const bl = Math.round(lerp(pa & 255, pb & 255, t));
  return `rgb(${r},${g},${bl})`;
}

/** Lighten/darken a hex colour. amt > 0 lightens toward white. */
export const shade = (hex, amt) => mixHex(hex, amt > 0 ? '#ffffff' : '#000000', Math.abs(amt));

/** Angle-aware approach used for smooth camera/eye follow. */
export function approach(current, target, rate, dt) {
  return lerp(current, target, 1 - Math.exp(-rate * dt));
}
