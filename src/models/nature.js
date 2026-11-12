/** Sky, weather and growing things. The raw builders double as scenery. */

import { Shapes } from '../core/kit.js';

const PI = Math.PI;

export function tree(b, { leaf = '#58c44a', dark = '#45a83c', fruit = null } = {}) {
  b.cyl('#9a6238', [0, 0.26, 0], [0.09, 0.14], 0.52);
  b.ball(dark, [-0.26, 0.68, -0.02], 0.28);
  b.ball(dark, [0.27, 0.7, -0.04], 0.27);
  b.ball(leaf, [0, 0.9, 0], 0.36);
  b.ball(leaf, [0.02, 0.64, 0.14], 0.27);
  if (fruit) [[-0.2, 0.92, 0.3], [0.24, 0.76, 0.24], [-0.06, 0.62, 0.41]].forEach((p) => b.ball(fruit, p, 0.06, { surf: 'shiny', ao: false }));
}

export function cloud(b, color = '#ffffff', surf = [0, 0.35]) {
  b.ball(color, [0, 0.3, 0], [0.36, 0.34, 0.28], { surf });
  b.ball(color, [-0.36, 0.2, 0], [0.26, 0.22, 0.22], { surf });
  b.ball(color, [0.36, 0.21, 0], [0.28, 0.24, 0.22], { surf });
  b.ball(color, [0, 0.14, 0.04], [0.56, 0.16, 0.24], { surf });
}

export function flower(b, { petal = '#ff8fd0', heart = '#ffd23c', n = 5, face = false, tall = 0.62 } = {}) {
  b.rod('#45b23c', [0, 0.03, -0.03], [0, tall, -0.03], 0.035);
  b.both((s) => b.puff('#58c44a', [0, 0.08, -0.03], Shapes.leaf(0.32, 0.13), 0.035, { rot: [0, 0, s * 0.85] }));
  const len = n > 8 ? 0.17 : 0.15, wid = n > 8 ? 0.075 : 0.135;
  for (let i = 0; i < n; i++) {
    const a = PI / 2 + (i / n) * PI * 2;
    b.ball(petal, [Math.cos(a) * 0.24, tall + 0.1 + Math.sin(a) * 0.24, 0], [len, wid, 0.05], { rot: [0, 0, a] });
  }
  const c = [0, tall + 0.1, 0.03], r = [n > 8 ? 0.19 : 0.14, n > 8 ? 0.19 : 0.14, 0.08];
  b.ball(heart, c, r);
  if (face) b.face(c, r, { scale: 1.1, size: 0.036 });
}

export function mushroom(b) {
  b.cyl('#fff3e2', [0, 0.24, 0], [0.17, 0.22], 0.48);
  const c = [0, 0.42, 0], r = [0.52, 0.46, 0.52];
  b.dome('#ff4d4d', c, r, { surf: 'shiny' });
  [[0, 0.55, 0.12], [0.85, 0.35, 0.09], [-0.8, 0.4, 0.1], [0.4, 1.1, 0.08], [-0.6, 1.0, 0.07]].forEach(([y, p, k]) => b.spot('#ffffff', c, r, y, p, k, { thick: 0.025 }));
}

export function bush(b, leaf = '#4fb843', dark = '#3f9e38') {
  b.ball(dark, [-0.36, 0.22, 0], [0.32, 0.28, 0.28]);
  b.ball(dark, [0.36, 0.22, 0], [0.32, 0.28, 0.28]);
  b.ball(leaf, [0, 0.32, 0.04], [0.42, 0.38, 0.32]);
  b.ball(leaf, [-0.16, 0.16, 0.2], 0.2);
  b.ball(leaf, [0.2, 0.15, 0.2], 0.19);
}

const flame = (k) => [[0, 0], [0.22, 0.03], [0.34, 0.2], [0.3, 0.42], [0.16, 0.66], [0.05, 0.86], [0, 0.96]].map(([x, y]) => [x * k, y * k]);
const drop = [[0, 0], [0.09, 0.02], [0.13, 0.11], [0.09, 0.22], [0.02, 0.33], [0, 0.35]];

