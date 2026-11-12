/**
 * Word Train — mapping sounds to letters, in order.
 *
 * The child sees a thing, hears its name, and loads one letter per wagon. Each
 * letter that lands says its *sound*, so building c-a-t is blending rather
 * than copying — the word itself is never shown. (Level 1 is the exception on
 * purpose: for a three-year-old, matching a letter to its twin *is* the game.)
 * Tap a block or drag it; both work. When the word is right, the train leaves.
 */

import * as THREE from '../core/three.js';
import { Game, V } from '../core/engine.js';
import { block } from '../core/toy.js';
import { build } from '../core/kit.js';
import { text3d } from '../core/glyphs.js';
import { sky, ground, clouds, greenery, sun } from '../core/scenery.js';
import { addWheels, CANDY } from '../core/props.js';
import { Ease } from '../core/anim.js';
import { deck, sample, shuffle } from '../core/util.js';
import { WORDS, LETTER_SOUND, LETTER_NAME, ALPHABET, DECODABLE } from '../data/words.js';

const SPARE = { 1: 0, 2: 1, 3: 2, 4: 2 };
const TRACK_Z = -0.6, WAGON = 1.62, DECK = 0.72, TILE = 1.08;

export default class WordBuilder extends Game {
  static meta = { id: 'word-builder', tint: '#5b8cff', music: 'train' };

  init() {
    this.roundsTotal = this.level === 1 ? 5 : 6;
    this.view = { pos: V(0, 5, 17.8), look: V(0, 2.1, 0), fov: 30 };
    this.light({ span: 10 });
    sky(this);
    ground(this, { hills: ['#74cc54', '#8fb8e8', '#62bd4c'] });
    clouds(this);
    sun(this, [11, 10, -24]);
    greenery(this, { x: [-22, 22], z: [-14, -7], trees: 10, bushes: 6, seed: 17, keepClear: (x) => Math.abs(x + 1.2) < 3.4 });
    greenery(this, { x: [-12, 12], z: [-5, -2.4], flowers: 14, tufts: 14 });
    this.scene.add(build((b) => {
      for (let x = -30; x <= 30; x += 0.9) b.box('#9a6238', [x, 0.04, TRACK_Z], [0.34, 0.08, 1.9], { seg: 1 });
      b.both((s) => b.box('#93a4bd', [0, 0.13, TRACK_Z + s * 0.62], [64, 0.12, 0.12], { seg: 1 }));
      b.box('#ffd9a8', [0, 0.02, 8.6], [40, 0.16, 12], { r: 0.06 });
      b.box('#ffd23c', [0, 0.1, 2.72], [40, 0.04, 0.2], { seg: 1 });
      b.cyl('#ffffff', [-1.2, 1, -4], [1.5, 1.7], 2, { seg: 32 });
      b.cyl(this.tint, [-1.2, 2.06, -4], 1.65, 0.2, { seg: 32, surf: 'shiny' });
    }));
    this.buildEngine();
  }

  showHud() {
    super.showHud();
    this.hud.button('bulb', '#ffc93c', 'Hint', () => this.help());
  }

