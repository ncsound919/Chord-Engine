import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  runGenerationPipeline,
  compileAndGenerate,
  applySubstitution,
  applyCriticFix,
  GenerateInput,
} from './generatePipeline';
import { GeneratedSection } from './engine';

vi.mock('../theory/arcPlanner', () => ({
  planSongArc: vi.fn((sections) => ({
    sections: sections.map((s: any) => ({ sectionId: s.id, targetComplexity: 2 })),
  })),
}));

vi.mock('../theory/melody', () => ({
  generateMelodyForSection: vi.fn(() => []),
}));

vi.mock('../theory/songFraming', () => ({
  resolveBlendedProfile: vi.fn(() => ({
    writers: { bacharach: { weight: 100 } },
    harmonicStyle: 'sophisticated',
    rhythmStyle: 'syncopated',
  })),
  frameSong: vi.fn((profile) => ({
    sections: [{ id: 'verse', name: 'Verse', preset: 'steely', lengthBars: 8 }],
  })),
}));

vi.mock('../theory/rhythmicReframer', () => ({
  reframeSong: vi.fn((_, sections) => sections),
}));

vi.mock('../theory/harmony', () => ({
  buildNodeSet: vi.fn(() => []),
}));

vi.mock('../theory/pitch', () => ({
  chordTonesForQuality: vi.fn(() => []),
}));

vi.mock('../theory/voicing', () => ({
  generateVoicingCandidates: vi.fn(() => []),
}));

vi.mock('../theory/fretboard', () => ({
  generateFingerableShapes: vi.fn(() => []),
}));

vi.mock('./engine', () => ({
  generateProgression: vi.fn((key, sections) =>
    sections.map((s: any) => ({
      ...s,
      chords: [
        { bar: 1, beat: 1, roman: 'I', pianoVoicing: { notes: [60, 64, 67], style: 'close' }, bassNote: { midi: 36 } },
      ],
      drumPattern: { grid: {} },
    }))
  ),
  substituteChord: vi.fn((sections) => sections),
  hydrateSectionChords: vi.fn((sections) => sections),
  KEYS: ['C', 'G', 'D', 'A', 'E', 'B', 'F', 'Bb', 'Eb', 'Ab', 'Db', 'Gb'],
}));

function makeInput(overrides?: Partial<GenerateInput>): GenerateInput {
  return {
    musicKey: 'C',
    seed: 'test-seed-1',
    sections: [{ id: 'verse', name: 'Verse', preset: 'pop' as any, lengthBars: 8 }],
    writerWeights: { bacharach: 100 } as any,
    reframeTarget: 'none',
    ...overrides,
  };
}

describe('runGenerationPipeline', () => {
  it('returns GeneratedSection[]', () => {
    const result = runGenerationPipeline(makeInput());
    expect(Array.isArray(result)).toBe(true);
    expect(result.length).toBeGreaterThan(0);
    expect(result[0]).toHaveProperty('chords');
  });

  it('calls planSongArc with the input sections', async () => {
    const { planSongArc } = await import('../theory/arcPlanner');
    const input = makeInput();
    runGenerationPipeline(input);
    expect(planSongArc).toHaveBeenCalledWith(input.sections);
  });

  it('calls generateProgression', async () => {
    const { generateProgression } = await import('./engine');
    const input = makeInput();
    runGenerationPipeline(input);
    expect(generateProgression).toHaveBeenCalled();
  });
});

describe('compileAndGenerate', () => {
  it('returns { sections, generated }', () => {
    const input = makeInput();
    const result = compileAndGenerate(input);
    expect(result).toHaveProperty('sections');
    expect(result).toHaveProperty('generated');
    expect(Array.isArray(result.sections)).toBe(true);
    expect(Array.isArray(result.generated)).toBe(true);
    expect(result.sections.length).toBeGreaterThan(0);
  });
});

