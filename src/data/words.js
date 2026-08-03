/**
 * Shared vocabulary.
 *
 * Every word is picture-backed, because the child playing this cannot yet read
 * the word he is being asked to spell. Tiers map to spelling difficulty:
 *
 *   1 — three-letter CVC words (cat, sun, bus)
 *   2 — four-letter words, mostly simple blends (frog, star, cake)
 *   3 — five-letter words (apple, train, zebra)
 */

export const WORDS = [
  // ---- tier 1: CVC -------------------------------------------------------
  { word: 'cat', emoji: '🐱', tier: 1 },
  { word: 'dog', emoji: '🐶', tier: 1 },
  { word: 'pig', emoji: '🐷', tier: 1 },
  { word: 'cow', emoji: '🐮', tier: 1 },
  { word: 'fox', emoji: '🦊', tier: 1 },
  { word: 'bee', emoji: '🐝', tier: 1 },
  { word: 'ant', emoji: '🐜', tier: 1 },
  { word: 'owl', emoji: '🦉', tier: 1 },
  { word: 'bat', emoji: '🦇', tier: 1 },
  { word: 'hen', emoji: '🐔', tier: 1 },
  { word: 'sun', emoji: '☀️', tier: 1 },
  { word: 'hat', emoji: '🎩', tier: 1 },
  { word: 'cap', emoji: '🧢', tier: 1 },
  { word: 'cup', emoji: '☕️', tier: 1 },
  { word: 'bus', emoji: '🚌', tier: 1 },
  { word: 'car', emoji: '🚗', tier: 1 },
  { word: 'van', emoji: '🚐', tier: 1 },
  { word: 'box', emoji: '📦', tier: 1 },
  { word: 'key', emoji: '🔑', tier: 1 },
  { word: 'bed', emoji: '🛏️', tier: 1 },
  { word: 'egg', emoji: '🥚', tier: 1 },
  { word: 'pie', emoji: '🥧', tier: 1 },
  { word: 'nut', emoji: '🥜', tier: 1 },
  { word: 'jar', emoji: '🫙', tier: 1 },
  { word: 'log', emoji: '🪵', tier: 1 },
  { word: 'pen', emoji: '🖊️', tier: 1 },
  { word: 'web', emoji: '🕸️', tier: 1 },
  { word: 'axe', emoji: '🪓', tier: 1 },
  { word: 'map', emoji: '🗺️', tier: 1 },
  { word: 'gem', emoji: '💎', tier: 1 },

  // ---- tier 2: four letters ---------------------------------------------
  { word: 'fish', emoji: '🐟', tier: 2 },
  { word: 'frog', emoji: '🐸', tier: 2 },
  { word: 'bear', emoji: '🐻', tier: 2 },
  { word: 'lion', emoji: '🦁', tier: 2 },
  { word: 'duck', emoji: '🦆', tier: 2 },
  { word: 'bird', emoji: '🐦', tier: 2 },
  { word: 'crab', emoji: '🦀', tier: 2 },
  { word: 'goat', emoji: '🐐', tier: 2 },
  { word: 'wolf', emoji: '🐺', tier: 2 },
  { word: 'deer', emoji: '🦌', tier: 2 },
  { word: 'star', emoji: '⭐️', tier: 2 },
  { word: 'moon', emoji: '🌙', tier: 2 },
  { word: 'tree', emoji: '🌳', tier: 2 },
  { word: 'leaf', emoji: '🍃', tier: 2 },
  { word: 'rain', emoji: '🌧️', tier: 2 },
  { word: 'fire', emoji: '🔥', tier: 2 },
  { word: 'rock', emoji: '🪨', tier: 2 },
  { word: 'cake', emoji: '🍰', tier: 2 },
  { word: 'milk', emoji: '🥛', tier: 2 },
  { word: 'corn', emoji: '🌽', tier: 2 },
  { word: 'pear', emoji: '🍐', tier: 2 },
  { word: 'book', emoji: '📕', tier: 2 },
  { word: 'ball', emoji: '⚽️', tier: 2 },
  { word: 'drum', emoji: '🥁', tier: 2 },
  { word: 'bell', emoji: '🔔', tier: 2 },
  { word: 'boat', emoji: '⛵️', tier: 2 },
  { word: 'kite', emoji: '🪁', tier: 2 },
  { word: 'sock', emoji: '🧦', tier: 2 },
  { word: 'ring', emoji: '💍', tier: 2 },
  { word: 'gift', emoji: '🎁', tier: 2 },
  { word: 'door', emoji: '🚪', tier: 2 },
  { word: 'lamp', emoji: '💡', tier: 2 },
  { word: 'shoe', emoji: '👟', tier: 2 },
  { word: 'hand', emoji: '✋', tier: 2 },
  { word: 'nest', emoji: '🪺', tier: 2 },
  { word: 'moth', emoji: 'moth', tier: 2 },   // sprite name: 🦋 belongs to 'butterfly'

  // ---- tier 3: five letters ---------------------------------------------
  { word: 'apple', emoji: '🍎', tier: 3 },
  { word: 'train', emoji: '🚂', tier: 3 },
  { word: 'house', emoji: '🏠', tier: 3 },
  { word: 'horse', emoji: '🐴', tier: 3 },
  { word: 'snake', emoji: '🐍', tier: 3 },
  { word: 'mouse', emoji: '🐭', tier: 3 },
  { word: 'sheep', emoji: '🐑', tier: 3 },
  { word: 'whale', emoji: '🐳', tier: 3 },
  { word: 'tiger', emoji: '🐯', tier: 3 },
  { word: 'zebra', emoji: '🦓', tier: 3 },
  { word: 'panda', emoji: '🐼', tier: 3 },
  { word: 'koala', emoji: '🐨', tier: 3 },
  { word: 'bread', emoji: '🍞', tier: 3 },
  { word: 'pizza', emoji: '🍕', tier: 3 },
  { word: 'grape', emoji: '🍇', tier: 3 },
  { word: 'peach', emoji: '🍑', tier: 3 },
  { word: 'lemon', emoji: '🍋', tier: 3 },
  { word: 'melon', emoji: '🍈', tier: 3 },
  { word: 'candy', emoji: '🍬', tier: 3 },
  { word: 'donut', emoji: '🍩', tier: 3 },
  { word: 'cloud', emoji: '☁️', tier: 3 },
  { word: 'plane', emoji: '✈️', tier: 3 },
  { word: 'truck', emoji: '🚚', tier: 3 },
  { word: 'robot', emoji: '🤖', tier: 3 },
  { word: 'crown', emoji: '👑', tier: 3 },
  { word: 'chair', emoji: '🪑', tier: 3 },
  { word: 'clock', emoji: '⏰', tier: 3 },
  { word: 'brush', emoji: '🖌️', tier: 3 },
  { word: 'heart', emoji: '❤️', tier: 3 },
  { word: 'skunk', emoji: '🦨', tier: 3 },
];

