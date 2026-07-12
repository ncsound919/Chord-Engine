import { createPRNG, randomChoice } from './prng';
import { KEYS, pitchClassOf, chordTonesForQuality } from '../theory/pitch';
import {
  buildNodeSet,
  scoreTransition,
  PRESET_PROFILES,
  ChordNode,
  Preset as TheoryPreset,
} from '../theory/harmony';
import { reharmonizeProgression, ReharmStrategy } from '../theory/reharm';
import { Voicing, BassNote, generateVoicingCandidates, pickBestVoicing, generateBassNote } from '../theory/voicing';
import { GuitarShape, generateFingerableShapes, pickBestGuitarShape } from '../theory/fretboard';
import { DrumStepPattern, ChordArticulation, TimeFeel, DrumStyle } from '../theory/rhythmicReframer';

// ──────────────────────────────────────────────
// Exported types
// ──────────────────────────────────────────────
export type Preset = TheoryPreset;
export type ComplexityLevel = 1 | 2 | 3;

export interface SectionDef {
  id: string;
  name: string;
  preset: Preset;
  lengthBars: number;
  beatsPerBar?: number;       // default 4
  chordsPerBar?: number;      // target chord change density
  startChord?: string;        // optional initial roman, e.g. 'IV'
  complexity?: ComplexityLevel;
  keyShift?: number;          // relative key change in semitones (can be any integer)
}

export interface GeneratedChord {
  bar: number;
  beat: number;                // 1‑based
  roman: string;
  chordName: string;
  rootPc?: number;
  quality?: string;
  pianoVoicing?: Voicing;
  guitarShape?: GuitarShape | null;
  bassNote?: BassNote;
}

export interface GeneratedSection {
  def: SectionDef;
  chords: GeneratedChord[];
  melody?: any[];
  drumPattern?: DrumStepPattern;
  drumStyle?: DrumStyle;       // NEW: which style generateDrumPattern used, so re-spins (e.g. PartsView "Spin Part") regenerate in the same style instead of guessing
  articulations?: ChordArticulation[];
  instrumentTextures?: Record<string, any>;
  timeFeel?: TimeFeel;
}

export { KEYS };

// ──────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────

/**
 * Normalize any integer to the [0, 12) pitch‑class range.
 * Double‑modulo handles arbitrarily negative numbers safely.
 */
function normalizePc(x: number): number {
  return ((x % 12) + 12) % 12;
}

let cachedNodeSet: Record<string, ChordNode> | null = null;

function getNodeSet(): Record<string, ChordNode> {
  if (!cachedNodeSet) {
    cachedNodeSet = buildNodeSet();
  }
  return cachedNodeSet;
}

/**
 * Build the display name for a chord, e.g. "Cmaj9", "Am11", or "Db13/Ab".
 */
export function buildChordName(keyRoot: string, roman: string): string {
  const keyIndex = KEYS.indexOf(keyRoot);
  if (keyIndex === -1) return roman;

  const nodeSet = getNodeSet();
  const node = nodeSet[roman];
  if (!node) return roman;

  const rootIndex = normalizePc(keyIndex + node.rootOffset);
  const chordRoot = KEYS[rootIndex];
  let name = `${chordRoot}${node.quality}`;

  if (node.bassOffset !== undefined) {
    const bassIndex = normalizePc(keyIndex + node.bassOffset);
    const bassNote = KEYS[bassIndex];
    name += `/${bassNote}`;
  }

  return name;
}

/**
 * Reharmonize or substitute a chord using advanced theory rules.
 *
 * **Breaking change**: `prngFunc` is now **required** – it is no longer
 * optional. All callers must supply a deterministic PRNG (e.g. from
 * `createPRNG`) so that results are reproducible. The previous default
 * of `Math.random` made the 'auto' strategy non‑deterministic and was
 * the only source of unseeded randomness in the entire pipeline.
 *
 * Supported strategies:
 * - 'identity'    : keep as is
 * - 'tritone'     : tritone substitution (V7 → ♭II7)
 * - 'parallel'    : modal interchange (borrow from parallel minor)
 * - 'extend'      : add higher extensions
 * - 'chromatic'   : chromatic approach chord (semitone above/below)
 * - 'passing'     : diatonic passing chord between two scale degrees
 * - 'ii_v'        : ii–V expansion
 * - 'tritone_sd'  : tritone‑sub secondary dominant
 * - 'backdoor'    : backdoor dominant (♭VII7)
 * - 'auto'        : pick best functional alternative (context‑aware)
 */
