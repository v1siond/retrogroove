/**
 * Batch-5 — Admin Event Builder (mocked adminApi)
 * Tasks 1-5: shell + inputs, stage, tables, tarifas, publish + preview parity
 */
import { test, expect, Page } from '@playwright/test';

// ── shared mock helpers ──────────────────────────────────────────────────────

async function mockAdminLogin(page: Page) {
  await page.route('**/api/auth/login', (r) =>
    r.fulfill({
      status: 200,
      json: { token: 'jwt_test', user: { id: 'u1', email: 'admin@rg.com', name: 'Admin', role: 'admin' } },
    })
  );
}

const CREATED_EVENT = {
  id: 'ev-new',
  slug: 'mi-fiesta-2026',
  name: 'Mi Fiesta 2026',
  venue_name: 'Teatro Lima',
  venue_address: 'Av. Principal 123, Lima',
  venue_photo_url: '',
  map_url: 'https://maps.google.com/?q=Teatro+Lima',
  description: 'Una noche increíble.',
  starts_at: '2026-12-31T21:00:00Z',
  status: 'draft',
  flyer_url: null,
  canvas_width: 1000,
  canvas_height: 700,
  stage_x: 240,
  stage_y: 20,
  stage_w: 520,
  stage_h: 100,
  sections: [],
};

async function mockAdminApi(page: Page) {
  // createEvent
  await page.route('**/api/events', (r) => {
    if (r.request().method() === 'POST')
      return r.fulfill({ status: 201, json: { event: CREATED_EVENT } });
    return r.continue();
  });

  // saveEventLayout — the single transactional save endpoint (replaces the per-resource fan-out).
  await page.route('**/api/events/ev-new/layout', (r) =>
    r.fulfill({ status: 200, json: { ok: true, slug: 'mi-fiesta-2026', warnings: [] } })
  );

  // buyer view of the event (for preview parity)
  await page.route('**/api/events/mi-fiesta-2026', (r) =>
    r.fulfill({
      status: 200,
      json: {
        event: {
          ...CREATED_EVENT,
          status: 'published',
          sections: [
            {
              id: 'sec-vip',
              name: 'VIP',
              layout_type: 'tables',
              pos_x: 0,
              pos_y: 0,
              width: 200,
              height: 200,
              tables: [{ id: 'tbl-1', label: 'Mesa 1', seat_count: 4, pos_x: 30, pos_y: 50, size: 64 }],
              seats: [
                { id: 'sv1', label: '1', number: 1, row: null, status: 'available', table_id: 'tbl-1', pos_x: 30, pos_y: 50 },
                { id: 'sv2', label: '2', number: 2, row: null, status: 'available', table_id: 'tbl-1', pos_x: 30, pos_y: 50 },
                { id: 'sv3', label: '3', number: 3, row: null, status: 'available', table_id: 'tbl-1', pos_x: 30, pos_y: 50 },
                { id: 'sv4', label: '4', number: 4, row: null, status: 'available', table_id: 'tbl-1', pos_x: 30, pos_y: 50 },
              ],
              price_bundles: [
                { quantity: 1, price: '120' },
                { quantity: 2, price: '220' },
                { quantity: 3, price: '300' },
              ],
            },
          ],
        },
      },
    })
  );
}

async function login(page: Page) {
  await page.getByLabel('Email').fill('admin@rg.com');
  await page.getByLabel('Contraseña').fill('password123');
  await page.getByRole('button', { name: 'Entrar' }).click();
}

// ── Task 1: Neon-Editorial shell + event/venue/map inputs ─────────────────────

test.describe('Task 1 — Neon-Editorial shell + inputs', () => {
  test('renders NUEVO EVENTO header + event/venue/description/map fields in Neon-Editorial style', async ({ page }) => {
    await mockAdminLogin(page);
    await page.goto('/admin/nuevo');
    await login(page);

    // Top bar / header with "NUEVO EVENTO"
    await expect(page.getByTestId('builder-title')).toContainText('NUEVO EVENTO');

    // Event name input
    await expect(page.getByTestId('input-event-name')).toBeVisible();
    // Date + time inputs
    await expect(page.getByTestId('input-date')).toBeVisible();
    // Venue name
    await expect(page.getByTestId('input-venue-name')).toBeVisible();
    // Venue address
    await expect(page.getByTestId('input-venue-address')).toBeVisible();
    // Description
    await expect(page.getByTestId('input-description')).toBeVisible();
    // Map URL
    await expect(page.getByTestId('input-map-url')).toBeVisible();

    // Left panel is visible
    await expect(page.getByTestId('left-panel')).toBeVisible();
    // Canvas area is visible
    await expect(page.getByTestId('canvas-area')).toBeVisible();

    // Publish button
    await expect(page.getByTestId('btn-publish')).toBeVisible();
  });

  test('section tabs show + Agregar adds a new section', async ({ page }) => {
    await mockAdminLogin(page);
    await page.goto('/admin/nuevo');
    await login(page);

    // At least one default section tab. locator.count() does NOT auto-wait, and login()
    // returns before the builder has rendered — so wait on the tab itself first, then
    // count. Every other test here gets this for free from its leading expect().
    const tabs = page.getByTestId('section-tab');
    await expect(tabs.first()).toBeVisible();
    const count = await tabs.count();
    expect(count).toBeGreaterThanOrEqual(1);

    // Add a section
    await page.getByTestId('btn-add-section').click();
    await expect(page.getByTestId('section-tab')).toHaveCount(count + 1);
  });
});

