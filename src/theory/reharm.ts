// theory/reharm.ts
// Advanced reharmonization strategies – context‑aware transformations
// that reshape chord progressions while maintaining functional intent.

import { ChordNode, buildNodeSet, tritoneSubOf, secondaryDominantOf } from './harmony';
import { isDominantQuality } from './pitch';

export type ReharmStrategy =
  | 'tritone_sub'
  | 'secondary_dominant'
  | 'extension'
  | 'modal_interchange'
  | 'chromatic_approach'   // NEW
  | 'diatonic_passing'     // NEW
  | 'diminished_passing'   // NEW
  | 'backdoor'             // NEW
  | 'negative_harmony'     // NEW (simple axis reflection)
  | 'ii_v_expansion'       // NEW (jazz ii-V expansion)
  | 'tritone_sd'           // NEW (tritone sub of secondary dominant)
  | 'none';

/**
 * Apply one or more reharmonization strategies to a sequence of chord nodes.
 *
 * `strategy` can be a single strategy or an array – multiple strategies are applied in order.
 * The progression is a sequence of chord nodes (e.g. the result of parsing a lead sheet
 * or the output of a generative algorithm). The function returns a **new** array,
 * leaving the original untouched.
 */
export function reharmonizeProgression(
  progression: ChordNode[],
  strategy: ReharmStrategy | ReharmStrategy[]
): ChordNode[] {
  const strategies = Array.isArray(strategy) ? strategy : [strategy];
  let current = [...progression]; // copy

  for (const s of strategies) {
    current = applySingleStrategy(current, s);
  }
  return current;
}

// ─────────────────────────────────────────────────────────
// Internal per‑strategy implementations
// ─────────────────────────────────────────────────────────

