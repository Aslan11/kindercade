/**
 * Sound Safari — phonemic awareness.
 *
 * Hearing the separate sounds inside a spoken word is the strongest single
 * predictor of how easily a child learns to read, and it is an *ear* skill
 * before it is an eye skill. So the audio leads: the voice says the word, then
 * isolates the sound, and the pictures and letters are there to support it.
 *
 * Two rules follow from that, and the game lives or dies by both:
 *
 *   The answer is never written down. The word appears with the letter being
 *   asked about left as an empty slot — "_ a t" — so the picture and the voice
 *   are the only route to the answer. Printing the whole word turns listening
 *   into copying.
 *
 *   Only words whose spelling matches their sound are used. See
 *   `startsWithItsLetter` / `endsWithItsLetter` in the word data: "shoe" does
 *   not start with the sound of S, and asking would teach something false.
 *
 * Note also the split between what is spoken and what is shown — the voice says
 * the sound ("buh") while the tile shows the letter ("Bb"). The letter *name*
 * ("bee") is only used once the answer is in, to name what was just found.
 */

import { Game } from '../core/engine.js';
import { Button, drawSlot } from '../core/ui.js';
import { candyRect, drawEmoji, bubbleText, softText, Palette, PX, px, stepAlpha } from '../core/art.js';
import { Ease } from '../core/anim.js';
import { shuffle, pick, clamp, sampleAvoiding } from '../core/util.js';
import {
  WORDS, tierForLevel, LETTER_SOUND, LETTER_NAME, SOUND_LETTERS,
  startsWithItsLetter, endsWithItsLetter, PRAISE, ENCOURAGE,
} from '../data/words.js';

/** Pairs a five-year-old routinely mixes up — used as deliberate distractors. */
const CONFUSABLE = {
  b: ['d', 'p'], d: ['b', 'p'], p: ['b', 'q', 'd'], q: ['p', 'g'],
  m: ['n', 'w'], n: ['m', 'u'], w: ['m', 'v'], v: ['w', 'f'],
  f: ['v', 't'], g: ['j', 'q'], j: ['g', 'y'], s: ['z', 'c'],
  c: ['k', 's'], k: ['c', 'x'], z: ['s'], u: ['n', 'v'], t: ['f'],
};

export default class SoundSafari extends Game {
  static meta = {
    id: 'sound-safari',
    title: 'Sound Safari',
    subject: 'spelling',
    blurb: 'Which letter does it start with?',
    emoji: '🦁',
    tint: '#4cc9f0',
  };

  init() {
    this.maxLevel = 3;
    this.roundsTotal = 8;
    this.busy = false;
    this.used = [];
    this.cardSlide = 0;
    this.flyer = null;
    this.backdrop = { top: '#cdf3ff', bottom: '#e8fff0', hills: ['#9fe6c8', '#63cfae'] };
    this.newRound();
  }

  /** Level 3 asks for the last sound instead of the first. */
  get mode() { return this.level >= 3 ? 'end' : 'start'; }
  get choiceCount() { return this.level === 1 ? 3 : 4; }

  /* ------------------------------------------------------------ round setup */

  /** Words for this level whose target letter really is the target sound. */
  wordPool() {
    const tier = tierForLevel(this.level === 3 ? 2 : this.level);
    const safe = this.mode === 'start' ? startsWithItsLetter : endsWithItsLetter;
    return WORDS.filter((w) => w.tier <= tier && safe(w.word));
  }

  newRound() {
    const pool = this.wordPool();
    const fresh = pool.filter((w) => !this.used.includes(w.word));
    this.entry = pick(fresh.length ? fresh : pool);
    this.used.push(this.entry.word);
    if (this.used.length > Math.min(14, pool.length - 1)) this.used.shift();

    const word = this.entry.word;
    this.answerIndex = this.mode === 'start' ? 0 : word.length - 1;
    this.answer = word[this.answerIndex];
    this.choices = this.makeChoices(this.answer, word);
    this.wrongTries = 0;
    this.busy = false;
    this.revealed = false;
    this.cardSlide = 0;
    this.flyer = null;

    // The banner deliberately says "this", not the word — see the note above.
    this.setPrompt(this.questionText(), { speak: false });
    this.layout();
    this.tweens.to(this, { cardSlide: 1 }, 0.45, { ease: Ease.outBack });
    this.tweens.after(0.3, () => this.speakPrompt());
  }

  questionText() {
    return this.mode === 'start'
      ? 'What sound does it start with?'
      : 'What sound does it end with?';
  }

