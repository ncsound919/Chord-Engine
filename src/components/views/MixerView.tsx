import React, {
  memo,
  useCallback,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
} from 'react';
import {
  Activity,
  Disc,
  Sliders,
  Zap,
  Waves,
} from 'lucide-react';
import { audioEngine, MAIN_TRACKS, getTrack } from '../../lib/audio/engine';
import { AudioEngine } from '../../lib/audio/engine';

const SYNTH_SUBTRACKS = ['lead', 'pads', 'bass'] as const;
const SAMPLER_TRACKS = ['oneshots', 'guitar-sampler', 'keys-sampler'] as const;
import { useTransport } from '../../hooks/useTransport';
import { WaveformTimeline } from '../WaveformTimeline';

// ── Types ────────────────────────────────────────
type MixerTab = 'main' | 'drums' | 'synth' | 'sampler';

interface ChannelParams {
  volume: number;
  pan: number;
  trim: number;
  eqHigh: number;
  eqLow: number;
  auxSend: number;
}

interface ChannelStatus {
  muted: boolean;
  soloed: boolean;
}

type ChannelId = string;

interface MixerState {
  channels: Record<ChannelId, ChannelParams>;
  status: Record<ChannelId, ChannelStatus>;
  meterLevels: Record<ChannelId, number>;
  master: {
    volume: number;
    leftLevel: number;
    rightLevel: number;
  };
}

// ── Constants ─────────────────────────────────────
const DRUM_SUBMIX_TRACKS = [
  'kick',
  'snare',
  'hihat',
  'toms',
  'overhead',
] as const;

const DEFAULT_CHANNEL_PARAMS: ChannelParams = {
  volume: 0.8,
  pan: 0,
  trim: 0,
  eqHigh: 0,
  eqLow: 0,
  auxSend: 0,
};

const TRACK_COLORS: Record<string, string> = {
  drums:           'from-red-900/40 to-red-950/20 border-red-500/20',
  bass:            'from-blue-900/40 to-blue-950/20 border-blue-500/20',
  keys:            'from-emerald-900/40 to-emerald-950/20 border-emerald-500/20',
  guitar:          'from-amber-900/40 to-amber-950/20 border-amber-500/20',
  pads:            'from-purple-900/40 to-purple-950/20 border-purple-500/20',
  'synth-lead':    'from-rose-900/40 to-rose-950/20 border-rose-500/20',
  'synth-pad':     'from-violet-900/40 to-violet-950/20 border-violet-500/20',
  'synth-bass':    'from-indigo-900/40 to-indigo-950/20 border-indigo-500/20',
  oneshots:        'from-teal-900/40 to-teal-950/20 border-teal-500/20',
  'guitar-sampler':'from-lime-900/40 to-lime-950/20 border-lime-500/20',
  'keys-sampler':  'from-sky-900/40 to-sky-950/20 border-sky-500/20',
  kick:            'from-orange-900/40 to-orange-950/20 border-orange-500/20',
  snare:           'from-yellow-900/40 to-yellow-950/20 border-yellow-500/20',
  hihat:           'from-cyan-900/40 to-cyan-950/20 border-cyan-500/20',
  toms:            'from-pink-900/40 to-pink-950/20 border-pink-500/20',
  overhead:        'from-slate-900/40 to-slate-950/20 border-slate-500/20',
};

