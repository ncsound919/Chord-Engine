import * as Tone from 'tone';
import type { ArpMode } from './params';

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

export class Ju60Arpeggiator {
  readonly notes: Set<number> = new Set();
  private _mode: ArpMode = 'OFF';
  private _rateDiv: number = 4;
  private _octaveRange: number = 1;
  private _gate: number = 0.8;
  private _eventId: number | null = null;
  private _triggerNoteOn: (midi: number, time: number) => void;
  private _triggerNoteOff: (midi: number, time: number) => void;
  private _currentStep = 0;
  private _direction = 1;

  constructor(
    triggerNoteOn: (midi: number, time: number) => void,
    triggerNoteOff: (midi: number, time: number) => void,
  ) {
    this._triggerNoteOn = triggerNoteOn;
    this._triggerNoteOff = triggerNoteOff;
  }

  get mode() { return this._mode; }
  set mode(m: ArpMode) {
    if (m === 'OFF') {
      this._stopArp();
    } else {
      if (this._eventId) this._stopArp();
      if (this.notes.size > 0) this._startArp();
    }
    this._mode = m;
  }

  get rate() { return this._rateDiv; }
  set rate(r: number) {
    this._rateDiv = clamp(Math.round(r), 1, 16);
    if (this._eventId) { this._stopArp(); this._startArp(); }
  }

  get octaveRange() { return this._octaveRange; }
  set octaveRange(o: number) { this._octaveRange = clamp(Math.round(o), 1, 3); }

  get gate() { return this._gate; }
  set gate(g: number) { this._gate = clamp(g, 0.01, 1); }

  addNote(midi: number, time?: number) {
    this.notes.add(midi);
    if (this._mode === 'CHORD') this._triggerChord(time);
  }

  removeNote(midi: number) {
    this.notes.delete(midi);
    if (this.notes.size === 0 && this._mode !== 'OFF') {
      this._currentStep = 0;
      this._direction = 1;
    }
  }

  private _startArp() {
    if (this.notes.size === 0) return;
    this._eventId = Tone.getTransport().scheduleRepeat((time) => {
      this._step(time);
    }, `${this._rateDiv}n`);
  }

  private _stopArp() {
    if (this._eventId !== null) {
      try { Tone.getTransport().clear(this._eventId); } catch {}
      this._eventId = null;
    }
    this._currentStep = 0;
    this._direction = 1;
  }

  private _step(time: number) {
    const sorted = Array.from(this.notes).sort((a, b) => a - b);
    if (sorted.length === 0) return;
    const range = this._octaveRange;

    let note: number;
    switch (this._mode) {
      case 'UP': {
        const idx = this._currentStep % (sorted.length * range);
        const oct = Math.floor(idx / sorted.length);
        note = sorted[idx % sorted.length] + oct * 12;
        this._currentStep++;
        break;
      }
      case 'DOWN': {
        const reversed = [...sorted].reverse();
        const idx = this._currentStep % (sorted.length * range);
        const oct = Math.floor(idx / sorted.length);
        note = reversed[idx % sorted.length] + oct * 12;
        this._currentStep++;
        break;
      }
      case 'UPDOWN': {
        const cycle = sorted.length * 2 - 2 || 1;
        const idx = this._currentStep % (cycle * range);
        const oct = Math.floor(idx / cycle);
        const pos = idx % cycle;
        const noteIdx = pos < sorted.length ? pos : cycle - pos;
        note = sorted[noteIdx] + oct * 12;
        this._currentStep++;
        break;
      }
      case 'RANDOM': {
        const oct = Math.floor(Math.random() * range);
        note = sorted[Math.floor(Math.random() * sorted.length)] + oct * 12;
        break;
      }
      case 'CHORD':
        return;
      default:
        return;
    }

    const noteDuration = (this._rateDiv * 0.5 * this._gate) / 4;
    this._triggerNoteOn(note, time);
    Tone.getTransport().scheduleOnce((offTime) => this._triggerNoteOff(note, offTime), `+${noteDuration}`);
  }

  private _triggerChord(time?: number) {
    const t = time ?? Tone.now();
    this.notes.forEach(n => this._triggerNoteOn(n, t));
  }

  allNotesOff() {
    const t = Tone.now();
    this.notes.forEach(n => this._triggerNoteOff(n, t));
    this.notes.clear();
    this._stopArp();
  }

  dispose() {
    this.allNotesOff();
  }
}

export const CHORUS_MODE_SETTINGS: Record<'OFF' | 'I' | 'II' | 'BOTH', { wet: number; frequency: number; depth: number }> = {
  OFF:  { wet: 0,   frequency: 1.5, depth: 0.4 },
  I:    { wet: 0.6, frequency: 1.5, depth: 0.45 },
  II:   { wet: 0.7, frequency: 8,   depth: 0.25 },
  BOTH: { wet: 0.9, frequency: 4,   depth: 0.8 },
};
