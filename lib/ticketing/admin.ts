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

export const adminApi = {
  login(email: string, password: string): Promise<{ token: string; user: AdminUser }> {
    return authed('/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) });
  },

  getEvent(slug: string): Promise<{ event: TicketEvent }> {
    return authed(`/events/${slug}`);
  },

  createEvent(attrs: Record<string, unknown>): Promise<{ event: TicketEvent }> {
    return authed('/events', { method: 'POST', body: JSON.stringify({ event: attrs }) });
  },

  createSection(eventId: string, attrs: Record<string, unknown>): Promise<{ data: { id: string } }> {
    return authed(`/events/${eventId}/sections`, {
      method: 'POST',
      body: JSON.stringify({ section: attrs }),
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
