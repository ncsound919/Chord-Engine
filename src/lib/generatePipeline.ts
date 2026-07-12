import { planSongArc } from '../theory/arcPlanner';
import { generateProgression, SectionDef, GeneratedSection, GeneratedChord, substituteChord, hydrateSectionChords, KEYS } from './engine';
import { generateMelodyForSection } from '../theory/melody';
import { resolveBlendedProfile, frameSong, WriterId } from '../theory/songFraming';
import { reframeSong, ReframeTarget } from '../theory/rhythmicReframer';
import { createPRNG } from './prng';
import { buildNodeSet } from '../theory/harmony';
import { chordTonesForQuality } from '../theory/pitch';
import { generateVoicingCandidates } from '../theory/voicing';
import { generateFingerableShapes } from '../theory/fretboard';

export interface GenerateInput {
  musicKey: string;
  seed: string;
  sections: SectionDef[];
  writerWeights: Record<WriterId, number>;
  reframeTarget: 'none' | ReframeTarget;
}

export function runGenerationPipeline(input: GenerateInput): GeneratedSection[] {
  const arcPlan = planSongArc(input.sections);
  const plannedSections = input.sections.map(s => {
    const plan = arcPlan.sections.find(p => p.sectionId === s.id);
    return { ...s, complexity: s.complexity || plan?.targetComplexity || 2 };
  });
  const result = generateProgression(input.musicKey, plannedSections, input.seed);
  const resultWithMelody = result.map(section => ({
    ...section,
    melody: generateMelodyForSection(section, input.musicKey, input.seed),
  }));
  const activeWriters = (Object.entries(input.writerWeights) as [WriterId, number][])
    .filter(([_, w]) => w > 0)
    .map(([id, w]) => ({ id, weight: w }));
  const blendedProfile = resolveBlendedProfile({
    writers: activeWriters.length > 0 ? activeWriters : [{ id: 'bacharach', weight: 100 }]
  });
  const framedSong = frameSong(blendedProfile);
  return reframeSong(
    framedSong,
    resultWithMelody,
    input.reframeTarget !== 'none' ? input.reframeTarget : 'boom_bap',
    arcPlan.sections
  );
}

export function compileAndGenerate(input: GenerateInput): { sections: SectionDef[]; generated: GeneratedSection[] } {
  const activeWriters = (Object.entries(input.writerWeights) as [WriterId, number][])
    .filter(([_, w]) => w > 0)
    .map(([id, w]) => ({ id, weight: w }));
  const blendedProfile = resolveBlendedProfile({
    writers: activeWriters.length > 0 ? activeWriters : [{ id: 'bacharach', weight: 100 }]
  });
  const framed = frameSong(blendedProfile);
  const arcPlan = planSongArc(framed.sections);
  const plannedSections = framed.sections.map(s => {
    const plan = arcPlan.sections.find(p => p.sectionId === s.id);
    return { ...s, complexity: s.complexity || plan?.targetComplexity || 2 };
  });
  const result = generateProgression(input.musicKey, plannedSections, input.seed);
  const resultWithMelody = result.map(section => ({
    ...section,
    melody: generateMelodyForSection(section, input.musicKey, input.seed),
  }));
  const reframed = reframeSong(framed, resultWithMelody, input.reframeTarget !== 'none' ? input.reframeTarget : 'boom_bap', arcPlan.sections);
  return { sections: framed.sections, generated: reframed };
}

export function renumberBars(chords: GeneratedChord[]): GeneratedChord[] {
  let bar = 1;
  let lastBar = -1;
  return chords.map(c => {
    if (lastBar !== -1 && c.bar !== lastBar) bar++;
    lastBar = c.bar;
    return { ...c, bar };
  });
}

export interface SubstitutionResult {
  generated: GeneratedSection[];
}

