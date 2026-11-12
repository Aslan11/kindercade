/**
 * Word Fishing — from letters to real reading.
 *
 *   1  catch the letter on the sign
 *   2  catch the one that rhymes
 *   3  *read* the word on the sign and catch its picture — the voice keeps
 *      quiet, though any letter will say its sound if tapped, and the wrong
 *      answers share letters with the right one so guessing from the first
 *      letter is not enough
 *   4  hear a sight word and catch it in writing
 */

import * as THREE from '../core/three.js';
import { Game, V } from '../core/engine.js';
import { Toy, slab } from '../core/toy.js';
import { build, Shapes } from '../core/kit.js';
import { text3d } from '../core/glyphs.js';
import { sky, clouds, sun } from '../core/scenery.js';
import { Ease } from '../core/anim.js';
import { deck, makeRng, pick, rand, sample, shuffle } from '../core/util.js';
import { ALPHABET, DECODABLE, LETTER_NAME, LETTER_SOUND, RHYMES, SIGHT_WORDS } from '../data/words.js';

const SWIMMERS = ['fish', 'whale', 'octopus', 'crab', 'turtle'];
const SURFACE = 4.2;
const ROD = V(-1.75, 6.15, 0.3);
const BUCKET = [-4.75, SURFACE + 0.55, 0.3];

/** `n` words from `pool` that look most like `word`. */
function lookalikes(word, pool, n) {
  const score = (w) => [...w].filter((c, i) => word[i] === c).length * 2 + (w.length === word.length ? 1 : 0) + Math.random();
  return pool.filter((w) => w !== word).map((w) => [score(w), w]).sort((a, b) => b[0] - a[0]).slice(0, n).map((x) => x[1]);
}

export default class WordFishing extends Game {
  static meta = { id: 'word-fishing', tint: '#2a8fe0', music: 'sea' };

  init() {
    this.roundsTotal = this.level === 1 ? 6 : 7;
    this.view = { pos: V(0, 3.4, 18), look: V(0, 3, 0), fov: 30 };
    this.light({ span: 10, centre: [0, 3, 0] });
    sky(this);
    sun(this, [12.5, 7.4, -22], 3);
    clouds(this, { n: 4, y: [8, 11] });
    this.buildSea();
    this.buildBoat();
  }

  buildSea() {
    const rng = makeRng(5);
    this.scene.add(build((b) => {
      [['#56cdf5', SURFACE - 1], ['#3fb8ee', SURFACE - 3.4], ['#2fa0e2', SURFACE - 6.4]].forEach(([c, y], i) =>
        b.box(c, [0, y - i * 4, -2.2 + i * 0.02], [70, 2 + i * 9, 0.2], { ink: false, surf: 'bright', r: 0.01, seg: 1 }));
      b.ball('#ffe3a8', [-4, -2.4, -0.5], [14, 1.5, 3], { seg: 28 });
      b.box('#ffe3a8', [0, -8.2, 1], [70, 12, 1], { ink: false, seg: 1 });
      b.ball('#f7d48c', [8, -2.4, -1.2], [10, 1.9, 2], { seg: 28 });
      for (let i = 0; i < 14; i++) {
        const x = (i < 7 ? -1 : 1) * (5.4 + rng() * 5), h = 1.2 + rng() * 1.6;
        b.tube(i % 3 ? '#2fb86a' : '#ff7ac8', [[x, -1.3, -1], [x + 0.18, -1.3 + h * 0.35, -1], [x - 0.15, -1.3 + h * 0.7, -1], [x + 0.08, -1.3 + h, -1]], (t) => 0.13 - t * 0.08);
      }
    }, { receive: false }));
    const waves = build((b) => { for (let x = -24; x <= 24; x += 1.2) b.ball('#56cdf5', [x, SURFACE - 0.12, 0.9], [0.72, 0.26, 0.2], { surf: 'bright', seg: 12 }); }, { shadow: false });
    this.scene.add(waves);
    this.every((dt, t) => {
      waves.position.x = Math.sin(t * 0.8) * 0.35;
      if (t % 0.8 < dt) this.fx.puff({ x: rand(-6, 6), y: -4 }, 1, { color: '#c9f2ff', size: 0.16, rise: 6, spread: 0.5 });
    });
  }

