/**
 * Letter Racer — letter formation, in the right order and the right direction.
 *
 * Every letter is a road. The child drives along it one stroke at a time (see
 * `data/strokes.js`), collecting stars and laying down rainbow paint. The car
 * is on rails: it only moves while the finger is actually following the road,
 * so scribbling gets nowhere. Wander off and it simply stops and waits.
 *
 * All the tracing logic runs in flat "paper" coordinates — x right, y down,
 * 100 to the world unit — and `tools/trace-check.mjs` holds it to account.
 */

import * as THREE from '../core/three.js';
import { Game, V } from '../core/engine.js';
import { Toy } from '../core/toy.js';
import { build, INK } from '../core/kit.js';
import { text3d } from '../core/glyphs.js';
import { ground, greenery } from '../core/scenery.js';
import { approach, clamp, dist, range, sample, shuffle, TAU } from '../core/util.js';
import { LETTER_NAME, LETTER_TOY, numberWord, toyName } from '../data/words.js';
import { strokesFor, MID } from '../data/strokes.js';

const UNIT = 400;     // one cap height, in paper units
const BASE = 215;     // where the baseline sits
const STEP = 7;       // spacing of the resampled path points
/** Tolerances, as fractions of the cap height. */
const CATCH = 0.11;   // how near the finger must pass to pull the car along
const STRAY = 0.26;   // beyond this the car stops
const START = 0.18;   // how near the finger must land to take the wheel
const CORNER = 0.19;  // how early a finger may turn at a sharp point, like the tips of a W
const REACH = 0.30;   // how far ahead one movement may carry the car
const ROAD = 0.37;    // half-width of the road, in world units

const curve = (n, fn) => [range(n + 1).map((i) => fn(i / n))];
/** Level 1: the lines and loops letters are made of, each with somewhere to go. */
const WARMUPS = [
  { say: 'a line across', goal: 'house', strokes: [[[-0.8, 0.55], [0.8, 0.55]]] },
  { say: 'a line down', goal: 'castle', strokes: [[[0, 0], [0, 1.1]]] },
  { say: 'over the hill', goal: 'tree', strokes: curve(24, (t) => [-0.8 + t * 1.6, 1 - Math.sin(t * Math.PI) * 0.9]) },
  { say: 'a zig zag', goal: 'igloo', strokes: [[[-0.9, 0.95], [-0.45, 0.15], [0, 0.95], [0.45, 0.15], [0.9, 0.95]]] },
  { say: 'a wiggly wave', goal: 'boat', strokes: curve(40, (t) => [-0.9 + t * 1.8, 0.55 - Math.sin(t * TAU) * 0.4]) },
  { say: 'all the way round', goal: 'cake', strokes: curve(40, (t) => [-Math.sin(t * TAU) * 0.55, 0.55 - Math.cos(t * TAU) * 0.55]) },
];
/** [model, the yaw that points it along +x] */
const RACERS = [['car', 0.5], ['bus', 0.5], ['truck', 0.5], ['ladybug', Math.PI / 2], ['train', 0.5]];

/** Walk a polyline emitting points every `step`, corners included. */
function resample(src, step) {
  if (src.length < 2) return src.slice();
  const out = [src[0]];
  let residue = 0;
  for (let i = 1; i < src.length; i++) {
    const a = src[i - 1], b = src[i];
    const seg = Math.hypot(b.x - a.x, b.y - a.y);
    if (seg < 1e-6) continue;
    let d = step - residue;
    while (d <= seg) {
      out.push({ x: a.x + ((b.x - a.x) * d) / seg, y: a.y + ((b.y - a.y) * d) / seg });
      d += step;
    }
    residue = seg - (d - step);
  }
  const last = src[src.length - 1], tail = out[out.length - 1];
  if (Math.hypot(last.x - tail.x, last.y - tail.y) > step * 0.35) out.push(last);
  return out;
}

