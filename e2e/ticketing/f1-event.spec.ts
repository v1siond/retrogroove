import { test, expect } from '@playwright/test';
import { setupTicketingMocks, mockEvent } from './fixtures';

test('F1 renders title, venue address, Cómo llegar link, price, and CTA', async ({ page }) => {
  await setupTicketingMocks(page);
  await page.goto('/evento?slug=gala-2026');
  // title
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Gala 2026');
  // venue address
  await expect(page.getByText('Av. La Rosa Toro 1234')).toBeVisible();
  // Cómo llegar link
  const mapLink = page.getByRole('link', { name: /cómo llegar/i });
  await expect(mapLink).toBeVisible();
  await expect(mapLink).toHaveAttribute('href', 'https://maps.google.com/?q=Arena+1');
  // price
  await expect(page.getByText(/Desde/i).first()).toBeVisible();
  // sticky CTA
  const cta = page.getByRole('button', { name: /comprar entradas/i });
  await expect(cta).toBeVisible();
  // click CTA -> advances to seat selection (F2)
  await cta.click();
  await expect(page.getByTestId('seat-map')).toBeVisible();
});

test('F1 has Nav brand wordmark', async ({ page }) => {
  await setupTicketingMocks(page);
  await page.goto('/evento?slug=gala-2026');
  await expect(page.getByTestId('nav-brand')).toBeVisible();
  await expect(page.getByTestId('nav-brand')).toContainText('RETROGROOVE');
});

test('F1 pricing renders EVERY price bundle (single + combo), not just the first', async ({ page }) => {
  await setupTicketingMocks(page);
  await page.goto('/evento?slug=gala-2026');
  // The VIP section has two bundles: S/40 (1 asiento) and S/70 (combo, 2 asientos).
  const bundles = page.getByTestId('price-bundle');
  await expect(bundles).toHaveCount(2);
  const section = page.getByTestId('price-section');
  await expect(section).toContainText('1 asiento');
  await expect(section).toContainText('S/ 40');
  await expect(section).toContainText('Combo · 2 asientos');
  await expect(section).toContainText('S/ 70');
});

test('F1 renders the flyer as a contained poster (not the hero background)', async ({ page }) => {
  // Serve the event with a flyer URL; this route is registered after the default
  // mock so it takes precedence.
  const withFlyer = { ...JSON.parse(JSON.stringify(mockEvent)), flyer_url: 'https://example.com/flyer.jpg' };
  await page.route('**/api/events/gala-2026', (r) => r.fulfill({ status: 200, json: { event: withFlyer } }));

  await page.goto('/evento?slug=gala-2026');
  const flyer = page.getByTestId('event-flyer');
  await expect(flyer).toBeVisible();
  await expect(flyer).toHaveAttribute('src', 'https://example.com/flyer.jpg');
  await expect(flyer).toHaveCSS('object-fit', 'contain');
});
