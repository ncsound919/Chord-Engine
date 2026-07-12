// theory/voicing.ts
// Piano and bass voicing generation, plus the voice-leading cost function
// that picks the smoothest-connecting voicing from a set of candidates.

import { midi, midiToPitchClass } from './pitch';

export type VoicingStyle = 'close' | 'drop2' | 'drop3' | 'rootless' | 'spread';

export interface Voicing {
  notes: number[];        // MIDI note numbers, low to high
  style: VoicingStyle;
  rootPc: number;
  bassNote: number;       // MIDI note actually in the bass (may differ from root for slash chords)
}

/**
 * Build close-position voicing: chord tones stacked in order starting
 * near a target octave, each subsequent tone placed just above the last.
 */
function buildClosePosition(chordTonesPc: number[], rootPc: number, targetOctave: number): number[] {
  const rootIdx = chordTonesPc.indexOf(rootPc);
  const ordered = rootIdx >= 0
    ? [...chordTonesPc.slice(rootIdx), ...chordTonesPc.slice(0, rootIdx)]
    : chordTonesPc;

  const notes: number[] = [];
  let lastMidi = midi(ordered[0], targetOctave) - 12; // seed below range so first note lands in target octave
  for (const pc of ordered) {
    let m = midi(pc, targetOctave);
    while (m <= lastMidi) m += 12;
    notes.push(m);
    lastMidi = m;
  }
  return notes;
}

/** Drop the second-highest voice down an octave — classic 4-part comping voicing. */
function dropVoice(notes: number[], indexFromTop: number): number[] {
  if (notes.length < indexFromTop + 1) return notes;
  const sorted = [...notes].sort((a, b) => a - b);
  const idx = sorted.length - 1 - indexFromTop;
  sorted[idx] -= 12;
  return sorted.sort((a, b) => a - b);
}

/**
 * Rootless voicing (Bill Evans / jazz piano convention): omit the root
 * entirely, since a bass player or left hand covers it. Keeps 3rd, 7th,
 * and available tensions — the notes that actually define the chord's
 * quality and color.
 */
function buildRootless(chordTonesPc: number[], rootPc: number, targetOctave: number): number[] {
  const withoutRoot = chordTonesPc.filter(pc => pc !== rootPc);
  if (withoutRoot.length === 0) return buildClosePosition(chordTonesPc, rootPc, targetOctave);
  return buildClosePosition(withoutRoot, withoutRoot[0], targetOctave);
}

/** Spread voicing: wide intervals, root doubled an octave apart, open sound (Isley/Jasper lush pad territory). */
function buildSpread(chordTonesPc: number[], rootPc: number, targetOctave: number): number[] {
  const close = buildClosePosition(chordTonesPc, rootPc, targetOctave);
  if (close.length < 3) return close;
  // Move every other tone (starting from the 2nd) up an octave to open up the voicing
  return close.map((n, i) => (i % 2 === 1 ? n + 12 : n)).sort((a, b) => a - b);
}

/**
 * Generate candidate voicings across all styles for a chord. Caller picks
 * the best one via voice-leading cost against the previous voicing.
 */
export function generateVoicingCandidates(
  chordTonesPc: number[],
  rootPc: number,
  targetOctave: number = 4
): Voicing[] {
  const candidates: Voicing[] = [];

  const close = buildClosePosition(chordTonesPc, rootPc, targetOctave);
  candidates.push({ notes: close, style: 'close', rootPc, bassNote: close[0] });

  if (chordTonesPc.length >= 4) {
    const d2 = dropVoice(close, 1);
    candidates.push({ notes: d2, style: 'drop2', rootPc, bassNote: d2[0] });

    const d3 = dropVoice(close, 2);
    candidates.push({ notes: d3, style: 'drop3', rootPc, bassNote: d3[0] });
  }

  const rootless = buildRootless(chordTonesPc, rootPc, targetOctave);
  candidates.push({ notes: rootless, style: 'rootless', rootPc, bassNote: rootless[0] });

  const spread = buildSpread(chordTonesPc, rootPc, targetOctave);
  candidates.push({ notes: spread, style: 'spread', rootPc, bassNote: spread[0] });

  return candidates;
}

/**
 * Voice-leading cost between two voicings: total absolute semitone motion
 * across paired voices (nearest-neighbor pairing), penalized for voice
 * crossing and for losing common tones. Lower is smoother.
 */
