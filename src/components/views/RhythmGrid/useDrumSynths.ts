import { useEffect, useMemo } from 'react';
import * as Tone from 'tone';
import { audioEngine } from '../../../lib/audio/engine';
import { DRUM_DEFINITIONS } from './constants';

export function useDrumSynths() {
  const synths = useMemo(() => {
    const kick = new Tone.MembraneSynth({
      pitchDecay: 0.05,
      octaves: 10,
      oscillator: { type: 'sine' },
      envelope: { attack: 0.001, decay: 0.4, sustain: 0.01, release: 1.4 }
    });

    const snare = new Tone.NoiseSynth({
      noise: { type: 'white' },
      envelope: { attack: 0.001, decay: 0.2, sustain: 0, release: 0.2 }
    });

    const hat = new Tone.MetalSynth({
      envelope: { attack: 0.001, decay: 0.1, release: 0.1 },
      harmonicity: 5.1,
      modulationIndex: 32,
      resonance: 4000,
      octaves: 1.5
    });

    const tom = new Tone.MembraneSynth({
      pitchDecay: 0.1,
      octaves: 4,
      oscillator: { type: 'sine' },
      envelope: { attack: 0.001, decay: 0.3, sustain: 0.01, release: 0.6 },
    });

    return { kick, snare, hat, tom };
  }, []);

  useEffect(() => {
    const drumTrack = audioEngine.tracks.get('drums');
    if (drumTrack) {
      synths.kick.connect(drumTrack.filter);
      synths.snare.connect(drumTrack.filter);
      synths.hat.connect(drumTrack.filter);
      synths.tom.connect(drumTrack.filter);
    }

    return () => {
      // Cleanup: disconnect and dispose all synths
      synths.kick.dispose();
      synths.snare.dispose();
      synths.hat.dispose();
      synths.tom.dispose();
    };
  }, [synths]);

  const triggerSynth = (drumId: string, time: number) => {
    const drum = DRUM_DEFINITIONS.find(d => d.id === drumId);
    if (!drum) return;

    switch (drum.type) {
      case 'kick':
        synths.kick.triggerAttackRelease('C1', '8n', time);
        break;
      case 'snare':
        synths.snare.triggerAttackRelease('8n', time);
        break;
      case 'hat':
        const hatDur = drumId === 'HH Open' ? '8n' : '32n';
        const hatVel = drumId === 'HH Open' ? 0.5 : 0.3;
        synths.hat.triggerAttackRelease(hatDur, time, hatVel);
        break;
      case 'tom':
        const tomNote = drumId === 'Tom High' ? 'G2' : drumId === 'Tom Mid' ? 'D2' : 'A1';
        synths.tom.triggerAttackRelease(tomNote, '8n', time);
        break;
      case 'perc':
        const percDur = drumId === 'Ride' ? '16n' : '4n';
        const percVel = drumId === 'Ride' ? 0.4 : 0.6;
        synths.hat.triggerAttackRelease(percDur, time, percVel);
        break;
    }
  };

  return { triggerSynth };
}
