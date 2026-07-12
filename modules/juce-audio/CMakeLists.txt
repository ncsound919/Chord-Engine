cmake_minimum_required(VERSION 3.22)
project(ChordEngine VERSION 1.0.0 LANGUAGES CXX)

set(CMAKE_CXX_STANDARD 17)
set(CMAKE_CXX_STANDARD_REQUIRED ON)
set(CMAKE_MODULE_PATH "${CMAKE_CURRENT_SOURCE_DIR}/cmake")

# Find JUCE — set JUCE_DIR to your JUCE installation path
if(NOT JUCE_DIR)
    set(JUCE_DIR "C:/JUCE" CACHE PATH "Path to JUCE library")
endif()
list(APPEND CMAKE_MODULE_PATH "${JUCE_DIR}/cmake")
find_package(JUCE REQUIRED)

# Build as standalone with VST3/AU targets for future DAW use
juce_add_plugin(ChordEngine
    COMPANY_NAME "NC Sound"
    PRODUCT_NAME "Chord Engine"
    PLUGIN_MANUFACTURER_CODE Ncse
    PLUGIN_CODE ChEn
    FORMATS Standalone VST3 AU
    IS_SYNTH FALSE
    NEEDS_MIDI_INPUT TRUE
    NEEDS_MIDI_OUTPUT TRUE
    COPY_PLUGIN_AFTER_BUILD TRUE
)

target_sources(ChordEngine PRIVATE
    Source/Main.cpp
    Source/PluginProcessor.h
    Source/PluginProcessor.cpp
    Source/PluginEditor.h
    Source/PluginEditor.cpp

    # Audio graph
    Source/Audio/AudioGraph.h
    Source/Audio/AudioGraph.cpp
    Source/Audio/MixerBus.h
    Source/Audio/MixerBus.cpp
    Source/Audio/DrumRack.h
    Source/Audio/SynthRack.h
)

target_include_directories(ChordEngine PRIVATE
    ${CMAKE_CURRENT_SOURCE_DIR}/Source
)

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
)
