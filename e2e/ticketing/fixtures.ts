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
  external_url: null,
  instagram_url: null,
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

// Songs + setlists served by GET /api/songs and GET /api/setlists.
export const mockSongs = [
  { id: 'take-on-me', title: 'Take on Me', artist: 'a-ha', enabled: true },
  { id: 'i-will-survive', title: 'I Will Survive', artist: 'Gloria Gaynor', enabled: true },
  { id: 'celebration', title: 'Celebration', artist: 'Kool & The Gang', enabled: true },
  // Disabled songs must not appear in the public /pedir picker.
  { id: 'hidden-track', title: 'Hidden Track', artist: 'Nobody', enabled: false },
];

export const mockSetlists = [
  { id: 'bloque-1', name: 'Bloque 1', song_ids: ['take-on-me', 'i-will-survive'] },
  { id: 'extras', name: 'Extras', song_ids: ['celebration'] },
];

export async function setupMusicMocks(page: Page) {
  await page.route('**/api/songs', async (route) => {
    await route.fulfill({ status: 200, json: { songs: mockSongs } });
  });
  await page.route('**/api/setlists', async (route) => {
    await route.fulfill({ status: 200, json: { setlists: mockSetlists } });
  });
}

// Upcoming events for the homepage timeline: one ticketed (has sections → buy
// flow) and one announcement-only (no sections → external link / Instagram).
export const ticketedEvent = {
  ...mockEvent,
  id: 'ev-ticketed',
  slug: 'gala-2026',
  name: 'Gala 2026',
  venue_name: 'Teatro Municipal',
};

export const announcementEvent = {
  ...mockEvent,
  id: 'ev-announce',
  slug: 'cafe-rock',
  name: 'Café Rock',
  venue_name: 'Lince, Lima',
  external_url: 'https://caferock.pe/',
  instagram_url: 'https://www.instagram.com/caferock_lince/',
  sections: [] as typeof mockEvent.sections,
};

export async function setupUpcomingMock(page: Page, events: unknown[]) {
  await page.route('**/api/events/upcoming', async (route) => {
    await route.fulfill({ status: 200, json: { events } });
  });
}

