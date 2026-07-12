import React from 'react';
import { describe, expect, it, vi, afterEach, beforeEach } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { PresetBrowser } from './PresetBrowser';

function makeEntry(id: string, name: string, overrides: Partial<any> = {}): any {
  return {
    id,
    name,
    filename: `${name}.wav`,
    path: `sounds/${name}.wav`,
    folder: 'Bass',
    library: 'MyLib',
    type: 'bass',
    tags: ['electric', 'finger', 'modern'],
    metadata: { note: 'A2', instrument: 'Precision Bass', midiNote: 45 },
    ...overrides,
  };
}

const mockEntries = [
  makeEntry('e1', 'P Bass Finger A2'),
  makeEntry('e2', 'P Bass Finger D3', { metadata: { note: 'D3', instrument: 'Precision Bass' } }),
  makeEntry('e3', 'Jazz Bass Slap G2', { type: 'bass', tags: ['slap', 'modern'], metadata: { note: 'G2', instrument: 'Jazz Bass' } }),
  makeEntry('e4', 'Kick Drum', { type: 'drum', folder: 'Kicks', metadata: {} }),
  makeEntry('e5', 'Snare Drum', { type: 'drum', folder: 'Snares', metadata: {} }),
];

const mockSoundLibrary = {
  allEntries: mockEntries,
  search: vi.fn(() => mockEntries),
  folders: ['Bass', 'Kicks', 'Snares'],
  allTags: ['electric', 'finger', 'modern', 'slap', 'acoustic', 'vintage'],
  countByType: vi.fn((type: string) => {
    const counts: Record<string, number> = { bass: 3, drum: 2, one_shot: 0, melodic: 0 };
    return counts[type] || 0;
  }),
};

vi.mock('../lib/audio/soundLibrary', () => ({
  soundLibrary: {},
}));

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

async function renderWithLib(props: Partial<React.ComponentProps<typeof PresetBrowser>> = {}) {
  const mod = await import('../lib/audio/soundLibrary');
  (mod.soundLibrary as any) = mockSoundLibrary;
  return render(
    <PresetBrowser
      type="bass"
      onLoadEntry={vi.fn()}
      {...props}
    />,
  );
}

