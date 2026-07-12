/**
 * Sound Library Indexer & Semantic Search Engine
 *
 * Scans folders of audio files, builds a searchable index using
 * character trigrams + keyword extraction, and provides a unified
 * preset browser interface for drums, bass, and one-shot samplers.
 */

export interface SoundLibraryEntry {
  id: string;
  name: string;
  filename: string;
  path: string;
  folder: string;
  library: string;         // top-level library folder name
  type: 'bass' | 'drum' | 'one_shot' | 'melodic';
  tags: string[];          // extracted keywords
  metadata: {
    note?: string;         // parsed note name (e.g., "A2")
    midiNote?: number;     // parsed MIDI note
    articulation?: string; // playing style
    instrument?: string;   // instrument name
    octave?: number;
    velocity?: number;     // 0-127
    roundRobin?: number;   // RR index
    bpm?: number;          // if detectable
    key?: string;          // musical key
  };
}

interface TrigramIndex {
  [trigram: string]: Set<number>;
}

export class SoundLibrary {
  private entries: SoundLibraryEntry[] = [];
  private trigramIndex: TrigramIndex = {};
  private keywordIndex: Map<string, Set<number>> = new Map();
  private typeIndex: Map<string, number[]> = new Map();
  private folderIndex: Map<string, number[]> = new Map();

  get allEntries() { return this.entries; }

  /** Register a batch of library entries */
  addEntries(newEntries: SoundLibraryEntry[]) {
    const startIdx = this.entries.length;
    for (let i = 0; i < newEntries.length; i++) {
      const entry = newEntries[i];
      const idx = startIdx + i;
      this.entries.push(entry);
      // Index type
      if (!this.typeIndex.has(entry.type)) this.typeIndex.set(entry.type, []);
      this.typeIndex.get(entry.type)!.push(idx);
      // Index folder
      if (!this.folderIndex.has(entry.folder)) this.folderIndex.set(entry.folder, []);
      this.folderIndex.get(entry.folder)!.push(idx);
      // Trigram index on name + tags + filename
      const searchText = `${entry.name} ${entry.filename} ${entry.tags.join(' ')} ${entry.library} ${entry.folder}`.toLowerCase();
      this.indexTrigrams(searchText, idx);
      // Keyword index
      for (const tag of entry.tags) {
        const key = tag.toLowerCase();
        if (!this.keywordIndex.has(key)) this.keywordIndex.set(key, new Set());
        this.keywordIndex.get(key)!.add(idx);
      }
    }
  }

  /** Scan an array of file descriptors and auto-generate entries */
  scanFiles(
    files: Array<{ path: string; name: string; folder: string; library: string }>,
    type: SoundLibraryEntry['type']
  ): SoundLibraryEntry[] {
    return files.map((f, idx) => {
      const metadata = this.parseFilename(f.name, f.folder, f.library);
      const tags = this.extractTags(f.name, f.folder, f.library, type);
      return {
        id: `${type}_${idx}_${Date.now()}`,
        name: f.name.replace(/\.[^.]+$/, ''),
        filename: f.name,
        path: f.path,
        folder: f.folder,
        library: f.library,
        type,
        tags,
        metadata,
      };
    });
  }

  /** Semantic search: combine trigram + keyword + type filters */
  search(query: string, filters?: {
    type?: SoundLibraryEntry['type'];
    folder?: string;
    library?: string;
    tags?: string[];
    limit?: number;
  }): SoundLibraryEntry[] {
    const searchStr = query.toLowerCase().trim();
    if (!searchStr && !filters?.type && !filters?.folder && !filters?.tags?.length) {
      return this.entries;
    }

    let candidates: Set<number> | null = null;

    // Filter by type first
    if (filters?.type) {
      const typeIds = this.typeIndex.get(filters.type);
      if (!typeIds) return [];
      candidates = new Set(typeIds);
    }

    // Filter by folder
    if (filters?.folder) {
      const folderIds = this.folderIndex.get(filters.folder);
      if (!folderIds) return [];
      const folderSet = new Set(folderIds);
      candidates = candidates ? this.intersect(candidates, folderSet) : folderSet;
    }

    // Filter by additional tags
    if (filters?.tags?.length) {
      const tagSets = filters.tags.map(t => this.keywordIndex.get(t.toLowerCase()) || new Set<number>());
      let tagUnion = new Set<number>();
      for (const s of tagSets) s.forEach(v => tagUnion.add(v));
      candidates = candidates ? this.intersect(candidates, tagUnion) : tagUnion;
    }

    // If no query string, return candidates sorted by name
    if (!searchStr) {
      let result = candidates ? Array.from(candidates).map(i => this.entries[i]) : [...this.entries];
      if (filters?.limit) result = result.slice(0, filters.limit);
      return result;
    }

    // Score candidates by trigram similarity
    const queryTrigrams = this.getTrigrams(searchStr);
    if (queryTrigrams.length === 0) {
      let result = candidates ? Array.from(candidates).map(i => this.entries[i]) : [...this.entries];
      if (filters?.limit) result = result.slice(0, filters.limit);
      return result;
    }

    const scored: Array<{ idx: number; score: number }> = [];
    const searchSpace = candidates || new Set(Array.from({ length: this.entries.length }, (_, i) => i));

    for (const idx of searchSpace) {
      let matchCount = 0;
      for (const tri of queryTrigrams) {
        if (this.trigramIndex[tri]?.has(idx)) matchCount++;
      }
      const score = matchCount / queryTrigrams.length;
      if (score > 0) scored.push({ idx, score });
    }

    scored.sort((a, b) => b.score - a.score);
    let result = scored.map(s => this.entries[s.idx]);
    if (filters?.limit) result = result.slice(0, filters.limit);
    return result;
  }

