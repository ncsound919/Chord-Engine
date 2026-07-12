import React, { useState, useEffect } from 'react';
import { GeneratedSection } from '../lib/engine';
import { critiqueArrangement, CriticFinding, Severity } from '../theory/critic';
import { optimizeArrangement, OptimizationStep } from '../theory/fixer';
import { WriterId } from '../theory/songFraming';
import { applyStyleLens, crossStyleDivergenceReport, StyleAwareFinding, CrossStyleReportItem } from '../theory/styleAwareCritic';
import { 
  Zap, 
  ShieldAlert, 
  Music, 
  Hand, 
  Pause, 
  TrendingUp, 
  Star, 
  LayoutGrid, 
  CheckCircle,
  AlertTriangle,
  Info,
  Wrench,
  Sparkles,
  RefreshCw,
  GitCompare,
  Sliders,
  Check,
  ChevronDown
} from 'lucide-react';

interface ArrangementCriticPanelProps {
  sections: GeneratedSection[];
  musicKey: string;
  selectedWriter?: WriterId;
  onApplyFix?: (sectionIdx: number, bar: number, fixType: 'resubstitute' | 'revoice' | 'reposition' | 'thin_voicing' | 'add_motion') => void;
  onUpdateSections?: (sections: GeneratedSection[]) => void;
}

const CATEGORY_ICONS = {
  register_collision: <ShieldAlert size={16} />,
  voice_leading: <Music size={16} />,
  guitar_ergonomics: <Hand size={16} />,
  harmonic_stasis: <Pause size={16} />,
  arc: <TrendingUp size={16} />,
  style_fidelity: <Star size={16} />,
  voicing_density: <LayoutGrid size={16} />
};

const SEVERITY_STYLES: Record<Severity, { bg: string; text: string; border: string; icon: React.ReactNode }> = {
  problem: {
    bg: 'bg-red-500/10',
    text: 'text-red-400',
    border: 'border-red-500/20',
    icon: <AlertTriangle size={16} className="text-red-400" />
  },
  warning: {
    bg: 'bg-amber-500/10',
    text: 'text-amber-400',
    border: 'border-amber-500/20',
    icon: <AlertTriangle size={16} className="text-amber-400" />
  },
  suggestion: {
    bg: 'bg-teal-500/10',
    text: 'text-teal-400',
    border: 'border-teal-500/20',
    icon: <Wrench size={16} className="text-teal-400" />
  },
  info: {
    bg: 'bg-blue-500/10',
    text: 'text-blue-400',
    border: 'border-blue-500/20',
    icon: <Info size={16} className="text-blue-400" />
  }
};

