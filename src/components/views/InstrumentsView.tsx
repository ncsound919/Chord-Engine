import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { Sliders, Activity, Database, Drum, AudioWaveform, Save, FolderOpen, RefreshCw, Check, Info, AlertCircle, Plug, Music } from 'lucide-react';
import { audioEngine } from '../../lib/audio/engine';
import { Ju60Engine } from '../../lib/audio/synth';
import { PersistenceManager, SectionPreset } from '../../lib/persistence';
import { getAllSampleIdsFromDB, getSampleFromDB, clearAllSamplesInDB } from '../../lib/audio/soundbankDb';
import { persistAndLoadFile, persistAndLoadFromUrl, loadKitFromDB, loadBassFromDB, getLoadedSampleMap, persistAndLoadSample } from '../../lib/audio/soundbankLoader';
import { prepopulateFromSoundLibrary } from '../../lib/audio/prepopulateSamples';
import { mapSoundbankFile } from '../../lib/audio/soundbankMapping';
import { SynthView } from '../views/SynthView';
import { TabId, SoundbankStatus, createEmptySoundbankStatus, BassParams, DEFAULT_BASS_PARAMS, DRUM_NAMES, ToastMessage, ToastVariant } from '../instruments/types';
import { DrumsTab } from '../instruments/DrumsTab';
import { BassTab } from '../instruments/BassTab';
import { SoundbankTab } from '../instruments/SoundbankTab';
import { WamPluginLoader } from '../WamPluginLoader';
import { OneShotSamplerPanel } from '../OneShotSamplerPanel';

const TOAST_DURATION = 3000;

