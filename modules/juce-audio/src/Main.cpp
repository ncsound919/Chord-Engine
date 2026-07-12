#include "ChordEngineAudio.h"

class ChordEngineApplication : public juce::JUCEApplication {
public:
    const juce::String getApplicationName() override { return "Chord Engine Audio"; }
    const juce::String getApplicationVersion() override { return "1.0.0"; }

    void initialise(const juce::String&) override {
        engine = std::make_unique<ChordEngineAudio>();

        // Create mixer tracks matching the React app's layout
        for (auto& name : {"drums", "bass", "lead", "pads", "keys", "guitar",
                           "kick", "snare", "hihat", "toms", "overhead",
                           "oneshots", "guitar-sampler", "keys-sampler"}) {
            engine->addTrack(name);
        }

        engine->onStatusMessage = [](const juce::String& msg) {
            juce::Logger::writeToLog(msg);
        };

        engine->startAudio();
    }

    void shutdown() override {
        engine = nullptr;
    }

    void anotherInstanceStarted(const juce::String&) override {}

private:
    std::unique_ptr<ChordEngineAudio> engine;
};

START_JUCE_APPLICATION(ChordEngineApplication)
