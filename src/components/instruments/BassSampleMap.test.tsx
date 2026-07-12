import React from 'react';
import { describe, expect, it, vi, afterEach } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { BassSampleMap } from './BassSampleMap';

// MIDI note to name mapping (from source):
// noteName(midi) = NOTE_NAMES[midi % 12] + Math.floor(midi / 12 - 1)
// MIDI 24 = C1, 36 = C2, 48 = C3, 60 = C4

function createMockSampler(overrides: Partial<ReturnType<typeof createBaseSampler>> = {}) {
  const base = createBaseSampler();
  return { ...base, ...overrides };
}

function createBaseSampler() {
  return {
    loaded: false,
    loadedNotes: [] as number[],
    loadedArticulations: [] as string[],
    loadedEntries: [] as any[],
  };
}

function entry(note: number, articulation: string, velocity: number, rr: number, hasBuffer = true) {
  return {
    note,
    articulation,
    velocity,
    roundRobin: rr,
    buffer: hasBuffer ? {} as any : null,
    filename: `note_${note}_${articulation}_v${velocity}_rr${rr}.wav`,
  };
}

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe('BassSampleMap', () => {
  it('renders empty state when not loaded', () => {
    const sampler = createMockSampler();
    render(
      <BassSampleMap
        sampler={sampler as any}
        currentArticulation="sustain"
        onArticulationChange={vi.fn()}
      />,
    );
    expect(screen.getByText(/No multisamples loaded/)).toBeInTheDocument();
    expect(screen.getByText(/Upload bass samples/)).toBeInTheDocument();
  });

  it('renders sample map when loaded with entries', () => {
    const sampler = createMockSampler({
      loaded: true,
      loadedNotes: [36, 38, 40],
      loadedArticulations: ['sustain'],
      loadedEntries: [
        entry(36, 'sustain', 100, 0),
        entry(38, 'sustain', 100, 0),
        entry(40, 'sustain', 100, 0),
      ],
    });
    render(
      <BassSampleMap
        sampler={sampler as any}
        currentArticulation="sustain"
        onArticulationChange={vi.fn()}
      />,
    );
    expect(screen.getByText(/Sample Map/)).toBeInTheDocument();
    expect(screen.getByText('C2')).toBeInTheDocument();
    expect(screen.getByText('D2')).toBeInTheDocument();
    expect(screen.getByText('E2')).toBeInTheDocument();
  });

  it('shows articulation switches when multiple articulations', () => {
    const sampler = createMockSampler({
      loaded: true,
      loadedNotes: [36],
      loadedArticulations: ['sustain', 'staccato', 'palm_mute'],
      loadedEntries: [
        entry(36, 'sustain', 100, 0),
        entry(36, 'staccato', 100, 0),
        entry(36, 'palm_mute', 100, 0),
      ],
    });
    render(
      <BassSampleMap
        sampler={sampler as any}
        currentArticulation="sustain"
        onArticulationChange={vi.fn()}
      />,
    );
    expect(screen.getByText('Articulation')).toBeInTheDocument();
    expect(screen.getByText(/Sustain/)).toBeInTheDocument();
    expect(screen.getByText(/Staccato/)).toBeInTheDocument();
    expect(screen.getByText(/Palm Mute/)).toBeInTheDocument();
  });

  it('hides articulation switches when only one articulation', () => {
    const sampler = createMockSampler({
      loaded: true,
      loadedNotes: [36],
      loadedArticulations: ['sustain'],
      loadedEntries: [entry(36, 'sustain', 100, 0)],
    });
    render(
      <BassSampleMap
        sampler={sampler as any}
        currentArticulation="sustain"
        onArticulationChange={vi.fn()}
      />,
    );
    expect(screen.queryByText('Articulation')).not.toBeInTheDocument();
  });

  it('clicking articulation calls onArticulationChange', () => {
    const onArticulationChange = vi.fn();
    const sampler = createMockSampler({
      loaded: true,
      loadedNotes: [36],
      loadedArticulations: ['sustain', 'staccato'],
      loadedEntries: [
        entry(36, 'sustain', 100, 0),
        entry(36, 'staccato', 100, 0),
      ],
    });
    render(
      <BassSampleMap
        sampler={sampler as any}
        currentArticulation="sustain"
        onArticulationChange={onArticulationChange}
      />,
    );
    const staccatoBtn = screen.getByText(/Staccato/);
    fireEvent.click(staccatoBtn);
    expect(onArticulationChange).toHaveBeenCalledWith('staccato');
  });

  it('shows correct note names', () => {
    const sampler = createMockSampler({
      loaded: true,
      loadedNotes: [24, 36, 48, 60],
      loadedArticulations: ['sustain'],
      loadedEntries: [24, 36, 48, 60].map(n => entry(n, 'sustain', 100, 0)),
    });
    render(
      <BassSampleMap
        sampler={sampler as any}
        currentArticulation="sustain"
        onArticulationChange={vi.fn()}
      />,
    );
    expect(screen.getByText('C1')).toBeInTheDocument();
    expect(screen.getByText('C2')).toBeInTheDocument();
    expect(screen.getByText('C3')).toBeInTheDocument();
    expect(screen.getByText('C4')).toBeInTheDocument();
  });

  it('displays velocity layers', () => {
    const sampler = createMockSampler({
      loaded: true,
      loadedNotes: [36],
      loadedArticulations: ['sustain'],
      loadedEntries: [
        entry(36, 'sustain', 80, 0),
        entry(36, 'sustain', 100, 0),
        entry(36, 'sustain', 120, 0),
      ],
    });
    render(
      <BassSampleMap
        sampler={sampler as any}
        currentArticulation="sustain"
        onArticulationChange={vi.fn()}
      />,
    );
    const velCells = document.querySelectorAll('[class*="rounded-sm"]');
    expect(velCells.length).toBeGreaterThanOrEqual(3);
  });

  it('shows RR count', () => {
    const sampler = createMockSampler({
      loaded: true,
      loadedNotes: [36],
      loadedArticulations: ['sustain'],
      loadedEntries: [
        entry(36, 'sustain', 100, 0),
        entry(36, 'sustain', 100, 1),
        entry(36, 'sustain', 100, 2),
      ],
    });
    render(
      <BassSampleMap
        sampler={sampler as any}
        currentArticulation="sustain"
        onArticulationChange={vi.fn()}
      />,
    );
    expect(screen.getByText('3 RR')).toBeInTheDocument();
  });

  it('does not show RR count when zero', () => {
    const sampler = createMockSampler({
      loaded: true,
      loadedNotes: [36],
      loadedArticulations: ['sustain'],
      loadedEntries: [],
    });
    render(
      <BassSampleMap
        sampler={sampler as any}
        currentArticulation="sustain"
        onArticulationChange={vi.fn()}
      />,
    );
    expect(screen.queryByText(/RR/)).not.toBeInTheDocument();
  });

  it('legend renders', () => {
    const sampler = createMockSampler({
      loaded: true,
      loadedNotes: [36],
      loadedArticulations: ['sustain'],
      loadedEntries: [entry(36, 'sustain', 100, 0)],
    });
    render(
      <BassSampleMap
        sampler={sampler as any}
        currentArticulation="sustain"
        onArticulationChange={vi.fn()}
      />,
    );
    expect(screen.getByText('Loaded')).toBeInTheDocument();
    expect(screen.getByText('Missing')).toBeInTheDocument();
  });

  it('shows current articulation name in header', () => {
    const sampler = createMockSampler({
      loaded: true,
      loadedNotes: [36],
      loadedArticulations: ['sustain'],
      loadedEntries: [entry(36, 'sustain', 100, 0)],
    });
    render(
      <BassSampleMap
        sampler={sampler as any}
        currentArticulation="palm_mute"
        onArticulationChange={vi.fn()}
      />,
    );
    expect(screen.getByText(/palm_mute/)).toBeInTheDocument();
  });

  it('highlights current articulation button', () => {
    const sampler = createMockSampler({
      loaded: true,
      loadedNotes: [36],
      loadedArticulations: ['sustain', 'staccato'],
      loadedEntries: [
        entry(36, 'sustain', 100, 0),
        entry(36, 'staccato', 100, 0),
      ],
    });
    render(
      <BassSampleMap
        sampler={sampler as any}
        currentArticulation="staccato"
        onArticulationChange={vi.fn()}
      />,
    );
    const staccatoBtn = screen.getByText(/Staccato/).closest('button')!;
    expect(staccatoBtn.className).toContain('bg-orange-500');
  });

  it('edge case: single note renders correct note name', () => {
    const sampler = createMockSampler({
      loaded: true,
      loadedNotes: [36],
      loadedArticulations: ['sustain'],
      loadedEntries: [entry(36, 'sustain', 100, 0)],
    });
    render(
      <BassSampleMap
        sampler={sampler as any}
        currentArticulation="sustain"
        onArticulationChange={vi.fn()}
      />,
    );
    expect(screen.getByText('C2')).toBeInTheDocument();
  });

  it('edge case: single articulation hides articulation section', () => {
    const sampler = createMockSampler({
      loaded: true,
      loadedNotes: [36],
      loadedArticulations: ['sustain'],
      loadedEntries: [entry(36, 'sustain', 100, 0)],
    });
    render(
      <BassSampleMap
        sampler={sampler as any}
        currentArticulation="sustain"
        onArticulationChange={vi.fn()}
      />,
    );
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it('edge case: missing buffer shows red indicator', () => {
    const sampler = createMockSampler({
      loaded: true,
      loadedNotes: [36],
      loadedArticulations: ['sustain'],
      loadedEntries: [entry(36, 'sustain', 100, 0, false)],
    });
    const { container } = render(
      <BassSampleMap
        sampler={sampler as any}
        currentArticulation="sustain"
        onArticulationChange={vi.fn()}
      />,
    );
    const indicators = container.querySelectorAll('[class*="bg-red-500"]');
    expect(indicators.length).toBeGreaterThanOrEqual(1);
  });

  it('displays articulation count in button label', () => {
    const onArticulationChange = vi.fn();
    const sampler = createMockSampler({
      loaded: true,
      loadedNotes: [36, 38],
      loadedArticulations: ['sustain', 'staccato'],
      loadedEntries: [
        entry(36, 'sustain', 100, 0),
        entry(38, 'sustain', 100, 0),
        entry(36, 'staccato', 100, 0),
      ],
    });
    render(
      <BassSampleMap
        sampler={sampler as any}
        currentArticulation="sustain"
        onArticulationChange={onArticulationChange}
      />,
    );
    expect(screen.getByText('(2)')).toBeInTheDocument();
  });

  it('hides "Sample Map" when no entries', () => {
    const sampler = createMockSampler({
      loaded: false,
    });
    render(
      <BassSampleMap
        sampler={sampler as any}
        currentArticulation="sustain"
        onArticulationChange={vi.fn()}
      />,
    );
    expect(screen.queryByText(/Sample Map/)).not.toBeInTheDocument();
  });

  it('shows velocity layer title attributes', () => {
    const sampler = createMockSampler({
      loaded: true,
      loadedNotes: [36],
      loadedArticulations: ['sustain'],
      loadedEntries: [entry(36, 'sustain', 100, 0)],
    });
    render(
      <BassSampleMap
        sampler={sampler as any}
        currentArticulation="sustain"
        onArticulationChange={vi.fn()}
      />,
    );
    const cell = document.querySelector('[title*="vel"]');
    expect(cell).toBeInTheDocument();
    expect(cell?.getAttribute('title')).toContain('C2');
  });
});
