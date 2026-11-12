/**
 * Critter Count — one-to-one counting, cardinality and numerals.
 *
 * Each tap sends one critter hopping into the hay wagon while the voice says
 * one number: one touch, one thing, one word. The seats are a ten frame, so a
 * quantity also starts to have a shape. Three kinds of round keep it honest:
 *
 *   all    load everyone, then say how many there were
 *   give   "four ducks, please" out of a bigger crowd — knowing when to *stop*
 *          is the real test of understanding a number
 *   mixed  two kinds in the field, and only one of them has a ticket
 */

import * as THREE from '../core/three.js';
import { Game, V } from '../core/engine.js';
import { numberBlock } from '../core/toy.js';
import { build } from '../core/kit.js';
import { text3d } from '../core/glyphs.js';
import { sky, ground, clouds, greenery, fence, sun } from '../core/scenery.js';
import { addWheels, goButton, CANDY } from '../core/props.js';
import { Ease } from '../core/anim.js';
import { deck, range, rand, randInt, shuffle, nearbyChoices } from '../core/util.js';
import { CRITTERS, numberWord, plural } from '../data/words.js';

const LEVELS = {
  1: { lo: 1, hi: 3, rounds: ['all', 'all', 'all', 'give', 'all'], choices: 2 },
  2: { lo: 2, hi: 5, rounds: ['all', 'all', 'give', 'all', 'give', 'all'], choices: 3 },
  3: { lo: 4, hi: 10, rounds: ['all', 'give', 'mixed', 'all', 'give', 'mixed'], choices: 3 },
  4: { lo: 11, hi: 20, rounds: ['all', 'give', 'mixed', 'all', 'give', 'all'], choices: 4 },
};
const ROAD_Z = -3.5;

export default class CountingCritters extends Game {
  static meta = { id: 'counting-critters', tint: '#ff8a4c', music: 'farm' };

  init() {
    this.cfg = LEVELS[this.level];
    this.roundsTotal = this.cfg.rounds.length;
    this.view = { pos: V(0, 8.2, 15.5), look: V(0, 0.75, -0.2), fov: 30 };
    this.light({ span: 11 });
    sky(this);
    ground(this, { far: -13 });
    clouds(this, { y: [3.4, 5], z: [-34, -26], size: [3, 4.5] });
    sun(this, [10.5, 2.6, -26], 3.4);
    greenery(this, { x: [-18, 18], z: [-12, -7.5], trees: 9, bushes: 8 });
    greenery(this, { x: [-11, 11], z: [-1.6, 6], flowers: 16, tufts: 34, seed: 12, keepClear: (x, z) => Math.abs(x) < 5.6 && z < 5 });
    this.scene.add(build((b) => {
      b.box('#e8c48a', [0, 0, ROAD_Z], [70, 0.06, 2.9], { r: 0.02 });
      fence(b, -20, 20, -6);
    }));
    this.buildRig();
    this.critters = [];
    this.riders = [];
  }

  /** Tractor, driver and one or two ten-seat wagons. */
  buildRig() {
    const wagons = this.cfg.hi > 10 ? 2 : 1;
    const step = this.seatStep = wagons === 2 ? 0.86 : 1.16;
    const len = step * 5 + 0.3;
    const rig = this.rig = new THREE.Group();
    const total = wagons * (len + 0.3) + 2.5;
    this.seats = [];
    const wheels = [];
    rig.add(build((b) => {
      for (let w = 0; w < wagons; w++) {
        const cx = -total / 2 + len / 2 + w * (len + 0.3);
        b.box('#c9823c', [cx, 0.62, 0.52], [len, 0.3, 1.1]);
        b.box('#c9823c', [cx, 0.8, -0.52], [len, 0.66, 1.1]);
        b.box('#e04848', [cx, 0.72, 1.1], [len + 0.1, 0.5, 0.1]);
        b.box('#e04848', [cx, 1.2, -1.1], [len + 0.1, 0.9, 0.1]);
        b.rod('#5e6b80', [cx + len / 2, 0.55, 0], [cx + len / 2 + 0.4, 0.55, 0], 0.06);
        for (let i = 0; i < 10; i++) {
          const back = i < 5, x = cx + ((i % 5) - 2) * step;
          b.cyl('#ffe08a', [x, back ? 1.15 : 0.79, back ? -0.52 : 0.52], step * 0.4, 0.07);
          this.seats.push([x, back ? 1.18 : 0.82, back ? -0.52 : 0.52]);
        }
        wheels.push([cx - len * 0.3, 0.4, 1.16], [cx + len * 0.3, 0.4, 1.16]);
      }
      const tx = total / 2 - 1.2;
      b.box('#3dbb5c', [tx + 0.5, 1.05, 0], [1.5, 0.85, 1], { r: 0.2, surf: 'shiny' });
      b.box('#3dbb5c', [tx - 0.55, 0.8, 0], [1, 0.5, 1.2], { r: 0.15 });
      b.cyl('#3a3346', [tx + 0.85, 1.8, -0.1], 0.09, 0.75);
      b.ball('#fff3b0', [tx + 1.26, 1.1, 0.28], [0.06, 0.15, 0.15], { surf: 'glow' });
      b.torus('#3a3346', [tx - 0.12, 1.62, 0.1], 0.2, 0.045, { rot: [0, 1.1, 0] });
      wheels.push([tx - 0.55, 0.72, 0.72], [tx + 0.8, 0.42, 0.56]);
      this.exhaust = V(tx + 0.85, 2.25, -0.1);
      this.driver = [tx - 0.62, 1.05, 0.05];
    }, { ao: true }));
    addWheels(this, rig, wheels);
    this.addPal(this.driver, { size: 1.75, hat: 'sun-hat', parent: rig });
    rig.position.set(-24, 0, ROAD_Z);
    this.scene.add(rig);
  }

