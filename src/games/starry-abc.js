/**
 * Starry ABC — alphabet order, as a dot-to-dot across the night sky.
 *
 * Each star plays its note of the alphabet song, so the tune the child already
 * knows pulls them along to the next letter. Close the loop and the
 * constellation turns into the thing it was drawing.
 */

import * as THREE from '../core/three.js';
import { Game, V } from '../core/engine.js';
import { Toy } from '../core/toy.js';
import { build, Shapes } from '../core/kit.js';
import { text3d } from '../core/glyphs.js';
import { sky, starfield } from '../core/scenery.js';
import { Ease } from '../core/anim.js';
import { randInt, range, sample, shuffle } from '../core/util.js';
import { ALPHABET, LETTER_NAME } from '../data/words.js';

/** Outlines in a -1…1 box, keyed by how many stars they take. */
const FIGURES = {
  4: [['kite', [[0, 1], [0.7, 0.3], [0, -1], [-0.7, 0.3]]], ['book', [[-0.95, 0.7], [0.95, 0.7], [0.95, -0.7], [-0.95, -0.7]]]],
  5: [['house', [[0, 1], [0.9, 0.2], [0.7, -0.9], [-0.7, -0.9], [-0.9, 0.2]]], ['gem', [[-0.55, 0.8], [0.55, 0.8], [1, 0.2], [0, -1], [-1, 0.2]]]],
  6: [['heart', [[0, 0.4], [0.55, 0.95], [1, 0.3], [0, -1], [-1, 0.3], [-0.55, 0.95]]], ['bell', [[0, 1], [0.55, 0.45], [0.95, -0.7], [0, -1], [-0.95, -0.7], [-0.55, 0.45]]]],
  7: [
    ['crown', [[-1, 0.75], [-0.5, 0], [0, 0.95], [0.5, 0], [1, 0.75], [0.8, -0.85], [-0.8, -0.85]]],
    ['rocket', [[0, 1], [0.5, 0.35], [0.95, -0.85], [0.33, -0.45], [-0.33, -0.45], [-0.95, -0.85], [-0.5, 0.35]]],
    ['fish', [[-1.1, 0], [-0.55, 0.75], [0.15, 0.55], [1.1, 0.8], [1.1, -0.8], [0.15, -0.55], [-0.55, -0.75]]],
  ],
};
/** The alphabet song, one note per letter. */
const SONG = [...'CCGGAAGFFEEDDDDCGGFEEDGFED'].map((n) => ({ C: 523.25, D: 587.33, E: 659.25, F: 698.46, G: 783.99, A: 880 }[n]));
const MID = V(0.55, 2.55, 0), SPAN = [3.35, 2.45];
const DECOY_SPOTS = [[-4.6, 4.5], [5.15, 4.6], [5.15, 0.2], [MID.x, MID.y], [-4.7, 2.8], [5.3, 2.4]];

export default class StarryAbc extends Game {
  static meta = { id: 'starry-abc', tint: '#7a5cf0', music: 'space' };

  init() {
    // [first letter, how many]
    this.runs = this.level === 1 ? [[0, 4], [0, 4], [0, 5], [0, 5]]
      : this.level < 4 ? [[0, 7], [7, 7], [14, 7], [21, 5]]
        : [5, 6, 6, 7, 7].map((n) => [randInt(1, 26 - n), n]);
    this.roundsTotal = this.runs.length;
    this.view = { pos: V(0, 3.2, 17.5), look: V(0, 3, 0), fov: 30 };
    this.light({ span: 9, centre: [0, 3, 0], shade: '#b0a4e8' });
    sky(this, '#5a3fb0', '#35248a', '#1c1250');
    starfield(this, { n: 110 });
    this.scene.add(build((b) => {
      b.ball('#cfc4f5', [-6.5, -4.2, 0], [5.4, 4.2, 4], { seg: 32 });
      [[-4.2, -0.75, 2.2, 0.36], [-5.9, -0.42, 1.9, 0.26], [-3.1, -1.45, 2.1, 0.22]].forEach(([x, y, z, r]) => b.ball('#a89ae0', [x, y, z], [r, r * 0.4, r * 0.5], { ao: false }));
    }));
    this.addPal([-4.85, -0.25, 1], { size: 1.75, hat: 'wizard-hat' });
    this.poke(this.toy('planet', 3.2, [3.6, -4.9, -9]), { r: 1.1, sound: 'magic' });
    this.poke(this.toy('moon', 2, [-8.2, 5.6, -9]), { r: 0.9, sound: 'magic' });
    this.ship = this.toy('rocket', 1.05, [-3.4, 0.6, 1]);
    this.ship.act.children[0].position.y = -0.5;      // spin about the middle
  }

