/**
 * Letter Trace — letter formation, in the right order and the right direction.
 *
 * Writing is half of literacy and it lives in the hand, not the eye. An earlier
 * version of this game scored a filled-in outline, which a three-year-old solves
 * by scribbling: the outline goes solid, the game cheers, and nothing has been
 * learned. So the crayon is now on rails. Each glyph is a short list of strokes
 * (see `data/strokes.js`), the child traces them one at a time, and the crayon
 * only moves while the finger is actually following the path — start at the
 * green dot, travel the right way round, no corner-cutting. Wander off and the
 * crayon simply stops; nothing is lost, and the ink waits where it was left.
 */

import { Game } from '../core/engine.js';
import { Button } from '../core/ui.js';
import { softText, drawEmoji, glassPanel, Palette, roundRect, font } from '../core/art.js';
import { shuffle, pick, clamp, TAU, dist, mixHex } from '../core/util.js';
import { WORDS, numberWord, PRAISE } from '../data/words.js';
import { strokesFor, MID, DESC } from '../data/strokes.js';

const UPPER = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');
const LOWER = 'abcdefghijklmnopqrstuvwxyz'.split('');
const DIGITS = '0123456789'.split('');

/** Spacing of the resampled path points, in logical pixels. */
const STEP = 7;
/** All tolerances are fractions of the cap height, so they scale with the paper. */
const CATCH = 0.11;   // how near the finger must pass to pull the crayon along
const STRAY = 0.26;   // beyond this the crayon is lifted off the paper
const START = 0.18;   // how near the finger must land to pick the crayon up
const REACH = 0.30;   // how far ahead one movement may carry the crayon
/** Seconds one demonstration of a stroke takes. */
const DEMO_TIME = 1.7;

/** Walk a polyline emitting points every `step` pixels, corners included. */
function resample(src, step) {
  if (src.length < 2) return src.slice();
  const out = [src[0]];
  let residue = 0;
  for (let i = 1; i < src.length; i++) {
    const a = src[i - 1];
    const b = src[i];
    const seg = Math.hypot(b.x - a.x, b.y - a.y);
    if (seg < 1e-6) continue;
    let d = step - residue;
    while (d <= seg) {
      out.push({ x: a.x + ((b.x - a.x) * d) / seg, y: a.y + ((b.y - a.y) * d) / seg });
      d += step;
    }
    residue = seg - (d - step);
  }
  const last = src[src.length - 1];
  const tail = out[out.length - 1];
  if (Math.hypot(last.x - tail.x, last.y - tail.y) > step * 0.35) out.push(last);
  return out;
}

export default class LetterTrace extends Game {
  static meta = {
    id: 'letter-trace',
    title: 'Letter Trace',
    subject: 'spelling',
    blurb: 'Follow the arrows to write the letter.',
    emoji: '✏️',
    tint: '#00b8a9',
  };

  init() {
    this.maxLevel = 3;
    this.roundsTotal = 6;
    this.busy = false;
    this.idle = 0;
    this.demo = 0;
    this.drawing = false;
    this.slips = 0;
    this.scoldTimer = 0;
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
    this.busy = false;
    this.drawing = false;
    this.idle = 0;
    this.demo = 0;
    this.slips = 0;
    this.strokeIndex = 0;
    this.tip = 0;
    this.paths = null;          // so layout() builds this glyph, not the last one
    this.successWord = null;
    this.setPrompt(`Trace the ${this.glyphLabel()}`, { speech: this.introSpeech() });
    this.layout();
    // Show the first stroke before the child has to guess at it.
    this.tweens.after(1.1, () => { if (!this.busy && !this.drawing) this.demo = 1; });
  }

  /** The stroke being traced right now, or null once the glyph is finished. */
  get current() { return this.paths ? this.paths[this.strokeIndex] || null : null; }

  /** "big letter A" / "little letter a" / "number 5" — the words a teacher uses. */
  glyphLabel() {
    if (this.level === 3) return `number ${this.glyph}`;
    return `${this.level === 2 ? 'little' : 'big'} letter ${this.glyph}`;
  }

