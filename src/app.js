/**
 * Kindercade shell: launcher, router, sticker book and settings.
 *
 * The home screen is plain DOM (native scrolling, real buttons, accessible);
 * the games run on a canvas managed by `Engine`. Routing is hash-based so the
 * whole thing works as a static site on GitHub Pages with no server rewrites.
 */

import { Engine } from './core/engine.js';
import { audio } from './core/audio.js';
import { progress, STICKERS } from './core/progress.js';
import { GAMES, SHELVES, gameById } from './games/index.js';
import { drawPip } from './core/art.js';

const $ = (sel) => document.querySelector(sel);

const el = {
  home: $('#home'),
  stage: $('#stage'),
  canvas: $('#game-canvas'),
  shelves: $('#shelves'),
  starCount: $('#star-count'),
  greeting: $('#greeting'),
  mascot: $('#mascot'),
  overlay: $('#overlay'),
  sheetBody: $('#sheet-body'),
  sheetClose: $('#sheet-close'),
  bootTap: $('#boot-tap'),
  installHint: $('#install-hint'),
};

let engine = null;
let currentGameId = null;

/* ─────────────────────────────── audio unlock ───────────────────────────── */

/**
 * iOS will not play a sound until the user has touched the page. Show a small
 * nudge, then arm audio on the very first interaction anywhere.
 */
function armAudio() {
  if (!audio.unlocked) el.bootTap.hidden = false;
  const unlock = () => {
    audio.unlock();
    audio.setMuted(!progress.sound);
    audio.setVoice(progress.voice);
    audio.setPreferredVoice(progress.voiceURI);
    audio.setSpeechRate(progress.speechRate);
    el.bootTap.hidden = true;
    window.removeEventListener('pointerdown', unlock);
    window.removeEventListener('keydown', unlock);
  };
  window.addEventListener('pointerdown', unlock, { once: false });
  window.addEventListener('keydown', unlock, { once: false });
}

/* ──────────────────────────────── home screen ───────────────────────────── */

function starRow(count) {
  return [0, 1, 2].map((i) => `<span class="s${i < count ? ' on' : ''}">⭐️</span>`).join('');
}

function buildHome() {
  el.shelves.innerHTML = SHELVES.map((shelf) => {
    const games = GAMES.filter((g) => g.subject === shelf.subject);
    const cards = games.map((g) => `
      <button class="card" type="button" data-game="${g.id}"
              style="background:linear-gradient(150deg, ${g.tint}, ${g.tint2})"
              aria-label="${g.title}. ${g.skill}">
        <span class="card-emoji" aria-hidden="true">${g.emoji}</span>
        <h3>${g.title}</h3>
        <p>${g.blurb}</p>
        <span class="card-stars" aria-hidden="true">${starRow(progress.starsFor(g.id))}</span>
      </button>`).join('');
    return `
      <section class="shelf">
        <h2 class="shelf-head" style="background:linear-gradient(120deg, ${shelf.color}, ${shelf.color2})">
          <span class="ico" aria-hidden="true">${shelf.emoji}</span>${shelf.title}
        </h2>
        <div class="cards">${cards}</div>
      </section>`;
  }).join('');

  el.shelves.querySelectorAll('[data-game]').forEach((btn) => {
    btn.addEventListener('click', () => {
      audio.unlock();
      audio.pick();
      location.hash = `#/play/${btn.dataset.game}`;
    });
  });
  refreshHomeStats();
}

function refreshHomeStats() {
  el.starCount.textContent = String(progress.totalStars);
  el.shelves.querySelectorAll('[data-game]').forEach((btn) => {
    const row = btn.querySelector('.card-stars');
    if (row) row.innerHTML = starRow(progress.starsFor(btn.dataset.game));
  });
  const total = progress.totalStars;
  el.greeting.textContent =
    total === 0 ? 'Pick a game to play!'
      : total < 6 ? `${total} stars so far — keep going!`
        : total < 15 ? `${total} stars! You are on a roll.`
          : `${total} stars! Superstar. 🌟`;
}

/* ───────────────────────────── mascot animation ─────────────────────────── */

