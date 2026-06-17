import { Page } from '@playwright/test';

export const mockEvent = {
  id: 'ev1',
  slug: 'gala-2026',
  name: 'Gala 2026',
  description: 'Noche de gala con música en vivo y ambiente retro.',
  venue_name: 'Teatro Municipal',
  venue_address: 'Av. La Rosa Toro 1234, San Borja, Lima',
  venue_photo_url: null,
  map_url: 'https://maps.google.com/?q=Arena+1',
  starts_at: '2026-12-31T21:00:00Z',
  status: 'published',
  flyer_url: null,
  canvas_width: 1000,
  canvas_height: 700,
  stage_x: 0,
  stage_y: 0,
  stage_w: 1000,
  stage_h: 120,
  sections: [
    {
      id: 'sec1',
      name: 'VIP',
      layout_type: 'tables',
      pos_x: 0,
      pos_y: 0,
      width: 200,
      height: 200,
      tables: [
        { id: 't1', label: 'Mesa 1', seat_count: 2, pos_x: 25, pos_y: 50, size: 56 }
      ],
      seats: [
        { id: 's1', label: '1', number: 1, row: null, status: 'available', table_id: 't1', pos_x: 25, pos_y: 50 },
        { id: 's2', label: '2', number: 2, row: null, status: 'available', table_id: 't1', pos_x: 70, pos_y: 50 },
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
    event_name: 'Gala 2026',
    event_starts_at: '2026-12-31T21:00:00Z',
    seat_label: seat === 's1' ? 'Mesa 1 · Asiento 1' : 'Mesa 1 · Asiento 2',
    section_name: 'VIP',
  };
}

interface Opts {
  ordersFail?: boolean;
  soldSeat?: string;
  noName?: boolean;
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
          buyer_first_name: opts.noName ? null : 'Juan',
          buyer_last_name: opts.noName ? null : 'Pérez',
          expires_at: null,
          tickets: [ticket('t1', 'tok1', 's1'), ticket('t2', 'tok2', 's2')],
        },
      },
    });
  });

  await page.route('**/api/orders/ord1', async (route) => {
    if (route.request().method() === 'PATCH') {
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
    }
  });

  await page.route('**/api/tickets/tok1', async (route) => {
    await route.fulfill({ status: 200, json: { ticket: ticket('t1', 'tok1', 's1') } });
  });
}
