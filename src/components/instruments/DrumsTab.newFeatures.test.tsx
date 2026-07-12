import React from 'react';
import { describe, expect, it, vi, afterEach } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { DrumsTab } from './DrumsTab';

vi.mock('./UIPrimitives', () => ({
  DrumPad: ({ drum, label, loaded, onClick, loading, justLoaded, assignedName }: any) => (
    <button
      data-testid={`drum-pad-${drum}`}
      data-loaded={String(loaded)}
      data-loading={String(loading)}
      data-just-loaded={String(justLoaded)}
      data-assigned={assignedName || ''}
      onClick={onClick}
    >
      {label}
    </button>
  ),
}));

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

const defaultProps = {
  loadedDrums: {} as Record<string, boolean>,
  loadingDrum: null as string | null,
  justLoadedDrum: null as string | null,
  onUploadClick: vi.fn(),
  drumKit: {} as Record<string, string>,
};

const renderDrumsTab = (overrides: Partial<typeof defaultProps> = {}) =>
  render(<DrumsTab {...defaultProps} {...overrides} />);

describe('DrumsTab', () => {
  it('renders the heading', () => {
    renderDrumsTab();
    expect(screen.getByText('Acoustic Kit Loader')).toBeInTheDocument();
  });

  it('renders all 9 drum pads', () => {
    renderDrumsTab();
    expect(screen.getByTestId('drum-pad-Crash')).toBeInTheDocument();
    expect(screen.getByTestId('drum-pad-Ride')).toBeInTheDocument();
    expect(screen.getByTestId('drum-pad-Hi-Hat Open')).toBeInTheDocument();
    expect(screen.getByTestId('drum-pad-Hi-Hat Closed')).toBeInTheDocument();
    expect(screen.getByTestId('drum-pad-Tom 1')).toBeInTheDocument();
    expect(screen.getByTestId('drum-pad-Tom 2')).toBeInTheDocument();
    expect(screen.getByTestId('drum-pad-Tom 3')).toBeInTheDocument();
    expect(screen.getByTestId('drum-pad-Snare')).toBeInTheDocument();
    expect(screen.getByTestId('drum-pad-Kick')).toBeInTheDocument();
  });

  it('calls onUploadClick with drum id when pad is clicked', () => {
    const onUploadClick = vi.fn();
    renderDrumsTab({ onUploadClick });
    fireEvent.click(screen.getByTestId('drum-pad-Kick'));
    expect(onUploadClick).toHaveBeenCalledWith('Kick');
  });

  it('passes loading state to drum pads', () => {
    renderDrumsTab({ loadingDrum: 'Kick' });
    expect(screen.getByTestId('drum-pad-Kick')).toHaveAttribute('data-loading', 'true');
    expect(screen.getByTestId('drum-pad-Snare')).toHaveAttribute('data-loading', 'false');
  });

  it('passes justLoaded state to drum pads', () => {
    renderDrumsTab({ justLoadedDrum: 'Snare' });
    expect(screen.getByTestId('drum-pad-Snare')).toHaveAttribute('data-just-loaded', 'true');
    expect(screen.getByTestId('drum-pad-Kick')).toHaveAttribute('data-just-loaded', 'false');
  });

  it('passes loadedDrums state to drum pads', () => {
    renderDrumsTab({ loadedDrums: { Kick: true, Snare: false } });
    expect(screen.getByTestId('drum-pad-Kick')).toHaveAttribute('data-loaded', 'true');
    expect(screen.getByTestId('drum-pad-Snare')).toHaveAttribute('data-loaded', 'false');
  });

  it('shows loading screen reader text when loadingDrum is set', () => {
    renderDrumsTab({ loadingDrum: 'Kick' });
    expect(screen.getByText('Loading sample for Kick...')).toBeInTheDocument();
  });

  it('shows loaded screen reader text when justLoadedDrum is set', () => {
    renderDrumsTab({ justLoadedDrum: 'Snare' });
    expect(screen.getByText('Sample for Snare loaded successfully.')).toBeInTheDocument();
  });

  it('passes drumKit assigned names to pads', () => {
    renderDrumsTab({ drumKit: { Kick: 'MyKick.wav' } });
    expect(screen.getByTestId('drum-pad-Kick')).toHaveAttribute('data-assigned', 'MyKick.wav');
  });
});
