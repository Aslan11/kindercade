/**
 * Robot Road — planning ahead, and a first taste of coding.
 *
 * Level 1 is remote control: press an arrow, the robot moves. After that the
 * arrows are queued up first and run together, so the child has to picture the
 * whole journey before it starts, watch where it goes wrong, and fix it. A
 * bump is a debugging step, not a defeat: the program is kept, and the robot's
 * footprints stay on the board to be compared with it.
 *
 * The second row of levels is real programming: find the bug in someone else's
 * program, repeat an arrow, and loop a whole pattern. The puzzles themselves
 * are made in data/robot.js.
 */

import * as THREE from '../core/three.js';
import { Game, V } from '../core/engine.js';
import { Toy, slab, block } from '../core/toy.js';
import { text3d } from '../core/glyphs.js';
import { Builder, build, instantiate, Shapes } from '../core/kit.js';
import { sky, ground, greenery } from '../core/scenery.js';
import { goButton } from '../core/props.js';
import { pick, range } from '../core/util.js';
import { numberWord } from '../data/words.js';
import { Puzzle, LEVELS, DIRS, MAX_TIMES, same } from '../data/robot.js';

const LOOK = {
  left: { turn: Math.PI, color: '#ff8a4c' },
  up: { turn: Math.PI / 2, color: '#2fb0ee' },
  down: { turn: -Math.PI / 2, color: '#9b6cff' },
  right: { turn: 0, color: '#ff6b8b' },
};
const PRIZES = ['gem', 'cupcake', 'star', 'gift', 'trophy', 'donut', 'crown'];
const LEAN = -0.75, LOOP = '#ffb52e';
const ARROW = [[0.36, 0], [0.02, 0.32], [0.02, 0.13], [-0.32, 0.13], [-0.32, -0.13], [0.02, -0.13], [0.02, -0.32]];
/** What to look for on each kind of broken program: [on screen, aloud]. */
const FAULTS = {
  wrong: ['One arrow is wrong. Fix it!', 'One arrow is wrong. Tap it, and put in the right one!'],
  extra: ['One arrow too many!', 'There is one arrow too many. Tap it to take it out!'],
  number: ['One number is wrong. Fix it!', 'One number is wrong. Count the squares, then tap the number to change it!'],
};
const times = (n) => (n === 1 ? 'one time' : `${numberWord(n)} times`);

function arrow(dir, size) {
  const g = new THREE.Group();
  g.add(slab(size, size, size * 0.34, LOOK[dir.name].color, size * 0.16));
  const mark = build((b) => b.puff('#ffffff', [0, 0, 0], Shapes.soft(ARROW, 0.04), 0.08), { shadow: false });
  mark.position.set(0, size / 2, size * 0.2);
  mark.scale.setScalar(size);
  mark.rotation.z = LOOK[dir.name].turn;
  g.add(mark);
  const t = new Toy(g, size, { idle: 0.3 });
  t.rotation.x = LEAN;
  return Object.assign(t, { dir, n: 1, hotAt: V(0, size * 0.36, -size * 0.3) });
}

const stamps = new Map();

/** A flat mark for the floor: an arrow in its key's colour, or a red burst for a bump. */
function footprint(dir, bump) {
  const id = bump ? 'bump' : dir.name;
  if (!stamps.has(id)) {
    const b = new Builder({ ao: false });
    b.puff(bump ? '#ff3b4e' : LOOK[id].color, [0, 0, 0], bump ? Shapes.star(0.44, 0.22, 7, 0.02) : Shapes.soft(ARROW, 0.04), 0.06);
    stamps.set(id, b.bake());
  }
  const print = instantiate(stamps.get(id), { shadow: false }).root;
  print.rotation.set(-Math.PI / 2, 0, LOOK[dir.name].turn);
  return print;
}

/** A number block that counts up each time it is tapped. */
function dial(n, size, color, ink) {
  const t = block(String(n), { size, color, ink, depth: size * 0.34 });
  t.hotAt = V(0, size * 0.36, -size * 0.3);
  t.show = (k) => {
    const text = text3d(k, { height: size * 0.54, color: ink, ink: true, shadow: false });
    text.position.copy(t.text.position);
    t.text.parent.add(text);
    t.text.removeFromParent();
    t.text = text;
  };
  return t;
}

