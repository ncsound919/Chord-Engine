import * as Tone from 'tone';

// ──────────────────────────────────────────────────────────────
// Core Audio Engine – tone.js based, with per‑track sends,
// solo logic, and async‑safe initialization.
// ──────────────────────────────────────────────────────────────
export class AudioEngine {
  public readonly ctx: AudioContext;
  public readonly dryGain: Tone.Volume;
  public readonly soloBus: Tone.Gain;          // isolated solo mix bus
  public readonly masterLimiter: Tone.Limiter;
  public readonly masterReverb: Tone.Reverb;
  public readonly reverbBus: Tone.Gain;
  public readonly masterAnalyser: Tone.Analyser;
  public readonly rmsAnalyser: Tone.Analyser;   // time-domain for RMS metering
  public readonly tracks: Map<string, Track> = new Map();
  public readonly loadedSamples: Map<string, Tone.ToneAudioBuffer> = new Map();
  public drumKit: Record<string, string> = {};

  /** Default drum name → sample filename mapping for the built-in soundbank. */
  public static readonly DEFAULT_DRUM_NAMES: Record<string, string> = {
    'Kick': 'Fudda Kick 1.wav',
    'Snare': 'Steady Snr 1.wav',
    'Hi-Hat Closed': 'Fudda Hat 1.wav',
    'Hi-Hat Open': 'Fudda Open Hat 1.wav',
    'Crash': 'Fudda Crash.wav',
    'Ride': 'Ride.wav',
    'Tom 1': 'Killer Tom 1.wav',
    'Tom 2': 'Killer Tom 2.wav',
    'Tom 3': 'Killer Tom 3.wav',
  };

  /** Resolves when the reverb impulse is fully generated. */
  public readonly ready: Promise<void>;

  private _soloActive = false;

  public static readonly DEFAULT_TRACKS = [
    'drums', 'bass', 'lead', 'pads', 'keys', 'guitar',
  ];

  /** Drum submix tracks for per-drum level control via mixer drum tab */
  public static readonly DRUM_SUBMIX_TRACKS = ['kick', 'snare', 'hihat', 'toms', 'overhead'];

  /** Sampler tracks for one-shot and multi-sample instruments */
  public static readonly SAMPLER_TRACKS = ['oneshots', 'guitar-sampler', 'keys-sampler'];

  constructor() {
    this.ctx = Tone.getContext().rawContext as AudioContext;

    // ── Master chain ────────────────────────────────
    this.masterLimiter = new Tone.Limiter(-1).toDestination();

    // Solo bus: soloed tracks route here instead of dry master
    this.soloBus = new Tone.Gain(0).connect(this.masterLimiter);

    // Reverb bus: receives per‑track sends, feeds fully‑wet reverb
    // Bus is at unity — individual track send levels control the mix amount.
    this.reverbBus = new Tone.Gain(1);
    this.masterReverb = new Tone.Reverb({
      decay: 1.5,
      preDelay: 0.01,
      wet: 1,          // fully wet – send level is controlled per track
    }).connect(this.masterLimiter);
    this.reverbBus.connect(this.masterReverb);

    // Dry master: all track dry signals sum here
    this.dryGain = new Tone.Volume(0).connect(this.masterLimiter);

    // Master Analyser (FFT for spectrum display)
    this.masterAnalyser = new Tone.Analyser('fft', 32);
    this.masterLimiter.connect(this.masterAnalyser);

    // RMS Analyser (waveform for metering)
    this.rmsAnalyser = new Tone.Analyser('waveform', 1024);
    this.masterLimiter.connect(this.rmsAnalyser);

    // Async readiness – reverb must be ready before playback
    this.ready = this.masterReverb.ready.then(() => {});

    // Create default tracks — main + submix buses + sampler
    AudioEngine.DEFAULT_TRACKS.forEach(name => this.addTrack(name));

    // Drum submix tracks route INTO the drums bus so the main drums fader
    // controls the entire kit while individual submix strips stay useful.
    const drumBus = this.tracks.get('drums');
    AudioEngine.DRUM_SUBMIX_TRACKS.forEach(name => this.addTrack(name, drumBus?.inputGain));

    AudioEngine.SAMPLER_TRACKS.forEach(name => this.addTrack(name));

    // Drums bus has its own reverb send disabled since submix children
    // already provide per-drum reverb control via their own sends.
    drumBus?.setReverbSend(0);

    // Populate default drum name mappings
    Object.assign(this.drumKit, AudioEngine.DEFAULT_DRUM_NAMES);
  }

