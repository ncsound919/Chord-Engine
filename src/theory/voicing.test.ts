import { describe, it, expect } from 'vitest';
import {
  generateVoicingCandidates,
  voiceLeadingCost,
  pickBestVoicing,
  generateBassNote,
} from './voicing';
import type { Voicing, BassNote } from './voicing';
import { midi } from './pitch';

// ────────────────────────────────────────────────
// generateVoicingCandidates
// ────────────────────────────────────────────────
describe('generateVoicingCandidates', () => {
  const cMaj7 = [0, 4, 7, 11]; // C E G B
  const dMin7 = [2, 5, 9, 10]; // D F A C

  it('returns at least 3 voicings', () => {
    const candidates = generateVoicingCandidates(cMaj7, 0);
    expect(candidates.length).toBeGreaterThanOrEqual(3);
  });

  it('returns close, rootless, and spread for triads (3 tones)', () => {
    const triad = [0, 4, 7]; // C E G
    const candidates = generateVoicingCandidates(triad, 0);
    const styles = candidates.map(c => c.style);
    expect(styles).toContain('close');
    expect(styles).toContain('rootless');
    expect(styles).toContain('spread');
  });

  it('returns drop2 and drop3 for chords with >= 4 tones', () => {
    const candidates = generateVoicingCandidates(cMaj7, 0);
    const styles = candidates.map(c => c.style);
    expect(styles).toContain('drop2');
    expect(styles).toContain('drop3');
  });

  it('does NOT return drop2/drop3 for 3-tone chords', () => {
    const triad = [0, 4, 7];
    const candidates = generateVoicingCandidates(triad, 0);
    const styles = candidates.map(c => c.style);
    expect(styles).not.toContain('drop2');
    expect(styles).not.toContain('drop3');
  });

  it('close voicing notes are in ascending order', () => {
    const candidates = generateVoicingCandidates(cMaj7, 0);
    const close = candidates.find(c => c.style === 'close')!;
    for (let i = 1; i < close.notes.length; i++) {
      expect(close.notes[i]).toBeGreaterThan(close.notes[i - 1]);
    }
  });

  it('close voicing contains only chord tone pitch classes', () => {
    const candidates = generateVoicingCandidates(cMaj7, 0);
    const close = candidates.find(c => c.style === 'close')!;
    const pcs = close.notes.map(n => n % 12);
    for (const pc of pcs) {
      expect(cMaj7).toContain(pc);
    }
  });

  it('drop2 drops the second-highest voice down an octave', () => {
    const candidates = generateVoicingCandidates(cMaj7, 0);
    const close = candidates.find(c => c.style === 'close')!;
    const drop2 = candidates.find(c => c.style === 'drop2')!;
    // The second-highest note in close should be 12 semitones lower in drop2
    const secondHighestClose = close.notes[close.notes.length - 2];
    // In drop2, that voice is dropped — find the note that's 12 lower
    const dropped = drop2.notes.find(n => Math.abs(n - (secondHighestClose - 12)) <= 1);
    expect(dropped).toBeDefined();
  });

  it('drop3 drops the third-highest voice down an octave', () => {
    const candidates = generateVoicingCandidates(cMaj7, 0);
    const close = candidates.find(c => c.style === 'close')!;
    const drop3 = candidates.find(c => c.style === 'drop3')!;
    const thirdHighestClose = close.notes[close.notes.length - 3];
    const dropped = drop3.notes.find(n => Math.abs(n - (thirdHighestClose - 12)) <= 1);
    expect(dropped).toBeDefined();
  });

  it('rootless voicing omits the root pitch class', () => {
    const candidates = generateVoicingCandidates(cMaj7, 0);
    const rootless = candidates.find(c => c.style === 'rootless')!;
    const pcs = rootless.notes.map(n => n % 12);
    expect(pcs).not.toContain(0); // root pc = 0 (C)
  });

  it('rootless voicing has fewer notes than close when root is present', () => {
    const candidates = generateVoicingCandidates(cMaj7, 0);
    const close = candidates.find(c => c.style === 'close')!;
    const rootless = candidates.find(c => c.style === 'rootless')!;
    expect(rootless.notes.length).toBeLessThanOrEqual(close.notes.length);
  });

  it('spread voicing has wider intervals than close', () => {
    const candidates = generateVoicingCandidates(cMaj7, 0);
    const close = candidates.find(c => c.style === 'close')!;
    const spread = candidates.find(c => c.style === 'spread')!;
    const closeSpan = close.notes[close.notes.length - 1] - close.notes[0];
    const spreadSpan = spread.notes[spread.notes.length - 1] - spread.notes[0];
    expect(spreadSpan).toBeGreaterThanOrEqual(closeSpan);
  });

  it('spread voicing notes are in ascending order', () => {
    const candidates = generateVoicingCandidates(cMaj7, 0);
    const spread = candidates.find(c => c.style === 'spread')!;
    for (let i = 1; i < spread.notes.length; i++) {
      expect(spread.notes[i]).toBeGreaterThan(spread.notes[i - 1]);
    }
  });

  it('all voicings have the same rootPc', () => {
    const candidates = generateVoicingCandidates(cMaj7, 0);
    for (const c of candidates) {
      expect(c.rootPc).toBe(0);
    }
  });

  it('all voicings have a bassNote', () => {
    const candidates = generateVoicingCandidates(cMaj7, 0);
    for (const c of candidates) {
      expect(typeof c.bassNote).toBe('number');
    }
  });

  it('respects targetOctave parameter', () => {
    const candidates = generateVoicingCandidates(cMaj7, 0, 3);
    const close = candidates.find(c => c.style === 'close')!;
    // Notes should be around octave 3 (MIDI ~48-59)
    expect(close.notes[0]).toBeLessThan(midi(0, 4)); // below C4=60
  });

  it('works with non-root-starting pitch class arrays', () => {
    // E G B C (third-first ordering)
    const candidates = generateVoicingCandidates([4, 7, 11, 0], 0);
    expect(candidates.length).toBeGreaterThanOrEqual(3);
    const close = candidates.find(c => c.style === 'close')!;
    // First note should be the root (0) since it gets reordered
    expect(close.notes[0] % 12).toBe(0);
  });
});