  buildEngine() {
    this.train = new THREE.Group();
    this.engineCar = new THREE.Group();
    this.engineCar.add(build((b) => {
      b.box('#3a3346', [0, 0.52, 0], [3, 0.24, 1.2]);
      b.cyl('#ff4d5e', [0.6, 1.2, 0], 0.6, 1.7, { rot: [0, 0, Math.PI / 2], surf: 'shiny' });
      for (const x of [0.2, 1]) b.torus('#ffd23c', [x, 1.2, 0], 0.6, 0.05, { rot: [0, Math.PI / 2, 0] });
      b.cyl('#3a3346', [1.05, 2.1, 0], [0.32, 0.18], 0.75);
      b.ball('#ffd23c', [0.3, 1.82, 0], 0.2, { surf: 'gold' });
      b.ball('#fff3b0', [1.46, 1.2, 0], [0.1, 0.24, 0.24], { surf: 'glow' });
      b.box('#4c8cf0', [-0.85, 0.98, 0], [1.25, 0.75, 1.3], { r: 0.14, surf: 'shiny' });
      b.cone('#ffd23c', [1.45, 0.42, 0], 0.5, 0.5, { rot: [0, 0, -Math.PI / 2], scale: [0.5, 1, 1.2] });
    }, { ao: true }));
    addWheels(this, this.engineCar, [[-0.85, 0.46, 0.64], [0.3, 0.34, 0.62], [1.05, 0.34, 0.62]], '#ffd23c', this.train);
    this.addPal([-0.85, 1.05, 0.1], { size: 1.7, hat: 'cap', parent: this.engineCar });
    this.train.add(this.engineCar);
    this.train.position.set(-26, 0.12, TRACK_Z);
    this.scene.add(this.train);
    // Five wagons are built once; each word couples up as many as it needs.
    this.wagons = [0, 1, 2, 3, 4].map((i) => {
      const w = new THREE.Group();
      w.add(build((b) => {
        b.box(CANDY[i], [0, 0.58, 0], [WAGON - 0.14, 0.28, 1.2], { surf: 'shiny' });
        b.box('#ffffff', [0, DECK + TILE / 2 + 0.04, -0.42], [TILE + 0.16, TILE + 0.12, 0.1], { r: 0.05 });
        b.box('#d9cff2', [0, DECK + TILE / 2 + 0.04, -0.36], [TILE - 0.06, TILE - 0.1, 0.04], { ao: false });
        b.rod('#3a3346', [WAGON / 2 - 0.1, 0.52, 0], [WAGON / 2 + 0.1, 0.52, 0], 0.06);
      }));
      addWheels(this, w, [[-0.42, 0.26, 0.62], [0.42, 0.26, 0.62]], '#ffffff', this.train);
      w.hotAt = V(0, DECK + TILE / 2, 0);
      this.train.add(w);
      return w;
    });
  }

  async roll(x, dur, ease) {
    this.rolling = true;
    await this.to(this.train.position, { x }, dur, { ease });
    this.rolling = false;
  }

  update(dt, t = this.t) {
    if (t % (this.rolling ? 0.17 : 1.1) > dt) return;
    this.fx.puff(this.at(this.engineCar.localToWorld(V(1.05, 2.55, 0))), 1, { spread: 0.5, size: this.rolling ? 0.4 : 0.26, rise: 2.4 });
    if (this.rolling) this.audio.chuff();
  }

  /* ----------------------------------------------------------------- rounds */

  async play() {
    const tier = Math.max(1, this.level - 1);
    // The first spelling level sticks to words that are spelt the way they sound.
    const next = deck(WORDS.filter((w) => w.tier === tier && (this.level !== 2 || DECODABLE.includes(w.word))).map((w) => w.word));
    for (let i = 0; i < this.roundsTotal; i++) await this.round(next());
    this.finish();
  }

