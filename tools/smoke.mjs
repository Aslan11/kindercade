/**
 * Browser smoke test.
 *
 * Boots the real site in Chromium at iPad-ish dimensions, opens every game,
 * pokes at it with synthetic touches, and fails on:
 *   - any console error or uncaught exception
 *   - a canvas that renders (almost) nothing, i.e. a blank screen
 *
 * A blank screen is the failure mode that matters most here: a five-year-old
 * cannot report a stack trace.
 *
 *   node tools/smoke.mjs                 # all games
 *   node tools/smoke.mjs word-builder    # just one
 *   SHOTS=1 node tools/smoke.mjs         # also write screenshots to .smoke/
 */

import { createRequire } from 'node:module';
import { execFileSync } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { start } from './serve.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const SHOT_DIR = join(ROOT, '.smoke');
const PORT = Number(process.env.PORT) || 8123;
const WRITE_SHOTS = process.env.SHOTS === '1';

/* Playwright is installed globally in this environment, not as a local dep. */
function loadPlaywright() {
  const require = createRequire(import.meta.url);
  try { return require('playwright'); } catch (_) { /* fall through */ }
  const globalRoot = execFileSync('npm', ['root', '-g'], { encoding: 'utf8' }).trim();
  return createRequire(join(globalRoot, 'x.js'))('playwright');
}

const { chromium } = loadPlaywright();

const { GAMES } = await import('../src/games/index.js').catch(() => ({ GAMES: [] }));
const only = process.argv.slice(2).filter((a) => !a.startsWith('-'));
const targets = only.length ? GAMES.filter((g) => only.includes(g.id)) : GAMES;

/* Devices worth checking: a 4:3 iPad and a wide 16:10 window (aspect clamps). */
const VIEWPORTS = [
  { name: 'ipad', width: 1180, height: 820 },
  { name: 'wide', width: 1600, height: 860 },
];

const failures = [];
const fail = (msg) => { failures.push(msg); console.error('  ✗ ' + msg); };

const server = await start(PORT);
const base = `http://127.0.0.1:${PORT}/`;
if (WRITE_SHOTS) mkdirSync(SHOT_DIR, { recursive: true });

const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH || undefined,
  args: ['--autoplay-policy=no-user-gesture-required', '--font-render-hinting=none'],
});

/** How much of the canvas is actually painted — catches blank screens. */
const CANVAS_STATS = `(() => {
  const c = document.querySelector('#game-canvas');
  if (!c) return { ok: false, reason: 'no canvas' };
  const g = c.getContext('2d');
  const w = c.width, h = c.height;
  if (!w || !h) return { ok: false, reason: 'canvas has zero size' };
  let d;
  try { d = g.getImageData(0, 0, w, h).data; } catch (e) { return { ok: false, reason: 'getImageData: ' + e.message }; }
  const seen = new Set();
  let lum = 0, n = 0;
  for (let i = 0; i < d.length; i += 4 * 97) {
    seen.add((d[i] >> 4) + ',' + (d[i+1] >> 4) + ',' + (d[i+2] >> 4));
    lum += (d[i] + d[i+1] + d[i+2]) / 3;
    n++;
  }
  return { ok: true, colors: seen.size, meanLum: lum / n, w, h };
})()`;

