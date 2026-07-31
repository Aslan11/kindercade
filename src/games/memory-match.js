/**
 * Memory Match — working memory, and quietly two other things.
 *
 * The twist is that the pairs are not always identical. Level 2 pairs a numeral
 * with a quantity, so remembering a card also means reading it as a number;
 * level 3 pairs uppercase with lowercase. Matching becomes the vehicle for the
 * correspondence, which is more useful than matching pictures alone.
 */

import { Game } from '../core/engine.js';
import { candyRect, drawEmoji, bubbleText, roundRect, starPath } from '../core/art.js';
import { Ease } from '../core/anim.js';
import { shuffle, pick, clamp, sample, pointInRect, shade } from '../core/util.js';
import { COUNTABLES, numberWord, PRAISE } from '../data/words.js';

const LEVEL_PAIRS = { 1: 4, 2: 6, 3: 8 };
const GRID = { 4: [4, 2], 6: [4, 3], 8: [4, 4] };

export default class MemoryMatch extends Game {
  static meta = {
    id: 'memory-match',
    title: 'Memory Match',
    subject: 'puzzle',
    blurb: 'Find the matching pairs.',
    emoji: '🃏',
    tint: '#9b6cff',
  };

  init() {
    this.maxLevel = 3;
    this.pairs = LEVEL_PAIRS[this.level] || 4;
    this.roundsTotal = this.pairs;
    this.busy = false;
    this.picked = [];
    this.found = 0;
    this.backdrop = { top: '#e6dcff', bottom: '#ffe6f4', hills: ['#c6b0f5', '#a98ce8'] };
    this.buildBoard();
    this.setPrompt('Find the matching pairs', { speech: 'Find two cards that go together.' });
  }

  /* ------------------------------------------------------------ board setup */

  buildBoard() {
    const cards = [];
    const addPair = (key, a, b, say) => {
      cards.push({ key, face: a, say }, { key, face: b, say });
    };

    if (this.level === 1) {
      for (const kind of sample(COUNTABLES, this.pairs)) {
        addPair(kind.emoji, { type: 'emoji', value: kind.emoji }, { type: 'emoji', value: kind.emoji }, kind.name);
      }
    } else if (this.level === 2) {
      const kind = pick(COUNTABLES);
      for (const n of sample([1, 2, 3, 4, 5, 6, 7, 8, 9, 10], this.pairs)) {
        addPair(`n${n}`,
          { type: 'number', value: n },
          { type: 'quantity', value: n, emoji: kind.emoji },
          numberWord(n));
      }
    } else {
      // Letters chosen to look clearly different in the two cases.
      const letters = sample('ABDEFGHKMNQRTY'.split(''), this.pairs);
      for (const L of letters) {
        addPair(`l${L}`,
          { type: 'letter', value: L },
          { type: 'letter', value: L.toLowerCase() },
          `${L}, ${L.toLowerCase()}`);
      }
    }

    this.cards = shuffle(cards).map((c, i) => ({
      ...c, id: i, flip: 0, target: 0, matched: false, pop: 0, x: 0, y: 0, w: 0, h: 0,
    }));
  }

  layout() {
    if (!this.cards) return;
    const [cols, rows] = GRID[this.pairs] || [4, 2];
    const availW = this.W * 0.86;
    const availH = this.H - this.playTop - 60;
    const gap = clamp(Math.min(availW, availH) * 0.035, 12, 26);
    const cw = Math.min((availW - gap * (cols - 1)) / cols, (availH - gap * (rows - 1)) / rows / 1.32);
    const ch = cw * 1.32;
    const boardW = cw * cols + gap * (cols - 1);
    const boardH = ch * rows + gap * (rows - 1);
    const ox = this.cx - boardW / 2;
    const oy = this.playTop + (availH - boardH) / 2 + 10;

    this.cards.forEach((card, i) => {
      const c = i % cols;
      const r = Math.floor(i / cols);
      card.x = ox + c * (cw + gap);
      card.y = oy + r * (ch + gap);
      card.w = cw;
      card.h = ch;
    });
  }

  /* ----------------------------------------------------------------- input */

  onTap(p) {
    if (this.busy) return;
    for (const card of this.cards) {
      if (card.matched || card.target === 1) continue;
      if (!pointInRect(p.x, p.y, card.x, card.y, card.w, card.h)) continue;
      this.reveal(card);
      return;
    }
  }

  hintPulse() {
    this.audio.speak('Find two cards that go together.');
  }

  reveal(card) {
    card.target = 1;
    this.audio.tap();
    this.picked.push(card);
    if (this.picked.length < 2) return;

    // Two cards are down: lock the board until they resolve, so a fast tapper
    // cannot flip a third and corrupt the pair.
    this.busy = true;
    const [a, b] = this.picked;
    this.picked = [];

    if (a.key === b.key) {
      this.tweens.after(0.35, () => {
        a.matched = b.matched = true;
        a.pop = b.pop = 1;
        this.found++;
        this.roundsDone = this.found;
        this.audio.correct();
        this.fx.sparkle(a.x + a.w / 2, a.y + a.h / 2, 12, { color: '#ffe9a8' });
        this.fx.sparkle(b.x + b.w / 2, b.y + b.h / 2, 12, { color: '#ffe9a8' });
        this.audio.speak(a.say, { rate: 0.85 });
        this.busy = false;
        if (this.found >= this.pairs) this.win();
      });
    } else {
      this.tweens.after(0.95, () => {
        a.target = b.target = 0;
        this.audio.wrong();
        this.mistakes++;
        this.busy = false;
      });
    }
  }

