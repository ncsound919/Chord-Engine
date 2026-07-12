import { describe, it, expect } from 'vitest';
import {
  NOTE_NAMES_SHARP,
  NOTE_NAMES_FLAT,
  KEYS,
  ALL_PITCH_CLASSES,
  pitchClassOf,
  noteName,
  midi,
  midiToPitchClass,
  midiToOctave,
  midiToNoteName,
  midiToFreq,
  noteToMidi,
  transposePitchClass,
  pitchClassDistance,
  getScalePitchClasses,
  isDiatonicToKey,
  CHORD_QUALITIES,
  chordTonesForQuality,
  essentialChordTonesForQuality,
  isDominantQuality,
  isMajorQuality,
  isMinorQuality,
  chordTonesAsMidi,
} from './pitch';

describe('constants', () => {
  it('NOTE_NAMES_SHARP has 12 entries', () => {
    expect(NOTE_NAMES_SHARP).toHaveLength(12);
    expect(NOTE_NAMES_SHARP[0]).toBe('C');
    expect(NOTE_NAMES_SHARP[6]).toBe('F#');
  });

  it('NOTE_NAMES_FLAT has 12 entries', () => {
    expect(NOTE_NAMES_FLAT).toHaveLength(12);
    expect(NOTE_NAMES_FLAT[0]).toBe('C');
    expect(NOTE_NAMES_FLAT[6]).toBe('Gb');
  });

  it('KEYS has 12 entries', () => {
    expect(KEYS).toHaveLength(12);
  });

  it('ALL_PITCH_CLASSES has 12 entries 0-11', () => {
    expect(ALL_PITCH_CLASSES).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]);
  });
});

describe('pitchClassOf', () => {
  it('parses sharp note names', () => {
    expect(pitchClassOf('C')).toBe(0);
    expect(pitchClassOf('C#')).toBe(1);
    expect(pitchClassOf('D')).toBe(2);
    expect(pitchClassOf('D#')).toBe(3);
    expect(pitchClassOf('E')).toBe(4);
    expect(pitchClassOf('F')).toBe(5);
    expect(pitchClassOf('F#')).toBe(6);
    expect(pitchClassOf('G')).toBe(7);
    expect(pitchClassOf('G#')).toBe(8);
    expect(pitchClassOf('A')).toBe(9);
    expect(pitchClassOf('A#')).toBe(10);
    expect(pitchClassOf('B')).toBe(11);
  });

  it('parses flat note names', () => {
    expect(pitchClassOf('Db')).toBe(1);
    expect(pitchClassOf('Eb')).toBe(3);
    expect(pitchClassOf('Gb')).toBe(6);
    expect(pitchClassOf('Ab')).toBe(8);
    expect(pitchClassOf('Bb')).toBe(10);
  });

  it('strips octave numbers', () => {
    expect(pitchClassOf('C4')).toBe(0);
    expect(pitchClassOf('A#5')).toBe(10);
    expect(pitchClassOf('Bb3')).toBe(10);
    expect(pitchClassOf('Eb2')).toBe(3);
  });

  it('handles negative octave numbers', () => {
    expect(pitchClassOf('C-1')).toBe(0);
    expect(pitchClassOf('A-2')).toBe(9);
  });

  it('throws on unknown note name', () => {
    expect(() => pitchClassOf('H')).toThrow('Unknown note name: H');
    expect(() => pitchClassOf('X')).toThrow('Unknown note name: X');
  });
});

