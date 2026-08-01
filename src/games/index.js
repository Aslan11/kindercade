/**
 * The game registry.
 *
 * Each entry is metadata plus a lazy `load()` so the launcher stays instant and
 * a game's code only downloads when it is actually opened. `tint` is the card's
 * flat fill and `tint2` its dithered bottom band (same for the shelf
 * `color`/`color2` pair) — no gradients anywhere in the 16-bit shell.
 */

export const GAMES = [
  /* ── Numbers ───────────────────────────────────────────────────────── */
  {
    id: 'counting-critters',
    title: 'Counting Critters',
    subject: 'math',
    emoji: 'ladybug',
    blurb: 'Count the creatures, then tap the number.',
    skill: 'Counting & number recognition to 20',
    tint: '#ff8a4c',
    tint2: '#ffc93c',
    load: () => import('./counting-critters.js'),
  },
  {
    id: 'balloon-math',
    title: 'Balloon Pop',
    subject: 'math',
    emoji: 'balloon',
    blurb: 'Pop the balloon with the right answer.',
    skill: 'Adding & subtracting to 20',
    tint: '#ff6b8b',
    tint2: '#ff9f1c',
    load: () => import('./balloon-math.js'),
  },
  {
    id: 'cookie-kitchen',
    title: 'Cookie Kitchen',
    subject: 'math',
    emoji: 'cookie',
    blurb: 'Fill the tray to bake the right number.',
    skill: 'Number bonds & ten frames',
    tint: '#e8913c',
    tint2: '#ffd166',
    load: () => import('./cookie-kitchen.js'),
  },

  /* ── Words ─────────────────────────────────────────────────────────── */
  {
    id: 'sound-safari',
    title: 'Sound Safari',
    subject: 'spelling',
    emoji: 'lion',
    blurb: 'Which letter does it start with?',
    skill: 'Beginning sounds & phonics',
    tint: '#4cc9f0',
    tint2: '#61e3c8',
    load: () => import('./sound-safari.js'),
  },
  {
    id: 'word-builder',
    title: 'Word Builder',
    subject: 'spelling',
    emoji: 'letter-blocks',
    blurb: 'Drag the letters to spell the picture.',
    skill: 'Spelling 3–5 letter words',
    tint: '#5b8cff',
    tint2: '#8f7bff',
    load: () => import('./word-builder.js'),
  },
  {
    id: 'letter-trace',
    title: 'Letter Trace',
    subject: 'spelling',
    emoji: 'pencil',
    blurb: 'Trace the letter with your finger.',
    skill: 'Letter shapes & handwriting',
    tint: '#00b8a9',
    tint2: '#6fe3c4',
    load: () => import('./letter-trace.js'),
  },

  /* ── Puzzles ───────────────────────────────────────────────────────── */
  {
    id: 'memory-match',
    title: 'Memory Match',
    subject: 'puzzle',
    emoji: 'playing-cards',
    blurb: 'Find the matching pairs.',
    skill: 'Memory & matching',
    tint: '#9b6cff',
    tint2: '#c88cff',
    load: () => import('./memory-match.js'),
  },
  {
    id: 'pattern-party',
    title: 'Pattern Party',
    subject: 'puzzle',
    emoji: 'diamond-sky',
    blurb: 'What comes next in the pattern?',
    skill: 'Patterns & logical thinking',
    tint: '#ff8fd0',
    tint2: '#ffb3e0',
    load: () => import('./pattern-party.js'),
  },
  {
    id: 'jigsaw-garden',
    title: 'Jigsaw Garden',
    subject: 'puzzle',
    emoji: 'puzzle-piece',
    blurb: 'Slide the pieces to finish the picture.',
    skill: 'Spatial reasoning & problem solving',
    tint: '#3ddc97',
    tint2: '#8ce8b8',
    load: () => import('./jigsaw-garden.js'),
  },
];

export const gameById = (id) => GAMES.find((g) => g.id === id) || null;

export const SHELVES = [
  { subject: 'math', title: 'Numbers', emoji: 'icon-numbers', color: '#ff8a4c', color2: '#ffc93c' },
  { subject: 'spelling', title: 'Words', emoji: 'icon-words', color: '#4cc9f0', color2: '#7b8cff' },
  { subject: 'puzzle', title: 'Puzzles', emoji: 'icon-puzzles', color: '#9b6cff', color2: '#ff8fd0' },
];
