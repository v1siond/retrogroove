'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { ticketingApi, ApiError } from '@/lib/ticketing/api';
import { bundleTotal } from '@/lib/ticketing/pricing';
import { getCulqiToken } from '@/lib/ticketing/culqi';
import { ui } from '@/lib/ticketing/ui';
import type { TicketEvent, Order, Section, Seat } from '@/lib/ticketing/types';

// A seat's display label: theater rows read "B5"; table seats fall back to their
// own label or number.
function seatName(seat: Seat): string {
  return seat.row ? `${seat.row}${seat.number}` : seat.label || String(seat.number);
}

// Place a section's seats on its own stage box. Each seat's stored pos_x/pos_y
// (global stage-percent) is normalised into the box (with padding) so round
// tables show as rings and theater blocks as grids, regardless of where the
// section sits on the overall stage.
function placeSeats(seats: Seat[]): (Seat & { left: number; top: number })[] {
  if (seats.length === 0) return [];
  const xs = seats.map((s) => s.pos_x);
  const ys = seats.map((s) => s.pos_y);
  const minX = Math.min(...xs);
  const minY = Math.min(...ys);
  const spanX = Math.max(...xs) - minX || 1;
  const spanY = Math.max(...ys) - minY || 1;
  const PAD = 7;
  return seats.map((s) => ({
    ...s,
    left: PAD + ((s.pos_x - minX) / spanX) * (100 - 2 * PAD),
    top: PAD + ((s.pos_y - minY) / spanY) * (100 - 2 * PAD),
  }));
}

type Step = 'select' | 'pay' | 'done';

export default function EventBuy({ slug }: { slug: string }) {
  const [event, setEvent] = useState<TicketEvent | null>(null);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<string[]>([]);
  const [gaQty, setGaQty] = useState<Record<string, number>>({});
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
    // General-admission: quantity x unit price.
    for (const sec of event.sections) {
      const q = gaQty[sec.id] || 0;
      if (q > 0) total += q * Number(sec.price_bundles[0]?.price || 0);
    }
    return total;
  }, [selected, event, seatSection, gaQty]);

  const gaTotalQty = Object.values(gaQty).reduce((a, b) => a + b, 0);
  const selectedCount = selected.length + gaTotalQty;

  function toggleSeat(id: string) {
    setSelected((cur) => (cur.includes(id) ? cur.filter((s) => s !== id) : [...cur, id]));
  }

  function bumpGa(section: Section, delta: number) {
    setGaQty((cur) => {
      const next = Math.max(0, Math.min(section.available ?? 0, (cur[section.id] || 0) + delta));
      return { ...cur, [section.id]: next };
    });
  }

  async function handleBuy() {
    if (!event || selectedCount === 0 || !email) return;
    setWorking(true);
    setError(null);
    try {
      const buyer = { email, phone, first_name: firstName, last_name: lastName };
      const ga = Object.entries(gaQty).find(([, q]) => q > 0);
      const { order } = ga
        ? await ticketingApi.createGeneralOrder(ga[0], ga[1], buyer)
        : await ticketingApi.createOrder(event.id, selected, buyer);
      setOrder(order);
      setStep('pay');
    } catch (err) {
      const data = (err as ApiError)?.data as { error?: string } | undefined;
      setError(
        data?.error === 'seats_unavailable'
          ? 'Algunos asientos ya no están disponibles. Elige otros.'
          : data?.error === 'sold_out'
            ? 'Ya no quedan entradas disponibles.'
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
              {section.layout_type === 'general' ? (
                <div className="mt-3 flex items-center justify-between gap-4">
                  <p data-testid="ga-available" className="text-white/60 text-sm">
                    {section.available ?? 0} disponibles
                  </p>
                  <div className="flex items-center gap-3">
                    <button type="button" data-testid="ga-minus" className={ui.btnGhost} onClick={() => bumpGa(section, -1)}>
                      −
                    </button>
                    <span data-testid="ga-qty" className="text-xl font-semibold w-8 text-center">
                      {gaQty[section.id] || 0}
                    </span>
                    <button type="button" data-testid="ga-plus" className={ui.btnGhost} onClick={() => bumpGa(section, 1)}>
                      +
                    </button>
                  </div>
                </div>
              ) : (
              <div
                data-testid="seat-map"
                className="relative mt-3 h-72 rounded-xl border border-white/10 overflow-hidden bg-[radial-gradient(circle_at_50%_0%,rgba(255,20,147,0.12),transparent_60%),#0b0020]"
              >
                <div className="absolute top-2 left-1/2 -translate-x-1/2 text-white/40 text-[0.6rem] tracking-[0.3em] pointer-events-none">
                  ESCENARIO
                </div>
                {placeSeats(section.seats).map((seat) => {
                  const isSel = selected.includes(seat.id);
                  const available = seat.status === 'available';
                  const label = seatName(seat);
                  return (
                    <button
                      key={seat.id}
                      type="button"
                      data-seat-id={seat.id}
                      data-status={seat.status}
                      data-selected={isSel}
                      disabled={!available}
                      aria-pressed={isSel}
                      aria-label={`Asiento ${label}`}
                      title={`Asiento ${label}`}
                      onClick={() => toggleSeat(seat.id)}
                      style={{ left: `${seat.left}%`, top: `${seat.top}%` }}
                      className={`absolute -translate-x-1/2 -translate-y-1/2 w-7 h-7 rounded-full border text-[0.55rem] flex items-center justify-center transition ${
                        isSel
                          ? 'bg-[#ff1493] border-[#ff1493] text-white'
                          : available
                            ? 'bg-[#00e5ff]/15 border-[#00e5ff]/60 text-[#00e5ff] hover:bg-[#00e5ff]/30'
                            : 'bg-white/5 border-white/15 text-white/30 cursor-not-allowed'
                      }`}
                    >
                      {seat.number}
                    </button>
                  );
                })}
              </div>
              )}
            </section>
          ))}

          <div className={ui.card}>
            <p data-testid="selection" className="text-[#ffd700] font-semibold">
              {selectedCount} asiento(s) — Total estimado: S/ {estimate.toFixed(2)}
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
              <button type="button" className={ui.btn} disabled={selectedCount === 0 || !email || working} onClick={handleBuy}>
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
