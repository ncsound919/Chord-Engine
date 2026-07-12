import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('./engine', () => ({
  audioEngine: {
    loadSampleFromBuffer: vi.fn().mockResolvedValue(undefined),
    loadedSamples: new Map(),
  },
}));

vi.mock('./soundbankDb', () => ({
  saveSampleToDB: vi.fn().mockResolvedValue(undefined),
  getSampleFromDB: vi.fn().mockResolvedValue(null),
}));

vi.mock('../../components/instruments/types', () => ({
  DRUM_NAMES: [
    'Kick',
    'Snare',
    'Hi-Hat Closed',
    'Hi-Hat Open',
    'Crash',
    'Ride',
    'Tom 1',
    'Tom 2',
    'Tom 3',
  ],
}));

import {
  persistAndLoadSample,
  persistAndLoadFile,
  persistAndLoadFromUrl,
  loadKitFromDB,
  loadBassFromDB,
  getLoadedSampleMap,
} from './soundbankLoader';
import { audioEngine } from './engine';
import { saveSampleToDB, getSampleFromDB } from './soundbankDb';

// ── Mock fetch globally ──────────────────────────────────────────────
const mockFetch = vi.fn();
(globalThis as any).fetch = mockFetch;

beforeEach(() => {
  vi.clearAllMocks();
  (audioEngine as any).loadedSamples = new Map();
});

