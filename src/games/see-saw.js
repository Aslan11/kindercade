/**
 * See-Saw — comparing: bigger, more, fewer, the same.
 *
 * The child commits to an answer while the plank is held level; then the props
 * pop away and gravity delivers the verdict. "More" stops being a word and
 * becomes the side that goes thump. The last level turns it round: how many
 * more does it take to balance?
 */

import * as THREE from '../core/three.js';
import { Game, V } from '../core/engine.js';
import { Toy, numberBlock } from '../core/toy.js';
import { build } from '../core/kit.js';
import { sky, ground, clouds, greenery, fence, sun } from '../core/scenery.js';
import { CANDY } from '../core/props.js';
import { Spring } from '../core/anim.js';
import { deck, range, randInt, sample, shuffle, nearbyChoices } from '../core/util.js';
import { numberWord, plural } from '../data/words.js';

/** Round, stackable passengers. */
const RIDERS = [['frog', 'frogs'], ['owl', 'owls'], ['penguin', 'penguins'], ['bird', 'birds'], ['hen', 'hens'], ['octopus', 'octopuses'], ['panda', 'pandas'], ['apple', 'apples'], ['cupcake', 'cupcakes']]
  .map(([one, many]) => ({ one, many }));
const PIVOT = 1.45, SEAT = 3.05, SIZE = 0.86, LEAN = 0.27;
/** Balancing fills both piles from the same ten places, so they can be compared by eye. */
const FULL = 10;

/** Where the i-th of a pile sits: four along the bottom, then three, two, one. */
function pile(i, n) {
  const rows = n <= 3 ? [n] : n <= 5 ? [3, 2] : n === 6 ? [3, 2, 1] : [4, 3, 2, 1];
  let row = 0;
  while (i >= rows[row]) i -= rows[row++];
  const inRow = Math.min(rows[row], n - rows.slice(0, row).reduce((a, b) => a + b, 0));
  return [(i - (inRow - 1) / 2) * SIZE, row * SIZE * 0.86, row * -0.05];
}

export default class SeeSaw extends Game {
  static meta = { id: 'see-saw', tint: '#ffb52e', music: 'fair' };

  init() {
    this.roundsTotal = this.level === 1 ? 6 : 7;
    this.view = { pos: V(0, 4.6, 17.5), look: V(0, this.level === 4 ? 2.3 : 2.75, 0), fov: 30 };
    this.light({ span: 10 });
    sky(this);
    ground(this);
    clouds(this);
    sun(this, [-11, 9.5, -22]);
    greenery(this, { x: [-20, 20], z: [-14, -8], trees: 9, bushes: 8, seed: 31 });
    greenery(this, { x: [-10, 10], z: [-3, 6], flowers: 12, tufts: 24, keepClear: (x, z) => Math.abs(x) < 5.4 && z > -1.5 });
    this.scene.add(build((b) => {
      fence(b, -20, 20, -5.5, '#ffe9c4');
      b.cyl('#ffe3a8', [0, 0, 0.4], 6.4, 0.06, { scale: [1, 1, 0.42], seg: 40 });
      b.cone('#4c8cf0', [0, 0, 0], 0.95, PIVOT, { scale: [1, 1, 0.8] });
    }));
    this.plank = new THREE.Group();
    this.plank.add(build((b) => {
      b.box('#ff5a6e', [0, 0, 0], [10, 0.24, 1.5], { r: 0.12, surf: 'shiny' });
      b.both((s) => b.box('#ffd23c', [s * SEAT, 0.14, 0], [3.7, 0.1, 1.3]));
      b.cyl('#ffd23c', [0, 0, 0.75], 0.26, 0.14, { rot: [Math.PI / 2, 0, 0] });
    }));
    this.plank.position.y = PIVOT;
    this.scene.add(this.plank);
    this.lean = new Spring(0, 60, 7);
    this.every((dt) => { this.plank.rotation.z = this.lean.step(dt); });
    this.addPal([0, 0, -1.6], { size: 2.2 }).position.y = 1.2;
    this.scene.add(build((b) => b.cyl('#9b6cff', [0, 0.6, -1.7], 0.8, 1.2)));
  }

  /** A tappable half of the see-saw. */
  side(s) {
    const t = new Toy(new THREE.Group(), 3, { idle: 0 });
    t.position.set(s * SEAT, 0.19, 0);
    t.hotAt = V(0, 1.1, 0);
    t.riders = [];
    t.dir = s;
    this.plank.add(t);
    return t;
  }

  /** Drop riders number `from`…`n-1` onto a side. */
  load(side, kind, n, from = 0, total = n) {
    return Promise.all(range(n - from).map((k) => {
      const c = this.toy(kind.one, SIZE, null, side.act);
      const to = pile(from + k, total);
      side.riders.push(c);
      c.position.set(to[0] + side.dir * 2, 7, 0);
      return this.jump(c, to, { height: 0.4, dur: 0.4, delay: k * 0.1 }).then(() => this.audio.step(from + k, { vol: 0.12 }));
    }));
  }

  /** Two jacks that hold the plank level until the answer is in. */
  jacks() {
    return [-1, 1].map((s) => {
      const j = build((b) => {
        b.cyl('#ffffff', [0, 0.65, 0], 0.16, 1.3);
        b.cyl('#9b6cff', [0, 0.1, 0], [0.3, 0.42], 0.2);
      });
      j.position.set(s * 4, 0, 0.2);
      this.scene.add(j);
      this.appear(j);
      return j;
    });
  }

