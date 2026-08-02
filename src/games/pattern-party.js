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
import {
  candyRect, softText, bubbleText,
  PX, px, pixelCircle, pixelRect, pixelLine, pixelPolyline,
} from '../core/art.js';
import { Ease } from '../core/anim.js';
import { shuffle, pick, clamp, sample, TAU, shade } from '../core/util.js';
import { drawSprite } from '../core/sprites.js';
import { SHAPES, SHAPE_COLORS, PRAISE } from '../data/words.js';

const RULES = {
  1: [[0, 1], [0, 0, 1]],
  2: [[0, 1, 2], [0, 0, 1, 1], [0, 1, 1]],
  3: [[0, 1, 1], [0, 1, 2, 2], [0, 1, 2, 0]],
};

// The atlas names its shape sprites `<shape>-<colour>`, and its colour names sit
// in the same order as SHAPE_COLORS — so the hex a token carries is a lookup by
// index rather than a second table to keep in step.
const ATLAS_COLORS = ['pink', 'gold', 'sky', 'mint', 'purple', 'orange'];

const shapeSprite = (shape, hex) => {
  const i = SHAPE_COLORS.indexOf(hex);
  return i < 0 ? null : `${shape}-${ATLAS_COLORS[i]}`;
};

/* ------------------------------------------------- pixel shape fallbacks */
// Used only until the sprite sheet loads: each shape is rasterised onto the
// texel grid with a hard 1-texel outline, so even the stand-ins read 16-bit.

/** Even-odd point-in-polygon test — geometry only, never painted. */
const inPoly = (pts, x, y) => {
  let inside = false;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const [xi, yi] = pts[i];
    const [xj, yj] = pts[j];
    if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
};

/** Stamp a polygon as texel squares: flat fill plus a 1-texel edge outline. */
function fillPixelPoly(ctx, pts, fill, outline) {
  const xs = pts.map((p) => p[0]);
  const ys = pts.map((p) => p[1]);
  const x0 = px(Math.min(...xs)) - PX;
  const y0 = px(Math.min(...ys)) - PX;
  const cols = (px(Math.max(...xs)) + PX - x0) / PX + 1;
  const rows = (px(Math.max(...ys)) + PX - y0) / PX + 1;
  const hit = [];
  for (let j = 0; j < rows; j++) {
    hit.push([]);
    for (let i = 0; i < cols; i++) {
      hit[j].push(inPoly(pts, x0 + (i + 0.5) * PX, y0 + (j + 0.5) * PX));
    }
  }
  for (const edgePass of [false, true]) {
    ctx.fillStyle = edgePass ? outline : fill;
    for (let j = 0; j < rows; j++) {
      for (let i = 0; i < cols; i++) {
        if (!hit[j][i]) continue;
        const edge = !hit[j - 1]?.[i] || !hit[j + 1]?.[i] || !hit[j][i - 1] || !hit[j][i + 1];
        if (edge === edgePass) ctx.fillRect(x0 + i * PX, y0 + j * PX, PX, PX);
      }
    }
  }
}

/** Five-point star vertices for the rasteriser. */
const starPoints = (cx, cy, outer, inner) => {
  const pts = [];
  for (let i = 0; i < 10; i++) {
    const r = i % 2 === 0 ? outer : inner;
    const a = -Math.PI / 2 + (i / 10) * TAU;
    pts.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r]);
  }
  return pts;
};

