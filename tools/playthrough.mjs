/**
 * Plays every level of every game through to the prize screen.
 *
 * Each game knows its own right answer (`solution()` — it is what the hint
 * glove points at), so this asks where that is on screen and then really taps
 * or drags there with the mouse. A target that is off screen, hidden under the
 * HUD or shadowed by a neighbour fails here rather than in a lap. The first
 * question of each run is fumbled twice on purpose, to exercise the
 * "not quite" path too.
 *
 *   node tools/playthrough.mjs                  # everything
 *   node tools/playthrough.mjs see-saw frog-hop/3
 *   SHOTS=1 node tools/playthrough.mjs          # keep the results screenshots
 */

import { mkdirSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { start } from './serve.mjs';
import { launch, openPage, veteran } from './browser.mjs';
import { GAMES } from '../src/games/index.js';

const SHOT_DIR = join(resolve(dirname(fileURLToPath(import.meta.url)), '..'), '.smoke');
const PORT = Number(process.env.PORT) || 8124;
const WRITE_SHOTS = process.env.SHOTS === '1';
const LANES = Number(process.env.LANES) || 3;

const only = process.argv.slice(2);
const runs = GAMES.flatMap((g) => g.levels.map((_, i) => `${g.id}/${i + 1}`))
  .filter((r) => !only.length || only.some((o) => r === o || r.startsWith(`${o}/`)));

const server = await start(PORT);
const browser = await launch();
if (WRITE_SHOTS) mkdirSync(SHOT_DIR, { recursive: true });
const failures = [];
const fail = (m) => { failures.push(m); console.error('  ✗ ' + m); };

/** Runs in the page: what should a finger do now? */
function nextMove(fumble) {
  const { game: g, engine } = window.kindercade;
  if (!g || g.meta.id === 'home') return { gone: true };
  if (g.results?.ready) return { done: true, stars: g.results.stars, mistakes: g.mistakes };
  const px = (t) => engine.client(g.at(t));
  if (g.results?.gift) return { path: [px(g.results.gift)] };
  if (g.busy) return {};
  const move = g.solution();
  if (!move) return {};
  const wrong = fumble && g.choices?.find((c) => c !== move.tap);
  const path = wrong ? [px(wrong)] : (move.drag || [move.tap]).map(px);
  const under = document.elementFromPoint(path[0].x, path[0].y);
  return { path, fumbled: !!wrong, blocked: under?.id !== 'game-canvas' && (under?.id || under?.className || 'off screen') };
}

async function play(run) {
  // The narrowest shape we support: if it is reachable at 4:3 it is reachable anywhere.
  const page = await openPage(browser, { width: 640, height: 480, save: veteran(GAMES) });
  await page.goto(`http://127.0.0.1:${PORT}/#/play/${run}`);
  await page.waitForFunction(() => window.kindercade?.game, null, { timeout: 30000 });
  // Fast-forward, and draw only now and then: software GL is the slow part.
  await page.evaluate(() => {
    const { engine } = window.kindercade;
    const render = engine.render.bind(engine);
    let frame = 0;
    engine.render = () => { if (frame++ % 20 === 0) render(); };
    engine.timeScale = 5;
  });

  const deadline = Date.now() + 240000;
  let fumbles = 0, moves = 0, result = null;
  while (Date.now() < deadline && !page.errors.length) {
    const m = await page.evaluate(nextMove, fumbles < 2);
    if (m.gone) { fail(`${run}: fell back to the home screen`); break; }
    if (m.done) { result = m; break; }
    if (m.blocked) { fail(`${run}: the next thing to touch is under "${m.blocked}"`); break; }
    if (m.path) {
      if (m.fumbled) fumbles++;
      moves++;
      await page.mouse.move(m.path[0].x, m.path[0].y);
      await page.mouse.down();
      for (const p of m.path.slice(1)) await page.mouse.move(p.x, p.y, { steps: m.path.length > 2 ? 1 : 5 });
      await page.mouse.up();
    }
    await page.waitForTimeout(120);
  }

  page.errors.forEach((e) => fail(`${run} ${e}`));
  if (result) {
    const [id, level] = run.split('/');
    const saved = await page.evaluate(([i, l]) => {
      const { progress } = window.kindercade;
      return { stars: progress.starsFor(i, l), toys: progress.toys.length };
    }, [id, Number(level)]);
    if (result.mistakes !== fumbles) fail(`${run}: ${result.mistakes} mistakes counted, but only ${fumbles} were made`);
    else if (saved.stars !== result.stars) fail(`${run}: showed ${result.stars}★ but saved ${saved.stars}★`);
    else if (saved.toys !== 1) fail(`${run}: the first game should end in a present`);
    else console.log(`  ✓ ${run} — ${moves} moves, ${result.stars}★`);
    if (WRITE_SHOTS) await page.screenshot({ path: join(SHOT_DIR, `results-${id}-${level}.png`) });
  } else if (!page.errors.length && Date.now() >= deadline) {
    fail(`${run}: never reached the prize screen (${moves} moves)`);
    await page.screenshot({ path: join(SHOT_DIR, `stuck-${run.replace('/', '-')}.png`) });
  }
  await page.context().close();
}

const queue = [...runs];
await Promise.all(Array.from({ length: LANES }, async () => { while (queue.length) await play(queue.shift()); }));
await browser.close();
server.close();

console.log('');
if (failures.length) {
  console.error(`✗ ${failures.length} playthrough failure(s)`);
  process.exit(1);
}
console.log(`✓ played ${runs.length} level(s) through to the prize screen`);
