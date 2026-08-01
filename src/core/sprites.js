/**
 * The 16-bit sprite atlas.
 *
 * All pictorial art lives in five pixel-art sheets (plus eight jigsaw scene
 * paintings) under assets/sprites/, drawn by Claude Design on a strict grid
 * against one master palette. This module loads the sheets, knows where every
 * named sprite sits, and blits them with nearest-neighbour scaling so the
 * pixels stay crisp at any size.
 *
 * Sprites are addressed by name ("fox", "icon-home", "balloon-pink"). For the
 * data files that still carry emoji characters, EMOJI_TO_SPRITE maps each
 * glyph to its sprite so `drawEmoji` keeps working unchanged — and falls back
 * to the real emoji glyph for anything unmapped or not yet loaded.
 */

const BASE = 'assets/sprites/';

/* ----------------------------------------------------------------- sheets */

// Sheet geometry mirrors assets/sprites/manifest.json (the design delivery).
// Uniform grids: sprites are [col, row]. game-bits is mixed: [x, y, w, h].

const SHEETS = {
  pip: {
    file: 'pip.png', cell: [96, 96],
    sprites: {
      'pip-happy': [0, 0], 'pip-cheer': [1, 0], 'pip-think': [2, 0],
      'pip-oops': [3, 0], 'pip-blink': [4, 0], 'pip-wave': [5, 0],
    },
  },
  icons: {
    file: 'icons.png', cell: [32, 32],
    sprites: {
      'icon-star': [0, 0], 'icon-star-empty': [1, 0], 'icon-home': [2, 0], 'icon-speaker': [3, 0], 'icon-again': [4, 0],
      'icon-next': [0, 1], 'icon-hint': [1, 1], 'icon-undo': [2, 1], 'icon-flame': [3, 1], 'icon-gift': [4, 1],
      'icon-gear': [0, 2], 'icon-rotate': [1, 2], 'icon-question': [2, 2], 'icon-party': [3, 2], 'icon-lock': [4, 2],
      'icon-numbers': [0, 3], 'icon-words': [1, 3], 'icon-puzzles': [2, 3], 'icon-controller': [3, 3], 'icon-close': [4, 3],
    },
  },
  shapes: {
    file: 'shapes.png', cell: [32, 32],
    sprites: (() => {
      const out = {};
      const shapes = ['circle', 'square', 'triangle', 'star', 'heart', 'diamond'];
      const colors = ['pink', 'gold', 'sky', 'mint', 'purple', 'orange'];
      shapes.forEach((s, row) => colors.forEach((c, col) => { out[`${s}-${c}`] = [col, row]; }));
      return out;
    })(),
  },
  'game-bits': {
    file: 'game-bits.png', mixed: true,
    sprites: {
      'balloon-pink': [0, 0, 64, 96], 'balloon-gold': [64, 0, 64, 96], 'balloon-sky': [128, 0, 64, 96],
      'balloon-mint': [192, 0, 64, 96], 'balloon-purple': [256, 0, 64, 96], 'balloon-orange': [320, 0, 64, 96],
      'balloon-red': [384, 0, 64, 96],
      'cookie-1': [0, 96, 64, 64], 'cookie-2': [64, 96, 64, 64], 'cookie-3': [128, 96, 64, 64],
      'cookie-dark': [192, 96, 64, 64],
      'gold-star-big': [256, 96, 64, 64], 'gold-star-empty': [320, 96, 64, 64],
      'card-back-tile': [384, 96, 32, 32],
      'confetti-rect': [384, 128, 16, 16], 'confetti-ribbon': [400, 128, 16, 16],
      'confetti-star': [384, 144, 16, 16], 'confetti-dot': [400, 144, 16, 16],
    },
  },
  pictures: {
    file: 'pictures.png', cell: [64, 64],
    sprites: {
      cat: [0, 0], dog: [1, 0], pig: [2, 0], cow: [3, 0], fox: [4, 0], bee: [5, 0], ant: [6, 0], owl: [7, 0], bat: [8, 0], hen: [9, 0], fish: [10, 0], frog: [11, 0],
      bear: [0, 1], lion: [1, 1], duck: [2, 1], bird: [3, 1], crab: [4, 1], goat: [5, 1], wolf: [6, 1], deer: [7, 1], moth: [8, 1], horse: [9, 1], snake: [10, 1], mouse: [11, 1],
      sheep: [0, 2], whale: [1, 2], tiger: [2, 2], zebra: [3, 2], panda: [4, 2], koala: [5, 2], skunk: [6, 2], butterfly: [7, 2], turtle: [8, 2], penguin: [9, 2], octopus: [10, 2], unicorn: [11, 2],
      dinosaur: [0, 3], ladybug: [1, 3], 'tropical-fish': [2, 3], seashell: [3, 3], nest: [4, 3], web: [5, 3], apple: [6, 3], egg: [7, 3], pie: [8, 3], nut: [9, 3], cake: [10, 3], milk: [11, 3],
      corn: [0, 4], pear: [1, 4], bread: [2, 4], pizza: [3, 4], grape: [4, 4], peach: [5, 4], lemon: [6, 4], melon: [7, 4], candy: [8, 4], donut: [9, 4], cookie: [10, 4], cupcake: [11, 4],
      watermelon: [0, 5], banana: [1, 5], strawberry: [2, 5], mushroom: [3, 5], pumpkin: [4, 5], cup: [5, 5], sun: [6, 5], star: [7, 5], 'sparkle-star': [8, 5], moon: [9, 5], tree: [10, 5], leaf: [11, 5],
      rain: [0, 6], cloud: [1, 6], fire: [2, 6], rock: [3, 6], rainbow: [4, 6], clover: [5, 6], sunflower: [6, 6], blossom: [7, 6], flower: [8, 6], tulip: [9, 6], cactus: [10, 6], mountain: [11, 6],
      'water-drop': [0, 7], wave: [1, 7], hat: [2, 7], cap: [3, 7], bus: [4, 7], car: [5, 7], van: [6, 7], box: [7, 7], key: [8, 7], bed: [9, 7], jar: [10, 7], log: [11, 7],
      pen: [0, 8], axe: [1, 8], map: [2, 8], gem: [3, 8], book: [4, 8], ball: [5, 8], drum: [6, 8], bell: [7, 8], boat: [8, 8], kite: [9, 8], sock: [10, 8], ring: [11, 8],
      gift: [0, 9], door: [1, 9], lamp: [2, 9], shoe: [3, 9], hand: [4, 9], train: [5, 9], house: [6, 9], plane: [7, 9], truck: [8, 9], robot: [9, 9], crown: [10, 9], chair: [11, 9],
      clock: [0, 10], brush: [1, 10], heart: [2, 10], balloon: [3, 10], rocket: [4, 10], palette: [5, 10], guitar: [6, 10], castle: [7, 10], 'roller-skate': [8, 10], carousel: [9, 10], 'puzzle-piece': [10, 10], 'crystal-ball': [11, 10],
      trophy: [0, 11], 'playing-cards': [1, 11], pencil: [2, 11], 'letter-blocks': [3, 11], flag: [4, 11], planet: [5, 11], comet: [6, 11], hibiscus: [7, 11], 'herb-sprig': [8, 11], 'honey-pot': [9, 11],
    },
  },
};