  star(index, x, y) {
    const letter = this.level > 2 ? ALPHABET[index] : ALPHABET[index].toUpperCase();
    const g = new THREE.Group();
    g.add(build((b) => b.pillow('#ffffff', [0, 0, 0], Shapes.star(0.82, 0.52, 5, 0.18), 0.26, { surf: 'glow' }), { shadow: false }));
    const text = text3d(letter, { height: this.level > 2 ? 0.62 : 0.52, color: '#7a5cf0', ink: true, shadow: false });
    text.position.z = 0.2;
    g.add(text);
    const s = new Toy(g, 1.3, { idle: 2 });
    Object.assign(s, { index, text, hotAt: V(), float: 0.04 });
    s.position.set(x, y, 0);
    this.scene.add(s);
    return s;
  }

  /** Fly to a star, trailing a beam of light from the last one. */
  async fly(from, to, beams) {
    const a = this.ship.position.clone(), b = to.position.clone().setZ(0.7);
    this.to(this.ship.rotation, { z: Math.atan2(a.x - b.x, b.y - a.y) }, 0.12);
    this.audio.whoosh();
    if (from) {
      const len = from.position.distanceTo(to.position);
      const beam = build((k) => k.cyl('#ffe27a', [0, len / 2, 0], 0.075, len, { surf: 'bright', bevel: 0.01 }), { shadow: false });
      beam.position.copy(from.position).setZ(-0.2);
      beam.rotation.z = Math.atan2(from.position.x - to.position.x, to.position.y - from.position.y);
      beam.scale.y = 0.001;
      this.scene.add(beam);
      beams.push(beam);
      this.to(beam.scale, { y: 1 }, 0.42, { ease: Ease.inOutQuad });
    }
    await this.moveTo(this.ship, [b.x + 0.42, b.y + 0.52, b.z], 0.42, { ease: Ease.inOutQuad, onUpdate: () => this.fx.sparkle(this.at(this.ship.position), 1, { spread: 0.6 }) });
  }

  async play() {
    const figures = Object.fromEntries(Object.entries(FIGURES).map(([n, list]) => [n, shuffle(list)]));
    const used = {};
    for (const [first, n] of this.runs) {
      used[n] = (used[n] ?? -1) + 1;
      const [name, outline] = figures[n][used[n] % figures[n].length];
      const stars = outline.map(([x, y], i) => this.star(first + i, MID.x + x * SPAN[0], MID.y + y * SPAN[1]));
      const room = DECOY_SPOTS.filter(([x, y]) => stars.every((s) => Math.hypot(s.position.x - x, s.position.y - y) > 1.7));
      const decoys = this.level < 4 ? [] : sample(range(26).filter((i) => i < first - 1 || i > first + n), 2).map((i, k) => this.star(i, ...room[k]));
      [...stars, ...decoys].forEach((s, i) => this.appear(s, i * 0.08));
      this.audio.magic();
      await this.wait(0.9);

      const say = (s) => LETTER_NAME[ALPHABET[s.index]];
      this.prompt('Join the stars in ABC order', [this.roundsDone ? 'Another one!' : 'Join the stars in A B C order.', `Find ${say(stars[0])}.`]);
      const beams = [];
      let slips = 0;
      for (const [i, s] of stars.entries()) {
        if (i) this.speech = this.level === 1 ? `Find ${say(s)}.` : `What comes after ${say(stars[i - 1])}?`;
        s.dancing = this.level === 1;
        await this.choose([...stars.slice(i), ...decoys], s, { r: 0.68, wrong: (w) => [`That is ${say(w)}.`, i ? this.speech : `Find ${say(s)}.`] });
        slips += this.tries;
        this.tries = 0;
        s.dancing = false;
        this.audio.chime(SONG[s.index], { vol: 0.24 });
        this.audio.say(this.level === 1 && stars[i + 1] ? [say(s), `Now find ${say(stars[i + 1])}.`] : say(s));
        await this.fly(stars[i - 1], s, beams);
        s.spin();
        s.text.setColor('#ff9f1c');
      }
      this.tries = slips;
      await this.fly(stars[n - 1], stars[0], beams);

      // Sing it back, then let the picture out.
      decoys.forEach((d) => this.vanish(d));
      for (const s of stars) { s.hop(0.3); this.audio.chime(SONG[s.index], { vol: 0.2 }); await this.wait(0.2); }
      const toy = this.toy(name, 2.7);
      toy.position.set(MID.x, MID.y - toy.height / 2, 1);
      toy.dancing = true;
      this.appear(toy.spin());
      this.audio.magic();
      this.win(MID);
      await this.talk(`It's a ${name}!`, { min: 2.2 });
      [toy, ...stars, ...beams].forEach((o) => this.vanish(o));
      await this.wait(0.4);
    }
    this.finish();
  }

  hint() { this.replayPrompt(); if (this.level === 1) this.point(this.solution()); }
}
