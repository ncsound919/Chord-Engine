/**
 * IndexedDB manager for persisting uploaded and pre-loaded audio files.
 * This allows large audio buffers to persist across page reloads.
 *
 * AUDIT FIXES APPLIED:
 * - Singleton cached connection instead of open-per-call (perf)
 * - onblocked handler to prevent silent hangs on version upgrade
 * - transaction.onerror / onabort handling so promises never hang
 * - QuotaExceededError surfaced with actionable message
 * - Added getAllSamplesFromDB() for bulk restore without N connections
 * - db.close() exposed for explicit lifecycle control
 */

const DB_NAME = 'DeterministicSoundbankDB';
const DB_VERSION = 1;
const STORE_NAME = 'soundbank_samples';

export interface SoundbankSample {
  id: string;        // e.g., "kit1_Kick", "bass_default"
  name: string;      // file name e.g., "kick.wav"
  type: string;      // mime type e.g., "audio/wav"
  data: ArrayBuffer; // raw binary file data
}

// Cached singleton connection — avoids a full open handshake on every call.
let dbPromise: Promise<IDBDatabase> | null = null;

export function openSoundbankDB(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;

  dbPromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => {
      dbPromise = null; // allow retry on next call
      reject(request.error);
    };

    request.onblocked = () => {
      // Another tab has an older-version connection open and won't close it.
      // Without this handler, `open()` hangs forever with no error.
      dbPromise = null;
      reject(new Error(
        'IndexedDB open blocked: another tab is holding an outdated connection to ' +
        `${DB_NAME}. Close other tabs using this app and retry.`
      ));
    };

    request.onsuccess = () => {
      const db = request.result;
      // If the DB is force-closed elsewhere (e.g. user clears storage mid-session),
      // drop the cached promise so the next call reopens cleanly.
      db.onclose = () => { dbPromise = null; };
      resolve(db);
    };

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'id' });
      }
      // NOTE: if DB_VERSION is ever bumped for a schema change, add migration
      // logic here keyed off `event.oldVersion` — there is none yet since
      // only one version has ever shipped.
    };
  });

  return dbPromise;
}

/** Explicitly close the cached connection. Call on app teardown if needed. */
export function closeSoundbankDB(): void {
  if (dbPromise) {
    dbPromise.then(db => db.close()).catch(() => {});
    dbPromise = null;
  }
}

function runTransaction<T>(
  mode: IDBTransactionMode,
  work: (store: IDBObjectStore) => IDBRequest<T>
): Promise<T> {
  return openSoundbankDB().then(db => {
    return new Promise<T>((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, mode);
      const store = transaction.objectStore(STORE_NAME);
      const request = work(store);

      // Transaction-level failure (e.g. QuotaExceededError on put) can abort
      // without the individual request ever firing onerror/onsuccess.
      transaction.onerror = () => {
        reject(transaction.error || new Error('IndexedDB transaction failed'));
      };
      transaction.onabort = () => {
        const err = transaction.error;
        if (err && err.name === 'QuotaExceededError') {
          reject(new Error(
            'Storage quota exceeded while writing to the soundbank DB. ' +
            'Free up space by removing unused samples.'
          ));
        } else {
          reject(err || new Error('IndexedDB transaction aborted'));
        }
      };

      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve(request.result);
    });
  });
}

export async function saveSampleToDB(sample: SoundbankSample): Promise<void> {
  await runTransaction('readwrite', store => store.put(sample));
}

export async function getSampleFromDB(id: string): Promise<SoundbankSample | null> {
  const result = await runTransaction<SoundbankSample | undefined>(
    'readonly',
    store => store.get(id)
  );
  return result || null;
}

/**
 * Bulk-fetch every sample record in one transaction/connection instead of
 * N separate getSampleFromDB calls (each of which previously opened its
 * own connection before this fix).
 */
export async function getAllSamplesFromDB(): Promise<SoundbankSample[]> {
  const result = await runTransaction<SoundbankSample[]>(
    'readonly',
    store => store.getAll()
  );
  return result || [];
}

export async function deleteSampleFromDB(id: string): Promise<void> {
  await runTransaction('readwrite', store => store.delete(id));
}

export async function getAllSampleIdsFromDB(): Promise<string[]> {
  const result = await runTransaction<IDBValidKey[]>(
    'readonly',
    store => store.getAllKeys()
  );
  return (result || []).filter((k): k is string => typeof k === 'string');
}

export async function clearAllSamplesInDB(): Promise<void> {
  await runTransaction('readwrite', store => store.clear());
}
