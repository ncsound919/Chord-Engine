// theory/rhythmicReframer.ts
// Upgraded Rhythmic Re-Framer – now fully integrated with the macro planner’s energy
// and complexity data, generating per‑section drum patterns with humanized micro‑timing,
// dynamic ghost notes, and articulation envelopes. Instrument mapping is energy‑aware
// and supports custom remap tables. The drum pattern generator uses deterministic PRNG
// seeded per section, so patterns are reproducible and coherent across the song.

import { GeneratedSection, GeneratedChord } from '../lib/engine';
import { FramedSong, SectionRole } from './songFraming';
import { createPRNG, randomChoice } from '../lib/prng';

// ─────────────────────────────────────────────
// Time Feel
// ─────────────────────────────────────────────
export interface TimeFeel {
  swingAmount: number;           // 0–100  (applied to 16th grid)
  microTimingDragMs: number;     // average ms behind the grid (per voice)
  humanizeVelocityRange: number; // ± velocity variance per hit
  ghostNoteDensity: number;      // 0–100
  kickPlacementStyle: 'four_on_floor' | 'syncopated_offbeat' | 'sparse_boom_bap' | 'trap_skitter' | 'jazz_swing';
}

export const TIME_FEEL_PRESETS: Record<
  | 'boom_bap'
  | 'techno'
  | 'house'
  | 'trap'
  | 'funk'
  | 'jazz'
  | 'afrobeat'
  | 'detroit_techno'
  | 'uk_garage',
  TimeFeel
> = {
  boom_bap: {
    swingAmount: 62,
    microTimingDragMs: 15,
    humanizeVelocityRange: 18,
    ghostNoteDensity: 55,
    kickPlacementStyle: 'syncopated_offbeat',
  },
  techno: {
    swingAmount: 0,
    microTimingDragMs: 0,
    humanizeVelocityRange: 8,
    ghostNoteDensity: 10,
    kickPlacementStyle: 'four_on_floor',
  },
  house: {
    swingAmount: 20,
    microTimingDragMs: 5,
    humanizeVelocityRange: 12,
    ghostNoteDensity: 20,
    kickPlacementStyle: 'four_on_floor',
  },
  trap: {
    swingAmount: 0,
    microTimingDragMs: 3,
    humanizeVelocityRange: 15,
    ghostNoteDensity: 30,
    kickPlacementStyle: 'trap_skitter',
  },
  funk: {
    swingAmount: 55,
    microTimingDragMs: 10,
    humanizeVelocityRange: 20,
    ghostNoteDensity: 60,
    kickPlacementStyle: 'syncopated_offbeat',
  },
  jazz: {
    swingAmount: 75,
    microTimingDragMs: 25,
    humanizeVelocityRange: 25,
    ghostNoteDensity: 40,
    kickPlacementStyle: 'jazz_swing',
  },
  afrobeat: {
    swingAmount: 30,
    microTimingDragMs: 12,
    humanizeVelocityRange: 18,
    ghostNoteDensity: 50,
    kickPlacementStyle: 'syncopated_offbeat',
  },
  detroit_techno: {
    swingAmount: 0,
    microTimingDragMs: 0,
    humanizeVelocityRange: 10,
    ghostNoteDensity: 15,
    kickPlacementStyle: 'four_on_floor',
  },
  uk_garage: {
    swingAmount: 60,
    microTimingDragMs: 8,
    humanizeVelocityRange: 16,
    ghostNoteDensity: 45,
    kickPlacementStyle: 'syncopated_offbeat',
  },
};

// ─────────────────────────────────────────────
// Chord Articulation
// ─────────────────────────────────────────────
export interface ChordArticulation {
  bar: number;
  attackBeat: number;            // 1.0, 2.5, etc.
  sustainBars: number;
  stabStyle: 'sustained_pad' | 'single_stab' | 'repeated_stab' | 'loop_chop';
  velocity: number;              // 0–127, derived from energy / style
  /** Envelope intended for future audio engine support – currently inert. */
  envelope?: {
    attackMs: number;
    decayMs: number;
    releaseMs: number;
  };
}

