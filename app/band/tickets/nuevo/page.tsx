'use client';

import { useState, FormEvent } from 'react';
import Link from 'next/link';
import { AdminGate } from '@/components/admin2/AdminGate';
import { adminApi } from '@/lib/ticketing/admin';

function NewEvent() {
  const [name, setName] = useState('');
  const [startsAt, setStartsAt] = useState('');
  const [venue, setVenue] = useState('');
  const [sectionName, setSectionName] = useState('General');
  const [seatCount, setSeatCount] = useState(10);
  const [phaseName, setPhaseName] = useState('Preventa');
  const [phaseStart, setPhaseStart] = useState('');
  const [phaseEnd, setPhaseEnd] = useState('');
  const [price1, setPrice1] = useState('40');
  const [price2, setPrice2] = useState('70');
  const [creating, setCreating] = useState(false);
  const [createdSlug, setCreatedSlug] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function create(e: FormEvent) {
    e.preventDefault();
    setCreating(true);
    setError(null);
    try {
      const { event } = await adminApi.createEvent({
        name,
        starts_at: new Date(startsAt).toISOString(),
        venue_name: venue,
      });
      const { data: section } = await adminApi.createSection(event.id, {
        name: sectionName,
        layout_type: 'rows',
      });
      const { data: phase } = await adminApi.createPhase(event.id, {
        name: phaseName,
        starts_at: new Date(phaseStart).toISOString(),
        ends_at: phaseEnd ? new Date(phaseEnd).toISOString() : null,
      });
      if (price1) await adminApi.createBundle(section.id, { phase_id: phase.id, quantity: 1, price: price1 });
      if (price2) await adminApi.createBundle(section.id, { phase_id: phase.id, quantity: 2, price: price2 });
      for (let i = 1; i <= seatCount; i++) {
        await adminApi.createSeat(section.id, { number: i, label: `${i}` });
      }
      setCreatedSlug(event.slug);
    } catch {
      setError('No se pudo crear el evento');
    } finally {
      setCreating(false);
    }
  }

  if (createdSlug) {
    return (
      <main className="new-event">
        <h1>Evento creado</h1>
        <p>Listo para vender.</p>
        <ul>
          <li><Link href={`/evento?slug=${createdSlug}`}>Página pública de venta</Link></li>
          <li><Link href={`/band/tickets/evento?slug=${createdSlug}`}>Administrar entradas</Link></li>
        </ul>
      </main>
    );
  }

  return (
    <main className="new-event">
      <h1>Nuevo evento</h1>
      {error && <p className="error">{error}</p>}
      <form onSubmit={create}>
        <label htmlFor="ev-name">Nombre</label>
        <input id="ev-name" value={name} onChange={(e) => setName(e.target.value)} required />

        <label htmlFor="ev-start">Fecha y hora</label>
        <input id="ev-start" type="datetime-local" value={startsAt} onChange={(e) => setStartsAt(e.target.value)} required />

        <label htmlFor="ev-venue">Lugar</label>
        <input id="ev-venue" value={venue} onChange={(e) => setVenue(e.target.value)} />

        <h2>Sección</h2>
        <label htmlFor="sec-name">Nombre de la sección</label>
        <input id="sec-name" value={sectionName} onChange={(e) => setSectionName(e.target.value)} />

        <label htmlFor="seat-count">Cantidad de asientos</label>
        <input id="seat-count" type="number" min={1} value={seatCount} onChange={(e) => setSeatCount(Number(e.target.value))} />

        <h2>Fase de venta y precios</h2>
        <label htmlFor="ph-name">Nombre de la fase</label>
        <input id="ph-name" value={phaseName} onChange={(e) => setPhaseName(e.target.value)} />

        <label htmlFor="ph-start">Inicio de venta</label>
        <input id="ph-start" type="datetime-local" value={phaseStart} onChange={(e) => setPhaseStart(e.target.value)} required />

        <label htmlFor="ph-end">Fin de venta (opcional)</label>
        <input id="ph-end" type="datetime-local" value={phaseEnd} onChange={(e) => setPhaseEnd(e.target.value)} />

        <label htmlFor="price1">Precio 1 entrada</label>
        <input id="price1" value={price1} onChange={(e) => setPrice1(e.target.value)} />

        <label htmlFor="price2">Precio 2 entradas (combo)</label>
        <input id="price2" value={price2} onChange={(e) => setPrice2(e.target.value)} />

        <button type="submit" disabled={creating}>{creating ? 'Creando...' : 'Crear evento'}</button>
      </form>
    </main>
  );
}

export default function NewEventPage() {
  return (
    <AdminGate>
      <NewEvent />
    </AdminGate>
  );
}
