/**
 * Particle effects and screen juice.
 *
 * This is the layer that makes a correct answer *feel* like a win. Every game
 * gets one `FX` instance on `this.fx`, stepped and drawn by the engine.
 */

import { TAU, rand, randInt, pick, clamp } from './util.js';
import { starPath, sparklePath, drawEmoji, roundRect } from './art.js';

const CONFETTI_COLORS = ['#ff6b8b', '#ffc93c', '#4cc9f0', '#3ddc97', '#9b6cff', '#ff8fd0', '#ff9f1c'];

class Particle {
  constructor(cfg) { Object.assign(this, cfg); this.age = 0; }
  get dead() { return this.age >= this.life; }
}

export class FX {
  constructor() {
    this.particles = [];
    this.shake = 0;
    this.shakeDecay = 5;
    this.floaters = [];
    this.gravity = 1600;
  }

  clear() { this.particles.length = 0; this.floaters.length = 0; this.shake = 0; }

  /* -------------------------------------------------------------- emitters */

  /** Big celebratory burst — use on level complete. */
  confetti(x, y, count = 60, { spread = TAU, speed = [320, 900], up = false } = {}) {
    for (let i = 0; i < count; i++) {
      const a = up ? -Math.PI / 2 + rand(-0.7, 0.7) : rand(0, spread);
      const sp = rand(speed[0], speed[1]);
      this.particles.push(new Particle({
        kind: 'confetti', x, y,
        vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - (up ? rand(200, 500) : 0),
        w: rand(10, 20), h: rand(14, 26),
        rot: rand(0, TAU), spin: rand(-9, 9),
        color: pick(CONFETTI_COLORS),
        life: rand(1.2, 2.2), drag: 0.62, grav: 1,
      }));
    }
  }

  /** Confetti raining from the top of the frame across the whole width. */
  confettiRain(width, count = 70) {
    for (let i = 0; i < count; i++) {
      this.particles.push(new Particle({
        kind: 'confetti',
        x: rand(0, width), y: rand(-420, -20),
        vx: rand(-70, 70), vy: rand(120, 320),
        w: rand(10, 20), h: rand(14, 26),
        rot: rand(0, TAU), spin: rand(-7, 7),
        color: pick(CONFETTI_COLORS),
        life: rand(2.4, 4), drag: 0.9, grav: 0.22,
      }));
    }
  }

  /** Small twinkle puff — the everyday "correct!" accent. */
  sparkle(x, y, count = 14, { color = '#ffe9a8', spread = 130 } = {}) {
    for (let i = 0; i < count; i++) {
      const a = rand(0, TAU);
      const sp = rand(60, spread);
      this.particles.push(new Particle({
        kind: 'sparkle', x, y,
        vx: Math.cos(a) * sp, vy: Math.sin(a) * sp,
        r: rand(6, 16), rot: rand(0, TAU), spin: rand(-4, 4),
        color, life: rand(0.5, 1.0), drag: 0.35, grav: 0.05,
      }));
    }
  }

  /** Stars fountaining upward from a point. */
  starBurst(x, y, count = 18, color = '#ffc93c') {
    for (let i = 0; i < count; i++) {
      const a = -Math.PI / 2 + rand(-1.15, 1.15);
      const sp = rand(320, 760);
      this.particles.push(new Particle({
        kind: 'star', x, y,
        vx: Math.cos(a) * sp, vy: Math.sin(a) * sp,
        r: rand(10, 22), rot: rand(0, TAU), spin: rand(-8, 8),
        color, life: rand(0.9, 1.6), drag: 0.7, grav: 1,
      }));
    }
  }

  /** Ring shockwave — a satisfying "pop" for balloons and bubbles. */
  ring(x, y, { color = '#ffffff', r0 = 10, r1 = 140, life = 0.45, width = 10 } = {}) {
    this.particles.push(new Particle({ kind: 'ring', x, y, color, r0, r1, width, life, vx: 0, vy: 0 }));
  }

  /** Shards flying off a popped object. */
  burstEmoji(x, y, ch, count = 8, size = 34) {
    for (let i = 0; i < count; i++) {
      const a = rand(0, TAU);
      const sp = rand(180, 520);
      this.particles.push(new Particle({
        kind: 'emoji', x, y, ch, size,
        vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 160,
        rot: rand(0, TAU), spin: rand(-7, 7),
        life: rand(0.7, 1.3), drag: 0.75, grav: 1,
      }));
    }
  }

  /** Soft dust puff — good for landings and "poof, it's gone". */
  puff(x, y, count = 10, color = 'rgba(255,255,255,0.9)') {
    for (let i = 0; i < count; i++) {
      const a = rand(0, TAU);
      this.particles.push(new Particle({
        kind: 'puff', x, y,
        vx: Math.cos(a) * rand(30, 150), vy: Math.sin(a) * rand(30, 150) - 40,
        r: rand(10, 26), color, life: rand(0.4, 0.8), drag: 0.3, grav: -0.1,
      }));
    }
  }

