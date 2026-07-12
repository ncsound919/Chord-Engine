import { render, screen, cleanup, fireEvent, waitFor } from '@testing-library/react';
import { vi, test, expect, afterEach, beforeEach, describe } from 'vitest';
import App from './App';
import { PersistenceManager } from './lib/persistence';
import { generateProgression } from './lib/engine';
import { useGenerationStore } from './stores/generationStore';
import { useProjectStore } from './stores/projectStore';
import { useUiStore } from './stores/uiStore';

vi.stubGlobal('crypto', {
  ...(typeof globalThis !== 'undefined' && globalThis.crypto ? globalThis.crypto : {}),
  randomUUID: vi.fn(() => 'mock-uuid-123'),
});

const { mockJu60EngineInstance, mockTransport, mockUseRecording } = vi.hoisted(() => {
  const mockJu60EngineInstance = {
    setupChannel: vi.fn(),
    triggerNote: vi.fn(),
    allNotesOff: vi.fn(),
    getPatch: vi.fn(() => ({})),
    updatePatch: vi.fn(),
  };

  const mockTransport: any = {
    isPlaying: false,
    tempo: 85,
    subscribe: vi.fn(() => () => {}),
    start: vi.fn(),
    stop: vi.fn(),
    reset: vi.fn(),
    getCurrentBeat: vi.fn(() => 0),
    addStopCallback: vi.fn(() => vi.fn()),
    addBeatCallback: vi.fn(() => vi.fn()),
  };

  const mockUseRecording = {
    isRecording: false,
    startRecording: vi.fn(),
    stopRecording: vi.fn(),
    toggleRecording: vi.fn(),
  };

  return { mockJu60EngineInstance, mockTransport, mockUseRecording };
});

vi.mock('./lib/audio/engine', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./lib/audio/engine')>();
  return {
    ...actual,
    audioEngine: {
      ...actual.audioEngine,
      ready: Promise.resolve(),
      start: vi.fn(),
      addTrack: vi.fn().mockReturnValue({ getDryNode: vi.fn() }),
      loadedSamples: new Map(),
      drumKit: {},
      masterLimiter: { connect: vi.fn(), disconnect: vi.fn() },
      ctx: { state: 'running', createMediaStreamDestination: () => ({ stream: {} }), resume: vi.fn() },
    },
    transport: mockTransport,
  };
});

vi.mock('./lib/audio/synth', () => ({
  Ju60Engine: { getInstance: vi.fn(() => mockJu60EngineInstance) },
}));

vi.mock('./lib/audio/sequencer', () => ({
  sequencer: { setSections: vi.fn() },
}));

vi.mock('./hooks/useRecording', () => ({
  useRecording: vi.fn(() => mockUseRecording),
}));

vi.mock('./lib/persistence', () => ({
  PersistenceManager: {
    saveProject: vi.fn(),
    listUserProjects: vi.fn().mockResolvedValue([]),
  },
}));

vi.mock('./lib/engine', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./lib/engine')>();
  return {
    ...actual,
    generateProgression: vi.fn(() => []),
    substituteChord: vi.fn(() => ({ roman: 'I', chordName: 'Cmaj7' })),
    hydrateSectionChords: vi.fn((chords: any[]) => chords),
    KEYS: ['C', 'C#', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'Ab', 'A', 'Bb', 'B'],
  };
});

vi.mock('./lib/prng', () => ({
  createPRNG: vi.fn(() => () => Math.random()),
}));

vi.mock('./theory/harmony', () => ({
  buildNodeSet: vi.fn(() => ({})),
  scoreTransition: vi.fn(() => 0),
  PRESET_PROFILES: {},
}));

vi.mock('./theory/pitch', () => ({
  chordTonesForQuality: vi.fn(() => []),
  midiToNoteName: vi.fn(() => 'C4'),
  KEYS: ['C', 'C#', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'Ab', 'A', 'Bb', 'B'],
}));

vi.mock('./theory/voicing', () => ({
  generateVoicingCandidates: vi.fn(() => []),
  pickBestVoicing: vi.fn(() => null),
  generateBassNote: vi.fn(() => null),
}));

vi.mock('./theory/fretboard', () => ({
  generateFingerableShapes: vi.fn(() => []),
  pickBestGuitarShape: vi.fn(() => null),
}));

vi.mock('./theory/arcPlanner', () => ({
  planSongArc: vi.fn(() => ({ sections: [] })),
}));

vi.mock('./theory/melody', () => ({
  generateMelodyForSection: vi.fn(() => []),
}));