/** Jigsaw Garden scene paintings — 512×384, opaque. */
export const SCENES = ['fox', 'turtle', 'train', 'whale', 'butterfly', 'castle', 'rocket', 'bee'];

/* -------------------------------------------------------- emoji → sprite */

/**
 * Every emoji the app has ever used, mapped to its sprite. Data files can keep
 * their emoji fields; anything unmapped (or loaded before the sheets arrive)
 * falls back to the glyph. Keys are stored with the VS16 selector stripped.
 */
const EMOJI_TO_SPRITE = {
  // animals
  '🐱': 'cat', '🐶': 'dog', '🐷': 'pig', '🐮': 'cow', '🦊': 'fox', '🐝': 'bee', '🐜': 'ant',
  '🦉': 'owl', '🦇': 'bat', '🐔': 'hen', '🐟': 'fish', '🐸': 'frog', '🐻': 'bear', '🦁': 'lion',
  '🦆': 'duck', '🐦': 'bird', '🦀': 'crab', '🐐': 'goat', '🐺': 'wolf', '🦌': 'deer',
  '🦋': 'butterfly', '🐴': 'horse', '🐍': 'snake', '🐭': 'mouse', '🐑': 'sheep', '🐳': 'whale',
  '🐯': 'tiger', '🦓': 'zebra', '🐼': 'panda', '🐨': 'koala', '🦨': 'skunk', '🐢': 'turtle',
  '🐧': 'penguin', '🐙': 'octopus', '🦄': 'unicorn', '🦕': 'dinosaur', '🐞': 'ladybug',
  '🐠': 'tropical-fish', '🐚': 'seashell', '🪺': 'nest', '🕸': 'web',
  // food & treats
  '🍎': 'apple', '🥚': 'egg', '🥧': 'pie', '🥜': 'nut', '🍰': 'cake', '🥛': 'milk', '🌽': 'corn',
  '🍐': 'pear', '🍞': 'bread', '🍕': 'pizza', '🍇': 'grape', '🍑': 'peach', '🍋': 'lemon',
  '🍈': 'melon', '🍬': 'candy', '🍩': 'donut', '🍪': 'cookie', '🧁': 'cupcake', '🍉': 'watermelon',
  '🍌': 'banana', '🍓': 'strawberry', '🍄': 'mushroom', '🎃': 'pumpkin', '☕': 'cup', '🍯': 'honey-pot',
  // nature
  '☀': 'sun', '⭐': 'star', '🌟': 'sparkle-star', '✨': 'sparkle-star', '🌙': 'moon', '🌳': 'tree',
  '🍃': 'leaf', '🌧': 'rain', '☁': 'cloud', '🔥': 'fire', '🪨': 'rock', '🌈': 'rainbow',
  '🍀': 'clover', '🌻': 'sunflower', '🌸': 'blossom', '🌼': 'flower', '🌷': 'tulip', '🌵': 'cactus',
  '⛰': 'mountain', '💧': 'water-drop', '🌊': 'wave', '🌿': 'herb-sprig', '🌺': 'hibiscus',
  // objects & vehicles
  '🎩': 'hat', '🧢': 'cap', '🚌': 'bus', '🚗': 'car', '🚐': 'van', '📦': 'box', '🔑': 'key',
  '🛏': 'bed', '🫙': 'jar', '🪵': 'log', '🖊': 'pen', '🪓': 'axe', '🗺': 'map', '💎': 'gem',
  '📕': 'book', '⚽': 'ball', '🥁': 'drum', '🔔': 'bell', '⛵': 'boat', '🪁': 'kite', '🧦': 'sock',
  '💍': 'ring', '🎁': 'gift', '🚪': 'door', '💡': 'lamp', '👟': 'shoe', '✋': 'hand', '🚂': 'train',
  '🏠': 'house', '✈': 'plane', '🚚': 'truck', '🤖': 'robot', '👑': 'crown', '🪑': 'chair',
  '⏰': 'clock', '🖌': 'brush', '❤': 'heart', '🎈': 'balloon',
  // play & prizes
  '🚀': 'rocket', '🎨': 'palette', '🎸': 'guitar', '🏰': 'castle', '🛼': 'roller-skate',
  '🎠': 'carousel', '🧩': 'puzzle-piece', '🔮': 'crystal-ball', '🏆': 'trophy', '🃏': 'playing-cards',
  '✏': 'pencil', '🔤': 'letter-blocks', '🚩': 'flag', '🪐': 'planet', '☄': 'comet',
  // ui glyphs
  '🔊': 'icon-speaker', '🔈': 'icon-speaker', '🔁': 'icon-again', '➡': 'icon-next',
  '🔄': 'icon-rotate', '⚙': 'icon-gear', '🎉': 'icon-party', '❔': 'icon-question',
  '🎮': 'icon-controller', '🔢': 'icon-numbers', '🔷': 'diamond-sky',
};

