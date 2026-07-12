import { test, expect } from '@playwright/test';

test('has title and smoke test', async ({ page }) => {
  await page.goto('/');
  // Basic smoke e2e check to ensure the page loads and has some key element
  await expect(page.locator('text=Audio Engine')).toBeVisible();
});