  async tip(left, right) {
    this.lean.target = Math.sign(left - right) * LEAN;
    await this.wait(0.42);
    if (left === right) return;
    this.audio.place();
    this.fx.addShake(0.8);
    this.fx.puff(this.at(V(Math.sign(right - left) * 4.7, 0.1, 0.4)), 9, { color: '#ffe9c4' });
  }

  async play() {
    const nextKind = deck(RIDERS);
    for (let i = 0; i < this.roundsTotal; i++) {
      const sides = [this.side(-1), this.side(1)];
      await (this.level === 4 ? this.balance(sides, nextKind()) : this.compare(sides, nextKind(), i));
      sides.forEach((s) => this.vanish(s));
      this.lean.target = 0;
      await this.wait(0.6);
    }
    this.finish();
  }

  async compare(sides, kind, round) {
    const most = round % 3 !== 2;       // mostly "more", sometimes the opposite
    const jacks = this.jacks();
    let weights, ask, reveal;
    if (this.level === 1) {
      weights = shuffle([1, 2]);
      await Promise.all(sides.map((s, i) => {
        const c = this.toy(kind.one, weights[i] === 2 ? 2.7 : 1.15, [0, 7, 0], s.act);
        s.riders.push(c);
        return this.jump(c, [0, 0, 0], { height: 0.2, dur: 0.45, delay: i * 0.25 }).then(() => this.audio.boing(weights[i] === 2 ? 0.6 : 1.4));
      }));
      const word = most ? 'big' : 'small';
      ask = [`Tap the ${word} one`, `Tap the ${word} ${kind.one}!`];
      reveal = `The ${word} ${kind.one}!`;
    } else {
      weights = this.level === 2 ? sample(range(8).map((n) => n + 1), 2) : sample(range(20).map((n) => n + 1), 2);
      const [hi, lo] = [Math.max(...weights), Math.min(...weights)].map(numberWord);
      if (this.level === 2) {
        await Promise.all(sides.map((s, i) => this.load(s, kind, weights[i])));
        ask = most ? ['Which side has more?', `Which side has more ${kind.many}?`] : ['Which side has fewer?', `Which side has fewer ${kind.many}?`];
        reveal = most ? `${hi} is more than ${lo}!` : `${lo} is fewer than ${hi}!`;
      } else {
        await Promise.all(sides.map((s, i) => {
          const b = numberBlock(weights[i], { size: 2, color: CANDY[i * 2], depth: 1 });
          s.act.add(b);
          s.riders.push(b);
          b.position.y = 7;
          return this.jump(b, [0, 0, 0], { height: 0.2, dur: 0.45, delay: i * 0.25 }).then(() => this.audio.place());
        }));
        ask = [`Which number is ${most ? 'bigger' : 'smaller'}?`];
        reveal = most ? `${hi} is bigger than ${lo}!` : `${lo} is smaller than ${hi}!`;
      }
    }
    this.prompt(...ask);
    const right = sides[(weights[0] > weights[1]) === most ? 0 : 1];
    await this.choose(sides, right, { r: 1.9 });
    this.win(right);
    jacks.forEach((j) => { this.fx.puff(this.at(j), 5); this.vanish(j); });
    await this.tip(...weights);
    right.riders.forEach((c) => { c.dancing = true; });
    await this.talk(reveal, { min: 1.5 });
  }

  async balance(sides, kind) {
    const heavy = randInt(4, 8), light = randInt(1, heavy - 1), need = heavy - light;
    const [big, small] = shuffle(sides);
    const weigh = () => this.tip(sides[0].riders.length, sides[1].riders.length);
    await Promise.all([this.load(big, kind, heavy, 0, FULL), this.load(small, kind, light, 0, FULL)]);
    await weigh();
    const blocks = this.row(nearbyChoices(need, 3, 1, FULL - light).map((n, i) => numberBlock(n, { size: 1.15, color: CANDY[i + 1] })), { z: 4.3, gap: 1.6 });
    this.prompt('How many more to balance?', [`${numberWord(heavy)} and ${numberWord(light)}.`, 'How many more to make it balance?']);
    const right = await this.choose(blocks, blocks.find((b) => b.value === need), {
      wrong: (b) => { this.demonstrate(() => this.tryAdding(b.value, small, kind, light, heavy, weigh)); return null; },
    });
    await this.load(small, kind, heavy, light, FULL);
    await weigh();
    this.win(this.plank.localToWorld(V(0, 1, 0)));
    right.spin();
    blocks.forEach((b) => this.vanish(b, b === right ? 1 : 0));
    sides.forEach((s) => s.riders.forEach((c) => { c.dancing = true; }));
    await this.talk([`${numberWord(light)} and ${numberWord(need)} more is ${numberWord(heavy)}.`, 'Balanced!'], { min: 1.8 });
  }

  /** A wrong guess still gets on board, so the child sees *why* it is wrong. */
  async tryAdding(n, side, kind, have, want, weigh) {
    const total = have + n;
    await this.load(side, kind, total, have, FULL);
    await weigh();
    await this.talk([`${numberWord(total)} ${plural(kind, total)}.`, total < want ? 'Not enough!' : 'Too many!'], { min: 1.3 });
    side.riders.splice(have).forEach((c) => this.vanish(c));
    await weigh();
  }

  nudgeChoices() { this.choices?.forEach((c) => c.boing(0.5)); }
}