  /** Get all distinct folder names */
  get folders(): string[] {
    return Array.from(this.folderIndex.keys());
  }

  /** Get all distinct libraries */
  get libraries(): string[] {
    return [...new Set(this.entries.map(e => e.library))];
  }

  /** Get all distinct tags */
  get allTags(): string[] {
    return Array.from(this.keywordIndex.keys()).sort();
  }

  /** Count entries by type */
  countByType(type: SoundLibraryEntry['type']): number {
    return this.typeIndex.get(type)?.length || 0;
  }

  private parseFilename(
    name: string, folder: string, library: string
  ): SoundLibraryEntry['metadata'] {
    const meta: SoundLibraryEntry['metadata'] = {};
    const lower = name.toLowerCase();
    const stem = name.replace(/\.[^.]+$/, '');

    // Note name detection: match patterns like a2, C#3, eb1, F-2
    const noteMatch = stem.match(/(?:^|[_\s-])([A-Ga-g][#b]?)(-?\d+)(?:$|[_\s.])/);
    if (noteMatch) {
      const noteNames = ['C','C#','D','D#','E','F','F#','G','G#','A','A#','B'];
      const pc = noteNames.indexOf(noteMatch[1].charAt(0).toUpperCase() + (noteMatch[1].slice(1) || ''));
      if (pc !== -1) {
        const octave = parseInt(noteMatch[2], 10);
        meta.note = noteMatch[1].toUpperCase() + noteMatch[2];
        meta.midiNote = pc + (octave + 1) * 12;
        meta.octave = octave;
      }
    }

    // Articulation detection
    const artMap: Record<string, string> = {
      pick: 'pick', finger: 'finger', slap: 'slap', pop: 'pop',
      sus: 'sustain', stac: 'staccato', pm: 'palm_mute', harm: 'harmonic',
      muted: 'muted', slide: 'slide', hammer: 'hammer_on', pull: 'pull_off',
      buzz: 'buzz', overdrive: 'overdrive', dist: 'distortion', fx: 'fx',
    };
    for (const [pat, art] of Object.entries(artMap)) {
      if (stem.toLowerCase().includes(pat)) {
        meta.articulation = art;
        break;
      }
    }

    // Instrument detection
    const instMap: Record<string, string> = {
      'p-bass': 'Precision Bass', 'pbass': 'Precision Bass', 'p_bass': 'Precision Bass',
      'j-bass': 'Jazz Bass', 'jbass': 'Jazz Bass', 'j_bass': 'Jazz Bass',
      jazz: 'Jazz Bass', precision: 'Precision Bass',
      synth: 'Synth Bass', sub: 'Sub Bass', reese: 'Reese Bass',
      live: 'Live Bass', acoustic: 'Acoustic Bass', upright: 'Upright Bass',
    };
    for (const [pat, inst] of Object.entries(instMap)) {
      if (lower.includes(pat)) { meta.instrument = inst; break; }
    }

    // Folder-based instrument inference
    if (!meta.instrument) {
      if (folder.toLowerCase().includes('p bass')) meta.instrument = 'Precision Bass';
      else if (folder.toLowerCase().includes('jazz')) meta.instrument = 'Jazz Bass';
      else if (folder.toLowerCase().includes('live')) meta.instrument = 'Live Bass';
    }

    // Round-robin detection
    const rrMatch = stem.match(/[Rr][Rr](\d+)/);
    if (rrMatch) meta.roundRobin = parseInt(rrMatch[1], 10);

    // Velocity from filename (some Kontakt libs encode it)
    const velMatch = stem.match(/[Vv]el(\d+)/i) || stem.match(/[Vv](\d{2,3})$/);
    if (velMatch) meta.velocity = parseInt(velMatch[1], 10);

    return meta;
  }

  private extractTags(
    name: string, folder: string, library: string, type: SoundLibraryEntry['type']
  ): string[] {
    const tags = new Set<string>();
    const lower = name.toLowerCase();
    const stem = name.replace(/\.[^.]+$/, '');

    // Source library
    tags.add(library.toLowerCase().replace(/[^a-z0-9]+/g, '_'));

    // Drum-specific tags from folder/filename patterns
    if (type === 'drum') {
      const drumTypes = [
        { pat: ['kick', 'bd', 'bdr', 'kik'], tag: 'kick' },
        { pat: ['snare', 'snr', 'sd', 'sdr'], tag: 'snare' },
        { pat: ['hat', 'hh', 'hcr', 'hor', 'hi-hat', 'hihat'], tag: 'hihat' },
        { pat: ['clap', 'cp'], tag: 'clap' },
        { pat: ['tom', 'tm'], tag: 'tom' },
        { pat: ['crash', 'cr', 'crash'], tag: 'crash' },
        { pat: ['ride', 'rd'], tag: 'ride' },
        { pat: ['perc', 'per'], tag: 'percussion' },
        { pat: ['shaker', 'shake'], tag: 'shaker' },
        { pat: ['rim', 'rimshot'], tag: 'rim' },
        { pat: ['clave'], tag: 'clave' },
        { pat: ['cowbell'], tag: 'cowbell' },
        { pat: ['808', '909', '707', '727'], tag: 'machine_drum' },
      ];
      for (const d of drumTypes) {
        if (d.pat.some(p => lower.includes(p))) { tags.add(d.tag); break; }
      }
      // Genre/style tags from folder names
      const genres = ['trap', 'boom_bap', 'drill', 'house', 'techno', 'funk', 'rnb', 'hip_hop', 'lo_fi', 'pop'];
      for (const g of genres) {
        if (lower.includes(g) || folder.toLowerCase().includes(g)) tags.add(g);
      }
    }

    // Style/technique tags for bass
    if (type === 'bass') {
      const styles = ['pick', 'finger', 'slap', 'pop', 'slide', 'harm', 'muted', 'fx', 'buzz', 'overdrive', 'distortion', 'sub', 'reese'];
      for (const s of styles) {
        if (lower.includes(s)) tags.add(s);
      }
    }

    // General tags
    const general = ['vintage', 'modern', 'acoustic', 'electric', 'analog', 'digital', 'warm', 'bright', 'dark', 'punchy', 'soft', 'hard', 'live', 'studio', 'processed', 'dry', 'wet', 'ambient', 'cinematic'];
    for (const g of general) {
      if (lower.includes(g)) tags.add(g);
    }

    // BPM detection
    const bpmMatch = stem.match(/(\d{3})bpm/) || stem.match(/bpm(\d{3})/);
    if (bpmMatch) tags.add(`bpm_${bpmMatch[1]}`);

    // Key detection
    const keyMatch = stem.match(/[A-G][#b]?(m|maj|min)?$/);
    if (keyMatch) tags.add(`key_${keyMatch[0].toLowerCase()}`);

    return Array.from(tags);
  }

  private indexTrigrams(text: string, idx: number) {
    const trigrams = this.getTrigrams(text);
    for (const tri of trigrams) {
      if (!this.trigramIndex[tri]) this.trigramIndex[tri] = new Set();
      this.trigramIndex[tri].add(idx);
    }
  }

  private getTrigrams(text: string): string[] {
    const cleaned = text.replace(/[^a-z0-9\s-]/g, ' ').replace(/\s+/g, ' ');
    const trigrams: string[] = [];
    for (let i = 0; i < cleaned.length - 2; i++) {
      trigrams.push(cleaned.slice(i, i + 3));
    }
    return trigrams;
  }

  private intersect(a: Set<number>, b: Set<number>): Set<number> {
    const result = new Set<number>();
    for (const v of a) if (b.has(v)) result.add(v);
    return result;
  }
}

export const soundLibrary = new SoundLibrary();
