import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type ViewMode = 'arranger' | 'blender' | 'reframer' | 'rhythm' | 'instruments' | 'parts' | 'mixer';

interface UiState {
  sidebarOpen: boolean;
  activeView: ViewMode;
  isSectionsExpanded: boolean;

  setSidebarOpen: (open: boolean) => void;
  toggleSidebar: () => void;
  setActiveView: (view: ViewMode) => void;
  setIsSectionsExpanded: (expanded: boolean) => void;
}

export const useUiStore = create<UiState>()(
  persist(
    (set) => ({
      sidebarOpen: true,
      activeView: 'arranger',
      isSectionsExpanded: true,

      setSidebarOpen: (sidebarOpen) => set({ sidebarOpen }),
      toggleSidebar: () => set((state) => ({ sidebarOpen: !state.sidebarOpen })),
      setActiveView: (activeView) => set({ activeView }),
      setIsSectionsExpanded: (isSectionsExpanded) => set({ isSectionsExpanded }),
    }),
    { name: 'ui-store' },
  ),
);
