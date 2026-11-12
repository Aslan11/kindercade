/**
 * The runtime, and the `Game` base class every mini-game extends.
 *
 * Layers, back to front:
 *   1. the game's own 3D scene
 *   2. the overlay scene — particles, the pointing glove, the prize ceremony
 *   3. the DOM HUD
 *
 * Screen space
 * ------------
 * Touches and the overlay share one set of units: the origin is the centre of
 * the screen, y is up, and a landscape screen is always 9 units tall. A game
 * frames its action for a 12 × 9 window; wider screens simply see more scenery
 * at the sides and taller ones more sky, so there is no per-device layout.
 */

import * as THREE from './three.js';
import { createRenderer, light } from './stage.js';
import { FX } from './fx.js';
import { penWidth } from './kit.js';
import { Toy, Buddy } from './toy.js';
import { Tweens, Ease } from './anim.js';
import { audio } from './audio.js';
import { music } from './music.js';
import { progress, LEVELS } from './progress.js';
import { showResults } from './results.js';
import { clamp, lerp, pick, rand, approach } from './util.js';
import { PRAISE, ENCOURAGE } from '../data/words.js';

const VIEW_W = 12, VIEW_H = 9;
const MAX_DT = 1 / 20;      // a background tab must never explode the physics
const MIN_TOUCH = 0.52;     // nothing tappable is under ~100 logical px across
const TAP_SLOP = 0.22;      // how far a finger may wobble and still be a tap
const IDLE_HINT = 7;        // seconds of stillness before the glove helps out

const _v = new THREE.Vector3(), _w = new THREE.Vector3();
export const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);

/* ------------------------------------------------------------------- engine */

export class Engine {
  constructor(canvas, hud) {
    this.canvas = canvas;
    this.hud = hud;
    this.renderer = createRenderer(canvas);
    this.game = null;
    this.timeScale = 1;
    this.quality = clamp(window.devicePixelRatio || 1, 1, 2);
    this.shadows = true;

    this.ui = new THREE.Scene();
    this.uiCamera = new THREE.PerspectiveCamera(16, 1, 1, 200);
    light(this.ui, { shadows: false, from: [-3, 6, 9] });
    this.fx = new FX(this.ui);
    this.glove = new Glove(this);

    this._bindInput();
    // Watching the canvas itself sidesteps Safari's mid-rotation resize events.
    new ResizeObserver(() => { this.resize(); this.render(); }).observe(canvas);
    document.addEventListener('visibilitychange', () => { if (document.hidden) audio.stopSpeech(); this._last = 0; });
    // iPadOS may reclaim the GPU while we are in the background.
    canvas.addEventListener('webglcontextrestored', () => location.reload());
    this.resize();
    this.renderer.setAnimationLoop((now) => this._frame(now));
  }

  resize() {
    const w = Math.max(1, this.canvas.clientWidth), h = Math.max(1, this.canvas.clientHeight);
    this.unit = Math.min(h / VIEW_H, w / VIEW_W);     // CSS px per screen unit
    this.halfW = w / this.unit / 2;
    this.halfH = h / this.unit / 2;
    document.documentElement.style.fontSize = `${this.unit}px`;   // 1rem = 1 unit
    this.renderer.setPixelRatio(this.quality);
    this.renderer.setSize(w, h, false);
    this.uiCamera.aspect = w / h;
    this.uiCamera.position.z = this.halfH / Math.tan(THREE.MathUtils.degToRad(8));
    this.uiCamera.updateProjectionMatrix();
    this.game?._frameCamera();
    this.game?.resized();
  }

  /** Mount a Game subclass. Any previous one is destroyed first. */
  start(GameClass, opts = {}) {
    this.stop();
    this.game = new GameClass(this, opts);
    this.game._boot();
    this._last = 0;
    this._slow = { frames: -20, times: [] };
    this._tried = null;       // frame times from another scene prove nothing here
    return this.game;
  }

