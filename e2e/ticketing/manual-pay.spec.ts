/**
 * Manual / Yape-Plin coordinated payment — the second way to pay (no gateway):
 * buyer reserves seats, lands on the coordina screen, pays the band's Yape number and
 * pings WhatsApp; the band marks the order paid in the admin, which issues the tickets.
 */
import { test, expect } from '@playwright/test';
import { setupTicketingMocks, setupAdminLogin, setupAdminDashboard, adminLogin } from './fixtures';

test('buyer: Yape/Plin button creates a manual order and shows the coordina screen', async ({ page }) => {
  let orderBody: { payment_method?: string } | null = null;

  await setupTicketingMocks(page);
  // Capture the order creation (registered after the fixture → takes precedence).
  await page.route('**/api/orders', async (route) => {
    if (route.request().method() !== 'POST') return route.fallback();
    orderBody = route.request().postDataJSON();
    await route.fulfill({
      status: 201,
      json: { order: { id: 'ordM', status: 'pending', total: '70', buyer_email: '', tickets: [{}, {}] } },
    });
  });

  await page.goto('/evento?slug=gala-2026');
  await page.getByRole('button', { name: /comprar entradas/i }).click();
  await page.locator('[data-seat-id="s1"]').click();
  await page.locator('[data-seat-id="s2"]').click();
  await page.getByTestId('pay-yape').click();

  // Coordina screen: amount, the Yape number, and a prefilled WhatsApp link.
  await expect(page.getByTestId('coordinate-card')).toBeVisible();
  await expect(page.getByTestId('coordinate-total')).toContainText('S/ 70');
  await expect(page.getByTestId('yape-number')).toBeVisible();
  const wa = page.getByTestId('whatsapp-cta');
  await expect(wa).toHaveAttribute('href', /^https:\/\/wa\.me\/51\d+\?text=/);
  await expect(wa).toHaveAttribute('href', /ORDM/); // order reference in the prefilled text

  // The order was created tagged manual (so the backend gives it the long hold).
  expect(orderBody?.payment_method).toBe('manual');
});

test('admin: "Marcar como pagada" confirms a pending order (issues tickets)', async ({ page }) => {
  let confirmed = false;

  await setupAdminLogin(page);
  await setupAdminDashboard(page);
  // ord2 is the pending order in the fixture (maria@example.com).
  await page.route('**/api/orders/ord2/confirm', (r) => {
    if (r.request().method() !== 'POST') return r.fallback();
    confirmed = true;
    return r.fulfill({ status: 200, json: { order: { id: 'ord2', status: 'paid' } } });
  });

  await adminLogin(page);
  await page.getByTestId('nav-orders').click();
  await page.getByTestId('order-row').filter({ hasText: 'maria@example.com' }).click();
  await expect(page.getByTestId('order-detail')).toBeVisible();

  await page.getByTestId('confirm-order-ord2').click();

  await expect.poll(() => confirmed).toBe(true);
  await expect(page.getByTestId('feedback-ok')).toContainText(/confirmado/i);
});

test('buyer: "Reportar pago" records the report and shows the pending ticket', async ({ page }) => {
  let reportBody: { operation_number?: string; buyer?: { email?: string } } | null = null;

  await setupTicketingMocks(page);
  await page.route('**/api/orders', (route) => {
    if (route.request().method() !== 'POST') return route.fallback();
    return route.fulfill({
      status: 201,
      json: { order: { id: 'ordM', status: 'pending', total: '70', payment_provider: 'manual', buyer_email: '', tickets: [{}, {}] } },
    });
  });
  await page.route('**/api/orders/ordM/report-payment', (route) => {
    reportBody = route.request().postDataJSON();
    return route.fulfill({
      status: 200,
      json: { order: { id: 'ordM', status: 'pending', total: '70', payment_provider: 'manual', payment_ref: 'YP-999', buyer_email: 'ana@x.com', tickets: [{}, {}] } },
    });
  });

  await page.goto('/evento?slug=gala-2026');
  await page.getByRole('button', { name: /comprar entradas/i }).click();
  await page.locator('[data-seat-id="s1"]').click();
  await page.locator('[data-seat-id="s2"]').click();
  await page.getByTestId('pay-yape').click();

  await page.getByTestId('report-name').fill('Ana');
  await page.getByTestId('report-email').fill('ana@x.com');
  await page.getByTestId('report-op').fill('YP-999');
  await page.getByTestId('report-submit').click();

  await expect(page.getByTestId('pending-title')).toBeVisible();
  await expect(page.getByTestId('pending-qr-note')).toBeVisible();
  await expect(page.getByText('YP-999')).toBeVisible();

  expect(reportBody?.operation_number).toBe('YP-999');
  expect(reportBody?.buyer?.email).toBe('ana@x.com');
});

test('resume: revisiting a pending manual order shows the pending view, not the poll', async ({ page }) => {
  await setupTicketingMocks(page);
  await page.route('**/api/orders/ordM', (route) =>
    route.fulfill({
      status: 200,
      json: { order: { id: 'ordM', status: 'pending', total: '70', payment_provider: 'manual', payment_ref: 'YP-1', event_slug: 'gala-2026', tickets: [{}] } },
    })
  );

  await page.goto('/evento?order=ordM');
  await expect(page.getByTestId('pending-title')).toBeVisible();
});

test('resume: a manual order not yet reported resumes to the coordina screen', async ({ page }) => {
  await setupTicketingMocks(page);
  await page.route('**/api/orders/ordN', (r) =>
    route_json(r, { order: { id: 'ordN', status: 'pending', total: '70', payment_provider: 'manual', payment_ref: null, event_slug: 'gala-2026', tickets: [{}, {}] } })
  );
  await page.goto('/evento?order=ordN');
  await expect(page.getByTestId('coordinate-card')).toBeVisible();
  await expect(page.getByTestId('yape-number')).toBeVisible();
});

function route_json(r: import('@playwright/test').Route, json: object) {
  return r.fulfill({ status: 200, json });
}
