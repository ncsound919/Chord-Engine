import { audioEngine } from './engine';

const DEFAULT_KIT_ASSETS: Record<string, string> = {
  'Kick': '/sounds/Deterministic Engine Soundbank/drum kit 1/Fudda Kick 1.wav',
  'Snare': '/sounds/Deterministic Engine Soundbank/drum kit 1/Steady Snr 1.wav',
  'Hi-Hat Closed': '/sounds/Deterministic Engine Soundbank/drum kit 1/Fudda Hat 1.wav',
  'Hi-Hat Open': '/sounds/Deterministic Engine Soundbank/drum kit 1/Fudda Open Hat 1.wav',
  'Crash': '/sounds/Deterministic Engine Soundbank/drum kit 1/Fudda Crash.wav',
  'Ride': '/sounds/Deterministic Engine Soundbank/drum kit 1/Ride.wav',
  'Tom 1': '/sounds/Deterministic Engine Soundbank/drum kit 1/Killer Tom 1.wav',
  'Tom 2': '/sounds/Deterministic Engine Soundbank/drum kit 1/Killer Tom 2.wav',
  'Tom 3': '/sounds/Deterministic Engine Soundbank/drum kit 1/Killer Tom 3.wav',
};

const DEFAULT_BASS_ASSET = '/sounds/Deterministic Engine Soundbank/Bass/ample-p-bass_C.wav';

let _defaultsLoaded = false;

export async function ensureDefaultDrumKit(): Promise<boolean> {
  if (_defaultsLoaded) return true;

  const missing = Object.entries(DEFAULT_KIT_ASSETS).filter(
    ([drum]) => !audioEngine.loadedSamples.has(drum),
  );

  if (missing.length === 0 && audioEngine.loadedSamples.has('bass')) {
    _defaultsLoaded = true;
    return true;
  }

  const loads: Promise<unknown>[] = missing.map(([drum, url]) =>
    audioEngine.loadSampleFromUrl(drum, url, url.split('/').pop()!).catch(() => {}),
  );

  if (!audioEngine.loadedSamples.has('bass')) {
    loads.push(
      audioEngine.loadSampleFromUrl('bass', DEFAULT_BASS_ASSET, 'ample-p-bass_C.wav').catch(() => {}),
    );
  }

  await Promise.all(loads);
  _defaultsLoaded = true;
  return missing.length < Object.keys(DEFAULT_KIT_ASSETS).length || audioEngine.loadedSamples.has('bass');
}