export default class RobotRoad extends Game {
  static meta = { id: 'robot-road', tint: '#ff7a59', music: 'robot' };

  init() {
    const { cols, rows, drive, repeat, loop, fixed } = this.cfg = LEVELS[this.level - 1];
    this.roundsTotal = 5;
    this.asked = 15;          // trial and error is the game: a wrong run on every board still earns two stars
    this.view = { pos: V(0, 13.4, 11), look: V(0, 0, -0.1), fov: 30 };
    this.sway = 0.1;
    this.light({ span: 9 });
    sky(this);
    ground(this, { color: '#7fd8c0', hills: null });
    greenery(this, { x: [-13, 13], z: [-8, 6], bushes: 10, flowers: 14, tufts: 20, tuft: '#58bfa4', keepClear: (x, z) => Math.abs(x) < 6.2 && z > -5.2 });
    const CELL = this.cell = rows === 4 ? 1.24 : drive ? 1.6 : 1.5;
    this.origin = { x: (cols > 6 ? 0.9 : 0.6) - ((cols - 1) * CELL) / 2, z: (drive ? -0.55 : -0.85) - ((rows - 1) * CELL) / 2 };
    // On the loop level the board is a pond, and each round lays its own stepping stones.
    this.scene.add(loop ? build((b) => {
      const mid = [this.origin.x + ((cols - 1) * CELL) / 2, 0, this.origin.z + ((rows - 1) * CELL) / 2];
      b.box('#ffe3a8', mid, [cols * CELL + 0.4, 0.1, rows * CELL + 0.3], { r: 0.05 });
      b.box('#4cc0f5', mid, [cols * CELL + 0.1, 0.16, rows * CELL + 0.06], { r: 0.06, surf: 'shiny' });
      range(cols * rows).filter((i) => i % 3 === 1).forEach((i) => {
        const [x, , z] = this.spot({ x: i % cols, z: Math.floor(i / cols) });
        b.tube('#bdeeff', range(5).map((k) => [x + (k - 2) * 0.13, 0.09, z - 0.12 + (k % 2 ? 0.06 : -0.03)]), 0.028, { ink: false, radial: 5 });
      });
    }) : this.tiles(() => true));
    this.rowZ = loop ? 2.62 : 2.75;
    const keysZ = drive ? 3.75 : loop || fixed ? 4.5 : 4.3;      // a little lower, to clear the loop's rail or a full row
    this.addPal([-4.75, 0, -1.4], { size: 1.9 }).rotation.x = -0.5;
    this.bot = this.toy('robot', 1.2);
    this.bot.rotation.x = -0.5;

    this.keys = (fixed ? [] : DIRS).map((dir, i) => {
      const t = arrow(dir, drive ? 1.45 : 1.15);
      t.position.set(drive ? (i - 1.5) * 1.95 + 0.3 : -3.6 + i * 1.5, 0.05, keysZ);
      this.scene.add(t);
      return this.hot(t, { r: 0.7, tap: () => this.press(t) });
    });
    this.chips = [];          // the program: arrow toys, with null for a gap
    this.laps = 1;
    this.prints = [];
    if (drive) return;

    this.pitch = repeat ? 2.05 : loop ? 1.05 : 0.92;
    this.chipSize = repeat || loop ? 0.82 : 0.72;
    this.go = goButton(1.45);
    this.go.position.set(fixed ? 0.2 : 3.4, 0, keysZ + 0.05);
    this.go.rotation.x = LEAN;
    this.go.hotAt = V(0, 0.55, -0.45);
    this.scene.add(this.go);
    this.hot(this.go, { r: 0.75, tap: () => this.run() });

    // A glowing pad shows where the next arrow will land. Sitting in a gap, a tap closes
    // the gap — but not the second half of the double tap that made it.
    this.pad = new Toy(build((b) => b.box('#fff6c2', [0, 0.05, -0.28], [0.8, 0.06, 0.72], { seg: 1, r: 0.03, surf: 'bright' }), { shadow: false }), 0.1, { idle: 0 });
    this.pad.hotAt = V(0, 0.05, -0.28);
    this.pad.visible = false;
    this.scene.add(this.pad);
    this.hot(this.pad, { r: 0.4, tap: () => { if (this.chips.includes(null) && this.t > this.gapMade + 0.8) this.closeGap(); } });
    this.every((dt, t) => {
      const at = this.busy ? -1 : this.puzzle.cursor(this.chips);
      this.pad.visible = at >= 0;
      if (at >= 0) this.pad.position.set(...this.slot(at));
      this.pad.scale.setScalar(1 + Math.sin(t * 5) * 0.06);
    });
  }

