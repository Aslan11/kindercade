/**
 * Jigsaw Garden — spatial reasoning, part-whole thinking and persistence.
 *
 * The picture is a living 3D scene, photographed onto chunky interlocking
 * pieces. While the puzzle is in bits it holds still; drop in the last piece
 * and it comes alive, and its star leaps out of the frame. A faint ghost of
 * the picture stays on the board: for a small child the challenge should be
 * *placing* the piece, not holding the whole image in their head.
 */

import * as THREE from '../core/three.js';
import { Game, V } from '../core/engine.js';
import { Toy } from '../core/toy.js';
import { build, INK } from '../core/kit.js';
import { light } from '../core/stage.js';
import { sky, ground, greenery, fence, clouds } from '../core/scenery.js';
import { flower } from '../models/nature.js';
import { makeRng, randInt, range, sample, shuffle } from '../core/util.js';

/** Two puzzles per play: [columns, rows]. */
const CUTS = { 1: [[2, 1], [2, 2]], 2: [[2, 2], [3, 2]], 3: [[3, 3], [4, 3]], 4: [[4, 3], [4, 4]] };
const PIC_W = 6.2, PIC_H = 4.65, CENTRE = V(0.75, 3.4, 0), THICK = 0.16;
const TRAY_Y = -0.36, TRAY_SLOTS = 4, TRAY_SIZE = 1.15;

/** hero, sky, ground, then props as [model, size, x, y, z]. */
const SCENES = [
  ['lion', '#ffd98a', '#f2cf6a', [['giraffe', 2.4, -2.2, 0, -1], ['tree', 2.6, 2.4, 0, -2], ['sun', 1.3, 1.1, 3.1, -3], ['monkey', 1, 2, 0, 1.2]]],
  ['whale', '#7fd8fa', '#2fa0e2', [['boat', 1.7, -2.2, 0, -1.6], ['fish', 1, 2.3, 0.2, 1], ['cloud', 1.6, 2, 3, -3], ['crab', 0.9, -2, 0, 1.4], ['sun', 1.1, -1.6, 3.2, -3]]],
  ['rocket', '#35248a', '#cfc4f5', [['planet', 1.7, 2.2, 2.4, -2], ['star', 0.8, -2.3, 2.9, -1], ['robot', 1.4, -2.1, 0, 0.6], ['moon', 1, -0.9, 3.4, -3], ['gem', 0.7, 2.1, 0, 1.2]]],
  ['unicorn', '#ffd6ee', '#8fe0a0', [['rainbow', 4.2, 0.3, 0.9, -3.5], ['castle', 2.2, 2.4, 0, -1.6], ['butterfly', 0.9, -2.3, 2.3, 0], ['mushroom', 0.9, -2.2, 0, 1.2]]],
  ['dinosaur', '#bfe9ff', '#86d95c', [['tree', 2.8, -2.5, 0, -2], ['egg', 0.8, 2.2, 0, 1.3], ['cloud', 1.6, 1.7, 3.1, -3], ['rock', 1.2, 2.5, 0, -1], ['bird', 0.8, -1.2, 3, -1]]],
  ['train', '#ffe0c2', '#e8c48a', [['cactus', 1.7, -2.5, 0, -0.8], ['house', 1.9, 2.4, 0, -2], ['balloon', 1.5, -1.3, 2.4, -2], ['sun', 1.1, 1.3, 3.3, -3], ['horse', 1.1, 2.2, 0, 1.3]]],
  ['penguin', '#7fc8f7', '#dff1ff', [['igloo', 2.2, 2.2, 0, -1.4], ['fish', 0.8, -2.2, 0, 1.3], ['cloud', 1.5, -1.8, 3.1, -3], ['kite', 1.4, 1.6, 2.7, -1], ['gift', 0.9, -2.4, 0, -0.8]]],
  ['cow', '#aee4ff', '#86d95c', [['house', 2.1, -2.4, 0, -2], ['hen', 0.9, 2.2, 0, 1.3], ['sunflower', 1.7, 2.5, 0, -0.8], ['bee', 0.8, -1.4, 2.8, 0], ['sun', 1.2, 1.4, 3.2, -3]]],
];

