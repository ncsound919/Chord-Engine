import { useState, useCallback, useEffect } from 'react';
import { SectionPreset, PersistenceManager } from '../../../lib/persistence';
import { generateDrumPattern, DrumStyle } from '../../../theory/rhythmicReframer';
import { STEPS, DRUM_KIT } from './constants';

export function useDrumGrid() {
  const [grid, setGrid] = useState<Record<string, boolean[]>>(() => {
    const init: Record<string, boolean[]> = {};
    DRUM_KIT.forEach(d => init[d] = Array(STEPS).fill(false));
    return init;
  });

  const [presets, setPresets] = useState<SectionPreset[]>([]);
  const [activePreset, setActivePreset] = useState<string | null>(null);

  const loadPresets = useCallback(async () => {
    const list = await PersistenceManager.listSectionPresets('drum');
    setPresets(list);
  }, []);

  useEffect(() => {
    loadPresets();
  }, [loadPresets]);

  const toggleStep = useCallback((drum: string, step: number) => {
    setGrid(prev => {
      const newGrid = { ...prev };
      newGrid[drum] = [...newGrid[drum]];
      newGrid[drum][step] = !newGrid[drum][step];
      return newGrid;
    });
    setActivePreset(null);
  }, []);

  const clearGrid = useCallback(() => {
    setGrid(() => {
      const init: Record<string, boolean[]> = {};
      DRUM_KIT.forEach(d => init[d] = Array(STEPS).fill(false));
      return init;
    });
    setActivePreset(null);
  }, []);

  const loadPresetPattern = useCallback((type: DrumStyle) => {
    const pattern = generateDrumPattern(type, 50, 2);
    setGrid(pattern.grid);
    setActivePreset(type);
  }, []);

  const saveUserPreset = async () => {
    const name = prompt("Drum Pattern Name:", "New Pattern");
    if (!name) return;
    await PersistenceManager.saveSectionPreset({
      id: crypto.randomUUID(),
      name,
      type: 'drum',
      data: grid,
      ownerId: ''
    });
    loadPresets();
  };

  return {
    grid,
    setGrid,
    presets,
    activePreset,
    toggleStep,
    clearGrid,
    loadPresetPattern,
    saveUserPreset
  };
}
