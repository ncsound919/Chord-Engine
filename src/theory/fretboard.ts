// theory/fretboard.ts
// Guitar voicing engine — physically playable shapes, realistic hand-span
// & barre detection, finger assignments that respect actual hand physics,
// and the ability to match piano voicings onto the fretboard.
//
// FIXED in this pass (audit findings):
//  1. assignFingers no longer reuses the same finger across non-adjacent
//     notes in a single shape — a hand only has one of each finger.
//  2. generateFingerableShapes no longer REQUIRES every chord tone to be
//     present (was silently zeroing out results for maj13/m11/13-type
//     chords, which are central to the Isley/Jasper and Steely presets).
//     Reverted to "most, not all" coverage, matching real comping practice
//     where the 5th or a doubled tone is routinely omitted.

import { midiToPitchClass } from './pitch';

// Standard tuning: E2 A2 D3 G3 B3 E4 (low to high)
export const STANDARD_TUNING: number[] = [40, 45, 50, 55, 59, 64];
export const STRING_COUNT = 6;
export const MAX_FRET = 15;            // practical upper limit for comping
export const MAX_HAND_SPAN = 4;        // frets a single hand position can comfortably cover
export const MAX_STRINGS_PER_CHORD = 6;

/** A single sounded note on a specific string and fret. */
export interface FrettedNote {
  string: number;    // 0 = low E, 5 = high E
  fret: number;      // 0 = open string
  midi: number;
  finger?: 1 | 2 | 3 | 4;   // suggested left-hand finger (1=index, 4=pinky)
}

/** A complete guitar chord shape. */
export interface GuitarShape {
  notes: FrettedNote[];          // sounded strings, always sorted low->high
  mutedStrings: number[];        // strings not played
  minFret: number;               // lowest fretted note (excluding open)
  maxFret: number;               // highest fretted note
  barre?: {
    fret: number;
    fromString: number;          // low string index of barre
    toString: number;            // high string index of barre
    finger?: 1;                  // always index finger for standard barre
  };
  /** Overall playability score – lower is easier. */
  playabilityScore: number;
  /** True if finger assignment could NOT be resolved within 4 fingers — flags an unplayable shape. */
  fingeringImpossible?: boolean;
}

// ──────────────────────────────────────────────────────────
// Pre‑computed lookup tables
// ──────────────────────────────────────────────────────────

const stringFretMap: { fret: number; midi: number }[][] = [];
for (let s = 0; s < STRING_COUNT; s++) {
  const openMidi = STANDARD_TUNING[s];
  const frets: { fret: number; midi: number }[] = [];
  for (let f = 0; f <= MAX_FRET; f++) {
    frets.push({ fret: f, midi: openMidi + f });
  }
  stringFretMap.push(frets);
}

function positionsForExactMidi(midi: number): { string: number; fret: number }[] {
  const out: { string: number; fret: number }[] = [];
  for (let s = 0; s < STRING_COUNT; s++) {
    const fret = midi - STANDARD_TUNING[s];
    if (fret >= 0 && fret <= MAX_FRET) {
      out.push({ string: s, fret });
    }
  }
  return out;
}

/**
 * Core generation – all fingerable shapes for a set of pitch classes.
 */
