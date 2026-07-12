import { audioEngine } from './engine';
import { getSampleFromDB, saveSampleToDB } from './soundbankDb';
import { DRUM_NAMES } from '../../components/instruments/types';

/**
 * Orchestrates sample loading: bytes -> IndexedDB -> Live Audio Engine.
 */

/** Persist an ArrayBuffer to IndexedDB and load it into the live engine. */
export async function persistAndLoadSample(
  id: string,
  targetName: string,
  data: ArrayBuffer,
  filename: string,
  mimeType: string
): Promise<void> {
  // Resolve the default once so the persisted DB record and the live
  // in-memory engine load always agree on mime type — previously the DB
  // got the defaulted value but the engine got the raw (possibly falsy)
  // one, so a falsy mimeType could leave the two disagreeing until the
  // next reload pulled the correctly-defaulted value back out of the DB.
  const resolvedMimeType = mimeType || 'audio/wav';
  await saveSampleToDB({ id, name: filename, type: resolvedMimeType, data });
  await audioEngine.loadSampleFromBuffer(targetName, data, filename, resolvedMimeType);
}

/** Load a File object directly into the engine + DB. */
export async function persistAndLoadFile(id: string, targetName: string, file: File): Promise<void> {
  const data = await file.arrayBuffer();
  await persistAndLoadSample(id, targetName, data, file.name, file.type);
}

/** Fetch a remote URL and persist+load it. */
export async function persistAndLoadFromUrl(
  id: string,
  targetName: string,
  url: string,
  filename: string,
  mimeType: string
): Promise<void> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to fetch ${url}: ${res.status}`);
  const data = await res.arrayBuffer();
  await persistAndLoadSample(id, targetName, data, filename, mimeType);
}

/** Load every drum in a kit from IndexedDB into the live engine. */
export async function loadKitFromDB(kitId: 'kit1' | 'kit2'): Promise<number> {
  let loadCount = 0;
  for (const key of DRUM_NAMES) {
    const id = `${kitId}_${key}`;
    const sample = await getSampleFromDB(id);
    if (sample) {
      await audioEngine.loadSampleFromBuffer(key, sample.data, sample.name, sample.type);
      loadCount++;
    }
  }
  return loadCount;
}

/** Load the persisted bass sample into the live engine. */
export async function loadBassFromDB(): Promise<boolean> {
  const sample = await getSampleFromDB('bass_default');
  if (!sample) return false;
  await audioEngine.loadSampleFromBuffer('bass', sample.data, sample.name, sample.type);
  return true;
}

/** Returns a map of which target names currently have loaded buffers. */
export function getLoadedSampleMap(): Record<string, boolean> {
  const out: Record<string, boolean> = {};
  Array.from(audioEngine.loadedSamples.keys()).forEach((k) => {
    out[k] = true;
  });
  return out;
}
