/**
 * Stroke-order data for letters and digits.
 *
 * A three-year-old who fills an outline with scribble has learned nothing about
 * handwriting: letters are *movements*, and the movement has an order and a
 * direction. So every glyph here is described the way a teacher would say it —
 * "big line down, little line across" — as an ordered list of strokes, each
 * stroke a path the crayon travels from start to finish.
 *
 * Coordinate space
 * ----------------
 * One unit is the cap height, and both axes use it, so a glyph is drawn inside a
 * roughly square box and never needs a separate width scale.
 *
 *     y = 0.0   TOP    top line          (capitals, ascenders: b d f h k l t)
 *     y = 0.5   MID    dashed midline    (top of the small letters)
 *     y = 1.0   BASE   baseline          (everything sits here)
 *     y = 1.3   DESC   descender line    (g j p q y)
 *
 * x is free: `strokesFor()` centres each glyph on its own extent, so a narrow
 * `I` and a wide `W` both land in the middle of the paper.
 *
 * The order and direction follow the usual manuscript teaching sequence: every
 * vertical runs top-to-bottom, every horizontal runs left-to-right, circles run
 * anticlockwise, and letters that share a shape (`c o s v w x z`) are simply the
 * capital drawn small, which is exactly what the child is being told.
 */

export const TOP = 0;
export const MID = 0.5;
export const BASE = 1;
export const DESC = 1.3;

const PI = Math.PI;

/**
 * Sample an ellipse arc. Angles are radians with y pointing *down*, so 0 is the
 * right of the circle, -PI/2 the top, and a decreasing angle sweeps
 * anticlockwise on screen — the direction letters are actually written.
 */
function arc(cx, cy, rx, ry, a0, a1, steps = 0) {
  const n = steps || Math.max(4, Math.round(Math.abs(a1 - a0) / (PI / 12)));
  const out = [];
  for (let i = 0; i <= n; i++) {
    const a = a0 + (a1 - a0) * (i / n);
    out.push([cx + rx * Math.cos(a), cy + ry * Math.sin(a)]);
  }
  return out;
}

/** Concatenate path pieces into one stroke, dropping duplicated joints. */
function path(...parts) {
  const out = [];
  for (const part of parts) {
    for (const p of part) {
      const last = out[out.length - 1];
      if (last && Math.abs(last[0] - p[0]) < 1e-4 && Math.abs(last[1] - p[1]) < 1e-4) continue;
      out.push(p);
    }
  }
  return out;
}

/**
 * A capital redrawn at small-letter size, sitting on the baseline. `kx` widens
 * it independently: a small `w` is nearly as wide as a capital one, and keeping
 * that width matters here — squeeze the zig-zag and the two legs end up closer
 * together than a fingertip is wide.
 */
const small = (strokes, k = 0.5, kx = k) => strokes.map((s) => s.map(([x, y]) => [x * kx, y * k + (1 - k)]));

/* ------------------------------------------------------------- capitals */

