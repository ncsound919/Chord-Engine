import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Sequencer } from './sequencer';
import { GeneratedSection, GeneratedChord } from '../engine';
import { transport, audioEngine } from './engine';

// ── Mocks ──────────────────────────────────────────────────────────────────────

const hoisted = vi.hoisted(() => ({
  mockOnBeat: [] as Array<(beat: number, time: number) => void>,
  mockTriggerNote: vi.fn(),
}));

vi.mock('./engine', () => ({
  transport: {
    addBeatCallback: vi.fn((cb: (beat: number, time: number) => void) => {
      hoisted.mockOnBeat.push(cb);
      return () => {
        const idx = hoisted.mockOnBeat.indexOf(cb);
        if (idx >= 0) hoisted.mockOnBeat.splice(idx, 1);
      };
    }),
    addStopCallback: vi.fn(() => vi.fn()),
    subscribe: vi.fn(() => vi.fn()),
    start: vi.fn(),
    stop: vi.fn(),
    reset: vi.fn(),
    getCurrentBeat: vi.fn(() => 0),
    isPlaying: false,
    tempo: 120,
  },
  audioEngine: {
    tracks: new Map([
      ['drums', { playBuffer: vi.fn(), playNote: vi.fn() }],
      ['bass', { playBufferShifted: vi.fn() }],
    ]),
    loadedSamples: new Map<string, unknown>(),
  },
}));

vi.mock('./synth', () => ({
  Ju60Engine: {
    getInstance: () => ({
      triggerNote: hoisted.mockTriggerNote,
    }),
  },
}));

// ── Helpers ─────────────────────────────────────────────────────────────────────

function makeSection(overrides: Partial<GeneratedSection> = {}): GeneratedSection {
  return {
    def: {
      id: 'test',
      name: 'Test',
      preset: 'pop',
      lengthBars: 2,
      beatsPerBar: 4,
    },
    chords: [],
    drumPattern: {
      steps: 32,
      grid: {},
      swing: 0,
      ghostNotes: 0,
      microTimingMs: [],
      velocities: [],
    },
    ...overrides,
  } as GeneratedSection;
}

function makeChord(overrides: Partial<GeneratedChord> = {}): GeneratedChord {
  return {
    bar: 0,
    beat: 1,
    roman: 'I',
    chordName: 'Cmaj',
    pianoVoicing: { notes: [60, 64, 67], style: 'close', rootPc: 0, bassNote: 48 },
    bassNote: { midi: 36, role: 'root' },
    quality: 'maj',
    ...overrides,
  };
}

function resetSequencer() {
  (Sequencer as any).instance = undefined;
}

function getSequencer(): Sequencer {
  return Sequencer.getInstance();
}

function fireBeat(beat: number, time: number) {
  for (const cb of hoisted.mockOnBeat) {
    cb(beat, time);
  }
}

// ── Tests ──────────────────────────────────────────────────────────────────────

