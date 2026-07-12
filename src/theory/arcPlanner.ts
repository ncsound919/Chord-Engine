import { SectionDef, Preset, ComplexityLevel } from '../lib/engine';

// ──────────────────────────────────────────────
// 1. Enhanced planning interfaces
// ──────────────────────────────────────────────

export type InstrumentFocus =
  | 'keys_only'
  | 'guitar_only'
  | 'rhythm_section'
  | 'full_band'
  | 'solo_lead';                 // spotlight on a single lead instrument

export type BassRole = 'anchor' | 'melodic' | 'driving' | 'pedal' | 'walking';

export type Texture = 'sparse' | 'medium' | 'dense' | 'transparent' | 'massive';

export interface SectionPlanning {
  sectionId: string;
  name: string;
  /** Final complexity – can be overridden by the song arc plan */
  targetComplexity: ComplexityLevel;
  /** How many voices/notes in the voicing */
  voicingDensity: Texture;
  bassRole: BassRole;
  instrumentationFocus: InstrumentFocus;
  /** 0 (silence) … 100 (climax) */
  energyScore: number;
  /** Suggested per‑track activity (0‑1) */
  trackActivity: {
    drums: number;
    bass: number;
    keys: number;
    guitar: number;
    pads: number;
  };
  /** Optional: relative key modulation (applied before chord gen) */
  keyShift?: number;
  /** Optional: override the style preset for this section */
  presetOverride?: Preset;
  /** If true, keep the arrangement sparse even at higher complexity */
  ambientMode: boolean;
}

export interface SongMacroPlan {
  sections: SectionPlanning[];
  overallDescription: string;
  dynamicArcType: 'crescent' | 'arch' | 'plateau' | 'wave' | 'terraced';
  /** Master tempo curve (BPM per section, optional) */
  tempoMap?: { sectionId: string; bpm: number }[];
}

// ──────────────────────────────────────────────
// 2. Arc analysis helpers
// ──────────────────────────────────────────────

type SectionRole =
  | 'intro'
  | 'verse'
  | 'prechorus'
  | 'chorus'
  | 'bridge'
  | 'solo'
  | 'breakdown'
  | 'outro'
  | 'unknown';

function identifyRole(name: string): SectionRole {
  const n = name.toLowerCase();
  if (n.includes('intro')) return 'intro';
  if (n.includes('outro') || n.includes('coda') || n.includes('ending')) return 'outro';
  if (n.includes('prechorus') || n.includes('pre chorus') || n.includes('climb')) return 'prechorus';
  if (n.includes('chorus')) return 'chorus';
  if (n.includes('bridge') || n.includes('middle 8')) return 'bridge';
  if (n.includes('solo') || n.includes('lead') || n.includes('improv')) return 'solo';
  if (n.includes('breakdown') || n.includes('drop')) return 'breakdown';
  if (n.includes('verse')) return 'verse';
  return 'unknown';
}

/** Return a typical base energy for a section role (0‑100). */
function baseEnergyForRole(role: SectionRole): number {
  switch (role) {
    case 'intro':       return 25;
    case 'verse':       return 40;
    case 'prechorus':   return 60;
    case 'chorus':      return 85;
    case 'bridge':      return 65;
    case 'solo':        return 90;
    case 'breakdown':   return 35;
    case 'outro':       return 20;
    default:            return 50;
  }
}

/** Predict the dynamic arc type from the sequence of roles. */
function inferArcType(roles: SectionRole[]): SongMacroPlan['dynamicArcType'] {
  const roleString = roles.join('-');
  if (/intro.*verse.*chorus.*bridge.*chorus.*outro/.test(roleString)) return 'arch';
  if (/intro.*verse.*chorus.*verse.*chorus.*outro/.test(roleString)) return 'wave';
  if (/intro.*chorus.*chorus.*outro/.test(roleString) || roles.filter(r => r === 'chorus').length >= 3)
    return 'plateau';
  if (roles.filter(r => r === 'chorus' || r === 'solo').length <= 1) return 'crescent';
  return 'terraced'; // stair‑step energy rises
}

