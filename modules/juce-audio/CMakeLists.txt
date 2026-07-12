cmake_minimum_required(VERSION 3.22)
project(ChordEngine VERSION 1.0.0 LANGUAGES CXX)

set(CMAKE_CXX_STANDARD 17)
set(CMAKE_CXX_STANDARD_REQUIRED ON)

# Add JUCE as a subdirectory
set(JUCE_DIR "C:/Users/User/Documents/JUCE" CACHE PATH "Path to JUCE root")
add_subdirectory(${JUCE_DIR} ${CMAKE_BINARY_DIR}/JUCE)

# Build as standalone application
juce_add_plugin(ChordEngine
    COMPANY_NAME "Chord Engine"
    PRODUCT_NAME "Chord Engine Audio"
    PLUGIN_MANUFACTURER_CODE ChEn
    PLUGIN_CODE ChEn
    FORMATS Standalone
    IS_SYNTH FALSE
    NEEDS_MIDI_INPUT TRUE
)

target_sources(ChordEngine PRIVATE
    Source/Main.cpp
    Source/PluginProcessor.h
    Source/PluginProcessor.cpp
    Source/PluginEditor.h
    Source/PluginEditor.cpp
    Source/Audio/AudioGraph.h
    Source/Audio/AudioGraph.cpp
    Source/Audio/MixerBus.h
    Source/Audio/MixerBus.cpp
    Source/Audio/DrumRack.h
    Source/Audio/SynthRack.h
)

target_include_directories(ChordEngine PRIVATE Source)

target_link_libraries(ChordEngine PRIVATE
    juce::juce_audio_basics
    juce::juce_audio_devices
    juce::juce_audio_plugin_client
    juce::juce_audio_processors
    juce::juce_audio_utils
    juce::juce_core
    juce::juce_events
    juce::juce_graphics
    juce::juce_gui_basics
    juce::juce_gui_extra
    juce::juce_dsp
)
