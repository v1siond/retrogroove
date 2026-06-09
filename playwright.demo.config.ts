import { defineConfig, devices } from '@playwright/test';

// Real-backend demo suite: drives the static frontend (port 3340) against the
// real Phoenix API (port 4000, Culqi stubbed). Servers are orchestrated by
// e2e/demo/run.sh (which resets the DB, seeds an admin, builds + serves).
// Run with: npm run demo
export default defineConfig({
  testDir: './e2e/demo',
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 300_000,
  expect: { timeout: 30_000 },
  reporter: [['html', { open: 'never' }], ['line']],
  use: {
    baseURL: 'http://localhost:3340',
    // Crisp 1080p recordings: render at 2x (supersampled) and record at full
    // 1920x1080 (Playwright otherwise downscales video to an 800px box → blurry).
    viewport: { width: 1920, height: 1080 },
    deviceScaleFactor: 2,
    video: { mode: 'on', size: { width: 1920, height: 1080 } },
    trace: 'on',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
});
