/**
 * Easing curves + a tiny tween manager.
 *
 * Games get one `Tweens` instance on `this.tweens`; it is stepped by the engine
 * and wiped automatically when the game is torn down.
 */

export const Ease = {
  linear: (t) => t,
  inQuad: (t) => t * t,
  outQuad: (t) => 1 - (1 - t) * (1 - t),
  inOutQuad: (t) => (t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2),
  inCubic: (t) => t * t * t,
  outCubic: (t) => 1 - (1 - t) ** 3,
  inOutCubic: (t) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2),
  outQuart: (t) => 1 - (1 - t) ** 4,
  /** Overshoots slightly — the "pop" that makes UI feel alive. */
  outBack: (t, s = 1.70158) => 1 + (s + 1) * (t - 1) ** 3 + s * (t - 1) ** 2,
  inBack: (t, s = 1.70158) => (s + 1) * t * t * t - s * t * t,
  outElastic: (t) => {
    if (t === 0 || t === 1) return t;
    const p = 0.36;
    return 2 ** (-10 * t) * Math.sin(((t - p / 4) * (Math.PI * 2)) / p) + 1;
  },
  outBounce: (t) => {
    const n = 7.5625, d = 2.75;
    if (t < 1 / d) return n * t * t;
    if (t < 2 / d) return n * (t -= 1.5 / d) * t + 0.75;
    if (t < 2.5 / d) return n * (t -= 2.25 / d) * t + 0.9375;
    return n * (t -= 2.625 / d) * t + 0.984375;
  },
  /** 0 -> 1 -> 0. Great for one-shot squash/stretch pulses. */
  pulse: (t) => Math.sin(t * Math.PI),
};

class Tween {
  constructor(target, props, duration, opts = {}) {
    this.target = target;
    this.props = props;
    this.duration = Math.max(0.0001, duration);
    this.ease = opts.ease || Ease.outCubic;
    this.delay = opts.delay || 0;
    this.onUpdate = opts.onUpdate || null;
    this.onComplete = opts.onComplete || null;
    this.elapsed = 0;
    this.from = null;
    this.done = false;
  }

  step(dt) {
    if (this.done) return;
    if (this.delay > 0) {
      this.delay -= dt;
      if (this.delay > 0) return;
      dt = -this.delay;
      this.delay = 0;
    }
    // Capture start values on first real frame so tweens can be queued ahead of time.
    if (!this.from) {
      this.from = {};
      for (const k in this.props) this.from[k] = this.target[k] ?? 0;
    }
    this.elapsed += dt;
    const raw = Math.min(1, this.elapsed / this.duration);
    const t = this.ease(raw);
    for (const k in this.props) {
      this.target[k] = this.from[k] + (this.props[k] - this.from[k]) * t;
    }
    if (this.onUpdate) this.onUpdate(t, this.target);
    if (raw >= 1) {
      this.done = true;
      if (this.onComplete) this.onComplete(this.target);
    }
  }
}

export class Tweens {
  constructor() {
    this.list = [];
    this.timers = [];
  }

  /**
   * Tween numeric properties on `target`.
   * Returns a promise that resolves when the tween finishes.
   */
  to(target, props, duration, opts = {}) {
    return new Promise((resolve) => {
      const tw = new Tween(target, props, duration, {
        ...opts,
        onComplete: (t) => { opts.onComplete?.(t); resolve(t); },
      });
      this.list.push(tw);
    });
  }

  /** Run `fn` after `delay` seconds (game time — pauses when the game pauses). */
  after(delay, fn) {
    const timer = { t: delay, fn, cancelled: false };
    this.timers.push(timer);
    return () => { timer.cancelled = true; };
  }

  /** Promise that resolves after `delay` seconds of game time. */
  wait(delay) {
    return new Promise((resolve) => this.after(delay, resolve));
  }

  /** Drop everything targeting `target` (or everything, if omitted). */
  cancel(target) {
    if (target === undefined) { this.list.length = 0; this.timers.length = 0; return; }
    this.list = this.list.filter((tw) => tw.target !== target);
  }

  get busy() { return this.list.length > 0; }

  step(dt) {
    for (const tw of this.list) tw.step(dt);
    if (this.list.length) this.list = this.list.filter((tw) => !tw.done);

    if (this.timers.length) {
      const due = [];
      for (const timer of this.timers) {
        if (timer.cancelled) continue;
        timer.t -= dt;
        if (timer.t <= 0) due.push(timer);
      }
      this.timers = this.timers.filter((t) => !t.cancelled && t.t > 0);
      for (const timer of due) timer.fn();
    }
  }
}

/**
 * A critically-damped-ish spring. Nicer than a tween when the target keeps moving
 * (dragging, cursor follow, values that get interrupted).
 */
export class Spring {
  constructor(value = 0, stiffness = 170, damping = 22) {
    this.value = value;
    this.target = value;
    this.velocity = 0;
    this.stiffness = stiffness;
    this.damping = damping;
  }
  set(v) { this.value = this.target = v; this.velocity = 0; }
  step(dt) {
    // Sub-step for stability if a frame hitches.
    const steps = Math.min(4, Math.ceil(dt / (1 / 90)));
    const h = dt / steps;
    for (let i = 0; i < steps; i++) {
      const a = this.stiffness * (this.target - this.value) - this.damping * this.velocity;
      this.velocity += a * h;
      this.value += this.velocity * h;
    }
    return this.value;
  }
}
