# Flower

A small digital companion — a flower on a screen that chirps, sings, and responds to whistles. Two Flowers in the same room find each other acoustically and harmonize. No WiFi, no account, no pairing. Just sound.

Full product spec: `../PRD.md`

---

## Running locally

```bash
npm install
npm run dev
```

Requires a local dev server (not `file://`) for microphone access. Vite provides this automatically.

---

## Milestone status

| Milestone | Status | Description |
|---|---|---|
| 1 — Sound | **Complete** | FM synthesis test page, all 7 sounds, tuned parameters |
| 2 — Listening | Not started | Mic analysis debug page: whistle, Flower chirp, ambient spike detection |
| 3 — Single Flower | Not started | Full app: animated flower, state machine, behavior engine, Vercel deploy |
| 4 — Two Flowers | Not started | Flower-to-Flower echo and harmonization |

---

## Key modules

```
src/audio/synthesizer.js     FM synthesis engine + legato sequence player
src/audio/songGenerator.js   Procedural song generation from hourly seed
src/utils/pentatonic.js      A pentatonic major pitch set (600–3200 Hz), quantization
src/utils/seedRandom.js      Mulberry32 seeded PRNG
src/components/SoundTestPage M1 test UI (not the final product UI)
```

---

## Synthesis parameters (tuned 2026-04-22)

| Parameter | Value | Note |
|---|---|---|
| FM depth (β) | 0.35 | Lower than PRD's 0.8–1.2 target — sounds better, weaker sidebands |
| Vibrato rate | 5.5 Hz | |
| Vibrato depth | 6.5 cents | |
| Attack | 5 ms | |
| Sustain level | 0.80 | |
| Release | 275 ms | |
| Glissando | 30 ms | Inter-note slide for sequences |
| Volume | 0.50 | |

---

## Important notes for M2

**β=0.35 and sideband detection:** The PRD proposes a ≥15% sideband energy threshold, sized for β=0.8–1.2. At β=0.35, first-order sidebands carry only ~6% of total energy. Start with pitch-quantization-only Flower chirp detection and treat sideband presence as a soft confidence signal rather than a hard requirement.

**Chirp glide is upward:** The PRD says "pitch glide down" but the tuned implementation uses an upward glide (sounds more curious/cheerful). Detection logic should expect upward sweeps.

**Use legato for songs in M3:** `playSongLegato()` / `playHarmonyLegato()` (single persistent oscillator, pitch slides between notes) sounds significantly more alive than the discrete-oscillator `playSong()`. Wire the legato versions into the M3 state machine.

**AudioWorklet for mic analysis:** Use `AudioWorkletNode`, not `requestAnimationFrame` — rAF is throttled to ~1 fps in background tabs, which breaks the ambient companion behavior entirely.

**Post-playback cooldown:** Minimum 400–500ms before re-enabling mic analysis after Flower plays a sound. 200ms is insufficient for typical room reverb.
