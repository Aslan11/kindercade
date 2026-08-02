/**
 * The Kindercade art kit.
 *
 * Structural art (buttons, panels, backdrops, text) is generated at runtime as
 * authentic 16-bit pixel art: everything sits on a fat-pixel grid (one texel =
 * PX logical units), fills are flat with one highlight and one shadow, corners
 * are chamfered in pixel steps and every shape wears a hard 1-texel outline.
 * Pictorial art (creatures, objects, icons, Pip) comes from the 16-bit sprite
 * atlas in assets/sprites/ — see sprites.js. Emoji glyphs remain only as a
 * fallback for anything the atlas cannot draw yet.
 *
 * The one deliberate exception is text: a five-year-old learning letters needs
 * true letterforms, so the rounded font stays — but its shadows are hard
 * offsets, never blurs.
 */

import { TAU, hashNoise, withAlpha, shade, clamp, lerp } from './util.js';
import { drawSprite, getSprite } from './sprites.js';

/* ------------------------------------------------------------ fat-pixel grid */

/** One texel in logical units. Every hand-drawn size/position is a multiple. */
export const PX = 4;

/** Snap a logical coordinate or length onto the texel grid. */
export const px = (v) => Math.round(v / PX) * PX;

/** Quantize an alpha to eighths — the steppy 16-bit fade. */
export const stepAlpha = (a) => Math.round(clamp(a, 0, 1) * 8) / 8;

/** Quantize an angle to TAU/24 steps so decorative spins never smear texels. */
export const snapAngle = (a) => Math.round(a / (TAU / 24)) * (TAU / 24);

/** Chamfer size (0, PX or 2·PX) that stands in for an old corner radius. */
function chamferFor(r, w, h) {
  const c = r < 3 ? 0 : r < 16 ? PX : PX * 2;
  return Math.min(c, px(Math.min(Math.abs(w), Math.abs(h)) / 2 - PX / 2));
}

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

/** Hard offset drop-shadow colour — flat, never blurred. */
export const HARD_SHADOW = 'rgba(44,35,64,0.18)';

/** Per-subject accent colours; the shell and games both read these. */
export const Subjects = {
  math: { name: 'Numbers', color: '#ff8a4c', color2: '#ffc93c', emoji: 'icon-numbers' },
  spelling: { name: 'Words', color: '#4cc9f0', color2: '#7b8cff', emoji: 'icon-words' },
  puzzle: { name: 'Puzzles', color: '#9b6cff', color2: '#ff8fd0', emoji: 'icon-puzzles' },
};

/* ------------------------------------------------------------------ path shapes */

/**
 * Pixel-rect path. The name and signature survive from the arc-rounded era but
 * the corners are now chamfered with 1–2 texel steps (SNES bezel style) — `r`
 * only picks how big the chamfer is. Works with fill, stroke and clip alike.
 */
export function roundRect(ctx, x, y, w, h, r = 12) {
  const c = chamferFor(r, w, h);
  x = px(x); y = px(y);
  w = Math.max(PX, px(w)); h = Math.max(PX, px(h));
  ctx.beginPath();
  if (c <= 0) { ctx.rect(x, y, w, h); return; }
  const n = c / PX;
  ctx.moveTo(x + c, y);
  ctx.lineTo(x + w - c, y);
  for (let k = 1; k <= n; k++) {           // top-right staircase
    ctx.lineTo(x + w - c + (k - 1) * PX, y + k * PX);
    ctx.lineTo(x + w - c + k * PX, y + k * PX);
  }
  ctx.lineTo(x + w, y + h - c);
  for (let k = 1; k <= n; k++) {           // bottom-right staircase
    ctx.lineTo(x + w - k * PX, y + h - c + (k - 1) * PX);
    ctx.lineTo(x + w - k * PX, y + h - c + k * PX);
  }
  ctx.lineTo(x + c, y + h);
  for (let k = 1; k <= n; k++) {           // bottom-left staircase
    ctx.lineTo(x + c - (k - 1) * PX, y + h - k * PX);
    ctx.lineTo(x + c - k * PX, y + h - k * PX);
  }
  ctx.lineTo(x, y + c);
  for (let k = 1; k <= n; k++) {           // top-left staircase
    ctx.lineTo(x + k * PX, y + c - (k - 1) * PX);
    ctx.lineTo(x + k * PX, y + c - k * PX);
  }
  ctx.closePath();
}

/** Evaluate a quadratic bezier — geometry only, never painted directly. */
function quadAt(p0, c, p1, t) {
  const u = 1 - t;
  return [
    u * u * p0[0] + 2 * u * t * c[0] + t * t * p1[0],
    u * u * p0[1] + 2 * u * t * c[1] + t * t * p1[1],
  ];
}

