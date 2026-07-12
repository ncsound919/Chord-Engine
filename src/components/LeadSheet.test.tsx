import React from 'react';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { vi, describe, it, expect, afterEach } from 'vitest';
import { LeadSheet } from './LeadSheet';
import type { GeneratedSection } from '../lib/engine';

// ─── Fixtures ───────────────────────────────────────────────

const mockSections: GeneratedSection[] = [
  {
    def: { id: '1', name: 'Verse 1', preset: 'steely', lengthBars: 4 },
    chords: [
      { bar: 1, beat: 1, roman: 'Imaj7', chordName: 'Fmaj7' },
      { bar: 2, beat: 1, roman: 'vi7', chordName: 'Dm7' },
      { bar: 3, beat: 1, roman: 'ii7', chordName: 'Gm7' },
      { bar: 4, beat: 1, roman: 'V7', chordName: 'C7' },
    ],
  },
  {
    def: { id: '2', name: 'Chorus', preset: 'isley', lengthBars: 4 },
    chords: [
      { bar: 1, beat: 1, roman: 'IVmaj7', chordName: 'Bbmaj7' },
      { bar: 2, beat: 1, roman: 'V7', chordName: 'C7' },
      { bar: 3, beat: 1, roman: 'Imaj7', chordName: 'Fmaj7' },
    ],
  },
];

