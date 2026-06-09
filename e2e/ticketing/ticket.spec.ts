import { test, expect } from '@playwright/test';

// Seeing the ticket: the buyer opens /t?token=… and finds their status, QR, and
// the short entry code (the manual fallback for the door).
test('the ticket page shows status, QR and the entry token', async ({ page }) => {
  const ticket = {
    id: 't1',
    code: 'RG-ABCD',
    public_token: 'ABCD1234',
    status: 'valid',
    qr_svg: '<svg data-qr="1"><rect width="10" height="10" /></svg>',
    checked_in_at: null,
    seat_id: 's1',
  };
  await page.route('**/api/tickets/ABCD1234', (r) => r.fulfill({ status: 200, json: { ticket } }));

  await page.goto('/t?token=ABCD1234');
  await expect(page.getByRole('heading', { name: 'Tu Entrada' })).toBeVisible();
  await expect(page.getByTestId('ticket-status')).toHaveText('Válida');
  await expect(page.getByTestId('ticket-qr')).toBeVisible();
  await expect(page.getByTestId('ticket-token')).toHaveText('ABCD1234');
});
