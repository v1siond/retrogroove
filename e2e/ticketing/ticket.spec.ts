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
    event_name: 'Gala 2026',
    event_starts_at: '2026-12-31T21:00:00Z',
    seat_label: 'Mesa 1 · Asiento 1',
    section_name: 'VIP',
  };
  await page.route('**/api/tickets/ABCD1234', (r) => r.fulfill({ status: 200, json: { ticket } }));

  await page.goto('/t?token=ABCD1234');
  await expect(page.getByRole('heading', { name: /mis entradas/i })).toBeVisible();
  await expect(page.getByTestId('ticket-status')).toContainText('Válida');
  await expect(page.getByTestId('ticket-qr')).toBeVisible();
  await expect(page.getByTestId('ticket-token')).toHaveText('ABCD1234');
});

test('F5: ticket card renders QR, code, status and PDF link', async ({ page }) => {
  await page.route('**/api/tickets/tok1', (r) => r.fulfill({
    status: 200,
    json: {
      ticket: {
        id: 't1',
        code: 'RG-TOK1',
        public_token: 'tok1',
        status: 'valid',
        qr_svg: '<svg data-qr="1"><rect width="10" height="10" /></svg>',
        checked_in_at: null,
        seat_id: 's1',
        event_name: 'Gala 2026',
        event_starts_at: '2026-12-31T21:00:00Z',
        seat_label: 'Mesa 1 · Asiento 1',
        section_name: 'VIP',
      },
    },
  }));

  await page.goto('/t?token=tok1');

  // QR visible on white background
  await expect(page.getByTestId('ticket-qr')).toBeVisible();

  // status
  await expect(page.getByTestId('ticket-status')).toContainText('Válida');

  // PDF download link
  const pdfLink = page.getByTestId('pdf-link');
  await expect(pdfLink).toBeVisible();
  const href = await pdfLink.getAttribute('href');
  expect(href).toMatch(/tickets\/tok1\/pdf/);
});
