import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act, cleanup } from '@testing-library/react';
import { useVoiceToMidi } from './useVoiceToMidi';

const mockStop = vi.fn();
const mockStart = vi.fn();
const mockTrackStop = vi.fn();
const mockGetTracks = vi.fn(() => [{ stop: mockTrackStop }]);
const mockStream = { getTracks: mockGetTracks };
const mockGetUserMedia = vi.fn().mockResolvedValue(mockStream);

vi.stubGlobal('navigator', {
  mediaDevices: {
    getUserMedia: mockGetUserMedia,
  },
});

let mockMediaRecorderState = 'recording';
vi.stubGlobal(
  'MediaRecorder',
  vi.fn(function (this: any) {
    this.start = mockStart;
    this.stop = mockStop;
    Object.defineProperty(this, 'state', {
      get() {
        return mockMediaRecorderState;
      },
    });
    this.stream = mockStream;
    this.addEventListener = vi.fn();
    this.removeEventListener = vi.fn();
  }),
);

beforeEach(() => {
  vi.clearAllMocks();
  mockMediaRecorderState = 'recording';
  mockGetUserMedia.mockResolvedValue(mockStream);
});

afterEach(() => {
  cleanup();
});

describe('useVoiceToMidi', () => {
  it('returns isVoiceToMidi as false initially', () => {
    const { result } = renderHook(() => useVoiceToMidi());
    expect(result.current.isVoiceToMidi).toBe(false);
  });

  it('toggleVoiceToMidi starts recording when called', async () => {
    const { result } = renderHook(() => useVoiceToMidi());

    await act(async () => {
      await result.current.toggleVoiceToMidi();
    });

    expect(result.current.isVoiceToMidi).toBe(true);
    expect(mockGetUserMedia).toHaveBeenCalledWith({ audio: true });
    expect(mockStart).toHaveBeenCalled();
  });

  it('toggleVoiceToMidi stops recording when called again', async () => {
    const { result } = renderHook(() => useVoiceToMidi());

    await act(async () => {
      await result.current.toggleVoiceToMidi();
    });
    expect(result.current.isVoiceToMidi).toBe(true);

    mockMediaRecorderState = 'recording';

    await act(async () => {
      await result.current.toggleVoiceToMidi();
    });

    expect(result.current.isVoiceToMidi).toBe(false);
    expect(mockStop).toHaveBeenCalled();
    expect(mockTrackStop).toHaveBeenCalled();
  });

  it('toggleVoiceToMidi handles getUserMedia rejection gracefully', async () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    mockGetUserMedia.mockRejectedValue(new Error('Permission denied'));

    const { result } = renderHook(() => useVoiceToMidi());

    await act(async () => {
      await result.current.toggleVoiceToMidi();
    });

    expect(result.current.isVoiceToMidi).toBe(false);
    expect(consoleSpy).toHaveBeenCalledWith(
      'Microphone access denied or error:',
      expect.any(Error),
    );

    consoleSpy.mockRestore();
  });

  it('MediaRecorder is created and started when toggling on', async () => {
    const { result } = renderHook(() => useVoiceToMidi());

    await act(async () => {
      await result.current.toggleVoiceToMidi();
    });

    expect(globalThis.MediaRecorder).toHaveBeenCalledWith(mockStream);
    expect(mockStart).toHaveBeenCalledTimes(1);
  });

  it('MediaRecorder is stopped and tracks released when toggling off', async () => {
    const { result } = renderHook(() => useVoiceToMidi());

    await act(async () => {
      await result.current.toggleVoiceToMidi();
    });

    mockMediaRecorderState = 'recording';

    await act(async () => {
      await result.current.toggleVoiceToMidi();
    });

    expect(mockStop).toHaveBeenCalledTimes(1);
    expect(mockGetTracks).toHaveBeenCalled();
    expect(mockTrackStop).toHaveBeenCalled();
  });

  it('cleanup on unmount stops recording if active', async () => {
    const { result, unmount } = renderHook(() => useVoiceToMidi());

    await act(async () => {
      await result.current.toggleVoiceToMidi();
    });

    expect(result.current.isVoiceToMidi).toBe(true);
    mockMediaRecorderState = 'recording';

    unmount();

    expect(mockStop).toHaveBeenCalled();
    expect(mockTrackStop).toHaveBeenCalled();
  });

  it('cleanup on unmount does nothing if not recording', () => {
    const { unmount } = renderHook(() => useVoiceToMidi());
    unmount();
    expect(mockStop).not.toHaveBeenCalled();
  });

  it('does not stop if MediaRecorder state is not recording on toggle off', async () => {
    const { result } = renderHook(() => useVoiceToMidi());

    await act(async () => {
      await result.current.toggleVoiceToMidi();
    });

    mockMediaRecorderState = 'inactive';

    await act(async () => {
      await result.current.toggleVoiceToMidi();
    });

    expect(result.current.isVoiceToMidi).toBe(false);
    expect(mockStop).not.toHaveBeenCalled();
  });

  it('does not stop if MediaRecorder is null on unmount', () => {
    const { unmount } = renderHook(() => useVoiceToMidi());
    unmount();
    expect(mockStop).not.toHaveBeenCalled();
  });

  it('does not stop if MediaRecorder state is not recording on unmount', async () => {
    const { result, unmount } = renderHook(() => useVoiceToMidi());

    await act(async () => {
      await result.current.toggleVoiceToMidi();
    });

    mockMediaRecorderState = 'inactive';

    unmount();

    expect(mockStop).not.toHaveBeenCalled();
  });

  it('MediaRecorder error event sets micError and stops tracks', async () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    let errorCb: ((event: any) => void) | undefined;

    const MockRecorder = vi.fn(function (this: any) {
      this.start = mockStart;
      this.stop = mockStop;
      Object.defineProperty(this, 'state', {
        get() { return mockMediaRecorderState; },
      });
      this.stream = mockStream;
      this.addEventListener = vi.fn((event: string, cb: (e: any) => void) => {
        if (event === 'error') errorCb = cb;
      });
      this.removeEventListener = vi.fn();
    });
    vi.stubGlobal('MediaRecorder', MockRecorder);

    const { result } = renderHook(() => useVoiceToMidi());

    await act(async () => {
      await result.current.toggleVoiceToMidi();
    });

    expect(errorCb).toBeDefined();

    const fakeEvent = { error: new Error('SecurityError') };
    await act(async () => {
      errorCb!(fakeEvent);
    });

    expect(result.current.isVoiceToMidi).toBe(false);
    expect(result.current.micError).toBe('Recording stopped unexpectedly.');
    expect(mockTrackStop).toHaveBeenCalled();
    expect(consoleSpy).toHaveBeenCalledWith('MediaRecorder error:', fakeEvent.error);

    consoleSpy.mockRestore();
    vi.stubGlobal('MediaRecorder', vi.fn(function (this: any) {
      this.start = mockStart;
      this.stop = mockStop;
      Object.defineProperty(this, 'state', {
        get() { return mockMediaRecorderState; },
      });
      this.stream = mockStream;
      this.addEventListener = vi.fn();
      this.removeEventListener = vi.fn();
    }));
  });

  it('stale request is discarded when user toggles rapidly', async () => {
    let resolveFirst!: (stream: any) => void;
    let callCount = 0;

    mockGetUserMedia.mockImplementation(() => {
      callCount++;
      if (callCount === 1) {
        return new Promise((resolve) => { resolveFirst = resolve; });
      }
      return new Promise(() => {});
    });

    const { result } = renderHook(() => useVoiceToMidi());

    await act(async () => {
      result.current.toggleVoiceToMidi();
    });

    await act(async () => {
      result.current.toggleVoiceToMidi();
    });

    expect(result.current.isVoiceToMidi).toBe(false);

    await act(async () => {
      resolveFirst(mockStream);
    });

    expect(result.current.isVoiceToMidi).toBe(false);
    expect(mockStart).not.toHaveBeenCalled();
    expect(mockTrackStop).toHaveBeenCalled();
  });
});
