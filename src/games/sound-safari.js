/**
 * Sound Safari — phonemic awareness.
 *
 * Hearing the separate sounds inside a spoken word is the strongest single
 * predictor of how easily a child learns to read, and it is an *ear* skill
 * before it is an eye skill. So the audio leads: the voice says the word, then
 * isolates the sound, and the pictures and letters are there to support it.
 *
 * Note the split between what is spoken and what is shown — the voice says the
 * sound ("buh") while the tile shows the letter ("Bb"). Saying the letter name
 * ("bee") here would teach the wrong thing.
 */

import { Game } from '../core/engine.js';
import { Button } from '../core/ui.js';
import { candyRect, drawEmoji, bubbleText, softText, Palette } from '../core/art.js';
import { Ease } from '../core/anim.js';
import { shuffle, pick, clamp, sampleAvoiding } from '../core/util.js';
import { WORDS, tierForLevel, LETTER_SOUND, PRAISE, ENCOURAGE } from '../data/words.js';

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

  newRound() {
    const tier = tierForLevel(this.level === 3 ? 2 : this.level);
    const pool = WORDS.filter((w) => w.tier <= tier);
    const fresh = pool.filter((w) => !this.used.includes(w.word));
    this.entry = pick(fresh.length ? fresh : pool);
    this.used.push(this.entry.word);
    if (this.used.length > 14) this.used.shift();

    const word = this.entry.word;
    this.answer = this.mode === 'start' ? word[0] : word[word.length - 1];
    this.choices = this.makeChoices(this.answer, word);
    this.wrongTries = 0;
    this.busy = false;
    this.cardSlide = 0;
    this.flyer = null;

    this.setPrompt(this.questionText(), { speak: false });
    this.layout();
    this.tweens.to(this, { cardSlide: 1 }, 0.45, { ease: Ease.outBack });
    this.tweens.after(0.25, () => this.sayQuestion());
  }

  questionText() {
    const w = this.entry.word.toUpperCase();
    return this.mode === 'start' ? `What does ${w} start with?` : `What does ${w} end with?`;
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
    const alphabet = 'abcdefghijklmnopqrstuvwxyz'.split('').filter((c) => !banned.has(c) && !letters.has(c));
    for (const c of sampleAvoiding(alphabet, this.choiceCount, [])) {
      if (letters.size >= this.choiceCount) break;
      letters.add(c);
    }
    return shuffle([...letters].slice(0, this.choiceCount));
  }

  /**
   * Speech has to be sequenced, not fired all at once: each `speak` cancels the
   * one before it, so the phrases are spaced out on the tween clock instead.
   */
  sayQuestion() {
    const word = this.entry.word;
    const sound = LETTER_SOUND[this.answer] || this.answer;
    this.audio.speak(word, { rate: 0.75 });
    this.tweens.after(1.0, () => {
      this.audio.speak(this.mode === 'start' ? `${word} starts with` : `${word} ends with`, { rate: 0.8 });
    });
    this.tweens.after(2.2, () => this.audio.speak(`${sound}... ${sound}`, { rate: 0.7 }));
    this.tweens.after(3.6, () => this.audio.speak('Which letter?', { rate: 0.85 }));
  }

  hintPulse() { this.sayQuestion(); }

  /* ---------------------------------------------------------------- layout */

  layout() {
    if (!this.choices) return;
    const cardW = clamp(this.W * 0.3, 300, 400);
    const cardH = clamp(this.H * 0.34, 240, 320);
    this.card = { x: this.cx - cardW / 2, y: this.playTop + 4, w: cardW, h: cardH };

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
    const btn = this.buttons.get(`l${letter}`);
    const sound = LETTER_SOUND[letter] || letter;

    if (letter !== this.answer) {
      this.nudge(btn ? btn.cx : this.cx, btn ? btn.cy : this.cy);
      this.audio.speak(`${sound}. ${pick(ENCOURAGE)}`, { delay: 0.3 });
      this.wrongTries++;
      if (this.wrongTries >= 2) {
        this.tweens.after(1.4, () => {
          this.buttons.get(`l${this.answer}`)?.pulse();
          this.audio.speak(`Listen: ${LETTER_SOUND[this.answer]}. It is ${this.answer.toUpperCase()}.`);
        });
      }
      return;
    }

    this.busy = true;
    this.roundsDone++;
    this.buttons.buttons.forEach((b) => { b.enabled = false; });

    // The winning letter flies up onto the picture card.
    if (btn) {
      this.flyer = { letter, x: btn.cx, y: btn.cy, size: this.tileSize, alpha: 1 };
      btn.hidden = true;
      this.tweens.to(this.flyer, {
        x: this.card.x + this.card.w / 2, y: this.card.y + this.card.h - 44, size: this.tileSize * 0.7,
      }, 0.5, { ease: Ease.outCubic });
    }

    this.cheer(this.card.x + this.card.w / 2, this.card.y + this.card.h / 2);
    const verb = this.mode === 'start' ? 'starts with' : 'ends with';
    this.audio.speak(
      `${this.answer.toUpperCase()}! ${this.entry.word} ${verb} ${LETTER_SOUND[this.answer]}. ${this.entry.word}.`,
      { delay: 0.45 },
    );

    this.tweens.after(2.6, () => {
      if (this.roundsDone >= this.roundsTotal) this.finishRound({ title: pick(PRAISE) });
      else this.newRound();
    });
  }

  /* ------------------------------------------------------------------ frame */

  draw(ctx) {
    const c = this.card;
    const slide = Ease.outCubic(clamp(this.cardSlide, 0, 1));
    const bob = Math.sin(this.t * 1.6) * 6;

    ctx.save();
    ctx.globalAlpha = slide;
    ctx.translate(0, (1 - slide) * -80 + bob);
    candyRect(ctx, c.x, c.y, c.w, c.h, 40, '#ffffff', { depth: 12, gloss: false, stroke: this.tint, strokeWidth: 8 });
    drawEmoji(ctx, this.entry.emoji, c.x + c.w / 2, c.y + c.h * 0.44, Math.min(c.w, c.h) * 0.62, { shadow: true });
    softText(ctx, this.entry.word, c.x + c.w / 2, c.y + c.h - 42, 34, { color: Palette.inkSoft });
    ctx.restore();

  }

  /** The winning letter travels above the tiles on its way to the card. */
  drawOverlay(ctx) {
    if (!this.flyer) return;
    bubbleText(ctx, this.flyer.letter.toUpperCase(), this.flyer.x, this.flyer.y, this.flyer.size * 0.6, {
      fill: '#ffd76a', stroke: Palette.ink,
    });
  }
}
