import { useEffect } from 'react';
import { useProjectStore } from '../stores/projectStore';
import { useUiStore } from '../stores/uiStore';

export function useKeyboardShortcuts() {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const mod = e.metaKey || e.ctrlKey;

      // Ctrl/Cmd+S — Save
      if (mod && e.key === 's') {
        e.preventDefault();
        useProjectStore.getState().saveProject();
      }

      // Ctrl/Cmd+O — Open project list
      if (mod && e.key === 'o') {
        e.preventDefault();
        useProjectStore.getState().setIsProjectListOpen(true);
        useProjectStore.getState().loadUserProjects();
      }

      // Ctrl/Cmd+Shift+E — Export to file
      if (mod && e.shiftKey && e.key === 'E') {
        e.preventDefault();
        useProjectStore.getState().exportProjectToFile();
      }

      // Ctrl/Cmd+Shift+I — Import from file
      if (mod && e.shiftKey && e.key === 'I') {
        e.preventDefault();
        useProjectStore.getState().importProjectFromFile();
      }

      // Ctrl/Cmd+N — New project
      if (mod && e.key === 'n') {
        e.preventDefault();
        const store = useProjectStore.getState();
        store.setProjectName('Untitled Project');
        store.setProjectId(crypto.randomUUID());
      }

      // View switching: 1-6
      if (!mod && !e.altKey && !e.shiftKey) {
        const views = ['arranger', 'mixer', 'rhythm', 'instruments', 'parts', 'blender'] as const;
        const num = parseInt(e.key, 10);
        if (num >= 1 && num <= views.length) {
          // Only if not in an input
          if (!(e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement || e.target instanceof HTMLSelectElement)) {
            useUiStore.getState().setActiveView(views[num - 1]);
          }
        }
      }
    };

    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);
}
