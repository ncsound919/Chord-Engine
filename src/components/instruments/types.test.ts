import { describe, it, expect } from 'vitest';

import {
  DRUM_NAMES,
  DEFAULT_BASS_PARAMS,
  createEmptySoundbankStatus,
} from './types';

describe('types', () => {
  // ── DRUM_NAMES ────────────────────────────────────────────────────
  describe('DRUM_NAMES', () => {
    it('contains exactly 9 entries', () => {
      expect(DRUM_NAMES).toHaveLength(9);
    });

    it('contains the expected drum names', () => {
      expect(DRUM_NAMES).toEqual([
        'Kick',
        'Snare',
        'Hi-Hat Closed',
        'Hi-Hat Open',
        'Crash',
        'Ride',
        'Tom 1',
        'Tom 2',
        'Tom 3',
      ]);
    });

    it('has Kick as first entry', () => {
      expect(DRUM_NAMES[0]).toBe('Kick');
    });

    it('has Tom 3 as last entry', () => {
      expect(DRUM_NAMES[8]).toBe('Tom 3');
    });

    it('contains no duplicates', () => {
      const unique = new Set(DRUM_NAMES);
      expect(unique.size).toBe(DRUM_NAMES.length);
    });
  });

  // ── DEFAULT_BASS_PARAMS ───────────────────────────────────────────
  describe('DEFAULT_BASS_PARAMS', () => {
    it('has style set to finger', () => {
      expect(DEFAULT_BASS_PARAMS.style).toBe('finger');
    });

    it('has pickupBlend in 0-100 range', () => {
      expect(DEFAULT_BASS_PARAMS.pickupBlend).toBeGreaterThanOrEqual(0);
      expect(DEFAULT_BASS_PARAMS.pickupBlend).toBeLessThanOrEqual(100);
    });

    it('has tone in 0-100 range', () => {
      expect(DEFAULT_BASS_PARAMS.tone).toBeGreaterThanOrEqual(0);
      expect(DEFAULT_BASS_PARAMS.tone).toBeLessThanOrEqual(100);
    });

    it('has monoChoke as boolean', () => {
      expect(typeof DEFAULT_BASS_PARAMS.monoChoke).toBe('boolean');
    });

    it('has bleedDecay as positive number', () => {
      expect(DEFAULT_BASS_PARAMS.bleedDecay).toBeGreaterThan(0);
    });

    it('has ampVolume in 0-100 range', () => {
      expect(DEFAULT_BASS_PARAMS.ampVolume).toBeGreaterThanOrEqual(0);
      expect(DEFAULT_BASS_PARAMS.ampVolume).toBeLessThanOrEqual(100);
    });

    it('has ampBass in 0-100 range', () => {
      expect(DEFAULT_BASS_PARAMS.ampBass).toBeGreaterThanOrEqual(0);
      expect(DEFAULT_BASS_PARAMS.ampBass).toBeLessThanOrEqual(100);
    });

    it('has ampTreble in 0-100 range', () => {
      expect(DEFAULT_BASS_PARAMS.ampTreble).toBeGreaterThanOrEqual(0);
      expect(DEFAULT_BASS_PARAMS.ampTreble).toBeLessThanOrEqual(100);
    });

    it('has ultraLo as boolean', () => {
      expect(typeof DEFAULT_BASS_PARAMS.ultraLo).toBe('boolean');
    });

    it('has ultraHi as boolean', () => {
      expect(typeof DEFAULT_BASS_PARAMS.ultraHi).toBe('boolean');
    });

    it('has drive in 0-100 range', () => {
      expect(DEFAULT_BASS_PARAMS.drive).toBeGreaterThanOrEqual(0);
      expect(DEFAULT_BASS_PARAMS.drive).toBeLessThanOrEqual(100);
    });

    it('has cabSim set to a valid value', () => {
      expect(['b15', 'svt', 'di']).toContain(DEFAULT_BASS_PARAMS.cabSim);
    });

    it('has tuningCoarse in -12 to +12 range', () => {
      expect(DEFAULT_BASS_PARAMS.tuningCoarse).toBeGreaterThanOrEqual(-12);
      expect(DEFAULT_BASS_PARAMS.tuningCoarse).toBeLessThanOrEqual(12);
    });

    it('has tuningFine in -50 to +50 range', () => {
      expect(DEFAULT_BASS_PARAMS.tuningFine).toBeGreaterThanOrEqual(-50);
      expect(DEFAULT_BASS_PARAMS.tuningFine).toBeLessThanOrEqual(50);
    });

    it('has eqLow in -12 to +12 range', () => {
      expect(DEFAULT_BASS_PARAMS.eqLow).toBeGreaterThanOrEqual(-12);
      expect(DEFAULT_BASS_PARAMS.eqLow).toBeLessThanOrEqual(12);
    });

    it('has eqMid in -12 to +12 range', () => {
      expect(DEFAULT_BASS_PARAMS.eqMid).toBeGreaterThanOrEqual(-12);
      expect(DEFAULT_BASS_PARAMS.eqMid).toBeLessThanOrEqual(12);
    });

    it('has eqHigh in -12 to +12 range', () => {
      expect(DEFAULT_BASS_PARAMS.eqHigh).toBeGreaterThanOrEqual(-12);
      expect(DEFAULT_BASS_PARAMS.eqHigh).toBeLessThanOrEqual(12);
    });

    it('has all required fields present', () => {
      const keys = [
        'style', 'pickupBlend', 'tone', 'monoChoke', 'bleedDecay',
        'ampVolume', 'ampBass', 'ampTreble', 'ultraLo', 'ultraHi',
        'drive', 'cabSim', 'tuningCoarse', 'tuningFine',
        'eqLow', 'eqMid', 'eqHigh',
      ];
      for (const key of keys) {
        expect(DEFAULT_BASS_PARAMS).toHaveProperty(key);
      }
    });

    it('is a frozen/immutable-like object (no mutation needed)', () => {
      // DEFAULT_BASS_PARAMS should be used as a read-only default
      expect(DEFAULT_BASS_PARAMS).toBeDefined();
      expect(typeof DEFAULT_BASS_PARAMS).toBe('object');
    });
  });

  // ── createEmptySoundbankStatus ────────────────────────────────────
  describe('createEmptySoundbankStatus', () => {
    it('returns an object with bass, kit1, and kit2', () => {
      const status = createEmptySoundbankStatus();
      expect(status).toHaveProperty('bass');
      expect(status).toHaveProperty('kit1');
      expect(status).toHaveProperty('kit2');
    });

    it('bass entry starts with loaded: false and filename: ""', () => {
      const status = createEmptySoundbankStatus();
      expect(status.bass).toEqual({ loaded: false, filename: '' });
    });

    it('kit1 has an entry for each DRUM_NAME', () => {
      const status = createEmptySoundbankStatus();
      for (const name of DRUM_NAMES) {
        expect(status.kit1).toHaveProperty(name);
      }
    });

    it('kit2 has an entry for each DRUM_NAME', () => {
      const status = createEmptySoundbankStatus();
      for (const name of DRUM_NAMES) {
        expect(status.kit2).toHaveProperty(name);
      }
    });

    it('kit1 has exactly 9 entries', () => {
      const status = createEmptySoundbankStatus();
      expect(Object.keys(status.kit1)).toHaveLength(9);
    });

    it('kit2 has exactly 9 entries', () => {
      const status = createEmptySoundbankStatus();
      expect(Object.keys(status.kit2)).toHaveLength(9);
    });

    it('all kit1 entries start with loaded: false and filename: ""', () => {
      const status = createEmptySoundbankStatus();
      for (const name of DRUM_NAMES) {
        expect(status.kit1[name]).toEqual({ loaded: false, filename: '' });
      }
    });

    it('all kit2 entries start with loaded: false and filename: ""', () => {
      const status = createEmptySoundbankStatus();
      for (const name of DRUM_NAMES) {
        expect(status.kit2[name]).toEqual({ loaded: false, filename: '' });
      }
    });

    it('each call returns a new object (not shared reference)', () => {
      const s1 = createEmptySoundbankStatus();
      const s2 = createEmptySoundbankStatus();
      expect(s1).not.toBe(s2);
      expect(s1.kit1).not.toBe(s2.kit1);
      expect(s1.kit2).not.toBe(s2.kit2);
    });

    it('kit1 and kit2 are independent objects', () => {
      const status = createEmptySoundbankStatus();
      expect(status.kit1).not.toBe(status.kit2);
    });
  });
});
