// ─────────────────────────────────────────────────────────────
// SHOWCASE video fixture — 2560×1440 @2× capture → ffmpeg upscale for RetroGroove.
//
// Captures at 2560×1440 with deviceScaleFactor 2 (renders 5120×2880 → crisp).
// 1440p is a standard desktop width so the app layout stays intact (no sparse
// whitespace). ffmpeg lanczos-upscales to 3840×2160 @60fps for genuine 4K.
// SHOWCASE_FAST=1 → ultrafast/crf30 for dress rehearsals.
//
// Output path: recordings/demo-<recordingName>.mp4
// ─────────────────────────────────────────────────────────────
import { test as base, expect } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { execFileSync } from 'node:child_process';
import { CURSOR_OVERLAY_SCRIPT } from './showcase.js';

const RECORDINGS_DIR = path.resolve(process.cwd(), 'recordings');

const RES =
  process.env.SHOWCASE_RES === '4K'
    ? { w: 3840, h: 2160 }
    : { w: 3840, h: 2160 };  // always 4K output; source is 2560×1440 @ dsf2

export const SHOWCASE_RES = RES;

// Capture at 2560×1440 — standard desktop width keeps layout intact;
// deviceScaleFactor 2 renders at 5120×2880 for supersampled crispness.
const VIEWPORT = { width: 2560, height: 1440 };

// Extend with recordingName as a worker-level option.
// Using eslint-disable because the Playwright generics require any here.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const test = (base as any).extend({
  recordingName: ['showcase', { option: true, scope: 'worker' }],

   
  context: async ({ browser, recordingName }: { browser: import('@playwright/test').Browser; recordingName: string }, use: (ctx: import('@playwright/test').BrowserContext) => Promise<void>) => {
    const tmpDir = fs.mkdtempSync(
      path.join(os.tmpdir(), `pw-showcase-${recordingName}-`),
    );
    const context = await browser.newContext({
      viewport: VIEWPORT,
      deviceScaleFactor: 2,
      locale: 'es-PE',
      recordVideo: { dir: tmpDir, size: { width: VIEWPORT.width, height: VIEWPORT.height } },
    });

    // Inject Izipay test hook so payments short-circuit without a real redirect.
    await context.addInitScript(() => {
      try {
        (window as unknown as { __IZIPAY_TEST_SKIP__?: boolean }).__IZIPAY_TEST_SKIP__ = true;
      } catch { /* ignore */ }
    });

    // Inject cursor + spotlight overlay.
    await context.addInitScript(CURSOR_OVERLAY_SCRIPT);

    await use(context);

    // Finalize the .webm then transcode → MP4.
    const pages = context.pages();
    const video = pages[0]?.video();
    await context.close();

    if (video) {
      fs.mkdirSync(RECORDINGS_DIR, { recursive: true });
      const webm = path.join(RECORDINGS_DIR, `demo-${recordingName}.webm`);
      const mp4 = path.join(RECORDINGS_DIR, `demo-${recordingName}.mp4`);
      const src = await video.path();
      await video.saveAs(webm);
      try {
        if (src && fs.existsSync(src)) fs.unlinkSync(src);
      } catch { /* best-effort */ }

      const FAST = !!process.env.SHOWCASE_FAST;
      try {
        execFileSync(
          'ffmpeg',
          [
            '-y',
            '-i', webm,
            '-vf',
            `scale=${RES.w}:${RES.h}:flags=${FAST ? 'bilinear' : 'lanczos'},fps=${FAST ? 30 : 60}`,
            '-c:v', 'libx264',
            '-crf', FAST ? '30' : '17',
            '-preset', FAST ? 'ultrafast' : 'slow',
            '-pix_fmt', 'yuv420p',
            '-movflags', '+faststart',
            mp4,
          ],
          { stdio: 'inherit' },
        );
        fs.unlinkSync(webm);
      } catch (e: unknown) {
        console.error('[showcase] ffmpeg transcode failed:', (e as Error)?.message || e);
      }
    }
    fs.rmSync(tmpDir, { recursive: true, force: true });
  },
});

// Re-export expect from base
export { expect } from '@playwright/test';
