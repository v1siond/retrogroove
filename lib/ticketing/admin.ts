import type { TicketEvent, Order, Ticket, Buyer } from './types';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api';
const TOKEN_KEY = 'rg_admin_token';

export class ApiError extends Error {
  constructor(public status: number, public data: unknown) {
    super(`API error ${status}`);
  }
}

export function getToken(): string | null {
  return typeof window !== 'undefined' ? localStorage.getItem(TOKEN_KEY) : null;
}
export function setToken(t: string) {
  localStorage.setItem(TOKEN_KEY, t);
}
export function clearToken() {
  localStorage.removeItem(TOKEN_KEY);
}

// Build a `?a=1&b=2` query string, dropping empty/undefined values.
function queryString(params: Record<string, string | undefined>): string {
  const entries = Object.entries(params).filter(([, v]) => v != null && v !== '');
  if (entries.length === 0) return '';
  const qs = new URLSearchParams(entries as [string, string][]);
  return `?${qs.toString()}`;
}

async function authed<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = getToken();
  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
  });

  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new ApiError(res.status, data);
  }

  const contentType = res.headers.get('content-type') || '';
  if (contentType.includes('text/csv')) return (await res.text()) as unknown as T;
  if (res.status === 204) return {} as T;
  return res.json();
}

export interface AdminUser {
  id: string;
  email: string;
  name: string | null;
  role: string;
}

// Event-list filter for the admin Events panel.
export type EventFilter = 'active' | 'past' | 'all';

// Manual ticket issuance (no payment). Reserved seats by id, OR a GA section +
// quantity. The buyer is always required.
export type ManualTicketPayload =
  | { buyer: Buyer; seat_ids: string[] }
  | { buyer: Buyer; section_id: string; quantity: number };

// Dashboard list/detail shapes — match the admin API contract.
export interface AdminEventSummary {
  id: string;
  slug: string;
  name: string;
  status: string;
  starts_at: string;
  venue_name: string | null;
  // How full the event is. `sold` is paid tickets only and `comp` the ones given away —
  // reported apart, but both occupy a seat, so `available` has both subtracted. Seats on
  // an unconfirmed hold still count as available.
  capacity: number;
  sold: number;
  comp: number;
  available: number;
}

export interface AdminOrder {
  id: string;
  status: string;
  total: string;
  buyer_email: string;
  buyer_first_name: string | null;
  buyer_last_name: string | null;
  buyer_phone: string | null;
  payment_ref: string | null;
  paid_at: string | null;
  inserted_at: string;
  ticket_count: number;
}

export interface AdminTicket {
  code: string;
  public_token: string;
  status: string;
  checked_in_at: string | null;
  buyer_email: string;
  seat_label: string | null;
  table_label: string | null;
  event_name?: string | null;
  order_id?: string | null;
}

// Global orders list (GET /admin/orders) carries the event so the admin can act
// on orders without first drilling into an event.
export interface AdminGlobalOrder extends AdminOrder {
  event_id: string;
  event_name: string | null;
}

export interface AdminSong {
  id: string;
  title: string;
  artist: string;
  enabled: boolean;
}

export interface AdminSetlist {
  id: string;
  name: string;
  song_ids: string[];
}

export interface AdminPromoCode {
  id: string;
  code: string;
  kind: string; // 'percent' | 'fixed'
  value: string;
  active: boolean;
}

// Event-wide sales phases (early-bird → regular → etc.). Fields match the
// LayoutController contract; optional ones are tolerated for forward-compat.
export interface AdminPhase {
  id: string;
  name: string;
  starts_at?: string | null;
  ends_at?: string | null;
  active?: boolean;
}

// Quantity → price tiers attached to a section.
export interface AdminPriceBundle {
  id: string;
  quantity: number;
  price: string;
  section_id?: string | null;
}

// Band gear. `quantity` is how many we own; how many travel to one event lives on
// AdminEventEquipment.quantity. Retired gear (active: false) stays on the events it
// already went to but drops out of the picker for new lists.
export interface AdminEquipmentItem {
  id: string;
  name: string;
  category: string | null;
  quantity: number;
  notes: string | null;
  active: boolean;
}

// One line of an event's load list: the item's details plus the two load checks.
export interface AdminEventEquipment {
  id: string;
  equipment_item_id: string;
  name: string;
  category: string | null;
  notes: string | null;
  owned_quantity: number;
  quantity: number;
  packed_at: string | null;
  returned_at: string | null;
}

