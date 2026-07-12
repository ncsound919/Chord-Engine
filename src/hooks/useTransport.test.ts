import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useTransport } from './useTransport';

const { mockTransport } = vi.hoisted(() => {
  let _tempo = 85;
  return {
    mockTransport: {
      isPlaying: false,
      get tempo() { return _tempo; },
      set tempo(v: number) { _tempo = v; },
      getCurrentBeat: vi.fn(() => 0),
      subscribe: vi.fn(() => () => {}),
      start: vi.fn(),
      stop: vi.fn(),
      reset: vi.fn(),
      _resetTempo(v: number) { _tempo = v; },
    },
  };
});

vi.mock('../lib/audio/engine', () => ({
  transport: mockTransport,
  audioEngine: {},
}));

describe('useTransport', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockTransport.isPlaying = false;
    mockTransport._resetTempo(85);
    mockTransport.getCurrentBeat.mockReturnValue(0);
  });

  it('returns initial transport state', () => {
    const { result } = renderHook(() => useTransport());

    expect(result.current.isPlaying).toBe(false);
    expect(result.current.tempo).toBe(85);
    expect(result.current.currentBeat).toBe(0);
    expect(typeof result.current.play).toBe('function');
    expect(typeof result.current.stop).toBe('function');
    expect(typeof result.current.togglePlay).toBe('function');
    expect(typeof result.current.reset).toBe('function');
    expect(typeof result.current.setTempo).toBe('function');
  });

  it('calls transport.start() on play()', async () => {
    mockTransport.start.mockResolvedValue(undefined);

    const { result } = renderHook(() => useTransport());

    await act(async () => {
      await result.current.play();
    });

    expect(mockTransport.start).toHaveBeenCalledTimes(1);
  });

  it('calls transport.stop() on stop()', () => {
    const { result } = renderHook(() => useTransport());

    act(() => {
      result.current.stop();
    });

    expect(mockTransport.stop).toHaveBeenCalledTimes(1);
  });

  it('calls transport.reset() on reset()', () => {
    const { result } = renderHook(() => useTransport());

    act(() => {
      result.current.reset();
    });

    expect(mockTransport.reset).toHaveBeenCalledTimes(1);
  });

  it('togglePlay calls start when not playing', async () => {
    mockTransport.isPlaying = false;
    mockTransport.start.mockResolvedValue(undefined);

    const { result } = renderHook(() => useTransport());

    await act(async () => {
      result.current.togglePlay();
    });

    expect(mockTransport.start).toHaveBeenCalledTimes(1);
    expect(mockTransport.stop).not.toHaveBeenCalled();
  });

  it('togglePlay calls stop when already playing', () => {
    mockTransport.isPlaying = true;

    const { result } = renderHook(() => useTransport());

    act(() => {
      result.current.togglePlay();
    });

    expect(mockTransport.stop).toHaveBeenCalledTimes(1);
    expect(mockTransport.start).not.toHaveBeenCalled();
  });

  it('setTempo clamps value to max 300', () => {
    const { result } = renderHook(() => useTransport());

    act(() => {
      result.current.setTempo(500);
    });

    expect(result.current.tempo).toBe(300);
  });

  it('setTempo clamps value to min 20', () => {
    const { result } = renderHook(() => useTransport());

    act(() => {
      result.current.setTempo(5);
    });

    expect(result.current.tempo).toBe(20);
  });

  it('setTempo rounds fractional values', () => {
    const { result } = renderHook(() => useTransport());

    act(() => {
      result.current.setTempo(123.7);
    });

    expect(result.current.tempo).toBe(124);
  });

  it('setTempo clamps 0 to min 20', () => {
    const { result } = renderHook(() => useTransport());

    act(() => {
      result.current.setTempo(0);
    });

    expect(result.current.tempo).toBe(20);
  });

  it('setTempo defaults to 120 for NaN', () => {
    const { result } = renderHook(() => useTransport());

    act(() => {
      result.current.setTempo(NaN);
    });

    expect(result.current.tempo).toBe(120);
  });

  it('accepts custom initial tempo', () => {
    mockTransport._resetTempo(140);
    const { result } = renderHook(() => useTransport(140));

    expect(result.current.tempo).toBe(140);
  });

  it('subscribes to transport state changes on mount', () => {
    renderHook(() => useTransport());

    expect(mockTransport.subscribe).toHaveBeenCalledTimes(1);
    expect(mockTransport.subscribe).toHaveBeenCalledWith(expect.any(Function));
  });

  it('playError is returned in hook return', () => {
    const { result } = renderHook(() => useTransport());
    expect(result.current.playError).toBeNull();
  });

  it('play() sets playError when transport.start() rejects', async () => {
    mockTransport.start.mockRejectedValue(new Error('AudioContext suspended'));

    const { result } = renderHook(() => useTransport());

    await act(async () => {
      await result.current.play();
    });

    expect(result.current.playError).toBe('Playback failed to start.');
  });

  it('play() clears playError on success', async () => {
    mockTransport.start.mockRejectedValueOnce(new Error('fail'));
    const { result } = renderHook(() => useTransport());

    await act(async () => {
      await result.current.play();
    });
    expect(result.current.playError).toBe('Playback failed to start.');

    mockTransport.start.mockResolvedValue(undefined);
    await act(async () => {
      await result.current.play();
    });
    expect(result.current.playError).toBeNull();
  });

  it('RAF loop runs when transport is playing at mount', async () => {
    mockTransport.isPlaying = true;
    mockTransport.getCurrentBeat.mockReturnValue(3);
    const rafSpy = vi.spyOn(globalThis, 'requestAnimationFrame');

    const { result } = renderHook(() => useTransport());

    expect(result.current.currentBeat).toBe(3);
    expect(rafSpy).toHaveBeenCalled();

    rafSpy.mockRestore();
  });

  it('subscribe callback starts RAF loop when play state changes to true', async () => {
    let subscribeCb: ((state: { isPlaying: boolean; tempo: number }) => void) | undefined;
    mockTransport.subscribe.mockImplementation((cb: any) => {
      subscribeCb = cb;
      return () => {};
    });

    const { result } = renderHook(() => useTransport());
    expect(subscribeCb).toBeDefined();

    const rafSpy = vi.spyOn(globalThis, 'requestAnimationFrame');
    mockTransport.getCurrentBeat.mockReturnValue(5);

    await act(async () => {
      subscribeCb!({ isPlaying: true, tempo: 120 });
    });

    expect(result.current.isPlaying).toBe(true);
    expect(result.current.tempo).toBe(120);
    expect(rafSpy).toHaveBeenCalled();

    rafSpy.mockRestore();
  });

  it('subscribe callback stops RAF loop when play state changes to false', async () => {
    let subscribeCb: ((state: { isPlaying: boolean; tempo: number }) => void) | undefined;
    mockTransport.subscribe.mockImplementation((cb: any) => {
      subscribeCb = cb;
      return () => {};
    });

    mockTransport.isPlaying = true;
    renderHook(() => useTransport());

    const cancelSpy = vi.spyOn(globalThis, 'cancelAnimationFrame');

    await act(async () => {
      subscribeCb!({ isPlaying: false, tempo: 120 });
    });

    expect(cancelSpy).toHaveBeenCalled();
    cancelSpy.mockRestore();
  });

  it('unsubscribe cancels RAF loop on unmount', () => {
    const unsubscribeMock = vi.fn();
    mockTransport.subscribe.mockReturnValue(unsubscribeMock);

    mockTransport.isPlaying = true;
    const cancelSpy = vi.spyOn(globalThis, 'cancelAnimationFrame');

    const { unmount } = renderHook(() => useTransport());
    unmount();

    expect(unsubscribeMock).toHaveBeenCalled();
    expect(cancelSpy).toHaveBeenCalled();
    cancelSpy.mockRestore();
  });
});
