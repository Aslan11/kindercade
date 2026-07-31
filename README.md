# 🌟 Kindercade

A little arcade of learning games for a five-year-old, built to run beautifully
on an iPad and hosted for free on GitHub Pages.

Nine games across three subjects — counting and arithmetic, letters and spelling,
and puzzles — wrapped in one consistent, friendly world with a mascot, stars and
a sticker book.

## The games

### 🔢 Numbers

| Game | What it teaches |
|---|---|
| **Counting Critters** | One-to-one counting and numeral recognition to 20. Tap each critter to count it out loud, then tap the number. |
| **Balloon Pop** | Addition and subtraction within 20, with the sum shown concretely as objects before the numerals take over. |
| **Cookie Kitchen** | Ten frames and number bonds — the "make ten" skill that early arithmetic is built on. |

### 🔤 Words

| Game | What it teaches |
|---|---|
| **Sound Safari** | Phonemic awareness: hearing the first (and later the last) sound in a word and matching it to a letter. |
| **Word Builder** | Spelling 3–5 letter words by dragging letters into place, with a hint always one tap away. |
| **Letter Trace** | Letter formation — tracing letters, lowercase and digits with a finger. |

### 🧩 Puzzles

| Game | What it teaches |
|---|---|
| **Memory Match** | Working memory, plus number↔quantity and uppercase↔lowercase pairing at higher levels. |
| **Pattern Party** | Pattern recognition and sequencing, the root of algebraic thinking. |
| **Jigsaw Garden** | Spatial reasoning and persistence, with real jigsaw-cut pieces. |

Each game has three levels that unlock as stars are earned, and every round ends
in a celebration — there is no way to lose, no timer, and no score to fall short
of. Wrong answers get a warm "try again" and, after a couple of tries, the game
shows the answer so a round always ends in success.

## Design notes

**Built for a pre-reader.** Every instruction is spoken aloud as well as shown.
Words are always paired with a picture. Nothing important is conveyed by text
alone.

**Built for iPad fingers.** Nothing tappable is smaller than ~96 units on a
900-unit-tall canvas, taps tolerate a lot of wobble, drags survive a finger
sliding off the edge, and Safari's scroll, zoom and text-selection gestures are
all suppressed inside a game.

**Built to last.** No frameworks, no bundler, no npm dependencies, no external
assets. Plain ES modules and Canvas 2D served straight from the repo. All art is
generated at runtime — vector shapes with real gradients and shading, plus colour
emoji baked into cached sprites — so it stays perfectly sharp on a Retina display
and the whole app is a few hundred kilobytes. All sound is synthesised with the
Web Audio API; speech uses the system voice.

**Works offline.** A service worker caches the arcade on first visit, so it keeps
working on a plane or in the car.

## Running it

```bash
npm start            # http://localhost:8080 — plain static server, same as Pages
npm run check        # parse + contract checks (this is what CI runs)
npm run smoke        # boots every game in Chromium; fails on blank or frozen screens
npm run playthrough  # plays all nine games to the results screen and checks scoring
npm test             # all three
npm run icons        # regenerate the app icons from tools/make-icons.mjs
```

There is no build step. What is in the repository is what the browser runs.

`check` is dependency-free and runs in CI. `smoke` and `playthrough` drive a real
Chromium via Playwright, so they run locally where a browser is available. Add
`SHOTS=1` to either to write screenshots to `.smoke/`.

## Deploying

Pushing to `main` runs `.github/workflows/deploy.yml`, which verifies the site
and publishes the repository root to GitHub Pages.

One-time setup: **Settings → Pages → Build and deployment → Source: GitHub
Actions**.

The site then lives at `https://<user>.github.io/kindercade/`.

## Putting it on the iPad

1. Open the site in Safari.
2. Tap **Share → Add to Home Screen**.

It launches full screen with no browser chrome, in landscape, and works without a
connection. Sound turns on with the first tap (iOS requires a real touch before
it will play audio).

Under **⚙️ Settings** there are grown-up controls for sound effects, the talking
voice, and erasing progress.

## Adding a game

See [`docs/GAME-API.md`](docs/GAME-API.md). In short: drop a module in
`src/games/`, export a class extending `Game`, and add an entry to
`src/games/index.js` and the precache list in `sw.js`. `npm run check` will tell
you if you missed a step.

## Layout

```
index.html            shell: launcher, sticker book, settings
styles/main.css       shell styles (the games are drawn on canvas)
src/app.js            router + home screen
src/core/             engine, art kit, audio, input, effects, UI, progress
src/data/words.js     picture-word list, phonics and number data
src/games/            one module per game + the registry
tools/                static server, checks, smoke test, icon generator
```
