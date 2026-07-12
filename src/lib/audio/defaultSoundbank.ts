import { DRUM_NAMES } from '../../components/instruments/types';
import { loadBassFromDB, loadKitFromDB, persistAndLoadFromUrl } from './soundbankLoader';

const DEFAULT_ROOT = '/soundbank';

async function loadAllKit1Drums(): Promise<number> {
  const loads = DRUM_NAMES.map(drum =>
    persistAndLoadFromUrl(
      `kit1_${drum}`,
      drum,
      `${DEFAULT_ROOT}/kit1/${drum}.wav`,
      `${drum}.wav`,
      'audio/wav',
    ).catch(() => {}),
  );
  await Promise.all(loads);
  return loadKitFromDB('kit1');
}

export async function ensureDefaultSoundbank(): Promise<{ bass: boolean; kit1: number }> {
  const existingBass = await loadBassFromDB();
  const existingKitCount = await loadKitFromDB('kit1');

  if (existingBass && existingKitCount === DRUM_NAMES.length) {
    return { bass: true, kit1: existingKitCount };
  }

  const bassPromise = !existingBass
    ? persistAndLoadFromUrl('bass_default', 'bass', `${DEFAULT_ROOT}/bass/Bass.wav`, 'Bass.wav', 'audio/wav').then(() => true).catch(() => false)
    : Promise.resolve(true);

  const kitPromise = existingKitCount < DRUM_NAMES.length
    ? loadAllKit1Drums()
    : Promise.resolve(existingKitCount);

  const [bassLoaded, kitCount] = await Promise.all([bassPromise, kitPromise]);

  return { bass: bassLoaded, kit1: kitCount };
}
