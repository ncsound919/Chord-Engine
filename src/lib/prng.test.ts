import { describe, it, expect, vi } from 'vitest';
import { createPRNG, randomChoice } from './prng';

describe('createPRNG', () => {
  it('returns a function', () => {
    const prng = createPRNG('test');
    expect(typeof prng).toBe('function');
  });

  it('returns values in [0, 1) range', () => {
    const prng = createPRNG('seed');
    for (let i = 0; i < 1000; i++) {
      const v = prng();
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });

  it('same seed produces identical sequence across multiple generators', () => {
    const prng1 = createPRNG('deterministic');
    const prng2 = createPRNG('deterministic');
    const seq1 = Array.from({ length: 50 }, () => prng1());
    const seq2 = Array.from({ length: 50 }, () => prng2());
    expect(seq1).toEqual(seq2);
  });

  it('different seeds produce different sequences', () => {
    const prng1 = createPRNG('seed-a');
    const prng2 = createPRNG('seed-b');
    const seq1 = Array.from({ length: 20 }, () => prng1());
    const seq2 = Array.from({ length: 20 }, () => prng2());
    expect(seq1).not.toEqual(seq2);
  });

  it('empty string seed works', () => {
    const prng = createPRNG('');
    const v = prng();
    expect(v).toBeGreaterThanOrEqual(0);
    expect(v).toBeLessThan(1);
  });

  it('produces deterministic sequence from empty seed', () => {
    const prng1 = createPRNG('');
    const prng2 = createPRNG('');
    const seq1 = Array.from({ length: 10 }, () => prng1());
    const seq2 = Array.from({ length: 10 }, () => prng2());
    expect(seq1).toEqual(seq2);
  });

  it('produces values that are uniformly distributed over many calls', () => {
    const prng = createPRNG('uniformity-test');
    const buckets = new Array(10).fill(0);
    const count = 10000;
    for (let i = 0; i < count; i++) {
      const v = prng();
      const bucket = Math.floor(v * 10);
      if (bucket === 10) buckets[9]++;
      else buckets[bucket]++;
    }
    for (let i = 0; i < 10; i++) {
      expect(buckets[i]).toBeGreaterThan(count / 10 * 0.7);
      expect(buckets[i]).toBeLessThan(count / 10 * 1.3);
    }
  });

  it('produces different values on consecutive calls', () => {
    const prng = createPRNG('consecutive');
    const values = new Set(Array.from({ length: 100 }, () => prng()));
    expect(values.size).toBeGreaterThan(90);
  });
});

describe('randomChoice', () => {
  it('selects correct item based on weight distribution', () => {
    const items = ['a', 'b', 'c'];
    const weights = [100, 0, 0];
    const prng = createPRNG('weighted');
    for (let i = 0; i < 50; i++) {
      expect(randomChoice(items, weights, prng)).toBe('a');
    }
  });

  it('all weight in second item selects that item', () => {
    const items = ['a', 'b', 'c'];
    const weights = [0, 100, 0];
    const prng = createPRNG('weighted2');
    for (let i = 0; i < 50; i++) {
      expect(randomChoice(items, weights, prng)).toBe('b');
    }
  });

  it('throws when items.length !== weights.length', () => {
    const prng = createPRNG('err');
    expect(() => randomChoice(['a', 'b'], [1], prng)).toThrow(
      'items and weights must have the same length',
    );
    expect(() => randomChoice(['a'], [1, 2], prng)).toThrow(
      'items and weights must have the same length',
    );
  });

  it('throws when any weight is negative', () => {
    const prng = createPRNG('neg');
    expect(() => randomChoice(['a', 'b'], [1, -1], prng)).toThrow(
      'weights must be non-negative',
    );
  });

  it('throws when totalWeight is 0', () => {
    const prng = createPRNG('zero');
    expect(() => randomChoice(['a', 'b'], [0, 0], prng)).toThrow(
      'totalWeight must be > 0',
    );
  });

  it('returns last item on floating-point edge case (prng returns ~0.999)', () => {
    const items = ['a', 'b', 'c'];
    const weights = [1, 1, 1];
    const prng = () => 0.9999999;
    const result = randomChoice(items, weights, prng);
    expect(result).toBe('c');
  });

  it('single item returns that item regardless of weight', () => {
    const prng = createPRNG('single');
    expect(randomChoice(['only'], [100], prng)).toBe('only');
    expect(randomChoice(['only'], [0.001], prng)).toBe('only');
  });

  it('with equal weights distributes approximately equally over many calls', () => {
    const items = ['a', 'b', 'c'];
    const weights = [1, 1, 1];
    const prng = createPRNG('equal-dist');
    const counts = { a: 0, b: 0, c: 0 };
    const n = 9000;
    for (let i = 0; i < n; i++) {
      counts[randomChoice(items, weights, prng) as 'a' | 'b' | 'c']++;
    }
    for (const key of Object.keys(counts) as Array<'a' | 'b' | 'c'>) {
      expect(counts[key]).toBeGreaterThan(n / 3 * 0.85);
      expect(counts[key]).toBeLessThan(n / 3 * 1.15);
    }
  });

  it('works with prng returning exactly 0', () => {
    const items = ['x', 'y'];
    const weights = [1, 1];
    const prng = () => 0;
    expect(randomChoice(items, weights, prng)).toBe('x');
  });

  it('works with non-string items', () => {
    const items = [10, 20, 30];
    const weights = [0, 0, 100];
    const prng = createPRNG('nums');
    for (let i = 0; i < 20; i++) {
      expect(randomChoice(items, weights, prng)).toBe(30);
    }
  });

  it('prng returning very small value picks first non-zero weight item', () => {
    const items = ['a', 'b', 'c'];
    const weights = [5, 5, 5];
    const prng = () => 0.0001;
    expect(randomChoice(items, weights, prng)).toBe('a');
  });

  it('skips zero-weight items and picks correct item', () => {
    const items = ['a', 'b', 'c', 'd'];
    const weights = [0, 0, 1, 0];
    const prng = () => 0.5;
    expect(randomChoice(items, weights, prng)).toBe('c');
  });
});
