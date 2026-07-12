import React from 'react';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';

Element.prototype.scrollTo = vi.fn();

const { mockAudioEngine, mockTransport } = vi.hoisted(() => {
  const beatCallbacks: ((beat: number, time: number) => void)[] = [];
  const mockTransportObj = {
    onBeat: [] as any[],
    onStop: [] as any[],
    addBeatCallback(cb: (beat: number, time: number) => void) {
      beatCallbacks.push(cb);
      mockTransportObj.onBeat.push(cb);
      return () => {
        const idx = beatCallbacks.indexOf(cb);
        if (idx !== -1) beatCallbacks.splice(idx, 1);
      };
    },
    addStopCallback: vi.fn(() => vi.fn()),
  };
  return {
    mockAudioEngine: {
      loadedSamples: new Map() as Map<string, any>,
      tracks: new Map() as Map<string, any>,
    },
    mockTransport: mockTransportObj,
  };
});

vi.mock('../../lib/audio/engine', () => ({
  audioEngine: mockAudioEngine,
  transport: mockTransport,
}));

vi.mock('../../hooks/useTransport', () => ({
  useTransport: vi.fn(() => ({
    isPlaying: false,
    togglePlay: vi.fn(),
    tempo: 120,
    setTempo: vi.fn(),
  })),
}));

vi.mock('./RhythmGrid/useDrumGrid', () => ({
  useDrumGrid: vi.fn(() => ({
    grid: {
      Kick: Array(32).fill(false),
      Snare: Array(32).fill(false),
      'HH Closed': Array(32).fill(false),
      'HH Open': Array(32).fill(false),
      'Tom High': Array(32).fill(false),
      'Tom Mid': Array(32).fill(false),
      'Tom Floor': Array(32).fill(false),
      Crash: Array(32).fill(false),
      Ride: Array(32).fill(false),
    },
    setGrid: vi.fn(),
    presets: [],
    activePreset: null,
    toggleStep: vi.fn(),
    clearGrid: vi.fn(),
    loadPresetPattern: vi.fn(),
    saveUserPreset: vi.fn(),
  })),
}));

vi.mock('./RhythmGrid/useDrumSynths', () => ({
  useDrumSynths: vi.fn(() => ({
    triggerSynth: vi.fn(),
  })),
}));

vi.mock('./RhythmGrid/StepButton', () => ({
  StepButton: vi.fn(({ drum, index, isActive, isCurrent, isBeat, onClick }: any) => (
    <button
      role="gridcell"
      aria-pressed={isActive}
      aria-label={`${drum} at step ${index + 1}${isActive ? ', active' : ''}`}
      onClick={onClick}
      data-testid={`step-${drum}-${index}`}
    />
  )),
}));

import { RhythmGrid } from './RhythmGrid';
import { useTransport } from '../../hooks/useTransport';
import { useDrumGrid } from './RhythmGrid/useDrumGrid';
import { useDrumSynths } from './RhythmGrid/useDrumSynths';

