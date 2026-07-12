import React from 'react';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import { MpcReframerView } from './MpcReframerView';

const { mockAudioEngine, mockSynth } = vi.hoisted(() => ({
  mockAudioEngine: {
    ctx: { currentTime: 0 },
    tracks: new Map<string, any>([
      ['keys', { playOscillator: vi.fn() }],
      ['drums', { playOscillator: vi.fn() }],
    ]),
    resume: vi.fn(),
  },
  mockSynth: {
    triggerNote: vi.fn(),
  },
}));

vi.mock('../../lib/audio/engine', () => ({
  audioEngine: mockAudioEngine,
}));

vi.mock('../../lib/audio/synth', () => ({
  Ju60Engine: {
    getInstance: vi.fn(() => mockSynth),
  },
}));

const BASE_SECTION: any = {
  def: { id: 'test-1', name: 'Verse 1', preset: 'pop', lengthBars: 8 },
  chords: [
    { bar: 1, beat: 1, roman: 'Imaj7', chordName: 'Cmaj7', rootPc: 0, quality: 'maj7', pianoVoicing: { notes: [60, 64, 67, 71] } },
    { bar: 2, beat: 1, roman: 'V7', chordName: 'G7', rootPc: 7, quality: '7' },
  ],
  drumPattern: {
    swing: 50,
    grid: {
      Kick: [true, ...Array(31).fill(false)],
      Snare: Array(32).fill(false),
      'HH Closed': Array(32).fill(false),
      'HH Open': Array(32).fill(false),
    },
  },
  articulations: [
    { bar: 1, attackBeat: 1.0, stabStyle: 'single_stab' as const },
    { bar: 2, attackBeat: 2.5, stabStyle: 'loop_chop' as const },
  ],
  timeFeel: {
    swingAmount: 62,
    microTimingDragMs: 12,
    ghostNoteDensity: 35,
    kickPlacementStyle: 'syncopated_offbeat' as const,
    humanizeVelocityRange: 10,
  },
};

function renderView(props: Partial<React.ComponentProps<typeof MpcReframerView>> = {}) {
  const defaults = {
    reframedSections: [BASE_SECTION],
    reframeTarget: 'boom_bap' as const,
    setReframeTarget: vi.fn(),
    activeReframeSec: 0,
    setActiveReframeSec: vi.fn(),
    generatedSections: [],
    musicKey: 'C',
  };
  return render(<MpcReframerView {...defaults} {...props} />);
}

