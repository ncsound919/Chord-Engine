import React, { useCallback, useMemo, useState } from 'react';
import {
  BookOpen,
  GitCompare,
  Layers,
  Sliders,
  Sparkles,
  User,
} from 'lucide-react';
import { WriterId, WRITER_PROFILES } from '../../theory/songFraming';

interface OntologyBlenderViewProps {
  writerWeights: Record<WriterId, number>;
  setWriterWeights: (weights: Record<WriterId, number> | ((prev: Record<WriterId, number>) => Record<WriterId, number>)) => void;
  handleCompileSong: () => void;
  handleGenerate: () => void;
  musicKey: string;
}

type WriterBio = {
  era: string;
  style: string;
  secret: string;
  description: string;
  signatureChords: string[];
};

type BlendPreset = {
  name: string;
  desc: string;
  weights: Record<WriterId, number>;
};

const WRITER_IDS: WriterId[] = [
  'bacharach',
  'sylvers',
  'mayfield',
  'sly_stone',
  'steely_dan',
];

const EMPTY_WEIGHTS: Record<WriterId, number> = {
  bacharach: 0,
  sylvers: 0,
  mayfield: 0,
  sly_stone: 0,
  steely_dan: 0,
};

const EQUAL_WEIGHTS: Record<WriterId, number> = {
  bacharach: 20,
  sylvers: 20,
  mayfield: 20,
  sly_stone: 20,
  steely_dan: 20,
};

const WRITER_LABELS: Record<WriterId, string> = {
  bacharach: 'Burt Bacharach',
  sylvers: 'Leon Sylvers III',
  mayfield: 'Curtis Mayfield',
  sly_stone: 'Sly Stone',
  steely_dan: 'Steely Dan',
};

const WRITER_BIOS: Record<WriterId, WriterBio> = {
  bacharach: {
    era: 'Late 1960s Pop Jazz',
    style: 'Cinematic Orchestral Pop',
    secret: 'Unexpected meter changes and colorful major-seventh harmony.',
    description:
      'Sophisticated pop language built from chromatic bass movement, sudden modulations, rich orchestration, and memorable but unpredictable melodic contours.',
    signatureChords: ['Fmaj7', 'G/F', 'Am9', 'Dbmaj7#11'],
  },
  sylvers: {
    era: 'Late 1970s / Early 1980s Boogie',
    style: 'Solar Disco & Slick R&B',
    secret: 'Syncopated keyboard stabs and driving sixteenth-note octave bass.',
    description:
      'A polished R&B and boogie profile focused on tight bass movement, rhythmic chord attacks, parallel major colors, and compressed dance-floor grooves.',
    signatureChords: ['Dm9', 'G13', 'Cmaj9', 'F#m7b5'],
  },
  mayfield: {
    era: 'Early 1970s Orchestral Soul',
    style: 'Socially Conscious Silky Soul',
    secret: 'Open-voiced parallel chords with harp-like guitar rhythm.',
    description:
      'An orchestral soul profile featuring expressive minor-seventh movement, shimmering guitar parts, falsetto-friendly harmony, and warm, hopeful motion.',
    signatureChords: ['Ebm7', 'Abm7', 'Db9', 'Bbm7'],
  },
  sly_stone: {
    era: 'Late 1960s Psych Funk',
    style: 'Psychedelic Funk Rock',
    secret: 'One-chord dynamic jams, syncopated bass, and brass call-and-response.',
    description:
      'A raw funk profile combining psychedelic rock, communal vocals, aggressive rhythmic repetition, fuzz textures, and punchy horn answers.',
    signatureChords: ['Eb7#9', 'Ab9', 'Db7', 'B7'],
  },
  steely_dan: {
    era: 'Mid 1970s Yacht Jazz Rock',
    style: 'Studio-Perfect Jazz Rock',
    secret: 'Mu-major colors: major add2 voicings with tight inner-note tension.',
    description:
      'A jazz-rock profile emphasizing precise studio polish, sophisticated voicings, suspended dominant colors, and detailed harmonic voice-leading.',
    signatureChords: ['C(add2)', 'F/G', 'Bb(add2)', 'G13sus4'],
  },
};

