
export const DRUM_NAMES = [
  'Kick',
  'Snare',
  'Hi-Hat Closed',
  'Hi-Hat Open',
  'Crash',
  'Ride',
  'Tom 1',
  'Tom 2',
  'Tom 3',
] as const;

export type DrumName = (typeof DRUM_NAMES)[number];
export type KitId = 'kit1' | 'kit2';
export type TabId = 'drums' | 'synth' | 'bass' | 'soundbank' | 'plugins' | 'sampler';
export type QuickLoadAction = KitId | 'bass' | 'demo' | 'folder';

export interface SampleSlotStatus {
  loaded: boolean;
  filename: string;
}

export interface SoundbankStatus {
  bass: SampleSlotStatus;
  kit1: Record<string, SampleSlotStatus>;
  kit2: Record<string, SampleSlotStatus>;
}

export interface BassParams {
  style: 'finger' | 'pick';
  pickupBlend: number;      // 0 (neck) - 100 (bridge)
  tone: number;             // 0-100
  monoChoke: boolean;
  bleedDecay: number;       // ms
  ampVolume: number;        // 0-100
  ampBass: number;          // 0-100
  ampTreble: number;        // 0-100
  ultraLo: boolean;
  ultraHi: boolean;
  drive: number;            // 0-100
  cabSim: 'b15' | 'svt' | 'di';
  tuningCoarse: number;     // semitones, -12 to +12
  tuningFine: number;       // cents, -50 to +50
  eqLow: number;            // dB, -12 to +12
  eqMid: number;            // dB, -12 to +12
  eqHigh: number;           // dB, -12 to +12
}

export const DEFAULT_BASS_PARAMS: BassParams = {
  style: 'finger',
  pickupBlend: 50,
  tone: 75,
  monoChoke: true,
  bleedDecay: 150,
  ampVolume: 75,
  ampBass: 65,
  ampTreble: 45,
  ultraLo: true,
  ultraHi: false,
  drive: 35,
  cabSim: 'b15',
  tuningCoarse: 0,
  tuningFine: 0,
  eqLow: 4,
  eqMid: 1,
  eqHigh: -2,
};

export function createEmptySoundbankStatus(): SoundbankStatus {
  const kit1: Record<string, SampleSlotStatus> = {};
  const kit2: Record<string, SampleSlotStatus> = {};
  DRUM_NAMES.forEach((k) => {
    kit1[k] = { loaded: false, filename: '' };
    kit2[k] = { loaded: false, filename: '' };
  });
  return {
    bass: { loaded: false, filename: '' },
    kit1,
    kit2,
  };
}

export type ToastVariant = 'success' | 'error' | 'info';
export interface ToastMessage {
  id: string;
  variant: ToastVariant;
  title: string;
  description?: string;
}
