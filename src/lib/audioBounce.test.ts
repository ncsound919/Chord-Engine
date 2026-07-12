import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('tone', () => ({
  default: {
    now: () => 0,
    context: { rawContext: {} },
  },
}));

vi.mock('./audio/engine', () => ({
  audioEngine: { ctx: { currentTime: 0 } },
  transport: { tempo: 120 },
}));

const mockGainValue = { value: 0 };
const mockGainNode = {
  gain: {
    ...mockGainValue,
    setValueAtTime: vi.fn(),
    exponentialRampToValueAtTime: vi.fn(),
  },
  connect: vi.fn(),
};

const mockRenderedBuffer = {
  numberOfChannels: 2,
  sampleRate: 44100,
  length: 44100,
  getChannelData: () => new Float32Array(44100),
};

class MockOfflineAudioContext {
  destination = {};
  constructor(public numberOfChannels: number, public length: number, public sampleRate: number) {}
  createGain() {
    return {
      gain: { value: 0, setValueAtTime: vi.fn(), exponentialRampToValueAtTime: vi.fn() },
      connect: vi.fn(),
    };
  }
  createConvolver() {
    return { ...mockGainNode, gain: { ...mockGainNode.gain } };
  }
  createOscillator() {
    return {
      type: '',
      frequency: { value: 0 },
      connect: vi.fn(),
      start: vi.fn(),
      stop: vi.fn(),
    };
  }
  startRendering() {
    return Promise.resolve(mockRenderedBuffer as any);
  }
}

vi.stubGlobal('OfflineAudioContext', MockOfflineAudioContext);

import { bounceToWav, downloadWav } from './audioBounce';
import type { GeneratedSection } from './engine';

function makeSection(): GeneratedSection {
  return {
    id: 'test',
    name: 'Test',
    def: { id: 'test', name: 'Test', preset: 'pop' as any, lengthBars: 4, beatsPerBar: 4 },
    chords: [
      {
        bar: 1,
        beat: 1,
        roman: 'I',
        chordName: 'C',
        pianoVoicing: { notes: [60, 64, 67, 72] },
        bassNote: { midi: 36 },
      },
    ],
    drumPattern: {
      grid: {
        Kick: [
          true, false, false, false, true, false, false, false,
          true, false, false, false, true, false, false, false,
          true, false, false, false, true, false, false, false,
          true, false, false, false, true, false, false, false,
        ],
      },
    },
  };
}

describe('bounceToWav', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns a Blob', async () => {
    const blob = await bounceToWav([makeSection()], 4, 120);
    expect(blob).toBeInstanceOf(Blob);
  });

  it('returns a blob with type audio/wav', async () => {
    const blob = await bounceToWav([makeSection()], 4, 120);
    expect(blob.type).toBe('audio/wav');
  });

  it('produces a valid WAV blob starting with RIFF', async () => {
    const blob = await bounceToWav([makeSection()], 4, 120);
    const buffer = await blob.arrayBuffer();
    const bytes = new Uint8Array(buffer);
    const riff = String.fromCharCode(bytes[0], bytes[1], bytes[2], bytes[3]);
    expect(riff).toBe('RIFF');
  });

  it('produces a valid WAV blob with empty sections', async () => {
    const blob = await bounceToWav([], 1, 120);
    expect(blob).toBeInstanceOf(Blob);
    const buffer = await blob.arrayBuffer();
    const bytes = new Uint8Array(buffer);
    const riff = String.fromCharCode(bytes[0], bytes[1], bytes[2], bytes[3]);
    expect(riff).toBe('RIFF');
  });
});

describe('downloadWav', () => {
  const originalCreateElement = document.createElement.bind(document);

  it('creates an anchor element and triggers download', () => {
    const clickSpy = vi.fn();
    vi.spyOn(document, 'createElement').mockImplementation((tag: string) => {
      if (tag === 'a') {
        const el = originalCreateElement('a');
        el.click = clickSpy;
        return el;
      }
      return originalCreateElement(tag);
    });
    const revokeSpy = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});

    const blob = new Blob([new ArrayBuffer(100)], { type: 'audio/wav' });
    downloadWav(blob, 'test.wav');

    expect(clickSpy).toHaveBeenCalled();
    expect(revokeSpy).toHaveBeenCalled();

    vi.restoreAllMocks();
  });

  it('uses the provided filename', () => {
    let downloadValue = '';
    vi.spyOn(document, 'createElement').mockImplementation((tag: string) => {
      if (tag === 'a') {
        const el = originalCreateElement('a');
        Object.defineProperty(el, 'download', {
          get: () => downloadValue,
          set: (v: string) => { downloadValue = v; },
          configurable: true,
        });
        (el as any).click = vi.fn();
        return el;
      }
      return originalCreateElement(tag);
    });
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});

    const blob = new Blob([new ArrayBuffer(100)], { type: 'audio/wav' });
    downloadWav(blob, 'custom-name.wav');

    expect(downloadValue).toBe('custom-name.wav');

    vi.restoreAllMocks();
  });
});
