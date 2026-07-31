/**
 * The Kindercade art kit.
 *
 * Everything drawn in this arcade is generated at runtime: vector shapes with
 * real gradients, soft shadows and rim light, plus colour-emoji glyphs baked into
 * cached offscreen canvases. Nothing is downloaded, so art is always crisp on a
 * Retina iPad and the whole app stays a few hundred kilobytes.
 */

import { TAU, hashNoise, withAlpha, shade, clamp, lerp } from './util.js';

/* ------------------------------------------------------------------ typography */

/** Rounded system stack — resolves to SF Pro Rounded on iPadOS. */
export const FONT_ROUND = 'ui-rounded, "SF Pro Rounded", "Nunito", system-ui, -apple-system, "Segoe UI", sans-serif';
export const FONT_EMOJI = '"Apple Color Emoji", "Segoe UI Emoji", "Noto Color Emoji", sans-serif';

export const font = (size, weight = 800) => `${weight} ${size}px ${FONT_ROUND}`;

/* --------------------------------------------------------------------- palette */

export const Palette = {
  ink: '#2c2340',
  inkSoft: '#5b4f76',
  cream: '#fff8ee',
  white: '#ffffff',
  sun: '#ffc93c',
  sunDeep: '#ff9f1c',
  berry: '#ff6b8b',
  berryDeep: '#e14b6a',
  grape: '#8a6cff',
  grapeDeep: '#6b4de0',
  sky: '#4cc9f0',
  skyDeep: '#2a9dd6',
  mint: '#3ddc97',
  mintDeep: '#22b378',
  peach: '#ffa26b',
  bubble: '#ff8fd0',
  shadow: 'rgba(44, 35, 64, 0.22)',
};

/** Per-subject accent colours; the shell and games both read these. */
export const Subjects = {
  math: { name: 'Numbers', color: '#ff8a4c', color2: '#ffc93c', emoji: '🔢' },
  spelling: { name: 'Words', color: '#4cc9f0', color2: '#7b8cff', emoji: '🔤' },
  puzzle: { name: 'Puzzles', color: '#9b6cff', color2: '#ff8fd0', emoji: '🧩' },
};

/* ------------------------------------------------------------------ path shapes */

export function roundRect(ctx, x, y, w, h, r = 12) {
  const rr = Math.min(r, Math.abs(w) / 2, Math.abs(h) / 2);
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.arcTo(x + w, y, x + w, y + h, rr);
  ctx.arcTo(x + w, y + h, x, y + h, rr);
  ctx.arcTo(x, y + h, x, y, rr);
  ctx.arcTo(x, y, x + w, y, rr);
  ctx.closePath();
}

/** A soft organic blob — the backbone of most of the scenery. */
export function blobPath(ctx, cx, cy, radius, { points = 7, wobble = 0.14, seed = 1, phase = 0 } = {}) {
  ctx.beginPath();
  const pts = [];
  for (let i = 0; i < points; i++) {
    const a = (i / points) * TAU + phase;
    const r = radius * (1 + (hashNoise(seed * 131 + i) - 0.5) * 2 * wobble);
    pts.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r]);
  }
  ctx.moveTo((pts[0][0] + pts[points - 1][0]) / 2, (pts[0][1] + pts[points - 1][1]) / 2);
  for (let i = 0; i < points; i++) {
    const cur = pts[i];
    const next = pts[(i + 1) % points];
    ctx.quadraticCurveTo(cur[0], cur[1], (cur[0] + next[0]) / 2, (cur[1] + next[1]) / 2);
  }
  ctx.closePath();
}

export function starPath(ctx, cx, cy, outer, inner = outer * 0.46, points = 5, rot = -Math.PI / 2) {
  ctx.beginPath();
  for (let i = 0; i < points * 2; i++) {
    const r = i % 2 === 0 ? outer : inner;
    const a = rot + (i / (points * 2)) * TAU;
    const x = cx + Math.cos(a) * r;
    const y = cy + Math.sin(a) * r;
    i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
  }
  ctx.closePath();
}

export function heartPath(ctx, cx, cy, size) {
  const s = size / 16;
  ctx.beginPath();
  ctx.moveTo(cx, cy + 6 * s);
  ctx.bezierCurveTo(cx - 12 * s, cy - 3 * s, cx - 7 * s, cy - 12 * s, cx, cy - 5 * s);
  ctx.bezierCurveTo(cx + 7 * s, cy - 12 * s, cx + 12 * s, cy - 3 * s, cx, cy + 6 * s);
  ctx.closePath();
}

