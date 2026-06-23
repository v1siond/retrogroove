/**
 * Batch-6 — Door Check-in (mocked adminApi)
 * Task 1: Neon-Editorial shell + manual-entry form
 * Task 2: VÁLIDA / YA USADA / NO ENCONTRADA result states
 * Task 3: Camera-scan seam (Phase-2 stub)
 */
import { test, expect, Page } from '@playwright/test';

// ── shared helpers ────────────────────────────────────────────────────────────

async function mockAdminLogin(page: Page) {
  await page.route('**/api/auth/login', (r) =>
    r.fulfill({
      status: 200,
      json: { token: 'jwt_test', user: { id: 'u1', email: 'admin@rg.com', name: 'Admin', role: 'admin' } },
    })
  );
}

async function login(page: Page) {
  await page.goto('/band/tickets/check-in');
  await page.getByLabel('Email').fill('admin@rg.com');
  await page.getByLabel('Contraseña').fill('password123');
  await page.getByRole('button', { name: 'Entrar' }).click();
}

// Ticket fixtures
const VALID_TICKET = {
  id: 't1',
  code: 'RG-7K4P-29',
  public_token: 'tok-valid',
  status: 'valid',
  qr_svg: null,
  checked_in_at: null,
  seat_id: 's1',
  event_name: 'Gala 2026',
  event_starts_at: '2026-12-31T21:00:00Z',
  seat_label: 'Mesa 1 · Asiento 1',
  section_name: 'VIP',
};

const USED_TICKET = {
  ...VALID_TICKET,
  status: 'used',
  checked_in_at: '2026-12-31T22:05:00Z',
};

// ── Task 1: Shell + manual-entry form ────────────────────────────────────────

test.describe('Task 1 — Neon-Editorial shell + manual-entry form', () => {
  test.beforeEach(async ({ page }) => {
    await mockAdminLogin(page);
  });

  test('shows CONTROL DE PUERTA heading in Bebas Neue style', async ({ page }) => {
    await login(page);
    await expect(page.getByTestId('checkin-title')).toContainText('CONTROL DE PUERTA');
  });

  test('shows ingress count badge (N ingresos)', async ({ page }) => {
    await login(page);
    await expect(page.getByTestId('ingress-count')).toBeVisible();
    await expect(page.getByTestId('ingress-count')).toContainText('ingresos');
  });

  test('token input is visible and auto-focused by default', async ({ page }) => {
    await login(page);
    const input = page.getByTestId('token-input');
    await expect(input).toBeVisible();
    await expect(input).toBeFocused();
  });

  test('VALIDAR button is visible', async ({ page }) => {
    await login(page);
    await expect(page.getByTestId('btn-validar')).toBeVisible();
    await expect(page.getByTestId('btn-validar')).toContainText('VALIDAR');
  });

  test('Enter key triggers API lookup (hardware scanner behavior)', async ({ page }) => {
    let apiCalled = false;
    await page.route('**/api/tickets/tok-valid', (r) => {
      apiCalled = true;
      return r.fulfill({ status: 200, json: { ticket: VALID_TICKET } });
    });
    await login(page);

    const input = page.getByTestId('token-input');
    await input.fill('tok-valid');
    await input.press('Enter');

    // Enter triggered the form submit — API was called
    await page.waitForTimeout(500);
    expect(apiCalled).toBe(true);
  });
});

// ── Task 2: Result states ────────────────────────────────────────────────────

