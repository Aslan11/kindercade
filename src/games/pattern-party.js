/**
 * Pattern Party — sequencing and pattern recognition.
 *
 * Spotting that a sequence repeats by a rule, and predicting the next term, is
 * the first real piece of algebraic thinking a child does. So the strip is
 * always generated from an actual rule (AB, AAB, ABC, ABB, or a growing count),
 * and the wrong choices are drawn from tokens that already appear in the
 * pattern — which makes it reasoning rather than odd-one-out.
 */

import { Game } from '../core/engine.js';
import { Button, drawSlot } from '../core/ui.js';
import { candyRect, roundRect, starPath, heartPath, softText, bubbleText } from '../core/art.js';
import { Ease } from '../core/anim.js';
import { shuffle, pick, clamp, sample, TAU, shade } from '../core/util.js';
import { SHAPES, SHAPE_COLORS, PRAISE } from '../data/words.js';

const RULES = {
  1: [[0, 1], [0, 0, 1]],
  2: [[0, 1, 2], [0, 0, 1, 1], [0, 1, 1]],
  3: [[0, 1, 1], [0, 1, 2, 2], [0, 1, 2, 0]],
};

export default class PatternParty extends Game {
  static meta = {
    id: 'pattern-party',
    title: 'Pattern Party',
    subject: 'puzzle',
    blurb: 'What comes next in the pattern?',
    emoji: '🔷',
    tint: '#ff8fd0',
  };

  init() {
    this.maxLevel = 3;
    this.roundsTotal = 8;
    this.busy = false;
    this.wave = -1;
    this.hintWave = -1;
    this.flyer = null;
    this.backdrop = { top: '#ffe4f4', bottom: '#fff4d8', hills: ['#f5b8dd', '#e894c8'] };
    this.newRound();
  }

  /* ------------------------------------------------------------ round setup */

  newRound() {
    this.busy = false;
    this.wave = -1;
    this.hintWave = -1;
    this.flyer = null;
    this.placed = false;
    this.wrongTries = 0;

    // A "growing" pattern (1, 2, 3, ... of the same thing) appears at level 3.
    this.growing = this.level === 3 && Math.random() < 0.35;
    if (this.growing) this.buildGrowing();
    else this.buildRepeating();

    // Reading the strip aloud *is* the instruction, so it is the prompt speech
    // rather than a second line spoken over the top of one.
    this.setPrompt('What comes next?', { speak: false });
    this.layout();
    this.tweens.after(0.6, () => this.speakPrompt());
  }

  /** A palette of distinct tokens to build this round's pattern from. */
  makeTokens(n) {
    const shapes = sample(SHAPES, n);
    const colors = sample(SHAPE_COLORS, n);
    return shapes.map((shape, i) => ({ shape, color: colors[i], count: 1, name: `${this.colorName(colors[i])} ${shape}` }));
  }

  colorName(hex) {
    return ({
      '#ff6b8b': 'pink', '#ffc93c': 'yellow', '#4cc9f0': 'blue',
      '#3ddc97': 'green', '#9b6cff': 'purple', '#ff9f1c': 'orange',
    })[hex] || 'coloured';
  }

  buildRepeating() {
    const rule = pick(RULES[this.level] || RULES[1]);
    const distinct = Math.max(...rule) + 1;
    const choiceCount = this.level === 3 ? 4 : 3;
    // One pool of guaranteed-distinct tokens: the first few build the pattern,
    // and the whole pool becomes the choices. That way most of the wrong
    // answers are tokens already in the pattern, so the child has to work out
    // *which* one comes next rather than just spot the newcomer.
    const pool = this.makeTokens(Math.max(choiceCount, distinct));
    const tokens = pool.slice(0, distinct);
    const visible = clamp(rule.length * 2 + 1, 5, 7);

    this.strip = [];
    for (let i = 0; i < visible; i++) this.strip.push(tokens[rule[i % rule.length]]);
    this.answer = tokens[rule[visible % rule.length]];
    this.choices = shuffle(pool);
  }

  /** 1, 2, 3, ... of the same token: a pattern that grows rather than repeats. */
  buildGrowing() {
    const [base] = this.makeTokens(1);
    const start = 1;
    const visible = 4;
    this.strip = [];
    for (let i = 0; i < visible; i++) this.strip.push({ ...base, count: start + i });
    const answerCount = start + visible;
    this.answer = { ...base, count: answerCount };
    const wrong = shuffle([answerCount - 1, answerCount + 1, answerCount - 2])
      .filter((c) => c > 0 && c !== answerCount)
      .slice(0, 2)
      .map((c) => ({ ...base, count: c }));
    this.choices = shuffle([this.answer, ...wrong]);
  }

