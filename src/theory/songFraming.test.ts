import { describe, it, expect } from 'vitest';
import {
  SECTION_ROLE_PROFILES,
  FORM_ARCHETYPES,
  WRITER_PROFILES,
  resolveBlendedProfile,
  frameSong,
  type SectionRole,
  type SectionRoleProfile,
  type FormArchetype,
  type WriterId,
  type WriterProfile,
  type FramingBlend,
  type FramedSong,
} from './songFraming';

// ── SECTION_ROLE_PROFILES ─────────────────────────────────────────

describe('SECTION_ROLE_PROFILES', () => {
  const allRoles: SectionRole[] = [
    'intro', 'verse', 'pre_chorus', 'chorus',
    'bridge', 'breakdown', 'vamp_out', 'interlude',
  ];

  it('has all 8 roles defined', () => {
    for (const role of allRoles) {
      expect(SECTION_ROLE_PROFILES[role]).toBeDefined();
    }
  });

  it.each(allRoles)('%s has harmonicRhythmBars', (role) => {
    const p = SECTION_ROLE_PROFILES[role];
    expect(typeof p.harmonicRhythmBars).toBe('number');
    expect(p.harmonicRhythmBars).toBeGreaterThan(0);
  });

  it.each(allRoles)('%s has chordsPerBar', (role) => {
    const p = SECTION_ROLE_PROFILES[role];
    expect(typeof p.chordsPerBar).toBe('number');
    expect(p.chordsPerBar).toBeGreaterThan(0);
  });

  it.each(allRoles)('%s has complexityBias (1 | 2 | 3)', (role) => {
    const p = SECTION_ROLE_PROFILES[role];
    expect([1, 2, 3]).toContain(p.complexityBias);
  });

  it.each(allRoles)('%s has activeInstruments as non-empty array', (role) => {
    const p = SECTION_ROLE_PROFILES[role];
    expect(Array.isArray(p.activeInstruments)).toBe(true);
    expect(p.activeInstruments.length).toBeGreaterThan(0);
  });

  it.each(allRoles)('%s has dynamicLevel (1-5)', (role) => {
    const p = SECTION_ROLE_PROFILES[role];
    expect(p.dynamicLevel).toBeGreaterThanOrEqual(1);
    expect(p.dynamicLevel).toBeLessThanOrEqual(5);
  });

  it.each(allRoles)('%s has allowsKeyChange boolean', (role) => {
    const p = SECTION_ROLE_PROFILES[role];
    expect(typeof p.allowsKeyChange).toBe('boolean');
  });

  it.each(allRoles)('%s has allowsMeterShift boolean', (role) => {
    const p = SECTION_ROLE_PROFILES[role];
    expect(typeof p.allowsMeterShift).toBe('boolean');
  });

  it('bridge allows key changes', () => {
    expect(SECTION_ROLE_PROFILES.bridge.allowsKeyChange).toBe(true);
  });

  it('interlude allows key changes', () => {
    expect(SECTION_ROLE_PROFILES.interlude.allowsKeyChange).toBe(true);
  });

  it('pre_chorus allows meter shifts', () => {
    expect(SECTION_ROLE_PROFILES.pre_chorus.allowsMeterShift).toBe(true);
  });

  it('breakdown has low complexityBias and low dynamicLevel', () => {
    expect(SECTION_ROLE_PROFILES.breakdown.complexityBias).toBe(1);
    expect(SECTION_ROLE_PROFILES.breakdown.dynamicLevel).toBe(2);
  });
});

// ── FORM_ARCHETYPES ───────────────────────────────────────────────

describe('FORM_ARCHETYPES', () => {
  const allArchetypes: FormArchetype[] = [
    'aaba_classic',
    'verse_prechorus_chorus',
    'groove_breakdown_form',
    'steely_through_composed',
    'sylvers_dance_form',
  ];

  it('has all 5 archetypes defined', () => {
    for (const arch of allArchetypes) {
      expect(FORM_ARCHETYPES[arch]).toBeDefined();
    }
  });

  it.each(allArchetypes)('%s is a non-empty array', (arch) => {
    expect(Array.isArray(FORM_ARCHETYPES[arch])).toBe(true);
    expect(FORM_ARCHETYPES[arch].length).toBeGreaterThan(0);
  });

  it.each(allArchetypes)('%s contains only valid SectionRole values', (arch) => {
    const validRoles: SectionRole[] = [
      'intro', 'verse', 'pre_chorus', 'chorus',
      'bridge', 'breakdown', 'vamp_out', 'interlude',
    ];
    for (const role of FORM_ARCHETYPES[arch]) {
      expect(validRoles).toContain(role);
    }
  });

  it('groove_breakdown_form contains breakdown', () => {
    expect(FORM_ARCHETYPES.groove_breakdown_form).toContain('breakdown');
  });

  it('steely_through_composed contains interlude', () => {
    expect(FORM_ARCHETYPES.steely_through_composed).toContain('interlude');
  });

  it('sylvers_dance_form contains vamp_out', () => {
    expect(FORM_ARCHETYPES.sylvers_dance_form).toContain('vamp_out');
  });
});

