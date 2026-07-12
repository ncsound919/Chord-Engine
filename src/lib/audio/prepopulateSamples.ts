import { audioEngine } from './engine';
import { persistAndLoadSample } from './soundbankLoader';
import { DRUM_NAMES } from '../../components/instruments/types';

interface IndexEntry {
  id: string;
  name: string;
  filename: string;
  path: string;
  type: string;
  absolutePath?: string;
}

let tauriAvailable = false;
try {
  tauriAvailable = typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;
} catch {}

const DRUM_KIT1_MAP: Record<string, string> = {
  'Kick': 'Fudda Kick 1.wav',
  'Snare': 'Steady Snr 1.wav',
  'Hi-Hat Closed': 'Fudda Hat 1.wav',
  'Hi-Hat Open': 'Fudda Open Hat 1.wav',
  'Crash': 'Fudda Crash.wav',
  'Ride': 'Ride.wav',
  'Tom 1': 'Killer Tom 1.wav',
  'Tom 2': 'Killer Tom 2.wav',
  'Tom 3': 'Killer Tom 3.wav',
};

const DRUM_KIT2_MAP: Record<string, string> = {
  'Kick': 'Boom Kick.wav',
  'Snare': 'Dave Snare.wav',
  'Hi-Hat Closed': 'Hat.wav',
  'Hi-Hat Open': 'Op Hat.wav',
  'Crash': 'Crasher.wav',
  'Ride': 'Ping Ride.wav',
  'Tom 1': 'Tim Tom high.wav',
  'Tom 2': 'Tim Tom mid.wav',
  'Tom 3': 'Tim Tom floor.wav',
};

let prepopulated = false;

export async function prepopulateFromSoundLibrary(): Promise<boolean> {
  if (prepopulated) return true;
  try {
    const resp = await fetch('/sounds/index.json');
    if (!resp.ok) return false;
    const index: IndexEntry[] = await resp.json();

    const drumKit1Files = index.filter((e) =>
      e.path.includes('drum kit 1') && /\.(wav|mp3|ogg)$/i.test(e.filename)
    );
    const drumKit2Files = index.filter((e) =>
      e.path.includes('drum kit 2') && /\.(wav|mp3|ogg)$/i.test(e.filename)
    );
    const bassFiles = index.filter((e) =>
      e.type === 'bass' && /\.(wav|mp3|ogg)$/i.test(e.filename)
    );

    let loaded = 0;

    for (const [drumName, filename] of Object.entries(DRUM_KIT1_MAP)) {
      const entry = drumKit1Files.find((e) =>
        e.filename.toLowerCase() === filename.toLowerCase()
      );
      if (entry) {
        const ok = await loadEntryToEngine(entry, drumName, 'kit1');
        if (ok) loaded++;
      }
    }

    if (loaded < 3) {
      for (const [drumName, filename] of Object.entries(DRUM_KIT2_MAP)) {
        const entry = drumKit2Files.find((e) =>
          e.filename.toLowerCase() === filename.toLowerCase()
        );
        if (entry) {
          const ok = await loadEntryToEngine(entry, drumName, 'kit2');
          if (ok) loaded++;
        }
      }
    }

    const bassEntry = bassFiles[0];
    if (bassEntry) {
      const ok = await loadEntryToEngine(bassEntry, 'bass', 'bass');
      if (ok) loaded++;
    }

    prepopulated = true;
    return loaded > 0;
  } catch {
    return false;
  }
}

async function loadEntryToEngine(
  entry: IndexEntry,
  targetName: string,
  kitId: string
): Promise<boolean> {
  try {
    const dbId = kitId === 'bass' ? 'bass_default' : `${kitId}_${targetName}`;
    if (tauriAvailable && entry.absolutePath) {
      const { readFile } = await import('@tauri-apps/plugin-fs');
      const uint8 = await readFile(entry.absolutePath);
      const data = uint8.buffer.slice(uint8.byteOffset, uint8.byteOffset + uint8.byteLength);
      await persistAndLoadSample(dbId, targetName, data, entry.filename, 'audio/wav');
    } else {
      const audioResp = await fetch(`/sounds/${entry.path}`);
      if (!audioResp.ok) return false;
      const data = await audioResp.arrayBuffer();
      await persistAndLoadSample(dbId, targetName, data, entry.filename, 'audio/wav');
    }
    return true;
  } catch {
    return false;
  }
}

export function resetPrepopulatedFlag() {
  prepopulated = false;
}