/** Push a grid-snapped point, skipping consecutive duplicates. */
function pushSnapped(pts, x, y) {
  const qx = px(x), qy = px(y);
  const last = pts[pts.length - 1];
  if (!last || last[0] !== qx || last[1] !== qy) pts.push([qx, qy]);
}

function polyPath(ctx, pts) {
  ctx.beginPath();
  pts.forEach(([x, y], i) => (i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y)));
  ctx.closePath();
}

/**
 * A chunky organic blob — the backbone of most of the scenery. The old smooth
 * quadratic outline is sampled and snapped to the texel grid, so the fill
 * comes out stepped like hand-placed pixels.
 */
export function blobPath(ctx, cx, cy, radius, { points = 7, wobble = 0.14, seed = 1, phase = 0 } = {}) {
  const anchor = [];
  for (let i = 0; i < points; i++) {
    const a = (i / points) * TAU + phase;
    const r = radius * (1 + (hashNoise(seed * 131 + i) - 0.5) * 2 * wobble);
    anchor.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r]);
  }
  const pts = [];
  for (let i = 0; i < points; i++) {
    const cur = anchor[i];
    const next = anchor[(i + 1) % points];
    const p0 = [(anchor[(i + points - 1) % points][0] + cur[0]) / 2, (anchor[(i + points - 1) % points][1] + cur[1]) / 2];
    const p1 = [(cur[0] + next[0]) / 2, (cur[1] + next[1]) / 2];
    for (let s = 0; s < 4; s++) {
      const [sx, sy] = quadAt(p0, cur, p1, s / 4);
      pushSnapped(pts, sx, sy);
    }
  }
  polyPath(ctx, pts);
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

/** Pixel heart: the old bezier lobes sampled and snapped to the texel grid. */
export function heartPath(ctx, cx, cy, size) {
  const s = size / 16;
  const cubic = (p0, c1, c2, p1, t) => {
    const u = 1 - t;
    return [
      u * u * u * p0[0] + 3 * u * u * t * c1[0] + 3 * u * t * t * c2[0] + t * t * t * p1[0],
      u * u * u * p0[1] + 3 * u * u * t * c1[1] + 3 * u * t * t * c2[1] + t * t * t * p1[1],
    ];
  };
  const bottom = [cx, cy + 6 * s], top = [cx, cy - 5 * s];
  const pts = [];
  for (let i = 0; i <= 14; i++) {
    const [x, y] = cubic(bottom, [cx - 12 * s, cy - 3 * s], [cx - 7 * s, cy - 12 * s], top, i / 14);
    pushSnapped(pts, x, y);
  }
  for (let i = 0; i <= 14; i++) {
    const [x, y] = cubic(top, [cx + 7 * s, cy - 12 * s], [cx + 12 * s, cy - 3 * s], bottom, i / 14);
    pushSnapped(pts, x, y);
  }
  polyPath(ctx, pts);
}

/**
 * Four-point sparkle (the "twinkle" used in every reward burst) — now a
 * grid-snapped pixel diamond with a thin waist. Prefer the atlas sprite
 * ("sparkle-star") when one is loaded; this path is the fallback shape.
 */
export function sparklePath(ctx, cx, cy, r, thin = 0.26) {
  const tips = [[cx, cy - r], [cx + r, cy], [cx, cy + r], [cx - r, cy]];
  const waists = [
    [cx + r * thin, cy - r * thin], [cx + r * thin, cy + r * thin],
    [cx - r * thin, cy + r * thin], [cx - r * thin, cy - r * thin],
  ];
  const pts = [];
  for (let i = 0; i < 4; i++) {
    for (let s = 0; s < 3; s++) {
      const [sx, sy] = quadAt(tips[i], waists[i], tips[(i + 1) % 4], s / 3);
      pushSnapped(pts, sx, sy);
    }
  }
  if (pts.length < 3) { // tiny sparkle collapses to a single texel plus
    ctx.beginPath();
    ctx.rect(px(cx) - PX / 2, px(cy) - PX / 2, PX, PX);
    return;
  }
  polyPath(ctx, pts);
}

/**
 * Blocky cloud: the old arc lobes become stacked horizontal texel runs, traced
 * as one stepped rectilinear outline so both fill and stroke stay crisp.
 */
