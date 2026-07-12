import { audioEngine } from './engine';
import * as Tone from 'tone';

export interface OneShotSample {
  id: string;
  name: string;
  folder: string;
  fileName: string;
  bufferKey: string;
  midiNote?: number;
  tags: string[];
}

class OneShotRegistry {
  private readonly samples = new Map<string, OneShotSample>();

  register(sample: OneShotSample) {
    this.samples.set(sample.id, sample);
  }

  get(id: string) {
    return this.samples.get(id);
  }

  list() {
    return [...this.samples.values()];
  }

  clear() {
    this.samples.clear();
  }
}

export const oneShotRegistry = new OneShotRegistry();

export function playOneShot(
  buffer: Tone.ToneAudioBuffer,
  time = Tone.now(),
  gain = 1,
) {
  const track = audioEngine.tracks.get('oneshots');
  if (!track) return;

  const player = new Tone.Player(buffer).connect(track.inputGain);
  player.volume.value = Tone.gainToDb(Math.max(0.0001, gain));
  player.start(time);

  const cleanupDelay = Math.max(50, buffer.duration * 1000 + 100);
  setTimeout(() => player.dispose(), cleanupDelay);
}
