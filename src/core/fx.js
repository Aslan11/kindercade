/**
 * Particles: the layer that makes a right answer *feel* like a win.
 *
 * Everything lives in the screen-space overlay scene, drawn over the game, in
 * a handful of instanced meshes — so a hundred bits of confetti cost one draw
 * call. Positions are overlay units (100 logical pixels each).
 */

import * as THREE from './three.js';
import { Shapes, pillowGeo } from './kit.js';
import { text3d } from './glyphs.js';
import { TAU, rand, pick } from './util.js';

export const PARTY = ['#ff6b8b', '#ffc93c', '#4cc9f0', '#3ddc97', '#9b6cff', '#ff8fd0', '#ff9f1c'];
const CAP = 220;
const _o = new THREE.Object3D();
const _c = new THREE.Color();

class Pool {
  constructor(scene, geo, material) {
    this.mesh = new THREE.InstancedMesh(geo, material, CAP);
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.mesh.setColorAt(0, _c.set('#ffffff'));
    this.mesh.frustumCulled = false;
    this.mesh.count = 0;
    this.mesh.renderOrder = 5;
    this.list = [];
    scene.add(this.mesh);
  }

  emit(p) {
    if (this.list.length >= CAP) this.list.shift();
    this.list.push({ age: 0, z: rand(0.4, 1.2), vz: 0, rx: rand(0, TAU), rz: rand(0, TAU), sx: 0, sz: 0, drag: 1.6, grav: 14, grow: 0, ...p });
  }

  step(dt) {
    if (!this.list.length && !this.mesh.count) return;
    let n = 0;
    for (const p of this.list) {
      p.age += dt;
      if (p.age >= p.life) continue;
      const drag = Math.exp(-p.drag * dt);
      p.vx *= drag;
      p.vy = p.vy * drag - p.grav * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.rx += p.sx * dt;
      p.rz += p.sz * dt;
      const t = p.age / p.life;
      // Pop in fast, shrink away at the end — no transparency to sort.
      const k = p.size * (1 + p.grow * t) * Math.min(1, t * 14) * Math.min(1, (1 - t) * 3.5);
      _o.position.set(p.x, p.y, p.z);
      _o.rotation.set(p.rx, 0, p.rz);
      _o.scale.setScalar(k);
      _o.updateMatrix();
      this.mesh.setMatrixAt(n, _o.matrix);
      this.mesh.setColorAt(n, _c.set(p.color));
      this.list[n++] = p;
    }
    this.list.length = n;
    this.mesh.count = n;
    this.mesh.instanceMatrix.needsUpdate = true;
    this.mesh.instanceColor.needsUpdate = true;
  }
}

export class FX {
  constructor(scene) {
    this.scene = scene;
    const lit = new THREE.MeshToonMaterial();
    const bright = new THREE.MeshBasicMaterial();
    this.paper = new Pool(scene, new THREE.BoxGeometry(1, 0.6, 0.06), lit);
    this.stars = new Pool(scene, pillowGeo(Shapes.star(0.6, 0.32, 5, 0.1), 0.3, { curve: 2, rings: 2 }), lit);
    this.hearts = new Pool(scene, pillowGeo(Shapes.heart(0.5), 0.34, { curve: 5, rings: 3 }), lit);
    this.balls = new Pool(scene, new THREE.SphereGeometry(0.5, 10, 8), lit);
    this.twinkles = new Pool(scene, new THREE.ShapeGeometry(Shapes.star(0.7, 0.13, 4, 0.02), 1), bright);
    this.pools = [this.paper, this.stars, this.hearts, this.balls, this.twinkles];
    this.ringGeo = new THREE.RingGeometry(0.86, 1, 40);
    this.rings = [];
    this.floaters = [];
    this.shake = 0;
  }

  clear() {
    for (const p of this.pools) p.list.length = 0;
    for (const r of this.rings) r.age = r.life;
    for (const f of this.floaters) f.age = f.life;
    this.shake = 0;
  }

  /** Throw `n` particles outward from `at`, each customised by `make()`. */
  _burst(pool, at, n, [lo, hi], make, up = 0) {
    for (let i = 0; i < n; i++) {
      const a = up ? Math.PI / 2 + rand(-up, up) : rand(0, TAU);
      const v = rand(lo, hi);
      pool.emit({ x: at.x, y: at.y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, ...make() });
    }
  }

  confetti(at, n = 40, { up = 0, colors = PARTY } = {}) {
    this._burst(this.paper, at, n, [3, 11], () => ({
      size: rand(0.13, 0.22), color: pick(colors), life: rand(1.2, 2.1), sx: rand(-12, 12), sz: rand(-8, 8), drag: 2.4, grav: 9,
    }), up);
  }

