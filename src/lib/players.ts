/**
 * Player profiles – the personality and style of each virtual musician
 * in the arrangement.  These drive the per‑track generative rules.
 */

// ── Instrument type (derived from the canonical list) ──────────
export const INSTRUMENTS = ['Drums', 'Bass', 'Keys', 'Guitar', 'Pads'] as const;
export type Instrument = (typeof INSTRUMENTS)[number];

export interface PlayerProfile {
  id: string;
  name: string;
  instrument: Instrument;
  description: string;
  traits: string[];
}

// ── Profiles ──────────────────────────────────────────────────
export const PLAYERS: PlayerProfile[] = [
  // Drums
  {
    id: 'purdie',
    name: 'Bernard Purdie',
    instrument: 'Drums',
    description: 'Legendary shuffle, ghost notes, deep pocket.',
    traits: ['Ghost Notes', 'Half-Time Shuffle', 'In The Pocket'],
  },
  {
    id: 'gadd',
    name: 'Steve Gadd',
    instrument: 'Drums',
    description: 'Linear drumming, marching band rudiments, precise.',
    traits: ['Linear Fills', 'Marching Snare', 'Crisp'],
  },
  {
    id: 'porcaro',
    name: 'Jeff Porcaro',
    instrument: 'Drums',
    description: 'Half-time shuffle, impeccable hi-hat work.',
    traits: ['Precision HH', 'Rosanna Shuffle', 'Dynamic'],
  },

  // Bass
  {
    id: 'rainey',
    name: 'Chuck Rainey',
    instrument: 'Bass',
    description: 'Melodic syncopation, R&B roots, active but supportive.',
    traits: ['Melodic Walk', 'Double Stops', 'R&B Feel'],
  },
  {
    id: 'graham',
    name: 'Larry Graham',
    instrument: 'Bass',
    description: 'Thumping and plucking, driving funk energy.',
    traits: ['Slap & Pop', 'Aggressive', 'Funk Core'],
  },
  {
    id: 'jackson',
    name: 'Anthony Jackson',
    instrument: 'Bass',
    description: 'Pick playing, extended range, classical influence.',
    traits: ['Pick Attack', 'Low B String', 'Contrapuntal'],
  },

  // Keys
  {
    id: 'fagen',
    name: 'Donald Fagen',
    instrument: 'Keys',
    description: 'Staccato attacks, complex clustered chords.',
    traits: ['Staccato', 'Mu Major Chords', 'Rhythmic'],
  },
  {
    id: 'jamal',
    name: 'Ahmad Jamal',
    instrument: 'Keys',
    description: 'Spacious playing, surprising dynamic accents.',
    traits: ['Space/Silence', 'Surprise Accents', 'Block Chords'],
  },
  {
    id: 'mcdonald',
    name: 'Michael McDonald',
    instrument: 'Keys',
    description: 'Syncopated soul, warm electric piano.',
    traits: ['Syncopation', 'Soulful', 'Warmth'],
  },

  // Guitar
  {
    id: 'carlton',
    name: 'Larry Carlton',
    instrument: 'Guitar',
    description: 'Smooth voice-leading, sophisticated jazz-blues.',
    traits: ['Voice Leading', 'Volume Swells', 'Jazz-Blues'],
  },
  {
    id: 'parks',
    name: 'Dean Parks',
    instrument: 'Guitar',
    description: 'Rhythmic precision, versatile comping.',
    traits: ['Rhythmic Comping', 'Muted Strums', 'Versatile'],
  },
  {
    id: 'graydon',
    name: 'Jay Graydon',
    instrument: 'Guitar',
    description: 'Overdriven solos, sophisticated studio sheen.',
    traits: ['Overdrive', 'Studio Polish', 'Complex Solos'],
  },

  // Pads
  {
    id: 'string_mach',
    name: 'ARP Solina',
    instrument: 'Pads',
    description: 'Classic analog string machine ensemble.',
    traits: ['Warm', 'Analog Chorus', 'Sustained'],
  },
  {
    id: 'ob_brass',
    name: 'OB Brass',
    instrument: 'Pads',
    description: 'Thick, detuned polysynth brass.',
    traits: ['Thick', 'Detuned', 'Punchy Attack'],
  },
];

// ── Lookup helpers ────────────────────────────────────────────

/**
 * Find a player by their unique ID.
 * @returns The matching profile or `undefined` if not found.
 */
export function getPlayerById(id: string): PlayerProfile | undefined {
  return PLAYERS.find((p) => p.id === id);
}

/**
 * All players that play a particular instrument.
 */
export function getPlayersByInstrument(instrument: Instrument): PlayerProfile[] {
  return PLAYERS.filter((p) => p.instrument === instrument);
}

/**
 * Return the canonical list of instrument names (readonly tuple).
 */
export function getAllInstruments(): readonly Instrument[] {
  return INSTRUMENTS;
}