describe('noteName', () => {
  it('returns flat names by default', () => {
    expect(noteName(0)).toBe('C');
    expect(noteName(1)).toBe('Db');
    expect(noteName(6)).toBe('Gb');
    expect(noteName(10)).toBe('Bb');
  });

  it('returns sharp names when preferFlat is false', () => {
    expect(noteName(0, false)).toBe('C');
    expect(noteName(1, false)).toBe('C#');
    expect(noteName(6, false)).toBe('F#');
    expect(noteName(10, false)).toBe('A#');
  });

  it('wraps correctly for negative pitch classes', () => {
    expect(noteName(-1)).toBe('B');
    expect(noteName(-1, false)).toBe('B');
    expect(noteName(-12)).toBe('C');
    expect(noteName(-13)).toBe('B');
  });

  it('wraps correctly for pitch classes >= 12', () => {
    expect(noteName(12)).toBe('C');
    expect(noteName(13)).toBe('Db');
    expect(noteName(24)).toBe('C');
  });

  it('returns all 12 note names for pitch classes 0-11', () => {
    const sharps = Array.from({ length: 12 }, (_, i) => noteName(i, false));
    expect(sharps).toEqual(NOTE_NAMES_SHARP);
    const flats = Array.from({ length: 12 }, (_, i) => noteName(i, true));
    expect(flats).toEqual(NOTE_NAMES_FLAT);
  });
});

describe('midi', () => {
  it('C4 = 60', () => {
    expect(midi(0, 4)).toBe(60);
  });

  it('A4 = 69', () => {
    expect(midi(9, 4)).toBe(69);
  });

  it('C-1 = 0', () => {
    expect(midi(0, -1)).toBe(0);
  });

  it('B9 = 131', () => {
    expect(midi(11, 9)).toBe(131);
  });

  it('A4+1 semitone = Bb4', () => {
    expect(midi(10, 4)).toBe(70);
  });
});

describe('midiToPitchClass', () => {
  it('60 → 0 (C)', () => {
    expect(midiToPitchClass(60)).toBe(0);
  });

  it('61 → 1 (C#)', () => {
    expect(midiToPitchClass(61)).toBe(1);
  });

  it('69 → 9 (A)', () => {
    expect(midiToPitchClass(69)).toBe(9);
  });

  it('wraps around 12', () => {
    expect(midiToPitchClass(72)).toBe(0);
    expect(midiToPitchClass(48)).toBe(0);
  });

  it('handles low MIDI numbers', () => {
    expect(midiToPitchClass(0)).toBe(0);
    expect(midiToPitchClass(11)).toBe(11);
  });
});

describe('midiToOctave', () => {
  it('60 → 4 (C4)', () => {
    expect(midiToOctave(60)).toBe(4);
  });

  it('69 → 4 (A4)', () => {
    expect(midiToOctave(69)).toBe(4);
  });

  it('0 → -1', () => {
    expect(midiToOctave(0)).toBe(-1);
  });

  it('127 → 9', () => {
    expect(midiToOctave(127)).toBe(9);
  });

  it('48 → 3', () => {
    expect(midiToOctave(48)).toBe(3);
  });
});

describe('midiToNoteName', () => {
  it('60 → C4 (default flat)', () => {
    expect(midiToNoteName(60)).toBe('C4');
  });

  it('61 → C#4 when preferFlat=false', () => {
    expect(midiToNoteName(61, false)).toBe('C#4');
  });

  it('61 → Db4 when preferFlat=true', () => {
    expect(midiToNoteName(61, true)).toBe('Db4');
  });

  it('69 → A4', () => {
    expect(midiToNoteName(69)).toBe('A4');
  });

  it('0 → C-1', () => {
    expect(midiToNoteName(0)).toBe('C-1');
  });

  it('127 → G9', () => {
    expect(midiToNoteName(127)).toBe('G9');
  });
});

describe('midiToFreq', () => {
  it('A4 (69) = 440 Hz', () => {
    expect(midiToFreq(69)).toBe(440);
  });

  it('C4 (60) = 261.625... Hz', () => {
    expect(midiToFreq(60)).toBeCloseTo(261.626, 1);
  });

  it('A5 (81) = 880 Hz (one octave up)', () => {
    expect(midiToFreq(81)).toBeCloseTo(880, 0);
  });

  it('A3 (57) = 220 Hz (one octave down)', () => {
    expect(midiToFreq(57)).toBeCloseTo(220, 0);
  });
});

