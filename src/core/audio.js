/**
 * All sound is synthesised with the Web Audio API — there are no audio files to
 * download, so the whole arcade stays tiny and works offline.
 *
 * iPad note: Safari will not start an AudioContext outside a user gesture, so
 * `unlock()` must be called from a real touch/click handler. The shell does this
 * on the very first tap anywhere in the app.
 */

import { clamp, pick } from './util.js';

const NOTE = {
  C3: 130.81, D3: 146.83, E3: 164.81, F3: 174.61, G3: 196.0, A3: 220.0, B3: 246.94,
  C4: 261.63, D4: 293.66, E4: 329.63, F4: 349.23, G4: 392.0, A4: 440.0, B4: 493.88,
  C5: 523.25, D5: 587.33, E5: 659.25, F5: 698.46, G5: 783.99, A5: 880.0, B5: 987.77,
  C6: 1046.5, D6: 1174.66, E6: 1318.51, G6: 1567.98,
};

class AudioKit {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.muted = false;
    this.voiceOn = true;
    this.unlocked = false;
    this._voice = null;
    this._voicesReady = false;
    // Bumped by stopSpeech(); queued/delayed utterances check it so speech
    // scheduled by a game cannot fire after the child has left that game.
    this._speechEpoch = 0;
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
        this.master.gain.value = 0.5;
        this.master.connect(this.ctx.destination);
      }
      if (this.ctx.state === 'suspended') this.ctx.resume();
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

  setMuted(v) {
    this.muted = !!v;
    if (this.master) this.master.gain.value = this.muted ? 0 : 0.5;
    if (this.muted) this.stopSpeech();
  }

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
  tone({ freq = 440, dur = 0.18, type = 'sine', vol = 0.3, at = 0, slide = 0, attack = 0.008 }) {
    if (!this.ctx || this.muted) return;
    const t0 = this.ctx.currentTime + at;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t0);
    if (slide) osc.frequency.exponentialRampToValueAtTime(Math.max(20, slide), t0 + dur);

    gain.gain.setValueAtTime(0.0001, t0);
    gain.gain.exponentialRampToValueAtTime(clamp(vol, 0.0002, 1), t0 + attack);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);

    osc.connect(gain).connect(this.master);
    osc.start(t0);
    osc.stop(t0 + dur + 0.05);
  }

  /** Short filtered noise burst — used for pops, whooshes and shuffles. */
  noise({ dur = 0.12, vol = 0.2, at = 0, freq = 1200, q = 1, type = 'bandpass', sweep = 0 }) {
    if (!this.ctx || this.muted) return;
    const t0 = this.ctx.currentTime + at;
    const len = Math.max(1, Math.floor(this.ctx.sampleRate * dur));
    const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;

    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    const filter = this.ctx.createBiquadFilter();
    filter.type = type;
    filter.frequency.setValueAtTime(freq, t0);
    if (sweep) filter.frequency.exponentialRampToValueAtTime(Math.max(60, sweep), t0 + dur);
    filter.Q.value = q;
    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(vol, t0);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);

    src.connect(filter).connect(gain).connect(this.master);
    src.start(t0);
    src.stop(t0 + dur + 0.02);
  }

  arpeggio(notes, { step = 0.075, dur = 0.26, type = 'triangle', vol = 0.26, at = 0 } = {}) {
    notes.forEach((n, i) => {
      const freq = typeof n === 'string' ? NOTE[n] : n;
      this.tone({ freq, dur, type, vol, at: at + i * step });
    });
  }

  /* ---------------------------------------------------------------- sound cues */

  /** Generic light UI tap. */
  tap() { this.tone({ freq: 880, dur: 0.06, type: 'sine', vol: 0.16 }); }

  /** Picking something up / starting a drag. */
  pick() { this.tone({ freq: 520, dur: 0.09, type: 'sine', vol: 0.18, slide: 720 }); }

  /** Dropping something into place. */
  place() {
    this.tone({ freq: 420, dur: 0.1, type: 'triangle', vol: 0.22, slide: 300 });
    this.noise({ dur: 0.06, vol: 0.06, freq: 900 });
  }

  pop() {
    this.tone({ freq: 700, dur: 0.07, type: 'sine', vol: 0.22, slide: 1400 });
    this.noise({ dur: 0.05, vol: 0.12, freq: 2200, q: 2 });
  }

  whoosh() { this.noise({ dur: 0.3, vol: 0.1, freq: 1800, sweep: 300, q: 0.8 }); }

  /** Counting/step-up blip: pitch rises with `index`. */
  step(index = 0) {
    const scale = [NOTE.C5, NOTE.D5, NOTE.E5, NOTE.G5, NOTE.A5, NOTE.C6];
    this.tone({ freq: scale[index % scale.length], dur: 0.12, type: 'triangle', vol: 0.2 });
  }

  /** Correct answer — bright and short. */
  correct() {
    this.arpeggio(['E5', 'G5', 'C6'], { step: 0.06, dur: 0.22, vol: 0.24 });
    this.tone({ freq: NOTE.E6, dur: 0.35, type: 'sine', vol: 0.1, at: 0.14 });
  }

  /**
   * Wrong answer — deliberately gentle. A five-year-old should hear "try again",
   * never a buzzer. Two soft, low, warm notes.
   */
  wrong() {
    this.tone({ freq: NOTE.A3, dur: 0.16, type: 'sine', vol: 0.16 });
    this.tone({ freq: NOTE.F3, dur: 0.26, type: 'sine', vol: 0.14, at: 0.12 });
  }

  /** Level complete. */
  fanfare() {
    this.arpeggio(['C5', 'E5', 'G5', 'C6', 'E6'], { step: 0.09, dur: 0.4, vol: 0.24, type: 'triangle' });
    this.arpeggio(['C4', 'G4'], { step: 0.09, dur: 0.9, vol: 0.12, type: 'sine', at: 0.36 });
    this.sparkle(0.4);
  }

  /** Star earned. */
  star() {
    this.arpeggio(['G5', 'C6', 'E6'], { step: 0.05, dur: 0.3, vol: 0.2 });
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

  _primeVoices() {
    if (this._voicesReady || !('speechSynthesis' in window)) return;
    const load = () => {
      const voices = speechSynthesis.getVoices();
      if (!voices.length) return;
      // Prefer a natural-sounding en-US voice; Safari on iPadOS exposes Samantha.
      const score = (v) => {
        let s = 0;
        if (/^en[-_]/i.test(v.lang)) s += 10;
        if (/^en[-_]US/i.test(v.lang)) s += 5;
        if (/samantha|ava|allison|karen|siri|google us/i.test(v.name)) s += 6;
        if (/compact|eloquence|novelty|whisper|zarvox|bells|bad news/i.test(v.name)) s -= 20;
        if (v.localService) s += 2;
        return s;
      };
      this._voice = voices.slice().sort((a, b) => score(b) - score(a))[0] || null;
      this._voicesReady = true;
    };
    load();
    if (!this._voicesReady) speechSynthesis.addEventListener('voiceschanged', load, { once: true });
  }

  /**
   * Speak a word or short phrase. Used constantly — this is what makes the
   * spelling games work for a child who cannot read the instructions yet.
   */
  speak(text, { rate = 0.85, pitch = 1.15, interrupt = true, delay = 0 } = {}) {
    if (!this.voiceOn || this.muted || !text || !('speechSynthesis' in window)) return;
    const epoch = this._speechEpoch;
    const fire = () => {
      if (epoch !== this._speechEpoch) return;
      try {
        if (interrupt) speechSynthesis.cancel();
        const u = new SpeechSynthesisUtterance(String(text));
        this._primeVoices();
        if (this._voice) u.voice = this._voice;
        u.lang = this._voice?.lang || 'en-US';
        u.rate = rate;
        u.pitch = pitch;
        u.volume = 1;
        speechSynthesis.speak(u);
      } catch (_) { /* speech is optional */ }
    };
    if (delay > 0) setTimeout(fire, delay * 1000);
    else fire();
  }

  /** Say a word letter-by-letter, then the whole word. */
  spellOut(word, { onLetter = null, letterGap = 0.55 } = {}) {
    if (!this.voiceOn || this.muted) return;
    const epoch = this._speechEpoch;
    const letters = String(word).split('');
    letters.forEach((ch, i) => {
      setTimeout(() => {
        if (epoch !== this._speechEpoch) return;
        this.speak(ch.toUpperCase(), { interrupt: false, rate: 0.8 });
        onLetter?.(i, ch);
      }, i * letterGap * 1000);
    });
    setTimeout(() => {
      if (epoch === this._speechEpoch) this.speak(word, { interrupt: false, rate: 0.75 });
    }, (letters.length + 0.4) * letterGap * 1000);
  }

  stopSpeech() {
    this._speechEpoch++;
    try { if ('speechSynthesis' in window) speechSynthesis.cancel(); } catch (_) { /* noop */ }
  }
}

export const audio = new AudioKit();
export { NOTE };
