'use client';

// Emitir entradas — hand out entradas without payment (comp / manual). Flow:
// pick an event → pick reserved seats OR a GA section + quantity → enter the
// buyer (email required) → POST to comp-orders → show issued ticket codes +
// links. Restyled to the operations console; selectors preserved.

import { useEffect, useState, useCallback, FormEvent } from 'react';
import Link from 'next/link';
import { adminApi, ApiError } from '@/lib/ticketing/admin';
import type { AdminEventSummary, EventFilter, ManualTicketPayload } from '@/lib/ticketing/admin';
import type { TicketEvent, Section, Order } from '@/lib/ticketing/types';
import {
  DataTable, Column, Segmented, Button, Feedback, EmptyState, fmtDate,
  StatusBadge, CopyId, IconCalendar, IconSend,
} from '../console/ui';

const EVENT_FILTERS: { key: EventFilter; label: string }[] = [
  { key: 'active', label: 'Activos' },
  { key: 'past', label: 'Pasados' },
  { key: 'all', label: 'Todos' },
];

function isGeneralAdmission(section: Section): boolean {
  return section.layout_type === 'general' || section.seats.length === 0;
}

const ISSUE_ERRORS: Record<string, string> = {
  seats_unavailable: 'Algún asiento ya no está disponible. Vuelve a elegir.',
  sold_out: 'No quedan entradas generales en esa sección.',
  not_general: 'Esa sección es de asientos: elige asientos, no una cantidad.',
};

function issueErrorMessage(err: unknown): string {
  const code = (err as ApiError)?.data as { error?: string } | undefined;
  return (code?.error && ISSUE_ERRORS[code.error]) || 'No se pudieron emitir las entradas.';
}

// ── step 1: choose an event ──────────────────────────────────────────────────

function EventPicker({ query, onPick }: { query: string; onPick: (ev: AdminEventSummary) => void }) {
  const [events, setEvents] = useState<AdminEventSummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<EventFilter>('active');

  useEffect(() => {
    setEvents(null);
    setError(null);
    adminApi.listAllEvents(filter)
      .then((r) => setEvents(r.events))
      .catch((err) => {
        const status = (err as ApiError)?.status;
        setError(status === 401 ? 'Sesión expirada.' : 'No se pudieron cargar los eventos.');
        setEvents([]);
      });
  }, [filter]);

  const filtered = (events || []).filter((ev) =>
    !query || `${ev.name} ${ev.venue_name || ''}`.toLowerCase().includes(query.toLowerCase()));

  const columns: Column<AdminEventSummary>[] = [
    { key: 'name', header: 'Evento', render: (e) => (
      <div>
        <div className="rg-cell-primary">{e.name}</div>
        <div className="rg-cell-sub">{fmtDate(e.starts_at)}{e.venue_name ? ` · ${e.venue_name}` : ''}</div>
      </div>
    ) },
    { key: 'status', header: 'Estado', render: (e) => <StatusBadge status={e.status} /> },
    { key: 'go', header: '', align: 'right', render: () => <span className="rg-link">Emitir →</span> },
  ];

  return (
    <div>
      <h3 style={{ fontSize: 13, fontWeight: 600, margin: '0 0 10px' }}>1 · Elige el evento</h3>
      <div style={{ marginBottom: 14 }}>
        <Segmented testId="issue-event-filter" options={EVENT_FILTERS} value={filter} onChange={setFilter} />
      </div>

      {error && <Feedback kind="error">{error}</Feedback>}

      <div data-testid="issue-events-list">
        <DataTable
          columns={columns}
          rows={events === null ? null : filtered}
          rowKey={(e) => e.id}
          rowTestId="issue-event-item"
          onRowClick={onPick}
          empty={<EmptyState icon={<IconCalendar />} title="Sin eventos" description="No hay eventos disponibles." />}
        />
      </div>
    </div>
  );
}

// ── step 2: pick seats / GA quantity + buyer, then issue ─────────────────────

