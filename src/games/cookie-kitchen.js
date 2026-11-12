/**
 * Cookie Shop — ten frames, number bonds and teen numbers.
 *
 * A hungry customer orders; the child fills the tray and rings the bell when
 * *they* think it is right. The tray always fills in ten-frame order, so six
 * looks like "five and one more". Level 3 asks which plate makes ten — and a
 * wrong plate still hops on, so the gap or the overflow can be seen. Level 4
 * adds a box of ten, which makes "fourteen is ten and four" something you do.
 */

import * as THREE from '../core/three.js';
import { Game, V } from '../core/engine.js';
import { Toy } from '../core/toy.js';
import { Builder, build, instantiate } from '../core/kit.js';
import { text3d } from '../core/glyphs.js';
import { bubble } from '../core/props.js';
import { bunting } from '../core/scenery.js';
import { cookie } from '../models/food.js';
import { deck, range, nearbyChoices } from '../core/util.js';
import { numberWord } from '../data/words.js';

const CUSTOMERS = ['bear', 'panda', 'lion', 'monkey', 'koala', 'tiger', 'dog', 'elephant', 'bunny', 'wolf'];
const ORDERS = { 1: [1, 2, 3, 4], 2: [3, 4, 5, 6, 7, 8, 9, 10], 3: [2, 3, 4, 5, 6, 7, 8], 4: [11, 12, 13, 14, 15, 16, 17, 18, 19] };
const TRAY = [0, 0.02, 0.75];
const OVEN = [-4.35, 0.5, -3.4];
const FRONT = 3.75;

const looks = {};
function cookieMesh(kind) {
  if (!looks[kind]) {
    const b = new Builder();
    if (kind === 'raw') cookie(b, '#fbe3b4', '#8a5a38');
    else if (kind === 'dark') cookie(b, '#8a5a38', '#fff3e2');
    else {
      cookie(b, '#e8a455');
      ['#ff6b8b', '#4cc9f0', '#ffffff', '#3ddc97', '#ffd23c'].forEach((c, i) =>
        b.ball(c, [Math.cos(i * 1.26 + 0.5) * 0.34, 0.15, Math.sin(i * 1.26 + 0.5) * 0.34], [0.06, 0.03, 0.035], { ao: false }));
    }
    looks[kind] = b.bake();
  }
  return instantiate(looks[kind]).root;
}

export default class CookieKitchen extends Game {
  static meta = { id: 'cookie-kitchen', tint: '#e8913c', music: 'bakery' };

  init() {
    this.roundsTotal = this.level === 1 ? 5 : 6;
    this.view = { pos: V(0, 8.6, 14), look: V(0, 1.05, -0.6), fov: 30 };
    this.light({ span: 10, sun: '#fff6e8' });
    this.scene.background = new THREE.Color('#ffd9b8');
    this.buildShop();
    this.buildTray();
    this.addPal([-1.75, -0.55, -2.9], { size: 2.5, hat: 'chef-hat' });
    this.cookies = [];
    if (this.level !== 3) this.buildControls();
  }

  buildShop() {
    this.scene.add(build((b) => {
      b.box('#ffe6cc', [0, 3, -5.6], [60, 16, 0.4], { ink: false });
      b.box('#ff9fb4', [0, 0.3, -5.3], [60, 2.6, 0.3], { r: 0.05 });
      for (let x = -14; x <= 14; x += 1.4) b.box('#ffc2d0', [x, 0.3, -5.14], [0.6, 2.5, 0.04], { ao: false, seg: 1 });
      b.box('#f3c48a', [0, -0.3, 6.2], [60, 0.6, 16], { r: 0.2 });
      b.box('#c9823c', [5.6, 3, -5.1], [4.4, 0.16, 0.8]);
      bunting(b, [-9, 5.1, -5.2], [9, 5.1, -5.2], { n: 14, sag: 0.9 });
      // The oven.
      const [x, y, z] = OVEN;
      b.box('#5aa2ff', [x, y + 0.2, z - 0.3], [3.2, 3.6, 1.8], { r: 0.25, surf: 'shiny' });
      b.box('#2a1a4a', [x, y + 0.15, z + 0.55], [2.5, 1.5, 0.2], { r: 0.1 });
      for (const k of [-0.8, 0, 0.8]) b.cyl('#ffd23c', [x + k, y + 1.45, z + 0.62], 0.17, 0.14, { rot: [Math.PI / 2, 0, 0] });
    }, { ao: true }));
    this.glow = build((b) => b.box('#ff9f1c', [0, 0, 0], [2.3, 1.3, 0.1], { r: 0.05, surf: 'bright', ink: false }));
    this.glow.position.set(OVEN[0], OVEN[1] + 0.15, OVEN[2] + 0.64);
    this.glow.visible = false;
    this.scene.add(this.glow);
    [['cake', 4.2], ['jar', 5.6], ['cupcake', 6.9]].forEach(([n, x]) => this.poke(this.toy(n, 1, [x, 3.08, -5]), { r: 0.5 }));
  }

