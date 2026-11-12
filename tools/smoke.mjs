/**
 * Browser smoke test.
 *
 * Boots the real site, walks a brand-new child through picking a buddy, opens
 * every game at several screen shapes, mashes it the way a toddler would, and
 * fails on:
 *   - any console error or uncaught exception
 *   - a canvas that renders (almost) nothing, or has stopped moving
 *
 * A blank screen is the failure mode that matters most here: a five-year-old
 * cannot report a stack trace.
 *
 *   node tools/smoke.mjs                 # all games
 *   node tools/smoke.mjs word-builder    # just one
 *   SHOTS=1 node tools/smoke.mjs         # also write screenshots to .smoke/
 */

import { mkdirSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { start } from './serve.mjs';
import { launch, openPage, veteran } from './browser.mjs';
import { GAMES } from '../src/games/index.js';

const SHOT_DIR = join(resolve(dirname(fileURLToPath(import.meta.url)), '..'), '.smoke');
const PORT = Number(process.env.PORT) || 8123;
const WRITE_SHOTS = process.env.SHOTS === '1';

const only = process.argv.slice(2);
const targets = only.length ? GAMES.filter((g) => only.includes(g.id)) : GAMES;

const VIEWPORTS = [
  { name: 'ipad', width: 885, height: 615 },
  { name: 'phone', width: 844, height: 390 },
  { name: 'upright', width: 540, height: 720 },
];

const failures = [];
const fail = (msg) => { failures.push(msg); console.error('  ✗ ' + msg); };

const server = await start(PORT);
const base = `http://127.0.0.1:${PORT}/`;
if (WRITE_SHOTS) mkdirSync(SHOT_DIR, { recursive: true });
const browser = await launch();

/** Runs in the page: how many colours are on screen, and do they change? */
async function canvasStats() {
  const { engine } = window.kindercade;
  const small = Object.assign(document.createElement('canvas'), { width: 96, height: 64 });
  const g = small.getContext('2d', { willReadFrequently: true });
  const grab = () => {
    engine.render();      // a WebGL canvas can only be read in the task that drew it
    g.drawImage(engine.canvas, 0, 0, 96, 64);
    return g.getImageData(0, 0, 96, 64).data;
  };
  const a = grab();
  await new Promise((r) => setTimeout(r, 700));
  const b = grab();
  const seen = new Set();
  for (let i = 0; i < a.length; i += 4) seen.add(`${a[i] >> 4},${a[i + 1] >> 4},${a[i + 2] >> 4}`);
  return { colors: seen.size, alive: a.some((v, i) => v !== b[i]), id: engine.game?.meta.id };
}

/* ---- first launch, a second child, and a save from the old sticker-book days ---- */
{
  console.log('\n─── players ─────────────────────────');
  const page = await openPage(browser, { width: 885, height: 615 });
  await page.goto(base);
  for (const [buddy, age] of [['Momo', '3'], ['Bolt', '5']]) {
    await page.locator('.pick', { hasText: buddy }).click();
    await page.locator('.pick.age', { hasText: age }).click();
    await page.waitForSelector('#overlay', { state: 'hidden' });
    await page.waitForSelector('#wipe:not(.shut)', { state: 'attached' });
    const level = await page.evaluate(() => window.kindercade.progress.levelFor('see-saw'));
    if (level !== (age === '3' ? 1 : 2)) fail(`a ${age}-year-old starts on level ${level}`);
    await page.click('#who-btn');
    if (buddy === 'Momo') await page.click('.pick.add');
  }
  if (await page.locator('.pick:not(.add)').count() !== 2) fail('the second player was not added');
  await page.click('#sheet-close');
  for (const btn of ['#toy-btn', '#settings-btn']) { await page.click(btn, { delay: 1500 }); await page.click('#sheet-close'); }
  await page.click('[data-game="see-saw"]');
  await page.waitForFunction(() => window.kindercade.game?.meta.id === 'see-saw');
  await page.click('#hud-home');
  await page.waitForFunction(() => window.kindercade.game?.meta.id === 'home');
  page.errors.forEach((e) => fail(`players ${e}`));
  await page.context().close();

  const old = await openPage(browser, {
    width: 885, height: 615,
    save: { sound: false, stickers: ['panda', 'carousel'], totalStars: 5, games: { 'balloon-math': { stars: 3, plays: 4, level: 2 } } },
  });
  await old.goto(base);
  await old.waitForFunction(() => window.kindercade?.game);
  const kept = await old.evaluate(() => {
    const { progress: p } = window.kindercade;
    return { toys: p.toys, level: p.levelFor('balloon-math'), stars: p.starsFor('balloon-math'), voice: p.voice || p.music };
  });
  if (kept.toys.length !== 2 || kept.toys[0] !== 'panda' || kept.level !== 3 || kept.stars !== 3 || kept.voice) fail(`old save migrated badly: ${JSON.stringify(kept)}`);
  old.errors.forEach((e) => fail(`migration ${e}`));
  await old.context().close();
  if (!failures.length) console.log('  ✓ new players, switching, sheets and save migration');
}

await Promise.all(VIEWPORTS.map(async (vp) => {
  const page = await openPage(browser, { ...vp, save: veteran(GAMES) });
  await page.goto(base);
  await page.waitForFunction(() => window.kindercade?.game);
  await page.waitForTimeout(1200);
  const cards = await page.locator('.card').evaluateAll((els) => els.filter((el) => {
    const r = el.querySelector('.card-label').getBoundingClientRect();
    return r.left >= 0 && r.top >= 0 && r.right <= innerWidth && r.bottom <= innerHeight;
  }).length);
  if (cards !== GAMES.length) fail(`[${vp.name}] home shows ${cards} cards on screen, expected ${GAMES.length}`);
  if (WRITE_SHOTS) await page.screenshot({ path: join(SHOT_DIR, `${vp.name}-home.png`) });

  for (const game of targets) {
    page.errors.length = 0;
    await page.evaluate((id) => { location.hash = `#/play/${id}/2`; }, game.id);
    await page.waitForFunction((id) => window.kindercade.game?.meta.id === id && !window.kindercade.game.busy, game.id, { timeout: 60000 })
      .catch(() => fail(`[${vp.name}] ${game.id}: never became playable`));
    if (WRITE_SHOTS) await page.screenshot({ path: join(SHOT_DIR, `${vp.name}-${game.id}.png`) });

    // Mash: a grid of taps below the HUD, then a drag from nowhere to nowhere.
    for (const fy of [0.35, 0.55, 0.75, 0.9]) {
      for (const fx of [0.12, 0.3, 0.5, 0.7, 0.88]) await page.mouse.click(vp.width * fx, vp.height * fy);
    }
    await page.mouse.move(vp.width * 0.4, vp.height * 0.85);
    await page.mouse.down();
    await page.mouse.move(vp.width * 0.6, vp.height * 0.4, { steps: 8 });
    await page.mouse.up();
    if (await page.locator('#hud-speak').isVisible()) await page.click('#hud-speak');
    await page.waitForTimeout(600);

    const stats = await page.evaluate(canvasStats);
    if (stats.id !== game.id) fail(`[${vp.name}] ${game.id}: crashed out to "${stats.id}"`);
    else if (stats.colors < 24) fail(`[${vp.name}] ${game.id}: canvas looks blank (${stats.colors} colours)`);
    else if (!stats.alive) fail(`[${vp.name}] ${game.id}: render loop appears frozen`);
    else if (!page.errors.length) console.log(`  ✓ [${vp.name}] ${game.id} (${stats.colors} colours, animating)`);
    page.errors.forEach((e) => fail(`[${vp.name}] ${game.id} ${e}`));
  }
  await page.context().close();
}));

await browser.close();
server.close();

console.log('');
if (failures.length) {
  console.error(`✗ ${failures.length} smoke failure(s)`);
  process.exit(1);
}
console.log(`✓ smoke passed: home + ${targets.length} games across ${VIEWPORTS.length} viewports`);