export const NATURE = {
  sun: (b) => {
    const c = [0, 0.7, 0], r = [0.44, 0.44, 0.3];
    b.ball('#ffd23c', c, r, { surf: [0, 0.3] });
    b.part('rays', c, () => {
      for (let i = 0; i < 10; i++) {
        const a = (i / 10) * PI * 2;
        b.cone('#ff9f1c', [Math.sin(a) * 0.46, 0.7 + Math.cos(a) * 0.46, 0], 0.11, 0.25, { rot: [0, 0, -a], scale: [1, 1, 0.6], surf: [0, 0.3] });
      }
    });
    b.face(c, r, { scale: 1.2, size: 0.07 });
  },
  moon: (b) => {
    const pts = [];
    for (let i = 0; i <= 14; i++) { const a = PI * (0.34 + (i / 14) * 1.32); pts.push([Math.cos(a) * 0.4, 0.6 + Math.sin(a) * 0.44, 0]); }
    b.tube('#ffe27a', pts, (t) => 0.015 + Math.sin(t * PI) ** 0.8 * 0.23, { flat: 0.6, radial: 16, surf: [0, 0.25] });
    b.tube('#8a5a38', [[-0.47, 0.7, 0.135], [-0.41, 0.66, 0.15], [-0.35, 0.7, 0.14]], 0.016, { ao: false });
    b.tube('#8a5a38', [[-0.4, 0.49, 0.145], [-0.33, 0.45, 0.14], [-0.27, 0.48, 0.12]], 0.016, { ao: false });
    b.ball('#ff9db0', [-0.49, 0.56, 0.13], [0.05, 0.035, 0.02], { ao: false });
  },
  star: (b) => {
    b.pillow('#ffd23c', [0, 0.55, 0], Shapes.star(0.62, 0.36, 5, 0.16), 0.32, { surf: [1, 0.18] });
    b.flatFace(0, 0.55, 0.155, 0.62);
  },
  cloud: (b) => { cloud(b); b.face([0, 0.3, 0], [0.36, 0.34, 0.28], { scale: 1.1, size: 0.05, pitch: 0.02 }); },
  rain: (b) => {
    b.group([0, 0.52, 0], [0, 0, 0], 1, () => cloud(b, '#aab8d4', 'toy'));
    [[-0.32, 0.16], [0, 0], [0.32, 0.14], [-0.15, 0.3], [0.17, 0.32]].forEach(([x, y], i) =>
      b.lathe('#3fa9f0', [x, y, 0.04], drop, { scale: i > 2 ? 0.55 : 0.8, surf: 'shiny', seg: 12 }));
  },
  rainbow: (b) => {
    ['#ff4d5e', '#ff9f1c', '#ffdc3c', '#58c44a', '#4cb4f0', '#9b6cff'].forEach((c, i) =>
      b.torus(c, [0, 0.12, 0], 0.72 - i * 0.075, 0.046, { arc: PI, seg: 28, ao: false, ink: true }));
    b.both((s) => b.group([s * 0.54, 0, 0.06], [0, 0, 0], 0.46, () => cloud(b)));
  },
  fire: (b) => {
    b.both((s) => b.rod('#8a5a38', [-0.46, 0.09, s * 0.16], [0.46, 0.09, -s * 0.16], 0.085));
    b.lathe('#ff5a2e', [0, 0.1, 0], flame(1.05), { surf: 'glow', scale: [1, 1, 0.7] });
    b.both((s) => b.lathe('#ff7a2e', [s * 0.24, 0.1, 0], flame(0.6), { surf: 'glow', rot: [0, 0, -s * 0.3] }));
    b.lathe('#ffb52e', [0, 0.12, 0.13], flame(0.7), { surf: 'glow', scale: [1, 1, 0.7] });
    b.lathe('#ffec8a', [0, 0.13, 0.22], flame(0.4), { surf: 'bright', scale: [1, 1, 0.7] });
  },
  rock: (b) => {
    b.lathe('#9aa3b5', [0, 0, 0], [[0, 0], [0.52, 0], [0.6, 0.22], [0.46, 0.55], [0.2, 0.72], [0, 0.74]], { seg: 7, facet: true, scale: [1, 1, 0.8] });
    b.lathe('#868fa3', [0.52, 0, 0.26], [[0, 0], [0.2, 0], [0.22, 0.1], [0.12, 0.24], [0, 0.26]], { seg: 6, facet: true });
  },
  tree: (b) => tree(b, { fruit: '#ff4040' }),
  leaf: (b) => b.group([-0.3, 0.12, 0], [0, 0, -0.7], 1, () => {
    b.puff('#58c44a', [0, 0, 0], Shapes.leaf(1.1, 0.5), 0.09);
    b.rod('#2f8a3c', [0, -0.14, 0.03], [0, 0.95, 0.045], 0.018, { ao: false });
    for (const y of [0.25, 0.45, 0.65]) b.both((s) => b.rod('#2f8a3c', [0, y, 0.045], [s * 0.2, y + 0.17, 0.04], 0.013, { ao: false }));
  }),
  log: (b) => b.group([0, 0.3, 0], [0, -0.75, PI / 2], 1, () => {
    b.cyl('#8a5a38', [0, 0, 0], 0.3, 1.05, { bevel: 0.04 });
    b.cyl('#eac590', [0, -0.52, 0], 0.25, 0.04, { ao: false });
    for (const R of [0.17, 0.08]) b.torus('#b98a55', [0, -0.54, 0], R, 0.012, { rot: [PI / 2, 0, 0], ao: false });
    b.cyl('#8a5a38', [0.32, 0.15, 0], 0.08, 0.22, { rot: [0, 0, -1.2] });
    for (const a of [0.9, 1.5, 2.1]) b.rod('#6a4226', [Math.cos(a) * 0.3, -0.3, Math.sin(a) * 0.3], [Math.cos(a) * 0.3, 0.2 + a * 0.08, Math.sin(a) * 0.3], 0.014, { ao: false });
  }),
  nest: (b) => b.group([0, 0.2, 0], [0.3, 0, 0], 1, () => {
    b.lathe('#a8703f', [0, -0.2, 0], [[0, 0], [0.34, 0.02], [0.54, 0.2], [0.56, 0.32], [0.44, 0.3], [0.3, 0.16], [0, 0.14]], { sharp: true });
    for (let i = 0; i < 14; i++) {
      const a = i * 0.449, x = Math.cos(a), z = Math.sin(a);
      b.rod(i % 2 ? '#7c4e28' : '#c98f4c', [x * 0.55 - z * 0.2, 0.06 + (i % 3) * 0.03, z * 0.55 + x * 0.2], [x * 0.55 + z * 0.2, 0.1 - (i % 3) * 0.05, z * 0.55 - x * 0.2], 0.035, { ao: false });
    }
    [[-0.2, 0.02], [0.2, 0.02], [0, -0.14]].forEach(([x, z]) => b.ball('#9fe4f5', [x, 0.2, z], [0.15, 0.2, 0.15], { rot: [0, 0, -x] }));
  }),
  web: (b) => {
    const c = [0, 0.6, 0], silk = '#f4f7ff', n = 8;
    const at = (i, r) => [Math.cos((i / n) * PI * 2) * r, c[1] + Math.sin((i / n) * PI * 2) * r, 0];
    for (let i = 0; i < n; i++) {
      b.rod(silk, c, at(i, 0.6), 0.018, { ao: false, ink: true });
      for (const r of [0.18, 0.34, 0.5]) b.tube(silk, [at(i, r), at(i + 0.5, r * 0.84), at(i + 1, r)], 0.015, { caps: false, radial: 5, ao: false, ink: true });
    }
    b.ball('#5b3f9e', [0.2, 0.42, 0.06], 0.1);
    for (const k of [-0.06, 0, 0.06]) b.both((s) => b.rod('#5b3f9e', [0.2, 0.42 + k, 0.05], [0.2 + s * 0.17, 0.42 + k * 2.2, 0.04], 0.014, { ao: false }));
    b.eyes([0.2, 0.42, 0.06], 0.1, { white: 0.036, size: 0.024 });
  },
  flower: (b) => flower(b, { face: true }),
  sunflower: (b) => flower(b, { petal: '#ffd23c', heart: '#b4723c', n: 12, face: true }),
  mushroom,
  clover: (b) => {
    b.tube('#3fa84c', [[0, 0.56, -0.02], [0.03, 0.25, -0.02], [0.14, 0.03, -0.02]], 0.035);
    for (let i = 0; i < 4; i++) {
      const a = PI / 4 + (i * PI) / 2;
      b.pillow('#58c44a', [-Math.sin(a) * 0.24, 0.62 + Math.cos(a) * 0.24, 0], Shapes.heart(0.24), 0.08, { rot: [0, 0, a] });
    }
  },
  cactus: (b) => {
    b.cyl('#e8835a', [0, 0.13, 0], [0.3, 0.23], 0.26);
    b.rod('#4fb86a', [0, 0.35, 0], [0, 0.85, 0], 0.2);
    b.tube('#4fb86a', [[0.15, 0.5, 0], [0.36, 0.54, 0], [0.4, 0.78, 0]], 0.09);
    b.tube('#4fb86a', [[-0.15, 0.62, 0], [-0.36, 0.66, 0], [-0.4, 0.86, 0]], 0.09);
    b.ball('#ff7ac8', [0.04, 1.06, 0], 0.075);
    b.face([0, 0.68, 0], [0.2, 0.4, 0.2], { scale: 1.1, size: 0.045 });
  },
  planet: (b) => b.group([0, 0.42, 0], [0.35, 0, -0.3], 1, () => {
    b.banded([[-0.5, '#ff9a52'], [-0.15, '#ffc98a'], [0.25, '#ff9a52'], [0.55, '#ffdcb0'], [1, '#ff9a52']], [0, 0, 0], 0.4);
    b.torus('#c9a8ff', [0, 0, 0], 0.62, 0.075, { rot: [PI / 2, 0, 0], scale: [1, 1, 0.3] });
  }),
};