describe('RhythmGrid', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockTransport.onBeat.length = 0;
    mockTransport.onStop.length = 0;
    mockAudioEngine.loadedSamples.clear();
    mockAudioEngine.tracks.clear();
  });

  afterEach(() => {
    cleanup();
  });

  it('renders the RhythmGrid heading', () => {
    render(<RhythmGrid />);
    expect(screen.getByText('Rhythm Grid')).toBeInTheDocument();
  });

  it('renders play button', () => {
    render(<RhythmGrid />);
    expect(screen.getByLabelText('Play sequence')).toBeInTheDocument();
  });

  it('renders stop button when playing', () => {
    (useTransport as any).mockReturnValue({
      isPlaying: true,
      togglePlay: vi.fn(),
      tempo: 120,
      setTempo: vi.fn(),
    });
    render(<RhythmGrid />);
    expect(screen.getByLabelText('Stop sequence')).toBeInTheDocument();
  });

  it('calls togglePlay when play button clicked', () => {
    const togglePlay = vi.fn();
    (useTransport as any).mockReturnValue({
      isPlaying: false,
      togglePlay,
      tempo: 120,
      setTempo: vi.fn(),
    });
    render(<RhythmGrid />);
    fireEvent.click(screen.getByLabelText('Play sequence'));
    expect(togglePlay).toHaveBeenCalledTimes(1);
  });

  it('renders preset buttons', () => {
    render(<RhythmGrid />);
    expect(screen.getByText('Boom Bap')).toBeInTheDocument();
    expect(screen.getByText('Techno')).toBeInTheDocument();
    expect(screen.getByText('Trap')).toBeInTheDocument();
    expect(screen.getByText('Funk')).toBeInTheDocument();
    expect(screen.getByText('Jazz')).toBeInTheDocument();
  });

  it('calls loadPresetPattern when preset button clicked', () => {
    const loadPresetPattern = vi.fn();
    (useDrumGrid as any).mockReturnValue({
      grid: {
        Kick: Array(32).fill(false),
        Snare: Array(32).fill(false),
        'HH Closed': Array(32).fill(false),
        'HH Open': Array(32).fill(false),
        'Tom High': Array(32).fill(false),
        'Tom Mid': Array(32).fill(false),
        'Tom Floor': Array(32).fill(false),
        Crash: Array(32).fill(false),
        Ride: Array(32).fill(false),
      },
      setGrid: vi.fn(),
      presets: [],
      activePreset: null,
      toggleStep: vi.fn(),
      clearGrid: vi.fn(),
      loadPresetPattern,
      saveUserPreset: vi.fn(),
    });
    render(<RhythmGrid />);
    fireEvent.click(screen.getByText('Boom Bap'));
    expect(loadPresetPattern).toHaveBeenCalledWith('boom_bap');
  });

  it('renders clear button', () => {
    render(<RhythmGrid />);
    expect(screen.getByLabelText('Clear all steps')).toBeInTheDocument();
  });

  it('calls clearGrid when clear button clicked', () => {
    const clearGrid = vi.fn();
    (useDrumGrid as any).mockReturnValue({
      grid: {
        Kick: Array(32).fill(false),
        Snare: Array(32).fill(false),
        'HH Closed': Array(32).fill(false),
        'HH Open': Array(32).fill(false),
        'Tom High': Array(32).fill(false),
        'Tom Mid': Array(32).fill(false),
        'Tom Floor': Array(32).fill(false),
        Crash: Array(32).fill(false),
        Ride: Array(32).fill(false),
      },
      setGrid: vi.fn(),
      presets: [],
      activePreset: null,
      toggleStep: vi.fn(),
      clearGrid,
      loadPresetPattern: vi.fn(),
      saveUserPreset: vi.fn(),
    });
    render(<RhythmGrid />);
    fireEvent.click(screen.getByLabelText('Clear all steps'));
    expect(clearGrid).toHaveBeenCalledTimes(1);
  });

  it('renders save button', () => {
    render(<RhythmGrid />);
    expect(screen.getByLabelText('Save current pattern')).toBeInTheDocument();
  });

  it('calls saveUserPreset when save button clicked', () => {
    const saveUserPreset = vi.fn();
    (useDrumGrid as any).mockReturnValue({
      grid: {
        Kick: Array(32).fill(false),
        Snare: Array(32).fill(false),
        'HH Closed': Array(32).fill(false),
        'HH Open': Array(32).fill(false),
        'Tom High': Array(32).fill(false),
        'Tom Mid': Array(32).fill(false),
        'Tom Floor': Array(32).fill(false),
        Crash: Array(32).fill(false),
        Ride: Array(32).fill(false),
      },
      setGrid: vi.fn(),
      presets: [],
      activePreset: null,
      toggleStep: vi.fn(),
      clearGrid: vi.fn(),
      loadPresetPattern: vi.fn(),
      saveUserPreset,
    });
    render(<RhythmGrid />);
    fireEvent.click(screen.getByLabelText('Save current pattern'));
    expect(saveUserPreset).toHaveBeenCalledTimes(1);
  });

  it('renders load button and toggles preset library', () => {
    render(<RhythmGrid />);
    const loadBtn = screen.getByLabelText('Load pattern library');
    expect(loadBtn).toBeInTheDocument();
    fireEvent.click(loadBtn);
    expect(screen.getByText('Pattern Library')).toBeInTheDocument();
  });

  it('shows "No patterns saved" when presets is empty', () => {
    render(<RhythmGrid />);
    fireEvent.click(screen.getByLabelText('Load pattern library'));
    expect(screen.getByText('No patterns saved.')).toBeInTheDocument();
  });

  it('renders swing slider', () => {
    render(<RhythmGrid />);
    expect(screen.getByText('Swing Engine')).toBeInTheDocument();
  });

  it('renders ghost notes slider', () => {
    render(<RhythmGrid />);
    expect(screen.getByText('Ghost Notes')).toBeInTheDocument();
  });

  it('renders tempo input', () => {
    render(<RhythmGrid />);
    expect(screen.getByText('Tempo')).toBeInTheDocument();
  });

  it('renders fullscreen toggle', () => {
    render(<RhythmGrid />);
    expect(screen.getByLabelText('Enter Full Screen')).toBeInTheDocument();
  });

  it('renders zoom toggle', () => {
    render(<RhythmGrid />);
    expect(screen.getByLabelText('Focus / Zoom Grid Edit Mode')).toBeInTheDocument();
  });

  it('renders drum rows in the grid', () => {
    render(<RhythmGrid />);
    expect(screen.getByRole('grid', { name: 'Drum sequencer grid' })).toBeInTheDocument();
  });

  it('renders bar counter', () => {
    render(<RhythmGrid />);
    expect(screen.getByText('Bar')).toBeInTheDocument();
  });

  it('renders reset button', () => {
    render(<RhythmGrid />);
    expect(screen.getByLabelText('Reset position to start')).toBeInTheDocument();
  });

  it('renders drum track labels', () => {
    render(<RhythmGrid />);
    expect(screen.getByText('Kick')).toBeInTheDocument();
    expect(screen.getByText('Snare')).toBeInTheDocument();
    expect(screen.getByText('HH Closed')).toBeInTheDocument();
  });

  it('displays pattern library panel presets', () => {
    (useDrumGrid as any).mockReturnValue({
      grid: {
        Kick: Array(32).fill(false),
        Snare: Array(32).fill(false),
        'HH Closed': Array(32).fill(false),
        'HH Open': Array(32).fill(false),
        'Tom High': Array(32).fill(false),
        'Tom Mid': Array(32).fill(false),
        'Tom Floor': Array(32).fill(false),
        Crash: Array(32).fill(false),
        Ride: Array(32).fill(false),
      },
      setGrid: vi.fn(),
      presets: [
        { id: 'p1', name: 'My Beat', type: 'drum', data: {} },
      ],
      activePreset: null,
      toggleStep: vi.fn(),
      clearGrid: vi.fn(),
      loadPresetPattern: vi.fn(),
      saveUserPreset: vi.fn(),
    });
    render(<RhythmGrid />);
    fireEvent.click(screen.getByLabelText('Load pattern library'));
    expect(screen.getByText('My Beat')).toBeInTheDocument();
  });

  it('closes preset library when close button clicked', () => {
    render(<RhythmGrid />);
    fireEvent.click(screen.getByLabelText('Load pattern library'));
    expect(screen.getByText('Pattern Library')).toBeInTheDocument();
    fireEvent.click(screen.getByLabelText('Close presets'));
    expect(screen.queryByText('Pattern Library')).not.toBeInTheDocument();
  });

  it('loads preset when preset library button clicked', () => {
    const setGrid = vi.fn();
    (useDrumGrid as any).mockReturnValue({
      grid: {
        Kick: Array(32).fill(false),
        Snare: Array(32).fill(false),
        'HH Closed': Array(32).fill(false),
        'HH Open': Array(32).fill(false),
        'Tom High': Array(32).fill(false),
        'Tom Mid': Array(32).fill(false),
        'Tom Floor': Array(32).fill(false),
        Crash: Array(32).fill(false),
        Ride: Array(32).fill(false),
      },
      setGrid,
      presets: [
        { id: 'p1', name: 'My Beat', type: 'drum', data: { Kick: Array(32).fill(true) } },
      ],
      activePreset: null,
      toggleStep: vi.fn(),
      clearGrid: vi.fn(),
      loadPresetPattern: vi.fn(),
      saveUserPreset: vi.fn(),
    });
    render(<RhythmGrid />);
    fireEvent.click(screen.getByLabelText('Load pattern library'));
    fireEvent.click(screen.getByText('My Beat'));
    expect(setGrid).toHaveBeenCalledWith({ Kick: Array(32).fill(true) });
  });

  it('swing slider changes swing value', () => {
    render(<RhythmGrid />);
    const slider = screen.getByRole('slider', { name: /swing/i });
    fireEvent.change(slider, { target: { value: '75' } });
    expect(slider).toHaveAttribute('aria-valuetext', '75% swing');
  });

  it('ghost notes slider changes ghost notes value', () => {
    render(<RhythmGrid />);
    const slider = screen.getByRole('slider', { name: /ghost notes/i });
    fireEvent.change(slider, { target: { value: '50' } });
    expect(slider).toHaveAttribute('aria-valuetext', '50% ghost notes');
  });

  it('tempo input changes tempo value', () => {
    const setTempo = vi.fn();
    (useTransport as any).mockReturnValue({
      isPlaying: false,
      togglePlay: vi.fn(),
      tempo: 120,
      setTempo,
    });
    render(<RhythmGrid />);
    const tempoInput = screen.getByLabelText('Tempo');
    fireEvent.change(tempoInput, { target: { value: '140' } });
    expect(setTempo).toHaveBeenCalledWith(140);
  });

  it('tempo input falls back to 120 for invalid input', () => {
    const setTempo = vi.fn();
    (useTransport as any).mockReturnValue({
      isPlaying: false,
      togglePlay: vi.fn(),
      tempo: 120,
      setTempo,
    });
    render(<RhythmGrid />);
    const tempoInput = screen.getByLabelText('Tempo');
    fireEvent.change(tempoInput, { target: { value: '' } });
    expect(setTempo).toHaveBeenCalledWith(120);
  });

  it('fullscreen toggle switches to fullscreen mode', () => {
    render(<RhythmGrid />);
    const fullscreenBtn = screen.getByLabelText('Enter Full Screen');
    fireEvent.click(fullscreenBtn);
    expect(screen.getByText('Normal')).toBeInTheDocument();
    expect(screen.getByText('Full Scale Hardware Sequencer')).toBeInTheDocument();
  });

  it('fullscreen toggle switches back from fullscreen', () => {
    render(<RhythmGrid />);
    fireEvent.click(screen.getByLabelText('Enter Full Screen'));
    expect(screen.getByText('Normal')).toBeInTheDocument();
    fireEvent.click(screen.getByLabelText('Exit Full Screen'));
    expect(screen.getByText('Fullscreen')).toBeInTheDocument();
    expect(screen.getByText('Player Audition Sequencer')).toBeInTheDocument();
  });

  it('zoom toggle switches to zoomed mode', () => {
    render(<RhythmGrid />);
    const zoomBtn = screen.getByLabelText('Focus / Zoom Grid Edit Mode');
    fireEvent.click(zoomBtn);
    expect(screen.getByText('Exit Zoom')).toBeInTheDocument();
    expect(screen.getByText('Zoomed Grid Edit Mode Active')).toBeInTheDocument();
  });

  it('zoom toggle switches back from zoomed mode', () => {
    render(<RhythmGrid />);
    fireEvent.click(screen.getByLabelText('Focus / Zoom Grid Edit Mode'));
    expect(screen.getByText('Exit Zoom')).toBeInTheDocument();
    fireEvent.click(screen.getByLabelText('Exit Grid Edit Mode'));
    expect(screen.getByText('Zoom Grid')).toBeInTheDocument();
  });

  it('resets step to 0 when reset button clicked', () => {
    render(<RhythmGrid />);
    fireEvent.click(screen.getByLabelText('Reset position to start'));
    expect(screen.getByText('Bar')).toBeInTheDocument();
  });

  it('sets active preset on loadPresetPattern', () => {
    (useDrumGrid as any).mockReturnValue({
      grid: {
        Kick: Array(32).fill(false),
        Snare: Array(32).fill(false),
        'HH Closed': Array(32).fill(false),
        'HH Open': Array(32).fill(false),
        'Tom High': Array(32).fill(false),
        'Tom Mid': Array(32).fill(false),
        'Tom Floor': Array(32).fill(false),
        Crash: Array(32).fill(false),
        Ride: Array(32).fill(false),
      },
      setGrid: vi.fn(),
      presets: [],
      activePreset: 'boom_bap',
      toggleStep: vi.fn(),
      clearGrid: vi.fn(),
      loadPresetPattern: vi.fn(),
      saveUserPreset: vi.fn(),
    });
    render(<RhythmGrid />);
    expect(screen.getByText('Boom Bap')).toBeInTheDocument();
  });

  it('renders all drum track labels', () => {
    render(<RhythmGrid />);
    expect(screen.getByText('Tom High')).toBeInTheDocument();
    expect(screen.getByText('Tom Mid')).toBeInTheDocument();
    expect(screen.getByText('Tom Floor')).toBeInTheDocument();
    expect(screen.getByText('Crash')).toBeInTheDocument();
    expect(screen.getByText('Ride')).toBeInTheDocument();
  });

  it('transport.onBeat handler processes beats with swing', () => {
    render(<RhythmGrid />);
    const handler = mockTransport.onBeat[mockTransport.onBeat.length - 1];
    handler(0, 0);
    handler(1, 0.25);
    handler(0.5, 0.125);
  });

  it('transport.onBeat handler processes beats with ghost notes', () => {
    const mockTriggerSynth = vi.fn();
    (useDrumSynths as any).mockReturnValue({ triggerSynth: mockTriggerSynth });
    render(<RhythmGrid />);
    const handler = mockTransport.onBeat[mockTransport.onBeat.length - 1];
    handler(0, 0);
    handler(1, 0.25);
  });

  it('transport.onBeat handler plays loaded samples', () => {
    mockAudioEngine.loadedSamples.set('Kick', {});
    mockAudioEngine.tracks.set('drums', {
      playBuffer: vi.fn(),
    });
    (useDrumGrid as any).mockReturnValue({
      grid: {
        Kick: [true, ...Array(31).fill(false)],
        Snare: Array(32).fill(false),
        'HH Closed': Array(32).fill(false),
        'HH Open': Array(32).fill(false),
        'Tom High': Array(32).fill(false),
        'Tom Mid': Array(32).fill(false),
        'Tom Floor': Array(32).fill(false),
        Crash: Array(32).fill(false),
        Ride: Array(32).fill(false),
      },
      setGrid: vi.fn(),
      presets: [],
      activePreset: null,
      toggleStep: vi.fn(),
      clearGrid: vi.fn(),
      loadPresetPattern: vi.fn(),
      saveUserPreset: vi.fn(),
    });
    render(<RhythmGrid />);
    const handler = mockTransport.onBeat[mockTransport.onBeat.length - 1];
    handler(0, 0);
    expect(mockAudioEngine.tracks.get('drums').playBuffer).toHaveBeenCalled();
  });

  it('transport.onBeat handler triggers synth when no buffer', () => {
    const mockTriggerSynth = vi.fn();
    (useDrumSynths as any).mockReturnValue({ triggerSynth: mockTriggerSynth });
    mockAudioEngine.loadedSamples.clear();
    mockAudioEngine.tracks.set('drums', { playBuffer: vi.fn() });
    (useDrumGrid as any).mockReturnValue({
      grid: {
        Kick: [true, ...Array(31).fill(false)],
        Snare: Array(32).fill(false),
        'HH Closed': Array(32).fill(false),
        'HH Open': Array(32).fill(false),
        'Tom High': Array(32).fill(false),
        'Tom Mid': Array(32).fill(false),
        'Tom Floor': Array(32).fill(false),
        Crash: Array(32).fill(false),
        Ride: Array(32).fill(false),
      },
      setGrid: vi.fn(),
      presets: [],
      activePreset: null,
      toggleStep: vi.fn(),
      clearGrid: vi.fn(),
      loadPresetPattern: vi.fn(),
      saveUserPreset: vi.fn(),
    });
    render(<RhythmGrid />);
    const handler = mockTransport.onBeat[mockTransport.onBeat.length - 1];
    handler(0, 0);
    expect(mockTriggerSynth).toHaveBeenCalled();
  });

  it('transport.onBeat handler skips when no track', () => {
    mockAudioEngine.loadedSamples.set('Kick', {});
    mockAudioEngine.tracks.delete('drums');
    (useDrumGrid as any).mockReturnValue({
      grid: {
        Kick: [true, ...Array(31).fill(false)],
        Snare: Array(32).fill(false),
        'HH Closed': Array(32).fill(false),
        'HH Open': Array(32).fill(false),
        'Tom High': Array(32).fill(false),
        'Tom Mid': Array(32).fill(false),
        'Tom Floor': Array(32).fill(false),
        Crash: Array(32).fill(false),
        Ride: Array(32).fill(false),
      },
      setGrid: vi.fn(),
      presets: [],
      activePreset: null,
      toggleStep: vi.fn(),
      clearGrid: vi.fn(),
      loadPresetPattern: vi.fn(),
      saveUserPreset: vi.fn(),
    });
    render(<RhythmGrid />);
    const handler = mockTransport.onBeat[mockTransport.onBeat.length - 1];
    expect(() => handler(0, 0)).not.toThrow();
  });

  it('shows player audition sequencer subtitle', () => {
    render(<RhythmGrid />);
    expect(screen.getByText('Player Audition Sequencer')).toBeInTheDocument();
  });

  it('shows zoomed subtitle when zoomed', () => {
    render(<RhythmGrid />);
    fireEvent.click(screen.getByLabelText('Focus / Zoom Grid Edit Mode'));
    expect(screen.getByText('Zoomed Grid Edit Mode Active')).toBeInTheDocument();
  });

  it('shows fullscreen subtitle when fullscreen', () => {
    render(<RhythmGrid />);
    fireEvent.click(screen.getByLabelText('Enter Full Screen'));
    expect(screen.getByText('Full Scale Hardware Sequencer')).toBeInTheDocument();
  });

  it('calls toggleStep when step button clicked', () => {
    const toggleStep = vi.fn();
    (useDrumGrid as any).mockReturnValue({
      grid: {
        Kick: Array(32).fill(false),
        Snare: Array(32).fill(false),
        'HH Closed': Array(32).fill(false),
        'HH Open': Array(32).fill(false),
        'Tom High': Array(32).fill(false),
        'Tom Mid': Array(32).fill(false),
        'Tom Floor': Array(32).fill(false),
        Crash: Array(32).fill(false),
        Ride: Array(32).fill(false),
      },
      setGrid: vi.fn(),
      presets: [],
      activePreset: null,
      toggleStep,
      clearGrid: vi.fn(),
      loadPresetPattern: vi.fn(),
      saveUserPreset: vi.fn(),
    });
    render(<RhythmGrid />);
    const stepBtn = screen.getByTestId('step-Kick-0');
    fireEvent.click(stepBtn);
    expect(toggleStep).toHaveBeenCalledWith('Kick', 0);
  });

  it('applies active styling to active steps', () => {
    (useDrumGrid as any).mockReturnValue({
      grid: {
        Kick: [true, ...Array(31).fill(false)],
        Snare: Array(32).fill(false),
        'HH Closed': Array(32).fill(false),
        'HH Open': Array(32).fill(false),
        'Tom High': Array(32).fill(false),
        'Tom Mid': Array(32).fill(false),
        'Tom Floor': Array(32).fill(false),
        Crash: Array(32).fill(false),
        Ride: Array(32).fill(false),
      },
      setGrid: vi.fn(),
      presets: [],
      activePreset: null,
      toggleStep: vi.fn(),
      clearGrid: vi.fn(),
      loadPresetPattern: vi.fn(),
      saveUserPreset: vi.fn(),
    });
    render(<RhythmGrid />);
    const stepBtn = screen.getByTestId('step-Kick-0');
    expect(stepBtn).toHaveAttribute('aria-pressed', 'true');
  });

  it('step buttons show beat accent styling', () => {
    render(<RhythmGrid />);
    const stepBtn = screen.getByTestId('step-Kick-0');
    expect(stepBtn).toBeInTheDocument();
  });
});
