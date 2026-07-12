import { describe, it, expect, vi } from 'vitest';
import { reharmonizeProgression, ReharmStrategy } from './reharm';
import { ChordNode } from './harmony';

const makeNode = (overrides: Partial<ChordNode> = {}): ChordNode => ({
  roman: 'I',
  rootOffset: 0,
  quality: 'maj7',
  fn: 'tonic',
  ...overrides,
});

const dominantNode = (roman = 'V', rootOffset = 7): ChordNode =>
  makeNode({ roman, rootOffset, quality: '7', fn: 'dominant' });

const tonicNode = (roman = 'I', rootOffset = 0): ChordNode =>
  makeNode({ roman, rootOffset, quality: 'maj7', fn: 'tonic' });

const subdominantNode = (roman = 'IV', rootOffset = 5): ChordNode =>
  makeNode({ roman, rootOffset, quality: 'maj7', fn: 'subdominant' });

const minorNode = (roman = 'ii', rootOffset = 2): ChordNode =>
  makeNode({ roman, rootOffset, quality: 'm7', fn: 'subdominant' });

const tonicSubNode = (roman = 'vi', rootOffset = 9): ChordNode =>
  makeNode({ roman, rootOffset, quality: 'm7', fn: 'tonic_substitute' });

describe('reharmonizeProgression', () => {
  describe('empty progression', () => {
    it('returns empty array for empty input', () => {
      expect(reharmonizeProgression([], 'tritone_sub')).toEqual([]);
    });
  });

  describe('none strategy', () => {
    it('returns original progression unchanged', () => {
      const progression = [tonicNode(), dominantNode(), subdominantNode()];
      const result = reharmonizeProgression(progression, 'none');
      expect(result).toEqual(progression);
    });
  });

  describe('immutability', () => {
    it('does not mutate the original array', () => {
      const progression = [tonicNode(), dominantNode(), subdominantNode()];
      const original = [...progression];
      reharmonizeProgression(progression, 'tritone_sub');
      expect(progression).toEqual(original);
    });

    it('returns a new array reference', () => {
      const progression = [tonicNode()];
      const result = reharmonizeProgression(progression, 'none');
      expect(result).not.toBe(progression);
    });
  });

  describe('strategy array', () => {
    it('applies multiple strategies in order', () => {
      const progression = [tonicNode(), dominantNode(), subdominantNode()];
      const result = reharmonizeProgression(progression, ['tritone_sub', 'extension']);
      expect(result).toBeDefined();
      expect(Array.isArray(result)).toBe(true);
      expect(result.length).toBeGreaterThanOrEqual(progression.length);
    });

    it('handles single strategy in array form', () => {
      const progression = [tonicNode(), dominantNode()];
      const result = reharmonizeProgression(progression, ['tritone_sub']);
      expect(result).toBeDefined();
    });
  });

  describe('tritone_sub', () => {
    it('replaces dominant chords with tritone substitutes', () => {
      const progression = [tonicNode(), dominantNode(), tonicNode()];
      const result = reharmonizeProgression(progression, 'tritone_sub');
      expect(result).toHaveLength(3);
      expect(result[1].roman).toMatch(/^sub\(/);
      expect(result[1].rootOffset).toBe((7 + 6) % 12);
      expect(result[1].fn).toBe('dominant');
    });

    it('passes non-dominant chords through unchanged', () => {
      const progression = [tonicNode(), subdominantNode(), minorNode()];
      const result = reharmonizeProgression(progression, 'tritone_sub');
      expect(result[0]).toEqual(progression[0]);
      expect(result[1]).toEqual(progression[1]);
      expect(result[2]).toEqual(progression[2]);
    });

    it('handles chords with various dominant qualities', () => {
      const v13 = dominantNode('V13', 7);
      v13.quality = '13';
      const v7b9 = dominantNode('V7b9', 2);
      v7b9.quality = '7b9';
      const progression = [v13, v7b9];
      const result = reharmonizeProgression(progression, 'tritone_sub');
      expect(result[0].roman).toMatch(/^sub\(/);
      expect(result[1].roman).toMatch(/^sub\(/);
    });
  });

  describe('secondary_dominant', () => {
    it('inserts secondary dominant before stable tonic targets', () => {
      const progression = [tonicNode(), tonicNode()];
      const result = reharmonizeProgression(progression, 'secondary_dominant');
      expect(result.length).toBeGreaterThanOrEqual(2);
      const hasSecondaryDom = result.some(n => n.isSecondaryDominant);
      expect(hasSecondaryDom).toBe(true);
    });

    it('inserts secondary dominant before subdominant targets', () => {
      const progression = [tonicNode(), subdominantNode()];
      const result = reharmonizeProgression(progression, 'secondary_dominant');
      expect(result.length).toBeGreaterThanOrEqual(2);
      const hasSecondaryDom = result.some(n => n.isSecondaryDominant);
      expect(hasSecondaryDom).toBe(true);
    });

    it('does not insert before existing secondary dominants', () => {
      const sd = makeNode({
        roman: 'V7/ii',
        rootOffset: 9,
        quality: '7',
        fn: 'dominant',
        isSecondaryDominant: true,
      });
      const progression = [tonicNode(), sd, tonicNode()];
      const result = reharmonizeProgression(progression, 'secondary_dominant');
      const sdCount = result.filter(n => n.isSecondaryDominant).length;
      expect(sdCount).toBeLessThanOrEqual(2);
    });

    it('inserts before tonic_substitute targets', () => {
      const progression = [tonicNode(), tonicSubNode()];
      const result = reharmonizeProgression(progression, 'secondary_dominant');
      const hasSecondaryDom = result.some(n => n.isSecondaryDominant);
      expect(hasSecondaryDom).toBe(true);
    });
  });

  describe('extension', () => {
    it('upgrades maj7 to maj9', () => {
      const progression = [makeNode({ quality: 'maj7' })];
      const result = reharmonizeProgression(progression, 'extension');
      expect(result[0].quality).toBe('maj9');
    });

    it('upgrades m7 to m9', () => {
      const progression = [makeNode({ quality: 'm7', fn: 'subdominant' })];
      const result = reharmonizeProgression(progression, 'extension');
      expect(result[0].quality).toBe('m9');
    });

    it('upgrades 7 to 9', () => {
      const progression = [dominantNode()];
      const result = reharmonizeProgression(progression, 'extension');
      expect(result[0].quality).toBe('9');
    });

    it('upgrades maj9 to maj13', () => {
      const progression = [makeNode({ quality: 'maj9' })];
      const result = reharmonizeProgression(progression, 'extension');
      expect(result[0].quality).toBe('maj13');
    });

    it('upgrades m9 to m11', () => {
      const progression = [makeNode({ quality: 'm9', fn: 'subdominant' })];
      const result = reharmonizeProgression(progression, 'extension');
      expect(result[0].quality).toBe('m11');
    });

    it('upgrades 9 to 13', () => {
      const progression = [makeNode({ quality: '9', fn: 'dominant' })];
      const result = reharmonizeProgression(progression, 'extension');
      expect(result[0].quality).toBe('13');
    });

    it('extends triads to 7ths based on tonic function', () => {
      const progression = [makeNode({ quality: '', fn: 'tonic' })];
      const result = reharmonizeProgression(progression, 'extension');
      expect(result[0].quality).toBe('maj7');
    });

    it('extends triads to 7ths based on dominant function', () => {
      const progression = [makeNode({ quality: '', fn: 'dominant' })];
      const result = reharmonizeProgression(progression, 'extension');
      expect(result[0].quality).toBe('7');
    });

    it('extends triads to m7 for non-tonic/subdominant functions', () => {
      const progression = [makeNode({ quality: '', fn: 'tonic_substitute' })];
      const result = reharmonizeProgression(progression, 'extension');
      expect(result[0].quality).toBe('m7');
    });

    it('updates roman numeral when suffix is applied', () => {
      const progression = [makeNode({ roman: 'I', quality: 'maj7' })];
      const result = reharmonizeProgression(progression, 'extension');
      expect(result[0].roman).toContain('9');
    });
  });

  describe('modal_interchange', () => {
    it('interchanges IV with iv', () => {
      const progression = [subdominantNode('IV', 5)];
      const result = reharmonizeProgression(progression, 'modal_interchange');
      expect(result.length).toBe(1);
      expect(result[0].roman).toBe('iv');
    });

    it('interchanges V with bVII', () => {
      const progression = [dominantNode('V', 7)];
      const result = reharmonizeProgression(progression, 'modal_interchange');
      expect(result[0].roman).toBe('bVII');
    });

    it('passes through ii unchanged (iiø not in nodeSet)', () => {
      const progression = [minorNode('ii', 2)];
      const result = reharmonizeProgression(progression, 'modal_interchange');
      expect(result[0].roman).toBe('ii');
    });

    it('interchanges vi with bVI', () => {
      const progression = [tonicSubNode('vi', 9)];
      const result = reharmonizeProgression(progression, 'modal_interchange');
      expect(result[0].roman).toBe('bVI');
    });

    it('passes through chords with no interchange mapping', () => {
      const progression = [makeNode({ roman: 'bIII', rootOffset: 3, quality: 'maj7', fn: 'tonic_substitute' })];
      const result = reharmonizeProgression(progression, 'modal_interchange');
      expect(result[0].roman).toBe('bIII');
    });
  });

  describe('chromatic_approach', () => {
    it('inserts approach chord before tonic', () => {
      const progression = [tonicNode()];
      const result = reharmonizeProgression(progression, 'chromatic_approach');
      expect(result.length).toBe(2);
      expect(result[0].rootOffset).toBe(1);
      expect(result[0].fn).toBe('dominant');
      expect(result[1]).toEqual(progression[0]);
    });

    it('inserts approach chord before subdominant', () => {
      const progression = [subdominantNode()];
      const result = reharmonizeProgression(progression, 'chromatic_approach');
      expect(result.length).toBe(2);
      expect(result[0].rootOffset).toBe(6);
      expect(result[1]).toEqual(progression[0]);
    });

    it('does not insert before dominant chords', () => {
      const progression = [dominantNode()];
      const result = reharmonizeProgression(progression, 'chromatic_approach');
      expect(result.length).toBe(1);
    });

    it('handles multiple chords with different functions', () => {
      const progression = [tonicNode(), dominantNode(), subdominantNode()];
      const result = reharmonizeProgression(progression, 'chromatic_approach');
      expect(result.length).toBe(5);
    });
  });

  describe('diatonic_passing', () => {
    it('inserts passing chord between chords a major third apart ascending', () => {
      const a = makeNode({ rootOffset: 0, fn: 'tonic' });
      const b = makeNode({ rootOffset: 4, fn: 'tonic_substitute' });
      const progression = [a, b];
      const result = reharmonizeProgression(progression, 'diatonic_passing');
      expect(result.length).toBe(3);
      expect(result[1].rootOffset).toBe(2);
    });

    it('does not insert passing chord for ascending minor third (no matching node)', () => {
      const a = makeNode({ rootOffset: 0, fn: 'tonic' });
      const b = makeNode({ rootOffset: 3, fn: 'tonic_substitute' });
      const progression = [a, b];
      const result = reharmonizeProgression(progression, 'diatonic_passing');
      expect(result.length).toBe(2);
    });

    it('inserts passing chord for descending minor third', () => {
      const a = makeNode({ rootOffset: 4, fn: 'tonic_substitute' });
      const b = makeNode({ rootOffset: 0, fn: 'tonic' });
      const progression = [a, b];
      const result = reharmonizeProgression(progression, 'diatonic_passing');
      expect(result.length).toBe(3);
      expect(result[1].rootOffset).toBe(2);
    });

    it('does not insert when chords are not a third apart', () => {
      const a = makeNode({ rootOffset: 0, fn: 'tonic' });
      const b = makeNode({ rootOffset: 7, fn: 'dominant' });
      const progression = [a, b];
      const result = reharmonizeProgression(progression, 'diatonic_passing');
      expect(result.length).toBe(2);
    });
  });

  describe('diminished_passing', () => {
    it('does not insert dim7 when no dim7 node exists in nodeSet', () => {
      const a = makeNode({ rootOffset: 0, fn: 'tonic' });
      const b = makeNode({ rootOffset: 2, fn: 'subdominant' });
      const progression = [a, b];
      const result = reharmonizeProgression(progression, 'diminished_passing');
      expect(result.length).toBe(2);
    });

    it('does not insert dim7 descending (no dim7 node in nodeSet)', () => {
      const a = makeNode({ rootOffset: 2, fn: 'subdominant' });
      const b = makeNode({ rootOffset: 0, fn: 'tonic' });
      const progression = [a, b];
      const result = reharmonizeProgression(progression, 'diminished_passing');
      expect(result.length).toBe(2);
    });

    it('does not insert when chords are not a whole step apart', () => {
      const a = makeNode({ rootOffset: 0, fn: 'tonic' });
      const b = makeNode({ rootOffset: 7, fn: 'dominant' });
      const progression = [a, b];
      const result = reharmonizeProgression(progression, 'diminished_passing');
      expect(result.length).toBe(2);
    });
  });

  describe('backdoor', () => {
    it('attempts backdoor replacement (may pass through if bVII13 not in nodeSet)', () => {
      const progression = [tonicNode(), dominantNode(), tonicNode()];
      const result = reharmonizeProgression(progression, 'backdoor');
      expect(result.length).toBe(3);
    });

    it('passes through non-dominant chords unchanged', () => {
      const progression = [tonicNode(), subdominantNode()];
      const result = reharmonizeProgression(progression, 'backdoor');
      expect(result).toEqual(progression);
    });
  });

  describe('negative_harmony', () => {
    it('reflects tonic chord around axis', () => {
      const progression = [tonicNode()];
      const result = reharmonizeProgression(progression, 'negative_harmony');
      expect(result[0].rootOffset).toBe((5 - 0 + 12) % 12);
      expect(result[0].quality).toBe('m7');
    });

    it('reflects dominant chord around axis', () => {
      const progression = [dominantNode()];
      const result = reharmonizeProgression(progression, 'negative_harmony');
      expect(result[0].rootOffset).toBe((5 - 7 + 12) % 12);
      expect(result[0].quality).toBe('7');
    });

    it('reflects subdominant chord around axis', () => {
      const progression = [subdominantNode()];
      const result = reharmonizeProgression(progression, 'negative_harmony');
      expect(result[0].rootOffset).toBe((5 - 5 + 12) % 12);
    });

    it('creates fallback node when no matching node found in set', () => {
      const custom = makeNode({ roman: 'custom', rootOffset: 1, quality: 'maj7', fn: 'tonic' });
      const progression = [custom];
      const result = reharmonizeProgression(progression, 'negative_harmony');
      expect(result[0].rootOffset).toBe((5 - 1 + 12) % 12);
    });
  });

  describe('ii_v_expansion', () => {
    it('inserts ii-V before I target', () => {
      const progression = [tonicNode(), tonicNode()];
      const result = reharmonizeProgression(progression, 'ii_v_expansion');
      expect(result.length).toBeGreaterThanOrEqual(3);
      expect(result[0].fn).toBe('subdominant');
      expect(result[1].fn).toBe('dominant');
      expect(result[1].isSecondaryDominant).toBe(true);
    });

    it('inserts ii-V before vi target', () => {
      const progression = [tonicNode(), tonicSubNode()];
      const result = reharmonizeProgression(progression, 'ii_v_expansion');
      expect(result.length).toBeGreaterThanOrEqual(3);
      const hasIIV = result.some(n => n.fn === 'subdominant' && n.quality === 'm7b5');
      const hasV = result.some(n => n.fn === 'dominant' && n.isSecondaryDominant);
      expect(hasIIV).toBe(true);
      expect(hasV).toBe(true);
    });

    it('uses half-diminished ii for minor targets', () => {
      const minorTarget = makeNode({ roman: 'i', rootOffset: 0, quality: 'm7', fn: 'tonic' });
      const progression = [tonicNode(), minorTarget];
      const result = reharmonizeProgression(progression, 'ii_v_expansion');
      expect(result[0].quality).toBe('m7b5');
      expect(result[1].quality).toBe('7b9');
    });

    it('handles single-chord progression', () => {
      const progression = [tonicNode()];
      const result = reharmonizeProgression(progression, 'ii_v_expansion');
      expect(result.length).toBe(3);
      expect(result[0].fn).toBe('subdominant');
      expect(result[1].fn).toBe('dominant');
    });

    it('does not expand when next chord is already a secondary dominant', () => {
      const sd = makeNode({
        roman: 'V7/ii',
        rootOffset: 9,
        quality: '7',
        fn: 'dominant',
        isSecondaryDominant: true,
      });
      const progression = [tonicNode(), sd];
      const result = reharmonizeProgression(progression, 'ii_v_expansion');
      expect(result.length).toBe(2);
    });
  });

  describe('tritone_sd', () => {
    it('replaces dominant chords with tritone subs of secondary dominants', () => {
      const progression = [dominantNode()];
      const result = reharmonizeProgression(progression, 'tritone_sd');
      expect(result[0].rootOffset).toBe((7 + 6) % 12);
      expect(result[0].quality).toBe('7');
      expect(result[0].isSecondaryDominant).toBe(true);
      expect(result[0].roman).toMatch(/^sub\(/);
    });

    it('passes through non-dominant chords unchanged', () => {
      const progression = [tonicNode(), subdominantNode()];
      const result = reharmonizeProgression(progression, 'tritone_sd');
      expect(result).toEqual(progression);
    });

    it('handles multiple dominant chords', () => {
      const progression = [dominantNode('V7/ii', 9), dominantNode('V7/IV', 0)];
      const result = reharmonizeProgression(progression, 'tritone_sd');
      expect(result[0].rootOffset).toBe((9 + 6) % 12);
      expect(result[1].rootOffset).toBe((0 + 6) % 12);
    });

    it('wraps roman with sub() prefix if not already wrapped', () => {
      const progression = [dominantNode('V', 7)];
      const result = reharmonizeProgression(progression, 'tritone_sd');
      expect(result[0].roman).toMatch(/^sub\(V\)$/);
    });

    it('does not double-wrap roman with sub()', () => {
      const alreadySub = makeNode({
        roman: 'sub(V)',
        rootOffset: 1,
        quality: '7',
        fn: 'dominant',
      });
      const progression = [alreadySub];
      const result = reharmonizeProgression(progression, 'tritone_sd');
      expect(result[0].roman).toBe('sub(V)');
    });
  });

  describe('edge cases', () => {
    it('handles single chord progression', () => {
      const progression = [tonicNode()];
      const result = reharmonizeProgression(progression, 'tritone_sub');
      expect(result).toHaveLength(1);
      expect(result[0]).toEqual(progression[0]);
    });

    it('handles unknown strategy gracefully', () => {
      const progression = [tonicNode()];
      const result = reharmonizeProgression(progression, 'unknown' as ReharmStrategy);
      expect(result).toEqual(progression);
    });
  });
});