  introSpeech() {
    const name = this.level === 3
      ? `number ${numberWord(Number(this.glyph))}`
      : `${this.level === 2 ? 'little' : 'big'} letter ${this.glyph.toUpperCase()}`;
    const how = strokesFor(this.glyph).length > 1
      ? 'Start on the green dot and follow the arrow. One line at a time.'
      : 'Start on the green dot and follow the arrow.';
    return `Trace the ${name}. ${how}`;
  }

  hintPulse() {
    this.demo = 1;
    this.idle = 0;
  }

  /* ---------------------------------------------------------------- layout */

  layout() {
    if (!this.glyph) return;
    // Leave room below the paper for the stroke tally.
    const size = Math.min(this.W * 0.46, this.H - this.playTop - 150);
    this.box = { x: this.cx - size / 2, y: this.playTop + 16, w: size, h: size };
    this.unit = size * 0.62;                  // one cap height
    this.baseY = this.box.y + size * 0.72;    // where every glyph sits

    this.catchR = this.unit * CATCH;
    this.strayR = this.unit * STRAY;
    this.startR = this.unit * START;
    this.reach = Math.max(4, Math.round((this.unit * REACH) / STEP));

    // A resize mid-stroke must not throw the child's work away, so remember how
    // far along they were and put the crayon back there.
    const wasAt = this.current ? this.tip / Math.max(1, this.current.pts.length - 1) : 0;
    this.buildPaths();
    if (this.current) this.tip = Math.round(wasAt * (this.current.pts.length - 1));

    this.buttons.clear();
    this.buttons.add(new Button({
      x: this.W - 96, y: this.H - 96, circle: true, radius: 52, emoji: 'icon-undo', color: '#ff8fa8',
      onTap: () => this.startOver(),
    }));
  }

  /** Turn the glyph's unit-space strokes into evenly spaced screen-space paths. */
  buildPaths() {
    const u = this.unit;
    const toScreen = ([x, y]) => ({ x: this.cx + x * u, y: this.baseY + (y - 1) * u });
    const done = (this.paths || []).map((p) => p.done);
    this.paths = strokesFor(this.glyph).map((stroke, i) => {
      const pts = resample(stroke.map(toScreen), STEP);
      return { pts, dot: pts.length < 2, done: done[i] || false };
    });
  }

  startOver() {
    this.audio.tap();
    this.paths.forEach((p) => { p.done = false; });
    this.strokeIndex = 0;
    this.tip = 0;
    this.drawing = false;
    this.slips = 0;
    this.demo = 1;
  }

  /* ----------------------------------------------------------------- input */

  onPointerDown(p) {
    const path = this.current;
    if (this.busy || !path) return;
    const pts = path.pts;
    this.idle = 0;
    // Pick the crayon up either at the start of the stroke or wherever it was
    // last put down — a child who pauses half way should not lose the line.
    const atTip = this.tip > 0 && dist(p.x, p.y, pts[this.tip].x, pts[this.tip].y) <= this.startR;
    const atStart = dist(p.x, p.y, pts[0].x, pts[0].y) <= this.startR;
    if (!atTip && !atStart) { this.wrongStart(p); return; }

    this.drawing = true;
    this.demo = 0;
    this.last = { x: p.x, y: p.y };
    if (!atTip) this.tip = 0;
    this.audio.pick();
    // The dot on an i or a j is not a journey; touching it is the whole stroke.
    if (path.dot) this.finishStroke();
  }

  onPointerMove(p) {
    const path = this.current;
    if (!this.drawing || this.busy || !path) return;
    this.idle = 0;

    // Walk the crayon along the finger's own travel rather than jumping to
    // wherever it landed. A fast swipe (or a dropped frame) then behaves exactly
    // like a slow one, which matters because the rule below is deliberately
    // local: skip forward far enough and the crayon would lose the line.
    const from = this.last || p;
    const span = dist(from.x, from.y, p.x, p.y);
    const steps = clamp(Math.ceil(span / (this.catchR * 0.5)), 1, 24);
    for (let s = 1; s <= steps; s++) {
      const t = s / steps;
      this.advance(from.x + (p.x - from.x) * t, from.y + (p.y - from.y) * t);
      if (this.busy || !this.drawing) return;
    }
    this.last = { x: p.x, y: p.y };

    // Too far from the tip: the crayon comes off the paper where it stood.
    if (dist(p.x, p.y, path.pts[this.tip].x, path.pts[this.tip].y) > this.strayR) this.slip();
  }

