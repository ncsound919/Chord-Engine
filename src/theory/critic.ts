// theory/critic.ts
// The missing piece: a post-hoc arrangement critic. Every other module in
// this system (harmony, voicing, fretboard, reharm) optimizes LOCALLY —
// one chord at a time, one instrument at a time. Nothing looks at the
// finished, fully-stacked arrangement across a whole section and judges
// it as a piece of music. This module does that.
//
// It is intentionally NOT a generator. It consumes output from engine.ts
// (a GeneratedSection[], with real pitch/voicing data attached) and
// produces a structured critique: findings with severity, location, and
// an actionable fix suggestion. Any AI or human editing the arrangement
// downstream can act on this without re-deriving music theory from scratch.

import { GeneratedSection, GeneratedChord } from '../lib/engine';
import { Voicing } from './voicing';
import { GuitarShape } from './fretboard';
import { PRESET_PROFILES, Preset } from './harmony';
import { midiToNoteName } from './pitch';

export type Severity = 'info' | 'suggestion' | 'warning' | 'problem';

export interface CriticFinding {
  id: string;
  severity: Severity;
  category:
    | 'register_collision'    // two instruments crowding the same pitch space
    | 'voice_leading'         // rough/leapy motion between chords
    | 'guitar_ergonomics'     // unrealistic or needlessly awkward position jumps
    | 'harmonic_stasis'       // too much repetition, no functional motion
    | 'arc'                   // section-level energy/complexity doesn't build or resolve
    | 'style_fidelity'        // technically valid but doesn't sound like the target style
    | 'voicing_density';      // too thick/thin for the instrumentation and register
  location: { sectionIdx: number; bar: number };
  message: string;
  suggestion: string;
  // machine-actionable hint another tool/AI can key off directly
  fix?: { type: 'resubstitute' | 'revoice' | 'reposition' | 'thin_voicing' | 'add_motion'; targetBar: number };
}

export interface ArrangementCritique {
  findings: CriticFinding[];
  score: number; // 0-100, holistic quality estimate — see scoreArrangement()
  summary: string;
}

// ---------------------------------------------------------------------
// 1. REGISTER COLLISION — do piano and bass (or guitar and piano) crowd
//    the same octave, muddying the mix, on any given chord?
// ---------------------------------------------------------------------
function checkRegisterCollisions(section: GeneratedSection, sectionIdx: number): CriticFinding[] {
  const findings: CriticFinding[] = [];

  for (const chord of section.chords) {
    if (!chord.bassNote || !chord.pianoVoicing || chord.pianoVoicing.notes.length === 0) continue;

    const bassMidi = chord.bassNote.midi;
    const pianoLow = Math.min(...chord.pianoVoicing.notes);
    const gap = pianoLow - bassMidi;

    // Bass and the lowest piano voice within a minor 3rd of each other = mud,
    // especially below C3 where harmonics start smearing together.
    if (gap >= 0 && gap <= 3 && bassMidi < 48) {
      findings.push({
        id: `reg-coll-piano-${sectionIdx}-${chord.bar}`,
        severity: 'warning',
        category: 'register_collision',
        location: { sectionIdx, bar: chord.bar },
        message: `Bass (${midiToNoteName(bassMidi)}) and piano's lowest voice (${midiToNoteName(pianoLow)}) are only ${gap} semitones apart in the low register — will read as mud, not weight.`,
        suggestion: `Voice the piano's lowest note at least a 5th above the bass, or switch to a rootless voicing so piano's floor naturally sits higher.`,
        fix: { type: 'revoice', targetBar: chord.bar },
      });
    }

    // Guitar shape's lowest fretted note colliding with bass in the same way
    if (chord.guitarShape && chord.guitarShape.notes && chord.guitarShape.notes.length > 0) {
      const guitarLow = Math.min(...chord.guitarShape.notes.map(n => n.midi));
      const gGap = guitarLow - bassMidi;
      if (gGap >= 0 && gGap <= 2 && bassMidi < 45) {
        findings.push({
          id: `reg-coll-guitar-${sectionIdx}-${chord.bar}`,
          severity: 'suggestion',
          category: 'register_collision',
          location: { sectionIdx, bar: chord.bar },
          message: `Guitar's lowest note (${midiToNoteName(guitarLow)}) sits right on top of the bass (${midiToNoteName(bassMidi)}).`,
          suggestion: `Favor a guitar shape that skips the low E/A strings on this chord, or drop the bass an octave for separation.`,
          fix: { type: 'reposition', targetBar: chord.bar },
        });
      }
    }
  }

  return findings;
}

