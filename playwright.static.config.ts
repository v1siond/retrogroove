import { defineConfig, devices } from '@playwright/test';

// Runs the e2e suite against the static production build (`out/`) served by the
// tiny static server — no dev compiler, so it's fast and deterministic.
// Run `npm run build` first, then `npm run e2e:static`.
export default defineConfig({
  testDir: './e2e/ticketing',
  fullyParallel: true,
  retries: 0,
  timeout: 60_000,
  expect: { timeout: 10_000 },
  reporter: [['line']],
  use: {
    baseURL: 'http://localhost:3340',
    trace: 'off',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    command: 'PORT=3340 node e2e/visual/static-server.mjs',
    url: 'http://localhost:3340',
    reuseExistingServer: false,
    timeout: 20000,
  },
});
