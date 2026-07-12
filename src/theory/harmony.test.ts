import { describe, it, expect } from 'vitest';
import {
  buildNodeSet,
  functionTransitionWeight,
  scoreTransition,
  tritoneSubOf,
  secondaryDominantOf,
  PRESET_PROFILES,
} from './harmony';
import type { ChordNode, PresetProfile, HarmonicFunction } from './harmony';

// ────────────────────────────────────────────────
// buildNodeSet
// ────────────────────────────────────────────────
describe('buildNodeSet', () => {
  const nodes = buildNodeSet();

  it('returns a non-empty record', () => {
    expect(Object.keys(nodes).length).toBeGreaterThan(0);
  });

  // ---- Diatonic degrees ----
  describe('diatonic degrees', () => {
    const diatonicKeys = ['I', 'ii', 'iii', 'IV', 'V', 'vi', 'vii'];

    it.each(diatonicKeys)('contains diatonic degree %s', (deg) => {
      expect(nodes[deg]).toBeDefined();
    });

    it('I has tonic function', () => {
      expect(nodes['I'].fn).toBe('tonic');
    });

    it('ii has subdominant function', () => {
      expect(nodes['ii'].fn).toBe('subdominant');
    });

    it('iii has tonic_substitute function', () => {
      expect(nodes['iii'].fn).toBe('tonic_substitute');
    });

    it('IV has subdominant function', () => {
      expect(nodes['IV'].fn).toBe('subdominant');
    });

    it('V has dominant function', () => {
      expect(nodes['V'].fn).toBe('dominant');
    });

    it('vi has tonic_substitute function', () => {
      expect(nodes['vi'].fn).toBe('tonic_substitute');
    });

    it('vii has dominant function', () => {
      expect(nodes['vii'].fn).toBe('dominant');
    });

    it('I has maj7 quality', () => {
      expect(nodes['I'].quality).toBe('maj7');
    });

    it('ii has m7 quality', () => {
      expect(nodes['ii'].quality).toBe('m7');
    });

    it('V has 7 quality', () => {
      expect(nodes['V'].quality).toBe('7');
    });

    it('diatonic nodes are not marked borrowed or secondary dominant', () => {
      for (const deg of diatonicKeys) {
        expect(nodes[deg].isBorrowed).toBeUndefined();
        expect(nodes[deg].isSecondaryDominant).toBeUndefined();
      }
    });
  });

  // ---- Extension variants ----
  describe('extension variants', () => {
    it('contains I9 with maj9 quality', () => {
      expect(nodes['I9']).toBeDefined();
      expect(nodes['I9'].quality).toBe('maj9');
    });

    it('contains I13 with maj13 quality', () => {
      expect(nodes['I13']).toBeDefined();
      expect(nodes['I13'].quality).toBe('maj13');
    });

    it('contains I6 with 6 quality', () => {
      expect(nodes['I6']).toBeDefined();
      expect(nodes['I6'].quality).toBe('6');
    });

    it('contains Iadd9 with add9 quality', () => {
      expect(nodes['Iadd9']).toBeDefined();
      expect(nodes['Iadd9'].quality).toBe('add9');
    });

    it('contains ii9 with m9 quality', () => {
      expect(nodes['ii9']).toBeDefined();
      expect(nodes['ii9'].quality).toBe('m9');
    });

    it('contains ii11 with m11 quality', () => {
      expect(nodes['ii11']).toBeDefined();
      expect(nodes['ii11'].quality).toBe('m11');
    });

    it('contains V9 with 9 quality', () => {
      expect(nodes['V9']).toBeDefined();
      expect(nodes['V9'].quality).toBe('9');
    });

    it('contains V13 with 13 quality', () => {
      expect(nodes['V13']).toBeDefined();
      expect(nodes['V13'].quality).toBe('13');
    });

    it('contains Vb9 with 7b9 quality', () => {
      expect(nodes['Vb9']).toBeDefined();
      expect(nodes['Vb9'].quality).toBe('7b9');
    });

    it('contains V#9 with 7#9 quality', () => {
      expect(nodes['V#9']).toBeDefined();
      expect(nodes['V#9'].quality).toBe('7#9');
    });

    it('contains Vsus4 with 9sus4 quality', () => {
      expect(nodes['Vsus4']).toBeDefined();
      expect(nodes['Vsus4'].quality).toBe('9sus4');
    });

    it('extension variants share parent function', () => {
      expect(nodes['V9'].fn).toBe('dominant');
      expect(nodes['ii9'].fn).toBe('subdominant');
      expect(nodes['I9'].fn).toBe('tonic');
    });

    it('extension variants share parent rootOffset', () => {
      expect(nodes['V9'].rootOffset).toBe(nodes['V'].rootOffset);
      expect(nodes['ii9'].rootOffset).toBe(nodes['ii'].rootOffset);
    });
  });

  // ---- Borrowed chords ----
  describe('borrowed chords', () => {
    const borrowedKeys = ['iv', 'bVI', 'bVII', 'bII', 'bIII'];

    it.each(borrowedKeys)('contains borrowed chord %s', (deg) => {
      expect(nodes[deg]).toBeDefined();
    });

    it('marks borrowed chords with isBorrowed', () => {
      for (const deg of borrowedKeys) {
        expect(nodes[deg].isBorrowed).toBe(true);
      }
    });

    it('iv has subdominant_minor function and m7 quality', () => {
      expect(nodes['iv'].fn).toBe('subdominant_minor');
      expect(nodes['iv'].quality).toBe('m7');
    });

    it('bVI has subdominant_minor function and maj7 quality', () => {
      expect(nodes['bVI'].fn).toBe('subdominant_minor');
      expect(nodes['bVI'].quality).toBe('maj7');
    });

    it('bVII has subdominant_minor function and 13 quality', () => {
      expect(nodes['bVII'].fn).toBe('subdominant_minor');
      expect(nodes['bVII'].quality).toBe('13');
    });

    it('bII has dominant function and 7 quality', () => {
      expect(nodes['bII'].fn).toBe('dominant');
      expect(nodes['bII'].quality).toBe('7');
    });

    it('bIII has tonic_substitute function and maj7 quality', () => {
      expect(nodes['bIII'].fn).toBe('tonic_substitute');
      expect(nodes['bIII'].quality).toBe('maj7');
    });

    it('has extension variants for borrowed chords', () => {
      expect(nodes['iv9']).toBeDefined();
      expect(nodes['iv9'].isBorrowed).toBe(true);
      expect(nodes['bVI9']).toBeDefined();
      expect(nodes['bVI9'].isBorrowed).toBe(true);
    });
  });

  // ---- Secondary dominants ----
  describe('secondary dominants', () => {
    const expectedSecDom = ['V7/I', 'V7/ii', 'V7/iii', 'V7/IV', 'V7/vi'];

    it.each(expectedSecDom)('contains secondary dominant %s', (key) => {
      expect(nodes[key]).toBeDefined();
    });

    it('marks secondary dominants correctly', () => {
      for (const key of expectedSecDom) {
        expect(nodes[key].isSecondaryDominant).toBe(true);
        expect(nodes[key].fn).toBe('dominant');
        expect(nodes[key].quality).toBe('7');
      }
    });

    it('does NOT contain V7/V', () => {
      expect(nodes['V7/V']).toBeUndefined();
    });

    it('does NOT contain V7/vii', () => {
      expect(nodes['V7/vii']).toBeUndefined();
    });

    it('V7/ii has correct rootOffset: (offset of ii=2 + 7) % 12 = 9', () => {
      expect(nodes['V7/ii'].rootOffset).toBe(9);
    });

    it('V7/I has correct rootOffset: (0 + 7) % 12 = 7', () => {
      expect(nodes['V7/I'].rootOffset).toBe(7);
    });

    it('V7/IV has correct rootOffset: (5 + 7) % 12 = 0', () => {
      expect(nodes['V7/IV'].rootOffset).toBe(0);
    });

    it('contains extended secondary dominant V13/ii', () => {
      expect(nodes['V13/ii']).toBeDefined();
      expect(nodes['V13/ii'].quality).toBe('13');
      expect(nodes['V13/ii'].isSecondaryDominant).toBe(true);
    });

    it('contains extended secondary dominant V13/IV', () => {
      expect(nodes['V13/IV']).toBeDefined();
      expect(nodes['V13/IV'].quality).toBe('13');
    });
  });

  // ---- Tritone substitutes ----
  describe('tritone substitutes', () => {
    it('contains sub(V)', () => {
      expect(nodes['sub(V)']).toBeDefined();
    });

    it('sub(V) has rootOffset (7+6)%12 = 1', () => {
      expect(nodes['sub(V)'].rootOffset).toBe(1);
    });

    it('sub(V) has dominant function', () => {
      expect(nodes['sub(V)'].fn).toBe('dominant');
    });

    it('sub(V) has same quality as V (7)', () => {
      expect(nodes['sub(V)'].quality).toBe('7');
    });

    it('contains sub(V7/ii)', () => {
      expect(nodes['sub(V7/ii)']).toBeDefined();
    });

    it('sub(V7/ii) rootOffset is (9+6)%12 = 3', () => {
      expect(nodes['sub(V7/ii)'].rootOffset).toBe(3);
    });
  });
});

