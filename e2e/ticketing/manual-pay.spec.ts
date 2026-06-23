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
