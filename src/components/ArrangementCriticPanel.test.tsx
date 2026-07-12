import React from 'react';
import { render, screen, cleanup, fireEvent, act } from '@testing-library/react';
import { vi, describe, it, expect, afterEach } from 'vitest';
import { ArrangementCriticPanel } from './ArrangementCriticPanel';
import type { GeneratedSection } from '../lib/engine';
import { critiqueArrangement } from '../theory/critic';
import { optimizeArrangement } from '../theory/fixer';
import { applyStyleLens, crossStyleDivergenceReport } from '../theory/styleAwareCritic';

// ─── Mocks ──────────────────────────────────────────────────

vi.mock('../theory/critic', () => ({
  critiqueArrangement: vi.fn(() => ({
    findings: [
      {
        id: 'f1',
        severity: 'warning',
        category: 'voice_leading',
        location: { sectionIdx: 0, bar: 2 },
        message: 'Rough interval detected between chords.',
        suggestion: 'Use a passing chord to smooth the motion.',
        fix: { type: 'resubstitute' },
      },
    ],
    score: 72,
    summary: 'Voice leading needs improvement in section 1.',
  })),
}));

vi.mock('../theory/fixer', () => ({
  optimizeArrangement: vi.fn(() => ({
    sections: [],
    scoreBefore: 72,
    scoreAfter: 85,
    steps: [
      {
        pass: 1,
        bar: 2,
        sectionName: 'Verse 1',
        category: 'voice_leading',
        description: 'Smoothed interval with passing chord.',
        scoreDelta: 13,
      },
    ],
  })),
}));

vi.mock('../theory/styleAwareCritic', () => ({
  applyStyleLens: vi.fn(() => ({
    findings: [],
    scoreDelta: 5,
    contradictionsFound: 1,
  })),
  crossStyleDivergenceReport: vi.fn(() => []),
}));

vi.mock('../theory/songFraming', () => ({
  WriterId: 'bacharach',
  WRITER_PROFILES: {},
}));

// ─── Fixtures ───────────────────────────────────────────────

const mockSections: GeneratedSection[] = [
  {
    def: { id: '1', name: 'Verse 1', preset: 'steely', lengthBars: 8 },
    chords: [
      { bar: 1, beat: 1, roman: 'Imaj7', chordName: 'Fmaj7' },
      { bar: 2, beat: 1, roman: 'ii7', chordName: 'Gm7' },
    ],
  },
  {
    def: { id: '2', name: 'Chorus', preset: 'isley', lengthBars: 8 },
    chords: [
      { bar: 1, beat: 1, roman: 'IVmaj7', chordName: 'Bbmaj7' },
      { bar: 2, beat: 1, roman: 'V7', chordName: 'C7' },
    ],
  },
];

