/**
 * Toys: models brought to life.
 *
 * A `Toy` is a group the game is free to place, plus an inner layer that does
 * all the acting — breathing, blinking, squash and stretch, hops and wiggles —
 * so gameplay tweens and personality never fight over the same transform.
 */

import * as THREE from './three.js';
import { Builder, instantiate, toyMaterial } from './kit.js';
import { text3d } from './glyphs.js';
import { template } from '../models/index.js';
import { shapeMesh } from '../models/shapes.js';
import { Spring } from './anim.js';
import { audio } from './audio.js';
import { music } from './music.js';
import { TAU, rand, clamp, approach } from './util.js';

const FLUTTER = new Set(['butterfly', 'moth', 'bat']);

export class Toy extends THREE.Group {
  /** @param {string|THREE.Object3D} source a model name, or something already built */
  constructor(source, size = 1, { idle = 1, material } = {}) {
    super();
    this.act = new THREE.Group();
    this.add(this.act);
    this.parts = {};
    this.anchors = {};
    if (typeof source === 'string') {
      const t = template(source);
      const made = instantiate(t, { material });
      made.root.scale.setScalar(size);
      this.act.add(made.root);
      Object.assign(this, { kind: source, parts: made.parts, anchors: made.anchors, height: t.size.y * size, width: t.size.x * size });
    } else {
      this.act.add(source);
      Object.assign(this, { kind: '', parts: source.parts || {}, anchors: source.anchors || {}, height: size, width: size });
    }
    this.size = size;
    this.idle = idle;
    this.phase = rand(0, TAU);
    this.squash = new Spring(0, 240, 12);
    this.tilt = new Spring(0, 170, 9);
    this.hopT = 1; this.hopH = 0; this.hopDur = 0.4;
    this.spinT = 1;
    this.blinkIn = rand(0.5, 4);
    this.dancing = false;
    this.float = 0;       // amplitude of a slow hover, in world units
  }

  /** Squash-and-stretch kick. */
  boing(k = 1) { this.squash.velocity -= 5 * k; return this; }
  /** A side-to-side shake — "not me", or "look at me". */
  wiggle(k = 1) { this.tilt.velocity += 7 * k; return this; }
  hop(h = 0.5, dur = 0.42) { this.hopT = 0; this.hopH = h * this.size; this.hopDur = dur; this.squash.velocity += 3; return this; }
  spin() { this.spinT = 0; return this; }

  /** Pop a hat on (any hat model name), or take it off. */
  wear(name) {
    if (this.hat) this.hat.removeFromParent();
    this.hat = null;
    if (!name || !this.anchors.hat) return this;
    this.hat = instantiate(template(name)).root;
    this.hat.scale.setScalar(name === 'party-hat' || name === 'chef-hat' ? 0.4 : 0.44);
    this.hat.rotation.set(-0.12, 0, 0.1);
    this.anchors.hat.add(this.hat);
    return this;
  }

  tick(dt, t) {
    const a = this.act, p = this.parts;
    const ph = t + this.phase;
    let y = this.float ? Math.sin(ph * 1.5) * this.float : 0;
    let roll = this.tilt.step(dt);
    let s = this.squash.step(dt) + Math.sin(ph * 2.4) * 0.018 * this.idle;

    if (this.hopT < 1) {
      this.hopT = Math.min(1, this.hopT + dt / this.hopDur);
      y += 4 * this.hopH * this.hopT * (1 - this.hopT);
      if (this.hopT === 1) this.boing(0.7);
    }
    if (this.dancing) {
      const b = (t / music.beat) * Math.PI;
      y += Math.abs(Math.sin(b)) * 0.14 * this.size;
      roll += Math.sin(b) * 0.16;
      s += Math.cos(b * 2) * -0.05;
    }
    if (this.spinT < 1) {
      this.spinT = Math.min(1, this.spinT + dt / 0.6);
      a.rotation.y = (1 - (1 - this.spinT) ** 3) * TAU;
    }
    s = clamp(s, -0.45, 0.5);
    a.position.y = y;
    a.rotation.z = roll;
    a.scale.set(1 - s * 0.5, 1 + s, 1 - s * 0.5);

    if (p.eyes) {
      this.blinkIn -= dt;
      if (this.blinkIn < -0.12) this.blinkIn = rand(1.8, 4.5);
      p.eyes.scale.y = this.blinkIn < 0 ? 0.12 : 1;
    }
    if (p.head && !this.rigged) p.head.rotation.z = Math.sin(ph * 1.3) * 0.05 * this.idle + roll * 0.6;
    if (p.wingR) {
      if (FLUTTER.has(this.kind)) p.wingL.rotation.y = -(p.wingR.rotation.y = -0.35 - Math.sin(ph * 9) * 0.45);
      else if (this.kind === 'bee') p.wingL.rotation.x = -(p.wingR.rotation.x = Math.sin(ph * 38) * 0.3);
      else if (this.kind !== 'duck') p.wingL.rotation.z = -(p.wingR.rotation.z = this.hopT < 1 || this.dancing ? 0.5 + Math.sin(ph * 26) * 0.5 : 0);
    }
    if (p.tail && !this.rigged) if (p.tail) p.tail.rotation.y = Math.sin(ph * 5) * 0.3;
    if (p.rays) p.rays.rotation.z = -ph * 0.35;
    if (p.prop) p.prop.rotation.x = ph * 30;
    if (p.flame) p.flame.scale.y = 1 + Math.sin(ph * 31) * 0.2;
  }
}

