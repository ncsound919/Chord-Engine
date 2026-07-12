import { describe, it, expect, beforeEach } from 'vitest';
import { Microtuner, EQUAL_TEMPERAMENT, type TuningScale } from './tuning';

const TWELVE_TET_INTERVALS: TuningScale = {
  name: '12-TET (intervals)',
  description: 'Equal temperament using interval notation',
  degrees: Array.from({ length: 12 }, () => ({ cents: 100 })),
  referenceMidi: 69,
  referenceFreq: 440,
};

describe('Microtuner', () => {
  let mt: Microtuner;

  beforeEach(() => {
    mt = new Microtuner();
  });

  it('default scale is EQUAL_TEMPERAMENT', () => {
    expect(mt.scale.name).toBe('12-TET');
    expect(mt.scale.degrees.length).toBe(12);
  });

  it('getFrequency returns standard equal temperament when disabled', () => {
    mt.enabled = false;
    const freq = mt.getFrequency(69);
    expect(freq).toBeCloseTo(440, 1);
    const freqC4 = mt.getFrequency(60);
    expect(freqC4).toBeCloseTo(261.63, 0);
  });

  it('getFrequency returns different value when enabled with custom scale', () => {
    const customScale: TuningScale = {
      name: '150-cent steps',
      description: 'Non-standard tuning with 150 cent steps',
      degrees: Array.from({ length: 12 }, () => ({ cents: 150 })),
      referenceMidi: 69,
      referenceFreq: 440,
    };
    mt.loadScale(customScale);
    mt.enabled = true;
    const tuned = mt.getFrequency(69);
    expect(tuned).toBeCloseTo(440, 1);
    const note70 = mt.getFrequency(70);
    const standard70 = 440 * Math.pow(2, 1 / 12);
    expect(note70).not.toBeCloseTo(standard70, 0);
  });

  it('midiToCents returns 0 for reference note', () => {
    expect(mt.midiToCents(69)).toBe(0);
  });

  it('midiToCents returns correct values for other notes', () => {
    mt.loadScale(TWELVE_TET_INTERVALS);
    expect(mt.midiToCents(81)).toBe(1200);
    expect(mt.midiToCents(57)).toBe(-1200);
    expect(mt.midiToCents(70)).toBe(100);
    expect(mt.midiToCents(68)).toBe(-100);
  });

  it('loadScale changes the active scale', () => {
    const custom: TuningScale = {
      name: '19-TET',
      description: '19 equal temperament',
      degrees: Array.from({ length: 19 }, () => ({ cents: 1200 / 19 })),
      referenceMidi: 69,
      referenceFreq: 440,
    };
    mt.loadScale(custom);
    expect(mt.scale.name).toBe('19-TET');
    expect(mt.scale.degrees.length).toBe(19);
  });

  it('enabled getter/setter', () => {
    expect(mt.enabled).toBe(false);
    mt.enabled = true;
    expect(mt.enabled).toBe(true);
    mt.enabled = false;
    expect(mt.enabled).toBe(false);
  });
});

describe('Microtuner.parseScl', () => {
  it('parses valid Scala file', () => {
    const scl = `! test.scl
!
Test scale
12
!
 100.0
 200.0
 300.0
 400.0
 500.0
 600.0
 700.0
 800.0
 900.0
 1000.0
 1100.0
 1200.0`;
    const scale = Microtuner.parseScl(scl);
    expect(scale).not.toBeNull();
    expect(scale!.name).toBe('Test scale');
    expect(scale!.degrees.length).toBe(12);
    expect(scale!.degrees[0].cents).toBeCloseTo(100, 1);
  });

  it('returns null for too few lines', () => {
    expect(Microtuner.parseScl('')).toBeNull();
    expect(Microtuner.parseScl('only one line')).toBeNull();
  });

  it('returns null if count is NaN', () => {
    const scl = `name\nnotanumber\n`;
    expect(Microtuner.parseScl(scl)).toBeNull();
  });

  it('handles ratio notation', () => {
    const scl = `ratios
3
3/2
5/4
2/1`;
    const scale = Microtuner.parseScl(scl);
    expect(scale).not.toBeNull();
    expect(scale!.degrees.length).toBe(3);
    const ratio3_2 = Math.log(3 / 2) / Math.log(2) * 1200;
    const ratio5_4 = Math.log(5 / 4) / Math.log(2) * 1200;
    const ratio2_1 = Math.log(2 / 1) / Math.log(2) * 1200;
    expect(scale!.degrees[0].cents).toBeCloseTo(ratio3_2, 0);
    expect(scale!.degrees[1].cents).toBeCloseTo(ratio5_4 - ratio3_2, 0);
    expect(scale!.degrees[2].cents).toBeCloseTo(ratio2_1 - ratio5_4, 0);
  });

  it('filters comment lines', () => {
    const scl = `! comment
scale
2
! another comment
100
200`;
    const scale = Microtuner.parseScl(scl);
    expect(scale).not.toBeNull();
    expect(scale!.degrees.length).toBe(2);
  });

  it('returns null when no valid degrees parsed', () => {
    const scl = `name\n1\nnotavalidline`;
    const result = Microtuner.parseScl(scl);
    expect(result).toBeNull();
  });
});

describe('Microtuner.parseKbm', () => {
  it('parses reference note and frequency', () => {
    const kbm = `! keyboard mapping
0
0
0
69
440`;
    const result = Microtuner.parseKbm(kbm);
    expect(result.referenceMidi).toBe(69);
    expect(result.referenceFreq).toBe(440);
  });

  it('returns empty object for minimal input', () => {
    const result = Microtuner.parseKbm('');
    expect(result).toEqual({});
  });

  it('handles missing frequency gracefully', () => {
    const kbm = `! kbm
0
0
0
60`;
    const result = Microtuner.parseKbm(kbm);
    expect(result.referenceMidi).toBe(60);
    expect(result.referenceFreq).toBeUndefined();
  });
});
