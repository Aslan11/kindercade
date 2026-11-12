/**
 * Set dressing. Each helper adds to a game's scene; anything static is merged
 * into a single mesh so a whole meadow is one draw call.
 */

import * as THREE from './three.js';
import { build } from './kit.js';
import { skyDome } from './stage.js';
import { Toy } from './toy.js';
import { tree, bush, cloud, flower } from '../models/nature.js';
import { makeRng, lerp, TAU } from './util.js';

const FLOWERS = ['#ff8fd0', '#ffffff', '#ffd23c', '#ff6b8b', '#c9a8ff'];

export function sky(game, horizon = '#dff6ff', mid = '#8fd8ff', top = '#4fb4f5') {
  game.scene.add(skyDome([[-0.2, horizon], [0.0, horizon], [0.14, mid], [0.5, top]]));
  game.scene.fog = new THREE.Fog(horizon, 34, 120);
}

/** A wide flat floor with rolling hills along the horizon. */
export function ground(game, { color = '#86d95c', hills = ['#74cc54', '#62bd4c', '#8fdc6a'], seed = 3, far = -16 } = {}) {
  const rng = makeRng(seed);
  game.scene.add(build((b) => {
    b.cyl(color, [0, -0.5, 0], 150, 1, { bevel: 0.01, seg: 40 });
    if (!hills) return;
    for (let i = 0; i < 13; i++) {
      const x = lerp(-46, 46, i / 12) + rng() * 5;
      b.ball(hills[i % hills.length], [x, -1.5, far - 6 - rng() * 16], [9 + rng() * 7, 3.4 + rng() * 3.6, 7], { seg: 20 });
    }
  }, { shadow: false }));
}

/** Clouds that drift across the sky and wrap round. They puff when poked. */
export function clouds(game, { n = 5, y = [6, 10], z = [-26, -18], span = 34, size = [3, 5], seed = 5, color } = {}) {
  const rng = makeRng(seed);
  for (let i = 0; i < n; i++) {
    const k = lerp(size[0], size[1], rng());
    const mesh = build((b) => cloud(b, color), { shadow: false, receive: false, detail: 0.7 });
    mesh.scale.setScalar(k);
    const toy = new Toy(mesh, k, { idle: 1.5 });
    toy.position.set(lerp(-span, span, (i + rng() * 0.6) / n), lerp(y[0], y[1], rng()), lerp(z[0], z[1], rng()));
    const speed = 0.25 + rng() * 0.3;
    game.every((dt) => { toy.position.x += speed * dt; if (toy.position.x > span) toy.position.x = -span; });
    game.scene.add(toy);
    game.poke(toy, { r: k * 0.4, at: [0, k * 0.25, 0], sound: 'plop' });
  }
}

/**
 * Trees, bushes, flowers and tufts scattered over a rectangle, skipping any
 * spot `keepClear(x, z)` claims for the game itself.
 */
export function greenery(game, {
  x = [-16, 16], z = [-12, 5], trees = 0, bushes = 0, flowers = 0, tufts = 0,
  keepClear = () => false, seed = 7, leaf, dark, tuft = '#62bd4c', parent = game.scene,
} = {}) {
  const rng = makeRng(seed);
  const place = (n, fn) => {
    for (let i = 0, tries = 0; i < n && tries < n * 30; tries++) {
      const px = lerp(x[0], x[1], rng()), pz = lerp(z[0], z[1], rng());
      if (keepClear(px, pz)) continue;
      fn(px, pz, i++);
    }
  };
  const mesh = build((b) => {
    place(trees, (px, pz) => b.group([px, 0, pz], [0, rng() * 2 - 1, 0], 2.6 + rng() * 1.6, () => tree(b, { leaf, dark })));
    place(bushes, (px, pz) => b.group([px, 0, pz], [0, rng() - 0.5, 0], 1.2 + rng() * 0.7, () => bush(b, leaf, dark)));
    place(flowers, (px, pz, i) => b.group([px, 0, pz], [-0.25, 0, 0], 0.42 + rng() * 0.16, () => flower(b, { petal: FLOWERS[i % FLOWERS.length] })));
    place(tufts, (px, pz) => {
      for (const a of [-0.45, 0, 0.45]) b.cone(tuft, [px + a * 0.12, 0, pz], 0.05, 0.24 + rng() * 0.1, { rot: [0, 0, -a], seg: 9 });
    });
  }, { detail: 0.6 });
  parent.add(mesh);
  return mesh;
}

/** A string of party flags sagging between two points. */
export function bunting(b, from, to, { n = 9, sag = 0.7, size = 0.42 } = {}) {
  const colors = ['#ff6b8b', '#ffc93c', '#4cc9f0', '#3ddc97', '#9b6cff'];
  const at = (t) => [lerp(from[0], to[0], t), lerp(from[1], to[1], t) - Math.sin(t * Math.PI) * sag, lerp(from[2], to[2], t)];
  b.tube('#ffffff', Array.from({ length: 9 }, (_, i) => at(i / 8)), 0.025, { radial: 5 });
  for (let i = 0; i < n; i++) b.cone(colors[i % 5], at((i + 0.5) / n), size * 0.45, size, { rot: [Math.PI, 0, 0], scale: [1, 1, 0.12], seg: 10 });
}

/** A white picket fence along x. */
export function fence(b, x0, x1, z, color = '#ffffff') {
  for (let x = x0; x <= x1; x += 0.62) b.box(color, [x, 0.42, z], [0.2, 0.84, 0.08], { seg: 1 });
  for (const y of [0.28, 0.6]) b.box(color, [(x0 + x1) / 2, y, z - 0.06], [x1 - x0, 0.1, 0.06], { seg: 1 });
}

/** Little stars pricked across a night sky. */
export function starfield(game, { n = 70, seed = 9 } = {}) {
  const rng = makeRng(seed);
  game.scene.add(build((b) => {
    for (let i = 0; i < n; i++) {
      const a = (rng() - 0.5) * TAU * 0.4, h = rng() * 0.75 - 0.15;
      b.ball(rng() < 0.3 ? '#ffe9a0' : '#ffffff', [Math.sin(a) * 30, h * 26, -Math.cos(a) * 30], 0.04 + rng() * 0.08, { surf: 'bright', seg: 6 });
    }
  }, { shadow: false, receive: false }));
}

/** A friendly sun that spins when poked. */
export function sun(game, pos = [9, 9.5, -22], size = 4) {
  const s = game.toy('sun', size, pos);
  s.traverse((o) => { o.castShadow = false; });
  game.poke(s, { r: size * 0.45 });
  return s;
}
