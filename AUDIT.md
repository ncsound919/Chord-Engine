# Chord Engine — Codebase Audit

## Overview
- **Project**: Deterministic Engine — Audio Composition Lab (React + Tone.js)
- **Stack**: React 19, TypeScript 5.8, Vite 6, Tailwind 4, Tone.js 15
- **Tests**: Vitest 4 + React Testing Library + Playwright
- **Source files**: 48 TS/TSX files (excluding tests)
- **Test files**: 47 test files + 1 type-test file
- **Coverage**: 90.26% lines / 89.17% statements / 82.64% branches / 91.62% functions

---

## Component Tree

```
App.tsx (1031 lines) — state owner + view router
├── TransportBar
├── LeadSheet
├── ArrangementCriticPanel
├── MixerView
├── InstrumentsView
│   ├── SynthView (Ju60Engine-based synth editor)
│   ├── DrumsTab (drum kit loader)
│   ├── BassTab (bass instrument editor)
│   │   └── Fretboard (interactive fretboard)
│   └── SoundbankTab (soundbank management)
├── RhythmGrid (32-step drum sequencer)
│   ├── StepButton (memoized grid cell)
│   └── useDrumGrid, useDrumSynths (hooks)
├── PartsView (per-instrument part generator)
├── OntologyBlenderView (writer profile blender)
└── MpcReframerView (MPC-style reframer)
```

## Layer Breakdown

| Layer | Files | Tests | Avg Coverage |
|-------|-------|-------|-------------|
| Components (views) | 11 | 11 | ~88% |
| Components (instruments) | 7 | 9 | ~96% |
| Components (shared) | 3 | 3 | ~93% |
| Hooks | 3 | 3 | ~98% |
| Audio lib | 5 | 5 | ~98% |
| Core lib | 4 | 4 | ~81% |
| Theory | 11 | 11 | ~98% |

## Source Files Detail

### App
- `src/App.tsx` (1031L) — Main app: state, routing, generation pipeline. **Coverage: 37%**

### Components (Views)
- `src/components/views/SynthView.tsx` (601L) — Ju60 synth editor with presets. Coverage: 98%
- `src/components/views/MixerView.tsx` (560L) — Multi-track mixer. Coverage: 81%
- `src/components/views/OntologyBlenderView.tsx` (659L) — Writer blend UI. Coverage: 98%
- `src/components/views/MpcReframerView.tsx` (370L) — MPC reframer. Coverage: 77%
- `src/components/views/PartsView.tsx` (364L) — Part generator. Coverage: 84%
- `src/components/views/RhythmGrid.tsx` (357L) — Drum sequencer. Coverage: 94%
- `src/components/views/InstrumentsView.tsx` (434L) — Instrument hub. Coverage: 99%
- `src/components/views/RhythmGrid/StepButton.tsx` (38L) — Grid cell. Coverage: 100%
- `src/components/views/RhythmGrid/constants.ts` (33L) — Drum constants. Coverage: 100%
- `src/components/views/RhythmGrid/useDrumGrid.ts` (73L) — Grid hook. Coverage: 100%
- `src/components/views/RhythmGrid/useDrumSynths.ts` (85L) — Synth hook. Coverage: 89%

### Components (Instruments)
- `src/components/instruments/BassTab.tsx` (606L) — Bass editor. Coverage: 95%
- `src/components/instruments/DrumsTab.tsx` (73L) — Drum kit loader. Coverage: 100%
- `src/components/instruments/Fretboard.tsx` (105L) — Fretboard. Coverage: 100%
- `src/components/instruments/SoundbankTab.tsx` (345L) — Soundbank mgmt. Coverage: 92%
- `src/components/instruments/UIPrimitives.tsx` (377L) — Reusable UI. Coverage: 100%
- `src/components/instruments/types.ts` (90L) — Shared types. Coverage: 100%
- `src/components/instruments/bassPresets.ts` (112L) — Bass presets. Coverage: 100%

### Components (Shared)
- `src/components/LeadSheet.tsx` (505L) — Lead sheet editor. Coverage: 80%
- `src/components/ArrangementCriticPanel.tsx` (534L) — Critic panel. Coverage: 100%
- `src/components/TransportBar.tsx` (255L) — Transport controls. Coverage: 100%

### Hooks
- `src/hooks/useRecording.ts` (130L) — Audio recording. Coverage: 98%
- `src/hooks/useTransport.ts` (128L) — Transport wrapper. Coverage: 100%
- `src/hooks/useVoiceToMidi.ts` (89L) — Voice-to-MIDI. Coverage: 100%

### Core Library
- `src/lib/engine.ts` (508L) — Chord progression generator. Coverage: 74%
- `src/lib/persistence.ts` (169L) — IndexedDB persistence. Coverage: 100%
- `src/lib/players.ts` (151L) — Player profiles. Coverage: 100%
- `src/lib/prng.ts` (64L) — PRNG utilities. Coverage: 96%

### Audio Library
- `src/lib/audio/engine.ts` (522L) — Audio engine + transport. Coverage: 99%
- `src/lib/audio/synth.ts` (720L) — Ju60 synth engine. Coverage: 99%
- `src/lib/audio/sequencer.ts` (372L) — Step sequencer. Coverage: 98%
- `src/lib/audio/soundbankDb.ts` (151L) — Sample IndexedDB. Coverage: 100%
- `src/lib/audio/soundbankLoader.ts` (76L) — Sample pipeline. Coverage: 100%

### Theory Library
- `src/theory/pitch.ts` (222L) — Pitch primitives. Coverage: 100%
- `src/theory/harmony.ts` (284L) — Harmony model. Coverage: 100%
- `src/theory/melody.ts` (321L) — Melody generator. Coverage: 96%
- `src/theory/reharm.ts` (401L) — Reharmonization. Coverage: 97%
- `src/theory/rhythmicReframer.ts` (450L) — Rhythmic reframe. Coverage: 97%
- `src/theory/voicing.ts` (227L) — Voicing engine. Coverage: 100%
- `src/theory/fretboard.ts` (500L) — Guitar voicings. Coverage: 99%
- `src/theory/arcPlanner.ts` (315L) — Song arc planner. Coverage: 97%
- `src/theory/critic.ts` (372L) — Arrangement critic. Coverage: 99%
- `src/theory/fixer.ts` (189L) — Arrangement optimizer. Coverage: 100%
- `src/theory/styleAwareCritic.ts` (195L) — Style-aware critic. Coverage: 100%
- `src/theory/songFraming.ts` (326L) — Song framing model. Coverage: 97%

## Dependencies

### Runtime (12)
react, react-dom, tone, lucide-react, motion, vite, @vitejs/plugin-react, @tailwindcss/vite, express, @google/genai, idb, dotenv

### Dev (14)
typescript, vitest, @vitest/coverage-v8, @testing-library/react, @testing-library/jest-dom, @testing-library/dom, jsdom, @playwright/test, tailwindcss, autoprefixer, esbuild, tsx, @types/react, @types/react-dom, @types/express, @types/node

## Coverage Gaps (files below 90%)
- App.tsx (37%)
- lib/engine.ts (74%)
- MpcReframerView.tsx (77%)
- LeadSheet.tsx (80%)
- MixerView.tsx (81%)
