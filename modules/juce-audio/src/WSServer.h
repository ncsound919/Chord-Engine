#pragma once

#include <juce_core/juce_core.h>
#include <juce_events/juce_events.h>
#include <functional>
#include <memory>

class ChordEngineAudio;

class WSServer : private juce::Thread {
public:
    WSServer(ChordEngineAudio* engine);
    ~WSServer() override;

    void start(int port);
    void stop();

private:
    void run() override;
    void handleMessage(const juce::String& msg);
    void sendResponse(const juce::String& msg);

    ChordEngineAudio* engine;
    int serverPort = 9876;
    std::unique_ptr<juce::StreamingSocket> serverSocket;
    std::unique_ptr<juce::StreamingSocket> clientSocket;
    bool shouldRun = false;
};