function reArticulateChords(
  chords: GeneratedChord[],
  feel: TimeFeel,
  energy: number,                     // 0–100 (from macro plan)
  prng: () => number
): ChordArticulation[] {
  const out: ChordArticulation[] = [];
  let i = 0;
  while (i < chords.length) {
    const chord = chords[i];
    let span = 1;
    while (i + span < chords.length && chords[i + span].roman === chord.roman) span++;

    // Base velocity scaled by energy, clamped, then randomized
    const rawVel = 60 + (energy * 0.5) + (feel.humanizeVelocityRange * (prng() - 0.5));
    const velocity = Math.round(Math.min(127, Math.max(20, rawVel)));

    // Attack beat: stay on beat 1 for sustained pads/loop chops; single stabs can push off‑grid
    const attackBeat = 1.0;  // always start at bar start to keep phrasing clear
    // (Syncopation is handled by drum pattern, not by moving chord attacks.)

    const stabStyle: ChordArticulation['stabStyle'] =
      span >= 3 ? 'loop_chop' : span === 2 ? 'sustained_pad' : 'single_stab';

    // Envelope shaping – reserved for future audio engine consumption
    let envelope: ChordArticulation['envelope'];
    if (stabStyle === 'single_stab') envelope = { attackMs: 2, decayMs: 250, releaseMs: 80 };
    else if (stabStyle === 'loop_chop') envelope = { attackMs: 0, decayMs: 400, releaseMs: 150 };
    else envelope = { attackMs: 30, decayMs: 200, releaseMs: 600 };

    out.push({
      bar: chord.bar,
      attackBeat,
      sustainBars: span,
      stabStyle,
      velocity,
      envelope,
    });
    i += span;
  }
  return out;
}

// ─────────────────────────────────────────────
// Instrument Texture Mapping
// ─────────────────────────────────────────────
export type ContemporaryInstrumentRole =
  | 'chopped_sample_keys'
  | 'filtered_loop_guitar'
  | 'programmed_boom_bap_kit'
  | 'sub_bass_reinforced'
  | 'chopped_string_stab'
  | 'dilla_drunk_hats'
  | 'saturated_drum_bus'
  | 'synth_bass_drone';

const ROLE_TO_CONTEMPORARY: Record<string, ContemporaryInstrumentRole[]> = {
  piano: ['chopped_sample_keys'],
  guitar: ['filtered_loop_guitar'],
  drums: ['programmed_boom_bap_kit', 'saturated_drum_bus'],
  bass: ['sub_bass_reinforced', 'synth_bass_drone'],
  strings_horns: ['chopped_string_stab'],
};

/** Pick a single primary contemporary role per vintage instrument – energy modulates choice. */
function selectPrimaryInstrumentTexture(
  vintageRole: string,
  energy: number,
  prng: () => number
): ContemporaryInstrumentRole {
  const options = ROLE_TO_CONTEMPORARY[vintageRole] ?? [vintageRole as ContemporaryInstrumentRole];
  // Use weighted random (not biased sort) – default to first option when only one
  if (options.length === 1) return options[0];
  // For two, energy decides: higher energy picks the “heavier” second option more often
  const weight0 = 0.5 + 0.3 * (1 - energy / 100); // heavier weight for first when energy low
  return prng() < weight0 ? options[0] : options[1];
}

// ─────────────────────────────────────────────
// Drum Pattern Generation
// ─────────────────────────────────────────────
export interface DrumStepPattern {
  steps: 32;
  grid: Record<string, boolean[]>;
  swing: number;
  ghostNotes: number;
  microTimingMs: number[];
  velocities: number[];
}

const DRUM_VOICES = ['Crash', 'Ride', 'HH Open', 'HH Closed', 'Tom High', 'Tom Mid', 'Tom Floor', 'Snare', 'Kick'];

function emptyGrid(): Record<string, boolean[]> {
  const g: Record<string, boolean[]> = {};
  DRUM_VOICES.forEach(d => g[d] = Array(32).fill(false));
  return g;
}

export type DrumStyle = 'boom_bap' | 'techno' | 'house' | 'trap' | 'funk' | 'jazz' | 'afrobeat' | 'detroit_techno' | 'uk_garage';