export function cloudPath(ctx, cx, cy, w, h) {
  const r = h / 2;
  const lobes = [
    [cx - w / 2 + r, cy, r],
    [cx - w * 0.16, cy - r * 0.62, r * 0.92],
    [cx + w * 0.16, cy - r * 0.5, r * 0.8],
    [cx + w / 2 - r, cy, r],
  ];
  const top = px(Math.min(...lobes.map(([, ly, lr]) => ly - lr)));
  const bottom = px(cy + r);
  const rows = [];
  for (let y = top; y < bottom; y += PX) {
    const ym = y + PX / 2;
    let l = Infinity, rt = -Infinity;
    for (const [lx, ly, lr] of lobes) {
      const dy = ym - ly;
      if (Math.abs(dy) >= lr) continue;
      const dx = Math.sqrt(lr * lr - dy * dy);
      l = Math.min(l, lx - dx);
      rt = Math.max(rt, lx + dx);
    }
    if (l === Infinity) continue;
    rows.push([y, px(l), px(rt)]);
  }
  scanlinePath(ctx, rows);
}

/**
 * Trace [y, left, right] texel rows (y ascending by PX) as one closed stepped
 * outline. The workhorse behind clouds and any other scanline-built shape.
 */
export function scanlinePath(ctx, rows) {
  ctx.beginPath();
  if (!rows.length) return;
  ctx.moveTo(rows[0][1], rows[0][0]);
  for (const [y, , r] of rows) { ctx.lineTo(r, y); ctx.lineTo(r, y + PX); }
  for (let i = rows.length - 1; i >= 0; i--) {
    const [y, l] = rows[i];
    ctx.lineTo(l, y + PX);
    ctx.lineTo(l, y);
  }
  ctx.closePath();
}

/* ------------------------------------------------------------------- materials */

/**
 * Gradient helpers, kept only so old call sites keep working while they are
 * migrated. Nothing in core paints with these any more — visible art uses flat
 * fills with dither bands (see ditherBand) instead.
 */
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

/**
 * Run `fn` with a hard offset drop shadow applied, then restore cleanly.
 * `blur` is accepted for old call sites but ignored — the shadow is always a
 * flat silhouette pushed a couple of texels down.
 */
export function withShadow(ctx, { blur = 0, color = HARD_SHADOW, dx = 0, dy = 8 } = {}, fn) {
  void blur;
  ctx.save();
  ctx.shadowBlur = 0;
  ctx.shadowColor = color;
  ctx.shadowOffsetX = px(dx);
  ctx.shadowOffsetY = Math.max(PX, px(dy));
  fn();
  ctx.restore();
}

/* ------------------------------------------------------------ pixel primitives */

/**
 * The bread-and-butter pixel surface: flat body, hard 1-texel outline,
 * chamfered corners, a 1-texel highlight band along the inside top edge and a
 * darker band along the inside bottom. Use this instead of ad-hoc roundRect
 * fills whenever a game draws its own panel, tray, track or chip.
 */
export function pixelRect(ctx, x, y, w, h, {
  fill = Palette.white, outline = null, chamfer = PX * 2,
  highlight = null, lowlight = null, shadow = false,
} = {}) {
  x = px(x); y = px(y);
  w = Math.max(PX * 2, px(w)); h = Math.max(PX * 2, px(h));
  const c = Math.min(px(chamfer), px(Math.min(w, h) / 2 - PX / 2));
  if (shadow) {
    roundRect(ctx, x, y + PX * 2, w, h, c);
    ctx.fillStyle = HARD_SHADOW;
    ctx.fill();
  }
  if (outline) {
    roundRect(ctx, x, y, w, h, c);
    ctx.fillStyle = outline;
    ctx.fill();
    roundRect(ctx, x + PX, y + PX, w - PX * 2, h - PX * 2, Math.max(0, c - PX));
    ctx.fillStyle = fill;
    ctx.fill();
  } else {
    roundRect(ctx, x, y, w, h, c);
    ctx.fillStyle = fill;
    ctx.fill();
  }
  const inset = outline ? PX : 0;
  if (highlight) {
    ctx.fillStyle = highlight;
    ctx.fillRect(x + c + inset, y + inset, w - (c + inset) * 2, PX);
  }
  if (lowlight) {
    ctx.fillStyle = lowlight;
    ctx.fillRect(x + c + inset, y + h - inset - PX * 2, w - (c + inset) * 2, PX * 2);
  }
}

/** Compute [yOffset, halfWidth] texel rows for a disc of radius R. */
function discRows(R) {
  const rows = [];
  for (let y = -R; y < R; y += PX) {
    const ym = y + PX / 2;
    const hw = Math.round(Math.sqrt(Math.max(0, R * R - ym * ym)) / PX) * PX;
    if (hw > 0) rows.push([y, hw]);
  }
  return rows;
}

/**
 * Pixel disc built from horizontal texel runs — the circle of this art style.
 * Optional 1-texel outline, a lit band inside the top rim and a shaded band
 * inside the bottom rim.
 */
