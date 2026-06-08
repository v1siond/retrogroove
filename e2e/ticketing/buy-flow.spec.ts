import { test, expect } from '@playwright/test';
import { setupTicketingMocks } from './fixtures';

test.describe('Fan ticket purchase flow', () => {
  test('buys two seats end-to-end and opens a printable ticket', async ({ page }) => {
    await setupTicketingMocks(page);
    await page.addInitScript(() => {
      window.__CULQI_TEST_TOKEN__ = 'tkn_test';
    });

    await page.goto('/evento?slug=gala-2026');
    await expect(page.getByRole('heading', { name: 'Gala 2026' })).toBeVisible();

    // Select two seats -> running estimate uses the 2-bundle (S/ 70)
    await page.locator('[data-seat-id="s1"]').click();
    await page.locator('[data-seat-id="s2"]').click();
    await expect(page.getByTestId('selection')).toContainText('2 asiento');
    await expect(page.getByTestId('selection')).toContainText('70.00');

    // Buyer details -> create order
    await page.getByLabel('Email').fill('fan@example.com');
    await page.getByRole('button', { name: 'Comprar' }).click();

    // Pay step shows the authoritative total
    await expect(page.getByTestId('order-total')).toContainText('70');
    await page.getByRole('button', { name: /pagar/i }).click();

    // Confirmation + ticket links
    await expect(page.getByText(/compra confirmada/i)).toBeVisible();
    const links = page.getByTestId('ticket-link');
    await expect(links).toHaveCount(2);

    // Open the printable ticket
    await links.first().click();
    await expect(page).toHaveURL(/\/t\?token=tok1/);
    await expect(page.getByTestId('ticket-status')).toHaveText('Válida');
    await expect(page.getByTestId('ticket-qr')).toBeVisible();
  });

  test('shows an error when seats are no longer available', async ({ page }) => {
    await setupTicketingMocks(page, { ordersFail: true });

    await page.goto('/evento?slug=gala-2026');
    await page.locator('[data-seat-id="s1"]').click();
    await page.getByLabel('Email').fill('x@y.com');
    await page.getByRole('button', { name: 'Comprar' }).click();

    await expect(page.getByText(/no están disponibles/i)).toBeVisible();
  });

  test('sold seats cannot be selected', async ({ page }) => {
    await setupTicketingMocks(page, { soldSeat: 's2' });

    await page.goto('/evento?slug=gala-2026');
    await expect(page.locator('[data-seat-id="s2"]')).toBeDisabled();
    await expect(page.locator('[data-seat-id="s1"]')).toBeEnabled();
  });

  test('renders a seat map with seats placed by their position', async ({ page }) => {
    await setupTicketingMocks(page);

    await page.goto('/evento?slug=gala-2026');
    await expect(page.getByTestId('seat-map')).toBeVisible();

    const s1 = page.locator('[data-seat-id="s1"]');
    const s2 = page.locator('[data-seat-id="s2"]');

    // Seats are absolutely positioned at their coordinates (not a flow list).
    const style1 = await s1.getAttribute('style');
    expect(style1).toMatch(/left:/);
    expect(style1).toMatch(/top:/);

    // s2 (pos_x 70) renders to the right of s1 (pos_x 25).
    const box1 = await s1.boundingBox();
    const box2 = await s2.boundingBox();
    expect(box2!.x).toBeGreaterThan(box1!.x);
  });
});