export function generateDrumPattern(
  style: DrumStyle,
  energy: number = 50,
  complexity: number = 2,
  seed: string = ''
): DrumStepPattern {
  const prng = createPRNG(seed);
  const g = emptyGrid();
  const steps = 32;

  const feel = TIME_FEEL_PRESETS[style as keyof typeof TIME_FEEL_PRESETS] ?? TIME_FEEL_PRESETS.boom_bap;

  switch (style) {
    case 'techno':
    case 'house':
      // 4-on-the-floor
      for (let i = 0; i < steps; i += 4) g['Kick'][i] = true;
      for (let i = 4; i < steps; i += 8) g['Snare'][i] = true;
      for (let i = 2; i < steps; i += 4) g['HH Open'][i] = true;
      if (energy > 50) {
        for (let i = 0; i < steps; i += 2) if (!g['HH Open'][i]) g['HH Closed'][i] = true;
      }
      break;

    case 'trap':
      g['Kick'][0] = true;
      g['Kick'][14] = true;
      g['Kick'][16] = true;
      g['Kick'][28] = true;
      for (let i = 8; i < steps; i += 16) g['Snare'][i] = true;
      // Rapid hats
      for (let i = 0; i < steps; i++) {
        if (prng() < (energy > 70 ? 0.9 : 0.6)) g['HH Closed'][i] = true;
      }
      break;

    case 'funk':
      g['Kick'][0] = true;
      g['Kick'][10] = true;
      g['Kick'][16] = true;
      g['Kick'][26] = true;
      for (let i = 8; i < steps; i += 16) g['Snare'][i] = true;
      for (let i = 0; i < steps; i += 2) g['HH Closed'][i] = true;
      // Ghost notes
      for (let i = 0; i < steps; i++) {
        if (!g['Snare'][i] && prng() < 0.2) g['Snare'][i] = true;
      }
      break;

    case 'jazz':
      // Swing ride
      for (let i = 0; i < steps; i += 4) {
        g['Ride'][i] = true;
        if (i + 3 < steps) g['Ride'][i + 3] = true;
      }
      g['HH Closed'][4] = true;
      g['HH Closed'][12] = true;
      g['HH Closed'][20] = true;
      g['HH Closed'][28] = true;
      if (energy > 40) g['Kick'][prng() < 0.5 ? 0 : 16] = true;
      break;

    case 'afrobeat':
      // Syncopated kick and snare/rimshot placements
      g['Kick'][0] = true;
      g['Kick'][6] = true;
      g['Kick'][12] = true;
      g['Kick'][16] = true;
      g['Kick'][22] = true;
      g['Kick'][28] = true;
      
      g['Snare'][4] = true;
      g['Snare'][10] = true;
      g['Snare'][18] = true;
      g['Snare'][24] = true;

      for (let i = 0; i < steps; i += 2) {
        g['HH Closed'][i] = true;
      }
      break;

    case 'detroit_techno':
      // Strong 4-on-the-floor with offbeat open hat and ride accents
      for (let i = 0; i < steps; i += 4) {
        g['Kick'][i] = true;
      }
      for (let i = 8; i < steps; i += 16) {
        g['Snare'][i] = true;
      }
      for (let i = 2; i < steps; i += 4) {
        g['HH Open'][i] = true;
      }
      for (let i = 0; i < steps; i += 2) {
        if (!g['HH Open'][i]) g['HH Closed'][i] = true;
      }
      if (energy > 60) {
        for (let i = 0; i < steps; i += 4) {
          g['Ride'][i] = true;
        }
      }
      break;

    case 'uk_garage':
      // 2-Step syncopated shuffle (skips 3rd beat kick)
      g['Kick'][0] = true;
      g['Kick'][10] = true;
      g['Kick'][16] = true;
      g['Kick'][26] = true;
      
      g['Snare'][8] = true;
      g['Snare'][24] = true;
      
      for (let i = 6; i < steps; i += 8) {
        g['HH Open'][i] = true;
      }
      for (let i = 0; i < steps; i += 2) {
        if (prng() < 0.75) g['HH Closed'][i] = true;
      }
      break;

    case 'boom_bap':
    default:
      g['Kick'][0] = true;
      g['Kick'][10] = true;
      g['Kick'][16] = true;
      g['Kick'][22] = true;
      for (let i = 8; i < steps; i += 16) g['Snare'][i] = true;
      for (let i = 0; i < steps; i += 2) g['HH Closed'][i] = true;
      break;
  }

  const microTimingMs = Array(32)
    .fill(0)
    .map(() => (prng() - 0.5) * 2 * feel.microTimingDragMs * (complexity / 2));
  const velocities = Array(32)
    .fill(0)
    .map(() => Math.round(100 + (prng() - 0.5) * feel.humanizeVelocityRange * (complexity / 2)));

  // Complex detail: add occasional ghost notes/denser hats
  if (complexity >= 3 && energy > 40) {
    for (let i = 1; i < steps; i += 2) {
      if (!g['HH Closed'][i] && prng() < 0.3) g['HH Closed'][i] = true;
    }
  }

  return {
    steps: 32,
    grid: g,
    swing: feel.swingAmount,
    ghostNotes: feel.ghostNoteDensity,
    microTimingMs,
    velocities,
  };
}