// ---------------------------------------------------------------------
// 2. VOICE LEADING QUALITY — flag rough jumps between consecutive piano
//    voicings that the generator's cost function let through as "least
//    bad" rather than "actually good."
// ---------------------------------------------------------------------
function checkVoiceLeading(section: GeneratedSection, sectionIdx: number): CriticFinding[] {
  const findings: CriticFinding[] = [];

  for (let i = 1; i < section.chords.length; i++) {
    const prev = section.chords[i - 1].pianoVoicing;
    const curr = section.chords[i].pianoVoicing;
    if (!prev || !curr || prev.notes.length === 0 || curr.notes.length === 0) continue;

    const prevSorted = [...prev.notes].sort((a, b) => a - b);
    const currSorted = [...curr.notes].sort((a, b) => a - b);
    const len = Math.min(prevSorted.length, currSorted.length);

    let maxLeap = 0;
    for (let v = 0; v < len; v++) {
      maxLeap = Math.max(maxLeap, Math.abs(prevSorted[v] - currSorted[v]));
    }

    if (maxLeap >= 7) {
      findings.push({
        id: `voice-leading-${sectionIdx}-${section.chords[i].bar}`,
        severity: maxLeap >= 12 ? 'problem' : 'warning',
        category: 'voice_leading',
        location: { sectionIdx, bar: section.chords[i].bar },
        message: `A voice leaps ${maxLeap} semitones between bar ${section.chords[i - 1].bar} and bar ${section.chords[i].bar} (${section.chords[i - 1].chordName} → ${section.chords[i].chordName}) — larger than a real comper would play.`,
        suggestion: `Try a different voicing style (drop2/rootless) for this chord specifically to find a closer common-tone path.`,
        fix: { type: 'revoice', targetBar: section.chords[i].bar },
      });
    }
  }

  return findings;
}

// ---------------------------------------------------------------------
// 3. GUITAR ERGONOMICS — repeated large position jumps with no musical
//    justification (e.g. a static harmonic passage that shouldn't require
//    hopping all over the neck).
// ---------------------------------------------------------------------
function checkGuitarErgonomics(section: GeneratedSection, sectionIdx: number): CriticFinding[] {
  const findings: CriticFinding[] = [];
  let consecutiveJumps = 0;
  // FIX: previously this flag didn't exist, so every jump past the 2nd in a
  // run re-fired a brand new finding — a single 5-jump run produced 4
  // near-duplicate warnings and over-penalized the score by ~4x. Now we
  // flag once per contiguous run and stay silent until the run breaks.
  let flaggedThisRun = false;

  for (let i = 1; i < section.chords.length; i++) {
    const prevShape = section.chords[i - 1].guitarShape;
    const currShape = section.chords[i].guitarShape;
    if (!prevShape || !currShape) continue;

    const prevPos = (prevShape.minFret + prevShape.maxFret) / 2;
    const currPos = (currShape.minFret + currShape.maxFret) / 2;
    const jump = Math.abs(currPos - prevPos);

    if (jump > 5) {
      consecutiveJumps++;
      if (consecutiveJumps >= 2 && !flaggedThisRun) {
        flaggedThisRun = true;
        findings.push({
          id: `guitar-ergo-${sectionIdx}-${section.chords[i].bar}`,
          severity: 'warning',
          category: 'guitar_ergonomics',
          location: { sectionIdx, bar: section.chords[i].bar },
          message: `Guitar has jumped hand position by ${Math.round(jump)} frets multiple times in a row through bar ${section.chords[i].bar} — unplayable as written in real time.`,
          suggestion: `Re-run fretboard shape selection with a stronger position-continuity weight, or accept the jump only if it's intentional (e.g. moving into a new section register).`,
          fix: { type: 'reposition', targetBar: section.chords[i].bar },
        });
      }
    } else {
      consecutiveJumps = 0;
      flaggedThisRun = false;
    }
  }

  return findings;
}