  sameToken(a, b) {
    return a.shape === b.shape && a.color === b.color && a.count === b.count;
  }

  /* ---------------------------------------------------------------- layout */

  layout() {
    if (!this.strip) return;
    const n = this.strip.length + 1;
    const maxW = this.W * 0.9;
    this.cell = clamp(Math.min(maxW / n - 14, 132), 78, 132);
    const gap = this.cell * 0.14;
    const stripW = this.cell * n + gap * (n - 1);
    this.stripX = this.cx - stripW / 2;
    this.stripY = this.playTop + clamp(this.H * 0.11, 70, 130);
    this.stripStep = this.cell + gap;

    this.buttons.clear();
    const m = this.choices.length;
    const size = clamp(Math.min((this.W * 0.8) / m - 26, 150), 104, 150);
    const cgap = clamp(this.W * 0.035, 20, 46);
    const startX = this.cx - (size * m + cgap * (m - 1)) / 2;
    const cy = this.H - size - clamp(this.H * 0.09, 60, 110);
    this.choices.forEach((token, i) => {
      this.buttons.add(new Button({
        x: startX + i * (size + cgap), y: cy, w: size, h: size, r: 28,
        color: '#ffffff', id: `c${i}`,
        onTap: () => this.choose(i),
      }));
    });
    this.choiceSize = size;
  }

  slotRect() {
    const i = this.strip.length;
    return { x: this.stripX + i * this.stripStep, y: this.stripY, w: this.cell, h: this.cell };
  }

  /* ---------------------------------------------------------------- answer */

  /** Reads the strip aloud, ending on the missing one. */
  speakPrompt({ delay = 0 } = {}) {
    const names = this.strip.map((t) => (this.growing ? `${t.count}` : t.name));
    const spoken = names.slice(-4).join(', ');
    return this.audio.say([
      { text: spoken, rate: 0.85, gap: 0.3, delay },
      { text: 'What comes next?', rate: 0.95 },
    ]);
  }

  /** Visual only — run a wave along the strip to walk the eye down it. */
  hintPulse() { this.hintWave = 0; }

  choose(i) {
    if (this.busy) return;
    const token = this.choices[i];
    const btn = this.buttons.get(`c${i}`);
    if (!token || !btn) return;

    if (!this.sameToken(token, this.answer)) {
      this.nudge(btn.cx, btn.cy);
      this.wrongTries++;
      if (this.wrongTries >= 2) {
        this.tweens.after(0.5, () => {
          const right = this.choices.findIndex((c) => this.sameToken(c, this.answer));
          this.buttons.get(`c${right}`)?.pulse();
          this.speakPrompt();
        });
      }
      return;
    }

    this.busy = true;
    this.roundsDone++;
    this.buttons.buttons.forEach((b) => { b.enabled = false; });
    btn.hidden = true;

    const slot = this.slotRect();
    this.flyer = { token, x: btn.cx, y: btn.cy, size: this.choiceSize };
    this.tweens.to(this.flyer, {
      x: slot.x + slot.w / 2, y: slot.y + slot.h / 2, size: this.cell,
    }, 0.42, { ease: Ease.outBack, onComplete: () => {
      this.strip.push(token);
      this.flyer = null;
      this.placed = true;
      this.wave = 0;
      this.cheer(slot.x + slot.w / 2, slot.y + slot.h / 2);
      this.audio.speak(this.successLine(), { delay: 0.2 });
    } });

    this.tweens.after(2.6, () => {
      if (this.roundsDone >= this.roundsTotal) this.finishRound({ title: pick(PRAISE) });
      else this.newRound();
    });
  }

  successLine() {
    const names = this.strip.map((t) => (this.growing ? `${t.count}` : t.name));
    return `${names.slice(-3).join(', ')}. ${pick(PRAISE)}`;
  }

  /* ------------------------------------------------------------------ frame */

  update(dt) {
    if (this.wave >= 0) this.wave += dt * 3.4;
    if (this.hintWave >= 0) {
      this.hintWave += dt * 3.4;
      // One pass down the strip, then it settles again.
      if (this.hintWave > this.strip.length * 0.42 + Math.PI) this.hintWave = -1;
    }
  }

  draw(ctx) {
    this.drawBunting(ctx);

    this.strip.forEach((token, i) => {
      const x = this.stripX + i * this.stripStep;
      const w = this.wave >= 0 ? this.wave : this.hintWave;
      const lift = w >= 0 ? Math.max(0, Math.sin(w - i * 0.42)) * 18 : 0;
      const sway = Math.sin(this.t * 1.3 + i * 0.5) * 5;
      this.drawToken(ctx, token, x, this.stripY + sway - lift, this.cell);
    });

    if (!this.placed) {
      const s = this.slotRect();
      const sway = Math.sin(this.t * 1.3 + this.strip.length * 0.5) * 5;
      drawSlot(ctx, s.x, s.y + sway, s.w, s.h, { r: 24, active: true, color: this.tint });
      bubbleText(ctx, '?', s.x + s.w / 2, s.y + s.h / 2 + sway, this.cell * 0.5,
        { fill: '#ffffff', stroke: shade(this.tint, -0.35) });
    }

    if (this.wave < 0) {
      softText(ctx, 'Tap the one that comes next', this.cx, this.H - 34, 24,
        { color: 'rgba(44,35,64,0.45)' });
    }
  }