export function applySubstitution(
  generated: GeneratedSection[],
  secIdx: number,
  chordIdx: number,
  subType: string,
  musicKey: string,
  seed: string
): GeneratedSection[] {
  if (subType === 'add_blank_section') {
    return [...generated, {
      def: { id: Date.now().toString(), name: 'Custom', preset: 'pop' as any, lengthBars: 4, complexity: 2 as any },
      chords: []
    }];
  }

  if (secIdx < 0 || !generated[secIdx]) return generated;

  if (subType.startsWith('add_chord:')) {
    const roman = subType.split(':')[1];
    const prng = createPRNG(seed);
    const chordName = substituteChord(musicKey, roman, 'identity', prng).chordName;
    const next = [...generated];
    const section = { ...next[secIdx], chords: [...next[secIdx].chords] };
    section.chords.push({ bar: section.chords.length + 1, beat: 1, roman, chordName } as GeneratedChord);
    section.chords = hydrateSectionChords(section.chords, musicKey) as GeneratedChord[];
    next[secIdx] = section;
    return next;
  }

  if (subType === 'delete_chord') {
    const next = [...generated];
    const section = { ...next[secIdx], chords: [...next[secIdx].chords] };
    section.chords.splice(chordIdx, 1);
    section.chords = renumberBars(section.chords);
    section.chords = hydrateSectionChords(section.chords, musicKey) as GeneratedChord[];
    next[secIdx] = section;
    return next;
  }

  if (subType === 'move_left') {
    if (chordIdx === 0) return generated;
    const next = [...generated];
    const section = { ...next[secIdx], chords: [...next[secIdx].chords] };
    const temp = section.chords[chordIdx - 1];
    section.chords[chordIdx - 1] = section.chords[chordIdx];
    section.chords[chordIdx] = temp;
    section.chords = renumberBars(section.chords);
    section.chords = hydrateSectionChords(section.chords, musicKey) as GeneratedChord[];
    next[secIdx] = section;
    return next;
  }

  if (subType === 'move_right') {
    const next = [...generated];
    const section = { ...next[secIdx], chords: [...next[secIdx].chords] };
    if (chordIdx === section.chords.length - 1) return generated;
    const temp = section.chords[chordIdx + 1];
    section.chords[chordIdx + 1] = section.chords[chordIdx];
    section.chords[chordIdx] = temp;
    section.chords = renumberBars(section.chords);
    section.chords = hydrateSectionChords(section.chords, musicKey) as GeneratedChord[];
    next[secIdx] = section;
    return next;
  }

  if (subType.startsWith('replace_chord:')) {
    const roman = subType.split(':')[1];
    const prng = createPRNG(seed);
    const chordName = substituteChord(musicKey, roman, 'identity', prng).chordName;
    const next = [...generated];
    const section = { ...next[secIdx], chords: [...next[secIdx].chords] };
    section.chords[chordIdx] = { ...section.chords[chordIdx], roman, chordName };
    section.chords = hydrateSectionChords(section.chords, musicKey) as GeneratedChord[];
    next[secIdx] = section;
    return next;
  }

  const next = [...generated];
  const section = { ...next[secIdx], chords: [...next[secIdx].chords] };
  const chord = { ...section.chords[chordIdx] };
  const prng = createPRNG(seed + '-' + chordIdx);
  const { roman, chordName } = substituteChord(musicKey, chord.roman, subType as any, prng);
  chord.chordName = chordName;
  chord.roman = roman;
  section.chords[chordIdx] = chord;
  section.chords = hydrateSectionChords(section.chords, musicKey) as GeneratedChord[];
  next[secIdx] = section;
  return next;
}

export function applyCriticFix(
  generated: GeneratedSection[],
  secIdx: number,
  bar: number,
  fixType: 'resubstitute' | 'revoice' | 'reposition' | 'thin_voicing' | 'add_motion',
  musicKey: string,
  seed: string
): GeneratedSection[] {
  const next = [...generated];
  if (!next[secIdx]) return generated;
  const section = { ...next[secIdx], chords: [...next[secIdx].chords] };
  const chordIndex = section.chords.findIndex(c => c.bar === bar);
  if (chordIndex === -1) return generated;
  const chord = { ...section.chords[chordIndex] };

  if (fixType === 'resubstitute') {
    const prng = createPRNG(seed + '-critic-' + bar);
    const { roman, chordName } = substituteChord(musicKey, chord.roman, 'auto', prng);
    chord.roman = roman;
    chord.chordName = chordName;
  } else if (fixType === 'revoice') {
    if (chord.pianoVoicing) {
      const currentStyle = chord.pianoVoicing.style;
      const styles: typeof chord.pianoVoicing.style[] = ['rootless', 'drop2', 'spread', 'close'];
      const nextStyle = styles[(styles.indexOf(currentStyle) + 1) % styles.length];
      const nodeSet = buildNodeSet();
      const node = nodeSet[chord.roman];
      if (node) {
        const keyIndex = KEYS.indexOf(musicKey);
        const rootPc = (keyIndex + node.rootOffset) % 12;
        const chordTonesPc = chordTonesForQuality(rootPc, node.quality);
        const candidates = generateVoicingCandidates(chordTonesPc, rootPc, 4);
        const chosen = candidates.find(c => c.style === nextStyle) || candidates[0];
        chord.pianoVoicing = chosen;
      }
    }
  } else if (fixType === 'thin_voicing') {
    const nodeSet = buildNodeSet();
    const node = nodeSet[chord.roman];
    if (node) {
      const keyIndex = KEYS.indexOf(musicKey);
      const rootPc = (keyIndex + node.rootOffset) % 12;
      const chordTonesPc = chordTonesForQuality(rootPc, node.quality);
      const candidates = generateVoicingCandidates(chordTonesPc, rootPc, 4);
      const rootless = candidates.find(c => c.style === 'rootless') || candidates[0];
      chord.pianoVoicing = rootless;
    }
  } else if (fixType === 'reposition') {
    if (chord.guitarShape) {
      const nodeSet = buildNodeSet();
      const node = nodeSet[chord.roman];
      if (node) {
        const keyIndex = KEYS.indexOf(musicKey);
        const rootPc = (keyIndex + node.rootOffset) % 12;
        const chordTonesPc = chordTonesForQuality(rootPc, node.quality);
        const candidates = generateFingerableShapes(chordTonesPc, { rootPc });
        if (candidates.length > 1) {
          chord.guitarShape = candidates[1];
        }
      }
    }
  } else if (fixType === 'add_motion') {
    if (chordIndex > 0) {
      const nodeSet = buildNodeSet();
      const node = nodeSet[chord.roman];
      if (node) {
        const prevChord = { ...section.chords[chordIndex - 1] };
        const keyIndex = KEYS.indexOf(musicKey);
        const domOffset = (keyIndex + node.rootOffset + 7) % 12;
        const domRootName = KEYS[domOffset];
        prevChord.roman = `V7/${chord.roman}`;
        prevChord.chordName = `${domRootName}7`;
        section.chords[chordIndex - 1] = prevChord;
      }
    }
  }

  section.chords[chordIndex] = chord;
  section.chords = hydrateSectionChords(section.chords, musicKey) as GeneratedChord[];
  next[secIdx] = section;
  return next;
}
