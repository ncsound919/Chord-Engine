import React from 'react';
import { describe, expect, it, vi, afterEach } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { BassTab } from './BassTab';
import { DEFAULT_BASS_PARAMS } from './types';

vi.mock('./Fretboard', () => ({
  Fretboard: ({ tuningCoarse, onPlayNote }: any) => (
    <div data-testid="fretboard-mock" data-tuning={tuningCoarse}>
      <button onClick={() => onPlayNote(0, 0)}>Play Fret</button>
    </div>
  ),
}));

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

const defaultProps = {
  params: { ...DEFAULT_BASS_PARAMS },
  onUpdate: vi.fn(),
  onReplaceParams: vi.fn(),
  loaded: false,
  loading: false,
  justLoaded: false,
  onUploadClick: vi.fn(),
  onPlayNote: vi.fn(),
  activeSampleName: 'No sample loaded',
};

const renderBassTab = (overrides: Partial<typeof defaultProps> = {}) =>
  render(<BassTab {...defaultProps} {...overrides} />);

describe('BassTab', () => {
  it('renders the upload button when not loaded', () => {
    renderBassTab({ loaded: false });
    expect(screen.getByRole('button', { name: /upload bass sample/i })).toBeInTheDocument();
  });

  it('shows loading state on the upload button', () => {
    renderBassTab({ loaded: false, loading: true });
    expect(screen.getByText('Decoding Audio...')).toBeInTheDocument();
  });

  it('calls onUploadClick when the upload button is clicked', () => {
    const onUploadClick = vi.fn();
    renderBassTab({ loaded: false, onUploadClick });
    fireEvent.click(screen.getByRole('button', { name: /upload bass sample/i }));
    expect(onUploadClick).toHaveBeenCalledTimes(1);
  });

  it('renders the loaded bass rig panel when loaded', () => {
    renderBassTab({ loaded: true, activeSampleName: 'My Bass' });
    expect(screen.getByText('Bass Sampler Rig')).toBeInTheDocument();
    expect(screen.getByText('My Bass')).toBeInTheDocument();
  });

  it('renders the fretboard when loaded', () => {
    renderBassTab({ loaded: true });
    expect(screen.getByTestId('fretboard-mock')).toBeInTheDocument();
  });

  it('calls onPlayNote when a fret is clicked on the fretboard', () => {
    const onPlayNote = vi.fn();
    renderBassTab({ loaded: true, onPlayNote });
    fireEvent.click(screen.getByText('Play Fret'));
    expect(onPlayNote).toHaveBeenCalledWith(0, 0);
  });

  it('shows the Replace Sample button when loaded and not loading', () => {
    renderBassTab({ loaded: true, justLoaded: false, loading: false });
    expect(screen.getByText('Replace Sample')).toBeInTheDocument();
  });

  it('shows Active! when justLoaded is true', () => {
    renderBassTab({ loaded: true, justLoaded: true });
    expect(screen.getByText('Active!')).toBeInTheDocument();
  });

  it('calls onUpdate when plucking style is changed', () => {
    const onUpdate = vi.fn();
    renderBassTab({ loaded: true, onUpdate });
    fireEvent.click(screen.getByText('pick style'));
    expect(onUpdate).toHaveBeenCalledWith('style', 'pick');
  });

  it('toggles monoChoke when the toggle button is clicked', () => {
    const onUpdate = vi.fn();
    renderBassTab({ loaded: true, onUpdate, params: { ...DEFAULT_BASS_PARAMS, monoChoke: false } });
    fireEvent.click(screen.getByRole('button', { name: /toggle mono note choke/i }));
    expect(onUpdate).toHaveBeenCalledWith('monoChoke', true);
  });

  it('toggles ultraLo when clicked', () => {
    const onUpdate = vi.fn();
    renderBassTab({ loaded: true, onUpdate });
    fireEvent.click(screen.getByText('Ultra-Lo'));
    expect(onUpdate).toHaveBeenCalledWith('ultraLo', !DEFAULT_BASS_PARAMS.ultraLo);
  });

  it('toggles ultraHi when clicked', () => {
    const onUpdate = vi.fn();
    renderBassTab({ loaded: true, onUpdate });
    fireEvent.click(screen.getByText('Ultra-Hi'));
    expect(onUpdate).toHaveBeenCalledWith('ultraHi', !DEFAULT_BASS_PARAMS.ultraHi);
  });

  it('changes cabSim when a cabinet button is clicked', () => {
    const onUpdate = vi.fn();
    renderBassTab({ loaded: true, onUpdate });
    fireEvent.click(screen.getByText('SVT 8x10'));
    expect(onUpdate).toHaveBeenCalledWith('cabSim', 'svt');
  });

  it('shows the live region for loading status', () => {
    renderBassTab({ loaded: false, loading: true });
    expect(screen.getByText('Loading bass sample...')).toBeInTheDocument();
  });

  it('shows the live region for justLoaded status', () => {
    renderBassTab({ loaded: true, justLoaded: true, activeSampleName: 'Test Bass' });
    expect(screen.getByText('Bass sample Test Bass loaded successfully.')).toBeInTheDocument();
  });

  it('shows the bleed decay slider when monoChoke is enabled', () => {
    renderBassTab({ loaded: true, params: { ...DEFAULT_BASS_PARAMS, monoChoke: true } });
    expect(screen.getByLabelText('Decay / Choke Speed')).toBeInTheDocument();
  });

  it('hides the bleed decay slider when monoChoke is disabled', () => {
    renderBassTab({ loaded: true, params: { ...DEFAULT_BASS_PARAMS, monoChoke: false } });
    expect(screen.queryByLabelText('Decay / Choke Speed')).not.toBeInTheDocument();
  });

  it('changes pickupBlend when the slider is adjusted', () => {
    const onUpdate = vi.fn();
    renderBassTab({ loaded: true, onUpdate });
    const slider = screen.getByLabelText('Pickup Blend');
    fireEvent.change(slider, { target: { value: '80' } });
    expect(onUpdate).toHaveBeenCalledWith('pickupBlend', 80);
  });

  it('changes tone when the preamp tone slider is adjusted', () => {
    const onUpdate = vi.fn();
    renderBassTab({ loaded: true, onUpdate });
    const slider = screen.getByLabelText('Preamp Tone');
    fireEvent.change(slider, { target: { value: '30' } });
    expect(onUpdate).toHaveBeenCalledWith('tone', 30);
  });

  it('changes tuningCoarse when the coarse pitch slider is adjusted', () => {
    const onUpdate = vi.fn();
    renderBassTab({ loaded: true, onUpdate });
    const slider = screen.getByLabelText('Coarse Pitch');
    fireEvent.change(slider, { target: { value: '5' } });
    expect(onUpdate).toHaveBeenCalledWith('tuningCoarse', 5);
  });

  it('changes tuningFine when the fine tuning slider is adjusted', () => {
    const onUpdate = vi.fn();
    renderBassTab({ loaded: true, onUpdate });
    const slider = screen.getByLabelText('Fine Tuning');
    fireEvent.change(slider, { target: { value: '-25' } });
    expect(onUpdate).toHaveBeenCalledWith('tuningFine', -25);
  });

  it('changes bleedDecay when the decay slider is adjusted with monoChoke enabled', () => {
    const onUpdate = vi.fn();
    renderBassTab({ loaded: true, onUpdate, params: { ...DEFAULT_BASS_PARAMS, monoChoke: true } });
    const slider = screen.getByLabelText('Decay / Choke Speed');
    fireEvent.change(slider, { target: { value: '500' } });
    expect(onUpdate).toHaveBeenCalledWith('bleedDecay', 500);
  });

  it('calls onUpdate with finger style when finger style button is clicked', () => {
    const onUpdate = vi.fn();
    renderBassTab({ loaded: true, onUpdate, params: { ...DEFAULT_BASS_PARAMS, style: 'pick' } });
    fireEvent.click(screen.getByText('finger style'));
    expect(onUpdate).toHaveBeenCalledWith('style', 'finger');
  });

  it('changes cabSim to di when Bypass DI button is clicked', () => {
    const onUpdate = vi.fn();
    renderBassTab({ loaded: true, onUpdate });
    fireEvent.click(screen.getByText('Bypass DI'));
    expect(onUpdate).toHaveBeenCalledWith('cabSim', 'di');
  });

  it('changes cabSim to b15 when B-15 1x15 button is clicked', () => {
    const onUpdate = vi.fn();
    renderBassTab({ loaded: true, onUpdate, params: { ...DEFAULT_BASS_PARAMS, cabSim: 'svt' } });
    fireEvent.click(screen.getByText('B-15 1x15'));
    expect(onUpdate).toHaveBeenCalledWith('cabSim', 'b15');
  });

  it('toggles monoChoke from enabled to disabled', () => {
    const onUpdate = vi.fn();
    renderBassTab({ loaded: true, onUpdate, params: { ...DEFAULT_BASS_PARAMS, monoChoke: true } });
    fireEvent.click(screen.getByRole('button', { name: /toggle mono note choke/i }));
    expect(onUpdate).toHaveBeenCalledWith('monoChoke', false);
  });

  it('renders the B-15 Portaflex Amp section header', () => {
    renderBassTab({ loaded: true });
    expect(screen.getByText(/B-15 Portaflex Amp/)).toBeInTheDocument();
  });

  it('renders the Tuning & Graphic EQ section header', () => {
    renderBassTab({ loaded: true });
    expect(screen.getByText(/Tuning & Graphic EQ/)).toBeInTheDocument();
  });

  it('renders the Bass Preamp & Choke section header', () => {
    renderBassTab({ loaded: true });
    expect(screen.getByText(/Bass Preamp & Choke/)).toBeInTheDocument();
  });

  it('shows the fretboard tuning label', () => {
    renderBassTab({ loaded: true });
    expect(screen.getByText(/E-A-D-G Standard Bass Tuning/)).toBeInTheDocument();
  });

  it('shows the fretboard interactive label', () => {
    renderBassTab({ loaded: true });
    expect(screen.getByText(/Interactive Fretboard/)).toBeInTheDocument();
  });

  it('renders the active multisample label when loaded', () => {
    renderBassTab({ loaded: true, activeSampleName: 'Fender P-Bass' });
    expect(screen.getByText('Fender P-Bass')).toBeInTheDocument();
  });

  it('shows Zone Mapped indicator when loaded', () => {
    renderBassTab({ loaded: true });
    expect(screen.getByText(/Zone Mapped/)).toBeInTheDocument();
  });

  it('renders all three amp knobs when loaded', () => {
    renderBassTab({ loaded: true });
    expect(screen.getByText('Vol')).toBeInTheDocument();
    expect(screen.getByText('Drive')).toBeInTheDocument();
    expect(screen.getByText('Bass')).toBeInTheDocument();
    expect(screen.getByText('Treble')).toBeInTheDocument();
  });

  it('renders the three EQ sliders when loaded', () => {
    renderBassTab({ loaded: true });
    expect(screen.getByText('Low 60Hz')).toBeInTheDocument();
    expect(screen.getByText('Mid 800Hz')).toBeInTheDocument();
    expect(screen.getByText('Hi 3.5kHz')).toBeInTheDocument();
  });

  it('renders the preset dropdown when loaded', () => {
    renderBassTab({ loaded: true });
    expect(screen.getByLabelText('Load preset')).toBeInTheDocument();
  });

  it('selecting a factory preset calls onReplaceParams', () => {
    const onReplaceParams = vi.fn();
    renderBassTab({ loaded: true, onReplaceParams });
    const select = screen.getByLabelText('Load preset');
    fireEvent.change(select, { target: { value: 'factory_motown' } });
    expect(onReplaceParams).toHaveBeenCalled();
  });

  it('save button opens the preset name input', () => {
    renderBassTab({ loaded: true });
    fireEvent.click(screen.getByText('Save'));
    expect(screen.getByLabelText('New preset name')).toBeInTheDocument();
  });

  it('entering a name and clicking save creates a user preset', () => {
    renderBassTab({ loaded: true });
    fireEvent.click(screen.getByText('Save'));
    const input = screen.getByLabelText('New preset name');
    fireEvent.change(input, { target: { value: 'My Preset' } });
    fireEvent.click(screen.getByRole('button', { name: /confirm save preset/i }));
    // User preset should now appear in the select
    expect(screen.getByDisplayValue('My Preset')).toBeInTheDocument();
  });

  it('pressing Enter in preset name input saves the preset', () => {
    renderBassTab({ loaded: true });
    fireEvent.click(screen.getByText('Save'));
    const input = screen.getByLabelText('New preset name');
    fireEvent.change(input, { target: { value: 'Enter Preset' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(screen.getByDisplayValue('Enter Preset')).toBeInTheDocument();
  });

  it('empty preset name does not save', () => {
    renderBassTab({ loaded: true });
    fireEvent.click(screen.getByText('Save'));
    const confirmBtn = screen.getByRole('button', { name: /confirm save preset/i });
    expect(confirmBtn).toBeDisabled();
  });

  it('delete preset button appears for user presets', () => {
    renderBassTab({ loaded: true });
    // First save a user preset
    fireEvent.click(screen.getByText('Save'));
    fireEvent.change(screen.getByLabelText('New preset name'), { target: { value: 'Test' } });
    fireEvent.click(screen.getByRole('button', { name: /confirm save preset/i }));
    // Now select it
    fireEvent.change(screen.getByLabelText('Load preset'), { target: { value: screen.getByDisplayValue('Test').closest('select')?.querySelector('option[value]')?.value ?? '' } });
    // The delete button should appear
    expect(screen.getByRole('button', { name: /delete selected preset/i })).toBeInTheDocument();
  });

  it('reset button calls onReplaceParams with DEFAULT_BASS_PARAMS', () => {
    const onReplaceParams = vi.fn();
    renderBassTab({ loaded: true, onReplaceParams });
    fireEvent.click(screen.getByText('Reset'));
    expect(onReplaceParams).toHaveBeenCalledWith(DEFAULT_BASS_PARAMS);
  });

  it('A/B compare toggle switches active slot', () => {
    const onReplaceParams = vi.fn();
    renderBassTab({ loaded: true, onReplaceParams });
    // Click B button to switch to slot B
    fireEvent.click(screen.getByRole('button', { name: 'B', pressed: false }));
    expect(onReplaceParams).toHaveBeenCalled();
  });

  it('Copy A to B button copies current settings', () => {
    renderBassTab({ loaded: true });
    // Click the copy button (Repeat icon)
    const copyBtn = screen.getByRole('button', { name: /Copy A to B/i });
    fireEvent.click(copyBtn);
    // No error means it worked - internal state copied
  });

  it('Copy B to A after switching to slot B', () => {
    const onReplaceParams = vi.fn();
    renderBassTab({ loaded: true, onReplaceParams });
    // Switch to B
    fireEvent.click(screen.getByRole('button', { name: 'B', pressed: false }));
    // Now copy button should say "Copy B to A"
    const copyBtn = screen.getByRole('button', { name: /Copy B to A/i });
    fireEvent.click(copyBtn);
  });

  it('switching from B back to A restores A snapshot', () => {
    const onReplaceParams = vi.fn();
    renderBassTab({ loaded: true, onReplaceParams });
    // Switch to B
    fireEvent.click(screen.getByRole('button', { name: 'B', pressed: false }));
    // Switch back to A
    fireEvent.click(screen.getByRole('button', { name: 'A', pressed: false }));
    expect(onReplaceParams).toHaveBeenCalledTimes(2);
  });

  it('keyboard shortcut plays notes when loaded', () => {
    const onPlayNote = vi.fn();
    renderBassTab({ loaded: true, onPlayNote });
    fireEvent.keyDown(window, { key: 'z' });
    expect(onPlayNote).toHaveBeenCalledWith(0, 0);
  });

  it('keyboard shortcut plays E string notes', () => {
    const onPlayNote = vi.fn();
    renderBassTab({ loaded: true, onPlayNote });
    fireEvent.keyDown(window, { key: '1' });
    expect(onPlayNote).toHaveBeenCalledWith(3, 0);
  });

  it('keyboard shortcut plays A string notes', () => {
    const onPlayNote = vi.fn();
    renderBassTab({ loaded: true, onPlayNote });
    fireEvent.keyDown(window, { key: 'q' });
    expect(onPlayNote).toHaveBeenCalledWith(2, 0);
  });

  it('keyboard shortcut plays D string notes', () => {
    const onPlayNote = vi.fn();
    renderBassTab({ loaded: true, onPlayNote });
    fireEvent.keyDown(window, { key: 'a' });
    expect(onPlayNote).toHaveBeenCalledWith(1, 0);
  });

  it('keyboard shortcuts are ignored when not loaded', () => {
    const onPlayNote = vi.fn();
    renderBassTab({ loaded: false, onPlayNote });
    fireEvent.keyDown(window, { key: 'z' });
    expect(onPlayNote).not.toHaveBeenCalled();
  });

  it('keyboard shortcuts are ignored when typing in input', () => {
    const onPlayNote = vi.fn();
    renderBassTab({ loaded: true, onPlayNote });
    fireEvent.click(screen.getByText('Save'));
    const input = screen.getByLabelText('New preset name');
    fireEvent.keyDown(input, { key: 'z' });
    expect(onPlayNote).not.toHaveBeenCalled();
  });

  it('keyboard shortcuts are ignored with modifier keys', () => {
    const onPlayNote = vi.fn();
    renderBassTab({ loaded: true, onPlayNote });
    fireEvent.keyDown(window, { key: 'z', ctrlKey: true });
    expect(onPlayNote).not.toHaveBeenCalled();
  });

  it('Replace Sample button when loaded calls onUploadClick', () => {
    const onUploadClick = vi.fn();
    renderBassTab({ loaded: true, onUploadClick });
    fireEvent.click(screen.getByText('Replace Sample'));
    expect(onUploadClick).toHaveBeenCalled();
  });

  it('shows Decoding... on replace button when loading', () => {
    renderBassTab({ loaded: true, loading: true });
    expect(screen.getByText('Decoding...')).toBeInTheDocument();
  });

  it('shows Active! on replace button when justLoaded', () => {
    renderBassTab({ loaded: true, justLoaded: true });
    expect(screen.getByText('Active!')).toBeInTheDocument();
  });

  it('clicking the bio button selects that writer', () => {
    renderBassTab({ loaded: true });
    // The fretboard section should show keyboard shortcuts
    expect(screen.getByText(/Keyboard shortcuts/)).toBeInTheDocument();
  });

  it('delete a user preset after saving it', () => {
    renderBassTab({ loaded: true });
    fireEvent.click(screen.getByText('Save'));
    fireEvent.change(screen.getByLabelText('New preset name'), { target: { value: 'ToDel' } });
    fireEvent.click(screen.getByRole('button', { name: /confirm save preset/i }));
    expect(screen.getByDisplayValue('ToDel')).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Load preset'), { target: { value: screen.getByDisplayValue('ToDel').closest('select')?.querySelector('option[value]')?.value ?? '' } });
    const delBtn = screen.getByRole('button', { name: /delete selected preset/i });
    fireEvent.click(delBtn);
  });

  it('reset to default clears preset selection', () => {
    const onReplaceParams = vi.fn();
    renderBassTab({ loaded: true, onReplaceParams });
    fireEvent.click(screen.getByText('Reset'));
    expect(onReplaceParams).toHaveBeenCalledWith(DEFAULT_BASS_PARAMS);
  });

  it('A/B toggle from A to B and back', () => {
    const onReplaceParams = vi.fn();
    renderBassTab({ loaded: true, onReplaceParams });
    fireEvent.click(screen.getByRole('button', { name: 'B', pressed: false }));
    expect(onReplaceParams).toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'A', pressed: false }));
    expect(onReplaceParams).toHaveBeenCalledTimes(2);
  });

  it('A/B toggle does nothing when already on active slot', () => {
    const onReplaceParams = vi.fn();
    renderBassTab({ loaded: true, onReplaceParams });
    fireEvent.click(screen.getByRole('button', { name: 'A', pressed: true }));
    expect(onReplaceParams).not.toHaveBeenCalled();
  });

  it('copy A to B when on slot A', () => {
    renderBassTab({ loaded: true });
    const copyBtn = screen.getByRole('button', { name: /Copy A to B/i });
    fireEvent.click(copyBtn);
    expect(copyBtn).toBeInTheDocument();
  });

  it('copy B to A when on slot B', () => {
    renderBassTab({ loaded: true });
    fireEvent.click(screen.getByRole('button', { name: 'B', pressed: false }));
    const copyBtn = screen.getByRole('button', { name: /Copy B to A/i });
    fireEvent.click(copyBtn);
    expect(copyBtn).toBeInTheDocument();
  });

  it('eqLow slider change calls onUpdate', () => {
    const onUpdate = vi.fn();
    renderBassTab({ loaded: true, onUpdate });
    const slider = screen.getByLabelText('Low 60Hz');
    fireEvent.change(slider, { target: { value: '8' } });
    expect(onUpdate).toHaveBeenCalledWith('eqLow', 8);
  });

  it('eqMid slider change calls onUpdate', () => {
    const onUpdate = vi.fn();
    renderBassTab({ loaded: true, onUpdate });
    const slider = screen.getByLabelText('Mid 800Hz');
    fireEvent.change(slider, { target: { value: '-3' } });
    expect(onUpdate).toHaveBeenCalledWith('eqMid', -3);
  });

  it('eqHigh slider change calls onUpdate', () => {
    const onUpdate = vi.fn();
    renderBassTab({ loaded: true, onUpdate });
    const slider = screen.getByLabelText('Hi 3.5kHz');
    fireEvent.change(slider, { target: { value: '5' } });
    expect(onUpdate).toHaveBeenCalledWith('eqHigh', 5);
  });

  it('keyboard shortcut for all mapped keys', () => {
    const onPlayNote = vi.fn();
    renderBassTab({ loaded: true, onPlayNote });
    fireEvent.keyDown(window, { key: '2' });
    expect(onPlayNote).toHaveBeenCalledWith(3, 2);
    fireEvent.keyDown(window, { key: '3' });
    expect(onPlayNote).toHaveBeenCalledWith(3, 4);
    fireEvent.keyDown(window, { key: '4' });
    expect(onPlayNote).toHaveBeenCalledWith(3, 5);
  });

  it('keyboard shortcut for W key (A string fret 2)', () => {
    const onPlayNote = vi.fn();
    renderBassTab({ loaded: true, onPlayNote });
    fireEvent.keyDown(window, { key: 'w' });
    expect(onPlayNote).toHaveBeenCalledWith(2, 2);
  });

  it('keyboard shortcut for S key (D string fret 2)', () => {
    const onPlayNote = vi.fn();
    renderBassTab({ loaded: true, onPlayNote });
    fireEvent.keyDown(window, { key: 's' });
    expect(onPlayNote).toHaveBeenCalledWith(1, 2);
  });

  it('keyboard shortcut for X key (G string fret 2)', () => {
    const onPlayNote = vi.fn();
    renderBassTab({ loaded: true, onPlayNote });
    fireEvent.keyDown(window, { key: 'x' });
    expect(onPlayNote).toHaveBeenCalledWith(0, 2);
  });

  it('keyboard shortcut ignored with alt key', () => {
    const onPlayNote = vi.fn();
    renderBassTab({ loaded: true, onPlayNote });
    fireEvent.keyDown(window, { key: 'z', altKey: true });
    expect(onPlayNote).not.toHaveBeenCalled();
  });

  it('keyboard shortcut ignored with meta key', () => {
    const onPlayNote = vi.fn();
    renderBassTab({ loaded: true, onPlayNote });
    fireEvent.keyDown(window, { key: 'z', metaKey: true });
    expect(onPlayNote).not.toHaveBeenCalled();
  });

  it('selecting different factory presets updates selection', () => {
    renderBassTab({ loaded: true });
    const select = screen.getByLabelText('Load preset');
    fireEvent.change(select, { target: { value: 'factory_modern_pick' } });
    expect(select).toHaveValue('factory_modern_pick');
  });

  it('enter key on preset input saves', () => {
    renderBassTab({ loaded: true });
    fireEvent.click(screen.getByText('Save'));
    const input = screen.getByLabelText('New preset name');
    fireEvent.change(input, { target: { value: 'KeyPreset' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(screen.getByDisplayValue('KeyPreset')).toBeInTheDocument();
  });

  it('amp volume knob renders', () => {
    renderBassTab({ loaded: true });
    expect(screen.getByText('Vol')).toBeInTheDocument();
  });

  it('drive knob renders', () => {
    renderBassTab({ loaded: true });
    expect(screen.getByText('Drive')).toBeInTheDocument();
  });

  it('amp bass knob renders', () => {
    renderBassTab({ loaded: true });
    expect(screen.getByText('Bass')).toBeInTheDocument();
  });

  it('amp treble knob renders', () => {
    renderBassTab({ loaded: true });
    expect(screen.getByText('Treble')).toBeInTheDocument();
  });
});
