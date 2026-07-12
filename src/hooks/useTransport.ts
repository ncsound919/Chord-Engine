import { useState, useEffect, useCallback, useRef } from 'react';
import { transport, audioEngine } from '../lib/audio/engine';

export function useTransport(initialTempo = 85) {
  const [isPlaying, setIsPlaying] = useState(transport.isPlaying);
  const [tempo, setTempoState] = useState(transport.tempo || initialTempo);
  const [currentBeat, setCurrentBeat] = useState(0);
  const [playError, setPlayError] = useState<string | null>(null);

  const didInitTempo = useRef(false);

  useEffect(() => {
    if (didInitTempo.current) return;
    didInitTempo.current = true;
    transport.tempo = initialTempo;
    // NOTE: this effect intentionally only applies initialTempo once, on
    // first mount — the didInitTempo guard means later changes to the
    // initialTempo prop are ignored. That may well be the intended
    // behavior for an "initial" value, but the [initialTempo] dependency
    // below makes it look like the effect responds to prop changes when it
    // doesn't. Flagging in case that's not actually what you want — if
    // initialTempo should be able to reset the tempo later, this guard
    // needs to go; if not, [] is the more honest dependency array.
  }, [initialTempo]);

  useEffect(() => {
    let rafId: number | null = null;

    const runLoop = () => {
      setCurrentBeat(transport.getCurrentBeat());
      rafId = requestAnimationFrame(runLoop);
    };

    const stopLoop = () => {
      if (rafId !== null) {
        cancelAnimationFrame(rafId);
        rafId = null;
      }
    };

    // Guarded consistently with the subscribe callback below (rafId ===
    // null) rather than calling runLoop() unconditionally — previously
    // this line had no guard, which was harmless only because rafId is
    // guaranteed null at this exact point in the code. Making it
    // consistent avoids a double RAF loop if this line is ever moved or
    // this effect is refactored.
    //
    // ASSUMPTION FLAGGED: this also assumes transport.subscribe() does
    // NOT synchronously invoke its callback with the current state upon
    // registration. If it does, the subscribe call above would already
    // have started the loop via its own `state.isPlaying && rafId === null`
    // branch, making this line a harmless no-op (guarded) rather than a
    // double-start — but verify against your actual transport
    // implementation.
    if (transport.isPlaying && rafId === null) runLoop();

    const unsubscribe = transport.subscribe((state) => {
      setIsPlaying(state.isPlaying);
      setTempoState(state.tempo);

      if (state.isPlaying && rafId === null) {
        runLoop();
      } else if (!state.isPlaying) {
        stopLoop();
      }
    });

    return () => {
      unsubscribe();
      stopLoop();
    };
  }, []);

  const setTempo = useCallback((value: number) => {
    // FIX: `value || 120` treated 0 the same as missing/undefined input,
    // because 0 is falsy in JS — so setTempo(0) silently jumped to 120
    // instead of clamping to the declared minimum of 20. NaN/undefined
    // still fall back to 120 as before (that part was reasonable
    // defensive coding); only the "reject valid numeric 0" behavior is
    // fixed here.
    const raw = Number.isFinite(value) ? value : 120;
    const next = Math.max(20, Math.min(300, Math.round(raw)));
    transport.tempo = next;
    setTempoState(next);
  }, []);

  const play = useCallback(async () => {
    // FIX: previously un-caught — if transport.start() rejected (e.g. a
    // suspended AudioContext failing to resume), this became an unhandled
    // promise rejection with no user feedback, since togglePlay() calls
    // play() without awaiting or catching it.
    try {
      setPlayError(null);
      await transport.start();
    } catch (err) {
      console.error('Failed to start transport:', err);
      setPlayError('Playback failed to start.');
    }
  }, []);

  const stop = useCallback(() => {
    transport.stop();
  }, []);

  const togglePlay = useCallback(() => {
    if (transport.isPlaying) {
      stop();
    } else {
      play();
    }
  }, [play, stop]);

  const reset = useCallback(() => {
    transport.reset();
  }, []);

  return { 
    tempo, 
    setTempo, 
    isPlaying, 
    currentBeat, 
    play, 
    stop, 
    togglePlay, 
    reset,
    playError,
  };
}
