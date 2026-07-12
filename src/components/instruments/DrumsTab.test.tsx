import React from 'react';
import { describe, expect, it, vi, afterEach } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { DrumsTab } from './DrumsTab';

vi.mock('./UIPrimitives', () => ({
  DrumPad: ({ drum, label, loaded, onClick, loading, justLoaded }: any) => (
    <button
      data-testid={`drum-pad-${drum}`}
      data-loaded={String(loaded)}
      data-loading={String(loading)}
      data-just-loaded={String(justLoaded)}
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
  it('renders the drums heading', () => {
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

  it('calls onUploadClick with the drum name when a pad is clicked', () => {
    const onUploadClick = vi.fn();
    renderDrumsTab({ onUploadClick });
    fireEvent.click(screen.getByTestId('drum-pad-Kick'));
    expect(onUploadClick).toHaveBeenCalledWith('Kick');
  });

  it('shows the loading state for the currently loading drum', () => {
    renderDrumsTab({ loadingDrum: 'Snare' });
    expect(screen.getByTestId('drum-pad-Snare')).toHaveAttribute('data-loading', 'true');
    expect(screen.getByTestId('drum-pad-Kick')).toHaveAttribute('data-loading', 'false');
  });

  it('shows the justLoaded state for the just loaded drum', () => {
    renderDrumsTab({ justLoadedDrum: 'Crash' });
    expect(screen.getByTestId('drum-pad-Crash')).toHaveAttribute('data-just-loaded', 'true');
    expect(screen.getByTestId('drum-pad-Snare')).toHaveAttribute('data-just-loaded', 'false');
  });

  it('marks loaded drums via the loaded prop', () => {
    renderDrumsTab({
      loadedDrums: { Kick: true, Snare: true, Crash: false },
    });
    expect(screen.getByTestId('drum-pad-Kick')).toHaveAttribute('data-loaded', 'true');
    expect(screen.getByTestId('drum-pad-Snare')).toHaveAttribute('data-loaded', 'true');
    expect(screen.getByTestId('drum-pad-Crash')).toHaveAttribute('data-loaded', 'false');
  });

  it('displays the drum kit assigned names', () => {
    renderDrumsTab({
      drumKit: { Kick: '808_Kick.mp3', Snare: '808_Snare.mp3' },
    });
    expect(screen.getByTestId('drum-pad-Kick')).toHaveTextContent('Kick 22"');
  });

  it('shows loading live region announcement', () => {
    renderDrumsTab({ loadingDrum: 'Kick' });
    expect(screen.getByText('Loading sample for Kick...')).toBeInTheDocument();
  });

  it('shows justLoaded live region announcement', () => {
    renderDrumsTab({ justLoadedDrum: 'Snare' });
    expect(screen.getByText('Sample for Snare loaded successfully.')).toBeInTheDocument();
  });
});