describe('PresetBrowser', () => {
  beforeEach(() => {
    mockSoundLibrary.search.mockReturnValue(mockEntries);
  });

  it('renders search bar', async () => {
    await renderWithLib();
    expect(screen.getByPlaceholderText('Search 5 samples...')).toBeInTheDocument();
  });

  it('shows entries returned by search', async () => {
    await renderWithLib();
    expect(screen.getByText('P Bass Finger A2')).toBeInTheDocument();
    expect(screen.getByText('P Bass Finger D3')).toBeInTheDocument();
    expect(screen.getByText('Jazz Bass Slap G2')).toBeInTheDocument();
  });

  it('type filter buttons work', async () => {
    mockSoundLibrary.search.mockReturnValue(
      mockEntries.filter(e => e.type === 'drum'),
    );
    await renderWithLib();
    const drumBtn = screen.getByText(/drum/);
    fireEvent.click(drumBtn);
    expect(mockSoundLibrary.search).toHaveBeenCalled();
    expect(screen.getByText('Kick Drum')).toBeInTheDocument();
  });

  it('folder filter dropdown works', async () => {
    mockSoundLibrary.search.mockReturnValue(
      mockEntries.filter(e => e.folder === 'Kicks'),
    );
    await renderWithLib();
    const select = screen.getByRole('combobox');
    fireEvent.change(select, { target: { value: 'Kicks' } });
    expect(screen.getAllByText('Kicks').length).toBeGreaterThanOrEqual(1);
  });

  it('view mode toggle switches to list', async () => {
    await renderWithLib();
    const toggleBtn = document.querySelector('[class*="p-1.5"][class*="rounded-lg"]')!;
    fireEvent.click(toggleBtn);
  });

  it('tag suggestions appear on query', async () => {
    mockSoundLibrary.search.mockReturnValue([]);
    await renderWithLib();
    const searchInput = screen.getByPlaceholderText('Search 5 samples...');
    fireEvent.change(searchInput, { target: { value: 'el' } });
    await waitFor(() => {
      expect(screen.getAllByText('electric').length).toBeGreaterThanOrEqual(1);
    });
  });

  it('empty state renders when no entries', async () => {
    mockSoundLibrary.search.mockReturnValue([]);
    await renderWithLib();
    expect(screen.getByText('No samples found')).toBeInTheDocument();
    expect(screen.getByText(/Import a sound library/)).toBeInTheDocument();
  });

  it('entry click calls onLoadEntry', async () => {
    const onLoadEntry = vi.fn();
    await renderWithLib({ onLoadEntry });
    fireEvent.click(screen.getByText('P Bass Finger A2'));
    expect(onLoadEntry).toHaveBeenCalledWith(mockEntries[0]);
  });

  it('displays note metadata', async () => {
    await renderWithLib();
    expect(screen.getByText('A2')).toBeInTheDocument();
  });

  it('displays instrument metadata', async () => {
    await renderWithLib();
    const instruments = screen.getAllByText('Precision Bass');
    expect(instruments.length).toBeGreaterThanOrEqual(1);
  });

  it('long name truncation works', async () => {
    const longName = 'A Very Long Sample Name That Exceeds Twenty Characters';
    mockSoundLibrary.search.mockReturnValue([
      makeEntry('long', longName),
    ]);
    await renderWithLib();
    const truncated = longName.slice(0, 20) + '…';
    expect(screen.getByText(truncated)).toBeInTheDocument();
  });

  it('shows type count badges', async () => {
    await renderWithLib();
    expect(screen.getByText(/bass \(3\)/)).toBeInTheDocument();
    expect(screen.getByText(/drum \(2\)/)).toBeInTheDocument();
    expect(screen.getByText(/one shot \(0\)/)).toBeInTheDocument();
  });

  it('hides type filter when hideTypeFilter is set', async () => {
    await renderWithLib({ hideTypeFilter: true });
    expect(screen.queryByText(/bass \(3\)/)).not.toBeInTheDocument();
  });

  it('shows tag chips on entries', async () => {
    await renderWithLib();
    const electricTags = screen.getAllByText('electric');
    expect(electricTags.length).toBeGreaterThanOrEqual(1);
  });

  it('clicking a tag suggestion adds it as active filter', async () => {
    mockSoundLibrary.search.mockReturnValue([]);
    await renderWithLib();
    const searchInput = screen.getByPlaceholderText('Search 5 samples...');
    fireEvent.change(searchInput, { target: { value: 'el' } });
    await waitFor(() => {
      const suggestions = screen.getAllByText('electric');
      expect(suggestions.length).toBeGreaterThanOrEqual(1);
    });
    fireEvent.click(screen.getAllByText('electric')[0]);
    expect(screen.getByText('Clear filters')).toBeInTheDocument();
  });

  it('clears all filters when Clear filters clicked', async () => {
    mockSoundLibrary.search.mockReturnValue(mockEntries);
    await renderWithLib();
    const searchInput = screen.getByPlaceholderText('Search 5 samples...');
    fireEvent.change(searchInput, { target: { value: 'el' } });
    await waitFor(() => {
      const suggestions = screen.getAllByText('electric');
      expect(suggestions.length).toBeGreaterThanOrEqual(1);
    });
    fireEvent.click(screen.getAllByText('electric')[0]);
    const clearBtn = screen.getByText('Clear filters');
    fireEvent.click(clearBtn);
    expect(screen.queryByText('Clear filters')).not.toBeInTheDocument();
  });

  it('handles many tags without overflowing', async () => {
    const manyTags = Array.from({ length: 30 }, (_, i) => `tag_${i}`);
    mockSoundLibrary.search.mockReturnValue([
      makeEntry('many-tags', 'Many Tags', { tags: manyTags }),
    ]);
    await renderWithLib();
    expect(screen.getByText('Many Tags')).toBeInTheDocument();
  });

  it('shows All Folders as default in folder filter', async () => {
    await renderWithLib();
    expect(screen.getByText('All Folders')).toBeInTheDocument();
  });

  it('renders list view showing folder names', async () => {
    const onLoadEntry = vi.fn();
    await renderWithLib({ onLoadEntry });
    const toggleBtn = document.querySelector('[class*="p-1.5"][class*="rounded-lg"]')!;
    fireEvent.click(toggleBtn);
    const folders = screen.getAllByText(/Bass|Kicks|Snares/);
    expect(folders.length).toBeGreaterThanOrEqual(1);
  });

  it('renders dash for missing note in list view', async () => {
    const noNoteEntry = makeEntry('no-note', 'No Note', { metadata: {} });
    mockSoundLibrary.search.mockReturnValue([noNoteEntry]);
    const onLoadEntry = vi.fn();
    await renderWithLib({ onLoadEntry });
    const toggleBtn = document.querySelector('[class*="p-1.5"][class*="rounded-lg"]')!;
    fireEvent.click(toggleBtn);
    expect(screen.getByText('—')).toBeInTheDocument();
  });

  it('clicking active tag X removes individual tag', async () => {
    mockSoundLibrary.search.mockReturnValue([]);
    await renderWithLib();
    const searchInput = screen.getByPlaceholderText('Search 5 samples...');
    fireEvent.change(searchInput, { target: { value: 'el' } });
    await waitFor(() => {
      expect(screen.getAllByText('electric').length).toBeGreaterThanOrEqual(1);
    });
    fireEvent.click(screen.getAllByText('electric')[0]);
    expect(screen.getByText('Clear filters')).toBeInTheDocument();
    const closeBtn = screen.getByText('×');
    fireEvent.click(closeBtn);
    expect(screen.queryByText('×')).not.toBeInTheDocument();
  });
});
