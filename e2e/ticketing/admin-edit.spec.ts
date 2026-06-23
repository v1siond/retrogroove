/**
 * Admin event EDIT flow — /admin/editar?slug=… loads an existing event
 * into the shared builder and saves by rebuilding the layout (mocked adminApi).
 */
import { test, expect, Page } from '@playwright/test';

const EVENT = {
  id: 'ev-basilica',
  slug: 'disco-night',
  name: 'Disco Night',
  description: 'Una noche disco.',
  venue_name: 'La Basílica 640',
  venue_address: 'Av. Primavera 640, Surco',
  venue_photo_url: null,
  map_url: 'https://maps.app.goo.gl/abc',
  starts_at: '2026-08-07T02:00:00Z',
  status: 'published',
  flyer_url: null,
  external_url: null,
  instagram_url: null,
  canvas_width: 1000,
  canvas_height: 700,
  stage_x: 360,
  stage_y: 40,
  stage_w: 280,
  stage_h: 70,
  sections: [
    {
      id: 'sec-mesas',
      name: 'Mesas',
      layout_type: 'tables',
      capacity: 76,
      pos_x: 0,
      pos_y: 0,
      width: 1000,
      height: 700,
      seats: [],
      tables: [
        { id: 't1', label: 'P1', pos_x: 42, pos_y: 29, size: 70, seat_count: 2, shape: 'round', seating: 'around' },
        { id: 't2', label: 'M1', pos_x: 16, pos_y: 53, size: 110, seat_count: 7, shape: 'round', seating: 'around' },
      ],
      price_bundles: [
        { quantity: 1, price: '40' },
        { quantity: 2, price: '70' },
      ],
    },
  ],
};

interface Call {
  method: string;
  path: string;
  body: string;
}

async function setup(page: Page): Promise<Call[]> {
  const calls: Call[] = [];
  const record = (r: import('@playwright/test').Route, json: unknown) => {
    const req = r.request();
    calls.push({ method: req.method(), path: new URL(req.url()).pathname, body: req.postData() ?? '' });
    return r.fulfill({ status: 200, json: json as object });
  };

  await page.route('**/api/auth/login', (r) =>
    r.fulfill({ status: 200, json: { token: 'jwt_test', user: { id: 'u1', email: 'a@b.com', name: 'A', role: 'admin' } } })
  );

  // Load the event (by slug). Keep this BEFORE the id-based routes; specific paths don't collide.
  await page.route('**/api/events/disco-night', (r) => record(r, { event: EVENT }));

  // Save-path endpoints (edit rebuild).
  await page.route('**/api/events/ev-basilica', (r) => record(r, { event: { ...EVENT, status: 'draft' } }));
  await page.route('**/api/events/ev-basilica/publish', (r) => record(r, { event: EVENT }));
  await page.route('**/api/events/ev-basilica/price-bundles', (r) =>
    record(r, { price_bundles: [{ id: 'b1', quantity: 1, price: '40' }, { id: 'b2', quantity: 2, price: '70' }] })
  );
  await page.route('**/api/events/ev-basilica/phases', (r) => record(r, { phases: [{ id: 'ph-1', name: 'Preventa' }] }));
  await page.route('**/api/tables/*', (r) => record(r, { data: { id: 'ok' } }));
  await page.route('**/api/price-bundles/*', (r) => record(r, {}));
  await page.route('**/api/sections/sec-mesas', (r) => record(r, { data: { id: 'sec-mesas' } }));
  await page.route('**/api/sections/sec-mesas/tables', (r) => record(r, { data: { id: 'new-tbl' } }));
  await page.route('**/api/sections/sec-mesas/price-bundles', (r) => record(r, { data: { id: 'new-bnd' } }));

  return calls;
}

async function login(page: Page) {
  await page.getByLabel('Email').fill('a@b.com');
  await page.getByLabel('Contraseña').fill('pw');
  await page.getByRole('button', { name: 'Entrar' }).click();
}

test('editar hydrates the event into the builder', async ({ page }) => {
  await setup(page);
  await page.goto('/admin/editar?slug=disco-night');
  await login(page);

  await expect(page.getByTestId('builder-title')).toHaveText('EDITAR EVENTO');
  await expect(page.getByTestId('input-event-name')).toHaveValue('Disco Night');
  await expect(page.getByTestId('input-date')).toHaveValue('2026-08-06T21:00');
  await expect(page.getByTestId('btn-toggle-publish')).toContainText('Publicado');
  await expect(page.getByTestId('btn-publish')).toHaveText('GUARDAR CAMBIOS');
  // pricing tiers hydrated
  await expect(page.getByText('S/ 40').first()).toBeVisible();
});

test('saving an edit rebuilds the layout (update + tear-down + recreate + publish)', async ({ page }) => {
  const calls = await setup(page);
  await page.goto('/admin/editar?slug=disco-night');
  await login(page);
  await expect(page.getByTestId('input-event-name')).toHaveValue('Disco Night');

  await page.getByTestId('btn-publish').click();
  await expect(page.getByText('Cambios guardados')).toBeVisible();

  const by = (m: string, re: RegExp) => calls.filter((c) => c.method === m && re.test(c.path));
  // event fields updated
  expect(by('PUT', /\/events\/ev-basilica$/).length).toBeGreaterThanOrEqual(1);
  // old layout torn down: both original tables + both original bundles deleted
  expect(by('DELETE', /\/tables\//).length).toBe(2);
  expect(by('DELETE', /\/price-bundles\//).length).toBe(2);
  // recreated from builder state: 2 tables + 2 bundles
  expect(by('POST', /\/sections\/sec-mesas\/tables$/).length).toBe(2);
  expect(by('POST', /\/sections\/sec-mesas\/price-bundles$/).length).toBe(2);
  // kept section updated, and event published (toggle left on "Publicado")
  expect(by('PUT', /\/sections\/sec-mesas$/).length).toBe(1);
  expect(by('POST', /\/events\/ev-basilica\/publish$/).length).toBe(1);
});

test('toggling to Borrador saves the event as draft, no publish call', async ({ page }) => {
  const calls = await setup(page);
  await page.goto('/admin/editar?slug=disco-night');
  await login(page);
  await expect(page.getByTestId('input-event-name')).toHaveValue('Disco Night');

  await page.getByTestId('btn-toggle-publish').click();
  await expect(page.getByTestId('btn-toggle-publish')).toContainText('Borrador');
  await page.getByTestId('btn-publish').click();
  await expect(page.getByText('Cambios guardados')).toBeVisible();

  // no publish call; instead a PUT carrying status: draft
  expect(calls.filter((c) => c.method === 'POST' && /\/publish$/.test(c.path)).length).toBe(0);
  expect(calls.some((c) => c.method === 'PUT' && /\/events\/ev-basilica$/.test(c.path) && c.body.includes('draft'))).toBe(true);
});