  /**
   * Move the crayon forward through the points the finger has walked past.
   *
   * Stepping one point at a time, and giving up as soon as the path turns away
   * and is out of reach, is what stops the crayon hopping the gap between the
   * two legs of a V or skipping the belly of a B: to get to the far side, the
   * finger has to go round.
   */
  advance(x, y) {
    const pts = this.current.pts;
    const limit = Math.min(pts.length - 1, this.tip + this.reach);
    let i = this.tip;
    let d = dist(x, y, pts[i].x, pts[i].y);
    let best = this.tip;
    while (i < limit) {
      const nd = dist(x, y, pts[i + 1].x, pts[i + 1].y);
      if (nd > d && nd > this.catchR) break;
      i++;
      d = nd;
      if (d <= this.catchR) best = i;   // furthest point the finger is really on
    }
    if (best > this.tip) {
      const at = pts[best];
      this.tip = best;
      if (Math.random() < 0.3) this.fx.sparkle(at.x, at.y, 1, { color: this.crayonColor(this.strokeIndex), spread: 34 });
    }
    if (this.tip >= pts.length - 1) this.finishStroke();
  }

  onPointerUp() {
    this.drawing = false;
  }

  /** Touched the paper somewhere that is not the start of the stroke. */
  wrongStart(p) {
    this.audio.tap();
    this.fx.puff(p.x, p.y, 5, 'rgba(255,255,255,0.8)');
    this.demo = 1;
    if (this.scoldTimer <= 0) {
      this.scoldTimer = 5;
      this.audio.speak('Start on the green dot.');
    }
  }

  /** Wandered off the line. Gentle: the ink stays, only the crayon lifts. */
  slip() {
    const at = this.current.pts[this.tip];
    this.drawing = false;
    // Give back a little of the line. Wandering has to cost something, or a
    // child who flails at the paper eventually gets there by accident.
    this.tip = Math.max(0, this.tip - this.reach);
    this.slips++;
    this.audio.tap();
    this.fx.puff(at.x, at.y, 6, 'rgba(255,255,255,0.85)');
    // Three wanders on one stroke: stop guessing, show it again.
    if (this.slips >= 3) {
      this.slips = 0;
      this.mistakes++;
      this.demo = 1;
      if (this.scoldTimer <= 0) {
        this.scoldTimer = 5;
        this.audio.speak('Follow the line. Watch me!');
      }
    }
  }

  crayonColor(i = 0) {
    // A gentle hue drift from stroke to stroke: enough that the child can see
    // where one line ended and the next began, not so much that the finished
    // letter looks like it was written by four different people.
    return mixHex('#00b8a9', '#4f86e8', ((Math.sin(i * 1.7) + 1) / 2) * 0.62);
  }

  /* -------------------------------------------------------------- complete */

  /** Finish the stroke the child is on and move to the next one. */
  finishStroke() {
    const path = this.current;
    if (!path || this.busy) return;
    path.done = true;
    this.drawing = false;
    this.slips = 0;
    const end = path.pts[path.pts.length - 1];
    this.audio.step(this.strokeIndex);
    this.fx.starBurst(end.x, end.y, 7, this.tint);
    this.strokeIndex++;
    this.tip = 0;
    this.idle = 0;
    if (this.strokeIndex >= this.paths.length) this.complete();
    else this.demo = 1;   // demonstrate the next stroke straight away
  }

  complete() {
    if (this.busy) return;
    this.busy = true;
    this.drawing = false;
    this.roundsDone++;
    const c = { x: this.cx, y: this.baseY - this.unit * 0.5 };
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
    if (this.scoldTimer > 0) this.scoldTimer -= dt;
    if (this.busy) return;
    if (this.demo > 0) this.demo = Math.max(0, this.demo - dt / DEMO_TIME);
    if (!this.drawing) {
      this.idle += dt;
      // A stalled child gets the stroke drawn for them, again and again.
      if (this.idle > 4.5) { this.idle = 0; this.demo = 1; }
    }
  }