  /** Confetti drifting down across the whole screen. */
  rain(halfW, halfH, n = 110) {
    for (let i = 0; i < n; i++) {
      this.paper.emit({
        x: rand(-halfW, halfW), y: halfH + rand(0.2, 5), vx: rand(-0.8, 0.8), vy: rand(-3, -1.5),
        size: rand(0.14, 0.24), color: pick(PARTY), life: rand(3, 4.6), sx: rand(-9, 9), sz: rand(-5, 5), drag: 0.9, grav: 3,
      });
    }
  }

  starBurst(at, n = 10, color = null) {
    this._burst(this.stars, at, n, [4, 9], () => ({
      size: rand(0.22, 0.4), color: color || pick(['#ffd23c', '#ffe27a', '#ffb52e']), life: rand(0.8, 1.3), rx: 0, sz: rand(-8, 8),
    }), 1.2);
  }

  love(at, n = 6) {
    this._burst(this.hearts, at, n, [1.2, 3], () => ({
      size: rand(0.24, 0.4), color: pick(['#ff4d78', '#ff8fb0', '#ff6b8b']), life: rand(1, 1.6), rx: 0, rz: rand(-0.4, 0.4), grav: -1.6, drag: 1.8,
    }), 0.9);
  }

  sparkle(at, n = 12, { color = '#fff3b0', spread = 2.2 } = {}) {
    this._burst(this.twinkles, at, n, [0.4, spread], () => ({
      size: rand(0.16, 0.36), color, life: rand(0.45, 0.9), rx: 0, sz: rand(-3, 3), grav: 0.3, drag: 2, z: 1.4,
    }));
  }

  puff(at, n = 8, { color = '#ffffff', spread = 1.8, size = 0.3, rise = 1 } = {}) {
    this._burst(this.balls, at, n, [0.4, spread], () => ({
      size: rand(size * 0.6, size * 1.2), color, life: rand(0.45, 0.85), grav: -rise, drag: 3, grow: 0.9,
    }));
  }

  crumbs(at, n = 8, color = '#c98f4c') {
    this._burst(this.balls, at, n, [1.5, 4], () => ({ size: rand(0.07, 0.14), color, life: rand(0.5, 0.8) }));
  }

  /** An expanding shockwave — the "pop". */
  ring(at, { color = '#ffffff', r = 1.4, life = 0.4 } = {}) {
    let ring = this.rings.find((x) => x.age >= x.life);
    if (!ring) {
      ring = { mesh: new THREE.Mesh(this.ringGeo, new THREE.MeshBasicMaterial({ transparent: true, depthTest: false })) };
      ring.mesh.renderOrder = 6;
      this.scene.add(ring.mesh);
      this.rings.push(ring);
    }
    Object.assign(ring, { age: 0, life, r });
    ring.mesh.material.color.set(color);
    ring.mesh.position.set(at.x, at.y, 0.5);
    ring.mesh.visible = true;
  }

  /** A number or letter that pops up and floats away. */
  floatText(at, str, { color = '#ffffff', size = 0.7, life = 1.1 } = {}) {
    const mesh = text3d(str, { height: size, color, weight: 0.13, shadow: false });
    mesh.position.set(at.x, at.y, 1.6);
    this.scene.add(mesh);
    this.floaters.push({ mesh, age: 0, life, y: at.y });
  }

  /** Camera shake. Keep it gentle — this is a five-year-old's game. */
  addShake(k = 1) { this.shake = Math.min(1.5, this.shake + k); }

  step(dt) {
    for (const p of this.pools) p.step(dt);
    for (const r of this.rings) {
      if (!r.mesh.visible) continue;
      r.age += dt;
      const t = Math.min(1, r.age / r.life);
      r.mesh.scale.setScalar(0.1 + r.r * (1 - (1 - t) ** 3));
      r.mesh.material.opacity = (1 - t) * 0.9;
      r.mesh.visible = t < 1;
    }
    this.floaters = this.floaters.filter((f) => {
      f.age += dt;
      const t = f.age / f.life;
      if (t >= 1) { f.mesh.removeFromParent(); return false; }
      f.mesh.position.y = f.y + 1.1 * (1 - (1 - t) ** 2);
      f.mesh.scale.setScalar(Math.min(1, t * 8) * Math.min(1, (1 - t) * 4) * (1 + Math.max(0, 0.25 - t)));
      return true;
    });
    this.shake = Math.max(0, this.shake - dt * 4);
  }
}