/** Flag the points either side of a sharp turn, where a little corner-cutting is forgiven. */
function markCorners(pts) {
  const near = Math.round((UNIT * CORNER) / STEP);
  for (let i = 3; i < pts.length - 3; i++) {
    const a = Math.atan2(pts[i].y - pts[i - 3].y, pts[i].x - pts[i - 3].x);
    const b = Math.atan2(pts[i + 3].y - pts[i].y, pts[i + 3].x - pts[i].x);
    if (Math.cos(b - a) > 0) continue;
    for (let k = Math.max(0, i - near); k <= Math.min(pts.length - 1, i + near); k++) pts[k].corner = true;
  }
  return pts;
}

const world = (p, y = 0) => V(p.x / 100, y, p.y / 100);
const FLOOR = new THREE.Plane(V(0, 1, 0), 0);
const DISC = new THREE.CircleGeometry(1, 20).rotateX(-Math.PI / 2);
const FLAT = new THREE.MeshBasicMaterial();

/** A ribbon of overlapping discs along a path; `count` decides how much shows. */
function ribbon(pts, r, y, color) {
  const mesh = new THREE.InstancedMesh(DISC, FLAT, pts.length);
  const m = new THREE.Matrix4(), c = new THREE.Color();
  pts.forEach((p, i) => {
    mesh.setMatrixAt(i, m.makeScale(r, 1, r).setPosition(world(p, y + i * 0.00004)));
    mesh.setColorAt(i, typeof color === 'function' ? color(c, i) : c.set(color));
  });
  mesh.frustumCulled = false;
  return mesh;
}

export default class LetterTrace extends Game {
  static meta = { id: 'letter-trace', tint: '#00b8a9', music: 'draw' };

  init() {
    this.roundsTotal = this.level === 1 ? WARMUPS.length : 5;
    this.view = { pos: V(0, 15.2, 8.2), look: V(0, 0, -0.1), fov: 30 };
    this.sway = 0.08;
    this.light({ span: 9 });
    ground(this, { hills: null });
    greenery(this, { x: [-12, 12], z: [-7, 6], bushes: 12, flowers: 26, tufts: 30, keepClear: (x, z) => Math.abs(x) < 4.9 && z > -3.6 || (x < -3.5 && x > -6.6 && z > 1.4) });
    this.scene.add(build((b) => {
      b.box(INK, [0, 0, 0.6], [8.9, 0.02, 7.1], { r: 0.01, ink: false, surf: 'bright' });
      b.box('#fffaf0', [0, 0, 0.6], [8.8, 0.04, 7], { r: 0.02, ink: false });
      if (this.level === 1) return;
      const rule = (y, color, dash) => {
        for (let x = -4.1; x < 4.1; x += dash ? 0.5 : 9) b.box(color, [dash ? x + 0.14 : 0, 0.022, (BASE + (y - 1) * UNIT) / 100], [dash ? 0.28 : 8.2, 0.004, 0.05], { ink: false, seg: 1, r: 0.001 });
      };
      rule(0, '#b9d4f5'); rule(MID, '#b9d4f5', true); rule(1, '#ffb3c4');
    }, { shadow: false }));
    this.addPal([-4.65, 0, 3.55], { size: 1.6, hat: 'cap' }).rotation.x = -0.6;

    const easy = this.level === 1 ? 1.35 : 1;
    this.catchR = UNIT * CATCH * easy;
    this.cornerR = UNIT * CORNER * easy;
    this.strayR = UNIT * STRAY * easy;
    this.startR = UNIT * START * easy;
    this.reach = Math.round((UNIT * REACH) / STEP);
    this.box = { x: -320, y: BASE - UNIT * 1.15, w: 640, h: UNIT * 1.6 };
    this.heading = 0;
    this.scold = 0;
    this.pad = build((b) => b.cyl('#2fc77f', [0, 0.06, 0], 0.56, 0.06, { seg: 28, surf: 'glow' }), { shadow: false });
    this.pad.visible = false;
    this.scene.add(this.pad);
  }

  showHud() {
    super.showHud();
    this.hud.button('undo', '#ff8fa8', 'Start over', () => { if (!this.busy) { this.lay(this.strokes); this.demo(); } });
  }

  /* ------------------------------------------------------------- the track */

