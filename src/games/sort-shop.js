/**
 * Sort Shop — classifying: what is the same, what is different, what matters.
 *
 * Things trundle in on a conveyor belt and each needs a crate. First it is
 * colour; then shape, where colour becomes a distraction to ignore; then kinds
 * of thing; and finally two rules at once. Tap the crate or drag the thing.
 */

import * as THREE from '../core/three.js';
import { Game, V } from '../core/engine.js';
import { Toy, slab, shapeToy } from '../core/toy.js';
import { build } from '../core/kit.js';
import { bunting } from '../core/scenery.js';
import { SHAPES, COLORS } from '../models/shapes.js';
import { Ease } from '../core/anim.js';
import { deck, pick, range, sample, shuffle } from '../core/util.js';

const BY_COLOR = {
  red: ['#ff4d5e', ['apple', 'strawberry', 'car', 'crab', 'ladybug', 'heart']],
  yellow: ['#ffc93c', ['banana', 'duck', 'lemon', 'star', 'bus', 'sun']],
  blue: ['#3fa0f5', ['whale', 'bird', 'gem', 'shoe']],
  green: ['#3dcc77', ['frog', 'leaf', 'turtle', 'clover', 'cactus', 'dinosaur']],
};
const BY_KIND = {
  animals: ['#ff8a4c', 'lion', ['cat', 'dog', 'pig', 'cow', 'owl', 'zebra', 'monkey']],
  food: ['#ff6b8b', 'apple', ['pizza', 'cake', 'banana', 'bread', 'donut', 'corn', 'egg']],
  'things that go': ['#2fb0ee', 'car', ['bus', 'train', 'plane', 'boat', 'truck', 'rocket', 'van']],
  'things to wear': ['#9b6cff', 'shoe', ['hat', 'cap', 'sock', 'crown', 'ring']],
};
const BELT_Y = 1.5, BELT_Z = -1.6, STOP = [0.6, BELT_Y, BELT_Z];

export default class SortShop extends Game {
  static meta = { id: 'sort-shop', tint: '#f0a030', music: 'bakery' };

  init() {
    this.roundsTotal = this.level === 1 ? 8 : 9;
    this.view = { pos: V(0, 6.2, 17), look: V(0, 1.75, 0), fov: 30 };
    this.light({ span: 10 });
    this.scene.background = new THREE.Color('#bfe9ff');
    this.scene.add(build((b) => {
      b.box('#cfeeff', [0, 5, -6], [60, 24, 0.4], { ink: false });
      b.box('#ffe9c4', [0, -0.25, 2], [60, 0.5, 18], { ink: false });
      for (const x of [-7.5, 0.5, 8.5]) { b.box('#ffffff', [x, 3.9, -5.7], [3.6, 2.4, 0.2]); b.box('#8fd8ff', [x, 3.9, -5.58], [3.2, 2, 0.06], { ao: false, surf: 'bright' }); }
      bunting(b, [-14, 6.9, -5.4], [14, 6.9, -5.4], { n: 20, sag: 1 });
      b.box('#5e6b80', [5, BELT_Y - 0.28, BELT_Z], [16, 0.5, 1.9], { r: 0.24 });
      for (const x of [-1.6, 2.4, 6.4]) b.box('#ffb52e', [x, (BELT_Y - 0.5) / 2, BELT_Z], [0.36, BELT_Y - 0.5, 1.4]);
    }));
    this.treads = build((b) => { for (let x = -2.2; x < 13; x += 0.8) b.box('#8593ab', [x, BELT_Y - 0.02, BELT_Z], [0.16, 0.03, 1.7], { seg: 1, ink: false }); }, { shadow: false });
    this.scene.add(this.treads);
    this.addPal([-4.6, 0, -1.6], { size: 2.5, hat: 'cap' });
    this.stock();
  }

