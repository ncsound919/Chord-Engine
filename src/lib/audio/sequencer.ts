import * as Tone from 'tone';
import { transport, audioEngine, Track } from './engine';
import { Ju60Engine } from './synth';
import { GeneratedSection, GeneratedChord } from '../engine';

// Hoisted to module scope — was previously reallocated on every drum hit.
const DRUM_SAMPLE_MAP: Record<string, string> = {
  'Kick': 'Kick',
  'Snare': 'Snare',
  'HH Closed': 'Hi-Hat Closed',
  'HH Open': 'Hi-Hat Open',
  'Hi-Hat Closed': 'Hi-Hat Closed',
  'Hi-Hat Open': 'Hi-Hat Open',
  'Crash': 'Crash',
  'Ride': 'Ride',
  'Tom High': 'Tom 1',
  'Tom Mid': 'Tom 2',
  'Tom Floor': 'Tom 3',
  'Tom 1': 'Tom 1',
  'Tom 2': 'Tom 2',
  'Tom 3': 'Tom 3',
};

/** Drum name → submix track mapping so mixer faders actually control levels. */
const DRUM_TRACK_MAP: Record<string, string> = {
  Kick: 'kick',
  Snare: 'snare',
  'HH Closed': 'hihat',
  'HH Open': 'hihat',
  'Hi-Hat Closed': 'hihat',
  'Hi-Hat Open': 'hihat',
  'Tom High': 'toms',
  'Tom Mid': 'toms',
  'Tom Floor': 'toms',
  'Tom 1': 'toms',
  'Tom 2': 'toms',
  'Tom 3': 'toms',
  Crash: 'overhead',
  Ride: 'overhead',
};

// Named step groups instead of unexplained magic-number arrays.
const HOUSE_OFFBEATS = [2, 6, 10, 14, 18, 22, 26, 30];
const WALKING_QUARTER_STEPS = [0, 4, 8, 12, 16, 20, 24, 28];
const FUNK_SYNCOPATED_STEPS = [0, 3, 6, 10, 12, 14, 16, 19, 22, 26, 28, 30];
const FUNK_OCTAVE_STEPS = [3, 14, 22, 30];
const FUNK_FIFTH_STEPS = [6, 12, 26];

const STEPS_PER_PATTERN = 32;

function getTrack(id: string): Track | undefined {
  return audioEngine.tracks.get(id);
}

export class Sequencer {
  private static instance: Sequencer;
  private currentSections: GeneratedSection[] = [];
  private isRunning = false;
  private lastProcessedBeat = -1;
  private onBeatHandler: (beat: number, time: number) => void;

  // Cache of the resolved chord context for the last integer beat processed,
  // so the O(n) chord scan doesn't re-run on every 16th-note sub-tick.
  private cachedBeatKey: string | null = null;
  private cachedActiveChord: GeneratedChord | null = null;
  private cachedNextChord: GeneratedChord | null = null;

  private unsubscribeBeat: (() => void) | null = null;

  private constructor() {
    this.onBeatHandler = (beat, time) => this.processBeat(beat, time);
    this.unsubscribeBeat = transport.addBeatCallback(this.onBeatHandler);
  }

  static getInstance(): Sequencer {
    if (!Sequencer.instance) {
      Sequencer.instance = new Sequencer();
    }
    return Sequencer.instance;
  }

  /** Reset the singleton for test isolation. Disposes the current instance. */
  static resetInstance() {
    if (Sequencer.instance) {
      Sequencer.instance.dispose();
      Sequencer.instance = undefined as any;
    }
  }

  /** Unregister from transport. Call if the sequencer is ever torn down. */
  dispose() {
    if (this.unsubscribeBeat) {
      this.unsubscribeBeat();
      this.unsubscribeBeat = null;
    }
  }

  setSections(sections: GeneratedSection[]) {
    this.currentSections = sections;
    // Section context changed — invalidate the chord cache.
    this.cachedBeatKey = null;
  }