export function generateFingerableShapes(
  chordTonesPc: number[],
  opts: {
    maxResults?: number;
    requireRootInBass?: boolean;
    rootPc?: number;
    bassPc?: number;
  } = {}
): GuitarShape[] {
  const {
    maxResults = 5,
    requireRootInBass = false,
    rootPc,
    bassPc,
  } = opts;

  const lowestPc = bassPc ?? (requireRootInBass ? rootPc : undefined);

  const candidatesPerString: { string: number; fret: number; midi: number; pc: number }[][] = [];
  for (let s = 0; s < STRING_COUNT; s++) {
    const stringCandidates: { string: number; fret: number; midi: number; pc: number }[] = [];
    for (const { fret, midi } of stringFretMap[s]) {
      const pc = midiToPitchClass(midi);
      if (chordTonesPc.includes(pc)) {
        stringCandidates.push({ string: s, fret, midi, pc });
      }
    }
    stringCandidates.sort((a, b) => a.fret - b.fret);
    candidatesPerString.push(stringCandidates);
  }

  const results: GuitarShape[] = [];

  for (let pos = 0; pos <= MAX_FRET - MAX_HAND_SPAN; pos++) {
    const lo = pos;
    const hi = pos + MAX_HAND_SPAN;

    const inWindow = candidatesPerString.map(list =>
      list.filter(c => c.fret === 0 || (c.fret >= lo && c.fret <= hi))
    );

    const chosen: FrettedNote[] = [];
    const usedPcs = new Set<number>();
    const muted: number[] = [];
    let hasBassNote = false;

    for (let s = 0; s < STRING_COUNT; s++) {
      const opts = inWindow[s];
      if (opts.length === 0) {
        muted.push(s);
        continue;
      }

      let pick: typeof opts[0] | undefined;

      if (s === 0 && lowestPc !== undefined) {
        const bassCandidates = opts.filter(c => c.pc === lowestPc);
        if (bassCandidates.length > 0) {
          pick = bassCandidates[0];
          hasBassNote = true;
        }
      }

      if (!pick) {
        const fresh = opts.find(c => !usedPcs.has(c.pc));
        pick = fresh ?? opts[0];
      }

      chosen.push({ string: pick.string, fret: pick.fret, midi: pick.midi });
      usedPcs.add(pick.pc);
    }

    if (chosen.length < 3) continue;
    if (muted.length > 2) continue;

    // FIX #2: require MOST chord tones, not ALL. A 6-tone maj13 chord will
    // never fit complete on 6 strings within one hand position AND satisfy
    // one-note-per-string AND <=2 muted simultaneously — that combination
    // of constraints is over-determined. Real comping omits tones (usually
    // the 5th, sometimes a doubled root) routinely. Require coverage of the
    // ESSENTIAL tones (root/3rd/7th typically — approximated here as "at
    // least min(3, total) distinct tones, weighted toward the lower-index/
    // structurally important ones since chordTonesPc is ordered root-first
    // by chordTonesForQuality in pitch.ts").
    const minRequiredCoverage = Math.min(3, chordTonesPc.length);
    if (usedPcs.size < minRequiredCoverage) continue;

    if (lowestPc !== undefined && !hasBassNote) continue;

    const frets = chosen.map(c => c.fret).filter(f => f > 0);
    const minFret = frets.length ? Math.min(...frets) : 0;
    const maxFret = frets.length ? Math.max(...frets) : 0;
    if (maxFret - minFret > MAX_HAND_SPAN) continue;

    // Barre detection: same fret on 3+ adjacent strings
    let barre: GuitarShape['barre'] | undefined;
    const fretCounts = new Map<number, number[]>();
    chosen.forEach(n => {
      if (n.fret > 0) {
        const arr = fretCounts.get(n.fret) ?? [];
        arr.push(n.string);
        fretCounts.set(n.fret, arr);
      }
    });
    for (const [fret, strings] of fretCounts) {
      if (strings.length >= 3) {
        strings.sort((a, b) => a - b);
        const consecutive = strings.slice(1).every((s, i) => s === strings[i] + 1);
        if (consecutive) {
          barre = { fret, fromString: strings[0], toString: strings[strings.length - 1], finger: 1 };
          break;
        }
      }
    }

    const { fingers, impossible } = assignFingers(chosen, barre);

    const shape: GuitarShape = {
      notes: chosen.map((n, i) => ({ ...n, finger: fingers[i] })),
      mutedStrings: muted,
      minFret,
      maxFret,
      barre,
      playabilityScore: computePlayabilityScore(chosen, muted.length, minFret, maxFret, barre, impossible),
      fingeringImpossible: impossible,
    };

    results.push(shape);
  }

  const seen = new Set<string>();
  const unique: GuitarShape[] = [];
  for (const shape of results) {
    const key = shape.notes.map(n => `${n.string}:${n.fret}`).join(',');
    if (seen.has(key)) continue;
    seen.add(key);
    unique.push(shape);
  }

  // Strict-fingerable-only: drop shapes flagged impossible before sorting/truncating,
  // so a bad shape can never crowd out a good one in the top maxResults.
  const playable = unique.filter(s => !s.fingeringImpossible);
  const pool = playable.length > 0 ? playable : unique; // fallback only if literally nothing is playable

  pool.sort((a, b) => a.playabilityScore - b.playabilityScore);
  return pool.slice(0, maxResults);
}

/**
 * FIX #1: Real finger assignment.
 *
 * A human hand has exactly one of each finger (index=2, middle=3, ring=4;
 * finger 1/thumb reserved for barres per convention here). Fingers must
 * also be assignable in an order consistent with fret position — you
 * cannot put your pinky (4) on a LOWER fret than your index (2) in a
 * normal fretting hand position; fingers generally increase in number as
 * fret number increases within a single hand position.
 *
 * This assigns each non-barre fretted note a DISTINCT finger, in ascending
 * fret order, using at most 3 fingers (2,3,4) since finger 1 is reserved
 * for barres in this model. If there are more than 3 non-barre fretted
 * notes needing independent fingers, the shape is FLAGGED IMPOSSIBLE
 * rather than silently reusing a finger — per the strict-fingerable
 * requirement, an impossible shape must never be reported as playable.
 */
