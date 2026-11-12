/**
 * Balloon Pop — adding and taking away, told as a little story.
 *
 * The sum happens in front of the child before it is asked: three ducks are on
 * the cloud, two more parachute in; or five are there and two float away on
 * balloons. What is left standing *is* the answer, and every one of them can
 * be tapped and counted. The top level drops the animals and trusts the
 * numerals; the first is simply colours and number shapes.
 *
 * Half way through, and again at the end, there is a balloon party: no
 * question at all, just pop as many as you like.
 */

import * as THREE from '../core/three.js';
import { Game, V } from '../core/engine.js';
import { build } from '../core/kit.js';
import { text3d } from '../core/glyphs.js';
import { sky, ground, clouds, greenery, bunting } from '../core/scenery.js';
import { partyBalloon } from '../core/props.js';
import { cloud } from '../models/nature.js';
import { Ease } from '../core/anim.js';
import { deck, range, rand, randInt, sample, shuffle, chance, nearbyChoices } from '../core/util.js';
import { CRITTERS, numberWord, plural } from '../data/words.js';

const PAINT = { red: '#ff4d5e', blue: '#3fa0f5', yellow: '#ffc21f', green: '#35c46a', purple: '#9b6cff', orange: '#ff8a2e', pink: '#ff8fc8' };
const PRIZES = ['star', 'candy', 'cupcake', 'gem', 'donut', 'heart', 'cookie', 'strawberry', 'crown', 'ball'];
const STAGE_Y = 3.55;

export default class BalloonMath extends Game {
  static meta = { id: 'balloon-math', tint: '#ff6b8b', music: 'fair' };

  init() {
    this.roundsTotal = this.level === 1 ? 6 : 8;
    this.view = { pos: V(0, 4.3, 17.5), look: V(0, 3.1, 0), fov: 30 };
    this.light({ span: 10, centre: [0, 3, 0] });
    sky(this, '#ffe6f2', '#a8e0ff', '#5ab8f7');
    ground(this, { color: '#8fe0a0', hills: ['#6fd08a', '#8fdca0', '#5fc47c'] });
    clouds(this, { y: [6, 11] });
    greenery(this, { x: [-22, 22], z: [-16, -11], trees: 8, bushes: 6 });
    this.buildFair();
    this.addPal([-4.55, 0, 2.2], { size: 1.9, hat: 'party-hat' });
    this.prizes = 0;
    this.cast = [];
  }

  buildFair() {
    this.scene.add(build((b) => {
      for (const [x, c] of [[-10.5, '#ff4d5e'], [11.5, '#3fa0f5']]) {
        b.cyl('#fff3e2', [x, 1.1, -9], 2.4, 2.2);
        for (let i = 0; i < 10; i++) b.lathe(i % 2 ? '#ffffff' : c, [x, 2.1, -9], [[2.9, 0], [1.4, 1.1], [0, 2.6]], { from: i * 0.628, sweep: 0.628, seg: 3, sharp: true });
        b.ball('#ffd23c', [x, 4.75, -9], 0.2);
      }
      bunting(b, [-10.5, 4.6, -9], [11.5, 4.6, -9], { n: 20, sag: 1.6, size: 0.55 });
    }));
    // A big wheel turning on the horizon.
    const wheel = build((b) => {
      b.torus('#ffffff', [0, 0, 0], 4, 0.1, { seg: 40 });
      for (let i = 0; i < 8; i++) {
        const x = Math.cos(i * 0.785) * 4, y = Math.sin(i * 0.785) * 4;
        b.rod('#ffffff', [0, 0, 0], [x, y, 0], 0.06);
        b.ball(Object.values(PAINT)[i % 7], [x, y, 0.2], 0.55);
      }
    }, { shadow: false });
    wheel.position.set(10.5, 5, -24);
    this.scene.add(wheel);
    this.every((dt) => { wheel.rotation.z += dt * 0.12; });

    if (this.level === 1 || this.level === 4) return;
    this.scene.add(build((b) => [-2.6, 0, 2.6].forEach((x) => b.group([x, STAGE_Y - 0.92, 0], [0, 0, 0], [3.4, 1.7, 2.4], () => cloud(b)))));
  }

  /* ----------------------------------------------------------------- rounds */

  async play() {
    const nextKind = deck(CRITTERS);
    for (let i = 0; i < this.roundsTotal; i++) {
      if (this.level === 1) await this.spotRound(i);
      else await this.sumRound(nextKind());
      if (i === this.roundsTotal / 2 - 1 || i === this.roundsTotal - 1) await this.party();
    }
    this.finish();
  }

