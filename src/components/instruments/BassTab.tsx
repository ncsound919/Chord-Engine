import React, { memo, useCallback, useEffect, useMemo, useState, useRef } from 'react';
import { AudioWaveform, RefreshCw, Upload, Check, Save, RotateCcw, Repeat, Trash2, FolderOpen } from 'lucide-react';
import { BassKnob, BassEQSlider, ToggleButton, ButtonGroup } from './UIPrimitives';
import { BassParams, DEFAULT_BASS_PARAMS } from './types';
import { Fretboard } from './Fretboard';
import { FACTORY_PRESETS, BassPreset, createUserPreset } from './bassPresets';
import { BassSampler, BassArticulation } from '../../lib/audio/bassSampler';
import { persistAndLoadSample } from '../../lib/audio/soundbankLoader';
import { audioEngine } from '../../lib/audio/engine';
import { BassSampleMap } from './BassSampleMap';

// ─── Strongly-typed update signature ──────────────────────
// Previously onUpdate(key: keyof BassParams, val: any) accepted any value
// for any key, so e.g. onUpdate('style', 42) or onUpdate('cabSim', 'xyz')
// would type-check even though they're invalid at runtime. This generic
// signature ties each call's key to its matching value type from
// BassParams, so a mismatched call site is now a compile error instead
// of a silent bug — while still allowing one function to handle every key.
export type BassParamUpdate = <K extends keyof BassParams>(key: K, val: BassParams[K]) => void;

interface BassTabProps {
  params: BassParams;
  onUpdate: BassParamUpdate;
  onReplaceParams: (params: BassParams) => void;
  loaded: boolean;
  loading: boolean;
  justLoaded: boolean;
  onUploadClick: () => void;
  onPlayNote: (stringIndex: number, fret: number) => void;
  activeSampleName: string;
}

// String index for keyboard playing: matches Fretboard's STRING_MIDI order [G, D, A, E]
const KEY_TO_STRING_FRET: Record<string, [number, number]> = {
  '1': [3, 0], '2': [3, 2], '3': [3, 4], '4': [3, 5], // E string
  q: [2, 0], w: [2, 2], e: [2, 4], r: [2, 5], // A string
  a: [1, 0], s: [1, 2], d: [1, 4], f: [1, 5], // D string
  z: [0, 0], x: [0, 2], c: [0, 4], v: [0, 5], // G string
};

