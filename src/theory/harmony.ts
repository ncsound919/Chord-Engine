// theory/harmony.ts
// Functional harmony model. Chords are described by scale-degree + quality,
// not just an opaque Roman-numeral string. Transitions are computed from
// harmonic function (tonic / subdominant / dominant) rather than hand-typed
// per-chord edges, so secondary dominants, tritone subs, and borrowed chords
// generalize instead of needing bespoke table rows.

import { isDominantQuality } from './pitch';

export type Preset = 'steely' | 'isley' | 'stevie' | 'pop' | 'jazz' | 'soul' | 'rnb' | 'gospel' | 'rock' | 'techno' | 'funk' | 'sylvers';
export type HarmonicFunction = 'tonic' | 'subdominant' | 'dominant' | 'tonic_substitute' | 'subdominant_minor';

// A chord node: root offset from key (0-11 semitones), quality string (see pitch.ts CHORD_QUALITIES),
// scale degree label for display (roman numeral), and function.
export interface ChordNode {
  roman: string;        // display label, e.g. "ii7", "V7/vi"
  rootOffset: number;    // semitones from key root
  quality: string;
  bassOffset?: number;   // for slash chords / inversions
  fn: HarmonicFunction;
  isSecondaryDominant?: boolean;
  isBorrowed?: boolean;  // borrowed from parallel minor
}

// ---- Diatonic scale degrees (major key) ----
// offset, default quality, function
const DIATONIC: { deg: string; offset: number; quality: string; fn: HarmonicFunction }[] = [
  { deg: 'I',   offset: 0,  quality: 'maj7', fn: 'tonic' },
  { deg: 'ii',  offset: 2,  quality: 'm7',   fn: 'subdominant' },
  { deg: 'iii', offset: 4,  quality: 'm7',   fn: 'tonic_substitute' },
  { deg: 'IV',  offset: 5,  quality: 'maj7', fn: 'subdominant' },
  { deg: 'V',   offset: 7,  quality: '7',    fn: 'dominant' },
  { deg: 'vi',  offset: 9,  quality: 'm7',   fn: 'tonic_substitute' },
  { deg: 'vii', offset: 11, quality: 'm7b5', fn: 'dominant' },
];

// ---- Borrowed chords from parallel minor (modal interchange) ----
const BORROWED: { deg: string; offset: number; quality: string; fn: HarmonicFunction }[] = [
  { deg: 'iv',    offset: 5,  quality: 'm7',   fn: 'subdominant_minor' },
  { deg: 'bVI',   offset: 8,  quality: 'maj7', fn: 'subdominant_minor' },
  { deg: 'bVII',  offset: 10, quality: '13',   fn: 'subdominant_minor' }, // functions as backdoor dominant
  { deg: 'bII',   offset: 1,  quality: '7',    fn: 'dominant' },          // Neapolitan/tritone-sub target
  { deg: 'bIII',  offset: 3,  quality: 'maj7', fn: 'tonic_substitute' },
];

/**
 * Build the full node set available in a key: diatonic degrees (with extension
 * variants), borrowed chords, and computed secondary dominants (V of each
 * diatonic degree except V itself). This REPLACES the old hardcoded NODE_DEFS
 * table — every entry here is derived, not typed by hand.
 */
export function buildNodeSet(): Record<string, ChordNode> {
  const nodes: Record<string, ChordNode> = {};

  // Diatonic base + common extension variants
  for (const d of DIATONIC) {
    nodes[d.deg] = { roman: d.deg, rootOffset: d.offset, quality: d.quality, fn: d.fn };
    // extension variants share the same function
    const variants = extensionVariants(d.quality);
    for (const v of variants) {
      const label = d.deg + v.suffix;
      nodes[label] = { roman: label, rootOffset: d.offset, quality: v.quality, fn: d.fn };
    }
  }

  // Borrowed (modal interchange) chords
  for (const b of BORROWED) {
    nodes[b.deg] = { roman: b.deg, rootOffset: b.offset, quality: b.quality, fn: b.fn, isBorrowed: true };
    for (const v of extensionVariants(b.quality)) {
      const label = b.deg + v.suffix;
      nodes[label] = { roman: label, rootOffset: b.offset, quality: v.quality, fn: b.fn, isBorrowed: true };
    }
  }

  // Secondary dominants: V/x for every diatonic degree except V and vii (no useful secondary dominant of vii here)
  for (const d of DIATONIC) {
    if (d.deg === 'V' || d.deg === 'vii') continue;
    const targetOffset = d.offset;
    const domOffset = (targetOffset + 7) % 12; // dominant is a 5th above the target
    const label = `V7/${d.deg}`;
    nodes[label] = { roman: label, rootOffset: domOffset, quality: '7', fn: 'dominant', isSecondaryDominant: true };
    // extended secondary dominant
    nodes[`V13/${d.deg}`] = { roman: `V13/${d.deg}`, rootOffset: domOffset, quality: '13', fn: 'dominant', isSecondaryDominant: true };
  }

  // Tritone substitutes for V and each secondary dominant, computed (not hardcoded):
  // tritone sub = root+6 semitones, same quality, functions identically (dominant).
  const dominantEntries = Object.values(nodes).filter(n => isDominantQuality(n.quality));
  for (const dom of dominantEntries) {
    const subOffset = (dom.rootOffset + 6) % 12;
    const label = `sub(${dom.roman})`;
    if (!nodes[label]) {
      nodes[label] = { roman: label, rootOffset: subOffset, quality: dom.quality, fn: 'dominant', isSecondaryDominant: dom.isSecondaryDominant };
    }
  }

  return nodes;
}

