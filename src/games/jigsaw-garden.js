/**
 * Jigsaw Garden — spatial reasoning, part-whole thinking and persistence.
 *
 * The picture is a finished 16-bit scene painting from the sprite atlas, drawn
 * cover-fit into an offscreen canvas and cut with real interlocking tabs: every
 * interior edge carries a knob on one side and the matching socket on the
 * other, seeded so both pieces always agree. The knob curves are pure math —
 * they are sampled, snapped to the texel grid and emitted as axis-stepped
 * staircase outlines, so the cut itself reads as pixel art. Until the painting
 * decodes, the old runtime composite stands in as a placeholder.
 *
 * A faint ghost of the finished picture stays visible inside the frame. That is
 * deliberate — for a five-year-old the challenge should be *placing* the piece,
 * not holding the whole image in their head.
 */

import { Game } from '../core/engine.js';
import { drawBackdrop, drawEmoji, softText, glassPanel, roundRect, PX, px, stepAlpha, HARD_SHADOW } from '../core/art.js';
import { DragController } from '../core/input.js';
import { loadScene } from '../core/sprites.js';
import { Ease } from '../core/anim.js';
import { shuffle, pick, clamp, randInt, makeRng, dist, lerp } from '../core/util.js';
import { PRAISE } from '../data/words.js';

const GRIDS = { 1: [2, 2], 2: [3, 2], 3: [3, 3] };

// `name` doubles as the scene painting's atlas name; the sky/hills/props are
// only used for the placeholder composite drawn before the painting decodes.
const SCENES = [
  { hero: '🦊', name: 'fox', sky: ['#cfefff', '#ffe7c4'], hills: ['#9ae7ac', '#68d18e'], props: ['🌷', '🍄', '🦋'] },
  { hero: '🐢', name: 'turtle', sky: ['#c9f2ff', '#d9fff0'], hills: ['#8fe3d0', '#5fc9b6'], props: ['🌿', '🐚', '💧'] },
  { hero: '🚂', name: 'train', sky: ['#ffe0c2', '#ffd0e0'], hills: ['#e8c39a', '#d3a878'], props: ['☁️', '🌵', '⛰️'] },
  { hero: '🐳', name: 'whale', sky: ['#bfe4ff', '#a8d8ff'], hills: ['#7fc4e8', '#5aa8d6'], props: ['🌊', '⭐️', '🐠'] },
  { hero: '🦋', name: 'butterfly', sky: ['#ffe4f4', '#fff4d8'], hills: ['#f5b8dd', '#e894c8'], props: ['🌸', '🌼', '🍃'] },
  { hero: '🏰', name: 'castle', sky: ['#dfe4ff', '#ffeede'], hills: ['#b6c4f0', '#93a4e0'], props: ['🌟', '🌳', '🚩'] },
  { hero: '🚀', name: 'rocket', sky: ['#d8e0ff', '#ffe0f0'], hills: ['#a9b6ef', '#8492dd'], props: ['⭐️', '🪐', '☄️'] },
  { hero: '🐝', name: 'bee', sky: ['#fff3c9', '#ffe2c0'], hills: ['#c9e58f', '#a8d16a'], props: ['🌻', '🌺', '🍯'] },
];

export default class JigsawGarden extends Game {
  static meta = {
    id: 'jigsaw-garden',
    title: 'Jigsaw Garden',
    subject: 'puzzle',
    blurb: 'Slide the pieces to finish the picture.',
    emoji: '🧩',
    tint: '#3ddc97',
  };

  init() {
    this.maxLevel = 3;
    const [cols, rows] = GRIDS[this.level] || GRIDS[1];
    this.cols = cols;
    this.rows = rows;
    this.roundsTotal = cols * rows;
    this.busy = false;
    this.placedCount = 0;
    this.seamFade = 0;
    this.scene = pick(SCENES);
    this.seed = randInt(1, 1e6);
    this.pieces = [];
    this.backdrop = { top: '#e4fff0', bottom: '#fff6dd', hills: ['#9ee8bd', '#6fd39c'] };

    // The painting arrives asynchronously; re-render the offscreen picture when
    // it lands. The pieces and the ghost both blit from that one canvas, so
    // nothing else needs invalidating.
    this.sceneImage = null;
    loadScene(this.scene.name).then((img) => {
      if (!img || !this.pieces) return;   // destroyed while decoding
      this.sceneImage = img;
      if (this.frame) this.renderPicture();
    });

    this.drag = new DragController({
      items: () => this.pieces,
      canPick: (p) => !this.busy && !p.locked,
      onPick: (p) => {
        // Bring to front so a picked piece is never buried.
        this.pieces.splice(this.pieces.indexOf(p), 1);
        this.pieces.push(p);
        p.lift = 1;
        this.audio.pick();
      },
      onDrop: (p) => this.dropPiece(p),
    });

    this.setPrompt('Finish the picture', { speech: `Can you finish the ${this.scene.name} picture?` });
  }