describe('noteToMidi', () => {
  it('C4 → 60', () => {
    expect(noteToMidi('C4')).toBe(60);
  });

  it('A4 → 69', () => {
    expect(noteToMidi('A4')).toBe(69);
  });

  it('Bb3 → 58', () => {
    expect(noteToMidi('Bb3')).toBe(58);
  });

  it('C#4 → 61', () => {
    expect(noteToMidi('C#4')).toBe(61);
  });

  it('Eb3 → 51', () => {
    expect(noteToMidi('Eb3')).toBe(51);
  });

  it('C-1 → 0', () => {
    expect(noteToMidi('C-1')).toBe(0);
  });

  it('throws on invalid format', () => {
    expect(() => noteToMidi('H4')).toThrow();
    expect(() => noteToMidi('C')).toThrow();
    expect(() => noteToMidi('')).toThrow();
    expect(() => noteToMidi('C#')).toThrow();
    expect(() => noteToMidi('4C')).toThrow();
  });
});

describe('transposePitchClass', () => {
  it('wraps around 12 ascending', () => {
    expect(transposePitchClass(10, 5)).toBe(3);
  });

  it('wraps around 12 descending', () => {
    expect(transposePitchClass(2, -3)).toBe(11);
  });

  it('transposes by 0', () => {
    expect(transposePitchClass(5, 0)).toBe(5);
  });

  it('transposes by 12 (full octave)', () => {
    expect(transposePitchClass(3, 12)).toBe(3);
  });

  it('handles negative results correctly', () => {
    expect(transposePitchClass(0, -1)).toBe(11);
    expect(transposePitchClass(0, -12)).toBe(0);
    expect(transposePitchClass(0, -13)).toBe(11);
  });
});

describe('pitchClassDistance', () => {
  it('ascending distance C to G = 7', () => {
    expect(pitchClassDistance(0, 7)).toBe(7);
  });

  it('descending distance G to C = 5', () => {
    expect(pitchClassDistance(7, 0)).toBe(5);
  });

  it('same pitch class = 0', () => {
    expect(pitchClassDistance(5, 5)).toBe(0);
  });

  it('wraps around correctly', () => {
    expect(pitchClassDistance(10, 2)).toBe(4);
    expect(pitchClassDistance(2, 10)).toBe(8);
  });
});

describe('getScalePitchClasses', () => {
  it('C major', () => {
    expect(getScalePitchClasses(0, 'major')).toEqual([0, 2, 4, 5, 7, 9, 11]);
  });

  it('A natural minor', () => {
    expect(getScalePitchClasses(9, 'natural_minor')).toEqual([9, 11, 0, 2, 4, 5, 7]);
  });

  it('C dorian', () => {
    expect(getScalePitchClasses(0, 'dorian')).toEqual([0, 2, 3, 5, 7, 9, 10]);
  });

  it('D major', () => {
    expect(getScalePitchClasses(2, 'major')).toEqual([2, 4, 6, 7, 9, 11, 1]);
  });

  it('default is major', () => {
    expect(getScalePitchClasses(0)).toEqual([0, 2, 4, 5, 7, 9, 11]);
  });

  it('returns 7 pitch classes', () => {
    for (let pc = 0; pc < 12; pc++) {
      expect(getScalePitchClasses(pc, 'major')).toHaveLength(7);
    }
  });

  it('harmonic minor has different interval pattern', () => {
    const hm = getScalePitchClasses(0, 'harmonic_minor');
    expect(hm).toEqual([0, 2, 3, 5, 7, 8, 11]);
  });

  it('melodic minor', () => {
    expect(getScalePitchClasses(0, 'melodic_minor')).toEqual([0, 2, 3, 5, 7, 9, 11]);
  });

  it('phrygian', () => {
    expect(getScalePitchClasses(0, 'phrygian')).toEqual([0, 1, 3, 5, 7, 8, 10]);
  });

  it('lydian', () => {
    expect(getScalePitchClasses(0, 'lydian')).toEqual([0, 2, 4, 6, 7, 9, 11]);
  });

  it('mixolydian', () => {
    expect(getScalePitchClasses(0, 'mixolydian')).toEqual([0, 2, 4, 5, 7, 9, 10]);
  });

  it('locrian', () => {
    expect(getScalePitchClasses(0, 'locrian')).toEqual([0, 1, 3, 5, 6, 8, 10]);
  });
});

