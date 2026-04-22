import { getPentatonicPitches } from '../utils/pentatonic.js';

// Default synthesis parameters — tunable from the test page
const DEFAULTS = {
  beta: 1.0,          // FM modulation index (0.5–2.0; 0.8–1.2 is target range)
  vibratoRate: 5.5,   // LFO frequency in Hz
  vibratoDepth: 3,    // peak vibrato depth in cents
  attackTime: 0.015,  // amplitude attack in seconds
  decayTime: 0.40,    // amplitude decay in seconds
  volume: 0.70,       // master gain (0–1)
};

export class SynthEngine {
  constructor() {
    this.ctx = null;
    this.masterGain = null;
    this.params = { ...DEFAULTS };
  }

  init() {
    this.ctx = new (window.AudioContext || window.webkitAudioContext)();
    this.masterGain = this.ctx.createGain();
    this.masterGain.gain.value = this.params.volume;
    this.masterGain.connect(this.ctx.destination);
  }

  updateParams(updates) {
    Object.assign(this.params, updates);
    if (this.masterGain) {
      this.masterGain.gain.value = this.params.volume;
    }
  }

  // ─── Core note engine ────────────────────────────────────────────────────────
  //
  // Plays a single note and returns the scheduled end time (for sequencing).
  //
  // Options:
  //   useFM        — use FM synthesis (true) or pure sine (false, for whistle replies)
  //   pitchEnd     — optional Hz for a pitch glide from pitch → pitchEnd
  //   attackTime   — override default attack
  //   vibratoDelay — seconds before vibrato fades in (default 0.08)
  //
  _note(pitch, startTime, duration, {
    useFM = true,
    pitchEnd = null,
    attackTime = null,
    vibratoDelay = 0.08,
  } = {}) {
    const ctx = this.ctx;
    const { beta, vibratoRate, vibratoDepth, decayTime } = this.params;
    const attack = attackTime ?? this.params.attackTime;
    const tail = 0.06; // extra buffer after scheduled end so oscillators decay cleanly

    // ── Carrier ──────────────────────────────────────────────────────────────
    const carrier = ctx.createOscillator();
    carrier.type = 'sine';
    carrier.frequency.setValueAtTime(pitch, startTime);
    if (pitchEnd !== null && pitchEnd !== pitch) {
      // Glide reaches pitchEnd at ~70% of the note duration
      carrier.frequency.exponentialRampToValueAtTime(pitchEnd, startTime + duration * 0.70);
    }

    // ── Amplitude envelope ───────────────────────────────────────────────────
    const envGain = ctx.createGain();
    envGain.gain.setValueAtTime(0.0001, startTime);
    envGain.gain.exponentialRampToValueAtTime(1.0, startTime + attack);
    envGain.gain.exponentialRampToValueAtTime(0.0001, startTime + duration);

    // ── Vibrato (delayed onset) ───────────────────────────────────────────────
    const lfo = ctx.createOscillator();
    lfo.type = 'sine';
    lfo.frequency.value = vibratoRate + (Math.random() * 0.6 - 0.3); // slight per-note jitter

    // Convert cents depth to Hz deviation for this specific pitch
    const depthHz = pitch * (Math.pow(2, vibratoDepth / 1200) - 1);
    const vibratoGain = ctx.createGain();
    vibratoGain.gain.setValueAtTime(0, startTime);
    const vibratoOnset = startTime + vibratoDelay;
    if (vibratoOnset < startTime + duration * 0.8) {
      vibratoGain.gain.setValueAtTime(0, vibratoOnset);
      vibratoGain.gain.linearRampToValueAtTime(depthHz, vibratoOnset + 0.07);
    }

    lfo.connect(vibratoGain);
    vibratoGain.connect(carrier.frequency);

    // ── FM modulator ─────────────────────────────────────────────────────────
    if (useFM) {
      const fm = pitch * 1.5; // modulator frequency (carrier:modulator = 1:1.5)
      const modulator = ctx.createOscillator();
      modulator.type = 'sine';
      modulator.frequency.setValueAtTime(fm, startTime);
      if (pitchEnd !== null && pitchEnd !== pitch) {
        modulator.frequency.exponentialRampToValueAtTime(pitchEnd * 1.5, startTime + duration * 0.70);
      }

      // Modulator gain = β × fm → peak frequency deviation = β × fm Hz
      const modGain = ctx.createGain();
      modGain.gain.value = beta * fm;

      modulator.connect(modGain);
      modGain.connect(carrier.frequency);

      modulator.start(startTime);
      modulator.stop(startTime + duration + tail);
    }

    // ── Wire and schedule ────────────────────────────────────────────────────
    carrier.connect(envGain);
    envGain.connect(this.masterGain);

    carrier.start(startTime);
    carrier.stop(startTime + duration + tail);
    lfo.start(startTime);
    lfo.stop(startTime + duration + tail);

    return startTime + duration;
  }

