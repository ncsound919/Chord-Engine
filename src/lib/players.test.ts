import { describe, it, expect } from 'vitest';
import {
  INSTRUMENTS,
  PLAYERS,
  getPlayerById,
  getPlayersByInstrument,
  getAllInstruments,
} from './players';

describe('INSTRUMENTS', () => {
  it('contains five instruments', () => {
    expect(INSTRUMENTS).toHaveLength(5);
  });

  it('includes expected instrument names', () => {
    expect(INSTRUMENTS).toContain('Drums');
    expect(INSTRUMENTS).toContain('Bass');
    expect(INSTRUMENTS).toContain('Keys');
    expect(INSTRUMENTS).toContain('Guitar');
    expect(INSTRUMENTS).toContain('Pads');
  });

  it('is an Array instance', () => {
    expect(INSTRUMENTS).toBeInstanceOf(Array);
  });
});

describe('PLAYERS', () => {
  it('contains multiple player profiles', () => {
    expect(PLAYERS.length).toBeGreaterThanOrEqual(10);
  });

  it('every player has required fields', () => {
    for (const player of PLAYERS) {
      expect(player).toHaveProperty('id');
      expect(player).toHaveProperty('name');
      expect(player).toHaveProperty('instrument');
      expect(player).toHaveProperty('description');
      expect(player).toHaveProperty('traits');
      expect(typeof player.id).toBe('string');
      expect(typeof player.name).toBe('string');
      expect(typeof player.description).toBe('string');
      expect(Array.isArray(player.traits)).toBe(true);
      expect(player.traits.length).toBeGreaterThan(0);
    }
  });

  it('every player instrument is in INSTRUMENTS', () => {
    for (const player of PLAYERS) {
      expect(INSTRUMENTS).toContain(player.instrument);
    }
  });

  it('has at least 3 players for Drums, Bass, Keys, Guitar', () => {
    for (const instrument of ['Drums', 'Bass', 'Keys', 'Guitar'] as const) {
      const count = PLAYERS.filter((p) => p.instrument === instrument).length;
      expect(count).toBeGreaterThanOrEqual(3);
    }
  });

  it('has at least 2 players for Pads', () => {
    const count = PLAYERS.filter((p) => p.instrument === 'Pads').length;
    expect(count).toBeGreaterThanOrEqual(2);
  });
});

describe('getPlayerById', () => {
  it('returns the correct player for a known id', () => {
    const player = getPlayerById('purdie');
    expect(player).toBeDefined();
    expect(player!.name).toBe('Bernard Purdie');
    expect(player!.instrument).toBe('Drums');
  });

  it('returns undefined for an unknown id', () => {
    const player = getPlayerById('nonexistent');
    expect(player).toBeUndefined();
  });

  it('returns undefined for an empty string', () => {
    const player = getPlayerById('');
    expect(player).toBeUndefined();
  });

  it('is case-sensitive', () => {
    const player = getPlayerById('Purdie');
    expect(player).toBeUndefined();
  });

  it('finds players from every instrument group', () => {
    expect(getPlayerById('rainey')).toBeDefined();
    expect(getPlayerById('fagen')).toBeDefined();
    expect(getPlayerById('carlton')).toBeDefined();
    expect(getPlayerById('string_mach')).toBeDefined();
  });
});

describe('getPlayersByInstrument', () => {
  it('returns all players for Drums', () => {
    const drums = getPlayersByInstrument('Drums');
    expect(drums.length).toBeGreaterThanOrEqual(3);
    for (const p of drums) {
      expect(p.instrument).toBe('Drums');
    }
  });

  it('returns all players for Bass', () => {
    const bass = getPlayersByInstrument('Bass');
    expect(bass.length).toBeGreaterThanOrEqual(3);
    for (const p of bass) {
      expect(p.instrument).toBe('Bass');
    }
  });

  it('returns all players for Keys', () => {
    const keys = getPlayersByInstrument('Keys');
    expect(keys.length).toBeGreaterThanOrEqual(3);
    for (const p of keys) {
      expect(p.instrument).toBe('Keys');
    }
  });

  it('returns all players for Guitar', () => {
    const guitar = getPlayersByInstrument('Guitar');
    expect(guitar.length).toBeGreaterThanOrEqual(3);
    for (const p of guitar) {
      expect(p.instrument).toBe('Guitar');
    }
  });

  it('returns all players for Pads', () => {
    const pads = getPlayersByInstrument('Pads');
    expect(pads.length).toBeGreaterThanOrEqual(2);
    for (const p of pads) {
      expect(p.instrument).toBe('Pads');
    }
  });

  it('returns empty array for non-existent instrument', () => {
    const result = getPlayersByInstrument('Trumpet' as any);
    expect(result).toEqual([]);
  });

  it('returns a new array each call (no mutation)', () => {
    const a = getPlayersByInstrument('Drums');
    const b = getPlayersByInstrument('Drums');
    expect(a).not.toBe(b);
    expect(a).toEqual(b);
  });
});

describe('getAllInstruments', () => {
  it('returns the INSTRUMENTS tuple', () => {
    const result = getAllInstruments();
    expect(result).toBe(INSTRUMENTS);
    expect([...result]).toEqual(['Drums', 'Bass', 'Keys', 'Guitar', 'Pads']);
  });

  it('returns the same reference as INSTRUMENTS', () => {
    const result = getAllInstruments();
    expect(result).toStrictEqual(INSTRUMENTS);
  });
});
