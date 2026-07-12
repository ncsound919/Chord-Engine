import { BassParams, DEFAULT_BASS_PARAMS } from './types';

// ─── Factory Presets ────────────────────────────────────
// Curated starting points layered on top of DEFAULT_BASS_PARAMS.
// Each only overrides the fields that define its character, so new
// BassParams fields added later still get a sane default automatically.

export interface BassPreset {
  id: string;
  name: string;
  description: string;
  factory: boolean;
  params: BassParams;
}

const factoryOverrides: Record<string, { name: string; description: string; overrides: Partial<BassParams> }> = {
  factory_motown: {
    name: 'Motown Thump',
    description: 'Flatwound finger tone, rolled-off highs, B-15 warmth.',
    overrides: {
      style: 'finger',
      pickupBlend: 30,
      tone: 40,
      ampVolume: 70,
      ampBass: 75,
      ampTreble: 25,
      drive: 15,
      cabSim: 'b15',
      eqLow: 5,
      eqMid: -1,
      eqHigh: -6,
      ultraLo: true,
      ultraHi: false,
    },
  },
  factory_modern_pick: {
    name: 'Modern Pick Growl',
    description: 'Bright pick attack through the SVT stack, upper-mid bite.',
    overrides: {
      style: 'pick',
      pickupBlend: 80,
      tone: 85,
      ampVolume: 80,
      ampBass: 55,
      ampTreble: 70,
      drive: 45,
      cabSim: 'svt',
      eqLow: 0,
      eqMid: 5,
      eqHigh: 3,
      ultraLo: false,
      ultraHi: true,
    },
  },
  factory_di_clean: {
    name: 'Studio DI Clean',
    description: 'Bypassed cab, flat EQ, minimal coloration for mix flexibility.',
    overrides: {
      style: 'finger',
      pickupBlend: 50,
      tone: 60,
      ampVolume: 65,
      ampBass: 50,
      ampTreble: 50,
      drive: 5,
      cabSim: 'di',
      eqLow: 0,
      eqMid: 0,
      eqHigh: 0,
      ultraLo: false,
      ultraHi: false,
    },
  },
  factory_sub_synth: {
    name: 'Sub-Heavy Synth Bass',
    description: 'Ultra-Lo engaged, choke off for sustained low end, driven amp.',
    overrides: {
      style: 'finger',
      pickupBlend: 20,
      tone: 30,
      monoChoke: false,
      ampVolume: 85,
      ampBass: 90,
      ampTreble: 20,
      drive: 60,
      cabSim: 'b15',
      eqLow: 8,
      eqMid: -3,
      eqHigh: -8,
      ultraLo: true,
      ultraHi: false,
    },
  },
};

export const FACTORY_PRESETS: BassPreset[] = Object.entries(factoryOverrides).map(([id, def]) => ({
  id,
  name: def.name,
  description: def.description,
  factory: true,
  params: { ...DEFAULT_BASS_PARAMS, ...def.overrides },
}));

export function createUserPreset(name: string, params: BassParams): BassPreset {
  return {
    id: `user_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    name: name.trim() || 'Untitled Preset',
    description: 'Custom preset',
    factory: false,
    params: { ...params },
  };
}
