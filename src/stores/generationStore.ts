import { create } from 'zustand';
import { SectionDef, GeneratedSection } from '../lib/engine';
import { WriterId } from '../theory/songFraming';
import { ReframeTarget } from '../theory/rhythmicReframer';
import { runGenerationPipeline, compileAndGenerate, applySubstitution, applyCriticFix } from '../lib/generatePipeline';

interface GenerationState {
  musicKey: string;
  seed: string;
  sections: SectionDef[];
  generated: GeneratedSection[];
  writerWeights: Record<WriterId, number>;
  reframeTarget: 'none' | ReframeTarget;
  activeReframeSec: number;

  setMusicKey: (key: string) => void;
  setSeed: (seed: string) => void;
  randomizeSeed: () => void;
  setSections: (sections: SectionDef[]) => void;
  setGenerated: (generated: GeneratedSection[]) => void;
  addSection: () => void;
  removeSection: (id: string) => void;
  moveSectionUp: (index: number) => void;
  moveSectionDown: (index: number) => void;
  updateSection: (id: string, updates: Partial<SectionDef>) => void;
  setWriterWeights: (weights: Record<WriterId, number> | ((prev: Record<WriterId, number>) => Record<WriterId, number>)) => void;
  setReframeTarget: (target: 'none' | ReframeTarget) => void;
  setActiveReframeSec: (sec: number) => void;
  handleGenerate: () => void;
  handleCompileSong: () => void;
  handleSubstitute: (secIdx: number, chordIdx: number, subType: string) => void;
  handleApplyCriticFix: (secIdx: number, bar: number, fixType: 'resubstitute' | 'revoice' | 'reposition' | 'thin_voicing' | 'add_motion') => void;
}

export const useGenerationStore = create<GenerationState>((set, get) => ({
  musicKey: 'F',
  seed: 'steely-dan-vibes',
  sections: [
    { id: '1', name: 'Verse 1', preset: 'steely', lengthBars: 8 },
    { id: '2', name: 'Chorus', preset: 'isley', lengthBars: 8 },
  ],
  generated: [],
  writerWeights: {
    bacharach: 100,
    sylvers: 0,
    mayfield: 0,
    sly_stone: 0,
    steely_dan: 0,
  },
  reframeTarget: 'none' as const,
  activeReframeSec: 0,

  setMusicKey: (musicKey) => set({ musicKey }),
  setSeed: (seed) => set({ seed }),
  randomizeSeed: () => set({ seed: Math.random().toString(36).substring(2, 10) }),
  setSections: (sections) => set({ sections }),
  setGenerated: (generated) => set({ generated }),
  addSection: () => set((state) => ({
    sections: [...state.sections, {
      id: crypto.randomUUID(),
      name: `Section ${state.sections.length + 1}`,
      preset: 'steely' as const,
      lengthBars: 8,
    }],
  })),
  removeSection: (id) => set((state) => ({
    sections: state.sections.filter(s => s.id !== id),
  })),
  moveSectionUp: (index) => set((state) => {
    if (index === 0) return state;
    const next = [...state.sections];
    const temp = next[index - 1];
    next[index - 1] = next[index];
    next[index] = temp;
    return { sections: next };
  }),
  moveSectionDown: (index) => set((state) => {
    if (index === state.sections.length - 1) return state;
    const next = [...state.sections];
    const temp = next[index + 1];
    next[index + 1] = next[index];
    next[index] = temp;
    return { sections: next };
  }),
  updateSection: (id, updates) => set((state) => ({
    sections: state.sections.map(s => s.id === id ? { ...s, ...updates } : s),
  })),
  setWriterWeights: (writerWeights) => {
    if (typeof writerWeights === 'function') {
      set((state) => ({ writerWeights: writerWeights(state.writerWeights) }));
    } else {
      set({ writerWeights });
    }
  },
  setReframeTarget: (reframeTarget) => set({ reframeTarget }),
  setActiveReframeSec: (activeReframeSec) => set({ activeReframeSec }),

  handleGenerate: () => {
    const state = get();
    const generated = runGenerationPipeline({
      musicKey: state.musicKey,
      seed: state.seed,
      sections: state.sections,
      writerWeights: state.writerWeights,
      reframeTarget: state.reframeTarget,
    });
    set({ generated });
  },

  handleCompileSong: () => {
    const state = get();
    const { sections, generated } = compileAndGenerate({
      musicKey: state.musicKey,
      seed: state.seed,
      sections: state.sections,
      writerWeights: state.writerWeights,
      reframeTarget: state.reframeTarget,
    });
    set({ sections, generated });
  },

  handleSubstitute: (secIdx, chordIdx, subType) => {
    const state = get();
    const generated = applySubstitution(
      state.generated, secIdx, chordIdx, subType, state.musicKey, state.seed
    );
    set({ generated });
  },

  handleApplyCriticFix: (secIdx, bar, fixType) => {
    const state = get();
    const generated = applyCriticFix(
      state.generated, secIdx, bar, fixType, state.musicKey, state.seed
    );
    set({ generated });
  },
}));
