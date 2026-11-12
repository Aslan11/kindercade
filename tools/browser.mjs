/** Shared set-up for the tests that drive a real browser. */

import { createRequire } from 'node:module';
import { execFileSync } from 'node:child_process';
import { join } from 'node:path';

/* Playwright may be installed globally rather than as a local dependency. */
function loadPlaywright() {
  const require = createRequire(import.meta.url);
  try { return require('playwright'); } catch (_) { /* fall through */ }
  const globalRoot = execFileSync('npm', ['root', '-g'], { encoding: 'utf8' }).trim();
  return createRequire(join(globalRoot, 'x.js'))('playwright');
}

/** Uses the installed Google Chrome unless CHROMIUM_PATH says otherwise. */
export function launch() {
  return loadPlaywright().chromium.launch({
    ...(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : { channel: 'chrome' }),
    args: ['--autoplay-policy=no-user-gesture-required'],
  });
}

/** A page with a given save already in place, collecting errors as it goes. */
export async function openPage(browser, { width, height, save }) {
  const context = await browser.newContext({ viewport: { width, height }, locale: 'en-US', serviceWorkers: 'block' });
  const page = await context.newPage();
  page.errors = [];
  page.on('console', (m) => { if (m.type() === 'error') page.errors.push(`console: ${m.text()}`); });
  page.on('pageerror', (e) => page.errors.push(`pageerror: ${e.message}`));
  if (save) {
    await page.addInitScript((s) => {
      if (!localStorage.getItem('kindercade.save.v1')) localStorage.setItem('kindercade.save.v1', s);
    }, JSON.stringify(save));
  }
  return page;
}

/** One player with every level open and the voice off (there is nobody to hear it). */
export const veteran = (games) => ({
  voice: false,
  players: [{ buddy: 'ziggy', games: Object.fromEntries(games.map((g) => [g.id, { level: g.levels.length, levels: g.levels.map(() => 0) }])) }],
});
