import { describe, it, expect } from 'vitest';
import {
  planSongArc,
  type InstrumentFocus,
  type BassRole,
  type Texture,
  type SectionPlanning,
  type SongMacroPlan,
} from './arcPlanner';
import { SectionDef } from '../lib/engine';

function sec(overrides: Partial<SectionDef> & { id: string; name: string }): SectionDef {
  return {
    preset: 'jazz',
    lengthBars: 8,
    ...overrides,
  };
}

describe('planSongArc', () => {
  // ── Error / edge cases ──────────────────────────────────────────

  it('throws when given an empty array', () => {
    expect(() => planSongArc([])).toThrow('At least one section is required.');
  });

  // ── Single section ──────────────────────────────────────────────

  it('works with a single section', () => {
    const result = planSongArc([sec({ id: 's1', name: 'Verse 1' })]);
    expect(result.sections).toHaveLength(1);
    expect(result.sections[0].sectionId).toBe('s1');
    expect(result.sections[0].name).toBe('Verse 1');
  });

  // ── Full form: intro → verse → chorus → bridge → chorus → outro ─

  describe('full form (intro/verse/chorus/bridge/chorus/outro)', () => {
    const sections: SectionDef[] = [
      sec({ id: 's1', name: 'Intro' }),
      sec({ id: 's2', name: 'Verse 1' }),
      sec({ id: 's3', name: 'Chorus 1' }),
      sec({ id: 's4', name: 'Bridge' }),
      sec({ id: 's5', name: 'Chorus 2' }),
      sec({ id: 's6', name: 'Outro' }),
    ];
    const result = planSongArc(sections);

    it('returns one SectionPlanning per input section', () => {
      expect(result.sections).toHaveLength(6);
    });

    it('preserves section ids and names', () => {
      result.sections.forEach((s, i) => {
        expect(s.sectionId).toBe(sections[i].id);
        expect(s.name).toBe(sections[i].name);
      });
    });

    it('assigns low energy to intro (~20)', () => {
      const intro = result.sections[0];
      expect(intro.energyScore).toBe(20);
    });

    it('assigns high energy to choruses (smoothed down from 85)', () => {
      const c1 = result.sections[2];
      const c2 = result.sections[4];
      expect(c1.energyScore).toBeGreaterThanOrEqual(60);
      expect(c2.energyScore).toBeGreaterThanOrEqual(40);
    });

    it('assigns very low energy to outro (15)', () => {
      const outro = result.sections[5];
      expect(outro.energyScore).toBe(15);
    });

    it('bridge between choruses gets reduced energy (dip, smoothed from raw 55)', () => {
      const bridge = result.sections[3];
      expect(bridge.energyScore).toBeLessThanOrEqual(65);
    });

    it('infers arch arc type for this form', () => {
      expect(result.dynamicArcType).toBe('arch');
    });

    it('assigns sparse texture to intro', () => {
      expect(result.sections[0].voicingDensity).toBe('sparse');
    });

    it('assigns transparent texture to bridge', () => {
      expect(result.sections[3].voicingDensity).toBe('transparent');
    });

    it('assigns sparse texture to outro', () => {
      expect(result.sections[5].voicingDensity).toBe('sparse');
    });

    it('assigns pedal bass role to intro', () => {
      expect(result.sections[0].bassRole).toBe('pedal');
    });

    it('assigns driving bass role to chorus', () => {
      expect(result.sections[2].bassRole).toBe('driving');
    });

    it('assigns melodic bass role to bridge', () => {
      expect(result.sections[3].bassRole).toBe('melodic');
    });

    it('assigns pedal bass role to outro', () => {
      expect(result.sections[5].bassRole).toBe('pedal');
    });

    it('sets ambientMode for intro, bridge, and outro', () => {
      expect(result.sections[0].ambientMode).toBe(true);
      expect(result.sections[3].ambientMode).toBe(true);
      expect(result.sections[5].ambientMode).toBe(true);
    });

    it('does not set ambientMode for verse and chorus', () => {
      expect(result.sections[1].ambientMode).toBe(false);
      expect(result.sections[2].ambientMode).toBe(false);
    });

    it('generates overallDescription text', () => {
      expect(result.overallDescription).toContain('Dynamic arc:');
      expect(result.overallDescription).toContain('arch');
    });

    it('generates tempoMap with default bpm for every section', () => {
      expect(result.tempoMap).toHaveLength(6);
      result.tempoMap!.forEach((t) => {
        expect(t.bpm).toBe(120);
      });
    });
  });

  // ── Complexity ──────────────────────────────────────────────────

  describe('complexity levels', () => {
    it('derives complexity from energy when not overridden', () => {
      const sections: SectionDef[] = [
        sec({ id: 'i', name: 'Intro' }),         // low energy → 1
        sec({ id: 'v', name: 'Verse 1' }),       // mid energy → 2
        sec({ id: 'c', name: 'Chorus 1' }),      // high energy → 3
      ];
      const result = planSongArc(sections);
      expect(result.sections[0].targetComplexity).toBe(1);
      expect(result.sections[2].targetComplexity).toBe(3);
    });

    it('respects user complexity override', () => {
      const sections: SectionDef[] = [
        sec({ id: 'c', name: 'Chorus 1', complexity: 1 }),
      ];
      const result = planSongArc(sections);
      expect(result.sections[0].targetComplexity).toBe(1);
    });
  });

  // ── Instrumentation focus ───────────────────────────────────────

  describe('instrumentation focus', () => {
    it('assigns keys_only when energy is low (<35)', () => {
      const sections: SectionDef[] = [
        sec({ id: 'i', name: 'Intro' }),
      ];
      const result = planSongArc(sections);
      expect(result.sections[0].instrumentationFocus).toBe('keys_only');
    });

    it('assigns rhythm_section for mid energy non-chorus', () => {
      const sections: SectionDef[] = [
        sec({ id: 'v', name: 'Verse 1' }),
      ];
      const result = planSongArc(sections);
      expect(result.sections[0].instrumentationFocus).toBe('rhythm_section');
    });

    it('assigns solo_lead for solo role', () => {
      const sections: SectionDef[] = [
        sec({ id: 's', name: 'Solo 1' }),
      ];
      const result = planSongArc(sections);
      expect(result.sections[0].instrumentationFocus).toBe('solo_lead');
    });

    it('assigns full_band for high-energy chorus', () => {
      const sections: SectionDef[] = [
        sec({ id: 'c', name: 'Chorus 1' }),
      ];
      const result = planSongArc(sections);
      expect(result.sections[0].instrumentationFocus).toBe('full_band');
    });
  });

  // ── Arc type inference ──────────────────────────────────────────

  describe('arc type inference', () => {
    it('infers wave for intro→verse→chorus→verse→chorus→outro', () => {
      const sections: SectionDef[] = [
        sec({ id: '1', name: 'Intro' }),
        sec({ id: '2', name: 'Verse 1' }),
        sec({ id: '3', name: 'Chorus 1' }),
        sec({ id: '4', name: 'Verse 2' }),
        sec({ id: '5', name: 'Chorus 2' }),
        sec({ id: '6', name: 'Outro' }),
      ];
      expect(planSongArc(sections).dynamicArcType).toBe('wave');
    });

    it('infers plateau for intro→chorus→chorus→chorus→outro', () => {
      const sections: SectionDef[] = [
        sec({ id: '1', name: 'Intro' }),
        sec({ id: '2', name: 'Chorus 1' }),
        sec({ id: '3', name: 'Chorus 2' }),
        sec({ id: '4', name: 'Chorus 3' }),
        sec({ id: '5', name: 'Outro' }),
      ];
      expect(planSongArc(sections).dynamicArcType).toBe('plateau');
    });

    it('infers crescent when few choruses/solos', () => {
      const sections: SectionDef[] = [
        sec({ id: '1', name: 'Intro' }),
        sec({ id: '2', name: 'Verse 1' }),
        sec({ id: '3', name: 'Verse 2' }),
        sec({ id: '4', name: 'Outro' }),
      ];
      expect(planSongArc(sections).dynamicArcType).toBe('crescent');
    });

    it('infers terraced for patterns with chorus+but fewer than 3 choruses', () => {
      const sections: SectionDef[] = [
        sec({ id: '1', name: 'Intro' }),
        sec({ id: '2', name: 'Verse 1' }),
        sec({ id: '3', name: 'Chorus 1' }),
        sec({ id: '4', name: 'Verse 2' }),
        sec({ id: '5', name: 'Solo 1' }),
      ];
      expect(planSongArc(sections).dynamicArcType).toBe('terraced');
    });
  });

  // ── Role identification edge cases ──────────────────────────────

  describe('role identification edge cases', () => {
    it('identifies prechorus from "Pre Chorus" and "Climb"', () => {
      const sections: SectionDef[] = [
        sec({ id: '1', name: 'Pre Chorus' }),
        sec({ id: '2', name: 'Climb' }),
      ];
      const result = planSongArc(sections);
      result.sections.forEach((s) => {
        expect(s.bassRole).toBe('walking');
      });
    });

    it('identifies outro from "Coda" and "Ending"', () => {
      const sections: SectionDef[] = [
        sec({ id: '1', name: 'Coda' }),
        sec({ id: '2', name: 'Ending' }),
      ];
      const result = planSongArc(sections);
      const lastSection = result.sections[result.sections.length - 1];
      expect(lastSection.energyScore).toBe(15);
      expect(lastSection.bassRole).toBe('pedal');
      expect(lastSection.ambientMode).toBe(true);
    });

    it('identifies breakdown from "Drop"', () => {
      const sections: SectionDef[] = [
        sec({ id: '1', name: 'Drop' }),
      ];
      const result = planSongArc(sections);
      expect(result.sections[0].bassRole).toBe('anchor');
    });

    it('identifies bridge from "Middle 8"', () => {
      const sections: SectionDef[] = [
        sec({ id: '1', name: 'Middle 8' }),
      ];
      const result = planSongArc(sections);
      expect(result.sections[0].bassRole).toBe('melodic');
      expect(result.sections[0].voicingDensity).toBe('transparent');
    });

    it('identifies solo from "Lead" and "Improv"', () => {
      const sections: SectionDef[] = [
        sec({ id: '1', name: 'Lead Break' }),
        sec({ id: '2', name: 'Improv Section' }),
      ];
      const result = planSongArc(sections);
      expect(result.sections[0].instrumentationFocus).toBe('solo_lead');
      expect(result.sections[1].instrumentationFocus).toBe('solo_lead');
    });

    it('returns unknown role for unrecognized names (energy ~50)', () => {
      const sections: SectionDef[] = [
        sec({ id: '1', name: 'Mystery Section' }),
      ];
      const result = planSongArc(sections);
      expect(result.sections[0].energyScore).toBe(50);
    });
  });

  // ── Bass role evolution ─────────────────────────────────────────

  describe('bass role evolution', () => {
    it('verse with low energy gets anchor', () => {
      const sectionsLow: SectionDef[] = [
        sec({ id: '1', name: 'Verse 1' }),
      ];
      const resultLow = planSongArc(sectionsLow);
      expect(resultLow.sections[0].bassRole).toBe('anchor');
    });

    it('prechorus gets walking bass', () => {
      const sections: SectionDef[] = [
        sec({ id: '1', name: 'Pre Chorus' }),
      ];
      const result = planSongArc(sections);
      expect(result.sections[0].bassRole).toBe('walking');
    });

    it('solo gets driving bass', () => {
      const sections: SectionDef[] = [
        sec({ id: '1', name: 'Solo 1' }),
      ];
      const result = planSongArc(sections);
      expect(result.sections[0].bassRole).toBe('driving');
    });

    it('breakdown gets anchor bass', () => {
      const sections: SectionDef[] = [
        sec({ id: '1', name: 'Breakdown' }),
      ];
      const result = planSongArc(sections);
      expect(result.sections[0].bassRole).toBe('anchor');
    });
  });

  // ── Texture / voicing density ───────────────────────────────────

  describe('voicing density', () => {
    it('assigns massive for very high energy (≥80)', () => {
      const sections: SectionDef[] = [
        sec({ id: '1', name: 'Solo 1' }),
      ];
      const result = planSongArc(sections);
      expect(result.sections[0].voicingDensity).toBe('massive');
    });

    it('assigns dense for energy 50-79', () => {
      const sections: SectionDef[] = [
        sec({ id: '1', name: 'Verse 1' }),
        sec({ id: '2', name: 'Chorus 1' }),
        sec({ id: '3', name: 'Verse 2' }),
        sec({ id: '4', name: 'Chorus 2' }),
      ];
      const result = planSongArc(sections);
      const verse = result.sections[0];
      if (verse.energyScore >= 50 && verse.energyScore < 80) {
        expect(verse.voicingDensity).toBe('dense');
      }
    });

    it('assigns sparse for energy <30', () => {
      const sections: SectionDef[] = [
        sec({ id: '1', name: 'Intro' }),
      ];
      const result = planSongArc(sections);
      expect(result.sections[0].voicingDensity).toBe('sparse');
    });

    it('bridge always gets transparent regardless of energy', () => {
      const sections: SectionDef[] = [
        sec({ id: '1', name: 'Bridge' }),
      ];
      const result = planSongArc(sections);
      expect(result.sections[0].voicingDensity).toBe('transparent');
    });
  });

  // ── Key shift passthrough ───────────────────────────────────────

  describe('keyShift', () => {
    it('passes through user-defined keyShift', () => {
      const sections: SectionDef[] = [
        sec({ id: '1', name: 'Bridge', keyShift: 3 }),
      ];
      const result = planSongArc(sections);
      expect(result.sections[0].keyShift).toBe(3);
    });

    it('defaults to 0 when keyShift is not provided', () => {
      const sections: SectionDef[] = [
        sec({ id: '1', name: 'Verse 1' }),
      ];
      const result = planSongArc(sections);
      expect(result.sections[0].keyShift).toBe(0);
    });
  });

  // ── Track activity ──────────────────────────────────────────────

  describe('track activity', () => {
    it('returns track activity object with all five instrument fields', () => {
      const sections: SectionDef[] = [
        sec({ id: '1', name: 'Chorus 1' }),
      ];
      const result = planSongArc(sections);
      const activity = result.sections[0].trackActivity;
      expect(activity).toHaveProperty('drums');
      expect(activity).toHaveProperty('bass');
      expect(activity).toHaveProperty('keys');
      expect(activity).toHaveProperty('guitar');
      expect(activity).toHaveProperty('pads');
    });

    it('clamps all activity values to [0, 1]', () => {
      const sections: SectionDef[] = [
        sec({ id: '1', name: 'Solo 1' }),
      ];
      const result = planSongArc(sections);
      const activity = result.sections[0].trackActivity;
      expect(activity.drums).toBeGreaterThanOrEqual(0);
      expect(activity.drums).toBeLessThanOrEqual(1);
      expect(activity.bass).toBeGreaterThanOrEqual(0);
      expect(activity.bass).toBeLessThanOrEqual(1);
      expect(activity.keys).toBeGreaterThanOrEqual(0);
      expect(activity.keys).toBeLessThanOrEqual(1);
      expect(activity.guitar).toBeGreaterThanOrEqual(0);
      expect(activity.guitar).toBeLessThanOrEqual(1);
      expect(activity.pads).toBeGreaterThanOrEqual(0);
      expect(activity.pads).toBeLessThanOrEqual(1);
    });

    it('intro has reduced drums and bass', () => {
      const sections: SectionDef[] = [
        sec({ id: '1', name: 'Intro' }),
      ];
      const result = planSongArc(sections);
      const a = result.sections[0].trackActivity;
      expect(a.drums).toBeLessThan(a.keys);
    });

    it('solo section reduces drums and bass relative to keys/guitar', () => {
      const sections: SectionDef[] = [
        sec({ id: '1', name: 'Solo 1' }),
      ];
      const result = planSongArc(sections);
      const a = result.sections[0].trackActivity;
      expect(a.drums).toBeLessThan(a.keys);
    });
  });

  // ── Smooth energy ───────────────────────────────────────────────

  describe('energy smoothing', () => {
    it('first and last sections keep raw energy (no smoothing)', () => {
      const sections: SectionDef[] = [
        sec({ id: '1', name: 'Intro' }),
        sec({ id: '2', name: 'Verse 1' }),
        sec({ id: '3', name: 'Outro' }),
      ];
      const result = planSongArc(sections);
      expect(result.sections[0].energyScore).toBe(20);
      expect(result.sections[2].energyScore).toBe(15);
    });

    it('middle sections are smoothed (average of neighbors)', () => {
      const sections: SectionDef[] = [
        sec({ id: '1', name: 'Verse 1' }),
        sec({ id: '2', name: 'Chorus 1' }),
        sec({ id: '3', name: 'Verse 2' }),
      ];
      const result = planSongArc(sections);
      const rawVerse1 = 40;
      const rawChorus = 85;
      const rawVerse2 = 40;
      const expectedSmoothed = (rawVerse1 + rawChorus * 2 + rawVerse2) / 4;
      expect(result.sections[1].energyScore).toBe(Math.round(expectedSmoothed));
    });
  });

  // ── Outro fade ──────────────────────────────────────────────────

  describe('outro fade', () => {
    it('second-to-last section is capped at 50 when last is outro', () => {
      const sections: SectionDef[] = [
        sec({ id: '1', name: 'Verse 1' }),
        sec({ id: '2', name: 'Chorus 1' }),
        sec({ id: '3', name: 'Outro' }),
      ];
      const result = planSongArc(sections);
      expect(result.sections[1].energyScore).toBeLessThanOrEqual(50);
    });
  });

  // ── Preset override passthrough ─────────────────────────────────

  describe('presetOverride', () => {
    it('does not set presetOverride when SectionDef has no presetOverride', () => {
      const sections: SectionDef[] = [
        sec({ id: '1', name: 'Verse 1' }),
      ];
      const result = planSongArc(sections);
      expect(result.sections[0].presetOverride).toBeUndefined();
    });
  });
});
