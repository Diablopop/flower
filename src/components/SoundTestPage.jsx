import { useState, useRef, useCallback } from 'react';
import { SynthEngine } from '../audio/synthesizer.js';
import { generateSong } from '../audio/songGenerator.js';
import styles from './SoundTestPage.module.css';

const SOUND_BUTTONS = [
  {
    id: 'chirp',
    label: 'Simple Chirp',
    desc: 'Single FM note, downward pitch glide',
  },
  {
    id: 'twoNote',
    label: 'Two-Note Phrase',
    desc: 'Ascending pentatonic interval',
  },
  {
    id: 'greeting',
    label: 'Greeting',
    desc: 'Bright upward two-note call',
  },
  {
    id: 'reply',
    label: 'Whistle Reply',
    desc: 'Pure sine at A5 (880 Hz), no FM sidebands',
  },
  {
    id: 'echo',
    label: 'Echo',
    desc: 'FM reply a pentatonic third above A5',
  },
  {
    id: 'song',
    label: 'Song',
    desc: 'Procedural melody from current hourly seed',
  },
  {
    id: 'harmony',
    label: 'Harmony',
    desc: 'Pre-generated harmony track for current song',
  },
];

const PARAM_DEFS = [
  {
    key: 'beta',
    label: 'FM Depth (β)',
    min: 0.3,
    max: 2.5,
    step: 0.05,
    default: 1.0,
    unit: '',
    note: 'Target: 0.8–1.2. Higher = buzzier/harsher.',
  },
  {
    key: 'vibratoRate',
    label: 'Vibrato Rate',
    min: 3,
    max: 10,
    step: 0.1,
    default: 5.5,
    unit: ' Hz',
    note: 'LFO speed. 5–6 Hz is natural.',
  },
  {
    key: 'vibratoDepth',
    label: 'Vibrato Depth',
    min: 0,
    max: 15,
    step: 0.5,
    default: 3,
    unit: ' cents',
    note: '2–5 cents is subtle. >10 sounds wobbly.',
  },
  {
    key: 'attackTime',
    label: 'Attack',
    min: 2,
    max: 60,
    step: 1,
    default: 15,
    unit: ' ms',
    note: 'Amplitude attack. 10–30 ms target.',
  },
  {
    key: 'decayTime',
    label: 'Decay',
    min: 100,
    max: 1200,
    step: 10,
    default: 400,
    unit: ' ms',
    note: 'Total note length. ~400 ms for chirps.',
  },
  {
    key: 'volume',
    label: 'Volume',
    min: 0,
    max: 1,
    step: 0.01,
    default: 0.7,
    unit: '',
    note: 'Master gain.',
  },
];

function initialParams() {
  return PARAM_DEFS.reduce((acc, p) => {
    acc[p.key] = p.default;
    return acc;
  }, {});
}

// Converts slider storage value → synthesizer value
// (attackTime and decayTime are stored as ms but synth expects seconds)
function toSynthParams(params) {
  return {
    ...params,
    attackTime: params.attackTime / 1000,
    decayTime: params.decayTime / 1000,
  };
}

export function SoundTestPage() {
  const [initialized, setInitialized] = useState(false);
  const [params, setParams] = useState(initialParams());
  const [activeSound, setActiveSound] = useState(null);
  const synthRef = useRef(null);
  const songRef = useRef(null);

  const handleInit = useCallback(() => {
    synthRef.current = new SynthEngine();
    synthRef.current.init();
    songRef.current = generateSong(); // generate today's song once
    setInitialized(true);
  }, []);

  const applyParams = useCallback(() => {
    synthRef.current?.updateParams(toSynthParams(params));
  }, [params]);

  const handlePlay = useCallback((soundId) => {
    if (!synthRef.current) return;
    applyParams();
    setActiveSound(soundId);
    setTimeout(() => setActiveSound(null), 400);

    const s = synthRef.current;
    switch (soundId) {
      case 'chirp':    s.playChirp(); break;
      case 'twoNote':  s.playTwoNotePhrase(); break;
      case 'greeting': s.playGreeting(); break;
      case 'reply':    s.playReply(880); break;
      case 'echo':     s.playEcho(880); break;
      case 'song':     s.playSong(songRef.current); break;
      case 'harmony':  s.playHarmony(songRef.current); break;
    }
  }, [applyParams]);

  const handleParamChange = useCallback((key, value) => {
    setParams(prev => {
      const next = { ...prev, [key]: Number(value) };
      synthRef.current?.updateParams(toSynthParams(next));
      return next;
    });
  }, []);

  const handleResetParams = useCallback(() => {
    const defaults = initialParams();
    setParams(defaults);
    synthRef.current?.updateParams(toSynthParams(defaults));
  }, []);

  const handleRegenerateSong = useCallback(() => {
    if (!synthRef.current) return;
    // Regenerate with a random seed for demo purposes
    const randomSeed = String(Math.floor(Math.random() * 999999));
    songRef.current = generateSong(randomSeed);
  }, []);

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <h1 className={styles.title}>Flower</h1>
        <p className={styles.subtitle}>Sound Lab — Milestone 1</p>
      </header>

      {!initialized ? (
        <div className={styles.startSection}>
          <p className={styles.startHint}>
            Click below to initialise the audio engine.<br />
            (Browsers require a user gesture before playing sound.)
          </p>
          <button className={styles.startButton} onClick={handleInit}>
            Start Audio
          </button>
        </div>
      ) : (
        <main className={styles.main}>

          {/* ── Sound buttons ──────────────────────────────────────── */}
          <section className={styles.section}>
            <h2 className={styles.sectionTitle}>Sounds</h2>
            <div className={styles.soundGrid}>
              {SOUND_BUTTONS.map(({ id, label, desc }) => (
                <button
                  key={id}
                  className={`${styles.soundButton} ${activeSound === id ? styles.soundButtonActive : ''}`}
                  onClick={() => handlePlay(id)}
                >
                  <span className={styles.soundLabel}>{label}</span>
                  <span className={styles.soundDesc}>{desc}</span>
                </button>
              ))}
            </div>
            <div className={styles.songActions}>
              <button className={styles.secondaryButton} onClick={handleRegenerateSong}>
                Shuffle song seed
              </button>
              <span className={styles.seedNote}>
                Current seed: {songRef.current?.seed}
              </span>
            </div>
          </section>

          {/* ── Parameter sliders ──────────────────────────────────── */}
          <section className={styles.section}>
            <div className={styles.sectionHeader}>
              <h2 className={styles.sectionTitle}>Parameters</h2>
              <button className={styles.secondaryButton} onClick={handleResetParams}>
                Reset
              </button>
            </div>
            <div className={styles.paramGrid}>
              {PARAM_DEFS.map(({ key, label, min, max, step, unit, note }) => (
                <div key={key} className={styles.paramRow}>
                  <div className={styles.paramMeta}>
                    <label className={styles.paramLabel} htmlFor={`param-${key}`}>
                      {label}
                    </label>
                    <span className={styles.paramNote}>{note}</span>
                  </div>
                  <div className={styles.paramControl}>
                    <input
                      id={`param-${key}`}
                      type="range"
                      min={min}
                      max={max}
                      step={step}
                      value={params[key]}
                      onChange={e => handleParamChange(key, e.target.value)}
                      className={styles.slider}
                    />
                    <span className={styles.paramValue}>
                      {typeof params[key] === 'number'
                        ? params[key] % 1 === 0
                          ? params[key]
                          : params[key].toFixed(key === 'beta' ? 2 : 1)
                      : params[key]}
                      {unit}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </section>

        </main>
      )}
    </div>
  );
}
