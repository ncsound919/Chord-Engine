import React from 'react';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import { StepButton } from './StepButton';

describe('StepButton', () => {
  const defaultProps = {
    drum: 'Kick',
    index: 0,
    isActive: false,
    isCurrent: false,
    isBeat: false,
    onClick: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  it('renders a button element', () => {
    render(<StepButton {...defaultProps} />);
    expect(screen.getByRole('gridcell')).toBeInTheDocument();
  });

  it('sets aria-pressed to false when isActive is false', () => {
    render(<StepButton {...defaultProps} isActive={false} />);
    expect(screen.getByRole('gridcell')).toHaveAttribute('aria-pressed', 'false');
  });

  it('sets aria-pressed to true when isActive is true', () => {
    render(<StepButton {...defaultProps} isActive={true} />);
    expect(screen.getByRole('gridcell')).toHaveAttribute('aria-pressed', 'true');
  });

  it('includes drum name and step number (1-indexed) in aria-label', () => {
    render(<StepButton {...defaultProps} drum="Snare" index={4} />);
    expect(screen.getByRole('gridcell')).toHaveAttribute(
      'aria-label',
      'Snare at step 5'
    );
  });

  it('appends ", active" to aria-label when isActive', () => {
    render(<StepButton {...defaultProps} drum="Kick" index={0} isActive={true} />);
    expect(screen.getByRole('gridcell')).toHaveAttribute(
      'aria-label',
      'Kick at step 1, active'
    );
  });

  it('calls onClick when clicked', () => {
    const onClick = vi.fn();
    render(<StepButton {...defaultProps} onClick={onClick} />);
    fireEvent.click(screen.getByRole('gridcell'));
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('calls onClick on each click', () => {
    const onClick = vi.fn();
    render(<StepButton {...defaultProps} onClick={onClick} />);
    const btn = screen.getByRole('gridcell');
    fireEvent.click(btn);
    fireEvent.click(btn);
    fireEvent.click(btn);
    expect(onClick).toHaveBeenCalledTimes(3);
  });

  it('applies active+current styles when isActive and isCurrent', () => {
    render(<StepButton {...defaultProps} isActive={true} isCurrent={true} isBeat={false} />);
    const btn = screen.getByRole('gridcell');
    expect(btn.className).toContain('from-yellow-300');
    expect(btn.className).toContain('to-orange-400');
  });

  it('applies active+non-current styles when isActive and !isCurrent', () => {
    render(<StepButton {...defaultProps} isActive={true} isCurrent={false} isBeat={false} />);
    const btn = screen.getByRole('gridcell');
    expect(btn.className).toContain('from-orange-400');
    expect(btn.className).toContain('to-orange-600');
  });

  it('applies beat+current styles when isBeat, !isActive, isCurrent', () => {
    render(<StepButton {...defaultProps} isActive={false} isCurrent={true} isBeat={true} />);
    const btn = screen.getByRole('gridcell');
    expect(btn.className).toContain('bg-white/30');
    expect(btn.className).toContain('border-white/40');
  });

  it('applies beat+non-current styles when isBeat, !isActive, !isCurrent', () => {
    render(<StepButton {...defaultProps} isActive={false} isCurrent={false} isBeat={true} />);
    const btn = screen.getByRole('gridcell');
    expect(btn.className).toContain('bg-white/15');
    expect(btn.className).toContain('border-white/20');
  });

  it('applies non-beat+current styles when !isBeat, !isActive, isCurrent', () => {
    render(<StepButton {...defaultProps} isActive={false} isCurrent={true} isBeat={false} />);
    const btn = screen.getByRole('gridcell');
    expect(btn.className).toContain('bg-white/20');
    expect(btn.className).toContain('border-white/30');
  });

  it('applies non-beat+non-current styles when !isBeat, !isActive, !isCurrent', () => {
    render(<StepButton {...defaultProps} isActive={false} isCurrent={false} isBeat={false} />);
    const btn = screen.getByRole('gridcell');
    expect(btn.className).toContain('bg-white/5');
    expect(btn.className).toContain('border-white/10');
  });
});
