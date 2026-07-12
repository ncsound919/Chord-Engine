import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';

vi.mock('../components/views/RhythmGrid/../../../lib/persistence', () => ({
  PersistenceManager: {
    listSectionPresets: vi.fn().mockResolvedValue([]),
    saveSectionPreset: vi.fn().mockResolvedValue(undefined),
  },
}));

vi.mock('../components/views/RhythmGrid/../../../theory/rhythmicReframer', () => ({
  generateDrumPattern: vi.fn().mockReturnValue({
    grid: {
      Kick: [true, false, false, false, true, false, false, false],
      Snare: [false, false, false, false, true, false, false, false],
      'HH Closed': [true, false, true, false, true, false, true, false],
      'HH Open': [false, false, false, false, false, false, false, false],
      'Tom High': Array(8).fill(false),
      'Tom Mid': Array(8).fill(false),
      'Tom Floor': Array(8).fill(false),
      Crash: Array(8).fill(false),
      Ride: Array(8).fill(false),
    },
    feel: {},
  }),
}));

import { useDrumGrid } from '../components/views/RhythmGrid/useDrumGrid';
import { PersistenceManager } from '../components/views/RhythmGrid/../../../lib/persistence';
import { generateDrumPattern } from '../components/views/RhythmGrid/../../../theory/rhythmicReframer';

beforeEach(() => {
  vi.clearAllMocks();
  (PersistenceManager.listSectionPresets as any).mockResolvedValue([]);
});

