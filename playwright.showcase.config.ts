import { defineConfig, devices } from '@playwright/test';

// Showcase-only config for the lifecycle demo video.
// Records video at 1920×1080 with deviceScaleFactor 2.
// Output: recordings/demo-retrogroove-lifecycle.mp4 (ffmpeg'd by run-showcase.sh)
export default defineConfig({
  testDir: './e2e/demo',
  testMatch: '**/showcase.spec.ts',
  outputDir: './showcase-results',
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 1_800_000,
  expect: { timeout: 30_000 },
  reporter: [['line']],
  use: {
    baseURL: process.env.BASE_URL || 'http://localhost:3340',
    // Record video for the showcase
    video: { mode: 'on', size: { width: 1920, height: 1080 } },
    trace: 'off',
  },
  projects: [
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        headless: true,
        viewport: { width: 1920, height: 1080 },
        deviceScaleFactor: 2,
      },
    },
  ],
});