  spot({ x, z }) { return [this.origin.x + x * this.cell, 0.16, this.origin.z + z * this.cell + 0.12]; }
  slot(i) {
    const { slots, repeat, loop } = this.puzzle;
    return [0.2 + (i - (slots - 1) / 2) * this.pitch - (repeat ? 0.42 : loop ? 0.6 : 0), 0.04, this.rowZ];
  }
  get program() { return { chips: this.chips, laps: this.laps }; }

  tiles(wanted) {
    const { cols, rows } = this.cfg, size = this.cell - 0.05;
    return build((b) => range(cols * rows).filter(wanted).forEach((i) => {
      const x = i % cols, z = Math.floor(i / cols), [px, , pz] = this.spot({ x, z });
      b.box((x + z) % 2 ? '#fff3d6' : '#ffe0a8', [px, 0.06, pz - 0.12], [size, 0.2, size], { r: 0.08, seg: 1 });
    }));
  }

  /** The tray the program sits in. A loop's has a rail that runs from the end back round to the start. */
  layTray() {
    const { slots, repeat, loop } = this.puzzle;
    const tray = new THREE.Group();
    tray.position.set(0.2, 0, this.rowZ);       // so it pops in and out where it lies
    const parts = build((b) => {
      range(slots).forEach((i) => b.box('#5fb8a2', [this.slot(i)[0] + (repeat ? 0.42 : 0), 0.01, this.rowZ - 0.28], [repeat ? 1.8 : 0.8, 0.04, 0.72], { seg: 1, r: 0.02 }));
      if (!loop) return;
      const l = this.slot(0)[0] - 0.75, r = this.slot(slots)[0] + 0.1, back = this.rowZ - 0.3, front = this.rowZ + 0.3;
      b.tube(LOOP, [[r, 0.08, back], [r, 0.08, front - 0.1], [r - 0.3, 0.08, front], [l + 0.3, 0.08, front], [l - 0.12, 0.08, front - 0.2], [l - 0.12, 0.08, back + 0.1], [l + 0.06, 0.08, back]], 0.07);
      b.cone(LOOP, [l + 0.02, 0.1, back], 0.19, 0.34, { rot: [0, 0, -Math.PI / 2] });
    });
    parts.position.copy(tray.position).negate();
    this.scene.add(tray.add(parts));
    this.appear(tray);
    if (!loop) return [tray];
    this.lapDial = dial(1, 0.95, LOOP, '#ffffff');
    this.lapDial.position.set(this.slot(slots)[0] + 0.1, 0.04, this.rowZ);
    this.lapDial.rotation.x = LEAN;
    this.scene.add(this.lapDial);
    this.appear(this.lapDial, 0.3);
    this.hot(this.lapDial, { r: 0.55, tap: () => this.turnLaps() });
    return [tray, this.lapDial];
  }

  /* ----------------------------------------------------------------- rounds */

