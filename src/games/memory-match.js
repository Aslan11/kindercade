/**
 * Magic Match — working memory, and quietly two other things.
 *
 * Whatever is under a card springs up off it and says its name. The twist is
 * that pairs are not always identical: level 3 pairs a numeral with a
 * quantity, and level 4 pairs a capital with its small letter, so matching
 * becomes the vehicle for the correspondence.
 */

import { Game, V } from '../core/engine.js';
import { Toy } from '../core/toy.js';
import { Builder, build, instantiate, Shapes } from '../core/kit.js';
import { text3d } from '../core/glyphs.js';
import { sky, starfield } from '../core/scenery.js';
import { Ease } from '../core/anim.js';
import { range, sample, shuffle } from '../core/util.js';
import { LETTER_NAME, numberWord } from '../data/words.js';

const BOARDS = { 1: [3, 2], 2: [4, 3], 3: [4, 3], 4: [4, 4] };
const PEEK = { 1: 3.2, 2: 2 };
const ANIMALS = ['cat', 'dog', 'pig', 'cow', 'fox', 'bee', 'owl', 'frog', 'lion', 'duck', 'panda', 'monkey', 'unicorn', 'octopus', 'elephant', 'penguin', 'bunny', 'dinosaur'];
const PLURAL = { fox: 'foxes', octopus: 'octopuses', bunny: 'bunnies' };
const LEAN = -0.62;      // tip upright things back toward the camera

export default class MemoryMatch extends Game {
  static meta = { id: 'memory-match', tint: '#9b6cff', music: 'magic' };

  init() {
    const [cols, rows] = BOARDS[this.level];
    this.roundsTotal = (cols * rows) / 2;
    this.view = { pos: V(0, 13, 11.5), look: V(0, 0, -0.95), fov: 30 };
    this.light({ span: 9, shade: '#b4a4ea' });
    sky(this, '#5a3fb0', '#3d2a94', '#24166a');
    starfield(this);
    this.scene.add(build((b) => {
      b.cyl('#7a55d6', [0, -0.4, 0.4], 9.5, 0.8, { seg: 48, scale: [1, 1, 0.72] });
      b.cyl('#ffd23c', [0, -0.5, 0.4], 9.7, 0.7, { seg: 48, scale: [1, 1, 0.72] });
      b.box('#ffd23c', [0.9, 0.2, -3.75], [9, 0.4, 1], { r: 0.16 });
      b.both((s) => { for (let i = 0; i < 5; i++) b.cyl('#e0324a', [s * (8 + i * 0.85), 4, -5.5 + i * 0.5], 0.55, 14); });
    }));
    this.addPal([-4.75, 0, -3.1], { size: 1.9, hat: 'wizard-hat' }).rotation.x = -0.4;
    this.deal(cols, rows);
  }

  faces() {
    const n = this.roundsTotal;
    const flat = (text, color) => () => { const t = text3d(text, { height: this.h * 0.56, color, ink: true, weight: 0.115 }); t.position.y = this.h * 0.2; return new Toy(t, this.h * 0.5); };
    if (this.level <= 2) return sample(ANIMALS, n).map((a) => ({ key: a, both: `Two ${PLURAL[a] || `${a}s`}!`, faces: [0, 1].map(() => ({ say: a, make: () => new Toy(a, this.h * 0.82) })) }));
    if (this.level === 3) {
      return sample(range(9).map((i) => i + 1), n).map((v) => ({
        key: v, both: `${numberWord(v)}!`,
        faces: [{ say: numberWord(v), make: flat(String(v), '#ff4d78') }, { say: numberWord(v), make: () => this.dots(v), lie: true }],
      }));
    }
    // Letters whose two cases look clearly different.
    return sample([...'abdefghkmnqrty'], n).map((c) => ({
      key: c, both: `Big ${LETTER_NAME[c]}, little ${LETTER_NAME[c]}!`,
      faces: [{ say: `big ${LETTER_NAME[c]}`, make: flat(c.toUpperCase(), '#ff4d78') }, { say: `little ${LETTER_NAME[c]}`, make: flat(c, '#2f8fe8') }],
    }));
  }

  /** A quantity in tidy rows of three, so five *looks* like five. */
  dots(n) {
    const k = this.h * 0.27, rows = Math.ceil(n / 3);
    return new Toy(build((b) => range(n).forEach((i) => {
      const row = Math.floor(i / 3), inRow = Math.min(3, n - row * 3);
      b.ball('#2f8fe8', [((i % 3) - (inRow - 1) / 2) * k * 1.15, 0.06, (row - (rows - 1) / 2) * k], [k * 0.42, 0.09, k * 0.42], { surf: 'shiny' });
    })), this.h * 0.5, { idle: 0 });
  }