  /**
   * Distractors must never *also* be a right answer for this word, and at level
   * 2+ at least one is a letter the child is likely to confuse with the answer.
   */
  makeChoices(answer, word) {
    const banned = new Set([word[0], word[word.length - 1]]);
    const letters = new Set([answer]);

    if (this.level >= 2) {
      const tricky = (CONFUSABLE[answer] || []).filter((c) => !banned.has(c));
      if (tricky.length) letters.add(pick(tricky));
    }
    // Fill from letters the child has already met on a picture card before
    // falling back to the rest of the alphabet, so the wrong answers are
    // familiar shapes rather than a Q and an X they have never seen.
    const ok = (c) => !banned.has(c) && !letters.has(c);
    const familiar = SOUND_LETTERS.filter(ok);
    const rest = 'abcdefghijklmnopqrstuvwxyz'.split('').filter((c) => ok(c) && !familiar.includes(c));
    for (const c of [...sampleAvoiding(familiar, this.choiceCount, []), ...shuffle(rest)]) {
      if (letters.size >= this.choiceCount) break;
      letters.add(c);
    }
    return shuffle([...letters].slice(0, this.choiceCount));
  }

  /**
   * The question, as one queued sequence.
   *
   * These four phrases used to be fired off on the tween clock at fixed offsets
   * and each one cancelled the one before it, so on a slower voice the child
   * heard "ca—", "cat starts wi—", "kuh k—". Queueing means each phrase simply
   * starts when the previous one has actually finished.
   */
  speakPrompt({ delay = 0 } = {}) {
    const word = this.entry.word;
    const sound = LETTER_SOUND[this.answer] || this.answer;
    const verb = this.mode === 'start' ? 'starts with' : 'ends with';
    return this.audio.say([
      { text: word, rate: 0.72, gap: 0.35, delay },
      { text: `${word} ${verb} ${sound}, ${sound}`, rate: 0.8, gap: 0.3 },
      { text: 'Which letter?', rate: 0.95 },
    ]);
  }

  /** Visual only — the question is spoken for us. */
  hintPulse() {
    for (const b of this.buttons.buttons) b.pulse?.();
  }

  /* ---------------------------------------------------------------- layout */

  layout() {
    if (!this.choices) return;
    const cardW = clamp(this.W * 0.3, 300, 400);
    const cardH = clamp(this.H * 0.34, 240, 320);
    this.card = { x: this.cx - cardW / 2, y: this.playTop + 4, w: cardW, h: cardH };

    // The word, with the letter under question left as an empty slot. Sized to
    // fit the longest word the level can throw up, so the row does not jump
    // between rounds.
    const letters = this.entry.word.split('');
    const ls = clamp(Math.min((cardW - 56) / letters.length, 46), 22, 46);
    const step = ls * 1.16;
    const rowY = this.card.y + cardH - ls * 0.92;
    const rowX = this.cx - (step * letters.length - (step - ls)) / 2;
    this.wordSlots = letters.map((ch, i) => ({
      ch, blank: i === this.answerIndex,
      x: rowX + i * step, y: rowY - ls * 0.6, w: ls, h: ls * 1.2,
    }));
    this.blankSlot = this.wordSlots[this.answerIndex];

    this.buttons.clear();
    const n = this.choices.length;
    const size = clamp(Math.min((this.W * 0.8) / n - 26, 168), 104, 168);
    const gap = clamp(this.W * 0.03, 18, 40);
    const startX = this.cx - (size * n + gap * (n - 1)) / 2;
    const ty = this.card.y + this.card.h + clamp(this.H * 0.06, 34, 70);

    this.choices.forEach((letter, i) => {
      this.buttons.add(new Button({
        x: startX + i * (size + gap), y: ty, w: size, h: size, r: 30,
        // Both cases together: the same letter wears two shapes, and a new
        // reader has to recognise each of them.
        label: letter.toUpperCase() + letter,
        fontSize: size * 0.4,
        color: this.tint, id: `l${letter}`,
        onTap: () => this.choose(letter),
      }));
    });
    this.tileSize = size;
  }

  /* ---------------------------------------------------------------- answer */

