#include "AudioGraph.h"
#include "DrumRack.h"
#include "SynthRack.h"

AudioGraph::AudioGraph()
    : kick("kick"), snare("snare"), hats("hats"),
      toms("toms"), overheads("overheads"),
      drums("drums"),
      bass("bass"), lead("lead"), pads("pads"),
      keys("keys"), guitar("guitar"), oneShots("oneShots"),
      master("master")
{
    drumRack = std::make_unique<DrumRack>();
    synthRack = std::make_unique<SynthRack>();

    allBuses = {
        {BusId::kick, &kick, "kick"},
        {BusId::snare, &snare, "snare"},
        {BusId::hats, &hats, "hats"},
        {BusId::toms, &toms, "toms"},
        {BusId::overheads, &overheads, "overheads"},
        {BusId::drums, &drums, "drums"},
        {BusId::bass, &bass, "bass"},
        {BusId::lead, &lead, "lead"},
        {BusId::pads, &pads, "pads"},
        {BusId::keys, &keys, "keys"},
        {BusId::guitar, &guitar, "guitar"},
        {BusId::oneShots, &oneShots, "oneShots"},
        {BusId::master, &master, "master"},
    };
}

void AudioGraph::prepare (double sampleRate, int blockSize, int outputChannels)
{
    for (auto& entry : allBuses)
        entry.bus->prepare (sampleRate, blockSize);

    drumScratch.setSize (outputChannels, blockSize);
    isPrepared = true;
}

void AudioGraph::process (juce::AudioBuffer<float>& output, juce::MidiBuffer& midi)
{
    if (!isPrepared) return;
    const int numSamples = output.getNumSamples();
    const int numChannels = output.getNumChannels();

    // --- CHILD DRUM BUSES: each drum plays into its own child bus ---
    drumScratch.clear();
    drumRack->render (drumScratch, midi);

    // Route each drum voice to its dedicated submix bus
    // (kick samples go to kick bus, snare to snare bus, etc.)
    // The drum rack handles this routing internally; we just sum
    // the scratch buffer into the child buses here.
    for (int ch = 0; ch < numChannels; ++ch)
    {
        const float* src = drumScratch.getReadPointer (ch);
        float* kickPtr = kick.getScratchBuffer().getWritePointer (ch);
        float* snarePtr = snare.getScratchBuffer().getWritePointer (ch);
        float* hatsPtr = hats.getScratchBuffer().getWritePointer (ch);
        float* tomsPtr = toms.getScratchBuffer().getWritePointer (ch);
        float* ohPtr = overheads.getScratchBuffer().getWritePointer (ch);
        // (This is simplified — real routing routes per-sample-type)
        for (int s = 0; s < numSamples; ++s)
            kickPtr[s] += src[s]; // simplified: all drums go to kick for now
    }

    // --- PARENT DRUM BUS: sum children into drums bus ---
    juce::AudioBuffer<float> drumSum (numChannels, numSamples);
    drumSum.clear();
    for (auto* childBus : { &kick, &snare, &hats, &toms, &overheads })
    {
        for (int ch = 0; ch < numChannels; ++ch)
        {
            const float* src = childBus->getScratchBuffer().getReadPointer (ch);
            float* dst = drumSum.getWritePointer (ch);
            for (int s = 0; s < numSamples; ++s)
                dst[s] += src[s];
        }
    }
    drums.process (drumSum);

    // --- SYNTH / INSTRUMENT BUSES ---
    bass.getScratchBuffer().clear();
    lead.getScratchBuffer().clear();
    pads.getScratchBuffer().clear();
    synthRack->render (bass.getScratchBuffer(), lead.getScratchBuffer(),
                       pads.getScratchBuffer(), midi);

    oneShots.getScratchBuffer().clear();
    // one-shots would be rendered here from a OneShotSampler

    // --- APPLY PER-BUS GAIN AND SUM TO MASTER ---
    output.clear();
    updateSoloState();
    bool hasSolo = hasSoloedTrack();

    auto sumBusInto = [&](MixerBus& bus, float* dstCh0, float* dstCh1, int numS)
    {
        if (bus.isMuted()) return;
        if (hasSolo && !bus.isSolo()) return;
        float g = bus.getGain();
        float p = bus.getPan();
        float panL = std::sqrt (1.0f - std::max (0.0f, p));
        float panR = std::sqrt (1.0f - std::max (0.0f, -p));
        auto& buf = bus.getScratchBuffer();
        for (int s = 0; s < numS; ++s) {
            float sample = buf.getSample (0, s) * g;
            dstCh0[s] += sample * panL;
            if (numChannels > 1) dstCh1[s] += sample * panR;
        }
    };

    float* outCh0 = output.getWritePointer (0);
    float* outCh1 = numChannels > 1 ? output.getWritePointer (1) : nullptr;

    sumBusInto (drums, outCh0, outCh1, numSamples);
    sumBusInto (bass, outCh0, outCh1, numSamples);
    sumBusInto (lead, outCh0, outCh1, numSamples);
    sumBusInto (pads, outCh0, outCh1, numSamples);
    sumBusInto (keys, outCh0, outCh1, numSamples);
    sumBusInto (guitar, outCh0, outCh1, numSamples);
    sumBusInto (oneShots, outCh0, outCh1, numSamples);

    // --- MASTER BUS: apply master gain ---
    master.process (output);
}

void AudioGraph::updateSoloState()
{
    bool hasSolo = false;
    for (auto& entry : allBuses)
        if (entry.id != BusId::master && entry.bus->isSolo())
            hasSolo = true;
    // Solo state is checked during process() to determine which buses sum
}

bool AudioGraph::hasSoloedTrack() const
{
    for (auto& entry : allBuses)
        if (entry.id != BusId::master && entry.bus->isSolo())
            return true;
    return false;
}

MixerBus& AudioGraph::getBus (BusId id)
{
    for (auto& entry : allBuses)
        if (entry.id == id) return *entry.bus;
    return master;
}

MixerBus& AudioGraph::getBusByName (const juce::String& name)
{
    for (auto& entry : allBuses)
        if (entry.name == name) return *entry.bus;
    return master;
}
