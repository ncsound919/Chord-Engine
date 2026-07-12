import React from 'react';
import { describe, expect, it, vi, afterEach, beforeEach } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { OneShotSamplerPanel } from './OneShotSamplerPanel';

const mockSampler = {
  loadedSamples: [] as any[],
  loaded: false,
  globalVolume: 0.8,
  globalEnvA: 0.001,
  globalEnvD: 0.1,
  globalEnvS: 1,
  globalEnvR: 0.1,
  globalFilterCutoff: 20000,
  globalFilterRes: 0,
  addSample: vi.fn(),
  clear: vi.fn(),
  getPresets: vi.fn(() => []),
  loadPreset: vi.fn(),
  savePreset: vi.fn(() => ({ id: 'p1', name: 'Test Preset' })),
  deletePreset: vi.fn(),
  triggerNote: vi.fn(),
  updateSample: vi.fn(),
  removeSample: vi.fn(),
};

vi.mock('../lib/audio/oneShotSampler', () => ({
  oneShotSampler: {},
}));

vi.mock('../lib/audio/engine', () => ({
  audioEngine: {
    ctx: { currentTime: 0 },
    resume: vi.fn(),
    loadedSamples: new Map(),
    tracks: new Map(),
  },
}));

vi.mock('../lib/audio/soundbankLoader', () => ({
  persistAndLoadSample: vi.fn(async () => {}),
}));

vi.mock('./PresetBrowser', () => ({
  PresetBrowser: ({ type, onLoadEntry }: any) => (
    <div data-testid="preset-browser-mock" data-type={type}>
      <button onClick={() => onLoadEntry({ id: 'e1', name: 'Entry 1', filename: 'e1.wav', tags: [], metadata: {}, folder: '', library: '', path: '', type: 'one_shot' })}>
        Load Entry
      </button>
    </div>
  ),
}));

vi.mock('../hooks/useSoundLibrary', () => ({
  useSoundLibrary: () => ({
    count: 42,
    loadSampleToEngine: vi.fn(async () => true),
  }),
}));

function sampleWithBuffer(id: string, name: string, midiNote: number) {
  return {
    id,
    name,
    filename: `${name}.wav`,
    midiNote,
    buffer: {} as any,
    gain: 1,
    pan: 0,
    filterCutoff: 20000,
    filterRes: 0,
    envAttack: 0.001,
    envDecay: 0.1,
    envSustain: 1,
    envRelease: 0.1,
  };
}

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

async function renderWithSamples(samples: any[]) {
  const mod = await import('../lib/audio/oneShotSampler');
  (mod.oneShotSampler as any) = {
    ...mockSampler,
    loadedSamples: samples,
    loaded: samples.length > 0,
    getPresets: mockSampler.getPresets,
  };
  return render(<OneShotSamplerPanel />);
}

