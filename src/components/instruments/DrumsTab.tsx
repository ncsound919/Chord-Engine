import React, { memo } from 'react';
import { Drum, Circle } from 'lucide-react';
import { DrumPad } from './UIPrimitives';

interface DrumsTabProps {
  loadedDrums: Record<string, boolean>;
  loadingDrum: string | null;
  justLoadedDrum: string | null;
  onUploadClick: (drum: string) => void;
  drumKit: Record<string, string>;
}

const DRUM_PAD_CONFIGS = [
  { id: 'Crash', label: 'Crash 18"', className: "absolute top-[10%] left-[15%] w-16 h-16 rounded-full border-yellow-600/30", icon: <Circle size={24} strokeWidth={1} className="opacity-50" /> },
  { id: 'Ride', label: 'Ride 22"', className: "absolute top-[15%] right-[15%] w-14 h-14 rounded-full border-yellow-600/30", icon: <Circle size={48} strokeWidth={1} className="opacity-50" /> },
  { id: 'Hi-Hat Open', label: "HH Open", className: "absolute top-[35%] left-[5%] w-14 h-14 rounded-full border-yellow-600/30" },
  { id: 'Hi-Hat Closed', label: "HH Closed", className: "absolute top-[50%] left-[8%] w-14 h-14 rounded-full border-yellow-600/30" },
  { id: 'Tom 1', label: 'Rack 10"', className: "absolute top-[25%] left-[30%] w-14 h-14 rounded-full bg-slate-800/50" },
  { id: 'Tom 2', label: 'Rack 12"', className: "absolute top-[25%] right-[30%] w-16 h-16 rounded-full bg-slate-800/50" },
  { id: 'Tom 3', label: 'Floor 16"', className: "absolute top-[50%] right-[10%] w-14 h-14 rounded-full bg-slate-800/50" },
  { id: 'Snare', label: 'Snare 14"', className: "absolute top-[45%] left-[25%] w-20 h-20 rounded-full bg-gradient-to-br from-slate-200 to-slate-400 border-4 border-white/20" },
  { id: 'Kick', label: 'Kick 22"', className: "absolute bottom-[10%] left-1/2 -translate-x-1/2 w-24 h-24 rounded-full bg-gradient-to-br from-black to-slate-900 border-8 border-orange-900 shadow-[0_10px_20px_rgba(0,0,0,0.8)]" },
];

export const DrumsTab = memo(({
  loadedDrums,
  loadingDrum,
  justLoadedDrum,
  onUploadClick,
  drumKit
}: DrumsTabProps) => {
  return (
    <div className="space-y-6 flex flex-col h-full animate-in fade-in duration-500">
      <div aria-live="polite" className="sr-only">
        {loadingDrum && `Loading sample for ${loadingDrum}...`}
        {justLoadedDrum && `Sample for ${justLoadedDrum} loaded successfully.`}
      </div>

      <div>
        <h3 className="text-sm font-bold text-slate-300 uppercase tracking-widest flex items-center gap-2">
          <Drum size={16} className="text-orange-400" />
          Acoustic Kit Loader
        </h3>
        <p className="text-xs text-slate-500 mb-2 italic">Upload one-shots to build your studio kit.</p>
      </div>
      
      <div className="flex-1 relative bg-gradient-to-b from-[#1a1a1a] to-[#050505] border-2 border-white/5 rounded-[30px] p-4 overflow-hidden flex items-center justify-center min-h-[300px] shadow-[inset_0_10px_30px_rgba(0,0,0,1)]">
        {/* Studio Floor Grid */}
        <div className="absolute inset-0 opacity-10" style={{ backgroundImage: 'linear-gradient(#333 1px, transparent 1px), linear-gradient(90deg, #333 1px, transparent 1px)', backgroundSize: '40px 40px' }} aria-hidden="true"></div>
        <div className="absolute inset-0 bg-gradient-to-t from-black via-transparent to-transparent opacity-80" aria-hidden="true"></div>
        
        <div className="relative w-full max-w-2xl aspect-video mx-auto">
          {DRUM_PAD_CONFIGS.map(({ id, label, className, icon }) => (
            <DrumPad 
              key={id}
              drum={id} 
              label={label} 
              loaded={loadedDrums[id]} 
              assignedName={drumKit[id]}
              loading={loadingDrum === id} 
              justLoaded={justLoadedDrum === id} 
              onClick={() => onUploadClick(id)} 
              className={className} 
              icon={icon} 
            />
          ))}
        </div>
      </div>
    </div>
  );
});

DrumsTab.displayName = 'DrumsTab';
