/**
 * Persistent progress + settings, stored in localStorage.
 *
 * Deliberately forgiving: nothing here can ever throw (Safari private mode
 * disables storage), and a corrupt blob just resets to defaults rather than
 * bricking the arcade.
 */

import { spriteNameFor } from './sprites.js';

const KEY = 'kindercade.save.v1';

const DEFAULTS = {
  sound: true,
  voice: true,
  voiceURI: '',          // '' = let the audio kit pick the best one it can find
  speechRate: 1,         // global speed trim for the talking voice
  stickers: [],          // sprite names collected into the sticker book
  games: {},             // id -> { stars, best, plays, level }
  totalStars: 0,
  lastPlayed: null,
};

function load() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return { ...DEFAULTS };
    const data = JSON.parse(raw);
    // Saves from the emoji era stored stickers as emoji characters; migrate
    // them to sprite names so the collection survives the art change.
    const stickers = [...new Set(
      [...(data.stickers || [])].map((s) => spriteNameFor(s) || s).filter((s) => STICKERS.includes(s)),
    )];
    return { ...DEFAULTS, ...data, games: { ...(data.games || {}) }, stickers };
  } catch (_) {
    return { ...DEFAULTS };
  }
}

class Progress {
  constructor() {
    this.data = load();
    this._listeners = new Set();
  }

  save() {
    try { localStorage.setItem(KEY, JSON.stringify(this.data)); } catch (_) { /* storage unavailable */ }
    this._listeners.forEach((fn) => fn(this.data));
  }

  onChange(fn) { this._listeners.add(fn); return () => this._listeners.delete(fn); }

  /* ------------------------------------------------------------- settings */

  get sound() { return this.data.sound !== false; }
  set sound(v) { this.data.sound = !!v; this.save(); }

  get voice() { return this.data.voice !== false; }
  set voice(v) { this.data.voice = !!v; this.save(); }

  /** Which system voice to talk with; empty means "pick the best available". */
  get voiceURI() { return this.data.voiceURI || ''; }
  set voiceURI(v) { this.data.voiceURI = v || ''; this.save(); }

  get speechRate() { return this.data.speechRate || 1; }
  set speechRate(v) { this.data.speechRate = Number(v) || 1; this.save(); }

  /* ----------------------------------------------------------- game state */

  game(id) {
    if (!this.data.games[id]) this.data.games[id] = { stars: 0, best: 0, plays: 0, level: 1 };
    return this.data.games[id];
  }

  /** Highest level the child has unlocked in a game (levels unlock as they win). */
  levelFor(id) { return this.game(id).level || 1; }

  unlockLevel(id, level) {
    const g = this.game(id);
    if (level > (g.level || 1)) { g.level = level; this.save(); }
  }

  /**
   * Record the result of a finished round.
   * @returns {{newStars:number, totalStars:number, sticker:string|null}}
   */
  recordRound(id, { stars = 0, score = 0 } = {}) {
    const g = this.game(id);
    g.plays = (g.plays || 0) + 1;
    if (score > (g.best || 0)) g.best = score;
    // Stars are a personal best, not a running total, so replaying can only help.
    const gained = Math.max(0, stars - (g.stars || 0));
    if (stars > (g.stars || 0)) g.stars = stars;
    this.data.totalStars = Object.values(this.data.games).reduce((s, x) => s + (x.stars || 0), 0);
    this.data.lastPlayed = id;
    const sticker = this.maybeAwardSticker();
    this.save();
    return { newStars: gained, totalStars: this.data.totalStars, sticker };
  }

  starsFor(id) { return this.game(id).stars || 0; }
  get totalStars() { return this.data.totalStars || 0; }

  /* ------------------------------------------------------------- stickers */

  /** One new sticker for every 3 stars earned — a steady, visible reward. */
  maybeAwardSticker() {
    const deserved = Math.floor(this.totalStars / 3);
    if (this.data.stickers.length >= deserved) return null;
    const pool = STICKERS.filter((s) => !this.data.stickers.includes(s));
    if (!pool.length) return null;
    const sticker = pool[Math.floor(Math.random() * pool.length)];
    this.data.stickers.push(sticker);
    return sticker;
  }

  get stickers() { return this.data.stickers; }

  reset() {
    this.data = { ...DEFAULTS, games: {}, stickers: [] };
    this.save();
  }
}

/** The sticker book: 36 collectables (sprite names), unlocked 1 per 3 stars. */
export const STICKERS = [
  'fox', 'panda', 'lion', 'frog', 'octopus', 'unicorn', 'bee', 'butterfly', 'whale', 'dinosaur', 'penguin', 'owl',
  'rainbow', 'star', 'sparkle-star', 'clover', 'sunflower', 'blossom', 'watermelon', 'donut', 'cupcake', 'cookie',
  'rocket', 'balloon', 'palette', 'guitar', 'ball', 'castle', 'roller-skate', 'kite', 'carousel', 'puzzle-piece',
  'gem', 'crystal-ball', 'trophy', 'crown',
];

export const progress = new Progress();