  async play() {
    const { cols, drive, key, repeat, loop } = this.cfg;
    const cellAt = (i) => ({ x: i % cols, z: Math.floor(i / cols) });
    for (let round = 0; round < this.roundsTotal; round++) {
      const puzzle = this.puzzle = new Puzzle(this.cfg, round, this.roundsTotal);
      Object.assign(this, { round, laps: 1, stalls: 0, latest: null, lastRun: null, here: puzzle.start });
      const place = (name, size, cell) => { const t = this.toy(name, size, this.spot(cell)); t.rotation.x = -0.5; this.appear(t, 0.3); return t; };
      const prize = place(key ? 'gift' : PRIZES[round + (loop ? 1 : 0)], 0.9, puzzle.goal);
      prize.float = 0.06;
      const props = drive ? [] : this.layTray();
      if (loop) {
        const stones = this.tiles((i) => !puzzle.walls.has(i));
        this.scene.add(stones);
        this.appear(stones);
        const swimmer = place(pick(['duck', 'boat', 'whale']), 0.85, cellAt(pick([...puzzle.walls].filter((i) => i < cols || puzzle.walls.has(i - cols)))));      // never in front of a stone
        swimmer.position.y = 0.02;
        swimmer.float = 0.04;
        props.push(stones, this.poke(swimmer, { sound: 'squeak' }));
      } else for (const i of puzzle.walls) props.push(place(pick(['rock', 'cactus', 'log']), 1, cellAt(i)));
      this.keyToy = key ? place('key', 0.85, puzzle.keyAt) : null;
      await this.jump(this.bot, this.spot(puzzle.start), { height: 1.6, dur: 0.5 });

      const goal = key ? 'Get the key first, then open the present!' : `Help the robot reach the ${prize.kind}!`;
      if (puzzle.fault) {
        await this.showBug(prize);
        this.prompt(...FAULTS[puzzle.fault]);
      } else {
        const [text, how] = drive ? ['Drive the robot', 'Tap the arrows to drive.']
          : repeat ? ['How many steps each way?', 'Pick an arrow. Then tap its number, to say how many steps.']
          : loop ? ['Find the pattern, then loop it!', 'The path has a pattern. Make it just once. Then tap the yellow number, to do it again and again!']
          : ['Plan a path, then go!', 'Tap the arrows to plan a path. Then press the green button!'];
        this.prompt(text, round < 2 ? [goal, how] : goal);
      }
      await this.ask();

      this.win(prize);
      this.bot.dancing = true;
      prize.hop(1, 0.6).spin();
      if (puzzle.fault) this.freeBug();
      await this.talk(puzzle.fault ? 'You fixed the bug! Beep boop!' : 'Beep boop! Thank you!', { min: 1.6 });
      this.bot.dancing = false;
      [prize, ...props, ...this.chips.splice(0), ...this.prints.splice(0)].forEach((t) => t && this.vanish(t));
      if (this.keyToy) this.remove(this.keyToy);
      await this.wait(0.4);
    }
    this.finish();
  }

  /** The robot loads its own program and shows how it goes wrong. */
  async showBug(prize) {
    const said = this.settle(this.prompt('Watch the robot…', `I want the ${prize.kind}. Here is my plan. Watch!`), { min: 1.2 });
    for (const { dir, n } of this.puzzle.given.chips) {
      this.queue(dir, this.bot, n);
      await this.wait(0.2);
    }
    this.latest = null;
    await said;
    await this.drive();
    await this.talk('Uh oh! My plan has a bug in it!');
  }

  /** …and with the program mended, the bug comes leaping out of it. */
  async freeBug() {
    const bug = this.toy('ladybug', 1.05, [0.2, 0.1, this.rowZ - 0.4]);
    bug.rotation.x = -0.5;
    this.appear(bug);
    this.audio.giggle();
    await this.jump(bug.spin(), [-4.7, 0.05, 1.5], { height: 2.6, dur: 0.75 });
    await this.wait(0.6);
    await this.jump(bug, [-12, 0.05, 0.5], { height: 2.4, dur: 0.6 });
    this.remove(bug);
  }