  stop() {
    // The island announces the game that was tapped; let it get the name out.
    audio.stopSpeech({ finishLine: this.game?.meta.id === 'home' });
    this.fx.clear();
    this.glove.hide();
    this.hud.reset();
    this._finger = null;
    this.game?._destroy();
    this.game = null;
  }

  _frame(now) {
    const raw = this._last ? (now - this._last) / 1000 : 0;
    this._last = now;
    const game = this.game;
    if (!game) return;
    this._adapt(raw);
    music.update();
    try {
      for (let i = 0; i < this.timeScale; i++) {
        const dt = Math.min(MAX_DT, raw);
        game._step(dt);
        if (this.game !== game) return;
        this.fx.step(dt);
        this.glove.step(dt);
        this.ui.traverseVisible((o) => o.tick?.(dt, game.t));
      }
      this.render();
    } catch (err) {
      console.error('[kindercade] game loop error', err);
      this.stop();
      location.hash = '#/';
    }
  }

  render() {
    const r = this.renderer, g = this.game;
    if (!g) return;
    g.beforeRender(r);
    r.setRenderTarget(null);
    r.clear();
    r.render(g.scene, g.camera);
    r.clearDepth();
    r.render(this.ui, this.uiCamera);
  }

  /**
   * On a struggling device, trade sharpness (then shadows) for smoothness. If a
   * trade buys nothing the GPU was never the problem — Low Power Mode caps the
   * frame rate, for one — so it is undone and not tried again.
   */
  _adapt(raw) {
    const s = this._slow;
    if (this._settled || ++s.frames <= 0) return;
    s.times.push(raw);
    if (s.times.length < 45) return;
    const typical = s.times.sort((a, b) => a - b)[22];      // the median shrugs off hitches
    const tried = this._tried;
    this._tried = null;
    if (tried && typical > tried.typical * 0.92) {
      this._settled = true;
      this._setQuality(tried.quality, tried.shadows);
    } else if (typical > 1 / 38 && (this.quality > 1 || this.shadows)) {
      this._tried = { typical, quality: this.quality, shadows: this.shadows };
      this._setQuality(Math.max(1, this.quality - 0.5), this.quality > 1);
    }
    this._slow = { frames: -10, times: [] };
  }

  _setQuality(quality, shadows) {
    Object.assign(this, { quality, shadows });
    if (this.game.key) this.game.key.castShadow = shadows;
    this.resize();
  }

  /** Photograph a toy against transparency, off screen; returns a small 2D canvas. */
  snapshot(name, size = 160, hat = '') {
    const r = this.renderer;
    if (!this._studio) {
      const scene = new THREE.Scene();
      light(scene, { shadows: false });
      const camera = new THREE.PerspectiveCamera(22, 1, 0.1, 20);
      camera.position.set(0, 1.05, 3.1);
      camera.lookAt(0, 0.48, 0);
      this._studio = { scene, camera, film: new THREE.WebGLRenderTarget(1, 1, { samples: 4, colorSpace: THREE.SRGBColorSpace }) };
    }
    const { scene, camera, film } = this._studio;
    const toy = new Toy(name, hat ? 0.84 : 1).wear(hat);
    toy.position.y = hat ? 0 : (1 - toy.height) / 2;
    scene.add(toy);
    film.setSize(size, size);
    r.setRenderTarget(film);
    r.setClearColor(0, 0);
    r.clear();
    const pen = penWidth.value;
    penWidth.value = 0.024;      // a close-up wants a bolder line
    r.render(scene, camera);
    penWidth.value = pen;
    const raw = new Uint8Array(size * size * 4);
    r.readRenderTargetPixels(film, 0, 0, size, size, raw);
    r.setRenderTarget(null);
    scene.remove(toy);

    const image = new ImageData(size, size), row = size * 4;
    for (let y = 0; y < size; y++) image.data.set(raw.subarray(y * row, (y + 1) * row), (size - 1 - y) * row);   // GL is bottom-up
    const out = Object.assign(document.createElement('canvas'), { width: size, height: size });
    out.getContext('2d').putImageData(image, 0, 0);
    return out;
  }

