import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── IndexedDB mock ───────────────────────────────────────────────────
// Store-level mocks auto-fire onsuccess via microtask so the module's
// handler is attached before the callback runs.

const mockStore = new Map<string, any>();

function createRequest(result: any, error?: any) {
  const req: any = {
    result,
    error,
    onsuccess: null as any,
    onerror: null as any,
  };
  // Auto-fire onsuccess on next microtask so handler is set first
  queueMicrotask(() => {
    if (req.onsuccess) req.onsuccess({ target: req } as any);
  });
  return req;
}

const mockIDBObjectStore = {
  put: vi.fn((sample: any) => {
    mockStore.set(sample.id, sample);
    return createRequest(undefined);
  }),
  get: vi.fn((id: string) => createRequest(mockStore.get(id))),
  getAll: vi.fn(() => createRequest(Array.from(mockStore.values()))),
  getAllKeys: vi.fn(() => createRequest(Array.from(mockStore.keys()))),
  delete: vi.fn((id: string) => {
    mockStore.delete(id);
    return createRequest(undefined);
  }),
  clear: vi.fn(() => {
    mockStore.clear();
    return createRequest(undefined);
  }),
};

function makeMockTransaction() {
  return {
    objectStore: vi.fn(() => mockIDBObjectStore),
    onerror: null as any,
    onabort: null as any,
    error: null as any,
  };
}

const mockDB = {
  transaction: vi.fn(() => makeMockTransaction()),
  close: vi.fn(),
  onclose: null as any,
  objectStoreNames: { contains: vi.fn(() => true) },
  createObjectStore: vi.fn(),
};

let latestOpenRequest: any = null;

(globalThis as any).indexedDB = {
  open: vi.fn(() => {
    latestOpenRequest = {
      result: mockDB,
      onsuccess: null as any,
      onerror: null as any,
      onblocked: null as any,
      onupgradeneeded: null as any,
    };
    return latestOpenRequest;
  }),
};

// ── Import the module under test ──────────────────────────────────────
import {
  openSoundbankDB,
  closeSoundbankDB,
  saveSampleToDB,
  getSampleFromDB,
  getAllSamplesFromDB,
  deleteSampleFromDB,
  getAllSampleIdsFromDB,
  clearAllSamplesInDB,
} from './soundbankDb';

// ── Helpers ───────────────────────────────────────────────────────────
function triggerOpenSuccess() {
  latestOpenRequest.onsuccess?.({} as any);
}

function makeSample(id: string) {
  return { id, name: `${id}.wav`, type: 'audio/wav', data: new ArrayBuffer(8) };
}

// Reset the singleton between tests
beforeEach(() => {
  vi.clearAllMocks();
  mockStore.clear();
  closeSoundbankDB();
  latestOpenRequest = null;
});

