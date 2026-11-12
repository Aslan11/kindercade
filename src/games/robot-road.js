/**
 * Robot Road — planning ahead, and a first taste of coding.
 *
 * Level 1 is remote control: press an arrow, the robot moves. After that the
 * arrows are queued up first and run together, so the child has to picture the
 * whole journey before it starts, watch where it goes wrong, and fix it. A
 * bump is a debugging step, not a defeat: the program is kept.
 */

import * as THREE from '../core/three.js';
import { Game, V } from '../core/engine.js';
import { Toy, slab } from '../core/toy.js';
import { build, Shapes } from '../core/kit.js';
import { sky, ground, greenery } from '../core/scenery.js';
import { goButton } from '../core/props.js';
import { pick, randInt, range, sample } from '../core/util.js';

const LEVELS = {
  1: { cols: 4, rows: 3, rocks: 0, steps: [2, 3] },
  2: { cols: 5, rows: 3, rocks: 1, steps: [2, 4] },
  3: { cols: 5, rows: 4, rocks: 4, steps: [4, 6] },
  4: { cols: 5, rows: 4, rocks: 3, steps: [5, 8], key: true },
};
const DIRS = [
  { name: 'left', dx: -1, dz: 0, turn: Math.PI, color: '#ff8a4c' },
  { name: 'up', dx: 0, dz: -1, turn: Math.PI / 2, color: '#2fb0ee' },
  { name: 'down', dx: 0, dz: 1, turn: -Math.PI / 2, color: '#9b6cff' },
  { name: 'right', dx: 1, dz: 0, turn: 0, color: '#ff6b8b' },
];
const PRIZES = ['gem', 'cupcake', 'star', 'gift', 'trophy', 'donut', 'crown'];
const SLOTS = 8, LEAN = -0.75;
const same = (a, b) => a.x === b.x && a.z === b.z;

function arrow(dir, size) {
  const g = new THREE.Group();
  g.add(slab(size, size, size * 0.34, dir.color, size * 0.16));
  const mark = build((b) => b.puff('#ffffff', [0, 0, 0], Shapes.soft([[0.36, 0], [0.02, 0.32], [0.02, 0.13], [-0.32, 0.13], [-0.32, -0.13], [0.02, -0.13], [0.02, -0.32]], 0.04), 0.08), { shadow: false });
  mark.position.set(0, size / 2, size * 0.2);
  mark.scale.setScalar(size);
  mark.rotation.z = dir.turn;
  g.add(mark);
  const t = new Toy(g, size, { idle: 0.3 });
  t.rotation.x = LEAN;
  return Object.assign(t, { dir, hotAt: V(0, size * 0.36, -size * 0.3) });
}

export default class RobotRoad extends Game {
  static meta = { id: 'robot-road', tint: '#ff7a59', music: 'robot' };

  init() {
    this.cfg = LEVELS[this.level];
    this.roundsTotal = 5;
    this.view = { pos: V(0, 13.4, 11), look: V(0, 0, -0.1), fov: 30 };
    this.sway = 0.1;
    this.light({ span: 9 });
    sky(this);
    ground(this, { color: '#7fd8c0', hills: null });
    greenery(this, { x: [-13, 13], z: [-8, 6], bushes: 10, flowers: 14, tufts: 20, tuft: '#58bfa4', keepClear: (x, z) => Math.abs(x) < 6.2 && z > -5.2 });
    const { cols, rows } = this.cfg;
    const CELL = this.cell = rows === 4 ? 1.24 : this.level === 1 ? 1.6 : 1.5;
    this.origin = { x: 0.6 - ((cols - 1) * CELL) / 2, z: (this.level === 1 ? -0.55 : -0.85) - ((rows - 1) * CELL) / 2 };
    this.scene.add(build((b) => {
      range(cols * rows).forEach((i) => {
        const [x, , z] = this.spot({ x: i % cols, z: Math.floor(i / cols) });
        b.box(((i % cols) + Math.floor(i / cols)) % 2 ? '#fff3d6' : '#ffe0a8', [x, 0.06, z - 0.12], [CELL - 0.05, 0.2, CELL - 0.05], { r: 0.08, seg: 1 });
      });
      if (this.level > 1) range(SLOTS).forEach((i) => { const [x, , z] = this.slot(i); b.box('#5fb8a2', [x, 0.01, z - 0.28], [0.8, 0.04, 0.72], { seg: 1, r: 0.02 }); });
    }));
    this.addPal([-4.75, 0, -1.4], { size: 1.9 }).rotation.x = -0.5;
    this.bot = this.toy('robot', 1.2);
    this.bot.rotation.x = -0.5;

    this.keys = DIRS.map((dir, i) => {
      const t = arrow(dir, this.level === 1 ? 1.45 : 1.15);
      t.position.set(this.level === 1 ? (i - 1.5) * 1.95 + 0.3 : -3.6 + i * 1.5, 0.05, this.level === 1 ? 3.75 : 4.3);
      this.scene.add(t);
      return this.hot(t, { r: 0.7, tap: () => this.press(t) });
    });
    if (this.level > 1) {
      this.go = goButton(1.45);
      this.go.position.set(3.4, 0, 4.35);
      this.go.rotation.x = LEAN;
      this.go.hotAt = V(0, 0.55, -0.45);
      this.scene.add(this.go);
      this.hot(this.go, { r: 0.75, tap: () => this.run() });
    }
    this.program = [];
  }