  // ─── Sound vocabulary ────────────────────────────────────────────────────────

  playChirp() {
    if (!this.ctx) return;
    const now = this.ctx.currentTime + 0.02;
    const pitches = getPentatonicPitches(800, 2800);
    const pitch = pitches[Math.floor(Math.random() * pitches.length)];
    // Downward pitch glide: -80 to -180 cents
    const glideCents = -(80 + Math.random() * 100);
    const pitchEnd = pitch * Math.pow(2, glideCents / 1200);
    this._note(pitch, now, 0.45, { pitchEnd, attackTime: 0.010 });
  }

  playTwoNotePhrase() {
    if (!this.ctx) return;
    let t = this.ctx.currentTime + 0.02;
    const pitches = getPentatonicPitches(700, 2000);
    // Pick a starting index with room for at least one step up
    const idx = Math.floor(Math.random() * (pitches.length - 1));
    const p1 = pitches[idx];
    const p2 = pitches[idx + 1]; // ascending pentatonic step
    t = this._note(p1, t, 0.25, { attackTime: 0.010 });
    t += 0.04; // inter-note gap
    this._note(p2, t, 0.32, { attackTime: 0.012 });
  }

  playGreeting() {
    if (!this.ctx) return;
    let t = this.ctx.currentTime + 0.02;
    const pitches = getPentatonicPitches(1000, 2800);
    if (pitches.length < 3) return;
    // Two-note ascending call, wider interval (skip one step), faster & brighter
    const idx = Math.floor(Math.random() * (pitches.length - 2));
    const p1 = pitches[idx];
    const p2 = pitches[idx + 2]; // pentatonic third (two steps)
    t = this._note(p1, t, 0.18, { attackTime: 0.008, vibratoDelay: 0.05 });
    t += 0.025;
    this._note(p2, t, 0.28, { attackTime: 0.008, vibratoDelay: 0.06 });
  }

  // For M1, detectedPitch is a fixed value supplied by the caller (e.g. 880 Hz)
  playReply(detectedPitch = 880) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime + 0.02;
    // Pure sine (no FM) — mimics the human's whistle
    // Small random pitch variation ±50 cents
    const centsOffset = (Math.random() * 100) - 50;
    const pitch = detectedPitch * Math.pow(2, centsOffset / 1200);
    this._note(pitch, t, 0.40, { useFM: false, attackTime: 0.015, vibratoDelay: 0.06 });
  }

  // For M1, detectedPitch is fixed; Flower responds a pentatonic third above
  playEcho(detectedPitch = 880) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime + 0.02;
    const pitches = getPentatonicPitches(600, 3200);
    // Find nearest pentatonic pitch to detectedPitch, then step up 2 (a third)
    const idx = pitches.reduce((best, p, i) =>
      Math.abs(p - detectedPitch) < Math.abs(pitches[best] - detectedPitch) ? i : best, 0);
    const harmonyIdx = Math.min(idx + 2, pitches.length - 1);
    this._note(pitches[harmonyIdx], t, 0.38, { attackTime: 0.010 });
  }

  playSong(song) {
    if (!this.ctx || !song) return;
    let t = this.ctx.currentTime + 0.05;
    for (const note of song.melody) {
      t = this._note(note.pitch, t, note.duration, { attackTime: 0.015 });
      t += note.gap;
    }
  }

  playHarmony(song) {
    if (!this.ctx || !song) return;
    let t = this.ctx.currentTime + 0.05;
    for (const note of song.harmony) {
      t = this._note(note.pitch, t, note.duration, { attackTime: 0.015 });
      t += note.gap;
    }
  }
}
