import { useState, useRef, useCallback, useEffect } from 'react';

export function useVoiceToMidi() {
  const [isVoiceToMidi, setIsVoiceToMidi] = useState(false);
  const [micError, setMicError] = useState<string | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);

  // Guards against overlapping getUserMedia calls: if the user toggles
  // again while the previous getUserMedia() promise is still pending, the
  // stale resolution is ignored instead of silently overwriting
  // mediaRecorderRef and orphaning the first stream's tracks (mic stays
  // hot with no way to stop it).
  const requestIdRef = useRef(0);

  const stopRecorder = useCallback(() => {
    const recorder = mediaRecorderRef.current;
    if (recorder && recorder.state !== 'inactive') {
      recorder.stop();
      recorder.stream.getTracks().forEach(t => t.stop());
    }
    // Clear the ref even if state was already 'inactive' — a stale
    // reference to a dead recorder previously lingered here, which could
    // mislead any code checking `mediaRecorderRef.current !== null` as a
    // proxy for "currently recording".
    mediaRecorderRef.current = null;
  }, []);

  const toggleVoiceToMidi = useCallback(async () => {
    if (isVoiceToMidi) {
      requestIdRef.current += 1; // invalidate any in-flight start request
      setIsVoiceToMidi(false);
      stopRecorder();
      return;
    }

    setMicError(null);
    const thisRequestId = ++requestIdRef.current;

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });

      // If the user toggled off (or toggled on again) while this request
      // was in flight, this resolution is stale — release the stream
      // immediately instead of wiring it up as the active recorder.
      if (thisRequestId !== requestIdRef.current) {
        stream.getTracks().forEach(t => t.stop());
        return;
      }

      const recorder = new MediaRecorder(stream);

      // MediaRecorder errors during an active session arrive asynchronously
      // via the 'error' event, not through this function's try/catch —
      // without this handler a mid-session failure (e.g. SecurityError)
      // left isVoiceToMidi stuck at true with no way to detect it.
      recorder.addEventListener('error', (event) => {
        console.error('MediaRecorder error:', (event as any).error);
        setMicError('Recording stopped unexpectedly.');
        setIsVoiceToMidi(false);
        recorder.stream.getTracks().forEach(t => t.stop());
        if (mediaRecorderRef.current === recorder) {
          mediaRecorderRef.current = null;
        }
      });

      mediaRecorderRef.current = recorder;
      recorder.start();
      setIsVoiceToMidi(true);
    } catch (err) {
      console.error('Microphone access denied or error:', err);
      if (thisRequestId === requestIdRef.current) {
        setMicError('Microphone access was denied or unavailable.');
      }
    }
  }, [isVoiceToMidi, stopRecorder]);

  useEffect(() => {
    return () => {
      requestIdRef.current += 1; // invalidate any in-flight request on unmount
      stopRecorder();
    };
  }, [stopRecorder]);

  return {
    isVoiceToMidi,
    toggleVoiceToMidi,
    micError,
  };
}