export function pixelCircle(ctx, cx, cy, r, {
  fill = Palette.white, outline = null, highlight = null, lowlight = null,
} = {}) {
  const X = px(cx), Y = px(cy);
  const R = Math.max(PX, px(r));
  if (outline) {
    ctx.fillStyle = outline;
    for (const [y, hw] of discRows(R)) ctx.fillRect(X - hw, Y + y, hw * 2, PX);
  }
  const Rb = outline ? Math.max(PX, R - PX) : R;
  const body = discRows(Rb);
  ctx.fillStyle = fill;
  for (const [y, hw] of body) ctx.fillRect(X - hw, Y + y, hw * 2, PX);
  if (highlight && body.length > 2) {
    ctx.fillStyle = highlight;
    const n = Math.max(1, Math.floor(body.length * 0.28));
    for (let i = 0; i < n; i++) {
      const [y, hw] = body[i];
      if (i === 0) ctx.fillRect(X - hw, Y + y, hw * 2, PX);        // lit top cap
      else ctx.fillRect(X - hw, Y + y, PX, PX);                    // left rim texel
    }
  }
  if (lowlight && body.length > 2) {
    ctx.fillStyle = lowlight;
    const n = Math.max(1, Math.floor(body.length * 0.2));
    for (let i = body.length - n; i < body.length; i++) {
      const [y, hw] = body[i];
      if (i === body.length - 1) ctx.fillRect(X - hw, Y + y, hw * 2, PX); // shaded base
      else ctx.fillRect(X + hw - PX, Y + y, PX, PX);               // right rim texel
    }
  }
}

/**
 * Pixel-circle outline ring — pop shockwaves, hint glows, focus rings.
 * `thickness` snaps to a texel multiple.
 */
export function pixelRing(ctx, cx, cy, r, thickness = PX, color = Palette.white) {
  const X = px(cx), Y = px(cy);
  const R = Math.max(PX, px(r));
  const T = Math.max(PX, px(thickness));
  const Ri = R - T;
  ctx.fillStyle = color;
  for (const [y, hw] of discRows(R)) {
    const ym = y + PX / 2;
    const ihw = Ri > 0 ? Math.round(Math.sqrt(Math.max(0, Ri * Ri - ym * ym)) / PX) * PX : 0;
    if (ihw <= 0) { ctx.fillRect(X - hw, Y + y, hw * 2, PX); continue; }
    ctx.fillRect(X - hw, Y + y, hw - ihw, PX);
    ctx.fillRect(X + ihw, Y + y, hw - ihw, PX);
  }
}

/**
 * Stepped pixel line: a chain of texel squares stamped along the segment.
 * `width` snaps to a texel multiple. Use for balloon strings, crayon guides,
 * cross-out slashes — anywhere a smooth stroke used to be.
 */
export function pixelLine(ctx, x1, y1, x2, y2, { color = Palette.ink, width = PX } = {}) {
  const wq = Math.max(PX, px(width));
  const half = wq / 2;
  const steps = Math.max(1, Math.ceil(Math.hypot(x2 - x1, y2 - y1) / PX));
  ctx.fillStyle = color;
  let lastX = null, lastY = null;
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const sx = px(lerp(x1, x2, t) - half);
    const sy = px(lerp(y1, y2, t) - half);
    if (sx === lastX && sy === lastY) continue;
    ctx.fillRect(sx, sy, wq, wq);
    lastX = sx; lastY = sy;
  }
}

/** Stepped polyline: pixelLine chained through `points` ([x,y] pairs). */
export function pixelPolyline(ctx, points, { color = Palette.ink, width = PX } = {}) {
  for (let i = 1; i < points.length; i++) {
    pixelLine(ctx, points[i - 1][0], points[i - 1][1], points[i][0], points[i][1], { color, width });
  }
}

/**
 * Checkerboard dither band — the signature 16-bit blend between two flats.
 * Fills [x, y, w, h] with `colorA` and stamps `colorB` on alternating texels.
 */
export function ditherBand(ctx, x, y, w, h, colorA, colorB, cell = PX) {
  x = px(x); y = px(y); w = px(w); h = px(h);
  ctx.fillStyle = colorA;
  ctx.fillRect(x, y, w, h);
  ctx.fillStyle = colorB;
  const cols = Math.ceil(w / cell), rowsN = Math.ceil(h / cell);
  for (let j = 0; j < rowsN; j++) {
    for (let i = (j % 2); i < cols; i += 2) {
      ctx.fillRect(x + i * cell, y + j * cell, Math.min(cell, w - i * cell), Math.min(cell, h - j * cell));
    }
  }
}

/* -------------------------------------------------------------- candy surfaces */

