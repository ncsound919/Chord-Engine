import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Ju60Arpeggiator, CHORUS_MODE_SETTINGS } from './arp';

const hoisted = vi.hoisted(() => {
  const transport = {
    scheduleRepeat: vi.fn(() => 1),
    scheduleOnce: vi.fn(),
    clear: vi.fn(),
  };
  return { transport };
});

vi.mock('tone', () => ({
  getTransport: () => hoisted.transport,
  now: () => 0,
}));

import * as Tone from 'tone';

describe('Ju60Arpeggiator', () => {
  let arp: Ju60Arpeggiator;
  const triggerOn = vi.fn();
  const triggerOff = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    triggerOn.mockReset();
    triggerOff.mockReset();
    arp = new Ju60Arpeggiator(triggerOn, triggerOff);
  });

  it('constructor stores triggerNoteOn and triggerNoteOff', () => {
    arp.mode = 'CHORD';
    arp.addNote(60);
    expect(triggerOn).toHaveBeenCalledWith(60, 0);
  });

  it('default mode is OFF', () => {
    expect(arp.mode).toBe('OFF');
  });

  it('default rate is 4', () => {
    expect(arp.rate).toBe(4);
  });

  it('default octaveRange is 1', () => {
    expect(arp.octaveRange).toBe(1);
  });

  it('default gate is 0.8', () => {
    expect(arp.gate).toBe(0.8);
  });

  it('mode setter to OFF stops arp (clears event)', () => {
    arp.addNote(60);
    arp.mode = 'UP';
    expect(hoisted.transport.scheduleRepeat).toHaveBeenCalled();
    arp.mode = 'OFF';
    expect(hoisted.transport.clear).toHaveBeenCalled();
    expect(arp.mode).toBe('OFF');
  });

  it('mode setter to non-OFF starts arp if notes exist', () => {
    arp.addNote(60);
    arp.mode = 'UP';
    expect(hoisted.transport.scheduleRepeat).toHaveBeenCalled();
  });

  it('mode setter to non-OFF does not start arp if notes are empty', () => {
    hoisted.transport.scheduleRepeat.mockClear();
    arp.mode = 'UP';
    expect(hoisted.transport.scheduleRepeat).not.toHaveBeenCalled();
  });

  it('rate setter clamps to 1-16 range', () => {
    arp.rate = 0;
    expect(arp.rate).toBe(1);
    arp.rate = 20;
    expect(arp.rate).toBe(16);
  });

  it('rate setter restarts arp if running', () => {
    arp.addNote(60);
    arp.mode = 'UP';
    hoisted.transport.clear.mockClear();
    hoisted.transport.scheduleRepeat.mockClear();
    arp.rate = 8;
    expect(hoisted.transport.clear).toHaveBeenCalled();
    expect(hoisted.transport.scheduleRepeat).toHaveBeenCalled();
  });

  it('rate setter does not restart if not running', () => {
    hoisted.transport.clear.mockClear();
    arp.rate = 8;
    expect(hoisted.transport.clear).not.toHaveBeenCalled();
  });

  it('octaveRange setter clamps to 1-3', () => {
    arp.octaveRange = 0;
    expect(arp.octaveRange).toBe(1);
    arp.octaveRange = 5;
    expect(arp.octaveRange).toBe(3);
  });

  it('gate setter clamps to 0.01-1', () => {
    arp.gate = 0;
    expect(arp.gate).toBe(0.01);
    arp.gate = 2;
    expect(arp.gate).toBe(1);
  });

  it('addNote adds to notes set', () => {
    arp.addNote(60);
    arp.addNote(64);
    expect(arp.notes.size).toBe(2);
    expect(arp.notes.has(60)).toBe(true);
    expect(arp.notes.has(64)).toBe(true);
  });

  it('addNote in CHORD mode triggers chord immediately', () => {
    arp.mode = 'CHORD';
    arp.addNote(60, 0);
    expect(triggerOn).toHaveBeenCalledTimes(1);
    expect(triggerOn).toHaveBeenCalledWith(60, 0);
  });

  it('addNote in CHORD mode triggers all held notes on each add', () => {
    arp.mode = 'CHORD';
    arp.addNote(60, 0);
    arp.addNote(64, 0);
    expect(triggerOn).toHaveBeenCalledTimes(3);
    expect(triggerOn).toHaveBeenCalledWith(60, 0);
    expect(triggerOn).toHaveBeenCalledWith(64, 0);
  });

  it('removeNote removes from notes set', () => {
    arp.addNote(60);
    arp.addNote(64);
    arp.removeNote(60);
    expect(arp.notes.has(60)).toBe(false);
    expect(arp.notes.size).toBe(1);
  });

  it('removeNote resets step and direction when notes become empty', () => {
    arp.addNote(60);
    arp.mode = 'UP';
    arp.removeNote(60);
    expect(arp.notes.size).toBe(0);
  });

  it('allNotesOff triggers note off for all notes and clears set', () => {
    arp.addNote(60);
    arp.addNote(64);
    arp.addNote(67);
    arp.allNotesOff();
    expect(triggerOff).toHaveBeenCalledTimes(3);
    expect(arp.notes.size).toBe(0);
  });

  it('dispose calls allNotesOff', () => {
    arp.addNote(60);
    arp.dispose();
    expect(triggerOff).toHaveBeenCalled();
    expect(arp.notes.size).toBe(0);
  });

  it('CHORD mode _step returns early (no scheduleOnce)', () => {
    arp.mode = 'CHORD';
    arp.addNote(60);
    expect(hoisted.transport.scheduleOnce).not.toHaveBeenCalled();
  });
});

describe('CHORUS_MODE_SETTINGS', () => {
  it('has correct keys', () => {
    expect(CHORUS_MODE_SETTINGS).toHaveProperty('OFF');
    expect(CHORUS_MODE_SETTINGS).toHaveProperty('I');
    expect(CHORUS_MODE_SETTINGS).toHaveProperty('II');
    expect(CHORUS_MODE_SETTINGS).toHaveProperty('BOTH');
  });

  it('OFF settings have wet=0', () => {
    expect(CHORUS_MODE_SETTINGS.OFF.wet).toBe(0);
  });

  it('I settings have expected values', () => {
    expect(CHORUS_MODE_SETTINGS.I.wet).toBe(0.6);
    expect(CHORUS_MODE_SETTINGS.I.frequency).toBe(1.5);
    expect(CHORUS_MODE_SETTINGS.I.depth).toBe(0.45);
  });

  it('II settings have expected values', () => {
    expect(CHORUS_MODE_SETTINGS.II.wet).toBe(0.7);
    expect(CHORUS_MODE_SETTINGS.II.frequency).toBe(8);
    expect(CHORUS_MODE_SETTINGS.II.depth).toBe(0.25);
  });

  it('BOTH settings have expected values', () => {
    expect(CHORUS_MODE_SETTINGS.BOTH.wet).toBe(0.9);
    expect(CHORUS_MODE_SETTINGS.BOTH.frequency).toBe(4);
    expect(CHORUS_MODE_SETTINGS.BOTH.depth).toBe(0.8);
  });
});
