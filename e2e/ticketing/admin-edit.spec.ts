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

  await page.route('**/api/auth/login', (r) =>
    r.fulfill({ status: 200, json: { token: 'jwt_test', user: { id: 'u1', email: 'a@b.com', name: 'A', role: 'admin' } } })
  );

  // Hydration: load the event by slug.
  await page.route('**/api/events/disco-night', (r) => r.fulfill({ status: 200, json: { event: EVENT } }));

  // The ONE transactional save endpoint — capture the payload, return ok + no warnings.
  await page.route('**/api/events/ev-basilica/layout', (r) => {
    const req = r.request();
    calls.push({ method: req.method(), path: new URL(req.url()).pathname, body: req.postData() ?? '' });
    return r.fulfill({ status: 200, json: { ok: true, slug: 'disco-night', warnings: [] } });
  });

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

test('saving an edit sends ONE transactional layout request with the whole layout', async ({ page }) => {
  const calls = await setup(page);
  await page.goto('/admin/editar?slug=disco-night');
  await login(page);
  await expect(page.getByTestId('input-event-name')).toHaveValue('Disco Night');

  await page.getByTestId('btn-publish').click();
  await expect(page.getByText('Cambios guardados')).toBeVisible();

  // EXACTLY ONE request — no per-table fan-out, no 18-request client orchestration.
  expect(calls).toHaveLength(1);
  expect(calls[0].method).toBe('PUT');
  expect(calls[0].path).toBe('/api/events/ev-basilica/layout');

  const body = JSON.parse(calls[0].body);
  expect(body.event.name).toBe('Disco Night');
  expect(body.event.status).toBe('published'); // toggle left on "Publicado"
  // the section + its two tables + bundles all travel in the single payload, keyed by id
  expect(body.sections).toHaveLength(1);
  expect(body.sections[0].id).toBe('sec-mesas');
  expect(body.sections[0].tables.map((t: { id: string }) => t.id).sort()).toEqual(['t1', 't2']);
  expect(body.sections[0].price_bundles).toHaveLength(2);
});

test('toggling to Borrador sends the same single request with status draft', async ({ page }) => {
  const calls = await setup(page);
  await page.goto('/admin/editar?slug=disco-night');
  await login(page);
  await expect(page.getByTestId('input-event-name')).toHaveValue('Disco Night');

  await page.getByTestId('btn-toggle-publish').click();
  await expect(page.getByTestId('btn-toggle-publish')).toContainText('Borrador');
  await page.getByTestId('btn-publish').click();
  await expect(page.getByText('Cambios guardados')).toBeVisible();

  expect(calls).toHaveLength(1);
  expect(JSON.parse(calls[0].body).event.status).toBe('draft');
});