/** Four-point sparkle (the "twinkle" used in every reward burst). */
export function sparklePath(ctx, cx, cy, r, thin = 0.26) {
  ctx.beginPath();
  ctx.moveTo(cx, cy - r);
  ctx.quadraticCurveTo(cx + r * thin, cy - r * thin, cx + r, cy);
  ctx.quadraticCurveTo(cx + r * thin, cy + r * thin, cx, cy + r);
  ctx.quadraticCurveTo(cx - r * thin, cy + r * thin, cx - r, cy);
  ctx.quadraticCurveTo(cx - r * thin, cy - r * thin, cx, cy - r);
  ctx.closePath();
}

export function cloudPath(ctx, cx, cy, w, h) {
  const r = h / 2;
  ctx.beginPath();
  ctx.arc(cx - w / 2 + r, cy, r, Math.PI * 0.5, Math.PI * 1.5);
  ctx.arc(cx - w * 0.16, cy - r * 0.62, r * 0.92, Math.PI * 1.1, Math.PI * 1.85);
  ctx.arc(cx + w * 0.16, cy - r * 0.5, r * 0.8, Math.PI * 1.25, Math.PI * 1.95);
  ctx.arc(cx + w / 2 - r, cy, r, Math.PI * 1.5, Math.PI * 0.5);
  ctx.closePath();
}

/* ------------------------------------------------------------------- materials */

export function vGrad(ctx, y0, y1, stops) {
  const g = ctx.createLinearGradient(0, y0, 0, y1);
  stops.forEach(([t, c]) => g.addColorStop(t, c));
  return g;
}

export function radial(ctx, cx, cy, r0, r1, stops, ox = cx, oy = cy) {
  const g = ctx.createRadialGradient(ox, oy, r0, cx, cy, r1);
  stops.forEach(([t, c]) => g.addColorStop(t, c));
  return g;
}

/** Run `fn` with a drop shadow applied, then restore cleanly. */
export function withShadow(ctx, { blur = 18, color = Palette.shadow, dx = 0, dy = 8 } = {}, fn) {
  ctx.save();
  ctx.shadowBlur = blur;
  ctx.shadowColor = color;
  ctx.shadowOffsetX = dx;
  ctx.shadowOffsetY = dy;
  fn();
  ctx.restore();
}

/**
 * The signature Kindercade "candy" surface: vertical gradient body, darker base
 * lip for thickness, glossy highlight across the top. Used for every button,
 * card, tile and token so the whole arcade feels like one toybox.
 */
export function candyRect(ctx, x, y, w, h, r, color, {
  depth = 8, gloss = true, stroke = null, strokeWidth = 4, pressed = 0, glow = 0,
} = {}) {
  const oy = pressed * depth;
  ctx.save();
  if (glow > 0) {
    ctx.shadowBlur = 34 * glow;
    ctx.shadowColor = withAlpha(color, 0.85 * glow);
  }
  // base lip
  roundRect(ctx, x, y + depth - oy, w, h, r);
  ctx.fillStyle = shade(color, -0.34);
  ctx.fill();
  ctx.shadowBlur = 0;
  // body
  roundRect(ctx, x, y - oy, w, h, r);
  ctx.fillStyle = vGrad(ctx, y - oy, y + h - oy, [
    [0, shade(color, 0.24)], [0.5, color], [1, shade(color, -0.1)],
  ]);
  ctx.fill();
  if (stroke) {
    ctx.lineWidth = strokeWidth;
    ctx.strokeStyle = stroke;
    ctx.stroke();
  }
  if (gloss) {
    ctx.save();
    roundRect(ctx, x, y - oy, w, h, r);
    ctx.clip();
    roundRect(ctx, x + w * 0.06, y - oy + h * 0.08, w * 0.88, h * 0.34, r * 0.7);
    ctx.fillStyle = vGrad(ctx, y - oy + h * 0.08, y - oy + h * 0.42, [
      [0, 'rgba(255,255,255,0.5)'], [1, 'rgba(255,255,255,0.02)'],
    ]);
    ctx.fill();
    ctx.restore();
  }
  ctx.restore();
}

