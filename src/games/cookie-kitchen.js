/**
 * Cookie Kitchen — ten frames, subitising and number bonds.
 *
 * A ten frame is the single most useful tool in early arithmetic: filling one
 * makes "six" stop being a word you count to and start being a shape you
 * recognise — five and one more. Level 2 turns that into number bonds ("the
 * tray needs ten, how many more?") and level 3 into teen numbers, where
 * "ten and four is fourteen" becomes visible rather than memorised.
 */

import { Game } from '../core/engine.js';
import { Button } from '../core/ui.js';
import { DragController } from '../core/input.js';
import {
  candyCircle, candyRect, softText,
  PX, px, stepAlpha, pixelRect, pixelCircle, pixelRing, HARD_SHADOW,
} from '../core/art.js';
import { drawSprite, hasSprite } from '../core/sprites.js';
import { Ease } from '../core/anim.js';
import { randInt, clamp, hashNoise, pick, TAU } from '../core/util.js';
import { numberWord, PRAISE } from '../data/words.js';

const DOUGH = '#d99553';
const CHIP = '#5c3218';

export default class CookieKitchen extends Game {
  static meta = {
    id: 'cookie-kitchen',
    title: 'Cookie Kitchen',
    subject: 'math',
    blurb: 'Fill the tray to bake the right number.',
    emoji: '🍪',
    tint: '#e8913c',
  };

  init() {
    this.maxLevel = 3;
    this.roundsTotal = 6;
    this.busy = false;
    this.baking = 0;
    this.cookies = [];
    this.backdrop = { top: '#ffe6c2', bottom: '#ffd0a8', hills: ['#e9b98a', '#d79f6d'] };

    this.drag = new DragController({
      items: () => this.cookies,
      radius: 52,
      canPick: () => !this.busy,
      onPick: (c) => { c.fromSlot = c.slot; c.slot = -1; this.audio.pick(); },
      onDrop: (c) => this.dropCookie(c),
    });

    this.newRound();
  }

  get frames() { return this.level === 3 ? 2 : 1; }

  /* ------------------------------------------------------------ round setup */

  newRound() {
    this.busy = false;
    this.baking = 0;
    this.wrongTries = 0;

    if (this.level === 1) {
      this.target = randInt(3, 10);
      this.preset = 0;
    } else if (this.level === 2) {
      this.target = 10;
      this.preset = randInt(2, 7);   // already on the tray; the child adds the rest
    } else {
      this.target = randInt(11, 20);
      this.preset = 0;
    }

    this.slotCount = this.frames * 10;
    this.slots = new Array(this.slotCount).fill(null);
    this.cookies = [];

    for (let i = 0; i < this.preset; i++) this.addCookie({ slot: i, locked: true });
    // A couple of spare cookies in the jar so over-filling stays possible —
    // noticing "that's too many" is part of the learning.
    const spare = this.level === 2 ? 3 : 2;
    const needed = this.target - this.preset + spare;
    for (let i = 0; i < needed; i++) this.addCookie({ slot: -1 });

    this.setPrompt(this.promptText(), { speech: this.promptSpeechText() });
    this.layout();
  }

  promptText() {
    if (this.level === 2) return `The tray needs 10. How many more?`;
    return `Put ${this.target} cookies on the tray`;
  }

  promptSpeechText() {
    if (this.level === 2) {
      return `The tray has ${numberWord(this.preset)} cookies. It needs ten. How many more?`;
    }
    return `Put ${numberWord(this.target)} cookies on the tray.`;
  }

  addCookie({ slot = -1, locked = false } = {}) {
    const id = this.cookies.length;
    this.cookies.push({
      id, slot, locked,
      x: 0, y: 0, homeX: 0, homeY: 0,
      hitRadius: 52,
      dragging: false,
      // Fixed per-cookie chocolate chips: a cookie must not shimmer as it moves.
      chips: Array.from({ length: 4 }, (_, k) => ({
        a: hashNoise(id * 17 + k) * TAU,
        d: 0.22 + hashNoise(id * 31 + k) * 0.42,
        r: 0.1 + hashNoise(id * 53 + k) * 0.06,
      })),
      wobble: 0,
    });
    return this.cookies[id];
  }

  /* ---------------------------------------------------------------- layout */