/**
 * The signature Kindercade button/card surface, in 16-bit trim: flat body with
 * a hard dark outline, a 1-texel highlight band along the inside top, a darker
 * inside-bottom band and a flat base lip for thickness. `stroke` (the old white
 * rim) now draws as a 1-texel inner rim inside the outline. Glow is a hard
 * bright silhouette ring, never a blur.
 */
export function candyRect(ctx, x, y, w, h, r, color, {
  depth = 8, gloss = true, stroke = null, strokeWidth = 4, pressed = 0, glow = 0,
} = {}) {
  void strokeWidth;
  x = px(x); y = px(y); w = Math.max(PX * 2, px(w)); h = Math.max(PX * 2, px(h));
  const d = Math.max(PX, px(depth));
  const oy = px(pressed * d);
  const c = chamferFor(r, w, h);
  ctx.save();
  if (glow > 0.1) {
    roundRect(ctx, x - PX * 2, y - oy - PX * 2, w + PX * 4, h + PX * 4, c);
    ctx.fillStyle = withAlpha(shade(color, 0.45), stepAlpha(0.8 * glow));
    ctx.fill();
  }
  // base lip — the flat dark edge that gives the button thickness
  roundRect(ctx, x, y + d - oy, w, h, c);
  ctx.fillStyle = shade(color, -0.34);
  ctx.fill();
  // outline + body
  roundRect(ctx, x, y - oy, w, h, c);
  ctx.fillStyle = shade(color, -0.5);
  ctx.fill();
  roundRect(ctx, x + PX, y - oy + PX, w - PX * 2, h - PX * 2, Math.max(0, c - PX));
  ctx.fillStyle = color;
  ctx.fill();
  // optional bright inner rim (the old white stroke, one texel thick)
  if (stroke) {
    roundRect(ctx, x + PX, y - oy + PX, w - PX * 2, h - PX * 2, Math.max(0, c - PX));
    ctx.fillStyle = stroke;
    ctx.fill();
    roundRect(ctx, x + PX * 2, y - oy + PX * 2, w - PX * 4, h - PX * 4, Math.max(0, c - PX * 2));
    ctx.fillStyle = color;
    ctx.fill();
  }
  const inset = stroke ? PX * 2 : PX;
  if (gloss) {
    // single light band along the inside top — the pixel-art gloss
    ctx.fillStyle = shade(color, 0.26);
    ctx.fillRect(x + c + inset, y - oy + inset, w - (c + inset) * 2, PX);
  }
  // shaded band along the inside bottom
  ctx.fillStyle = shade(color, -0.16);
  ctx.fillRect(x + c + inset, y - oy + h - inset - PX, w - (c + inset) * 2, PX);
  ctx.restore();
}

/**
 * Same material, but round — bubbles, balloons, tokens. A texel-run disc with
 * a dark outline, lit top rim, shaded base and a small hard gloss patch.
 */
