import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { BassSampler, bassSampler, ARTICULATION_NAMES, ARTICULATION_SHORT } from './bassSampler';
import type { BassSampleEntry, BassArticulation } from './bassSampler';

const hoisted = vi.hoisted(() => ({
  mockPlayBufferShifted: vi.fn(),
  mockPlayOscillator: vi.fn(),
}));

vi.mock('./engine', () => ({
  audioEngine: {
    ctx: { currentTime: 0 },
    tracks: new Map([
      [
        'bass',
        {
          playBufferShifted: hoisted.mockPlayBufferShifted,
          playOscillator: hoisted.mockPlayOscillator,
        },
      ],
    ]),
  },
}));

function makeEntry(overrides: Partial<BassSampleEntry> = {}): BassSampleEntry {
  return {
    note: 40,
    articulation: 'sustain',
    velocity: 100,
    roundRobin: 0,
    buffer: { duration: 1 } as any,
    filename: 'E2_sus_rr1.wav',
    ...overrides,
  };
}

describe('BassSampler', () => {
  let sampler: BassSampler;

  beforeEach(() => {
    vi.clearAllMocks();
    sampler = new BassSampler();
  });

  afterEach(() => {
    sampler.clear();
  });

  describe('constructor default state', () => {
    it('starts with loaded = false', () => {
      expect(sampler.loaded).toBe(false);
    });

    it('starts with empty entries', () => {
      expect(sampler.loadedEntries).toEqual([]);
    });

    it('starts with empty notes', () => {
      expect(sampler.loadedNotes).toEqual([]);
    });

    it('starts with empty articulations', () => {
      expect(sampler.loadedArticulations).toEqual([]);
    });

    it('default articulation is sustain', () => {
      expect(sampler.currentArticulation).toBe('sustain');
    });
  });

  describe('addEntry', () => {
    it('adds sample entry and sets loaded to true', () => {
      sampler.addEntry(makeEntry());
      expect(sampler.loaded).toBe(true);
      expect(sampler.loadedEntries).toHaveLength(1);
    });

    it('loadedNotes returns sorted distinct notes', () => {
      sampler.addEntry(makeEntry({ note: 48 }));
      sampler.addEntry(makeEntry({ note: 36 }));
      sampler.addEntry(makeEntry({ note: 48, articulation: 'slap' }));
      expect(sampler.loadedNotes).toEqual([36, 48]);
    });

    it('loadedArticulations returns distinct articulations', () => {
      sampler.addEntry(makeEntry({ articulation: 'sustain' }));
      sampler.addEntry(makeEntry({ articulation: 'slap' }));
      expect(sampler.loadedArticulations).toEqual(expect.arrayContaining(['sustain', 'slap']));
    });
  });

  describe('clear', () => {
    it('resets entries and active state', () => {
      sampler.addEntry(makeEntry());
      sampler.addKeySwitch(60, 'slap');
      sampler.handleKeySwitch(60);
      sampler.triggerNote(40);
      sampler.clear();
      expect(sampler.loaded).toBe(false);
      expect(sampler.loadedEntries).toHaveLength(0);
      expect((sampler as any)._activeNote).toBeNull();
    });
  });

  describe('addKeySwitch / handleKeySwitch', () => {
    it('handleKeySwitch changes articulation for registered key', () => {
      sampler.addKeySwitch(60, 'slap');
      const result = sampler.handleKeySwitch(60);
      expect(result).toBe(true);
      expect(sampler.currentArticulation).toBe('slap');
    });

    it('handleKeySwitch returns false for unknown key', () => {
      const result = sampler.handleKeySwitch(99);
      expect(result).toBe(false);
      expect(sampler.currentArticulation).toBe('sustain');
    });
  });

  describe('triggerNote', () => {
    it('plays sample when found', () => {
      sampler.addEntry(makeEntry({ note: 40, articulation: 'sustain' }));
      sampler.triggerNote(40);
      expect(hoisted.mockPlayBufferShifted).toHaveBeenCalled();
    });

    it('uses fallback oscillator when no sample found', () => {
      sampler.triggerNote(40);
      expect(hoisted.mockPlayOscillator).toHaveBeenCalled();
    });

    it('uses fallback when buffer is null', () => {
      sampler.addEntry(makeEntry({ note: 40, articulation: 'sustain', buffer: null }));
      sampler.triggerNote(40);
      expect(hoisted.mockPlayOscillator).toHaveBeenCalled();
    });

    it('does not throw when track missing', () => {
      sampler.addEntry(makeEntry({ note: 40 }));
      expect(() => sampler.triggerNote(40)).not.toThrow();
    });

    it('supports mono choke', () => {
      sampler.addEntry(makeEntry({ note: 40 }));
      sampler.addEntry(makeEntry({ note: 48 }));
      expect(() => {
        sampler.triggerNote(40);
        sampler.triggerNote(48);
      }).not.toThrow();
    });

    it('multiple fallback oscillators play without error', () => {
      sampler.triggerNote(36);
      sampler.triggerNote(48);
      sampler.triggerNote(60);
      expect(hoisted.mockPlayOscillator).toHaveBeenCalledTimes(3);
    });

    it('slap articulation uses sawtooth fallback', () => {
      sampler.currentArticulation = 'slap';
      sampler.triggerNote(40);
      expect(hoisted.mockPlayOscillator).toHaveBeenCalled();
    });
  });

  describe('triggerNoteOff', () => {
    it('clears active note', () => {
      sampler.addEntry(makeEntry({ note: 40 }));
      sampler.triggerNote(40);
      sampler.triggerNoteOff(40);
      expect((sampler as any)._activeNote).toBeNull();
    });

    it('ignores non-matching note', () => {
      sampler.addEntry(makeEntry({ note: 40 }));
      sampler.triggerNote(40);
      expect(() => sampler.triggerNoteOff(48)).not.toThrow();
      expect((sampler as any)._activeNote).toBe(40);
    });
  });

  describe('releaseAll', () => {
    it('clears state without error', () => {
      sampler.addEntry(makeEntry());
      expect(() => sampler.releaseAll()).not.toThrow();
    });

    it('clears active note', () => {
      sampler.addEntry(makeEntry({ note: 40 }));
      sampler.triggerNote(40);
      sampler.releaseAll();
      expect((sampler as any)._activeNote).toBeNull();
    });
  });

  describe('selectSample', () => {
    it('finds closest note when exact match missing', () => {
      sampler.addEntry(makeEntry({ note: 36, articulation: 'sustain' }));
      sampler.addEntry(makeEntry({ note: 48, articulation: 'sustain' }));
      const result = (sampler as any).selectSample(44, 100);
      expect(result).not.toBeNull();
      expect(result!.note).toBe(48);
    });

    it('velocity layer selection picks closest layer', () => {
      sampler.addEntry(makeEntry({ note: 40, articulation: 'sustain', velocity: 50 }));
      sampler.addEntry(makeEntry({ note: 40, articulation: 'sustain', velocity: 100 }));
      const result = (sampler as any).selectSample(40, 70);
      expect(result).not.toBeNull();
      expect(result!.velocity).toBe(50);
    });

    it('returns null when no entries exist', () => {
      const result = (sampler as any).selectSample(40, 100);
      expect(result).toBeNull();
    });
  });

  describe('parseFilename', () => {
    it('parses "E2_sus_rr1.wav" correctly', () => {
      const result = BassSampler.parseFilename('E2_sus_rr1.wav');
      expect(result).toEqual({ note: 40, articulation: 'sustain', roundRobin: 0 });
    });

    it('parses "A#1_pm_rr2.wav" correctly', () => {
      const result = BassSampler.parseFilename('A#1_pm_rr2.wav');
      expect(result).toEqual({ note: 34, articulation: 'palm_mute', roundRobin: 1 });
    });

    it('parses "C3_stac_rr3.wav" correctly', () => {
      const result = BassSampler.parseFilename('C3_stac_rr3.wav');
      expect(result).toEqual({ note: 48, articulation: 'staccato', roundRobin: 2 });
    });

    it('returns null for unparseable names', () => {
      expect(BassSampler.parseFilename('nothing.wav')).toBeNull();
      expect(BassSampler.parseFilename('')).toBeNull();
      expect(BassSampler.parseFilename('no_notes_here.wav')).toBeNull();
    });

    it('handles various articulation codes', () => {
      expect(BassSampler.parseFilename('E2_slap_rr1.wav')!.articulation).toBe('slap');
      expect(BassSampler.parseFilename('E2_pop_rr1.wav')!.articulation).toBe('pop');
      expect(BassSampler.parseFilename('E2_harm_rr1.wav')!.articulation).toBe('harmonic');
      expect(BassSampler.parseFilename('E2_nat_rr1.wav')!.articulation).toBe('natural');
    });

    it('handles sharp notes like F#3', () => {
      const result = BassSampler.parseFilename('F#3_sus_rr1.wav');
      expect(result).not.toBeNull();
      expect(result!.note).toBe(54);
    });

    it('handles double-digit octaves', () => {
      const result = BassSampler.parseFilename('C-1_sus_rr1.wav');
      expect(result).not.toBeNull();
      expect(result!.note).toBe(0);
    });
  });

  describe('currentArticulation setter', () => {
    it('can set and get articulation', () => {
      sampler.currentArticulation = 'slap';
      expect(sampler.currentArticulation).toBe('slap');
    });
  });

  describe('ARTICULATION_NAMES', () => {
    it('contains all articulation display names', () => {
      expect(ARTICULATION_NAMES.sustain).toBe('Sustain');
      expect(ARTICULATION_NAMES.slap).toBe('Slap');
      expect(ARTICULATION_NAMES.palm_mute).toBe('Palm Mute');
    });
  });

  describe('ARTICULATION_SHORT', () => {
    it('contains all short codes', () => {
      expect(ARTICULATION_SHORT.sustain).toBe('sus');
      expect(ARTICULATION_SHORT.slap).toBe('slap');
      expect(ARTICULATION_SHORT.palm_mute).toBe('pm');
    });
  });
});
