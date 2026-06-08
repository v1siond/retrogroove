'use client';

import { useState, FormEvent, MouseEvent } from 'react';
import Link from 'next/link';
import { AdminGate } from '@/components/admin2/AdminGate';
import { adminApi } from '@/lib/ticketing/admin';
import { ui } from '@/lib/ticketing/ui';

interface TableDef {
  label: string;
  x: number; // percent of stage width
  y: number; // percent of stage height
  seats: number;
  shape: 'round' | 'rect';
  seating: 'around' | 'rows';
  seatsPerRow: number;
}
interface SectionDef {
  name: string;
  price1: string; // 1-seat price
  price2: string; // 2-seat (combo) price, optional
  tables: TableDef[];
}

const COLORS = ['#ff1493', '#00e5ff', '#ffd700', '#bf00ff', '#22c55e'];

function NewEvent() {
  const [name, setName] = useState('');
  const [startsAt, setStartsAt] = useState('');
  const [venue, setVenue] = useState('');
  const [sections, setSections] = useState<SectionDef[]>([
    { name: 'General', price1: '40', price2: '70', tables: [] },
  ]);
  const [active, setActive] = useState(0);
  const [seatsPerTable, setSeatsPerTable] = useState(4);
  const [shape, setShape] = useState<'round' | 'rect'>('round');
  const [seating, setSeating] = useState<'around' | 'rows'>('around');
  const [seatsPerRow, setSeatsPerRow] = useState(10);
  const [creating, setCreating] = useState(false);
  const [createdSlug, setCreatedSlug] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const totalSeats = sections.reduce(
    (sum, s) => sum + s.tables.reduce((t, tbl) => t + tbl.seats, 0),
    0
  );

  function addSection() {
    setSections((s) => [...s, { name: `Sección ${s.length + 1}`, price1: '50', price2: '', tables: [] }]);
    setActive(sections.length);
  }
  function patchSection(i: number, patch: Partial<SectionDef>) {
    setSections((s) => s.map((sec, idx) => (idx === i ? { ...sec, ...patch } : sec)));
  }
  function placeTable(e: MouseEvent<HTMLDivElement>) {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = Math.min(94, Math.max(6, Math.round(((e.clientX - rect.left) / rect.width) * 100)));
    const y = Math.min(90, Math.max(20, Math.round(((e.clientY - rect.top) / rect.height) * 100)));
    setSections((s) =>
      s.map((sec, idx) =>
        idx === active
          ? { ...sec, tables: [...sec.tables, { label: `Mesa ${sec.tables.length + 1}`, x, y, seats: seatsPerTable, shape, seating, seatsPerRow }] }
          : sec
      )
    );
  }

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

      // One sales phase for the whole event — every section's price bundles hang
      // off it. A phase is an event-wide window (preventa); creating one per
      // section left each section's bundles on a different phase, so only the
      // active-phase section showed a price and the rest came back free.
      const { data: phase } = await adminApi.createPhase(event.id, {
        name: 'Preventa',
        starts_at: new Date('2020-01-01T00:00:00Z').toISOString(),
        ends_at: new Date(startsAt).toISOString(),
      });

      for (const sec of sections) {
        const { data: section } = await adminApi.createSection(event.id, {
          name: sec.name,
          layout_type: 'tables',
        });
        if (sec.price1) await adminApi.createBundle(section.id, { phase_id: phase.id, quantity: 1, price: sec.price1 });
        if (sec.price2) await adminApi.createBundle(section.id, { phase_id: phase.id, quantity: 2, price: sec.price2 });

        // The backend generates the seat map from the area's shape + seating.
        for (const t of sec.tables) {
          await adminApi.createTable(section.id, {
            label: t.label,
            seat_count: t.seats,
            pos_x: t.x,
            pos_y: t.y,
            shape: t.shape,
            seating: t.seating,
            seats_per_row: t.seating === 'rows' ? t.seatsPerRow : null,
          });
        }
      }

      await adminApi.publishEvent(event.id);
      setCreatedSlug(event.slug);
    } catch {
      setError('No se pudo crear el evento');
    } finally {
      setCreating(false);
    }
  }

  if (createdSlug) {
    return (
      <main className={ui.page}>
        <h1 className={ui.h1}>Evento publicado</h1>
        <p className="text-white/70">Ya aparece en la home y está listo para vender.</p>
        <ul className="mt-3 space-y-2">
          <li><Link href={`/evento?slug=${createdSlug}`} className="text-[#00e5ff] underline" data-testid="public-link">Página pública de venta</Link></li>
          <li><Link href={`/band/tickets/evento?slug=${createdSlug}`} className="text-[#00e5ff] underline">Administrar entradas</Link></li>
        </ul>
      </main>
    );
  }

  const sec = sections[active];

  return (
    <main className={ui.page}>
      <h1 className={ui.h1}>Nuevo evento</h1>
      {error && <p className={ui.error}>{error}</p>}

      <form onSubmit={create}>
        <div className={ui.card}>
          <label className={ui.label} htmlFor="ev-name">Nombre</label>
          <input id="ev-name" className={ui.input} value={name} onChange={(e) => setName(e.target.value)} required />
          <label className={ui.label} htmlFor="ev-start">Fecha y hora</label>
          <input id="ev-start" type="datetime-local" className={ui.input} value={startsAt} onChange={(e) => setStartsAt(e.target.value)} required />
          <label className={ui.label} htmlFor="ev-venue">Lugar</label>
          <input id="ev-venue" className={ui.input} value={venue} onChange={(e) => setVenue(e.target.value)} />
        </div>

        <h2 className={ui.h2}>Configura el escenario</h2>
        <p className={ui.muted}>Crea secciones (cada una con su precio) y haz clic en el escenario para colocar mesas.</p>

        {/* Section tabs */}
        <div className="flex flex-wrap gap-2 items-center">
          {sections.map((s, i) => (
            <button
              key={i}
              type="button"
              onClick={() => setActive(i)}
              data-testid="section-tab"
              className={`px-4 py-2 rounded-full text-sm border ${i === active ? 'bg-[#ff1493] border-[#ff1493]' : 'border-white/20 text-white/80'}`}
              style={{ borderColor: i === active ? COLORS[i % COLORS.length] : undefined }}
            >
              {s.name} ({s.tables.length})
            </button>
          ))}
          <button type="button" className={ui.btnGhost} onClick={addSection} data-testid="add-section">+ Sección</button>
        </div>

        {/* Active section pricing */}
        <div className={`${ui.card} grid gap-3 sm:grid-cols-2`}>
          <div>
            <label className={ui.label} htmlFor="sec-name">Nombre de la sección</label>
            <input id="sec-name" className={ui.input} value={sec.name} onChange={(e) => patchSection(active, { name: e.target.value })} />
          </div>
          <div>
            <label className={ui.label} htmlFor="seats-per-table">Asientos por mesa (nuevas)</label>
            <input id="seats-per-table" type="number" min={1} className={ui.input} value={seatsPerTable} onChange={(e) => setSeatsPerTable(Number(e.target.value))} />
          </div>
          <div>
            <label className={ui.label} htmlFor="area-shape">Forma</label>
            <select id="area-shape" className={ui.input} value={shape} onChange={(e) => setShape(e.target.value as 'round' | 'rect')}>
              <option value="round">Redonda</option>
              <option value="rect">Rectangular</option>
            </select>
          </div>
          <div>
            <label className={ui.label} htmlFor="area-seating">Distribución</label>
            <select id="area-seating" className={ui.input} value={seating} onChange={(e) => setSeating(e.target.value as 'around' | 'rows')}>
              <option value="around">Asientos alrededor</option>
              <option value="rows">Filas</option>
            </select>
          </div>
          {seating === 'rows' && (
            <div>
              <label className={ui.label} htmlFor="seats-per-row">Asientos por fila</label>
              <input id="seats-per-row" type="number" min={1} className={ui.input} value={seatsPerRow} onChange={(e) => setSeatsPerRow(Number(e.target.value))} />
            </div>
          )}
          <div>
            <label className={ui.label} htmlFor="sec-price1">Precio 1 entrada</label>
            <input id="sec-price1" className={ui.input} value={sec.price1} onChange={(e) => patchSection(active, { price1: e.target.value })} />
          </div>
          <div>
            <label className={ui.label} htmlFor="sec-price2">Precio combo 2 entradas (opcional)</label>
            <input id="sec-price2" className={ui.input} value={sec.price2} onChange={(e) => patchSection(active, { price2: e.target.value })} />
          </div>
        </div>

        {/* Stage canvas */}
        <div
          data-testid="stage-canvas"
          onClick={placeTable}
          className="relative h-80 rounded-xl border border-white/15 overflow-hidden mt-4 cursor-crosshair bg-[radial-gradient(circle_at_50%_0%,rgba(255,20,147,0.18),transparent_60%),#0b0020]"
        >
          <div className="absolute top-2 left-1/2 -translate-x-1/2 bg-gradient-to-br from-[#ff1493] to-[#bf00ff] text-white font-[Bebas_Neue] tracking-[0.2em] px-7 py-1 rounded text-sm pointer-events-none">
            ESCENARIO
          </div>
          {sections.flatMap((s, si) =>
            s.tables.map((t, ti) => (
              <div
                key={`${si}-${ti}`}
                data-testid="stage-table"
                className="absolute -translate-x-1/2 -translate-y-1/2 w-14 h-14 rounded-full border-2 flex items-center justify-center text-[0.65rem] leading-tight text-center pointer-events-none"
                style={{
                  left: `${t.x}%`,
                  top: `${t.y}%`,
                  borderColor: COLORS[si % COLORS.length],
                  background: `${COLORS[si % COLORS.length]}22`,
                }}
              >
                {t.label}
                <br />
                {t.seats}
              </div>
            ))
          )}
        </div>

        <p className="text-white/60 text-sm mt-2" data-testid="seat-total">{totalSeats} asientos en total</p>

        <button type="submit" className={ui.btn} disabled={creating || totalSeats === 0}>
          {creating ? 'Creando...' : 'Crear y publicar'}
        </button>
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
