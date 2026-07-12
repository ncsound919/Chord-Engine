import { describe, it, expect } from 'vitest';
import { mapSoundbankFile, type SoundbankTarget } from './soundbankMapping';

function file(name: string, path?: string): File {
  const f = new File(['data'], name, { type: 'audio/wav' });
  if (path) {
    Object.defineProperty(f, 'webkitRelativePath', { value: path });
  }
  return f;
}

describe('mapSoundbankFile', () => {
  it('maps Kick.wav to kit1_Kick', () => {
    const result = mapSoundbankFile(file('Kick.wav'));
    expect(result).not.toBeNull();
    if (result && result.kind === 'drum') {
      expect(result.id).toBe('kit1_Kick');
      expect(result.targetName).toBe('Kick');
    }
  });

  it('maps Snare.wav to kit1_Snare', () => {
    const result = mapSoundbankFile(file('Snare.wav'));
    expect(result).not.toBeNull();
    if (result && result.kind === 'drum') {
      expect(result.id).toBe('kit1_Snare');
      expect(result.targetName).toBe('Snare');
    }
  });

  it('maps Ride.wav to kit1_Ride', () => {
    const result = mapSoundbankFile(file('Ride.wav'));
    expect(result).not.toBeNull();
    if (result && result.kind === 'drum') {
      expect(result.id).toBe('kit1_Ride');
      expect(result.targetName).toBe('Ride');
    }
  });

  it('maps Tom 3.wav to kit1_Tom 3', () => {
    const result = mapSoundbankFile(file('Tom 3.wav'));
    expect(result).not.toBeNull();
    if (result && result.kind === 'drum') {
      expect(result.id).toBe('kit1_Tom 3');
      expect(result.targetName).toBe('Tom 3');
    }
  });

  it('maps bass file to bass_default', () => {
    const result = mapSoundbankFile(file('electric_bass.wav'));
    expect(result).not.toBeNull();
    if (result && result.kind === 'bass') {
      expect(result.id).toBe('bass_default');
      expect(result.targetName).toBe('bass');
    }
  });

  it('maps bd_kick_808.wav to kit1_Kick', () => {
    const result = mapSoundbankFile(file('bd_kick_808.wav'));
    expect(result).not.toBeNull();
    if (result && result.kind === 'drum') {
      expect(result.drum).toBe('Kick');
    }
  });

  it('maps snr pattern to Snare', () => {
    const result = mapSoundbankFile(file('snr_acoustic.wav'));
    expect(result).not.toBeNull();
    if (result && result.kind === 'drum') {
      expect(result.drum).toBe('Snare');
    }
  });

  it('maps hh pattern to Hi-Hat Closed', () => {
    const result = mapSoundbankFile(file('hh_beat.wav'));
    expect(result).not.toBeNull();
    if (result && result.kind === 'drum') {
      expect(result.drum).toBe('Hi-Hat Closed');
    }
  });

  it('maps open hat to Hi-Hat Open', () => {
    const result = mapSoundbankFile(file('open_hat.wav'));
    expect(result).not.toBeNull();
    if (result && result.kind === 'drum') {
      expect(result.drum).toBe('Hi-Hat Open');
    }
  });

  it('maps crash to Crash', () => {
    const result = mapSoundbankFile(file('crash_cymbal.wav'));
    expect(result).not.toBeNull();
    if (result && result.kind === 'drum') {
      expect(result.drum).toBe('Crash');
    }
  });

  it('returns null for non-audio files', () => {
    const result = mapSoundbankFile(new File([''], 'readme.txt', { type: 'text/plain' }));
    expect(result).toBeNull();
  });

  it('detects kit 2 from file path', () => {
    const result = mapSoundbankFile(file('Kick.wav', 'Pearl Master Kit/Kick.wav'));
    expect(result).not.toBeNull();
    if (result && result.kind === 'drum') {
      expect(result.kitId).toBe('kit2');
    }
  });
});