  // ── Track management ────────────────────────────────
  addTrack(name: string, outputDestination?: Tone.ToneAudioNode): Track {
    if (this.tracks.has(name)) return this.tracks.get(name)!;
    const track = new Track(name, this.dryGain, this.reverbBus, this, outputDestination);
    this.tracks.set(name, track);
    return track;
  }

  removeTrack(name: string): boolean {
    const track = this.tracks.get(name);
    if (!track) return false;
    track.dispose();
    return this.tracks.delete(name);
  }

  // ── Solo coordination ──────────────────────────────
  get soloActive(): boolean { return this._soloActive; }

  private _soloChangePending = false;

  /** Called when any track changes its solo state – updates all tracks. */
  _onSoloChange() {
    this._soloActive = Array.from(this.tracks.values()).some(t => t.isSolo);
    if (!this._soloChangePending) {
      this._soloChangePending = true;
      queueMicrotask(() => {
        this._soloChangePending = false;
        this.tracks.forEach(track => track._updateSoloState(this._soloActive));
      });
    }
  }

  // ── Global controls ────────────────────────────────
  setMasterVolume(value: number) {
    this.dryGain.volume.setTargetAtTime(Tone.gainToDb(value), Tone.now(), 0.1);
  }

  setReverbDecay(decay: number) {
    this.masterReverb.decay = decay;
    // Note: changing decay re‑generates the impulse response.
    // Await this.masterReverb.ready again if precise timing is needed.
  }

  // ── Sample loading ─────────────────────────────────
  async loadSample(name: string, file: File): Promise<Tone.ToneAudioBuffer> {
    // Dispose any existing buffer with the same name to avoid memory leaks
    const old = this.loadedSamples.get(name);
    old?.dispose();

    const url = URL.createObjectURL(file);
    const buffer = new Tone.ToneAudioBuffer();

    try {
      await buffer.load(url);
      this.loadedSamples.set(name, buffer);
      this.drumKit[name] = file.name;
      return buffer;
    } finally {
      URL.revokeObjectURL(url);
    }
  }

  async loadSampleFromBuffer(name: string, arrayBuffer: ArrayBuffer, filename: string, mimeType: string): Promise<Tone.ToneAudioBuffer> {
    const old = this.loadedSamples.get(name);
    old?.dispose();

    const blob = new Blob([arrayBuffer], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const buffer = new Tone.ToneAudioBuffer();

    try {
      await buffer.load(url);
      this.loadedSamples.set(name, buffer);
      this.drumKit[name] = filename;
      return buffer;
    } finally {
      URL.revokeObjectURL(url);
    }
  }

  async loadSampleFromUrl(name: string, url: string, filename?: string): Promise<Tone.ToneAudioBuffer> {
    const old = this.loadedSamples.get(name);
    old?.dispose();

    const buffer = new Tone.ToneAudioBuffer();
    try {
      await buffer.load(url);
      this.loadedSamples.set(name, buffer);
      this.drumKit[name] = filename || url.split('/').pop() || name;
      return buffer;
    } catch (e) {
      console.error(`Failed to load sample from URL: ${url}`, e);
      throw e;
    }
  }

  // ── Context helpers ────────────────────────────────
  async start() {
    if (Tone.getContext().state !== 'running') {
      await Tone.start();
    }
    // Try to await reverb, but don't block forever if it fails
    try {
      await Promise.race([this.ready, new Promise(resolve => setTimeout(resolve, 500))]);
    } catch(e) {}
  }

  async resume() { return this.start(); }
}

// ──────────────────────────────────────────────────────────────
// Transport – wraps Tone.Transport, fires beat callbacks
// with accurate position even after tempo changes.
// ──────────────────────────────────────────────────────────────
export interface TransportState {
  isPlaying: boolean;
  tempo: number;
  beat: number;
}

export class Transport {
  private _listeners = new Set<(state: TransportState) => void>();
  private _beatCallbacks: ((beat: number, time: number) => void)[] = [];
  private _stopCallbacks: (() => void)[] = [];
  private _repeatEventId: string | number | null = null;

