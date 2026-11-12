/**
 * Robot Road's puzzles, fuzzed without a browser.
 *
 * Every board must be winnable in its slots; a planted bug must really lose and
 * be a few taps from fixed; numbers must be needed where numbers are taught;
 * and from any muddle a child can make, following the hint must lead home.
 */

import { Puzzle, LEVELS, DIRS, MAX_TIMES } from '../src/data/robot.js';
import { pick, randInt } from '../src/core/util.js';

const ROUNDS = 5, BOARDS = Number(process.env.BOARDS) || 12, MUDDLES = 6;
const problems = new Set();

/** The same edits the game makes when these things are tapped. */
function apply(puzzle, p, move) {
  const turn = (n) => (n % MAX_TIMES) + 1;
  if (move.press) {
    const grow = puzzle.merges(p.chips, move.press, p.latest), at = puzzle.cursor(p.chips);
    if (grow) grow.n = Math.min(MAX_TIMES, grow.n + 1);
    else if (at >= 0) p.chips[at] = p.latest = { dir: move.press, n: 1 };
  } else if (move.remove) {
    p.chips[p.chips.indexOf(move.remove)] = p.latest = null;
    while (p.chips.length && !p.chips[p.chips.length - 1]) p.chips.pop();
  } else if (move.close) p.chips.splice(p.chips.indexOf(null), 1);
  else if (move.turn) move.turn.n = turn(move.turn.n);
  else if (move.lap) p.laps = turn(p.laps);
}

LEVELS.forEach((cfg, i) => {
  const note = (m) => problems.add(`level ${i + 1}: ${m}`);
  for (let b = 0; b < BOARDS * ROUNDS; b++) {
    const puzzle = new Puzzle(cfg, b % ROUNDS, ROUNDS);
    if (!puzzle.answers.length) { note('a board has no answer'); continue; }
    if (cfg.loop && puzzle.answers.some((a) => a.laps === 1)) note('a board can be won without looping');
    if (cfg.repeat && puzzle.answers.some((a) => a.chips.every((c) => c.n === 1))) note('a board can be won without a number');
    if (cfg.bug && puzzle.run(puzzle.given).won) note('the broken program works');
    if (cfg.bug && puzzle.nearest(puzzle.given).taps > (cfg.repeat ? MAX_TIMES - 1 : 2)) note('the bug takes more than one fix');

    for (let k = 0; k < MUDDLES; k++) {
      const p = { chips: puzzle.given.chips.map((c) => ({ ...c })), laps: 1, latest: null };
      for (let n = randInt(0, 14); n > 0; n--) {
        const some = pick(p.chips.filter(Boolean));
        apply(puzzle, p, pick([
          ...(cfg.fixed ? [] : [{ press: pick(DIRS) }, { press: pick(DIRS) }, some && { remove: some }, p.chips.includes(null) && { close: true }]),
          cfg.repeat && some && { turn: some }, cfg.loop && { lap: true },
        ].filter(Boolean)));
      }
      let budget = puzzle.nearest(p).taps, move;
      while (!(move = puzzle.advice(p)).go && budget-- > 0) {
        if (cfg.fixed && !move.turn) note('a hint points at something that cannot be touched');
        apply(puzzle, p, move);
      }
      if (!move.go) note('following the hints does not lead home');
      if (p.chips.length > puzzle.slots) note('the hints overfill the row');
    }
  }
});

if (problems.size) {
  problems.forEach((p) => console.error('  ✗ ' + p));
  process.exit(1);
}
console.log(`✓ ${LEVELS.length * BOARDS * ROUNDS} robot boards are fair, and the hints always lead home`);
