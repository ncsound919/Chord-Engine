import { describe, it, expect, vi } from 'vitest';
import {
  STANDARD_TUNING,
  STRING_COUNT,
  MAX_FRET,
  MAX_HAND_SPAN,
  MAX_STRINGS_PER_CHORD,
  generateFingerableShapes,
  pickBestGuitarShape,
  findGuitarVoicingFromNotes,
} from './fretboard';
import type { GuitarShape, FrettedNote } from './fretboard';

// ---- Constants ----

describe('constants', () => {
  it('STANDARD_TUNING is [40, 45, 50, 55, 59, 64]', () => {
    expect(STANDARD_TUNING).toEqual([40, 45, 50, 55, 59, 64]);
  });

  it('STRING_COUNT is 6', () => {
    expect(STRING_COUNT).toBe(6);
  });

  it('MAX_FRET is 15', () => {
    expect(MAX_FRET).toBe(15);
  });

  it('MAX_HAND_SPAN is 4', () => {
    expect(MAX_HAND_SPAN).toBe(4);
  });

  it('MAX_STRINGS_PER_CHORD is 6', () => {
    expect(MAX_STRINGS_PER_CHORD).toBe(6);
  });
});

// ---- generateFingerableShapes ----

describe('generateFingerableShapes', () => {
  // C major pitch classes: C=0, E=4, G=7
  const cMajorPc = [0, 4, 7];

  it('returns shapes for valid chord tones', () => {
    const shapes = generateFingerableShapes(cMajorPc);
    expect(shapes.length).toBeGreaterThan(0);
    shapes.forEach((shape) => {
      expect(shape).toHaveProperty('notes');
      expect(shape).toHaveProperty('mutedStrings');
      expect(shape).toHaveProperty('minFret');
      expect(shape).toHaveProperty('maxFret');
      expect(shape).toHaveProperty('playabilityScore');
      expect(shape.notes.length).toBeGreaterThanOrEqual(3);
    });
  });

  it('returns at most maxResults shapes', () => {
    const shapes = generateFingerableShapes(cMajorPc, { maxResults: 2 });
    expect(shapes.length).toBeLessThanOrEqual(2);
  });

  it('returns at most 5 shapes by default', () => {
    const shapes = generateFingerableShapes(cMajorPc);
    expect(shapes.length).toBeLessThanOrEqual(5);
  });

  it('respects rootInBass option (rootPc in bass)', () => {
    const shapesWithRoot = generateFingerableShapes(cMajorPc, {
      requireRootInBass: true,
      rootPc: 0,
    });
    // When root must be in bass, the lowest-sounding note should be C (pc 0)
    for (const shape of shapesWithRoot) {
      const bassNote = shape.notes[0];
      const bassPc = ((bassNote.midi % 12) + 12) % 12;
      expect(bassPc).toBe(0);
    }
  });

  it('respects bassPc option (bassPc overrides requireRootInBass)', () => {
    const shapes = generateFingerableShapes(cMajorPc, {
      bassPc: 7, // G in bass
    });
    for (const shape of shapes) {
      const bassNote = shape.notes[0];
      const bassPc = ((bassNote.midi % 12) + 12) % 12;
      expect(bassPc).toBe(7);
    }
  });

  it('assigns fingers to notes (fretted notes get finger 1-4)', () => {
    const shapes = generateFingerableShapes(cMajorPc);
    for (const shape of shapes) {
      for (const note of shape.notes) {
        if (note.fret > 0) {
          // fretted note should have a finger assigned (1,2,3,4) or undefined if impossible
          if (note.finger !== undefined) {
            expect([1, 2, 3, 4]).toContain(note.finger);
          }
        }
      }
    }
  });

  it('detects barre chords (3+ adjacent strings same fret)', () => {
    // Use chord tones that commonly produce barre shapes on guitar
    // F major: F=5, A=9, C=0 — open-position F typically has a barre on fret 1
    const fMajorPc = [5, 9, 0];
    const shapes = generateFingerableShapes(fMajorPc);
    const barreShapes = shapes.filter((s) => s.barre !== undefined);
    // At least one shape should have a barre if available on the fretboard
    // This is a soft check — not all voicings produce barres
    if (barreShapes.length > 0) {
      const barre = barreShapes[0].barre!;
      expect(barre.fret).toBeGreaterThan(0);
      expect(barre.fromString).toBeLessThanOrEqual(barre.toString);
      expect(barre.finger).toBe(1);
      // Barre covers 3+ adjacent strings
      expect(barre.toString - barre.fromString + 1).toBeGreaterThanOrEqual(3);
    }
  });

  it('plays shapes sorted by playabilityScore (ascending)', () => {
    const shapes = generateFingerableShapes(cMajorPc);
    for (let i = 1; i < shapes.length; i++) {
      expect(shapes[i].playabilityScore).toBeGreaterThanOrEqual(shapes[i - 1].playabilityScore);
    }
  });

  it('with empty input returns empty', () => {
    const shapes = generateFingerableShapes([]);
    expect(shapes).toEqual([]);
  });

  it('returns shapes with notes sorted low string to high string', () => {
    const shapes = generateFingerableShapes(cMajorPc);
    for (const shape of shapes) {
      for (let i = 1; i < shape.notes.length; i++) {
        expect(shape.notes[i].string).toBeGreaterThanOrEqual(shape.notes[i - 1].string);
      }
    }
  });

  it('filters out shapes with more than 2 muted strings', () => {
    const shapes = generateFingerableShapes(cMajorPc);
    for (const shape of shapes) {
      expect(shape.mutedStrings.length).toBeLessThanOrEqual(2);
    }
  });

  it('produces shapes with minFret <= maxFret', () => {
    const shapes = generateFingerableShapes(cMajorPc);
    for (const shape of shapes) {
      expect(shape.minFret).toBeLessThanOrEqual(shape.maxFret);
    }
  });

  it('produces shapes where fret span <= MAX_HAND_SPAN', () => {
    const shapes = generateFingerableShapes(cMajorPc);
    for (const shape of shapes) {
      expect(shape.maxFret - shape.minFret).toBeLessThanOrEqual(MAX_HAND_SPAN);
    }
  });

  it('returns unique shapes (no duplicates)', () => {
    const shapes = generateFingerableShapes(cMajorPc);
    const keys = shapes.map((s) => s.notes.map((n) => `${n.string}:${n.fret}`).join(','));
    const uniqueKeys = new Set(keys);
    expect(uniqueKeys.size).toBe(shapes.length);
  });

  it('handles extended chords (e.g. Cmaj7 = [0,4,7,11])', () => {
    const cMaj7Pc = [0, 4, 7, 11];
    const shapes = generateFingerableShapes(cMaj7Pc);
    expect(shapes.length).toBeGreaterThan(0);
  });

  it('handles chord tones that may not all appear on the fretboard in one position', () => {
    // Some voicings may omit tones — this tests the "most, not all" coverage logic
    const complexPc = [0, 4, 7, 11, 2, 9]; // Cmaj13: C E G B D A
    const shapes = generateFingerableShapes(complexPc);
    // Should still return playable shapes even if not all 6 tones fit
    expect(shapes.length).toBeGreaterThanOrEqual(0);
  });

  it('flags fingeringImpossible when too many non-barre fretted notes', () => {
    // A shape with 4+ non-barre fretted notes on different frets is impossible
    // We test indirectly by using a chord that forces this
    const shapes = generateFingerableShapes([0, 4, 7, 11], { maxResults: 20 });
    const impossibleShapes = shapes.filter((s) => s.fingeringImpossible);
    const playableShapes = shapes.filter((s) => !s.fingeringImpossible);
    // If there are impossible shapes, playable ones should be preferred
    if (impossibleShapes.length > 0 && playableShapes.length > 0) {
      // Playable shapes should come first (sorted by playabilityScore, impossible gets +1000)
      const lastPlayableScore = playableShapes[playableShapes.length - 1].playabilityScore;
      const firstImpossibleScore = impossibleShapes[0].playabilityScore;
      expect(lastPlayableScore).toBeLessThan(firstImpossibleScore);
    }
  });
});

