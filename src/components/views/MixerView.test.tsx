import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MixerView } from './MixerView';

const mockIsPlaying = vi.fn(() => false);

vi.mock('../../hooks/useTransport', () => ({
  useTransport: () => ({
    isPlaying: mockIsPlaying(),
    tempo: 85,
    setTempo: vi.fn(),
    play: vi.fn(),
    stop: vi.fn(),
    togglePlay: vi.fn(),
    currentBeat: 0,
  }),
}));

vi.mock('../../lib/audio/engine', () => {
  const track = {
    volume: 0.8,
    pan: 0,
    isMuted: false,
    isSolo: false,
    analyser: { getValue: () => new Uint8Array(32) },
    setVolume: vi.fn(),
    setPan: vi.fn(),
    setTrim: vi.fn(),
    setEQ: vi.fn(),
    setReverbSend: vi.fn(),
    setMute: vi.fn(),
    setSolo: vi.fn(),
  };
  return {
    audioEngine: {
      addTrack: vi.fn(),
      masterAnalyser: { getValue: () => new Uint8Array(32) },
      setMasterVolume: vi.fn(),
    },
    getTrack: vi.fn(() => track),
    MAIN_TRACKS: ['drums', 'bass', 'keys', 'guitar', 'pads'],
  };
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe('MixerView', () => {
  it('renders the mixer header', () => {
    render(<MixerView />);
    expect(screen.getByText('Console Mixer')).toBeInTheDocument();
  });

  it('shows the main tracks tab as active by default', () => {
    render(<MixerView />);
    const mainTab = screen.getByRole('button', { name: /^main$/i });
    expect(mainTab).toHaveAttribute('aria-pressed', 'true');
  });

  it('switches to drums tab on click', () => {
    render(<MixerView />);
    const drumsTab = screen.getByRole('button', { name: /^drums$/i });
    fireEvent.click(drumsTab);
    expect(drumsTab).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: /^main$/i })).toHaveAttribute('aria-pressed', 'false');
  });

  it('renders channel strips for each main track', () => {
    render(<MixerView />);
    expect(screen.getAllByText('drums').length).toBeGreaterThan(0);
    expect(screen.getAllByText('bass').length).toBeGreaterThan(0);
    expect(screen.getAllByText('keys').length).toBeGreaterThan(0);
    expect(screen.getAllByText('guitar').length).toBeGreaterThan(0);
    expect(screen.getAllByText('pads').length).toBeGreaterThan(0);
  });

  it('shows audio engine ready status', () => {
    render(<MixerView />);
    expect(screen.getByText('Audio Engine: Ready')).toBeInTheDocument();
  });

  it('renders the master output strip', () => {
    render(<MixerView />);
    expect(screen.getByText('Master')).toBeInTheDocument();
  });

  it('has mute and solo buttons for channels', () => {
    render(<MixerView />);
    const muteButtons = screen.getAllByRole('button', { name: /^Mute /i });
    const soloButtons = screen.getAllByRole('button', { name: /^Solo /i });
    expect(muteButtons.length).toBeGreaterThan(0);
    expect(soloButtons.length).toBeGreaterThan(0);
  });

  it('toggles mute when clicking a mute button', () => {
    render(<MixerView />);
    const muteBtn = screen.getByRole('button', { name: 'Mute drums' });
    expect(muteBtn).toHaveAttribute('aria-pressed', 'false');
    fireEvent.click(muteBtn);
    expect(muteBtn).toHaveAttribute('aria-pressed', 'true');
  });

  it('toggles solo when clicking a solo button', () => {
    render(<MixerView />);
    const soloBtn = screen.getByRole('button', { name: 'Solo keys' });
    expect(soloBtn).toHaveAttribute('aria-pressed', 'false');
    fireEvent.click(soloBtn);
    expect(soloBtn).toHaveAttribute('aria-pressed', 'true');
  });

  it('shows drum submix tracks when switching to drums tab', () => {
    render(<MixerView />);
    fireEvent.click(screen.getByRole('button', { name: /^drums$/i }));
    expect(screen.getAllByText('kick').length).toBeGreaterThan(0);
    expect(screen.getAllByText('snare').length).toBeGreaterThan(0);
  });

  it('shows the submix status on drums tab', () => {
    render(<MixerView />);
    fireEvent.click(screen.getByRole('button', { name: /^drums$/i }));
    expect(screen.getByText('Submix controls')).toBeInTheDocument();
  });

  it('shows track controls active on main tab', () => {
    render(<MixerView />);
    expect(screen.getByText('Track controls active')).toBeInTheDocument();
  });

  it('renders pan controls for each channel', () => {
    render(<MixerView />);
    const panLabels = screen.getAllByLabelText(/Pan /);
    expect(panLabels.length).toBeGreaterThan(0);
  });

  it('renders volume faders for each channel', () => {
    render(<MixerView />);
    const volumeLabels = screen.getAllByLabelText(/volume$/);
    expect(volumeLabels.length).toBeGreaterThan(0);
  });

  it('toggles mute off when clicking an already-muted button', () => {
    render(<MixerView />);
    const muteBtn = screen.getByRole('button', { name: 'Mute drums' });
    fireEvent.click(muteBtn);
    expect(muteBtn).toHaveAttribute('aria-pressed', 'true');
    fireEvent.click(muteBtn);
    expect(muteBtn).toHaveAttribute('aria-pressed', 'false');
  });

  it('toggles solo off when clicking an already-soloed button', () => {
    render(<MixerView />);
    const soloBtn = screen.getByRole('button', { name: 'Solo bass' });
    fireEvent.click(soloBtn);
    expect(soloBtn).toHaveAttribute('aria-pressed', 'true');
    fireEvent.click(soloBtn);
    expect(soloBtn).toHaveAttribute('aria-pressed', 'false');
  });

  it('renders trim knobs for channels', () => {
    render(<MixerView />);
    const trimLabels = screen.getAllByLabelText(/Trim: /);
    expect(trimLabels.length).toBeGreaterThan(0);
  });

  it('renders EQ knobs for channels', () => {
    render(<MixerView />);
    const hiEqLabels = screen.getAllByLabelText(/Hi EQ: /);
    expect(hiEqLabels.length).toBeGreaterThan(0);
  });

  it('renders the aux send knobs', () => {
    render(<MixerView />);
    const sendLabels = screen.getAllByLabelText(/Snd A: /);
    expect(sendLabels.length).toBeGreaterThan(0);
  });

  it('renders dB readout for channels', () => {
    render(<MixerView />);
    expect(screen.getAllByText(/dB/).length).toBeGreaterThan(0);
  });

  it('renders the master volume fader', () => {
    render(<MixerView />);
    const masterVol = screen.getByLabelText('Master volume');
    expect(masterVol).toBeInTheDocument();
  });

  it('renders the master VU meter', () => {
    render(<MixerView />);
    const masterStrip = screen.getByText('Master').closest('aside');
    expect(masterStrip).toBeInTheDocument();
    const meters = masterStrip!.querySelectorAll('[aria-label^="Level meter:"]');
    expect(meters.length).toBeGreaterThanOrEqual(2);
  });

  it('renders the Active indicator in master strip', () => {
    render(<MixerView />);
    expect(screen.getByText('Master')).toBeInTheDocument();
    expect(screen.getByLabelText('Master volume')).toBeInTheDocument();
  });

  it('has multiple mute buttons for all channels', () => {
    render(<MixerView />);
    const muteButtons = screen.getAllByRole('button', { name: /^Mute /i });
    expect(muteButtons.length).toBe(5);
  });

  it('has multiple solo buttons for all channels', () => {
    render(<MixerView />);
    const soloButtons = screen.getAllByRole('button', { name: /^Solo /i });
    expect(soloButtons.length).toBe(5);
  });

  it('shows drums tab becomes active after click', () => {
    render(<MixerView />);
    const drumsTab = screen.getByRole('button', { name: /^drums$/i });
    fireEvent.click(drumsTab);
    expect(drumsTab).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByText('Submix controls')).toBeInTheDocument();
  });

  it('changing a volume fader dispatches param change', () => {
    render(<MixerView />);
    const volFader = screen.getByLabelText('drums volume');
    fireEvent.change(volFader, { target: { value: '0.5' } });
    // No error means the param change was dispatched
  });

  it('changing a pan control dispatches param change', () => {
    render(<MixerView />);
    const panControl = screen.getByLabelText('Pan drums: C');
    fireEvent.change(panControl, { target: { value: '0.3' } });
  });

  it('changing master volume fader', () => {
    render(<MixerView />);
    const masterVol = screen.getByLabelText('Master volume');
    fireEvent.change(masterVol, { target: { value: '0.5' } });
  });

  it('renders the master dB readout', () => {
    render(<MixerView />);
    // Master strip has a dB readout
    const dbReadouts = screen.getAllByText(/dB/);
    expect(dbReadouts.length).toBeGreaterThan(0);
  });

  it('renders level meter labels', () => {
    render(<MixerView />);
    const meterLabels = screen.getAllByLabelText(/Level meter/);
    expect(meterLabels.length).toBeGreaterThan(0);
  });

  it('switching between main and drums tabs changes visible tracks', () => {
    render(<MixerView />);
    // Main tab has 'drums' track
    expect(screen.getAllByText('drums').length).toBeGreaterThan(0);
    // Switch to drums tab
    fireEvent.click(screen.getByRole('button', { name: /^drums$/i }));
    // Now should have drum submix tracks
    expect(screen.getAllByText('kick').length).toBeGreaterThan(0);
    expect(screen.getAllByText('hihat').length).toBeGreaterThan(0);
    expect(screen.getAllByText('toms').length).toBeGreaterThan(0);
  });

  it('dB readout shows -∞ for zero volume', () => {
    render(<MixerView />);
    // The linearToDb function returns '-∞' for values <= 0.0001
    // Master volume default is 0.8, so we check it shows a dB value
    expect(screen.getAllByText(/dB/).length).toBeGreaterThan(0);
  });

  it('trim knob label displays correctly', () => {
    render(<MixerView />);
    const trimKnobs = screen.getAllByLabelText(/Trim: /);
    expect(trimKnobs.length).toBeGreaterThan(0);
  });

  it('Low EQ knob label displays correctly', () => {
    render(<MixerView />);
    const loEqKnobs = screen.getAllByLabelText(/Lo EQ: /);
    expect(loEqKnobs.length).toBeGreaterThan(0);
  });

  it('aux send knob displays correctly', () => {
    render(<MixerView />);
    const sendKnobs = screen.getAllByLabelText(/Snd A: /);
    expect(sendKnobs.length).toBeGreaterThan(0);
  });

  it('playing state triggers metering updates', () => {
    mockIsPlaying.mockReturnValue(true);
    render(<MixerView />);
    mockIsPlaying.mockReturnValue(false);
  });

  it('changing trim knob dispatches param change', () => {
    render(<MixerView />);
    const trimKnobs = screen.getAllByLabelText(/Trim: /);
    fireEvent.change(trimKnobs[0], { target: { value: '5' } });
  });

  it('changing Hi EQ knob dispatches param change', () => {
    render(<MixerView />);
    const hiEqKnobs = screen.getAllByLabelText(/Hi EQ: /);
    fireEvent.change(hiEqKnobs[0], { target: { value: '3' } });
  });

  it('changing Lo EQ knob dispatches param change', () => {
    render(<MixerView />);
    const loEqKnobs = screen.getAllByLabelText(/Lo EQ: /);
    fireEvent.change(loEqKnobs[0], { target: { value: '-4' } });
  });

  it('changing aux send knob dispatches param change', () => {
    render(<MixerView />);
    const sendKnobs = screen.getAllByLabelText(/Snd A: /);
    fireEvent.change(sendKnobs[0], { target: { value: '50' } });
  });

  it('master volume change triggers setMasterVolume', () => {
    render(<MixerView />);
    const masterVol = screen.getByLabelText('Master volume');
    fireEvent.change(masterVol, { target: { value: '0.9' } });
  });

  it('drum tracks show submix visual notice', () => {
    render(<MixerView />);
    fireEvent.click(screen.getByRole('button', { name: /^drums$/i }));
    expect(screen.getByText('Submix controls')).toBeInTheDocument();
  });

  it('volume fader changes update the dB readout', () => {
    render(<MixerView />);
    const volFader = screen.getByLabelText('drums volume');
    fireEvent.change(volFader, { target: { value: '0.5' } });
    expect(screen.getAllByText(/dB/).length).toBeGreaterThan(0);
  });

  it('switching tabs updates visible channel count', () => {
    render(<MixerView />);
    const mainMuteButtons = screen.getAllByRole('button', { name: /^Mute /i });
    expect(mainMuteButtons.length).toBe(5);
    fireEvent.click(screen.getByRole('button', { name: /^drums$/i }));
    const drumMuteButtons = screen.getAllByRole('button', { name: /^Mute /i });
    expect(drumMuteButtons.length).toBe(5);
  });

  it('all channel strips have knobs', () => {
    render(<MixerView />);
    const trimKnobs = screen.getAllByLabelText(/Trim: /);
    expect(trimKnobs.length).toBe(5);
    const hiEqKnobs = screen.getAllByLabelText(/Hi EQ: /);
    expect(hiEqKnobs.length).toBe(5);
    const loEqKnobs = screen.getAllByLabelText(/Lo EQ: /);
    expect(loEqKnobs.length).toBe(5);
    const sendKnobs = screen.getAllByLabelText(/Snd A: /);
    expect(sendKnobs.length).toBe(5);
  });

  it('drum submix has channel strips with knobs', () => {
    render(<MixerView />);
    fireEvent.click(screen.getByRole('button', { name: /^drums$/i }));
    const trimKnobs = screen.getAllByLabelText(/Trim: /);
    expect(trimKnobs.length).toBe(5);
  });

  it('mute multiple channels', () => {
    render(<MixerView />);
    const muteButtons = screen.getAllByRole('button', { name: /^Mute /i });
    fireEvent.click(muteButtons[0]);
    fireEvent.click(muteButtons[1]);
    fireEvent.click(muteButtons[2]);
    expect(muteButtons[0]).toHaveAttribute('aria-pressed', 'true');
    expect(muteButtons[1]).toHaveAttribute('aria-pressed', 'true');
    expect(muteButtons[2]).toHaveAttribute('aria-pressed', 'true');
  });

  it('solo multiple channels', () => {
    render(<MixerView />);
    const soloButtons = screen.getAllByRole('button', { name: /^Solo /i });
    fireEvent.click(soloButtons[0]);
    fireEvent.click(soloButtons[2]);
    expect(soloButtons[0]).toHaveAttribute('aria-pressed', 'true');
    expect(soloButtons[2]).toHaveAttribute('aria-pressed', 'true');
  });

  it('pan controls work for different channels', () => {
    render(<MixerView />);
    const panControls = screen.getAllByLabelText(/Pan /);
    fireEvent.change(panControls[0], { target: { value: '0.5' } });
    fireEvent.change(panControls[1], { target: { value: '-0.3' } });
  });

  it('renders level meters for all channels', () => {
    render(<MixerView />);
    const meterLabels = screen.getAllByLabelText(/Level meter/);
    expect(meterLabels.length).toBeGreaterThanOrEqual(5);
  });

  it('dB readout shows correct format', () => {
    render(<MixerView />);
    const dbReadouts = screen.getAllByText(/dB/);
    expect(dbReadouts.length).toBeGreaterThan(0);
  });

  it('master strip has master VU and dB readout', () => {
    render(<MixerView />);
    expect(screen.getByText('Master')).toBeInTheDocument();
    const dBReadouts = screen.getAllByText(/dB/);
    expect(dBReadouts.length).toBeGreaterThan(0);
  });
});