  /* ----------------------------------------------------------------- input */

  /** Client pixels -> screen units. */
  point(e) {
    return { x: e.clientX / this.unit - this.halfW, y: this.halfH - e.clientY / this.unit };
  }

  /** Screen units -> client pixels. */
  client(p) {
    return { x: (p.x + this.halfW) * this.unit, y: (this.halfH - p.y) * this.unit };
  }

  /**
   * Any finger may tap, but only one at a time may drag. A touch that lands on
   * nothing is not remembered at all, so a palm resting on the glass cannot
   * lock the child out.
   */
  _bindInput() {
    const opts = { passive: false };
    this.canvas.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      audio.unlock();
      if (this._finger != null || !this.game) return;
      if (this.game._down(this.point(e))) this._finger = e.pointerId;
    }, opts);
    window.addEventListener('pointermove', (e) => {
      if (e.pointerId !== this._finger) return;
      e.preventDefault();
      this.game?._move(this.point(e));
    }, opts);
    const up = (e) => {
      if (e.pointerId !== this._finger) return;
      this._finger = null;
      this.game?._up(this.point(e), e.type === 'pointercancel');
    };
    window.addEventListener('pointerup', up);
    window.addEventListener('pointercancel', up);
  }
}

/* -------------------------------------------------------------------- glove */

/** The pointing hand: shows a tap or a drag, a few times, then bows out. */
class Glove {
  constructor(engine) {
    this.engine = engine;
    this.node = new THREE.Group();
    const hand = new Toy('pointer', 1.25, { idle: 0 });
    hand.position.set(0.1, -1.25, 0);        // fingertip on the group's origin
    this.node.add(hand);
    this.node.rotation.z = 0.42;
    this.node.visible = false;
    engine.ui.add(this.node);
  }

  /** @param {Array<() => {x,y}>} stops one stop for a tap, two for a drag, more for a path */
  show(stops) { this.stops = stops; this.t = 0; this.node.visible = true; this.rang = -1; }
  hide() { this.node.visible = false; }

  step(dt) {
    if (!this.node.visible) return;
    this.t += dt;
    const drag = this.stops.length > 1;
    const period = this.stops.length > 2 ? 2.8 : drag ? 2 : 1.1;
    const lap = Math.floor(this.t / period), k = (this.t % period) / period;
    if (lap >= (this.stops.length > 2 ? 1 : 3)) { this.hide(); return; }
    let p = this.stops[0]();
    let press = Math.sin(clamp((k - 0.2) / 0.4, 0, 1) * Math.PI);
    if (drag) {
      const u = Ease.inOutQuad(clamp((k - 0.2) / 0.62, 0, 1)) * (this.stops.length - 1);
      const i = Math.min(this.stops.length - 2, Math.floor(u));
      const a = this.stops[i](), b = this.stops[i + 1]();
      p = { x: lerp(a.x, b.x, u - i), y: lerp(a.y, b.y, u - i) };
      press = clamp(Math.min(k / 0.18, (1 - k) / 0.14), 0, 1);
    }
    if (press > 0.9 && this.rang !== lap) { this.rang = lap; this.engine.fx.ring(p, { r: 0.8 }); }
    const away = (1 - press) * 0.32;
    this.node.position.set(p.x + away * 0.45, p.y - away, 3);
    this.node.scale.setScalar(clamp(this.t * 6, 0, 1) * (1 - press * 0.1));
  }
}

/* ---------------------------------------------------------- Game base class */

export class Game {
  /** Subclasses declare: static meta = { id, tint, music } */
  static meta = { id: 'game', tint: '#9b6cff', music: 'home' };

