import { test, expect, Page } from '@playwright/test';
import { mockEvent } from './fixtures';

async function mockLogin(page: Page) {
  await page.route('**/api/auth/login', (route) =>
    route.fulfill({
      status: 200,
      json: { token: 'jwt_test', user: { id: 'u1', email: 'admin@retrogroove.com', name: 'Admin', role: 'admin' } },
    })
  );
}

async function login(page: Page, path: string) {
  await page.goto(path);
  await page.getByLabel('Email').fill('admin@retrogroove.com');
  await page.getByLabel('Contraseña').fill('password123');
  await page.getByRole('button', { name: 'Entrar' }).click();
}

test.describe('Admin', () => {
  test.beforeEach(async ({ page }) => {
    await mockLogin(page);
  });

  test('requires login before showing the check-in tool', async ({ page }) => {
    await page.goto('/admin/check-in');
    await expect(page.getByRole('button', { name: 'Entrar' })).toBeVisible();
  });

  test('verifies a valid ticket and registers entry', async ({ page }) => {
    const valid = { id: 't1', code: 'C1', public_token: 'tok1', status: 'valid', qr_svg: null, checked_in_at: null, seat_id: 's1' };
    await page.route('**/api/tickets/tok1', (r) => r.fulfill({ status: 200, json: { ticket: valid } }));
    await page.route('**/api/tickets/tok1/check-in', (r) =>
      r.fulfill({ status: 200, json: { ticket: { ...valid, status: 'used', checked_in_at: '2026-12-31T22:00:00Z' } } })
    );

    await login(page, '/admin/check-in');
    await expect(page.getByTestId('checkin-title')).toContainText('CONTROL DE PUERTA');
    await expect(page.getByTestId('ingress-count')).toContainText('0');

    await page.getByTestId('token-input').fill('tok1');
    await page.getByTestId('btn-validar').click();
    await expect(page.getByTestId('result-panel')).toContainText('VÁLIDA');

    await page.getByTestId('btn-registrar').click();
    await expect(page.getByTestId('result-panel')).toContainText('ENTRADA REGISTRADA');
    await expect(page.getByTestId('ingress-count')).toContainText('1');
  });

  test('manually issues comp tickets for selected seats', async ({ page }) => {
    await page.route('**/api/events/gala-2026', (r) => r.fulfill({ status: 200, json: { event: mockEvent } }));
    await page.route('**/api/events/ev1/comp-orders', (r) =>
      r.fulfill({
        status: 201,
        json: {
          order: {
            id: 'o1',
            status: 'comp',
            total: '70',
            buyer_email: 'amigo@x.com',
            buyer_first_name: null,
            buyer_last_name: null,
            expires_at: null,
            tickets: [
              { id: 't1', code: 'C1', public_token: 'tok1', status: 'valid', qr_svg: null, checked_in_at: null, seat_id: 's1' },
              { id: 't2', code: 'C2', public_token: 'tok2', status: 'valid', qr_svg: null, checked_in_at: null, seat_id: 's2' },
            ],
          },
        },
      })
    );

    await login(page, '/admin/evento?slug=gala-2026');
    await expect(page.getByRole('heading', { name: 'Gala 2026' })).toBeVisible();

    await page.locator('[data-seat-id="s1"]').click();
    await page.locator('[data-seat-id="s2"]').click();
    await expect(page.getByTestId('selection')).toContainText('2 asiento');

    await page.getByLabel(/email del invitado/i).fill('amigo@x.com');
    await page.getByRole('button', { name: /generar entradas/i }).click();

    await expect(page.getByTestId('issued')).toContainText('2 entrada');
  });

  test('a scanned QR (check-in deep link with ?token=) auto-verifies, then registers entry', async ({ page }) => {
    const valid = { id: 't1', code: 'C1', public_token: 'ABCD1234', status: 'valid', qr_svg: null, checked_in_at: null, seat_id: 's1' };
    await page.route('**/api/tickets/ABCD1234', (r) => r.fulfill({ status: 200, json: { ticket: valid } }));
    await page.route('**/api/tickets/ABCD1234/check-in', (r) =>
      r.fulfill({ status: 200, json: { ticket: { ...valid, status: 'used', checked_in_at: '2026-12-31T22:00:00Z' } } })
    );

    // Staff scans the ticket QR -> the deep link opens check-in pre-loaded with the
    // token -> after login it auto-verifies (no typing). Then they register the entry.
    await login(page, '/admin/check-in?token=ABCD1234');
    await expect(page.getByTestId('result-panel')).toContainText('VÁLIDA');
    await page.getByTestId('btn-registrar').click();
    await expect(page.getByTestId('result-panel')).toContainText('ENTRADA REGISTRADA');
    await expect(page.getByTestId('ingress-count')).toContainText('1');
  });
});
