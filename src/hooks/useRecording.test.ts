import { renderHook, act, cleanup } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { useRecording } from './useRecording';

let mockRecorderState: string = 'inactive';
const mockRecorderStart = vi.fn();
const mockRecorderStop = vi.fn();
let mockOnDataAvailable: ((e: { data: Blob }) => void) | null = null;
let mockOnStop: (() => void) | null = null;

const MockMediaRecorder = vi.fn(function (this: any, _stream: MediaStream, _options?: MediaRecorderOptions) {
  this.start = mockRecorderStart;
  this.stop = mockRecorderStop;
  Object.defineProperty(this, 'state', {
    get() {
      return mockRecorderState;
    },
  });
  Object.defineProperty(this, 'ondataavailable', {
    get() {
      return mockOnDataAvailable;
    },
    set(cb: (e: { data: Blob }) => void) {
      mockOnDataAvailable = cb;
    },
  });
  Object.defineProperty(this, 'onstop', {
    get() {
      return mockOnStop;
    },
    set(cb: () => void) {
      mockOnStop = cb;
    },
  });
});
(MockMediaRecorder as any).isTypeSupported = vi.fn(() => true);

vi.stubGlobal('MediaRecorder', MockMediaRecorder);

const { mockEngine } = vi.hoisted(() => ({
  mockEngine: {
    ctx: {
      state: 'running' as AudioContextState,
      resume: vi.fn().mockResolvedValue(undefined),
      createMediaStreamDestination: vi.fn(() => ({
        stream: { id: 'mock-stream' },
      })),
    },
    masterLimiter: {
      connect: vi.fn(),
      disconnect: vi.fn(),
    },
  },
}));

vi.mock('../lib/audio/engine', () => ({
  audioEngine: mockEngine,
}));

describe('useRecording', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRecorderState = 'inactive';
    mockOnDataAvailable = null;
    mockOnStop = null;
    mockEngine.ctx.state = 'running';
  });

  afterEach(() => {
    cleanup();
  });

  it('returns initial recording state', () => {
    const { result } = renderHook(() => useRecording());

    expect(result.current.isRecording).toBe(false);
    expect(typeof result.current.startRecording).toBe('function');
    expect(typeof result.current.stopRecording).toBe('function');
    expect(typeof result.current.toggleRecording).toBe('function');
  });

  it('startRecording creates a MediaRecorder and starts it', async () => {
    const { result } = renderHook(() => useRecording());

    await act(async () => {
      await result.current.startRecording();
    });

    expect(mockEngine.ctx.createMediaStreamDestination).toHaveBeenCalledTimes(1);
    expect(mockEngine.masterLimiter.connect).toHaveBeenCalledTimes(1);
    expect(mockRecorderStart).toHaveBeenCalledTimes(1);
    expect(result.current.isRecording).toBe(true);
  });

  it('startRecording resumes context when suspended', async () => {
    mockEngine.ctx.state = 'suspended';

    const { result } = renderHook(() => useRecording());

    await act(async () => {
      await result.current.startRecording();
    });

    expect(mockEngine.ctx.resume).toHaveBeenCalledTimes(1);
  });

  it('stopRecording stops the recorder', async () => {
    const { result } = renderHook(() => useRecording());

    await act(async () => {
      await result.current.startRecording();
    });

    mockRecorderState = 'recording';

    act(() => {
      result.current.stopRecording();
    });

    expect(mockRecorderStop).toHaveBeenCalledTimes(1);
    expect(result.current.isRecording).toBe(false);
  });

  it('stopRecording does nothing if recorder is inactive', () => {
    const { result } = renderHook(() => useRecording());

    act(() => {
      result.current.stopRecording();
    });

    expect(mockRecorderStop).not.toHaveBeenCalled();
    expect(result.current.isRecording).toBe(false);
  });

  it('toggleRecording starts when not recording', async () => {
    const { result } = renderHook(() => useRecording());

    await act(async () => {
      await result.current.toggleRecording();
    });

    expect(mockRecorderStart).toHaveBeenCalledTimes(1);
    expect(result.current.isRecording).toBe(true);
  });

  it('toggleRecording stops when already recording', async () => {
    const { result } = renderHook(() => useRecording());

    await act(async () => {
      await result.current.startRecording();
    });

    mockRecorderState = 'recording';

    act(() => {
      result.current.toggleRecording();
    });

    expect(mockRecorderStop).toHaveBeenCalledTimes(1);
    expect(result.current.isRecording).toBe(false);
  });

  it('onstop handler disconnects the destination', async () => {
    const { result } = renderHook(() => useRecording());

    await act(async () => {
      await result.current.startRecording();
    });

    mockRecorderState = 'recording';

    act(() => {
      result.current.stopRecording();
    });

    expect(mockOnStop).toBeTruthy();

    act(() => {
      mockOnStop?.();
    });

    expect(mockEngine.masterLimiter.disconnect).toHaveBeenCalled();
  });

  it('cleanup on unmount stops recording if active', async () => {
    const { result, unmount } = renderHook(() => useRecording());

    await act(async () => {
      await result.current.startRecording();
    });

    mockRecorderState = 'recording';

    unmount();

    expect(mockRecorderStop).toHaveBeenCalled();
  });

  it('cleanup on unmount does nothing if not recording', () => {
    const { unmount } = renderHook(() => useRecording());

    unmount();

    expect(mockRecorderStop).not.toHaveBeenCalled();
  });

  it('cleanup disconnects destination if it exists', async () => {
    const { result, unmount } = renderHook(() => useRecording());

    await act(async () => {
      await result.current.startRecording();
    });

    unmount();

    expect(mockEngine.masterLimiter.disconnect).toHaveBeenCalled();
  });

  it('startRecording returns early when no MIME type is supported', async () => {
    (MockMediaRecorder as any).isTypeSupported.mockReturnValue(false);
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    const { result } = renderHook(() => useRecording());

    await act(async () => {
      await result.current.startRecording();
    });

    expect(result.current.isRecording).toBe(false);
    expect(consoleSpy).toHaveBeenCalledWith(
      'No supported audio recording format found in this browser.',
    );
    expect(mockEngine.masterLimiter.disconnect).toHaveBeenCalledWith(expect.anything());
    expect(mockRecorderStart).not.toHaveBeenCalled();

    consoleSpy.mockRestore();
    (MockMediaRecorder as any).isTypeSupported.mockReturnValue(true);
  });

  it('startRecording does nothing when recorder is already active', async () => {
    const { result } = renderHook(() => useRecording());

    await act(async () => {
      await result.current.startRecording();
    });

    mockRecorderState = 'recording';

    await act(async () => {
      await result.current.startRecording();
    });

    expect(mockRecorderStart).toHaveBeenCalledTimes(1);
    expect(mockEngine.ctx.createMediaStreamDestination).toHaveBeenCalledTimes(1);
  });
});
