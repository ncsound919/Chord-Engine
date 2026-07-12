# Chord Engine — Audit & Fix Status

## What We're Building
A web-based deterministic music composition engine (React + Tone.js) that generates chord progressions, bass lines, drum patterns, and synth parts. Ships as a Tauri desktop app with MIDI/WAV export.

## Current Stack
- React 19 + TypeScript 5.8 + Vite 6 + Tailwind 4
- Tone.js 15 (Web Audio API)
- Zustand 5 (state management)
- Tauri 2 (desktop shell with Rust backend)
- Vitest + Playwright (testing)

## Key Directories
- `src/` — React app source
- `src/lib/audio/` — Audio engine, sequencer, synth, samplers, soundbank
- `src/components/` — UI components
- `src-tauri/` — Rust/tauri backend
- `tests/` — Playwright E2E tests
- `Deterministic Engine Soundbank/` — Drum kits + bass WAV files
- `sound libraries/` — 1800+ multi-sampled instrument WAV files
- `public/sounds/index.json` — Index of all 1851 samples with absolute paths

---

## PROBLEM: No Sound Outputs

The app UI renders, transport plays, mixer meters show levels — but no audio reaches speakers.

### Root Cause #1: Broken Track Routing (FIXED)
Synth channels were routed to nonexistent tracks `synth-lead`, `synth-pad`, `synth-bass`. These weren't in `AudioEngine.DEFAULT_TRACKS`, so `audioEngine.tracks.get()` returned undefined and Tone.js fell back to `Tone.getDestination()`, bypassing the mixer entirely.

**Fix applied (engine.ts):**
- DEFAULT_TRACKS now includes `lead`, `pads`, `bass`, `drums`, `keys`, `guitar`
- Added `DRUM_SUBMIX_TRACKS: ['kick', 'snare', 'hihat', 'toms', 'overhead']`
- Removed SYNTH_TRACKS (no more `synth-*` tracks)
- Synth channels now route to real mixer tracks: `lead -> lead`, `pad -> pads`, `bass -> bass`

### Root Cause #2: Drum Submix Not Routed (FIXED)
Sequencer always sent all drums to the `drums` track. The mixer had dedicated `kick/snare/hihat/toms/overhead` tracks but they were cosmetic — no audio ever reached them.

**Fix applied (sequencer.ts):**
- Added `DRUM_TRACK_MAP` mapping drum names to submix track IDs
- `processBeat()` now routes each drum to its submix track (e.g., Kick -> `kick`, Snare -> `snare`)
- `playSynthesizedDrum()` also routes through the submix tracks

### Root Cause #3: Bass Sample Not Used (FIXED)
`handleBassNote()` always created an oscillator instead of using the loaded bass sample. The 6th `velocity` argument to `playBufferShifted()` was silently ignored.

**Fix applied (engine.ts + InstrumentsView.tsx):**
- `playBufferShifted()` now accepts a 6th `gain` argument with a per-note `Tone.Gain` node
- `handleBassNote()` checks for loaded bass sample first; only falls back to oscillator if none loaded

### Root Cause #4: Folder Import Too Narrow (FIXED)
Old filter only recognized `kick/bd/snare/snr/hat/hh/bass`. Crash, ride, toms, ride, kit detection all silently dropped.

**Fix applied:**
- Created `src/lib/audio/soundbankMapping.ts` with regex-based mapper handling all 9 drum types + kit detection
- `handleFolderImport` now uses `mapSoundbankFile()` and `persistAndLoadFile()` instead of inline matching + `persistAndLoadSample()`

### Root Cause #5: No Default Soundbank Bootstrap (STILL BROKEN — needs index.json rebuild)
`InstrumentsView.init` calls `loadBassFromDB()` and `loadKitFromDB()` which require IndexedDB entries. On a fresh profile, both return 0. There's no fallback to bundle URLs or filesystem paths.

The Vite middleware CAN serve files from `Deterministic Engine Soundbank/` and `sound libraries/` at `/sounds/{path}` URLs. But `prepopulateSamples.ts` only indexes files listed in `public/sounds/index.json`, which only contains `sound libraries/` bass entries — the drum files from `Deterministic Engine Soundbank/` are NOT in the index.

**Fix needed:** Either:
- A. Rebuild `public/sounds/index.json` to include all WAV files from both directories
- B. Or add hardcoded fallback paths in `prepopulateSamples.ts` for known drum kit files

### Root Cause #6: Mixer Synth Tab Shows Wrong Tracks (FIXED)
`MixerView.SYNTH_SUBTRACKS` was `['synth-lead', 'synth-pad', 'synth-bass']`. Changed to `['lead', 'pads', 'bass']`.

---

## Bugs Found & Fixed