describe('isDiatonicToKey', () => {
  it('C is diatonic to C major', () => {
    expect(isDiatonicToKey(0, 0, 'major')).toBe(true);
  });

  it('F# is not diatonic to C major', () => {
    expect(isDiatonicToKey(6, 0, 'major')).toBe(false);
  });

  it('Eb is not diatonic to C major', () => {
    expect(isDiatonicToKey(3, 0, 'major')).toBe(false);
  });

  it('Eb is diatonic to Eb major', () => {
    expect(isDiatonicToKey(3, 3, 'major')).toBe(true);
  });

  it('Bb is diatonic to Bb major', () => {
    expect(isDiatonicToKey(10, 10, 'major')).toBe(true);
  });

  it('works for minor scales', () => {
    expect(isDiatonicToKey(0, 9, 'natural_minor')).toBe(true);
    expect(isDiatonicToKey(1, 9, 'natural_minor')).toBe(false);
  });

  it('default scale type is major', () => {
    expect(isDiatonicToKey(0, 0)).toBe(true);
    expect(isDiatonicToKey(6, 0)).toBe(false);
  });

  it('all notes in a scale are diatonic to that key', () => {
    const scale = getScalePitchClasses(5, 'major');
    for (const pc of scale) {
      expect(isDiatonicToKey(pc, 5, 'major')).toBe(true);
    }
  });

  it('chromatic notes not in scale are not diatonic', () => {
    const scale = getScalePitchClasses(0, 'major');
    const chromatic = ALL_PITCH_CLASSES.filter(pc => !scale.includes(pc));
    for (const pc of chromatic) {
      expect(isDiatonicToKey(pc, 0, 'major')).toBe(false);
    }
  });
});

describe('CHORD_QUALITIES', () => {
  it('has major (empty string)', () => {
    expect(CHORD_QUALITIES['']).toBeDefined();
    expect(CHORD_QUALITIES[''].intervals).toEqual([0, 4, 7]);
  });

  it('has minor (m)', () => {
    expect(CHORD_QUALITIES['m']).toBeDefined();
    expect(CHORD_QUALITIES['m'].intervals).toEqual([0, 3, 7]);
  });

  it('has dim', () => {
    expect(CHORD_QUALITIES['dim'].intervals).toEqual([0, 3, 6]);
  });

  it('has aug', () => {
    expect(CHORD_QUALITIES['aug'].intervals).toEqual([0, 4, 8]);
  });

  it('has sus4', () => {
    expect(CHORD_QUALITIES['sus4'].intervals).toEqual([0, 5, 7]);
  });

  it('has sus2', () => {
    expect(CHORD_QUALITIES['sus2'].intervals).toEqual([0, 2, 7]);
  });

  it('has maj7', () => {
    expect(CHORD_QUALITIES['maj7'].intervals).toEqual([0, 4, 7, 11]);
  });

  it('has m7', () => {
    expect(CHORD_QUALITIES['m7'].intervals).toEqual([0, 3, 7, 10]);
  });

  it('has 7', () => {
    expect(CHORD_QUALITIES['7'].intervals).toEqual([0, 4, 7, 10]);
  });

  it('has 9', () => {
    expect(CHORD_QUALITIES['9'].intervals).toEqual([0, 4, 7, 10, 14]);
  });

  it('has 13', () => {
    expect(CHORD_QUALITIES['13'].intervals).toEqual([0, 4, 7, 10, 14, 21]);
  });

  it('has all expected qualities', () => {
    const expected = [
      '', 'm', 'dim', 'aug', 'sus4', 'sus2',
      '6', 'm6', '6/9',
      'maj7', 'maj9', 'maj13',
      '7', '9', '13', '7b9', '7#9', '7#11', '7b13', '9sus4', '7sus4', '13sus4', '7#9#5', 'alt',
      'm7', 'm9', 'm11', 'm7b5', 'dim7',
      'mMaj7', 'mMaj9',
      'add9', 'madd9',
    ];
    for (const q of expected) {
      expect(CHORD_QUALITIES[q]).toBeDefined();
    }
  });
});