  private processBeat(beat: number, time: number) {
    if (this.currentSections.length === 0) return;

    let totalBeatsAcc = 0;
    let targetSection: GeneratedSection | null = null;
    let localBeat = 0;

    for (const section of this.currentSections) {
      const sectionBeats = section.def.lengthBars * (section.def.beatsPerBar || 4);
      if (beat < totalBeatsAcc + sectionBeats) {
        targetSection = section;
        localBeat = beat - totalBeatsAcc;
        break;
      }
      totalBeatsAcc += sectionBeats;
    }

    if (!targetSection) {
      const totalLoopBeats = totalBeatsAcc;
      const loopedBeat = beat % totalLoopBeats;
      totalBeatsAcc = 0;
      for (const section of this.currentSections) {
        const sectionBeats = section.def.lengthBars * (section.def.beatsPerBar || 4);
        if (loopedBeat < totalBeatsAcc + sectionBeats) {
          targetSection = section;
          localBeat = loopedBeat - totalBeatsAcc;
          break;
        }
        totalBeatsAcc += sectionBeats;
      }
    }

    if (!targetSection) return;

    const isIntegerBeat = Math.abs(beat - Math.round(beat)) < 0.001;
    const bar = Math.floor(localBeat / (targetSection.def.beatsPerBar || 4));
    const beatInBar = Math.floor(localBeat % (targetSection.def.beatsPerBar || 4)) + 1;

    // 32 steps per 2 bars (8 beats) = 4 steps per beat.
    // Clamped to avoid a floating-point edge case (e.g. localBeat % 8 landing
    // at 7.99999...) rounding up to 32, which is out of range for the grid.
    const stepInPattern = Math.min(
      STEPS_PER_PATTERN - 1,
      Math.round((localBeat % 8) * 4)
    );

    const tempo = Tone.getTransport().bpm.value;
    const sixteenthDuration = 15 / tempo;
    const swingAmount = targetSection.drumPattern?.swing || 0;

    let adjustedTime = time;
    if (stepInPattern % 2 === 1 && swingAmount > 0) {
      const swingDelay = (swingAmount / 100) * (sixteenthDuration * 0.33);
      adjustedTime += swingDelay;
    }

    // Trigger Chords (only on integer beats).
    // Chords intentionally stay anchored to the raw beat time (not
    // adjustedTime) — harmony onsets are not swung, only the rhythm section.
    if (isIntegerBeat) {
      const chord = targetSection.chords.find(c => c.bar === bar && c.beat === beatInBar);
      if (chord) {
        this.triggerChord(chord, time);
      }
    }

    const currentBar = Math.floor(localBeat / (targetSection.def.beatsPerBar || 4)) + 1;
    const currentBeat = (localBeat % (targetSection.def.beatsPerBar || 4)) + 1;

    const { activeChord, nextChord } = this.resolveChordContext(
      targetSection,
      currentBar,
      currentBeat
    );

    this.playRhythmicBass(targetSection, stepInPattern, adjustedTime, activeChord, nextChord);

    if (targetSection.drumPattern) {
      const grid = targetSection.drumPattern.grid;

      Object.entries(grid).forEach(([drum, steps]) => {
        if (!steps[stepInPattern]) return;

        const sampleName = this.mapDrumToSample(drum);
        const buffer = audioEngine.loadedSamples.get(sampleName);

        const trackId = DRUM_TRACK_MAP[drum] ?? 'drums';
        const drumTrack = getTrack(trackId) ?? getTrack('drums');

        if (buffer && drumTrack) {
          drumTrack.playBuffer(buffer, adjustedTime);
        } else {
          this.playSynthesizedDrum(drum, adjustedTime);
        }
      });
    }
  }

  /**
   * Resolves the active/next chord for the current beat position, cached
   * per integer-beat so repeated 16th-note sub-ticks within the same beat
   * don't re-scan the chords array each time.
   */
  private resolveChordContext(
    section: GeneratedSection,
    currentBar: number,
    currentBeat: number
  ): { activeChord: GeneratedChord | null; nextChord: GeneratedChord | null } {
    const beatKey = `${this.currentSections.indexOf(section)}:${currentBar}:${Math.floor(currentBeat)}`;

    if (this.cachedBeatKey === beatKey) {
      return { activeChord: this.cachedActiveChord, nextChord: this.cachedNextChord };
    }

    let activeChord: GeneratedChord | null = null;
    let nextChord: GeneratedChord | null = null;
    let maxChordScore = -1;

    for (const c of section.chords) {
      const score = (c.bar * 100) + c.beat;
      const currentScore = (currentBar * 100) + currentBeat;
      if (score <= currentScore && score > maxChordScore) {
        maxChordScore = score;
        activeChord = c;
      }
    }
    if (!activeChord && section.chords.length > 0) {
      activeChord = section.chords[0];
    }

    if (activeChord) {
      const activeIdx = section.chords.indexOf(activeChord);
      if (activeIdx !== -1 && activeIdx < section.chords.length - 1) {
        nextChord = section.chords[activeIdx + 1];
      }
    }

    this.cachedBeatKey = beatKey;
    this.cachedActiveChord = activeChord;
    this.cachedNextChord = nextChord;

    return { activeChord, nextChord };
  }

  private mapDrumToSample(drum: string): string {
    return DRUM_SAMPLE_MAP[drum] || drum;
  }

  private playSynthesizedDrum(drum: string, time: number) {
    const trackId = DRUM_TRACK_MAP[drum] ?? 'drums';
    const track = getTrack(trackId) ?? getTrack('drums');
    if (!track) return;

    if (drum === 'Kick') {
      track.playNote(50, 'sine', time, 0.1, { attack: 0.005, decay: 0.1, sustain: 0, release: 0.1 });
    } else if (drum === 'Snare') {
      track.playNote(200, 'triangle', time, 0.1, { attack: 0.005, decay: 0.05, sustain: 0, release: 0.05 });
    } else if (drum.includes('HH') || drum.includes('Hi-Hat')) {
      track.playNote(8000, 'sine', time, 0.05, { attack: 0.001, decay: 0.02, sustain: 0, release: 0.02 });
    }
  }