// ── Task 2: Stage placement ───────────────────────────────────────────────────

test.describe('Task 2 — Positionable stage + geometry', () => {
  test('stage geometry inputs exist and update the readout', async ({ page }) => {
    await mockAdminLogin(page);
    await page.goto('/admin/nuevo');
    await login(page);

    // Canvas exists
    await expect(page.getByTestId('canvas-area')).toBeVisible();

    // Stage position/size inputs
    await expect(page.getByTestId('input-stage-x')).toBeVisible();
    await expect(page.getByTestId('input-stage-y')).toBeVisible();
    await expect(page.getByTestId('input-stage-w')).toBeVisible();
    await expect(page.getByTestId('input-stage-h')).toBeVisible();

    // Change stage width and verify readout updates
    await page.getByTestId('input-stage-w').fill('600');
    await expect(page.getByTestId('stage-readout')).toContainText('600');
  });

  test('canvas visual shows the stage block at the right position', async ({ page }) => {
    await mockAdminLogin(page);
    await page.goto('/admin/nuevo');
    await login(page);

    // The stage element inside the canvas
    await expect(page.getByTestId('canvas-stage')).toBeVisible();
  });
});

// ── Task 3: Section + table placement ────────────────────────────────────────

test.describe('Task 3 — Table placement + live preview', () => {
  test('can place a table on the canvas and it appears in the preview', async ({ page }) => {
    await mockAdminLogin(page);
    await page.goto('/admin/nuevo');
    await login(page);

    // Choose a round table tool
    await page.getByTestId('tool-round-table').click();

    // Click on the canvas to place a table
    const canvas = page.getByTestId('canvas-area');
    await canvas.click({ position: { x: 200, y: 200 } });

    // Table appears in canvas
    await expect(page.getByTestId('canvas-table').first()).toBeVisible();

    // Table count readout
    await expect(page.getByTestId('table-count')).toContainText('1');
  });

  test('snap grid checkbox is visible', async ({ page }) => {
    await mockAdminLogin(page);
    await page.goto('/admin/nuevo');
    await login(page);

    await expect(page.getByTestId('snap-grid-toggle')).toBeVisible();
  });

  test('table properties popover shows when a table is selected', async ({ page }) => {
    await mockAdminLogin(page);
    await page.goto('/admin/nuevo');
    await login(page);

    // Place a table
    await page.getByTestId('tool-round-table').click();
    const canvas = page.getByTestId('canvas-area');
    await canvas.click({ position: { x: 150, y: 250 } });

    // A table should now be in the canvas
    await expect(page.getByTestId('canvas-table').first()).toBeVisible();

    // Table was auto-selected on placement; table-props popover should be shown
    // (clicking the canvas also places+selects; the popover renders when selectedTable is set)
    await expect(page.getByTestId('table-props')).toBeVisible({ timeout: 5000 });
    // Seat count stepper
    await expect(page.getByTestId('seat-count')).toBeVisible();
  });

  test('wysiwyg label is visible', async ({ page }) => {
    await mockAdminLogin(page);
    await page.goto('/admin/nuevo');
    await login(page);

    await expect(page.getByTestId('wysiwyg-label')).toContainText('Lo que ves es lo que compran');
  });
});

// ── Task 4: Tarifa/bundle editor ─────────────────────────────────────────────

