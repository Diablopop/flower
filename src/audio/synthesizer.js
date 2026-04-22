import { getPentatonicPitches } from '../utils/pentatonic.js';

// Default synthesis parameters — tunable from the test page
const DEFAULTS = {
  beta: 1.0,            // FM modulation index (0.5–2.0; 0.8–1.2 is target range)
  vibratoRate: 5.5,     // LFO frequency in Hz
  vibratoDepth: 3,      // peak vibrato depth in cents
  attackTime: 0.015,    // amplitude attack in seconds
  sustainLevel: 0.75,   // amplitude held after attack peak (0–1)
  releaseTime: 0.10,    // fade from sustain to silence in seconds
  glissandoTime: 0.045, // time to slide from previous note pitch to this one (seconds)
  volume: 0.70,         // master gain (0–1)
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
  //   useFM        — FM synthesis (true) or pure sine (false, for whistle replies)
  //   pitchEnd     — optional Hz for a downward chirp glide: pitch → pitchEnd
  //   attackTime   — override default attack
  //   vibratoDelay — seconds before vibrato fades in (default 0.08)
  //   glissFrom    — if set, carrier slides from this Hz to `pitch` over glissandoTime
  //
  _note(pitch, startTime, duration, {
    useFM = true,
    pitchEnd = null,
    attackTime = null,
    vibratoDelay = 0.08,
    glissFrom = null,
  } = {}) {
    const ctx = this.ctx;
    const { beta, vibratoRate, vibratoDepth, sustainLevel, releaseTime, glissandoTime } = this.params;
    const attack = attackTime ?? this.params.attackTime;
    const release = Math.min(releaseTime, duration * 0.45); // never eat more than 45% of note
    const peakDecay = Math.min(0.025, duration * 0.08);     // brief A→D drop to sustain level
    const tail = 0.06;

    // ── Carrier ───────────────────────────────────────────────────────────────
    const carrier = ctx.createOscillator();
    carrier.type = 'sine';

    // Glissando: slide in from the previous note's pitch, then settle at `pitch`
    if (glissFrom !== null && glissFrom !== pitch) {
      carrier.frequency.setValueAtTime(glissFrom, startTime);
      carrier.frequency.exponentialRampToValueAtTime(pitch, startTime + glissandoTime);
    } else {
      carrier.frequency.setValueAtTime(pitch, startTime);
    }

    // Pitch glide: carrier sweeps from `pitch` to `pitchEnd` (applied after any incoming glissando)
    if (pitchEnd !== null && pitchEnd !== pitch) {
      const glideFrom = glissFrom !== null ? startTime + glissandoTime : startTime;
      const glideEnd = startTime + duration * 0.72;
      if (glideEnd > glideFrom) {
        carrier.frequency.exponentialRampToValueAtTime(pitchEnd, glideEnd);
      }
    }

    // ── ADSR amplitude envelope ───────────────────────────────────────────────
    const envGain = ctx.createGain();
    const peakTime     = startTime + attack;
    const sustainTime  = peakTime + peakDecay;
    const releaseStart = Math.max(sustainTime, startTime + duration - release);

    envGain.gain.setValueAtTime(0.0001, startTime);
    envGain.gain.exponentialRampToValueAtTime(1.0, peakTime);
    envGain.gain.exponentialRampToValueAtTime(sustainLevel, sustainTime);
    if (releaseStart > sustainTime) {
      envGain.gain.setValueAtTime(sustainLevel, releaseStart); // hold sustain
    }
    envGain.gain.exponentialRampToValueAtTime(0.0001, startTime + duration);

    // ── Vibrato (delayed onset) ────────────────────────────────────────────────
    const lfo = ctx.createOscillator();
    lfo.type = 'sine';
    lfo.frequency.value = vibratoRate + (Math.random() * 0.6 - 0.3);

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

    // ── FM modulator ──────────────────────────────────────────────────────────
    if (useFM) {
      const fm = pitch * 1.5;
      const modulator = ctx.createOscillator();
      modulator.type = 'sine';

      // Modulator frequency tracks carrier glissando so sidebands stay coherent
      if (glissFrom !== null && glissFrom !== pitch) {
        modulator.frequency.setValueAtTime(glissFrom * 1.5, startTime);
        modulator.frequency.exponentialRampToValueAtTime(fm, startTime + glissandoTime);
      } else {
        modulator.frequency.setValueAtTime(fm, startTime);
      }

      if (pitchEnd !== null && pitchEnd !== pitch) {
        const glideFrom = glissFrom !== null ? startTime + glissandoTime : startTime;
        const glideEnd = startTime + duration * 0.72;
        if (glideEnd > glideFrom) {
          modulator.frequency.exponentialRampToValueAtTime(pitchEnd * 1.5, glideEnd);
        }
      }

      const modGain = ctx.createGain();
      modGain.gain.value = beta * fm;

      modulator.connect(modGain);
      modGain.connect(carrier.frequency);

      modulator.start(startTime);
      modulator.stop(startTime + duration + tail);
    }

    // ── Wire and schedule ─────────────────────────────────────────────────────
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
    const glideCents = 80 + Math.random() * 100;
    const pitchEnd = pitch * Math.pow(2, glideCents / 1200);
    this._note(pitch, now, 0.55, { pitchEnd, attackTime: 0.010 });
  }

  playTwoNotePhrase() {
    if (!this.ctx) return;
    const { glissandoTime } = this.params;
    let t = this.ctx.currentTime + 0.02;
    const pitches = getPentatonicPitches(700, 2000);
    const idx = Math.floor(Math.random() * (pitches.length - 1));
    const p1 = pitches[idx];
    const p2 = pitches[idx + 1];
    t = this._note(p1, t, 0.38, { attackTime: 0.010 });
    t += Math.max(0, 0.02 - glissandoTime * 0.5);
    this._note(p2, t, 0.45, { attackTime: 0.010, glissFrom: p1 });
  }

  playGreeting() {
    if (!this.ctx) return;
    const { glissandoTime } = this.params;
    let t = this.ctx.currentTime + 0.02;
    const pitches = getPentatonicPitches(1000, 2800);
    if (pitches.length < 3) return;
    const idx = Math.floor(Math.random() * (pitches.length - 2));
    const p1 = pitches[idx];
    const p2 = pitches[idx + 2];
    t = this._note(p1, t, 0.25, { attackTime: 0.008, vibratoDelay: 0.05 });
    t += Math.max(0, 0.01 - glissandoTime * 0.5);
    this._note(p2, t, 0.35, { attackTime: 0.008, vibratoDelay: 0.06, glissFrom: p1 });
  }

  playReply(detectedPitch = 880) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime + 0.02;
    const centsOffset = (Math.random() * 100) - 50;
    const pitch = detectedPitch * Math.pow(2, centsOffset / 1200);
    this._note(pitch, t, 0.50, { useFM: false, attackTime: 0.015, vibratoDelay: 0.06 });
  }

  playEcho(detectedPitch = 880) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime + 0.02;
    const pitches = getPentatonicPitches(600, 3200);
    const idx = pitches.reduce((best, p, i) =>
      Math.abs(p - detectedPitch) < Math.abs(pitches[best] - detectedPitch) ? i : best, 0);
    const harmonyIdx = Math.min(idx + 2, pitches.length - 1);
    this._note(pitches[harmonyIdx], t, 0.45, { attackTime: 0.010 });
  }

  // ─── Legato sequence player ──────────────────────────────────────────────────
  //
  // Single oscillator lives for the entire phrase. Pitch holds during each note
  // and slides to the next pitch during the inter-note gap. A subtle amplitude
  // dip during the gap articulates the note boundary without breaking the tone.
  //
  _playLegatoSequence(notes) {
    if (!this.ctx || !notes.length) return;
    const ctx = this.ctx;
    const { beta, vibratoRate, vibratoDepth } = this.params;

    const startTime = ctx.currentTime + 0.05;
    const firstPitch = notes[0].pitch;

    // ── Single carrier ───────────────────────────────────────────────────────
    const carrier = ctx.createOscillator();
    carrier.type = 'sine';

    // ── FM modulator (fixed gain based on starting pitch — acceptable for legato) ─
    const modulator = ctx.createOscillator();
    modulator.type = 'sine';
    const modGain = ctx.createGain();
    modGain.gain.value = beta * firstPitch * 1.5;
    modulator.connect(modGain);
    modGain.connect(carrier.frequency);

    // ── Vibrato ──────────────────────────────────────────────────────────────
    const lfo = ctx.createOscillator();
    lfo.type = 'sine';
    lfo.frequency.value = vibratoRate + (Math.random() * 0.4 - 0.2);
    const depthHz = firstPitch * (Math.pow(2, vibratoDepth / 1200) - 1);
    const vibratoGain = ctx.createGain();
    vibratoGain.gain.setValueAtTime(0, startTime);
    vibratoGain.gain.setValueAtTime(0, startTime + 0.10);
    vibratoGain.gain.linearRampToValueAtTime(depthHz, startTime + 0.20);
    lfo.connect(vibratoGain);
    vibratoGain.connect(carrier.frequency);

    // ── Phrase amplitude envelope ─────────────────────────────────────────────
    const envGain = ctx.createGain();
    envGain.gain.setValueAtTime(0.0001, startTime);
    envGain.gain.exponentialRampToValueAtTime(0.85, startTime + 0.025);

    // ── Schedule pitch and amplitude for each note ────────────────────────────
    carrier.frequency.setValueAtTime(firstPitch, startTime);
    modulator.frequency.setValueAtTime(firstPitch * 1.5, startTime);

    let t = startTime;
    for (let i = 0; i < notes.length; i++) {
      const { pitch, duration, gap } = notes[i];
      const noteEnd = t + duration;
      const gapEnd  = noteEnd + gap;
      const next    = notes[i + 1];

      // Hold pitch steady during the note
      carrier.frequency.setValueAtTime(pitch, t);
      modulator.frequency.setValueAtTime(pitch * 1.5, t);

      if (next) {
        // Slide to next pitch across the gap
        carrier.frequency.setValueAtTime(pitch, noteEnd);
        carrier.frequency.exponentialRampToValueAtTime(next.pitch, gapEnd);
        modulator.frequency.setValueAtTime(pitch * 1.5, noteEnd);
        modulator.frequency.exponentialRampToValueAtTime(next.pitch * 1.5, gapEnd);

        // Gentle amplitude dip during gap — feels like breath rather than silence
        if (gap > 0.025) {
          envGain.gain.setValueAtTime(0.85, noteEnd);
          envGain.gain.linearRampToValueAtTime(0.55, noteEnd + gap * 0.5);
          envGain.gain.linearRampToValueAtTime(0.85, gapEnd);
        }
      }

      t = gapEnd;
    }

    // ── Release ───────────────────────────────────────────────────────────────
    envGain.gain.setValueAtTime(0.85, t);
    envGain.gain.exponentialRampToValueAtTime(0.0001, t + 0.20);

    const stopTime = t + 0.28;

    carrier.connect(envGain);
    envGain.connect(this.masterGain);

    carrier.start(startTime);
    carrier.stop(stopTime);
    modulator.start(startTime);
    modulator.stop(stopTime);
    lfo.start(startTime);
    lfo.stop(stopTime);
  }

  playSongLegato(song) {
    if (!this.ctx || !song) return;
    this._playLegatoSequence(song.melody);
  }

  playHarmonyLegato(song) {
    if (!this.ctx || !song) return;
    this._playLegatoSequence(song.harmony);
  }

  playSong(song) {
    if (!this.ctx || !song) return;
    const { glissandoTime } = this.params;
    let t = this.ctx.currentTime + 0.05;
    let prevPitch = null;
    for (const note of song.melody) {
      t = this._note(note.pitch, t, note.duration, {
        attackTime: 0.015,
        glissFrom: prevPitch,
      });
      prevPitch = note.pitch;
      t += Math.max(0, note.gap - glissandoTime * 0.5);
    }
  }

  playHarmony(song) {
    if (!this.ctx || !song) return;
    const { glissandoTime } = this.params;
    let t = this.ctx.currentTime + 0.05;
    let prevPitch = null;
    for (const note of song.harmony) {
      t = this._note(note.pitch, t, note.duration, {
        attackTime: 0.015,
        glissFrom: prevPitch,
      });
      prevPitch = note.pitch;
      t += Math.max(0, note.gap - glissandoTime * 0.5);
    }
  }
}