  /** One move, leaving a footprint on the line between the two squares. */
  async step({ dir, from, to, bump }) {
    const [x, y, z] = this.spot(from);
    if (!this.cfg.drive) {
      const print = footprint(dir, bump);
      const lane = bump ? 0 : 0.22;      // keep right, so there-and-back shows as two prints
      print.position.set(x + dir.dx * this.cell / 2 - dir.dz * lane, y + 0.04, z - 0.12 + dir.dz * this.cell / 2 + dir.dx * lane);
      this.scene.add(print);
      this.appear(print, 0.12, 0.68);
      this.prints.push(print);
    }
    if (bump) {
      await this.jump(this.bot, [x + dir.dx * 0.35, y, z + dir.dz * 0.35], { height: 0.2, dur: 0.16 });
      if (this.cfg.loop) this.audio.plop(); else this.audio.place();
      this.fx.addShake(0.6);
      this.fx.starBurst(this.at(this.bot), 4);
      await this.jump(this.bot, [x, y, z], { height: 0.3, dur: 0.22 });
      return;
    }
    this.here = to;
    this.audio.tone({ freq: 500, slide: 900, dur: 0.12, type: 'square', vol: 0.05 });
    await this.jump(this.bot, this.spot(to), { height: 0.5, dur: 0.34 });
    if (this.keyToy?.visible && same(to, this.puzzle.keyAt)) {
      this.keyToy.visible = false;
      this.audio.coin();
      this.fx.sparkle(this.at(this.bot), 12);
    }
  }

  /* ---------------------------------------------------------------- editing */

  async press(key) {
    key.boing();
    const { dir } = key;
    if (this.cfg.drive) {
      this.busy = true;
      this.audio.speak(dir.name);
      const to = { x: this.here.x + dir.dx, z: this.here.z + dir.dz };
      await this.step({ dir, from: this.here, to, bump: this.puzzle.blocked(to) });
      if (same(this.here, this.puzzle.goal)) this.resolve(); else this.busy = false;
      return;
    }
    const grow = this.puzzle.merges(this.chips, dir, this.latest);
    if (grow) {
      if (grow.n < MAX_TIMES) this.turn(grow); else grow.dial.wiggle();
    } else if (this.puzzle.cursor(this.chips) < 0) {
      key.wiggle();
      this.audio.speak(this.cfg.loop && this.laps === 1 ? 'All full! Tap the yellow number to do it again.' : 'All full! Tap an arrow in the row to take it out.');
    } else {
      this.queue(dir, key);
      // The first go with numbers: show where to tap the moment it is needed.
      const next = this.round === 0 && this.puzzle.exact && !this.puzzle.fault && this.puzzle.advice(this.program);
      if (next?.turn || next?.lap) this.point(this.solution());
    }
  }

  /** Send an arrow flying to the next free slot. */
  queue(dir, from, n = 1) {
    const at = this.puzzle.cursor(this.chips);
    const chip = this.latest = this.chips[at] = arrow(dir, this.chipSize);
    chip.n = n;
    chip.position.copy(from.position);
    this.scene.add(chip);
    this.audio.step(at);
    this.jump(chip, this.slot(at), { height: 0.7, dur: 0.26 });
    const when = () => !chip.flight;        // on its way it must not steal a tap meant for the key
    this.hot(chip, { r: 0.4, when, tap: () => (this.cfg.fixed ? this.turn(chip) : this.unqueue(chip)) });
    if (!this.cfg.repeat) return;
    chip.dial = dial(n, this.chipSize, '#ffffff', LOOK[dir.name].color);
    chip.dial.position.x = 0.88;
    chip.add(chip.dial);
    this.hot(chip.dial, { r: 0.45, when, tap: () => this.turn(chip) });
  }

  /** Tap a queued arrow to take it out. It leaves a gap for a better one. */
  unqueue(chip) {
    this.chips[this.chips.indexOf(chip)] = this.latest = null;
    this.gapMade = this.t;
    while (this.chips.length && !this.chips[this.chips.length - 1]) this.chips.pop();
    this.audio.pop();
    this.fx.puff(this.at(chip), 5);
    this.remove(chip);
  }

  closeGap() {
    this.chips.splice(this.chips.indexOf(null), 1);
    this.audio.swoop();
    this.chips.forEach((c, i) => c && this.moveTo(c, this.slot(i), 0.2));
  }

  turn(chip) { chip.n = this.click(chip.dial, chip.n); }
  turnLaps() { this.laps = this.click(this.lapDial, this.laps); }

  click(face, n) {
    const next = (n % MAX_TIMES) + 1;
    face.show(next);
    face.hop(0.3, 0.26);
    this.audio.step(next + 2);
    this.audio.speak(times(next));
    return next;
  }

  /* ---------------------------------------------------------------- running */

