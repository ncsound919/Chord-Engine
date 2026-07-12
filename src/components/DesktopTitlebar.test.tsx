import React from 'react';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';

const mockMinimizeWindow = vi.fn();
const mockMaximizeWindow = vi.fn();
const mockCloseWindow = vi.fn();
const mockRefreshPorts = vi.fn();
const mockConnectInput = vi.fn();
const mockConnectOutput = vi.fn();
const mockDisconnectInput = vi.fn();
const mockDisconnectOutput = vi.fn();

let mockIsTauri = true;

vi.mock('../lib/tauriBridge', () => ({
  isTauri: () => mockIsTauri,
  minimizeWindow: (...args: any[]) => mockMinimizeWindow(...args),
  maximizeWindow: (...args: any[]) => mockMaximizeWindow(...args),
  closeWindow: (...args: any[]) => mockCloseWindow(...args),
}));

vi.mock('../hooks/useMidiHardware', () => ({
  useMidiHardware: vi.fn(() => ({
    available: false,
    inputs: [],
    outputs: [],
    connection: { input_connected: false, input_port: null, output_connected: false, output_port: null },
    error: null,
    refreshPorts: mockRefreshPorts,
    connectInput: mockConnectInput,
    connectOutput: mockConnectOutput,
    disconnectInput: mockDisconnectInput,
    disconnectOutput: mockDisconnectOutput,
  })),
}));

vi.mock('@tauri-apps/api/event', () => ({
  listen: vi.fn().mockResolvedValue(() => {}),
}));

vi.mock('@tauri-apps/api/window', () => ({
  getCurrentWindow: vi.fn(() => ({
    onResized: vi.fn(),
    isMaximized: vi.fn().mockResolvedValue(false),
    minimize: vi.fn(),
    maximize: vi.fn(),
    unmaximize: vi.fn(),
    close: vi.fn(),
  })),
}));

import { DesktopTitlebar } from './DesktopTitlebar';

beforeEach(() => {
  cleanup();
  vi.clearAllMocks();
  mockIsTauri = true;
});

function renderTitlebar(props = {}) {
  return render(
    <DesktopTitlebar projectName="TestProject" onMidiNote={vi.fn()} {...props} />,
  );
}

describe('DesktopTitlebar', () => {
  it('renders browser titlebar when not in Tauri', () => {
    mockIsTauri = false;
    render(<DesktopTitlebar projectName="Test" onMidiNote={vi.fn()} />);
    expect(screen.getByText('Test')).toBeTruthy();
    expect(screen.queryByText('MIDI')).toBeNull();
  });

  it('shows fullscreen button in browser mode', () => {
    mockIsTauri = false;
    render(<DesktopTitlebar projectName="Test" onMidiNote={vi.fn()} />);
    const buttons = screen.getAllByRole('button');
    expect(buttons.length).toBe(1);
  });

  it('renders the titlebar when in Tauri', () => {
    renderTitlebar({ projectName: 'My Project' });
    expect(screen.getByText('My Project')).toBeTruthy();
  });

  it('shows project name', () => {
    renderTitlebar({ projectName: 'Chord Engine' });
    expect(screen.getByText('Chord Engine')).toBeTruthy();
  });

  it('shows MIDI button', () => {
    renderTitlebar();
    expect(screen.getByText('MIDI')).toBeTruthy();
  });

  it('shows minimize, maximize, and close buttons', () => {
    renderTitlebar();
    expect(screen.getByTitle('Maximize')).toBeTruthy();
    const buttons = screen.getAllByRole('button');
    const svgButtons = buttons.filter(b => b.querySelector('svg'));
    expect(svgButtons.length).toBeGreaterThanOrEqual(3);
  });

  it('clicking MIDI button opens the MIDI panel', () => {
    renderTitlebar();
    fireEvent.click(screen.getByText('MIDI'));
    expect(screen.getByText('MIDI Hardware')).toBeTruthy();
    expect(screen.getByText('Input')).toBeTruthy();
    expect(screen.getByText('Output')).toBeTruthy();
  });

  it('clicking close button calls closeWindow', () => {
    renderTitlebar();
    const buttons = screen.getAllByRole('button');
    const closeButton = buttons[buttons.length - 1];
    fireEvent.click(closeButton);
    expect(mockCloseWindow).toHaveBeenCalledTimes(1);
  });

  it('clicking minimize button calls minimizeWindow', () => {
    renderTitlebar();
    const buttons = screen.getAllByRole('button');
    const minimizeButton = buttons[buttons.length - 3];
    fireEvent.click(minimizeButton);
    expect(mockMinimizeWindow).toHaveBeenCalledTimes(1);
  });

  it('MIDI panel shows no inputs found when inputs is empty', () => {
    renderTitlebar();
    fireEvent.click(screen.getByText('MIDI'));
    expect(screen.getByText('No MIDI inputs found')).toBeTruthy();
    expect(screen.getByText('No MIDI outputs found')).toBeTruthy();
  });

  it('MIDI panel has refresh button that calls refreshPorts', () => {
    renderTitlebar();
    fireEvent.click(screen.getByText('MIDI'));
    fireEvent.click(screen.getByText('Refresh'));
    expect(mockRefreshPorts).toHaveBeenCalledTimes(1);
  });

  it('clicking MIDI button again closes the panel', () => {
    renderTitlebar();
    fireEvent.click(screen.getByText('MIDI'));
    expect(screen.getByText('MIDI Hardware')).toBeTruthy();
    const midiButtons = screen.getAllByText('MIDI');
    const midiButton = midiButtons.find(el => el.tagName === 'BUTTON' || el.closest('button'));
    fireEvent.click(midiButton!);
    expect(screen.queryByText('Input')).toBeNull();
  });
});
