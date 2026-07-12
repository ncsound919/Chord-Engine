#pragma once

#include <juce_audio_basics/juce_audio_basics.h>
#include <juce_audio_devices/juce_audio_devices.h>
#include <juce_audio_utils/juce_audio_utils.h>
#include <map>
#include <memory>
#include <functional>

class MixerTrack;
class WSServer;

class ChordEngineAudio : public juce::AudioSource,
                         private juce::AudioIODeviceCallback {
public:
    ChordEngineAudio();
    ~ChordEngineAudio() override;

    // AudioSource interface
    void prepareToPlay(int samplesPerBlockExpected, double sampleRate) override;
    void releaseResources() override;
    void getNextAudioBlock(const juce::AudioSourceChannelInfo& buffer) override;

    // Track management
    MixerTrack* addTrack(const juce::String& name);
    MixerTrack* getTrack(const juce::String& name);
    void removeTrack(const juce::String& name);

    // Sample loading
    bool loadSample(const juce::String& name, const juce::File& file);
    bool loadSampleFromMemory(const juce::String& name, const void* data, size_t size);

    // Note control
    void noteOn(int trackIndex, int midiNote, float velocity = 0.8f);
    void noteOff(int trackIndex, int midiNote);

    // Master control
    void setMasterGain(float gain);
    float getMasterGain() const { return masterGain; }

    // Start/stop audio device
    bool startAudio();
    void stopAudio();

    std::function<void(const juce::String&)> onStatusMessage;

private:
    void audioDeviceIOCallback(const float** inputChannelData, int numInputChannels,
                               float** outputChannelData, int numOutputChannels,
                               int numSamples) override;
    void audioDeviceAboutToStart(juce::AudioIODevice* device) override;
    void audioDeviceStopped() override;

    std::unique_ptr<juce::AudioDeviceManager> deviceManager;
    std::unique_ptr<WSServer> wsServer;
    juce::AudioSourcePlayer player;
    std::map<juce::String, std::unique_ptr<MixerTrack>> tracks;
    juce::OwnedArray<juce::AudioSampleBuffer> loadedSamples;
    std::map<juce::String, juce::AudioSampleBuffer*> sampleMap;
    float masterGain = 0.8f;
    bool isPrepared = false;
    double currentSampleRate = 44100.0;
    int currentBlockSize = 512;
};
