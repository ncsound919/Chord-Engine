import React, { useState } from 'react';
import { GeneratedSection, GeneratedChord } from '../../lib/engine';
import { PLAYERS, PlayerProfile, Instrument } from '../../lib/players';
import { createPRNG } from '../../lib/prng';
import { generateBassNote, generateVoicingCandidates, pickBestVoicing, Voicing } from '../../theory/voicing';
import { generateFingerableShapes, pickBestGuitarShape, GuitarShape } from '../../theory/fretboard';
import { generateDrumPattern, DrumStyle } from '../../theory/rhythmicReframer';
import { chordTonesForQuality } from '../../theory/pitch';
import { Shuffle, Settings2, Keyboard, Drum, Guitar, Waves, ChevronDown, Music } from 'lucide-react';

interface PartsViewProps {
  sections: GeneratedSection[];
  musicKey: string;
  onSectionsUpdate: (updated: GeneratedSection[]) => void; // NEW: lets Spin Part actually persist changes
}

// INSTRUMENTS/Instrument now imported from ../../lib/players (single source of truth).
// Display order is intentionally independent of that module's array order.
const DISPLAY_ORDER: Instrument[] = ['Keys', 'Guitar', 'Bass', 'Drums', 'Pads'];

const ICONS = {
  Keys: <Keyboard size={16} />,
  Guitar: <Guitar size={16} />,
  Bass: <Settings2 size={16} />, // using sliders as bass icon proxy
  Drums: <Drum size={16} />,
  Pads: <Waves size={16} />
};

// ── Trait → generation-bias helpers ──────────────────────────────
// Player `traits` are free-text strings (e.g. "Slap & Pop", "Space/Silence").
// We map keyword hits to numeric biases so different players actually
// produce audibly different results instead of just relabeling the UI.

function traitScore(traits: string[], keywords: string[]): number {
  const hay = traits.join(' ').toLowerCase();
  return keywords.some(k => hay.includes(k)) ? 1 : 0;
}

/** 0 (static/root-driven) .. 1 (highly active/syncopated) */
function bassActivityFromTraits(traits: string[]): number {
  let score = 0.3; // baseline: mostly roots, some connective motion
  score += traitScore(traits, ['slap', 'pop', 'aggressive', 'funk']) * 0.4;
  score += traitScore(traits, ['syncop', 'melodic walk', 'double stop']) * 0.3;
  score -= traitScore(traits, ['contrapuntal', 'low b string']) * 0.1;
  return Math.max(0, Math.min(1, score));
}

/** Picks a piano/pad voicing style biased by player traits. */
function voicingStyleBiasFromTraits(traits: string[]): Voicing['style'][] {
  if (traitScore(traits, ['space', 'silence', 'sustained', 'warm'])) return ['rootless', 'spread'];
  if (traitScore(traits, ['block chords', 'mu major', 'thick', 'detuned'])) return ['close', 'drop2'];
  if (traitScore(traits, ['staccato', 'rhythmic', 'punchy'])) return ['close', 'drop3'];
  return ['close', 'drop2', 'rootless', 'spread'];
}

/** energy/complexity nudge for drum re-spin, from a drummer's traits. */
function drumFeelBiasFromTraits(traits: string[]): { energyDelta: number; complexityDelta: number } {
  let energyDelta = 0;
  let complexityDelta = 0;
  if (traitScore(traits, ['ghost notes', 'shuffle', 'pocket'])) { energyDelta -= 5; complexityDelta += 1; }
  if (traitScore(traits, ['linear fills', 'crisp', 'marching'])) { complexityDelta += 1; }
  if (traitScore(traits, ['precision', 'dynamic'])) { energyDelta += 5; }
  return { energyDelta, complexityDelta };
}