export function voiceLeadingCost(prev: number[], next: number[]): number {
  if (prev.length === 0) return 0;

  const prevSorted = [...prev].sort((a, b) => a - b);
  const nextSorted = [...next].sort((a, b) => a - b);

  // Pair by index after normalizing lengths (pad shorter list by repeating its edge notes)
  const len = Math.max(prevSorted.length, nextSorted.length);
  const pad = (arr: number[]) => {
    const out = [...arr];
    while (out.length < len) out.push(out[out.length - 1]);
    return out;
  };
  const a = pad(prevSorted);
  const b = pad(nextSorted);

  // FIX: the original code paired a[i]<->b[i] by rank (both arrays
  // independently sorted ascending) for BOTH motion and crossing. Rank
  // pairing structurally cannot represent crossing — a[i]<=a[i+1] and
  // b[i]<=b[i+1] always hold by construction, so the old
  // `(a[i]-a[i+1])*(b[i]-b[i+1]) < 0` check could never be true (confirmed:
  // 0 fires across 10,000 random trials). There's no voice identity left
  // to cross once both sides are independently sorted.
  //
  // Fix: assign each voice in `a` (low to high) to its nearest still-
  // unclaimed note in `b`, greedily. This preserves voice identity — voice
  // i "moves to" whichever destination note is closest to it that hasn't
  // already been claimed by a lower voice — and the SAME assignment is
  // used for both totalMotion and the crossing check, rather than mixing
  // two different pairings. Crossing is then well-defined: voice i's
  // destination lands strictly above voice (i+1)'s destination, even
  // though voice i started at or below voice (i+1) (a always sorted
  // ascending) — i.e. the two voices swapped relative position.
  const claimed = new Array(len).fill(false);
  const destinations: number[] = [];
  for (let i = 0; i < len; i++) {
    let bestIdx = -1;
    let bestDist = Infinity;
    for (let j = 0; j < len; j++) {
      if (claimed[j]) continue;
      const dist = Math.abs(a[i] - b[j]);
      if (dist < bestDist) {
        bestDist = dist;
        bestIdx = j;
      }
    }
    claimed[bestIdx] = true;
    destinations.push(b[bestIdx]);
  }

  let totalMotion = 0;
  let commonTones = 0;
  for (let i = 0; i < len; i++) {
    const dist = Math.abs(a[i] - destinations[i]);
    totalMotion += dist;
    if (dist === 0) commonTones++;
  }

  let crossingPenalty = 0;
  for (let i = 0; i < len - 1; i++) {
    if (destinations[i] > destinations[i + 1]) crossingPenalty += 4;
  }

  const commonToneBonus = commonTones * 2;

  return totalMotion + crossingPenalty - commonToneBonus;
}

/** Pick the voicing candidate that voice-leads most smoothly from the previous voicing. */
export function pickBestVoicing(candidates: Voicing[], prevVoicing: Voicing | null): Voicing | null {
  if (candidates.length === 0) return null;
  if (!prevVoicing) {
    // No prior context: default to closed/rootless-avoiding, moderate register — close position.
    return candidates.find(c => c.style === 'close') ?? candidates[0];
  }
  let best = candidates[0];
  let bestCost = Infinity;
  for (const c of candidates) {
    const cost = voiceLeadingCost(prevVoicing.notes, c.notes);
    if (cost < bestCost) {
      bestCost = cost;
      best = c;
    }
  }
  return best;
}

// ---- Bass: register-locked, root/5th/passing-tone logic ----

export interface BassNote {
  midi: number;
  role: 'root' | 'fifth' | 'passing' | 'approach';
}

const BASS_OCTAVE = 2; // E2-ish register, standard electric bass low range

/**
 * Generate a simple, register-correct bass line for a chord: root on the
 * downbeat, with optional 5th or chromatic/diatonic approach tone leading
 * into the NEXT chord's root — the kind of connective motion that separates
 * a real bass part from a static root-only pad.
 */
export function generateBassNote(
  rootPc: number,
  nextRootPc: number | null,
  beatPosition: 'downbeat' | 'approach'
): BassNote {
  const root = midi(rootPc, BASS_OCTAVE);

  if (beatPosition === 'downbeat' || nextRootPc === null) {
    return { midi: root, role: 'root' };
  }

  // Approach tone: prefer diatonic/chromatic step below the next root if within a whole step,
  // otherwise use the 5th of the current chord as a strong pivot (Chuck Rainey-style motion).
  const nextRoot = midi(nextRootPc, BASS_OCTAVE);
  const diff = nextRoot - root;

  if (Math.abs(diff) <= 2 && diff !== 0) {
    // step-wise approach directly into the next root
    const approachMidi = nextRoot - Math.sign(diff);
    return { midi: approachMidi, role: 'approach' };
  }

  const fifth = midi((rootPc + 7) % 12, BASS_OCTAVE);
  return { midi: fifth, role: 'fifth' };
}
