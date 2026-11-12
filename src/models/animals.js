/**
 * The animals. Two body plans do most of the work — a big-headed sitter that
 * faces the child, and a side-on four-legged one for anything with hooves —
 * and each species is then the handful of features a child would draw first.
 */

import { Builder, Shapes } from '../core/kit.js';

const PI = Math.PI;
const INK = '#2a1d2e';
const CREAM = '#fff3e2';
const PINK = '#ffb3c4';

/** `n` even stripes of two alternating colours, for `Builder.banded`. */
const stripes = (n, a, b) => Array.from({ length: n }, (_, i) => [-1 + ((i + 1) * 2) / n, i % 2 ? b : a]);

/* ------------------------------------------------------------------- ears */

const EARS = {
  pointy(b, H, R, fur, inner, k = 1) {
    b.both((s) => b.group(Builder.on(H, R, s * 0.62, 0.72, -0.1).p, [0, 0, -s * 0.38], [k, k, 0.55 * k], () => {
      b.cone(fur, [0, 0, 0], 0.22, 0.44);
      b.cone(inner, [0, 0.04, 0.13], 0.13, 0.3, { ao: false });
    }));
  },
  round(b, H, R, fur, inner, k = 1) {
    b.both((s) => {
      const { p } = Builder.on(H, R, s * 0.95, 0.72, 0.02 * k);
      b.ball(fur, [p[0], p[1], p[2] - 0.12], [0.2 * k, 0.2 * k, 0.11]);
      b.ball(inner, [p[0], p[1], p[2] - 0.04], [0.12 * k, 0.12 * k, 0.05], { ao: false });
    });
  },
  floppy(b, H, R, fur) {
    b.both((s) => b.ball(fur, [H[0] + s * R[0] * 0.98, H[1] - 0.02, H[2] + 0.02], [0.14, 0.34, 0.2], { rot: [0, 0, s * 0.28] }));
  },
  long(b, H, R, fur, inner) {
    b.both((s) => b.group([H[0] + s * 0.24, H[1] + R[1] + 0.26, H[2] - 0.06], [0, 0, -s * 0.16], 1, () => {
      b.ball(fur, [0, 0, 0], [0.15, 0.46, 0.09]);
      b.ball(inner, [0, -0.02, 0.06], [0.08, 0.34, 0.05], { ao: false });
    }));
  },
  side(b, H, R, fur, inner, k = 1) {
    b.both((s) => b.group([H[0] + s * (R[0] + 0.06), H[1] + R[1] * 0.42, H[2] - 0.04], [0, 0, s * 0.42], k, () => {
      b.ball(fur, [0, 0, 0], [0.21, 0.11, 0.07]);
      b.ball(inner, [s * 0.02, 0, 0.045], [0.13, 0.06, 0.04], { ao: false });
    }));
  },
};

/* ----------------------------------------------------------------- sitter */

const H = [0, 1.3, 0.04];
const HR = [0.62, 0.54, 0.54];
const B = [0, 0.5, 0];
const BR = [0.43, 0.47, 0.39];

/** Muzzle: a soft pad with a nose and a little `w` mouth. */
function muzzle(b, c, r, { pad = CREAM, nose = INK, size = 0.2, pitch = -0.3, mouth = true } = {}) {
  const { p } = Builder.on(c, r, 0, pitch, -size * 0.3);
  const pr = [size * 1.25, size * 0.9, size * 0.85];
  b.ball(pad, p, pr);
  b.spot(nose, p, pr, 0, 0.5, [size * 0.36, size * 0.26], { thick: size * 0.24, surf: 'shiny' });
  if (mouth) b.both((s) => b.line('#5a2a33', p, pr, [[0, 0.12], [s * 0.2, -0.26], [s * 0.52, -0.14]], 0.014));
  return { p, pr };
}

function sitter(b, o) {
  const { fur, belly = CREAM, limb = fur, inner = PINK } = o;
  b.ball(fur, B, BR);
  if (belly) b.spot(belly, B, BR, 0, -0.05, [0.28, 0.32], { thick: 0.06, lift: -0.02 });
  b.both((s) => b.ball(o.feet || limb, [s * 0.23, 0.1, 0.16], [0.17, 0.11, 0.22]));
  b.both((s) => b.rod(limb, [s * 0.37, 0.72, 0.06], [s * 0.47, 0.5, 0.14], 0.105));
  o.tail?.(b);
  b.part('head', [0, 0.9, 0], () => {
    b.ball(o.headFur || fur, H, HR);
    if (o.ears) EARS[o.ears](b, H, HR, o.ear || fur, inner, o.earScale);
    o.head?.(b);
    b.eyes(H, HR, { yaw: 0.44, pitch: 0.06, size: 0.1, ...o.eyes });
    if (o.cheeks !== false) b.cheeks(H, HR, { yaw: 0.78, pitch: -0.22 });
    b.anchor('hat', [H[0], H[1] + HR[1] - 0.06, H[2]]);
    b.anchor('mouth', [0, H[1] - 0.25, H[2] + HR[2]]);
  });
  o.extra?.(b);
}

const curlyTail = (color, tip) => (b) => {
  b.tube(color, [[0.1, 0.25, -0.3], [0.5, 0.2, -0.36], [0.68, 0.5, -0.3], [0.6, 0.78, -0.26]], 0.075);
  if (tip) b.ball(tip, [0.6, 0.8, -0.26], 0.11);
};
const bushyTail = (color, tip) => (b) => {
  b.tube(color, [[0.1, 0.25, -0.28], [0.5, 0.26, -0.36], [0.74, 0.55, -0.32], [0.74, 0.86, -0.26]],
    (t) => 0.1 + Math.sin(t * PI * 0.8) * 0.15, { caps: false });
  b.ball(tip, [0.74, 0.92, -0.25], [0.18, 0.22, 0.18]);
};
const whiskers = (b, color = '#ffffff') => b.both((s) => {
  for (const k of [0.05, -0.05]) {
    b.rod(color, [s * 0.34, H[1] - 0.2 + k * 0.6, 0.5], [s * 0.72, H[1] - 0.2 + k * 2.4, 0.4], 0.011, { ao: false });
  }
});
const sideStripes = (b, color, c, r, rows, len = 0.42, size = 0.035) => b.both((s) => {
  for (const p of rows) b.line(color, c, r, [[s * 1.5, p], [s * (1.5 - len * 0.6), p + 0.03], [s * (1.5 - len * 1.2), p]], (t) => size * (1 - t * 0.7));
});

/* ------------------------------------------------------------ four-legged */

const QH = [-0.62, 1.42, 0.16];
const QR = [0.42, 0.4, 0.4];
const QB = [0.1, 0.8, 0];
const QBR = [0.66, 0.4, 0.38];

