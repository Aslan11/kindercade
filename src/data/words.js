/**
 * Shared vocabulary.
 *
 * Every word is also the name of a model in `src/models/`, because the child
 * playing this cannot yet read the word he is being asked to spell. Tiers map
 * to spelling difficulty:
 *
 *   1 — three-letter CVC words (cat, sun, bus)
 *   2 — four-letter words, mostly simple blends (frog, star, cake)
 *   3 — five-letter words (apple, train, zebra)
 */

export const WORDS = [
  // ---- tier 1: CVC -------------------------------------------------------
  { word: 'cat', tier: 1 },
  { word: 'dog', tier: 1 },
  { word: 'pig', tier: 1 },
  { word: 'cow', tier: 1 },
  { word: 'fox', tier: 1 },
  { word: 'bee', tier: 1 },
  { word: 'ant', tier: 1 },
  { word: 'owl', tier: 1 },
  { word: 'bat', tier: 1 },
  { word: 'hen', tier: 1 },
  { word: 'sun', tier: 1 },
  { word: 'hat', tier: 1 },
  { word: 'cap', tier: 1 },
  { word: 'cup', tier: 1 },
  { word: 'bus', tier: 1 },
  { word: 'car', tier: 1 },
  { word: 'van', tier: 1 },
  { word: 'box', tier: 1 },
  { word: 'key', tier: 1 },
  { word: 'bed', tier: 1 },
  { word: 'egg', tier: 1 },
  { word: 'pie', tier: 1 },
  { word: 'nut', tier: 1 },
  { word: 'jar', tier: 1 },
  { word: 'log', tier: 1 },
  { word: 'pen', tier: 1 },
  { word: 'web', tier: 1 },
  { word: 'axe', tier: 1 },
  { word: 'map', tier: 1 },
  { word: 'gem', tier: 1 },

  // ---- tier 2: four letters ---------------------------------------------
  { word: 'fish', tier: 2 },
  { word: 'frog', tier: 2 },
  { word: 'bear', tier: 2 },
  { word: 'lion', tier: 2 },
  { word: 'duck', tier: 2 },
  { word: 'bird', tier: 2 },
  { word: 'crab', tier: 2 },
  { word: 'goat', tier: 2 },
  { word: 'wolf', tier: 2 },
  { word: 'deer', tier: 2 },
  { word: 'star', tier: 2 },
  { word: 'moon', tier: 2 },
  { word: 'tree', tier: 2 },
  { word: 'leaf', tier: 2 },
  { word: 'rain', tier: 2 },
  { word: 'fire', tier: 2 },
  { word: 'rock', tier: 2 },
  { word: 'cake', tier: 2 },
  { word: 'milk', tier: 2 },
  { word: 'corn', tier: 2 },
  { word: 'pear', tier: 2 },
  { word: 'book', tier: 2 },
  { word: 'ball', tier: 2 },
  { word: 'drum', tier: 2 },
  { word: 'bell', tier: 2 },
  { word: 'boat', tier: 2 },
  { word: 'kite', tier: 2 },
  { word: 'sock', tier: 2 },
  { word: 'ring', tier: 2 },
  { word: 'gift', tier: 2 },
  { word: 'door', tier: 2 },
  { word: 'lamp', tier: 2 },
  { word: 'shoe', tier: 2 },
  { word: 'hand', tier: 2 },
  { word: 'nest', tier: 2 },
  { word: 'moth', tier: 2 },

  // ---- tier 3: five letters ---------------------------------------------
  { word: 'apple', tier: 3 },
  { word: 'train', tier: 3 },
  { word: 'house', tier: 3 },
  { word: 'horse', tier: 3 },
  { word: 'snake', tier: 3 },
  { word: 'mouse', tier: 3 },
  { word: 'sheep', tier: 3 },
  { word: 'whale', tier: 3 },
  { word: 'tiger', tier: 3 },
  { word: 'zebra', tier: 3 },
  { word: 'panda', tier: 3 },
  { word: 'koala', tier: 3 },
  { word: 'bread', tier: 3 },
  { word: 'pizza', tier: 3 },
  { word: 'grape', tier: 3 },
  { word: 'peach', tier: 3 },
  { word: 'lemon', tier: 3 },
  { word: 'melon', tier: 3 },
  { word: 'candy', tier: 3 },
  { word: 'donut', tier: 3 },
  { word: 'cloud', tier: 3 },
  { word: 'plane', tier: 3 },
  { word: 'truck', tier: 3 },
  { word: 'robot', tier: 3 },
  { word: 'crown', tier: 3 },
  { word: 'chair', tier: 3 },
  { word: 'clock', tier: 3 },
  { word: 'brush', tier: 3 },
  { word: 'heart', tier: 3 },
  { word: 'skunk', tier: 3 },
];

