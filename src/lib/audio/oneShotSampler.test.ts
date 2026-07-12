import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { OneShotSampler, oneShotSampler } from './oneShotSampler';

function makeMockNode(): any {
  const node: any = {
    connect: vi.fn().mockReturnThis(),
    disconnect: vi.fn(),
    dispose: vi.fn(),
    start: vi.fn().mockReturnThis(),
    stop: vi.fn(),
    triggerAttack: vi.fn(),
    triggerRelease: vi.fn(),
    gain: { value: 1, rampTo: vi.fn(), setTargetAtTime: vi.fn() },
    frequency: { value: 440, rampTo: vi.fn(), setValueAtTime: vi.fn() },
    volume: { value: 0, rampTo: vi.fn() },
    duration: 1,
  };
  return node;
}

function MockConstructor(this: any) {
  const node = makeMockNode();
  Object.assign(this, node);
  return node;
}

vi.mock('tone', () => ({
  Player: vi.fn(function (this: any, _buffer?: any) {
    const node = makeMockNode();
    node.buffer = _buffer || { duration: 1 };
    Object.assign(this, node);
    return node;
  }),
  AmplitudeEnvelope: vi.fn(function (this: any, _opts?: any) {
    const node = makeMockNode();
    node.triggerAttack = vi.fn();
    node.triggerRelease = vi.fn();
    node.set = vi.fn();
    Object.assign(this, node);
    return node;
  }),
  Gain: vi.fn(function (this: any, _val?: number) {
    const node = makeMockNode();
    Object.assign(this, node);
    return node;
  }),
  ToneAudioBuffer: vi.fn(() => ({
    load: vi.fn().mockResolvedValue(undefined),
    dispose: vi.fn(),
    duration: 1,
  })),
}));

vi.mock('./engine', () => ({
  audioEngine: {
    ctx: { currentTime: 0 },
    tracks: new Map([
      [
        'oneshots',
        {
          inputGain: {
            connect: vi.fn(),
            disconnect: vi.fn(),
            dispose: vi.fn(),
            gain: { value: 1, rampTo: vi.fn(), setTargetAtTime: vi.fn() },
          },
        },
      ],
    ]),
  },
}));

const mockBuffer = { duration: 0.5 };

function makeSample(overrides: Record<string, any> = {}) {
  return {
    id: 's1',
    name: 'Kick',
    filename: 'kick.wav',
    midiNote: 36,
    buffer: mockBuffer as any,
    ...overrides,
  };
}