// ────────────────────────────────────────────────
// functionTransitionWeight
// ────────────────────────────────────────────────
describe('functionTransitionWeight', () => {
  it('tonic -> subdominant = 3', () => {
    expect(functionTransitionWeight('tonic', 'subdominant')).toBe(3);
  });

  it('tonic -> subdominant_minor = 2', () => {
    expect(functionTransitionWeight('tonic', 'subdominant_minor')).toBe(2);
  });

  it('tonic -> dominant = 1', () => {
    expect(functionTransitionWeight('tonic', 'dominant')).toBe(1);
  });

  it('tonic -> tonic_substitute = 2', () => {
    expect(functionTransitionWeight('tonic', 'tonic_substitute')).toBe(2);
  });

  it('tonic -> tonic = 1', () => {
    expect(functionTransitionWeight('tonic', 'tonic')).toBe(1);
  });

  it('tonic_substitute -> subdominant = 3', () => {
    expect(functionTransitionWeight('tonic_substitute', 'subdominant')).toBe(3);
  });

  it('tonic_substitute -> tonic = 2', () => {
    expect(functionTransitionWeight('tonic_substitute', 'tonic')).toBe(2);
  });

  it('subdominant -> dominant = 3', () => {
    expect(functionTransitionWeight('subdominant', 'dominant')).toBe(3);
  });

  it('subdominant -> tonic = 1', () => {
    expect(functionTransitionWeight('subdominant', 'tonic')).toBe(1);
  });

  it('subdominant -> subdominant = 1', () => {
    expect(functionTransitionWeight('subdominant', 'subdominant')).toBe(1);
  });

  it('subdominant_minor -> dominant = 2', () => {
    expect(functionTransitionWeight('subdominant_minor', 'dominant')).toBe(2);
  });

  it('subdominant_minor -> tonic = 3', () => {
    expect(functionTransitionWeight('subdominant_minor', 'tonic')).toBe(3);
  });

  it('dominant -> tonic = 4', () => {
    expect(functionTransitionWeight('dominant', 'tonic')).toBe(4);
  });

  it('dominant -> tonic_substitute = 2', () => {
    expect(functionTransitionWeight('dominant', 'tonic_substitute')).toBe(2);
  });

  it('dominant -> subdominant_minor = 1', () => {
    expect(functionTransitionWeight('dominant', 'subdominant_minor')).toBe(1);
  });

  it('returns 0.5 for unknown / undefined pairs', () => {
    // tonic has no entry for 'subdominant' mapped to an arbitrary missing key
    expect(functionTransitionWeight('tonic', 'dominant')).toBe(1);
    // But for a combination not in the table at all (if we had a fake fn)
    // The fallback is 0.5. Let's test by creating a scenario:
    // subdominant_minor has no entry for 'dominant' -> it's defined so let's check tonic_substitute->dominant
    expect(functionTransitionWeight('tonic_substitute', 'dominant')).toBe(1);
    // Actually tonic_substitute -> dominant = 1 is defined. Let's find an undefined one:
    // subdominant -> subdominant_minor = 1 is defined.
    // Let's check subdominant_minor -> subdominant = 1 is defined.
    // Check subdominant_minor -> tonic_substitute which isn't in the map
    expect(functionTransitionWeight('subdominant_minor', 'tonic_substitute')).toBe(0.5);
  });
});

