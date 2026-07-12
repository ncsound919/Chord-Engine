import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const hoisted = vi.hoisted(() => {
  const mf = vi.fn();
  (globalThis as any).fetch = mf;
  return {
    mockFetch: mf,
    mockLoadSampleFromBuffer: vi.fn().mockResolvedValue(undefined),
    mockSaveSampleToDB: vi.fn().mockResolvedValue(undefined),
  };
});

vi.mock('./soundbankLoader', () => ({
  persistAndLoadSample: vi.fn((id: string, targetName: string) =>
    Promise.resolve()
  ),
}));

vi.mock('./engine', () => ({
  audioEngine: {
    loadSampleFromBuffer: hoisted.mockLoadSampleFromBuffer,
  },
}));

vi.mock('./soundbankDb', () => ({
  saveSampleToDB: hoisted.mockSaveSampleToDB,
}));

const indexJson = [
  {
    id: 'bass_0', name: 'ample-p-bass_C', filename: 'ample-p-bass_C.wav',
    path: 'Deterministic Engine Soundbank/Bass/ample-p-bass_C.wav', type: 'bass',
  },
  {
    id: 'drums_0', name: 'Fudda Kick 1', filename: 'Fudda Kick 1.wav',
    path: 'Deterministic Engine Soundbank/drum kit 1/Fudda Kick 1.wav', type: 'drums',
  },
  {
    id: 'drums_1', name: 'Steady Snr 1', filename: 'Steady Snr 1.wav',
    path: 'Deterministic Engine Soundbank/drum kit 1/Steady Snr 1.wav', type: 'drums',
  },
  {
    id: 'drums_2', name: 'Fudda Hat 1', filename: 'Fudda Hat 1.wav',
    path: 'Deterministic Engine Soundbank/drum kit 1/Fudda Hat 1.wav', type: 'drums',
  },
];

describe('prepopulateFromSoundLibrary', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    hoisted.mockFetch.mockReset();
    const mod = await vi.importActual<typeof import('./prepopulateSamples')>('./prepopulateSamples');
    mod.resetPrepopulatedFlag();
  });

  it('fetches index and loads drum kit 1 samples', async () => {
    hoisted.mockFetch
      .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve(indexJson) })
      .mockResolvedValue({ ok: true, arrayBuffer: () => Promise.resolve(new ArrayBuffer(8)) });

    const { prepopulateFromSoundLibrary } = await import('./prepopulateSamples');
    const result = await prepopulateFromSoundLibrary();

    expect(result).toBe(true);
    expect(hoisted.mockFetch).toHaveBeenCalledWith('/sounds/index.json');
    expect(hoisted.mockFetch).toHaveBeenCalledWith(
      expect.stringContaining('/sounds/')
    );
  });

  it('returns false when index fetch fails', async () => {
    hoisted.mockFetch.mockRejectedValueOnce(new Error('fail'));
    const { prepopulateFromSoundLibrary } = await import('./prepopulateSamples');
    const result = await prepopulateFromSoundLibrary();
    expect(result).toBe(false);
  });

  it('returns false when index returns non-ok', async () => {
    hoisted.mockFetch.mockResolvedValueOnce({ ok: false, status: 404 });
    const { prepopulateFromSoundLibrary } = await import('./prepopulateSamples');
    const result = await prepopulateFromSoundLibrary();
    expect(result).toBe(false);
  });

  it('only runs once (cached flag)', async () => {
    hoisted.mockFetch
      .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve(indexJson) })
      .mockResolvedValue({ ok: true, arrayBuffer: () => Promise.resolve(new ArrayBuffer(8)) });

    const { prepopulateFromSoundLibrary } = await import('./prepopulateSamples');
    await prepopulateFromSoundLibrary();
    hoisted.mockFetch.mockClear();

    const result = await prepopulateFromSoundLibrary();
    expect(result).toBe(true);
    expect(hoisted.mockFetch).not.toHaveBeenCalled();
  });
});
