// Smoke test confirming the provisioned storage-state actually authenticates
// the browser session. Skipped unless QA_STORAGE_STATE is set.
import { test, expect } from '@playwright/test';

test.skip(!process.env.QA_STORAGE_STATE, 'Provision storage-state first: see qa/HARNESS.md');

test('authenticated session reaches dashboard', async ({ page }) => {
  await page.goto('/dashboard', { waitUntil: 'domcontentloaded' });
  // Either the dashboard loads, or we get redirected to /login if the token didn't take.
  await page.waitForLoadState('networkidle').catch(() => {});
  const url = page.url();
  expect(url).not.toMatch(/\/login(\?|$)/);
});
