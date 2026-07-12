// theory/songFraming.ts
// Song Framing: encodes what Bacharach, Leon Sylvers, Curtis Mayfield,
// Sly Stone, and Steely Dan share at the STRUCTURAL level — form, section
// roles, instrumentation behavior, harmonic rhythm pacing, arrangement
// devices — independent of any one writer's specific chord vocabulary.
// harmony.ts already encodes "what chords." This encodes "how a song
// is built" — the shape a real arranger reasons in before touching notes.
//
// Output of this module feeds generateProgression() per section (via
// SectionDef[] it produces) and downstream informs the Ensemble/Rhythm
// layers on WHO plays WHEN — it is deliberately upstream of harmony.

import { Preset } from './harmony';
import { SectionDef, ComplexityLevel } from '../lib/engine';

// ---------------------------------------------------------------------
// Section ROLES — not just "Verse"/"Chorus" as labels, but functional
// roles with distinct arranging behavior. Every writer in this lineage
// uses these roles even when song-specific section names differ.
// ---------------------------------------------------------------------
export type SectionRole =
  | 'intro'
  | 'verse'
  | 'pre_chorus'   // Bacharach's expansion device — the "lift" before a hook
  | 'chorus'       // or "hook" — the harmonic/melodic anchor point
  | 'bridge'       // real contrast: new key center or radically different texture
  | 'breakdown'    // Sly/Mayfield device — strip to rhythm section, groove exposed
  | 'vamp_out'     // extended outro groove, common in Mayfield/Sylvers
  | 'interlude';   // instrumental passage, often modulatory (classic Bacharach)

export interface SectionRoleProfile {
  // Target harmonic rhythm: how many bars, on average, does a chord last?
  // Bacharach changes chords almost every beat in places; Sly can sit on
  // one chord for 8 bars. This is the single biggest "feel" lever.
  harmonicRhythmBars: number;      // avg bars per chord (can be <1 for sub-bar rate, encoded as chords-per-bar elsewhere)
  chordsPerBar: number;             // when harmonicRhythmBars < 1, how many chord changes per bar
  complexityBias: 1 | 2 | 3;
  // Instrumentation behavior: which roles are "active" (playing changes)
  // vs "held back" (silent or pedal/groove-only) by default in this role.
  activeInstruments: ('piano' | 'guitar' | 'bass' | 'strings_horns' | 'drums')[];
  dynamicLevel: 1 | 2 | 3 | 4 | 5; // relative energy, used by the Arc/Ensemble layers
  allowsKeyChange: boolean;        // bridges/interludes in this lineage often modulate
  allowsMeterShift: boolean;       // Bacharach's signature — 4/4 verse into a 3/4 or 6/8 pre-chorus bar
}

export const SECTION_ROLE_PROFILES: Record<SectionRole, SectionRoleProfile> = {
  intro: {
    harmonicRhythmBars: 2, chordsPerBar: 0.5, complexityBias: 2,
    activeInstruments: ['piano', 'bass', 'drums'], dynamicLevel: 2,
    allowsKeyChange: false, allowsMeterShift: false,
  },
  verse: {
    harmonicRhythmBars: 1, chordsPerBar: 1, complexityBias: 2,
    activeInstruments: ['piano', 'bass', 'guitar', 'drums'], dynamicLevel: 2,
    allowsKeyChange: false, allowsMeterShift: false,
  },
  pre_chorus: {
    harmonicRhythmBars: 0.5, chordsPerBar: 2, complexityBias: 3,
    activeInstruments: ['piano', 'guitar', 'bass', 'strings_horns', 'drums'], dynamicLevel: 3,
    allowsKeyChange: false, allowsMeterShift: true,
  },
  chorus: {
    harmonicRhythmBars: 1, chordsPerBar: 1, complexityBias: 2,
    activeInstruments: ['piano', 'guitar', 'bass', 'strings_horns', 'drums'], dynamicLevel: 4,
    allowsKeyChange: false, allowsMeterShift: false,
  },
  bridge: {
    harmonicRhythmBars: 1, chordsPerBar: 1, complexityBias: 3,
    activeInstruments: ['piano', 'strings_horns', 'bass'], dynamicLevel: 3,
    allowsKeyChange: true, allowsMeterShift: true,
  },
  breakdown: {
    harmonicRhythmBars: 4, chordsPerBar: 0.25, complexityBias: 1,
    activeInstruments: ['bass', 'drums'], dynamicLevel: 2,
    allowsKeyChange: false, allowsMeterShift: false,
  },
  vamp_out: {
    harmonicRhythmBars: 2, chordsPerBar: 0.5, complexityBias: 2,
    activeInstruments: ['piano', 'guitar', 'bass', 'strings_horns', 'drums'], dynamicLevel: 3,
    allowsKeyChange: false, allowsMeterShift: false,
  },
  interlude: {
    harmonicRhythmBars: 1, chordsPerBar: 1, complexityBias: 3,
    activeInstruments: ['piano', 'strings_horns'], dynamicLevel: 2,
    allowsKeyChange: true, allowsMeterShift: false,
  },
};