/** Same material, but round — for bubbles, balloons, tokens. */
export function candyCircle(ctx, cx, cy, r, color, { gloss = true, stroke = null, strokeWidth = 4, glow = 0 } = {}) {
  ctx.save();
  if (glow > 0) { ctx.shadowBlur = 30 * glow; ctx.shadowColor = withAlpha(color, 0.9 * glow); }
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, TAU);
  ctx.fillStyle = radial(ctx, cx, cy, r * 0.05, r * 1.05,
    [[0, shade(color, 0.4)], [0.55, color], [1, shade(color, -0.22)]],
    cx - r * 0.32, cy - r * 0.38);
  ctx.fill();
  ctx.shadowBlur = 0;
  if (stroke) { ctx.lineWidth = strokeWidth; ctx.strokeStyle = stroke; ctx.stroke(); }
  if (gloss) {
    ctx.beginPath();
    ctx.ellipse(cx - r * 0.3, cy - r * 0.42, r * 0.34, r * 0.22, -0.5, 0, TAU);
    ctx.fillStyle = 'rgba(255,255,255,0.55)';
    ctx.fill();
  }
  ctx.restore();
}

/* ----------------------------------------------------------------------- text */

/** Chunky outlined text — legible for a new reader at any distance. */
export function bubbleText(ctx, text, x, y, size, {
  fill = '#ffffff', stroke = Palette.ink, lineWidth = null, align = 'center', baseline = 'middle',
  weight = 900, shadow = true,
} = {}) {
  ctx.save();
  ctx.font = font(size, weight);
  ctx.textAlign = align;
  ctx.textBaseline = baseline;
  ctx.lineJoin = 'round';
  ctx.miterLimit = 2;
  if (shadow) {
    ctx.shadowColor = 'rgba(44,35,64,0.28)';
    ctx.shadowBlur = size * 0.18;
    ctx.shadowOffsetY = size * 0.07;
  }
  if (stroke) {
    ctx.lineWidth = lineWidth ?? Math.max(3, size * 0.17);
    ctx.strokeStyle = stroke;
    ctx.strokeText(text, x, y);
  }
  ctx.shadowBlur = 0;
  ctx.shadowOffsetY = 0;
  ctx.fillStyle = fill;
  ctx.fillText(text, x, y);
  ctx.restore();
}

/** Plain soft text for secondary labels. */
export function softText(ctx, text, x, y, size, { color = Palette.inkSoft, align = 'center', baseline = 'middle', weight = 700 } = {}) {
  ctx.save();
  ctx.font = font(size, weight);
  ctx.textAlign = align;
  ctx.textBaseline = baseline;
  ctx.fillStyle = color;
  ctx.fillText(text, x, y);
  ctx.restore();
}

/** Largest font size at which `text` fits inside `maxWidth`. */
export function fitFontSize(ctx, text, maxWidth, startSize, weight = 900) {
  let size = startSize;
  ctx.save();
  while (size > 8) {
    ctx.font = font(size, weight);
    if (ctx.measureText(text).width <= maxWidth) break;
    size -= 2;
  }
  ctx.restore();
  return size;
}

/* ------------------------------------------------------------- emoji sprites */

const emojiCache = new Map();

/**
 * Bake an emoji glyph into an offscreen canvas at device resolution.
 * Drawing the cached bitmap is far cheaper than `fillText` every frame, and it
 * keeps colour emoji perfectly sharp on a Retina display.
 */
export function emojiSprite(ch, size, dpr = window.devicePixelRatio || 1) {
  const px = Math.max(8, Math.round(size));
  const scale = Math.min(3, Math.max(1, dpr));
  const key = `${ch}|${px}|${scale}`;
  let cv = emojiCache.get(key);
  if (cv) return cv;

  cv = document.createElement('canvas');
  const pad = Math.ceil(px * 0.18);
  const box = px + pad * 2;
  cv.width = Math.ceil(box * scale);
  cv.height = Math.ceil(box * scale);
  const c = cv.getContext('2d');
  c.scale(scale, scale);
  c.font = `${px}px ${FONT_EMOJI}`;
  c.textAlign = 'center';
  c.textBaseline = 'middle';
  c.fillText(ch, box / 2, box / 2 + px * 0.04);
  cv.box = box;
  if (emojiCache.size > 400) emojiCache.clear();
  emojiCache.set(key, cv);
  return cv;
}