const A = [[[0.36, 0], [0.02, 1]], [[0.36, 0], [0.70, 1]], [[0.13, 0.66], [0.59, 0.66]]];
const B = [
  [[0.10, 0], [0.10, 1]],
  arc(0.10, 0.25, 0.34, 0.25, -PI / 2, PI / 2),
  arc(0.10, 0.75, 0.40, 0.25, -PI / 2, PI / 2),
];
const C = [arc(0.36, 0.5, 0.34, 0.5, -0.35 * PI, -1.65 * PI)];
const D = [[[0.10, 0], [0.10, 1]], arc(0.10, 0.5, 0.50, 0.5, -PI / 2, PI / 2)];
const E = [
  [[0.10, 0], [0.10, 1]],
  [[0.10, 0], [0.58, 0]],
  [[0.10, 0.5], [0.50, 0.5]],
  [[0.10, 1], [0.58, 1]],
];
const F = [[[0.10, 0], [0.10, 1]], [[0.10, 0], [0.58, 0]], [[0.10, 0.5], [0.50, 0.5]]];
// C, then up the right-hand side and back in along the middle — one movement.
const G = [path(
  arc(0.36, 0.5, 0.34, 0.5, -0.35 * PI, -1.88 * PI),
  [[0.70, 0.52], [0.42, 0.52]],
)];
const H = [[[0.08, 0], [0.08, 1]], [[0.62, 0], [0.62, 1]], [[0.08, 0.5], [0.62, 0.5]]];
const I = [[[0.30, 0], [0.30, 1]], [[0.08, 0], [0.52, 0]], [[0.08, 1], [0.52, 1]]];
const J = [path([[0.46, 0], [0.46, 0.74]], arc(0.24, 0.74, 0.22, 0.24, 0, PI))];
const K = [[[0.10, 0], [0.10, 1]], [[0.60, 0], [0.12, 0.55]], [[0.12, 0.55], [0.62, 1]]];
const L = [[[0.12, 0], [0.12, 1]], [[0.12, 1], [0.60, 1]]];
const M = [[[0.06, 0], [0.06, 1]], [[0.06, 0], [0.36, 0.62], [0.66, 0]], [[0.66, 0], [0.66, 1]]];
const N = [[[0.08, 0], [0.08, 1]], [[0.08, 0], [0.60, 1]], [[0.60, 0], [0.60, 1]]];
const O = [arc(0.36, 0.5, 0.36, 0.5, -PI / 2, -PI / 2 - 2 * PI)];
const P = [[[0.10, 0], [0.10, 1]], arc(0.10, 0.27, 0.38, 0.27, -PI / 2, PI / 2)];
const Q = [arc(0.36, 0.5, 0.36, 0.5, -PI / 2, -PI / 2 - 2 * PI), [[0.46, 0.70], [0.76, 1.06]]];
const R = [
  [[0.10, 0], [0.10, 1]],
  arc(0.10, 0.27, 0.38, 0.27, -PI / 2, PI / 2),
  [[0.10, 0.54], [0.62, 1]],
];
// Two bowls that hand over at the waist: over the top to the left, then round
// the bottom to the left again.
const S = [path(
  arc(0.34, 0.26, 0.26, 0.26, -0.28 * PI, -1.35 * PI),
  arc(0.34, 0.74, 0.26, 0.26, -0.64 * PI, 0.86 * PI),
)];
const T = [[[0.34, 0], [0.34, 1]], [[0.04, 0], [0.64, 0]]];
const U = [path(
  [[0.06, 0], [0.06, 0.66]],
  arc(0.34, 0.66, 0.28, 0.34, PI, 0),
  [[0.62, 0.66], [0.62, 0]],
)];
const V = [[[0.04, 0], [0.34, 1], [0.64, 0]]];
const W = [[[0.02, 0], [0.20, 1], [0.38, 0.16], [0.56, 1], [0.74, 0]]];
const X = [[[0.06, 0], [0.62, 1]], [[0.62, 0], [0.06, 1]]];
const Y = [[[0.06, 0], [0.34, 0.52], [0.34, 1]], [[0.62, 0], [0.34, 0.52]]];
const Z = [[[0.06, 0], [0.62, 0], [0.06, 1], [0.62, 1]]];

/* -------------------------------------------------------- small letters */

/** The anticlockwise bowl that starts `a c d g o q` — "round the clock". */
const bowl = (cx = 0.26, from = -0.3 * PI, to = -0.3 * PI - 2 * PI) => arc(cx, 0.75, 0.22, 0.25, from, to);
/** A shoulder: up the stem, over the hump and back down to the baseline. */
const hump = (cx, r = 0.20) => path(arc(cx, 0.72, r, 0.20, PI, 2 * PI), [[cx + r, 0.72], [cx + r, 1]]);

