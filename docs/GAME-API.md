# Writing a Kindercade game

A game is one ES module in `src/games/<id>.js` that default-exports a class
extending `Game`. Add it to `src/games/index.js`, the precache list in `sw.js`
and `SHOWS` in `src/home.js`; `npm run check` catches most missed steps.

```js
import { Game, V } from '../core/engine.js';
import { numberBlock } from '../core/toy.js';
import { sky, ground } from '../core/scenery.js';

export default class MyGame extends Game {
  static meta = { id: 'my-game', tint: '#ff8a4c', music: 'farm' };

  init() {                                   // build the world, once
    this.roundsTotal = 6;
    this.view = { pos: V(0, 5, 17), look: V(0, 2.4, 0), fov: 30 };
    this.light({ span: 10 });
    sky(this);
    ground(this);
    this.addPal([-4.5, 0, 2]);               // the child's buddy
  }

  async play() {                             // the whole game, top to bottom
    for (let i = 0; i < this.roundsTotal; i++) {
      const blocks = this.row([1, 2, 3].map((n) => numberBlock(n)));
      this.prompt('Find the number', 'Find number two!');
      const right = await this.choose(blocks, blocks[1]);
      this.win(right);
      await this.talk('Two!');
      blocks.forEach((b) => this.vanish(b));
    }
    this.finish();
  }
}
```

## Framing

Screen space is 9 units tall with the origin in the middle, and at least 12
wide. **Keep everything that matters inside that 12 × 9 window**, and below the
HUD (the top ~1.6 units). Wider screens see more scenery; there is no
per-device layout to write. With the default camera one world unit at `z = 0` is
about one screen unit, and things grow as they come nearer.

`this.at(thing)` gives the screen position of an object or world point;
`this.gap(a, b)` the on-screen distance between two.

## Toys

```js
const duck = this.toy('duck', 1.4, [x, y, z]);   // any name in src/models/
duck.hop(); duck.boing(); duck.wiggle(); duck.spin();
duck.dancing = true; duck.float = 0.1; duck.wear('crown');

block('a'), numberBlock(3, { dots: true }), slab(w, h, d, color)   // core/toy.js
text3d('cat', { height: 0.8, color })                              // core/glyphs.js
build((b) => { b.box(…); b.ball(…); b.tube(…); })                  // core/kit.js
new Toy(anyObject3D, size)                                         // give anything the same bounce
```

Don't hang game state on a name three.js already uses (`up`, `id`, `parent`,
`children`, `scale`…).

New models go in `src/models/`; check them at `/tools/gallery.html`.

## Motion and timing

```js
await this.jump(obj, [x, y, z]);   await this.moveTo(obj, [x, y, z], 0.4);
await this.appear(obj);            await this.vanish(obj);    // also removes it
await this.wait(0.5);              this.every((dt, t) => …);
```

Never use `setTimeout`, and never `await` an `audio` promise directly. The
helpers above and `talk()` / `settle()` run on the game's clock, so leaving a
game simply stops its `play()` where it stands.

## Touch

```js
await this.choose(toys, right, { wrong: (toy) => 'what to say' });   // the everyday question
this.hot(obj, { r: 0.7, tap: () => … });                             // anything else
this.hot(obj, { lift, drop });                                       // draggable
this.poke(obj);                                                      // scenery that wiggles
await this.ask();  …  this.resolve();                                // hand over control, take it back
```

Taps on answers are ignored while `this.busy`; `ask()` clears it and `resolve()`
sets it.

## Talking

```js
this.prompt('Spell the word', ['cat', 'Can you spell cat?']);   // shown, spoken
await this.talk('Well done!', { min: 1 });
```

The first argument is for a grown-up; the second is what the child hears and
what 🔊 repeats. Keep them apart whenever the text would give the answer away.

## Feedback and hints

- `win(where)` — chime, stars, streak, and one pip of the progress bar.
- `miss(obj, line)` — gentle, counts a mistake, and points at the answer after two.
- `demonstrate(async () => …)` — act out *why* an answer was wrong, then hand back.
- `solution()` — `{ tap: thing }` or `{ drag: [from, …, to] }`. `choose()` handles
  it for you; otherwise override it. The hint glove **and the test suite** use it.
- `hint()` — runs after seven idle seconds. It repeats the prompt by default;
  point at `solution()` too if that is no spoiler (it usually isn't on level 1).
- `finish()` — saves, unlocks, and runs the prize ceremony. Call it once.

## Rules for this arcade

1. **Four levels** (or eight, as two rows in the picker), and the first is for a three-year-old.
2. **Failure is never punishing.** No timers, no lives, no losing.
3. **Wrong answers should teach.** Where it is cheap, show *why* it was wrong.
4. **Speak everything.** The player cannot read yet.
5. **Something should happen.** A right answer moves the world along — the train
   leaves, the bear eats, the see-saw thumps.
6. **Two or three minutes** per play.