/** Heart outline sampled from the classic two-lobe cubics — geometry only. */
const heartPoints = (cx, cy, size) => {
  const s = size / 16;
  const cubic = (p0, c1, c2, p1, t) => {
    const u = 1 - t;
    return [
      u * u * u * p0[0] + 3 * u * u * t * c1[0] + 3 * u * t * t * c2[0] + t * t * t * p1[0],
      u * u * u * p0[1] + 3 * u * u * t * c1[1] + 3 * u * t * t * c2[1] + t * t * t * p1[1],
    ];
  };
  const bottom = [cx, cy + 6 * s];
  const top = [cx, cy - 5 * s];
  const pts = [];
  for (let i = 0; i <= 14; i++) pts.push(cubic(bottom, [cx - 12 * s, cy - 3 * s], [cx - 7 * s, cy - 12 * s], top, i / 14));
  for (let i = 0; i <= 14; i++) pts.push(cubic(top, [cx + 7 * s, cy - 12 * s], [cx + 12 * s, cy - 3 * s], bottom, i / 14));
  return pts;
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
      // Bob and wave-lift snap to the texel grid so the tiles step, not shimmer.
      const lift = w >= 0 ? px(Math.max(0, Math.sin(w - i * 0.42)) * 18) : 0;
      const sway = px(Math.sin(this.t * 1.3 + i * 0.5) * 5);
      this.drawToken(ctx, token, x, this.stripY + sway - lift, this.cell);
    });

    if (!this.placed) {
      const s = this.slotRect();
      const sway = px(Math.sin(this.t * 1.3 + this.strip.length * 0.5) * 5);
      drawSlot(ctx, s.x, s.y + sway, s.w, s.h, { r: 24, active: true, color: this.tint });
      bubbleText(ctx, '?', s.x + s.w / 2, s.y + s.h / 2 + sway, this.cell * 0.5,
        { fill: '#ffffff', stroke: shade(this.tint, -0.35) });
    }

    if (this.wave < 0) {
      softText(ctx, 'Tap the one that comes next', this.cx, this.H - 34, 24,
        { color: 'rgba(44,35,64,0.45)' });
    }
  }

  /**
   * A washing line with a short string down to each tile — the sag curve is
   * sampled and snapped to the texel grid, so the rope steps like pixels.
   */
  drawBunting(ctx) {
    const y = this.stripY - this.cell * 0.42;
    const lineAt = (x) => {
      const k = x / Math.max(1, this.W);
      return (y - 18) + Math.sin(k * Math.PI) * 44;
    };
    const rope = '#cba3cd'; // flat lilac — the old translucent stroke over the backdrop
    const pts = [];
    for (let x = 0; x <= this.W; x += PX * 6) pts.push([x, lineAt(x)]);
    pts.push([this.W, lineAt(this.W)]);
    pixelPolyline(ctx, pts, { color: rope, width: PX });

    const total = this.strip.length + 1;
    for (let i = 0; i < total; i++) {
      const x = this.stripX + i * this.stripStep + this.cell / 2;
      const sway = px(Math.sin(this.t * 1.3 + i * 0.5) * 5);
      pixelLine(ctx, x, lineAt(x), x, this.stripY + sway, { color: rope, width: PX });
    }
  }

  /**
   * Tokens are drawn as atlas shapes on a candy tile — distinguishable by shape
   * as well as colour (colour alone is a poor signal), with pixel-rasterised
   * stand-ins until the sheet loads.
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
    // The atlas carries all six shapes in all six palette colours. Its cells have
    // a little padding, so the sprite draws a touch over the fallback's 2r span —
    // and falls through to the pixel constructions below until the sheet loads.
    const key = shapeSprite(shape, color);
    if (key && drawSprite(ctx, key, cx, cy, r * 2.2)) return;

    const outline = shade(color, -0.5);
    switch (shape) {
      case 'circle':
        pixelCircle(ctx, cx, cy, r, {
          fill: color, outline, highlight: shade(color, 0.22), lowlight: shade(color, -0.22),
        });
        return;
      case 'square':
        pixelRect(ctx, cx - r * 0.9, cy - r * 0.9, r * 1.8, r * 1.8, {
          fill: color, outline, highlight: shade(color, 0.22), lowlight: shade(color, -0.22),
        });
        return;
      case 'triangle':
        fillPixelPoly(ctx, [
          [cx, cy - r], [cx + r * 0.92, cy + r * 0.72], [cx - r * 0.92, cy + r * 0.72],
        ], color, outline);
        return;
      case 'star':
        fillPixelPoly(ctx, starPoints(cx, cy, r * 1.08, r * 0.48), color, outline);
        return;
      case 'heart':
        fillPixelPoly(ctx, heartPoints(cx, cy, r * 2.2), color, outline);
        return;
      default: // diamond
        fillPixelPoly(ctx, [
          [cx, cy - r], [cx + r * 0.82, cy], [cx, cy + r], [cx - r * 0.82, cy],
        ], color, outline);
    }
  }

  /**
   * The ButtonLayer paints the blank tiles, so the shapes that sit on them —
   * and the one flying into the pattern — have to be drawn afterwards.
   */
  drawOverlay(ctx) {
    this.choices.forEach((token, i) => {
      const b = this.buttons.get(`c${i}`);
      if (!b || b.hidden) return;
      this.drawToken(ctx, token, b.x, b.y - px(b.press.value * 8), this.choiceSize, false);
    });

    if (this.flyer) {
      this.drawToken(ctx, this.flyer.token,
        this.flyer.x - this.flyer.size / 2, this.flyer.y - this.flyer.size / 2, this.flyer.size);
    }
  }
}
