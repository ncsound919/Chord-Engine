
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { PersistenceManager, ProjectState, PresetState, SectionPreset } from './persistence';
import { openDB } from 'idb';

const mockPut = vi.fn().mockResolvedValue(undefined);
const mockGet = vi.fn().mockResolvedValue(undefined);
const mockGetAll = vi.fn().mockResolvedValue([]);
const mockDelete = vi.fn().mockResolvedValue(undefined);
const mockTransaction = {
  objectStore: vi.fn(() => ({
    put: vi.fn().mockResolvedValue(undefined),
  })),
  done: Promise.resolve(),
};
const mockObjectStoreNames = { contains: vi.fn().mockReturnValue(false) };
const mockCreateObjectStore = vi.fn();
const mockDb = {
  put: mockPut,
  get: mockGet,
  getAll: mockGetAll,
  delete: mockDelete,
  transaction: vi.fn(() => mockTransaction),
  objectStoreNames: mockObjectStoreNames,
  createObjectStore: mockCreateObjectStore,
};

vi.mock('idb', () => ({
  openDB: vi.fn((_name: any, _version: any, options: any) => {
    if (options?.upgrade) {
      options.upgrade(mockDb);
    }
    return Promise.resolve(mockDb);
  }),
}));

const mockOpenDB = vi.mocked(openDB);

