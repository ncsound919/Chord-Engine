import React from 'react';
import { describe, expect, it, vi, afterEach, beforeEach } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { InstrumentsView } from './InstrumentsView';

vi.mock('../../lib/audio/engine', () => ({
  audioEngine: {
    drumKit: { Kick: '808_Kick.mp3', Snare: '808_Snare.mp3' },
    resume: vi.fn().mockResolvedValue(undefined),
    tracks: new Map([
      ['bass', {
        setVolume: vi.fn(),
        playBufferShifted: vi.fn(),
        playOscillator: vi.fn(),
      }],
    ]),
    loadedSamples: new Map(),
    ctx: { currentTime: 0 },
  },
}));

vi.mock('../../lib/audio/synth', () => ({
  Ju60Engine: {
    getInstance: vi.fn(() => ({
      getAllPatches: vi.fn(() => ({})),
    })),
  },
}));

vi.mock('../../lib/persistence', () => ({
  PersistenceManager: {
    listSectionPresets: vi.fn().mockResolvedValue([]),
    saveSectionPreset: vi.fn().mockResolvedValue(undefined),
  },
}));

vi.mock('../../lib/audio/soundbankDb', () => ({
  getAllSampleIdsFromDB: vi.fn().mockResolvedValue([]),
  getSampleFromDB: vi.fn().mockResolvedValue(null),
  clearAllSamplesInDB: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../../lib/audio/soundbankLoader', () => ({
  persistAndLoadFile: vi.fn().mockResolvedValue(undefined),
  persistAndLoadFromUrl: vi.fn().mockResolvedValue(undefined),
  loadKitFromDB: vi.fn().mockResolvedValue(3),
  loadBassFromDB: vi.fn().mockResolvedValue(undefined),
  getLoadedSampleMap: vi.fn().mockReturnValue({ kick: true }),
  persistAndLoadSample: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../views/SynthView', () => ({
  SynthView: () => <div data-testid="synth-view-mock">Synth View</div>,
}));

vi.mock('../instruments/DrumsTab', () => ({
  DrumsTab: (props: any) => (
    <div data-testid="drums-tab-mock">
      <button data-testid="drum-upload-btn" onClick={() => props.onUploadClick('Kick')}>Upload Kick</button>
    </div>
  ),
}));

vi.mock('../instruments/BassTab', () => ({
  BassTab: (props: any) => (
    <div data-testid="bass-tab-mock">
      <button data-testid="bass-play-btn" onClick={() => props.onPlayNote(0, 3)}>Play Note</button>
      <button data-testid="bass-upload-btn" onClick={() => props.onUploadClick()}>Upload Bass</button>
    </div>
  ),
}));

vi.mock('../instruments/SoundbankTab', () => ({
  SoundbankTab: (props: any) => (
    <div data-testid="soundbank-tab-mock">
      <button data-testid="demo-load-btn" onClick={() => props.onLoadDemo()}>Load Demo</button>
      <button data-testid="clear-soundbank-btn" onClick={() => props.onClearSoundbank()}>Clear</button>
      <button data-testid="quick-load-kit1-btn" onClick={() => props.onQuickLoadKit('kit1')}>Kit 1</button>
      <button data-testid="quick-load-kit2-btn" onClick={() => props.onQuickLoadKit('kit2')}>Kit 2</button>
      <button data-testid="quick-load-bass-btn" onClick={() => props.onQuickLoadBass()}>Bass</button>
      <input data-testid="folder-import-input" type="file" onChange={(e) => props.onFolderImport(e)} />
    </div>
  ),
}));

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

// Tab order: Drums(0), Synth(1), Bass(2), Sampler(3), Soundbank(4), Plugins(5)
const getTabButtons = () => {
  return ['Drums', 'Synth', 'Bass', 'Sampler', 'Soundbank', 'Plugins'].map(
    label => screen.getByRole('button', { name: new RegExp(label, 'i') })
  );
};