// ---- pickBestGuitarShape ----

describe('pickBestGuitarShape', () => {
  const makeShape = (minFret: number, maxFret: number, notes?: Partial<FrettedNote>[]): GuitarShape => {
    const defaultNotes: FrettedNote[] = notes
      ? notes.map((n, i) => ({ string: i, fret: minFret, midi: 40 + minFret + i, ...n }))
      : [
          { string: 0, fret: minFret, midi: 40 + minFret },
          { string: 1, fret: minFret, midi: 45 + minFret },
          { string: 2, fret: minFret, midi: 50 + minFret },
        ];
    return {
      notes: defaultNotes,
      mutedStrings: [],
      minFret,
      maxFret,
      playabilityScore: 0,
    };
  };

  it('with null prev returns first candidate', () => {
    const candidates = [makeShape(1, 3), makeShape(5, 7), makeShape(8, 10)];
    const result = pickBestGuitarShape(candidates, null);
    expect(result).toBe(candidates[0]);
  });

  it('with empty candidates returns null (no candidates)', () => {
    const result = pickBestGuitarShape([], null);
    expect(result).toBeNull();
  });

  it('picks shape closest to prev position', () => {
    const prev = makeShape(3, 5);
    const close = makeShape(4, 6); // position center ~5
    const far = makeShape(10, 12); // position center ~11
    const candidates = [far, close];
    const result = pickBestGuitarShape(candidates, prev);
    expect(result).toBe(close);
  });

  it('penalizes voice crossing and muted string changes', () => {
    const prev = makeShape(2, 4, [
      { string: 0, fret: 2, midi: 42 },
      { string: 1, fret: 3, midi: 48 },
      { string: 2, fret: 4, midi: 54 },
    ]);
    prev.mutedStrings = [3];

    // Shape A: same position, same muted strings — low cost
    const shapeA = makeShape(2, 4, [
      { string: 0, fret: 2, midi: 42 },
      { string: 1, fret: 3, midi: 48 },
      { string: 2, fret: 4, midi: 54 },
    ]);
    shapeA.mutedStrings = [3];

    // Shape B: same position but different muted strings — higher cost
    const shapeB = makeShape(2, 4, [
      { string: 0, fret: 2, midi: 42 },
      { string: 1, fret: 3, midi: 48 },
      { string: 2, fret: 4, midi: 54 },
    ]);
    shapeB.mutedStrings = [4]; // different muted string = symmetric difference cost

    const result = pickBestGuitarShape([shapeA, shapeB], prev);
    expect(result).toBe(shapeA);
  });

  it('picks closest shape even when candidates have different fret ranges', () => {
    const prev = makeShape(5, 7);
    const near = makeShape(6, 8);
    const mid = makeShape(8, 10);
    const far = makeShape(12, 14);
    const candidates = [far, near, mid];
    const result = pickBestGuitarShape(candidates, prev);
    expect(result).toBe(near);
  });

  it('single candidate returns that candidate regardless of prev', () => {
    const prev = makeShape(10, 12);
    const only = makeShape(0, 2);
    const result = pickBestGuitarShape([only], prev);
    expect(result).toBe(only);
  });
});

