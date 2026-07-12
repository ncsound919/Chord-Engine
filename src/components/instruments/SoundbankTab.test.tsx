import React from 'react';
import { describe, expect, it, vi, afterEach } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { SoundbankTab } from './SoundbankTab';
import { createEmptySoundbankStatus } from './types';

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

const defaultProps = {
  status: createEmptySoundbankStatus(),
  isLoading: false,
  loadingAction: null as string | null,
  justLoadedAction: null as string | null,
  onFolderImport: vi.fn(),
  onLoadDemo: vi.fn(),
  onQuickLoadKit: vi.fn(),
  onQuickLoadBass: vi.fn(),
  onClearSoundbank: vi.fn(),
};

const renderSoundbankTab = (overrides: Partial<typeof defaultProps> = {}) =>
  render(<SoundbankTab {...defaultProps} {...overrides} />);

describe('SoundbankTab', () => {
  it('renders the soundbank heading', () => {
    renderSoundbankTab();
    expect(screen.getByText('Deterministic Soundbank Controller')).toBeInTheDocument();
  });

  it('renders the folder import section', () => {
    renderSoundbankTab();
    expect(screen.getByText('Import Entire Local Folder')).toBeInTheDocument();
    expect(screen.getByText('Select Soundbank Folder')).toBeInTheDocument();
  });

  it('renders the Quick Load Demo Samples button', () => {
    renderSoundbankTab();
    expect(screen.getByText('Quick Load Demo Samples')).toBeInTheDocument();
  });

  it('calls onLoadDemo when the demo button is clicked', () => {
    const onLoadDemo = vi.fn();
    renderSoundbankTab({ onLoadDemo });
    fireEvent.click(screen.getByText('Quick Load Demo Samples'));
    expect(onLoadDemo).toHaveBeenCalledTimes(1);
  });

  it('calls onQuickLoadBass when the bass load button is clicked', () => {
    const onQuickLoadBass = vi.fn();
    renderSoundbankTab({ onQuickLoadBass });
    fireEvent.click(screen.getByRole('button', { name: /quick load bass/i }));
    expect(onQuickLoadBass).toHaveBeenCalledTimes(1);
  });

  it('calls onQuickLoadKit with kit1 when kit1 button is clicked', () => {
    const onQuickLoadKit = vi.fn();
    renderSoundbankTab({ onQuickLoadKit });
    fireEvent.click(screen.getByRole('button', { name: /quick load kit 1/i }));
    expect(onQuickLoadKit).toHaveBeenCalledWith('kit1');
  });

  it('calls onQuickLoadKit with kit2 when kit2 button is clicked', () => {
    const onQuickLoadKit = vi.fn();
    renderSoundbankTab({ onQuickLoadKit });
    fireEvent.click(screen.getByRole('button', { name: /quick load kit 2/i }));
    expect(onQuickLoadKit).toHaveBeenCalledWith('kit2');
  });

  it('calls onClearSoundbank when clear button is clicked', () => {
    const onClearSoundbank = vi.fn();
    renderSoundbankTab({ onClearSoundbank });
    fireEvent.click(screen.getByRole('button', { name: /clear all soundbank/i }));
    expect(onClearSoundbank).toHaveBeenCalledTimes(1);
  });

  it('shows MISSING status when nothing is loaded', () => {
    renderSoundbankTab();
    const missingLabels = screen.getAllByText('MISSING');
    expect(missingLabels.length).toBeGreaterThanOrEqual(1);
  });

  it('shows LOADED status when bass is loaded', () => {
    const status = createEmptySoundbankStatus();
    status.bass = { loaded: true, filename: 'bass.wav' };
    renderSoundbankTab({ status });
    expect(screen.getByText('LOADED')).toBeInTheDocument();
    expect(screen.getByText('bass.wav')).toBeInTheDocument();
  });

  it('shows ACTIVE status when kit1 has loaded samples', () => {
    const status = createEmptySoundbankStatus();
    status.kit1['Kick'] = { loaded: true, filename: 'kick.wav' };
    renderSoundbankTab({ status });
    expect(screen.getByText('ACTIVE')).toBeInTheDocument();
  });

  it('disables buttons while loading', () => {
    renderSoundbankTab({ isLoading: true, loadingAction: 'bass' });
    const bassButton = screen.getByRole('button', { name: /mapping bass/i });
    expect(bassButton).toBeDisabled();

    const demoButton = screen.getByText('Quick Load Demo Samples');
    expect(demoButton).toBeDisabled();

    const folderButton = screen.getByText('Select Soundbank Folder');
    expect(folderButton).toBeDisabled();
  });

  it('shows folder loading state', () => {
    renderSoundbankTab({ loadingAction: 'folder' });
    expect(screen.getByText('Scanning...')).toBeInTheDocument();
  });

  it('shows folder success state after loading', () => {
    renderSoundbankTab({ justLoadedAction: 'folder' });
    expect(screen.getByText('Imported!')).toBeInTheDocument();
  });

  it('shows demo loading state', () => {
    renderSoundbankTab({ loadingAction: 'demo' });
    expect(screen.getByText('Fetching...')).toBeInTheDocument();
  });

  it('shows bass loading state', () => {
    renderSoundbankTab({ loadingAction: 'bass' });
    expect(screen.getByRole('button', { name: /mapping bass/i })).toBeInTheDocument();
  });

  it('shows kit1 loading state', () => {
    renderSoundbankTab({ loadingAction: 'kit1' });
    expect(screen.getByRole('button', { name: /mapping kit 1/i })).toBeInTheDocument();
  });

  it('shows kit2 loading state', () => {
    renderSoundbankTab({ loadingAction: 'kit2' });
    expect(screen.getByRole('button', { name: /mapping kit 2/i })).toBeInTheDocument();
  });

  it('renders bass patch section with bass status', () => {
    renderSoundbankTab();
    expect(screen.getByText('Bass Patch')).toBeInTheDocument();
  });

  it('renders kit 1 and kit 2 sections', () => {
    renderSoundbankTab();
    expect(screen.getByText('Drum Kit 1 (MPC-60)')).toBeInTheDocument();
    expect(screen.getByText('Drum Kit 2 (Pearl)')).toBeInTheDocument();
  });

  it('renders the panel with correct aria attributes', () => {
    renderSoundbankTab({ isLoading: true });
    const panel = screen.getByRole('tabpanel');
    expect(panel).toHaveAttribute('aria-busy', 'true');
  });
});
