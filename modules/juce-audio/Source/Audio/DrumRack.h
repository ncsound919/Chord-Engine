#pragma once

#include <juce_audio_basics/juce_audio_basics.h>
#include <juce_audio_utils/juce_audio_utils.h>

class DrumRack
{
public:
    DrumRack();
    ~DrumRack() = default;

    void prepare (double sampleRate, int blockSize);
    void render (juce::AudioBuffer<float>& buffer, juce::MidiBuffer& midi);

    void loadSample (const juce::String& drumName, juce::AudioSampleBuffer* sample);
    void triggerDrum (const juce::String& drumName, float velocity = 1.0f);

private:
    struct PlayingSample {
        const juce::AudioSampleBuffer* buffer = nullptr;
        int readPosition = 0;
        float gain = 1.0f;
    };

    std::map<juce::String, juce::AudioSampleBuffer*> drumSamples;
    std::vector<PlayingSample> activeSamples;
    double sampleRate = 44100.0;
};

inline DrumRack::DrumRack() {}

inline void DrumRack::prepare (double sr, int)
{
    sampleRate = sr;
}

inline void DrumRack::loadSample (const juce::String& drumName, juce::AudioSampleBuffer* sample)
{
    drumSamples[drumName] = sample;
}

inline void DrumRack::triggerDrum (const juce::String& drumName, float velocity)
{
    auto it = drumSamples.find (drumName);
    if (it != drumSamples.end() && it->second)
    {
        PlayingSample ps;
        ps.buffer = it->second;
        ps.readPosition = 0;
        ps.gain = velocity;
        activeSamples.push_back (ps);
    }
}

inline void DrumRack::render (juce::AudioBuffer<float>& buffer, juce::MidiBuffer& midi)
{
    // Process MIDI note triggers
    for (const auto& event : midi)
    {
        auto msg = event.getMessage();
        if (msg.isNoteOn())
        {
            // Map MIDI note to drum name (note 36=Kick, 38=Snare, 42=HH Closed, etc.)
            static const std::map<int, juce::String> drumMap = {
                {36, "Kick"}, {38, "Snare"}, {42, "HH Closed"}, {46, "HH Open"},
                {49, "Crash"}, {51, "Ride"}, {47, "Tom Low"}, {45, "Tom Mid"}, {48, "Tom High"}
            };
            auto it = drumMap.find (msg.getNoteNumber());
            if (it != drumMap.end())
                triggerDrum (it->second, msg.getVelocity() / 127.0f);
        }
    }

    // Render active samples
    for (auto it = activeSamples.begin(); it != activeSamples.end();)
    {
        auto& ps = *it;
        int remaining = ps.buffer->getNumSamples() - ps.readPosition;
        int toWrite = std::min (remaining, buffer.getNumSamples());

        for (int ch = 0; ch < std::min (buffer.getNumChannels(), ps.buffer->getNumChannels()); ++ch)
        {
            const float* src = ps.buffer->getReadPointer (ch) + ps.readPosition;
            float* dst = buffer.getWritePointer (ch);
            for (int s = 0; s < toWrite; ++s)
                dst[s] += src[s] * ps.gain;
        }

        ps.readPosition += toWrite;
        if (ps.readPosition >= ps.buffer->getNumSamples())
            it = activeSamples.erase (it);
        else
            ++it;
    }
}
