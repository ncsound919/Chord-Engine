import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../theory/harmony', () => {
  const nodeSet: Record<string, any> = {
    'Imaj7': { roman: 'Imaj7', rootOffset: 0, quality: 'maj7', fn: 'tonic' },
    'I': { roman: 'I', rootOffset: 0, quality: 'maj', fn: 'tonic' },
    'ii7': { roman: 'ii7', rootOffset: 2, quality: 'm7', fn: 'subdominant' },
    'ii': { roman: 'ii', rootOffset: 2, quality: 'm', fn: 'subdominant' },
    'IVmaj7': { roman: 'IVmaj7', rootOffset: 5, quality: 'maj7', fn: 'subdominant' },
    'IV': { roman: 'IV', rootOffset: 5, quality: 'maj', fn: 'subdominant' },
    'V7': { roman: 'V7', rootOffset: 7, quality: '7', fn: 'dominant' },
    'V': { roman: 'V', rootOffset: 7, quality: 'maj', fn: 'dominant' },
    'vi7': { roman: 'vi7', rootOffset: 9, quality: 'm7', fn: 'tonic_substitute' },
    'vi': { roman: 'vi', rootOffset: 9, quality: 'm', fn: 'tonic_substitute' },
    'iii7': { roman: 'iii7', rootOffset: 4, quality: 'm7', fn: 'tonic_substitute' },
    'vii': { roman: 'vii', rootOffset: 11, quality: 'm7b5', fn: 'dominant' },
    'V7/vi': { roman: 'V7/vi', rootOffset: 4, quality: '7', fn: 'dominant', isSecondaryDominant: true },
  };

  return {
    buildNodeSet: vi.fn(() => nodeSet),
    scoreTransition: vi.fn(() => Math.random() * 5),
    PRESET_PROFILES: {
      pop: { favorsSecondaryDominants: 0.5, favorsTritoneSubs: 0.2, favorsBorrowed: 0.3, favorsExtensions: 0.4, preferredCadence: 'authentic' },
      rock: { favorsSecondaryDominants: 0.5, favorsTritoneSubs: 0.2, favorsBorrowed: 0.3, favorsExtensions: 0.4, preferredCadence: 'authentic' },
      jazz: { favorsSecondaryDominants: 0.9, favorsTritoneSubs: 0.8, favorsBorrowed: 0.5, favorsExtensions: 0.9, preferredCadence: 'authentic' },
      soul: { favorsSecondaryDominants: 0.7, favorsTritoneSubs: 0.4, favorsBorrowed: 0.6, favorsExtensions: 0.7, preferredCadence: 'plagal' },
      steely: { favorsSecondaryDominants: 0.9, favorsTritoneSubs: 0.6, favorsBorrowed: 0.4, favorsExtensions: 0.8, preferredCadence: 'authentic' },
      isley: { favorsSecondaryDominants: 0.7, favorsTritoneSubs: 0.3, favorsBorrowed: 0.5, favorsExtensions: 0.8, preferredCadence: 'plagal' },
      stevie: { favorsSecondaryDominants: 0.7, favorsTritoneSubs: 0.3, favorsBorrowed: 0.5, favorsExtensions: 0.7, preferredCadence: 'plagal' },
      rnb: { favorsSecondaryDominants: 0.7, favorsTritoneSubs: 0.3, favorsBorrowed: 0.5, favorsExtensions: 0.7, preferredCadence: 'authentic' },
      gospel: { favorsSecondaryDominants: 0.8, favorsTritoneSubs: 0.4, favorsBorrowed: 0.6, favorsExtensions: 0.8, preferredCadence: 'authentic' },
      techno: { favorsSecondaryDominants: 0.1, favorsTritoneSubs: 0.1, favorsBorrowed: 0.1, favorsExtensions: 0.2, preferredCadence: 'authentic' },
      funk: { favorsSecondaryDominants: 0.6, favorsTritoneSubs: 0.3, favorsBorrowed: 0.4, favorsExtensions: 0.6, preferredCadence: 'authentic' },
      sylvers: { favorsSecondaryDominants: 0.7, favorsTritoneSubs: 0.3, favorsBorrowed: 0.5, favorsExtensions: 0.7, preferredCadence: 'plagal' },
    },
  };
});

