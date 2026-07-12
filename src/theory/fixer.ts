import { GeneratedSection, GeneratedChord, hydrateSectionChords } from '../lib/engine';
import { critiqueArrangement, CriticFinding } from './critic';
import { substituteChord } from '../lib/engine';
import { KEYS, chordTonesForQuality } from './pitch';
import { buildNodeSet } from './harmony';
import { generateVoicingCandidates, generateBassNote } from './voicing';
import { generateFingerableShapes } from './fretboard';
import { createPRNG } from '../lib/prng';

export interface OptimizationStep {
  pass: number;
  bar: number;
  sectionName: string;
  category: string;
  description: string;
  scoreDelta: number;
}

export interface OptimizationResult {
  sections: GeneratedSection[];
  scoreBefore: number;
  scoreAfter: number;
  steps: OptimizationStep[];
}

/**
 * The Fixer / Resolution Engine.
 * Automates the critique-and-repair loop:
 * 1. Critique the current arrangement.
 * 2. For each actionable finding (starting from highest severity), simulate a repair.
 * 3. Keep the repair if the holistic score increases.
 * 4. Repeat until the score converges, the findings list is clean, or max iterations are met.
 */
export function optimizeArrangement(
  sections: GeneratedSection[],
  musicKey: string,
  seed: string = 'fixed-critic'
): OptimizationResult {
  const prng = createPRNG(seed);
  // Deep clone sections so we don't mutate input state prematurely
  let workingSections: GeneratedSection[] = JSON.parse(JSON.stringify(sections));
  
  const initialCritique = critiqueArrangement(workingSections);
  const scoreBefore = initialCritique.score;
  let currentScore = scoreBefore;
  
  const steps: OptimizationStep[] = [];
  const maxPasses = 8;
  
  for (let pass = 1; pass <= maxPasses; pass++) {
    const critique = critiqueArrangement(workingSections);
    
    // Sort findings so highest severity and most critical issues are processed first
    const severityPriority = { problem: 4, warning: 3, suggestion: 2, info: 1 };
    const actionableFindings = critique.findings
      .filter(f => f.fix)
      .sort((a, b) => severityPriority[b.severity] - severityPriority[a.severity]);
      
    if (actionableFindings.length === 0) {
      break; // No more actionable findings
    }
    
    let appliedFixThisPass = false;
    
    for (const finding of actionableFindings) {
      const fix = finding.fix!;
      const secIdx = finding.location.sectionIdx;
      const bar = finding.location.bar;
      const sectionName = workingSections[secIdx]?.def.name || `Section ${secIdx + 1}`;
      
      // Simulate applying the fix to a cloned copy
      const tempSections: GeneratedSection[] = JSON.parse(JSON.stringify(workingSections));
      const section = tempSections[secIdx];
      const chordIndex = section.chords.findIndex(c => c.bar === bar);
      if (chordIndex === -1) continue;
      
      const chord = { ...section.chords[chordIndex] };
      let description = '';

      if (fix.type === 'resubstitute') {
        const { roman, chordName } = substituteChord(musicKey, chord.roman, 'auto', prng);
        description = `Resubstituted ${chord.chordName} (${chord.roman}) → ${chordName} (${roman})`;
        chord.roman = roman;
        chord.chordName = chordName;
      } else if (fix.type === 'revoice') {
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
            description = `Changed piano voicing to ${nextStyle} style for ${chord.chordName}`;
          }
        }
      } else if (fix.type === 'thin_voicing') {
        const nodeSet = buildNodeSet();
        const node = nodeSet[chord.roman];
        if (node) {
          const keyIndex = KEYS.indexOf(musicKey);
          const rootPc = (keyIndex + node.rootOffset) % 12;
          const chordTonesPc = chordTonesForQuality(rootPc, node.quality);
          const candidates = generateVoicingCandidates(chordTonesPc, rootPc, 4);
          const rootless = candidates.find(c => c.style === 'rootless') || candidates[0];
          chord.pianoVoicing = rootless;
          description = `Thinned piano voicing using rootless shapes for ${chord.chordName}`;
        }
      } else if (fix.type === 'reposition') {
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
              description = `Repositioned guitar shape to minimize register clutter`;
            }
          }
        }
      } else if (fix.type === 'add_motion') {
        if (chordIndex > 0) {
          const nodeSet = buildNodeSet();
          const node = nodeSet[chord.roman];
          if (node) {
            const prevChord = { ...section.chords[chordIndex - 1] };
            // FIX: this previously computed the secondary dominant's root from
            // `node.rootOffset` alone, with no `keyIndex` term at all — unlike
            // every sibling branch above (revoice/thin_voicing/reposition),
            // which all correctly fold `keyIndex` in. That made the dominant
            // chord name wrong in every key except when the tonic sits at
            // KEYS index 0. Since this runs inside the automated optimizer's
            // greedy accept-if-better loop, a wrong chord name here could get
            // silently locked in as an "improvement" with no human review.
            const keyIndex = KEYS.indexOf(musicKey);
            const domOffset = (((keyIndex + node.rootOffset + 7) % 12) + 12) % 12;
            const domRootName = KEYS[domOffset];
            prevChord.roman = `V7/${chord.roman}`;
            prevChord.chordName = `${domRootName}7`;
            section.chords[chordIndex - 1] = prevChord;
            description = `Inserted secondary dominant V7/${chord.roman} to add forward motion`;
          }
        }
      }

      // Re-hydrate of this section specifically to update voicings, bass, and continuity
      section.chords[chordIndex] = chord;
      section.chords = hydrateSectionChords(section.chords, musicKey);
      
      // Evaluate score of proposal
      const testCritique = critiqueArrangement(tempSections);
      if (testCritique.score > currentScore) {
        const delta = testCritique.score - currentScore;
        steps.push({
          pass,
          bar,
          sectionName,
          category: finding.category,
          description: description || `Optimized ${finding.category.replace('_', ' ')}`,
          scoreDelta: delta,
        });
        currentScore = testCritique.score;
        workingSections = tempSections; // lock in the change
        appliedFixThisPass = true;
        break; // break inner loop to re-evaluate with updated critique
      }
    }
    
    // If we completed a full pass over findings without any improvement, the arrangement is optimized
    if (!appliedFixThisPass) {
      break;
    }
  }

  return {
    sections: workingSections,
    scoreBefore,
    scoreAfter: currentScore,
    steps,
  };
}