// ---------------------------------------------------------------------
// 4. HARMONIC STASIS — too many bars in a row without real functional
//    motion (same chord repeated, or oscillating between only two chords
//    with no cadential arrival).
// ---------------------------------------------------------------------
function checkHarmonicStasis(section: GeneratedSection, sectionIdx: number): CriticFinding[] {
  const findings: CriticFinding[] = [];
  let staticRun = 1;

  for (let i = 1; i < section.chords.length; i++) {
    if (section.chords[i].roman === section.chords[i - 1].roman) {
      staticRun++;
    } else {
      if (staticRun >= 4) {
        findings.push({
          id: `stasis-${sectionIdx}-${section.chords[i - 1].bar}`,
          severity: 'suggestion',
          category: 'harmonic_stasis',
          location: { sectionIdx, bar: section.chords[i - 1].bar },
          message: `${section.chords[i - 1].chordName} holds for ${staticRun} bars straight (bars ${section.chords[i - 1].bar - staticRun + 1}-${section.chords[i - 1].bar}) with no harmonic motion.`,
          suggestion: `If intentional (a vamp/groove section), fine — otherwise insert a passing chord or secondary dominant to keep forward motion.`,
          fix: { type: 'add_motion', targetBar: section.chords[i - 1].bar },
        });
      }
      staticRun = 1;
    }
  }
  if (staticRun >= 4 && section.chords.length > 0) {
    const lastBar = section.chords[section.chords.length - 1].bar;
    findings.push({
      id: `stasis-end-${sectionIdx}-${lastBar}`,
      severity: 'suggestion',
      category: 'harmonic_stasis',
      location: { sectionIdx, bar: lastBar },
      message: `Section ends on a ${staticRun}-bar static harmony with no cadential motion into the next section.`,
      suggestion: `Consider forcing a dominant-function chord in the final bar to set up the next section's arrival.`,
      fix: { type: 'resubstitute', targetBar: lastBar },
    });
  }

  return findings;
}

// ---------------------------------------------------------------------
// 5. ARC — across a whole section, does complexity/density actually
//    build toward something, or is it flat? Real arrangements (especially
//    in this style lineage) tend to open sparser and thicken toward a
//    chorus/climax, or vice versa for a bridge/breakdown.
// ---------------------------------------------------------------------
function checkArc(section: GeneratedSection, sectionIdx: number): CriticFinding[] {
  const findings: CriticFinding[] = [];
  if (section.chords.length < 6) return findings;

  const densityAt = (c: GeneratedChord) => {
    const pianoLen = c.pianoVoicing?.notes?.length ?? 0;
    const guitarLen = c.guitarShape?.notes?.length ?? 0;
    return pianoLen + guitarLen;
  };

  const firstThird = section.chords.slice(0, Math.floor(section.chords.length / 3));
  const lastThird = section.chords.slice(-Math.floor(section.chords.length / 3));

  if (firstThird.length === 0 || lastThird.length === 0) return findings;

  const avgFirst = firstThird.reduce((s, c) => s + densityAt(c), 0) / firstThird.length;
  const avgLast = lastThird.reduce((s, c) => s + densityAt(c), 0) / lastThird.length;

  if (Math.abs(avgFirst - avgLast) < 0.5) {
    findings.push({
      id: `arc-${sectionIdx}`,
      severity: 'info',
      category: 'arc',
      location: { sectionIdx, bar: section.chords[0].bar },
      message: `Voicing density is essentially flat across this section (start avg ${avgFirst.toFixed(1)} notes, end avg ${avgLast.toFixed(1)} notes) — no textural build or release.`,
      suggestion: `If this section is meant to build (verse→chorus lift, e.g.), deliberately thicken voicings and add extensions in the back half. If it's a static groove section, this is fine as-is.`,
    });
  }

  return findings;
}