export const wordsByTier = (tier) => WORDS.filter((w) => w.tier === tier);

/** Tier for a level number, so every game scales the same way. */
export const tierForLevel = (level) => Math.min(3, Math.max(1, level));

/** Words that start with a given letter. */
export const wordsStartingWith = (letter) =>
  WORDS.filter((w) => w.word[0].toLowerCase() === letter.toLowerCase());

/** Letters that actually have picture words behind them (used by the phonics game). */
export const SOUND_LETTERS = [...new Set(WORDS.map((w) => w.word[0]))].sort();

/*
 * ── Phonics safety ──────────────────────────────────────────────────────────
 *
 * Sound Safari plays a *sound* and asks for a *letter*, which only works for
 * words where the two actually line up. English is not cooperative about this:
 * "shoe" does not start with the sound of S, "gem" does not start with the
 * sound of G, and "cake" very much does not end with the sound of E.
 *
 * Asking about those words does not just make the round unfair — it teaches
 * something false. So the pool is filtered instead, which costs a handful of
 * words and nothing else.
 */

/** True when the first letter really is the first sound. */
export const startsWithItsLetter = (word) => {
  const w = String(word).toLowerCase();
  if (/^(sh|ch|th|wh|ph|kn|wr|gn)/.test(w)) return false;   // shoe, sheep, chair
  if (/^[gc][eiy]/.test(w)) return false;                   // gem — soft g and c
  if (/^(ow|oi|ou|au|aw|ai|ea|ee|ie|oa|ey|oo)/.test(w)) return false; // owl
  return true;
};

/** True when the last letter really is the last sound. */
export const endsWithItsLetter = (word) => {
  const w = String(word).toLowerCase();
  if (/(sh|ch|th|ph|ng)$/.test(w)) return false;  // fish, moth, peach, ring
  if (/e$/.test(w)) return false;                 // silent e and long e: cake, bee
  if (/[aiouwy]$/.test(w)) return false;          // zebra, candy, cow, key
  if (/r$/.test(w)) return false;                 // star, tiger — a vowel, not /r/
  return true;
};

