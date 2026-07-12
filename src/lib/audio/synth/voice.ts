import * as Tone from 'tone';
import type { Ju60Params } from './params';
import { sanitizePatch } from './params';

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}
function clamp01(value: number) {
  return clamp(value, 0, 1);
}
function clampFrequency(value: number) {
  return clamp(value, 20, 20_000);
}

function driveCurve(amount: number, samples = 1024): Float32Array {
  const curve = new Float32Array(samples);
  const k = 1 + amount * 9;
  for (let i = 0; i < samples; i++) {
    const x = (i / (samples - 1)) * 2 - 1;
    curve[i] = Math.tanh(k * x) / Math.tanh(k);
  }
  return curve;
}

export class Ju60Voice {
  readonly sawOsc1:   Tone.Oscillator;
  readonly sawOsc2:   Tone.Oscillator;
  readonly pulseOsc1: Tone.PulseOscillator;
  readonly pulseOsc2: Tone.PulseOscillator;
  readonly subOsc:    Tone.Oscillator;
  readonly noiseOsc:  Tone.Noise;

  readonly sawGain1:   Tone.Gain;
  readonly sawGain2:   Tone.Gain;
  readonly pulseGain1: Tone.Gain;
  readonly pulseGain2: Tone.Gain;
  readonly subGain:    Tone.Gain;
  readonly noiseGain:  Tone.Gain;

  readonly lfo:          Tone.LFO;
  readonly lfoPitchGain: Tone.Gain;
  readonly lfoVcfGain:   Tone.Gain;
  readonly lfoPwmGain:   Tone.Gain;

  readonly hpf:    Tone.Filter;
  readonly vcf:    Tone.Filter;
  readonly ampEnv: Tone.AmplitudeEnvelope;
  readonly pwmEnv: Tone.Envelope;

  readonly filterDrive: Tone.WaveShaper;
  readonly outputSat:   Tone.WaveShaper;

  readonly driftLfo1: Tone.LFO;
  readonly driftLfo2: Tone.LFO;

  readonly selfOsc:     Tone.Oscillator;
  readonly selfOscGain: Tone.Gain;

  readonly envPwmGain:  Tone.Gain;

  readonly output: Tone.Gain;

  activeMidi: number | null = null;
  startTime = 0;

  private _patch: Ju60Params;
  private targetLfoPitchGain = 0;
  private targetLfoVcfGain   = 0;
  private targetLfoPwmGain   = 0;