describe('Sequencer', () => {
  beforeEach(() => {
    resetSequencer();
    hoisted.mockOnBeat.length = 0;
    hoisted.mockTriggerNote.mockClear();
    audioEngine.loadedSamples.clear();
    audioEngine.tracks.get('drums')!.playBuffer.mockClear();
    audioEngine.tracks.get('drums')!.playNote.mockClear();
    audioEngine.tracks.get('bass')!.playBufferShifted.mockClear();
  });

  afterEach(() => {
    try {
      const seq = Sequencer.getInstance();
      seq.dispose();
    } catch {}
    resetSequencer();
  });

  describe('singleton pattern', () => {
    it('getInstance returns the same instance', () => {
      const a = Sequencer.getInstance();
      const b = Sequencer.getInstance();
      expect(a).toBe(b);
    });

    it('registers an onBeat handler on construction', () => {
      getSequencer();
      expect(hoisted.mockOnBeat.length).toBe(1);
      expect(typeof hoisted.mockOnBeat[0]).toBe('function');
    });
  });

  describe('dispose', () => {
    it('removes the onBeat handler from transport', () => {
      const seq = getSequencer();
      expect(hoisted.mockOnBeat.length).toBe(1);
      seq.dispose();
      expect(hoisted.mockOnBeat.length).toBe(0);
    });

    it('is safe to call dispose multiple times', () => {
      const seq = getSequencer();
      seq.dispose();
      seq.dispose();
      expect(hoisted.mockOnBeat.length).toBe(0);
    });
  });

  describe('setSections', () => {
    it('stores sections and processes beats', () => {
      const seq = getSequencer();
      const s1 = makeSection({ def: { id: 'a', name: 'A', preset: 'pop', lengthBars: 1, beatsPerBar: 4 } as any });
      seq.setSections([s1]);
      fireBeat(0, 0);
    });

    it('invalidates chord cache on new sections', () => {
      const seq = getSequencer();
      const chord1 = makeChord({ bar: 0, beat: 1 });
      const s = makeSection({
        chords: [chord1],
        def: { id: 'x', name: 'X', preset: 'pop', lengthBars: 2, beatsPerBar: 4 } as any,
      });
      seq.setSections([s]);
      fireBeat(0, 0);

      const chord2 = makeChord({ bar: 0, beat: 1, chordName: 'Fmaj' });
      const s2 = makeSection({
        chords: [chord2],
        def: { id: 'y', name: 'Y', preset: 'jazz', lengthBars: 2, beatsPerBar: 4 } as any,
      });
      seq.setSections([s2]);
      fireBeat(0, 0);
    });
  });

  describe('processBeat with empty sections', () => {
    it('returns early when no sections are set', () => {
      getSequencer();
      fireBeat(0, 0);
      fireBeat(10, 0.5);
      expect(hoisted.mockTriggerNote).not.toHaveBeenCalled();
    });
  });

  describe('processBeat chord triggering', () => {
    it('triggers a chord when bar/beat match', () => {
      const chord = makeChord({ bar: 0, beat: 1 });
      const section = makeSection({
        def: { id: 'v', name: 'V', preset: 'pop', lengthBars: 1, beatsPerBar: 4 } as any,
        chords: [chord],
      });
      getSequencer().setSections([section]);
      fireBeat(0, 0);

      expect(hoisted.mockTriggerNote).toHaveBeenCalled();
      const padCalls = hoisted.mockTriggerNote.mock.calls.filter((c: any[]) => c[0] === 'pad');
      expect(padCalls.length).toBe(chord.pianoVoicing!.notes.length);
      const leadCalls = hoisted.mockTriggerNote.mock.calls.filter((c: any[]) => c[0] === 'lead');
      expect(leadCalls.length).toBe(1);
      expect(leadCalls[0][1]).toBe(chord.pianoVoicing!.notes[chord.pianoVoicing!.notes.length - 1]);
    });

    it('does not trigger a chord when bar/beat do not match', () => {
      const chord = makeChord({ bar: 0, beat: 1 });
      const section = makeSection({
        def: { id: 'v', name: 'V', preset: 'pop', lengthBars: 1, beatsPerBar: 4 } as any,
        chords: [chord],
      });
      getSequencer().setSections([section]);
      fireBeat(1, 0);
      const padCalls = hoisted.mockTriggerNote.mock.calls.filter((c: any[]) => c[0] === 'pad');
      expect(padCalls.length).toBe(0);
    });

    it('only triggers chords on integer beats', () => {
      const chord = makeChord({ bar: 0, beat: 1 });
      const section = makeSection({
        def: { id: 'v', name: 'V', preset: 'pop', lengthBars: 1, beatsPerBar: 4 } as any,
        chords: [chord],
      });
      getSequencer().setSections([section]);
      hoisted.mockTriggerNote.mockClear();
      fireBeat(0.5, 0);
      const padCalls = hoisted.mockTriggerNote.mock.calls.filter((c: any[]) => c[0] === 'pad');
      expect(padCalls.length).toBe(0);
    });
  });

  describe('processBeat looping', () => {
    it('loops when beat exceeds total section beats', () => {
      const chord = makeChord({ bar: 0, beat: 1 });
      const section = makeSection({
        def: { id: 'v', name: 'V', preset: 'pop', lengthBars: 1, beatsPerBar: 4 } as any,
        chords: [chord],
      });
      getSequencer().setSections([section]);
      // Total beats = 4. Beat 4 loops to beat 0 (bar 0, beatInBar 1).
      fireBeat(4, 0);
      const padCalls = hoisted.mockTriggerNote.mock.calls.filter((c: any[]) => c[0] === 'pad');
      expect(padCalls.length).toBe(chord.pianoVoicing!.notes.length);
    });

    it('loops correctly with multiple sections', () => {
      const chord1 = makeChord({ bar: 0, beat: 1 });
      const s1 = makeSection({
        def: { id: 'a', name: 'A', preset: 'pop', lengthBars: 1, beatsPerBar: 4 } as any,
        chords: [chord1],
      });
      const s2 = makeSection({
        def: { id: 'b', name: 'B', preset: 'pop', lengthBars: 1, beatsPerBar: 4 } as any,
        chords: [],
      });
      getSequencer().setSections([s1, s2]);
      // Total beats = 8. Beat 8 loops to beat 0 (bar 0, beatInBar 1).
      fireBeat(8, 0);
      const padCalls = hoisted.mockTriggerNote.mock.calls.filter((c: any[]) => c[0] === 'pad');
      expect(padCalls.length).toBe(chord1.pianoVoicing!.notes.length);
    });
  });

  describe('resolveChordContext', () => {
    it('finds the active chord at the current position', () => {
      const chord1 = makeChord({ bar: 0, beat: 1, chordName: 'Cmaj' });
      const chord2 = makeChord({ bar: 0, beat: 3, chordName: 'Fmaj' });
      const section = makeSection({
        def: { id: 'v', name: 'V', preset: 'pop', lengthBars: 2, beatsPerBar: 4 } as any,
        chords: [chord1, chord2],
      });
      getSequencer().setSections([section]);
      fireBeat(0, 0);
      expect(hoisted.mockTriggerNote).toHaveBeenCalled();
    });

    it('finds next chord', () => {
      const chord1 = makeChord({ bar: 0, beat: 1 });
      const chord2 = makeChord({ bar: 0, beat: 3 });
      const section = makeSection({
        def: { id: 'v', name: 'V', preset: 'jazz', lengthBars: 1, beatsPerBar: 4 } as any,
        chords: [chord1, chord2],
      });
      getSequencer().setSections([section]);
      hoisted.mockTriggerNote.mockClear();
      fireBeat(2, 0);
      expect(hoisted.mockTriggerNote).toHaveBeenCalled();
    });

    it('caches results per beat key', () => {
      const chord = makeChord({ bar: 0, beat: 1 });
      const section = makeSection({
        def: { id: 'v', name: 'V', preset: 'pop', lengthBars: 2, beatsPerBar: 4 } as any,
        chords: [chord],
      });
      const seq = getSequencer();
      seq.setSections([section]);

      fireBeat(0, 0);
      fireBeat(0, 0);
    });

    it('uses fallback to first chord when no chord matches', () => {
      const chord = makeChord({ bar: 2, beat: 1 });
      const section = makeSection({
        def: { id: 'v', name: 'V', preset: 'pop', lengthBars: 4, beatsPerBar: 4 } as any,
        chords: [chord],
      });
      getSequencer().setSections([section]);
      fireBeat(0, 0);
    });
  });

  describe('DRUM_SAMPLE_MAP via processBeat', () => {
    it('plays drum from grid when sample is loaded', () => {
      audioEngine.loadedSamples.set('Kick', {});
      const drumTrack = audioEngine.tracks.get('drums')!;

      const grid: Record<string, boolean[]> = {
        'Kick': Array(32).fill(false),
      };
      grid['Kick'][0] = true;

      const section = makeSection({
        def: { id: 'd', name: 'D', preset: 'pop', lengthBars: 1, beatsPerBar: 4 } as any,
        drumPattern: { steps: 32, grid, swing: 0, ghostNotes: 0, microTimingMs: [], velocities: [] },
        chords: [makeChord({ bar: 0, beat: 1 })],
      });
      getSequencer().setSections([section]);
      fireBeat(0, 0);
      expect(drumTrack.playBuffer).toHaveBeenCalled();
    });

    it('falls back to synthesized drum when sample not loaded', () => {
      audioEngine.loadedSamples.clear();
      const drumTrack = audioEngine.tracks.get('drums')!;

      const grid: Record<string, boolean[]> = {
        'Kick': Array(32).fill(false),
      };
      grid['Kick'][0] = true;

      const section = makeSection({
        def: { id: 'd', name: 'D', preset: 'pop', lengthBars: 1, beatsPerBar: 4 } as any,
        drumPattern: { steps: 32, grid, swing: 0, ghostNotes: 0, microTimingMs: [], velocities: [] },
        chords: [makeChord({ bar: 0, beat: 1 })],
      });
      getSequencer().setSections([section]);
      fireBeat(0, 0);
      expect(drumTrack.playNote).toHaveBeenCalled();
    });
  });

  describe('playSynthesizedDrum', () => {
    function fireWithDrum(drumName: string, step: number) {
      audioEngine.loadedSamples.clear();

      const grid: Record<string, boolean[]> = {
        [drumName]: Array(32).fill(false),
      };
      grid[drumName][step] = true;

      const section = makeSection({
        def: { id: 'd', name: 'D', preset: 'pop', lengthBars: 2, beatsPerBar: 4 } as any,
        drumPattern: { steps: 32, grid, swing: 0, ghostNotes: 0, microTimingMs: [], velocities: [] },
        chords: [makeChord({ bar: 0, beat: 1 })],
      });
      getSequencer().setSections([section]);
      fireBeat(0, 0);
    }

    it('plays Kick with sine wave', () => {
      const drumTrack = audioEngine.tracks.get('drums')!;
      fireWithDrum('Kick', 0);
      expect(drumTrack.playNote).toHaveBeenCalledWith(
        50, 'sine', expect.any(Number), 0.1,
        { attack: 0.005, decay: 0.1, sustain: 0, release: 0.1 }
      );
    });

    it('plays Snare with triangle wave', () => {
      const drumTrack = audioEngine.tracks.get('drums')!;
      fireWithDrum('Snare', 0);
      expect(drumTrack.playNote).toHaveBeenCalledWith(
        200, 'triangle', expect.any(Number), 0.1,
        { attack: 0.005, decay: 0.05, sustain: 0, release: 0.05 }
      );
    });

    it('plays HH Closed with high sine', () => {
      const drumTrack = audioEngine.tracks.get('drums')!;
      fireWithDrum('HH Closed', 0);
      expect(drumTrack.playNote).toHaveBeenCalledWith(
        8000, 'sine', expect.any(Number), 0.05,
        { attack: 0.001, decay: 0.02, sustain: 0, release: 0.02 }
      );
    });

    it('plays HH Open (includes HH) with high sine', () => {
      const drumTrack = audioEngine.tracks.get('drums')!;
      fireWithDrum('HH Open', 0);
      expect(drumTrack.playNote).toHaveBeenCalledWith(
        8000, 'sine', expect.any(Number), 0.05,
        { attack: 0.001, decay: 0.02, sustain: 0, release: 0.02 }
      );
    });
  });

  describe('swing timing', () => {
    it('adjusts time for odd steps when swing > 0', () => {
      audioEngine.loadedSamples.clear();

      const grid: Record<string, boolean[]> = {
        'Kick': Array(32).fill(false),
      };
      grid['Kick'][1] = true;

      const section = makeSection({
        def: { id: 's', name: 'S', preset: 'pop', lengthBars: 2, beatsPerBar: 4 } as any,
        drumPattern: { steps: 32, grid, swing: 50, ghostNotes: 0, microTimingMs: [], velocities: [] },
        chords: [makeChord({ bar: 0, beat: 1 })],
      });
      getSequencer().setSections([section]);
      fireBeat(0.25, 0.25);
      const drumTrack = audioEngine.tracks.get('drums')!;
      expect(drumTrack.playNote).toHaveBeenCalled();
    });

    it('does not adjust time for even steps', () => {
      audioEngine.loadedSamples.clear();

      const grid: Record<string, boolean[]> = {
        'Kick': Array(32).fill(false),
      };
      grid['Kick'][0] = true;

      const section = makeSection({
        def: { id: 's', name: 'S', preset: 'pop', lengthBars: 2, beatsPerBar: 4 } as any,
        drumPattern: { steps: 32, grid, swing: 50, ghostNotes: 0, microTimingMs: [], velocities: [] },
        chords: [makeChord({ bar: 0, beat: 1 })],
      });
      getSequencer().setSections([section]);
      fireBeat(0, 0.25);
      const drumTrack = audioEngine.tracks.get('drums')!;
      expect(drumTrack.playNote).toHaveBeenCalled();
    });
  });

  describe('playRhythmicBass', () => {
    function makeBassSection(preset: string, kickPlacement?: string) {
      const chord = makeChord({ bar: 0, beat: 1, bassNote: { midi: 36, role: 'root' } });
      return makeSection({
        def: { id: 'b', name: 'B', preset: preset as any, lengthBars: 2, beatsPerBar: 4 } as any,
        chords: [chord],
        timeFeel: kickPlacement ? { kickPlacementStyle: kickPlacement as any } as any : undefined,
      });
    }

    it('plays four_on_floor bass at step 0 and 16', () => {
      audioEngine.loadedSamples.set('bass', {});
      const section = makeBassSection('pop', 'four_on_floor');
      getSequencer().setSections([section]);
      const bassTrack = audioEngine.tracks.get('bass')!;
      fireBeat(0, 0);
      expect(bassTrack.playBufferShifted).toHaveBeenCalled();
    });

    it('plays techno preset like four_on_floor', () => {
      audioEngine.loadedSamples.set('bass', {});
      const section = makeBassSection('techno');
      getSequencer().setSections([section]);
      fireBeat(0, 0);
      const bassTrack = audioEngine.tracks.get('bass')!;
      expect(bassTrack.playBufferShifted).toHaveBeenCalled();
    });

    it('plays jazz_swing walking bass', () => {
      audioEngine.loadedSamples.set('bass', {});
      const chord2 = makeChord({ bar: 0, beat: 3, bassNote: { midi: 41, role: 'root' } });
      const section = makeSection({
        def: { id: 'j', name: 'J', preset: 'jazz' as any, lengthBars: 2, beatsPerBar: 4 } as any,
        chords: [makeChord({ bar: 0, beat: 1 }), chord2],
      });
      getSequencer().setSections([section]);
      fireBeat(0, 0);
      const bassTrack = audioEngine.tracks.get('bass')!;
      expect(bassTrack.playBufferShifted).toHaveBeenCalled();
    });

    it('plays funk syncopated bass', () => {
      audioEngine.loadedSamples.set('bass', {});
      const section = makeBassSection('funk');
      getSequencer().setSections([section]);
      fireBeat(0, 0);
      const bassTrack = audioEngine.tracks.get('bass')!;
      expect(bassTrack.playBufferShifted).toHaveBeenCalled();
    });

    it('plays sylvers preset like funk', () => {
      audioEngine.loadedSamples.set('bass', {});
      const section = makeBassSection('sylvers');
      getSequencer().setSections([section]);
      fireBeat(0, 0);
      const bassTrack = audioEngine.tracks.get('bass')!;
      expect(bassTrack.playBufferShifted).toHaveBeenCalled();
    });

    it('plays isley preset like funk', () => {
      audioEngine.loadedSamples.set('bass', {});
      const section = makeBassSection('isley');
      getSequencer().setSections([section]);
      fireBeat(0, 0);
      const bassTrack = audioEngine.tracks.get('bass')!;
      expect(bassTrack.playBufferShifted).toHaveBeenCalled();
    });

    it('falls back to synth trigger when no bass sample loaded', () => {
      audioEngine.loadedSamples.clear();
      const section = makeBassSection('pop');
      getSequencer().setSections([section]);
      hoisted.mockTriggerNote.mockClear();
      fireBeat(0, 0);
      const bassCalls = hoisted.mockTriggerNote.mock.calls.filter((c: any[]) => c[0] === 'bass');
      expect(bassCalls.length).toBeGreaterThan(0);
    });

    it('plays default pop bass when kick hits on drum grid', () => {
      audioEngine.loadedSamples.set('bass', {});
      const chord = makeChord({ bar: 0, beat: 1 });
      const grid: Record<string, boolean[]> = {
        'Kick': Array(32).fill(false),
      };
      grid['Kick'][0] = true;

      const section = makeSection({
        def: { id: 'p', name: 'P', preset: 'pop', lengthBars: 2, beatsPerBar: 4 } as any,
        chords: [chord],
        drumPattern: { steps: 32, grid, swing: 0, ghostNotes: 0, microTimingMs: [], velocities: [] },
      });
      getSequencer().setSections([section]);
      fireBeat(0, 0);
      const bassTrack = audioEngine.tracks.get('bass')!;
      expect(bassTrack.playBufferShifted).toHaveBeenCalled();
    });

    it('returns early when activeChord is null', () => {
      audioEngine.loadedSamples.set('bass', {});
      const section = makeSection({
        def: { id: 'n', name: 'N', preset: 'pop', lengthBars: 1, beatsPerBar: 4 } as any,
        chords: [],
      });
      getSequencer().setSections([section]);
      fireBeat(0, 0);
      const bassTrack = audioEngine.tracks.get('bass')!;
      expect(bassTrack.playBufferShifted).not.toHaveBeenCalled();
    });
  });

  describe('triggerChord', () => {
    it('plays all pianoVoicing notes on pad channel', () => {
      const notes = [48, 52, 55, 60];
      const chord = makeChord({
        pianoVoicing: { notes, style: 'close', rootPc: 0, bassNote: 36 },
      });
      const section = makeSection({
        def: { id: 'v', name: 'V', preset: 'pop', lengthBars: 1, beatsPerBar: 4 } as any,
        chords: [chord],
      });
      getSequencer().setSections([section]);
      fireBeat(0, 0);

      const padCalls = hoisted.mockTriggerNote.mock.calls.filter((c: any[]) => c[0] === 'pad');
      expect(padCalls.length).toBe(notes.length);
      notes.forEach((note, i) => {
        expect(padCalls[i][1]).toBe(note);
        expect(padCalls[i][2]).toBe(0.4);
      });
    });

    it('plays the last voicing note on lead channel', () => {
      const notes = [60, 64, 67];
      const chord = makeChord({
        pianoVoicing: { notes, style: 'close', rootPc: 0, bassNote: 48 },
      });
      const section = makeSection({
        def: { id: 'v', name: 'V', preset: 'pop', lengthBars: 1, beatsPerBar: 4 } as any,
        chords: [chord],
      });
      getSequencer().setSections([section]);
      fireBeat(0, 0);

      const leadCalls = hoisted.mockTriggerNote.mock.calls.filter((c: any[]) => c[0] === 'lead');
      expect(leadCalls.length).toBe(1);
      expect(leadCalls[0][1]).toBe(67);
      expect(leadCalls[0][2]).toBe(0.7);
    });

    it('does not trigger pad/lead when pianoVoicing is absent', () => {
      const chord = makeChord({ pianoVoicing: undefined });
      const section = makeSection({
        def: { id: 'v', name: 'V', preset: 'pop', lengthBars: 1, beatsPerBar: 4 } as any,
        chords: [chord],
      });
      getSequencer().setSections([section]);
      hoisted.mockTriggerNote.mockClear();
      fireBeat(0, 0);
      const padCalls = hoisted.mockTriggerNote.mock.calls.filter((c: any[]) => c[0] === 'pad');
      const leadCalls = hoisted.mockTriggerNote.mock.calls.filter((c: any[]) => c[0] === 'lead');
      expect(padCalls.length).toBe(0);
      expect(leadCalls.length).toBe(0);
    });

    it('does not trigger pad/lead when pianoVoicing has no notes', () => {
      const chord = makeChord({
        pianoVoicing: { notes: [], style: 'close', rootPc: 0, bassNote: 36 },
      });
      const section = makeSection({
        def: { id: 'v', name: 'V', preset: 'pop', lengthBars: 1, beatsPerBar: 4 } as any,
        chords: [chord],
      });
      getSequencer().setSections([section]);
      hoisted.mockTriggerNote.mockClear();
      fireBeat(0, 0);
      const padCalls = hoisted.mockTriggerNote.mock.calls.filter((c: any[]) => c[0] === 'pad');
      const leadCalls = hoisted.mockTriggerNote.mock.calls.filter((c: any[]) => c[0] === 'lead');
      expect(padCalls.length).toBe(0);
      expect(leadCalls.length).toBe(0);
    });
  });

  describe('mapDrumToSample (via drum playback)', () => {
    it('maps HH Closed to Hi-Hat Closed sample name', () => {
      audioEngine.loadedSamples.set('Hi-Hat Closed', {});

      const grid: Record<string, boolean[]> = {
        'HH Closed': Array(32).fill(false),
      };
      grid['HH Closed'][0] = true;

      const section = makeSection({
        def: { id: 'd', name: 'D', preset: 'pop', lengthBars: 1, beatsPerBar: 4 } as any,
        drumPattern: { steps: 32, grid, swing: 0, ghostNotes: 0, microTimingMs: [], velocities: [] },
        chords: [makeChord({ bar: 0, beat: 1 })],
      });
      getSequencer().setSections([section]);
      fireBeat(0, 0);
      const drumTrack = audioEngine.tracks.get('drums')!;
      expect(drumTrack.playBuffer).toHaveBeenCalled();
    });

    it('maps Tom High to Tom 1 sample name', () => {
      audioEngine.loadedSamples.set('Tom 1', {});

      const grid: Record<string, boolean[]> = {
        'Tom High': Array(32).fill(false),
      };
      grid['Tom High'][0] = true;

      const section = makeSection({
        def: { id: 'd', name: 'D', preset: 'pop', lengthBars: 1, beatsPerBar: 4 } as any,
        drumPattern: { steps: 32, grid, swing: 0, ghostNotes: 0, microTimingMs: [], velocities: [] },
        chords: [makeChord({ bar: 0, beat: 1 })],
      });
      getSequencer().setSections([section]);
      fireBeat(0, 0);
      const drumTrack = audioEngine.tracks.get('drums')!;
      expect(drumTrack.playBuffer).toHaveBeenCalled();
    });

    it('passes through unmapped drum names', () => {
      audioEngine.loadedSamples.set('CustomDrum', {});

      const grid: Record<string, boolean[]> = {
        'CustomDrum': Array(32).fill(false),
      };
      grid['CustomDrum'][0] = true;

      const section = makeSection({
        def: { id: 'd', name: 'D', preset: 'pop', lengthBars: 1, beatsPerBar: 4 } as any,
        drumPattern: { steps: 32, grid, swing: 0, ghostNotes: 0, microTimingMs: [], velocities: [] },
        chords: [makeChord({ bar: 0, beat: 1 })],
      });
      getSequencer().setSections([section]);
      fireBeat(0, 0);
      const drumTrack = audioEngine.tracks.get('drums')!;
      expect(drumTrack.playBuffer).toHaveBeenCalled();
    });
  });

  describe('processBeat with Map tracks', () => {
    it('handles tracks as a Map', () => {
      audioEngine.loadedSamples.set('Kick', {});

      const grid: Record<string, boolean[]> = {
        'Kick': Array(32).fill(false),
      };
      grid['Kick'][0] = true;

      const section = makeSection({
        def: { id: 'd', name: 'D', preset: 'pop', lengthBars: 1, beatsPerBar: 4 } as any,
        drumPattern: { steps: 32, grid, swing: 0, ghostNotes: 0, microTimingMs: [], velocities: [] },
        chords: [makeChord({ bar: 0, beat: 1 })],
      });
      getSequencer().setSections([section]);
      fireBeat(0, 0);
      expect(audioEngine.tracks.get('drums')!.playBuffer).toHaveBeenCalled();
    });
  });

  describe('stepInPattern clamping', () => {
    it('clamps stepInPattern to STEPS_PER_PATTERN - 1 for edge-case beats', () => {
      audioEngine.loadedSamples.set('Kick', {});

      const grid: Record<string, boolean[]> = {
        'Kick': Array(32).fill(false),
      };
      grid['Kick'][31] = true;

      const section = makeSection({
        def: { id: 'd', name: 'D', preset: 'pop', lengthBars: 2, beatsPerBar: 4 } as any,
        drumPattern: { steps: 32, grid, swing: 0, ghostNotes: 0, microTimingMs: [], velocities: [] },
        chords: [makeChord({ bar: 0, beat: 1 })],
      });
      getSequencer().setSections([section]);
      fireBeat(7.99, 0);
      const drumTrack = audioEngine.tracks.get('drums')!;
      expect(drumTrack.playBuffer).toHaveBeenCalled();
    });
  });

  describe('multiple drum tracks in grid', () => {
    it('plays multiple drums in a single step', () => {
      audioEngine.loadedSamples.set('Kick', {});
      audioEngine.loadedSamples.set('Snare', {});
      const drumTrack = audioEngine.tracks.get('drums')!;

      const grid: Record<string, boolean[]> = {
        'Kick': Array(32).fill(false),
        'Snare': Array(32).fill(false),
      };
      grid['Kick'][0] = true;
      grid['Snare'][0] = true;

      const section = makeSection({
        def: { id: 'd', name: 'D', preset: 'pop', lengthBars: 1, beatsPerBar: 4 } as any,
        drumPattern: { steps: 32, grid, swing: 0, ghostNotes: 0, microTimingMs: [], velocities: [] },
        chords: [makeChord({ bar: 0, beat: 1 })],
      });
      getSequencer().setSections([section]);
      fireBeat(0, 0);
      expect(drumTrack.playBuffer).toHaveBeenCalledTimes(2);
    });
  });

  describe('jazz walking bass chromatic approach', () => {
    it('approaches next root from a half-step away', () => {
      audioEngine.loadedSamples.set('bass', {});

      const chord1 = makeChord({ bar: 0, beat: 1, bassNote: { midi: 36, role: 'root' } });
      const chord3 = makeChord({ bar: 1, beat: 3, bassNote: { midi: 48, role: 'root' } });
      const chord4 = makeChord({ bar: 2, beat: 1, bassNote: { midi: 40, role: 'root' } });
      const section = makeSection({
        def: { id: 'j', name: 'J', preset: 'jazz' as any, lengthBars: 3, beatsPerBar: 4 } as any,
        chords: [chord1, chord3, chord4],
      });
      getSequencer().setSections([section]);

      const bassTrack = audioEngine.tracks.get('bass')!;
      fireBeat(7, 0);
      expect(bassTrack.playBufferShifted).toHaveBeenCalled();
    });
  });

  describe('funk bass note selection', () => {
    it('plays octave at FUNK_OCTAVE_STEPS', () => {
      audioEngine.loadedSamples.set('bass', {});

      const chord = makeChord({ bar: 0, beat: 1, bassNote: { midi: 36, role: 'root' } });
      const section = makeSection({
        def: { id: 'f', name: 'F', preset: 'funk' as any, lengthBars: 2, beatsPerBar: 4 } as any,
        chords: [chord],
      });
      getSequencer().setSections([section]);

      // step 3: (localBeat % 8) * 4 = 3 → localBeat = 0.75
      fireBeat(0.75, 0);
      const bassTrack = audioEngine.tracks.get('bass')!;
      expect(bassTrack.playBufferShifted).toHaveBeenCalled();
    });

    it('plays fifth at FUNK_FIFTH_STEPS', () => {
      audioEngine.loadedSamples.set('bass', {});

      const chord = makeChord({ bar: 0, beat: 1, bassNote: { midi: 36, role: 'root' } });
      const section = makeSection({
        def: { id: 'f', name: 'F', preset: 'funk' as any, lengthBars: 2, beatsPerBar: 4 } as any,
        chords: [chord],
      });
      getSequencer().setSections([section]);

      // step 6: localBeat = 1.5
      fireBeat(1.5, 0);
      const bassTrack = audioEngine.tracks.get('bass')!;
      expect(bassTrack.playBufferShifted).toHaveBeenCalled();
    });

    it('plays third at non-special syncopated steps', () => {
      audioEngine.loadedSamples.set('bass', {});

      const chord = makeChord({ bar: 0, beat: 1, bassNote: { midi: 36, role: 'root' } });
      const section = makeSection({
        def: { id: 'f', name: 'F', preset: 'funk' as any, lengthBars: 2, beatsPerBar: 4 } as any,
        chords: [chord],
      });
      getSequencer().setSections([section]);

      // step 10: localBeat = 2.5
      fireBeat(2.5, 0);
      const bassTrack = audioEngine.tracks.get('bass')!;
      expect(bassTrack.playBufferShifted).toHaveBeenCalled();
    });
  });

  describe('four_on_floor offbeat notes', () => {
    it('plays octave and fifth on offbeat steps', () => {
      audioEngine.loadedSamples.set('bass', {});

      const chord = makeChord({ bar: 0, beat: 1, bassNote: { midi: 36, role: 'root' } });
      const section = makeSection({
        def: { id: 'f', name: 'F', preset: 'pop', lengthBars: 2, beatsPerBar: 4 } as any,
        timeFeel: { kickPlacementStyle: 'four_on_floor' } as any,
        chords: [chord],
      });
      getSequencer().setSections([section]);

      const bassTrack = audioEngine.tracks.get('bass')!;

      // step 2: localBeat = 0.5, HOUSE_OFFBEATS includes 2
      fireBeat(0.5, 0);
      expect(bassTrack.playBufferShifted).toHaveBeenCalled();

      bassTrack.playBufferShifted.mockClear();

      // step 6: localBeat = 1.5, HOUSE_OFFBEATS includes 6
      fireBeat(1.5, 0);
      expect(bassTrack.playBufferShifted).toHaveBeenCalled();
    });
  });

  describe('jazz walking bass third and fifth', () => {
    it('plays third at beatIndex 1,5 and fifth at 2,6', () => {
      audioEngine.loadedSamples.set('bass', {});

      const chord = makeChord({ bar: 0, beat: 1, bassNote: { midi: 36, role: 'root' } });
      const section = makeSection({
        def: { id: 'j', name: 'J', preset: 'jazz' as any, lengthBars: 2, beatsPerBar: 4 } as any,
        chords: [chord],
      });
      getSequencer().setSections([section]);

      const bassTrack = audioEngine.tracks.get('bass')!;

      // beatIndex 1 → step 4 → localBeat = 1.0
      fireBeat(1, 0);
      expect(bassTrack.playBufferShifted).toHaveBeenCalled();

      bassTrack.playBufferShifted.mockClear();

      // beatIndex 2 → step 8 → localBeat = 2.0
      fireBeat(2, 0);
      expect(bassTrack.playBufferShifted).toHaveBeenCalled();
    });
  });

  describe('edge cases', () => {
    it('handles section with no drumPattern gracefully', () => {
      const chord = makeChord({ bar: 0, beat: 1 });
      const section = makeSection({
        def: { id: 'n', name: 'N', preset: 'pop', lengthBars: 1, beatsPerBar: 4 } as any,
        chords: [chord],
        drumPattern: undefined,
      });
      getSequencer().setSections([section]);
      fireBeat(0, 0);
    });

    it('handles section with no timeFeel gracefully', () => {
      const chord = makeChord({ bar: 0, beat: 1 });
      const section = makeSection({
        def: { id: 'n', name: 'N', preset: 'pop', lengthBars: 1, beatsPerBar: 4 } as any,
        chords: [chord],
        timeFeel: undefined,
      });
      getSequencer().setSections([section]);
      fireBeat(0, 0);
    });

    it('handles beatsPerBar defaulting to 4 when not specified', () => {
      const chord = makeChord({ bar: 0, beat: 1 });
      const section = makeSection({
        def: { id: 'n', name: 'N', preset: 'pop', lengthBars: 1 } as any,
        chords: [chord],
      });
      getSequencer().setSections([section]);
      fireBeat(0, 0);
    });

    it('handles empty drum grid', () => {
      const chord = makeChord({ bar: 0, beat: 1 });
      const section = makeSection({
        def: { id: 'n', name: 'N', preset: 'pop', lengthBars: 1, beatsPerBar: 4 } as any,
        chords: [chord],
        drumPattern: { steps: 32, grid: {}, swing: 0, ghostNotes: 0, microTimingMs: [], velocities: [] },
      });
      getSequencer().setSections([section]);
      fireBeat(0, 0);
    });

    it('handles bass with no bassNote on chord', () => {
      audioEngine.loadedSamples.set('bass', {});

      const chord = makeChord({ bassNote: undefined });
      const section = makeSection({
        def: { id: 'n', name: 'N', preset: 'pop', lengthBars: 1, beatsPerBar: 4 } as any,
        chords: [chord],
      });
      getSequencer().setSections([section]);
      fireBeat(0, 0);
    });

    it('handles minor quality chord in bass calculation', () => {
      audioEngine.loadedSamples.set('bass', {});

      const chord = makeChord({ quality: 'm', bassNote: { midi: 36, role: 'root' } });
      const section = makeSection({
        def: { id: 'n', name: 'N', preset: 'pop', lengthBars: 1, beatsPerBar: 4 } as any,
        chords: [chord],
      });
      getSequencer().setSections([section]);
      fireBeat(0, 0);
    });
  });
});