const PARAM_OVERRIDES: Record<string, Partial<ChannelParams>> = {
  drums:    { volume: 0.8,  pan: 0,    trim: 0,   eqHigh: 2,  eqLow: 3,  auxSend: 15 },
  bass:     { volume: 0.8,  pan: -0.05, trim: 2,   eqHigh: -2, eqLow: 4,  auxSend: 5 },
  keys:     { volume: 0.75, pan: -0.25, trim: -1,  eqHigh: 3,  eqLow: -2, auxSend: 45 },
  guitar:   { volume: 0.8,  pan: 0.3,   trim: 0,   eqHigh: 1,  eqLow: -1, auxSend: 30 },
  pads:     { volume: 0.7,  pan: 0.1,   trim: -2,  eqHigh: 4,  eqLow: 1,  auxSend: 60 },
  'synth-lead':  { volume: 0.75, pan: -0.15, trim: -1, eqHigh: 2, eqLow: -1, auxSend: 35 },
  'synth-pad':   { volume: 0.7,  pan: 0.15,  trim: -2, eqHigh: 3, eqLow: 1,  auxSend: 55 },
  'synth-bass':  { volume: 0.8,  pan: 0,     trim: 1,  eqHigh: -1, eqLow: 3, auxSend: 5 },
  oneshots:      { volume: 0.8,  pan: -0.1,  trim: 0,  eqHigh: 2, eqLow: 0,  auxSend: 25 },
  'guitar-sampler': { volume: 0.75, pan: 0.35, trim: -1, eqHigh: 3, eqLow: -1, auxSend: 30 },
  'keys-sampler':   { volume: 0.7,  pan: -0.2, trim: -1, eqHigh: 3, eqLow: -1, auxSend: 40 },
  kick:     { volume: 0.9,  pan: 0,     trim: 4,   eqHigh: -1, eqLow: 5,  auxSend: 0 },
  snare:    { volume: 0.8,  pan: -0.02, trim: 1,   eqHigh: 3,  eqLow: 0,  auxSend: 20 },
  hihat:    { volume: 0.7,  pan: 0.45,  trim: -2,  eqHigh: 5,  eqLow: -4, auxSend: 15 },
  toms:     { volume: 0.6,  pan: -0.35, trim: 0,   eqHigh: 1,  eqLow: 2,  auxSend: 25 },
  overhead: { volume: 0.5,  pan: -0.1,  trim: -4,  eqHigh: 4,  eqLow: -3, auxSend: 35 },
};

const PARAM_LIMITS: Record<keyof ChannelParams, readonly [min: number, max: number]> = {
  volume: [0, 1.2],
  pan: [-1, 1],
  trim: [-10, 10],
  eqHigh: [-12, 12],
  eqLow: [-12, 12],
  auxSend: [0, 100],
};

// ── Helpers ───────────────────────────────────────
function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function linearToDb(value: number) {
  if (value <= 0.0001) return '-∞';
  return (20 * Math.log10(value)).toFixed(1);
}

// Supports both Map and plain object track collections.
// ── Initial state builder ─────────────────────────
function buildInitialMixerState(): MixerState {
  const allTracks = [...MAIN_TRACKS, ...SYNTH_SUBTRACKS, ...SAMPLER_TRACKS, ...DRUM_SUBMIX_TRACKS];
  const channels: Record<string, ChannelParams> = {};
  const status: Record<string, ChannelStatus> = {};

  allTracks.forEach((id) => {
    const overrides = PARAM_OVERRIDES[id] ?? {};
    channels[id] = { ...DEFAULT_CHANNEL_PARAMS, ...overrides };
    status[id] = { muted: false, soloed: false };
  });

  return {
    channels,
    status,
    meterLevels: {},
    master: { volume: 0.8, leftLevel: 0, rightLevel: 0 },
  };
}

// ── Reducer ───────────────────────────────────────
type MixerAction =
  | { type: 'SET_CHANNEL_PARAM'; trackId: string; key: keyof ChannelParams; value: number }
  | { type: 'TOGGLE_MUTE'; trackId: string }
  | { type: 'TOGGLE_SOLO'; trackId: string }
  | { type: 'SET_MASTER_VOLUME'; value: number }
  | { type: 'SYNC_ENGINE_VALUES'; values: { channels: Record<string, ChannelParams>; status: Record<string, ChannelStatus> } }
  | { type: 'UPDATE_METERS'; meterLevels: Record<string, number>; masterLeft: number; masterRight: number };

function mixerReducer(state: MixerState, action: MixerAction): MixerState {
  switch (action.type) {
    case 'SET_CHANNEL_PARAM': {
      const { trackId, key, value } = action;
      return {
        ...state,
        channels: {
          ...state.channels,
          [trackId]: { ...state.channels[trackId], [key]: value },
        },
      };
    }
    case 'TOGGLE_MUTE': {
      const trackId = action.trackId;
      const current = state.status[trackId];
      return {
        ...state,
        status: {
          ...state.status,
          [trackId]: { ...current, muted: !current.muted },
        },
      };
    }
    case 'TOGGLE_SOLO': {
      const trackId = action.trackId;
      const current = state.status[trackId];
      return {
        ...state,
        status: {
          ...state.status,
          [trackId]: { ...current, soloed: !current.soloed },
        },
      };
    }
    case 'SET_MASTER_VOLUME':
      return { ...state, master: { ...state.master, volume: action.value } };
    case 'SYNC_ENGINE_VALUES':
      return {
        ...state,
        channels: { ...state.channels, ...action.values.channels },
        status: { ...state.status, ...action.values.status },
      };
    case 'UPDATE_METERS':
      return {
        ...state,
        meterLevels: action.meterLevels,
        master: {
          ...state.master,
          leftLevel: action.masterLeft,
          rightLevel: action.masterRight,
        },
      };
    default:
      return state;
  }
}

