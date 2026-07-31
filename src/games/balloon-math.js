/**
 * Balloon Pop — addition and subtraction facts within 20.
 *
 * Levels 1 and 2 show every sum twice: once as numerals and once as real
 * countable objects underneath. That concrete-to-abstract pairing is what turns
 * "3 + 2" from a symbol into a quantity. Level 3 drops the objects, by which
 * point the numerals should be carrying the meaning on their own.
 */

import { Game } from '../core/engine.js';
import { drawEmoji, bubbleText, glassPanel, candyCircle, softText, Palette } from '../core/art.js';
import { randInt, shuffle, pick, dist, clamp, rand, TAU, shade } from '../core/util.js';
import { COUNTABLES, numberWord, PRAISE } from '../data/words.js';

const BALLOON_COLORS = ['#ff6b8b', '#ffc93c', '#4cc9f0', '#3ddc97', '#9b6cff', '#ff8fd0', '#ff9f1c'];

export default class BalloonMath extends Game {
  static meta = {
    id: 'balloon-math',
    title: 'Balloon Pop',
    subject: 'math',
    blurb: 'Pop the balloon with the right answer.',
    emoji: '🎈',
    tint: '#ff6b8b',
  };

  init() {
    this.maxLevel = 3;
    this.roundsTotal = 8;
    this.busy = false;
    this.backdrop = { top: '#bfe9ff', bottom: '#ffe2ef', hills: ['#8fe0c0', '#5fcfa5'] };
    this.balloons = [];
    this.newRound();
  }

  get balloonCount() { return this.level === 1 ? 3 : this.level === 2 ? 4 : 5; }
  /** Objects under the numerals are training wheels; level 3 takes them off. */
  get showConcrete() { return this.level < 3; }

  /* ------------------------------------------------------------ round setup */

  newRound() {
    this.sum = this.makeSum();
    this.wrongTries = 0;
    this.busy = false;
    this.kind = pick(COUNTABLES);
    this.balloons = this.makeBalloons();
    // The sum itself is on the panel; the HUD carries the instruction so the
    // two are not saying the same thing twice.
    this.setPrompt('Pop the right answer!', { speech: this.sum.speech });
    this.layout();
  }

  makeSum() {
    const level = this.level;
    let a, b, op;
    if (level === 1) {
      a = randInt(1, 6); b = randInt(1, Math.min(6, 10 - a)); op = '+';
    } else if (level === 2) {
      a = randInt(3, 10); b = randInt(1, a - 1); op = '−';
    } else if (Math.random() < 0.5) {
      a = randInt(4, 14); b = randInt(2, Math.min(9, 20 - a)); op = '+';
    } else {
      a = randInt(8, 20); b = randInt(2, Math.min(9, a - 1)); op = '−';
    }
    const answer = op === '+' ? a + b : a - b;
    const spoken = op === '+' ? 'plus' : 'minus';
    return {
      a, b, op, answer,
      text: `${a} ${op} ${b} = ?`,
      speech: `What is ${numberWord(a)} ${spoken} ${numberWord(b)}?`,
      full: `${numberWord(a)} ${spoken} ${numberWord(b)} is ${numberWord(answer)}`,
    };
  }

  /**
   * Balloons get their own horizontal lane so none can hide behind another and
   * become untappable.
   */
  makeBalloons() {
    const n = this.balloonCount;
    const values = new Set([this.sum.answer]);
    let guard = 0;
    while (values.size < n && guard++ < 200) {
      const delta = randInt(1, 4) * (Math.random() < 0.5 ? -1 : 1);
      const v = this.sum.answer + delta;
      if (v >= 0 && v <= 20) values.add(v);
    }
    while (values.size < n) values.add(randInt(0, 20));

    return shuffle([...values]).map((value, i) => ({
      value,
      lane: i,
      x: 0, y: 0, r: 0,
      phase: rand(0, TAU),
      // Where in its lane this balloon likes to sit, and how much it drifts
      // around that spot. Stored per balloon so a rotation does not reshuffle
      // the sky under the child's finger.
      heightBias: rand(0.12, 0.78),
      bobSpeed: rand(0.5, 0.85),
      bobAmp: rand(9, 16),
      swayAmp: rand(10, 20),
      color: BALLOON_COLORS[i % BALLOON_COLORS.length],
      popped: false,
      glow: 0,
      pulse: 0,
      dip: 0,
    }));
  }