  constructor(engine, opts = {}) {
    this.engine = engine;
    this.opts = opts;
    this.hud = engine.hud;
    this.fx = engine.fx;
    this.audio = audio;
    this.tweens = new Tweens();
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(30, 1, 0.5, 400);
    this.view = { pos: V(0, 5, 17), look: V(0, 2.4, 0), fov: 30 };
    this.sway = 0.25;         // how much the camera drifts, for a sense of depth
    this.t = 0;

    this.level = opts.level || 1;
    this.roundsTotal = 6;
    this.roundsDone = 0;
    this.mistakes = 0;
    this.streak = 0;
    this.tries = 0;           // misses on the current question
    this.asked = 0;           // questions put so far, to keep the stars in proportion
    this.busy = true;         // true while taps on answers should be ignored
    this.finished = false;

    this._hots = [];
    this._every = [];
    this._overlay = [];
    this._idle = 0;
    this._intro = 1;
  }

  get meta() { return this.constructor.meta; }
  get tint() { return this.meta.tint; }

  /* ----------------------------------------------------------- lifecycle */

  /** Build the world. */
  init() {}
  /** The game itself, start to finish. Call `finish()` at the end. */
  async play() {}
  update(_dt) {}
  /** Hook for render-to-texture work. */
  beforeRender(_renderer) {}
  resized() {}
  destroy() {}

  _boot() {
    this.init();
    this._frameCamera();
    this.showHud();
    music.play(this.meta.music);
    this.wait(0.7).then(() => this.play()).catch((err) => console.error('[kindercade]', err));
  }

  showHud() {
    this.hud.show({
      total: this.roundsTotal, level: this.level, tint: this.tint,
      onHome: () => this.exit(), onSpeak: () => this.replayPrompt(),
    });
  }

  _destroy() {
    this.destroy();
    this.tweens.cancel();
    this.remove(...this._overlay, this.scene);
    this.key?.shadow.dispose();
  }

  /** Light the scene. `span` is the half-width that needs shadows. */
  light(opts) {
    this.key = light(this.scene, opts);
    this.key.castShadow = this.engine.shadows;
  }

  _frameCamera() {
    const { halfW, halfH } = this.engine;
    const half = Math.tan(THREE.MathUtils.degToRad(this.view.fov / 2)) * (halfH / (VIEW_H / 2));
    this.camera.fov = THREE.MathUtils.radToDeg(Math.atan(half)) * 2;
    this.camera.aspect = halfW / halfH;
    this.camera.updateProjectionMatrix();
    this._aim();
  }

  _aim() {
    const { pos, look } = this.view;
    const swoop = Ease.inOutCubic(this._intro);
    const shake = this.fx.shake * 0.07;
    this.camera.position.set(
      pos.x + Math.sin(this.t * 0.23) * this.sway + rand(-shake, shake),
      pos.y + Math.sin(this.t * 0.31) * this.sway * 0.4 + swoop * 3 + rand(-shake, shake),
      pos.z + swoop * 5,
    );
    this.camera.lookAt(look);
    this.camera.updateMatrixWorld();
  }

  _step(dt) {
    this.t += dt;
    this._intro = Math.max(0, this._intro - dt / 1.1);
    this._aim();
    this.tweens.step(dt);
    for (const fn of this._every) fn(dt, this.t);
    this.update(dt);
    this.scene.traverseVisible((o) => o.tick?.(dt, this.t));
    if (this._held) this._carry(dt);
    if (this.busy || this._held || audio.speaking) this._idle = 0;
    else if ((this._idle += dt) > IDLE_HINT) { this._idle = -6; this.hint(); }
  }

  /** Run `fn(dt, t)` every frame for the life of the game. */
  every(fn) { this._every.push(fn); }

  /* -------------------------------------------------------------- building */

  /** Add a toy to the scene. */
  toy(name, size = 1, pos = null, parent = this.scene) {
    const t = new Toy(name, size);
    if (pos) t.position.set(...pos);
    parent.add(t);
    return t;
  }

