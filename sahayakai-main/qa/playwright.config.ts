import { defineConfig, devices } from '@playwright/test';
import path from 'node:path';

// Default target is the UAT environment (the preview Cloud Run service acts
// as UAT until a dedicated UAT URL exists). CI passes QA_BASE_URL explicitly:
// the uat-verify workflow sets it from the repo var UAT_BASE_URL.
const BASE_URL =
  process.env.QA_BASE_URL || 'https://sahayakai-preview-zwydpvyuca-as.a.run.app';

// Storage state is provisioned per-run by scripts/qa/playwright-storage-state.mjs
// and the path is passed in via QA_STORAGE_STATE. If not provided, Playwright runs
// in unauthenticated mode (useful for sign-in flow tests).
const storageState = process.env.QA_STORAGE_STATE
  ? path.resolve(process.env.QA_STORAGE_STATE)
  : undefined;

// Optionally boot a local Next server for the run. This is what the
// e2e-smoke CI job uses: it builds the app, then Playwright starts `next
// start` and runs the @smoke suite against it — no live preview or secrets
// required. Guarded so the default (pointing at the deployed preview URL)
// still works unchanged for local/authenticated runs.
//   QA_START_SERVER=1  → boot a server
//   QA_SERVER_CMD      → override the command (default: next start on the port)
//   QA_BASE_URL        → e.g. http://127.0.0.1:3000 (port is parsed from it)
const START_SERVER =
  process.env.QA_START_SERVER === '1' || /localhost|127\.0\.0\.1/.test(BASE_URL);

let webServer: import('@playwright/test').PlaywrightTestConfig['webServer'];
if (START_SERVER) {
  const port = Number(new URL(BASE_URL).port || '3000');
  webServer = {
    command:
      process.env.QA_SERVER_CMD ||
      `node_modules/.bin/next start -p ${port}`,
    url: BASE_URL,
    cwd: path.resolve(__dirname, '..'),
    timeout: 120_000,
    reuseExistingServer: !process.env.CI,
    stdout: 'pipe',
    stderr: 'pipe',
  };
}

export default defineConfig({
  // Widened from `tests/` to `qa/` so the public @smoke suite in `qa/e2e/`
  // is discovered alongside the authenticated harness specs in `qa/tests/`.
  // Playwright's default testMatch only picks up *.spec.ts / *.test.ts.
  testDir: path.resolve(__dirname),
  timeout: 60_000,
  expect: {
    timeout: 10_000,
    // Visual-regression tolerance for the @visual suite (qa/e2e/visual.spec.ts).
    // 2% of pixels may differ before a comparison fails — absorbs minor
    // anti-aliasing drift without hiding real layout/theme regressions.
    toHaveScreenshot: { maxDiffPixelRatio: 0.02 },
  },
  // Keep screenshot baselines together under qa/e2e/__screenshots__/ instead
  // of Playwright's default per-spec-file "-snapshots" sibling dirs.
  // NOTE: the template deliberately omits {platform} — baselines are
  // linux-CI-generated ONLY (font rasterisation differs per OS). Never commit
  // darwin-generated snapshots; see qa/HARNESS.md "Visual Regression".
  snapshotPathTemplate: '{testDir}/e2e/__screenshots__/{projectName}/{arg}{ext}',
  fullyParallel: false,
  retries: 0,
  reporter: [['list'], ['html', { outputFolder: path.resolve(__dirname, 'results/playwright-report'), open: 'never' }]],
  outputDir: path.resolve(__dirname, 'results/playwright-output'),
  webServer,
  use: {
    baseURL: BASE_URL,
    storageState,
    headless: true,
    actionTimeout: 15_000,
    navigationTimeout: 30_000,
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
    video: 'retain-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
});