  constructor(private engine: AudioEngine) {
    Tone.getTransport().bpm.value = 85;
    this._repeatEventId = Tone.getTransport().scheduleRepeat((time) => {
      const beat = this.getCurrentBeat();
      this._beatCallbacks.forEach(cb => cb(beat, time));
      this._notify();
    }, '16n');
  }

  /** Register a beat callback. Returns unsubscribe function. */
  addBeatCallback(cb: (beat: number, time: number) => void) {
    this._beatCallbacks.push(cb);
    return () => {
      const idx = this._beatCallbacks.indexOf(cb);
      if (idx !== -1) this._beatCallbacks.splice(idx, 1);
    };
  }

  /** Register a stop callback. Returns unsubscribe function. */
  addStopCallback(cb: () => void) {
    this._stopCallbacks.push(cb);
    return () => {
      const idx = this._stopCallbacks.indexOf(cb);
      if (idx !== -1) this._stopCallbacks.splice(idx, 1);
    };
  }

  get isPlaying() { return Tone.getTransport().state === 'started'; }
  get tempo() { return Tone.getTransport().bpm.value; }
  set tempo(v: number) {
    Tone.getTransport().bpm.value = v;
    this._notify();
  }

  async start() {
    await this.engine.start();
    Tone.getTransport().start();
    this._notify();
  }

  stop() {
    Tone.getTransport().stop();
    this._stopCallbacks.forEach(cb => cb());
    this._notify();
  }

  /** Stops transport, cancels all scheduled events, resets to beat 0. */
  reset() {
    Tone.getTransport().stop();
    Tone.getTransport().cancel(0);
    Tone.getTransport().seconds = 0;
    this._notify();
  }

  toggle() {
    this.isPlaying ? this.stop() : this.start();
  }

  /** Returns the current beat position using Tone’s own transport position. */
  getCurrentBeat(): number {
    const pos = Tone.getTransport().position as string; // e.g. "3:2:0"
    const [bars, beats, sixteenths] = pos.split(':').map(Number);
    const beatsPerBar = Tone.getTransport().timeSignature as number;
    return bars * beatsPerBar + beats + sixteenths / 4;
  }

  subscribe(cb: (state: TransportState) => void) {
    this._listeners.add(cb);
    return () => this._listeners.delete(cb);
  }

  private _notify() {
    const state: TransportState = {
      isPlaying: this.isPlaying,
      tempo: this.tempo,
      beat: this.getCurrentBeat(),
    };
    this._listeners.forEach(cb => cb(state));
  }
}

// ──────────────────────────────────────────────────────────────
// Track – per‑instrument strip with volume, pan, filter, send & solo
// ──────────────────────────────────────────────────────────────
export class Track {
  public readonly name: string;
  public readonly inputGain: Tone.Gain;       // entry point for synths/players
  public readonly filter: Tone.Filter;
  public readonly eqHigh: Tone.EQ3;
  public readonly trimNode: Tone.Gain;
  public readonly analyser: Tone.Analyser;
  public readonly panner: Tone.Panner;
  public readonly volumeNode: Tone.Volume;    // final output level
  public readonly reverbSend: Tone.Gain;      // send amount to global reverb

  public isMuted = false;
  public isSolo = false;

  private _volumeLinear = 0.8;   // linear 0‑1.2
  private _panValue = 0;         // -1..1
  private _engine: AudioEngine;
  private _mutedEffective = false;

  // Use a very low dB floor instead of -Infinity to avoid NaN ramps
  private static readonly SILENT_DB = -100;