/**
 * "A is for apple": one toy per letter, chosen so the word starts with the
 * letter's everyday sound wherever English allows it.
 */
export const LETTER_TOY = {
  a: 'apple', b: 'bee', c: 'cat', d: 'dog', e: 'elephant', f: 'fish', g: 'goat', h: 'horse', i: 'igloo',
  j: 'jar', k: 'kite', l: 'lion', m: 'monkey', n: 'nest', o: 'octopus', p: 'pig', q: 'quilt', r: 'robot',
  s: 'sun', t: 'tiger', u: 'umbrella', v: 'van', w: 'wolf', x: 'xylophone', y: 'yoyo', z: 'zebra',
};

/** How to say a model's name out loud, where the name alone reads badly. */
const SPOKEN = { yoyo: 'yo-yo', hat: 'top hat' };
export const toyName = (name) => SPOKEN[name] || name.replace(/-/g, ' ');

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

/** Pictures that rhyme, by family. */
export const RHYMES = [
  ['cat', 'hat', 'bat'], ['dog', 'log', 'frog'], ['bee', 'key', 'tree'], ['car', 'jar', 'star'], ['hen', 'pen'],
  ['fox', 'box'], ['cap', 'map'], ['bear', 'pear', 'chair'], ['goat', 'boat'], ['rain', 'train', 'plane'],
  ['cake', 'snake'], ['rock', 'sock', 'clock'], ['house', 'mouse'], ['duck', 'truck'], ['moon', 'balloon'], ['bed', 'bread'],
];

/** Words a beginner can read by sounding out one letter at a time. */
export const DECODABLE = [
  'cat', 'dog', 'pig', 'fox', 'ant', 'bat', 'hen', 'sun', 'hat', 'cap', 'cup', 'bus', 'van', 'box', 'bed',
  'nut', 'log', 'pen', 'web', 'map', 'frog', 'crab', 'drum', 'nest', 'milk', 'lamp', 'hand', 'gift',
];

/** The little words that turn up on every page and are best known on sight. */
export const SIGHT_WORDS = [
  'the', 'and', 'see', 'can', 'go', 'is', 'it', 'in', 'up', 'we', 'you', 'look', 'play', 'run', 'big', 'red', 'my',
  'me', 'not', 'said', 'come', 'here', 'jump', 'make', 'help', 'find', 'down', 'away', 'blue', 'like', 'have', 'she', 'he', 'was',
];

/** Number words 0–20 for the arithmetic games' voice-over; larger numerals read fine as digits. */
export const NUMBER_WORDS = [
  'zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten',
  'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen',
  'eighteen', 'nineteen', 'twenty',
];

export const numberWord = (n) => NUMBER_WORDS[n] ?? String(n);

/** Cheerful, varied praise — hearing the same phrase every time gets old fast. */
export const PRAISE = [
  'Great job!', 'You did it!', 'Awesome!', 'Nice work!', 'Brilliant!', 'Way to go!', 'Fantastic!',
  'Super!', 'Amazing!', 'Perfect!', 'Hooray!', 'Wow!', 'Well done!', 'High five!',
];

/** Encouragement for a wrong answer — always forward-looking, never negative. */
export const ENCOURAGE = [
  'Try again!', 'Almost!', 'So close!', 'Have another go!', 'Keep going!',
];

/** Countable things for the arithmetic games: model name and plural. */
export const CRITTERS = [
  ['duck', 'ducks'], ['frog', 'frogs'], ['bunny', 'bunnies'], ['pig', 'pigs'], ['hen', 'hens'],
  ['sheep', 'sheep'], ['ladybug', 'ladybugs'], ['penguin', 'penguins'], ['turtle', 'turtles'],
  ['cat', 'cats'], ['dog', 'dogs'], ['bee', 'bees'], ['owl', 'owls'], ['mouse', 'mice'],
].map(([one, many]) => ({ one, many }));

export const plural = (kind, n) => (n === 1 ? kind.one : kind.many);