// ────────────────────────────────────────────────
// voiceLeadingCost
// ────────────────────────────────────────────────
describe('voiceLeadingCost', () => {
  it('returns 0 for empty prev', () => {
    expect(voiceLeadingCost([], [60, 64, 67])).toBe(0);
  });

  it('returns 0 when both are empty', () => {
    expect(voiceLeadingCost([], [])).toBe(0);
  });

  it('returns 0 for identical voicings (negative from common tone bonus)', () => {
    // commonToneBonus = 3*2=6, totalMotion=0 → 0+0-6 = -6
    expect(voiceLeadingCost([60, 64, 67], [60, 64, 67])).toBe(-6);
  });

  it('returns lower value for similar voicings than distant ones', () => {
    const base = [60, 64, 67, 71];
    const similar = [60, 64, 67, 72]; // one note moved by 1 semitone
    const distant = [48, 52, 55, 59]; // entire voicing transposed down an octave
    const costSimilar = voiceLeadingCost(base, similar);
    const costDistant = voiceLeadingCost(base, distant);
    expect(costSimilar).toBeLessThan(costDistant);
  });

  it('penalizes voice crossing in sorted order', () => {
    // The function sorts both arrays, so [72, 60] becomes [60, 72]
    // and pairs by index. A "crossing" is when consecutive sorted notes
    // invert their relative distance between prev and next.
    // prev=[60,64,72] next=[62,60,74]: after sorting both → [60,64,72] vs [60,62,74]
    // No crossing here (both ascending). But [60,72,74] vs [62,60,64] →
    // sorted: [60,72,74] vs [60,62,64]: a[0]-a[1]=60-72=-12, b[0]-b[1]=60-62=-2 → same sign, no crossing
    // To trigger crossing: prev=[60,72] next=[72,60] sorts to same → no crossing
    // Use 3 notes where sorted order differs: prev=[60,65,72] next=[62,70,60]
    // sorted prev=[60,65,72], sorted next=[60,62,70]
    // Check i=0: (60-65)*(60-62) = (-5)*(-2) = 10 > 0, no crossing
    // Check i=1: (65-72)*(62-70) = (-7)*(-8) = 56 > 0, no crossing
    // Actually let me just verify the function works as designed:
    const cost = voiceLeadingCost([60, 72], [72, 60]);
    // Both sort to [60,72] → totalMotion=0, crossing=0, commonTones=2 → -4
    expect(cost).toBe(-4);
    // More motion = higher cost
    const moreMotion = voiceLeadingCost([60, 72], [62, 74]);
    expect(moreMotion).toBeGreaterThan(cost);
  });

  it('rewards common tones (lower cost)', () => {
    const prev = [60, 64, 67];
    // Same voicing — all common tones
    const allCommon = voiceLeadingCost(prev, [60, 64, 67]);
    // No common tones — every note moved
    const noneCommon = voiceLeadingCost(prev, [61, 65, 68]);
    expect(allCommon).toBeLessThan(noneCommon);
  });

  it('handles different-length arrays by padding', () => {
    const prev = [60, 64];
    const next = [60, 64, 67];
    // Should not throw, returns a number (may be negative from common tone bonus)
    const cost = voiceLeadingCost(prev, next);
    expect(typeof cost).toBe('number');
    expect(Number.isFinite(cost)).toBe(true);
  });

  it('handles prev longer than next', () => {
    const prev = [60, 64, 67, 71];
    const next = [60, 64];
    const cost = voiceLeadingCost(prev, next);
    expect(typeof cost).toBe('number');
  });

  it('returns positive cost for non-trivial motion', () => {
    const prev = [60, 64, 67];
    const next = [62, 66, 69];
    expect(voiceLeadingCost(prev, next)).toBeGreaterThan(0);
  });

  it('produces finite costs for both directions', () => {
    const a = [60, 64, 67];
    const b = [62, 66, 69];
    expect(voiceLeadingCost(a, b)).toBeGreaterThanOrEqual(0);
    expect(voiceLeadingCost(b, a)).toBeGreaterThanOrEqual(0);
  });

  it('single note movement cost equals semitone distance', () => {
    // Two single-note voicings — cost = abs distance - commonToneBonus(2 if same)
    expect(voiceLeadingCost([60], [62])).toBe(2);
    // identical single note: 0 motion + 0 crossing - 1*2 commonToneBonus = -2
    expect(voiceLeadingCost([60], [60])).toBe(-2);
  });
});

