/**
 * Chunky 3D letters and numerals.
 *
 * They are swept along the same teacher-ordered strokes Letter Trace uses, so
 * the `a` a child spells with is exactly the `a` they are taught to write —
 * single-storey, on every device, with no font to download.
 */

import * as THREE from './three.js';
import { Builder, tubeGeo, toyMaterial } from './kit.js';
import { strokesFor } from '../data/strokes.js';

const PI = Math.PI;
const arc = (cx, cy, rx, ry, a0, a1, n = 14) =>
  Array.from({ length: n + 1 }, (_, i) => {
    const a = a0 + (a1 - a0) * (i / n);
    return [cx + rx * Math.cos(a), cy + ry * Math.sin(a)];
  });

/** Signs the handwriting data has no need of. Same space: y down, baseline 1. */
const SIGNS = {
  '+': [[[-0.26, 0.56], [0.26, 0.56]], [[0, 0.3], [0, 0.82]]],
  '−': [[[-0.24, 0.56], [0.24, 0.56]]],
  '=': [[[-0.24, 0.42], [0.24, 0.42]], [[-0.24, 0.72], [0.24, 0.72]]],
  '?': [[...arc(0, 0.26, 0.24, 0.24, PI, 2.35 * PI), [0.02, 0.56], [0, 0.68]], [[0, 0.97]]],
  '!': [[[0, 0.02], [0, 0.66]], [[0, 0.97]]],
};

/** Split a stroke wherever it turns a sharp corner, so each run sweeps cleanly. */
function runs(stroke) {
  const out = [[stroke[0]]];
  for (let i = 1; i < stroke.length; i++) {
    out[out.length - 1].push(stroke[i]);
    const next = stroke[i + 1];
    if (!next) break;
    const a = Math.atan2(stroke[i][1] - stroke[i - 1][1], stroke[i][0] - stroke[i - 1][0]);
    const b = Math.atan2(next[1] - stroke[i][1], next[0] - stroke[i][0]);
    const turn = Math.abs(((b - a + 3 * PI) % (2 * PI)) - PI);
    if (turn > 0.7) out.push([stroke[i]]);
  }
  return out;
}

const cache = new Map();

/**
 * Geometry for a string, one cap-height tall, centred on x and on the middle
 * of the cap height. `weight` is the stroke radius.
 */
function textGeometry(str, weight, flat) {
  const key = `${str}|${weight}|${flat}`;
  if (cache.has(key)) return cache.get(key);
  const b = new Builder({ ao: false });
  const glyphs = [...str].map((ch) => {
    const strokes = ch === ' ' ? [] : SIGNS[ch] || strokesFor(ch);
    const xs = strokes.flat().map((p) => p[0]);
    const half = xs.length ? Math.max(...xs.map(Math.abs)) : 0.1;
    return { strokes, w: half * 2 + weight * 2 };
  });
  const gap = weight * 1.1;
  const width = glyphs.reduce((s, g) => s + g.w, 0) + gap * (glyphs.length - 1);
  let x = -width / 2;
  let top = 0, bottom = 0;
  for (const g of glyphs) {
    const cx = x + g.w / 2;
    for (const stroke of g.strokes) {
      const pts = stroke.map(([px, py]) => [cx + px, 0.5 - py, 0]);
      for (const p of pts) { top = Math.max(top, p[1]); bottom = Math.min(bottom, p[1]); }
      if (pts.length === 1) {
        b.ball('#ffffff', pts[0], [weight * 1.2, weight * 1.2, weight * flat * 1.2], { surf: 'shiny', seg: 14 });
        continue;
      }
      for (const run of runs(pts)) {
        b.add(tubeGeo(run, weight, { radial: 12, smooth: false, flat }), '#ffffff', [0, 0, 0], { surf: 'shiny' });
        for (const p of [run[0], run[run.length - 1]]) {
          b.ball('#ffffff', p, [weight, weight, weight * flat], { surf: 'shiny', seg: 12 });
        }
      }
    }
    x += g.w + gap;
  }
  const geo = b.bake().parts[0].geo;
  geo.userData = { width, mid: (top + bottom) / 2 };
  cache.set(key, geo);
  return geo;
}

/**
 * A text mesh `height` units tall (cap height), centred on its origin.
 * `maxWidth` shrinks long strings to fit; `ink` centres on the drawn shape
 * rather than the cap height, so a lone `g` or `a` sits mid-tile.
 */
export function text3d(str, {
  height = 1, color = '#ffffff', weight = /[a-z]/.test(str) ? 0.085 : 0.105, flat = 0.75, maxWidth = 0, ink = false, shadow = true,
} = {}) {
  const geo = textGeometry(String(str), weight, flat);
  const mesh = new THREE.Mesh(geo, toyMaterial(color));
  const k = maxWidth ? Math.min(height, maxWidth / geo.userData.width) : height;
  mesh.scale.setScalar(k);
  if (ink) mesh.position.y = -geo.userData.mid * k;
  mesh.castShadow = shadow;
  const group = new THREE.Group();
  group.add(mesh);
  group.width = geo.userData.width * k;
  group.setColor = (c) => { mesh.material = toyMaterial(c); };
  return group;
}
