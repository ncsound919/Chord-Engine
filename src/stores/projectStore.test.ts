import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../lib/audio/synth', () => ({
  Ju60Engine: {
    getInstance: vi.fn(() => ({
      getPatch: vi.fn((id: string) => (id === 'lead' ? { vcfCutoff: 75 } : undefined)),
      updatePatch: vi.fn(),
    })),
  },
}));

vi.mock('../lib/audio/engine', () => ({
  audioEngine: { drumKit: { Kick: 'kick.wav' }, ctx: { currentTime: 0 } },
  transport: { tempo: 120 },
}));

vi.mock('./generationStore', () => ({
  useGenerationStore: {
    getState: vi.fn(() => ({
      musicKey: 'C',
      sections: [{ id: 's1', name: 'Verse', preset: 'steely', lengthBars: 8 }],
      generated: [{ id: 'g1', name: 'Gen', chords: [], def: { lengthBars: 4, beatsPerBar: 4, style: 'pop' } }],
      setMusicKey: vi.fn(),
      setSections: vi.fn(),
      setGenerated: vi.fn(),
    })),
  },
}));

vi.mock('../lib/persistence', () => ({
  PersistenceManager: {
    listUserProjects: vi.fn(async () => [{ id: 'p1', name: 'Saved Project', tempo: 120, key: 'C', sections: [], generated: [] }]),
    saveProject: vi.fn(async () => {}),
  },
}));

vi.mock('../lib/tauriBridge', () => ({
  saveFileDialog: vi.fn(async () => '/tmp/test.json'),
  openFileDialog: vi.fn(async () => '/tmp/test.json'),
  writeText: vi.fn(async () => {}),
  readText: vi.fn(async () => JSON.stringify({
    id: 'imported',
    name: 'Imported',
    tempo: 110,
    key: 'G',
    sections: [{ id: 's2', name: 'Chorus', preset: 'pop', lengthBars: 4 }],
    generated: [],
    synthPatches: { lead: { vcfCutoff: 50 } },
    drumKit: { Snare: 'snare.wav' },
  })),
}));

import { useProjectStore } from './projectStore';
import { PersistenceManager } from '../lib/persistence';
import { useGenerationStore } from './generationStore';

describe('projectStore', () => {
  beforeEach(() => {
    useProjectStore.setState({
      projectId: 'test-id',
      projectName: 'Test Project',
      isSaving: false,
      saveError: null,
      userProjects: [],
      isProjectListOpen: false,
    });
    vi.clearAllMocks();
  });

  it('setProjectName updates name', () => {
    useProjectStore.getState().setProjectName('New Name');
    expect(useProjectStore.getState().projectName).toBe('New Name');
  });

  it('setProjectId updates id', () => {
    useProjectStore.getState().setProjectId('new-id');
    expect(useProjectStore.getState().projectId).toBe('new-id');
  });

  it('setIsProjectListOpen toggles', () => {
    useProjectStore.getState().setIsProjectListOpen(true);
    expect(useProjectStore.getState().isProjectListOpen).toBe(true);
  });

  it('loadUserProjects fetches and sets projects', async () => {
    await useProjectStore.getState().loadUserProjects();
    expect(useProjectStore.getState().userProjects).toHaveLength(1);
    expect(useProjectStore.getState().userProjects[0].name).toBe('Saved Project');
  });

  it('saveProject sets isSaving and calls PersistenceManager', async () => {
    await useProjectStore.getState().saveProject();
    expect(PersistenceManager.saveProject).toHaveBeenCalledTimes(1);
    expect(useProjectStore.getState().isSaving).toBe(false);
  });

  it('saveProject sets error for empty name', async () => {
    useProjectStore.getState().setProjectName('   ');
    await useProjectStore.getState().saveProject();
    expect(useProjectStore.getState().saveError).toBe('Project name required');
  });

  it('saveProject handles persistence error', async () => {
    (PersistenceManager.saveProject as any).mockRejectedValueOnce(new Error('fail'));
    await useProjectStore.getState().saveProject();
    expect(useProjectStore.getState().saveError).toBe('Failed to save project');
  });

  it('loadProject restores state from a project', () => {
    const setMusicKey = vi.fn();
    const setSections = vi.fn();
    const setGenerated = vi.fn();
    (useGenerationStore.getState as any).mockReturnValueOnce({
      musicKey: 'C', sections: [], generated: [],
      setMusicKey, setSections, setGenerated,
    });
    useProjectStore.getState().loadProject({
      id: 'proj-1',
      name: 'Loaded',
      tempo: 140,
      key: 'Eb',
      sections: [{ id: 's', name: 'S', preset: 'pop', lengthBars: 4 }],
      generated: [],
      synthPatches: { lead: { vcfCutoff: 30 } },
      drumKit: { Kick: 'new-kick.wav' },
    });
    expect(useProjectStore.getState().projectName).toBe('Loaded');
    expect(useProjectStore.getState().projectId).toBe('proj-1');
    expect(setMusicKey).toHaveBeenCalledWith('Eb');
  });

  it('exportProjectToFile calls saveFileDialog and writeText', async () => {
    const { saveFileDialog, writeText } = await import('../lib/tauriBridge');
    await useProjectStore.getState().exportProjectToFile();
    expect(saveFileDialog).toHaveBeenCalled();
    expect(writeText).toHaveBeenCalled();
    const written = (writeText as any).mock.calls[0][1];
    const data = JSON.parse(written);
    expect(data.name).toBe('Test Project');
    expect(data.id).toBe('test-id');
    expect(data.exportedAt).toBeDefined();
  });

  it('exportProjectToFile skips write when dialog cancelled', async () => {
    const { saveFileDialog, writeText } = await import('../lib/tauriBridge');
    (saveFileDialog as any).mockResolvedValueOnce(null);
    await useProjectStore.getState().exportProjectToFile();
    expect(writeText).not.toHaveBeenCalled();
  });

  it('importProjectFromFile loads project from file', async () => {
    const { openFileDialog } = await import('../lib/tauriBridge');
    await useProjectStore.getState().importProjectFromFile();
    expect(openFileDialog).toHaveBeenCalled();
    expect(useProjectStore.getState().projectName).toBe('Imported');
  });

  it('importProjectFromFile skips when dialog cancelled', async () => {
    const { openFileDialog } = await import('../lib/tauriBridge');
    (openFileDialog as any).mockResolvedValueOnce(null);
    const prevName = useProjectStore.getState().projectName;
    await useProjectStore.getState().importProjectFromFile();
    expect(useProjectStore.getState().projectName).toBe(prevName);
  });

  it('importProjectFromFile handles parse error', async () => {
    const { readText } = await import('../lib/tauriBridge');
    (readText as any).mockResolvedValueOnce('not-json');
    await useProjectStore.getState().importProjectFromFile();
    expect(useProjectStore.getState().saveError).toBe('Failed to import project');
  });
});