/** Strip variation selectors so '⭐️' and '⭐' resolve identically. */
const normalize = (ch) => String(ch).replace(/[\uFE00-\uFE0F]/g, '');

/* ---------------------------------------------------------------- loading */

const images = new Map();   // file -> HTMLImageElement (once decoded)
const spriteIndex = new Map(); // name -> { file, x, y, w, h }

for (const sheet of Object.values(SHEETS)) {
  for (const [name, v] of Object.entries(sheet.sprites)) {
    const [a, b, c, d] = v;
    spriteIndex.set(name, sheet.mixed
      ? { file: sheet.file, x: a, y: b, w: c, h: d }
      : { file: sheet.file, x: a * sheet.cell[0], y: b * sheet.cell[1], w: sheet.cell[0], h: sheet.cell[1] });
  }
}

function loadImage(src) {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);   // missing art falls back to emoji
    img.src = src;
  });
}

let loadPromise = null;

/** Load all sprite sheets. Safe to call repeatedly; resolves even on failure. */
export function loadSprites() {
  if (loadPromise) return loadPromise;
  loadPromise = Promise.all(
    [...new Set(Object.values(SHEETS).map((s) => s.file))].map(async (file) => {
      const img = await loadImage(BASE + file);
      if (img) images.set(file, img);
    }),
  );
  return loadPromise;
}

