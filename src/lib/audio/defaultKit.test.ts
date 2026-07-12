import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ensureDefaultDrumKit } from './defaultKit';

vi.mock('./engine', () => ({
  audioEngine: {
    loadSampleFromUrl: vi.fn().mockResolvedValue({}),
    loadedSamples: new Map<string, any>([['Kick', {}]]),
  },
}));

describe('ensureDefaultDrumKit', () => {
  beforeEach(() => {
    const engine = require('./engine').audioEngine;
    engine.loadedSamples = new Map();
    vi.clearAllMocks();
  });

  it('loads bass and drum samples when none are loaded', async () => {
    const { audioEngine } = require('./engine');
    const result = await ensureDefaultDrumKit();
    expect(result).toBe(true);
    expect(audioEngine.loadSampleFromUrl).toHaveBeenCalled();
  });

  it('skips loading if all samples already exist', async () => {
    const { audioEngine } = require('./engine');
    audioEngine.loadedSamples = new Map([
      ['Kick', {}], ['Snare', {}], ['Hi-Hat Closed', {}],
      ['Hi-Hat Open', {}], ['Crash', {}], ['Ride', {}],
      ['Tom 1', {}], ['Tom 2', {}], ['Tom 3', {}], ['bass', {}],
    ]);
    const result = await ensureDefaultDrumKit();
    expect(result).toBe(true);
    // Should not try to re-load anything
    const loadCalls = audioEngine.loadSampleFromUrl.mock.calls.length;
    expect(loadCalls).toBe(0);
  });

  it('handles load failure gracefully', async () => {
    const { audioEngine } = require('./engine');
    audioEngine.loadSampleFromUrl.mockRejectedValue(new Error('fail'));
    const result = await ensureDefaultDrumKit();
    expect(result).toBe(false);
  });
});
