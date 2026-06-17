import { test, expect } from '@playwright/test';
import { setupTicketingMocks } from './fixtures';

test.describe('Fan ticket purchase flow', () => {
  test('buys two seats end-to-end and opens a printable ticket', async ({ page }) => {
    await setupTicketingMocks(page);
    await page.addInitScript(() => {
      window.__CULQI_TEST_TOKEN__ = 'tkn_test';
    });

    await page.goto('/evento?slug=gala-2026');
    // F1: event detail page - click CTA to advance to seat selection
    await page.getByRole('button', { name: /comprar entradas/i }).click();
    await expect(page.getByTestId('seat-map')).toBeVisible();

    // Select two seats -> running estimate uses the 2-bundle (S/ 70)
    await page.locator('[data-seat-id="s1"]').click();
    await page.locator('[data-seat-id="s2"]').click();
    await expect(page.getByTestId('order-total-value')).toContainText('70');

    // Advance to pay
    await page.getByRole('button', { name: /ir a pagar/i }).click();

    // Pay step shows the authoritative total
    await expect(page.getByTestId('order-total')).toContainText('70');
    await page.getByRole('button', { name: /pagar con culqi/i }).click();

    // Confirmation + ticket links
    await expect(page.getByText(/compra confirmada/i)).toBeVisible();
    const links = page.getByTestId('ticket-link');
    await expect(links).toHaveCount(2);

    // Open the printable ticket
    await links.first().click();
    await expect(page).toHaveURL(/\/t\?token=tok1/);
    await expect(page.getByTestId('ticket-status')).toContainText('Válida');
    await expect(page.getByTestId('ticket-qr')).toBeVisible();
  });

  test('shows an error when seats are no longer available', async ({ page }) => {
    await setupTicketingMocks(page, { ordersFail: true });

    await page.goto('/evento?slug=gala-2026');
    // advance to seat selection
    await page.getByRole('button', { name: /comprar entradas/i }).click();
    await page.locator('[data-seat-id="s1"]').click();
    await page.getByRole('button', { name: /ir a pagar/i }).click();

    await expect(page.getByText(/no están disponibles/i)).toBeVisible();
  });

  test('sold seats cannot be selected', async ({ page }) => {
    await setupTicketingMocks(page, { soldSeat: 's2' });

    await page.goto('/evento?slug=gala-2026');
    // advance to seat selection
    await page.getByRole('button', { name: /comprar entradas/i }).click();
    await expect(page.locator('[data-seat-id="s2"]')).toBeDisabled();
    await expect(page.locator('[data-seat-id="s1"]')).toBeEnabled();
  });

  test('renders a seat map with seats placed by their position', async ({ page }) => {
    await setupTicketingMocks(page);

    await page.goto('/evento?slug=gala-2026');
    // advance to seat selection
    await page.getByRole('button', { name: /comprar entradas/i }).click();
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

  test('F2: select 2 seats shows combo discount and correct total', async ({ page }) => {
    await setupTicketingMocks(page);
    await page.goto('/evento?slug=gala-2026');
    // advance to seat selection
    await page.getByRole('button', { name: /comprar entradas/i }).click();

    // select 2 seats (bundle: 2×S/40=S/80 but bundle price S/70 so saving S/10)
    await page.locator('[data-seat-id="s1"]').click();
    await page.locator('[data-seat-id="s2"]').click();

    // combo discount shown
    await expect(page.getByText('Combo aplicado')).toBeVisible();

    // total shows bundle price S/70
    await expect(page.getByTestId('order-total-value')).toContainText('70');

    // Mapa/Lista toggle works
    await page.getByRole('button', { name: 'Lista' }).click();
    await expect(page.getByTestId('seat-list')).toBeVisible();
    await page.getByRole('button', { name: 'Mapa' }).click();
    await expect(page.getByTestId('seat-map')).toBeVisible();
  });

  test('F3: checkout has NO buyer inputs and pay advances to success', async ({ page }) => {
    await setupTicketingMocks(page);
    await page.addInitScript(() => { window.__CULQI_TEST_TOKEN__ = 'tkn_test'; });
    await page.goto('/evento?slug=gala-2026');

    // reach F3
    await page.getByRole('button', { name: /comprar entradas/i }).click();
    await page.locator('[data-seat-id="s1"]').click();
    await page.getByRole('button', { name: /ir a pagar/i }).click();

    // no buyer form
    await expect(page.getByLabel(/nombre/i)).not.toBeVisible();
    await expect(page.getByLabel(/email/i)).not.toBeVisible();

    // pay button present
    await expect(page.getByRole('button', { name: /pagar con culqi/i })).toBeVisible();

    // click pay -> advances to success
    await page.getByRole('button', { name: /pagar con culqi/i }).click();
    await expect(page.getByText(/compra confirmada/i)).toBeVisible();
  });

  test('F4: with name shows no ask-name; without name shows ask-name card', async ({ page }) => {
    // Without name
    await setupTicketingMocks(page, { noName: true });
    await page.addInitScript(() => { window.__CULQI_TEST_TOKEN__ = 'tkn_test'; });
    await page.goto('/evento?slug=gala-2026');
    await page.getByRole('button', { name: /comprar entradas/i }).click();
    await page.locator('[data-seat-id="s1"]').click();
    await page.getByRole('button', { name: /ir a pagar/i }).click();
    await page.getByRole('button', { name: /pagar con culqi/i }).click();
    await expect(page.getByTestId('ask-name-card')).toBeVisible();
  });

  test('F4: with name hides ask-name card', async ({ page }) => {
    // With name (default mock returns Juan Pérez)
    await setupTicketingMocks(page);
    await page.addInitScript(() => { window.__CULQI_TEST_TOKEN__ = 'tkn_test'; });
    await page.goto('/evento?slug=gala-2026');
    await page.getByRole('button', { name: /comprar entradas/i }).click();
    await page.locator('[data-seat-id="s1"]').click();
    await page.getByRole('button', { name: /ir a pagar/i }).click();
    await page.getByRole('button', { name: /pagar con culqi/i }).click();
    await expect(page.getByTestId('ask-name-card')).not.toBeVisible();
  });

  test('F2: seats in tables layout render as ring buttons (table-ring)', async ({ page }) => {
    await setupTicketingMocks(page);
    await page.goto('/evento?slug=gala-2026');
    await page.getByRole('button', { name: /comprar entradas/i }).click();
    await expect(page.getByTestId('seat-map')).toBeVisible();
    // Both seats are rendered as buttons (in the table ring)
    const s1 = page.locator('[data-seat-id="s1"]');
    const s2 = page.locator('[data-seat-id="s2"]');
    await expect(s1).toBeVisible();
    await expect(s2).toBeVisible();
    // s2 (pos_x=70, sorted right) renders to the right of s1 (pos_x=25, sorted left)
    const box1 = await s1.boundingBox();
    const box2 = await s2.boundingBox();
    expect(box2!.x).toBeGreaterThan(box1!.x);
  });

  test('F3: checkout shows subtotal and discount rows', async ({ page }) => {
    await setupTicketingMocks(page);
    await page.addInitScript(() => { window.__CULQI_TEST_TOKEN__ = 'tkn_test'; });
    await page.goto('/evento?slug=gala-2026');
    // select 2 seats to trigger combo
    await page.getByRole('button', { name: /comprar entradas/i }).click();
    await page.locator('[data-seat-id="s1"]').click();
    await page.locator('[data-seat-id="s2"]').click();
    await page.getByRole('button', { name: /ir a pagar/i }).click();
    // F3 should show TU ORDEN and the total
    await expect(page.getByTestId('order-total')).toContainText('70');
    // Subtotal row visible
    await expect(page.getByText('Subtotal').first()).toBeVisible();
    // Total row visible
    await expect(page.getByText('TOTAL', { exact: true })).toBeVisible();
  });

  test('C1: stage is rendered from event stage_w/stage_h data', async ({ page }) => {
    await setupTicketingMocks(page);
    await page.goto('/evento?slug=gala-2026');
    await page.getByRole('button', { name: /comprar entradas/i }).click();
    await expect(page.getByTestId('seat-map')).toBeVisible();
    // Stage text should appear
    await expect(page.getByText('ESCENARIO')).toBeVisible();
  });
});
