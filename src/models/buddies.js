/**
 * The buddies. Each child picks one, and it hosts every game for them.
 *
 * They share a rig — head, arms, mouth, eyes, optional tail, a hat peg — so
 * any of them can cheer, sulk, talk and dance; only the trimmings differ.
 */

import { Builder, Shapes } from '../core/kit.js';

const PI = Math.PI;
const H = [0, 1.32, 0.03], HR = [0.7, 0.6, 0.58];
const B = [0, 0.48, 0], BR = [0.4, 0.44, 0.36];

/** A big cartoon eye: white, coloured iris, pupil, two catchlights. */
function eye(b, yaw, pitch, k, iris) {
  b.spot('#ffffff', H, HR, yaw, pitch, [k * 0.9, k], { thick: k * 0.4, surf: 'bright', ink: true });
  const inward = yaw * 0.94;
  b.spot(iris, H, HR, inward, pitch - 0.02, [k * 0.72, k * 0.82], { thick: k * 0.2, lift: k * 0.27, surf: 'bright' });
  b.spot('#1d1030', H, HR, inward, pitch - 0.02, [k * 0.5, k * 0.6], { thick: k * 0.12, lift: k * 0.4, surf: 'bright' });
  const { p } = Builder.on(H, HR, inward, pitch, k * 0.52);
  b.ball('#ffffff', [p[0] - k * 0.22, p[1] + k * 0.28, p[2]], k * 0.23, { surf: 'bright', ao: false });
  b.ball('#ffffff', [p[0] + k * 0.22, p[1] - k * 0.3, p[2]], k * 0.1, { surf: 'bright', ao: false });
}

function buddy(b, { skin, trim, belly, iris, eyes = 2, head, body, tail }) {
  b.ball(skin, B, BR);
  b.spot(belly, B, BR, 0, -0.05, [0.26, 0.29], { thick: 0.06, lift: -0.02 });
  b.both((s) => {
    b.ball(trim, [s * 0.21, 0.1, 0.12], [0.17, 0.115, 0.22]);
    b.part(s > 0 ? 'armR' : 'armL', [s * 0.34, 0.72, 0.05], () => {
      b.rod(skin, [s * 0.35, 0.7, 0.05], [s * 0.47, 0.5, 0.1], 0.095);
      b.ball(trim, [s * 0.485, 0.46, 0.11], 0.12);
    });
  });
  if (tail) b.part('tail', [0, 0.3, -0.28], () => tail(b));
  body?.(b);
  b.part('head', [0, 0.88, 0], () => {
    b.ball(skin, H, HR, { seg: 28 });
    head(b);
    b.part('eyes', Builder.on(H, HR, 0, 0.1).p, () => {
      if (eyes === 1) eye(b, 0, 0.16, 0.3, iris);
      else b.both((s) => eye(b, s * 0.43, 0.1, 0.195, iris));
    });
    b.cheeks(H, HR, { yaw: 0.8, pitch: -0.28, size: 0.1 });
    b.smile(H, HR, { pitch: -0.42, width: 0.2, drop: 0.09, size: 0.02, color: '#3a1030' });
    const m = Builder.on(H, HR, 0, -0.56, -0.015);
    b.part('mouth', Builder.on(H, HR, 0, -0.5).p, () => {
      b.ball('#6e1a38', m.p, [0.125, 0.115, 0.05], { ao: false, rot: m.rot });
      b.ball('#ff7d92', [m.p[0], m.p[1] - 0.05, m.p[2] + 0.005], [0.075, 0.05, 0.04], { ao: false, rot: m.rot });
    });
    b.anchor('hat', [0, H[1] + HR[1] - 0.07, H[2]]);
  });
}

const horns = (b, color, yaw, len) => b.both((s) =>
  b.cone(color, Builder.on(H, HR, s * yaw, 0.78, -0.06).p, 0.105, len, { rot: [-0.15, 0, -s * 0.5] }));