function extensionVariants(baseQuality: string): { suffix: string; quality: string }[] {
  // Map a base triad/7th quality to its common upper-structure extensions.
  switch (baseQuality) {
    case 'maj7': return [
      { suffix: '9', quality: 'maj9' }, { suffix: '13', quality: 'maj13' }, { suffix: '6', quality: '6' }, { suffix: 'add9', quality: 'add9' },
    ];
    case 'm7': return [
      { suffix: '9', quality: 'm9' }, { suffix: '11', quality: 'm11' },
    ];
    case '7': return [
      { suffix: '9', quality: '9' }, { suffix: '13', quality: '13' }, { suffix: 'b9', quality: '7b9' }, { suffix: '#9', quality: '7#9' }, { suffix: 'sus4', quality: '9sus4' },
    ];
    case '13': return [
      { suffix: 'b9', quality: '7b9' },
    ];
    default: return [];
  }
}

/**
 * Compute harmonic-function-based transition weight between two chord functions.
 * This is the core replacement for the hardcoded bigram GRAMMAR table:
 * instead of listing "Imaj7 -> ii7: weight 2" by hand for every pair, we score
 * transitions by function movement (tonic -> subdominant -> dominant -> tonic
 * is the standard cycle) plus preset-specific biases layered on top.
 */
export function functionTransitionWeight(from: HarmonicFunction, to: HarmonicFunction): number {
  const CYCLE_WEIGHT: Record<HarmonicFunction, Partial<Record<HarmonicFunction, number>>> = {
    tonic:               { subdominant: 3, subdominant_minor: 2, dominant: 1, tonic_substitute: 2, tonic: 1 },
    tonic_substitute:    { subdominant: 3, subdominant_minor: 2, dominant: 1, tonic: 2 },
    subdominant:         { dominant: 3, subdominant_minor: 1, tonic: 1, subdominant: 1 },
    subdominant_minor:   { dominant: 2, tonic: 3, subdominant: 1 },
    dominant:            { tonic: 4, tonic_substitute: 2, subdominant_minor: 1 },
  };
  return CYCLE_WEIGHT[from]?.[to] ?? 0.5;
}

export interface PresetProfile {
  // Multiplier applied on top of functionTransitionWeight for chords matching these tags
  favorsSecondaryDominants: number; // 0-1+ likelihood multiplier
  favorsTritoneSubs: number;
  favorsBorrowed: number;
  favorsExtensions: number; // preference for 9/11/13 over plain 7ths
  preferredCadence: 'authentic' | 'plagal' | 'backdoor' | 'deceptive';
}

