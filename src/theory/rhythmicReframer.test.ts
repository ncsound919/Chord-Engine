import { describe, it, expect } from 'vitest';
import {
  generateDrumPattern,
  TIME_FEEL_PRESETS,
  reframeSong,
  DrumStyle,
  ReframeTarget,
} from './rhythmicReframer';

describe('rhythmicReframer', () => {
  describe('TIME_FEEL_PRESETS', () => {
    it('has all 9 styles', () => {
      const keys = Object.keys(TIME_FEEL_PRESETS);
      expect(keys).toHaveLength(9);
      expect(keys).toContain('boom_bap');
      expect(keys).toContain('techno');
      expect(keys).toContain('house');
      expect(keys).toContain('trap');
      expect(keys).toContain('funk');
      expect(keys).toContain('jazz');
      expect(keys).toContain('afrobeat');
      expect(keys).toContain('detroit_techno');
      expect(keys).toContain('uk_garage');
    });

    it('each TimeFeel has valid swingAmount (0-100)', () => {
      for (const [name, feel] of Object.entries(TIME_FEEL_PRESETS)) {
        expect(feel.swingAmount, `${name}.swingAmount`).toBeGreaterThanOrEqual(0);
        expect(feel.swingAmount, `${name}.swingAmount`).toBeLessThanOrEqual(100);
      }
    });

    it('each TimeFeel has valid ghostNoteDensity (0-100)', () => {
      for (const [name, feel] of Object.entries(TIME_FEEL_PRESETS)) {
        expect(feel.ghostNoteDensity, `${name}.ghostNoteDensity`).toBeGreaterThanOrEqual(0);
        expect(feel.ghostNoteDensity, `${name}.ghostNoteDensity`).toBeLessThanOrEqual(100);
      }
    });

    it('each TimeFeel has a valid kickPlacementStyle', () => {
      const validStyles = [
        'four_on_floor',
        'syncopated_offbeat',
        'sparse_boom_bap',
        'trap_skitter',
        'jazz_swing',
      ];
      for (const [name, feel] of Object.entries(TIME_FEEL_PRESETS)) {
        expect(validStyles, `${name}.kickPlacementStyle`).toContain(feel.kickPlacementStyle);
      }
    });
  });

  describe('generateDrumPattern', () => {
    it('should generate a 4-on-the-floor pattern for techno', () => {
      const pattern = generateDrumPattern('techno', 50, 2, 'test-seed');

      expect(pattern.steps).toBe(32);
      expect(pattern.grid['Kick'][0]).toBe(true);
      expect(pattern.grid['Kick'][4]).toBe(true);
      expect(pattern.grid['Kick'][8]).toBe(true);
      expect(pattern.grid['Kick'][12]).toBe(true);
      expect(pattern.swing).toBe(TIME_FEEL_PRESETS.techno.swingAmount);
    });

    it('should generate a trap pattern with rapid hats', () => {
      const pattern = generateDrumPattern('trap', 80, 3, 'trap-seed');

      expect(pattern.grid['Kick'][0]).toBe(true);
      expect(pattern.grid['Snare'][8]).toBe(true);

      const hatCount = pattern.grid['HH Closed'].filter(Boolean).length;
      expect(hatCount).toBeGreaterThan(10);
    });

    it('is deterministic with the same seed', () => {
      const p1 = generateDrumPattern('boom_bap', 50, 2, 'same-seed');
      const p2 = generateDrumPattern('boom_bap', 50, 2, 'same-seed');

      expect(p1).toEqual(p2);
    });

    it('varies seed-sensitive output across seeds', () => {
      const p1 = generateDrumPattern('trap', 72, 3, 'seed-a');
      const p2 = generateDrumPattern('trap', 72, 3, 'seed-b');

      const hasDifferentMicrotiming =
        JSON.stringify(p1.microTimingMs) !== JSON.stringify(p2.microTimingMs);
      const hasDifferentVelocities =
        JSON.stringify(p1.velocities) !== JSON.stringify(p2.velocities);
      const hasDifferentClosedHats =
        JSON.stringify(p1.grid['HH Closed']) !==
        JSON.stringify(p2.grid['HH Closed']);

      expect(
        hasDifferentMicrotiming ||
          hasDifferentVelocities ||
          hasDifferentClosedHats,
      ).toBe(true);
    });

    it('should respect complexity for microtiming variance', () => {
      const simple = generateDrumPattern('funk', 50, 1, 'seed');
      const complex = generateDrumPattern('funk', 50, 4, 'seed');

      const simpleVariance = Math.max(...simple.microTimingMs.map(Math.abs));
      const complexVariance = Math.max(...complex.microTimingMs.map(Math.abs));

      expect(complexVariance).toBeGreaterThan(simpleVariance);
    });

    it('returns 32 steps for all styles', () => {
      const styles: DrumStyle[] = [
        'boom_bap',
        'techno',
        'house',
        'trap',
        'funk',
        'jazz',
        'afrobeat',
        'detroit_techno',
        'uk_garage',
      ];
      for (const style of styles) {
        const pattern = generateDrumPattern(style, 50, 2, 'step-test');
        expect(pattern.steps, `${style} steps`).toBe(32);
      }
    });

    it('returns grid with all drum voices', () => {
      const expectedVoices = [
        'Crash',
        'Ride',
        'HH Open',
        'HH Closed',
        'Tom High',
        'Tom Mid',
        'Tom Floor',
        'Snare',
        'Kick',
      ];
      const pattern = generateDrumPattern('boom_bap', 50, 2, 'voices-test');
      for (const voice of expectedVoices) {
        expect(pattern.grid, `${voice} present`).toHaveProperty(voice);
        expect(pattern.grid[voice], `${voice} is array`).toHaveLength(32);
      }
    });

    it('returns swing, ghostNotes, microTimingMs, velocities arrays', () => {
      const pattern = generateDrumPattern('boom_bap', 50, 2, 'output-test');
      expect(typeof pattern.swing).toBe('number');
      expect(typeof pattern.ghostNotes).toBe('number');
      expect(pattern.microTimingMs).toHaveLength(32);
      expect(pattern.velocities).toHaveLength(32);
    });

    it('boom_bap has kick on steps 0, 10, 16, 22', () => {
      const pattern = generateDrumPattern('boom_bap', 50, 2, 'boom-test');
      expect(pattern.grid['Kick'][0]).toBe(true);
      expect(pattern.grid['Kick'][10]).toBe(true);
      expect(pattern.grid['Kick'][16]).toBe(true);
      expect(pattern.grid['Kick'][22]).toBe(true);
    });

    it('techno has 4-on-the-floor kick pattern', () => {
      const pattern = generateDrumPattern('techno', 50, 2, 'techno-kick');
      for (let i = 0; i < 32; i += 4) {
        expect(pattern.grid['Kick'][i], `Kick at step ${i}`).toBe(true);
      }
    });

    it('house has 4-on-the-floor kick pattern', () => {
      const pattern = generateDrumPattern('house', 50, 2, 'house-kick');
      for (let i = 0; i < 32; i += 4) {
        expect(pattern.grid['Kick'][i], `Kick at step ${i}`).toBe(true);
      }
    });

    it('trap has kick pattern and rapid hats', () => {
      const pattern = generateDrumPattern('trap', 50, 2, 'trap-kick');
      expect(pattern.grid['Kick'][0]).toBe(true);
      expect(pattern.grid['Kick'][14]).toBe(true);
      expect(pattern.grid['Kick'][16]).toBe(true);
      expect(pattern.grid['Kick'][28]).toBe(true);
      const hatCount = pattern.grid['HH Closed'].filter(Boolean).length;
      expect(hatCount).toBeGreaterThan(0);
    });

    it('funk has syncopated kick pattern', () => {
      const pattern = generateDrumPattern('funk', 50, 2, 'funk-kick');
      expect(pattern.grid['Kick'][0]).toBe(true);
      expect(pattern.grid['Kick'][10]).toBe(true);
      expect(pattern.grid['Kick'][16]).toBe(true);
      expect(pattern.grid['Kick'][26]).toBe(true);
    });

    it('jazz has ride swing pattern', () => {
      const pattern = generateDrumPattern('jazz', 50, 2, 'jazz-ride');
      for (let i = 0; i < 32; i += 4) {
        expect(pattern.grid['Ride'][i], `Ride at step ${i}`).toBe(true);
        if (i + 3 < 32) {
          expect(pattern.grid['Ride'][i + 3], `Ride at step ${i + 3}`).toBe(true);
        }
      }
    });

    it('afrobeat has syncopated kick/snare', () => {
      const pattern = generateDrumPattern('afrobeat', 50, 2, 'afro-kick');
      expect(pattern.grid['Kick'][0]).toBe(true);
      expect(pattern.grid['Kick'][6]).toBe(true);
      expect(pattern.grid['Kick'][12]).toBe(true);
      expect(pattern.grid['Kick'][16]).toBe(true);
      expect(pattern.grid['Kick'][22]).toBe(true);
      expect(pattern.grid['Kick'][28]).toBe(true);
      expect(pattern.grid['Snare'][4]).toBe(true);
      expect(pattern.grid['Snare'][10]).toBe(true);
      expect(pattern.grid['Snare'][18]).toBe(true);
      expect(pattern.grid['Snare'][24]).toBe(true);
    });

    it('detroit_techno has 4-on-the-floor', () => {
      const pattern = generateDrumPattern('detroit_techno', 50, 2, 'det-kick');
      for (let i = 0; i < 32; i += 4) {
        expect(pattern.grid['Kick'][i], `Kick at step ${i}`).toBe(true);
      }
    });

    it('uk_garage has 2-step shuffle', () => {
      const pattern = generateDrumPattern('uk_garage', 50, 2, 'ukg-shuffle');
      expect(pattern.grid['Kick'][0]).toBe(true);
      expect(pattern.grid['Kick'][10]).toBe(true);
      expect(pattern.grid['Kick'][16]).toBe(true);
      expect(pattern.grid['Kick'][26]).toBe(true);
      expect(pattern.grid['Snare'][8]).toBe(true);
      expect(pattern.grid['Snare'][24]).toBe(true);
    });

    it('higher energy produces denser patterns in some styles', () => {
      const lowEnergy = generateDrumPattern('techno', 20, 2, 'energy-low');
      const highEnergy = generateDrumPattern('techno', 90, 2, 'energy-high');
      const lowHats = lowEnergy.grid['HH Closed'].filter(Boolean).length;
      const highHats = highEnergy.grid['HH Closed'].filter(Boolean).length;
      expect(highHats).toBeGreaterThanOrEqual(lowHats);
    });

    it('complexity=3 adds ghost notes in some styles', () => {
      const low = generateDrumPattern('funk', 50, 1, 'ghost-low');
      const high = generateDrumPattern('funk', 50, 3, 'ghost-high');
      const lowSnare = low.grid['Snare'].filter(Boolean).length;
      const highSnare = high.grid['Snare'].filter(Boolean).length;
      expect(highSnare).toBeGreaterThanOrEqual(lowSnare);
    });

    it('complexity=3 with energy>40 adds extra HH Closed on odd steps', () => {
      const low = generateDrumPattern('boom_bap', 50, 2, 'extra-hats-low');
      const high = generateDrumPattern('boom_bap', 50, 3, 'extra-hats-high');
      const lowHats = low.grid['HH Closed'].filter(Boolean).length;
      const highHats = high.grid['HH Closed'].filter(Boolean).length;
      expect(highHats).toBeGreaterThanOrEqual(lowHats);
    });

    it('deterministic across all styles with same seed', () => {
      const styles: DrumStyle[] = [
        'boom_bap',
        'techno',
        'house',
        'trap',
        'funk',
        'jazz',
        'afrobeat',
        'detroit_techno',
        'uk_garage',
      ];
      for (const style of styles) {
        const p1 = generateDrumPattern(style, 60, 2, 'det-test');
        const p2 = generateDrumPattern(style, 60, 2, 'det-test');
        expect(p1, `${style} deterministic`).toEqual(p2);
      }
    });
  });

  describe('reframeSong', () => {
    const mockFramed = {
      sections: [],
      roles: ['verse', 'chorus'] as any[],
      devices: {} as any,
      harmonyPreset: 'pop' as any,
    };

    const mockSections = [
      {
        def: { id: 'verse_0', name: 'Verse', preset: 'pop' as any, lengthBars: 8 },
        chords: [
          { bar: 1, beat: 1, roman: 'I', chordName: 'C' },
          { bar: 2, beat: 1, roman: 'V', chordName: 'G' },
        ],
      },
      {
        def: { id: 'chorus_1', name: 'Chorus', preset: 'pop' as any, lengthBars: 8 },
        chords: [
          { bar: 1, beat: 1, roman: 'IV', chordName: 'F' },
          { bar: 2, beat: 1, roman: 'V', chordName: 'G' },
        ],
      },
    ] as any;

    it('returns same number of sections as input', () => {
      const result = reframeSong(mockFramed, mockSections, 'boom_bap');
      expect(result).toHaveLength(2);
    });

    it('applies drum patterns to sections', () => {
      const result = reframeSong(mockFramed, mockSections, 'boom_bap');
      expect(result[0].drumPattern).toBeDefined();
      expect(result[0].drumPattern.steps).toBe(32);
      expect(result[1].drumPattern).toBeDefined();
    });

    it('applies articulations to chords', () => {
      const result = reframeSong(mockFramed, mockSections, 'boom_bap');
      expect(result[0].articulations).toBeDefined();
      expect(Array.isArray(result[0].articulations)).toBe(true);
      expect(result[0].articulations.length).toBeGreaterThan(0);
    });

    it('applies timeFeel to sections', () => {
      const result = reframeSong(mockFramed, mockSections, 'jazz');
      expect(result[0].timeFeel).toBeDefined();
      expect(result[0].timeFeel.swingAmount).toBe(TIME_FEEL_PRESETS.jazz.swingAmount);
    });

    it('applies instrument textures to sections', () => {
      const result = reframeSong(mockFramed, mockSections, 'funk');
      expect(result[0].instrumentTextures).toBeDefined();
      expect(typeof result[0].instrumentTextures).toBe('object');
    });

    it('uses per-section energy from sectionEnergies', () => {
      const energies = [
        { sectionId: 'verse_0', energyScore: 90, targetComplexity: 3 },
        { sectionId: 'chorus_1', energyScore: 20, targetComplexity: 1 },
      ];
      const result = reframeSong(mockFramed, mockSections, 'house', energies);
      expect(result).toHaveLength(2);
      expect(result[0].drumPattern).toBeDefined();
      expect(result[1].drumPattern).toBeDefined();
    });

    it('filters out null sections', () => {
      const sectionsWithNull = [mockSections[0], null, mockSections[1]] as any;
      const result = reframeSong(mockFramed, sectionsWithNull, 'techno');
      expect(result).toHaveLength(2);
    });

    it('breakdown role uses sparse_boom_bap kick style', () => {
      const breakdownFramed = {
        ...mockFramed,
        roles: ['breakdown', 'verse'] as any[],
      };
      const result = reframeSong(breakdownFramed, mockSections, 'boom_bap');
      expect(result[0].timeFeel.kickPlacementStyle).toBe('sparse_boom_bap');
    });
  });
});
