/**
 * MIDI File Export — generates Standard MIDI File (SMF) binary
 * from GeneratedSection data.
 *
 * Format: SMF Type 1 (separate tracks per instrument)
 * - Track 0: Tempo + Key signature
 * - Track 1: Chords (as piano voicing)
 * - Track 2: Bass
 * - Track 3: Melody
 * - Track 4: Drums (percussion on channel 10)
 */

import { GeneratedSection } from './engine';

// ── MIDI helpers ───────────────────────────────────────────

function toVarLen(value: number): number[] {
  const bytes: number[] = [];
  do {
    let b = value & 0x7f;
    value >>= 7;
    if (bytes.length > 0) b |= 0x80;
    bytes.unshift(b);
  } while (value > 0);
  return bytes;
}

function writeU16(value: number): number[] {
  return [(value >> 8) & 0xff, value & 0xff];
}

function writeU32(value: number): number[] {
  return [(value >> 24) & 0xff, (value >> 16) & 0xff, (value >> 8) & 0xff, value & 0xff];
}

function writeTrackHeader(length: number): number[] {
  return [0x4d, 0x54, 0x72, 0x6b, ...writeU32(length)]; // "MTrk"
}

function writeDelta(value: number): number[] {
  return toVarLen(value);
}

function writeNoteOn(delta: number, channel: number, note: number, velocity: number): number[] {
  return [...writeDelta(delta), 0x90 | channel, note & 0x7f, velocity & 0x7f];
}

function writeNoteOff(delta: number, channel: number, note: number): number[] {
  return [...writeDelta(delta), 0x80 | channel, note & 0x7f, 0x00];
}

function writeTempo(bpm: number): number[] {
  const usPerBeat = Math.round(60000000 / bpm);
  return [...writeDelta(0), 0xff, 0x51, 0x03, (usPerBeat >> 16) & 0xff, (usPerBeat >> 8) & 0xff, usPerBeat & 0xff];
}

function writeTimeSignature(num: number, denom: number): number[] {
  return [...writeDelta(0), 0xff, 0x58, 0x04, num, Math.log2(denom), 0x18, 0x08];
}

function writeKeySignature(key: number, mode: 0 | 1): number[] {
  return [...writeDelta(0), 0xff, 0x59, 0x02, key & 0x7f, mode & 0x7f];
}

function writeTrackEnd(): number[] {
  return [...writeDelta(0), 0xff, 0x2f, 0x00];
}

function writeTextEvent(text: string): number[] {
  const bytes = new TextEncoder().encode(text);
  return [...writeDelta(0), 0xff, 0x03, bytes.length, ...bytes];
}

const NOTE_NAMES_FLAT = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B'];