  /** Build the roads for a set of unit-space strokes and park at the start. */
  lay(strokes) {
    this.clearTrack();
    this.strokes = strokes;
    this.track = new THREE.Group();
    let hue = 0;
    this.paths = strokes.map((stroke, s) => {
      const pts = markCorners(resample(stroke.map(([x, y]) => ({ x: x * UNIT, y: BASE + (y - 1) * UNIT })), STEP));
      const from = hue;
      hue += pts.length;
      const paint = ribbon(pts, ROAD * 0.86, 0.05 + s * 0.008, (c, i) => c.setHSL(((from + i) * 0.006) % 1, 0.95, 0.6, THREE.SRGBColorSpace));
      paint.count = 0;
      this.track.add(ribbon(pts, ROAD + 0.05, 0.03, INK), ribbon(pts, ROAD, 0.04, '#cfc8e6'), paint);
      return { pts, paint, dot: pts.length < 2 };
    });
    this.scene.add(this.track);
    this.strokeIndex = -1;
    this.nextStroke();
  }

  clearTrack() {
    if (!this.track) return;
    this.track.traverse((o) => { if (o.isInstancedMesh) o.dispose(); });
    this.remove(this.track);
    this.track = null;
  }

  get current() { return this.paths?.[this.strokeIndex] || null; }

  /** Dress the next stroke: arrows, stars to collect, and the car on its mark. */
  nextStroke() {
    this.strokeIndex++;
    this.tip = 0;
    this.slips = 0;
    this.drawing = false;
    if (this.marks) this.remove(this.marks);
    const path = this.current;
    if (!path) return;
    const { pts } = path;
    this.marks = build((b) => {
      for (let i = 9; i < pts.length - 3; i += 12) {
        const a = Math.atan2(pts[i + 1].y - pts[i - 1].y, pts[i + 1].x - pts[i - 1].x);
        b.group(world(pts[i], 0.047).toArray(), [0, -a, 0], 1, () => b.both((s) =>
          b.box('#ffffff', [-0.05, 0, s * 0.075], [0.24, 0.002, 0.06], { rot: [0, s * 0.75, 0], r: 0.001, seg: 1, ink: false, surf: 'bright' })));
      }
    }, { shadow: false });
    this.track.add(this.marks);
    path.stars = [];
    for (let i = pts.length - 1; i > 10; i -= 16) {
      const star = this.toy('star', i === pts.length - 1 ? 0.6 : 0.4, world(pts[i], 0.12).toArray(), this.track);
      star.rotation.x = -0.9;
      star.float = 0.04;
      path.stars.push({ i, star });
    }
    if (this.racer) this.jump(this.racer, world(pts[0], 0.08).toArray(), { height: 0.9, dur: 0.36 });
  }

  /* ----------------------------------------------------------------- input */

  toPaper(p) { const w = this.onPlane(p, FLOOR); return { x: w.x * 100, y: w.z * 100 }; }

  onDown(p) {
    const at = this.toPaper(p);
    if (this.busy || Math.abs(at.x) > 440 || at.y < -300) return false;
    if (this._pick(p)) return false;      // the buddy, or something else to poke
    this.penDown(at);
    return this.drawing;                  // a miss (or a resting palm) must not hog the touch
  }
  onMove(p) { this._idle = 0; this.penMove(this.toPaper(p)); }
  onUp() { this.drawing = false; }

  penDown(p) {
    const path = this.current;
    if (this.busy || !path) return;
    const { pts } = path;
    // Take the wheel either at the start of the stroke or wherever the car was
    // left — a child who pauses half way should not lose the line.
    const atTip = this.tip > 0 && dist(p.x, p.y, pts[this.tip].x, pts[this.tip].y) <= this.startR;
    const atStart = dist(p.x, p.y, pts[0].x, pts[0].y) <= this.startR;
    if (!atTip && !atStart) { this.remind('Start on the green spot.'); return; }
    this.drawing = true;
    this.last = p;
    if (!atTip) this.tip = 0;
    this.audio.pick();
    // The dot on an i or a j is not a journey; touching it is the whole stroke.
    if (path.dot) this.finishStroke();
  }

