/**
 * Kindercade Island: the launcher is a place, not a menu.
 *
 * The attractions stand on three terraces, and the toys the child has won
 * parade along the beach below. The tappable cards are real DOM buttons (focusable,
 * labelled) kept in step with the 3D podiums underneath them.
 */

import * as THREE from './core/three.js';
import { Game, V } from './core/engine.js';
import { Toy, block, shapeToy as shape } from './core/toy.js';
import { build } from './core/kit.js';
import { text3d } from './core/glyphs.js';
import { sky, clouds, sun, greenery, bunting } from './core/scenery.js';
import { balloon } from './models/things.js';
import { progress, HATS } from './core/progress.js';
import { GAMES, SUBJECTS } from './games/index.js';
import { toyName } from './data/words.js';
import { rand, sample } from './core/util.js';

const STEP_Z = 2.6, COL = 2.7;
/** Nearer terraces are drawn in a little, so all three rows line up on screen. */
const near = (r) => 1 - r * 0.075;
const BEACH = { y: -1.35, z: 2.9, half: 11 };
const rowY = (r) => [4.2, 2, 0][r];          // row 0 is the top terrace
const rowZ = (r) => (r - 2) * STEP_Z;

const float = (toy, k = 0.08) => { toy.float = k; return toy; };
const numbered = (color, n) => {
  const m = build((b) => { balloon(b, color); b.rod('#ffffff', [0, -0.08, 0], [0, -0.6, 0], 0.012); });
  const t = text3d(n, { height: 0.34, shadow: false });
  t.position.set(0, 0.62, 0.42);
  m.add(t);
  return float(new Toy(m, 1), 0.1);
};

/** What stands on each podium: [toy, x, y, z]. */
const SHOWS = {
  'counting-critters': () => [[new Toy('duck', 1.15), -0.5, 0, 0], [new Toy('bunny', 1.3), 0.55, 0, -0.1], [new Toy('ladybug', 0.6), 0.05, 0, 0.62]],
  'balloon-math': () => [[numbered('#4cb4f0', '2'), -0.68, 0.5, -0.1], [numbered('#ffc21f', '3'), 0.68, 0.46, -0.1], [numbered('#ff4d5e', '5'), 0, 0.62, 0.2]],
  'cookie-kitchen': () => [[new Toy('bear', 1.3).wear('chef-hat'), -0.4, 0, -0.1], [new Toy('cookie', 0.8), 0.62, 0, 0.3]],
  'sound-safari': () => [[new Toy('lion', 1.4), -0.35, 0, 0], [new Toy('camera', 0.75), 0.68, 0, 0.36]],
  'word-builder': () => [[new Toy('train', 1.5), 0.3, 0, -0.1], [block('a', { size: 0.62, color: '#ff6b8b', depth: 0.5 }), -0.8, 0, 0.4]],
  'letter-trace': () => {
    const a = text3d('A', { height: 1.05, color: '#ff6b8b', weight: 0.13 });
    a.position.y = 0.68;
    return [[new Toy(a, 1.3), -0.35, 0, -0.1], [new Toy('car', 0.95), 0.55, 0, 0.36]];
  },
  'memory-match': () => [[new Toy('owl', 1.05).wear('wizard-hat'), -0.4, 0, 0], [block('?', { size: 0.85, width: 0.7, color: '#9b6cff', depth: 0.2 }), 0.62, 0, 0.3]],
  'pattern-party': () => [[shape('heart', 'pink', 0.8), -0.8, 0, 0.1], [shape('star', 'yellow', 0.95), 0, 0, -0.1], [shape('heart', 'pink', 0.8), 0.8, 0, 0.1]],
  'see-saw': () => {
    const plank = build((b) => {
      b.cone('#4c8cf0', [0, 0, 0], 0.26, 0.42);
      b.box('#ff5a6e', [0, 0.46, 0], [2, 0.1, 0.5], { rot: [0, 0, 0.26] });
    });
    return [[new Toy(plank, 1), 0, 0, 0.1], [new Toy('elephant', 1.05), -0.68, 0.3, 0.1], [new Toy('mouse', 0.6), 0.76, 0.7, 0.1]];
  },
  'frog-hop': () => [[new Toy('frog', 1.1), -0.35, 0, 0], [block('4', { size: 0.66, color: '#3dcc77', depth: 0.4 }), 0.66, 0, 0.35]],
  'word-fishing': () => [[new Toy('boat', 1.35), -0.3, 0, -0.1], [float(new Toy('fish', 0.85)), 0.62, 0.1, 0.4]],
  'starry-abc': () => [[float(new Toy('rocket', 1.4)), -0.42, 0.05, 0], [float(new Toy('star', 0.8)), 0.55, 0.35, 0.2]],
  'robot-road': () => [[new Toy('robot', 1.35), -0.36, 0, 0], [float(new Toy('gem', 0.62)), 0.62, 0.1, 0.36]],
  'sort-shop': () => [[new Toy('box', 1), -0.42, 0, 0], [shape('circle', 'blue', 0.58), 0.4, 0, 0.45], [shape('triangle', 'orange', 0.66), 0.84, 0, -0.05]],
  'jigsaw-garden': () => [[new Toy('puzzle', 1.15), -0.3, 0, 0], [new Toy('sunflower', 1.2), 0.68, 0, 0.1]],
};

export default class Home extends Game {
  static meta = { id: 'home', tint: '#ff8a4c', music: 'home' };

