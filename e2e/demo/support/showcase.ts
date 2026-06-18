// ─────────────────────────────────────────────────────────────
// Showcase helpers — cursor overlay, humanType, moveClick, moveHover, spotlight
//
// Ported from auditechme/playwright/support/showcase.js for the RetroGroove
// lifecycle demo. TypeScript version; same logic, zero app-specific code.
// ─────────────────────────────────────────────────────────────
import type { Page, Locator } from '@playwright/test';

// ── Cursor + Spotlight overlay ──────────────────────────────────────────────
// Injects:
//   1. A fake pointer SVG that follows real mouse events (crisp at 4K, sits
//      above every layer, pointer-events:none so it never blocks clicks).
//   2. Click ripple that expands on mousedown.
//   3. Spotlight: full-page dim with a soft radial hole that tracks the cursor.
// ─────────────────────────────────────────────────────────────────────────────
export const CURSOR_OVERLAY_SCRIPT = (): void => {
  const install = (): void => {
    if ((window as unknown as { __showcaseCursorInstalled?: boolean }).__showcaseCursorInstalled) return;
    if (!document.body) {
      document.addEventListener('DOMContentLoaded', install, { once: true });
      return;
    }
    (window as unknown as { __showcaseCursorInstalled?: boolean }).__showcaseCursorInstalled = true;

    const Z = 2147483647;

    // ── Cursor pointer SVG ──
    const cursor = document.createElement('div');
    cursor.setAttribute('aria-hidden', 'true');
    cursor.style.cssText = [
      'position:fixed',
      'left:0',
      'top:0',
      'width:28px',
      'height:28px',
      `z-index:${Z}`,
      'pointer-events:none',
      'will-change:transform',
      'transform:translate(-2px,-2px)',
      'filter:drop-shadow(0 1px 2px rgba(0,0,0,0.45))',
    ].join(';');
    cursor.innerHTML =
      '<svg width="28" height="28" viewBox="0 0 28 28" xmlns="http://www.w3.org/2000/svg">' +
      '<path d="M5 3 L5 22 L10.2 17 L13.6 24.2 L16.8 22.7 L13.4 15.6 L20.5 15.6 Z" ' +
      'fill="#ffffff" stroke="#111111" stroke-width="1.3" stroke-linejoin="round"/>' +
      '</svg>';

    // ── Ripple layer ──
    const rippleLayer = document.createElement('div');
    rippleLayer.setAttribute('aria-hidden', 'true');
    rippleLayer.style.cssText = [
      'position:fixed',
      'left:0',
      'top:0',
      'width:0',
      'height:0',
      `z-index:${Z - 1}`,
      'pointer-events:none',
    ].join(';');

    // ── Spotlight overlay ──
    const spotlight = document.createElement('div');
    spotlight.setAttribute('aria-hidden', 'true');
    spotlight.style.cssText = [
      'position:fixed',
      'inset:0',
      `z-index:${Z - 2}`,
      'pointer-events:none',
      'transition:background .12s ease',
    ].join(';');

    // ── Keyframes ──
    const style = document.createElement('style');
    style.textContent =
      '@keyframes __showcaseRipple{0%{transform:translate(-50%,-50%) scale(0.2);opacity:0.55}' +
      '100%{transform:translate(-50%,-50%) scale(1);opacity:0}}';

    const mount = (): void => {
      document.documentElement.appendChild(style);
      document.body.appendChild(spotlight);
      document.body.appendChild(rippleLayer);
      document.body.appendChild(cursor);
    };
    mount();

    const ensure = (): void => {
      if (!cursor.isConnected || !rippleLayer.isConnected || !spotlight.isConnected) {
        try { mount(); } catch { /* ignore */ }
      }
    };

    let lastX = window.innerWidth / 2;
    let lastY = window.innerHeight / 2;

    const place = (x: number, y: number): void => {
      lastX = x; lastY = y;
      cursor.style.transform = `translate(${x - 2}px,${y - 2}px)`;
      spotlight.style.background =
        `radial-gradient(ellipse 320px 260px at ${x}px ${y}px, transparent 0%, rgba(0,0,0,0.48) 100%)`;
    };
    place(lastX, lastY);

    document.addEventListener('mousemove', (e) => { place(e.clientX, e.clientY); ensure(); }, true);

    document.addEventListener('mousedown', (e) => {
      const x = e.clientX || lastX;
      const y = e.clientY || lastY;
      cursor.style.transform = `translate(${x - 2}px,${y - 2}px) scale(0.85)`;
      const r = document.createElement('div');
      r.style.cssText = [
        'position:fixed',
        `left:${x}px`,
        `top:${y}px`,
        'width:46px',
        'height:46px',
        'border-radius:50%',
        'background:radial-gradient(circle,rgba(255,20,147,0.45) 0%,rgba(255,20,147,0.12) 55%,rgba(255,20,147,0) 70%)',
        'border:2px solid rgba(255,20,147,0.55)',
        'pointer-events:none',
        'animation:__showcaseRipple 0.5s ease-out forwards',
      ].join(';');
      rippleLayer.appendChild(r);
      setTimeout(() => r.remove(), 600);
    }, true);

    document.addEventListener('mouseup', (e) => {
      const x = e.clientX || lastX;
      const y = e.clientY || lastY;
      cursor.style.transform = `translate(${x - 2}px,${y - 2}px)`;
    }, true);
  };

  install();
};

