import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { GeneratedSection } from '../lib/engine';
import { generateVoicingCandidates } from './voicing';
import { generateFingerableShapes } from './fretboard';

const mockSubstituteChord = vi.fn((_key: string, _roman: string, _mode: string, _prng: any) => ({
  roman: 'V7',
  chordName: 'G7',
}));

const mockHydrateSectionChords = vi.fn((chords: any[]) => chords);

const mockCritiqueArrangement = vi.fn((sections: any[]) => {
  const findings: any[] = [];
  sections.forEach((sec: any, idx: number) => {
    sec.chords.forEach((chord: any) => {
      findings.push({
        id: `finding-${idx}-${chord.bar}`,
        severity: 'warning',
        category: 'voice_leading',
        location: { sectionIdx: idx, bar: chord.bar },
        message: 'mock finding',
        suggestion: 'mock suggestion',
        fix: {
          type: 'resubstitute',
          targetBar: chord.bar,
        },
      });
    });
  });
  return { findings, score: 70, summary: 'mock critique' };
});

vi.mock('../lib/engine', () => ({
  substituteChord: (...args: any[]) => mockSubstituteChord(...args),
  hydrateSectionChords: (...args: any[]) => mockHydrateSectionChords(...args),
}));

vi.mock('./critic', () => ({
  critiqueArrangement: (...args: any[]) => mockCritiqueArrangement(...args),
}));

vi.mock('./pitch', () => ({
  KEYS: ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'],
  chordTonesForQuality: vi.fn(() => [0, 4, 7, 11]),
  midiToNoteName: vi.fn((midi: number) => `MIDI_${midi}`),
}));

vi.mock('./harmony', () => ({
  buildNodeSet: vi.fn(() => ({
    I: { rootOffset: 0, quality: 'maj' },
    V: { rootOffset: 7, quality: 'dom' },
    V7: { rootOffset: 7, quality: 'dom7' },
    ii: { rootOffset: 2, quality: 'min' },
  })),
}));

vi.mock('./voicing', () => ({
  generateVoicingCandidates: vi.fn(() => [
    { notes: [60, 64, 67], style: 'rootless' },
    { notes: [48, 55, 60, 64], style: 'drop2' },
  ]),
  generateBassNote: vi.fn(() => ({ midi: 48, noteName: 'C2' })),
}));

vi.mock('./fretboard', () => ({
  generateFingerableShapes: vi.fn(() => [
    { notes: [{ midi: 48 }], minFret: 3, maxFret: 5 },
    { notes: [{ midi: 55 }], minFret: 8, maxFret: 10 },
  ]),
}));

vi.mock('../lib/prng', () => ({
  createPRNG: vi.fn(() => {
    let state = 42;
    return () => {
      state = (state * 1103515245 + 12345) & 0x7fffffff;
      return state / 0x7fffffff;
    };
  }),
}));

import { optimizeArrangement } from './fixer';

function makeSection(id: string, name: string, chords: any[]): GeneratedSection {
  return {
    def: { id, name, preset: 'jazz' as any, lengthBars: 8 },
    chords: chords.map((c) => ({
      bar: c.bar,
      beat: c.beat ?? 1,
      roman: c.roman,
      chordName: c.chordName,
    })),
  };
}

beforeEach(() => {
  mockSubstituteChord.mockClear();
  mockHydrateSectionChords.mockClear();
  mockCritiqueArrangement.mockClear();
  mockCritiqueArrangement.mockImplementation((sections: any[]) => {
    const findings: any[] = [];
    sections.forEach((sec: any, idx: number) => {
      sec.chords.forEach((chord: any) => {
        findings.push({
          id: `finding-${idx}-${chord.bar}`,
          severity: 'warning',
          category: 'voice_leading',
          location: { sectionIdx: idx, bar: chord.bar },
          message: 'mock finding',
          suggestion: 'mock suggestion',
          fix: {
            type: 'resubstitute',
            targetBar: chord.bar,
          },
        });
      });
    });
    return { findings, score: 70, summary: 'mock critique' };
  });
});

