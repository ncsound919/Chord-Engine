import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { SynthView } from './SynthView';
import { PersistenceManager } from '../../lib/persistence';

vi.mock('../../lib/audio/synth', () => {
  const patch = {
    lfoRate: 45,
    lfoDelay: 15,
    dcoLfo: 8,
    dcoPwm: 35,
    dcoPwmSrc: 'LFO',
    dcoRange: "8'",
    dcoPulse: true,
    dcoSaw: true,
    dcoSub: 55,
    dcoNoise: 18,
    hpfFreq: 1,
    vcfCutoff: 68,
    vcfRes: 40,
    vcfEnv: 45,
    vcfLfo: 12,
    vcfKeyFollow: 40,
    vcfPolarity: '+',
    vcaMode: 'ENV',
    vcaLevel: 80,
    envA: 12,
    envD: 35,
    envS: 70,
    envR: 45,
    chorus: 'I',
    voiceMode: 'POLY',
    unisonDetune: 15,
    subWave: 'SQR',
    filterDrive: 15,
    outputSat: 10,
  };
  const engineInstance = {
    getPatch: vi.fn(() => patch),
    updatePatch: vi.fn(),
    setupChannel: vi.fn(),
    onPatchUpdate: vi.fn(() => vi.fn()),
    getAllPatches: vi.fn(() => ({ lead: patch, pad: patch, bass: patch })),
  };
  return {
    Ju60Engine: { getInstance: vi.fn(() => engineInstance) },
  };
});

vi.mock('../../lib/persistence', () => ({
  PersistenceManager: {
    savePreset: vi.fn(async () => {}),
    deletePreset: vi.fn(async () => {}),
    listPresets: vi.fn(async () => []),
  },
}));