function applySingleStrategy(nodes: ChordNode[], strategy: ReharmStrategy): ChordNode[] {
  const nodeSet = buildNodeSet();

  switch (strategy) {
    // ── Tritone substitution ───────────────────────────
    case 'tritone_sub': {
      return nodes.map(node => {
        if (isDominantQuality(node.quality)) {
          const sub = tritoneSubOf(node);
          if (sub) return sub;
        }
        return node;
      });
    }

    // ── Secondary dominants ────────────────────────────
    case 'secondary_dominant': {
      const out: ChordNode[] = [];
      for (let i = 0; i < nodes.length; i++) {
        const current = nodes[i];
        // Check next chord: if it's a stable diatonic target, insert a secondary dominant before it
        const next = i < nodes.length - 1 ? nodes[i + 1] : null;
        const isStableTarget = next &&
          !next.isSecondaryDominant &&
          (next.fn === 'tonic' || next.fn === 'subdominant' || next.fn === 'tonic_substitute');

        if (isStableTarget) {
          // Build a secondary dominant resolving to `next`
          const sd = secondaryDominantOf(next, true); // extended (V13)
          out.push(sd);
          out.push(next);
          i++; // skip the target because we already pushed it
        } else {
          out.push(current);
        }
      }
      return out.length > 0 ? out : nodes;
    }

    // ── Extension (9ths, 11ths, 13ths) ────────────────
    case 'extension': {
      return nodes.map(node => {
        // Only extend certain chord types intelligently
        let q = node.quality;
        let suffix = '';
        // Simple triads become 7ths
        if (q === '') {
          if (node.fn === 'tonic' || node.fn === 'subdominant') q = 'maj7';
          else if (node.fn === 'dominant') q = '7';
          else q = 'm7'; // general minor
        } else if (q === 'maj7') { q = 'maj9'; suffix = '9'; }
        else if (q === 'm7') { q = 'm9'; suffix = '9'; }
        else if (q === '7') { q = '9'; suffix = '9'; }
        else if (q === 'maj9') { q = 'maj13'; suffix = '13'; }
        else if (q === 'm9') { q = 'm11'; suffix = '11'; }
        else if (q === '9') { q = '13'; suffix = '13'; }

        if (suffix && node.roman) {
          // Construct new roman from base
          const base = node.roman.replace(/maj\d+|m\d+|7|9|11|13|ø|o/g, '');
          const newRoman = base + suffix;
          return { ...node, roman: newRoman, quality: q };
        }
        return { ...node, quality: q };
      });
    }

    // ── Modal interchange ──────────────────────────────
    case 'modal_interchange': {
      return nodes.map(node => {
        // Borrow from parallel minor/major depending on context
        const borrowed = findModalInterchange(node, nodeSet);
        return borrowed || node;
      });
    }

    // ── Chromatic approach ─────────────────────────────
    case 'chromatic_approach': {
      const out: ChordNode[] = [];
      for (let i = 0; i < nodes.length; i++) {
        const target = nodes[i];
        // Precede stable chords with an approach chord a semitone above or below
        if (target.fn === 'tonic' || target.fn === 'subdominant') {
          const approach = chromaticApproach(target, nodeSet);
          if (approach) {
            out.push(approach);
          }
        }
        out.push(target);
      }
      return out;
    }

    // ── Diatonic passing chords ────────────────────────
    case 'diatonic_passing': {
      const out: ChordNode[] = [];
      for (let i = 0; i < nodes.length; i++) {
        const current = nodes[i];
        out.push(current);
        if (i < nodes.length - 1) {
          const next = nodes[i + 1];
          const passing = diatonicPassing(current, next, nodeSet);
          if (passing) out.push(passing);
        }
      }
      return out;
    }

    // ── Diminished passing chords ──────────────────────
    case 'diminished_passing': {
      const out: ChordNode[] = [];
      for (let i = 0; i < nodes.length; i++) {
        const current = nodes[i];
        out.push(current);
        if (i < nodes.length - 1) {
          const next = nodes[i + 1];
          const dim = diminishedPassing(current, next, nodeSet);
          if (dim) out.push(dim);
        }
      }
      return out;
    }

    // ── Backdoor progression ───────────────────────────
    case 'backdoor': {
      return nodes.map(node => {
        // Replace V7 with backdoor bVII13 (or bVII7) when resolving to I
        if (isDominantQuality(node.quality) && node.fn === 'dominant') {
          const bVII = nodeSet['bVII13'] || nodeSet['bVII7'];
          if (bVII) return bVII;
        }
        return node;
      });
    }

    // ── Negative harmony ───────────────────────────────
    case 'negative_harmony': {
      // Reflect each chord around the tonic/dominant axis (simple version)
      return nodes.map(node => negativeHarmony(node, nodeSet));
    }

    // ── ii-V expansion / interpolation ─────────────────
    case 'ii_v_expansion': {
      const out: ChordNode[] = [];
      for (let i = 0; i < nodes.length; i++) {
        const current = nodes[i];
        const next = i < nodes.length - 1 ? nodes[i + 1] : null;
        const isStableTarget = next &&
          !next.isSecondaryDominant &&
          (next.roman === 'I' || next.roman === 'i' || next.roman === 'Imaj7' || next.roman === 'vi' || next.roman === 'vi7');

        if (isStableTarget) {
          const targetOffset = next.rootOffset;
          const iiOffset = (targetOffset + 2) % 12;
          const vOffset = (targetOffset + 7) % 12;
          const isMinor = next.quality.startsWith('m') && !next.quality.startsWith('maj');

          const iiNode: ChordNode = {
            roman: isMinor ? 'iiø7' : 'ii7',
            rootOffset: iiOffset,
            quality: isMinor ? 'm7b5' : 'm7',
            fn: 'subdominant',
          };
          const vNode: ChordNode = {
            roman: isMinor ? 'V7b9' : 'V7',
            rootOffset: vOffset,
            quality: isMinor ? '7b9' : '7',
            fn: 'dominant',
            isSecondaryDominant: true,
          };
          out.push(iiNode, vNode, next);
          i++; // skip next
        } else {
          if (nodes.length === 1) {
            // FIX: previously returned only the ii chord, silently dropping
            // both the V chord and the original chord entirely — a single
            // chord fed through "ii-V expansion" came back as just "ii7",
            // with the target it was supposed to resolve TO discarded. The
            // isStableTarget branch above builds [ii, V, target] for the
            // exact same situation (a stable chord to expand into); this
            // path should do the same, treating `current` as that target.
            const targetOffset = current.rootOffset;
            const iiOffset = (targetOffset + 2) % 12;
            const vOffset = (targetOffset + 7) % 12;
            const isMinor = current.quality.startsWith('m') && !current.quality.startsWith('maj');
            const iiNode: ChordNode = {
              roman: isMinor ? 'iiø7' : 'ii7',
              rootOffset: iiOffset,
              quality: isMinor ? 'm7b5' : 'm7',
              fn: 'subdominant',
            };
            const vNode: ChordNode = {
              roman: isMinor ? 'V7b9' : 'V7',
              rootOffset: vOffset,
              quality: isMinor ? '7b9' : '7',
              fn: 'dominant',
              isSecondaryDominant: true,
            };
            return [iiNode, vNode, current];
          }
          out.push(current);
        }
      }
      return out;
    }

    // ── Tritone sub of secondary dominants ──────────────
    case 'tritone_sd': {
      return nodes.map(node => {
        if (isDominantQuality(node.quality)) {
          const subOffset = (node.rootOffset + 6) % 12;
          return {
            roman: node.roman.startsWith('sub(') ? node.roman : `sub(${node.roman})`,
            rootOffset: subOffset,
            quality: '7',
            fn: 'dominant',
            isSecondaryDominant: true,
          };
        }
        return node;
      });
    }

    default:
      return nodes;
  }
}

// ─────────────────────────────────────────────────────────
// Helper functions for strategies
// ─────────────────────────────────────────────────────────