  spot({ x, z }) { return [this.origin.x + x * this.cell, 0.16, this.origin.z + z * this.cell + 0.12]; }
  slot(i) { return [0.2 + (i - (SLOTS - 1) / 2) * 0.92, 0.04, 2.75]; }
  blocked(c) { return c.x < 0 || c.z < 0 || c.x >= this.cfg.cols || c.z >= this.cfg.rows || this.rocks.some((r) => same(r, c)); }

  /** Shortest list of directions from one cell to another, or null. */
  route(from, to) {
    const queue = [[from, []]], seen = [from];
    for (const [at, path] of queue) {
      if (same(at, to)) return path;
      for (const d of DIRS) {
        const n = { x: at.x + d.dx, z: at.z + d.dz };
        if (this.blocked(n) || seen.some((s) => same(s, n))) continue;
        seen.push(n);
        queue.push([n, [...path, d]]);
      }
    }
    return null;
  }

  /** The best way home from here, by way of the key if it is still lying there. */
  plan(from, needKey) {
    if (!needKey) return this.route(from, this.goal);
    const a = this.route(from, this.keyAt), b = this.route(this.keyAt, this.goal);
    return a && b && [...a, ...b];
  }

  layOut(round) {
    const { cols, rows, rocks, steps: [lo, hi], key } = this.cfg;
    const want = Math.min(hi, lo + Math.floor(round * (hi - lo + 1) / this.roundsTotal) + randInt(0, 1));
    for (;;) {
      const cells = sample(range(cols * rows), rocks + 3).map((i) => ({ x: i % cols, z: Math.floor(i / cols) }));
      [this.start, this.goal, this.keyAt] = cells;
      this.rocks = cells.slice(3);
      if (this.plan(this.start, key)?.length === want) return;
    }
  }

  /** Where a program ends up, without moving anything. */
  trace(program) {
    let at = this.start, key = !this.cfg.key;
    for (const { dir } of program) {
      at = { x: at.x + dir.dx, z: at.z + dir.dz };
      if (this.blocked(at)) return null;
      key = key || same(at, this.keyAt);
    }
    return { at, key };
  }

  /* ----------------------------------------------------------------- rounds */

  async play() {
    for (let round = 0; round < this.roundsTotal; round++) {
      this.layOut(round);
      const place = (name, size, cell) => { const t = this.toy(name, size, this.spot(cell)); t.rotation.x = -0.5; this.appear(t, 0.3); return t; };
      const prize = place(this.cfg.key ? 'gift' : PRIZES[round], 0.9, this.goal);
      prize.float = 0.06;
      const props = this.rocks.map((r) => place(pick(['rock', 'cactus', 'log']), 1, r));
      this.keyToy = this.cfg.key ? place('key', 0.85, this.keyAt) : null;
      this.here = this.start;
      await this.jump(this.bot, this.spot(this.start), { height: 1.6, dur: 0.5 });
      const goal = this.cfg.key ? 'Get the key first, then open the present!' : `Help the robot reach the ${prize.kind}!`;
      const how = this.level === 1 ? 'Tap the arrows to drive.' : 'Tap the arrows to plan a path. Then press the green button!';
      this.prompt(this.level === 1 ? 'Drive the robot' : 'Plan a path, then go!', round < 2 ? [goal, how] : goal);
      await this.ask();
      this.win(prize);
      this.bot.dancing = true;
      prize.hop(1, 0.6).spin();
      await this.talk('Beep boop! Thank you!', { min: 1.6 });
      this.bot.dancing = false;
      [prize, ...props, ...this.program.splice(0)].forEach((t) => this.vanish(t));
      if (this.keyToy) this.remove(this.keyToy);
      await this.wait(0.4);
    }
    this.finish();
  }

