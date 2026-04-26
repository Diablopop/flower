// Test patterns for M0 feasibility study.
// Each pattern is a sequence of { freq, label } notes played at a fixed noteDuration.
// 3 contour shapes × 4 note durations = 12 patterns.
// All pitches from A pentatonic major, 880–1760 Hz range.

const PITCHES = {
  A5:  880.00,
  'C#6': 1108.73,
  E6:  1318.51,
  'F#6': 1479.98,
  A6:  1760.00,
};

const CONTOURS = [
  {
    id: 'ascend-2',
    label: '2-note ascending',
    notes: ['A5', 'E6'],
  },
  {
    id: 'ascend-3',
    label: '3-note ascending',
    notes: ['A5', 'C#6', 'E6'],
  },
  {
    id: 'descend-3',
    label: '3-note descending',
    notes: ['A6', 'E6', 'A5'],
  },
  {
    id: 'arch-3',
    label: '3-note arch (up-down)',
    notes: ['A5', 'A6', 'E6'],
  },
  {
    id: 'ascend-4',
    label: '4-note ascending',
    notes: ['A5', 'C#6', 'F#6', 'A6'],
  },
  {
    id: 'zigzag-4',
    label: '4-note zigzag',
    notes: ['A5', 'E6', 'C#6', 'A6'],
  },
];

export const DURATIONS = [0.15, 0.25, 0.35, 0.50];

export const PATTERNS = CONTOURS.flatMap((contour, ci) =>
  DURATIONS.map((dur, di) => ({
    id: `${contour.id}-${dur}`,
    index: ci * DURATIONS.length + di,
    label: `${contour.label} — ${dur}s/note`,
    noteDuration: dur,
    notes: contour.notes.map(name => ({ name, freq: PITCHES[name] })),
  }))
);

// Play a pattern through Web Audio API using OscillatorNodes.
// Returns a promise that resolves when playback is complete.
export function playPattern(pattern, audioCtx, gainNode) {
  const { notes, noteDuration } = pattern;
  const gapDuration = 0.04; // 40ms silence between notes
  const now = audioCtx.currentTime + 0.05;

  notes.forEach((note, i) => {
    const start = now + i * (noteDuration + gapDuration);
    const osc = audioCtx.createOscillator();
    const env = audioCtx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(note.freq, start);

    env.gain.setValueAtTime(0, start);
    env.gain.linearRampToValueAtTime(0.8, start + 0.01);
    env.gain.setValueAtTime(0.8, start + noteDuration - 0.02);
    env.gain.linearRampToValueAtTime(0, start + noteDuration);

    osc.connect(env);
    env.connect(gainNode);

    osc.start(start);
    osc.stop(start + noteDuration);
  });

  const totalDuration = notes.length * (noteDuration + gapDuration);
  return new Promise(resolve => setTimeout(resolve, (totalDuration + 0.1) * 1000));
}
