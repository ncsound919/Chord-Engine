import React from 'react';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import { DrumPad, JunoVerticalSlider, BassKnob, BassEQSlider } from './UIPrimitives';

vi.mock('lucide-react', () => ({
  RefreshCw: (props: any) => <span data-testid="refresh-icon" {...props} />,
  Check: (props: any) => <span data-testid="check-icon" {...props} />,
}));

// ─── DrumPad ──────────────────────────────────────

describe('DrumPad', () => {
  const defaultProps = {
    drum: 'Kick',
    label: 'KICK',
    loaded: false,
    onClick: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  it('renders the label text', () => {
    render(<DrumPad {...defaultProps} />);
    expect(screen.getByText('KICK')).toBeInTheDocument();
  });

  it('has aria-label with loaded state when loaded', () => {
    render(<DrumPad {...defaultProps} loaded={true} />);
    expect(screen.getByRole('button')).toHaveAttribute(
      'aria-label',
      'KICK pad, loaded'
    );
  });

  it('has aria-label with empty state when not loaded', () => {
    render(<DrumPad {...defaultProps} loaded={false} />);
    expect(screen.getByRole('button')).toHaveAttribute(
      'aria-label',
      'KICK pad, empty'
    );
  });

  it('includes assignedName in aria-label when provided and not loaded', () => {
    render(<DrumPad {...defaultProps} loaded={false} assignedName="bass.wav" />);
    expect(screen.getByRole('button')).toHaveAttribute(
      'aria-label',
      'KICK pad, empty, assigned to bass.wav'
    );
  });

  it('includes assignedName in aria-label when loaded', () => {
    render(<DrumPad {...defaultProps} loaded={true} assignedName="bass.wav" />);
    expect(screen.getByRole('button')).toHaveAttribute(
      'aria-label',
      'KICK pad, loaded, assigned to bass.wav'
    );
  });

  it('calls onClick when clicked', () => {
    const onClick = vi.fn();
    render(<DrumPad {...defaultProps} onClick={onClick} />);
    fireEvent.click(screen.getByRole('button'));
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('does not call onClick when loading', () => {
    const onClick = vi.fn();
    render(<DrumPad {...defaultProps} onClick={onClick} loading={true} />);
    fireEvent.click(screen.getByRole('button'));
    expect(onClick).not.toHaveBeenCalled();
  });

  it('sets aria-disabled when loading', () => {
    render(<DrumPad {...defaultProps} loading={true} />);
    expect(screen.getByRole('button')).toHaveAttribute('aria-disabled', 'true');
  });

  it('shows RefreshCw icon when loading', () => {
    render(<DrumPad {...defaultProps} loading={true} />);
    expect(screen.getByTestId('refresh-icon')).toBeInTheDocument();
  });

  it('shows Check icon when justLoaded', () => {
    render(<DrumPad {...defaultProps} justLoaded={true} />);
    expect(screen.getByTestId('check-icon')).toBeInTheDocument();
  });

  it('shows assignedName text when not loaded and assignedName provided', () => {
    render(<DrumPad {...defaultProps} loaded={false} assignedName="kick.wav" />);
    expect(screen.getByText('kick.wav')).toBeInTheDocument();
  });

  it('does not show assignedName text when loaded', () => {
    render(<DrumPad {...defaultProps} loaded={true} assignedName="kick.wav" />);
    expect(screen.queryByText('kick.wav')).not.toBeInTheDocument();
  });

  it('shows plus indicator when not loaded, not loading, not justLoaded', () => {
    const { container } = render(
      <DrumPad {...defaultProps} loaded={false} loading={false} justLoaded={false} />
    );
    expect(container.querySelector('span.text-xs')).toBeInTheDocument();
  });

  it('announces loading state via live region', () => {
    render(<DrumPad {...defaultProps} loading={true} />);
    expect(screen.getByText('Loading sample for Kick')).toBeInTheDocument();
  });

  it('announces success state via live region', () => {
    render(<DrumPad {...defaultProps} justLoaded={true} />);
    expect(screen.getByText('Sample for Kick loaded successfully')).toBeInTheDocument();
  });
});

// ─── JunoVerticalSlider ─────────────────────────────

describe('JunoVerticalSlider', () => {
  const defaultProps = {
    label: 'Cutoff',
    value: 50,
    onChange: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  it('renders the label', () => {
    render(<JunoVerticalSlider {...defaultProps} />);
    expect(screen.getByText('Cutoff')).toBeInTheDocument();
  });

  it('renders the value text', () => {
    render(<JunoVerticalSlider {...defaultProps} value={72} />);
    expect(screen.getByText('72')).toBeInTheDocument();
  });

  it('has an accessible range input', () => {
    render(<JunoVerticalSlider {...defaultProps} />);
    const slider = screen.getByRole('slider');
    expect(slider).toHaveAttribute('aria-label', 'Cutoff');
  });

  it('sets aria-valuetext with percentage', () => {
    render(<JunoVerticalSlider {...defaultProps} value={50} />);
    expect(screen.getByRole('slider')).toHaveAttribute('aria-valuetext', '50%');
  });

  it('uses default min/max/step', () => {
    render(<JunoVerticalSlider {...defaultProps} />);
    const slider = screen.getByRole('slider');
    expect(slider).toHaveAttribute('min', '0');
    expect(slider).toHaveAttribute('max', '100');
    expect(slider).toHaveAttribute('step', '1');
  });

  it('respects custom min/max/step', () => {
    render(<JunoVerticalSlider {...defaultProps} min={-10} max={10} step={0.5} />);
    const slider = screen.getByRole('slider');
    expect(slider).toHaveAttribute('min', '-10');
    expect(slider).toHaveAttribute('max', '10');
    expect(slider).toHaveAttribute('step', '0.5');
  });

  it('fires onChange with new value', () => {
    const onChange = vi.fn();
    render(<JunoVerticalSlider {...defaultProps} onChange={onChange} />);
    const slider = screen.getByRole('slider');
    fireEvent.change(slider, { target: { value: '80' } });
    expect(onChange).toHaveBeenCalledWith(80);
  });

  it('fires onChange with float step value', () => {
    const onChange = vi.fn();
    render(<JunoVerticalSlider {...defaultProps} onChange={onChange} step={0.1} />);
    const slider = screen.getByRole('slider');
    fireEvent.change(slider, { target: { value: '33.3' } });
    expect(onChange).toHaveBeenCalledWith(33.3);
  });
});

// ─── BassKnob ────────────────────────────────────────

describe('BassKnob', () => {
  const defaultProps = {
    label: 'Resonance',
    value: 60,
    onChange: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  it('renders the label', () => {
    render(<BassKnob {...defaultProps} />);
    expect(screen.getByText('Resonance')).toBeInTheDocument();
  });

  it('renders the value text without suffix by default', () => {
    render(<BassKnob {...defaultProps} value={45} />);
    expect(screen.getByText('45')).toBeInTheDocument();
  });

  it('renders value with suffix when provided', () => {
    render(<BassKnob {...defaultProps} value={45} suffix="%" />);
    expect(screen.getByText('45%')).toBeInTheDocument();
  });

  it('renders value with empty suffix string', () => {
    render(<BassKnob {...defaultProps} value={80} suffix="" />);
    expect(screen.getByText('80')).toBeInTheDocument();
  });

  it('has an accessible range input', () => {
    render(<BassKnob {...defaultProps} />);
    const slider = screen.getByRole('slider');
    expect(slider).toHaveAttribute('aria-label', 'Resonance');
  });

  it('sets aria-valuetext with value and suffix', () => {
    render(<BassKnob {...defaultProps} value={75} suffix="Hz" />);
    expect(screen.getByRole('slider')).toHaveAttribute('aria-valuetext', '75Hz');
  });

  it('uses default min/max/step', () => {
    render(<BassKnob {...defaultProps} />);
    const slider = screen.getByRole('slider');
    expect(slider).toHaveAttribute('min', '0');
    expect(slider).toHaveAttribute('max', '100');
    expect(slider).toHaveAttribute('step', '1');
  });

  it('respects custom min/max/step', () => {
    render(<BassKnob {...defaultProps} min={-12} max={12} step={0.1} />);
    const slider = screen.getByRole('slider');
    expect(slider).toHaveAttribute('min', '-12');
    expect(slider).toHaveAttribute('max', '12');
    expect(slider).toHaveAttribute('step', '0.1');
  });

  it('fires onChange with new value', () => {
    const onChange = vi.fn();
    render(<BassKnob {...defaultProps} onChange={onChange} />);
    const slider = screen.getByRole('slider');
    fireEvent.change(slider, { target: { value: '30' } });
    expect(onChange).toHaveBeenCalledWith(30);
  });
});

// ─── BassEQSlider ────────────────────────────────────

describe('BassEQSlider', () => {
  const defaultProps = {
    label: 'EQ High',
    value: 0,
    onChange: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  it('renders the label', () => {
    render(<BassEQSlider {...defaultProps} />);
    expect(screen.getByText('EQ High')).toBeInTheDocument();
  });

  it('renders zero value without +/- prefix', () => {
    render(<BassEQSlider {...defaultProps} value={0} />);
    expect(screen.getByText('0')).toBeInTheDocument();
  });

  it('renders positive value with + prefix', () => {
    render(<BassEQSlider {...defaultProps} value={6} />);
    expect(screen.getByText('+6')).toBeInTheDocument();
  });

  it('renders negative value without + prefix', () => {
    render(<BassEQSlider {...defaultProps} value={-8} />);
    expect(screen.getByText('-8')).toBeInTheDocument();
  });

  it('has an accessible range input', () => {
    render(<BassEQSlider {...defaultProps} />);
    const slider = screen.getByRole('slider');
    expect(slider).toHaveAttribute('aria-label', 'EQ High');
  });

  it('sets aria-valuetext in dB', () => {
    render(<BassEQSlider {...defaultProps} value={5} />);
    expect(screen.getByRole('slider')).toHaveAttribute('aria-valuetext', '5 dB');
  });

  it('uses fixed min of -12, max of 12, step of 1', () => {
    render(<BassEQSlider {...defaultProps} />);
    const slider = screen.getByRole('slider');
    expect(slider).toHaveAttribute('min', '-12');
    expect(slider).toHaveAttribute('max', '12');
    expect(slider).toHaveAttribute('step', '1');
  });

  it('fires onChange with new value', () => {
    const onChange = vi.fn();
    render(<BassEQSlider {...defaultProps} onChange={onChange} />);
    const slider = screen.getByRole('slider');
    fireEvent.change(slider, { target: { value: '4' } });
    expect(onChange).toHaveBeenCalledWith(4);
  });

  it('renders max positive value', () => {
    render(<BassEQSlider {...defaultProps} value={12} />);
    expect(screen.getByText('+12')).toBeInTheDocument();
  });

  it('renders min negative value', () => {
    render(<BassEQSlider {...defaultProps} value={-12} />);
    expect(screen.getByText('-12')).toBeInTheDocument();
  });
});