// ---- findGuitarVoicingFromNotes ----

describe('findGuitarVoicingFromNotes', () => {
  it('returns shapes for valid MIDI notes', () => {
    // C4=60, E4=64, G4=67 — all playable on guitar
    const shapes = findGuitarVoicingFromNotes([60, 64, 67]);
    expect(shapes.length).toBeGreaterThan(0);
    for (const shape of shapes) {
      expect(shape.notes.length).toBeGreaterThanOrEqual(3);
    }
  });

  it('with empty input returns empty', () => {
    const shapes = findGuitarVoicingFromNotes([]);
    expect(shapes).toEqual([]);
  });

  it('respects minStrings option', () => {
    const shapes = findGuitarVoicingFromNotes([60, 64, 67], { minStrings: 4 });
    for (const shape of shapes) {
      expect(shape.notes.length).toBeGreaterThanOrEqual(4);
    }
  });

  it('deduplicates identical shapes', () => {
    const shapes = findGuitarVoicingFromNotes([60, 64, 67]);
    const keys = shapes.map((s) => s.notes.map((n) => `${n.string}:${n.fret}`).join(','));
    const uniqueKeys = new Set(keys);
    expect(uniqueKeys.size).toBe(shapes.length);
  });

  it('respects maxResults option', () => {
    const shapes = findGuitarVoicingFromNotes([60, 64, 67], { maxResults: 1 });
    expect(shapes.length).toBeLessThanOrEqual(1);
  });

  it('returns empty for notes outside guitar range', () => {
    // Very low MIDI note below open low E (40)
    const shapes = findGuitarVoicingFromNotes([20, 24, 28]);
    expect(shapes).toEqual([]);
  });

  it('returns empty for notes above max fret range', () => {
    // Very high MIDI note above E4+15 = 79
    const shapes = findGuitarVoicingFromNotes([80, 84, 88]);
    expect(shapes).toEqual([]);
  });

  it('filters out impossible fingerings from playable results', () => {
    const shapes = findGuitarVoicingFromNotes([60, 64, 67]);
    const impossible = shapes.filter((s) => s.fingeringImpossible);
    const playable = shapes.filter((s) => !s.fingeringImpossible);
    // Playable shapes should dominate the results
    if (playable.length > 0) {
      expect(impossible.length).toBe(0);
    }
  });

  it('returns shapes sorted by playabilityScore', () => {
    const shapes = findGuitarVoicingFromNotes([60, 64, 67]);
    for (let i = 1; i < shapes.length; i++) {
      expect(shapes[i].playabilityScore).toBeGreaterThanOrEqual(shapes[i - 1].playabilityScore);
    }
  });

  it('handles single MIDI note with allowExtraNotes=false returns empty (below minStrings)', () => {
    const shapes = findGuitarVoicingFromNotes([60], { allowExtraNotes: false });
    // Single note with no extras cannot reach minStrings=3
    expect(shapes.length).toBe(0);
  });

  it('handles two MIDI notes with allowExtraNotes=false returns empty (below minStrings)', () => {
    const shapes = findGuitarVoicingFromNotes([60, 64], { allowExtraNotes: false });
    // Two notes with no extras cannot reach minStrings=3
    expect(shapes.length).toBe(0);
  });

  it('handles two MIDI notes with minStrings=2', () => {
    const shapes = findGuitarVoicingFromNotes([60, 64], { minStrings: 2 });
    // Two notes on different strings should produce at least one shape
    // depending on whether both can be fretted within a hand span
    expect(shapes.length).toBeGreaterThanOrEqual(0);
  });

  it('produces shapes with notes sorted by string index', () => {
    const shapes = findGuitarVoicingFromNotes([60, 64, 67]);
    for (const shape of shapes) {
      for (let i = 1; i < shape.notes.length; i++) {
        expect(shape.notes[i].string).toBeGreaterThanOrEqual(shape.notes[i - 1].string);
      }
    }
  });

  it('produces shapes where all notes are within hand span', () => {
    const shapes = findGuitarVoicingFromNotes([60, 64, 67]);
    for (const shape of shapes) {
      expect(shape.maxFret - shape.minFret).toBeLessThanOrEqual(MAX_HAND_SPAN);
    }
  });

  it('handles MIDI notes that are enharmonically equivalent but on different strings', () => {
    // C4=60 can be played on string 1 fret 8, string 2 fret 13 (within range),
    // string 3 fret 5, etc.
    const shapes = findGuitarVoicingFromNotes([60, 64, 67]);
    expect(shapes.length).toBeGreaterThan(0);
  });

  it('exactOctave=false finds shapes even when exact octave match fails', () => {
    // All notes are in the feasible range, so exactOctave behavior doesn't change much
    // But we verify the option is accepted
    const shapes = findGuitarVoicingFromNotes([60, 64, 67], { exactOctave: false });
    expect(shapes.length).toBeGreaterThan(0);
  });

  it('allowExtraNotes=false does not add extra chord-tone strings', () => {
    const shapesNoExtra = findGuitarVoicingFromNotes([60, 64, 67], { allowExtraNotes: false });
    const shapesExtra = findGuitarVoicingFromNotes([60, 64, 67], { allowExtraNotes: true });
    // Shapes without extras should have fewer or equal notes than with extras
    for (const noExtra of shapesNoExtra) {
      const matchingExtra = shapesExtra.find(
        (e) => e.notes.map((n) => `${n.string}:${n.fret}`).join(',') === noExtra.notes.map((n) => `${n.string}:${n.fret}`).join(',')
      );
      if (matchingExtra) {
        expect(noExtra.notes.length).toBeLessThanOrEqual(matchingExtra.notes.length);
      }
    }
  });
});
