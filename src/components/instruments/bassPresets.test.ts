import { describe, it, expect, vi, afterEach } from 'vitest';
import { createUserPreset, FACTORY_PRESETS } from './bassPresets';
import { DEFAULT_BASS_PARAMS } from './types';

afterEach(() => {
  vi.useRealTimers();
});

describe('bassPresets', () => {
  describe('FACTORY_PRESETS', () => {
    it('contains 4 factory presets', () => {
      expect(FACTORY_PRESETS).toHaveLength(4);
    });

    it('all factory presets have factory: true', () => {
      FACTORY_PRESETS.forEach(preset => {
        expect(preset.factory).toBe(true);
      });
    });

    it('all factory presets have unique ids', () => {
      const ids = FACTORY_PRESETS.map(p => p.id);
      expect(new Set(ids).size).toBe(ids.length);
    });

    it('all factory presets have name, description, and params', () => {
      FACTORY_PRESETS.forEach(preset => {
        expect(typeof preset.name).toBe('string');
        expect(preset.name.length).toBeGreaterThan(0);
        expect(typeof preset.description).toBe('string');
        expect(preset.description.length).toBeGreaterThan(0);
        expect(preset.params).toBeDefined();
      });
    });

    it('factory presets extend DEFAULT_BASS_PARAMS with overrides', () => {
      const motown = FACTORY_PRESETS.find(p => p.id === 'factory_motown')!;
      expect(motown.params.style).toBe('finger');
      expect(motown.params.pickupBlend).toBe(30);
      expect(motown.params.cabSim).toBe('b15');
      expect(motown.params.eqLow).toBe(5);

      const modernPick = FACTORY_PRESETS.find(p => p.id === 'factory_modern_pick')!;
      expect(modernPick.params.style).toBe('pick');
      expect(modernPick.params.cabSim).toBe('svt');

      const diClean = FACTORY_PRESETS.find(p => p.id === 'factory_di_clean')!;
      expect(diClean.params.drive).toBe(5);
      expect(diClean.params.cabSim).toBe('di');

      const subSynth = FACTORY_PRESETS.find(p => p.id === 'factory_sub_synth')!;
      expect(subSynth.params.ultraLo).toBe(true);
      expect(subSynth.params.drive).toBe(60);
    });

    it('non-overridden params fall back to DEFAULT_BASS_PARAMS', () => {
      const motown = FACTORY_PRESETS.find(p => p.id === 'factory_motown')!;
      expect(motown.params.bleedDecay).toBe(DEFAULT_BASS_PARAMS.bleedDecay);
      expect(motown.params.tuningCoarse).toBe(DEFAULT_BASS_PARAMS.tuningCoarse);
      expect(motown.params.tuningFine).toBe(DEFAULT_BASS_PARAMS.tuningFine);
    });
  });

  describe('createUserPreset', () => {
    it('creates a preset with the given name and params', () => {
      const params = { ...DEFAULT_BASS_PARAMS, tone: 80, drive: 50 };
      const preset = createUserPreset('My Bass', params);

      expect(preset.name).toBe('My Bass');
      expect(preset.factory).toBe(false);
      expect(preset.description).toBe('Custom preset');
      expect(preset.params.tone).toBe(80);
      expect(preset.params.drive).toBe(50);
    });

    it('generates a unique id with user_ prefix', () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2025-01-15T12:00:00Z'));

      const preset = createUserPreset('Test', { ...DEFAULT_BASS_PARAMS });
      expect(preset.id).toMatch(/^user_\d+_[a-z0-9]+$/);
    });

    it('falls back to "Untitled Preset" for empty name', () => {
      const preset = createUserPreset('', { ...DEFAULT_BASS_PARAMS });
      expect(preset.name).toBe('Untitled Preset');
    });

    it('falls back to "Untitled Preset" for whitespace-only name', () => {
      const preset = createUserPreset('   ', { ...DEFAULT_BASS_PARAMS });
      expect(preset.name).toBe('Untitled Preset');
    });

    it('trims leading and trailing whitespace from name', () => {
      const preset = createUserPreset('  My Bass  ', { ...DEFAULT_BASS_PARAMS });
      expect(preset.name).toBe('My Bass');
    });

    it('returns a shallow copy of params (not a reference)', () => {
      const params = { ...DEFAULT_BASS_PARAMS };
      const preset = createUserPreset('Copy Test', params);
      expect(preset.params).not.toBe(params);
      expect(preset.params).toEqual(params);
      preset.params.tone = 99;
      expect(params.tone).toBe(DEFAULT_BASS_PARAMS.tone);
    });

    it('different calls produce different ids', () => {
      const p1 = createUserPreset('A', { ...DEFAULT_BASS_PARAMS });
      const p2 = createUserPreset('B', { ...DEFAULT_BASS_PARAMS });
      expect(p1.id).not.toBe(p2.id);
    });
  });
});
