import React, { memo, useId } from 'react';
import { RefreshCw, Check } from 'lucide-react';
 
// ─── DrumPad ──────────────────────────────────────
interface DrumPadProps {
  drum: string;
  label: string;
  loaded: boolean;
  assignedName?: string;
  onClick: () => void;
  className?: string;
  icon?: React.ReactNode;
  loading?: boolean;
  justLoaded?: boolean;
}
 
export const DrumPad = memo(({
  drum,
  label,
  loaded,
  assignedName,
  onClick,
  className,
  icon,
  loading,
  justLoaded,
}: DrumPadProps) => {
  // Announce loading/success via live region
  const liveId = useId();
 
  return (
    <>
      <button
        type="button"
        aria-label={`${label} pad, ${loaded ? 'loaded' : 'empty'}${assignedName ? `, assigned to ${assignedName}` : ''}`}
        aria-disabled={loading}
        className={`${className} relative flex flex-col items-center justify-center border-2 backdrop-blur-md cursor-pointer transition-all shadow-[0_10px_20px_rgba(0,0,0,0.5)] hover:scale-105 active:scale-95 group overflow-hidden focus:outline-none focus:ring-2 focus:ring-orange-500 focus:ring-offset-2 focus:ring-offset-black ${
          loading
            ? 'border-blue-500 bg-blue-500/30 text-blue-100 shadow-[0_0_35px_rgba(59,130,246,0.8)] animate-pulse'
            : justLoaded
              ? 'border-emerald-500 bg-emerald-500/35 text-emerald-100 shadow-[0_0_40px_rgba(16,185,129,0.9)] scale-105 duration-300'
              : loaded
                ? 'border-orange-500 bg-orange-500/20 text-orange-100 shadow-[0_0_30px_rgba(249,115,22,0.6)] animate-[pulse_2s_ease-in-out_infinite]'
                : assignedName
                  ? 'border-orange-500/50 bg-black/40 text-orange-400/70 border-dashed'
                  : 'border-dashed border-white/20 hover:border-orange-500/50 hover:bg-orange-500/10 text-white/40'
        }`}
        onClick={loading ? undefined : onClick}
      >
        <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent opacity-50" aria-hidden="true" />
 
        {loading && (
          <div className="absolute inset-0 bg-black/60 flex items-center justify-center z-20" aria-hidden="true">
            <RefreshCw size={18} className="text-blue-400 animate-spin" />
          </div>
        )}
 
        {justLoaded && (
          <div className="absolute inset-0 bg-black/40 flex items-center justify-center z-20 animate-in zoom-in-95" aria-hidden="true">
            <Check size={20} className="text-emerald-400 font-bold" />
          </div>
        )}
 
        {icon && <div className="absolute inset-0 flex items-center justify-center z-0" aria-hidden="true">{icon}</div>}
 
        <div className="flex flex-col items-center z-10 bg-black/80 px-2 py-1 rounded border border-white/5 shadow-inner">
          <span className="text-[9px] font-bold uppercase tracking-widest text-center leading-tight">
            {label}
          </span>
          {assignedName && !loaded && (
            <span className="text-[7px] text-orange-500/50 mt-0.5 truncate max-w-[60px]">{assignedName}</span>
          )}
        </div>
        {!loaded && !loading && !justLoaded && (
          <span className="text-xs mt-2 opacity-50 z-10 group-hover:text-orange-400 transition-colors font-bold" aria-hidden="true">+</span>
        )}
      </button>
 
      {/* Live region for loading/success announcements */}
      <div aria-live="polite" className="sr-only" id={liveId}>
        {loading && `Loading sample for ${drum}`}
        {justLoaded && `Sample for ${drum} loaded successfully`}
      </div>
    </>
  );
});
DrumPad.displayName = 'DrumPad';
 
// ─── Shared range styles (using Tailwind with custom properties) ───
// These can be applied to any input[type="range"] to match the dark design.
const rangeInputClasses =
  'w-full h-1 bg-black rounded-lg appearance-none cursor-pointer accent-amber-500 focus:outline-none focus:ring-2 focus:ring-amber-500/50';
 
// ─── Vertical Slider (Juno style) ──────────────────────────────
// Uses a native range with CSS rotation to make it vertical.
// This is simpler, accessible, and touch‑friendly.
interface JunoVerticalSliderProps {
  label: string;
  value: number;
  min?: number;
  max?: number;
  step?: number;
  onChange: (val: number) => void;
  color?: string; // kept for styling but we use accent color
}
 
