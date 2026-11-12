/** Things to eat. */

import { Shapes } from '../core/kit.js';

const PI = Math.PI;
const SPRINKLES = ['#ff6b8b', '#ffc93c', '#4cc9f0', '#3ddc97', '#9b6cff', '#ffffff'];

const stem = (b, p, k = 1) => b.tube('#7c4e28', [p, [p[0] + 0.02 * k, p[1] + 0.12 * k, p[2]], [p[0] + 0.07 * k, p[1] + 0.22 * k, p[2]]], 0.032 * k);
const leaf = (b, p, roll = -1, k = 0.34) => b.puff('#58c44a', p, Shapes.leaf(k, k * 0.42), 0.04, { rot: [0.2, 0, roll] });
const plate = (b, r = 0.62) => b.cyl('#ffffff', [0, 0.03, 0], [r, r * 0.7], 0.06, { surf: 'shiny' });

/** Chocolate-chip cookie lying flat; `tone` swaps the dough. */
export function cookie(b, tone = '#e0a55e', chip = '#5c3218') {
  b.cyl(tone, [0, 0.07, 0], [0.46, 0.5], 0.15, { bevel: 0.07 });
  [[0.2, 0.16], [-0.18, 0.2], [0.02, -0.02], [-0.25, -0.12], [0.24, -0.16], [-0.02, -0.3]].forEach(([x, z]) =>
    b.ball(chip, [x, 0.145, z], [0.065, 0.04, 0.065], { surf: 'shiny', ao: false }));
}