  penMove(p) {
    const path = this.current;
    if (!this.drawing || this.busy || !path) return;
    // Walk along the finger's own travel rather than jumping to where it landed,
    // so a fast swipe (or a dropped frame) behaves exactly like a slow one.
    const from = this.last;
    const steps = clamp(Math.ceil(dist(from.x, from.y, p.x, p.y) / (this.catchR * 0.5)), 1, 24);
    for (let s = 1; s <= steps; s++) {
      this.advance(from.x + (p.x - from.x) * (s / steps), from.y + (p.y - from.y) * (s / steps));
      if (this.busy || !this.drawing) return;
    }
    this.last = p;
    // The car may round a sharp point before the finger does; going right into the point is not straying.
    const near = (q, r) => dist(p.x, p.y, q.x, q.y) <= r;
    const behind = path.pts.slice(Math.max(0, this.tip - this.reach), this.tip);
    if (!near(path.pts[this.tip], this.strayR) && !behind.some((q) => q.corner && near(q, this.catchR))) this.slip();
  }

  /**
   * Move forward through the points the finger has walked past.
   *
   * Stepping one point at a time, and giving up as soon as the path turns away
   * and is out of reach, is what stops the car hopping the gap between the two
   * legs of a V or skipping the belly of a B: to get to the far side, the
   * finger has to go round.
   */
  advance(x, y) {
    const { pts, stars } = this.current;
    const limit = Math.min(pts.length - 1, this.tip + this.reach);
    let i = this.tip, best = this.tip;
    let d = dist(x, y, pts[i].x, pts[i].y);
    while (i < limit) {
      const nd = dist(x, y, pts[i + 1].x, pts[i + 1].y);
      if (nd > d && nd > (pts[i + 1].corner ? this.cornerR : this.catchR)) break;
      i++;
      d = nd;
      if (d <= this.catchR) best = i;   // furthest point the finger is really on
    }
    this.tip = best;
    while (stars.length && stars[stars.length - 1].i <= best) {
      const { star } = stars.pop();
      this.audio.step(this.notes++);
      this.fx.sparkle(this.at(star), 6);
      this.remove(star);
    }
    if (this.tip >= pts.length - 1) this.finishStroke();
  }

  /** Wandered off the road. Gentle — but it has to cost a little, or flailing gets there by accident. */
  slip() {
    this.drawing = false;
    this.tip = Math.max(0, this.tip - this.reach);
    this.audio.swoop();
    this.racer?.wiggle();
    if (++this.slips < 3) return;
    this.slips = 0;
    this.mistakes++;
    this.tries++;
    this.remind('Stay on the road. Watch me!');
  }

  remind(line) {
    this.demo();
    if (this.t < this.scold) return;
    this.scold = this.t + 5;
    this.audio.speak(line);
  }

  finishStroke() {
    const path = this.current;
    path.paint.count = path.pts.length;
    this.fx.starBurst(this.at(world(path.pts[path.pts.length - 1])), 6);
    this.audio.coin();
    this.nextStroke();
    if (!this.current) this.complete();
    else if (this.roundsDone < 2) this.tweens.after(0.5, () => { if (!this.drawing && !this.busy) this.demo(); });
  }

  complete() { this.resolve(); }

  update(dt) {
    const path = this.current, car = this.racer;
    this.pad.visible = !!path && !this.drawing && !this.busy;
    if (!path || !car) return;
    const { pts } = path;
    path.paint.count = this.tip ? this.tip + 1 : 0;
    this.pad.position.copy(world(pts[this.tip]));
    this.pad.scale.setScalar(1 + Math.sin(this.t * 5) * 0.08);
    if (this.drawing) car.flight = null;
    if (!car.flight) car.position.lerp(world(pts[this.tip], 0.08), 1 - Math.exp(-22 * dt));
    if (path.dot) return;
    const a = pts[Math.max(0, this.tip - 2)], b = pts[Math.min(pts.length - 1, this.tip + 3)];
    const turn = Math.atan2(a.y - b.y, b.x - a.x) - this.heading;
    this.heading = approach(this.heading, this.heading + Math.atan2(Math.sin(turn), Math.cos(turn)), 14, dt);
    car.rotation.y = this.heading + car.yaw;
    if (this.drawing && this.t % 0.12 < dt) this.fx.puff(this.at(car), 1, { size: 0.14, spread: 0.5 });
  }

  /* ----------------------------------------------------------------- rounds */

