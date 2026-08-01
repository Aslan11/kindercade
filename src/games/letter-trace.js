/**
 * Letter Trace — letter formation.
 *
 * Writing is half of literacy and it lives in the hand, not the eye. Rather
 * than hand-authoring stroke paths for sixty-odd glyphs, this renders the real
 * typeface into an offscreen mask, samples it on a coarse grid, and measures how
 * much of the letter the child's crayon has actually covered. That works for
 * uppercase, lowercase and digits alike, and it looks like the letters he sees
 * everywhere else.
 */

import { Game } from '../core/engine.js';
import { Button } from '../core/ui.js';
import {
  FONT_ROUND, softText, drawEmoji, glassPanel, Palette, roundRect,
  PX, px, stepAlpha, pixelRect, pixelCircle, pixelPolyline,
} from '../core/art.js';
import { shuffle, pick, clamp, mixHex } from '../core/util.js';
import { WORDS, numberWord, PRAISE } from '../data/words.js';

const UPPER = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');
const LOWER = 'abcdefghijklmnopqrstuvwxyz'.split('');
const DIGITS = '0123456789'.split('');

/** Fraction of the glyph that must be covered before it counts as traced. */
const DONE_AT = 0.72;
/** Sampling grid step, in mask pixels. Coarse on purpose — this runs every frame-ish. */
const STEP = 5;
/** The crayon's four flat colours — the old hue drift, quantized to bands. */
const CRAYON_COLORS = [0, 1, 2, 3].map((i) => mixHex('#00b8a9', '#5b8cff', i / 3));

export default class LetterTrace extends Game {
  static meta = {
    id: 'letter-trace',
    title: 'Letter Trace',
    subject: 'spelling',
    blurb: 'Trace the letter with your finger.',
    emoji: '✏️',
    tint: '#00b8a9',
  };

  init() {
    this.maxLevel = 3;
    this.roundsTotal = 6;
    this.busy = false;
    this.coverage = 0;
    this.idle = 0;
    this.ghost = 0;
    this.drawing = false;
    this.lastPoint = null;
    this.strokeHue = 0;
    this.degraded = false;      // set if getImageData is unavailable
    this.paintedTime = 0;
    this.backdrop = { top: '#d9fbf4', bottom: '#fff3d9', hills: ['#8fe0d0', '#5fc9b6'] };

    this.glyphs = this.pickGlyphs();
    this.index = 0;
    this.newGlyph();
  }

  pickGlyphs() {
    const set = this.level === 1 ? UPPER : this.level === 2 ? LOWER : DIGITS;
    return shuffle(set).slice(0, this.roundsTotal);
  }

  /* ------------------------------------------------------------ round setup */

  newGlyph() {
    this.glyph = this.glyphs[this.index];
    this.coverage = 0;
    this.idle = 0;
    this.ghost = 0;
    this.busy = false;
    this.paintedTime = 0;
    this.lastPoint = null;
    this.successWord = null;
    this.scoreTimer = 0;
    this.setPrompt(`Trace the ${this.glyphLabel()}`, { speech: this.introSpeech() });
    this.layout();
  }

  glyphLabel() {
    if (this.level === 3) return `number ${this.glyph}`;
    return `letter ${this.glyph.toUpperCase()}`;
  }

  introSpeech() {
    if (this.level === 3) return `Trace the number ${numberWord(Number(this.glyph))}.`;
    return `Trace the letter ${this.glyph.toUpperCase()}.`;
  }

  hintPulse() {
    this.ghost = 1;
    this.idle = 0;
  }

  /* ---------------------------------------------------------------- layout */

  layout() {
    if (!this.glyph) return;
    // Leave room below the paper for the coverage bar.
    const size = Math.min(this.W * 0.46, this.H - this.playTop - 130);
    this.box = {
      x: this.cx - size / 2,
      y: this.playTop + 16,
      w: size, h: size,
    };
    this.buildMask();

    this.buttons.clear();
    this.buttons.add(new Button({
      x: this.W - 96, y: this.H - 96, circle: true, radius: 52, emoji: 'icon-undo', color: '#ff8fa8',
      onTap: () => this.clearPaint(true),
    }));
  }

