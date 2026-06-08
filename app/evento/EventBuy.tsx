'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { ticketingApi, ApiError } from '@/lib/ticketing/api';
import { bundleTotal } from '@/lib/ticketing/pricing';
import { getCulqiToken } from '@/lib/ticketing/culqi';
import type { TicketEvent, Order, Section } from '@/lib/ticketing/types';

type Step = 'select' | 'pay' | 'done';

export default function EventBuy({ slug }: { slug: string }) {
  const [event, setEvent] = useState<TicketEvent | null>(null);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<string[]>([]);
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [step, setStep] = useState<Step>('select');
  const [order, setOrder] = useState<Order | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [working, setWorking] = useState(false);

  useEffect(() => {
    ticketingApi
      .getEvent(slug)
      .then((r) => setEvent(r.event))
      .catch(() => setError('No se pudo cargar el evento'))
      .finally(() => setLoading(false));
  }, [slug]);

  const seatSection = useMemo(() => {
    const map = new Map<string, Section>();
    event?.sections.forEach((s) => s.seats.forEach((seat) => map.set(seat.id, s)));
    return map;
  }, [event]);

  const estimate = useMemo(() => {
    if (!event) return 0;
    const bySection = new Map<string, number>();
    selected.forEach((id) => {
      const sec = seatSection.get(id);
      if (sec) bySection.set(sec.id, (bySection.get(sec.id) || 0) + 1);
    });
    let total = 0;
    bySection.forEach((count, sectionId) => {
      const sec = event.sections.find((s) => s.id === sectionId);
      if (sec) total += bundleTotal(sec.price_bundles, count);
    });
    return total;
  }, [selected, event, seatSection]);

  function toggleSeat(id: string) {
    setSelected((cur) => (cur.includes(id) ? cur.filter((s) => s !== id) : [...cur, id]));
  }

  async function handleBuy() {
    if (!event || selected.length === 0 || !email) return;
    setWorking(true);
    setError(null);
    try {
      const { order } = await ticketingApi.createOrder(event.id, selected, { email, phone });
      setOrder(order);
      setStep('pay');
    } catch (err) {
      const data = (err as ApiError)?.data as { error?: string } | undefined;
      if (data?.error === 'seats_unavailable') {
        setError('Algunos asientos ya no están disponibles. Elige otros.');
      } else {
        setError('No se pudo crear la orden.');
      }
    } finally {
      setWorking(false);
    }
  }

  async function handlePay() {
    if (!order) return;
    setWorking(true);
    setError(null);
    try {
      const token = await getCulqiToken();
      const { order: paid } = await ticketingApi.payOrder(order.id, token);
      setOrder(paid);
      setStep('done');
    } catch {
      setError('El pago no se pudo procesar.');
    } finally {
      setWorking(false);
    }
  }

  if (loading) return <main className="buy"><p>Cargando...</p></main>;
  if (!event) return <main className="buy"><p>{error || 'Evento no encontrado'}</p></main>;

  return (
    <main className="buy">
      <h1>{event.name}</h1>
      {event.venue_name && <p className="venue">{event.venue_name}</p>}

      {error && <p className="error" role="alert">{error}</p>}

      {step === 'select' && (
        <>
          {event.sections.map((section) => (
            <section key={section.id} className="zone" data-section-id={section.id}>
              <h2>{section.name}</h2>
              <div className="seats">
                {section.seats.map((seat) => {
                  const isSel = selected.includes(seat.id);
                  const available = seat.status === 'available';
                  return (
                    <button
                      key={seat.id}
                      type="button"
                      className="seat"
                      data-seat-id={seat.id}
                      data-status={seat.status}
                      data-selected={isSel}
                      disabled={!available}
                      aria-pressed={isSel}
                      aria-label={`Asiento ${seat.label || seat.number}`}
                      onClick={() => toggleSeat(seat.id)}
                    >
                      {seat.label || seat.number}
                    </button>
                  );
                })}
              </div>
            </section>
          ))}

          <div className="summary">
            <p data-testid="selection">
              {selected.length} asiento(s) — Total estimado: S/ {estimate.toFixed(2)}
            </p>
            <label htmlFor="buyer-email">Email</label>
            <input
              id="buyer-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
            <label htmlFor="buyer-phone">Teléfono</label>
            <input
              id="buyer-phone"
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
            />
            <button
              type="button"
              className="primary"
              disabled={selected.length === 0 || !email || working}
              onClick={handleBuy}
            >
              Comprar
            </button>
          </div>
        </>
      )}

      {step === 'pay' && order && (
        <div className="pay">
          <h2>Pago</h2>
          <p data-testid="order-total">Total: S/ {order.total}</p>
          <button type="button" className="primary" disabled={working} onClick={handlePay}>
            Pagar con Culqi
          </button>
        </div>
      )}

      {step === 'done' && order && (
        <div className="done">
          <h2>¡Compra confirmada!</h2>
          <p>Te enviamos tus entradas por email. También puedes abrirlas aquí:</p>
          <ul>
            {order.tickets.map((t) => (
              <li key={t.id}>
                <Link href={`/t?token=${t.public_token}`} data-testid="ticket-link">
                  Ver entrada
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}
    </main>
  );
}