const BLEND_PRESETS: BlendPreset[] = [
  {
    name: 'Silky 70s Soul Symphony',
    desc: 'Curtis Mayfield and Sly Stone in a deep soul blend.',
    weights: {
      bacharach: 10,
      sylvers: 0,
      mayfield: 50,
      sly_stone: 40,
      steely_dan: 0,
    },
  },
  {
    name: 'Yacht Rock Perfection',
    desc: 'Steely Dan-led studio precision and rich harmony.',
    weights: {
      bacharach: 15,
      sylvers: 0,
      mayfield: 10,
      sly_stone: 0,
      steely_dan: 75,
    },
  },
  {
    name: 'Solar System Boogie',
    desc: 'Leon Sylvers-inspired disco and boogie energy.',
    weights: {
      bacharach: 0,
      sylvers: 80,
      mayfield: 10,
      sly_stone: 10,
      steely_dan: 0,
    },
  },
  {
    name: 'Cosmic Cinematic Jazz',
    desc: 'Bacharach-style movement with Steely Dan polish.',
    weights: {
      bacharach: 70,
      sylvers: 0,
      mayfield: 10,
      sly_stone: 0,
      steely_dan: 20,
    },
  },
];

function clampWeight(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.min(100, Math.max(0, Math.round(value)));
}

interface RadarChartProps {
  writerWeights: Record<WriterId, number>;
}

const RadarChart = React.memo(function RadarChart({
  writerWeights,
}: RadarChartProps) {
  const { points, webPolygons } = useMemo(() => {
    const center = 100;
    const radius = 70;

    const getPoint = (index: number, ratio: number) => {
      const angle = (index * 2 * Math.PI) / WRITER_IDS.length - Math.PI / 2;

      return {
        x: center + radius * ratio * Math.cos(angle),
        y: center + radius * ratio * Math.sin(angle),
      };
    };

    const points = WRITER_IDS.map((id, index) => {
      const weight = clampWeight(writerWeights[id] ?? 0);

      return {
        id,
        ...getPoint(index, weight / 100),
      };
    });

    const webPolygons = [0.25, 0.5, 0.75, 1].map((ratio) =>
      WRITER_IDS.map((_, index) => {
        const point = getPoint(index, ratio);
        return `${point.x},${point.y}`;
      }).join(' ')
    );

    return { points, webPolygons };
  }, [writerWeights]);

  const blendPolygon = points.map((point) => `${point.x},${point.y}`).join(' ');

  return (
    <svg
      width="200"
      height="200"
      viewBox="0 0 200 200"
      role="img"
      aria-label="Radar chart showing songwriter influence weights"
      className="mx-auto select-none drop-shadow-2xl"
    >
      {webPolygons.map((polygon, index) => (
        <polygon
          key={index}
          points={polygon}
          fill="none"
          stroke="rgba(255,255,255,0.06)"
          strokeWidth="1"
        />
      ))}

      {WRITER_IDS.map((id, index) => {
        const angle = (index * 2 * Math.PI) / WRITER_IDS.length - Math.PI / 2;
        const endX = 100 + 70 * Math.cos(angle);
        const endY = 100 + 70 * Math.sin(angle);

        return (
          <line
            key={id}
            x1="100"
            y1="100"
            x2={endX}
            y2={endY}
            stroke="rgba(255,255,255,0.08)"
            strokeWidth="1"
          />
        );
      })}

      <polygon
        points={blendPolygon}
        fill="rgba(249,115,22,0.15)"
        stroke="rgba(249,115,22,0.8)"
        strokeWidth="2"
        className="transition-all duration-300"
      />

      {points.map((point) => (
        <circle
          key={point.id}
          cx={point.x}
          cy={point.y}
          r="4"
          className="fill-orange-400 stroke-black stroke-2 transition-all duration-300"
        />
      ))}
    </svg>
  );
});

