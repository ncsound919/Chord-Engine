import { describe, it, expect, vi } from 'vitest';
import { applyStyleLens, crossStyleDivergenceReport, StyleException } from './styleAwareCritic';
import { CriticFinding, ArrangementCritique } from './critic';
import { WriterProfile, WriterId, WRITER_PROFILES } from './songFraming';

const makeFinding = (overrides: Partial<CriticFinding> = {}): CriticFinding => ({
  id: 'test-finding',
  severity: 'warning',
  category: 'harmonic_stasis',
  location: { sectionIdx: 0, bar: 0 },
  message: 'Test finding',
  suggestion: 'Test suggestion',
  ...overrides,
});

const makeCritique = (findings: CriticFinding[] = [], score = 70): ArrangementCritique => ({
  findings,
  score,
  summary: 'Test critique',
});

describe('applyStyleLens', () => {
  describe('no matching exceptions', () => {
    it('returns findings unchanged when no exception applies', () => {
      const finding = makeFinding({ category: 'register_collision' });
      const critique = makeCritique([finding]);
      const result = applyStyleLens(critique, 'bacharach');

      expect(result.findings).toHaveLength(1);
      expect(result.findings[0].adjustedSeverity).toBeUndefined();
      expect(result.findings[0].styleNote).toBeUndefined();
    });

    it('does not modify severity when no exception matches', () => {
      const finding = makeFinding({ severity: 'problem', category: 'style_fidelity' });
      const critique = makeCritique([finding]);
      const result = applyStyleLens(critique, 'bacharach');

      expect(result.findings[0].severity).toBe('problem');
    });
  });

  describe('harmonic_stasis downgrade', () => {
    it('downgrades harmonic_stasis for writers with breakdownToGroove', () => {
      const finding = makeFinding({ category: 'harmonic_stasis', severity: 'warning' });
      const critique = makeCritique([finding]);
      const result = applyStyleLens(critique, 'sly_stone');

      expect(result.findings[0].adjustedSeverity).toBeDefined();
      expect(result.findings[0].adjustedSeverity).not.toBe('warning');
      expect(result.findings[0].styleNote).toBeDefined();
      expect(result.findings[0].styleNote).toContain('static-harmony');
    });

    it('does not downgrade harmonic_stasis for writers without breakdownToGroove', () => {
      const finding = makeFinding({ category: 'harmonic_stasis' });
      const critique = makeCritique([finding]);
      const result = applyStyleLens(critique, 'bacharach');

      expect(result.findings[0].adjustedSeverity).toBeUndefined();
    });
  });

  describe('voicing_density downgrade', () => {
    it('downgrades voicing_density for steely preset', () => {
      const finding = makeFinding({ category: 'voicing_density', severity: 'problem' });
      const critique = makeCritique([finding]);
      const result = applyStyleLens(critique, 'steely_dan');

      expect(result.findings[0].adjustedSeverity).toBeDefined();
      expect(result.findings[0].adjustedSeverity).not.toBe('problem');
      expect(result.findings[0].styleNote).toBeDefined();
    });

    it('downgrades voicing_density for jazz preset', () => {
      const finding = makeFinding({ category: 'voicing_density', severity: 'warning' });
      const critique = makeCritique([finding]);
      const result = applyStyleLens(critique, 'bacharach');

      expect(result.findings[0].adjustedSeverity).toBeDefined();
    });

    it('downgrades voicing_density for rnb preset', () => {
      const finding = makeFinding({ category: 'voicing_density', severity: 'suggestion' });
      const critique = makeCritique([finding]);
      const result = applyStyleLens(critique, 'sylvers');

      expect(result.findings[0].adjustedSeverity).toBeDefined();
    });
  });

  describe('arc downgrade', () => {
    it('downgrades arc for writers with extendedVampOutro', () => {
      const finding = makeFinding({ category: 'arc', severity: 'warning' });
      const critique = makeCritique([finding]);
      const result = applyStyleLens(critique, 'steely_dan');

      expect(result.findings[0].adjustedSeverity).toBeDefined();
      expect(result.findings[0].styleNote).toContain('vamp-outro');
    });

    it('downgrades arc for sylvers with extendedVampOutro', () => {
      const finding = makeFinding({ category: 'arc', severity: 'problem' });
      const critique = makeCritique([finding]);
      const result = applyStyleLens(critique, 'sylvers');

      expect(result.findings[0].adjustedSeverity).toBeDefined();
    });

    it('does not downgrade arc for writers without extendedVampOutro', () => {
      const finding = makeFinding({ category: 'arc' });
      const critique = makeCritique([finding]);
      const result = applyStyleLens(critique, 'bacharach');

      expect(result.findings[0].adjustedSeverity).toBeUndefined();
    });
  });

  describe('voice_leading downgrade', () => {
    it('downgrades voice_leading for writers with meterShifts', () => {
      const finding = makeFinding({ category: 'voice_leading', severity: 'warning' });
      const critique = makeCritique([finding]);
      const result = applyStyleLens(critique, 'bacharach');

      expect(result.findings[0].adjustedSeverity).toBeDefined();
      expect(result.findings[0].styleNote).toContain('meter');
    });

    it('does not downgrade voice_leading for writers without meterShifts', () => {
      const finding = makeFinding({ category: 'voice_leading' });
      const critique = makeCritique([finding]);
      const result = applyStyleLens(critique, 'sly_stone');

      expect(result.findings[0].adjustedSeverity).toBeUndefined();
    });
  });

  describe('adjustedSeverity and styleNote', () => {
    it('sets adjustedSeverity on findings with matching exceptions', () => {
      const finding = makeFinding({ category: 'harmonic_stasis', severity: 'problem' });
      const critique = makeCritique([finding]);
      const result = applyStyleLens(critique, 'sly_stone');

      expect(result.findings[0].adjustedSeverity).toBeDefined();
      expect(typeof result.findings[0].adjustedSeverity).toBe('string');
    });

    it('sets styleNote with reason text', () => {
      const finding = makeFinding({ category: 'voicing_density', severity: 'warning' });
      const critique = makeCritique([finding]);
      const result = applyStyleLens(critique, 'steely_dan');

      expect(result.findings[0].styleNote).toContain('thick');
    });

    it('preserves original severity in the finding', () => {
      const finding = makeFinding({ category: 'harmonic_stasis', severity: 'problem' });
      const critique = makeCritique([finding]);
      const result = applyStyleLens(critique, 'sly_stone');

      expect(result.findings[0].severity).toBe('problem');
    });
  });

  describe('scoreDelta calculation', () => {
    it('calculates scoreDelta based on penalty differences', () => {
      const finding = makeFinding({ category: 'harmonic_stasis', severity: 'problem' });
      const critique = makeCritique([finding], 70);
      const result = applyStyleLens(critique, 'sly_stone');

      expect(result.scoreDelta).toBeGreaterThan(0);
    });

    it('returns zero scoreDelta when no exceptions apply', () => {
      const finding = makeFinding({ category: 'register_collision' });
      const critique = makeCritique([finding], 70);
      const result = applyStyleLens(critique, 'bacharach');

      expect(result.scoreDelta).toBe(0);
    });

    it('adjusts score by scoreDelta', () => {
      const finding = makeFinding({ category: 'harmonic_stasis', severity: 'problem' });
      const critique = makeCritique([finding], 50);
      const result = applyStyleLens(critique, 'sly_stone');

      expect(result.score).toBe(50 + result.scoreDelta);
    });
  });

  describe('contradictionsFound count', () => {
    it('counts contradictionsFound correctly for multiple findings', () => {
      const findings = [
        makeFinding({ category: 'voicing_density', severity: 'warning' }),
        makeFinding({ id: 'f2', category: 'arc', severity: 'suggestion' }),
        makeFinding({ id: 'f3', category: 'register_collision', severity: 'info' }),
      ];
      const critique = makeCritique(findings);
      const result = applyStyleLens(critique, 'steely_dan');

      expect(result.contradictionsFound).toBe(2);
    });

    it('returns 0 contradictions when no exceptions apply', () => {
      const finding = makeFinding({ category: 'register_collision' });
      const critique = makeCritique([finding]);
      const result = applyStyleLens(critique, 'bacharach');

      expect(result.contradictionsFound).toBe(0);
    });
  });

  describe('writer-specific profiles', () => {
    it('steely_dan has extendedVampOutro=true so arc gets discounted', () => {
      const profile = WRITER_PROFILES['steely_dan'];
      expect(profile.devices.extendedVampOutro).toBe(true);

      const finding = makeFinding({ category: 'arc', severity: 'warning' });
      const critique = makeCritique([finding]);
      const result = applyStyleLens(critique, 'steely_dan');

      expect(result.findings[0].adjustedSeverity).toBeDefined();
    });

    it('bacharach has meterShifts=true so voice_leading gets discounted', () => {
      const profile = WRITER_PROFILES['bacharach'];
      expect(profile.devices.meterShifts).toBe(true);

      const finding = makeFinding({ category: 'voice_leading', severity: 'warning' });
      const critique = makeCritique([finding]);
      const result = applyStyleLens(critique, 'bacharach');

      expect(result.findings[0].adjustedSeverity).toBeDefined();
    });

    it('sly_stone has breakdownToGroove=true so stasis gets discounted', () => {
      const profile = WRITER_PROFILES['sly_stone'];
      expect(profile.devices.breakdownToGroove).toBe(true);

      const finding = makeFinding({ category: 'harmonic_stasis', severity: 'warning' });
      const critique = makeCritique([finding]);
      const result = applyStyleLens(critique, 'sly_stone');

      expect(result.findings[0].adjustedSeverity).toBeDefined();
    });
  });

  describe('severity downgrade levels', () => {
    it('downgrades problem to info when discount is 0.1', () => {
      const finding = makeFinding({ category: 'harmonic_stasis', severity: 'problem' });
      const critique = makeCritique([finding]);
      const result = applyStyleLens(critique, 'sly_stone');

      const problemIdx = ['info', 'suggestion', 'warning', 'problem'].indexOf('problem');
      const newIdx = Math.max(0, Math.round(problemIdx * 0.1));
      expect(['info', 'suggestion', 'warning', 'problem'][newIdx]).toBe(result.findings[0].adjustedSeverity);
    });

    it('downgrades warning with 0.5 discount', () => {
      const finding = makeFinding({ category: 'voice_leading', severity: 'warning' });
      const critique = makeCritique([finding]);
      const result = applyStyleLens(critique, 'bacharach');

      const warningIdx = ['info', 'suggestion', 'warning', 'problem'].indexOf('warning');
      const newIdx = Math.max(0, Math.round(warningIdx * 0.5));
      expect(['info', 'suggestion', 'warning', 'problem'][newIdx]).toBe(result.findings[0].adjustedSeverity);
    });
  });

  describe('multiple findings', () => {
    it('processes multiple findings independently', () => {
      const findings = [
        makeFinding({ category: 'harmonic_stasis', severity: 'warning' }),
        makeFinding({ id: 'f2', category: 'register_collision', severity: 'info' }),
        makeFinding({ id: 'f3', category: 'arc', severity: 'warning' }),
      ];
      const critique = makeCritique(findings);
      const result = applyStyleLens(critique, 'sly_stone');

      expect(result.findings).toHaveLength(3);
      expect(result.findings[0].adjustedSeverity).toBeDefined();
      expect(result.findings[1].adjustedSeverity).toBeUndefined();
      expect(result.findings[2].adjustedSeverity).toBeDefined();
    });
  });
});

