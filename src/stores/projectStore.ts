import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { PersistenceManager, ProjectState } from '../lib/persistence';
import { Ju60Engine, Ju60Params } from '../lib/audio/synth';
import { audioEngine } from '../lib/audio/engine';
import { transport } from '../lib/audio/engine';
import { useGenerationStore } from './generationStore';

interface ProjectStateInternal {
  projectId: string;
  projectName: string;
  isSaving: boolean;
  saveError: string | null;
  userProjects: ProjectState[];
  isProjectListOpen: boolean;

  setProjectName: (name: string) => void;
  setProjectId: (id: string) => void;
  setIsProjectListOpen: (open: boolean) => void;
  loadUserProjects: () => Promise<void>;
  saveProject: () => Promise<void>;
  loadProject: (proj: ProjectState) => void;
  exportProjectToFile: () => Promise<void>;
  importProjectFromFile: () => Promise<void>;
}

export const useProjectStore = create<ProjectStateInternal>()(
  persist(
    (set, get) => ({
      projectId: crypto.randomUUID(),
      projectName: 'Untitled Project',
      isSaving: false,
      saveError: null,
      userProjects: [],
      isProjectListOpen: false,

      setProjectName: (projectName) => set({ projectName }),
      setProjectId: (projectId) => set({ projectId }),
      setIsProjectListOpen: (isProjectListOpen) => set({ isProjectListOpen }),

      loadUserProjects: async () => {
        const projects = await PersistenceManager.listUserProjects();
        set({ userProjects: projects });
      },

      saveProject: async () => {
        const { projectName, projectId } = get();
        if (!projectName.trim()) {
          set({ saveError: 'Project name required' });
          return;
        }
        set({ isSaving: true, saveError: null });
        try {
          const genState = useGenerationStore.getState();
          const synth = Ju60Engine.getInstance();
          const patches: Record<string, Ju60Params> = {};
          ['lead', 'pad', 'bass'].forEach(id => {
            const p = synth.getPatch(id);
            if (p) patches[id] = p;
          });
          await PersistenceManager.saveProject({
            id: projectId,
            name: projectName.trim(),
            tempo: transport.tempo,
            key: genState.musicKey,
            sections: genState.sections,
            generated: genState.generated,
            synthPatches: patches,
            drumKit: audioEngine.drumKit,
            midiFiles: {},
            sheetMusic: {},
          });
          get().loadUserProjects();
        } catch (err: any) {
          console.error('Save error:', err);
          set({ saveError: 'Failed to save project' });
        } finally {
          set({ isSaving: false });
        }
      },

      loadProject: (proj) => {
        const genState = useGenerationStore.getState();
        set({ projectId: proj.id, projectName: proj.name, isProjectListOpen: false });
        transport.tempo = proj.tempo;
        genState.setMusicKey(proj.key);
        genState.setSections(proj.sections);
        genState.setGenerated(proj.generated);
        if (proj.synthPatches) {
          const synth = Ju60Engine.getInstance();
          Object.entries(proj.synthPatches).forEach(([id, patch]) => {
            synth.updatePatch(id, patch);
          });
        }
        if (proj.drumKit) {
          audioEngine.drumKit = { ...proj.drumKit };
        }
      },

      exportProjectToFile: async () => {
        const { openFileDialog, saveFileDialog, writeText } = await import('../lib/tauriBridge');
        const { projectName, projectId } = get();
        
        const genState = useGenerationStore.getState();
        const synth = Ju60Engine.getInstance();
        const patches: Record<string, Ju60Params> = {};
        ['lead', 'pad', 'bass'].forEach(id => {
          const p = synth.getPatch(id);
          if (p) patches[id] = p;
        });
        
        const data = {
          id: projectId,
          name: projectName.trim(),
          tempo: transport.tempo,
          key: genState.musicKey,
          sections: genState.sections,
          generated: genState.generated,
          synthPatches: patches,
          drumKit: audioEngine.drumKit,
          midiFiles: {},
          sheetMusic: {},
          exportedAt: new Date().toISOString(),
        };
        
        const path = await saveFileDialog(`${projectName.trim() || 'project'}.json`, [
          { name: 'Chord Engine Project', extensions: ['json'] },
        ]);
        
        if (path) {
          await writeText(path, JSON.stringify(data, null, 2));
        }
      },

      importProjectFromFile: async () => {
        const { openFileDialog, readText } = await import('../lib/tauriBridge');
        
        const path = await openFileDialog([
          { name: 'Chord Engine Project', extensions: ['json'] },
        ]);
        
        if (!path) return;
        
        try {
          const content = await readText(path);
          const data = JSON.parse(content);
          
          const proj: ProjectState = {
            id: data.id || crypto.randomUUID(),
            name: data.name || 'Imported Project',
            tempo: data.tempo || 120,
            key: data.key || 'C',
            sections: data.sections || [],
            generated: data.generated || [],
            synthPatches: data.synthPatches || {},
            drumKit: data.drumKit,
            midiFiles: data.midiFiles,
            sheetMusic: data.sheetMusic,
          };
          
          get().loadProject(proj);
        } catch (err) {
          console.error('Import error:', err);
          set({ saveError: 'Failed to import project' });
        }
      },
    }),
    {
      name: 'project-store',
      partialize: (state) => ({
        projectId: state.projectId,
        projectName: state.projectName,
      }),
    },
  ),
);
