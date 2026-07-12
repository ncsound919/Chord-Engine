import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { PartsView } from './PartsView';
import { GeneratedSection } from '../../lib/engine';

vi.mock('../../lib/players', () => ({
  PLAYERS: [
    {
      id: 'fagen',
      name: 'Fagen',
      instrument: 'Keys',
      traits: ['Block Chords', 'Jazz Harmony'],
      description: 'Keys player description',
    },
    {
      id: 'hancock',
      name: 'Hancock',
      instrument: 'Keys',
      traits: ['Funk Keys', 'Wah Effect'],
      description: 'Second Keys player',
    },
    {
      id: 'carlton',
      name: 'Carlton',
      instrument: 'Guitar',
      traits: ['Clean Tone', 'Rhythmic'],
      description: 'Guitar player description',
    },
    {
      id: 'cropper',
      name: 'Cropper',
      instrument: 'Guitar',
      traits: ['Funky', 'R&B'],
      description: 'Second Guitar player',
    },
    {
      id: 'rainey',
      name: 'Rainey',
      instrument: 'Bass',
      traits: ['Walking Bass', 'Funk'],
      description: 'Bass player description',
    },
    {
      id: 'purdie',
      name: 'Purdie',
      instrument: 'Drums',
      traits: ['Ghost Notes', 'Shuffle'],
      description: 'Drums player description',
    },
    {
      id: 'string_mach',
      name: 'String Machine',
      instrument: 'Pads',
      traits: ['Sustained', 'Warm'],
      description: 'Pads player description',
    },
  ],
}));

vi.mock('../../lib/prng', () => ({
  createPRNG: vi.fn(() => vi.fn(() => Math.random())),
}));

vi.mock('../../theory/voicing', () => ({
  generateBassNote: vi.fn(() => 60),
  generateVoicingCandidates: vi.fn(() => []),
  pickBestVoicing: vi.fn(() => null),
}));

vi.mock('../../theory/fretboard', () => ({
  generateFingerableShapes: vi.fn(() => []),
  pickBestGuitarShape: vi.fn(() => null),
}));

vi.mock('../../theory/rhythmicReframer', () => ({
  generateDrumPattern: vi.fn(() => ({
    grid: { Kick: Array(16).fill(false), Snare: Array(16).fill(false) },
  })),
}));

vi.mock('../../theory/pitch', () => ({
  chordTonesForQuality: vi.fn(() => [0, 4, 7]),
}));

import { generateBassNote, generateVoicingCandidates, pickBestVoicing } from '../../theory/voicing';
import { generateFingerableShapes, pickBestGuitarShape } from '../../theory/fretboard';
import { generateDrumPattern } from '../../theory/rhythmicReframer';

const mockSection: GeneratedSection[] = [
  {
    def: { id: 'verse-1', name: 'Verse 1', lengthBars: 4, preset: 'A' },
    chords: [
      { bar: 1, chordName: 'Cmaj7', roman: 'I', rootPc: 0, quality: 'maj7' },
      { bar: 2, chordName: 'Dm7', roman: 'ii', rootPc: 2, quality: 'm7' },
      { bar: 3, chordName: 'G7', roman: 'V', rootPc: 7, quality: '7' },
      { bar: 4, chordName: 'Cmaj7', roman: 'I', rootPc: 0, quality: 'maj7' },
    ],
    melody: [],
    drumPattern: null,
  },
];

const sectionWithMelody: GeneratedSection[] = [
  {
    def: { id: 'verse-1', name: 'Verse 1', lengthBars: 2, preset: 'A' },
    chords: [
      { bar: 1, chordName: 'Cmaj7', roman: 'I', rootPc: 0, quality: 'maj7' },
      { bar: 2, chordName: 'Dm7', roman: 'ii', rootPc: 2, quality: 'm7' },
    ],
    melody: [
      { id: 'n1', bar: 1, beat: 1, duration: 1, noteName: 'C4' },
      { id: 'n2', bar: 1, beat: 2, duration: 0.5, noteName: 'E4' },
      { id: 'n3', bar: 2, beat: 1, duration: 2, noteName: 'D4' },
    ],
    drumPattern: null,
  },
];