function ticket(id: string, token: string, seat: string) {
  return {
    id,
    code: 'CODE' + id,
    public_token: token,
    status: 'valid',
    qr_svg: '<svg data-qr="1" width="80" height="80" viewBox="0 0 4 4" xmlns="http://www.w3.org/2000/svg">'
      + '<rect width="4" height="4" fill="#FFF"/><rect width="1" height="1" x="0" y="0" fill="#000"/>'
      + '<rect width="1" height="1" x="3" y="3" fill="#000"/></svg>',
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

  // Izipay payment-link: return a fake URL (redirect intercepted by test hook)
  await page.route('**/api/orders/ord1/payment-link', async (route) => {
    await route.fulfill({
      status: 200,
      json: { payment_url: 'https://secure.micuentaweb.pe/t/test-stub' },
    });
  });

  // getOrder (GET) returns paid so the redirect-return / poll flow resolves immediately
  await page.route('**/api/orders/ord1', async (route) => {
    const method = route.request().method();
    if (method === 'GET') {
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
    } else if (method === 'PATCH') {
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

// Resume by ?order=<id> (Izipay return URL with no slug). The order carries its
// event_slug so the page can load the event and show the ticket view. `paid`
// controls whether it lands on the success view or the polling interstitial.
export async function setupOrderResumeMock(page: Page, opts: { paid?: boolean } = {}) {
  const event = JSON.parse(JSON.stringify(mockEvent));
  await page.route('**/api/events/gala-2026', (r) => r.fulfill({ status: 200, json: { event } }));

  await page.route('**/api/orders/ord1', (r) => {
    if (r.request().method() !== 'GET') return r.fallback();
    return r.fulfill({
      status: 200,
      json: {
        order: {
          id: 'ord1',
          status: opts.paid === false ? 'pending' : 'paid',
          total: '70',
          event_slug: 'gala-2026',
          event_name: 'Gala 2026',
          buyer_email: 'fan@example.com',
          buyer_first_name: 'Juan',
          buyer_last_name: 'Pérez',
          expires_at: null,
          tickets: opts.paid === false ? [] : [ticket('t1', 'tok1', 's1'), ticket('t2', 'tok2', 's2')],
        },
      },
    });
  });
}

// ── Admin dashboard mocks (login + global orders/tickets/songs/setlists) ──────

// POST body the comp-orders / manual-ticket endpoint receives.
interface ManualBody {
  buyer: { email: string; first_name?: string; last_name?: string };
  seat_ids?: string[];
  section_id?: string;
  quantity?: number;
}

// Full event for the Issue panel: one reserved (tables) section with two seats
// and one general-admission section.
export const issueEvent = {
  ...mockEvent,
  sections: [
    mockEvent.sections[0], // VIP reserved (seats s1, s2)
    {
      id: 'sec-ga',
      name: 'General',
      layout_type: 'general',
      pos_x: 0, pos_y: 220, width: 200, height: 120,
      tables: [] as never[],
      seats: [] as never[],
      price_bundles: [{ quantity: 1, price: '25' }],
    },
  ],
};

export async function setupAdminLogin(page: Page) {
  await page.route('**/api/auth/login', (r) =>
    r.fulfill({
      status: 200,
      json: { token: 'jwt_test', user: { id: 'u1', email: 'admin@retrogroove.com', name: 'Admin', role: 'admin' } },
    })
  );
}

export async function adminLogin(page: Page) {
  await page.goto('/band/tickets');
  await page.getByLabel('Email').fill('admin@retrogroove.com');
  await page.getByLabel('Contraseña').fill('password123');
  await page.getByRole('button', { name: 'Entrar' }).click();
}

export const adminGlobalOrders = [
  {
    id: 'ord1', event_id: 'ev1', event_name: 'Gala 2026', status: 'paid', total: '70',
    buyer_email: 'fan@example.com', buyer_first_name: 'Juan', buyer_last_name: 'Pérez',
    ticket_count: 2, payment_ref: 'IZP-123', paid_at: '2026-12-01T10:00:00Z', inserted_at: '2026-12-01T09:55:00Z',
  },
  {
    id: 'ord2', event_id: 'ev2', event_name: 'Verano 2027', status: 'pending', total: '40',
    buyer_email: 'maria@example.com', buyer_first_name: null, buyer_last_name: null,
    ticket_count: 1, payment_ref: null, paid_at: null, inserted_at: '2026-12-02T11:00:00Z',
  },
];

export const adminGlobalTickets = [
  { code: 'RG-AAA', public_token: 'tokA', status: 'valid', checked_in_at: null, event_name: 'Gala 2026', buyer_email: 'fan@example.com', seat_label: 'Mesa 1 · Asiento 1' },
  { code: 'RG-BBB', public_token: 'tokB', status: 'used', checked_in_at: '2026-12-31T22:10:00Z', event_name: 'Gala 2026', buyer_email: 'fan@example.com', seat_label: 'Mesa 1 · Asiento 2' },
];

export const adminSongsCrud = [
  { id: 'take-on-me', title: 'Take on Me', artist: 'a-ha', enabled: true },
  { id: 'celebration', title: 'Celebration', artist: 'Kool & The Gang', enabled: false },
];

export const adminSetlistsCrud = [
  { id: 'bloque-1', name: 'Bloque 1', song_ids: ['take-on-me'] },
];

// Admin events split by the backend filter: active = upcoming soonest-first,
// past = most-recent-first, all = active first then past.
export const adminEventsActive = [
  { id: 'ev1', slug: 'gala-2026', name: 'Gala 2026', status: 'published', starts_at: '2026-12-31T21:00:00Z', venue_name: 'Teatro Municipal' },
  { id: 'ev2', slug: 'verano-2027', name: 'Verano 2027', status: 'draft', starts_at: '2027-02-14T22:00:00Z', venue_name: 'La Basílica' },
];

export const adminEventsPast = [
  { id: 'ev3', slug: 'retro-2025', name: 'Retro 2025', status: 'published', starts_at: '2025-08-10T21:00:00Z', venue_name: 'Centro de Convenciones' },
];

// Resolve the events list the backend would return for a given ?filter=.
export function adminEventsFor(filter: string | null) {
  if (filter === 'past') return adminEventsPast;
  if (filter === 'all') return [...adminEventsActive, ...adminEventsPast];
  return adminEventsActive; // default + explicit 'active'
}

interface DashboardOpts {
  // Force the comp-orders endpoint to reject with a contract error so the
  // Issue panel's error mapping can be exercised.
  compError?: { status: number; error: string; seat_ids?: string[] };
}

// Wire every admin dashboard endpoint to in-memory contract data.
export async function setupAdminDashboard(page: Page, opts: DashboardOpts = {}) {
  // ** swallows the optional ?filter= query so the route matches every variant.
  await page.route('**/api/admin/events**', (r) => {
    const filter = new URL(r.request().url()).searchParams.get('filter');
    r.fulfill({ status: 200, json: { events: adminEventsFor(filter) } });
  });

  // Global orders (status filter honored).
  await page.route('**/api/admin/orders**', (r) => {
    const url = new URL(r.request().url());
    const status = url.searchParams.get('status');
    const orders = status ? adminGlobalOrders.filter((o) => o.status === status) : adminGlobalOrders;
    r.fulfill({ status: 200, json: { orders } });
  });

  // Cancel order.
  await page.route('**/api/orders/ord1/cancel', (r) =>
    r.fulfill({ status: 200, json: { order: { ...adminGlobalOrders[0], status: 'cancelled' } } })
  );

  // Global tickets.
  await page.route('**/api/admin/tickets**', (r) => {
    const url = new URL(r.request().url());
    const status = url.searchParams.get('status');
    const tickets = status ? adminGlobalTickets.filter((t) => t.status === status) : adminGlobalTickets;
    r.fulfill({ status: 200, json: { tickets } });
  });

  // Check-in / undo / void from the tickets panel.
  await page.route('**/api/tickets/tokA/check-in', (r) =>
    r.fulfill({ status: 200, json: { ticket: { ...adminGlobalTickets[0], status: 'used', checked_in_at: '2026-12-31T22:30:00Z' } } })
  );
  await page.route('**/api/tickets/tokB/undo-check-in', (r) =>
    r.fulfill({ status: 200, json: { ticket: { ...adminGlobalTickets[1], status: 'valid', checked_in_at: null } } })
  );
  await page.route('**/api/tickets/tokA/void', (r) =>
    r.fulfill({ status: 200, json: { ticket: { ...adminGlobalTickets[0], status: 'void' } } })
  );

  // Songs CRUD.
  await page.route('**/api/songs', (r) => r.fulfill({ status: 200, json: { songs: adminSongsCrud } }));
  await page.route('**/api/admin/songs', (r) =>
    r.fulfill({ status: 201, json: { song: { id: 'new-song', title: 'Billie Jean', artist: 'Michael Jackson', enabled: true } } })
  );
  await page.route('**/api/songs/take-on-me', (r) => {
    if (r.request().method() === 'DELETE') return r.fulfill({ status: 204, body: '' });
    const body = r.request().postDataJSON() as { song: Record<string, unknown> };
    return r.fulfill({ status: 200, json: { song: { ...adminSongsCrud[0], ...body.song } } });
  });
  await page.route('**/api/songs/celebration', (r) => {
    if (r.request().method() === 'DELETE') return r.fulfill({ status: 204, body: '' });
    const body = r.request().postDataJSON() as { song: Record<string, unknown> };
    return r.fulfill({ status: 200, json: { song: { ...adminSongsCrud[1], ...body.song } } });
  });

  // Issue panel: full event (reserved seats + a GA section) and comp-orders POST.
  await page.route('**/api/events/gala-2026', (r) => {
    if (r.request().method() !== 'GET') return r.fallback();
    return r.fulfill({ status: 200, json: { event: issueEvent } });
  });
  await page.route('**/api/events/ev1/comp-orders', (r) => {
    if (r.request().method() !== 'POST') return r.fallback();
    if (opts.compError) {
      const { status, error, seat_ids } = opts.compError;
      return r.fulfill({ status, json: { error, ...(seat_ids ? { seat_ids } : {}) } });
    }
    const body = r.request().postDataJSON() as ManualBody;
    const count = body.seat_ids ? body.seat_ids.length : (body.quantity ?? 1);
    const tickets = Array.from({ length: count }, (_, i) => ({
      id: `mt${i + 1}`, code: `MAN-${i + 1}`, public_token: `mtok${i + 1}`,
      status: 'valid', qr_svg: null, checked_in_at: null, seat_id: body.seat_ids?.[i] ?? null,
    }));
    return r.fulfill({
      status: 201,
      json: {
        order: {
          id: 'mord1', status: 'comp', total: '0',
          buyer_email: body.buyer.email,
          buyer_first_name: body.buyer.first_name ?? null,
          buyer_last_name: body.buyer.last_name ?? null,
          expires_at: null, tickets,
        },
      },
    });
  });

  // Setlists CRUD.
  await page.route('**/api/setlists', (r) => r.fulfill({ status: 200, json: { setlists: adminSetlistsCrud } }));
  await page.route('**/api/admin/setlists', (r) =>
    r.fulfill({ status: 201, json: { setlist: { id: 'new-setlist', name: 'Cierre', song_ids: [] } } })
  );
  await page.route('**/api/setlists/bloque-1', (r) => {
    if (r.request().method() === 'DELETE') return r.fulfill({ status: 204, body: '' });
    const body = r.request().postDataJSON() as { setlist: Record<string, unknown> };
    return r.fulfill({ status: 200, json: { setlist: { ...adminSetlistsCrud[0], ...body.setlist } } });
  });
}
