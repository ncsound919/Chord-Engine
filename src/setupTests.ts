import * as matchers from '@testing-library/jest-dom/matchers';
import { expect, vi } from 'vitest';

expect.extend(matchers as any);

// Mock Web Audio API
class AudioContextMock {
  state = 'running';
  createGain() { return { connect: vi.fn(), gain: { value: 1, setTargetAtTime: vi.fn(), rampTo: vi.fn() } }; }
  createOscillator() { return { start: vi.fn(), stop: vi.fn(), connect: vi.fn(), frequency: { value: 440 } }; }
  createBiquadFilter() { return { connect: vi.fn(), frequency: { value: 1000, setTargetAtTime: vi.fn() } }; }
  createDynamicsCompressor() { return { connect: vi.fn(), threshold: { value: -24 }, knee: { value: 30 }, ratio: { value: 12 }, reduction: { value: 0 }, attack: { value: 0.003 }, release: { value: 0.25 } }; }
  createPanner() { return { connect: vi.fn(), pan: { value: 0, setTargetAtTime: vi.fn() } }; }
  createBufferSource() { return { connect: vi.fn(), start: vi.fn(), stop: vi.fn(), buffer: null }; }
  createBuffer() { return {} }
  createMediaStreamDestination() { return { stream: {} }; }
  decodeAudioData() { return Promise.resolve({}); }
  resume() { return Promise.resolve(); }
  suspend() { return Promise.resolve(); }
  close() { return Promise.resolve(); }
  get destination() { return {}; }
  get currentTime() { return 0; }
  get rawContext() { return this; }
}

global.window.AudioContext = AudioContextMock as any;
global.AudioContext = AudioContextMock as any;

class MockMediaRecorder {
  static isTypeSupported() { return true; }
  start() {}
  stop() {}
  ondataavailable() {}
  onstop() {}
}
global.window.MediaRecorder = MockMediaRecorder as any;
global.MediaRecorder = MockMediaRecorder as any;

vi.mock('tone', () => {
  const synthMock = {
    triggerAttackRelease: vi.fn(),
    connect: vi.fn().mockReturnThis(),
    toDestination: vi.fn().mockReturnThis(),
    start: vi.fn().mockReturnThis(),
    stop: vi.fn(),
    dispose: vi.fn(),
    ready: Promise.resolve(),
    chain: vi.fn().mockReturnThis(),
    disconnect: vi.fn(),
    volume: { rampTo: vi.fn(), setTargetAtTime: vi.fn() },
    pan: { setTargetAtTime: vi.fn() },
    frequency: { setTargetAtTime: vi.fn() },
    gain: { setTargetAtTime: vi.fn() },
    high: { setTargetAtTime: vi.fn() },
    low: { setTargetAtTime: vi.fn() },
    bpm: { value: 85 }
  };
  function MockConstructor() { return synthMock; }

  const mockAnalyser = {
    getValue: vi.fn(() => new Uint8Array(32)),
    connect: vi.fn().mockReturnThis(),
    disconnect: vi.fn(),
    dispose: vi.fn()
  };
  function MockAnalyserConstructor() { return mockAnalyser; }
  
  const mockedTransport = {
    state: 'stopped',
    bpm: { value: 85 },
    scheduleRepeat: vi.fn(),
    start: vi.fn(),
    stop: vi.fn(),
    cancel: vi.fn(),
    seconds: 0,
    position: '0:0:0',
    timeSignature: 4
  };

  return {
    getContext: () => ({ rawContext: { state: 'running', createMediaStreamDestination: () => ({ stream: {} }) } }),
    start: vi.fn(),
    now: vi.fn(() => 0),
    gainToDb: vi.fn((v) => v),
    dbToGain: vi.fn((v) => Math.pow(10, v / 20)),
    ToneAudioBuffer: vi.fn(function () {
      return {
        load: vi.fn().mockResolvedValue(undefined),
        dispose: vi.fn(),
        duration: 1,
      };
    }),
    Transport: mockedTransport,
    Oscillator: MockConstructor,
    Filter: MockConstructor,
    Gain: MockConstructor,
    Limiter: MockConstructor,
    EQ3: MockConstructor,
    Volume: MockConstructor,
    Reverb: MockConstructor,
    MembraneSynth: MockConstructor,
    NoiseSynth: MockConstructor,
    MetalSynth: MockConstructor,
    Player: MockConstructor,
    Panner: MockConstructor,
    AmplitudeEnvelope: MockConstructor,
    Envelope: MockConstructor,
    Chorus: MockConstructor,
    LFO: MockConstructor,
    Analyser: MockAnalyserConstructor,
    getTransport: vi.fn(() => mockedTransport),
    getDestination: vi.fn(() => synthMock)
  };
});