  layout() {
    if (!this.cookies) return;

    const twoUp = this.frames === 2;
    const maxW = Math.min(this.W * (twoUp ? 0.8 : 0.56), twoUp ? 980 : 660);
    this.cell = clamp(maxW / (twoUp ? 11 : 5.4), 62, 120);

    const frameW = this.cell * 5;
    const frameH = this.cell * 2;
    const frameGap = this.cell * 0.55;
    const totalW = frameW * this.frames + frameGap * (this.frames - 1);

    this.tray = {
      x: this.cx - totalW / 2 - this.cell * 0.36,
      y: this.playTop + this.cell * 0.5,
      w: totalW + this.cell * 0.72,
      h: frameH + this.cell * 0.72,
      frameW, frameH, frameGap,
    };

    for (let i = 0; i < this.slotCount; i++) {
      const f = Math.floor(i / 10);
      const k = i % 10;
      const col = k % 5;
      const row = Math.floor(k / 5);
      this.slotPos(i, {
        x: this.tray.x + this.cell * 0.36 + f * (frameW + frameGap) + col * this.cell + this.cell / 2,
        y: this.tray.y + this.cell * 0.36 + row * this.cell + this.cell / 2,
      });
    }

    // Loose cookies rest on a counter shelf along the bottom of the screen.
    this.counterY = this.H - this.cell * 1.25;
    const loose = this.cookies.filter((c) => c.slot < 0);
    const spread = Math.min(this.W * 0.8, loose.length * this.cell * 1.02);
    loose.forEach((c, i) => {
      const t = loose.length === 1 ? 0.5 : i / (loose.length - 1);
      c.homeX = this.cx - spread / 2 + t * spread;
      c.homeY = this.counterY + Math.sin(t * Math.PI) * -this.cell * 0.14;
      if (!c.dragging) { c.x = c.homeX; c.y = c.homeY; }
    });

    for (const c of this.cookies) {
      if (c.slot >= 0) { c.x = this.slots[c.slot].x; c.y = this.slots[c.slot].y; }
      c.hitRadius = this.cell * 0.5;
    }

    this.buttons.clear();
    this.bakeBtn = this.buttons.add(new Button({
      x: this.W - 250, y: this.tray.y + this.tray.h / 2 - 56,
      w: 210, h: 112, r: PX * 2, emoji: 'icon-flame', label: 'Bake!', color: '#ff7a3d',
      enabled: false,
      onTap: () => this.bake(),
    }));
    // Keep the button clear of the tray on narrow screens.
    if (this.bakeBtn.x < this.tray.x + this.tray.w + 20) {
      this.bakeBtn.x = this.cx - 105;
      this.bakeBtn.y = this.tray.y + this.tray.h + 62;
    }
    this.refreshBake();
  }

  slotPos(i, pos) {
    if (!this.slots[i]) this.slots[i] = {};
    Object.assign(this.slots[i], pos);
  }

  get filled() { return this.cookies.filter((c) => c.slot >= 0).length; }

  refreshBake() {
    if (!this.bakeBtn) return;
    const ready = this.filled === this.target && !this.busy;
    if (ready && !this.bakeBtn.enabled) this.bakeBtn.pulse();
    this.bakeBtn.enabled = ready;
  }

  /* ----------------------------------------------------------------- input */

  onPointerDown(p) { if (!this.busy) this.drag.begin(p); }
  onPointerMove(p) { this.drag.move(p); }
  onPointerUp(p) { this.drag.end(p); }

  hintPulse() {
    for (const c of this.cookies) if (c.slot < 0) c.wobble = 1;
  }

