/**
 * Sound Safari — phonemic awareness, from the back of a jeep.
 *
 * Hearing the separate sounds inside a spoken word is the strongest single
 * predictor of how easily a child learns to read, and it is an *ear* skill
 * before it is an eye skill. Three rules follow:
 *
 *   The answer is never written down. The sign shows "_ a t", so the animal
 *   and the voice are the only way in.
 *
 *   Only words whose spelling matches their sound are used — see
 *   `startsWithItsLetter` / `endsWithItsLetter` in the word data.
 *
 *   No wrong answer may sound like the right one. C and K both say "kuh", so
 *   they are never offered together.
 */

import * as THREE from '../core/three.js';
import { Game, V } from '../core/engine.js';
import { Toy, block, slab } from '../core/toy.js';
import { build } from '../core/kit.js';
import { text3d } from '../core/glyphs.js';
import { sky, ground, clouds, sun } from '../core/scenery.js';
import { addWheels, CANDY } from '../core/props.js';
import { bush } from '../models/nature.js';
import { Ease } from '../core/anim.js';
import { deck, pick, sample, shuffle, makeRng } from '../core/util.js';
import {
  WORDS, LETTER_SOUND, LETTER_NAME, SOUND_LETTERS, startsWithItsLetter, endsWithItsLetter,
} from '../data/words.js';

const WILD = ['lion', 'tiger', 'zebra', 'elephant', 'monkey', 'giraffe', 'snake', 'frog', 'bear', 'panda', 'koala', 'owl', 'fox', 'duck', 'turtle', 'penguin'];

/** Pairs a five-year-old routinely mixes up — used as deliberate distractors. */
const CONFUSABLE = {
  b: 'dp', d: 'bp', p: 'bd', m: 'nw', n: 'mh', w: 'mv', v: 'wf', f: 'vt', g: 'jk', j: 'gy', s: 'zf', c: 'gs', k: 'gt', z: 's', t: 'fd', l: 'r', r: 'lw',
};
const LAP = 48;      // the background repeats every this many units
const HOP = 16;      // …and the jeep covers this much between stops

export default class SoundSafari extends Game {
  static meta = { id: 'sound-safari', tint: '#2fb0ee', music: 'safari' };

  init() {
    this.roundsTotal = this.level === 1 ? 6 : 8;
    this.view = { pos: V(0, 5, 17.5), look: V(0, 2.2, 0), fov: 30 };
    this.light({ span: 10, sun: '#fff4dc' });
    sky(this, '#fff0cf', '#bfe9ff', '#6fc8f7');
    ground(this, { color: '#f2cf6a', hills: ['#e0b858', '#d9a850', '#eec870'] });
    sun(this, [-10, 9.6, -24], 4.2);
    clouds(this, { n: 4, y: [8, 11] });
    this.trip = { position: V() };
    this.buildSavanna();
    this.buildJeep();
  }

  buildSavanna() {
    for (const lap of [0, 1]) {
      const rng = makeRng(11);
      const strip = build((b) => {
        for (let i = 0; i < 7; i++) {
          const x = (i / 7) * LAP + rng() * 3, z = -7 - rng() * 7, h = 2.6 + rng() * 1.2;
          b.tube('#9a6238', [[x, 0, z], [x + 0.15, h * 0.6, z], [x - 0.2, h, z]], 0.16);
          b.rod('#9a6238', [x + 0.1, h * 0.55, z], [x + 0.9, h, z], 0.1);
          b.ball('#6fb83c', [x + 0.2, h + 0.3, z], [2.2, 0.55, 1.3]);
          b.ball('#86cc4a', [x - 0.2, h + 0.7, z], [1.4, 0.4, 1]);
        }
        for (let i = 0; i < 46; i++) {
          const x = rng() * LAP, z = rng() < 0.6 ? -6 + rng() * 4 : 5.4 + rng();
          for (const a of [-0.4, 0, 0.4]) b.cone('#d9a83c', [x + a * 0.15, 0, z], 0.06, 0.42, { rot: [0, 0, -a], seg: 9 });
        }
      }, { detail: 0.6 });
      this.scene.add(strip);
      this.every(() => { strip.position.x = -(this.trip.position.x % LAP) - LAP / 2 + lap * LAP; });
    }
  }

