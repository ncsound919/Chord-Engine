import { useEffect, useState, useCallback } from 'react';
import { soundLibrary, SoundLibraryEntry } from '../lib/audio/soundLibrary';
import { audioEngine } from '../lib/audio/engine';

interface IndexEntry {
  id: string;
  name: string;
  filename: string;
  path: string;
  library: string;
  collection: string;
  folder: string;
  type: string;
  size: number;
  modified: string;
  absolutePath?: string; // Desktop app: absolute file path
}

let libraryLoaded = false;

// Detect if running in Electron or Tauri desktop mode
const isDesktop = typeof window !== 'undefined' && 
  ((window as any).electron !== undefined || '__TAURI_INTERNALS__' in window);

export function useSoundLibrary() {
  const [loading, setLoading] = useState(!libraryLoaded);
  const [error, setError] = useState<string | null>(null);
  const [count, setCount] = useState(soundLibrary.allEntries.length);

  useEffect(() => {
    if (libraryLoaded) return;
    const abort = new AbortController();

    const load = async () => {
      try {
        const resp = await fetch('/sounds/index.json', { signal: abort.signal });
        if (!resp.ok) throw new Error(`Failed to load sound library index: ${resp.status}`);
        const index: IndexEntry[] = await resp.json();

        const entries: SoundLibraryEntry[] = index.map((entry) => {
          const lower = entry.name.toLowerCase();
          const noteMatch = lower.match(/([a-g][#b]?)(\d+)/);
          const midiNote = noteMatch ? (() => {
            const noteNames = ['C','C#','D','D#','E','F','F#','G','G#','A','A#','B'];
            const pc = noteNames.indexOf(noteMatch[1].charAt(0).toUpperCase() + (noteMatch[1].slice(1) || ''));
            if (pc === -1) return undefined;
            return pc + (parseInt(noteMatch[2], 10) + 1) * 12;
          })() : undefined;

          return {
            id: entry.id,
            name: entry.name,
            filename: entry.filename,
            path: entry.path,
            folder: entry.folder || entry.library,
            library: entry.collection || entry.library,
            type: entry.type as SoundLibraryEntry['type'],
            tags: [],
            metadata: {
              note: noteMatch ? noteMatch[1].toUpperCase() + noteMatch[2] : undefined,
              midiNote,
            },
            // Store absolute path for desktop app
            ...(entry.absolutePath && { absolutePath: entry.absolutePath }),
          };
        });

        soundLibrary.addEntries(entries);
        libraryLoaded = true;
        setCount(entries.length);
        setLoading(false);
      } catch (err: any) {
        if (abort.signal.aborted) return;
        setError(err.message);
        setLoading(false);
      }
    };

    load();
    return () => abort.abort();
  }, []);

  const loadSampleToEngine = useCallback(async (entry: SoundLibraryEntry & { absolutePath?: string }, targetName: string) => {
    try {
      // In Tauri mode, use the filesystem plugin
      if (entry.absolutePath && '__TAURI_INTERNALS__' in window) {
        const { readFile } = await import('@tauri-apps/plugin-fs');
        const uint8 = await readFile(entry.absolutePath);
        const buffer = uint8.buffer.slice(uint8.byteOffset, uint8.byteOffset + uint8.byteLength);
        await audioEngine.loadSampleFromBuffer(targetName, buffer, entry.filename, 'audio/wav');
        return true;
      }

      // In Electron desktop mode, use file:// protocol
      if (isDesktop && entry.absolutePath) {
        const resp = await fetch(`file:///${entry.absolutePath}`);
        if (!resp.ok) throw new Error(`Failed to load ${entry.filename}`);
        const buffer = await resp.arrayBuffer();
        await audioEngine.loadSampleFromBuffer(targetName, buffer, entry.filename, 'audio/wav');
        return true;
      }
      
      // In browser mode, use the Vite middleware
      const resp = await fetch(`/sounds/${entry.path}`);
      if (!resp.ok) throw new Error(`Failed to load ${entry.filename}`);
      const buffer = await resp.arrayBuffer();
      await audioEngine.loadSampleFromBuffer(targetName, buffer, entry.filename, 'audio/wav');
      return true;
    } catch (err) {
      console.warn('Failed to load sample:', entry.filename, err);
      return false;
    }
  }, []);

  return { loading, error, count, loadSampleToEngine, libraryLoaded };
}
