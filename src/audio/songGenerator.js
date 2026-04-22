import { getPentatonicPitches } from '../utils/pentatonic.js';
import { seededRandom, randInt } from '../utils/seedRandom.js';

// Builds the seed string from a Date (or now)
export function getHourlySeed(date = new Date()) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  const h = String(date.getHours()).padStart(2, '0');
  return `${y}${m}${d}${h}`;
}

// Note durations and inter-note gaps (all in seconds)
const DURATIONS = [0.18, 0.20, 0.22, 0.28, 0.30, 0.35, 0.42];
const GAPS = [0.04, 0.05, 0.06, 0.08, 0.10, 0.12];

// Generates a full song (melody + harmony) from a seed.
// Returns { melody, harmony, seed } where each is an array of { pitch, duration, gap }.
export function generateSong(seed = null) {
  const s = seed ?? getHourlySeed();
  const rand = seededRandom(s);

  // Use a middle-range subset of the pentatonic scale for songs
  const songPitches = getPentatonicPitches(700, 2000);
  if (songPitches.length < 4) return { melody: [], harmony: [], seed: s };

  // Build a 3–4 note motif
  const motifLen = randInt(3, 4, rand);
  const motifIndices = [];
  for (let i = 0; i < motifLen; i++) {
    motifIndices.push(randInt(0, songPitches.length - 1, rand));
  }

  // Repeat the motif 2–3 times with small variations, then add a tail
  const motifRepeats = randInt(2, 3, rand);
  const noteIndices = []; // { pitchIdx, duration, gap }

  for (let rep = 0; rep < motifRepeats; rep++) {
    for (const baseIdx of motifIndices) {
      // First repeat is exact; subsequent repeats may shift ±1 step
      const shift = rep === 0 ? 0 : randInt(-1, 1, rand);
      const pitchIdx = Math.max(0, Math.min(songPitches.length - 1, baseIdx + shift));
      const duration = DURATIONS[randInt(0, DURATIONS.length - 1, rand)];
      const gap = GAPS[randInt(0, GAPS.length - 1, rand)];
      noteIndices.push({ pitchIdx, duration, gap });
    }
  }

  // Add a free tail of 2–4 notes to round out the phrase
  const tailLen = randInt(2, 4, rand);
  for (let i = 0; i < tailLen; i++) {
    const pitchIdx = randInt(0, songPitches.length - 1, rand);
    const duration = DURATIONS[randInt(0, DURATIONS.length - 1, rand)];
    const gap = GAPS[randInt(0, GAPS.length - 1, rand)];
    noteIndices.push({ pitchIdx, duration, gap });
  }

  // Convert index arrays to Hz — keeps harmony derivation exact (no float equality issues)
  const melody = noteIndices.map(({ pitchIdx, duration, gap }) => ({
    pitch: songPitches[pitchIdx],
    duration,
    gap,
  }));

  // Harmony: pentatonic third above each melody note (2 scale steps up)
  const harmony = noteIndices.map(({ pitchIdx, duration, gap }) => ({
    pitch: songPitches[Math.min(pitchIdx + 2, songPitches.length - 1)],
    duration,
    gap,
  }));

  return { melody, harmony, seed: s };
}