  /** Act the program out, skipping any gaps. Unless it wins, the robot ends up back at the start. */
  async drive() {
    this.prints.splice(0).forEach((p) => this.vanish(p));
    const result = this.puzzle.run(this.program);
    let lap = -1;
    for (const move of result.moves) {
      const { chip, count } = move;
      if (this.cfg.loop && move.lap !== lap) {
        lap = move.lap;
        this.lapDial.hop(0.5);
        this.fx.floatText(this.at(this.lapDial), String(lap + 1), { color: '#fff3b0', size: 0.8 });
        this.audio.chime(660 * 2 ** (lap / 6));
        await this.wait(0.3);
      }
      if (count === 1) chip.hop(0.6);
      chip.dial?.hop(0.4, 0.3);
      await this.step({ dir: chip.dir, ...move });
      if (chip.n > 1 && !move.bump) this.fx.floatText(this.at(this.bot), String(count), { size: 0.6, life: 0.7 });
    }
    this.lastRun = this.signature();
    if (result.won) return result;
    await this.wait(0.5);
    this.here = this.puzzle.start;
    if (this.keyToy) this.keyToy.visible = true;
    await this.jump(this.bot, this.spot(this.here), { height: 1.4, dur: 0.45 });
    return result;
  }

  signature() { return this.chips.filter(Boolean).map((c) => c.dir.name + c.n).join() + this.laps; }

  async run() {
    this.go.boing(1.2);
    if (!this.chips.length) { this.nudgeChoices(); this.audio.speak('Tap the arrows first!'); return; }
    this.busy = true;
    const replay = this.signature() === this.lastRun;
    const result = await this.drive();
    if (result.won) { this.resolve(); return; }
    this.busy = false;
    // Running it again to watch more closely is good debugging, not a mistake.
    if (!replay) this.miss(result.bumped, this.why(result));
    else if (++this.stalls >= 2) this.hint();
    else this.audio.say(this.why(result));
  }

  why({ bumped, passed, keyless }) {
    const { repeat, loop } = this.cfg, at = this.puzzle.cursor(this.chips);
    if (passed) {
      const tooMany = loop ? passed.chip === this.chips.find(Boolean) : passed.count > 1;
      return ['Too far!', tooMany ? 'Try a smaller number.' : 'The robot has to stop on the prize.'];
    }
    if (keyless) return 'We need the key first!';
    const oops = !bumped ? 'Not there yet.' : loop ? 'Whoa! Water!' : 'Bump!';
    if (this.chips.includes(null)) return [oops, 'Put an arrow in the gap!'];
    if (repeat) return [oops, 'Count the squares, and check the numbers.'];
    if (!bumped && at >= 0) return [oops, 'Add some more arrows!'];
    if (!bumped && loop) return [oops, 'Does it need to go round again?'];
    return [oops, 'Follow the footprints. Which arrow went wrong? Tap it to take it out.'];
  }

  /* ------------------------------------------------------------------ hints */

  solution() {
    const { puzzle } = this;
    const keyFor = (dir) => this.keys.find((k) => k.dir === dir);
    if (this.cfg.drive) {
      const left = (d) => { const c = { x: this.here.x + d.dx, z: this.here.z + d.dz }; return puzzle.blocked(c) ? Infinity : puzzle.distance(c, puzzle.goal); };
      return { tap: keyFor(DIRS.reduce((a, b) => (left(b) < left(a) ? b : a))) };
    }
    const m = puzzle.advice(this.program);
    return { tap: m.go ? this.go : m.press ? keyFor(m.press) : m.remove || m.turn?.dial || (m.close ? this.pad : this.lapDial) };
  }

  /** Bounce the keys while there is room for an arrow, and the row itself once there is not. */
  nudgeChoices() {
    const full = !this.cfg.drive && this.puzzle.cursor(this.chips) < 0;
    const lot = full ? [...this.chips.map((c) => c.dial || c), this.lapDial].filter(Boolean) : this.keys;
    lot.forEach((k, i) => this.tweens.after(i * 0.1, () => k.hop(0.25)));
  }

  /** Thinking time is the point here, so the glove waits for a second silence. */
  hint() { this.replayPrompt(); if (this.level <= 2 || this.tries || ++this.stalls >= 2) this.point(this.solution()); }
}
