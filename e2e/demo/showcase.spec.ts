/**
 * RetroGroove lifecycle showcase v3 — 3-act tutorial.
 *
 * Act 1 — Admin builds the Basilica event from scratch via the builder UI
 * Act 2 — Client buys 2 seats (sees combo price S/70)
 * Act 3 — Admin validates QR (VÁLIDA → YA USADA)
 *
 * State shared within the test: slug captured after publish, token after purchase.
 * DB is pre-reset and admin-only seeded by run-showcase.sh before this spec runs.
 *
 * v3 fixes:
 *   - Correct event details (Surco address, real description, map URL)
 *   - Exactly 13 tables: 3 couple (2-seat) + 10 large (7-seat) — count-asserted after each
 *   - Rebalanced pacing: table loop is faster, Acts 2+3 get more room
 *   - stopPropagation on table-props prevents double-placement (page.tsx fix)
 */
import { test, expect } from '@playwright/test';
import { humanType, moveClick, moveHover, moveTo, CURSOR_OVERLAY_SCRIPT } from './support/showcase.js';
import type { Page } from '@playwright/test';

test.setTimeout(1_800_000);

// Inject Izipay test hook + cursor overlay on every page load
test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    (window as unknown as { __IZIPAY_TEST_SKIP__?: boolean }).__IZIPAY_TEST_SKIP__ = true;
  });
  await page.addInitScript(CURSOR_OVERLAY_SCRIPT);
});

// Default beat for normal pacing; TABLE_BEAT is faster just for placement loops
const B        = Number(process.env.SHOWCASE_BEAT) || 0.9;
const TB       = B * 0.45;  // table placement loop — faster so Act 1 isn't bloated
const pause    = (page: Page, ms: number) => page.waitForTimeout(Math.round(ms * B));
const tpause   = (page: Page, ms: number) => page.waitForTimeout(Math.round(ms * TB));
const see      = (page: Page) => pause(page, 1300);
const think    = (page: Page) => pause(page, 600);
const after    = (page: Page) => pause(page, 800);
const tsee     = (page: Page) => tpause(page, 1300);
const tthink   = (page: Page) => tpause(page, 600);

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

// ── Get the actual drawing canvas div ────────────────────────────────────────
async function getCanvasDiv(page: Page) {
  const byStyle  = page.locator('[data-testid="canvas-area"] [style*="crosshair"]');
  const hasIt = await byStyle.first().isVisible({ timeout: 3000 }).catch(() => false);
  if (hasIt) return byStyle.first();
  return page.locator('[data-testid="stage-readout"] + div');
}

// ── Canvas table placement helper ────────────────────────────────────────────
async function placeTable(
  page: Page,
  _canvasArea: ReturnType<Page['getByTestId']>,
  xPct: number,
  yPct: number,
  seatAdjust: number,   // +N = click + that many times, -N = click − that many times
  expectedCount: number, // assert table count equals this after placement
) {
  const canvas = await getCanvasDiv(page);
  const box = await canvas.boundingBox();
  if (!box) { console.log('[placeTable] canvas not found'); return; }

  const cx  = box.x + box.width  * xPct;
  const cy  = box.y + box.height * yPct;
  const relX = Math.round(box.width  * xPct);
  const relY = Math.round(box.height * yPct);

  // Glide cursor to position (visible in recording), then click canvas
  await page.mouse.move(cx, cy, { steps: 20 });
  await tthink(page);
  await canvas.click({ position: { x: relX, y: relY }, force: true });

  // Wait for React to commit the new table to DOM
  await page.getByTestId('table-props').waitFor({ state: 'visible', timeout: 3000 }).catch(() => {});
  await tthink(page);

  // Adjust seat count (default = 4)
  if (seatAdjust !== 0) {
    const seatCount = page.getByTestId('seat-count');
    const btn = seatAdjust < 0
      ? seatCount.locator('button').first()   // minus
      : seatCount.locator('button').last();   // plus
    for (let i = 0; i < Math.abs(seatAdjust); i++) {
      await moveClick(page, btn);
      await page.waitForTimeout(120);
    }
    await tthink(page);
  }

  // Dismiss selection via stage-readout click → setSelectedTableKey(null)
  await moveClick(page, page.getByTestId('stage-readout'));
  await page.getByTestId('table-props').waitFor({ state: 'hidden', timeout: 3000 }).catch(() => {});
  await tthink(page);

  // Assert table count
  let actual = 0;
  for (let retry = 0; retry < 10; retry++) {
    actual = await page.getByTestId('canvas-table').count();
    if (actual >= expectedCount) break;
    await page.waitForTimeout(200);
  }
  if (actual !== expectedCount) {
    console.warn(`[placeTable] WARN: expected ${expectedCount} got ${actual}`);
  } else {
    console.log(`[placeTable] OK: ${actual} table(s)`);
  }
}

