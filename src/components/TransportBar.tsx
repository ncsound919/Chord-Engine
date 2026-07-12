import React, { useCallback, useMemo, memo, useState, useEffect } from 'react';
import { Play, Square, Circle, Mic, Volume2, Activity } from 'lucide-react';
import { useTransport } from '../hooks/useTransport';
import { useRecording } from '../hooks/useRecording';
import { useVoiceToMidi } from '../hooks/useVoiceToMidi';

// Constants
const DEFAULT_TEMPO = 85;
const MIN_TEMPO = 20;
const MAX_TEMPO = 300;
const DEBOUNCE_MS = 300;

// Helper: format position based on time signature
const formatPosition = (beat: number, beatsPerBar: number) => {
  const bar = Math.floor(beat / beatsPerBar) + 1;
  const beatInBar = Math.floor(beat % beatsPerBar) + 1;
  return `${bar} : ${beatInBar}`;
};

export interface TransportBarProps {
  /** Initial tempo (BPM) */
  initialTempo?: number;
  /** Time signature numerator (beats per bar) */
  timeSignature?: number;
  /** Optional override for transport hook (testing) */
  useTransportOverride?: typeof useTransport;
  /** Optional override for recording hook */
  useRecordingOverride?: typeof useRecording;
  /** Optional override for voice‑to‑MIDI hook */
  useVoiceToMidiOverride?: typeof useVoiceToMidi;
}

