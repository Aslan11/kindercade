/**
 * The canvas runtime and the `Game` base class every mini-game extends.
 *
 * Coordinate space
 * ----------------
 * Games are written in a *logical* space that is always 900 units tall; the
 * width follows the device aspect ratio (clamped to 1100..1700). That means no
 * letterbox bars on any iPad, and games only have to be flexible horizontally.
 *
 *   this.W / this.H     logical size
 *   this.playTop        first y that is clear of the HUD
 *   this.cx             horizontal centre, i.e. this.W / 2
 *
 * Lay out from `layout()` rather than `init()` — the engine re-runs `layout()`
 * whenever the device rotates or the window resizes.
 */

import { Input } from './input.js';
import { FX } from './fx.js';
import { Tweens } from './anim.js';
import { audio } from './audio.js';
import { progress } from './progress.js';
import { ButtonLayer, Button, ResultsPanel, starChip, pill } from './ui.js';
import { drawBackdrop, glassPanel, progressPips, Palette, font, fitFontSize, Subjects } from './art.js';
import { clamp } from './util.js';

export const DESIGN_H = 900;
const MIN_ASPECT = 1.15;
const MAX_ASPECT = 1.9;
const MAX_DT = 1 / 20; // clamp so a background tab never explodes the physics

/* ------------------------------------------------------------------- engine */

export class Engine {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d', { alpha: false });
    this.W = 1200;
    this.H = DESIGN_H;
    this.dpr = 1;
    this.game = null;
    this.running = false;
    this.lastTime = 0;
    this.onExit = null;

    this.scale = 1;
    this.offsetX = 0;
    this.offsetY = 0;

    this.input = new Input(canvas, {
      toLogical: (clientX, clientY) => {
        const r = this.canvas.getBoundingClientRect();
        // CSS pixels -> backing-store pixels -> logical units (undoing letterbox).
        const bx = ((clientX - r.left) / Math.max(1, r.width)) * this.canvas.width;
        const by = ((clientY - r.top) / Math.max(1, r.height)) * this.canvas.height;
        return {
          x: (bx - this.offsetX) / this.scale,
          y: (by - this.offsetY) / this.scale,
        };
      },
    });

    this._loop = this._loop.bind(this);
    this._onResize = this._onResize.bind(this);
    this._onVisibility = this._onVisibility.bind(this);
    window.addEventListener('resize', this._onResize);
    window.addEventListener('orientationchange', this._onResize);
    document.addEventListener('visibilitychange', this._onVisibility);
    this.resize();
  }

  resize() {
    const cssW = this.canvas.clientWidth || window.innerWidth;
    const cssH = this.canvas.clientHeight || window.innerHeight;
    const aspect = clamp(cssW / Math.max(1, cssH), MIN_ASPECT, MAX_ASPECT);
    this.H = DESIGN_H;
    this.W = Math.round(DESIGN_H * aspect);
    this.dpr = clamp(window.devicePixelRatio || 1, 1, 2.5);

    this.canvas.width = Math.max(1, Math.round(cssW * this.dpr));
    this.canvas.height = Math.max(1, Math.round(cssH * this.dpr));

    // Uniform scale + centring. Inside the clamped aspect range this is an exact
    // fit; outside it (an iPad held in portrait) it letterboxes rather than
    // stretching the artwork.
    this.scale = Math.min(this.canvas.width / this.W, this.canvas.height / this.H);
    this.offsetX = Math.round((this.canvas.width - this.W * this.scale) / 2);
    this.offsetY = Math.round((this.canvas.height - this.H * this.scale) / 2);
    // Nearest-neighbour for the whole frame — sprite blits and scaled pixel
    // art stay chunky-crisp, matching sprites.js. (Resizing the canvas resets
    // context state, so this must be re-applied here.)
    this.ctx.imageSmoothingEnabled = false;

    if (this.game) {
      this.game.W = this.W;
      this.game.H = this.H;
      this.game._relayout();
    }
  }

  _onResize() {
    // Safari fires resize mid-rotation; settle on the next frame.
    cancelAnimationFrame(this._resizeRaf);
    this._resizeRaf = requestAnimationFrame(() => this.resize());
  }

  _onVisibility() {
    if (document.hidden) audio.stopSpeech();
    this.lastTime = 0;
  }

  /** Mount a Game subclass. Any previous game is destroyed first. */
  start(GameClass, opts = {}) {
    this.stop();
    const game = new GameClass(this, opts);
    this.game = game;
    game.W = this.W;
    game.H = this.H;
    game._boot();
    this.input.setHandlers({
      onPointerDown: (p) => game._pointerDown(p),
      onPointerMove: (p) => game._pointerMove(p),
      onPointerUp: (p) => game._pointerUp(p),
      onTap: (p) => game._tap(p),
    });
    this.running = true;
    this.lastTime = 0;
    cancelAnimationFrame(this._raf);
    this._raf = requestAnimationFrame(this._loop);
    return game;
  }

  stop() {
    this.running = false;
    cancelAnimationFrame(this._raf);
    this.input.setHandlers(null);
    audio.stopSpeech();
    if (this.game) { try { this.game.destroy(); } catch (e) { console.error(e); } }
    this.game = null;
  }

  destroy() {
    this.stop();
    this.input.destroy();
    window.removeEventListener('resize', this._onResize);
    window.removeEventListener('orientationchange', this._onResize);
    document.removeEventListener('visibilitychange', this._onVisibility);
  }

  _loop(now) {
    if (!this.running) return;
    this._raf = requestAnimationFrame(this._loop);
    if (!this.lastTime) this.lastTime = now;
    const dt = Math.min(MAX_DT, (now - this.lastTime) / 1000);
    this.lastTime = now;
    const game = this.game;
    if (!game) return;
    const ctx = this.ctx;
    try {
      game._step(dt);
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      if (this.offsetX > 0 || this.offsetY > 0) {
        ctx.fillStyle = '#150f28';
        ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
      }
      ctx.setTransform(this.scale, 0, 0, this.scale, this.offsetX, this.offsetY);
      ctx.save();
      ctx.beginPath();
      ctx.rect(0, 0, this.W, this.H);
      ctx.clip();
      game._render(ctx);
      ctx.restore();
    } catch (err) {
      console.error('[kindercade] game loop error', err);
      this.running = false;
    }
  }
}