  buildJeep() {
    const jeep = new THREE.Group();
    jeep.add(build((b) => {
      b.box('#58b84a', [0, 0.85, 0], [2.9, 0.75, 1.4], { r: 0.22, surf: 'shiny' });
      b.box('#58b84a', [0.95, 1.25, 0], [0.95, 0.4, 1.3], { r: 0.18, surf: 'shiny' });
      b.box('#bfe9ff', [0.5, 1.75, 0], [0.08, 0.7, 1.2], { rot: [0, 0, 0.2] });
      b.ball('#fff3b0', [1.45, 0.95, 0.42], [0.07, 0.16, 0.16], { surf: 'glow' });
      for (const x of [-0.9, -0.3, 0.3]) b.ball('#2f8a3c', [x, 0.85, 0.7], [0.2, 0.13, 0.02], { ao: false });
    }, { ao: true }));
    addWheels(this, jeep, [[-0.9, 0.45, 0.7], [0.9, 0.45, 0.7]], '#ffffff', this.trip);
    this.jeep = new Toy(jeep, 2, { idle: 0.3 });
    this.jeep.position.set(-4.35, 0, 0.6);
    this.scene.add(this.jeep);
    this.addPal([-0.45, 0.95, 0.1], { size: 1.75, hat: 'sun-hat', parent: jeep });
    this.toy('camera', 0.62, [0.02, 1.32, 0.62], jeep);
  }

  /** Drive on: the last stop slides away and a new one rolls in. */
  async driveTo(stop) {
    const old = this.stop, from = this.trip.position.x;
    this.stop = stop;
    stop.position.x = HOP;
    this.scene.add(stop);
    this.audio.honk();
    let bump = 0;
    await this.to(this.trip.position, { x: from + HOP }, 1.5, {
      ease: Ease.inOutCubic,
      onUpdate: (k) => {
        if (old) old.position.x = -k * HOP;
        stop.position.x = HOP - k * HOP;
        if (k - bump > 0.16) { bump = k; this.jeep.hop(0.06, 0.18); this.fx.puff(this.at(V(-5.7, 0.2, 1)), 2, { color: '#ffe9c0' }); }
      },
    });
    if (old) this.remove(old);
  }

  /** Bushes with something hiding in each. Resolves once they have popped out. */
  async arrive(names, size, gap, x0) {
    const stop = new THREE.Group();
    const spots = names.map((name, i) => {
      const x = x0 + (i - (names.length - 1) / 2) * gap;
      const mesh = build((b) => bush(b), { ao: true });
      mesh.scale.setScalar(size * 0.98);
      const cover = new Toy(mesh, size, { idle: 0 });
      cover.position.set(x, 0, -0.5);
      stop.add(cover);
      return { name, x, cover };
    });
    await this.driveTo(stop);
    this.audio.rustle();
    spots.forEach((s) => s.cover.wiggle(0.8));
    await this.wait(0.55);
    const toys = spots.map((s, i) => {
      const t = this.toy(s.name, size, [s.x, 0, -1], stop);
      this.appear(t, i * 0.14);
      this.jump(t, [s.x, 0, 0.9], { height: 1.6, dur: 0.55, delay: i * 0.14 }).then(() => this.audio.boing());
      return t;
    });
    await this.wait(0.7 + names.length * 0.14);
    return toys;
  }

  snap(toy) {
    this.audio.shutter();
    this.hud.flash();
    this.hud.photo(this.engine.snapshot(toy.kind, 200));
    this.win(toy, { quiet: true });
    toy.hop(0.3).spin();
  }

  /* ----------------------------------------------------------------- rounds */

  async play() {
    const end = this.level === 4;
    // "bel_" would print its own answer, so doubled endings sit the last level out.
    const fair = end ? (w) => endsWithItsLetter(w) && !/(.)\1$/.test(w) : startsWithItsLetter;
    const pool = WORDS.filter((w) => w.tier <= (this.level === 2 ? 1 : 2) && fair(w.word)).map((w) => w.word);
    const next = deck(this.level === 1 ? WILD : pool);
    for (let i = 0; i < this.roundsTotal; i++) {
      if (this.level === 1) await this.spot(next());
      else if (!end && i % 3 === 2) await this.whichStarts(next(), pool);
      else await this.whichLetter(next(), end);
    }
    this.finish();
  }

  /** Level 1: listen for a name and find its owner. */
  async spot(name) {
    const toys = await this.arrive(shuffle([name, ...sample(WILD.filter((n) => n !== name), 2)]), 2.2, 2.55, 1.5);
    this.prompt('Take a photo!', `Where is the ${name}? Take a photo!`);
    const right = await this.choose(toys, toys.find((t) => t.kind === name), { wrong: (t) => [`That is the ${t.kind}.`, `Find the ${name}!`] });
    this.snap(right);
    const [letter] = this.row([block(name[0].toUpperCase(), { size: 1.2, color: this.tint })], { x: 1, z: 4.9 });
    await this.talk([`${name}!`, `${name} starts with ${LETTER_NAME[name[0]]}.`], { min: 1.8 });
    this.vanish(letter);
  }