export function ArrangementCriticPanel({ sections, musicKey, selectedWriter, onApplyFix, onUpdateSections }: ArrangementCriticPanelProps) {
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [traceLog, setTraceLog] = useState<OptimizationStep[]>([]);
  const [beforeAfterScore, setBeforeAfterScore] = useState<{ before: number; after: number } | null>(null);
  const [isOptimizing, setIsOptimizing] = useState(false);
  const [activeLens, setActiveLens] = useState<'generic' | WriterId>('generic');
  const [showDivergence, setShowDivergence] = useState(false);
  const [fixingId, setFixingId] = useState<string | null>(null);

  useEffect(() => {
    if (selectedWriter) {
      setActiveLens(selectedWriter);
    }
  }, [selectedWriter]);

  const handleApplyFixWithFeedback = async (findingId: string, sectionIdx: number, bar: number, fixType: any) => {
    setFixingId(findingId);
    // Simulate a brief mechanical/solving delay for real-time responsiveness
    setTimeout(() => {
      if (onApplyFix) {
        onApplyFix(sectionIdx, bar, fixType);
      }
      setFixingId(null);
    }, 450);
  };

  if (sections.length === 0) {
    return null;
  }

  const critique = critiqueArrangement(sections);
  const { findings, score, summary } = critique;

  // Compute style-aware critique if style lens is active
  let displayedFindings = findings;
  let displayedScore = score;
  let displayedSummary = summary;
  let contradictionsFoundCount = 0;

  if (activeLens !== 'generic') {
    const styleResult = applyStyleLens(critique, activeLens);
    displayedFindings = styleResult.findings;
    displayedScore = Math.min(100, Math.max(0, score + styleResult.scoreDelta));
    contradictionsFoundCount = styleResult.contradictionsFound;

    const writerLabels: Record<WriterId, string> = {
      bacharach: 'Burt Bacharach',
      sylvers: 'Leon Sylvers III',
      mayfield: 'Curtis Mayfield',
      sly_stone: 'Sly Stone',
      steely_dan: 'Steely Dan',
    };

    displayedSummary = `${writerLabels[activeLens]} Style Lens applied. Excused ${contradictionsFoundCount} generic rules as intentional stylistic signatures! Score re-weighted to ${displayedScore}/100.`;
  }

  const handleAutoOptimize = () => {
    setIsOptimizing(true);
    // Simulate a brief mechanical sweep for visual satisfyingness
    setTimeout(() => {
      const result = optimizeArrangement(sections, musicKey);
      setTraceLog(result.steps);
      setBeforeAfterScore({ before: result.scoreBefore, after: result.scoreAfter });
      setIsOptimizing(false);
      if (onUpdateSections && result.scoreAfter > result.scoreBefore) {
        onUpdateSections(result.sections);
      }
    }, 800);
  };

  const scoreColor = 
    displayedScore >= 90 ? 'text-emerald-400 border-emerald-500/30 bg-emerald-500/5' :
    displayedScore >= 70 ? 'text-amber-400 border-amber-500/30 bg-amber-500/5' :
    'text-red-400 border-red-500/30 bg-red-500/5';

  const categories = Array.from(new Set(displayedFindings.map(f => f.category)));

  const filteredFindings = activeCategory 
    ? displayedFindings.filter(f => f.category === activeCategory)
    : displayedFindings;

  const crossReport = crossStyleDivergenceReport(critique);

  const writerNames: Record<WriterId, string> = {
    bacharach: 'Burt Bacharach',
    sylvers: 'Leon Sylvers III',
    mayfield: 'Curtis Mayfield',
    sly_stone: 'Sly Stone',
    steely_dan: 'Steely Dan',
  };

  return (
    <div className="rounded-[40px] border border-white/10 bg-black/40 backdrop-blur-xl p-8 relative overflow-hidden h-full flex flex-col shadow-[0_30px_60px_rgba(0,0,0,0.4)]">
      <div className="absolute inset-0 bg-texture-light opacity-10 pointer-events-none mix-blend-overlay"></div>
      
      {/* Visual laser/scanning bar for active auto-optimization */}
      {isOptimizing && (
        <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-orange-500 via-yellow-400 to-amber-500 animate-pulse z-50 shadow-[0_2px_15px_rgba(249,115,22,0.6)]">
          <div className="w-full h-full bg-orange-400/50 animate-ping"></div>
        </div>
      )}
      
      {/* Panel Header */}
      <div className="relative z-10 flex flex-col md:flex-row justify-between items-start md:items-center border-b border-white/10 pb-6 mb-6 shrink-0 gap-4">
        <div>
          <h2 className="text-2xl font-serif italic text-white flex items-center gap-3">
            <Zap className="text-orange-400 animate-pulse" size={22} />
            Arrangement Critic
          </h2>
          <p className="text-[10px] tracking-widest font-bold opacity-40 uppercase mt-1">AI-Driven Post-Arrangement Audit</p>
        </div>
        
        {/* Quality Score Ring/Badge */}
        <div className={`flex items-center gap-3 px-4 py-2 rounded-2xl border ${scoreColor} shadow-inner self-stretch md:self-auto justify-between md:justify-start`}>
          <div className="text-right">
            <div className="text-[9px] uppercase tracking-wider opacity-60 font-mono">Score</div>
            <div className="text-[9px] uppercase tracking-wider opacity-40 font-mono">Rating</div>
          </div>
          <div className="text-3xl font-bold font-mono tracking-tighter">
            {displayedScore}<span className="text-xs opacity-50 font-normal">/100</span>
          </div>
        </div>
      </div>

      {/* Style Lens Controls & Cross-Style Toggle */}
      <div className="relative z-10 grid grid-cols-1 sm:grid-cols-2 gap-3 mb-6 shrink-0">
        <div className="bg-white/5 border border-white/5 rounded-2xl p-3 flex flex-col gap-1.5">
          <label className="text-[9px] font-mono uppercase tracking-widest text-slate-400 flex items-center gap-1">
            <Sliders size={10} /> Active Critique Lens
          </label>
          <div className="relative">
            <select
              value={activeLens}
              onChange={(e) => {
                setActiveLens(e.target.value as any);
                setShowDivergence(false); // Close divergence when changing lenses to focus on individual critique
              }}
              className="w-full bg-black/60 border border-white/10 text-xs rounded-xl px-3 py-2 text-white font-medium focus:outline-none focus:border-orange-500/50 appearance-none cursor-pointer"
            >
              <option value="generic">Standard Theory Rules (Strict)</option>
              {Object.entries(writerNames).map(([id, name]) => (
                <option key={id} value={id}>{name} Lens</option>
              ))}
            </select>
            <div className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-slate-400">
              <ChevronDown size={12} />
            </div>
          </div>
        </div>

        <button
          onClick={() => setShowDivergence(!showDivergence)}
          className={`rounded-2xl p-3 border transition-all flex flex-col justify-center items-start gap-1 ${
            showDivergence
              ? 'bg-purple-500/20 border-purple-500/40 text-purple-300'
              : 'bg-white/5 border-white/5 text-slate-300 hover:bg-white/10 hover:border-white/10'
          }`}
        >
          <span className="text-[9px] font-mono uppercase tracking-widest text-slate-400 flex items-center gap-1">
            <GitCompare size={10} /> Ontology Mapping
          </span>
          <span className="text-xs font-bold uppercase tracking-wider text-left">
            {showDivergence ? 'Close Divergence Report' : 'Cross-Style Divergence Grid'}
          </span>
        </button>
      </div>

      {/* Cross-Style Divergence Grid Panel */}
      {showDivergence && (
        <div className="relative z-10 mb-6 bg-gradient-to-br from-[#1b112d] to-[#0a0714] border border-purple-500/20 rounded-3xl p-6 shrink-0 animate-in fade-in slide-in-from-top-3 max-h-96 overflow-y-auto custom-scrollbar">
          <div className="flex justify-between items-center border-b border-purple-500/20 pb-3 mb-4">
            <div>
              <h3 className="text-sm font-bold uppercase tracking-widest text-purple-400 flex items-center gap-2">
                <GitCompare size={16} /> Cross-Style Divergence Report
              </h3>
              <p className="text-[10px] text-slate-400 mt-1">Comparing generic rule-breaks across all emulated songwriter ontologies.</p>
            </div>
          </div>

          {findings.length === 0 ? (
            <div className="text-center py-6 text-slate-500 font-mono text-xs italic">
              No rule-breaks detected in this arrangement. Both strict and specific style rules are completely satisfied!
            </div>
          ) : (
            <div className="space-y-4">
              {crossReport.map((item, idx) => {
                const sectionName = sections[item.finding.location.sectionIdx]?.def.name || `Section ${item.finding.location.sectionIdx + 1}`;
                return (
                  <div key={item.finding.id} className="bg-black/40 border border-white/5 rounded-2xl p-4 flex flex-col gap-3">
                    <div className="flex flex-wrap justify-between items-center gap-2 border-b border-white/5 pb-2">
                      <div className="flex items-center gap-2">
                        <span className="px-2 py-0.5 bg-white/5 border border-white/10 rounded font-mono text-[9px] font-bold text-white">
                          {sectionName} • B{item.finding.location.bar}
                        </span>
                        <span className="text-[10px] font-mono text-slate-400 uppercase">
                          {item.finding.category.replace('_', ' ')}
                        </span>
                      </div>
                      <span className={`text-[9px] font-mono uppercase tracking-widest ${
                        item.isUniversalFlaw ? 'text-red-400 bg-red-500/10 border border-red-500/20 px-1.5 py-0.5 rounded' : 'text-purple-400 bg-purple-500/10 border border-purple-500/20 px-1.5 py-0.5 rounded'
                      }`}>
                        {item.isUniversalFlaw ? 'Universal Flaw' : 'Stylistic Tension'}
                      </span>
                    </div>

                    <p className="text-xs text-slate-300 leading-relaxed font-mono">
                      "{item.finding.message}"
                    </p>

                    <div className="bg-black/30 rounded-xl p-3 border border-white/5">
                      <div className="text-[9px] font-mono uppercase tracking-widest text-slate-500 mb-2">
                        Style Acceptance Matrix
                      </div>
                      <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
                        {Object.entries(writerNames).map(([id, name]) => {
                          const isExcused = item.excusedBy.some(x => x.id === id);
                          return (
                            <div 
                              key={id} 
                              className={`p-2 rounded-lg border flex flex-col justify-between h-14 ${
                                isExcused 
                                  ? 'bg-emerald-500/5 border-emerald-500/20 text-emerald-300' 
                                  : 'bg-red-500/5 border-red-500/20 text-red-400 opacity-60'
                              }`}
                            >
                              <span className="text-[9px] font-bold leading-tight line-clamp-1">{name}</span>
                              <div className="flex items-center gap-1 text-[10px] font-mono font-bold">
                                {isExcused ? (
                                  <>
                                    <CheckCircle size={10} className="text-emerald-400" />
                                    <span className="text-[9px] text-emerald-400 uppercase tracking-wider">Excuses</span>
                                  </>
                                ) : (
                                  <>
                                    <AlertTriangle size={10} className="text-red-400" />
                                    <span className="text-[9px] text-red-400 uppercase tracking-wider">Penalizes</span>
                                  </>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      <div className="relative z-10 mb-6 bg-white/5 border border-white/5 rounded-2xl p-4 shrink-0 shadow-inner flex flex-col gap-4">
        <p className="text-xs text-slate-300 italic">{displayedSummary}</p>
        
        {beforeAfterScore && (
          <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-xl p-3 text-emerald-400 text-xs font-mono flex items-center justify-between gap-4 shadow-[0_0_20px_rgba(16,185,129,0.15)] animate-bounce">
            <div className="flex items-center gap-2">
              <Check className="text-emerald-400 shrink-0" size={14} />
              <span>Optimized Theory Score: <strong>{beforeAfterScore.before}</strong> → <strong className="text-white text-sm underline decoration-emerald-400 decoration-2 underline-offset-2">{beforeAfterScore.after}</strong>/100</span>
            </div>
            <button 
              onClick={() => setBeforeAfterScore(null)}
              className="text-emerald-400 hover:text-white font-black text-sm px-1"
            >
              ×
            </button>
          </div>
        )}

        {displayedScore < 100 && (
          <button
            onClick={handleAutoOptimize}
            disabled={isOptimizing}
            className={`w-full py-3 px-4 rounded-xl font-bold uppercase tracking-widest text-xs flex items-center justify-center gap-2 transition-all shadow-lg ${
              isOptimizing
                ? 'bg-orange-500/10 text-orange-400 border border-orange-500/30 cursor-not-allowed'
                : 'bg-gradient-to-r from-orange-500 to-amber-500 text-black hover:from-orange-400 hover:to-amber-400 cursor-pointer hover:shadow-orange-500/20 hover:scale-[1.01]'
            }`}
          >
            {isOptimizing ? (
              <>
                <RefreshCw size={14} className="animate-spin" />
                Sweeping Multi-Pass Music-Theory Fixes...
              </>
            ) : (
              <>
                <Sparkles size={14} />
                Auto-Optimize Entire Arrangement
              </>
            )}
          </button>
        )}
      </div>

      {/* Optimization Report Panel */}
      {beforeAfterScore && traceLog.length > 0 && (
        <div className="relative z-10 mb-6 bg-emerald-500/10 border border-emerald-500/20 rounded-2xl p-4 shrink-0 animate-in fade-in slide-in-from-top-2">
          <div className="flex justify-between items-center border-b border-emerald-500/20 pb-2 mb-3">
            <h4 className="text-xs font-bold font-mono uppercase text-emerald-400 flex items-center gap-1.5">
              <CheckCircle size={14} /> Optimization Report
            </h4>
            <button 
              onClick={() => { setBeforeAfterScore(null); setTraceLog([]); }} 
              className="text-[10px] text-slate-400 hover:text-white font-mono"
            >
              Clear Log
            </button>
          </div>
          <div className="flex items-center gap-3 mb-3 bg-black/40 p-2.5 rounded-xl border border-white/5">
            <span className="text-xs text-slate-400 font-mono">Arrangement Score:</span>
            <div className="flex items-center gap-1.5 font-mono text-sm">
              <span className="text-red-400 line-through">{beforeAfterScore.before}</span>
              <span className="text-slate-400">→</span>
              <span className="text-emerald-400 font-bold text-base">{beforeAfterScore.after}</span>
              <span className="text-xs text-emerald-400 bg-emerald-500/20 px-1.5 py-0.5 rounded-md ml-1 font-bold">+{beforeAfterScore.after - beforeAfterScore.before} points</span>
            </div>
          </div>
          <div className="max-h-32 overflow-y-auto space-y-1.5 pr-1 custom-scrollbar">
            {traceLog.map((step, idx) => (
              <div key={idx} className="text-[11px] font-mono flex items-start gap-1 text-slate-300">
                <span className="text-emerald-400">✓</span>
                <div>
                  <span className="text-slate-500">[{step.sectionName} • B{step.bar}]:</span>{' '}
                  {step.description}{' '}
                  <span className="text-emerald-400 font-bold">(+{step.scoreDelta})</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Category Quick Filters */}
      {categories.length > 0 && (
        <div className="relative z-10 flex flex-wrap gap-2 mb-6 shrink-0">
          <button
            onClick={() => setActiveCategory(null)}
            className={`px-3 py-1.5 rounded-xl text-[10px] font-mono uppercase tracking-wider transition-all border ${
              activeCategory === null
                ? 'bg-orange-500/20 border-orange-500/40 text-orange-400 font-bold'
                : 'bg-black/30 border-white/5 text-slate-400 hover:text-white hover:border-white/20'
            }`}
          >
            All ({displayedFindings.length})
          </button>
          {categories.map(cat => {
            const count = displayedFindings.filter(f => f.category === cat).length;
            return (
              <button
                key={cat}
                onClick={() => setActiveCategory(cat)}
                className={`px-3 py-1.5 rounded-xl text-[10px] font-mono uppercase tracking-wider transition-all border flex items-center gap-1.5 ${
                  activeCategory === cat
                    ? 'bg-orange-500/20 border-orange-500/40 text-orange-400 font-bold'
                    : 'bg-black/30 border-white/5 text-slate-400 hover:text-white hover:border-white/20'
                }`}
              >
                {CATEGORY_ICONS[cat as keyof typeof CATEGORY_ICONS]}
                <span className="capitalize">{cat.replace('_', ' ')}</span>
                <span className="opacity-50">({count})</span>
              </button>
            );
          })}
        </div>
      )}

      {/* Findings List */}
      <div className="relative z-10 flex-1 overflow-y-auto pr-2 space-y-4 custom-scrollbar">
        {filteredFindings.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-48 text-slate-400 border border-dashed border-white/10 rounded-2xl bg-white/5">
            <CheckCircle className="text-emerald-500 mb-2" size={32} />
            <p className="font-mono text-xs">No arrangement flaws detected.</p>
            <p className="text-[10px] opacity-60">The voicing and spacing are theoretically perfect!</p>
          </div>
        ) : (
          filteredFindings.map((finding) => {
            const style = SEVERITY_STYLES[finding.severity];
            const sectionName = sections[finding.location.sectionIdx]?.def.name || `Section ${finding.location.sectionIdx + 1}`;
            const styleFinding = finding as StyleAwareFinding;
            
            return (
              <div 
                key={finding.id}
                className={`flex flex-col gap-3 p-4 rounded-2xl border transition-all hover:bg-white/5 ${style.bg} ${style.border} relative overflow-hidden`}
              >
                {styleFinding.styleNote && (
                  <div className="absolute top-0 right-0 w-1 h-full bg-gradient-to-b from-purple-500 to-indigo-500"></div>
                )}
                
                <div className="flex justify-between items-start">
                  <div className="flex items-center gap-2">
                    {style.icon}
                    <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-white bg-white/5 px-2 py-0.5 rounded border border-white/10">
                      {sectionName} • Bar {finding.location.bar}
                    </span>
                    <span className="text-[10px] font-mono capitalize opacity-60">
                      {finding.category.replace('_', ' ')}
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    {styleFinding.styleNote && (
                      <span className="text-[9px] font-mono uppercase bg-purple-500/20 text-purple-300 px-1.5 py-0.5 rounded border border-purple-500/30 animate-pulse">
                        Stylistic Signature
                      </span>
                    )}
                    <span className={`text-[9px] font-mono uppercase tracking-widest font-bold ${style.text}`}>
                      {finding.severity}
                    </span>
                  </div>
                </div>
                
                <p className="text-xs text-white leading-relaxed">{finding.message}</p>
                
                {styleFinding.styleNote && (
                  <div className="bg-purple-950/20 border border-purple-500/20 rounded-xl p-3 text-[11px] text-purple-300 flex items-start gap-2 animate-in fade-in slide-in-from-top-1">
                    <Star size={12} className="text-purple-400 mt-0.5 shrink-0" />
                    <div>
                      <span className="font-bold uppercase text-[9px] text-purple-400 block mb-0.5">Style Lens Excuse</span>
                      {styleFinding.styleNote}
                    </div>
                  </div>
                )}
                
                <div className="bg-black/20 rounded-xl p-3 border border-white/5 flex flex-col sm:flex-row justify-between sm:items-center gap-3">
                  <p className="text-[11px] text-slate-400">
                    <span className="text-orange-400 font-bold uppercase text-[9px] mr-1.5">Fix:</span>
                    {finding.suggestion}
                  </p>
                  
                  {finding.fix && onApplyFix && (
                    <button
                      onClick={() => handleApplyFixWithFeedback(finding.id, finding.location.sectionIdx, finding.location.bar, finding.fix!.type)}
                      disabled={fixingId !== null}
                      className={`px-3 py-1.5 font-bold text-[10px] uppercase tracking-widest rounded-lg transition-all flex items-center gap-1.5 shrink-0 self-end sm:self-auto shadow-md ${
                        fixingId === finding.id
                          ? 'bg-orange-500/10 border border-orange-500/40 text-orange-400 animate-pulse'
                          : 'bg-white hover:bg-orange-500 hover:text-white text-black'
                      }`}
                    >
                      {fixingId === finding.id ? (
                        <>
                          <RefreshCw size={10} className="animate-spin" />
                          Fixing...
                        </>
                      ) : (
                        <>
                          <Wrench size={10} />
                          Fix Now
                        </>
                      )}
                    </button>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
