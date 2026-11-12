# 🌟 Kindercade

A cel-shaded 3D arcade of learning games for three- to six-year-olds, built to
run on an iPad and hosted for free on GitHub Pages.

Fifteen games across reading, maths and critical thinking, set on one little
island. Each child picks a buddy who hosts every game, earns their own stars,
and unwraps toys that come to live on the beach.

## The games

Every game has four levels. **Level 1 is pitched at a three-year-old**; older
children start on level 2. Two stars on a level opens the next.

### 🔢 Numbers

| Game | What happens | Levels |
|---|---|---|
| **Critter Count** | Tap animals into a hay wagon whose seats are a ten frame. Count them all, load exactly *n*, or pick one kind out of a mixed field. | to 3 · to 5 · to 10 · to 20 |
| **Balloon Pop** | The sum is acted out first — animals parachute in or float away — then pop the answer. Balloon party at half time. | colours & numerals · adding · taking away · within 20 |
| **Cookie Shop** | Fill a customer's order, ring the bell, bake, and watch them scoff the lot. | to 4 · to 10 · make ten · teens with a box of ten |
| **See-Saw** | Predict, then let gravity settle it. | big & small · more & fewer · bigger number · balance it |
| **Frog Hop** | Cross the pond by landing on lily pads in order. | 1–5 · 1–10 and back · missing number · 2s, 5s, 10s |

### 🔤 Words

| Game | What happens | Levels |
|---|---|---|
| **Sound Safari** | Ride the jeep, hear the sound, snap the photo. | find the animal · first sounds · confusable letters · last sounds |
| **Word Train** | Load one letter per wagon; each says its sound. | match letters · 3 · 4 · 5 letters |
| **Letter Racer** | Every letter is a road. Drive it in proper stroke order, laying rainbow paint. | lines & loops · capitals · small letters · digits |
| **Word Fishing** | Hook the right catch. | letters · rhymes · read a word · sight words |
| **Starry ABC** | Dot-to-dot to the tune of the alphabet song. | A–E · capitals · small letters · what comes next |

### 🧩 Puzzles

| Game | What happens | Levels |
|---|---|---|
| **Magic Match** | Memory cards that spring to life. | 3 pairs · animals · numeral ↔ quantity · A ↔ a |
| **Pattern Party** | Every dancer plays a note, so patterns are heard as well as seen. | AB · AAB · gaps in the middle · growing patterns |
| **Jigsaw Garden** | Pick a picture, piece it together, and it comes alive. | 2–4 · 4–6 · 9–12 · 12–16 pieces |
| **Robot Road** | Queue up arrows, press go, debug. | drive · plan · obstacles · fetch the key first |
| **Sort Shop** | Things roll in on a conveyor and need a crate. | colour · shape · kind · two rules at once |

There is no way to lose and no clock to beat. A wrong answer gets a warm "not
quite" — usually with the mistake *shown*, like a plate of cookies that leaves
gaps on the tray — and after two tries a pointing glove shows the way.

## Design notes

**Built for pre-readers.** Every instruction is spoken. Nothing important is
conveyed by text alone, and the on-screen text never gives an answer away.

**Built for two (or four) kids.** Up to four players, each with a buddy, an age,
their own progress and — under **⚙️ Settings** (press and hold) — a name for the voice to greet.

**Always worth replaying.** Stars are a best score per level, but every finished
game also pours into a star jar, and a full jar is a present. There are 52 toys,
seven of them hats for the buddy.

**Built for iPad fingers.** Nothing tappable is under ~100 units on a
900-unit-tall screen, taps fire the moment a finger lands, a resting palm cannot
block input, and anything you can drag you can usually just tap.

**No build step, no assets.** Plain ES modules served straight from the repo.
The one dependency is [three.js](https://threejs.org) r170, vendored unmodified
in `vendor/three/`. Every model is assembled at runtime from primitives
(`src/models/`), letters are swept along the handwriting strokes in
`src/data/strokes.js`, and all music and sound is synthesised. It needs WebGL 2
(iPadOS 15 or later), and trades resolution for frame rate on slower devices.

**Built to be listened to.** Every spoken line goes through one queue, so
phrases follow each other instead of cutting each other off, the music ducks
under the voice, and the voice is chosen by ranking what the device offers. The
best voices on an iPad are an opt-in download: **Settings → Accessibility →
Spoken Content → Voices**.

**Works offline.** A service worker caches the arcade on first visit.

## Running it

```bash
npm start            # http://localhost:8080 — plain static server, same as Pages
npm run check        # parse + contract checks, builds every model (this is what CI runs)
npm run smoke        # first-launch flow, then boots and mashes every game at three screen shapes
npm run playthrough  # plays all 60 levels to the prize screen with real taps and drags
npm run trace-check  # traces all 62 letter shapes, and tries to cheat at each
npm test             # all four
npm run icons        # regenerate the app icons from tools/make-icons.mjs
```

`check` is dependency-free. The other three drive a real browser via Playwright
(set `CHROMIUM_PATH` to use something other than Google Chrome); add `SHOTS=1`
to `smoke` or `playthrough` to write screenshots to `.smoke/`.
`/tools/gallery.html` shows every model on one page.

## Deploying

Pushing to `main` runs `.github/workflows/deploy.yml`, which verifies the site
and publishes the repository root to GitHub Pages.

One-time setup: **Settings → Pages → Build and deployment → Source: GitHub
Actions**.

The site then lives at `https://<user>.github.io/kindercade/`.

## Putting it on the iPad

1. Open the site in Safari.
2. Tap **Share → Add to Home Screen**.

It launches full screen with no browser chrome and works without a connection.
Sound turns on with the first tap (iOS requires a real touch before it will play
audio).

## Adding a game

See [`docs/GAME-API.md`](docs/GAME-API.md).

## Layout

```
index.html            shell
styles/main.css       HUD, sheets and home-screen cards
src/app.js            router, players, toy box, settings
src/home.js           the island
src/core/             engine, modelling kit, toys, effects, HUD, audio, music, progress
src/models/           every buddy, animal and object
src/data/             word lists, phonics, handwriting strokes
src/games/            one module per game + the registry
vendor/three/         three.js r170 (MIT)
tools/                static server, checks, browser tests, model gallery
```