  /** A washing line with a short string down to each tile. */
  drawBunting(ctx) {
    const y = this.stripY - this.cell * 0.42;
    const lineAt = (x) => {
      const k = x / Math.max(1, this.W);
      return (y - 18) + Math.sin(k * Math.PI) * 44;
    };
    ctx.save();
    ctx.strokeStyle = 'rgba(120,90,140,0.38)';
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.moveTo(0, y - 18);
    ctx.quadraticCurveTo(this.cx, y + 26, this.W, y - 18);
    ctx.stroke();

    ctx.lineWidth = 3;
    const total = this.strip.length + 1;
    for (let i = 0; i < total; i++) {
      const x = this.stripX + i * this.stripStep + this.cell / 2;
      const sway = Math.sin(this.t * 1.3 + i * 0.5) * 5;
      ctx.beginPath();
      ctx.moveTo(x, lineAt(x));
      ctx.lineTo(x, this.stripY + sway);
      ctx.stroke();
    }
    ctx.restore();
  }

  /**
   * Tokens are drawn as vector shapes on a candy tile — crisp at any size, and
   * distinguishable by shape as well as colour (colour alone is a poor signal).
   */
  drawToken(ctx, token, x, y, size, tile = true) {
    if (tile) {
      candyRect(ctx, x, y, size, size, size * 0.2, '#ffffff', { depth: 7, gloss: false });
    }
    const cx = x + size / 2;
    const cy = y + size / 2;

    if (token.count > 1) {
      // Growing patterns show N copies of the same small shape.
      const cols = Math.min(3, token.count);
      const rows = Math.ceil(token.count / cols);
      const s = size * 0.26;
      for (let i = 0; i < token.count; i++) {
        const r = Math.floor(i / cols);
        const c = i % cols;
        const inRow = r === rows - 1 ? token.count - r * cols : cols;
        this.drawShape(ctx, token.shape, token.color,
          cx - ((inRow - 1) * s) / 2 + c * s,
          cy - ((rows - 1) * s) / 2 + r * s, s * 0.42);
      }
      return;
    }
    this.drawShape(ctx, token.shape, token.color, cx, cy, size * 0.3);
  }

  drawShape(ctx, shape, color, cx, cy, r) {
    ctx.save();
    ctx.beginPath();
    switch (shape) {
      case 'circle':
        ctx.arc(cx, cy, r, 0, TAU);
        break;
      case 'square':
        roundRect(ctx, cx - r * 0.9, cy - r * 0.9, r * 1.8, r * 1.8, r * 0.26);
        break;
      case 'triangle':
        ctx.moveTo(cx, cy - r);
        ctx.lineTo(cx + r * 0.92, cy + r * 0.72);
        ctx.lineTo(cx - r * 0.92, cy + r * 0.72);
        ctx.closePath();
        break;
      case 'star':
        starPath(ctx, cx, cy, r * 1.08, r * 0.48, 5);
        break;
      case 'heart':
        heartPath(ctx, cx, cy, r * 2.2);
        break;
      default: // diamond
        ctx.moveTo(cx, cy - r);
        ctx.lineTo(cx + r * 0.82, cy);
        ctx.lineTo(cx, cy + r);
        ctx.lineTo(cx - r * 0.82, cy);
        ctx.closePath();
    }
    ctx.fillStyle = color;
    ctx.fill();
    ctx.lineWidth = Math.max(2, r * 0.14);
    ctx.strokeStyle = shade(color, -0.3);
    ctx.stroke();
    ctx.restore();
  }

  /**
   * The ButtonLayer paints the blank tiles, so the shapes that sit on them —
   * and the one flying into the pattern — have to be drawn afterwards.
   */
  drawOverlay(ctx) {
    this.choices.forEach((token, i) => {
      const b = this.buttons.get(`c${i}`);
      if (!b || b.hidden) return;
      this.drawToken(ctx, token, b.x, b.y - b.press.value * 8, this.choiceSize, false);
    });

    if (this.flyer) {
      this.drawToken(ctx, this.flyer.token,
        this.flyer.x - this.flyer.size / 2, this.flyer.y - this.flyer.size / 2, this.flyer.size);
    }
  }
}