  hintPulse() {
    for (const p of this.pieces) if (!p.locked) p.wobble = 1;
  }

  /* ---------------------------------------------------------------- layout */

  layout() {
    if (!this.drag) return;

    // The screen splits into a frame region and a tray band along the bottom.
    this.trayH = clamp(this.H * 0.22, 150, 210);
    const availH = this.H - this.playTop - this.trayH - 54;
    const availW = this.W * 0.66;
    // Cell and frame origin snap to the texel grid so every cut edge, seam
    // line and staircase knob of adjacent pieces lands on the same texels.
    const cell = Math.floor(Math.min(availW / this.cols, availH / this.rows) / PX) * PX;
    this.pw = cell;
    this.ph = cell;
    const fw = cell * this.cols;
    const fh = cell * this.rows;
    this.frame = {
      x: px(this.cx - fw / 2),
      y: px(this.playTop + (availH - fh) / 2),
      w: fw, h: fh,
    };
    this.trayTop = this.H - this.trayH;
    this.trayY = this.trayTop + this.trayH * 0.46;

    this.renderPicture();
    this.buildPieces();
  }

  /* -------------------------------------------------------------- the image */

  /** Draws the scene onto an offscreen canvas at the frame's pixel size. */
  renderPicture() {
    const w = Math.max(64, this.frame.w);
    const h = Math.max(64, this.frame.h);
    this.picture = this.picture || document.createElement('canvas');
    this.picture.width = w;
    this.picture.height = h;
    const c = this.picture.getContext('2d');
    const s = this.scene;
    const rng = makeRng(this.seed);

    // The finished painting, cover-fit: fill the frame, keep the aspect ratio,
    // crop the overflow evenly and leave the pixels chunky.
    const img = this.sceneImage;
    if (img) {
      const k = Math.max(w / img.width, h / img.height);
      const dw = img.width * k;
      const dh = img.height * k;
      c.imageSmoothingEnabled = false;
      c.drawImage(img, (w - dw) / 2, (h - dh) / 2, dw, dh);
      return;
    }

    // Placeholder until the painting decodes: the old runtime composite.
    drawBackdrop(c, w, h, 2.5, {
      top: s.sky[0], bottom: s.sky[1], hills: s.hills, sun: true, clouds: 2,
      sunX: 0.2 + rng() * 0.6, sunY: 0.14 + rng() * 0.1,
    });

    // Scattered decorations behind the hero.
    for (let i = 0; i < 7; i++) {
      const px = w * (0.06 + rng() * 0.88);
      const py = h * (0.45 + rng() * 0.48);
      drawEmoji(c, s.props[i % s.props.length], px, py, Math.min(w, h) * (0.08 + rng() * 0.06));
    }
    // A few dappled clusters of texel squares for depth.
    for (let i = 0; i < 4; i++) {
      const bx = w * rng();
      const by = h * (0.5 + rng() * 0.5);
      const br = Math.min(w, h) * (0.08 + rng() * 0.1);
      c.save();
      c.globalAlpha = stepAlpha(0.18);
      c.fillStyle = '#ffffff';
      for (let j = 0; j < 14; j++) {
        const a = rng() * Math.PI * 2;
        const d = Math.sqrt(rng()) * br;
        c.fillRect(px(bx + Math.cos(a) * d), px(by + Math.sin(a) * d), PX * 2, PX * 2);
      }
      c.restore();
    }
    // Hero, big and centred.
    drawEmoji(c, s.hero, w * 0.5, h * 0.5, Math.min(w, h) * 0.56, { shadow: true });
    // Pixel plus-shape twinkles in the sky.
    for (let i = 0; i < 5; i++) {
      const sx = px(w * rng());
      const sy = px(h * rng() * 0.55);
      const arm = Math.max(PX, px(Math.min(w, h) * 0.03));
      c.save();
      c.globalAlpha = stepAlpha(0.5);
      c.fillStyle = '#ffffff';
      c.fillRect(sx - arm, sy, arm * 2 + PX, PX);
      c.fillRect(sx, sy - arm, PX, arm * 2 + PX);
      c.restore();
    }
  }

  /* ------------------------------------------------------------- the cut */