export const ALPHABET = 'abcdefghijklmnopqrstuvwxyz'.split('');
export const VOWELS = ['a', 'e', 'i', 'o', 'u'];
export const CONSONANTS = ALPHABET.filter((c) => !VOWELS.includes(c));

/**
 * How each letter is *named* out loud, for when the name is what's wanted —
 * spelling a word out, or asking a child to find a particular letter.
 *
 * Asked to read a bare "A", most engines produce the unstressed article ("uh")
 * rather than the letter name, and "G"/"J" and "M"/"N" come out swapped often
 * enough to matter. Spelling the names phonetically is the only reliable fix.
 */
export const LETTER_NAME = {
  a: 'ay', b: 'bee', c: 'see', d: 'dee', e: 'ee', f: 'eff', g: 'jee', h: 'aitch',
  i: 'eye', j: 'jay', k: 'kay', l: 'ell', m: 'em', n: 'en', o: 'oh', p: 'pee',
  q: 'cue', r: 'ar', s: 'ess', t: 'tee', u: 'you', v: 'vee', w: 'double you',
  x: 'ex', y: 'why', z: 'zee',
};

/**
 * How a letter *sounds* on its own. Speech synthesis says the letter *name*
 * ("bee"), which is what spelling needs, but a child sounding a word out needs
 * the sound ("buh"), so it is spelled phonetically for the voice.
 *
 * Every value here has to be a syllable a speech engine can actually read.
 * Written the way phonics books print them — "sss", "fff", "rrr" — a run of
 * repeated consonants is not a word to any engine, so it gives up and reads the
 * letters out one at a time: the child asks for the sound of S and hears
 * "ess, ess, ess". Vowel-less spellings go the same way ("ks" comes out as
 * "kay ess").
 *
 * So each sound is written as the shortest syllable that carries it. That adds
 * a faint schwa to the continuants a teacher would hold instead ("suh" rather
 * than a long hiss), which is the standard compromise in read-aloud phonics —
 * and it is the same sound on every device, which the old spellings were not.
 */
export const LETTER_SOUND = {
  a: 'ah', b: 'buh', c: 'kuh', d: 'duh', e: 'eh', f: 'fuh', g: 'guh', h: 'huh',
  i: 'ih', j: 'juh', k: 'kuh', l: 'luh', m: 'muh', n: 'nuh', o: 'ah', p: 'puh',
  q: 'kwuh', r: 'ruh', s: 'suh', t: 'tuh', u: 'uh', v: 'vuh', w: 'wuh',
  x: 'kuss', y: 'yuh', z: 'zuh',
};

/** Number words 0–20, plus the tens, for the arithmetic games' voice-over. */
export const NUMBER_WORDS = [
  'zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten',
  'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen',
  'eighteen', 'nineteen', 'twenty',
];

export const numberWord = (n) => NUMBER_WORDS[n] ?? String(n);

/** Cheerful, varied praise — hearing the same phrase every time gets old fast. */
export const PRAISE = [
  'Great job!', 'You did it!', 'Awesome!', 'Nice work!', 'Brilliant!',
  'Way to go!', 'Fantastic!', 'Super!', 'You are amazing!', 'Perfect!',
];

/** Encouragement for a wrong answer — always forward-looking, never negative. */
export const ENCOURAGE = [
  'Try again!', 'Almost!', 'So close!', 'Have another go!', 'Keep going!',
];

/** Countable objects for the arithmetic games. */
export const COUNTABLES = [
  { emoji: '🍎', name: 'apples' }, { emoji: '🍌', name: 'bananas' },
  { emoji: '🍓', name: 'strawberries' }, { emoji: '🐟', name: 'fish' },
  { emoji: '🐝', name: 'bees' }, { emoji: '🦋', name: 'butterflies' },
  { emoji: '⭐️', name: 'stars' }, { emoji: '🌸', name: 'flowers' },
  { emoji: '🍄', name: 'mushrooms' }, { emoji: '🐢', name: 'turtles' },
  { emoji: '🐸', name: 'frogs' }, { emoji: '🍪', name: 'cookies' },
  { emoji: '🎈', name: 'balloons' }, { emoji: '🚗', name: 'cars' },
  { emoji: '🦆', name: 'ducks' }, { emoji: '🐧', name: 'penguins' },
];

/** Shapes + colours used by the pattern and sorting puzzles. */
export const SHAPES = ['circle', 'square', 'triangle', 'star', 'heart', 'diamond'];
export const SHAPE_COLORS = ['#ff6b8b', '#ffc93c', '#4cc9f0', '#3ddc97', '#9b6cff', '#ff9f1c'];
