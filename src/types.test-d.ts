import { assertType, expectTypeOf, describe, it } from 'vitest';
import { SectionDef, GeneratedChord, GeneratedSection, ComplexityLevel } from './lib/engine';
import { DrumStyle } from './theory/rhythmicReframer';

describe('Type Definitions', () => {
  it('ComplexityLevel should only be 1, 2, or 3', () => {
    expectTypeOf<ComplexityLevel>().toEqualTypeOf<1 | 2 | 3>();
  });

  it('SectionDef should match expected structure', () => {
    assertType<SectionDef>({
      id: 'test',
      name: 'Verse',
      preset: 'pop',
      lengthBars: 4,
    });
    
    // @ts-expect-error - lengthBars is required
    assertType<SectionDef>({
      id: 'test',
      name: 'Verse',
      preset: 'pop',
    });
  });

  it('DrumStyle should be a union of specific strings', () => {
    expectTypeOf<DrumStyle>().toBeString();
    expectTypeOf<'techno' | 'house' | 'trap'>().toMatchTypeOf<DrumStyle>();
  });

  it('GeneratedSection should allow optional drumPattern', () => {
    type Def = GeneratedSection['def'];
    expectTypeOf<Def>().toEqualTypeOf<SectionDef>();
    
    assertType<GeneratedSection>({
      def: { id: '1', name: 'A', preset: 'pop', lengthBars: 8 },
      chords: []
    });
  });
});
