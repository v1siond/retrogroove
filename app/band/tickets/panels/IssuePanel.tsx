'use client';

// Issue tickets resource: hand out entradas without payment (comp / manual).
// Flow: pick an event → pick reserved seats OR a GA section + quantity → enter
// the buyer (email required, names optional) → "Emitir entradas" → POST to the
// comp-orders endpoint → show the issued ticket codes + links.

import { useEffect, useState, useCallback, FormEvent } from 'react';
import Link from 'next/link';
import { adminApi, ApiError } from '@/lib/ticketing/admin';
import { ui } from '@/lib/ticketing/ui';
import type { AdminEventSummary, EventFilter, ManualTicketPayload } from '@/lib/ticketing/admin';
import type { TicketEvent, Section, Order } from '@/lib/ticketing/types';
import { fmtDate, Feedback, Segmented, searchStyle } from '../shared';

const EVENT_FILTERS: { key: EventFilter; label: string }[] = [
  { key: 'active', label: 'Activos' },
  { key: 'past', label: 'Pasados' },
  { key: 'all', label: 'Todos' },
];

// A section is general-admission (no seat map) when its layout is 'general' or
// it simply has no individual seats to pick.
function isGeneralAdmission(section: Section): boolean {
  return section.layout_type === 'general' || section.seats.length === 0;
}

// Map a backend error code to a human message. Mirrors the comp-orders
// contract: seats_unavailable (some seat got taken), sold_out (GA capacity
// gone), not_general (tried a quantity on a reserved section).
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

