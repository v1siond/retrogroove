'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { adminApi, ApiError } from '@/lib/ticketing/admin';
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

  if (loading) return <main className="event-admin"><p>Cargando...</p></main>;
  if (!event) return <main className="event-admin"><p>{error || 'Evento no encontrado'}</p></main>;

  return (
    <main className="event-admin">
      <h1>{event.name}</h1>
      <div className="toolbar">
        <button type="button" onClick={downloadCsv}>Descargar CSV de compradores</button>
        <Link href={`/band/tickets/check-in`}>Check-in</Link>
      </div>

      {error && <p className="error">{error}</p>}

      <h2>Generar entradas (cortesía)</h2>
      <p className="hint">Selecciona asientos y emítelos sin cobro por Culqi.</p>

      {event.sections.map((section) => (
        <section key={section.id} data-section-id={section.id}>
          <h3>{section.name}</h3>
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
                  onClick={() => setSelected((c) => (isSel ? c.filter((s) => s !== seat.id) : [...c, seat.id]))}
                >
                  {seat.label || seat.number}
                </button>
              );
            })}
          </div>
        </section>
      ))}

      <div className="issue">
        <p data-testid="selection">{selected.length} asiento(s) seleccionados</p>
        <label htmlFor="comp-email">Email del invitado</label>
        <input id="comp-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
        <button type="button" disabled={selected.length === 0 || !email || working} onClick={issue}>
          Generar entradas
        </button>
      </div>

      {issued && (
        <div className="issued" data-testid="issued">
          <p>{issued.tickets.length} entrada(s) generada(s) y enviada(s).</p>
          <ul>
            {issued.tickets.map((t) => (
              <li key={t.id}>
                <Link href={`/t?token=${t.public_token}`}>Ver entrada</Link>
              </li>
            ))}
          </ul>
        </div>
      )}
    </main>
  );
}
