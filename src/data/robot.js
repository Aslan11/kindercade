/**
 * Robot Road's puzzles, with no graphics attached so they can be tested alone.
 *
 * A *program* is a row of slots, each an arrow `{ dir, n }` ("go `dir`, `n`
 * times") or `null` for a gap, and `laps`: how many times the whole row runs.
 */

import { pick, randInt, range, sample, chance } from '../core/util.js';

export const DIRS = [
  { name: 'left', dx: -1, dz: 0 },
  { name: 'up', dx: 0, dz: -1 },
  { name: 'down', dx: 0, dz: 1 },
  { name: 'right', dx: 1, dz: 0 },
];
/** The biggest number on a repeat or loop dial; one more tap wraps round to 1. */
export const MAX_TIMES = 5;

/**
 *   drive   arrows move the robot at once
 *   key     the key must be fetched before the present opens
 *   repeat  every arrow has a number; `legs` is how many arrows each round needs
 *   loop    the whole row runs several times, along a causeway
 *   bug     the round starts with a program that is nearly right
 *   fixed   the arrows cannot be changed, only their numbers
 * Once numbers are in play the robot has to *stop* on the prize: otherwise the
 * biggest number would always do.
 */
export const LEVELS = [
  { cols: 4, rows: 3, rocks: 0, steps: [2, 3], drive: true },
  { cols: 5, rows: 3, rocks: 1, steps: [2, 4] },
  { cols: 5, rows: 4, rocks: 4, steps: [4, 6] },
  { cols: 5, rows: 4, rocks: 3, steps: [5, 8], key: true },
  { cols: 5, rows: 4, rocks: 4, steps: [3, 6], bug: ['wrong', 'wrong', 'extra', 'wrong', 'wrong'] },
  { cols: 6, rows: 4, rocks: 5, steps: [3, 9], repeat: true, legs: [1, 2, 2, 3, 3] },
  { cols: 6, rows: 4, rocks: 5, steps: [4, 10], repeat: true, fixed: true, legs: [2, 2, 3, 3, 4], bug: ['number', 'number', 'number', 'number', 'number'] },
  { cols: 7, rows: 4, loop: true },
];

/** Loop shapes for each round, as [pattern, laps]; mirrored at random. */
const LOOPS = [
  [['ru', 2], ['ur', 2]],
  [['ru', 3], ['ur', 3]],
  [['rru', 2], ['urr', 2]],
  [['rur', 2], ['rrru', 2], ['urrr', 2]],
  [['rru', 3], ['urr', 3], ['rur', 3]],
];

export const same = (a, b) => a.x === b.x && a.z === b.z;
const step = (at, dir) => ({ x: at.x + dir.dx, z: at.z + dir.dz });
const dial = (from, to) => (to - from + MAX_TIMES) % MAX_TIMES;     // taps to turn a dial

export class Puzzle {
  /** @param {object} cfg one of LEVELS */
  constructor(cfg, round, rounds) {
    Object.assign(this, cfg);
    this.exact = !!(cfg.repeat || cfg.loop);
    this.slots = cfg.repeat ? 4 : 8;
    if (cfg.loop) this.layCauseway(round); else this.scatter(round, rounds);
    this.given = { chips: [], laps: 1 };
    if (cfg.bug) this.plantBug(this.fault = cfg.bug[round], round < 2);
  }

  blocked(c) { return c.x < 0 || c.z < 0 || c.x >= this.cols || c.z >= this.rows || this.walls.has(c.z * this.cols + c.x); }

  /**
   * Play a program. `moves` lists every step, ending with the bump if there is
   * one; `passed` is the step that left the prize behind.
   */
  run({ chips, laps = 1 }) {
    const moves = [];
    let at = this.start, key = !this.key, passed = null;
    for (let lap = 0; lap < laps; lap++) {
      for (const chip of chips) {
        for (let i = 0; chip && i < chip.n; i++) {
          const to = step(at, chip.dir), bump = this.blocked(to);
          const move = { chip, lap, count: i + 1, from: at, to, bump };
          moves.push(move);
          if (this.exact && !passed && same(at, this.goal)) passed = move;
          if (bump) return { moves, passed, bumped: chip, won: false };
          at = to;
          key = key || same(at, this.keyAt);
          if (!this.exact && key && same(at, this.goal)) return { moves, won: true };
        }
      }
    }
    return { moves, passed, keyless: same(at, this.goal) && !key, won: same(at, this.goal) && key };
  }

