import type { DrumName, KitId } from '../../components/instruments/types';

export type SoundbankTarget =
  | {
      kind: 'bass';
      id: 'bass_default';
      targetName: 'bass';
    }
  | {
      kind: 'drum';
      kitId: KitId;
      drum: DrumName;
      id: string;
      targetName: DrumName;
    };

const AUDIO_EXTENSION = /\.(wav|wave|aif|aiff|mp3|ogg|flac|m4a)$/i;

function normalize(value: string): string {
  return value
    .toLowerCase()
    .replace(/\.[^.]+$/, '')
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function resolveKit(path: string): KitId {
  const normalized = normalize(path);
  if (
    normalized.includes('kit 2') ||
    normalized.includes('kit2') ||
    normalized.includes('pearl') ||
    normalized.includes('acoustic')
  ) {
    return 'kit2';
  }
  return 'kit1';
}

function resolveDrum(name: string): DrumName | null {
  if (/\b(kick|bd|bass drum)\b/.test(name)) return 'Kick';
  if (/\b(snare|snr|sd)\b/.test(name)) return 'Snare';
  if (/\b(open hat|openhh|ohh|hat open)\b/.test(name)) return 'Hi-Hat Open';
  if (/\b(closed hat|closedhh|chh|hat closed|hihat|hi hat|hat|hh)\b/.test(name)) return 'Hi-Hat Closed';
  if (/\b(crash|cym crash)\b/.test(name)) return 'Crash';
  if (/\b(ride|cym ride)\b/.test(name)) return 'Ride';
  if (/\b(tom 1|tom1|high tom|hi tom)\b/.test(name)) return 'Tom 1';
  if (/\b(tom 2|tom2|mid tom|middle tom)\b/.test(name)) return 'Tom 2';
  if (/\b(tom 3|tom3|floor tom|low tom)\b/.test(name)) return 'Tom 3';
  return null;
}

export function mapSoundbankFile(file: File): SoundbankTarget | null {
  if (!file.type.startsWith('audio/') && !AUDIO_EXTENSION.test(file.name)) {
    return null;
  }

  const relativePath =
    (file as File & { webkitRelativePath?: string }).webkitRelativePath ||
    file.name;

  const normalized = normalize(relativePath);

  if (/\b(bass|electric bass|finger bass|picked bass)\b/.test(normalized)) {
    return { kind: 'bass', id: 'bass_default', targetName: 'bass' };
  }

  const drum = resolveDrum(normalized);
  if (!drum) return null;

  const kitId = resolveKit(relativePath);

  return {
    kind: 'drum',
    kitId,
    drum,
    id: `${kitId}_${drum}`,
    targetName: drum,
  };
}