/** Draw an emoji centred on (x, y) at the given pixel size. */
export function drawEmoji(ctx, ch, x, y, size, { rotate = 0, alpha = 1, shadow = false } = {}) {
  const sp = emojiSprite(ch, size);
  ctx.save();
  ctx.globalAlpha *= alpha;
  ctx.translate(x, y);
  if (rotate) ctx.rotate(rotate);
  if (shadow) {
    ctx.shadowColor = 'rgba(44,35,64,0.3)';
    ctx.shadowBlur = size * 0.16;
    ctx.shadowOffsetY = size * 0.08;
  }
  ctx.drawImage(sp, -sp.box / 2, -sp.box / 2, sp.box, sp.box);
  ctx.restore();
}

/* ------------------------------------------------------------------ scenery */

/**
 * Full-bleed backdrop: sky gradient, sun glow, drifting clouds and layered hills.
 * Every game calls this first so the arcade reads as one world.
 */
export function drawBackdrop(ctx, w, h, t = 0, {
  top = '#bdefff', bottom = '#ffeccf', hills = ['#8fe3a6', '#63cf8b'],
  sun = true, clouds = 3, sunX = 0.82, sunY = 0.18,
} = {}) {
  ctx.save();
  ctx.fillStyle = vGrad(ctx, 0, h, [[0, top], [0.62, lerpHex(top, bottom, 0.55)], [1, bottom]]);
  ctx.fillRect(0, 0, w, h);

  if (sun) {
    const sx = w * sunX, sy = h * sunY;
    ctx.fillStyle = radial(ctx, sx, sy, 0, h * 0.42, [
      [0, 'rgba(255,240,180,0.85)'], [0.35, 'rgba(255,235,170,0.28)'], [1, 'rgba(255,235,170,0)'],
    ]);
    ctx.fillRect(0, 0, w, h);
    ctx.beginPath();
    ctx.arc(sx, sy, h * 0.062, 0, TAU);
    ctx.fillStyle = radial(ctx, sx, sy, 0, h * 0.062, [[0, '#fffbe8'], [1, '#ffd76a']]);
    ctx.fill();
  }

  for (let i = 0; i < clouds; i++) {
    const speed = 8 + i * 5;
    const cw = w * (0.16 + hashNoise(i * 7) * 0.14);
    const span = w + cw * 2;
    const cx = ((hashNoise(i * 13) * span + t * speed) % span) - cw;
    const cy = h * (0.1 + hashNoise(i * 29) * 0.28);
    ctx.globalAlpha = 0.75;
    cloudPath(ctx, cx, cy, cw, cw * 0.42);
    ctx.fillStyle = 'rgba(255,255,255,0.92)';
    ctx.fill();
    ctx.globalAlpha = 1;
  }

  // Layered rolling hills anchoring the bottom of the frame.
  hills.forEach((color, i) => {
    const baseY = h * (0.76 + i * 0.08);
    const amp = h * (0.07 - i * 0.015);
    ctx.beginPath();
    ctx.moveTo(0, h);
    ctx.lineTo(0, baseY);
    for (let x = 0; x <= w; x += w / 24) {
      const y = baseY + Math.sin(x / (w / 3.2) + i * 1.7) * amp;
      ctx.lineTo(x, y);
    }
    ctx.lineTo(w, h);
    ctx.closePath();
    ctx.fillStyle = vGrad(ctx, baseY - amp, h, [[0, shade(color, 0.12)], [1, shade(color, -0.16)]]);
    ctx.fill();
  });
  ctx.restore();
}

function lerpHex(a, b, t) {
  const pa = parseInt(a.slice(1), 16), pb = parseInt(b.slice(1), 16);
  const r = Math.round(lerp((pa >> 16) & 255, (pb >> 16) & 255, t));
  const g = Math.round(lerp((pa >> 8) & 255, (pb >> 8) & 255, t));
  const bl = Math.round(lerp(pa & 255, pb & 255, t));
  return `rgb(${r},${g},${bl})`;
}