  constructor(outputNode: Tone.InputNode, initialPatch: Ju60Params) {
    this.output = new Tone.Gain().connect(outputNode);

    this.sawOsc1   = new Tone.Oscillator(440, 'sawtooth').start();
    this.sawOsc2   = new Tone.Oscillator(440, 'sawtooth').start();
    this.pulseOsc1 = new Tone.PulseOscillator(440, 0.5).start();
    this.pulseOsc2 = new Tone.PulseOscillator(440, 0.5).start();
    this.subOsc    = new Tone.Oscillator(220, 'square').start();
    this.noiseOsc  = new Tone.Noise('white').start();

    this.sawGain1   = new Tone.Gain(0);
    this.sawGain2   = new Tone.Gain(0);
    this.pulseGain1 = new Tone.Gain(0);
    this.pulseGain2 = new Tone.Gain(0);
    this.subGain    = new Tone.Gain(0);
    this.noiseGain  = new Tone.Gain(0);

    this.hpf    = new Tone.Filter(20, 'highpass');
    this.vcf    = new Tone.Filter(1000, 'lowpass');

    this.filterDrive = new Tone.WaveShaper(driveCurve(0), 1024);
    this.outputSat   = new Tone.WaveShaper(driveCurve(0), 1024);

    this.ampEnv = new Tone.AmplitudeEnvelope({
      attack: 0.01, decay: 0.1, sustain: 1.0, release: 0.1,
    });
    this.pwmEnv = new Tone.Envelope({
      attack: 0.01, decay: 0.1, sustain: 1, release: 0.1,
    });

    this.lfo          = new Tone.LFO(5, -1, 1).start();
    this.lfoPitchGain = new Tone.Gain(0);
    this.lfoVcfGain   = new Tone.Gain(0);
    this.lfoPwmGain   = new Tone.Gain(0);

    this.lfo.connect(this.lfoPitchGain);
    this.lfo.connect(this.lfoVcfGain);
    this.lfo.connect(this.lfoPwmGain);

    this.lfoPitchGain.connect(this.sawOsc1.frequency);
    this.lfoPitchGain.connect(this.sawOsc2.frequency);
    this.lfoPitchGain.connect(this.pulseOsc1.frequency);
    this.lfoPitchGain.connect(this.pulseOsc2.frequency);
    this.lfoPitchGain.connect(this.subOsc.frequency);

    this.lfoVcfGain.connect(this.vcf.frequency);
    this.lfoPwmGain.connect(this.pulseOsc1.width);
    this.lfoPwmGain.connect(this.pulseOsc2.width);

    this.driftLfo1 = new Tone.LFO(0.12, -4, 4).start();
    this.driftLfo2 = new Tone.LFO(0.15, -4, 4).start();
    this.driftLfo1.connect(this.sawOsc1.detune);
    this.driftLfo1.connect(this.pulseOsc1.detune);
    this.driftLfo2.connect(this.sawOsc2.detune);
    this.driftLfo2.connect(this.pulseOsc2.detune);
    this.driftLfo2.connect(this.subOsc.detune);

    this.selfOsc     = new Tone.Oscillator(0, 'sine').start();
    this.selfOscGain = new Tone.Gain(0);
    this.selfOsc.connect(this.selfOscGain);
    this.selfOscGain.connect(this.ampEnv);
    this.vcf.frequency.connect(this.selfOsc.frequency);

    this.envPwmGain = new Tone.Gain(0);
    this.pwmEnv.connect(this.envPwmGain);
    this.envPwmGain.connect(this.pulseOsc1.width);
    this.envPwmGain.connect(this.pulseOsc2.width);

    this.sawOsc1.connect(this.sawGain1);
    this.sawOsc2.connect(this.sawGain2);
    this.pulseOsc1.connect(this.pulseGain1);
    this.pulseOsc2.connect(this.pulseGain2);
    this.subOsc.connect(this.subGain);
    this.noiseOsc.connect(this.noiseGain);

    this.sawGain1.connect(this.hpf);
    this.sawGain2.connect(this.hpf);
    this.pulseGain1.connect(this.hpf);
    this.pulseGain2.connect(this.hpf);
    this.subGain.connect(this.hpf);
    this.noiseGain.connect(this.hpf);

    this.hpf.connect(this.filterDrive);
    this.filterDrive.connect(this.vcf);
    this.vcf.connect(this.ampEnv);
    this.ampEnv.connect(this.outputSat);
    this.outputSat.connect(this.output);

    this._patch = sanitizePatch(initialPatch);
    this.applyPatch();
  }

  set patch(newPatch: Ju60Params) {
    this._patch = sanitizePatch(newPatch);
    this.applyPatch();
  }
  get patch() { return this._patch; }