  choose(letter) {
    if (this.busy) return;
    // The question may still be playing; the child has answered, so stop asking.
    this.audio.stopSpeech();
    const btn = this.buttons.get(`l${letter}`);
    const sound = LETTER_SOUND[letter] || letter;

    if (letter !== this.answer) {
      this.nudge(btn ? btn.cx : this.cx, btn ? btn.cy : this.cy);
      this.audio.say([
        { text: sound, rate: 0.75, gap: 0.25, delay: 0.3 },
        { text: pick(ENCOURAGE), rate: 0.95 },
      ]);
      this.wrongTries++;
      if (this.wrongTries >= 2) {
        this.tweens.after(1.8, () => {
          this.buttons.get(`l${this.answer}`)?.pulse();
          this.audio.say([
            { text: 'Listen', rate: 0.9, gap: 0.25 },
            { text: `${LETTER_SOUND[this.answer]}, ${LETTER_SOUND[this.answer]}`, rate: 0.7, gap: 0.3 },
            { text: `That is ${LETTER_NAME[this.answer] || this.answer}`, rate: 0.9 },
          ]);
        });
      }
      return;
    }

    this.busy = true;
    this.roundsDone++;
    this.buttons.buttons.forEach((b) => { b.enabled = false; });

    // The winning letter flies up into the gap in the word and completes it.
    const slot = this.blankSlot;
    if (btn && slot) {
      this.flyer = { letter, x: btn.cx, y: btn.cy, size: this.tileSize, alpha: 1 };
      btn.hidden = true;
      this.tweens.to(this.flyer, {
        x: slot.x + slot.w / 2, y: slot.y + slot.h / 2, size: slot.h * 0.92,
      }, 0.45, { ease: Ease.outCubic, onComplete: () => {
        this.revealed = true;
        this.flyer = null;
        this.fx.sparkle(slot.x + slot.w / 2, slot.y + slot.h / 2, 10, { color: '#ffe9a8' });
      } });
    } else {
      this.revealed = true;
    }

    this.cheer(this.card.x + this.card.w / 2, this.card.y + this.card.h / 2);
    const verb = this.mode === 'start' ? 'starts with' : 'ends with';
    // Sound first, then the letter's name — the sound is what was being
    // listened for, the name is what the thing they tapped is called.
    const said = this.audio.say([
      { text: `${this.entry.word} ${verb} ${LETTER_SOUND[this.answer]}`, rate: 0.82, gap: 0.3, delay: 0.45 },
      { text: `That is ${LETTER_NAME[this.answer] || this.answer}`, rate: 0.9, gap: 0.25 },
      { text: this.entry.word, rate: 0.75 },
    ]);

    // Wait for the sentence to finish rather than guessing how long it takes.
    this.afterSpeech(said, { min: 2.2, max: 7 }).then(() => {
      if (this.finished) return;
      if (this.roundsDone >= this.roundsTotal) this.finishRound({ title: pick(PRAISE) });
      else this.newRound();
    });
  }

  /* ------------------------------------------------------------------ frame */

  draw(ctx) {
    const c = this.card;
    const slide = Ease.outCubic(clamp(this.cardSlide, 0, 1));
    // Entrance and idle bob snap to the texel grid so the card steps in like a
    // sprite instead of gliding, and the fade lands in eighths.
    const bob = px(Math.sin(this.t * 1.6) * 6);

    ctx.save();
    ctx.globalAlpha = stepAlpha(slide);
    ctx.translate(0, px((1 - slide) * -80) + bob);
    candyRect(ctx, c.x, c.y, c.w, c.h, PX * 2, '#ffffff', { depth: 12, gloss: false, stroke: this.tint, strokeWidth: 8 });
    drawEmoji(ctx, this.entry.emoji, c.x + c.w / 2, c.y + c.h * 0.40, Math.min(c.w, c.h) * 0.54, { shadow: true });
    this.drawWord(ctx);
    ctx.restore();
  }

  /**
   * The word with a hole in it. The letter being asked about is an empty slot
   * until it has been found — the picture and the voice are the only way in.
   */
  drawWord(ctx) {
    for (const s of this.wordSlots || []) {
      const cx = s.x + s.w / 2;
      const cy = s.y + s.h / 2;
      if (s.blank && !this.revealed) {
        this.drawBlankSlot(ctx, s);
        continue;
      }
      // The found letter stays highlighted, so the answer is visible as part of
      // the word rather than as a separate reward.
      const found = s.blank && this.revealed;
      softText(ctx, s.ch, cx, cy, s.h * 0.78, {
        color: found ? this.tint : Palette.inkSoft,
        weight: found ? 900 : 800,
      });
    }
  }

  /** The empty slot: the shared texel-dash well, dressed in this game's tint. */
  drawBlankSlot(ctx, s) {
    drawSlot(ctx, s.x, s.y, s.w, s.h, { fill: 'rgba(0,0,0,0.05)', stroke: this.tint });
  }

  /** The winning letter travels above the tiles on its way to the word. */
  drawOverlay(ctx) {
    if (!this.flyer) return;
    bubbleText(ctx, this.flyer.letter, px(this.flyer.x), px(this.flyer.y), this.flyer.size * 0.6, {
      fill: '#ffd76a', stroke: Palette.ink,
    });
  }
}
