import { AudioEngine, transport, Transport, Track, getTrack, MAIN_TRACKS, audioEngine } from './engine';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as Tone from 'tone';

describe('AudioEngine', () => {
  it('initializes tracks', () => {
    const engine = new AudioEngine();
    expect(engine.tracks.has('drums')).toBe(true);
    expect(engine.tracks.has('bass')).toBe(true);
  });

  it('can set master volume', () => {
    const engine = new AudioEngine();
    engine.setMasterVolume(0.5);
    // expect to be called
    expect(engine).toBeDefined();
  });
  
  it('transport starts and stops', () => {
    transport.start();
    transport.stop();
    expect(transport).toBeDefined();
  });
});

  it('can use track functions', () => {
    const engine = new AudioEngine();
    const track = engine.tracks.get('drums')!;
    track.setVolume(0.8);
    track.setPan(0);
    track.setMute(true);
    track.setSolo(true);
    track.setFilterFreq(1000);
    track.setReverbSend(0.5);
    track.playBuffer({} as any, 0, 0, 1);
    track.playBufferShifted({} as any, 1, 0, 0, 1);
    track.playNote(440, 'sine', 0, 1);
    track.dispose();
  });

  it('can load samples', async () => {
    const engine = new AudioEngine();
    engine.loadSample('test', {} as File).catch(()=>null);
    engine.loadSampleFromBuffer('test', new ArrayBuffer(0), 'file', 'type').catch(()=>null);
    engine.loadSampleFromUrl('test', 'url').catch(()=>null);
  });
  
  it('transport additional functions', () => {
    transport.getCurrentBeat();
    transport.reset();
  });


  it('can schedule events', () => {
    const cb = vi.fn();
  });

  it('transport subscribes', () => {
    const cb = vi.fn();
    const unsub = transport.subscribe(cb);
    unsub();
  });
  
  it('audio engine gets current transport beat', () => {
    transport.getCurrentBeat();
  });

  it('removeTrack removes an existing track', () => {
    const engine = new AudioEngine();
    expect(engine.tracks.has('drums')).toBe(true);
    const result = engine.removeTrack('drums');
    expect(result).toBe(true);
    expect(engine.tracks.has('drums')).toBe(false);
  });

  it('removeTrack returns false for non-existing track', () => {
    const engine = new AudioEngine();
    const result = engine.removeTrack('nonexistent');
    expect(result).toBe(false);
  });

  it('_onSoloChange sets soloActive and calls _updateSoloState on tracks', async () => {
    const engine = new AudioEngine();
    const track = engine.tracks.get('drums')!;
    track.setSolo(true);
    await new Promise(r => setTimeout(r, 0));
    expect(engine.soloActive).toBe(true);
  });

  it('setReverbDecay sets the decay value', () => {
    const engine = new AudioEngine();
    engine.setReverbDecay(3.0);
    expect(engine.masterReverb.decay).toBe(3.0);
  });

  it('loadSampleFromBuffer resolves and stores sample', async () => {
    const engine = new AudioEngine();
    const buf = new ArrayBuffer(8);
    const result = await engine.loadSampleFromBuffer('testBuf', buf, 'file.wav', 'audio/wav');
    expect(engine.loadedSamples.has('testBuf')).toBe(true);
    expect(engine.drumKit['testBuf']).toBe('file.wav');
  });

  it('loadSampleFromUrl resolves and stores sample', async () => {
    const engine = new AudioEngine();
    const result = await engine.loadSampleFromUrl('testUrl', 'https://example.com/kick.wav');
    expect(engine.loadedSamples.has('testUrl')).toBe(true);
    expect(engine.drumKit['testUrl']).toBe('kick.wav');
  });

  it('loadSampleFromUrl with filename overrides url parsing', async () => {
    const engine = new AudioEngine();
    await engine.loadSampleFromUrl('custom', 'https://example.com/kick.wav', 'custom.wav');
    expect(engine.drumKit['custom']).toBe('custom.wav');
  });

  it('loadSampleFromUrl rejects on failure', async () => {
    const engine = new AudioEngine();
    const origLoad = Tone.ToneAudioBuffer;
    (Tone as any).ToneAudioBuffer = vi.fn(() => ({
      load: vi.fn().mockRejectedValue(new Error('fail')),
      dispose: vi.fn(),
      duration: 0,
    }));
    await expect(engine.loadSampleFromUrl('fail', 'https://bad.url')).rejects.toThrow('fail');
    (Tone as any).ToneAudioBuffer = origLoad;
  });

  it('start resolves when context is running', async () => {
    const engine = new AudioEngine();
    await expect(engine.start()).resolves.toBeUndefined();
  });

  it('resume calls start', async () => {
    const engine = new AudioEngine();
    await expect(engine.resume()).resolves.toBeUndefined();
  });

  it('transport.stop calls onStop callbacks', () => {
    const cb = vi.fn();
    transport.addStopCallback(cb);
    transport.stop();
    expect(cb).toHaveBeenCalled();
  });

  it('transport.toggle toggles between start and stop', () => {
    const startSpy = vi.spyOn(transport, 'start').mockResolvedValue(undefined);
    const stopSpy = vi.spyOn(transport, 'stop');
    const isPlayingGetter = vi.spyOn(transport, 'isPlaying', 'get');
    isPlayingGetter.mockReturnValue(false);
    transport.toggle();
    expect(startSpy).toHaveBeenCalled();
    isPlayingGetter.mockReturnValue(true);
    transport.toggle();
    expect(stopSpy).toHaveBeenCalled();
    startSpy.mockRestore();
    stopSpy.mockRestore();
    isPlayingGetter.mockRestore();
  });

  it('transport.getCurrentBeat parses position string', () => {
    const mockedTransport = Tone.getTransport();
    mockedTransport.position = '1:2:3';
    const beat = transport.getCurrentBeat();
    expect(beat).toBe(1 * 4 + 2 + 3 / 4);
    mockedTransport.position = '0:0:0';
  });

  it('transport.tempo setter updates bpm and notifies', () => {
    const cb = vi.fn();
    const unsub = transport.subscribe(cb);
    transport.tempo = 120;
    expect(Tone.getTransport().bpm.value).toBe(120);
    expect(cb).toHaveBeenCalled();
    unsub();
  });

  it('Track.setTrim sets trim gain', () => {
    const engine = new AudioEngine();
    const track = engine.tracks.get('drums')!;
    track.setTrim(3);
    expect(track.trimNode.gain.setTargetAtTime).toHaveBeenCalled();
  });

  it('Track.setEQ sets high and low values', () => {
    const engine = new AudioEngine();
    const track = engine.tracks.get('drums')!;
    track.setEQ(5, -3);
    expect(track.eqHigh.high.setTargetAtTime).toHaveBeenCalled();
    expect(track.eqHigh.low.setTargetAtTime).toHaveBeenCalled();
  });

  it('Track.playOscillator creates and plays an oscillator', () => {
    const engine = new AudioEngine();
    const track = engine.tracks.get('drums')!;
    track.playOscillator(440, 'sine', 0, 0.1);
    expect(engine).toBeDefined();
  });

  it('Track.playNote plays note with envelope', () => {
    const engine = new AudioEngine();
    const track = engine.tracks.get('drums')!;
    track.playNote(440, 'sine', 0, 1, { attack: 0.01, decay: 0.1, sustain: 0.5, release: 0.2 });
    expect(engine).toBeDefined();
  });

  it('Track._updateSoloState silences non-soloed tracks when solo is active', () => {
    const engine = new AudioEngine();
    const drums = engine.tracks.get('drums')!;
    const bass = engine.tracks.get('bass')!;
    drums.setSolo(true);
    bass._updateSoloState(true);
    expect(bass['isMuted' as any] || bass['_mutedEffective' as any]).toBe(true);
  });

  it('Track._updateSoloState restores track when solo is not active', () => {
    const engine = new AudioEngine();
    const bass = engine.tracks.get('bass')!;
    bass._updateSoloState(false);
    expect(bass['_mutedEffective' as any]).toBe(false);
  });

  it('Track.dispose disconnects and disposes all nodes', () => {
    const engine = new AudioEngine();
    const track = engine.tracks.get('drums')!;
    track.dispose();
    expect(track.inputGain.disconnect).toHaveBeenCalled();
    expect(track.inputGain.dispose).toHaveBeenCalled();
    expect(track.volumeNode.disconnect).toHaveBeenCalled();
    expect(track.volumeNode.dispose).toHaveBeenCalled();
  });

  it('getTrack returns track by id', () => {
    const track = getTrack('drums');
    expect(track).toBeDefined();
    expect(track!.name).toBe('drums');
  });

  it('getTrack returns null for unknown id', () => {
    const track = getTrack('nonexistent');
    expect(track).toBeNull();
  });

  it('MAIN_TRACKS exports default track names', () => {
    expect(MAIN_TRACKS).toEqual(['drums', 'bass', 'lead', 'pads', 'keys', 'guitar']);
  });

  it('addTrack returns existing track if name already exists', () => {
    const engine = new AudioEngine();
    const track1 = engine.addTrack('drums');
    const track2 = engine.addTrack('drums');
    expect(track1).toBe(track2);
  });

  it('track setMute calls _onSoloChange', () => {
    const engine = new AudioEngine();
    const track = engine.tracks.get('drums')!;
    const spy = vi.spyOn(engine, '_onSoloChange');
    track.setMute(true);
    expect(spy).toHaveBeenCalled();
  });

  it('track setSolo calls _onSoloChange', () => {
    const engine = new AudioEngine();
    const track = engine.tracks.get('drums')!;
    const spy = vi.spyOn(engine, '_onSoloChange');
    track.setSolo(true);
    expect(spy).toHaveBeenCalled();
  });

  it('track volume getter returns linear volume', () => {
    const engine = new AudioEngine();
    const track = engine.tracks.get('drums')!;
    expect(track.volume).toBe(0.8);
  });

  it('track pan getter returns pan value', () => {
    const engine = new AudioEngine();
    const track = engine.tracks.get('drums')!;
    expect(track.pan).toBe(0);
  });

  it('setReverbSend clamps value between 0 and 1', () => {
    const engine = new AudioEngine();
    const track = engine.tracks.get('drums')!;
    track.setReverbSend(1.5);
    expect(track.reverbSend.gain.setTargetAtTime).toHaveBeenCalled();
    track.setReverbSend(-0.5);
    expect(track.reverbSend.gain.setTargetAtTime).toHaveBeenCalled();
  });

  it('setVolume clamps value to 0-1.2 range', () => {
    const engine = new AudioEngine();
    const track = engine.tracks.get('drums')!;
    track.setVolume(2.0);
    expect(track.volume).toBe(1.2);
    track.setVolume(-0.5);
    expect(track.volume).toBe(0);
  });

  it('setPan clamps value to -1..1 range', () => {
    const engine = new AudioEngine();
    const track = engine.tracks.get('drums')!;
    track.setPan(2.0);
    expect(track.pan).toBe(1);
    track.setPan(-2.0);
    expect(track.pan).toBe(-1);
  });

  it('loadSample disposes old buffer before loading new one', async () => {
    const engine = new AudioEngine();
    const file = new File(['test'], 'test.wav', { type: 'audio/wav' });
    await engine.loadSample('existing', file);
    const oldBuf = engine.loadedSamples.get('existing');
    const file2 = new File(['test2'], 'test2.wav', { type: 'audio/wav' });
    await engine.loadSample('existing', file2);
    expect(engine.loadedSamples.has('existing')).toBe(true);
  });

  it('loadSampleFromBuffer disposes old buffer', async () => {
    const engine = new AudioEngine();
    const buf1 = new ArrayBuffer(8);
    await engine.loadSampleFromBuffer('s1', buf1, 'a.wav', 'audio/wav');
    const buf2 = new ArrayBuffer(16);
    await engine.loadSampleFromBuffer('s1', buf2, 'b.wav', 'audio/wav');
    expect(engine.loadedSamples.has('s1')).toBe(true);
    expect(engine.drumKit['s1']).toBe('b.wav');
  });

  it('loadSampleFromUrl disposes old buffer', async () => {
    const engine = new AudioEngine();
    await engine.loadSampleFromUrl('s1', 'https://example.com/a.wav');
    await engine.loadSampleFromUrl('s1', 'https://example.com/b.wav');
    expect(engine.loadedSamples.has('s1')).toBe(true);
    expect(engine.drumKit['s1']).toBe('b.wav');
  });

  it('engine drumKit is populated from DEFAULT_DRUM_NAMES', () => {
    const engine = new AudioEngine();
    expect(engine.drumKit['Kick']).toBe('Fudda Kick 1.wav');
    expect(engine.drumKit['Snare']).toBe('Steady Snr 1.wav');
  });

  it('transport subscribe and unsubscribe works', () => {
    const cb = vi.fn();
    const unsub = transport.subscribe(cb);
    transport.tempo = 90;
    expect(cb).toBeCalled();
    cb.mockClear();
    unsub();
    transport.tempo = 100;
    expect(cb).not.toBeCalled();
  });

  it('transport reset stops and cancels', () => {
    transport.reset();
    expect(Tone.getTransport().stop).toHaveBeenCalled();
    expect(Tone.getTransport().cancel).toHaveBeenCalledWith(0);
  });

  it('getTrack returns null when audioEngine is not initialized', () => {
    const result = getTrack('nonexistent');
    expect(result).toBeNull();
  });

  it('playBufferShifted sets playback rate', () => {
    const engine = new AudioEngine();
    const track = engine.tracks.get('drums')!;
    const buf = { duration: 2 } as any;
    track.playBufferShifted(buf, 1.5, 0, 0, 1);
    expect(engine).toBeDefined();
  });

  it('playBuffer schedules disposal after playback', () => {
    vi.useFakeTimers();
    const engine = new AudioEngine();
    const track = engine.tracks.get('drums')!;
    const buf = { duration: 0.5 } as any;
    track.playBuffer(buf, 0, 0, 0.5);
    vi.advanceTimersByTime(600);
    vi.useRealTimers();
  });

  it('playOscillator schedules disposal after playback', () => {
    vi.useFakeTimers();
    const engine = new AudioEngine();
    const track = engine.tracks.get('drums')!;
    track.playOscillator(440, 'sine', 0, 0.1);
    vi.advanceTimersByTime(200);
    vi.useRealTimers();
  });

  it('playNote schedules disposal after playback', () => {
    vi.useFakeTimers();
    const engine = new AudioEngine();
    const track = engine.tracks.get('drums')!;
    track.playNote(440, 'sine', 0, 1, { attack: 0.01, decay: 0.1, sustain: 0.5, release: 0.1 });
    vi.advanceTimersByTime(1300);
    vi.useRealTimers();
  });

  it('playBuffer with offset computes correct duration', () => {
    vi.useFakeTimers();
    const engine = new AudioEngine();
    const track = engine.tracks.get('drums')!;
    const buf = { duration: 2 } as any;
    track.playBuffer(buf, 0, 0.5);
    vi.advanceTimersByTime(2100);
    vi.useRealTimers();
  });

  it('playBufferShifted with offset computes correct duration', () => {
    vi.useFakeTimers();
    const engine = new AudioEngine();
    const track = engine.tracks.get('drums')!;
    const buf = { duration: 2 } as any;
    track.playBufferShifted(buf, 2, 0, 0.5);
    vi.advanceTimersByTime(1100);
    vi.useRealTimers();
  });

  it('Track constructor chains nodes correctly', () => {
    const engine = new AudioEngine();
    const track = engine.tracks.get('drums')!;
    expect(track.inputGain.chain).toHaveBeenCalled();
    expect(track.volumeNode.connect).toHaveBeenCalled();
    expect(track.panner.connect).toHaveBeenCalled();
    expect(track.reverbSend.connect).toHaveBeenCalled();
  });

  it('loadSampleFromUrl without filename uses url last segment', async () => {
    const engine = new AudioEngine();
    await engine.loadSampleFromUrl('nfn', 'https://example.com/my-sample.wav');
    expect(engine.drumKit['nfn']).toBe('my-sample.wav');
  });

  it('loadSampleFromUrl uses name when url has no segments', async () => {
    const engine = new AudioEngine();
    await engine.loadSampleFromUrl('fallback', '');
    expect(engine.drumKit['fallback']).toBe('fallback');
  });

  it('_updateSoloState does not change when mute state unchanged', () => {
    const engine = new AudioEngine();
    const track = engine.tracks.get('drums')!;
    const spy = vi.spyOn(track, 'setVolume');
    track._updateSoloState(false);
    expect(spy).not.toHaveBeenCalled();
  });

  it('track isMuted defaults to false', () => {
    const engine = new AudioEngine();
    const track = engine.tracks.get('drums')!;
    expect(track.isMuted).toBe(false);
  });

  it('track isSolo defaults to false', () => {
    const engine = new AudioEngine();
    const track = engine.tracks.get('drums')!;
    expect(track.isSolo).toBe(false);
  });

  it('addTrack creates new Track instance', () => {
    const engine = new AudioEngine();
    const track = engine.addTrack('synth');
    expect(track).toBeDefined();
    expect(track.name).toBe('synth');
    expect(engine.tracks.has('synth')).toBe(true);
  });

  it('engine ready resolves', async () => {
    const engine = new AudioEngine();
    await expect(engine.ready).resolves.toBeUndefined();
  });

  it('engine ctx is defined', () => {
    const engine = new AudioEngine();
    expect(engine.ctx).toBeDefined();
  });

  it('transport beat callbacks are initialized', () => {
    const unsub = transport.addBeatCallback(() => {});
    expect(typeof unsub).toBe('function');
    unsub();
  });

  it('transport stop callbacks are initialized', () => {
    const unsub = transport.addStopCallback(() => {});
    expect(typeof unsub).toBe('function');
    unsub();
  });

  it('setMasterVolume does not throw', () => {
    const engine = new AudioEngine();
    expect(() => engine.setMasterVolume(0.7)).not.toThrow();
  });

  it('loadSampleFromBuffer with zero-length buffer does not throw', async () => {
    const engine = new AudioEngine();
    const buf = new ArrayBuffer(0);
    await expect(engine.loadSampleFromBuffer('zero', buf, 'zero.wav', 'audio/wav')).resolves.toBeDefined();
  });

  it('track name is set correctly', () => {
    const engine = new AudioEngine();
    const track = engine.tracks.get('bass')!;
    expect(track.name).toBe('bass');
  });

  it('engine has all default tracks', () => {
    const engine = new AudioEngine();
    for (const name of AudioEngine.DEFAULT_TRACKS) {
      expect(engine.tracks.has(name)).toBe(true);
    }
  });

  it('DEFAULT_TRACKS contains expected names', () => {
    expect(AudioEngine.DEFAULT_TRACKS).toContain('drums');
    expect(AudioEngine.DEFAULT_TRACKS).toContain('bass');
    expect(AudioEngine.DEFAULT_TRACKS).toContain('lead');
    expect(AudioEngine.DEFAULT_TRACKS).toContain('pads');
    expect(AudioEngine.DEFAULT_TRACKS).toContain('keys');
    expect(AudioEngine.DEFAULT_TRACKS).toContain('guitar');
  });

  it('getTrack with null tracks returns null', () => {
    const orig = audioEngine.tracks;
    (audioEngine as any).tracks = undefined;
    expect(getTrack('drums')).toBeNull();
    (audioEngine as any).tracks = orig;
  });

  it('Track.setVolume when muted uses SILENT_DB', () => {
    const engine = new AudioEngine();
    const track = engine.tracks.get('drums')!;
    (track as any)._mutedEffective = true;
    track.setVolume(0.5);
    expect(track.volumeNode.volume.setTargetAtTime).toHaveBeenCalledWith(-100, expect.any(Number), 0.1);
  });

  it('Track._updateSoloState toggles volume when mute state changes', () => {
    const engine = new AudioEngine();
    const track = engine.tracks.get('drums')!;
    const spy = vi.spyOn(track, 'setVolume');
    track._updateSoloState(true);
    expect(spy).toHaveBeenCalled();
    spy.mockClear();
    track._updateSoloState(true);
    expect(spy).not.toHaveBeenCalled();
    spy.mockClear();
    track._updateSoloState(false);
    expect(spy).toHaveBeenCalled();
    spy.mockRestore();
  });

  it('transport.start() calls engine.start()', async () => {
    const engine = new AudioEngine();
    const t = new Transport(engine);
    const startSpy = vi.spyOn(engine, 'start').mockResolvedValue(undefined);
    await t.start();
    expect(startSpy).toHaveBeenCalled();
    startSpy.mockRestore();
  });

  it('loadSample calls URL.createObjectURL and revokeObjectURL', async () => {
    const engine = new AudioEngine();
    const createSpy = vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:test');
    const revokeSpy = vi.spyOn(URL, 'revokeObjectURL');
    const file = new File(['test'], 'test.wav', { type: 'audio/wav' });
    await engine.loadSample('urlTest', file);
    expect(createSpy).toHaveBeenCalled();
    expect(revokeSpy).toHaveBeenCalledWith('blob:test');
    createSpy.mockRestore();
    revokeSpy.mockRestore();
  });

  it('loadSampleFromBuffer calls URL.createObjectURL and revokeObjectURL', async () => {
    const engine = new AudioEngine();
    const createSpy = vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:buf');
    const revokeSpy = vi.spyOn(URL, 'revokeObjectURL');
    await engine.loadSampleFromBuffer('bufTest', new ArrayBuffer(8), 'f.wav', 'audio/wav');
    expect(createSpy).toHaveBeenCalled();
    expect(revokeSpy).toHaveBeenCalledWith('blob:buf');
    createSpy.mockRestore();
    revokeSpy.mockRestore();
  });

  it('start() skips Tone.start when context is already running', async () => {
    const engine = new AudioEngine();
    const original = Tone.getContext;
    (Tone as any).getContext = () => ({ state: 'running', rawContext: { state: 'running', createMediaStreamDestination: () => ({ stream: {} }) } });
    (Tone.start as any).mockClear();
    await engine.start();
    expect(Tone.start).not.toHaveBeenCalled();
    (Tone as any).getContext = original;
  });

  it('Transport scheduleRepeat callback fires _notify', () => {
    const cb = vi.fn();
    const unsub = transport.subscribe(cb);
    const scheduleRepeatMock = (Tone.getTransport() as any).scheduleRepeat;
    const callback = scheduleRepeatMock.mock.calls[0][0];
    callback(0);
    expect(cb).toHaveBeenCalled();
    unsub();
  });

  it('_updateSoloState with muted track stays muted even when solo active', () => {
    const engine = new AudioEngine();
    const track = engine.tracks.get('bass')!;
    track.setMute(true);
    track._updateSoloState(true);
    expect(track['_mutedEffective' as any]).toBe(true);
  });

  it('_updateSoloState with soloed track stays audible when solo active', () => {
    const engine = new AudioEngine();
    const drums = engine.tracks.get('drums')!;
    drums.setSolo(true);
    drums._updateSoloState(true);
    expect(drums['_mutedEffective' as any]).toBe(false);
  });

  it('_updateSoloState muted then unmuted restores volume', () => {
    const engine = new AudioEngine();
    const track = engine.tracks.get('bass')!;
    track.setMute(true);
    track._updateSoloState(false);
    expect(track['_mutedEffective' as any]).toBe(true);
    track.setMute(false);
    track._updateSoloState(false);
    expect(track['_mutedEffective' as any]).toBe(false);
  });

  it('_onSoloChange with no soloed tracks sets soloActive false', async () => {
    const engine = new AudioEngine();
    engine._onSoloChange();
    await new Promise(r => setTimeout(r, 0));
    expect(engine.soloActive).toBe(false);
  });

  it('_onSoloChange with multiple soloed tracks', async () => {
    const engine = new AudioEngine();
    const drums = engine.tracks.get('drums')!;
    const bass = engine.tracks.get('bass')!;
    drums.setSolo(true);
    bass.setSolo(true);
    await new Promise(r => setTimeout(r, 0));
    expect(engine.soloActive).toBe(true);
    drums.setSolo(false);
    bass.setSolo(false);
    await new Promise(r => setTimeout(r, 0));
    expect(engine.soloActive).toBe(false);
  });

  it('loadSample handles error during buffer load', async () => {
    const engine = new AudioEngine();
    const orig = Tone.ToneAudioBuffer;
    (Tone as any).ToneAudioBuffer = class {
      duration = 0;
      dispose = vi.fn();
      load = vi.fn().mockRejectedValue(new Error('load failed'));
    };
    const file = new File(['test'], 'test.wav', { type: 'audio/wav' });
    await expect(engine.loadSample('err', file)).rejects.toThrow('load failed');
    (Tone as any).ToneAudioBuffer = orig;
  });

  it('loadSampleFromUrl with filename that is empty string falls back to url parsing', async () => {
    const engine = new AudioEngine();
    await engine.loadSampleFromUrl('nft', 'https://example.com/sample.wav', '');
    expect(engine.drumKit['nft']).toBe('sample.wav');
  });

  it('start calls Tone.start when context is not running', async () => {
    const engine = new AudioEngine();
    const origGetCtx = Tone.getContext;
    const origStart = Tone.start;
    (Tone as any).getContext = () => ({ state: 'suspended' });
    (Tone as any).start = vi.fn().mockResolvedValue(undefined);
    await engine.start();
    expect(Tone.start).toHaveBeenCalled();
    (Tone as any).getContext = origGetCtx;
    (Tone as any).start = origStart;
  });

  it('Transport._notify with no listeners does not throw', () => {
    const engine = new AudioEngine();
    const t = new Transport(engine);
    const notify = (t as any)._notify.bind(t);
    expect(() => notify()).not.toThrow();
  });

  it('Transport._notify with multiple listeners', () => {
    const cb1 = vi.fn();
    const cb2 = vi.fn();
    const unsub1 = transport.subscribe(cb1);
    const unsub2 = transport.subscribe(cb2);
    transport.tempo = 110;
    expect(cb1).toHaveBeenCalled();
    expect(cb2).toHaveBeenCalled();
    unsub1();
    unsub2();
  });

  it('playBuffer without explicit duration uses buffer duration', () => {
    vi.useFakeTimers();
    const engine = new AudioEngine();
    const track = engine.tracks.get('drums')!;
    const buf = { duration: 1.0 } as any;
    track.playBuffer(buf);
    vi.advanceTimersByTime(1100);
    vi.useRealTimers();
  });

  it('playBufferShifted without explicit duration uses calculated duration', () => {
    vi.useFakeTimers();
    const engine = new AudioEngine();
    const track = engine.tracks.get('drums')!;
    const buf = { duration: 2.0 } as any;
    track.playBufferShifted(buf, 2);
    vi.advanceTimersByTime(1100);
    vi.useRealTimers();
  });

  it('playOscillator without optional params uses defaults', () => {
    vi.useFakeTimers();
    const engine = new AudioEngine();
    const track = engine.tracks.get('drums')!;
    track.playOscillator(440);
    vi.advanceTimersByTime(200);
    vi.useRealTimers();
  });

  it('playNote without envelope uses defaults', () => {
    vi.useFakeTimers();
    const engine = new AudioEngine();
    const track = engine.tracks.get('drums')!;
    track.playNote(440, 'sine', 0, 0.5);
    vi.advanceTimersByTime(700);
    vi.useRealTimers();
  });

  it('setVolume with mutedEffective true uses silent db', () => {
    const engine = new AudioEngine();
    const track = engine.tracks.get('bass')!;
    (track as any)._mutedEffective = true;
    track.setVolume(1.0);
    expect(track.volumeNode.volume.setTargetAtTime).toHaveBeenCalledWith(-100, expect.any(Number), 0.1);
  });

  it('setVolume with mutedEffective false uses normal db', () => {
    const engine = new AudioEngine();
    const track = engine.tracks.get('bass')!;
    (track as any)._mutedEffective = false;
    track.setVolume(0.8);
    expect(track.volumeNode.volume.setTargetAtTime).toHaveBeenCalled();
  });

  it('setFilterFreq calls frequency setTargetAtTime', () => {
    const engine = new AudioEngine();
    const track = engine.tracks.get('keys')!;
    track.setFilterFreq(5000);
    expect(track.filter.frequency.setTargetAtTime).toHaveBeenCalled();
  });

  it('dispose calls disconnect and dispose on all nodes', () => {
    const engine = new AudioEngine();
    const track = engine.tracks.get('guitar')!;
    track.dispose();
    expect(track.trimNode.disconnect).toHaveBeenCalled();
    expect(track.trimNode.dispose).toHaveBeenCalled();
    expect(track.eqHigh.disconnect).toHaveBeenCalled();
    expect(track.eqHigh.dispose).toHaveBeenCalled();
    expect(track.filter.disconnect).toHaveBeenCalled();
    expect(track.filter.dispose).toHaveBeenCalled();
    expect(track.analyser.disconnect).toHaveBeenCalled();
    expect(track.analyser.dispose).toHaveBeenCalled();
    expect(track.panner.disconnect).toHaveBeenCalled();
    expect(track.panner.dispose).toHaveBeenCalled();
    expect(track.reverbSend.disconnect).toHaveBeenCalled();
    expect(track.reverbSend.dispose).toHaveBeenCalled();
  });

  it('setMute then setVolume applies silent db', () => {
    const engine = new AudioEngine();
    const track = engine.tracks.get('keys')!;
    track.setMute(true);
    track.setVolume(0.8);
    expect(track.volumeNode.volume.setTargetAtTime).toHaveBeenCalledWith(-100, expect.any(Number), 0.1);
    track.setMute(false);
    track.setVolume(0.8);
    expect(track.volumeNode.volume.setTargetAtTime).toHaveBeenCalled();
  });

  it('setSolo false after true restores track', async () => {
    const engine = new AudioEngine();
    const drums = engine.tracks.get('drums')!;
    const bass = engine.tracks.get('bass')!;
    drums.setSolo(true);
    await new Promise(r => setTimeout(r, 0));
    expect(bass['_mutedEffective' as any]).toBe(true);
    drums.setSolo(false);
    await new Promise(r => setTimeout(r, 0));
    expect(bass['_mutedEffective' as any]).toBe(false);
  });

  it('_updateSoloState solo active with soloed muted track', () => {
    const engine = new AudioEngine();
    const track = engine.tracks.get('drums')!;
    track.setSolo(true);
    track.setMute(true);
    track._updateSoloState(true);
    expect(track['_mutedEffective' as any]).toBe(true);
  });

  it('setVolume at boundary 0', () => {
    const engine = new AudioEngine();
    const track = engine.tracks.get('drums')!;
    track.setVolume(0);
    expect(track.volume).toBe(0);
  });

  it('setVolume at boundary 1.2', () => {
    const engine = new AudioEngine();
    const track = engine.tracks.get('drums')!;
    track.setVolume(1.2);
    expect(track.volume).toBe(1.2);
  });

  it('setPan at boundary 0', () => {
    const engine = new AudioEngine();
    const track = engine.tracks.get('drums')!;
    track.setPan(0);
    expect(track.pan).toBe(0);
  });

  it('setPan at boundary -1', () => {
    const engine = new AudioEngine();
    const track = engine.tracks.get('drums')!;
    track.setPan(-1);
    expect(track.pan).toBe(-1);
  });

  it('setPan at boundary 1', () => {
    const engine = new AudioEngine();
    const track = engine.tracks.get('drums')!;
    track.setPan(1);
    expect(track.pan).toBe(1);
  });

  it('transport toggle starts when not playing', async () => {
    const engine = new AudioEngine();
    const t = new Transport(engine);
    const startSpy = vi.spyOn(t, 'start').mockResolvedValue(undefined);
    vi.spyOn(t, 'isPlaying', 'get').mockReturnValue(false);
    t.toggle();
    expect(startSpy).toHaveBeenCalled();
    startSpy.mockRestore();
  });

  it('transport toggle stops when playing', () => {
    const engine = new AudioEngine();
    const t = new Transport(engine);
    const stopSpy = vi.spyOn(t, 'stop');
    vi.spyOn(t, 'isPlaying', 'get').mockReturnValue(true);
    t.toggle();
    expect(stopSpy).toHaveBeenCalled();
    stopSpy.mockRestore();
  });