  /** Put the child's buddy in the scene. A hat they chose beats the game's costume. */
  addPal(pos, { size = 2.3, hat = '', parent = this.scene } = {}) {
    this.pal = new Buddy(progress.buddy, size).wear(progress.hat || hat);
    this.pal.position.set(...pos);
    parent.add(this.pal);
    this.hot(this.pal, {
      r: size * 0.36, poke: true,
      tap: () => { this.pal.feel('wave', 1.2).hop(0.2); audio.giggle(); this.fx.love(this.at(this.pal), 3); },
    });
    return this.pal;
  }

  /** Add something to the screen-space overlay; it is removed with the game. */
  overlay(obj) { this.engine.ui.add(obj); this._overlay.push(obj); return obj; }

  /** Take something out of the world for good. */
  remove(...objs) {
    for (const o of objs) {
      o.removeFromParent();
      o.traverse((c) => {
        if (c.userData.owned) c.geometry.dispose();
        if (c.userData.ownsMaterial) c.material.dispose();
      });
    }
  }

  /* --------------------------------------------------------------- motion */

  wait(s) { return this.tweens.wait(s); }
  to(target, props, dur, opts) { return this.tweens.to(target, props, dur, opts); }

  moveTo(obj, [x, y, z], dur = 0.4, opts) {
    this.tweens.cancel(obj.position);
    obj.flight = null;
    return this.to(obj.position, { x, y, z }, dur, opts);
  }

  scaleTo(obj, k, dur = 0.3, opts) {
    this.tweens.cancel(obj.scale);
    return this.to(obj.scale, { x: k, y: k, z: k }, dur, opts);
  }

  /** Pop into existence. */
  appear(obj, delay = 0, k = 1) {
    obj.scale.setScalar(0.001);
    return this.scaleTo(obj, k, 0.42, { delay, ease: Ease.outBack });
  }

  /** Shrink away and leave the scene. */
  async vanish(obj, delay = 0) {
    obj.gone = true;
    await this.scaleTo(obj, 0.001, 0.26, { delay, ease: Ease.inBack });
    this.remove(obj);
  }

  /** Leap to a spot along an arc, landing with a squash. */
  async jump(obj, [x, y, z], { height = 1.4, dur = 0.5, delay = 0 } = {}) {
    this.tweens.cancel(obj.position);
    if (delay) await this.wait(delay);
    const from = obj.position.clone();
    const flight = obj.flight = { k: 0 };
    await this.to(flight, { k: 1 }, dur, {
      ease: Ease.linear,
      onUpdate: (k) => {
        if (obj.flight !== flight) return;    // a newer jump has taken over
        obj.position.set(lerp(from.x, x, k), lerp(from.y, y, k) + 4 * height * k * (1 - k), lerp(from.z, z, k));
      },
    });
    if (obj.flight !== flight) return;
    obj.flight = null;
    obj.boing?.(0.9);
  }

  /* ---------------------------------------------------------------- space */

  /** Where something is on screen: an object, a world point, or already a screen point. */
  at(thing) {
    if (thing.isObject3D) {
      if (thing.parent === this.engine.ui) return { x: thing.position.x, y: thing.position.y + (thing.height || 0) / 2 };
      thing.getWorldPosition(_v);
      if (thing.hotAt) _v.add(thing.hotAt); else _v.y += (thing.height || 0) * thing.scale.y / 2;
    } else if (thing.isVector3) _v.copy(thing);
    else return thing;
    _v.project(this.camera);
    return { x: _v.x * this.engine.halfW, y: _v.y * this.engine.halfH };
  }

  /** On-screen distance between two things. */
  gap(a, b) { const p = this.at(a), q = this.at(b); return Math.hypot(p.x - q.x, p.y - q.y); }

  /** The world point under a screen point, on a given plane. */
  onPlane(p, plane, out = V()) {
    _w.set(p.x / this.engine.halfW, p.y / this.engine.halfH, 0.5).unproject(this.camera).sub(this.camera.position).normalize();
    return new THREE.Ray(this.camera.position, _w).intersectPlane(plane, out) || out;
  }