describe('OneShotSampler', () => {
  let sampler: OneShotSampler;

  beforeEach(() => {
    vi.clearAllMocks();
    sampler = new OneShotSampler();
  });

  afterEach(() => {
    sampler.dispose();
  });

  describe('constructor default state', () => {
    it('starts with empty loadedSamples', () => {
      expect(sampler.loadedSamples).toEqual([]);
    });

    it('starts with loaded = false', () => {
      expect(sampler.loaded).toBe(false);
    });

    it('has default global values', () => {
      expect(sampler.globalFilterCutoff).toBe(20000);
      expect(sampler.globalFilterRes).toBe(0);
      expect(sampler.globalEnvA).toBe(0.001);
      expect(sampler.globalEnvD).toBe(0.1);
      expect(sampler.globalEnvS).toBe(1);
      expect(sampler.globalEnvR).toBe(0.1);
      expect(sampler.globalVolume).toBe(0.8);
    });
  });

  describe('addSample', () => {
    it('adds a sample and keeps samples sorted by MIDI note', () => {
      sampler.addSample(makeSample({ id: 's2', midiNote: 60 }));
      sampler.addSample(makeSample({ id: 's1', midiNote: 36 }));
      sampler.addSample(makeSample({ id: 's3', midiNote: 48 }));
      expect(sampler.loadedSamples.map(s => s.midiNote)).toEqual([36, 48, 60]);
    });

    it('fills default props when omitted', () => {
      sampler.addSample({
        id: 's1',
        name: 'Kick',
        filename: 'kick.wav',
        midiNote: 36,
        buffer: mockBuffer as any,
      });
      const s = sampler.loadedSamples[0];
      expect(s.gain).toBe(1);
      expect(s.pan).toBe(0);
      expect(s.filterCutoff).toBe(20000);
      expect(s.filterRes).toBe(0);
      expect(s.envAttack).toBe(0.001);
      expect(s.envDecay).toBe(0.1);
      expect(s.envSustain).toBe(1);
      expect(s.envRelease).toBe(0.1);
    });
  });

  describe('autoMapSamples', () => {
    it('maps files across keyboard starting at C1 (MIDI 24)', () => {
      sampler.autoMapSamples([
        { id: 'a', name: 'a', filename: 'a.wav', buffer: mockBuffer as any },
        { id: 'b', name: 'b', filename: 'b.wav', buffer: mockBuffer as any },
        { id: 'c', name: 'c', filename: 'c.wav', buffer: mockBuffer as any },
      ]);
      expect(sampler.loadedSamples).toHaveLength(3);
      expect(sampler.loadedSamples[0].midiNote).toBe(24);
      expect(sampler.loadedSamples[1].midiNote).toBe(25);
      expect(sampler.loadedSamples[2].midiNote).toBe(26);
    });
  });

  describe('triggerNote', () => {
    it('triggers note with various midi values', () => {
      sampler.addSample(makeSample({ id: 's1', midiNote: 36 }));
      expect(() => sampler.triggerNote(36)).not.toThrow();
      expect(() => sampler.triggerNote(60)).not.toThrow();
      expect(() => sampler.triggerNote(100)).not.toThrow();
    });

    it('returns gracefully when no buffer exists', () => {
      sampler.addSample(makeSample({ id: 's1', midiNote: 36, buffer: null }));
      expect(() => sampler.triggerNote(36)).not.toThrow();
    });

    it('returns gracefully when no samples loaded', () => {
      expect(() => sampler.triggerNote(60)).not.toThrow();
    });

  });

  describe('updateSample', () => {
    it('updates props at valid index', () => {
      sampler.addSample(makeSample({ id: 's1', midiNote: 36 }));
      sampler.updateSample(0, { gain: 0.5, pan: -0.5 });
      expect(sampler.loadedSamples[0].gain).toBe(0.5);
      expect(sampler.loadedSamples[0].pan).toBe(-0.5);
    });

    it('no-ops on negative index', () => {
      sampler.addSample(makeSample({ id: 's1', midiNote: 36 }));
      sampler.updateSample(-1, { gain: 0.5 });
      expect(sampler.loadedSamples[0].gain).toBe(1);
    });

    it('no-ops on out-of-bounds index', () => {
      sampler.addSample(makeSample({ id: 's1', midiNote: 36 }));
      sampler.updateSample(5, { gain: 0.5 });
      expect(sampler.loadedSamples[0].gain).toBe(1);
    });
  });

  describe('removeSample', () => {
    it('removes sample at valid index', () => {
      sampler.addSample(makeSample({ id: 's1', midiNote: 36 }));
      sampler.addSample(makeSample({ id: 's2', midiNote: 48 }));
      sampler.removeSample(0);
      expect(sampler.loadedSamples).toHaveLength(1);
      expect(sampler.loadedSamples[0].id).toBe('s2');
    });

    it('no-ops on negative index', () => {
      sampler.addSample(makeSample({ id: 's1', midiNote: 36 }));
      sampler.removeSample(-1);
      expect(sampler.loadedSamples).toHaveLength(1);
    });

    it('no-ops on out-of-bounds index', () => {
      sampler.addSample(makeSample({ id: 's1', midiNote: 36 }));
      sampler.removeSample(5);
      expect(sampler.loadedSamples).toHaveLength(1);
    });
  });

  describe('presets', () => {
    it('savePreset creates preset with current state', () => {
      sampler.addSample(makeSample({ id: 's1', midiNote: 36 }));
      sampler.globalVolume = 0.5;
      const preset = sampler.savePreset('MyPreset');
      expect(preset.name).toBe('MyPreset');
      expect(preset.samples).toHaveLength(1);
      expect(preset.samples[0].id).toBe('s1');
      expect(preset.globalVolume).toBe(0.5);
    });

    it('loadPreset restores state', () => {
      sampler.addSample(makeSample({ id: 's1', midiNote: 36 }));
      const preset = sampler.savePreset('MyPreset');
      sampler.addSample(makeSample({ id: 's2', midiNote: 48 }));
      expect(sampler.loadedSamples).toHaveLength(2);
      sampler.loadPreset(preset);
      expect(sampler.loadedSamples).toHaveLength(1);
      expect(sampler.loadedSamples[0].id).toBe('s1');
      expect(sampler.loadedSamples[0].buffer).toBeNull();
    });

    it('deletePreset removes by id', () => {
      const preset = sampler.savePreset('P1');
      sampler.savePreset('P2');
      expect(sampler.getPresets()).toHaveLength(2);
      sampler.deletePreset(preset.id);
      expect(sampler.getPresets()).toHaveLength(1);
    });

    it('loadPreset restores global values', () => {
      const preset = sampler.savePreset('P1');
      sampler.globalVolume = 0.2;
      sampler.globalFilterCutoff = 1000;
      sampler.loadPreset(preset);
      expect(sampler.globalVolume).toBe(0.8);
      expect(sampler.globalFilterCutoff).toBe(20000);
    });

    it('deletePreset ignores non-existent id', () => {
      sampler.savePreset('P1');
      sampler.deletePreset('nonexistent');
      expect(sampler.getPresets()).toHaveLength(1);
    });
  });

  describe('clear', () => {
    it('clears all samples', () => {
      sampler.addSample(makeSample({ id: 's1', midiNote: 36 }));
      sampler.addSample(makeSample({ id: 's2', midiNote: 48 }));
      sampler.clear();
      expect(sampler.loadedSamples).toHaveLength(0);
      expect(sampler.loaded).toBe(false);
    });
  });

  describe('releaseAll', () => {
    it('does not throw when no active players', () => {
      expect(() => sampler.releaseAll()).not.toThrow();
    });

    it('releases active players without error', () => {
      sampler.addSample(makeSample({ id: 's1', midiNote: 36 }));
      sampler.triggerNote(36);
      expect(() => sampler.releaseAll()).not.toThrow();
    });
  });

  describe('dispose', () => {
    it('cleans up and clears state', () => {
      sampler.addSample(makeSample({ id: 's1', midiNote: 36 }));
      sampler.savePreset('P1');
      sampler.dispose();
      expect(sampler.loadedSamples).toHaveLength(0);
      expect(sampler.getPresets()).toHaveLength(0);
    });
  });

  describe('findClosest', () => {
    it('finds nearest MIDI note', () => {
      sampler.addSample(makeSample({ id: 's1', midiNote: 36 }));
      sampler.addSample(makeSample({ id: 's2', midiNote: 48 }));
      sampler.addSample(makeSample({ id: 's3', midiNote: 60 }));
      const closest = (sampler as any).findClosest(50);
      expect(closest.id).toBe('s2');
    });

    it('returns null when empty', () => {
      const closest = (sampler as any).findClosest(50);
      expect(closest).toBeNull();
    });
  });

  describe('lifecycle', () => {
    it('multiple save/load/dispose cycles work', () => {
      sampler.addSample(makeSample({ id: 's1', midiNote: 36 }));
      const p1 = sampler.savePreset('P1');
      sampler.clear();
      sampler.loadPreset(p1);
      expect(sampler.loadedSamples).toHaveLength(1);
      sampler.addSample(makeSample({ id: 's2', midiNote: 48 }));
      const p2 = sampler.savePreset('P2');
      expect(sampler.getPresets()).toHaveLength(2);
      sampler.dispose();
      expect(sampler.loadedSamples).toHaveLength(0);
      expect(sampler.getPresets()).toHaveLength(0);
    });
  });
});
