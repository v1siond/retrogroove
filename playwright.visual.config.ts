import { defineConfig, devices } from '@playwright/test';

// Visual/demo run: one worker, slowed down, video + trace recorded, narrated
// on-screen. Run headless (records a video) or headed locally:
//   npm run e2e:visual            # headless, records video
//   HEADED=1 SLOWMO=700 npm run e2e:visual   # watch it live
export default defineConfig({
  testDir: './e2e/visual',
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 180_000,
  reporter: [['html', { open: 'never' }]],
  use: {
    baseURL: 'http://localhost:3333',
    headless: !process.env.HEADED,
    launchOptions: { slowMo: Number(process.env.SLOWMO || 500) },
    video: 'on',
    trace: 'on',
    viewport: { width: 1280, height: 800 },
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    command: 'npx next dev --port 3333',
    url: 'http://localhost:3333',
    reuseExistingServer: true,
    timeout: 120000,
  },
});
