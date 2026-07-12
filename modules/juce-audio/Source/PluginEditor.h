#pragma once

#include <juce_audio_processors/juce_audio_processors.h>
#include <juce_gui_basics/juce_gui_basics.h>

class ChordEngineAudioProcessor;

class ChordEngineAudioProcessorEditor : public juce::AudioProcessorEditor
{
public:
    explicit ChordEngineAudioProcessorEditor (ChordEngineAudioProcessor&);
    ~ChordEngineAudioProcessorEditor() override;

    void paint (juce::Graphics&) override;
    void resized() override;

private:
    ChordEngineAudioProcessor& processorRef;
    juce::Label titleLabel;
    juce::Slider masterGainSlider;
    juce::Label masterGainLabel;

    JUCE_DECLARE_NON_COPYABLE_WITH_LEAK_DETECTOR (ChordEngineAudioProcessorEditor)
};