  win() {
    this.busy = true;
    this.tweens.after(0.8, () => this.finishRound({ title: pick(PRAISE) }));
  }

  /* ------------------------------------------------------------------ frame */

  update(dt) {
    for (const c of this.cards) {
      c.flip += (c.target - c.flip) * Math.min(1, dt * 12);
      if (c.pop > 0) c.pop = Math.max(0, c.pop - dt * 2);
    }
  }

  draw(ctx) {
    for (const card of this.cards) this.drawCard(ctx, card);
  }

  /**
   * The flip is a horizontal squeeze through zero width, swapping back for
   * front at the halfway point — it reads as a real card turning over.
   */
  drawCard(ctx, card) {
    const t = clamp(card.flip, 0, 1);
    const squeeze = Math.abs(Math.cos(t * Math.PI));
    const showFace = t > 0.5;
    const pop = 1 + Ease.pulse(card.pop) * 0.14;
    const cx = card.x + card.w / 2;
    const cy = card.y + card.h / 2;

    ctx.save();
    ctx.globalAlpha = card.matched ? 0.66 : 1;
    ctx.translate(cx, cy);
    ctx.scale(Math.max(0.02, squeeze) * pop, pop);
    ctx.translate(-cx, -cy);

    if (!showFace) {
      this.drawBack(ctx, card);
    } else {
      candyRect(ctx, card.x, card.y, card.w, card.h, card.w * 0.16, '#ffffff', {
        depth: 8, gloss: false, stroke: card.matched ? '#3ddc97' : shade(this.tint, 0.4), strokeWidth: 6,
      });
      this.drawFace(ctx, card);
    }
    ctx.restore();
  }

  drawBack(ctx, card) {
    candyRect(ctx, card.x, card.y, card.w, card.h, card.w * 0.16, this.tint, { depth: 8 });
    ctx.save();
    roundRect(ctx, card.x + 8, card.y + 8, card.w - 16, card.h - 16, card.w * 0.13);
    ctx.clip();
    // A little repeating star field on the card backs.
    const step = card.w * 0.3;
    ctx.globalAlpha = 0.22;
    for (let y = card.y; y < card.y + card.h + step; y += step) {
      for (let x = card.x; x < card.x + card.w + step; x += step) {
        const off = (Math.round((y - card.y) / step) % 2) * step * 0.5;
        starPath(ctx, x + off, y, step * 0.19, step * 0.085, 5);
        ctx.fillStyle = '#ffffff';
        ctx.fill();
      }
    }
    ctx.restore();
  }

  drawFace(ctx, card) {
    const cx = card.x + card.w / 2;
    const cy = card.y + card.h / 2;
    const f = card.face;

    if (f.type === 'emoji') {
      drawEmoji(ctx, f.value, cx, cy, card.w * 0.62);
    } else if (f.type === 'number') {
      bubbleText(ctx, String(f.value), cx, cy, card.h * 0.5, { fill: this.tint, stroke: '#ffffff', lineWidth: 8 });
    } else if (f.type === 'letter') {
      bubbleText(ctx, f.value, cx, cy, card.h * 0.5, { fill: this.tint, stroke: '#ffffff', lineWidth: 8 });
    } else if (f.type === 'quantity') {
      this.drawQuantity(ctx, card, f);
    }
  }

  /**
   * Quantities are laid out in a tidy dice-like block, never scattered — the
   * point is that five *looks* like five without recounting it.
   */
  drawQuantity(ctx, card, f) {
    const n = f.value;
    const cols = n <= 3 ? n : n <= 6 ? 3 : n <= 8 ? 4 : 5;
    const rows = Math.ceil(n / cols);
    const size = Math.min(card.w * 0.72 / cols, card.h * 0.66 / rows);
    const startY = card.y + card.h / 2 - ((rows - 1) * size) / 2;
    for (let i = 0; i < n; i++) {
      const r = Math.floor(i / cols);
      const c = i % cols;
      // Centre a short final row so the block stays symmetrical.
      const inRow = r === rows - 1 ? n - r * cols : cols;
      const rowX = card.x + card.w / 2 - ((inRow - 1) * size) / 2;
      drawEmoji(ctx, f.emoji, rowX + c * size, startY + r * size, size * 0.88);
    }
  }

  /**
   * Forgetting where a card was is the game, not a failure — so the star
   * thresholds here are far more generous than the engine default.
   */
  starsEarned() {
    if (this.mistakes <= this.pairs) return 3;
    if (this.mistakes <= this.pairs * 2.5) return 2;
    return 1;
  }
}
