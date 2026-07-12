let tauriAvailable = false;
try {
  if (typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window) {
    tauriAvailable = true;
  }
} catch {
  // Browser environment — Tauri not available
}

export function isTauri(): boolean {
  return tauriAvailable;
}

export interface MidiPortInfo {
  name: string;
  index: number;
}

export interface MidiConnectionStatus {
  input_connected: boolean;
  input_port: string | null;
  output_connected: boolean;
  output_port: string | null;
}

// ── MIDI ────────────────────────────────────────────────────────────────────────

export async function listMidiInputs(): Promise<MidiPortInfo[]> {
  if (!tauriAvailable) return [];
  const { invoke } = await import('@tauri-apps/api/core');
  return invoke<MidiPortInfo[]>('list_midi_inputs');
}

export async function listMidiOutputs(): Promise<MidiPortInfo[]> {
  if (!tauriAvailable) return [];
  const { invoke } = await import('@tauri-apps/api/core');
  return invoke<MidiPortInfo[]>('list_midi_outputs');
}

export async function connectMidiInput(portIndex: number): Promise<string> {
  if (!tauriAvailable) throw new Error('Tauri not available');
  const { invoke } = await import('@tauri-apps/api/core');
  return invoke<string>('connect_midi_input', { portIndex });
}

export async function connectMidiOutput(portIndex: number): Promise<string> {
  if (!tauriAvailable) throw new Error('Tauri not available');
  const { invoke } = await import('@tauri-apps/api/core');
  return invoke<string>('connect_midi_output', { portIndex });
}

export async function disconnectMidiInput(): Promise<void> {
  if (!tauriAvailable) return;
  const { invoke } = await import('@tauri-apps/api/core');
  await invoke('disconnect_midi_input');
}

export async function disconnectMidiOutput(): Promise<void> {
  if (!tauriAvailable) return;
  const { invoke } = await import('@tauri-apps/api/core');
  await invoke('disconnect_midi_output');
}

export async function getMidiConnectionStatus(): Promise<MidiConnectionStatus> {
  if (!tauriAvailable) return { input_connected: false, input_port: null, output_connected: false, output_port: null };
  const { invoke } = await import('@tauri-apps/api/core');
  return invoke<MidiConnectionStatus>('get_midi_connection_status');
}

// ── Native Dialogs ──────────────────────────────────────────────────────────────

export async function openFileDialog(filters?: Array<{ name: string; extensions: string[] }>): Promise<string | null> {
  if (!tauriAvailable) return null;
  const { open } = await import('@tauri-apps/plugin-dialog');
  const selected = await open({ multiple: false, filters });
  return selected as string | null;
}

export async function openFolderDialog(): Promise<string | null> {
  if (!tauriAvailable) return null;
  const { open } = await import('@tauri-apps/plugin-dialog');
  const selected = await open({ directory: true, multiple: false });
  return selected as string | null;
}

export async function saveFileDialog(defaultName: string, filters?: Array<{ name: string; extensions: string[] }>): Promise<string | null> {
  if (!tauriAvailable) return null;
  const { save } = await import('@tauri-apps/plugin-dialog');
  return save({ defaultPath: defaultName, filters });
}

// ── Filesystem ──────────────────────────────────────────────────────────────────

export async function scanDirectory(dirPath: string): Promise<string[]> {
  if (!tauriAvailable) return [];
  const { readDir } = await import('@tauri-apps/plugin-fs');
  const entries = await readDir(dirPath);
  return entries.filter((e: any) => e.isFile).map((e: any) => e.name);
}

export async function readText(path: string): Promise<string> {
  if (!tauriAvailable) return '';
  const { readTextFile } = await import('@tauri-apps/plugin-fs');
  return readTextFile(path);
}

export async function writeText(path: string, content: string): Promise<void> {
  if (!tauriAvailable) return;
  const { writeTextFile } = await import('@tauri-apps/plugin-fs');
  await writeTextFile(path, content);
}

// ── MIDI Event Listener ────────────────────────────────────────────────────────

export interface MidiNoteEvent {
  type: 'note_on' | 'note_off' | 'cc';
  note: number;
  velocity: number;
  channel: number;
}

export function listenMidiEvent(callback: (event: MidiNoteEvent) => void): () => void {
  if (!tauriAvailable) return () => {};
  let unlisten: (() => void) | null = null;
  import('@tauri-apps/api/event').then(({ listen }) => {
    listen<MidiNoteEvent>('midi-event', (e) => callback(e.payload)).then((fn) => {
      unlisten = fn;
    });
  });
  return () => { unlisten?.(); };
}

// ── Window Control ──────────────────────────────────────────────────────────────

export async function minimizeWindow(): Promise<void> {
  if (!tauriAvailable) return;
  const { getCurrentWindow } = await import('@tauri-apps/api/window');
  await getCurrentWindow().minimize();
}

export async function maximizeWindow(): Promise<boolean> {
  if (!tauriAvailable) return false;
  const { getCurrentWindow } = await import('@tauri-apps/api/window');
  const w = getCurrentWindow();
  await w.toggleMaximize();
  return w.isMaximized();
}

export async function closeWindow(): Promise<void> {
  if (!tauriAvailable) return;
  const { getCurrentWindow } = await import('@tauri-apps/api/window');
  await getCurrentWindow().close();
}