  layout() {
    if (!this.balloons) return;
    this.panel = {
      x: this.cx - Math.min(760, this.W * 0.62) / 2,
      y: this.playTop,
      w: Math.min(760, this.W * 0.62),
      h: this.showConcrete ? 236 : 150,
    };
    this.skyTop = this.panel.y + this.panel.h + 22;
    this.skyBottom = this.H - 40;

    const n = this.balloons.length;
    const laneW = this.W / n;
    this.balloonR = clamp(laneW * 0.34, 64, 92);
    // Leave headroom above and enough below for the string to hang.
    const top = this.skyTop + this.balloonR * 1.2;
    const bottom = Math.max(top, this.skyBottom - this.balloonR * 1.35);
    this.balloons.forEach((b) => {
      b.r = this.balloonR;
      b.homeX = laneW * (b.lane + 0.5);
      b.homeY = top + (bottom - top) * b.heightBias;
      b.x = b.homeX;
      b.y = b.homeY;
    });
  }

  /* ----------------------------------------------------------------- input */

  onTap(p) {
    if (this.busy) return;
    for (const b of this.balloons) {
      if (b.popped) continue;
      if (dist(p.x, p.y, b.x, b.y) > b.r * 1.12) continue;
      this.pop(b);
      return;
    }
  }

  /** Visual only — the sum is spoken for us by `speakPrompt`. */
  hintPulse() {
    for (const b of this.balloons) if (!b.popped) b.pulse = 1;
  }

  pop(b) {
    if (b.value !== this.sum.answer) {
      // A wrong balloon just bobs down and comes back — nothing is lost.
      this.nudge(b.x, b.y);
      b.dip = 1;
      this.wrongTries++;
      if (this.wrongTries >= 2) {
        const right = this.balloons.find((x) => x.value === this.sum.answer);
        if (right) right.glow = 1;
        this.audio.speak(this.sum.full, { delay: 0.4 });
      }
      return;
    }

    this.busy = true;
    b.popped = true;
    this.roundsDone++;
    this.audio.pop();
    this.fx.ring(b.x, b.y, { color: b.color, r1: b.r * 2.6, life: 0.5, width: 14 });
    this.fx.burstEmoji(b.x, b.y, '🎉', 6, 30);
    this.fx.confetti(b.x, b.y, 34);
    this.fx.floatText(b.x, b.y - b.r, `${this.sum.answer}!`, { color: '#fff3b0' });
    this.audio.correct();
    this.audio.speak(`${this.sum.full}. ${pick(PRAISE)}`, { delay: 0.25 });

    this.tweens.after(1.5, () => {
      if (this.roundsDone >= this.roundsTotal) this.finishRound({ title: pick(PRAISE) });
      else this.newRound();
    });
  }

  /* ------------------------------------------------------------------ frame */

  /**
   * Balloons hover around their own spot in the sky rather than drifting.
   *
   * They used to rise steadily and snap back to the bottom on leaving the top
   * of the screen, which reads as a glitch rather than as movement — and it
   * moves the thing you are trying to tap while a five-year-old is aiming at
   * it. Now they only breathe in place.
   */
  update(dt) {
    for (const b of this.balloons) {
      if (b.popped) continue;
      b.glow = Math.max(0, b.glow - dt * 0.4);
      b.pulse = Math.max(0, b.pulse - dt * 1.8);
      if (b.dip > 0) b.dip = Math.max(0, b.dip - dt * 1.2);
      b.y = b.homeY
        + Math.sin(this.t * b.bobSpeed + b.phase) * b.bobAmp
        + Math.sin(b.dip * Math.PI) * 52;
      b.x = b.homeX + Math.sin(this.t * 0.62 + b.phase * 1.7) * b.swayAmp;
    }
  }