describe('fixer', () => {
  describe('optimizeArrangement', () => {
    it('with empty sections returns valid result', () => {
      const result = optimizeArrangement([], 'C');
      expect(result).toHaveProperty('sections');
      expect(result).toHaveProperty('scoreBefore');
      expect(result).toHaveProperty('scoreAfter');
      expect(result).toHaveProperty('steps');
      expect(Array.isArray(result.sections)).toBe(true);
      expect(Array.isArray(result.steps)).toBe(true);
    });

    it('returns scoreBefore and scoreAfter as numbers', () => {
      const sections = [
        makeSection('s1', 'Verse', [{ bar: 1, roman: 'I', chordName: 'C' }]),
      ];
      const result = optimizeArrangement(sections, 'C');
      expect(typeof result.scoreBefore).toBe('number');
      expect(typeof result.scoreAfter).toBe('number');
    });

    it('returns steps array', () => {
      const sections = [
        makeSection('s1', 'Verse', [{ bar: 1, roman: 'I', chordName: 'C' }]),
      ];
      const result = optimizeArrangement(sections, 'C');
      expect(Array.isArray(result.steps)).toBe(true);
    });

    it('scoreAfter >= scoreBefore (never degrades)', () => {
      const sections = [
        makeSection('s1', 'Verse', [
          { bar: 1, roman: 'I', chordName: 'C' },
          { bar: 2, roman: 'V', chordName: 'G' },
        ]),
      ];
      const result = optimizeArrangement(sections, 'C');
      expect(result.scoreAfter).toBeGreaterThanOrEqual(result.scoreBefore);
    });

    it('terminates within max passes', () => {
      const sections = [
        makeSection('s1', 'Verse', [
          { bar: 1, roman: 'I', chordName: 'C' },
          { bar: 2, roman: 'V', chordName: 'G' },
          { bar: 3, roman: 'I', chordName: 'C' },
          { bar: 4, roman: 'V', chordName: 'G' },
        ]),
      ];
      const result = optimizeArrangement(sections, 'C');
      expect(result.steps.length).toBeLessThanOrEqual(8);
    });

    it('with no actionable findings returns immediately', () => {
      mockCritiqueArrangement.mockReturnValue({
        findings: [],
        score: 95,
        summary: 'clean',
      });

      const sections = [
        makeSection('s1', 'Verse', [{ bar: 1, roman: 'I', chordName: 'C' }]),
      ];
      const result = optimizeArrangement(sections, 'C');
      expect(result.scoreBefore).toBe(95);
      expect(result.scoreAfter).toBe(95);
      expect(result.steps).toHaveLength(0);
    });

    it('result contains sections array', () => {
      const sections = [
        makeSection('s1', 'Verse', [{ bar: 1, roman: 'I', chordName: 'C' }]),
      ];
      const result = optimizeArrangement(sections, 'C');
      expect(Array.isArray(result.sections)).toBe(true);
      expect(result.sections.length).toBeGreaterThan(0);
    });

    it('result sections are modified copies (not original reference)', () => {
      const sections = [
        makeSection('s1', 'Verse', [{ bar: 1, roman: 'I', chordName: 'C' }]),
      ];
      const result = optimizeArrangement(sections, 'C');
      expect(result.sections).not.toBe(sections);
      expect(result.sections[0]).not.toBe(sections[0]);
    });

    it('calls substituteChord and hydrateSectionChords when processing findings', () => {
      const sections = [
        makeSection('s1', 'Verse', [
          { bar: 1, roman: 'I', chordName: 'C' },
          { bar: 2, roman: 'V', chordName: 'G' },
        ]),
      ];
      optimizeArrangement(sections, 'C');
      expect(mockSubstituteChord).toHaveBeenCalled();
      expect(mockHydrateSectionChords).toHaveBeenCalled();
    });

    it('records optimization steps when score improves', () => {
      let callCount = 0;
      mockCritiqueArrangement.mockImplementation(() => {
        callCount++;
        if (callCount <= 2) {
          return {
            findings: [
              {
                id: 'f1',
                severity: 'warning',
                category: 'voice_leading',
                location: { sectionIdx: 0, bar: 1 },
                message: 'test',
                suggestion: 'test',
                fix: { type: 'resubstitute', targetBar: 1 },
              },
            ],
            score: 70,
            summary: 'needs work',
          };
        }
        return { findings: [], score: 85, summary: 'better' };
      });

      const sections = [
        makeSection('s1', 'Verse', [
          { bar: 1, roman: 'I', chordName: 'C' },
          { bar: 2, roman: 'V', chordName: 'G' },
        ]),
      ];
      const result = optimizeArrangement(sections, 'C');
      expect(result.steps.length).toBeGreaterThan(0);
      expect(result.steps[0]).toHaveProperty('pass');
      expect(result.steps[0]).toHaveProperty('bar');
      expect(result.steps[0]).toHaveProperty('sectionName');
      expect(result.steps[0]).toHaveProperty('category');
      expect(result.steps[0]).toHaveProperty('description');
      expect(result.steps[0]).toHaveProperty('scoreDelta');
    });

    it('deep-clones input sections without mutating originals', () => {
      const originalChord = { bar: 1, roman: 'I', chordName: 'C', beat: 1 };
      const sections = [makeSection('s1', 'Verse', [originalChord])];
      const originalClone = JSON.parse(JSON.stringify(sections));

      optimizeArrangement(sections, 'C');

      expect(sections[0].chords[0]).toEqual(originalClone[0].chords[0]);
    });

    it('handles revoice fix type for piano voicing', () => {
      let callCount = 0;
      mockCritiqueArrangement.mockImplementation((sections: any[]) => {
        callCount++;
        if (callCount === 1) {
          return {
            findings: [],
            score: 50,
            summary: 'initial',
          };
        }
        if (callCount === 2) {
          const chord = sections[0].chords[0];
          return {
            findings: [
              {
                id: 'f-revoice',
                severity: 'warning',
                category: 'voicing',
                location: { sectionIdx: 0, bar: chord.bar },
                message: 'bad voicing',
                suggestion: 'try another',
                fix: { type: 'revoice', targetBar: chord.bar },
              },
            ],
            score: 50,
            summary: 'needs revoice',
          };
        }
        return { findings: [], score: 80, summary: 'done' };
      });

      const sections = [
        {
          def: { id: 's1', name: 'Verse', preset: 'jazz' as any, lengthBars: 4 },
          chords: [
            {
              bar: 1,
              beat: 1,
              roman: 'I',
              chordName: 'C',
              pianoVoicing: { style: 'rootless', notes: [60, 64, 67] },
            },
          ],
        },
      ];
      const result = optimizeArrangement(sections, 'C');
      expect(result.steps.length).toBeGreaterThan(0);
      expect(result.steps[0].description).toContain('piano voicing');
    });

    it('handles thin_voicing fix type for piano voicing', () => {
      let callCount = 0;
      mockCritiqueArrangement.mockImplementation((sections: any[]) => {
        callCount++;
        if (callCount === 1) {
          return {
            findings: [],
            score: 50,
            summary: 'initial',
          };
        }
        if (callCount === 2) {
          const chord = sections[0].chords[0];
          return {
            findings: [
              {
                id: 'f-thin',
                severity: 'suggestion',
                category: 'voicing',
                location: { sectionIdx: 0, bar: chord.bar },
                message: 'too many notes',
                suggestion: 'thin it',
                fix: { type: 'thin_voicing', targetBar: chord.bar },
              },
            ],
            score: 50,
            summary: 'needs thinning',
          };
        }
        return { findings: [], score: 75, summary: 'done' };
      });

      const sections = [
        {
          def: { id: 's1', name: 'Verse', preset: 'jazz' as any, lengthBars: 4 },
          chords: [
            {
              bar: 1,
              beat: 1,
              roman: 'I',
              chordName: 'C',
              pianoVoicing: { style: 'close', notes: [60, 64, 67, 72] },
            },
          ],
        },
      ];
      const result = optimizeArrangement(sections, 'C');
      expect(result.steps.length).toBeGreaterThan(0);
      expect(result.steps[0].description).toContain('rootless');
    });

    it('handles reposition fix type for guitar shape', () => {
      let callCount = 0;
      mockCritiqueArrangement.mockImplementation((sections: any[]) => {
        callCount++;
        if (callCount === 1) {
          return {
            findings: [],
            score: 50,
            summary: 'initial',
          };
        }
        if (callCount === 2) {
          const chord = sections[0].chords[0];
          return {
            findings: [
              {
                id: 'f-repos',
                severity: 'info',
                category: 'fretboard',
                location: { sectionIdx: 0, bar: chord.bar },
                message: 'bad position',
                suggestion: 'move up',
                fix: { type: 'reposition', targetBar: chord.bar },
              },
            ],
            score: 50,
            summary: 'needs reposition',
          };
        }
        return { findings: [], score: 70, summary: 'done' };
      });

      const sections = [
        {
          def: { id: 's1', name: 'Verse', preset: 'jazz' as any, lengthBars: 4 },
          chords: [
            {
              bar: 1,
              beat: 1,
              roman: 'I',
              chordName: 'C',
              guitarShape: {
                notes: [{ midi: 48 }],
                minFret: 3,
                maxFret: 5,
              },
            },
          ],
        },
      ];
      const result = optimizeArrangement(sections, 'C');
      expect(result.steps.length).toBeGreaterThan(0);
      expect(result.steps[0].description).toContain('Repositioned');
    });

    it('handles add_motion fix type with chordIndex > 0', () => {
      let callCount = 0;
      mockCritiqueArrangement.mockImplementation((sections: any[]) => {
        callCount++;
        if (callCount === 1) {
          return {
            findings: [],
            score: 50,
            summary: 'initial',
          };
        }
        if (callCount === 2) {
          const chord = sections[0].chords[1];
          return {
            findings: [
              {
                id: 'f-motion',
                severity: 'problem',
                category: 'voice_leading',
                location: { sectionIdx: 0, bar: chord.bar },
                message: 'needs motion',
                suggestion: 'add secondary dominant',
                fix: { type: 'add_motion', targetBar: chord.bar },
              },
            ],
            score: 50,
            summary: 'needs motion',
          };
        }
        return { findings: [], score: 70, summary: 'done' };
      });

      const sections = [
        {
          def: { id: 's1', name: 'Verse', preset: 'jazz' as any, lengthBars: 4 },
          chords: [
            { bar: 1, beat: 1, roman: 'I', chordName: 'C' },
            { bar: 2, beat: 1, roman: 'ii', chordName: 'Dm' },
          ],
        },
      ];
      const result = optimizeArrangement(sections, 'C');
      expect(result.steps.length).toBeGreaterThan(0);
      expect(result.steps[0].description).toContain('secondary dominant');
    });

    it('rejects fix when score does not improve', () => {
      mockCritiqueArrangement.mockImplementation(() => ({
        findings: [
          {
            id: 'f-stuck',
            severity: 'warning',
            category: 'voice_leading',
            location: { sectionIdx: 0, bar: 1 },
            message: 'issue',
            suggestion: 'fix',
            fix: { type: 'resubstitute', targetBar: 1 },
          },
        ],
        score: 70,
        summary: 'same score',
      }));

      const sections = [
        makeSection('s1', 'Verse', [
          { bar: 1, roman: 'I', chordName: 'C' },
        ]),
      ];
      const result = optimizeArrangement(sections, 'C');
      expect(result.steps).toHaveLength(0);
      expect(result.scoreBefore).toBe(70);
      expect(result.scoreAfter).toBe(70);
    });

    it('stops after multiple passes when no more findings', () => {
      let callCount = 0;
      mockCritiqueArrangement.mockImplementation(() => {
        callCount++;
        if (callCount === 1) {
          return {
            findings: [],
            score: 50,
            summary: 'initial',
          };
        }
        if (callCount === 2) {
          return {
            findings: [
              {
                id: 'f1',
                severity: 'warning',
                category: 'voice_leading',
                location: { sectionIdx: 0, bar: 1 },
                message: 'issue',
                suggestion: 'fix',
                fix: { type: 'resubstitute', targetBar: 1 },
              },
            ],
            score: 50,
            summary: 'pass 1',
          };
        }
        if (callCount === 3) {
          return {
            findings: [],
            score: 65,
            summary: 'eval pass 1',
          };
        }
        if (callCount === 4) {
          return {
            findings: [
              {
                id: 'f2',
                severity: 'warning',
                category: 'harmony',
                location: { sectionIdx: 0, bar: 2 },
                message: 'issue2',
                suggestion: 'fix2',
                fix: { type: 'resubstitute', targetBar: 2 },
              },
            ],
            score: 65,
            summary: 'pass 2',
          };
        }
        if (callCount === 5) {
          return {
            findings: [],
            score: 80,
            summary: 'eval pass 2',
          };
        }
        return { findings: [], score: 80, summary: 'done' };
      });

      const sections = [
        makeSection('s1', 'Verse', [
          { bar: 1, roman: 'I', chordName: 'C' },
          { bar: 2, roman: 'V', chordName: 'G' },
        ]),
      ];
      const result = optimizeArrangement(sections, 'C');
      expect(result.steps.length).toBe(2);
      expect(result.scoreAfter).toBe(80);
    });

    it('sorts findings by severity before processing', () => {
      let callCount = 0;

      mockCritiqueArrangement.mockImplementation((sections: any[]) => {
        callCount++;
        if (callCount === 1) {
          return {
            findings: [],
            score: 50,
            summary: 'initial',
          };
        }
        if (callCount === 2) {
          return {
            findings: [
              {
                id: 'f-info',
                severity: 'info',
                category: 'general',
                location: { sectionIdx: 0, bar: 1 },
                message: 'info issue',
                suggestion: 'info fix',
                fix: { type: 'resubstitute', targetBar: 1 },
              },
              {
                id: 'f-problem',
                severity: 'problem',
                category: 'critical',
                location: { sectionIdx: 0, bar: 1 },
                message: 'big problem',
                suggestion: 'big fix',
                fix: { type: 'resubstitute', targetBar: 1 },
              },
              {
                id: 'f-suggestion',
                severity: 'suggestion',
                category: 'style',
                location: { sectionIdx: 0, bar: 1 },
                message: 'style issue',
                suggestion: 'style fix',
                fix: { type: 'resubstitute', targetBar: 1 },
              },
            ],
            score: 50,
            summary: 'mixed severity',
          };
        }
        if (callCount === 3) {
          return {
            findings: [],
            score: 70,
            summary: 'after fix',
          };
        }
        return { findings: [], score: 85, summary: 'done' };
      });

      const sections = [
        makeSection('s1', 'Verse', [
          { bar: 1, roman: 'I', chordName: 'C' },
        ]),
      ];
      const result = optimizeArrangement(sections, 'C');
      expect(result.steps.length).toBeGreaterThan(0);
      expect(result.steps[0].category).toBe('critical');
    });

    it('filters out findings without fix property', () => {
      mockCritiqueArrangement.mockReturnValue({
        findings: [
          {
            id: 'f-nofix',
            severity: 'warning',
            category: 'voice_leading',
            location: { sectionIdx: 0, bar: 1 },
            message: 'no fix available',
            suggestion: 'nothing to do',
          },
        ],
        score: 90,
        summary: 'findings with no fix',
      });

      const sections = [
        makeSection('s1', 'Verse', [
          { bar: 1, roman: 'I', chordName: 'C' },
        ]),
      ];
      const result = optimizeArrangement(sections, 'C');
      expect(result.steps).toHaveLength(0);
      expect(result.scoreAfter).toBe(90);
    });

    it('skips finding when chord not found at bar index', () => {
      let callCount = 0;
      mockCritiqueArrangement.mockImplementation(() => {
        callCount++;
        if (callCount === 1) {
          return {
            findings: [],
            score: 50,
            summary: 'initial',
          };
        }
        if (callCount === 2) {
          return {
            findings: [
              {
                id: 'f-nobar',
                severity: 'warning',
                category: 'voice_leading',
                location: { sectionIdx: 0, bar: 999 },
                message: 'nonexistent bar',
                suggestion: 'fix',
                fix: { type: 'resubstitute', targetBar: 999 },
              },
              {
                id: 'f-good',
                severity: 'warning',
                category: 'voice_leading',
                location: { sectionIdx: 0, bar: 1 },
                message: 'real issue',
                suggestion: 'real fix',
                fix: { type: 'resubstitute', targetBar: 1 },
              },
            ],
            score: 50,
            summary: 'mixed',
          };
        }
        if (callCount === 3) {
          return {
            findings: [],
            score: 75,
            summary: 'after fix',
          };
        }
        return { findings: [], score: 80, summary: 'done' };
      });

      const sections = [
        makeSection('s1', 'Verse', [
          { bar: 1, roman: 'I', chordName: 'C' },
        ]),
      ];
      const result = optimizeArrangement(sections, 'C');
      expect(result.steps.length).toBeGreaterThan(0);
      expect(mockSubstituteChord).toHaveBeenCalled();
    });

    it('uses fallback description when fix handler produces empty string', () => {
      let callCount = 0;
      mockCritiqueArrangement.mockImplementation((sections: any[]) => {
        callCount++;
        if (callCount <= 2) {
          const chord = sections[0].chords[0];
          return {
            findings: [
              {
                id: 'f-revoice-noswitch',
                severity: 'warning',
                category: 'voicing',
                location: { sectionIdx: 0, bar: chord.bar },
                message: 'revoice',
                suggestion: 'revoice',
                fix: { type: 'revoice', targetBar: chord.bar },
              },
            ],
            score: 65,
            summary: 'revoice fallback',
          };
        }
        return { findings: [], score: 80, summary: 'done' };
      });

      const sections = [
        {
          def: { id: 's1', name: 'Verse', preset: 'jazz' as any, lengthBars: 4 },
          chords: [
            {
              bar: 1,
              beat: 1,
              roman: 'I',
              chordName: 'C',
              pianoVoicing: { style: 'rootless', notes: [60, 64, 67] },
            },
          ],
        },
      ];
      const result = optimizeArrangement(sections, 'C');
      expect(result.steps.length).toBeGreaterThan(0);
      expect(result.steps[0]).toHaveProperty('description');
    });

    it('revoice skips when chord has no pianoVoicing and uses fallback description', () => {
      let callCount = 0;
      mockCritiqueArrangement.mockImplementation(() => {
        callCount++;
        if (callCount === 1) {
          return { findings: [], score: 50, summary: 'initial' };
        }
        if (callCount === 2) {
          return {
            findings: [
              {
                id: 'f-revoice-novoice',
                severity: 'warning',
                category: 'voicing',
                location: { sectionIdx: 0, bar: 1 },
                message: 'revoice',
                suggestion: 'revoice',
                fix: { type: 'revoice', targetBar: 1 },
              },
            ],
            score: 50,
            summary: 'needs revoice',
          };
        }
        return { findings: [], score: 65, summary: 'done' };
      });

      const sections = [
        makeSection('s1', 'Verse', [{ bar: 1, roman: 'I', chordName: 'C' }]),
      ];
      const result = optimizeArrangement(sections, 'C');
      expect(result.steps.length).toBeGreaterThan(0);
      expect(result.steps[0].description).toContain('Optimized');
    });

    it('reposition skips when chord has no guitarShape and uses fallback description', () => {
      let callCount = 0;
      mockCritiqueArrangement.mockImplementation(() => {
        callCount++;
        if (callCount === 1) {
          return { findings: [], score: 50, summary: 'initial' };
        }
        if (callCount === 2) {
          return {
            findings: [
              {
                id: 'f-repos-noshape',
                severity: 'info',
                category: 'fretboard',
                location: { sectionIdx: 0, bar: 1 },
                message: 'reposition',
                suggestion: 'reposition',
                fix: { type: 'reposition', targetBar: 1 },
              },
            ],
            score: 50,
            summary: 'needs reposition',
          };
        }
        return { findings: [], score: 65, summary: 'done' };
      });

      const sections = [
        makeSection('s1', 'Verse', [{ bar: 1, roman: 'I', chordName: 'C' }]),
      ];
      const result = optimizeArrangement(sections, 'C');
      expect(result.steps.length).toBeGreaterThan(0);
      expect(result.steps[0].description).toContain('Optimized');
    });

    it('reposition skips when generateFingerableShapes returns only one candidate', () => {
      let callCount = 0;
      mockCritiqueArrangement.mockImplementation((sections: any[]) => {
        callCount++;
        if (callCount === 1) {
          return { findings: [], score: 50, summary: 'initial' };
        }
        if (callCount === 2) {
          const chord = sections[0].chords[0];
          return {
            findings: [
              {
                id: 'f-repos-one',
                severity: 'info',
                category: 'fretboard',
                location: { sectionIdx: 0, bar: chord.bar },
                message: 'reposition',
                suggestion: 'reposition',
                fix: { type: 'reposition', targetBar: chord.bar },
              },
            ],
            score: 50,
            summary: 'needs reposition',
          };
        }
        return { findings: [], score: 65, summary: 'done' };
      });

      const origMock = generateFingerableShapes as any;
      const savedImplementation = origMock.getMockImplementation();
      origMock.mockReturnValueOnce([{ notes: [{ midi: 48 }], minFret: 3, maxFret: 5 }]);

      const sections = [
        {
          def: { id: 's1', name: 'Verse', preset: 'jazz' as any, lengthBars: 4 },
          chords: [
            {
              bar: 1,
              beat: 1,
              roman: 'I',
              chordName: 'C',
              guitarShape: {
                notes: [{ midi: 48 }],
                minFret: 3,
                maxFret: 5,
              },
            },
          ],
        },
      ];
      const result = optimizeArrangement(sections, 'C');
      origMock.mockReturnValue(savedImplementation);
      expect(result.steps.length).toBeGreaterThan(0);
      expect(result.steps[0].description).toContain('Optimized');
    });

    it('add_motion skips when chordIndex is 0 and uses fallback description', () => {
      let callCount = 0;
      mockCritiqueArrangement.mockImplementation(() => {
        callCount++;
        if (callCount === 1) {
          return { findings: [], score: 50, summary: 'initial' };
        }
        if (callCount === 2) {
          return {
            findings: [
              {
                id: 'f-motion-first',
                severity: 'problem',
                category: 'voice_leading',
                location: { sectionIdx: 0, bar: 1 },
                message: 'needs motion',
                suggestion: 'add secondary dominant',
                fix: { type: 'add_motion', targetBar: 1 },
              },
            ],
            score: 50,
            summary: 'needs motion',
          };
        }
        return { findings: [], score: 65, summary: 'done' };
      });

      const sections = [
        makeSection('s1', 'Verse', [
          { bar: 1, roman: 'I', chordName: 'C' },
        ]),
      ];
      const result = optimizeArrangement(sections, 'C');
      expect(result.steps.length).toBeGreaterThan(0);
      expect(result.steps[0].description).toContain('Optimized');
    });

    it('thin_voicing falls back to candidates[0] when no rootless candidate found', () => {
      let callCount = 0;
      mockCritiqueArrangement.mockImplementation((sections: any[]) => {
        callCount++;
        if (callCount === 1) {
          return { findings: [], score: 50, summary: 'initial' };
        }
        if (callCount === 2) {
          const chord = sections[0].chords[0];
          return {
            findings: [
              {
                id: 'f-thin-norootless',
                severity: 'suggestion',
                category: 'voicing',
                location: { sectionIdx: 0, bar: chord.bar },
                message: 'thin',
                suggestion: 'thin',
                fix: { type: 'thin_voicing', targetBar: chord.bar },
              },
            ],
            score: 50,
            summary: 'needs thinning',
          };
        }
        return { findings: [], score: 65, summary: 'done' };
      });

      const origGenerateVoicing = generateVoicingCandidates as any;
      const savedImpl = origGenerateVoicing.getMockImplementation();
      origGenerateVoicing.mockReturnValueOnce([{ notes: [60, 64], style: 'open' }]);

      const sections = [
        {
          def: { id: 's1', name: 'Verse', preset: 'jazz' as any, lengthBars: 4 },
          chords: [
            {
              bar: 1,
              beat: 1,
              roman: 'I',
              chordName: 'C',
              pianoVoicing: { style: 'close', notes: [60, 64, 67, 72] },
            },
          ],
        },
      ];
      const result = optimizeArrangement(sections, 'C');
      origGenerateVoicing.mockReturnValue(savedImpl);
      expect(result.steps.length).toBeGreaterThan(0);
      expect(result.steps[0].description).toContain('rootless');
    });
  });
});
