#pragma once

#include <juce_audio_basics/juce_audio_basics.h>
#include <juce_audio_utils/juce_audio_utils.h>
#include <queue>

struct ActiveNote {
    int midiNote;
    double frequency;
    float velocity;
    double startTime;
    double duration;
    double phase;
    bool released;
    double releaseTime;
    double envLevel;
};

class MixerTrack {
public:
    MixerTrack(const juce::String& trackName);
    ~MixerTrack() = default;

    void prepare(double sampleRate, int blockSize);
    void release();
    void process(juce::AudioSourceChannelInfo& buffer);
    void processRaw(juce::AudioBuffer<float>& buffer, double sampleRate);

    void noteOn(int midiNote, float velocity);
    void noteOff(int midiNote);

    void setGain(float g) { gain = juce::jlimit(0.0f, 1.2f, g); }
    float getGain() const { return gain; }

    void setPan(float p) { pan = juce::jlimit(-1.0f, 1.0f, p); }
    float getPan() const { return pan; }

    void setMuted(bool m) { muted = m; }
    bool isMuted() const { return muted; }

    const juce::String& getName() const { return name; }

    // Buffer-based sample playback (for drum hits)
    void playBuffer(const juce::AudioSampleBuffer* sample, float gain = 1.0f);

    std::function<void(int midi, float vel)> onNotePlayed;

private:
    struct PlayingBuffer {
        const juce::AudioSampleBuffer* buffer;
        int readPosition;
        float gain;
    };

    juce::String name;
    float gain = 0.8f;
    float pan = 0.0f;
    bool muted = false;
    double sampleRate = 44100.0;
    std::vector<ActiveNote> activeNotes;
    std::vector<PlayingBuffer> activeBuffers;
    juce::Random rng;
};
