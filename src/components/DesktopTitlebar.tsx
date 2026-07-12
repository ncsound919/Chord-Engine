import React, { useState, useEffect, useCallback } from 'react';
import { Minus, Square, X, Maximize2, Minimize2, Usb } from 'lucide-react';
import { isTauri, minimizeWindow, maximizeWindow, closeWindow } from '../lib/tauriBridge';
import { useMidiHardware } from '../hooks/useMidiHardware';

interface DesktopTitlebarProps {
  projectName: string;
  onMidiNote: (note: number, velocity: number, on: boolean) => void;
}

async function toggleBrowserFullscreen(): Promise<boolean> {
  try {
    if (document.fullscreenElement) {
      await document.exitFullscreen();
      return false;
    }
    await document.documentElement.requestFullscreen();
    return true;
  } catch {
    return document.fullscreenElement !== null;
  }
}

export function DesktopTitlebar({ projectName, onMidiNote }: DesktopTitlebarProps) {
  const [isMaximized, setIsMaximized] = useState(false);
  const midi = useMidiHardware();
  const [midiPanelOpen, setMidiPanelOpen] = useState(false);

  const tauri = isTauri();

  useEffect(() => {
    if (!tauri) return;
    let mounted = true;

    try {
      import('@tauri-apps/api/event').then(({ listen }) => {
        if (!mounted) return;
        listen<{ type: string; note: number; velocity: number; channel: number }>('midi-event', (event) => {
          const { type, note, velocity } = event.payload;
          onMidiNote(note, velocity, type === 'note_on');
        });
      });
    } catch {}

    try {
      import('@tauri-apps/api/window').then(({ getCurrentWindow }) => {
        if (!mounted) return;
        getCurrentWindow().onResized(() => {
          getCurrentWindow().isMaximized().then(setIsMaximized);
        });
      });
    } catch {}

    return () => { mounted = false; };
  }, [tauri, onMidiNote]);

  // Browser fullscreen change listener
  useEffect(() => {
    if (tauri) return;
    const handler = () => setIsMaximized(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', handler);
    return () => document.removeEventListener('fullscreenchange', handler);
  }, [tauri]);

  const handleMaximize = useCallback(async () => {
    if (tauri) {
      try {
        const maximized = await maximizeWindow();
        setIsMaximized(maximized);
      } catch {
        setIsMaximized(prev => !prev);
      }
    } else {
      const full = await toggleBrowserFullscreen();
      setIsMaximized(full);
    }
  }, [tauri]);

  if (!tauri) {
    // In browser mode, show minimal titlebar with fullscreen
    return (
      <div className="relative z-[9999]">
        <div className="h-10 bg-[#0a0a0f] border-b border-white/10 flex items-center justify-between px-3 select-none">
          <div className="flex items-center gap-3">
            <img src="/logo.png" alt="Chord Engine" className="w-6 h-6 rounded object-contain shrink-0" />
            <span className="text-[9px] font-mono text-slate-500 tracking-wider">{projectName}</span>
          </div>
          <div className="flex items-center gap-0.5">
            <button
              onClick={handleMaximize}
              className="w-8 h-7 flex items-center justify-center rounded hover:bg-white/10 text-slate-500 hover:text-white transition-colors"
              title={isMaximized ? "Exit fullscreen" : "Enter fullscreen"}
            >
              {isMaximized ? <Minimize2 size={12} /> : <Maximize2 size={12} />}
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="relative z-[9999]">
      {/* Drag region */}
      <div
        data-tauri-drag-region
        className="h-10 bg-[#0a0a0f] border-b border-white/10 flex items-center justify-between px-3 select-none"
      >
        {/* Left: Logo + MIDI indicator + app name */}
        <div className="flex items-center gap-3">
          <img src="/logo.png" alt="Chord Engine" className="w-6 h-6 rounded object-contain shrink-0" />
          <button
            onClick={() => setMidiPanelOpen(!midiPanelOpen)}
            className={`flex items-center gap-1 px-2 py-1 rounded text-[9px] font-mono font-bold transition-all ${
              midi.connection.input_connected
                ? 'bg-emerald-500/10 border border-emerald-500/30 text-emerald-400'
                : 'bg-black/20 border border-white/5 text-slate-600 hover:text-slate-400'
            }`}
            title="MIDI Hardware"
          >
            <Usb size={10} />
            MIDI
          </button>
          <span className="text-[9px] font-mono text-slate-500 tracking-wider">
            {projectName}
          </span>
        </div>

        {/* Center: drag region */}
        <div data-tauri-drag-region className="flex-1" />

        {/* Right: window controls */}
        <div className="flex items-center gap-0.5">
          <button
            onClick={minimizeWindow}
            className="w-8 h-7 flex items-center justify-center rounded hover:bg-white/10 text-slate-500 hover:text-white transition-colors"
          >
            <Minus size={12} />
          </button>
          <button
            onClick={handleMaximize}
            className="w-8 h-7 flex items-center justify-center rounded hover:bg-white/10 text-slate-500 hover:text-white transition-colors"
            title={isMaximized ? "Restore down" : "Maximize"}
          >
            {isMaximized ? <Minimize2 size={12} /> : <Maximize2 size={12} />}
          </button>
          <button
            onClick={closeWindow}
            className="w-8 h-7 flex items-center justify-center rounded hover:bg-red-500/80 text-slate-500 hover:text-white transition-colors"
          >
            <X size={13} />
          </button>
        </div>
      </div>

      {/* MIDI panel */}
      {midiPanelOpen && (
        <div className="absolute top-10 right-2 w-72 bg-[#0a0a0f] border border-white/10 rounded-xl shadow-2xl p-4 z-50">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-[10px] font-bold uppercase tracking-widest text-slate-400">MIDI Hardware</h3>
            <button onClick={() => setMidiPanelOpen(false)} className="text-slate-500 hover:text-white">
              <X size={12} />
            </button>
          </div>

          {midi.error && (
            <p className="text-[9px] font-mono text-red-400 mb-2">{midi.error}</p>
          )}

          <div className="space-y-3">
            <div>
              <span className="text-[8px] font-mono text-slate-600 uppercase tracking-widest">Input</span>
              {midi.inputs.length === 0 ? (
                <p className="text-[9px] text-slate-600 mt-1">No MIDI inputs found</p>
              ) : (
                <select
                  value={midi.connection.input_connected ? midi.inputs.findIndex(p => p.name === midi.connection.input_port) : -1}
                  onChange={e => {
                    const idx = parseInt(e.target.value, 10);
                    if (idx >= 0) midi.connectInput(idx);
                    else midi.disconnectInput();
                  }}
                  className="mt-1 w-full bg-black/60 border border-white/10 rounded-lg px-2 py-1 text-[10px] font-mono text-slate-300"
                >
                  <option value={-1}>— Disconnected —</option>
                  {midi.inputs.map((p, i) => (
                    <option key={i} value={i}>{p.name}</option>
                  ))}
                </select>
              )}
            </div>

            <div>
              <span className="text-[8px] font-mono text-slate-600 uppercase tracking-widest">Output</span>
              {midi.outputs.length === 0 ? (
                <p className="text-[9px] text-slate-600 mt-1">No MIDI outputs found</p>
              ) : (
                <select
                  value={midi.connection.output_connected ? midi.outputs.findIndex(p => p.name === midi.connection.output_port) : -1}
                  onChange={e => {
                    const idx = parseInt(e.target.value, 10);
                    if (idx >= 0) midi.connectOutput(idx);
                    else midi.disconnectOutput();
                  }}
                  className="mt-1 w-full bg-black/60 border border-white/10 rounded-lg px-2 py-1 text-[10px] font-mono text-slate-300"
                >
                  <option value={-1}>— Disconnected —</option>
                  {midi.outputs.map((p, i) => (
                    <option key={i} value={i}>{p.name}</option>
                  ))}
                </select>
              )}
            </div>
          </div>

          <button
            onClick={midi.refreshPorts}
            className="mt-3 w-full py-1 rounded-lg border border-white/10 text-[9px] font-mono text-slate-500 hover:text-slate-300 transition-colors"
          >
            Refresh
          </button>
        </div>
      )}
    </div>
  );
}