  /**
   * Edge signs are derived from a seeded RNG so the two pieces sharing an edge
   * always compute the same knob direction: the piece on the left owns the sign,
   * the piece on the right takes its negation.
   */
  edgeSign(kind, r, c) {
    const rng = makeRng(this.seed + (kind === 'v' ? 7919 : 104729) + r * 131 + c * 17);
    return rng() < 0.5 ? -1 : 1;
  }

  /** Right edge of (r,c) — shared with the left edge of (r,c+1). */
  vSign(r, c) { return c < 0 || c >= this.cols - 1 ? 0 : this.edgeSign('v', r, c); }
  /** Bottom edge of (r,c) — shared with the top edge of (r+1,c). */
  hSign(r, c) { return r < 0 || r >= this.rows - 1 ? 0 : this.edgeSign('h', r, c); }

  /**
   * A single piece outline in local coordinates, with a tab (or socket, or a
   * straight border edge) on each side. The knob beziers are used only as MATH:
   * each curve is sampled, the samples snap to the texel grid, and the outline
   * is emitted as an axis-stepped staircase. Both pieces sharing an edge sample
   * the identical physical curve (one is the exact reverse of the other), and
   * the step corner is picked independent of travel direction, so the two
   * staircases complement each other texel for texel.
   */
  piecePath(r, c) {
    const w = this.pw;
    const h = this.ph;
    const tab = Math.min(w, h) * 0.2;    // how far the knob sticks out
    const neck = 0.36;                   // where along the edge the knob sits
    const steps = clamp(Math.round(tab), 10, 40);   // samples per knob curve

    // Grid-snapped sample list, skipping consecutive duplicates.
    const pts = [];
    const add = (x, y) => {
      const qx = px(x);
      const qy = px(y);
      const last = pts[pts.length - 1];
      if (last && last[0] === qx && last[1] === qy) return;
      pts.push([qx, qy]);
    };
    // Cubic bezier point — sampling math only, never painted directly.
    const cubic = (p0, c1, c2, p1, t) => {
      const u = 1 - t;
      const a = u * u * u, b = 3 * u * u * t, d = 3 * u * t * t, e = t * t * t;
      return [
        a * p0[0] + b * c1[0] + d * c2[0] + e * p1[0],
        a * p0[1] + b * c1[1] + d * c2[1] + e * p1[1],
      ];
    };

    // Each edge is traced left-to-right / top-to-bottom in local space; `sign`
    // of +1 pushes the knob outward, -1 carves it inward.
    const edge = (x0, y0, x1, y1, sign) => {
      if (!sign) { add(x1, y1); return; }
      const dx = x1 - x0;
      const dy = y1 - y0;
      // Perpendicular, pointing "out" of the piece.
      const nx = dy;
      const ny = -dx;
      const len = Math.hypot(nx, ny) || 1;
      const ux = (nx / len) * tab * sign;
      const uy = (ny / len) * tab * sign;
      const at = (t) => [x0 + dx * t, y0 + dy * t];

      const a = at(neck);
      const b = at(1 - neck);
      const [mx, my] = at(0.5);
      const m = [mx + ux, my + uy];
      add(a[0], a[1]);
      for (let i = 1; i <= steps; i++) {
        const [sx, sy] = cubic(
          a, [a[0] + ux * 0.1, a[1] + uy * 0.1],
          [mx - dx * 0.16 + ux * 1.25, my - dy * 0.16 + uy * 1.25], m, i / steps,
        );
        add(sx, sy);
      }
      for (let i = 1; i <= steps; i++) {
        const [sx, sy] = cubic(
          m, [mx + dx * 0.16 + ux * 1.25, my + dy * 0.16 + uy * 1.25],
          [b[0] + ux * 0.1, b[1] + uy * 0.1], b, i / steps,
        );
        add(sx, sy);
      }
      add(x1, y1);
    };

    add(0, 0);
    edge(0, 0, w, 0, -this.hSign(r - 1, c));    // top: complement of the piece above
    edge(w, 0, w, h, this.vSign(r, c));         // right
    edge(w, h, 0, h, this.hSign(r, c));         // bottom
    edge(0, h, 0, 0, -this.vSign(r, c - 1));    // left: complement of the piece to the left
    const first = pts[0];
    const last = pts[pts.length - 1];
    if (last[0] === first[0] && last[1] === first[1]) pts.pop();

    // Emit the staircase: samples that differ on both axes route through a
    // corner at (x of the lower point, y of the upper point) — the same
    // physical corner no matter which piece walks the edge.
    const p = new Path2D();
    p.moveTo(pts[0][0], pts[0][1]);
    for (let i = 1; i <= pts.length; i++) {
      const [x0p, y0p] = pts[i - 1];
      const [x1p, y1p] = pts[i % pts.length];
      if (x0p !== x1p && y0p !== y1p) {
        p.lineTo(y0p > y1p ? x0p : x1p, Math.min(y0p, y1p));
      }
      p.lineTo(x1p, y1p);
    }
    p.closePath();
    return p;
  }