interface IssueState { selectedSeats: string[]; gaSectionId: string | null; gaQuantity: number }

function buildPayload(buyer: { email: string; first_name: string; last_name: string }, s: IssueState): ManualTicketPayload | null {
  const cleanBuyer = {
    email: buyer.email.trim(),
    first_name: buyer.first_name.trim() || undefined,
    last_name: buyer.last_name.trim() || undefined,
  };
  if (s.gaSectionId && s.gaQuantity > 0) return { buyer: cleanBuyer, section_id: s.gaSectionId, quantity: s.gaQuantity };
  if (s.selectedSeats.length > 0) return { buyer: cleanBuyer, seat_ids: s.selectedSeats };
  return null;
}

function IssueForm({ ev, onBack }: { ev: AdminEventSummary; onBack: () => void }) {
  const [event, setEvent] = useState<TicketEvent | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [state, setState] = useState<IssueState>({ selectedSeats: [], gaSectionId: null, gaQuantity: 1 });
  const [email, setEmail] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [working, setWorking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [issued, setIssued] = useState<Order | null>(null);

  const load = useCallback(() => {
    setLoadError(null);
    adminApi.getEvent(ev.slug)
      .then((r) => setEvent(r.event))
      .catch(() => setLoadError('No se pudo cargar el evento.'));
  }, [ev.slug]);

  useEffect(() => { load(); }, [load]);

  function toggleSeat(seatId: string) {
    setState((s) => ({
      gaSectionId: null, gaQuantity: 1,
      selectedSeats: s.selectedSeats.includes(seatId)
        ? s.selectedSeats.filter((x) => x !== seatId)
        : [...s.selectedSeats, seatId],
    }));
  }

  function pickGaSection(sectionId: string) {
    setState((s) => ({
      selectedSeats: [],
      gaSectionId: s.gaSectionId === sectionId ? null : sectionId,
      gaQuantity: s.gaSectionId === sectionId ? 1 : s.gaQuantity,
    }));
  }

  const payload = buildPayload({ email, first_name: firstName, last_name: lastName }, state);
  const canSubmit = !!email.trim() && !!payload && !working;

  async function issue(e: FormEvent) {
    e.preventDefault();
    if (!payload) return;
    setWorking(true);
    setError(null);
    try {
      const { order } = await adminApi.createManualTickets(ev.id, payload);
      setIssued(order);
      setState({ selectedSeats: [], gaSectionId: null, gaQuantity: 1 });
    } catch (err) {
      setError(issueErrorMessage(err));
    } finally {
      setWorking(false);
    }
  }

  return (
    <div data-testid="issue-form">
      <button type="button" className="rg-link" onClick={onBack} style={{ marginBottom: 10, display: 'inline-block' }}>← Otro evento</button>
      <h3 style={{ fontSize: 14, fontWeight: 600, margin: '0 0 2px' }}>2 · {ev.name}</h3>
      <p className="rg-cell-sub" style={{ marginBottom: 14 }}>{fmtDate(ev.starts_at)}{ev.venue_name ? ` · ${ev.venue_name}` : ''}</p>

      {loadError && <Feedback kind="error">{loadError}</Feedback>}

      {event && event.sections.map((section) => (
        isGeneralAdmission(section) ? (
          <section key={section.id} className="rg-card" style={{ marginBottom: 14 }} data-section-id={section.id} data-section-kind="general">
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
              <h3 style={{ margin: 0 }}>{section.name} <span className="rg-cell-sub">· general</span></h3>
              <label style={{ display: 'inline-flex', gap: 8, alignItems: 'center', fontSize: 13, cursor: 'pointer' }}>
                <input type="radio" name="ga-section" data-testid={`ga-pick-${section.id}`}
                  checked={state.gaSectionId === section.id} onChange={() => pickGaSection(section.id)} />
                Entradas generales
              </label>
            </div>
            {state.gaSectionId === section.id && (
              <div style={{ marginTop: 12, display: 'flex', alignItems: 'center', gap: 10 }}>
                <label className="rg-label" htmlFor={`ga-qty-${section.id}`} style={{ margin: 0 }}>Cantidad</label>
                <input id={`ga-qty-${section.id}`} data-testid="ga-quantity" type="number" min={1} className="rg-input"
                  style={{ width: 90 }} value={state.gaQuantity}
                  onChange={(e) => setState((s) => ({ ...s, gaQuantity: Math.max(1, Number(e.target.value) || 1) }))} />
              </div>
            )}
          </section>
        ) : (
          <section key={section.id} className="rg-card" style={{ marginBottom: 14 }} data-section-id={section.id} data-section-kind="reserved">
            <h3 style={{ marginTop: 0 }}>{section.name}</h3>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 8 }}>
              {section.seats.map((seat) => {
                const isSel = state.selectedSeats.includes(seat.id);
                const available = seat.status === 'available';
                return (
                  <button key={seat.id} type="button" className="rg-issue-seat"
                    data-seat-id={seat.id} data-status={seat.status} data-selected={isSel}
                    disabled={!available} aria-pressed={isSel} onClick={() => toggleSeat(seat.id)}>
                    {seat.label || seat.number}
                  </button>
                );
              })}
            </div>
          </section>
        )
      ))}

      <form className="rg-card" onSubmit={issue}>
        <p data-testid="issue-selection" style={{ fontWeight: 600, marginBottom: 12, color: 'var(--accent)' }}>
          {state.gaSectionId
            ? `${state.gaQuantity} entrada(s) general(es)`
            : `${state.selectedSeats.length} asiento(s) seleccionado(s)`}
        </p>

        <div className="rg-field">
          <label className="rg-label" htmlFor="issue-email">Email del invitado</label>
          <input id="issue-email" type="email" className="rg-input" value={email} onChange={(e) => setEmail(e.target.value)} required />
        </div>
        <div className="rg-form-grid">
          <div className="rg-field">
            <label className="rg-label" htmlFor="issue-first">Nombre</label>
            <input id="issue-first" className="rg-input" value={firstName} onChange={(e) => setFirstName(e.target.value)} />
          </div>
          <div className="rg-field">
            <label className="rg-label" htmlFor="issue-last">Apellido</label>
            <input id="issue-last" className="rg-input" value={lastName} onChange={(e) => setLastName(e.target.value)} />
          </div>
        </div>

        {error && <Feedback kind="error">{error}</Feedback>}

        <Button variant="primary" type="submit" data-testid="issue-submit" disabled={!canSubmit}>
          <IconSend /> {working ? 'Emitiendo…' : 'Emitir entradas'}
        </Button>
      </form>

      {issued && (
        <div className="rg-card" data-testid="issued" style={{ marginTop: 14 }}>
          <Feedback kind="ok">{issued.tickets.length} entrada(s) emitida(s) para {issued.buyer_email}.</Feedback>
          <ul style={{ listStyle: 'none', margin: '8px 0 0', padding: 0, display: 'flex', flexDirection: 'column', gap: 8 }}>
            {issued.tickets.map((t) => (
              <li key={t.id} data-testid="issued-ticket"
                style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, padding: '8px 12px', borderRadius: 8, background: 'var(--neutral-bg)' }}>
                <CopyId value={t.code || t.public_token} label="código" />
                {t.public_token && <Link href={`/t?token=${t.public_token}`} className="rg-link">Ver entrada</Link>}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

// ── panel root ───────────────────────────────────────────────────────────────

export default function IssuePanel({ query }: { query: string }) {
  const [picked, setPicked] = useState<AdminEventSummary | null>(null);

  return (
    <div>
      <div className="rg-page-head">
        <div>
          <h1>Emitir entradas</h1>
          <p>Genera entradas sin cobro (cortesía / venta manual).</p>
        </div>
      </div>

      {picked
        ? <IssueForm ev={picked} onBack={() => setPicked(null)} />
        : <EventPicker query={query} onPick={setPicked} />}
    </div>
  );
}
