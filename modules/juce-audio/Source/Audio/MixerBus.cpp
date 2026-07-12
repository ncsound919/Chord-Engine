#include "MixerBus.h"

MixerBus::MixerBus (const juce::String& name) : busName (name) {}

void MixerBus::prepare (double sampleRate, int blockSize)
{
    currentSampleRate = sampleRate;
    scratch.setSize (2, blockSize);
    scratch.clear();
}

void MixerBus::release()
{
    scratch.setSize (0, 0);
}

void MixerBus::process (juce::AudioBuffer<float>& buffer)
{
    if (muted)
    {
        buffer.clear();
        return;
    }

    float g = gain;
    float p = pan;
    float panL = std::sqrt (1.0f - std::max (0.0f, p));
    float panR = std::sqrt (1.0f - std::max (0.0f, -p));

    for (int ch = 0; ch < buffer.getNumChannels(); ++ch)
    {
        float* data = buffer.getWritePointer (ch);
        float chGain = g * (ch == 0 ? panL : panR);
        for (int s = 0; s < buffer.getNumSamples(); ++s)
            data[s] *= chGain;
    }
}
