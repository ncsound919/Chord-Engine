import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';

const hoisted = vi.hoisted(() => {
  const mf = vi.fn();
  (globalThis as any).fetch = mf;
  return {
    mockFetch: mf,
    mockAddEntries: vi.fn(),
    mockLoadSampleFromBuffer: vi.fn().mockResolvedValue(undefined),
  };
});

vi.mock('../lib/audio/soundLibrary', () => ({
  soundLibrary: {
    addEntries: hoisted.mockAddEntries,
    allEntries: [] as any[],
  },
}));

vi.mock('../lib/audio/engine', () => ({
  audioEngine: {
    loadSampleFromBuffer: hoisted.mockLoadSampleFromBuffer,
  },
}));

const indexJson = [
  { id: '1', name: 'Kick', filename: 'kick.wav', path: 'drums/kick.wav', library: 'acoustic', collection: 'acoustic', folder: 'drums', type: 'drum', size: 100, modified: '2024-01-01' },
  { id: '2', name: 'Snare', filename: 'snare.wav', path: 'drums/snare.wav', library: 'acoustic', collection: 'acoustic', folder: 'drums', type: 'drum', size: 200, modified: '2024-01-01' },
];

describe('useSoundLibrary', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    hoisted.mockFetch.mockReset();
  });

  describe('initial load', () => {
    afterEach(() => {
      // Reset module state so subsequent tests get fresh libraryLoaded
      vi.resetModules();
    });

    it('fetches and loads index on mount', async () => {
      const { useSoundLibrary } = await import('./useSoundLibrary');
      hoisted.mockFetch.mockResolvedValueOnce({ ok: true, json: vi.fn().mockResolvedValue(indexJson) });
      const { result } = renderHook(() => useSoundLibrary());
      expect(result.current.loading).toBe(true);
      await waitFor(() => expect(result.current.loading).toBe(false));
      expect(hoisted.mockFetch).toHaveBeenCalledWith('/sounds/index.json', expect.anything());
      expect(hoisted.mockAddEntries).toHaveBeenCalledOnce();
      expect(hoisted.mockAddEntries).toHaveBeenCalledWith(expect.arrayContaining([
        expect.objectContaining({ id: '1', name: 'Kick' }),
        expect.objectContaining({ id: '2', name: 'Snare' }),
      ]));
      expect(result.current.error).toBeNull();
    });

    it('handles fetch error gracefully', async () => {
      const { useSoundLibrary } = await import('./useSoundLibrary');
      hoisted.mockFetch.mockRejectedValueOnce(new Error('Network failure'));
      const { result } = renderHook(() => useSoundLibrary());
      await waitFor(() => expect(result.current.loading).toBe(false));
      expect(result.current.error).toBe('Network failure');
      expect(hoisted.mockAddEntries).not.toHaveBeenCalled();
    });

    it('handles non-ok response', async () => {
      const { useSoundLibrary } = await import('./useSoundLibrary');
      hoisted.mockFetch.mockResolvedValueOnce({ ok: false, status: 404, statusText: 'Not Found' });
      const { result } = renderHook(() => useSoundLibrary());
      await waitFor(() => expect(result.current.loading).toBe(false));
      expect(result.current.error).toContain('404');
      expect(hoisted.mockAddEntries).not.toHaveBeenCalled();
    });

    it('only loads library once', async () => {
      const { useSoundLibrary } = await import('./useSoundLibrary');
      hoisted.mockFetch.mockResolvedValueOnce({ ok: true, json: vi.fn().mockResolvedValue(indexJson) });
      const { result } = renderHook(() => useSoundLibrary());
      await waitFor(() => expect(result.current.loading).toBe(false));
      expect(hoisted.mockFetch).toHaveBeenCalledTimes(1);

      hoisted.mockAddEntries.mockClear();
      hoisted.mockFetch.mockClear();

      const { result: result2 } = renderHook(() => useSoundLibrary());
      expect(result2.current.loading).toBe(false);
      expect(hoisted.mockFetch).not.toHaveBeenCalled();
      expect(hoisted.mockAddEntries).not.toHaveBeenCalled();
    });
  });

  describe('loadSampleToEngine', () => {
    afterEach(() => {
      vi.resetModules();
    });

    it('successfully loads audio', async () => {
      const { useSoundLibrary } = await import('./useSoundLibrary');
      hoisted.mockFetch.mockResolvedValueOnce({ ok: true, json: vi.fn().mockResolvedValue(indexJson) });
      const { result } = renderHook(() => useSoundLibrary());
      await waitFor(() => expect(result.current.loading).toBe(false));

      const audioBuffer = new ArrayBuffer(16);
      hoisted.mockFetch.mockResolvedValueOnce({
        ok: true,
        arrayBuffer: vi.fn().mockResolvedValue(audioBuffer),
      });

      const entry = { id: '1', name: 'Kick', filename: 'kick.wav', path: 'drums/kick.wav', folder: 'drums', library: 'acoustic', type: 'drum' as const, tags: [], metadata: {} };
      const ok = await result.current.loadSampleToEngine(entry, 'Kick');
      expect(ok).toBe(true);
      expect(hoisted.mockFetch.mock.calls[1][0]).toBe('/sounds/drums/kick.wav');
      expect(hoisted.mockLoadSampleFromBuffer).toHaveBeenCalledWith('Kick', audioBuffer, 'kick.wav', 'audio/wav');
    });

    it('handles network failure', async () => {
      const { useSoundLibrary } = await import('./useSoundLibrary');
      hoisted.mockFetch.mockResolvedValueOnce({ ok: true, json: vi.fn().mockResolvedValue(indexJson) });
      const { result } = renderHook(() => useSoundLibrary());
      await waitFor(() => expect(result.current.loading).toBe(false));

      hoisted.mockFetch.mockResolvedValueOnce({ ok: false, status: 500 });
      const entry = { id: '1', name: 'Kick', filename: 'kick.wav', path: 'drums/kick.wav', folder: 'drums', library: 'acoustic', type: 'drum' as const, tags: [], metadata: {} };
      const ok = await result.current.loadSampleToEngine(entry, 'Kick');
      expect(ok).toBe(false);
      expect(hoisted.mockLoadSampleFromBuffer).not.toHaveBeenCalled();
    });
  });
});