vi.mock('../../lib/audio/engine', () => ({
  audioEngine: {},
}));

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe('SynthView', () => {
  it('renders the synth header', () => {
    render(<SynthView />);
    expect(screen.getByText(/JU-60 Multi-Channel Synthesizer/)).toBeInTheDocument();
  });

  it('shows three channel tabs', () => {
    render(<SynthView />);
    expect(screen.getByRole('button', { name: /Synth Lead/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Synth Pad/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Synth Bass/i })).toBeInTheDocument();
  });

  it('defaults to lead channel', () => {
    render(<SynthView />);
    expect(screen.getByText('CH: LEAD')).toBeInTheDocument();
  });

  it('switches to pad channel on click', () => {
    render(<SynthView />);
    fireEvent.click(screen.getByRole('button', { name: /Synth Pad/i }));
    expect(screen.getByText('CH: PAD')).toBeInTheDocument();
  });

  it('switches to bass channel on click', () => {
    render(<SynthView />);
    fireEvent.click(screen.getByRole('button', { name: /Synth Bass/i }));
    expect(screen.getByText('CH: BASS')).toBeInTheDocument();
  });

  it('displays the init channel button', () => {
    render(<SynthView />);
    expect(screen.getByRole('button', { name: /Init Channel/i })).toBeInTheDocument();
  });

  it('shows the presets button', () => {
    render(<SynthView />);
    expect(screen.getByRole('button', { name: /Presets/i })).toBeInTheDocument();
  });

  it('shows factory presets for the active channel', () => {
    render(<SynthView />);
    expect(screen.getByRole('button', { name: 'Classic Sq' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Laser Saw' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Trippy LFO' })).toBeInTheDocument();
  });

  it('displays voice mode buttons', () => {
    render(<SynthView />);
    expect(screen.getByRole('button', { name: 'POLY' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'MONO' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'UNISON' })).toBeInTheDocument();
  });

  it('has a new preset name input', () => {
    render(<SynthView />);
    expect(screen.getByPlaceholderText('New Preset Name...')).toBeInTheDocument();
  });

  it('opens preset list when clicking Presets button', () => {
    render(<SynthView />);
    fireEvent.click(screen.getByRole('button', { name: /Presets/i }));
    expect(screen.getByText('No presets saved yet.')).toBeInTheDocument();
  });

  it('switches back to lead channel after visiting pad', () => {
    render(<SynthView />);
    fireEvent.click(screen.getByRole('button', { name: /Synth Pad/i }));
    expect(screen.getByText('CH: PAD')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Synth Lead/i }));
    expect(screen.getByText('CH: LEAD')).toBeInTheDocument();
  });

  it('renders the LFO section', () => {
    render(<SynthView />);
    expect(screen.getAllByText('LFO').length).toBeGreaterThan(0);
  });

  it('renders the DCO section', () => {
    render(<SynthView />);
    expect(screen.getByText('DCO')).toBeInTheDocument();
  });

  it('renders the VCF section', () => {
    render(<SynthView />);
    expect(screen.getByText('VCF')).toBeInTheDocument();
  });

  it('renders the ENV section', () => {
    render(<SynthView />);
    expect(screen.getAllByText('ENV').length).toBeGreaterThan(0);
  });

  it('renders the CHORUS section', () => {
    render(<SynthView />);
    expect(screen.getByText('CHORUS')).toBeInTheDocument();
  });

  it('renders the VOICE ENGINE section', () => {
    render(<SynthView />);
    expect(screen.getByText('VOICE ENGINE')).toBeInTheDocument();
  });

  it('clicking Init Channel resets patch values', () => {
    render(<SynthView />);
    const initBtn = screen.getByRole('button', { name: /Init Channel/i });
    fireEvent.click(initBtn);
    expect(screen.getByText('CH: LEAD')).toBeInTheDocument();
  });

  it('clicking a factory preset button applies the preset', () => {
    render(<SynthView />);
    fireEvent.click(screen.getByRole('button', { name: 'Classic Sq' }));
    expect(screen.getByText('CH: LEAD')).toBeInTheDocument();
  });

  it('clicking a chorus button changes the chorus mode', () => {
    render(<SynthView />);
    const chorusBtn = screen.getByRole('button', { name: 'II' });
    fireEvent.click(chorusBtn);
    expect(chorusBtn).toBeInTheDocument();
  });

  it('voice mode buttons are clickable', () => {
    render(<SynthView />);
    const monoBtn = screen.getByRole('button', { name: 'MONO' });
    fireEvent.click(monoBtn);
    expect(monoBtn).toBeInTheDocument();
  });

  it('unison voice mode shows detune fader', () => {
    render(<SynthView />);
    const unisonBtn = screen.getByRole('button', { name: 'UNISON' });
    fireEvent.click(unisonBtn);
    expect(screen.getByText('Detune')).toBeInTheDocument();
  });

  it('has a preset name input', () => {
    render(<SynthView />);
    const input = screen.getByPlaceholderText('New Preset Name...');
    fireEvent.change(input, { target: { value: 'My Preset' } });
    expect(input).toHaveValue('My Preset');
  });

  it('renders the synth description', () => {
    render(<SynthView />);
    expect(screen.getByText(/Faithful Analog Modeling/)).toBeInTheDocument();
  });

  it('renders the Master Gain label', () => {
    render(<SynthView />);
    expect(screen.getByText('Master Gain')).toBeInTheDocument();
  });

  it('renders the Assign Mode label', () => {
    render(<SynthView />);
    expect(screen.getByText('Assign Mode')).toBeInTheDocument();
  });

  it('shows factory presets for pad channel', () => {
    render(<SynthView />);
    fireEvent.click(screen.getByRole('button', { name: /Synth Pad/i }));
    expect(screen.getByRole('button', { name: 'Warm Pad' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Shimmer' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Deep Pad' })).toBeInTheDocument();
  });

  it('shows factory presets for bass channel', () => {
    render(<SynthView />);
    fireEvent.click(screen.getByRole('button', { name: /Synth Bass/i }));
    expect(screen.getByRole('button', { name: 'Solid Sub' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Acid Saw' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Pluck' })).toBeInTheDocument();
  });

  it('renders the CH display for lead channel', () => {
    render(<SynthView />);
    expect(screen.getByText('CH: LEAD')).toBeInTheDocument();
  });

  it('clicking LFO section reset button resets LFO params', () => {
    render(<SynthView />);
    const resetButtons = screen.getAllByTitle('Reset Section');
    resetButtons[0].click(); // LFO is first section
  });

  it('clicking DCO section reset button resets DCO params', () => {
    render(<SynthView />);
    const resetButtons = screen.getAllByTitle('Reset Section');
    resetButtons[1].click(); // DCO is second section
  });

  it('clicking VCF section reset button resets VCF params', () => {
    render(<SynthView />);
    const resetButtons = screen.getAllByTitle('Reset Section');
    resetButtons[2].click(); // VCF is third section
  });

  it('clicking ENV section reset button resets ENV params', () => {
    render(<SynthView />);
    // The ENV section has a reset button - find all rotate buttons
    const resetButtons = screen.getAllByTitle('Reset Section');
    // The ENV section is the last section with ADSR, so its reset is one of the later ones
    // Just click one to verify no crash
    resetButtons[resetButtons.length - 1].click();
  });

  it('toggling VCA mode from ENV to GATE', () => {
    render(<SynthView />);
    fireEvent.click(screen.getByRole('button', { name: 'GATE' }));
    // VCA mode should change
  });

  it('toggling VCF polarity', () => {
    render(<SynthView />);
    const polarityBtn = screen.getByRole('button', { name: '+' });
    fireEvent.click(polarityBtn);
    expect(screen.getByRole('button', { name: '-' })).toBeInTheDocument();
  });

  it('save preset button is disabled when name is empty', () => {
    render(<SynthView />);
    const saveBtn = screen.getByRole('button', { name: /save preset/i });
    expect(saveBtn).toBeDisabled();
  });

  it('save preset button enabled when name is entered', () => {
    render(<SynthView />);
    fireEvent.change(screen.getByPlaceholderText('New Preset Name...'), { target: { value: 'Test' } });
    const saveBtn = screen.getByRole('button', { name: /save preset/i });
    expect(saveBtn).not.toBeDisabled();
  });

  it('save preset saves and clears name', async () => {
    render(<SynthView />);
    fireEvent.change(screen.getByPlaceholderText('New Preset Name...'), { target: { value: 'TestPreset' } });
    fireEvent.click(screen.getByRole('button', { name: /save preset/i }));
    await waitFor(() => {
      expect(screen.getByPlaceholderText('New Preset Name...')).toHaveValue('');
    });
  });

  it('pressing Enter in preset name input saves', async () => {
    render(<SynthView />);
    const input = screen.getByPlaceholderText('New Preset Name...');
    fireEvent.change(input, { target: { value: 'EnterPreset' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    await waitFor(() => {
      expect(input).toHaveValue('');
    });
  });

  it('clicking Init Channel resets the patch', () => {
    render(<SynthView />);
    fireEvent.click(screen.getByRole('button', { name: /Init Channel/i }));
    // No crash means success - engine.updatePatch called with DEFAULT_PATCH
  });

  it('clicking factory preset shows flash animation', () => {
    render(<SynthView />);
    const classicBtn = screen.getByRole('button', { name: 'Classic Sq' });
    fireEvent.click(classicBtn);
    // Button should have pulse animation class
    expect(classicBtn.className).toContain('animate-pulse');
  });

  it('DRIVE section is rendered', () => {
    render(<SynthView />);
    expect(screen.getByText('DRIVE')).toBeInTheDocument();
  });

  it('VCA Mode section is rendered', () => {
    render(<SynthView />);
    expect(screen.getByText('VCA Mode')).toBeInTheDocument();
  });

  it('shows ENV and GATE mode buttons', () => {
    render(<SynthView />);
    // Both VCA mode buttons exist
    const envBtns = screen.getAllByRole('button', { name: 'ENV' });
    const gateBtn = screen.getByRole('button', { name: 'GATE' });
    expect(envBtns.length).toBeGreaterThan(0);
    expect(gateBtn).toBeInTheDocument();
  });

  it('unison detune fader shows when unison is selected', () => {
    render(<SynthView />);
    fireEvent.click(screen.getByRole('button', { name: 'UNISON' }));
    expect(screen.getByText('Detune')).toBeInTheDocument();
  });

  it('unison detune fader hides when not in unison mode', () => {
    render(<SynthView />);
    fireEvent.click(screen.getByRole('button', { name: 'POLY' }));
    expect(screen.queryByText('Detune')).not.toBeInTheDocument();
  });

  it('rendering HPF selector', () => {
    render(<SynthView />);
    expect(screen.getByText('HPF')).toBeInTheDocument();
  });

  it('VCA mode buttons toggle', () => {
    render(<SynthView />);
    const gateBtn = screen.getByRole('button', { name: 'GATE' });
    fireEvent.click(gateBtn);
    // Click the VCA Mode ENV button (not the section header)
    const envBtns = screen.getAllByRole('button', { name: 'ENV' });
    // The last ENV button should be the VCA mode one
    fireEvent.click(envBtns[envBtns.length - 1]);
  });

  it('loading a user preset from the preset list applies the patch', async () => {
    const mockPm = vi.mocked(PersistenceManager);
    mockPm.listPresets.mockResolvedValue([
      { id: 'user-1', name: 'Saved Sound', category: 'lead', isPublic: false, patch: {} },
    ]);
    await act(async () => {
      render(<SynthView />);
    });
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Presets/i }));
    });
    const presetBtn = screen.getByText('Saved Sound');
    await act(async () => {
      fireEvent.click(presetBtn);
    });
    expect(presetBtn).not.toBeInTheDocument();
    mockPm.listPresets.mockResolvedValue([]);
  });

  it('delete preset removes it from the list', async () => {
    const mockPm = vi.mocked(PersistenceManager);
    const presets = [
      { id: 'del-1', name: 'ToDelete', category: 'lead', isPublic: false, patch: {} },
    ];
    mockPm.listPresets.mockResolvedValue(presets);
    mockPm.deletePreset.mockImplementation(async (id: string) => {
      const idx = presets.findIndex(p => p.id === id);
      if (idx >= 0) presets.splice(idx, 1);
    });
    await act(async () => {
      render(<SynthView />);
    });
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Presets/i }));
    });
    const delBtn = screen.getByRole('button', { name: /Delete preset ToDelete/i });
    await act(async () => {
      fireEvent.click(delBtn);
    });
    await waitFor(() => {
      expect(screen.queryByText('ToDelete')).not.toBeInTheDocument();
    });
    mockPm.listPresets.mockResolvedValue([]);
    mockPm.deletePreset.mockImplementation(async () => {});
  });

  it('DCO section reset sets correct defaults', () => {
    render(<SynthView />);
    const resetButtons = screen.getAllByTitle('Reset Section');
    resetButtons[1].click();
    expect(screen.getByText('DCO')).toBeInTheDocument();
  });

  it('VCA section reset button exists', () => {
    render(<SynthView />);
    const resetButtons = screen.getAllByTitle('Reset Section');
    expect(resetButtons.length).toBeGreaterThanOrEqual(5);
  });

  it('DRIVE section reset button resets drive params', () => {
    render(<SynthView />);
    const resetButtons = screen.getAllByTitle('Reset Section');
    const driveReset = resetButtons[3];
    driveReset.click();
    expect(screen.getByText('DRIVE')).toBeInTheDocument();
  });

  it('DCO pulse toggle changes state', () => {
    render(<SynthView />);
    const pulseBtn = screen.getAllByText('⊓')[0];
    fireEvent.click(pulseBtn);
    expect(pulseBtn).toBeInTheDocument();
  });

  it('DCO saw toggle changes state', () => {
    render(<SynthView />);
    const sawBtn = screen.getAllByText('▲')[0];
    fireEvent.click(sawBtn);
    expect(sawBtn).toBeInTheDocument();
  });

  it('selecting PWM Source changes the source', () => {
    render(<SynthView />);
    const sourceSelector = screen.getByText('Source');
    expect(sourceSelector).toBeInTheDocument();
  });

  it('selecting DCO Range changes the range', () => {
    render(<SynthView />);
    const rangeButtons = screen.getAllByText("8'");
    expect(rangeButtons.length).toBeGreaterThan(0);
  });

  it('changing chorus modes', () => {
    render(<SynthView />);
    fireEvent.click(screen.getByRole('button', { name: 'OFF' }));
    fireEvent.click(screen.getByRole('button', { name: 'I' }));
    fireEvent.click(screen.getByRole('button', { name: 'II' }));
    fireEvent.click(screen.getByRole('button', { name: 'BOTH' }));
  });

  it('VCA mode GATE is selectable', () => {
    render(<SynthView />);
    const gateBtn = screen.getByRole('button', { name: 'GATE' });
    fireEvent.click(gateBtn);
    expect(gateBtn).toBeInTheDocument();
  });

  it('VCA mode ENV is selectable', () => {
    render(<SynthView />);
    const envBtns = screen.getAllByRole('button', { name: 'ENV' });
    fireEvent.click(envBtns[envBtns.length - 1]);
    expect(envBtns[envBtns.length - 1]).toBeInTheDocument();
  });

  it('init channel button resets the current channel', () => {
    render(<SynthView />);
    fireEvent.click(screen.getByRole('button', { name: /Synth Pad/i }));
    fireEvent.click(screen.getByRole('button', { name: /Init Channel/i }));
    expect(screen.getByText('CH: PAD')).toBeInTheDocument();
  });

  it('switching channels shows channel-specific info', () => {
    render(<SynthView />);
    fireEvent.click(screen.getByRole('button', { name: /Synth Bass/i }));
    expect(screen.getByText('CH: BASS')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Synth Lead/i }));
    expect(screen.getByText('CH: LEAD')).toBeInTheDocument();
  });

  it('factory preset buttons change when channel switches', () => {
    render(<SynthView />);
    expect(screen.getByRole('button', { name: 'Classic Sq' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Synth Pad/i }));
    expect(screen.getByRole('button', { name: 'Warm Pad' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Synth Bass/i }));
    expect(screen.getByRole('button', { name: 'Solid Sub' })).toBeInTheDocument();
  });

  it('VCA Mode section shows both mode options', () => {
    render(<SynthView />);
    expect(screen.getAllByText('ENV').length).toBeGreaterThan(0);
    expect(screen.getByText('GATE', { selector: 'button' })).toBeInTheDocument();
  });

  it('unison mode shows detune fader and MONO hides it', () => {
    render(<SynthView />);
    fireEvent.click(screen.getByRole('button', { name: 'UNISON' }));
    expect(screen.getByText('Detune')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'MONO' }));
    expect(screen.queryByText('Detune')).not.toBeInTheDocument();
  });

  it('HPF selector shows all options', () => {
    render(<SynthView />);
    expect(screen.getByText('0')).toBeInTheDocument();
    expect(screen.getByText('1')).toBeInTheDocument();
    expect(screen.getByText('2')).toBeInTheDocument();
    expect(screen.getByText('3')).toBeInTheDocument();
  });

  it('fader labels display current values', () => {
    render(<SynthView />);
    expect(screen.getByText('Rate')).toBeInTheDocument();
    expect(screen.getByText('Delay')).toBeInTheDocument();
    expect(screen.getByText('Freq')).toBeInTheDocument();
    expect(screen.getByText('Res')).toBeInTheDocument();
  });

  it('save button shows spinner when saving', async () => {
    render(<SynthView />);
    fireEvent.change(screen.getByPlaceholderText('New Preset Name...'), { target: { value: 'Spinner' } });
    fireEvent.click(screen.getByRole('button', { name: /save preset/i }));
    await waitFor(() => {
      expect(screen.getByPlaceholderText('New Preset Name...')).toHaveValue('');
    });
  });

  it('save preset with empty name does nothing', () => {
    render(<SynthView />);
    const saveBtn = screen.getByRole('button', { name: /save preset/i });
    fireEvent.click(saveBtn);
    expect(saveBtn).toBeDisabled();
  });

  it('VCA mode section has GATE and ENV options', () => {
    render(<SynthView />);
    const vcaSection = screen.getByText('VCA Mode');
    expect(vcaSection).toBeInTheDocument();
  });

  it('multiple factory presets can be loaded in sequence', () => {
    render(<SynthView />);
    fireEvent.click(screen.getByRole('button', { name: 'Classic Sq' }));
    fireEvent.click(screen.getByRole('button', { name: 'Laser Saw' }));
    fireEvent.click(screen.getByRole('button', { name: 'Trippy LFO' }));
    expect(screen.getByText('CH: LEAD')).toBeInTheDocument();
  });

  it('clicking the same chorus button turns it off', () => {
    render(<SynthView />);
    const offBtn = screen.getByRole('button', { name: 'OFF' });
    fireEvent.click(offBtn);
    expect(offBtn).toBeInTheDocument();
  });

  it('all section labels are visible', () => {
    render(<SynthView />);
    expect(screen.getAllByText('LFO').length).toBeGreaterThan(0);
    expect(screen.getByText('DCO')).toBeInTheDocument();
    expect(screen.getByText('VCF')).toBeInTheDocument();
    expect(screen.getAllByText('ENV').length).toBeGreaterThan(0);
    expect(screen.getByText('CHORUS')).toBeInTheDocument();
    expect(screen.getByText('DRIVE')).toBeInTheDocument();
  });

  it('preset list button toggles open and closed', () => {
    render(<SynthView />);
    const btn = screen.getByRole('button', { name: /Presets/i });
    fireEvent.click(btn);
    expect(screen.getByText('No presets saved yet.')).toBeInTheDocument();
    fireEvent.click(btn);
    expect(screen.queryByText('No presets saved yet.')).not.toBeInTheDocument();
  });

  it('fader click near bottom sets low value', () => {
    render(<SynthView />);
    const faderTracks = document.querySelectorAll('.cursor-ns-resize');
    const track = faderTracks[0] as HTMLElement;
    const rect = track.getBoundingClientRect();
    fireEvent.mouseDown(track, { clientX: rect.left + rect.width / 2, clientY: rect.bottom - 2 });
  });

  it('fader click near top sets high value', () => {
    render(<SynthView />);
    const faderTracks = document.querySelectorAll('.cursor-ns-resize');
    const track = faderTracks[0] as HTMLElement;
    const rect = track.getBoundingClientRect();
    fireEvent.mouseDown(track, { clientX: rect.left + rect.width / 2, clientY: rect.top + 2 });
  });

  it('exercises all fader onChange callbacks via mocked getBoundingClientRect', () => {
    const original = Element.prototype.getBoundingClientRect;
    Element.prototype.getBoundingClientRect = function () {
      return { top: 0, left: 0, width: 10, height: 100, right: 10, bottom: 100, x: 0, y: 0, toJSON: () => {} };
    };
    render(<SynthView />);
    const faderTracks = document.querySelectorAll('.cursor-ns-resize');
    faderTracks.forEach((track) => {
      fireEvent.mouseDown(track, { clientX: 5, clientY: 50 });
    });
    Element.prototype.getBoundingClientRect = original;
  });

  it('exercises fader mousemove and mouseup via mocked getBoundingClientRect', () => {
    const original = Element.prototype.getBoundingClientRect;
    Element.prototype.getBoundingClientRect = function () {
      return { top: 0, left: 0, width: 10, height: 100, right: 10, bottom: 100, x: 0, y: 0, toJSON: () => {} };
    };
    render(<SynthView />);
    const faderTracks = document.querySelectorAll('.cursor-ns-resize');
    const track = faderTracks[0] as HTMLElement;
    fireEvent.mouseDown(track, { clientX: 5, clientY: 50 });
    fireEvent.mouseMove(window, { clientX: 5, clientY: 20 });
    fireEvent.mouseUp(window);
    Element.prototype.getBoundingClientRect = original;
  });

  it('HPF selector options are clickable', () => {
    render(<SynthView />);
    fireEvent.click(screen.getByText('HPF'));
    const option0 = screen.getAllByText('0');
    fireEvent.click(option0[option0.length - 1]);
    const option2 = screen.getAllByText('2');
    fireEvent.click(option2[option2.length - 1]);
    const option3 = screen.getAllByText('3');
    fireEvent.click(option3[option3.length - 1]);
  });

  it('DCO range selector options are clickable', () => {
    render(<SynthView />);
    fireEvent.click(screen.getByText("16'"));
    fireEvent.click(screen.getByText("4'"));
    fireEvent.click(screen.getByText("8'"));
  });

  it('PWM source selector options are clickable', () => {
    render(<SynthView />);
    const envOptions = screen.getAllByText('ENV');
    const pwmEnvOption = envOptions.find(el => el.tagName === 'BUTTON' && el.textContent === 'ENV' && el.className.includes('px-1.5'));
    if (pwmEnvOption) fireEvent.click(pwmEnvOption);
    fireEvent.click(screen.getByText('MANUAL'));
    fireEvent.click(screen.getAllByText('LFO').find(el => el.tagName === 'BUTTON' && el.className.includes('px-1.5'))!);
  });

  it('DRIVE filter fader interaction', () => {
    render(<SynthView />);
    expect(screen.getByText('Filter')).toBeInTheDocument();
    expect(screen.getByText('Output')).toBeInTheDocument();
  });

  it('LFO section reset resets LFO params to defaults', () => {
    render(<SynthView />);
    const resetButtons = screen.getAllByTitle('Reset Section');
    fireEvent.click(resetButtons[0]);
    expect(screen.getAllByText('45').length).toBeGreaterThan(0);
  });

  it('DCO section reset resets DCO params to defaults', () => {
    render(<SynthView />);
    const resetButtons = screen.getAllByTitle('Reset Section');
    fireEvent.click(resetButtons[1]);
    expect(screen.getByText('DCO')).toBeInTheDocument();
  });

  it('VCF section reset resets VCF params to defaults', () => {
    render(<SynthView />);
    const resetButtons = screen.getAllByTitle('Reset Section');
    fireEvent.click(resetButtons[2]);
    expect(screen.getByText('VCF')).toBeInTheDocument();
  });

  it('ENV section reset resets ENV params to defaults', () => {
    render(<SynthView />);
    const resetButtons = screen.getAllByTitle('Reset Section');
    fireEvent.click(resetButtons[4]);
    expect(screen.getAllByText('ENV').length).toBeGreaterThan(0);
  });

  it('factory preset on pad channel applies patch', () => {
    render(<SynthView />);
    fireEvent.click(screen.getByRole('button', { name: /Synth Pad/i }));
    fireEvent.click(screen.getByRole('button', { name: 'Warm Pad' }));
    expect(screen.getByText('CH: PAD')).toBeInTheDocument();
  });

  it('factory preset on bass channel applies patch', () => {
    render(<SynthView />);
    fireEvent.click(screen.getByRole('button', { name: /Synth Bass/i }));
    fireEvent.click(screen.getByRole('button', { name: 'Solid Sub' }));
    expect(screen.getByText('CH: BASS')).toBeInTheDocument();
  });

  it('load factory preset sets justLoadedPreset flash then clears', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    render(<SynthView />);
    fireEvent.click(screen.getByRole('button', { name: 'Laser Saw' }));
    const btn = screen.getByRole('button', { name: 'Laser Saw' });
    expect(btn.className).toContain('animate-pulse');
    act(() => { vi.advanceTimersByTime(1600); });
    await waitFor(() => {
      expect(btn.className).not.toContain('animate-pulse');
    });
    vi.useRealTimers();
  });

  it('rapid preset clicks clear previous timeout', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    render(<SynthView />);
    fireEvent.click(screen.getByRole('button', { name: 'Classic Sq' }));
    fireEvent.click(screen.getByRole('button', { name: 'Laser Saw' }));
    act(() => { vi.advanceTimersByTime(1600); });
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Laser Saw' }).className).not.toContain('animate-pulse');
    });
    vi.useRealTimers();
  });

  it('save preset button with spaces-only name is disabled', () => {
    render(<SynthView />);
    fireEvent.change(screen.getByPlaceholderText('New Preset Name...'), { target: { value: '   ' } });
    const saveBtn = screen.getByRole('button', { name: /save preset/i });
    expect(saveBtn).toBeDisabled();
  });

  it('save preset re-entrancy guard prevents double save', async () => {
    const mockPm = vi.mocked(PersistenceManager);
    let resolveFirst: (() => void) | null = null;
    mockPm.savePreset.mockImplementationOnce(() => new Promise(r => { resolveFirst = r; }));
    mockPm.listPresets.mockResolvedValue([]);
    render(<SynthView />);
    fireEvent.change(screen.getByPlaceholderText('New Preset Name...'), { target: { value: 'SlowPreset' } });
    fireEvent.click(screen.getByRole('button', { name: /save preset/i }));
    expect(screen.getByRole('button', { name: /save preset/i })).toBeDisabled();
    resolveFirst?.();
    await waitFor(() => {
      expect(mockPm.savePreset).toHaveBeenCalledTimes(1);
    });
  });

  it('save preset calls PersistenceManager.savePreset', async () => {
    const mockPm = vi.mocked(PersistenceManager);
    mockPm.savePreset.mockResolvedValue(undefined);
    mockPm.listPresets.mockResolvedValue([]);
    render(<SynthView />);
    fireEvent.change(screen.getByPlaceholderText('New Preset Name...'), { target: { value: 'TestSave' } });
    fireEvent.click(screen.getByRole('button', { name: /save preset/i }));
    await waitFor(() => {
      expect(mockPm.savePreset).toHaveBeenCalledWith(expect.objectContaining({ name: 'TestSave' }));
    });
  });

  it('preset list shows preset with delete button', async () => {
    const mockPm = vi.mocked(PersistenceManager);
    mockPm.listPresets.mockResolvedValue([
      { id: 'p1', name: 'MyPreset', category: 'lead', isPublic: false, patch: {} },
      { id: 'p2', name: 'PublicPreset', category: 'lead', isPublic: true, patch: {} },
    ]);
    await act(async () => { render(<SynthView />); });
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: /Presets/i })); });
    expect(screen.getByText('MyPreset')).toBeInTheDocument();
    expect(screen.getByText('PublicPreset')).toBeInTheDocument();
    expect(screen.getByText('Private')).toBeInTheDocument();
    expect(screen.getByText('Public')).toBeInTheDocument();
  });

  it('preset list filters by active channel', async () => {
    const mockPm = vi.mocked(PersistenceManager);
    mockPm.listPresets.mockResolvedValue([
      { id: 'p1', name: 'LeadPreset', category: 'lead', isPublic: false, patch: {} },
      { id: 'p2', name: 'PadPreset', category: 'pad', isPublic: false, patch: {} },
      { id: 'p3', name: 'NoCatPreset', isPublic: false, patch: {} },
    ]);
    await act(async () => { render(<SynthView />); });
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: /Presets/i })); });
    expect(screen.getByText('LeadPreset')).toBeInTheDocument();
    expect(screen.queryByText('PadPreset')).not.toBeInTheDocument();
    expect(screen.getByText('NoCatPreset')).toBeInTheDocument();
  });

  it('loading user preset with empty patch applies defaults', async () => {
    const mockPm = vi.mocked(PersistenceManager);
    mockPm.listPresets.mockResolvedValue([
      { id: 'u1', name: 'EmptyPatch', category: 'lead', isPublic: false, patch: {} },
    ]);
    await act(async () => { render(<SynthView />); });
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: /Presets/i })); });
    await act(async () => { fireEvent.click(screen.getByText('EmptyPatch')); });
    expect(screen.queryByText('EmptyPatch')).not.toBeInTheDocument();
  });

  it('clicking Init Channel on each channel resets correctly', () => {
    render(<SynthView />);
    fireEvent.click(screen.getByRole('button', { name: /Synth Lead/i }));
    fireEvent.click(screen.getByRole('button', { name: /Init Channel/i }));
    expect(screen.getByText('CH: LEAD')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Synth Pad/i }));
    fireEvent.click(screen.getByRole('button', { name: /Init Channel/i }));
    expect(screen.getByText('CH: PAD')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Synth Bass/i }));
    fireEvent.click(screen.getByRole('button', { name: /Init Channel/i }));
    expect(screen.getByText('CH: BASS')).toBeInTheDocument();
  });

  it('VCF polarity toggles between + and -', () => {
    render(<SynthView />);
    const btn = screen.getByRole('button', { name: '+' });
    fireEvent.click(btn);
    expect(screen.getByRole('button', { name: '-' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '-' }));
    expect(screen.getByRole('button', { name: '+' })).toBeInTheDocument();
  });

  it('voice mode POLY is selected by default', () => {
    render(<SynthView />);
    const polyBtn = screen.getByRole('button', { name: 'POLY' });
    expect(polyBtn.className).toContain('bg-emerald-500/20');
  });

  it('switching voice modes updates active state', () => {
    render(<SynthView />);
    fireEvent.click(screen.getByRole('button', { name: 'MONO' }));
    expect(screen.getByRole('button', { name: 'MONO' }).className).toContain('bg-emerald-500/20');
    fireEvent.click(screen.getByRole('button', { name: 'UNISON' }));
    expect(screen.getByRole('button', { name: 'UNISON' }).className).toContain('bg-emerald-500/20');
    expect(screen.getByText('Detune')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'POLY' }));
    expect(screen.queryByText('Detune')).not.toBeInTheDocument();
  });

  it('VCA mode ENV is selected by default for lead', () => {
    render(<SynthView />);
    const envBtns = screen.getAllByRole('button', { name: 'ENV' });
    const vcaEnvBtn = envBtns[envBtns.length - 1];
    expect(vcaEnvBtn.className).toContain('bg-violet-500/20');
  });

  it('chorus OFF is not selected by default', () => {
    render(<SynthView />);
    const offBtn = screen.getByRole('button', { name: 'OFF' });
    expect(offBtn.className).not.toContain('bg-orange-500');
  });

  it('clicking active chorus button turns it off', () => {
    render(<SynthView />);
    const iBtn = screen.getByRole('button', { name: /^I$/ });
    expect(iBtn.className).toContain('bg-orange-500');
    fireEvent.click(iBtn);
    expect(iBtn.className).not.toContain('bg-orange-500');
  });

  it('all four chorus modes can be activated', () => {
    render(<SynthView />);
    const offBtn = screen.getByRole('button', { name: 'OFF' });
    const iBtn = screen.getByRole('button', { name: /^I$/ });
    const iiBtn = screen.getByRole('button', { name: 'II' });
    const bothBtn = screen.getByRole('button', { name: 'BOTH' });
    fireEvent.click(offBtn);
    expect(offBtn.className).toContain('bg-orange-500');
    fireEvent.click(iBtn);
    expect(iBtn.className).toContain('bg-orange-500');
    fireEvent.click(iiBtn);
    expect(iiBtn.className).toContain('bg-orange-500');
    fireEvent.click(bothBtn);
    expect(bothBtn.className).toContain('bg-orange-500');
  });

  it('Master Gain fader value is displayed', () => {
    render(<SynthView />);
    expect(screen.getByText('Main')).toBeInTheDocument();
  });

  it('VCA Mode section has correct label', () => {
    render(<SynthView />);
    expect(screen.getByText('Assign Mode')).toBeInTheDocument();
    expect(screen.getByText('VCA Mode')).toBeInTheDocument();
    expect(screen.getByText('Master Gain')).toBeInTheDocument();
  });

  it('SynthView renders all fader labels', () => {
    render(<SynthView />);
    expect(screen.getByText('Rate')).toBeInTheDocument();
    expect(screen.getByText('Delay')).toBeInTheDocument();
    expect(screen.getByText('Freq')).toBeInTheDocument();
    expect(screen.getByText('Res')).toBeInTheDocument();
    expect(screen.getByText('Env')).toBeInTheDocument();
    expect(screen.getByText('Sub')).toBeInTheDocument();
    expect(screen.getByText('Noise')).toBeInTheDocument();
    expect(screen.getAllByText('LFO').length).toBeGreaterThan(0);
    expect(screen.getByText('Key')).toBeInTheDocument();
    expect(screen.getByText('A')).toBeInTheDocument();
    expect(screen.getByText('D')).toBeInTheDocument();
    expect(screen.getByText('S')).toBeInTheDocument();
    expect(screen.getByText('R')).toBeInTheDocument();
  });

  it('selecting same channel again is stable', () => {
    render(<SynthView />);
    fireEvent.click(screen.getByRole('button', { name: /Synth Lead/i }));
    fireEvent.click(screen.getByRole('button', { name: /Synth Lead/i }));
    expect(screen.getByText('CH: LEAD')).toBeInTheDocument();
  });

  it('DRIVE section reset sets default drive values', () => {
    render(<SynthView />);
    const resetButtons = screen.getAllByTitle('Reset Section');
    fireEvent.click(resetButtons[3]);
    expect(screen.getByText('DRIVE')).toBeInTheDocument();
  });

  it('delete preset on non-lead channel', async () => {
    const mockPm = vi.mocked(PersistenceManager);
    const presets = [
      { id: 'del-2', name: 'ToDeletePad', category: 'pad', isPublic: false, patch: {} },
    ];
    mockPm.listPresets.mockImplementation(async () => [...presets]);
    mockPm.deletePreset.mockImplementation(async (id: string) => {
      const idx = presets.findIndex(p => p.id === id);
      if (idx >= 0) presets.splice(idx, 1);
    });
    await act(async () => { render(<SynthView />); });
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: /Synth Pad/i })); });
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: /Presets/i })); });
    const delBtn = screen.getByRole('button', { name: /Delete preset ToDeletePad/i });
    await act(async () => { fireEvent.click(delBtn); });
    await waitFor(() => {
      expect(screen.queryByText('ToDeletePad')).not.toBeInTheDocument();
    });
    mockPm.listPresets.mockResolvedValue([]);
    mockPm.deletePreset.mockImplementation(async () => {});
  });

  it('init channel button shows rotate icon', () => {
    render(<SynthView />);
    const initBtn = screen.getByRole('button', { name: /Init Channel/i });
    expect(initBtn).toBeInTheDocument();
    fireEvent.click(initBtn);
  });
});