  buildTray() {
    const frames = this.level === 4 ? 2 : 1, rows = this.level === 1 ? 1 : 2;
    const cell = this.cell = frames === 2 ? 0.9 : 1.2;
    const w = cell * 5 + 0.3;
    this.slots = [];
    this.tray = new THREE.Group();
    this.tray.add(build((b) => {
      for (let f = 0; f < frames; f++) {
        const cx = (f - (frames - 1) / 2) * (w + 0.25);
        b.box('#93a4bd', [cx, 0.06, 0], [w, 0.16, cell * rows + 0.3], { r: 0.08 });
        for (let i = 0; i < rows * 5; i++) {
          const p = [cx + ((i % 5) - 2) * cell, 0.15, (Math.floor(i / 5) - (rows - 1) / 2) * cell];
          b.box('#ffffff', p, [cell * 0.9, 0.04, cell * 0.9], { r: 0.02, seg: 1 });
          this.slots.push([p[0], 0.17, p[2]]);
        }
      }
    }));
    this.tray.position.set(...TRAY);
    this.scene.add(this.tray);
    // Tapping the tray takes the last cookie back off.
    this.hot(this.tray, {
      box: [(w * frames) / 2, (cell * rows) / 2 + 0.2], flat: true, at: [0, 0.2, 0],
      when: () => this.level !== 3, tap: () => this.takeBack(),
    });
  }

  buildControls() {
    const jar = build((b) => {
      b.lathe('#d6f2ff', [0, 0, 0], [[0, 0], [0.5, 0], [0.62, 0.15], [0.62, 0.8], [0.5, 0.95], [0.54, 1.02], [0.44, 1.02], [0, 0.9]], { sharp: true, surf: 'shiny' });
      [[-0.22, 0.98, 0.5], [0.24, 1.0, -0.5], [0, 1.12, 0.1]].forEach(([x, y, a]) => b.group([x, y, 0], [1, 0, a], 0.62, () => cookie(b, '#fbe3b4', '#8a5a38')));
      b.group([0, 0.45, 0.6], [Math.PI / 2, 0, 0], 0.62, () => cookie(b, '#fbe3b4', '#8a5a38'));
    }, { ao: true });
    jar.scale.setScalar(1.15);
    this.jar = new Toy(jar, 1.4);
    this.jar.position.set(this.level === 4 ? -0.9 : -2.4, 0, FRONT);
    this.scene.add(this.jar);
    this.hot(this.jar, { r: 0.85, tap: () => { this.jar.boing(); this.add(1, this.jar); } });

    this.bell = this.toy('bell', 1.3, [this.level === 4 ? 3.2 : 2.4, 0, FRONT]);
    this.hot(this.bell, { r: 0.8, tap: () => this.ring() });

    if (this.level < 4) return;
    const box = build((b) => {
      b.box('#ff6b8b', [0, 0.55, 0], [1.7, 1.1, 0.9], { r: 0.1, surf: 'shiny' });
      b.box('#ffffff', [0, 1.12, 0], [1.8, 0.16, 1], { r: 0.06 });
    });
    const ten = text3d('10', { height: 0.62 });
    ten.position.set(0, 0.55, 0.5);
    box.add(ten);
    this.tenBox = new Toy(box, 1.2);
    this.tenBox.position.set(-3.3, 0, FRONT);
    this.scene.add(this.tenBox);
    this.hot(this.tenBox, { r: 0.9, tap: () => { this.tenBox.boing(); this.add(10, this.tenBox); } });
  }

  /* ---------------------------------------------------------------- cookies */

  bakeOne(kind, pos, parent = this.tray) {
    const mesh = cookieMesh(kind);
    mesh.scale.setScalar(this.cell * 0.8);
    const c = new Toy(mesh, 0.2, { idle: 0 });
    c.kind = kind;
    c.position.set(...pos);
    parent.add(c);
    return c;
  }