  /* ---------------------------------------------------------------- touch */

  /**
   * Make an object touchable.
   *
   *   r / box   hit radius, or [halfWidth, halfHeight], in world units
   *   flat      the box lies on the floor (its height runs along z)
   *   at        offset from the object's origin to the middle of the target
   *   tap       fires the instant a finger lands (or on lift, if draggable)
   *   drop      makes it draggable; called with the object when it is let go
   *   lift      called when a drag begins
   *   when      () => boolean, to switch it off for now
   *   poke      scenery: works even while busy, and loses ties to real targets
   */
  hot(obj, o) {
    if (o.at) obj.hotAt = V(...o.at);
    this._hots.push({ obj, r: 0.6, ...o });
    return obj;
  }

  /** Scenery that wiggles and makes a noise when prodded. */
  poke(obj, { sound = 'boing', ...o } = {}) {
    return this.hot(obj, { ...o, poke: true, tap: () => { obj.boing().wiggle(); audio[sound](); this.fx.sparkle(this.at(obj), 5); } });
  }

  _pick(p) {
    const root = (o) => (o.parent ? root(o.parent) : o);
    this._hots = this._hots.filter((h) => root(h.obj) === this.scene);
    let best = null, bestScore = Infinity;
    const right = V().setFromMatrixColumn(this.camera.matrixWorld, 0);
    for (const h of this._hots) {
      if (h.obj.gone || !h.obj.visible || (this.busy && !h.poke) || (h.when && !h.when())) continue;
      const c = this.at(h.obj);
      const world = _v.clone().unproject(this.camera);
      const reach = (axis, len) => Math.max(MIN_TOUCH, this.gap(c, world.clone().addScaledVector(axis, len)));
      const dx = Math.abs(p.x - c.x), dy = Math.abs(p.y - c.y);
      let score = h.box
        ? Math.max(dx / reach(right, h.box[0]), dy / reach(h.flat ? V(0, 0, 1) : V(0, 1, 0), h.box[1]))
        : Math.hypot(dx, dy) / reach(right, h.r);
      if (score > 1) continue;
      if (h.poke) score += 10;
      if (score < bestScore) { best = h; bestScore = score; }
    }
    return best;
  }

  /** Raw pointer hooks. Return true from `onDown` to own the gesture. */
  onDown(_p) { return false; }
  onMove(_p) {}
  onUp(_p) {}

  _down(p) {
    this._idle = 0;
    this.engine.glove.hide();
    if (this.pal) this.pal.lookTo = clamp((p.x - this.at(this.pal).x) * 0.1, -0.55, 0.55);
    if (this.modal) { this.modal(p); return false; }
    if (this.onDown(p)) { this._raw = true; return true; }
    const h = this._pick(p);
    if (!h) { this.fx.sparkle(p, 4, { color: '#ffffff', spread: 1.2 }); return false; }
    if (!h.drop) { h.tap?.(h.obj, p); return false; }
    this._held = { h, from: p, p, moved: false };
    h.obj.boing?.(0.6);
    return true;
  }

  _move(p) {
    if (this._raw) { this.onMove(p); return; }
    const d = this._held;
    if (!d) return;
    d.p = p;
    if (d.moved || Math.hypot(p.x - d.from.x, p.y - d.from.y) < TAP_SLOP) return;
    // The drag begins: carry the object on a sheet of glass facing the camera,
    // a little nearer than where it lay so it passes over its neighbours.
    const obj = d.h.obj;
    d.moved = true;
    this.tweens.cancel(obj.position);
    obj.flight = null;
    d.h.lift?.(obj);
    const toCam = this.camera.getWorldDirection(V()).negate();
    const c = this.at(obj.getWorldPosition(V()));
    d.plane = new THREE.Plane().setFromNormalAndCoplanarPoint(toCam, obj.getWorldPosition(V()).addScaledVector(toCam, 1.6));
    d.grab = { x: c.x - d.from.x, y: c.y - d.from.y };
    d.rise = 0;
    audio.pick();
  }