  buildPieces() {
    const existing = new Map(this.pieces.map((p) => [`${p.r},${p.c}`, p]));
    const pieces = [];
    for (let r = 0; r < this.rows; r++) {
      for (let c = 0; c < this.cols; c++) {
        const prev = existing.get(`${r},${c}`);
        const piece = prev || {
          r, c, locked: false, dragging: false, lift: 0, wobble: 0, trayIndex: 0,
        };
        piece.path = this.piecePath(r, c);
        piece.homeX = this.frame.x + c * this.pw + this.pw / 2;
        piece.homeY = this.frame.y + r * this.ph + this.ph / 2;
        piece.hitRadius = Math.min(this.pw, this.ph) * 0.46;
        pieces.push(piece);
      }
    }
    this.pieces = pieces;

    // Shuffle the tray once, so the pieces are not sitting in solution order.
    if (!this.trayOrdered) {
      const order = shuffle(pieces.map((_, i) => i));
      pieces.forEach((p, i) => { p.trayIndex = order[i]; });
      this.trayOrdered = true;
    }

    // Pieces shrink to fit the tray — in both directions — and grow back to
    // full size when picked up.
    const loose = this.pieces.filter((p) => !p.locked).sort((a, b) => a.trayIndex - b.trayIndex);
    const laneW = this.W * 0.92;
    this.trayScale = clamp(Math.min(
      laneW / Math.max(1, loose.length * this.pw * 1.06),
      (this.trayH * 0.72) / this.ph,
    ), 0.34, 1);

    // Inset by half a piece so nothing hangs off either edge of the screen.
    const usable = Math.max(0, laneW - this.pw * this.trayScale);
    const step = loose.length > 1 ? usable / (loose.length - 1) : 0;
    loose.forEach((p, i) => {
      p.trayX = loose.length === 1 ? this.cx : this.cx - usable / 2 + i * step;
      p.trayY = this.trayY;
      p.hitRadius = Math.min(this.pw, this.ph) * 0.46 * this.trayScale;
      if (!p.dragging) { p.x = p.trayX; p.y = p.trayY; }
    });
    for (const p of this.pieces) {
      if (p.locked) { p.x = p.homeX; p.y = p.homeY; p.hitRadius = 0; }
    }
  }

  /** Full size in the frame or in hand; shrunk while waiting in the tray. */
  pieceScale(p) {
    if (p.locked) return 1;
    return lerp(this.trayScale ?? 1, 1.06, clamp(p.lift, 0, 1));
  }

  /* ----------------------------------------------------------------- input */

  onPointerDown(p) { if (!this.busy) this.drag.begin(p); }
  onPointerMove(p) { this.drag.move(p); }
  onPointerUp(p) { this.drag.end(p); }

  dropPiece(piece) {
    piece.lift = 0;
    // A generous snap radius: near enough is right, for these hands.
    // buildPieces() re-homes everything, so remember the drop point and animate
    // from there rather than teleporting.
    const from = { x: piece.x, y: piece.y };

    if (dist(piece.x, piece.y, piece.homeX, piece.homeY) < Math.min(this.pw, this.ph) * 0.55) {
      piece.locked = true;
      this.placedCount++;
      this.roundsDone = this.placedCount;
      this.audio.place();
      this.fx.sparkle(piece.homeX, piece.homeY, 10, { color: '#d8ffe8', spread: 90 });
      this.buildPieces();
      piece.x = from.x;
      piece.y = from.y;
      this.tweens.to(piece, { x: piece.homeX, y: piece.homeY }, 0.14, { ease: Ease.outQuad });
      if (this.placedCount >= this.cols * this.rows) this.complete();
      return;
    }

    this.buildPieces();
    const home = { x: piece.trayX, y: piece.trayY };
    piece.x = from.x;
    piece.y = from.y;
    this.tweens.to(piece, home, 0.3, { ease: Ease.outBack });
  }

  complete() {
    this.busy = true;
    this.audio.correct();
    // Seams dissolve so the picture becomes whole before the celebration.
    this.tweens.to(this, { seamFade: 1 }, 0.7);
    this.tweens.after(0.5, () => {
      this.fx.confetti(this.cx, this.frame.y + this.frame.h / 2, 60);
      this.audio.speak(`You finished the ${this.scene.name}! ${pick(PRAISE)}`);
    });
    this.tweens.after(2.6, () => this.finishRound({ title: pick(PRAISE) }));
  }