| # | Bug | File | Status |
|---|-----|------|--------|
| 1 | Ju60Engine channels never created (no sound) | `synth/engine.ts` | FIXED |
| 2 | WamPluginLoader loads arbitrary JS with no confirm | `WamPluginLoader.tsx` | FIXED |
| 3 | CSP missing `blob:` in `connect-src` (blocks audio) | `tauri.conf.json` | FIXED |
| 4 | `webkitdirectory` TypeScript compile error | `OneShotSamplerPanel.tsx` | FIXED |
| 5 | `tsconfig.json` doesn't exclude `src-tauri/` | `tsconfig.json` | FIXED |
| 6 | Synth channels route to nonexistent tracks | `engine.ts`, `App.tsx`, `SynthView.tsx` | FIXED |
| 7 | Drums always routed to single `drums` track | `sequencer.ts` | FIXED |
| 8 | `playBufferShifted()` ignores 6th gain arg | `engine.ts` | FIXED |
| 9 | Bass preview always uses oscillator, not sample | `InstrumentsView.tsx` | FIXED |
| 10 | Folder import only matches 4 of 9 drum types | `soundbankMapping.ts` | FIXED |
| 11 | `DEFAULT_TRACKS` missing `lead`/`pads` | `engine.ts` | FIXED |
| 12 | Mixer synth tab shows wrong track names | `MixerView.tsx` | FIXED |
| 13 | No default bootstrap for drum samples | `prepopulateSamples.ts` | **STILL BROKEN** |
| 14 | `index.json` missing all drum kit entries | `public/sounds/index.json` | **STILL BROKEN** |

---

## What Your Other AI Needs To Do

### 1. Rebuild `public/sounds/index.json`
The current index only has `sound libraries/bass/` entries. It needs ALL WAVs from:
- `Deterministic Engine Soundbank/drum kit 1/` (10 files)
- `Deterministic Engine Soundbank/drum kit 2/` (9 files)
- `Deterministic Engine Soundbank/Bass/` (1 file)
- All entries from `sound libraries/` (already present)

Each entry needs `id`, `name`, `filename`, `path`, `type`, `absolutePath`.

### 2. Test with the Browser Dev Server
```
npm run dev
npx playwright test tests/composition_journey.spec.ts --headed
```
This opens a visible browser. Watch what happens at each step. The test logs results at the end.

### 3. Key Fixes Already Shipped (push --force to current repo)
The branch has routing fixes, drum submux, soundbank mapper, bass sample support. The **critical remaining piece is getting the actual WAV files to load**.

### 4. Rebuild Tauri after Fixes
```powershell
Stop-Process -Name chord-engine -Force
npx tauri build
Copy-Item src-tauri/target/release/chord-engine.exe "C:\Users\User\Desktop\Chord Engine.exe" -Force
```

### 5. Test File Locations
- Production E2E: `tests/production.spec.ts` (20 checks)
- User journey: `tests/composition_journey.spec.ts` (28 checks)
- Soundbank mapper: `src/lib/audio/soundbankMapping.test.ts` (12 checks)
- Unit tests: `npx vitest run`

---

## Architecture Overview

```
AudioEngine (singleton)
├── tracks: Map<name, Track>
│   ├── drums, bass, lead, pads, keys, guitar (DEFAULT_TRACKS)
│   ├── kick, snare, hihat, toms, overhead (DRUM_SUBMIX_TRACKS)
│   └── oneshots, guitar-sampler, keys-sampler (SAMPLER_TRACKS)
├── dryGain -> masterLimiter -> Tone.Destination
├── soloBus -> masterLimiter
├── reverbBus -> masterReverb -> masterLimiter
└── loadedSamples: Map<name, ToneAudioBuffer>

Track (per instrument)
├── inputGain -> trimNode -> eqHigh -> filter -> panner -> volumeNode
│   └── volumeNode -> dryGain (master bus)
│   └── volumeNode -> analyser (metering)
├── panner -> reverbSend -> reverbBus
├── setMute / setSolo -> _updateSoloState -> setVolume(SILENT_DB)
└── playBuffer / playBufferShifted / playOscillator / playNote

Ju60Engine (singleton, 3 channels)
├── lead -> routes to 'lead' track
├── pad -> routes to 'pads' track
└── bass -> routes to 'bass' track

Sequencer
├── processBeat() -> playRhythmicBass() / drum pattern
├── DRUM_TRACK_MAP -> routes each drum to its submix track
└── DRUM_SAMPLE_MAP -> maps drum name to loaded sample name

MixerView
├── Main tab -> DEFAULT_TRACKS (drums, bass, lead, pads, keys, guitar)
├── Drums tab -> DRUM_SUBMIX_TRACKS (kick, snare, hihat, toms, overhead)
├── Synth tab -> lead, pads, bass
└── Sampler tab -> oneshots, guitar-sampler, keys-sampler
```
