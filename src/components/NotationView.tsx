import React, { useRef, useEffect, useState } from 'react';
import { Factory } from 'vexflow';
import { GeneratedSection } from '../lib/engine';

interface NotationViewProps {
  sections: GeneratedSection[];
  musicKey: string;
}

export function NotationView({ sections, musicKey }: NotationViewProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!containerRef.current || sections.length === 0) return;
    setError(null);
    containerRef.current.innerHTML = '';

    const width = Math.max(800, containerRef.current.clientWidth);
    const height = sections.length * 160 + 40;
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    containerRef.current.appendChild(canvas);

    try {
      const renderer = new (Factory as any)({
        renderer: { element: canvas, width, height },
      });
      const score = renderer.EasyScore();
      if (!score) throw new Error('VexFlow EasyScore unavailable');
      const system = renderer.System({ width: width - 80, x: 40, y: 20 });

      for (const section of sections) {
        const notes = section.chords.slice(0, 8).map(c => {
          const root = c.chordName.replace(/[^A-G#b]/g, '');
          return `${root}/4`;
        });
        if (notes.length === 0) continue;

        system.addStave({
          voices: [score.voice(notes.map(n => score.note({ keys: [n], duration: 'q' })), { time: '4/4' })],
        });
      }

      system.addConnector('singleLeft');
      system.addConnector('singleRight');
      renderer.draw();
    } catch (err: any) {
      console.warn('VexFlow render failed:', err);
      setError(err.message || 'Render failed');
    }
  }, [sections, musicKey]);

  if (sections.length === 0) {
    return (
      <div className="flex h-48 items-center justify-center rounded-2xl border border-dashed border-white/10 bg-white/5 font-mono text-sm text-slate-500">
        No notation to render
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-white/10 bg-black/30 p-4 overflow-x-auto">
      <div className="flex items-center gap-2 mb-3 text-[10px] font-mono text-slate-500">
        <span>Key: {musicKey}</span>
        <span className="w-px h-3 bg-white/10" />
        <span>{sections.length} section{sections.length > 1 ? 's' : ''}</span>
      </div>
      {error && (
        <div className="rounded-lg border border-amber-500/20 bg-amber-500/5 p-3 text-[10px] text-amber-400 font-mono mb-2">
          Notation render: {error}
        </div>
      )}
      <div ref={containerRef} className="min-h-[100px]" />
    </div>
  );
}
