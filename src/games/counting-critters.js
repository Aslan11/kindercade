/**
 * Counting Critters — one-to-one counting and numeral recognition.
 *
 * The teaching move here is the tap-to-count step: the child touches each
 * creature in turn, it pops and takes a number badge, and the voice says the
 * number word. That is one-to-one correspondence — the idea that counting is
 * pairing one number with one thing — which has to come before numerals mean
 * anything. Answering straight away is allowed for a child who already knows.
 */

import { Game } from '../core/engine.js';
import { Button } from '../core/ui.js';
import { drawEmoji, bubbleText, glassPanel, pixelCircle, softText, PX, px, stepAlpha } from '../core/art.js';
import { Ease } from '../core/anim.js';
import { randInt, shuffle, pick, dist, clamp, rand, TAU, shade } from '../core/util.js';
import { COUNTABLES, numberWord, PRAISE } from '../data/words.js';

const RANGES = { 1: [1, 5], 2: [1, 10], 3: [6, 20] };

export default class CountingCritters extends Game {
  static meta = {
    id: 'counting-critters',
    title: 'Counting Critters',
    subject: 'math',
    blurb: 'Count the creatures, then tap the number.',
    emoji: '🐞',
    tint: '#ff8a4c',
  };

  init() {
    this.maxLevel = 3;
    this.roundsTotal = 6;
    this.busy = false;
    this.wiggle = 0;
    this.backdrop = { top: '#c9f0ff', bottom: '#fff0d0', hills: ['#9ae7ac', '#68d18e'] };
    this.field = { x: 0, y: 0, w: 0, h: 0 };
    this.newRound();
  }

  /* ------------------------------------------------------------ round setup */

  newRound() {
    const [lo, hi] = RANGES[this.level] || RANGES[1];
    this.count = randInt(lo, hi);
    this.kind = pick(COUNTABLES);
    this.critters = this.makeCritters(this.count);
    this.choices = this.makeChoices(this.count, this.level >= 3 ? 4 : 3);
    this.wrongTries = 0;
    this.busy = false;
    this.counted = 0;
    this.setPrompt(`How many ${this.kind.name}?`);
    this.layout();
  }

  /**
   * Positions are stored normalised (0..1) inside the field so a rotation just
   * re-maps them. A jittered grid keeps large counts genuinely countable —
   * a random scatter of fifteen things is a mess for a five-year-old.
   */
  makeCritters(n) {
    const cols = n <= 3 ? n : n <= 6 ? 3 : n <= 8 ? 4 : 5;
    const rows = Math.ceil(n / cols);
    const out = [];
    for (let i = 0; i < n; i++) {
      const r = Math.floor(i / cols);
      const c = i % cols;
      // Centre the last (possibly short) row.
      const inRow = r === rows - 1 ? n - r * cols : cols;
      const spanX = (c + 0.5) / inRow;
      out.push({
        nx: clamp(spanX + rand(-0.03, 0.03), 0.07, 0.93),
        ny: clamp((r + 0.5) / rows + rand(-0.05, 0.05), 0.12, 0.88),
        x: 0, y: 0, counted: false, index: 0,
        phase: rand(0, TAU), pop: 0, gone: 0,
      });
    }
    return shuffle(out);
  }

  /** Distractors sit close to the answer, so it is a counting task not a guess. */
  makeChoices(answer, n) {
    const [lo, hi] = RANGES[this.level] || RANGES[1];
    const near = [answer - 1, answer + 1, answer - 2, answer + 2, answer + 3, answer - 3]
      .filter((v) => v >= Math.max(0, lo - 1) && v <= hi + 2 && v !== answer);
    return shuffle([answer, ...shuffle(near).slice(0, n - 1)]);
  }

  layout() {
    if (!this.critters) return;
    const pad = this.W * 0.05;
    this.field = { x: pad, y: this.playTop, w: this.W - pad * 2, h: this.H * 0.44 };

    for (const c of this.critters) {
      c.x = this.field.x + c.nx * this.field.w;
      c.y = this.field.y + c.ny * this.field.h;
    }
    this.critterSize = clamp(this.field.h / (this.count > 10 ? 5.2 : 3.6), 54, 108);

    this.buttons.clear();
    const n = this.choices.length;
    const tw = Math.min(180, (this.W * 0.82) / n - 24);
    const gap = 26;
    const startX = this.cx - (tw * n + gap * (n - 1)) / 2;
    const ty = this.H * 0.70;
    this.choices.forEach((value, i) => {
      this.buttons.add(new Button({
        x: startX + i * (tw + gap), y: ty, w: tw, h: 148, r: PX * 4,
        label: String(value), fontSize: 84, color: this.tint, id: `n${value}`,
        onTap: () => this.answer(value),
      }));
    });
  }

