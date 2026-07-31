/**
 * Canvas UI widgets.
 *
 * Sizing rule for this project: nothing interactive is ever smaller than
 * MIN_TOUCH logical pixels. Five-year-old fingers are imprecise and the whole
 * arcade should be forgiving by construction.
 */

import { clamp, pointInRect, pointInCircle, withAlpha, shade } from './util.js';
import { Spring } from './anim.js';
import {
  candyRect, candyCircle, bubbleText, softText, roundRect, glassPanel,
  drawEmoji, goldStar, font, Palette, fitFontSize, starPath,
} from './art.js';

export const MIN_TOUCH = 96;

/* ------------------------------------------------------------------ buttons */

export class Button {
  /**
   * @param {object} o
   * @param {number} o.x,o.y   top-left corner (or centre when `circle`)
   * @param {string} o.label   text (optional)
   * @param {string} o.emoji   emoji glyph (optional)
   * @param {Function} o.onTap
   */
  constructor({
    x, y, w = 220, h = MIN_TOUCH, r = 28, label = '', emoji = '', color = Palette.sun,
    onTap = null, circle = false, radius = 52, textColor = '#ffffff', fontSize = null,
    enabled = true, hidden = false, id = null, sublabel = '',
  }) {
    Object.assign(this, {
      x, y, w, h, r, label, emoji, color, onTap, circle, radius,
      textColor, fontSize, enabled, hidden, id, sublabel,
    });
    this.press = new Spring(0, 320, 26);
    this.scale = new Spring(1, 260, 20);
    this.glow = 0;
    this.held = false;
  }

  get cx() { return this.circle ? this.x : this.x + this.w / 2; }
  get cy() { return this.circle ? this.y : this.y + this.h / 2; }

  hit(p) {
    if (this.hidden || !this.enabled) return false;
    if (this.circle) return pointInCircle(p.x, p.y, this.x, this.y, Math.max(this.radius, MIN_TOUCH / 2));
    // Expand the hit box to guarantee a comfortable target even for small chips.
    const padX = Math.max(0, (MIN_TOUCH - this.w) / 2);
    const padY = Math.max(0, (MIN_TOUCH - this.h) / 2);
    return pointInRect(p.x, p.y, this.x - padX, this.y - padY, this.w + padX * 2, this.h + padY * 2);
  }

  step(dt) { this.press.step(dt); this.scale.step(dt); this.glow = Math.max(0, this.glow - dt * 2); }

  /** Squash on press. */
  setHeld(v) { this.held = v; this.press.target = v ? 1 : 0; this.scale.target = v ? 0.96 : 1; }

  /** Attention pulse — used to nudge a child who has stalled. */
  pulse() { this.scale.set(1.12); this.scale.target = 1; this.glow = 1; }

