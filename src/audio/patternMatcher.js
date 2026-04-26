// Segments a continuous stream of YIN pitch readings into discrete detected notes,
// then compares them against a target pattern and records a pass/fail result.

const PITCH_TOLERANCE_CENTS = 80; // ±80 cents = nearly a semitone
const MIN_FRAMES_FOR_NOTE = 3;    // must see a stable pitch for N consecutive frames to count
const SILENCE_FRAMES_TO_SPLIT = 4; // N silent frames resets the current note accumulator

function centsDiff(freqA, freqB) {
  return Math.abs(1200 * Math.log2(freqA / freqB));
}

export class PatternMatcher {
  constructor(pattern, onResult) {
    this.pattern = pattern;
    this.onResult = onResult;

    this._detectedNotes = [];   // confirmed detected notes so far
    this._pendingFreq = null;   // freq being accumulated
    this._pendingFrames = 0;
    this._silentFrames = 0;
    this._attempts = [];        // { timestamp, detectedNotes, passed, detail }
    this._waitingForSilence = false;
  }

  // Feed each pitch reading here ({freq, note} or null)
  feed(reading) {
    if (!reading) {
      this._silentFrames++;
      if (this._silentFrames >= SILENCE_FRAMES_TO_SPLIT && this._pendingFreq !== null) {
        this._commitPending();
      }
      if (this._silentFrames >= SILENCE_FRAMES_TO_SPLIT * 3) {
        // Long silence: if we've accumulated some notes, evaluate and reset
        if (this._detectedNotes.length > 0) {
          this._evaluate();
        }
      }
      return;
    }

    this._silentFrames = 0;
    const { freq } = reading;

    if (this._pendingFreq === null) {
      this._pendingFreq = freq;
      this._pendingFrames = 1;
    } else if (centsDiff(freq, this._pendingFreq) < PITCH_TOLERANCE_CENTS) {
      // Same note continuing — update running average and count
      this._pendingFreq = (this._pendingFreq * this._pendingFrames + freq) / (this._pendingFrames + 1);
      this._pendingFrames++;
    } else {
      // Pitch changed — commit previous
      this._commitPending();
      this._pendingFreq = freq;
      this._pendingFrames = 1;
    }
  }

  _commitPending() {
    if (this._pendingFreq !== null && this._pendingFrames >= MIN_FRAMES_FOR_NOTE) {
      this._detectedNotes.push(this._pendingFreq);

      // If we've detected as many notes as the pattern expects, evaluate immediately
      if (this._detectedNotes.length >= this.pattern.notes.length) {
        this._evaluate();
      }
    }
    this._pendingFreq = null;
    this._pendingFrames = 0;
  }

  _evaluate() {
    const detected = [...this._detectedNotes];
    const expected = this.pattern.notes.map(n => n.freq);

    // Only compare as many notes as we have (might be a partial detection)
    const compareLen = Math.min(detected.length, expected.length);
    const detail = expected.map((expFreq, i) => {
      const detFreq = detected[i] ?? null;
      if (detFreq === null) return { expected: expFreq, detected: null, match: false, cents: null };
      const cents = centsDiff(detFreq, expFreq);
      return { expected: expFreq, detected: detFreq, match: cents <= PITCH_TOLERANCE_CENTS, cents: Math.round(cents) };
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

    // Reset for next pattern attempt
    this._detectedNotes = [];
  }

  reset() {
    this._detectedNotes = [];
    this._pendingFreq = null;
    this._pendingFrames = 0;
    this._silentFrames = 0;
    this._attempts = [];
  }

  get attempts() {
    return this._attempts;
  }
}