  async round(word) {
    const n = word.length, length = n * WAGON + 3.1;
    // The sound, not the name: dropping the c into c-a-t says "kuh". But the e
    // in "cake" does not say "eh", so an irregular word gets letter names.
    this.voiceOf = this.level > 1 && DECODABLE.includes(word) ? LETTER_SOUND : LETTER_NAME;
    this.asked += n;
    this.slots = this.wagons.slice(0, n);
    this.wagons.forEach((w, i) => {
      w.visible = i < n;
      w.position.x = -length / 2 + WAGON * (i + 0.5);
      Object.assign(w, { letter: word[i], tile: null });
      if (this.level > 1 || i >= n) return;
      w.ghost = text3d(word[i], { height: TILE * 0.66, color: '#a896dc', ink: true, shadow: false });
      w.ghost.position.set(0, DECK + TILE / 2 + 0.04, -0.28);
      w.add(w.ghost);
    });
    this.engineCar.position.x = length / 2 - 1.55;
    this.train.position.x = -26;
    const star = this.toy(word, 2.6, [-1.2, 2.16, -4]);
    this.appear(star, 0.6);
    this.hot(star, { r: 1.1, poke: true, tap: () => { star.hop(0.2).spin(); this.audio.speak(word, { rate: 0.75 }); } });
    await this.roll(0, 1.7, Ease.outCubic);

    let letters = [...word, ...sample(ALPHABET.filter((c) => !word.includes(c)), SPARE[this.level])];
    do letters = shuffle(letters); while (letters.join('').startsWith(word));
    this.tiles = this.row(letters.map((c) => block(c, { size: TILE, color: this.tint })), { y: 0.1, z: 4.6, gap: letters.length > 5 ? 1.22 : 1.5 });
    for (const t of this.tiles) {
      t.home = t.position.toArray();
      this.hot(t, { r: 0.6, when: () => !t.loaded, tap: () => this.tryLoad(t, this.slots.find((s) => !s.tile)), drop: () => this.dropped(t) });
    }
    if (this.level === 1) this.prompt('Match the letters', [{ text: word, rate: 0.75, gap: 0.3 }, 'Match the letters to load the train!']);
    else this.prompt('Spell the word', [{ text: word, rate: 0.7, gap: 0.35 }, { text: `Can you spell ${word}?`, rate: 0.9 }]);
    await this.ask();

    await this.wait(0.45);
    this.win(this.slots[Math.floor(n / 2)]);
    this.tiles.forEach((t) => { if (!t.loaded) this.vanish(t); });
    await this.settle(this.audio.spellOut(word, {
      onLetter: (i) => { this.slots[i].tile.hop(0.4); this.fx.sparkle(this.at(this.slots[i]), 8); },
    }), { min: 1.4, max: 9 });
    // All aboard: the star of the word rides on the boiler.
    this.engineCar.attach(star);
    this.scaleTo(star, 0.46, 0.55);
    await this.jump(star, [0.2, 1.95, 0.1], { height: 1.6, dur: 0.55 });
    star.dancing = true;
    this.audio.toot();
    await this.wait(0.7);
    await this.roll(26, 2, Ease.inCubic);
    this.remove(star, ...this.slots.map((s) => s.tile));
    this.slots.forEach((s) => s.ghost?.removeFromParent());
  }

  dropped(tile) {
    const near = this.slots.filter((s) => !s.tile).sort((a, b) => this.gap(a, tile) - this.gap(b, tile))[0];
    if (!this.busy && near && this.gap(near, tile) < 1.15) this.tryLoad(tile, near);
    else this.jump(tile, tile.home, { height: 0.4, dur: 0.28 });
  }

  tryLoad(tile, slot) {
    if (slot.letter !== tile.label) {
      this.miss(tile);
      if (tile.position.distanceTo(V(...tile.home)) > 0.1) this.jump(tile, tile.home, { height: 0.5, dur: 0.32 });
      return;
    }
    tile.loaded = true;
    slot.tile = tile;
    slot.attach(tile);
    this.audio.speak(this.voiceOf[tile.label], { rate: 0.8 });
    this.jump(tile, [0, DECK, 0.02], { height: 0.9, dur: 0.36 }).then(() => { this.audio.place(); this.fx.sparkle(this.at(slot), 8); });
    if (this.slots.every((s) => s.tile)) this.resolve();
  }

  /* ------------------------------------------------------------------ hints */

  solution() {
    const slot = this.slots.find((s) => !s.tile);
    const tile = slot && this.tiles.find((t) => !t.loaded && t.label === slot.letter);
    return tile && { drag: [tile, slot] };
  }

  /** The light-bulb: a child who is stuck should not stay stuck. */
  help() {
    const move = !this.busy && this.solution();
    if (!move) return;
    const [tile] = move.drag;
    tile.hop(0.4);
    this.audio.say([{ text: `Find ${LETTER_NAME[tile.label]}`, rate: 0.85, gap: 0.25 }, this.voiceOf === LETTER_SOUND && { text: LETTER_SOUND[tile.label], rate: 0.75 }]);
    this.point(move);
  }

  nudgeChoices() { this.tiles.forEach((t, i) => { if (!t.loaded) this.tweens.after(i * 0.08, () => t.hop(0.2)); }); }
  hint() { if (this.level === 1) this.help(); else this.replayPrompt(); }
}