export const BassTab = memo(({
  params,
  onUpdate,
  onReplaceParams,
  loaded: singleLoaded,
  loading,
  justLoaded,
  onUploadClick,
  onPlayNote,
  activeSampleName,
}: BassTabProps) => {
  // ─── Multi-Sample Sampler ───────────────────────────────
  const samplerRef = useRef(new BassSampler());
  const [currentArticulation, setCurrentArticulation] = useState<BassArticulation>('sustain');
  const [multiSampleLoaded, setMultiSampleLoaded] = useState(false);
  const [importingSamples, setImportingSamples] = useState(false);
  const [importCount, setImportCount] = useState(0);
  const folderInputRef = useRef<HTMLInputElement>(null);

  const handleBulkImport = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;
    setImportingSamples(true);
    setImportCount(0);
    const sampler = samplerRef.current;
    sampler.clear();

    let loaded = 0;
    for (const file of files) {
      const parsed = BassSampler.parseFilename(file.name);
      if (!parsed) continue;
      const id = `bass_${parsed.note}_${parsed.articulation}_rr${parsed.roundRobin}`;
      const data = await file.arrayBuffer();
      await persistAndLoadSample(id, `bass_${id}`, data, file.name, file.type);
      const buffer = audioEngine.loadedSamples.get(`bass_${id}`);
      if (buffer) {
        sampler.addEntry({
          note: parsed.note,
          articulation: parsed.articulation,
          velocity: 100,
          roundRobin: parsed.roundRobin,
          buffer,
          filename: file.name,
        });
        loaded++;
      }
      setImportCount(loaded);
    }
    setMultiSampleLoaded(sampler.loaded);
    setImportingSamples(false);
    e.target.value = '';
  }, []);

  // Sync articulation to sampler
  useEffect(() => {
    samplerRef.current.currentArticulation = currentArticulation;
  }, [currentArticulation]);

  // Override onPlayNote to use sampler when multi-samples are loaded
  const handlePlayNote = useCallback((stringIndex: number, fret: number) => {
    const openStringsMidi = [43, 38, 33, 28]; // G, D, A, E
    const midi = openStringsMidi[stringIndex] + fret + params.tuningCoarse;
    if (multiSampleLoaded) {
      samplerRef.current.triggerNote(midi, 100);
    } else {
      onPlayNote(stringIndex, fret);
    }
  }, [multiSampleLoaded, params.tuningCoarse, onPlayNote]);

  // ─── Presets ────────────────────────────────────────────
  const [userPresets, setUserPresets] = useState<BassPreset[]>([]);
  const [selectedPresetId, setSelectedPresetId] = useState<string | null>(null);
  const [presetNameDraft, setPresetNameDraft] = useState('');
  const [showSaveInput, setShowSaveInput] = useState(false);

  const allPresets = useMemo(() => [...FACTORY_PRESETS, ...userPresets], [userPresets]);

  const applyPreset = useCallback((preset: BassPreset) => {
    onReplaceParams(preset.params);
    setSelectedPresetId(preset.id);
  }, [onReplaceParams]);

  const handleSavePreset = useCallback(() => {
    if (!presetNameDraft.trim()) return;
    const preset = createUserPreset(presetNameDraft, params);
    setUserPresets((prev) => [...prev, preset]);
    setSelectedPresetId(preset.id);
    setPresetNameDraft('');
    setShowSaveInput(false);
  }, [presetNameDraft, params]);

  const handleDeletePreset = useCallback((id: string) => {
    setUserPresets((prev) => prev.filter((p) => p.id !== id));
    setSelectedPresetId((cur) => (cur === id ? null : cur));
  }, []);

  const handleResetToDefault = useCallback(() => {
    onReplaceParams(DEFAULT_BASS_PARAMS);
    setSelectedPresetId(null);
  }, [onReplaceParams]);

  // ─── A/B Compare ────────────────────────────────────────
  // Slot B starts as a copy of current params. Toggling swaps which
  // slot is "live" (bound to the actual params the rig uses), so
  // players can tweak B, compare against A, and instantly flip back.
  const [slotBParams, setSlotBParams] = useState<BassParams>(params);
  const [activeSlot, setActiveSlot] = useState<'A' | 'B'>('A');
  const [slotASnapshot, setSlotASnapshot] = useState<BassParams>(params);

  const handleToggleSlot = useCallback(() => {
    if (activeSlot === 'A') {
      // Moving to B: remember A as-is, load B's stored params
      setSlotASnapshot(params);
      onReplaceParams(slotBParams);
      setActiveSlot('B');
    } else {
      // Moving to A: remember B as-is, restore A's snapshot
      setSlotBParams(params);
      onReplaceParams(slotASnapshot);
      setActiveSlot('A');
    }
  }, [activeSlot, params, slotBParams, slotASnapshot, onReplaceParams]);

  const handleCopyAtoB = useCallback(() => {
    if (activeSlot === 'A') {
      setSlotBParams(params);
    } else {
      setSlotASnapshot(params);
    }
  }, [activeSlot, params]);

  // ─── Keyboard shortcuts for fretboard playing ────────────
  // Maps a 4x4 grid of keys to strings/frets so players can jam without
  // a mouse. Ignored while typing in the preset-name input or any other
  // text field, and ignores modifier-key combos (so Cmd+R etc still works).
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      const isTyping = target.tagName === 'INPUT' || target.tagName === 'TEXTAREA';
      if (isTyping || e.metaKey || e.ctrlKey || e.altKey || (!singleLoaded && !multiSampleLoaded)) return;

      const key = e.key.toLowerCase();
      const mapping = KEY_TO_STRING_FRET[key];
      if (mapping) {
        e.preventDefault();
        handlePlayNote(mapping[0], mapping[1]);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [singleLoaded, multiSampleLoaded, handlePlayNote]);

  return (
    <div className="space-y-6 h-full flex flex-col animate-in fade-in duration-500">
      <div aria-live="polite" className="sr-only">
        {loading && `Loading bass sample...`}
        {justLoaded && `Bass sample ${activeSampleName} loaded successfully.`}
      </div>

      <div>
        <h3 className="text-sm font-bold text-slate-300 uppercase tracking-widest flex items-center gap-2">
          <AudioWaveform size={16} className="text-orange-400" />
          Bass Sampler Rig
        </h3>
        <p className="text-xs text-slate-500 italic">Upload a high-quality bass one-shot for pitch-shifting and modeling across a custom vintage tube circuit.</p>
      </div>

      <div className="bg-[#0b0c0e] border-2 border-white/5 rounded-[30px] p-4 flex-1 flex flex-col items-center justify-center relative overflow-hidden group shadow-[inset_0_10px_30px_rgba(0,0,0,1)]">
        <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')] opacity-5" aria-hidden="true"></div>

        {!singleLoaded && !multiSampleLoaded ? (
          <div className="flex flex-col items-center gap-4">
            <button
              onClick={onUploadClick}
              disabled={loading}
              aria-label="Upload bass sample"
              className={`relative z-10 flex flex-col items-center gap-4 px-8 py-8 bg-black/60 border-2 rounded-3xl transition-all hover:scale-105 shadow-2xl focus:outline-none focus:ring-2 focus:ring-orange-500 focus:ring-offset-2 focus:ring-offset-black w-full max-w-sm ${
                loading
                  ? 'border-blue-500 bg-blue-500/10 shadow-[0_0_30px_rgba(59,130,246,0.3)] animate-pulse'
                  : 'border-dashed border-orange-500/30 hover:border-orange-500 hover:bg-black/40 group-hover:shadow-[0_0_40px_rgba(249,115,22,0.15)]'
              }`}
            >
              {loading ? (
                <>
                  <RefreshCw size={24} className="text-blue-400 animate-spin" />
                  <div className="text-center">
                    <div className="text-sm font-bold uppercase tracking-widest text-blue-200">Decoding Audio...</div>
                    <div className="text-xs opacity-50 mt-1 font-mono text-blue-400/50">Mapping custom fretboard</div>
                  </div>
                </>
              ) : (
                <>
                  <Upload size={24} className="text-orange-500/50 group-hover:text-orange-400 transition-colors" />
                  <div className="text-center">
                    <div className="text-sm font-bold uppercase tracking-widest text-orange-200">Load Single Sample</div>
                    <div className="text-xs opacity-50 mt-1 font-mono text-orange-400/50">WAV / AIFF / MP3</div>
                  </div>
                </>
              )}
            </button>

            {/* Multi-sample bulk import */}
            <div className="text-center">
              <div className="text-[9px] text-slate-500 font-mono uppercase tracking-widest mb-2">— Or —</div>
              <button
                onClick={() => folderInputRef.current?.click()}
                disabled={importingSamples}
                className="flex items-center gap-2 px-6 py-3 bg-black/60 border border-dashed border-blue-500/30 hover:border-blue-500 rounded-2xl text-sm text-blue-400 hover:text-blue-300 transition-all font-mono"
              >
                {importingSamples ? (
                  <RefreshCw size={18} className="animate-spin" />
                ) : (
                  <FolderOpen size={18} />
                )}
                {importingSamples
                  ? `Importing ${importCount} samples...`
                  : 'Import Kontakt-Style Sample Folder'
                }
              </button>
              <p className="text-[8px] text-slate-600 mt-1 font-mono">
                Name files like: E2_sus_rr1.wav, A1_pm_rr2.wav, D3_slap_rr1.wav
              </p>
              <input
                ref={folderInputRef}
                type="file"
                multiple
                accept="audio/*"
                className="hidden"
                onChange={handleBulkImport}
              />
            </div>
          </div>
        ) : (
          <div className="relative z-10 w-full max-w-5xl bg-zinc-950 p-6 rounded-3xl border border-white/10 shadow-[0_20px_50px_rgba(0,0,0,0.9)] text-slate-100 flex flex-col gap-6">
            {/* Top Bar / Metadata */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-white/5 pb-4">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-orange-500 to-amber-600 flex items-center justify-center border border-white/20 shadow-[0_0_15px_rgba(249,115,22,0.3)]">
                  <AudioWaveform size={24} className="text-black" />
                </div>
                <div>
                  <div className="text-xs text-slate-500 uppercase font-mono tracking-widest font-bold">Active Multisample</div>
                  <h4 className="text-sm font-black text-amber-500 font-mono tracking-wide uppercase truncate max-w-[200px]" aria-live="polite">{activeSampleName}</h4>
                  <div className="flex items-center gap-1.5 mt-1 text-[9px] text-emerald-400 font-mono font-bold uppercase tracking-widest">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                    Zone Mapped • Multi-Velocity
                  </div>
                </div>
              </div>

              <button
                onClick={onUploadClick}
                disabled={loading}
                className={`px-4 py-2 border rounded-xl text-[10px] font-bold uppercase tracking-widest transition-all shadow-inner flex items-center gap-1.5 focus:outline-none focus:ring-2 focus:ring-orange-500 ${
                  loading
                    ? 'bg-blue-500/20 border-blue-500 text-blue-300'
                    : justLoaded
                      ? 'bg-emerald-500/20 border-emerald-500 text-emerald-300 shadow-[0_0_15px_rgba(16,185,129,0.4)] animate-bounce'
                      : 'bg-black hover:bg-white/5 border-white/10 hover:border-orange-500/50 hover:text-orange-400'
                }`}
              >
                {loading ? (
                  <>
                    <RefreshCw size={10} className="animate-spin" />
                    Decoding...
                  </>
                ) : justLoaded ? (
                  <>
                    <Check size={10} />
                    Active!
                  </>
                ) : (
                  "Replace Sample"
                )}
              </button>
            </div>

            {/* Presets & A/B Compare Bar */}
            <div className="flex flex-col sm:flex-row gap-3 sm:items-center justify-between border-b border-white/5 pb-4">
              <div className="flex items-center gap-2 flex-wrap flex-1">
                <span className="text-[8px] font-mono font-bold text-slate-500 uppercase tracking-widest shrink-0">Presets</span>
                <select
                  aria-label="Load preset"
                  value={selectedPresetId ?? ''}
                  onChange={(e) => {
                    const preset = allPresets.find((p) => p.id === e.target.value);
                    if (preset) applyPreset(preset);
                  }}
                  className="bg-black/60 border border-white/10 rounded-lg text-[10px] font-mono text-slate-200 px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-orange-500 max-w-[180px]"
                >
                  <option value="" disabled>Select a preset…</option>
                  <optgroup label="Factory">
                    {FACTORY_PRESETS.map((p) => (
                      <option key={p.id} value={p.id}>{p.name}</option>
                    ))}
                  </optgroup>
                  {userPresets.length > 0 && (
                    <optgroup label="My Presets">
                      {userPresets.map((p) => (
                        <option key={p.id} value={p.id}>{p.name}</option>
                      ))}
                    </optgroup>
                  )}
                </select>

                {selectedPresetId && !FACTORY_PRESETS.some((p) => p.id === selectedPresetId) && (
                  <button
                    type="button"
                    onClick={() => handleDeletePreset(selectedPresetId)}
                    aria-label="Delete selected preset"
                    className="p-1.5 rounded-lg border border-white/10 text-slate-500 hover:text-rose-400 hover:border-rose-500/40 transition-colors focus:outline-none focus:ring-2 focus:ring-rose-500"
                  >
                    <Trash2 size={11} />
                  </button>
                )}

                {showSaveInput ? (
                  <div className="flex items-center gap-1.5">
                    <input
                      type="text"
                      value={presetNameDraft}
                      onChange={(e) => setPresetNameDraft(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && handleSavePreset()}
                      placeholder="Preset name…"
                      aria-label="New preset name"
                      autoFocus
                      className="bg-black/60 border border-white/10 rounded-lg text-[10px] font-mono text-slate-200 px-2 py-1.5 w-32 focus:outline-none focus:ring-2 focus:ring-orange-500"
                    />
                    <button
                      type="button"
                      onClick={handleSavePreset}
                      disabled={!presetNameDraft.trim()}
                      aria-label="Confirm save preset"
                      className="p-1.5 rounded-lg border border-emerald-500/40 bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 transition-colors disabled:opacity-30 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    >
                      <Check size={11} />
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => setShowSaveInput(true)}
                    className="flex items-center gap-1 px-2 py-1.5 rounded-lg border border-white/10 text-[9px] font-mono font-bold uppercase text-slate-400 hover:text-orange-400 hover:border-orange-500/40 transition-colors focus:outline-none focus:ring-2 focus:ring-orange-500"
                  >
                    <Save size={10} />
                    Save
                  </button>
                )}

                <button
                  type="button"
                  onClick={handleResetToDefault}
                  className="flex items-center gap-1 px-2 py-1.5 rounded-lg border border-white/10 text-[9px] font-mono font-bold uppercase text-slate-400 hover:text-slate-200 hover:border-white/20 transition-colors focus:outline-none focus:ring-2 focus:ring-slate-500"
                >
                  <RotateCcw size={10} />
                  Reset
                </button>
              </div>

              {/* A/B Compare */}
              <div className="flex items-center gap-2 shrink-0">
                <span className="text-[8px] font-mono font-bold text-slate-500 uppercase tracking-widest">Compare</span>
                <div className="flex bg-black/50 p-0.5 rounded-lg border border-white/5 gap-1">
                  <button
                    type="button"
                    onClick={() => activeSlot !== 'A' && handleToggleSlot()}
                    aria-pressed={activeSlot === 'A'}
                    className={`px-3 py-1 text-[9px] font-mono font-bold uppercase rounded-md transition-all focus:outline-none focus:ring-2 focus:ring-violet-500 ${
                      activeSlot === 'A' ? 'bg-violet-500 text-black shadow-md' : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    A
                  </button>
                  <button
                    type="button"
                    onClick={() => activeSlot !== 'B' && handleToggleSlot()}
                    aria-pressed={activeSlot === 'B'}
                    className={`px-3 py-1 text-[9px] font-mono font-bold uppercase rounded-md transition-all focus:outline-none focus:ring-2 focus:ring-violet-500 ${
                      activeSlot === 'B' ? 'bg-violet-500 text-black shadow-md' : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    B
                  </button>
                </div>
                <button
                  type="button"
                  onClick={handleCopyAtoB}
                  title={activeSlot === 'A' ? 'Copy current settings into slot B' : 'Copy current settings into slot A'}
                  aria-label={activeSlot === 'A' ? 'Copy A to B' : 'Copy B to A'}
                  className="p-1.5 rounded-lg border border-white/10 text-slate-500 hover:text-violet-400 hover:border-violet-500/40 transition-colors focus:outline-none focus:ring-2 focus:ring-violet-500"
                >
                  <Repeat size={11} />
                </button>
              </div>
            </div>

            {/* Preamp, Amp, Rack EQ Dashboard */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-stretch">
              {/* Column 1: Preamp & Note Cutoff */}
              <div className="bg-[#121214] border border-white/5 rounded-2xl p-4 flex flex-col justify-between shadow-inner">
                <div>
                  <div className="text-[10px] font-mono uppercase tracking-widest text-slate-400 font-black border-b border-white/5 pb-1.5 mb-4">
                    01 • Bass Preamp &amp; Choke
                  </div>

                  <div className="space-y-4">
                    <div className="flex flex-col gap-1.5">
                      <span className="text-[8px] font-mono font-bold text-slate-500 uppercase tracking-widest">Plucking Style</span>
                      <ButtonGroup
                        ariaLabel="Plucking style"
                        accent="amber"
                        value={params.style}
                        onChange={(val) => onUpdate('style', val)}
                        options={[
                          { value: 'finger', label: 'finger style' },
                          { value: 'pick', label: 'pick style' },
                        ]}
                      />
                    </div>

                    <div className="flex flex-col gap-1.5">
                      <div className="flex justify-between text-[8px] font-mono font-bold text-slate-500 uppercase tracking-widest">
                        <label htmlFor="pickup-blend">Pickup Blend</label>
                        <span className="text-amber-500">{params.pickupBlend}%</span>
                      </div>
                      <input
                        id="pickup-blend"
                        type="range"
                        min="0"
                        max="100"
                        value={params.pickupBlend}
                        onChange={(e) => onUpdate('pickupBlend', parseInt(e.target.value, 10))}
                        className="w-full accent-amber-500 h-1 bg-black rounded-lg cursor-pointer appearance-none focus:outline-none focus:ring-1 focus:ring-amber-500"
                      />
                      <div className="flex justify-between text-[7px] font-mono text-slate-600 font-bold uppercase mt-0.5">
                        <span>Neck (Fat)</span>
                        <span>Bridge (Growl)</span>
                      </div>
                    </div>

                    <div className="flex flex-col gap-1.5">
                      <div className="flex justify-between text-[8px] font-mono font-bold text-slate-500 uppercase tracking-widest">
                        <label htmlFor="preamp-tone">Preamp Tone</label>
                        <span className="text-amber-500">{params.tone}%</span>
                      </div>
                      <input
                        id="preamp-tone"
                        type="range"
                        min="0"
                        max="100"
                        value={params.tone}
                        onChange={(e) => onUpdate('tone', parseInt(e.target.value, 10))}
                        className="w-full accent-amber-500 h-1 bg-black rounded-lg cursor-pointer appearance-none focus:outline-none focus:ring-1 focus:ring-amber-500"
                      />
                    </div>
                  </div>
                </div>

                <div className="border-t border-white/5 pt-4 mt-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex flex-col">
                      <span className="text-[10px] font-mono font-black uppercase text-slate-300">Mono Note Choke</span>
                      <span className="text-[7px] text-slate-500 font-mono">Cutoff notes to prevent muddy bleed</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => onUpdate('monoChoke', !params.monoChoke)}
                      aria-label="Toggle Mono Note Choke"
                      aria-pressed={params.monoChoke}
                      className={`w-12 h-6 rounded-full p-0.5 transition-colors focus:outline-none focus:ring-2 focus:ring-amber-500 ${
                        params.monoChoke ? 'bg-amber-500' : 'bg-zinc-800'
                      }`}
                    >
                      <div className={`w-5 h-5 rounded-full bg-white transition-transform ${
                        params.monoChoke ? 'translate-x-6' : 'translate-x-0'
                      }`}></div>
                    </button>
                  </div>

                  {params.monoChoke && (
                    <div className="flex flex-col gap-1.5">
                      <div className="flex justify-between text-[8px] font-mono text-slate-500 font-bold uppercase">
                        <label htmlFor="bleed-decay">Decay / Choke Speed</label>
                        <span className="text-amber-500">{params.bleedDecay}ms</span>
                      </div>
                      <input
                        id="bleed-decay"
                        type="range"
                        min="50"
                        max="1500"
                        step="50"
                        value={params.bleedDecay}
                        onChange={(e) => onUpdate('bleedDecay', parseInt(e.target.value, 10))}
                        className="w-full accent-amber-500 h-1 bg-black rounded-lg cursor-pointer appearance-none focus:outline-none focus:ring-1 focus:ring-amber-500"
                      />
                    </div>
                  )}
                </div>
              </div>

              {/* Column 2: Ampeg B-15 Amp Simulation */}
              <div className="bg-[#161619] border border-white/5 rounded-2xl p-4 flex flex-col justify-between shadow-lg relative overflow-hidden">
                <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/padded-leather.png')] opacity-10 pointer-events-none" aria-hidden="true"></div>

                <div className="relative z-10">
                  <div className="text-[10px] font-mono uppercase tracking-widest text-blue-400 font-black border-b border-white/5 pb-1.5 mb-4 flex items-center justify-between">
                    <span>02 • B-15 Portaflex Amp</span>
                    <span className="text-[8px] bg-blue-500/10 border border-blue-500/20 text-blue-400 px-1 py-0.2 rounded font-bold uppercase">Tube modeling</span>
                  </div>

                  <div className="flex gap-4 justify-around mt-2">
                    <BassKnob
                      label="Vol"
                      value={params.ampVolume}
                      onChange={(val) => onUpdate('ampVolume', val)}
                    />
                    <BassKnob
                      label="Drive"
                      value={params.drive}
                      onChange={(val) => onUpdate('drive', val)}
                      suffix="%"
                    />
                    <BassKnob
                      label="Bass"
                      value={params.ampBass}
                      onChange={(val) => onUpdate('ampBass', val)}
                    />
                    <BassKnob
                      label="Treble"
                      value={params.ampTreble}
                      onChange={(val) => onUpdate('ampTreble', val)}
                    />
                  </div>

                  <div className="flex gap-3 mt-5 justify-center border-t border-white/5 pt-4">
                    <ToggleButton
                      label="Ultra-Lo"
                      accent="cyan"
                      active={params.ultraLo}
                      onToggle={() => onUpdate('ultraLo', !params.ultraLo)}
                    />
                    <ToggleButton
                      label="Ultra-Hi"
                      accent="indigo"
                      active={params.ultraHi}
                      onToggle={() => onUpdate('ultraHi', !params.ultraHi)}
                    />
                  </div>
                </div>

                <div className="relative z-10 border-t border-white/5 pt-4 mt-4">
                  <span className="text-[8px] font-mono font-bold text-slate-500 uppercase tracking-widest block mb-2 text-center">Cabinet Emulation</span>
                  <ButtonGroup
                    ariaLabel="Cabinet emulation"
                    accent="blue"
                    value={params.cabSim}
                    onChange={(val) => onUpdate('cabSim', val)}
                    options={[
                      { value: 'b15', label: 'B-15 1x15' },
                      { value: 'svt', label: 'SVT 8x10' },
                      { value: 'di', label: 'Bypass DI' },
                    ]}
                  />
                </div>
              </div>

              {/* Column 3: Tuning & Mini EQ */}
              <div className="bg-[#0f1115] border border-white/5 rounded-2xl p-4 flex flex-col justify-between shadow-inner">
                <div>
                  <div className="text-[10px] font-mono uppercase tracking-widest text-teal-400 font-black border-b border-white/5 pb-1.5 mb-4">
                    03 • Tuning &amp; Graphic EQ
                  </div>

                  <div className="grid grid-cols-2 gap-4 border-b border-white/5 pb-4 mb-4">
                    <div className="flex flex-col gap-1.5">
                      <div className="flex justify-between text-[8px] font-mono text-slate-500 font-bold uppercase">
                        <label htmlFor="coarse-pitch">Coarse Pitch</label>
                        <span className="text-teal-400 font-bold">{params.tuningCoarse > 0 ? `+${params.tuningCoarse}` : params.tuningCoarse} st</span>
                      </div>
                      <input
                        id="coarse-pitch"
                        type="range"
                        min="-12"
                        max="12"
                        value={params.tuningCoarse}
                        onChange={(e) => onUpdate('tuningCoarse', parseInt(e.target.value, 10))}
                        className="w-full accent-teal-500 h-1 bg-black rounded-lg cursor-pointer appearance-none focus:outline-none focus:ring-1 focus:ring-teal-500"
                      />
                    </div>

                    <div className="flex flex-col gap-1.5">
                      <div className="flex justify-between text-[8px] font-mono text-slate-500 font-bold uppercase">
                        <label htmlFor="fine-tuning">Fine Tuning</label>
                        <span className="text-teal-400 font-bold">{params.tuningFine > 0 ? `+${params.tuningFine}` : params.tuningFine} cents</span>
                      </div>
                      <input
                        id="fine-tuning"
                        type="range"
                        min="-50"
                        max="50"
                        value={params.tuningFine}
                        onChange={(e) => onUpdate('tuningFine', parseInt(e.target.value, 10))}
                        className="w-full accent-teal-500 h-1 bg-black rounded-lg cursor-pointer appearance-none focus:outline-none focus:ring-1 focus:ring-teal-500"
                      />
                    </div>
                  </div>

                  <div>
                    <span className="text-[8px] font-mono font-bold text-slate-500 uppercase tracking-widest block mb-3">Mini 3-Band EQ (Graphic)</span>
                    <div className="flex justify-around items-stretch h-28 bg-black/30 border border-white/5 rounded-xl p-3 shadow-inner">
                      <BassEQSlider
                        label="Low 60Hz"
                        value={params.eqLow}
                        onChange={(val) => onUpdate('eqLow', val)}
                      />
                      <BassEQSlider
                        label="Mid 800Hz"
                        value={params.eqMid}
                        onChange={(val) => onUpdate('eqMid', val)}
                      />
                      <BassEQSlider
                        label="Hi 3.5kHz"
                        value={params.eqHigh}
                        onChange={(val) => onUpdate('eqHigh', val)}
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Multi-Sample Map */}
            {multiSampleLoaded && (
              <div className="border-t border-white/5 pt-4 mt-4">
                <BassSampleMap
                  sampler={samplerRef.current}
                  currentArticulation={currentArticulation}
                  onArticulationChange={setCurrentArticulation}
                />
              </div>
            )}

            {/* Fretboard Section */}
            <div className="mt-2 border-t border-white/5 pt-4 w-full">
              <div className="flex justify-between items-center mb-2 px-1">
                <span className="text-[9px] font-mono font-bold uppercase tracking-widest text-slate-400 flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-orange-500 animate-pulse"></span>
                  Interactive Fretboard (Click frets, or play with your keyboard)
                </span>
                <span className="text-[9px] font-mono text-emerald-400 font-bold bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded uppercase tracking-wider">
                  E-A-D-G Standard Bass Tuning
                </span>
              </div>

              <Fretboard tuningCoarse={params.tuningCoarse} onPlayNote={handlePlayNote} />

              <div className="mt-2 flex items-center justify-center gap-1 text-[8px] font-mono text-slate-600 uppercase tracking-widest">
                <kbd className="px-1 py-0.5 bg-black/40 border border-white/10 rounded">Z-V</kbd>
                <kbd className="px-1 py-0.5 bg-black/40 border border-white/10 rounded">A-F</kbd>
                <kbd className="px-1 py-0.5 bg-black/40 border border-white/10 rounded">Q-R</kbd>
                <kbd className="px-1 py-0.5 bg-black/40 border border-white/10 rounded">1-4</kbd>
                <span className="ml-1">Keyboard shortcuts (G · D · A · E strings)</span>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
});

BassTab.displayName = 'BassTab';