export const TransportBar: React.FC<TransportBarProps> = memo(({
  initialTempo = DEFAULT_TEMPO,
  timeSignature = 4,
  useTransportOverride = useTransport,
  useRecordingOverride = useRecording,
  useVoiceToMidiOverride = useVoiceToMidi,
}) => {
  // ----- Hooks -----
  const {
    tempo,
    setTempo,
    isPlaying,
    currentBeat,
    play,
    stop,
    togglePlay,
  } = useTransportOverride(initialTempo);

  const {
    isRecording,
    toggleRecording,
  } = useRecordingOverride();

  const {
    isVoiceToMidi,
    toggleVoiceToMidi,
  } = useVoiceToMidiOverride();

  // ----- Local state for tempo input (debounced) -----
  const [tempoInput, setTempoInput] = useState<string>(String(tempo));

  // Sync local input when tempo changes externally
  useEffect(() => {
    setTempoInput(String(tempo));
  }, [tempo]);

  // Debounced tempo commit
  const commitTempo = useCallback((value: number) => {
    const clamped = Math.min(Math.max(value, MIN_TEMPO), MAX_TEMPO);
    setTempo(clamped);
    setTempoInput(String(clamped));
  }, [setTempo]);

  // Handle input change – updates local display immediately, commits after debounce
  const handleTempoChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value;
    setTempoInput(raw);
    // Only try to commit if it's a valid number
    const num = parseInt(raw, 10);
    if (!isNaN(num) && raw !== '') {
      // Debounce commit
      const handler = setTimeout(() => commitTempo(num), DEBOUNCE_MS);
      return () => clearTimeout(handler);
    }
  }, [commitTempo]);

  // Commit on blur or Enter key
  const handleTempoBlur = useCallback(() => {
    const num = parseInt(tempoInput, 10);
    if (!isNaN(num)) {
      commitTempo(num);
    } else {
      // Reset to current tempo
      setTempoInput(String(tempo));
    }
  }, [tempoInput, tempo, commitTempo]);

  const handleTempoKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      handleTempoBlur();
    }
  }, [handleTempoBlur]);

  // ----- Memoized position display -----
  const positionText = useMemo(
    () => formatPosition(currentBeat, timeSignature),
    [currentBeat, timeSignature]
  );

  // ----- Status announcements (for screen readers) -----
  const statusMessage = useMemo(() => {
    const parts: string[] = [];
    if (isPlaying) parts.push('Playing');
    else parts.push('Stopped');
    if (isRecording) parts.push('Recording');
    if (isVoiceToMidi) parts.push('Voice‑to‑MIDI active');
    return parts.join(' • ') || 'Idle';
  }, [isPlaying, isRecording, isVoiceToMidi]);

  return (
    <div
      className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 bg-[#06070e]/90 backdrop-blur-2xl border border-white/10 rounded-full px-6 py-3 shadow-[0_20px_50px_rgba(0,0,0,0.6)] flex flex-wrap items-center justify-center gap-4 sm:gap-6 animate-in slide-in-from-bottom-8"
      role="toolbar"
      aria-label="Transport controls"
    >
      {/* ---- Live region for status updates ---- */}
      <div className="sr-only" aria-live="polite" aria-atomic="true">
        {statusMessage}
      </div>

      {/* ---- Transport buttons ---- */}
      <div className="flex items-center gap-3">
        {/* Stop */}
        <button
          onClick={stop}
          disabled={!isPlaying}
          aria-label="Stop playback"
          title="Stop playback"
          className={`w-8 h-8 rounded-full flex items-center justify-center transition-colors ${
            isPlaying
              ? 'text-white hover:bg-white/10 focus:ring-2 focus:ring-orange-400 focus:ring-offset-2 focus:ring-offset-[#06070e]'
              : 'text-slate-600 cursor-not-allowed opacity-40'
          }`}
        >
          <Square size={14} fill="currentColor" />
        </button>

        {/* Play/Pause */}
        <button
          onClick={togglePlay}
          aria-label={isPlaying ? 'Pause playback' : 'Play playback'}
          title={isPlaying ? 'Pause' : 'Play'}
          className={`w-12 h-12 rounded-full flex items-center justify-center transition-all focus:ring-2 focus:ring-orange-400 focus:ring-offset-2 focus:ring-offset-[#06070e] ${
            isPlaying
              ? 'bg-orange-400 text-black shadow-[0_0_20px_rgba(249,115,22,0.6)] hover:bg-orange-300'
              : 'bg-orange-500 hover:bg-orange-400 text-black shadow-[0_0_15px_rgba(249,115,22,0.4)]'
          }`}
        >
          {isPlaying ? <Square size={18} fill="currentColor" /> : <Play size={20} fill="currentColor" className="ml-1" />}
        </button>

        {/* Recording & Voice-to-MIDI */}
        <div className="flex items-center gap-3">
          <button
            onClick={toggleRecording}
            aria-label={isRecording ? 'Stop recording' : 'Start recording'}
            title={isRecording ? 'Stop recording' : 'Start recording'}
            className={`w-8 h-8 rounded-full flex items-center justify-center transition-colors group relative focus:ring-2 focus:ring-red-400 focus:ring-offset-2 focus:ring-offset-[#06070e] ${
              isRecording ? 'text-red-500 bg-red-500/20' : 'text-red-400 hover:bg-red-500/10'
            }`}
          >
            <Circle size={16} fill="currentColor" />
            {isRecording && isPlaying && (
              <div className="absolute inset-0 rounded-full bg-red-500 animate-ping opacity-40" aria-hidden="true" />
            )}
          </button>

          <button
            onClick={toggleVoiceToMidi}
            aria-label={isVoiceToMidi ? 'Disable voice‑to‑MIDI' : 'Enable voice‑to‑MIDI'}
            title={isVoiceToMidi ? 'Disable voice‑to‑MIDI' : 'Enable voice‑to‑MIDI'}
            className={`w-8 h-8 rounded-full flex items-center justify-center transition-colors group relative focus:ring-2 focus:ring-blue-400 focus:ring-offset-2 focus:ring-offset-[#06070e] ${
              isVoiceToMidi ? 'text-blue-500 bg-blue-500/20' : 'text-blue-400 hover:bg-blue-500/10'
            }`}
          >
            <Mic size={16} />
            {isVoiceToMidi && isPlaying && (
              <div className="absolute inset-0 rounded-full bg-blue-500 animate-ping opacity-40" aria-hidden="true" />
            )}
          </button>
        </div>
      </div>

      <div className="h-8 w-px bg-white/10 mx-1" aria-hidden="true" />

      {/* ---- Position ---- */}
      <div className="flex flex-col items-center min-w-[90px]">
        <span className="text-[8px] font-mono font-bold uppercase text-slate-500 tracking-tighter">Position</span>
        <span className="text-sm font-mono font-bold text-white tabular-nums" aria-live="off">
          {positionText}
        </span>
      </div>

      <div className="h-8 w-px bg-white/10 mx-1" aria-hidden="true" />

      {/* ---- Tempo ---- */}
      <div className="flex items-center gap-4 group">
        <div className="flex flex-col">
          <label htmlFor="tempo-input" className="text-[8px] font-mono font-bold uppercase text-slate-500 tracking-tighter">
            Tempo
          </label>
          <div className="flex items-center gap-2">
            <input
              id="tempo-input"
              type="text" // using text to allow empty state, but we enforce numeric
              inputMode="numeric"
              pattern="[0-9]*"
              value={tempoInput}
              onChange={handleTempoChange}
              onBlur={handleTempoBlur}
              onKeyDown={handleTempoKeyDown}
              aria-label="Tempo in beats per minute"
              className="w-12 bg-transparent text-sm font-mono font-bold text-orange-400 focus:outline-none focus:ring-2 focus:ring-orange-400 focus:ring-offset-2 focus:ring-offset-[#06070e] border-b border-transparent focus:border-orange-500/50"
            />
            <span className="text-[10px] font-bold text-slate-600">BPM</span>
          </div>
        </div>
      </div>

      <div className="h-8 w-px bg-white/10 mx-1" aria-hidden="true" />

      {/* ---- Status indicator ---- */}
      <div className="flex items-center gap-4">
        <div className="flex flex-col items-end">
          <div className="flex items-center gap-2">
            <div
              className={`w-1.5 h-1.5 rounded-full ${
                isPlaying ? 'bg-green-400 shadow-[0_0_8px_rgba(74,222,128,0.6)]' : 'bg-slate-600'
              }`}
              aria-hidden="true"
            />
            <span className="text-[10px] font-mono font-bold text-white/60 tracking-widest uppercase" aria-hidden="true">
              {isPlaying ? 'Live' : 'Stopped'}
            </span>
          </div>
          <span className="text-[8px] font-bold text-orange-500/60 uppercase tracking-tighter">Audio Engine</span>
        </div>
      </div>
    </div>
  );
});

TransportBar.displayName = 'TransportBar';
