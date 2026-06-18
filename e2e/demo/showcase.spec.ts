/**
 * RetroGroove lifecycle showcase — paced, silent, cursor+spotlight.
 *
 * Hero flow (one run, one mp4):
 *   Home → Disco Night event (F1 detail) → seat selection + combo (F2) →
 *   checkout "Pagar con Culqi" (F3) → success (F4) → ticket QR (F5) →
 *   admin login + event builder canvas/tarifas (B5) →
 *   door check-in: VÁLIDA → YA USADA (B6).
 */
import { test, expect } from '@playwright/test';
import { humanType, moveClick, moveHover, moveTo, CURSOR_OVERLAY_SCRIPT } from './support/showcase.js';
import fs from 'node:fs';
import path from 'node:path';
import type { Page } from '@playwright/test';

test.setTimeout(1_800_000);

// Inject Culqi stub + cursor overlay on every page load
test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    (window as unknown as { __CULQI_TEST_TOKEN__?: string }).__CULQI_TEST_TOKEN__ = 'tkn_demo';
  });
  await page.addInitScript(CURSOR_OVERLAY_SCRIPT);
});

const B = Number(process.env.SHOWCASE_BEAT) || 0.9;
const pause = (page: Page, ms: number) => page.waitForTimeout(Math.round(ms * B));
const see   = (page: Page) => pause(page, 1300);
const think = (page: Page) => pause(page, 600);
const after = (page: Page) => pause(page, 800);

const ADMIN = { email: 'admin@retrogroove.pe', password: 'DemoShow2026!' };
const BASE  = process.env.BASE_URL || 'http://localhost:3340';

// Timeline helper (marks for reference, no voice needed)
const mkTimeline = () => {
  const T0 = Date.now();
  const marks: { name: string; t: number }[] = [];
  const mark = (name: string) => {
    console.log(`[MARK] ${name} at ${((Date.now() - T0) / 1000).toFixed(1)}s`);
    marks.push({ name, t: (Date.now() - T0) / 1000 });
  };
  const flush = () => {
    const dir = path.resolve(process.cwd(), 'recordings');
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(
      path.join(dir, 'master-timeline.json'),
      JSON.stringify([...marks, { name: 'end', t: (Date.now() - T0) / 1000 }], null, 2),
    );
  };
  return { mark, flush };
};

// Admin login helper
async function ensureAdmin(page: Page) {
  // Wait for the page to hydrate first — check for either the login form or the target page.
  const btn = page.getByRole('button', { name: 'Entrar' });
  const builderTitle = page.getByTestId('builder-title');
  const checkinTitle = page.getByTestId('checkin-title');

  const firstVisible = await Promise.race([
    btn.waitFor({ state: 'visible', timeout: 10000 }).then(() => 'login' as const),
    builderTitle.waitFor({ state: 'visible', timeout: 10000 }).then(() => 'builder' as const),
    checkinTitle.waitFor({ state: 'visible', timeout: 10000 }).then(() => 'checkin' as const),
  ]).catch(() => 'timeout' as const);

  if (firstVisible !== 'login') {
    console.log(`[ensureAdmin] already authenticated (${firstVisible})`);
    return;
  }
  console.log('[ensureAdmin] logging in');
  await moveClick(page, page.locator('#admin-email'));
  await humanType(page, page.locator('#admin-email'), ADMIN.email);
  await think(page);
  await moveClick(page, page.locator('#admin-password'));
  await humanType(page, page.locator('#admin-password'), ADMIN.password);
  await think(page);
  await moveClick(page, btn);
  // Wait for button to disappear (successful login)
  await btn.waitFor({ state: 'hidden', timeout: 10000 });
  await see(page);
  console.log('[ensureAdmin] login done');
}