/** Convert a chord name like "Cmaj7" or "F#m7" to root MIDI note */
function chordRootToMidi(chordName: string): number {
  const m = chordName.match(/^([A-G][#b]?)/);
  if (!m) return 60;
  const idx = NOTE_NAMES_FLAT.indexOf(m[1]);
  return idx >= 0 ? 60 + idx - (NOTE_NAMES_FLAT.indexOf('C')) : 60;
}

/** Convert a note name like "C4" or "F#3" to MIDI */
function noteToMidi(note: string): number {
  const m = note.match(/^([A-G][#b]?)(-?\d+)/);
  if (!m) return 60;
  const idx = NOTE_NAMES_FLAT.indexOf(m[1]);
  const oct = parseInt(m[2], 10);
  if (idx < 0) return 60;
  return idx + (oct + 1) * 12;
}

/** Map degree name like "A1" or "Eb2" to MIDI */
function degreeToMidi(degree: string): number {
  const m = degree.match(/^([A-G][#b]?)(\d+)?/);
  if (!m) return 36;
  const idx = NOTE_NAMES_FLAT.indexOf(m[1]);
  const oct = m[2] ? parseInt(m[2], 10) : 2;
  if (idx < 0) return 36;
  return idx + (oct + 1) * 12;
}

function ticksPerBeat(tpb: number): number[] {
  return writeU16(tpb);
}

// ── Main export ─────────────────────────────────────────────

export function generateMIDI(
  sections: GeneratedSection[],
  tempo: number,
  key: string,
  timeSigNum: number = 4,
  timeSigDenom: number = 4
): Uint8Array {
  const TPB = 480; // ticks per beat (standard MIDI resolution)
  const CHANNEL_CHORDS = 0;
  const CHANNEL_BASS = 1;
  const CHANNEL_MELODY = 2;
  const CHANNEL_DRUMS = 9; // GM percussion

  // Key signature byte: -7 (7 flats) to +7 (7 sharps)
  const keySigMap: Record<string, number> = {
    'C': 0, 'G': 1, 'D': 2, 'A': 3, 'E': 4, 'B': 5, 'F#': 6, 'C#': 7,
    'F': -1, 'Bb': -2, 'Eb': -3, 'Ab': -4, 'Db': -5, 'Gb': -6, 'Cb': -7,
  };
  const keySig = keySigMap[key] || 0;

  const trackEvents: number[][] = [];
  const tracks: Uint8Array[] = [];

  // ── Track 0: Tempo + Key ──────────────────────────────
  trackEvents.push([]);
  trackEvents[0].push(...writeTempo(tempo));
  trackEvents[0].push(...writeTimeSignature(timeSigNum, timeSigDenom));
  trackEvents[0].push(...writeKeySignature(keySig, 0));
  trackEvents[0].push(...writeTrackEnd());
  tracks.push(new Uint8Array(trackEvents[0]));

  // ── Helper: build a track from note events ──────────────
  function buildNoteTrack(
    channel: number,
    noteSource: (section: GeneratedSection, bar: number, beat: number) => Array<{ note: number; dur: number; vel: number }>,
    trackName: string,
  ): Uint8Array {
    const events: number[] = [];
    events.push(...writeTextEvent(trackName));

    let totalTicks = 0;
    for (const section of sections) {
      const beatsPerBar = section.def.beatsPerBar || 4;
      const barLen = 480 * beatsPerBar; // ticks per bar

      for (const chord of section.chords) {
        const barStartTicks = (chord.bar - 1) * barLen;
        const beatTicks = (chord.beat - 1) * TPB;
        const targetTicks = barStartTicks + beatTicks;
        const delta = Math.max(0, targetTicks - totalTicks);

        const notes = noteSource(section, chord.bar, chord.beat);
        for (const n of notes) {
          events.push(...writeNoteOn(delta, channel, n.note, n.vel));
          events.push(...writeNoteOff(TPB / 4, channel, n.note));
          // Reset delta after first note-on
        }
        // After all notes in this chord, advance totalTicks
        totalTicks = Math.max(totalTicks, targetTicks + TPB / 4);
      }
      // Advance past the section
      totalTicks += section.def.lengthBars * barLen;
    }

    events.push(...writeTrackEnd());
    const data = new Uint8Array(events);
    const header = writeTrackHeader(data.length);
    return new Uint8Array([...header, ...data]);
  }

  // ── Track 1: Chords ──────────────────────────────────
  tracks.push(buildNoteTrack(CHANNEL_CHORDS, (section, bar, beat) => {
    const chord = section.chords.find(c => c.bar === bar && c.beat === beat);
    if (!chord?.pianoVoicing) return [{ note: 60, dur: 4, vel: 70 }];
    // Use piano voicing notes, but only the first 4 to keep MIDI clean
    const vNotes = chord.pianoVoicing.notes.slice(0, 4);
    return vNotes.map(n => ({
      note: n - 12, // drop an octave to stay in bass/treble range
      dur: 480,
      vel: 70,
    }));
  }, 'Chords'));

  // ── Track 2: Bass ────────────────────────────────────
  tracks.push(buildNoteTrack(CHANNEL_BASS, (section, bar, beat) => {
    const chord = section.chords.find(c => c.bar === bar && c.beat === beat);
    if (!chord) return [];
    const note = chord.bassNote?.midi ?? degreeToMidi(chord.roman);
    return [{ note, dur: 480, vel: 80 }];
  }, 'Bass'));

  // ── Track 3: Melody ──────────────────────────────────
  tracks.push(buildNoteTrack(CHANNEL_MELODY, (section) => {
    const melody = (section as any).melody || [];
    return melody.map((m: any) => ({
      note: typeof m.midi === 'number' ? m.midi : 60,
      dur: 480,
      vel: 75,
    }));
  }, 'Melody'));

  // ── Track 4: Drums ───────────────────────────────────
  const drumNoteMap: Record<string, number> = {
    'Kick': 36, 'Snare': 38, 'HH Closed': 42, 'HH Open': 46,
    'Crash': 49, 'Ride': 51, 'Tom 1': 48, 'Tom 2': 45, 'Tom 3': 43,
  };
  tracks.push(buildNoteTrack(CHANNEL_DRUMS, (section, bar) => {
    const pattern = section.drumPattern;
    if (!pattern) return [];
    const notes: Array<{ note: number; dur: number; vel: number }> = [];
    // Convert 32-step grid to MIDI notes on this bar
    const barStart16th = (bar - 1) * 8; // 8 sixteenths per bar in 32-step pattern
    for (const [voice, steps] of Object.entries(pattern.grid)) {
      const midiNote = drumNoteMap[voice];
      if (!midiNote) continue;
      for (let s = 0; s < steps.length; s++) {
        if (steps[s] && Math.floor(s / 8) === bar - 1) {
          notes.push({ note: midiNote, dur: 120, vel: 90 });
        }
      }
    }
    return notes;
  }, 'Drums'));

  // ── Assemble SMF ─────────────────────────────────────
  const headerChunk = [0x4d, 0x54, 0x68, 0x64]; // "MThd"
  const headerLength = writeU32(6);
  const format = writeU16(1); // Type 1
  const numTracks = writeU16(tracks.length);
  const timeDiv = ticksPerBeat(TPB);

  const header = new Uint8Array([...headerChunk, ...headerLength, ...format, ...numTracks, ...timeDiv]);
  const totalLength = tracks.reduce((sum, t) => sum + t.length, 0) + header.length;
  const result = new Uint8Array(totalLength);
  result.set(header, 0);
  let offset = header.length;
  for (const track of tracks) {
    result.set(track, offset);
    offset += track.length;
  }

  return result;
}

/** Download a MIDI file */
export function downloadMIDI(midiData: Uint8Array, filename: string = 'chord-engine-export.mid') {
  const blob = new Blob([midiData], { type: 'audio/midi' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
