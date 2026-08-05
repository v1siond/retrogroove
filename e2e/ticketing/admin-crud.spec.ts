/**
 * CRUD reachability — these assert the admin can actually REACH and fire the
 * update/delete/status affordances from the UI (the gap the happy-path specs
 * missed). Every mutation is captured at the network layer and asserted.
 */
import { test, expect, Page } from '@playwright/test';
import { setupAdminLogin, setupAdminDashboard, adminLogin } from './fixtures';

test.describe('Admin CRUD reachability', () => {
  test.beforeEach(async ({ page }) => {
    await setupAdminLogin(page);
    await setupAdminDashboard(page);
  });

  test('Events: status control drives publish → draft → cancelled → completed (updateEvent)', async ({ page }) => {
    const statuses: string[] = [];
    await page.route('**/api/events/ev1', (r) => {
      if (r.request().method() !== 'PUT') return r.fallback();
      const body = r.request().postDataJSON() as { event: { status?: string } };
      if (body.event.status) statuses.push(body.event.status);
      return r.fulfill({ status: 200, json: { event: { id: 'ev1', slug: 'gala-2026', name: 'Gala 2026', ...body.event } } });
    });

    await adminLogin(page);
    // ev1 = Gala 2026, currently published
    await page.getByTestId('event-item').first().click();
    await expect(page.getByTestId('event-detail')).toBeVisible();

    const sel = page.getByTestId('event-status');
    await expect(sel).toBeVisible();
    await expect(sel).toHaveValue('published');

    // Each transition waits for its PUT to land before firing the next (the
    // control is busy-guarded, so back-to-back changes would otherwise be dropped).
    await sel.selectOption('draft');
    await expect.poll(() => statuses.length).toBe(1);
    await sel.selectOption('cancelled');
    await expect.poll(() => statuses.length).toBe(2);
    await sel.selectOption('completed');
    await expect.poll(() => statuses.length).toBe(3);

    expect(statuses).toEqual(['draft', 'cancelled', 'completed']);
  });

  test('Songs: edit updates title via updateSong (PUT)', async ({ page }) => {
    let putTitle: string | undefined;
    await page.route('**/api/songs/take-on-me', (r) => {
      if (r.request().method() !== 'PUT') return r.fallback();
      const body = r.request().postDataJSON() as { song: { title?: string } };
      putTitle = body.song.title;
      return r.fulfill({ status: 200, json: { song: { id: 'take-on-me', title: body.song.title, artist: 'a-ha', enabled: true } } });
    });

    await adminLogin(page);
    await page.getByTestId('nav-songs').click();
    await page.getByTestId('edit-song-take-on-me').click();
    const form = page.getByTestId('song-edit-take-on-me');
    await expect(form).toBeVisible();
    await form.getByLabel('Título').fill('Take On Me (Remaster)');
    await page.locator('button[form="song-edit-form"]').click();

    await expect.poll(() => putTitle).toBe('Take On Me (Remaster)');
  });

  test('Promos: create, edit, and delete a code for an event', async ({ page }) => {
    const calls: string[] = [];
    let promos: Array<Record<string, unknown>> = [];

    await page.route('**/api/events/ev1/promo-codes', (r) => {
      if (r.request().method() === 'POST') {
        const b = r.request().postDataJSON() as { promo_code: Record<string, unknown> };
        calls.push('POST');
        promos = [{ id: 'pr1', active: true, ...b.promo_code }];
        return r.fulfill({ status: 201, json: { data: promos[0] } });
      }
      return r.fulfill({ status: 200, json: { promo_codes: promos } });
    });
    await page.route('**/api/promo-codes/pr1', (r) => {
      const m = r.request().method();
      if (m === 'DELETE') { calls.push('DELETE'); promos = []; return r.fulfill({ status: 204, body: '' }); }
      if (m === 'PUT') {
        const b = r.request().postDataJSON() as { promo_code: Record<string, unknown> };
        calls.push('PUT');
        promos = [{ ...promos[0], ...b.promo_code }];
        return r.fulfill({ status: 200, json: { data: promos[0] } });
      }
      return r.fallback();
    });

    await adminLogin(page);
    await page.getByTestId('nav-promos').click();
    await page.getByTestId('promo-event-select').selectOption('ev1');

    // Create
    await page.getByTestId('new-promo').click();
    await expect(page.getByTestId('promo-form')).toBeVisible();
    await page.locator('#promo-code').fill('FAN10');
    await page.locator('#promo-value').fill('10');
    await page.locator('button[form="promo-form"]').click();
    await expect.poll(() => calls.filter((c) => c === 'POST').length).toBe(1);

    // Edit the now-listed code
    await expect(page.getByTestId('promo-row')).toHaveCount(1);
    await page.getByTestId('promo-row').first().click();
    await expect(page.getByTestId('promo-form')).toBeVisible();
    await page.locator('#promo-value').fill('15');
    await page.locator('button[form="promo-form"]').click();
    await expect.poll(() => calls.filter((c) => c === 'PUT').length).toBe(1);

    // Delete
    await page.getByTestId('promo-row').first().click();
    await page.getByTestId('delete-promo-pr1').click();
    await page.getByTestId('delete-promo-pr1-confirm').click();
    await expect.poll(() => calls.filter((c) => c === 'DELETE').length).toBe(1);
  });

  test('Setlists: delete removes a setlist (deleteSetlist DELETE)', async ({ page }) => {
    let deleted = false;
    await page.route('**/api/setlists/bloque-1', (r) => {
      if (r.request().method() !== 'DELETE') return r.fallback();
      deleted = true;
      return r.fulfill({ status: 204, body: '' });
    });

    await adminLogin(page);
    await page.getByTestId('nav-setlists').click();
    await page.getByTestId('edit-setlist-bloque-1').click();
    await expect(page.getByTestId('setlist-edit-bloque-1')).toBeVisible();
    await page.getByTestId('delete-setlist-bloque-1').click();
    await page.getByTestId('delete-setlist-bloque-1-confirm').click();
    await expect.poll(() => deleted).toBe(true);
  });

  test('Orders: detail lists the order tickets and "Reenviar entradas" re-sends them', async ({ page }) => {
    let resent = false;
    // ord1 is the paid order in the fixture; the drawer fetches its tickets via GET /orders/ord1.
    await page.route('**/api/orders/ord1', (r) => {
      if (r.request().method() !== 'GET') return r.fallback();
      return r.fulfill({
        status: 200,
        json: { order: { id: 'ord1', status: 'paid', total: '70', tickets: [{ id: 't1', code: 'ABC123', public_token: 'tok1', status: 'valid', seat_label: 'M3-1', section_name: 'Mesas VIP', table_label: 'M3' }] } },
      });
    });
    await page.route('**/api/orders/ord1/resend', (r) => { resent = true; return r.fulfill({ status: 200, json: { ok: true } }); });

    await adminLogin(page);
    await page.getByTestId('nav-orders').click();
    await page.getByTestId('order-row').filter({ hasText: 'Juan Pérez' }).click();
    await expect(page.getByTestId('order-detail')).toBeVisible();

    // The order shows its tickets (with a link to each) and which mesa each one is at.
    await expect(page.getByTestId('order-ticket-row')).toHaveCount(1);
    await expect(page.getByText('ABC123')).toBeVisible();
    await expect(page.getByTestId('order-ticket-row')).toContainText('M3');

    // Re-send the ticket email.
    await page.getByTestId('resend-order-ord1').click();
    await expect.poll(() => resent).toBe(true);
    await expect(page.getByTestId('feedback-ok')).toContainText(/reenviadas/i);
  });

  // ord2 is the pending Yape-style order with no buyer name — the case the admin has to
  // fix by hand after confirming a payment before the buyer sent their details.
  test('Orders: edit fills in the buyer and payment reference (updateOrder)', async ({ page }) => {
    let sent: Record<string, unknown> | null = null;

    await page.route('**/api/orders/ord2', (r) => {
      const method = r.request().method();
      if (method === 'GET') {
        return r.fulfill({ status: 200, json: { order: { id: 'ord2', status: 'pending', total: '40', tickets: [] } } });
      }
      if (method !== 'PUT') return r.fallback();
      sent = r.request().postDataJSON() as Record<string, unknown>;
      return r.fulfill({
        status: 200,
        json: {
          order: {
            id: 'ord2', event_id: 'ev2', event_name: 'Verano 2027', status: 'pending', total: '40',
            buyer_email: 'ana@correo.pe', buyer_first_name: 'Ana', buyer_last_name: 'Ríos',
            buyer_phone: '+51999888777', payment_ref: '00123456', paid_at: null,
            inserted_at: '2026-12-02T11:00:00Z', ticket_count: 1,
          },
        },
      });
    });

    await adminLogin(page);
    await page.getByTestId('nav-orders').click();
    await page.getByTestId('order-row').filter({ hasText: 'maria@example.com' }).click();
    await expect(page.getByTestId('order-detail')).toBeVisible();

    await page.getByTestId('edit-order-ord2').click();
    await page.getByTestId('order-first-name').fill('Ana');
    await page.getByTestId('order-last-name').fill('Ríos');
    await page.getByTestId('order-email').fill('ana@correo.pe');
    await page.getByTestId('order-phone').fill('+51999888777');
    await page.getByTestId('order-payment-ref').fill('00123456');
    await page.getByTestId('save-order-ord2').click();

    await expect.poll(() => sent).not.toBeNull();
    expect(sent).toEqual({
      buyer: { first_name: 'Ana', last_name: 'Ríos', email: 'ana@correo.pe', phone: '+51999888777' },
      payment_ref: '00123456',
    });

    // Back to the read view, showing what was saved.
    await expect(page.getByTestId('feedback-ok')).toContainText(/guardad/i);
    await expect(page.getByTestId('order-detail')).toContainText('Ana Ríos');
    await expect(page.getByTestId('order-detail')).toContainText('00123456');
  });

  test('Orders: a rejected edit keeps the form open with the typed values', async ({ page }) => {
    await page.route('**/api/orders/ord2', (r) => {
      const method = r.request().method();
      if (method === 'GET') {
        return r.fulfill({ status: 200, json: { order: { id: 'ord2', status: 'pending', total: '40', tickets: [] } } });
      }
      if (method !== 'PUT') return r.fallback();
      return r.fulfill({ status: 422, json: { errors: { buyer_email: ['has invalid format'] } } });
    });

    await adminLogin(page);
    await page.getByTestId('nav-orders').click();
    await page.getByTestId('order-row').filter({ hasText: 'maria@example.com' }).click();
    await page.getByTestId('edit-order-ord2').click();
    await page.getByTestId('order-email').fill('nope');
    await page.getByTestId('save-order-ord2').click();

    await expect(page.getByTestId('feedback-error')).toBeVisible();
    await expect(page.getByTestId('order-email')).toHaveValue('nope');
  });
});