/** Map common modal interchange chords: parallel minor to major, or vice versa. */
function findModalInterchange(node: ChordNode, nodeSet: Record<string, ChordNode>): ChordNode | null {
  const map: Record<string, string> = {
    'I': 'i', 'i': 'I',
    'IV': 'iv', 'iv': 'IV',
    'V': 'bVII', 'V7': 'bVII7',
    'ii': 'iiø', 'ii7': 'iiø7',
    'vi': 'bVI', 'vi7': 'bVImaj7',
    'iii': 'bIII', 'iii7': 'bIIImaj7',
  };

  // Try exact roman
  if (node.roman && map[node.roman]) {
    const target = nodeSet[map[node.roman]];
    if (target) return target;
  }
  // Try removing extension (e.g., 'V7' -> 'V')
  const baseRoman = node.roman?.replace(/7|9|11|13|maj7/g, '');
  if (baseRoman && baseRoman !== node.roman && map[baseRoman]) {
    const target = nodeSet[map[baseRoman]];
    if (target) return target;
  }
  return null;
}

/** Create a chromatic approach chord (dominant 7th) a semitone above the target. */
function chromaticApproach(target: ChordNode, nodeSet: Record<string, ChordNode>): ChordNode | null {
  // Build a dominant 7th chord whose root is one semitone above target's root
  const targetRootOffset = target.rootOffset;
  const approachOffset = (targetRootOffset + 1) % 12; // semitone above
  // Find a node that matches this offset and is a dominant quality
  for (const key of Object.keys(nodeSet)) {
    const candidate = nodeSet[key];
    if (candidate.rootOffset === approachOffset && isDominantQuality(candidate.quality)) {
      return candidate;
    }
  }
  // If not found, create a synthetic node (fallback)
  return {
    roman: `bII7/${target.roman}`,
    quality: '7',
    rootOffset: approachOffset,
    fn: 'dominant',
    isSecondaryDominant: true,
  } as ChordNode;
}

/** Insert a diatonic passing chord between two chords that are a third apart. */
function diatonicPassing(
  a: ChordNode, b: ChordNode, nodeSet: Record<string, ChordNode>
): ChordNode | null {
  const diff = (b.rootOffset - a.rootOffset + 12) % 12;
  const ascending = diff === 3 || diff === 4;
  const descending = diff === 8 || diff === 9;

  if (!ascending && !descending) return null;

  const passingOffset = ascending
    ? (a.rootOffset + (diff === 4 ? 2 : 1)) % 12
    : (a.rootOffset - (diff === 8 ? 2 : 1) + 12) % 12;

  for (const key of Object.keys(nodeSet)) {
    const n = nodeSet[key];
    if (n.rootOffset === passingOffset && !n.isSecondaryDominant &&
        (n.quality === '' || n.quality === 'm7' || n.quality === 'm')) {
      return n;
    }
  }
  return null;
}

/** Insert a diminished passing chord between chords a whole step apart. */
function diminishedPassing(
  a: ChordNode, b: ChordNode, nodeSet: Record<string, ChordNode>
): ChordNode | null {
  const diff = (b.rootOffset - a.rootOffset + 12) % 12;
  const ascending = diff === 2;
  const descending = diff === 10;

  if (!ascending && !descending) return null;

  const dimOffset = ascending
    ? (a.rootOffset + 1) % 12
    : (a.rootOffset - 1 + 12) % 12;
    
  for (const key of Object.keys(nodeSet)) {
    const n = nodeSet[key];
    if (n.rootOffset === dimOffset && n.quality === 'dim7') return n;
  }
  return null;
}

/** Apply negative harmony reflection (tonic axis). */
function negativeHarmony(
  node: ChordNode, nodeSet: Record<string, ChordNode>
): ChordNode {
  // Axis: between tonic (I) and dominant (V) = minor third above tonic? Standard axis is root=0 and root=5.
  // Formula: new_root = (5 - (old_root - 0) + 12) % 12 -> (5 - old_root) mod 12
  const newRoot = (5 - node.rootOffset + 12) % 12;
  // Quality mapping (major <-> minor, dominant stays dominant but root changes)
  let newQuality = node.quality;
  if (newQuality === 'maj7') newQuality = 'm7';
  else if (newQuality === 'm7') newQuality = 'maj7';
  else if (newQuality === '7') newQuality = '7'; // tritone symmetry
  else if (newQuality === 'maj9') newQuality = 'm9';
  else if (newQuality === 'm9') newQuality = 'maj9';
  // etc.

  // Find the best matching node in the set
  for (const key of Object.keys(nodeSet)) {
    const candidate = nodeSet[key];
    if (candidate.rootOffset === newRoot && candidate.quality === newQuality) {
      return candidate;
    }
  }
  // Fallback: construct a simple node
  return {
    roman: `neg(${node.roman})`,
    quality: newQuality,
    rootOffset: newRoot,
    fn: node.fn,
  } as ChordNode;
}
