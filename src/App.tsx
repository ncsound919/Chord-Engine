import React, { useEffect, useMemo, useCallback } from 'react';
import {
  Settings, Layers, GitCompare, Disc, Music, Radio, Sparkles, Sliders, Menu,
} from 'lucide-react';
import { transport, audioEngine } from './lib/audio/engine';
import { Ju60Engine } from './lib/audio/synth';
import { sequencer } from './lib/audio/sequencer';
import { useGenerationStore } from './stores/generationStore';
import { useProjectStore } from './stores/projectStore';
import { useUiStore, type ViewMode } from './stores/uiStore';
import { LeadSheet } from './components/LeadSheet';
import { MixerView } from './components/views/MixerView';
import { InstrumentsView } from './components/views/InstrumentsView';
import { RhythmGrid } from './components/views/RhythmGrid';
import { PartsView } from './components/views/PartsView';
import { ArrangementCriticPanel } from './components/ArrangementCriticPanel';
import { OntologyBlenderView } from './components/views/OntologyBlenderView';
import { MpcReframerView } from './components/views/MpcReframerView';
import { TransportBar } from './components/TransportBar';
import { DesktopTitlebar } from './components/DesktopTitlebar';
import { useMidiHardware } from './hooks/useMidiHardware';
import { useKeyboardShortcuts } from './hooks/useKeyboardShortcuts';
import type { MidiNoteEvent } from './lib/tauriBridge';
import { resolveBlendedProfile, frameSong, WriterId } from './theory/songFraming';
import { reframeSong } from './theory/rhythmicReframer';