/** Frosted panel used for HUDs and dialogs. */
export function glassPanel(ctx, x, y, w, h, r = 28, { alpha = 0.86, tint = '#ffffff' } = {}) {
  ctx.save();
  ctx.shadowColor = 'rgba(44,35,64,0.24)';
  ctx.shadowBlur = 30;
  ctx.shadowOffsetY = 10;
  roundRect(ctx, x, y, w, h, r);
  ctx.fillStyle = withAlpha(tint === '#ffffff' ? '#ffffff' : tint, alpha);
  ctx.fill();
  ctx.shadowBlur = 0;
  ctx.shadowOffsetY = 0;
  roundRect(ctx, x + 2, y + 2, w - 4, h - 4, r - 2);
  ctx.strokeStyle = 'rgba(255,255,255,0.9)';
  ctx.lineWidth = 3;
  ctx.stroke();
  ctx.restore();
}

/* -------------------------------------------------------------------- mascot */

/**
 * Pip — the little fox who hosts the arcade. Fully vector so it stays sharp,
 * animates, and can react (cheer / think / oops) without any sprite sheets.
 *
 * @param {object} o
 * @param {number} o.t      time in seconds (drives idle breathing + blinking)
 * @param {string} o.mood   'happy' | 'cheer' | 'think' | 'oops'
 * @param {number} o.look   -1..1 horizontal gaze
 */
export function drawPip(ctx, x, y, size, { t = 0, mood = 'happy', look = 0 } = {}) {
  const s = size / 100;
  const breathe = Math.sin(t * 2.1) * 0.02 + 1;
  const bounce = mood === 'cheer' ? Math.abs(Math.sin(t * 7)) * 10 * s : 0;
  // Blink on a slow irregular cycle so it feels alive, not metronomic.
  const blinkPhase = (t % 3.7) / 3.7;
  const blink = blinkPhase > 0.955 ? 1 : 0;

  ctx.save();
  ctx.translate(x, y - bounce);
  ctx.scale(s, s * breathe);

  // contact shadow
  ctx.save();
  ctx.scale(1, 0.3);
  ctx.beginPath();
  ctx.arc(0, 190, 62, 0, TAU);
  ctx.fillStyle = 'rgba(44,35,64,0.18)';
  ctx.fill();
  ctx.restore();

  const fur = '#ff9a52', furDark = '#f07a35', belly = '#fff3e2';

  // tail
  ctx.save();
  ctx.translate(-48, 22);
  ctx.rotate(Math.sin(t * 3) * 0.16 - 0.35);
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.quadraticCurveTo(-58, 6, -66, -52);
  ctx.quadraticCurveTo(-30, -30, 0, -26);
  ctx.closePath();
  ctx.fillStyle = furDark;
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(-52, -22);
  ctx.quadraticCurveTo(-70, -34, -66, -52);
  ctx.quadraticCurveTo(-48, -44, -40, -30);
  ctx.closePath();
  ctx.fillStyle = belly;
  ctx.fill();
  ctx.restore();

  // body
  ctx.beginPath();
  ctx.ellipse(0, 92, 54, 62, 0, 0, TAU);
  ctx.fillStyle = fur;
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(0, 104, 33, 42, 0, 0, TAU);
  ctx.fillStyle = belly;
  ctx.fill();

  // arms — raised when cheering
  const armA = mood === 'cheer' ? -2.5 + Math.sin(t * 7) * 0.15 : -0.5;
  [[-1, armA], [1, armA]].forEach(([side, ang]) => {
    ctx.save();
    ctx.translate(side * 46, 74);
    ctx.rotate(side * ang);
    ctx.beginPath();
    ctx.ellipse(0, 16, 13, 26, 0, 0, TAU);
    ctx.fillStyle = furDark;
    ctx.fill();
    ctx.restore();
  });

  // head
  ctx.beginPath();
  ctx.ellipse(0, 0, 66, 60, 0, 0, TAU);
  ctx.fillStyle = fur;
  ctx.fill();

  // ears
  [-1, 1].forEach((side) => {
    ctx.beginPath();
    ctx.moveTo(side * 30, -44);
    ctx.quadraticCurveTo(side * 62, -96, side * 66, -40);
    ctx.quadraticCurveTo(side * 50, -30, side * 30, -44);
    ctx.closePath();
    ctx.fillStyle = furDark;
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(side * 38, -46);
    ctx.quadraticCurveTo(side * 55, -78, side * 57, -45);
    ctx.closePath();
    ctx.fillStyle = '#ffd0b0';
    ctx.fill();
  });

  // muzzle
  ctx.beginPath();
  ctx.ellipse(0, 20, 40, 30, 0, 0, TAU);
  ctx.fillStyle = belly;
  ctx.fill();

  // eyes
  const ex = 24, ey = -6, gaze = clamp(look, -1, 1) * 5;
  [-1, 1].forEach((side) => {
    if (blink) {
      ctx.beginPath();
      ctx.lineWidth = 5;
      ctx.lineCap = 'round';
      ctx.strokeStyle = '#3a2b23';
      ctx.moveTo(side * ex - 9, ey);
      ctx.quadraticCurveTo(side * ex, ey + 6, side * ex + 9, ey);
      ctx.stroke();
      return;
    }
    ctx.beginPath();
    ctx.ellipse(side * ex, ey, 11, mood === 'think' ? 9 : 12, 0, 0, TAU);
    ctx.fillStyle = '#3a2b23';
    ctx.fill();
    ctx.beginPath();
    ctx.arc(side * ex + 4 + gaze, ey - 4, 4, 0, TAU);
    ctx.fillStyle = 'rgba(255,255,255,0.95)';
    ctx.fill();
  });

  // cheeks
  [-1, 1].forEach((side) => {
    ctx.beginPath();
    ctx.ellipse(side * 44, 14, 12, 8, 0, 0, TAU);
    ctx.fillStyle = 'rgba(255,120,140,0.4)';
    ctx.fill();
  });

  // nose + mouth
  ctx.beginPath();
  ctx.ellipse(0, 12, 9, 7, 0, 0, TAU);
  ctx.fillStyle = '#3a2b23';
  ctx.fill();
  ctx.beginPath();
  ctx.lineWidth = 4;
  ctx.lineCap = 'round';
  ctx.strokeStyle = '#3a2b23';
  if (mood === 'oops') {
    ctx.moveTo(-11, 36);
    ctx.quadraticCurveTo(0, 27, 11, 36);
  } else if (mood === 'cheer') {
    ctx.moveTo(-14, 26);
    ctx.quadraticCurveTo(0, 46, 14, 26);
  } else {
    ctx.moveTo(-12, 26);
    ctx.quadraticCurveTo(0, 38, 12, 26);
  }
  ctx.stroke();

  ctx.restore();
}

