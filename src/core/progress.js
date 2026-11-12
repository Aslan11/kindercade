/**
 * Persistent progress + settings, stored in localStorage.
 *
 * Deliberately forgiving: nothing here can ever throw (Safari private mode
 * disables storage), and a corrupt blob just resets to defaults rather than
 * bricking the arcade.
 *
 * Each child is a *player* with their own buddy, stars and toys. Two things
 * are earned. **Stars** are a personal best for each level of each game.
 * **Presents** come from the star jar, which every finished game pours into —
 * replays included — so a favourite game never stops paying out.
 */

const KEY = 'kindercade.save.v1';

/** Level 1 of every game is pitched at a three-year-old; older children start on 2. */
export const LEVELS = 4;
export const startLevel = (age) => (age <= 3 ? 1 : 2);
export const MAX_PLAYERS = 4;
export const BUDDIES = ['ziggy', 'momo', 'bolt', 'fizz', 'sprout', 'nova'];
/** Stars it takes to fill the jar and earn a present. */
export const JAR_SIZE = 5;

/** Presents a buddy can wear. */
export const HATS = ['party-hat', 'crown', 'cap', 'hat', 'wizard-hat', 'chef-hat', 'sun-hat'];

/** Everything that can come out of a present (model names). */
export const TOYS = [
  'panda', 'lion', 'frog', 'octopus', 'unicorn', 'bee', 'butterfly', 'whale', 'dinosaur', 'penguin', 'owl', 'fox',
  'bunny', 'elephant', 'monkey', 'giraffe', 'koala', 'tiger', 'turtle', 'duck', 'ladybug', 'crab', 'zebra', 'robot',
  'rainbow', 'star', 'clover', 'sunflower', 'cactus', 'planet', 'watermelon', 'donut', 'cupcake', 'cookie',
  'rocket', 'balloon', 'guitar', 'ball', 'castle', 'kite', 'train', 'plane', 'gem', 'trophy', 'xylophone',
  ...HATS,
];

const newPlayer = (o = {}) => ({
  name: '',              // optional; the voice uses it to say hello
  buddy: '',             // '' until the child has picked one
  age: 5,
  toys: [],              // model names, in the order they were unwrapped
  hat: '',               // what the buddy is wearing
  jar: JAR_SIZE - 1,     // nearly full, so the very first game ends in a present
  games: {},             // id -> { levels: [best stars per level], level: highest unlocked }
  ...o,
});

const fresh = () => ({
  sound: true,
  music: true,
  voice: true,
  voiceURI: '',          // '' = let the audio kit pick the best one it can find
  speechRate: 1,         // global speed trim for the talking voice
  players: [newPlayer()],
  current: 0,
});

const randomNewToy = (owned) => {
  const pool = TOYS.filter((t) => !owned.includes(t));
  return pool.length ? pool[Math.floor(Math.random() * pool.length)] : null;
};

/** A save from the one-player, three-level, sticker-book era becomes player one. */
function migrate({ games = {}, stickers = [], totalStars, lastPlayed, ...settings }) {
  const player = newPlayer();
  for (const [id, g] of Object.entries(games)) {
    if (!g.plays) continue;
    // The old levels 1–3 are now 2–4, and shared a single best score.
    const level = Math.min(LEVELS, (g.level || 1) + 1);
    const cleared = Math.max(2, level - 1);
    player.games[id] = { level, levels: Array.from({ length: LEVELS }, (_, i) => (i >= 1 && i < cleared ? g.stars || 0 : 0)) };
  }
  const earned = [...new Set(stickers)];
  player.toys = earned.filter((t) => TOYS.includes(t));
  // A sticker with no matching toy is swapped, so the collection never shrinks.
  while (player.toys.length < Math.min(earned.length, TOYS.length)) player.toys.push(randomNewToy(player.toys));
  // One switch used to silence everything; a muted arcade stays muted.
  const quiet = settings.sound === false ? { music: false, voice: false } : {};
  return { ...fresh(), ...settings, ...quiet, players: [player] };
}

