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
import { candyCircle, candyRect, roundRect, softText, radial } from '../core/art.js';
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
      w: 210, h: 112, r: 30, emoji: '🔥', label: 'Bake!', color: '#ff7a3d',
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
    // The whole tray slides into the oven when it bakes.
    const slide = Ease.inOutCubic(clamp(this.baking, 0, 1));
    ctx.translate(0, -slide * (this.tray.y - this.playTop + 40));
    ctx.globalAlpha = 1 - slide * 0.55;
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
    ctx.save();
    ctx.fillStyle = radial(ctx, this.cx, this.playTop, 0, this.W * 0.5,
      [[0, `rgba(255,170,60,${0.55 * glow})`], [1, 'rgba(255,170,60,0)']]);
    ctx.fillRect(0, 0, this.W, this.H);
    ctx.restore();
  }

  drawTray(ctx) {
    const t = this.tray;
    // baking tray
    candyRect(ctx, t.x, t.y, t.w, t.h, 26, '#a98763', { depth: 10, gloss: false });
    roundRect(ctx, t.x + 10, t.y + 10, t.w - 20, t.h - 20, 18);
    ctx.fillStyle = 'rgba(255,245,228,0.55)';
    ctx.fill();

    // ten frame(s): 5 + 5, with a heavier rule down the middle so the "five and
    // some more" structure is visible at a glance.
    for (let f = 0; f < this.frames; f++) {
      const fx = t.x + this.cell * 0.36 + f * (t.frameW + t.frameGap);
      const fy = t.y + this.cell * 0.36;
      for (let i = 0; i < 10; i++) {
        const col = i % 5;
        const row = Math.floor(i / 5);
        roundRect(ctx, fx + col * this.cell + 4, fy + row * this.cell + 4, this.cell - 8, this.cell - 8, 14);
        ctx.fillStyle = 'rgba(255,252,244,0.85)';
        ctx.fill();
        ctx.lineWidth = 3;
        ctx.strokeStyle = 'rgba(150,110,70,0.34)';
        ctx.stroke();
      }
      ctx.beginPath();
      ctx.moveTo(fx, fy + this.cell);
      ctx.lineTo(fx + t.frameW, fy + this.cell);
      ctx.lineWidth = 5;
      ctx.strokeStyle = 'rgba(120,90,60,0.55)';
      ctx.stroke();
    }
  }

  /** A wooden counter the loose cookies sit on, so they read as "not placed yet". */
  drawCounter(ctx) {
    const y = this.counterY + this.cell * 0.42;
    candyRect(ctx, 0, y, this.W, this.H - y, 0, '#c99a68', { depth: 0, gloss: false });
    ctx.beginPath();
    ctx.moveTo(0, y + 3);
    ctx.lineTo(this.W, y + 3);
    ctx.lineWidth = 5;
    ctx.strokeStyle = 'rgba(255,255,255,0.45)';
    ctx.stroke();
    softText(ctx, 'Drag the cookies onto the tray', this.cx, y + this.cell * 0.5, 24,
      { color: 'rgba(70,45,25,0.55)' });
  }

  drawCookie(ctx, c, scale = 1) {
    const r = this.cell * 0.4;
    const wob = c.wobble > 0 ? Math.sin(this.t * 24) * 5 * c.wobble : 0;
    ctx.save();
    ctx.translate(c.x + wob, c.y);
    ctx.scale(scale, scale);
    if (c.dragging) {
      ctx.shadowColor = 'rgba(60,40,25,0.35)';
      ctx.shadowBlur = 22;
      ctx.shadowOffsetY = 10;
    }
    candyCircle(ctx, 0, 0, r, c.locked ? '#c9853f' : DOUGH, { gloss: false });
    ctx.shadowBlur = 0;
    ctx.shadowOffsetY = 0;
    // baked edge
    ctx.beginPath();
    ctx.arc(0, 0, r * 0.94, 0, TAU);
    ctx.lineWidth = r * 0.1;
    ctx.strokeStyle = 'rgba(120,70,25,0.35)';
    ctx.stroke();
    for (const chip of c.chips) {
      ctx.beginPath();
      ctx.arc(Math.cos(chip.a) * r * chip.d, Math.sin(chip.a) * r * chip.d, r * chip.r, 0, TAU);
      ctx.fillStyle = CHIP;
      ctx.fill();
    }
    if (c.locked) {
      // Pre-baked cookies read as "already there" without looking broken.
      ctx.beginPath();
      ctx.arc(0, 0, r, 0, TAU);
      ctx.fillStyle = 'rgba(255,255,255,0.12)';
      ctx.fill();
    }
    ctx.restore();
  }
}
