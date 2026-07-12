import { test, expect } from '@playwright/test';

test.describe('Drum Sequencer E2E', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    // Navigate to Rhythm Grid
    await page.click('text=Rhythm Grid');
  });

  test('should display the drum sequencer grid', async ({ page }) => {
    const grid = page.locator('[role="grid"]');
    await expect(grid).toBeVisible();
    await expect(page.locator('text=Drum Sequencer')).toBeVisible();
  });

  test('should toggle steps in the grid', async ({ page }) => {
    // Look for a step button
    const firstStep = page.locator('button[aria-label^="Step 1 on Track"]').first();
    await expect(firstStep).toBeVisible();
    
    const initialState = await firstStep.getAttribute('aria-pressed');
    await firstStep.click();
    const newState = await firstStep.getAttribute('aria-pressed');
    
    expect(newState).not.toBe(initialState);
  });

  test('should clear the grid', async ({ page }) => {
    // First add some steps
    const steps = page.locator('button[aria-label^="Step"]').all();
    // Just click a few
    const buttons = await page.locator('button[aria-label^="Step"]').limit(5).all();
    for (const btn of buttons) {
      await btn.click();
    }

    // Click clear
    await page.click('button[aria-label="Clear grid"]');

    // Check if any are pressed (should be none)
    const pressedSteps = page.locator('button[aria-pressed="true"]');
    await expect(pressedSteps).toHaveCount(0);
  });

  test('should load a preset', async ({ page }) => {
    // Click a preset button, e.g., "Techno"
    await page.click('text=Techno');
    
    // Check if some steps are now active
    const activeSteps = page.locator('button[aria-pressed="true"]');
    await expect(activeSteps.count()).toBeGreaterThan(0);
  });
});