  async play() {
    const set = { 2: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ', 3: 'abcdefghijklmnopqrstuvwxyz', 4: '0123456789' }[this.level];
    const glyphs = set ? sample([...set], this.roundsTotal) : WARMUPS;
    const racers = shuffle(RACERS);
    for (const [i, glyph] of glyphs.entries()) {
      const [model, yaw] = racers[i % racers.length];
      this.racer = Object.assign(this.toy(model, 1.05, [-6.5, 0.08, 0]), { yaw });
      this.notes = 0;
      this.lay(glyph.strokes || strokesFor(glyph));
      const how = i ? [] : ['Start on the green spot and follow the arrows.'];
      let goal;
      if (glyph.goal) {
        const end = this.current.pts[this.current.pts.length - 1];
        const round = dist(end.x, end.y, this.current.pts[0].x, this.current.pts[0].y) < 20;
        goal = this.toy(glyph.goal, 1.35, world(round ? { x: 0, y: BASE - UNIT * 0.36 } : { x: end.x + (end.x ? 40 : 125), y: end.y - (end.x ? 75 : 0) }).toArray());
        goal.rotation.x = -0.55;
        this.appear(goal);
        this.prompt(`Drive ${glyph.say}`, [`Drive ${glyph.say}!`, ...how]);
      } else {
        const name = this.level === 4 ? `number ${numberWord(Number(glyph))}` : `${this.level === 3 ? 'little' : 'big'} ${LETTER_NAME[glyph.toLowerCase()]}`;
        this.prompt(`Drive the ${this.level === 4 ? 'number' : 'letter'} ${glyph}`, [`Let's drive ${name}!`, ...how]);
      }
      this.tweens.after(0.9, () => { if (!this.drawing && !this.busy) this.demo(); });
      await this.ask();
      this.win(this.racer);
      this.audio.honk();
      this.racer.hop(0.6, 0.5).spin();
      await (goal ? this.arrive(goal) : this.showOff(glyph));
      this.vanish(this.racer);
      this.racer = null;
      this.paths = null;
      this.clearTrack();
    }
    this.finish();
  }

  async arrive(goal) {
    goal.dancing = true;
    this.fx.love(this.at(goal), 6);
    await this.talk(`You got to the ${goal.kind}!`, { min: 1.8 });
    this.vanish(goal);
  }

  /** The finished letter stands up off the page and meets its mascot. */
  async showOff(glyph) {
    const big = new Toy(text3d(glyph, { height: 1.5, color: '#ff6b8b', weight: 0.13, ink: true }), 1.5);
    big.position.set(-3.1, 0.9, -0.6);
    big.rotation.x = -0.9;
    big.dancing = true;
    this.scene.add(big);
    this.appear(big);
    const cast = this.level === 4
      ? range(Number(glyph)).map((i) => this.toy('apple', 0.6, [2.2 + (i % 3) * 0.72, 0.1, -1 + Math.floor(i / 3) * 0.95]))
      : [this.toy(LETTER_TOY[glyph.toLowerCase()], 1.9, [3, 0.1, 0.9])];
    cast.forEach((c, i) => { c.rotation.x = -0.6; this.appear(c, 0.3 + i * 0.12); this.tweens.after(0.3 + i * 0.12, () => this.audio.step(i)); });
    const name = LETTER_NAME[glyph.toLowerCase()];
    await this.talk(this.level === 4
      ? `${numberWord(cast.length)}! ${numberWord(cast.length)} ${cast.length === 1 ? 'apple' : 'apples'}.`
      : `${name}! ${name} is for ${toyName(cast[0].kind)}.`, { min: 2.4 });
    [big, ...cast].forEach((c) => this.vanish(c));
  }

  /* ------------------------------------------------------------------ hints */

  solution() {
    const path = this.current;
    if (!path) return null;
    if (path.dot) return { tap: world(path.pts[0]) };
    const rest = path.pts.slice(this.tip);
    return { drag: [...rest.filter((_, i) => i % 3 === 0), rest[rest.length - 1], rest[rest.length - 1]].map((p) => world(p)) };
  }

  demo() { this.point(this.solution()); }
  nudgeChoices() { this.demo(); }
  hint() { this.demo(); }
  destroy() { this.clearTrack(); }
}