export function substituteChord(
  key: string,
  currentRoman: string,
  strategy: 'identity' | 'tritone' | 'parallel' | 'extend' | 'chromatic' | 'passing' | 'auto' | 'ii_v' | 'tritone_sd' | 'backdoor',
  prngFunc: () => number           // REQUIRED – no more Math.random fallback
): { roman: string; chordName: string } {
  const nodeSet = getNodeSet();
  const currentNode = nodeSet[currentRoman];

  if (!currentNode) {
    return { roman: currentRoman, chordName: buildChordName(key, currentRoman) };
  }

  if (strategy === 'identity') {
    return { roman: currentRoman, chordName: buildChordName(key, currentRoman) };
  }

  // Map high‑level strategies to internal reharm strategies
  const strategyMap: Record<string, ReharmStrategy> = {
    tritone: 'tritone_sub',
    parallel: 'modal_interchange',
    extend: 'extension',
    chromatic: 'chromatic_approach',
    passing: 'diatonic_passing',
    ii_v: 'ii_v_expansion',
    tritone_sd: 'tritone_sd',
    backdoor: 'backdoor',
  };

  if (strategy in strategyMap) {
    const reharmed = reharmonizeProgression([currentNode], strategyMap[strategy]);
    if (reharmed.length > 0 && reharmed[0]) {
      const resultNode = reharmed[0];
      return {
        roman: resultNode.roman,
        chordName: buildChordName(key, resultNode.roman),
      };
    }
  }

  if (strategy === 'auto') {
    const profile = PRESET_PROFILES.pop;
    const candidates = Object.values(nodeSet).filter(
      n => !n.roman.includes('/') && !n.roman.startsWith('sub(')
    );
    if (candidates.length === 0) {
      return { roman: currentRoman, chordName: buildChordName(key, currentRoman) };
    }
    const scored = candidates.map(c => ({
      node: c,
      score: scoreTransition(currentNode, c, profile),
    }));
    scored.sort((a, b) => b.score - a.score);
    const topN = Math.min(5, scored.length);
    const chosen = scored[Math.floor(prngFunc() * topN)].node;
    return {
      roman: chosen.roman,
      chordName: buildChordName(key, chosen.roman),
    };
  }

  // fallback
  return {
    roman: currentRoman,
    chordName: buildChordName(key, currentRoman),
  };
}

/**
 * Partial Fisher–Yates shuffle: shuffles `arr` in place until `count`
 * elements at the front are randomised, then returns a new array
 * containing those `count` elements. Much faster and strictly uniform
 * compared to `Array.sort(() => Math.random() - 0.5)`.
 */