// ---------------------------------------------------------------------
// FORM ARCHETYPES — the shared macro-structures across these five writers.
// Each is a sequence of SectionRoles. This is where "commonality within
// styles" actually lives structurally: Bacharach and Mayfield both use
// pre_chorus lift devices; Sly and Mayfield both use breakdown vamps;
// Sylvers/Mayfield both extend with vamp_out grooves; Fagen/Bacharach
// both use modulatory interludes.
// ---------------------------------------------------------------------
export type FormArchetype =
  | 'aaba_classic'          // Bacharach-leaning: verse-verse-bridge-verse, tight, through-composed feel
  | 'verse_prechorus_chorus' // Bacharach/Mayfield lift structure
  | 'groove_breakdown_form'  // Sly/Mayfield: verse-chorus-BREAKDOWN-chorus-vamp_out
  | 'steely_through_composed' // Fagen/Becker: verse-verse-chorus-interlude(modulation)-verse-chorus-vamp_out
  | 'sylvers_dance_form';    // Leon Sylvers: intro-verse-chorus-verse-chorus-breakdown-chorus-vamp_out (extended dance-length)

export const FORM_ARCHETYPES: Record<FormArchetype, SectionRole[]> = {
  aaba_classic: ['intro', 'verse', 'pre_chorus', 'chorus', 'verse', 'pre_chorus', 'chorus', 'bridge', 'chorus'],
  verse_prechorus_chorus: ['intro', 'verse', 'pre_chorus', 'chorus', 'verse', 'pre_chorus', 'chorus', 'bridge', 'chorus', 'vamp_out'],
  groove_breakdown_form: ['intro', 'verse', 'chorus', 'verse', 'chorus', 'breakdown', 'chorus', 'vamp_out'],
  steely_through_composed: ['intro', 'verse', 'verse', 'chorus', 'interlude', 'verse', 'chorus', 'bridge', 'chorus', 'vamp_out'],
  sylvers_dance_form: ['intro', 'verse', 'chorus', 'verse', 'chorus', 'breakdown', 'chorus', 'chorus', 'vamp_out'],
};

// ---------------------------------------------------------------------
// WRITER PROFILES — the actual "commonality within styles" request.
// Each writer is expressed as: a preferred form archetype, a harmonic
// preset (from harmony.ts) driving chord choice, and arrangement-device
// flags that are unique to that writer's identity within the shared form.
// This is the layer that answers "what do these five have in common"
// AND "what makes each one distinct" simultaneously.
// ---------------------------------------------------------------------
export type WriterId = 'bacharach' | 'sylvers' | 'mayfield' | 'sly_stone' | 'steely_dan';

export interface WriterProfile {
  preferredForm: FormArchetype;
  harmonyPreset: Preset;
  sectionLengthBars: Partial<Record<SectionRole, number>>; // default bar counts per role
  devices: {
    meterShifts: boolean;          // Bacharach signature: irregular bar lengths/meter changes
    keyChangeOnBridge: boolean;    // modulation as structural device
    breakdownToGroove: boolean;    // Sly/Mayfield: strip to rhythm section mid-song
    extendedVampOutro: boolean;    // Sylvers/Mayfield: long dance-groove ending
    hornsAsHarmonyCarrier: boolean;// horns/strings state the changes, not just color (Mayfield/Sylvers)
    chromaticInterludeModulation: boolean; // Bacharach/Fagen: interlude that pivots key via chromatic mediant
  };
}

