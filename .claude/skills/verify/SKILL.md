---
name: verify
description: How to launch and drive Kindercade in a real browser to check a change.
---

# Verifying Kindercade

Static site, no build. Serve with `start(port)` from `tools/serve.mjs`; open it
with `launch()` / `openPage()` from `tools/browser.mjs` (needs Playwright; set
`CHROMIUM_PATH`, pointing it at a wrapper script if the browser needs
`--no-sandbox`). Software WebGL works but is slow.

- Routes: `#/` and `#/play/<id>/<level>`. Seed `localStorage['kindercade.save.v1']`
  (see `veteran()`) to unlock levels and skip the buddy picker.
- `window.kindercade.{engine,game,progress}` is the handle. Wait for
  `!game.busy`, then click at `engine.client(game.at(thing))`;
  `game.solution()` says what the right thing is, `game.choices` the rest.
- Speed: wrap `engine.render` to draw one frame in 20–30, and raise
  `engine.timeScale`. Render every frame again before a screenshot.
- Check layout at 4:3 (1024×768) — the narrowest shape, where things clip first.
- Stub `speechSynthesis` to log lines and flag any that get cancelled early;
  cut-off speech is the regression this project has had most often.
- `#res-next` pulses and locked levels are `aria-disabled`: click with `force`.
  Settings opens on a press-and-hold (`delay: 1200`).
- Worth probing: leaving mid-sentence, a palm plus a finger (CDP touch events),
  rotating mid-game, upgrading from the previous service-worker cache, offline.
