// YIN pitch detection algorithm
// Operates on a Float32Array of time-domain audio samples.
// Returns detected frequency in Hz, or null if no confident pitch found.

const THRESHOLD = 0.15; // lower = stricter confidence

export function detectPitch(buffer, sampleRate) {
  const bufSize = buffer.length;
  const halfBuf = Math.floor(bufSize / 2);

  // Step 1: difference function
  const diff = new Float32Array(halfBuf);
  for (let tau = 1; tau < halfBuf; tau++) {
    let sum = 0;
    for (let i = 0; i < halfBuf; i++) {
      const delta = buffer[i] - buffer[i + tau];
      sum += delta * delta;
    }
    diff[tau] = sum;
  }

  // Step 2: cumulative mean normalized difference
  const cmnd = new Float32Array(halfBuf);
  cmnd[0] = 1;
  let runningSum = 0;
  for (let tau = 1; tau < halfBuf; tau++) {
    runningSum += diff[tau];
    cmnd[tau] = runningSum === 0 ? 0 : diff[tau] / (runningSum / tau);
  }

  // Step 3: find first dip below threshold
  let tau = 2;
  while (tau < halfBuf) {
    if (cmnd[tau] < THRESHOLD) {
      // find local minimum in this dip
      while (tau + 1 < halfBuf && cmnd[tau + 1] < cmnd[tau]) tau++;
      break;
    }
    tau++;
  }

  if (tau >= halfBuf || cmnd[tau] >= THRESHOLD) return null;

  // Step 4: parabolic interpolation for sub-sample accuracy
  const refined =
    tau < 2 || tau >= halfBuf - 1
      ? tau
      : tau + (cmnd[tau - 1] - cmnd[tau + 1]) /
          (2 * (2 * cmnd[tau] - cmnd[tau - 1] - cmnd[tau + 1]));

  return sampleRate / refined;
}

// Map a frequency to the nearest note name
const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

export function freqToNote(freq) {
  if (!freq || freq <= 0) return null;
  const midi = 12 * Math.log2(freq / 440) + 69;
  const rounded = Math.round(midi);
  const octave = Math.floor(rounded / 12) - 1;
  const name = NOTE_NAMES[((rounded % 12) + 12) % 12];
  return { name: `${name}${octave}`, midi: rounded, cents: Math.round((midi - rounded) * 100) };
}