// ── UI Components (Knob, VerticalFader, LedMeter, ChannelStrip) ──
const LedMeter = memo(({ level, variant = 'channel', heightClassName = 'h-36' }: { level: number; variant?: 'channel' | 'master'; heightClassName?: string }) => {
  const activeLevel = clamp(Math.round(level), 0, 10);
  return (
    <div className={`w-1.5 ${heightClassName} flex flex-col-reverse gap-0.5 rounded-full border border-white/5 bg-black/60 p-[1px] shadow-inner`} aria-label={`Level meter: ${activeLevel} of 10`}>
      {Array.from({ length: 10 }, (_, index) => {
        const active = activeLevel > index;
        const isClip = index >= 8;
        const isHot = index >= 6;
        let color = variant === 'master' ? 'bg-orange-950/20' : 'bg-emerald-950/20';
        if (active) {
          if (isClip) color = 'bg-red-500 shadow-[0_0_4px_rgba(239,68,68,0.8)]';
          else if (isHot) color = 'bg-amber-400 shadow-[0_0_4px_rgba(251,191,36,0.8)]';
          else if (variant === 'master') color = 'bg-orange-500 shadow-[0_0_4px_rgba(249,115,22,0.8)]';
          else color = 'bg-emerald-500 shadow-[0_0_4px_rgba(16,185,129,0.8)]';
        } else if (isClip) color = 'bg-red-950/40';
        else if (isHot) color = 'bg-amber-950/20';
        return <span key={index} className={`flex-1 rounded-sm transition-colors duration-75 ${color}`} />;
      })}
    </div>
  );
});

const Knob = memo(({ label, value, min, max, step, colorClassName, onChange, formatValue = (v) => `${v}` }: {
  label: string; value: number; min: number; max: number; step: number; colorClassName: string;
  onChange: (v: number) => void; formatValue?: (v: number) => string;
}) => {
  const normalized = (value - min) / (max - min);
  const rotation = normalized * 270 - 135;
  return (
    <label className="flex flex-col items-center">
      <span className="mb-0.5 text-[7px] font-bold uppercase tracking-widest text-slate-500">{label}</span>
      <span className="relative flex h-6 w-6 items-center justify-center rounded-full border border-black bg-zinc-800">
        <span className={`absolute top-0.5 h-2 w-0.5 rounded-full ${colorClassName}`}
              style={{ transform: `rotate(${rotation}deg)`, transformOrigin: '50% 100%' }} />
        <input type="range" min={min} max={max} step={step} value={value}
               onChange={(e) => onChange(Number(e.target.value))}
               aria-label={`${label}: ${formatValue(value)}`} title={`${label}: ${formatValue(value)}`}
               className="absolute inset-0 cursor-pointer opacity-0" />
      </span>
    </label>
  );
});

const VerticalFader = memo(({ value, max = 1.2, onChange, color = 'orange', label }: {
  value: number; max?: number; onChange: (v: number) => void; color?: 'orange' | 'master'; label: string;
}) => {
  const percentage = clamp((value / max) * 100, 0, 100);
  const knobClass = color === 'master'
    ? 'border-red-800 bg-gradient-to-b from-orange-400 to-red-600'
    : 'border-slate-600 bg-gradient-to-b from-slate-200 to-slate-400';
  return (
    <div className="relative flex min-h-[160px] items-stretch justify-center">
      <div className="relative flex w-3 justify-center overflow-hidden rounded-full border border-white/5 bg-black/80 shadow-inner">
        <div className="absolute bottom-0 w-full bg-gradient-to-t from-orange-600 to-amber-400 opacity-20" style={{ height: `${percentage}%` }} />
        <div className="h-full w-px bg-white/5" />
      </div>
      <input type="range" min="0" max={max} step="0.01" value={value}
             onChange={(e) => onChange(Number(e.target.value))} aria-label={label}
             className="absolute top-1/2 z-20 w-[160px] -translate-y-1/2 -rotate-90 cursor-pointer opacity-0" />
      <div className={`pointer-events-none absolute z-10 flex h-9 w-6 flex-col items-center justify-center rounded-md border shadow-2xl ${knobClass}`}
           style={{ bottom: `calc(${percentage}% - 18px)`, left: 'calc(50% + 2px)' }}>
        <span className="mb-1 h-[2px] w-3.5 rounded-full bg-red-600 shadow-sm" />
        <span className="mb-[2px] h-px w-3.5 bg-black/30" />
        <span className="mb-[2px] h-px w-3.5 bg-black/30" />
        <span className="h-px w-3.5 bg-black/30" />
      </div>
    </div>
  );
});