test.describe('Task 2 — VÁLIDA / YA USADA / NO ENCONTRADA result states', () => {
  test.beforeEach(async ({ page }) => {
    await mockAdminLogin(page);
  });

  test('VÁLIDA: shows green VÁLIDA state with seat, section, event on first check-in', async ({ page }) => {
    await page.route('**/api/tickets/tok-valid', (r) =>
      r.fulfill({ status: 200, json: { ticket: VALID_TICKET } })
    );
    await page.route('**/api/tickets/tok-valid/check-in', (r) =>
      r.fulfill({ status: 200, json: { ticket: USED_TICKET } })
    );

    await login(page);

    await page.getByTestId('token-input').fill('tok-valid');
    await page.getByTestId('btn-validar').click();

    const panel = page.getByTestId('result-panel');
    await expect(panel).toBeVisible({ timeout: 8000 });
    await expect(panel).toContainText('VÁLIDA');

    // Shows ticket details: seat, section, event
    await expect(panel).toContainText('Mesa 1 · Asiento 1');
    await expect(panel).toContainText('VIP');
    await expect(panel).toContainText('Gala 2026');

    // REGISTRAR ENTRADA button present
    await expect(page.getByTestId('btn-registrar')).toBeVisible();
  });

  test('VÁLIDA → REGISTRAR ENTRADA registers and increments count', async ({ page }) => {
    await page.route('**/api/tickets/tok-valid', (r) =>
      r.fulfill({ status: 200, json: { ticket: VALID_TICKET } })
    );
    await page.route('**/api/tickets/tok-valid/check-in', (r) =>
      r.fulfill({ status: 200, json: { ticket: USED_TICKET } })
    );

    await login(page);
    await page.getByTestId('token-input').fill('tok-valid');
    await page.getByTestId('btn-validar').click();
    await expect(page.getByTestId('result-panel')).toBeVisible({ timeout: 8000 });

    await page.getByTestId('btn-registrar').click();

    // After successful check-in, count increments
    await expect(page.getByTestId('ingress-count')).toContainText('1');
  });

  test('YA USADA: shows red YA USADA with checked_in_at when already used', async ({ page }) => {
    await page.route('**/api/tickets/tok-used', (r) =>
      r.fulfill({ status: 200, json: { ticket: USED_TICKET } })
    );

    await login(page);
    await page.getByTestId('token-input').fill('tok-used');
    await page.getByTestId('btn-validar').click();

    const panel = page.getByTestId('result-panel');
    await expect(panel).toBeVisible({ timeout: 8000 });
    await expect(panel).toContainText('YA USADA');

    // Shows the checked-in time (year visible)
    await expect(panel).toContainText('2026');
  });

  test('NO ENCONTRADA: shows not-found state for unknown token', async ({ page }) => {
    await page.route('**/api/tickets/tok-unknown', (r) =>
      r.fulfill({ status: 404, json: { error: 'not_found' } })
    );

    await login(page);
    await page.getByTestId('token-input').fill('tok-unknown');
    await page.getByTestId('btn-validar').click();

    const panel = page.getByTestId('result-panel');
    await expect(panel).toBeVisible({ timeout: 8000 });
    await expect(panel).toContainText('NO ENCONTRADA');
  });

  test('Siguiente clears input and refocuses for next scan', async ({ page }) => {
    await page.route('**/api/tickets/tok-used', (r) =>
      r.fulfill({ status: 200, json: { ticket: USED_TICKET } })
    );

    await login(page);
    await page.getByTestId('token-input').fill('tok-used');
    await page.getByTestId('btn-validar').click();

    await expect(page.getByTestId('result-panel')).toBeVisible({ timeout: 8000 });
    await page.getByTestId('btn-siguiente').click();

    // Input is cleared and refocused
    await expect(page.getByTestId('token-input')).toHaveValue('');
    await expect(page.getByTestId('token-input')).toBeFocused();
    // Result panel gone
    await expect(page.getByTestId('result-panel')).not.toBeVisible();
  });

  test('auto-verify on ?token= query param and register entry', async ({ page }) => {
    await page.route('**/api/tickets/ABCD1234', (r) =>
      r.fulfill({ status: 200, json: { ticket: { ...VALID_TICKET, public_token: 'ABCD1234' } } })
    );
    await page.route('**/api/tickets/ABCD1234/check-in', (r) =>
      r.fulfill({ status: 200, json: { ticket: { ...USED_TICKET, public_token: 'ABCD1234' } } })
    );

    await mockAdminLogin(page);
    await page.goto('/band/tickets/check-in?token=ABCD1234');
    await page.getByLabel('Email').fill('admin@rg.com');
    await page.getByLabel('Contraseña').fill('password123');
    await page.getByRole('button', { name: 'Entrar' }).click();

    await expect(page.getByTestId('result-panel')).toBeVisible({ timeout: 8000 });
    await expect(page.getByTestId('result-panel')).toContainText('VÁLIDA');

    await page.getByTestId('btn-registrar').click();
    await expect(page.getByTestId('ingress-count')).toContainText('1');
  });
});

// ── Task 3: Live camera QR scanner ───────────────────────────────────────────
//
// A real camera can't run in headless Playwright, so we don't try to decode a
// QR here — that's covered by the extractToken unit test (lib/ticketing/qr.test.ts).
// These tests guard that the page renders, the scanner opens/closes (releasing
// the camera), graceful no-camera/denied messaging shows, and that the manual +
// URL flows still work alongside it.

test.describe('Task 3 — Live camera QR scanner', () => {
  test.beforeEach(async ({ page }) => {
    await mockAdminLogin(page);
  });

  test('shows an enabled "Escanear con cámara" button (no more "próximamente")', async ({ page }) => {
    await login(page);

    const seam = page.getByTestId('camera-scan-seam');
    await expect(seam).toBeVisible();
    await expect(seam).not.toContainText(/próximamente/i);

    const btn = page.getByTestId('camera-scan-btn');
    await expect(btn).toBeVisible();
    await expect(btn).toContainText('Escanear con cámara');
    await expect(btn).toBeEnabled();
  });

  test('clicking the camera button opens the live scanner panel', async ({ page }) => {
    await login(page);
    await page.getByTestId('camera-scan-btn').click();

    // Scanner mounts. With no real camera it surfaces a graceful error state,
    // but either way the scanner panel and a Detener/Cerrar control are present.
    await expect(page.getByTestId('qr-scanner')).toBeVisible();
    await expect(page.getByTestId('qr-scanner-close')).toBeVisible();
  });

  test('Detener/Cerrar closes the scanner and returns to the seam (camera released)', async ({ page }) => {
    await login(page);
    await page.getByTestId('camera-scan-btn').click();
    await expect(page.getByTestId('qr-scanner')).toBeVisible();

    await page.getByTestId('qr-scanner-close').click();

    await expect(page.getByTestId('qr-scanner')).not.toBeVisible();
    await expect(page.getByTestId('camera-scan-seam')).toBeVisible();
  });

  test('manual entry still works while the scanner is open', async ({ page }) => {
    await page.route('**/api/tickets/tok-used', (r) =>
      r.fulfill({ status: 200, json: { ticket: USED_TICKET } })
    );

    await login(page);
    await page.getByTestId('camera-scan-btn').click();
    await expect(page.getByTestId('qr-scanner')).toBeVisible();

    // Manual input + VALIDAR remain usable alongside the open scanner.
    await page.getByTestId('token-input').fill('tok-used');
    await page.getByTestId('btn-validar').click();

    const panel = page.getByTestId('result-panel');
    await expect(panel).toBeVisible({ timeout: 8000 });
    await expect(panel).toContainText('YA USADA');
  });
});