function trotter(b, o) {
  const { fur, leg = fur, hoof = '#5b3a2a', inner = PINK, legLen = 0.52, snout = CREAM } = o;
  const dy = legLen - 0.52;
  b.group([0, 0, 0], [0, 0.42, 0], 1, () => {
    for (const x of [-0.3, 0.52]) {
      for (const z of [-0.2, 0.2]) {
        b.rod(leg, [x, 0.2, z], [x, 0.7 + dy, z], 0.115);
        b.cyl(hoof, [x, 0.08, z], 0.13, 0.16);
      }
    }
    b.group([0, dy, 0], [0, 0, 0], 1, () => {
      if (o.body) o.body(b); else b.ball(fur, QB, QBR);
      const neck = o.neck || 0;
      b.rod(fur, [-0.34, 0.95, 0.03], [QH[0] + 0.08, QH[1] - 0.2 + neck, 0.1], 0.2);
      o.tail?.(b);
      o.extra?.(b);
      b.part('head', [QH[0] + 0.05, QH[1] - 0.3 + neck, 0.1], () => {
        b.group([QH[0], QH[1] + neck, QH[2]], [0, -0.46, 0], 1, () => {
          const c = [0, 0, 0];
          b.ball(o.face || fur, c, QR);
          if (o.ears) EARS[o.ears](b, c, QR, o.ear || fur, inner, o.earScale ?? 0.72);
          if (snout) {
            const sp = [0, -0.16, 0.3], sr = o.snoutSize || [0.27, 0.21, 0.24];
            b.ball(snout, sp, sr);
            b.both((s) => b.spot(o.nostril || '#8a5560', sp, sr, s * 0.36, 0.2, [0.035, 0.045]));
            b.smile(sp, sr, { pitch: -0.25, width: 0.4, drop: 0.2, size: 0.013 });
          }
          o.head?.(b, c, QR);
          b.eyes(c, QR, { yaw: 0.52, pitch: 0.26, size: 0.082, ...o.eyes });
          b.cheeks(c, QR, { yaw: 0.92, pitch: -0.12, size: 0.07 });
          b.anchor('hat', [0, QR[1] - 0.05, 0]);
          b.anchor('mouth', [0, -0.25, 0.5]);
        });
      });
    });
  });
}

const hairTail = (color) => (b) =>
  b.tube(color, [[0.72, 0.95, 0], [0.92, 0.9, 0], [1.02, 0.62, 0], [0.96, 0.36, 0]], (t) => 0.07 + Math.sin(t * PI) * 0.07);
const mane = (colors) => (b) => {
  [[-0.34, 1.72], [-0.2, 1.54], [-0.12, 1.36], [-0.02, 1.2]].forEach(([x, y], i) =>
    b.ball(colors[i % colors.length], [x, y, 0], [0.19, 0.2, 0.14]));
};
const forelock = (color) => (b) => b.ball(color, [0, 0.36, 0.14], [0.15, 0.13, 0.17]);

/* ------------------------------------------------------------------ birds */

function bird(b, o) {
  const { color, belly = null, beak = '#ffa62b', wing = color, feet = '#ffa62b' } = o;
  const c = [0, 0.72, 0], r = o.shape || [0.56, 0.62, 0.52];
  b.both((s) => {
    b.rod(feet, [s * 0.18, 0.05, 0.05], [s * 0.18, 0.2, 0], 0.04);
    b.ball(feet, [s * 0.18, 0.04, 0.14], [0.13, 0.045, 0.17]);
  });
  b.ball(color, c, r);
  if (belly) b.spot(belly, c, r, 0, -0.42, [0.36, 0.34], { thick: 0.07, lift: -0.03 });
  b.both((s) => b.part(s > 0 ? 'wingR' : 'wingL', [s * r[0] * 0.92, 0.85, 0], () =>
    b.ball(wing, [s * (r[0] + 0.02), 0.62, -0.02], [0.11, 0.3, 0.24], { rot: [0, 0, s * 0.3] })));
  if (beak) {
    const { p } = Builder.on(c, r, 0, 0.12, -0.04);
    b.group(p, [PI / 2, 0, 0], 1, () => b.cone(beak, [0, 0, 0], 0.11, 0.22, { scale: [1.15, 1, 0.8] }));
  }
  o.extra?.(b, c, r);
  b.eyes(c, r, { yaw: 0.42, pitch: 0.34, size: 0.09, ...o.eyes });
  if (o.cheeks !== false) b.cheeks(c, r, { yaw: 0.68, pitch: 0.1, size: 0.085 });
  b.anchor('hat', [0, c[1] + r[1] - 0.05, 0]);
  b.anchor('mouth', [0, c[1] + 0.05, r[2] + 0.1]);
}

/* ------------------------------------------------------- bugs and swimmers */

function flutter(b, { upper, lower, dot, body, feather = false }) {
  b.both((s) => b.part(s > 0 ? 'wingR' : 'wingL', [0, 0.6, 0], () => {
    b.ball(upper, [s * 0.46, 0.84, 0], [0.42, 0.34, 0.05], { rot: [0, 0, s * 0.45] });
    b.ball(lower, [s * 0.36, 0.36, 0], [0.3, 0.27, 0.05], { rot: [0, 0, -s * 0.5] });
    b.ball(dot, [s * 0.54, 0.9, 0.04], [0.14, 0.14, 0.03], { ao: false });
    b.ball(dot, [s * 0.4, 0.33, 0.04], [0.09, 0.09, 0.03], { ao: false });
  }));
  b.rod(body, [0, 0.26, 0.06], [0, 0.72, 0.06], feather ? 0.14 : 0.1);
  const c = [0, 0.92, 0.1], r = 0.2;
  b.ball(body, c, r);
  b.both((s) => {
    if (feather) b.ball('#d9c3a0', [s * 0.17, 1.24, 0.08], [0.07, 0.2, 0.02], { rot: [0, 0, -s * 0.5] });
    else {
      b.tube(body, [[s * 0.07, 1.08, 0.1], [s * 0.14, 1.26, 0.1], [s * 0.26, 1.34, 0.1]], 0.018);
      b.ball(dot, [s * 0.27, 1.35, 0.1], 0.05);
    }
  });
  b.eyes(c, r, { yaw: 0.45, pitch: 0.12, size: 0.05, white: feather ? 0 : 0.062 });
  b.smile(c, r, { pitch: -0.25, width: 0.3, drop: 0.2, size: 0.012, color: feather ? '#5a2a33' : '#ffffff' });
}

