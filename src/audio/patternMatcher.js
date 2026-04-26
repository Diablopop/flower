// Segments a stream of FFT pitch readings into discrete notes by detecting
// pitch CHANGES rather than silence gaps.
//
// Previous approach: split notes on silence frames (frame counting).
// Problem: 40ms note gaps are shorter than the silence detection window,
// and FFT smoothing caused pitch lag, so the matcher ran 1 note behind.
//
// New approach: split notes when the detected frequency shifts by more than
// PITCH_CHANGE_CENTS in a single frame. Uses real timestamps so note duration
// is measured in milliseconds, not frame counts.

const PITCH_CHANGE_CENTS = 150; // frequency shift this large = new note boundary
const MIN_NOTE_MS = 80;         // note must be stable this long to count
const SILENCE_RESET_MS = 350;   // after this much silence, evaluate and reset

function centsDiff(freqA, freqB) {
  if (!freqA || !freqB) return Infinity;
  return Math.abs(1200 * Math.log2(freqA / freqB));
}

export class PatternMatcher {
  constructor(pattern, onResult) {
    this.pattern = pattern;
    this.onResult = onResult;
    this._attempts = [];
    this._reset();
  }

  _reset() {
    this._detectedNotes = [];
    this._currentFreq = null;
    this._noteStartTime = null;
    this._lastSoundTime = null;
    this._postEvalUntil = 0;
  }

  feed(reading) {
    const now = Date.now();

    // Ignore input briefly after an evaluation to avoid one pattern bleeding into the next
    if (now < this._postEvalUntil) return;

    if (!reading || !reading.freq) {
      // Silence frame
      if (this._currentFreq !== null) {
        this._maybeCommit(now);
        this._currentFreq = null;
        this._noteStartTime = null;
      }
      // Long silence after accumulating notes → evaluate
      if (this._lastSoundTime && this._detectedNotes.length > 0 &&
          now - this._lastSoundTime > SILENCE_RESET_MS) {
        this._evaluate(now);
      }
      return;
    }

    this._lastSoundTime = now;
    const { freq } = reading;

    if (this._currentFreq === null) {
      // New note starting
      this._currentFreq = freq;
      this._noteStartTime = now;
    } else if (centsDiff(freq, this._currentFreq) > PITCH_CHANGE_CENTS) {
      // Pitch jumped — commit the previous note if long enough, start new one
      this._maybeCommit(now);
      this._currentFreq = freq;
      this._noteStartTime = now;
    } else {
      // Same note continuing — exponential smooth the running frequency estimate
      this._currentFreq = this._currentFreq * 0.8 + freq * 0.2;
    }
  }

  _maybeCommit(now) {
    if (this._currentFreq === null || this._noteStartTime === null) return;
    const duration = now - this._noteStartTime;
    if (duration < MIN_NOTE_MS) return;

    this._detectedNotes.push(this._currentFreq);

    // Evaluate as soon as we have enough notes
    if (this._detectedNotes.length >= this.pattern.notes.length) {
      this._evaluate(now);
    }
  }

  _evaluate(now) {
    const detected = [...this._detectedNotes];
    const expected = this.pattern.notes.map(n => n.freq);

    const TOLERANCE_CENTS = 80;
    const detail = expected.map((expFreq, i) => {
      const detFreq = detected[i] ?? null;
      if (detFreq === null) return { expected: expFreq, detected: null, match: false, cents: null };
      const cents = Math.round(centsDiff(detFreq, expFreq));
      return { expected: expFreq, detected: detFreq, match: cents <= TOLERANCE_CENTS, cents };
    });

    const notesMatched = detail.filter(d => d.match).length;
    const passed = notesMatched === expected.length && detected.length >= expected.length;

    const result = {
      timestamp: Date.now(),
      detected,
      expected,
      detail,
      notesDetected: detected.length,
      notesMatched,
      notesExpected: expected.length,
      passed,
    };

    this._attempts.push(result);
    this.onResult?.(result, this._attempts);

    this._postEvalUntil = now + 600; // 600ms cooldown before accepting next attempt
    this._detectedNotes = [];
    this._currentFreq = null;
    this._noteStartTime = null;
  }

  reset() {
    this._attempts = [];
    this._reset();
  }

  get attempts() {
    return this._attempts;
  }
}
