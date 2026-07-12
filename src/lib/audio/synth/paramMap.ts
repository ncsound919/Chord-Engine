export type ParamType = 'float' | 'int' | 'bool' | 'enum' | 'stepped';

export interface ParamDescriptor<T = number | boolean | string> {
  id: string;
  name: string;
  shortName: string;
  type: ParamType;
  defaultValue: T;
  min?: number;
  max?: number;
  step?: number;
  unit?: string;
  enumValues?: readonly { value: string; label: string }[];
  /** MIDI CC number (0-127) for automation */
  midiCC?: number;
  /** Is this parameter automatable? */
  automatable?: boolean;
  /** Group for UI organization */
  group?: string;
}

export type ParamMap = Record<string, ParamDescriptor>;

export const PARAM_DESCRIPTORS: ParamMap = {
  vcfCutoff: { id: 'vcfCutoff', name: 'VCF Cutoff', shortName: 'Cutoff', type: 'float', defaultValue: 75, min: 0, max: 100, unit: '%', midiCC: 74, group: 'VCF' },
  vcfRes: { id: 'vcfRes', name: 'VCF Resonance', shortName: 'Res', type: 'float', defaultValue: 20, min: 0, max: 100, unit: '%', midiCC: 71, group: 'VCF' },
  envA: { id: 'envA', name: 'Envelope Attack', shortName: 'Atk', type: 'float', defaultValue: 5, min: 0, max: 100, unit: '%', midiCC: 73, group: 'ENV' },
  envD: { id: 'envD', name: 'Envelope Decay', shortName: 'Dec', type: 'float', defaultValue: 30, min: 0, max: 100, unit: '%', midiCC: 75, group: 'ENV' },
  envS: { id: 'envS', name: 'Envelope Sustain', shortName: 'Sus', type: 'float', defaultValue: 60, min: 0, max: 100, unit: '%', midiCC: 79, group: 'ENV' },
  envR: { id: 'envR', name: 'Envelope Release', shortName: 'Rel', type: 'float', defaultValue: 40, min: 0, max: 100, unit: '%', midiCC: 72, group: 'ENV' },
  chorus: { id: 'chorus', name: 'Chorus Mode', shortName: 'Chorus', type: 'enum', defaultValue: 'OFF', enumValues: [
    { value: 'OFF', label: 'Off' }, { value: 'I', label: 'I' }, { value: 'II', label: 'II' }, { value: 'BOTH', label: 'Both' },
  ], midiCC: 93, group: 'FX' },
  vcaLevel: { id: 'vcaLevel', name: 'VCA Level', shortName: 'Level', type: 'float', defaultValue: 80, min: 0, max: 100, unit: '%', midiCC: 7, group: 'VCA' },
  dcoRange: { id: 'dcoRange', name: 'DCO Range', shortName: 'Range', type: 'enum', defaultValue: '8\'', enumValues: [
    { value: '16\'', label: '16\'' }, { value: '8\'', label: '8\'' }, { value: '4\'', label: '4\'' },
  ], midiCC: 12, group: 'DCO' },
  vcaMode: { id: 'vcaMode', name: 'VCA Mode', shortName: 'VCA', type: 'enum', defaultValue: 'ENV', enumValues: [
    { value: 'ENV', label: 'ENV' }, { value: 'GATE', label: 'GATE' },
  ], group: 'VCA' },
  lfoRate: { id: 'lfoRate', name: 'LFO Rate', shortName: 'LFO Rate', type: 'float', defaultValue: 50, min: 0, max: 100, unit: '%', midiCC: 76, group: 'LFO' },
  lfoDelay: { id: 'lfoDelay', name: 'LFO Delay', shortName: 'Delay', type: 'float', defaultValue: 0, min: 0, max: 10000, unit: 'ms', group: 'LFO' },
  dcoLfo: { id: 'dcoLfo', name: 'DCO LFO Mod', shortName: 'Pitch Mod', type: 'float', defaultValue: 20, min: 0, max: 100, unit: '%', midiCC: 77, group: 'LFO' },
  dcoPwm: { id: 'dcoPwm', name: 'PWM Depth', shortName: 'PWM', type: 'float', defaultValue: 30, min: 0, max: 100, unit: '%', midiCC: 78, group: 'PWM' },
  dcoPwmSrc: { id: 'dcoPwmSrc', name: 'PWM Source', shortName: 'PWM Src', type: 'enum', defaultValue: 'LFO', enumValues: [
    { value: 'LFO', label: 'LFO' }, { value: 'ENV', label: 'ENV' }, { value: 'MANUAL', label: 'Manual' },
  ], group: 'PWM' },
  dcoPulse: { id: 'dcoPulse', name: 'Pulse Wave', shortName: 'Pulse', type: 'bool', defaultValue: true, group: 'DCO' },
  dcoSaw: { id: 'dcoSaw', name: 'Saw Wave', shortName: 'Saw', type: 'bool', defaultValue: true, group: 'DCO' },
  dcoSub: { id: 'dcoSub', name: 'Sub Level', shortName: 'Sub', type: 'float', defaultValue: 40, min: 0, max: 100, unit: '%', midiCC: 80, group: 'DCO' },
  dcoNoise: { id: 'dcoNoise', name: 'Noise Level', shortName: 'Noise', type: 'float', defaultValue: 0, min: 0, max: 100, unit: '%', midiCC: 81, group: 'DCO' },
  vcfEnv: { id: 'vcfEnv', name: 'VCF Envelope', shortName: 'Env Mod', type: 'float', defaultValue: 50, min: 0, max: 100, unit: '%', midiCC: 82, group: 'VCF' },
  vcfLfo: { id: 'vcfLfo', name: 'VCF LFO Mod', shortName: 'LFO Mod', type: 'float', defaultValue: 10, min: 0, max: 100, unit: '%', midiCC: 83, group: 'VCF' },
  vcfKeyFollow: { id: 'vcfKeyFollow', name: 'VCF Key Follow', shortName: 'Key Flw', type: 'float', defaultValue: 30, min: 0, max: 100, unit: '%', group: 'VCF' },
  vcfPolarity: { id: 'vcfPolarity', name: 'VCF Polarity', shortName: 'Polarity', type: 'enum', defaultValue: '+', enumValues: [
    { value: '+', label: '+' }, { value: '-', label: '-' },
  ], group: 'VCF' },
  voiceMode: { id: 'voiceMode', name: 'Voice Mode', shortName: 'Mode', type: 'enum', defaultValue: 'POLY', enumValues: [
    { value: 'POLY', label: 'Poly' }, { value: 'MONO', label: 'Mono' }, { value: 'UNISON', label: 'Unison' },
  ], midiCC: 68, group: 'Voice' },
  unisonDetune: { id: 'unisonDetune', name: 'Unison Detune', shortName: 'Detune', type: 'float', defaultValue: 0, min: 0, max: 100, unit: '%', group: 'Voice' },
  hpfFreq: { id: 'hpfFreq', name: 'HPF Frequency', shortName: 'HPF', type: 'stepped', defaultValue: 1, min: 0, max: 3, step: 1, group: 'VCF' },
  subWave: { id: 'subWave', name: 'Sub Waveform', shortName: 'Sub Wave', type: 'enum', defaultValue: 'SQR', enumValues: [
    { value: 'SQR', label: 'Square' }, { value: 'SIN', label: 'Sine' }, { value: 'TRI', label: 'Triangle' },
  ], group: 'DCO' },
  filterDrive: { id: 'filterDrive', name: 'Filter Drive', shortName: 'Drive', type: 'float', defaultValue: 15, min: 0, max: 100, unit: '%', group: 'Drive' },
  outputSat: { id: 'outputSat', name: 'Output Sat', shortName: 'Sat', type: 'float', defaultValue: 10, min: 0, max: 100, unit: '%', group: 'Drive' },
  arpMode: { id: 'arpMode', name: 'Arp Mode', shortName: 'Arp', type: 'enum', defaultValue: 'OFF', enumValues: [
    { value: 'OFF', label: 'Off' }, { value: 'UP', label: 'Up' }, { value: 'DOWN', label: 'Down' },
    { value: 'UPDOWN', label: 'Up/Dn' }, { value: 'RANDOM', label: 'Rand' }, { value: 'CHORD', label: 'Chord' },
  ], group: 'Arp' },
  arpRate: { id: 'arpRate', name: 'Arp Rate', shortName: 'Rate', type: 'float', defaultValue: 50, min: 0, max: 100, unit: '%', group: 'Arp' },
  arpOctaveRange: { id: 'arpOctaveRange', name: 'Arp Range', shortName: 'Oct', type: 'stepped', defaultValue: 0, min: 0, max: 2, step: 1, group: 'Arp' },
  arpGate: { id: 'arpGate', name: 'Arp Gate', shortName: 'Gate', type: 'float', defaultValue: 80, min: 0, max: 100, unit: '%', group: 'Arp' },
  portamento: { id: 'portamento', name: 'Portamento', shortName: 'Porta', type: 'float', defaultValue: 0, min: 0, max: 100, unit: '%', midiCC: 5, group: 'Voice' },
  legato: { id: 'legato', name: 'Legato', shortName: 'Legato', type: 'bool', defaultValue: false, group: 'Voice' },
};

export function getParamDescriptor(id: string): ParamDescriptor | undefined {
  return PARAM_DESCRIPTORS[id];
}

export function getParamsByGroup(group: string): ParamDescriptor[] {
  return Object.values(PARAM_DESCRIPTORS).filter(p => p.group === group);
}

export function getParamGroups(): string[] {
  const groups = new Set(Object.values(PARAM_DESCRIPTORS).map(p => p.group).filter((g): g is string => !!g));
  return Array.from(groups);
}

export function getMIDICCMap(): Map<number, string> {
  const map = new Map<number, string>();
  for (const [id, desc] of Object.entries(PARAM_DESCRIPTORS)) {
    if (desc.midiCC !== undefined) map.set(desc.midiCC, id);
  }
  return map;
}
