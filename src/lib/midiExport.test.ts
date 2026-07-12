import { describe, it, expect, vi, beforeEach } from 'vitest';
import { generateMIDI, downloadMIDI } from './midiExport';
import type { GeneratedSection } from './engine';

function makeSection(overrides?: Partial<GeneratedSection>): GeneratedSection {
  return {
    id: 'test',
    name: 'Test',
    def: { id: 'test', name: 'Test', preset: 'pop' as any, lengthBars: 4, beatsPerBar: 4 },
    chords: [
      {
        bar: 1,
        beat: 1,
        roman: 'I',
        chordName: 'C',
        pianoVoicing: { notes: [60, 64, 67, 72] },
        bassNote: { midi: 36 },
      },
    ],
    drumPattern: {
      grid: {
        Kick: [
          true, false, false, false, true, false, false, false,
          true, false, false, false, true, false, false, false,
          true, false, false, false, true, false, false, false,
          true, false, false, false, true, false, false, false,
        ],
      },
    },
    ...overrides,
  };
}

function findSubarray(haystack: Uint8Array, needle: number[], start = 0): number {
  for (let i = start; i <= haystack.length - needle.length; i++) {
    let match = true;
    for (let j = 0; j < needle.length; j++) {
      if (haystack[i + j] !== needle[j]) { match = false; break; }
    }
    if (match) return i;
  }
  return -1;
}

describe('generateMIDI', () => {
  let result: Uint8Array;

  beforeEach(() => {
    result = generateMIDI([makeSection()], 120, 'C');
  });

  it('returns a Uint8Array', () => {
    expect(result).toBeInstanceOf(Uint8Array);
  });

  it('starts with MThd header bytes', () => {
    expect(result[0]).toBe(0x4d);
    expect(result[1]).toBe(0x54);
    expect(result[2]).toBe(0x68);
    expect(result[3]).toBe(0x64);
  });

  it('contains format type 1 in header', () => {
    const format = (result[8] << 8) | result[9];
    expect(format).toBe(1);
  });

  it('contains correct number of tracks in header (5 tracks)', () => {
    const numTracks = (result[10] << 8) | result[11];
    expect(numTracks).toBe(5);
  });

  it('contains MTrk markers for note tracks', () => {
    let count = 0;
    let pos = 0;
    while (pos < result.length) {
      const idx = findSubarray(result, [0x4d, 0x54, 0x72, 0x6b], pos);
      if (idx === -1) break;
      count++;
      pos = idx + 4;
    }
    expect(count).toBeGreaterThanOrEqual(4);
  });

  it('produces valid header with empty sections array', () => {
    const empty = generateMIDI([], 120, 'C');
    expect(empty[0]).toBe(0x4d);
    expect(empty[1]).toBe(0x54);
    expect(empty[2]).toBe(0x68);
    expect(empty[3]).toBe(0x64);
    const numTracks = (empty[10] << 8) | empty[11];
    expect(numTracks).toBe(5);
  });

  it('produces note events when section has chords', () => {
    const section = makeSection();
    const midi = generateMIDI([section], 120, 'C');
    const noteOn = 0x90;
    let found = false;
    for (let i = 0; i < midi.length; i++) {
      if (midi[i] === noteOn) { found = true; break; }
    }
    expect(found).toBe(true);
  });

  it('encodes key signature byte correctly for C (0)', () => {
    const keySigEvent = [0x00, 0xff, 0x59, 0x02, 0x00, 0x00];
    const idx = findSubarray(result, keySigEvent);
    expect(idx).not.toBe(-1);
    expect(result[idx + 4]).toBe(0x00);
  });

  it('encodes key signature byte correctly for G (1)', () => {
    const midi = generateMIDI([makeSection()], 120, 'G');
    const keySigEvent = [0x00, 0xff, 0x59, 0x02, 0x01, 0x00];
    const idx = findSubarray(midi, keySigEvent);
    expect(idx).not.toBe(-1);
    expect(midi[idx + 4]).toBe(0x01);
  });

  it('encodes key signature byte correctly for F (1 flat = 0x7F via & 0x7f mask)', () => {
    const midi = generateMIDI([makeSection()], 120, 'F');
    const keySigEvent = [0x00, 0xff, 0x59, 0x02, 0x7f, 0x00];
    const idx = findSubarray(midi, keySigEvent);
    expect(idx).not.toBe(-1);
    expect(midi[idx + 4]).toBe(0x7f);
  });

  it('encodes tempo event with correct BPM', () => {
    const usPerBeat = Math.round(60000000 / 120);
    const tempoEvent = [
      0x00, 0xff, 0x51, 0x03,
      (usPerBeat >> 16) & 0xff,
      (usPerBeat >> 8) & 0xff,
      usPerBeat & 0xff,
    ];
    const idx = findSubarray(result, tempoEvent);
    expect(idx).not.toBe(-1);
  });
});

describe('downloadMIDI', () => {
  it('creates an anchor element and triggers download', () => {
    const midiData = new Uint8Array([0x4d, 0x54, 0x68, 0x64]);
    const clickSpy = vi.fn();

    const originalCreateElement = document.createElement.bind(document);
    vi.spyOn(document, 'createElement').mockImplementation((tag: string) => {
      if (tag === 'a') {
        const el = originalCreateElement('a');
        el.click = clickSpy;
        return el;
      }
      return originalCreateElement(tag);
    });

    const revokeSpy = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});

    downloadMIDI(midiData, 'test.mid');

    expect(clickSpy).toHaveBeenCalled();
    expect(revokeSpy).toHaveBeenCalled();

    vi.restoreAllMocks();
  });
});