function partialShuffle<T>(arr: T[], count: number, prng: () => number): T[] {
  const n = Math.min(count, arr.length);
  for (let i = 0; i < n; i++) {
    const j = i + Math.floor(prng() * (arr.length - i));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr.slice(0, n);
}

/**
 * Generate harmonic rhythm (which beats receive a chord) for one bar.
 * Complexity 1 → one chord per bar on beat 1.
 * Complexity 2 → two chords on beats 1 & 3 (4/4 only).
 * Complexity 3 → 2‑4 chords, distributed pseudo‑randomly.
 */
function getBeatPositions(
  _bar: number,                  // unused but kept for API compatibility
  complexity: ComplexityLevel,
  beatsPerBar: number = 4,
  prng: () => number
): number[] {
  if (complexity === 1) return [1];

  if (complexity === 2) {
    if (beatsPerBar >= 4) return [1, 3];
    return [1];
  }

  // Complexity 3: 2‑4 chords, beat 1 always present
  const possible: number[] = [];
  for (let b = 1; b <= beatsPerBar; b++) {
    if (b % 2 === 1 || prng() < 0.4) possible.push(b);
  }
  if (!possible.includes(1)) possible.unshift(1);

  if (possible.length > 4) {
    const first = possible[0];
    const rest = possible.slice(1);
    // Use uniform partial shuffle instead of biased sort‑shuffle
    const chosenRest = partialShuffle(rest, 3, prng);
    return [first, ...chosenRest].sort((a, b) => a - b);
  }
  return possible;
}

/**
 * If the last chord of a section is dominant/unstable, resolve to tonic
 * so the next section begins cleanly.
 */
function resolveLastChordIfNeeded(roman: string, nodeSet: Record<string, ChordNode>): string {
  const node = nodeSet[roman];
  if (!node) return roman;
  if (node.fn === 'dominant' || roman.startsWith('sub(')) {
    return nodeSet['Imaj7'] ? 'Imaj7' : 'I';
  }
  return roman;
}

/**
 * Increase chord complexity according to the current level.
 * Complexity 2 adds 7ths/9ths; complexity 3 adds 13ths and occasional
 * tritone substitutions or secondary dominants (style‑sensitive).
 */
function enhanceRoman(roman: string, complexity: ComplexityLevel, preset: Preset, prng: () => number): string {
  const nodeSet = getNodeSet();
  if (complexity === 1) return roman;

  const isSimpleStyle = preset === 'pop' || preset === 'rock';

  if (complexity === 2) {
    const map: Record<string, string> = {
      'Imaj7': 'Imaj9', 'I': 'Imaj7',
      'ii7': 'ii9', 'ii': 'ii7',
      'IVmaj7': 'IVmaj9', 'IV': 'IVmaj7',
      'V7': 'V9sus4', 'V': 'V7',
      'vi7': 'vi9', 'vi': 'vi7',
    };
    return map[roman] ?? roman;
  }

  if (complexity === 3) {
    const extendedMap: Record<string, string> = {
      'Imaj7': 'Imaj13', 'Imaj9': 'Imaj13', 'I': 'Imaj13',
      'ii7': 'ii11', 'ii9': 'ii11', 'ii': 'ii11',
      'IVmaj7': 'IVmaj13', 'IVmaj9': 'IVmaj13', 'IV': 'IVmaj13',
      'V7': 'V13', 'V9sus4': 'V13', 'V': 'V13',
      'vi7': 'vi11', 'vi9': 'vi11', 'vi': 'vi11',
      'iii7': 'iii11', 'iii': 'iii11',
    };

    if (roman in extendedMap) {
      // Sometimes tritone sub for dominants
      if ((roman.startsWith('V') || roman.startsWith('sub(V')) && prng() < 0.3) {
        const sub = reharmonizeProgression(
          [nodeSet[roman] ?? nodeSet['V7']],
          'tritone_sub'
        );
        if (sub.length > 0 && sub[0]) return sub[0].roman;
      }
      return extendedMap[roman] ?? roman;
    }

    // Occasionally insert a secondary dominant before a stable chord
    if (!isSimpleStyle && prng() < 0.2) {
      const sec = reharmonizeProgression(
        [nodeSet[roman] ?? nodeSet['I']],
        'secondary_dominant'
      );
      if (sec.length > 0 && sec[0]) return sec[0].roman;
    }
  }

  return roman;
}

/**
 * Generate a full chord progression for every section, including
 * harmonic rhythm, key shifts, and complexity‑based elaboration.
 */
export function generateProgression(
  key: string,
  sections: SectionDef[],
  seedPhrase: string
): GeneratedSection[] {
  const prng = createPRNG(seedPhrase + key);
  const result: GeneratedSection[] = [];
  const nodeSet = getNodeSet();
  let currentRoman = nodeSet['Imaj7'] ? 'Imaj7' : 'I';

  let currentKeyRoot = key;

  for (const section of sections) {
    const keyIndex = KEYS.indexOf(currentKeyRoot);
    if (keyIndex === -1) {
      console.error(`generateProgression: invalid key "${currentKeyRoot}" for section "${section.id}"`);
      continue;
    }

    const effectiveKeyIndex = normalizePc(keyIndex + (section.keyShift ?? 0));
    currentKeyRoot = KEYS[effectiveKeyIndex];

    const profile = PRESET_PROFILES[section.preset] ?? PRESET_PROFILES.pop;
    const beatsPerBar = section.beatsPerBar ?? 4;
    const sectionChords: GeneratedChord[] = [];

    // Starting chord for this section
    if (section.startChord && nodeSet[section.startChord]) {
      currentRoman = section.startChord;
    } else if (section !== sections[0]) {
      const prevSection = result[result.length - 1];
      if (prevSection && prevSection.chords.length > 0) {
        const lastRoman = prevSection.chords[prevSection.chords.length - 1].roman;
        currentRoman = resolveLastChordIfNeeded(lastRoman, nodeSet);
      }
    }

    for (let bar = 1; bar <= section.lengthBars; bar++) {
      const positions = getBeatPositions(bar, section.complexity ?? 1, beatsPerBar, prng);
      let barStartRoman = currentRoman;
      let prevRomanInBar: string | null = null;

      for (const beat of positions) {
        let chordRoman: string;

        if (bar === 1 && beat === 1 && section.startChord) {
          chordRoman = section.startChord;
        } else if (prevRomanInBar === null) {
          // Bar’s first chord – choose the next chord from the global progression logic
          const currentNode = nodeSet[barStartRoman] ?? nodeSet['Imaj7'];
          if (!currentNode) continue;

          const candidates = Object.values(nodeSet).filter(c => {
            if (c.roman === currentNode.roman) return false;
            if ((section.preset === 'pop' || section.preset === 'rock') &&
                (c.isBorrowed || c.isSecondaryDominant)) {
              return prng() < 0.25;
            }
            return true;
          });

          if (candidates.length === 0) {
            chordRoman = 'Imaj7';
          } else {
            chordRoman = randomChoice(
              candidates.map(c => c.roman),
              candidates.map(c => scoreTransition(currentNode, c, profile)),
              prng
            );
          }

          chordRoman = enhanceRoman(chordRoman, section.complexity ?? 1, section.preset, prng);
          barStartRoman = chordRoman;
        } else {
          // Subsequent beat – choose a closely related chord
          const prevNode = nodeSet[prevRomanInBar];
          if (!prevNode) {
            chordRoman = prevRomanInBar;
          } else {
            const targets = Object.values(nodeSet)
              .filter(c => c.roman !== prevNode.roman)
              .map(c => ({
                node: c,
                score: scoreTransition(prevNode, c, profile) * (c.fn === prevNode.fn ? 1.5 : 1),
              }));
            targets.sort((a, b) => b.score - a.score);
            const top = Math.min(3, targets.length);
            chordRoman = targets[Math.floor(prng() * top)].node.roman;
          }
        }

        sectionChords.push({
          bar,
          beat,
          roman: chordRoman,
          chordName: buildChordName(currentKeyRoot, chordRoman),
        });

        prevRomanInBar = chordRoman;
      }

      currentRoman = barStartRoman;
    }

    const hydrated = hydrateSectionChords(sectionChords, currentKeyRoot);
    result.push({
      def: section,
      chords: hydrated,
    });
  }

  return result;
}

/**
 * Hydrate generated chord symbols with concrete voicings,
 * guitar shapes, and bass notes.
 */
export function hydrateSectionChords(
  chords: { bar: number; beat: number; roman: string; chordName: string }[],
  key: string
): GeneratedChord[] {
  const nodeSet = getNodeSet();
  const keyIndex = KEYS.indexOf(key);
  if (keyIndex === -1) return [];

  let prevPiano: Voicing | null = null;
  let prevGuitar: GuitarShape | null = null;

  return chords.map((chord, index) => {
    const node = nodeSet[chord.roman];
    if (!node || !node.quality) {
      // Fallback: simple major triad on the tonic
      const rootPc = keyIndex;
      const dummyVoicing: Voicing = { notes: [60, 64, 67], style: 'close', rootPc, bassNote: 60 };
      const dummyBass: BassNote = { midi: 36, role: 'root' };
      return {
        ...chord,
        rootPc,
        quality: '',
        pianoVoicing: dummyVoicing,
        guitarShape: null,
        bassNote: dummyBass,
      };
    }

    const rootPc = normalizePc(keyIndex + node.rootOffset);
    let chordTonesPc: number[] = [];
    try {
      chordTonesPc = chordTonesForQuality(rootPc, node.quality);
    } catch {
      // Fallback to triad if quality lookup fails
      chordTonesPc = [rootPc, normalizePc(rootPc + 4), normalizePc(rootPc + 7)];
    }

    // Piano voicing
    const pianoCandidates = chordTonesPc.length > 0
      ? generateVoicingCandidates(chordTonesPc, rootPc, 4)
      : [{ notes: [60, 64, 67], style: 'close', rootPc, bassNote: 60 } as Voicing];
    const pianoVoicing = pickBestVoicing(pianoCandidates, prevPiano);
    if (pianoVoicing) prevPiano = pianoVoicing;

    // Guitar shape
    const guitarCandidates = chordTonesPc.length > 0
      ? generateFingerableShapes(chordTonesPc, { rootPc })
      : [];
    const guitarShape = guitarCandidates.length > 0
      ? pickBestGuitarShape(guitarCandidates, prevGuitar)
      : null;
    if (guitarShape) prevGuitar = guitarShape;

    // Bass note (with look‑ahead to next chord root)
    let nextRootPc: number | null = null;
    if (index < chords.length - 1) {
      const nextChord = chords[index + 1];
      const nextNode = nodeSet[nextChord.roman];
      if (nextNode) {
        nextRootPc = normalizePc(keyIndex + nextNode.rootOffset);
      }
    }
    const bassNote = generateBassNote(rootPc, nextRootPc, 'downbeat');

    return {
      ...chord,
      rootPc,
      quality: node.quality,
      pianoVoicing: pianoVoicing ?? undefined,
      guitarShape,
      bassNote,
    };
  });
}