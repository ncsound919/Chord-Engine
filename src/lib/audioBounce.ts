/**
 * Audio Bounce — renders the current arrangement to a WAV file
 * using OfflineAudioContext (2-3× faster than realtime).
 */

import * as Tone from 'tone';
import { audioEngine } from './audio/engine';
import { transport } from './audio/engine';
import { GeneratedSection } from './engine';

export async function bounceToWav(
  sections: GeneratedSection[],
  durationBars: number,
  bpm: number,
  beatsPerBar: number = 4
): Promise<Blob> {
  const sampleRate = 44100;
  const totalBeats = durationBars * beatsPerBar;
  const totalSeconds = (totalBeats / bpm) * 60;
  const length = Math.ceil(sampleRate * totalSeconds);

  // Create offline context
  const offlineCtx = new OfflineAudioContext(2, length, sampleRate);

  // Connect master chain to offline destination
  const masterGain = offlineCtx.createGain();
  masterGain.gain.value = 0.9;
  masterGain.connect(offlineCtx.destination);

  const reverbNode = offlineCtx.createConvolver();
  const reverbGain = offlineCtx.createGain();
  reverbGain.gain.value = 0.15;
  reverbNode.connect(reverbGain);
  reverbGain.connect(masterGain);

  // Collect all scheduled events
  const events: Array<{ time: number; channel: string; freq: number; dur: number; gain: number }> = [];

  let beatOffset = 0;
  for (const section of sections) {
    const sectionBeats = section.def.lengthBars * (section.def.beatsPerBar || 4);
    const barLen = beatsPerBar;

    for (const chord of section.chords) {
      const chordTime = ((beatOffset + (chord.bar - 1) * barLen + (chord.beat - 1)) / bpm) * 60;
      const dur = (4 / bpm) * 60;

      // Piano voicing
      if (chord.pianoVoicing) {
        for (const note of chord.pianoVoicing.notes) {
          events.push({ time: chordTime, channel: 'keys', freq: 440 * Math.pow(2, (note - 69) / 12), dur, gain: 0.3 });
        }
      }

      // Bass
      if (chord.bassNote) {
        const bassFreq = 440 * Math.pow(2, (chord.bassNote.midi - 69) / 12);
        events.push({ time: chordTime, channel: 'bass', freq: bassFreq, dur: dur * 1.5, gain: 0.5 });
      }
    }

    // Drums
    if (section.drumPattern) {
      const stepDur = (60 / bpm) / 4;
      const stepTime = (beatOffset / bpm) * 60;
      for (const [voice, steps] of Object.entries(section.drumPattern.grid)) {
        for (let s = 0; s < steps.length; s++) {
          if (steps[s]) {
            const t = stepTime + s * stepDur;
            const freq = voice === 'Kick' ? 60 : voice === 'Snare' ? 200 : voice.includes('HH') ? 8000 : 400;
            events.push({ time: t, channel: 'drums', freq, dur: voice.includes('HH') ? 0.05 : 0.15, gain: voice.includes('HH') ? 0.2 : 0.5 });
          }
        }
      }
    }

    beatOffset += sectionBeats;
  }

  // Render in offline context
  const bufferSize = 128;
  const numChannels = 2;
  let eventIndex = 0;

  // Schedule all events as OscillatorNode + GainNode pairs
  for (const ev of events) {
    if (ev.time > totalSeconds) continue;
    const osc = offlineCtx.createOscillator();
    const gain = offlineCtx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.value = ev.freq;
    gain.gain.setValueAtTime(ev.gain, ev.time);
    gain.gain.exponentialRampToValueAtTime(0.001, ev.time + ev.dur);
    osc.connect(gain);
    gain.connect(masterGain);
    osc.start(ev.time);
    osc.stop(ev.time + ev.dur + 0.05);
  }

  // Render
  const renderedBuffer = await offlineCtx.startRendering();

  // Convert to WAV
  const wavBlob = audioBufferToWav(renderedBuffer);
  return wavBlob;
}

function audioBufferToWav(buffer: AudioBuffer): Blob {
  const numChannels = buffer.numberOfChannels;
  const sampleRate = buffer.sampleRate;
  const format = 1; // PCM
  const bitsPerSample = 16;

  const byteRate = sampleRate * numChannels * bitsPerSample / 8;
  const blockAlign = numChannels * bitsPerSample / 8;
  const dataSize = buffer.length * numChannels * bitsPerSample / 8;
  const headerSize = 44;
  const totalSize = headerSize + dataSize;

  const arrayBuffer = new ArrayBuffer(totalSize);
  const view = new DataView(arrayBuffer);

  // WAV header
  const writeStr = (offset: number, str: string) => {
    for (let i = 0; i < str.length; i++) view.setUint8(offset + i, str.charCodeAt(i));
  };
  writeStr(0, 'RIFF');
  view.setUint32(4, totalSize - 8, true);
  writeStr(8, 'WAVE');
  writeStr(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, format, true);
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, byteRate, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, bitsPerSample, true);
  writeStr(36, 'data');
  view.setUint32(40, dataSize, true);

  // Interleave channels
  let offset = 44;
  for (let i = 0; i < buffer.length; i++) {
    for (let ch = 0; ch < numChannels; ch++) {
      const sample = Math.max(-1, Math.min(1, buffer.getChannelData(ch)[i]));
      const val = sample < 0 ? sample * 0x8000 : sample * 0x7fff;
      view.setInt16(offset, val, true);
      offset += 2;
    }
  }

  return new Blob([arrayBuffer], { type: 'audio/wav' });
}

export function downloadWav(blob: Blob, filename: string = `bounce-${Date.now()}.wav`) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