  async drive(x, ease) {
    this.driving = true;
    await this.to(this.rig.position, { x }, 1.7, { ease });
    this.driving = false;
  }

  update(dt, t = this.t) {
    if (this.driving && t % 0.16 < dt) {
      this.fx.puff(this.at(this.rig.localToWorld(this.exhaust.clone())), 1, { spread: 0.6, size: 0.26, rise: 2 });
      this.audio.chuff();
    }
    // The field is never still: someone is always pottering about.
    if (t % 0.7 < dt) {
      const c = shuffle(this.critters.filter((k) => !k.seated && !k.gone))[0];
      if (c) this.jump(c, [c.home.x + rand(-0.16, 0.16), 0, c.home.z + rand(-0.12, 0.12)], { height: 0.3, dur: 0.34 });
    }
  }

  /* ----------------------------------------------------------------- rounds */

  async play() {
    const { lo, hi, rounds } = this.cfg;
    const nextCount = deck(range(hi - lo + 1).map((i) => lo + i));
    const nextKind = deck(CRITTERS);
    for (const mode of rounds) {
      this.mode = mode;
      this.kind = nextKind();
      // A mixed field has to leave room for the ones who are not coming.
      this.count = mode === 'mixed' ? Math.min(nextCount(), 14) : mode === 'give' ? Math.min(nextCount(), 17) : nextCount();
      this.rig.position.x = -24;
      const arrived = this.drive(0, Ease.outCubic);
      const spare = mode === 'all' ? 0 : randInt(2, 3) + (mode === 'mixed' ? 1 : 0);
      const other = mode === 'mixed' ? nextKind() : this.kind;
      this.release([...range(this.count).map(() => this.kind), ...range(spare).map(() => other)]);
      await arrived;
      this.audio.honk();
      await (mode === 'give' ? this.giveRound() : this.countRound());
      await this.depart();
    }
    this.finish();
  }

  /** Scatter critters over a jittered grid, so even twenty stay countable. */
  release(kinds) {
    const n = kinds.length;
    const cols = n <= 4 ? n : n <= 8 ? 4 : n <= 15 ? 5 : 7;
    const rows = Math.ceil(n / cols);
    const size = n <= 5 ? 1.5 : n <= 10 ? 1.25 : 1.05;
    // A "give" round keeps the right-hand edge free for its sign and button.
    const [span, shift] = this.mode === 'give' ? [8, -0.85] : [9.2, 0];
    this.riders = [];
    this.critters = shuffle(kinds).map((kind, i) => {
      const r = Math.floor(i / cols), inRow = Math.min(cols, n - r * cols);
      const x = ((i % cols) - (inRow - 1) / 2) * Math.min(2.4, span / cols) * (1 - r * 0.05) + shift + rand(-0.12, 0.12);
      const z = rows === 1 ? 2 : -0.2 + (r / (rows - 1)) * (rows === 2 ? 3 : 4.4) + (rows === 2 ? 0.7 : 0);
      const c = this.toy(kind.one, size, [x, 0, z]);
      Object.assign(c, { kindOf: kind, home: c.position.clone() });
      this.appear(c, 0.4 + i * 0.05);
      return this.hot(c, { r: size * 0.52, when: () => !this.choices, tap: () => this.tapped(c) });
    });
  }

  tapped(c) {
    if (c.seated) { if (this.mode === 'give') this.getOff(c); return; }
    if (c.kindOf !== this.kind) {
      c.wiggle(1.4);
      this.audio.squeak(0.7);
      this.audio.speak(`Not the ${c.kindOf.many}. Just the ${this.kind.many}!`);
      return;
    }
    if (this.riders.length >= this.seats.length) { c.wiggle(); return; }
    this.riders.push(c);
    c.seated = true;
    const n = this.riders.length;
    this.audio.step(n - 1);
    this.audio.speak(numberWord(n));
    this.sit(c, n - 1).then(() => this.fx.floatText(this.at(c), String(n), { color: '#ffe27a' }));
    if (this.mode !== 'give' && n === this.count) this.resolve();
  }