// ---------------------------------------------------------------------
// 6. STYLE FIDELITY — technically legal chords that don't actually match
//    the fingerprint of the claimed style preset. Checks the
//    ratio of style-signature moves actually present against what the
//    preset profile says should dominate.
// ---------------------------------------------------------------------
function checkStyleFidelity(section: GeneratedSection, sectionIdx: number, preset: Preset): CriticFinding[] {
  const findings: CriticFinding[] = [];
  const profile = PRESET_PROFILES[preset];
  if (!profile || section.chords.length === 0) return findings;

  const romans = section.chords.map(c => c.roman);
  const hasTritoneSub = romans.some(r => r.startsWith('sub('));
  const hasSecondaryDom = romans.some(r => r.includes('/'));
  const hasExtension = romans.some(r => /9|11|13/.test(r));

  if (profile.favorsTritoneSubs > 0.65 && !hasTritoneSub) {
    findings.push({
      id: `style-tritone-${sectionIdx}`,
      severity: 'info',
      category: 'style_fidelity',
      location: { sectionIdx, bar: section.chords[0].bar },
      message: `Preset "${preset}" strongly favors tritone substitutions as a signature move, but none appear in this section.`,
      suggestion: `Try an 'auto' reharmonization pass on a dominant chord in this section — tritone subs are part of this style's fingerprint.`,
    });
  }
  if (profile.favorsExtensions > 0.65 && !hasExtension) {
    findings.push({
      id: `style-ext-${sectionIdx}`,
      severity: 'info',
      category: 'style_fidelity',
      location: { sectionIdx, bar: section.chords[0].bar },
      message: `Preset "${preset}" calls for lush extensions (9ths/11ths/13ths) but this section stays mostly on plain triads/7ths.`,
      suggestion: `Increase complexity to level 3, or manually extend a few anchor chords (I, IV) to 9/13 voicings.`,
    });
  }
  if (profile.favorsSecondaryDominants > 0.65 && !hasSecondaryDom) {
    findings.push({
      id: `style-secdom-${sectionIdx}`,
      severity: 'info',
      category: 'style_fidelity',
      location: { sectionIdx, bar: section.chords[0].bar },
      message: `Preset "${preset}" leans on secondary dominants for forward motion, but none appear here.`,
      suggestion: `Consider inserting a V/ii or V/vi ahead of a ii or vi chord to add that characteristic pull.`,
    });
  }

  return findings;
}

// ---------------------------------------------------------------------
// 7. VOICING DENSITY — is the note count per chord appropriate for the
//    instrumentation, or overcrowded/underfilled relative to how many
//    parts are actually sounding?
// ---------------------------------------------------------------------
function checkVoicingDensity(section: GeneratedSection, sectionIdx: number): CriticFinding[] {
  const findings: CriticFinding[] = [];

  for (const [i, chord] of section.chords.entries()) {
    if (!chord.pianoVoicing || !chord.pianoVoicing.notes) continue;
    const pianoNotes = chord.pianoVoicing.notes.length;
    if (pianoNotes >= 6) {
      findings.push({
        id: `density-${sectionIdx}-${chord.bar}-${i}`,
        severity: 'suggestion',
        category: 'voicing_density',
        location: { sectionIdx, bar: chord.bar },
        message: `Piano voicing on bar ${chord.bar} (${chord.chordName}) stacks ${pianoNotes} notes — thick enough to fight with guitar and bass for space.`,
        suggestion: `Switch to a rootless or drop2 voicing to thin this out, especially if guitar is also comping this chord.`,
        fix: { type: 'thin_voicing', targetBar: chord.bar },
      });
    }
  }

  return findings;
}

// ---------------------------------------------------------------------
// Top-level: run all checks, aggregate into a scored critique.
// ---------------------------------------------------------------------
export function critiqueArrangement(sections: GeneratedSection[]): ArrangementCritique {
  const findings: CriticFinding[] = [];

  sections.forEach((section, sectionIdx) => {
    findings.push(...checkRegisterCollisions(section, sectionIdx));
    findings.push(...checkVoiceLeading(section, sectionIdx));
    findings.push(...checkGuitarErgonomics(section, sectionIdx));
    findings.push(...checkHarmonicStasis(section, sectionIdx));
    findings.push(...checkArc(section, sectionIdx));
    findings.push(...checkStyleFidelity(section, sectionIdx, section.def.preset));
    findings.push(...checkVoicingDensity(section, sectionIdx));
  });

  const score = scoreArrangement(findings);
  const summary = summarize(findings, score);

  return { findings, score, summary };
}

function scoreArrangement(findings: CriticFinding[]): number {
  const penalties: Record<Severity, number> = { info: 0.5, suggestion: 1.5, warning: 4, problem: 9 };
  const totalPenalty = findings.reduce((sum, f) => sum + penalties[f.severity], 0);
  return Math.max(0, Math.round(100 - totalPenalty));
}

function summarize(findings: CriticFinding[], score: number): string {
  const problems = findings.filter(f => f.severity === 'problem').length;
  const warnings = findings.filter(f => f.severity === 'warning').length;
  if (score >= 90) return `Solid arrangement (${score}/100). ${warnings} minor issue(s) worth a look, nothing structural.`;
  if (score >= 70) return `Workable arrangement (${score}/100) with ${warnings} warning(s) — mostly voice-leading/ergonomics polish, not rewrites.`;
  if (problems > 0) return `Needs real revision (${score}/100): ${problems} structural problem(s) (large leaps, unplayable guitar) plus ${warnings} warning(s).`;
  return `Rough draft quality (${score}/100). Review findings before treating this as final.`;
}