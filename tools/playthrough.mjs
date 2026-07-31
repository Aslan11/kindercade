/**
 * Plays each game through to the end.
 *
 * The tap-based smoke test never reaches a finished round, so this drives the
 * games from the inside — answering correctly via the debug handle — to prove
 * that scoring, the results panel, star awarding and the level unlock all
 * actually work. That last screen is the payoff for the child; it should not be
 * the least-tested part of the app.
 *
 *   node tools/playthrough.mjs            # all games
 *   SHOTS=1 node tools/playthrough.mjs    # keep the results screenshots
 */

import { createRequire } from 'node:module';
import { execFileSync } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { start } from './serve.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const SHOT_DIR = join(ROOT, '.smoke');
const PORT = Number(process.env.PORT) || 8124;
const WRITE_SHOTS = process.env.SHOTS === '1';

function loadPlaywright() {
  const require = createRequire(import.meta.url);
  try { return require('playwright'); } catch (_) { /* fall through */ }
  const globalRoot = execFileSync('npm', ['root', '-g'], { encoding: 'utf8' }).trim();
  return createRequire(join(globalRoot, 'x.js'))('playwright');
}
const { chromium } = loadPlaywright();

/**
 * How to answer one question, per game — expressed against the live game object
 * so it stays honest if the internals change (a broken solver fails loudly).
 * Each returns true while there is still work to do.
 */
const SOLVERS = {
  'counting-critters': (g) => { g.answer(g.count); return true; },
  'balloon-math': (g) => {
    const b = g.balloons.find((x) => x.value === g.sum.answer && !x.popped);
    if (b) g.pop(b);
    return !!b;
  },
  'cookie-kitchen': (g) => {
    let guard = 0;
    while (g.filled < g.target && guard++ < 40) {
      const c = g.cookies.find((x) => x.slot < 0);
      if (!c) break;
      const slot = g.slots.findIndex((_, i) => !g.cookies.some((o) => o.slot === i));
      if (slot < 0) break;
      c.slot = slot;
    }
    g.refreshBake();
    g.bake();
    return true;
  },
  'sound-safari': (g) => { g.choose(g.answer); return true; },
  'word-builder': (g) => {
    let guard = 0;
    while (g.slots.some((s) => !s.tile) && guard++ < 12) {
      const slot = g.slots.find((s) => !s.tile);
      const tile = g.tiles.find((t) => t.slot < 0 && t.letter === slot.letter);
      if (!tile) break;
      tile.x = slot.x + slot.w / 2;
      tile.y = slot.y + slot.h / 2;
      g.dropTile(tile);
    }
    return true;
  },
  'letter-trace': (g) => { g.coverage = 1; g.complete(); return true; },
  'memory-match': (g) => {
    const a = g.cards.find((c) => !c.matched);
    if (!a) return false;
    const b = g.cards.find((c) => c !== a && !c.matched && c.key === a.key);
    if (!b) return false;
    g.reveal(a);
    g.reveal(b);
    return true;
  },
  'pattern-party': (g) => {
    const i = g.choices.findIndex((c) => g.sameToken(c, g.answer));
    if (i < 0) return false;
    g.choose(i);
    return true;
  },
  'jigsaw-garden': (g) => {
    const p = g.pieces.find((x) => !x.locked);
    if (!p) return false;
    p.x = p.homeX;
    p.y = p.homeY;
    g.dropPiece(p);
    return true;
  },
};

const { GAMES } = await import('../src/games/index.js');
const only = process.argv.slice(2).filter((a) => !a.startsWith('-'));
const targets = only.length ? GAMES.filter((g) => only.includes(g.id)) : GAMES;

const server = await start(PORT);
const base = `http://127.0.0.1:${PORT}/`;
if (WRITE_SHOTS) mkdirSync(SHOT_DIR, { recursive: true });

const browser = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required'] });
const context = await browser.newContext({
  viewport: { width: 1180, height: 820 }, deviceScaleFactor: 2, hasTouch: true, locale: 'en-US',
});
const page = await context.newPage();

const failures = [];
const fail = (m) => { failures.push(m); console.error('  ✗ ' + m); };

let errors = [];
page.on('console', (m) => { if (m.type() === 'error') errors.push(`console: ${m.text()}`); });
page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));

for (const entry of targets) {
  errors = [];
  await page.goto(`${base}#/play/${entry.id}`, { waitUntil: 'load' });
  await page.waitForFunction(() => window.kindercade?.game, null, { timeout: 8000 }).catch(() => {});
  await page.waitForTimeout(900);

  const solver = SOLVERS[entry.id];
  if (!solver) { fail(`${entry.id}: no solver defined`); continue; }

  // Answer, wait for the game's own animation gap, repeat. The bound is
  // wall-clock rather than steps, because the games with long spoken feedback
  // (phonics especially) legitimately dwell for seconds between rounds.
  const deadline = Date.now() + 120000;
  let steps = 0;
  let finished = false;
  while (Date.now() < deadline) {
    steps++;
    const state = await page.evaluate(`(() => {
      const g = window.kindercade.game;
      if (!g) return { gone: true };
      if (g.results?.visible) return { done: true, stars: g.results.stars, title: g.results.title };
      if (g.busy) return { busy: true };
      return { ready: true };
    })()`);
    if (state.gone) { fail(`${entry.id}: game vanished mid-round`); break; }
    if (state.done) {
      finished = true;
      console.log(`  ✓ ${entry.id} finished in ${steps} steps — ${state.stars}★ "${state.title}"`);
      break;
    }
    if (state.ready) {
      const ok = await page.evaluate(`(${solver.toString()})(window.kindercade.game)`);
      if (ok === false) { await page.waitForTimeout(400); }
    }
    await page.waitForTimeout(500);
  }

  if (!finished) fail(`${entry.id}: never reached the results panel (${steps} steps, timed out)`);
  else if (WRITE_SHOTS) {
    await page.waitForTimeout(1600);   // let the stars land
    await page.screenshot({ path: join(SHOT_DIR, `results-${entry.id}.png`) });
  }

  // A finished round must have banked stars.
  const stars = await page.evaluate(`window.kindercade.progress.starsFor(${JSON.stringify(entry.id)})`);
  if (finished && !(stars > 0)) fail(`${entry.id}: finished but recorded ${stars} stars`);

  errors.forEach((e) => fail(`${entry.id} ${e}`));
}

const total = await page.evaluate('window.kindercade.progress.totalStars');
const stickers = await page.evaluate('window.kindercade.progress.stickers.length');
console.log(`\n  total stars: ${total}, stickers unlocked: ${stickers}`);
if (targets.length === GAMES.length && !(total > 0)) fail('no stars were recorded at all');

await browser.close();
server.close();

console.log('');
if (failures.length) {
  console.error(`✗ ${failures.length} playthrough failure(s)`);
  process.exit(1);
}
console.log(`✓ played ${targets.length} game(s) through to the results screen`);