  sit(c, seat) {
    this.rig.attach(c);
    this.scaleTo(c, (this.seatStep * 0.92) / c.size, 0.45);
    return this.jump(c, this.seats[seat], { height: 1.6, dur: 0.5 });
  }

  /** Changed your mind? Off they hop, and everyone shuffles up. */
  getOff(c) {
    this.riders.splice(this.riders.indexOf(c), 1);
    c.seated = false;
    this.scene.attach(c);
    this.scaleTo(c, 1, 0.4);
    this.jump(c, c.home.toArray());
    this.audio.boing();
    this.audio.speak(numberWord(this.riders.length));
    this.riders.forEach((r, i) => this.jump(r, this.seats[i], { height: 0.3, dur: 0.3 }));
  }

  async countRound() {
    const { many } = this.kind;
    this.prompt(`Count the ${many}`, this.mode === 'mixed'
      ? `Only the ${many} can ride. Tap the ${many} to count them!` : `Tap the ${many} to count them!`);
    await this.ask();
    await this.wait(1);
    this.critters.filter((c) => !c.seated).forEach((c) => this.vanish(c));
    const { lo, hi, choices } = this.cfg;
    const blocks = this.row(nearbyChoices(this.count, choices, Math.max(1, lo - 1), hi + 1).map((n, i) =>
      numberBlock(n, { size: 1.6, color: CANDY[i], dots: this.level === 1 })), { z: 2.4, gap: 2.3 });
    this.prompt(`How many ${many}?`);
    const right = await this.choose(blocks, blocks.find((b) => b.value === this.count), {
      wrong: () => { this.demonstrate(() => this.recount()); return null; },
    });
    this.win(right);
    right.spin().hop(0.6, 0.6);
    blocks.forEach((b) => this.vanish(b, b === right ? 1.1 : 0));
  }

  /** After a miss, count the wagon out loud together. */
  async recount() {
    await this.talk("Let's count together.", { min: 0.8 });
    for (const [i, c] of this.riders.entries()) {
      c.hop(0.4);
      this.audio.step(i);
      this.fx.floatText(this.at(c), String(i + 1), { color: '#ffe27a' });
      await this.talk({ text: numberWord(i + 1), rate: 1.1, gap: 0 }, { min: 0.42, max: 1.2 });
    }
  }

  async giveRound() {
    const what = `${numberWord(this.count)} ${plural(this.kind, this.count)}`;
    const sign = new THREE.Group();
    sign.add(build((b) => {
      b.cyl('#c9823c', [0, 0.3, 0], 0.07, 0.6);
      b.box('#ffffff', [0, 1.15, 0], [1.5, 1.3, 0.14], { r: 0.07 });
    }));
    const num = text3d(String(this.count), { height: 0.85, color: this.tint, maxWidth: 1.2 });
    num.position.set(0, 1.15, 0.14);
    sign.add(num);
    sign.position.set(4.6, 0, 1.1);
    this.scene.add(sign);
    this.appear(sign);
    const go = this.go = goButton(1.5);
    go.position.set(3.7, 0, 4.5);
    this.scene.add(go);
    this.appear(go, 0.5);
    this.hot(go, { r: 0.75, tap: () => this.checkLoad(what) });
    this.prompt(`Put ${this.count} in the wagon`, [`Put ${what} in the wagon.`, 'Then press the green button!']);
    await this.ask();
    this.win(this.rig.localToWorld(V(-1, 2, 0)));
    this.vanish(go);
    this.vanish(sign, 0.8);
    this.go = null;
  }

  checkLoad(what) {
    const n = this.riders.length;
    this.go.boing(1.2);
    if (n === this.count) { this.resolve(); return; }
    this.miss(this.go, [`That is ${numberWord(n)}.`, `We need ${what}.`, n < this.count ? 'Add some more!' : 'Tap one in the wagon to let it off.']);
  }

  async depart() {
    this.riders.forEach((c) => { c.dancing = true; });
    await this.talk(`${numberWord(this.count)} ${plural(this.kind, this.count)}!`, { min: 1.3 });
    this.audio.honk();
    this.critters.filter((c) => !c.seated && !c.gone).forEach((c) => this.vanish(c));
    await this.drive(24, Ease.inCubic);
    this.remove(...this.riders);
    this.critters = [];
  }

  /* ------------------------------------------------------------------ hints */

  solution() {
    if (this.choices) return super.solution();
    if (this.riders.length > this.count) return { tap: this.riders[this.riders.length - 1] };
    if (this.riders.length === this.count) return this.go && { tap: this.go };
    return { tap: this.critters.find((c) => !c.seated && c.kindOf === this.kind) };
  }

  hint() {
    this.replayPrompt();
    if (!this.choices && (this.mode !== 'give' || !this.riders.length || this.level === 1)) this.point(this.solution());
  }
}
