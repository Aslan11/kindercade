/**
 * All sound is synthesised with the Web Audio API — there are no audio files to
 * download, so the whole arcade stays tiny and works offline.
 *
 * iPad note: Safari will not start an AudioContext outside a user gesture, so
 * `unlock()` must be called from a real touch/click handler. The shell does this
 * on the very first tap anywhere in the app.
 */

import { clamp, pick } from './util.js';
import { LETTER_NAME } from '../data/words.js';

const NOTE = {
  C3: 130.81, D3: 146.83, E3: 164.81, F3: 174.61, G3: 196.0, A3: 220.0, B3: 246.94,
  C4: 261.63, D4: 293.66, E4: 329.63, F4: 349.23, G4: 392.0, A4: 440.0, B4: 493.88,
  C5: 523.25, D5: 587.33, E5: 659.25, F5: 698.46, G5: 783.99, A5: 880.0, B5: 987.77,
  C6: 1046.5, D6: 1174.66, E6: 1318.51, G6: 1567.98,
};

/** The n-th note of C major pentatonic, starting from middle C. */
const scaleNote = (n) => NOTE.C4 * 2 ** ((Math.floor(n / 5) * 12 + [0, 2, 4, 7, 9][n % 5]) / 12);

class AudioKit {
  constructor() {
    this.ctx = null;
    this.master = null;   // sound effects
    this.musicBus = null; // background music, ducked under speech
    this.muted = false;
    this.musicOn = true;
    this.voiceOn = true;
    this.unlocked = false;
    this._voice = null;
    this._voices = [];
    this._voicesReady = false;
    this._voiceListener = null;
    this._preferredURI = null;
    this._rateScale = 1;
    // Bumped by stopSpeech(); queued/delayed utterances check it so speech
    // scheduled by a game cannot fire after the child has left that game.
    this._speechEpoch = 0;
    // One queue for the whole arcade — see the speech section below.
    this._queue = [];
    this._current = null;
    this._timer = null;
    this._watchdog = null;
    this._cancelledAt = -1e9;
    this._lastRequest = null;
  }

  /* ---------------------------------------------------------------- lifecycle */

  /** Safe to call repeatedly; only the first call inside a gesture does work. */
  unlock() {
    try {
      if (!this.ctx) {
        const Ctor = window.AudioContext || window.webkitAudioContext;
        if (!Ctor) return;
        this.ctx = new Ctor();
        this.master = this.ctx.createGain();
        this.master.gain.value = this.muted ? 0 : 0.5;
        this.master.connect(this.ctx.destination);
        this.musicBus = this.ctx.createGain();
        this.musicBus.gain.value = 0;
        this.musicBus.connect(this.ctx.destination);
      }
      // iOS parks the context in 'interrupted' after a call or a trip to the lock screen.
      if (this.ctx.state !== 'running') this.ctx.resume();
      // A silent blip fully "arms" audio on iOS.
      if (!this.unlocked) {
        const o = this.ctx.createOscillator();
        const g = this.ctx.createGain();
        g.gain.value = 0.0001;
        o.connect(g).connect(this.master);
        o.start();
        o.stop(this.ctx.currentTime + 0.02);
        this.unlocked = true;
      }
      this._primeVoices();
    } catch (_) { /* audio is a nice-to-have; never let it break a game */ }
  }

  /**
   * iOS will not talk until one utterance has come from inside a *click* — a
   * finger merely landing does not count — and ours all start from timers.
   */
  primeSpeech() {
    try {
      const u = new SpeechSynthesisUtterance(' ');
      u.volume = 0;
      speechSynthesis.speak(u);
    } catch (_) { /* no speech on this device */ }
  }

  /** Sound effects only — talking and music each have a switch of their own. */
  setMuted(v) {
    this.muted = !!v;
    if (this.master) this.master.gain.value = this.muted ? 0 : 0.5;
  }

  setMusic(v) { this.musicOn = !!v; }

  /** True while the voice has something to say (drives the buddy's mouth and ducking). */
  get speaking() { return !!this._current; }

