/**
 * Frog Hop — number order.
 *
 * Counting aloud is a song; knowing which numeral comes next is a skill. The
 * frog can only cross the pond by landing on the lily pads in order — forwards,
 * backwards, with a gap to fill, or skipping in twos, fives and tens.
 */

import * as THREE from '../core/three.js';
import { Game, V } from '../core/engine.js';
import { Toy } from '../core/toy.js';
import { build } from '../core/kit.js';
import { text3d } from '../core/glyphs.js';
import { sky, greenery } from '../core/scenery.js';
import { range, rand, randInt, sample, shuffle, nearbyChoices } from '../core/util.js';
import { numberWord } from '../data/words.js';

const up = (from, n, step = 1) => range(n).map((i) => from + i * step);
const TRAILS = {
  1: () => [up(1, 3), up(1, 4), up(1, 5), up(1, 5)],
  2: () => [up(1, 6), up(1, 8), up(5, 5, -1), up(1, 10), up(10, 6, -1)],
  3: () => range(6).map((i) => up(randInt(1, 6 + i * 2), 5)),
  4: () => [up(2, 5, 2), up(10, 5, 10), up(5, 5, 5), up(2, 7, 2), up(10, 7, 10)],
};
const START = [-5.1, 0.28, 0.3], FINISH = [4.95, 0.28, 0.1], TREAT = [4.7, 0.36, 1.7];
const TREATS = ['ladybug', 'butterfly', 'bee', 'cupcake', 'strawberry', 'crown'];

export default class FrogHop extends Game {
  static meta = { id: 'frog-hop', tint: '#3dcc77', music: 'garden' };

  init() {
    this.trails = TRAILS[this.level]();
    this.roundsTotal = this.trails.length;
    this.view = { pos: V(0, 11.5, 12.5), look: V(0, 0, -0.35), fov: 30 };
    this.light({ span: 11 });
    sky(this);
    this.scene.add(build((b) => {
      b.cyl('#55c8f0', [0, -0.6, 0], 90, 1, { ink: false, seg: 24 });
      b.both((s) => b.ball('#86d95c', [s * 10.4, -0.55, 0], [6.4, 0.9, 14], { seg: 30 }));
      b.ball('#86d95c', [0, -0.55, -12.5], [20, 0.9, 7.2], { seg: 30 });
      for (const [x, z] of [[-4.4, -4], [-4.1, -4.4], [4.3, -4.2], [4.6, -3.8], [-4.5, 4.6], [4.6, 4.9]]) {
        b.rod('#3f9e38', [x, -0.1, z], [x + 0.1, 1.2, z], 0.04);
        b.rod('#8a5a38', [x + 0.1, 1.05, z], [x + 0.12, 1.4, z], 0.09);
      }
    }));
    greenery(this, { x: [-14, 14], z: [-10, -6.4], trees: 5, bushes: 10, flowers: 10 }).position.y = 0.2;
    greenery(this, { x: [-10, 10], z: [-4, 6], flowers: 10, tufts: 16, seed: 3, keepClear: (x, z) => Math.abs(x) < 5.6 || (Math.abs(x) < 6.6 && Math.abs(z) < 2.4) }).position.y = 0.22;
    this.ripples();
    this.frog = this.toy('frog', 1.25, START);
    this.frog.rotation.x = -0.35;
    this.poke(this.frog, { r: 0.55, sound: 'squeak' });
    this.addPal([5.3, 0.28, -2.5], { size: 1.9, hat: 'sun-hat' }).rotation.x = -0.35;
    this.pads = [];
  }

  ripples() {
    range(7).forEach((i) => {
      const r = build((b) => b.torus('#bdf0ff', [0, 0, 0], 0.5, 0.025, { rot: [Math.PI / 2, 0, 0], ink: false, surf: 'bright' }), { shadow: false });
      this.scene.add(r);
      let k = i / 7;
      this.every((dt) => {
        if ((k += dt * 0.28) >= 1 || !r.position.z) { k %= 1; r.position.set(rand(-4, 4), -0.09, rand(-4.5, 5)); }
        r.scale.setScalar(Math.sin(k * Math.PI) * 0.2 + k * 1.2);
        r.visible = k < 0.9;
      });
    });
  }

  pad(label, [x, z], size = 1) {
    const g = new THREE.Group();
    g.add(build((b) => b.lathe('#45b84a', [0, 0, 0], [[0, -0.06], [0.74, -0.06], [0.8, 0.02], [0.72, 0.08], [0, 0.06]], { from: 2.6, sweep: Math.PI * 2 - 0.5, sharp: true, seg: 26 })));
    const p = new Toy(g, size, { idle: 0 });
    p.label = (text, color = '#ffffff') => {
      p.text?.removeFromParent();
      p.text = text3d(String(text), { height: 0.66, maxWidth: 0.95, color, weight: 0.12 });
      p.text.position.set(0, 0.28, 0.2);
      p.text.rotation.x = -0.95;
      g.add(p.text);
    };
    p.label(label, label === '?' ? '#ffd23c' : '#ffffff');
    g.scale.setScalar(size);
    Object.assign(p, { value: label, float: 0.03, hotAt: V(0, 0.15, 0) });
    p.position.set(x, 0, z);
    this.scene.add(p);
    this.pads.push(p);
    this.appear(p, this.pads.length * 0.06);
    return p;
  }

