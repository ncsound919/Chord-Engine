import React, { useState, useCallback, useRef, useEffect } from 'react';
import { Disc, Radio } from 'lucide-react';
import { ReframeTarget } from '../../theory/rhythmicReframer';
import { GeneratedSection } from '../../lib/engine';
import { audioEngine } from '../../lib/audio/engine';
import { Ju60Engine } from '../../lib/audio/synth';

interface MpcReframerViewProps {
  reframedSections: any[];
  reframeTarget: 'none' | ReframeTarget;
  setReframeTarget: (t: 'none' | ReframeTarget) => void;
  activeReframeSec: number;
  setActiveReframeSec: (s: number) => void;
  generatedSections: GeneratedSection[];
  musicKey: string;
}

const PRESET_LABELS: Record<ReframeTarget | 'none', string> = {
  none: 'Vintage Original (No Swing)',
  boom_bap: 'Boom Bap (Dilla Swing 62%)',
  techno: 'Minimal Techno (Straight)',
  house: 'Chicago House (Swing 20%)',
  trap: 'Trap (Rapid Skitters)',
  funk: 'Heavy Funk (The Pocket)',
  jazz: 'Classic Jazz (Swing 75%)',
  afrobeat: 'Afrobeat (Polyrhythmic)',
  detroit_techno: 'Detroit Machine Grid Feel',
  uk_garage: 'UK Garage (2-Step Shuffle)',
};

const FEEL_OPTIONS: { id: 'none' | ReframeTarget; label: string }[] = [
  { id: 'none', label: 'Vintage Original (No Swing)' },
  { id: 'boom_bap', label: 'Boom Bap (Dilla Swing 62%)' },
  { id: 'techno', label: 'Techno (Straight)' },
  { id: 'house', label: 'House (Swing 20%)' },
  { id: 'trap', label: 'Trap (Skitters)' },
  { id: 'funk', label: 'Funk (The Pocket)' },
  { id: 'jazz', label: 'Jazz (Classic Swing)' },
  { id: 'afrobeat', label: 'Afrobeat' },
  { id: 'detroit_techno', label: 'Detroit Techno' },
  { id: 'uk_garage', label: 'UK Garage' },
];

const TRACK_IDS = ['drums', 'bass', 'keys', 'guitar', 'pads'] as const;

