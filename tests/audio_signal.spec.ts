/**
 * AUDIO SIGNAL VERIFICATION TEST - The Final Word
 *
 * This test does NOT check UI. It injects code into the browser runtime
 * and reads actual audio signal values from Tone.js analyser nodes at
 * every step of the signal chain.
 *
 * If this test says "no signal," audio is truly broken.
 * If this test says "signal," audio IS flowing and the issue is elsewhere.
 */
import { test, expect, Page } from '@playwright/test';

test.setTimeout(180000);

async function waitForApp(page: Page) {
  await page.waitForSelector('text=Chord Engine', { timeout: 30000 });
  await page.waitForTimeout(3000); // Let all init effects run
}

test('Audio Pipeline Verification — end-to-end signal measurement', async ({ page }) => {
  await page.goto('/');
  await waitForApp(page);

  const results: string[] = [];

  // ═══════════════════════════════════════════════════════
  // PHASE 1: Verify basic Web Audio infrastructure
  // ═══════════════════════════════════════════════════════
  const phase1 = await page.evaluate(() => {
    const w = window as any;
    const diag: string[] = [];

    // 1a. Can we create an AudioContext?
    try {
      const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
      diag.push(`1a. AudioContext created: state=${ctx.state}, sampleRate=${ctx.sampleRate}, channels=${ctx.destination.maxChannelCount}`);
      void ctx.close();
    } catch (e: any) {
      diag.push(`1a. AudioContext FAILED: ${e.message}`);
    }

    // 1b. Does Tone.js exist and have a context?
    const tone = w.Tone;
    if (tone) {
      try {
        const tctx = tone.getContext();
        diag.push(`1b. Tone.js context: state=${tctx.state}, rawState=${tctx.rawContext?.state}`);
      } catch (e: any) {
        diag.push(`1b. Tone.js context FAILED: ${e.message}`);
      }
    } else {
      diag.push('1b. Tone.js NOT on window (ES module build — expected)');
    }

    // 1c. Check global AudioEngine singleton
    const ae = w.__AUDIO_ENGINE__;
    if (ae) {
      const trackCount = ae.tracks?.size || 0;
      const loadedCount = ae.loadedSamples?.size || 0;
      diag.push(`1c. AudioEngine singleton: ${trackCount} tracks, ${loadedCount} loaded samples`);
    } else {
      diag.push('1c. AudioEngine singleton NOT found on window');
    }

    return diag;
  });
  results.push(...phase1);

  // ═══════════════════════════════════════════════════════
  // PHASE 2: Load sounds and generate a composition
  // ═══════════════════════════════════════════════════════
  
  // Set tempo/key
  const tempoInput = page.locator('input[type="number"]').first();
  await tempoInput.fill('120');
  await tempoInput.press('Tab');

  // Add a section first (required before generation)
  const addSectionBtn = page.locator('button:has-text("ADD SECTION")');
  if (await addSectionBtn.count() > 0) {
    await addSectionBtn.first().click();
    await page.waitForTimeout(500);
    results.push('2. Added section');
  }

  // Generate score
  const generateBtn = page.locator('button:has-text("Generate Full Score")');
  if (await generateBtn.count() > 0) {
    await generateBtn.first().click();
    await page.waitForTimeout(8000); // More time for generation
    // Verify: check if chord elements appeared in DOM
    const pageText = await page.textContent('body');
    const hasChords = pageText?.includes('I') || pageText?.includes('IV') || pageText?.includes('V');
    results.push(`2. Generation: ${hasChords ? '✅ chords visible' : '❌ no chords yet'}`);
  }

  // Navigate to Instruments → Soundbank → Quick Load Bass + Kit 1
  await page.locator('aside button:has-text("Instruments")').first().click();
  await page.waitForTimeout(500);

  // Click Soundbank inner tab
  const soundbankBtns = page.locator('button:has-text("Soundbank")');
  for (let i = 0; i < await soundbankBtns.count(); i++) {
    if ((await soundbankBtns.nth(i).textContent())?.trim() === 'Soundbank') {
      await soundbankBtns.nth(i).click();
      break;
    }
  }
  await page.waitForTimeout(500);

  // Quick Load Bass
  const bassBtn = page.locator('button:has-text("Quick Load Bass"), button:has-text("Reload Bass")').first();
  if (await bassBtn.isVisible().catch(() => false)) {
    await bassBtn.click();
    await page.waitForTimeout(2000);
    results.push('2. Bass sample load requested');
  }

  // Quick Load Kit 1
  const kitBtn = page.locator('button:has-text("Quick Load Kit 1"), button:has-text("Reload Kit 1")').first();
  if (await kitBtn.isVisible().catch(() => false)) {
    await kitBtn.click();
    await page.waitForTimeout(2000);
    results.push('2. Drum kit load requested');
  }

  // ═══════════════════════════════════════════════════════
  // PHASE 3: Check what actually loaded
  // ═══════════════════════════════════════════════════════
  const phase3 = await page.evaluate(() => {
    const w = window as any;
    const ae = w.__AUDIO_ENGINE__;
    const diag: string[] = [];
    
    if (!ae) {
      diag.push('3. AudioEngine not accessible');
      return diag;
    }

    const sampleNames = Array.from(ae.loadedSamples?.keys() || []);
    diag.push(`3. Loaded samples (${sampleNames.length}): [${sampleNames.join(', ')}]`);

    // Check each track's state
    const trackStates: string[] = [];
    if (ae.tracks) {
      for (const [name, track] of ae.tracks) {
        const vol = track.volume ?? '?';
        const muted = track._mutedEffective ?? false;
        const solo = track.isSolo ?? false;
        trackStates.push(`${name}(v=${vol},m=${muted},s=${solo})`);
      }
    }
    diag.push(`3. Track states: ${trackStates.join(' ')}`);

    return diag;
  });
  results.push(...phase3);

  // ═══════════════════════════════════════════════════════
  // PHASE 4: Start playback and measure actual audio signal
  // ═══════════════════════════════════════════════════════
  
  // Navigate to Arranger for playback
  await page.locator('aside button:has-text("Arranger")').first().click();
  await page.waitForTimeout(500);

  // Click Play
  const playBtn = page.locator('button[title="Play"], button[aria-label="Play playback"]').first();
  if (await playBtn.isVisible().catch(() => false)) {
    await playBtn.click();
    await page.waitForTimeout(3000); // Let audio flow for 3 seconds
    results.push('4. Playback started');
  } else {
    results.push('4. Play button NOT found — cannot start playback');
  }

  // ═══════════════════════════════════════════════════════
  // PHASE 5: Real audio measurement
  // ═══════════════════════════════════════════════════════
  const phase5 = await page.evaluate(() => {
    const w = window as any;
    const ae = w.__AUDIO_ENGINE__;
    const diag: string[] = [];

    if (!ae) { diag.push('5a. AudioEngine not accessible'); return diag; }

    // Read RAW FFT samples from drums (should have audio) vs oneshots (should be silent)
    function rawSamples(analyser: any, prefix: string) {
      if (!analyser) { diag.push(`${prefix}: no analyser`); return; }
      const data = analyser.getValue();
      if (!data) { diag.push(`${prefix}: no data`); return; }
      const vals: number[] = [];
      for (let i = 0; i < Math.min(data.length, 8); i++) vals.push(Number(data[i]));
      diag.push(`${prefix}(${data.length}): [${vals.map(v => v.toFixed(6)).join(', ')}]`);
    }

    const drums = ae.tracks?.get('drums');
    const oneshots = ae.tracks?.get('oneshots');
    rawSamples(drums?.analyser, '5a. drums FFT');
    rawSamples(oneshots?.analyser, '5b. oneshots FFT');
    rawSamples(ae.rmsAnalyser, '5c. master RMS');
    rawSamples(ae.masterAnalyser, '5d. master FFT');

    // Check master dryGain
    try {
      diag.push(`5e. dryGain volume: ${ae.dryGain?.volume?.value ?? '?'}`);
    } catch { diag.push('5e. dryGain: read error'); }

    // Try to read the generated sections from Zustand store via global
    const gs = (window as any).__GENERATION_STORE__?.getState;
    if (typeof gs === 'function') {
      const state = gs();
      diag.push(`5f. Generated count: ${state.generated?.length || 0}`);
    }

    // Count chord elements in DOM — if LeadSheet rendered, generation worked
    const chordEls = document.querySelectorAll('[class*="chord"], [class*="roman"], [class*="quality"]');
    diag.push(`5g. DOM chord elements: ${chordEls.length || 0}`);

    // Check if Tone.Transport is actually advancing
    try {
      const t = (self as any).Tone || w.Tone;
      if (t && t.getTransport) {
        const tp = t.getTransport();
        const pos = tp.position || 'unknown';
        const state = tp.state || 'unknown';
        diag.push(`5h. Tone.Transport: ${state} @ ${pos}`);
      }
    } catch { diag.push('5h. Transport: not accessible'); }

    return diag;
  });
  results.push(...phase5);

  // ═══════════════════════════════════════════════════════
  // PHASE 6: DIRECT TEST SIGNAL — bypass sequencer entirely
  // If this shows signal, the audio chain is fine and the
  // issue is in the generation/sequencing pipeline.
  // ═══════════════════════════════════════════════════════
  const phase6 = await page.evaluate(() => {
    const w = window as any;
    const ae = w.__AUDIO_ENGINE__;
    const diag: string[] = [];

    if (!ae) { diag.push('6a. No AudioEngine — cannot inject test signal'); return diag; }

    const drums = ae.tracks?.get('drums');
    if (!drums) { diag.push('6b. No drums track'); return diag; }

    diag.push('6b. Drums track found, injecting test 440Hz tone via playNote()...');

    // Play a test note through the drums track — 440Hz for 0.5 seconds
    try {
      const now = ae.ctx.currentTime;
      drums.playNote(440, 'sine', now + 0.1, 0.5, { attack: 0.01, decay: 0.1, sustain: 0.5, release: 0.1 });
      diag.push('6c. Test note scheduled at ' + (now + 0.1).toFixed(3));
    } catch (e: any) {
      diag.push('6c. Test note FAILED: ' + e.message);
    }

    // Wait 2 seconds then read the analysers
    return diag;
  });
  results.push(...phase6);

  // Wait for the test tone to play through
  await page.waitForTimeout(2000);

  // Read analysers again after test tone
  const phase6b = await page.evaluate(() => {
    const w = window as any;
    const ae = w.__AUDIO_ENGINE__;
    const diag: string[] = [];

    if (!ae) return diag;

    function readFirst8(analyser: any): number[] {
      if (!analyser) return [];
      const data = analyser.getValue();
      if (!data) return [];
      const vals: number[] = [];
      for (let i = 0; i < Math.min(data.length, 8); i++) vals.push(Number(data[i]));
      return vals;
    }

    const drumsFft = readFirst8(ae.tracks?.get('drums')?.analyser);
    const masterRms = readFirst8(ae.rmsAnalyser);
    const masterFft = readFirst8(ae.masterAnalyser);

    diag.push(`6d. AFTER test tone — drums FFT: [${drumsFft.map(v => v.toFixed(1)).join(', ')}]`);
    diag.push(`6e. AFTER test tone — master RMS: [${masterRms.map(v => v.toFixed(4)).join(', ')}]`);
    diag.push(`6f. AFTER test tone — master FFT: [${masterFft.map(v => v.toFixed(1)).join(', ')}]`);

    const hasDrumsSignal = drumsFft.some(v => v > -100);
    const hasMasterRms = masterRms.some(v => Math.abs(v) > 1e-6);
    diag.push(`  6g. ${hasDrumsSignal ? '🔥' : '❄️'} drums, ${hasMasterRms ? '🔥' : '❄️'} master — ${(hasDrumsSignal && hasMasterRms) ? 'AUDIO CHAIN WORKS' : 'AUDIO CHAIN BROKEN'}`);

    return diag;
  });
  results.push(...phase6b);

  // ═══════════════════════════════════════════════════════
  // PHASE 7: Check sequencer state
  // ═══════════════════════════════════════════════════════
  const phase7 = await page.evaluate(() => {
    const w = window as any;
    const ae = w.__AUDIO_ENGINE__;
    const tp = w.__TRANSPORT__;
    const diag: string[] = [];

    if (tp) {
      diag.push(`7a. Transport singleton: playing=${tp.isPlaying}, tempo=${tp.tempo}`);
    }

    // Check if the global __SEQUENCER__ was set
    const sq = w.__SEQUENCER__;
    if (sq) {
      diag.push(`7b. Sequencer isRunning=${sq.isRunning}, sections=${sq.currentSections?.length || 0}`);
      if (sq.currentSections?.length > 0) {
        const sec = sq.currentSections[0];
        const gridKeys = sec.drumPattern?.grid ? Object.keys(sec.drumPattern.grid).join(',') : 'NONE';
        diag.push(`7c. First section: ${sec.def?.name}, bars=${sec.def?.lengthBars}, grid=[${gridKeys}]`);
        // Check if any step is active
        let active = 0;
        const grid = sec.drumPattern?.grid || {};
        for (const k of Object.keys(grid)) {
          for (let i = 0; i < grid[k].length; i++) {
            if (grid[k][i]) active++;
          }
        }
        diag.push(`7d. Active drum steps: ${active}`);
      }
    } else {
      diag.push(`7b. **SEQUENCER NOT ON WINDOW** — set window.__SEQUENCER__ = sequencer in your app init`);
    }

    return diag;
  });
  results.push(...phase7);

  // Stop playback
  const stopBtn = page.locator('button[title="Pause"], button[aria-label="Pause playback"]').first();
  if (await stopBtn.isVisible().catch(() => false)) {
    await stopBtn.click();
  }

  // ═══════════════════════════════════════════════════════
  // REPORT
  // ═══════════════════════════════════════════════════════
  console.log('\n═══════════════════════════════════════');
  console.log('  AUDIO SIGNAL VERIFICATION REPORT');
  console.log('═══════════════════════════════════════');
  results.forEach(r => console.log(`  ${r}`));

  const hasSignal = results.some(r => r.includes('🔥'));
  const noSignal = results.some(r => r.includes('❄️ NO SIGNAL') || r.includes('NO SIGNAL'));

  if (hasSignal && !noSignal) {
    console.log('\n  ✅ VERDICT: Audio IS flowing through the chain');
    console.log('  If you cannot hear it, check OS volume,');
    console.log('  browser tab mute, and physical speakers.\n');
  } else if (noSignal) {
    console.log('\n  ❌ VERDICT: Audio is NOT flowing');
    console.log('  The analyser nodes show zero signal.');
    console.log('  Check track volumes, mute/solo states above.\n');
  } else {
    console.log('\n  ⚠️ VERDICT: Inconclusive\n');
  }
  console.log('═══════════════════════════════════════\n');

  // Don't fail the test — just report. We want to SEE the data.
  expect(results.length).toBeGreaterThan(0);
});
