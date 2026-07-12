#pragma once

#include "MixerBus.h"
#include <juce_audio_basics/juce_audio_basics.h>
#include <map>
#include <memory>

class DrumRack;
class SynthRack;

class AudioGraph
{
public:
    AudioGraph();
    ~AudioGraph() = default;

    void prepare (double sampleRate, int blockSize, int outputChannels);
    void process (juce::AudioBuffer<float>& output, juce::MidiBuffer& midi);

    MixerBus& getBus (BusId id);
    MixerBus& getBusByName (const juce::String& name);

    void setMasterGain (float g) { master.setGain (g); }
    float getMasterGain() const { return master.getGain(); }

    // Track-level solo coordination
    void updateSoloState();
    bool hasSoloedTrack() const;

private:
    // Child drum buses
    MixerBus kick, snare, hats, toms, overheads;
    // Parent drum bus
    MixerBus drums;
    // Synth/Instrument buses
    MixerBus bass, lead, pads, keys, guitar, oneShots;
    // Master output
    MixerBus master;

    juce::AudioBuffer<float> drumScratch;

    std::unique_ptr<DrumRack> drumRack;
    std::unique_ptr<SynthRack> synthRack;

    struct BusEntry {
        BusId id;
        MixerBus* bus;
        juce::String name;
    };
    std::vector<BusEntry> allBuses;
    bool isPrepared = false;
};