vi.mock('./theory/songFraming', () => ({
  WriterId: 'bacharach',
  WRITER_PROFILES: {},
  SECTION_ROLE_PROFILES: {},
  resolveBlendedProfile: vi.fn(() => ({ sections: [], devices: {} })),
  frameSong: vi.fn(() => ({ sections: [], devices: {} })),
}));

vi.mock('./theory/rhythmicReframer', () => ({
  ReframeTarget: 'boom_bap',
  reframeSong: vi.fn(() => []),
  TIME_FEEL_PRESETS: {},
}));

vi.mock('./components/TransportBar', () => ({
  TransportBar: () => <div data-testid="transport-bar" />,
}));

vi.mock('./components/LeadSheet', () => ({
  LeadSheet: () => <div data-testid="lead-sheet" />,
}));

vi.mock('./components/views/MixerView', () => ({
  MixerView: () => <div data-testid="mixer-view" />,
}));

vi.mock('./components/views/InstrumentsView', () => ({
  InstrumentsView: () => <div data-testid="instruments-view" />,
}));

vi.mock('./components/views/RhythmGrid', () => ({
  RhythmGrid: () => <div data-testid="rhythm-grid" />,
}));

vi.mock('./components/views/PartsView', () => ({
  PartsView: () => <div data-testid="parts-view" />,
}));

vi.mock('./components/ArrangementCriticPanel', () => ({
  ArrangementCriticPanel: () => <div data-testid="arrangement-critic-panel" />,
}));

vi.mock('./components/views/OntologyBlenderView', () => ({
  OntologyBlenderView: () => <div data-testid="ontology-blender-view" />,
}));

vi.mock('./components/views/MpcReframerView', () => ({
  MpcReframerView: () => <div data-testid="mpc-reframer-view" />,
}));

const GEN_INIT = useGenerationStore.getState();
const PROJ_INIT = useProjectStore.getState();
const UI_INIT = useUiStore.getState();

