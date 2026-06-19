import type { TicketEvent, Order, Ticket, Buyer } from './types';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api';

export class ApiError extends Error {
  constructor(public status: number, public data: unknown) {
    super(`API error ${status}`);
  }
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: { 'Content-Type': 'application/json', ...options.headers },
  });

  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new ApiError(res.status, data);
  }

  return res.json();
}

export const ticketingApi = {
  getUpcoming(): Promise<{ events: TicketEvent[] }> {
    return request('/events/upcoming');
  },

  getEvent(slug: string): Promise<{ event: TicketEvent }> {
    return request(`/events/${slug}`);
  },

  createOrder(eventId: string, seatIds: string[], buyer: Buyer, promoCode?: string): Promise<{ order: Order }> {
    return request('/orders', {
      method: 'POST',
      body: JSON.stringify({ event_id: eventId, seat_ids: seatIds, buyer, promo_code: promoCode || undefined }),
    });
  },

  createGeneralOrder(sectionId: string, quantity: number, buyer: Buyer): Promise<{ order: Order }> {
    return request('/general-orders', {
      method: 'POST',
      body: JSON.stringify({ section_id: sectionId, quantity, buyer }),
    });
  },

  createPaymentLink(orderId: string): Promise<{ payment_url: string }> {
    return request(`/orders/${orderId}/payment-link`, { method: 'POST' });
  },

  getOrder(orderId: string): Promise<{ order: Order }> {
    return request(`/orders/${orderId}`);
  },

  getTicket(token: string): Promise<{ ticket: Ticket }> {
    return request(`/tickets/${token}`);
  },

  updateOrderBuyer(orderId: string, buyer: { first_name: string; last_name: string }): Promise<{ order: Order }> {
    return request(`/orders/${orderId}`, {
      method: 'PATCH',
      body: JSON.stringify({ buyer }),
    });
  },
};
