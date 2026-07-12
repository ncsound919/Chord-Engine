import { GeneratedSection, GeneratedChord, SectionDef } from '../lib/engine';
import { createPRNG, randomChoice } from '../lib/prng';
import { chordTonesForQuality, midiToNoteName, KEYS } from './pitch';

type MotifType = 'half' | 'quarter' | 'syncopated' | 'eighth' | 'long_note';

export interface MelodicNote {
  id: string;
  midi: number;
  bar: number;
  beat: number;                // 1.0, 1.5, 2.0, 2.5 …
  duration: number;            // in beats
  velocity?: number;           // 0‑127, default 100
  noteName: string;
  articulation?: 'accent' | 'tenuto' | 'staccato' | 'normal';
}

/**
 * Generates a beautiful, expressive melody over a section,
 * now driven by the energy and complexity of the arrangement.
 *
 * @param energyLevel 0‑100 (e.g. from SongMacroPlan)
 * @param complexity  1‑3  (overrides section.def.complexity if given)
 */
export function generateMelodyForSection(
  section: GeneratedSection,
  musicKey: string,
  seedPhrase: string,
  energyLevel: number = 50,           // NEW
  complexity?: 1 | 2 | 3              // NEW
): MelodicNote[] {
  // FIX: energyLevel is documented as 0-100 but nothing enforced that
  // contract. It feeds directly into motifWeights (e.g. `0.4 - energyLevel
  // * 0.003`), and a value outside [0,100] — e.g. an un-clamped
  // macroPlan.energyScore from upstream — can drive a weight negative.
  // weightedRandom's subtraction-based selection doesn't validate weight
  // sign, so a negative weight silently skews (or in edge cases breaks)
  // motif selection instead of throwing. Clamping here is cheap insurance
  // against a contract violation elsewhere in the pipeline.
  energyLevel = Math.max(0, Math.min(100, energyLevel));

  const prng = createPRNG(seedPhrase + section.def.id + musicKey + energyLevel);
  const melody: MelodicNote[] = [];

  // Determine actual complexity (section override has priority)
  const finalComplexity = complexity ?? section.def.complexity ?? 2;

  // Key & scale building ---------------------------------------------------
  const keyIndex = KEYS.indexOf(musicKey);
  const baseKeyOffset = keyIndex !== -1 ? keyIndex : 0;

  const isMinor = /minor|rock/.test(section.def.preset) ||
                  section.def.name.toLowerCase().includes('minor');

  const scaleIntervals = isMinor
    ? [0, 2, 3, 5, 7, 8, 10]          // natural minor
    : [0, 2, 4, 5, 7, 9, 11];         // major

  // Vocal range: C4 (60) to A5 (81) – can be extended for high energy
  const minMidi = energyLevel < 30 ? 62 : 60;          // start higher when calm
  const maxMidi = energyLevel > 80 ? 84 : 81;          // go up to C6 for climactic

  const scaleMidis: number[] = [];
  for (let midi = minMidi; midi <= maxMidi; midi++) {
    const pc = (midi - baseKeyOffset + 120) % 12;
    if (scaleIntervals.includes(pc)) {
      scaleMidis.push(midi);
    }
  }

  // State machine variables ------------------------------------------------
  let lastMidi = scaleMidis[Math.floor(scaleMidis.length / 2)];  // start in middle
  let phraseActive = true;
  let breathRestBeats = 0;            // counter for intentional rests
  let hadLeap = false;
  let leapDirection: 'up' | 'down' | undefined;

  // Helper: find nearest scale note (or chord voicing note) to a target MIDI
  const closestNote = (target: number, candidates: number[]) =>
    candidates.reduce((prev, curr) =>
      Math.abs(curr - target) < Math.abs(prev - target) ? curr : prev
    );

  section.chords.forEach((chord) => {
    // 4‑bar phrase detection
    const phraseBar = ((chord.bar - 1) % 4) + 1;

    // Derive chord‑tone pool – use actual piano voicing if available
    const rootPc = chord.rootPc ?? baseKeyOffset;
    const quality = chord.quality ?? 'maj7';
    let chordToneMidis: number[] = [];

    // If we have a piano voicing, its notes are the best melodic targets
    if (chord.pianoVoicing && chord.pianoVoicing.notes.length > 0) {
      chordToneMidis = chord.pianoVoicing.notes.filter(
        n => n >= minMidi - 12 && n <= maxMidi + 12
      );
    } else {
      const tonesPc = chordTonesForQuality(rootPc, quality);
      chordToneMidis = scaleMidis.filter(m => tonesPc.includes(m % 12));
    }

    // If chord is non‑diatonic, expand pool to all chromatic notes
    const isOutside = !chordToneMidis.length;
    const allMidis = (isOutside
      ? Array.from({ length: maxMidi - minMidi + 1 }, (_, i) => minMidi + i)
      : scaleMidis);

    // Decide rhythmic density based on phraseBar, energy, and complexity
    let beats: number[] = [];
    let durations: number[] = [];

    // Rest handling: after a long note or at end of phrase, add rest
    if (breathRestBeats > 0) {
      breathRestBeats -= 1;
      return; // skip this chord – it's a rest
    }
    
    // NOTE: Rest logic assumes one chord per bar.
    if (section.chords.length > 1 && section.chords.some((c, i) => i > 0 && c.bar === section.chords[i - 1].bar)) {
        console.warn(`generateMelodyForSection: section "${section.def.id}" has multiple chords per bar; rest/motif logic may skip mid-bar chord changes.`);
    }

    // Motif selection (weighted by energy/complexity)
    // NOTE: typed as Record<MotifType, number> (not Record<string, number>) so
    // weightedRandom's generic infers the literal union, keeping motifChoice
    // narrowed below instead of widening to `string` and breaking the
    // exhaustiveness check in the switch.
    const motifWeights: Record<MotifType, number> = {
      'half': 0.4 - energyLevel * 0.003,        // calm
      'quarter': 0.3,
      'syncopated': 0.2 + energyLevel * 0.004,  // high energy
      'eighth': energyLevel > 70 ? 0.25 : 0.05,
      'long_note': energyLevel < 40 ? 0.35 : 0.1,
    };
    const motifChoice = weightedRandom(motifWeights, prng);

    switch (motifChoice) {
      case 'half':
        beats = [1.0, 3.0];
        durations = [2.0, 2.0];
        break;
      case 'quarter':
        beats = [1.0, 2.0, 3.0, 4.0];
        durations = [1.0, 1.0, 1.0, 1.0];
        break;
      case 'syncopated':
        beats = [1.0, 2.5, 3.5];
        durations = [1.5, 1.0, 1.5];
        break;
      case 'eighth':
        beats = [1.0, 1.5, 2.0, 3.0, 3.5, 4.0];
        durations = [0.5, 0.5, 1.0, 0.5, 0.5, 1.0];
        break;
      case 'long_note':
        beats = [1.0];
        durations = [4.0]; // whole note
        breathRestBeats = 1; // rest the next bar
        break;
      default: {
        const exhaustiveCheck: never = motifChoice;
        throw new Error(`Unhandled motif type: ${exhaustiveCheck}`);
      }
    }

    // Phrase‑end modifications: Bar 4 of phrase often has a long note or rest
    if (phraseBar === 4) {
      if (energyLevel > 70 && finalComplexity >= 2) {
        // Anticipation into next section
        beats = [1.0, 2.5];
        durations = [1.5, 1.5];
      } else {
        beats = [1.0];
        durations = [2.0]; // hold and breathe
        breathRestBeats = 2;
      }
    }

    beats.forEach((beat, idx) => {
      const duration = durations[idx];
      const isStrong = beat === 1.0 || beat === 3.0;
      let targetMidi = lastMidi;

      // --- Leap resolution rule --------------------------------------------
      if (hadLeap && leapDirection) {
        // Resolve opposite by step (1‑2 semitones)
        const step = leapDirection === 'up' ? -1 : 1;
        const ideal = lastMidi + step * (1 + (prng() < 0.6 ? 0 : 1)); // 1 or 2 semitones
        targetMidi = closestNote(ideal, allMidis);
        hadLeap = false;
      }
      // --- Normal note choice ----------------------------------------------
      else {
        const decision = prng();

        // Strong beats: prefer chord tones (especially root, 3rd, 5th)
        if (isStrong && chordToneMidis.length > 0 && decision < 0.75) {
          // Prefer the nearest chord tone that is not the same as last note
          const possible = chordToneMidis.filter(m => m !== lastMidi);
          if (possible.length > 0) {
            targetMidi = closestNote(lastMidi, possible);
          } else {
            targetMidi = chordToneMidis[0]; // fallback
          }
        }
        // Otherwise: stepwise or small leap within the scale/voicing
        else {
          // Weighted interval distribution: step (1‑2 semitones) very likely
          const intervals = [
            -2, -1, 1, 2,          // seconds
            -3, 3,                  // thirds
            -4, 4,                  // fourths
            -5, 5,                  // fifths (leap)
            -7, 7,                  // octaves (rare)
          ];
          const weights = [
            0.28, 0.28, 0.28, 0.28,
            0.06, 0.06,
            0.02, 0.02,
            0.01, 0.01,
            0.005, 0.005,
          ];
          const interval = randomChoice(intervals, weights, prng);
          const ideal = lastMidi + interval;
          targetMidi = closestNote(ideal, allMidis);
        }
      }

      // --- Apply octave displacement if energy is very high (add sparkle) --
      if (energyLevel > 80 && prng() < 0.15) {
        const octaveShift = prng() < 0.5 ? 12 : -12;
        const shifted = targetMidi + octaveShift;
        if (shifted >= minMidi && shifted <= maxMidi) {
          targetMidi = shifted;
        }
      }

      // --- Check for leap -------------------------------------------------
      const diff = targetMidi - lastMidi;
      if (Math.abs(diff) >= 5) {
        hadLeap = true;
        leapDirection = diff > 0 ? 'up' : 'down';
      }

      // --- Articulation & velocity ----------------------------------------
      const velocity = Math.min(
        127,
        Math.round(80 + energyLevel * 0.5 + (isStrong ? 15 : 0))
      );
      let articulation: MelodicNote['articulation'] = 'normal';
      if (duration <= 0.5) articulation = 'staccato';
      else if (isStrong && energyLevel > 60) articulation = 'accent';
      else if (beat === 4.0 && duration >= 1.5) articulation = 'tenuto';

      lastMidi = targetMidi;

      melody.push({
        id: `mel-${section.def.id}-${chord.bar}-${beat}`,
        midi: targetMidi,
        bar: chord.bar,
        beat,
        duration,
        velocity,
        noteName: midiToNoteName(targetMidi),
        articulation,
      });
    });
  });

  return melody;
}