function startMascot() {
  const canvas = el.mascot;
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const dpr = Math.min(3, window.devicePixelRatio || 1);
  const size = 132;
  canvas.width = size * dpr;
  canvas.height = size * dpr;
  ctx.scale(dpr, dpr);
  let raf = 0;
  const t0 = performance.now();
  const frame = (now) => {
    raf = requestAnimationFrame(frame);
    if (el.home.hidden) return;              // no work while a game is running
    const t = (now - t0) / 1000;
    ctx.clearRect(0, 0, size, size);
    drawPip(ctx, size / 2, size * 0.55, 62, { t, mood: 'happy', look: Math.sin(t * 0.7) });
  };
  raf = requestAnimationFrame(frame);
  return () => cancelAnimationFrame(raf);
}

/* ──────────────────────────────── dialogs ───────────────────────────────── */

function openSheet(html) {
  el.sheetBody.innerHTML = html;
  el.overlay.hidden = false;
}
function closeSheet() {
  el.overlay.hidden = true;
  el.sheetBody.innerHTML = '';
}

function openStickerBook() {
  audio.tap();
  const owned = progress.stickers;
  const nextAt = (owned.length + 1) * 3;
  const grid = STICKERS.map((s) => (owned.includes(s)
    ? `<div class="sticker">${s}</div>`
    : '<div class="sticker locked">❔</div>')).join('');
  openSheet(`
    <h2>Sticker Book</h2>
    <p class="sub">${owned.length} of ${STICKERS.length} collected —
      ${owned.length >= STICKERS.length ? 'you found them all!' : `earn ${nextAt} stars for the next one.`}</p>
    <div class="sticker-grid">${grid}</div>`);
}

/**
 * Which voices are on offer depends entirely on the device, and on iPadOS the
 * good ones are an opt-in download the grown-up has to go and fetch. Say so
 * rather than leaving them to wonder why it sounds the way it does.
 */
function voiceHint() {
  const isApple = /iPad|iPhone|Macintosh/.test(navigator.userAgent);
  return isApple
    ? 'iPad: add better voices under Settings → Accessibility → Spoken Content → Voices'
    : 'Voices come from your device — some sound much better than others';
}

/** Fill the voice picker with the ranked list, best first. */
function buildVoicePicker() {
  const sel = $('#voice-pick');
  if (!sel) return;

  const render = () => {
    const voices = audio.listVoices();
    if (!voices.length) {
      sel.innerHTML = '<option value="">Loading voices…</option>';
      return;
    }
    sel.innerHTML = ['<option value="">Best available</option>']
      .concat(voices.map((v) => {
        const label = `${v.name}${v.good ? ' ✨' : ''}`;
        const on = v.uri === progress.voiceURI ? ' selected' : '';
        return `<option value="${v.uri.replace(/"/g, '&quot;')}"${on}>${label}</option>`;
      }))
      .join('');
  };

  render();
  // Chrome and Edge stream their best voices in a few seconds late, so the list
  // has to be able to fill itself in after the sheet is already open.
  if ('speechSynthesis' in window) {
    speechSynthesis.addEventListener('voiceschanged', render, { once: true });
  }

  sel.addEventListener('change', () => {
    progress.voiceURI = sel.value;
    audio.setPreferredVoice(sel.value);
    audio.speak('Hello! Shall we play a game?');
  });

  $('#try-voice')?.addEventListener('click', () => {
    audio.unlock();
    audio.speak('Hello! Shall we play a game?');
  });

  const rate = $('#voice-rate');
  rate?.addEventListener('change', () => {
    progress.speechRate = Number(rate.value);
    audio.setSpeechRate(progress.speechRate);
    audio.speak('That is how fast I will talk.');
  });
}