  draw(ctx) {
    if (this.hidden) return;
    const s = this.scale.value;
    const dim = this.enabled ? 1 : 0.45;
    ctx.save();
    ctx.globalAlpha *= dim;
    ctx.translate(this.cx, this.cy);
    ctx.scale(s, s);
    ctx.translate(-this.cx, -this.cy);

    if (this.circle) {
      const r = this.radius;
      candyCircle(ctx, this.x, this.y + this.press.value * 5, r, this.color,
        { stroke: 'rgba(255,255,255,0.85)', strokeWidth: 5, glow: this.glow });
      if (this.emoji) drawEmoji(ctx, this.emoji, this.x, this.y + this.press.value * 5, r * 1.05);
      else if (this.label) {
        bubbleText(ctx, this.label, this.x, this.y + this.press.value * 5,
          this.fontSize || r * 0.9, { fill: this.textColor, stroke: shade(this.color, -0.45) });
      }
    } else {
      candyRect(ctx, this.x, this.y, this.w, this.h, this.r, this.color,
        { pressed: this.press.value, stroke: 'rgba(255,255,255,0.8)', strokeWidth: 4, glow: this.glow });
      const oy = this.press.value * 8;
      let tx = this.x + this.w / 2;
      if (this.emoji && this.label) {
        const gap = this.h * 0.52;
        drawEmoji(ctx, this.emoji, this.x + this.h * 0.5, this.y + this.h / 2 - oy, this.h * 0.52);
        tx = this.x + this.h * 0.5 + gap * 0.6 + (this.w - this.h - gap * 0.6) / 2;
      } else if (this.emoji) {
        drawEmoji(ctx, this.emoji, tx, this.y + this.h / 2 - oy, this.h * 0.58);
      }
      if (this.label) {
        const size = this.fontSize || fitFontSize(ctx, this.label, this.w * 0.78, this.h * 0.44);
        bubbleText(ctx, this.label, tx, this.y + this.h / 2 - oy + (this.sublabel ? -this.h * 0.1 : 0), size,
          { fill: this.textColor, stroke: shade(this.color, -0.45) });
      }
      if (this.sublabel) {
        softText(ctx, this.sublabel, this.x + this.w / 2, this.y + this.h * 0.74 - oy, this.h * 0.2,
          { color: 'rgba(255,255,255,0.9)' });
      }
    }
    ctx.restore();
  }
}

/**
 * Manages a set of buttons: routes pointer events, animates, draws.
 * Returns the button that was activated so callers can react.
 */
export class ButtonLayer {
  constructor() { this.buttons = []; this.active = null; }
  add(btn) { this.buttons.push(btn); return btn; }
  addAll(btns) { btns.forEach((b) => this.buttons.push(b)); return btns; }
  remove(btn) { this.buttons = this.buttons.filter((b) => b !== btn); }
  clear() { this.buttons.length = 0; this.active = null; }
  get(id) { return this.buttons.find((b) => b.id === id); }

  pointerDown(p) {
    for (let i = this.buttons.length - 1; i >= 0; i--) {
      const b = this.buttons[i];
      if (b.hit(p)) { this.active = b; b.setHeld(true); return b; }
    }
    return null;
  }

  pointerMove(p) {
    if (this.active && !this.active.hit(p)) { this.active.setHeld(false); this.active = null; }
  }

  /** @returns {Button|null} the button whose onTap fired. */
  pointerUp(p) {
    const b = this.active;
    this.active = null;
    if (!b) return null;
    b.setHeld(false);
    if (b.hit(p) && b.enabled && !b.hidden) { b.onTap?.(b); return b; }
    return null;
  }

  step(dt) { for (const b of this.buttons) b.step(dt); }
  draw(ctx) { for (const b of this.buttons) if (!b.hidden) b.draw(ctx); }
}

/* -------------------------------------------------------------- speech bubble */

/**
 * The instruction bubble. Pairs with `audio.speak` so a pre-reader always hears
 * the task as well as seeing it.
 */
export function speechBubble(ctx, x, y, w, text, { size = 34, tail = 'left', color = '#ffffff' } = {}) {
  const pad = 26;
  ctx.save();
  ctx.font = font(size, 800);
  const lines = wrapText(ctx, text, w - pad * 2);
  const lineH = size * 1.22;
  const h = lines.length * lineH + pad * 1.6;
  const bx = x - w / 2;
  const by = y - h / 2;

  ctx.shadowColor = 'rgba(44,35,64,0.22)';
  ctx.shadowBlur = 24;
  ctx.shadowOffsetY = 8;
  roundRect(ctx, bx, by, w, h, 30);
  ctx.fillStyle = color;
  ctx.fill();
  ctx.shadowBlur = 0;
  ctx.shadowOffsetY = 0;

  if (tail !== 'none') {
    const dir = tail === 'left' ? -1 : 1;
    ctx.beginPath();
    ctx.moveTo(x + dir * (w / 2 - 6), y + h * 0.12);
    ctx.lineTo(x + dir * (w / 2 + 26), y + h * 0.30);
    ctx.lineTo(x + dir * (w / 2 - 18), y + h * 0.36);
    ctx.closePath();
    ctx.fillStyle = color;
    ctx.fill();
  }

  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = Palette.ink;
  lines.forEach((ln, i) => {
    ctx.fillText(ln, x, by + pad * 0.8 + lineH * (i + 0.5));
  });
  ctx.restore();
  return h;
}

