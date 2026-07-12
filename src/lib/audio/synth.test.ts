import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { Ju60Params, ArpMode } from './synth';
import { Ju60Engine, Ju60Voice, Ju60Arpeggiator, type ArpMode } from './synth';

vi.mock('./engine', () => ({
  audioEngine: {
    tracks: new Map([
      [
        'test-track',
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

function makeMockNode(): any {
  const node: any = {
    connect: vi.fn().mockReturnThis(),
    disconnect: vi.fn(),
    dispose: vi.fn(),
    start: vi.fn().mockReturnThis(),
    stop: vi.fn(),
    frequency: {
      value: 1000,
      rampTo: vi.fn(),
      linearRampToValueAtTime: vi.fn(),
      exponentialRampToValueAtTime: vi.fn(),
      cancelScheduledValues: vi.fn(),
      setValueAtTime: vi.fn(),
      setTargetAtTime: vi.fn(),
      connect: vi.fn().mockReturnThis(),
    },
    gain: {
      value: 1,
      rampTo: vi.fn(),
      linearRampToValueAtTime: vi.fn(),
      setTargetAtTime: vi.fn(),
      cancelScheduledValues: vi.fn(),
      setValueAtTime: vi.fn(),
      connect: vi.fn().mockReturnThis(),
    },
    Q: { value: 1 },
    wet: { value: 1, rampTo: vi.fn() },
    depth: 0.4,
    width: { value: 0.5, rampTo: vi.fn(), setValueAtTime: vi.fn(), connect: vi.fn().mockReturnThis() },
    detune: { value: 0, connect: vi.fn().mockReturnThis() },
    type: 'lowpass',
    curve: null,
    set: vi.fn(),
    attack: vi.fn(),
    release: vi.fn(),
    cancel: vi.fn(),
    volume: {
      value: 0,
      rampTo: vi.fn(),
      setTargetAtTime: vi.fn(),
    },
  };
  return node;
}

function MockConstructor(this: any) {
  const node = makeMockNode();
  Object.assign(this, node);
  return node;
}

vi.mock('tone', () => {
  const mockedTransport = {
    state: 'stopped',
    bpm: { value: 85 },
    scheduleRepeat: vi.fn(() => 'mock-event-id'),
    scheduleOnce: vi.fn(),
    start: vi.fn(),
    stop: vi.fn(),
    cancel: vi.fn(),
    clear: vi.fn(),
    seconds: 0,
    position: '0:0:0',
    timeSignature: 4,
  };

  return {
    now: vi.fn(() => 0),
    gainToDb: vi.fn((v: number) => (v <= 0 ? -100 : 20 * Math.log10(v))),
    Frequency: vi.fn(() => ({
      toFrequency: vi.fn(() => 440),
      toMidi: vi.fn(() => 69),
    })),
    getDestination: vi.fn(() => makeMockNode()),
    getTransport: vi.fn(() => mockedTransport),
    Transport: mockedTransport,
    Oscillator: MockConstructor,
    PulseOscillator: MockConstructor,
    Noise: MockConstructor,
    Filter: MockConstructor,
    Gain: MockConstructor,
    Chorus: vi.fn(function (this: any, _opts?: any) {
      const node = makeMockNode();
      node.wet = { value: 0, rampTo: vi.fn(), setTargetAtTime: vi.fn() };
      node.frequency = { value: 1.5, rampTo: vi.fn(), setTargetAtTime: vi.fn() };
      node.depth = 0.4;
      node.start = vi.fn().mockReturnThis();
      Object.assign(this, node);
      return node;
    }),
    LFO: vi.fn(function (this: any) {
      const node = makeMockNode();
      node.start = vi.fn().mockReturnThis();
      Object.assign(this, node);
      return node;
    }),
    AmplitudeEnvelope: vi.fn(function (this: any) {
      const node = makeMockNode();
      node.triggerAttack = vi.fn();
      node.triggerRelease = vi.fn();
      node.cancel = vi.fn();
      Object.assign(this, node);
      return node;
    }),
    Envelope: vi.fn(function (this: any) {
      const node = makeMockNode();
      node.triggerAttack = vi.fn();
      node.triggerRelease = vi.fn();
      node.cancel = vi.fn();
      Object.assign(this, node);
      return node;
    }),
    Volume: MockConstructor,
    Limiter: MockConstructor,
    WaveShaper: MockConstructor,
    Reverb: MockConstructor,
    Panner: MockConstructor,
    EQ3: MockConstructor,
    MembraneSynth: MockConstructor,
    NoiseSynth: MockConstructor,
    MetalSynth: MockConstructor,
    Player: MockConstructor,
    ToneAudioBuffer: vi.fn(() => ({
      load: vi.fn().mockResolvedValue(undefined),
      dispose: vi.fn(),
      duration: 1,
    })),
  };
});

const defaultPatch: Ju60Params = {
  vcfCutoff: 75,
  vcfRes: 20,
  envA: 5,
  envD: 30,
  envS: 60,
  envR: 40,
  chorus: 'OFF',
  vcaLevel: 80,
  dcoRange: '8\'',
  vcaMode: 'ENV',
  lfoRate: 50,
  lfoDelay: 0,
  dcoLfo: 20,
  dcoPwm: 30,
  dcoPwmSrc: 'LFO',
  dcoPulse: true,
  dcoSaw: true,
  dcoSub: 40,
  dcoNoise: 0,
  vcfEnv: 50,
  vcfLfo: 10,
  vcfKeyFollow: 30,
  vcfPolarity: '+',
  voiceMode: 'POLY',
  unisonDetune: 0,
};

function resetSingleton() {
  Ju60Engine.resetInstance();
}

describe('Ju60Engine', () => {
  let engine: Ju60Engine;

  beforeEach(() => {
    resetSingleton();
    engine = Ju60Engine.getInstance();
  });

  afterEach(() => {
    engine.dispose();
    resetSingleton();
  });

  describe('getInstance', () => {
    it('returns a singleton', () => {
      const a = Ju60Engine.getInstance();
      const b = Ju60Engine.getInstance();
      expect(a).toBe(b);
    });

    it('returns an instance of Ju60Engine', () => {
      expect(engine).toBeInstanceOf(Ju60Engine);
    });
  });

  describe('setupChannel', () => {
    it('creates a channel that can be queried', () => {
      engine.setupChannel('ch1', 'test-track', defaultPatch);
      expect(engine.getPatch('ch1')).toBeDefined();
      expect(engine.getPatch('ch1')?.vcfCutoff).toBe(75);
    });

    it('overwrites an existing channel with the same id', () => {
      engine.setupChannel('ch1', 'test-track', defaultPatch);
      const firstPatch = engine.getPatch('ch1');

      const modified = { ...defaultPatch, vcfCutoff: 30 };
      engine.setupChannel('ch1', 'test-track', modified);
      const secondPatch = engine.getPatch('ch1');

      expect(secondPatch?.vcfCutoff).toBe(30);
      expect(firstPatch).not.toBe(secondPatch);
    });
  });

  describe('disposeChannel', () => {
    it('removes a channel', () => {
      engine.setupChannel('ch1', 'test-track', defaultPatch);
      expect(engine.getPatch('ch1')).toBeDefined();

      engine.disposeChannel('ch1');
      expect(engine.getPatch('ch1')).toBeUndefined();
    });

    it('is a no-op for a non-existent channel', () => {
      expect(() => engine.disposeChannel('nope')).not.toThrow();
    });
  });

  describe('updatePatch', () => {
    it('updates a channel patch and returns the new values', () => {
      engine.setupChannel('ch1', 'test-track', defaultPatch);
      engine.updatePatch('ch1', { vcfCutoff: 10 });

      expect(engine.getPatch('ch1')?.vcfCutoff).toBe(10);
    });

    it('clamps out-of-range values', () => {
      engine.setupChannel('ch1', 'test-track', defaultPatch);
      engine.updatePatch('ch1', { vcfCutoff: 200 });

      expect(engine.getPatch('ch1')?.vcfCutoff).toBe(100);
    });

    it('does nothing for a non-existent channel', () => {
      expect(() => engine.updatePatch('nope', { vcfCutoff: 10 })).not.toThrow();
    });

    it('notifies listeners on update', () => {
      engine.setupChannel('ch1', 'test-track', defaultPatch);
      const listener = vi.fn();
      engine.onPatchUpdate(listener);

      engine.updatePatch('ch1', { vcfCutoff: 55 });

      expect(listener).toHaveBeenCalledTimes(1);
      expect(listener).toHaveBeenCalledWith('ch1', expect.objectContaining({ vcfCutoff: 55 }));
    });
  });

  describe('triggerNote', () => {
    it('triggers note on then off without throwing', () => {
      engine.setupChannel('ch1', 'test-track', defaultPatch);
      expect(() => engine.triggerNote('ch1', 60, 0.8, 0, 0.1)).not.toThrow();
    });

    it('is a no-op for a non-existent channel', () => {
      expect(() => engine.triggerNote('nope', 60)).not.toThrow();
    });
  });

  describe('triggerNoteOn / triggerNoteOff', () => {
    it('triggers note on without error', () => {
      engine.setupChannel('ch1', 'test-track', defaultPatch);
      expect(() => engine.triggerNoteOn('ch1', 60, 0)).not.toThrow();
    });

    it('triggers note off without error', () => {
      engine.setupChannel('ch1', 'test-track', defaultPatch);
      engine.triggerNoteOn('ch1', 60, 0);
      expect(() => engine.triggerNoteOff('ch1', 60, 0.5)).not.toThrow();
    });

    it('is a no-op for a non-existent channel', () => {
      expect(() => engine.triggerNoteOn('nope', 60)).not.toThrow();
      expect(() => engine.triggerNoteOff('nope', 60)).not.toThrow();
    });
  });

  describe('allNotesOff', () => {
    it('releases all notes on all channels', () => {
      engine.setupChannel('ch1', 'test-track', defaultPatch);
      engine.setupChannel('ch2', 'test-track', defaultPatch);
      engine.triggerNoteOn('ch1', 60, 0);
      engine.triggerNoteOn('ch2', 67, 0);

      expect(() => engine.allNotesOff()).not.toThrow();
    });

    it('is a no-op when no channels exist', () => {
      expect(() => engine.allNotesOff()).not.toThrow();
    });
  });

  describe('getPatch / getAllPatches', () => {
    it('returns undefined for a non-existent channel', () => {
      expect(engine.getPatch('nope')).toBeUndefined();
    });

    it('returns the patch for an existing channel', () => {
      engine.setupChannel('ch1', 'test-track', defaultPatch);
      expect(engine.getPatch('ch1')).toEqual(expect.objectContaining({ vcfCutoff: 75 }));
    });

    it('returns all patches as a record', () => {
      engine.setupChannel('ch1', 'test-track', defaultPatch);
      engine.setupChannel('ch2', 'test-track', { ...defaultPatch, vcfCutoff: 10 });

      const all = engine.getAllPatches();
      expect(Object.keys(all)).toEqual(expect.arrayContaining(['ch1', 'ch2']));
      expect(all.ch1.vcfCutoff).toBe(75);
      expect(all.ch2.vcfCutoff).toBe(10);
    });

    it('returns the 3 default channels (lead, pad, bass) on getInstance', () => {
      // After the no-sound fix, getInstance() auto-creates default channels.
      // So getAllPatches() returns them by default, not an empty object.
      const all = engine.getAllPatches();
      expect(Object.keys(all)).toEqual(expect.arrayContaining(['lead', 'pad', 'bass']));
      expect(Object.keys(all)).toHaveLength(3);
    });

    it('after dispose, getAllPatches returns empty object', () => {
      engine.dispose();
      expect(engine.getAllPatches()).toEqual({});
    });
  });

  describe('onPatchUpdate', () => {
    it('registers a listener and returns an unsubscribe function', () => {
      const listener = vi.fn();
      const unsub = engine.onPatchUpdate(listener);

      engine.setupChannel('ch1', 'test-track', defaultPatch);
      engine.updatePatch('ch1', { vcfCutoff: 42 });
      expect(listener).toHaveBeenCalledTimes(1);

      unsub();
      engine.updatePatch('ch1', { vcfCutoff: 99 });
      expect(listener).toHaveBeenCalledTimes(1);
    });

    it('supports multiple listeners', () => {
      const a = vi.fn();
      const b = vi.fn();
      engine.onPatchUpdate(a);
      engine.onPatchUpdate(b);

      engine.setupChannel('ch1', 'test-track', defaultPatch);
      engine.updatePatch('ch1', { vcfCutoff: 50 });

      expect(a).toHaveBeenCalledTimes(1);
      expect(b).toHaveBeenCalledTimes(1);
    });
  });

  describe('dispose', () => {
    it('cleans up all channels', () => {
      engine.setupChannel('ch1', 'test-track', defaultPatch);
      engine.setupChannel('ch2', 'test-track', defaultPatch);
      engine.dispose();

      expect(engine.getPatch('ch1')).toBeUndefined();
      expect(engine.getPatch('ch2')).toBeUndefined();
      expect(Object.keys(engine.getAllPatches())).toHaveLength(0);
    });

    it('is safe to call multiple times', () => {
      engine.setupChannel('ch1', 'test-track', defaultPatch);
      expect(() => {
        engine.dispose();
        engine.dispose();
      }).not.toThrow();
    });
  });
});

describe('Ju60Channel (via engine)', () => {
  let engine: Ju60Engine;

  beforeEach(() => {
    resetSingleton();
    engine = Ju60Engine.getInstance();
  });

  afterEach(() => {
    engine.dispose();
    resetSingleton();
  });

  describe('triggerNoteOn MONO mode', () => {
    it('reuses voice[0] for all notes', () => {
      engine.setupChannel('mono', 'test-track', {
        ...defaultPatch,
        voiceMode: 'MONO',
      });
      engine.triggerNoteOn('mono', 60, 0);
      engine.triggerNoteOn('mono', 64, 0.1);

      const patch = engine.getPatch('mono');
      expect(patch?.voiceMode).toBe('MONO');
    });
  });

  describe('triggerNoteOff MONO mode', () => {
    it('releases only the active voice', () => {
      engine.setupChannel('mono', 'test-track', {
        ...defaultPatch,
        voiceMode: 'MONO',
      });
      engine.triggerNoteOn('mono', 60, 0);
      expect(() => engine.triggerNoteOff('mono', 60, 0.5)).not.toThrow();
    });

    it('ignores release for a different midi than active', () => {
      engine.setupChannel('mono', 'test-track', {
        ...defaultPatch,
        voiceMode: 'MONO',
      });
      engine.triggerNoteOn('mono', 60, 0);
      expect(() => engine.triggerNoteOff('mono', 64, 0.5)).not.toThrow();
    });
  });

  describe('applyChorusMode', () => {
    it.each(['OFF', 'I', 'II', 'BOTH'] as const)(
      'applies chorus mode %s without error',
      (mode) => {
        engine.setupChannel('ch', 'test-track', {
          ...defaultPatch,
          chorus: mode,
        });
        engine.updatePatch('ch', { chorus: mode });
        expect(engine.getPatch('ch')?.chorus).toBe(mode);
      },
    );
  });

  describe('releaseAll', () => {
    it('releases all active voices', () => {
      engine.setupChannel('ch', 'test-track', defaultPatch);
      engine.triggerNoteOn('ch', 60, 0);
      engine.triggerNoteOn('ch', 64, 0);
      engine.triggerNoteOn('ch', 67, 0);

      expect(() => engine.allNotesOff()).not.toThrow();
    });
  });

  describe('voice stealing', () => {
    it('steals the oldest voice when all are active', () => {
      engine.setupChannel('ch', 'test-track', defaultPatch);

      for (let i = 0; i < 8; i++) {
        engine.triggerNoteOn('ch', 48 + i, i * 0.01);
      }

      expect(() => engine.triggerNoteOn('ch', 72, 0.1)).not.toThrow();
    });
  });
});

describe('Ju60Voice', () => {
  let engine: Ju60Engine;

  beforeEach(() => {
    resetSingleton();
    engine = Ju60Engine.getInstance();
  });

  afterEach(() => {
    engine.dispose();
    resetSingleton();
  });

  describe('triggerAttack', () => {
    it('triggers attack on a voice without error', () => {
      engine.setupChannel('ch', 'test-track', defaultPatch);
      expect(() => engine.triggerNoteOn('ch', 60, 0)).not.toThrow();
    });

    it('handles GATE vcaMode', () => {
      engine.setupChannel('ch', 'test-track', {
        ...defaultPatch,
        vcaMode: 'GATE',
      });
      expect(() => engine.triggerNoteOn('ch', 60, 0)).not.toThrow();
    });

    it('handles UNISON voiceMode', () => {
      engine.setupChannel('ch', 'test-track', {
        ...defaultPatch,
        voiceMode: 'UNISON',
        unisonDetune: 15,
      });
      expect(() => engine.triggerNoteOn('ch', 60, 0)).not.toThrow();
    });

    it('handles different dcoRange values', () => {
      for (const range of ['16\'', '8\'', '4\''] as const) {
        engine.setupChannel('ch', 'test-track', {
          ...defaultPatch,
          dcoRange: range,
        });
        expect(() => engine.triggerNoteOn('ch', 60, 0)).not.toThrow();
      }
    });

    it('handles lfoDelay > 0', () => {
      engine.setupChannel('ch', 'test-track', {
        ...defaultPatch,
        lfoDelay: 200,
      });
      expect(() => engine.triggerNoteOn('ch', 60, 0)).not.toThrow();
    });

    it('handles all dcoPwmSrc modes', () => {
      for (const src of ['LFO', 'ENV', 'MANUAL'] as const) {
        engine.setupChannel('ch', 'test-track', {
          ...defaultPatch,
          dcoPwmSrc: src,
        });
        expect(() => engine.triggerNoteOn('ch', 60, 0)).not.toThrow();
      }
    });
  });

  describe('triggerRelease', () => {
    it('releases a triggered voice', () => {
      engine.setupChannel('ch', 'test-track', defaultPatch);
      engine.triggerNoteOn('ch', 60, 0);
      expect(() => engine.triggerNoteOff('ch', 60, 0.5)).not.toThrow();
    });
  });

  describe('steal', () => {
    it('steals a voice by triggering note off then on', () => {
      engine.setupChannel('ch', 'test-track', defaultPatch);
      engine.triggerNoteOn('ch', 60, 0);
      expect(() => engine.triggerNoteOn('ch', 60, 0)).not.toThrow();
    });
  });

  describe('dispose', () => {
    it('disposes all nodes via engine dispose', () => {
      engine.setupChannel('ch', 'test-track', defaultPatch);
      expect(() => engine.dispose()).not.toThrow();
    });
  });

  describe('patch getter/setter', () => {
    it('returns the sanitized patch', () => {
      engine.setupChannel('ch', 'test-track', defaultPatch);
      const patch = engine.getPatch('ch');
      expect(patch).toBeDefined();
      expect(patch?.vcfCutoff).toBe(75);
    });

    it('updates patch via updatePatch', () => {
      engine.setupChannel('ch', 'test-track', defaultPatch);
      engine.updatePatch('ch', { vcfRes: 90 });
      expect(engine.getPatch('ch')?.vcfRes).toBe(90);
    });
  });
});

describe('sanitizePatch (behavioral tests)', () => {
  let engine: Ju60Engine;

  beforeEach(() => {
    resetSingleton();
    engine = Ju60Engine.getInstance();
  });

  afterEach(() => {
    engine.dispose();
    resetSingleton();
  });

  it('clamps vcfCutoff to [0, 100]', () => {
    engine.setupChannel('ch', 'test-track', { ...defaultPatch, vcfCutoff: -10 });
    expect(engine.getPatch('ch')?.vcfCutoff).toBe(0);

    engine.updatePatch('ch', { vcfCutoff: 999 });
    expect(engine.getPatch('ch')?.vcfCutoff).toBe(100);
  });

  it('clamps vcfRes to [0, 100]', () => {
    engine.setupChannel('ch', 'test-track', { ...defaultPatch, vcfRes: -5 });
    expect(engine.getPatch('ch')?.vcfRes).toBe(0);

    engine.updatePatch('ch', { vcfRes: 150 });
    expect(engine.getPatch('ch')?.vcfRes).toBe(100);
  });

  it('clamps envA to [0, 100]', () => {
    engine.setupChannel('ch', 'test-track', { ...defaultPatch, envA: -20 });
    expect(engine.getPatch('ch')?.envA).toBe(0);

    engine.updatePatch('ch', { envA: 200 });
    expect(engine.getPatch('ch')?.envA).toBe(100);
  });

  it('clamps envD to [0, 100]', () => {
    engine.setupChannel('ch', 'test-track', { ...defaultPatch, envD: -10 });
    expect(engine.getPatch('ch')?.envD).toBe(0);
  });

  it('clamps envS to [0, 100]', () => {
    engine.setupChannel('ch', 'test-track', { ...defaultPatch, envS: -5 });
    expect(engine.getPatch('ch')?.envS).toBe(0);
  });

  it('clamps envR to [0, 100]', () => {
    engine.setupChannel('ch', 'test-track', { ...defaultPatch, envR: -5 });
    expect(engine.getPatch('ch')?.envR).toBe(0);
  });

  it('clamps vcaLevel to [0, 100]', () => {
    engine.setupChannel('ch', 'test-track', { ...defaultPatch, vcaLevel: -10 });
    expect(engine.getPatch('ch')?.vcaLevel).toBe(0);

    engine.updatePatch('ch', { vcaLevel: 200 });
    expect(engine.getPatch('ch')?.vcaLevel).toBe(100);
  });

  it('clamps dcoSub to [0, 100]', () => {
    engine.setupChannel('ch', 'test-track', { ...defaultPatch, dcoSub: -5 });
    expect(engine.getPatch('ch')?.dcoSub).toBe(0);
  });

  it('clamps dcoNoise to [0, 100]', () => {
    engine.setupChannel('ch', 'test-track', { ...defaultPatch, dcoNoise: -5 });
    expect(engine.getPatch('ch')?.dcoNoise).toBe(0);
  });

  it('clamps dcoLfo to [0, 100]', () => {
    engine.setupChannel('ch', 'test-track', { ...defaultPatch, dcoLfo: -5 });
    expect(engine.getPatch('ch')?.dcoLfo).toBe(0);
  });

  it('clamps dcoPwm to [0, 100]', () => {
    engine.setupChannel('ch', 'test-track', { ...defaultPatch, dcoPwm: -5 });
    expect(engine.getPatch('ch')?.dcoPwm).toBe(0);
  });

  it('clamps vcfEnv to [0, 100]', () => {
    engine.setupChannel('ch', 'test-track', { ...defaultPatch, vcfEnv: -5 });
    expect(engine.getPatch('ch')?.vcfEnv).toBe(0);
  });

  it('clamps vcfLfo to [0, 100]', () => {
    engine.setupChannel('ch', 'test-track', { ...defaultPatch, vcfLfo: -5 });
    expect(engine.getPatch('ch')?.vcfLfo).toBe(0);
  });

  it('clamps vcfKeyFollow to [0, 100]', () => {
    engine.setupChannel('ch', 'test-track', { ...defaultPatch, vcfKeyFollow: -5 });
    expect(engine.getPatch('ch')?.vcfKeyFollow).toBe(0);
  });

  it('clamps unisonDetune to [0, 100]', () => {
    engine.setupChannel('ch', 'test-track', { ...defaultPatch, unisonDetune: -5 });
    expect(engine.getPatch('ch')?.unisonDetune).toBe(0);
  });

  it('clamps hpfFreq to [0, 3]', () => {
    engine.setupChannel('ch', 'test-track', { ...defaultPatch, hpfFreq: -1 });
    expect(engine.getPatch('ch')?.hpfFreq).toBe(0);

    engine.updatePatch('ch', { hpfFreq: 10 });
    expect(engine.getPatch('ch')?.hpfFreq).toBe(3);
  });

  it('defaults hpfFreq to 1 when undefined', () => {
    engine.setupChannel('ch', 'test-track', { ...defaultPatch, hpfFreq: undefined });
    expect(engine.getPatch('ch')?.hpfFreq).toBe(1);
  });

  it('clamps filterDrive to [0, 100] with default 15', () => {
    engine.setupChannel('ch', 'test-track', { ...defaultPatch, filterDrive: -5 });
    expect(engine.getPatch('ch')?.filterDrive).toBe(0);

    engine.updatePatch('ch', { filterDrive: 150 });
    expect(engine.getPatch('ch')?.filterDrive).toBe(100);
  });

  it('clamps outputSat to [0, 100] with default 10', () => {
    engine.setupChannel('ch', 'test-track', { ...defaultPatch, outputSat: -5 });
    expect(engine.getPatch('ch')?.outputSat).toBe(0);

    engine.updatePatch('ch', { outputSat: 150 });
    expect(engine.getPatch('ch')?.outputSat).toBe(100);
  });
});

describe('Edge cases', () => {
  let engine: Ju60Engine;

  beforeEach(() => {
    resetSingleton();
    engine = Ju60Engine.getInstance();
  });

  afterEach(() => {
    engine.dispose();
    resetSingleton();
  });

  it('handles empty patch id gracefully', () => {
    engine.setupChannel('', 'test-track', defaultPatch);
    expect(engine.getPatch('')).toBeDefined();
    engine.triggerNoteOn('', 60, 0);
    expect(() => engine.triggerNoteOff('', 60, 0.5)).not.toThrow();
  });

  it('handles very low velocity', () => {
    engine.setupChannel('ch', 'test-track', defaultPatch);
    expect(() => engine.triggerNoteOn('ch', 60, 0, 0)).not.toThrow();
  });

  it('handles velocity of 0', () => {
    engine.setupChannel('ch', 'test-track', defaultPatch);
    expect(() => engine.triggerNoteOn('ch', 60, 0, 0)).not.toThrow();
  });

  it('handles extreme MIDI values', () => {
    engine.setupChannel('ch', 'test-track', defaultPatch);
    expect(() => engine.triggerNoteOn('ch', 0, 0)).not.toThrow();
    expect(() => engine.triggerNoteOn('ch', 127, 0)).not.toThrow();
  });

  it('handles setupChannel after dispose', () => {
    engine.setupChannel('ch', 'test-track', defaultPatch);
    engine.dispose();
    engine.setupChannel('ch', 'test-track', defaultPatch);
    expect(engine.getPatch('ch')).toBeDefined();
  });

  it('handles updatePatch on channel after dispose', () => {
    engine.setupChannel('ch', 'test-track', defaultPatch);
    engine.dispose();
    expect(() => engine.updatePatch('ch', { vcfCutoff: 50 })).not.toThrow();
  });

  it('handles allNotesOff after dispose', () => {
    engine.setupChannel('ch', 'test-track', defaultPatch);
    engine.dispose();
    expect(() => engine.allNotesOff()).not.toThrow();
  });

  it('handles GATE mode trigger and release', () => {
    engine.setupChannel('ch', 'test-track', {
      ...defaultPatch,
      vcaMode: 'GATE',
    });
    engine.triggerNoteOn('ch', 60, 0);
    expect(() => engine.triggerNoteOff('ch', 60, 0.5)).not.toThrow();
  });

  it('handles all chorus modes via updatePatch', () => {
    engine.setupChannel('ch', 'test-track', defaultPatch);
    for (const mode of ['OFF', 'I', 'II', 'BOTH'] as const) {
      engine.updatePatch('ch', { chorus: mode });
      expect(engine.getPatch('ch')?.chorus).toBe(mode);
    }
  });

  it('preserves non-updated patch fields', () => {
    engine.setupChannel('ch', 'test-track', defaultPatch);
    engine.updatePatch('ch', { vcfCutoff: 10 });

    const patch = engine.getPatch('ch');
    expect(patch?.vcfRes).toBe(20);
    expect(patch?.envA).toBe(5);
    expect(patch?.chorus).toBe('OFF');
  });

  it('defaults arpMode to OFF', () => {
    engine.setupChannel('ch', 'test-track', defaultPatch);
    expect(engine.getPatch('ch')?.arpMode).toBe('OFF');
  });

  it('defaults portamento to 0', () => {
    engine.setupChannel('ch', 'test-track', defaultPatch);
    expect(engine.getPatch('ch')?.portamento).toBe(0);
  });

  it('clamps arpRate to [0, 100]', () => {
    engine.setupChannel('ch', 'test-track', { ...defaultPatch, arpRate: -10 });
    expect(engine.getPatch('ch')?.arpRate).toBe(0);

    engine.updatePatch('ch', { arpRate: 200 });
    expect(engine.getPatch('ch')?.arpRate).toBe(100);
  });

  it('clamps arpOctaveRange to [0, 2]', () => {
    engine.setupChannel('ch', 'test-track', { ...defaultPatch, arpOctaveRange: -1 });
    expect(engine.getPatch('ch')?.arpOctaveRange).toBe(0);

    engine.updatePatch('ch', { arpOctaveRange: 5 });
    expect(engine.getPatch('ch')?.arpOctaveRange).toBe(2);
  });

  it('clamps arpGate to [0, 100]', () => {
    engine.setupChannel('ch', 'test-track', { ...defaultPatch, arpGate: -5 });
    expect(engine.getPatch('ch')?.arpGate).toBe(0);

    engine.updatePatch('ch', { arpGate: 150 });
    expect(engine.getPatch('ch')?.arpGate).toBe(100);
  });

  it('clamps portamento to [0, 100]', () => {
    engine.setupChannel('ch', 'test-track', { ...defaultPatch, portamento: -5 });
    expect(engine.getPatch('ch')?.portamento).toBe(0);

    engine.updatePatch('ch', { portamento: 200 });
    expect(engine.getPatch('ch')?.portamento).toBe(100);
  });

  it('defaults legato to false', () => {
    engine.setupChannel('ch', 'test-track', defaultPatch);
    expect(engine.getPatch('ch')?.legato).toBe(false);
  });
});

describe('Ju60Arpeggiator', () => {
  let arp: Ju60Arpeggiator;
  const triggerOn = vi.fn();
  const triggerOff = vi.fn();

  beforeEach(() => {
    triggerOn.mockClear();
    triggerOff.mockClear();
    arp = new Ju60Arpeggiator(triggerOn, triggerOff);
  });

  it('starts with OFF mode and empty notes', () => {
    expect(arp.mode).toBe('OFF');
    expect(arp.notes.size).toBe(0);
  });

  it('adds and removes notes', () => {
    arp.addNote(60);
    expect(arp.notes.has(60)).toBe(true);

    arp.addNote(64);
    expect(arp.notes.size).toBe(2);

    arp.removeNote(60);
    expect(arp.notes.has(60)).toBe(false);
    expect(arp.notes.size).toBe(1);
  });

  it('has configurable rate, octaveRange, and gate', () => {
    arp.rate = 4;
    expect(arp.rate).toBe(4);

    arp.octaveRange = 2;
    expect(arp.octaveRange).toBe(2);

    arp.gate = 0.5;
    expect(arp.gate).toBe(0.5);
  });

  it('clamps rate to 1-16 range', () => {
    arp.rate = 0;
    expect(arp.rate).toBe(1);

    arp.rate = 20;
    expect(arp.rate).toBe(16);
  });

  it('clamps octaveRange to 1-3', () => {
    arp.octaveRange = 0;
    expect(arp.octaveRange).toBe(1);

    arp.octaveRange = 5;
    expect(arp.octaveRange).toBe(3);
  });

  it('clamps gate to 0.01-1', () => {
    arp.gate = 0;
    expect(arp.gate).toBe(0.01);

    arp.gate = 2;
    expect(arp.gate).toBe(1);
  });

  it('allNotesOff clears notes and triggers release for each', () => {
    arp.addNote(60);
    arp.addNote(64);
    arp.allNotesOff();

    expect(triggerOff).toHaveBeenCalledTimes(2);
    expect(arp.notes.size).toBe(0);
  });

  it('mode getter/setter works', () => {
    arp.addNote(60);
    arp.mode = 'DOWN';
    expect(arp.mode).toBe('DOWN');
    arp.mode = 'UP';
    expect(arp.mode).toBe('UP');
    arp.mode = 'RANDOM';
    expect(arp.mode).toBe('RANDOM');
  });

  it('mode OFF does not start arpeggiator schedule', () => {
    arp.mode = 'OFF';
    // scheduleRepeat should not be called when mode is OFF
  });
});

describe('Ju60Channel arpeggiator wiring', () => {
  let engine: Ju60Engine;

  beforeEach(() => {
    resetSingleton();
    engine = Ju60Engine.getInstance();
  });

  afterEach(() => {
    engine.dispose();
    resetSingleton();
  });

  it('routes note-on to arpeggiator when arpMode is UP', () => {
    engine.setupChannel('ch', 'test-track', {
      ...defaultPatch,
      arpMode: 'UP',
      arpRate: 50,
      arpOctaveRange: 0,
      arpGate: 80,
    });
    // Triggering note-on with arp active should not throw
    expect(() => engine.triggerNoteOn('ch', 60, 0)).not.toThrow();
  });

  it('routes note-off to arpeggiator when arpMode is UP', () => {
    engine.setupChannel('ch', 'test-track', {
      ...defaultPatch,
      arpMode: 'UP',
    });
    engine.triggerNoteOn('ch', 60, 0);
    expect(() => engine.triggerNoteOff('ch', 60, 0.5)).not.toThrow();
  });

  it('updatePatch sets arp mode on the channel', () => {
    engine.setupChannel('ch', 'test-track', {
      ...defaultPatch,
      arpMode: 'OFF',
    });
    engine.updatePatch('ch', { arpMode: 'DOWN' });
    expect(engine.getPatch('ch')?.arpMode).toBe('DOWN');
  });

  it('updatePatch sets arp rate', () => {
    engine.setupChannel('ch', 'test-track', defaultPatch);
    engine.updatePatch('ch', { arpRate: 25 });
    expect(engine.getPatch('ch')?.arpRate).toBe(25);
  });

  it('updatePatch sets arpOctaveRange', () => {
    engine.setupChannel('ch', 'test-track', defaultPatch);
    engine.updatePatch('ch', { arpOctaveRange: 1 });
    expect(engine.getPatch('ch')?.arpOctaveRange).toBe(1);
  });

  it('updatePatch sets arpGate', () => {
    engine.setupChannel('ch', 'test-track', defaultPatch);
    engine.updatePatch('ch', { arpGate: 50 });
    expect(engine.getPatch('ch')?.arpGate).toBe(50);
  });

  it('releaseAll calls arpeggiator allNotesOff', () => {
    engine.setupChannel('ch', 'test-track', {
      ...defaultPatch,
      arpMode: 'UP',
    });
    engine.triggerNoteOn('ch', 60, 0);
    expect(() => engine.allNotesOff()).not.toThrow();
  });
});
