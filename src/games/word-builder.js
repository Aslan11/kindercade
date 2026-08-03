/**
 * Word Builder — mapping sounds to letters, in order.
 *
 * The child sees a picture, hears the word, and drags letters into slots. Each
 * letter that lands says its *sound*, not its name, so building "c-a-t" is an
 * act of blending rather than copying. Wrong tiles simply spring home; nothing
 * is ever taken away, and the hint button is always available — a five-year-old
 * who is stuck should not stay stuck.
 */

import { Game } from '../core/engine.js';
import { Button, drawSlot } from '../core/ui.js';
import { DragController } from '../core/input.js';
import { candyRect, drawEmoji, bubbleText, softText, roundRect, PX, px, stepAlpha, HARD_SHADOW } from '../core/art.js';
import { Ease } from '../core/anim.js';
import { shuffle, pick, clamp, dist, sampleAvoiding } from '../core/util.js';
import { WORDS, tierForLevel, LETTER_SOUND, LETTER_NAME, ALPHABET, PRAISE, ENCOURAGE } from '../data/words.js';

export default class WordBuilder extends Game {
  static meta = {
    id: 'word-builder',
    title: 'Word Builder',
    subject: 'spelling',
    blurb: 'Drag the letters to spell the picture.',
    emoji: '🔤',
    tint: '#5b8cff',
  };

  init() {
    this.maxLevel = 3;
    this.roundsTotal = 6;
    this.busy = false;
    this.used = [];
    this.wave = -1;
    this.backdrop = { top: '#d6e6ff', bottom: '#ffeede', hills: ['#a8c8f0', '#87abe0'] };

    this.drag = new DragController({
      items: () => this.tiles,
      canPick: () => !this.busy,
      onPick: (t) => {
        // Pulling a placed letter back out is how a child fixes a mistake.
        if (t.slot >= 0) { this.slots[t.slot].tile = null; t.slot = -1; }
        this.audio.pick();
      },
      onDrop: (t) => this.dropTile(t),
    });

    this.newRound();
  }

  get distractors() { return this.level === 1 ? 0 : this.level === 2 ? 2 : 3; }

  /* ------------------------------------------------------------ round setup */

  newRound() {
    const tier = tierForLevel(this.level);
    const pool = WORDS.filter((w) => w.tier === tier);
    const fresh = pool.filter((w) => !this.used.includes(w.word));
    this.entry = pick(fresh.length ? fresh : pool);
    this.used.push(this.entry.word);

    const word = this.entry.word;
    this.slots = word.split('').map((letter, i) => ({ letter, index: i, tile: null, x: 0, y: 0, glow: 0 }));

    const extra = sampleAvoiding(
      ALPHABET.filter((c) => !word.includes(c)),
      this.distractors,
      [],
    );
    // Shuffle until the tray is not already spelling the word out in order.
    let letters = shuffle([...word.split(''), ...extra]);
    for (let i = 0; i < 8 && letters.slice(0, word.length).join('') === word; i++) letters = shuffle(letters);

    this.tiles = letters.map((letter, i) => ({
      id: i, letter, slot: -1,
      x: 0, y: 0, homeX: 0, homeY: 0,
      hitRadius: 52, dragging: false, wobble: 0, lift: 0,
    }));

    this.busy = false;
    this.wave = -1;
    this.hintsUsed = 0;
    // The banner must never name the word. Printing "Spell nut" above a tray
    // containing n, u and t turns spelling-from-sound into copying, which is a
    // different and much easier skill.
    this.setPrompt('Spell the word', { speak: false });
    this.layout();
    this.schedulePrompt(0.3);
  }

  /** The word is *heard*, never shown — that is the whole exercise. */
  speakPrompt({ delay = 0 } = {}) {
    return this.audio.say([
      { text: this.entry.word, rate: 0.7, gap: 0.35, delay },
      { text: `Can you spell ${this.entry.word}?`, rate: 0.9 },
    ]);
  }

  /** Visual only — bounce the picture and jiggle the tray. */
  hintPulse() {
    for (const t of this.tiles) if (t.slot < 0) t.wobble = Math.max(t.wobble, 1);
  }

  /* ---------------------------------------------------------------- layout */