  /** Float a set of balloons up from below the screen. */
  launch(items, { y = 0.75, size = 1.75 } = {}) {
    const gap = Math.min(2.5, 7.8 / items.length);
    return items.map(({ color, label }, i) => {
      const b = partyBalloon(PAINT[color], size);
      if (label != null) {
        const t = text3d(String(label), { height: size * 0.36, maxWidth: size * 0.56, shadow: false });
        t.position.set(0, size * 0.62, size * 0.43);
        b.act.add(t);
      }
      Object.assign(b, { name: color, value: label });
      b.position.set(0.75 + (i - (items.length - 1) / 2) * gap, -4, 2.2);
      this.scene.add(b);
      this.moveTo(b, [b.position.x, y + (i % 2) * 0.3, 2.2], 0.9, { delay: i * 0.1, ease: Ease.outBack });
      return b;
    });
  }

  pop(b) {
    const p = this.at(b);
    this.audio.pop();
    this.fx.ring(p, { color: b.color, r: 1.9 });
    this.fx.confetti(p, 22, { colors: [b.color, '#ffffff'] });
    this.fx.addShake(0.5);
    this.remove(b);
  }

  /** Pop the winner, let the rest drift off, and drop the prize it was hiding. */
  async payOut(balloons, right) {
    const from = right.position.clone();
    this.win(right);
    this.pop(right);
    for (const b of balloons) if (b !== right) this.moveTo(b, [b.position.x, 13, 2.2], 1.6, { ease: Ease.inQuad }).then(() => this.remove(b));
    const prize = this.toy(PRIZES[this.prizes % PRIZES.length], 0.75, [from.x, from.y + 0.8, from.z]);
    const x = -2.9 + this.prizes++ * 0.94;
    prize.spin();
    await this.jump(prize, [x, 0, 4.15], { height: 1.2, dur: 0.7 });
    this.audio.plop();
    this.poke(prize, { r: 0.4, sound: 'squeak' });
  }

  /** Level 1: find a colour, or a numeral. */
  async spotRound(i) {
    const colors = sample(Object.keys(PAINT).slice(0, 6), 3);
    const byColor = i % 2 === 0;
    const nums = sample([1, 2, 3, 4, 5], 3);
    const balloons = this.launch(colors.map((color, k) => ({ color, label: byColor ? null : nums[k] })), { y: 2, size: 2.3 });
    const right = sample(balloons, 1)[0];
    const said = (b) => (byColor ? b.name : numberWord(b.value));
    await this.wait(0.8);
    this.prompt(byColor ? `Pop the ${right.name} balloon` : 'Pop the number you hear',
      byColor ? `Pop the ${right.name} balloon!` : `Pop number ${said(right)}!`);
    await this.choose(balloons, right, { r: 1.05, wrong: (b) => [`That one is ${said(b)}.`, `Find ${said(right)}!`] });
    const done = this.payOut(balloons, right);
    await this.talk(`${said(right)}!`, { min: 1.2 });
    await done;
  }

  makeSum() {
    let a, b, plus = true;
    if (this.level === 2) { a = randInt(1, 5); b = randInt(1, Math.min(5, 10 - a)); }
    else if (this.level === 3) { a = randInt(3, 10); b = randInt(1, Math.min(5, a - 1)); plus = false; }
    else if (chance(0.5)) { a = randInt(5, 14); b = randInt(2, Math.min(9, 20 - a)); }
    else { a = randInt(9, 20); b = randInt(2, 9); plus = false; }
    const key = `${a}${plus}${b}`;
    if (key === this.lastSum) return this.makeSum();
    this.lastSum = key;
    return { a, b, plus, answer: plus ? a + b : a - b };
  }

  async sumRound(kind) {
    const { a, b, plus, answer } = this.makeSum();
    const big = this.level === 4;
    const sign = new THREE.Group();
    sign.position.set(0, big ? 4.7 : 5.55, big ? 0.5 : 0);
    sign.scale.setScalar(big ? 1.5 : 1);
    this.scene.add(sign);
    const words = [String(a), plus ? '+' : '−', String(b), '=', '?'];
    const parts = words.map((w, i) => text3d(w, { height: 0.72, color: i % 2 ? '#ffffff' : i === 4 ? '#ffd23c' : this.tint, weight: 0.125 }));
    let x = -(parts.reduce((s, p) => s + p.width + 0.3, -0.3)) / 2;
    const show = parts.map((p) => {
      p.position.x = x + p.width / 2;
      x += p.width + 0.3;
      p.visible = false;
      sign.add(p);
      return () => { p.visible = true; this.appear(p); this.audio.plop(); };
    });

    this.hud.prompt('');
    if (big) {
      for (const s of show) { s(); await this.wait(0.14); }
    } else {
      await this.story(kind, a, b, plus, show);
    }

    const values = nearbyChoices(answer, this.level === 2 ? 3 : 4, 0, 20);
    const colors = shuffle(Object.keys(PAINT));
    const balloons = this.launch(values.map((label, i) => ({ color: colors[i], label })), { y: big ? 1 : 0.3, size: big ? 1.9 : 1.55 });
    const op = plus ? 'plus' : 'take away';
    this.prompt('Pop the answer!', `What is ${numberWord(a)} ${op} ${numberWord(b)}?`);
    await this.wait(0.9);       // let them float into place before anyone aims at one
    const right = await this.choose(balloons, balloons.find((k) => k.value === answer), {
      r: big ? 0.9 : 0.75,
      wrong: () => (big ? undefined : `Tap the ${kind.many} on the cloud to count them.`),
    });

    const q = parts[4], solved = text3d(String(answer), { height: 0.72, color: '#ffd23c', weight: 0.125 });
    solved.position.x = q.position.x + (solved.width - q.width) / 2;
    sign.remove(q);
    sign.add(solved);
    this.appear(solved);
    this.cast.forEach((c) => { c.dancing = true; });
    const done = this.payOut(balloons, right);
    await this.talk(`${numberWord(a)} ${op} ${numberWord(b)} is ${numberWord(answer)}!`, { min: 1.6 });
    await done;
    this.vanish(sign);
    this.cast.forEach((c, i) => this.vanish(c, i * 0.03));
    this.cast = [];
    await this.wait(0.4);
  }