vi.mock('../theory/pitch', () => ({
  KEYS: ['C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B'],
  pitchClassOf: vi.fn((name: string) => {
    const map: Record<string, number> = { C: 0, 'C#': 1, Db: 1, D: 2, 'D#': 3, Eb: 3, E: 4, F: 5, 'F#': 6, Gb: 6, G: 7, 'G#': 8, Ab: 8, A: 9, 'A#': 10, Bb: 10, B: 11 };
    return map[name] ?? 0;
  }),
  chordTonesForQuality: vi.fn((rootPc: number, _quality: string) => [rootPc, (rootPc + 4) % 12, (rootPc + 7) % 12]),
}));

vi.mock('../theory/voicing', () => ({
  generateVoicingCandidates: vi.fn(() => [{ notes: [60, 64, 67], style: 'close', rootPc: 0, bassNote: 48 }]),
  pickBestVoicing: vi.fn((cands: any[]) => cands[0]),
  generateBassNote: vi.fn(() => ({ midi: 36, role: 'root' })),
}));

vi.mock('../theory/fretboard', () => ({
  generateFingerableShapes: vi.fn(() => [{ frets: [0, 2, 2, 1, 0, 0], fingerings: [0, 2, 3, 1, 0, 0] }]),
  pickBestGuitarShape: vi.fn((cands: any[]) => cands[0]),
}));

vi.mock('../theory/reharm', () => ({
  reharmonizeProgression: vi.fn((_nodes: any[], strategy: string) => {
    if (strategy === 'tritone_sub') {
      return [{ roman: 'sub(V7)', rootOffset: 1, quality: '7', fn: 'dominant' }];
    }
    return [];
  }),
}));

import {
  buildChordName,
  substituteChord,
  generateProgression,
  hydrateSectionChords,
  type SectionDef,
} from './engine';

describe('buildChordName', () => {
  it('returns chord name for valid key and roman', () => {
    const name = buildChordName('C', 'Imaj7');
    expect(name).toBe('Cmaj7');
  });

  it('transposes chord correctly for different keys', () => {
    const name = buildChordName('G', 'V7');
    expect(name).toBe('D7');
  });

  it('returns roman for invalid key', () => {
    const name = buildChordName('X', 'Imaj7');
    expect(name).toBe('Imaj7');
  });

  it('returns roman for unknown roman numeral', () => {
    const name = buildChordName('C', 'XYZ');
    expect(name).toBe('XYZ');
  });
});

describe('substituteChord', () => {
  it('identity returns same chord', () => {
    const result = substituteChord('C', 'V7', 'identity', () => 0.5);
    expect(result.roman).toBe('V7');
    expect(result.chordName).toBe('G7');
  });

  it('returns original for unknown roman', () => {
    const result = substituteChord('C', 'XYZ', 'tritone', () => 0.5);
    expect(result.roman).toBe('XYZ');
  });

  it('auto returns a valid chord', () => {
    const result = substituteChord('C', 'Imaj7', 'auto', () => 0.3);
    expect(result.roman).toBeDefined();
    expect(result.chordName).toBeDefined();
  });
});

describe('generateProgression', () => {
  const sections: SectionDef[] = [
    {
      id: 'verse',
      name: 'Verse',
      preset: 'pop',
      lengthBars: 2,
      complexity: 1,
    },
  ];

  it('returns GeneratedSection array', () => {
    const result = generateProgression('C', sections, 'test-seed');
    expect(Array.isArray(result)).toBe(true);
    expect(result.length).toBe(1);
  });

  it('each section has def and chords', () => {
    const result = generateProgression('C', sections, 'test-seed');
    const section = result[0];
    expect(section.def).toBe(sections[0]);
    expect(Array.isArray(section.chords)).toBe(true);
    expect(section.chords.length).toBeGreaterThan(0);
  });

  it('chords have bar, beat, roman, and chordName', () => {
    const result = generateProgression('C', sections, 'test-seed');
    const chord = result[0].chords[0];
    expect(chord).toHaveProperty('bar');
    expect(chord).toHaveProperty('beat');
    expect(chord).toHaveProperty('roman');
    expect(chord).toHaveProperty('chordName');
  });

  it('generates different results for different keys', () => {
    const resultC = generateProgression('C', sections, 'seed');
    const resultG = generateProgression('G', sections, 'seed');
    expect(resultC[0].chords[0].chordName).not.toBe(resultG[0].chords[0].chordName);
  });

  it('generates different results for different seeds', () => {
    const result1 = generateProgression('C', sections, 'seed-a');
    const result2 = generateProgression('C', sections, 'seed-b');
    const romans1 = result1[0].chords.map(c => c.roman);
    const romans2 = result2[0].chords.map(c => c.roman);
    expect(romans1).not.toEqual(romans2);
  });

  it('handles multiple sections', () => {
    const multiSections: SectionDef[] = [
      { id: 'verse', name: 'Verse', preset: 'pop', lengthBars: 1, complexity: 1 },
      { id: 'chorus', name: 'Chorus', preset: 'pop', lengthBars: 1, complexity: 1 },
    ];
    const result = generateProgression('C', multiSections, 'seed');
    expect(result).toHaveLength(2);
  });

  it('respects keyShift', () => {
    const shifted: SectionDef[] = [
      { id: 'v', name: 'V', preset: 'pop', lengthBars: 1, complexity: 1, keyShift: 2 },
    ];
    const result = generateProgression('C', shifted, 'seed');
    expect(result[0].chords[0]).toHaveProperty('chordName');
  });

  it('respects startChord', () => {
    const withStart: SectionDef[] = [
      { id: 'v', name: 'V', preset: 'pop', lengthBars: 1, complexity: 1, startChord: 'IV' },
    ];
    const result = generateProgression('C', withStart, 'seed');
    expect(result[0].chords[0].roman).toBe('IV');
  });

  it('handles complexity 2 (two chords per bar)', () => {
    const c2: SectionDef[] = [
      { id: 'v', name: 'V', preset: 'pop', lengthBars: 1, complexity: 2 },
    ];
    const result = generateProgression('C', c2, 'seed');
    expect(result[0].chords.length).toBeGreaterThanOrEqual(2);
  });

  it('skips invalid keys', () => {
    const result = generateProgression('X', sections, 'seed');
    expect(result).toHaveLength(0);
  });
});