describe('applySubstitution', () => {
  it('calls substituteChord for replace_chord', async () => {
    const { substituteChord } = await import('./engine');
    const generated: GeneratedSection[] = [
      { def: { id: 'v', name: 'Verse', preset: 'pop' as any, lengthBars: 4 }, chords: [{ bar: 1, beat: 1, roman: 'I', chordName: 'C' }] as any },
    ];
    applySubstitution(generated, 0, 0, 'replace_chord:ii', 'C', 'seed');
    expect(substituteChord).toHaveBeenCalled();
  });

  it('returns updated sections for replace_chord', () => {
    const generated: GeneratedSection[] = [
      { def: { id: 'v', name: 'Verse', preset: 'pop' as any, lengthBars: 4 }, chords: [{ bar: 1, beat: 1, roman: 'I', chordName: 'C' }] as any },
    ];
    const result = applySubstitution(generated, 0, 0, 'replace_chord:ii', 'C', 'seed');
    expect(result).toHaveLength(1);
    expect(result).not.toBe(generated);
  });

  it('appends blank section for add_blank_section', () => {
    const generated: GeneratedSection[] = [
      { def: { id: 'v', name: 'Verse', preset: 'pop' as any, lengthBars: 4 }, chords: [] },
    ];
    const result = applySubstitution(generated, 0, 0, 'add_blank_section', 'C', 'seed');
    expect(result).toHaveLength(2);
    expect(result[1].def.name).toBe('Custom');
  });

  it('returns original generated for out-of-range section index', () => {
    const generated: GeneratedSection[] = [
      { def: { id: 'v', name: 'Verse', preset: 'pop' as any, lengthBars: 4 }, chords: [] },
    ];
    const result = applySubstitution(generated, 5, 0, 'replace_chord:I', 'C', 'seed');
    expect(result).toBe(generated);
  });

  it('deletes chord and renumbers bars', () => {
    const generated: GeneratedSection[] = [
      { def: { id: 'v', name: 'Verse', preset: 'pop' as any, lengthBars: 4 }, chords: [{ bar: 1, beat: 1, roman: 'I' }, { bar: 2, beat: 1, roman: 'IV' }] as any },
    ];
    const result = applySubstitution(generated, 0, 0, 'delete_chord', 'C', 'seed');
    expect(result[0].chords).toHaveLength(1);
  });

  it('moves chord left', () => {
    const generated: GeneratedSection[] = [
      { def: { id: 'v', name: 'Verse', preset: 'pop' as any, lengthBars: 4 }, chords: [{ bar: 1, beat: 1, roman: 'I' }, { bar: 2, beat: 1, roman: 'IV' }] as any },
    ];
    const result = applySubstitution(generated, 0, 1, 'move_left', 'C', 'seed');
    expect(result[0].chords[0].roman).toBe('IV');
    expect(result[0].chords[1].roman).toBe('I');
  });

  it('returns original when move_left at index 0', () => {
    const generated: GeneratedSection[] = [
      { def: { id: 'v', name: 'Verse', preset: 'pop' as any, lengthBars: 4 }, chords: [{ bar: 1, beat: 1, roman: 'I' }] as any },
    ];
    const result = applySubstitution(generated, 0, 0, 'move_left', 'C', 'seed');
    expect(result).toBe(generated);
  });

  it('moves chord right', () => {
    const generated: GeneratedSection[] = [
      { def: { id: 'v', name: 'Verse', preset: 'pop' as any, lengthBars: 4 }, chords: [{ bar: 1, beat: 1, roman: 'I' }, { bar: 2, beat: 1, roman: 'IV' }] as any },
    ];
    const result = applySubstitution(generated, 0, 0, 'move_right', 'C', 'seed');
    expect(result[0].chords[0].roman).toBe('IV');
    expect(result[0].chords[1].roman).toBe('I');
  });

  it('returns original when move_right at last index', () => {
    const generated: GeneratedSection[] = [
      { def: { id: 'v', name: 'Verse', preset: 'pop' as any, lengthBars: 4 }, chords: [{ bar: 1, beat: 1, roman: 'I' }] as any },
    ];
    const result = applySubstitution(generated, 0, 0, 'move_right', 'C', 'seed');
    expect(result).toBe(generated);
  });
});

