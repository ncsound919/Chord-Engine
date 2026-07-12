import * as Tone from 'tone';
import type { Ju60Params } from './params';
import { sanitizePatch, DEFAULT_PATCH } from './params';
import { Ju60Channel } from './channel';

const DEFAULT_CHANNELS = [
  { id: 'lead', track: 'synth-lead' },
  { id: 'pad', track: 'synth-pad' },
  { id: 'bass', track: 'synth-bass' },
] as const;

export class Ju60Engine {
  private static instance: Ju60Engine;
  private channels = new Map<string, Ju60Channel>();
  private patchListeners = new Set<(id: string, patch: Ju60Params) => void>();
  private _initialized = false;

  private constructor() {}

  private _ensureDefaults() {
    if (this._initialized) return;
    this._initialized = true;
    for (const { id, track } of DEFAULT_CHANNELS) {
      const patch = id === 'lead' ? { ...DEFAULT_PATCH } :
        id === 'pad' ? { ...DEFAULT_PATCH, vcfCutoff: 40, envA: 60, envR: 60 } :
        { ...DEFAULT_PATCH, dcoRange: '16\'' as const, vcfCutoff: 30, vcaMode: 'GATE' as const };
      this.channels.set(id, new Ju60Channel(track, sanitizePatch(patch)));
    }
  }

  static getInstance(): Ju60Engine {
    if (!Ju60Engine.instance) {
      Ju60Engine.instance = new Ju60Engine();
      Ju60Engine.instance._ensureDefaults();
    }
    return Ju60Engine.instance;
  }

  static resetInstance() {
    if (Ju60Engine.instance) {
      Ju60Engine.instance.dispose();
      Ju60Engine.instance = undefined as unknown as Ju60Engine;
    }
  }

  initDefaults() { this._ensureDefaults(); }

  setupChannel(id: string, trackName: string, initialPatch: Ju60Params) {
    this.disposeChannel(id);
    this.channels.set(id, new Ju60Channel(trackName, sanitizePatch(initialPatch)));
  }

  disposeChannel(id: string) {
    const channel = this.channels.get(id);
    if (channel) {
      channel.dispose();
      this.channels.delete(id);
    }
  }

  updatePatch(id: string, patch: Partial<Ju60Params>) {
    const channel = this.channels.get(id);
    if (!channel) return;
    channel.updatePatch(patch);
    this.emitPatchUpdate(id, channel.patch);
  }

  triggerNote(id: string, midi: number, velocity = 0.8, time: number = Tone.now(), duration = 0.5) {
    const chan = this.channels.get(id);
    if (!chan) return;
    chan.triggerNoteOn(midi, time, velocity);
    chan.triggerNoteOff(midi, time + duration);
  }

  triggerNoteOn(id: string, midi: number, time = Tone.now()) {
    this.channels.get(id)?.triggerNoteOn(midi, time);
  }

  triggerNoteOff(id: string, midi: number, time = Tone.now()) {
    this.channels.get(id)?.triggerNoteOff(midi, time);
  }

  allNotesOff() {
    this.channels.forEach(chan => chan.releaseAll());
  }

  getPatch(id: string): Ju60Params | undefined {
    return this.channels.get(id)?.patch;
  }

  getAllPatches(): Record<string, Ju60Params> {
    const out: Record<string, Ju60Params> = {};
    this.channels.forEach((chan, id) => (out[id] = chan.patch));
    return out;
  }

  onPatchUpdate(listener: (id: string, patch: Ju60Params) => void) {
    this.patchListeners.add(listener);
    return () => { this.patchListeners.delete(listener); };
  }

  private emitPatchUpdate(id: string, patch: Ju60Params) {
    this.patchListeners.forEach(fn => fn(id, patch));
  }

  dispose() {
    this.channels.forEach(channel => channel.dispose());
    this.channels.clear();
    this._initialized = false;
  }
}