interface ChannelStripProps {
  key?: string;
  trackId: string;
  isEngineTrack: boolean;
  params: ChannelParams;
  status: ChannelStatus;
  level: number;
  onParamChange: (id: string, key: keyof ChannelParams, v: number) => void;
  onToggleMute: (id: string) => void;
  onToggleSolo: (id: string) => void;
}

const ChannelStrip = memo(({
  trackId,
  isEngineTrack,
  params,
  status: { muted, soloed },
  level,
  onParamChange,
  onToggleMute,
  onToggleSolo,
}: ChannelStripProps) => {
  const colorClasses = TRACK_COLORS[trackId] || '';
  const stripClass = soloed
    ? 'border-yellow-500/30 bg-[#1e1a14]'
    : muted ? 'border-red-500/25 opacity-60' : `border-white/5 hover:border-white/10 ${colorClasses} bg-gradient-to-b`;
  const panText = params.pan > 0 ? `R${Math.round(params.pan * 10)}` : params.pan < 0 ? `L${Math.round(Math.abs(params.pan) * 10)}` : 'C';
  return (
    <article className={`relative flex w-24 shrink-0 flex-col justify-between rounded-2xl border bg-gradient-to-b from-[#18181a] to-[#0a0a0c] p-2 shadow-2xl transition-all ${stripClass}`}>
      <div>
        <div className="mb-3 overflow-hidden rounded-md border border-white/5 bg-black/60 py-1 text-center shadow-inner">
          <span className="block truncate px-1 text-[9px] font-extrabold uppercase tracking-widest text-slate-300">{trackId}</span>
        </div>
        {!isEngineTrack && <p className="mb-2 rounded border border-amber-500/20 bg-amber-500/5 px-1 py-1 text-center font-mono text-[7px] uppercase text-amber-400">Visual submix</p>}
        <div className="mb-3 flex flex-col items-center gap-2.5 rounded-xl border border-white/5 bg-black/20 py-2.5">
          <Knob label="Trim" value={params.trim} min={-10} max={10} step={1} colorClassName="bg-slate-300" formatValue={(v) => `${v} dB`} onChange={(v) => onParamChange(trackId, 'trim', v)} />
          <Knob label="Hi EQ" value={params.eqHigh} min={-12} max={12} step={1} colorClassName="bg-cyan-400 shadow-[0_0_2px_#22d3ee]" formatValue={(v) => `${v} dB`} onChange={(v) => onParamChange(trackId, 'eqHigh', v)} />
          <Knob label="Lo EQ" value={params.eqLow} min={-12} max={12} step={1} colorClassName="bg-orange-400 shadow-[0_0_2px_#f97316]" formatValue={(v) => `${v} dB`} onChange={(v) => onParamChange(trackId, 'eqLow', v)} />
          <Knob label="Snd A" value={params.auxSend} min={0} max={100} step={5} colorClassName="bg-purple-400 shadow-[0_0_2px_#c084fc]" formatValue={(v) => `${v}%`} onChange={(v) => onParamChange(trackId, 'auxSend', v)} />
        </div>
        <div className="mb-3.5 flex w-full gap-1.5">
          <button type="button" onClick={() => onToggleMute(trackId)} aria-label={`Mute ${trackId}`} aria-pressed={muted}
            className={`flex-1 rounded border py-1 text-center font-mono text-[9px] font-extrabold shadow transition-all ${
              muted ? 'animate-pulse border-red-500 bg-red-600 text-white shadow-[0_0_8px_rgba(239,68,68,0.5)]' : 'border-white/5 bg-black text-slate-500 hover:bg-red-500/10 hover:text-red-400'
            }`}>M</button>
          <button type="button" onClick={() => onToggleSolo(trackId)} aria-label={`Solo ${trackId}`} aria-pressed={soloed}
            className={`flex-1 rounded border py-1 text-center font-mono text-[9px] font-extrabold shadow transition-all ${
              soloed ? 'border-yellow-400 bg-yellow-500 text-black shadow-[0_0_8px_rgba(245,158,11,0.5)]' : 'border-white/5 bg-black text-slate-500 hover:bg-yellow-500/10 hover:text-yellow-400'
            }`}>S</button>
        </div>
        <label className="mb-4 flex flex-col items-center">
          <span className="mb-1 text-[7px] font-extrabold uppercase tracking-widest text-slate-500">Pan</span>
          <span className="relative flex h-8 w-8 items-center justify-center rounded-full border border-black bg-gradient-to-b from-zinc-700 to-zinc-900 shadow-md">
            <span className="absolute top-0.5 h-3 w-0.5 rounded-full bg-red-400 shadow-[0_0_3px_rgba(248,113,113,0.8)]"
                  style={{ transform: `rotate(${params.pan * 60}deg)`, transformOrigin: '50% 100%' }} />
            <input type="range" min="-1" max="1" step="0.05" value={params.pan}
                   onChange={(e) => onParamChange(trackId, 'pan', Number(e.target.value))}
                   aria-label={`Pan ${trackId}: ${panText}`}
                   className="absolute inset-0 h-full w-full cursor-pointer opacity-0" />
          </span>
          <span className="mt-1 font-mono text-[8px] uppercase text-slate-400">{panText}</span>
        </label>
        <div className="relative my-3 flex min-h-[160px] items-stretch justify-center gap-2.5">
          <LedMeter level={level} />
          <VerticalFader value={params.volume} label={`${trackId} volume`} onChange={(v) => onParamChange(trackId, 'volume', v)} />
        </div>
        <div className="mt-1 rounded border border-white/5 bg-black/45 py-1 text-center shadow-inner">
          <span className="block font-mono text-[8px] font-bold text-orange-400">{linearToDb(params.volume)} dB</span>
        </div>
      </div>
      <div className="mt-2 rotate-[-1deg] overflow-hidden rounded border border-slate-300 bg-slate-50 py-1.5 text-center shadow">
        <span className="block px-1 font-mono text-[9.5px] font-extrabold uppercase tracking-wider text-slate-800">{trackId}</span>
      </div>
    </article>
  );
});

