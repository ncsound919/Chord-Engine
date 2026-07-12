import React, { memo } from 'react';
import { BassSampler, BassArticulation, ARTICULATION_NAMES } from '../../lib/audio/bassSampler';

interface BassSampleMapProps {
  sampler: BassSampler;
  currentArticulation: BassArticulation;
  onArticulationChange: (a: BassArticulation) => void;
}

const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

function noteName(midi: number): string {
  return NOTE_NAMES[midi % 12] + Math.floor(midi / 12 - 1);
}

export const BassSampleMap = memo(({
  sampler,
  currentArticulation,
  onArticulationChange,
}: BassSampleMapProps) => {
  const notes = sampler.loadedNotes;
  const articulations = sampler.loadedArticulations;
  const entries = sampler.loadedEntries;

  if (!sampler.loaded) {
    return (
      <div className="rounded-xl border border-dashed border-white/10 bg-black/20 p-6 text-center font-mono text-xs text-slate-500">
        No multisamples loaded. Upload bass samples to build a Kontakt-style instrument.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Articulation Key Switches */}
      {articulations.length > 1 && (
        <div>
          <span className="text-[9px] font-mono font-bold text-slate-500 uppercase tracking-widest block mb-2">
            Articulation
          </span>
          <div className="flex flex-wrap gap-1.5">
            {articulations.map(art => {
              const count = entries.filter(e => e.articulation === art).length;
              return (
                <button
                  key={art}
                  onClick={() => onArticulationChange(art)}
                  className={`px-3 py-1.5 rounded-lg text-[10px] font-mono font-bold uppercase tracking-wider transition-all border ${
                    currentArticulation === art
                      ? 'bg-orange-500 border-orange-400 text-black shadow-[0_0_10px_rgba(249,115,22,0.3)]'
                      : 'bg-black/40 border-white/10 text-slate-400 hover:text-white hover:border-orange-500/40'
                  }`}
                >
                  {ARTICULATION_NAMES[art]}
                  <span className="ml-1.5 text-[8px] opacity-60">({count})</span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Sample Map Grid */}
      <div>
        <span className="text-[9px] font-mono font-bold text-slate-500 uppercase tracking-widest block mb-2">
          Sample Map — {currentArticulation}
        </span>
        <div className="bg-black/40 border border-white/5 rounded-xl p-3 overflow-x-auto">
          <div className="flex gap-2 min-w-[400px]">
            {notes.map(note => {
              const noteEntries = entries.filter(
                e => e.note === note && e.articulation === currentArticulation
              );
              const velocityLayers = [...new Set(noteEntries.map(e => e.velocity))].sort((a, b) => a - b);
              const rrCount = noteEntries.length;

              return (
                <div key={note} className="flex flex-col items-center gap-1 min-w-[40px]">
                  <span className="text-[9px] font-mono font-bold text-orange-400">
                    {noteName(note)}
                  </span>
                  <div className="flex flex-col gap-0.5 w-full">
                    {velocityLayers.map(v => {
                      const layerEntries = noteEntries.filter(e => e.velocity === v);
                      const isLoaded = layerEntries.some(e => e.buffer !== null);
                      return (
                        <div
                          key={`${note}-${v}`}
                          className={`h-3 rounded-sm border ${
                            isLoaded
                              ? 'bg-emerald-500/30 border-emerald-500/40'
                              : 'bg-red-500/10 border-red-500/20'
                          }`}
                          title={`${noteName(note)} · vel ${v} · ${layerEntries.length} RR`}
                        />
                      );
                    })}
                  </div>
                  {rrCount > 0 && (
                    <span className="text-[7px] font-mono text-slate-600">
                      {rrCount} RR
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Legend */}
      <div className="flex items-center gap-4 text-[8px] font-mono text-slate-600">
        <span className="flex items-center gap-1">
          <span className="w-2 h-2 rounded-sm bg-emerald-500/30 border border-emerald-500/40" />
          Loaded
        </span>
        <span className="flex items-center gap-1">
          <span className="w-2 h-2 rounded-sm bg-red-500/10 border border-red-500/20" />
          Missing
        </span>
      </div>
    </div>
  );
});
