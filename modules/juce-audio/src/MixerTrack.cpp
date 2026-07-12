#include "MixerTrack.h"
#include <cmath>

MixerTrack::MixerTrack(const juce::String& trackName) : name(trackName) {}

void MixerTrack::prepare(double sr, int) {
    sampleRate = sr;
}

void MixerTrack::release() {
    activeNotes.clear();
    activeBuffers.clear();
}

void MixerTrack::noteOn(int midiNote, float velocity) {
    double freq = 440.0 * std::pow(2.0, (midiNote - 69) / 12.0);
    ActiveNote note;
    note.midiNote = midiNote;
    note.frequency = freq;
    note.velocity = velocity;
    note.startTime = 0;
    note.duration = 0.5;
    note.phase = 0;
    note.released = false;
    note.releaseTime = 0;
    note.envLevel = 0;
    activeNotes.push_back(note);
    if (onNotePlayed)
        onNotePlayed(midiNote, velocity);
}

void MixerTrack::noteOff(int midiNote) {
    for (auto& n : activeNotes) {
        if (n.midiNote == midiNote && !n.released) {
            n.released = true;
            n.releaseTime = 0;
        }
    }
}

void MixerTrack::playBuffer(const juce::AudioSampleBuffer* buffer, float g) {
    if (!buffer || buffer->getNumSamples() == 0) return;
    PlayingBuffer pb;
    pb.buffer = buffer;
    pb.readPosition = 0;
    pb.gain = g;
    activeBuffers.push_back(pb);
}

void MixerTrack::process(juce::AudioSourceChannelInfo& buffer) {
    if (muted) {
        buffer.clearActiveBufferRegion();
        return;
    }
    auto& buf = *buffer.buffer;
    int numSamples = buffer.numSamples;
    int startSample = buffer.startSample;
    int numChannels = buf.getNumChannels();

    // Process buffer-based samples (drums, one-shots)
    for (auto it = activeBuffers.begin(); it != activeBuffers.end();) {
        auto& pb = *it;
        int remaining = pb.buffer->getNumSamples() - pb.readPosition;
        int toWrite = std::min(remaining, numSamples);

        for (int ch = 0; ch < std::min(numChannels, pb.buffer->getNumChannels()); ++ch) {
            const float* src = pb.buffer->getReadPointer(ch) + pb.readPosition;
            float* dst = buf.getWritePointer(ch) + startSample;
            float panL = std::sqrt(1.0f - std::max(0.0f, pan));
            float panR = std::sqrt(1.0f - std::max(0.0f, -pan));
            for (int s = 0; s < toWrite; ++s) {
                float sample = src[s] * pb.gain * gain;
                if (ch == 0) dst[s] += sample * panL;
                if (ch == 1 || numChannels == 1) dst[s] += (ch < 2 ? sample * panR : sample);
            }
        }
        pb.readPosition += toWrite;
        if (pb.readPosition >= pb.buffer->getNumSamples())
            it = activeBuffers.erase(it);
        else
            ++it;
    }

    // Process active synth notes
    double dt = 1.0 / sampleRate;
    for (auto it = activeNotes.begin(); it != activeNotes.end();) {
        auto& note = *it;

        if (!note.released) {
            // Simple ADSR envelope
            double env = 1.0;
            double t = note.startTime;
            double attack = 0.01;
            double decay = 0.1;
            double sustain = 0.7;
            double release = 0.1;

            if (t < attack)
                env = t / attack;
            else if (t < attack + decay)
                env = 1.0 - (1.0 - sustain) * ((t - attack) / decay);
            else
                env = sustain;

            for (int s = 0; s < numSamples; ++s) {
                double sample = std::sin(note.phase * 2.0 * M_PI) * env * note.velocity * 0.3;
                float panL = std::sqrt(1.0f - std::max(0.0f, pan));
                float panR = std::sqrt(1.0f - std::max(0.0f, -pan));
                for (int ch = 0; ch < numChannels; ++ch) {
                    float* d = buf.getWritePointer(ch) + startSample + s;
                    if (ch == 0) *d += sample * panL * gain;
                    if (ch == 1 || numChannels == 1) *d += (ch < 2 ? sample * panR : sample) * gain;
                }
                note.phase += note.frequency * dt;
                note.startTime += dt;
            }
            ++it;
        } else {
            // Release phase
            note.releaseTime += numSamples * dt;
            if (note.releaseTime >= 0.1)
                it = activeNotes.erase(it);
            else {
                for (int s = 0; s < numSamples; ++s) {
                    double relGain = 1.0 - (note.releaseTime / 0.1);
                    double sample = std::sin(note.phase * 2.0 * M_PI) * relGain * note.velocity * 0.3;
                    note.phase += note.frequency * dt;
                    note.releaseTime += dt;
                    float panL = std::sqrt(1.0f - std::max(0.0f, pan));
                    float panR = std::sqrt(1.0f - std::max(0.0f, -pan));
                    for (int ch = 0; ch < numChannels; ++ch) {
                        float* d = buf.getWritePointer(ch) + startSample + s;
                        if (ch == 0) *d += sample * panL * gain;
                        if (ch == 1 || numChannels == 1) *d += (ch < 2 ? sample * panR : sample) * gain;
                    }
                }
                ++it;
            }
        }
    }
}

void MixerTrack::processRaw(juce::AudioBuffer<float>& buffer, double) {
    processRaw(buffer, sampleRate);
}
