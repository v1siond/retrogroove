/**
 * Band gear: the inventory, the per-event load list built by multiselect, and the
 * venue checklist. Every mutation is asserted at the network layer.
 */
import { test, expect, Page } from '@playwright/test';
import { setupAdminLogin, adminLogin } from './fixtures';

const INVENTORY = [
  { id: 'eq1', name: 'Pearl Export', category: 'Batería', quantity: 1, notes: 'el pedal chirría', active: true },
  { id: 'eq2', name: 'Shure SM58', category: 'Micrófonos', quantity: 6, notes: null, active: true },
  { id: 'eq3', name: 'Mesa vieja', category: 'PA', quantity: 1, notes: null, active: false },
];

const EVENTS = [
  { id: 'ev1', slug: 'disco-night', name: 'Disco Night', status: 'published', starts_at: '2026-12-31T21:00:00Z', venue_name: 'La Basílica' },
];

const EVENT_LIST = [
  {
    id: 'ee1', equipment_item_id: 'eq2', name: 'Shure SM58', category: 'Micrófonos',
    notes: null, owned_quantity: 6, quantity: 4, packed_at: null, returned_at: null,
  },
];

async function setupEquipment(page: Page) {
  await setupAdminLogin(page);
  await page.route('**/api/admin/events**', (r) => r.fulfill({ status: 200, json: { events: EVENTS } }));
  await page.route('**/api/admin/equipment', (r) => {
    if (r.request().method() !== 'GET') return r.fallback();
    return r.fulfill({ status: 200, json: { equipment: INVENTORY } });
  });
}

test.describe('Equipo — inventory', () => {
  test.beforeEach(async ({ page }) => { await setupEquipment(page); });

  test('lists the gear we own, retired items included', async ({ page }) => {
    await adminLogin(page);
    await page.getByTestId('nav-equipment').click();

    await expect(page.getByTestId('equipment-row')).toHaveCount(3);
    await expect(page.getByTestId('equipment-row').filter({ hasText: 'Pearl Export' })).toContainText('Batería');
    await expect(page.getByTestId('equipment-row').filter({ hasText: 'Shure SM58' })).toContainText('6');
  });

  test('adds a new piece of gear (POST /admin/equipment)', async ({ page }) => {
    let sent: Record<string, unknown> | null = null;
    await page.route('**/api/admin/equipment', (r) => {
      if (r.request().method() !== 'POST') return r.fallback();
      sent = (r.request().postDataJSON() as { item: Record<string, unknown> }).item;
      return r.fulfill({ status: 201, json: { item: { id: 'eq9', ...sent, active: true } } });
    });

    await adminLogin(page);
    await page.getByTestId('nav-equipment').click();
    await page.getByTestId('new-equipment').click();

    await page.getByTestId('eq-name').fill('Cable XLR 10m');
    await page.getByTestId('eq-category').fill('Cables');
    await page.getByTestId('eq-quantity').fill('8');
    await page.getByTestId('eq-notes').fill('dos están medio flojos');
    await page.getByTestId('save-equipment').click();

    await expect.poll(() => sent).not.toBeNull();
    expect(sent).toEqual({ name: 'Cable XLR 10m', category: 'Cables', quantity: 8, notes: 'dos están medio flojos' });
  });

  test('retires gear instead of deleting it (POST /equipment/:id/retire)', async ({ page }) => {
    let retired = false;
    await page.route('**/api/equipment/eq1/retire', (r) => {
      retired = true;
      return r.fulfill({ status: 200, json: { item: { ...INVENTORY[0], active: false } } });
    });

    await adminLogin(page);
    await page.getByTestId('nav-equipment').click();
    await page.getByTestId('equipment-row').filter({ hasText: 'Pearl Export' }).click();

    await page.getByTestId('retire-equipment-eq1').click();
    await page.getByTestId('retire-equipment-eq1-confirm').click();

    await expect.poll(() => retired).toBe(true);
  });
});

