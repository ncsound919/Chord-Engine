import { openDB, type IDBPDatabase } from 'idb';
import type { Ju60Params } from './audio/synth';
import type { OneShotPreset } from './audio/oneShotSampler';

// ──────────────────────────────────────────────────────────────
// Data Models
// ──────────────────────────────────────────────────────────────

export interface ProjectState {
  id: string;
  name: string;
  tempo: number;
  key: string;
  sections: any[];
  generated: any[];
  synthPatches: Record<string, Ju60Params>;
  drumKit?: Record<string, string>;
  midiFiles?: Record<string, string>;
  sheetMusic?: Record<string, string>;
  createdAt?: string;
  updatedAt?: string;
}

export interface SectionPreset {
  id: string;
  name: string;
  type: 'drum' | 'synth' | 'full';
  data: any;
  /** Owner/user id; optional today, filled in once multi-user support lands. */
  ownerId?: string;
}

export interface PresetState {
  id: string;
  name: string;
  patch: Ju60Params;
  /** Owner/user id; optional today, filled in once multi-user support lands. */
  ownerId?: string;
  /** Scopes a preset to the synth channel it was captured from (lead/pad/bass). */
  category?: 'lead' | 'pad' | 'bass';
  isPublic: boolean;
}

// ──────────────────────────────────────────────────────────────
// IndexedDB Setup
// ──────────────────────────────────────────────────────────────

const DB_NAME = 'chord-engine-db';
const DB_VERSION = 1;

let dbPromise: Promise<IDBPDatabase> | null = null;

function getDb() {
  if (!dbPromise) {
    dbPromise = openDB(DB_NAME, DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains('projects')) {
          db.createObjectStore('projects', { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains('presets')) {
          db.createObjectStore('presets', { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains('sectionPresets')) {
          db.createObjectStore('sectionPresets', { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains('samplerPresets')) {
          db.createObjectStore('samplerPresets', { keyPath: 'id' });
        }
      },
    });
  }
  return dbPromise;
}

// ──────────────────────────────────────────────────────────────
// PersistenceManager
// ──────────────────────────────────────────────────────────────

export class PersistenceManager {
  // ── Projects ──────────────────────────────────────────────

  static async saveProject(project: ProjectState): Promise<void> {
    const db = await getDb();
    await db.put('projects', {
      ...project,
      updatedAt: new Date().toISOString(),
      createdAt: project.createdAt || new Date().toISOString(),
    });
  }

  static async loadProject(id: string): Promise<ProjectState | null> {
    const db = await getDb();
    return (await db.get('projects', id)) ?? null;
  }

  static async listUserProjects(): Promise<ProjectState[]> {
    const db = await getDb();
    const projects = await db.getAll('projects');
    return projects.sort((a, b) => new Date(b.updatedAt!).getTime() - new Date(a.updatedAt!).getTime());
  }

  static async deleteProject(id: string): Promise<void> {
    const db = await getDb();
    await db.delete('projects', id);
  }

  // ── Presets ──────────────────────────────────────────────

  static async savePreset(preset: PresetState): Promise<void> {
    const db = await getDb();
    await db.put('presets', preset);
  }

  static async listPresets(): Promise<PresetState[]> {
    const db = await getDb();
    return db.getAll('presets');
  }

  // UPGRADE: mirrors deleteProject's existing pattern. Previously there was
  // no way to remove a saved preset once created — the list only grew.
  static async deletePreset(id: string): Promise<void> {
    const db = await getDb();
    await db.delete('presets', id);
  }

  // ── Section Presets ────────────────────────────────────────

  static async saveSectionPreset(preset: SectionPreset): Promise<void> {
    const db = await getDb();
    await db.put('sectionPresets', preset);
  }

  static async listSectionPresets(
    type?: SectionPreset['type']
  ): Promise<SectionPreset[]> {
    const db = await getDb();
    const all = await db.getAll('sectionPresets');
    return type ? all.filter((p) => p.type === type) : all;
  }

  // ── Sampler Presets ─────────────────────────────────────

  static async saveSamplerPreset(preset: OneShotPreset): Promise<void> {
    const db = await getDb();
    // Don't persist buffer references (they're reloaded separately)
    const { samples, ...rest } = preset;
    const persistable = { ...rest, samples: samples.map(s => ({ ...s, buffer: undefined })) };
    await db.put('samplerPresets', persistable);
  }

  static async listSamplerPresets(): Promise<OneShotPreset[]> {
    const db = await getDb();
    return db.getAll('samplerPresets');
  }

  static async deleteSamplerPreset(id: string): Promise<void> {
    const db = await getDb();
    await db.delete('samplerPresets', id);
  }

  // ── Import/Export ────────────────────────────────────────

  static async exportAllData(): Promise<Blob> {
    const db = await getDb();
    const data = {
      projects: await db.getAll('projects'),
      presets: await db.getAll('presets'),
      sectionPresets: await db.getAll('sectionPresets'),
      samplerPresets: await db.getAll('samplerPresets'),
    };
    return new Blob([JSON.stringify(data)], { type: 'application/json' });
  }

  static async importAllData(file: File): Promise<void> {
    const text = await file.text();
    const data = JSON.parse(text);
    const db = await getDb();

    const tx = db.transaction(
      ['projects', 'presets', 'sectionPresets', 'samplerPresets'],
      'readwrite'
    );

    await Promise.all([
      ...(data.projects || []).map((p: ProjectState) => tx.objectStore('projects').put(p)),
      ...(data.presets || []).map((p: PresetState) => tx.objectStore('presets').put(p)),
      ...(data.sectionPresets || []).map((p: SectionPreset) =>
        tx.objectStore('sectionPresets').put(p)
      ),
      ...(data.samplerPresets || []).map((p: OneShotPreset) =>
        tx.objectStore('samplerPresets').put(p)
      ),
    ]);

    await tx.done;
  }
}