import React, { memo } from 'react';

const STRING_MIDI = [43, 38, 33, 28]; // G, D, A, E
const FRET_COUNT = 13;

function getMidiNoteName(midi: number): string {
  const notes = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
  const octave = Math.floor(midi / 12) - 1;
  return `${notes[midi % 12]}${octave}`;
}

interface FretboardProps {
  tuningCoarse: number;
  onPlayNote: (stringIndex: number, fret: number) => void;
}

export const Fretboard = memo(({ tuningCoarse, onPlayNote }: FretboardProps) => {
  const [showAllNotes, setShowAllNotes] = React.useState(false);

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <button
          onClick={() => setShowAllNotes(!showAllNotes)}
          className={`text-[10px] uppercase font-bold tracking-widest px-3 py-1 rounded-full border transition-all ${
            showAllNotes 
              ? 'bg-orange-500 border-orange-400 text-black shadow-[0_0_10px_rgba(249,115,22,0.3)]' 
              : 'bg-white/5 border-white/10 text-slate-400 hover:text-white'
          }`}
        >
          {showAllNotes ? 'Hide Notes' : 'Show All Notes'}
        </button>
      </div>

      <div className="relative h-20 sm:h-28 bg-gradient-to-r from-[#2c130d] via-[#1c0a06] to-[#0c0301] border-4 border-black rounded-xl overflow-hidden shadow-[inset_0_4px_20px_rgba(0,0,0,0.9),0_10px_25px_rgba(0,0,0,0.6)] flex flex-col justify-between py-2 select-none">
        <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/black-thread-light.png')] opacity-15 pointer-events-none" aria-hidden="true" />
        
        {/* Frets and position markers */}
        <div className="absolute inset-0 flex pointer-events-none" aria-hidden="true">
          {Array.from({ length: FRET_COUNT }).map((_, fretIndex) => {
            const leftPercent = (fretIndex / (FRET_COUNT - 1)) * 100;
            return (
              <React.Fragment key={fretIndex}>
                {fretIndex > 0 && (
                  <div 
                    className="absolute top-0 bottom-0 w-[2px] sm:w-[3px] bg-gradient-to-r from-zinc-400 via-zinc-200 to-zinc-500 shadow-[1px_0_3px_rgba(0,0,0,0.5)] border-r border-black/40"
                    style={{ left: `${leftPercent}%` }}
                  />
                )}
                {[3, 5, 7, 9].includes(fretIndex) && (
                  <div 
                    className="absolute w-2 h-2 sm:w-3.5 sm:h-3.5 rounded-full bg-zinc-100/10 border border-zinc-100/5 shadow-[inset_0_1px_3px_rgba(0,0,0,0.8),0_2px_4px_rgba(0,0,0,0.4)] top-1/2 -translate-y-1/2"
                    style={{ left: `calc(${leftPercent - (100 / (FRET_COUNT - 1) / 2)}%)` }}
                  />
                )}
                {fretIndex === 12 && (
                  <div className="absolute top-0 bottom-0 flex flex-col justify-around py-2 sm:py-3" style={{ left: `calc(${leftPercent - (100 / (FRET_COUNT - 1) / 2)}%)` }}>
                    <div className="w-1.5 h-1.5 sm:w-2.5 sm:h-2.5 rounded-full bg-zinc-100/10 border border-zinc-100/5 shadow-[inset_0_1px_3px_rgba(0,0,0,0.8)]" />
                    <div className="w-1.5 h-1.5 sm:w-2.5 sm:h-2.5 rounded-full bg-zinc-100/10 border border-zinc-100/5 shadow-[inset_0_1px_3px_rgba(0,0,0,0.8)]" />
                  </div>
                )}
              </React.Fragment>
            );
          })}
        </div>

        {/* Strings and fret buttons */}
        {[0, 1, 2, 3].map((stringIdx) => {
          const thicknesses = ['h-[1px] sm:h-[1.5px]', 'h-[2px] sm:h-[2.5px]', 'h-[3px] sm:h-[3.5px]', 'h-[4px] sm:h-[4.5px]'];
          return (
            <div key={stringIdx} className="h-4 sm:h-5 flex items-center relative group/string w-full">
              <div className={`absolute left-0 right-0 ${thicknesses[stringIdx]} bg-gradient-to-b from-zinc-300 via-zinc-100 to-zinc-400 shadow-[0_2px_4px_rgba(0,0,0,0.7)] group-hover/string:brightness-125 z-10 transition-all`} aria-hidden="true" />
              <div className="absolute left-0 top-0 bottom-0 w-3 bg-amber-100/30 border-r border-black z-20" aria-hidden="true" />
              
              <div className="absolute inset-0 flex z-30">
                {Array.from({ length: FRET_COUNT }).map((_, fretIndex) => {
                  const midi = STRING_MIDI[stringIdx] + fretIndex + tuningCoarse;
                  const noteName = getMidiNoteName(midi);
                  return (
                    <button
                      key={fretIndex}
                      type="button"
                      onClick={() => onPlayNote(stringIdx, fretIndex)}
                      className="flex-1 h-full hover:bg-amber-400/10 active:bg-orange-500/20 relative transition-colors group/fret focus:outline-none focus:ring-2 focus:ring-orange-400 focus:ring-offset-2 focus:ring-offset-black/50 rounded-sm"
                      title={`Play ${noteName}`}
                      aria-label={`Play ${noteName} on string ${stringIdx + 1}, fret ${fretIndex}`}
                    >
                      <span className={`absolute inset-0 flex items-center justify-center text-[7px] sm:text-[8px] font-mono font-bold text-orange-400 bg-black/60 backdrop-blur-xs rounded pointer-events-none transition-opacity ${
                        showAllNotes ? 'opacity-100' : 'opacity-0 group-hover/fret:opacity-100 group-focus/fret:opacity-100'
                      }`}>
                        {noteName}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
});

Fretboard.displayName = 'Fretboard';