export const WRITER_PROFILES: Record<WriterId, WriterProfile> = {
  bacharach: {
    preferredForm: 'verse_prechorus_chorus',
    harmonyPreset: 'jazz', // closest existing preset; irregular/sophisticated changes
    sectionLengthBars: { intro: 4, verse: 8, pre_chorus: 4, chorus: 8, bridge: 8, vamp_out: 4 },
    devices: {
      meterShifts: true,
      keyChangeOnBridge: true,
      breakdownToGroove: false,
      extendedVampOutro: false,
      hornsAsHarmonyCarrier: true,
      chromaticInterludeModulation: true,
    },
  },
  sylvers: {
    preferredForm: 'sylvers_dance_form',
    harmonyPreset: 'rnb',
    sectionLengthBars: { intro: 8, verse: 8, chorus: 8, breakdown: 8, vamp_out: 16 },
    devices: {
      meterShifts: false,
      keyChangeOnBridge: false,
      breakdownToGroove: true,
      extendedVampOutro: true,
      hornsAsHarmonyCarrier: true,
      chromaticInterludeModulation: false,
    },
  },
  mayfield: {
    preferredForm: 'groove_breakdown_form',
    harmonyPreset: 'soul',
    sectionLengthBars: { intro: 4, verse: 8, chorus: 8, breakdown: 8, vamp_out: 16 },
    devices: {
      meterShifts: false,
      keyChangeOnBridge: false,
      breakdownToGroove: true,
      extendedVampOutro: true,
      hornsAsHarmonyCarrier: true,
      chromaticInterludeModulation: false,
    },
  },
  sly_stone: {
    preferredForm: 'groove_breakdown_form',
    harmonyPreset: 'gospel',
    sectionLengthBars: { intro: 4, verse: 8, chorus: 8, breakdown: 8, vamp_out: 16 },
    devices: {
      meterShifts: false,
      keyChangeOnBridge: false,
      breakdownToGroove: true,
      extendedVampOutro: true,
      hornsAsHarmonyCarrier: true,
      chromaticInterludeModulation: false,
    },
  },
  steely_dan: {
    preferredForm: 'steely_through_composed',
    harmonyPreset: 'steely',
    sectionLengthBars: { intro: 4, verse: 8, chorus: 8, interlude: 4, bridge: 8, vamp_out: 8 },
    devices: {
      meterShifts: false,
      keyChangeOnBridge: true,
      breakdownToGroove: false,
      extendedVampOutro: true,
      hornsAsHarmonyCarrier: false,
      chromaticInterludeModulation: true,
    },
  },
};

// ---------------------------------------------------------------------
// COMPOSITE FRAMING — blend two or more writer profiles by weight, so
// you can say "70% Bacharach form, 30% Mayfield groove device" instead
// of being locked into one writer's template. This is what "commonality
// within styles" cashes out to mechanically: shared devices merge,
// conflicting structural choices resolve by weight.
// ---------------------------------------------------------------------
export interface FramingBlend {
  writers: { id: WriterId; weight: number }[];
}

