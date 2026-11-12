/**
 * Small math / array helpers shared by every game.
 * Kept dependency-free so games can import freely.
 */

export const TAU = Math.PI * 2;

export const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);
export const lerp = (a, b, t) => a + (b - a) * t;

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

export const dist = (x1, y1, x2, y2) => Math.hypot(x2 - x1, y2 - y1);

/** Seeded RNG — same seed always yields the same sequence (scenery, the jigsaw cutter). */
export function makeRng(seed = 1) {
  let s = seed >>> 0 || 1;
  return () => {
    s ^= s << 13; s >>>= 0;
    s ^= s >>> 17;
    s ^= s << 5; s >>>= 0;
    return s / 4294967296;
  };
}

/** Frame-rate independent easing of `current` toward `target`. */
export function approach(current, target, rate, dt) {
  return lerp(current, target, 1 - Math.exp(-rate * dt));
}

/** `[0, 1, … n-1]`. */
export const range = (n) => Array.from({ length: n }, (_, i) => i);

/**
 * Deals items without repeats until the pile runs out, then reshuffles — so a
 * child never meets the same question twice running.
 */
export function deck(items) {
  let pile = [];
  let last;
  return () => {
    if (!pile.length) {
      pile = shuffle(items);
      if (pile.length > 1 && pile[pile.length - 1] === last) pile.unshift(pile.pop());
    }
    last = pile.pop();
    return last;
  };
}

/** The answer plus `n - 1` near misses inside [lo, hi], shuffled. */
export function nearbyChoices(answer, n, lo, hi) {
  const near = [1, -1, 2, -2, 3, -3, 4, -4].map((d) => answer + d).filter((v) => v >= lo && v <= hi);
  return shuffle([answer, ...shuffle(near.slice(0, n + 1)).slice(0, n - 1)]);
}
