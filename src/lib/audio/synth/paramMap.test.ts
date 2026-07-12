import { describe, it, expect } from 'vitest';
import {
  PARAM_DESCRIPTORS,
  getParamDescriptor,
  getParamsByGroup,
  getParamGroups,
  getMIDICCMap,
} from './paramMap';

describe('PARAM_DESCRIPTORS', () => {
  it('has expected keys', () => {
    const keys = Object.keys(PARAM_DESCRIPTORS);
    expect(keys).toContain('vcfCutoff');
    expect(keys).toContain('vcfRes');
    expect(keys).toContain('envA');
    expect(keys).toContain('envD');
    expect(keys).toContain('chorus');
    expect(keys).toContain('vcaLevel');
  });

  it('each descriptor has required fields', () => {
    for (const desc of Object.values(PARAM_DESCRIPTORS)) {
      expect(desc).toHaveProperty('id');
      expect(desc).toHaveProperty('name');
      expect(desc).toHaveProperty('type');
      expect(desc).toHaveProperty('defaultValue');
      expect(typeof desc.id).toBe('string');
      expect(typeof desc.name).toBe('string');
    }
  });
});

describe('getParamDescriptor', () => {
  it('returns correct descriptor for known param', () => {
    const desc = getParamDescriptor('vcfCutoff');
    expect(desc).toBeDefined();
    expect(desc!.id).toBe('vcfCutoff');
    expect(desc!.name).toBe('VCF Cutoff');
    expect(desc!.defaultValue).toBe(75);
  });

  it('returns undefined for unknown param', () => {
    expect(getParamDescriptor('nonexistent')).toBeUndefined();
  });

  it('returns descriptor with correct type', () => {
    const desc = getParamDescriptor('chorus');
    expect(desc!.type).toBe('enum');
    expect(desc!.enumValues).toBeDefined();
    expect(desc!.enumValues!.length).toBe(4);
  });

  it('returns descriptor for bool type', () => {
    const desc = getParamDescriptor('dcoPulse');
    expect(desc!.type).toBe('bool');
    expect(desc!.defaultValue).toBe(true);
  });

  it('returns descriptor for stepped type', () => {
    const desc = getParamDescriptor('hpfFreq');
    expect(desc!.type).toBe('stepped');
    expect(desc!.step).toBe(1);
  });
});

describe('getParamsByGroup', () => {
  it('returns VCF params', () => {
    const vcfs = getParamsByGroup('VCF');
    expect(vcfs.length).toBeGreaterThan(0);
    for (const p of vcfs) {
      expect(p.group).toBe('VCF');
    }
  });

  it('returns ENV params', () => {
    const envs = getParamsByGroup('ENV');
    expect(envs.length).toBe(4);
    expect(envs.map(p => p.id)).toEqual(['envA', 'envD', 'envS', 'envR']);
  });

  it('returns empty array for unknown group', () => {
    expect(getParamsByGroup('NONEXISTENT')).toEqual([]);
  });
});

describe('getParamGroups', () => {
  it('returns all unique group names', () => {
    const groups = getParamGroups();
    expect(groups).toContain('VCF');
    expect(groups).toContain('ENV');
    expect(groups).toContain('DCO');
    expect(groups).toContain('VCA');
    expect(groups).toContain('LFO');
    expect(groups).toContain('FX');
    expect(groups.length).toBeGreaterThan(5);
  });

  it('returns only strings', () => {
    const groups = getParamGroups();
    for (const g of groups) {
      expect(typeof g).toBe('string');
    }
  });
});

describe('getMIDICCMap', () => {
  it('returns a Map', () => {
    const map = getMIDICCMap();
    expect(map).toBeInstanceOf(Map);
  });

  it('maps CC 74 to vcfCutoff', () => {
    const map = getMIDICCMap();
    expect(map.get(74)).toBe('vcfCutoff');
  });

  it('maps CC 71 to vcfRes', () => {
    const map = getMIDICCMap();
    expect(map.get(71)).toBe('vcfRes');
  });

  it('does not include params without midiCC', () => {
    const map = getMIDICCMap();
    expect([...map.values()]).not.toContain('vcfKeyFollow');
  });
});
