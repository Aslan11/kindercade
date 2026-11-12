/**
 * Kindercade service worker.
 *
 * Goal: once the iPad has opened the arcade one time, it works on a plane, in a
 * car, and in a waiting room with no signal. Strategy is deliberately simple —
 * cache-first for our own static files, with a background refresh so a new
 * deploy is picked up on the next launch.
 */

const VERSION = 'kindercade-v4';
const CORE = [
  './',
  'index.html',
  'manifest.webmanifest',
  'styles/main.css',
  'vendor/three/three.module.min.js',
  'src/app.js',
  'src/core/anim.js',
  'src/core/audio.js',
  'src/core/engine.js',
  'src/core/fx.js',
  'src/core/glyphs.js',
  'src/core/hud.js',
  'src/core/kit.js',
  'src/core/music.js',
  'src/core/progress.js',
  'src/core/props.js',
  'src/core/results.js',
  'src/core/scenery.js',
  'src/core/stage.js',
  'src/core/three.js',
  'src/core/toy.js',
  'src/core/util.js',
  'src/data/strokes.js',
  'src/data/words.js',
  'src/games/balloon-math.js',
  'src/games/cookie-kitchen.js',
  'src/games/counting-critters.js',
  'src/games/frog-hop.js',
  'src/games/index.js',
  'src/games/jigsaw-garden.js',
  'src/games/letter-trace.js',
  'src/games/memory-match.js',
  'src/games/pattern-party.js',
  'src/games/robot-road.js',
  'src/games/see-saw.js',
  'src/games/sort-shop.js',
  'src/games/sound-safari.js',
  'src/games/starry-abc.js',
  'src/games/word-builder.js',
  'src/games/word-fishing.js',
  'src/home.js',
  'src/models/animals.js',
  'src/models/buddies.js',
  'src/models/food.js',
  'src/models/index.js',
  'src/models/nature.js',
  'src/models/shapes.js',
  'src/models/things.js',
  'assets/icon-192.png',
  'assets/icon-512.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(VERSION);
    // Add individually so one 404 cannot fail the whole install.
    await Promise.all(CORE.map((url) => cache.add(new Request(url, { cache: 'reload' })).catch(() => {})));
    self.skipWaiting();
  })());
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k)));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  // Navigations: try the network so a fresh deploy lands, fall back to cache.
  if (req.mode === 'navigate') {
    event.respondWith((async () => {
      try {
        const fresh = await fetch(req);
        const cache = await caches.open(VERSION);
        cache.put('index.html', fresh.clone());
        return fresh;
      } catch (_) {
        return (await caches.match('index.html')) || (await caches.match('./')) || Response.error();
      }
    })());
    return;
  }

  // Everything else: cache-first, refreshed quietly in the background.
  event.respondWith((async () => {
    const cached = await caches.match(req);
    const network = fetch(req).then((res) => {
      if (res && res.ok) caches.open(VERSION).then((c) => c.put(req, res.clone()));
      return res;
    }).catch(() => null);
    return cached || (await network) || Response.error();
  })());
});