/* ---------------------------------------------------------------- indicators */

/** Progress pips — a row of dots that fill in as the round advances. */
export function progressPips(ctx, x, y, total, done, { r = 11, gap = 30, color = '#ffc93c' } = {}) {
  const startX = x - ((total - 1) * gap) / 2;
  for (let i = 0; i < total; i++) {
    const px = startX + i * gap;
    ctx.beginPath();
    ctx.arc(px, y, r, 0, TAU);
    ctx.fillStyle = i < done ? color : 'rgba(255,255,255,0.55)';
    ctx.fill();
    ctx.lineWidth = 3;
    ctx.strokeStyle = i < done ? shade(color, -0.25) : 'rgba(255,255,255,0.85)';
    ctx.stroke();
    if (i < done) {
      starPath(ctx, px, y, r * 0.55, r * 0.26, 5);
      ctx.fillStyle = 'rgba(255,255,255,0.85)';
      ctx.fill();
    }
  }
}

/** A gold star with a soft glow — the universal "you did it" token. */
export function goldStar(ctx, cx, cy, r, { glow = 1, rot = 0, filled = true } = {}) {
  ctx.save();
  if (glow > 0) {
    ctx.shadowColor = `rgba(255,201,60,${0.9 * glow})`;
    ctx.shadowBlur = r * 1.1 * glow;
  }
  starPath(ctx, cx, cy, r, r * 0.45, 5, -Math.PI / 2 + rot);
  ctx.fillStyle = filled
    ? radial(ctx, cx, cy, 0, r, [[0, '#fff3b0'], [0.6, '#ffc93c'], [1, '#ff9f1c']])
    : 'rgba(255,255,255,0.35)';
  ctx.fill();
  ctx.shadowBlur = 0;
  ctx.lineWidth = Math.max(2, r * 0.11);
  ctx.strokeStyle = filled ? '#e2820f' : 'rgba(255,255,255,0.75)';
  ctx.stroke();
  ctx.restore();
}