const LOWER = {
  a: [bowl(), [[0.48, 0.52], [0.48, 1]]],
  b: [[[0.10, 0], [0.10, 1]], arc(0.10, 0.775, 0.34, 0.225, -PI / 2, PI / 2)],
  c: small(C),
  d: [bowl(), [[0.48, 0], [0.48, 1]]],
  // The only letter that starts with a line across: "little line, then round".
  e: [path([[0.05, 0.78], [0.478, 0.78]], arc(0.26, 0.75, 0.22, 0.25, 0.038 * PI, -1.71 * PI))],
  f: [path(arc(0.30, 0.16, 0.12, 0.12, 0, -PI), [[0.18, 0.16], [0.18, 1]]), [[0.02, 0.52], [0.38, 0.52]]],
  g: [bowl(), path([[0.48, 0.52], [0.48, 1.12]], arc(0.26, 1.12, 0.22, 0.18, 0, PI))],
  h: [[[0.10, 0], [0.10, 1]], hump(0.30)],
  i: [[[0.16, 0.52], [0.16, 1]], [[0.16, 0.26]]],
  j: [path([[0.34, 0.52], [0.34, 1.12]], arc(0.16, 1.12, 0.18, 0.18, 0, PI)), [[0.34, 0.26]]],
  k: [[[0.10, 0], [0.10, 1]], [[0.44, 0.52], [0.10, 0.78]], [[0.10, 0.78], [0.46, 1]]],
  l: [[[0.14, 0], [0.14, 1]]],
  m: [[[0.08, 0.52], [0.08, 1]], hump(0.24, 0.16), hump(0.56, 0.16)],
  n: [[[0.08, 0.52], [0.08, 1]], hump(0.28)],
  o: small(O),
  p: [[[0.10, 0.52], [0.10, 1.28]], arc(0.10, 0.775, 0.34, 0.225, -PI / 2, PI / 2)],
  q: [bowl(), [[0.48, 0.52], [0.48, 1.28]]],
  r: [[[0.10, 0.52], [0.10, 1]], arc(0.26, 0.72, 0.16, 0.20, PI, 1.75 * PI)],
  s: small(S),
  t: [[[0.24, 0.18], [0.24, 1]], [[0.04, 0.5], [0.44, 0.5]]],
  u: [...small(U), [[0.31, 0.5], [0.31, 1]]],
  v: small(V, 0.5, 0.68),
  w: small(W, 0.5, 0.68),
  x: small(X, 0.5, 0.68),
  y: [[[0.04, 0.52], [0.26, 1]], [[0.50, 0.52], [0.14, 1.28]]],
  z: small(Z),
};

/* --------------------------------------------------------------- digits */

const DIGITS = {
  0: [arc(0.30, 0.5, 0.28, 0.5, -PI / 2, -PI / 2 - 2 * PI)],
  1: [[[0.08, 0.22], [0.30, 0.02], [0.30, 1]]],
  2: [path(arc(0.32, 0.26, 0.26, 0.26, PI, 2.15 * PI), [[0.06, 1], [0.60, 1]])],
  3: [path(
    arc(0.30, 0.27, 0.24, 0.27, PI, 2.35 * PI),
    arc(0.30, 0.73, 0.26, 0.27, -0.35 * PI, PI),
  )],
  4: [[[0.44, 0.04], [0.04, 0.68], [0.62, 0.68]], [[0.44, 0.04], [0.44, 1]]],
  5: [path([[0.14, 0.06], [0.14, 0.44]], arc(0.30, 0.72, 0.28, 0.28, -0.55 * PI, 0.83 * PI)),
    [[0.14, 0.06], [0.56, 0.06]]],
  6: [path(
    [[0.52, 0.06], [0.36, 0.11], [0.22, 0.26], [0.13, 0.48], [0.08, 0.74]],
    arc(0.32, 0.74, 0.24, 0.26, PI, -PI),
  )],
  7: [[[0.06, 0.06], [0.62, 0.06], [0.24, 1]]],
  // Down the left of the top loop, all the way round the bottom one, then back
  // up the right — the single movement that stops an 8 becoming two circles.
  8: [path(
    arc(0.32, 0.27, 0.22, 0.27, -PI / 2, -1.5 * PI),
    arc(0.32, 0.755, 0.26, 0.245, -PI / 2, -2.5 * PI),
    arc(0.32, 0.27, 0.22, 0.27, PI / 2, -PI / 2),
  )],
  9: [bowl(0.30, -0.3 * PI, -0.3 * PI - 2 * PI).map(([x, y]) => [x, y - 0.45]), [[0.52, 0.30], [0.52, 1]]],
};

const UPPER = { A, B, C, D, E, F, G, H, I, J, K, L, M, N, O, P, Q, R, S, T, U, V, W, X, Y, Z };

const ALL = { ...UPPER, ...LOWER, ...DIGITS };

export const TRACEABLE = Object.keys(ALL);

/**
 * The ordered strokes for one character, centred on x = 0.
 *
 * Returns fresh arrays every call — a caller is free to scale them in place.
 * Unknown characters return an empty list rather than throwing, so a typo in a
 * word list can never blank the screen mid-game.
 */
export function strokesFor(ch) {
  const strokes = ALL[ch];
  if (!strokes) return [];
  let min = Infinity;
  let max = -Infinity;
  for (const s of strokes) {
    for (const [x] of s) {
      if (x < min) min = x;
      if (x > max) max = x;
    }
  }
  const shift = (min + max) / 2;
  return strokes.map((s) => s.map(([x, y]) => [x - shift, y]));
}
