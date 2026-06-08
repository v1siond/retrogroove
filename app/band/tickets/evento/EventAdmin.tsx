'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { adminApi, ApiError } from '@/lib/ticketing/admin';
import { ui } from '@/lib/ticketing/ui';
import type { TicketEvent, Order } from '@/lib/ticketing/types';

export default function EventAdmin({ slug }: { slug: string }) {
  const [event, setEvent] = useState<TicketEvent | null>(null);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<string[]>([]);
  const [email, setEmail] = useState('');
  const [issued, setIssued] = useState<Order | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [working, setWorking] = useState(false);

  useEffect(() => {
    adminApi
      .getEvent(slug)
      .then((r) => setEvent(r.event))
      .catch(() => setError('No se pudo cargar el evento'))
      .finally(() => setLoading(false));
  }, [slug]);

  function reload() {
    adminApi.getEvent(slug).then((r) => setEvent(r.event));
  }

  async function issue() {
    if (!event || selected.length === 0 || !email) return;
    setWorking(true);
    setError(null);
    try {
      const { order } = await adminApi.compOrder(event.id, selected, { email });
      setIssued(order);
      setSelected([]);
      reload();
    } catch (err) {
      const data = (err as ApiError)?.data as { error?: string } | undefined;
      setError(data?.error === 'seats_unavailable' ? 'Algún asiento ya no está disponible.' : 'No se pudo generar.');
    } finally {
      setWorking(false);
    }
  }

  async function downloadCsv() {
    if (!event) return;
    const csv = await adminApi.buyersCsv(event.id);
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `buyers-${event.slug}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  if (loading) return <main className={ui.page}><p>Cargando...</p></main>;
  if (!event) return <main className={ui.page}><p>{error || 'Evento no encontrado'}</p></main>;

  return (
    <main className={ui.page}>
      <h1 className={ui.h1}>{event.name}</h1>
      <div className={`${ui.card} flex gap-4 items-center flex-wrap`}>
        <button type="button" className={ui.btn} onClick={downloadCsv}>Descargar CSV de compradores</button>
        <Link href="/band/tickets/check-in" className="text-[#00e5ff] underline">Check-in</Link>
      </div>

      {error && <p className={ui.error}>{error}</p>}

      <h2 className={ui.h2}>Generar entradas (cortesía)</h2>
      <p className={ui.muted}>Selecciona asientos y emítelos sin cobro por Culqi.</p>

      {event.sections.map((section) => (
        <section key={section.id} className={ui.card} data-section-id={section.id}>
          <h3 className={ui.h3}>{section.name}</h3>
          <div className="flex flex-wrap gap-2 mt-2">
            {section.seats.map((seat) => {
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
                  onClick={() => setSelected((c) => (isSel ? c.filter((s) => s !== seat.id) : [...c, seat.id]))}
                >
                  {seat.label || seat.number}
                </button>
              );
            })}
          </div>
        </section>
      ))}

      <div className={ui.card}>
        <p data-testid="selection" className="text-[#ffd700] font-semibold">{selected.length} asiento(s) seleccionados</p>
        <label className={ui.label} htmlFor="comp-email">Email del invitado</label>
        <input id="comp-email" type="email" className={ui.input} value={email} onChange={(e) => setEmail(e.target.value)} />
        <div>
          <button type="button" className={ui.btn} disabled={selected.length === 0 || !email || working} onClick={issue}>
            Generar entradas
          </button>
        </div>
      </div>

      {issued && (
        <div className={ui.card} data-testid="issued">
          <p>{issued.tickets.length} entrada(s) generada(s) y enviada(s).</p>
          <ul className="mt-2 space-y-1">
            {issued.tickets.map((t) => (
              <li key={t.id}>
                <Link href={`/t?token=${t.public_token}`} className="text-[#00e5ff] underline">Ver entrada</Link>
              </li>
            ))}
          </ul>
        </div>
      )}
    </main>
  );
}