export function wrapText(ctx, text, maxWidth) {
  const words = String(text).split(/\s+/);
  const lines = [];
  let line = '';
  for (const word of words) {
    const test = line ? `${line} ${word}` : word;
    if (ctx.measureText(test).width > maxWidth && line) { lines.push(line); line = word; }
    else line = test;
  }
  if (line) lines.push(line);
  return lines;
}

/* ------------------------------------------------------------ results screen */

/**
 * End-of-round celebration overlay. Every game funnels into this so the reward
 * moment is identical everywhere — one thing a child can rely on.
 */
export class ResultsPanel {
  constructor({ W, H, onAgain, onHome, onNext }) {
    this.W = W; this.H = H;
    this.visible = false;
    this.t = 0;
    this.stars = 0;
    this.shownStars = 0;
    this.title = 'Great job!';
    this.sticker = null;
    this.pop = new Spring(0, 190, 17);
    this.buttons = new ButtonLayer();

    // Everything is positioned relative to the panel rect so the whole dialog
    // stays inside its own card at any aspect ratio.
    const pw = Math.min(900, W * 0.84);
    const ph = Math.min(640, H * 0.76);
    this.panel = { x: W / 2 - pw / 2, y: H * 0.48 - ph / 2, w: pw, h: ph };
    this.titleY = this.panel.y + ph * 0.13;
    this.starsY = this.panel.y + ph * 0.35;
    this.stickerY = this.panel.y + ph * 0.59;
    this.starR = Math.min(64, ph * 0.105);

    const bw = Math.min(238, (pw - 4 * 22) / 3);
    const bh = 104, gap = 22;
    const bx = W / 2 - (bw * 3 + gap * 2) / 2;
    const by = this.panel.y + ph - bh - ph * 0.075;
    const mk = (i, emoji, label, color, onTap) => this.buttons.add(new Button({
      x: bx + i * (bw + gap), y: by, w: bw, h: bh, emoji, label, color, onTap,
    }));
    this.homeBtn = mk(0, '🏠', 'Home', '#8a8fb5', onHome);
    this.againBtn = mk(1, '🔁', 'Again', '#4cc9f0', onAgain);
    this.nextBtn = mk(2, '➡️', 'Next', '#3ddc97', onNext);
  }

  show({ stars = 3, title = 'Great job!', sticker = null, hasNext = true } = {}) {
    this.visible = true;
    this.t = 0;
    this.stars = stars;
    this.shownStars = 0;
    this.title = title;
    this.sticker = sticker;
    this.nextBtn.hidden = !hasNext;
    this.pop.set(0);
    this.pop.target = 1;
  }

  hide() { this.visible = false; this.pop.set(0); this.pop.target = 0; }

  step(dt, audio) {
    if (!this.visible) return;
    this.t += dt;
    this.pop.step(dt);
    this.buttons.step(dt);
    // Stars land one at a time, each with its own chime.
    const target = this.t > 0.5 ? Math.min(this.stars, Math.floor((this.t - 0.5) / 0.42) + 1) : 0;
    if (target > this.shownStars) { this.shownStars = target; audio?.star(); }
  }

  pointerDown(p) { return this.visible ? this.buttons.pointerDown(p) : null; }
  pointerMove(p) { if (this.visible) this.buttons.pointerMove(p); }
  pointerUp(p) { return this.visible ? this.buttons.pointerUp(p) : null; }