/**
 * Smooth raw energy scores to avoid abrupt jumps.
 * Uses a simple moving average with a 3‑section window.
 */
function smoothEnergy(scores: number[]): number[] {
  const smoothed = [...scores];
  for (let i = 1; i < smoothed.length - 1; i++) {
    smoothed[i] = (scores[i - 1] + scores[i] * 2 + scores[i + 1]) / 4;
  }
  return smoothed;
}

/**
 * Distribute instrument activity based on energy and role.
 * Returns per‑track levels (0‑1). Energy drives overall loudness,
 * while role governs which instruments carry the arrangement.
 */
function computeTrackActivity(
  energy: number,
  role: SectionRole,
  instrumentationFocus: InstrumentFocus
): SectionPlanning['trackActivity'] {
  // Base activity proportional to energy (0‑1)
  const e = energy / 100;
  let drums = 0, bass = 0, keys = 0, guitar = 0, pads = 0;

  switch (instrumentationFocus) {
    case 'keys_only':
      keys = e * 0.9; pads = e * 0.5; bass = e * 0.4; drums = e * 0.2;
      break;
    case 'guitar_only':
      guitar = e * 0.9; bass = e * 0.4; drums = e * 0.2; pads = e * 0.3;
      break;
    case 'rhythm_section':
      drums = e * 0.8; bass = e * 0.7; keys = e * 0.3; guitar = e * 0.3; pads = e * 0.1;
      break;
    case 'full_band':
      drums = e * 0.9; bass = e * 0.8; keys = e * 0.7; guitar = e * 0.7; pads = e * 0.5;
      break;
    case 'solo_lead':
      // spotlight: one lead instrument (keys or guitar) is foreground
      if (role === 'solo' || role === 'bridge') {
        keys = e * 0.8; guitar = e * 0.8; // generous – will be narrowed later
        bass = e * 0.6; drums = e * 0.4; pads = e * 0.2;
      } else {
        // background solo fill
        drums = e * 0.7; bass = e * 0.6; keys = e * 0.5; guitar = e * 0.5; pads = e * 0.3;
      }
      break;
  }

  // Solo sections naturally have less drum/bass dominance
  if (role === 'solo') {
    drums *= 0.7; bass *= 0.8;
  }
  // Intro/Outro often very gentle
  if (role === 'intro' || role === 'outro') {
    drums *= 0.5; bass *= 0.6;
  }

  // Clamp to 0‑1
  return {
    drums: Math.min(1, drums),
    bass: Math.min(1, bass),
    keys: Math.min(1, keys),
    guitar: Math.min(1, guitar),
    pads: Math.min(1, pads),
  };
}

// ──────────────────────────────────────────────
// 3. Main planner
// ──────────────────────────────────────────────