// ────────────────────────────────────────────────
// scoreTransition
// ────────────────────────────────────────────────
describe('scoreTransition', () => {
  const baseProfile: PresetProfile = {
    favorsSecondaryDominants: 1.0,
    favorsTritoneSubs: 1.0,
    favorsBorrowed: 1.0,
    favorsExtensions: 1.0,
    preferredCadence: 'authentic',
  };

  const I: ChordNode = { roman: 'I', rootOffset: 0, quality: 'maj7', fn: 'tonic' };
  const ii: ChordNode = { roman: 'ii', rootOffset: 2, quality: 'm7', fn: 'subdominant' };
  const V: ChordNode = { roman: 'V', rootOffset: 7, quality: '7', fn: 'dominant' };
  const vi: ChordNode = { roman: 'vi', rootOffset: 9, quality: 'm7', fn: 'tonic_substitute' };

  it('returns the function transition weight with profile multipliers at 1.0', () => {
    // I -> ii: tonic->subdominant = 3
    expect(scoreTransition(I, ii, baseProfile)).toBe(3);
  });

  it('penalizes same-chord repetition (weight * 0.15)', () => {
    // I -> I: tonic->tonic = 1, then * 0.15 = 0.15
    expect(scoreTransition(I, I, baseProfile)).toBeCloseTo(0.15);
  });

  it('amplifies secondary dominants by favorsSecondaryDominants', () => {
    const profile = { ...baseProfile, favorsSecondaryDominants: 2.0 };
    const V7ii: ChordNode = {
      roman: 'V7/ii', rootOffset: 9, quality: '7', fn: 'dominant', isSecondaryDominant: true,
    };
    // V -> V7/ii: dominant->dominant is NOT in the table so it's 0.5
    // Actually dominant -> dominant is not in CYCLE_WEIGHT['dominant'], so it's 0.5
    // 0.5 * 2.0 = 1.0
    const result = scoreTransition(V, V7ii, profile);
    expect(result).toBe(1.0);
  });

  it('amplifies tritone subs by favorsTritoneSubs', () => {
    const profile = { ...baseProfile, favorsTritoneSubs: 3.0 };
    const subV: ChordNode = {
      roman: 'sub(V)', rootOffset: 1, quality: '7', fn: 'dominant',
    };
    // V -> sub(V): dominant->dominant not in table = 0.5 * 3.0 = 1.5
    const result = scoreTransition(V, subV, profile);
    expect(result).toBe(1.5);
  });

  it('amplifies borrowed chords by favorsBorrowed', () => {
    const profile = { ...baseProfile, favorsBorrowed: 2.0 };
    const iv: ChordNode = {
      roman: 'iv', rootOffset: 5, quality: 'm7', fn: 'subdominant_minor', isBorrowed: true,
    };
    // I -> iv: tonic -> subdominant_minor = 2 * 2.0 = 4
    const result = scoreTransition(I, iv, profile);
    expect(result).toBe(4);
  });

  it('amplifies extensions by favorsExtensions', () => {
    const profile = { ...baseProfile, favorsExtensions: 2.0 };
    const V9: ChordNode = {
      roman: 'V9', rootOffset: 7, quality: '9', fn: 'dominant',
    };
    // I -> V9: tonic -> dominant = 1 * 2.0 = 2.0
    const result = scoreTransition(I, V9, profile);
    expect(result).toBe(2);
  });

  it('combines multiple multipliers', () => {
    const profile = {
      favorsSecondaryDominants: 2.0,
      favorsTritoneSubs: 1.0,
      favorsBorrowed: 1.0,
      favorsExtensions: 1.5,
      preferredCadence: 'authentic' as const,
    };
    const V13ii: ChordNode = {
      roman: 'V13/ii', rootOffset: 9, quality: '13', fn: 'dominant', isSecondaryDominant: true,
    };
    // I -> V13/ii: tonic->dominant = 1 * 2.0 (sec dom) * 1.5 (extension) = 3.0
    const result = scoreTransition(I, V13ii, profile);
    expect(result).toBe(3);
  });

  it('never returns less than 0.01', () => {
    // Even heavily penalized same-chord with low multipliers
    const result = scoreTransition(I, I, baseProfile);
    expect(result).toBeGreaterThanOrEqual(0.01);
  });

  it('scores tonic->dominant transition correctly', () => {
    // I -> V: tonic->dominant = 1
    expect(scoreTransition(I, V, baseProfile)).toBe(1);
  });

  it('scores subdominant->tonic transition correctly', () => {
    // ii -> I: subdominant->tonic = 1
    expect(scoreTransition(ii, I, baseProfile)).toBe(1);
  });

  it('scores dominant->tonic transition correctly', () => {
    // V -> I: dominant->tonic = 4
    expect(scoreTransition(V, I, baseProfile)).toBe(4);
  });
});