beforeEach(() => {
  useGenerationStore.setState({
    ...GEN_INIT,
    musicKey: 'F',
    seed: 'steely-dan-vibes',
    sections: [
      { id: '1', name: 'Verse 1', preset: 'steely' as const, lengthBars: 8 },
      { id: '2', name: 'Chorus', preset: 'isley' as const, lengthBars: 8 },
    ],
    generated: [],
    writerWeights: { bacharach: 100, sylvers: 0, mayfield: 0, sly_stone: 0, steely_dan: 0 },
    reframeTarget: 'none' as const,
    activeReframeSec: 0,
  });
  useProjectStore.setState({
    ...PROJ_INIT,
    projectId: 'mock-uuid-123',
    projectName: 'Untitled Project',
    isSaving: false,
    saveError: null,
    userProjects: [],
    isProjectListOpen: false,
  });
  useUiStore.setState({
    ...UI_INIT,
    sidebarOpen: true,
    activeView: 'arranger',
    isSectionsExpanded: true,
  });
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('App', () => {
  test('renders without crashing (smoke)', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const { container } = render(<App />);
    expect(container).toBeTruthy();
    warn.mockRestore();
  });

  test('renders the app title', () => {
    render(<App />);
    expect(screen.getByText(/Chord Engine/)).toBeInTheDocument();
  });

  test('renders transport bar', () => {
    render(<App />);
    expect(screen.getByTestId('transport-bar')).toBeInTheDocument();
  });

  test('renders the sidebar with session parameters', () => {
    render(<App />);
    expect(screen.getByText(/Session Parameters/)).toBeInTheDocument();
  });

  test('renders all workspace view buttons', () => {
    render(<App />);
    const buttons = screen.getAllByRole('button');
    const workspaceButtons = buttons.filter(b =>
      b.textContent && (
        b.textContent.includes('Arranger') ||
        b.textContent.includes('Ontology Blender') ||
        b.textContent.includes('MPC Re-framer') ||
        b.textContent.includes('Rhythm Grid') ||
        b.textContent.includes('Instruments') ||
        b.textContent.includes('Parts & Score') ||
        b.textContent.includes('Console Mixer')
      )
    );
    expect(workspaceButtons.length).toBeGreaterThanOrEqual(7);
  });

  test('navigates to mixer view when clicking Console Mixer button', () => {
    render(<App />);
    const mixerBtn = screen.getAllByRole('button').find(b => b.textContent?.includes('Console Mixer'))!;
    fireEvent.click(mixerBtn);
    expect(screen.getByTestId('mixer-view')).toBeInTheDocument();
  });

  test('navigates to parts view when clicking Parts & Score button', () => {
    render(<App />);
    const btn = screen.getAllByRole('button').find(b => b.textContent?.includes('Parts & Score'))!;
    fireEvent.click(btn);
    expect(screen.getByTestId('parts-view')).toBeInTheDocument();
  });

  test('navigates to instruments view when clicking Instruments button', () => {
    render(<App />);
    const btn = screen.getAllByRole('button').find(b => b.textContent?.includes('Instruments'))!;
    fireEvent.click(btn);
    expect(screen.getByTestId('instruments-view')).toBeInTheDocument();
  });

  test('navigates to rhythm view when clicking Rhythm Grid button', () => {
    render(<App />);
    const btn = screen.getAllByRole('button').find(b => b.textContent?.includes('Rhythm Grid'))!;
    fireEvent.click(btn);
    expect(screen.getByTestId('rhythm-grid')).toBeInTheDocument();
  });

  test('navigates to blender view when clicking Ontology Blender button', () => {
    render(<App />);
    const btn = screen.getAllByRole('button').find(b => b.textContent?.includes('Ontology Blender'))!;
    fireEvent.click(btn);
    expect(screen.getByTestId('ontology-blender-view')).toBeInTheDocument();
  });

  test('navigates to reframer view when clicking MPC Re-framer button', () => {
    render(<App />);
    const btn = screen.getAllByRole('button').find(b => b.textContent?.includes('MPC Re-framer'))!;
    fireEvent.click(btn);
    expect(screen.getByTestId('mpc-reframer-view')).toBeInTheDocument();
  });

  test('renders the seed input field', () => {
    render(<App />);
    expect(screen.getByDisplayValue('steely-dan-vibes')).toBeInTheDocument();
  });

  test('renders the project name input', () => {
    render(<App />);
    expect(screen.getByDisplayValue('Untitled Project')).toBeInTheDocument();
  });

  test('renders the generate full score button', () => {
    render(<App />);
    expect(screen.getByText(/Generate Full Score/)).toBeInTheDocument();
  });

  test('clicking Generate Full Score button calls generation functions', async () => {
    const genPipe = await import('./lib/generatePipeline');
    const runSpy = vi.spyOn(genPipe, 'runGenerationPipeline').mockImplementation(() => []);

    render(<App />);
    runSpy.mockClear();

    fireEvent.click(screen.getByText('Generate Full Score'));

    await waitFor(() => {
      expect(runSpy).toHaveBeenCalled();
    });
  });

  test('renders lead sheet in arranger view', () => {
    render(<App />);
    // LeadSheet renders even with empty sections
    expect(screen.getByTestId('lead-sheet')).toBeInTheDocument();
  });

  test('clicking add section button adds a new section', () => {
    render(<App />);
    // Default sections are "Verse 1" and "Chorus"
    const verseInput = screen.getByDisplayValue('Verse 1');
    const chorusInput = screen.getByDisplayValue('Chorus');
    expect(verseInput).toBeInTheDocument();
    expect(chorusInput).toBeInTheDocument();

    fireEvent.click(screen.getByText('+ ADD SECTION'));

    // New section named "Section 3"
    expect(screen.getByDisplayValue('Section 3')).toBeInTheDocument();
  });

  test('removing a section removes it from the list', () => {
    render(<App />);
    const initialCount = screen.getAllByRole('textbox').filter(
      el => el.getAttribute('value')?.match(/^(Verse 1|Chorus|Section \d)$/)
    ).length;

    // Hover to reveal buttons, then click Delete on first section
    const groupDiv = screen.getByDisplayValue('Verse 1').closest('.group')!;
    fireEvent.mouseEnter(groupDiv);
    const deleteButtons = screen.getAllByTitle('Delete');
    fireEvent.click(deleteButtons[0]);

    expect(screen.queryByDisplayValue('Verse 1')).not.toBeInTheDocument();
  });

  test('moving a section up reorders the sections', () => {
    render(<App />);
    // Add a third section first
    fireEvent.click(screen.getByText('+ ADD SECTION'));

    // Now: Verse 1, Chorus, Section 3
    const groupDiv = screen.getByDisplayValue('Section 3').closest('.group')!;
    fireEvent.mouseEnter(groupDiv);
    const moveUpButtons = screen.getAllByTitle('Move Up');
    // The "Section 3" section is index 2
    fireEvent.click(moveUpButtons[2]);

    // Section 3 should now be in position 1 (0-indexed), i.e. second
    expect(screen.getByDisplayValue('Chorus')).toBeInTheDocument();
    expect(screen.getByDisplayValue('Section 3')).toBeInTheDocument();
    // Original order: Verse 1, Chorus, Section 3 → after move up: Verse 1, Section 3, Chorus
    const textInputs = screen.getAllByRole('textbox');
    const sectionNames = textInputs
      .map(el => (el as HTMLInputElement).value)
      .filter(v => v === 'Verse 1' || v === 'Chorus' || v === 'Section 3');
    expect(sectionNames[0]).toBe('Verse 1');
    expect(sectionNames[1]).toBe('Section 3');
    expect(sectionNames[2]).toBe('Chorus');
  });

  test('moving a section down reorders the sections', () => {
    render(<App />);
    // Default: Verse 1, Chorus
    // Hover over Verse 1 to reveal buttons
    const groupDiv = screen.getByDisplayValue('Verse 1').closest('.group')!;
    fireEvent.mouseEnter(groupDiv);
    const moveDownButtons = screen.getAllByTitle('Move Down');
    fireEvent.click(moveDownButtons[0]);

    // Verse 1 should now be second, Chorus first
    const textInputs = screen.getAllByRole('textbox');
    const sectionNames = textInputs
      .map(el => (el as HTMLInputElement).value)
      .filter(v => v === 'Verse 1' || v === 'Chorus');
    expect(sectionNames[0]).toBe('Chorus');
    expect(sectionNames[1]).toBe('Verse 1');
  });

  test('updating section name', () => {
    render(<App />);
    const firstSectionInput = screen.getByDisplayValue('Verse 1') as HTMLInputElement;
    fireEvent.change(firstSectionInput, { target: { value: 'Intro' } });
    expect(firstSectionInput).toHaveValue('Intro');
  });

  test('saving a project calls PersistenceManager.saveProject', async () => {
    (PersistenceManager.saveProject as ReturnType<typeof vi.fn>).mockResolvedValue(undefined);

    render(<App />);
    fireEvent.change(screen.getByDisplayValue('Untitled Project'), { target: { value: 'My New Project' } });
    fireEvent.click(screen.getByText('Save'));

    await waitFor(() => {
      expect(PersistenceManager.saveProject).toHaveBeenCalledTimes(1);
      expect(PersistenceManager.saveProject).toHaveBeenCalledWith(expect.objectContaining({
        name: 'My New Project',
      }));
    });
  });

  test('toggles sidebar visibility when menu button is clicked', () => {
    render(<App />);
    const menuBtn = screen.getAllByRole('button').find(b => b.getAttribute('title')?.includes('Hide Sidebar'))!;
    expect(menuBtn).toBeInTheDocument();

    fireEvent.click(menuBtn);

    const showBtn = screen.getAllByRole('button').find(b => b.getAttribute('title')?.includes('Show Sidebar'));
    expect(showBtn).toBeInTheDocument();
  });

  test('moving first section up is a no-op', () => {
    render(<App />);
    const groupDiv = screen.getByDisplayValue('Verse 1').closest('.group')!;
    fireEvent.mouseEnter(groupDiv);
    const moveUpButtons = screen.getAllByTitle('Move Up');
    fireEvent.click(moveUpButtons[0]);

    const textInputs = screen.getAllByRole('textbox');
    const sectionNames = textInputs
      .map(el => (el as HTMLInputElement).value)
      .filter(v => v === 'Verse 1' || v === 'Chorus');
    expect(sectionNames[0]).toBe('Verse 1');
    expect(sectionNames[1]).toBe('Chorus');
  });

  test('moving last section down is a no-op', () => {
    render(<App />);
    const groupDiv = screen.getByDisplayValue('Chorus').closest('.group')!;
    fireEvent.mouseEnter(groupDiv);
    const moveDownButtons = screen.getAllByTitle('Move Down');
    fireEvent.click(moveDownButtons[1]);

    const textInputs = screen.getAllByRole('textbox');
    const sectionNames = textInputs
      .map(el => (el as HTMLInputElement).value)
      .filter(v => v === 'Verse 1' || v === 'Chorus');
    expect(sectionNames[0]).toBe('Verse 1');
    expect(sectionNames[1]).toBe('Chorus');
  });

  test('changing music key updates state', () => {
    render(<App />);
    const keySelect = screen.getAllByRole('combobox').find(el => el.getAttribute('aria-label') === null && el.closest('.grid'))!;
    fireEvent.change(keySelect, { target: { value: 'C' } });
    expect(keySelect).toHaveValue('C');
  });

  test('changing section preset updates state', () => {
    render(<App />);
    const sectionPresets = screen.getAllByRole('combobox');
    const presetSelect = sectionPresets.find(el => (el as HTMLSelectElement).value === 'steely')!;
    fireEvent.change(presetSelect, { target: { value: 'isley' } });
    expect(presetSelect).toHaveValue('isley');
  });

  test('changing section length bars updates state', () => {
    render(<App />);
    const sectionLengthSelects = screen.getAllByRole('combobox');
    const lengthSelect = sectionLengthSelects.find(el => (el as HTMLSelectElement).value === '8' && el.closest('.grid'));
    if (lengthSelect) {
      fireEvent.change(lengthSelect, { target: { value: '16' } });
      expect(lengthSelect).toHaveValue('16');
    }
  });

  test('toggling arrangement accordion collapses sections', () => {
    render(<App />);
    const accordionBtn = screen.getByText('Arrangement');
    expect(screen.getByDisplayValue('Verse 1')).toBeInTheDocument();

    fireEvent.click(accordionBtn);

    expect(screen.queryByDisplayValue('Verse 1')).not.toBeInTheDocument();
  });

  test('randomizeSeed changes the seed value', () => {
    render(<App />);
    const seedInput = screen.getByDisplayValue('steely-dan-vibes') as HTMLInputElement;
    const shuffleBtn = screen.getAllByRole('button').find(b => b.getAttribute('title') === 'Randomize seed')!;
    fireEvent.click(shuffleBtn);
    expect(seedInput.value).not.toBe('steely-dan-vibes');
    expect(seedInput.value.length).toBeGreaterThan(0);
  });

  test('changing seed input updates state', () => {
    render(<App />);
    const seedInput = screen.getByDisplayValue('steely-dan-vibes');
    fireEvent.change(seedInput, { target: { value: 'new-seed-123' } });
    expect(seedInput).toHaveValue('new-seed-123');
  });

  test('saving with empty project name shows error', async () => {
    (PersistenceManager.saveProject as ReturnType<typeof vi.fn>).mockClear();

    render(<App />);
    fireEvent.change(screen.getByDisplayValue('Untitled Project'), { target: { value: '   ' } });
    fireEvent.click(screen.getByText('Save'));

    await waitFor(() => {
      const saveBtn = screen.getAllByRole('button').find(b => b.getAttribute('title') === 'Project name required');
      expect(saveBtn).toBeInTheDocument();
    });
    expect(PersistenceManager.saveProject).not.toHaveBeenCalled();
  });

  test('save button shows Saving... while saving', async () => {
    let resolveSave: () => void;
    const savePromise = new Promise<void>(r => { resolveSave = r; });
    (PersistenceManager.saveProject as ReturnType<typeof vi.fn>).mockReturnValue(savePromise);

    render(<App />);
    fireEvent.click(screen.getByText('Save'));

    await waitFor(() => {
      expect(screen.getByText('Saving...')).toBeInTheDocument();
    });

    resolveSave!();
    await waitFor(() => {
      expect(screen.queryByText('Saving...')).not.toBeInTheDocument();
    });
  });

  test('handleSaveProject catches errors and shows error message', async () => {
    (PersistenceManager.saveProject as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('Network fail'));

    render(<App />);
    fireEvent.click(screen.getByText('Save'));

    await waitFor(() => {
      const saveBtn = screen.getAllByRole('button').find(b => b.getAttribute('title') === 'Failed to save project');
      expect(saveBtn).toBeInTheDocument();
    });
  });

  test('clicking Open toggles project list', () => {
    render(<App />);
    const openBtn = screen.getByText('Open').closest('button')!;
    fireEvent.click(openBtn);
    expect(screen.getByText('Your Projects')).toBeInTheDocument();

    fireEvent.click(openBtn);
    expect(screen.queryByText('Your Projects')).not.toBeInTheDocument();
  });

  test('project list shows empty state when no projects', async () => {
    (PersistenceManager.listUserProjects as ReturnType<typeof vi.fn>).mockResolvedValue([]);

    render(<App />);
    fireEvent.click(screen.getByText('Open'));

    await waitFor(() => {
      expect(screen.getByText('No projects found.')).toBeInTheDocument();
    });
  });

  test('changing tempo input updates state', () => {
    render(<App />);
    const tempoInput = screen.getAllByRole('spinbutton').find(el => el.closest('.flex.items-center.gap-1'));
    if (tempoInput) {
      fireEvent.change(tempoInput, { target: { value: '120' } });
      expect(tempoInput).toHaveValue(120);
    }
  });

  test('arrangement accordion starts expanded', () => {
    render(<App />);
    expect(screen.getByDisplayValue('Verse 1')).toBeInTheDocument();
    expect(screen.getByDisplayValue('Chorus')).toBeInTheDocument();
  });
});
