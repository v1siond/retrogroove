import { defineConfig, devices } from '@playwright/test';

// Showcase-only config for the lifecycle demo video.
// Records video at 2560×1440 with deviceScaleFactor 2 (renders 5120×2880 → crisp).
// ffmpeg lanczos-upscales 2560×1440 → 3840×2160 for genuine 4K detail.
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
    // Record video at 2560×1440 — 1440p is a normal desktop width, layout stays intact
    video: { mode: 'on', size: { width: 2560, height: 1440 } },
    trace: 'off',
  },
  projects: [
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        headless: true,
        viewport: { width: 2560, height: 1440 },
        deviceScaleFactor: 2,
      },
    },
  ],
});