  buildBoat() {
    const g = new THREE.Group();
    g.add(build((b) => {
      b.puff('#ff5a6e', [0, -0.25, 0], Shapes.soft([[-1.3, 0], [1.2, 0], [1.75, 0.85], [-1.65, 0.85]], 0.25), 1.2, { bevel: 0.15, surf: 'shiny' });
      b.box('#ffffff', [0.05, 0.6, 0], [3.4, 0.12, 1.15]);
      b.cyl('#4c8cf0', [-1.05, 0.9, 0.2], [0.42, 0.32], 0.6);
      b.tube('#9a6238', [[0.55, 0.9, 0.3], [1.3, 1.7, 0.3], [1.95, 1.95, 0.3]], (t) => 0.06 - t * 0.03);
    }, { ao: true }));
    this.boat = new Toy(g, 2, { idle: 0 });
    this.boat.float = 0.05;
    this.boat.position.set(-3.7, SURFACE, 0);
    this.scene.add(this.boat);
    this.addPal([0.05, 0.5, 0.05], { size: 1.55, hat: 'sun-hat', parent: g });
    this.line = build((b) => b.cyl('#ffffff', [0, -0.5, 0], 0.022, 1, { bevel: 0.001, surf: 'bright' }), { shadow: false });
    this.line.position.copy(ROD);
    this.scene.add(this.line);
    this.hook = this.toy('star', 0.36);
    this.reel = ROD.clone().setY(SURFACE + 0.5);
    this.every(() => {
      const d = this.reel.clone().sub(ROD);
      this.line.scale.y = d.length();
      this.line.rotation.z = Math.atan2(d.x, -d.y);
      this.hook.position.copy(this.reel).y -= 0.2;
    });
  }

  /** A sea creature carrying a word, a letter or a picture. */
  swimmers(items, pictures) {
    // A picture is always carried by a plain fish, so it is clear which animal is the answer.
    const who = pictures ? items.map(() => 'fish') : shuffle(SWIMMERS);
    const [gap, zoom] = items.length > 3 ? [2.8, 1.05] : [3.6, pictures ? 1.18 : 1.35];
    return items.map((item, i) => {
      const g = new THREE.Group();
      if (pictures) {
        g.add(build((b) => b.cyl('#e6faff', [0, 0, -0.5], 1.12, 0.1, { rot: [Math.PI / 2, 0, 0], surf: 'bright', seg: 36 }), { shadow: false }));
        const pic = new Toy(item, 1.5);
        pic.position.y = -pic.height / 2;
        g.add(pic);
      } else {
        const text = text3d(item, { height: item.length > 1 ? 0.78 : 0.86, color: '#ff4d78', maxWidth: 1.9, ink: item.length === 1, shadow: false });
        const card = slab(Math.max(1.3, text.width + 0.5), 1.25, 0.16, '#ffffff', 0.08);
        card.position.y = -0.62;
        text.position.set(0, item.length > 1 ? 0.1 : 0, 0.16);
        g.add(card, text);
      }
      const pal = new Toy(who[i], 1.05);
      pal.position.set(0, pictures ? 0.98 : 0.56, -0.2);
      g.add(pal);
      g.scale.setScalar(zoom);
      const t = new Toy(g, 2, { idle: 0.5 });
      Object.assign(t, { item, float: 0.14, hotAt: V(0, 0.2, 0) });
      const x = (i - (items.length - 1) / 2) * gap, y = 0.75 + (i % 2) * 0.5;
      t.position.set(x + 14, y, 0);
      this.scene.add(t);
      this.moveTo(t, [x, y, 0], 1.1, { delay: i * 0.1, ease: Ease.outCubic });
      return t;
    });
  }

  /** The signboard in the sky, holding whatever the child needs to look at. */
  board(width, ...things) {
    const g = new THREE.Group();
    const back = slab(width, 1.45, 0.2, '#fff3d6', 0.1);
    back.position.y = -0.72;
    g.add(back, ...things);
    g.position.set(2.2, 5.35, 0);
    this.scene.add(g);
    this.appear(g);
    return g;
  }

  async land(catchIt, rest) {
    rest.forEach((t) => { if (t !== catchIt) this.moveTo(t, [t.position.x + Math.sign(t.position.x - catchIt.position.x) * 14, t.position.y, 0], 1.3, { ease: Ease.inCubic }).then(() => this.remove(t)); });
    this.audio.swoop();
    const { x, y } = catchIt.position;
    await this.to(this.reel, { x, y: y + 1.7 }, 0.36, { ease: Ease.outQuad });
    this.win(catchIt, { quiet: this.level === 3 });    // keep the word in view while it is sounded out
    catchIt.wiggle(1.5);
    await this.wait(0.75);
    this.audio.whoosh();
    this.to(this.reel, { x: ROD.x, y: SURFACE + 0.5 }, 0.55);
    this.scaleTo(catchIt, 0.3, 0.75);
    await this.jump(catchIt, BUCKET, { height: 2.4, dur: 0.75 });
    this.remove(catchIt);
    this.audio.plop();
    this.boat.boing().wiggle(0.4);
    this.fx.puff(this.at(V(...BUCKET)), 8, { color: '#9fe4ff', size: 0.2, spread: 3 });
  }