export const FOOD = {
  apple: (b) => {
    b.lathe('#ff4040', [0, 0, 0], [[0, 0.06], [0.16, 0.01], [0.32, 0.04], [0.46, 0.24], [0.52, 0.5], [0.46, 0.74], [0.3, 0.86], [0.14, 0.84], [0, 0.74]], { surf: 'shiny' });
    stem(b, [0, 0.76, 0]);
    leaf(b, [0.05, 0.9, 0]);
  },
  pear: (b) => {
    b.lathe('#b6de4a', [0, 0, 0], [[0, 0.02], [0.24, 0.02], [0.42, 0.16], [0.46, 0.36], [0.38, 0.56], [0.25, 0.72], [0.2, 0.9], [0.13, 1], [0, 1.02]], { surf: 'shiny' });
    stem(b, [0, 0.99, 0]);
    leaf(b, [0.05, 1.1, 0], -1.1, 0.28);
  },
  peach: (b) => {
    const tone = (x, y) => (x + y > 0.55 ? '#ff8f7a' : '#ffb271');
    b.both((s) => b.ball(s > 0 ? tone : '#ffb271', [s * 0.09, 0.46, 0], [0.42, 0.46, 0.44]));
    stem(b, [0, 0.84, 0], 0.7);
    leaf(b, [0.02, 0.92, 0]);
  },
  lemon: (b) => {
    b.lathe('#ffe03c', [0.56, 0.4, 0], [[0, 0], [0.07, 0.03], [0.14, 0.12], [0.33, 0.28], [0.4, 0.56], [0.33, 0.84], [0.14, 1], [0.07, 1.09], [0, 1.12]], { rot: [0, 0, PI / 2], surf: 'shiny' });
    leaf(b, [0.3, 0.68, 0], -0.7);
  },
  melon: (b) => {
    const c = [0, 0.5, 0];
    b.ball('#b9e07a', c, 0.52);
    for (let i = 0; i < 9; i++) b.line('#5fae4a', c, 0.52, [-1.4, -0.7, 0, 0.7, 1.4].map((p) => [(i / 9) * PI * 2, p]), 0.022);
    stem(b, [0, 1, 0], 0.7);
  },
  watermelon: (b) => {
    const half = (r) => {
      const pts = [];
      for (let i = 0; i <= 16; i++) pts.push([Math.cos(PI + (i / 16) * PI) * r, Math.sin(PI + (i / 16) * PI) * r]);
      return Shapes.poly(pts);
    };
    b.puff('#3fa84c', [0, 0.66, 0], half(0.66), 0.26, { bevel: 0.05 });
    b.puff('#e9ffd0', [0, 0.665, 0], half(0.59), 0.29, { bevel: 0.03, ao: false });
    b.puff('#ff5468', [0, 0.67, 0], half(0.53), 0.32, { bevel: 0.04, ao: false });
    [[-0.3, 0.52], [0, 0.5], [0.3, 0.52], [-0.15, 0.32], [0.15, 0.32]].forEach(([x, y]) => b.ball('#2a1d2e', [x, y, 0.16], [0.03, 0.05, 0.02], { ao: false }));
  },
  grape: (b) => {
    [[3, 0.82], [4, 0.62], [3, 0.42], [2, 0.24], [1, 0.1]].forEach(([n, y], row) => {
      for (let i = 0; i < n; i++) b.ball(row % 2 ? '#8a55e0' : '#9b6cff', [(i - (n - 1) / 2) * 0.23, y, 0.05 - Math.abs(i - (n - 1) / 2) * 0.05], 0.15, { surf: 'shiny' });
    });
    b.ball('#7448d6', [0, 0.6, -0.12], [0.3, 0.32, 0.16]);
    stem(b, [0, 0.92, 0]);
    leaf(b, [0.03, 1, 0.02]);
  },
  banana: (b) => {
    const pts = [];
    for (let i = 0; i <= 6; i++) { const a = PI * (1.12 + (i / 6) * 0.76); pts.push([Math.cos(a) * 0.62, 0.78 + Math.sin(a) * 0.62, 0]); }
    b.tube('#ffdc3c', pts, (t) => 0.05 + Math.sin(t * PI) ** 0.6 * 0.13, { radial: 7, caps: false });
    b.ball('#6b4a28', pts[0], 0.055);
    b.rod('#8a6a30', pts[6], [pts[6][0] + 0.05, pts[6][1] + 0.12, 0], 0.045);
  },
  strawberry: (b) => {
    b.lathe('#ff3f55', [0, 0, 0], [[0, 0], [0.1, 0.04], [0.28, 0.26], [0.43, 0.56], [0.42, 0.76], [0.28, 0.88], [0, 0.9]], { surf: 'shiny' });
    [[0.2, 0.235, 2], [0.4, 0.35, 3], [0.6, 0.435, 4], [0.76, 0.42, 3]].forEach(([y, r, n]) => {
      for (let i = 0; i < n; i++) {
        const a = (i - (n - 1) / 2) * (y > 0.5 ? 0.55 : 0.7);
        b.ball('#ffe9a0', [Math.sin(a) * r, y, Math.cos(a) * r], [0.022, 0.034, 0.02], { ao: false });
      }
    });
    for (let i = 0; i < 6; i++) b.puff('#45b23c', [0, 0.92, 0], Shapes.leaf(0.4, 0.17), 0.04, { rot: [1.5, (i / 6) * PI * 2, 0] });
    b.rod('#45b23c', [0, 0.9, 0], [0.02, 1.04, 0], 0.035);
  },
  corn: (b) => {
    b.ball('#f5b82e', [0, 0.62, 0], [0.22, 0.56, 0.22]);
    for (let row = 0; row < 8; row++) {
      const y = 0.36 + row * 0.105, k = Math.sqrt(Math.max(0.02, 1 - ((y - 0.62) / 0.58) ** 2)) * 0.22;
      for (let i = -2; i <= 2; i++) b.ball('#ffdc4c', [Math.sin(i * 0.62) * k, y, Math.cos(i * 0.62) * k], [0.062, 0.055, 0.05], { surf: 'shiny', ao: false, seg: 7 });
    }
    b.both((s) => b.puff('#58c44a', [s * 0.03, 0, 0.1], Shapes.leaf(0.82, 0.26), 0.07, { rot: [0.05, 0, -s * 0.42] }));
    b.puff('#45a83c', [0, 0, 0.2], Shapes.leaf(0.46, 0.22), 0.06);
  },
  nut: (b) => {
    b.lathe('#d98f45', [0, 0, 0], [[0, 0], [0.05, 0.05], [0.2, 0.14], [0.36, 0.36], [0.38, 0.56], [0.3, 0.66], [0, 0.68]], { surf: 'shiny' });
    b.dome('#7c4e28', [0, 0.56, 0], [0.44, 0.3, 0.44]);
    for (let i = 0; i < 12; i++) b.ball('#6a3f1e', [Math.sin(i * 0.524) * 0.4, 0.62, Math.cos(i * 0.524) * 0.4], 0.06, { ao: false });
    b.rod('#5a3618', [0, 0.84, 0], [0.04, 0.98, 0], 0.045);
  },
  egg: (b) => b.lathe('#fff4e0', [0, 0, 0], [[0, 0], [0.2, 0.04], [0.34, 0.18], [0.39, 0.38], [0.35, 0.62], [0.25, 0.84], [0.12, 0.96], [0, 1]]),
  pie: (b) => b.group([0, 0.2, 0], [0.42, 0, 0], 1, () => {
    b.cyl('#c9d4e0', [0, 0, 0], [0.62, 0.48], 0.24, { surf: 'shiny' });
    b.cyl('#c9283e', [0, 0.1, 0], 0.55, 0.08, { surf: 'shiny' });
    for (let i = -2; i <= 2; i++) {
      const h = Math.sqrt(0.3 - (i * 0.2) ** 2);
      b.rod('#f0bd6e', [i * 0.2, 0.15, -h], [i * 0.2, 0.15, h], 0.045, { ao: false });
      b.rod('#e8ac58', [-h, 0.16, i * 0.2], [h, 0.16, i * 0.2], 0.045, { ao: false });
    }
    for (let i = 0; i < 18; i++) b.ball('#f0bd6e', [Math.cos(i * 0.349) * 0.58, 0.14, Math.sin(i * 0.349) * 0.58], 0.095, { ao: false });
  }),
  cake: (b) => {
    plate(b);
    b.cyl('#ffd0dc', [0, 0.22, 0], 0.52, 0.32);
    b.cyl('#ff8fb0', [0, 0.4, 0], 0.54, 0.09, { surf: 'shiny' });
    b.cyl('#fff3e2', [0, 0.57, 0], 0.36, 0.28);
    b.cyl('#ff8fb0', [0, 0.72, 0], 0.38, 0.08, { surf: 'shiny' });
    for (let i = 0; i < 10; i++) b.ball('#ff8fb0', [Math.cos(i * 0.628) * 0.52, 0.33, Math.sin(i * 0.628) * 0.52], [0.06, 0.09, 0.06], { surf: 'shiny', ao: false });
    for (const x of [-0.18, 0, 0.18]) {
      b.cyl(x ? '#4cc9f0' : '#ffc93c', [x, 0.87, 0], 0.035, 0.24);
      b.ball('#ffb52e', [x, 1.05, 0], [0.04, 0.07, 0.04], { surf: 'bright' });
    }
  },
  cupcake: (b) => {
    b.lathe((x, y, z) => (Math.sin(Math.atan2(z, x) * 9) > 0 ? '#4cc9f0' : '#8fe0fa'), [0, 0, 0], [[0, 0], [0.28, 0], [0.4, 0.42], [0, 0.42]], { seg: 54, sharp: true });
    [[0.46, 0.33, 0.14], [0.63, 0.23, 0.125], [0.78, 0.12, 0.105]].forEach(([y, R, r]) => b.torus('#ffb3d0', [0, y, 0], R, r, { rot: [PI / 2, 0, 0], surf: 'shiny' }));
    b.ball('#ff3f55', [0, 0.94, 0], 0.1, { surf: 'shiny' });
    for (let i = 0; i < 9; i++) {
      const a = -1.2 + i * 0.3, R = i % 2 ? 0.44 : 0.33, y = i % 2 ? 0.52 : 0.69;
      b.ball(SPRINKLES[i % 5], [Math.sin(a) * R, y, Math.cos(a) * R], 0.032, { ao: false });
    }
  },
  donut: (b) => {
    b.torus('#e8b068', [0, 0.54, 0], 0.34, 0.2, { radial: 14 });
    b.torus('#ff8fc0', [0, 0.54, 0.06], 0.34, 0.185, { radial: 14, surf: 'shiny', ao: false });
    for (let i = 0; i < 14; i++) {
      const a = i * 0.449, R = 0.34 + (i % 3 - 1) * 0.085;
      b.ball(SPRINKLES[1 + (i % 5)], [Math.cos(a) * R, 0.54 + Math.sin(a) * R, i % 3 === 1 ? 0.245 : 0.22], [0.05, 0.02, 0.02], { rot: [0, 0, i * 1.7], ao: false });
    }
  },
  cookie: (b) => b.group([0, 0.5, 0], [PI / 2 - 0.2, 0, 0], 1, () => cookie(b)),
  candy: (b) => b.group([0, 0.36, 0], [0, 0, 0.25], 1, () => {
    b.banded([[-0.6, '#ff5a8a'], [-0.3, '#ffffff'], [0, '#ff5a8a'], [0.3, '#ffffff'], [0.6, '#ff5a8a'], [1, '#ffffff']], [0, 0, 0], [0.3, 0.38, 0.3], { rot: [0, 0, PI / 2], surf: 'shiny' });
    b.both((s) => b.cone('#ff9ec0', [s * 0.72, 0, 0], 0.24, 0.4, { rot: [0, 0, s * PI / 2], scale: [1, 1, 0.5], seg: 8 }));
  }),
  pizza: (b) => {
    b.puff('#ffcf5c', [0, 0.5, 0], Shapes.soft([[-0.46, 0.38], [0.46, 0.38], [0, -0.52]], 0.08), 0.12);
    b.tube('#d98f45', [[-0.5, 0.88, 0.02], [0, 0.95, 0.02], [0.5, 0.88, 0.02]], 0.1);
    [[-0.16, 0.68], [0.17, 0.6], [-0.02, 0.36]].forEach(([x, y]) => b.cyl('#e0392e', [x, y, 0.07], 0.1, 0.04, { rot: [PI / 2, 0, 0], ao: false }));
    [[0.02, 0.76], [-0.1, 0.5], [0.06, 0.2]].forEach(([x, y]) => b.ball('#45b23c', [x, y, 0.07], [0.04, 0.025, 0.02], { ao: false }));
  },
  bread: (b) => b.group([0, 0, 0], [0, -0.55, 0], 1, () => {
    const slice = (k) => Shapes.soft([[-0.3, 0], [0.3, 0], [0.3, 0.42], [0.42, 0.56], [0.26, 0.8], [-0.26, 0.8], [-0.42, 0.56], [-0.3, 0.42]]
      .map(([x, y]) => [x * k, 0.4 + (y - 0.4) * k]), 0.13);
    b.puff('#cf8238', [0, 0, 0], slice(1), 0.9, { bevel: 0.04 });
    b.puff('#fff0cf', [0, 0, 0.44], slice(0.84), 0.05, { bevel: 0.015, ao: false });
  }),
  milk: (b) => b.group([0, 0, 0], [0, -0.45, 0], 1, () => {
    b.box('#ffffff', [0, 0.36, 0], [0.5, 0.72, 0.5], { r: 0.04 });
    b.puff('#4cb4f0', [0, 0.72, 0], Shapes.poly([[-0.25, 0], [0.25, 0], [0, 0.24]]), 0.5, { bevel: 0.015 });
    b.box('#4cb4f0', [0, 0.99, 0], [0.05, 0.1, 0.5], { r: 0.02 });
    b.box('#4cb4f0', [0, 0.09, 0], [0.51, 0.18, 0.51], { r: 0.04 });
    b.ball('#4cb4f0', [0, 0.42, 0.25], [0.14, 0.14, 0.02], { ao: false });
    b.cone('#4cb4f0', [0, 0.47, 0.25], 0.115, 0.2, { scale: [1, 1, 0.14], ao: false });
    [[0.1, 0.5], [-0.12, 0.34]].forEach(([z, y]) => b.ball('#332a3a', [0.25, y, z], [0.02, 0.08, 0.1], { ao: false }));
  }),
};