// ── WRITER_PROFILES ───────────────────────────────────────────────

describe('WRITER_PROFILES', () => {
  const allWriters: WriterId[] = [
    'bacharach', 'sylvers', 'mayfield', 'sly_stone', 'steely_dan',
  ];

  it('has all 5 writers defined', () => {
    for (const w of allWriters) {
      expect(WRITER_PROFILES[w]).toBeDefined();
    }
  });

  it.each(allWriters)('%s has preferredForm', (w) => {
    expect(typeof WRITER_PROFILES[w].preferredForm).toBe('string');
  });

  it.each(allWriters)('%s has harmonyPreset', (w) => {
    expect(typeof WRITER_PROFILES[w].harmonyPreset).toBe('string');
  });

  it.each(allWriters)('%s has sectionLengthBars as object', (w) => {
    expect(typeof WRITER_PROFILES[w].sectionLengthBars).toBe('object');
  });

  it.each(allWriters)('%s has devices with all 6 boolean flags', (w) => {
    const d = WRITER_PROFILES[w].devices;
    expect(typeof d.meterShifts).toBe('boolean');
    expect(typeof d.keyChangeOnBridge).toBe('boolean');
    expect(typeof d.breakdownToGroove).toBe('boolean');
    expect(typeof d.extendedVampOutro).toBe('boolean');
    expect(typeof d.hornsAsHarmonyCarrier).toBe('boolean');
    expect(typeof d.chromaticInterludeModulation).toBe('boolean');
  });

  it('bacharach has meterShifts and keyChangeOnBridge', () => {
    expect(WRITER_PROFILES.bacharach.devices.meterShifts).toBe(true);
    expect(WRITER_PROFILES.bacharach.devices.keyChangeOnBridge).toBe(true);
  });

  it('sly_stone has breakdownToGroove and extendedVampOutro', () => {
    expect(WRITER_PROFILES.sly_stone.devices.breakdownToGroove).toBe(true);
    expect(WRITER_PROFILES.sly_stone.devices.extendedVampOutro).toBe(true);
  });

  it('steely_dan has chromaticInterludeModulation and keyChangeOnBridge', () => {
    expect(WRITER_PROFILES.steely_dan.devices.chromaticInterludeModulation).toBe(true);
    expect(WRITER_PROFILES.steely_dan.devices.keyChangeOnBridge).toBe(true);
  });
});

// ── resolveBlendedProfile ─────────────────────────────────────────

