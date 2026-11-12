/**
 * Background music: one small tune per place, played by a tiny synthesised band
 * (marimba, bells, plucked bass, shaker). It ducks right down whenever the
 * voice is talking, because the voice is the instruction manual.
 *
 * Tunes are written in scale degrees, eight steps to a bar:
 *   1-7 the scale · 8 9 a b the octave above · v w x the 5th, 6th, 7th below
 *   .   rest
 */

import { audio } from './audio.js';

const TUNES = {
  home: { bpm: 104, key: 0, chords: '16451645', tune: '3.5.8.5. 6.5.3... 4.6.8.6. 5.4.2... 3.5.8.9. a.9.8.6. 4.6.5.4. 2.7.5...' },
  farm: { bpm: 112, key: 2, chords: '11451141', tune: '1.1.3.5. 5.3.1... 4.4.6.4. 2.2.5... 1.3.5.8. 8.5.3.5. 6.4.6.8. 5.3.1...' },
  fair: { bpm: 120, key: 5, chords: '15514151', tune: '5.3.5.8. 7.5.2... 4.2.4.7. 8.5.3... 6.8.6.4. 5.8.5.3. 2.4.7.9. 8.8.8...' },
  bakery: { bpm: 96, key: 3, chords: '16251625', tune: '3..5..3. 1..3..w. 2..4..6. 5...x... 3..5..8. 6..5..3. 4..2..4. 5...5...' },
  safari: { bpm: 100, key: 7, chords: '14151415', tune: '1..3.5.. 6..4.1.. 3..5.3.. 2...v... 5..3.5.. 8..6.4.. 3..1.3.. 2...x...', drums: 'x..x..x.' },
  train: { bpm: 126, key: 0, chords: '11441155', tune: '5.5.3.5. 8...5... 6.6.4.6. 8...6... 5.3.1.3. 5.8.5.3. 2.3.4.2. 5...7...', drums: 'x.x.x.x.' },
  draw: { bpm: 84, key: 5, chords: '14145614', tune: '3...5... 6...4... 5...3... 4...1... 2...5... 3...6... 5...3... 4...2...' },
  magic: { bpm: 88, key: 9, chords: '64156451', tune: '6.3.8.6. 4.6.8... 5.3.1.3. 2.5.7... 8.6.3.6. 6.4.1.4. 5.7.9.7. 8...5...', lead: 'chime' },
  party: { bpm: 112, key: 0, chords: '11441155', tune: '', drums: 'x...x...' },
  sea: { bpm: 92, key: 7, chords: '14511451', tune: '1.3.5... 6.4.6... 5.2.5... 3...1... 5.3.1... 4.6.8... 7.5.2... 1.......' },
  space: { bpm: 72, key: 0, chords: '14651465', tune: '' },
  robot: { bpm: 108, key: 4, chords: '61456145', tune: '6.6.3.6. 5.5.1... 4.4.6.4. 2.5.7... 8.8.6.3. 5.3.1... 6.4.1.4. 5.5.5...', drums: 'x..xx...' },
  garden: { bpm: 80, key: 2, chords: '15641545', tune: '5..3..1. 2..5..7. 8..6..3. 4..6.... 3..5..8. 7..5..2. 4..6..4. 2..5....', lead: 'chime' },
};

const MAJOR = [0, 2, 4, 5, 7, 9, 11];
const DEGREE = { v: -3, w: -2, x: -1, 8: 7, 9: 8, a: 9, b: 10 };
const LEVEL = 0.2;      // full music volume
const DUCKED = 0.035;   // …and while someone is talking

const pitch = (key, degree, octave = 0) => {
  const o = Math.floor(degree / 7);
  return 261.63 * 2 ** ((key + MAJOR[degree - o * 7] + (o + octave) * 12) / 12);
};

class Music {
  constructor() {
    this.song = null;
    this.stepIndex = 0;
    this.nextAt = 0;
    this.level = -1;
  }

  /** Start a tune from the top (`null` for silence). */
  play(name) {
    const t = TUNES[name];
    this.song = t ? { ...t, notes: t.tune.replace(/ /g, '') } : null;
    this.stepIndex = 0;
    this.nextAt = 0;
  }

  /** Seconds per beat, so things on screen can dance in time. */
  get beat() { return 60 / (this.song?.bpm || 110); }

  /** Called every frame: keeps a little music scheduled ahead of the clock. */
  update() {
    const { ctx, musicBus: bus } = audio;
    if (!ctx || !bus) return;
    const on = this.song && audio.musicOn && ctx.state === 'running';
    const want = !on ? 0 : audio.speaking ? DUCKED : LEVEL;
    if (want !== this.level) {
      this.level = want;
      bus.gain.setTargetAtTime(want, ctx.currentTime, want < LEVEL ? 0.06 : 0.6);
    }
    if (!on) { this.nextAt = 0; return; }
    const now = ctx.currentTime;
    if (this.nextAt < now) this.nextAt = now + 0.08;
    while (this.nextAt < now + 0.2) {
      this.playStep(this.stepIndex++, this.nextAt - now, bus);
      this.nextAt += this.beat / 2;
    }
  }

  playStep(i, at, bus) {
    const s = this.song;
    const bars = s.chords.length;
    const step = i % 8;
    const bar = Math.floor(i / 8) % bars;
    const pass = Math.floor(i / (8 * bars)) % 3;
    const root = Number(s.chords[bar]) - 1;

    if (step === 0 || step === 4) {
      audio.tone({ freq: pitch(s.key, root + (step ? 4 : 0), -2), dur: 0.34, type: 'triangle', vol: 0.5, at, bus });
    }
    if (step === 2 || step === 6) {
      [0, 2, 4].forEach((k, n) => audio.tone({ freq: pitch(s.key, root + k, -1), dur: 0.16, type: 'triangle', vol: 0.11, at: at + n * 0.012, bus }));
    }
    if (step % 2) audio.noise({ dur: 0.035, vol: 0.05, freq: 7000, type: 'highpass', at, bus });
    if (s.drums?.[step] === 'x') audio.tone({ freq: 150, slide: 60, dur: 0.12, vol: 0.4, at, bus });

    // Tune, tune again on bells, then a verse off so it never wears a groove.
    const ch = s.notes[bar * 8 + step];
    if (!ch || ch === '.' || pass === 2) return;
    const freq = pitch(s.key, DEGREE[ch] ?? Number(ch) - 1, 0);
    if (pass === 1 || s.lead === 'chime') audio.chime(freq * 2, { vol: 0.2, at, bus });
    else audio.mallet(freq, { vol: 0.42, at, bus });
  }
}

export const music = new Music();