export function candyCircle(ctx, cx, cy, r, color, { gloss = true, stroke = null, strokeWidth = 4, glow = 0 } = {}) {
  void strokeWidth;
  const X = px(cx), Y = px(cy);
  const R = Math.max(PX * 2, px(r));
  ctx.save();
  if (glow > 0.1) {
    ctx.globalAlpha *= stepAlpha(0.8 * glow);
    pixelRing(ctx, X, Y, R + PX * 2, PX * 2, shade(color, 0.45));
    ctx.globalAlpha = 1;
  }
  pixelCircle(ctx, X, Y, R, {
    fill: color,
    outline: shade(color, -0.5),
    highlight: shade(color, 0.24),
    lowlight: shade(color, -0.2),
  });
  if (stroke) pixelRing(ctx, X, Y, R - PX, PX, stroke);
  if (gloss && R >= PX * 4) {
    // hard two-run gloss patch, upper left — replaces the old ellipse blob
    ctx.fillStyle = 'rgba(255,255,255,0.7)';
    ctx.fillRect(X - px(R * 0.5), Y - px(R * 0.55), px(R * 0.4), PX);
    ctx.fillRect(X - px(R * 0.6), Y - px(R * 0.55) + PX, px(R * 0.28), PX);
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
    // Hard offset shadow — a second stroke pass pushed down a couple of texels.
    ctx.shadowColor = 'rgba(44,35,64,0.28)';
    ctx.shadowBlur = 0;
    ctx.shadowOffsetY = Math.max(PX / 2, px(size * 0.07));
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
  const glyphPx = Math.max(8, Math.round(size));
  const scale = Math.min(3, Math.max(1, dpr));
  const key = `${ch}|${glyphPx}|${scale}`;
  let cv = emojiCache.get(key);
  if (cv) return cv;

  cv = document.createElement('canvas');
  const pad = Math.ceil(glyphPx * 0.18);
  const box = glyphPx + pad * 2;
  cv.width = Math.ceil(box * scale);
  cv.height = Math.ceil(box * scale);
  const c = cv.getContext('2d');
  c.scale(scale, scale);
  c.font = `${glyphPx}px ${FONT_EMOJI}`;
  c.textAlign = 'center';
  c.textBaseline = 'middle';
  c.fillText(ch, box / 2, box / 2 + glyphPx * 0.04);
  cv.box = box;
  if (emojiCache.size > 400) emojiCache.clear();
  emojiCache.set(key, cv);
  return cv;
}

/**
 * Draw a picture centred on (x, y) at the given pixel size.
 *
 * `ch` may be a sprite name ("fox", "icon-home") or an emoji character — the
 * atlas resolves either. If the sprite sheets have not loaded (or the key is
 * unknown), the original emoji-glyph path keeps everything on screen.
 */
export function drawEmoji(ctx, ch, x, y, size, { rotate = 0, alpha = 1, shadow = false } = {}) {
  if (drawSprite(ctx, ch, x, y, size, { rotate, alpha, shadow })) return;
  const sp = emojiSprite(ch, size);
  ctx.save();
  ctx.globalAlpha *= alpha;
  ctx.translate(x, y);
  if (rotate) ctx.rotate(rotate);
  if (shadow) {
    // Hard offset silhouette — no blur.
    ctx.shadowColor = 'rgba(44,35,64,0.3)';
    ctx.shadowBlur = 0;
    ctx.shadowOffsetY = Math.max(PX / 2, px(size * 0.08));
  }
  ctx.drawImage(sp, -sp.box / 2, -sp.box / 2, sp.box, sp.box);
  ctx.restore();
}

/* ------------------------------------------------------------------ scenery */

// The sky, sun and hills never move, so they are rendered once per size/theme
// into an offscreen canvas and blitted each frame. Only the clouds animate.
let backdropCache = null;

function renderStaticBackdrop(w, h, { top, bottom, hills, sun, sunX, sunY }) {
  const cv = document.createElement('canvas');
  cv.width = Math.max(1, w);
  cv.height = Math.max(1, h);
  const ctx = cv.getContext('2d');

  // Sky: flat horizontal bands with checkerboard dither at every seam —
  // the classic 16-bit stand-in for a gradient. The old gradient reached 55%
  // blend by 62% height; this maps band positions through the same curve
  // (lerpHex needs the raw hex endpoints, so blend factors are combined first).
  const skyAt = (t) => lerpHex(top, bottom, t < 0.62 ? (t / 0.62) * 0.55 : 0.55 + ((t - 0.62) / 0.38) * 0.45);
  const BANDS = 6;
  const bandColors = [];
  for (let i = 0; i < BANDS; i++) bandColors.push(skyAt((i + 0.5) / BANDS));
  for (let i = 0; i < BANDS; i++) {
    const y0 = px((i / BANDS) * h);
    const y1 = i === BANDS - 1 ? h : px(((i + 1) / BANDS) * h);
    ctx.fillStyle = bandColors[i];
    ctx.fillRect(0, y0, w, y1 - y0);
    if (i > 0) ditherBand(ctx, 0, y0 - PX, w, PX * 2, bandColors[i - 1], bandColors[i]);
  }

  if (sun) {
    const sx = px(w * sunX), sy = px(h * sunY);
    const R = px(h * 0.062);
    // Glow = concentric hard rings, stepping down in alpha — never a blur.
    pixelRing(ctx, sx, sy, R + PX * 5, PX * 2, withAlpha('#ffe9a0', 0.25));
    pixelRing(ctx, sx, sy, R + PX * 2, PX * 2, withAlpha('#ffe9a0', 0.5));
    pixelCircle(ctx, sx, sy, R, { fill: '#ffd76a', outline: '#e2a53c', highlight: '#fffbe8' });
  }

  // Layered stepped-terrace hills anchoring the bottom of the frame.
  const STEP = PX * 4; // terrace column width
  hills.forEach((color, i) => {
    const baseY = h * (0.76 + i * 0.08);
    const amp = h * (0.07 - i * 0.015);
    const edge = shade(color, -0.3);
    ctx.fillStyle = color;
    for (let x = 0; x < w; x += STEP) {
      const y = px(baseY + Math.sin((x + STEP / 2) / (w / 3.2) + i * 1.7) * amp);
      ctx.fillStyle = color;
      ctx.fillRect(x, y, STEP, h - y);
      ctx.fillStyle = edge;                       // hard 1-texel crest outline
      ctx.fillRect(x, y, STEP, PX);
      ctx.fillStyle = shade(color, 0.14);         // lit band just under the crest
      ctx.fillRect(x, y + PX, STEP, PX);
    }
  });
  return cv;
}

/**
 * Full-bleed backdrop: banded pixel sky, hard-ringed sun, blocky clouds
 * drifting on the texel grid, and stepped-terrace hills. Every game calls
 * this first so the arcade reads as one world.
 */
export function drawBackdrop(ctx, w, h, t = 0, {
  top = '#bdefff', bottom = '#ffeccf', hills = ['#8fe3a6', '#63cf8b'],
  sun = true, clouds = 3, sunX = 0.82, sunY = 0.18,
} = {}) {
  const key = `${w}|${h}|${top}|${bottom}|${hills.join()}|${sun}|${sunX}|${sunY}`;
  if (!backdropCache || backdropCache.key !== key) {
    backdropCache = { key, canvas: renderStaticBackdrop(w, h, { top, bottom, hills, sun, sunX, sunY }) };
  }
  ctx.save();
  ctx.drawImage(backdropCache.canvas, 0, 0);

  for (let i = 0; i < clouds; i++) {
    const speed = 8 + i * 5;
    const cw = w * (0.16 + hashNoise(i * 7) * 0.14);
    const span = w + cw * 2;
    // Snap the drift to the texel grid so clouds step rather than shimmer.
    const cx = px(((hashNoise(i * 13) * span + t * speed) % span) - cw);
    const cy = px(h * (0.1 + hashNoise(i * 29) * 0.28));
    ctx.globalAlpha = stepAlpha(0.75);
    cloudPath(ctx, cx, cy, cw, cw * 0.42);
    ctx.fillStyle = 'rgba(255,255,255,0.92)';
    ctx.fill();
    ctx.globalAlpha = 1;
  }
  ctx.restore();
}

function lerpHex(a, b, t) {
  const pa = parseInt(a.slice(1), 16), pb = parseInt(b.slice(1), 16);
  const r = Math.round(lerp((pa >> 16) & 255, (pb >> 16) & 255, t));
  const g = Math.round(lerp((pa >> 8) & 255, (pb >> 8) & 255, t));
  const bl = Math.round(lerp(pa & 255, pb & 255, t));
  return `rgb(${r},${g},${bl})`;
}

/** HUD/dialog panel: flat pixel card with a hard offset shadow and bezel. */
export function glassPanel(ctx, x, y, w, h, r = 28, { alpha = 0.86, tint = '#ffffff' } = {}) {
  ctx.save();
  ctx.globalAlpha *= stepAlpha(alpha);
  pixelRect(ctx, x, y, w, h, {
    fill: tint,
    outline: 'rgba(91,79,118,0.55)',
    chamfer: chamferFor(r, w, h),
    highlight: 'rgba(255,255,255,0.95)',
    lowlight: 'rgba(44,35,64,0.12)',
    shadow: true,
  });
  ctx.restore();
}

/* -------------------------------------------------------------------- mascot */

/**
 * Pip — the little fox who hosts the arcade, drawn from the 16-bit pose sheet
 * (pip.png: happy / cheer / think / oops / blink / wave). Idle life comes from
 * code: breathing, a cheer bounce, blinking and the occasional wave — all
 * quantized to whole texels so the sprite never shimmers sub-pixel. Falls
 * back to the original vector fox if the sheet has not loaded.
 *
 * @param {object} o
 * @param {number} o.t      time in seconds (drives idle breathing + blinking)
 * @param {string} o.mood   'happy' | 'cheer' | 'think' | 'oops'
 * @param {number} o.look   -1..1 horizontal gaze (vector fallback only)
 */
export function drawPip(ctx, x, y, size, { t = 0, mood = 'happy', look = 0 } = {}) {
  if (getSprite('pip-happy')) {
    const s = size / 100;
    // Breathe in whole-texel steps of the 96px source cell (±2 texels).
    const breathe = 1 + Math.round(Math.sin(t * 2.1) * 2) / 96;
    const bounce = mood === 'cheer' ? px(Math.abs(Math.sin(t * 7)) * 10 * s) : 0;
    const blinkPhase = (t % 3.7) / 3.7;

    let pose = `pip-${mood}`;
    if (mood === 'happy') {
      if ((t % 9) < 1.2) pose = 'pip-wave';               // a periodic hello
      else if (blinkPhase > 0.955) pose = 'pip-blink';
    }
    if (!getSprite(pose)) pose = 'pip-happy';

    ctx.save();
    ctx.translate(x, y - bounce);
    ctx.scale(1, breathe);
    // The vector fox spanned y −108 (ears) … +190 (shadow) at s=1; place the
    // sprite over the same footprint so existing call sites stay put.
    drawSprite(ctx, pose, 0, 41 * s, 298 * s);
    ctx.restore();
    return;
  }
  drawPipVector(ctx, x, y, size, { t, mood, look });
}

/**
 * Pre-atlas vector fallback for Pip. It only ever shows in the moments before
 * pip.png decodes (or if it is missing entirely), so it keeps its original
 * smooth construction rather than a full pixel rebuild.
 */
function drawPipVector(ctx, x, y, size, { t = 0, mood = 'happy', look = 0 } = {}) {
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

  // Tail — anchored at the hip and swishing, drawn before the body so it tucks
  // behind. The tip is cream, like a real fox.
  ctx.save();
  ctx.translate(-40, 116);
  ctx.rotate(Math.sin(t * 2.4) * 0.14 - 0.18);
  ctx.beginPath();
  ctx.moveTo(4, 16);
  ctx.quadraticCurveTo(-64, 26, -74, -34);
  ctx.quadraticCurveTo(-38, -18, 2, -22);
  ctx.closePath();
  ctx.fillStyle = furDark;
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(-58, 4);
  ctx.quadraticCurveTo(-80, -6, -74, -34);
  ctx.quadraticCurveTo(-54, -26, -46, -8);
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

  // ears — tall triangles with a soft inner shell
  [-1, 1].forEach((side) => {
    ctx.beginPath();
    ctx.moveTo(side * 24, -46);
    ctx.quadraticCurveTo(side * 44, -108, side * 62, -50);
    ctx.quadraticCurveTo(side * 44, -34, side * 24, -46);
    ctx.closePath();
    ctx.fillStyle = furDark;
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(side * 33, -50);
    ctx.quadraticCurveTo(side * 44, -88, side * 53, -50);
    ctx.quadraticCurveTo(side * 43, -42, side * 33, -50);
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

/** Progress pips — a row of pixel discs that fill in as the round advances. */
export function progressPips(ctx, x, y, total, done, { r = 11, gap = 30, color = '#ffc93c' } = {}) {
  const startX = x - ((total - 1) * gap) / 2;
  for (let i = 0; i < total; i++) {
    const cx = startX + i * gap;
    if (i < done) {
      pixelCircle(ctx, cx, y, r, { fill: color, outline: shade(color, -0.4) });
      if (!drawSprite(ctx, 'sparkle-star', px(cx), px(y), r * 1.2)) {
        // pixel plus twinkle — two crossed texel bars
        ctx.fillStyle = 'rgba(255,255,255,0.85)';
        ctx.fillRect(px(cx) - PX / 2, px(y) - px(r * 0.5), PX, px(r * 0.5) * 2);
        ctx.fillRect(px(cx) - px(r * 0.5), px(y) - PX / 2, px(r * 0.5) * 2, PX);
      }
    } else {
      pixelCircle(ctx, cx, y, r, { fill: 'rgba(255,255,255,0.55)', outline: 'rgba(255,255,255,0.85)' });
    }
  }
}

/** A gold star with a hard ring glow — the universal "you did it" token. */
export function goldStar(ctx, cx, cy, r, { glow = 1, rot = 0, filled = true } = {}) {
  const key = filled ? 'gold-star-big' : 'gold-star-empty';
  if (getSprite(key)) {
    ctx.save();
    if (filled && glow > 0.1) {
      // Glow = a hard pixel ring hugging the star, alpha stepped in eighths.
      ctx.globalAlpha *= stepAlpha(0.6 * glow);
      pixelRing(ctx, cx, cy, r * 1.25, PX * 2, withAlpha('#ffc93c', 0.9));
      ctx.globalAlpha = 1;
    }
    drawSprite(ctx, key, cx, cy, r * 2.15, { rotate: snapAngle(rot) });
    ctx.restore();
    return;
  }
  ctx.save();
  if (filled && glow > 0.1) {
    ctx.globalAlpha *= stepAlpha(0.6 * glow);
    pixelRing(ctx, cx, cy, r * 1.25, PX * 2, withAlpha('#ffc93c', 0.9));
    ctx.globalAlpha = 1;
  }
  starPath(ctx, cx, cy, r, r * 0.45, 5, -Math.PI / 2 + snapAngle(rot));
  ctx.fillStyle = filled ? '#ffc93c' : 'rgba(255,255,255,0.35)';
  ctx.fill();
  if (filled) {
    starPath(ctx, cx, cy - r * 0.08, r * 0.5, r * 0.22, 5, -Math.PI / 2 + snapAngle(rot));
    ctx.fillStyle = '#fff3b0';
    ctx.fill();
    starPath(ctx, cx, cy, r, r * 0.45, 5, -Math.PI / 2 + snapAngle(rot));
  }
  ctx.lineWidth = Math.max(2, px(r * 0.11));
  ctx.strokeStyle = filled ? '#e2820f' : 'rgba(255,255,255,0.75)';
  ctx.stroke();
  ctx.restore();
}