  /* ------------------------------------------------------------- setting up */

  /** Fewest single steps between two cells. */
  distance(from, to) {
    const queue = [[from, 0]], seen = new Set([from.z * this.cols + from.x]);
    for (const [at, d] of queue) {
      if (same(at, to)) return d;
      for (const dir of DIRS) {
        const n = step(at, dir), id = n.z * this.cols + n.x;
        if (this.blocked(n) || seen.has(id)) continue;
        seen.add(id);
        queue.push([n, d + 1]);
      }
    }
    return Infinity;
  }

  /** Throw rocks about until the journey is the right length for this round. */
  scatter(round, rounds) {
    const { cols, rows, steps: [lo, hi] } = this;
    const want = Math.min(hi, lo + Math.floor(round * (hi - lo + 1) / rounds) + randInt(0, 1));
    for (;;) {
      const cells = sample(range(cols * rows), this.rocks + 3);
      [this.start, this.goal, this.keyAt] = cells.map((i) => ({ x: i % cols, z: Math.floor(i / cols) }));
      this.walls = new Set(cells.slice(3));
      const far = this.key ? this.distance(this.start, this.keyAt) + this.distance(this.keyAt, this.goal) : this.distance(this.start, this.goal);
      if (this.repeat ? far < Math.max(lo, this.legs[round] + 2) || far > hi : far !== want) continue;
      this.answers = this.solve();
      if (!this.repeat) return;
      // The direct way needs exactly this many arrows, no detour needs fewer, and nothing dodges the numbers.
      const legs = Math.min(...this.answers.map((a) => a.chips.length));
      if (legs === this.legs[round] && this.best().chips.length === legs && this.answers.every((a) => a.chips.some((c) => c.n > 1))) return;
    }
  }

  /** A path in a repeating shape, with water everywhere else. */
  layCauseway(round) {
    const [pattern, laps] = pick(LOOPS[round]);
    const flipX = chance(0.4), flipZ = chance(0.5);
    const letter = { r: DIRS[flipX ? 0 : 3], u: DIRS[flipZ ? 2 : 1] };
    const path = [{ x: 0, z: 0 }];
    for (const c of pattern.repeat(laps)) path.push(step(path[path.length - 1], letter[c]));
    const shift = (axis, size) => {
      const lo = Math.min(...path.map((p) => p[axis])), hi = Math.max(...path.map((p) => p[axis]));
      const by = randInt(0, size - 1 - (hi - lo)) - lo;
      path.forEach((p) => { p[axis] += by; });
    };
    shift('x', this.cols);
    shift('z', this.rows);
    this.walls = new Set(range(this.cols * this.rows));
    path.forEach((p) => this.walls.delete(p.z * this.cols + p.x));
    this.start = path[0];
    this.goal = path[path.length - 1];
    this.slots = pattern.length;
    this.answers = this.solve();
  }

  /** Every program that fits in the slots and wins. */
  solve() {
    const found = [];
    const grow = (chips, at, key) => {
      if (this.loop) {
        for (let laps = 1; chips.length && laps <= MAX_TIMES; laps++) if (this.run({ chips, laps }).won) found.push({ chips, laps });
      } else if (key && same(at, this.goal)) {
        found.push({ chips, laps: 1 });
        return;
      }
      const left = this.slots - chips.length;
      if (!left) return;
      if (!this.exact && Math.abs(at.x - this.goal.x) + Math.abs(at.z - this.goal.z) > left) return;
      for (const dir of DIRS) {
        if (this.repeat && dir === chips[chips.length - 1]?.dir) continue;      // that is just a bigger number
        let to = at, got = key;
        for (let n = 1; n <= (this.repeat ? MAX_TIMES : 1); n++) {
          to = step(to, dir);
          if (this.blocked(to)) break;
          got = got || same(to, this.keyAt);
          grow([...chips, { dir, n }], to, got);
        }
      }
    };
    grow([], this.start, !this.key);
    return found;
  }