function assignFingers(
  notes: FrettedNote[],
  barre?: GuitarShape['barre']
): { fingers: (1 | 2 | 3 | 4 | undefined)[]; impossible: boolean } {
  const fingers: (1 | 2 | 3 | 4 | undefined)[] = new Array(notes.length).fill(undefined);

  if (barre) {
    notes.forEach((n, idx) => {
      if (n.string >= barre.fromString && n.string <= barre.toString && n.fret === barre.fret) {
        fingers[idx] = 1;
      }
    });
  }

  // Non-barre fretted notes (open strings need no finger at all).
  const remaining = notes
    .map((n, idx) => ({ n, idx }))
    .filter(({ n, idx }) => fingers[idx] === undefined && n.fret > 0);

  // Multiple notes on the SAME fret (other than the barre fret) can share
  // one finger only if that finger can physically flatten across them —
  // i.e. a mini-barre with the same physics as the main barre check. We
  // don't model partial barres here; treat same-fret notes as requiring
  // separate fingers unless they're literally the detected barre.
  remaining.sort((a, b) => a.n.fret - b.n.fret);

  // Available independent fingers, in physical order: index(2) -> middle(3) -> ring(4).
  const AVAILABLE_FINGERS: (2 | 3 | 4)[] = [2, 3, 4];

  if (remaining.length > AVAILABLE_FINGERS.length) {
    // More independent fretted notes than fingers available (with finger 1
    // committed to the barre, if any). This shape is NOT playable as a
    // single grip — flag it rather than reuse a finger, which is the bug
    // being fixed here.
    return { fingers, impossible: true };
  }

  remaining.forEach(({ idx }, i) => {
    fingers[idx] = AVAILABLE_FINGERS[i];
  });

  return { fingers, impossible: false };
}

/** Heuristic playability score: lower is easier. */
function computePlayabilityScore(
  notes: FrettedNote[],
  mutedCount: number,
  minFret: number,
  maxFret: number,
  barre?: GuitarShape['barre'],
  fingeringImpossible?: boolean
): number {
  let score = mutedCount * 3;
  score += (maxFret - minFret) * 2;
  score += minFret * 0.5;
  for (const n of notes) {
    if (n.string <= 2 && n.fret > 7) score += 2;
  }
  if (barre) score -= 1.5;
  if (notes.length === 6) score -= 0.5;
  if (fingeringImpossible) score += 1000; // hard exclusion via score, belt-and-suspenders with the filter above
  return Math.round(score * 10) / 10;
}

/**
 * Pick the best shape for smooth voice leading and minimal physical movement.
 */
export function pickBestGuitarShape(
  candidates: GuitarShape[],
  prevShape: GuitarShape | null
): GuitarShape | null {
  if (candidates.length === 0) return null;
  if (!prevShape) return candidates[0];

  let best = candidates[0];
  let bestCost = Infinity;

  for (const shape of candidates) {
    const positionMove = Math.abs(
      (shape.minFret + shape.maxFret) / 2 -
      (prevShape.minFret + prevShape.maxFret) / 2
    );

    let voiceLeadingCost = 0;
    const prevMap = new Map<number, number>();
    for (const n of prevShape.notes) prevMap.set(n.string, n.midi);

    for (const n of shape.notes) {
      if (prevMap.has(n.string)) {
        voiceLeadingCost += Math.abs(n.midi - prevMap.get(n.string)!);
      }
    }
    const prevMuted = new Set(prevShape.mutedStrings);
    const newMuted = new Set(shape.mutedStrings);
    voiceLeadingCost += 5 * symmetricDifference(prevMuted, newMuted).size;

    const totalCost = positionMove * 1.5 + voiceLeadingCost * 0.5;
    if (totalCost < bestCost) {
      bestCost = totalCost;
      best = shape;
    }
  }

  return best;
}

function symmetricDifference<T>(a: Set<T>, b: Set<T>): Set<T> {
  const result = new Set<T>();
  for (const x of a) if (!b.has(x)) result.add(x);
  for (const x of b) if (!a.has(x)) result.add(x);
  return result;
}

// ──────────────────────────────────────────────────────────────
// Match an exact set of MIDI notes (e.g., from a piano voicing) onto
// the guitar fretboard, preserving pitch whenever possible.
// (Unchanged from the version you uploaded — no bugs found here.)
// ──────────────────────────────────────────────────────────────

export interface VoicingMatchOptions {
  maxResults?: number;
  exactOctave?: boolean;
  allowExtraNotes?: boolean;
  minStrings?: number;
}