function openSettings() {
  audio.tap();
  openSheet(`
    <h2>Settings</h2>
    <p class="sub">For grown-ups.</p>
    <div class="setting-row">
      <div>Sound effects<small>Pops, chimes and cheers</small></div>
      <button class="toggle" id="t-sound" role="switch" aria-checked="${progress.sound}" aria-label="Sound effects"></button>
    </div>
    <div class="setting-row">
      <div>Talking<small>Reads every instruction and word out loud</small></div>
      <button class="toggle" id="t-voice" role="switch" aria-checked="${progress.voice}" aria-label="Talking"></button>
    </div>
    <div class="setting-row stacked">
      <div>Voice<small>${voiceHint()}</small></div>
      <div class="voice-controls">
        <select id="voice-pick" aria-label="Talking voice"></select>
        <button class="try-voice" id="try-voice" type="button">Try it</button>
      </div>
    </div>
    <div class="setting-row stacked">
      <div>Talking speed<small>Slower can be easier to follow</small></div>
      <input type="range" id="voice-rate" min="0.7" max="1.25" step="0.05"
        value="${progress.speechRate}" aria-label="Talking speed" />
    </div>
    <button class="danger" id="reset-progress" type="button">Erase all stars and stickers</button>`);

  buildVoicePicker();

  const bind = (id, get, set) => {
    const btn = $(`#${id}`);
    btn.addEventListener('click', () => {
      const next = !get();
      set(next);
      btn.setAttribute('aria-checked', String(next));
      audio.unlock();
      audio.tap();
    });
  };
  bind('t-sound', () => progress.sound, (v) => { progress.sound = v; audio.setMuted(!v); });
  bind('t-voice', () => progress.voice, (v) => { progress.voice = v; audio.setVoice(v); if (v) audio.speak('Hello!'); });

  $('#reset-progress').addEventListener('click', () => {
    if (confirm('Erase all stars and stickers? This cannot be undone.')) {
      progress.reset();
      refreshHomeStats();
      closeSheet();
    }
  });
}

/* ───────────────────────────────── router ──────────────────────────────── */

function ensureEngine() {
  if (!engine) {
    engine = new Engine(el.canvas);
    engine.onExit = () => { location.hash = '#/'; };
    // Handle for the automated tests (tools/smoke.mjs, tools/playthrough.mjs),
    // which need to drive a game to completion without guessing at pixels.
    window.kindercade = { engine, progress, GAMES, get game() { return engine.game; } };
  }
  return engine;
}

async function showGame(id) {
  const entry = gameById(id);
  if (!entry) { location.hash = '#/'; return; }
  currentGameId = id;

  el.home.hidden = true;
  el.stage.hidden = false;
  closeSheet();

  const eng = ensureEngine();
  eng.resize();

  try {
    const mod = await entry.load();
    // The route may have changed while the module was downloading.
    if (currentGameId !== id) return;
    const GameClass = mod.default;
    if (!GameClass) throw new Error(`${id} has no default export`);
    eng.start(GameClass, { level: progress.levelFor(id) });
  } catch (err) {
    console.error('[kindercade] failed to start', id, err);
    location.hash = '#/';
  }
}

function showHome() {
  currentGameId = null;
  if (engine) engine.stop();
  audio.stopSpeech();
  el.stage.hidden = true;
  el.home.hidden = false;
  refreshHomeStats();
}

function route() {
  const hash = location.hash || '#/';
  const match = hash.match(/^#\/play\/([\w-]+)$/);
  if (match) showGame(match[1]);
  else showHome();
}

/* ─────────────────────────────── service worker ─────────────────────────── */

function registerServiceWorker() {
  if (!('serviceWorker' in navigator)) return;
  if (location.protocol === 'file:') return;
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('sw.js').catch((err) => {
      console.warn('[kindercade] service worker not registered', err);
    });
  });
}

/* ──────────────────────────────────── boot ─────────────────────────────── */

function boot() {
  buildHome();
  startMascot();
  armAudio();
  audio.setMuted(!progress.sound);
  audio.setVoice(progress.voice);

  $('#sticker-btn').addEventListener('click', openStickerBook);
  $('#settings-btn').addEventListener('click', openSettings);
  $('#star-chip').addEventListener('click', openStickerBook);
  el.sheetClose.addEventListener('click', () => { audio.tap(); closeSheet(); });
  el.overlay.addEventListener('click', (e) => { if (e.target === el.overlay) closeSheet(); });

  progress.onChange(refreshHomeStats);
  window.addEventListener('hashchange', route);
  route();

  // Nudge iPad users toward the full-screen home-screen install.
  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent)
    || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  const standalone = window.navigator.standalone || window.matchMedia('(display-mode: standalone)').matches;
  if (isIOS && !standalone) {
    el.installHint.textContent = 'Tip: tap Share → Add to Home Screen for full screen.';
  }

  // Belt and braces against Safari's double-tap-to-zoom and pinch gestures.
  document.addEventListener('gesturestart', (e) => e.preventDefault(), { passive: false });
  document.addEventListener('dblclick', (e) => e.preventDefault(), { passive: false });

  registerServiceWorker();
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
else boot();
