export type ArpMode = 'OFF' | 'UP' | 'DOWN' | 'UPDOWN' | 'RANDOM' | 'CHORD';

export interface Ju60Params {
  vcfCutoff: number;
  vcfRes: number;
  envA: number;
  envD: number;
  envS: number;
  envR: number;
  chorus: 'OFF' | 'I' | 'II' | 'BOTH';
  vcaLevel: number;
  dcoRange: '16\'' | '8\'' | '4\'';
  vcaMode: 'GATE' | 'ENV';
  lfoRate: number;
  lfoDelay: number;
  dcoLfo: number;
  dcoPwm: number;
  dcoPwmSrc: 'LFO' | 'ENV' | 'MANUAL';
  dcoPulse: boolean;
  dcoSaw: boolean;
  dcoSub: number;
  dcoNoise: number;
  vcfEnv: number;
  vcfLfo: number;
  vcfKeyFollow: number;
  vcfPolarity: '+' | '-';
  voiceMode: 'POLY' | 'MONO' | 'UNISON';
  unisonDetune: number;
  hpfFreq?: number;
  subWave?: string;
  filterDrive?: number;
  outputSat?: number;
  arpMode?: ArpMode;
  arpRate?: number;
  arpOctaveRange?: number;
  arpGate?: number;
  portamento?: number;
  legato?: boolean;
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

export function sanitizePatch(patch: Ju60Params): Ju60Params {
  return {
    ...patch,
    vcfCutoff:    clamp(patch.vcfCutoff, 0, 100),
    vcfRes:       clamp(patch.vcfRes, 0, 100),
    envA:         clamp(patch.envA, 0, 100),
    envD:         clamp(patch.envD, 0, 100),
    envS:         clamp(patch.envS, 0, 100),
    envR:         clamp(patch.envR, 0, 100),
    vcaLevel:     clamp(patch.vcaLevel, 0, 100),
    dcoSub:       clamp(patch.dcoSub, 0, 100),
    dcoNoise:     clamp(patch.dcoNoise, 0, 100),
    dcoLfo:       clamp(patch.dcoLfo, 0, 100),
    dcoPwm:       clamp(patch.dcoPwm, 0, 100),
    vcfEnv:       clamp(patch.vcfEnv, 0, 100),
    vcfLfo:       clamp(patch.vcfLfo, 0, 100),
    vcfKeyFollow: clamp(patch.vcfKeyFollow, 0, 100),
    unisonDetune: clamp(patch.unisonDetune, 0, 100),
    hpfFreq:      Math.round(clamp(patch.hpfFreq ?? 1, 0, 3)),
    filterDrive:  clamp(patch.filterDrive ?? 15, 0, 100),
    outputSat:    clamp(patch.outputSat ?? 10, 0, 100),
    arpMode:         patch.arpMode ?? 'OFF',
    arpRate:         clamp(patch.arpRate ?? 50, 0, 100),
    arpOctaveRange:  Math.round(clamp(patch.arpOctaveRange ?? 0, 0, 2)),
    arpGate:         clamp(patch.arpGate ?? 80, 0, 100),
    portamento:      clamp(patch.portamento ?? 0, 0, 100),
    legato:          patch.legato ?? false,
  };
}

export const DEFAULT_PATCH: Ju60Params = {
  vcfCutoff: 75, vcfRes: 20, envA: 5, envD: 30, envS: 60, envR: 40,
  chorus: 'OFF', vcaLevel: 80, dcoRange: '8\'', vcaMode: 'ENV',
  lfoRate: 50, lfoDelay: 0, dcoLfo: 20, dcoPwm: 30, dcoPwmSrc: 'LFO',
  dcoPulse: true, dcoSaw: true, dcoSub: 40, dcoNoise: 0,
  vcfEnv: 50, vcfLfo: 10, vcfKeyFollow: 30, vcfPolarity: '+',
  voiceMode: 'POLY', unisonDetune: 0,
  hpfFreq: 1, subWave: 'SQR', filterDrive: 15, outputSat: 10,
  arpMode: 'OFF', arpRate: 50, arpOctaveRange: 0, arpGate: 80,
  portamento: 0, legato: false,
};
