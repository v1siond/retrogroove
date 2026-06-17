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