// ────────────────────────────────────────────────
// tritoneSubOf
// ────────────────────────────────────────────────
describe('tritoneSubOf', () => {
  it('returns a ChordNode for dominant quality', () => {
    const V: ChordNode = { roman: 'V', rootOffset: 7, quality: '7', fn: 'dominant' };
    const result = tritoneSubOf(V);
    expect(result).not.toBeNull();
    expect(result!.roman).toBe('sub(V)');
  });

  it('returns rootOffset offset by +6 mod 12', () => {
    const V: ChordNode = { roman: 'V', rootOffset: 7, quality: '7', fn: 'dominant' };
    const result = tritoneSubOf(V);
    expect(result!.rootOffset).toBe((7 + 6) % 12); // 1
  });

  it('preserves the quality', () => {
    const V: ChordNode = { roman: 'V', rootOffset: 7, quality: '7', fn: 'dominant' };
    const result = tritoneSubOf(V);
    expect(result!.quality).toBe('7');
  });

  it('returns dominant function', () => {
    const V: ChordNode = { roman: 'V', rootOffset: 7, quality: '7', fn: 'dominant' };
    const result = tritoneSubOf(V);
    expect(result!.fn).toBe('dominant');
  });

  it('preserves isSecondaryDominant flag', () => {
    const V7ii: ChordNode = {
      roman: 'V7/ii', rootOffset: 9, quality: '7', fn: 'dominant', isSecondaryDominant: true,
    };
    const result = tritoneSubOf(V7ii);
    expect(result!.isSecondaryDominant).toBe(true);
  });

  it('returns null for non-dominant quality (maj7)', () => {
    const I: ChordNode = { roman: 'I', rootOffset: 0, quality: 'maj7', fn: 'tonic' };
    expect(tritoneSubOf(I)).toBeNull();
  });

  it('returns null for non-dominant quality (m7)', () => {
    const ii: ChordNode = { roman: 'ii', rootOffset: 2, quality: 'm7', fn: 'subdominant' };
    expect(tritoneSubOf(ii)).toBeNull();
  });

  it('returns non-null for 9 quality (dominant)', () => {
    const V9: ChordNode = { roman: 'V9', rootOffset: 7, quality: '9', fn: 'dominant' };
    const result = tritoneSubOf(V9);
    expect(result).not.toBeNull();
    expect(result!.rootOffset).toBe(1);
  });

  it('returns non-null for 13 quality (dominant)', () => {
    const V13: ChordNode = { roman: 'V13', rootOffset: 7, quality: '13', fn: 'dominant' };
    const result = tritoneSubOf(V13);
    expect(result).not.toBeNull();
  });
});