function fishBody(b, color, fin, stripe) {
  const c = [0, 0.5, 0], r = [0.62, 0.46, 0.3];
  b.banded([[-0.72, color], [-0.52, stripe], [-0.2, color], [0.02, stripe], [1, color]], c, [r[1], r[0], r[2]], { rot: [0, 0, PI / 2] });
  b.part('tail', [0.55, 0.5, 0], () => b.both((s) =>
    b.ball(fin, [0.78, 0.5 + s * 0.16, 0], [0.26, 0.14, 0.05], { rot: [0, 0, s * 0.75] })));
  b.ball(fin, [0.06, 0.96, 0], [0.26, 0.14, 0.04], { rot: [0, 0, -0.25] });
  b.ball(fin, [0.08, 0.38, 0.28], [0.17, 0.09, 0.04], { rot: [0, -0.3, -0.5] });
  b.torus('#ff8fa8', [-0.61, 0.44, 0.03], 0.06, 0.035, { rot: [0, -1.2, 0] });
  b.part('eyes', [-0.3, 0.6, 0.25], () => b.both((s) => {
    b.ball('#ffffff', [-0.3, 0.6, s * 0.23], [0.13, 0.14, 0.07], { surf: 'bright', ao: false, ink: true });
    b.ball(INK, [-0.32, 0.6, s * 0.28], [0.08, 0.09, 0.04], { ao: false });
    b.ball('#ffffff', [-0.345, 0.635, s * 0.315], 0.026, { surf: 'bright', ao: false });
  }));
  b.ball('#ff9db0', [-0.3, 0.4, 0.245], [0.07, 0.045, 0.02], { ao: false });
}

/* ---------------------------------------------------------------- the zoo */

const foxHead = (b) => {
  b.both((s) => b.spot(CREAM, H, HR, s * 0.62, -0.32, [0.26, 0.2], { thick: 0.07, lift: -0.03, roll: s * 0.3 }));
};

