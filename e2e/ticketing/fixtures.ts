import { Page } from '@playwright/test';

export const mockEvent = {
  id: 'ev1',
  slug: 'gala-2026',
  name: 'Gala 2026',
  description: 'Noche de gala',
  venue_name: 'Teatro Municipal',
  starts_at: '2026-12-31T21:00:00Z',
  status: 'published',
  flyer_url: null,
  canvas_width: 1000,
  canvas_height: 700,
  sections: [
    {
      id: 'sec1',
      name: 'VIP',
      layout_type: 'tables',
      pos_x: 0,
      pos_y: 0,
      width: 200,
      height: 200,
      tables: [],
      seats: [
        { id: 's1', label: '1', number: 1, row: null, status: 'available', table_id: null, pos_x: 0, pos_y: 0 },
        { id: 's2', label: '2', number: 2, row: null, status: 'available', table_id: null, pos_x: 0, pos_y: 0 },
      ],
      price_bundles: [
        { quantity: 1, price: '40' },
        { quantity: 2, price: '70' },
      ],
    },
  ],
};

function ticket(id: string, token: string, seat: string) {
  return {
    id,
    code: 'CODE' + id,
    public_token: token,
    status: 'valid',
    qr_svg: '<svg data-qr="1"><rect/></svg>',
    checked_in_at: null,
    seat_id: seat,
  };
}

interface Opts {
  ordersFail?: boolean;
  soldSeat?: string;
}

export async function setupTicketingMocks(page: Page, opts: Opts = {}) {
  const event = JSON.parse(JSON.stringify(mockEvent));
  if (opts.soldSeat) {
    const seat = event.sections[0].seats.find((s: { id: string }) => s.id === opts.soldSeat);
    if (seat) seat.status = 'sold';
  }

  await page.route('**/api/events/gala-2026', async (route) => {
    await route.fulfill({ status: 200, json: { event } });
  });

  await page.route('**/api/orders', async (route) => {
    if (opts.ordersFail) {
      await route.fulfill({ status: 422, json: { error: 'seats_unavailable', seat_ids: ['s1'] } });
      return;
    }
    await route.fulfill({
      status: 201,
      json: {
        order: {
          id: 'ord1',
          status: 'pending',
          total: '70',
          buyer_email: 'fan@example.com',
          buyer_first_name: null,
          buyer_last_name: null,
          expires_at: '2026-12-31T21:15:00Z',
          tickets: [],
        },
      },
    });
  });

  await page.route('**/api/orders/ord1/pay', async (route) => {
    await route.fulfill({
      status: 200,
      json: {
        order: {
          id: 'ord1',
          status: 'paid',
          total: '70',
          buyer_email: 'fan@example.com',
          buyer_first_name: 'Juan',
          buyer_last_name: 'Pérez',
          expires_at: null,
          tickets: [ticket('t1', 'tok1', 's1'), ticket('t2', 'tok2', 's2')],
        },
      },
    });
  });

  await page.route('**/api/tickets/tok1', async (route) => {
    await route.fulfill({ status: 200, json: { ticket: ticket('t1', 'tok1', 's1') } });
  });
}
