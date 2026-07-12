import React, { useRef, useEffect, useState } from 'react';
import { Zap, Activity } from 'lucide-react';

interface WaveformTimelineProps {
  trackNames: string[];
  onReady?: () => void;
}

export function WaveformTimeline({ trackNames, onReady }: WaveformTimelineProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [isReady, setIsReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;
    let destroyed = false;
    let playlist: any = null;

    const initPlaylist = async () => {
      try {
        const mod = await import('@waveform-playlist/browser');
        if (destroyed) return;
        const init = (mod as any).createPlaylist || mod.init;
        const el = containerRef.current;
        if (!el) return;
        playlist = init({
          container: el,
          samplesPerPixel: 4096,
          mono: true,
          fadeType: 'logarithmic',
          exclSolo: false,
          timescale: true,
          waveHeight: 80,
          isAutomaticScroll: true,
          mode: 'shift',
          controls: { show: true, width: 150 },
          zoomLevels: [512, 1024, 2048, 4096],
          colors: { waveOutlineColor: '#f97316', timeColor: 'grey', fadeColor: 'black' },
        });
        if (destroyed) return;
        setIsReady(true);
        onReady?.();
      } catch (err: any) {
        if (destroyed) return;
        console.warn('WaveformPlaylist init failed:', err);
        setError(err.message || 'Failed to load waveform timeline');
      }
    };

    initPlaylist();

    return () => {
      destroyed = true;
      if (playlist && typeof playlist.destroy === 'function') {
        playlist.destroy();
      }
    };
  }, []);

  if (error) {
    return (
      <div className="rounded-2xl border border-amber-500/20 bg-amber-500/5 p-6 text-center font-mono text-xs text-amber-400">
        Waveform timeline unavailable: {error}
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-white/10 bg-black/30 overflow-hidden">
      <div className="flex items-center justify-between border-b border-white/5 px-4 py-2">
        <div className="flex items-center gap-2 text-[10px] font-mono text-slate-400">
          <Activity size={14} className="text-orange-400" />
          Multi-Track Waveform
        </div>
        {isReady && (
          <span className="flex items-center gap-1 text-[9px] text-emerald-500">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
            Engine ready
          </span>
        )}
      </div>
      <div ref={containerRef} className="min-h-[200px] w-full" />
    </div>
  );
}