  /**
   * Drop anywhere on the tray and the cookie takes the *next* free slot rather
   * than the nearest one. A ten frame only teaches subitising if it fills in
   * order — five along the top, then the second row — so the arrangement is not
   * the child's to get wrong.
   */
  dropCookie(c) {
    const t = this.tray;
    const overTray = c.x > t.x - this.cell * 0.6 && c.x < t.x + t.w + this.cell * 0.6
      && c.y > t.y - this.cell * 0.6 && c.y < t.y + t.h + this.cell * 0.6;
    let best = -1;
    if (overTray) {
      for (let i = 0; i < this.slotCount; i++) {
        if (this.cookies.some((o) => o !== c && o.slot === i)) continue;
        best = i;
        break;
      }
    }

    if (best < 0) {
      // Back to the jar — dropping a cookie off the tray is how you undo.
      c.slot = -1;
      this.tweens.to(c, { x: c.homeX, y: c.homeY }, 0.28, { ease: Ease.outBack });
      if (c.fromSlot >= 0) this.audio.place();
      this.refreshBake();
      return;
    }

    if (this.filled >= this.target && c.fromSlot < 0) {
      // Over-filling: bounce it back and say so, but never lock the child out.
      c.slot = -1;
      this.tweens.to(c, { x: c.homeX, y: c.homeY }, 0.3, { ease: Ease.outBack });
      this.audio.wrong();
      this.audio.speak(`That is too many. The tray needs ${numberWord(this.target)}.`);
      this.fx.puff(c.homeX, c.homeY, 6);
      this.refreshBake();
      return;
    }

    c.slot = best;
    this.tweens.to(c, { x: this.slots[best].x, y: this.slots[best].y }, 0.16, { ease: Ease.outQuad });
    this.audio.place();
    this.fx.sparkle(this.slots[best].x, this.slots[best].y, 6, { color: '#ffd9a0', spread: 70 });
    const n = this.filled;
    this.audio.step(Math.min(9, n - 1));
    this.audio.speak(numberWord(n), { rate: 1 });
    this.refreshBake();
  }

  /* ------------------------------------------------------------------ bake */

  bake() {
    if (this.busy || this.filled !== this.target) return;
    this.busy = true;
    this.bakeBtn.enabled = false;
    this.roundsDone++;
    this.audio.whoosh();

    this.tweens.to(this, { baking: 1 }, 0.75, { ease: Ease.inOutCubic });
    this.tweens.after(0.8, () => {
      this.fx.puff(this.cx, this.tray.y + this.tray.h / 2, 22, 'rgba(255,255,255,0.95)');
      this.fx.sparkle(this.cx, this.tray.y + this.tray.h / 2, 22, { color: '#ffd9a0', spread: 260 });
      this.audio.correct();
      this.audio.speak(this.successLine(), { delay: 0.2 });
    });
    this.tweens.after(2.6, () => {
      if (this.roundsDone >= this.roundsTotal) this.finishRound({ title: pick(PRAISE) });
      else this.newRound();
    });
  }

  successLine() {
    if (this.level === 2) {
      const added = this.target - this.preset;
      return `${numberWord(this.preset)} and ${numberWord(added)} more makes ten!`;
    }
    if (this.level === 3) {
      const extra = this.target - 10;
      return `Ten and ${numberWord(extra)} is ${numberWord(this.target)}!`;
    }
    return `${numberWord(this.target)} cookies! ${pick(PRAISE)}`;
  }

  /* ------------------------------------------------------------------ frame */

  update(dt) {
    for (const c of this.cookies) if (c.wobble > 0) c.wobble = Math.max(0, c.wobble - dt * 1.4);
    if (this.drag.held) this.fx.trail(this.drag.held.x, this.drag.held.y, 'rgba(255,220,170,0.8)');
  }

  draw(ctx) {
    this.drawOven(ctx);
    ctx.save();
    // The whole tray slides into the oven when it bakes — snapped to the texel
    // grid, with a fade that steps in eighths.
    const slide = Ease.inOutCubic(clamp(this.baking, 0, 1));
    ctx.translate(0, -px(slide * (this.tray.y - this.playTop + 40)));
    ctx.globalAlpha = stepAlpha(1 - slide * 0.55);
    this.drawTray(ctx);
    for (const c of this.cookies) if (c.slot >= 0 && !c.dragging) this.drawCookie(ctx, c);
    ctx.restore();

    if (this.baking < 0.6) {
      this.drawCounter(ctx);
      for (const c of this.cookies) if (c.slot < 0 && !c.dragging) this.drawCookie(ctx, c);
    }
    // Whatever is in hand draws last, above everything.
    for (const c of this.cookies) if (c.dragging) this.drawCookie(ctx, c, 1.14);

    if (this.baking < 0.4) {
      softText(ctx, `${this.filled} on the tray`, this.cx, this.tray.y + this.tray.h + 34, 28,
        { color: 'rgba(60,40,25,0.62)' });
    }
  }