  setVoice(v) {
    this.voiceOn = !!v;
    if (!this.voiceOn) this.stopSpeech();
  }

  get now() { return this.ctx ? this.ctx.currentTime : 0; }

  /* ------------------------------------------------------------------ synthesis */

  /**
   * One synthesised note.
   * @param {object} o
   * @param {number} o.freq      Hz
   * @param {number} o.dur       seconds
   * @param {string} o.type      oscillator wave
   * @param {number} o.vol       0..1
   * @param {number} o.at        offset from now, seconds
   * @param {number} o.slide     target freq to glide to (optional)
   */
  tone({ freq = 440, dur = 0.18, type = 'sine', vol = 0.3, at = 0, slide = 0, attack = 0.008, bus = null }) {
    if (!this.ctx || (this.muted && !bus)) return;
    const t0 = this.ctx.currentTime + at;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t0);
    if (slide) osc.frequency.exponentialRampToValueAtTime(Math.max(20, slide), t0 + dur);

    gain.gain.setValueAtTime(0.0001, t0);
    gain.gain.exponentialRampToValueAtTime(clamp(vol, 0.0002, 1), t0 + attack);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);

    osc.connect(gain).connect(bus || this.master);
    osc.start(t0);
    osc.stop(t0 + dur + 0.05);
  }

  /** Short filtered noise burst — used for pops, whooshes and shuffles. */
  noise({ dur = 0.12, vol = 0.2, at = 0, freq = 1200, q = 1, type = 'bandpass', sweep = 0, bus = null }) {
    if (!this.ctx || (this.muted && !bus)) return;
    const t0 = this.ctx.currentTime + at;
    // One second of static, made once and looped from a random spot.
    if (!this._static) {
      this._static = this.ctx.createBuffer(1, this.ctx.sampleRate, this.ctx.sampleRate);
      const data = this._static.getChannelData(0);
      for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    }
    const src = this.ctx.createBufferSource();
    src.buffer = this._static;
    src.loop = true;
    const filter = this.ctx.createBiquadFilter();
    filter.type = type;
    filter.frequency.setValueAtTime(freq, t0);
    if (sweep) filter.frequency.exponentialRampToValueAtTime(Math.max(60, sweep), t0 + dur);
    filter.Q.value = q;
    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(vol, t0);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);

    src.connect(filter).connect(gain).connect(bus || this.master);
    src.start(t0, Math.random() * 0.9);
    src.stop(t0 + dur + 0.02);
  }

  /** A struck wooden bar: the voice of most of the arcade's little tunes. */
  mallet(freq, { vol = 0.22, at = 0, dur = 0.42, bus = null } = {}) {
    this.tone({ freq, dur, vol, at, bus, attack: 0.004 });
    this.tone({ freq: freq * 4, dur: dur * 0.16, vol: vol * 0.3, at, bus, attack: 0.002 });
  }

  /** A small bright bell. */
  chime(freq, { vol = 0.14, at = 0, dur = 0.8, bus = null } = {}) {
    this.tone({ freq, dur, vol, at, bus, attack: 0.003 });
    this.tone({ freq: freq * 2.76, dur: dur * 0.4, vol: vol * 0.35, at, bus, attack: 0.002 });
  }

  /* ---------------------------------------------------------------- sound cues */

  /** Generic light UI tap. */
  tap() { this.tone({ freq: 620, dur: 0.07, vol: 0.18, slide: 900 }); }

  /** Picking something up / starting a drag. */
  pick() { this.tone({ freq: 480, dur: 0.1, vol: 0.2, slide: 760 }); }

  /** Dropping something into place. */
  place() {
    this.tone({ freq: 300, dur: 0.12, type: 'triangle', vol: 0.28, slide: 170 });
    this.noise({ dur: 0.05, vol: 0.1, freq: 1100 });
  }

  pop() {
    const k = 0.85 + Math.random() * 0.4;
    this.tone({ freq: 520 * k, dur: 0.08, vol: 0.3, slide: 1500 * k });
    this.noise({ dur: 0.09, vol: 0.28, freq: 2400, q: 0.8, sweep: 700 });
  }

  whoosh() { this.noise({ dur: 0.34, vol: 0.14, freq: 500, sweep: 2600, q: 1.2 }); }
  swoop() { this.noise({ dur: 0.3, vol: 0.12, freq: 2200, sweep: 350, q: 1.2 }); }

  /** A rubbery bounce. `k` shifts the pitch so a crowd does not boing in unison. */
  boing(k = 0.9 + Math.random() * 0.4) {
    this.tone({ freq: 190 * k, dur: 0.2, type: 'triangle', vol: 0.2, slide: 520 * k });
    this.tone({ freq: 520 * k, dur: 0.12, vol: 0.08, slide: 380 * k, at: 0.14 });
  }

  /** A squeaky-toy chirp for anything with a face. */
  squeak(k = 0.85 + Math.random() * 0.5) {
    this.tone({ freq: 760 * k, dur: 0.08, type: 'triangle', vol: 0.13, slide: 1150 * k });
    this.tone({ freq: 1100 * k, dur: 0.1, type: 'triangle', vol: 0.11, slide: 820 * k, at: 0.08 });
  }

  giggle() { [0, 1, 2, 3].forEach((i) => this.tone({ freq: 900 - i * 70, dur: 0.07, type: 'triangle', vol: 0.12, slide: 1150 - i * 80, at: i * 0.085 })); }
  plop() { this.tone({ freq: 240, dur: 0.13, vol: 0.28, slide: 620 }); }
  flip() { this.noise({ dur: 0.1, vol: 0.14, freq: 1500, sweep: 3600, q: 1.6 }); }
  rustle() { for (let i = 0; i < 5; i++) this.noise({ dur: 0.08, vol: 0.07, freq: 3200 + i * 300, q: 0.7, at: i * 0.06 }); }
  ding() { this.chime(NOTE.E6, { vol: 0.24, dur: 1.2 }); }
  coin() { this.tone({ freq: NOTE.B5, dur: 0.07, type: 'square', vol: 0.05 }); this.tone({ freq: NOTE.E6, dur: 0.3, type: 'square', vol: 0.05, at: 0.07 }); }
  chuff() { this.noise({ dur: 0.16, vol: 0.13, freq: 900, sweep: 300, q: 0.6 }); }
  honk() { for (const at of [0, 0.2]) for (const f of [392, 494]) this.tone({ freq: f, dur: 0.15, type: 'sawtooth', vol: 0.045, at, attack: 0.02 }); }

  chomp() {
    this.noise({ dur: 0.07, vol: 0.24, freq: 1500, q: 1.4 });
    this.noise({ dur: 0.09, vol: 0.18, freq: 800, q: 1.2, at: 0.07 });
    this.tone({ freq: 210, dur: 0.1, vol: 0.14, slide: 120, at: 0.04 });
  }

  shutter() {
    this.noise({ dur: 0.04, vol: 0.3, freq: 3400, q: 1 });
    this.noise({ dur: 0.07, vol: 0.24, freq: 1700, q: 1, at: 0.08 });
  }

  /** Steam whistle: toot tooooot. */
  toot() {
    [[0, 0.22], [0.3, 0.6]].forEach(([at, dur]) => {
      for (const f of [587, 740, 880]) this.tone({ freq: f, dur, type: 'triangle', vol: 0.09, at, attack: 0.04 });
      this.noise({ dur, vol: 0.04, freq: 3000, at });
    });
  }

  /** A rising shimmer, for anything appearing out of nowhere. */
  magic() { [0, 2, 4, 5, 7, 9, 10].forEach((n, i) => this.chime(scaleNote(n + 5), { at: i * 0.045, vol: 0.07, dur: 0.5 })); }

  drumroll(dur = 0.9) {
    for (let t = 0; t < dur; t += 0.045) this.noise({ dur: 0.05, vol: 0.05 + (t / dur) * 0.1, freq: 700, q: 0.8, at: t });
  }

  /** Counting/step-up note: climbs a pentatonic scale, so any run sounds like a tune. */
  step(index = 0, o = {}) { this.mallet(scaleNote(index % 13), o); }

  /** Correct answer. A streak lifts the key, so being on a roll is audible. */
  correct(streak = 0) {
    const k = 2 ** (Math.min(streak, 5) / 6);
    [NOTE.C5, NOTE.E5, NOTE.G5, NOTE.C6].forEach((f, i) => this.mallet(f * k, { at: i * 0.065, vol: 0.2 }));
    this.chime(NOTE.E6 * k, { at: 0.26, vol: 0.1 });
  }

  /**
   * Wrong answer — deliberately gentle. A five-year-old should hear "whoops",
   * never a buzzer.
   */
  wrong() {
    this.tone({ freq: 330, dur: 0.16, type: 'triangle', vol: 0.17, slide: 290 });
    this.tone({ freq: 262, dur: 0.28, type: 'triangle', vol: 0.15, slide: 220, at: 0.14 });
  }

  /** Level complete. */
  fanfare() {
    [['C5', 0], ['C5', 0.12], ['C5', 0.24], ['E5', 0.36], ['G5', 0.6], ['E5', 0.78], ['G5', 0.9], ['C6', 1.08]].forEach(([n, at], i, all) => {
      const dur = i === all.length - 1 ? 0.9 : 0.2;
      this.tone({ freq: NOTE[n], dur, type: 'triangle', vol: 0.2, at });
      this.tone({ freq: NOTE[n] / 2, dur, type: 'triangle', vol: 0.1, at });
    });
    this.sparkle(1.1);
  }

  /** A star landing; each one a step higher. */
  star(i = 0) {
    this.chime(scaleNote(7 + i * 2), { vol: 0.2 });
    this.tone({ freq: 160, dur: 0.14, vol: 0.2, slide: 80 });
  }

  sparkle(at = 0) {
    for (let i = 0; i < 5; i++) {
      this.tone({
        freq: pick([NOTE.C6, NOTE.D6, NOTE.E6, NOTE.G6]),
        dur: 0.18, type: 'sine', vol: 0.08, at: at + i * 0.05,
      });
    }
  }

  /* -------------------------------------------------------------------- speech */

  /*
   * Three separate things make browser speech sound bad, and all three are ours
   * to fix:
   *
   *   1. The wrong voice. Every platform ships a pile of low-bitrate "compact"
   *      voices alongside one or two genuinely good neural ones, and the
   *      browser's default pick is usually a bad one. `_rankVoice` hunts for the
   *      good one instead of trusting the default.
   *
   *   2. Cartoon prosody. Pitch-shifting a formant voice is exactly what makes
   *      it sound like a chipmunk, and dropping the rate too far makes it sound
   *      drunk. Neural voices are worse under both, because the shift is applied
   *      as post-processing on top of an already-natural waveform.
   *
   *   3. Overlapping utterances. `speechSynthesis.cancel()` followed immediately
   *      by `speak()` makes every engine misbehave — it stutters, repeats the
   *      opening words, or swallows them. Everything now goes through one queue,
   *      and a cancel is always given time to settle before the next utterance
   *      starts.
   */

  /**
   * How long to let a `cancel()` settle before starting the next utterance.
   * Below roughly 90 ms every engine we tested either stutters or drops the
   * first syllable of the new phrase.
   */
  static CANCEL_SETTLE_MS = 120;

  /** Two requests for the same line this close together are one double-trigger. */
  static DEDUPE_MS = 350;

  /** Neural / downloaded voice families, across every platform we care about. */
  static GOOD_VOICE = /\b(natural|neural|premium|enhanced|wavenet|studio|journey|siri)\b/i;

  /** Voices that are pleasant on their platform, by name. */
  static GOOD_NAME = /\b(samantha|ava|allison|susan|zoe|joelle|noelle|nicky|evan|serena|moira|tessa|karen|aria|jenny|emma|michelle|libby|sonia|google\s+(?:us|uk)\s+english)\b/i;

  /**
   * Voices to actively avoid. The `compact` families are the 8 kHz fallbacks
   * Apple ships before you download a real voice; the rest are the macOS
   * novelty voices, which are genuinely unusable for a child.
   */
  static BAD_VOICE = /\b(compact|eloquence|novelty|whisper|zarvox|bells|bad news|good news|albert|bahh|boing|bubbles|cellos|deranged|hysterical|jester|organ|superstar|trinoids|wobble|fred|junior|kathy|princess|ralph|rocko|shelley|sandy|flo|eddy|reed|grandma|grandpa|bruce|agnes|pipe organ)\b/i;

  /**
   * How good a voice is likely to sound. Note there is deliberately *no* bonus
   * for `localService`: on Chrome and Edge the best voices by a wide margin are
   * the network ones ("Google US English", "Microsoft Ava Online (Natural)"),
   * and the old code's local-first preference is a large part of why the arcade
   * sounded robotic on anything but an iPad.
   */
  _rankVoice(v) {
    const name = v.name || '';
    let s = 0;
    if (/^en\b|^en[-_]/i.test(v.lang || '')) s += 40; else return -100;
    if (/^en[-_]US/i.test(v.lang)) s += 10;
    else if (/^en[-_](GB|AU|CA|IE|NZ)/i.test(v.lang)) s += 6;
    if (AudioKit.GOOD_VOICE.test(name)) s += 30;
    if (AudioKit.GOOD_NAME.test(name)) s += 14;
    if (AudioKit.BAD_VOICE.test(name)) s -= 60;
    // Female voices test better with this age group and every platform has one.
    if (/\b(female|woman)\b/i.test(name)) s += 3;
    if (v.default) s += 2;
    return s;
  }

  /**
   * Build the ranked voice list. Called on every `voiceschanged` rather than
   * once, because Chrome and Edge stream the good network voices in several
   * seconds after the cheap local ones — bailing out on the first non-empty
   * list is how you end up permanently stuck with the worst voice available.
   */
  _primeVoices() {
    if (!('speechSynthesis' in window)) return;
    if (!this._voiceListener) {
      this._voiceListener = () => this._loadVoices();
      try { speechSynthesis.addEventListener('voiceschanged', this._voiceListener); } catch (_) { /* noop */ }
    }
    this._loadVoices();
  }

  _loadVoices() {
    let voices = [];
    try { voices = speechSynthesis.getVoices() || []; } catch (_) { return; }
    if (!voices.length) return;

    this._voices = voices
      .map((v) => ({ voice: v, score: this._rankVoice(v) }))
      .filter((x) => x.score > -100)
      .sort((a, b) => b.score - a.score || a.voice.name.localeCompare(b.voice.name));

    // A voice the grown-up picked in Settings always wins.
    const chosen = this._preferredURI
      && this._voices.find((x) => x.voice.voiceURI === this._preferredURI);
    this._voice = (chosen || this._voices[0])?.voice || voices[0] || null;
    this._voicesReady = true;
  }

  /** The ranked English voices, best first — used to build the Settings picker. */
  listVoices() {
    this._primeVoices();
    return (this._voices || []).map((x) => ({
      uri: x.voice.voiceURI,
      name: x.voice.name,
      lang: x.voice.lang,
      good: AudioKit.GOOD_VOICE.test(x.voice.name) || x.score >= 60,
    }));
  }

  get voiceName() { return this._voice?.name || ''; }

  /** Pin a specific voice (empty string = go back to picking automatically). */
  setPreferredVoice(uri) {
    this._preferredURI = uri || null;
    this._loadVoices();
  }

  /**
   * Global speed trim, so a grown-up can slow the whole arcade down for a child
   * who needs longer, without every call site having to know about it.
   */
  setSpeechRate(mult) { this._rateScale = clamp(Number(mult) || 1, 0.6, 1.6); }

  /** True when the chosen voice is a neural one, which must not be pitch-shifted. */
  get _voiceIsNeural() {
    return !!this._voice && AudioKit.GOOD_VOICE.test(this._voice.name || '');
  }

  /* ------------------------------------------------------------ speech queue */

  /**
   * Queue one phrase.
   *
   * @param {string} text
   * @param {object} o
   * @param {number} o.rate       0.6–1.2; the caller's *intent*, trimmed by the
   *                              user's global rate preference
   * @param {number} o.pitch      ignored for neural voices (it only hurts them)
   * @param {boolean} o.interrupt drop anything already queued. With `delay: 0`
   *                              that includes the phrase speaking right now;
   *                              with a delay it waits for it to finish
   * @param {number} o.delay      seconds to wait before this phrase starts
   * @param {number} o.gap        seconds of silence to hold *after* this phrase
   * @returns {Promise<void>} resolves when the phrase finishes (or is dropped)
   */
  speak(text, {
    rate = 0.95, pitch = 1, interrupt = true, delay = 0, gap = 0, onStart = null,
  } = {}) {
    if (!this.voiceOn || !text || !('speechSynthesis' in window)) {
      return Promise.resolve();
    }
    this._primeVoices();

    const str = String(text).trim();
    if (!str) return Promise.resolve();

    if (interrupt) {
      // Belt and braces against double-triggers: two call sites asking for the
      // same line in the same tick is a bug, not a request to say it twice.
      // Only interrupting calls are checked — a queued sequence is allowed to
      // repeat itself (spelling "egg" really does need two of the same letter).
      const now = this._clock();
      const prev = this._lastRequest;
      if (prev && prev.text === str && now - prev.at < AudioKit.DEDUPE_MS) return Promise.resolve();
      this._lastRequest = { text: str, at: now };
      // A line asked for *later* clears the queue now, but must not cut off the
      // phrase speaking at this instant — cancelling a quarter of a second
      // before the new line starts is exactly what "the voice interrupts
      // itself" sounds like. It waits its turn and counts its delay from there.
      this._flush({ keepCurrent: delay > 0 });
    }

    let resolve;
    const done = new Promise((r) => { resolve = r; });
    this._queue.push({
      text: str, rate, pitch, delay, gap, done, resolve, onStart,
      epoch: this._speechEpoch,
    });
    this._pump();
    return done;
  }

  /**
   * Queue a whole sequence in one call.
   *
   * Games used to space their lines out on the tween clock and hope each one
   * fitted in its slot; when a voice ran long the next line cut it off
   * mid-word. Queueing means each phrase simply starts when the one before it
   * has actually finished.
   *
   * @param {Array<string|object>} parts strings, or `{ text, rate, gap, onStart }`
   */
  say(parts, { interrupt = true, delay = 0 } = {}) {
    const list = (Array.isArray(parts) ? parts : [parts]).filter(Boolean);
    let out = Promise.resolve();
    list.forEach((part, i) => {
      const o = typeof part === 'string' ? { text: part } : part;
      out = this.speak(o.text, {
        rate: o.rate ?? 0.95,
        pitch: o.pitch ?? 1,
        gap: o.gap ?? 0.18,
        delay: o.delay ?? (i === 0 ? delay : 0),
        interrupt: interrupt && i === 0,
        onStart: o.onStart,
      });
    });
    return out;
  }

  /**
   * Drop everything pending without bumping the epoch (used by `interrupt`).
   *
   * `keepCurrent` leaves the utterance that is actually speaking alone: the
   * queue behind it is still cleared, but it gets to finish its sentence and
   * the next line starts when it ends.
   */
  _flush({ keepCurrent = false } = {}) {
    for (const item of this._queue) item.resolve?.();
    this._queue.length = 0;
    if (this._timer) { clearTimeout(this._timer); this._timer = null; }
    // Nothing to cancel, and the watchdog belongs to the line we are sparing.
    if (keepCurrent && this._current) return;
    if (this._watchdog) { clearTimeout(this._watchdog); this._watchdog = null; }
    if (this._current) {
      this._current.resolve?.();
      this._current = null;
    }
    try { speechSynthesis.cancel(); } catch (_) { /* noop */ }
    // The whole point: remember *when* we cancelled, so `_pump` can wait for the
    // engine to actually come to a stop before it starts the next utterance.
    this._cancelledAt = this._clock();
  }

  _clock() {
    try { return performance.now(); } catch (_) { return 0; }
  }

  /** Rough spoken length, used only to catch a lost `onend`. */
  _estimateMs(text, rate) {
    return (String(text).length / 12) * 1000 / Math.max(0.4, rate) + 900;
  }

  _pump() {
    if (this._current || this._timer || !this._queue.length) return;

    const item = this._queue[0];
    if (item.epoch !== this._speechEpoch) {
      this._queue.shift();
      item.resolve?.();
      return this._pump();
    }

    // Pin the delay to a fixed moment the first time this item reaches the
    // front of the queue. Re-reading `delay` on every pass would reschedule the
    // same item forever, since the delay never elapses relative to "now".
    if (item.startAt == null) item.startAt = this._clock() + (item.delay || 0) * 1000;

    // Never call speak() hard up against a cancel() — that race is what makes
    // engines stutter ("can you — can you finish the picture?").
    const settleUntil = (this._cancelledAt || -1e9) + AudioKit.CANCEL_SETTLE_MS;
    const wait = Math.max(item.startAt, settleUntil) - this._clock();
    if (wait > 0) {
      this._timer = setTimeout(() => { this._timer = null; this._pump(); }, wait);
      return;
    }

    this._queue.shift();
    this._current = item;

    const finish = () => {
      if (this._current !== item) return;
      this._current = null;
      if (this._watchdog) { clearTimeout(this._watchdog); this._watchdog = null; }
      item.resolve?.();
      const gap = Math.max(0, (item.gap || 0) * 1000);
      if (gap > 0) this._timer = setTimeout(() => { this._timer = null; this._pump(); }, gap);
      else this._pump();
    };

    try {
      const u = new SpeechSynthesisUtterance(item.text);
      if (this._voice) u.voice = this._voice;
      u.lang = this._voice?.lang || 'en-US';
      u.rate = clamp(item.rate * (this._rateScale || 1), 0.5, 1.5);
      // Neural voices are pitch-shifted as post-processing, which is audibly
      // worse than leaving them alone. Formant voices take a very small lift.
      u.pitch = this._voiceIsNeural ? 1 : clamp(item.pitch, 0.85, 1.2);
      u.volume = 1;
      u.onend = finish;
      u.onerror = finish;
      item.onStart?.();
      speechSynthesis.speak(u);
      // Some engines simply never fire `onend` (a backgrounded tab, or Safari
      // after an interrupted utterance). Without this the queue would wedge.
      this._watchdog = setTimeout(finish, Math.min(this._estimateMs(item.text, u.rate) * 2 + 500, 15000));
    } catch (_) {
      finish();
    }
  }

  /**
   * Say a word letter-by-letter, then the whole word.
   *
   * The letter *names* are spelled out phonetically: asked to read a bare "A",
   * most engines produce the unstressed article ("uh") rather than the letter
   * name, which is the opposite of what a child learning to spell needs.
   */
  spellOut(word, { onLetter = null, letterGap = 0.26, delay = 0.2 } = {}) {
    if (!this.voiceOn) return Promise.resolve();
    String(word).split('').forEach((ch, i) => {
      this.speak(LETTER_NAME[ch.toLowerCase()] || ch.toUpperCase(), {
        rate: 0.85,
        gap: letterGap,
        // The first letter clears anything queued, but a line still speaking —
        // typically the sound of the letter that just completed the word — is
        // allowed to finish rather than being chopped off mid-breath.
        interrupt: i === 0,
        delay: i === 0 ? delay : 0,
        onStart: () => onLetter?.(i, ch),
      });
    });
    return this.speak(word, { rate: 0.8, delay: 0.2, interrupt: false });
  }

  /**
   * Clear the queue and invalidate anything a game had scheduled. `finishLine`
   * spares the phrase being spoken right now.
   */
  stopSpeech({ finishLine = false } = {}) {
    this._speechEpoch++;
    this._flush({ keepCurrent: finishLine });
  }
}

export const audio = new AudioKit();

