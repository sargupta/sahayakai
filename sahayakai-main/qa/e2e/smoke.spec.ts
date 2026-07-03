/**
 * Public-route smoke suite (@smoke).
 *
 * The critical path that works WITHOUT real auth or secrets: the marketing
 * homepage, the Labs index (parked-tools listing), and a generator page's
 * form shell. These render client-side regardless of auth state (AppShell
 * does not redirect unauthenticated visitors away from tool routes — it just
 * renders the chrome + page), so they are safe to assert against in CI with
 * only stub Firebase/GenAI env vars.
 *
 * Deeper flows (actual generation, authenticated dashboard, billing) need a
 * provisioned storage-state and live secrets — those live in qa/tests and are
 * NOT part of this smoke gate. See qa/HARNESS.md. Follow-up: add authenticated
 * generator round-trips once a CI-safe test tenant is wired.
 *
 * Every test is tagged @smoke so CI can select this subset via
 * `--grep @smoke` even if the config's testDir widens later.
 */
import { test, expect, type ConsoleMessage } from '@playwright/test';

// Third-party noise we don't want failing the console-error assertion:
// analytics/telemetry beacons, favicon, and expected auth/network chatter
// when running against stub secrets. Keep this list tight and specific.
const IGNORED_CONSOLE = [
  /favicon\.ico/i,
  /Failed to load resource/i, // stub secrets ⇒ some optional resources 404
  /net::ERR_/i,
  /firebase/i, // stub Firebase config emits init warnings, not real bugs
  /app-check/i,
  /Download the React DevTools/i,
];

function collectConsoleErrors(errors: string[]) {
  return (msg: ConsoleMessage) => {
    if (msg.type() !== 'error') return;
    const text = msg.text();
    if (IGNORED_CONSOLE.some((re) => re.test(text))) return;
    errors.push(text);
  };
}

test.describe('@smoke public routes', () => {
  test('@smoke homepage renders the marketing hero (200)', async ({ page }) => {
    const errors: string[] = [];
    page.on('console', collectConsoleErrors(errors));
    page.on('pageerror', (err) => errors.push(String(err)));

    const res = await page.goto('/', { waitUntil: 'domcontentloaded' });
    expect(res?.status(), 'homepage HTTP status').toBeLessThan(400);

    // Cold visitors see <LandingPage />; the SahayakAI wordmark appears in the
    // nav and hero. Use a role-agnostic text assertion so a copy tweak to the
    // rotating headline doesn't break the smoke gate.
    await expect(page.getByText('SahayakAI', { exact: false }).first()).toBeVisible();

    await page.waitForLoadState('networkidle').catch(() => {});
    expect(errors, `unexpected console errors on /:\n${errors.join('\n')}`).toEqual([]);
  });

  test('@smoke Labs index lists parked tools', async ({ page }) => {
    const errors: string[] = [];
    page.on('console', collectConsoleErrors(errors));
    page.on('pageerror', (err) => errors.push(String(err)));

    const res = await page.goto('/labs', { waitUntil: 'domcontentloaded' });
    expect(res?.status(), 'labs HTTP status').toBeLessThan(400);

    // Labs heading + the parked-tools list (role="list" in labs/page.tsx).
    await expect(page.getByRole('heading', { name: 'Labs' })).toBeVisible();
    const list = page.getByRole('list').first();
    await expect(list).toBeVisible();
    // At least a couple of known parked tools should be listed.
    await expect(page.getByText('Visual Aid Designer', { exact: false }).first()).toBeVisible();
    await expect(page.getByText('Video Storyteller', { exact: false }).first()).toBeVisible();

    await page.waitForLoadState('networkidle').catch(() => {});
    expect(errors, `unexpected console errors on /labs:\n${errors.join('\n')}`).toEqual([]);
  });

  test('@smoke quiz-generator renders its form shell', async ({ page }) => {
    const errors: string[] = [];
    page.on('console', collectConsoleErrors(errors));
    page.on('pageerror', (err) => errors.push(String(err)));

    const res = await page.goto('/quiz-generator', { waitUntil: 'domcontentloaded' });
    expect(res?.status(), 'quiz-generator HTTP status').toBeLessThan(400);

    // The generator view mounts a form with at least one submit/generate
    // control. Wait past the Suspense "Loading…" fallback, then assert the
    // interactive shell is present (button is the most stable anchor across
    // copy/i18n changes).
    await expect(page.getByRole('button').first()).toBeVisible({ timeout: 15_000 });

    await page.waitForLoadState('networkidle').catch(() => {});
    expect(errors, `unexpected console errors on /quiz-generator:\n${errors.join('\n')}`).toEqual([]);
  });
});