  private playRhythmicBass(
    section: GeneratedSection,
    stepInPattern: number,
    time: number,
    activeChord: GeneratedChord | null,
    nextChord: GeneratedChord | null
  ) {
    if (!activeChord) return;
    const synth = Ju60Engine.getInstance();
    const preset = section.def.preset || 'pop';
    const kickPlacement = section.timeFeel?.kickPlacementStyle || 'syncopated_offbeat';

    const rootMidi = activeChord.bassNote?.midi !== undefined ? activeChord.bassNote.midi : 36;
    const isMinor = activeChord.quality?.includes('m') || false;

    const octaveMidi = rootMidi + 12;
    const fifthMidi = rootMidi + 7;
    const thirdMidi = rootMidi + (isMinor ? 3 : 4);

    let noteToPlay: number | null = null;
    let duration = 0.2;
    let velocity = 0.8;

    if (kickPlacement === 'four_on_floor' || preset === 'techno') {
      if (stepInPattern === 0 || stepInPattern === 16) {
        noteToPlay = rootMidi;
        duration = 0.25;
      } else if (HOUSE_OFFBEATS.includes(stepInPattern)) {
        noteToPlay = stepInPattern % 8 === 2 ? octaveMidi : fifthMidi;
        duration = 0.2;
      }
    } else if (kickPlacement === 'jazz_swing' || preset === 'jazz') {
      if (WALKING_QUARTER_STEPS.includes(stepInPattern)) {
        duration = 0.4;
        const beatIndex = Math.floor(stepInPattern / 4);
        if (beatIndex === 0 || beatIndex === 4) {
          noteToPlay = rootMidi;
        } else if (beatIndex === 3 || beatIndex === 7) {
          if (nextChord && nextChord.bassNote !== undefined) {
            // Chromatic approach tone: step one half-step TOWARD the next
            // root, not always downward. Previously this always subtracted
            // 1 semitone, which produced a leap instead of a smooth
            // half-step approach whenever the next root was below the
            // current one.
            const target = nextChord.bassNote.midi;
            noteToPlay = target > rootMidi ? target - 1 : target + 1;
          } else {
            noteToPlay = fifthMidi;
          }
        } else if (beatIndex === 1 || beatIndex === 5) {
          noteToPlay = thirdMidi;
        } else {
          noteToPlay = fifthMidi;
        }
      }
    } else if (preset === 'sylvers' || preset === 'funk' || preset === 'isley') {
      if (FUNK_SYNCOPATED_STEPS.includes(stepInPattern)) {
        duration = stepInPattern % 4 === 0 ? 0.35 : 0.15;
        velocity = stepInPattern % 4 === 0 ? 0.85 : 0.65;
        if (stepInPattern === 0 || stepInPattern === 16) {
          noteToPlay = rootMidi;
        } else if (FUNK_OCTAVE_STEPS.includes(stepInPattern)) {
          noteToPlay = octaveMidi;
        } else if (FUNK_FIFTH_STEPS.includes(stepInPattern)) {
          noteToPlay = fifthMidi;
        } else {
          noteToPlay = thirdMidi;
        }
      }
    } else {
      const kickGrid = section.drumPattern?.grid?.['Kick'];
      if (kickGrid && kickGrid[stepInPattern]) {
        noteToPlay = rootMidi;
        duration = 0.5;
        velocity = 0.9;
      } else if (stepInPattern === 0 || stepInPattern === 16) {
        noteToPlay = rootMidi;
        duration = 0.4;
      }
    }

    if (noteToPlay !== null) {
      const bassSample = audioEngine.loadedSamples.get('bass');
      if (bassSample) {
        const bassTrack = getTrack('bass');
        if (bassTrack) {
          const rate = Math.pow(2, (noteToPlay - 36) / 12);
          bassTrack.playBufferShifted(bassSample, rate, time, 0, duration, velocity);
        }
      } else {
        synth.triggerNote('bass', noteToPlay, velocity, time, duration);
      }
    }
  }

  private triggerChord(chord: GeneratedChord, time: number) {
    const synth = Ju60Engine.getInstance();

    if (chord.pianoVoicing) {
      chord.pianoVoicing.notes.forEach(note => {
        synth.triggerNote('pad', note, 0.4, time, 1.8);
      });
    }

    // Note: Bass is handled rhythmically, not triggered statically here.

    if (chord.pianoVoicing && chord.pianoVoicing.notes.length > 0) {
      const notes = chord.pianoVoicing.notes;
      synth.triggerNote('lead', notes[notes.length - 1], 0.7, time, 0.4);
    }
  }
}

export const sequencer = Sequencer.getInstance();