  draw(ctx) {
    if (!this.paths) return;
    const b = this.box;
    glassPanel(ctx, b.x - 26, b.y - 26, b.w + 52, b.h + 52, 40, { alpha: 0.72 });
    this.drawPaper(ctx);

    const width = this.unit * 0.19;
    // The letter to aim at, sitting under everything like a pencil guide.
    ctx.save();
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.lineWidth = width;
    ctx.strokeStyle = 'rgba(0,140,130,0.14)';
    ctx.fillStyle = 'rgba(0,140,130,0.14)';
    this.paths.forEach((path) => this.tracePath(ctx, path, path.pts.length - 1));
    ctx.restore();

    // Ink: every stroke already written, plus how far along the current one is.
    ctx.save();
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.lineWidth = width;
    this.paths.forEach((path, i) => {
      const upto = path.done ? path.pts.length - 1 : i === this.strokeIndex ? this.tip : -1;
      if (upto < 0) return;
      ctx.strokeStyle = ctx.fillStyle = this.crayonColor(i);
      this.tracePath(ctx, path, upto);
    });
    ctx.restore();

    if (this.busy) {
      this.drawFinished(ctx);
      return;
    }
    this.drawCurrentStroke(ctx);
    this.drawTally(ctx);
  }

  /** Handwriting paper: the lines are the point, so they are drawn properly. */
  drawPaper(ctx) {
    const b = this.box;
    const x0 = b.x - 12;
    const x1 = b.x + b.w + 12;
    const line = (y, style, dash) => {
      ctx.save();
      ctx.setLineDash(dash);
      ctx.lineWidth = 3;
      ctx.strokeStyle = style;
      ctx.beginPath();
      ctx.moveTo(x0, y);
      ctx.lineTo(x1, y);
      ctx.stroke();
      ctx.restore();
    };
    line(this.baseY - this.unit, 'rgba(44,35,64,0.18)', []);
    line(this.baseY - this.unit * (1 - MID), 'rgba(44,35,64,0.16)', [12, 14]);
    line(this.baseY, 'rgba(255,120,140,0.5)', []);
    line(this.baseY + this.unit * (DESC - 1), 'rgba(44,35,64,0.1)', [4, 12]);
  }

  /** Stroke (or dot) a path up to a given point index. */
  tracePath(ctx, path, upto) {
    const pts = path.pts;
    if (path.dot) {
      if (upto < 0) return;
      ctx.beginPath();
      ctx.arc(pts[0].x, pts[0].y, ctx.lineWidth / 2, 0, TAU);
      ctx.fill();
      return;
    }
    if (upto < 1) {
      if (upto === 0) {
        ctx.beginPath();
        ctx.arc(pts[0].x, pts[0].y, ctx.lineWidth / 2, 0, TAU);
        ctx.fill();
      }
      return;
    }
    ctx.beginPath();
    ctx.moveTo(pts[0].x, pts[0].y);
    for (let i = 1; i <= upto; i++) ctx.lineTo(pts[i].x, pts[i].y);
    ctx.stroke();
  }

  /* ------------------------------------------------------------------ hints */