  add(n, from) {
    if (this.cookies.length + n > this.slots.length) { from.wiggle(); this.audio.speak('There is no room for that many!'); return; }
    const start = this.tray.worldToLocal(from.position.clone().setY(1.2)).toArray();
    for (let i = 0; i < n; i++) {
      const c = this.bakeOne('raw', start);
      const slot = this.cookies.push(c) - 1;
      this.jump(c, this.slots[slot], { height: 1.1, dur: 0.36, delay: i * 0.05 }).then(() => this.audio.step(slot));
    }
    this.audio.plop();
    this.audio.speak(numberWord(this.cookies.length));
  }

  takeBack() {
    const c = this.cookies.pop();
    if (!c) { this.jar.hop(0.3); return; }
    this.audio.swoop();
    this.audio.speak(numberWord(this.cookies.length));
    this.jump(c, this.tray.worldToLocal(this.jar.position.clone().setY(1)).toArray(), { height: 1.1, dur: 0.34 }).then(() => this.remove(c));
  }

  ring() {
    this.bell.wiggle(1.6).boing();
    this.audio.ding();
    const n = this.cookies.length;
    if (n === this.order) { this.resolve(); return; }
    this.customer.wiggle();
    this.miss(null, [`That is ${numberWord(n)}.`, `I want ${numberWord(this.order)}.`, n < this.order ? 'More please!' : 'Too many! Tap the tray to take one off.']);
  }

  /* ----------------------------------------------------------------- rounds */

  async play() {
    const nextOrder = deck(ORDERS[this.level]), nextCustomer = deck(CUSTOMERS);
    for (let i = 0; i < this.roundsTotal; i++) {
      const n = nextOrder();
      this.order = this.level === 3 ? 10 : n;
      await this.welcome(nextCustomer());
      let line = `${numberWord(n)} ${n === 1 ? 'cookie' : 'cookies'}! Yum!`;
      if (this.level === 3) {
        await this.makeTen(n);
        line = `${numberWord(n)} and ${numberWord(10 - n)} make ten!`;
      } else {
        const how = this.level === 4 ? 'Use the box of ten, and the jar.' : 'Tap the jar. Then ring the bell!';
        this.prompt(`${n} ${n === 1 ? 'cookie' : 'cookies'}, please!`, [`${numberWord(n)} ${n === 1 ? 'cookie' : 'cookies'}, please!`, ...(i < 2 ? [how] : [])]);
        await this.ask();
        if (this.level === 4) line = `Ten and ${numberWord(n - 10)} is ${numberWord(n)}!`;
      }
      this.win(this.tray);
      await this.serve(line);
    }
    this.finish();
  }

  async welcome(name) {
    const c = this.customer = this.toy(name, 3, [10, -0.9, -3.1]);
    this.poke(c, { r: 1.1, sound: 'squeak' });
    for (const x of [7.4, 4.8, 2.3]) { this.audio.boing(0.7); await this.jump(c, [x, -0.9, -3.1], { height: 0.6, dur: 0.3 }); }
    const b = this.bubble = bubble(1.9, this.level === 1 ? 1.75 : 1.4, -1);
    const num = text3d(String(this.order), { height: 0.82, color: this.tint, shadow: false });
    num.position.set(0, this.level === 1 ? 0.28 : 0, 0.16);
    b.add(num);
    if (this.level === 1) {
      range(this.order).forEach((i) => {
        const pic = cookieMesh('baked');
        pic.scale.setScalar(0.38);
        pic.rotation.x = Math.PI / 2;
        pic.position.set((i - (this.order - 1) / 2) * 0.42, -0.52, 0.1);
        b.add(pic);
      });
    }
    b.position.set(4.6, 2.05, -2.6);
    b.rotation.x = -0.3;
    this.scene.add(b);
    this.audio.pop();
    await this.appear(b);
  }

  /** Level 3: some are baked already. Which plate fills the tray exactly? */
  async makeTen(have) {
    this.cookies = range(have).map((i) => this.bakeOne('dark', this.slots[i]));
    this.cookies.forEach((c, i) => this.appear(c, i * 0.05));
    const plates = this.row(nearbyChoices(10 - have, 3, 1, 9).map((n) => {
      const g = new THREE.Group();
      g.add(build((b) => b.cyl('#ffffff', [0, 0.05, 0], [1.2, 0.9], 0.1, { scale: [1.12, 1, 0.72], seg: 32 })));
      const plate = new Toy(g, 1.6, { idle: 0 });
      plate.value = n;
      plate.hotAt = V(0, 0.15, 0);
      plate.load = range(n).map((i) => {
        const inRow = i < 5 ? Math.min(5, n) : n - 5;
        const c = this.bakeOne('raw', [((i % 5) - (inRow - 1) / 2) * 0.46, 0.1, n > 5 ? (i < 5 ? -0.27 : 0.27) : 0], g);
        c.scale.setScalar(0.47);
        c.spot = c.position.toArray();
        return c;
      });
      return plate;
    }), { z: FRONT - 0.15, gap: 3.05 });
    this.prompt('Which plate makes 10?', [`I want ten cookies. The tray has ${numberWord(have)}.`, 'Which plate makes ten?']);
    const right = await this.choose(plates, plates.find((p) => p.value === 10 - have), {
      r: 1.2, wrong: (p) => { this.demonstrate(() => this.tryPlate(p, have)); return null; },
    });
    await this.pour(right, have);
    this.cookies.push(...right.load);
    plates.forEach((p) => this.vanish(p));
  }