  /* ----------------------------------------------------------------- rounds */

  async play() {
    const [pool, round] = {
      1: [ALPHABET, this.letter], 2: [RHYMES, this.rhyme], 3: [DECODABLE, this.read], 4: [SIGHT_WORDS, this.sight],
    }[this.level];
    const next = deck(pool);
    for (let i = 0; i < this.roundsTotal; i++) await round.call(this, next());
    this.finish();
  }

  async letter(c) {
    const big = text3d(c.toUpperCase(), { height: 0.92, color: '#ff4d78' });
    big.position.z = 0.2;
    const board = this.board(1.6, big);
    const fish = this.swimmers(shuffle([c, ...sample(ALPHABET.filter((k) => k !== c), 2)]).map((k) => k.toUpperCase()));
    await this.wait(1);
    this.prompt('Catch the matching letter', `Catch the letter ${LETTER_NAME[c]}!`);
    const right = await this.choose(fish, fish.find((f) => f.item === c.toUpperCase()), {
      r: 1.25, wrong: (f) => [`That is ${LETTER_NAME[f.item.toLowerCase()]}.`, `Find ${LETTER_NAME[c]}!`],
    });
    this.audio.speak(`${LETTER_NAME[c]}!`);
    await this.land(right, fish);
    this.vanish(board);
  }

  async rhyme(family) {
    const [word, match] = sample(family, 2);
    const pic = new Toy(word, 1.2);
    pic.position.set(0, -pic.height / 2, 0.4);
    const board = this.board(1.8, pic);
    const others = sample(RHYMES.filter((f) => f !== family), 2).map(pick);
    const fish = this.swimmers(shuffle([match, ...others]), true);
    await this.wait(1);
    this.prompt('Which one rhymes?', [
      { text: `What rhymes with ${word}?`, rate: 0.85, gap: 0.35, onStart: () => pic.hop(0.2) },
      ...fish.map((f) => ({ text: f.item, rate: 0.8, gap: 0.35, onStart: () => f.hop(0.15) })),
    ]);
    const right = await this.choose(fish, fish.find((f) => f.item === match), {
      r: 1.4, wrong: (f) => [{ text: `${word}, ${f.item}.`, rate: 0.8, gap: 0.3 }, 'They do not rhyme.'],
    });
    const said = this.talk([{ text: `${word}, ${match}.`, rate: 0.8, gap: 0.25 }, 'They rhyme!']);
    await this.land(right, fish);
    await said;
    this.vanish(board);
  }

  async read(word) {
    const letters = [...word].map((c, i) => {
      const t = new Toy(text3d(c, { height: 0.88, color: '#ff4d78' }), 0.8, { idle: 0 });
      t.position.set((i - (word.length - 1) / 2) * 0.98, 0.14, 0.2);
      t.hotAt = V(0, -0.15, 0);
      return this.hot(t, { r: 0.45, tap: () => { t.hop(0.3); this.audio.speak(LETTER_SOUND[c], { rate: 0.8 }); } });
    });
    const board = this.board(word.length * 0.98 + 0.5, ...letters);
    const fish = this.swimmers(shuffle([word, ...lookalikes(word, DECODABLE, 2)]), true);
    const soundOut = [...word].map((c, i) => ({ text: LETTER_SOUND[c], rate: 0.75, gap: 0.2, onStart: () => letters[i].hop(0.3) }));
    await this.wait(1);
    this.prompt('Read it, then catch it', this.roundsDone ? 'Read the word!' : ['Read the word. Then catch its picture!', 'Tap a letter to hear its sound.']);
    const right = await this.choose(fish, fish.find((f) => f.item === word), {
      r: 1.4, wrong: (f) => [`That is the ${f.item}.`, "Let's sound it out.", ...soundOut],
    });
    const said = this.talk([...soundOut, { text: `${word}!`, rate: 0.8 }]);
    await this.land(right, fish);
    await said;
    this.vanish(board);
  }

  async sight(word) {
    const fish = this.swimmers(shuffle([word, ...lookalikes(word, SIGHT_WORDS, 3)]));
    await this.wait(1);
    this.prompt('Catch the word you hear', ['Catch the word', { text: word, rate: 0.7 }]);
    const right = await this.choose(fish, fish.find((f) => f.item === word), {
      r: 1.25, wrong: (f) => [`That says ${f.item}.`, 'Find', { text: word, rate: 0.7 }],
    });
    const said = this.settle(this.audio.spellOut(word));
    await this.land(right, fish);
    await said;
  }
}
