import { useState, useEffect, useCallback, useRef } from 'react';
import {
  MidiPortInfo,
  MidiConnectionStatus,
  MidiNoteEvent,
  listMidiInputs,
  listMidiOutputs,
  connectMidiInput,
  connectMidiOutput,
  disconnectMidiInput,
  disconnectMidiOutput,
  getMidiConnectionStatus,
  listenMidiEvent,
} from '../lib/tauriBridge';

export interface MidiHardwareState {
  available: boolean;
  inputs: MidiPortInfo[];
  outputs: MidiPortInfo[];
  connection: MidiConnectionStatus;
  error: string | null;
}

export function useMidiHardware(onNoteEvent?: (event: MidiNoteEvent) => void) {
  const [state, setState] = useState<MidiHardwareState>({
    available: false,
    inputs: [],
    outputs: [],
    connection: { input_connected: false, input_port: null, output_connected: false, output_port: null },
    error: null,
  });

  const onNoteEventRef = useRef(onNoteEvent);
  onNoteEventRef.current = onNoteEvent;

  useEffect(() => {
    const unlisten = listenMidiEvent((event) => {
      onNoteEventRef.current?.(event);
    });
    return unlisten;
  }, []);

  const refreshPorts = useCallback(async () => {
    try {
      const [inputs, outputs, connection] = await Promise.all([
        listMidiInputs(),
        listMidiOutputs(),
        getMidiConnectionStatus(),
      ]);
      setState(prev => ({ ...prev, inputs, outputs, connection, available: inputs.length > 0 || outputs.length > 0 }));
    } catch (err: any) {
      // Silently ignore — running in browser or no MIDI subsystem
    }
  }, []);

  useEffect(() => {
    refreshPorts();
  }, [refreshPorts]);

  const connectInput = useCallback(async (portIndex: number) => {
    try {
      const name = await connectMidiInput(portIndex);
      setState(prev => ({
        ...prev,
        error: null,
        connection: { ...prev.connection, input_connected: true, input_port: name },
      }));
    } catch (err: any) {
      setState(prev => ({ ...prev, error: `MIDI input: ${err}` }));
    }
  }, []);

  const connectOutput = useCallback(async (portIndex: number) => {
    try {
      const name = await connectMidiOutput(portIndex);
      setState(prev => ({
        ...prev,
        error: null,
        connection: { ...prev.connection, output_connected: true, output_port: name },
      }));
    } catch (err: any) {
      setState(prev => ({ ...prev, error: `MIDI output: ${err}` }));
    }
  }, []);

  const disconnectInput = useCallback(async () => {
    await disconnectMidiInput();
    setState(prev => ({
      ...prev,
      error: null,
      connection: { ...prev.connection, input_connected: false, input_port: null },
    }));
  }, []);

  const disconnectOutput = useCallback(async () => {
    await disconnectMidiOutput();
    setState(prev => ({
      ...prev,
      error: null,
      connection: { ...prev.connection, output_connected: false, output_port: null },
    }));
  }, []);

  return {
    ...state,
    refreshPorts,
    connectInput,
    connectOutput,
    disconnectInput,
    disconnectOutput,
  };
}