function EventPicker({ onPick }: { onPick: (ev: AdminEventSummary) => void }) {
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

  return (
    <div>
      <h2 className={ui.h2}>1 · Elige el evento</h2>
      <div className={`${ui.card} flex gap-4 items-center flex-wrap`}>
        <Segmented testId="issue-event-filter" options={EVENT_FILTERS} value={filter} onChange={setFilter} />
      </div>

      {error && <Feedback kind="error">{error}</Feedback>}

      <div className={ui.card} data-testid="issue-events-list">
        {events === null ? (
          <p className="text-[var(--color-text-muted)]">Cargando eventos...</p>
        ) : events.length === 0 ? (
          <p className="text-[var(--color-text-muted)]">No hay eventos.</p>
        ) : (
          <div className="flex flex-col">
            {events.map((ev) => (
              <button key={ev.id} type="button" data-testid="issue-event-item" onClick={() => onPick(ev)}
                className="flex items-center justify-between gap-3 py-3 px-3 rounded-xl text-left cursor-pointer border border-transparent hover:border-[var(--color-border)] hover:bg-white/[0.06] transition">
                <div className="min-w-0">
                  <div className="text-base">{ev.name}</div>
                  <div className="text-xs text-[var(--color-text-muted)]">{fmtDate(ev.starts_at)}{ev.venue_name ? ` · ${ev.venue_name}` : ''}</div>
                </div>
                <span className="text-[var(--color-cyan)] text-sm">Emitir →</span>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ── step 2: pick seats / GA quantity + buyer, then issue ─────────────────────

interface IssueState {
  selectedSeats: string[];
  gaSectionId: string | null;
  gaQuantity: number;
}

function buildPayload(buyer: { email: string; first_name: string; last_name: string }, s: IssueState): ManualTicketPayload | null {
  const cleanBuyer = {
    email: buyer.email.trim(),
    first_name: buyer.first_name.trim() || undefined,
    last_name: buyer.last_name.trim() || undefined,
  };
  if (s.gaSectionId && s.gaQuantity > 0) {
    return { buyer: cleanBuyer, section_id: s.gaSectionId, quantity: s.gaQuantity };
  }
  if (s.selectedSeats.length > 0) {
    return { buyer: cleanBuyer, seat_ids: s.selectedSeats };
  }
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
    // Picking seats clears any GA selection, and vice versa — one mode at a time.
    setState((s) => ({
      gaSectionId: null,
      gaQuantity: 1,
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
      <button type="button" className="text-[#00e5ff] underline text-sm" onClick={onBack}>← Otro evento</button>
      <h2 className={ui.h2}>2 · {ev.name}</h2>
      <p className={ui.muted}>{fmtDate(ev.starts_at)}{ev.venue_name ? ` · ${ev.venue_name}` : ''}</p>

      {loadError && <Feedback kind="error">{loadError}</Feedback>}

      {event && event.sections.map((section) => (
        isGeneralAdmission(section) ? (
          <section key={section.id} className={ui.card} data-section-id={section.id} data-section-kind="general">
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <h3 className={ui.h3} style={{ marginTop: 0 }}>{section.name} <span className="text-[var(--color-text-faint)] text-sm">· general</span></h3>
              <label className="flex items-center gap-2 cursor-pointer text-sm">
                <input
                  type="radio"
                  name="ga-section"
                  data-testid={`ga-pick-${section.id}`}
                  checked={state.gaSectionId === section.id}
                  onChange={() => pickGaSection(section.id)}
                />
                Entradas generales
              </label>
            </div>
            {state.gaSectionId === section.id && (
              <div className="mt-3 flex items-center gap-2">
                <label className={ui.label} htmlFor={`ga-qty-${section.id}`} style={{ marginTop: 0 }}>Cantidad</label>
                <input
                  id={`ga-qty-${section.id}`}
                  data-testid="ga-quantity"
                  type="number"
                  min={1}
                  value={state.gaQuantity}
                  onChange={(e) => setState((s) => ({ ...s, gaQuantity: Math.max(1, Number(e.target.value) || 1) }))}
                  style={{ ...searchStyle, width: '90px', minWidth: '90px', flex: '0 0 auto' }}
                />
              </div>
            )}
          </section>
        ) : (
          <section key={section.id} className={ui.card} data-section-id={section.id} data-section-kind="reserved">
            <h3 className={ui.h3} style={{ marginTop: 0 }}>{section.name}</h3>
            <div className="flex flex-wrap gap-2 mt-2">
              {section.seats.map((seat) => {
                const isSel = state.selectedSeats.includes(seat.id);
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
                    onClick={() => toggleSeat(seat.id)}
                  >
                    {seat.label || seat.number}
                  </button>
                );
              })}
            </div>
          </section>
        )
      ))}

      {/* Selection summary + buyer + submit */}
      <form className={ui.card} onSubmit={issue}>
        <p data-testid="issue-selection" className="text-[var(--color-gold)] font-semibold">
          {state.gaSectionId
            ? `${state.gaQuantity} entrada(s) general(es)`
            : `${state.selectedSeats.length} asiento(s) seleccionado(s)`}
        </p>

        <label className={ui.label} htmlFor="issue-email">Email del invitado</label>
        <input id="issue-email" type="email" className={ui.input} value={email} onChange={(e) => setEmail(e.target.value)} required />

        <div className="flex gap-3 flex-wrap">
          <div className="flex-1 min-w-[160px]">
            <label className={ui.label} htmlFor="issue-first">Nombre</label>
            <input id="issue-first" className={ui.input} value={firstName} onChange={(e) => setFirstName(e.target.value)} />
          </div>
          <div className="flex-1 min-w-[160px]">
            <label className={ui.label} htmlFor="issue-last">Apellido</label>
            <input id="issue-last" className={ui.input} value={lastName} onChange={(e) => setLastName(e.target.value)} />
          </div>
        </div>

        {error && <Feedback kind="error">{error}</Feedback>}

        <div>
          <button type="submit" data-testid="issue-submit" className={ui.btn} disabled={!canSubmit}>
            {working ? 'Emitiendo...' : 'Emitir entradas'}
          </button>
        </div>
      </form>

      {issued && (
        <div className={ui.card} data-testid="issued">
          <Feedback kind="ok">{issued.tickets.length} entrada(s) emitida(s) para {issued.buyer_email}.</Feedback>
          <ul className="mt-2 flex flex-col gap-2">
            {issued.tickets.map((t) => (
              <li key={t.id} data-testid="issued-ticket" className="flex items-center justify-between gap-3 py-2 px-3 rounded-lg bg-white/5">
                <span className="font-mono text-sm">{t.code || t.public_token}</span>
                {t.public_token && (
                  <Link href={`/t?token=${t.public_token}`} className="text-[#00e5ff] underline text-sm">Ver entrada</Link>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

// ── panel root ───────────────────────────────────────────────────────────────

export default function IssuePanel() {
  const [picked, setPicked] = useState<AdminEventSummary | null>(null);

  return (
    <div>
      <h1 className={ui.h1}>Emitir entradas</h1>
      <p className={ui.muted}>Genera entradas sin cobro (cortesía / venta manual). Elige un evento, luego asientos o entradas generales.</p>

      {picked
        ? <IssueForm ev={picked} onBack={() => setPicked(null)} />
        : <EventPicker onPick={setPicked} />}
    </div>
  );
}
