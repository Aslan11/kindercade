/**
 * Touch/pointer input, normalised into the game's logical coordinate space.
 *
 * Designed for a five-year-old on an iPad:
 *  - a "tap" tolerates a lot of wobble (fingers are not mice)
 *  - only the first finger down drives the game, so a resting palm cannot
 *    hijack a drag
 *  - every pointer event is passive:false + preventDefault so Safari never
 *    scrolls, zooms or shows the text-selection loupe mid-game
 */

import { dist } from './util.js';

/** A finger that has to travel this far (logical px) before it counts as a drag. */
const TAP_SLOP = 16;
/** ...and lift within this many seconds. */
const TAP_TIME = 0.6;

export class Input {
  constructor(canvas, viewport) {
    this.canvas = canvas;
    this.viewport = viewport; // { toLogical(clientX, clientY) -> {x, y} }
    this.handlers = null;

    this.down = false;
    this.x = 0;
    this.y = 0;
    this.startX = 0;
    this.startY = 0;
    this.downAt = 0;
    this.moved = false;
    this.pointerId = null;

    this._onDown = this._onDown.bind(this);
    this._onMove = this._onMove.bind(this);
    this._onUp = this._onUp.bind(this);
    this._onCancel = this._onCancel.bind(this);

    const opts = { passive: false };
    canvas.addEventListener('pointerdown', this._onDown, opts);
    // Move/up live on window so a finger that slides off the canvas still resolves.
    window.addEventListener('pointermove', this._onMove, opts);
    window.addEventListener('pointerup', this._onUp, opts);
    window.addEventListener('pointercancel', this._onCancel, opts);
  }

  /** The active game supplies { onPointerDown, onPointerMove, onPointerUp, onTap }. */
  setHandlers(h) {
    this.handlers = h;
    this.down = false;
    this.pointerId = null;
  }

  _point(e) {
    const p = this.viewport.toLogical(e.clientX, e.clientY);
    return { x: p.x, y: p.y, id: e.pointerId, event: e };
  }

  _onDown(e) {
    if (this.pointerId !== null) return; // ignore extra fingers
    e.preventDefault();
    try { this.canvas.setPointerCapture(e.pointerId); } catch (_) { /* not fatal */ }
    this.pointerId = e.pointerId;
    const p = this._point(e);
    this.down = true;
    this.moved = false;
    this.x = this.startX = p.x;
    this.y = this.startY = p.y;
    this.downAt = performance.now() / 1000;
    this.handlers?.onPointerDown?.(p);
  }

  _onMove(e) {
    if (this.pointerId !== e.pointerId) {
      // Track hover position for pointer devices even when nothing is pressed.
      if (this.pointerId === null && e.pointerType === 'mouse') {
        const p = this._point(e);
        this.x = p.x; this.y = p.y;
        this.handlers?.onPointerHover?.(p);
      }
      return;
    }
    e.preventDefault();
    const p = this._point(e);
    this.x = p.x;
    this.y = p.y;
    if (!this.moved && dist(p.x, p.y, this.startX, this.startY) > TAP_SLOP) this.moved = true;
    this.handlers?.onPointerMove?.(p);
  }

  _onUp(e) {
    if (this.pointerId !== e.pointerId) return;
    e.preventDefault();
    const p = this._point(e);
    this.pointerId = null;
    this.down = false;
    const held = performance.now() / 1000 - this.downAt;
    this.handlers?.onPointerUp?.(p);
    if (!this.moved && held < TAP_TIME) this.handlers?.onTap?.(p);
  }

  _onCancel(e) {
    if (this.pointerId !== e.pointerId) return;
    this.pointerId = null;
    this.down = false;
    this.handlers?.onPointerUp?.({ x: this.x, y: this.y, cancelled: true });
  }

  destroy() {
    this.canvas.removeEventListener('pointerdown', this._onDown);
    window.removeEventListener('pointermove', this._onMove);
    window.removeEventListener('pointerup', this._onUp);
    window.removeEventListener('pointercancel', this._onCancel);
    this.handlers = null;
  }
}

/**
 * Drag helper shared by every drag-and-drop game (word building, jigsaw,
 * counting, sorting). Items are plain objects with `x`, `y` plus a hit radius.
 *
 * Usage:
 *   this.drag = new DragController({ items: () => this.tokens, onDrop: (item, p) => {...} });
 *   ...forward pointer events to drag.begin/move/end
 */
export class DragController {
  constructor({ items, radius = 60, onPick = null, onDrop = null, onMove = null, canPick = null }) {
    this.itemsFn = typeof items === 'function' ? items : () => items;
    this.radius = radius;
    this.onPick = onPick;
    this.onDrop = onDrop;
    this.onMove = onMove;
    this.canPick = canPick;
    this.held = null;
    this.offsetX = 0;
    this.offsetY = 0;
  }

  /** Topmost item under the point wins, so stacked tokens behave intuitively. */
  hitTest(p) {
    const items = this.itemsFn() || [];
    for (let i = items.length - 1; i >= 0; i--) {
      const it = items[i];
      if (!it || it.locked || it.hidden) continue;
      if (this.canPick && !this.canPick(it)) continue;
      const r = it.hitRadius ?? this.radius;
      if (dist(p.x, p.y, it.x, it.y) <= r) return it;
    }
    return null;
  }

  begin(p) {
    const it = this.hitTest(p);
    if (!it) return null;
    this.held = it;
    // Grab-point offset keeps the token from snapping under the fingertip.
    this.offsetX = it.x - p.x;
    this.offsetY = it.y - p.y;
    it.dragging = true;
    this.onPick?.(it, p);
    return it;
  }

  move(p) {
    if (!this.held) return;
    this.held.x = p.x + this.offsetX;
    this.held.y = p.y + this.offsetY;
    this.onMove?.(this.held, p);
  }

  end(p) {
    if (!this.held) return null;
    const it = this.held;
    it.dragging = false;
    this.held = null;
    this.onDrop?.(it, p);
    return it;
  }

  cancel() {
    if (this.held) this.held.dragging = false;
    this.held = null;
  }
}