describe('applyCriticFix', () => {
  it('returns sections after resubstitute', () => {
    const generated: GeneratedSection[] = [
      { def: { id: 'v', name: 'Verse', preset: 'pop' as any, lengthBars: 4 }, chords: [{ bar: 1, beat: 1, roman: 'I', pianoVoicing: { notes: [60], style: 'close' } }] as any },
    ];
    const result = applyCriticFix(generated, 0, 1, 'resubstitute', 'C', 'seed');
    expect(result).toHaveLength(1);
    expect(result).not.toBe(generated);
  });

  it('calls hydrateSectionChords', async () => {
    const { hydrateSectionChords } = await import('./engine');
    const generated: GeneratedSection[] = [
      { def: { id: 'v', name: 'Verse', preset: 'pop' as any, lengthBars: 4 }, chords: [{ bar: 1, beat: 1, roman: 'I', pianoVoicing: { notes: [60], style: 'close' } }] as any },
    ];
    applyCriticFix(generated, 0, 1, 'resubstitute', 'C', 'seed');
    expect(hydrateSectionChords).toHaveBeenCalled();
  });

  it('returns original when bar not found', () => {
    const generated: GeneratedSection[] = [
      { def: { id: 'v', name: 'Verse', preset: 'pop' as any, lengthBars: 4 }, chords: [{ bar: 1, beat: 1, roman: 'I' }] as any },
    ];
    const result = applyCriticFix(generated, 0, 99, 'resubstitute', 'C', 'seed');
    expect(result).toBe(generated);
  });

  it('returns original when section index invalid', () => {
    const generated: GeneratedSection[] = [
      { def: { id: 'v', name: 'Verse', preset: 'pop' as any, lengthBars: 4 }, chords: [{ bar: 1, beat: 1, roman: 'I' }] as any },
    ];
    const result = applyCriticFix(generated, 5, 1, 'resubstitute', 'C', 'seed');
    expect(result).toBe(generated);
  });

  it('handles revoice fix type', () => {
    const generated: GeneratedSection[] = [
      { def: { id: 'v', name: 'Verse', preset: 'pop' as any, lengthBars: 4 }, chords: [{ bar: 1, beat: 1, roman: 'I', pianoVoicing: { notes: [60], style: 'close' } }] as any },
    ];
    const result = applyCriticFix(generated, 0, 1, 'revoice', 'C', 'seed');
    expect(result).toHaveLength(1);
  });

  it('handles thin_voicing fix type', () => {
    const generated: GeneratedSection[] = [
      { def: { id: 'v', name: 'Verse', preset: 'pop' as any, lengthBars: 4 }, chords: [{ bar: 1, beat: 1, roman: 'I', pianoVoicing: { notes: [60], style: 'close' } }] as any },
    ];
    const result = applyCriticFix(generated, 0, 1, 'thin_voicing', 'C', 'seed');
    expect(result).toHaveLength(1);
  });

  it('handles reposition fix type', () => {
    const generated: GeneratedSection[] = [
      { def: { id: 'v', name: 'Verse', preset: 'pop' as any, lengthBars: 4 }, chords: [{ bar: 1, beat: 1, roman: 'I', guitarShape: {} }] as any },
    ];
    const result = applyCriticFix(generated, 0, 1, 'reposition', 'C', 'seed');
    expect(result).toHaveLength(1);
  });

  it('handles add_motion fix type', () => {
    const generated: GeneratedSection[] = [
      { def: { id: 'v', name: 'Verse', preset: 'pop' as any, lengthBars: 4 }, chords: [{ bar: 1, beat: 1, roman: 'I' }, { bar: 2, beat: 1, roman: 'I' }] as any },
    ];
    const result = applyCriticFix(generated, 0, 2, 'add_motion', 'C', 'seed');
    expect(result).toHaveLength(1);
  });
});