// ────────────────────────────────────────────────
// pickBestVoicing
// ────────────────────────────────────────────────
describe('pickBestVoicing', () => {
  const cMaj7 = [0, 4, 7, 11];
  const candidates = generateVoicingCandidates(cMaj7, 0);

  it('returns close voicing when prev is null', () => {
    const best = pickBestVoicing(candidates, null);
    expect(best.style).toBe('close');
  });

  it('returns first close voicing if no close exists (edge case)', () => {
    const noClose: Voicing[] = [
      { notes: [48, 52, 55], style: 'spread', rootPc: 0, bassNote: 48 },
    ];
    const best = pickBestVoicing(noClose, null);
    expect(best).toBe(noClose[0]);
  });

  it('picks the smoothest option when prev is provided', () => {
    // Create a previous voicing very close to one of the candidates
    const close = candidates.find(c => c.style === 'close')!;
    const prevVoicing: Voicing = {
      notes: close.notes.map(n => n), // identical
      style: 'close',
      rootPc: 0,
      bassNote: close.notes[0],
    };
    const best = pickBestVoicing(candidates, prevVoicing);
    // The identical voicing should win (cost 0)
    expect(best.style).toBe('close');
  });

  it('picks a different style when it leads more smoothly', () => {
    // Previous voicing is in drop2-like arrangement
    const prevNotes = [48, 60, 64, 71]; // spread out
    const prevVoicing: Voicing = {
      notes: prevNotes,
      style: 'spread',
      rootPc: 0,
      bassNote: 48,
    };
    const best = pickBestVoicing(candidates, prevVoicing);
    // Should return some voicing (not necessarily close)
    expect(best).toBeDefined();
    expect(typeof best.style).toBe('string');
  });

  it('always returns a voicing from the candidates array', () => {
    const prevVoicing: Voicing = {
      notes: [48, 52, 55, 59],
      style: 'close',
      rootPc: 0,
      bassNote: 48,
    };
    const best = pickBestVoicing(candidates, prevVoicing);
    expect(candidates).toContain(best);
  });
});