  drawOven(ctx) {
    if (this.baking <= 0) return;
    const glow = Ease.pulse(clamp(this.baking, 0, 1)) + this.baking * 0.4;
    // Oven heat: flat concentric discs that stack toward the centre, each layer
    // stepped in eighths — the 16-bit stand-in for the old radial glow.
    ctx.save();
    const bands = [[0.5, 0.2], [0.36, 0.3], [0.22, 0.4]];
    for (const [rad, a] of bands) {
      ctx.globalAlpha = stepAlpha(0.55 * glow * a);
      pixelCircle(ctx, this.cx, this.playTop, this.W * rad, { fill: '#ffaa3c' });
    }
    ctx.restore();
  }

  drawTray(ctx) {
    const t = this.tray;
    // baking tray, with a flat parchment inner surface (chamfered, no arcs)
    candyRect(ctx, t.x, t.y, t.w, t.h, 26, '#a98763', { depth: 10, gloss: false });
    pixelRect(ctx, t.x + PX * 2, t.y + PX * 2, t.w - PX * 4, t.h - PX * 4, { fill: '#d8c3aa' });

    // ten frame(s): 5 + 5, with a heavier rule down the middle so the "five and
    // some more" structure is visible at a glance.
    for (let f = 0; f < this.frames; f++) {
      const fx = t.x + this.cell * 0.36 + f * (t.frameW + t.frameGap);
      const fy = t.y + this.cell * 0.36;
      for (let i = 0; i < 10; i++) {
        const col = i % 5;
        const row = Math.floor(i / 5);
        pixelRect(ctx, fx + col * this.cell + PX, fy + row * this.cell + PX,
          this.cell - PX * 2, this.cell - PX * 2,
          { fill: '#f9f4e9', outline: '#dac8b1' });
      }
      // the mid rule is a flat two-texel bar filling the gap between the rows
      ctx.fillStyle = '#a3896e';
      ctx.fillRect(px(fx), px(fy + this.cell) - PX, px(t.frameW), PX * 2);
    }
  }

  /** A wooden counter the loose cookies sit on, so they read as "not placed yet". */
  drawCounter(ctx) {
    const y = this.counterY + this.cell * 0.42;
    candyRect(ctx, 0, y, this.W, this.H - y, 0, '#c99a68', { depth: 0, gloss: false });
    // one-texel light band along the counter's top edge
    ctx.fillStyle = '#e2c8ad';
    ctx.fillRect(0, px(y) + PX, this.W, PX);
    softText(ctx, 'Drag the cookies onto the tray', this.cx, y + this.cell * 0.5, 24,
      { color: 'rgba(70,45,25,0.55)' });
  }

  drawCookie(ctx, c, scale = 1) {
    const r = this.cell * 0.4;
    const wob = c.wobble > 0 ? Math.sin(this.t * 24) * 5 * c.wobble : 0;
    ctx.save();
    ctx.translate(px(c.x + wob), px(c.y));
    ctx.scale(scale, scale);
    if (c.dragging) {
      // Hard offset silhouette under the held cookie — never a blur.
      pixelCircle(ctx, 0, PX * 2, r, { fill: HARD_SHADOW });
    }
    if (hasSprite('cookie-1')) {
      // One of three chip layouts, chosen by id so a cookie keeps its face as it
      // moves; pre-baked ones take the darker "already on the tray" variant. The
      // sprite cell carries a little padding, so it draws a touch over 2r.
      drawSprite(ctx, c.locked ? 'cookie-dark' : `cookie-${1 + (c.id % 3)}`, 0, 0, this.cell * 0.88);
      ctx.restore();
      return;
    }
    // Pre-baked cookies take a flat lighter dough so they read as "already
    // there" without looking broken.
    candyCircle(ctx, 0, 0, r, c.locked ? '#d09456' : DOUGH, { gloss: false });
    // baked edge — a hard pixel ring just inside the rim
    pixelRing(ctx, 0, 0, px(r) - PX, PX, '#b7793f');
    // chocolate chips as chunky one/two-texel squares
    ctx.fillStyle = CHIP;
    for (const chip of c.chips) {
      const s = Math.min(PX * 2, Math.max(PX, px(chip.r * r * 2)));
      ctx.fillRect(px(Math.cos(chip.a) * r * chip.d - s / 2),
        px(Math.sin(chip.a) * r * chip.d - s / 2), s, s);
    }
    ctx.restore();
  }
}