/* ------------------------------------------------------------- Game base class */

export class Game {
  /**
   * Subclasses declare:
   *   static meta = { id, title, subject, blurb, emoji, tint }
   */
  static meta = { id: 'game', title: 'Game', subject: 'puzzle', blurb: '', emoji: '🎮', tint: '#9b6cff' };

  constructor(engine, opts = {}) {
    this.engine = engine;
    this.opts = opts;
    this.ctx = engine.ctx;
    this.W = engine.W;
    this.H = engine.H;
    this.audio = audio;
    this.progress = progress;
    this.fx = new FX();
    this.tweens = new Tweens();
    this.buttons = new ButtonLayer();   // game-owned buttons
    this.hud = new ButtonLayer();       // engine-owned HUD buttons
    this.t = 0;
    this.paused = false;

    this.level = opts.level || progress.levelFor(this.meta.id);
    this.maxLevel = 3;
    this.roundsTotal = 6;
    this.roundsDone = 0;
    this.mistakes = 0;
    this.score = 0;
    this.finished = false;

    this.prompt = '';
    this.promptSpeech = '';
    this.showPips = true;
    this.backdrop = {};
  }

  get meta() { return this.constructor.meta; }
  get cx() { return this.W / 2; }
  get cy() { return this.H / 2; }
  /** First y-coordinate clear of the HUD. */
  get playTop() { return 172; }
  get playH() { return this.H - this.playTop; }
  get tint() { return this.meta.tint || Subjects[this.meta.subject]?.color || Palette.grape; }

  /* ----------------------------------------------------------- lifecycle */

  _boot() {
    this.results = new ResultsPanel({
      W: this.W, H: this.H,
      onAgain: () => this.restart(),
      onHome: () => this.exit(),
      onNext: () => this.nextLevel(),
    });
    this._buildHud();
    this.init();
    this._relayout();
    // Give the intro speech a beat so it does not collide with the tap that
    // launched the game.
    this.tweens.after(0.45, () => this.speakPrompt());
  }

  _buildHud() {
    this.hud.clear();
    this.backBtn = this.hud.add(new Button({
      x: 76, y: 76, circle: true, radius: 46, emoji: 'icon-home', color: '#ff8fa8',
      onTap: () => { this.audio.tap(); this.exit(); },
    }));
    this.speakBtn = this.hud.add(new Button({
      x: 200, y: 76, circle: true, radius: 42, emoji: 'icon-speaker', color: '#7fd1ff',
      onTap: () => this.replayPrompt(),
    }));
  }