describe('MpcReframerView', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  it('renders the title', () => {
    renderView();
    expect(screen.getByText('MPC Rhythmic Re-framer')).toBeTruthy();
  });

  it('renders section selector tabs', () => {
    renderView();
    expect(screen.getByText('Verse 1')).toBeTruthy();
  });

  it('renders all feel selector options', () => {
    renderView();
    expect(screen.getByText('Vintage Original (No Swing)')).toBeTruthy();
    expect(screen.getByText('Boom Bap (Dilla Swing 62%)')).toBeTruthy();
    expect(screen.getByText('Techno (Straight)')).toBeTruthy();
  });

  it('shows active feel as selected', () => {
    renderView({ reframeTarget: 'house' });
    const allButtons = screen.getAllByRole('button');
    const feelBtn = allButtons.find(b => b.textContent?.includes('House'));
    expect(feelBtn).toBeTruthy();
  });

  it('calls setReframeTarget when clicking a feel option', () => {
    const setReframeTarget = vi.fn();
    renderView({ setReframeTarget });
    fireEvent.click(screen.getByText('Jazz (Classic Swing)'));
    expect(setReframeTarget).toHaveBeenCalledWith('jazz');
  });

  it('calls setReframeTarget with none when clicking original', () => {
    const setReframeTarget = vi.fn();
    renderView({ setReframeTarget, reframeTarget: 'boom_bap' });
    fireEvent.click(screen.getByText('Vintage Original (No Swing)'));
    expect(setReframeTarget).toHaveBeenCalledWith('none');
  });

  it('renders section tab and switches on click', () => {
    const setActiveReframeSec = vi.fn();
    const sections = [
      BASE_SECTION,
      { ...BASE_SECTION, def: { id: 'test-2', name: 'Chorus', preset: 'pop', lengthBars: 8 } },
    ];
    renderView({ reframedSections: sections, setActiveReframeSec });
    fireEvent.click(screen.getByText('Chorus'));
    expect(setActiveReframeSec).toHaveBeenCalledWith(1);
  });

  it('renders chord preview buttons', () => {
    renderView();
    const cmaj7s = screen.getAllByText('Cmaj7');
    expect(cmaj7s.length).toBeGreaterThanOrEqual(1);
    const g7s = screen.getAllByText('G7');
    expect(g7s.length).toBeGreaterThanOrEqual(1);
  });

  it('previewChord plays voicing notes via synth', () => {
    renderView();
    // Find the chord preview in the "Chord Preview" section by looking for buttons with "Bar 1" text
    const bar1Buttons = screen.getAllByText('Bar 1');
    const chordBtn = bar1Buttons[0].closest('button')!;
    fireEvent.click(chordBtn);
    expect(mockAudioEngine.resume).toHaveBeenCalled();
    expect(mockSynth.triggerNote).toHaveBeenCalled();
  });

  it('previewChord falls back to oscillator when no pianoVoicing', () => {
    const sectionNoVoicing = {
      ...BASE_SECTION,
      chords: [{ bar: 1, beat: 1, roman: 'Imaj7', chordName: 'Cmaj7', rootPc: 0, quality: 'maj7' }],
    };
    renderView({ reframedSections: [sectionNoVoicing] });
    const bar1 = screen.getAllByText('Bar 1');
    const chordBtn = bar1[0].closest('button')!;
    fireEvent.click(chordBtn);
    const keysTrack = mockAudioEngine.tracks.get('keys');
    expect(keysTrack.playOscillator).toHaveBeenCalled();
  });

  it('renders articulation chop map when articulations exist', () => {
    renderView();
    expect(screen.getByText('PAD 1')).toBeTruthy();
    expect(screen.getByText('PAD 2')).toBeTruthy();
  });

  it('articulation button previews the chord', () => {
    renderView();
    const pad1 = screen.getAllByText('PAD 1');
    expect(pad1.length).toBeGreaterThanOrEqual(1);
    const padBtn = pad1[0].closest('button')!;
    fireEvent.click(padBtn);
    expect(mockAudioEngine.resume).toHaveBeenCalled();
  });

  it('renders micro-timing details when timeFeel exists', () => {
    renderView();
    expect(screen.getByText('MPC 16th Swing')).toBeTruthy();
    expect(screen.getByText('62%')).toBeTruthy();
    expect(screen.getByText('Late Drag Offset')).toBeTruthy();
    expect(screen.getByText('Ghost Note Density')).toBeTruthy();
  });

  it('renders drum grid pattern', () => {
    renderView();
    expect(screen.getByText('Drum Grid Pattern')).toBeTruthy();
    expect(screen.getByText('Kick')).toBeTruthy();
  });

  it('renders preview click button when feel is selected', () => {
    renderView({ reframeTarget: 'boom_bap' });
    expect(screen.getByText('Preview Click')).toBeTruthy();
  });

  it('click preview click button triggers audio', () => {
    renderView({ reframeTarget: 'boom_bap' });
    fireEvent.click(screen.getByText('Preview Click'));
    const drumsTrack = mockAudioEngine.tracks.get('drums');
    expect(drumsTrack.playOscillator).toHaveBeenCalled();
  });

  it('does not render click preview when reframeTarget is none', () => {
    renderView({ reframeTarget: 'none' });
    expect(screen.queryByText('Preview Click')).toBeNull();
  });

  it('renders correctly with empty reframedSections', () => {
    renderView({ reframedSections: [] });
    expect(screen.getByText('MPC Rhythmic Re-framer')).toBeTruthy();
  });

  it('does not render micro-timing without timeFeel', () => {
    const sectionNoTime = { ...BASE_SECTION, timeFeel: undefined };
    renderView({ reframedSections: [sectionNoTime] });
    expect(screen.queryByText('MPC 16th Swing')).toBeNull();
  });

  it('does not render drum grid without drumPattern', () => {
    const sectionNoDrum = { ...BASE_SECTION, drumPattern: undefined };
    renderView({ reframedSections: [sectionNoDrum] });
    expect(screen.queryByText('Drum Grid Pattern')).toBeNull();
  });

  it('does not render articulation map when empty', () => {
    const sectionNoArticulations = { ...BASE_SECTION, articulations: [] };
    renderView({ reframedSections: [sectionNoArticulations] });
    expect(screen.queryByText('PAD 1')).toBeNull();
  });

  it('preview click button stops previous click interval', () => {
    vi.useFakeTimers();
    renderView({ reframeTarget: 'boom_bap' });

    fireEvent.click(screen.getByText('Preview Click'));
    const drumsTrack = mockAudioEngine.tracks.get('drums');
    const callCount1 = drumsTrack.playOscillator.mock.calls.length;

    vi.advanceTimersByTime(500);
    const callCount2 = drumsTrack.playOscillator.mock.calls.length;
    expect(callCount2).toBeGreaterThan(callCount1);

    fireEvent.click(screen.getByText('Preview Click'));
    vi.advanceTimersByTime(500);
    const callCount3 = drumsTrack.playOscillator.mock.calls.length;
    // After second click, the interval restarted
    expect(callCount3).toBeGreaterThan(callCount2);

    vi.useRealTimers();
  });

  it('selecting a new feel stops click preview', () => {
    const setReframeTarget = vi.fn();
    renderView({ setReframeTarget, reframeTarget: 'boom_bap' });

    fireEvent.click(screen.getByText('Preview Click'));
    const drumsTrack = mockAudioEngine.tracks.get('drums');
    const beforeCallCount = drumsTrack.playOscillator.mock.calls.length;

    fireEvent.click(screen.getByText('Jazz (Classic Swing)'));
    expect(setReframeTarget).toHaveBeenCalledWith('jazz');

    // Should have stopped the click by now
    const afterCallCount = drumsTrack.playOscillator.mock.calls.length;
    expect(afterCallCount).toBe(beforeCallCount);
  });

  it('handles missing sec.def gracefully in section tabs', () => {
    const sections = [{ chords: [] }];
    renderView({ reframedSections: sections });
    expect(screen.getByText('Section 1')).toBeTruthy();
  });
});
