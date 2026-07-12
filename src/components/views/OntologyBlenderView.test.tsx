import React from 'react';
import { describe, expect, it, vi, afterEach } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { OntologyBlenderView } from './OntologyBlenderView';

const defaultProps = {
  writerWeights: {
    bacharach: 100,
    sylvers: 0,
    mayfield: 0,
    sly_stone: 0,
    steely_dan: 0,
  },
  setWriterWeights: vi.fn(),
  handleCompileSong: vi.fn(),
  handleGenerate: vi.fn(),
  musicKey: 'C',
};

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe('OntologyBlenderView', () => {
  it('renders the view header', () => {
    render(<OntologyBlenderView {...defaultProps} />);
    expect(screen.getByText('Ontology Blender')).toBeInTheDocument();
  });

  it('renders the subtitle', () => {
    render(<OntologyBlenderView {...defaultProps} />);
    expect(screen.getByText(/Songwriter Influence Profile Synthesizer/)).toBeInTheDocument();
  });

  it('renders all five writer weight controls', () => {
    render(<OntologyBlenderView {...defaultProps} />);
    expect(screen.getAllByText('Burt Bacharach').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Leon Sylvers III').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Curtis Mayfield').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Sly Stone').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Steely Dan').length).toBeGreaterThan(0);
  });

  it('shows total weight percentage', () => {
    render(<OntologyBlenderView {...defaultProps} />);
    expect(screen.getByText('Total: 100%')).toBeInTheDocument();
  });

  it('shows non-100% total with amber color', () => {
    render(
      <OntologyBlenderView
        {...defaultProps}
        writerWeights={{ bacharach: 50, sylvers: 0, mayfield: 0, sly_stone: 0, steely_dan: 0 }}
      />
    );
    expect(screen.getByText('Total: 50%')).toBeInTheDocument();
  });

  it('renders the radar chart', () => {
    render(<OntologyBlenderView {...defaultProps} />);
    expect(screen.getByRole('img', { name: /radar chart/i })).toBeInTheDocument();
  });

  it('renders the visual balance radar description', () => {
    render(<OntologyBlenderView {...defaultProps} />);
    expect(screen.getByText('Visual Balance Radar')).toBeInTheDocument();
  });

  it('shows the default selected writer bio (bacharach)', () => {
    render(<OntologyBlenderView {...defaultProps} />);
    expect(screen.getByText('Late 1960s Pop Jazz')).toBeInTheDocument();
    expect(screen.getByText('Cinematic Orchestral Pop')).toBeInTheDocument();
  });

  it('switches bio when clicking a writer label', () => {
    render(<OntologyBlenderView {...defaultProps} />);
    fireEvent.click(screen.getByText('Sly Stone'));
    expect(screen.getByText('Late 1960s Psych Funk')).toBeInTheDocument();
  });

  it('solo button sets a writer to 100% and resets others', () => {
    render(<OntologyBlenderView {...defaultProps} />);
    fireEvent.click(screen.getByRole('button', { name: /Set Leon Sylvers III to 100 percent/i }));
    expect(defaultProps.setWriterWeights).toHaveBeenCalledWith({
      bacharach: 0,
      sylvers: 100,
      mayfield: 0,
      sly_stone: 0,
      steely_dan: 0,
    });
  });

  it('Distribute Equal button sets all writers to 20%', () => {
    render(<OntologyBlenderView {...defaultProps} />);
    fireEvent.click(screen.getByText('Distribute Equal'));
    expect(defaultProps.setWriterWeights).toHaveBeenCalledWith({
      bacharach: 20,
      sylvers: 20,
      mayfield: 20,
      sly_stone: 20,
      steely_dan: 20,
    });
  });

  it('calls setWriterWeights when a weight slider changes', () => {
    render(<OntologyBlenderView {...defaultProps} />);
    const slider = screen.getByLabelText('Burt Bacharach influence');
    fireEvent.change(slider, { target: { value: '60' } });
    expect(defaultProps.setWriterWeights).toHaveBeenCalled();
  });

  it('renders all blend presets', () => {
    render(<OntologyBlenderView {...defaultProps} />);
    expect(screen.getByText('Silky 70s Soul Symphony')).toBeInTheDocument();
    expect(screen.getByText('Yacht Rock Perfection')).toBeInTheDocument();
    expect(screen.getByText('Solar System Boogie')).toBeInTheDocument();
    expect(screen.getByText('Cosmic Cinematic Jazz')).toBeInTheDocument();
  });

  it('clicking a blend preset calls setWriterWeights', () => {
    render(<OntologyBlenderView {...defaultProps} />);
    fireEvent.click(screen.getByText('Yacht Rock Perfection'));
    expect(defaultProps.setWriterWeights).toHaveBeenCalledWith(
      expect.objectContaining({ steely_dan: 75 })
    );
  });

  it('Compile Song Structure button calls handleCompileSong', async () => {
    vi.useFakeTimers();
    render(<OntologyBlenderView {...defaultProps} />);
    fireEvent.click(screen.getByText('Compile Song Structure'));
    await vi.advanceTimersByTimeAsync(2000);
    expect(defaultProps.handleCompileSong).toHaveBeenCalled();
    vi.useRealTimers();
  });

  it('Generate Full Score button calls handleGenerate', async () => {
    vi.useFakeTimers();
    render(<OntologyBlenderView {...defaultProps} />);
    fireEvent.click(screen.getByText(/Generate Full Score/));
    await vi.advanceTimersByTimeAsync(2000);
    expect(defaultProps.handleGenerate).toHaveBeenCalled();
    vi.useRealTimers();
  });

  it('shows Compiling Structure... while compiling', async () => {
    vi.useFakeTimers();
    render(<OntologyBlenderView {...defaultProps} />);
    fireEvent.click(screen.getByText('Compile Song Structure'));
    expect(screen.getByText('Compiling Structure...')).toBeInTheDocument();
    vi.useRealTimers();
  });

  it('shows Generating Score... while generating', async () => {
    vi.useFakeTimers();
    render(<OntologyBlenderView {...defaultProps} />);
    fireEvent.click(screen.getByText(/Generate Full Score/));
    expect(screen.getByText('Generating Score...')).toBeInTheDocument();
    vi.useRealTimers();
  });

  it('shows success message after compiling', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    render(<OntologyBlenderView {...defaultProps} />);
    fireEvent.click(screen.getByText('Compile Song Structure'));
    await waitFor(() => {
      expect(screen.getByText(/Structure Compiled/)).toBeInTheDocument();
    }, { timeout: 5000 });
    vi.useRealTimers();
  });

  it('shows success message after generating', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    render(<OntologyBlenderView {...defaultProps} />);
    fireEvent.click(screen.getByText(/Generate Full Score/));
    await waitFor(() => {
      expect(screen.getByText(/Score Generated/)).toBeInTheDocument();
    }, { timeout: 5000 });
    vi.useRealTimers();
  });

  it('renders signature chord tags for the selected bio', () => {
    render(<OntologyBlenderView {...defaultProps} />);
    expect(screen.getByText('Fmaj7')).toBeInTheDocument();
  });

  it('clicking Bio button shows that writer bio', () => {
    render(<OntologyBlenderView {...defaultProps} />);
    const bioButtons = screen.getAllByRole('button', { name: /Show .* profile/i });
    fireEvent.click(bioButtons[2]); // Curtis Mayfield
    expect(screen.getByText('Early 1970s Orchestral Soul')).toBeInTheDocument();
  });

  it('renders the Influence Controls heading', () => {
    render(<OntologyBlenderView {...defaultProps} />);
    expect(screen.getByText('Influence Controls')).toBeInTheDocument();
  });

  it('renders the Outline Compiler heading', () => {
    render(<OntologyBlenderView {...defaultProps} />);
    expect(screen.getByText('Outline Compiler')).toBeInTheDocument();
  });

  it('shows the music key in the generate button', () => {
    render(<OntologyBlenderView {...defaultProps} musicKey="F#" />);
    expect(screen.getByText(/Generate Full Score — F#/)).toBeInTheDocument();
  });

  it('renders the ontology geometry map heading', () => {
    render(<OntologyBlenderView {...defaultProps} />);
    expect(screen.getByText('Ontology Geometry Map')).toBeInTheDocument();
  });

  it('displays writer profile details', () => {
    render(<OntologyBlenderView {...defaultProps} />);
    expect(screen.getByText('Signature Style')).toBeInTheDocument();
    expect(screen.getByText('Songwriting Profile')).toBeInTheDocument();
    expect(screen.getByText('Profile Fingerprint')).toBeInTheDocument();
  });
});
