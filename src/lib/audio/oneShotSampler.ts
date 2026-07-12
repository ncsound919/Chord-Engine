import * as Tone from 'tone';
import { audioEngine } from './engine';

export interface OneShotSample {
  id: string;
  name: string;
  filename: string;
  midiNote: number;
  buffer: Tone.ToneAudioBuffer | null;
  gain: number;
  pan: number;
  filterCutoff: number;
  filterRes: number;
  envAttack: number;
  envDecay: number;
  envSustain: number;
  envRelease: number;
}

export interface OneShotPreset {
  id: string;
  name: string;
  samples: OneShotSample[];
  globalFilterCutoff: number;
  globalFilterRes: number;
  globalEnvA: number;
  globalEnvD: number;
  globalEnvS: number;
  globalEnvR: number;
  globalVolume: number;
}

const DEFAULT_SAMPLE_PROPS = {
  gain: 1, pan: 0, filterCutoff: 20000, filterRes: 0,
  envAttack: 0.001, envDecay: 0.1, envSustain: 1, envRelease: 0.1,
};

interface PooledVoice {
  player: Tone.Player;
  env: Tone.AmplitudeEnvelope;
  gainNode: Tone.Gain;
  active: boolean;
  midiNote: number;
}

const POOL_SIZE = 16;

export class OneShotSampler {
  private samples: OneShotSample[] = [];
  private presets: OneShotPreset[] = [];
  private voicePool: PooledVoice[] = [];
  private poolIndex = 0;

  globalFilterCutoff = 20000;
  globalFilterRes = 0;
  globalEnvA = 0.001;
  globalEnvD = 0.1;
  globalEnvS = 1;
  globalEnvR = 0.1;
  globalVolume = 0.8;

  constructor() {
    this.initPool();
  }

  private initPool() {
    const track = audioEngine.tracks.get('oneshots');
    if (!track) return;
    for (let i = 0; i < POOL_SIZE; i++) {
      const gainNode = new Tone.Gain(0);
      const env = new Tone.AmplitudeEnvelope({ attack: 0.01, decay: 0.1, sustain: 1, release: 0.1 });
      const player = new Tone.Player();
      player.connect(gainNode);
      gainNode.connect(env);
      env.connect(track.inputGain);
      // Start silent
      gainNode.gain.value = 0;
      this.voicePool.push({ player, env, gainNode, active: false, midiNote: -1 });
    }
  }

  get loadedSamples() { return this.samples; }
  get loaded() { return this.samples.length > 0; }

  clear() {
    this.releaseAll();
    this.samples = [];
  }

  addSample(sample: Omit<OneShotSample, keyof typeof DEFAULT_SAMPLE_PROPS> & Partial<typeof DEFAULT_SAMPLE_PROPS>) {
    const fullSample: OneShotSample = { ...DEFAULT_SAMPLE_PROPS, ...sample };
    this.samples.push(fullSample);
    this.samples.sort((a, b) => a.midiNote - b.midiNote);
  }

  autoMapSamples(files: Array<{ id: string; name: string; filename: string; buffer: Tone.ToneAudioBuffer }>) {
    files.forEach((file, index) => {
      this.addSample({ ...file, midiNote: 24 + index });
    });
  }

  triggerNote(midi: number, velocity = 100, time?: number) {
    const sample = this.findClosest(midi);
    if (!sample || !sample.buffer) return;
    const playTime = time ?? audioEngine.ctx.currentTime;

    // Recycle a voice from the pool
    const voice = this.voicePool[this.poolIndex % POOL_SIZE];
    this.poolIndex = (this.poolIndex + 1) % POOL_SIZE;

    // If the voice is already active, release it first
    if (voice.active) {
      voice.env.triggerRelease();
    }

    voice.player.buffer = sample.buffer;
    voice.midiNote = midi;
    voice.gainNode.gain.value = sample.gain * this.globalVolume;
    voice.env.set({
      attack: Math.max(0.001, sample.envAttack + this.globalEnvA),
      decay: Math.max(0.001, sample.envDecay + this.globalEnvD),
      sustain: Math.min(1, sample.envSustain * this.globalEnvS),
      release: Math.max(0.001, sample.envRelease + this.globalEnvR),
    });

    voice.player.start(playTime);
    voice.env.triggerAttack(playTime);
    const duration = Math.max(0.5, sample.buffer.duration - 0.05);
    voice.env.triggerRelease(playTime + duration);
    voice.active = true;

    // Mark inactive after the sample + release tail
    const totalMs = (duration + sample.envRelease + this.globalEnvR + 0.1) * 1000;
    setTimeout(() => { voice.active = false; }, totalMs);
  }

  releaseAll() {
    this.voicePool.forEach(v => {
      if (v.active) {
        try { v.env.triggerRelease(); } catch {}
        v.active = false;
      }
    });
  }

  updateSample(index: number, props: Partial<OneShotSample>) {
    if (index >= 0 && index < this.samples.length) {
      this.samples[index] = { ...this.samples[index], ...props };
    }
  }

  removeSample(index: number) {
    if (index >= 0 && index < this.samples.length) {
      this.samples.splice(index, 1);
    }
  }

  getPresets(): OneShotPreset[] { return this.presets; }

  savePreset(name: string): OneShotPreset {
    const preset: OneShotPreset = {
      id: crypto.randomUUID(), name,
      samples: this.samples.map(s => ({ ...s })),
      globalFilterCutoff: this.globalFilterCutoff,
      globalFilterRes: this.globalFilterRes,
      globalEnvA: this.globalEnvA,
      globalEnvD: this.globalEnvD,
      globalEnvS: this.globalEnvS,
      globalEnvR: this.globalEnvR,
      globalVolume: this.globalVolume,
    };
    this.presets.push(preset);
    return preset;
  }

  loadPreset(preset: OneShotPreset) {
    this.clear();
    this.globalFilterCutoff = preset.globalFilterCutoff;
    this.globalFilterRes = preset.globalFilterRes;
    this.globalEnvA = preset.globalEnvA;
    this.globalEnvD = preset.globalEnvD;
    this.globalEnvS = preset.globalEnvS;
    this.globalEnvR = preset.globalEnvR;
    this.globalVolume = preset.globalVolume;
    for (const s of preset.samples) this.samples.push({ ...s, buffer: null });
  }

  deletePreset(id: string) { this.presets = this.presets.filter(p => p.id !== id); }

  private findClosest(midi: number): OneShotSample | null {
    if (this.samples.length === 0) return null;
    return this.samples.reduce((prev, curr) =>
      Math.abs(curr.midiNote - midi) < Math.abs(prev.midiNote - midi) ? curr : prev
    );
  }

  dispose() {
    this.releaseAll();
    this.voicePool.forEach(v => {
      try { v.player.dispose(); } catch {}
      try { v.gainNode.dispose(); } catch {}
      try { v.env.dispose(); } catch {}
    });
    this.voicePool = [];
    this.samples = [];
    this.presets = [];
  }
}

export const oneShotSampler = new OneShotSampler();
