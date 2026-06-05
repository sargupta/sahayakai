import { defineConfig, devices } from '@playwright/test';
import path from 'node:path';

const BASE_URL =
  process.env.QA_BASE_URL || 'https://sahayakai-preview-zwydpvyuca-as.a.run.app';

// Storage state is provisioned per-run by scripts/qa/playwright-storage-state.mjs
// and the path is passed in via QA_STORAGE_STATE. If not provided, Playwright runs
// in unauthenticated mode (useful for sign-in flow tests).
const storageState = process.env.QA_STORAGE_STATE
  ? path.resolve(process.env.QA_STORAGE_STATE)
  : undefined;

export default defineConfig({
  testDir: path.resolve(__dirname, 'tests'),
  timeout: 60_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  retries: 0,
  reporter: [['list'], ['html', { outputFolder: path.resolve(__dirname, 'results/playwright-report'), open: 'never' }]],
  outputDir: path.resolve(__dirname, 'results/playwright-output'),
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
