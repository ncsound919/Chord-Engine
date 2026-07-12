import React, {
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react';
import {
  ArrowLeft,
  ArrowRight,
  Edit2,
  Plus,
  RefreshCw,
  Trash2,
  Zap,
  Music,
  Grid3X3,
  Download,
} from 'lucide-react';
import { GeneratedSection } from '../lib/engine';
import { NotationView } from './NotationView';
import { generateMIDI, downloadMIDI } from '../lib/midiExport';

type ActiveChord = {
  secIdx: number;
  chordIdx: number;
};

export type SubstitutionCommand =
  | 'parallel'
  | 'extend'
  | 'tritone'
  | 'ii_v'
  | 'tritone_sd'
  | 'backdoor'
  | 'auto'
  | 'move_left'
  | 'move_right'
  | 'delete_chord'
  | 'add_blank_section'
  | `add_chord:${string}`
  | `replace_chord:${string}`;

interface LeadSheetProps {
  sections: GeneratedSection[];
  musicKey: string;
  onSubstitute?: (secIdx: number, chordIdx: number, command: SubstitutionCommand) => void;
}

const REPLACEMENT_CHORDS = [
  'Imaj7',
  'Imaj9',
  'Imaj13',
  'Iadd9',
  'Isus4',
  'I',
  'bII7',
  'ii7',
  'ii9',
  'ii11',
  'ii7b5',
  'ii',
  'III7',
  'III7b9',
  'iii',
  'IVmaj7',
  'IVmaj9',
  'IVmaj13',
  'IV',
  'V7',
  'V9sus4',
  'V13',
  'V7b9',
  'V',
  'bVImaj7',
  'bVI7',
  'vi7',
  'vi11',
  'vi',
  'bVIImaj7',
  'bVII13',
] as const;

const ACTION_BUTTON_CLASS =
  'rounded-lg border border-white/5 bg-black/50 py-2 text-[10px] font-mono font-bold text-slate-300 transition-colors hover:border-orange-500/30 hover:bg-orange-500/20 hover:text-white';

export function LeadSheet({
  sections,
  musicKey,
  onSubstitute,
}: LeadSheetProps) {
  const [activeChord, setActiveChord] = useState<ActiveChord | null>(null);
  const [showNotation, setShowNotation] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const closePopover = useCallback(() => {
    setActiveChord(null);
  }, []);

  const sendCommand = useCallback(
    (secIdx: number, chordIdx: number, command: SubstitutionCommand) => {
      onSubstitute?.(secIdx, chordIdx, command);
      closePopover();
    },
    [closePopover, onSubstitute]
  );

  // Focus management
  useEffect(() => {
    if (activeChord) {
      // Small timeout to ensure DOM is ready
      const timer = setTimeout(() => {
        const firstButton = containerRef.current?.querySelector('[data-popover-first]') as HTMLElement;
        firstButton?.focus();
      }, 10);
      return () => clearTimeout(timer);
    }
  }, [activeChord]);

  useEffect(() => {
    const onPointerDown = (event: PointerEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        closePopover();
      }
    };

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') closePopover();

      // Focus trapping logic
      if (activeChord && event.key === 'Tab') {
        const popover = containerRef.current?.querySelector('[role="menu"]');
        if (!popover) return;

        const focusables = popover.querySelectorAll(
          'button:not([disabled]), [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        );
        const first = focusables[0] as HTMLElement;
        const last = focusables[focusables.length - 1] as HTMLElement;

        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first.focus();
        }
      }
    };

    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);

    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [closePopover]);

  if (sections.length === 0) {
    return (
      <div className="flex h-64 flex-col items-center justify-center rounded-3xl border border-dashed border-white/20 bg-white/5 font-mono text-sm text-slate-400 backdrop-blur-sm">
        <p>No progression generated yet.</p>
        <p className="mb-4 mt-2 text-xs">
          Configure sections and generate, or start with a blank section.
        </p>

        <button
          type="button"
          onClick={() => onSubstitute?.(-1, -1, 'add_blank_section')}
          className="rounded-full bg-white/10 px-6 py-2 text-xs font-bold uppercase tracking-widest text-white transition-colors hover:bg-white/20"
        >
          + Blank Section
        </button>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className="relative flex h-full flex-col overflow-visible rounded-[40px] border border-white/10 bg-black/40 p-8 text-slate-100 shadow-[0_0_50px_rgba(0,0,0,0.5)] backdrop-blur-xl"
    >
      <div className="pointer-events-none absolute inset-0 rounded-[40px] bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')] opacity-20 mix-blend-overlay" />

      <header className="relative z-10 mb-8 flex shrink-0 items-end justify-between border-b border-white/10 pb-6">
        <div>
          <h2 className="flex items-center gap-3 text-3xl font-serif italic text-white">
            <Zap className="text-orange-400" size={24} />
            MIDI Arranger
          </h2>

          <p className="mt-1 text-[10px] font-bold uppercase tracking-widest opacity-40">
            Chord Progression & Substitutions
          </p>
        </div>

          <div className="flex items-center gap-3">
          <button
            onClick={() => {
              if (sections.length > 0) {
                const midi = generateMIDI(sections, 120, musicKey);
                downloadMIDI(midi, `chord-engine-${Date.now()}.mid`);
              }
            }}
            disabled={sections.length === 0}
            className="flex items-center gap-1.5 rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-[10px] font-bold uppercase tracking-widest text-slate-400 hover:text-white transition-all disabled:opacity-30"
            title="Export MIDI"
          >
            <Download size={14} /> MIDI
          </button>

          <button
            onClick={() => setShowNotation(!showNotation)}
            className={`flex items-center gap-1.5 rounded-xl border px-3 py-2 text-[10px] font-bold uppercase tracking-widest transition-all ${
              showNotation
                ? 'border-orange-500/40 bg-orange-500/10 text-orange-400'
                : 'border-white/10 bg-black/40 text-slate-400 hover:text-white'
            }`}
            title={showNotation ? 'Show chord grid' : 'Show notation'}
          >
            {showNotation ? <Grid3X3 size={14} /> : <Music size={14} />}
            {showNotation ? 'Grid' : 'Notation'}
          </button>

          <div className="rounded-xl border border-white/10 bg-black/40 px-4 py-2 text-xs shadow-inner">
            <span className="mr-2 text-[10px] uppercase opacity-50">
              Global Key
            </span>
            <span className="text-lg font-bold text-orange-400">{musicKey}</span>
          </div>
        </div>
      </header>

      <div className="relative z-10 flex-1 space-y-12 overflow-y-auto pr-2 custom-scrollbar">
        {showNotation && (
          <div className="mb-8">
            <NotationView sections={sections} musicKey={musicKey} />
          </div>
        )}

        {sections.filter(s => !!s && !!s.def).map((section, secIdx) => (
          <section key={section.def.id} className="space-y-6">
            <div className="flex items-center gap-4">
              <h3 className="rounded-xl border border-orange-500/20 bg-orange-500/10 px-4 py-2 text-xs font-bold uppercase tracking-widest text-orange-400 shadow-inner">
                {section.def.name}
              </h3>

              <div className="h-px flex-1 bg-white/10" />

              <span className="rounded-md border border-white/5 bg-black/20 px-3 py-1 font-mono text-[10px] uppercase text-slate-400">
                Preset: {section.def.preset}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-x-2 gap-y-4 sm:grid-cols-4 lg:grid-cols-8">
              {section.chords.map((chord, chordIdx) => {
                const isActive =
                  activeChord?.secIdx === secIdx &&
                  activeChord?.chordIdx === chordIdx;

                const isFirstChord = chordIdx === 0;
                const isLastChord = chordIdx === section.chords.length - 1;
                const chordKey = `${section.def.id}-bar-${chord.bar}-${chord.beat}`;

                return (
                  <div key={chordKey} className="group relative">
                    <button
                      type="button"
                      onClick={() =>
                        setActiveChord(
                          isActive ? null : { secIdx, chordIdx }
                        )
                      }
                      aria-expanded={isActive}
                      aria-haspopup="dialog"
                      aria-label={`Edit bar ${chord.bar}: ${chord.chordName}`}
                      className={`relative z-10 flex w-full flex-col items-center justify-center gap-1 overflow-visible rounded-xl border p-4 text-left transition-all ${
                        isActive
                          ? 'border-orange-500 bg-orange-500/10 shadow-[0_0_20px_rgba(249,115,22,0.2)]'
                          : 'border-white/10 bg-black/40 shadow-inner hover:border-white/30 hover:bg-white/5'
                      }`}
                    >
                      {isActive && (
                        <span className="pointer-events-none absolute inset-0 rounded-xl bg-gradient-to-t from-orange-500/20 to-transparent opacity-50" />
                      )}

                      <span className="relative z-10 flex w-full items-center justify-between opacity-40 transition-opacity group-hover:opacity-100">
                        <span className="font-mono text-[9px] font-bold">
                          B{chord.bar}
                        </span>
                        <Edit2
                          size={10}
                          className={isActive ? 'text-orange-400' : ''}
                        />
                      </span>

                      <span className="relative z-10 my-2 text-center">
                        <span
                          className={`block font-mono text-xl font-bold transition-colors ${
                            isActive ? 'text-orange-400' : 'text-slate-200'
                          }`}
                        >
                          {chord.chordName}
                        </span>

                        <span className="mt-1 block text-[9px] uppercase tracking-widest opacity-50">
                          {chord.roman}
                        </span>
                      </span>
                    </button>

                    {isActive && (
                      <div
                        role="menu"
                        aria-label={`Edit ${chord.chordName}`}
                        className={`absolute top-full z-50 mt-3.5 flex w-56 flex-col rounded-2xl border-2 border-orange-500/30 bg-[#0c0d15] p-4 shadow-[0_25px_60px_rgba(0,0,0,0.95)] backdrop-blur-2xl ${
                          chordIdx >= section.chords.length - 2
                            ? 'right-0'
                            : 'left-1/2 -translate-x-1/2'
                        }`}
                      >
                        <div
                          className={`absolute bottom-full h-0 w-0 border-b-[7px] border-l-[7px] border-r-[7px] border-b-orange-500/30 border-l-transparent border-r-transparent ${
                            chordIdx >= section.chords.length - 2
                              ? 'right-5'
                              : 'left-1/2 -translate-x-1/2'
                          }`}
                        />

                        <div className="mb-2 flex items-center justify-between border-b border-white/5 px-1 pb-1 text-[9px] font-black uppercase tracking-widest text-orange-400">
                          <span>Substitutions</span>
                          <span className="font-mono text-[8px] font-normal opacity-50">
                            MIDI
                          </span>
                        </div>

                        <div className="mb-2.5 grid grid-cols-3 gap-1">
                          <button
                            type="button"
                            data-popover-first
                            role="menuitem"
                            onClick={() =>
                              sendCommand(secIdx, chordIdx, 'parallel')
                            }
                            className={ACTION_BUTTON_CLASS}
                            title="Modal Interchange"
                          >
                            Parallel
                          </button>

                          <button
                            type="button"
                            role="menuitem"
                            onClick={() =>
                              sendCommand(secIdx, chordIdx, 'extend')
                            }
                            className={ACTION_BUTTON_CLASS}
                            title="Jazz Extensions"
                          >
                            Extend
                          </button>

                          <button
                            type="button"
                            role="menuitem"
                            onClick={() =>
                              sendCommand(secIdx, chordIdx, 'tritone')
                            }
                            className={ACTION_BUTTON_CLASS}
                            title="Tritone Substitution"
                          >
                            Tritone
                          </button>

                          <button
                            type="button"
                            role="menuitem"
                            onClick={() =>
                              sendCommand(secIdx, chordIdx, 'ii_v')
                            }
                            className={ACTION_BUTTON_CLASS}
                            title="Interpolate ii-V Progression"
                          >
                            ii-V Exp
                          </button>

                          <button
                            type="button"
                            role="menuitem"
                            onClick={() =>
                              sendCommand(secIdx, chordIdx, 'tritone_sd')
                            }
                            className={ACTION_BUTTON_CLASS}
                            title="Tritone Sub of Secondary Dominant"
                          >
                            Trt Dom
                          </button>

                          <button
                            type="button"
                            role="menuitem"
                            onClick={() =>
                              sendCommand(secIdx, chordIdx, 'backdoor')
                            }
                            className={ACTION_BUTTON_CLASS}
                            title="Backdoor Dominant substitution"
                          >
                            Backdoor
                          </button>
                        </div>

                        <div className="mb-2.5">
                          <button
                            type="button"
                            role="menuitem"
                            onClick={() =>
                              sendCommand(secIdx, chordIdx, 'auto')
                            }
                            className={`${ACTION_BUTTON_CLASS} w-full flex items-center justify-center gap-1.5`}
                          >
                            <RefreshCw size={10} />
                            Auto-Substitute
                          </button>
                        </div>

                        <div className="mb-2 mt-1.5 border-b border-white/5 px-1 pb-1 text-[9px] font-black uppercase tracking-widest text-orange-400">
                          Replace Chord
                        </div>

                        <div 
                          className="grid max-h-40 grid-cols-2 gap-1 overflow-y-auto rounded-xl border border-white/5 bg-black/20 p-1.5 pr-1 custom-scrollbar"
                          role="listbox"
                          aria-label="Replacement chords"
                        >
                          {REPLACEMENT_CHORDS.map((roman) => {
                            const isCurrent = roman === chord.roman;

                            return (
                              <button
                                key={roman}
                                type="button"
                                role="option"
                                aria-selected={isCurrent}
                                disabled={isCurrent}
                                onClick={() =>
                                  sendCommand(
                                    secIdx,
                                    chordIdx,
                                    `replace_chord:${roman}`
                                  )
                                }
                                className={`w-full rounded-md border border-white/5 bg-black/30 py-1.5 text-center font-mono text-[10px] transition-colors ${
                                  isCurrent
                                    ? 'cursor-not-allowed opacity-30'
                                    : 'text-slate-400 hover:border-orange-500/30 hover:bg-orange-500/30 hover:text-white'
                                }`}
                              >
                                {roman}
                              </button>
                            );
                          })}
                        </div>

                        <div className="mt-3 flex justify-between gap-2 border-t border-white/10 pt-3">
                          <button
                            type="button"
                            role="menuitem"
                            disabled={isFirstChord}
                            onClick={() =>
                              sendCommand(secIdx, chordIdx, 'move_left')
                            }
                            aria-label="Move chord left"
                            title="Move Left"
                            className={`flex flex-1 justify-center rounded-lg border border-white/5 py-1.5 transition-colors ${
                              isFirstChord
                                ? 'cursor-not-allowed text-slate-700'
                                : 'text-slate-400 hover:bg-white/10 hover:text-white'
                            }`}
                          >
                            <ArrowLeft size={13} />
                          </button>

                          <button
                            type="button"
                            role="menuitem"
                            onClick={() =>
                              sendCommand(secIdx, chordIdx, 'delete_chord')
                            }
                            aria-label="Delete chord"
                            title="Delete Chord"
                            className="flex flex-1 justify-center rounded-lg border border-white/5 py-1.5 text-red-400 transition-colors hover:bg-red-500/10 hover:text-red-300"
                          >
                            <Trash2 size={13} />
                          </button>

                          <button
                            type="button"
                            role="menuitem"
                            disabled={isLastChord}
                            onClick={() =>
                              sendCommand(secIdx, chordIdx, 'move_right')
                            }
                            aria-label="Move chord right"
                            title="Move Right"
                            className={`flex flex-1 justify-center rounded-lg border border-white/5 py-1.5 transition-colors ${
                              isLastChord
                                ? 'cursor-not-allowed text-slate-700'
                                : 'text-slate-400 hover:bg-white/10 hover:text-white'
                            }`}
                          >
                            <ArrowRight size={13} />
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}

              <div className="group relative flex items-center justify-center">
                <button
                  type="button"
                  onClick={() =>
                    sendCommand(
                      secIdx,
                      section.chords.length,
                      'add_chord:Imaj7'
                    )
                  }
                  aria-label={`Add chord to ${section.def.name}`}
                  title="Add chord"
                  className="flex h-12 w-12 items-center justify-center rounded-full border border-dashed border-white/20 text-white/30 transition-all hover:border-orange-400 hover:bg-orange-400/10 hover:text-orange-400"
                >
                  <Plus size={20} />
                </button>
              </div>
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