  /* ------------------------------------------------------------------ frame */

  update(dt) {
    for (const p of this.pieces) if (p.wobble > 0) p.wobble = Math.max(0, p.wobble - dt * 1.3);
    if (this.drag.held) this.fx.trail(this.drag.held.x, this.drag.held.y, 'rgba(210,255,230,0.8)');
  }

  draw(ctx) {
    const f = this.frame;

    // Frame + ghost of the finished picture, so the child can see where things go.
    glassPanel(ctx, f.x - 14, f.y - 14, f.w + 28, f.h + 28, 28, { alpha: 0.5 });
    ctx.save();
    ctx.beginPath();
    ctx.rect(f.x, f.y, f.w, f.h);
    ctx.clip();
    ctx.globalAlpha = stepAlpha(0.32);
    ctx.drawImage(this.picture, f.x, f.y, f.w, f.h);
    ctx.restore();

    // Grid guide as texel-wide seam lines, dissolving in stepped eighths.
    if (this.seamFade < 1) {
      ctx.save();
      ctx.globalAlpha = stepAlpha(0.3 * (1 - this.seamFade));
      ctx.fillStyle = '#ffffff';
      for (let c = 1; c < this.cols; c++) {
        ctx.fillRect(f.x + c * this.pw, f.y, PX, f.h);
      }
      for (let r = 1; r < this.rows; r++) {
        ctx.fillRect(f.x, f.y + r * this.ph, f.w, PX);
      }
      ctx.restore();
    }

    // Tray shelf, as a chamfered pixel band across the bottom of the screen.
    if (this.placedCount < this.cols * this.rows) {
      ctx.save();
      const tx = px(this.W * 0.02);
      const ty = px(this.trayTop);
      const tw = px(this.W * 0.96);
      roundRect(ctx, tx, ty, tw, px(this.trayH + 40), 8);
      ctx.fillStyle = 'rgba(255,255,255,0.42)';
      ctx.fill();
      ctx.strokeStyle = 'rgba(44,35,64,0.2)';
      ctx.lineWidth = PX;
      ctx.stroke();
      // A 1-texel light band along the inside top edge of the shelf.
      ctx.fillStyle = 'rgba(255,255,255,0.55)';
      ctx.fillRect(tx + PX * 2, ty + PX, tw - PX * 4, PX);
      ctx.restore();
      softText(ctx, 'Drag the pieces into the picture', this.cx, this.trayTop - 14, 24,
        { color: 'rgba(44,35,64,0.45)' });
    }

    for (const p of this.pieces) if (p.locked) this.drawPiece(ctx, p);
    for (const p of this.pieces) if (!p.locked && !p.dragging) this.drawPiece(ctx, p);
    for (const p of this.pieces) if (p.dragging) this.drawPiece(ctx, p);
  }

  /**
   * Clip to the piece's staircase outline, draw the slice of the picture that
   * belongs there, then stroke the edge as a hard 1-texel seam.
   */
  drawPiece(ctx, p) {
    const wob = p.wobble > 0 ? px(Math.sin(this.t * 20) * 5 * p.wobble) : 0;
    const scale = this.pieceScale(p);
    ctx.save();
    ctx.translate(p.x + wob, p.y);
    ctx.scale(scale, scale);
    ctx.translate(-this.pw / 2, -this.ph / 2);

    if (p.lift > 0.1) {
      // Hard offset silhouette shadow: the piece's own outline, a couple of
      // texels down, flat and blur-free.
      ctx.save();
      ctx.translate(0, PX * 2);
      ctx.fillStyle = HARD_SHADOW;
      ctx.fill(p.path);
      ctx.restore();
    }

    ctx.save();
    ctx.clip(p.path);
    // Pieces are scaled down in the tray and up in hand — keep the pixels hard.
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(this.picture, -p.c * this.pw, -p.r * this.ph, this.frame.w, this.frame.h);
    ctx.restore();

    if (!(p.locked && this.seamFade >= 1)) {
      // Locked seams dissolve in stepped eighths once the puzzle completes.
      ctx.globalAlpha = stepAlpha(0.875 * (p.locked ? 1 - this.seamFade : 1));
      ctx.lineWidth = PX;
      ctx.strokeStyle = '#ffffff';
      ctx.stroke(p.path);
    }
    ctx.restore();
  }

  destroy() {
    this.picture = null;
    this.sceneImage = null;
    this.pieces = null;
  }
}
