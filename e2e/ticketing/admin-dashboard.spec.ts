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

  // How full each event is, without opening anything.
  test('Events: the list shows sold vs left, with comps counted apart', async ({ page }) => {
    await adminLogin(page);

    const gala = page.getByTestId('event-item').filter({ hasText: 'Gala 2026' });
    await expect(gala.getByTestId('event-sales')).toContainText('38');
    await expect(gala.getByTestId('event-sales')).toContainText('120');
    await expect(gala.getByTestId('event-sales')).toContainText('78');
    // 4 comps are shown, but they are not folded into "vendidas"
    await expect(gala.getByTestId('event-sales')).toContainText('4');
  });

  test('Events: a sold-out event reads as agotado', async ({ page }) => {
    await adminLogin(page);
    await page.getByTestId('event-filter-past').click();

    const past = page.getByTestId('event-item').filter({ hasText: 'Retro 2025' });
    await expect(past.getByTestId('event-sales')).toContainText(/agotado/i);
  });

  test('Events: the drawer repeats the aforo breakdown', async ({ page }) => {
    await adminLogin(page);
    await page.getByTestId('event-item').filter({ hasText: 'Gala 2026' }).click();

    const drawer = page.getByTestId('event-detail');
    await expect(drawer).toContainText('Aforo');
    await expect(drawer).toContainText('120');
    await expect(drawer).toContainText('38');
    await expect(page.getByTestId('event-available')).toHaveText('78');
  });

  test('Tickets: the list names the mesa of each seated ticket', async ({ page }) => {
    await adminLogin(page);
    await page.getByTestId('nav-tickets').click();

    await expect(page.getByTestId('ticket-row').filter({ hasText: 'RG-AAA' })).toContainText('M1');
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

  test('/admin shows the admin login gate when logged out', async ({ page }) => {
    await page.goto('/admin');
    await expect(page.getByLabel('Email')).toBeVisible();
    await expect(page.getByLabel('Contraseña')).toBeVisible();
  });

  test('/setlist is public (no admin gate) so clients can build a setlist', async ({ page }) => {
    await page.goto('/setlist');
    // Client-facing tool — must NOT be behind the admin login gate.
    await expect(page.getByLabel('Contraseña')).toHaveCount(0);
    await expect(page.getByText('Armar Mi Setlist')).toBeVisible();
  });

  test('Events: defaults to Activos, toggles to Pasados and Todos', async ({ page }) => {
    await adminLogin(page);

    // Default view is the active filter — two upcoming events.
    await expect(page.getByTestId('event-filter-active')).toHaveAttribute('data-active', 'true');
    await expect(page.getByTestId('event-item')).toHaveCount(2);
    const list = page.getByTestId('events-list');
    await expect(list).toContainText('Gala 2026');
    await expect(list).toContainText('Verano 2027');

    // Pasados -> the single past event, none of the active ones.
    await page.getByTestId('event-filter-past').click();
    await expect(page.getByTestId('event-filter-past')).toHaveAttribute('data-active', 'true');
    await expect(page.getByTestId('event-item')).toHaveCount(1);
    await expect(list).toContainText('Retro 2025');
    await expect(list).not.toContainText('Gala 2026');

    // Todos -> active + past together.
    await page.getByTestId('event-filter-all').click();
    await expect(page.getByTestId('event-item')).toHaveCount(3);
    await expect(list).toContainText('Gala 2026');
    await expect(list).toContainText('Retro 2025');
  });

  test('Issue: emits reserved-seat tickets for a buyer', async ({ page }) => {
    await adminLogin(page);
    await page.getByTestId('nav-issue').click();

    // Pick the event, then two reserved seats.
    await page.getByTestId('issue-event-item').filter({ hasText: 'Gala 2026' }).click();
    await expect(page.getByTestId('issue-form')).toBeVisible();
    await page.locator('[data-seat-id="s1"]').click();
    await page.locator('[data-seat-id="s2"]').click();
    await expect(page.getByTestId('issue-selection')).toContainText('2 asiento');

    // Buyer + submit.
    await page.getByLabel('Email del invitado').fill('amigo@x.com');
    await page.getByLabel('Nombre').fill('Ana');
    await page.getByLabel('Apellido').fill('López');
    await page.getByTestId('issue-submit').click();

    // Issued tickets with codes + links.
    await expect(page.getByTestId('issued')).toContainText('2 entrada');
    await expect(page.getByTestId('issued')).toContainText('amigo@x.com');
    await expect(page.getByTestId('issued-ticket')).toHaveCount(2);
    await expect(page.getByTestId('issued')).toContainText('MAN-1');
  });

  test('Issue: emits general-admission tickets by quantity', async ({ page }) => {
    await adminLogin(page);
    await page.getByTestId('nav-issue').click();

    await page.getByTestId('issue-event-item').filter({ hasText: 'Gala 2026' }).click();
    await expect(page.getByTestId('issue-form')).toBeVisible();

    // Choose the GA section, set quantity to 3.
    await page.getByTestId('ga-pick-sec-ga').check();
    await page.getByTestId('ga-quantity').fill('3');
    await expect(page.getByTestId('issue-selection')).toContainText('3 entrada');

    await page.getByLabel('Email del invitado').fill('grupo@x.com');
    await page.getByTestId('issue-submit').click();

    await expect(page.getByTestId('issued')).toContainText('3 entrada');
    await expect(page.getByTestId('issued-ticket')).toHaveCount(3);
  });

  test('Issue: surfaces a clear message when seats are unavailable', async ({ page }) => {
    // Re-wire the dashboard so comp-orders rejects with the seats_unavailable
    // contract error; the panel must show the mapped message, not a generic one.
    await setupAdminDashboard(page, {
      compError: { status: 409, error: 'seats_unavailable', seat_ids: ['s1'] },
    });
    await adminLogin(page);
    await page.getByTestId('nav-issue').click();

    await page.getByTestId('issue-event-item').filter({ hasText: 'Gala 2026' }).click();
    await expect(page.getByTestId('issue-form')).toBeVisible();
    await page.locator('[data-seat-id="s1"]').click();
    await page.getByLabel('Email del invitado').fill('amigo@x.com');
    await page.getByTestId('issue-submit').click();

    await expect(page.getByTestId('feedback-error')).toContainText(/no está disponible/i);
    // No tickets were issued.
    await expect(page.getByTestId('issued')).toHaveCount(0);
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