function load() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return fresh();
    const data = JSON.parse(raw);
    if (!Array.isArray(data.players) || !data.players.length) return migrate(data);
    const players = data.players.map((p) => newPlayer(p));
    return { ...fresh(), ...data, players, current: players[data.current] ? data.current : 0 };
  } catch (_) {
    return fresh();
  }
}

class Progress {
  constructor() {
    this.data = load();
    // Write a migrated save straight back, so swapped toys stay the same toys.
    this.save();
  }

  save() {
    try { localStorage.setItem(KEY, JSON.stringify(this.data)); } catch (_) { /* storage unavailable */ }
  }

  /* ------------------------------------------------------------- settings */

  get sound() { return this.data.sound !== false; }
  set sound(v) { this.data.sound = !!v; this.save(); }

  get music() { return this.data.music !== false; }
  set music(v) { this.data.music = !!v; this.save(); }

  get voice() { return this.data.voice !== false; }
  set voice(v) { this.data.voice = !!v; this.save(); }

  /** Which system voice to talk with; empty means "pick the best available". */
  get voiceURI() { return this.data.voiceURI || ''; }
  set voiceURI(v) { this.data.voiceURI = v || ''; this.save(); }

  get speechRate() { return this.data.speechRate || 1; }
  set speechRate(v) { this.data.speechRate = Number(v) || 1; this.save(); }

  /* -------------------------------------------------------------- players */

  get players() { return this.data.players; }
  get player() { return this.data.players[this.data.current]; }
  switchTo(i) { this.data.current = i; this.save(); }

  /** Fill in the waiting first player, or add another. */
  addPlayer({ buddy, age }) {
    if (this.player.buddy) this.data.current = this.players.push(newPlayer()) - 1;
    Object.assign(this.player, { buddy, age });
    this.save();
  }

  /** Forget the current player altogether. */
  removePlayer() {
    this.players.splice(this.data.current, 1);
    if (!this.players.length) this.players.push(newPlayer());
    this.switchTo(0);
  }

  get buddy() { return this.player.buddy || BUDDIES[0]; }

  get name() { return this.player.name; }
  set name(v) { this.player.name = String(v).trim().slice(0, 14); this.save(); }

  get age() { return this.player.age; }
  set age(v) { this.player.age = Number(v) || 5; this.save(); }

  get hat() { return this.player.hat; }
  set hat(v) { this.player.hat = v; this.save(); }

  get jar() { return this.player.jar; }
  get toys() { return this.player.toys; }

  /* ----------------------------------------------------------- game state */

  /** Highest level the child has unlocked in a game. */
  levelFor(id) { return Math.max(this.player.games[id]?.level || 1, startLevel(this.age)); }

  /** Best stars on one level, or across the whole game when `level` is omitted. */
  starsFor(id, level = 0) {
    const levels = this.player.games[id]?.levels || [];
    return level ? levels[level - 1] || 0 : levels.reduce((a, b) => a + b, 0);
  }

  get totalStars() { return Object.keys(this.player.games).reduce((s, id) => s + this.starsFor(id), 0); }

  /**
   * Record a finished game. The present is banked here, before it is
   * unwrapped, so leaving mid-celebration never loses it.
   */
  recordRound(id, level, stars) {
    const p = this.player;
    const open = this.levelFor(id);
    const g = p.games[id] || (p.games[id] = { levels: new Array(LEVELS).fill(0), level: 1 });
    g.levels[level - 1] = Math.max(g.levels[level - 1] || 0, stars);
    const unlocked = stars >= 2 && level === open && level < LEVELS;
    if (unlocked) g.level = level + 1;

    const jarBefore = p.jar;
    let toy = null;
    p.jar += stars;
    const filled = p.jar >= JAR_SIZE;
    if (filled) {
      p.jar -= JAR_SIZE;
      toy = randomNewToy(p.toys);
      if (toy) p.toys.push(toy);
    }
    this.save();
    return { unlocked, jarBefore, jarAfter: p.jar, filled, toy };
  }
}

export const progress = new Progress();