describe('useDrumGrid', () => {
  it('initializes grid with all drum tracks set to false', () => {
    const { result } = renderHook(() => useDrumGrid());
    const { grid } = result.current;
    expect(Object.keys(grid)).toContain('Kick');
    expect(Object.keys(grid)).toContain('Snare');
    expect(Object.keys(grid)).toContain('HH Closed');
    expect(Object.keys(grid)).toContain('HH Open');
    expect(Object.keys(grid)).toContain('Tom High');
    expect(Object.keys(grid)).toContain('Tom Mid');
    expect(Object.keys(grid)).toContain('Tom Floor');
    expect(Object.keys(grid)).toContain('Crash');
    expect(Object.keys(grid)).toContain('Ride');
    expect(grid['Kick'].every((s: boolean) => s === false)).toBe(true);
  });

  it('grid has 32 steps per drum', () => {
    const { result } = renderHook(() => useDrumGrid());
    expect(result.current.grid['Kick']).toHaveLength(32);
    expect(result.current.grid['Snare']).toHaveLength(32);
  });

  it('loads presets on mount', async () => {
    const { waitFor } = await import('@testing-library/react');
    (PersistenceManager.listSectionPresets as any).mockResolvedValue([
      { id: 'p1', name: 'My Beat', type: 'drum', data: {} },
    ]);
    const { result } = renderHook(() => useDrumGrid());
    await waitFor(() => {
      expect(result.current.presets).toHaveLength(1);
    });
  });

  it('toggleStep toggles a step on', () => {
    const { result } = renderHook(() => useDrumGrid());
    expect(result.current.grid['Kick'][0]).toBe(false);
    act(() => {
      result.current.toggleStep('Kick', 0);
    });
    expect(result.current.grid['Kick'][0]).toBe(true);
  });

  it('toggleStep toggles a step off', () => {
    const { result } = renderHook(() => useDrumGrid());
    act(() => {
      result.current.toggleStep('Kick', 0);
    });
    expect(result.current.grid['Kick'][0]).toBe(true);
    act(() => {
      result.current.toggleStep('Kick', 0);
    });
    expect(result.current.grid['Kick'][0]).toBe(false);
  });

  it('toggleStep does not mutate other drums', () => {
    const { result } = renderHook(() => useDrumGrid());
    act(() => {
      result.current.toggleStep('Kick', 5);
    });
    expect(result.current.grid['Snare'][5]).toBe(false);
  });

  it('toggleStep clears activePreset', () => {
    const { result } = renderHook(() => useDrumGrid());
    act(() => {
      result.current.loadPresetPattern('techno');
    });
    expect(result.current.activePreset).toBe('techno');
    act(() => {
      result.current.toggleStep('Kick', 0);
    });
    expect(result.current.activePreset).toBeNull();
  });

  it('clearGrid resets all steps to false', () => {
    const { result } = renderHook(() => useDrumGrid());
    act(() => {
      result.current.toggleStep('Kick', 0);
      result.current.toggleStep('Snare', 5);
    });
    expect(result.current.grid['Kick'][0]).toBe(true);
    act(() => {
      result.current.clearGrid();
    });
    expect(result.current.grid['Kick'].every((s: boolean) => s === false)).toBe(true);
    expect(result.current.grid['Snare'].every((s: boolean) => s === false)).toBe(true);
  });

  it('clearGrid clears activePreset', () => {
    const { result } = renderHook(() => useDrumGrid());
    act(() => {
      result.current.loadPresetPattern('funk');
    });
    expect(result.current.activePreset).toBe('funk');
    act(() => {
      result.current.clearGrid();
    });
    expect(result.current.activePreset).toBeNull();
  });

  it('loadPresetPattern sets grid from generateDrumPattern', () => {
    const { result } = renderHook(() => useDrumGrid());
    act(() => {
      result.current.loadPresetPattern('techno');
    });
    expect(generateDrumPattern).toHaveBeenCalledWith('techno', 50, 2);
    expect(result.current.grid['Kick'][0]).toBe(true);
    expect(result.current.activePreset).toBe('techno');
  });

  it('loadPresetPattern updates activePreset', () => {
    const { result } = renderHook(() => useDrumGrid());
    act(() => {
      result.current.loadPresetPattern('jazz');
    });
    expect(result.current.activePreset).toBe('jazz');
  });

  it('activePreset starts as null', () => {
    const { result } = renderHook(() => useDrumGrid());
    expect(result.current.activePreset).toBeNull();
  });

  it('setGrid updates the grid', () => {
    const { result } = renderHook(() => useDrumGrid());
    const newGrid: Record<string, boolean[]> = {
      Kick: Array(32).fill(true),
      Snare: Array(32).fill(false),
      'HH Closed': Array(32).fill(false),
      'HH Open': Array(32).fill(false),
      'Tom High': Array(32).fill(false),
      'Tom Mid': Array(32).fill(false),
      'Tom Floor': Array(32).fill(false),
      Crash: Array(32).fill(false),
      Ride: Array(32).fill(false),
    };
    act(() => {
      result.current.setGrid(newGrid);
    });
    expect(result.current.grid['Kick'].every((s: boolean) => s === true)).toBe(true);
  });

  it('presets starts as empty array', () => {
    const { result } = renderHook(() => useDrumGrid());
    expect(result.current.presets).toEqual([]);
  });

  it('saveUserPreset does nothing when prompt is cancelled', async () => {
    vi.spyOn(globalThis, 'prompt').mockReturnValue(null);
    const { result } = renderHook(() => useDrumGrid());
    await act(async () => {
      await result.current.saveUserPreset();
    });
    expect(PersistenceManager.saveSectionPreset).not.toHaveBeenCalled();
    vi.restoreAllMocks();
  });

  it('saveUserPreset does nothing when prompt returns empty string', async () => {
    vi.spyOn(globalThis, 'prompt').mockReturnValue('');
    const { result } = renderHook(() => useDrumGrid());
    await act(async () => {
      await result.current.saveUserPreset();
    });
    expect(PersistenceManager.saveSectionPreset).not.toHaveBeenCalled();
    vi.restoreAllMocks();
  });

  it('saveUserPreset saves when name is provided', async () => {
    vi.spyOn(globalThis, 'prompt').mockReturnValue('My New Beat');
    (PersistenceManager.listSectionPresets as any).mockResolvedValue([
      { id: 'p1', name: 'My Beat', type: 'drum', data: {} },
    ]);
    const { result } = renderHook(() => useDrumGrid());
    await act(async () => {
      await result.current.saveUserPreset();
    });
    expect(PersistenceManager.saveSectionPreset).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'My New Beat',
        type: 'drum',
      }),
    );
    vi.restoreAllMocks();
  });

  it('saveUserPreset reloads presets after saving', async () => {
    const { waitFor } = await import('@testing-library/react');
    vi.spyOn(globalThis, 'prompt').mockReturnValue('New Beat');
    (PersistenceManager.listSectionPresets as any).mockResolvedValue([
      { id: 'p1', name: 'Old Beat', type: 'drum', data: {} },
    ]);
    const { result } = renderHook(() => useDrumGrid());
    await act(async () => {
      await result.current.saveUserPreset();
    });
    await waitFor(() => {
      expect(PersistenceManager.listSectionPresets).toHaveBeenCalledWith('drum');
    });
    vi.restoreAllMocks();
  });

  it('saveUserPreset generates UUID for preset id', async () => {
    vi.spyOn(globalThis, 'prompt').mockReturnValue('Test');
    const { result } = renderHook(() => useDrumGrid());
    await act(async () => {
      await result.current.saveUserPreset();
    });
    expect(PersistenceManager.saveSectionPreset).toHaveBeenCalledWith(
      expect.objectContaining({
        id: expect.any(String),
      }),
    );
    vi.restoreAllMocks();
  });

  it('saveUserPreset includes current grid data', async () => {
    vi.spyOn(globalThis, 'prompt').mockReturnValue('Beat');
    const { result } = renderHook(() => useDrumGrid());
    act(() => {
      result.current.toggleStep('Kick', 0);
    });
    await act(async () => {
      await result.current.saveUserPreset();
    });
    expect(PersistenceManager.saveSectionPreset).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          Kick: expect.arrayContaining([true]),
        }),
      }),
    );
    vi.restoreAllMocks();
  });
});
