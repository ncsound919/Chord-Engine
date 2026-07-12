#include "PluginProcessor.h"
#include "PluginEditor.h"

ChordEngineAudioProcessor::ChordEngineAudioProcessor()
    : AudioProcessor (BusesProperties().withOutput ("Output", juce::AudioChannelSet::stereo(), true))
{
    formatManager.registerBasicFormats();
}

ChordEngineAudioProcessor::~ChordEngineAudioProcessor() = default;

void ChordEngineAudioProcessor::prepareToPlay (double sampleRate, int samplesPerBlock)
{
    int numOutputChannels = std::max (1, getTotalNumOutputChannels());
    outputScratch.setSize (numOutputChannels, samplesPerBlock);
    audioGraph.prepare (sampleRate, samplesPerBlock, numOutputChannels);
    isPrepared = true;
}

void ChordEngineAudioProcessor::releaseResources()
{
    isPrepared = false;
}

void ChordEngineAudioProcessor::processBlock (juce::AudioBuffer<float>& buffer,
                                               juce::MidiBuffer& midi)
{
    juce::ScopedNoDenormals noDenormals;
    buffer.clear();

    if (!isPrepared) return;

    // Process through the audio graph
    audioGraph.process (buffer, midi);
}

juce::AudioProcessorEditor* ChordEngineAudioProcessor::createEditor()
{
    return new ChordEngineAudioProcessorEditor (*this);
}

void ChordEngineAudioProcessor::getStateInformation (juce::MemoryBlock& destData)
{
    auto state = juce::ValueTree ("ChordEngineState");
    auto xml = state.createXml();
    if (xml) copyXmlToBinary (*xml, destData);
}

void ChordEngineAudioProcessor::setStateInformation (const void* data, int sizeInBytes)
{
    auto xml = getXmlFromBinary (data, sizeInBytes);
    if (xml)
    {
        auto state = juce::ValueTree::fromXml (*xml);
        if (state.isValid())
        {
            // Restore state
        }
    }
}