  layout() {
    if (!this.tiles) return;

    const picSize = clamp(this.H * 0.24, 150, 230);
    this.picture = { cx: this.cx, cy: this.playTop + picSize * 0.56, size: picSize };

    // Slots
    const n = this.slots.length;
    this.slotW = clamp(Math.min((this.W * 0.74) / n - 18, 130), 96, 130);
    const gap = clamp(this.slotW * 0.16, 14, 26);
    const slotY = this.picture.cy + picSize * 0.62;
    const startX = this.cx - (this.slotW * n + gap * (n - 1)) / 2;
    this.slots.forEach((s, i) => {
      s.x = startX + i * (this.slotW + gap);
      s.y = slotY;
      s.w = this.slotW;
      s.h = this.slotW * 1.16;
      if (s.tile) { s.tile.x = s.x + s.w / 2; s.tile.y = s.y + s.h / 2; }
    });

    // Tray
    const loose = this.tiles.filter((t) => t.slot < 0);
    this.tileSize = clamp(Math.min((this.W * 0.86) / Math.max(4, this.tiles.length) - 16, 118), 96, 118);
    const trayY = this.H - this.tileSize * 0.86;
    const spread = Math.min(this.W * 0.86, loose.length * (this.tileSize + 16));
    loose.forEach((t, i) => {
      const k = loose.length === 1 ? 0.5 : i / (loose.length - 1);
      t.homeX = this.cx - spread / 2 + k * spread;
      t.homeY = trayY;
      t.hitRadius = this.tileSize * 0.56;
      if (!t.dragging) { t.x = t.homeX; t.y = t.homeY; }
    });
    for (const t of this.tiles) if (t.slot >= 0) {
      const s = this.slots[t.slot];
      t.x = s.x + s.w / 2;
      t.y = s.y + s.h / 2;
      t.hitRadius = this.tileSize * 0.56;
    }

    this.buttons.clear();
    this.hintBtn = this.buttons.add(new Button({
      x: this.W - 96, y: this.H - 96, circle: true, radius: 52, emoji: 'icon-hint', color: '#ffc93c',
      onTap: () => this.hint(),
    }));
  }

  /* ----------------------------------------------------------------- input */

  onPointerDown(p) { if (!this.busy) this.drag.begin(p); }
  onPointerMove(p) { this.drag.move(p); }
  onPointerUp(p) { this.drag.end(p); }

  dropTile(t) {
    const target = this.slots.find((s) => !s.tile
      && dist(t.x, t.y, s.x + s.w / 2, s.y + s.h / 2) < this.slotW * 0.95);
    // layout() re-homes every tile, which would teleport this one; remember
    // where the finger let go so it can animate from there instead.
    const from = { x: t.x, y: t.y };

    if (target && target.letter === t.letter) {
      target.tile = t;
      t.slot = target.index;
      target.glow = 1;
      this.audio.place();
      // The sound, not the name — dropping the c into c-a-t says "kuh". The
      // spell-out that follows the last letter waits for this to finish.
      this.audio.speak(LETTER_SOUND[t.letter] || t.letter, { rate: 0.8 });
      this.fx.sparkle(target.x + target.w / 2, target.y + target.h / 2, 8, { color: '#cfe4ff', spread: 80 });
      this.layout();
      const dest = { x: t.x, y: t.y };
      t.x = from.x; t.y = from.y;
      this.tweens.to(t, dest, 0.15, { ease: Ease.outQuad });
      if (this.slots.every((s) => s.tile)) this.complete();
      return;
    }

    // Wrong letter, wrong slot, or dropped in open space: it springs home.
    if (target) {
      this.nudge(t.x, t.y);
      this.audio.speak(pick(ENCOURAGE), { delay: 0.25 });
    }
    t.slot = -1;
    this.layout();
    const home = { x: t.homeX, y: t.homeY };
    t.x = from.x; t.y = from.y;
    this.tweens.to(t, home, 0.3, { ease: Ease.outBack });
  }

  /** Lifts the next needed tile and floats it toward its slot, without placing it. */
  hint() {
    if (this.busy) return;
    const slot = this.slots.find((s) => !s.tile);
    if (!slot) return;
    const tile = this.tiles.find((t) => t.slot < 0 && t.letter === slot.letter);
    if (!tile) return;
    this.hintsUsed++;
    this.audio.tap();
    this.audio.say([
      { text: `Find ${LETTER_NAME[tile.letter] || tile.letter}`, rate: 0.85, gap: 0.25 },
      { text: LETTER_SOUND[tile.letter] || tile.letter, rate: 0.75 },
    ]);
    tile.wobble = 1.6;
    slot.glow = 1;
    // A little hop toward the slot, then back — showing, not doing.
    const midX = (tile.homeX + slot.x + slot.w / 2) / 2;
    const midY = (tile.homeY + slot.y + slot.h / 2) / 2;
    this.tweens.to(tile, { x: midX, y: midY, lift: 1 }, 0.4, { ease: Ease.outCubic });
    this.tweens.after(0.9, () => {
      if (tile.slot < 0 && !tile.dragging) {
        this.tweens.to(tile, { x: tile.homeX, y: tile.homeY, lift: 0 }, 0.4, { ease: Ease.outBack });
      }
    });
  }

  /* -------------------------------------------------------------- complete */

