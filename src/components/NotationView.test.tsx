import React from 'react';
import { describe, expect, it, vi, afterEach, beforeEach } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { NotationView } from './NotationView';
import type { GeneratedSection } from '../lib/engine';

const mockAddStave = vi.fn(() => ({
  setText: vi.fn(),
}));

const mockEasyScore = vi.fn(() => ({
  voice: vi.fn(() => ({})),
  note: vi.fn(() => ({})),
}));

const mockSystem = vi.fn(() => ({
  addStave: mockAddStave,
  addConnector: vi.fn(),
}));

vi.mock('vexflow', () => ({
  Factory: vi.fn(() => ({
    EasyScore: mockEasyScore,
    System: mockSystem,
    draw: vi.fn(),
  })),
}));

const singleSection: GeneratedSection[] = [
  {
    def: { id: 'v1', name: 'Verse', preset: 'steely' as any, lengthBars: 4 },
    chords: [
      { bar: 1, beat: 1, roman: 'Imaj7', chordName: 'Fmaj7' },
      { bar: 2, beat: 1, roman: 'ii7', chordName: 'Gm7' },
      { bar: 3, beat: 1, roman: 'V7', chordName: 'C7' },
      { bar: 4, beat: 1, roman: 'Imaj7', chordName: 'Fmaj7' },
    ],
  },
];

const manySections: GeneratedSection[] = Array.from({ length: 5 }, (_, i) => ({
  def: { id: `s${i}`, name: `Section ${i}`, preset: 'steely' as any, lengthBars: 4 },
  chords: [
    { bar: 1, beat: 1, roman: 'Imaj7', chordName: 'Fmaj7' },
    { bar: 2, beat: 1, roman: 'ii7', chordName: 'Gm7' },
  ],
}));

const sectionsWithLongChordNames: GeneratedSection[] = [
  {
    def: { id: 'c1', name: 'Complex', preset: 'steely' as any, lengthBars: 4 },
    chords: Array.from({ length: 12 }, (_, i) => ({
      bar: Math.floor(i / 4) + 1,
      beat: (i % 4) + 1,
      roman: 'Imaj7',
      chordName: `Cmaj7#11b9sus4alt${i}`,
    })),
  },
];

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

beforeEach(() => {
  mockSystem.mockImplementation(() => ({
    addStave: mockAddStave,
    addConnector: vi.fn(),
  }));
  mockAddStave.mockReturnValue({
    setText: vi.fn(),
  });
});

describe('NotationView', () => {
  it('shows "No notation to render" when sections empty', () => {
    render(<NotationView sections={[]} musicKey="C" />);
    expect(screen.getByText('No notation to render')).toBeInTheDocument();
  });

  it('renders canvas when sections exist', () => {
    const { container } = render(<NotationView sections={singleSection} musicKey="F" />);
    const canvas = container.querySelector('canvas');
    expect(canvas).toBeInTheDocument();
  });

  it('shows key display in header', () => {
    render(<NotationView sections={singleSection} musicKey="F" />);
    expect(screen.getByText(/Key: F/)).toBeInTheDocument();
  });

  it('shows section count in header', () => {
    render(<NotationView sections={singleSection} musicKey="F" />);
    expect(screen.getByText(/1 section/)).toBeInTheDocument();
  });

  it('shows plural sections count for multiple sections', () => {
    render(<NotationView sections={manySections} musicKey="C" />);
    expect(screen.getByText(/5 sections/)).toBeInTheDocument();
  });

  it('handles single section correctly', () => {
    const { container } = render(<NotationView sections={singleSection} musicKey="F" />);
    expect(container.querySelector('canvas')).toBeInTheDocument();
  });

  it('handles many sections and renders canvas with correct height', () => {
    const { container } = render(<NotationView sections={manySections} musicKey="C" />);
    const canvas = container.querySelector('canvas')!;
    expect(canvas).toBeInTheDocument();
    expect(canvas.height).toBe(5 * 160 + 40);
  });

  it('handles VexFlow render errors gracefully', () => {
    mockSystem.mockImplementationOnce(() => {
      throw new Error('VexFlow render failure');
    });
    const { container } = render(<NotationView sections={singleSection} musicKey="F" />);
    const canvas = container.querySelector('canvas')!;
    expect(canvas).toBeInTheDocument();
  });

  it('handles long chord names without crashing', () => {
    const { container } = render(
      <NotationView sections={sectionsWithLongChordNames} musicKey="C" />,
    );
    expect(container.querySelector('canvas')).toBeInTheDocument();
  });

  it('renders container with min height when sections exist', () => {
    const { container } = render(<NotationView sections={singleSection} musicKey="F" />);
    const innerDiv = container.querySelector('[class*="min-h"]');
    expect(innerDiv).toBeInTheDocument();
  });

  it('canvas uses container width for minimum', () => {
    const { container } = render(<NotationView sections={singleSection} musicKey="F" />);
    const canvas = container.querySelector('canvas')!;
    expect(canvas.width).toBeGreaterThanOrEqual(800);
  });

  it('has the correct header element for many sections', () => {
    render(<NotationView sections={manySections} musicKey="C" />);
    expect(screen.getByText(/Key: C/)).toBeInTheDocument();
    expect(screen.getByText(/5 sections/)).toBeInTheDocument();
  });

  it('has the correct header element for single section', () => {
    render(<NotationView sections={singleSection} musicKey="F" />);
    expect(screen.getByText(/1 section/)).toBeInTheDocument();
  });

  it('renders a canvas element inside the container when sections exist', () => {
    const { container } = render(<NotationView sections={singleSection} musicKey="F" />);
    const canvas = container.querySelector('canvas');
    expect(canvas).toBeInTheDocument();
    expect(canvas!.width).toBeGreaterThanOrEqual(800);
  });

  it('rounds out-of-range chord names', () => {
    const edgeSection: GeneratedSection[] = [
      {
        def: { id: 'e1', name: 'Edge', preset: 'steely' as any, lengthBars: 4 },
        chords: [
          { bar: 1, beat: 1, roman: 'I', chordName: 'C##' },
          { bar: 2, beat: 1, roman: 'I', chordName: 'Fbb' },
        ],
      },
    ];
    const { container } = render(<NotationView sections={edgeSection} musicKey="C" />);
    expect(container.querySelector('canvas')).toBeInTheDocument();
  });
});
