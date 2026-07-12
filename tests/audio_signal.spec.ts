/**
 * Audio pipeline verification with AudioContext state tracing
 */
import { test, Page } from '@playwright/test';

test.setTimeout(180000);

test('Audio pipeline with raw oscillator', async ({ page }) => {
  await page.goto('/');
  await page.waitForTimeout(3000);

  // Set tempo and generate a score
  const tempoInput = page.locator('input[type="number"]').first();
  await tempoInput.fill('120');
  await tempoInput.press('Tab');

  const addBtn = page.locator('button:has-text("ADD SECTION")');
  if (await addBtn.count() > 0) { await addBtn.first().click(); await page.waitForTimeout(500); }

  const genBtn = page.locator('button:has-text("Generate Full Score")');
  if (await genBtn.count() > 0) { await genBtn.first().click(); await page.waitForTimeout(6000); }

  // Load samples
  await page.locator('aside button:has-text("Instruments")').first().click();
  await page.waitForTimeout(500);
  const sbtns = page.locator('button:has-text("Soundbank")');
  for (let i = 0; i < await sbtns.count(); i++) {
    if ((await sbtns.nth(i).textContent())?.trim() === 'Soundbank') { await sbtns.nth(i).click(); break; }
  }
  await page.waitForTimeout(500);
  const bassBtn = page.locator('button:has-text("Quick Load Bass"), button:has-text("Reload Bass")').first();
  if (await bassBtn.isVisible().catch(() => false)) { await bassBtn.click(); await page.waitForTimeout(2000); }
  const kitBtn = page.locator('button:has-text("Quick Load Kit 1"), button:has-text("Reload Kit 1")').first();
  if (await kitBtn.isVisible().catch(() => false)) { await kitBtn.click(); await page.waitForTimeout(2000); }

  // Navigate to Arranger and click Play
  await page.locator('aside button:has-text("Arranger")').first().click();
  await page.waitForTimeout(500);
  const playBtn = page.locator('button[title="Play"], button[aria-label="Play playback"]').first();
  if (await playBtn.isVisible().catch(() => false)) {
    await playBtn.click();
    await page.waitForTimeout(3000);
  }

  // DIAGNOSTIC: Check AudioContext state BEFORE and AFTER resume
  const diag = await page.evaluate(async () => {
    const r: string[] = [];
    const ae = (window as any).__AUDIO_ENGINE__;
    const ctx = ae?.ctx;
    if (!ctx) { r.push('NO AudioContext'); return r; }

    const transport = (window as any).__TRANSPORT__;
    r.push(`AudioEngine.ctx.state=${ctx.state}, sampleRate=${ctx.sampleRate}, transport.isPlaying=${transport?.isPlaying}`);

    // If suspended, resume and check
    if (ctx.state === 'suspended') {
      r.push('Context suspended — calling ctx.resume()...');
      await ctx.resume();
      r.push(`After ctx.resume(): ${ctx.state}`);
    }

    // Play a raw oscillator directly to AudioContext destination
    if (ctx.state === 'running') {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      gain.gain.value = 0.3;
      osc.type = 'sine';
      osc.frequency.value = 440;
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(ctx.currentTime + 0.1);
      osc.stop(ctx.currentTime + 3);
      r.push('🔊 440Hz tone playing for 3s through ctx.destination');
    } else {
      r.push('❌ Context not running — cannot play tone');
    }

    // Master RMS
    try {
      const rms = ae.rmsAnalyser?.getValue?.();
      if (rms && rms.length > 0) {
        const vals: number[] = [];
        for (let i = 0; i < Math.min(rms.length, 8); i++) vals.push(Number(rms[i]).toFixed(5));
        r.push(`masterRMS: [${vals.join(', ')}]`);
      }
    } catch {}

    return r;
  });

  console.log('\n═══ DIAGNOSTIC RESULTS ═══');
  diag.forEach(l => console.log(`  ${l}`));
  console.log('════════════════════════\n');

  await page.waitForTimeout(4000);
});