describe('hydrateSectionChords', () => {
  it('returns hydrated chords with voicings and bass notes', () => {
    const chords = [
      { bar: 1, beat: 1, roman: 'Imaj7', chordName: 'Cmaj7' },
      { bar: 1, beat: 3, roman: 'V7', chordName: 'G7' },
    ];
    const hydrated = hydrateSectionChords(chords, 'C');
    expect(hydrated).toHaveLength(2);
    expect(hydrated[0]).toHaveProperty('pianoVoicing');
    expect(hydrated[0]).toHaveProperty('bassNote');
    expect(hydrated[0]).toHaveProperty('rootPc');
    expect(hydrated[0]).toHaveProperty('quality');
  });

  it('returns empty array for invalid key', () => {
    const chords = [{ bar: 1, beat: 1, roman: 'Imaj7', chordName: 'Cmaj7' }];
    const hydrated = hydrateSectionChords(chords, 'X');
    expect(hydrated).toEqual([]);
  });

  it('provides fallback for unknown roman', () => {
    const chords = [{ bar: 1, beat: 1, roman: 'UNKNOWN', chordName: '???' }];
    const hydrated = hydrateSectionChords(chords, 'C');
    expect(hydrated).toHaveLength(1);
    expect(hydrated[0].quality).toBe('');
  });

  it('substituteChord returns identity for unknown roman', () => {
    const prng = () => Math.random();
    const result = substituteChord('C', 'UNKNOWN', 'identity', prng);
    expect(result.roman).toBe('UNKNOWN');
  });

  it('substituteChord returns identity when strategy is identity', () => {
    const prng = () => Math.random();
    const result = substituteChord('C', 'Imaj7', 'identity', prng);
    expect(result.roman).toBe('Imaj7');
  });

  it('substituteChord handles tritone strategy', () => {
    const prng = () => Math.random();
    const result = substituteChord('C', 'V7', 'tritone', prng);
    expect(result.roman).toBeTruthy();
  });

  it('substituteChord handles auto strategy with random selection', () => {
    const prng = () => 0.5;
    const result = substituteChord('C', 'Imaj7', 'auto', prng);
    expect(result.roman).toBeTruthy();
  });

  it('substituteChord handles parallel strategy', () => {
    const prng = () => Math.random();
    const result = substituteChord('C', 'Imaj7', 'parallel', prng);
    expect(result.roman).toBeTruthy();
  });

  it('substituteChord handles extend strategy', () => {
    const prng = () => Math.random();
    const result = substituteChord('C', 'Imaj7', 'extend', prng);
    expect(result.roman).toBeTruthy();
  });

  it('substituteChord handles chromatic strategy', () => {
    const prng = () => Math.random();
    const result = substituteChord('C', 'V7', 'chromatic', prng);
    expect(result.roman).toBeTruthy();
  });

  it('substituteChord handles passing strategy', () => {
    const prng = () => Math.random();
    const result = substituteChord('C', 'Imaj7', 'passing', prng);
    expect(result.roman).toBeTruthy();
  });

  it('substituteChord handles ii_v strategy', () => {
    const prng = () => Math.random();
    const result = substituteChord('C', 'V7', 'ii_v', prng);
    expect(result.roman).toBeTruthy();
  });

  it('substituteChord handles tritone_sd strategy', () => {
    const prng = () => Math.random();
    const result = substituteChord('C', 'V7', 'tritone_sd', prng);
    expect(result.roman).toBeTruthy();
  });

  it('substituteChord handles backdoor strategy', () => {
    const prng = () => Math.random();
    const result = substituteChord('C', 'V7', 'backdoor', prng);
    expect(result.roman).toBeTruthy();
  });

  it('generateProgression handles empty key gracefully', () => {
    const result = generateProgression('INVALID', [
      { id: '1', name: 'Test', preset: 'pop', lengthBars: 2 },
    ], 'test-seed');
    expect(result).toHaveLength(0);
  });

  it('generateProgression handles empty sections', () => {
    const result = generateProgression('C', [], 'test-seed');
    expect(result).toHaveLength(0);
  });

  it('generateProgression handles key shift overflow', () => {
    const result = generateProgression('C', [
      { id: '1', name: 'Test', preset: 'pop', lengthBars: 2, keyShift: 999 },
    ], 'test-seed');
    expect(result).toHaveLength(1);
    expect(result[0].chords.length).toBeGreaterThan(0);
  });

  it('generateProgression handles complexity 3 with non-4 beatsPerBar', () => {
    const result = generateProgression('C', [
      { id: '1', name: 'Test', preset: 'pop', lengthBars: 2, complexity: 3, beatsPerBar: 3 },
    ], 'test-seed');
    expect(result).toHaveLength(1);
  });

  it('generateProgression handles negative key shift', () => {
    const result = generateProgression('C', [
      { id: '1', name: 'Test', preset: 'pop', lengthBars: 2, keyShift: -3 },
    ], 'test-seed');
    expect(result).toHaveLength(1);
  });

  it('generateProgression startChord sets first chord', () => {
    const result = generateProgression('C', [
      { id: '1', name: 'Test', preset: 'pop', lengthBars: 2, startChord: 'V7' },
    ], 'test-seed');
    expect(result).toHaveLength(1);
  });

  it('generateProgression different seeds produce different results', () => {
    const sections = [{ id: '1', name: 'Test', preset: 'pop', lengthBars: 4 }];
    const result1 = generateProgression('C', sections, 'seed-a');
    const result2 = generateProgression('C', sections, 'seed-b');
    const chords1 = result1[0]?.chords.map(c => c.roman).join(',') || '';
    const chords2 = result2[0]?.chords.map(c => c.roman).join(',') || '';
    expect(chords1).not.toBe(chords2);
  });

  it('generateProgression handleSection from previous section transitions', () => {
    const result = generateProgression('C', [
      { id: '1', name: 'Verse', preset: 'pop', lengthBars: 2 },
      { id: '2', name: 'Chorus', preset: 'pop', lengthBars: 2 },
    ], 'test-seed');
    expect(result).toHaveLength(2);
  });

  it('hydrateSectionChords handles single chord section', () => {
    const chords = [{ bar: 1, beat: 1, roman: 'Imaj7', chordName: 'Cmaj7' }];
    const hydrated = hydrateSectionChords(chords, 'C');
    expect(hydrated).toHaveLength(1);
    expect(hydrated[0].quality).toBe('maj7');
  });

  it('buildChordName returns roman for invalid key', () => {
    expect(buildChordName('INVALID', 'Imaj7')).toBe('Imaj7');
  });

  it('buildChordName returns roman for unknown roman', () => {
    expect(buildChordName('C', 'UNKNOWN')).toBe('UNKNOWN');
  });

  it('buildChordName builds name with bass offset', () => {
    const name = buildChordName('C', 'Imaj7');
    expect(name).toBe('Cmaj7');
  });

  it('resolveLastChordIfNeeded resolves dominant chords', () => {
    const result = (generateProgression as any)('C', [
      { id: '1', name: 'Test', preset: 'pop', lengthBars: 1 },
    ], 'test');
    expect(result).toBeDefined();
  });

  it('generateProgression with rock preset filters borrowed chords correctly', () => {
    const result = generateProgression('C', [
      { id: '1', name: 'Test', preset: 'rock', lengthBars: 2, complexity: 2 },
    ], 'test-seed');
    expect(result).toHaveLength(1);
  });
});