export const ANIMALS = {
  fox: (b) => sitter(b, {
    fur: '#ff7f36', feet: '#5b3526', limb: '#ff7f36', ears: 'pointy', earScale: 1.15, inner: '#5b3526',
    tail: bushyTail('#ff7f36', CREAM), head: (h) => { foxHead(h); muzzle(h, H, HR, { size: 0.19 }); },
  }),
  cat: (b) => sitter(b, {
    fur: '#9aa6c0', belly: '#ffffff', ears: 'pointy', tail: curlyTail('#9aa6c0'),
    head: (h) => {
      muzzle(h, H, HR, { pad: '#ffffff', nose: '#ff7d9c', size: 0.15, pitch: -0.28 });
      whiskers(h);
      for (const y of [-0.2, 0, 0.2]) h.line('#66708c', H, HR, [[y, 0.62], [y * 1.1, 0.8], [y * 1.3, 1]], 0.03);
    },
  }),
  dog: (b) => sitter(b, {
    fur: '#e2a765', ears: 'floppy', ear: '#8a5a38',
    tail: (t) => t.tube('#e2a765', [[0.1, 0.3, -0.32], [0.4, 0.4, -0.4], [0.56, 0.7, -0.36]], 0.075),
    head: (h) => {
      h.spot('#8a5a38', H, HR, 0.46, 0.1, [0.2, 0.22], { thick: 0.02 });
      const { p, pr } = muzzle(h, H, HR, { size: 0.23 });
      h.spot('#ff7d92', p, pr, 0, -0.62, [0.07, 0.1], { thick: 0.04, lift: 0.02 });
    },
    extra: (x) => {
      x.torus('#ff4d5e', [0, 0.88, 0.02], 0.27, 0.06, { rot: [PI / 2, 0, 0] });
      x.ball('#ffd23c', [0, 0.78, 0.36], [0.07, 0.07, 0.03], { surf: 'gold' });
    },
  }),
  bear: (b) => sitter(b, { fur: '#a8703f', belly: '#eac590', ears: 'round', inner: '#eac590', head: (h) => muzzle(h, H, HR, { pad: '#eac590', size: 0.22 }) }),
  panda: (b) => sitter(b, {
    fur: '#ffffff', belly: null, limb: '#332a3a', ears: 'round', ear: '#332a3a', inner: '#54495e', eyes: { white: 0.09, size: 0.075, lift: 0.015 },
    head: (h) => {
      h.both((s) => h.spot('#332a3a', H, HR, s * 0.46, 0.02, [0.15, 0.2], { thick: 0.025, roll: s * 0.5 }));
      muzzle(h, H, HR, { pad: '#ffffff', size: 0.17 });
    },
  }),
  koala: (b) => sitter(b, {
    fur: '#a3adbd', belly: '#eef1f5', ears: 'round', earScale: 1.6, inner: '#ffffff',
    head: (h) => {
      h.spot('#3a3346', H, HR, 0, -0.1, [0.13, 0.18], { thick: 0.1, surf: 'shiny' });
      h.smile(H, HR, { pitch: -0.52, width: 0.16, drop: 0.08 });
    },
  }),
  lion: (b) => sitter(b, {
    fur: '#ffc04d', ears: 'round', inner: '#c9702a', tail: curlyTail('#ffc04d', '#c9602a'),
    head: (h) => {
      for (let i = 0; i < 13; i++) {
        const a = (i / 13) * PI * 2;
        h.ball(i % 2 ? '#d9662b' : '#c4561f', [Math.cos(a) * 0.66, H[1] + Math.sin(a) * 0.6, -0.1], 0.25);
      }
      muzzle(h, H, HR, { size: 0.2, nose: '#8a4a3a' });
    },
  }),
  tiger: (b) => sitter(b, {
    fur: '#ff9433', belly: '#ffffff', ears: 'round', inner: '#ffffff', tail: curlyTail('#ff9433', '#332a3a'),
    head: (h) => {
      muzzle(h, H, HR, { pad: '#ffffff', nose: '#ff7d9c', size: 0.19 });
      sideStripes(h, '#332a3a', H, HR, [0.2, -0.05], 0.4);
      for (const y of [-0.22, 0, 0.22]) h.line('#332a3a', H, HR, [[y, 0.55], [y * 1.1, 0.75], [y * 1.3, 1]], 0.035);
    },
    extra: (x) => sideStripes(x, '#332a3a', B, BR, [0.1, -0.2, -0.5], 0.5),
  }),
  wolf: (b) => sitter(b, {
    fur: '#6f7c96', belly: '#e8edf5', ears: 'pointy', earScale: 1.25, inner: '#3f4860', tail: bushyTail('#6f7c96', '#e8edf5'),
    cheeks: false, eyes: { white: 0.1, size: 0.07 },
    head: (h) => {
      h.both((s) => {
        h.spot('#e8edf5', H, HR, s * 0.62, -0.32, [0.27, 0.2], { thick: 0.08, lift: -0.03, roll: s * 0.3 });
        h.line('#3f4860', H, HR, [[s * 0.24, 0.3], [s * 0.45, 0.38], [s * 0.64, 0.4]], 0.028);
      });
      h.ball('#e8edf5', [0, H[1] - 0.2, 0.6], [0.2, 0.16, 0.26]);
      h.ball(INK, [0, H[1] - 0.12, 0.84], [0.085, 0.06, 0.06], { surf: 'shiny' });
      h.both((s) => h.cone('#ffffff', [s * 0.1, H[1] - 0.3, 0.72], 0.035, 0.09, { rot: [PI, 0, 0] }));
    },
  }),
  mouse: (b) => sitter(b, {
    fur: '#c4bfd0', belly: '#ffffff', ears: 'round', earScale: 1.75, feet: PINK,
    tail: (t) => t.tube(PINK, [[0.1, 0.2, -0.3], [0.55, 0.12, -0.3], [0.8, 0.36, -0.2], [0.68, 0.6, -0.2]], 0.035),
    head: (h) => {
      const { p, pr } = muzzle(h, H, HR, { pad: '#ffffff', nose: '#ff7d9c', size: 0.16 });
      h.spot('#ffffff', p, pr, 0, -0.75, [0.055, 0.06], { lift: 0.03 });
      whiskers(h, '#6b6480');
    },
  }),
  skunk: (b) => sitter(b, {
    fur: '#37303f', belly: '#ffffff', ears: 'round', earScale: 0.7, inner: '#6b6480', eyes: { white: 0.1, size: 0.075 },
    tail: (t) => {
      const path = [[0.05, 0.25, -0.3], [0.5, 0.4, -0.4], [0.74, 0.9, -0.36], [0.62, 1.3, -0.3]];
      t.tube('#37303f', path, (k) => 0.12 + Math.sin(k * PI * 0.85) * 0.2);
      t.tube('#ffffff', path.map(([x, y, z]) => [x, y, z + 0.2]), (k) => 0.05 + Math.sin(k * PI * 0.85) * 0.1, { ao: false });
    },
    head: (h) => {
      h.line('#ffffff', H, HR, [[0, 0.05], [0, 0.6], [0, 1.2], [0, 1.9]], (k) => 0.05 + k * 0.08);
      muzzle(h, H, HR, { pad: '#ffffff', nose: '#ff7d9c', size: 0.15 });
    },
  }),
  bunny: (b) => sitter(b, {
    fur: '#ffffff', belly: '#ffe9ef', ears: 'long', tail: (t) => t.ball('#ffe9ef', [0.2, 0.25, -0.38], 0.16),
    head: (h) => muzzle(h, H, HR, { pad: '#ffffff', nose: '#ff7d9c', size: 0.14 }),
  }),
  monkey: (b) => sitter(b, {
    fur: '#9a6238', belly: '#f3d2a8', cheeks: false,
    tail: (t) => t.tube('#9a6238', [[0.1, 0.25, -0.3], [0.55, 0.2, -0.3], [0.8, 0.5, -0.26], [0.66, 0.76, -0.24], [0.52, 0.62, -0.22]], 0.06),
    head: (h) => {
      h.both((s) => {
        h.ball('#9a6238', [s * 0.68, H[1], 0], [0.2, 0.2, 0.1]);
        h.ball('#f3d2a8', [s * 0.7, H[1], 0.07], [0.12, 0.12, 0.05], { ao: false });
        h.spot('#f3d2a8', H, HR, s * 0.34, 0.1, [0.25, 0.27], { thick: 0.03 });
      });
      const c = Builder.on(H, HR, 0, -0.36, -0.1).p, r = [0.36, 0.24, 0.2];
      h.ball('#f3d2a8', c, r);
      h.smile(c, r, { pitch: -0.05, width: 0.55, drop: 0.35 });
      h.both((s) => h.spot('#5a2a33', c, r, s * 0.1, 0.5, 0.022));
    },
  }),
  elephant: (b) => sitter(b, {
    fur: '#9fb4d8', belly: '#c9d8f0',
    head: (h) => {
      h.both((s) => {
        h.ball('#9fb4d8', [s * 0.82, H[1] + 0.02, -0.06], [0.4, 0.46, 0.08], { rot: [0, -s * 0.3, 0] });
        h.ball(PINK, [s * 0.82, H[1] + 0.02, 0.01], [0.28, 0.34, 0.05], { rot: [0, -s * 0.3, 0], ao: false });
        h.tube('#ffffff', [[s * 0.22, H[1] - 0.26, 0.42], [s * 0.28, H[1] - 0.4, 0.56], [s * 0.3, H[1] - 0.36, 0.68]], (t) => 0.06 - t * 0.035);
      });
      h.tube('#9fb4d8', [[0, H[1] - 0.06, 0.46], [0, H[1] - 0.3, 0.66], [0, H[1] - 0.56, 0.72], [0.08, H[1] - 0.66, 0.9]], (t) => 0.17 - t * 0.07);
    },
  }),
  frog: (b) => {
    const c = [0, 0.8, 0.05], r = [0.66, 0.46, 0.5];
    b.ball('#5fc84a', [0, 0.38, 0], [0.48, 0.38, 0.42]);
    b.spot('#dff5b0', [0, 0.38, 0], [0.48, 0.38, 0.42], 0, -0.1, [0.3, 0.24], { thick: 0.05, lift: -0.02 });
    b.both((s) => {
      b.ball('#4fb43c', [s * 0.5, 0.22, 0], [0.2, 0.22, 0.3]);
      for (const k of [-1, 0, 1]) b.ball('#4fb43c', [s * 0.5 + k * 0.1, 0.05, 0.32], [0.065, 0.05, 0.12]);
      b.rod('#4fb43c', [s * 0.22, 0.4, 0.34], [s * 0.2, 0.08, 0.42], 0.07);
    });
    b.part('head', [0, 0.55, 0], () => {
      b.ball('#5fc84a', c, r);
      b.both((s) => b.ball('#5fc84a', [s * 0.34, 1.2, 0.12], 0.24));
      b.part('eyes', [0, 1.22, 0.3], () => b.both((s) => {
        b.ball('#ffffff', [s * 0.34, 1.22, 0.24], [0.18, 0.18, 0.14], { surf: 'bright', ao: false, ink: true });
        b.ball(INK, [s * 0.33, 1.22, 0.34], [0.11, 0.12, 0.06], { ao: false });
        b.ball('#ffffff', [s * 0.33 - 0.035, 1.26, 0.395], 0.032, { surf: 'bright', ao: false });
      }));
      b.smile(c, r, { pitch: 0.05, width: 0.62, drop: 0.3, size: 0.022, color: '#2f6b1e' });
      b.cheeks(c, r, { yaw: 0.82, pitch: -0.05 });
      b.anchor('hat', [0, 1.2, 0]);
      b.anchor('mouth', [0, 0.7, 0.55]);
    });
  },

  /* ---- hooves ---- */
  horse: (b) => trotter(b, { fur: '#b4723c', snout: '#e9c79a', ears: 'pointy', earScale: 0.6, inner: '#7c4a28', tail: hairTail('#4f3020'), extra: mane(['#4f3020']), head: forelock('#4f3020'), legLen: 0.6, snoutSize: [0.25, 0.22, 0.32] }),
  unicorn: (b) => trotter(b, {
    fur: '#ffffff', snout: '#ffe3ee', hoof: '#ffc93c', ears: 'pointy', earScale: 0.6, legLen: 0.6,
    tail: hairTail((x, y) => (y > 0.75 ? '#ff8fd0' : y > 0.52 ? '#9b6cff' : '#4cc9f0')),
    extra: mane(['#ff8fd0', '#ffc93c', '#4cc9f0', '#9b6cff']),
    head: (h) => { forelock('#ff8fd0')(h); h.cone('#ffd23c', [0, 0.34, 0.2], 0.085, 0.46, { rot: [0.4, 0, 0], surf: 'gold' }); },
  }),
  zebra: (b) => trotter(b, {
    fur: '#ffffff',
    body: (x) => x.banded(stripes(11, '#ffffff', '#332a3a'), QB, [QBR[1], QBR[0], QBR[2]], { rot: [0, 0, PI / 2] }),
    snout: '#4a4154', nostril: '#1d1622', hoof: '#332a3a', ears: 'pointy', earScale: 0.6, inner: '#332a3a', legLen: 0.6,
    tail: hairTail('#332a3a'), snoutSize: [0.25, 0.22, 0.3],
    extra: (x) => {
      mane(['#332a3a'])(x);
      for (const lx of [-0.3, 0.52]) for (const z of [-0.2, 0.2]) for (const y of [0.2, 0.36]) x.torus('#332a3a', [lx, y, z], 0.105, 0.028, { rot: [PI / 2, 0, 0], ao: false });
    },
    head: (h, c, r) => {
      forelock('#332a3a')(h);
      sideStripes(h, '#332a3a', c, r, [0.5, 0.15, -0.2], 0.4, 0.03);
    },
  }),
  cow: (b) => trotter(b, {
    fur: '#ffffff', snout: PINK, ears: 'side', ear: '#332a3a', earScale: 0.85, hoof: '#332a3a', legLen: 0.42, snoutSize: [0.31, 0.21, 0.22],
    tail: (t) => { t.tube('#ffffff', [[0.74, 0.92, 0], [0.88, 0.75, 0], [0.88, 0.5, 0]], 0.035); t.ball('#332a3a', [0.88, 0.44, 0], [0.07, 0.11, 0.07]); },
    extra: (x) => {
      x.spot('#332a3a', QB, QBR, 0.3, 0.3, [0.22, 0.17], { thick: 0.03 });
      x.spot('#332a3a', QB, QBR, 0.95, -0.1, [0.14, 0.15], { thick: 0.03 });
      x.spot('#332a3a', QB, QBR, -0.35, -0.2, [0.13, 0.11], { thick: 0.03 });
      x.ball(PINK, [0.3, 0.44, 0], [0.16, 0.1, 0.14]);
      x.cyl('#ffc93c', [-0.52, 0.86, 0.24], [0.05, 0.1], 0.14, { surf: 'gold' });
    },
    head: (h, c, r) => {
      h.spot('#332a3a', c, r, 0.55, 0.36, [0.17, 0.18], { thick: 0.02 });
      h.both((s) => h.cone('#f5e2b8', [s * 0.22, 0.3, 0], 0.07, 0.22, { rot: [0, 0, -s * 0.5] }));
    },
    eyes: { white: 0.085, size: 0.065 },
  }),
  pig: (b) => trotter(b, {
    fur: '#ffb0c2', snout: null, ears: 'pointy', earScale: 0.72, inner: '#f07f9c', hoof: '#d9607f', legLen: 0.3,
    tail: (t) => t.tube('#f592ab', Array.from({ length: 12 }, (_, i) => [0.74 + i * 0.022, 0.9 + Math.cos(i * 0.95) * 0.08, Math.sin(i * 0.95) * 0.08]), 0.03),
    head: (h, c, r) => {
      h.cyl('#f592ab', [0, -0.08, 0.4], 0.17, 0.14, { rot: [PI / 2, 0, 0], scale: [1.15, 1, 0.9] });
      h.both((s) => h.ball('#b0405f', [s * 0.07, -0.08, 0.47], [0.032, 0.05, 0.02], { ao: false }));
      h.smile(c, r, { pitch: -0.68, width: 0.3, drop: 0.12, size: 0.013 });
    },
  }),
  goat: (b) => trotter(b, {
    fur: '#efe6da', snout: '#fff8ee', ears: 'side', earScale: 0.9, hoof: '#6b625c', legLen: 0.5,
    tail: (t) => t.ball('#efe6da', [0.76, 1.02, 0], [0.08, 0.15, 0.08], { rot: [0, 0, -0.5] }),
    head: (h) => {
      h.both((s) => h.tube('#9a8268', [[s * 0.15, 0.32, 0], [s * 0.2, 0.56, -0.08], [s * 0.3, 0.68, -0.28]], (t) => 0.07 - t * 0.045));
      h.cone('#cfc2b2', [0, -0.32, 0.34], 0.09, 0.28, { rot: [PI, 0, 0] });
    },
  }),
  deer: (b) => trotter(b, {
    fur: '#cf8a4c', snout: '#f7dfbf', nostril: '#3a2b23', ears: 'side', earScale: 0.95, hoof: '#4f3020', legLen: 0.66,
    tail: (t) => t.ball('#ffffff', [0.76, 1.0, 0], [0.09, 0.14, 0.09], { rot: [0, 0, -0.5] }),
    extra: (x) => [[0.1, 0.5], [0.5, 0.42], [0.3, 0.15], [0.8, 0.2], [-0.2, 0.3]].forEach(([y, p]) => x.spot('#fff3e2', QB, QBR, y, p, 0.05, { thick: 0.015 })),
    head: (h) => h.both((s) => {
      h.tube('#7c4e28', [[s * 0.14, 0.32, 0], [s * 0.24, 0.6, -0.02], [s * 0.38, 0.84, -0.02]], 0.04);
      h.rod('#7c4e28', [s * 0.21, 0.52, 0], [s * 0.4, 0.58, 0], 0.035);
      h.rod('#7c4e28', [s * 0.28, 0.68, 0], [s * 0.2, 0.84, 0], 0.035);
    }),
  }),
  sheep: (b) => trotter(b, {
    fur: '#ffffff', face: '#4a4154', leg: '#4a4154', hoof: '#332a3a', snout: null, ears: 'side', ear: '#4a4154', legLen: 0.36,
    eyes: { white: 0.09, size: 0.065, pitch: 0.12 },
    body: (x) => {
      x.ball('#ffffff', QB, [0.6, 0.38, 0.36]);
      for (let i = 0; i < 26; i++) {
        const y = 1 - (i / 25) * 1.7, a = i * 2.4, k = Math.sqrt(1 - y * y);
        x.ball('#ffffff', [QB[0] + Math.cos(a) * k * 0.6, QB[1] + y * 0.34, Math.sin(a) * k * 0.34], 0.21, { seg: 12 });
      }
    },
    head: (h, c, r) => {
      for (const [x, y] of [[-0.16, 0.34], [0.16, 0.34], [0, 0.42]]) h.ball('#ffffff', [x, y, 0.06], 0.17);
      h.smile(c, r, { pitch: -0.3, width: 0.24, drop: 0.14, size: 0.014, color: '#ffb3c4' });
    },
  }),
  giraffe: (b) => trotter(b, {
    fur: '#ffcf5c', snout: '#ffe9b8', ears: 'side', hoof: '#8a5a38', legLen: 0.78, neck: 0.62,
    tail: hairTail('#c9782e'),
    extra: (x) => {
      [[0.15, 0.4], [0.62, 0.3], [0.35, -0.15], [-0.35, 0.1], [0.95, -0.1], [-0.1, -0.35]].forEach(([y, p]) => x.spot('#c9782e', QB, QBR, y, p, 0.095, { thick: 0.02 }));
      [[-0.36, 1.2], [-0.46, 1.42], [-0.44, 1.62]].forEach(([px, py]) => x.ball('#c9782e', [px, py, 0.245], [0.075, 0.08, 0.03], { ao: false }));
    },
    head: (h) => h.both((s) => { h.rod('#ffcf5c', [s * 0.13, 0.34, 0], [s * 0.15, 0.55, 0], 0.035); h.ball('#8a5a38', [s * 0.15, 0.59, 0], 0.065); }),
  }),
  dinosaur: (b) => trotter(b, {
    fur: '#62cf6a', snout: null, hoof: '#3fa84c', legLen: 0.36, neck: 0.36,
    tail: (t) => t.tube('#62cf6a', [[0.6, 0.85, 0], [0.95, 0.72, 0], [1.25, 0.72, 0], [1.46, 0.92, 0]], (k) => 0.24 - k * 0.2),
    extra: (x) => [[-0.2, 1.17, 0.2], [0.08, 1.19, 0], [0.36, 1.14, -0.25], [0.62, 1.02, -0.55], [0.9, 0.88, -0.4]].forEach(([px, py, a]) =>
      x.cone('#ff9f1c', [px, py - 0.04, 0], 0.13, 0.24, { rot: [0, 0, a], scale: [1, 1, 0.5] })),
    head: (h, c, r) => {
      h.smile(c, r, { pitch: -0.2, width: 0.45, drop: 0.2, size: 0.016, color: '#2f6b1e' });
      h.both((s) => h.spot('#2f6b1e', c, r, s * 0.12, 0.02, 0.022));
    },
  }),

  /* ---- birds ---- */
  bird: (b) => bird(b, {
    color: '#4cc0f5', belly: '#dff5ff', wing: '#2a97d6',
    extra: (x) => {
      for (const a of [-0.4, 0, 0.4]) x.ball('#2a97d6', [a * 0.2, 1.38, 0], [0.04, 0.13, 0.04], { rot: [0, 0, -a] });
      for (const a of [-0.3, 0.3]) x.ball('#2a97d6', [0.2 + a * 0.3, 0.6, -0.6], [0.09, 0.06, 0.28], { rot: [-0.6, a, 0] });
    },
  }),
  duck: (b) => {
    b.ball('#ffd84c', [0.1, 0.4, 0], [0.56, 0.4, 0.46]);
    b.cone('#ffd84c', [0.52, 0.52, 0], 0.18, 0.34, { rot: [0, 0, -0.85] });
    b.both((s) => b.part(s > 0 ? 'wingR' : 'wingL', [0.05, 0.55, s * 0.4], () =>
      b.ball('#ffc21f', [0.16, 0.46, s * 0.42], [0.28, 0.17, 0.08], { rot: [0, 0, 0.2] })));
    b.part('head', [-0.15, 0.7, 0.05], () => b.group([-0.18, 1.0, 0.1], [0, -0.14, 0], 1, () => {
      const c = [0, 0, 0], r = 0.38;
      b.ball('#ffd84c', c, r);
      b.ball('#ff9433', [0, -0.08, 0.4], [0.2, 0.07, 0.17]);
      b.ball('#f07a1e', [0, -0.15, 0.36], [0.15, 0.05, 0.13]);
      b.ball('#ffd84c', [0.02, 0.42, 0], [0.04, 0.1, 0.04], { rot: [0, 0, -0.4] });
      b.eyes(c, r, { yaw: 0.5, pitch: 0.22, size: 0.075 });
      b.cheeks(c, r, { yaw: 0.85, pitch: -0.1, size: 0.07 });
      b.anchor('hat', [0, 0.33, 0]);
      b.anchor('mouth', [0, -0.1, 0.5]);
    }));
  },
  hen: (b) => bird(b, {
    color: '#fff6e8', wing: '#f0dcc0', beak: '#ffb52e',
    extra: (x, c, r) => {
      for (const [px, k] of [[0.15, 0.13], [0, 0.18], [-0.15, 0.13]]) x.ball('#ff4d5e', [px, 1.38, 0.06], [0.1, k, 0.08], { rot: [0, 0, -px * 2] });
      x.spot('#ff4d5e', c, r, 0, -0.16, [0.06, 0.1], { thick: 0.06, lift: 0.02 });
      for (const a of [-0.5, 0, 0.5]) x.ball(a ? '#f0dcc0' : '#e0a55e', [0.3 + a * 0.3, 0.95, -0.52], [0.1, 0.28, 0.08], { rot: [-0.5, 0, -a - 0.4] });
    },
  }),
  owl: (b) => bird(b, {
    color: '#9a6a45', belly: '#f0d9b5', wing: '#74492c', shape: [0.6, 0.66, 0.5], beak: null, cheeks: false,
    eyes: { white: 0.16, size: 0.105, yaw: 0.4, pitch: 0.36 },
    extra: (x, c, r) => {
      x.both((s) => {
        x.spot('#f0d9b5', c, r, s * 0.4, 0.36, 0.23, { thick: 0.04 });
        x.cone('#74492c', [s * 0.36, 1.2, 0.02], 0.14, 0.3, { rot: [0, 0, -s * 0.45], scale: [1, 1, 0.6] });
      });
      x.cone('#ffa62b', Builder.on(c, r, 0, 0.28, 0.02).p, 0.075, 0.17, { rot: [PI * 0.86, 0, 0] });
      for (const [y, p] of [[-0.2, -0.3], [0.2, -0.3], [0, -0.52]]) x.smile(c, r, { at: y, pitch: p, width: 0.1, drop: 0.08, size: 0.016, color: '#b98a5c', lift: 0.05 });
    },
  }),
  penguin: (b) => bird(b, {
    color: '#343a58', wing: '#262b44', shape: [0.52, 0.68, 0.48], eyes: { lift: 0.035, yaw: 0.36 },
    extra: (x, c, r) => {
      x.spot('#ffffff', c, r, 0, -0.3, [0.36, 0.42], { thick: 0.09, lift: -0.04 });
      x.both((s) => x.spot('#ffffff', c, r, s * 0.34, 0.3, [0.22, 0.25], { thick: 0.035 }));
    },
  }),
  bat: (b) => {
    const c = [0, 0.62, 0], r = [0.42, 0.44, 0.38];
    b.ball('#7a55d6', c, r);
    EARS.pointy(b, c, r, '#7a55d6', '#c9a8ff', 0.95);
    b.both((s) => b.part(s > 0 ? 'wingR' : 'wingL', [s * 0.32, 0.65, 0], () => {
      const w = Shapes.soft([[0, 0.1], [0.4, 0.42], [0.82, 0.3], [0.86, -0.2], [0.62, -0.06], [0.5, -0.32], [0.3, -0.1], [0.1, -0.28]].map(([x, y]) => [s * x, y]), 0.05);
      b.puff('#54399e', [s * 0.3, 0.6, -0.05], w, 0.07);
    }));
    b.both((s) => {
      b.cone('#ffffff', Builder.on(c, r, s * 0.16, -0.3, 0).p, 0.035, 0.09, { rot: [PI, 0, 0] });
      b.ball('#54399e', [s * 0.14, 0.17, 0.05], [0.07, 0.07, 0.1]);
    });
    b.eyes(c, r, { white: 0.095, size: 0.07, pitch: 0.12 });
    b.smile(c, r, { pitch: -0.2, width: 0.3, drop: 0.1, color: '#2a1d2e' });
  },

  /* ---- minibeasts ---- */
  bee: (b) => {
    b.banded([[-0.72, '#ffd23c'], [-0.42, '#3a2b23'], [-0.1, '#ffd23c'], [0.2, '#3a2b23'], [1, '#ffd23c']], [0.18, 0.46, 0], [0.4, 0.56, 0.4], { rot: [0, 0, PI / 2] });
    b.cone('#3a2b23', [0.7, 0.46, 0], 0.07, 0.17, { rot: [0, 0, -PI / 2] });
    b.both((s) => b.part(s > 0 ? 'wingR' : 'wingL', [0.15, 0.82, 0], () =>
      b.ball('#cfefff', [0.26, 1.06, s * 0.16], [0.2, 0.32, 0.04], { rot: [s * 0.5, 0, -0.35], surf: 'shiny' })));
    b.group([-0.36, 0.58, 0.1], [0, -0.1, 0], 1, () => {
      const c = [0, 0, 0], r = 0.36;
      b.ball('#ffd23c', c, r);
      b.both((s) => {
        b.tube('#3a2b23', [[s * 0.12, 0.3, 0], [s * 0.18, 0.5, 0.02], [s * 0.28, 0.58, 0.04]], 0.022);
        b.ball('#3a2b23', [s * 0.29, 0.59, 0.04], 0.055);
      });
      b.face(c, r, { scale: 1.25, size: 0.075 });
      b.anchor('hat', [0, 0.31, 0]);
    });
  },
  ant: (b) => {
    const col = '#b5452f';
    b.ball(col, [0.52, 0.46, 0], [0.38, 0.28, 0.28]);
    b.ball(col, [0.08, 0.44, 0], [0.2, 0.17, 0.17]);
    for (const x of [-0.06, 0.08, 0.22]) b.both((s) =>
      b.tube('#7a2a1c', [[x, 0.42, s * 0.1], [x + (x - 0.08) * 0.9, 0.44, s * 0.32], [x + (x - 0.08) * 1.6, 0.03, s * 0.42]], 0.028));
    b.group([-0.34, 0.66, 0.06], [0, -0.1, 0], 1, () => {
      const c = [0, 0, 0], r = 0.33;
      b.ball(col, c, r);
      b.both((s) => {
        b.tube('#7a2a1c', [[s * 0.1, 0.28, 0], [s * 0.16, 0.52, 0.02], [s * 0.3, 0.56, 0.1]], 0.022);
        b.ball('#7a2a1c', [s * 0.31, 0.56, 0.1], 0.045);
      });
      b.eyes(c, r, { white: 0.095, size: 0.065, pitch: 0.16 });
      b.smile(c, r, { pitch: -0.2, width: 0.3, drop: 0.16, size: 0.014, color: '#4a140c' });
    });
  },
  ladybug: (b) => {
    const c = [0, 0.16, -0.1], r = [0.56, 0.52, 0.6];
    b.dome('#ff4040', c, r, { surf: 'shiny' });
    b.line(INK, c, r, [[0, 0.3], [0, 0.9], [0, 1.6], [0, 2.4]], 0.018);
    b.both((s) => {
      for (const [y, p] of [[0.75, 0.35], [0.5, 0.85], [1.35, 0.55], [1.6, 1.1]]) b.spot(INK, c, r, s * y, p, 0.095, { thick: 0.02 });
      for (const z of [-0.4, -0.1, 0.2]) b.rod(INK, [s * 0.42, 0.16, z], [s * 0.6, 0.04, z], 0.035);
      b.tube(INK, [[s * 0.1, 0.55, 0.5], [s * 0.16, 0.74, 0.56], [s * 0.27, 0.8, 0.6]], 0.02);
      b.ball(INK, [s * 0.28, 0.8, 0.6], 0.05);
    });
    const hc = [0, 0.32, 0.46], hr = [0.34, 0.29, 0.28];
    b.ball('#3a3040', hc, hr);
    b.eyes(hc, hr, { white: 0.09, size: 0.06, pitch: 0.2 });
    b.smile(hc, hr, { pitch: -0.2, width: 0.3, drop: 0.16, size: 0.013, color: '#ff9db0' });
  },
  butterfly: (b) => flutter(b, { upper: '#ff7ac8', lower: '#9b6cff', dot: '#ffe27a', body: '#5b3f9e' }),
  moth: (b) => flutter(b, { upper: '#b89a74', lower: '#94785a', dot: '#6b5138', body: '#e8d8bc', feather: true }),
  snake: (b) => {
    const pts = [];
    for (let i = 0; i <= 40; i++) {
      const t = i / 40, a = t * PI * 4.4 + 0.9, k = 0.62 - t * 0.36;
      pts.push([Math.cos(a) * k, 0.15 + t * 0.42, Math.sin(a) * k * 0.9]);
    }
    const end = pts[pts.length - 1];
    pts.push([end[0] * 0.5, 0.8, 0.02], [0, 1.0, 0.08]);
    b.tube('#58c44a', pts, (t) => 0.06 + Math.min(1, t * 6) * 0.1,
      { along: (t) => (Math.sin(t * 90) > 0.6 && t < 0.93 ? '#ffd23c' : '#58c44a') });
    b.part('head', [0, 1, 0.08], () => {
      const c = [0, 1.16, 0.16], r = [0.3, 0.24, 0.3];
      b.ball('#58c44a', c, r);
      b.eyes(c, r, { white: 0.085, size: 0.06, pitch: 0.36, yaw: 0.5 });
      b.rod('#ff4d5e', [0, 1.08, 0.42], [0, 1.02, 0.56], 0.02);
      b.both((s) => b.rod('#ff4d5e', [0, 1.02, 0.56], [s * 0.05, 0.96, 0.63], 0.018));
      b.anchor('hat', [0, 1.36, 0.14]);
    });
  },
  turtle: (b) => b.group([0, 0, 0], [0, 0.4, 0], 1, () => {
    const c = [0.1, 0.24, 0], r = [0.62, 0.56, 0.52];
    b.dome('#3fa84c', c, r, { surf: 'shiny' });
    b.torus('#2f8a3c', c, 0.56, 0.08, { rot: [PI / 2, 0, 0], scale: [1.1, 0.92, 1] });
    for (const [y, p] of [[0, 0.5], [0.85, 0.42], [-0.85, 0.42], [0, 1.25], [1.6, 0.75], [-1.6, 0.75]]) b.spot('#8fdc6a', c, r, y, p, 0.15, { thick: 0.03, seg: 6 });
    for (const x of [-0.26, 0.46]) for (const z of [-0.34, 0.34]) b.ball('#a8e06b', [x, 0.13, z], [0.16, 0.14, 0.16]);
    b.cone('#a8e06b', [0.7, 0.26, 0], 0.08, 0.22, { rot: [0, 0, -1.5] });
    b.part('head', [-0.45, 0.4, 0.05], () => {
      b.rod('#a8e06b', [-0.45, 0.36, 0.04], [-0.64, 0.55, 0.1], 0.13);
      b.group([-0.7, 0.68, 0.14], [0, -0.44, 0], 1, () => {
        b.ball('#a8e06b', [0, 0, 0], 0.29);
        b.face([0, 0, 0], 0.29, { scale: 1.3, size: 0.065 });
        b.anchor('hat', [0, 0.25, 0]);
      });
    });
  }),

  /* ---- sea ---- */
  fish: (b) => fishBody(b, '#ff8a3d', '#ffc14d', '#ffffff'),
  whale: (b) => b.group([0, 0, 0], [0, -0.25, 0], 1, () => {
    const c = [0, 0.52, 0], r = [0.68, 0.52, 0.56];
    b.banded([[-0.45, '#e6f7ff'], [1, '#3fa9f0']], c, r);
    b.tube('#3fa9f0', [[0.4, 0.45, -0.1], [0.8, 0.46, -0.16], [1.02, 0.72, -0.16], [1.04, 0.95, -0.16]], (t) => 0.32 - t * 0.24, { caps: false });
    b.both((s) => {
      b.ball('#3fa9f0', [1.04 + s * 0.17, 1.02, -0.16], [0.21, 0.09, 0.12], { rot: [0, 0, s * 0.45] });
      b.tube('#9fe4ff', [[0, 1.02, 0], [s * 0.04, 1.3, 0], [s * 0.2, 1.42, 0], [s * 0.3, 1.28, 0]], 0.045, { surf: 'shiny' });
    });
    b.ball('#2a8bd0', [0.34, 0.26, 0.48], [0.2, 0.08, 0.13], { rot: [0.4, 0, -0.5] });
    b.face(c, r, { at: 0.2, scale: 1.15, size: 0.085, pitch: 0.06 });
  }),
  crab: (b) => {
    const c = [0, 0.42, 0], r = [0.56, 0.34, 0.4];
    b.ball('#ff5a4d', c, r);
    b.both((s) => {
      for (const k of [0, 1, 2]) b.tube('#e03e34', [[s * 0.4, 0.34, 0.16 - k * 0.16], [s * (0.68 + k * 0.04), 0.34 - k * 0.04, 0.2 - k * 0.2], [s * (0.78 + k * 0.03), 0.03, 0.22 - k * 0.22]], 0.045);
      b.part(s > 0 ? 'armR' : 'armL', [s * 0.46, 0.56, 0.1], () => {
        b.tube('#e03e34', [[s * 0.46, 0.54, 0.1], [s * 0.7, 0.66, 0.12], [s * 0.76, 0.86, 0.12]], 0.06);
        b.ball('#ff5a4d', [s * 0.78, 0.96, 0.12], [0.19, 0.16, 0.13]);
        b.both((k) => b.cone('#ff5a4d', [s * 0.78 + k * 0.1, 1.02, 0.12], 0.09, 0.24, { rot: [0, 0, k * 0.3] }));
      });
      b.rod('#e03e34', [s * 0.17, 0.68, 0.1], [s * 0.19, 0.86, 0.12], 0.035);
    });
    b.part('eyes', [0, 0.94, 0.14], () => b.both((s) => {
      b.ball('#ffffff', [s * 0.19, 0.94, 0.12], 0.125, { surf: 'bright', ao: false, ink: true });
      b.ball(INK, [s * 0.185, 0.94, 0.21], [0.07, 0.08, 0.04], { ao: false });
      b.ball('#ffffff', [s * 0.185 - 0.025, 0.97, 0.25], 0.022, { surf: 'bright', ao: false });
    }));
    b.smile(c, r, { pitch: 0.2, width: 0.3, drop: 0.3, size: 0.02 });
    b.cheeks(c, r, { yaw: 0.55, pitch: 0.1, size: 0.08, color: '#ffb0a0' });
  },
  octopus: (b) => {
    const c = [0, 0.86, 0], r = [0.52, 0.54, 0.48];
    b.ball('#a86cff', c, r);
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * PI * 2 + 0.39, x = Math.cos(a), z = Math.sin(a);
      b.tube('#a86cff', [[x * 0.26, 0.55, z * 0.26], [x * 0.42, 0.22, z * 0.4], [x * 0.68, 0.09, z * 0.6], [x * 0.86, 0.24, z * 0.72]], (t) => 0.13 - t * 0.07);
    }
    for (const [y, p] of [[0.5, 0.8], [0.15, 1.05], [0.85, 0.6]]) b.spot('#d3b4ff', c, r, y, p, 0.06, { thick: 0.015 });
    b.face(c, r, { scale: 1.15, size: 0.09, pitch: -0.08 });
    b.anchor('hat', [0, 1.35, 0]);
  },
};