for (const vp of VIEWPORTS) {
  console.log(`\n─── ${vp.name} (${vp.width}x${vp.height}) ─────────────────────────`);
  const context = await browser.newContext({
    viewport: { width: vp.width, height: vp.height },
    deviceScaleFactor: 2,
    hasTouch: true,
    locale: 'en-US',
  });
  const page = await context.newPage();

  let errors = [];
  page.on('console', (msg) => {
    if (msg.type() === 'error') errors.push(`console: ${msg.text()}`);
  });
  page.on('pageerror', (err) => errors.push(`pageerror: ${err.message}`));

  /* ---- home screen ---- */
  errors = [];
  await page.goto(base, { waitUntil: 'networkidle' });
  await page.waitForTimeout(600);
  const cardCount = await page.locator('.card').count();
  if (cardCount !== GAMES.length) fail(`[${vp.name}] home shows ${cardCount} cards, expected ${GAMES.length}`);
  else console.log(`  ✓ home: ${cardCount} game cards`);
  errors.forEach((e) => fail(`[${vp.name}] home ${e}`));
  if (WRITE_SHOTS) await page.screenshot({ path: join(SHOT_DIR, `${vp.name}-home.png`) });

  /* ---- each game ---- */
  for (const game of targets) {
    errors = [];
    await page.goto(`${base}#/play/${game.id}`, { waitUntil: 'load' });
    // Give the module time to download, boot, run entrance animations.
    await page.waitForTimeout(1500);

    let stats = await page.evaluate(CANVAS_STATS);
    if (!stats.ok) { fail(`[${vp.name}] ${game.id}: ${stats.reason}`); continue; }
    if (stats.colors < 12) fail(`[${vp.name}] ${game.id}: canvas looks blank (${stats.colors} distinct colours)`);

    // Poke around: a grid of taps across the play area, exercising buttons,
    // tiles and drag targets without knowing the layout.
    const pts = [];
    for (const fy of [0.35, 0.55, 0.78, 0.9]) {
      for (const fx of [0.2, 0.38, 0.5, 0.62, 0.8]) {
        pts.push([Math.round(vp.width * fx), Math.round(vp.height * fy)]);
      }
    }
    for (const [x, y] of pts) {
      await page.mouse.move(x, y);
      await page.mouse.down();
      await page.mouse.move(x + 2, y + 2);
      await page.mouse.up();
      await page.waitForTimeout(70);
    }
    // A drag, for the drag-and-drop games.
    await page.mouse.move(vp.width * 0.3, vp.height * 0.85);
    await page.mouse.down();
    for (let i = 1; i <= 12; i++) {
      await page.mouse.move(
        vp.width * (0.3 + 0.25 * (i / 12)),
        vp.height * (0.85 - 0.35 * (i / 12)),
      );
      await page.waitForTimeout(16);
    }
    await page.mouse.up();
    await page.waitForTimeout(900);

    stats = await page.evaluate(CANVAS_STATS);
    if (!stats.ok) fail(`[${vp.name}] ${game.id}: after input, ${stats.reason}`);
    else if (stats.colors < 12) fail(`[${vp.name}] ${game.id}: canvas blank after input`);

    // The loop must still be alive: two samples a frame apart should differ
    // somewhere, because everything in this arcade animates.
    const alive = await page.evaluate(async () => {
      const c = document.querySelector('#game-canvas');
      const g = c.getContext('2d');
      const grab = () => Array.from(g.getImageData(0, 0, Math.min(c.width, 400), Math.min(c.height, 300)).data
        .filter((_, i) => i % 401 === 0));
      const a = grab();
      await new Promise((r) => setTimeout(r, 260));
      const b = grab();
      return a.some((v, i) => v !== b[i]);
    });
    if (!alive) fail(`[${vp.name}] ${game.id}: render loop appears frozen`);

    errors.forEach((e) => fail(`[${vp.name}] ${game.id} ${e}`));
    if (!errors.length && stats.ok && stats.colors >= 12 && alive) {
      console.log(`  ✓ ${game.id} (${stats.colors} colours, animating)`);
    }
    if (WRITE_SHOTS) await page.screenshot({ path: join(SHOT_DIR, `${vp.name}-${game.id}.png`) });
  }

  await context.close();
}

await browser.close();
server.close();

console.log('');
if (failures.length) {
  console.error(`✗ ${failures.length} smoke failure(s)`);
  process.exit(1);
}
console.log(`✓ smoke passed: home + ${targets.length} games across ${VIEWPORTS.length} viewports`);