export function planSongArc(sections: SectionDef[]): SongMacroPlan {
  if (sections.length === 0) {
    throw new Error('At least one section is required.');
  }

  const planned: SectionPlanning[] = [];
  const roles = sections.map(s => identifyRole(s.name));

  // --- Step 1: base energy from role ---
  let rawEnergy = roles.map(r => baseEnergyForRole(r));

  // --- Step 2: adjust energy by position ---
  // Intro energy is always low, outro lower than previous.
  if (roles[0] === 'intro') rawEnergy[0] = 20;
  if (roles[roles.length - 1] === 'outro') {
    rawEnergy[rawEnergy.length - 1] = 15;
    // fade the last two sections smoothly
    if (rawEnergy.length >= 2) {
      rawEnergy[rawEnergy.length - 2] = Math.min(rawEnergy[rawEnergy.length - 2], 50);
    }
  }

  // Bridge/Breakdown usually a dip between choruses – enforce if detected
  for (let i = 1; i < roles.length - 1; i++) {
    if ((roles[i] === 'bridge' || roles[i] === 'breakdown') &&
        roles[i - 1] === 'chorus' && roles[i + 1] === 'chorus') {
      rawEnergy[i] = Math.min(rawEnergy[i], 55); // intentional drop
    }
  }

  // --- Step 3: smooth the curve ---
  const energyCurve = smoothEnergy(rawEnergy);

  // --- Step 4: infer global arc ---
  const dynamicArcType = inferArcType(roles);

  // --- Step 5: build section plans ---
  sections.forEach((sec, idx) => {
    const role = roles[idx];
    const energy = energyCurve[idx];

    // **Complexity** – derived from energy, optionally overridden by user
    let complexity: ComplexityLevel;
    if (sec.complexity !== undefined) {
      complexity = sec.complexity;
    } else {
      if (energy < 35) complexity = 1;
      else if (energy < 70) complexity = 2;
      else complexity = 3;
    }

    // **Texture / density** – maps energy and role
    let voicingDensity: Texture = 'medium';
    if (energy < 30) voicingDensity = 'sparse';
    else if (energy < 50) voicingDensity = 'medium';
    else if (energy < 80) voicingDensity = 'dense';
    else voicingDensity = 'massive';

    // Sparse is not just low energy – a bridge can be “transparent” at high energy
    if (role === 'bridge') voicingDensity = 'transparent';
    if (role === 'intro' || role === 'outro') voicingDensity = 'sparse';

    // **Bass role** – evolves with the song
    let bassRole: BassRole = 'anchor';
    if (role === 'intro' || role === 'outro') {
      bassRole = 'pedal'; // static, root‑fifth
    } else if (role === 'verse') {
      bassRole = energy < 50 ? 'anchor' : 'melodic';
    } else if (role === 'prechorus') {
      bassRole = 'walking';
    } else if (role === 'chorus' || role === 'solo') {
      bassRole = 'driving';
    } else if (role === 'bridge') {
      bassRole = 'melodic';
    } else if (role === 'breakdown') {
      bassRole = 'anchor';
    }

    // **Instrumentation focus** – based on role and energy
    let focus: InstrumentFocus = 'full_band';
    if (energy < 35) focus = 'keys_only';
    else if (energy < 55 && role !== 'chorus') focus = 'rhythm_section';
    else if (role === 'solo') focus = 'solo_lead';
    else if (role === 'bridge') focus = energy < 70 ? 'rhythm_section' : 'full_band';

    // **Ambient mode** – intro/outro/bridge often benefit from pad‑heavy textures
    const ambientMode = ['intro', 'outro', 'bridge'].includes(role);

    // **Track activity** – computed from energy and focus
    const trackActivity = computeTrackActivity(energy, role, focus);

    // **Key shift** – only if user defined it; otherwise we might want to default to 0
    const keyShift = sec.keyShift ?? 0;

    planned.push({
      sectionId: sec.id,
      name: sec.name,
      targetComplexity: complexity,
      voicingDensity,
      bassRole,
      instrumentationFocus: focus,
      energyScore: Math.round(energy),
      trackActivity,
      keyShift,
      ambientMode,
    });
  });

  // --- Step 6: generate description ---
  const arcDescription = {
    crescent: 'a steady build from quiet to powerful',
    arch: 'an arching form that rises to a central climax and recedes',
    plateau: 'a sustained high‑energy plateau after a gradual build',
    wave: 'a series of peaks and valleys, like verses and choruses breathing',
    terraced: 'energy steps up in distinct stages, like a terrace',
  };
  const sectionSummary = planned
    .map(p => `"${p.name}" (energy ${p.energyScore}, ${p.targetComplexity}-complexity)`)
    .join(' → ');
  const overallDescription = `Dynamic arc: ${dynamicArcType} – ${arcDescription[dynamicArcType]}. ` +
    `Form: ${sectionSummary}.`;

  // Optional tempo map (can be expanded later)
  const tempoMap = planned.map(p => ({
    sectionId: p.sectionId,
    bpm: 120, // default; could be adjusted based on energy
  }));

  return {
    sections: planned,
    overallDescription,
    dynamicArcType,
    tempoMap,
  };
}
