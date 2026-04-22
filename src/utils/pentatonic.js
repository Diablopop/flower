// A pentatonic major rooted at A4 = 440 Hz
// Semitone offsets per octave: 0=A, 2=B, 4=C#, 7=E, 9=F#
const BASE_HZ = 440;
const SEMITONE_OFFSETS = [0, 2, 4, 7, 9];

export function getPentatonicPitches(minHz = 600, maxHz = 3200) {
  const pitches = [];
  for (let octave = -2; octave <= 5; octave++) {
    for (const semitone of SEMITONE_OFFSETS) {
      const hz = BASE_HZ * Math.pow(2, (octave * 12 + semitone) / 12);
      if (hz >= minHz && hz <= maxHz) {
        pitches.push(hz);
      }
    }
  }
  return pitches.sort((a, b) => a - b);
}

// Returns { pitch, cents } — nearest pentatonic pitch and how far off in cents
export function quantizeToPentatonic(hz) {
  const pitches = getPentatonicPitches(200, 8000);
  let bestPitch = pitches[0];
  let bestCents = Infinity;
  for (const p of pitches) {
    const cents = Math.abs(1200 * Math.log2(hz / p));
    if (cents < bestCents) {
      bestCents = cents;
      bestPitch = p;
    }
  }
  return { pitch: bestPitch, cents: bestCents };
}

// Returns how many cents hz is from the nearest pentatonic pitch
export function centsFromPentatonic(hz) {
  return quantizeToPentatonic(hz).cents;
}

// Expected first-order FM sideband positions for a given carrier frequency
// (carrier:modulator ratio = 1:1.5)
export function sidebandFrequencies(carrierHz) {
  const fm = carrierHz * 1.5;
  return {
    upper: carrierHz + fm,           // fc + fm
    lower: Math.abs(carrierHz - fm), // |fc - fm| (negative aliases to positive)
  };
}