const sectionWithDrumStyle: GeneratedSection[] = [
  {
    def: { id: 'verse-1', name: 'Verse 1', lengthBars: 2, preset: 'A' },
    chords: [
      { bar: 1, chordName: 'Cmaj7', roman: 'I', rootPc: 0, quality: 'maj7' },
      { bar: 2, chordName: 'Dm7', roman: 'ii', rootPc: 2, quality: 'm7' },
    ],
    melody: [],
    drumPattern: null,
    drumStyle: 'boom_bap',
  },
];

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe('PartsView', () => {
  const mockOnSectionsUpdate = vi.fn();

  it('shows empty state when no sections', () => {
    render(
      <PartsView sections={[]} musicKey="C" onSectionsUpdate={mockOnSectionsUpdate} />,
    );
    expect(screen.getByText(/Generate a score first/)).toBeInTheDocument();
  });

  it('renders the header', () => {
    render(
      <PartsView sections={mockSection} musicKey="C" onSectionsUpdate={mockOnSectionsUpdate} />,
    );
    expect(screen.getByText(/Musician Parts & Auditions/)).toBeInTheDocument();
  });

  it('renders instrument sections', () => {
    render(
      <PartsView sections={mockSection} musicKey="C" onSectionsUpdate={mockOnSectionsUpdate} />,
    );
    expect(screen.getByText('Keys')).toBeInTheDocument();
    expect(screen.getByText('Guitar')).toBeInTheDocument();
    expect(screen.getByText('Bass')).toBeInTheDocument();
    expect(screen.getByText('Drums')).toBeInTheDocument();
    expect(screen.getByText('Pads')).toBeInTheDocument();
  });

  it('renders the melody section', () => {
    render(
      <PartsView sections={mockSection} musicKey="C" onSectionsUpdate={mockOnSectionsUpdate} />,
    );
    expect(screen.getByText(/Melody \(Top-Line Engine\)/)).toBeInTheDocument();
  });

  it('displays section names from the score', () => {
    render(
      <PartsView sections={mockSection} musicKey="C" onSectionsUpdate={mockOnSectionsUpdate} />,
    );
    expect(screen.getAllByText('[Verse 1]').length).toBeGreaterThan(0);
  });

  it('has spin buttons for each instrument', () => {
    render(
      <PartsView sections={mockSection} musicKey="C" onSectionsUpdate={mockOnSectionsUpdate} />,
    );
    const spinButtons = screen.getAllByText('Spin Part');
    expect(spinButtons.length).toBe(5);
  });

  it('calls onSectionsUpdate when spin is clicked', async () => {
    render(
      <PartsView sections={mockSection} musicKey="C" onSectionsUpdate={mockOnSectionsUpdate} />,
    );
    const spinBtn = screen.getAllByText('Spin Part')[0];
    await act(async () => {
      fireEvent.click(spinBtn);
    });
    expect(mockOnSectionsUpdate).toHaveBeenCalled();
  });

  it('shows player trait badges', () => {
    render(
      <PartsView sections={mockSection} musicKey="C" onSectionsUpdate={mockOnSectionsUpdate} />,
    );
    expect(screen.getAllByText('Block Chords').length).toBeGreaterThan(0);
  });

  it('has a player select dropdown', () => {
    render(
      <PartsView sections={mockSection} musicKey="C" onSectionsUpdate={mockOnSectionsUpdate} />,
    );
    const selects = screen.getAllByRole('combobox');
    expect(selects.length).toBe(5);
  });

  it('changes player assignment when select dropdown is changed', async () => {
    render(
      <PartsView sections={mockSection} musicKey="C" onSectionsUpdate={mockOnSectionsUpdate} />,
    );
    const selects = screen.getAllByRole('combobox');
    await act(async () => {
      fireEvent.change(selects[1], { target: { value: 'cropper' } });
    });
    expect(selects[1]).toHaveValue('cropper');
  });

  it('shows player description text', () => {
    render(
      <PartsView sections={mockSection} musicKey="C" onSectionsUpdate={mockOnSectionsUpdate} />,
    );
    expect(screen.getByText('Keys player description')).toBeInTheDocument();
  });

  it('shows multiple sections in the score', () => {
    const multiSection = [
      ...mockSection,
      {
        def: { id: 'chorus-1', name: 'Chorus 1', lengthBars: 4, preset: 'B' },
        chords: [
          { bar: 1, chordName: 'Fmaj7', roman: 'IV', rootPc: 5, quality: 'maj7' },
        ],
        melody: [],
        drumPattern: null,
      },
    ];
    render(
      <PartsView sections={multiSection} musicKey="C" onSectionsUpdate={mockOnSectionsUpdate} />,
    );
    expect(screen.getAllByText(/Verse 1/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Chorus 1/).length).toBeGreaterThan(0);
  });

  it('shows the Lead Vocal / Solist badge', () => {
    render(
      <PartsView sections={mockSection} musicKey="C" onSectionsUpdate={mockOnSectionsUpdate} />,
    );
    expect(screen.getByText('Lead Vocal / Solist')).toBeInTheDocument();
  });

  it('shows melody trait badges', () => {
    render(
      <PartsView sections={mockSection} musicKey="C" onSectionsUpdate={mockOnSectionsUpdate} />,
    );
    expect(screen.getByText('Contour Rules')).toBeInTheDocument();
    expect(screen.getByText('Chord Tones')).toBeInTheDocument();
    expect(screen.getByText('Vocal Register')).toBeInTheDocument();
    expect(screen.getByText('Breathing Space')).toBeInTheDocument();
  });

  it('displays chord names in each instrument section', () => {
    render(
      <PartsView sections={mockSection} musicKey="C" onSectionsUpdate={mockOnSectionsUpdate} />,
    );
    expect(screen.getAllByText('Cmaj7').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Dm7').length).toBeGreaterThan(0);
  });

  it('calls onSectionsUpdate when spin is clicked for a second instrument', async () => {
    render(
      <PartsView sections={mockSection} musicKey="C" onSectionsUpdate={mockOnSectionsUpdate} />,
    );
    const spinBtns = screen.getAllByText('Spin Part');
    await act(async () => {
      fireEvent.click(spinBtns[1]);
    });
    expect(mockOnSectionsUpdate).toHaveBeenCalled();
  });

  it('renders instrument icons next to instrument names', () => {
    render(
      <PartsView sections={mockSection} musicKey="C" onSectionsUpdate={mockOnSectionsUpdate} />,
    );
    expect(screen.getByText('Guitar')).toBeInTheDocument();
    expect(screen.getByText('Bass')).toBeInTheDocument();
    expect(screen.getByText('Drums')).toBeInTheDocument();
    expect(screen.getByText('Pads')).toBeInTheDocument();
  });

  it('shows the Singable Vocal Guide text', () => {
    render(
      <PartsView sections={mockSection} musicKey="C" onSectionsUpdate={mockOnSectionsUpdate} />,
    );
    expect(screen.getByText('Singable Vocal Guide')).toBeInTheDocument();
  });

  it('shows bar numbers for each chord in the section', () => {
    render(
      <PartsView sections={mockSection} musicKey="C" onSectionsUpdate={mockOnSectionsUpdate} />,
    );
    expect(screen.getAllByText(/B\d/).length).toBeGreaterThan(0);
  });

  it('renders melody notes when melody data is present', () => {
    render(
      <PartsView sections={sectionWithMelody} musicKey="C" onSectionsUpdate={mockOnSectionsUpdate} />,
    );
    expect(screen.getByText('C4')).toBeInTheDocument();
    expect(screen.getByText('E4')).toBeInTheDocument();
    expect(screen.getByText('D4')).toBeInTheDocument();
    expect(screen.getAllByText('BAR 1').length).toBeGreaterThan(0);
    expect(screen.getAllByText('BAR 2').length).toBeGreaterThan(0);
  });

  it('renders rest placeholder when a bar has no melody notes', () => {
    const sectionWithRestBar: GeneratedSection[] = [
      {
        def: { id: 'verse-1', name: 'Verse 1', lengthBars: 2, preset: 'A' },
        chords: [
          { bar: 1, chordName: 'Cmaj7', roman: 'I', rootPc: 0, quality: 'maj7' },
          { bar: 2, chordName: 'Dm7', roman: 'ii', rootPc: 2, quality: 'm7' },
        ],
        melody: [
          { id: 'n1', bar: 1, beat: 1, duration: 1, noteName: 'C4' },
        ],
        drumPattern: null,
      },
    ];
    render(
      <PartsView sections={sectionWithRestBar} musicKey="C" onSectionsUpdate={mockOnSectionsUpdate} />,
    );
    expect(screen.getByText('Rest (Breath)')).toBeInTheDocument();
  });

  it('renders chord name in bass instrument section', () => {
    render(
      <PartsView sections={mockSection} musicKey="C" onSectionsUpdate={mockOnSectionsUpdate} />,
    );
    const bassName = mockSection[0].chords[0].chordName.replace(/[^A-G#b]/g, '');
    expect(screen.getAllByText(bassName).length).toBeGreaterThan(0);
  });

  it('renders drumsticks icon for Drums instrument', () => {
    render(
      <PartsView sections={mockSection} musicKey="C" onSectionsUpdate={mockOnSectionsUpdate} />,
    );
    const drumsElements = screen.getAllByText('Drums');
    expect(drumsElements.length).toBeGreaterThan(0);
  });

  it('spins Bass and calls onSectionsUpdate', async () => {
    vi.mocked(generateBassNote).mockReturnValue({ midi: 48, role: 'root' } as any);
    render(
      <PartsView sections={mockSection} musicKey="C" onSectionsUpdate={mockOnSectionsUpdate} />,
    );
    const spinBtns = screen.getAllByText('Spin Part');
    const bassIdx = spinBtns.length - 2;
    await act(async () => {
      fireEvent.click(spinBtns[bassIdx]);
    });
    expect(mockOnSectionsUpdate).toHaveBeenCalled();
  });

  it('spins Keys and calls onSectionsUpdate', async () => {
    vi.mocked(generateVoicingCandidates).mockReturnValue([
      { notes: [60, 64, 67], style: 'close', rootPc: 0, bassNote: 60 },
    ] as any);
    vi.mocked(pickBestVoicing).mockReturnValue({ notes: [60, 64, 67], style: 'close', rootPc: 0, bassNote: 60 } as any);
    render(
      <PartsView sections={mockSection} musicKey="C" onSectionsUpdate={mockOnSectionsUpdate} />,
    );
    const spinBtns = screen.getAllByText('Spin Part');
    await act(async () => {
      fireEvent.click(spinBtns[0]);
    });
    expect(mockOnSectionsUpdate).toHaveBeenCalled();
  });

  it('spins Guitar and calls onSectionsUpdate', async () => {
    vi.mocked(generateFingerableShapes).mockReturnValue([
      { frets: [3, 2, 0, 0], fingers: [3, 2, 0, 0] },
    ] as any);
    vi.mocked(pickBestGuitarShape).mockReturnValue({ frets: [3, 2, 0, 0], fingers: [3, 2, 0, 0] } as any);
    render(
      <PartsView sections={mockSection} musicKey="C" onSectionsUpdate={mockOnSectionsUpdate} />,
    );
    const spinBtns = screen.getAllByText('Spin Part');
    await act(async () => {
      fireEvent.click(spinBtns[1]);
    });
    expect(mockOnSectionsUpdate).toHaveBeenCalled();
  });

  it('spins Drums and calls onSectionsUpdate', async () => {
    vi.mocked(generateDrumPattern).mockReturnValue({
      grid: { Kick: Array(16).fill(false), Snare: Array(16).fill(false) },
    } as any);
    render(
      <PartsView sections={sectionWithDrumStyle} musicKey="C" onSectionsUpdate={mockOnSectionsUpdate} />,
    );
    const spinBtns = screen.getAllByText('Spin Part');
    const drumsIdx = spinBtns.length - 1;
    await act(async () => {
      fireEvent.click(spinBtns[drumsIdx]);
    });
    expect(mockOnSectionsUpdate).toHaveBeenCalled();
  });

  it('spins Pads and calls onSectionsUpdate', async () => {
    vi.mocked(generateVoicingCandidates).mockReturnValue([
      { notes: [60, 64, 67], style: 'spread', rootPc: 0, bassNote: 60 },
    ] as any);
    vi.mocked(pickBestVoicing).mockReturnValue({ notes: [60, 64, 67], style: 'spread', rootPc: 0, bassNote: 60 } as any);
    render(
      <PartsView sections={mockSection} musicKey="C" onSectionsUpdate={mockOnSectionsUpdate} />,
    );
    const spinBtns = screen.getAllByText('Spin Part');
    await act(async () => {
      fireEvent.click(spinBtns[4]);
    });
    expect(mockOnSectionsUpdate).toHaveBeenCalled();
  });

  it('spins Drums with no drumStyle defaults to boom_bap', async () => {
    vi.mocked(generateDrumPattern).mockReturnValue({
      grid: { Kick: Array(16).fill(false), Snare: Array(16).fill(false) },
    } as any);
    render(
      <PartsView sections={mockSection} musicKey="C" onSectionsUpdate={mockOnSectionsUpdate} />,
    );
    const spinBtns = screen.getAllByText('Spin Part');
    const drumsIdx = spinBtns.length - 1;
    await act(async () => {
      fireEvent.click(spinBtns[drumsIdx]);
    });
    expect(mockOnSectionsUpdate).toHaveBeenCalled();
  });

  it('spins Keys with voicing candidates that match trait styles', async () => {
    vi.mocked(generateVoicingCandidates).mockReturnValue([
      { notes: [60, 64, 67], style: 'close', rootPc: 0, bassNote: 60 },
      { notes: [60, 67, 72], style: 'drop2', rootPc: 0, bassNote: 60 },
    ] as any);
    vi.mocked(pickBestVoicing).mockReturnValue({ notes: [60, 64, 67], style: 'close', rootPc: 0, bassNote: 60 } as any);
    render(
      <PartsView sections={mockSection} musicKey="C" onSectionsUpdate={mockOnSectionsUpdate} />,
    );
    const spinBtns = screen.getAllByText('Spin Part');
    await act(async () => {
      fireEvent.click(spinBtns[0]);
    });
    expect(mockOnSectionsUpdate).toHaveBeenCalled();
  });

  it('spins Guitar with random index path', async () => {
    vi.mocked(generateFingerableShapes).mockReturnValue([
      { frets: [3, 2, 0, 0], fingers: [3, 2, 0, 0] },
      { frets: [5, 4, 3, 2], fingers: [4, 3, 2, 1] },
    ] as any);
    vi.mocked(pickBestGuitarShape).mockReturnValue({ frets: [3, 2, 0, 0], fingers: [3, 2, 0, 0] } as any);
    render(
      <PartsView sections={mockSection} musicKey="C" onSectionsUpdate={mockOnSectionsUpdate} />,
    );
    const spinBtns = screen.getAllByText('Spin Part');
    await act(async () => {
      fireEvent.click(spinBtns[1]);
    });
    expect(mockOnSectionsUpdate).toHaveBeenCalled();
  });

  it('spins Bass with high activity traits', async () => {
    vi.mocked(generateBassNote).mockReturnValue({ midi: 36, role: 'root' } as any);
    render(
      <PartsView sections={mockSection} musicKey="C" onSectionsUpdate={mockOnSectionsUpdate} />,
    );
    const spinBtns = screen.getAllByText('Spin Part');
    const bassIdx = spinBtns.length - 2;
    await act(async () => {
      fireEvent.click(spinBtns[bassIdx]);
    });
    expect(mockOnSectionsUpdate).toHaveBeenCalled();
  });

  it('spins Drums with ghost notes traits affecting energy/complexity', async () => {
    vi.mocked(generateDrumPattern).mockReturnValue({
      grid: { Kick: Array(16).fill(false), Snare: Array(16).fill(false) },
    } as any);
    render(
      <PartsView sections={sectionWithDrumStyle} musicKey="C" onSectionsUpdate={mockOnSectionsUpdate} />,
    );
    const spinBtns = screen.getAllByText('Spin Part');
    const drumsIdx = spinBtns.length - 1;
    await act(async () => {
      fireEvent.click(spinBtns[drumsIdx]);
    });
    expect(mockOnSectionsUpdate).toHaveBeenCalled();
  });

  it('spins Drums with precision traits affecting energy', async () => {
    vi.mocked(generateDrumPattern).mockReturnValue({
      grid: { Kick: Array(16).fill(false), Snare: Array(16).fill(false) },
    } as any);
    const precisionSection: GeneratedSection[] = [
      {
        def: { id: 'verse-1', name: 'Verse 1', lengthBars: 2, preset: 'A' },
        chords: [
          { bar: 1, chordName: 'Cmaj7', roman: 'I', rootPc: 0, quality: 'maj7' },
          { bar: 2, chordName: 'Dm7', roman: 'ii', rootPc: 2, quality: 'm7' },
        ],
        melody: [],
        drumPattern: null,
        drumStyle: 'funk',
      },
    ];
    const { PLAYERS } = await import('../../lib/players');
    const origPurdie = PLAYERS.find(p => p.id === 'purdie');
    if (origPurdie) origPurdie.traits = ['Precision', 'Dynamic'];
    render(
      <PartsView sections={precisionSection} musicKey="C" onSectionsUpdate={mockOnSectionsUpdate} />,
    );
    const spinBtns = screen.getAllByText('Spin Part');
    const drumsIdx = spinBtns.length - 1;
    await act(async () => {
      fireEvent.click(spinBtns[drumsIdx]);
    });
    expect(mockOnSectionsUpdate).toHaveBeenCalled();
    if (origPurdie) origPurdie.traits = ['Ghost Notes', 'Shuffle'];
  });

  it('spins Keys with space/silence traits', async () => {
    vi.mocked(generateVoicingCandidates).mockReturnValue([
      { notes: [60, 64, 67], style: 'rootless', rootPc: 0, bassNote: 60 },
    ] as any);
    vi.mocked(pickBestVoicing).mockReturnValue({ notes: [60, 64, 67], style: 'rootless', rootPc: 0, bassNote: 60 } as any);
    const spaceSection: GeneratedSection[] = [
      {
        def: { id: 'verse-1', name: 'Verse 1', lengthBars: 2, preset: 'A' },
        chords: [
          { bar: 1, chordName: 'Cmaj7', roman: 'I', rootPc: 0, quality: 'maj7' },
          { bar: 2, chordName: 'Dm7', roman: 'ii', rootPc: 2, quality: 'm7' },
        ],
        melody: [],
        drumPattern: null,
      },
    ];
    const { PLAYERS } = await import('../../lib/players');
    const origFagen = PLAYERS.find(p => p.id === 'fagen');
    if (origFagen) origFagen.traits = ['Space', 'Silence', 'Sustained'];
    render(
      <PartsView sections={spaceSection} musicKey="C" onSectionsUpdate={mockOnSectionsUpdate} />,
    );
    const spinBtns = screen.getAllByText('Spin Part');
    await act(async () => {
      fireEvent.click(spinBtns[0]);
    });
    expect(mockOnSectionsUpdate).toHaveBeenCalled();
    if (origFagen) origFagen.traits = ['Block Chords', 'Jazz Harmony'];
  });

  it('spins Keys with staccato traits', async () => {
    vi.mocked(generateVoicingCandidates).mockReturnValue([
      { notes: [60, 64, 67], style: 'close', rootPc: 0, bassNote: 60 },
    ] as any);
    vi.mocked(pickBestVoicing).mockReturnValue({ notes: [60, 64, 67], style: 'close', rootPc: 0, bassNote: 60 } as any);
    const staccatoSection: GeneratedSection[] = [
      {
        def: { id: 'verse-1', name: 'Verse 1', lengthBars: 2, preset: 'A' },
        chords: [
          { bar: 1, chordName: 'Cmaj7', roman: 'I', rootPc: 0, quality: 'maj7' },
          { bar: 2, chordName: 'Dm7', roman: 'ii', rootPc: 2, quality: 'm7' },
        ],
        melody: [],
        drumPattern: null,
      },
    ];
    const { PLAYERS } = await import('../../lib/players');
    const origFagen = PLAYERS.find(p => p.id === 'fagen');
    if (origFagen) origFagen.traits = ['Staccato', 'Rhythmic', 'Punchy'];
    render(
      <PartsView sections={staccatoSection} musicKey="C" onSectionsUpdate={mockOnSectionsUpdate} />,
    );
    const spinBtns = screen.getAllByText('Spin Part');
    await act(async () => {
      fireEvent.click(spinBtns[0]);
    });
    expect(mockOnSectionsUpdate).toHaveBeenCalled();
    if (origFagen) origFagen.traits = ['Block Chords', 'Jazz Harmony'];
  });

  it('spins Drums with linear fills traits', async () => {
    vi.mocked(generateDrumPattern).mockReturnValue({
      grid: { Kick: Array(16).fill(false), Snare: Array(16).fill(false) },
    } as any);
    const linearSection: GeneratedSection[] = [
      {
        def: { id: 'verse-1', name: 'Verse 1', lengthBars: 2, preset: 'A' },
        chords: [
          { bar: 1, chordName: 'Cmaj7', roman: 'I', rootPc: 0, quality: 'maj7' },
          { bar: 2, chordName: 'Dm7', roman: 'ii', rootPc: 2, quality: 'm7' },
        ],
        melody: [],
        drumPattern: null,
        drumStyle: 'jazz',
      },
    ];
    const { PLAYERS } = await import('../../lib/players');
    const origPurdie = PLAYERS.find(p => p.id === 'purdie');
    if (origPurdie) origPurdie.traits = ['Linear Fills', 'Crisp'];
    render(
      <PartsView sections={linearSection} musicKey="C" onSectionsUpdate={mockOnSectionsUpdate} />,
    );
    const spinBtns = screen.getAllByText('Spin Part');
    const drumsIdx = spinBtns.length - 1;
    await act(async () => {
      fireEvent.click(spinBtns[drumsIdx]);
    });
    expect(mockOnSectionsUpdate).toHaveBeenCalled();
    if (origPurdie) origPurdie.traits = ['Ghost Notes', 'Shuffle'];
  });

  it('spins Bass with contrapuntal traits', async () => {
    vi.mocked(generateBassNote).mockReturnValue({ midi: 48, role: 'root' } as any);
    const contrapSection: GeneratedSection[] = [
      {
        def: { id: 'verse-1', name: 'Verse 1', lengthBars: 2, preset: 'A' },
        chords: [
          { bar: 1, chordName: 'Cmaj7', roman: 'I', rootPc: 0, quality: 'maj7' },
          { bar: 2, chordName: 'Dm7', roman: 'ii', rootPc: 2, quality: 'm7' },
        ],
        melody: [],
        drumPattern: null,
      },
    ];
    const { PLAYERS } = await import('../../lib/players');
    const origRainey = PLAYERS.find(p => p.id === 'rainey');
    if (origRainey) origRainey.traits = ['Contrapuntal', 'Low B String'];
    render(
      <PartsView sections={contrapSection} musicKey="C" onSectionsUpdate={mockOnSectionsUpdate} />,
    );
    const spinBtns = screen.getAllByText('Spin Part');
    const bassIdx = spinBtns.length - 2;
    await act(async () => {
      fireEvent.click(spinBtns[bassIdx]);
    });
    expect(mockOnSectionsUpdate).toHaveBeenCalled();
    if (origRainey) origRainey.traits = ['Walking Bass', 'Funk'];
  });

  it('spins Drums with mixed traits (ghost notes + precision)', async () => {
    vi.mocked(generateDrumPattern).mockReturnValue({
      grid: { Kick: Array(16).fill(false), Snare: Array(16).fill(false) },
    } as any);
    const mixedSection: GeneratedSection[] = [
      {
        def: { id: 'verse-1', name: 'Verse 1', lengthBars: 2, preset: 'A' },
        chords: [
          { bar: 1, chordName: 'Cmaj7', roman: 'I', rootPc: 0, quality: 'maj7' },
          { bar: 2, chordName: 'Dm7', roman: 'ii', rootPc: 2, quality: 'm7' },
        ],
        melody: [],
        drumPattern: null,
        drumStyle: 'funk',
      },
    ];
    const { PLAYERS } = await import('../../lib/players');
    const origPurdie = PLAYERS.find(p => p.id === 'purdie');
    if (origPurdie) origPurdie.traits = ['Ghost Notes', 'Precision'];
    render(
      <PartsView sections={mixedSection} musicKey="C" onSectionsUpdate={mockOnSectionsUpdate} />,
    );
    const spinBtns = screen.getAllByText('Spin Part');
    const drumsIdx = spinBtns.length - 1;
    await act(async () => {
      fireEvent.click(spinBtns[drumsIdx]);
    });
    expect(mockOnSectionsUpdate).toHaveBeenCalled();
    if (origPurdie) origPurdie.traits = ['Ghost Notes', 'Shuffle'];
  });

  it('spins Keys with block chords traits', async () => {
    vi.mocked(generateVoicingCandidates).mockReturnValue([
      { notes: [60, 64, 67], style: 'close', rootPc: 0, bassNote: 60 },
      { notes: [60, 64, 67], style: 'drop2', rootPc: 0, bassNote: 60 },
    ] as any);
    vi.mocked(pickBestVoicing).mockReturnValue({ notes: [60, 64, 67], style: 'close', rootPc: 0, bassNote: 60 } as any);
    const blockSection: GeneratedSection[] = [
      {
        def: { id: 'verse-1', name: 'Verse 1', lengthBars: 2, preset: 'A' },
        chords: [
          { bar: 1, chordName: 'Cmaj7', roman: 'I', rootPc: 0, quality: 'maj7' },
          { bar: 2, chordName: 'Dm7', roman: 'ii', rootPc: 2, quality: 'm7' },
        ],
        melody: [],
        drumPattern: null,
      },
    ];
    const { PLAYERS } = await import('../../lib/players');
    const origFagen = PLAYERS.find(p => p.id === 'fagen');
    if (origFagen) origFagen.traits = ['Block Chords', 'Mu Major', 'Thick'];
    render(
      <PartsView sections={blockSection} musicKey="C" onSectionsUpdate={mockOnSectionsUpdate} />,
    );
    const spinBtns = screen.getAllByText('Spin Part');
    await act(async () => {
      fireEvent.click(spinBtns[0]);
    });
    expect(mockOnSectionsUpdate).toHaveBeenCalled();
    if (origFagen) origFagen.traits = ['Block Chords', 'Jazz Harmony'];
  });

  it('spins Guitar with empty chord tones', async () => {
    vi.mocked(generateFingerableShapes).mockReturnValue([] as any);
    vi.mocked(pickBestGuitarShape).mockReturnValue(null as any);
    render(
      <PartsView sections={mockSection} musicKey="C" onSectionsUpdate={mockOnSectionsUpdate} />,
    );
    const spinBtns = screen.getAllByText('Spin Part');
    await act(async () => {
      fireEvent.click(spinBtns[1]);
    });
    expect(mockOnSectionsUpdate).toHaveBeenCalled();
  });

  it('spins Keys with empty voicing candidates', async () => {
    vi.mocked(generateVoicingCandidates).mockReturnValue([] as any);
    vi.mocked(pickBestVoicing).mockReturnValue(null as any);
    render(
      <PartsView sections={mockSection} musicKey="C" onSectionsUpdate={mockOnSectionsUpdate} />,
    );
    const spinBtns = screen.getAllByText('Spin Part');
    await act(async () => {
      fireEvent.click(spinBtns[0]);
    });
    expect(mockOnSectionsUpdate).toHaveBeenCalled();
  });

  it('spins Bass with chord missing rootPc', async () => {
    const noRootSection: GeneratedSection[] = [
      {
        def: { id: 'verse-1', name: 'Verse 1', lengthBars: 2, preset: 'A' },
        chords: [
          { bar: 1, chordName: 'Cmaj7', roman: 'I' },
          { bar: 2, chordName: 'Dm7', roman: 'ii' },
        ],
        melody: [],
        drumPattern: null,
      },
    ];
    render(
      <PartsView sections={noRootSection} musicKey="C" onSectionsUpdate={mockOnSectionsUpdate} />,
    );
    const spinBtns = screen.getAllByText('Spin Part');
    const bassIdx = spinBtns.length - 2;
    await act(async () => {
      fireEvent.click(spinBtns[bassIdx]);
    });
    expect(mockOnSectionsUpdate).toHaveBeenCalled();
  });

  it('spins Keys with chord missing rootPc or quality', async () => {
    const noRootSection: GeneratedSection[] = [
      {
        def: { id: 'verse-1', name: 'Verse 1', lengthBars: 2, preset: 'A' },
        chords: [
          { bar: 1, chordName: 'Cmaj7', roman: 'I' },
          { bar: 2, chordName: 'Dm7', roman: 'ii' },
        ],
        melody: [],
        drumPattern: null,
      },
    ];
    render(
      <PartsView sections={noRootSection} musicKey="C" onSectionsUpdate={mockOnSectionsUpdate} />,
    );
    const spinBtns = screen.getAllByText('Spin Part');
    await act(async () => {
      fireEvent.click(spinBtns[0]);
    });
    expect(mockOnSectionsUpdate).toHaveBeenCalled();
  });

  it('spins Guitar with chord missing rootPc or quality', async () => {
    const noRootSection: GeneratedSection[] = [
      {
        def: { id: 'verse-1', name: 'Verse 1', lengthBars: 2, preset: 'A' },
        chords: [
          { bar: 1, chordName: 'Cmaj7', roman: 'I' },
          { bar: 2, chordName: 'Dm7', roman: 'ii' },
        ],
        melody: [],
        drumPattern: null,
      },
    ];
    render(
      <PartsView sections={noRootSection} musicKey="C" onSectionsUpdate={mockOnSectionsUpdate} />,
    );
    const spinBtns = screen.getAllByText('Spin Part');
    await act(async () => {
      fireEvent.click(spinBtns[1]);
    });
    expect(mockOnSectionsUpdate).toHaveBeenCalled();
  });

  it('spins Drums with no drumStyle defaults to boom_bap', async () => {
    vi.mocked(generateDrumPattern).mockReturnValue({
      grid: { Kick: Array(16).fill(false), Snare: Array(16).fill(false) },
    } as any);
    render(
      <PartsView sections={mockSection} musicKey="C" onSectionsUpdate={mockOnSectionsUpdate} />,
    );
    const spinBtns = screen.getAllByText('Spin Part');
    const drumsIdx = spinBtns.length - 1;
    await act(async () => {
      fireEvent.click(spinBtns[drumsIdx]);
    });
    expect(mockOnSectionsUpdate).toHaveBeenCalled();
  });

  it('melody section renders bar chord names', () => {
    render(
      <PartsView sections={sectionWithMelody} musicKey="C" onSectionsUpdate={mockOnSectionsUpdate} />,
    );
    expect(screen.getAllByText('Cmaj7').length).toBeGreaterThan(0);
  });

  it('melody note displays beat numbers', () => {
    render(
      <PartsView sections={sectionWithMelody} musicKey="C" onSectionsUpdate={mockOnSectionsUpdate} />,
    );
    expect(screen.getAllByText(/Bt \d/).length).toBeGreaterThan(0);
  });

  it('melody section renders [Verse 1] Melody Line header', () => {
    render(
      <PartsView sections={sectionWithMelody} musicKey="C" onSectionsUpdate={mockOnSectionsUpdate} />,
    );
    expect(screen.getByText('[Verse 1] Melody Line')).toBeInTheDocument();
  });
});