  /**
   * Two offscreen canvases at half resolution: one holds the glyph shape (the
   * target), one holds what the child has drawn. Comparing them is the score.
   */
  buildMask() {
    const w = Math.max(64, Math.round(this.box.w * 0.5));
    const h = Math.max(64, Math.round(this.box.h * 0.5));

    this.mask = this.mask || document.createElement('canvas');
    this.paint = this.paint || document.createElement('canvas');
    this.mask.width = this.paint.width = w;
    this.mask.height = this.paint.height = h;
    this.maskScale = w / this.box.w;

    const mc = this.mask.getContext('2d', { willReadFrequently: true });
    mc.clearRect(0, 0, w, h);
    mc.fillStyle = '#fff';
    mc.textAlign = 'center';
    mc.textBaseline = 'middle';
    mc.font = `900 ${Math.round(h * 0.86)}px ${FONT_ROUND}`;
    mc.fillText(this.glyph, w / 2, h * 0.52);

    // Sample the glyph on a coarse grid. These points are both the scoring
    // targets and the path the ghost hint wanders along.
    this.samples = [];
    try {
      const data = mc.getImageData(0, 0, w, h).data;
      for (let y = 0; y < h; y += STEP) {
        for (let x = 0; x < w; x += STEP) {
          if (data[(y * w + x) * 4 + 3] > 128) this.samples.push([x, y]);
        }
      }
      this.degraded = this.samples.length < 12;
    } catch (_) {
      // Pixel access blocked: fall back to "any sustained drawing completes it".
      this.degraded = true;
      this.samples = [];
    }
    if (this.samples.length) {
      // Start dot: topmost, then leftmost — where a stroke usually begins.
      this.startDot = this.samples.reduce((best, p) =>
        (p[1] < best[1] - STEP || (Math.abs(p[1] - best[1]) <= STEP && p[0] < best[0])) ? p : best, this.samples[0]);
    } else {
      this.startDot = null;
    }
    this.clearPaint(false);
  }

  clearPaint(announce) {
    if (!this.paint) return;
    const pc = this.paint.getContext('2d', { willReadFrequently: true });
    pc.clearRect(0, 0, this.paint.width, this.paint.height);
    this.coverage = 0;
    this.paintedTime = 0;
    this.lastPoint = null;
    this.strokes = [];
    if (announce) { this.audio.tap(); this.audio.speak('Try again!'); }
  }

  /* ----------------------------------------------------------------- input */

  toMask(p) {
    return {
      x: (p.x - this.box.x) * this.maskScale,
      y: (p.y - this.box.y) * this.maskScale,
    };
  }

  /** The paper, generously padded — but the crayon never leaves it. */
  onPaper(p) {
    const b = this.box;
    const pad = 30;
    return p.x >= b.x - pad && p.x <= b.x + b.w + pad && p.y >= b.y - pad && p.y <= b.y + b.h + pad;
  }

  onPointerDown(p) {
    if (this.busy || !this.onPaper(p)) return;
    this.drawing = true;
    this.idle = 0;
    this.ghost = 0;
    this.lastPoint = p;
    this.strokes.push([{ x: p.x, y: p.y }]);
    this.paintSegment(p, p);
  }

  onPointerMove(p) {
    if (!this.drawing || this.busy) return;
    this.idle = 0;
    if (this.lastPoint) this.paintSegment(this.lastPoint, p);
    this.lastPoint = p;
    const stroke = this.strokes[this.strokes.length - 1];
    if (stroke) stroke.push({ x: p.x, y: p.y });
    if (Math.random() < 0.45) {
      this.fx.sparkle(p.x, p.y, 1, { color: this.crayonColor(0.9), spread: 40 });
    }
  }

  onPointerUp() {
    if (!this.drawing) return;
    this.drawing = false;
    this.lastPoint = null;
    this.measureCoverage();
  }

  crayonColor(t = 0) {
    // The crayon steps through a few flat colours along the stroke — bands,
    // not a gradient, so the line reads as 16-bit.
    const m = (Math.sin(this.strokeHue + t) + 1) / 2;
    return CRAYON_COLORS[Math.min(CRAYON_COLORS.length - 1, Math.floor(m * CRAYON_COLORS.length))];
  }

