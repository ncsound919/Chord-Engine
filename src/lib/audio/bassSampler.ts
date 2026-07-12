import * as Tone from 'tone';
import { audioEngine } from './engine';

export type BassArticulation = 'sustain' | 'staccato' | 'palm_mute' | 'slap' | 'pop' | 'harmonic' | 'natural';

export const ARTICULATION_NAMES: Record<BassArticulation, string> = {
  sustain: 'Sustain',
  staccato: 'Staccato',
  palm_mute: 'Palm Mute',
  slap: 'Slap',
  pop: 'Pop',
  harmonic: 'Harmonic',
  natural: 'Natural',
};

export const ARTICULATION_SHORT: Record<BassArticulation, string> = {
  sustain: 'sus',
  staccato: 'stac',
  palm_mute: 'pm',
  slap: 'slap',
  pop: 'pop',
  harmonic: 'harm',
  natural: 'nat',
};

const SHORT_TO_ARTIC: Record<string, BassArticulation> = {
  sus: 'sustain',
  stac: 'staccato',
  pm: 'palm_mute',
  slap: 'slap',
  pop: 'pop',
  harm: 'harmonic',
  nat: 'natural',
};

export interface BassSampleEntry {
  note: number;           // MIDI note
  articulation: BassArticulation;
  velocity: number;       // 0-127, center of layer
  roundRobin: number;     // 0-based RR index
  buffer: Tone.ToneAudioBuffer | null;
  filename: string;
}

export class BassSampler {
  private entries: BassSampleEntry[] = [];
  private rrCounters: Map<string, number> = new Map();
  private _currentArticulation: BassArticulation = 'sustain';
  private _keySwitches: Record<number, BassArticulation> = {};
  private _activeNote: number | null = null;
  private _monoChoke = true;
  private _chokeTimeout: ReturnType<typeof setTimeout> | null = null;

  get currentArticulation() { return this._currentArticulation; }
  set currentArticulation(a: BassArticulation) { this._currentArticulation = a; }

  get loaded(): boolean { return this.entries.length > 0; }
  get loadedEntries(): BassSampleEntry[] { return this.entries; }
  get loadedNotes(): number[] {
    const notes = new Set(this.entries.map(e => e.note));
    return Array.from(notes).sort((a, b) => a - b);
  }
  get loadedArticulations(): BassArticulation[] {
    const arts = new Set(this.entries.map(e => e.articulation));
    return Array.from(arts);
  }

  clear() {
    this.entries = [];
    this.rrCounters.clear();
    this._keySwitches = {};
    this._activeNote = null;
    if (this._chokeTimeout) clearTimeout(this._chokeTimeout);
  }

  addEntry(entry: BassSampleEntry) {
    this.entries.push(entry);
    const exactKey = `${entry.note}:${entry.articulation}:${entry.velocity}`;
    if (!this.rrCounters.has(exactKey)) {
      this.rrCounters.set(exactKey, 0);
    }
    // Also init the wildcard key for nearest-note fallback
    const wildKey = `${entry.note}:${entry.articulation}:*`;
    if (!this.rrCounters.has(wildKey)) {
      this.rrCounters.set(wildKey, 0);
    }
  }

  addKeySwitch(midi: number, articulation: BassArticulation) {
    this._keySwitches[midi] = articulation;
  }

  handleKeySwitch(midi: number): boolean {
    if (this._keySwitches[midi]) {
      this._currentArticulation = this._keySwitches[midi];
      return true;
    }
    return false;
  }

  triggerNote(midi: number, velocity = 100, time?: number, duration?: number) {
    if (this._monoChoke) {
      if (this._chokeTimeout) clearTimeout(this._chokeTimeout);
      this._activeNote = midi;
    }

    const sample = this.selectSample(midi, velocity);
    if (!sample || !sample.buffer) {
      // Fallback: synthesis
      this.playFallback(midi, velocity, time, duration);
      return;
    }

    const playTime = time ?? audioEngine.ctx.currentTime;
    const track = audioEngine.tracks.get('bass');
    if (!track) return;

    const rate = Math.pow(2, (midi - sample.note) / 12);
    track.playBufferShifted(sample.buffer, rate, playTime);

    if (this._monoChoke) {
      if (this._chokeTimeout) clearTimeout(this._chokeTimeout);
      this._chokeTimeout = setTimeout(() => {
        this._activeNote = null;
      }, this.getChokeMs(midi, velocity));
    }
  }

