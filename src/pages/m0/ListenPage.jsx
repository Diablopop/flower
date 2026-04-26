import { useState, useRef, useCallback, useEffect } from 'react';
import { PATTERNS, DURATIONS } from '../../audio/patterns';
import { MicAnalyzer } from '../../audio/micAnalyzer';
import { PatternMatcher } from '../../audio/patternMatcher';
import { freqToNote } from '../../audio/yin';
import styles from './ListenPage.module.css';

const DISTANCES = ['3 ft', '6 ft', '10 ft', 'Background noise'];

export default function ListenPage() {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [distance, setDistance] = useState('3 ft');
  const [listening, setListening] = useState(false);
  const [micError, setMicError] = useState(null);
  const [livePitch, setLivePitch] = useState(null);
  const [attempts, setAttempts] = useState([]);
  const [lastResult, setLastResult] = useState(null);

  const analyzerRef = useRef(null);
  const matcherRef = useRef(null);
  const audioCtxRef = useRef(null);

  const handleStart = useCallback(async () => {
    setMicError(null);
    try {
      audioCtxRef.current = new AudioContext();
      const matcher = new PatternMatcher(PATTERNS[selectedIndex], (result, allAttempts) => {
        setLastResult(result);
        setAttempts([...allAttempts]);
      });
      matcherRef.current = matcher;

      const analyzer = new MicAnalyzer({
        onPitch: reading => {
          setLivePitch(reading);
          matcher.feed(reading);
        },
      });
      analyzerRef.current = analyzer;
      await analyzer.start(audioCtxRef.current);
      setListening(true);
    } catch (err) {
      setMicError(err.message || 'Microphone access denied');
    }
  }, [selectedIndex]);

  const handleStop = useCallback(() => {
    analyzerRef.current?.stop();
    analyzerRef.current = null;
    matcherRef.current = null;
    audioCtxRef.current?.close();
    audioCtxRef.current = null;
    setListening(false);
    setLivePitch(null);
  }, []);

  const handleReset = useCallback(() => {
    matcherRef.current?.reset();
    setAttempts([]);
    setLastResult(null);
  }, []);

  // When pattern changes while not listening, reset results
  useEffect(() => {
    if (!listening) {
      setAttempts([]);
      setLastResult(null);
    }
  }, [selectedIndex, listening]);

  const pattern = PATTERNS[selectedIndex];
  const passCount = attempts.filter(a => a.passed).length;
  const passRate = attempts.length > 0 ? Math.round((passCount / attempts.length) * 100) : null;

  const contourCount = PATTERNS.length / DURATIONS.length;

  return (
    <div className={styles.page}>
      <h1 className={styles.title}>M0 — Listen</h1>
      <p className={styles.sub}>Select the same pattern as the Play device. Start listening, then play the pattern there.</p>

      {/* Pattern selector */}
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
                  disabled={listening}
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
        <strong>Expecting Pattern {selectedIndex + 1}:</strong> {pattern.label}
        <div className={styles.noteRow}>
          {pattern.notes.map((n, i) => (
            <span key={i} className={styles.noteChip}>{n.name}<small>{Math.round(n.freq)}Hz</small></span>
          ))}
        </div>
      </div>

      {/* Distance selector */}
      <div className={styles.distanceRow}>
        <span className={styles.distanceLabel}>Test distance:</span>
        {DISTANCES.map(d => (
          <button
            key={d}
            className={`${styles.distBtn} ${distance === d ? styles.distSelected : ''}`}
            onClick={() => setDistance(d)}
          >
            {d}
          </button>
        ))}
      </div>

      {/* Controls */}
      <div className={styles.controls}>
        {!listening ? (
          <button className={styles.startBtn} onClick={handleStart}>🎤 Start Listening</button>
        ) : (
          <button className={styles.stopBtn} onClick={handleStop}>■ Stop</button>
        )}
        {attempts.length > 0 && (
          <button className={styles.resetBtn} onClick={handleReset}>Reset scores</button>
        )}
      </div>

      {micError && <div className={styles.error}>{micError}</div>}

      {/* Live pitch display */}
      <div className={`${styles.liveBox} ${listening ? styles.liveActive : ''}`}>
        <span className={styles.liveLabel}>Live pitch</span>
        {livePitch ? (
          <span className={styles.liveFreq}>
            {livePitch.note?.name ?? '?'} — {Math.round(livePitch.freq)} Hz
          </span>
        ) : (
          <span className={styles.liveSilence}>{listening ? 'silence' : '—'}</span>
        )}
      </div>

      {/* Score summary */}
      {attempts.length > 0 && (
        <div className={styles.scoreBox}>
          <div className={styles.scoreHeader}>
            Results at <strong>{distance}</strong>
          </div>
          <div className={styles.scoreLine}>
            <span>{passCount}/{attempts.length} passed</span>
            <span className={passRate >= 80 ? styles.pass : passRate >= 50 ? styles.warn : styles.fail}>
              {passRate}%
            </span>
          </div>
        </div>
      )}

      {/* Last result detail */}
      {lastResult && (
        <div className={styles.resultDetail}>
          <div className={styles.resultHeader}>
            Last attempt — {lastResult.passed
              ? <span className={styles.pass}>PASS</span>
              : <span className={styles.fail}>FAIL</span>}
            {' '}({lastResult.notesMatched}/{lastResult.notesExpected} notes matched)
          </div>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Note</th>
                <th>Expected</th>
                <th>Detected</th>
                <th>Error</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {lastResult.detail.map((d, i) => (
                <tr key={i} className={d.match ? styles.matchRow : styles.missRow}>
                  <td>{i + 1}</td>
                  <td>{freqToNote(d.expected)?.name ?? '?'} ({Math.round(d.expected)}Hz)</td>
                  <td>{d.detected ? `${freqToNote(d.detected)?.name ?? '?'} (${Math.round(d.detected)}Hz)` : 'not detected'}</td>
                  <td>{d.cents !== null ? `${d.cents}¢` : '—'}</td>
                  <td>{d.match ? '✓' : '✗'}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {lastResult.notesDetected > lastResult.notesExpected && (
            <div className={styles.extraNote}>
              +{lastResult.notesDetected - lastResult.notesExpected} extra note(s) detected
            </div>
          )}
        </div>
      )}

      {/* All attempts log */}
      {attempts.length > 1 && (
        <div className={styles.log}>
          <div className={styles.logHeader}>All attempts</div>
          {[...attempts].reverse().map((a, i) => (
            <div key={i} className={`${styles.logRow} ${a.passed ? styles.logPass : styles.logFail}`}>
              #{attempts.length - i} — {a.passed ? 'PASS' : 'FAIL'} &nbsp;
              {a.notesMatched}/{a.notesExpected} notes &nbsp;
              <span className={styles.logDetail}>
                [{a.detail.map(d => d.cents !== null ? `${d.cents}¢` : '—').join(', ')}]
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
