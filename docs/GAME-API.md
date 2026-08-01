# Writing a Kindercade game

Every game is a single ES module in `src/games/<id>.js` that default-exports a
class extending `Game`. There is no build step and no dependencies — the file is
served to the iPad exactly as written.

```js
import { Game } from '../core/engine.js';

export default class MyGame extends Game {
  static meta = {
    id: 'my-game',          // must match the filename and the registry entry
    title: 'My Game',
    subject: 'math',        // 'math' | 'spelling' | 'puzzle'
    blurb: 'One friendly sentence.',
    emoji: '🎲',
    tint: '#ff8a4c',        // accent colour used by HUD pips and effects
  };

  init()        { /* build state, once */ }
  layout()      { /* all positioning — re-runs on rotate/resize */ }
  update(dt)    { /* per-frame logic, dt in seconds */ }
  draw(ctx)     { /* per-frame drawing of game content */ }
  drawOverlay(ctx) { /* optional: drawn above this.buttons */ }
  destroy()     { /* release anything init() acquired */ }
}
```

## Coordinate space

The logical canvas is **always 900 units tall**; the width follows the device
aspect ratio, clamped to 1100–1700. Never hard-code a width.

| Property     | Meaning                                        |
|--------------|------------------------------------------------|
| `this.W`     | logical width (varies — read it in `layout()`) |
| `this.H`     | logical height (always 900)                    |
| `this.cx`    | `this.W / 2`                                   |
| `this.playTop` | first y clear of the HUD (172)                |
| `this.playH` | usable height below the HUD                    |

Compute every position from `this.W` / `this.H` inside `layout()`. The engine
calls `layout()` after `init()` and again on every resize or rotation, so a game
that follows this rule survives an iPad being turned sideways mid-round.

## What the base class gives you

```js
this.audio     // sound + speech        this.fx        // particles + shake
this.tweens    // tweens + timers       this.buttons   // ButtonLayer for your buttons
this.progress  // saved stars/levels    this.t         // seconds since the game started
this.level     // 1..3, chosen by the player's progress
this.maxLevel  // set this in init() if you have fewer than 3 levels
this.roundsTotal / this.roundsDone   // drives the progress pips in the HUD
this.mistakes  // increment via nudge(); drives the star rating
this.tint      // accent colour from meta
```

### Talking to the child

The player **cannot read yet**. Every instruction must be spoken.

```js
this.setPrompt('How many bees?');                      // shows + speaks it
this.setPrompt('Spell it!', { speech: 'Spell the word cat' });
this.audio.speak('seven');                             // one-off speech
this.audio.spellOut('cat');                            // c — a — t — cat
```

The HUD's 🔊 button re-speaks the current prompt automatically. Override
`hintPulse()` to also wiggle whatever the child should touch next.

### Feedback

```js
this.cheer(x, y, '+1');   // chime + sparkles + star burst
this.nudge(x, y);         // gentle low tone + small puff; counts a mistake
this.finishRound({ title: 'You did it!' });  // stars, confetti, results panel
```

`finishRound` handles scoring, saving, unlocking the next level and showing the
Home / Again / Next buttons. Call it exactly once, when the last round is done.

### Timing

```js
await this.tweens.to(token, { x: 300, y: 200 }, 0.35, { ease: Ease.outBack });
this.tweens.after(0.6, () => this.nextQuestion());
await this.tweens.wait(0.4);
```

Never use `setTimeout` for game logic — `this.tweens` is stepped by the engine
and torn down with the game, so a timer can't fire into a dead scene.

### Input

```js
onPointerDown(p) {}   // p = { x, y } in logical units
onPointerMove(p) {}
onPointerUp(p) {}
onTap(p) {}           // fired on lift when the finger barely moved
```

Buttons added to `this.buttons` are routed automatically — those callbacks only
fire when nothing else consumed the touch — and are drawn for you, above
whatever `draw()` painted. Use `DragController` from `../core/input.js` for
drag-and-drop.

## Drawing

Import from `../core/art.js`:

```js
candyRect(ctx, x, y, w, h, r, color, { pressed, glow, stroke })
candyCircle(ctx, cx, cy, r, color, { gloss, glow })
drawEmoji(ctx, 'bee', x, y, size, { rotate, alpha, shadow })  // sprite name or emoji
bubbleText(ctx, 'Hello', x, y, size, { fill, stroke })
softText, glassPanel, roundRect, starPath, sparklePath, blobPath, cloudPath
goldStar, drawPip, drawBackdrop, vGrad, radial, Palette
```

The 16-bit atlas itself lives in `../core/sprites.js`:

```js
drawSprite(ctx, 'balloon-pink', x, y, size, { rotate, alpha, shadow })
hasSprite('cookie-1')      // true once the sheet is decoded
getSprite('card-back-tile') // { img, x, y, w, h } source rect, or null
loadScene('fox')            // Promise<Image|null> — jigsaw scene paintings
```

`drawBackground(ctx)` paints the shared sky by default. Override it for a
different scene, or tune it with `this.backdrop = { top, bottom, hills }` in
`init()`.

Effects live on `this.fx`:

```js
this.fx.confetti(x, y, 60)     this.fx.sparkle(x, y, 14)
this.fx.starBurst(x, y, 18)    this.fx.ring(x, y, { r1: 160 })
this.fx.burstEmoji(x, y, '🎈') this.fx.puff(x, y)
this.fx.floatText(x, y, '+1')  this.fx.addShake(6)
```

## Rules for this arcade

1. **All pictorial art comes from the sprite atlas** (`assets/sprites/`, see
   `src/core/sprites.js`). `drawEmoji` accepts a sprite name (`'fox'`,
   `'icon-home'`) or a legacy emoji character — both resolve to 16-bit pixel
   art, with the emoji glyph as a fallback while sheets load. New sprites must
   be added to the atlas sheets, the manifest, and the service-worker precache;
   never hotlink external assets.
2. **Nothing tappable is smaller than ~96 logical units.** Fingers are blunt.
3. **Failure is never punishing.** No timers, no lives, no losing. A wrong
   answer gets a warm "try again" and the child may retry immediately.
4. **Three levels.** `this.level` is 1–3, easiest to hardest; level 2 unlocks
   after earning 2+ stars on level 1, and so on.
5. **Six to eight rounds** per play — long enough to learn, short enough to
   finish before attention runs out.
6. **Speak everything.** Prompts, numbers, words, praise.
7. **Wrong answers should teach.** Where it is cheap to do so, show the right
   answer after a couple of misses rather than looping forever.