  paintSegment(a, b) {
    const pc = this.paint.getContext('2d', { willReadFrequently: true });
    const ma = this.toMask(a);
    const mb = this.toMask(b);
    pc.strokeStyle = '#fff';
    pc.lineCap = 'round';
    pc.lineJoin = 'round';
    pc.lineWidth = Math.max(6, this.paint.width * 0.11);
    pc.beginPath();
    pc.moveTo(ma.x, ma.y);
    pc.lineTo(mb.x, mb.y);
    pc.stroke();
    this.strokeHue += 0.06;
    this.paintedTime += 0.03;
  }

  /** Coverage = how many of the glyph's sample points the crayon has touched. */
  measureCoverage() {
    if (this.busy) return;
    if (this.degraded) {
      // No pixel access: reward sustained effort instead of measured coverage.
      this.coverage = clamp(this.paintedTime / 3, 0, 1);
      if (this.coverage >= DONE_AT) this.complete();
      return;
    }
    let hit = 0;
    try {
      const pc = this.paint.getContext('2d', { willReadFrequently: true });
      const w = this.paint.width;
      const data = pc.getImageData(0, 0, w, this.paint.height).data;
      for (const [x, y] of this.samples) {
        if (data[(y * w + x) * 4 + 3] > 40) hit++;
      }
    } catch (_) {
      this.degraded = true;
      return;
    }
    this.coverage = this.samples.length ? hit / this.samples.length : 0;
    if (this.coverage >= DONE_AT) this.complete();
  }

  /* -------------------------------------------------------------- complete */

  complete() {
    if (this.busy) return;
    this.busy = true;
    this.roundsDone++;
    const c = { x: this.box.x + this.box.w / 2, y: this.box.y + this.box.h / 2 };
    this.cheer(c.x, c.y);
    this.fx.confetti(c.x, c.y, 44);
    this.audio.speak(this.successLine(), { delay: 0.3 });

    this.tweens.after(2.6, () => {
      this.index++;
      if (this.index >= this.glyphs.length) this.finishRound({ title: pick(PRAISE) });
      else this.newGlyph();
    });
  }

  successLine() {
    if (this.level === 3) return `${numberWord(Number(this.glyph))}! ${pick(PRAISE)}`;
    const letter = this.glyph.toUpperCase();
    const word = WORDS.find((w) => w.word[0].toUpperCase() === letter);
    this.successWord = word || null;
    return word
      ? `${letter}! ${letter} is for ${word.word}.`
      : `${letter}! ${pick(PRAISE)}`;
  }

  /* ------------------------------------------------------------------ frame */

  update(dt) {
    if (this.busy) return;
    // Score while the finger is still moving, so the letter lights up the
    // moment it is covered rather than waiting for the child to lift off.
    if (this.drawing) {
      this.scoreTimer += dt;
      if (this.scoreTimer >= 0.15) { this.scoreTimer = 0; this.measureCoverage(); }
    }
    if (!this.drawing) {
      this.idle += dt;
      // A stalled child gets a wandering dot showing where the line goes.
      if (this.idle > 4) { this.ghost = 1; this.idle = 0; }
    }
    if (this.ghost > 0) this.ghost = Math.max(0, this.ghost - dt * 0.22);
  }

