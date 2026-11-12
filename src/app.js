/**
 * Kindercade shell: router, home-screen cards, toy box and settings.
 *
 * The island and the games all run on one canvas managed by `Engine`. Routing
 * is hash-based so the whole thing works as a static site on GitHub Pages.
 */

import { Engine } from './core/engine.js';
import { Hud, ICONS, roundButton } from './core/hud.js';
import { audio } from './core/audio.js';
import { progress, TOYS, HATS, BUDDIES, LEVELS, JAR_SIZE, MAX_PLAYERS } from './core/progress.js';
import { GAMES, gameById } from './games/index.js';
import { numberWord, toyName } from './data/words.js';
import Home from './home.js';

const $ = (sel) => document.querySelector(sel);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

let engine = null;
let routeId = 0;

/* ─────────────────────────────── audio unlock ───────────────────────────── */

/** iOS will not play a sound until the page has been touched. */
function armAudio() {
  audio.setMuted(!progress.sound);
  audio.setMusic(progress.music);
  audio.setVoice(progress.voice);
  audio.setPreferredVoice(progress.voiceURI);
  audio.setSpeechRate(progress.speechRate);
  // Kept for good: the context is suspended again after every trip to the background.
  for (const type of ['pointerdown', 'click', 'keydown']) window.addEventListener(type, () => audio.unlock());
  window.addEventListener('click', () => audio.primeSpeech(), { capture: true, once: true });
}

/* ──────────────────────────────── home screen ───────────────────────────── */

const stars = (n) => [0, 1, 2].map((i) => `<i class="${i < n ? 'on' : ''}">${ICONS.star}</i>`).join('');

function buildHome() {
  $('h1').innerHTML = [...'Kindercade'].map((ch, i) => `<span style="--i:${i}">${ch}</span>`).join('');
  $('#actions').innerHTML = `
    <button class="orb" id="who-btn" type="button" aria-label="Change player"></button>
    <button class="chip" id="toy-btn" type="button" aria-label="Toy box">
      <span class="chip-stars">${ICONS.star}<b id="star-count"></b></span>
      <span class="chip-jar"><i></i></span>
      <span class="chip-gift">${ICONS.gift}</span>
    </button>
    ${roundButton('gear', '#8a8fb5', 'Settings (press and hold)', 'settings-btn')}`;
  $('#cards').innerHTML = GAMES.map((g) => `
    <button class="card" type="button" data-game="${g.id}" style="--c:${g.tint}" aria-label="${g.title}. ${g.skill}">
      <span class="card-label">${g.title}<span class="card-stars" aria-hidden="true"></span></span>
    </button>`).join('');
  $('#sheet-close').innerHTML = roundButton('close', '#ff6b8b', 'Close');

  for (const g of GAMES) $(`[data-game="${g.id}"]`).addEventListener('click', () => chooseGame(g));
  $('#who-btn').addEventListener('click', () => { audio.tap(); choosePlayer(); });
  $('#toy-btn').addEventListener('click', openToyBox);
  guardSettings($('#settings-btn'));
  $('#sheet-close').addEventListener('click', () => { audio.tap(); closeSheet(); });
  $('#overlay').addEventListener('click', (e) => { if (e.target.id === 'overlay' && !$('.sheet.must')) closeSheet(); });
}

/** Settings open on a press-and-hold, which small children do not do by accident. */
function guardSettings(btn) {
  let timer = 0, opened = false;
  btn.addEventListener('pointerdown', () => {
    opened = false;
    timer = setTimeout(() => { opened = true; openSettings(); }, 700);
  });
  for (const type of ['pointerup', 'pointerleave', 'pointercancel']) btn.addEventListener(type, () => clearTimeout(timer));
  btn.addEventListener('click', (e) => {
    if (e.detail === 0) openSettings();          // keyboard
    else if (!opened) audio.speak('For grown-ups! Press and hold.');
  });
}

function refreshHome() {
  $('#who-btn').replaceChildren(engine.snapshot(progress.buddy, 128, progress.hat));
  $('#star-count').textContent = progress.totalStars;
  $('.chip-jar i').style.width = `${(progress.jar / JAR_SIZE) * 100}%`;
  for (const g of GAMES) {
    const got = progress.starsFor(g.id);
    $(`[data-game="${g.id}"] .card-stars`).innerHTML = got ? `${ICONS.star}${got}` : '';
  }
}

/* ───────────────────────────────── players ─────────────────────────────── */

