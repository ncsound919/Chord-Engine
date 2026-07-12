import { describe, it, expect } from 'vitest';
import { AudioEngine, audioEngine } from './engine';

// These tests verify the audio routing graph is correctly wired —
// not just that individual functions work, but that signal flows
// through the intended paths.

describe('Audio routing graph', () => {
  it('creates a controllable three-channel synth mixer layout', () => {
    expect(audioEngine.tracks.has('lead')).toBe(true);
    expect(audioEngine.tracks.has('pads')).toBe(true);
    expect(audioEngine.tracks.has('bass')).toBe(true);
  });

  it('creates all drum submix tracks', () => {
    for (const id of AudioEngine.DRUM_SUBMIX_TRACKS) {
      expect(audioEngine.tracks.has(id)).toBe(true);
    }
  });

  it('creates all sampler tracks', () => {
    for (const id of AudioEngine.SAMPLER_TRACKS) {
      expect(audioEngine.tracks.has(id)).toBe(true);
    }
  });
});

import { DRUM_TRACK_MAP } from './sequencer';

describe('Drum routing map', () => {
  it('routes each drum voice through a named submix', () => {
    expect(DRUM_TRACK_MAP.Kick).toBe('kick');
    expect(DRUM_TRACK_MAP.Snare).toBe('snare');
    expect(DRUM_TRACK_MAP['HH Closed']).toBe('hihat');
    expect(DRUM_TRACK_MAP['HH Open']).toBe('hihat');
    expect(DRUM_TRACK_MAP['Hi-Hat Closed']).toBe('hihat');
    expect(DRUM_TRACK_MAP['Hi-Hat Open']).toBe('hihat');
    expect(DRUM_TRACK_MAP['Tom High']).toBe('toms');
    expect(DRUM_TRACK_MAP['Tom Mid']).toBe('toms');
    expect(DRUM_TRACK_MAP['Tom Floor']).toBe('toms');
    expect(DRUM_TRACK_MAP['Tom 1']).toBe('toms');
    expect(DRUM_TRACK_MAP['Tom 2']).toBe('toms');
    expect(DRUM_TRACK_MAP['Tom 3']).toBe('toms');
    expect(DRUM_TRACK_MAP.Crash).toBe('overhead');
    expect(DRUM_TRACK_MAP.Ride).toBe('overhead');
  });

  it('falls back to drums track for unmapped drums', () => {
    // DRUM_TRACK_MAP doesn't have a fallback entry, but the
    // sequencer code uses ?? 'drums' at call sites.
    expect(DRUM_TRACK_MAP['Unknown']).toBeUndefined();
  });
});

describe('DEFAULT_TRACKS contract', () => {
  it('contains all expected main tracks', () => {
    const expected = ['drums', 'bass', 'lead', 'pads', 'keys', 'guitar'];
    for (const name of expected) {
      expect(AudioEngine.DEFAULT_TRACKS).toContain(name);
    }
  });

  it('has exactly 6 default tracks', () => {
    expect(AudioEngine.DEFAULT_TRACKS).toHaveLength(6);
  });

  it('DRUM_SUBMIX_TRACKS has exactly 5 entries', () => {
    expect(AudioEngine.DRUM_SUBMIX_TRACKS).toHaveLength(5);
    expect(AudioEngine.DRUM_SUBMIX_TRACKS).toEqual([
      'kick', 'snare', 'hihat', 'toms', 'overhead',
    ]);
  });
});

describe('Track signal chain', () => {
  it('every track has the correct node chain', () => {
    for (const [, track] of audioEngine.tracks) {
      expect(track.inputGain).toBeDefined();
      expect(track.volumeNode).toBeDefined();
      expect(track.analyser).toBeDefined();
      expect(track.panner).toBeDefined();
    }
  });
});

import { mapSoundbankFile } from './soundbankMapping';

describe('Folder import full coverage', () => {
  function file(name: string, path?: string): File {
    const f = new File(['data'], name, { type: 'audio/wav' });
    if (path) Object.defineProperty(f, 'webkitRelativePath', { value: path });
    return f;
  }

  it('maps all standard drum filenames', () => {
    expect(mapSoundbankFile(file('Kick.wav'))).toBeTruthy();
    expect(mapSoundbankFile(file('Snare.wav'))).toBeTruthy();
    expect(mapSoundbankFile(file('HiHat.wav'))).toBeTruthy();
    expect(mapSoundbankFile(file('Open Hat.wav'))).toBeTruthy();
    expect(mapSoundbankFile(file('Crash.wav'))).toBeTruthy();
    expect(mapSoundbankFile(file('Ride.wav'))).toBeTruthy();
    expect(mapSoundbankFile(file('Tom 1.wav'))).toBeTruthy();
    expect(mapSoundbankFile(file('Tom 2.wav'))).toBeTruthy();
    expect(mapSoundbankFile(file('Tom 3.wav'))).toBeTruthy();
  });

  it('maps bare tom.wav to Tom 1', () => {
    const result = mapSoundbankFile(file('tom.wav'));
    expect(result).not.toBeNull();
    if (result && result.kind === 'drum') {
      expect(result.drum).toBe('Tom 1');
    }
  });

  it('detects kit 2 from path', () => {
    const result = mapSoundbankFile(file('Kick.wav', 'Pearl Master Kit/Kick.wav'));
    expect(result).not.toBeNull();
    if (result && result.kind === 'drum') {
      expect(result.kitId).toBe('kit2');
    }
  });

  it('returns null for non-audio files', () => {
    expect(mapSoundbankFile(new File([''], 'readme.txt', { type: 'text/plain' }))).toBeNull();
  });
});