/**
 * Generate melody across the whole song, adjusting per section
 * using the macro plan (energy, complexity).
 */
export function generateMelodyForSong(
  sections: GeneratedSection[],
  songKey: string,
  seedPhrase: string,
  macroPlan?: { sections: { sectionId: string; energyScore: number; targetComplexity: 1|2|3 }[] }
): MelodicNote[][] {
  const planMap = new Map(
    macroPlan?.sections.map(p => [p.sectionId, p]) ?? []
  );

  return sections.map(section => {
    const plan = planMap.get(section.def.id);
    return generateMelodyForSection(
      section,
      songKey,
      seedPhrase,
      plan?.energyScore ?? 50,
      plan?.targetComplexity
    );
  });
}

/** Utility for weighted random selection */
function weightedRandom<T extends string>(
  weights: Record<T, number>,
  prng: () => number
): T {
  // FIX (defense in depth): clamp each weight to >= 0. A negative weight
  // would previously reduce `total` below the sum of the "real" weights
  // and could skew or invert relative selection odds for other entries in
  // ways that don't fail loudly — energyLevel is now clamped at the call
  // site, but this keeps the utility itself safe for any future caller
  // that doesn't clamp its inputs.
  const entries = Object.entries(weights).map(
    ([k, w]) => [k, Math.max(0, w as number)] as [T, number]
  );
  const total = entries.reduce((sum, [, w]) => sum + w, 0);
  if (total <= 0) return entries[0][0];
  let r = prng() * total;
  for (const [key, w] of entries) {
    r -= w;
    if (r <= 0) return key;
  }
  return entries[entries.length - 1][0];
}