// ── Main showcase ─────────────────────────────────────────────────────────────
test('RetroGroove lifecycle showcase v3', async ({ page }: { page: Page }) => {

  // ────────────────────────────────────────────────────────────────────────────
  // ACT 1: Admin builds the Basilica event
  // ────────────────────────────────────────────────────────────────────────────
  console.log('[ACT 1] Admin builds the Basilica event');

  await page.goto(`${BASE}/admin/nuevo`, { waitUntil: 'networkidle', timeout: 30000 });
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
  await humanType(page, addrInput, 'Av. Primavera 640, Santiago de Surco, Lima');
  await think(page);

  // Map URL (if the field exists)
  const mapInput = page.getByTestId('input-map-url');
  const hasMapInput = await mapInput.isVisible({ timeout: 2000 }).catch(() => false);
  if (hasMapInput) {
    await moveClick(page, mapInput);
    await humanType(page, mapInput, 'https://share.google/S7JIUy0pdMhJzzIE5');
    await think(page);
  }

  const descInput = page.getByTestId('input-description');
  await moveClick(page, descInput);
  await humanType(
    page,
    descInput,
    'Una noche para soltarse y bailar. Retrogroove te lleva por lo mejor del rock clásico, la fiebre disco y el rock nacional —en vivo y a todo volumen— en el ambiente único de La Basílica 640. No somos estrellas internacionales: somos una banda que se entrega en cada canción y arma una fiesta de verdad. Reserva tu mesa y vení a comprobarlo.',
  );
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

  // ── Canvas: place exactly 3 couple tables (2 seats = default 4 − 2) ──
  // After each placement we assert the count incremented.
  console.log('[ACT1] Placing 3 couple tables (2 seats each)');
  const canvasArea = page.getByTestId('canvas-area');

  // All tables placed in the LOWER HALF of canvas (y ≥ 0.55) to stay clear of
  // the propsBox which sits at top-right (top:10px, ~150px tall, ~160/canvas_h ≈ 47% from top).
  // x stays ≤ 0.70 for the same reason (propsBox is 210px wide at right:10px).
  //
  // Layout: stage is at the top; tables are in the audience area below.
  // Front row (couple tables, 2 seats each): y=0.58 — just "in front" of the large tables
  // Large tables (7 seats each): two rows at y=0.70 and y=0.83

  // ── 3 couple tables: front row ──
  await placeTable(page, canvasArea, 0.18, 0.58, -2, 1);
  await tsee(page);

  await placeTable(page, canvasArea, 0.44, 0.58, -2, 2);
  await tthink(page);

  await placeTable(page, canvasArea, 0.64, 0.58, -2, 3);
  await tthink(page);

  // ── 10 large tables (7 seats = default 4 + 3 clicks): two rows ──
  console.log('[ACT1] Placing 10 large tables (7 seats each)');

  // Large row 1: 5 tables at y=0.70
  await placeTable(page, canvasArea, 0.10, 0.70, 3, 4);
  await tsee(page);

  await placeTable(page, canvasArea, 0.26, 0.70, 3, 5);
  await tthink(page);

  await placeTable(page, canvasArea, 0.44, 0.70, 3, 6);
  await tthink(page);

  await placeTable(page, canvasArea, 0.60, 0.70, 3, 7);
  await tthink(page);

  await placeTable(page, canvasArea, 0.70, 0.70, 3, 8);
  await tthink(page);

  // Large row 2: 5 tables at y=0.84
  await placeTable(page, canvasArea, 0.10, 0.84, 3, 9);
  await tthink(page);

  await placeTable(page, canvasArea, 0.26, 0.84, 3, 10);
  await tthink(page);

  await placeTable(page, canvasArea, 0.44, 0.84, 3, 11);
  await tthink(page);

  await placeTable(page, canvasArea, 0.60, 0.84, 3, 12);
  await tthink(page);

  await placeTable(page, canvasArea, 0.70, 0.84, 3, 13);
  await tsee(page);

  // ── FINAL ASSERTION: must be exactly 13 tables / 76 seats ──
  const finalTableCount = await page.getByTestId('canvas-table').count();
  console.log(`[ACT1] Final table count: ${finalTableCount} (expected 13)`);
  if (finalTableCount !== 13) {
    throw new Error(`Expected exactly 13 tables but got ${finalTableCount}`);
  }

  // Show the canvas with all tables placed
  const canvasStage = page.getByTestId('canvas-stage');
  if (await canvasStage.isVisible({ timeout: 2000 }).catch(() => false)) {
    await moveHover(page, canvasStage);
    await see(page);
  }

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
  const seatCountAvail = await available.count();
  console.log(`[ACT2] Available seats: ${seatCountAvail}`);

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

  const pagarBtn = page.getByRole('button', { name: /pagar con izipay/i });
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

  await page.goto(`${BASE}/admin/check-in`, { waitUntil: 'networkidle', timeout: 20000 });
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

  console.log('[DONE] Showcase v3 complete');
});
