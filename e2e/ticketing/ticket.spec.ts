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

// Where to sit: the mesa is what the buyer actually looks for on arrival.
test('the ticket page shows the mesa alongside the section and seat', async ({ page }) => {
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
    seat_label: 'M7-3',
    section_name: 'Mesas VIP',
    table_label: 'M7',
  };
  await page.route('**/api/tickets/ABCD1234', (r) => r.fulfill({ status: 200, json: { ticket } }));

  await page.goto('/t?token=ABCD1234');

  const placement = page.getByTestId('ticket-placement');
  await expect(placement).toContainText('M7');
  await expect(placement).toContainText('M7-3');
  await expect(page.getByText('Mesas VIP')).toBeVisible();
  await expect(page.getByText('Gala 2026')).toBeVisible();
});

// General admission has no mesa — the block must not render an orphan separator.
test('a general-admission ticket shows its section without an empty mesa', async ({ page }) => {
  const ticket = {
    id: 't2', code: 'RG-GA', public_token: 'GA1234', status: 'valid',
    qr_svg: '<svg data-qr="1"><rect width="10" height="10" /></svg>',
    checked_in_at: null, seat_id: null,
    event_name: 'Verano 2027', event_starts_at: '2027-01-15T21:00:00Z',
    seat_label: null, section_name: 'General', table_label: null,
  };
  await page.route('**/api/tickets/GA1234', (r) => r.fulfill({ status: 200, json: { ticket } }));

  await page.goto('/t?token=GA1234');

  await expect(page.getByText('General')).toBeVisible();
  await expect(page.getByTestId('ticket-placement')).toHaveCount(0);
});

test('F5: ticket card renders QR, code, status and a client-side PDF download', async ({ page }) => {
  // A real EQRCode-style SVG so the in-browser rasterizer has something to draw.
  const qrSvg = '<?xml version="1.0" standalone="yes"?>\n'
    + '<svg width="100" height="100" version="1.1" xmlns="http://www.w3.org/2000/svg" '
    + 'viewBox="0 0 5 5" shape-rendering="crispEdges">'
    + '<rect width="5" height="5" style="fill:#FFF"/>'
    + '<rect width="1" height="1" x="0" y="0" style="fill:#000"/>'
    + '<rect width="1" height="1" x="2" y="2" style="fill:#000"/>'
    + '<rect width="1" height="1" x="4" y="4" style="fill:#000"/></svg>';

  await page.route('**/api/tickets/tok1', (r) => r.fulfill({
    status: 200,
    json: {
      ticket: {
        id: 't1',
        code: 'RG-TOK1',
        public_token: 'tok1',
        status: 'valid',
        qr_svg: qrSvg,
        checked_in_at: null,
        seat_id: 's1',
        event_name: 'Gala 2026',
        event_starts_at: '2026-12-31T21:00:00Z',
        seat_label: 'Mesa 1 · Asiento 1',
        section_name: 'VIP',
      },
    },
  }));

  // The PDF is built in the browser — fail loudly if the page hits the old
  // server endpoint.
  let hitServerPdf = false;
  await page.route('**/tickets/*/pdf', (r) => { hitServerPdf = true; r.abort(); });

  await page.goto('/t?token=tok1');

  // QR visible on white background
  await expect(page.getByTestId('ticket-qr')).toBeVisible();

  // status
  await expect(page.getByTestId('ticket-status')).toContainText('Válida');

  // PDF download — clicking generates the PDF client-side and downloads it.
  const pdfBtn = page.getByTestId('pdf-link');
  await expect(pdfBtn).toBeVisible();

  const downloadPromise = page.waitForEvent('download');
  await pdfBtn.click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toMatch(/\.pdf$/);
  expect(hitServerPdf).toBe(false);
});