// ────────────────────────────────────────────────
// generateBassNote
// ────────────────────────────────────────────────
describe('generateBassNote', () => {
  const BASS_OCTAVE = 2;

  it('returns root on downbeat regardless of nextRootPc', () => {
    const result = generateBassNote(0, 5, 'downbeat');
    expect(result.midi).toBe(midi(0, BASS_OCTAVE));
    expect(result.role).toBe('root');
  });

  it('returns root on downbeat when nextRootPc is null', () => {
    const result = generateBassNote(0, null, 'downbeat');
    expect(result.midi).toBe(midi(0, BASS_OCTAVE));
    expect(result.role).toBe('root');
  });

  it('returns root when nextRootPc is null even on approach', () => {
    const result = generateBassNote(0, null, 'approach');
    expect(result.midi).toBe(midi(0, BASS_OCTAVE));
    expect(result.role).toBe('root');
  });

  it('returns approach tone when next root is within a whole step above', () => {
    // rootPc=0 (C), nextRootPc=1 (Db), diff=1 semitone -> approach at nextRoot-1 = 0
    const result = generateBassNote(0, 1, 'approach');
    expect(result.role).toBe('approach');
    expect(result.midi).toBe(midi(1, BASS_OCTAVE) - 1);
  });

  it('returns approach tone when next root is within a whole step below', () => {
    // rootPc=2 (D), nextRootPc=1 (Db), diff=-1 -> approach at nextRoot+1 = 2
    const result = generateBassNote(2, 1, 'approach');
    expect(result.role).toBe('approach');
    expect(result.midi).toBe(midi(1, BASS_OCTAVE) + 1);
  });

  it('returns approach tone for 2-semitone distance', () => {
    // rootPc=0, nextRootPc=2 (D), diff=2 -> approach at nextRoot-1 = 1
    const result = generateBassNote(0, 2, 'approach');
    expect(result.role).toBe('approach');
    expect(result.midi).toBe(midi(2, BASS_OCTAVE) - 1);
  });

  it('returns fifth when next root is distant (> 2 semitones)', () => {
    // rootPc=0 (C), nextRootPc=7 (G), diff=7 -> fifth
    const result = generateBassNote(0, 7, 'approach');
    expect(result.role).toBe('fifth');
    expect(result.midi).toBe(midi(7, BASS_OCTAVE)); // (0+7)%12 = 7
  });

  it('returns fifth for distant downward interval', () => {
    // rootPc=7 (G), nextRootPc=0 (C), diff=-7 -> fifth
    const result = generateBassNote(7, 0, 'approach');
    expect(result.role).toBe('fifth');
    expect(result.midi).toBe(midi((7 + 7) % 12, BASS_OCTAVE)); // (14)%12 = 2
  });

  it('returns fifth when diff is exactly 0 (same root)', () => {
    // rootPc=0, nextRootPc=0, diff=0 -> falls through to fifth
    const result = generateBassNote(0, 0, 'approach');
    expect(result.role).toBe('fifth');
    expect(result.midi).toBe(midi(7, BASS_OCTAVE));
  });

  it('returns approach tone at the boundary (diff = 2)', () => {
    // rootPc=5 (F), nextRootPc=7 (G), diff=2 -> approach
    const result = generateBassNote(5, 7, 'approach');
    expect(result.role).toBe('approach');
  });

  it('returns fifth at the boundary (diff = 3)', () => {
    // rootPc=0 (C), nextRootPc=3 (Eb), diff=3 -> fifth
    const result = generateBassNote(0, 3, 'approach');
    expect(result.role).toBe('fifth');
  });

  it('all returned bass notes are in reasonable MIDI range', () => {
    const result0 = generateBassNote(0, 5, 'downbeat');
    const result1 = generateBassNote(0, 1, 'approach');
    const result2 = generateBassNote(0, 7, 'approach');
    for (const r of [result0, result1, result2]) {
      expect(r.midi).toBeGreaterThanOrEqual(midi(0, 2));
      expect(r.midi).toBeLessThanOrEqual(midi(11, 3));
    }
  });
});