export const adminApi = {
  login(email: string, password: string): Promise<{ token: string; user: AdminUser }> {
    return authed('/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) });
  },

  getEvent(slug: string): Promise<{ event: TicketEvent }> {
    return authed(`/events/${slug}`);
  },

  // filter: 'active' (upcoming, soonest-first) | 'past' (most-recent-first) |
  // 'all'. Backend defaults to 'active' when omitted.
  listAllEvents(filter?: EventFilter): Promise<{ events: AdminEventSummary[] }> {
    return authed(`/admin/events${queryString({ filter })}`);
  },

  listOrders(eventId: string): Promise<{ orders: AdminOrder[] }> {
    return authed(`/events/${eventId}/orders`);
  },

  listTickets(eventId: string): Promise<{ tickets: AdminTicket[] }> {
    return authed(`/events/${eventId}/tickets`);
  },

  // ── Global orders ────────────────────────────────────────────────────────
  // List orders across every event; optional status/event filters.
  listAllOrders(filters: { status?: string; event_id?: string } = {}): Promise<{ orders: AdminGlobalOrder[] }> {
    return authed(`/admin/orders${queryString(filters)}`);
  },

  // Correct an order's buyer contact + payment reference (a Yapeo confirmed before the
  // buyer sent their details). Never changes status, total or tickets, and sends no email
  // — use resendOrder for that. An omitted field is left as it is; "" clears it.
  updateOrder(
    id: string,
    attrs: { buyer: Buyer; payment_ref: string },
  ): Promise<{ order: AdminGlobalOrder }> {
    return authed(`/orders/${id}`, { method: 'PUT', body: JSON.stringify(attrs) });
  },

  cancelOrder(id: string): Promise<{ order: AdminGlobalOrder }> {
    return authed(`/orders/${id}/cancel`, { method: 'POST' });
  },

  // Confirm a pending order paid out-of-band (Yape/Plin/transfer) — issues the tickets.
  confirmOrder(id: string): Promise<{ order: AdminGlobalOrder }> {
    return authed(`/orders/${id}/confirm`, { method: 'POST' });
  },

  // Re-send the ticket email (the buyer's link again) for a paid/comp order.
  resendOrder(id: string): Promise<{ ok: boolean }> {
    return authed(`/orders/${id}/resend`, { method: 'POST' });
  },

  // ── Global tickets ───────────────────────────────────────────────────────
  listAllTickets(filters: { status?: string; event_id?: string } = {}): Promise<{ tickets: AdminTicket[] }> {
    return authed(`/admin/tickets${queryString(filters)}`);
  },

  undoCheckIn(token: string): Promise<{ ticket: AdminTicket }> {
    return authed(`/tickets/${token}/undo-check-in`, { method: 'POST' });
  },

  voidTicket(token: string): Promise<{ ticket: AdminTicket }> {
    return authed(`/tickets/${token}/void`, { method: 'POST' });
  },

  // ── Equipment (band gear) ────────────────────────────────────────────────
  listEquipment(): Promise<{ equipment: AdminEquipmentItem[] }> {
    return authed('/admin/equipment');
  },

  createEquipment(attrs: Partial<AdminEquipmentItem>): Promise<{ item: AdminEquipmentItem }> {
    return authed('/admin/equipment', { method: 'POST', body: JSON.stringify({ item: attrs }) });
  },

  updateEquipment(id: string, attrs: Partial<AdminEquipmentItem>): Promise<{ item: AdminEquipmentItem }> {
    return authed(`/equipment/${id}`, { method: 'PUT', body: JSON.stringify({ item: attrs }) });
  },

  // Gear is retired, never deleted — past event lists keep their line.
  retireEquipment(id: string): Promise<{ item: AdminEquipmentItem }> {
    return authed(`/equipment/${id}/retire`, { method: 'POST' });
  },

  restoreEquipment(id: string): Promise<{ item: AdminEquipmentItem }> {
    return authed(`/equipment/${id}/restore`, { method: 'POST' });
  },

  listEventEquipment(eventId: string): Promise<{ equipment: AdminEventEquipment[] }> {
    return authed(`/events/${eventId}/equipment`);
  },

  // The multiselect save. Lines that survive keep the ticks already made on them.
  setEventEquipment(
    eventId: string,
    items: { equipment_item_id: string; quantity: number }[],
  ): Promise<{ equipment: AdminEventEquipment[] }> {
    return authed(`/events/${eventId}/equipment`, { method: 'PUT', body: JSON.stringify({ items }) });
  },

  // Tick/untick one line at the van.
  markEventEquipment(
    id: string,
    flags: { packed?: boolean; returned?: boolean },
  ): Promise<{ line: { id: string; packed_at: string | null; returned_at: string | null } }> {
    return authed(`/event-equipment/${id}`, { method: 'PUT', body: JSON.stringify(flags) });
  },

  // ── Songs ────────────────────────────────────────────────────────────────
  listSongs(): Promise<{ songs: AdminSong[] }> {
    return authed('/songs');
  },

  createSong(attrs: { title: string; artist: string; enabled?: boolean }): Promise<{ song: AdminSong }> {
    return authed('/admin/songs', { method: 'POST', body: JSON.stringify({ song: attrs }) });
  },

  updateSong(id: string, attrs: Partial<{ title: string; artist: string; enabled: boolean }>): Promise<{ song: AdminSong }> {
    return authed(`/songs/${id}`, { method: 'PUT', body: JSON.stringify({ song: attrs }) });
  },

  deleteSong(id: string): Promise<void> {
    return authed(`/songs/${id}`, { method: 'DELETE' });
  },

  // ── Setlists ─────────────────────────────────────────────────────────────
  listSetlists(): Promise<{ setlists: AdminSetlist[] }> {
    return authed('/setlists');
  },

  createSetlist(attrs: { name: string; song_ids: string[] }): Promise<{ setlist: AdminSetlist }> {
    return authed('/admin/setlists', { method: 'POST', body: JSON.stringify({ setlist: attrs }) });
  },

  updateSetlist(id: string, attrs: Partial<{ name: string; song_ids: string[] }>): Promise<{ setlist: AdminSetlist }> {
    return authed(`/setlists/${id}`, { method: 'PUT', body: JSON.stringify({ setlist: attrs }) });
  },

  deleteSetlist(id: string): Promise<void> {
    return authed(`/setlists/${id}`, { method: 'DELETE' });
  },

  // ── Promo codes (per event) ──────────────────────────────────────────────
  listPromoCodes(eventId: string): Promise<{ promo_codes: AdminPromoCode[] }> {
    return authed(`/events/${eventId}/promo-codes`);
  },

  // Backend PUT returns the LayoutController `{data}` envelope, not `{promo_code}`.
  updatePromo(id: string, attrs: Record<string, unknown>): Promise<{ data: AdminPromoCode }> {
    return authed(`/promo-codes/${id}`, { method: 'PUT', body: JSON.stringify({ promo_code: attrs }) });
  },

  deletePromo(id: string): Promise<void> {
    return authed(`/promo-codes/${id}`, { method: 'DELETE' });
  },

  // ── Phases (per event) ───────────────────────────────────────────────────
  listPhases(eventId: string): Promise<{ phases: AdminPhase[] }> {
    return authed(`/events/${eventId}/phases`);
  },

  // PUT/DELETE return the LayoutController `{data}` envelope.
  updatePhase(id: string, attrs: Record<string, unknown>): Promise<{ data: AdminPhase }> {
    return authed(`/phases/${id}`, { method: 'PUT', body: JSON.stringify({ phase: attrs }) });
  },

  deletePhase(id: string): Promise<void> {
    return authed(`/phases/${id}`, { method: 'DELETE' });
  },

  // ── Price bundles (per event) ────────────────────────────────────────────
  listBundles(eventId: string): Promise<{ price_bundles: AdminPriceBundle[] }> {
    return authed(`/events/${eventId}/price-bundles`);
  },

  updateBundle(id: string, attrs: Record<string, unknown>): Promise<{ data: AdminPriceBundle }> {
    return authed(`/price-bundles/${id}`, { method: 'PUT', body: JSON.stringify({ price_bundle: attrs }) });
  },

  deleteBundle(id: string): Promise<void> {
    return authed(`/price-bundles/${id}`, { method: 'DELETE' });
  },

  // ── Layout (sections / tables / seats) ───────────────────────────────────
  // DELETE returns 409 when the section/table/seat has sold tickets.
  updateSection(id: string, attrs: Record<string, unknown>): Promise<{ data: { id: string } }> {
    return authed(`/sections/${id}`, { method: 'PUT', body: JSON.stringify({ section: attrs }) });
  },

  deleteSection(id: string): Promise<void> {
    return authed(`/sections/${id}`, { method: 'DELETE' });
  },

  updateTable(id: string, attrs: Record<string, unknown>): Promise<{ data: { id: string } }> {
    return authed(`/tables/${id}`, { method: 'PUT', body: JSON.stringify({ table: attrs }) });
  },

  deleteTable(id: string): Promise<void> {
    return authed(`/tables/${id}`, { method: 'DELETE' });
  },

  updateSeat(id: string, attrs: Record<string, unknown>): Promise<{ data: { id: string } }> {
    return authed(`/seats/${id}`, { method: 'PUT', body: JSON.stringify({ seat: attrs }) });
  },

  deleteSeat(id: string): Promise<void> {
    return authed(`/seats/${id}`, { method: 'DELETE' });
  },

  updateEvent(id: string, attrs: Record<string, unknown>): Promise<{ event: TicketEvent }> {
    return authed(`/events/${id}`, { method: 'PUT', body: JSON.stringify({ event: attrs }) });
  },

  deleteEvent(id: string): Promise<void> {
    return authed(`/events/${id}`, { method: 'DELETE' });
  },

  createEvent(attrs: Record<string, unknown>): Promise<{ event: TicketEvent }> {
    return authed('/events', { method: 'POST', body: JSON.stringify({ event: attrs }) });
  },

  // One transactional layout save — the body is the raw { event, sections } payload; the
  // server diffs sections/tables/bundles by id and returns any sold-inventory warnings.
  saveEventLayout(
    id: string,
    payload: { event: Record<string, unknown>; sections: unknown[] },
  ): Promise<{ ok: boolean; slug: string; warnings: string[] }> {
    return authed(`/events/${id}/layout`, { method: 'PUT', body: JSON.stringify(payload) });
  },

  publishEvent(id: string): Promise<{ event: TicketEvent }> {
    return authed(`/events/${id}/publish`, { method: 'POST' });
  },

  createSection(eventId: string, attrs: Record<string, unknown>): Promise<{ data: { id: string } }> {
    return authed(`/events/${eventId}/sections`, {
      method: 'POST',
      body: JSON.stringify({ section: attrs }),
    });
  },

  createTable(sectionId: string, attrs: Record<string, unknown>): Promise<{ data: { id: string } }> {
    return authed(`/sections/${sectionId}/tables`, {
      method: 'POST',
      body: JSON.stringify({ table: attrs }),
    });
  },

  createSeat(sectionId: string, attrs: Record<string, unknown>): Promise<{ data: { id: string } }> {
    return authed(`/sections/${sectionId}/seats`, {
      method: 'POST',
      body: JSON.stringify({ seat: attrs }),
    });
  },

  createPhase(eventId: string, attrs: Record<string, unknown>): Promise<{ data: { id: string } }> {
    return authed(`/events/${eventId}/phases`, {
      method: 'POST',
      body: JSON.stringify({ phase: attrs }),
    });
  },

  createBundle(sectionId: string, attrs: Record<string, unknown>): Promise<{ data: { id: string } }> {
    return authed(`/sections/${sectionId}/price-bundles`, {
      method: 'POST',
      body: JSON.stringify({ price_bundle: attrs }),
    });
  },

  createPromo(eventId: string, attrs: Record<string, unknown>): Promise<{ data: { id: string } }> {
    return authed(`/events/${eventId}/promo-codes`, {
      method: 'POST',
      body: JSON.stringify({ promo_code: attrs }),
    });
  },

  compOrder(eventId: string, seatIds: string[], buyer: Buyer): Promise<{ order: Order }> {
    return authed(`/events/${eventId}/comp-orders`, {
      method: 'POST',
      body: JSON.stringify({ seat_ids: seatIds, buyer }),
    });
  },

  // Issue tickets without payment (comp / manual). Reserved seats via
  // { seat_ids }, general admission via { section_id, quantity }. Both carry the
  // buyer. Hits the same comp-orders endpoint as compOrder, but takes the full
  // payload so the GA path is expressible.
  createManualTickets(eventId: string, payload: ManualTicketPayload): Promise<{ order: Order }> {
    return authed(`/events/${eventId}/comp-orders`, {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  buyersCsv(eventId: string): Promise<string> {
    return authed(`/events/${eventId}/buyers`);
  },

  getTicket(token: string): Promise<{ ticket: Ticket }> {
    return authed(`/tickets/${token}`);
  },

  checkIn(token: string): Promise<{ ticket: Ticket }> {
    return authed(`/tickets/${token}/check-in`, { method: 'POST' });
  },
};