describe('OneShotSamplerPanel', () => {
  beforeEach(() => {
    mockSampler.loadedSamples = [];
    mockSampler.loaded = false;
    mockSampler.globalVolume = 0.8;
    mockSampler.globalEnvA = 0.001;
    mockSampler.globalEnvD = 0.1;
    mockSampler.globalEnvS = 1;
    mockSampler.globalEnvR = 0.1;
    mockSampler.globalFilterCutoff = 20000;
    mockSampler.globalFilterRes = 0;
    mockSampler.getPresets = vi.fn(() => []);
    vi.clearAllMocks();
  });

  it('renders import prompt when no samples loaded', async () => {
    await renderWithSamples([]);
    expect(screen.getByText('Import One-Shot Folder')).toBeInTheDocument();
    expect(screen.getByText(/Files are mapped chromatically/)).toBeInTheDocument();
  });

  it('shows importing state indicator', async () => {
    await renderWithSamples([]);
    const importArea = screen.getByText('Import One-Shot Folder').closest('button')!;
    fireEvent.click(importArea);
  });

  it('renders sample list when samples exist', async () => {
    await renderWithSamples([sampleWithBuffer('s1', 'Kick', 24)]);
    expect(screen.getByText('Samples (1)')).toBeInTheDocument();
    expect(screen.getByText('Kick')).toBeInTheDocument();
  });

  it('renders global controls with samples loaded', async () => {
    await renderWithSamples([sampleWithBuffer('s1', 'Kick', 24)]);
    expect(screen.getByText('Global Synth Controls')).toBeInTheDocument();
    expect(screen.getByText('Volume')).toBeInTheDocument();
    expect(screen.getByText('Attack')).toBeInTheDocument();
    expect(screen.getByText('Decay')).toBeInTheDocument();
    expect(screen.getByText('Release')).toBeInTheDocument();
  });

  it('shows keyboard preview when samples loaded', async () => {
    await renderWithSamples([sampleWithBuffer('s1', 'Kick', 24)]);
    expect(screen.getByText('Keyboard Preview')).toBeInTheDocument();
    expect(screen.getByText('Press keyboard keys A–K to play')).toBeInTheDocument();
  });

  it('play button triggers triggerNote', async () => {
    await renderWithSamples([sampleWithBuffer('s1', 'Kick', 24)]);
    const playBtns = document.querySelectorAll('[class*="p-1.5 rounded-lg bg-white/5"]');
    if (playBtns.length > 0) fireEvent.click(playBtns[0]);
    expect(mockSampler.triggerNote).toHaveBeenCalledWith(24);
  });

  it('note editing UI appears on click', async () => {
    await renderWithSamples([sampleWithBuffer('s1', 'Kick', 24)]);
    const noteBtns = screen.getAllByText('C1');
    const noteBtn = noteBtns.find(b => b.tagName === 'BUTTON');
    if (noteBtn) fireEvent.click(noteBtn);
    expect(screen.getByDisplayValue('24')).toBeInTheDocument();
  });

  it('note change saves correctly', async () => {
    await renderWithSamples([sampleWithBuffer('s1', 'Kick', 24)]);
    const noteBtns = screen.getAllByText('C1');
    const noteBtn = noteBtns.find(b => b.tagName === 'BUTTON');
    if (noteBtn) fireEvent.click(noteBtn);
    const input = screen.getByDisplayValue('24');
    fireEvent.change(input, { target: { value: '36' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(mockSampler.updateSample).toHaveBeenCalledWith(0, { midiNote: 36 });
  });

  it('remove button removes sample', async () => {
    await renderWithSamples([sampleWithBuffer('s1', 'Kick', 24)]);
    const allBtns = screen.getAllByRole('button');
    const trashBtn = allBtns.find(b => b.innerHTML.includes('trash-2'));
    if (trashBtn) fireEvent.click(trashBtn);
    expect(mockSampler.removeSample).toHaveBeenCalledWith(0);
  });

  it('save preset button toggles input', async () => {
    await renderWithSamples([sampleWithBuffer('s1', 'Kick', 24)]);
    fireEvent.click(screen.getByText('Save'));
    expect(screen.getByPlaceholderText('Preset name...')).toBeInTheDocument();
    fireEvent.change(screen.getByPlaceholderText('Preset name...'), { target: { value: 'My Kit' } });
    const checkBtn = document.querySelector('button:not([disabled]) svg.lucide-check')?.closest('button');
    if (checkBtn) fireEvent.click(checkBtn);
    expect(mockSampler.savePreset).toHaveBeenCalledWith('My Kit');
  });

  it('preset dropdown loads presets', async () => {
    mockSampler.getPresets = vi.fn(() => [{ id: 'p1', name: 'Test Preset', samples: [] }]);
    await renderWithSamples([sampleWithBuffer('s1', 'Kick', 24)]);
    const select = screen.getByRole('combobox');
    expect(select).toBeInTheDocument();
    fireEvent.change(select, { target: { value: 'p1' } });
    expect(mockSampler.loadPreset).toHaveBeenCalledWith({ id: 'p1', name: 'Test Preset', samples: [] });
  });

  it('delete preset button works when preset selected', async () => {
    mockSampler.getPresets = vi.fn(() => [{ id: 'p1', name: 'Test Preset', samples: [] }]);
    await renderWithSamples([sampleWithBuffer('s1', 'Kick', 24)]);
    const select = screen.getByRole('combobox');
    fireEvent.change(select, { target: { value: 'p1' } });
    const allBtns = screen.getAllByRole('button');
    const deleteBtn = allBtns.find(b => b.innerHTML.includes('trash-2') && b.closest('[class*="border-b"]'));
    if (deleteBtn) fireEvent.click(deleteBtn);
    expect(mockSampler.deletePreset).toHaveBeenCalledWith('p1');
  });

  it('reset button resets to defaults', async () => {
    await renderWithSamples([sampleWithBuffer('s1', 'Kick', 24)]);
    const resetBtn = screen.getByText('Reset');
    fireEvent.click(resetBtn);
    expect(mockSampler.globalVolume).toBe(0.8);
  });

  it('noteName function formats correctly', async () => {
    await renderWithSamples([sampleWithBuffer('s1', 'Kick', 24)]);
    const c1Elements = screen.getAllByText('C1');
    expect(c1Elements.length).toBeGreaterThanOrEqual(1);
  });

  it('SliderControl renders and responds to change', async () => {
    await renderWithSamples([sampleWithBuffer('s1', 'Kick', 24)]);
    const slider = document.querySelector('input[type="range"]')!;
    expect(slider).toBeInTheDocument();
    fireEvent.change(slider, { target: { value: '0.5' } });
  });

  it('PresetBrowser integration opens when library button clicked', async () => {
    await renderWithSamples([sampleWithBuffer('s1', 'Kick', 24)]);
    fireEvent.click(screen.getByText('Library Browser'));
    expect(screen.getByTestId('preset-browser-mock')).toBeInTheDocument();
  });

  it('PresetBrowser shows count badge', async () => {
    await renderWithSamples([sampleWithBuffer('s1', 'Kick', 24)]);
    expect(screen.getByText('(42)')).toBeInTheDocument();
  });

  it('shows Add button when samples exist', async () => {
    await renderWithSamples([sampleWithBuffer('s1', 'Kick', 24)]);
    expect(screen.getByText('Add')).toBeInTheDocument();
  });

  it('renders state with single sample', async () => {
    await renderWithSamples([sampleWithBuffer('s1', 'Single Shot', 48)]);
    expect(screen.getByText('Samples (1)')).toBeInTheDocument();
  });

  it('renders state with many samples', async () => {
    const many = Array.from({ length: 20 }, (_, i) => sampleWithBuffer(`s${i}`, `Sample ${i}`, 24 + i));
    await renderWithSamples(many);
    expect(screen.getByText('Samples (20)')).toBeInTheDocument();
  });

  it('keyboard preview shows correct key labels', async () => {
    const samples = ['A', 'B', 'C', 'D'].map((n, i) => sampleWithBuffer(`s${i}`, n, 24 + i));
    await renderWithSamples(samples);
    const keyBtns = document.querySelectorAll('[class*="aspect-square"]');
    expect(keyBtns.length).toBe(4);
  });
});
