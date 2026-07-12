import React, { useState, useEffect, useCallback, useMemo, useId, useRef } from 'react';
import { Play, Square, Trash2, ZoomIn, ZoomOut, Save, FolderOpen, Maximize2, Minimize2 } from 'lucide-react';
import { audioEngine, transport } from '../../lib/audio/engine';
import { useTransport } from '../../hooks/useTransport';
import { DrumStyle } from '../../theory/rhythmicReframer';
import { STEPS, DRUM_DEFINITIONS, PRESET_TYPES } from './RhythmGrid/constants';
import { useDrumSynths } from './RhythmGrid/useDrumSynths';
import { useDrumGrid } from './RhythmGrid/useDrumGrid';
import { StepButton } from './RhythmGrid/StepButton';

export function RhythmGrid() {
  const { isPlaying, togglePlay, tempo, setTempo } = useTransport();
  const { triggerSynth } = useDrumSynths();
  const { 
    grid, 
    setGrid, 
    presets, 
    activePreset, 
    toggleStep, 
    clearGrid, 
    loadPresetPattern, 
    saveUserPreset 
  } = useDrumGrid();
  
  const swingId = useId();
  const ghostId = useId();
  const tempoId = useId();
  const gridContainerRef = useRef<HTMLDivElement>(null);

  const [currentStep, setCurrentStep] = useState(0);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isZoomed, setIsZoomed] = useState(false);
  const [showPresets, setShowPresets] = useState(false);
  const [swing, setSwing] = useState(50);
  const [ghostNotes, setGhostNotes] = useState(0);

  // Sync scroll with current step
  useEffect(() => {
    if (isPlaying && gridContainerRef.current) {
      const stepWidth = 34; // 2.125rem
      const trackWidth = 96; // 6rem
      const padding = 24; // 1.5rem
      const scrollPosition = (currentStep * stepWidth) + trackWidth + padding - (gridContainerRef.current.clientWidth / 2);
      
      gridContainerRef.current.scrollTo({
        left: Math.max(0, scrollPosition),
        behavior: 'smooth'
      });
    }
  }, [currentStep, isPlaying]);

  // Sync step advance and playback with Tone.Transport
  useEffect(() => {
    const handleBeat = (beat: number, time: number) => {
      const step = Math.floor(beat * 4) % STEPS;
      setCurrentStep(step);

      // Swing logic: delay odd 16th notes
      let playTime = time;
      if (step % 2 === 1 && swing > 50) {
        const sixteenthDuration = 60 / (tempo * 4);
        const swingOffset = (swing / 100 - 0.5) * sixteenthDuration * 0.66;
        playTime += swingOffset;
      }

      DRUM_DEFINITIONS.forEach(drum => {
        let shouldPlay = grid[drum.id] && grid[drum.id][step];
        
        // Ghost notes logic
        if (!shouldPlay && ghostNotes > 0 && Math.random() < (ghostNotes / 400)) {
          shouldPlay = true;
        }

        if (shouldPlay) {
          const buffer = audioEngine.loadedSamples.get(drum.sampleName);
          const track = audioEngine.tracks.get('drums');
          
          if (track) {
            if (buffer) {
              track.playBuffer(buffer, playTime);
            } else {
              triggerSynth(drum.id, playTime);
            }
          }
        }
      });
    };
    const unsubscribe = transport.addBeatCallback(handleBeat);
    return unsubscribe;
  }, [grid, tempo, swing, ghostNotes, triggerSynth]);

  const stepNumbersHeader = useMemo(() => (
    <div className="flex items-center gap-1 mb-2 sticky top-0 bg-black/60 backdrop-blur-md z-30 py-2 border-b border-white/5 rounded-t-xl px-2">
      <div className="w-24 flex-shrink-0 text-[10px] font-bold text-slate-400 uppercase tracking-widest pl-2">Track</div>
      {Array.from({ length: STEPS }).map((_, i) => {
        const isAccent = i % 4 === 0;
        return (
          <div key={i} className={`w-8 text-center text-[10px] font-mono ${isAccent ? 'text-orange-400 font-bold' : 'text-slate-500'}`} aria-hidden="true">
            {isAccent ? `${(i / 4) + 1}` : `${i + 1}`}
          </div>
        );
      })}
    </div>
  ), []);

  // Main layout render structure
  const gridContent = (
    <div className={`flex flex-col relative h-full ${isFullscreen ? 'p-8 bg-[#0a0a0c]' : ''}`}>
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-4 border-b border-white/5 pb-4 mb-6 shrink-0">
        <div>
          <div className="flex items-center gap-3">
            <h2 className="text-3xl font-serif italic text-white flex items-center gap-3">
              Rhythm Grid
            </h2>
            <button
              onClick={() => setIsFullscreen(!isFullscreen)}
              className="p-1.5 rounded-lg bg-white/5 border border-white/10 text-slate-400 hover:text-white hover:bg-white/10 transition-all flex items-center gap-1 text-[10px] font-mono uppercase font-bold"
              aria-label={isFullscreen ? "Exit Full Screen" : "Enter Full Screen"}
            >
              {isFullscreen ? <Minimize2 size={12} /> : <Maximize2 size={12} />}
              <span>{isFullscreen ? "Normal" : "Fullscreen"}</span>
            </button>
            <button
              onClick={() => setIsZoomed(!isZoomed)}
              className={`p-1.5 rounded-lg border transition-all flex items-center gap-1 text-[10px] font-mono uppercase font-bold ${
                isZoomed 
                  ? 'bg-orange-500/20 text-orange-400 border-orange-500/35 shadow-[0_0_10px_rgba(249,115,22,0.15)] font-extrabold' 
                  : 'bg-white/5 border-white/10 text-slate-400 hover:text-white hover:bg-white/10'
              }`}
              aria-label={isZoomed ? "Exit Grid Edit Mode" : "Focus / Zoom Grid Edit Mode"}
            >
              {isZoomed ? <ZoomOut size={12} /> : <ZoomIn size={12} />}
              <span>{isZoomed ? "Exit Zoom" : "Zoom Grid"}</span>
            </button>
          </div>
          <p className="text-[10px] tracking-widest font-bold opacity-40 uppercase mt-1 text-orange-400">
            {isZoomed ? "Zoomed Grid Edit Mode Active" : isFullscreen ? "Full Scale Hardware Sequencer" : "Player Audition Sequencer"}
          </p>
        </div>
        
        <div className="flex flex-wrap gap-2 items-center" role="toolbar" aria-label="Pattern controls">
           <span className="text-[10px] uppercase font-bold text-slate-400 mr-2 tracking-widest">Presets:</span>
           {PRESET_TYPES.map(({ type, label }) => {
             const isActive = activePreset === type;
             return (
               <button
                 key={type}
                 onClick={() => loadPresetPattern(type)}
                 aria-pressed={isActive}
                 className={`px-4 py-1.5 border rounded-full text-xs font-bold transition-all ${
                   isActive
                     ? 'border-orange-500 bg-orange-500 text-black shadow-[0_0_15px_rgba(249,115,22,0.4)] scale-105 font-black'
                     : 'border-orange-500/30 bg-gradient-to-b from-orange-500/10 to-orange-600/5 text-orange-400 hover:from-orange-500/25 hover:to-orange-600/15 shadow-[0_0_10px_rgba(249,115,22,0.1)]'
                 }`}
               >
                 {label}
               </button>
             );
           })}
           <div className="w-px h-6 bg-white/20 mx-2"></div>
           <button 
             onClick={clearGrid} 
             className="px-3 py-1.5 border border-red-500/30 text-red-400 rounded-full text-xs font-bold bg-black/20 hover:bg-red-500/10 transition-colors flex items-center gap-1"
             aria-label="Clear all steps"
           >
             <Trash2 size={11} /> Clear
           </button>
           <div className="w-px h-6 bg-white/20 mx-1"></div>
           <button 
             onClick={saveUserPreset} 
             className="p-2 bg-white/5 border border-white/10 rounded-full text-slate-400 hover:text-orange-400 focus:outline-none focus:ring-2 focus:ring-orange-500" 
             aria-label="Save current pattern"
           >
             <Save size={14} />
           </button>
           <button 
             onClick={() => setShowPresets(!showPresets)} 
             className="p-2 bg-white/5 border border-white/10 rounded-full text-slate-400 hover:text-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-500" 
             aria-label="Load pattern library"
           >
             <FolderOpen size={14} />
           </button>
        </div>
      </div>

      {showPresets && (
        <div className="absolute top-24 right-8 w-64 bg-[#0a0a0c] border border-white/10 rounded-2xl shadow-2xl z-50 p-4 animate-in fade-in zoom-in-95">
          <div className="text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-3 border-b border-white/5 pb-2 flex justify-between">
            <span>Pattern Library</span>
            <button onClick={() => setShowPresets(false)} aria-label="Close presets">×</button>
          </div>
          <div className="space-y-2 max-h-60 overflow-y-auto custom-scrollbar">
            {presets.length === 0 ? (
              <div className="text-[9px] text-slate-600 italic py-4 text-center">No patterns saved.</div>
            ) : (
              presets.map(p => (
                <button
                  key={p.id}
                  onClick={() => {
                    setGrid(p.data);
                    setShowPresets(false);
                  }}
                  className="w-full p-2 rounded-lg bg-white/5 border border-transparent hover:border-orange-500/30 text-left transition-all"
                >
                  <div className="text-[10px] font-bold text-slate-200">{p.name}</div>
                </button>
              ))
            )}
          </div>
        </div>
      )}

      {!isZoomed && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6 shrink-0">
          <div className="col-span-2 bg-gradient-to-br from-[#161618] to-[#0d0d0f] p-4 rounded-3xl border border-white/5 shadow-2xl">
             <div className="flex justify-between items-center mb-3">
               <label htmlFor={swingId} className="text-[10px] font-bold opacity-60 uppercase tracking-widest text-slate-300">Swing Engine</label>
               <span className="text-orange-400 text-xs font-mono bg-orange-500/10 px-2 py-0.5 rounded border border-orange-500/20">{swing}%</span>
             </div>
             <input 
               id={swingId}
               type="range" min="0" max="100" value={swing} onChange={e => setSwing(Number(e.target.value))}
               aria-valuetext={`${swing}% swing`}
               className="w-full accent-orange-500 bg-black/60 h-2 rounded-full border border-white/10 appearance-none [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-6 [&::-webkit-slider-thumb]:bg-orange-500 [&::-webkit-slider-thumb]:rounded-sm cursor-pointer shadow-inner focus:outline-none focus:ring-1 focus:ring-orange-500" 
             />
             <div className="flex justify-between mt-2 text-[8px] text-slate-500 uppercase font-bold tracking-widest">
               <span>Straight (0%)</span>
               <span>Hard Shuffle (100%)</span>
             </div>
          </div>
          
          <div className="col-span-2 bg-gradient-to-br from-[#161618] to-[#0d0d0f] p-4 rounded-3xl border border-white/5 shadow-2xl">
             <div className="flex justify-between items-center mb-3">
               <label htmlFor={ghostId} className="text-[10px] font-bold opacity-60 uppercase tracking-widest text-slate-300">Ghost Notes</label>
               <span className="text-purple-400 text-xs font-mono bg-purple-500/10 px-2 py-0.5 rounded border border-purple-500/20">{ghostNotes}%</span>
             </div>
             <input 
               id={ghostId}
               type="range" min="0" max="100" value={ghostNotes} onChange={e => setGhostNotes(Number(e.target.value))}
               aria-valuetext={`${ghostNotes}% ghost notes`}
               className="w-full accent-purple-500 bg-black/60 h-2 rounded-full border border-white/10 appearance-none [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-6 [&::-webkit-slider-thumb]:bg-purple-500 [&::-webkit-slider-thumb]:rounded-sm cursor-pointer shadow-inner focus:outline-none focus:ring-1 focus:ring-purple-500" 
             />
             <div className="flex justify-between mt-2 text-[8px] text-slate-500 uppercase font-bold tracking-widest">
               <span>Clean (0%)</span>
               <span>Syncopated (100%)</span>
             </div>
          </div>
        </div>
      )}

      {/* Steps Matrix Box */}
      <div 
        ref={gridContainerRef}
        className="relative z-10 flex-1 flex flex-col overflow-x-auto overflow-y-auto bg-gradient-to-b from-[#161618] to-[#0d0d0f] border border-white/5 rounded-[30px] p-6 shadow-[inset_0_10px_30px_rgba(0,0,0,0.8)] custom-scrollbar"
        role="grid"
        aria-label="Drum sequencer grid"
      >
        {/* Playback Head Track overlay */}
        <div 
          className="absolute top-0 bottom-0 w-8 bg-orange-500/10 border-x border-orange-500/30 pointer-events-none transition-all duration-75 shadow-[0_0_20px_rgba(249,115,22,0.1)] z-20"
          style={{ left: `calc(${currentStep} * 2.125rem + 7.5rem)` }}
          aria-hidden="true"
        />
        
        <div className="flex flex-col gap-2 min-w-[1240px]">
          {stepNumbersHeader}

          {DRUM_DEFINITIONS.map((drum) => (
            <div key={drum.id} className="flex items-center gap-1 group px-2 py-1 hover:bg-white/5 rounded-xl transition-colors" role="row">
              <div className="w-24 flex-shrink-0 text-[11px] font-bold text-slate-300 uppercase tracking-widest group-hover:text-orange-400 transition-colors flex items-center justify-between pr-3">
                <span className="truncate">{drum.displayName}</span>
                {audioEngine.loadedSamples.get(drum.sampleName) ? (
                  <span className="text-[8px] bg-orange-500 text-black px-1 rounded uppercase font-bold shrink-0 scale-90" title="Sample loaded">S</span>
                ) : (
                  <span className="text-[8px] bg-white/10 text-slate-500 px-1 rounded uppercase shrink-0 scale-90" title="Synthetic voice">Y</span>
                )}
              </div>
              
              <div className="flex-1 flex gap-1 bg-black/30 p-1.5 rounded-xl border border-white/5 shadow-inner">
                {Array.from({ length: STEPS }).map((_, i) => (
                  <StepButton
                    key={i}
                    drum={drum.displayName}
                    index={i}
                    isActive={grid[drum.id][i]}
                    isCurrent={i === currentStep}
                    isBeat={i % 4 === 0}
                    onClick={() => toggleStep(drum.id, i)}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
      
      {/* Sequencer Transport Footer */}
      <div className="relative z-10 mt-6 flex justify-between items-center bg-[#161618] border border-white/5 p-4 rounded-3xl shadow-2xl shrink-0" role="contentinfo">
        <div className="flex items-center gap-4">
           <button 
             onClick={() => togglePlay()}
             className="w-11 h-11 rounded-full bg-gradient-to-b from-orange-400 to-orange-600 hover:from-orange-300 hover:to-orange-500 text-black flex items-center justify-center shadow-[0_0_20px_rgba(249,115,22,0.4)] transition-all border border-orange-300 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:ring-offset-2 focus:ring-offset-black"
             aria-label={isPlaying ? "Stop sequence" : "Play sequence"}
           >
             {isPlaying ? <Square size={16} fill="currentColor" /> : <Play size={16} fill="currentColor" className="ml-1" />}
           </button>
           <button 
             onClick={() => setCurrentStep(0)}
             className="w-11 h-11 rounded-full bg-white/5 hover:bg-white/10 text-white flex items-center justify-center transition-all border border-white/10 focus:outline-none focus:ring-2 focus:ring-white"
             aria-label="Reset position to start"
           >
             <Square size={14} fill="currentColor" />
           </button>
        </div>
        <div className="flex items-center gap-3">
          {setTempo && (
            <div className="flex items-center gap-2 bg-black/60 border border-white/10 px-3 py-1.5 rounded-xl">
              <label htmlFor={tempoId} className="text-[10px] font-mono text-slate-500 uppercase">Tempo</label>
              <input 
                id={tempoId}
                type="number" 
                value={tempo} 
                onChange={e => setTempo(parseInt(e.target.value) || 120)}
                className="w-14 bg-transparent text-xs font-mono font-bold text-white text-right focus:outline-none focus:border-b border-orange-500/50" 
              />
            </div>
          )}
          <div className="text-sm font-mono text-slate-300 bg-black/60 px-5 py-2.5 rounded-xl border border-white/5 shadow-inner flex items-center gap-1.5" aria-live="polite">
             <span className="text-[10px] uppercase font-mono text-slate-500 tracking-wider">Bar</span>
             <span className="text-orange-400 font-bold">{Math.floor(currentStep / 4) + 1}</span> : <span className="text-slate-400">{(currentStep % 4) + 1}</span>
          </div>
        </div>
      </div>
    </div>
  );

  if (isFullscreen) {
    return (
      <div className="fixed inset-0 z-50 bg-black overflow-y-auto flex flex-col p-4">
        <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/brushed-alum-dark.png')] opacity-30 pointer-events-none mix-blend-overlay"></div>
        <div className="relative z-10 flex-1 flex flex-col max-w-7xl mx-auto w-full">
          {gridContent}
        </div>
      </div>
    );
  }

  return (
    <div className="bg-[#111] border-2 border-white/5 p-4 rounded-[40px] shadow-[0_30px_60px_rgba(0,0,0,0.8)] h-full flex flex-col relative overflow-hidden">
      <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/brushed-alum-dark.png')] opacity-20 pointer-events-none mix-blend-overlay"></div>
      {gridContent}
    </div>
  );
}
