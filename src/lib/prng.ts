/**
 * Mulberry32 PRNG – fast, high‑quality, seedable generator.
 *
 * Converts a string seed to a 32‑bit integer via the djb2a hash, then
 * uses the Mulberry32 algorithm to produce uniformly distributed numbers
 * in the interval [0, 1).
 */
export function createPRNG(seed: string): () => number {
  // djb2a hash: string → 32‑bit integer
  let hash = 5381;
  for (let i = 0; i < seed.length; i++) {
    hash = ((hash << 5) + hash + seed.charCodeAt(i)) | 0;
  }
  let state = hash >>> 0;

  // Mulberry32 core
  return function mulberry32() {
    state |= 0;
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296; // 2^-32
  };
}

/**
 * Weighted random selection.
 *
 * Draws a random value in [0, totalWeight) using `prng` and walks the
 * cumulative weights until it finds the corresponding item.
 *
 * @param items   – candidate items.
 * @param weights – parallel array of non‑negative numbers (must sum to > 0).
 * @param prng    – a deterministic random function returning [0,1).
 * @returns the selected item.
 * @throws if the arrays have different lengths, any weight is negative,
 *         or totalWeight is zero.
 */
export function randomChoice<T>(
  items: T[],
  weights: number[],
  prng: () => number,
): T {
  if (items.length !== weights.length) {
    throw new Error('items and weights must have the same length');
  }
  const totalWeight = weights.reduce((sum, w) => {
    if (w < 0) throw new Error('weights must be non-negative');
    return sum + w;
  }, 0);
  if (totalWeight === 0) {
    throw new Error('totalWeight must be > 0');
  }

  let r = prng() * totalWeight;
  for (let i = 0; i < items.length; i++) {
    r -= weights[i];
    if (r <= 0) {
      return items[i];
    }
  }
  // Floating‑point edge case: return the last item
  return items[items.length - 1];
}