const title = (s) => s[0].toUpperCase() + s.slice(1);
const escape = (s) => s.replace(/[&<>"]/g, (c) => `&#${c.charCodeAt(0)};`);
const hello = () => audio.speak(`Hello ${progress.name || 'there'}! Pick a game to play!`);

/** A row of big picture buttons. `cells` are { label, art, onPick }. */
function pickerSheet(heading, cells, kind = '') {
  openSheet(`<h2>${heading}</h2><div class="picker">${cells.map((c) =>
    `<button type="button" class="pick ${c.kind || ''}"><span></span>${escape(c.label)}</button>`).join('')}</div>`, kind);
  document.querySelectorAll('.pick').forEach((btn, i) => {
    btn.firstChild.append(cells[i].art);
    btn.addEventListener('click', () => { audio.boing(); cells[i].onPick(); });
  });
}

function choosePlayer() {
  if (!progress.player.buddy) { newPlayer(); return; }
  const cells = progress.players.map((p, i) => ({
    label: p.name || title(p.buddy),
    art: engine.snapshot(p.buddy, 220, p.hat),
    onPick: () => { progress.switchTo(i); showHome(hello); },
  }));
  if (cells.length < MAX_PLAYERS) cells.push({ label: 'New player', art: '+', kind: 'add', onPick: newPlayer });
  pickerSheet("Who's playing?", cells);
  audio.speak("Who's playing?");
}

/** Pick a buddy, say how old you are, and you are in. */
function newPlayer() {
  const must = progress.player.buddy ? '' : 'must';
  const taken = progress.players.map((p) => p.buddy);
  pickerSheet('Pick your buddy!', BUDDIES.filter((b) => !taken.includes(b)).map((buddy) => ({
    label: title(buddy),
    art: engine.snapshot(buddy, 220),
    onPick: () => {
      audio.speak(`${buddy}! How old are you?`);
      pickerSheet('How old are you?', [3, 4, 5, 6].map((age) => ({
        label: '', art: String(age), kind: 'age',
        onPick: () => { progress.addPlayer({ buddy, age }); showHome(hello); },
      })), must);
    },
  })), must);
  audio.speak('Pick your buddy!');
}

/** Straight in the first time; after that, offer the choice of level. */
function chooseGame(g) {
  audio.boing();
  engine.game.pressed?.(g.id);
  const open = progress.levelFor(g.id);
  if (open === 1 || !progress.starsFor(g.id)) {
    audio.speak(`${g.title}!`);
    location.hash = `#/play/${g.id}/${open}`;
    return;
  }
  audio.speak(`${g.title}! Pick a level.`);
  openSheet(`
    <h2 style="color:${g.tint}">${g.title}</h2>
    <div class="levels">${g.levels.map((label, i) => `
      <button class="level" type="button" data-level="${i + 1}" style="--c:${g.tint}" aria-label="Level ${i + 1}: ${label}"
              ${i + 1 > open ? 'aria-disabled="true"' : ''}>
        <b>${i + 1 > open ? ICONS.lock : i + 1}</b>
        <span class="level-stars">${stars(progress.starsFor(g.id, i + 1))}</span>
        <small>${label}</small>
      </button>`).join('')}
    </div>`);
  document.querySelectorAll('[data-level]').forEach((btn) => btn.addEventListener('click', () => {
    const level = Number(btn.dataset.level);
    if (level > open) { audio.wrong(); audio.speak(`Win two stars on level ${numberWord(open)} first!`); return; }
    audio.boing();
    location.hash = `#/play/${g.id}/${level}`;
  }));
}

/* ──────────────────────────────── dialogs ───────────────────────────────── */

function openSheet(html, kind = '') {
  $('#sheet-body').innerHTML = html;
  $('.sheet').className = `sheet ${kind}`;
  $('#overlay').hidden = false;
}
function closeSheet() {
  $('#overlay').hidden = true;
  $('#sheet-body').innerHTML = '';
  window.scrollTo(0, 0);       // iOS can leave the page nudged up after the keyboard
}

/** Every toy there is: the ones won in full colour, the rest as teasing shadows. */
async function openToyBox() {
  audio.magic();
  const owned = progress.toys;
  audio.speak(owned.length ? 'Your toy box!' : 'Play games to win toys!');
  openSheet(`
    <h2>Toy Box</h2>
    <p class="sub">${owned.length} of ${TOYS.length} found</p>
    <div class="toy-grid">${TOYS.map((t) => `<button type="button" class="toy ${owned.includes(t) ? '' : 'locked'}" data-toy="${t}"
      aria-label="${owned.includes(t) ? toyName(t) : 'Not found yet'}"></button>`).join('')}</div>`);
  const cells = [...document.querySelectorAll('[data-toy]')];
  const markHat = () => cells.forEach((c) => c.classList.toggle('worn', c.dataset.toy === progress.hat));
  markHat();
  for (const cell of cells) {
    cell.addEventListener('click', () => {
      const name = cell.dataset.toy;
      cell.classList.remove('bounce');
      void cell.offsetWidth;
      cell.classList.add('bounce');
      if (!owned.includes(name)) { audio.tap(); return; }
      audio.squeak();
      audio.speak(toyName(name));
      if (!HATS.includes(name)) return;
      progress.hat = progress.hat === name ? '' : name;
      engine.game.pal.wear(progress.hat).feel('cheer');
      refreshHome();
      markHat();
    });
  }
  // A few photographs per frame, so the sheet opens instantly.
  for (let i = 0; i < cells.length && cells[i].isConnected; i++) {
    cells[i].append(engine.snapshot(cells[i].dataset.toy, 144));
    if (i % 3 === 2) await sleep(0);
  }
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
      <div>Music<small>A gentle tune for each game</small></div>
      <button class="toggle" id="t-music" role="switch" aria-checked="${progress.music}" aria-label="Music"></button>
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
    <div class="setting-row stacked">
      <div>${title(progress.buddy)}'s player<small>The voice says hello by name. Age sets the starting level.</small></div>
      <div class="voice-controls">
        <input type="text" id="p-name" maxlength="14" placeholder="Name" value="${escape(progress.name)}" aria-label="Player name" />
        <select id="p-age" aria-label="Age">${[3, 4, 5, 6].map((a) => `<option value="${a}" ${a === progress.age ? 'selected' : ''}>Age ${a}</option>`).join('')}</select>
      </div>
    </div>
    <button class="danger" id="remove-player" type="button">Erase this player's stars and toys</button>`, 'plain');

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
  bind('t-music', () => progress.music, (v) => { progress.music = v; audio.setMusic(v); });
  bind('t-voice', () => progress.voice, (v) => { progress.voice = v; audio.setVoice(v); if (v) audio.speak('Hello!'); });

  $('#p-name').addEventListener('input', (e) => { progress.name = e.target.value; });
  $('#p-age').addEventListener('change', (e) => { progress.age = e.target.value; });
  $('#remove-player').addEventListener('click', () => {
    if (confirm('Erase this player, with all their stars and toys? This cannot be undone.')) {
      progress.removePlayer();
      showHome(choosePlayer);
    }
  });
}

/* ───────────────────────────────── router ──────────────────────────────── */

/** Iris out, swap scenes, iris in — unless another route takes over meanwhile. */
async function transition(swap) {
  const mine = ++routeId;
  const wipe = $('#wipe');
  const wasShut = wipe.classList.contains('shut');
  wipe.classList.add('shut');
  if (!wasShut) { audio.whoosh(); await sleep(420); }
  if (mine !== routeId) return;
  closeSheet();
  await swap(() => mine === routeId);
  if (mine === routeId) wipe.classList.remove('shut');
}

function showGame(id, level) {
  const entry = gameById(id);
  if (!entry) { location.hash = '#/'; return; }
  const open = progress.levelFor(id);
  const play = (lv) => transition(async (current) => {
    try {
      const mod = await entry.load();
      if (!current()) return;          // the route changed while the module downloaded
      $('#home').hidden = true;
      history.replaceState(null, '', `#/play/${id}/${lv}`);
      engine.start(mod.default, { level: lv, onReplay: play });
    } catch (err) {
      console.error('[kindercade] failed to start', id, err);
      location.hash = '#/';
    }
  });
  play(Math.min(level || open, open, LEVELS));
}

function showHome(then) {
  transition(() => {
    $('#home').hidden = false;
    engine.start(Home);
    refreshHome();
    then?.();
  });
}

/** Once per launch, find out who is holding the iPad. */
let greeted = false;
function greet() {
  if (!greeted && (progress.players.length > 1 || !progress.player.buddy)) choosePlayer();
  greeted = true;
}

function route() {
  const match = location.hash.match(/^#\/play\/([\w-]+)(?:\/(\d))?$/);
  if (match) showGame(match[1], Number(match[2]));
  else showHome(greet);
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
  registerServiceWorker();
  try {
    engine = new Engine($('#game-canvas'), new Hud($('#hud')));
  } catch (err) {
    console.error('[kindercade] no WebGL', err);
    document.body.innerHTML = '<p class="sorry">Kindercade needs 3D graphics (WebGL 2), which this browser has switched off or does not have. On an iPad, updating to iPadOS 15 or later fixes it.</p>';
    return;
  }
  // Handle for the automated tests, which play the games through real touches.
  window.kindercade = { engine, progress, GAMES, get game() { return engine.game; } };

  buildHome();
  armAudio();
  window.addEventListener('hashchange', route);
  route();

  // Nudge iPad users toward the full-screen home-screen install.
  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent)
    || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  const standalone = window.navigator.standalone || window.matchMedia('(display-mode: standalone)').matches;
  if (isIOS && !standalone) $('#install-hint').textContent = 'Tip: tap Share → Add to Home Screen for full screen.';

  // Belt and braces against Safari's double-tap-to-zoom and pinch gestures.
  document.addEventListener('gesturestart', (e) => e.preventDefault(), { passive: false });
  document.addEventListener('dblclick', (e) => e.preventDefault(), { passive: false });
}

boot();