describe('PersistenceManager', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPut.mockResolvedValue(undefined);
    mockGet.mockResolvedValue(undefined);
    mockGetAll.mockResolvedValue([]);
    mockDelete.mockResolvedValue(undefined);
  });

  const mockProject: ProjectState = {
    id: 'proj1',
    name: 'Test Project',
    tempo: 120,
    key: 'C major',
    sections: [],
    generated: [],
    synthPatches: {},
  };

  const mockPreset: PresetState = {
    id: 'preset1',
    name: 'Test Preset',
    patch: {
      oscillator: { type: 'sine' },
      envelope: { attack: 0.1, decay: 0.2, sustain: 0.3, release: 0.4 },
    },
    isPublic: true,
  };

  const mockSectionPreset: SectionPreset = {
    id: 'secPreset1',
    name: 'Test Section Preset',
    type: 'drum',
    data: { pattern: [] },
  };

  // ── Projects ──────────────────────────────────────────────────

  it('should save a project', async () => {
    const projectToSave = { ...mockProject, createdAt: undefined, updatedAt: undefined };
    await PersistenceManager.saveProject(projectToSave);

    expect(mockOpenDB).toHaveBeenCalledWith('chord-engine-db', 1, expect.any(Object));
    expect(mockPut).toHaveBeenCalledWith(
      'projects',
      expect.objectContaining({
        ...projectToSave,
        updatedAt: expect.any(String),
        createdAt: expect.any(String),
      }),
    );
  });

  it('should load a project by id', async () => {
    mockGet.mockResolvedValueOnce(mockProject);
    const loadedProject = await PersistenceManager.loadProject('proj1');

    expect(mockGet).toHaveBeenCalledWith('projects', 'proj1');
    expect(loadedProject).toEqual(mockProject);
  });

  it('should return null if project not found', async () => {
    mockGet.mockResolvedValueOnce(undefined);
    const loadedProject = await PersistenceManager.loadProject('nonexistent');
    expect(loadedProject).toBeNull();
  });

  it('should list user projects sorted by updatedAt', async () => {
    const project2 = { ...mockProject, id: 'proj2', updatedAt: new Date('2023-01-01').toISOString() };
    const project1 = { ...mockProject, id: 'proj1', updatedAt: new Date('2023-01-02').toISOString() };
    mockGetAll.mockResolvedValueOnce([project2, project1]);

    const projects = await PersistenceManager.listUserProjects();

    expect(mockGetAll).toHaveBeenCalledWith('projects');
    expect(projects).toEqual([project1, project2]);
  });

  it('should delete a project by id', async () => {
    await PersistenceManager.deleteProject('proj1');

    expect(mockDelete).toHaveBeenCalledWith('projects', 'proj1');
  });

  // ── Presets ──────────────────────────────────────────────────

  it('should save a preset', async () => {
    await PersistenceManager.savePreset(mockPreset);

    expect(mockPut).toHaveBeenCalledWith('presets', mockPreset);
  });

  it('should list presets', async () => {
    mockGetAll.mockResolvedValueOnce([mockPreset]);
    const presets = await PersistenceManager.listPresets();

    expect(mockGetAll).toHaveBeenCalledWith('presets');
    expect(presets).toEqual([mockPreset]);
  });

  // ── Section Presets ──────────────────────────────────────────

  it('should save a section preset', async () => {
    await PersistenceManager.saveSectionPreset(mockSectionPreset);

    expect(mockPut).toHaveBeenCalledWith('sectionPresets', mockSectionPreset);
  });

  it('should list all section presets', async () => {
    mockGetAll.mockResolvedValueOnce([mockSectionPreset]);
    const sectionPresets = await PersistenceManager.listSectionPresets();

    expect(mockGetAll).toHaveBeenCalledWith('sectionPresets');
    expect(sectionPresets).toEqual([mockSectionPreset]);
  });

  it('should list section presets filtered by type', async () => {
    const drumPreset = { ...mockSectionPreset, id: 'drum1', type: 'drum' };
    const synthPreset = { ...mockSectionPreset, id: 'synth1', type: 'synth' };
    mockGetAll.mockResolvedValueOnce([drumPreset, synthPreset]);

    const drumSectionPresets = await PersistenceManager.listSectionPresets('drum');

    expect(mockGetAll).toHaveBeenCalledWith('sectionPresets');
    expect(drumSectionPresets).toEqual([drumPreset]);
  });

  // ── Import/Export ────────────────────────────────────────────

  it('should export all data', async () => {
    mockGetAll.mockImplementation((storeName) => {
      if (storeName === 'projects') return Promise.resolve([mockProject]);
      if (storeName === 'presets') return Promise.resolve([mockPreset]);
      if (storeName === 'sectionPresets') return Promise.resolve([mockSectionPreset]);
      return Promise.resolve([]);
    });

    const blob = await PersistenceManager.exportAllData();
    const expectedData = {
      projects: [mockProject],
      presets: [mockPreset],
      sectionPresets: [mockSectionPreset],
      samplerPresets: [],
    };

    expect(blob.type).toBe('application/json');
    expect(await blob.text()).toBe(JSON.stringify(expectedData));
  });

  it('should import all data', async () => {
    const importedData = {
      projects: [{ ...mockProject, id: 'importedProj' }],
      presets: [{ ...mockPreset, id: 'importedPreset' }],
      sectionPresets: [{ ...mockSectionPreset, id: 'importedSecPreset' }],
      samplerPresets: [{ id: 'sp1', name: 'Test', samples: [], globalVolume: 0.8, globalFilterCutoff: 20000, globalFilterRes: 0, globalEnvA: 0.001, globalEnvD: 0.1, globalEnvS: 1, globalEnvR: 0.1 }],
    };
    const mockFile = new File([JSON.stringify(importedData)], 'data.json', { type: 'application/json' });

    await PersistenceManager.importAllData(mockFile);

    expect(mockDb.transaction).toHaveBeenCalledWith(
      ['projects', 'presets', 'sectionPresets', 'samplerPresets'],
      'readwrite',
    );
    expect(mockTransaction.objectStore).toHaveBeenCalledWith('projects');
    expect(mockTransaction.objectStore).toHaveBeenCalledWith('presets');
    expect(mockTransaction.objectStore).toHaveBeenCalledWith('sectionPresets');
    expect(mockTransaction.objectStore).toHaveBeenCalledWith('samplerPresets');
    await expect(mockTransaction.done).resolves.toBeUndefined();
  });

  it('should delete a preset by id', async () => {
    await PersistenceManager.deletePreset('preset1');
    expect(mockDelete).toHaveBeenCalledWith('presets', 'preset1');
  });

  it('should list section presets filtered by synth type', async () => {
    const drumPreset = { ...mockSectionPreset, id: 'drum1', type: 'drum' };
    const synthPreset = { ...mockSectionPreset, id: 'synth1', type: 'synth' };
    const fullPreset = { ...mockSectionPreset, id: 'full1', type: 'full' };
    mockGetAll.mockResolvedValueOnce([drumPreset, synthPreset, fullPreset]);

    const synthSectionPresets = await PersistenceManager.listSectionPresets('synth');
    expect(synthSectionPresets).toEqual([synthPreset]);
  });

  it('should list section presets filtered by full type', async () => {
    const drumPreset = { ...mockSectionPreset, id: 'drum1', type: 'drum' };
    const fullPreset = { ...mockSectionPreset, id: 'full1', type: 'full' };
    mockGetAll.mockResolvedValueOnce([drumPreset, fullPreset]);

    const fullSectionPresets = await PersistenceManager.listSectionPresets('full');
    expect(fullSectionPresets).toEqual([fullPreset]);
  });

  it('should list all section presets when no type filter', async () => {
    const drumPreset = { ...mockSectionPreset, id: 'drum1', type: 'drum' };
    const synthPreset = { ...mockSectionPreset, id: 'synth1', type: 'synth' };
    const fullPreset = { ...mockSectionPreset, id: 'full1', type: 'full' };
    mockGetAll.mockResolvedValueOnce([drumPreset, synthPreset, fullPreset]);

    const allPresets = await PersistenceManager.listSectionPresets();
    expect(allPresets).toEqual([drumPreset, synthPreset, fullPreset]);
  });

  it('should export all data with correct blob type', async () => {
    mockGetAll.mockImplementation((storeName) => {
      if (storeName === 'projects') return Promise.resolve([]);
      if (storeName === 'presets') return Promise.resolve([]);
      if (storeName === 'sectionPresets') return Promise.resolve([]);
      return Promise.resolve([]);
    });

    const blob = await PersistenceManager.exportAllData();
    expect(blob.type).toBe('application/json');
    const text = await blob.text();
    const parsed = JSON.parse(text);
    expect(parsed).toEqual({ projects: [], presets: [], sectionPresets: [], samplerPresets: [] });
  });

  it('should import data with empty arrays', async () => {
    const importedData = { projects: [], presets: [], sectionPresets: [], samplerPresets: [] };
    const mockFile = new File([JSON.stringify(importedData)], 'empty.json', { type: 'application/json' });

    await PersistenceManager.importAllData(mockFile);

    expect(mockDb.transaction).toHaveBeenCalledWith(
      ['projects', 'presets', 'sectionPresets', 'samplerPresets'],
      'readwrite',
    );
    await expect(mockTransaction.done).resolves.toBeUndefined();
  });

  it('should save a preset with category', async () => {
    const presetWithCategory = { ...mockPreset, category: 'lead' as const };
    await PersistenceManager.savePreset(presetWithCategory);
    expect(mockPut).toHaveBeenCalledWith('presets', presetWithCategory);
  });

  it('should save a section preset with ownerId', async () => {
    const presetWithOwner = { ...mockSectionPreset, ownerId: 'user123' };
    await PersistenceManager.saveSectionPreset(presetWithOwner);
    expect(mockPut).toHaveBeenCalledWith('sectionPresets', presetWithOwner);
  });

  it('should save a project with existing createdAt', async () => {
    const projectWithCreatedAt = { ...mockProject, createdAt: '2023-01-01T00:00:00Z' };
    await PersistenceManager.saveProject(projectWithCreatedAt);
    expect(mockPut).toHaveBeenCalledWith(
      'projects',
      expect.objectContaining({
        createdAt: '2023-01-01T00:00:00Z',
        updatedAt: expect.any(String),
      }),
    );
  });

  it('should list user projects with undefined updatedAt', async () => {
    const projectNoUpdate = { ...mockProject, updatedAt: undefined };
    mockGetAll.mockResolvedValueOnce([projectNoUpdate]);
    const projects = await PersistenceManager.listUserProjects();
    expect(projects).toEqual([projectNoUpdate]);
  });

  it('should import data with multiple projects and presets', async () => {
    const importedData = {
      projects: [
        { ...mockProject, id: 'p1' },
        { ...mockProject, id: 'p2' },
      ],
      presets: [
        { ...mockPreset, id: 'pr1' },
        { ...mockPreset, id: 'pr2' },
        { ...mockPreset, id: 'pr3' },
      ],
      sectionPresets: [
        { ...mockSectionPreset, id: 'sp1' },
      ],
      samplerPresets: [
        { id: 'sp1', name: 'Kit', samples: [], globalVolume: 0.8, globalFilterCutoff: 20000, globalFilterRes: 0, globalEnvA: 0.001, globalEnvD: 0.1, globalEnvS: 1, globalEnvR: 0.1 },
      ],
    };
    const mockFile = new File([JSON.stringify(importedData)], 'multi.json', { type: 'application/json' });

    await PersistenceManager.importAllData(mockFile);

    expect(mockTransaction.objectStore).toHaveBeenCalledWith('projects');
    expect(mockTransaction.objectStore).toHaveBeenCalledWith('presets');
    expect(mockTransaction.objectStore).toHaveBeenCalledWith('sectionPresets');
    expect(mockTransaction.objectStore).toHaveBeenCalledWith('samplerPresets');
  });
});
