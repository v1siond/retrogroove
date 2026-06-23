import { test, expect, Page } from '@playwright/test';
import { mockEvent } from './fixtures';

// Admin dashboard: lists all events, drills into a single event's orders +
// tickets, and supports editing/deleting. All endpoints are mocked to the
// agreed backend contract.

async function mockLogin(page: Page) {
  await page.route('**/api/auth/login', (r) =>
    r.fulfill({
      status: 200,
      json: { token: 'jwt_test', user: { id: 'u1', email: 'admin@retrogroove.com', name: 'Admin', role: 'admin' } },
    })
  );
}

async function login(page: Page) {
  await page.goto('/admin');
  await page.getByLabel('Email').fill('admin@retrogroove.com');
  await page.getByLabel('Contraseña').fill('password123');
  await page.getByRole('button', { name: 'Entrar' }).click();
}

async function mockDashboard(page: Page) {
  // ** swallows the ?filter=active query the panel now sends.
  await page.route('**/api/admin/events**', (r) =>
    r.fulfill({
      status: 200,
      json: {
        events: [
          { id: 'ev1', slug: 'gala-2026', name: 'Gala 2026', status: 'published', starts_at: '2026-12-31T21:00:00Z', venue_name: 'Teatro Municipal' },
          { id: 'ev2', slug: 'verano-2027', name: 'Verano 2027', status: 'draft', starts_at: '2027-02-14T22:00:00Z', venue_name: 'La Basílica' },
        ],
      },
    })
  );

  await page.route('**/api/events/ev1/orders', (r) =>
    r.fulfill({
      status: 200,
      json: {
        orders: [
          {
            id: 'ord1', status: 'paid', total: '70', buyer_email: 'fan@example.com',
            buyer_first_name: 'Juan', buyer_last_name: 'Pérez', payment_ref: 'IZP-123',
            paid_at: '2026-12-01T10:00:00Z', inserted_at: '2026-12-01T09:55:00Z', ticket_count: 2,
          },
          {
            id: 'ord2', status: 'pending', total: '40', buyer_email: 'maria@example.com',
            buyer_first_name: null, buyer_last_name: null, payment_ref: null,
            paid_at: null, inserted_at: '2026-12-02T11:00:00Z', ticket_count: 1,
          },
        ],
      },
    })
  );

  await page.route('**/api/events/ev1/tickets', (r) =>
    r.fulfill({
      status: 200,
      json: {
        tickets: [
          { code: 'RG-AAA', public_token: 'tokA', status: 'valid', checked_in_at: null, buyer_email: 'fan@example.com', seat_label: 'Mesa 1 · Asiento 1' },
          { code: 'RG-BBB', public_token: 'tokB', status: 'used', checked_in_at: '2026-12-31T22:10:00Z', buyer_email: 'fan@example.com', seat_label: 'Mesa 1 · Asiento 2' },
        ],
      },
    })
  );

  // Edit form seeds from the full event record.
  await page.route('**/api/events/gala-2026', (r) =>
    r.fulfill({ status: 200, json: { event: mockEvent } })
  );
}

test.describe('Admin dashboard', () => {
  test.beforeEach(async ({ page }) => {
    await mockLogin(page);
    await mockDashboard(page);
  });

  test('requires login before showing the dashboard', async ({ page }) => {
    await page.goto('/admin');
    await expect(page.getByRole('button', { name: 'Entrar' })).toBeVisible();
  });

  test('lists all events and drills into orders and tickets', async ({ page }) => {
    await login(page);

    // Event list
    const list = page.getByTestId('events-list');
    await expect(list).toContainText('Gala 2026');
    await expect(list).toContainText('Verano 2027');
    await expect(page.getByTestId('event-item')).toHaveCount(2);

    // Drill into the first event
    await page.getByTestId('event-item').first().click();
    await expect(page.getByTestId('event-detail')).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Gala 2026' })).toBeVisible();

    // Orders panel: 2 orders, buyer + total + status
    await expect(page.getByTestId('order-row')).toHaveCount(2);
    const orders = page.getByTestId('event-orders-panel');
    await expect(orders).toContainText('Juan Pérez');
    await expect(orders).toContainText('S/ 70');
    await expect(orders).toContainText('IZP-123');
    await expect(orders).toContainText('maria@example.com');

    // Tickets panel: 2 tickets, code + status + check-in
    await expect(page.getByTestId('ticket-row')).toHaveCount(2);
    const tickets = page.getByTestId('event-tickets-panel');
    await expect(tickets).toContainText('RG-AAA');
    await expect(tickets).toContainText('RG-BBB');

    // Edit form seeded with the event name
    await expect(page.getByTestId('edit-form')).toBeVisible();
    await expect(page.getByLabel('Nombre')).toHaveValue('Gala 2026');

    // Back to the list
    await page.getByRole('button', { name: /todos los eventos/i }).click();
    await expect(page.getByTestId('events-list')).toBeVisible();
  });

  test('edits an event via updateEvent (PUT)', async ({ page }) => {
    let putBody: unknown = null;
    await page.route('**/api/events/ev1', async (route) => {
      if (route.request().method() !== 'PUT') return route.fallback();
      putBody = route.request().postDataJSON();
      await route.fulfill({ status: 200, json: { event: { ...mockEvent, name: 'Gala 2026 — Edición' } } });
    });

    await login(page);
    await page.getByTestId('event-item').first().click();
    await expect(page.getByTestId('edit-form')).toBeVisible();

    await page.getByLabel('Nombre').fill('Gala 2026 — Edición');
    await page.getByLabel('Lugar (venue)').fill('Nuevo Local');
    await page.getByRole('button', { name: /guardar cambios/i }).click();

    await expect(page.getByText('Guardado.')).toBeVisible();
    expect((putBody as { event?: { name?: string } })?.event?.name).toBe('Gala 2026 — Edición');
  });

  test('deletes an event with confirmation (DELETE) and returns to the list', async ({ page }) => {
    let deleted = false;
    await page.route('**/api/events/ev1', async (route) => {
      if (route.request().method() !== 'DELETE') return route.fallback();
      deleted = true;
      await route.fulfill({ status: 204, body: '' });
    });

    await login(page);
    await page.getByTestId('event-item').first().click();

    // Confirm step required
    await page.getByTestId('delete-event').click();
    await page.getByTestId('delete-event-confirm').click();

    await expect(page.getByTestId('events-list')).toBeVisible();
    expect(deleted).toBe(true);
  });
});