  constructor(
    name: string,
    dryMaster: Tone.Volume,
    reverbBus: Tone.Gain,
    engine: AudioEngine,
    outputDestination?: Tone.ToneAudioNode,
  ) {
    this.name = name;
    this._engine = engine;

    // ── Node chain: inputGain -> trimNode -> eqHigh -> filter -> panner -> volumeNode -> destination
    this.inputGain = new Tone.Gain(1);
    this.trimNode = new Tone.Gain(1);
    this.eqHigh = new Tone.EQ3(0, 0, 0);
    this.filter = new Tone.Filter(20000, 'lowpass');
    this.analyser = new Tone.Analyser('fft', 32);
    this.panner = new Tone.Panner(0);
    this.volumeNode = new Tone.Volume(0); // 0 dB

    this.inputGain.chain(this.trimNode, this.eqHigh, this.filter, this.panner, this.volumeNode);

    // Route to parent bus if provided, otherwise to master dryGain
    const destination = outputDestination ?? dryMaster;
    this.volumeNode.connect(destination);
    this.volumeNode.connect(this.analyser);

    // ── Reverb send (post‑panner, pre‑volume) ────────
    this.reverbSend = new Tone.Gain(0);
    this.panner.connect(this.reverbSend);
    this.reverbSend.connect(reverbBus);

    // Initial levels
    this.setVolume(0.8);
    this.setPan(0);
  }

  // ── Linear volume (0…1.2) ─────────────────────────
  get volume(): number { return this._volumeLinear; }

  setVolume(value: number, rampTime = 0.1) {
    this._volumeLinear = Math.max(0, Math.min(1.2, value));

    const db = this._mutedEffective
      ? Track.SILENT_DB
      : Tone.gainToDb(Math.max(0.0001, this._volumeLinear));

    this.volumeNode.volume.setTargetAtTime(db, Tone.now(), rampTime);
  }

  // ── Pan (-1…1) ────────────────────────────────────
  get pan(): number { return this._panValue; }

  setPan(value: number, rampTime = 0.1) {
    this._panValue = Math.max(-1, Math.min(1, value));
    this.panner.pan.setTargetAtTime(this._panValue, Tone.now(), rampTime);
  }

  // ── EQ & Trim ─────────────────────────────────────
  setTrim(db: number, rampTime = 0.1) {
    this.trimNode.gain.setTargetAtTime(Tone.dbToGain(db), Tone.now(), rampTime);
  }

  setEQ(high: number, low: number, rampTime = 0.1) {
    this.eqHigh.high.setTargetAtTime(high, Tone.now(), rampTime);
    this.eqHigh.low.setTargetAtTime(low, Tone.now(), rampTime);
  }

  // ── Filter ─────────────────────────────────────────
  setFilterFreq(freq: number, rampTime = 0.1) {
    this.filter.frequency.setTargetAtTime(freq, Tone.now(), rampTime);
  }

  // ── Reverb send (0…1) ─────────────────────────────
  setReverbSend(value: number, rampTime = 0.1) {
    const clamped = Math.max(0, Math.min(1, value));
    this.reverbSend.gain.setTargetAtTime(clamped, Tone.now(), rampTime);
  }

  // ── Mute / Solo ────────────────────────────────────
  setMute(muted: boolean) {
    this.isMuted = muted;
    this._engine._onSoloChange();
  }

  setSolo(soloed: boolean) {
    this.isSolo = soloed;
    this._engine._onSoloChange();
  }

  /** Called by engine when any track’s solo state changes */
  _updateSoloState(soloActive: boolean) {
    const shouldBeSilent = this.isMuted || (soloActive && !this.isSolo);
    if (shouldBeSilent !== this._mutedEffective) {
      this._mutedEffective = shouldBeSilent;
      this.setVolume(this._volumeLinear); // re‑apply with new mute state
    }
  }

  // ── Playback methods ───────────────────────────────

  /** Play a sample through this track, disposing deterministically. */
  playBuffer(
    buffer: Tone.ToneAudioBuffer,
    time: number = Tone.now(),
    offset = 0,
    duration?: number
  ) {
    const player = new Tone.Player(buffer).connect(this.inputGain);
    const playDuration = duration ?? buffer.duration - offset;

    player.start(time, offset, duration);

    // Schedule disposal after the audio will be finished,
    // accounting for possible future start time.
    const nowOffset = Math.max(0, (time - Tone.now())) * 1000;
    const totalDelay = nowOffset + (playDuration + 0.05) * 1000;

    setTimeout(() => {
      player.dispose();
    }, totalDelay);
  }

