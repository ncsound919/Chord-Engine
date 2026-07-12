import { describe, it, expect } from 'vitest';
import { STEPS, DRUM_DEFINITIONS, DRUM_KIT, PRESET_TYPES } from './constants';

describe('STEPS', () => {
  it('equals 32', () => {
    expect(STEPS).toBe(32);
  });
});

describe('DRUM_DEFINITIONS', () => {
  it('is a non-empty array', () => {
    expect(Array.isArray(DRUM_DEFINITIONS)).toBe(true);
    expect(DRUM_DEFINITIONS.length).toBeGreaterThan(0);
  });

  it('every entry has required fields', () => {
    for (const drum of DRUM_DEFINITIONS) {
      expect(typeof drum.id).toBe('string');
      expect(drum.id.length).toBeGreaterThan(0);
      expect(typeof drum.displayName).toBe('string');
      expect(drum.displayName.length).toBeGreaterThan(0);
      expect(typeof drum.sampleName).toBe('string');
      expect(drum.sampleName.length).toBeGreaterThan(0);
      expect(typeof drum.type).toBe('string');
    }
  });

  it('has valid type values', () => {
    const validTypes = new Set(['kick', 'snare', 'hat', 'tom', 'perc']);
    for (const drum of DRUM_DEFINITIONS) {
      expect(validTypes.has(drum.type)).toBe(true);
    }
  });

  it('contains a kick drum', () => {
    const kick = DRUM_DEFINITIONS.find((d) => d.type === 'kick');
    expect(kick).toBeDefined();
    expect(kick!.id).toBe('Kick');
  });

  it('contains a snare drum', () => {
    const snare = DRUM_DEFINITIONS.find((d) => d.type === 'snare');
    expect(snare).toBeDefined();
    expect(snare!.id).toBe('Snare');
  });

  it('has unique ids', () => {
    const ids = DRUM_DEFINITIONS.map((d) => d.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe('DRUM_KIT', () => {
  it('is derived from DRUM_DEFINITIONS ids', () => {
    expect(DRUM_KIT).toEqual(DRUM_DEFINITIONS.map((d) => d.id));
  });

  it('has the same length as DRUM_DEFINITIONS', () => {
    expect(DRUM_KIT.length).toBe(DRUM_DEFINITIONS.length);
  });

  it('is an array of strings', () => {
    for (const id of DRUM_KIT) {
      expect(typeof id).toBe('string');
    }
  });
});

describe('PRESET_TYPES', () => {
  it('is a non-empty array', () => {
    expect(Array.isArray(PRESET_TYPES)).toBe(true);
    expect(PRESET_TYPES.length).toBeGreaterThan(0);
  });

  it('every entry has type and label strings', () => {
    for (const preset of PRESET_TYPES) {
      expect(typeof preset.type).toBe('string');
      expect(preset.type.length).toBeGreaterThan(0);
      expect(typeof preset.label).toBe('string');
      expect(preset.label.length).toBeGreaterThan(0);
    }
  });

  it('contains known preset types', () => {
    const types = PRESET_TYPES.map((p) => p.type);
    expect(types).toContain('boom_bap');
    expect(types).toContain('techno');
    expect(types).toContain('trap');
  });

  it('has unique types', () => {
    const types = PRESET_TYPES.map((p) => p.type);
    expect(new Set(types).size).toBe(types.length);
  });

  it('has human-readable labels', () => {
    const labels = PRESET_TYPES.map((p) => p.label);
    expect(labels).toContain('Boom Bap');
    expect(labels).toContain('Techno');
    expect(labels).toContain('Trap');
  });
});
