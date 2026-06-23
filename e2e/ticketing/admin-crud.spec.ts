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
});
