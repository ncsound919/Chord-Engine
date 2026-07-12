#pragma once

#include <juce_audio_basics/juce_audio_basics.h>
#include <juce_audio_devices/juce_audio_devices.h>
#include <juce_audio_processors/juce_audio_processors.h>
#include <juce_audio_utils/juce_audio_utils.h>

enum class BusId
{
    kick, snare, hats, toms, overheads,
    drums,
    bass, lead, pads, keys, guitar, oneShots,
    master
};

class MixerBus
{
public:
    MixerBus (const juce::String& name);

    void prepare (double sampleRate, int blockSize);
    void release();
    void process (juce::AudioBuffer<float>& buffer);

    void setGain (float g) { gain = juce::jlimit (0.0f, 1.2f, g); }
    float getGain() const { return gain; }

    void setPan (float p) { pan = juce::jlimit (-1.0f, 1.0f, p); }
    float getPan() const { return pan; }

    void setMuted (bool m) { muted = m; }
    bool isMuted() const { return muted; }

    void setSolo (bool s) { solo = s; }
    bool isSolo() const { return solo; }

    juce::AudioBuffer<float>& getScratchBuffer() { return scratch; }
    const juce::String& getName() const { return busName; }

private:
    juce::String busName;
    juce::AudioBuffer<float> scratch;
    float gain = 0.8f;
    float pan = 0.0f;
    bool muted = false;
    bool solo = false;
    double currentSampleRate = 44100.0;
};