  triggerNoteOff(midi: number) {
    if (this._activeNote === midi) {
      this._activeNote = null;
    }
  }

  releaseAll() {
    if (this._chokeTimeout) clearTimeout(this._chokeTimeout);
    this._activeNote = null;
  }

  private selectSample(midi: number, velocity: number): BassSampleEntry | null {
    const candidates = this.entries.filter(e => e.note === midi && e.articulation === this._currentArticulation);
    if (candidates.length === 0) {
      // Find nearest note
      const allNotes = this.loadedNotes;
      if (allNotes.length === 0) return null;
      const nearest = allNotes.reduce((prev, curr) =>
        Math.abs(curr - midi) < Math.abs(prev - midi) ? curr : prev
      );
      const nearestCandidates = this.entries.filter(
        e => e.note === nearest && e.articulation === this._currentArticulation
      );
      if (nearestCandidates.length === 0) return null;

      // Round-robin across all velocity layers of nearest note
      const key = `${nearest}:${this._currentArticulation}:*`;
      const counter = this.rrCounters.get(key) ?? 0;
      this.rrCounters.set(key, (counter + 1) % nearestCandidates.length);
      return nearestCandidates[counter % nearestCandidates.length];
    }

    // Velocity layer selection: find closest velocity layer
    const sorted = [...candidates].sort((a, b) => a.velocity - b.velocity);
    let best = sorted[0];
    let bestDist = Math.abs(sorted[0].velocity - velocity);
    for (const c of sorted) {
      const dist = Math.abs(c.velocity - velocity);
      if (dist < bestDist) {
        bestDist = dist;
        best = c;
      }
    }

    // Round-robin within the selected velocity layer
    const bestKey = `${best.note}:${best.articulation}:${best.velocity}`;
    const rrCount = this.rrCounters.get(bestKey) ?? 0;
    const sameLayer = candidates.filter(c => c.velocity === best.velocity);
    if (sameLayer.length > 1) {
      this.rrCounters.set(bestKey, (rrCount + 1) % sameLayer.length);
      return sameLayer[rrCount % sameLayer.length];
    }
    return best;
  }

  private playFallback(midi: number, velocity: number, time?: number, duration?: number) {
    const track = audioEngine.tracks.get('bass');
    if (!track) return;
    const freq = 440 * Math.pow(2, (midi - 69) / 12);
    const waveType: OscillatorType = this._currentArticulation === 'slap' || this._currentArticulation === 'pop'
      ? 'sawtooth' : 'triangle';
    track.playOscillator(freq, waveType, time ?? audioEngine.ctx.currentTime, duration ?? 0.4);
  }

  private getChokeMs(midi: number, velocity: number): number {
    // Higher notes decay faster, lower notes ring longer
    return Math.max(50, 600 - (midi - 28) * 10);
  }

  static parseFilename(filename: string): { note: number; articulation: BassArticulation; roundRobin: number } | null {
    const name = filename.replace(/\.[^.]+$/, ''); // strip extension
    const parts = name.split(/[_\s-]+/);

    // Parse note name (e.g., "E2", "A#1", "Gb3")
    const noteMatch = name.match(/^([A-Ga-g][#b]?)(-?\d+)/);
    if (!noteMatch) return null;

    const noteNames = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
    const pc = noteNames.indexOf(noteMatch[1].charAt(0).toUpperCase() + (noteMatch[1].slice(1) || ''));
    if (pc === -1) return null;
    const octave = parseInt(noteMatch[2], 10);
    const midi = pc + (octave + 1) * 12;

    // Parse articulation from filename (e.g., "sus", "pm", "slap")
    let articulation: BassArticulation = 'sustain';
    let roundRobin = 0;

    for (const part of parts) {
      const lower = part.toLowerCase();
      if (SHORT_TO_ARTIC[lower]) {
        articulation = SHORT_TO_ARTIC[lower];
      }
      const rrMatch = lower.match(/^rr(\d+)$/);
      if (rrMatch) {
        roundRobin = parseInt(rrMatch[1], 10) - 1;
      }
    }

    return { note: midi, articulation, roundRobin };
  }
}

export const bassSampler = new BassSampler();