  _relayout() {
    if (this.results) {
      // Rebuild so the results buttons re-centre after a rotation.
      const wasVisible = this.results.visible;
      const state = { stars: this.results.stars, title: this.results.title, sticker: this.results.sticker, hasNext: !this.results.nextBtn.hidden };
      this.results = new ResultsPanel({
        W: this.W, H: this.H,
        onAgain: () => this.restart(),
        onHome: () => this.exit(),
        onNext: () => this.nextLevel(),
      });
      if (wasVisible) { this.results.show(state); this.results.t = 99; this.results.shownStars = state.stars; this.results.pop.set(1); }
    }
    this._buildHud();
    if (this.speakBtn) this.speakBtn.x = 200;
    try { this.layout(); } catch (e) { console.error(e); }
  }

  /** Called once when the game starts. */
  init() {}
  /** Called after init and on every resize — put position maths here. */
  layout() {}
  /** Per-frame logic. */
  update(_dt) {}
  /** Per-frame drawing of game content. Buttons and the HUD draw on top of this. */
  draw(_ctx) {}
  /** Drawn above `this.buttons` — for anything that must cover them. */
  drawOverlay(_ctx) {}
  /** Cleanup — remove listeners, cancel timers. */
  destroy() {}

  /* --------------------------------------------------------------- input */

  onPointerDown(_p) {}
  onPointerMove(_p) {}
  onPointerUp(_p) {}
  onTap(_p) {}

  _pointerDown(p) {
    this.audio.unlock();
    if (this.results?.visible) { this.results.pointerDown(p); return; }
    if (this.hud.pointerDown(p)) return;
    if (this.buttons.pointerDown(p)) return;
    this.onPointerDown(p);
  }

  _pointerMove(p) {
    if (this.results?.visible) { this.results.pointerMove(p); return; }
    this.hud.pointerMove(p);
    this.buttons.pointerMove(p);
    this.onPointerMove(p);
  }

  _pointerUp(p) {
    if (this.results?.visible) { this.results.pointerUp(p); return; }
    if (this.hud.pointerUp(p)) return;
    if (this.buttons.pointerUp(p)) return;
    this.onPointerUp(p);
  }

  _tap(p) {
    if (this.results?.visible) return;
    this.onTap(p);
  }

  /* ---------------------------------------------------------------- frame */

  _step(dt) {
    this.t += dt;
    if (this.paused) return;
    this.tweens.step(dt);
    this.fx.step(dt);
    this.hud.step(dt);
    this.buttons.step(dt);
    this.results?.step(dt, this.audio);
    this.update(dt);
  }

  _render(ctx) {
    const shake = this.fx.shakeOffset();
    ctx.save();
    ctx.translate(shake.x, shake.y);
    this.drawBackground(ctx);
    this.draw(ctx);
    this.buttons.draw(ctx);
    this.drawOverlay(ctx);
    this.fx.draw(ctx);
    ctx.restore();
    this.drawHud(ctx);
    this.results?.draw(ctx);
  }

  /** Override for a custom scene; the default is the shared Kindercade sky. */
  drawBackground(ctx) {
    drawBackdrop(ctx, this.W, this.H, this.t, this.backdrop);
  }

  drawHud(ctx) {
    // Instruction pill — the single most important element for a pre-reader,
    // paired with the speaker button so it can always be re-heard.
    if (this.prompt) {
      const maxW = this.W * 0.56;
      const size = fitFontSize(ctx, this.prompt, maxW - 56, 36, 800);
      ctx.save();
      ctx.font = font(size, 800);
      const tw = Math.min(maxW, ctx.measureText(this.prompt).width + 64);
      const h = 74;
      const x = this.cx - tw / 2;
      glassPanel(ctx, x, 76 - h / 2, tw, h, h / 2, { alpha: 0.93 });
      ctx.fillStyle = Palette.ink;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(this.prompt, this.cx, 77);
      ctx.restore();
      this.speakBtn.x = Math.max(272, x - 58);
    }

    if (this.showPips && this.roundsTotal > 1) {
      progressPips(ctx, this.cx, 140, this.roundsTotal, this.roundsDone, { color: this.tint });
    }

    starChip(ctx, this.W - 30, 52, this.progress.totalStars);
    if (this.maxLevel > 1) pill(ctx, this.W - 92, 112, `Level ${this.level}`, { size: 24 });

    this.hud.draw(ctx);
  }