// ── Main MixerView ───────────────────────────────
export function MixerView() {
  const [activeTab, setActiveTab] = useState<MixerTab>('main');
  const [showTimeline, setShowTimeline] = useState(false);
  const [state, dispatch] = useReducer(mixerReducer, undefined, buildInitialMixerState);
  const stateRef = useRef(state);
  const { isPlaying } = useTransport();
  
  // Keep ref in sync with latest committed state (safe for concurrent mode)
  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  // Sync engine track initial values (only on mount)
  useEffect(() => {
    // Also ensure drum submix tracks are in the engine
    DRUM_SUBMIX_TRACKS.forEach(id => audioEngine.addTrack(id));

    const channels: Record<string, ChannelParams> = {};
    const status: Record<string, ChannelStatus> = {};
    const allTracks = [...MAIN_TRACKS, ...DRUM_SUBMIX_TRACKS];

    allTracks.forEach((trackId) => {
      const track = getTrack(trackId);
      if (!track) return;
      
      const currentParams = stateRef.current.channels[trackId];

      channels[trackId] = {
        ...currentParams,
        volume: track.volume,
        pan: track.pan,
      };
      status[trackId] = {
        muted: track.isMuted,
        soloed: track.isSolo,
      };

      // Apply initial EQ/Trim to engine if they were set in state
      track.setTrim(currentParams.trim);
      track.setEQ(currentParams.eqHigh, currentParams.eqLow);
    });
    dispatch({ type: 'SYNC_ENGINE_VALUES', values: { channels, status } });
  }, []);

  // Real-time metering using AnalyserNodes
  useEffect(() => {
    const interval = window.setInterval(() => {
      if (!isPlaying) {
        dispatch({ type: 'UPDATE_METERS', meterLevels: {}, masterLeft: 0, masterRight: 0 });
        return;
      }

      const visibleTracks = activeTab === 'main' ? MAIN_TRACKS : DRUM_SUBMIX_TRACKS;
      const meterLevels: Record<string, number> = {};

      const getRms = (analyser: any) => {
        if (!analyser) return 0;
        const data = analyser.getValue();
        if (!data || !data.length) return 0;
        let sumSq = 0;
        for (let i = 0; i < data.length; i++) {
          sumSq += data[i] * data[i];
        }
        const rms = Math.sqrt(sumSq / data.length);
        // Convert to 0-10 scale (0dBFS = 1.0 = 10)
        return Math.min(10, rms * 10);
      };

      // Individual channel meters
      visibleTracks.forEach((trackId) => {
        const track = getTrack(trackId);
        if (!track) {
          meterLevels[trackId] = 0;
          return;
        }
        meterLevels[trackId] = getRms(track.analyser);
      });

      // Master meter with stereo separation from waveform analyser
      let masterLeft = 0;
      let masterRight = 0;
      if (audioEngine.rmsAnalyser) {
        const waveform = audioEngine.rmsAnalyser.getValue() as Float32Array;
        if (waveform && waveform.length > 0) {
          const halfLen = Math.floor(waveform.length / 2);
          let leftSq = 0, rightSq = 0;
          for (let i = 0; i < halfLen; i++) {
            leftSq += waveform[i * 2] * waveform[i * 2];
            rightSq += waveform[i * 2 + 1] * waveform[i * 2 + 1];
          }
          masterLeft = Math.min(10, Math.sqrt(leftSq / halfLen) * 10);
          masterRight = Math.min(10, Math.sqrt(rightSq / halfLen) * 10);
        }
      }

      dispatch({ type: 'UPDATE_METERS', meterLevels, masterLeft, masterRight });
    }, 80);
    return () => clearInterval(interval);
  }, [activeTab, isPlaying]);

  // Param change handler
  const handleParamChange = useCallback(
    (trackId: string, key: keyof ChannelParams, value: number) => {
      const [min, max] = PARAM_LIMITS[key];
      const clamped = clamp(value, min, max);
      dispatch({ type: 'SET_CHANNEL_PARAM', trackId, key, value: clamped });

      const track = getTrack(trackId);
      if (!track) return;
      switch (key) {
        case 'volume':
          track.setVolume(clamped);
          break;
        case 'pan':
          track.setPan(clamped);
          break;
        case 'trim':
          track.setTrim(clamped);
          break;
        case 'eqHigh':
          track.setEQ(clamped, stateRef.current.channels[trackId].eqLow);
          break;
        case 'eqLow':
          track.setEQ(stateRef.current.channels[trackId].eqHigh, clamped);
          break;
        case 'auxSend':
          track.setReverbSend(clamped / 100);
          break;
      }
    },
    []
  );

  const handleToggleMute = useCallback((trackId: string) => {
    const currentlyMuted = stateRef.current.status[trackId]?.muted ?? false;
    const nextMuted = !currentlyMuted;
    dispatch({ type: 'TOGGLE_MUTE', trackId });
    getTrack(trackId)?.setMute(nextMuted);
  }, []);

  const handleToggleSolo = useCallback((trackId: string) => {
    const currentlySoloed = stateRef.current.status[trackId]?.soloed ?? false;
    const nextSoloed = !currentlySoloed;
    dispatch({ type: 'TOGGLE_SOLO', trackId });
    getTrack(trackId)?.setSolo(nextSoloed);
  }, []);

  const handleMasterVolume = useCallback((value: number) => {
    const v = clamp(value, 0, 1.2);
    dispatch({ type: 'SET_MASTER_VOLUME', value: v });
    audioEngine?.setMasterVolume(v);
  }, []);

  const currentTracks = useMemo(() => {
    switch (activeTab) {
      case 'main': return [...MAIN_TRACKS];
      case 'drums': return [...DRUM_SUBMIX_TRACKS];
      case 'synth': return [...SYNTH_SUBTRACKS];
      case 'sampler': return [...SAMPLER_TRACKS];
      default: return [...MAIN_TRACKS];
    }
  }, [activeTab]);

  const isEngineTrack = useCallback((id: string) => !!getTrack(id), []);

  return (
    <div className="relative flex h-full flex-col overflow-hidden rounded-[40px] border-2 border-white/5 bg-[#111] p-6 shadow-[0_30px_60px_rgba(0,0,0,0.8)]">
      <div className="pointer-events-none absolute inset-0 bg-texture-dark opacity-30 mix-blend-overlay" />
      <header className="relative z-10 mb-6 flex shrink-0 flex-col items-start justify-between gap-4 border-b border-white/5 pb-4 sm:flex-row sm:items-end">
        <div>
          <h2 className="flex items-center gap-3 text-3xl font-serif italic text-white">
            <Sliders className="text-orange-400" />
            Console Mixer
          </h2>
          <div className="mt-3 flex gap-2">
              {(['main', 'drums', 'synth', 'sampler'] as MixerTab[]).map((tab) => (
                <button
                  key={tab}
                  type="button"
                  onClick={() => setActiveTab(tab)}
                  aria-pressed={activeTab === tab}
                  className={`flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-[9px] font-bold uppercase tracking-widest transition-all ${
                    activeTab === tab
                      ? 'border-orange-500/35 bg-orange-500/20 font-extrabold text-orange-400 shadow-[0_0_10px_rgba(249,115,22,0.1)]'
                      : 'border-transparent bg-transparent text-slate-500 hover:text-slate-300'
                  }`}
                >
                  {tab === 'drums' && <Disc size={11} className={activeTab === 'drums' ? 'animate-spin' : ''} />}
                  {tab === 'main' ? 'Main' : tab === 'drums' ? 'Drums' : tab === 'synth' ? 'Synth' : 'Sampler'}
                </button>
              ))}
          </div>
        </div>
          <div className="flex items-center gap-4 rounded-2xl border border-white/5 bg-black/40 px-4 py-2 shadow-inner">
            <div className="flex items-center gap-1.5 text-[9px] text-emerald-500">
              <Activity className="animate-pulse" size={14} />
              <span className="font-mono font-bold uppercase tracking-wider">Audio Engine: Ready</span>
            </div>
            <div className="h-4 w-px bg-white/10" />
            <span className="font-mono text-[9px] uppercase text-slate-400 opacity-50">
              {activeTab === 'main' ? 'Track controls active' : 'Submix controls'}
            </span>
            <div className="h-4 w-px bg-white/10" />
            <button
              onClick={() => setShowTimeline(!showTimeline)}
              className={`flex items-center gap-1.5 font-mono text-[9px] uppercase tracking-wider font-bold transition-all ${
                showTimeline ? 'text-orange-400' : 'text-slate-500 hover:text-white'
              }`}
            >
              <Waves size={12} /> Waveform
            </button>
          </div>
        </header>

        {showTimeline && (
          <div className="mb-6 shrink-0">
            <WaveformTimeline trackNames={activeTab === 'main' ? MAIN_TRACKS : [...DRUM_SUBMIX_TRACKS]} />
          </div>
        )}
      <div className="relative z-10 flex flex-1 gap-2.5 overflow-x-auto pb-4 custom-scrollbar">
        {currentTracks.map((trackId) => (
          <ChannelStrip
            key={trackId}
            trackId={trackId}
            isEngineTrack={isEngineTrack(trackId)}
            params={state.channels[trackId]}
            status={state.status[trackId]}
            level={state.meterLevels[trackId] ?? 0}
            onParamChange={handleParamChange}
            onToggleMute={handleToggleMute}
            onToggleSolo={handleToggleSolo}
          />
        ))}
        {/* Master strip */}
        <aside className="relative flex w-24 shrink-0 flex-col justify-between rounded-2xl border-2 border-orange-500/20 bg-gradient-to-b from-[#251008] to-[#0d0502] p-2.5 shadow-[0_0_40px_rgba(249,115,22,0.15)]">
          <div className="mb-2 rounded-md border border-orange-500/25 bg-black/80 py-1 text-center shadow-inner">
            <span className="block text-[9px] font-extrabold uppercase tracking-widest text-orange-400">Master</span>
          </div>
          <div className="mb-2 flex flex-col items-center justify-center rounded-lg border border-white/5 bg-black/40 px-2 py-1.5">
            <div className="flex h-10 items-end gap-1">
              <LedMeter level={state.master.leftLevel} variant="master" heightClassName="h-8" />
              <LedMeter level={state.master.rightLevel} variant="master" heightClassName="h-8" />
            </div>
          </div>
          <div className="relative my-2 flex min-h-[160px] w-full justify-center">
            <VerticalFader value={state.master.volume} color="master" label="Master volume" onChange={handleMasterVolume} />
          </div>
          <div className="mt-2 shrink-0 rounded border border-orange-500/10 bg-black/45 py-1 text-center shadow-inner">
            <span className="font-mono text-[8px] font-extrabold text-orange-400">{linearToDb(state.master.volume)} dB</span>
          </div>
        </aside>
      </div>
    </div>
  );
}