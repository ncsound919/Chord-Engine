import { describe, it, expect } from 'vitest';

import {
  isTauri,
  listMidiInputs,
  listMidiOutputs,
  getMidiConnectionStatus,
  disconnectMidiInput,
  disconnectMidiOutput,
  openFileDialog,
  openFolderDialog,
  saveFileDialog,
  scanDirectory,
  readText,
  writeText,
  minimizeWindow,
  maximizeWindow,
  closeWindow,
  listenMidiEvent,
  connectMidiInput,
  connectMidiOutput,
} from './tauriBridge';

describe('tauriBridge — browser fallback (no Tauri)', () => {
  it('isTauri returns false', () => {
    expect(isTauri()).toBe(false);
  });

  it('listMidiInputs returns empty array', async () => {
    expect(await listMidiInputs()).toEqual([]);
  });

  it('listMidiOutputs returns empty array', async () => {
    expect(await listMidiOutputs()).toEqual([]);
  });

  it('getMidiConnectionStatus returns disconnected status', async () => {
    const status = await getMidiConnectionStatus();
    expect(status).toEqual({
      input_connected: false,
      input_port: null,
      output_connected: false,
      output_port: null,
    });
  });

  it('disconnectMidiInput resolves without error', async () => {
    await expect(disconnectMidiInput()).resolves.toBeUndefined();
  });

  it('disconnectMidiOutput resolves without error', async () => {
    await expect(disconnectMidiOutput()).resolves.toBeUndefined();
  });

  it('openFileDialog returns null', async () => {
    expect(await openFileDialog()).toBeNull();
  });

  it('openFolderDialog returns null', async () => {
    expect(await openFolderDialog()).toBeNull();
  });

  it('saveFileDialog returns null', async () => {
    expect(await saveFileDialog('test.wav')).toBeNull();
  });

  it('scanDirectory returns empty array', async () => {
    expect(await scanDirectory('/some/path')).toEqual([]);
  });

  it('readText returns empty string', async () => {
    expect(await readText('/some/path')).toBe('');
  });

  it('writeText resolves without error', async () => {
    await expect(writeText('/some/path', 'content')).resolves.toBeUndefined();
  });

  it('minimizeWindow resolves without error', async () => {
    await expect(minimizeWindow()).resolves.toBeUndefined();
  });

  it('maximizeWindow returns false when Tauri not available', async () => {
    await expect(maximizeWindow()).resolves.toBe(false);
  });

  it('closeWindow resolves without error', async () => {
    await expect(closeWindow()).resolves.toBeUndefined();
  });

  it('listenMidiEvent returns a function (unlisten callback)', () => {
    const unlisten = listenMidiEvent(() => {});
    expect(typeof unlisten).toBe('function');
  });

  it('connectMidiInput throws when Tauri not available', async () => {
    await expect(connectMidiInput(0)).rejects.toThrow('Tauri not available');
  });

  it('connectMidiOutput throws when Tauri not available', async () => {
    await expect(connectMidiOutput(0)).rejects.toThrow('Tauri not available');
  });
});
