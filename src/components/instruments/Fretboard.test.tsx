import React from 'react';
import { describe, expect, it, vi, afterEach } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { Fretboard } from './Fretboard';

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

const defaultProps = {
  tuningCoarse: 0,
  onPlayNote: vi.fn(),
};

const renderFretboard = (overrides: Partial<typeof defaultProps> = {}) =>
  render(<Fretboard {...defaultProps} {...overrides} />);

describe('Fretboard', () => {
  it('renders without crashing', () => {
    renderFretboard();
    expect(screen.getByText('Show All Notes')).toBeInTheDocument();
  });

  it('renders 4 strings with fret buttons', () => {
    const { container } = renderFretboard();
    const fretButtons = container.querySelectorAll('button[aria-label]');
    expect(fretButtons.length).toBe(4 * 13);
  });

  it('calls onPlayNote when a fret button is clicked', () => {
    const onPlayNote = vi.fn();
    renderFretboard({ onPlayNote });

    const firstFretButton = screen.getByLabelText(/Play .+ on string 1, fret 0/);
    fireEvent.click(firstFretButton);
    expect(onPlayNote).toHaveBeenCalledWith(0, 0);
  });

  it('calls onPlayNote with correct string and fret indices', () => {
    const onPlayNote = vi.fn();
    renderFretboard({ onPlayNote });

    const button = screen.getByLabelText(/Play .+ on string 3, fret 5/);
    fireEvent.click(button);
    expect(onPlayNote).toHaveBeenCalledWith(2, 5);
  });

  it('toggles note labels when Show All Notes is clicked', () => {
    const { container } = renderFretboard();

    const noteSpanBefore = container.querySelector('button[aria-label] span');
    expect(noteSpanBefore).toHaveClass('opacity-0');

    fireEvent.click(screen.getByText('Show All Notes'));

    expect(screen.getByText('Hide Notes')).toBeInTheDocument();
    const noteSpanAfter = container.querySelector('button[aria-label] span');
    expect(noteSpanAfter).toHaveClass('opacity-100');
  });

  it('shows note names after toggling showAllNotes', () => {
    renderFretboard({ tuningCoarse: 0 });

    fireEvent.click(screen.getByText('Show All Notes'));

    const fretButton = screen.getByLabelText(/Play .+ on string 4, fret 0/);
    expect(fretButton.querySelector('span')).not.toHaveClass('opacity-0');
  });

  it('adjusts note names based on tuningCoarse', () => {
    const { rerender } = render(<Fretboard tuningCoarse={0} onPlayNote={vi.fn()} />);

    fireEvent.click(screen.getByText('Show All Notes'));
    const noteAtZero = screen.getByLabelText(/Play .+ on string 4, fret 0/);
    const textAtZero = noteAtZero.textContent;

    rerender(<Fretboard tuningCoarse={1} onPlayNote={vi.fn()} />);
    const noteAtOne = screen.getByLabelText(/Play .+ on string 4, fret 0/);
    const textAtOne = noteAtOne.textContent;

    expect(textAtZero).not.toBe(textAtOne);
  });
});
