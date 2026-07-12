import { DrumStyle } from '../../../theory/rhythmicReframer';

export const STEPS = 32;

export interface DrumDefinition {
  id: string;
  displayName: string;
  sampleName: string;
  midiNote?: string;
  type: 'kick' | 'snare' | 'hat' | 'tom' | 'perc';
}

export const DRUM_DEFINITIONS: DrumDefinition[] = [
  { id: 'Crash', displayName: 'Crash', sampleName: 'Crash', type: 'perc' },
  { id: 'Ride', displayName: 'Ride', sampleName: 'Ride', type: 'perc' },
  { id: 'HH Open', displayName: 'HH Open', sampleName: 'Hi-Hat Open', type: 'hat' },
  { id: 'HH Closed', displayName: 'HH Closed', sampleName: 'Hi-Hat Closed', type: 'hat' },
  { id: 'Tom High', displayName: 'Tom High', sampleName: 'Tom 1', type: 'tom' },
  { id: 'Tom Mid', displayName: 'Tom Mid', sampleName: 'Tom 2', type: 'tom' },
  { id: 'Tom Floor', displayName: 'Tom Floor', sampleName: 'Tom 3', type: 'tom' },
  { id: 'Snare', displayName: 'Snare', sampleName: 'Snare', type: 'snare' },
  { id: 'Kick', displayName: 'Kick', sampleName: 'Kick', type: 'kick' },
];

export const DRUM_KIT = DRUM_DEFINITIONS.map(d => d.id);

export const PRESET_TYPES: { type: DrumStyle; label: string }[] = [
  { type: 'boom_bap', label: 'Boom Bap' },
  { type: 'techno', label: 'Techno' },
  { type: 'trap', label: 'Trap' },
  { type: 'funk', label: 'Funk' },
  { type: 'jazz', label: 'Jazz' },
];