export function MpcReframerView({
  reframedSections,
  reframeTarget,
  setReframeTarget,
  activeReframeSec,
  setActiveReframeSec,
  generatedSections,
  musicKey,
}: MpcReframerViewProps) {
  const [previewingTrack, setPreviewingTrack] = useState<string | null>(null);
  const clickIntervalRef = useRef<number | null>(null);

  const stopClick = useCallback(() => {
    if (clickIntervalRef.current !== null) {
      clearInterval(clickIntervalRef.current);
      clickIntervalRef.current = null;
    }
  }, []);

  const previewChord = useCallback(async (sectionIdx: number, chordIdx: number) => {
    const sec = reframedSections[sectionIdx];
    if (!sec?.chords?.[chordIdx]) return;
    const chord = sec.chords[chordIdx];
    await audioEngine.resume();

    if (chord.pianoVoicing?.notes) {
      const synth = Ju60Engine.getInstance();
      const now = audioEngine.ctx.currentTime;
      chord.pianoVoicing.notes.forEach((note: number, i: number) => {
        synth.triggerNote('pad', note, 0.5, now + i * 0.05, 1.2);
      });
    } else if (chord.rootPc !== undefined) {
      const rootMidi = 48 + chord.rootPc;
      const thirdMidi = rootMidi + (chord.quality?.includes('m') ? 3 : 4);
      const fifthMidi = rootMidi + 7;
      const track = audioEngine.tracks.get('keys');
      if (track) {
        const now = audioEngine.ctx.currentTime;
        [rootMidi, thirdMidi, fifthMidi].forEach((m, i) => {
          const freq = 440 * Math.pow(2, (m - 69) / 12);
          track.playOscillator(freq, 'sawtooth', now + i * 0.05, 0.4);
        });
      }
    }
  }, [reframedSections]);

  const previewClick = useCallback(async (bpm: number, swing: number) => {
    stopClick();
    await audioEngine.resume();
    const track = audioEngine.tracks.get('drums');
    if (!track) return;

    const intervalMs = (60000 / bpm) / 4;
    let step = 0;
    const playClick = () => {
      const time = audioEngine.ctx.currentTime;
      const isDownbeat = step % 4 === 0;
      const isSwingStep = step % 2 === 1;
      let adjustedTime = time;
      if (isSwingStep && swing > 0) {
        adjustedTime += (swing / 100) * (intervalMs / 3) / 1000;
      }
      track.playOscillator(isDownbeat ? 1000 : 800, 'sine', adjustedTime, 0.03);
      step = (step + 1) % 16;
    };
    playClick();
    clickIntervalRef.current = window.setInterval(playClick, intervalMs);
  }, [stopClick]);

  const handleSelectFeel = useCallback((id: 'none' | ReframeTarget) => {
    stopClick();
    setReframeTarget(id);
  }, [stopClick, setReframeTarget]);

  useEffect(() => {
    return () => stopClick();
  }, [stopClick]);

  const section = reframedSections[activeReframeSec] as GeneratedSection | undefined;

  return (
    <div className="bg-[#111] border-2 border-white/5 p-8 rounded-[40px] shadow-[0_30px_60px_rgba(0,0,0,0.8)] min-h-full flex flex-col relative overflow-hidden">
      <div className="absolute inset-0 bg-texture-dark opacity-30 pointer-events-none mix-blend-overlay" />

      <div className="relative z-10 mb-8 border-b border-white/5 pb-4 flex flex-col lg:flex-row justify-between items-start lg:items-end gap-4">
        <div>
          <h2 className="text-3xl font-serif italic text-white flex items-center gap-3">
            <Disc className="text-orange-400 animate-spin" size={28} style={{ animationDuration: '6s' }} />
            MPC Rhythmic Re-framer
          </h2>
          <p className="text-[10px] tracking-widest font-bold opacity-40 uppercase mt-1 text-orange-400">
            Micro-Timing Grid & Real-time Preview
          </p>
        </div>

        {reframedSections.length > 0 && (
          <div className="flex flex-wrap gap-1.5 bg-black/40 p-1.5 rounded-2xl border border-white/5">
            {reframedSections.map((sec: any, idx: number) => (
              <button
                key={sec.def?.id || idx}
                onClick={() => { stopClick(); setActiveReframeSec(idx); }}
                className={`px-3 py-1.5 rounded-xl text-[10px] font-mono uppercase tracking-wider transition-all font-bold ${
                  activeReframeSec === idx
                    ? 'bg-orange-500/20 text-orange-400 border border-orange-500/30'
                    : 'text-slate-400 hover:text-white hover:bg-white/5'
                }`}
              >
                {sec.def?.name || `Section ${idx + 1}`}
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="relative z-10 grid grid-cols-1 lg:grid-cols-12 gap-8 flex-1">
        <div className="lg:col-span-4 space-y-6">
          <div className="bg-gradient-to-br from-[#161618] to-[#0d0d0f] border border-white/5 p-6 rounded-[30px] shadow-2xl space-y-4">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block border-b border-white/5 pb-2">
              Select Target Feel
              {reframeTarget !== 'none' && (
                <button
                  onClick={() => previewClick(85, reframeTarget === 'boom_bap' ? 62 : 20)}
                  className="ml-2 rounded bg-orange-500/20 px-2 py-0.5 text-[8px] text-orange-400 hover:bg-orange-500/30"
                >
                  Preview Click
                </button>
              )}
            </span>
            <div className="space-y-1.5 max-h-[340px] overflow-y-auto pr-1 custom-scrollbar">
              {FEEL_OPTIONS.map(item => (
                <button
                  key={item.id}
                  onClick={() => handleSelectFeel(item.id)}
                  className={`w-full py-2.5 px-3 rounded-xl text-xs text-left font-medium flex items-center justify-between border transition-all ${
                    reframeTarget === item.id
                      ? 'bg-orange-500/10 border-orange-500/40 text-orange-400 font-bold shadow-[0_0_15px_rgba(249,115,22,0.1)]'
                      : 'bg-black/20 border-white/5 text-slate-400 hover:bg-white/5 hover:text-white'
                  }`}
                >
                  <span className="truncate">{item.label}</span>
                  <div className={`w-2 h-2 rounded-full shrink-0 ml-2 ${reframeTarget === item.id ? 'bg-orange-500 shadow-[0_0_8px_#f97316]' : 'bg-zinc-800'}`} />
                </button>
              ))}
            </div>
          </div>

          {section?.timeFeel && (
            <div className="bg-gradient-to-br from-[#161618] to-[#0d0d0f] border border-white/5 p-6 rounded-[30px] shadow-2xl space-y-4">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block border-b border-white/5 pb-2">
                Micro-Timing Details
              </span>
              <div className="space-y-4">
                <div className="space-y-1">
                  <div className="flex justify-between text-xs font-mono text-slate-400">
                    <span>MPC 16th Swing</span>
                    <span className="text-orange-400 font-bold">{section.timeFeel.swingAmount}%</span>
                  </div>
                  <div className="bg-black/60 h-2 rounded-full border border-white/5 overflow-hidden">
                    <div className="bg-orange-500 h-full rounded-full" style={{ width: `${section.timeFeel.swingAmount}%` }} />
                  </div>
                </div>
                <div className="flex justify-between items-center text-xs">
                  <span className="text-slate-500">Late Drag Offset</span>
                  <span className="font-mono text-slate-300">+{section.timeFeel.microTimingDragMs}ms</span>
                </div>
                <div className="flex justify-between items-center text-xs">
                  <span className="text-slate-500">Ghost Note Density</span>
                  <span className="font-mono text-slate-300">{section.timeFeel.ghostNoteDensity}%</span>
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="lg:col-span-8 space-y-8">
          <div className="bg-gradient-to-br from-[#161618] to-[#0d0d0f] border border-white/5 p-6 rounded-[30px] shadow-2xl space-y-4">
            <div className="flex justify-between items-center">
              <h3 className="text-sm font-bold text-slate-300 uppercase tracking-widest flex items-center gap-2">
                <Radio className="text-orange-400" size={16} /> Chord Preview
              </h3>
              <span className="text-[8px] font-mono bg-purple-500/10 text-purple-400 border border-purple-500/20 px-2 py-0.5 rounded font-bold uppercase tracking-widest">
                Ju-60 Preview
              </span>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3">
              {section?.chords?.slice(0, 16).map((chord: any, ci: number) => (
                <button
                  key={`${chord.bar}-${chord.beat}`}
                  onClick={() => previewChord(activeReframeSec, ci)}
                  className="rounded-xl border border-white/10 bg-black/40 p-3 text-left hover:border-orange-500/30 hover:bg-orange-500/5 transition-all active:scale-95"
                >
                  <div className="text-[9px] font-mono uppercase text-slate-500">Bar {chord.bar}</div>
                  <div className="text-sm font-bold font-mono text-white mt-1">{chord.chordName}</div>
                  <div className="text-[8px] font-mono text-slate-600 mt-0.5">{chord.roman}</div>
                </button>
              ))}
            </div>
          </div>

          {section && section.articulations && section.articulations.length > 0 && (
            <div className="bg-gradient-to-br from-[#161618] to-[#0d0d0f] border border-white/5 p-6 rounded-[30px] shadow-2xl space-y-4">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">
                Sampler Chop Map (Click to audition)
              </span>
              <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3">
                  {section.articulations.map((art: any, artIdx: number) => {
                  const originalChord = section.chords.find((c: any) => c.bar === art.bar);
                  const chordIdx = originalChord ? section.chords.indexOf(originalChord) : -1;
                  return (
                    <button
                      key={artIdx}
                      onClick={() => {
                        if (chordIdx >= 0) previewChord(activeReframeSec, chordIdx);
                      }}
                      className="rounded-xl border border-white/10 bg-black/40 p-3 text-left hover:border-orange-500/30 transition-all active:scale-95"
                    >
                      <div className="text-[9px] font-mono text-slate-500">PAD {artIdx + 1}</div>
                      <div className="text-xs font-bold font-mono text-white mt-1">{originalChord?.chordName || 'N/A'}</div>
                      <div className="text-[8px] font-mono text-slate-600 mt-0.5">Bar {art.bar} • Beat {art.attackBeat?.toFixed(2)}</div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {section && section.drumPattern && section.drumPattern.grid && (
            <div className="bg-gradient-to-br from-[#161618] to-[#0d0d0f] border border-white/5 p-6 rounded-[30px] shadow-2xl space-y-4">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">
                Drum Grid Pattern
              </span>
              <div className="bg-black/60 border border-white/5 rounded-2xl p-5 overflow-x-auto custom-scrollbar">
                <div className="space-y-3 min-w-[500px]">
                  {Object.entries(section.drumPattern.grid)
                    .filter(([voice]) => ['Kick', 'Snare', 'HH Closed', 'HH Open'].includes(voice))
                    .map(([voice, steps]: [string, any]) => (
                      <div key={voice} className="flex items-center gap-4">
                        <div className="w-20 text-[10px] font-mono font-bold uppercase text-slate-400">{voice}</div>
                        <div className="flex-1 flex gap-1.5 justify-between">
                          {(steps as boolean[]).filter((_: boolean, idx: number) => idx % 2 === 0).map((active: boolean, stepIdx: number) => (
                            <div
                              key={stepIdx}
                              className={`flex-1 h-7 rounded-lg border transition-all flex items-center justify-center font-mono text-[9px] font-bold ${
                                active
                                  ? 'bg-gradient-to-tr from-orange-500 to-amber-400 border-orange-500 text-black shadow-[0_0_10px_rgba(249,115,22,0.4)]'
                                  : stepIdx % 4 === 0
                                  ? 'bg-white/10 border-white/20 text-slate-400'
                                  : 'bg-white/5 border-white/5 text-slate-600'
                              }`}
                            >
                              {stepIdx + 1}
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