  /** Trail dot — call each frame while something is being dragged. */
  trail(x, y, color = '#ffffff') {
    if (this.particles.length > 400) return;
    this.particles.push(new Particle({
      kind: 'puff', x: x + rand(-6, 6), y: y + rand(-6, 6),
      vx: rand(-20, 20), vy: rand(-20, 20),
      r: rand(4, 10), color, life: 0.35, drag: 0.2, grav: -0.05,
    }));
  }

  /** Rising text, e.g. "+1" or "Nice!". */
  floatText(x, y, text, { color = '#ffffff', size = 46, life = 1.1, rise = 110, stroke = '#2c2340' } = {}) {
    this.floaters.push({ x, y, text, color, size, life, maxLife: life, rise, stroke, age: 0 });
  }

  /** Camera shake in logical pixels. Keep it gentle — this is a toddler's game. */
  addShake(amount = 8) { this.shake = Math.min(22, this.shake + amount); }

  /* ------------------------------------------------------------------ step */

  step(dt) {
    for (const p of this.particles) {
      p.age += dt;
      const drag = Math.exp(-(p.drag ?? 0.5) * dt * 4);
      p.vx *= drag;
      p.vy = p.vy * drag + this.gravity * (p.grav ?? 1) * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      if (p.spin) p.rot += p.spin * dt;
    }
    if (this.particles.length) this.particles = this.particles.filter((p) => !p.dead);

    for (const f of this.floaters) f.age += dt;
    if (this.floaters.length) this.floaters = this.floaters.filter((f) => f.age < f.life);

    this.shake = Math.max(0, this.shake - this.shake * this.shakeDecay * dt - 8 * dt);
  }

  /** Shake offset the engine applies before drawing the game. */
  shakeOffset() {
    if (this.shake <= 0.1) return { x: 0, y: 0 };
    return { x: rand(-this.shake, this.shake), y: rand(-this.shake, this.shake) };
  }

  /* ------------------------------------------------------------------ draw */

  draw(ctx) {
    for (const p of this.particles) {
      const t = p.age / p.life;
      const alpha = t < 0.75 ? 1 : 1 - (t - 0.75) / 0.25;
      ctx.save();
      ctx.globalAlpha = clamp(alpha, 0, 1);

      if (p.kind === 'ring') {
        const r = p.r0 + (p.r1 - p.r0) * (1 - (1 - t) ** 2);
        ctx.beginPath();
        ctx.arc(p.x, p.y, r, 0, TAU);
        ctx.lineWidth = p.width * (1 - t);
        ctx.strokeStyle = p.color;
        ctx.globalAlpha *= 0.8;
        ctx.stroke();
      } else if (p.kind === 'confetti') {
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rot);
        // Flip on the vertical axis so it reads as a tumbling paper strip.
        ctx.scale(1, Math.cos(p.age * 9) * 0.85 + 0.15);
        ctx.fillStyle = p.color;
        roundRect(ctx, -p.w / 2, -p.h / 2, p.w, p.h, 3);
        ctx.fill();
      } else if (p.kind === 'star') {
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rot);
        starPath(ctx, 0, 0, p.r, p.r * 0.45, 5);
        ctx.fillStyle = p.color;
        ctx.shadowColor = p.color;
        ctx.shadowBlur = 14;
        ctx.fill();
      } else if (p.kind === 'sparkle') {
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rot);
        const s = 1 - Math.abs(t - 0.3) * 0.9;
        sparklePath(ctx, 0, 0, p.r * clamp(s, 0.2, 1.4));
        ctx.fillStyle = p.color;
        ctx.shadowColor = p.color;
        ctx.shadowBlur = 16;
        ctx.fill();
      } else if (p.kind === 'emoji') {
        drawEmoji(ctx, p.ch, p.x, p.y, p.size, { rotate: p.rot });
      } else { // puff
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r * (1 + t * 0.8), 0, TAU);
        ctx.fillStyle = p.color;
        ctx.globalAlpha *= 0.55;
        ctx.fill();
      }
      ctx.restore();
    }

    for (const f of this.floaters) {
      const t = f.age / f.maxLife;
      const y = f.y - f.rise * (1 - (1 - t) ** 2);
      const pop = t < 0.18 ? 0.6 + (t / 0.18) * 0.5 : 1;
      ctx.save();
      ctx.globalAlpha = t < 0.7 ? 1 : 1 - (t - 0.7) / 0.3;
      ctx.translate(f.x, y);
      ctx.scale(pop, pop);
      ctx.font = `900 ${f.size}px ui-rounded, "SF Pro Rounded", system-ui, sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.lineJoin = 'round';
      ctx.lineWidth = f.size * 0.2;
      ctx.strokeStyle = f.stroke;
      ctx.strokeText(f.text, 0, 0);
      ctx.fillStyle = f.color;
      ctx.fillText(f.text, 0, 0);
      ctx.restore();
    }
  }
}

/** Pre-baked celebration used at the end of every round. */
export function celebrate(fx, audio, w, h) {
  fx.confettiRain(w, 90);
  fx.starBurst(w / 2, h * 0.62, 24);
  audio.fanfare();
}

export { CONFETTI_COLORS };
