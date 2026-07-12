// theory/styleAwareCritic.ts
// Detects and resolves conflicts between the GENERIC critic (critic.ts,
// which encodes universal voice-leading/register/ergonomics judgment) and
// the STYLE fingerprint (harmony.ts PRESET_PROFILES / songFraming.ts
// WriterProfile) for the specific writer being emulated.
//
// This is not a new independent module — it's a lens that sits BETWEEN
// critic.ts and the person reading its output, re-weighting or overriding
// findings that are actually stylistic signatures being misjudged as flaws.
// No other piece in this system currently checks its own rules against
// each other; this is the first one that does.

import { CriticFinding, ArrangementCritique } from './critic';
import { WriterProfile, WriterId, WRITER_PROFILES } from './songFraming';

export interface StyleException {
  findingCategory: CriticFinding['category'];
  writerCondition: (profile: WriterProfile) => boolean;
  reasonPermitted: string;
  severityDiscount: number; // 0 = ignore entirely, 1 = no change
}

// The known cases where "generically wrong" is "stylistically correct."
const STYLE_EXCEPTIONS: StyleException[] = [
  {
    findingCategory: 'harmonic_stasis',
    writerCondition: (p) => p.devices.breakdownToGroove,
    reasonPermitted:
      'This writer profile uses extended static-harmony breakdowns as a structural device (Sly Stone/Mayfield groove convention) — the "flatness" the generic critic sees is the point, not an oversight.',
    severityDiscount: 0.1,
  },
  {
    findingCategory: 'voicing_density',
    writerCondition: (p) =>
      p.harmonyPreset === 'steely' ||
      p.harmonyPreset === 'jazz' ||
      p.harmonyPreset === 'rnb',
    reasonPermitted:
      'Intentionally thick, stacked-extension voicings (maj13, m11, add9) are stylistic signatures for this genre, not accidental overcrowding — the generic density threshold is bypassed.',
    severityDiscount: 0.3,
  },
  {
    findingCategory: 'arc',
    writerCondition: (p) => p.devices.extendedVampOutro,
    reasonPermitted:
      'Extended vamp-outro writers (Sylvers/Mayfield) deliberately hold flat density through the outro groove — the "no build" the arc-checker flags is the intended hypnotic-loop effect, not a failure to develop.',
    severityDiscount: 0.2,
  },
  {
    findingCategory: 'voice_leading',
    writerCondition: (p) => p.devices.meterShifts,
    reasonPermitted:
      'Irregular meter changes and meter-shifting sections intentionally produce larger voice movements at the phrase boundaries — treat leaps at meter shifts differently than leaps within stable meters.',
    severityDiscount: 0.5,
  },
];

export interface StyleAwareFinding extends CriticFinding {
  /** The critic’s original severity is preserved in `severity`. */
  adjustedSeverity?: CriticFinding['severity'];
  /** Human-readable explanation when a style exception was applied. */
  styleNote?: string;
}

const SEVERITY_ORDER: CriticFinding['severity'][] = [
  'info',
  'suggestion',
  'warning',
  'problem',
];

function downgradeSeverity(
  sev: CriticFinding['severity'],
  discount: number
): CriticFinding['severity'] {
  const idx = SEVERITY_ORDER.indexOf(sev);
  const newIdx = Math.max(0, Math.round(idx * discount));
  return SEVERITY_ORDER[newIdx];
}

/**
 * Apply the style lens to a generic arrangement critique.
 *
 * Returns an `ArrangementCritique` with style‑aware findings,
 * plus `scoreDelta` (heuristic change in points) and
 * `contradictionsFound` (how many findings were discounted).
 *
 * **Note on `scoreDelta`** – This is a rough internal gauge, not an
 * official score. If `critique.score` exists, it is adjusted by this delta.
 */
export function applyStyleLens(
  critique: ArrangementCritique,
  writerId: WriterId
): ArrangementCritique & {
  scoreDelta: number;
  contradictionsFound: number;
} {
  const profile = WRITER_PROFILES[writerId];
  let contradictionsFound = 0;
  let scoreDelta = 0;

  // Penalty values for severity levels (used to translate severity changes
  // into a heuristic score delta – not part of the official scoring model).
  const penalties: Record<CriticFinding['severity'], number> = {
    info: 0.5,
    suggestion: 1.5,
    warning: 4,
    problem: 9,
  };

  const findings: StyleAwareFinding[] = critique.findings.map((f) => {
    const exception = STYLE_EXCEPTIONS.find(
      (e) =>
        e.findingCategory === f.category && e.writerCondition(profile)
    );
    if (!exception) return { ...f }; // original severity unchanged

    contradictionsFound++;
    const adjustedSeverity = downgradeSeverity(
      f.severity,
      exception.severityDiscount
    );
    scoreDelta += penalties[f.severity] - penalties[adjustedSeverity];

    return {
      ...f,                      // preserves original `severity`
      adjustedSeverity,
      styleNote: exception.reasonPermitted,
    };
  });

  // Build a full ArrangementCritique with adjusted findings and,
  // if the original had a score, apply the heuristic delta.
  const adjustedScore = critique.score + scoreDelta;

  return {
    ...critique,
    findings,
    score: adjustedScore,
    scoreDelta,
    contradictionsFound,
  };
}

// ──────────────────────────────────────────────
// Cross‑style divergence report
// ──────────────────────────────────────────────

export interface CrossStyleReportItem {
  finding: CriticFinding;
  excusedBy: { id: WriterId; name: string }[];
  isUniversalFlaw: boolean;
}

const WRITER_NAMES: Record<WriterId, string> = {
  bacharach: 'Burt Bacharach',
  sylvers: 'Leon Sylvers III',
  mayfield: 'Curtis Mayfield',
  sly_stone: 'Sly Stone',
  steely_dan: 'Steely Dan',
};

/**
 * Run the generic critic’s findings against ALL five writer profiles.
 * Returns each finding with the writers whose style permits it.
 * `isUniversalFlaw` is true when NO writer profile excuses the finding —
 * that indicates a genuine, universal arrangement error.
 */
export function crossStyleDivergenceReport(
  critique: ArrangementCritique
): CrossStyleReportItem[] {
  const allWriters = Object.keys(WRITER_PROFILES) as WriterId[];

  return critique.findings.map((finding) => {
    const excusedBy: { id: WriterId; name: string }[] = [];

    allWriters.forEach((id) => {
      const profile = WRITER_PROFILES[id];
      const exception = STYLE_EXCEPTIONS.find(
        (e) =>
          e.findingCategory === finding.category &&
          e.writerCondition(profile)
      );
      if (exception) {
        excusedBy.push({ id, name: WRITER_NAMES[id] });
      }
    });

    return {
      finding,
      excusedBy,
      isUniversalFlaw: excusedBy.length === 0,
    };
  });
}