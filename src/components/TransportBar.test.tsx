import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from '@testing-library/react';
import { TransportBar } from './TransportBar';

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  vi.useRealTimers();
});

describe('TransportBar', () => {
  const mockTransport = {
    tempo: 85,
    setTempo: vi.fn(),
    isPlaying: false,
    currentBeat: 0,
    play: vi.fn(),
    stop: vi.fn(),
    togglePlay: vi.fn(),
  };

  const mockRecording = {
    isRecording: false,
    toggleRecording: vi.fn(),
  };

  const mockVoiceToMidi = {
    isVoiceToMidi: false,
    toggleVoiceToMidi: vi.fn(),
  };

  const renderBar = (overrides: Partial<React.ComponentProps<typeof TransportBar>> = {}) =>
    render(
      <TransportBar
        useTransportOverride={() => mockTransport as never}
        useRecordingOverride={() => mockRecording as never}
        useVoiceToMidiOverride={() => mockVoiceToMidi as never}
        {...overrides}
      />,
    );

  it('renders the initial tempo, position, and visible stopped state', () => {
    renderBar();

    expect(
      screen.getByLabelText(/tempo in beats per minute/i),
    ).toHaveValue('85');

    expect(screen.getByText('1 : 1')).toBeInTheDocument();

    // The visible "Stopped" is aria-hidden; the sr-only lives in aria-live
    const statusArea = screen
      .getByText('Audio Engine')
      .closest('div')?.parentElement;

    expect(statusArea).not.toBeNull();

    expect(
      within(statusArea as HTMLElement).getByText('Stopped', {
        selector: 'span',
      }),
    ).toBeInTheDocument();
  });

  it('calls togglePlay when the play button is clicked', () => {
    const togglePlay = vi.fn();

    renderBar({
      useTransportOverride: () => ({ ...mockTransport, togglePlay }) as never,
    });

    fireEvent.click(screen.getByRole('button', { name: /play playback/i }));

    expect(togglePlay).toHaveBeenCalledTimes(1);
  });

  it('updates local tempo input and calls setTempo after debounce', () => {
    vi.useFakeTimers();
    const setTempo = vi.fn();

    renderBar({
      useTransportOverride: () => ({ ...mockTransport, setTempo }) as never,
    });

    const input = screen.getByLabelText(/tempo in beats per minute/i);

    fireEvent.change(input, {
      target: { value: '132' },
    });

    expect(input).toHaveValue('132');
    expect(setTempo).not.toHaveBeenCalled();

    act(() => {
      vi.advanceTimersByTime(300);
    });

    expect(setTempo).toHaveBeenCalledWith(132);
  });

  it('shows active recording controls while recording', () => {
    renderBar({
      useRecordingOverride: () => ({ ...mockRecording, isRecording: true }) as never,
    });

    expect(
      screen.getByRole('button', { name: /stop recording/i }),
    ).toBeInTheDocument();
  });

  it('calls stop when stop button is clicked while playing', () => {
    const stop = vi.fn();
    renderBar({
      useTransportOverride: () => ({ ...mockTransport, isPlaying: true, stop }) as never,
    });

    fireEvent.click(screen.getByRole('button', { name: /stop playback/i }));
    expect(stop).toHaveBeenCalledTimes(1);
  });

  it('stop button is disabled when not playing', () => {
    renderBar();
    expect(screen.getByRole('button', { name: /stop playback/i })).toBeDisabled();
  });

  it('displays playing state with pause label and Live indicator', () => {
    renderBar({
      useTransportOverride: () => ({ ...mockTransport, isPlaying: true }) as never,
    });

    expect(screen.getByRole('button', { name: /pause playback/i })).toBeInTheDocument();
    expect(screen.getByText('Live')).toBeInTheDocument();
    expect(screen.queryByText('Stopped', { selector: 'span' })).not.toBeInTheDocument();
  });

  it('calls toggleRecording when record button is clicked', () => {
    const toggleRecording = vi.fn();
    renderBar({
      useRecordingOverride: () => ({ ...mockRecording, toggleRecording }) as never,
    });

    fireEvent.click(screen.getByRole('button', { name: /start recording/i }));
    expect(toggleRecording).toHaveBeenCalledTimes(1);
  });

  it('calls toggleVoiceToMidi when voice-to-midi button is clicked', () => {
    const toggleVoiceToMidi = vi.fn();
    renderBar({
      useVoiceToMidiOverride: () => ({ ...mockVoiceToMidi, toggleVoiceToMidi }) as never,
    });

    fireEvent.click(screen.getByRole('button', { name: /enable voice/i }));
    expect(toggleVoiceToMidi).toHaveBeenCalledTimes(1);
  });

  it('shows active voice-to-midi controls when enabled', () => {
    renderBar({
      useVoiceToMidiOverride: () => ({ ...mockVoiceToMidi, isVoiceToMidi: true }) as never,
    });

    expect(
      screen.getByRole('button', { name: /disable voice/i }),
    ).toBeInTheDocument();
  });

  it('shows ping animation when recording and playing', () => {
    const { container } = renderBar({
      useTransportOverride: () => ({ ...mockTransport, isPlaying: true }) as never,
      useRecordingOverride: () => ({ ...mockRecording, isRecording: true }) as never,
    });

    const pingElements = container.querySelectorAll('.animate-ping');
    expect(pingElements.length).toBeGreaterThanOrEqual(1);
  });

  it('shows ping animation when voice-to-midi and playing', () => {
    const { container } = renderBar({
      useTransportOverride: () => ({ ...mockTransport, isPlaying: true }) as never,
      useVoiceToMidiOverride: () => ({ ...mockVoiceToMidi, isVoiceToMidi: true }) as never,
    });

    const pingElements = container.querySelectorAll('.animate-ping');
    expect(pingElements.length).toBeGreaterThanOrEqual(1);
  });

  it('commits tempo on blur with valid number', () => {
    vi.useFakeTimers();
    const setTempo = vi.fn();

    renderBar({
      useTransportOverride: () => ({ ...mockTransport, setTempo }) as never,
    });

    const input = screen.getByLabelText(/tempo in beats per minute/i);
    fireEvent.change(input, { target: { value: '120' } });
    fireEvent.blur(input);

    expect(setTempo).toHaveBeenCalledWith(120);
  });

  it('resets tempo input to current tempo on blur with invalid input', () => {
    const setTempo = vi.fn();

    renderBar({
      useTransportOverride: () => ({ ...mockTransport, tempo: 85, setTempo }) as never,
    });

    const input = screen.getByLabelText(/tempo in beats per minute/i);
    fireEvent.change(input, { target: { value: 'abc' } });
    fireEvent.blur(input);

    expect(input).toHaveValue('85');
    expect(setTempo).not.toHaveBeenCalled();
  });

  it('commits tempo on Enter key press', () => {
    vi.useFakeTimers();
    const setTempo = vi.fn();

    renderBar({
      useTransportOverride: () => ({ ...mockTransport, setTempo }) as never,
    });

    const input = screen.getByLabelText(/tempo in beats per minute/i);
    fireEvent.change(input, { target: { value: '140' } });
    fireEvent.keyDown(input, { key: 'Enter' });

    expect(setTempo).toHaveBeenCalledWith(140);
  });

  it('clamps tempo to minimum 20 on blur', () => {
    const setTempo = vi.fn();

    renderBar({
      useTransportOverride: () => ({ ...mockTransport, setTempo }) as never,
    });

    const input = screen.getByLabelText(/tempo in beats per minute/i);
    fireEvent.change(input, { target: { value: '5' } });
    fireEvent.blur(input);

    expect(setTempo).toHaveBeenCalledWith(20);
  });

  it('clamps tempo to maximum 300 on blur', () => {
    const setTempo = vi.fn();

    renderBar({
      useTransportOverride: () => ({ ...mockTransport, setTempo }) as never,
    });

    const input = screen.getByLabelText(/tempo in beats per minute/i);
    fireEvent.change(input, { target: { value: '500' } });
    fireEvent.blur(input);

    expect(setTempo).toHaveBeenCalledWith(300);
  });

  it('displays correct position for beat 4 in 4/4 time', () => {
    renderBar({
      useTransportOverride: () => ({ ...mockTransport, currentBeat: 4 }) as never,
    });

    expect(screen.getByText('2 : 1')).toBeInTheDocument();
  });

  it('displays correct position for beat 5 in 4/4 time', () => {
    renderBar({
      useTransportOverride: () => ({ ...mockTransport, currentBeat: 5 }) as never,
    });

    expect(screen.getByText('2 : 2')).toBeInTheDocument();
  });

  it('updates position when currentBeat changes', () => {
    const { rerender } = render(
      <TransportBar
        useTransportOverride={() => ({ ...mockTransport, currentBeat: 0 }) as never}
        useRecordingOverride={() => mockRecording as never}
        useVoiceToMidiOverride={() => mockVoiceToMidi as never}
      />,
    );

    expect(screen.getByText('1 : 1')).toBeInTheDocument();

    rerender(
      <TransportBar
        useTransportOverride={() => ({ ...mockTransport, currentBeat: 8 }) as never}
        useRecordingOverride={() => mockRecording as never}
        useVoiceToMidiOverride={() => mockVoiceToMidi as never}
      />,
    );

    expect(screen.getByText('3 : 1')).toBeInTheDocument();
  });

  it('status message includes Recording when recording', () => {
    renderBar({
      useRecordingOverride: () => ({ ...mockRecording, isRecording: true }) as never,
    });

    expect(screen.getByText(/Stopped • Recording/)).toBeInTheDocument();
  });

  it('status message includes Voice‑to‑MIDI active when enabled', () => {
    renderBar({
      useVoiceToMidiOverride: () => ({ ...mockVoiceToMidi, isVoiceToMidi: true }) as never,
    });

    expect(screen.getByText(/Stopped • Voice‑to‑MIDI active/)).toBeInTheDocument();
  });

  it('status message shows Playing when isPlaying', () => {
    renderBar({
      useTransportOverride: () => ({ ...mockTransport, isPlaying: true }) as never,
    });

    expect(screen.getByText(/Playing/)).toBeInTheDocument();
  });

  it('does not debounce commit when input is empty', () => {
    vi.useFakeTimers();
    const setTempo = vi.fn();

    renderBar({
      useTransportOverride: () => ({ ...mockTransport, setTempo }) as never,
    });

    const input = screen.getByLabelText(/tempo in beats per minute/i);
    fireEvent.change(input, { target: { value: '' } });

    act(() => {
      vi.advanceTimersByTime(500);
    });

    expect(setTempo).not.toHaveBeenCalled();
  });

  it('syncs local input when tempo changes externally', () => {
    const { rerender } = render(
      <TransportBar
        useTransportOverride={() => ({ ...mockTransport, tempo: 85 }) as never}
        useRecordingOverride={() => mockRecording as never}
        useVoiceToMidiOverride={() => mockVoiceToMidi as never}
      />,
    );

    const input = screen.getByLabelText(/tempo in beats per minute/i);
    expect(input).toHaveValue('85');

    rerender(
      <TransportBar
        useTransportOverride={() => ({ ...mockTransport, tempo: 120 }) as never}
        useRecordingOverride={() => mockRecording as never}
        useVoiceToMidiOverride={() => mockVoiceToMidi as never}
      />,
    );

    expect(input).toHaveValue('120');
  });
});
