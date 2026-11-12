/**
 * The game registry.
 *
 * Each entry is metadata plus a lazy `load()` so a game's code only downloads
 * when it is actually opened. `levels` tells a grown-up what each level covers;
 * the first is always pitched at a three-year-old.
 */

export const GAMES = [
  /* ── Numbers ───────────────────────────────────────────────────────── */
  {
    id: 'counting-critters', title: 'Critter Count', subject: 'math', tint: '#ff8a4c',
    skill: 'Counting & number recognition to 20', levels: ['Up to 3', 'Up to 5', 'Up to 10', 'Up to 20'],
    load: () => import('./counting-critters.js'),
  },
  {
    id: 'balloon-math', title: 'Balloon Pop', subject: 'math', tint: '#ff6b8b',
    skill: 'Adding & subtracting to 20', levels: ['Colours & numbers', 'Adding', 'Taking away', 'Big numbers'],
    load: () => import('./balloon-math.js'),
  },
  {
    id: 'cookie-kitchen', title: 'Cookie Shop', subject: 'math', tint: '#e8913c',
    skill: 'Number bonds & ten frames', levels: ['Little orders', 'Fill the order', 'Make ten', 'Teen numbers'],
    load: () => import('./cookie-kitchen.js'),
  },
  {
    id: 'see-saw', title: 'See-Saw', subject: 'math', tint: '#ffb52e',
    skill: 'Comparing: bigger, more, fewer, equal', levels: ['Big & small', 'More & fewer', 'Bigger number', 'Balance it'],
    load: () => import('./see-saw.js'),
  },
  {
    id: 'frog-hop', title: 'Frog Hop', subject: 'math', tint: '#3dcc77',
    skill: 'Number order & skip counting', levels: ['1 to 5', '1 to 10', 'Missing numbers', 'Skip counting'],
    load: () => import('./frog-hop.js'),
  },

  /* ── Words ─────────────────────────────────────────────────────────── */
  {
    id: 'sound-safari', title: 'Sound Safari', subject: 'spelling', tint: '#2fb0ee',
    skill: 'Beginning sounds & phonics', levels: ['Find the animal', 'First sounds', 'Tricky letters', 'Last sounds'],
    load: () => import('./sound-safari.js'),
  },
  {
    id: 'word-builder', title: 'Word Train', subject: 'spelling', tint: '#5b8cff',
    skill: 'Spelling 3–5 letter words', levels: ['Match letters', '3 letters', '4 letters', '5 letters'],
    load: () => import('./word-builder.js'),
  },
  {
    id: 'letter-trace', title: 'Letter Racer', subject: 'spelling', tint: '#00b8a9',
    skill: 'Letter formation & stroke order', levels: ['Lines & loops', 'Big letters', 'Little letters', 'Numbers'],
    load: () => import('./letter-trace.js'),
  },
  {
    id: 'word-fishing', title: 'Word Fishing', subject: 'spelling', tint: '#2a8fe0',
    skill: 'Reading words, rhymes & sight words', levels: ['Catch a letter', 'Rhymes', 'Read a word', 'Sight words'],
    load: () => import('./word-fishing.js'),
  },
  {
    id: 'starry-abc', title: 'Starry ABC', subject: 'spelling', tint: '#7a5cf0',
    skill: 'Alphabet order', levels: ['A to E', 'Big letters', 'Little letters', 'What comes next'],
    load: () => import('./starry-abc.js'),
  },

  /* ── Puzzles ───────────────────────────────────────────────────────── */
  {
    id: 'memory-match', title: 'Magic Match', subject: 'puzzle', tint: '#9b6cff',
    skill: 'Memory & matching', levels: ['Tiny pairs', 'Animals', 'Numbers', 'Letters'],
    load: () => import('./memory-match.js'),
  },
  {
    id: 'pattern-party', title: 'Pattern Party', subject: 'puzzle', tint: '#f56fc0',
    skill: 'Patterns & logical thinking', levels: ['First beats', 'Easy beats', 'Longer beats', 'Growing beats'],
    load: () => import('./pattern-party.js'),
  },
  {
    id: 'jigsaw-garden', title: 'Jigsaw Garden', subject: 'puzzle', tint: '#2fc77f',
    skill: 'Spatial reasoning & problem solving', levels: ['Big pieces', 'Few pieces', 'More pieces', 'Lots of pieces'],
    load: () => import('./jigsaw-garden.js'),
  },
  {
    id: 'robot-road', title: 'Robot Road', subject: 'puzzle', tint: '#ff7a59',
    skill: 'Planning ahead & first coding', levels: ['Drive', 'Plan a path', 'Obstacles', 'Treasure hunt'],
    load: () => import('./robot-road.js'),
  },
  {
    id: 'sort-shop', title: 'Sort Shop', subject: 'puzzle', tint: '#f0a030',
    skill: 'Sorting & classifying', levels: ['Colours', 'Shapes', 'Kinds of thing', 'Two rules'],
    load: () => import('./sort-shop.js'),
  },
];

export const gameById = (id) => GAMES.find((g) => g.id === id) || null;

/** The island's terraces, top to bottom. */
export const SUBJECTS = ['math', 'spelling', 'puzzle'];
