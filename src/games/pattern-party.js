/**
 * Pattern Party — spotting a rule and predicting what comes next.
 *
 * Every dancer has its own note, so a pattern is a tune as well as a picture:
 * the line plays itself, stops at the gap, and the ear wants the next note as
 * much as the eye wants the next shape. Wrong choices are mostly dancers
 * already in the line, which makes it reasoning rather than odd-one-out.
 */

import * as THREE from '../core/three.js';
import { Game, V } from '../core/engine.js';
import { Toy, slab, shapeToy } from '../core/toy.js';
import { build } from '../core/kit.js';
import { text3d } from '../core/glyphs.js';
import { bunting } from '../core/scenery.js';
import { CANDY } from '../core/props.js';
import { SHAPES, COLORS } from '../models/shapes.js';
import { music } from '../core/music.js';
import { deck, nearbyChoices, pick, randInt, range, sample, shuffle } from '../core/util.js';
import { numberWord } from '../data/words.js';

const RULES = { 1: ['AB'], 2: ['AB', 'AAB', 'ABB'], 3: ['ABC', 'AABB', 'ABB', 'AAB'], 4: ['ABAC', 'ABCC', 'grow', 'ABCD', 'AABC', 'shrink'] };
const LENGTH = { 1: 5, 2: 7, 3: 8, 4: 8 };
const ANIMALS = ['cat', 'frog', 'duck', 'pig', 'panda', 'lion', 'penguin', 'octopus'];
const NOTES = [5, 7, 8, 10];
const STAGE = 1.25, BRICK = 0.44;

export default class PatternParty extends Game {
  static meta = { id: 'pattern-party', tint: '#f56fc0', music: 'party' };

  init() {
    this.roundsTotal = this.level === 1 ? 6 : 7;
    this.view = { pos: V(0, 5.4, 17.5), look: V(0, 2.1, 0), fov: 30 };
    this.light({ span: 10, shade: '#b8a4e8' });
    this.scene.background = new THREE.Color('#4a2a9a');
    this.scene.add(build((b) => {
      b.box('#5a35b0', [0, 5, -5], [60, 24, 0.4], { ink: false });
      b.box('#7a4fe0', [0, STAGE / 2 - 0.1, -1.6], [13.4, STAGE, 4], { r: 0.2 });
      b.box('#ffd23c', [0, STAGE - 0.16, 0.42], [13.4, 0.14, 0.1]);
      bunting(b, [-12, 6.6, -4.6], [0, 6.6, -4.6], { n: 9, sag: 1.2, size: 0.55 });
      bunting(b, [0, 6.6, -4.6], [12, 6.6, -4.6], { n: 9, sag: 1.2, size: 0.55 });
      b.both((s) => {
        b.box('#2a1a4a', [s * 7.6, 2.4, -2.6], [1.9, 3.4, 1.4], { r: 0.16 });
        for (const [y, r] of [[1.75, 0.62], [3.2, 0.42]]) b.cyl('#ff6bb0', [s * 7.6, y, -1.88], r, 0.1, { rot: [Math.PI / 2, 0, 0] });
      });
    }));
    this.danceFloor();
    this.addPal([-4.05, 0, 3.7], { size: 1.65, hat: 'party-hat' });
  }

  /** A chequered floor that changes colour on the beat. */
  danceFloor() {
    const cols = 15, rows = 8, size = 1.5;
    const floor = new THREE.InstancedMesh(new THREE.BoxGeometry(size - 0.07, 0.1, size - 0.07), new THREE.MeshToonMaterial(), cols * rows);
    Object.assign(floor.userData, { owned: true, ownsMaterial: true });
    floor.receiveShadow = true;
    const m = new THREE.Matrix4(), c = new THREE.Color();
    const dim = ['#6a45c8', '#5a38b8'];
    let shown = -1;
    range(cols * rows).forEach((i) => floor.setMatrixAt(i, m.makeTranslation(((i % cols) - 7) * size, -0.05, 1.2 + Math.floor(i / cols) * size)));
    this.every((dt, t) => {
      const beat = Math.floor(t / music.beat) * 2 + (this.rave ? 1 : 0);
      if (beat === shown) return;
      shown = beat;
      range(cols * rows).forEach((i) => floor.setColorAt(i, c.set(this.rave || (i * 7 + beat) % 11 === 0 ? CANDY[(i + beat) % 6] : dim[i % 2])));
      floor.instanceColor.needsUpdate = true;
    });
    floor.setColorAt(0, c);
    this.scene.add(floor);
  }

  /* ---------------------------------------------------------------- dancers */

  /** `n` distinct kinds of dancer: { name, note, make(size) }. */
  troupe(n, animals) {
    if (animals) return sample(ANIMALS, n).map((a, i) => ({ name: a, note: NOTES[i], make: (k) => new Toy(a, k) }));
    const colors = sample(Object.keys(COLORS).filter((c) => c !== 'purple'), n);
    return sample(SHAPES, n).map((s, i) => ({
      name: `${colors[i]} ${s}`, note: NOTES[i],
      make: (k) => shapeToy(s, colors[i], k),
    }));
  }