  /* ----------------------------------------------------------------- input */

  onTap(p) {
    if (this.busy) return;
    // Topmost first so overlapping critters behave predictably.
    for (let i = this.critters.length - 1; i >= 0; i--) {
      const c = this.critters[i];
      if (c.counted) continue;
      if (dist(p.x, p.y, c.x, c.y) > this.critterSize * 0.72) continue;
      c.counted = true;
      c.index = ++this.counted;
      c.pop = 1;
      this.audio.step(c.index - 1);
      this.audio.speak(numberWord(c.index), { rate: 0.95 });
      this.fx.sparkle(c.x, c.y, 8, { color: '#fff0b0', spread: 90 });
      return;
    }
  }

  hintPulse() { this.wiggle = 1.4; }

  answer(value) {
    if (this.busy) return;
    if (value !== this.count) {
      const btn = this.buttons.get(`n${value}`);
      this.nudge(btn ? btn.cx : this.cx, btn ? btn.cy : this.cy);
      if (btn) {
        btn.enabled = false;
        this.tweens.after(0.7, () => { btn.enabled = true; });
      }
      this.wrongTries++;
      if (this.wrongTries >= 2) {
        // Two misses is enough — show the answer so the round ends in a win.
        this.tweens.after(0.5, () => {
          const right = this.buttons.get(`n${this.count}`);
          right?.pulse();
          this.audio.speak(`Count again. The answer is ${numberWord(this.count)}.`);
        });
      }
      return;
    }

    this.busy = true;
    this.buttons.buttons.forEach((b) => { b.enabled = false; });
    this.roundsDone++;
    this.cheer(this.cx, this.field.y + this.field.h * 0.5, `${this.count}!`);
    this.audio.speak(`${numberWord(this.count)}! ${pick(PRAISE)}`, { delay: 0.35 });

    // The critters cheer, then float away.
    this.critters.forEach((c, i) => {
      c.counted = true;
      c.index = c.index || i + 1;
      this.tweens.after(0.05 * i, () => { c.pop = 1; });
      this.tweens.to(c, { gone: 1 }, 0.7, { delay: 0.35 + i * 0.045, ease: Ease.inCubic });
    });

    this.tweens.after(1.7, () => {
      if (this.roundsDone >= this.roundsTotal) this.finishRound({ title: pick(PRAISE) });
      else this.newRound();
    });
  }

  /* ------------------------------------------------------------------ frame */

  update(dt) {
    if (this.wiggle > 0) this.wiggle = Math.max(0, this.wiggle - dt);
    for (const c of this.critters) c.pop = Math.max(0, c.pop - dt * 3);
  }

  draw(ctx) {
    const f = this.field;
    glassPanel(ctx, f.x, f.y, f.w, f.h, PX * 4, { alpha: 0.55 });

    for (const c of this.critters) {
      if (c.gone >= 1) continue;
      // Bob, shake and the fly-away all snap to the texel grid at draw time,
      // and the departure fade steps in eighths — no sub-pixel shimmer.
      const bob = Math.sin(this.t * 1.8 + c.phase) * 7;
      const shake = this.wiggle > 0 && !c.counted
        ? Math.sin(this.t * 26 + c.phase) * 6 * this.wiggle : 0;
      const scale = 1 + Ease.pulse(clamp(c.pop, 0, 1)) * 0.32;
      const x = px(c.x + shake);
      const y = px(c.y + bob - c.gone * (f.h + 260));
      const alpha = stepAlpha(1 - c.gone);

      ctx.save();
      ctx.globalAlpha = alpha;
      drawEmoji(ctx, this.kind.emoji, x, y, this.critterSize * scale, { shadow: true });

      if (c.counted && c.gone < 0.5) {
        const bx = x + this.critterSize * 0.4;
        const by = y - this.critterSize * 0.4;
        pixelCircle(ctx, bx, by, 25, {
          fill: '#3ddc97',
          outline: shade('#3ddc97', -0.5),
          highlight: shade('#3ddc97', 0.22),
        });
        bubbleText(ctx, String(c.index), bx, by, 30, { stroke: '#1c7d55', lineWidth: 4 });
      }
      ctx.restore();
    }

    if (this.counted === 0 && !this.busy) {
      softText(ctx, 'Tap each one to count it', this.cx, f.y + f.h + 30, 25,
        { color: 'rgba(44,35,64,0.5)' });
    }
  }
}
