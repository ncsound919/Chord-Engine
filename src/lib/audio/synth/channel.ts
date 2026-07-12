import * as Tone from 'tone';
import { audioEngine } from '../engine';
import type { Ju60Params } from './params';
import { sanitizePatch } from './params';
import { Ju60Voice } from './voice';
import { Ju60Arpeggiator, CHORUS_MODE_SETTINGS } from './arp';

export class Ju60Channel {
  readonly voices: Ju60Voice[] = [];
  readonly chorus:  Tone.Chorus;
  readonly volume:  Tone.Volume;
  readonly arpeggiator: Ju60Arpeggiator;
  patch: Ju60Params;

  private maxVoices = 8;
  private _voiceMap = new Map<number, Ju60Voice>();

  constructor(trackName: string, initialPatch: Ju60Params) {
    this.patch = sanitizePatch(initialPatch);
    this.volume = new Tone.Volume(Tone.gainToDb(this.patch.vcaLevel / 100));

    this.chorus = new Tone.Chorus({
      frequency: 1.5, delayTime: 2.5, depth: 0.4, feedback: 0, type: 'sine',
    }).start();

    const track = audioEngine?.tracks?.get(trackName);
    if (!track) {
      console.debug(`[Ju60Engine] Track "${trackName}" not found; routing to master output.`);
    }
    const destination = track?.inputGain ?? Tone.getDestination();

    this.chorus.connect(this.volume);
    this.volume.connect(destination as Tone.InputNode);

    this.applyChorusMode(this.patch.chorus);

    for (let i = 0; i < this.maxVoices; i++) {
      this.voices.push(new Ju60Voice(this.chorus, this.patch));
    }

    this.arpeggiator = new Ju60Arpeggiator(
      (midi: number, time: number) => this._triggerVoiceOn(midi, time),
      (midi: number, time: number) => this._triggerVoiceOff(midi, time),
    );
  }

  private _triggerVoiceOn(midi: number, time: number, velocity = 0.8) {
    if (this.patch.voiceMode === 'MONO') {
      const v = this.voices[0];
      const isLegato = v.activeMidi !== null;
      v.triggerAttack(midi, time, velocity, isLegato);
      this._voiceMap.set(midi, v);
      return;
    }
    let voice = this._voiceMap.get(midi) ?? null;
    if (!voice || voice.activeMidi !== midi) {
      voice = this.voices.find(v => v.activeMidi === null) ?? null;
    }
    if (!voice) {
      voice = this.voices.reduce(
        (oldest, cur) => cur.startTime < oldest.startTime ? cur : oldest,
        this.voices[0],
      );
      voice.steal(time);
    }
    voice.triggerAttack(midi, time, velocity);
    this._voiceMap.set(midi, voice);
  }

  private _triggerVoiceOff(midi: number, time: number) {
    if (this.patch.voiceMode === 'MONO') {
      if (this.voices[0].activeMidi === midi) {
        this.voices[0].triggerRelease(time);
        this._voiceMap.delete(midi);
      }
      return;
    }
    const voice = this._voiceMap.get(midi);
    if (voice && voice.activeMidi === midi) {
      voice.triggerRelease(time);
      this._voiceMap.delete(midi);
    } else if (voice) {
      // Stale entry — voice was released outside _triggerVoiceOff
      this._voiceMap.delete(midi);
    }
  }

  applyChorusMode(mode: Ju60Params['chorus']) {
    const now = Tone.now();
    const settings = CHORUS_MODE_SETTINGS[mode];
    this.chorus.wet.rampTo(settings.wet, 0.03, now);
    this.chorus.frequency.rampTo(settings.frequency, 0.03, now);
    this.chorus.depth = settings.depth;
  }

  triggerNoteOn(midi: number, time = Tone.now(), velocity = 0.8) {
    if (this.patch.arpMode && this.patch.arpMode !== 'OFF') {
      this.arpeggiator.addNote(midi, time);
      return;
    }
    this._triggerVoiceOn(midi, time, velocity);
  }

  triggerNoteOff(midi: number, time = Tone.now()) {
    if (this.patch.arpMode && this.patch.arpMode !== 'OFF') {
      this.arpeggiator.removeNote(midi);
      return;
    }
    this._triggerVoiceOff(midi, time);
  }

  updatePatch(patch: Partial<Ju60Params>) {
    this.patch = sanitizePatch({ ...this.patch, ...patch });
    this.voices.forEach(v => (v.patch = this.patch));
    if (patch.chorus !== undefined) this.applyChorusMode(this.patch.chorus);
    if (patch.arpMode !== undefined) this.arpeggiator.mode = this.patch.arpMode!;
    if (patch.arpRate !== undefined) {
      const rateDiv = 1 + Math.round(((this.patch.arpRate ?? 50) / 100) * 15);
      this.arpeggiator.rate = rateDiv;
    }
    if (patch.arpOctaveRange !== undefined) {
      this.arpeggiator.octaveRange = (this.patch.arpOctaveRange ?? 0) + 1;
    }
    if (patch.arpGate !== undefined) {
      this.arpeggiator.gate = (this.patch.arpGate ?? 80) / 100;
    }
    this.volume.volume.rampTo(
      Tone.gainToDb(Math.max(0.0001, this.patch.vcaLevel / 100)), 0.05,
    );
  }

  releaseAll() {
    const now = Tone.now();
    this.arpeggiator.allNotesOff();
    this.voices.forEach(v => { if (v.activeMidi !== null) v.triggerRelease(now); });
    this._voiceMap.clear();
  }

  dispose() {
    this.arpeggiator.allNotesOff();
    this.voices.forEach(v => v.dispose());
    this.chorus.dispose();
    this.volume.dispose();
    this._voiceMap.clear();
  }
}