describe('crossStyleDivergenceReport', () => {
  describe('basic behavior', () => {
    it('returns a report item for each finding', () => {
      const findings = [
        makeFinding({ category: 'harmonic_stasis' }),
        makeFinding({ id: 'f2', category: 'register_collision' }),
      ];
      const critique = makeCritique(findings);
      const report = crossStyleDivergenceReport(critique);

      expect(report).toHaveLength(2);
    });

    it('handles empty findings', () => {
      const critique = makeCritique([]);
      const report = crossStyleDivergenceReport(critique);

      expect(report).toHaveLength(0);
    });
  });

  describe('excusedBy list', () => {
    it('lists writers that excuse harmonic_stasis', () => {
      const finding = makeFinding({ category: 'harmonic_stasis' });
      const critique = makeCritique([finding]);
      const report = crossStyleDivergenceReport(critique);

      const excusedWriterIds = report[0].excusedBy.map(w => w.id);
      expect(excusedWriterIds).toContain('sly_stone');
      expect(excusedWriterIds).toContain('mayfield');
      expect(excusedWriterIds).toContain('sylvers');
    });

    it('lists writers that excuse voicing_density', () => {
      const finding = makeFinding({ category: 'voicing_density' });
      const critique = makeCritique([finding]);
      const report = crossStyleDivergenceReport(critique);

      const excusedWriterIds = report[0].excusedBy.map(w => w.id);
      expect(excusedWriterIds).toContain('steely_dan');
      expect(excusedWriterIds).toContain('bacharach');
      expect(excusedWriterIds).toContain('sylvers');
    });

    it('lists writers that excuse arc', () => {
      const finding = makeFinding({ category: 'arc' });
      const critique = makeCritique([finding]);
      const report = crossStyleDivergenceReport(critique);

      const excusedWriterIds = report[0].excusedBy.map(w => w.id);
      expect(excusedWriterIds).toContain('steely_dan');
      expect(excusedWriterIds).toContain('sylvers');
      expect(excusedWriterIds).toContain('mayfield');
      expect(excusedWriterIds).toContain('sly_stone');
    });

    it('lists writers that excuse voice_leading', () => {
      const finding = makeFinding({ category: 'voice_leading' });
      const critique = makeCritique([finding]);
      const report = crossStyleDivergenceReport(critique);

      const excusedWriterIds = report[0].excusedBy.map(w => w.id);
      expect(excusedWriterIds).toContain('bacharach');
    });

    it('includes writer name in excusedBy', () => {
      const finding = makeFinding({ category: 'harmonic_stasis' });
      const critique = makeCritique([finding]);
      const report = crossStyleDivergenceReport(critique);

      const slyEntry = report[0].excusedBy.find(w => w.id === 'sly_stone');
      expect(slyEntry?.name).toBe('Sly Stone');
    });
  });

  describe('isUniversalFlaw', () => {
    it('is true when no writer excuses the finding', () => {
      const finding = makeFinding({ category: 'register_collision' });
      const critique = makeCritique([finding]);
      const report = crossStyleDivergenceReport(critique);

      expect(report[0].isUniversalFlaw).toBe(true);
      expect(report[0].excusedBy).toHaveLength(0);
    });

    it('is false when at least one writer excuses the finding', () => {
      const finding = makeFinding({ category: 'harmonic_stasis' });
      const critique = makeCritique([finding]);
      const report = crossStyleDivergenceReport(critique);

      expect(report[0].isUniversalFlaw).toBe(false);
      expect(report[0].excusedBy.length).toBeGreaterThan(0);
    });

    it('is true for guitar_ergonomics (no style exception)', () => {
      const finding = makeFinding({ category: 'guitar_ergonomics' });
      const critique = makeCritique([finding]);
      const report = crossStyleDivergenceReport(critique);

      expect(report[0].isUniversalFlaw).toBe(true);
    });
  });

  describe('finding preservation', () => {
    it('preserves the original finding in the report', () => {
      const finding = makeFinding({
        id: 'unique-id',
        category: 'harmonic_stasis',
        severity: 'problem',
        message: 'Original message',
      });
      const critique = makeCritique([finding]);
      const report = crossStyleDivergenceReport(critique);

      expect(report[0].finding).toEqual(finding);
    });
  });

  describe('all writers checked', () => {
    it('checks all five writer profiles', () => {
      const finding = makeFinding({ category: 'voicing_density' });
      const critique = makeCritique([finding]);
      const report = crossStyleDivergenceReport(critique);

      const allWriterIds = Object.keys(WRITER_PROFILES) as WriterId[];
      expect(report[0].excusedBy.length).toBeLessThanOrEqual(allWriterIds.length);
    });
  });
});