describe('chordTonesForQuality', () => {
  it('C major triad', () => {
    expect(chordTonesForQuality(0, '')).toEqual([0, 4, 7]);
  });

  it('C minor triad', () => {
    expect(chordTonesForQuality(0, 'm')).toEqual([0, 3, 7]);
  });

  it('D major triad', () => {
    expect(chordTonesForQuality(2, '')).toEqual([2, 6, 9]);
  });

  it('C dim triad', () => {
    expect(chordTonesForQuality(0, 'dim')).toEqual([0, 3, 6]);
  });

  it('C aug triad', () => {
    expect(chordTonesForQuality(0, 'aug')).toEqual([0, 4, 8]);
  });

  it('C maj7', () => {
    expect(chordTonesForQuality(0, 'maj7')).toEqual([0, 4, 7, 11]);
  });

  it('C m7', () => {
    expect(chordTonesForQuality(0, 'm7')).toEqual([0, 3, 7, 10]);
  });

  it('C dom7', () => {
    expect(chordTonesForQuality(0, '7')).toEqual([0, 4, 7, 10]);
  });

  it('falls back to major for unknown quality', () => {
    expect(chordTonesForQuality(0, 'unknown')).toEqual(chordTonesForQuality(0, ''));
  });

  it('wraps around 12 for higher root pitch classes', () => {
    const result = chordTonesForQuality(10, '');
    expect(result).toEqual([10, 2, 5]);
  });
});

describe('essentialChordTonesForQuality', () => {
  it('returns essential tones for major triad', () => {
    const essential = essentialChordTonesForQuality(0, '');
    expect(essential).toEqual([0, 4, 7]);
  });

  it('returns essential tones for minor triad', () => {
    const essential = essentialChordTonesForQuality(0, 'm');
    expect(essential).toEqual([0, 3, 7]);
  });

  it('returns essential tones for maj7', () => {
    const essential = essentialChordTonesForQuality(0, 'maj7');
    const all = chordTonesForQuality(0, 'maj7');
    expect(essential).toEqual([all[0], all[1], all[3]]);
  });

  it('returns essential tones for dom7', () => {
    const essential = essentialChordTonesForQuality(0, '7');
    const all = chordTonesForQuality(0, '7');
    expect(essential).toEqual([all[0], all[1], all[3]]);
  });

  it('falls back to major for unknown quality', () => {
    expect(essentialChordTonesForQuality(0, 'unknown')).toEqual(
      essentialChordTonesForQuality(0, ''),
    );
  });
});

describe('isDominantQuality', () => {
  it('returns true for dominant qualities', () => {
    expect(isDominantQuality('7')).toBe(true);
    expect(isDominantQuality('9')).toBe(true);
    expect(isDominantQuality('13')).toBe(true);
    expect(isDominantQuality('7b9')).toBe(true);
    expect(isDominantQuality('7#9')).toBe(true);
    expect(isDominantQuality('7#11')).toBe(true);
    expect(isDominantQuality('7b13')).toBe(true);
    expect(isDominantQuality('9sus4')).toBe(true);
    expect(isDominantQuality('7sus4')).toBe(true);
    expect(isDominantQuality('13sus4')).toBe(true);
    expect(isDominantQuality('7#9#5')).toBe(true);
    expect(isDominantQuality('alt')).toBe(true);
  });

  it('returns false for non-dominant qualities', () => {
    expect(isDominantQuality('')).toBe(false);
    expect(isDominantQuality('m')).toBe(false);
    expect(isDominantQuality('maj7')).toBe(false);
    expect(isDominantQuality('m7')).toBe(false);
    expect(isDominantQuality('dim')).toBe(false);
    expect(isDominantQuality('aug')).toBe(false);
  });
});

