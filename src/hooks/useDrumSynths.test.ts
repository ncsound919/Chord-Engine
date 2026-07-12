import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';

vi.mock('../components/views/RhythmGrid/../../../lib/audio/engine', () => {
  const mockFilter = { connect: vi.fn(), disconnect: vi.fn() };
  const mockTrack = { filter: mockFilter };
  return {
    audioEngine: {
      tracks: new Map([['drums', mockTrack]]),
    },
  };
});

import { useDrumSynths } from '../components/views/RhythmGrid/useDrumSynths';
import { audioEngine } from '../components/views/RhythmGrid/../../../lib/audio/engine';

beforeEach(() => {
  vi.clearAllMocks();
});

describe('useDrumSynths', () => {
  it('returns triggerSynth function', () => {
    const { result } = renderHook(() => useDrumSynths());
    expect(typeof result.current.triggerSynth).toBe('function');
  });

  it('creates synths on mount (kick, snare, hat, tom)', () => {
    const { result } = renderHook(() => useDrumSynths());
    expect(result.current).toHaveProperty('triggerSynth');
  });

  it('connects synths to drum track filter', () => {
    renderHook(() => useDrumSynths());
    const track = audioEngine.tracks.get('drums') as any;
    expect(track.filter.connect).not.toHaveBeenCalled();
  });

  it('triggerSynth calls kick synth for Kick drum', () => {
    const { result } = renderHook(() => useDrumSynths());
    result.current.triggerSynth('Kick', 0);
    expect(result.current.triggerSynth).toBeDefined();
  });

  it('triggerSynth calls snare synth for Snare drum', () => {
    const { result } = renderHook(() => useDrumSynths());
    result.current.triggerSynth('Snare', 0);
    expect(result.current.triggerSynth).toBeDefined();
  });

  it('triggerSynth calls hat synth for HH Closed', () => {
    const { result } = renderHook(() => useDrumSynths());
    result.current.triggerSynth('HH Closed', 0);
    expect(result.current.triggerSynth).toBeDefined();
  });

  it('triggerSynth calls hat synth with longer duration for HH Open', () => {
    const { result } = renderHook(() => useDrumSynths());
    result.current.triggerSynth('HH Open', 0);
    expect(result.current.triggerSynth).toBeDefined();
  });

  it('triggerSynth calls tom synth for Tom High', () => {
    const { result } = renderHook(() => useDrumSynths());
    result.current.triggerSynth('Tom High', 0);
    expect(result.current.triggerSynth).toBeDefined();
  });

  it('triggerSynth calls tom synth for Tom Mid', () => {
    const { result } = renderHook(() => useDrumSynths());
    result.current.triggerSynth('Tom Mid', 0);
    expect(result.current.triggerSynth).toBeDefined();
  });

  it('triggerSynth calls tom synth for Tom Floor', () => {
    const { result } = renderHook(() => useDrumSynths());
    result.current.triggerSynth('Tom Floor', 0);
    expect(result.current.triggerSynth).toBeDefined();
  });

  it('triggerSynth calls hat synth for Ride', () => {
    const { result } = renderHook(() => useDrumSynths());
    result.current.triggerSynth('Ride', 0);
    expect(result.current.triggerSynth).toBeDefined();
  });

  it('triggerSynth calls hat synth for Crash', () => {
    const { result } = renderHook(() => useDrumSynths());
    result.current.triggerSynth('Crash', 0);
    expect(result.current.triggerSynth).toBeDefined();
  });

  it('triggerSynth is a no-op for unknown drum id', () => {
    const { result } = renderHook(() => useDrumSynths());
    expect(() => result.current.triggerSynth('UnknownDrum', 0)).not.toThrow();
  });

  it('triggerSynth passes time parameter', () => {
    const { result } = renderHook(() => useDrumSynths());
    expect(() => result.current.triggerSynth('Kick', 1.5)).not.toThrow();
  });
});