  private applyPatch() {
    const p = this._patch;
    if (!p) return;

    const hpfMode = p.hpfFreq !== undefined ? p.hpfFreq : 1;
    if (hpfMode === 0) {
      this.hpf.type = 'lowshelf';
      this.hpf.frequency.value = 80;
      this.hpf.gain.value = 5;
    } else {
      this.hpf.type = 'highpass';
      this.hpf.frequency.value = [10, 80, 120, 350][hpfMode] ?? 10;
    }

    this.vcf.Q.value = Math.max(0.1, p.vcfRes / 8);
    if (p.vcfRes > 80) {
      this.selfOscGain.gain.value = ((p.vcfRes - 80) / 20) * 0.25;
    } else {
      this.selfOscGain.gain.value = 0;
    }

    const resDriveBoost = p.vcfRes > 60 ? ((p.vcfRes - 60) / 40) * 0.3 : 0;
    const baseFilterDrive = (p.filterDrive ?? 15) / 100;
    const effectiveFilterDrive = Math.min(1, baseFilterDrive + resDriveBoost);
    this.filterDrive.curve = driveCurve(effectiveFilterDrive);
    this.outputSat.curve   = driveCurve((p.outputSat ?? 10) / 100);

    if (p.vcaMode === 'GATE') {
      this.ampEnv.set({ attack: 0, decay: 0, sustain: 1, release: 0 });
      this.pwmEnv.set({ attack: 0, decay: 0, sustain: 1, release: 0 });
    } else {
      const envScale = (v: number) => Math.pow(v / 100, 1.5);
      this.ampEnv.set({
        attack:  Math.max(0.001, envScale(p.envA)),
        decay:   Math.max(0.001, envScale(p.envD)),
        sustain: p.envS / 100,
        release: Math.max(0.001, envScale(p.envR)),
      });
      this.pwmEnv.set({
        attack:  Math.max(0.001, envScale(p.envA)),
        decay:   Math.max(0.001, envScale(p.envD)),
        sustain: p.envS / 100,
        release: Math.max(0.001, envScale(p.envR)),
      });
    }

    this.subOsc.type = p.subWave === 'SIN' ? 'sine' : p.subWave === 'TRI' ? 'triangle' : 'square';

    this.lfo.frequency.value = Math.max(0.1, p.lfoRate / 10);
    this.targetLfoPitchGain = p.dcoLfo * 0.2;
    this.targetLfoVcfGain   = p.vcfLfo * 15;
    if (p.lfoDelay <= 0) {
      this.lfoPitchGain.gain.value = this.targetLfoPitchGain;
      this.lfoVcfGain.gain.value   = this.targetLfoVcfGain;
    }

    const PWM_CENTER = 0;
    const PWM_MAX_OFFSET = 0.45;

    switch (p.dcoPwmSrc) {
      case 'LFO':
        this.envPwmGain.gain.value = 0;
        this.targetLfoPwmGain = (p.dcoPwm / 100) * PWM_MAX_OFFSET;
        if (p.lfoDelay <= 0) this.lfoPwmGain.gain.value = this.targetLfoPwmGain;
        this.pulseOsc1.width.value = PWM_CENTER;
        this.pulseOsc2.width.value = PWM_CENTER;
        break;
      case 'ENV':
        this.lfoPwmGain.gain.value = 0;
        this.envPwmGain.gain.value = (p.dcoPwm / 100) * PWM_MAX_OFFSET;
        this.pulseOsc1.width.value = PWM_CENTER;
        this.pulseOsc2.width.value = PWM_CENTER;
        break;
      case 'MANUAL': {
        const offset = (p.dcoPwm / 100) * PWM_MAX_OFFSET;
        this.lfoPwmGain.gain.value = 0;
        this.envPwmGain.gain.value = 0;
        this.pulseOsc1.width.value = PWM_CENTER + offset;
        this.pulseOsc2.width.value = PWM_CENTER - offset;
        break;
      }
    }

    const unison = p.voiceMode === 'UNISON';
    this.sawGain1.gain.value   = p.dcoSaw ? 0.4 : 0;
    this.sawGain2.gain.value   = (p.dcoSaw && unison) ? 0.4 : 0;
    this.pulseGain1.gain.value = p.dcoPulse ? 0.4 : 0;
    this.pulseGain2.gain.value = (p.dcoPulse && unison) ? 0.4 : 0;
    this.subGain.gain.value    = (p.dcoSub / 100) * 0.4;
    this.noiseGain.gain.value  = (p.dcoNoise / 100) * 0.12;
  }

  private setVcfEnvelope(trackedCutoff: number, time: number, p: Ju60Params) {
    const attack  = Math.max(0.001, p.envA / 100);
    const decay   = Math.max(0.001, p.envD / 100);
    const sustain = clamp01(p.envS / 100);
    const sweep   = clamp01(p.vcfEnv / 100);

    this.vcf.frequency.cancelScheduledValues(time);
    this.vcf.frequency.setValueAtTime(clampFrequency(trackedCutoff), time);

    if (sweep === 0) return;

    const peak = p.vcfPolarity === '-'
      ? trackedCutoff - (trackedCutoff - 20) * sweep
      : trackedCutoff + (20_000 - trackedCutoff) * sweep;
    const sustainFreq = trackedCutoff + (peak - trackedCutoff) * sustain;

    this.vcf.frequency.exponentialRampToValueAtTime(clampFrequency(peak), time + attack);
    this.vcf.frequency.exponentialRampToValueAtTime(clampFrequency(sustainFreq), time + attack + decay);
  }