describe('isMajorQuality', () => {
  it('returns true for major qualities', () => {
    expect(isMajorQuality('')).toBe(true);
    expect(isMajorQuality('6')).toBe(true);
    expect(isMajorQuality('6/9')).toBe(true);
    expect(isMajorQuality('maj7')).toBe(true);
    expect(isMajorQuality('maj9')).toBe(true);
    expect(isMajorQuality('maj13')).toBe(true);
    expect(isMajorQuality('add9')).toBe(true);
    expect(isMajorQuality('sus4')).toBe(true);
    expect(isMajorQuality('sus2')).toBe(true);
  });

  it('returns false for non-major qualities', () => {
    expect(isMajorQuality('m')).toBe(false);
    expect(isMajorQuality('7')).toBe(false);
    expect(isMajorQuality('m7')).toBe(false);
    expect(isMajorQuality('dim')).toBe(false);
    expect(isMajorQuality('aug')).toBe(false);
  });
});

describe('isMinorQuality', () => {
  it('returns true for minor qualities', () => {
    expect(isMinorQuality('m')).toBe(true);
    expect(isMinorQuality('m6')).toBe(true);
    expect(isMinorQuality('m7')).toBe(true);
    expect(isMinorQuality('m9')).toBe(true);
    expect(isMinorQuality('m11')).toBe(true);
    expect(isMinorQuality('m7b5')).toBe(true);
    expect(isMinorQuality('dim')).toBe(true);
    expect(isMinorQuality('dim7')).toBe(true);
    expect(isMinorQuality('mMaj7')).toBe(true);
    expect(isMinorQuality('mMaj9')).toBe(true);
    expect(isMinorQuality('madd9')).toBe(true);
    expect(isMinorQuality('aug')).toBe(true);
  });

  it('returns false for non-minor qualities', () => {
    expect(isMinorQuality('')).toBe(false);
    expect(isMinorQuality('7')).toBe(false);
    expect(isMinorQuality('maj7')).toBe(false);
    expect(isMinorQuality('6')).toBe(false);
    expect(isMinorQuality('sus4')).toBe(false);
  });
});

describe('chordTonesAsMidi', () => {
  it('C major triad in octave 4', () => {
    const result = chordTonesAsMidi(0, '', 4);
    expect(result).toEqual([60, 64, 67]);
  });

  it('C minor triad in octave 4', () => {
    const result = chordTonesAsMidi(0, 'm', 4);
    expect(result).toEqual([60, 63, 67]);
  });

  it('A4 = 69', () => {
    const result = chordTonesAsMidi(9, '', 4);
    expect(result[0]).toBe(69);
  });

  it('uses default octave 4', () => {
    const result = chordTonesAsMidi(0, '');
    expect(result).toEqual([60, 64, 67]);
  });

  it('works with different octaves', () => {
    const result3 = chordTonesAsMidi(0, '', 3);
    expect(result3).toEqual([48, 52, 55]);
    const result5 = chordTonesAsMidi(0, '', 5);
    expect(result5).toEqual([72, 76, 79]);
  });

  it('maj7 includes 7th', () => {
    const result = chordTonesAsMidi(0, 'maj7', 4);
    expect(result).toEqual([60, 64, 67, 71]);
  });

  it('dom7 includes b7', () => {
    const result = chordTonesAsMidi(0, '7', 4);
    expect(result).toEqual([60, 64, 67, 70]);
  });

  it('extensions (9th) go into higher octave', () => {
    const result = chordTonesAsMidi(0, '9', 4);
    expect(result[0]).toBe(60);
    expect(result[4]).toBe(74);
  });

  it('13th chord includes compound interval', () => {
    const result = chordTonesAsMidi(0, '13', 4);
    expect(result[0]).toBe(60);
    expect(result[5]).toBe(81);
  });

  it('falls back to major for unknown quality', () => {
    expect(chordTonesAsMidi(0, 'unknown', 4)).toEqual(chordTonesAsMidi(0, '', 4));
  });
});
