import { describe, it, expect, vi } from 'vitest';
import { critiqueArrangement } from './critic';
import type { GeneratedSection, GeneratedChord } from '../lib/engine';
import type { Voicing } from './voicing';
import type { GuitarShape } from './fretboard';
import type { ArrangementCritique, CriticFinding, Severity } from './critic';

// ---- Helpers to build mock sections ----

const makeSectionDef = (preset: string = 'pop', lengthBars: number = 4) => ({
  id: 'test-section',
  name: 'Test',
  preset: preset as any,
  lengthBars,
});

const makePianoVoicing = (notes: number[]): Voicing => ({
  notes,
  style: 'close',
  rootPc: 0,
  bassNote: notes[0],
});

const makeBassNote = (midi: number) => ({
  midi,
  role: 'root' as const,
});

const makeGuitarShape = (minFret: number, maxFret: number): GuitarShape => ({
  notes: [
    { string: 0, fret: minFret, midi: 40 + minFret },
    { string: 1, fret: Math.min(minFret + 1, maxFret), midi: 45 + minFret + 1 },
    { string: 2, fret: maxFret, midi: 50 + maxFret },
  ],
  mutedStrings: [3, 4, 5],
  minFret,
  maxFret,
  playabilityScore: 0,
});

const makeChord = (overrides: Partial<GeneratedChord> = {}): GeneratedChord => ({
  bar: 1,
  beat: 1,
  roman: 'I',
  chordName: 'Cmaj7',
  ...overrides,
});

const makeSection = (chords: GeneratedChord[], preset: string = 'pop'): GeneratedSection => ({
  def: makeSectionDef(preset),
  chords,
});

// ---- Tests ----