  /** One move. Resolves false on a bump. */
  async step(dir) {
    const next = { x: this.here.x + dir.dx, z: this.here.z + dir.dz };
    if (this.blocked(next)) {
      const [x, y, z] = this.spot(this.here);
      await this.jump(this.bot, [x + dir.dx * 0.35, y, z + dir.dz * 0.35], { height: 0.2, dur: 0.16 });
      this.audio.place();
      this.fx.addShake(0.6);
      this.fx.starBurst(this.at(this.bot), 4);
      await this.jump(this.bot, [x, y, z], { height: 0.3, dur: 0.22 });
      return false;
    }
    this.here = next;
    this.audio.tone({ freq: 500, slide: 900, dur: 0.12, type: 'square', vol: 0.05 });
    await this.jump(this.bot, this.spot(next), { height: 0.5, dur: 0.34 });
    if (this.keyToy?.visible && same(next, this.keyAt)) {
      this.keyToy.visible = false;
      this.audio.coin();
      this.fx.sparkle(this.at(this.bot), 12);
    }
    return true;
  }

  async press(key) {
    key.boing();
    if (this.level === 1) {
      this.busy = true;
      this.audio.speak(key.dir.name);
      await this.step(key.dir);
      if (same(this.here, this.goal)) this.resolve(); else this.busy = false;
      return;
    }
    if (this.program.length >= SLOTS) { key.wiggle(); return; }
    const chip = arrow(key.dir, 0.72);
    chip.position.copy(key.position);
    this.scene.add(chip);
    this.audio.step(this.program.length);
    this.jump(chip, this.slot(this.program.push(chip) - 1), { height: 0.7, dur: 0.26 });
    this.hot(chip, { r: 0.4, tap: () => this.unqueue(chip) });
  }

  /** Tap a queued arrow to take it out; the rest close up. */
  unqueue(chip) {
    this.program.splice(this.program.indexOf(chip), 1);
    this.audio.pop();
    this.fx.puff(this.at(chip), 5);
    this.remove(chip);
    this.program.forEach((c, i) => this.moveTo(c, this.slot(i), 0.2));
  }

  async run() {
    this.go.boing(1.2);
    if (!this.program.length) { this.nudgeChoices(); this.audio.speak('Tap the arrows first!'); return; }
    this.busy = true;
    let bumped = null;
    for (const chip of this.program) {
      chip.hop(0.6);
      if (!(await this.step(chip.dir))) { bumped = chip; break; }
      if (same(this.here, this.goal) && !this.keyToy?.visible) { this.resolve(); return; }
    }
    await this.wait(0.35);
    const why = bumped ? ['Bump!', 'Tap an arrow in the row to take it away.']
      : same(this.here, this.goal) ? 'We need the key first!' : 'Not there yet. Add some more arrows!';
    this.here = this.start;
    if (this.keyToy) this.keyToy.visible = true;
    await this.jump(this.bot, this.spot(this.start), { height: 1.4, dur: 0.45 });
    this.busy = false;
    this.miss(bumped, why);
  }

  /* ------------------------------------------------------------------ hints */

  solution() {
    const keyFor = (dir) => ({ tap: this.keys.find((k) => k.dir === dir) });
    if (this.level === 1) return keyFor(this.route(this.here, this.goal)[0]);
    const end = this.trace(this.program);
    const rest = end && this.plan(end.at, !end.key);
    if (!rest || rest.length + this.program.length > SLOTS) return { tap: this.program[this.program.length - 1] };
    return rest.length ? keyFor(rest[0]) : { tap: this.go };
  }

  nudgeChoices() { this.keys.forEach((k, i) => this.tweens.after(i * 0.1, () => k.hop(0.25))); }
  hint() { this.replayPrompt(); if (this.level <= 2 || this.tries) this.point(this.solution()); }
}
