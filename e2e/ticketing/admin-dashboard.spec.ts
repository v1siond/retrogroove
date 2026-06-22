import { test, expect } from '@playwright/test';
import { setupAdminLogin, setupAdminDashboard, adminLogin } from './fixtures';

// The real admin dashboard: a persistent nav across Events · Orders · Tickets ·
// Songs · Setlists, each a global list with create/edit/delete + actions. All
// endpoints are mocked to the agreed backend contract.

test.describe('Admin dashboard shell', () => {
  test.beforeEach(async ({ page }) => {
    await setupAdminLogin(page);
    await setupAdminDashboard(page);
  });

  test('shows persistent nav across all five resources after login', async ({ page }) => {
    await adminLogin(page);
    const nav = page.getByTestId('admin-nav');
    for (const key of ['events', 'orders', 'tickets', 'songs', 'setlists']) {
      await expect(nav.getByTestId(`nav-${key}`)).toBeVisible();
    }
    // Defaults to Events.
    await expect(page.getByTestId('events-list')).toBeVisible();
  });

  test('Orders: global list, status filter, and cancel with confirm', async ({ page }) => {
    await adminLogin(page);
    await page.getByTestId('nav-orders').click();

    const list = page.getByTestId('orders-list');
    await expect(list).toBeVisible();
    await expect(page.getByTestId('order-row')).toHaveCount(2);
    await expect(list).toContainText('Juan Pérez');
    await expect(list).toContainText('Gala 2026');
    await expect(list).toContainText('Verano 2027');

    // Filter to paid only -> one row.
    await page.getByTestId('order-status-filter').selectOption('paid');
    await expect(page.getByTestId('order-row')).toHaveCount(1);

    // Expand + cancel the paid order.
    await page.getByTestId('order-row').first().getByText('Juan Pérez').click();
    await page.getByTestId('cancel-order-ord1').click();
    await page.getByTestId('cancel-order-ord1-confirm').click();

    await expect(page.getByTestId('feedback-ok')).toContainText(/cancelada/i);
    await expect(page.getByTestId('order-row').first()).toContainText(/cancelled/i);
  });

  test('Tickets: global list and check-in action', async ({ page }) => {
    await adminLogin(page);
    await page.getByTestId('nav-tickets').click();

    const list = page.getByTestId('tickets-list');
    await expect(list).toBeVisible();
    await expect(page.getByTestId('ticket-row')).toHaveCount(2);
    await expect(list).toContainText('RG-AAA');
    await expect(list).toContainText('RG-BBB');

    // Check in the valid ticket.
    await page.getByTestId('check-in-RG-AAA').click();
    await expect(page.getByTestId('feedback-ok')).toContainText(/registrada/i);
    // The row now shows it as used.
    await expect(page.getByTestId('ticket-row').filter({ hasText: 'RG-AAA' })).toContainText(/used/i);
  });

  test('Tickets: void action voids a ticket', async ({ page }) => {
    await adminLogin(page);
    await page.getByTestId('nav-tickets').click();

    await page.getByTestId('void-RG-AAA').click();
    await page.getByTestId('void-RG-AAA-confirm').click();
    await expect(page.getByTestId('feedback-ok')).toContainText(/anulada/i);
    await expect(page.getByTestId('ticket-row').filter({ hasText: 'RG-AAA' })).toContainText(/void/i);
  });

  test('Songs: list, create, toggle enabled, and delete', async ({ page }) => {
    await adminLogin(page);
    await page.getByTestId('nav-songs').click();

    const list = page.getByTestId('songs-list');
    await expect(list).toBeVisible();
    await expect(page.getByTestId('song-row')).toHaveCount(2);
    await expect(list).toContainText('Take on Me');

    // Create.
    await page.getByLabel('Título').fill('Billie Jean');
    await page.getByLabel('Artista').fill('Michael Jackson');
    await page.getByRole('button', { name: 'Añadir' }).click();
    await expect(page.getByTestId('feedback-ok')).toContainText(/añadida/i);
    await expect(page.getByTestId('song-row')).toHaveCount(3);

    // Toggle enabled on the first song (was Activa -> Oculta).
    await expect(page.getByTestId('toggle-song-take-on-me')).toContainText('Activa');
    await page.getByTestId('toggle-song-take-on-me').click();
    await expect(page.getByTestId('toggle-song-take-on-me')).toContainText('Oculta');

    // Delete the second song.
    await page.getByTestId('delete-song-celebration').click();
    await page.getByTestId('delete-song-celebration-confirm').click();
    await expect(page.getByTestId('feedback-ok')).toContainText(/eliminada/i);
  });

  test('one backend login unlocks /band and /band/setlist (unified auth)', async ({ page }) => {
    // The request dashboard now uses the same email/password AdminGate, not the
    // old single-password gate.
    await page.goto('/band');
    await expect(page.getByLabel('Email')).toBeVisible();
    await expect(page.getByLabel('Contraseña')).toBeVisible();

    await page.goto('/band/setlist');
    await expect(page.getByLabel('Email')).toBeVisible();
    await expect(page.getByLabel('Contraseña')).toBeVisible();

    // After logging in via the shared gate, the request dashboard renders.
    await page.getByLabel('Email').fill('admin@retrogroove.com');
    await page.getByLabel('Contraseña').fill('password123');
    await page.getByRole('button', { name: 'Entrar' }).click();
    await expect(page.getByText('RETROGROOVE')).toBeVisible();
  });

  test('Setlists: list, create, and edit (add + reorder song_ids)', async ({ page }) => {
    await adminLogin(page);
    await page.getByTestId('nav-setlists').click();

    const list = page.getByTestId('setlists-list');
    await expect(list).toBeVisible();
    await expect(page.getByTestId('setlist-row')).toHaveCount(1);
    await expect(list).toContainText('Bloque 1');

    // Edit the existing setlist: add a song, then save.
    await page.getByTestId('edit-setlist-bloque-1').click();
    await expect(page.getByTestId('setlist-edit-bloque-1')).toBeVisible();
    // Add a second song from the picker.
    await page.getByTestId('setlist-add-song').selectOption('celebration');
    await expect(page.getByTestId('setlist-songs')).toContainText('Celebration');
    await page.getByRole('button', { name: /guardar setlist/i }).click();
    // Back to the list view.
    await expect(page.getByTestId('setlist-edit-bloque-1')).toHaveCount(0);
  });
});