  draw(ctx) {
    const b = this.box;
    glassPanel(ctx, b.x - 26, b.y - 26, b.w + 52, b.h + 52, 40, { alpha: 0.72 });

    // Ruled guide lines, like handwriting paper — texel dashes on the grid.
    ctx.save();
    ctx.fillStyle = 'rgba(44,35,64,0.16)';
    [0.22, 0.52, 0.82].forEach((f) => {
      const gy = px(b.y + b.h * f);
      const right = b.x + b.w + 14;
      for (let gxx = px(b.x - 14); gxx < right; gxx += PX * 6) {
        ctx.fillRect(gxx, gy, PX * 3, PX);
      }
    });
    ctx.restore();

    // The glyph itself: a soft fill plus a dashed outline to aim at. Real
    // letterforms stay (the one deliberate exception), but the marching ants
    // step texel by texel instead of gliding.
    ctx.save();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = `900 ${Math.round(b.h * 0.86)}px ${FONT_ROUND}`;
    const gx = b.x + b.w / 2;
    const gy = b.y + b.h * 0.52;
    ctx.fillStyle = 'rgba(0,184,169,0.13)';
    ctx.fillText(this.glyph, gx, gy);
    ctx.setLineDash([PX * 4, PX * 4]);
    ctx.lineDashOffset = -px(this.t * 24);
    ctx.lineWidth = PX;
    ctx.strokeStyle = 'rgba(0,140,130,0.5)';
    ctx.strokeText(this.glyph, gx, gy);
    ctx.restore();

    // What the child has drawn, replayed as a chunky texel crayon — clipped to
    // the paper (a stepped-chamfer path, so the cut-off edge reads square) so a
    // stray finger never scribbles across the whole screen.
    ctx.save();
    roundRect(ctx, b.x - 20, b.y - 20, b.w + 40, b.h + 40, 34);
    ctx.clip();
    const crayonW = Math.max(PX * 3, px(b.w * 0.11));
    ctx.globalAlpha = stepAlpha(0.92);
    (this.strokes || []).forEach((stroke, si) => {
      const color = this.crayonColor(si);
      if (stroke.length < 2) {
        if (!stroke.length) return;
        pixelCircle(ctx, stroke[0].x, stroke[0].y, crayonW / 2, { fill: color });
        return;
      }
      pixelPolyline(ctx, stroke.map((p) => [p.x, p.y]), { color, width: crayonW });
    });
    ctx.restore();

    // Completed glyph fills in solid.
    if (this.busy) {
      ctx.save();
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.font = `900 ${Math.round(b.h * 0.86)}px ${FONT_ROUND}`;
      ctx.fillStyle = '#00b8a9';
      ctx.globalAlpha = stepAlpha(0.9);
      ctx.fillText(this.glyph, gx, gy);
      ctx.restore();
      if (this.successWord) {
        drawEmoji(ctx, this.successWord.emoji, b.x + b.w + 96, gy, 96, { shadow: true });
        softText(ctx, this.successWord.word, b.x + b.w + 96, gy + 76, 30, { color: Palette.inkSoft });
      }
    } else {
      this.drawHints(ctx);
      this.drawProgress(ctx);
    }
  }

  drawHints(ctx) {
    if (!this.startDot) return;
    const inv = 1 / this.maskScale;
    const sx = this.box.x + this.startDot[0] * inv;
    const sy = this.box.y + this.startDot[1] * inv;

    if (!this.strokes.length) {
      // The pulse steps between whole-texel radii rather than scaling smoothly.
      const pulse = Math.round((Math.sin(this.t * 4) + 1));
      ctx.save();
      pixelCircle(ctx, sx, sy, PX * 5 + pulse * PX, { fill: '#ffc93c', outline: '#ffffff' });
      softText(ctx, 'Start here', sx, sy - 46, 22, { color: Palette.inkSoft });
      ctx.restore();
    }

    if (this.ghost > 0 && this.samples.length) {
      // A dot that walks the glyph, so the shape is demonstrated, not described.
      const k = Math.floor(((1 - this.ghost) * 2.6 % 1) * this.samples.length);
      const p = this.samples[clamp(k, 0, this.samples.length - 1)];
      ctx.save();
      ctx.globalAlpha = stepAlpha(clamp(this.ghost * 1.4, 0, 1) * 0.85);
      pixelCircle(ctx, this.box.x + p[0] * inv, this.box.y + p[1] * inv, PX * 5, { fill: '#5b8cff' });
      ctx.restore();
    }
  }

  drawProgress(ctx) {
    const b = this.box;
    const w = px(b.w * 0.7);
    const x = px(this.cx - w / 2);
    const y = px(b.y + b.h + 44);
    const h = PX * 5;
    pixelRect(ctx, x, y, w, h, { fill: 'rgba(255,255,255,0.7)', outline: 'rgba(44,35,64,0.4)', chamfer: PX });
    const filled = clamp(this.coverage / DONE_AT, 0, 1);
    if (filled > 0.01) {
      // Flat fill inside the outline, its width stepping texel by texel.
      ctx.fillStyle = this.tint;
      const fw = Math.min(w - PX * 2, Math.max(PX * 4, px((w - PX * 2) * filled)));
      ctx.fillRect(x + PX, y + PX, fw, h - PX * 2);
    }
  }

  destroy() {
    // Release the offscreen surfaces rather than leaving them to the collector.
    this.mask = null;
    this.paint = null;
    this.samples = null;
    this.strokes = null;
  }
}
