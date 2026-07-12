#pragma once

#include <juce_audio_basics/juce_audio_basics.h>
#include <juce_audio_utils/juce_audio_utils.h>

struct SynthPatch
{
    float vcfCutoff = 0.7f;
    float vcfRes = 0.2f;
    float envA = 0.01f;
    float envD = 0.3f;
    float envS = 0.7f;
    float envR = 0.4f;
    float vcaLevel = 0.8f;
    float lfoRate = 5.0f;
    float lfoDepth = 0.0f;
    int voiceMode = 0; // 0=poly, 1=mono, 2=unison
    float chorusWet = 0.0f;
};

class SynthRack
{
public:
    SynthRack();
    ~SynthRack() = default;

    void prepare (double sampleRate, int blockSize);
    void render (juce::AudioBuffer<float>& bassBuf,
                 juce::AudioBuffer<float>& leadBuf,
                 juce::AudioBuffer<float>& padBuf,
                 juce::MidiBuffer& midi);

    void noteOn (int channel, int midiNote, float velocity);
    void noteOff (int channel, int midiNote);

    void setPatch (int channel, const SynthPatch& patch);

private:
    struct Voice {
        bool active = false;
        int midiNote = 60;
        float velocity = 0.8f;
        double phase = 0.0;
        double envLevel = 0.0;
        double envTime = 0.0;
        bool released = false;
        double releaseTime = 0.0;
    };

    struct SynthEngine {
        SynthPatch patch;
        std::vector<Voice> voices;
        double sampleRate = 44100.0;
        int maxVoices = 8;

        void prepare (double sr, int numVoices);
        void render (juce::AudioBuffer<float>& buffer, juce::MidiBuffer& midi, int numSamples);
        void noteOn (int note, float vel);
        void noteOff (int note);
        double renderVoice (Voice& v, float dt);
    };

    SynthEngine bassSynth;
    SynthEngine leadSynth;
    SynthEngine padSynth;

    juce::AudioBuffer<float> scratch;
};

inline void SynthRack::SynthEngine::prepare (double sr, int numVoices)
{
    sampleRate = sr;
    maxVoices = numVoices;
    voices.resize (maxVoices);
}

inline void SynthRack::SynthEngine::noteOn (int note, float vel)
{
    for (auto& v : voices)
    {
        if (!v.active)
        {
            v.active = true;
            v.midiNote = note;
            v.velocity = vel;
            v.phase = 0.0;
            v.envLevel = 0.0;
            v.envTime = 0.0;
            v.released = false;
            v.releaseTime = 0.0;
            return;
        }
    }
    // Voice steal: reuse oldest
    voices[0].active = true;
    voices[0].midiNote = note;
    voices[0].velocity = vel;
    voices[0].phase = 0.0;
    voices[0].envLevel = 0.0;
    voices[0].envTime = 0.0;
    voices[0].released = false;
}

inline void SynthRack::SynthEngine::noteOff (int note)
{
    for (auto& v : voices)
    {
        if (v.active && !v.released && v.midiNote == note)
        {
            v.released = true;
            v.releaseTime = 0.0;
            return;
        }
    }
}

inline double SynthRack::SynthEngine::renderVoice (Voice& v, float dt)
{
    double freq = 440.0 * std::pow (2.0, (v.midiNote - 69) / 12.0);
    v.envTime += dt;

    // ADSR envelope
    double env = 0.0;
    double t = v.envTime;
    if (v.released)
    {
        v.releaseTime += dt;
        if (v.releaseTime >= patch.envR)
        {
            v.active = false;
            return 0.0;
        }
        env = patch.envS * (1.0 - v.releaseTime / patch.envR);
    }
    else
    {
        if (t < patch.envA)
            env = t / patch.envA;
        else if (t < patch.envA + patch.envD)
            env = 1.0 - (1.0 - patch.envS) * ((t - patch.envA) / patch.envD);
        else
            env = patch.envS;
    }

    v.phase += freq * dt;
    double sample = std::sin (v.phase * 2.0 * M_PI);
    return sample * env * v.velocity * 0.3;
}

inline void SynthRack::SynthEngine::render (juce::AudioBuffer<float>& buffer,
                                            juce::MidiBuffer& midi, int numSamples)
{
    // Process MIDI events
    for (const auto& event : midi)
    {
        auto msg = event.getMessage();
        if (msg.isNoteOn())
            noteOn (msg.getNoteNumber(), msg.getVelocity() / 127.0f);
        else if (msg.isNoteOff())
            noteOff (msg.getNoteNumber());
    }

    float dt = 1.0f / (float) sampleRate;
    for (int s = 0; s < numSamples; ++s)
    {
        float sample = 0.0f;
        for (auto& v : voices)
        {
            if (v.active)
                sample += (float) renderVoice (v, dt * (s + 1) - dt * s);
        }
        for (int ch = 0; ch < buffer.getNumChannels(); ++ch)
            buffer.getWritePointer (ch)[s] += sample;
    }
}

inline SynthRack::SynthRack() {}

inline void SynthRack::prepare (double sampleRate, int blockSize)
{
    scratch.setSize (2, blockSize);
    bassSynth.prepare (sampleRate, 4);
    leadSynth.prepare (sampleRate, 8);
    padSynth.prepare (sampleRate, 8);
}

inline void SynthRack::render (juce::AudioBuffer<float>& bassBuf,
                               juce::AudioBuffer<float>& leadBuf,
                               juce::AudioBuffer<float>& padBuf,
                               juce::MidiBuffer& midi)
{
    int numSamples = bassBuf.getNumSamples();

    // Route MIDI to the appropriate synth based on channel
    juce::MidiBuffer bassMidi, leadMidi, padMidi;
    for (const auto& event : midi)
    {
        auto msg = event.getMessage();
        if (msg.getChannel() == 1) leadMidi.addEvent (msg, event.samplePosition);
        else if (msg.getChannel() == 2) padMidi.addEvent (msg, event.samplePosition);
        else if (msg.getChannel() == 3) bassMidi.addEvent (msg, event.samplePosition);
    }

    bassSynth.render (bassBuf, bassMidi, numSamples);
    leadSynth.render (leadBuf, leadMidi, numSamples);
    padSynth.render (padBuf, padMidi, numSamples);
}

inline void SynthRack::noteOn (int channel, int midiNote, float velocity)
{
    if (channel == 0) bassSynth.noteOn (midiNote, velocity);
    else if (channel == 1) leadSynth.noteOn (midiNote, velocity);
    else if (channel == 2) padSynth.noteOn (midiNote, velocity);
}

inline void SynthRack::noteOff (int channel, int midiNote)
{
    if (channel == 0) bassSynth.noteOff (midiNote);
    else if (channel == 1) leadSynth.noteOff (midiNote);
    else if (channel == 2) padSynth.noteOff (midiNote);
}

inline void SynthRack::setPatch (int channel, const SynthPatch& patch)
{
    if (channel == 0) bassSynth.patch = patch;
    else if (channel == 1) leadSynth.patch = patch;
    else if (channel == 2) padSynth.patch = patch;
}