export const JunoVerticalSlider = memo(({
  label,
  value,
  min = 0,
  max = 100,
  step = 1,
  onChange,
}: JunoVerticalSliderProps) => {
  const percentage = ((value - min) / (max - min)) * 100;
 
  return (
    <div className="flex flex-col items-center select-none w-10 shrink-0">
      <span className="text-[8px] font-mono font-bold text-slate-400 uppercase tracking-widest mb-2 h-3">{label}</span>
      <div className="relative h-28 w-4 bg-black/60 rounded-sm border border-white/10 shadow-inner">
        {/* Background tick marks */}
        <div className="absolute inset-y-1 left-0 right-0 flex flex-col justify-between pointer-events-none opacity-20 px-[2px]">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="w-full h-[1px] bg-white" />
          ))}
        </div>
        {/* Range input – rotated 270° to make it vertical */}
        <input
          type="range"
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={(e) => onChange(Number(e.target.value))}
          aria-label={label}
          aria-valuetext={`${value}%`}
          className="absolute inset-0 w-[160px] -translate-y-[50%] -rotate-90 cursor-pointer opacity-0 focus:outline-none"
          style={{ transformOrigin: 'top left', left: '50%', top: '50%' }}
        />
        {/* Custom thumb indicator */}
        <div
          className="absolute w-6 h-3 rounded-sm bg-orange-500 left-1/2 -translate-x-1/2 border border-black shadow-[0_2px_5px_rgba(0,0,0,0.5)] flex items-center justify-center pointer-events-none"
          style={{ bottom: `calc(${percentage}% - 6px)` }}
        >
          <div className="w-[10px] h-[1px] bg-white/40" />
        </div>
      </div>
      <span className="text-[9px] font-mono text-orange-400 mt-2 font-bold h-3">{value}</span>
    </div>
  );
});
JunoVerticalSlider.displayName = 'JunoVerticalSlider';
 
// ─── Bass Knob (native range with circular styling) ──────────────
// We keep the visual knob but use a hidden range for input.
// This ensures touch support and full accessibility.
 
interface BassKnobProps {
  label: string;
  value: number;
  min?: number;
  max?: number;
  step?: number;
  onChange: (val: number) => void;
  suffix?: string;
}
 
export const BassKnob = memo(({
  label,
  value,
  min = 0,
  max = 100,
  step = 1,
  onChange,
  suffix = '',
}: BassKnobProps) => {
  const percent = (value - min) / (max - min);
  const angle = -135 + percent * 270;
 
  return (
    <div className="flex flex-col items-center select-none w-14 shrink-0">
      <span className="text-[8px] font-mono font-bold text-slate-400 uppercase tracking-widest text-center h-3.5 mb-1.5">{label}</span>
      <div className="relative w-10 h-10 rounded-full bg-gradient-to-b from-[#2a2a2e] to-[#121214] border-2 border-black/80 shadow-[inset_0_2px_5px_rgba(255,255,255,0.05),0_4px_8px_rgba(0,0,0,0.6)] flex items-center justify-center">
        <div className="absolute inset-[2px] rounded-full border border-zinc-800/50 pointer-events-none" />
        <div
          className="w-full h-full rounded-full transition-transform duration-75 relative"
          style={{ transform: `rotate(${angle}deg)` }}
        >
          <div className="absolute top-1 left-1/2 -translate-x-1/2 w-[2px] h-[7px] bg-amber-500 rounded-full shadow-[0_0_4px_#f59e0b]" />
        </div>
        {/* Hidden range input – covers the whole knob, handles all interactions */}
        <input
          type="range"
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={(e) => onChange(Number(e.target.value))}
          aria-label={label}
          aria-valuetext={`${value}${suffix}`}
          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer focus:outline-none focus:ring-2 focus:ring-amber-500/50 rounded-full"
          style={{ zIndex: 10 }}
        />
      </div>
      <span className="text-[9px] font-mono text-amber-500/80 font-bold mt-1.5 bg-black/60 px-1 py-0.5 rounded border border-white/5 shadow-inner">
        {value}{suffix}
      </span>
    </div>
  );
});
BassKnob.displayName = 'BassKnob';
 
// ─── Bass EQ Slider (vertical range, similar to Juno) ──────────
interface BassEQSliderProps {
  label: string;
  value: number;
  onChange: (val: number) => void;
}
 
export const BassEQSlider = memo(({
  label,
  value,
  onChange,
}: BassEQSliderProps) => {
  const percentage = ((value - (-12)) / 24) * 100;
 
  return (
    <div className="flex flex-col items-center select-none w-8 shrink-0">
      <span className="text-[8px] font-mono font-bold text-slate-400 uppercase tracking-widest mb-1.5 h-3">{label}</span>
      <div className="relative h-20 w-3 bg-zinc-950 rounded-sm border border-white/5 shadow-inner">
        <div className="absolute left-0 right-0 top-1/2 h-[1px] bg-red-500/20 pointer-events-none" />
        <input
          type="range"
          min="-12"
          max="12"
          step="1"
          value={value}
          onChange={(e) => onChange(Number(e.target.value))}
          aria-label={label}
          aria-valuetext={`${value} dB`}
          className="absolute inset-0 w-[120px] -translate-y-[50%] -rotate-90 cursor-pointer opacity-0 focus:outline-none"
          style={{ transformOrigin: 'top left', left: '50%', top: '50%' }}
        />
        <div
          className="absolute w-5 h-2 bg-gradient-to-r from-teal-500 to-teal-600 left-1/2 -translate-x-1/2 border border-black shadow-[0_1px_3px_rgba(0,0,0,0.5)] flex items-center justify-center rounded-sm pointer-events-none"
          style={{ bottom: `calc(${percentage}% - 4px)` }}
        >
          <div className="w-[10px] h-[1px] bg-white/50" />
        </div>
      </div>
      <span className={`text-[8px] font-mono mt-1.5 font-bold ${value > 0 ? 'text-teal-400' : value < 0 ? 'text-rose-400' : 'text-slate-500'}`}>
        {value > 0 ? `+${value}` : value}
      </span>
    </div>
  );
});
BassEQSlider.displayName = 'BassEQSlider';
 