  /* --------------------------------------------------------------- helpers */

  /**
   * Set the on-screen instruction and (optionally) speak it.
   *
   * `text` is read by a grown-up; `speech` is what the child hears. Keep them
   * separate whenever the on-screen text would give the answer away — a banner
   * reading "Spell nut" turns a spelling game into copying.
   */
  setPrompt(text, { speak = true, speech = null, delay = 0 } = {}) {
    this.prompt = text;
    this.promptSpeech = speech || text;
    if (speak) this.speakPrompt({ delay });
  }

  /**
   * Say the instruction. This is the *only* place a game should speak its
   * prompt — override it when the prompt is a sequence rather than one line.
   *
   * Queued rather than interrupting: every game's next round begins while the
   * last answer's sentence ("four plus one is five. Fantastic!") is still in
   * the air, and an interrupting prompt cuts it off mid-word — the voice
   * tripping over itself. Anywhere an instant restart is wanted (the 🔊
   * replay button) calls `stopSpeech()` first, which empties the queue.
   */
  speakPrompt({ delay = 0 } = {}) {
    const line = this.promptSpeech || this.prompt;
    if (line) this.audio.speak(line, { delay, interrupt: false });
  }

  /**
   * Subclasses override to draw attention to the next thing to touch.
   *
   * Visual only — it runs alongside `speakPrompt()`, so anything spoken here
   * lands on top of the instruction and both get chopped up.
   */
  hintPulse() {}

  /**
   * Wait for a spoken line to finish before moving on, within limits.
   *
   * `min` keeps a celebration on screen long enough to register even when the
   * talking voice is switched off, and `max` makes sure a device with broken or
   * missing speech can never hold a round open. Both run on the game's own
   * clock, so leaving mid-sentence simply stops everything.
   */
  afterSpeech(spoken, { min = 1.6, max = 7 } = {}) {
    const at = (s) => new Promise((done) => this.tweens.after(s, done));
    return Promise.all([at(min), Promise.race([spoken, at(max)])]);
  }

  /** The 🔊 button: repeat the instruction and point at what to do. */
  replayPrompt() {
    this.audio.stopSpeech();
    this.speakPrompt();
    this.hintPulse();
  }

  /** Standard positive feedback. */
  cheer(x = this.cx, y = this.cy, text = null) {
    this.audio.correct();
    this.fx.sparkle(x, y, 18);
    this.fx.starBurst(x, y, 10, this.tint);
    if (text) this.fx.floatText(x, y - 40, text, { color: '#fff3b0' });
  }

  /** Standard gentle "not quite" feedback — never punishing. */
  nudge(x = this.cx, y = this.cy) {
    this.audio.wrong();
    this.fx.addShake(5);
    this.fx.puff(x, y, 8, 'rgba(255,255,255,0.85)');
    this.mistakes++;
  }

  /** 3 stars for a clean round, 2 for a few slips, 1 for finishing at all. */
  starsEarned() {
    if (this.mistakes === 0) return 3;
    if (this.mistakes <= Math.max(2, Math.ceil(this.roundsTotal * 0.34))) return 2;
    return 1;
  }

  /** Call when the whole round is complete. */
  finishRound({ stars = null, title = 'Great job!', score = null } = {}) {
    if (this.finished) return;
    this.finished = true;
    const s = stars ?? this.starsEarned();
    const result = this.progress.recordRound(this.meta.id, { stars: s, score: score ?? this.score });
    if (s >= 2 && this.level < this.maxLevel) this.progress.unlockLevel(this.meta.id, this.level + 1);
    this.fx.confettiRain(this.W, 90);
    this.audio.fanfare();
    this.audio.speak(title, { delay: 0.5 });
    this.tweens.after(0.7, () => {
      this.results.show({ stars: s, title, sticker: result.sticker, hasNext: this.level < this.maxLevel });
    });
  }

  restart() {
    this.audio.tap();
    this.engine.start(this.constructor, { ...this.opts, level: this.level });
  }

  nextLevel() {
    this.audio.tap();
    const next = Math.min(this.maxLevel, this.level + 1);
    this.progress.unlockLevel(this.meta.id, next);
    this.engine.start(this.constructor, { ...this.opts, level: next });
  }

  exit() {
    this.audio.stopSpeech();
    this.engine.onExit?.();
  }
}
