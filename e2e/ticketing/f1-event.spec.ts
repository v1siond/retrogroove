import { test, expect } from '@playwright/test';
import { setupTicketingMocks } from './fixtures';

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