  draw(ctx) {
    if (!this.visible) return;
    const { W, H, panel } = this;
    const k = clamp(this.pop.value, 0, 1.2);
    const pivotY = panel.y + panel.h / 2;
    ctx.save();
    ctx.fillStyle = `rgba(30,22,48,${0.5 * clamp(k, 0, 1)})`;
    ctx.fillRect(0, 0, W, H);

    ctx.translate(W / 2, pivotY);
    ctx.scale(k, k);
    ctx.translate(-W / 2, -pivotY);

    glassPanel(ctx, panel.x, panel.y, panel.w, panel.h, 46, { alpha: 0.96 });

    const titleSize = fitFontSize(ctx, this.title, panel.w * 0.82, 66);
    bubbleText(ctx, this.title, W / 2, this.titleY, titleSize, { fill: '#ffd76a', stroke: Palette.ink });

    const sgap = this.starR * 2.7;
    for (let i = 0; i < 3; i++) {
      const sx = W / 2 + (i - 1) * sgap;
      const earned = i < this.shownStars;
      // Each star lands with a little overshoot as it is awarded.
      const age = clamp((this.t - 0.5 - i * 0.42) / 0.42, 0, 1);
      const bump = earned ? 1 + Math.max(0, 1 - age) * 0.5 : 1;
      goldStar(ctx, sx, this.starsY, this.starR * bump,
        { filled: earned, glow: earned ? 1 : 0, rot: earned ? (1 - age) * 1.2 : 0 });
    }

    if (this.sticker) {
      softText(ctx, 'New sticker!', W / 2, this.stickerY - 34, 28, { color: Palette.inkSoft });
      drawEmoji(ctx, this.sticker, W / 2, this.stickerY + 22, 68, { shadow: true });
    }

    this.buttons.draw(ctx);
    ctx.restore();
  }
}

/* ------------------------------------------------------------------- helpers */

/** Slot outline used by every drag-into-place game. */
export function drawSlot(ctx, x, y, w, h, { r = 22, active = false, filled = false, color = '#ffffff' } = {}) {
  ctx.save();
  roundRect(ctx, x, y, w, h, r);
  ctx.fillStyle = filled ? 'rgba(255,255,255,0.14)' : withAlpha(color === '#ffffff' ? '#ffffff' : color, active ? 0.5 : 0.28);
  ctx.fill();
  ctx.setLineDash(filled ? [] : [14, 12]);
  ctx.lineWidth = active ? 7 : 5;
  ctx.strokeStyle = active ? '#ffffff' : 'rgba(255,255,255,0.85)';
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.restore();
}

/** Small pill label, e.g. "Level 2". */
export function pill(ctx, x, y, text, { size = 26, color = '#ffffff', textColor = Palette.ink, padX = 22 } = {}) {
  ctx.save();
  ctx.font = font(size, 800);
  const w = ctx.measureText(text).width + padX * 2;
  const h = size * 1.9;
  roundRect(ctx, x - w / 2, y - h / 2, w, h, h / 2);
  ctx.fillStyle = color;
  ctx.shadowColor = 'rgba(44,35,64,0.18)';
  ctx.shadowBlur = 12;
  ctx.shadowOffsetY = 4;
  ctx.fill();
  ctx.shadowBlur = 0;
  ctx.shadowOffsetY = 0;
  ctx.fillStyle = textColor;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, x, y);
  ctx.restore();
  return w;
}

/** Star counter chip for the HUD. */
export function starChip(ctx, x, y, count) {
  ctx.save();
  const text = String(count);
  ctx.font = font(30, 900);
  const w = 62 + ctx.measureText(text).width;
  roundRect(ctx, x - w, y - 27, w, 54, 27);
  ctx.fillStyle = 'rgba(255,255,255,0.9)';
  ctx.fill();
  starPath(ctx, x - w + 27, y, 17, 8, 5);
  ctx.fillStyle = '#ffc93c';
  ctx.fill();
  ctx.lineWidth = 2.5;
  ctx.strokeStyle = '#e2820f';
  ctx.stroke();
  ctx.fillStyle = Palette.ink;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, x - w + 48, y + 1);
  ctx.restore();
  return w;
}