/* ------------------------------------------------------------------- buddy */

/** Arm lift, head tilt and mouth for each of a buddy's moods. */
const MOODS = {
  idle: { arm: 0, armR: 0, tilt: 0, nod: 0, mouth: 0.12 },
  cheer: { arm: 2.5, armR: 2.5, tilt: 0, nod: -0.16, mouth: 1 },
  wave: { arm: 0, armR: 2.4, tilt: 0.1, nod: 0, mouth: 0.6 },
  think: { arm: 0, armR: 1.5, tilt: -0.2, nod: -0.1, mouth: 0.05 },
  oops: { arm: 0.7, armR: 0.7, tilt: 0.24, nod: 0.16, mouth: 0.4 },
};

/** The child's sidekick. Talks when the voice talks; feels what the child feels. */
export class Buddy extends Toy {
  constructor(name, size = 2) {
    super(name, size);
    this.rigged = true;
    this.mood = 'idle';
    this.moodFor = 0;
    this.pose = { ...MOODS.idle };
    this.look = 0;
    this.lookTo = 0;
  }

  feel(mood, seconds = 1.4) {
    this.mood = mood;
    this.moodFor = seconds;
    if (mood === 'cheer') this.hop(0.28, 0.45);
    if (mood === 'oops') this.boing(0.6);
    return this;
  }

  tick(dt, t) {
    super.tick(dt, t);
    if (this.moodFor > 0 && (this.moodFor -= dt) <= 0) this.mood = 'idle';
    if (this.mood === 'cheer' && this.hopT === 1 && this.moodFor > 0.4) this.hop(0.24, 0.42);
    const want = this.dancing ? MOODS.cheer : MOODS[this.mood];
    const pose = this.pose, p = this.parts;
    for (const k in pose) pose[k] = approach(pose[k], want[k], 14, dt);
    const flap = this.mood === 'idle' ? 0.04 : 0.22;
    p.armL.rotation.z = -pose.arm - Math.sin(t * 11) * flap;
    p.armR.rotation.z = pose.armR + Math.sin(t * 11) * flap;
    this.look = approach(this.look, this.lookTo, 5, dt);
    p.head.rotation.set(pose.nod, this.look, pose.tilt + Math.sin(t * 1.4) * 0.04);
    if (p.tail) p.tail.rotation.y = Math.sin(t * (this.mood === 'cheer' ? 14 : 3)) * 0.3;
    const chat = audio.speaking ? 0.35 + Math.abs(Math.sin(t * 9) * Math.sin(t * 3.7)) * 0.75 : 0;
    p.mouth.scale.y = Math.max(0.05, pose.mouth, chat);
  }
}

/* ------------------------------------------------------------------- tiles */

const slabs = new Map();

/** A glossy rounded slab standing on y = 0, tinted by its material. */
export function slab(w, h, d, color, r = 0.16) {
  const key = `${w},${h},${d},${r}`;
  if (!slabs.has(key)) {
    const b = new Builder({ ao: false });
    b.box('#ffffff', [0, h / 2, 0], [w, h, d], { r, seg: 3, surf: 'shiny' });
    slabs.set(key, b.bake());
  }
  return instantiate(slabs.get(key), { material: toyMaterial(color), receive: true }).root;
}

/** A chunky block with a letter or number on its face — the thing you tap to answer. */
export function block(label, { size = 1.3, width = size, color = '#ff8a4c', ink = '#ffffff', depth = 0.55 } = {}) {
  const g = new THREE.Group();
  g.add(slab(width, size, depth, color));
  const lower = /^[a-z]+$/.test(label);
  const text = text3d(label, { height: size * (lower ? 0.66 : 0.54), color: ink, maxWidth: width * 0.74, ink: true, shadow: false });
  text.position.set(0, size / 2, depth / 2 + size * 0.05);
  g.add(text);
  const toy = new Toy(g, size, { idle: 0.4 });
  toy.width = width;
  toy.label = label;
  toy.text = text;
  return toy;
}

/** One of the shapes with faces. */
export function shapeToy(shape, color, size) {
  const mesh = shapeMesh(shape, color);
  mesh.scale.setScalar(size);
  return new Toy(mesh, size);
}

/** A number block; `dots` adds the quantity underneath for children still learning numerals. */
export function numberBlock(n, { dots = false, ...o } = {}) {
  const toy = block(String(n), o);
  toy.value = n;
  if (dots) {
    const { size } = toy;
    toy.text.scale.setScalar(0.8);
    toy.text.position.y = size * 0.6;
    for (let i = 0; i < n; i++) {
      const dot = slab(size * 0.12, size * 0.12, 0.06, '#ffffff', size * 0.06);
      dot.position.set((i - (n - 1) / 2) * size * 0.16, size * 0.12, toy.text.position.z);
      toy.text.parent.add(dot);
    }
  }
  return toy;
}
