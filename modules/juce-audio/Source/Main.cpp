#include "PluginProcessor.h"
#include <juce_audio_utils/juce_audio_utils.h>
#include <juce_gui_basics/juce_gui_basics.h>

class ChordEngineApplication : public juce::JUCEApplication
{
public:
    ChordEngineApplication() {}

    const juce::String getApplicationName() override { return "Chord Engine"; }
    const juce::String getApplicationVersion() override { return "1.0.0"; }
    bool moreThanOneInstanceAllowed() override { return true; }

    void initialise (const juce::String&) override
    {
        mainWindow = std::make_unique<MainWindow> (getApplicationName());
    }

    void shutdown() override
    {
        mainWindow = nullptr;
    }

    void anotherInstanceStarted (const juce::String&) override {}

private:
    class MainWindow : public juce::DocumentWindow
    {
    public:
        MainWindow (const juce::String& name)
            : DocumentWindow (name,
                              juce::Desktop::getInstance().getDefaultLookAndFeel()
                                  .findColour (ResizableWindow::backgroundColourId),
                              DocumentWindow::allButtons)
        {
            setUsingNativeTitleBar (true);
            setContentOwned (new ChordEngineAudioProcessorEditor (processor), true);
            setResizable (true, true);
            centreWithSize (800, 600);
            setVisible (true);
        }

        void closeButtonPressed() override
        {
            JUCEApplication::getInstance()->systemRequestedQuit();
        }

    private:
        ChordEngineAudioProcessor processor;
    };

    std::unique_ptr<MainWindow> mainWindow;
};

START_JUCE_APPLICATION (ChordEngineApplication)
