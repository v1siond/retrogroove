import { test, expect } from '@playwright/test';
import { setupTicketingMocks, setupOrderResumeMock, mockEvent } from './fixtures';

// After paying, Izipay redirects back to the shop. We persist the pending order
// in localStorage (rg_pending_order) before redirecting so the buyer lands back
// on their ticket instead of losing the view. Both the event page and the
// homepage resume from this key.

test.describe('Return-URL resume after Izipay redirect', () => {
  test('event page: a pending paid order resumes straight to the ticket view', async ({ page }) => {
    await setupTicketingMocks(page);
    // Simulate the pre-redirect persist.
    await page.addInitScript(() => {
      localStorage.setItem('rg_pending_order', JSON.stringify({ id: 'ord1', slug: 'gala-2026' }));
    });

    await page.goto('/evento?slug=gala-2026');

    // getOrder returns paid -> success view with ticket links (no buy steps).
    await expect(page.getByText(/compra confirmada/i)).toBeVisible();
    await expect(page.getByTestId('ticket-link')).toHaveCount(2);

    // The key is cleared once the order is confirmed paid.
    const pending = await page.evaluate(() => localStorage.getItem('rg_pending_order'));
    expect(pending).toBeNull();
  });

  test('event page: a pending unpaid order shows CONFIRMANDO PAGO then confirms', async ({ page }) => {
    await setupTicketingMocks(page);

    // First getOrder call returns pending, subsequent calls return paid — so the
    // page lands on the polling interstitial, then resolves once IPN confirms.
    let calls = 0;
    await page.route('**/api/orders/ord1', async (route) => {
      if (route.request().method() !== 'GET') return route.fallback();
      calls += 1;
      const status = calls === 1 ? 'pending' : 'paid';
      await route.fulfill({
        status: 200,
        json: {
          order: {
            id: 'ord1',
            status,
            total: '70',
            buyer_email: 'fan@example.com',
            buyer_first_name: 'Juan',
            buyer_last_name: 'Pérez',
            expires_at: null,
            tickets: status === 'paid'
              ? [
                  { id: 't1', code: 'CODEt1', public_token: 'tok1', status: 'valid', qr_svg: null, checked_in_at: null, seat_id: 's1', section_name: 'VIP', seat_label: 'Mesa 1 · Asiento 1' },
                ]
              : [],
          },
        },
      });
    });

    await page.addInitScript(() => {
      localStorage.setItem('rg_pending_order', JSON.stringify({ id: 'ord1', slug: 'gala-2026' }));
    });

    await page.goto('/evento?slug=gala-2026');

    // Interstitial first.
    await expect(page.getByText(/confirmando pago/i)).toBeVisible();

    // Then the poll picks up the paid status and shows the ticket.
    await expect(page.getByText(/compra confirmada/i)).toBeVisible({ timeout: 15000 });
  });

  test('homepage: a pending order redirects to the event-page success view', async ({ page }) => {
    await setupTicketingMocks(page);
    // Homepage fetches upcoming events — return none so the timeline is static.
    await page.route('**/api/events/upcoming', (r) => r.fulfill({ status: 200, json: { events: [] } }));

    await page.addInitScript(() => {
      localStorage.setItem('rg_pending_order', JSON.stringify({ id: 'ord1', slug: 'gala-2026' }));
    });

    await page.goto('/');

    // Gets redirected to the event page, which resumes the ticket view.
    await expect(page).toHaveURL(/\/evento\?slug=gala-2026/);
    await expect(page.getByText(/compra confirmada/i)).toBeVisible();
  });

  // Izipay can redirect straight to /evento?order=<id> with NO slug. The page
  // must fetch the order, derive its event_slug, load the event, and show the
  // ticket view — this fixes the live "Evento no especificado" crash.
  test('event page: ?order= with no slug resolves the event and shows the ticket', async ({ page }) => {
    await setupOrderResumeMock(page, { paid: true });

    await page.goto('/evento?order=ord1');

    await expect(page.getByText(/compra confirmada/i)).toBeVisible();
    await expect(page.getByTestId('ticket-link')).toHaveCount(2);
  });

  test('event page: ?order= with an unpaid order shows CONFIRMANDO PAGO then confirms', async ({ page }) => {
    // First GET returns pending; later GETs return paid (IPN confirmed).
    await page.route('**/api/events/gala-2026', (r) => r.fulfill({ status: 200, json: { event: mockEvent } }));
    let calls = 0;
    await page.route('**/api/orders/ord1', (r) => {
      if (r.request().method() !== 'GET') return r.fallback();
      calls += 1;
      const paid = calls > 1;
      return r.fulfill({
        status: 200,
        json: {
          order: {
            id: 'ord1', status: paid ? 'paid' : 'pending', total: '70',
            event_slug: 'gala-2026', event_name: 'Gala 2026',
            buyer_email: 'fan@example.com', buyer_first_name: 'Juan', buyer_last_name: 'Pérez',
            expires_at: null,
            tickets: paid
              ? [{ id: 't1', code: 'CODEt1', public_token: 'tok1', status: 'valid', qr_svg: null, checked_in_at: null, seat_id: 's1', section_name: 'VIP', seat_label: 'Mesa 1 · Asiento 1' }]
              : [],
          },
        },
      });
    });

    await page.goto('/evento?order=ord1');
    await expect(page.getByText(/confirmando pago/i)).toBeVisible();
    await expect(page.getByText(/compra confirmada/i)).toBeVisible({ timeout: 15000 });
  });
});
