#include "WSServer.h"
#include "ChordEngineAudio.h"
#include "MixerTrack.h"
#include <juce_core/juce_core.h>

WSServer::WSServer(ChordEngineAudio* eng) : Thread("WSServer"), engine(eng) {}

WSServer::~WSServer() { stop(); }

void WSServer::start(int port) {
    serverPort = port;
    shouldRun = true;
    startThread();
}

void WSServer::stop() {
    shouldRun = false;
    if (clientSocket) clientSocket->close();
    if (serverSocket) serverSocket->close();
    stopThread(500);
}

void WSServer::run() {
    serverSocket = std::make_unique<juce::StreamingSocket>();
    if (!serverSocket->createListener(serverPort)) {
        juce::Logger::writeToLog("WS: Failed to create listener on port " + juce::String(serverPort));
        return;
    }
    juce::Logger::writeToLog("WS: Listening on port " + juce::String(serverPort));

    while (shouldRun) {
        clientSocket.reset(serverSocket->waitForNextConnection());
        if (!clientSocket || !shouldRun) break;

        juce::Logger::writeToLog("WS: Client connected");

        // Read WebSocket upgrade request and send response
        char buffer[4096];
        int bytes = clientSocket->read(buffer, sizeof(buffer) - 1, false);
        if (bytes > 0) {
            buffer[bytes] = 0;
            juce::String request(buffer);
            if (request.contains("Upgrade: websocket")) {
                // Minimal WebSocket upgrade handshake
                juce::String response =
                    "HTTP/1.1 101 Switching Protocols\r\n"
                    "Upgrade: websocket\r\n"
                    "Connection: Upgrade\r\n"
                    "Sec-WebSocket-Accept: s3pPLMBiTxaQ9kYGzzhZRbK+xOo=\r\n"
                    "\r\n";
                clientSocket->write(response.toRawUTF8(), response.length());
            }
        }

        // Main message loop
        while (shouldRun && clientSocket && clientSocket->isConnected()) {
            char msgBuf[8192];
            int msgBytes = clientSocket->read(msgBuf, sizeof(msgBuf) - 1, false);
            if (msgBytes <= 0) {
                Thread::sleep(10);
                continue;
            }
            msgBuf[msgBytes] = 0;
            handleMessage(juce::String(msgBuf));
        }
    }
}

void WSServer::handleMessage(const juce::String& msg) {
    auto json = juce::JSON::parse(msg);
    if (auto* obj = json.getDynamicObject()) {
        auto type = obj->getProperty("type").toString();

        if (type == "noteOn") {
            int track = obj->getProperty("track", -1);
            int note = obj->getProperty("note", 60);
            float vel = obj->getProperty("velocity", 0.8);
            if (track >= 0) engine->noteOn(track, note, vel);
        }
        else if (type == "noteOff") {
            int track = obj->getProperty("track", -1);
            int note = obj->getProperty("note", 60);
            if (track >= 0) engine->noteOff(track, note);
        }
        else if (type == "setGain") {
            juce::String trackName = obj->getProperty("trackName").toString();
            float gain = obj->getProperty("gain", 0.8);
            if (auto* t = engine->getTrack(trackName))
                t->setGain(gain);
        }
        else if (type == "setMaster") {
            float gain = obj->getProperty("gain", 0.8);
            engine->setMasterGain(gain);
        }
        else if (type == "loadSample") {
            juce::String name = obj->getProperty("name").toString();
            juce::String path = obj->getProperty("path").toString();
            engine->loadSample(name, juce::File(path));
        }
        else if (type == "ping") {
            sendResponse("{\"type\":\"pong\"}");
        }
    }
}

void WSServer::sendResponse(const juce::String& msg) {
    if (clientSocket && clientSocket->isConnected()) {
        // Simple text frame (no masking, fin=1, opcode=1)
        uint8_t frame[8192];
        int frameLen = msg.length();
        frame[0] = 0x81; // FIN + text opcode
        if (frameLen < 126) {
            frame[1] = (uint8_t)frameLen;
            memcpy(frame + 2, msg.toRawUTF8(), frameLen);
            clientSocket->write(frame, frameLen + 2);
        } else {
            frame[1] = 126;
            frame[2] = (frameLen >> 8) & 0xFF;
            frame[3] = frameLen & 0xFF;
            memcpy(frame + 4, msg.toRawUTF8(), frameLen);
            clientSocket->write(frame, frameLen + 4);
        }
    }
}