export const BUDDY_MODELS = {
  /** A baby dragon. */
  ziggy: (b) => buddy(b, {
    skin: '#2fd0b5', trim: '#1aa590', belly: '#fff0b8', iris: '#ff9f1c',
    head: (h) => {
      horns(h, '#ffd23c', 0.62, 0.36);
      h.both((s) => h.spot('#128070', H, HR, s * 0.09, -0.2, 0.022));
    },
    body: (x) => x.both((s) => x.puff('#ff8a4c', [s * 0.26, 0.62, -0.28],
      Shapes.soft([[0, -0.08], [0.16, 0.36], [0.6, 0.44], [0.54, 0.14], [0.42, 0.18], [0.36, -0.04], [0.22, 0.02]].map(([px, py]) => [s * px, py]), 0.04), 0.06)),
    tail: (t) => {
      t.tube('#2fd0b5', [[0.05, 0.25, -0.26], [0.42, 0.14, -0.36], [0.72, 0.28, -0.3], [0.84, 0.54, -0.26]], (k) => 0.16 - k * 0.1);
      t.pillow('#ff8a4c', [0.87, 0.66, -0.25], Shapes.heart(0.15), 0.08, { rot: [0, 0, PI - 0.2] });
    },
  }),

  /** An axolotl. */
  momo: (b) => buddy(b, {
    skin: '#ffa6c9', trim: '#ff7db0', belly: '#ffe9f2', iris: '#3fb0f5',
    head: (h) => h.both((s) => [[0.5, 0.75], [0.16, 0.2], [-0.16, -0.32]].forEach(([dy, a]) =>
      h.ball('#f0408c', [s * (0.72 + Math.cos(a) * 0.16 - Math.abs(dy) * 0.22), H[1] + dy * 0.78, -0.04], [0.26, 0.085, 0.07], { rot: [0, 0, s * a] }))),
    tail: (t) => t.ball('#ff7db0', [0.42, 0.34, -0.36], [0.4, 0.2, 0.06], { rot: [0, -0.5, 0.5] }),
  }),

  /** A little robot. */
  bolt: (b) => buddy(b, {
    skin: '#5aa2ff', trim: '#ffd23c', belly: '#dcecff', iris: '#2fe0a0',
    head: (h) => {
      h.both((s) => {
        h.cyl('#ffd23c', [s * 0.72, H[1], 0], 0.17, 0.14, { rot: [0, 0, PI / 2], surf: 'shiny' });
        h.cyl('#ff5a6e', [s * 0.8, H[1], 0], 0.09, 0.08, { rot: [0, 0, PI / 2] });
      });
      h.tube('#3a4a7a', [[0.3, 1.82, 0], [0.38, 2.02, 0], [0.5, 2.14, 0]], 0.028);
      h.ball('#ff5a6e', [0.52, 2.18, 0], 0.09, { surf: 'glow' });
    },
    body: (x) => x.pillow('#ffb52e', [0, 0.47, 0.395], Shapes.poly([[0.03, 0.15], [-0.09, -0.02], [-0.01, -0.02], [-0.04, -0.15], [0.09, 0.03], [0.01, 0.03]]), 0.04, { ao: false }),
  }),

  /** A one-eyed fuzzball. */
  fizz: (b) => buddy(b, {
    skin: '#a878ff', trim: '#7a4fe0', belly: '#ead9ff', iris: '#58d86a', eyes: 1,
    head: (h) => {
      horns(h, '#ffffff', 0.8, 0.3);
      for (const a of [-0.45, 0, 0.45]) h.cone('#7a4fe0', [a * 0.3, 1.84, 0.06], 0.085, 0.26, { rot: [0.1, 0, -a] });
      h.cone('#ffffff', Builder.on(H, HR, 0.13, -0.47, 0.005).p, 0.035, 0.08, { rot: [PI - 0.4, 0, 0], ao: false, ink: true });
    },
    tail: (t) => t.ball('#7a4fe0', [0.26, 0.24, -0.36], 0.16),
  }),

  /** A seedling who got up and walked. */
  sprout: (b) => buddy(b, {
    skin: '#8fe052', trim: '#58b83c', belly: '#f4ffd6', iris: '#b4723c',
    head: (h) => {
      h.rod('#3f9e38', [0, 1.86, 0], [0, 2.02, 0], 0.035);
      h.both((s) => h.puff('#3fb84a', [0, 2.0, 0], Shapes.leaf(0.46, 0.22), 0.06, { rot: [0, 0, -s * 1.05] }));
      h.both((s) => [0, 0.09].forEach((k) => h.spot('#58b83c', H, HR, s * (0.2 + k), -0.2 + k * 0.4, 0.018)));
    },
    body: (x) => {
      for (let i = 0; i < 7; i++) x.ball('#ffd23c', [Math.sin(-1.5 + i * 0.5) * 0.3, 0.84, Math.cos(-1.5 + i * 0.5) * 0.27], [0.12, 0.07, 0.12]);
    },
  }),

  /** A kitten from outer space. */
  nova: (b) => buddy(b, {
    skin: '#ffb03c', trim: '#ffffff', belly: '#fff3d6', iris: '#9b6cff',
    head: (h) => {
      h.both((s) => h.group(Builder.on(H, HR, s * 0.66, 0.7, -0.1).p, [0, 0, -s * 0.42], [1.15, 1.15, 0.6], () => {
        h.cone('#ffb03c', [0, 0, 0], 0.23, 0.42);
        h.cone('#ff8fb8', [0, 0.04, 0.14], 0.135, 0.28, { ao: false });
      }));
      h.pillow('#ffffff', Builder.on(H, HR, 0, 0.62, 0.01).p, Shapes.star(0.13, 0.065), 0.05, { rot: [-0.6, 0, 0], ao: false, ink: true });
      h.spot('#ff6b8b', H, HR, 0, -0.24, [0.05, 0.036], { thick: 0.03 });
    },
    body: (x) => x.torus('#9b6cff', [0, 0.86, 0.02], 0.27, 0.075, { rot: [PI / 2, 0, 0], surf: 'shiny' }),
    tail: (t) => {
      t.tube('#ffb03c', [[0.08, 0.25, -0.28], [0.5, 0.2, -0.34], [0.72, 0.48, -0.3], [0.66, 0.78, -0.26]], 0.075);
      t.pillow('#ffd23c', [0.66, 0.92, -0.24], Shapes.star(0.19, 0.1), 0.1, { surf: 'glow' });
    },
  }),
};