  deal(cols, rows) {
    const h = this.h = rows === 2 ? 2.3 : rows === 3 ? 1.75 : 1.36;
    const w = rows === 2 ? 2.3 : rows === 3 ? 1.95 : 1.8, gap = 0.26;
    const b = new Builder({ ao: false });
    b.box('#ffffff', [0, 0, 0], [w, 0.16, h], { r: 0.08 });
    b.box('#ff6bb0', [0, 0.06, 0], [w - 0.16, 0.08, h - 0.16], { r: 0.04, ao: false });
    b.pillow('#ffd23c', [0, 0.11, 0], Shapes.star(h * 0.3, h * 0.16), 0.06, { rot: [-Math.PI / 2, 0, 0] });
    const design = this.design = b.bake();
    const pairs = this.faces();
    this.cards = shuffle(pairs.flatMap((p) => p.faces.map((f) => ({ ...f, pair: p })))).map((info, i) => {
      const plate = instantiate(design, { receive: true }).root;
      const card = new Toy(plate, 0.2, { idle: 0 });
      Object.assign(card, info, { plate, hotAt: V(0, 0.1, 0) });
      card.position.set(((i % cols) - (cols - 1) / 2) * (w + gap), 0.1, (Math.floor(i / cols) - (rows - 1) / 2) * (h + gap) + 0.95);
      card.show = info.make();
      card.show.position.set(0, 0.1, info.lie ? 0 : h * 0.16);
      if (!info.lie) card.show.rotation.x = this.level > 2 ? -1 : LEAN;
      card.show.visible = false;
      card.add(card.show);
      this.scene.add(card);
      this.appear(card, 0.5 + i * 0.05);
      return this.hot(card, { box: [w / 2, h / 2], flat: true, when: () => !card.faceUp, tap: () => this.turn(card) });
    });
    this.open = [];
  }

  async flip(card, up) {
    card.faceUp = up;
    card.hop(2.2, 0.3);
    this.audio.flip();
    if (!up) this.scaleTo(card.show, 0.001, 0.12).then(() => { card.show.visible = card.faceUp; });
    await this.to(card.plate.rotation, { z: up ? Math.PI : 0 }, 0.28, { ease: Ease.inOutQuad });
    if (!up) return;
    card.show.visible = true;
    await this.appear(card.show);
  }

  async play() {
    await this.wait(0.8);
    if (PEEK[this.level]) {
      this.prompt('Look and remember', 'Look carefully!');
      await Promise.all(this.cards.map((c) => this.flip(c, true)));
      await this.wait(PEEK[this.level]);
      await Promise.all(this.cards.map((c) => this.flip(c, false)));
    }
    this.prompt('Find the pairs', 'Find two cards that go together.');
    while (this.roundsDone < this.roundsTotal) {
      await this.ask();
      const [a, b] = this.open.splice(0);
      await this.wait(0.75);
      if (a.pair === b.pair) await this.matched(a, b);
      else {
        // Forgetting where a card was is the game, not a failure: no sad noises.
        this.mistakes++;
        this.tries++;
        a.show.wiggle(); b.show.wiggle();
        this.pal.feel('think', 1);
        await this.wait(0.65);
        await Promise.all([this.flip(a, false), this.flip(b, false)]);
      }
    }
    await this.wait(1);
    this.finish();
  }

  turn(card) {
    this.flip(card, true);
    this.audio.speak(card.say);
    if (this.open.push(card) === 2) this.resolve();
  }

  /** A found pair takes a bow and hops up onto the trophy shelf. */
  async matched(a, b) {
    const slot = this.roundsDone, step = 8.2 / this.roundsTotal;
    this.win(a.position.clone().lerp(b.position, 0.5));
    this.audio.speak(a.pair.both, { delay: 0.2 });
    a.show.hop(0.5).spin(); b.show.hop(0.5).spin();
    await this.wait(0.7);
    const keep = (a.lie ? b : a).show;
    this.scene.attach(keep);
    this.scaleTo(keep, Math.min(1.05, step * 0.95) / (this.h * 0.8), 0.5);
    this.jump(keep, [0.9 + (slot - (this.roundsTotal - 1) / 2) * step, 0.4, -3.65], { height: 2, dur: 0.55 }).then(() => { keep.dancing = true; });
    [a, b].forEach((c) => { this.fx.puff(this.at(c), 8, { color: '#e2d2ff' }); this.vanish(c); });
    this.audio.magic();
    this.cards = this.cards.filter((c) => c !== a && c !== b);
    await this.wait(0.35);
  }

  solution() {
    const [first] = this.open;
    return { tap: first ? this.cards.find((c) => c !== first && c.pair === first.pair) : this.cards[0] };
  }

  nudgeChoices() { this.cards.forEach((c, i) => { if (!c.faceUp) this.tweens.after(i * 0.04, () => c.hop(1.2, 0.3)); }); }

  /** A long run of bad luck earns a helping hand. */
  hint() { this.replayPrompt(); if (this.level === 1 || this.tries >= 4) this.point(this.solution()); }

  destroy() { this.design.parts[0].geo.dispose(); }

  starsEarned() {
    if (this.mistakes <= this.roundsTotal) return 3;
    return this.mistakes <= this.roundsTotal * 2.5 ? 2 : 1;
  }
}
