import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  // visual/ and demo/ have their own configs + servers (static build / real API);
  // the default mocked run must not pick them up.
  testIgnore: ['**/visual/**', '**/demo/**'],
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 1,
  workers: process.env.CI ? 1 : undefined,
  timeout: 60_000,
  expect: { timeout: 10_000 },
  reporter: 'html',
  use: {
    baseURL: 'http://localhost:3333',
    trace: 'on-first-retry',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    command: 'npx next dev --port 3333',
    url: 'http://localhost:3333',
    reuseExistingServer: !process.env.CI,
    timeout: 120000,
  },
});
