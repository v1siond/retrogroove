import { test, expect } from '@playwright/test';
import { setupUpcomingMock, ticketedEvent, announcementEvent } from './fixtures';

// The homepage "Próximos Shows" timeline is sourced entirely from
// GET /api/events/upcoming — no hardcoded shows. Ticketed events (with sections)
// link to the internal buy flow; announcement-only events (no sections) link out.

test.describe('homepage upcoming shows (API-only)', () => {
  test('ticketed event links to the internal buy flow', async ({ page }) => {
    await setupUpcomingMock(page, [ticketedEvent]);
    await page.goto('/');

    const card = page.getByTestId('event-card');
    await expect(card).toHaveCount(1);
    await expect(card).toContainText('Gala 2026');
    await expect(card).toContainText('Teatro Municipal');

    const buy = card.getByTestId('buy-link');
    await expect(buy).toBeVisible();
    await expect(buy).toHaveText(/comprar entradas/i);
    await expect(buy).toHaveAttribute('href', '/evento?slug=gala-2026');

    // No external/announcement links on a ticketed event.
    await expect(card.getByTestId('external-link')).toHaveCount(0);
  });

  test('announcement-only event renders external + instagram links, no buy link', async ({ page }) => {
    await setupUpcomingMock(page, [announcementEvent]);
    await page.goto('/');

    const card = page.getByTestId('event-card');
    await expect(card).toHaveCount(1);
    await expect(card).toContainText('Café Rock');
    await expect(card).toContainText('Lince, Lima');

    await expect(card.getByTestId('buy-link')).toHaveCount(0);

    const ext = card.getByTestId('external-link');
    await expect(ext).toBeVisible();
    await expect(ext).toHaveAttribute('href', 'https://caferock.pe/');

    const ig = card.getByTestId('instagram-link');
    await expect(ig).toBeVisible();
    await expect(ig).toHaveAttribute('href', 'https://www.instagram.com/caferock_lince/');
  });

  test('renders both kinds together and only the buy link points internally', async ({ page }) => {
    await setupUpcomingMock(page, [ticketedEvent, announcementEvent]);
    await page.goto('/');

    await expect(page.getByTestId('event-card')).toHaveCount(2);
    await expect(page.getByTestId('buy-link')).toHaveCount(1);
    await expect(page.getByTestId('external-link')).toHaveCount(1);
  });

  test('no events shows the coordinating-dates empty state', async ({ page }) => {
    await setupUpcomingMock(page, []);
    await page.goto('/');

    await expect(page.getByText(/estamos coordinando nuevas fechas/i)).toBeVisible();
    await expect(page.getByTestId('event-card')).toHaveCount(0);
  });
});