export default function App() {
  const sidebarOpen = useUiStore((s) => s.sidebarOpen);
  const setSidebarOpen = useUiStore((s) => s.setSidebarOpen);
  const activeView = useUiStore((s) => s.activeView);
  const setActiveView = useUiStore((s) => s.setActiveView);
  const isSectionsExpanded = useUiStore((s) => s.isSectionsExpanded);
  const setIsSectionsExpanded = useUiStore((s) => s.setIsSectionsExpanded);

  const musicKey = useGenerationStore((s) => s.musicKey);
  const setMusicKey = useGenerationStore((s) => s.setMusicKey);
  const seed = useGenerationStore((s) => s.seed);
  const setSeed = useGenerationStore((s) => s.setSeed);
  const randomizeSeed = useGenerationStore((s) => s.randomizeSeed);
  const sections = useGenerationStore((s) => s.sections);
  const generated = useGenerationStore((s) => s.generated);
  const writerWeights = useGenerationStore((s) => s.writerWeights);
  const setWriterWeights = useGenerationStore((s) => s.setWriterWeights);
  const reframeTarget = useGenerationStore((s) => s.reframeTarget);
  const setReframeTarget = useGenerationStore((s) => s.setReframeTarget);
  const activeReframeSec = useGenerationStore((s) => s.activeReframeSec);
  const setActiveReframeSec = useGenerationStore((s) => s.setActiveReframeSec);
  const addSection = useGenerationStore((s) => s.addSection);
  const removeSection = useGenerationStore((s) => s.removeSection);
  const moveSectionUp = useGenerationStore((s) => s.moveSectionUp);
  const moveSectionDown = useGenerationStore((s) => s.moveSectionDown);
  const updateSection = useGenerationStore((s) => s.updateSection);
  const handleGenerate = useGenerationStore((s) => s.handleGenerate);
  const handleCompileSong = useGenerationStore((s) => s.handleCompileSong);
  const handleSubstitute = useGenerationStore((s) => s.handleSubstitute);
  const handleApplyCriticFix = useGenerationStore((s) => s.handleApplyCriticFix);

  const projectName = useProjectStore((s) => s.projectName);
  const setProjectName = useProjectStore((s) => s.setProjectName);
  const isSaving = useProjectStore((s) => s.isSaving);
  const saveError = useProjectStore((s) => s.saveError);
  const userProjects = useProjectStore((s) => s.userProjects);
  const isProjectListOpen = useProjectStore((s) => s.isProjectListOpen);
  const setIsProjectListOpen = useProjectStore((s) => s.setIsProjectListOpen);
  const loadUserProjects = useProjectStore((s) => s.loadUserProjects);
  const saveProject = useProjectStore((s) => s.saveProject);
  const loadProject = useProjectStore((s) => s.loadProject);

  const activeWritersForBlend = useMemo(
    () => (Object.entries(writerWeights) as [WriterId, number][])
      .filter(([_, w]) => w > 0)
      .map(([id, w]) => ({ id, weight: w })),
    [writerWeights]
  );

  const currentBlendedProfile = useMemo(
    () => resolveBlendedProfile({
      writers: activeWritersForBlend.length > 0 ? activeWritersForBlend : [{ id: 'bacharach', weight: 100 }]
    }),
    [activeWritersForBlend]
  );

  const currentFramedSong = useMemo(
    () => frameSong(currentBlendedProfile),
    [currentBlendedProfile]
  );

  const reframedSections = useMemo(
    () => reframeTarget !== 'none' && generated.length > 0
      ? reframeSong(currentFramedSong, generated, reframeTarget)
      : [],
    [reframeTarget, generated, currentFramedSong]
  );

  const dominantWriter = useMemo(() => {
    const sorted = [...activeWritersForBlend].sort((a, b) => b.weight - a.weight);
    return sorted[0]?.id || undefined;
  }, [activeWritersForBlend]);

  const handleMidiNote = useCallback((note: number, velocity: number, on: boolean) => {
    const synth = Ju60Engine.getInstance();
    if (on) {
      synth.triggerNoteOn('lead', note, audioEngine.ctx.currentTime);
    } else {
      synth.triggerNoteOff('lead', note, audioEngine.ctx.currentTime);
    }
  }, []);

  useMidiHardware(useCallback((event: MidiNoteEvent) => {
    if (event.type === 'note_on') {
      handleMidiNote(event.note, event.velocity, true);
    } else if (event.type === 'note_off') {
      handleMidiNote(event.note, event.velocity, false);
    }
  }, [handleMidiNote]));

  useKeyboardShortcuts();

  useEffect(() => {
    const synth = Ju60Engine.getInstance();
    const defaultPatch = {
      lfoRate: 45, lfoDelay: 15, dcoLfo: 8, dcoPwm: 35, dcoPwmSrc: 'LFO' as const,
      dcoRange: '8\'' as const, dcoPulse: true, dcoSaw: true, dcoSub: 55, dcoNoise: 18,
      hpfFreq: 1, vcfCutoff: 68, vcfRes: 40, vcfEnv: 45, vcfLfo: 12, vcfKeyFollow: 40,
      vcfPolarity: '+' as const, vcaMode: 'ENV' as const, vcaLevel: 80, envA: 12, envD: 35,
      envS: 70, envR: 45, chorus: 'I' as const, voiceMode: 'POLY' as const, unisonDetune: 15,
      subWave: 'SQR' as const,
    };
    synth.setupChannel('lead', 'lead', { ...defaultPatch });
    synth.setupChannel('pad', 'pads', { ...defaultPatch, vcfCutoff: 40, envA: 60, envR: 60, chorus: 'BOTH' as const });
    synth.setupChannel('bass', 'bass', { ...defaultPatch, dcoRange: '16\'', vcfCutoff: 30, vcaMode: 'GATE' });
    transport.addStopCallback(() => synth.allNotesOff());
  }, []);

  useEffect(() => {
    if (sections.length > 0 && generated.length === 0) {
      handleGenerate();
    }
  }, [sections.length, generated.length]);

  useEffect(() => {
    sequencer.setSections(generated);
  }, [generated]);

  useEffect(() => {
    loadUserProjects();
  }, []);

  const [, setTick] = React.useState(0);
  useEffect(() => {
    const unsubscribe = transport.subscribe(() => setTick(t => t + 1));
    return () => { unsubscribe(); };
  }, []);

  const viewIcons: Record<ViewMode, { icon: React.ReactNode; label: string; desc: string }> = {
    arranger: { icon: <Layers size={15} />, label: 'Arranger', desc: 'Chords & Song Structure' },
    blender: { icon: <GitCompare size={15} />, label: 'Ontology Blender', desc: 'Writer Profile Blend' },
    reframer: { icon: <Disc size={15} />, label: 'MPC Re-framer', desc: 'SP-1200 Swing & Bit-Depth' },
    rhythm: { icon: <Music size={15} />, label: 'Rhythm Grid', desc: 'MPC Drum Sequencer' },
    instruments: { icon: <Radio size={15} />, label: 'Instruments', desc: 'Juno-60 Analog Synth' },
    parts: { icon: <Sparkles size={15} />, label: 'Parts & Score', desc: 'Lead Sheet Notation' },
    mixer: { icon: <Sliders size={15} />, label: 'Console Mixer', desc: 'Stereo Out & Mixer' },
  };

  return (
    <div className="min-h-screen text-slate-100 font-sans selection:bg-orange-500/30 flex flex-col h-screen overflow-hidden w-screen"
      style={{
        background: 'radial-gradient(circle at 0% 0%, #1a1c2c 0%, transparent 50%), radial-gradient(circle at 100% 0%, #4a192c 0%, transparent 50%), radial-gradient(circle at 50% 100%, #1e3a8a 0%, #0f172a 100%)',
        backgroundColor: '#0f172a',
      }}
    >
      <DesktopTitlebar projectName={projectName} onMidiNote={handleMidiNote} />
      <div className="flex-1 flex h-full overflow-hidden">
      <aside className={`shrink-0 border-r border-white/10 bg-[#06070e]/85 backdrop-blur-xl flex flex-col justify-between overflow-y-auto custom-scrollbar h-full z-40 transition-all duration-300 ${sidebarOpen ? 'w-80 p-5 opacity-100' : 'w-0 p-0 opacity-0 pointer-events-none'}`}>
        <div className="space-y-6">
          <div className="flex items-center gap-3 px-1">
            <img src="/logo.png" alt="Chord Engine" className="w-10 h-10 rounded-lg object-contain shadow-lg shadow-orange-500/20 shrink-0" />
            <div>
              <h1 className="text-sm font-bold tracking-tight uppercase text-white">Chord Engine</h1>
              <span className="text-[9px] font-mono opacity-50 block uppercase text-orange-400">Audio Composition Lab</span>
            </div>
          </div>
          <div className="space-y-1">
            <label className="block text-[9px] font-bold uppercase tracking-widest text-slate-500 mb-2 px-1">Workspaces</label>
            {(Object.entries(viewIcons) as [ViewMode, typeof viewIcons[ViewMode]][]).map(([id, item]) => (
              <button key={id} onClick={() => setActiveView(id)}
                className={`w-full px-3 py-2 rounded-xl text-left flex items-center gap-3 transition-all ${
                  activeView === id
                    ? 'bg-orange-500/10 border border-orange-500/30 text-orange-400 font-bold shadow-[0_0_15px_rgba(249,115,22,0.1)]'
                    : 'text-slate-400 hover:text-white hover:bg-white/5 border border-transparent'
                }`}
              >
                <span className={activeView === id ? 'text-orange-400' : 'text-slate-400'}>{item.icon}</span>
                <div>
                  <div className="text-xs uppercase tracking-wider">{item.label}</div>
                  <div className="text-[9px] opacity-50 font-normal leading-none mt-0.5">{item.desc}</div>
                </div>
              </button>
            ))}
          </div>
          <div className="bg-black/40 border border-white/5 p-4 rounded-2xl space-y-4">
            <div className="text-[9px] font-bold uppercase tracking-widest text-slate-400 border-b border-white/5 pb-2">Session Parameters</div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[9px] uppercase text-slate-500 mb-1">Key</label>
                <select value={musicKey} onChange={e => setMusicKey(e.target.value)} className="w-full bg-black/60 border border-white/10 rounded-lg px-2 py-1.5 text-xs text-white focus:outline-none focus:border-orange-500/50">
                  {['C', 'C#', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'Ab', 'A', 'Bb', 'B'].map(k => (
                    <option key={k} value={k}>{k}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-[9px] uppercase text-slate-500 mb-1">Tempo</label>
                <div className="flex items-center gap-1 bg-black/60 border border-white/10 rounded-lg px-2 py-1">
                  <input type="number" value={transport.tempo} onChange={e => { transport.tempo = parseInt(e.target.value) || 120; setTick(t => t + 1); }}
                    className="w-full bg-transparent text-xs text-white focus:outline-none" />
                  <span className="text-[9px] text-slate-500 uppercase font-mono">BPM</span>
                </div>
              </div>
            </div>
            <div>
              <label className="block text-[9px] uppercase text-slate-500 mb-1">Seed</label>
              <div className="flex items-center gap-1.5">
                <input type="text" value={seed} onChange={e => setSeed(e.target.value)}
                  className="flex-1 bg-black/60 border border-white/10 rounded-lg px-2 py-1.5 text-xs text-white font-mono focus:outline-none focus:border-orange-500/50" />
                <button onClick={randomizeSeed} title="Randomize seed"
                  className="w-8 h-8 shrink-0 flex items-center justify-center bg-black/60 border border-white/10 rounded-lg text-slate-400 hover:text-orange-400 hover:border-orange-500/40 transition-colors">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-3.5 h-3.5"><path d="M17 2l4 4-4 4"/><path d="M3 12h18"/><path d="M7 22l-4-4 4-4"/></svg>
                </button>
              </div>
            </div>
          </div>
          {activeView === 'arranger' && (
            <div className="space-y-4">
              <div className="border border-white/10 rounded-2xl overflow-hidden bg-black/20">
                <button onClick={() => setIsSectionsExpanded(!isSectionsExpanded)}
                  className="w-full px-3.5 py-2.5 bg-white/5 flex justify-between items-center text-[10px] font-bold uppercase tracking-widest text-slate-300 hover:bg-white/10">
                  <span>Arrangement</span>
                  <span>{isSectionsExpanded ? '▼' : '▶'}</span>
                </button>
                {isSectionsExpanded && (
                  <div className="p-3 space-y-3 max-h-[220px] overflow-y-auto custom-scrollbar border-t border-white/5">
                    {sections.map((section, idx) => (
                      <div key={section.id} className="bg-black/40 border border-white/5 p-2.5 rounded-xl relative group">
                        <div className="flex items-center justify-between gap-1 mb-1.5">
                          <input type="text" value={section.name}
                            onChange={(e) => updateSection(section.id, { name: e.target.value })}
                            className="bg-transparent text-xs font-bold text-white focus:outline-none focus:border-b border-orange-500/50 w-2/3" />
                          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button onClick={() => moveSectionUp(idx)} className="text-white/40 hover:text-white" title="Move Up"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-3 h-3 rotate-90"><path d="M5 12h14"/><path d="M12 5l7 7-7 7"/></svg></button>
                            <button onClick={() => moveSectionDown(idx)} className="text-white/40 hover:text-white" title="Move Down"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-3 h-3 rotate-90"><path d="M5 12h14"/><path d="M12 19l7-7-7-7"/></svg></button>
                            <button onClick={() => removeSection(section.id)} className="text-white/40 hover:text-red-400" title="Delete"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-3 h-3"><path d="M3 6h18"/><path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6"/><path d="M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2"/></svg></button>
                          </div>
                        </div>
                        <div className="grid grid-cols-2 gap-1.5">
                          <select value={section.preset} onChange={(e) => updateSection(section.id, { preset: e.target.value as any })}
                            className="bg-black/60 border border-white/10 rounded px-1.5 py-0.5 text-[9px] text-slate-300">
                            <option value="pop">Pop Std</option>
                            <option value="steely">Yacht (Steely)</option>
                            <option value="stevie">Soul (Stevie)</option>
                            <option value="isley">R&B (Isley)</option>
                            <option value="gospel">Gospel Neo</option>
                          </select>
                          <select value={section.lengthBars} onChange={(e) => updateSection(section.id, { lengthBars: parseInt(e.target.value) })}
                            className="bg-black/60 border border-white/10 rounded px-1.5 py-0.5 text-[9px] text-slate-300">
                            {[4, 8, 12, 16].map(b => <option key={b} value={b}>{b} Bars</option>)}
                          </select>
                        </div>
                      </div>
                    ))}
                    <button onClick={addSection} className="w-full border border-dashed border-white/20 hover:border-orange-500/50 hover:bg-orange-500/5 text-[10px] py-1.5 rounded-lg text-slate-400 hover:text-white transition-all font-mono">+ ADD SECTION</button>
                  </div>
                )}
              </div>
              <button onClick={handleGenerate} className="w-full bg-gradient-to-r from-orange-500 to-amber-500 text-black font-bold uppercase tracking-widest text-xs py-3 rounded-xl hover:from-orange-400 hover:to-amber-400 transition-all flex items-center justify-center gap-2 shadow-lg shadow-orange-500/10">
                <Settings size={14} /> Generate Full Score
              </button>
            </div>
          )}
        </div>
        <div className="text-[9px] font-mono text-slate-600 border-t border-white/5 pt-4 mt-6">
          <span>DE_ENGINE v1.2 • DRIVER_OK</span>
        </div>
      </aside>

      <div className="flex-1 flex flex-col h-full overflow-hidden relative">
        <header className="h-14 px-6 flex items-center justify-between border-b border-white/10 bg-black/30 backdrop-blur-md shrink-0 select-none">
          <div className="flex items-center gap-2">
            <img src="/logo.png" alt="" className="w-7 h-7 rounded-md object-contain shrink-0" />
            <button onClick={() => setSidebarOpen(!sidebarOpen)} className="p-1.5 rounded-lg bg-white/5 border border-white/10 text-slate-400 hover:text-white hover:bg-white/10 transition-all flex items-center justify-center mr-2" title={sidebarOpen ? 'Hide Sidebar' : 'Show Sidebar'}>
              <Menu size={14} />
            </button>
            <span className="text-[9px] font-bold uppercase tracking-wider text-slate-500">Workspace:</span>
            <span className="text-[10px] font-sans font-extrabold text-orange-400 bg-orange-500/10 px-3 py-1 rounded-full border border-orange-500/20 uppercase tracking-widest flex items-center gap-1.5 shadow-[0_0_15px_rgba(249,115,22,0.1)]">
              {viewIcons[activeView].icon} {viewIcons[activeView].label}
            </span>
          </div>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 bg-white/5 p-1 rounded-xl border border-white/10">
              <input value={projectName} onChange={e => setProjectName(e.target.value)} className="bg-transparent text-[10px] font-bold text-white px-2 w-32 focus:outline-none" />
              <button onClick={saveProject} disabled={isSaving} className={`p-1.5 rounded-lg hover:bg-white/10 transition-all flex items-center gap-1.5 ${saveError ? 'text-red-400' : 'text-slate-400 hover:text-orange-400'}`} title={saveError || 'Save Project'}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={`w-3.5 h-3.5 ${isSaving ? 'animate-spin' : ''}`}><path d="M19 21H5a2 2 0 01-2-2V5a2 2 0 012-2h11l5 5v11a2 2 0 01-2 2z"/><path d="M17 21v-8H7v8"/><path d="M7 3v5h8"/></svg>
                <span className="text-[9px] uppercase font-bold">{isSaving ? 'Saving...' : 'Save'}</span>
              </button>
              <button onClick={() => { setIsProjectListOpen(!isProjectListOpen); loadUserProjects(); }} className="p-1.5 rounded-lg hover:bg-white/10 text-slate-400 hover:text-blue-400 transition-all flex items-center gap-1.5" title="Open Projects">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-3.5 h-3.5"><path d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z"/></svg>
                <span className="text-[9px] uppercase font-bold">Open</span>
              </button>
              <button onClick={() => useProjectStore.getState().exportProjectToFile()} className="p-1.5 rounded-lg hover:bg-white/10 text-slate-400 hover:text-green-400 transition-all flex items-center gap-1.5" title="Export to File">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-3.5 h-3.5">
                  <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>
                </svg>
                <span className="text-[9px] uppercase font-bold">Export</span>
              </button>
            </div>
              <div className="h-4 w-px bg-white/10" />
            <button
              onClick={() => {
                import('./lib/midiExport').then(({ generateMIDI, downloadMIDI }) => {
                  const midi = generateMIDI(generated, transport.tempo, musicKey);
                  downloadMIDI(midi, `chord-engine-${Date.now()}.mid`);
                });
              }}
              disabled={generated.length === 0}
              className="flex items-center gap-1 px-2 py-1 rounded-lg border border-white/10 text-[9px] font-mono text-slate-400 hover:text-orange-400 transition-all disabled:opacity-30"
              title="Export MIDI"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-3 h-3"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
              MIDI
            </button>
            <button
              onClick={async () => {
                const { bounceToWav, downloadWav } = await import('./lib/audioBounce');
                const totalBars = generated.reduce((sum, s) => sum + s.def.lengthBars, 0);
                const wav = await bounceToWav(generated, totalBars, transport.tempo);
                downloadWav(wav, `bounce-${Date.now()}.wav`);
              }}
              disabled={generated.length === 0}
              className="flex items-center gap-1 px-2 py-1 rounded-lg border border-white/10 text-[9px] font-mono text-slate-400 hover:text-orange-400 transition-all disabled:opacity-30"
              title="Bounce to WAV"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-3 h-3"><path d="M3 18v-6a9 9 0 0118 0v6"/><path d="M21 19a2 2 0 01-2 2h-1a2 2 0 01-2-2v-3a2 2 0 012-2h3zM3 19a2 2 0 002 2h1a2 2 0 002-2v-3a2 2 0 00-2-2H3z"/></svg>
              Bounce
            </button>
            <div className="h-4 w-px bg-white/10" />
            <div className="flex items-center gap-1.5 text-[9px] text-slate-400 bg-slate-400/5 px-2 py-1 rounded-md border border-white/5">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              <span className="font-mono tracking-wider font-bold">128-BIT ENGINE</span>
            </div>
          </div>
        </header>

        {isProjectListOpen && (
          <div className="absolute top-14 right-6 w-80 bg-[#06070e] border border-white/10 rounded-2xl shadow-2xl z-50 p-4 animate-in fade-in slide-in-from-top-2">
            <h3 className="text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-3 border-b border-white/5 pb-2">Your Projects</h3>
            <div className="space-y-2 max-h-60 overflow-y-auto custom-scrollbar">
              {userProjects.length === 0 ? (
                <div className="text-[10px] text-slate-600 italic p-4 text-center">No projects found.</div>
              ) : (
                userProjects.map(proj => (
                  <button key={proj.id} onClick={() => loadProject(proj)} className="w-full p-2.5 rounded-xl bg-white/5 border border-transparent hover:border-orange-500/30 hover:bg-orange-500/5 text-left transition-all group">
                    <div className="text-xs font-bold text-slate-200 group-hover:text-white">{proj.name}</div>
                    <div className="text-[9px] text-slate-500 font-mono flex justify-between mt-1">
                      <span>{proj.key} • {proj.tempo} BPM</span>
                      <span>{proj.updatedAt ? new Date(proj.updatedAt).toLocaleDateString() : 'Recently'}</span>
                    </div>
                  </button>
                ))
              )}
            </div>
          </div>
        )}

        <div className="flex-1 overflow-y-auto px-6 pt-6 pb-24 h-full custom-scrollbar">
          {activeView === 'arranger' && (
            <div className="grid grid-cols-1 xl:grid-cols-3 gap-8 items-start">
              <div className="xl:col-span-2">
                <LeadSheet sections={generated} musicKey={musicKey} onSubstitute={handleSubstitute} />
                {reframeTarget !== 'none' && reframedSections.length > 0 && (
                  <div className="mt-8 bg-gradient-to-b from-[#151221] to-[#0b0a12] border border-orange-500/20 rounded-[40px] p-8 shadow-2xl space-y-6 animate-in fade-in slide-in-from-bottom-4">
                    <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-white/5 pb-4">
                      <div className="flex items-center gap-3">
                        <div className="p-2 bg-orange-500/10 border border-orange-500/30 rounded-xl text-orange-400"><Disc size={18} className="animate-spin" /></div>
                        <div>
                          <h3 className="text-lg font-bold text-white">MPC-Chop Rhythmic Re-framer Console</h3>
                          <p className="text-[10px] text-slate-400 uppercase font-mono tracking-widest mt-0.5">Vintage Changes • Contemporary Production Grid</p>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
              <div className="xl:col-span-1">
                <ArrangementCriticPanel sections={generated} musicKey={musicKey} selectedWriter={dominantWriter} onApplyFix={handleApplyCriticFix} />
              </div>
            </div>
          )}
          {activeView === 'blender' && (
            <OntologyBlenderView
              writerWeights={writerWeights}
              setWriterWeights={setWriterWeights}
              handleCompileSong={handleCompileSong}
              handleGenerate={handleGenerate}
              musicKey={musicKey}
            />
          )}
          {activeView === 'reframer' && (
            <MpcReframerView
              reframedSections={reframedSections}
              reframeTarget={reframeTarget}
              setReframeTarget={setReframeTarget}
              activeReframeSec={activeReframeSec}
              setActiveReframeSec={setActiveReframeSec}
              generatedSections={generated}
              musicKey={musicKey}
            />
          )}
          {activeView === 'rhythm' && <RhythmGrid />}
          {activeView === 'instruments' && <InstrumentsView />}
          {activeView === 'parts' && (
            <PartsView sections={generated} musicKey={musicKey}
              onSectionsUpdate={(updated) => useGenerationStore.getState().setGenerated(updated)}
            />
          )}
          {activeView === 'mixer' && <MixerView />}
        </div>

        <TransportBar />
      </div>
      </div>
    </div>
  );
}