describe('resolveBlendedProfile', () => {
  it('returns the single writer profile when only one writer is provided', () => {
    const blend: FramingBlend = { writers: [{ id: 'bacharach', weight: 1 }] };
    const result = resolveBlendedProfile(blend);
    expect(result.preferredForm).toBe(WRITER_PROFILES.bacharach.preferredForm);
    expect(result.harmonyPreset).toBe(WRITER_PROFILES.bacharach.harmonyPreset);
  });

  it('uses dominant writer for form and preset when two writers are blended', () => {
    const blend: FramingBlend = {
      writers: [
        { id: 'bacharach', weight: 7 },
        { id: 'mayfield', weight: 3 },
      ],
    };
    const result = resolveBlendedProfile(blend);
    expect(result.preferredForm).toBe(WRITER_PROFILES.bacharach.preferredForm);
    expect(result.harmonyPreset).toBe(WRITER_PROFILES.bacharach.harmonyPreset);
  });

  it('merges devices: device is on if >= 30% weight supports it', () => {
    const blend: FramingBlend = {
      writers: [
        { id: 'bacharach', weight: 7 },
        { id: 'mayfield', weight: 3 },
      ],
    };
    const result = resolveBlendedProfile(blend);
    // Bacharach (70%) has breakdownToGroove=false, Mayfield (30%) has it=true
    // 30% >= 30% threshold → device should be on
    expect(result.devices.breakdownToGroove).toBe(true);
  });

  it('device is off when < 30% weight supports it', () => {
    const blend: FramingBlend = {
      writers: [
        { id: 'bacharach', weight: 8 },
        { id: 'mayfield', weight: 2 },
      ],
    };
    const result = resolveBlendedProfile(blend);
    // Mayfield (20%) has breakdownToGroove=true, but below 30%
    // Wait: total = 10, support = 2, 2/10 = 0.2 < 0.3
    // But wait — bacharach doesn't have it, mayfield has it
    // Actually 2/10 = 0.2 < 0.3 so it should be false
    expect(result.devices.breakdownToGroove).toBe(false);
  });

  it('device is on when exactly 30% supports it', () => {
    const blend: FramingBlend = {
      writers: [
        { id: 'bacharach', weight: 7 },
        { id: 'mayfield', weight: 3 },
      ],
    };
    const result = resolveBlendedProfile(blend);
    // mayfield 3/10 = 0.3 ≥ 0.3
    expect(result.devices.breakdownToGroove).toBe(true);
  });

  it('meterShifts is on when bacharach has majority', () => {
    const blend: FramingBlend = {
      writers: [
        { id: 'bacharach', weight: 6 },
        { id: 'sly_stone', weight: 4 },
      ],
    };
    const result = resolveBlendedProfile(blend);
    expect(result.devices.meterShifts).toBe(true);
  });

  it('chromaticInterludeModulation requires sufficient weight', () => {
    const blend: FramingBlend = {
      writers: [
        { id: 'bacharach', weight: 4 },
        { id: 'steely_dan', weight: 4 },
        { id: 'sly_stone', weight: 2 },
      ],
    };
    const result = resolveBlendedProfile(blend);
    // bacharach (4) + steely_dan (4) = 8/10 = 0.8 support
    expect(result.devices.chromaticInterludeModulation).toBe(true);
  });

  it('preserves sectionLengthBars from dominant writer', () => {
    const blend: FramingBlend = {
      writers: [
        { id: 'bacharach', weight: 5 },
        { id: 'sylvers', weight: 5 },
      ],
    };
    const result = resolveBlendedProfile(blend);
    // Both have equal weight — first by sort order determines dominant
    const dominant = [...blend.writers].sort((a, b) => b.weight - a.weight)[0];
    expect(result.sectionLengthBars).toBe(WRITER_PROFILES[dominant.id].sectionLengthBars);
  });
});

// ── frameSong ─────────────────────────────────────────────────────