export function OntologyBlenderView({
  writerWeights,
  setWriterWeights,
  handleCompileSong,
  handleGenerate,
  musicKey,
}: OntologyBlenderViewProps) {
  const [selectedBio, setSelectedBio] = useState<WriterId>('bacharach');
  const [isCompiling, setIsCompiling] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [compileSuccess, setCompileSuccess] = useState(false);
  const [generateSuccess, setGenerateSuccess] = useState(false);

  const onCompileClick = async () => {
    setIsCompiling(true);
    setCompileSuccess(false);
    await new Promise((resolve) => setTimeout(resolve, 1200));
    try {
      handleCompileSong();
      setCompileSuccess(true);
      setTimeout(() => setCompileSuccess(false), 2000);
    } catch (e) {
      console.error(e);
    } finally {
      setIsCompiling(false);
    }
  };

  const onGenerateClick = async () => {
    setIsGenerating(true);
    setGenerateSuccess(false);
    await new Promise((resolve) => setTimeout(resolve, 1500));
    try {
      handleGenerate();
      setGenerateSuccess(true);
      setTimeout(() => setGenerateSuccess(false), 2000);
    } catch (e) {
      console.error(e);
    } finally {
      setIsGenerating(false);
    }
  };

  const totalWeight = useMemo(
    () =>
      WRITER_IDS.reduce(
        (total, id) => total + clampWeight(writerWeights[id] ?? 0),
        0
      ),
    [writerWeights]
  );

  const selectedBioData = WRITER_BIOS[selectedBio];

  const applyPreset = useCallback(
    (weights: Record<WriterId, number>) => {
      setWriterWeights({ ...weights });
    },
    [setWriterWeights]
  );

  const updateWeight = useCallback(
    (id: WriterId, value: number) => {
      setWriterWeights((previous) => ({
        ...previous,
        [id]: clampWeight(value),
      }));
    },
    [setWriterWeights]
  );

  const soloWriter = useCallback(
    (id: WriterId) => {
      setWriterWeights({
        ...EMPTY_WEIGHTS,
        [id]: 100,
      });
      setSelectedBio(id);
    },
    [setWriterWeights]
  );

  const setEqualDistribution = useCallback(() => {
    setWriterWeights({ ...EQUAL_WEIGHTS });
  }, [setWriterWeights]);

  return (
    <div className="relative flex min-h-full flex-col overflow-hidden rounded-[40px] border-2 border-white/5 bg-[#111] p-8 shadow-[0_30px_60px_rgba(0,0,0,0.8)]">
      <div className="pointer-events-none absolute inset-0 bg-texture-dark opacity-30 mix-blend-overlay" />

      <header className="relative z-10 mb-8 flex flex-col items-start justify-between gap-4 border-b border-white/5 pb-4 md:flex-row md:items-end">
        <div>
          <h2 className="flex items-center gap-3 text-3xl font-serif italic text-white">
            <GitCompare className="text-orange-400" size={28} />
            Ontology Blender
          </h2>

          <p className="mt-1 text-[10px] font-bold uppercase tracking-widest text-orange-400 opacity-40">
            Songwriter Influence Profile Synthesizer
          </p>
        </div>

        <button
          type="button"
          onClick={setEqualDistribution}
          className="rounded-lg border border-white/10 px-3.5 py-1.5 font-mono text-[9px] font-bold uppercase text-slate-400 transition-all hover:bg-white/5 hover:text-white"
        >
          Distribute Equal
        </button>
      </header>

      <div className="relative z-10 grid flex-1 grid-cols-1 items-start gap-8 lg:grid-cols-12">
        <section className="space-y-6 rounded-[30px] border border-white/5 bg-gradient-to-br from-[#161618] to-[#0d0d0f] p-6 shadow-2xl lg:col-span-7">
          <div className="flex items-center justify-between">
            <h3 className="flex items-center gap-2 text-sm font-bold uppercase tracking-widest text-slate-300">
              <Sliders className="text-orange-400" size={16} />
              Influence Controls
            </h3>

            <span
              className={`rounded border px-2 py-1 font-mono text-[9px] uppercase ${
                totalWeight === 100
                  ? 'border-emerald-500/20 bg-emerald-500/10 text-emerald-400'
                  : 'border-amber-500/20 bg-amber-500/10 text-amber-400'
              }`}
            >
              Total: {totalWeight}%
            </span>
          </div>

          <p className="text-[10px] leading-relaxed text-slate-500">
            The weights do not have to equal 100%, but 100% gives the clearest
            and most predictable profile blend.
          </p>

          <div className="space-y-4">
            {WRITER_IDS.map((id) => {
              const weight = clampWeight(writerWeights[id] ?? 0);
              const isSelected = selectedBio === id;

              return (
                <article
                  key={id}
                  className={`rounded-2xl border p-4 transition-all ${
                    isSelected
                      ? 'border-orange-500/20 bg-orange-500/5 shadow-lg'
                      : 'border-white/5 bg-black/30 hover:border-white/10'
                  }`}
                >
                  <div className="mb-2 flex items-center justify-between gap-3">
                    <button
                      type="button"
                      onClick={() => setSelectedBio(id)}
                      className="flex min-w-0 items-center gap-2 text-left text-xs font-bold uppercase tracking-wider text-white transition-colors hover:text-orange-400"
                      aria-pressed={isSelected}
                    >
                      <User
                        size={12}
                        className={
                          isSelected ? 'shrink-0 text-orange-400' : 'shrink-0 text-slate-500'
                        }
                      />
                      <span className="truncate">{WRITER_LABELS[id]}</span>
                    </button>

                    <div className="flex shrink-0 items-center gap-2">
                      <output className="rounded border border-orange-500/20 bg-orange-500/10 px-2 py-0.5 font-mono text-xs font-bold text-orange-400">
                        {weight}%
                      </output>

                      <button
                        type="button"
                        onClick={() => soloWriter(id)}
                        className="rounded border border-white/5 bg-white/5 px-2 py-0.5 font-mono text-[8px] uppercase text-slate-400 transition-colors hover:bg-white/10 hover:text-white"
                        aria-label={`Set ${WRITER_LABELS[id]} to 100 percent`}
                      >
                        Solo
                      </button>
                    </div>
                  </div>

                  <div className="flex items-center gap-4">
                    <input
                      id={`writer-weight-${id}`}
                      type="range"
                      min="0"
                      max="100"
                      step="1"
                      value={weight}
                      onChange={(event) =>
                        updateWeight(id, Number(event.target.value))
                      }
                      aria-label={`${WRITER_LABELS[id]} influence`}
                      className="h-2 flex-1 cursor-pointer appearance-none rounded-full border border-white/5 bg-black/60 accent-orange-500 shadow-inner [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-orange-500"
                    />

                    <button
                      type="button"
                      onClick={() => setSelectedBio(id)}
                      className="flex items-center gap-1 rounded bg-white/5 px-2 py-1 font-mono text-[9px] uppercase text-slate-400 transition-colors hover:bg-white/10 hover:text-white"
                      aria-label={`Show ${WRITER_LABELS[id]} profile`}
                    >
                      <BookOpen size={10} />
                      Bio
                    </button>
                  </div>
                </article>
              );
            })}
          </div>

          <div className="space-y-3 border-t border-white/5 pt-4">
            <span className="block text-[10px] font-bold uppercase tracking-widest text-slate-500">
              Signature Blend Presets
            </span>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {BLEND_PRESETS.map((preset) => (
                <button
                  key={preset.name}
                  type="button"
                  onClick={() => applyPreset(preset.weights)}
                  className="rounded-xl border border-white/5 bg-black/40 p-3 text-left transition-all hover:bg-white/5 hover:border-orange-500/20"
                >
                  <span className="block text-xs font-bold text-orange-300">
                    {preset.name}
                  </span>
                  <span className="mt-0.5 block text-[9px] leading-tight text-slate-500">
                    {preset.desc}
                  </span>
                </button>
              ))}
            </div>
          </div>
        </section>

        <aside className="space-y-8 lg:col-span-5">
          <section className="flex flex-col items-center justify-center rounded-[30px] border border-white/5 bg-gradient-to-br from-[#161618] to-[#0d0d0f] p-6 text-center shadow-2xl">
            <span className="mb-4 text-[10px] font-bold uppercase tracking-widest text-slate-400">
              Ontology Geometry Map
            </span>

            <RadarChart writerWeights={writerWeights} />

            <div className="mt-4 max-w-xs">
              <span className="block text-xs font-serif italic text-white">
                Visual Balance Radar
              </span>

              <p className="mt-1 text-[9px] leading-relaxed text-slate-500">
                The radar displays the current balance of harmonic, rhythmic,
                arrangement, and production influences.
              </p>
            </div>
          </section>

          <section className="space-y-4 rounded-[30px] border border-white/5 bg-gradient-to-br from-[#161618] to-[#0d0d0f] p-6 shadow-2xl">
            <div className="flex items-center gap-3 border-b border-white/5 pb-3">
              <div className="rounded-xl border border-purple-500/30 bg-purple-500/10 p-2 text-purple-400">
                <User size={16} />
              </div>

              <div>
                <h4 className="text-sm font-bold uppercase tracking-wider text-white">
                  {WRITER_LABELS[selectedBio]}
                </h4>
                <span className="block font-mono text-[9px] text-slate-500">
                  {selectedBioData.era}
                </span>
              </div>
            </div>

            <div className="space-y-3 text-xs leading-relaxed">
              <BioField label="Signature Style">
                {selectedBioData.style}
              </BioField>

              <BioField label="Songwriting Profile">
                <em>{selectedBioData.secret}</em>
              </BioField>

              <BioField label="Profile Fingerprint">
                {selectedBioData.description}
              </BioField>

              <div>
                <span className="block text-[8px] font-bold uppercase tracking-widest text-purple-400">
                  Aesthetic Voicing Targets
                </span>

                <div className="mt-1.5 flex flex-wrap gap-2">
                  {selectedBioData.signatureChords.map((chord) => (
                    <span
                      key={chord}
                      className="rounded border border-white/5 bg-black px-2 py-0.5 font-mono text-[9px] text-orange-400"
                    >
                      {chord}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </section>

          <section className="space-y-4 rounded-[30px] border-2 border-purple-500/20 bg-gradient-to-br from-[#1a1324] to-[#0a070e] p-6 text-center shadow-2xl">
            <h4 className="flex items-center justify-center gap-2 text-sm font-bold uppercase tracking-wider text-purple-300">
              <Sparkles size={16} />
              Outline Compiler
            </h4>

            <p className="mx-auto max-w-sm text-[10px] leading-normal text-slate-400">
              Compile the active profile blend into section definitions, then
              generate a fresh chord progression in {musicKey}.
            </p>

            <div className="flex flex-col gap-2 pt-2">
              <button
                type="button"
                disabled={isCompiling || isGenerating}
                onClick={onCompileClick}
                className={`flex w-full items-center justify-center gap-1.5 rounded-xl border py-2.5 text-[10px] font-bold uppercase tracking-widest transition-all ${
                  compileSuccess
                    ? 'border-emerald-500 bg-emerald-500 text-white shadow-[0_0_15px_rgba(16,185,129,0.4)] font-black'
                    : isCompiling
                    ? 'border-purple-400/40 bg-purple-600 text-white animate-pulse'
                    : 'border-purple-400/40 bg-gradient-to-b from-purple-500 to-indigo-600 text-white shadow-[0_0_15px_rgba(168,85,247,0.3)] hover:from-purple-400 hover:to-indigo-500'
                }`}
              >
                {isCompiling ? (
                  <>
                    <svg className="animate-spin -ml-1 mr-2 h-3.5 w-3.5 text-white" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                    Compiling Structure...
                  </>
                ) : compileSuccess ? (
                  'Structure Compiled! ✓'
                ) : (
                  <>
                    <GitCompare size={12} />
                    Compile Song Structure
                  </>
                )}
              </button>

              <button
                type="button"
                disabled={isCompiling || isGenerating}
                onClick={onGenerateClick}
                className={`flex w-full items-center justify-center gap-1.5 rounded-xl py-2.5 text-[10px] font-bold uppercase tracking-widest transition-all ${
                  generateSuccess
                    ? 'bg-emerald-500 text-white shadow-[0_0_15px_rgba(16,185,129,0.4)] font-black'
                    : isGenerating
                    ? 'bg-orange-500 text-black animate-pulse'
                    : 'bg-white text-black hover:bg-orange-400 hover:shadow-[0_0_15px_rgba(251,146,60,0.3)]'
                }`}
              >
                {isGenerating ? (
                  <>
                    <svg className="animate-spin -ml-1 mr-2 h-3.5 w-3.5 text-black" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                    Generating Score...
                  </>
                ) : generateSuccess ? (
                  'Score Generated! ✓'
                ) : (
                  <>
                    <Layers size={12} />
                    Generate Full Score — {musicKey}
                  </>
                )}
              </button>
            </div>
          </section>
        </aside>
      </div>
    </div>
  );
}

interface BioFieldProps {
  label: string;
  children: React.ReactNode;
}

function BioField({ label, children }: BioFieldProps) {
  return (
    <div>
      <span className="block text-[8px] font-bold uppercase tracking-widest text-purple-400">
        {label}
      </span>
      <div className="mt-0.5 font-sans text-slate-300">{children}</div>
    </div>
  );
}
