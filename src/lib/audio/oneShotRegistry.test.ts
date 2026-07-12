import { describe, it, expect, vi, beforeEach } from 'vitest';
import { oneShotRegistry, playOneShot, type OneShotSample } from './oneShotRegistry';

const mockConnect = vi.fn();
const mockGainToDb = vi.fn(() => -6);

vi.mock('tone', () => ({
  Gain: vi.fn(() => ({ connect: mockConnect })),
  Player: vi.fn(() => ({
    connect: vi.fn(),
    start: vi.fn(),
    volume: { value: 0 },
  })),
  gainToDb: (v: number) => mockGainToDb(v),
  now: () => 0,
}));

vi.mock('./engine', () => ({
  audioEngine: {
    tracks: new Map([['oneshots', { inputGain: { connect: mockConnect } }]]),
  },
}));

describe('oneShotRegistry', () => {
  beforeEach(() => {
    oneShotRegistry.clear();
  });

  it('registers and retrieves samples', () => {
    const sample: OneShotSample = {
      id: 'test_001',
      name: 'Kick',
      folder: 'drums',
      fileName: 'kick.wav',
      bufferKey: 'kick',
      tags: ['acoustic'],
    };
    oneShotRegistry.register(sample);
    expect(oneShotRegistry.get('test_001')).toBe(sample);
    expect(oneShotRegistry.list()).toHaveLength(1);
  });

  it('lists multiple samples', () => {
    oneShotRegistry.register({ id: 'a', name: 'Kick', folder: '', fileName: 'a.wav', bufferKey: 'a', tags: [] });
    oneShotRegistry.register({ id: 'b', name: 'Snare', folder: '', fileName: 'b.wav', bufferKey: 'b', tags: [] });
    expect(oneShotRegistry.list()).toHaveLength(2);
  });

  it('clears all samples', () => {
    oneShotRegistry.register({ id: 'a', name: 'Kick', folder: '', fileName: 'a.wav', bufferKey: 'a', tags: [] });
    oneShotRegistry.clear();
    expect(oneShotRegistry.list()).toHaveLength(0);
  });

  it('returns undefined for unknown id', () => {
    expect(oneShotRegistry.get('nonexistent')).toBeUndefined();
  });
});

describe('playOneShot', () => {
  it('does not throw when oneshots track exists', () => {
    const buffer = { duration: 1 } as any;
    expect(() => playOneShot(buffer, 0, 1)).not.toThrow();
  });

  it('handles missing oneshots track gracefully', () => {
    const { audioEngine } = require('./engine');
    audioEngine.tracks.delete('oneshots');
    const buffer = { duration: 1 } as any;
    expect(() => playOneShot(buffer, 0, 1)).not.toThrow();
  });
});