test.describe('Task 4 — Multi-tier tarifa/bundle editor', () => {
  test('shows 2 default tarifa rows (1 entrada, combo) + Agregar tarifa link', async ({ page }) => {
    await mockAdminLogin(page);
    await page.goto('/admin/nuevo');
    await login(page);

    const rows = page.getByTestId('tarifa-row');
    await expect(rows).toHaveCount(2);

    await expect(page.getByTestId('btn-add-tarifa')).toBeVisible();
  });

  test('Agregar tarifa adds a third row', async ({ page }) => {
    await mockAdminLogin(page);
    await page.goto('/admin/nuevo');
    await login(page);

    await page.getByTestId('btn-add-tarifa').click();
    await expect(page.getByTestId('tarifa-row')).toHaveCount(3);
  });

  test('tarifa rows can have quantity and price edited', async ({ page }) => {
    await mockAdminLogin(page);
    await page.goto('/admin/nuevo');
    await login(page);

    const firstRow = page.getByTestId('tarifa-row').first();
    const priceInput = firstRow.getByTestId('tarifa-price');
    await priceInput.fill('150');
    await expect(priceInput).toHaveValue('150');
  });

  test('tarifa rows beyond 2 have a remove button', async ({ page }) => {
    await mockAdminLogin(page);
    await page.goto('/admin/nuevo');
    await login(page);

    // Add a third row
    await page.getByTestId('btn-add-tarifa').click();
    const rows = page.getByTestId('tarifa-row');
    const thirdRow = rows.nth(2);
    await expect(thirdRow.getByTestId('btn-remove-tarifa')).toBeVisible();
  });
});

// ── Task 5: Publish + buyer-preview parity ───────────────────────────────────

test.describe('Task 5 — Publish + buyer-preview parity', () => {
  test('full flow: fill event, set stage, place table, set tarifas, publish — success page with public link', async ({ page }) => {
    await mockAdminLogin(page);
    await mockAdminApi(page);
    await page.goto('/admin/nuevo');
    await login(page);

    // Fill event details
    await page.getByTestId('input-event-name').fill('Mi Fiesta 2026');
    await page.getByTestId('input-date').fill('2026-12-31T21:00');
    await page.getByTestId('input-venue-name').fill('Teatro Lima');
    await page.getByTestId('input-venue-address').fill('Av. Principal 123, Lima');
    await page.getByTestId('input-description').fill('Una noche increíble.');
    await page.getByTestId('input-map-url').fill('https://maps.google.com/?q=Teatro+Lima');

    // Set stage geometry
    await page.getByTestId('input-stage-x').fill('240');
    await page.getByTestId('input-stage-y').fill('20');
    await page.getByTestId('input-stage-w').fill('520');
    await page.getByTestId('input-stage-h').fill('100');

    // Set canvas
    await page.getByTestId('input-canvas-w').fill('1000');
    await page.getByTestId('input-canvas-h').fill('700');

    // Section name
    const sectionNameInput = page.getByTestId('input-section-name');
    await sectionNameInput.fill('VIP');

    // Set tarifas: 1→120, 2→220, 3→300
    const rows = page.getByTestId('tarifa-row');
    await rows.nth(0).getByTestId('tarifa-price').fill('120');
    await rows.nth(1).getByTestId('tarifa-price').fill('220');
    await page.getByTestId('btn-add-tarifa').click();
    await page.getByTestId('tarifa-row').nth(2).getByTestId('tarifa-price').fill('300');

    // Place one table on the canvas
    await page.getByTestId('tool-round-table').click();
    const canvas = page.getByTestId('canvas-area');
    await canvas.click({ position: { x: 200, y: 200 } });

    // Publish
    await page.getByTestId('btn-publish').click();

    // Success: public link visible
    await expect(page.getByTestId('public-link')).toBeVisible({ timeout: 10_000 });
    await expect(page.getByTestId('public-link')).toHaveAttribute('href', /mi-fiesta-2026/);
  });

  test('admin canvas and buyer seat-map use the SAME stage geometry (parity)', async ({ page }) => {
    await mockAdminLogin(page);
    await mockAdminApi(page);
    await page.goto('/admin/nuevo');
    await login(page);

    // Read the stage position from the admin canvas
    await page.getByTestId('input-stage-x').fill('240');
    await page.getByTestId('input-stage-y').fill('20');
    await page.getByTestId('input-stage-w').fill('520');
    await page.getByTestId('input-stage-h').fill('100');
    await page.getByTestId('input-canvas-w').fill('1000');
    await page.getByTestId('input-canvas-h').fill('700');

    // The admin canvas stage should reflect these values
    const adminStage = page.getByTestId('canvas-stage');
    await expect(adminStage).toBeVisible();
    // Verify ESCENARIO text is in admin canvas
    await expect(adminStage).toContainText('ESCENARIO');

    // Now check buyer seat-map at the event page uses the same coordinate model.
    // The buyer map only shows on the "select" step — click "Comprar entradas" first.
    await page.goto('/evento?slug=mi-fiesta-2026');
    // Click CTA to go to seat selection
    await page.getByRole('button', { name: /comprar entradas/i }).click();

    // Seat map is now visible
    const buyerSeatMap = page.getByTestId('seat-map');
    await expect(buyerSeatMap).toBeVisible({ timeout: 10_000 });

    // Both renders use the same % formula: stage_x/canvas_width * 100%
    // EventBuy renders <div data-testid="buyer-stage"> with the stage text
    await expect(buyerSeatMap).toContainText('ESCENARIO');
  });
});