// ────────────────────────────────────────────────
// secondaryDominantOf
// ────────────────────────────────────────────────
describe('secondaryDominantOf', () => {
  it('returns a dominant-function ChordNode', () => {
    const target: ChordNode = { roman: 'ii', rootOffset: 2, quality: 'm7', fn: 'subdominant' };
    const result = secondaryDominantOf(target);
    expect(result.fn).toBe('dominant');
  });

  it('rootOffset is (target.rootOffset + 7) % 12', () => {
    const target: ChordNode = { roman: 'ii', rootOffset: 2, quality: 'm7', fn: 'subdominant' };
    const result = secondaryDominantOf(target);
    expect(result.rootOffset).toBe((2 + 7) % 12); // 9
  });

  it('returns 7 quality by default', () => {
    const target: ChordNode = { roman: 'IV', rootOffset: 5, quality: 'maj7', fn: 'subdominant' };
    const result = secondaryDominantOf(target);
    expect(result.quality).toBe('7');
  });

  it('returns 13 quality when extended=true', () => {
    const target: ChordNode = { roman: 'IV', rootOffset: 5, quality: 'maj7', fn: 'subdominant' };
    const result = secondaryDominantOf(target, true);
    expect(result.quality).toBe('13');
  });

  it('labels as V7/<target> by default', () => {
    const target: ChordNode = { roman: 'ii', rootOffset: 2, quality: 'm7', fn: 'subdominant' };
    const result = secondaryDominantOf(target);
    expect(result.roman).toBe('V7/ii');
  });

  it('labels as V13/<target> when extended', () => {
    const target: ChordNode = { roman: 'ii', rootOffset: 2, quality: 'm7', fn: 'subdominant' };
    const result = secondaryDominantOf(target, true);
    expect(result.roman).toBe('V13/ii');
  });

  it('marks isSecondaryDominant as true', () => {
    const target: ChordNode = { roman: 'vi', rootOffset: 9, quality: 'm7', fn: 'tonic_substitute' };
    const result = secondaryDominantOf(target);
    expect(result.isSecondaryDominant).toBe(true);
  });

  it('works with target at rootOffset 0 (I)', () => {
    const target: ChordNode = { roman: 'I', rootOffset: 0, quality: 'maj7', fn: 'tonic' };
    const result = secondaryDominantOf(target);
    expect(result.rootOffset).toBe(7);
    expect(result.roman).toBe('V7/I');
  });

  it('works with target at rootOffset 11 (vii)', () => {
    const target: ChordNode = { roman: 'vii', rootOffset: 11, quality: 'm7b5', fn: 'dominant' };
    const result = secondaryDominantOf(target);
    expect(result.rootOffset).toBe((11 + 7) % 12); // 6
    expect(result.roman).toBe('V7/vii');
  });
});

