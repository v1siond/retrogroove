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

// Dashboard list/detail shapes — match the admin API contract.
export interface AdminEventSummary {
  id: string;
  slug: string;
  name: string;
  status: string;
  starts_at: string;
  venue_name: string | null;
}

export interface AdminOrder {
  id: string;
  status: string;
  total: string;
  buyer_email: string;
  buyer_first_name: string | null;
  buyer_last_name: string | null;
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
}

export const adminApi = {
  login(email: string, password: string): Promise<{ token: string; user: AdminUser }> {
    return authed('/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) });
  },

  getEvent(slug: string): Promise<{ event: TicketEvent }> {
    return authed(`/events/${slug}`);
  },

  listAllEvents(): Promise<{ events: AdminEventSummary[] }> {
    return authed('/admin/events');
  },

  listOrders(eventId: string): Promise<{ orders: AdminOrder[] }> {
    return authed(`/events/${eventId}/orders`);
  },

  listTickets(eventId: string): Promise<{ tickets: AdminTicket[] }> {
    return authed(`/events/${eventId}/tickets`);
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