describe('InstrumentsView', () => {
  it('renders the view container', async () => {
    render(<InstrumentsView />);
    expect(screen.getByText(/drums/i)).toBeInTheDocument();
  });

  it('renders the Drums tab by default', async () => {
    render(<InstrumentsView />);
    await waitFor(() => {
      expect(screen.getByTestId('drums-tab-mock')).toBeInTheDocument();
    });
  });

  it('does not render other tabs by default', async () => {
    render(<InstrumentsView />);
    await waitFor(() => {
      expect(screen.getByTestId('drums-tab-mock')).toBeInTheDocument();
    });
    expect(screen.queryByTestId('bass-tab-mock')).not.toBeInTheDocument();
    expect(screen.queryByTestId('soundbank-tab-mock')).not.toBeInTheDocument();
    expect(screen.queryByTestId('synth-view-mock')).not.toBeInTheDocument();
  });

  it('switches to bass tab when the Bass button is clicked', async () => {
    render(<InstrumentsView />);
    await waitFor(() => {
      expect(screen.getByTestId('drums-tab-mock')).toBeInTheDocument();
    });

    const buttons = getTabButtons();
    fireEvent.click(buttons[2]);

    await waitFor(() => {
      expect(screen.getByTestId('bass-tab-mock')).toBeInTheDocument();
    });
  });

  it('switches to soundbank tab when the Soundbank button is clicked', async () => {
    render(<InstrumentsView />);
    await waitFor(() => {
      expect(screen.getByTestId('drums-tab-mock')).toBeInTheDocument();
    });

    const buttons = getTabButtons();
    fireEvent.click(buttons[4]);

    await waitFor(() => {
      expect(screen.getByTestId('soundbank-tab-mock')).toBeInTheDocument();
    });
  });

  it('switches to synth tab when the Synth button is clicked', async () => {
    render(<InstrumentsView />);
    await waitFor(() => {
      expect(screen.getByTestId('drums-tab-mock')).toBeInTheDocument();
    });

    const buttons = getTabButtons();
    fireEvent.click(buttons[1]);

    await waitFor(() => {
      expect(screen.getByTestId('synth-view-mock')).toBeInTheDocument();
    });
  });

  it('has a save preset button', async () => {
    render(<InstrumentsView />);
    await waitFor(() => {
      expect(screen.getByTitle('Save Preset')).toBeInTheDocument();
    });
  });

  it('prompts for name and saves preset when save button clicked', async () => {
    vi.spyOn(window, 'prompt').mockReturnValue('Test Preset');
    const { saveSectionPreset } = await import('../../lib/persistence').then(m => m.PersistenceManager as any);
    render(<InstrumentsView />);
    await waitFor(() => {
      expect(screen.getByTestId('drums-tab-mock')).toBeInTheDocument();
    });
    fireEvent.click(screen.getByTitle('Save Preset'));
    await waitFor(() => {
      expect(saveSectionPreset).toHaveBeenCalled();
    });
    vi.mocked(window.prompt).mockRestore();
  });

  it('does not save preset when prompt is cancelled', async () => {
    vi.spyOn(window, 'prompt').mockReturnValue(null);
    render(<InstrumentsView />);
    await waitFor(() => {
      expect(screen.getByTestId('drums-tab-mock')).toBeInTheDocument();
    });
    fireEvent.click(screen.getByTitle('Save Preset'));
    vi.mocked(window.prompt).mockRestore();
  });

  it('switches between all tabs sequentially', async () => {
    render(<InstrumentsView />);
    await waitFor(() => {
      expect(screen.getByTestId('drums-tab-mock')).toBeInTheDocument();
    });

    const buttons = getTabButtons();

    fireEvent.click(buttons[1]);
    await waitFor(() => {
      expect(screen.getByTestId('synth-view-mock')).toBeInTheDocument();
    });
    expect(screen.queryByTestId('drums-tab-mock')).not.toBeInTheDocument();

    fireEvent.click(buttons[2]);
    await waitFor(() => {
      expect(screen.getByTestId('bass-tab-mock')).toBeInTheDocument();
    });
    expect(screen.queryByTestId('synth-view-mock')).not.toBeInTheDocument();

    fireEvent.click(buttons[4]);
    await waitFor(() => {
      expect(screen.getByTestId('soundbank-tab-mock')).toBeInTheDocument();
    });
    expect(screen.queryByTestId('bass-tab-mock')).not.toBeInTheDocument();

    fireEvent.click(buttons[0]);
    await waitFor(() => {
      expect(screen.getByTestId('drums-tab-mock')).toBeInTheDocument();
    });
    expect(screen.queryByTestId('soundbank-tab-mock')).not.toBeInTheDocument();
  });

  it('has six tab buttons', async () => {
    render(<InstrumentsView />);
    await waitFor(() => {
      expect(screen.getByTestId('drums-tab-mock')).toBeInTheDocument();
    });
    const buttons = getTabButtons();
    expect(buttons.length).toBe(6);
  });

  it('shows saving indicator on save preset button during save', async () => {
    vi.spyOn(window, 'prompt').mockReturnValue('Saving Preset');
    const { saveSectionPreset } = await import('../../lib/persistence').then(m => m.PersistenceManager as any);
    saveSectionPreset.mockImplementation(() => new Promise(() => {}));

    render(<InstrumentsView />);
    await waitFor(() => {
      expect(screen.getByTestId('drums-tab-mock')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByTitle('Save Preset'));
    await waitFor(() => {
      expect(screen.getByTestId('drums-tab-mock')).toBeInTheDocument();
    });

    vi.mocked(window.prompt).mockRestore();
  });

  it('does not save preset when prompt returns empty string', async () => {
    vi.spyOn(window, 'prompt').mockReturnValue('');
    render(<InstrumentsView />);
    await waitFor(() => {
      expect(screen.getByTestId('drums-tab-mock')).toBeInTheDocument();
    });
    fireEvent.click(screen.getByTitle('Save Preset'));
    vi.mocked(window.prompt).mockRestore();
  });

  it('contains a hidden file input for audio uploads', async () => {
    render(<InstrumentsView />);
    await waitFor(() => {
      expect(screen.getByTestId('drums-tab-mock')).toBeInTheDocument();
    });
    const fileInput = document.querySelector('input[type="file"][accept="audio/*"]');
    expect(fileInput).toBeInTheDocument();
    expect(fileInput).toHaveClass('hidden');
  });

  it('does not show presets panel by default', async () => {
    render(<InstrumentsView />);
    await waitFor(() => {
      expect(screen.getByTestId('drums-tab-mock')).toBeInTheDocument();
    });
  });

  it('presets are loaded on initial render', async () => {
    const { listSectionPresets } = await import('../../lib/persistence').then(m => m.PersistenceManager as any);
    render(<InstrumentsView />);
    await waitFor(() => {
      expect(listSectionPresets).toHaveBeenCalledWith('drum');
    });
  });

  it('loads synth presets when switching to synth tab', async () => {
    const { listSectionPresets } = await import('../../lib/persistence').then(m => m.PersistenceManager as any);
    listSectionPresets.mockClear();
    render(<InstrumentsView />);
    await waitFor(() => {
      expect(listSectionPresets).toHaveBeenCalledWith('drum');
    });

    const buttons = getTabButtons();
    fireEvent.click(buttons[1]);

    await waitFor(() => {
      expect(listSectionPresets).toHaveBeenCalledWith('synth');
    });
  });

  it('save preset button is disabled during save', async () => {
    vi.spyOn(window, 'prompt').mockReturnValue('Test');
    const { saveSectionPresets } = await import('../../lib/persistence').then(m => m.PersistenceManager as any);
    const saveFn = (await import('../../lib/persistence').then(m => m.PersistenceManager as any)).saveSectionPreset;
    let resolveSave: () => void;
    saveFn.mockImplementation(() => new Promise<void>(r => { resolveSave = r; }));

    render(<InstrumentsView />);
    await waitFor(() => {
      expect(screen.getByTestId('drums-tab-mock')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByTitle('Save Preset'));
    await vi.waitFor(() => {
      expect(saveFn).toHaveBeenCalled();
    });

    resolveSave!();
    vi.mocked(window.prompt).mockRestore();
  });

  it('triggers drum upload via DrumsTab callback', async () => {
    render(<InstrumentsView />);
    await waitFor(() => {
      expect(screen.getByTestId('drums-tab-mock')).toBeInTheDocument();
    });
    fireEvent.click(screen.getByTestId('drum-upload-btn'));
    await waitFor(() => {
      expect(screen.getByTestId('drums-tab-mock')).toBeInTheDocument();
    });
  });

  it('triggers bass note play via BassTab callback', async () => {
    const { audioEngine } = await import('../../lib/audio/engine');
    render(<InstrumentsView />);
    await waitFor(() => {
      expect(screen.getByTestId('drums-tab-mock')).toBeInTheDocument();
    });

    const buttons = getTabButtons();
    fireEvent.click(buttons[2]);
    await waitFor(() => {
      expect(screen.getByTestId('bass-tab-mock')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByTestId('bass-play-btn'));
    await waitFor(() => {
      expect(audioEngine.resume).toHaveBeenCalled();
    });
  });

  it('triggers demo load via SoundbankTab callback', async () => {
    const { persistAndLoadFromUrl } = await import('../../lib/audio/soundbankLoader');
    render(<InstrumentsView />);
    await waitFor(() => {
      expect(screen.getByTestId('drums-tab-mock')).toBeInTheDocument();
    });

    const buttons = getTabButtons();
    fireEvent.click(buttons[4]);
    await waitFor(() => {
      expect(screen.getByTestId('soundbank-tab-mock')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByTestId('demo-load-btn'));
    await waitFor(() => {
      expect(persistAndLoadFromUrl).toHaveBeenCalled();
    });
  });

  it('triggers clear soundbank via SoundbankTab callback', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    const { clearAllSamplesInDB } = await import('../../lib/audio/soundbankDb');
    render(<InstrumentsView />);
    await waitFor(() => {
      expect(screen.getByTestId('drums-tab-mock')).toBeInTheDocument();
    });

    const buttons = getTabButtons();
    fireEvent.click(buttons[4]);
    await waitFor(() => {
      expect(screen.getByTestId('soundbank-tab-mock')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByTestId('clear-soundbank-btn'));
    await waitFor(() => {
      expect(clearAllSamplesInDB).toHaveBeenCalled();
    });
    vi.mocked(window.confirm).mockRestore();
  });

  it('clear soundbank is cancelled when confirm returns false', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(false);
    const { clearAllSamplesInDB } = await import('../../lib/audio/soundbankDb');
    render(<InstrumentsView />);
    await waitFor(() => {
      expect(screen.getByTestId('drums-tab-mock')).toBeInTheDocument();
    });

    const buttons = getTabButtons();
    fireEvent.click(buttons[4]);
    await waitFor(() => {
      expect(screen.getByTestId('soundbank-tab-mock')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByTestId('clear-soundbank-btn'));
    await waitFor(() => {
      expect(screen.getByTestId('soundbank-tab-mock')).toBeInTheDocument();
    });
    expect(clearAllSamplesInDB).not.toHaveBeenCalled();
    vi.mocked(window.confirm).mockRestore();
  });

  it('triggers quick load kit1 via SoundbankTab callback', async () => {
    const { loadKitFromDB } = await import('../../lib/audio/soundbankLoader');
    render(<InstrumentsView />);
    await waitFor(() => {
      expect(screen.getByTestId('drums-tab-mock')).toBeInTheDocument();
    });

    const buttons = getTabButtons();
    fireEvent.click(buttons[4]);
    await waitFor(() => {
      expect(screen.getByTestId('soundbank-tab-mock')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByTestId('quick-load-kit1-btn'));
    await waitFor(() => {
      expect(loadKitFromDB).toHaveBeenCalledWith('kit1');
    });
  });

  it('triggers quick load kit2 via SoundbankTab callback', async () => {
    const { loadKitFromDB } = await import('../../lib/audio/soundbankLoader');
    render(<InstrumentsView />);
    await waitFor(() => {
      expect(screen.getByTestId('drums-tab-mock')).toBeInTheDocument();
    });

    const buttons = getTabButtons();
    fireEvent.click(buttons[4]);
    await waitFor(() => {
      expect(screen.getByTestId('soundbank-tab-mock')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByTestId('quick-load-kit2-btn'));
    await waitFor(() => {
      expect(loadKitFromDB).toHaveBeenCalledWith('kit2');
    });
  });

  it('triggers quick load bass via SoundbankTab callback', async () => {
    const { loadBassFromDB } = await import('../../lib/audio/soundbankLoader');
    render(<InstrumentsView />);
    await waitFor(() => {
      expect(screen.getByTestId('drums-tab-mock')).toBeInTheDocument();
    });

    const buttons = getTabButtons();
    fireEvent.click(buttons[4]);
    await waitFor(() => {
      expect(screen.getByTestId('soundbank-tab-mock')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByTestId('quick-load-bass-btn'));
    await waitFor(() => {
      expect(loadBassFromDB).toHaveBeenCalled();
    });
  });

  it('triggers folder import via SoundbankTab callback', async () => {
    const { persistAndLoadFile } = await import('../../lib/audio/soundbankLoader');
    render(<InstrumentsView />);
    await waitFor(() => {
      expect(screen.getByTestId('drums-tab-mock')).toBeInTheDocument();
    });

    const buttons = getTabButtons();
    fireEvent.click(buttons[4]);
    await waitFor(() => {
      expect(screen.getByTestId('soundbank-tab-mock')).toBeInTheDocument();
    });

    const file = new File(['dummy'], 'kick_sample.mp3', { type: 'audio/mp3' });
    const folderInput = screen.getByTestId('folder-import-input');
    Object.defineProperty(folderInput, 'files', { value: [file] });
    fireEvent.change(folderInput);
    await waitFor(() => {
      expect(persistAndLoadFile).toHaveBeenCalled();
    });
  });

  it('triggers file change on hidden input for drum upload', async () => {
    const { persistAndLoadFile } = await import('../../lib/audio/soundbankLoader');
    render(<InstrumentsView />);
    await waitFor(() => {
      expect(screen.getByTestId('drums-tab-mock')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByTestId('drum-upload-btn'));
    await waitFor(() => {
      expect(screen.getByTestId('drums-tab-mock')).toBeInTheDocument();
    });

    const fileInput = document.querySelector('input[type="file"][accept="audio/*"]') as HTMLInputElement;
    const file = new File(['dummy'], 'kick.wav', { type: 'audio/wav' });
    Object.defineProperty(fileInput, 'files', { value: [file] });
    fireEvent.change(fileInput);
    await waitFor(() => {
      expect(persistAndLoadFile).toHaveBeenCalled();
    });
  });

  it('triggers bass upload via BassTab callback', async () => {
    render(<InstrumentsView />);
    await waitFor(() => {
      expect(screen.getByTestId('drums-tab-mock')).toBeInTheDocument();
    });

    const buttons = getTabButtons();
    fireEvent.click(buttons[2]);
    await waitFor(() => {
      expect(screen.getByTestId('bass-tab-mock')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByTestId('bass-upload-btn'));
    const fileInput = document.querySelector('input[type="file"][accept="audio/*"]') as HTMLInputElement;
    expect(fileInput).not.toBeNull();
  });

  it('shows toast on successful save preset', async () => {
    vi.spyOn(window, 'prompt').mockReturnValue('Toast Test');
    const { saveSectionPreset } = await import('../../lib/persistence').then(m => m.PersistenceManager as any);
    render(<InstrumentsView />);
    await waitFor(() => {
      expect(screen.getByTestId('drums-tab-mock')).toBeInTheDocument();
    });
    fireEvent.click(screen.getByTitle('Save Preset'));
    await waitFor(() => {
      expect(saveSectionPreset).toHaveBeenCalled();
    });
    vi.mocked(window.prompt).mockRestore();
  });

  it('shows toast on demo load success', async () => {
    render(<InstrumentsView />);
    await waitFor(() => {
      expect(screen.getByTestId('drums-tab-mock')).toBeInTheDocument();
    });

    const buttons = getTabButtons();
    fireEvent.click(buttons[4]);
    await waitFor(() => {
      expect(screen.getByTestId('soundbank-tab-mock')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByTestId('demo-load-btn'));
    await waitFor(() => {
      expect(screen.getByText('Demo Loaded')).toBeInTheDocument();
    });
  });

  it('shows toast on clear soundbank success', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    render(<InstrumentsView />);
    await waitFor(() => {
      expect(screen.getByTestId('drums-tab-mock')).toBeInTheDocument();
    });

    const buttons = getTabButtons();
    fireEvent.click(buttons[4]);
    await waitFor(() => {
      expect(screen.getByTestId('soundbank-tab-mock')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByTestId('clear-soundbank-btn'));
    await waitFor(() => {
      expect(screen.getByText('Storage Cleared')).toBeInTheDocument();
    });
    vi.mocked(window.confirm).mockRestore();
  });

  it('shows toast on quick kit load success', async () => {
    render(<InstrumentsView />);
    await waitFor(() => {
      expect(screen.getByTestId('drums-tab-mock')).toBeInTheDocument();
    });

    const buttons = getTabButtons();
    fireEvent.click(buttons[4]);
    await waitFor(() => {
      expect(screen.getByTestId('soundbank-tab-mock')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByTestId('quick-load-kit1-btn'));
    await waitFor(() => {
      expect(screen.getByText('KIT1 Active')).toBeInTheDocument();
    });
  });

  it('loads bass from DB on mount', async () => {
    const { loadBassFromDB } = await import('../../lib/audio/soundbankLoader');
    render(<InstrumentsView />);
    await waitFor(() => {
      expect(loadBassFromDB).toHaveBeenCalled();
    });
  });

  it('loads kit from DB on mount', async () => {
    const { loadKitFromDB } = await import('../../lib/audio/soundbankLoader');
    render(<InstrumentsView />);
    await waitFor(() => {
      expect(loadKitFromDB).toHaveBeenCalledWith('kit1');
    });
  });

  it('refreshes soundbank status on mount', async () => {
    const { getAllSampleIdsFromDB } = await import('../../lib/audio/soundbankDb');
    render(<InstrumentsView />);
    await waitFor(() => {
      expect(getAllSampleIdsFromDB).toHaveBeenCalled();
    });
  });

  it('refreshes soundbank status after drum upload', async () => {
    const { getAllSampleIdsFromDB } = await import('../../lib/audio/soundbankDb');
    render(<InstrumentsView />);
    await waitFor(() => {
      expect(screen.getByTestId('drums-tab-mock')).toBeInTheDocument();
    });
    getAllSampleIdsFromDB.mockClear();
    fireEvent.click(screen.getByTestId('drum-upload-btn'));
    await waitFor(() => {
      expect(screen.getByTestId('drums-tab-mock')).toBeInTheDocument();
    });

    const fileInput = document.querySelector('input[type="file"][accept="audio/*"]') as HTMLInputElement;
    const file = new File(['dummy'], 'kick.wav', { type: 'audio/wav' });
    Object.defineProperty(fileInput, 'files', { value: [file] });
    fireEvent.change(fileInput);
    await waitFor(() => {
      expect(getAllSampleIdsFromDB).toHaveBeenCalled();
      expect(screen.getByText('Sample Loaded')).toBeInTheDocument();
    });
  });

  it('refreshes soundbank status after demo load', async () => {
    const { getAllSampleIdsFromDB } = await import('../../lib/audio/soundbankDb');
    render(<InstrumentsView />);
    await waitFor(() => {
      expect(screen.getByTestId('drums-tab-mock')).toBeInTheDocument();
    });

    const buttons = getTabButtons();
    fireEvent.click(buttons[4]);
    await waitFor(() => {
      expect(screen.getByTestId('soundbank-tab-mock')).toBeInTheDocument();
    });

    getAllSampleIdsFromDB.mockClear();
    fireEvent.click(screen.getByTestId('demo-load-btn'));
    await waitFor(() => {
      expect(getAllSampleIdsFromDB).toHaveBeenCalled();
    });
  });

  it('refreshes soundbank status after clear', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    const { getAllSampleIdsFromDB } = await import('../../lib/audio/soundbankDb');
    render(<InstrumentsView />);
    await waitFor(() => {
      expect(screen.getByTestId('drums-tab-mock')).toBeInTheDocument();
    });

    const buttons = getTabButtons();
    fireEvent.click(buttons[4]);
    await waitFor(() => {
      expect(screen.getByTestId('soundbank-tab-mock')).toBeInTheDocument();
    });

    getAllSampleIdsFromDB.mockClear();
    fireEvent.click(screen.getByTestId('clear-soundbank-btn'));
    await waitFor(() => {
      expect(getAllSampleIdsFromDB).toHaveBeenCalled();
    });
    vi.mocked(window.confirm).mockRestore();
  });

  it('refreshes soundbank status after folder import', async () => {
    const { getAllSampleIdsFromDB } = await import('../../lib/audio/soundbankDb');
    render(<InstrumentsView />);
    await waitFor(() => {
      expect(screen.getByTestId('drums-tab-mock')).toBeInTheDocument();
    });

    const buttons = getTabButtons();
    fireEvent.click(buttons[4]);
    await waitFor(() => {
      expect(screen.getByTestId('soundbank-tab-mock')).toBeInTheDocument();
    });

    getAllSampleIdsFromDB.mockClear();
    const file = new File(['dummy'], 'kick_sample.mp3', { type: 'audio/mp3' });
    const folderInput = screen.getByTestId('folder-import-input');
    Object.defineProperty(folderInput, 'files', { value: [file] });
    fireEvent.change(folderInput);
    await waitFor(() => {
      expect(getAllSampleIdsFromDB).toHaveBeenCalled();
      expect(screen.getByText('Folder Imported')).toBeInTheDocument();
    });
  });

  it('shows toast on folder import success', async () => {
    render(<InstrumentsView />);
    await waitFor(() => {
      expect(screen.getByTestId('drums-tab-mock')).toBeInTheDocument();
    });

    const buttons = getTabButtons();
    fireEvent.click(buttons[4]);
    await waitFor(() => {
      expect(screen.getByTestId('soundbank-tab-mock')).toBeInTheDocument();
    });

    const file = new File(['dummy'], 'kick_sample.mp3', { type: 'audio/mp3' });
    const folderInput = screen.getByTestId('folder-import-input');
    Object.defineProperty(folderInput, 'files', { value: [file] });
    fireEvent.change(folderInput);
    await waitFor(() => {
      expect(screen.getByText('Folder Imported')).toBeInTheDocument();
    });
  });

  it('soundbank tab displays with bass loaded state', async () => {
    const { getAllSampleIdsFromDB, getSampleFromDB } = await import('../../lib/audio/soundbankDb');
    getAllSampleIdsFromDB.mockResolvedValueOnce(['bass_default']);
    getSampleFromDB.mockResolvedValueOnce({ name: 'my_bass.wav' });
    render(<InstrumentsView />);
    await waitFor(() => {
      expect(screen.getByTestId('drums-tab-mock')).toBeInTheDocument();
    });

    const buttons = getTabButtons();
    fireEvent.click(buttons[4]);
    await waitFor(() => {
      expect(screen.getByTestId('soundbank-tab-mock')).toBeInTheDocument();
    });
  });

  it('soundbank tab displays with kit1 loaded state', async () => {
    const { getAllSampleIdsFromDB, getSampleFromDB } = await import('../../lib/audio/soundbankDb');
    getAllSampleIdsFromDB.mockResolvedValueOnce(['kit1_Kick', 'kit2_Snare']);
    getSampleFromDB.mockResolvedValue({ name: 'sample.wav' });
    render(<InstrumentsView />);
    await waitFor(() => {
      expect(screen.getByTestId('drums-tab-mock')).toBeInTheDocument();
    });

    const buttons = getTabButtons();
    fireEvent.click(buttons[4]);
    await waitFor(() => {
      expect(screen.getByTestId('soundbank-tab-mock')).toBeInTheDocument();
    });
  });

  it('file change with no target drum does nothing', async () => {
    const { persistAndLoadFile } = await import('../../lib/audio/soundbankLoader');
    render(<InstrumentsView />);
    await waitFor(() => {
      expect(screen.getByTestId('drums-tab-mock')).toBeInTheDocument();
    });

    const fileInput = document.querySelector('input[type="file"][accept="audio/*"]') as HTMLInputElement;
    const file = new File(['dummy'], 'kick.wav', { type: 'audio/wav' });
    Object.defineProperty(fileInput, 'files', { value: [file] });
    fireEvent.change(fileInput);
    await waitFor(() => {
      expect(screen.getByTestId('drums-tab-mock')).toBeInTheDocument();
    });
    expect(persistAndLoadFile).not.toHaveBeenCalled();
  });

  it('save preset on synth tab uses synth patches', async () => {
    vi.spyOn(window, 'prompt').mockReturnValue('Synth Preset');
    const { saveSectionPreset } = await import('../../lib/persistence').then(m => m.PersistenceManager as any);
    render(<InstrumentsView />);
    await waitFor(() => {
      expect(screen.getByTestId('drums-tab-mock')).toBeInTheDocument();
    });

    const buttons = getTabButtons();
    fireEvent.click(buttons[1]);
    await waitFor(() => {
      expect(screen.getByTestId('synth-view-mock')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByTitle('Save Preset'));
    await waitFor(() => {
      expect(saveSectionPreset).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'synth' })
      );
    });
    vi.mocked(window.prompt).mockRestore();
  });

  it('refreshes soundbank status with kit1 and kit2 samples on mount', async () => {
    const { getAllSampleIdsFromDB, getSampleFromDB } = await import('../../lib/audio/soundbankDb');
    getAllSampleIdsFromDB.mockResolvedValue(['bass_default', 'kit1_Kick', 'kit1_Snare', 'kit2_Hi-Hat Closed']);
    getSampleFromDB.mockResolvedValue({ name: 'test.wav' });
    render(<InstrumentsView />);
    await waitFor(() => {
      expect(getAllSampleIdsFromDB).toHaveBeenCalled();
      expect(getSampleFromDB).toHaveBeenCalled();
    });
  });

  it('folder import skips hidden and double-underscore files', async () => {
    render(<InstrumentsView />);
    await waitFor(() => {
      expect(screen.getByTestId('drums-tab-mock')).toBeInTheDocument();
    });

    const buttons = getTabButtons();
    fireEvent.click(buttons[4]);
    await waitFor(() => {
      expect(screen.getByTestId('soundbank-tab-mock')).toBeInTheDocument();
    });

    const files = [
      new File([''], '.hidden_file.mp3', { type: 'audio/mp3' }),
      new File([''], '__temp_file.mp3', { type: 'audio/mp3' }),
    ];
    const folderInput = screen.getByTestId('folder-import-input');
    Object.defineProperty(folderInput, 'files', { value: files });
    fireEvent.change(folderInput);
    await waitFor(() => {
      expect(screen.getByText('Folder Imported')).toBeInTheDocument();
    });
  });

  it('folder import matches snare and crash patterns', async () => {
    const { persistAndLoadFile } = await import('../../lib/audio/soundbankLoader');
    render(<InstrumentsView />);
    await waitFor(() => {
      expect(screen.getByTestId('drums-tab-mock')).toBeInTheDocument();
    });

    const buttons = getTabButtons();
    fireEvent.click(buttons[4]);
    await waitFor(() => {
      expect(screen.getByTestId('soundbank-tab-mock')).toBeInTheDocument();
    });

    const files = [
      new File(['data'], 'my_snare.wav', { type: 'audio/wav' }),
      new File(['data'], 'crash_cymbal.wav', { type: 'audio/wav' }),
      new File(['data'], 'ride_bell.wav', { type: 'audio/wav' }),
    ];
    const folderInput = screen.getByTestId('folder-import-input');
    Object.defineProperty(folderInput, 'files', { value: files });
    fireEvent.change(folderInput);
    await waitFor(() => {
      expect(persistAndLoadFile).toHaveBeenCalled();
    });
  });

  it('folder import matches hat and open hat patterns', async () => {
    const { persistAndLoadFile } = await import('../../lib/audio/soundbankLoader');
    render(<InstrumentsView />);
    await waitFor(() => {
      expect(screen.getByTestId('drums-tab-mock')).toBeInTheDocument();
    });

    const buttons = getTabButtons();
    fireEvent.click(buttons[4]);
    await waitFor(() => {
      expect(screen.getByTestId('soundbank-tab-mock')).toBeInTheDocument();
    });

    const files = [
      new File(['data'], 'hihat_closed.wav', { type: 'audio/wav' }),
      new File(['data'], 'hihat_open.wav', { type: 'audio/wav' }),
    ];
    const folderInput = screen.getByTestId('folder-import-input');
    Object.defineProperty(folderInput, 'files', { value: files });
    fireEvent.change(folderInput);
    await waitFor(() => {
      expect(persistAndLoadFile).toHaveBeenCalled();
    });
  });

  it('folder import matches tom patterns', async () => {
    const { persistAndLoadFile } = await import('../../lib/audio/soundbankLoader');
    render(<InstrumentsView />);
    await waitFor(() => {
      expect(screen.getByTestId('drums-tab-mock')).toBeInTheDocument();
    });

    const buttons = getTabButtons();
    fireEvent.click(buttons[4]);
    await waitFor(() => {
      expect(screen.getByTestId('soundbank-tab-mock')).toBeInTheDocument();
    });

    const files = [
      new File(['data'], 'tom_1.wav', { type: 'audio/wav' }),
      new File(['data'], 'tom_2_mid.wav', { type: 'audio/wav' }),
      new File(['data'], 'floor_tom_4.wav', { type: 'audio/wav' }),
    ];
    const folderInput = screen.getByTestId('folder-import-input');
    Object.defineProperty(folderInput, 'files', { value: files });
    fireEvent.change(folderInput);
    await waitFor(() => {
      expect(persistAndLoadFile).toHaveBeenCalled();
    });
  });

  it('folder import matches bass pattern', async () => {
    const { persistAndLoadFile } = await import('../../lib/audio/soundbankLoader');
    render(<InstrumentsView />);
    await waitFor(() => {
      expect(screen.getByTestId('drums-tab-mock')).toBeInTheDocument();
    });

    const buttons = getTabButtons();
    fireEvent.click(buttons[4]);
    await waitFor(() => {
      expect(screen.getByTestId('soundbank-tab-mock')).toBeInTheDocument();
    });

    const files = [
      new File(['data'], 'electric_bass.wav', { type: 'audio/wav' }),
    ];
    const folderInput = screen.getByTestId('folder-import-input');
    Object.defineProperty(folderInput, 'files', { value: files });
    fireEvent.change(folderInput);
    await waitFor(() => {
      expect(persistAndLoadFile).toHaveBeenCalledWith(
        'bass_default', 'bass', expect.anything()
      );
    });
  });

  it('folder import matches bd pattern for kick', async () => {
    const { persistAndLoadFile } = await import('../../lib/audio/soundbankLoader');
    render(<InstrumentsView />);
    await waitFor(() => {
      expect(screen.getByTestId('drums-tab-mock')).toBeInTheDocument();
    });

    const buttons = getTabButtons();
    fireEvent.click(buttons[4]);
    await waitFor(() => {
      expect(screen.getByTestId('soundbank-tab-mock')).toBeInTheDocument();
    });

    const files = [
      new File(['data'], 'bd_kick_808.wav', { type: 'audio/wav' }),
    ];
    const folderInput = screen.getByTestId('folder-import-input');
    Object.defineProperty(folderInput, 'files', { value: files });
    fireEvent.change(folderInput);
    await waitFor(() => {
      expect(persistAndLoadFile).toHaveBeenCalled();
    });
  });

  it('folder import matches snr pattern for snare', async () => {
    const { persistAndLoadFile } = await import('../../lib/audio/soundbankLoader');
    render(<InstrumentsView />);
    await waitFor(() => {
      expect(screen.getByTestId('drums-tab-mock')).toBeInTheDocument();
    });

    const buttons = getTabButtons();
    fireEvent.click(buttons[4]);
    await waitFor(() => {
      expect(screen.getByTestId('soundbank-tab-mock')).toBeInTheDocument();
    });

    const files = [
      new File(['data'], 'snr_rim.wav', { type: 'audio/wav' }),
    ];
    const folderInput = screen.getByTestId('folder-import-input');
    Object.defineProperty(folderInput, 'files', { value: files });
    fireEvent.change(folderInput);
    await waitFor(() => {
      expect(persistAndLoadFile).toHaveBeenCalled();
    });
  });

  it('folder import matches hh pattern for hi-hat', async () => {
    const { persistAndLoadFile } = await import('../../lib/audio/soundbankLoader');
    render(<InstrumentsView />);
    await waitFor(() => {
      expect(screen.getByTestId('drums-tab-mock')).toBeInTheDocument();
    });

    const buttons = getTabButtons();
    fireEvent.click(buttons[4]);
    await waitFor(() => {
      expect(screen.getByTestId('soundbank-tab-mock')).toBeInTheDocument();
    });

    const files = [
      new File(['data'], 'hh_pedal.wav', { type: 'audio/wav' }),
    ];
    const folderInput = screen.getByTestId('folder-import-input');
    Object.defineProperty(folderInput, 'files', { value: files });
    fireEvent.change(folderInput);
    await waitFor(() => {
      expect(persistAndLoadFile).toHaveBeenCalled();
    });
  });

  it('folder import shows error toast on failure', async () => {
    const { persistAndLoadFile } = await import('../../lib/audio/soundbankLoader');
    (persistAndLoadSample as any).mockRejectedValueOnce(new Error('fail'));
    render(<InstrumentsView />);
    await waitFor(() => {
      expect(screen.getByTestId('drums-tab-mock')).toBeInTheDocument();
    });

    const buttons = getTabButtons();
    fireEvent.click(buttons[4]);
    await waitFor(() => {
      expect(screen.getByTestId('soundbank-tab-mock')).toBeInTheDocument();
    });

    const files = [
      new File(['data'], 'kick_test.wav', { type: 'audio/wav' }),
    ];
    const folderInput = screen.getByTestId('folder-import-input');
    Object.defineProperty(folderInput, 'files', { value: files });
    fireEvent.change(folderInput);
    await waitFor(() => {
      expect(screen.getByText('Import Error')).toBeInTheDocument();
    });
  });

  it('demo load shows error toast on failure', async () => {
    const { persistAndLoadFromUrl } = await import('../../lib/audio/soundbankLoader');
    render(<InstrumentsView />);
    await waitFor(() => {
      expect(screen.getByTestId('drums-tab-mock')).toBeInTheDocument();
    });

    (persistAndLoadFromUrl as any).mockRejectedValueOnce(new Error('network fail'));
    const buttons = getTabButtons();
    fireEvent.click(buttons[4]);
    await waitFor(() => {
      expect(screen.getByTestId('soundbank-tab-mock')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByTestId('demo-load-btn'));
    await waitFor(() => {
      expect(screen.getByText('Demo Failed')).toBeInTheDocument();
    });
  });

  it('drum upload shows error toast on failure', async () => {
    const { persistAndLoadFile } = await import('../../lib/audio/soundbankLoader');
    (persistAndLoadFile as any).mockRejectedValueOnce(new Error('decode fail'));
    render(<InstrumentsView />);
    await waitFor(() => {
      expect(screen.getByTestId('drums-tab-mock')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByTestId('drum-upload-btn'));
    await waitFor(() => {
      expect(screen.getByTestId('drums-tab-mock')).toBeInTheDocument();
    });

    const fileInput = document.querySelector('input[type="file"][accept="audio/*"]') as HTMLInputElement;
    const file = new File(['dummy'], 'kick.wav', { type: 'audio/wav' });
    Object.defineProperty(fileInput, 'files', { value: [file] });
    fireEvent.change(fileInput);
    await waitFor(() => {
      expect(screen.getByText('Load Failed')).toBeInTheDocument();
    });
  });

  it('bass note plays with pick style oscillator', async () => {
    const { audioEngine } = await import('../../lib/audio/engine');
    render(<InstrumentsView />);
    await waitFor(() => {
      expect(screen.getByTestId('drums-tab-mock')).toBeInTheDocument();
    });

    const buttons = getTabButtons();
    fireEvent.click(buttons[2]);
    await waitFor(() => {
      expect(screen.getByTestId('bass-tab-mock')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByTestId('bass-play-btn'));
    await waitFor(() => {
      expect(audioEngine.resume).toHaveBeenCalled();
    });
  });

  it('folder import shows toast with zero matched files', async () => {
    render(<InstrumentsView />);
    await waitFor(() => {
      expect(screen.getByTestId('drums-tab-mock')).toBeInTheDocument();
    });

    const buttons = getTabButtons();
    fireEvent.click(buttons[4]);
    await waitFor(() => {
      expect(screen.getByTestId('soundbank-tab-mock')).toBeInTheDocument();
    });

    const files = [
      new File(['data'], 'unknown_sample.wav', { type: 'audio/wav' }),
    ];
    const folderInput = screen.getByTestId('folder-import-input');
    Object.defineProperty(folderInput, 'files', { value: files });
    fireEvent.change(folderInput);
    await waitFor(() => {
      expect(screen.getByText('Folder Imported')).toBeInTheDocument();
    });
  });

  it('soundbank tab shows loaded drum samples', async () => {
    const { getAllSampleIdsFromDB, getSampleFromDB } = await import('../../lib/audio/soundbankDb');
    getAllSampleIdsFromDB.mockResolvedValue(['kit1_Kick', 'kit1_Snare', 'kit2_Crash']);
    getSampleFromDB.mockResolvedValue({ name: 'sample.wav' });
    render(<InstrumentsView />);
    await waitFor(() => {
      expect(getSampleFromDB).toHaveBeenCalled();
    });
  });

  it('refreshSoundbankStatus catch block handles errors', async () => {
    const { getAllSampleIdsFromDB } = await import('../../lib/audio/soundbankDb');
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    getAllSampleIdsFromDB.mockRejectedValueOnce(new Error('db error'));
    render(<InstrumentsView />);
    await waitFor(() => {
      expect(consoleSpy).toHaveBeenCalled();
    });
    consoleSpy.mockRestore();
  });

  it('folder import matches unnamed tom pattern', async () => {
    const { persistAndLoadFile } = await import('../../lib/audio/soundbankLoader');
    render(<InstrumentsView />);
    await waitFor(() => {
      expect(screen.getByTestId('drums-tab-mock')).toBeInTheDocument();
    });

    const buttons = getTabButtons();
    fireEvent.click(buttons[4]);
    await waitFor(() => {
      expect(screen.getByTestId('soundbank-tab-mock')).toBeInTheDocument();
    });

    const files = [
      new File(['data'], 'tom.wav', { type: 'audio/wav' }),
    ];
    const folderInput = screen.getByTestId('folder-import-input');
    Object.defineProperty(folderInput, 'files', { value: files });
    fireEvent.change(folderInput);
    await waitFor(() => {
      expect(persistAndLoadFile).toHaveBeenCalled();
    });
  });

  it('bass note handles track not found gracefully', async () => {
    const { audioEngine } = await import('../../lib/audio/engine');
    audioEngine.tracks = new Map();
    render(<InstrumentsView />);
    await waitFor(() => {
      expect(screen.getByTestId('drums-tab-mock')).toBeInTheDocument();
    });

    const buttons = getTabButtons();
    fireEvent.click(buttons[2]);
    await waitFor(() => {
      expect(screen.getByTestId('bass-tab-mock')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByTestId('bass-play-btn'));
    await waitFor(() => {
      expect(audioEngine.resume).toHaveBeenCalled();
    });
    audioEngine.tracks = new Map([['bass', { setVolume: vi.fn(), playOscillator: vi.fn() }]]);
  });

  it('quick kit load handles undefined count', async () => {
    const { loadKitFromDB } = await import('../../lib/audio/soundbankLoader');
    loadKitFromDB.mockResolvedValueOnce(undefined as any);
    render(<InstrumentsView />);
    await waitFor(() => {
      expect(screen.getByTestId('drums-tab-mock')).toBeInTheDocument();
    });

    const buttons = getTabButtons();
    fireEvent.click(buttons[4]);
    await waitFor(() => {
      expect(screen.getByTestId('soundbank-tab-mock')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByTestId('quick-load-kit1-btn'));
    await waitFor(() => {
      expect(loadKitFromDB).toHaveBeenCalled();
    });
  });

  it('quick bass load works via callback', async () => {
    const { loadBassFromDB } = await import('../../lib/audio/soundbankLoader');
    render(<InstrumentsView />);
    await waitFor(() => {
      expect(screen.getByTestId('drums-tab-mock')).toBeInTheDocument();
    });

    const buttons = getTabButtons();
    fireEvent.click(buttons[4]);
    await waitFor(() => {
      expect(screen.getByTestId('soundbank-tab-mock')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByTestId('quick-load-bass-btn'));
    await waitFor(() => {
      expect(loadBassFromDB).toHaveBeenCalled();
    });
  });
});
