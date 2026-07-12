JUCE Audio Engine for Chord Engine
====================================

This module replaces the Tone.js audio engine with a native JUCE-based
audio engine that guarantees reliable audio output through the system's
audio devices.

Prerequisites
-------------
- JUCE 7.x or later (installed and findable by CMake)
- CMake 3.22+
- C++17 compiler (MSVC 2022 recommended on Windows)

Building
--------
```bash
cd modules/juce-audio
cmake -B build -DJUCE_DIR=/path/to/JUCE
cmake --build build --config Release
```

This produces:
- `build/ChordEngine_Standalone.exe` - standalone audio engine
- `build/ChordEngine.vst3` - VST3 plugin (optional)

Running
-------
1. Start the ChordEngine audio engine BEFORE opening the web app:
   ```
   build/Release/ChordEngine_Standalone.exe
   ```

2. The audio engine listens on port 9876 for WebSocket connections
   from the React UI.

3. Open the React app normally (`npm run dev`).

Architecture
------------
```
[React UI] --WebSocket--> [JUCE Audio Engine] --WASAPI/ASIO--> [Speakers]
```

The React app sends JSON commands:
- `{"type":"noteOn","track":0,"note":60,"velocity":0.8}`
- `{"type":"noteOff","track":0,"note":60}`
- `{"type":"setGain","trackName":"drums","gain":0.8}`
- `{"type":"setMaster","gain":0.8}`
- `{"type":"loadSample","name":"Kick","path":"C:/sounds/kick.wav"}`

Track Layout
------------
14 tracks matching the React mixer:
- Main: drums, bass, lead, pads, keys, guitar
- Drum submix: kick, snare, hihat, toms, overhead
- Sampler: oneshots, guitar-sampler, keys-sampler

Integration
-----------
The React app sends note events from the sequencer via WebSocket
instead of using Tone.js for audio output. Tone.js is kept only for
visualization/metring (analyser data).
