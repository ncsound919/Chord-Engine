import { useState, useRef, useCallback, useEffect } from 'react';
import { audioEngine } from '../lib/audio/engine';

// Maps a negotiated MediaRecorder mimeType to the correct file extension.
// FIX: the download filename was previously hardcoded to `.webm` regardless
// of which mimeType MediaRecorder.isTypeSupported() actually picked. Safari
// does not support audio/webm at all (confirmed against WebKit's own
// MediaRecorder docs) — it only writes audio/mp4 — so on Safari the
// downloaded file was named "...webm" while actually containing MP4/AAC
// data, which many players and OS file-type handlers will refuse to open
// or will misinterpret.
const MIME_TO_EXTENSION: Record<string, string> = {
  'audio/webm': 'webm',
  'audio/mp4': 'm4a',
  'audio/ogg': 'ogg',
};

function extensionForMimeType(mimeType: string): string {
  // mimeType may include a codecs parameter (e.g. "audio/webm;codecs=opus"),
  // so match on the base type before the semicolon.
  const base = mimeType.split(';')[0].trim();
  return MIME_TO_EXTENSION[base] || 'webm';
}

const SUPPORTED_MIME_TYPES = ['audio/webm', 'audio/mp4', 'audio/ogg'];

export function useRecording() {
  const [isRecording, setIsRecording] = useState(false);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const destinationRef = useRef<MediaStreamAudioDestinationNode | null>(null);

  const startRecording = useCallback(async () => {
    // FIX: previously had no guard here. Calling startRecording twice in a
    // row (e.g. a double-click before React re-renders isRecording, or two
    // callers racing) created a second MediaStreamAudioDestinationNode,
    // fanned masterLimiter's output to it as well, and overwrote
    // recorderRef/destinationRef — permanently orphaning the first
    // recorder (which kept recording forever with no reference left to
    // stop it) and its AudioNode connection (never disconnected).
    if (recorderRef.current && recorderRef.current.state !== 'inactive') {
      return;
    }

    if (audioEngine.ctx.state === 'suspended') {
      await audioEngine.ctx.resume();
    }

    const destination = audioEngine.ctx.createMediaStreamDestination();
    destinationRef.current = destination;
    audioEngine.masterLimiter.connect(destination);

    // Filter out tracks that shouldn't be recorded if needed,
    // but usually masterGain is what we want.

    const mimeType = SUPPORTED_MIME_TYPES.find((type) =>
      MediaRecorder.isTypeSupported(type)
    );

    if (!mimeType) {
      console.error('No supported audio recording format found in this browser.');
      // Clean up the destination node we already created/connected above —
      // previously this early-return left it connected with nothing to
      // ever disconnect it.
      audioEngine.masterLimiter.disconnect(destination);
      destinationRef.current = null;
      return;
    }

    const recorder = new MediaRecorder(destination.stream, { mimeType });
    chunksRef.current = [];

    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) chunksRef.current.push(e.data);
    };

    recorder.onstop = () => {
      const blob = new Blob(chunksRef.current, { type: mimeType });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `deterministic-composition-${new Date().toISOString()}.${extensionForMimeType(mimeType)}`;
      a.click();
      URL.revokeObjectURL(url);

      // Cleanup
      if (destinationRef.current) {
        audioEngine.masterLimiter.disconnect(destinationRef.current);
        destinationRef.current = null;
      }
      if (recorderRef.current === recorder) {
        recorderRef.current = null;
      }
    };

    recorder.start();
    recorderRef.current = recorder;
    setIsRecording(true);
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (recorderRef.current?.state === 'recording') {
        recorderRef.current.stop();
      }
      if (destinationRef.current) {
        audioEngine.masterLimiter.disconnect(destinationRef.current);
        destinationRef.current = null;
      }
    };
  }, []);

  const stopRecording = useCallback(() => {
    if (recorderRef.current && recorderRef.current.state !== 'inactive') {
      recorderRef.current.stop();
    }
    setIsRecording(false);
  }, []);

  const toggleRecording = useCallback(() => {
    if (isRecording) {
      stopRecording();
    } else {
      startRecording();
    }
  }, [isRecording, startRecording, stopRecording]);

  return { isRecording, startRecording, stopRecording, toggleRecording };
}