  draw(ctx) {
    this.drawSum(ctx);
    for (const b of this.balloons) {
      if (b.popped) continue;
      this.drawBalloon(ctx, b);
    }
  }

  drawSum(ctx) {
    const p = this.panel;
    glassPanel(ctx, p.x, p.y, p.w, p.h, 36, { alpha: 0.92 });
    const sumY = p.y + (this.showConcrete ? 62 : p.h / 2);
    bubbleText(ctx, this.sum.text, this.cx, sumY, 66, { fill: '#ffffff', stroke: this.tint });

    if (!this.showConcrete) return;

    // The same sum again, as things you could actually pick up and count.
    const { a, b, op } = this.sum;
    const rowY = p.y + p.h - 78;
    const total = a + b;
    const size = clamp((p.w * 0.72) / Math.max(6, total + 2), 26, 46);
    const gap = size * 1.08;
    const opGap = size * 1.5;
    const width = total * gap + opGap;
    let x = this.cx - width / 2 + gap / 2;

    for (let i = 0; i < a; i++) {
      drawEmoji(ctx, this.kind.emoji, x, rowY, size);
      x += gap;
    }
    x += opGap * 0.15;
    softText(ctx, op, x, rowY, size * 1.3, { color: Palette.inkSoft, weight: 900 });
    x += opGap * 0.85;
    for (let i = 0; i < b; i++) {
      // In a subtraction the second group is what gets taken away, so it is
      // shown faded and crossed through rather than added alongside.
      const taken = op === '−';
      ctx.save();
      ctx.globalAlpha = taken ? 0.42 : 1;
      drawEmoji(ctx, this.kind.emoji, x, rowY, size);
      if (taken) {
        ctx.globalAlpha = 0.8;
        ctx.strokeStyle = '#e14b6a';
        ctx.lineWidth = 4;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(x - size * 0.34, rowY - size * 0.34);
        ctx.lineTo(x + size * 0.34, rowY + size * 0.34);
        ctx.stroke();
      }
      ctx.restore();
      x += gap;
    }
  }

  /** Drawn rather than an emoji, so the numeral can sit legibly on the body. */
  drawBalloon(ctx, b) {
    const wob = Math.sin(this.t * 2.2 + b.phase) * 0.05;
    ctx.save();
    ctx.translate(b.x, b.y);
    ctx.rotate(wob);
    // A hint from the 🔊 button swells every balloon once.
    if (b.pulse > 0) {
      const s = 1 + Math.sin(b.pulse * Math.PI) * 0.09;
      ctx.scale(s, s);
    }

    // string
    ctx.beginPath();
    ctx.moveTo(0, b.r * 0.98);
    ctx.quadraticCurveTo(b.r * 0.3, b.r * 1.5, Math.sin(this.t * 2 + b.phase) * b.r * 0.25, b.r * 2.1);
    ctx.strokeStyle = 'rgba(70,55,90,0.5)';
    ctx.lineWidth = 3;
    ctx.stroke();

    // knot
    ctx.beginPath();
    ctx.moveTo(-8, b.r * 0.94);
    ctx.lineTo(8, b.r * 0.94);
    ctx.lineTo(0, b.r * 1.12);
    ctx.closePath();
    ctx.fillStyle = shade(b.color, -0.28);
    ctx.fill();

    // body: slightly taller than wide, like a real balloon
    ctx.save();
    ctx.scale(1, 1.1);
    candyCircle(ctx, 0, 0, b.r, b.color, { glow: b.glow, stroke: 'rgba(255,255,255,0.5)', strokeWidth: 3 });
    ctx.restore();

    bubbleText(ctx, String(b.value), 0, 0, b.r * 0.92, {
      fill: '#ffffff', stroke: shade(b.color, -0.45), lineWidth: b.r * 0.14,
    });
    ctx.restore();
  }
}
