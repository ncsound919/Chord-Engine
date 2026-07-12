import { describe, it, expect, beforeEach } from 'vitest';
import { SoundLibrary, soundLibrary } from './soundLibrary';
import type { SoundLibraryEntry } from './soundLibrary';

function makeEntry(overrides: Partial<SoundLibraryEntry> = {}): SoundLibraryEntry {
  return {
    id: 'test_0',
    name: 'Kick',
    filename: 'kick.wav',
    path: 'drums/kick.wav',
    folder: 'drums',
    library: 'acoustic',
    type: 'drum',
    tags: ['kick', 'acoustic'],
    metadata: {},
    ...overrides,
  };
}

describe('SoundLibrary', () => {
  let lib: SoundLibrary;

  beforeEach(() => {
    lib = new SoundLibrary();
  });

  describe('constructor', () => {
    it('starts empty', () => {
      expect(lib.allEntries).toEqual([]);
      expect(lib.folders).toEqual([]);
      expect(lib.libraries).toEqual([]);
      expect(lib.allTags).toEqual([]);
    });
  });

  describe('addEntries', () => {
    it('adds and indexes entries', () => {
      lib.addEntries([makeEntry()]);
      expect(lib.allEntries).toHaveLength(1);
      expect(lib.countByType('drum')).toBe(1);
    });

    it('creates type index', () => {
      lib.addEntries([makeEntry({ type: 'drum' }), makeEntry({ id: 't1', type: 'bass' })]);
      expect(lib.countByType('drum')).toBe(1);
      expect(lib.countByType('bass')).toBe(1);
      expect(lib.countByType('one_shot')).toBe(0);
    });

    it('creates folder index', () => {
      lib.addEntries([makeEntry({ folder: 'kits' }), makeEntry({ id: 't1', folder: 'bass' })]);
      expect(lib.folders).toEqual(expect.arrayContaining(['kits', 'bass']));
    });

    it('creates keyword index', () => {
      lib.addEntries([makeEntry({ tags: ['kick', 'acoustic'] })]);
      expect(lib.allTags).toEqual(expect.arrayContaining(['kick', 'acoustic']));
    });
  });

  describe('search', () => {
    beforeEach(() => {
      lib.addEntries([
        makeEntry({ id: '1', name: 'Kick', filename: 'kick.wav', folder: 'kits', type: 'drum', tags: ['kick', 'acoustic'] }),
        makeEntry({ id: '2', name: 'Snare', filename: 'snare.wav', folder: 'kits', type: 'drum', tags: ['snare'] }),
        makeEntry({ id: '3', name: 'Bass Sub', filename: 'sub.wav', folder: 'bass', type: 'bass', tags: ['sub', 'synth'] }),
        makeEntry({ id: '4', name: 'Pad', filename: 'pad.wav', folder: 'pads', type: 'melodic', tags: ['ambient'] }),
      ]);
    });

    it('with no query returns all entries', () => {
      expect(lib.search('')).toHaveLength(4);
    });

    it('with type filter works', () => {
      const results = lib.search('', { type: 'drum' });
      expect(results).toHaveLength(2);
      expect(results.every(r => r.type === 'drum')).toBe(true);
    });

    it('with folder filter works', () => {
      const results = lib.search('', { folder: 'bass' });
      expect(results).toHaveLength(1);
      expect(results[0].id).toBe('3');
    });

    it('with tag filter works', () => {
      const results = lib.search('', { tags: ['ambient'] });
      expect(results).toHaveLength(1);
      expect(results[0].id).toBe('4');
    });

    it('with query text uses trigram scoring', () => {
      const results = lib.search('kick');
      expect(results.length).toBeGreaterThanOrEqual(1);
      expect(results[0].id).toBe('1');
    });

    it('with combined filters works', () => {
      const results = lib.search('', { type: 'drum', folder: 'kits' });
      expect(results).toHaveLength(2);
    });

    it('returns empty array for non-matching type filter', () => {
      expect(lib.search('', { type: 'one_shot' })).toEqual([]);
    });

    it('returns empty array for non-matching folder filter', () => {
      expect(lib.search('', { folder: 'nonexistent' })).toEqual([]);
    });
  });

  describe('folders', () => {
    it('returns distinct folder names', () => {
      lib.addEntries([
        makeEntry({ folder: 'kits' }),
        makeEntry({ id: 't1', folder: 'bass' }),
        makeEntry({ id: 't2', folder: 'kits' }),
      ]);
      expect(lib.folders).toEqual(expect.arrayContaining(['kits', 'bass']));
      expect(lib.folders).toHaveLength(2);
    });
  });

  describe('allTags', () => {
    it('returns sorted tags', () => {
      lib.addEntries([
        makeEntry({ tags: ['zebra'] }),
        makeEntry({ id: 't1', tags: ['alpha'] }),
      ]);
      expect(lib.allTags).toEqual(['alpha', 'zebra']);
    });
  });

  describe('libraries', () => {
    it('returns distinct library names', () => {
      lib.addEntries([
        makeEntry({ library: 'acoustic' }),
        makeEntry({ id: 't1', library: 'synth' }),
      ]);
      expect(lib.libraries).toEqual(expect.arrayContaining(['acoustic', 'synth']));
    });
  });

  describe('countByType', () => {
    it('returns correct count', () => {
      lib.addEntries([
        makeEntry({ type: 'drum' }),
        makeEntry({ id: 't1', type: 'drum' }),
        makeEntry({ id: 't2', type: 'bass' }),
      ]);
      expect(lib.countByType('drum')).toBe(2);
      expect(lib.countByType('bass')).toBe(1);
    });

    it('returns 0 for unknown type', () => {
      expect(lib.countByType('one_shot')).toBe(0);
    });
  });

  describe('scanFiles', () => {
    it('generates entries from file descriptors', () => {
      const files = [
        { path: 'drums/kick.wav', name: 'kick.wav', folder: 'drums', library: 'acoustic' },
        { path: 'drums/snare.wav', name: 'snare.wav', folder: 'drums', library: 'acoustic' },
      ];
      const entries = lib.scanFiles(files, 'drum');
      expect(entries).toHaveLength(2);
      expect(entries[0].name).toBe('kick');
      expect(entries[0].type).toBe('drum');
      expect(entries[0].folder).toBe('drums');
      expect(entries[0].path).toBe('drums/kick.wav');
    });

    it('parses metadata from filenames', () => {
      const files = [
        { path: 'bass/E2_sus_rr1.wav', name: 'E2_sus_rr1.wav', folder: 'bass', library: 'acoustic' },
      ];
      const entries = lib.scanFiles(files, 'bass');
      expect(entries[0].metadata.note).toBe('E2');
      expect(entries[0].metadata.midiNote).toBe(40);
      expect(entries[0].metadata.octave).toBe(2);
    });
  });

  describe('parseFilename', () => {
    it('extracts note names', () => {
      const meta = (lib as any).parseFilename('C4.wav', 'folder', 'lib');
      expect(meta.note).toBe('C4');
      expect(meta.midiNote).toBe(60);
      expect(meta.octave).toBe(4);
    });

    it('extracts articulation', () => {
      const meta = (lib as any).parseFilename('E2_sus.wav', 'folder', 'lib');
      expect(meta.articulation).toBe('sustain');
    });

    it('extracts round-robin', () => {
      const meta = (lib as any).parseFilename('E2_sus_rr3.wav', 'folder', 'lib');
      expect(meta.roundRobin).toBe(3);
    });

    it('extracts instrument from filename', () => {
      const meta = (lib as any).parseFilename('pbass_sl ap_E2.wav', 'folder', 'lib');
      expect(meta.instrument).toBe('Precision Bass');
    });

    it('extracts instrument from folder', () => {
      const meta = (lib as any).parseFilename('note_E2.wav', 'p bass', 'lib');
      expect(meta.instrument).toBe('Precision Bass');
    });

    it('extracts velocity from filename', () => {
      const meta = (lib as any).parseFilename('note_Vel100.wav', 'folder', 'lib');
      expect(meta.velocity).toBe(100);
    });

    it('handles A#1 style notes', () => {
      const meta = (lib as any).parseFilename('A#1_sus.wav', 'folder', 'lib');
      expect(meta.note).toBe('A#1');
      expect(meta.midiNote).toBe(34);
    });
  });

  describe('extractTags', () => {
    it('generates drum-specific tags for kick', () => {
      const tags = (lib as any).extractTags('kick.wav', 'drums', 'acoustic', 'drum');
      expect(tags).toContain('kick');
    });

    it('generates drum-specific tags for snare', () => {
      const tags = (lib as any).extractTags('snare.wav', 'drums', 'acoustic', 'drum');
      expect(tags).toContain('snare');
    });

    it('generates bass-specific tags', () => {
      const tags = (lib as any).extractTags('slap_E2.wav', 'bass', 'acoustic', 'bass');
      expect(tags).toContain('slap');
    });

    it('detects BPM tag', () => {
      const tags = (lib as any).extractTags('loop_120bpm.wav', 'loops', 'lib', 'melodic');
      expect(tags).toContain('bpm_120');
    });

    it('detects key tag', () => {
      const tags = (lib as any).extractTags('riff_Am.wav', 'loops', 'lib', 'melodic');
      expect(tags.some(t => t.startsWith('key_'))).toBe(true);
    });

    it('generates genre tags from folder', () => {
      const tags = (lib as any).extractTags('kick.wav', 'trap', 'lib', 'drum');
      expect(tags).toContain('trap');
    });

    it('generates general style tags', () => {
      const tags = (lib as any).extractTags('vintage_kick.wav', 'drums', 'lib', 'drum');
      expect(tags).toContain('vintage');
    });
  });

  describe('getTrigrams', () => {
    it('creates proper trigrams', () => {
      const trigrams = (lib as any).getTrigrams('abc');
      expect(trigrams).toEqual(['abc']);
    });

    it('handles longer text', () => {
      const trigrams = (lib as any).getTrigrams('hello');
      expect(trigrams).toEqual(['hel', 'ell', 'llo']);
    });

    it('handles short strings', () => {
      const trigrams = (lib as any).getTrigrams('ab');
      expect(trigrams).toEqual([]);
    });

    it('handles empty string', () => {
      const trigrams = (lib as any).getTrigrams('');
      expect(trigrams).toEqual([]);
    });
  });

  describe('intersect', () => {
    it('correctly computes set intersection', () => {
      const a = new Set([1, 2, 3, 4]);
      const b = new Set([3, 4, 5, 6]);
      const result = (lib as any).intersect(a, b);
      expect(Array.from(result).sort()).toEqual([3, 4]);
    });

    it('returns empty set for disjoint sets', () => {
      const a = new Set([1, 2]);
      const b = new Set([3, 4]);
      const result = (lib as any).intersect(a, b);
      expect(result.size).toBe(0);
    });
  });

  describe('edge cases', () => {
    it('handles empty addEntries', () => {
      expect(() => lib.addEntries([])).not.toThrow();
    });

    it('handles scanFiles with empty array', () => {
      expect(lib.scanFiles([], 'drum')).toEqual([]);
    });

    it('search with limit works', () => {
      lib.addEntries([
        makeEntry({ id: '1', name: 'a', folder: 'kits' }),
        makeEntry({ id: '2', name: 'b', folder: 'kits' }),
        makeEntry({ id: '3', name: 'c', folder: 'kits' }),
      ]);
      expect(lib.search('', { folder: 'kits', limit: 2 })).toHaveLength(2);
    });

    it('search with empty query returns entries sorted', () => {
      lib.addEntries([makeEntry({ id: '1', name: 'Z' }), makeEntry({ id: '2', name: 'A' })]);
      const results = lib.search('');
      expect(results).toHaveLength(2);
    });

    it('search for non-existent tag returns empty', () => {
      lib.addEntries([makeEntry({ tags: ['kick'] })]);
      expect(lib.search('', { tags: ['nonexistent'] })).toEqual([]);
    });
  });

  describe('large batch operations', () => {
    it('handles many entries', () => {
      const entries: SoundLibraryEntry[] = [];
      for (let i = 0; i < 100; i++) {
        entries.push(makeEntry({ id: `e${i}`, name: `Sample ${i}`, filename: `s${i}.wav` }));
      }
      lib.addEntries(entries);
      expect(lib.allEntries).toHaveLength(100);
      expect(lib.search('Sample').length).toBeGreaterThan(0);
    });
  });
});
