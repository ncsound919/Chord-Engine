import React, { memo, useRef } from 'react';
import { Database, Folder, RefreshCw, Check } from 'lucide-react';
import { SoundbankStatus } from './types';

interface SoundbankTabProps {
  status: SoundbankStatus;
  isLoading: boolean;
  loadingAction: string | null;
  justLoadedAction: string | null;
  onFolderImport: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onLoadDemo: () => void;
  onQuickLoadKit: (kitId: 'kit1' | 'kit2') => void;
  onQuickLoadBass: () => void;
  onClearSoundbank: () => void;
}

export const SoundbankTab = memo(({
  status,
  isLoading,
  loadingAction,
  justLoadedAction,
  onFolderImport,
  onLoadDemo,
  onQuickLoadKit,
  onQuickLoadBass,
  onClearSoundbank
}: SoundbankTabProps) => {
  const folderInputRef = useRef<HTMLInputElement>(null);

  const bassLoaded = status.bass.loaded;
  const kit1Loaded = Object.values(status.kit1).some(s => s.loaded);
  const kit2Loaded = Object.values(status.kit2).some(s => s.loaded);

  return (
    <div 
      className="space-y-6 flex flex-col h-full overflow-y-auto custom-scrollbar pr-2 animate-in fade-in duration-500"
      role="tabpanel"
      aria-label="Soundbank management"
      aria-busy={isLoading}
    >
      <div>
        <h3 className="text-sm font-bold text-slate-300 uppercase tracking-widest flex items-center gap-2">
          <Database size={16} className="text-orange-400" />
          Deterministic Soundbank Controller
        </h3>
        <p className="text-xs text-slate-500 mb-2 italic">
          Recursive directory scanning & browser IndexedDB sample synchronization. Automatically parses and maps drum/bass samples from your selected folder.
        </p>
      </div>

      <div className={`bg-black/40 border-2 rounded-2xl p-6 text-center transition-all duration-500 flex flex-col items-center justify-center relative group ${
        loadingAction === 'folder'
          ? 'border-blue-500 bg-blue-950/10 shadow-[0_0_20px_rgba(59,130,246,0.15)] animate-pulse'
          : justLoadedAction === 'folder'
            ? 'border-emerald-500 bg-emerald-950/20 shadow-[0_0_30px_rgba(16,185,129,0.3)]'
            : 'border-dashed border-white/10 hover:border-orange-500/30'
      }`}>
        <input 
          type="file" 
          ref={folderInputRef} 
          className="hidden" 
          {...{ webkitdirectory: "", directory: "", multiple: true } as any} 
          onChange={onFolderImport} 
        />
        <div className={`p-4 rounded-full mb-3 group-hover:scale-110 transition-transform ${
          loadingAction === 'folder'
            ? 'bg-blue-500/15 text-blue-400'
            : justLoadedAction === 'folder'
              ? 'bg-emerald-500/20 text-emerald-400 animate-bounce'
              : 'bg-orange-500/10 text-orange-400'
        }`}>
          {loadingAction === 'folder' ? (
            <RefreshCw size={32} className="animate-spin" />
          ) : justLoadedAction === 'folder' ? (
            <Check size={32} />
          ) : (
            <Folder size={32} />
          )}
        </div>
        <h4 className="text-xs font-bold text-slate-200 uppercase tracking-wider mb-1">Import Entire Local Folder</h4>
        <p className="text-[10px] text-slate-500 max-w-md mb-4 leading-relaxed">
          Click below to select your <code className="bg-white/5 px-1 py-0.5 rounded text-orange-400 font-mono">Deterministic Engine Soundbank</code> directory. The system will scan, map, and store your default bass patch and 2 drum kits into durable browser storage.
        </p>
        
        <div className="flex gap-2">
          <button 
            onClick={() => folderInputRef.current?.click()}
            disabled={isLoading}
            className={`px-4 py-2 font-bold text-[10px] uppercase tracking-widest rounded-lg shadow-lg active:scale-95 transition-all disabled:opacity-50 flex items-center gap-1.5 ${
              loadingAction === 'folder'
                ? 'bg-blue-600 text-white animate-pulse'
                : justLoadedAction === 'folder'
                  ? 'bg-emerald-600 text-white'
                  : 'bg-gradient-to-b from-orange-500 to-orange-600 text-black hover:brightness-110'
            }`}
          >
            {loadingAction === 'folder' ? (
              <>
                <RefreshCw size={10} className="animate-spin" />
                Scanning...
              </>
            ) : justLoadedAction === 'folder' ? (
              <>
                <Check size={10} />
                Imported!
              </>
            ) : (
              "Select Soundbank Folder"
            )}
          </button>

          <button
            onClick={onLoadDemo}
            disabled={isLoading}
            className={`px-4 py-2 border font-bold text-[10px] uppercase tracking-widest rounded-lg active:scale-95 transition-all disabled:opacity-50 flex items-center gap-1.5 ${
              loadingAction === 'demo'
                ? 'bg-blue-500/20 border-blue-500 text-blue-300'
                : justLoadedAction === 'demo'
                  ? 'bg-emerald-500/20 border-emerald-500 text-emerald-400 shadow-[0_0_15px_rgba(16,185,129,0.3)]'
                  : 'bg-white/5 border-white/10 text-slate-300 hover:bg-white/10'
            }`}
          >
            {loadingAction === 'demo' ? (
              <>
                <RefreshCw size={10} className="animate-spin" />
                Fetching...
              </>
            ) : justLoadedAction === 'demo' ? (
              <>
                <Check size={10} />
                Demo Ready!
              </>
            ) : (
              "Quick Load Demo Samples"
            )}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        
        {/* Bass Patch Matrix */}
        <div className={`bg-[#151518] border rounded-2xl p-4 flex flex-col justify-between transition-all duration-500 ${
          justLoadedAction === 'bass' 
            ? 'border-emerald-500/50 bg-emerald-950/10 shadow-[0_0_30px_rgba(16,185,129,0.25)] scale-[1.02]' 
            : 'border-white/5'
        }`}>
          <div>
            <div className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-3 flex items-center justify-between">
              <h5>Bass Patch</h5>
              <div className="flex items-center gap-1.5">
                <span className={`text-[8px] font-mono ${status.bass.loaded ? 'text-emerald-400' : 'text-rose-500'}`}>
                  {status.bass.loaded ? 'LOADED' : 'MISSING'}
                </span>
                <span 
                  className={`w-2 h-2 rounded-full ${status.bass.loaded ? 'bg-green-500 shadow-[0_0_10px_#22c55e]' : 'bg-red-500'}`}
                  aria-hidden="true"
                ></span>
              </div>
            </div>
            <p className="text-[10px] text-slate-500 leading-normal mb-4">
              Holds the default electric bass sampler resource used for custom fret mapping.
            </p>
            {status.bass.loaded ? (
              <div className="p-2 rounded bg-black/60 border border-white/5 text-[9px] font-mono text-green-400 truncate flex items-center gap-2">
                <span className="w-1.5 h-1.5 bg-green-500 rounded-full animate-ping" aria-hidden="true"></span>
                {status.bass.filename}
              </div>
            ) : (
              <div className="p-2 rounded bg-black/40 border border-dashed border-white/5 text-[9px] font-mono text-slate-600 italic">
                No bass sample loaded
              </div>
            )}
          </div>
          <button
            onClick={onQuickLoadBass}
            disabled={isLoading}
            aria-label={loadingAction === 'bass' ? 'Mapping bass' : bassLoaded ? 'Reload Bass' : 'Quick Load Bass'}
            className={`mt-4 w-full py-1.5 border font-bold text-[9px] uppercase tracking-widest rounded transition-all flex items-center justify-center gap-1.5 ${
              loadingAction === 'bass'
                ? 'bg-blue-500/20 border-blue-500 text-blue-300'
                : justLoadedAction === 'bass'
                  ? 'bg-emerald-500/20 border-emerald-500 text-emerald-400'
                  : 'bg-white/5 hover:bg-orange-500/10 border-white/10 hover:border-orange-500/20 text-slate-300 hover:text-orange-400'
            }`}
          >
            {loadingAction === 'bass' ? (
              <>
                <RefreshCw size={10} className="animate-spin" aria-hidden="true" />
                Mapping...
              </>
            ) : justLoadedAction === 'bass' ? (
              <>
                <Check size={10} aria-hidden="true" />
                Bass Mapped!
              </>
            ) : (
              bassLoaded ? "Reload Bass" : "Quick Load Bass"
            )}
          </button>
        </div>

        {/* Kit 1 Matrix */}
        <div className={`bg-[#151518] border rounded-2xl p-4 flex flex-col justify-between transition-all duration-500 ${
          justLoadedAction === 'kit1' 
            ? 'border-emerald-500/50 bg-emerald-950/10 shadow-[0_0_30px_rgba(16,185,129,0.25)] scale-[1.02]' 
            : 'border-white/5'
        }`}>
          <div>
            <div className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-3 flex items-center justify-between">
              <h5>Drum Kit 1 (MPC-60)</h5>
              <div className="flex items-center gap-1.5">
                <span className={`text-[8px] font-mono ${kit1Loaded ? 'text-emerald-400' : 'text-rose-500'}`}>
                  {kit1Loaded ? 'ACTIVE' : 'MISSING'}
                </span>
                <span 
                  className={`w-2 h-2 rounded-full ${kit1Loaded ? 'bg-green-500 shadow-[0_0_10px_#22c55e]' : 'bg-red-500'}`}
                  aria-hidden="true"
                ></span>
              </div>
            </div>
            <p className="text-[10px] text-slate-500 leading-normal mb-4">
              Vintage electronic/retro drum kit mapping.
            </p>
            <div className="grid grid-cols-3 gap-1 mb-4" role="list" aria-label="Kit 1 samples status">
              {Object.entries(status.kit1).map(([drum, s]) => (
                <div 
                  key={drum} 
                  className={`p-1 text-[7px] font-mono rounded text-center truncate ${s.loaded ? 'bg-orange-500/10 border border-orange-500/20 text-orange-400' : 'bg-black/30 text-slate-600'}`}
                  title={s.filename || drum}
                  role="listitem"
                >
                  {drum} {s.loaded ? '✓' : ''}
                </div>
              ))}
            </div>
          </div>
          <button
            onClick={() => onQuickLoadKit('kit1')}
            disabled={isLoading}
            aria-label={loadingAction === 'kit1' ? 'Mapping kit 1' : kit1Loaded ? 'Reload Kit 1' : 'Quick Load Kit 1'}
            className={`w-full py-1.5 border font-bold text-[9px] uppercase tracking-widest rounded transition-all flex items-center justify-center gap-1.5 ${
              loadingAction === 'kit1'
                ? 'bg-blue-500/20 border-blue-500 text-blue-300'
                : justLoadedAction === 'kit1'
                  ? 'bg-emerald-500/20 border-emerald-500 text-emerald-400'
                  : 'bg-white/5 hover:bg-orange-500/10 border-white/10 hover:border-orange-500/20 text-slate-300 hover:text-orange-400'
            }`}
          >
            {loadingAction === 'kit1' ? (
              <>
                <RefreshCw size={10} className="animate-spin" aria-hidden="true" />
                Mapping...
              </>
            ) : justLoadedAction === 'kit1' ? (
              <>
                <Check size={10} aria-hidden="true" />
                Kit 1 Mapped!
              </>
            ) : (
              kit1Loaded ? "Reload Kit 1" : "Quick Load Kit 1"
            )}
          </button>
        </div>

        {/* Kit 2 Matrix */}
        <div className={`bg-[#151518] border rounded-2xl p-4 flex flex-col justify-between transition-all duration-500 ${
          justLoadedAction === 'kit2' 
            ? 'border-emerald-500/50 bg-emerald-950/10 shadow-[0_0_30px_rgba(16,185,129,0.25)] scale-[1.02]' 
            : 'border-white/5'
        }`}>
          <div>
            <div className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-3 flex items-center justify-between">
              <h5>Drum Kit 2 (Pearl)</h5>
              <div className="flex items-center gap-1.5">
                <span className={`text-[8px] font-mono ${kit2Loaded ? 'text-emerald-400' : 'text-rose-500'}`}>
                  {kit2Loaded ? 'ACTIVE' : 'MISSING'}
                </span>
                <span 
                  className={`w-2 h-2 rounded-full ${kit2Loaded ? 'bg-green-500 shadow-[0_0_10px_#22c55e]' : 'bg-red-500'}`}
                  aria-hidden="true"
                ></span>
              </div>
            </div>
            <p className="text-[10px] text-slate-500 leading-normal mb-4">
              Studio natural/acoustic drum kit mapping.
            </p>
            <div className="grid grid-cols-3 gap-1 mb-4" role="list" aria-label="Kit 2 samples status">
              {Object.entries(status.kit2).map(([drum, s]) => (
                <div 
                  key={drum} 
                  className={`p-1 text-[7px] font-mono rounded text-center truncate ${s.loaded ? 'bg-orange-500/10 border border-orange-500/20 text-orange-400' : 'bg-black/30 text-slate-600'}`}
                  title={s.filename || drum}
                  role="listitem"
                >
                  {drum} {s.loaded ? '✓' : ''}
                </div>
              ))}
            </div>
          </div>
          <button
            onClick={() => onQuickLoadKit('kit2')}
            disabled={isLoading}
            aria-label={loadingAction === 'kit2' ? 'Mapping kit 2' : kit2Loaded ? 'Reload Kit 2' : 'Quick Load Kit 2'}
            className={`w-full py-1.5 border font-bold text-[9px] uppercase tracking-widest rounded transition-all flex items-center justify-center gap-1.5 ${
              loadingAction === 'kit2'
                ? 'bg-blue-500/20 border-blue-500 text-blue-300'
                : justLoadedAction === 'kit2'
                  ? 'bg-emerald-500/20 border-emerald-500 text-emerald-400'
                  : 'bg-white/5 hover:bg-orange-500/10 border-white/10 hover:border-orange-500/20 text-slate-300 hover:text-orange-400'
            }`}
          >
            {loadingAction === 'kit2' ? (
              <>
                <RefreshCw size={10} className="animate-spin" aria-hidden="true" />
                Mapping...
              </>
            ) : justLoadedAction === 'kit2' ? (
              <>
                <Check size={10} aria-hidden="true" />
                Kit 2 Mapped!
              </>
            ) : (
              kit2Loaded ? "Reload Kit 2" : "Quick Load Kit 2"
            )}
          </button>
        </div>

      </div>

      <div className="pt-4 border-t border-white/5 flex justify-between items-center text-[10px]">
        <span className="text-slate-500 font-mono">Persistence: Local IndexedDB (Durable Sandbox)</span>
        <button
          onClick={onClearSoundbank}
          aria-label="Clear all soundbank data from storage (requires confirmation)"
          className="text-red-500/70 hover:text-red-400 transition-colors uppercase font-mono tracking-wider font-bold focus:outline-none focus:ring-1 focus:ring-red-500 p-1 rounded"
        >
          Clear Persistent Soundbank DB
        </button>
      </div>
    </div>
  );
});

SoundbankTab.displayName = 'SoundbankTab';
