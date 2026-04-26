import { detectPitch, freqToNote } from './yin';

// Wraps a microphone stream and runs YIN pitch detection at ~30fps.
// Calls onPitch({ freq, note }) on each frame where a pitch is detected.
// Calls onPitch(null) when no pitch is detected.
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
    source.connect(this._analyser);

    this._buffer = new Float32Array(this.fftSize);
    this._loop();
  }

  _loop() {
    this._rafId = requestAnimationFrame(() => this._loop());
    this._analyser.getFloatTimeDomainData(this._buffer);

    // Check RMS — don't bother running YIN on silence
    let rms = 0;
    for (let i = 0; i < this._buffer.length; i++) rms += this._buffer[i] ** 2;
    rms = Math.sqrt(rms / this._buffer.length);

    this.onLevel?.(rms);

    if (rms < 0.003) {
      this.onPitch?.(null);
      return;
    }

    const freq = detectPitch(this._buffer, this._ctx.sampleRate);
    if (freq) {
      const note = freqToNote(freq);
      this.onPitch?.({ freq, note });
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