// ─── ToggleButton ──────────────────────────────────────
// Generic two-state button used for boolean params (Ultra-Lo, Ultra-Hi,
// Mono Choke's switch variant, etc). Replaces the duplicated inline
// ternary className blocks that were repeated per-toggle in BassTab.
type ToggleAccent = 'cyan' | 'indigo' | 'amber' | 'orange' | 'emerald';

const TOGGLE_ACCENT_CLASSES: Record<ToggleAccent, { ring: string; active: string; dot: string }> = {
  cyan: {
    ring: 'focus:ring-cyan-500',
    active: 'bg-cyan-950/40 border-cyan-500/40 text-cyan-400 shadow-[0_0_10px_rgba(6,182,212,0.15)]',
    dot: 'bg-cyan-400',
  },
  indigo: {
    ring: 'focus:ring-indigo-500',
    active: 'bg-indigo-950/40 border-indigo-500/40 text-indigo-400 shadow-[0_0_10px_rgba(99,102,241,0.15)]',
    dot: 'bg-indigo-400',
  },
  amber: {
    ring: 'focus:ring-amber-500',
    active: 'bg-amber-950/40 border-amber-500/40 text-amber-400 shadow-[0_0_10px_rgba(245,158,11,0.15)]',
    dot: 'bg-amber-400',
  },
  orange: {
    ring: 'focus:ring-orange-500',
    active: 'bg-orange-950/40 border-orange-500/40 text-orange-400 shadow-[0_0_10px_rgba(249,115,22,0.15)]',
    dot: 'bg-orange-400',
  },
  emerald: {
    ring: 'focus:ring-emerald-500',
    active: 'bg-emerald-950/40 border-emerald-500/40 text-emerald-400 shadow-[0_0_10px_rgba(16,185,129,0.15)]',
    dot: 'bg-emerald-400',
  },
};

interface ToggleButtonProps {
  label: string;
  active: boolean;
  onToggle: () => void;
  accent?: ToggleAccent;
  className?: string;
}

export const ToggleButton = memo(({
  label,
  active,
  onToggle,
  accent = 'cyan',
  className = '',
}: ToggleButtonProps) => {
  const c = TOGGLE_ACCENT_CLASSES[accent];
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-pressed={active}
      className={`flex-1 px-3 py-1.5 rounded-lg border text-[8px] font-mono font-bold uppercase transition-all flex items-center justify-center gap-2 focus:outline-none focus:ring-2 ${c.ring} ${
        active ? c.active : 'bg-black/40 border-white/5 text-slate-500 hover:text-slate-400'
      } ${className}`}
    >
      <div className={`w-1.5 h-1.5 rounded-full ${active ? `${c.dot} animate-pulse` : 'bg-zinc-800'}`} />
      {label}
    </button>
  );
});
ToggleButton.displayName = 'ToggleButton';

// ─── ButtonGroup ────────────────────────────────────────
// Generic segmented-control used for enum params (Plucking Style,
// Cabinet Emulation). Replaces the two duplicated .map() button groups.
interface ButtonGroupOption<T extends string> {
  value: T;
  label: string;
}

interface ButtonGroupProps<T extends string> {
  options: ButtonGroupOption<T>[];
  value: T;
  onChange: (val: T) => void;
  accent?: 'amber' | 'blue';
  ariaLabel: string;
}

export function ButtonGroup<T extends string>({
  options,
  value,
  onChange,
  accent = 'amber',
  ariaLabel,
}: ButtonGroupProps<T>) {
  const activeClasses =
    accent === 'blue'
      ? 'bg-blue-500 text-black shadow-md font-extrabold'
      : 'bg-amber-500 text-black shadow-md';
  const ring = accent === 'blue' ? 'focus:ring-blue-500' : 'focus:ring-amber-500';

  return (
    <div
      role="radiogroup"
      aria-label={ariaLabel}
      className="flex bg-black/50 p-0.5 rounded-lg border border-white/5 gap-1"
    >
      {options.map((opt) => (
        <button
          key={opt.value}
          type="button"
          role="radio"
          aria-checked={value === opt.value}
          onClick={() => onChange(opt.value)}
          className={`flex-1 py-1 text-[9px] font-mono font-bold uppercase rounded-md transition-all focus:outline-none focus:ring-2 ${ring} ${
            value === opt.value ? activeClasses : 'text-slate-400 hover:text-white'
          }`}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}