  /** Decide the crates, and the queue of things to go in them. */
  stock() {
    let groups;
    if (this.level === 1) {
      groups = sample(Object.entries(BY_COLOR), 2).map(([name, [color, items]]) => ({ name, color, next: deck(items) }));
    } else if (this.level === 2) {
      groups = sample(SHAPES, 3).map((shape) => ({ name: `${shape}s`, color: '#ffffff', icon: () => shapeToy(shape, 'purple', 0.8), next: () => [shape, pick(Object.keys(COLORS))] }));
    } else if (this.level === 3) {
      groups = sample(Object.entries(BY_KIND), 3).map(([name, [color, icon, items]]) => ({ name, color, icon: () => new Toy(icon, 0.85), next: deck(items) }));
    } else {
      const colors = sample(Object.keys(COLORS), 2);
      groups = sample(SHAPES, 2).flatMap((shape) => colors.map((c) => ({ name: `${c} ${shape}s`, color: '#ffffff', icon: () => shapeToy(shape, c, 0.8), next: () => [shape, c] })));
    }
    const gap = groups.length === 2 ? 3.4 : groups.length === 3 ? 2.9 : 2.3;
    const w = groups.length === 4 ? 1.85 : 2.2;
    this.crates = groups.map((group, i) => {
      const g = new THREE.Group();
      const wood = group.color === '#ffffff' ? '#e8b878' : group.color;
      g.add(build((b) => {
        b.box('#5b3a2a', [0, 0.6, -0.1], [w - 0.16, 1.1, 1.3], { r: 0.05, ink: false });
        b.box(wood, [0, 0.62, 0.62], [w, 1.24, 0.16], { r: 0.07 });
        b.box(wood, [0, 0.62, -0.78], [w, 1.24, 0.16], { r: 0.07 });
        b.both((s) => b.box(wood, [s * (w / 2 - 0.08), 0.62, -0.08], [0.16, 1.24, 1.5], { r: 0.07 }));
      }));
      if (group.icon) {
        const plate = slab(1.05, 1, 0.08, '#ffffff', 0.04), icon = group.icon();
        plate.position.set(0, 0.12, 0.72);
        icon.position.set(0, 0.62 - icon.height / 2, 0.9);
        g.add(plate, icon);
      }
      const crate = Object.assign(new Toy(g, 1.4, { idle: 0 }), { group, w, held: 0 });
      crate.position.set((i - (groups.length - 1) / 2) * gap, 0, 3.7);
      this.scene.add(crate);
      return crate;
    });
    this.queue = shuffle(range(this.roundsTotal).map((i) => this.crates[i % this.crates.length]));
  }

  async play() {
    const rule = { 1: 'Sort by colour', 2: 'Sort by shape', 3: 'Where does it belong?', 4: 'Match colour and shape' }[this.level];
    this.hud.prompt(rule);
    await this.talk(this.crates.map((c) => ({ text: c.group.name, rate: 0.85, gap: 0.3, onStart: () => c.hop(0.25) })), { min: 0.6 });
    for (const [i, crate] of this.queue.entries()) {
      const what = crate.group.next();
      const item = this.item = Array.isArray(what) ? shapeToy(...what, 1.6) : new Toy(what, 1.75);
      const name = Array.isArray(what) ? `${what[1]} ${what[0]}` : what;
      item.position.set(10, BELT_Y, BELT_Z);
      this.scene.add(item);
      await this.moveTo(item, STOP, 0.9, { ease: Ease.outCubic, onUpdate: () => { this.treads.position.x = item.position.x % 0.8; } });
      item.boing();
      this.hot(item, { r: 1, tap: () => { item.hop(0.2); this.audio.speak(name); }, drop: () => this.dropped(item, crate, name) });
      this.prompt(rule, i ? `${name}!` : [`Where does the ${name} go?`, 'Tap the crate!']);
      this.speech = `Where does the ${name} go?`;
      await this.choose(this.crates, crate, { r: crate.w * 0.55, wrong: (c) => this.notThere(c, name) });

      item.gone = true;
      const k = crate.held++;
      crate.act.attach(item);
      this.scaleTo(item, 0.5, 0.45);
      await this.jump(item, [((k % 3) - 1) * crate.w * 0.28, 1.02 + Math.floor(k / 3) * 0.2, 0.2 - Math.floor(k / 3) * 0.5], { height: 1.8, dur: 0.46 });
      crate.boing();
      this.audio.plop();
      this.win(crate, { quiet: i % 3 !== 2 });
      await this.talk(`${crate.group.name}!`, { min: 0.6 });
    }
    this.crates.forEach((c) => { c.dancing = true; });
    await this.wait(0.8);
    this.finish();
  }

  notThere(crate, name) { return [`That one is for ${this.level === 1 ? `${crate.group.name} things` : crate.group.name}.`, `Where does the ${name} go?`]; }

  dropped(item, right, name) {
    const near = [...this.crates].sort((a, b) => this.gap(a, item) - this.gap(b, item))[0];
    const close = this.gap(near, item) < 1.7;
    if (close && near === right) { this.resolve(); return; }
    if (close) this.miss(near, this.notThere(near, name));
    this.jump(item, STOP, { height: 0.6, dur: 0.34 });
  }

  hint() { this.replayPrompt(); if (this.level === 1) this.point(this.solution()); }
}
