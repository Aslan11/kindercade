/**
 * Handwriting check for Letter Racer.
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

import { start } from './serve.mjs';
import { launch, openPage, veteran } from './browser.mjs';
import { GAMES } from '../src/games/index.js';

const PORT = Number(process.env.PORT) || 8125;

/** Finger wobble in paper units, and how coarsely the drag is sampled. */
const JITTER = 18;
const SAMPLES = [60, 24, 12];

const failures = [];
const fail = (msg) => { failures.push(msg); console.error('  ✗ ' + msg); };

const server = await start(PORT);
const browser = await launch();
const page = await openPage(browser, { width: 640, height: 480, save: veteran(GAMES) });
const { errors } = page;

await page.goto(`http://127.0.0.1:${PORT}/#/play/letter-trace/2`);
await page.waitForFunction(() => window.kindercade?.game?.paths, null, { timeout: 30000 });

/**
 * Runs inside the page against the live game object, so it exercises the real
 * input handling rather than a copy of the maths.
 */
const probe = await page.evaluate(async ([jitter, sampleCounts]) => {
  const { strokesFor } = await import('/src/data/strokes.js');
  const g = window.kindercade.game;
  g.complete = function () { this.busy = true; };   // stay on the glyph under test
  g.audio.speak = () => {};
  const GLYPHS = [...'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'];
  const jit = () => (Math.random() - 0.5) * jitter;
  const reset = (ch) => {
    g.lay(strokesFor(ch));
    g.busy = false;
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
        g.penDown({ x: pts[0].x + jit(), y: pts[0].y + jit() });
        const stride = Math.max(1, Math.round(pts.length / samples));
        for (let i = 0; i < pts.length; i += stride) {
          g.penMove({ x: pts[i].x + jit(), y: pts[i].y + jit() });
        }
        g.penMove(pts[pts.length - 1]);
        g.onUp();
        if (g.strokeIndex !== s + 1) { out.untraceable.push(`${ch} stroke ${s + 1}/${g.paths.length} at ${samples} samples`); break; }
      }
    }

    // A child scribbling: land on the dot, then flail around the paper. Once in
    // a while the first swipe really is a straight line down an `l`, so it is
    // scribbling that *works* we are looking for, not a single fluke.
    let lucky = 0;
    for (let go = 0; go < 20; go++) {
      reset(ch);
      const pts = g.current.pts;
      g.penDown({ x: pts[0].x, y: pts[0].y });
      for (let i = 0; i < 400; i++) {
        g.penMove({ x: g.box.x + Math.random() * g.box.w, y: g.box.y + Math.random() * g.box.h });
      }
      g.onUp();
      if (g.busy) lucky++;
    }
    if (lucky > 5) out.scribbled.push(ch);
  }
  return out;
}, [JITTER, SAMPLES]);

if (probe.missing.length) fail(`no stroke data for: ${probe.missing.join(' ')}`);
probe.untraceable.forEach((m) => fail(`could not be traced: ${m}`));
probe.scribbled.forEach((ch) => fail(`scribbling completed "${ch}" — the game is back to rewarding mess`));
errors.forEach((e) => fail(e));

if (!failures.length) {
  console.log(`  ✓ 62 glyphs, ${probe.strokes} strokes: all traceable with ±${JITTER / 2}px wobble, scribbling gets nowhere`);
}

await browser.close();
server.close();

console.log('');
if (failures.length) {
  console.error(`✗ ${failures.length} handwriting failure(s)`);
  process.exit(1);
}
console.log('✓ letter formation checks passed');