// ─── Tests ──────────────────────────────────────────────────

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('ArrangementCriticPanel', () => {
  it('renders null when sections are empty', () => {
    const { container } = render(
      <ArrangementCriticPanel sections={[]} musicKey="F" />
    );
    expect(container.innerHTML).toBe('');
  });

  it('renders the panel header and quality score', () => {
    render(
      <ArrangementCriticPanel sections={mockSections} musicKey="F" />
    );
    expect(screen.getByText(/Arrangement Critic/)).toBeInTheDocument();
    expect(screen.getByText(/AI-Driven Post-Arrangement Audit/)).toBeInTheDocument();
    expect(screen.getByText(/72/)).toBeInTheDocument();
  });

  it('renders the critique summary', () => {
    render(
      <ArrangementCriticPanel sections={mockSections} musicKey="F" />
    );
    expect(screen.getByText(/Voice leading needs improvement/)).toBeInTheDocument();
  });

  it('renders the Auto-Optimize button when score < 100', () => {
    render(
      <ArrangementCriticPanel sections={mockSections} musicKey="F" />
    );
    expect(screen.getByText(/Auto-Optimize Entire Arrangement/)).toBeInTheDocument();
  });

  it('renders the style lens selector', () => {
    render(
      <ArrangementCriticPanel sections={mockSections} musicKey="F" />
    );
    expect(screen.getByText(/Active Critique Lens/)).toBeInTheDocument();
    expect(screen.getByDisplayValue(/Standard Theory Rules/)).toBeInTheDocument();
  });

  it('renders findings with severity and category', () => {
    render(
      <ArrangementCriticPanel sections={mockSections} musicKey="F" />
    );
    expect(screen.getByText(/Rough interval detected/)).toBeInTheDocument();
    expect(screen.getAllByText(/voice leading/).length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText(/warning/)).toBeInTheDocument();
  });

  it('renders the Fix Now button when onApplyFix is provided', () => {
    const onApplyFix = vi.fn();
    render(
      <ArrangementCriticPanel
        sections={mockSections}
        musicKey="F"
        onApplyFix={onApplyFix}
      />
    );
    expect(screen.getByText(/Fix Now/)).toBeInTheDocument();
  });

  it('does not render Fix Now when onApplyFix is omitted', () => {
    render(
      <ArrangementCriticPanel sections={mockSections} musicKey="F" />
    );
    expect(screen.queryByText(/Fix Now/)).not.toBeInTheDocument();
  });

  it('renders category filter buttons', () => {
    render(
      <ArrangementCriticPanel sections={mockSections} musicKey="F" />
    );
    expect(screen.getByText(/All/)).toBeInTheDocument();
    expect(screen.getAllByText(/voice leading/).length).toBeGreaterThanOrEqual(1);
  });

  it('renders the cross-style divergence toggle', () => {
    render(
      <ArrangementCriticPanel sections={mockSections} musicKey="F" />
    );
    expect(screen.getByText(/Cross-Style Divergence Grid/)).toBeInTheDocument();
  });

  it('toggles the divergence report open and closed', () => {
    render(
      <ArrangementCriticPanel sections={mockSections} musicKey="F" />
    );
    const toggleBtn = screen.getByText(/Cross-Style Divergence Grid/);
    fireEvent.click(toggleBtn);
    expect(screen.getByText(/Close Divergence Report/)).toBeInTheDocument();
    expect(screen.getByText(/Cross-Style Divergence Report/)).toBeInTheDocument();
    fireEvent.click(screen.getByText(/Close Divergence Report/));
    expect(screen.getByText(/Cross-Style Divergence Grid/)).toBeInTheDocument();
  });

  it('filters findings when a category button is clicked', () => {
    render(
      <ArrangementCriticPanel sections={mockSections} musicKey="F" />
    );
    const categoryBtns = screen.getAllByRole('button');
    const voiceLeadingBtn = categoryBtns.find(btn =>
      btn.textContent?.includes('voice leading') && btn.textContent?.includes('(1)')
    );
    expect(voiceLeadingBtn).toBeDefined();
    fireEvent.click(voiceLeadingBtn!);
    expect(screen.getByText(/Rough interval detected/)).toBeInTheDocument();
  });

  it('resets category filter when All button is clicked', () => {
    render(
      <ArrangementCriticPanel sections={mockSections} musicKey="F" />
    );
    const categoryBtns = screen.getAllByRole('button');
    const voiceLeadingBtn = categoryBtns.find(btn =>
      btn.textContent?.includes('voice leading') && btn.textContent?.includes('(1)')
    );
    fireEvent.click(voiceLeadingBtn!);
    const allBtn = screen.getByRole('button', { name: /All \(1\)/ });
    fireEvent.click(allBtn);
    expect(screen.getByText(/Rough interval detected/)).toBeInTheDocument();
  });

  it('calls onApplyFix when Fix Now button is clicked', async () => {
    vi.useFakeTimers();
    const onApplyFix = vi.fn();
    render(
      <ArrangementCriticPanel
        sections={mockSections}
        musicKey="F"
        onApplyFix={onApplyFix}
      />
    );
    const fixBtn = screen.getByText(/Fix Now/);
    fireEvent.click(fixBtn);
    expect(screen.getByText(/Fixing\.\.\./)).toBeInTheDocument();
    await act(async () => {
      vi.advanceTimersByTime(500);
    });
    expect(onApplyFix).toHaveBeenCalledWith(0, 2, 'resubstitute');
    vi.useRealTimers();
  });

  it('changes the style lens selector', () => {
    render(
      <ArrangementCriticPanel sections={mockSections} musicKey="F" />
    );
    const select = screen.getByDisplayValue(/Standard Theory Rules/);
    fireEvent.change(select, { target: { value: 'bacharach' } });
    expect(select).toHaveValue('bacharach');
  });

  it('renders the optimize button when score is below 100', () => {
    render(
      <ArrangementCriticPanel sections={mockSections} musicKey="F" />
    );
    expect(screen.getByText(/Auto-Optimize Entire Arrangement/)).toBeInTheDocument();
  });

  it('clicking optimize button shows sweeping animation text', async () => {
    vi.useFakeTimers();
    render(
      <ArrangementCriticPanel sections={mockSections} musicKey="F" />
    );
    const optimizeBtn = screen.getByText(/Auto-Optimize Entire Arrangement/);
    fireEvent.click(optimizeBtn);
    expect(screen.getByText(/Sweeping Multi-Pass/)).toBeInTheDocument();
    await act(async () => {
      vi.advanceTimersByTime(1000);
    });
    vi.useRealTimers();
  });

  it('shows the optimization report after optimizing', async () => {
    vi.useFakeTimers();
    render(
      <ArrangementCriticPanel sections={mockSections} musicKey="F" />
    );
    const optimizeBtn = screen.getByText(/Auto-Optimize Entire Arrangement/);
    fireEvent.click(optimizeBtn);
    await act(async () => {
      vi.advanceTimersByTime(1000);
    });
    expect(screen.getByText(/Optimized Theory Score/)).toBeInTheDocument();
    expect(screen.getByText(/Optimization Report/)).toBeInTheDocument();
    vi.useRealTimers();
  });

  it('renders the score as a numeric value', () => {
    render(
      <ArrangementCriticPanel sections={mockSections} musicKey="F" />
    );
    expect(screen.getByText('72')).toBeInTheDocument();
    expect(screen.getByText('/100')).toBeInTheDocument();
  });

  it('renders finding severity badge', () => {
    render(
      <ArrangementCriticPanel sections={mockSections} musicKey="F" />
    );
    expect(screen.getByText('warning')).toBeInTheDocument();
  });

  it('renders the suggestion text in the finding', () => {
    render(
      <ArrangementCriticPanel sections={mockSections} musicKey="F" />
    );
    expect(screen.getByText(/Use a passing chord/)).toBeInTheDocument();
  });

  it('renders the section name in the finding', () => {
    render(
      <ArrangementCriticPanel sections={mockSections} musicKey="F" />
    );
    expect(screen.getByText(/Verse 1/)).toBeInTheDocument();
  });

  it('renders the bar number in the finding', () => {
    render(
      <ArrangementCriticPanel sections={mockSections} musicKey="F" />
    );
    expect(screen.getByText(/Bar 2/)).toBeInTheDocument();
  });

  it('does not render the optimization report before optimizing', () => {
    render(
      <ArrangementCriticPanel sections={mockSections} musicKey="F" />
    );
    expect(screen.queryByText(/Optimization Report/)).not.toBeInTheDocument();
  });

  it('sets activeLens when selectedWriter prop is provided', () => {
    render(
      <ArrangementCriticPanel
        sections={mockSections}
        musicKey="F"
        selectedWriter="bacharach"
      />
    );
    expect(screen.getByDisplayValue(/Burt Bacharach Lens/)).toBeInTheDocument();
  });

  it('displays "No arrangement flaws detected" when findings are empty', () => {
    vi.mocked(critiqueArrangement).mockReturnValueOnce({
      findings: [],
      score: 95,
      summary: 'No issues found.',
    });
    render(
      <ArrangementCriticPanel sections={mockSections} musicKey="F" />
    );
    expect(screen.getByText(/No arrangement flaws detected/)).toBeInTheDocument();
  });

  it('renders green score when displayedScore >= 90', () => {
    vi.mocked(critiqueArrangement).mockReturnValueOnce({
      findings: [],
      score: 95,
      summary: 'Excellent arrangement.',
    });
    const { container } = render(
      <ArrangementCriticPanel sections={mockSections} musicKey="F" />
    );
    expect(screen.getByText('95')).toBeInTheDocument();
    const scoreDiv = container.querySelector('.text-emerald-400');
    expect(scoreDiv).toBeTruthy();
  });

  it('renders amber score when displayedScore >= 70 and < 90', () => {
    const { container } = render(
      <ArrangementCriticPanel sections={mockSections} musicKey="F" />
    );
    expect(screen.getByText('72')).toBeInTheDocument();
    const scoreDiv = container.querySelector('.text-amber-400');
    expect(scoreDiv).toBeTruthy();
  });

  it('renders red score when displayedScore < 70', () => {
    vi.mocked(critiqueArrangement).mockReturnValueOnce({
      findings: [],
      score: 55,
      summary: 'Needs work.',
    });
    const { container } = render(
      <ArrangementCriticPanel sections={mockSections} musicKey="F" />
    );
    expect(screen.getByText('55')).toBeInTheDocument();
    const scoreDiv = container.querySelector('.text-red-400');
    expect(scoreDiv).toBeTruthy();
  });

  it('dismisses the beforeAfterScore banner when × is clicked', async () => {
    vi.useFakeTimers();
    vi.mocked(critiqueArrangement).mockReturnValueOnce({
      findings: [
        {
          id: 'f1',
          severity: 'warning',
          category: 'voice_leading',
          location: { sectionIdx: 0, bar: 2 },
          message: 'Issue.',
          suggestion: 'Fix it.',
          fix: { type: 'resubstitute' },
        },
      ],
      score: 72,
      summary: 'Needs work.',
    });
    const onUpdateSections = vi.fn();
    render(
      <ArrangementCriticPanel
        sections={mockSections}
        musicKey="F"
        onUpdateSections={onUpdateSections}
      />
    );
    const optimizeBtn = screen.getByText(/Auto-Optimize Entire Arrangement/);
    fireEvent.click(optimizeBtn);
    await act(async () => {
      vi.advanceTimersByTime(1000);
    });
    expect(screen.getByText(/Optimized Theory Score/)).toBeInTheDocument();
    const dismissBtn = screen.getByText('×');
    fireEvent.click(dismissBtn);
    expect(screen.queryByText(/Optimized Theory Score/)).not.toBeInTheDocument();
    vi.useRealTimers();
  });

  it('calls onUpdateSections when scoreAfter > scoreBefore', async () => {
    vi.useFakeTimers();
    vi.mocked(critiqueArrangement).mockReturnValueOnce({
      findings: [
        {
          id: 'f1',
          severity: 'warning',
          category: 'voice_leading',
          location: { sectionIdx: 0, bar: 2 },
          message: 'Issue.',
          suggestion: 'Fix it.',
          fix: { type: 'resubstitute' },
        },
      ],
      score: 72,
      summary: 'Needs work.',
    });
    const onUpdateSections = vi.fn();
    render(
      <ArrangementCriticPanel
        sections={mockSections}
        musicKey="F"
        onUpdateSections={onUpdateSections}
      />
    );
    const optimizeBtn = screen.getByText(/Auto-Optimize Entire Arrangement/);
    fireEvent.click(optimizeBtn);
    await act(async () => {
      vi.advanceTimersByTime(1000);
    });
    expect(onUpdateSections).toHaveBeenCalled();
    vi.useRealTimers();
  });

  it('renders findings with severity "problem"', () => {
    vi.mocked(critiqueArrangement).mockReturnValueOnce({
      findings: [
        {
          id: 'f-problem',
          severity: 'problem',
          category: 'register_collision',
          location: { sectionIdx: 0, bar: 1 },
          message: 'Critical collision.',
          suggestion: 'Separate the registers.',
        },
      ],
      score: 60,
      summary: 'Critical issues found.',
    });
    render(
      <ArrangementCriticPanel sections={mockSections} musicKey="F" />
    );
    expect(screen.getByText('problem')).toBeInTheDocument();
    expect(screen.getByText(/Critical collision/)).toBeInTheDocument();
  });

  it('renders findings with severity "info"', () => {
    vi.mocked(critiqueArrangement).mockReturnValueOnce({
      findings: [
        {
          id: 'f-info',
          severity: 'info',
          category: 'style_fidelity',
          location: { sectionIdx: 0, bar: 1 },
          message: 'Style note.',
          suggestion: 'Consider stylistic alignment.',
        },
      ],
      score: 92,
      summary: 'Good arrangement.',
    });
    render(
      <ArrangementCriticPanel sections={mockSections} musicKey="F" />
    );
    expect(screen.getByText('info')).toBeInTheDocument();
    expect(screen.getByText(/Style note/)).toBeInTheDocument();
  });

  it('filters findings by multiple categories', () => {
    vi.mocked(critiqueArrangement).mockReturnValue({
      findings: [
        {
          id: 'f1',
          severity: 'warning',
          category: 'voice_leading',
          location: { sectionIdx: 0, bar: 1 },
          message: 'Voice leading issue.',
          suggestion: 'Smooth it.',
        },
        {
          id: 'f2',
          severity: 'warning',
          category: 'register_collision',
          location: { sectionIdx: 0, bar: 2 },
          message: 'Collision.',
          suggestion: 'Fix it.',
        },
        {
          id: 'f3',
          severity: 'info',
          category: 'voice_leading',
          location: { sectionIdx: 1, bar: 1 },
          message: 'Another voice leading note.',
          suggestion: 'Minor tweak.',
        },
      ],
      score: 75,
      summary: 'Mixed issues.',
    });
    render(
      <ArrangementCriticPanel sections={mockSections} musicKey="F" />
    );
    expect(screen.getByText(/All \(3\)/)).toBeInTheDocument();
    const categoryBtns = screen.getAllByRole('button');
    const voiceLeadingBtn = categoryBtns.find(btn =>
      btn.textContent?.includes('voice leading') && btn.textContent?.includes('(2)')
    );
    expect(voiceLeadingBtn).toBeDefined();
    fireEvent.click(voiceLeadingBtn!);
    expect(screen.getByText(/Voice leading issue/)).toBeInTheDocument();
    expect(screen.getByText(/Another voice leading note/)).toBeInTheDocument();
    expect(screen.queryByText(/Collision\./)).not.toBeInTheDocument();
    vi.mocked(critiqueArrangement).mockReturnValue({
      findings: [
        {
          id: 'f1',
          severity: 'warning',
          category: 'voice_leading',
          location: { sectionIdx: 0, bar: 2 },
          message: 'Rough interval detected between chords.',
          suggestion: 'Use a passing chord to smooth the motion.',
          fix: { type: 'resubstitute' },
        },
      ],
      score: 72,
      summary: 'Voice leading needs improvement in section 1.',
    });
  });

  it('shows cross-style divergence report with findings that have excusedBy', () => {
    vi.mocked(crossStyleDivergenceReport).mockReturnValue([
      {
        finding: {
          id: 'f-div',
          severity: 'warning',
          category: 'voice_leading',
          location: { sectionIdx: 0, bar: 1 },
          message: 'Divergent finding.',
          suggestion: 'Consider style.',
          fix: { type: 'resubstitute' },
        },
        excusedBy: [{ id: 'bacharach' }],
        isUniversalFlaw: false,
      },
    ]);
    render(
      <ArrangementCriticPanel sections={mockSections} musicKey="F" />
    );
    const toggleBtn = screen.getByText(/Cross-Style Divergence Grid/);
    fireEvent.click(toggleBtn);
    expect(screen.getByText(/Cross-Style Divergence Report/)).toBeInTheDocument();
    expect(screen.getByText(/Divergent finding/)).toBeInTheDocument();
    vi.mocked(crossStyleDivergenceReport).mockReturnValue([]);
  });

  it('renders the Clear Log button in optimization report', async () => {
    vi.useFakeTimers();
    vi.mocked(critiqueArrangement).mockReturnValueOnce({
      findings: [
        {
          id: 'f1',
          severity: 'warning',
          category: 'voice_leading',
          location: { sectionIdx: 0, bar: 2 },
          message: 'Issue.',
          suggestion: 'Fix it.',
          fix: { type: 'resubstitute' },
        },
      ],
      score: 72,
      summary: 'Needs work.',
    });
    render(
      <ArrangementCriticPanel sections={mockSections} musicKey="F" />
    );
    const optimizeBtn = screen.getByText(/Auto-Optimize Entire Arrangement/);
    fireEvent.click(optimizeBtn);
    await act(async () => {
      vi.advanceTimersByTime(1000);
    });
    const clearBtn = screen.getByText(/Clear Log/);
    fireEvent.click(clearBtn);
    expect(screen.queryByText(/Optimization Report/)).not.toBeInTheDocument();
    vi.useRealTimers();
  });

  it('hides Auto-Optimize button when score is 100', () => {
    vi.mocked(critiqueArrangement).mockReturnValueOnce({
      findings: [],
      score: 100,
      summary: 'Perfect.',
    });
    render(
      <ArrangementCriticPanel sections={mockSections} musicKey="F" />
    );
    expect(screen.queryByText(/Auto-Optimize Entire Arrangement/)).not.toBeInTheDocument();
  });
});