// ── Realistic typing ──────────────────────────────────────────────────────────
const TYPE_SCALE = Number(process.env.SHOWCASE_TYPE_SCALE) || 1;
const sleep = (page: Page, ms: number): Promise<void> =>
  page.waitForTimeout(Math.max(0, Math.round(ms)));

export const humanType = async (page: Page, target: string | Locator, text: string): Promise<void> => {
  const el = typeof target === 'string' ? page.locator(target) : target;
  await el.scrollIntoViewIfNeeded().catch(() => {});
  await moveClick(page, el);
  await sleep(page, 180 * TYPE_SCALE);
  const str = String(text);
  const base = 68;
  for (let i = 0; i < str.length; i++) {
    const ch = str[i];
    let delay = base + (Math.random() * 46 - 18);
    const prev = str[i - 1];
    if (prev === ' ') delay += 35 + Math.random() * 45;
    if (prev && '.,;:!?'.includes(prev)) delay += 90 + Math.random() * 130;
    if (Math.random() < 0.04) delay += 200 + Math.random() * 200;
    await el.pressSequentially(ch, { delay: Math.round(delay * TYPE_SCALE) });
  }
};

// ── Realistic mouse glide ─────────────────────────────────────────────────────
const centerOf = async (locator: Locator): Promise<{ x: number; y: number } | null> => {
  await locator.scrollIntoViewIfNeeded().catch(() => {});
  const box = await locator.boundingBox();
  if (!box) return null;
  return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
};

export const moveClick = async (
  page: Page,
  target: string | Locator,
  opts: { steps?: number; settle?: number } = {},
): Promise<void> => {
  const el = typeof target === 'string' ? page.locator(target) : target;
  const c = await centerOf(el);
  if (c) {
    await page.mouse.move(c.x, c.y, { steps: opts.steps ?? 18 });
    await sleep(page, opts.settle ?? 220);
    await page.mouse.down();
    await sleep(page, 60);
    await page.mouse.up();
  } else {
    await el.click();
  }
};

export const moveHover = async (
  page: Page,
  target: string | Locator,
  opts: { steps?: number; settle?: number } = {},
): Promise<void> => {
  const el = typeof target === 'string' ? page.locator(target) : target;
  const c = await centerOf(el);
  if (c) {
    await page.mouse.move(c.x, c.y, { steps: opts.steps ?? 16 });
    await sleep(page, opts.settle ?? 200);
  } else {
    await el.hover().catch(() => {});
  }
};

export const moveTo = async (page: Page, x: number, y: number, steps = 16): Promise<void> => {
  await page.mouse.move(x, y, { steps });
};