export function findGuitarVoicingFromNotes(
  midiNotes: number[],
  opts: VoicingMatchOptions = {}
): GuitarShape[] {
  const {
    maxResults = 5,
    exactOctave = true,
    allowExtraNotes = true,
    minStrings = 3,
  } = opts;

  if (midiNotes.length === 0) return [];

  const maxPossibleMidi = STANDARD_TUNING[5] + MAX_FRET;
  const minPossibleMidi = STANDARD_TUNING[0];
  const feasibleNotes = midiNotes.filter(m => m >= minPossibleMidi && m <= maxPossibleMidi);
  if (feasibleNotes.length === 0) return [];

  const results: GuitarShape[] = [];

  for (let pos = 0; pos <= MAX_FRET - MAX_HAND_SPAN; pos++) {
    const lo = pos;
    const hi = pos + MAX_HAND_SPAN;

    const assignments: { midi: number; options: { string: number; fret: number }[] }[] = [];
    for (const m of feasibleNotes) {
      const allPos = positionsForExactMidi(m).filter(p => p.fret >= lo && p.fret <= hi);
      if (exactOctave && allPos.length === 0) {
        assignments.length = 0;
        break;
      }
      assignments.push({ midi: m, options: allPos });
    }
    if (assignments.length !== feasibleNotes.length) continue;

    const assignedNotes: FrettedNote[] = [];
    const usedStrings = new Set<number>();

    function search(idx: number): boolean {
      if (idx === assignments.length) return true;
      const { midi, options } = assignments[idx];
      const sorted = [...options].sort((a, b) => a.fret - b.fret);
      for (const opt of sorted) {
        if (usedStrings.has(opt.string)) continue;
        usedStrings.add(opt.string);
        assignedNotes.push({ string: opt.string, fret: opt.fret, midi });
        if (search(idx + 1)) return true;
        assignedNotes.pop();
        usedStrings.delete(opt.string);
      }
      return false;
    }

    if (!search(0)) continue;

    if (allowExtraNotes) {
      const usedPcs = new Set(feasibleNotes.map(midiToPitchClass));
      const allPcs = Array.from(usedPcs);
      for (let s = 0; s < STRING_COUNT; s++) {
        if (usedStrings.has(s)) continue;
        for (const { fret, midi } of stringFretMap[s]) {
          if (fret >= lo && fret <= hi && allPcs.includes(midiToPitchClass(midi))) {
            assignedNotes.push({ string: s, fret, midi });
            usedStrings.add(s);
            break;
          }
        }
      }
    }

    assignedNotes.sort((a, b) => a.string - b.string);
    if (assignedNotes.length < minStrings) continue;

    const frets = assignedNotes.map(n => n.fret).filter(f => f > 0);
    const minFret = frets.length ? Math.min(...frets) : 0;
    const maxFret = frets.length ? Math.max(...frets) : 0;
    if (maxFret - minFret > MAX_HAND_SPAN) continue;

    const muted: number[] = [];
    for (let s = 0; s < STRING_COUNT; s++) {
      if (!assignedNotes.some(n => n.string === s)) muted.push(s);
    }

    let barre: GuitarShape['barre'] | undefined;
    const fretMap = new Map<number, number[]>();
    assignedNotes.forEach(n => {
      if (n.fret > 0) {
        const arr = fretMap.get(n.fret) ?? [];
        arr.push(n.string);
        fretMap.set(n.fret, arr);
      }
    });
    for (const [fret, strings] of fretMap) {
      if (strings.length >= 3) {
        strings.sort((a, b) => a - b);
        const consecutive = strings.slice(1).every((s, i) => s === strings[i] + 1);
        if (consecutive) {
          barre = { fret, fromString: strings[0], toString: strings[strings.length - 1], finger: 1 };
          break;
        }
      }
    }

    const { fingers, impossible } = assignFingers(assignedNotes, barre);
    const shape: GuitarShape = {
      notes: assignedNotes.map((n, i) => ({ ...n, finger: fingers[i] })),
      mutedStrings: muted,
      minFret,
      maxFret,
      barre,
      playabilityScore: computePlayabilityScore(assignedNotes, muted.length, minFret, maxFret, barre, impossible),
      fingeringImpossible: impossible,
    };

    results.push(shape);
  }

  const seen = new Set<string>();
  const unique: GuitarShape[] = [];
  for (const shape of results) {
    const key = shape.notes.map(n => `${n.string}:${n.fret}`).join(',');
    if (seen.has(key)) continue;
    seen.add(key);
    unique.push(shape);
  }

  const playable = unique.filter(s => !s.fingeringImpossible);
  const pool = playable.length > 0 ? playable : unique;

  pool.sort((a, b) => a.playabilityScore - b.playabilityScore);
  return pool.slice(0, maxResults);
}