describe('soundbankLoader', () => {
  // ── persistAndLoadSample ──────────────────────────────────────────
  describe('persistAndLoadSample', () => {
    it('saves to DB and loads into engine', async () => {
      const data = new ArrayBuffer(16);
      await persistAndLoadSample(
        'kit1_Kick',
        'Kick',
        data,
        'kick.wav',
        'audio/wav',
      );

      expect(saveSampleToDB).toHaveBeenCalledWith({
        id: 'kit1_Kick',
        name: 'kick.wav',
        type: 'audio/wav',
        data,
      });
      expect(audioEngine.loadSampleFromBuffer).toHaveBeenCalledWith(
        'Kick',
        data,
        'kick.wav',
        'audio/wav',
      );
    });

    it('defaults mimeType to audio/wav when falsy', async () => {
      const data = new ArrayBuffer(8);
      await persistAndLoadSample('id', 'target', data, 'file', '');

      expect(saveSampleToDB).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'audio/wav' }),
      );
    });

    it('defaults mimeType to audio/wav when undefined', async () => {
      const data = new ArrayBuffer(8);
      await persistAndLoadSample('id', 'target', data, 'file', undefined as any);

      expect(saveSampleToDB).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'audio/wav' }),
      );
    });
  });

  // ── persistAndLoadFile ────────────────────────────────────────────
  describe('persistAndLoadFile', () => {
    it('reads file and calls persistAndLoadSample', async () => {
      const buffer = new ArrayBuffer(12);
      const arrayBufferSpy = vi.fn().mockResolvedValue(buffer);
      const file = {
        name: 'snare.wav',
        type: 'audio/wav',
        arrayBuffer: arrayBufferSpy,
      } as unknown as File;

      await persistAndLoadFile('kit2_Snare', 'Snare', file);

      expect(arrayBufferSpy).toHaveBeenCalled();
      expect(saveSampleToDB).toHaveBeenCalledWith({
        id: 'kit2_Snare',
        name: 'snare.wav',
        type: 'audio/wav',
        data: buffer,
      });
      expect(audioEngine.loadSampleFromBuffer).toHaveBeenCalledWith(
        'Snare',
        buffer,
        'snare.wav',
        'audio/wav',
      );
    });
  });

  // ── persistAndLoadFromUrl ─────────────────────────────────────────
  describe('persistAndLoadFromUrl', () => {
    it('fetches URL, persists, and loads sample', async () => {
      const buffer = new ArrayBuffer(20);
      mockFetch.mockResolvedValueOnce({
        ok: true,
        arrayBuffer: vi.fn().mockResolvedValue(buffer),
      });

      await persistAndLoadFromUrl(
        'bass_default',
        'bass',
        'https://example.com/bass.wav',
        'bass.wav',
        'audio/wav',
      );

      expect(mockFetch).toHaveBeenCalledWith('https://example.com/bass.wav');
      expect(saveSampleToDB).toHaveBeenCalledWith({
        id: 'bass_default',
        name: 'bass.wav',
        type: 'audio/wav',
        data: buffer,
      });
      expect(audioEngine.loadSampleFromBuffer).toHaveBeenCalledWith(
        'bass',
        buffer,
        'bass.wav',
        'audio/wav',
      );
    });

    it('throws on non-ok fetch response', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
      });

      await expect(
        persistAndLoadFromUrl(
          'id',
          'target',
          'https://example.com/missing.wav',
          'missing.wav',
          'audio/wav',
        ),
      ).rejects.toThrow('Failed to fetch https://example.com/missing.wav: 404');
    });

    it('throws on network error', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network error'));

      await expect(
        persistAndLoadFromUrl(
          'id',
          'target',
          'https://example.com/fail.wav',
          'fail.wav',
          'audio/wav',
        ),
      ).rejects.toThrow('Network error');
    });
  });

  // ── loadKitFromDB ─────────────────────────────────────────────────
  describe('loadKitFromDB', () => {
    it('loads all drum samples found in DB', async () => {
      const drumNames = [
        'Kick', 'Snare', 'Hi-Hat Closed', 'Hi-Hat Open',
        'Crash', 'Ride', 'Tom 1', 'Tom 2', 'Tom 3',
      ];

      (getSampleFromDB as any).mockImplementation((id: string) => {
        if (id.startsWith('kit1_')) {
          return Promise.resolve({
            id,
            name: `${id}.wav`,
            type: 'audio/wav',
            data: new ArrayBuffer(8),
          });
        }
        return Promise.resolve(null);
      });

      const count = await loadKitFromDB('kit1');

      expect(count).toBe(9);
      for (const name of drumNames) {
        expect(audioEngine.loadSampleFromBuffer).toHaveBeenCalledWith(
          name,
          expect.any(ArrayBuffer),
          `kit1_${name}.wav`,
          'audio/wav',
        );
      }
    });

    it('returns 0 when no samples exist in DB', async () => {
      (getSampleFromDB as any).mockResolvedValue(null);

      const count = await loadKitFromDB('kit2');
      expect(count).toBe(0);
    });

    it('loads only some samples when only some exist in DB', async () => {
      const existingIds = new Set(['kit1_Kick', 'kit1_Snare']);
      (getSampleFromDB as any).mockImplementation((id: string) => {
        if (existingIds.has(id)) {
          return Promise.resolve({
            id,
            name: `${id}.wav`,
            type: 'audio/wav',
            data: new ArrayBuffer(4),
          });
        }
        return Promise.resolve(null);
      });

      const count = await loadKitFromDB('kit1');
      expect(count).toBe(2);
      expect(audioEngine.loadSampleFromBuffer).toHaveBeenCalledTimes(2);
    });

    it('uses correct kit prefix for kit2', async () => {
      (getSampleFromDB as any).mockImplementation((id: string) => {
        if (id === 'kit2_Kick') {
          return Promise.resolve({
            id,
            name: 'kick.wav',
            type: 'audio/wav',
            data: new ArrayBuffer(4),
          });
        }
        return Promise.resolve(null);
      });

      await loadKitFromDB('kit2');
      expect(getSampleFromDB).toHaveBeenCalledWith('kit2_Kick');
    });
  });

  // ── loadBassFromDB ────────────────────────────────────────────────
  describe('loadBassFromDB', () => {
    it('returns false when no bass sample is stored', async () => {
      (getSampleFromDB as any).mockResolvedValue(null);

      const result = await loadBassFromDB();
      expect(result).toBe(false);
      expect(audioEngine.loadSampleFromBuffer).not.toHaveBeenCalled();
    });

    it('returns true and loads bass sample when found', async () => {
      const bassData = new ArrayBuffer(32);
      (getSampleFromDB as any).mockResolvedValue({
        id: 'bass_default',
        name: 'bass.wav',
        type: 'audio/wav',
        data: bassData,
      });

      const result = await loadBassFromDB();

      expect(result).toBe(true);
      expect(getSampleFromDB).toHaveBeenCalledWith('bass_default');
      expect(audioEngine.loadSampleFromBuffer).toHaveBeenCalledWith(
        'bass',
        bassData,
        'bass.wav',
        'audio/wav',
      );
    });
  });

  // ── getLoadedSampleMap ────────────────────────────────────────────
  describe('getLoadedSampleMap', () => {
    it('returns empty map when nothing loaded', () => {
      (audioEngine as any).loadedSamples = new Map();
      const result = getLoadedSampleMap();
      expect(result).toEqual({});
    });

    it('returns map with loaded samples marked as true', () => {
      (audioEngine as any).loadedSamples = new Map([
        ['Kick', {}],
        ['Snare', {}],
        ['bass', {}],
      ]);

      const result = getLoadedSampleMap();
      expect(result).toEqual({
        Kick: true,
        Snare: true,
        bass: true,
      });
    });

    it('returns only keys that are present in loadedSamples', () => {
      (audioEngine as any).loadedSamples = new Map([['Tom 1', {}]]);
      const result = getLoadedSampleMap();
      expect(result).toEqual({ 'Tom 1': true });
      expect(Object.keys(result)).toHaveLength(1);
    });
  });
});