  tower(n) {
    return {
      name: numberWord(n), note: 3 + n,
      make: (k) => {
        const g = new THREE.Group();
        g.scale.setScalar(k / 1.7);
        range(n).forEach((i) => { const b = slab(0.86, BRICK, 0.6, CANDY[i], 0.1); b.position.y = i * BRICK; g.add(b); });
        const t = new Toy(g, k);
        t.height = (n * BRICK * k) / 1.7;
        return t;
      },
    };
  }

  /** The line-up, where the gap is, and what to offer. */
  compose(rule, round) {
    if (rule === 'grow' || rule === 'shrink') {
      const counts = rule === 'grow' ? [1, 2, 3, 4, 5] : [6, 5, 4, 3, 2];
      const kinds = Object.fromEntries(range(6).map((i) => [i + 1, this.tower(i + 1)]));
      return { line: counts.map((c) => kinds[c]), gap: 4, offer: nearbyChoices(counts[4], 3, 1, 6).map((c) => kinds[c]) };
    }
    const kinds = new Set(rule).size;
    const troupe = this.troupe(this.level === 1 ? 2 : Math.max(3, kinds), round % 2 === 1);
    const n = LENGTH[this.level];
    const line = range(n).map((i) => troupe[rule.charCodeAt(i % rule.length) - 65]);
    // From level 3 the gap is sometimes in the middle, once the rule has shown itself.
    const gap = this.level >= 3 && round % 2 ? randInt(rule.length, n - 2) : n - 1;
    return { line, gap, offer: shuffle(troupe) };
  }

  async playLine(toys, upTo = toys.length) {
    for (const t of toys.slice(0, upTo)) {
      t.hop(0.35, 0.3);
      if (t.kindOf) this.audio.step(t.kindOf.note, { vol: 0.3 }); else this.audio.boing(0.6);
      await this.wait(0.36);
    }
  }

  async play() {
    const nextRule = deck(RULES[this.level]);
    for (let round = 0; round < this.roundsTotal; round++) {
      const { line, gap, offer } = this.compose(nextRule(), round);
      const step = Math.min(1.85, 10.6 / line.length), size = step * 0.86;
      const spot = (i) => [(i - (line.length - 1) / 2) * step, STAGE - 0.1, -0.5];
      const toys = this.toys = line.map((kind, i) => {
        let t;
        if (i === gap) {
          const q = text3d('?', { height: size * 0.62, color: '#ffd23c', weight: 0.13 });
          q.position.y = size * 0.52;
          t = new Toy(q, size);
          t.float = 0.06;
        } else {
          t = Object.assign(kind.make(size), { kindOf: kind });
          this.hot(t, { r: size / 2, poke: true, tap: () => { t.hop(0.35, 0.3); this.audio.step(kind.note, { vol: 0.3 }); } });
        }
        t.position.set(...spot(i));
        this.scene.add(t);
        this.appear(t, i * 0.07);
        return t;
      });
      this.hud.prompt(gap === line.length - 1 ? 'What comes next?' : 'What is missing?');
      await this.wait(0.9);
      await this.playLine(toys);

      const picks = this.row(offer.map((kind) => Object.assign(kind.make(1.3), { kindOf: kind })), { x: 0.9, z: 4.3, gap: offer.length > 3 ? 1.75 : 2.1 });
      const ask = gap === line.length - 1 ? 'What comes next?' : 'What is missing?';
      const lead = line.slice(Math.max(0, gap - 4), gap).map((k) => k.name).join(', ');
      this.prompt(ask, ask);
      this.speech = [{ text: lead, rate: 0.85, gap: 0.3 }, ask];
      const right = await this.choose(picks, picks.find((p) => p.kindOf === line[gap]), { r: 0.85, wrong: () => this.speech });

      picks.forEach((p) => { if (p !== right) this.vanish(p); });
      this.remove(toys[gap]);
      toys[gap] = right;
      this.scaleTo(right, size / 1.3, 0.45);
      await this.jump(right, spot(gap), { height: 1.6, dur: 0.48 });
      this.win(right);
      this.rave = true;
      await this.wait(0.7);
      await this.playLine(toys);
      toys.forEach((t) => { t.dancing = true; });
      this.pal.dancing = true;
      this.fx.confetti({ x: pick([-3, 3]), y: -1 }, 30, { up: 0.7 });
      await this.talk([], { min: 1.2 });
      this.rave = this.pal.dancing = false;
      toys.forEach((t, i) => this.vanish(t, i * 0.04));
      await this.wait(0.55);
    }
    this.finish();
  }

  nudgeChoices() { this.playLine(this.toys); }
}