// ─────────────────────────────────────────────
// Top‑level reframer
// ─────────────────────────────────────────────
export type ReframeTarget = keyof typeof TIME_FEEL_PRESETS;

// FIX: this interface previously nested the original section under
// `originalSection` and included a `role` field. Neither matches reality:
// reframeSong actually does `{...section, drumPattern, articulations,
// instrumentTextures, timeFeel}` — a FLAT spread with no `role` field at
// all — and every real consumer (App.tsx, LeadSheet.tsx,
// ArrangementCriticPanel.tsx, PartsView.tsx, sequencer.ts) reads the flat
// shape directly: `section.def.id`, `section.chords`, `section.timeFeel`,
// `section.drumPattern`. sequencer.ts in particular reads
// `section.timeFeel` and `section.drumPattern` at the top level to drive
// real-time audio playback, so the flat shape is the one actually load-
// bearing across the app — this interface now matches that reality
// instead of an earlier, unused design.
export type ReframedSection = GeneratedSection & {
  articulations: ChordArticulation[];
  instrumentTextures: Record<string, ContemporaryInstrumentRole>;  // single primary role per vintage instrument
  drumPattern: DrumStepPattern;
  timeFeel: TimeFeel;
};

export function reframeSong(
  framed: FramedSong,
  generatedSections: GeneratedSection[],
  target: ReframeTarget,
  /** Optional per‑section energy/complexity data (from SongMacroPlan) */
  sectionEnergies?: { sectionId: string; energyScore: number; targetComplexity: number }[]
): ReframedSection[] {
  const energyMap = new Map(sectionEnergies?.map(e => [e.sectionId, e]) ?? []);

  return generatedSections
    .map((section, i): ReframedSection | null => {
      const role = framed.roles[i];
      if (!section || !section.def) return null;
      const plan = energyMap.get(section.def.id);
      const energy = plan?.energyScore ?? 50;
      const complexity = plan?.targetComplexity ?? 2;
      const seed = `${section.def.id}_${target}_${energy}_${complexity}`;
      const prng = createPRNG(seed);

      // Section‑specific feel modifications (breakdowns go sparser)
      const sectionFeel: TimeFeel = role === 'breakdown'
        ? { ...TIME_FEEL_PRESETS[target], kickPlacementStyle: 'sparse_boom_bap', ghostNoteDensity: (TIME_FEEL_PRESETS[target].ghostNoteDensity ?? 0) + 15 }
        : TIME_FEEL_PRESETS[target];

      // Re‑articulate chords
      const articulations = reArticulateChords(section.chords, sectionFeel, energy, prng);

      // Build instrument texture map: single primary contemporary role per vintage role
      const instrumentTextures: Record<string, ContemporaryInstrumentRole> = {};
      for (const vintageRole of Object.keys(ROLE_TO_CONTEMPORARY)) {
        instrumentTextures[vintageRole] = selectPrimaryInstrumentTexture(vintageRole, energy, prng);
      }

      const drumPattern = generateDrumPattern(
        target as DrumStyle,
        energy,
        complexity,
        seed + '_drums'
      );

      // FIX: previously `as any` — masked both the null-narrowing gap
      // below and the fact this object doesn't match GeneratedSection
      // (the function's old declared return type). No cast needed now
      // that the return type matches what's actually constructed.
      return {
        ...section,
        drumPattern,
        articulations,
        instrumentTextures,
        timeFeel: sectionFeel,
      };
    })
    .filter((s): s is ReframedSection => s !== null);
}