export function PartsView({ sections, musicKey, onSectionsUpdate }: PartsViewProps) {
  const [assignedPlayers, setAssignedPlayers] = useState<Record<Instrument, string>>({
    Keys: 'fagen',
    Guitar: 'carlton',
    Bass: 'rainey',
    Drums: 'purdie',
    Pads: 'string_mach'
  });
  const [spinningPart, setSpinningPart] = useState<Record<string, boolean>>({});
  const spinCountRef = React.useRef<Record<string, number>>({});

  if (sections.length === 0) {
     return <div className="p-8 text-center text-slate-500 font-mono flex items-center justify-center h-full bg-[#111] rounded-[40px] border-2 border-white/5">Generate a score first to see parts.</div>;
  }

  const handlePlayerChange = (inst: Instrument, playerId: string) => {
    setAssignedPlayers(prev => ({ ...prev, [inst]: playerId }));
  };

  const handleSpin = async (inst: Instrument) => {
    setSpinningPart(prev => ({ ...prev, [inst]: true }));
    try {
      const player = PLAYERS.find(p => p.id === assignedPlayers[inst]);
      if (!player) return;
      spinCountRef.current[inst] = (spinCountRef.current[inst] ?? 0) + 1;
      const updated = regeneratePartForInstrument(
        sections,
        inst,
        player,
        musicKey,
        spinCountRef.current[inst]
      );
      onSectionsUpdate(updated);
    } finally {
      setSpinningPart(prev => ({ ...prev, [inst]: false }));
    }
  };

  return (
    <div className="bg-[#111] border-2 border-white/5 p-8 rounded-[40px] shadow-[0_30px_60px_rgba(0,0,0,0.8)] h-full flex flex-col relative overflow-hidden">
      <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/brushed-alum-dark.png')] opacity-20 pointer-events-none mix-blend-overlay"></div>
      
      <div className="relative z-10 mb-8 border-b border-white/5 pb-4">
        <h2 className="text-3xl font-serif italic text-white flex items-center gap-3">
          <Settings2 className="text-orange-400" />
          Musician Parts & Auditions
        </h2>
        <p className="text-[10px] tracking-widest font-bold opacity-40 uppercase mt-1 text-orange-400">Rotate players to capture different feels</p>
      </div>

      <div className="relative z-10 flex-1 overflow-y-auto space-y-12 pr-4">
        {/* Melody Part (Lead/Vocal) */}
        <div className="bg-gradient-to-br from-[#1e2030] to-[#0d0e17] p-6 rounded-3xl border border-orange-500/20 shadow-[0_10px_30px_rgba(249,115,22,0.1)] relative">
          <div className="absolute top-4 right-4 px-2.5 py-1 bg-orange-500/10 border border-orange-500/20 rounded-full text-[9px] font-mono uppercase tracking-widest text-orange-400 font-bold">
            Lead Vocal / Solist
          </div>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-6 gap-4 border-b border-white/5 pb-4">
            <div className="flex items-center gap-4">
              <h3 className="text-orange-400 font-bold uppercase tracking-widest text-lg flex items-center gap-2">
                <Music size={18} className="text-orange-400 animate-pulse" /> Melody (Top-Line Engine)
              </h3>
              <div className="h-4 w-px bg-white/20"></div>
              <span className="text-xs text-slate-300 font-mono">Singable Vocal Guide</span>
            </div>
            <div className="flex gap-2">
              {['Contour Rules', 'Chord Tones', 'Vocal Register', 'Breathing Space'].map(trait => (
                <span key={trait} className="px-2 py-1 bg-black/40 border border-white/5 shadow-inner rounded text-[9px] uppercase tracking-widest text-orange-300">
                  {trait}
                </span>
              ))}
            </div>
          </div>
          
          <p className="text-xs text-slate-400 mb-6 italic border-l-2 border-orange-500/30 pl-3">
            A singable melody line designed to weave smoothly on top of the chord changes, targeting chord tones on downbeats and moving stepwise with natural rests.
          </p>

          <div className="space-y-6">
            {sections.map((section, sIdx) => {
              const melodyNotes = section.melody || [];
              return (
                <div key={sIdx} className="bg-black/40 p-5 rounded-2xl border border-white/5 shadow-inner">
                  <div className="text-[10px] font-bold uppercase tracking-widest text-orange-400/70 mb-4 bg-black/40 px-2 py-1 rounded inline-block border border-white/5">
                    [{section.def.name}] Melody Line
                  </div>
                  {melodyNotes.length === 0 ? (
                    <p className="text-xs text-slate-500 font-mono italic">No melody generated for this section yet. Click Generate Score to compose.</p>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                      {Array.from({ length: section.def.lengthBars }).map((_, barIdx) => {
                        const barNum = barIdx + 1;
                        const barNotes = melodyNotes.filter(n => n.bar === barNum);
                        const barChord = section.chords.find(c => c.bar === barNum);
                        
                        return (
                          <div key={barNum} className="p-3 bg-black/30 border border-white/5 rounded-xl flex flex-col justify-between">
                            <div className="flex justify-between items-center border-b border-white/5 pb-1.5 mb-2">
                              <span className="text-[9px] font-bold font-mono text-slate-500">BAR {barNum}</span>
                              <span className="text-[10px] font-bold font-mono text-orange-400/80">{barChord?.chordName || ''}</span>
                            </div>
                            {barNotes.length === 0 ? (
                              <div className="text-[10px] text-slate-600 font-mono py-2 italic text-center">Rest (Breath)</div>
                            ) : (
                              <div className="flex flex-wrap gap-1.5 py-1">
                                {barNotes.map((note) => (
                                  <div 
                                    key={note.id} 
                                    className="px-2 py-1 bg-gradient-to-b from-orange-500/10 to-orange-500/5 border border-orange-500/20 rounded-md flex flex-col items-center"
                                    title={`Beat: ${note.beat}, Dur: ${note.duration} beats`}
                                  >
                                    <span className="text-xs font-bold font-mono text-orange-300">{note.noteName}</span>
                                    <span className="text-[7px] text-slate-500 font-mono">Bt {note.beat}</span>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {DISPLAY_ORDER.map(inst => {
          const availablePlayers = PLAYERS.filter(p => p.instrument === inst);
          if (availablePlayers.length === 0) return null;
          
          const activePlayer = availablePlayers.find(p => p.id === assignedPlayers[inst]) || availablePlayers[0];

          return (
            <div key={inst} className="bg-gradient-to-br from-[#1a1a1a] to-[#0a0a0a] p-6 rounded-3xl border border-white/10 shadow-[0_10px_30px_rgba(0,0,0,0.5)]">
               <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-6 gap-4 border-b border-white/5 pb-4">
                 <div className="flex items-center gap-4">
                   <h3 className="text-orange-400 font-bold uppercase tracking-widest text-lg flex items-center gap-2">
                     {ICONS[inst]} {inst}
                   </h3>
                   <div className="h-4 w-px bg-white/20"></div>
                   <div className="relative">
                     <select 
                       value={assignedPlayers[inst]}
                       onChange={(e) => handlePlayerChange(inst, e.target.value)}
                       className="appearance-none bg-black/60 border border-white/10 text-white rounded-lg pl-3 pr-8 py-1.5 text-sm focus:outline-none focus:border-orange-500/50 shadow-inner font-mono"
                     >
                       {availablePlayers.map(p => (
                         <option key={p.id} value={p.id}>{p.name}</option>
                       ))}
                     </select>
                     <div className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none opacity-50">
                       <ChevronDown size={14} />
                     </div>
                   </div>
                 </div>
                 
                 <div className="flex items-center gap-4">
                   <div className="flex gap-2">
                     {activePlayer.traits.map(trait => (
                       <span key={trait} className="px-2 py-1 bg-black/40 border border-white/5 shadow-inner rounded text-[9px] uppercase tracking-widest text-slate-400">
                         {trait}
                       </span>
                     ))}
                   </div>
                   <button 
                     onClick={() => handleSpin(inst)}
                     disabled={spinningPart[inst]}
                     className={`flex items-center gap-2 px-4 py-1.5 rounded-full text-[10px] font-bold uppercase tracking-widest transition-all border ${spinningPart[inst] ? 'border-orange-500 bg-orange-500 text-black shadow-[0_0_15px_rgba(249,115,22,0.4)]' : 'bg-gradient-to-b from-orange-500/10 to-orange-600/5 hover:from-orange-500/25 hover:to-orange-600/15 text-orange-400 border-orange-500/30 shadow-[0_0_15px_rgba(249,115,22,0.1)] hover:shadow-[0_0_20px_rgba(249,115,22,0.3)]'}`}
                   >
                     {spinningPart[inst] ? (<><svg className="animate-spin h-3.5 w-3.5" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>Spinning...</>) : (<><Shuffle size={14} /> Spin Part</>)}
                   </button>
                 </div>
               </div>
               
               <p className="text-xs text-slate-400 mb-6 italic border-l-2 border-orange-500/30 pl-3">{activePlayer.description}</p>
               
               <div className="space-y-6">
                  {sections.map((section, sIdx) => (
                    <div key={sIdx} className="bg-black/20 p-4 rounded-2xl border border-white/5 shadow-inner">
                      <div className="text-[10px] font-bold uppercase tracking-widest text-orange-400/50 mb-3 bg-black/40 px-2 py-1 rounded inline-block border border-white/5">[{section.def.name}]</div>
                      <div className="grid grid-cols-4 sm:grid-cols-8 gap-2">
                         {section.chords.map((chord, cIdx) => (
                           <div key={cIdx} className="p-3 bg-gradient-to-b from-white/10 to-transparent border border-white/10 rounded-xl text-center shadow-md relative overflow-hidden group hover:border-orange-500/50 transition-colors">
                              <div className="absolute inset-0 bg-orange-500/0 group-hover:bg-orange-500/10 transition-colors"></div>
                              {inst === 'Drums' ? (
                                 <div className="flex justify-center gap-1 relative z-10">
                                   <div className="w-1.5 h-4 bg-slate-300 rounded-sm skew-x-12 shadow-[0_0_5px_rgba(255,255,255,0.5)]"></div>
                                   <div className="w-1.5 h-4 bg-slate-300 rounded-sm skew-x-12 shadow-[0_0_5px_rgba(255,255,255,0.5)]"></div>
                                 </div>
                              ) : inst === 'Bass' ? (
                                 <span className="font-mono text-base font-bold text-slate-200 relative z-10">{chord.chordName.split('/')[1] || chord.chordName.replace(/[^A-G#b]/g, '')}</span>
                              ) : (
                                 <span className="font-mono text-sm font-bold text-slate-200 relative z-10">{chord.chordName}</span>
                              )}
                              <div className="text-[8px] opacity-40 mt-1 font-mono text-orange-200">B{chord.bar}</div>
                           </div>
                         ))}
                      </div>
                    </div>
                  ))}
               </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Real per-instrument regeneration ─────────────────────────────
// Delegates to the actual engine/theory primitives (no duplicated
// music logic here), re-seeded per click so repeated spins vary,
// and biased by the assigned player's traits so different players
// audibly change the result.

function regeneratePartForInstrument(
  sections: GeneratedSection[],
  inst: Instrument,
  player: PlayerProfile,
  musicKey: string,
  spinCount: number
): GeneratedSection[] {
  const seedBase = `${player.id}_${inst}_${musicKey}_${spinCount}`;

  return sections.map((section) => {
    if (inst === 'Bass') {
      const prng = createPRNG(seedBase + section.def.id);
      const activity = bassActivityFromTraits(player.traits);
      const chords = section.chords.map((chord, idx): GeneratedChord => {
        if (chord.rootPc === undefined) return chord;
        const nextChord = section.chords[idx + 1];
        const nextRootPc = nextChord?.rootPc ?? null;
        // More active players lean toward approach-tone motion into the
        // next chord; static players mostly hit roots on the downbeat.
        const beatPosition = nextRootPc !== null && prng() < activity ? 'approach' : 'downbeat';
        const bassNote = generateBassNote(chord.rootPc, nextRootPc, beatPosition);
        return { ...chord, bassNote };
      });
      return { ...section, chords };
    }

    if (inst === 'Keys' || inst === 'Pads') {
      const prng = createPRNG(seedBase + section.def.id);
      const preferredStyles = voicingStyleBiasFromTraits(player.traits);
      let prevVoicing: Voicing | null = null;
      const chords = section.chords.map((chord): GeneratedChord => {
        if (chord.rootPc === undefined || !chord.quality) return chord;
        const chordTonesPc = chordTonesForQuality(chord.rootPc, chord.quality);
        const candidates = generateVoicingCandidates(chordTonesPc, chord.rootPc, 4);
        if (candidates.length === 0) return chord;
        // Bias: prefer candidates matching the player's preferred styles when
        // present, otherwise fall back to smoothest voice-leading.
        const biased = candidates.filter(c => preferredStyles.includes(c.style));
        const pool = biased.length > 0 && prng() < 0.7 ? biased : candidates;
        const pianoVoicing = pickBestVoicing(pool, prevVoicing);
        if (pianoVoicing) prevVoicing = pianoVoicing;
        return { ...chord, pianoVoicing: pianoVoicing ?? undefined };
      });
      return { ...section, chords };
    }

    if (inst === 'Guitar') {
      const prng = createPRNG(seedBase + section.def.id);
      let prevShape: GuitarShape | null = null;
      const chords = section.chords.map((chord): GeneratedChord => {
        if (chord.rootPc === undefined || !chord.quality) return chord;
        const chordTonesPc = chordTonesForQuality(chord.rootPc, chord.quality);
        if (chordTonesPc.length === 0) return chord;
        const candidates = generateFingerableShapes(chordTonesPc, { rootPc: chord.rootPc });
        if (candidates.length === 0) return chord;
        // Occasionally pick a different fingering than the smoothest one to
        // reflect a more adventurous player, otherwise take the smoothest.
        const idx = prng() < 0.25
          ? Math.floor(prng() * candidates.length)
          : -1;
        const guitarShape = idx >= 0 ? candidates[idx] : pickBestGuitarShape(candidates, prevShape);
        prevShape = guitarShape;
        return { ...chord, guitarShape };
      });
      return { ...section, chords };
    }

    if (inst === 'Drums') {
      const { energyDelta, complexityDelta } = drumFeelBiasFromTraits(player.traits);
      const baseEnergy = 50;
      const baseComplexity = 2;
      const energy = Math.max(0, Math.min(100, baseEnergy + energyDelta));
      const complexity = Math.max(1, Math.min(3, baseComplexity + complexityDelta));
      // Preserve the song's actual drum style (set in App.tsx / reframeSong)
      // instead of guessing — a trap section re-spun as boom_bap would be wrong.
      const style: DrumStyle = section.drumStyle ?? 'boom_bap';
      const drumPattern = generateDrumPattern(style, energy, complexity, seedBase + section.def.id);
      return { ...section, drumPattern, drumStyle: style };
    }

    return section;
  });
}
