import React, { useState, useEffect, useCallback } from 'react';
import { WamHost, WamPluginInfo } from '../lib/audio/wamHost';
import { audioEngine } from '../lib/audio/engine';
import { Plug, Plus, Trash2, Check, AlertCircle } from 'lucide-react';

const DEMO_PLUGINS: WamPluginInfo[] = [
  {
    id: 'webdx7',
    name: 'DX7 FM Synth',
    url: 'https://www.webaudiomodules.org/wams/wam-example/dx7/dx7.js',
    type: 'synth',
    author: 'WAM Community',
  },
  {
    id: 'wam-cz101',
    name: 'CZ-101 Phase Distortion',
    url: 'https://www.webaudiomodules.org/wams/wam-example/cz101/cz101.js',
    type: 'synth',
    author: 'WAM Community',
  },
];

export function WamPluginLoader() {
  const [plugins, setPlugins] = useState<WamPluginInfo[]>([]);
  const [loading, setLoading] = useState<string | null>(null);
  const [loadResults, setLoadResults] = useState<Record<string, boolean>>({});
  const [customUrl, setCustomUrl] = useState('');
  const [showCustom, setShowCustom] = useState(false);

  const host = WamHost.getInstance();

  useEffect(() => {
    host.init(audioEngine.ctx);
    setPlugins(host.getLoadedPlugins());
    const unsub = host.onPluginChange((info, loaded) => {
      setLoadResults(prev => ({ ...prev, [info.id]: loaded }));
      setPlugins(host.getLoadedPlugins());
    });
    return () => { unsub(); };
  }, []);

  const handleLoad = useCallback(async (p: WamPluginInfo) => {
    setLoading(p.id);
    try {
      await host.loadPlugin(p);
    } catch (err) {
      console.warn('Failed to load plugin:', err);
    }
    setLoading(null);
  }, []);

  const handleUnload = useCallback((id: string) => {
    host.unloadPlugin(id);
    setPlugins(host.getLoadedPlugins());
  }, []);

  const handleLoadCustom = useCallback(async () => {
    if (!customUrl.trim()) return;
    const url = customUrl.trim();
    if (!url.startsWith('https://') && !url.startsWith('http://')) {
      alert('Plugin URL must start with http:// or https://');
      return;
    }
    const confirmed = window.confirm(
      `Loading a plugin executes external JavaScript in this app.\n\nOnly load plugins from sources you trust.\n\nURL: ${url}\n\nProceed?`
    );
    if (!confirmed) return;
    const id = `custom-${Date.now()}`;
    const plugin: WamPluginInfo = {
      id,
      name: url.split('/').pop() || id,
      url,
      type: 'synth',
    };
    setLoading(id);
    await host.loadPlugin(plugin);
    setLoading(null);
    setCustomUrl('');
    setShowCustom(false);
  }, [customUrl]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-[10px] font-mono text-slate-400">
          <Plug size={14} className="text-orange-400" />
          Web Audio Modules (WAM)
        </div>
        <button
          onClick={() => setShowCustom(!showCustom)}
          className="flex items-center gap-1 rounded-lg border border-white/10 px-2 py-1 text-[9px] font-mono text-slate-400 hover:text-white transition-all"
        >
          <Plus size={10} /> Custom URL
        </button>
      </div>

      {showCustom && (
        <div className="flex gap-2">
          <input
            type="text"
            value={customUrl}
            onChange={e => setCustomUrl(e.target.value)}
            placeholder="https://example.com/plugin.js"
            className="flex-1 bg-black/60 border border-white/10 rounded-lg px-3 py-1.5 text-xs text-white font-mono focus:outline-none focus:border-orange-500/50"
          />
          <button
            onClick={handleLoadCustom}
            disabled={!customUrl.trim() || loading !== null}
            className="rounded-lg bg-orange-500 px-3 py-1.5 text-[10px] font-bold text-black disabled:opacity-40 hover:bg-orange-400 transition-all"
          >
            Load
          </button>
        </div>
      )}

      <div className="space-y-2">
        {DEMO_PLUGINS.map(p => {
          const isLoaded = plugins.some(x => x.id === p.id);
          const isLoading = loading === p.id;
          const failed = loadResults[p.id] === false;
          return (
            <div key={p.id} className="flex items-center justify-between rounded-xl border border-white/5 bg-black/40 p-3">
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-white">{p.name}</span>
                  <span className="rounded border border-white/5 bg-white/5 px-1.5 py-0.5 text-[8px] font-mono text-slate-500 uppercase">{p.type}</span>
                </div>
                {p.author && (
                  <span className="text-[9px] text-slate-500 font-mono">{p.author}</span>
                )}
              </div>
              <div className="flex items-center gap-2">
                {isLoaded ? (
                  <>
                    <span className="flex items-center gap-1 text-[9px] text-emerald-500">
                      <Check size={10} /> Loaded
                    </span>
                    <button
                      onClick={() => handleUnload(p.id)}
                      className="rounded-lg border border-red-500/20 p-1.5 text-red-400 hover:bg-red-500/10 transition-all"
                    >
                      <Trash2 size={12} />
                    </button>
                  </>
                ) : (
                  <button
                    onClick={() => handleLoad(p)}
                    disabled={isLoading}
                    className={`rounded-lg px-3 py-1.5 text-[10px] font-bold transition-all ${
                      isLoading
                        ? 'bg-orange-500/20 text-orange-400 animate-pulse'
                        : failed
                        ? 'bg-amber-500/20 text-amber-400'
                        : 'bg-orange-500 text-black hover:bg-orange-400'
                    }`}
                  >
                    {isLoading ? 'Loading...' : failed ? 'Retry' : 'Load'}
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {plugins.length > 0 && (
        <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-3">
          <span className="text-[9px] font-bold uppercase tracking-widest text-emerald-400">
            Active Plugins ({plugins.length})
          </span>
          <div className="mt-2 space-y-1">
            {plugins.map(p => (
              <div key={p.id} className="flex justify-between text-[10px] text-slate-400 font-mono">
                <span>{p.name}</span>
                <span className="text-emerald-500">online</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