  /** Act the sum out on the cloud. */
  async story(kind, a, b, plus, show) {
    const total = plus ? a + b : a;
    const step = Math.min(1.25, 8.4 / total);
    const split = plus ? 0.45 : 0;
    const spot = (i) => [(i - (total - 1) / 2) * step + (i < a ? -split : split) / 2, STAGE_Y, 0.55];
    const add = (i) => {
      const c = this.toy(kind.one, Math.min(1.15, step * 1.02), spot(i));
      this.cast.push(c);
      return this.hot(c, { r: step / 2, tap: () => this.countOne(c) });
    };
    this.tally = 0;
    show[0]();
    range(a).forEach((i) => this.appear(add(i), i * 0.08));
    await this.talk(`${numberWord(a)} ${plural(kind, a)}.`, { min: 0.9 + a * 0.06 });
    show[1]();
    show[2]();
    const said = this.talk(plus ? `${numberWord(b)} more!` : `${numberWord(b)} ${b === 1 ? 'floats' : 'float'} away!`, { min: 1.2 });
    if (plus) {
      await Promise.all(range(b).map((k) => {
        const c = add(a + k);
        c.position.y = 11;
        return this.moveTo(c, spot(a + k), 0.8, { delay: k * 0.16, ease: Ease.outBounce }).then(() => { c.boing(); this.audio.boing(); });
      }));
    } else {
      this.audio.whoosh();
      await Promise.all(this.cast.splice(a - b).map(async (c, k) => {
        const lift = partyBalloon(Object.values(PAINT)[k], 0.9, 0.55);
        lift.position.y = c.height + 0.45;
        c.add(lift);
        c.gone = true;
        await this.appear(lift, k * 0.12);
        await this.moveTo(c, [c.position.x + rand(1.5, 3), 12, 0.55], 1.7, { ease: Ease.inQuad });
        this.remove(c);
      }));
    }
    await said;
    show[3]();
    show[4]();
  }

  /** Tapping the cast counts them, starting over once everyone has had a turn. */
  countOne(c) {
    if (c.counted || this.tally >= this.cast.length) { this.tally = 0; this.cast.forEach((k) => { k.counted = false; }); }
    c.counted = true;
    c.hop(0.4);
    this.audio.step(this.tally++);
    this.audio.speak(numberWord(this.tally));
    this.fx.floatText(this.at(c), String(this.tally), { color: '#ffe27a', size: 0.55 });
  }

  /** No question, no score: ten balloons drift up and every pop counts one more. */
  async party() {
    this.prompt('Balloon party!', 'Balloon party! Pop them all!');
    this.pal.dancing = true;
    let popped = 0, left = 10;
    const off = () => { if (--left === 0) this.resolve(); };
    this.loose = shuffle(range(10)).map((lane, i) => {
      const b = partyBalloon(Object.values(PAINT)[i % 7], 1.5);
      b.position.set(-4 + lane * 0.92, -3.5, 1.4 + (i % 3) * 0.6);
      this.scene.add(b);
      this.moveTo(b, [b.position.x + rand(-0.6, 0.6), 9.5, b.position.z], rand(6.5, 8), { delay: i * 0.5, ease: Ease.linear })
        .then(() => { if (b.parent) { this.remove(b); off(); } });
      return this.hot(b, {
        r: 0.75,
        tap: () => {
          this.fx.floatText(this.at(b), String(++popped), { color: '#ffffff', size: 0.9 });
          this.audio.step(popped);
          this.audio.speak(numberWord(popped), { rate: 1.1 });
          this.pop(b);
          off();
        },
      });
    });
    await this.ask();
    this.loose = null;
    this.pal.dancing = false;
    await this.wait(0.7);
  }

  solution() {
    const b = this.loose?.find((k) => k.parent && Math.abs(this.at(k).y) < 2.8);
    return this.loose ? b && { tap: b } : super.solution();
  }
}
