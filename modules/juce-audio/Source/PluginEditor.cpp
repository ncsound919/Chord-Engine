#include "PluginEditor.h"
#include "PluginProcessor.h"

ChordEngineAudioProcessorEditor::ChordEngineAudioProcessorEditor (ChordEngineAudioProcessor& p)
    : AudioProcessorEditor (&p), processorRef (p)
{
    titleLabel.setText ("Chord Engine", juce::dontSendNotification);
    titleLabel.setFont (juce::Font (24.0f, juce::Font::bold));
    addAndMakeVisible (titleLabel);

    masterGainLabel.setText ("Master Gain", juce::dontSendNotification);
    addAndMakeVisible (masterGainLabel);

    masterGainSlider.setSliderStyle (juce::Slider::LinearVertical);
    masterGainSlider.setRange (0.0, 1.2, 0.01);
    masterGainSlider.setValue (0.8);
    masterGainSlider.onValueChange = [this] {
        processorRef.getAudioGraph().setMasterGain ((float) masterGainSlider.getValue());
    };
    addAndMakeVisible (masterGainSlider);

    setSize (400, 300);
}

ChordEngineAudioProcessorEditor::~ChordEngineAudioProcessorEditor() = default;

void ChordEngineAudioProcessorEditor::paint (juce::Graphics& g)
{
    g.fillAll (getLookAndFeel().findColour (juce::ResizableWindow::backgroundColourId));
}

void ChordEngineAudioProcessorEditor::resized()
{
    auto area = getLocalBounds().reduced (20);
    titleLabel.setBounds (area.removeFromTop (40));
    masterGainLabel.setBounds (area.removeFromTop (20));
    masterGainSlider.setBounds (area.removeFromLeft (60));
}
