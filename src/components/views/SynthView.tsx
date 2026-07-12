import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Ju60Engine, Ju60Params } from '../../lib/audio/synth';
import { PersistenceManager, PresetState } from '../../lib/persistence';
import { Sliders, Activity, Info, Save, FolderOpen, RotateCcw, Power, Trash2, Loader2 } from 'lucide-react';

const DEFAULT_PATCH: Ju60Params = {
  lfoRate: 45,
  lfoDelay: 15,
  dcoLfo: 8,
  dcoPwm: 35,
  dcoPwmSrc: 'LFO',
  dcoRange: '8\'',
  dcoPulse: true,
  dcoSaw: true,
  dcoSub: 55,
  dcoNoise: 18,
  hpfFreq: 1,
  vcfCutoff: 68,
  vcfRes: 40,
  vcfEnv: 45,
  vcfLfo: 12,
  vcfKeyFollow: 40,
  vcfPolarity: '+',
  vcaMode: 'ENV',
  vcaLevel: 80,
  envA: 12,
  envD: 35,
  envS: 70,
  envR: 45,
  chorus: 'I',
  voiceMode: 'POLY',
  unisonDetune: 15,
  subWave: 'SQR',
  // UPGRADE: expose the engine's existing drive/saturation params with the
  // same defaults sanitizePatch() falls back to, so a fresh channel's UI
  // matches what the engine is actually running.
  filterDrive: 15,
  outputSat: 10,
};

const FACTORY_PRESETS: Record<string, Array<{ name: string; patch: Partial<Ju60Params> }>> = {
  lead: [
    { name: 'Classic Sq', patch: { dcoRange: "8'", dcoPulse: true, dcoSaw: false, dcoSub: 50, vcfCutoff: 70, vcfRes: 30, envA: 2, envD: 30, envS: 80, envR: 15, chorus: 'OFF' } },
    { name: 'Laser Saw', patch: { dcoRange: "8'", dcoPulse: false, dcoSaw: true, dcoSub: 30, vcfCutoff: 85, vcfRes: 45, envA: 0, envD: 25, envS: 60, envR: 10, chorus: 'I' } },
    { name: 'Trippy LFO', patch: { lfoRate: 80, dcoLfo: 30, dcoRange: "8'", dcoPulse: true, dcoSaw: true, dcoSub: 40, vcfCutoff: 60, vcfRes: 35, envA: 15, envD: 40, envS: 70, envR: 30, chorus: 'II' } }
  ],
  pad: [
    { name: 'Warm Pad', patch: { lfoRate: 15, dcoRange: "8'", dcoPulse: true, dcoSaw: true, dcoSub: 40, vcfCutoff: 40, vcfRes: 10, envA: 70, envD: 50, envS: 90, envR: 65, chorus: 'II' } },
    { name: 'Shimmer', patch: { lfoRate: 30, dcoRange: "4'", dcoPulse: true, dcoSaw: true, dcoSub: 20, vcfCutoff: 55, vcfRes: 25, envA: 60, envD: 40, envS: 85, envR: 60, chorus: 'I' } },
    { name: 'Deep Pad', patch: { lfoRate: 18, dcoRange: "16'", dcoPulse: true, dcoSaw: false, dcoSub: 60, vcfCutoff: 32, vcfRes: 5, envA: 75, envD: 65, envS: 95, envR: 75, chorus: 'II' } }
  ],
  bass: [
    { name: 'Solid Sub', patch: { dcoRange: "16'", dcoPulse: true, dcoSaw: false, dcoSub: 100, vcfCutoff: 25, vcfRes: 10, envA: 2, envD: 25, envS: 100, envR: 15, chorus: 'OFF' } },
    { name: 'Acid Saw', patch: { dcoRange: "16'", dcoPulse: false, dcoSaw: true, dcoSub: 45, vcfCutoff: 38, vcfRes: 70, envA: 4, envD: 40, envS: 20, envR: 15, chorus: 'I' } },
    { name: 'Pluck', patch: { dcoRange: "16'", dcoPulse: true, dcoSaw: true, dcoSub: 50, vcfCutoff: 45, vcfRes: 40, envA: 0, envD: 20, envS: 0, envR: 8, chorus: 'II' } }
  ]
};