  /** The neatest answer from a standing start. */
  best() { return this.nearest({ chips: [], laps: 1 }).answer; }

  /**
   * Take a good program and break it. An `obvious` bug stops the robot at the
   * very arrow that is wrong; later ones only show further down the road.
   */
  plantBug(fault, obvious) {
    const good = this.best().chips;
    const broken = range(good.length).flatMap((i) => {
      const swap = (drop, chip) => ({ culprit: chip, chips: [...good.slice(0, i), chip, ...good.slice(i + drop)] });
      if (fault === 'number') return range(MAX_TIMES).filter((k) => k + 1 !== good[i].n).map((k) => swap(1, { ...good[i], n: k + 1 }));
      return DIRS.filter((dir) => dir !== good[i].dir).map((dir) => swap(fault === 'extra' ? 0 : 1, { dir, n: 1 }));
    }).filter((p) => !this.run(p).won);
    const fitting = broken.filter((p) => (this.run(p).bumped === p.culprit) === obvious);
    this.given = { chips: pick(fitting.length ? fitting : broken).chips, laps: 1 };
    // No spare slots: the way forward is to mend the row, not to add to it.
    this.slots = this.given.chips.length;
    const fits = (a) => (this.fixed ? a.chips.length === this.slots && a.chips.every((c, i) => c.dir === good[i].dir) : a.chips.length <= this.slots);
    this.answers = this.answers.filter(fits);
  }

  /* ---------------------------------------------------------------- editing */

  /** The slot the next arrow will drop into: the first gap, else the end. -1 when full. */
  cursor(chips) {
    const gap = chips.indexOf(null);
    return gap >= 0 ? gap : chips.length < this.slots ? chips.length : -1;
  }

  /**
   * On repeat levels, pressing the same way twice turns up that arrow's number
   * rather than using another slot. Returns the arrow to turn up, if any.
   */
  merges(chips, dir, latest) {
    if (!this.repeat) return null;
    const at = this.cursor(chips);
    const chip = at < 0 ? latest : chips[at - 1];
    return chip?.dir === dir ? chip : null;
  }

  /**
   * The winning program fewest taps away from this one, and the first of those
   * taps. Each slot is kept, replaced or dropped, left to right, so following
   * the advice always gets one tap nearer.
   */
  nearest({ chips, laps }) {
    const m = chips.length;
    // Taps to make slot c into arrow w (an arrow already pointing the right way only needs its dial turning).
    const fit = (c, w) => (!c ? w.n : c.dir === w.dir ? dial(c.n, w.n) : 1 + w.n);
    const drop = (c) => (this.fixed ? Infinity : c ? 2 : 1);        // take it out, close the gap
    let best = null;
    for (const answer of this.answers) {
      const want = answer.chips, n = want.length;
      // cost[i][j]: taps to turn chips[i..] into want[j..]
      const cost = range(m + 1).map(() => new Array(n + 1).fill(0));
      for (let j = n - 1; j >= 0; j--) cost[m][j] = want[j].n + cost[m][j + 1];
      for (let i = m - 1; i >= 0; i--) {
        for (let j = n; j >= 0; j--) cost[i][j] = Math.min(drop(chips[i]) + cost[i + 1][j], j < n ? fit(chips[i], want[j]) + cost[i + 1][j + 1] : Infinity);
      }
      const taps = cost[0][0] + dial(laps, answer.laps);
      if (!best || taps < best.taps || (taps === best.taps && n < best.answer.chips.length)) best = { taps, answer, cost };
    }
    const { taps, answer, cost } = best;
    const first = () => {
      for (let i = 0; ; i++) {
        const c = chips[i], w = answer.chips[i];
        if (i >= m) return w ? { press: w.dir } : { lap: true };
        const fits = w && fit(c, w) + cost[i + 1][i + 1] === cost[i][i];
        if (!c) return fits ? { press: w.dir } : { close: true };
        if (!fits || c.dir !== w.dir) return { remove: c };
        if (c.n !== w.n) return { turn: c };
      }
    };
    return { taps, answer, move: first() };
  }

  /** What to tap next. */
  advice(program) { return this.run(program).won ? { go: true } : this.nearest(program).move; }
}