  _carry(dt) {
    const d = this._held;
    if (!d.moved) return;
    d.rise = approach(d.rise, 0.3, 10, dt);     // float just above the fingertip
    const target = this.onPlane({ x: d.p.x + d.grab.x, y: d.p.y + d.grab.y + d.rise }, d.plane);
    d.h.obj.parent.worldToLocal(target);
    d.h.obj.position.lerp(target, 1 - Math.exp(-26 * dt));
  }

  _up(p, cancelled) {
    if (this._raw) { this._raw = false; this.onUp(p); return; }
    const d = this._held;
    if (!d) return;
    if (d.moved) { d.p = cancelled ? d.p : p; this._carry(1); }
    this._held = null;
    if (d.moved) d.h.drop(d.h.obj);
    else if (!cancelled && !this.busy) d.h.tap?.(d.h.obj, p);
  }

  /* --------------------------------------------------------------- talking */

  /**
   * Set the instruction and say it. `text` is for a grown-up to read; `speech`
   * (a line, or a list of lines) is what the child hears. Keep them apart
   * whenever the text would give the answer away.
   */
  prompt(text, speech = text) {
    this.speech = speech;
    this._praise = null;
    this.hud.prompt(text);
    return audio.say(speech);
  }

  /** The 🔊 button. */
  replayPrompt() {
    audio.stopSpeech();
    if (this.speech) audio.say(this.speech);
    this.pal?.feel('wave', 1);
    if (!this.busy) this.nudgeChoices();
  }

  /**
   * Say something and wait for it. `min` keeps a moment on screen even with the
   * voice off; `max` means broken speech can never hold a round open. Praise
   * left by `win()` rides on the end of the next line, so it never talks over it.
   */
  talk(lines, opts) {
    const praise = this._praise;
    this._praise = null;
    return this.settle(audio.say([].concat(lines, praise || [])), opts);
  }

  settle(spoken, { min = 0.9, max = 7 } = {}) {
    // Leaving a game cancels its speech, which resolves `spoken`. The last tick
    // of the game's own clock is what stops a dead game from carrying on.
    return Promise.all([this.wait(min), Promise.race([spoken, this.wait(max)])]).then(() => this.wait(0));
  }

  /* ----------------------------------------------------------------- hints */

  /**
   * The right thing to do next: `{ tap: thing }`, or `{ drag: [from, …, to] }`.
   * Shown after two misses — and it is how the test suite plays the game.
   */
  solution() { return this._right ? { tap: this._right } : null; }

  /** Draw the eye to whatever can be touched, without giving the answer away. */
  nudgeChoices() { this.choices?.forEach((c, i) => this.tweens.after(i * 0.12, () => c.hop(0.25))); }

  /** A stalled child hears the question again. Override to point when pointing is no spoiler. */
  hint() { this.replayPrompt(); }

  point(move) {
    if (!move) return;
    this.engine.glove.show((move.drag || [move.tap]).map((thing) => () => this.at(thing)));
  }

  /* -------------------------------------------------------------- feedback */

  /** Hand control to the child and wait for `resolve()`. */
  ask() {
    this.busy = false;
    this._idle = 0;
    return new Promise((done) => { this._answer = done; });
  }

  resolve(value) {
    this.busy = true;
    this.engine.glove.hide();
    const done = this._answer;
    this._answer = null;
    done?.(value);
  }

  /**
   * The everyday question: offer some toys, wait until `right` is tapped.
   * `wrong(toy)` may return the line to say; the toys stay for another go.
   */
  async choose(toys, right, { wrong = null, r = null } = {}) {
    this.asked++;
    this.choices = toys;
    this._right = right;
    for (const toy of toys) {
      this.hot(toy, {
        r: r ?? toy.size * 0.56, choice: true,
        tap: () => { if (toy === right) { toy.boing(); this.resolve(); } else this.miss(toy, wrong?.(toy)); },
      });
    }
    await this.ask();
    this._hots = this._hots.filter((h) => !h.choice);
    this.choices = this._right = null;
    return right;
  }