export function InstrumentsView() {
  const [activeTab, setActiveTab] = useState<TabId>('drums');
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const [soundbankStatus, setSoundbankStatus] = useState<SoundbankStatus>(createEmptySoundbankStatus());
  const [loadedDrums, setLoadedDrums] = useState<Record<string, boolean>>(getLoadedSampleMap());
  const [loadingDrum, setLoadingDrum] = useState<string | null>(null);
  const [justLoadedDrum, setJustLoadedDrum] = useState<string | null>(null);
  const [bassParams, setBassParams] = useState<BassParams>(DEFAULT_BASS_PARAMS);
  const [targetDrum, setTargetDrum] = useState('');
  const [isSavingPreset, setIsSavingPreset] = useState(false);
  const [isLoadingSoundbank, setIsLoadingSoundbank] = useState(false);
  const [loadingAction, setLoadingAction] = useState<string | null>(null);
  const [justLoadedAction, setJustLoadedAction] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const addToast = useCallback((title: string, description?: string, variant: ToastVariant = 'info') => {
    const id = crypto.randomUUID();
    setToasts(prev => [...prev, { id, title, description, variant }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), TOAST_DURATION);
  }, []);

  const refreshSoundbankStatus = useCallback(async () => {
    try {
      const ids = await getAllSampleIdsFromDB();
      const status = createEmptySoundbankStatus();
      for (const id of ids) {
        const sample = await getSampleFromDB(id);
        if (!sample) continue;
        if (id === 'bass_default') status.bass = { loaded: true, filename: sample.name };
        else if (id.startsWith('kit1_')) status.kit1[id.replace('kit1_', '')] = { loaded: true, filename: sample.name };
        else if (id.startsWith('kit2_')) status.kit2[id.replace('kit2_', '')] = { loaded: true, filename: sample.name };
      }
      setSoundbankStatus(status);
      setLoadedDrums(getLoadedSampleMap());
    } catch (e) { console.error('Failed to refresh soundbank status:', e); }
  }, []);

  const handleFolderImport = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    setIsLoadingSoundbank(true);
    setLoadingAction('folder');

    let imported = 0;
    const ignored: string[] = [];
    const duplicateTargets = new Set<string>();

    try {
      for (const file of files) {
        const target = mapSoundbankFile(file);

        if (!target) {
          ignored.push(file.name);
          continue;
        }

        if (duplicateTargets.has(target.id)) {
          ignored.push(`${file.name} (duplicate target: ${target.id})`);
          continue;
        }

        duplicateTargets.add(target.id);

        await persistAndLoadFile(target.id, target.targetName, file);
        imported += 1;
      }

      await refreshSoundbankStatus();
      setJustLoadedAction('folder');

      addToast(
        'Folder Imported',
        `Mapped ${imported} sample${imported === 1 ? '' : 's'}${ignored.length ? `; skipped ${ignored.length}` : ''}.`,
        imported > 0 ? 'success' : 'error',
      );
    } catch (error) {
      console.error('Folder import failed', error);
      addToast('Import Error', 'One or more files could not be decoded.', 'error');
    } finally {
      e.target.value = '';
      setIsLoadingSoundbank(false);
      setLoadingAction(null);
      window.setTimeout(() => setJustLoadedAction(null), 2000);
    }
  }, [refreshSoundbankStatus, addToast]);

  const handleClearSoundbank = useCallback(async () => {
    if (!window.confirm('Clear all samples?')) return;
    await clearAllSamplesInDB();
    await refreshSoundbankStatus();
    addToast('Storage Cleared', 'All samples removed.', 'success');
  }, [refreshSoundbankStatus, addToast]);

  const handleQuickLoadKit = useCallback(async (kitId: 'kit1' | 'kit2') => {
    const count = await loadKitFromDB(kitId);
    await refreshSoundbankStatus();
    addToast(`${kitId.toUpperCase()} Active`, `Loaded ${count ?? 0} samples.`, 'success');
  }, [refreshSoundbankStatus, addToast]);

  const handleQuickLoadBass = useCallback(async () => {
    await loadBassFromDB();
    await refreshSoundbankStatus();
  }, [refreshSoundbankStatus]);

  useEffect(() => {
    const init = async () => {
      try {
        const ids = await getAllSampleIdsFromDB();
        if (ids.length === 0) {
          setLoadingAction('demo');
          let demoLoaded = false;
          try {
            await persistAndLoadFromUrl('kit1_Kick', 'Kick', 'https://tonejs.github.io/audio/drum-samples/808/kick.mp3', '808_Kick.mp3', 'audio/mp3');
            await persistAndLoadFromUrl('kit1_Snare', 'Snare', 'https://tonejs.github.io/audio/drum-samples/808/snare.mp3', '808_Snare.mp3', 'audio/mp3');
            await persistAndLoadFromUrl('kit1_Hi-Hat Closed', 'Hi-Hat Closed', 'https://tonejs.github.io/audio/drum-samples/808/hihat.mp3', '808_HH.mp3', 'audio/mp3');
            demoLoaded = true;
            setJustLoadedAction('demo');
          } catch (e) { /* online fallback failed */ }

          if (!demoLoaded) {
            const prepopulated = await prepopulateFromSoundLibrary();
            if (prepopulated) setJustLoadedAction('demo');
          }
        }
        await loadBassFromDB();
        await loadKitFromDB('kit1');
        await refreshSoundbankStatus();
        try { await PersistenceManager.listSectionPresets('drum'); } catch {}
        setLoadingAction(null);
      } catch (e) { console.error('Failed to initialize instrument view:', e); setLoadingAction(null); }
    };
    init();
  }, [refreshSoundbankStatus]);

  const handleDrumUpload = (drum: string) => { setTargetDrum(drum); fileInputRef.current?.click(); };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !targetDrum) return;
    setLoadingDrum(targetDrum);
    try {
      const id = targetDrum === 'bass' ? 'bass_default' : `kit1_${targetDrum}`;
      await persistAndLoadFile(id, targetDrum, file);
      setJustLoadedDrum(targetDrum);
      setTimeout(() => setJustLoadedDrum(null), 1500);
      await refreshSoundbankStatus();
      addToast('Sample Loaded', `Mapped ${file.name} to ${targetDrum}`, 'success');
    } catch { addToast('Load Failed', 'Could not process audio file', 'error'); }
    finally { setLoadingDrum(null); }
  };

  const handleBassNote = useCallback(async (stringIndex: number, fret: number) => {
    const openStringsMidi = [43, 38, 33, 28];
    const midi = openStringsMidi[stringIndex] + fret + bassParams.tuningCoarse;
    const cents = (bassParams.tuningFine || 0) / 100;
    const playbackRate = Math.pow(2, (midi + cents - 36) / 12);
    const duration = bassParams.monoChoke ? bassParams.bleedDecay / 1000 : 1.2;

    await audioEngine.resume();

    const bassTrack = audioEngine.tracks.get('bass');
    if (!bassTrack) return;

    bassTrack.setVolume(bassParams.ampVolume / 100);

    const bassSample = audioEngine.loadedSamples.get('bass');

    if (bassSample) {
      bassTrack.playBufferShifted(bassSample, playbackRate, undefined, 0, duration, 0.9);
      return;
    }

    const freq = 440 * Math.pow(2, (midi - 69) / 12);
    const waveType: OscillatorType = bassParams.style === 'pick' ? 'sawtooth' : 'triangle';
    bassTrack.playOscillator(freq, waveType, audioEngine.ctx.currentTime, duration);
  }, [bassParams]);

  const handleDemoLoad = async () => {
    setIsLoadingSoundbank(true); setLoadingAction('demo');
    try {
      await persistAndLoadFromUrl('kit1_Kick', 'Kick', 'https://tonejs.github.io/audio/drum-samples/808/kick.mp3', '808_Kick.mp3', 'audio/mp3');
      await persistAndLoadFromUrl('kit1_Snare', 'Snare', 'https://tonejs.github.io/audio/drum-samples/808/snare.mp3', '808_Snare.mp3', 'audio/mp3');
      await persistAndLoadFromUrl('kit1_Hi-Hat Closed', 'Hi-Hat Closed', 'https://tonejs.github.io/audio/drum-samples/808/hihat.mp3', '808_HH.mp3', 'audio/mp3');
      await refreshSoundbankStatus();
      setJustLoadedAction('demo');
      addToast('Demo Loaded', 'Standard 808 kit ready.', 'success');
    } catch { addToast('Demo Failed', 'Connectivity error.', 'error'); }
    finally { setIsLoadingSoundbank(false); setLoadingAction(null); setTimeout(() => setJustLoadedAction(null), 2000); }
  };

  const handleSavePreset = async () => {
    const name = prompt('Preset Name:', 'My Preset');
    if (!name) return;
    setIsSavingPreset(true);
    try {
      const type = activeTab === 'drums' ? 'drum' : 'synth';
      const data = activeTab === 'drums' ? audioEngine.drumKit : Ju60Engine.getInstance().getAllPatches();
      await PersistenceManager.saveSectionPreset({ id: crypto.randomUUID(), name, type, data, ownerId: '' });
      addToast('Preset Saved', `Successfully saved ${name}`, 'success');
    } finally { setIsSavingPreset(false); }
  };

  const tabs = useMemo(() => [
    { id: 'drums', label: 'Drums', icon: <Drum size={13} /> },
    { id: 'synth', label: 'Synth', icon: <Sliders size={13} /> },
    { id: 'bass', label: 'Bass', icon: <AudioWaveform size={13} /> },
    { id: 'sampler', label: 'Sampler', icon: <Music size={13} /> },
    { id: 'soundbank', label: 'Soundbank', icon: <Database size={13} /> },
    { id: 'plugins', label: 'Plugins', icon: <Plug size={13} /> },
  ], []) as Array<{ id: TabId; label: string; icon: React.ReactNode }>;

  return (
    <div className="bg-[#111] border-2 border-white/5 rounded-[40px] shadow-[0_30px_60px_rgba(0,0,0,0.8)] h-full flex flex-col relative overflow-hidden">
      <div className="absolute inset-0 bg-texture-dark opacity-30 pointer-events-none mix-blend-overlay" />

      {/* Toast Region */}
      <div className="absolute top-3 right-3 z-[100] flex flex-col gap-1.5 w-56 pointer-events-none">
        {toasts.map(toast => (
          <div key={toast.id} className={`pointer-events-auto p-2.5 rounded-xl border backdrop-blur-md shadow-2xl flex items-start gap-2 animate-in slide-in-from-right-8 duration-300 ${
            toast.variant === 'success' ? 'bg-emerald-950/80 border-emerald-500/30 text-emerald-100' :
            toast.variant === 'error' ? 'bg-rose-950/80 border-rose-500/30 text-rose-100' : 'bg-blue-950/80 border-blue-500/30 text-blue-100'
          }`}>
            {toast.variant === 'success' ? <Check size={14} className="shrink-0 mt-0.5" /> : toast.variant === 'error' ? <AlertCircle size={14} className="shrink-0 mt-0.5" /> : <Info size={14} className="shrink-0 mt-0.5" />}
            <div className="flex flex-col">
              <span className="text-[9px] font-black uppercase tracking-widest">{toast.title}</span>
              {toast.description && <span className="text-[8px] opacity-60 font-medium leading-tight mt-0.5">{toast.description}</span>}
            </div>
          </div>
        ))}
      </div>

      {/* Compact Horizontal Tab Bar */}
      <div className="relative z-10 flex items-center gap-1 px-3 py-2 border-b border-white/5 shrink-0">
        {tabs.map(tab => (
          <button key={tab.id} onClick={() => {
              setActiveTab(tab.id);
              if (tab.id === 'synth') { PersistenceManager.listSectionPresets('synth').catch(() => {}); }
              else if (tab.id === 'drums') { PersistenceManager.listSectionPresets('drum').catch(() => {}); }
            }}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all ${
              activeTab === tab.id
                ? 'bg-gradient-to-r from-orange-500 to-amber-500 text-black shadow-[0_0_10px_rgba(249,115,22,0.3)] font-black'
                : 'text-slate-400 hover:text-white hover:bg-white/5'
            }`}>
            <span className={activeTab === tab.id ? 'text-black' : 'text-orange-500/80'}>{tab.icon}</span>
            {tab.label}
          </button>
        ))}
        <div className="flex-1" />
        <button onClick={handleSavePreset} disabled={isSavingPreset} className="p-1.5 rounded-lg bg-white/5 border border-white/10 text-slate-400 hover:text-orange-400" title="Save Preset">
          {isSavingPreset ? <RefreshCw size={12} className="animate-spin" /> : <Save size={12} />}
        </button>
        {activeTab === 'drums' && loadedDrums['Kick'] && <span className="w-2 h-2 rounded-full bg-emerald-500 shadow-[0_0_6px_#10b981]" title="Drums loaded" />}
        {activeTab === 'soundbank' && (
          <button onClick={handleDemoLoad} disabled={isLoadingSoundbank && loadingAction === 'demo'}
            className="flex items-center gap-1 px-2 py-1 rounded-lg border border-white/10 text-[9px] font-mono text-slate-400 hover:text-orange-400 disabled:opacity-30">
            <RefreshCw size={10} className={isLoadingSoundbank && loadingAction === 'demo' ? 'animate-spin' : ''} /> Demo
          </button>
        )}
      </div>

      {/* Full-Screen Instrument Area */}
      <div className="relative z-10 flex-1 overflow-hidden">
        {activeTab === 'drums' && <DrumsTab loadedDrums={loadedDrums} loadingDrum={loadingDrum} justLoadedDrum={justLoadedDrum} onUploadClick={handleDrumUpload} drumKit={audioEngine.drumKit} />}
        {activeTab === 'synth' && <SynthView />}
        {activeTab === 'bass' && (
          <BassTab params={bassParams}
            onUpdate={(k, v) => setBassParams(p => ({ ...p, [k]: v as any }))}
            onReplaceParams={(p) => setBassParams(p)}
            loaded={loadedDrums['bass']} loading={loadingDrum === 'bass'} justLoaded={justLoadedDrum === 'bass'}
            onUploadClick={() => { setTargetDrum('bass'); fileInputRef.current?.click(); }}
            onPlayNote={handleBassNote} activeSampleName={soundbankStatus.bass.filename || 'No sample loaded'} />
        )}
        {activeTab === 'soundbank' && (
          <SoundbankTab status={soundbankStatus} isLoading={isLoadingSoundbank} loadingAction={loadingAction}
            justLoadedAction={justLoadedAction} onLoadDemo={handleDemoLoad} onQuickLoadKit={handleQuickLoadKit}
            onQuickLoadBass={handleQuickLoadBass} onClearSoundbank={handleClearSoundbank}
            onFolderImport={handleFolderImport} />
        )}
        {activeTab === 'plugins' && <div className="p-3 h-full"><WamPluginLoader /></div>}
        {activeTab === 'sampler' && <div className="flex-1 flex flex-col h-full"><OneShotSamplerPanel /></div>}
      </div>

      <input type="file" ref={fileInputRef} className="hidden" accept="audio/*" onChange={handleFileChange} />
    </div>
  );
}
