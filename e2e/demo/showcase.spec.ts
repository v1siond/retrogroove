/**
 * RetroGroove lifecycle showcase v2 — 3-act tutorial.
 *
 * Act 1 — Admin builds the Basilica event from scratch via the builder UI
 * Act 2 — Client buys 2 seats (sees combo price S/70)
 * Act 3 — Admin validates QR (VÁLIDA → YA USADA)
 *
 * State shared within the test: slug captured after publish, token after purchase.
 * DB is pre-reset and admin-only seeded by run-showcase.sh before this spec runs.
 */
import { test, expect } from '@playwright/test';
import { humanType, moveClick, moveHover, moveTo, CURSOR_OVERLAY_SCRIPT } from './support/showcase.js';
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

const ADMIN = {
  email:    process.env.DEMO_ADMIN_EMAIL    || 'admin@retrogroove.pe',
  password: process.env.DEMO_ADMIN_PASSWORD || 'demo1234',
};
const BASE = process.env.BASE_URL || 'http://localhost:3340';

// ── Admin login helper ────────────────────────────────────────────────────────
async function ensureAdmin(page: Page) {
  const btn          = page.getByRole('button', { name: 'Entrar' });
  const builderTitle = page.getByTestId('builder-title');
  const checkinTitle = page.getByTestId('checkin-title');

  const firstVisible = await Promise.race([
    btn.waitFor({ state: 'visible', timeout: 12000 }).then(() => 'login' as const),
    builderTitle.waitFor({ state: 'visible', timeout: 12000 }).then(() => 'builder' as const),
    checkinTitle.waitFor({ state: 'visible', timeout: 12000 }).then(() => 'checkin' as const),
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
  await btn.waitFor({ state: 'hidden', timeout: 15000 });
  await see(page);
  console.log('[ensureAdmin] login done');
}

// ── Get the actual drawing canvas (the div with cursor:crosshair inside canvas-area) ──
async function getCanvasDiv(page: Page) {
  // The canvas div is inside canvas-area, after the canvasBar and stage-readout divs.
  // When a tool is active it has cursor:crosshair in its inline style.
  // Use stage-readout as anchor: the canvas is the next sibling.
  const byStyle  = page.locator('[data-testid="canvas-area"] [style*="crosshair"]');
  const hasIt = await byStyle.first().isVisible({ timeout: 3000 }).catch(() => false);
  if (hasIt) return byStyle.first();
  // Fallback: third child div of canvas-area (after canvasBar div and stage-readout div)
  return page.locator('[data-testid="stage-readout"] + div');
}

// ── Canvas table placement helper ────────────────────────────────────────────
async function placeTable(
  page: Page,
  _canvasArea: ReturnType<Page['getByTestId']>,
  xPct: number,
  yPct: number,
  seatAdjust: number,   // +N = click + that many times, -N = click - that many times
) {
  const canvas = await getCanvasDiv(page);
  const box = await canvas.boundingBox();
  if (!box) {
    console.log('[placeTable] canvas div not found');
    return;
  }

  const cx = box.x + box.width  * xPct;
  const cy = box.y + box.height * yPct;

  // Move slowly so it's visible, then click to place
  await page.mouse.move(cx, cy, { steps: 20 });
  await think(page);
  await page.mouse.click(cx, cy);
  await after(page);

  // Wait for the props popover to appear
  const propsBox = page.getByTestId('table-props');
  const appeared = await propsBox.waitFor({ state: 'visible', timeout: 5000 }).then(() => true).catch(() => false);

  if (!appeared) {
    console.log(`[placeTable] props popover did not appear at (${xPct},${yPct})`);
    return;
  }

  // Adjust seat count (default = 4)
  const seatCount = page.getByTestId('seat-count');
  if (seatAdjust < 0) {
    // Click the minus button (text is − not -)
    const minusBtn = seatCount.locator('button').first();
    for (let i = 0; i < Math.abs(seatAdjust); i++) {
      await moveClick(page, minusBtn);
      await page.waitForTimeout(140);
    }
  } else if (seatAdjust > 0) {
    // Click the plus button
    const plusBtn = seatCount.locator('button').last();
    for (let i = 0; i < seatAdjust; i++) {
      await moveClick(page, plusBtn);
      await page.waitForTimeout(140);
    }
  }
  await think(page);

  // Click somewhere on the page header (safe deselect area that won't place another table)
  const builderTitle = page.getByTestId('builder-title');
  const titleBox = await builderTitle.boundingBox().catch(() => null);
  if (titleBox) {
    await page.mouse.move(titleBox.x + 10, titleBox.y + titleBox.height / 2, { steps: 8 });
    await page.mouse.click(titleBox.x + 10, titleBox.y + titleBox.height / 2);
  }
  await think(page);
}

// ── Main showcase ─────────────────────────────────────────────────────────────
test('RetroGroove lifecycle showcase v2', async ({ page }: { page: Page }) => {

  // ────────────────────────────────────────────────────────────────────────────
  // ACT 1: Admin builds the Basilica event
  // ────────────────────────────────────────────────────────────────────────────
  console.log('[ACT 1] Admin builds the Basilica event');

  await page.goto(`${BASE}/band/tickets/nuevo`, { waitUntil: 'networkidle', timeout: 30000 });
  await ensureAdmin(page);
  await expect(page.getByTestId('builder-title')).toBeVisible({ timeout: 15000 });
  await see(page);

  // ── Event details ──
  console.log('[ACT1] Filling event details');
  const nameInput = page.getByTestId('input-event-name');
  await moveClick(page, nameInput);
  await humanType(page, nameInput, 'Retrogroove · Disco Night');
  await think(page);

  const dateInput = page.getByTestId('input-date');
  await moveClick(page, dateInput);
  await dateInput.fill('2026-08-15T21:00');
  await think(page);

  const venueInput = page.getByTestId('input-venue-name');
  await moveClick(page, venueInput);
  await humanType(page, venueInput, 'La Basílica 640');
  await think(page);

  const addrInput = page.getByTestId('input-venue-address');
  await moveClick(page, addrInput);
  await humanType(page, addrInput, 'Jr. Basílica 640, Barranco');
  await think(page);

  const descInput = page.getByTestId('input-description');
  await moveClick(page, descInput);
  await humanType(page, descInput, 'Una noche de disco puro en el corazón de Barranco.');
  await think(page);

  // ── Stage geometry ──
  console.log('[ACT1] Setting stage geometry');
  const stageXInput = page.getByTestId('input-stage-x');
  await moveClick(page, stageXInput);
  await stageXInput.fill('360');
  await after(page);

  const stageYInput = page.getByTestId('input-stage-y');
  await moveClick(page, stageYInput);
  await stageYInput.fill('40');
  await after(page);

  const stageWInput = page.getByTestId('input-stage-w');
  await moveClick(page, stageWInput);
  await stageWInput.fill('280');
  await after(page);

  const stageHInput = page.getByTestId('input-stage-h');
  await moveClick(page, stageHInput);
  await stageHInput.fill('70');
  await after(page);

  // ── Rename section to "Mesas" ──
  const sectionNameInput = page.getByTestId('input-section-name');
  await moveClick(page, sectionNameInput);
  await sectionNameInput.fill('');
  await humanType(page, sectionNameInput, 'Mesas');
  await think(page);

  // ── Set tarifa prices: S/40 single, S/70 combo ──
  console.log('[ACT1] Setting tarifa prices');
  const tarifaInputs = page.getByTestId('tarifa-price');
  await tarifaInputs.nth(0).scrollIntoViewIfNeeded();
  await moveClick(page, tarifaInputs.nth(0));
  await tarifaInputs.nth(0).fill('');
  await humanType(page, tarifaInputs.nth(0), '40');
  await think(page);

  await moveClick(page, tarifaInputs.nth(1));
  await tarifaInputs.nth(1).fill('');
  await humanType(page, tarifaInputs.nth(1), '70');
  await think(page);

  // ── Activate round-table tool ──
  console.log('[ACT1] Activating round-table tool');
  const roundTableTool = page.getByTestId('tool-round-table');
  await moveClick(page, roundTableTool);
  await see(page);

  // ── Canvas: place couple tables (2 seats = default 4 − 2) ──
  // The round-table tool stays active until toggled off — no need to re-activate.
  console.log('[ACT1] Placing couple tables (2 seats each)');
  const canvasArea = page.getByTestId('canvas-area');

  // Place table 1 — show it clearly (seat adjustment: -2 → 4-2=2)
  await placeTable(page, canvasArea, 0.20, 0.58, -2);
  await see(page);

  // Place table 2
  await placeTable(page, canvasArea, 0.35, 0.78, -2);
  await think(page);

  // Place table 3
  await placeTable(page, canvasArea, 0.50, 0.60, -2);
  await think(page);

  // ── Switch to large tables (7 seats = 4+3) ──
  console.log('[ACT1] Placing large tables (7 seats each)');

  // Large table 1 — show clearly
  await placeTable(page, canvasArea, 0.22, 0.38, 3);
  await see(page);

  await placeTable(page, canvasArea, 0.42, 0.40, 3);
  await think(page);

  await placeTable(page, canvasArea, 0.62, 0.58, 3);
  await think(page);

  // Show the canvas with all tables placed
  const canvasStage = page.getByTestId('canvas-stage');
  if (await canvasStage.isVisible({ timeout: 2000 }).catch(() => false)) {
    await moveHover(page, canvasStage);
    await see(page);
  }

  // Verify we have tables before publishing
  const tableCount = await page.getByTestId('canvas-table').count();
  console.log(`[ACT1] Tables placed: ${tableCount}`);

  // ── CREAR Y PUBLICAR ──
  console.log('[ACT1] Publishing event');
  const publishBtn = page.getByTestId('btn-publish');
  await publishBtn.scrollIntoViewIfNeeded();
  await moveHover(page, publishBtn);
  await see(page);
  await moveClick(page, publishBtn);

  // Wait for success page with public-link
  const publicLink = page.getByTestId('public-link');
  await expect(publicLink).toBeVisible({ timeout: 30000 });
  await see(page);

  // Capture the slug
  const href = await publicLink.getAttribute('href');
  const slug = href?.split('slug=')[1]?.trim() ?? 'retrogroove-disco-night';
  console.log(`[ACT1] Event published! slug=${slug}`);
  await moveHover(page, publicLink);
  await see(page);

  // ────────────────────────────────────────────────────────────────────────────
  // ACT 2: Client buys 2 seats
  // ────────────────────────────────────────────────────────────────────────────
  console.log('[ACT 2] Client buys 2 seats');

  // ── Home page — find the Basilica card ──
  await page.goto(`${BASE}/`, { waitUntil: 'networkidle', timeout: 30000 });
  await expect(page.getByTestId('event-card').first()).toBeVisible({ timeout: 20000 });
  await see(page);
  await page.mouse.wheel(0, 300);
  await think(page);

  // Find the newly created event card
  const discoCard = page.getByTestId('event-card').filter({ hasText: /Disco Night/i });
  const cardVisible = await discoCard.first().isVisible({ timeout: 5000 }).catch(() => false);
  if (cardVisible) {
    await moveHover(page, discoCard.first());
    await see(page);
  }

  // ── Navigate to event detail ──
  console.log('[ACT2] Navigating to event detail');
  await page.goto(`${BASE}/evento?slug=${slug}`, { waitUntil: 'networkidle', timeout: 30000 });
  await expect(page.locator('h1, h2').first()).toBeVisible({ timeout: 20000 });
  await see(page);

  // Scroll to show content
  await page.mouse.wheel(0, 300);
  await think(page);
  await page.mouse.wheel(0, 300);
  await see(page);

  // Show the "Comprar entradas" CTA
  const ctaBtn = page.getByRole('button', { name: /comprar entradas/i });
  const ctaLink = page.getByRole('link', { name: /comprar entradas/i });
  const cta = (await ctaBtn.isVisible({ timeout: 3000 }).catch(() => false)) ? ctaBtn : ctaLink;
  await moveHover(page, cta);
  await see(page);

  // ── Seat map ──
  console.log('[ACT2] Opening seat map');
  await moveClick(page, cta);
  await expect(page.getByTestId('seat-map')).toBeVisible({ timeout: 20000 });
  await see(page);

  // Show the stage if visible
  const buyerStage = page.getByTestId('buyer-stage');
  if (await buyerStage.isVisible({ timeout: 2000 }).catch(() => false)) {
    await moveHover(page, buyerStage);
    await think(page);
  }

  // Pick 2 available seats (select from same table for combo)
  const available = page.locator('[data-status="available"]');
  await expect(available.first()).toBeVisible({ timeout: 15000 });
  const seatCount = await available.count();
  console.log(`[ACT2] Available seats: ${seatCount}`);

  await moveHover(page, available.nth(0));
  await think(page);
  await moveClick(page, available.nth(0));
  await after(page);

  await moveHover(page, available.nth(1));
  await think(page);
  await moveClick(page, available.nth(1));
  await see(page);

  // Show order panel and combo price
  await page.mouse.wheel(0, 300);
  await see(page);

  const totalValue = page.getByTestId('order-total-value');
  if (await totalValue.isVisible({ timeout: 3000 }).catch(() => false)) {
    await moveHover(page, totalValue);
    const totalText = await totalValue.textContent();
    console.log(`[ACT2] Order total: ${totalText}`);
    await see(page);
  }

  // ── Ir a pagar ──
  const irAPagarBtn = page.getByRole('button', { name: /ir a pagar/i });
  await moveHover(page, irAPagarBtn);
  await think(page);
  await moveClick(page, irAPagarBtn);

  // ── Checkout page ──
  console.log('[ACT2] Checkout');
  await expect(page.getByTestId('order-total')).toBeVisible({ timeout: 20000 });
  await see(page);

  const pagarBtn = page.getByRole('button', { name: /pagar con culqi/i });
  await moveHover(page, pagarBtn);
  await see(page);
  await moveClick(page, pagarBtn);

  // ── Purchase success ──
  console.log('[ACT2] Success page');
  const firstTicketLink = page.getByTestId('ticket-link').first();
  await expect(firstTicketLink).toBeVisible({ timeout: 30000 });
  await see(page);
  await page.mouse.wheel(0, 200);
  await see(page);
  await moveHover(page, firstTicketLink);
  await see(page);

  const ticketHref = await firstTicketLink.getAttribute('href', { timeout: 10000 });
  const token = ticketHref?.split('token=')[1]?.trim() ?? '';
  console.log(`[ACT2] Token: ${token.slice(0, 8)}...`);

  // ── Ticket view / QR ──
  console.log('[ACT2] Ticket QR view');
  if (token) {
    await page.goto(`${BASE}/t?token=${token}`, { waitUntil: 'networkidle', timeout: 30000 });
    await expect(page.getByTestId('ticket-status')).toBeVisible({ timeout: 20000 });
    await see(page);

    const ticketQr = page.getByTestId('ticket-qr');
    if (await ticketQr.isVisible({ timeout: 3000 }).catch(() => false)) {
      await moveHover(page, ticketQr);
      await see(page);
    }

    const ticketToken = page.getByTestId('ticket-token');
    if (await ticketToken.isVisible({ timeout: 2000 }).catch(() => false)) {
      await moveHover(page, ticketToken);
      await see(page);
    }

    await page.mouse.wheel(0, 200);
    await see(page);
  } else {
    console.log('[ACT2] SKIP ticket view — no token');
  }

  // ────────────────────────────────────────────────────────────────────────────
  // ACT 3: Admin validates at the door
  // ────────────────────────────────────────────────────────────────────────────
  console.log('[ACT 3] Admin validates at the door');

  await page.goto(`${BASE}/band/tickets/check-in`, { waitUntil: 'networkidle', timeout: 20000 });
  await ensureAdmin(page);
  await expect(page.getByTestId('checkin-title')).toBeVisible({ timeout: 15000 });
  await see(page);

  // Type token
  const tokenInput = page.getByTestId('token-input');
  await moveClick(page, tokenInput);
  await humanType(page, tokenInput, token);
  await think(page);

  // Validate
  await moveClick(page, page.getByTestId('btn-validar'));
  const resultPanel = page.getByTestId('result-panel');
  await expect(resultPanel).toBeVisible({ timeout: 15000 });
  await expect(resultPanel).toContainText('VÁLIDA');
  await see(page);

  // Register entry
  await moveClick(page, page.getByTestId('btn-registrar'));
  await expect(resultPanel).toContainText('ENTRADA REGISTRADA', { timeout: 10000 });
  await see(page);

  // ── Double scan → YA USADA ──
  console.log('[ACT3] Double scan → YA USADA');

  // Clear or click siguiente
  const siguienteBtn = page.getByTestId('btn-siguiente');
  if (await siguienteBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
    await moveClick(page, siguienteBtn);
    await think(page);
  } else {
    await tokenInput.clear();
    await think(page);
  }

  await moveClick(page, tokenInput);
  await humanType(page, tokenInput, token);
  await think(page);
  await moveClick(page, page.getByTestId('btn-validar'));

  await expect(resultPanel).toBeVisible({ timeout: 15000 });
  await expect(resultPanel).toContainText(/ya usada/i);
  await see(page);

  // Final linger
  await moveTo(page, 960, 540, 8);
  await pause(page, 1800);

  console.log('[DONE] Showcase v2 complete');
});