  /** The word with a hole in it, on a wooden sign. */
  sign(word, hole) {
    const step = 0.92, g = new THREE.Group();
    g.add(slab(word.length * step + 0.4, 1.36, 0.2, '#ffffff', 0.1));
    [...word].forEach((ch, i) => {
      const x = (i - (word.length - 1) / 2) * step;
      const mark = i === hole ? slab(0.76, 1.06, 0.06, '#e2d9f7', 0.03) : text3d(ch, { height: 0.86, color: '#3f9bf0', shadow: false });
      mark.position.set(x, i === hole ? 0.15 : 0.82, 0.14);
      g.add(mark);
      if (i === hole) g.slot = V(x, 0.82, 0.24);
    });
    g.position.set(1.3, 3.55, 0);
    this.stop.add(g);
    this.appear(g);
    return g;
  }

  distractors(answer, word, n) {
    const ok = (c) => c !== word[0] && c !== word[word.length - 1] && LETTER_SOUND[c] !== LETTER_SOUND[answer] && !(answer === 'x' && 'ks'.includes(c));
    const tricky = this.level >= 3 ? [...(CONFUSABLE[answer] || '')].filter(ok) : [];
    const first = tricky.length ? [pick(tricky)] : [];
    return [...first, ...sample(SOUND_LETTERS.filter((c) => ok(c) && c !== first[0]), n - first.length)];
  }

  async whichLetter(word, end) {
    const hole = end ? word.length - 1 : 0, answer = word[hole], sound = LETTER_SOUND[answer];
    const verb = end ? 'ends' : 'starts';
    const [toy] = await this.arrive([word], 2.7, 0, 1.3);
    this.poke(toy, { r: 1.1, sound: 'squeak' });
    const sign = this.sign(word, hole);
    const letters = shuffle([answer, ...this.distractors(answer, word, this.level === 2 ? 2 : 3)]);
    const tiles = this.row(letters.map((c, i) => block(c.toUpperCase() + c, { size: 1.15, width: 1.45, color: CANDY[i] })), { x: 0.2, z: 4.95, gap: 1.8 });
    const helped = [{ text: word, rate: 0.72, gap: 0.35 }, { text: `${word} ${verb} with ${sound}, ${sound}`, rate: 0.8, gap: 0.3 }, 'Which letter?'];
    // Level 2 pulls the sound out of the word; after that it is the child's job, until they need a hand.
    this.prompt(`What sound does it ${end ? 'end' : 'start'} with?`, this.level === 2 ? helped
      : [{ text: word, rate: 0.7, gap: 0.4 }, { text: `What sound does ${word} ${end ? 'end' : 'start'} with?`, rate: 0.9 }]);
    const right = await this.choose(tiles, tiles[letters.indexOf(answer)], {
      r: 0.75,
      wrong: (t) => { this.speech = helped; return [{ text: `That one says ${LETTER_SOUND[t.label[1]]}.`, rate: 0.85, gap: 0.3 }, ...helped.slice(1)]; },
    });
    this.audio.stopSpeech();
    tiles.forEach((t) => { if (t !== right) this.vanish(t); });
    this.scaleTo(right, 0.4, 0.45);
    await this.jump(right, sign.localToWorld(sign.slot.clone()).toArray(), { height: 1, dur: 0.45 });
    this.remove(right);
    const found = text3d(answer, { height: 0.86, color: '#ff4d78', shadow: false });
    found.position.copy(sign.slot);
    sign.add(found);
    this.appear(found);
    this.snap(toy);
    await this.talk([
      { text: `${word} ${verb} with ${sound}`, rate: 0.82, gap: 0.3, delay: 0.4 },
      { text: `That is ${LETTER_NAME[answer]}`, rate: 0.9 },
    ], { min: 2 });
  }

  /** The same skill turned round: here is the letter — who starts with it? */
  async whichStarts(word, pool) {
    const letter = word[0], sound = LETTER_SOUND[letter];
    const others = [];
    for (const w of shuffle(pool)) {
      if (others.length < 2 && ![word, ...others].some((o) => LETTER_SOUND[o[0]] === LETTER_SOUND[w[0]])) others.push(w);
    }
    const toys = await this.arrive(shuffle([word, ...others]), 2.1, 2.55, 1.5);
    const [tile] = this.row([block(letter.toUpperCase() + letter, { size: 1.2, width: 1.6, color: this.tint })], { x: 1, z: 4.9 });
    this.prompt('Which one starts with this letter?', [
      { text: `Which one starts with ${sound}?`, rate: 0.85, gap: 0.3 },
      ...toys.map((t) => ({ text: t.kind, rate: 0.8, gap: 0.35, onStart: () => t.hop(0.25) })),
    ]);
    const right = await this.choose(toys, toys.find((t) => t.kind === word), {
      wrong: (t) => [{ text: `${t.kind} starts with ${LETTER_SOUND[t.kind[0]]}.`, rate: 0.85, gap: 0.3 }, { text: `Find ${sound}.`, rate: 0.85 }],
    });
    this.snap(right);
    await this.talk({ text: `${sound}, ${sound}, ${word}!`, rate: 0.8, delay: 0.4 }, { min: 1.8 });
    this.vanish(tile);
  }
}
