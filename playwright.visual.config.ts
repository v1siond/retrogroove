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
  timeout: 300_000,
  expect: { timeout: 30_000 },
  reporter: [['html', { open: 'never' }]],
  use: {
    baseURL: 'http://localhost:3334',
    headless: !process.env.HEADED,
    // Pacing comes from explicit beat() pauses in the spec; slowMo (which slows
    // every micro-action, including keystrokes) defaults off. Set SLOWMO for live watching.
    launchOptions: { slowMo: Number(process.env.SLOWMO || 0) },
    video: 'on',
    trace: 'on',
    viewport: { width: 1280, height: 800 },
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  // Runs against the static production build (`out/`) via a tiny static server —
  // no dev compiler, so the demo is fast and deterministic. Run `npm run build` first.
  webServer: {
    command: 'node e2e/visual/static-server.mjs',
    url: 'http://localhost:3334',
    reuseExistingServer: true,
    timeout: 30000,
  },
});