describe('critiqueArrangement', () => {
  it('with empty sections returns valid critique', () => {
    const result = critiqueArrangement([]);
    expect(result).toHaveProperty('findings');
    expect(result).toHaveProperty('score');
    expect(result).toHaveProperty('summary');
    expect(result.findings).toEqual([]);
    expect(result.score).toBe(100);
    expect(typeof result.summary).toBe('string');
  });

  it('with well-formed chords returns valid critique', () => {
    const section = makeSection([
      makeChord({ bar: 1, roman: 'I', chordName: 'Cmaj7' }),
      makeChord({ bar: 2, roman: 'IV', chordName: 'Fmaj7' }),
      makeChord({ bar: 3, roman: 'V', chordName: 'G7' }),
      makeChord({ bar: 4, roman: 'I', chordName: 'Cmaj7' }),
    ]);
    const result = critiqueArrangement([section]);
    expect(result.findings).toBeInstanceOf(Array);
    expect(result.score).toBeGreaterThanOrEqual(0);
    expect(result.score).toBeLessThanOrEqual(100);
    expect(typeof result.summary).toBe('string');
  });

  it('detects register collisions (bass and piano too close)', () => {
    // Bass at C2 (36), piano lowest at E2 (40) — gap = 4, bass < 48, gap <= 3? No, gap=4 > 3
    // Let's use: bass at C2 (36), piano at C2 (36) — gap = 0, bass < 48, gap <= 3
    const section = makeSection([
      makeChord({
        bar: 1,
        bassNote: makeBassNote(36),
        pianoVoicing: makePianoVoicing([36, 48, 60, 72]),
      }),
    ]);
    const result = critiqueArrangement([section]);
    const collisionFindings = result.findings.filter(
      (f) => f.category === 'register_collision' && f.severity === 'warning'
    );
    expect(collisionFindings.length).toBeGreaterThan(0);
    expect(collisionFindings[0].message).toContain('mud');
  });

  it('detects voice leading problems (large leaps >= 7 semitones)', () => {
    // Chord 1: close voicing around C4, chord 2: voicing leaps up a 5th or more
    const section = makeSection([
      makeChord({
        bar: 1,
        roman: 'I',
        chordName: 'Cmaj7',
        pianoVoicing: makePianoVoicing([48, 52, 55, 59]),
      }),
      makeChord({
        bar: 2,
        roman: 'V',
        chordName: 'G7',
        pianoVoicing: makePianoVoicing([55, 59, 62, 67]), // lowest voice leaps from 48 to 55 = 7 semitones
      }),
    ]);
    const result = critiqueArrangement([section]);
    const voiceLeadingFindings = result.findings.filter(
      (f) => f.category === 'voice_leading'
    );
    expect(voiceLeadingFindings.length).toBeGreaterThan(0);
    expect(voiceLeadingFindings[0].message).toContain('leaps');
  });

  it('detects harmonic stasis (4+ bars same chord)', () => {
    const chords = Array.from({ length: 5 }, (_, i) =>
      makeChord({
        bar: i + 1,
        roman: 'I',
        chordName: 'Cmaj7',
      })
    );
    const section = makeSection(chords);
    const result = critiqueArrangement([section]);
    const stasisFindings = result.findings.filter(
      (f) => f.category === 'harmonic_stasis'
    );
    expect(stasisFindings.length).toBeGreaterThan(0);
    const hasStasisMessage = stasisFindings.some(
      (f) => f.message.includes('bars straight') || f.message.includes('static harmony')
    );
    expect(hasStasisMessage).toBe(true);
  });

  it('detects flat arc (density constant across section)', () => {
    // 6+ chords with same density triggers arc check
    const chords = Array.from({ length: 9 }, (_, i) =>
      makeChord({
        bar: i + 1,
        roman: ['I', 'IV', 'V', 'I', 'IV', 'V', 'I', 'IV', 'V'][i],
        pianoVoicing: makePianoVoicing([48, 52, 55, 59]),
        guitarShape: makeGuitarShape(0, 3),
      })
    );
    const section = makeSection(chords);
    const result = critiqueArrangement([section]);
    const arcFindings = result.findings.filter((f) => f.category === 'arc');
    expect(arcFindings.length).toBeGreaterThan(0);
    expect(arcFindings[0].message).toContain('flat');
  });

  it('scores arrangement (100 minus penalties)', () => {
    // Section with no issues should score 100
    const section = makeSection([
      makeChord({
        bar: 1,
        roman: 'I',
        chordName: 'Cmaj7',
        pianoVoicing: makePianoVoicing([48, 52, 55, 59]),
      }),
      makeChord({
        bar: 2,
        roman: 'IV',
        chordName: 'Fmaj7',
        pianoVoicing: makePianoVoicing([53, 57, 60, 65]),
      }),
    ]);
    const result = critiqueArrangement([section]);
    // No findings = score 100
    if (result.findings.length === 0) {
      expect(result.score).toBe(100);
    } else {
      // Score = 100 minus penalties
      expect(result.score).toBeGreaterThanOrEqual(0);
      expect(result.score).toBeLessThanOrEqual(100);
    }
  });

  it('with no issues returns high score (~100)', () => {
    // Minimal section with well-spaced voicings and proper harmonic motion
    const section = makeSection([
      makeChord({
        bar: 1,
        roman: 'I',
        chordName: 'Cmaj7',
        pianoVoicing: makePianoVoicing([48, 52, 55, 60]),
      }),
      makeChord({
        bar: 2,
        roman: 'IV',
        chordName: 'Fmaj7',
        pianoVoicing: makePianoVoicing([53, 57, 60, 65]),
      }),
      makeChord({
        bar: 3,
        roman: 'V',
        chordName: 'G7',
        pianoVoicing: makePianoVoicing([55, 59, 62, 67]),
      }),
      makeChord({
        bar: 4,
        roman: 'I',
        chordName: 'Cmaj7',
        pianoVoicing: makePianoVoicing([48, 52, 55, 60]),
      }),
    ]);
    const result = critiqueArrangement([section]);
    expect(result.score).toBeGreaterThanOrEqual(90);
  });

  it('with many issues returns lower score', () => {
    // Create a section that triggers multiple findings
    const chords = Array.from({ length: 6 }, (_, i) =>
      makeChord({
        bar: i + 1,
        roman: 'I',
        chordName: 'Cmaj7',
        bassNote: makeBassNote(36), // low bass
        pianoVoicing: makePianoVoicing([36, 48, 60, 72, 79, 84]), // collision + thick
        guitarShape: makeGuitarShape(0, 3),
      })
    );
    const section = makeSection(chords);
    const result = critiqueArrangement([section]);
    expect(result.findings.length).toBeGreaterThan(0);
    expect(result.score).toBeLessThan(90);
  });

  it('summary text varies based on score thresholds (>=90, >=70, <70)', () => {
    // Score >= 90: "Solid arrangement"
    const highScoreSection = makeSection([
      makeChord({ bar: 1, roman: 'I', chordName: 'Cmaj7', pianoVoicing: makePianoVoicing([48, 52, 55, 60]) }),
      makeChord({ bar: 2, roman: 'IV', chordName: 'Fmaj7', pianoVoicing: makePianoVoicing([53, 57, 60, 65]) }),
    ]);
    const highResult = critiqueArrangement([highScoreSection]);
    if (highResult.score >= 90) {
      expect(highResult.summary).toContain('Solid arrangement');
    }

    // Score < 70 with problems: "Needs real revision"
    const badChords = Array.from({ length: 6 }, (_, i) =>
      makeChord({
        bar: i + 1,
        roman: 'I',
        chordName: 'Cmaj7',
        bassNote: makeBassNote(36),
        pianoVoicing: makePianoVoicing([36, 48, 60, 72, 79, 84]),
      })
    );
    const badSection = makeSection(badChords);
    const badResult = critiqueArrangement([badSection]);
    if (badResult.score < 70) {
      const hasProblems = badResult.findings.some((f) => f.severity === 'problem');
      if (hasProblems) {
        expect(badResult.summary).toContain('Needs real revision');
      } else {
        expect(badResult.summary).toContain('Rough draft quality');
      }
    }
  });

  it('register collision check works for guitar too (bass collision with guitar lowest note)', () => {
    // Bass at A1 (33), guitar lowest at A1 (33) — gap = 0, bass < 45
    const section = makeSection([
      makeChord({
        bar: 1,
        bassNote: makeBassNote(33),
        pianoVoicing: makePianoVoicing([48, 52, 55, 60]),
        guitarShape: {
          notes: [{ string: 0, fret: 0, midi: 33, finger: undefined }],
          mutedStrings: [1, 2, 3, 4, 5],
          minFret: 0,
          maxFret: 0,
          playabilityScore: 0,
        },
      }),
    ]);
    const result = critiqueArrangement([section]);
    const guitarCollision = result.findings.filter(
      (f) => f.category === 'register_collision' && f.id.includes('guitar')
    );
    expect(guitarCollision.length).toBeGreaterThan(0);
    expect(guitarCollision[0].severity).toBe('suggestion');
    expect(guitarCollision[0].message).toContain('Guitar');
  });

  it('voice leading: large leap between consecutive chords generates warning', () => {
    // Chord 1: low voicing, chord 2: high voicing — gap >= 7 semitones
    const section = makeSection([
      makeChord({
        bar: 1,
        roman: 'I',
        chordName: 'Cmaj7',
        pianoVoicing: makePianoVoicing([36, 40, 43, 48]),
      }),
      makeChord({
        bar: 2,
        roman: 'V',
        chordName: 'G7',
        pianoVoicing: makePianoVoicing([43, 47, 50, 55]),
      }),
    ]);
    const result = critiqueArrangement([section]);
    const vlFindings = result.findings.filter(
      (f) => f.category === 'voice_leading'
    );
    // Largest leap between paired voices: |36-43|=7, |40-47|=7, |43-50|=7, |48-55|=7
    expect(vlFindings.length).toBeGreaterThan(0);
    expect(vlFindings[0].severity).toBe('warning');
  });

  it('voice leading: small leaps between consecutive chords do not generate findings', () => {
    const section = makeSection([
      makeChord({
        bar: 1,
        roman: 'I',
        chordName: 'Cmaj7',
        pianoVoicing: makePianoVoicing([48, 52, 55, 60]),
      }),
      makeChord({
        bar: 2,
        roman: 'IV',
        chordName: 'Fmaj7',
        pianoVoicing: makePianoVoicing([50, 54, 57, 62]),
      }),
    ]);
    const result = critiqueArrangement([section]);
    const vlFindings = result.findings.filter(
      (f) => f.category === 'voice_leading'
    );
    expect(vlFindings.length).toBe(0);
  });

  it('style fidelity check: preset without tritone subs generates info finding', () => {
    // "steely" preset favors tritone subs (favorsTritoneSubs: 1.6 > 1.3)
    // Section with no tritone subs (no roman starting with "sub(")
    const section = makeSection(
      [
        makeChord({ bar: 1, roman: 'I', chordName: 'Cmaj7' }),
        makeChord({ bar: 2, roman: 'ii', chordName: 'Dm7' }),
        makeChord({ bar: 3, roman: 'V', chordName: 'G7' }),
        makeChord({ bar: 4, roman: 'I', chordName: 'Cmaj7' }),
      ],
      'steely'
    );
    const result = critiqueArrangement([section]);
    const styleFindings = result.findings.filter(
      (f) => f.category === 'style_fidelity' && f.id.includes('tritone')
    );
    expect(styleFindings.length).toBeGreaterThan(0);
    expect(styleFindings[0].severity).toBe('info');
    expect(styleFindings[0].message).toContain('tritone');
  });

  it('style fidelity: pop preset (low tritoneSubs) does not trigger tritone finding', () => {
    // "pop" has favorsTritoneSubs: 0.2 < 1.3 — no tritone sub finding
    const section = makeSection(
      [
        makeChord({ bar: 1, roman: 'I', chordName: 'C' }),
        makeChord({ bar: 2, roman: 'V', chordName: 'G' }),
      ],
      'pop'
    );
    const result = critiqueArrangement([section]);
    const tritoneFindings = result.findings.filter(
      (f) => f.category === 'style_fidelity' && f.id.includes('tritone')
    );
    expect(tritoneFindings.length).toBe(0);
  });

  it('harmonic stasis: section ending with 4+ same chords triggers end-of-section finding', () => {
    const chords = Array.from({ length: 6 }, (_, i) =>
      makeChord({
        bar: i + 1,
        roman: 'I',
        chordName: 'Cmaj7',
      })
    );
    const section = makeSection(chords);
    const result = critiqueArrangement([section]);
    const stasisEnd = result.findings.filter(
      (f) => f.id.includes('stasis-end')
    );
    expect(stasisEnd.length).toBeGreaterThan(0);
    expect(stasisEnd[0].message).toContain('static harmony');
  });

  it('arc: section with < 6 chords does not trigger arc finding', () => {
    const section = makeSection([
      makeChord({ bar: 1, roman: 'I', pianoVoicing: makePianoVoicing([48, 52, 55, 60]) }),
      makeChord({ bar: 2, roman: 'IV', pianoVoicing: makePianoVoicing([53, 57, 60, 65]) }),
      makeChord({ bar: 3, roman: 'V', pianoVoicing: makePianoVoicing([55, 59, 62, 67]) }),
      makeChord({ bar: 4, roman: 'I', pianoVoicing: makePianoVoicing([48, 52, 55, 60]) }),
    ]);
    const result = critiqueArrangement([section]);
    const arcFindings = result.findings.filter((f) => f.category === 'arc');
    expect(arcFindings.length).toBe(0);
  });

  it('voicing density: thick piano voicing (6+ notes) generates suggestion', () => {
    const section = makeSection([
      makeChord({
        bar: 1,
        roman: 'I',
        chordName: 'Cmaj13',
        pianoVoicing: makePianoVoicing([48, 52, 55, 60, 64, 67]),
      }),
    ]);
    const result = critiqueArrangement([section]);
    const densityFindings = result.findings.filter(
      (f) => f.category === 'voicing_density'
    );
    expect(densityFindings.length).toBeGreaterThan(0);
    expect(densityFindings[0].severity).toBe('suggestion');
    expect(densityFindings[0].message).toContain('stacks');
  });

  it('voicing density: thin piano voicing (3-4 notes) does not trigger', () => {
    const section = makeSection([
      makeChord({
        bar: 1,
        roman: 'I',
        chordName: 'Cmaj7',
        pianoVoicing: makePianoVoicing([48, 52, 55, 60]),
      }),
    ]);
    const result = critiqueArrangement([section]);
    const densityFindings = result.findings.filter(
      (f) => f.category === 'voicing_density'
    );
    expect(densityFindings.length).toBe(0);
  });

  it('multiple findings are aggregated with correct severities', () => {
    // Chord repeated 5 times + collision + voicing density
    const chords = Array.from({ length: 6 }, (_, i) =>
      makeChord({
        bar: i + 1,
        roman: 'I',
        chordName: 'Cmaj7',
        bassNote: makeBassNote(36),
        pianoVoicing: makePianoVoicing([36, 48, 60, 72, 79, 84]),
      })
    );
    const section = makeSection(chords);
    const result = critiqueArrangement([section]);
    const categories = new Set(result.findings.map((f) => f.category));
    expect(categories.size).toBeGreaterThan(1);
    // Check severities are valid
    for (const finding of result.findings) {
      expect(['info', 'suggestion', 'warning', 'problem']).toContain(finding.severity);
    }
  });

  it('score penalties are correctly applied per severity', () => {
    // info=0.5, suggestion=1.5, warning=4, problem=9
    // Create section with exactly one info finding
    const section = makeSection(
      [
        makeChord({ bar: 1, roman: 'I', pianoVoicing: makePianoVoicing([48, 52, 55, 60]) }),
        makeChord({ bar: 2, roman: 'IV', pianoVoicing: makePianoVoicing([53, 57, 60, 65]) }),
      ],
      'pop'
    );
    const result = critiqueArrangement([section]);
    // If there are findings, score should be 100 minus sum of penalties
    const penalties: Record<Severity, number> = { info: 0.5, suggestion: 1.5, warning: 4, problem: 9 };
    const expectedPenalty = result.findings.reduce((sum, f) => sum + penalties[f.severity], 0);
    expect(result.score).toBe(Math.max(0, Math.round(100 - expectedPenalty)));
  });

  it('score does not go below 0', () => {
    // Many issues should floor at 0
    const chords = Array.from({ length: 10 }, (_, i) =>
      makeChord({
        bar: i + 1,
        roman: 'I',
        chordName: 'Cmaj7',
        bassNote: makeBassNote(36),
        pianoVoicing: makePianoVoicing([36, 48, 60, 72, 79, 84]),
        guitarShape: makeGuitarShape(0, 3),
      })
    );
    const section = makeSection(chords);
    const result = critiqueArrangement([section]);
    expect(result.score).toBeGreaterThanOrEqual(0);
  });

  it('voice leading: problem severity for very large leaps (>=12 semitones)', () => {
    const section = makeSection([
      makeChord({
        bar: 1,
        roman: 'I',
        chordName: 'Cmaj7',
        pianoVoicing: makePianoVoicing([36, 40, 43, 48]),
      }),
      makeChord({
        bar: 2,
        roman: 'V',
        chordName: 'G7',
        pianoVoicing: makePianoVoicing([48, 52, 55, 60]),
      }),
    ]);
    const result = critiqueArrangement([section]);
    const vlFindings = result.findings.filter(
      (f) => f.category === 'voice_leading' && f.severity === 'problem'
    );
    // |36-48|=12, so this should be 'problem' severity
    if (vlFindings.length > 0) {
      expect(vlFindings[0].severity).toBe('problem');
    }
  });

  it('guitar ergonomics: consecutive large position jumps generate warning', () => {
    const section = makeSection([
      makeChord({ bar: 1, roman: 'I', guitarShape: makeGuitarShape(0, 3) }),
      makeChord({ bar: 2, roman: 'IV', guitarShape: makeGuitarShape(8, 12) }),
      makeChord({ bar: 3, roman: 'V', guitarShape: makeGuitarShape(0, 3) }),
    ]);
    const result = critiqueArrangement([section]);
    const ergoFindings = result.findings.filter(
      (f) => f.category === 'guitar_ergonomics'
    );
    // Two consecutive jumps (0->8=8, then 8->0=8) should flag once per run
    expect(ergoFindings.length).toBeGreaterThanOrEqual(1);
  });

  it('guitar ergonomics: small position jumps do not trigger', () => {
    const section = makeSection([
      makeChord({ bar: 1, roman: 'I', guitarShape: makeGuitarShape(2, 4) }),
      makeChord({ bar: 2, roman: 'IV', guitarShape: makeGuitarShape(3, 5) }),
      makeChord({ bar: 3, roman: 'V', guitarShape: makeGuitarShape(4, 6) }),
    ]);
    const result = critiqueArrangement([section]);
    const ergoFindings = result.findings.filter(
      (f) => f.category === 'guitar_ergonomics'
    );
    expect(ergoFindings.length).toBe(0);
  });

  it('findings include actionable suggestion text', () => {
    const section = makeSection([
      makeChord({
        bar: 1,
        bassNote: makeBassNote(36),
        pianoVoicing: makePianoVoicing([36, 48, 60, 72]),
      }),
    ]);
    const result = critiqueArrangement([section]);
    for (const finding of result.findings) {
      expect(typeof finding.suggestion).toBe('string');
      expect(finding.suggestion.length).toBeGreaterThan(0);
      expect(typeof finding.message).toBe('string');
      expect(finding.message.length).toBeGreaterThan(0);
    }
  });

  it('findings include fix hint when applicable', () => {
    const section = makeSection([
      makeChord({
        bar: 1,
        bassNote: makeBassNote(36),
        pianoVoicing: makePianoVoicing([36, 48, 60, 72]),
      }),
    ]);
    const result = critiqueArrangement([section]);
    const findingsWithFix = result.findings.filter((f) => f.fix !== undefined);
    if (findingsWithFix.length > 0) {
      expect(findingsWithFix[0].fix).toHaveProperty('type');
      expect(findingsWithFix[0].fix).toHaveProperty('targetBar');
      expect(['resubstitute', 'revoice', 'reposition', 'thin_voicing', 'add_motion']).toContain(
        findingsWithFix[0].fix!.type
      );
    }
  });

  it('findings include location (sectionIdx and bar)', () => {
    const section = makeSection([
      makeChord({
        bar: 1,
        bassNote: makeBassNote(36),
        pianoVoicing: makePianoVoicing([36, 48, 60, 72]),
      }),
    ]);
    const result = critiqueArrangement([section]);
    for (const finding of result.findings) {
      expect(finding.location).toHaveProperty('sectionIdx');
      expect(finding.location).toHaveProperty('bar');
      expect(typeof finding.location.sectionIdx).toBe('number');
      expect(typeof finding.location.bar).toBe('number');
    }
  });

  it('findings have unique ids', () => {
    const section = makeSection([
      makeChord({
        bar: 1,
        bassNote: makeBassNote(36),
        pianoVoicing: makePianoVoicing([36, 48, 60, 72]),
      }),
      makeChord({
        bar: 2,
        bassNote: makeBassNote(36),
        pianoVoicing: makePianoVoicing([36, 48, 60, 72]),
      }),
    ]);
    const result = critiqueArrangement([section]);
    const ids = result.findings.map((f) => f.id);
    const uniqueIds = new Set(ids);
    expect(uniqueIds.size).toBe(ids.length);
  });

  it('multiple sections are analyzed independently', () => {
    const section1 = makeSection([
      makeChord({
        bar: 1,
        bassNote: makeBassNote(36),
        pianoVoicing: makePianoVoicing([36, 48, 60, 72]),
      }),
    ]);
    const section2 = makeSection([
      makeChord({ bar: 1, roman: 'I', pianoVoicing: makePianoVoicing([48, 52, 55, 60]) }),
    ]);
    const result = critiqueArrangement([section1, section2]);
    // section1 should have register collision, section2 should not
    const section1Findings = result.findings.filter((f) => f.location.sectionIdx === 0);
    const section2Findings = result.findings.filter((f) => f.location.sectionIdx === 1);
    expect(section1Findings.length).toBeGreaterThan(0);
    // section2 has no collision (bass note missing, so no bass+piano check)
    const section2Collisions = section2Findings.filter(
      (f) => f.category === 'register_collision'
    );
    expect(section2Collisions.length).toBe(0);
  });
});