// ── Main showcase ─────────────────────────────────────────────────────────────
test('RetroGroove lifecycle showcase', async ({ page }: { page: Page }) => {
  const { mark, flush } = mkTimeline();

  // ── HOME ─────────────────────────────────────────────────────────────────────
  mark('home');
  console.log('[F0] Home');
  await page.goto(`${BASE}/`, { waitUntil: 'networkidle', timeout: 30000 });
  await expect(page.getByTestId('event-card').first()).toBeVisible({ timeout: 20000 });
  await see(page);
  await page.mouse.wheel(0, 400);
  await think(page);
  await page.mouse.wheel(0, 400);
  await see(page);
  const discoCard = page.getByTestId('event-card').filter({ hasText: 'Basílica' });
  const discoVisible = await discoCard.isVisible({ timeout: 5000 }).catch(() => false);
  if (discoVisible) {
    await moveHover(page, discoCard);
    await see(page);
  }

  // ── F1: EVENT DETAIL ─────────────────────────────────────────────────────────
  mark('event-detail');
  console.log('[F1] Event detail');
  // Navigate directly to the event page
  await page.goto(`${BASE}/evento?slug=retrogroove-disco-night`, { waitUntil: 'networkidle', timeout: 30000 });
  await expect(page.locator('h1, h2').first()).toBeVisible({ timeout: 20000 });
  await see(page);
  await page.mouse.wheel(0, 350);
  await think(page);
  await page.mouse.wheel(0, 350);
  await see(page);
  const ctaBtn = page.getByRole('button', { name: /comprar entradas/i });
  await moveHover(page, ctaBtn);
  await see(page);

  // ── F2: SEAT SELECTION ───────────────────────────────────────────────────────
  mark('seat-selection');
  console.log('[F2] Seat selection');
  await moveClick(page, ctaBtn);
  await expect(page.getByTestId('seat-map')).toBeVisible({ timeout: 20000 });
  await see(page);
  if (await page.getByTestId('buyer-stage').isVisible({ timeout: 2000 }).catch(() => false)) {
    await moveHover(page, page.getByTestId('buyer-stage'));
    await think(page);
  }

  // Pick two available seats (different indices to avoid deselecting)
  const available = page.locator('[data-status="available"]');
  await expect(available.first()).toBeVisible({ timeout: 10000 });
  const seatCount = await available.count();
  console.log(`[F2] available seats: ${seatCount}`);
  await moveHover(page, available.nth(0));
  await think(page);
  await moveClick(page, available.nth(0));
  await after(page);
  await moveHover(page, available.nth(1));
  await think(page);
  await moveClick(page, available.nth(1));
  await see(page);

  // Show selection panel and combo discount
  await page.mouse.wheel(0, 300);
  await see(page);
  const totalValue = page.getByTestId('order-total-value');
  const tvVisible = await totalValue.isVisible({ timeout: 3000 }).catch(() => false);
  if (tvVisible) {
    await moveHover(page, totalValue);
    await see(page);
  }

  // Click IR A PAGAR
  const irAPagarBtn = page.getByRole('button', { name: /ir a pagar/i });
  const isDisabled = await irAPagarBtn.isDisabled().catch(() => true);
  console.log(`[F2] IR A PAGAR disabled: ${isDisabled}`);
  await moveHover(page, irAPagarBtn);
  await think(page);
  await moveClick(page, irAPagarBtn);

  // ── F3: CHECKOUT ─────────────────────────────────────────────────────────────
  mark('checkout');
  console.log('[F3] Checkout');
  await expect(page.getByTestId('order-total')).toBeVisible({ timeout: 20000 });
  await see(page);
  const pagarBtn = page.getByRole('button', { name: /pagar con culqi/i });
  await moveHover(page, pagarBtn);
  await see(page);
  await moveClick(page, pagarBtn);

  // ── F4: SUCCESS ──────────────────────────────────────────────────────────────
  mark('success');
  console.log('[F4] Success');
  // Wait for ticket links (they appear only after confirmed purchase)
  const firstTicketLink = page.getByTestId('ticket-link').first();
  await expect(firstTicketLink).toBeVisible({ timeout: 30000 });
  await see(page);
  await page.mouse.wheel(0, 200);
  await see(page);
  await moveHover(page, firstTicketLink);
  await see(page);
  const ticketHref = await firstTicketLink.getAttribute('href', { timeout: 10000 });
  const token = ticketHref?.split('token=')[1]?.trim() ?? '';
  console.log(`[F4] token: ${token.slice(0, 8)}... (href=${ticketHref})`);

  // ── F5: TICKET VIEW ──────────────────────────────────────────────────────────
  mark('ticket-view');
  console.log('[F5] Ticket view');
  if (token) {
    await page.goto(`${BASE}/t?token=${token}`, { waitUntil: 'networkidle', timeout: 30000 });
    await expect(page.getByTestId('ticket-status')).toBeVisible({ timeout: 20000 });
    await see(page);
    if (await page.getByTestId('ticket-qr').isVisible({ timeout: 2000 }).catch(() => false)) {
      await moveHover(page, page.getByTestId('ticket-qr'));
      await see(page);
    }
    if (await page.getByTestId('ticket-token').isVisible({ timeout: 2000 }).catch(() => false)) {
      await moveHover(page, page.getByTestId('ticket-token'));
      await see(page);
    }
    const pdfLink = page.getByTestId('pdf-link');
    if (await pdfLink.isVisible({ timeout: 2000 }).catch(() => false)) {
      await moveHover(page, pdfLink);
      await see(page);
    }
    await page.mouse.wheel(0, 200);
    await see(page);
  } else {
    console.log('[F5] SKIP — no token');
  }

  // ── B5: ADMIN — EVENT BUILDER ────────────────────────────────────────────────
  mark('admin-builder');
  console.log('[B5] Admin builder');
  await page.goto(`${BASE}/band/tickets/nuevo`, { waitUntil: 'networkidle', timeout: 20000 });
  await ensureAdmin(page);
  await expect(page.getByTestId('builder-title')).toBeVisible({ timeout: 20000 });
  await see(page);

  // Type event name to show the full builder
  const nameInput = page.getByTestId('input-event-name');
  await moveClick(page, nameInput);
  await humanType(page, nameInput, 'Demo Night');
  await think(page);

  // Show the canvas with stage
  const canvasStage = page.getByTestId('canvas-stage');
  if (await canvasStage.isVisible({ timeout: 3000 }).catch(() => false)) {
    await moveHover(page, canvasStage);
    await see(page);
  }

  // Click on canvas to place a table
  const canvas = page.getByTestId('canvas-area');
  const cBox = await canvas.boundingBox().catch(() => null);
  if (cBox) {
    const cx = cBox.x + cBox.width * 0.45;
    const cy = cBox.y + cBox.height * 0.55;
    await page.mouse.move(cx, cy, { steps: 18 });
    await think(page);
    await page.mouse.down();
    await page.mouse.up();
    await after(page);
  }

  // Show tarifa editor
  const tarifaRow = page.getByTestId('tarifa-row').first();
  if (await tarifaRow.isVisible({ timeout: 3000 }).catch(() => false)) {
    await moveHover(page, tarifaRow);
    await see(page);
    const priceInput = page.getByTestId('tarifa-price').first();
    if (await priceInput.isVisible({ timeout: 2000 }).catch(() => false)) {
      await moveClick(page, priceInput);
      await humanType(page, priceInput, '40');
      await think(page);
    }
  }

  // Hover section tab
  const sectionTab = page.getByTestId('section-tab').first();
  if (await sectionTab.isVisible({ timeout: 2000 }).catch(() => false)) {
    await moveHover(page, sectionTab);
    await see(page);
  }

  // ── B6: DOOR CHECK-IN ───────────────────────────────────────────────────────
  mark('check-in');
  console.log('[B6] Check-in');
  await page.goto(`${BASE}/band/tickets/check-in`, { waitUntil: 'networkidle', timeout: 20000 });
  await ensureAdmin(page);
  await expect(page.getByTestId('checkin-title')).toBeVisible({ timeout: 15000 });
  await see(page);

  // Type token and verify
  const tokenInput = page.getByTestId('token-input');
  await moveClick(page, tokenInput);
  await humanType(page, tokenInput, token);
  await think(page);
  await moveClick(page, page.getByTestId('btn-validar'));

  await expect(page.getByTestId('result-panel')).toBeVisible({ timeout: 15000 });
  await expect(page.getByTestId('result-panel')).toContainText('VÁLIDA');
  await see(page);

  // Register entry
  await moveClick(page, page.getByTestId('btn-registrar'));
  await expect(page.getByTestId('result-panel')).toContainText('ENTRADA REGISTRADA', { timeout: 10000 });
  await see(page);

  // ── B6: DOUBLE SCAN → YA USADA ───────────────────────────────────────────────
  mark('check-in-double');
  console.log('[B6] Double scan');
  const siguienteBtn = page.getByTestId('btn-siguiente');
  if (await siguienteBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
    await moveClick(page, siguienteBtn);
    await think(page);
  } else {
    // Clear input manually if siguiente button not found
    await tokenInput.clear();
    await think(page);
  }

  await moveClick(page, tokenInput);
  await humanType(page, tokenInput, token);
  await think(page);
  await moveClick(page, page.getByTestId('btn-validar'));
  await expect(page.getByTestId('result-panel')).toBeVisible({ timeout: 15000 });
  await expect(page.getByTestId('result-panel')).toContainText(/ya usada/i);
  await see(page);

  // Final linger
  mark('end');
  await moveTo(page, 960, 540, 8);
  await pause(page, 1600);

  flush();
  console.log('[DONE] Showcase complete');
});