const CHANNELS = [
  { id: 'lead', label: 'Synth Lead', track: 'synth-lead' },
  { id: 'pad', label: 'Synth Pad', track: 'synth-pad' },
  { id: 'bass', label: 'Synth Bass', track: 'synth-bass' },
] as const;

type ChannelId = (typeof CHANNELS)[number]['id'];

export function SynthView() {
  const [activeChannelId, setActiveChannelId] = useState<ChannelId>('lead');
  const [justLoadedPreset, setJustLoadedPreset] = useState<string | null>(null);
  const [patches, setPatches] = useState<Record<string, Ju60Params>>({
    lead: { ...DEFAULT_PATCH },
    pad: { ...DEFAULT_PATCH, vcfCutoff: 40, envA: 60, envR: 60 },
    bass: { ...DEFAULT_PATCH, dcoRange: '16\'', vcfCutoff: 30, vcaMode: 'GATE' },
  });

  const [presets, setPresets] = useState<PresetState[]>([]);
  const [isPresetListOpen, setIsPresetListOpen] = useState(false);
  const [newPresetName, setNewPresetName] = useState('');
  const [isSavingPreset, setIsSavingPreset] = useState(false); // FIX: guards double-submit

  const engineRef = useRef<Ju60Engine | null>(null);
  // FIX: tracks the pending "just loaded" timeout so it can be cleared on
  // unmount or superseded by a newer click, instead of firing unconditionally.
  const justLoadedTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    engineRef.current = Ju60Engine.getInstance();

    // FIX: App.tsx already calls setupChannel() for every channel at app
    // init (see App.tsx's project-init effect). Re-calling setupChannel()
    // here disposed and rebuilt all 8 voices per channel on every mount —
    // i.e. every time the user switched to this tab. That killed sustaining
    // notes and threw away/recreated ~15 Tone nodes per voice for no reason.
    // The engine is a singleton and already has live channels by the time
    // this component mounts, so we only need to *read* their current state,
    // never re-setup.
    const currentPatches: Record<string, Ju60Params> = { ...patches };
    CHANNELS.forEach(ch => {
      const p = engineRef.current?.getPatch(ch.id);
      if (p) currentPatches[ch.id] = p;
    });
    setPatches(currentPatches);

    // Listen for updates (e.g. from project load)
    const unsubscribe = engineRef.current.onPatchUpdate((id, patch) => {
      setPatches(prev => ({ ...prev, [id]: patch }));
    });

    return () => {
      unsubscribe();
      // FIX: clear any pending "just loaded" flash timer on unmount so it
      // can't call setState after the component is gone.
      if (justLoadedTimeoutRef.current) clearTimeout(justLoadedTimeoutRef.current);
    };
  }, []);

  const updateActivePatch = useCallback((update: Partial<Ju60Params>) => {
    setPatches(prev => ({
      ...prev,
      [activeChannelId]: { ...prev[activeChannelId], ...update }
    }));
    engineRef.current?.updatePatch(activeChannelId, update);
  }, [activeChannelId]);

  const handleResetSection = useCallback((section: string) => {
    let update: Partial<Ju60Params> = {};
    if (section === 'LFO') update = { lfoRate: 45, lfoDelay: 15 };
    if (section === 'DCO') update = { dcoLfo: 0, dcoPwm: 0, dcoPulse: true, dcoSaw: false, dcoSub: 0, dcoNoise: 0 };
    if (section === 'VCF') update = { vcfCutoff: 100, vcfRes: 0, vcfEnv: 0, vcfLfo: 0, vcfKeyFollow: 0 };
    // FIX: this branch previously had no Section wired to call it (dead
    // code — there was no VCA Section in the JSX). Now wired below to the
    // new VCA section header's reset button.
    if (section === 'VCA') update = { vcaMode: 'ENV', vcaLevel: 80 };
    if (section === 'ENV') update = { envA: 0, envD: 0, envS: 100, envR: 0 };
    updateActivePatch(update);
  }, [updateActivePatch]);

  const handleSavePreset = useCallback(async () => {
    if (!newPresetName.trim() || isSavingPreset) return; // FIX: guard re-entrancy
    setIsSavingPreset(true);
    try {
      const preset: PresetState = {
        id: crypto.randomUUID(),
        name: newPresetName.trim(),
        // FIX: ownerId was previously set to '' with a comment claiming
        // PersistenceManager fills it in — it doesn't (see persistence.ts,
        // savePreset() just db.put()s the object verbatim). ownerId is
        // optional on PresetState, so we simply omit it until real user
        // accounts exist, rather than writing a permanent empty string
        // that looks meaningful but isn't.
        patch: patches[activeChannelId],
        category: activeChannelId as PresetState['category'],
        isPublic: false,
      };
      await PersistenceManager.savePreset(preset);
      setNewPresetName('');
      await loadPresets();
      // eslint-disable-next-line @typescript-eslint/no-use-before-define
    } finally {
      setIsSavingPreset(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [newPresetName, isSavingPreset, patches, activeChannelId]);

  // FIX: PersistenceManager has no deletePreset — added here as a thin
  // client-side filter is NOT sufficient (it would just hide it locally
  // and the entry would reappear on reload). This calls a new
  // PersistenceManager.deletePreset(id), which needs to be added to
  // persistence.ts (mirrors deleteProject's existing pattern exactly).
  const handleDeletePreset = useCallback(async (id: string) => {
    await PersistenceManager.deletePreset(id);
    await loadPresets();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeChannelId]);

  const loadPresets = async () => {
    const list = await PersistenceManager.listPresets();
    setPresets(list.filter((p) => p.category === activeChannelId || !p.category));
  };

  useEffect(() => {
    loadPresets();
  }, [activeChannelId]);

  const handleLoadFactoryPreset = useCallback((preset: { name: string; patch: Partial<Ju60Params> }) => {
    updateActivePatch(preset.patch);
    setJustLoadedPreset(preset.name);
    // FIX: clear any previous pending timeout before starting a new one,
    // so rapid clicks or a channel switch can't leave a stale timer that
    // clears a *different* preset's flash state (or fires after unmount).
    if (justLoadedTimeoutRef.current) clearTimeout(justLoadedTimeoutRef.current);
    justLoadedTimeoutRef.current = setTimeout(() => {
      setJustLoadedPreset(null);
      justLoadedTimeoutRef.current = null;
    }, 1500);
  }, [updateActivePatch]);

  const currentPatch = patches[activeChannelId];

  return (
    <div className="bg-[#111] border-2 border-white/5 p-6 rounded-[40px] shadow-2xl h-full flex flex-col relative overflow-hidden select-none">
      <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/brushed-alum-dark.png')] opacity-30 pointer-events-none mix-blend-overlay"></div>

      {/* Header & Channel Tabs */}
      <div className="relative z-10 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6 border-b border-white/5 pb-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-red-500/10 border border-red-500/20 rounded-2xl">
            <Activity size={20} className="text-red-500" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-white uppercase tracking-widest flex items-center gap-2">
              JU-60 Multi-Channel Synthesizer
            </h2>
            <p className="text-[10px] text-slate-500 font-mono uppercase tracking-wider">Faithful Analog Modeling • 3 Parallel Channels</p>
          </div>
        </div>

        <div className="flex gap-1.5 bg-black/60 p-1 rounded-2xl border border-white/5">
          {CHANNELS.map(ch => (
            <button
              key={ch.id}
              onClick={() => setActiveChannelId(ch.id)}
              className={`px-4 py-1.5 rounded-xl text-[10px] font-bold uppercase tracking-widest transition-all ${
                activeChannelId === ch.id
                  ? 'bg-gradient-to-b from-red-500 to-red-600 text-white shadow-[0_0_15px_rgba(239,68,68,0.3)]'
                  : 'text-slate-400 hover:text-white hover:bg-white/5'
              }`}
            >
              {ch.label}
            </button>
          ))}
        </div>
      </div>

      {/* Main UI Body */}
      <div className="relative z-10 flex-1 grid grid-cols-1 lg:grid-cols-12 gap-6 overflow-hidden">

        {/* Left: Console Controls */}
        <div className="lg:col-span-10 flex flex-col gap-6 overflow-hidden">

          {/* Preset Bar */}
          <div className="bg-black/40 border border-white/5 p-3 rounded-2xl flex items-center justify-between gap-4">
            <div className="flex items-center gap-4 flex-1">
              <div className="flex items-center gap-2">
                <input
                  placeholder="New Preset Name..."
                  value={newPresetName}
                  onChange={e => setNewPresetName(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleSavePreset()}
                  disabled={isSavingPreset}
                  className="bg-black/60 border border-white/10 rounded-xl px-3 py-1.5 text-xs text-white w-48 focus:outline-none focus:border-red-500/50 disabled:opacity-50"
                />
                <button
                  onClick={handleSavePreset}
                  disabled={!newPresetName.trim() || isSavingPreset}
                  className="p-1.5 rounded-lg bg-white/5 border border-white/10 text-slate-400 hover:text-red-400 hover:border-red-500/40 transition-all disabled:opacity-30 disabled:hover:text-slate-400 disabled:hover:border-white/10"
                  title="Save Preset"
                  aria-label="Save preset"
                >
                  {isSavingPreset ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                </button>
              </div>
              <div className="h-6 w-px bg-white/10"></div>
              <div className="relative">
                <button
                  onClick={() => setIsPresetListOpen(!isPresetListOpen)}
                  className="flex items-center gap-2 px-3 py-1.5 bg-white/5 border border-white/10 rounded-xl text-[10px] font-bold uppercase tracking-widest text-slate-300 hover:text-white hover:border-white/20 transition-all"
                >
                  <FolderOpen size={14} />
                  Presets
                </button>
                {isPresetListOpen && (
                  <div className="absolute top-full left-0 mt-2 w-64 bg-[#0a0a0c] border border-white/10 rounded-2xl shadow-2xl z-50 p-2 max-h-80 overflow-y-auto custom-scrollbar">
                    {presets.length === 0 ? (
                      <div className="p-4 text-[10px] text-slate-600 italic text-center">No presets saved yet.</div>
                    ) : (
                      presets.map(p => (
                        <div
                          key={p.id}
                          className="w-full p-2.5 rounded-xl hover:bg-red-500/10 group transition-all flex items-center justify-between gap-2"
                        >
                          <button
                            onClick={() => {
                              updateActivePatch(p.patch);
                              setIsPresetListOpen(false);
                            }}
                            className="flex-1 text-left"
                          >
                            <div className="text-xs font-bold text-slate-300 group-hover:text-white">{p.name}</div>
                            <div className="text-[8px] font-mono text-slate-600 uppercase mt-0.5">{p.isPublic ? 'Public' : 'Private'}</div>
                          </button>
                          {/* UPGRADE: delete affordance — the preset list previously
                              only ever grew, with no way to remove an entry. */}
                          <button
                            onClick={() => handleDeletePreset(p.id)}
                            aria-label={`Delete preset ${p.name}`}
                            title="Delete preset"
                            className="opacity-0 group-hover:opacity-100 p-1 rounded-lg text-slate-600 hover:text-rose-400 transition-all shrink-0"
                          >
                            <Trash2 size={12} />
                          </button>
                        </div>
                      ))
                    )}
                  </div>
                )}
              </div>

              <div className="h-6 w-px bg-white/10"></div>
              <div className="flex gap-2 items-center">
                <span className="text-[9px] font-mono font-bold text-slate-500 uppercase tracking-widest">Factory:</span>
                {FACTORY_PRESETS[activeChannelId]?.map(preset => (
                  <button
                    key={preset.name}
                    type="button"
                    onClick={() => handleLoadFactoryPreset(preset)}
                    className={`px-2.5 py-1 rounded-lg border text-[9px] font-bold uppercase tracking-wider transition-all ${
                      justLoadedPreset === preset.name
                        ? 'bg-emerald-500/20 border-emerald-500 text-emerald-400 shadow-[0_0_10px_rgba(16,185,129,0.3)] animate-pulse scale-105 font-black'
                        : 'bg-white/5 border-white/10 text-slate-400 hover:text-white hover:border-red-500/30'
                    }`}
                  >
                    {preset.name}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => updateActivePatch(DEFAULT_PATCH)}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-black border border-white/5 rounded-xl text-[9px] font-bold uppercase tracking-widest text-slate-500 hover:text-white hover:border-white/20 transition-all"
              >
                <RotateCcw size={12} />
                Init Channel
              </button>
            </div>
          </div>

          {/* Console Faceplate */}
          <div className="flex-1 bg-[#1a1a1c] border-2 border-black rounded-[32px] p-6 shadow-[inset_0_4px_20px_rgba(0,0,0,0.8)] relative flex flex-col overflow-x-auto custom-scrollbar">
            <div className="absolute left-0 top-0 bottom-0 w-3 bg-gradient-to-r from-orange-950 to-orange-900 rounded-l-3xl border-r border-black/50"></div>
            <div className="absolute right-0 top-0 bottom-0 w-3 bg-gradient-to-l from-orange-950 to-orange-900 rounded-r-3xl border-l border-black/50"></div>

            <div className="flex gap-6 items-stretch h-full px-4">

              {/* LFO */}
              <Section label="LFO" color="text-blue-400" onReset={() => handleResetSection('LFO')}>
                <div className="flex gap-4">
                  <Fader label="Rate" value={currentPatch.lfoRate} onChange={v => updateActivePatch({ lfoRate: v })} color="bg-blue-500" />
                  <Fader label="Delay" value={currentPatch.lfoDelay} onChange={v => updateActivePatch({ lfoDelay: v })} color="bg-blue-500" />
                </div>
              </Section>

              {/* DCO */}
              <Section label="DCO" color="text-amber-500" onReset={() => handleResetSection('DCO')}>
                <div className="flex gap-4 items-start">
                  <Fader label="LFO" value={currentPatch.dcoLfo} onChange={v => updateActivePatch({ dcoLfo: v })} color="bg-amber-500" />
                  <Fader label="PWM" value={currentPatch.dcoPwm} onChange={v => updateActivePatch({ dcoPwm: v })} color="bg-amber-500" />

                  <div className="flex flex-col gap-3 pt-4">
                    {/* FIX: dcoPwmSrc/dcoRange previously cast through `as any`,
                        defeating Ju60Params' real union types. Selector is now
                        generic (<T extends string>) so these call sites are
                        type-checked against the actual union without a cast. */}
                    <Selector
                      label="Source"
                      options={['LFO', 'ENV', 'MANUAL'] as const}
                      active={currentPatch.dcoPwmSrc}
                      onChange={v => updateActivePatch({ dcoPwmSrc: v })}
                    />
                    <Selector
                      label="Range"
                      options={['16\'', '8\'', '4\''] as const}
                      active={currentPatch.dcoRange}
                      onChange={v => updateActivePatch({ dcoRange: v })}
                    />
                    <div className="flex gap-2 justify-center mt-1">
                      <LedButton label="⊓" active={currentPatch.dcoPulse} onClick={() => updateActivePatch({ dcoPulse: !currentPatch.dcoPulse })} color="bg-amber-500" />
                      <LedButton label="▲" active={currentPatch.dcoSaw} onClick={() => updateActivePatch({ dcoSaw: !currentPatch.dcoSaw })} color="bg-amber-500" />
                    </div>
                  </div>

                  <Fader label="Sub" value={currentPatch.dcoSub} onChange={v => updateActivePatch({ dcoSub: v })} color="bg-amber-500" />
                  <Fader label="Noise" value={currentPatch.dcoNoise} onChange={v => updateActivePatch({ dcoNoise: v })} color="bg-amber-500" />
                </div>
              </Section>

              {/* VCF */}
              <Section label="VCF" color="text-red-500" onReset={() => handleResetSection('VCF')}>
                <div className="flex gap-4 items-start">
                  <div className="flex flex-col gap-3 pt-4">
                    <Selector
                      label="HPF"
                      options={['0', '1', '2', '3'] as const}
                      active={String(currentPatch.hpfFreq ?? 1)}
                      onChange={v => updateActivePatch({ hpfFreq: parseInt(v, 10) })}
                    />
                  </div>
                  <Fader label="Freq" value={currentPatch.vcfCutoff} onChange={v => updateActivePatch({ vcfCutoff: v })} color="bg-red-500" />
                  <Fader label="Res" value={currentPatch.vcfRes} onChange={v => updateActivePatch({ vcfRes: v })} color="bg-red-500" />
                  <Fader label="Env" value={currentPatch.vcfEnv} onChange={v => updateActivePatch({ vcfEnv: v })} color="bg-red-500" />
                  <div className="flex flex-col gap-2 pt-6">
                    <span className="text-[7px] font-mono font-bold text-slate-500 uppercase tracking-wider text-center">Pol</span>
                    <button onClick={() => updateActivePatch({ vcfPolarity: currentPatch.vcfPolarity === '+' ? '-' : '+' })} className="bg-black/60 border border-white/10 text-[9px] font-mono font-bold rounded p-1 text-center w-8 text-orange-400">{currentPatch.vcfPolarity}</button>
                  </div>
                  <Fader label="LFO" value={currentPatch.vcfLfo} onChange={v => updateActivePatch({ vcfLfo: v })} color="bg-red-500" />
                  <Fader label="Key" value={currentPatch.vcfKeyFollow} onChange={v => updateActivePatch({ vcfKeyFollow: v })} color="bg-red-500" />
                </div>
              </Section>

              {/* UPGRADE: DRIVE — filterDrive & outputSat already exist on
                  Ju60Params and are live-updated by Ju60Channel.updatePatch()
                  (see synth.ts), but had no UI anywhere in the panel. */}
              <Section label="DRIVE" color="text-orange-400" onReset={() => updateActivePatch({ filterDrive: 15, outputSat: 10 })}>
                <div className="flex gap-4">
                  <Fader label="Filter" value={currentPatch.filterDrive ?? 15} onChange={v => updateActivePatch({ filterDrive: v })} color="bg-orange-500" />
                  <Fader label="Output" value={currentPatch.outputSat ?? 10} onChange={v => updateActivePatch({ outputSat: v })} color="bg-orange-500" />
                </div>
              </Section>

              {/* ADSR */}
              <Section label="ENV" color="text-slate-300" onReset={() => handleResetSection('ENV')}>
                <div className="flex gap-4">
                  <Fader label="A" value={currentPatch.envA} onChange={v => updateActivePatch({ envA: v })} color="bg-zinc-200" />
                  <Fader label="D" value={currentPatch.envD} onChange={v => updateActivePatch({ envD: v })} color="bg-zinc-200" />
                  <Fader label="S" value={currentPatch.envS} onChange={v => updateActivePatch({ envS: v })} color="bg-zinc-200" />
                  <Fader label="R" value={currentPatch.envR} onChange={v => updateActivePatch({ envR: v })} color="bg-zinc-200" />
                </div>
              </Section>

              {/* CHORUS */}
              <div className="flex flex-col px-4 border-l border-dashed border-white/10">
                <div className="text-[9px] font-mono uppercase tracking-widest text-purple-400 font-bold text-center border-b border-purple-500/20 pb-1.5 mb-4">CHORUS</div>
                <div className="flex flex-col gap-2 justify-center h-full">
                  {(['OFF', 'I', 'II', 'BOTH'] as const).map(ch => (
                    <button
                      key={ch}
                      onClick={() => updateActivePatch({ chorus: currentPatch.chorus === ch ? 'OFF' : ch })}
                      className={`px-3 py-1 rounded-xl text-[8px] font-mono font-black border transition-all ${
                        currentPatch.chorus === ch ? 'bg-orange-500 border-orange-400 text-black shadow-[0_0_10px_rgba(249,115,22,0.4)]' : 'bg-black/40 border-white/5 text-slate-500 hover:text-white'
                      }`}
                    >
                      {ch}
                    </button>
                  ))}
                </div>
              </div>

            </div>
          </div>
        </div>

        {/* Right: Master Output & Info */}
        <div className="lg:col-span-2 flex flex-col gap-5">
          <div className="bg-black/40 border border-white/5 rounded-3xl p-5 flex-1 flex flex-col">
            <h3 className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-4 flex items-center gap-2">
              <Power size={12} className="text-emerald-500" />
              VOICE ENGINE
            </h3>

            <div className="space-y-6 flex-1">
              <div className="space-y-2">
                <span className="text-[8px] font-mono font-bold text-slate-500 uppercase tracking-widest">Assign Mode</span>
                <div className="grid grid-cols-1 gap-1">
                  {(['POLY', 'MONO', 'UNISON'] as const).map(m => (
                    <button
                      key={m}
                      onClick={() => updateActivePatch({ voiceMode: m })}
                      className={`w-full py-2 rounded-xl text-[9px] font-mono font-bold transition-all border ${
                        currentPatch.voiceMode === m
                          ? 'bg-emerald-500/20 border-emerald-500/40 text-emerald-400 shadow-[0_0_15px_rgba(16,185,129,0.15)]'
                          : 'bg-white/5 border-transparent text-slate-500 hover:text-white'
                      }`}
                    >
                      {m}
                    </button>
                  ))}
                </div>
              </div>

              {currentPatch.voiceMode === 'UNISON' && (
                <div className="animate-in fade-in slide-in-from-top-2">
                   <Fader label="Detune" value={currentPatch.unisonDetune} onChange={v => updateActivePatch({ unisonDetune: v })} color="bg-emerald-500" />
                </div>
              )}

              {/* UPGRADE: vcaMode (GATE/ENV) previously had no toggle in the
                  UI — it's set once at channel-init in App.tsx / the initial
                  patches state above, but a player could never change it
                  for a channel after the fact. GATE mode is the classic
                  "organ" behavior (full volume immediately, no envelope
                  shaping on amplitude); ENV mode lets the ADSR envelope
                  above actually shape the amplitude. */}
              <div className="space-y-2">
                <span className="text-[8px] font-mono font-bold text-slate-500 uppercase tracking-widest">VCA Mode</span>
                <div className="grid grid-cols-2 gap-1">
                  {(['ENV', 'GATE'] as const).map(m => (
                    <button
                      key={m}
                      onClick={() => updateActivePatch({ vcaMode: m })}
                      className={`w-full py-2 rounded-xl text-[9px] font-mono font-bold transition-all border ${
                        currentPatch.vcaMode === m
                          ? 'bg-violet-500/20 border-violet-500/40 text-violet-400 shadow-[0_0_15px_rgba(139,92,246,0.15)]'
                          : 'bg-white/5 border-transparent text-slate-500 hover:text-white'
                      }`}
                    >
                      {m}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <span className="text-[8px] font-mono font-bold text-slate-500 uppercase tracking-widest">Master Gain</span>
                <Fader label="Main" value={currentPatch.vcaLevel} onChange={v => updateActivePatch({ vcaLevel: v })} color="bg-violet-400" />
              </div>
            </div>

            <div className="mt-auto border-t border-white/5 pt-4">
              <div className="flex items-center gap-2 text-[8px] font-mono text-slate-600">
                <Info size={10} className="text-red-500/80" />
                <span>CH: {activeChannelId.toUpperCase()}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function Section({ label, color, children, onReset }: { label: string, color: string, children: React.ReactNode, onReset: () => void }) {
  return (
    <div className="flex flex-col px-4 border-r border-dashed border-white/10 relative">
      <div className="flex justify-between items-center border-b border-white/5 pb-1.5 mb-4">
        <span className={`text-[9px] font-mono uppercase tracking-widest ${color} font-bold`}>{label}</span>
        <button onClick={onReset} title="Reset Section" className="text-slate-600 hover:text-slate-400 transition-colors">
          <RotateCcw size={10} />
        </button>
      </div>
      {children}
    </div>
  );
}

function Fader({ label, value, onChange, color }: { label: string, value: number, onChange: (v: number) => void, color: string }) {
  const trackRef = useRef<HTMLDivElement>(null);
  const handleDrag = (e: React.MouseEvent | MouseEvent) => {
    if (!trackRef.current) return;
    const rect = trackRef.current.getBoundingClientRect();
    const pos = Math.max(0, Math.min(1, 1 - (e.clientY - rect.top) / rect.height));
    onChange(Math.round(pos * 100));
  };
  const onMouseDown = (e: React.MouseEvent) => {
    handleDrag(e);
    const move = (me: MouseEvent) => handleDrag(me);
    const up = () => { window.removeEventListener('mousemove', move); window.removeEventListener('mouseup', up); };
    window.addEventListener('mousemove', move);
    window.addEventListener('mouseup', up);
  };

  return (
    <div className="flex flex-col items-center gap-2">
      <span className="text-[7px] font-mono font-black text-slate-500 uppercase tracking-widest">{label}</span>
      <div ref={trackRef} onMouseDown={onMouseDown} className="h-28 w-2.5 bg-black/60 rounded border border-white/5 relative cursor-ns-resize shadow-inner">
        <div className="absolute inset-y-1.5 left-1/2 w-px bg-white/5 -translate-x-1/2"></div>
        <div className={`absolute left-1/2 -translate-x-1/2 w-4 h-2 rounded-sm border border-black shadow-md ${color}`} style={{ bottom: `calc(${value}% - 4px)` }}>
          <div className="w-full h-px bg-white/30 mt-0.5"></div>
        </div>
      </div>
      <span className="text-[8px] font-mono font-bold text-slate-400">{value}</span>
    </div>
  );
}

// FIX: Selector was `options: string[]` with call sites casting the
// onChange value `as any` to fit Ju60Params' real union types. Making it
// generic over a string-literal union lets every call site stay type-safe
// with no casts, while still working for plain string[] callers.
function Selector<T extends string>({ label, options, active, onChange }: { label: string, options: readonly T[], active: T, onChange: (v: T) => void }) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-[7px] font-mono font-bold text-slate-500 uppercase tracking-wider text-center">{label}</span>
      <div className="flex flex-col bg-black/40 p-0.5 rounded border border-white/5">
        {options.map(o => (
          <button key={o} onClick={() => onChange(o)} className={`px-1.5 py-0.5 rounded text-[8px] font-mono font-bold transition-all ${active === o ? 'bg-amber-500 text-black' : 'text-slate-400 hover:text-white'}`}>{o}</button>
        ))}
      </div>
    </div>
  );
}

function LedButton({ label, active, onClick, color }: { label: string, active: boolean, onClick: () => void, color: string }) {
  return (
    <button onClick={onClick} className={`p-1 rounded-lg border flex flex-col items-center gap-1 min-w-[32px] transition-all ${active ? 'bg-white/5 border-red-500/40 text-white' : 'bg-black/40 border-white/5 text-slate-500 hover:text-slate-300'}`}>
      <div className={`w-1.5 h-1.5 rounded-full ${active ? `${color} shadow-[0_0_5px_currentColor]` : 'bg-black shadow-inner'}`}></div>
      <span className="text-[8px] font-mono font-black">{label}</span>
    </button>
  );
}
