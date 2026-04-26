import { freqToNote } from './yin';
import { ToneDetector } from './toneDetector';

// Wraps a microphone stream and runs FFT-based tone detection at ~30fps.
// Calls onPitch({ freq, note, snrDb }) when a tone is detected.
// Calls onPitch(null) when no tone is detected.
// Calls onLevel({ snrDb, peakDb, noiseFloor }) every frame for UI display.
export class MicAnalyzer {
  constructor({ onPitch, onLevel, fftSize = 4096 } = {}) {
    this.onPitch = onPitch;
    this.onLevel = onLevel;
    this.fftSize = fftSize;
    this._rafId = null;
    this._stream = null;
    this._ctx = null;
  }

  async start(audioCtx) {
    this._ctx = audioCtx;
    this._stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        echoCancellation: false,
        noiseSuppression: false,
        autoGainControl: false,
      },
      video: false,
    });

    const source = audioCtx.createMediaStreamSource(this._stream);
    this._analyser = audioCtx.createAnalyser();
    this._analyser.fftSize = this.fftSize;
    this._analyser.smoothingTimeConstant = 0.6;
    source.connect(this._analyser);

    this._detector = new ToneDetector(this._analyser, audioCtx.sampleRate);
    this._loop();
  }

  _loop() {
    this._rafId = requestAnimationFrame(() => this._loop());

    const result = this._detector.detect();
    this.onLevel?.(result);

    if (result.freq) {
      const note = freqToNote(result.freq);
      this.onPitch?.({ freq: result.freq, note, snrDb: result.snrDb });
    } else {
      this.onPitch?.(null);
    }
  }

  stop() {
    if (this._rafId) cancelAnimationFrame(this._rafId);
    this._stream?.getTracks().forEach(t => t.stop());
    this._rafId = null;
    this._stream = null;
  }
}