  triggerAttack(midi: number, time?: number, velocity = 0.8, legato = false) {
    const freq    = Tone.Frequency(midi, 'midi').toFrequency();
    const timeVal = time ?? Tone.now();
    const p       = this._patch;

    const prevActiveMidi = this.activeMidi;
    this.activeMidi = midi;
    this.startTime  = timeVal;

    this.voiceRandomizeDrift();

    let dcoFreq = freq;
    if (p.dcoRange === '16\'') dcoFreq /= 2;
    else if (p.dcoRange === '4\'') dcoFreq *= 2;

    const subFreq = freq / 2;

    const detuneCents = p.voiceMode === 'UNISON' ? p.unisonDetune : 0;
    const detuneRatio = 2 ** (detuneCents / 1200);

    const portamentoMs = p.portamento ?? 0;
    const portamentoSec = (portamentoMs / 100) * 0.5;
    const usePortamento = portamentoSec > 0 && (legato || prevActiveMidi !== null);
    const freqFn = usePortamento
      ? (node: { frequency: { linearRampToValueAtTime: Function } }, val: number) =>
          node.frequency.linearRampToValueAtTime(val, timeVal + portamentoSec)
      : (node: { frequency: { setValueAtTime: Function } }, val: number) =>
          node.frequency.setValueAtTime(val, timeVal);

    freqFn(this.sawOsc1, dcoFreq);
    freqFn(this.sawOsc2, dcoFreq * detuneRatio);
    freqFn(this.pulseOsc1, dcoFreq);
    freqFn(this.pulseOsc2, dcoFreq / detuneRatio);
    freqFn(this.subOsc, subFreq);

    const keyFollow     = p.vcfKeyFollow / 100;
    const baseCutoff    = Math.max(20, p.vcfCutoff * 80);
    const trackedCutoff = baseCutoff + dcoFreq * keyFollow;

    this.setVcfEnvelope(trackedCutoff, timeVal, p);

    if (!legato || p.vcaMode === 'GATE') {
      this.ampEnv.triggerAttack(timeVal, velocity);
      this.pwmEnv.triggerAttack(timeVal);
    }

    if (p.lfoDelay > 0) {
      this.lfoPitchGain.gain.cancelScheduledValues(timeVal);
      this.lfoPitchGain.gain.setValueAtTime(0, timeVal);
      this.lfoVcfGain.gain.cancelScheduledValues(timeVal);
      this.lfoVcfGain.gain.setValueAtTime(0, timeVal);
      if (p.dcoPwmSrc === 'LFO') {
        this.lfoPwmGain.gain.cancelScheduledValues(timeVal);
        this.lfoPwmGain.gain.setValueAtTime(0, timeVal);
      }

      const delaySeconds = p.lfoDelay / 1000;
      this.lfoPitchGain.gain.linearRampToValueAtTime(this.targetLfoPitchGain, timeVal + delaySeconds);
      this.lfoVcfGain.gain.linearRampToValueAtTime(this.targetLfoVcfGain, timeVal + delaySeconds);
      if (p.dcoPwmSrc === 'LFO') {
        this.lfoPwmGain.gain.linearRampToValueAtTime(this.targetLfoPwmGain, timeVal + delaySeconds);
      }
    }
  }

  triggerRelease(time?: number) {
    const timeVal = time ?? Tone.now();
    const p       = this._patch;
    this.activeMidi = null;

    const releaseTime = Math.max(0.001, p.envR / 100);
    const baseCutoff  = Math.max(20, p.vcfCutoff * 80);
    this.vcf.frequency.cancelScheduledValues(timeVal);
    this.vcf.frequency.setValueAtTime(clampFrequency(this.vcf.frequency.value as number), timeVal);
    this.vcf.frequency.exponentialRampToValueAtTime(clampFrequency(baseCutoff), timeVal + releaseTime);

    this.ampEnv.triggerRelease(timeVal);
    this.pwmEnv.triggerRelease(timeVal);
  }

  voiceRandomizeDrift() {
    this.driftLfo1.phase = Math.random() * 360;
    this.driftLfo2.phase = Math.random() * 360;
  }

  steal(time: number) {
    this.ampEnv.cancel(time);
    this.ampEnv.triggerRelease(time);
    this.pwmEnv.cancel(time);
    this.pwmEnv.triggerRelease(time);
    this.activeMidi = null;
  }

  dispose() {
    try { this.vcf.frequency.disconnect(this.selfOsc.frequency); } catch {}
    this.sawOsc1.dispose(); this.sawOsc2.dispose();
    this.pulseOsc1.dispose(); this.pulseOsc2.dispose();
    this.subOsc.dispose(); this.noiseOsc.dispose();
    this.sawGain1.dispose(); this.sawGain2.dispose();
    this.pulseGain1.dispose(); this.pulseGain2.dispose();
    this.subGain.dispose(); this.noiseGain.dispose();
    this.lfo.dispose(); this.lfoPitchGain.dispose();
    this.lfoVcfGain.dispose(); this.lfoPwmGain.dispose();
    this.driftLfo1.dispose(); this.driftLfo2.dispose();
    this.selfOsc.dispose(); this.selfOscGain.dispose();
    this.pwmEnv.dispose(); this.envPwmGain.dispose();
    this.hpf.dispose(); this.vcf.dispose();
    this.filterDrive.dispose(); this.outputSat.dispose();
    this.ampEnv.dispose(); this.output.dispose();
  }
}