  complete() {
    this.busy = true;
    this.roundsDone++;
    this.wave = 0;
    this.audio.correct();
    this.fx.confetti(this.cx, this.slots[0].y, 40, { up: true });

    // Spell it out letter by letter, lighting each slot as it is named.
    const spelling = this.audio.spellOut(this.entry.word, {
      onLetter: (i) => {
        const s = this.slots[i];
        if (s) { s.glow = 1; this.fx.sparkle(s.x + s.w / 2, s.y + s.h / 2, 8, { color: '#ffe9a8' }); }
      },
    });

    // Move on when the spelling has actually finished rather than when a
    // guessed-at timer says it should have — how long a voice takes to say five
    // letters varies enormously between platforms.
    this.afterSpeech(spelling, { min: 1.8, max: 9 }).then(() => {
      // These timers only run while this game is running, so a child who leaves
      // mid-celebration never gets dragged into another round.
      if (this.finished) return;
      // The end-of-game panel has praise of its own; two in a row is one too many.
      if (this.roundsDone >= this.roundsTotal) return this.finishRound({ title: pick(PRAISE) });
      // Let the praise actually land. The next round used to start speaking
      // 0.3s after this line began, which chopped it off after a syllable.
      const praise = this.audio.speak(pick(PRAISE));
      this.afterSpeech(praise, { min: 0.7, max: 3 }).then(() => {
        if (!this.finished) this.newRound();
      });
    });
  }

  /* ------------------------------------------------------------------ frame */

  update(dt) {
    for (const t of this.tiles) if (t.wobble > 0) t.wobble = Math.max(0, t.wobble - dt * 1.2);
    for (const s of this.slots) if (s.glow > 0) s.glow = Math.max(0, s.glow - dt * 1.1);
    if (this.wave >= 0) this.wave += dt * 3.2;
    if (this.drag.held) this.fx.trail(this.drag.held.x, this.drag.held.y, 'rgba(190,215,255,0.85)');
  }

  draw(ctx) {
    // Picture card — the bob snaps to the texel grid so it steps, never shimmers.
    const p = this.picture;
    const bob = px(Math.sin(this.t * 1.5) * 5 + (this.wave >= 0 ? Math.sin(this.wave * 2) * 8 : 0));
    candyRect(ctx, p.cx - p.size * 0.62, p.cy - p.size * 0.56 + bob, p.size * 1.24, p.size * 1.08, PX * 2,
      '#ffffff', { depth: 10, gloss: false, stroke: this.tint, strokeWidth: 7 });
    drawEmoji(ctx, this.entry.emoji, p.cx, p.cy + bob - p.size * 0.04, p.size * 0.74, { shadow: true });

    // Slots
    this.slots.forEach((s, i) => {
      const lift = px(this.wave >= 0 ? Math.max(0, Math.sin(this.wave - i * 0.5)) * 16 : 0);
      drawSlot(ctx, s.x, s.y - lift, s.w, s.h, {
        r: PX * 2, filled: !!s.tile, active: s.glow > 0.2, color: this.tint,
      });
      if (s.glow > 0.02) {
        // Glow = a hard pixel ring blinking around the slot, never a soft halo.
        ctx.save();
        ctx.globalAlpha = stepAlpha(s.glow * (Math.floor(this.t * 8) % 2 ? 0.25 : 0.5));
        roundRect(ctx, s.x - PX * 2, s.y - lift - PX * 2, s.w + PX * 4, s.h + PX * 4, PX * 2);
        ctx.lineWidth = PX * 2;
        ctx.strokeStyle = '#ffd76a';
        ctx.stroke();
        ctx.restore();
      }
      if (s.tile && !s.tile.dragging) this.drawTile(ctx, s.tile, 1, lift);
    });

    for (const t of this.tiles) if (t.slot < 0 && !t.dragging) this.drawTile(ctx, t);
    for (const t of this.tiles) if (t.dragging) this.drawTile(ctx, t, 1.12);

    if (this.wave < 0) {
      softText(ctx, 'Drag a letter into a box', this.cx, this.H - this.tileSize * 1.62, 24,
        { color: 'rgba(44,35,64,0.45)' });
    }
  }

  drawTile(ctx, t, scale = 1, lift = 0) {
    const size = this.tileSize;
    const wob = t.wobble > 0 ? Math.sin(this.t * 22) * 6 * t.wobble : 0;
    const s = scale * (1 + t.lift * 0.08);
    ctx.save();
    // Snap the wobble/lift drift to the texel grid so the tile steps, never blurs.
    ctx.translate(px(t.x + wob), px(t.y - lift - t.lift * 10));
    ctx.scale(s, s);
    if (t.dragging || t.lift > 0.1) {
      // A lifted tile casts a hard offset silhouette, not a blurred shadow.
      roundRect(ctx, -size / 2, -size / 2 + PX * 3, size, size, PX * 2);
      ctx.fillStyle = HARD_SHADOW;
      ctx.fill();
    }
    candyRect(ctx, -size / 2, -size / 2, size, size, PX * 2, t.slot >= 0 ? '#7fb0ff' : this.tint, { depth: 7 });
    // Lowercase on the tiles — that is what he meets in books.
    bubbleText(ctx, t.letter, 0, -3, size * 0.6, { fill: '#ffffff', stroke: '#25478f' });
    ctx.restore();
  }
}
