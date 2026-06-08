'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { ticketingApi, ApiError } from '@/lib/ticketing/api';
import { bundleTotal } from '@/lib/ticketing/pricing';
import { getCulqiToken } from '@/lib/ticketing/culqi';
import { ui } from '@/lib/ticketing/ui';
import type { TicketEvent, Order, Section, Seat } from '@/lib/ticketing/types';

// Group a section's seats into display rows: seats with a `row` label (theater
// rows) cluster under "Fila A/B/…"; seats without one (tables) share a single
// unlabeled group. Within a row, seats are ordered by number.
function groupSeatsByRow(seats: Seat[]): { row: string | null; seats: Seat[] }[] {
  const groups = new Map<string | null, Seat[]>();
  for (const seat of seats) {
    const key = seat.row ?? null;
    const existing = groups.get(key);
    if (existing) existing.push(seat);
    else groups.set(key, [seat]);
  }
  return Array.from(groups.entries())
    .sort((a, b) => (a[0] ?? '').localeCompare(b[0] ?? ''))
    .map(([row, rowSeats]) => ({ row, seats: [...rowSeats].sort((x, y) => x.number - y.number) }));
}

type Step = 'select' | 'pay' | 'done';

export default function EventBuy({ slug }: { slug: string }) {
  const [event, setEvent] = useState<TicketEvent | null>(null);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<string[]>([]);
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
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
      const { order } = await ticketingApi.createOrder(event.id, selected, {
        email,
        phone,
        first_name: firstName,
        last_name: lastName,
      });
      setOrder(order);
      setStep('pay');
    } catch (err) {
      const data = (err as ApiError)?.data as { error?: string } | undefined;
      setError(
        data?.error === 'seats_unavailable'
          ? 'Algunos asientos ya no están disponibles. Elige otros.'
          : 'No se pudo crear la orden.'
      );
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

  if (loading) return <main className={ui.page}><p>Cargando...</p></main>;
  if (!event) return <main className={ui.page}><p>{error || 'Evento no encontrado'}</p></main>;

  return (
    <main className={ui.page}>
      <h1 className={ui.h1}>{event.name}</h1>
      {event.venue_name && <p className={ui.muted}>{event.venue_name}</p>}

      {error && <p className={ui.error} role="alert">{error}</p>}

      {step === 'select' && (
        <>
          {event.sections.map((section) => (
            <section key={section.id} className={ui.card} data-section-id={section.id}>
              <h3 className={ui.h3}>
                {section.name}
                {section.price_bundles[0] && (
                  <span className="text-white/50 text-sm ml-2">
                    desde S/ {section.price_bundles[0].price}
                  </span>
                )}
              </h3>
              <div className="mt-2 space-y-2">
                {groupSeatsByRow(section.seats).map((group) => (
                  <div key={group.row ?? 'around'} className="flex flex-wrap gap-2 items-center">
                    {group.row && (
                      <span className="text-white/50 text-xs w-16 shrink-0">Fila {group.row}</span>
                    )}
                    {group.seats.map((seat) => {
                      const isSel = selected.includes(seat.id);
                      const available = seat.status === 'available';
                      return (
                        <button
                          key={seat.id}
                          type="button"
                          className={ui.seat}
                          data-seat-id={seat.id}
                          data-status={seat.status}
                          data-selected={isSel}
                          disabled={!available}
                          aria-pressed={isSel}
                          aria-label={`Asiento ${group.row ? group.row + seat.number : seat.label || seat.number}`}
                          onClick={() => toggleSeat(seat.id)}
                        >
                          {group.row ? seat.number : seat.label || seat.number}
                        </button>
                      );
                    })}
                  </div>
                ))}
              </div>
            </section>
          ))}

          <div className={ui.card}>
            <p data-testid="selection" className="text-[#ffd700] font-semibold">
              {selected.length} asiento(s) — Total estimado: S/ {estimate.toFixed(2)}
            </p>
            <label className={ui.label} htmlFor="buyer-first">Nombre</label>
            <input id="buyer-first" className={ui.input} value={firstName} onChange={(e) => setFirstName(e.target.value)} />
            <label className={ui.label} htmlFor="buyer-last">Apellido</label>
            <input id="buyer-last" className={ui.input} value={lastName} onChange={(e) => setLastName(e.target.value)} />
            <label className={ui.label} htmlFor="buyer-email">Email</label>
            <input id="buyer-email" type="email" className={ui.input} value={email} onChange={(e) => setEmail(e.target.value)} required />
            <label className={ui.label} htmlFor="buyer-phone">Teléfono</label>
            <input id="buyer-phone" type="tel" className={ui.input} value={phone} onChange={(e) => setPhone(e.target.value)} />
            <div>
              <button type="button" className={ui.btn} disabled={selected.length === 0 || !email || working} onClick={handleBuy}>
                Comprar
              </button>
            </div>
          </div>
        </>
      )}

      {step === 'pay' && order && (
        <div className={ui.card}>
          <h2 className={ui.h2}>Pago</h2>
          <p data-testid="order-total" className="text-xl">Total: S/ {order.total}</p>
          <button type="button" className={ui.btn} disabled={working} onClick={handlePay}>
            Pagar con Culqi
          </button>
        </div>
      )}

      {step === 'done' && order && (
        <div className={ui.card}>
          <h2 className={ui.h2}>¡Compra confirmada!</h2>
          <p className="text-white/70">Te enviamos tus entradas por email. También puedes abrirlas aquí:</p>
          <ul className="mt-3 space-y-2">
            {order.tickets.map((t) => (
              <li key={t.id}>
                <Link href={`/t?token=${t.public_token}`} className="text-[#00e5ff] underline" data-testid="ticket-link">
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