/** One edge from (0,0) to (1,0) with a knob of height `s` (+ up, − down, 0 flat). */
function edge(s) {
  if (!s) return [[1, 0]];
  const knob = range(13).map((i) => { const a = Math.PI * (1.28 - (i / 12) * 1.56); return [0.5 + Math.cos(a) * 0.125, 0.145 + Math.sin(a) * 0.125]; });
  return [[0.39, 0], ...knob, [0.61, 0], [1, 0]].map(([x, y]) => [x, y * s]);
}

export default class JigsawGarden extends Game {
  static meta = { id: 'jigsaw-garden', tint: '#2fc77f', music: 'garden' };

  init() {
    this.cuts = CUTS[this.level];
    this.roundsTotal = this.cuts.length;
    this.view = { pos: V(0, 3.4, 18), look: V(0, 2.85, 0), fov: 30 };
    this.sway = 0.12;
    this.light({ span: 9, centre: [0, 2, 0], from: [-3, 6, 9] });
    sky(this);
    const lawn = new THREE.Group();
    lawn.position.y = -1.4;
    const stage = { scene: lawn, every: (f) => this.every(f), poke: (...a) => this.poke(...a) };
    ground(stage);
    greenery(stage, { x: [-20, 20], z: [-20, -14], trees: 9, bushes: 9, seed: 41 });
    lawn.add(build((b) => fence(b, -24, 24, -12.5)));
    this.scene.add(lawn);
    clouds(this, { y: [6, 10] });
    this.scene.add(build((b) => {
      b.box('#c9823c', [CENTRE.x, CENTRE.y, -0.3], [PIC_W + 0.5, PIC_H + 0.5, 0.3], { r: 0.14 });
      b.both((s) => b.rod('#9a6238', [CENTRE.x + s * 2.6, 1.2, -0.5], [CENTRE.x + s * 3.2, -1.4, -0.5], 0.11));
      b.box('#e8b878', [0.75, TRAY_Y, 0.3], [8.7, 1.82, 0.2], { r: 0.1 });
      b.box('#fff3d6', [0.75, TRAY_Y, 0.4], [8.4, 1.56, 0.06], { r: 0.03, ao: false, surf: 'bright' });
    }));
    this.addPal([-4.8, -1.4, 1.2], { size: 1.9, hat: 'sun-hat' });

    this.photo = new THREE.WebGLRenderTarget(960, 720, { samples: 4, colorSpace: THREE.SRGBColorSpace });
    this.face = new THREE.MeshBasicMaterial({ map: this.photo.texture });
    this.rim = new THREE.MeshBasicMaterial({ color: INK });
    this.canvas = new THREE.Mesh(new THREE.PlaneGeometry(PIC_W, PIC_H), new THREE.MeshBasicMaterial({ map: this.photo.texture, transparent: true, opacity: 0.3 }));
    Object.assign(this.canvas.userData, { owned: true, ownsMaterial: true });
    this.canvas.position.copy(CENTRE).setZ(-0.13);
    this.canvas.visible = false;
    this.scene.add(build((b) => b.box('#fffaf0', [CENTRE.x, CENTRE.y, -0.16], [PIC_W, PIC_H, 0.04], { r: 0.01, seg: 1, ink: false, surf: 'bright' })), this.canvas);
    this.blooms = 0;
  }

  /* ------------------------------------------------------------ the picture */

  stagePicture([hero, skyColor, groundColor, props]) {
    this.strike();
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(skyColor);
    const key = light(scene, { span: 5, shadows: this.engine.shadows });
    key.shadow.mapSize.set(1024, 1024);
    scene.add(build((b) => { b.ball(groundColor, [0, -9, -2], [26, 9, 20], { seg: 40 }); b.ball(groundColor, [-5, -1.2, -9], [7, 2.4, 3]); b.ball(groundColor, [6, -1.2, -10], [6, 2.8, 3]); }, { shadow: false }));
    const cast = [[hero, 2.9, 0, 0, 0.4], ...props].map(([name, size, ...p]) => {
      const t = new Toy(name, size);
      t.position.set(...p);
      scene.add(t);
      return t;
    });
    const camera = new THREE.PerspectiveCamera(30, PIC_W / PIC_H, 1, 80);
    camera.position.set(0, 2.6, 9.4);
    camera.lookAt(0, 1.75, 0);
    this.picture = { scene, camera, cast, key, alive: false, stale: true };
  }

  strike() {
    if (!this.picture) return;
    this.picture.scene.traverse((o) => { if (o.userData.owned) o.geometry.dispose(); });
    this.picture.key.shadow.dispose();
    this.picture = null;
  }