  /** Hop a plate's cookies onto the tray; any that do not fit land beside it. */
  pour(plate, have) {
    return Promise.all(plate.load.map((c, i) => {
      this.tray.attach(c);
      this.scaleTo(c, 1, 0.36, { delay: i * 0.1 });
      const over = have + i - 10;
      const to = over < 0 ? this.slots[have + i] : [3.9 + (over % 2) * 1, 0.02, -0.6 + Math.floor(over / 2) * 1.1];
      return this.jump(c, to, { height: 1.2, dur: 0.38, delay: i * 0.1 }).then(() => this.audio.step(have + i));
    }));
  }

  async tryPlate(plate, have) {
    await this.pour(plate, have);
    const total = have + plate.value;
    await this.talk([`That makes ${numberWord(total)}.`, total < 10 ? 'Not enough!' : 'Too many!'], { min: 1.4 });
    await Promise.all(plate.load.map((c, i) => {
      plate.act.children[0].attach(c);
      this.scaleTo(c, 0.47, 0.3, { delay: i * 0.04 });
      return this.jump(c, c.spot, { height: 1, dur: 0.32, delay: i * 0.04 });
    }));
  }

  /** Into the oven, ding, and down the hatch. */
  async serve(line) {
    await this.wait(0.7);
    this.vanish(this.bubble);
    this.audio.whoosh();
    this.scaleTo(this.tray, this.level === 4 ? 0.22 : 0.34, 0.55);
    await this.jump(this.tray, [OVEN[0], OVEN[1] - 0.1, OVEN[2] + 0.2], { height: 1.4, dur: 0.55 });
    this.glow.visible = true;
    this.pal.feel('think', 1);
    for (let i = 0; i < 4; i++) { this.audio.tap(); this.fx.puff(this.at(V(OVEN[0], 2.6, OVEN[2])), 2, { rise: 3 }); await this.wait(0.22); }
    this.audio.ding();
    this.glow.visible = false;
    for (const c of this.cookies) {
      if (c.kind !== 'raw') continue;
      const done = cookieMesh('baked');
      done.scale.setScalar(this.cell * 0.8);
      c.act.clear();
      c.act.add(done);
    }
    this.scaleTo(this.tray, 1, 0.5);
    await this.jump(this.tray, TRAY, { height: 1.4, dur: 0.5 });
    this.fx.sparkle(this.at(this.tray), 20, { spread: 4 });
    const said = this.talk(line, { min: 0.5 });
    const mouth = this.customer.anchors.mouth.getWorldPosition(V());
    await Promise.all(this.cookies.map(async (c, i) => {
      await this.wait(0.35 + i * 0.13);
      this.scene.attach(c);
      await this.jump(c, mouth.toArray(), { height: 1, dur: 0.34 });
      this.remove(c);
      this.customer.boing(0.5);
      this.audio.chomp();
      this.fx.crumbs(this.at(mouth), 4);
    }));
    this.cookies = [];
    this.fx.love(this.at(this.customer), 9);
    this.customer.hop(0.2).spin();
    this.audio.giggle();
    await said;
    await this.wait(0.5);
    for (const x of [5, 8, 11.5]) await this.jump(this.customer, [x, -0.9, -3.1], { height: 0.6, dur: 0.26 });
    this.remove(this.customer);
  }

  /* ------------------------------------------------------------------ hints */

  solution() {
    if (this.level === 3) return super.solution();
    const n = this.cookies.length;
    if (n === this.order) return { tap: this.bell };
    if (n > this.order) return { tap: this.tray };
    return { tap: this.tenBox && this.order - n >= 10 ? this.tenBox : this.jar };
  }

  nudgeChoices() { if (this.level === 3) super.nudgeChoices(); else [this.jar, this.bell, this.tenBox].forEach((t) => t?.hop(0.2)); }

  hint() {
    this.replayPrompt();
    if (this.level === 1 || (this.level !== 3 && !this.cookies.length)) this.point(this.solution());
  }
}