// ─── Tests ──────────────────────────────────────────────────

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('LeadSheet', () => {
  it('renders empty state when sections array is empty', () => {
    render(<LeadSheet sections={[]} musicKey="F" />);
    expect(screen.getByText(/No progression generated yet/)).toBeInTheDocument();
  });

  it('renders the "+ Blank Section" button in empty state', () => {
    const onSubstitute = vi.fn();
    render(<LeadSheet sections={[]} musicKey="F" onSubstitute={onSubstitute} />);
    const blankBtn = screen.getByText(/Blank Section/);
    fireEvent.click(blankBtn);
    expect(onSubstitute).toHaveBeenCalledWith(-1, -1, 'add_blank_section');
  });

  it('renders the header with key display', () => {
    render(<LeadSheet sections={mockSections} musicKey="F" />);
    expect(screen.getByText(/MIDI Arranger/)).toBeInTheDocument();
    expect(screen.getByText('F')).toBeInTheDocument();
  });

  it('renders all section names', () => {
    render(<LeadSheet sections={mockSections} musicKey="F" />);
    expect(screen.getByText('Verse 1')).toBeInTheDocument();
    expect(screen.getByText('Chorus')).toBeInTheDocument();
  });

  it('renders preset labels for each section', () => {
    render(<LeadSheet sections={mockSections} musicKey="F" />);
    expect(screen.getByText(/Preset: steely/)).toBeInTheDocument();
    expect(screen.getByText(/Preset: isley/)).toBeInTheDocument();
  });

  it('renders chord names (Fmaj7 appears in two sections)', () => {
    render(<LeadSheet sections={mockSections} musicKey="F" />);
    expect(screen.getAllByText('Fmaj7').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('Dm7')).toBeInTheDocument();
    expect(screen.getByText('Gm7')).toBeInTheDocument();
    expect(screen.getAllByText('C7').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('Bbmaj7')).toBeInTheDocument();
  });

  it('renders roman numeral labels (Imaj7 appears in two sections)', () => {
    render(<LeadSheet sections={mockSections} musicKey="F" />);
    expect(screen.getAllByText('Imaj7').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('vi7')).toBeInTheDocument();
    expect(screen.getByText('ii7')).toBeInTheDocument();
    expect(screen.getAllByText('V7').length).toBeGreaterThanOrEqual(1);
  });

  it('opens the substitution popover when a chord button is clicked', () => {
    render(<LeadSheet sections={mockSections} musicKey="F" />);
    const chordButtons = screen.getAllByRole('button', { name: /Edit bar/ });
    fireEvent.click(chordButtons[0]);
    expect(screen.getByRole('menu')).toBeInTheDocument();
    expect(screen.getByText(/Parallel/)).toBeInTheDocument();
    expect(screen.getByText(/Extend/)).toBeInTheDocument();
    expect(screen.getByText(/Tritone/)).toBeInTheDocument();
  });

  it('calls onSubstitute when a substitution action is clicked', () => {
    const onSubstitute = vi.fn();
    render(
      <LeadSheet sections={mockSections} musicKey="F" onSubstitute={onSubstitute} />
    );
    const chordButtons = screen.getAllByRole('button', { name: /Edit bar/ });
    fireEvent.click(chordButtons[0]);

    const parallelBtn = screen.getByRole('menuitem', { name: /Parallel/ });
    fireEvent.click(parallelBtn);

    expect(onSubstitute).toHaveBeenCalledWith(0, 0, 'parallel');
  });

  it('renders an "Add chord" plus button for each section', () => {
    render(<LeadSheet sections={mockSections} musicKey="F" />);
    const addButtons = screen.getAllByRole('button', { name: /Add chord to/ });
    expect(addButtons.length).toBe(2);
  });

  it('displays the global key badge prominently', () => {
    render(<LeadSheet sections={mockSections} musicKey="F" />);
    expect(screen.getAllByText(/Global Key/).length).toBeGreaterThanOrEqual(1);
  });

  it('closes the popover when Escape is pressed', () => {
    render(<LeadSheet sections={mockSections} musicKey="F" />);
    const chordButtons = screen.getAllByRole('button', { name: /Edit bar/ });
    fireEvent.click(chordButtons[0]);
    expect(screen.getByRole('menu')).toBeInTheDocument();
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
  });

  it('calls onSubstitute with extend when Extend button is clicked', () => {
    const onSubstitute = vi.fn();
    render(
      <LeadSheet sections={mockSections} musicKey="F" onSubstitute={onSubstitute} />
    );
    const chordButtons = screen.getAllByRole('button', { name: /Edit bar/ });
    fireEvent.click(chordButtons[0]);
    fireEvent.click(screen.getByRole('menuitem', { name: /Extend/ }));
    expect(onSubstitute).toHaveBeenCalledWith(0, 0, 'extend');
  });

  it('calls onSubstitute with tritone when Tritone button is clicked', () => {
    const onSubstitute = vi.fn();
    render(
      <LeadSheet sections={mockSections} musicKey="F" onSubstitute={onSubstitute} />
    );
    const chordButtons = screen.getAllByRole('button', { name: /Edit bar/ });
    fireEvent.click(chordButtons[0]);
    fireEvent.click(screen.getByRole('menuitem', { name: /Tritone/ }));
    expect(onSubstitute).toHaveBeenCalledWith(0, 0, 'tritone');
  });

  it('calls onSubstitute with ii_v when ii-V Exp button is clicked', () => {
    const onSubstitute = vi.fn();
    render(
      <LeadSheet sections={mockSections} musicKey="F" onSubstitute={onSubstitute} />
    );
    const chordButtons = screen.getAllByRole('button', { name: /Edit bar/ });
    fireEvent.click(chordButtons[0]);
    fireEvent.click(screen.getByRole('menuitem', { name: /ii-V Exp/ }));
    expect(onSubstitute).toHaveBeenCalledWith(0, 0, 'ii_v');
  });

  it('calls onSubstitute with tritone_sd when Trt Dom button is clicked', () => {
    const onSubstitute = vi.fn();
    render(
      <LeadSheet sections={mockSections} musicKey="F" onSubstitute={onSubstitute} />
    );
    const chordButtons = screen.getAllByRole('button', { name: /Edit bar/ });
    fireEvent.click(chordButtons[0]);
    fireEvent.click(screen.getByRole('menuitem', { name: /Trt Dom/ }));
    expect(onSubstitute).toHaveBeenCalledWith(0, 0, 'tritone_sd');
  });

  it('calls onSubstitute with backdoor when Backdoor button is clicked', () => {
    const onSubstitute = vi.fn();
    render(
      <LeadSheet sections={mockSections} musicKey="F" onSubstitute={onSubstitute} />
    );
    const chordButtons = screen.getAllByRole('button', { name: /Edit bar/ });
    fireEvent.click(chordButtons[0]);
    fireEvent.click(screen.getByRole('menuitem', { name: /Backdoor/ }));
    expect(onSubstitute).toHaveBeenCalledWith(0, 0, 'backdoor');
  });

  it('calls onSubstitute with auto when Auto-Substitute button is clicked', () => {
    const onSubstitute = vi.fn();
    render(
      <LeadSheet sections={mockSections} musicKey="F" onSubstitute={onSubstitute} />
    );
    const chordButtons = screen.getAllByRole('button', { name: /Edit bar/ });
    fireEvent.click(chordButtons[0]);
    fireEvent.click(screen.getByRole('menuitem', { name: /Auto-Substitute/ }));
    expect(onSubstitute).toHaveBeenCalledWith(0, 0, 'auto');
  });

  it('calls onSubstitute with delete_chord when delete button is clicked', () => {
    const onSubstitute = vi.fn();
    render(
      <LeadSheet sections={mockSections} musicKey="F" onSubstitute={onSubstitute} />
    );
    const chordButtons = screen.getAllByRole('button', { name: /Edit bar/ });
    fireEvent.click(chordButtons[0]);
    fireEvent.click(screen.getByRole('menuitem', { name: /Delete chord/ }));
    expect(onSubstitute).toHaveBeenCalledWith(0, 0, 'delete_chord');
  });

  it('calls onSubstitute with move_left when move left button is clicked on a non-first chord', () => {
    const onSubstitute = vi.fn();
    render(
      <LeadSheet sections={mockSections} musicKey="F" onSubstitute={onSubstitute} />
    );
    const chordButtons = screen.getAllByRole('button', { name: /Edit bar/ });
    fireEvent.click(chordButtons[1]);
    fireEvent.click(screen.getByRole('menuitem', { name: /Move chord left/ }));
    expect(onSubstitute).toHaveBeenCalledWith(0, 1, 'move_left');
  });

  it('calls onSubstitute with move_right when move right button is clicked', () => {
    const onSubstitute = vi.fn();
    render(
      <LeadSheet sections={mockSections} musicKey="F" onSubstitute={onSubstitute} />
    );
    const chordButtons = screen.getAllByRole('button', { name: /Edit bar/ });
    fireEvent.click(chordButtons[1]);
    fireEvent.click(screen.getByRole('menuitem', { name: /Move chord right/ }));
    expect(onSubstitute).toHaveBeenCalledWith(0, 1, 'move_right');
  });

  it('calls onSubstitute with replace_chord when a replacement chord is selected', () => {
    const onSubstitute = vi.fn();
    render(
      <LeadSheet sections={mockSections} musicKey="F" onSubstitute={onSubstitute} />
    );
    const chordButtons = screen.getAllByRole('button', { name: /Edit bar/ });
    fireEvent.click(chordButtons[0]);
    const replacementOptions = screen.getAllByRole('option');
    fireEvent.click(replacementOptions[1]);
    expect(onSubstitute).toHaveBeenCalled();
  });

  it('disables move_left button on first chord', () => {
    render(<LeadSheet sections={mockSections} musicKey="F" />);
    const chordButtons = screen.getAllByRole('button', { name: /Edit bar/ });
    fireEvent.click(chordButtons[0]);
    const moveLeftBtn = screen.getByRole('menuitem', { name: /Move chord left/ });
    expect(moveLeftBtn).toBeDisabled();
  });

  it('disables move_right button on last chord of a section', () => {
    render(<LeadSheet sections={mockSections} musicKey="F" />);
    const chordButtons = screen.getAllByRole('button', { name: /Edit bar/ });
    fireEvent.click(chordButtons[3]);
    const moveRightBtn = screen.getByRole('menuitem', { name: /Move chord right/ });
    expect(moveRightBtn).toBeDisabled();
  });

  it('closes popover when clicking outside the container', () => {
    render(<LeadSheet sections={mockSections} musicKey="F" />);
    const chordButtons = screen.getAllByRole('button', { name: /Edit bar/ });
    fireEvent.click(chordButtons[0]);
    expect(screen.getByRole('menu')).toBeInTheDocument();
    fireEvent.pointerDown(document.body);
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
  });

  it('calls onSubstitute with add_chord when add button is clicked', () => {
    const onSubstitute = vi.fn();
    render(
      <LeadSheet sections={mockSections} musicKey="F" onSubstitute={onSubstitute} />
    );
    const addButtons = screen.getAllByRole('button', { name: /Add chord to/ });
    fireEvent.click(addButtons[0]);
    expect(onSubstitute).toHaveBeenCalledWith(0, 4, 'add_chord:Imaj7');
  });

  it('shows the Substitutions label in the popover', () => {
    render(<LeadSheet sections={mockSections} musicKey="F" />);
    const chordButtons = screen.getAllByRole('button', { name: /Edit bar/ });
    fireEvent.click(chordButtons[0]);
    expect(screen.getByText('Substitutions')).toBeInTheDocument();
  });

  it('shows the Replace Chord label in the popover', () => {
    render(<LeadSheet sections={mockSections} musicKey="F" />);
    const chordButtons = screen.getAllByRole('button', { name: /Edit bar/ });
    fireEvent.click(chordButtons[0]);
    expect(screen.getByText('Replace Chord')).toBeInTheDocument();
  });

  it('renders replacement chord listbox', () => {
    render(<LeadSheet sections={mockSections} musicKey="F" />);
    const chordButtons = screen.getAllByRole('button', { name: /Edit bar/ });
    fireEvent.click(chordButtons[0]);
    expect(screen.getByRole('listbox', { name: /Replacement chords/ })).toBeInTheDocument();
  });

  it('expands the second section popover from the right when near the end', () => {
    render(<LeadSheet sections={mockSections} musicKey="F" />);
    const chordButtons = screen.getAllByRole('button', { name: /Edit bar/ });
    fireEvent.click(chordButtons[6]);
    expect(screen.getByRole('menu')).toBeInTheDocument();
  });

  it('focuses the first popover button after opening via timer', () => {
    render(<LeadSheet sections={mockSections} musicKey="F" />);
    const chordButtons = screen.getAllByRole('button', { name: /Edit bar/ });
    fireEvent.click(chordButtons[0]);
    const popoverFirst = document.querySelector('[data-popover-first]') as HTMLElement;
    expect(popoverFirst).toBeTruthy();
  });

  it('handles Tab key in popover with activeChord', () => {
    render(<LeadSheet sections={mockSections} musicKey="F" />);
    const chordButtons = screen.getAllByRole('button', { name: /Edit bar/ });
    fireEvent.click(chordButtons[0]);
    expect(screen.getByRole('menu')).toBeInTheDocument();
    fireEvent.keyDown(document, { key: 'Tab', shiftKey: false });
    fireEvent.keyDown(document, { key: 'Tab', shiftKey: true });
  });
});