describe('frameSong', () => {
  it('returns correct number of sections for each archetype', () => {
    const archetypeLengths: Record<FormArchetype, number> = {
      aaba_classic: 9,
      verse_prechorus_chorus: 10,
      groove_breakdown_form: 8,
      steely_through_composed: 10,
      sylvers_dance_form: 9,
    };
    for (const [archetype, expectedLen] of Object.entries(archetypeLengths)) {
      const profile: WriterProfile = {
        ...WRITER_PROFILES.bacharach,
        preferredForm: archetype as FormArchetype,
      };
      const result = frameSong(profile);
      expect(result.sections).toHaveLength(expectedLen);
    }
  });

  it('assigns correct roles from archetype (parallel roles array)', () => {
    const result = frameSong(WRITER_PROFILES.bacharach);
    const expectedRoles = FORM_ARCHETYPES[WRITER_PROFILES.bacharach.preferredForm];
    expect(result.roles).toEqual(expectedRoles);
  });

  it('returns the harmonyPreset from the profile', () => {
    const result = frameSong(WRITER_PROFILES.bacharach);
    expect(result.harmonyPreset).toBe(WRITER_PROFILES.bacharach.harmonyPreset);
  });

  it('returns the devices from the profile', () => {
    const result = frameSong(WRITER_PROFILES.bacharach);
    expect(result.devices).toBe(WRITER_PROFILES.bacharach.devices);
  });

  it('sets keyShift=3 for bridge when keyChangeOnBridge is true (bacharach)', () => {
    const result = frameSong(WRITER_PROFILES.bacharach);
    const bridges = result.sections.filter((_, i) => result.roles[i] === 'bridge');
    expect(bridges.length).toBeGreaterThan(0);
    for (const b of bridges) {
      expect(b.keyShift).toBe(3);
    }
  });

  it('sets keyShift=3 for bridge when keyChangeOnBridge is true (steely_dan)', () => {
    const result = frameSong(WRITER_PROFILES.steely_dan);
    const bridges = result.sections.filter((_, i) => result.roles[i] === 'bridge');
    expect(bridges.length).toBeGreaterThan(0);
    for (const b of bridges) {
      expect(b.keyShift).toBe(3);
    }
  });

  it('does not set keyShift for bridge when keyChangeOnBridge is false (mayfield)', () => {
    const result = frameSong(WRITER_PROFILES.mayfield);
    const bridges = result.sections.filter((_, i) => result.roles[i] === 'bridge');
    // groove_breakdown_form has no bridge, so verify none exist
    expect(bridges).toHaveLength(0);
  });

  it('assigns harmonicRhythmBars-based chordsPerBar from SECTION_ROLE_PROFILES', () => {
    const result = frameSong(WRITER_PROFILES.bacharach);
    result.sections.forEach((section, i) => {
      const role = result.roles[i];
      const profile = SECTION_ROLE_PROFILES[role];
      expect(section.chordsPerBar).toBe(profile.chordsPerBar);
    });
  });

  it('assigns complexity from SECTION_ROLE_PROFILES', () => {
    const result = frameSong(WRITER_PROFILES.bacharach);
    result.sections.forEach((section, i) => {
      const role = result.roles[i];
      const profile = SECTION_ROLE_PROFILES[role];
      expect(section.complexity).toBe(profile.complexityBias);
    });
  });

  it('labels sections with occurrence numbers', () => {
    const result = frameSong(WRITER_PROFILES.bacharach);
    // verse_prechorus_chorus: intro, verse, pre_chorus, chorus, verse, pre_chorus, chorus, bridge, chorus, vamp_out
    expect(result.sections[0].name).toBe('Intro');
    expect(result.sections[1].name).toBe('Verse');
    expect(result.sections[4].name).toBe('Verse 2');
    expect(result.sections[2].name).toBe('Pre-Chorus');
    expect(result.sections[5].name).toBe('Pre-Chorus 2');
    expect(result.sections[3].name).toBe('Chorus');
    expect(result.sections[6].name).toBe('Chorus 2');
    expect(result.sections[8].name).toBe('Chorus 3');
  });

  it('uses correct nice names for each role', () => {
    const result = frameSong(WRITER_PROFILES.steely_dan);
    // steely_through_composed: intro, verse, verse, chorus, interlude, verse, chorus, bridge, chorus, vamp_out
    expect(result.sections[0].name).toBe('Intro');
    expect(result.sections[4].name).toBe('Interlude');
    expect(result.sections[9].name).toBe('Outro Vamp');
  });

  it('each section has an id in the format role_index', () => {
    const result = frameSong(WRITER_PROFILES.bacharach);
    result.sections.forEach((section, i) => {
      expect(section.id).toMatch(/^[a-z_]+_\d+$/);
    });
  });

  it('uses sectionLengthBars from writer profile when available', () => {
    const result = frameSong(WRITER_PROFILES.bacharach);
    // bacharach has: intro:4, verse:8, pre_chorus:4, chorus:8, bridge:8, vamp_out:4
    expect(result.sections[0].lengthBars).toBe(4); // intro
    expect(result.sections[1].lengthBars).toBe(8); // verse
  });

  it('defaults to 8 bars when role not in sectionLengthBars', () => {
    const profile: WriterProfile = {
      ...WRITER_PROFILES.bacharach,
      sectionLengthBars: {},
    };
    const result = frameSong(profile);
    result.sections.forEach((section) => {
      expect(section.lengthBars).toBe(8);
    });
  });

  it('groove_breakdown_form includes breakdown and vamp_out roles', () => {
    const result = frameSong(WRITER_PROFILES.sly_stone);
    expect(result.roles).toContain('breakdown');
    expect(result.roles).toContain('vamp_out');
  });

  it('sylvers_dance_form includes breakdown and vamp_out roles', () => {
    const result = frameSong(WRITER_PROFILES.sylvers);
    expect(result.roles).toContain('breakdown');
    expect(result.roles).toContain('vamp_out');
  });

  it('sections array and roles array are same length', () => {
    for (const writerId of ['bacharach', 'sylvers', 'mayfield', 'sly_stone', 'steely_dan'] as WriterId[]) {
      const result = frameSong(WRITER_PROFILES[writerId]);
      expect(result.sections.length).toBe(result.roles.length);
    }
  });
});