  beforeRender(renderer) {
    const p = this.picture;
    if (!p || !(p.alive || p.stale)) return;
    p.stale = false;
    renderer.setRenderTarget(this.photo);
    renderer.clear();
    renderer.render(p.scene, p.camera);
  }

  update(dt) { if (this.picture?.alive) for (const t of this.picture.cast) t.tick(dt, this.t); }

  /* ---------------------------------------------------------------- the cut */

  cut(cols, rows) {
    const w = PIC_W / cols, h = PIC_H / rows, k = Math.min(w, h);
    const rng = makeRng(randInt(1, 1e6));
    const sign = () => (rng() < 0.5 ? -1 : 1);
    // Each shared edge gets one knob direction, read by the pieces on both sides.
    const across = range(rows + 1).map((r) => range(cols).map(() => (r && r < rows ? sign() : 0)));
    const down = range(rows).map(() => range(cols + 1).map((c) => (c && c < cols ? sign() : 0)));
    const along = (len, s) => edge(s).map(([t, n]) => [len / 2 + (t - 0.5) * (t === 1 ? len : k), n * k]);
    return range(cols * rows).map((i) => {
      const c = i % cols, r = Math.floor(i / cols);
      const pts = [
        ...along(w, across[r + 1][c]).map(([t, n]) => [t - w / 2, -h / 2 + n]),            // bottom, left to right
        ...along(h, down[r][c + 1]).map(([t, n]) => [w / 2 + n, t - h / 2]),                // right, going up
        ...along(w, across[r][c]).map(([t, n]) => [w / 2 - t, h / 2 + n]),                  // top, right to left
        ...along(h, down[r][c]).map(([t, n]) => [-w / 2 + n, h / 2 - t]),                   // left, going down
      ];
      const geo = new THREE.ExtrudeGeometry(new THREE.Shape(pts.map(([x, y]) => new THREE.Vector2(x, y))), {
        depth: THICK, bevelEnabled: true, bevelSize: 0.028, bevelOffset: -0.028, bevelThickness: 0.01, bevelSegments: 1,
      });
      const home = V(CENTRE.x + (c + 0.5) * w - PIC_W / 2, CENTRE.y + PIC_H / 2 - (r + 0.5) * h, -0.1);
      const { position, uv } = geo.attributes;
      for (let v = 0; v < uv.count; v++) uv.setXY(v, (position.getX(v) + home.x - CENTRE.x) / PIC_W + 0.5, (position.getY(v) + home.y - CENTRE.y) / PIC_H + 0.5);
      const mesh = new THREE.Mesh(geo, [this.face, this.rim]);
      mesh.castShadow = true;
      mesh.userData.owned = true;
      const piece = new Toy(mesh, 0.4, { idle: 0 });
      return Object.assign(piece, { home, snap: k * 0.5, small: TRAY_SIZE / Math.max(w * 0.76, h), hotAt: V() });
    });
  }

  /* ----------------------------------------------------------------- rounds */

  async play() {
    const unseen = shuffle(SCENES);
    for (const [cols, rows] of this.cuts) {
      const scene = await this.pickPicture(unseen);
      this.stagePicture(scene);
      this.canvas.visible = true;
      this.canvas.material.opacity = 0.3;
      this.canvas.position.z = -0.13;
      this.audio.magic();
      this.waiting = shuffle(this.cut(cols, rows));
      this.placed = [];
      this.tray = new Array(TRAY_SLOTS).fill(null);
      this.refill();
      this.prompt('Finish the picture', `Drag the pieces to finish the ${scene[0]} picture!`);
      await this.ask();
      await this.comeAlive(scene[0]);
    }
    this.finish();
  }

  /** The child chooses what to build. */
  async pickPicture(unseen) {
    this.canvas.visible = false;
    const offer = sample(unseen, 3);
    const toys = this.offered = this.row(offer.map(([hero]) => new Toy(hero, 1.75)), { x: CENTRE.x, y: CENTRE.y - 0.9, z: 0.5, gap: 2.05 });
    toys.forEach((t, i) => this.hot(t, { r: 1, tap: () => { t.hop().spin(); this.audio.squeak(); this.resolve(i); } }));
    this.prompt('Pick a picture', 'Which picture shall we make?');
    const i = await this.ask();
    this.offered = null;
    toys.forEach((t, k) => this.vanish(t, k === i ? 0.5 : 0));
    await this.wait(0.8);
    return unseen.splice(unseen.indexOf(offer[i]), 1)[0];
  }