export function resolveBlendedProfile(blend: FramingBlend): WriterProfile {
  // FIX: previously `[...blend.writers].sort(...)[0]` on an empty array is
  // `undefined`, and WRITER_PROFILES[undefined.id] throws. The function's
  // only current caller (App.tsx) happens to guard against this by
  // supplying a fallback writer before calling in, but that guard living
  // only in the caller is fragile — this function is exported and its own
  // contract should hold regardless of caller discipline.
  if (blend.writers.length === 0) {
    return WRITER_PROFILES.bacharach;
  }

  const total = blend.writers.reduce((s, w) => s + w.weight, 0);
  const dominant = [...blend.writers].sort((a, b) => b.weight - a.weight)[0];
  const base = WRITER_PROFILES[dominant.id];

  // Devices merge as OR-weighted-by-presence: a device is "on" in the blend
  // if writers carrying >= 30% of total weight have it on. This lets a
  // minority influence (e.g. 30% Mayfield in a mostly-Bacharach blend)
  // introduce a breakdown even though Bacharach himself doesn't use one.
  const deviceKeys = Object.keys(base.devices) as (keyof WriterProfile['devices'])[];
  const mergedDevices = {} as WriterProfile['devices'];
  for (const key of deviceKeys) {
    const supportWeight = blend.writers
      .filter(w => WRITER_PROFILES[w.id].devices[key])
      .reduce((s, w) => s + w.weight, 0);
    // FIX: if every writer's weight is 0, `total` is 0 and
    // `supportWeight / total` is 0/0 = NaN. `NaN >= 0.3` silently
    // evaluates to false in JS, so every device came out "off" with no
    // error — indistinguishable from a legitimate low-support result.
    // Falling back to the dominant writer's own device flags when total
    // weight is 0 is at least a defined, non-silent behavior.
    mergedDevices[key] = total > 0 ? supportWeight / total >= 0.3 : base.devices[key];
  }

  return {
    preferredForm: base.preferredForm,
    harmonyPreset: base.harmonyPreset,
    sectionLengthBars: base.sectionLengthBars,
    devices: mergedDevices,
  };
}

// ---------------------------------------------------------------------
// COMPILE: turn a WriterProfile (single or blended) into the SectionDef[]
// that engine.ts's generateProgression() already consumes. This is the
// actual "make song arrangements fully" step — song framing OUTPUT is
// valid input to everything already built.
// ---------------------------------------------------------------------
export interface FramedSong {
  sections: SectionDef[];
  roles: SectionRole[];          // parallel array: role per section, for downstream Ensemble/Rhythm layers
  devices: WriterProfile['devices'];
  harmonyPreset: Preset;
}

export function frameSong(profile: WriterProfile): FramedSong {
  const roleSequence = FORM_ARCHETYPES[profile.preferredForm];
  const sections: SectionDef[] = [];
  const roles: SectionRole[] = [];

  roleSequence.forEach((role, i) => {
    const roleProfile = SECTION_ROLE_PROFILES[role];
    const lengthBars = profile.sectionLengthBars[role] ?? 8;

    const section: SectionDef = {
      id: `${role}_${i}`,
      name: labelForRole(role, i, roleSequence),
      preset: profile.harmonyPreset,
      lengthBars,
      complexity: roleProfile.complexityBias as ComplexityLevel,
      chordsPerBar: roleProfile.chordsPerBar,
    };

    if (role === 'bridge' && profile.devices.keyChangeOnBridge) {
      section.keyShift = 3; // e.g. up a minor third
    }

    // FIX: chromaticInterludeModulation was set true for bacharach and
    // steely_dan, and its own doc comment promises "interlude that pivots
    // key via chromatic mediant" — but nothing ever read this flag. Every
    // interlude section came out with no key shift at all regardless of
    // the writer profile, even for steely_dan's form (steely_through_composed)
    // which specifically includes an 'interlude' role to exercise this
    // device. Chromatic mediant relationships share one common tone with
    // the original key; a major third (4 semitones) is the classic
    // Bacharach/Fagen interlude pivot, distinct from the bridge's minor-
    // third modulation above.
    if (role === 'interlude' && profile.devices.chromaticInterludeModulation) {
      section.keyShift = 4; // chromatic mediant, e.g. up a major third
    }

    sections.push(section);
    roles.push(role);
  });

  return { sections, roles, devices: profile.devices, harmonyPreset: profile.harmonyPreset };
}

function labelForRole(role: SectionRole, index: number, sequence: SectionRole[]): string {
  const occurrence = sequence.slice(0, index + 1).filter(r => r === role).length;
  const niceNames: Record<SectionRole, string> = {
    intro: 'Intro',
    verse: 'Verse',
    pre_chorus: 'Pre-Chorus',
    chorus: 'Chorus',
    bridge: 'Bridge',
    breakdown: 'Breakdown',
    vamp_out: 'Outro Vamp',
    interlude: 'Interlude',
  };
  return `${niceNames[role]} ${occurrence > 1 ? occurrence : ''}`.trim();
}