  drawCurrentStroke(ctx) {
    const path = this.current;
    if (!path) return;
    const pts = path.pts;

    // The line still to travel, dashed and crawling forwards so the direction
    // reads even without the arrows.
    if (!path.dot && this.tip < pts.length - 1) {
      ctx.save();
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.lineWidth = 5;
      ctx.setLineDash([10, 16]);
      ctx.lineDashOffset = -this.t * 40;
      ctx.strokeStyle = 'rgba(0,140,130,0.55)';
      ctx.beginPath();
      ctx.moveTo(pts[this.tip].x, pts[this.tip].y);
      for (let i = this.tip + 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
      ctx.stroke();
      ctx.restore();
      this.drawArrows(ctx, pts);
    }

    this.drawStartDot(ctx, pts);
    if (this.demo > 0) this.drawDemo(ctx, pts);
  }

  /** Chevrons along the road ahead, pointing the way the crayon must travel. */
  drawArrows(ctx, pts) {
    const gap = Math.max(6, Math.round(this.reach * 0.75));
    ctx.save();
    ctx.strokeStyle = 'rgba(0,140,130,0.75)';
    ctx.lineWidth = 6;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    for (let i = this.tip + gap; i < pts.length - 1; i += gap) {
      const a = pts[i - 1];
      const b = pts[i];
      const ang = Math.atan2(b.y - a.y, b.x - a.x);
      const r = this.unit * 0.075;
      ctx.save();
      ctx.translate(b.x, b.y);
      ctx.rotate(ang);
      ctx.beginPath();
      ctx.moveTo(-r, -r * 0.8);
      ctx.lineTo(0, 0);
      ctx.lineTo(-r, r * 0.8);
      ctx.stroke();
      ctx.restore();
    }
    ctx.restore();
  }

  /** Where to put the crayon down, numbered so the order is visible at a glance. */
  drawStartDot(ctx, pts) {
    if (this.drawing) return;
    const p = pts[this.tip];
    const pulse = 1 + Math.sin(this.t * 4) * 0.14;
    const r = this.unit * 0.075 * pulse;
    ctx.save();
    ctx.beginPath();
    ctx.arc(p.x, p.y, r, 0, TAU);
    ctx.fillStyle = '#3ddc84';
    ctx.fill();
    ctx.lineWidth = 4;
    ctx.strokeStyle = '#fff';
    ctx.stroke();
    if (this.paths.length > 1) {
      ctx.fillStyle = '#0d3b23';
      ctx.font = font(Math.round(r * 1.1), 900);
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(String(this.strokeIndex + 1), p.x, p.y + 1);
    }
    ctx.restore();
    if (this.tip === 0 && this.strokeIndex === 0) {
      softText(ctx, 'Start here', p.x, p.y - r - 26, 22, { color: Palette.inkSoft });
    }
  }

  /** A finger travelling the stroke, for a child who has stalled or strayed. */
  drawDemo(ctx, pts) {
    const f = 1 - this.demo;
    const i = clamp(Math.round(f * (pts.length - 1)), 0, pts.length - 1);
    const p = pts[i];
    ctx.save();
    ctx.globalAlpha = clamp(this.demo * 3, 0, 1);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.lineWidth = this.unit * 0.19;
    ctx.strokeStyle = 'rgba(91,140,255,0.28)';
    if (i >= 1) {
      ctx.beginPath();
      ctx.moveTo(pts[0].x, pts[0].y);
      for (let k = 1; k <= i; k++) ctx.lineTo(pts[k].x, pts[k].y);
      ctx.stroke();
    }
    ctx.beginPath();
    ctx.arc(p.x, p.y, this.unit * 0.06, 0, TAU);
    ctx.fillStyle = '#5b8cff';
    ctx.fill();
    ctx.lineWidth = 4;
    ctx.strokeStyle = '#fff';
    ctx.stroke();
    ctx.restore();
  }

  /* --------------------------------------------------------------- finished */

  drawFinished(ctx) {
    if (!this.successWord) return;
    const b = this.box;
    const y = this.baseY - this.unit * 0.5;
    drawEmoji(ctx, this.successWord.emoji, b.x + b.w + 96, y, 96, { shadow: true });
    softText(ctx, this.successWord.word, b.x + b.w + 96, y + 76, 30, { color: Palette.inkSoft });
  }

  /** One pip per stroke — the child can see the letter is a sequence. */
  drawTally(ctx) {
    const total = this.paths.length;
    if (total < 2) return;   // nothing to sequence on a one-stroke letter
    const y = this.box.y + this.box.h + 46;
    const gap = 46;
    const x0 = this.cx - ((total - 1) * gap) / 2;
    for (let i = 0; i < total; i++) {
      const x = x0 + i * gap;
      const done = this.paths[i].done;
      const active = i === this.strokeIndex;
      const r = active ? 17 : 14;
      roundRect(ctx, x - r, y - r, r * 2, r * 2, r * 0.5);
      ctx.fillStyle = done ? this.crayonColor(i) : active ? 'rgba(255,255,255,0.95)' : 'rgba(255,255,255,0.55)';
      ctx.fill();
      if (active && !done) {
        ctx.lineWidth = 4;
        ctx.strokeStyle = '#3ddc84';
        ctx.stroke();
      }
      softText(ctx, String(i + 1), x, y + 1, 20, { color: done ? '#ffffff' : Palette.inkSoft });
    }
  }

  destroy() {
    this.paths = null;
  }
}