  /** Pop a row of toys up out of the ground, centred on x. */
  row(toys, { x = 0, y = 0, z = 4.4, gap = 1.75 } = {}) {
    toys.forEach((toy, i) => {
      toy.position.set(x + (i - (toys.length - 1) / 2) * gap, y, z);
      this.scene.add(toy);
      this.appear(toy, i * 0.09);
      this.tweens.after(i * 0.09, () => audio.plop());
    });
    return toys;
  }

  /** A round is won: chime, sparkle, and a star flies up to the progress bar. */
  win(where, { quiet = false } = {}) {
    const p = this.at(where);
    this.streak = this.tries === 0 ? this.streak + 1 : 0;
    this.tries = 0;
    audio.correct(this.streak);
    this.fx.starBurst(p, 9);
    this.fx.sparkle(p, 14, { spread: 3 });
    this.fx.ring(p, { color: '#fff3b0', r: 2 });
    this.pal?.feel('cheer', 1.5);
    const praise = pick(PRAISE);
    if (this.roundsDone % 2 === 0) this._praise = praise;
    if (this.streak >= 3) {
      this.fx.confetti(p, 30, { up: 1 });
      this.pal?.spin();
      this.hud.shout(`${this.streak} in a row!`, true);
    } else if (!quiet) this.hud.shout(praise);
    this._flyStar(p, this.roundsDone++);
  }

  async _flyStar(from, index) {
    const star = this.overlay(new Toy('star', 0.7));
    const to = this.engine.point(this.hud.pipCentre(index));
    star.position.set(from.x, from.y, 2);
    star.spin();
    this.scaleTo(star, 0.55, 0.75);
    await this.jump(star, [to.x, to.y - 0.2, 0], { height: 0.9, dur: 0.75 });
    this._overlay.splice(this._overlay.indexOf(star), 1);
    star.removeFromParent();
    this.hud.fill(index);
    audio.coin();
    this.fx.sparkle(to, 8);
  }

  /**
   * Not quite. Never punishing — and after two goes the glove shows the way,
   * so every round ends in a win.
   */
  miss(obj, say = pick(ENCOURAGE)) {
    this.mistakes++;
    this.tries++;
    audio.wrong();
    obj?.wiggle?.(1.4);
    this.pal?.feel('oops', 1.1);
    if (say) audio.say(say, { delay: 0.3 });
    const open = this._answer;
    if (this.tries >= 2) this.tweens.after(0.9, () => { if (!this.busy && this._answer === open) this.point(this.solution()); });
  }

  /** Act out why an answer was wrong, with the child's hands off, then hand back. */
  async demonstrate(show) {
    this.busy = true;
    await show();
    this.busy = false;
    if (this.tries >= 2) this.point(this.solution());
  }

  /** A slip or two is still a three-star game — more where a round holds many questions. */
  starsEarned() {
    if (this.mistakes <= Math.max(1, this.asked * 0.12)) return 3;
    return this.mistakes <= Math.max(this.roundsTotal * 0.6, this.asked * 0.35) ? 2 : 1;
  }

  /** The whole game is complete: bank it and start the party. */
  finish() {
    if (this.finished) return;
    this.finished = true;
    this._praise = null;
    this.busy = true;
    const stars = this.starsEarned();
    const result = progress.recordRound(this.meta.id, this.level, stars);
    const hasNext = this.level < LEVELS && this.level < progress.levelFor(this.meta.id);
    if (this.pal) this.pal.dancing = true;
    showResults(this, { stars, hasNext, ...result });
  }

  goTo(level) { this.opts.onReplay?.(level); }
  exit() { location.hash = '#/'; }
}
