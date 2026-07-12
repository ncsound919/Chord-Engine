#include "ChordEngineAudio.h"
#include "MixerTrack.h"
#include "WSServer.h"

ChordEngineAudio::ChordEngineAudio() {
    deviceManager = std::make_unique<juce::AudioDeviceManager>();
    wsServer = std::make_unique<WSServer>(this);
    wsServer->start(9876);
}

ChordEngineAudio::~ChordEngineAudio() {
    stopAudio();
    wsServer->stop();
}

bool ChordEngineAudio::startAudio() {
    auto setup = deviceManager->initialiseWithDefaultDevices(0, 2);
    if (setup.failed()) {
        if (onStatusMessage)
            onStatusMessage("Audio init: " + setup.getErrorMessage());
        deviceManager->initialise(0, 2, nullptr, true);
    }
    deviceManager->addAudioCallback(this);
    if (onStatusMessage)
        onStatusMessage("Audio started");
    return true;
}

void ChordEngineAudio::stopAudio() {
    deviceManager->removeAudioCallback(this);
    releaseResources();
}

void ChordEngineAudio::prepareToPlay(int samplesPerBlock, double sampleRate) {
    currentSampleRate = sampleRate;
    currentBlockSize = samplesPerBlock;
    isPrepared = true;
    for (auto& [name, track] : tracks) {
        track->prepare(sampleRate, samplesPerBlock);
    }
}

void ChordEngineAudio::releaseResources() {
    isPrepared = false;
    for (auto& [name, track] : tracks) {
        track->release();
    }
}

void ChordEngineAudio::getNextAudioBlock(const juce::AudioSourceChannelInfo& buffer) {
    buffer.clearActiveBufferRegion();
    for (auto& [name, track] : tracks) {
        track->process(buffer);
    }
    buffer.buffer->applyGain(masterGain);
}

void ChordEngineAudio::audioDeviceIOCallback(
    const float**, int, float** outputChannelData, int numOutputChannels, int numSamples) {
    juce::AudioBuffer<float> buffer(outputChannelData, numOutputChannels, numSamples);
    buffer.clear();
    for (auto& [name, track] : tracks) {
        track->processRaw(buffer, currentSampleRate);
    }
    buffer.applyGain(masterGain);
}

void ChordEngineAudio::audioDeviceAboutToStart(juce::AudioIODevice* device) {
    currentSampleRate = device->getCurrentSampleRate();
    currentBlockSize = device->getCurrentBufferSizeSamples();
    for (auto& [name, track] : tracks) {
        track->prepare(currentSampleRate, currentBlockSize);
    }
}

void ChordEngineAudio::audioDeviceStopped() {}

MixerTrack* ChordEngineAudio::addTrack(const juce::String& name) {
    if (tracks.find(name) != tracks.end())
        return tracks[name].get();
    auto track = std::make_unique<MixerTrack>(name);
    track->prepare(currentSampleRate, currentBlockSize);
    auto* ptr = track.get();
    tracks[name] = std::move(track);
    return ptr;
}

MixerTrack* ChordEngineAudio::getTrack(const juce::String& name) {
    auto it = tracks.find(name);
    return it != tracks.end() ? it->second.get() : nullptr;
}

void ChordEngineAudio::removeTrack(const juce::String& name) {
    tracks.erase(name);
}

bool ChordEngineAudio::loadSample(const juce::String& name, const juce::File& file) {
    auto reader = std::unique_ptr<juce::AudioFormatReader>(
        juce::AudioFormatManager().createReaderFor(file));
    if (!reader) return false;
    auto* buffer = new juce::AudioSampleBuffer();
    buffer->setSize(reader->numChannels, (int)reader->lengthInSamples);
    reader->read(buffer, 0, (int)reader->lengthInSamples, 0, true, true);
    loadedSamples.add(buffer);
    sampleMap[name] = buffer;
    return true;
}

bool ChordEngineAudio::loadSampleFromMemory(const juce::String& name, const void* data, size_t size) {
    auto* inputStream = new juce::MemoryInputStream(data, size, false);
    auto formatManager = juce::AudioFormatManager();
    formatManager.registerBasicFormats();
    auto reader = std::unique_ptr<juce::AudioFormatReader>(
        formatManager.createReaderFor(std::unique_ptr<juce::InputStream>(inputStream)));
    if (!reader) return false;
    auto* buffer = new juce::AudioSampleBuffer();
    buffer->setSize(reader->numChannels, (int)reader->lengthInSamples);
    reader->read(buffer, 0, (int)reader->lengthInSamples, 0, true, true);
    loadedSamples.add(buffer);
    sampleMap[name] = buffer;
    return true;
}

void ChordEngineAudio::noteOn(int trackIndex, int midiNote, float velocity) {
    int idx = 0;
    for (auto& [name, track] : tracks) {
        if (idx == trackIndex) {
            track->noteOn(midiNote, velocity);
            return;
        }
        idx++;
    }
}

void ChordEngineAudio::noteOff(int trackIndex, int midiNote) {
    int idx = 0;
    for (auto& [name, track] : tracks) {
        if (idx == trackIndex) {
            track->noteOff(midiNote);
            return;
        }
        idx++;
    }
}

void ChordEngineAudio::setMasterGain(float gain) {
    masterGain = juce::jlimit(0.0f, 1.2f, gain);
}
