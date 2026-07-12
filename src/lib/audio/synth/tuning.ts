export interface ScaleDegree {
  cents: number;
  name?: string;
}

export interface TuningScale {
  name: string;
  description: string;
  degrees: ScaleDegree[];
  /** MIDI note that maps to the first degree (default 69 = A4) */
  referenceMidi: number;
  /** Frequency of the reference note (default 440) */
  referenceFreq: number;
}

const EQUAL_TEMPERAMENT_DEGREES: ScaleDegree[] = Array.from({ length: 12 }, (_, i) => ({
  cents: i * 100,
  name: ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'][i],
}));

export const EQUAL_TEMPERAMENT: TuningScale = {
  name: '12-TET',
  description: 'Standard equal temperament (12 notes per octave)',
  degrees: EQUAL_TEMPERAMENT_DEGREES,
  referenceMidi: 69,
  referenceFreq: 440,
};

export class Microtuner {
  private _scale: TuningScale = EQUAL_TEMPERAMENT;
  private _enabled = false;

  get scale() { return this._scale; }
  get enabled() { return this._enabled; }

  set enabled(v: boolean) { this._enabled = v; }

  loadScale(scale: TuningScale) {
    this._scale = scale;
  }

  /** Get frequency for a MIDI note, applying microtuning if enabled */
  getFrequency(midi: number): number {
    if (!this._enabled) {
      return 440 * Math.pow(2, (midi - 69) / 12);
    }
    return this._tunedFreq(midi);
  }

  /** Convert MIDI note to cumulative cents relative to reference */
  midiToCents(midi: number): number {
    if (midi === this._scale.referenceMidi) return 0;
    const offset = midi - this._scale.referenceMidi;
    const stepCount = this._scale.degrees.length;
    if (stepCount === 0) return offset * 100;
    // Build cumulative lookup: cumul[i] = sum of degrees[0..i]
    let running = 0;
    const cumul: number[] = [];
    for (let i = 0; i < stepCount; i++) {
      running += this._scale.degrees[i]?.cents ?? 100;
      cumul.push(running);
    }
    const fullOctaveCents = cumul[stepCount - 1] || 1200;
    const direction = offset >= 0 ? 1 : -1;
    let remaining = Math.abs(offset);
    let totalCents = 0;
    while (remaining >= stepCount) {
      totalCents += direction * fullOctaveCents;
      remaining -= stepCount;
    }
    if (remaining > 0) {
      totalCents += direction * (cumul[remaining - 1] || 0);
    }
    return totalCents;
  }

  private _tunedFreq(midi: number): number {
    const cents = this.midiToCents(midi);
    return this._scale.referenceFreq * Math.pow(2, cents / 1200);
  }

  /** Parse a Scala .scl file into a TuningScale */
  static parseScl(content: string): TuningScale | null {
    const lines = content.split('\n').map(l => l.trim()).filter(l => l && !l.startsWith('!'));
    if (lines.length < 2) return null;
    const name = lines[0];
    const count = parseInt(lines[1], 10);
    if (isNaN(count) || count < 1) return null;

    const degrees: ScaleDegree[] = [];
    let prevCents = 0;
    for (let i = 0; i < count && i + 2 < lines.length; i++) {
      const line = lines[i + 2];
      const cents = parseCents(line);
      if (cents === null) continue;
      const degreeCents = cents - prevCents;
      degrees.push({ cents: Math.round(degreeCents * 100) / 100 });
      prevCents = cents;
    }
    if (degrees.length === 0) return null;
    return { name, description: `Scala .scl (${count} notes/octave)`, degrees, referenceMidi: 69, referenceFreq: 440 };
  }

  /** Parse a Scala .kbm keyboard mapping file */
  static parseKbm(content: string): Partial<TuningScale> {
    const lines = content.split('\n').map(l => l.trim()).filter(l => l && !l.startsWith('!'));
    const result: Partial<TuningScale> = {};
    if (lines.length > 3) {
      const refNote = parseInt(lines[3], 10);
      if (!isNaN(refNote)) result.referenceMidi = refNote;
    }
    if (lines.length > 4) {
      const refFreq = parseFloat(lines[4]);
      if (!isNaN(refFreq) && refFreq > 0) result.referenceFreq = refFreq;
    }
    return result;
  }
}

function parseCents(line: string): number | null {
  const parts = line.split(/\s+/);
  const val = parts[0];
  if (!val) return null;
  if (val.includes('/')) {
    const [num, den] = val.split('/').map(Number);
    if (!den || isNaN(num) || isNaN(den)) return null;
    return Math.log(num / den) / Math.log(2) * 1200;
  }
  const num = parseFloat(val);
  return isNaN(num) ? null : num;
}

export const microtuner = new Microtuner();