test.describe('Equipo — per-event list', () => {
  test.beforeEach(async ({ page }) => {
    await setupEquipment(page);
    await page.route('**/api/events/ev1/equipment', (r) => {
      if (r.request().method() !== 'GET') return r.fallback();
      return r.fulfill({ status: 200, json: { equipment: EVENT_LIST } });
    });
  });

  test('saves the multiselect with per-item quantities (PUT /events/:id/equipment)', async ({ page }) => {
    let sent: { items: { equipment_item_id: string; quantity: number }[] } | null = null;
    await page.route('**/api/events/ev1/equipment', (r) => {
      if (r.request().method() !== 'PUT') return r.fallback();
      sent = r.request().postDataJSON() as { items: { equipment_item_id: string; quantity: number }[] };
      return r.fulfill({ status: 200, json: { equipment: EVENT_LIST } });
    });

    await adminLogin(page);
    await page.getByTestId('nav-equipment').click();
    await page.getByTestId('tab-event').click();

    // The mic is already on the list (4 of the 6 we own); add the drumset too.
    await expect(page.getByTestId('pick-eq2')).toBeChecked();
    await expect(page.getByTestId('qty-eq2')).toHaveValue('4');
    await page.getByTestId('pick-eq1').check();
    await page.getByTestId('save-event-equipment').click();

    await expect.poll(() => sent).not.toBeNull();
    const items = sent!.items;
    expect(items).toContainEqual({ equipment_item_id: 'eq2', quantity: 4 });
    expect(items).toContainEqual({ equipment_item_id: 'eq1', quantity: 1 });
  });

  test('retired gear cannot be added to a new list', async ({ page }) => {
    await adminLogin(page);
    await page.getByTestId('nav-equipment').click();
    await page.getByTestId('tab-event').click();

    // eq3 is retired and not on this event's list, so it is not offered at all.
    await expect(page.getByTestId('pick-eq3')).toHaveCount(0);
    await expect(page.getByTestId('pick-eq1')).toBeVisible();
  });
});

test.describe('Equipo — venue checklist', () => {
  test.beforeEach(async ({ page }) => {
    await setupEquipment(page);
    await page.route('**/api/events/ev1/equipment', (r) =>
      r.fulfill({ status: 200, json: { equipment: EVENT_LIST } }));
  });

  test('ticks the van-out leg and saves it (PUT /event-equipment/:id)', async ({ page }) => {
    let sent: Record<string, unknown> | null = null;
    await page.route('**/api/event-equipment/ee1', (r) => {
      sent = r.request().postDataJSON() as Record<string, unknown>;
      return r.fulfill({
        status: 200,
        json: { line: { id: 'ee1', packed_at: '2026-12-31T18:00:00Z', returned_at: null } },
      });
    });

    await adminLogin(page);
    await page.goto('/admin/equipo/checklist?event=ev1');

    await expect(page.getByTestId('checklist-progress')).toContainText('0/1 cargados');
    await expect(page.getByTestId('checklist-row')).toHaveCount(1);
    await expect(page.getByTestId('checklist-qty')).toContainText('4×');

    await page.getByTestId('packed-ee1').click();

    await expect.poll(() => sent).toEqual({ packed: true });
    await expect(page.getByTestId('packed-ee1')).toHaveAttribute('data-on', 'true');
    await expect(page.getByTestId('checklist-progress')).toContainText('1/1 cargados');
  });

  test('a failed save reverts the tick instead of lying about it', async ({ page }) => {
    await page.route('**/api/event-equipment/ee1', (r) => r.fulfill({ status: 500, json: {} }));

    await adminLogin(page);
    await page.goto('/admin/equipo/checklist?event=ev1');
    await page.getByTestId('returned-ee1').click();

    await expect(page.getByTestId('checklist-error')).toBeVisible();
    await expect(page.getByTestId('returned-ee1')).toHaveAttribute('data-on', 'false');
    await expect(page.getByTestId('checklist-progress')).toContainText('0/1 devueltos');
  });
});
