// FFT-based tone detector for known Flower frequencies.
// Much more sensitive than broadband YIN for detecting quiet tones at distance —
// we look only at the narrow frequency bins we care about, ignoring everything else.

const MIN_FREQ = 800;
const MAX_FREQ = 2000;
const MIN_SNR_DB = 8;     // minimum peak-above-noise to count as a real tone
const MIN_PEAK_DB = -70;  // ignore bins that are just noise floor garbage

export class ToneDetector {
  constructor(analyser, sampleRate) {
    this._analyser = analyser;
    this._sampleRate = sampleRate;
    this._freqBuffer = new Float32Array(analyser.frequencyBinCount);
    this._binHz = sampleRate / analyser.fftSize;
    this._minBin = Math.floor(MIN_FREQ / this._binHz);
    this._maxBin = Math.ceil(MAX_FREQ / this._binHz);
  }

  // Returns { freq, snrDb } if a tone is detected, or null.
  // Also always returns { peakDb, noiseFloor } for UI display.
  detect() {
    this._analyser.getFloatFrequencyData(this._freqBuffer);

    const buf = this._freqBuffer;
    const minB = this._minBin;
    const maxB = this._maxBin;

    // Find peak bin in the Flower frequency range
    let peakBin = minB;
    let peakDb = buf[minB];
    for (let i = minB + 1; i <= maxB; i++) {
      if (buf[i] > peakDb) {
        peakDb = buf[i];
        peakBin = i;
      }
    }

    // Estimate noise floor from bins in the range that aren't near the peak.
    // Using the 70th percentile of non-peak bins gives a stable, robust estimate.
    const PEAK_EXCLUSION = 8; // exclude ±8 bins around peak (~86 Hz at 4096 FFT)
    const noiseSamples = [];
    for (let i = minB; i <= maxB; i++) {
      if (Math.abs(i - peakBin) > PEAK_EXCLUSION) noiseSamples.push(buf[i]);
    }
    noiseSamples.sort((a, b) => a - b);
    const noiseFloor = noiseSamples[Math.floor(noiseSamples.length * 0.7)] ?? peakDb;

    const snrDb = peakDb - noiseFloor;
    const freq = peakBin * this._binHz;

    if (peakDb < MIN_PEAK_DB || snrDb < MIN_SNR_DB) {
      return { freq: null, snrDb, peakDb, noiseFloor };
    }

    return { freq, snrDb, peakDb, noiseFloor };
  }
}