  init() {
    this.view = { pos: V(0, 7.6, 26), look: V(0, 2.12, -2), fov: 21 };
    this.sway = 0;           // the DOM cards must stay glued to their podiums
    this._intro = 0;
    this.light({ span: 12, centre: [0, 2.5, -3] });
    sky(this, '#d9f5ff', '#93dcff', '#55b9f7');
    sun(this, [-0.9, 5.7, -16], 2.4);
    clouds(this, { n: 6, y: [2, 8], z: [-40, -28], span: 36, size: [4, 6] });
    this.buildIsland();

    this.podiums = {};
    SUBJECTS.forEach((subject, r) => GAMES.filter((g) => g.subject === subject).forEach((g, c) => {
      const group = new THREE.Group();
      group.add(build((b) => {
        b.cyl(g.tint, [0, 0.11, 0], [1.28, 1.36], 0.22, { surf: 'shiny', seg: 36 });
        b.cyl('#ffffff', [0, 0.2, 0], 1.14, 0.1, { seg: 36 });
      }));
      const acts = SHOWS[g.id]().map(([toy, x, y, z]) => { toy.position.set(x, y + 0.25, z); group.add(toy); return toy; });
      group.scale.setScalar(0.94 * near(r));
      const podium = new Toy(group, 1.7, { idle: 0 });
      podium.position.set((c - 2) * COL * near(r), rowY(r), rowZ(r));
      podium.acts = acts;
      this.scene.add(podium);
      this.podiums[g.id] = podium;
    }));

    this.addPal([0, BEACH.y, BEACH.z + 0.3], { size: 1.4 });
    this.parade();
    this.nextShow = 2;
  }

  buildIsland() {
    this.scene.add(build((b) => {
      b.cyl('#45bdf0', [0, -2.2, 0], 150, 1, { seg: 32, ink: false });
      b.cyl('#ffe3a8', [0, BEACH.y - 0.5, -4], 15, 1, { seg: 48, bevel: 0.3, scale: [1, 1, 0.68] });
      b.cyl('#bdf0ff', [0, -2.14, -4], 15.7, 1, { seg: 48, scale: [1, 1, 0.68], ink: false });
      for (let r = 0; r < 3; r++) {
        const w = 15.2 + r * 1.1, y = rowY(r), front = rowZ(r) + 1.3;
        b.box('#d99a62', [0, y - 1.7, front - 4], [w, 3.2, 8], { r: 0.7, seg: 3 });
        b.box('#86d95c', [0, y - 0.2, front - 4], [w + 0.24, 0.4, 8.24], { r: 0.2 });
        for (let x = -w / 2 + 0.5; x < w / 2; x += 0.66) b.ball('#86d95c', [x, y - 0.3, front + 0.04], [0.38, 0.2 + Math.abs(Math.sin(x * 5)) * 0.09, 0.12], { seg: 12 });
      }
      bunting(b, [-7.2, rowY(0) + 2.3, -7.6], [7.2, rowY(0) + 2.3, -7.6], { n: 18, sag: 0.55, size: 0.36 });
      b.both((s) => b.cyl('#ffffff', [s * 7.2, rowY(0) + 1.15, -7.6], 0.07, 2.4));
    }));
    for (let r = 0; r < 3; r++) {
      const edge = 7.2 + r * 0.55;
      greenery(this, {
        x: [-edge, edge], z: [rowZ(r) - 1.1, rowZ(r) + 1], flowers: 6, tufts: 8, seed: 20 + r,
        keepClear: (x) => Math.abs(x) < (COL * 2 + 1.35) * near(r),
      }).position.y = rowY(r);
    }
    greenery(this, { x: [-7, 7], z: [-10, -8.6], bushes: 9, seed: 4 }).position.y = rowY(0);
  }

  /** The child's toys hop along the beach in an endless parade. */
  parade() {
    const toys = progress.toys.filter((t) => !HATS.includes(t));
    const cast = [...toys.slice(-2), ...sample(toys.slice(0, -2), 12)];
    const gap = (BEACH.half * 2) / Math.max(cast.length, 8);
    cast.forEach((name, i) => {
      const toy = this.toy(name, 0.9, [1.5 + i * gap, BEACH.y, BEACH.z - 0.5]);
      this.every((dt, t) => {
        toy.position.x -= dt * 0.5;
        if (toy.position.x < -BEACH.half) toy.position.x += BEACH.half * 2;
        if (toy.position.x > BEACH.half) toy.position.x -= BEACH.half * 2;
        if (toy.hopT === 1 && (t + i * 0.37) % 1.4 < dt) toy.hop(0.2, 0.36);
      });
      this.hot(toy, { r: 0.5, poke: true, tap: () => { toy.hop(0.7, 0.55).spin(); this.audio.squeak(); this.audio.speak(toyName(name)); } });
    });
  }

  showHud() { this.placeCards(); }
  resized() { this.placeCards(); }

  /** Pin each DOM card over its podium. */
  placeCards() {
    for (const [id, podium] of Object.entries(this.podiums)) {
      const card = document.querySelector(`[data-game="${id}"]`);
      const { x, y } = this.engine.client(this.at(podium.position));
      card.style.transform = `translate(${x}px, ${y}px)`;
    }
  }

  async play() {
    this.pal.feel('wave', 2);
  }

  /** Called by the shell when a card is tapped. */
  pressed(id) {
    const podium = this.podiums[id];
    podium.boing(1.2);
    podium.acts.forEach((a) => a.hop(0.4));
    this.fx.starBurst(this.at(podium), 8);
    this.pal.feel('cheer', 1);
  }

  update(dt) {
    // Something is always putting on a little show.
    if ((this.nextShow -= dt) > 0) return;
    this.nextShow = rand(0.7, 1.6);
    const [podium] = sample(Object.values(this.podiums), 1);
    podium.acts.forEach((a, i) => this.tweens.after(i * 0.12, () => a.hop(0.25)));
  }
}
