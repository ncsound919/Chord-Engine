import React from 'react';
import { describe, expect, it, vi, afterEach, beforeEach } from 'vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { WaveformTimeline } from './WaveformTimeline';

const mockDestroy = vi.fn();
const mockCreatePlaylist = vi.fn(() => ({
  destroy: mockDestroy,
}));

vi.mock('@waveform-playlist/browser', () => ({
  createPlaylist: mockCreatePlaylist,
}));

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe('WaveformTimeline', () => {
  beforeEach(() => {
    mockCreatePlaylist.mockReturnValue({ destroy: mockDestroy });
  });

  it('renders waveform container', () => {
    const { container } = render(<WaveformTimeline trackNames={['Track 1']} />);
    expect(screen.getByText('Multi-Track Waveform')).toBeInTheDocument();
    const innerDiv = container.querySelector('[class*="min-h-\\[200px\\]"]');
    expect(innerDiv).toBeInTheDocument();
  });

  it('initializes playlist on mount', async () => {
    render(<WaveformTimeline trackNames={['Track 1']} />);
    await waitFor(() => {
      expect(mockCreatePlaylist).toHaveBeenCalled();
    });
  });

  it('passes correct container to playlist init', async () => {
    render(<WaveformTimeline trackNames={['Track 1']} />);
    await waitFor(() => {
      const callArg = mockCreatePlaylist.mock.calls[0][0];
      expect(callArg).toHaveProperty('container');
      expect(callArg).toHaveProperty('samplesPerPixel', 4096);
      expect(callArg).toHaveProperty('mono', true);
    });
  });

  it('shows "Engine ready" when loaded', async () => {
    render(<WaveformTimeline trackNames={['Track 1']} />);
    await waitFor(() => {
      expect(screen.getByText('Engine ready')).toBeInTheDocument();
    });
  });

  it('calls onReady callback after init', async () => {
    const onReady = vi.fn();
    render(<WaveformTimeline trackNames={['Track 1']} onReady={onReady} />);
    await waitFor(() => {
      expect(onReady).toHaveBeenCalledTimes(1);
    });
  });

  it('shows error state when import fails', async () => {
    mockCreatePlaylist.mockImplementationOnce(() => {
      throw new Error('Playlist failed');
    });
    render(<WaveformTimeline trackNames={['Track 1']} />);
    await waitFor(() => {
      expect(screen.getByText(/Waveform timeline unavailable/)).toBeInTheDocument();
      expect(screen.getByText(/Playlist failed/)).toBeInTheDocument();
    });
  });

  it('shows error state with fallback message when no error.message', async () => {
    mockCreatePlaylist.mockImplementationOnce(() => {
      throw { message: undefined };
    });
    render(<WaveformTimeline trackNames={['Track 1']} />);
    await waitFor(() => {
      expect(screen.getByText(/Failed to load waveform timeline/)).toBeInTheDocument();
    });
  });

  it('does not show "Engine ready" before init', () => {
    render(<WaveformTimeline trackNames={['Track 1']} />);
    expect(screen.queryByText('Engine ready')).not.toBeInTheDocument();
  });

  it('renders header with Activity icon text', () => {
    render(<WaveformTimeline trackNames={['Track 1']} />);
    expect(screen.getByText('Multi-Track Waveform')).toBeInTheDocument();
  });

  it('destroys playlist on unmount', async () => {
    const { unmount } = render(<WaveformTimeline trackNames={['Track 1']} />);
    await waitFor(() => {
      expect(mockCreatePlaylist).toHaveBeenCalled();
    });
    unmount();
    await waitFor(() => {
      expect(mockDestroy).toHaveBeenCalled();
    });
  });

  it('handles destroy gracefully when playlist has no destroy method', async () => {
    mockCreatePlaylist.mockReturnValueOnce({});
    const { unmount } = render(<WaveformTimeline trackNames={['Track 1']} />);
    await waitFor(() => {
      expect(mockCreatePlaylist).toHaveBeenCalled();
    });
    expect(() => unmount()).not.toThrow();
  });

  it('passes track names prop', () => {
    render(<WaveformTimeline trackNames={['Bass', 'Drums', 'Keys']} />);
    expect(screen.getByText('Multi-Track Waveform')).toBeInTheDocument();
  });

  it('renders empty container without error', () => {
    const { container } = render(<WaveformTimeline trackNames={[]} />);
    expect(container.querySelector('[class*="rounded-2xl"]')).toBeInTheDocument();
  });
});
