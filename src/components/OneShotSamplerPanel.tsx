import React, { useState, useCallback, useRef, useEffect } from 'react';
import {
  Upload, FolderOpen, Save, Trash2, RotateCcw, Music, Sliders,
  Play, Square, RefreshCw, Check, Search,
} from 'lucide-react';
import { oneShotSampler, OneShotPreset } from '../lib/audio/oneShotSampler';
import { audioEngine } from '../lib/audio/engine';
import { persistAndLoadSample } from '../lib/audio/soundbankLoader';
import { PresetBrowser } from './PresetBrowser';
import { useSoundLibrary } from '../hooks/useSoundLibrary';
import { SoundLibraryEntry } from '../lib/audio/soundLibrary';

const KEYBOARD_KEYS = 'awsedftgyhujk';
const NOTE_NAMES = ['C','C#','D','D#','E','F','F#','G','G#','A','A#','B'];

function noteName(midi: number) {
  return `${NOTE_NAMES[midi % 12]}${Math.floor(midi / 12) - 1}`;
}

export function OneShotSamplerPanel() {
  const [samples, setSamples] = useState(oneShotSampler.loadedSamples);
  const [importing, setImporting] = useState(false);
  const [importCount, setImportCount] = useState(0);
  const [selectedPresetId, setSelectedPresetId] = useState<string | null>(null);
  const [presetName, setPresetName] = useState('');
  const [showSaveInput, setShowSaveInput] = useState(false);
  const [lastPlayedNote, setLastPlayedNote] = useState<number | null>(null);
  const [editingNote, setEditingNote] = useState<number | null>(null);
  const [editValue, setEditValue] = useState('');
  const [showBrowser, setShowBrowser] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const folderInputRef = useRef<HTMLInputElement>(null);
  const presets = oneShotSampler.getPresets();
  const lib = useSoundLibrary();
  const nextMidiNote = useRef(24);

  const refresh = useCallback(() => setSamples([...oneShotSampler.loadedSamples]), []);

  const handleLoadFromBrowser = useCallback(async (entry: SoundLibraryEntry) => {
    const ok = await lib.loadSampleToEngine(entry, `browser_${entry.id}`);
    if (ok) {
      const buffer = audioEngine.loadedSamples.get(`browser_${entry.id}`);
      if (buffer) {
        const note = nextMidiNote.current;
        nextMidiNote.current = note + 1;
        oneShotSampler.addSample({
          id: entry.id,
          name: entry.name,
          filename: entry.filename,
          midiNote: note,
          buffer,
        });
        refresh();
      }
    }
  }, [lib, refresh]);

  const handleImport = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;
    setImporting(true);
    setImportCount(0);
    oneShotSampler.clear();

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const id = `oneshot_${i}`;
      const data = await file.arrayBuffer();
      await persistAndLoadSample(id, id, data, file.name, file.type);
      const buffer = audioEngine.loadedSamples.get(id);
      if (buffer) {
        oneShotSampler.addSample({
          id,
          name: file.name.replace(/\.[^.]+$/, ''),
          filename: file.name,
          midiNote: 24 + i,
          buffer,
        });
      }
      setImportCount(i + 1);
    }
    refresh();
    setImporting(false);
    e.target.value = '';
  }, [refresh]);

  const handlePlay = useCallback((midi: number) => {
    audioEngine.resume();
    oneShotSampler.triggerNote(midi);
    setLastPlayedNote(midi);
  }, []);

  const handleNoteChange = useCallback((index: number) => {
    const val = parseInt(editValue, 10);
    if (!isNaN(val) && val >= 0 && val <= 127) {
      oneShotSampler.updateSample(index, { midiNote: val });
      refresh();
    }
    setEditingNote(null);
  }, [editValue, refresh]);

  const handleRemove = useCallback((index: number) => {
    oneShotSampler.removeSample(index);
    refresh();
  }, [refresh]);

  const handleSavePreset = useCallback(() => {
    if (!presetName.trim()) return;
    oneShotSampler.savePreset(presetName.trim());
    setPresetName('');
    setShowSaveInput(false);
    refresh();
  }, [presetName, refresh]);

  const handleLoadPreset = useCallback((preset: OneShotPreset) => {
    oneShotSampler.loadPreset(preset);
    setSelectedPresetId(preset.id);
    refresh();
  }, [refresh]);

  const handleDeletePreset = useCallback((id: string) => {
    oneShotSampler.deletePreset(id);
    setSelectedPresetId(null);
    refresh();
  }, [refresh]);

  const handleResetToDefault = useCallback(() => {
    oneShotSampler.globalEnvA = 0.001;
    oneShotSampler.globalEnvD = 0.1;
    oneShotSampler.globalEnvS = 1;
    oneShotSampler.globalEnvR = 0.1;
    oneShotSampler.globalFilterCutoff = 20000;
    oneShotSampler.globalFilterRes = 0;
    oneShotSampler.globalVolume = 0.8;
    refresh();
  }, [refresh]);

  // Keyboard preview
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.repeat || e.metaKey || e.ctrlKey) return;
      const target = e.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') return;
      const idx = KEYBOARD_KEYS.indexOf(e.key.toLowerCase());
      if (idx >= 0 && idx < samples.length && samples[idx].buffer) {
        e.preventDefault();
        handlePlay(samples[idx].midiNote);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [samples, handlePlay]);

  return (
    <div className="bg-[#111] border-2 border-white/5 rounded-[40px] shadow-[0_30px_60px_rgba(0,0,0,0.8)] h-full flex flex-col overflow-hidden relative">
      <div className="absolute inset-0 bg-texture-dark opacity-30 pointer-events-none mix-blend-overlay" />

      {/* Preset Browser Bar */}
      <div className="relative z-10 border-b border-white/5 p-4 flex items-center gap-4 flex-wrap">
        <div className="flex items-center gap-2">
          <Music size={16} className="text-orange-400" />
          <span className="text-[10px] font-mono font-bold uppercase tracking-widest text-slate-400">Sampler Presets</span>
        </div>

        <button
          onClick={() => setShowBrowser(!showBrowser)}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-[9px] font-mono font-bold uppercase tracking-wider transition-all ${
            showBrowser
              ? 'bg-orange-500/10 border-orange-500/40 text-orange-400'
              : 'border-white/10 text-slate-400 hover:text-white'
          }`}
        >
          <Search size={12} />
          Library Browser
          {lib.count > 0 && <span className="text-[8px] opacity-60">({lib.count})</span>}
        </button>

        <select
          value={selectedPresetId ?? ''}
          onChange={e => {
            const preset = presets.find(p => p.id === e.target.value);
            if (preset) handleLoadPreset(preset);
          }}
          className="bg-black/60 border border-white/10 rounded-lg px-3 py-1.5 text-[10px] font-mono text-slate-200 focus:outline-none focus:ring-2 focus:ring-orange-500"
        >
          <option value="">— Select Preset —</option>
          {presets.map(p => (
            <option key={p.id} value={p.id}>{p.name}</option>
          ))}
        </select>

        {selectedPresetId && (
          <button
            onClick={() => handleDeletePreset(selectedPresetId!)}
            className="p-1.5 rounded-lg border border-white/10 text-slate-500 hover:text-rose-400 transition-colors"
          >
            <Trash2 size={12} />
          </button>
        )}

        {showSaveInput ? (
          <div className="flex items-center gap-1.5">
            <input
              value={presetName}
              onChange={e => setPresetName(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleSavePreset()}
              placeholder="Preset name..."
              autoFocus
              className="bg-black/60 border border-white/10 rounded-lg px-2 py-1 text-[10px] font-mono text-white w-28 focus:outline-none focus:ring-2 focus:ring-orange-500"
            />
            <button onClick={handleSavePreset} disabled={!presetName.trim()} className="p-1.5 rounded-lg border border-emerald-500/40 text-emerald-400 hover:bg-emerald-500/10 disabled:opacity-30">
              <Check size={12} />
            </button>
          </div>
        ) : (
          <button onClick={() => setShowSaveInput(true)} className="flex items-center gap-1 px-2 py-1.5 rounded-lg border border-white/10 text-[9px] font-mono text-slate-400 hover:text-orange-400">
            <Save size={10} /> Save
          </button>
        )}

        <button onClick={handleResetToDefault} className="flex items-center gap-1 px-2 py-1.5 rounded-lg border border-white/10 text-[9px] font-mono text-slate-400 hover:text-slate-200">
          <RotateCcw size={10} /> Reset
        </button>
      </div>

      {/* Main content */}
      <div className="relative z-10 flex-1 flex gap-4 p-4 overflow-hidden">
        {/* Library Browser Panel */}
        {showBrowser && (
          <div className="w-80 shrink-0 border-r border-white/10 pr-4 overflow-hidden flex flex-col">
            <div className="text-[9px] font-mono font-bold text-slate-500 uppercase tracking-widest mb-2">Sound Library</div>
            <PresetBrowser
              type="one_shot"
              onLoadEntry={handleLoadFromBrowser}
            />
          </div>
        )}

        {/* Left: Sample list / import */}
        <div className="flex-1 flex flex-col gap-4 overflow-y-auto custom-scrollbar">
          {samples.length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center gap-4">
              <button
                onClick={() => folderInputRef.current?.click()}
                disabled={importing}
                className="flex flex-col items-center gap-3 px-10 py-10 bg-black/60 border-2 border-dashed border-orange-500/30 hover:border-orange-500 rounded-3xl transition-all hover:scale-[1.02]"
              >
                {importing ? (
                  <RefreshCw size={32} className="text-blue-400 animate-spin" />
                ) : (
                  <FolderOpen size={32} className="text-orange-500/50" />
                )}
                <div className="text-center">
                  <div className="text-sm font-bold text-orange-200 uppercase tracking-widest">
                    {importing ? `Importing ${importCount} files...` : 'Import One-Shot Folder'}
                  </div>
                  <div className="text-[10px] text-slate-500 font-mono mt-1">
                    Files are mapped chromatically from C1 upward
                  </div>
                </div>
              </button>
              <input ref={fileInputRef} type="file" multiple accept="audio/*" className="hidden" onChange={handleImport} />
            </div>
          ) : (
            <>
              {/* Global Controls */}
              <div className="bg-black/40 border border-white/5 rounded-2xl p-4">
                <span className="text-[9px] font-mono font-bold text-slate-500 uppercase tracking-widest block mb-3">
                  Global Synth Controls
                </span>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                  <SliderControl label="Volume" value={oneShotSampler.globalVolume} min={0} max={1} step={0.01}
                    onChange={v => { oneShotSampler.globalVolume = v; refresh(); }} />
                  <SliderControl label="Attack" value={oneShotSampler.globalEnvA} min={0} max={2} step={0.01}
                    onChange={v => { oneShotSampler.globalEnvA = v; refresh(); }} />
                  <SliderControl label="Decay" value={oneShotSampler.globalEnvD} min={0} max={3} step={0.01}
                    onChange={v => { oneShotSampler.globalEnvD = v; refresh(); }} />
                  <SliderControl label="Release" value={oneShotSampler.globalEnvR} min={0} max={5} step={0.01}
                    onChange={v => { oneShotSampler.globalEnvR = v; refresh(); }} />
                </div>
              </div>

              {/* Sample Map */}
              <div className="bg-black/40 border border-white/5 rounded-2xl p-4">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-[9px] font-mono font-bold text-slate-500 uppercase tracking-widest">
                    Samples ({samples.length})
                  </span>
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="flex items-center gap-1 px-2 py-1 rounded-lg border border-white/10 text-[9px] font-mono text-slate-400 hover:text-orange-400"
                  >
                    <Upload size={10} /> Add
                  </button>
                </div>
              <input ref={folderInputRef} type="file" {...{ webkitdirectory: "" } as any} multiple accept="audio/*" className="hidden" onChange={handleImport} />

                <div className="space-y-1 max-h-[400px] overflow-y-auto custom-scrollbar">
                  {samples.map((s, i) => (
                    <div key={s.id}
                      className={`flex items-center gap-2 p-2 rounded-xl border transition-all ${
                        lastPlayedNote === s.midiNote
                          ? 'bg-orange-500/10 border-orange-500/30'
                          : 'bg-black/30 border-white/5 hover:border-white/20'
                      }`}
                    >
                      <button
                        onClick={() => handlePlay(s.midiNote)}
                        className="p-1.5 rounded-lg bg-white/5 border border-white/10 text-slate-400 hover:text-orange-400 hover:border-orange-500/40 transition-all"
                      >
                        {lastPlayedNote === s.midiNote ? (
                          <Square size={12} fill="currentColor" />
                        ) : (
                          <Play size={12} fill="currentColor" />
                        )}
                      </button>

                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />

                      <span className="flex-1 text-xs font-mono text-slate-300 truncate">{s.name}</span>

                      <span className="text-[9px] font-mono text-slate-500">
                        Key:
                      </span>
                      {editingNote === i ? (
                        <input
                          value={editValue}
                          onChange={e => setEditValue(e.target.value)}
                          onBlur={() => handleNoteChange(i)}
                          onKeyDown={e => e.key === 'Enter' && handleNoteChange(i)}
                          autoFocus
                          className="w-14 bg-black/60 border border-orange-500/50 rounded px-1.5 py-0.5 text-[10px] font-mono text-orange-400 text-center focus:outline-none"
                        />
                      ) : (
                        <button
                          onClick={() => { setEditingNote(i); setEditValue(String(s.midiNote)); }}
                          className="w-14 px-1.5 py-0.5 rounded border border-transparent hover:border-white/20 text-[10px] font-mono text-orange-400 text-center"
                        >
                          {noteName(s.midiNote)}
                        </button>
                      )}

                      <button
                        onClick={() => handleRemove(i)}
                        className="p-1 rounded text-slate-600 hover:text-red-400 transition-colors"
                      >
                        <Trash2 size={10} />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}
        </div>

        {/* Right: Keyboard preview + info */}
        {samples.length > 0 && (
          <div className="w-48 shrink-0 hidden lg:flex flex-col gap-3">
            <div className="bg-black/40 border border-white/5 rounded-2xl p-4">
              <span className="text-[9px] font-mono font-bold text-slate-500 uppercase tracking-widest block mb-3">
                Keyboard Preview
              </span>
              <div className="grid grid-cols-4 gap-1.5">
                {samples.map((s, i) => (
                  <button
                    key={s.id}
                    onClick={() => handlePlay(s.midiNote)}
                    className={`aspect-square rounded-lg border text-[8px] font-mono font-bold transition-all ${
                      lastPlayedNote === s.midiNote
                        ? 'bg-orange-500 border-orange-400 text-black scale-110 shadow-[0_0_10px_rgba(249,115,22,0.4)]'
                        : 'bg-black/40 border-white/10 text-slate-500 hover:text-white hover:border-orange-500/40'
                    }`}
                  >
                    {KEYBOARD_KEYS[i]?.toUpperCase() || ''}
                    <span className="block text-[6px] opacity-60">{noteName(s.midiNote)}</span>
                  </button>
                ))}
              </div>
              <p className="mt-2 text-[8px] font-mono text-slate-600 text-center">
                Press keyboard keys A–K to play
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function SliderControl({ label, value, min, max, step, onChange }: {
  label: string; value: number; min: number; max: number; step: number;
  onChange: (v: number) => void;
}) {
  const pct = ((value - min) / (max - min)) * 100;
  return (
    <div className="flex flex-col gap-1">
      <div className="flex justify-between text-[8px] font-mono text-slate-500 uppercase font-bold">
        <label>{label}</label>
        <span className="text-orange-400">{value.toFixed(2)}</span>
      </div>
      <input
        type="range" min={min} max={max} step={step} value={value}
        onChange={e => onChange(parseFloat(e.target.value))}
        className="w-full accent-orange-500 h-1 bg-black rounded-lg cursor-pointer appearance-none focus:outline-none"
      />
    </div>
  );
}