describe('soundbankDb', () => {
  // ── openSoundbankDB ───────────────────────────────────────────────
  describe('openSoundbankDB', () => {
    it('returns a database connection on success', async () => {
      const p = openSoundbankDB();
      triggerOpenSuccess();
      const result = await p;

      expect(result).toBe(mockDB);
      expect(indexedDB.open).toHaveBeenCalledWith('DeterministicSoundbankDB', 1);
    });

    it('caches the connection (singleton pattern)', async () => {
      const p1 = openSoundbankDB();
      triggerOpenSuccess();
      await p1;

      const p2 = openSoundbankDB();
      triggerOpenSuccess();
      await p2;

      expect(indexedDB.open).toHaveBeenCalledTimes(1);
    });

    it('rejects on open error', async () => {
      const p = openSoundbankDB();
      latestOpenRequest.onerror?.({} as any);

      await expect(p).rejects.toThrow();
    });

    it('rejects when blocked by another tab', async () => {
      const p = openSoundbankDB();
      latestOpenRequest.onblocked?.({} as any);

      await expect(p).rejects.toThrow('IndexedDB open blocked');
    });

    it('creates object store on upgradeneeded when store does not exist', async () => {
      mockDB.objectStoreNames.contains.mockReturnValueOnce(false);

      const p = openSoundbankDB();
      latestOpenRequest.onupgradeneeded?.({} as any);
      triggerOpenSuccess();
      await p;

      expect(mockDB.createObjectStore).toHaveBeenCalledWith('soundbank_samples', { keyPath: 'id' });
    });

    it('does not create object store when it already exists', async () => {
      mockDB.objectStoreNames.contains.mockReturnValueOnce(true);

      const p = openSoundbankDB();
      latestOpenRequest.onupgradeneeded?.({} as any);
      triggerOpenSuccess();
      await p;

      expect(mockDB.createObjectStore).not.toHaveBeenCalled();
    });

    it('resets singleton on db close event', async () => {
      const p = openSoundbankDB();
      triggerOpenSuccess();
      const db = await p;

      db.onclose?.({} as any);

      vi.clearAllMocks();
      mockStore.clear();

      const p2 = openSoundbankDB();
      triggerOpenSuccess();
      const db2 = await p2;

      expect(db2).toBe(mockDB);
      expect(indexedDB.open).toHaveBeenCalledTimes(1);
    });

    it('rejects and resets singleton on error so retry is possible', async () => {
      const p = openSoundbankDB();
      latestOpenRequest.onerror?.({} as any);

      await expect(p).rejects.toThrow();

      vi.clearAllMocks();
      const p2 = openSoundbankDB();
      triggerOpenSuccess();
      const db2 = await p2;

      expect(db2).toBe(mockDB);
    });
  });

  // ── closeSoundbankDB ──────────────────────────────────────────────
  describe('closeSoundbankDB', () => {
    it('closes an open connection', async () => {
      const p = openSoundbankDB();
      triggerOpenSuccess();
      await p;

      closeSoundbankDB();
      expect(mockDB.close).toHaveBeenCalled();
    });

    it('does nothing when no connection is open', () => {
      closeSoundbankDB();
      expect(mockDB.close).not.toHaveBeenCalled();
    });
  });

  // ── saveSampleToDB ────────────────────────────────────────────────
  describe('saveSampleToDB', () => {
    it('stores a sample correctly', async () => {
      const p = openSoundbankDB();
      triggerOpenSuccess();
      await p;

      const sample = makeSample('kit1_Kick');
      await saveSampleToDB(sample);

      expect(mockIDBObjectStore.put).toHaveBeenCalledWith(sample);
      expect(mockStore.get('kit1_Kick')).toEqual(sample);
    });

    it('opens a readwrite transaction', async () => {
      const p = openSoundbankDB();
      triggerOpenSuccess();
      await p;

      await saveSampleToDB(makeSample('test'));

      expect(mockDB.transaction).toHaveBeenCalledWith(
        'soundbank_samples',
        'readwrite',
      );
    });
  });

  // ── getSampleFromDB ───────────────────────────────────────────────
  describe('getSampleFromDB', () => {
    it('retrieves a stored sample by id', async () => {
      const p = openSoundbankDB();
      triggerOpenSuccess();
      await p;

      const sample = makeSample('kit1_Snare');
      await saveSampleToDB(sample);

      const result = await getSampleFromDB('kit1_Snare');
      expect(result).toEqual(sample);
    });

    it('returns null for unknown id', async () => {
      const p = openSoundbankDB();
      triggerOpenSuccess();
      await p;

      const result = await getSampleFromDB('nonexistent');
      expect(result).toBeNull();
    });

    it('opens a readonly transaction', async () => {
      const p = openSoundbankDB();
      triggerOpenSuccess();
      await p;

      await getSampleFromDB('kit1_Kick');
      expect(mockDB.transaction).toHaveBeenCalledWith(
        'soundbank_samples',
        'readonly',
      );
    });
  });

  // ── getAllSamplesFromDB ───────────────────────────────────────────
  describe('getAllSamplesFromDB', () => {
    it('returns all stored samples', async () => {
      const p = openSoundbankDB();
      triggerOpenSuccess();
      await p;

      const s1 = makeSample('kit1_Kick');
      const s2 = makeSample('bass_default');
      await saveSampleToDB(s1);
      await saveSampleToDB(s2);

      const all = await getAllSamplesFromDB();
      expect(all).toHaveLength(2);
      expect(all).toEqual(expect.arrayContaining([s1, s2]));
    });

    it('returns empty array when no samples exist', async () => {
      const p = openSoundbankDB();
      triggerOpenSuccess();
      await p;

      const all = await getAllSamplesFromDB();
      expect(all).toEqual([]);
    });
  });

  // ── deleteSampleFromDB ────────────────────────────────────────────
  describe('deleteSampleFromDB', () => {
    it('removes a sample by id', async () => {
      const p = openSoundbankDB();
      triggerOpenSuccess();
      await p;

      const sample = makeSample('kit1_Crash');
      await saveSampleToDB(sample);
      expect(mockStore.has('kit1_Crash')).toBe(true);

      await deleteSampleFromDB('kit1_Crash');
      expect(mockStore.has('kit1_Crash')).toBe(false);
    });

    it('is a no-op for unknown id', async () => {
      const p = openSoundbankDB();
      triggerOpenSuccess();
      await p;

      await deleteSampleFromDB('nonexistent');
      expect(mockIDBObjectStore.delete).toHaveBeenCalledWith('nonexistent');
    });
  });

  // ── getAllSampleIdsFromDB ─────────────────────────────────────────
  describe('getAllSampleIdsFromDB', () => {
    it('returns all stored sample ids', async () => {
      const p = openSoundbankDB();
      triggerOpenSuccess();
      await p;

      await saveSampleToDB(makeSample('kit1_Kick'));
      await saveSampleToDB(makeSample('kit1_Snare'));

      const ids = await getAllSampleIdsFromDB();
      expect(ids).toHaveLength(2);
      expect(ids).toEqual(expect.arrayContaining(['kit1_Kick', 'kit1_Snare']));
    });

    it('returns empty array when no samples exist', async () => {
      const p = openSoundbankDB();
      triggerOpenSuccess();
      await p;

      const ids = await getAllSampleIdsFromDB();
      expect(ids).toEqual([]);
    });

    it('filters out non-string keys', async () => {
      const p = openSoundbankDB();
      triggerOpenSuccess();
      await p;

      // Override getAllKeys to return a request that fires onsuccess
      // AFTER runTransaction sets its handler. We do this by having
      // the mock itself schedule the microtask (not at test setup time).
      mockIDBObjectStore.getAllKeys.mockImplementationOnce(() => {
        const req: any = {
          result: [123, 'validKey'],
          onsuccess: null as any,
          onerror: null as any,
        };
        queueMicrotask(() => {
          if (req.onsuccess) req.onsuccess({ target: req });
        });
        return req;
      });

      const ids = await getAllSampleIdsFromDB();
      expect(ids).toEqual(['validKey']);
    });
  });

  // ── clearAllSamplesInDB ───────────────────────────────────────────
  describe('clearAllSamplesInDB', () => {
    it('removes all samples', async () => {
      const p = openSoundbankDB();
      triggerOpenSuccess();
      await p;

      await saveSampleToDB(makeSample('kit1_Kick'));
      await saveSampleToDB(makeSample('bass_default'));
      expect(mockStore.size).toBe(2);

      await clearAllSamplesInDB();
      expect(mockStore.size).toBe(0);
      expect(mockIDBObjectStore.clear).toHaveBeenCalled();
    });

    it('is a no-op on an empty database', async () => {
      const p = openSoundbankDB();
      triggerOpenSuccess();
      await p;

      await clearAllSamplesInDB();
      expect(mockIDBObjectStore.clear).toHaveBeenCalled();
    });
  });

  // ── Transaction error handling ────────────────────────────────────
  describe('transaction error handling', () => {
    it('rejects on request onerror', async () => {
      const p = openSoundbankDB();
      triggerOpenSuccess();
      await p;

      const error = new Error('request failed');

      mockDB.transaction.mockImplementationOnce(() => {
        const req: any = {
          result: undefined,
          error,
          onsuccess: null as any,
          onerror: null as any,
        };
        const tx = {
          objectStore: vi.fn(() => ({
            ...mockIDBObjectStore,
            get: vi.fn(() => req),
          })),
          onerror: null as any,
          onabort: null as any,
          error: null,
        };
        queueMicrotask(() => {
          if (req.onerror) req.onerror({ target: req });
        });
        return tx;
      });

      await expect(getSampleFromDB('any')).rejects.toThrow('request failed');
    });

    it('rejects with QuotaExceededError message on abort', async () => {
      const p = openSoundbankDB();
      triggerOpenSuccess();
      await p;

      const quotaError = { name: 'QuotaExceededError', message: 'quota exceeded' };

      mockDB.transaction.mockImplementationOnce(() => {
        const tx: any = {
          objectStore: vi.fn(() => mockIDBObjectStore),
          onerror: null as any,
          onabort: null as any,
          error: quotaError,
        };
        queueMicrotask(() => tx.onabort?.({} as any));
        return tx;
      });

      await expect(getSampleFromDB('any')).rejects.toThrow('Storage quota exceeded');
    });

    it('rejects with generic abort message when not QuotaExceededError', async () => {
      const p = openSoundbankDB();
      triggerOpenSuccess();
      await p;

      mockDB.transaction.mockImplementationOnce(() => {
        const tx: any = {
          objectStore: vi.fn(() => mockIDBObjectStore),
          onerror: null as any,
          onabort: null as any,
          error: null,
        };
        queueMicrotask(() => tx.onabort?.({} as any));
        return tx;
      });

      await expect(getSampleFromDB('any')).rejects.toThrow('IndexedDB transaction aborted');
    });

    it('rejects on transaction onerror', async () => {
      const p = openSoundbankDB();
      triggerOpenSuccess();
      await p;

      const error = new Error('tx failed');
      mockDB.transaction.mockImplementationOnce(() => {
        const tx: any = {
          objectStore: vi.fn(() => mockIDBObjectStore),
          onerror: null as any,
          onabort: null as any,
          error,
        };
        queueMicrotask(() => tx.onerror?.({} as any));
        return tx;
      });

      await expect(getSampleFromDB('any')).rejects.toThrow('tx failed');
    });
  });
});