  /** Only a few pieces are out at once, so each stays big enough to grab. */
  refill() {
    const wide = Math.min(TRAY_SLOTS, this.waiting.length + this.tray.filter(Boolean).length + this.placed.length);
    this.tray.forEach((p, i) => {
      if (p || !this.waiting.length) return;
      const piece = this.tray[i] = this.waiting.pop();
      piece.rest = [CENTRE.x + (i - (wide - 1) / 2) * (wide > 2 ? 2.05 : 3), TRAY_Y, 0.8];
      piece.position.set(...piece.rest);
      this.scene.add(piece);
      this.appear(piece, i * 0.08, piece.small);
      this.hot(piece, {
        r: 0.85, when: () => !piece.done,
        tap: () => piece.hop(0.6).wiggle(0.4),
        // In the hand it is nearer the camera, so a touch under full size looks right.
        lift: () => this.scaleTo(piece, 0.94, 0.18),
        drop: () => this.dropped(piece),
      });
    });
  }

  dropped(piece) {
    if (this.gap(piece, piece.home) > piece.snap) {
      this.audio.swoop();
      this.scaleTo(piece, piece.small, 0.28);
      this.jump(piece, piece.rest, { height: 0.3, dur: 0.3 });
      return;
    }
    piece.done = true;
    this.tray[this.tray.indexOf(piece)] = null;
    this.placed.push(piece);
    this.scaleTo(piece, 1, 0.14);
    this.moveTo(piece, piece.home.toArray(), 0.14).then(() => piece.boing(0.5));
    this.audio.place();
    this.audio.step(this.placed.length);
    this.fx.sparkle(this.at(piece.home), 12, { spread: 3 });
    this.bloom();
    this.refill();
    if (!this.tray.some(Boolean)) this.resolve();
  }

  /** Every piece placed grows a flower. */
  bloom() {
    const n = this.blooms++, side = n % 2 ? 1 : -1, k = Math.floor(n / 2);
    const mesh = build((b) => flower(b, { petal: ['#ff8fd0', '#ffd23c', '#ffffff', '#c9a8ff', '#ff6b8b'][n % 5], face: true }));
    const f = new Toy(mesh, 1);
    f.position.set(CENTRE.x + side * (5.2 + (k % 3) * 1.1 + Math.floor(k / 3) * 0.35), -1.4, -5.5 - Math.floor(k / 3) * 1.4);
    this.scene.add(f);
    this.appear(f, 0.1, 1.7);
    this.poke(f, { r: 0.4, sound: 'squeak' });
  }

  async comeAlive(hero) {
    await this.wait(0.35);
    this.win(CENTRE);
    this.audio.magic();
    // The seamless picture fades in over the pieces, and starts to move.
    this.canvas.position.z = 0.1;
    this.canvas.material.opacity = 0;
    this.picture.alive = true;
    this.picture.cast.forEach((t) => { t.dancing = true; });
    await this.to(this.canvas.material, { opacity: 1 }, 0.6);
    this.remove(...this.placed);
    await this.wait(0.9);
    this.picture.cast[0].visible = false;
    const star = this.toy(hero, 2.6, [CENTRE.x, CENTRE.y - 1.7, 0.4]);
    this.audio.pop();
    this.fx.starBurst(this.at(star), 12);
    star.spin();
    await this.jump(star, [CENTRE.x, -1.15, 2.4], { height: 1.6, dur: 0.6 });
    star.dancing = true;
    await this.talk(`You finished the ${hero}!`, { min: 2.2 });
    this.vanish(star);
    await this.to(this.canvas.material, { opacity: 0 }, 0.4);
    this.picture.alive = false;
  }

  solution() {
    if (this.offered) return { tap: this.offered[0] };
    const piece = this.tray.find(Boolean);
    return piece && { drag: [piece, piece.home] };
  }

  nudgeChoices() { (this.offered || this.tray).forEach((p) => p?.wiggle(0.5)); }
  hint() { if (this.offered) this.replayPrompt(); else this.point(this.solution()); }

  destroy() {
    this.strike();
    this.photo.dispose();
    this.face.dispose();
    this.rim.dispose();
  }
}
