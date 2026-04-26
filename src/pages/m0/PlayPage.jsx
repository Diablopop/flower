import { useState, useRef, useCallback } from 'react';
import { PATTERNS, DURATIONS, playPattern } from '../../audio/patterns';
import styles from './PlayPage.module.css';

export default function PlayPage() {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [autoRepeat, setAutoRepeat] = useState(false);
  const audioCtxRef = useRef(null);
  const gainRef = useRef(null);
  const repeatRef = useRef(false);

  const getAudioCtx = useCallback(() => {
    if (!audioCtxRef.current) {
      audioCtxRef.current = new AudioContext();
      gainRef.current = audioCtxRef.current.createGain();
      gainRef.current.connect(audioCtxRef.current.destination);
    }
    if (audioCtxRef.current.state === 'suspended') {
      audioCtxRef.current.resume();
    }
    return { ctx: audioCtxRef.current, gain: gainRef.current };
  }, []);

  const runPlay = useCallback(async (pattern, repeat) => {
    const { ctx, gain } = getAudioCtx();
    setPlaying(true);
    do {
      await playPattern(pattern, ctx, gain);
      if (repeatRef.current) await new Promise(r => setTimeout(r, 3000));
    } while (repeatRef.current);
    setPlaying(false);
  }, [getAudioCtx]);

  const handlePlay = useCallback(() => {
    const pattern = PATTERNS[selectedIndex];
    repeatRef.current = autoRepeat;
    runPlay(pattern, autoRepeat);
  }, [selectedIndex, autoRepeat, runPlay]);

  const handleStop = useCallback(() => {
    repeatRef.current = false;
  }, []);

  const pattern = PATTERNS[selectedIndex];

  // Group patterns by duration for the grid layout
  const contourCount = PATTERNS.length / DURATIONS.length;

  return (
    <div className={styles.page}>
      <h1 className={styles.title}>M0 — Play</h1>
      <p className={styles.sub}>Select a pattern, then play it on this device while the other device listens.</p>

      <div className={styles.grid}>
        <div className={styles.gridHeader} />
        {DURATIONS.map(d => (
          <div key={d} className={styles.gridHeader}>{d}s</div>
        ))}
        {Array.from({ length: contourCount }, (_, ci) => {
          const basePattern = PATTERNS[ci * DURATIONS.length];
          const contourLabel = basePattern.label.split(' — ')[0];
          return [
            <div key={`label-${ci}`} className={styles.gridLabel}>{contourLabel}</div>,
            ...DURATIONS.map((_, di) => {
              const idx = ci * DURATIONS.length + di;
              const p = PATTERNS[idx];
              return (
                <button
                  key={p.id}
                  className={`${styles.cell} ${selectedIndex === idx ? styles.selected : ''}`}
                  onClick={() => setSelectedIndex(idx)}
                >
                  P{idx + 1}
                </button>
              );
            }),
          ];
        })}
      </div>

      <div className={styles.detail}>
        <strong>Pattern {selectedIndex + 1}:</strong> {pattern.label}
        <div className={styles.noteRow}>
          {pattern.notes.map((n, i) => (
            <span key={i} className={styles.noteChip}>{n.name}<small>{Math.round(n.freq)}Hz</small></span>
          ))}
        </div>
      </div>

      <div className={styles.controls}>
        <label className={styles.repeatLabel}>
          <input
            type="checkbox"
            checked={autoRepeat}
            onChange={e => {
              setAutoRepeat(e.target.checked);
              repeatRef.current = e.target.checked;
            }}
          />
          Auto-repeat (3s gap)
        </label>

        {!playing ? (
          <button className={styles.playBtn} onClick={handlePlay}>▶ Play Pattern {selectedIndex + 1}</button>
        ) : (
          <button className={styles.stopBtn} onClick={handleStop}>■ Stop</button>
        )}
      </div>

      <div className={styles.hint}>
        <strong>Pattern number shown here must match the number selected on the Listen device.</strong>
      </div>
    </div>
  );
}