  /** Play a sample pitch-shifted (via playback rate) through this track, disposing deterministically. */
  playBufferShifted(
    buffer: Tone.ToneAudioBuffer,
    playbackRate: number,
    time: number = Tone.now(),
    offset = 0,
    duration?: number,
    gain = 1,
  ) {
    const noteGain = new Tone.Gain(
      Math.max(0, Math.min(1, gain)),
    ).connect(this.inputGain);

    const player = new Tone.Player(buffer).connect(noteGain);
    player.playbackRate = playbackRate;

    const playDuration = duration ?? Math.max(0.01, buffer.duration / playbackRate - offset);
    player.start(time, offset, playDuration);

    const nowOffset = Math.max(0, time - Tone.now()) * 1000;
    const totalDelay = nowOffset + (playDuration + 0.1) * 1000;

    setTimeout(() => {
      player.dispose();
      noteGain.dispose();
    }, totalDelay);
  }

  /** Short oscillator burst – used for synthesized drums. */
  playOscillator(
    freq: number,
    type: Tone.ToneOscillatorType = 'sine',
    time: number = Tone.now(),
    duration: number = 0.1
  ) {
    const osc = new Tone.Oscillator(freq, type).connect(this.inputGain);
    osc.start(time).stop(time + duration);

    const nowOffset = Math.max(0, (time - Tone.now())) * 1000;
    const totalDelay = nowOffset + (duration + 0.05) * 1000;

    setTimeout(() => {
      osc.dispose();
    }, totalDelay);
  }

  /**
   * Play a note with a full ADSR envelope.
   * Used by the sequencer for melodic parts.
   */
  playNote(
    freq: number,
    type: Tone.ToneOscillatorType,
    time: number,
    duration: number,
    envelope: {
      attack: number;
      decay: number;
      sustain: number;
      release: number;
    } = { attack: 0.01, decay: 0.1, sustain: 0, release: 0.1 }
  ) {
    const osc = new Tone.Oscillator(freq, type).start(time);
    const env = new Tone.AmplitudeEnvelope(envelope).connect(this.inputGain);

    osc.connect(env);
    env.triggerAttackRelease(duration, time);

    const nowOffset = Math.max(0, (time - Tone.now())) * 1000;
    const totalDelay = nowOffset + (duration + envelope.release + 0.1) * 1000;

    setTimeout(() => {
      osc.dispose();
      env.dispose();
    }, totalDelay);
  }

  /** Full cleanup – disconnect then dispose all nodes. */
  dispose() {
    // Disconnect from shared buses to avoid dangling references
    this.inputGain.disconnect();
    this.trimNode.disconnect();
    this.eqHigh.disconnect();
    this.filter.disconnect();
    this.analyser.disconnect();
    this.panner.disconnect();
    this.volumeNode.disconnect();
    this.reverbSend.disconnect();

    // Dispose (which also disconnects remaining connections)
    this.inputGain.dispose();
    this.trimNode.dispose();
    this.eqHigh.dispose();
    this.filter.dispose();
    this.analyser.dispose();
    this.panner.dispose();
    this.volumeNode.dispose();
    this.reverbSend.dispose();
  }
}

// ──────────────────────────────────────────────────────────────
// Singleton instances – guarded against HMR duplicates in dev
// ──────────────────────────────────────────────────────────────
declare global {
  var __AUDIO_ENGINE__: AudioEngine | undefined;
  var __TRANSPORT__: Transport | undefined;
}

export const audioEngine =
  globalThis.__AUDIO_ENGINE__ ?? new AudioEngine();

export const transport =
  globalThis.__TRANSPORT__ ?? new Transport(audioEngine);

export const MAIN_TRACKS = AudioEngine.DEFAULT_TRACKS;

export function getTrack(trackId: string): Track | null {
  return audioEngine?.tracks?.get(trackId) ?? null;
}

if (typeof import.meta !== 'undefined' && (import.meta as any).env?.DEV) {
  globalThis.__AUDIO_ENGINE__ = audioEngine;
  globalThis.__TRANSPORT__ = transport;
}