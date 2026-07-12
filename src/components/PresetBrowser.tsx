import React, { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import { Search, Filter, Grid3X3, List, FolderOpen, Music, Play, RefreshCw } from 'lucide-react';
import { soundLibrary, SoundLibraryEntry } from '../lib/audio/soundLibrary';

interface PresetBrowserProps {
  type: 'bass' | 'drum' | 'one_shot' | 'melodic';
  onLoadEntry: (entry: SoundLibraryEntry) => void;
  /** Optional: pre-filter by folder/library */
  folder?: string;
  library?: string;
  /** Hide type filter when scoped to a single type */
  hideTypeFilter?: boolean;
}

export function PresetBrowser({ type, onLoadEntry, folder, library, hideTypeFilter }: PresetBrowserProps) {
  const [query, setQuery] = useState('');
  const [activeType, setActiveType] = useState<string>(type);
  const [activeFolder, setActiveFolder] = useState<string>(folder || '');
  const [activeTags, setActiveTags] = useState<string[]>([]);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const searchRef = useRef<HTMLInputElement>(null);

  const entries = useMemo(() => soundLibrary.search(query, {
    type: activeType as any,
    folder: activeFolder || undefined,
    tags: activeTags.length > 0 ? activeTags : undefined,
    limit: 200,
  }), [query, activeType, activeFolder, activeTags]);

  const folders = useMemo(() => soundLibrary.folders, []);
  const allTags = useMemo(() => soundLibrary.allTags, []);

  const suggestedTags = useMemo(() => {
    if (!query.trim()) return [];
    const q = query.toLowerCase();
    return allTags.filter(t => t.includes(q)).slice(0, 8);
  }, [query, allTags]);

  const countsByType = useMemo(() => {
    if (hideTypeFilter) return null;
    return {
      bass: soundLibrary.countByType('bass'),
      drum: soundLibrary.countByType('drum'),
      one_shot: soundLibrary.countByType('one_shot'),
      melodic: soundLibrary.countByType('melodic'),
    };
  }, []);

  const totalSamples = useMemo(() => soundLibrary.allEntries.length, []);

  return (
    <div className="flex flex-col h-full">
      {/* Search Bar */}
      <div className="relative mb-3">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
        <input
          ref={searchRef}
          type="text"
          value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder={`Search ${totalSamples} samples...`}
          className="w-full bg-black/60 border border-white/10 rounded-xl pl-9 pr-4 py-2.5 text-xs text-white font-mono focus:outline-none focus:border-orange-500/50"
        />
        {suggestedTags.length > 0 && (
          <div className="absolute top-full left-0 right-0 mt-1 bg-[#0a0a0c] border border-white/10 rounded-xl shadow-2xl z-50 p-2 flex flex-wrap gap-1">
            {suggestedTags.map(t => (
              <button
                key={t}
                onClick={() => { setQuery(''); setActiveTags(prev => prev.includes(t) ? prev : [...prev, t]); }}
                className="px-2 py-0.5 rounded bg-white/5 border border-white/10 text-[9px] font-mono text-slate-400 hover:text-orange-400 transition-colors"
              >
                {t.replace(/_/g, ' ')}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Filter Bar */}
      <div className="flex items-center gap-2 mb-3 flex-wrap">
        {!hideTypeFilter && countsByType && (
          <div className="flex gap-1 bg-black/30 p-0.5 rounded-lg border border-white/5">
            {(['bass', 'drum', 'one_shot', 'melodic'] as const).map(t => (
              <button
                key={t}
                onClick={() => setActiveType(t)}
                className={`px-2.5 py-1 rounded-md text-[9px] font-mono font-bold uppercase tracking-wider transition-all ${
                  activeType === t
                    ? 'bg-orange-500/20 text-orange-400 border border-orange-500/30'
                    : 'text-slate-500 hover:text-white'
                }`}
              >
                {t.replace('_', ' ')} ({countsByType[t]})
              </button>
            ))}
          </div>
        )}

        <div className="flex-1" />

        <select
          value={activeFolder}
          onChange={e => setActiveFolder(e.target.value)}
          className="bg-black/40 border border-white/10 rounded-lg px-2 py-1 text-[9px] font-mono text-slate-400 focus:outline-none focus:border-orange-500/50"
        >
          <option value="">All Folders</option>
          {folders.map(f => (
            <option key={f} value={f}>{f}</option>
          ))}
        </select>

        <button
          onClick={() => setViewMode(v => v === 'grid' ? 'list' : 'grid')}
          className="p-1.5 rounded-lg border border-white/10 text-slate-500 hover:text-white"
        >
          {viewMode === 'grid' ? <List size={14} /> : <Grid3X3 size={14} />}
        </button>

        {activeTags.length > 0 && (
          <button
            onClick={() => setActiveTags([])}
            className="px-2 py-1 rounded-lg border border-red-500/20 text-[9px] font-mono text-red-400"
          >
            Clear filters
          </button>
        )}
      </div>

      {/* Active Tags */}
      {activeTags.length > 0 && (
        <div className="flex flex-wrap gap-1 mb-3">
          {activeTags.map(t => (
            <span key={t} className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-orange-500/10 border border-orange-500/20 text-[8px] font-mono text-orange-400">
              {t.replace(/_/g, ' ')}
              <button onClick={() => setActiveTags(prev => prev.filter(x => x !== t))} className="hover:text-white">×</button>
            </span>
          ))}
        </div>
      )}

      {/* Results */}
      <div className="flex-1 overflow-y-auto custom-scrollbar">
        {entries.length === 0 && (
          <div className="flex flex-col items-center justify-center py-12 text-slate-600">
            <Music size={32} className="opacity-30 mb-3" />
            <p className="text-xs font-mono">No samples found</p>
            <p className="text-[9px] font-mono mt-1">Import a sound library to get started</p>
          </div>
        )}

        {entries.length > 0 && (
          viewMode === 'grid' ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-2">
              {entries.map(entry => (
                <button
                  key={entry.id}
                  onClick={() => onLoadEntry(entry)}
                  className="group bg-black/30 border border-white/5 hover:border-orange-500/30 rounded-xl p-3 text-left transition-all hover:bg-orange-500/5"
                >
                  <div className="flex items-center gap-2 mb-1">
                    <Play size={10} className="text-orange-400 opacity-0 group-hover:opacity-100 transition-opacity" />
                    <span className="text-[10px] font-mono text-slate-400 truncate flex-1">
                      {entry.name.length > 20 ? entry.name.slice(0, 20) + '…' : entry.name}
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {entry.tags.slice(0, 3).map(t => (
                      <span key={t} className="px-1 py-0.5 rounded bg-white/5 text-[7px] font-mono text-slate-600">
                        {t.replace(/_/g, ' ')}
                      </span>
                    ))}
                  </div>
                  {entry.metadata.note && (
                    <span className="mt-1 block text-[8px] font-mono text-orange-400/60">{entry.metadata.note}</span>
                  )}
                  {entry.metadata.instrument && (
                    <span className="block text-[7px] font-mono text-slate-600">{entry.metadata.instrument}</span>
                  )}
                </button>
              ))}
            </div>
          ) : (
            <div className="space-y-0.5">
              {entries.map(entry => (
                <button
                  key={entry.id}
                  onClick={() => onLoadEntry(entry)}
                  className="w-full flex items-center gap-3 px-3 py-2 rounded-xl hover:bg-white/5 transition-colors text-left"
                >
                  <Play size={10} className="text-orange-400 shrink-0" />
                  <span className="text-[11px] font-mono text-slate-300 flex-1 truncate">{entry.name}</span>
                  <span className="text-[8px] font-mono text-slate-600">{entry.metadata.note || '—'}</span>
                  <span className="text-[8px] font-mono text-slate-600">{entry.folder}</span>
                </button>
              ))}
            </div>
          )
        )}
      </div>
    </div>
  );
}