// Style rule-sets: the harmonic PERSONALITY of each preset, expressed as
// biases on the general engine rather than hand-authored per-chord edges.
export const PRESET_PROFILES: Record<Preset, PresetProfile> = {
  steely: {
    // Fagen/Becker: heavy secondary dominants (V/ii chains), "mu major" color (add9),
    // tritone subs used constantly as a harmonic signature (bII7 as a Steely fingerprint).
    favorsSecondaryDominants: 1.8,
    favorsTritoneSubs: 1.6,
    favorsBorrowed: 0.9,
    favorsExtensions: 1.3,
    preferredCadence: 'authentic',
  },
  stevie: {
    // Chromatic mediant motion (bVI, bIII), gospel-adjacent ii-V chains,
    // deceptive resolutions, altered dominants (7#9#5).
    favorsSecondaryDominants: 1.1,
    favorsTritoneSubs: 0.9,
    favorsBorrowed: 1.7,
    favorsExtensions: 1.5,
    preferredCadence: 'deceptive',
  },
  isley: {
    // Chris Jasper: lush stacked extensions (maj9/maj13), plagal (IV-I) motion,
    // backdoor dominants (bVII13 -> I), smoother/less chromatic than Steely.
    favorsSecondaryDominants: 0.7,
    favorsTritoneSubs: 0.5,
    favorsBorrowed: 1.3,
    favorsExtensions: 1.6,
    preferredCadence: 'backdoor',
  },
  gospel: {
    favorsSecondaryDominants: 1.4,
    favorsTritoneSubs: 1.2,
    favorsBorrowed: 1.4,
    favorsExtensions: 1.2,
    preferredCadence: 'plagal',
  },
  jazz: {
    favorsSecondaryDominants: 1.6,
    favorsTritoneSubs: 1.7,
    favorsBorrowed: 1.2,
    favorsExtensions: 1.4,
    preferredCadence: 'authentic',
  },
  soul: {
    favorsSecondaryDominants: 1.0,
    favorsTritoneSubs: 0.8,
    favorsBorrowed: 1.3,
    favorsExtensions: 1.2,
    preferredCadence: 'plagal',
  },
  rnb: {
    favorsSecondaryDominants: 0.9,
    favorsTritoneSubs: 0.7,
    favorsBorrowed: 1.1,
    favorsExtensions: 1.1,
    preferredCadence: 'authentic',
  },
  pop: {
    favorsSecondaryDominants: 0.4,
    favorsTritoneSubs: 0.2,
    favorsBorrowed: 0.5,
    favorsExtensions: 0.3,
    preferredCadence: 'authentic',
  },
  rock: {
    favorsSecondaryDominants: 0.3,
    favorsTritoneSubs: 0.2,
    favorsBorrowed: 0.6,
    favorsExtensions: 0.2,
    preferredCadence: 'plagal',
  },
  techno: {
    favorsSecondaryDominants: 0.2,
    favorsTritoneSubs: 0.1,
    favorsBorrowed: 0.4,
    favorsExtensions: 0.2,
    preferredCadence: 'authentic',
  },
  funk: {
    favorsSecondaryDominants: 1.2,
    favorsTritoneSubs: 0.8,
    favorsBorrowed: 1.1,
    favorsExtensions: 1.3,
    preferredCadence: 'authentic',
  },
  sylvers: {
    favorsSecondaryDominants: 1.1,
    favorsTritoneSubs: 0.7,
    favorsBorrowed: 1.4,
    favorsExtensions: 1.5,
    preferredCadence: 'backdoor',
  },
};

/**
 * Score a candidate next-chord node given the current node and a style profile.
 * Combines: (1) functional cycle weight, (2) style-specific bias multipliers,
 * (3) a mild penalty for repeating the exact same chord.
 */
export function scoreTransition(from: ChordNode, to: ChordNode, profile: PresetProfile): number {
  let weight = functionTransitionWeight(from.fn, to.fn);

  if (to.isSecondaryDominant) weight *= profile.favorsSecondaryDominants;
  if (to.roman.startsWith('sub(')) weight *= profile.favorsTritoneSubs;
  if (to.isBorrowed) weight *= profile.favorsBorrowed;
    const EXTENSION_PATTERN = /9|11|13/;

    if (EXTENSION_PATTERN.test(to.quality)) {
      weight *= profile.favorsExtensions;
    }
  if (to.roman === from.roman) weight *= 0.15; // discourage static repetition

  return Math.max(weight, 0.01);
}

/** Compute the tritone substitute node for any dominant-function chord. */
export function tritoneSubOf(node: ChordNode): ChordNode | null {
  if (!isDominantQuality(node.quality)) return null;
  return {
    roman: `sub(${node.roman})`,
    rootOffset: (node.rootOffset + 6) % 12,
    quality: node.quality,
    fn: 'dominant',
    isSecondaryDominant: node.isSecondaryDominant,
  };
}

/** Compute the secondary dominant that resolves to a given diatonic target node. */
export function secondaryDominantOf(target: ChordNode, extended: boolean = false): ChordNode {
  const domOffset = (target.rootOffset + 7) % 12;
  return {
    roman: `V${extended ? '13' : '7'}/${target.roman}`,
    rootOffset: domOffset,
    quality: extended ? '13' : '7',
    fn: 'dominant',
    isSecondaryDominant: true,
  };
}