  async hopTo(pad, i) {
    this.audio.boing(0.8 + i * 0.06);
    await this.jump(this.frog, [pad.position.x, 0.1, pad.position.z - 0.5 * pad.size], { height: 1.5, dur: 0.46 });
    pad.boing();
    pad.text.setColor('#ffe27a');
    this.audio.step(i);
    this.fx.ring(this.at(pad), { color: '#dff8ff', r: 1.3 });
  }

  async play() {
    const treats = shuffle(TREATS);
    for (const [round, trail] of this.trails.entries()) {
      const treat = this.toy(treats[round], 0.8, TREAT);
      treat.float = 0.08;
      this.appear(treat);
      await (this.level === 3 ? this.gapRound(trail) : this.orderRound(trail));
      await this.jump(this.frog, FINISH, { height: 1.6, dur: 0.5 });
      this.win(this.frog);
      this.frog.spin();
      treat.hop(0.8).spin();
      this.fx.love(this.at(treat), 6);
      await this.talk('Ribbit!', { min: 1.5 });
      this.vanish(treat);
      this.pads.splice(0).forEach((p, i) => this.vanish(p, i * 0.03));
      if (round === this.trails.length - 1) break;
      this.audio.whoosh();
      await this.jump(this.frog, START, { height: 3.4, dur: 0.9 });
    }
    this.finish();
  }

  /** Pads are scattered; tap them in order. */
  async orderRound(trail) {
    const step = trail[1] - trail[0];
    const decoys = this.level === 4
      ? sample(up(1, trail[trail.length - 1]).filter((n) => !trail.includes(n) && (step > 2 ? n % step && n > 5 : true)), 10 - trail.length > 3 ? 3 : 2)
      : [];
    const n = trail.length + decoys.length;
    const [cols, rows] = n <= 3 ? [3, 1] : n <= 6 ? [3, 2] : [4, 3];
    const size = n <= 6 ? 1.3 : 1.05;
    const cells = sample(range(cols * rows), n).map((c) => [
      ((c % cols) - (cols - 1) / 2) * (cols === 3 ? 2.7 : 2.05) + rand(-0.12, 0.12),
      rows === 1 ? 0.8 + rand(-0.8, 0.8) : (Math.floor(c / cols) - (rows - 1) / 2) * (rows === 2 ? 3.2 : 2.35) + 0.9 + rand(-0.15, 0.15),
    ]);
    // The very youngest get a trail that runs left to right, like reading.
    if (this.level === 1) cells.sort((a, b) => a[0] - b[0]);
    const pads = [...trail, ...decoys].map((v, i) => this.pad(v, cells[i], size));
    const how = step === 1 ? ['Hop in order', this.roundsDone ? 'Hop across!' : 'Help the frog cross! Tap the numbers in order.']
      : step === -1 ? ['Count backwards', `Count backwards from ${numberWord(trail[0])}!`]
        : [`Count in ${step}s`, `Count in ${{ 2: 'twos', 5: 'fives', 10: 'tens' }[step]}!`];
    await this.wait(0.6);
    this.prompt(how[0], [how[1], `Find ${numberWord(trail[0])}.`]);
    let slips = 0;
    for (const [i, v] of trail.entries()) {
      const open = pads.filter((p) => !trail.slice(0, i).includes(p.value));
      if (i) this.speech = `What comes after ${numberWord(trail[i - 1])}?`;
      const pad = await this.choose(open, pads[i], {
        r: size * 0.82,
        wrong: (p) => [`That is ${numberWord(p.value)}.`, i && this.level > 1 ? this.speech : `Find ${numberWord(v)}.`],
      });
      slips += this.tries;
      this.tries = 0;
      this.audio.speak(numberWord(v));
      await this.hopTo(pad, i);
    }
    this.tries = slips;
  }

  /** A straight run of pads with one number missing. */
  async gapRound(trail) {
    const gap = randInt(1, trail.length - 1);
    const path = trail.map((v, i) => this.pad(i === gap ? '?' : v, [(i - 2) * 1.75, -1.3], 1.02));
    const picks = nearbyChoices(trail[gap], 3, 1, 22).map((v, i) => this.pad(v, [(i - 1) * 2.5, 2.9], 1.25));
    await this.wait(0.7);
    for (let i = 0; i < gap; i++) { this.audio.speak(numberWord(trail[i])); await this.hopTo(path[i], i); await this.wait(0.3); }
    this.prompt('Which number is missing?', `What comes after ${numberWord(trail[gap - 1])}?`);
    const right = await this.choose(picks, picks.find((p) => p.value === trail[gap]), { r: 1 });
    picks.forEach((p) => { if (p !== right) this.vanish(p); });
    this.scaleTo(right, 0.82, 0.45);
    await this.jump(right, path[gap].position.toArray(), { height: 1.4, dur: 0.45 });
    this.remove(right);
    this.pads = path;
    path[gap].label(trail[gap]);
    for (let i = gap; i < trail.length; i++) { this.audio.speak(numberWord(trail[i])); await this.hopTo(path[i], i); await this.wait(0.3); }
  }

  hint() { this.replayPrompt(); if (this.level === 1) this.point(this.solution()); }
}