const sceneCache = new Map();

/** Load one jigsaw scene painting; resolves to an Image or null. */
export function loadScene(name) {
  if (!sceneCache.has(name)) sceneCache.set(name, loadImage(`${BASE}scene-${name}.png`));
  return sceneCache.get(name);
}

/* ---------------------------------------------------------------- drawing */

/**
 * Resolve an emoji character or sprite name to a drawable atlas entry.
 * Returns null when the sprite is unknown or its sheet has not loaded.
 */
export function getSprite(key) {
  const name = spriteIndex.has(key) ? key : EMOJI_TO_SPRITE[normalize(key)];
  if (!name) return null;
  const s = spriteIndex.get(name);
  if (!s) return null;
  const img = images.get(s.file);
  return img ? { img, ...s } : null;
}

/** True when `key` (emoji or name) can be drawn from the atlas right now. */
export const hasSprite = (key) => !!getSprite(key);

/**
 * Canonical sprite name for an emoji character or name, or null if unknown.
 * Works before the sheets load — it needs only the index, not the pixels.
 */
export function spriteNameFor(key) {
  if (spriteIndex.has(key)) return key;
  return EMOJI_TO_SPRITE[normalize(key)] || null;
}

/**
 * Blit a sprite centred on (x, y), scaled so its height is `size` (width
 * follows the cell's aspect ratio). Nearest-neighbour — pixels stay chunky.
 */
export function drawSprite(ctx, key, x, y, size, { rotate = 0, alpha = 1, shadow = false } = {}) {
  const s = getSprite(key);
  if (!s) return false;
  const h = size;
  const w = size * (s.w / s.h);
  ctx.save();
  ctx.imageSmoothingEnabled = false;
  ctx.globalAlpha *= alpha;
  ctx.translate(x, y);
  if (rotate) ctx.rotate(rotate);
  if (shadow) {
    ctx.shadowColor = 'rgba(44,35,64,0.3)';
    ctx.shadowBlur = size * 0.16;
    ctx.shadowOffsetY = size * 0.08;
  }
  ctx.drawImage(s.img, s.x, s.y, s.w, s.h, -w / 2, -h / 2, w, h);
  ctx.restore();
  return true;
}

/* ------------------------------------------------------------- DOM helper */

/**
 * Inline style for showing a sprite in the DOM shell via CSS background.
 * `size` is the on-screen box in CSS px (square cells assumed).
 */
export function spriteStyle(key, size) {
  const name = spriteIndex.has(key) ? key : EMOJI_TO_SPRITE[normalize(key)];
  const s = name && spriteIndex.get(name);
  if (!s) return '';
  const k = size / s.w;
  const sheet = Object.values(SHEETS).find((sh) => sh.file === s.file);
  // Sheet pixel dims: derive from the furthest sprite in the index.
  let sw = 0; let sh2 = 0;
  for (const v of Object.values(sheet.sprites)) {
    const px = sheet.mixed ? v[0] + v[2] : (v[0] + 1) * sheet.cell[0];
    const py = sheet.mixed ? v[1] + v[3] : (v[1] + 1) * sheet.cell[1];
    if (px > sw) sw = px;
    if (py > sh2) sh2 = py;
  }
  return `width:${size}px;height:${size}px;background-image:url(${BASE}${s.file});`
    + `background-size:${sw * k}px ${sh2 * k}px;background-position:${-s.x * k}px ${-s.y * k}px;`
    + 'background-repeat:no-repeat;image-rendering:pixelated;';
}