// ────────────────────────────────────────────────
// PRESET_PROFILES
// ────────────────────────────────────────────────
describe('PRESET_PROFILES', () => {
  const requiredKeys: (keyof PresetProfile)[] = [
    'favorsSecondaryDominants',
    'favorsTritoneSubs',
    'favorsBorrowed',
    'favorsExtensions',
    'preferredCadence',
  ];

  const presets = Object.keys(PRESET_PROFILES) as string[];

  it('contains all expected presets', () => {
    expect(presets).toContain('steely');
    expect(presets).toContain('stevie');
    expect(presets).toContain('isley');
    expect(presets).toContain('pop');
    expect(presets).toContain('jazz');
    expect(presets).toContain('soul');
    expect(presets).toContain('rnb');
    expect(presets).toContain('gospel');
    expect(presets).toContain('rock');
    expect(presets).toContain('techno');
    expect(presets).toContain('funk');
    expect(presets).toContain('sylvers');
  });

  it.each(presets)('preset "%s" has all required keys', (preset) => {
    const profile = PRESET_PROFILES[preset as keyof typeof PRESET_PROFILES];
    for (const key of requiredKeys) {
      expect(profile).toHaveProperty(key);
    }
  });

  it('steely favors secondary dominants and tritone subs heavily', () => {
    expect(PRESET_PROFILES.steely.favorsSecondaryDominants).toBeGreaterThan(1.0);
    expect(PRESET_PROFILES.steely.favorsTritoneSubs).toBeGreaterThan(1.0);
  });

  it('pop has low values for chromatic/chord extensions', () => {
    expect(PRESET_PROFILES.pop.favorsSecondaryDominants).toBeLessThan(1.0);
    expect(PRESET_PROFILES.pop.favorsTritoneSubs).toBeLessThan(1.0);
    expect(PRESET_PROFILES.pop.favorsExtensions).toBeLessThan(1.0);
  });

  it('jazz favors tritone subs the most', () => {
    expect(PRESET_PROFILES.jazz.favorsTritoneSubs).toBeGreaterThanOrEqual(
      PRESET_PROFILES.jazz.favorsSecondaryDominants
    );
  });

  it('each profile has a valid preferredCadence', () => {
    const validCadences = ['authentic', 'plagal', 'backdoor', 'deceptive'];
    for (const preset of presets) {
      const profile = PRESET_PROFILES[preset as keyof typeof PRESET_PROFILES];
      expect(validCadences).toContain(profile.preferredCadence);
    }
  });
});
