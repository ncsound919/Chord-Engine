/**
 * FINAL DIAGNOSTIC: Does ANY sound come out of the speakers?
 *
 * This test bypasses Tone.js entirely and uses the raw Web Audio API
 * to play a 440Hz tone directly through the app's AudioContext.
 * If you hear it, the speakers work and the issue is in Tone.js routing.
 * If you don't hear it, the AudioContext → speaker path is broken.
 */
import { test, expect, Page } from '@playwright/test';

test.setTimeout(60000);

test('Raw oscillator through AudioContext destination — do you hear a tone?', async ({ page }) => {
  await page.goto('/');
  await page.waitForTimeout(3000);

  // Click somewhere on the page to trigger a user gesture
  await page.click('text=Chord Engine');

  const result = await page.evaluate(() => {
    const ae = (window as any).__AUDIO_ENGINE__;
    const ctx = ae?.ctx;

    if (!ctx) {
      return { error: 'No AudioContext found' };
    }

    if (ctx.state !== 'running') {
      return { error: `AudioContext state: ${ctx.state}`, state: ctx.state };
    }

    // Play a raw Web Audio oscillator through the ACTUAL AudioContext destination
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    gain.gain.value = 0.3;     // Moderate volume
    osc.type = 'sine';
    osc.frequency.value = 440; // A4 note
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 2); // Play for 2 seconds

    return {
      success: true,
      state: ctx.state,
      sampleRate: ctx.sampleRate,
      message: '440Hz sine tone playing for 2 seconds through AudioContext.destination'
    };
  });

  console.log('Raw oscillator test result:', JSON.stringify(result, null, 2));
  
  // Wait for the tone to play
  await page.waitForTimeout(3000);
  
  if (result.error) {
    console.log(`❌ ${result.error}`);
  } else {
    console.log(`✅ ${result.message}`);
  }

  // If this raw oscillator didn't produce sound, the AudioContext → speaker path is broken
  // which is a browser/OS issue, not a code issue.
});
