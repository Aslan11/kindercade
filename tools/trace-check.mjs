/**
 * Handwriting check for Letter Trace.
 *
 * The other suites prove the game runs; this one proves it can be *played*, for
 * every one of the sixty-two glyphs, and that it cannot be cheated. Both halves
 * matter and they pull in opposite directions: loosen the tolerances until a
 * three-year-old's wobble always registers and scribbling starts to work again;
 * tighten them until scribbling is dead and a `W` becomes untraceable. A stroke
 * path that is too cramped for a fingertip fails here rather than in a lap.
 *
 *   node tools/trace-check.mjs
 */

import { createRequire } from 'node:module';
import { execFileSync } from 'node:child_process';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { start } from './serve.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const PORT = Number(process.env.PORT) || 8125;

function loadPlaywright() {
  const require = createRequire(import.meta.url);
  try { return require('playwright'); } catch (_) { /* fall through */ }
  const globalRoot = execFileSync('npm', ['root', '-g'], { encoding: 'utf8' }).trim();
  return createRequire(join(globalRoot, 'x.js'))('playwright');
}
const { chromium } = loadPlaywright();

/** Finger wobble in logical pixels, and how coarsely the drag is sampled. */
const JITTER = 18;
const SAMPLES = [60, 24, 12];

const failures = [];
const fail = (msg) => { failures.push(msg); console.error('  ✗ ' + msg); };

const server = await start(PORT);
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined });
const page = await browser.newPage({ viewport: { width: 1180, height: 820 }, deviceScaleFactor: 1 });
const errors = [];
page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
page.on('console', (m) => { if (m.type() === 'error') errors.push('console: ' + m.text()); });

await page.goto(`http://127.0.0.1:${PORT}/#/play/letter-trace`, { waitUntil: 'load' });
await page.waitForFunction(() => window.kindercade?.game?.paths, null, { timeout: 8000 });

/**
 * Runs inside the page against the live game object, so it exercises the real
 * input handling rather than a copy of the maths.
 */
const probe = await page.evaluate(([jitter, sampleCounts]) => {
  const g = window.kindercade.game;
  g.complete = function () { this.busy = true; };   // stay on the glyph under test
  g.audio.speak = () => {};
  const GLYPHS = [...'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'];
  const jit = () => (Math.random() - 0.5) * jitter;
  const reset = (ch) => {
    g.glyph = ch; g.paths = null; g.strokeIndex = 0; g.tip = 0;
    g.busy = false; g.drawing = false; g.slips = 0; g.mistakes = 0;
    g.layout();
  };
  const out = { untraceable: [], scribbled: [], missing: [], strokes: 0 };

  for (const ch of GLYPHS) {
    reset(ch);
    if (!g.paths.length) { out.missing.push(ch); continue; }
    out.strokes += g.paths.length;

    // A child tracing: start on the dot, follow the line, wobbling all the way.
    for (const samples of sampleCounts) {
      reset(ch);
      for (let s = 0; s < g.paths.length; s++) {
        const pts = g.current.pts.map((p) => ({ x: p.x, y: p.y }));
        g.onPointerDown({ x: pts[0].x + jit(), y: pts[0].y + jit() });
        const stride = Math.max(1, Math.round(pts.length / samples));
        for (let i = 0; i < pts.length; i += stride) {
          g.onPointerMove({ x: pts[i].x + jit(), y: pts[i].y + jit() });
        }
        g.onPointerMove(pts[pts.length - 1]);
        g.onPointerUp();
        if (g.strokeIndex !== s + 1) { out.untraceable.push(`${ch} stroke ${s + 1}/${g.paths.length} at ${samples} samples`); break; }
      }
    }

    // A child scribbling: land on the dot, then flail around the paper.
    reset(ch);
    {
      const pts = g.current.pts;
      g.onPointerDown({ x: pts[0].x, y: pts[0].y });
      for (let i = 0; i < 400; i++) {
        g.onPointerMove({ x: g.box.x + Math.random() * g.box.w, y: g.box.y + Math.random() * g.box.h });
      }
      g.onPointerUp();
      if (g.busy) out.scribbled.push(ch);
    }
  }
  return out;
}, [JITTER, SAMPLES]);

if (probe.missing.length) fail(`no stroke data for: ${probe.missing.join(' ')}`);
probe.untraceable.forEach((m) => fail(`could not be traced: ${m}`));
probe.scribbled.forEach((ch) => fail(`scribbling completed "${ch}" — the game is back to rewarding mess`));
errors.forEach((e) => fail(e));

if (!failures.length) {
  console.log(`  ✓ 62 glyphs, ${probe.strokes} strokes: all traceable with ±${JITTER / 2}px wobble, none completed by scribbling`);
}

await browser.close();
server.close();

console.log('');
if (failures.length) {
  console.error(`✗ ${failures.length} handwriting failure(s)`);
  process.exit(1);
}
console.log('✓ letter formation checks passed');
