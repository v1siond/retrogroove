'use client';

// Tickets resource: a GLOBAL list of every ticket across all events. Filter by
// status, search by buyer/code, and act on a ticket — check in, undo check-in,
// or void it (each with a confirm). For fast door scanning, the dedicated
// check-in screen is linked at the top.

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { adminApi, ApiError } from '@/lib/ticketing/admin';
import { ui } from '@/lib/ticketing/ui';
import type { AdminTicket } from '@/lib/ticketing/admin';
import { StatusPill, fmtDate, Feedback, ConfirmAction, selectStyle, searchStyle } from '../shared';

export default function TicketsPanel() {
  const [tickets, setTickets] = useState<AdminTicket[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState('');
  const [query, setQuery] = useState('');
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback((status?: string) => {
    setError(null);
    adminApi.listAllTickets(status ? { status } : {})
      .then((r) => setTickets(r.tickets))
      .catch((err) => {
        const s = (err as ApiError)?.status;
        setError(s === 401 ? 'Sesión expirada.' : 'No se pudieron cargar las entradas.');
        setTickets([]);
      });
  }, []);

  useEffect(() => { load(statusFilter || undefined); }, [load, statusFilter]);

  // Actions may return the public Ticket or the AdminTicket shape; both carry the
  // status/checked_in_at we re-render, so merge only the overlapping fields.
  type TicketPatch = { status?: string; checked_in_at?: string | null };

  function applyUpdate(token: string, patch: TicketPatch) {
    setTickets((cur) => (cur ? cur.map((t) => (t.public_token === token
      ? { ...t, status: patch.status ?? t.status, checked_in_at: patch.checked_in_at ?? t.checked_in_at }
      : t)) : cur));
  }

  async function run(token: string, action: () => Promise<{ ticket: TicketPatch }>, msg: string) {
    setBusy(token);
    setError(null);
    setNotice(null);
    try {
      const { ticket } = await action();
      applyUpdate(token, ticket);
      setNotice(msg);
    } catch {
      setError('No se pudo completar la acción.');
    } finally {
      setBusy(null);
    }
  }

  const checkIn = (t: AdminTicket) => run(t.public_token, () => adminApi.checkIn(t.public_token), `Entrada ${t.code} registrada.`);
  const undo = (t: AdminTicket) => run(t.public_token, () => adminApi.undoCheckIn(t.public_token), `Check-in de ${t.code} deshecho.`);
  const voidIt = (t: AdminTicket) => run(t.public_token, () => adminApi.voidTicket(t.public_token), `Entrada ${t.code} anulada.`);

  const filtered = (tickets || []).filter((t) => {
    if (!query) return true;
    const hay = `${t.code} ${t.buyer_email} ${t.event_name || ''} ${t.seat_label || ''}`.toLowerCase();
    return hay.includes(query.toLowerCase());
  });

  return (
    <div>
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <h1 className={ui.h1}>Entradas</h1>
        <Link href="/band/tickets/check-in" className="text-[#00e5ff] underline">Control de puerta →</Link>
      </div>
      <p className={ui.muted}>Todas las entradas de todos los eventos.</p>

      <div className={`${ui.card} flex gap-3 items-center flex-wrap`}>
        <select data-testid="ticket-status-filter" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} style={selectStyle}>
          <option value="">Todos los estados</option>
          <option value="valid">Válidas</option>
          <option value="used">Usadas</option>
          <option value="void">Anuladas</option>
        </select>
        <input data-testid="ticket-search" placeholder="Buscar código, comprador o evento…" value={query} onChange={(e) => setQuery(e.target.value)} style={searchStyle} />
      </div>

      {error && <Feedback kind="error">{error}</Feedback>}
      {notice && <Feedback kind="ok">{notice}</Feedback>}

      <div className={ui.card} data-testid="tickets-list">
        {tickets === null ? (
          <p className="text-[var(--color-text-muted)]">Cargando entradas...</p>
        ) : filtered.length === 0 ? (
          <p className="text-[var(--color-text-muted)]">No hay entradas.</p>
        ) : (
          <div className="flex flex-col gap-2">
            {filtered.map((t) => (
              <div key={t.public_token} data-testid="ticket-row" className="flex items-center justify-between gap-3 py-2.5 border-b border-[var(--color-border)] last:border-0 flex-wrap">
                <div className="min-w-0">
                  <div className="text-sm font-mono">{t.code}</div>
                  <div className="text-xs text-[var(--color-text-muted)]">
                    {t.event_name ? `${t.event_name} · ` : ''}{t.seat_label || 'General'} · {t.buyer_email}
                  </div>
                  {t.checked_in_at && <div className="text-xs text-[var(--color-text-faint)]">Ingresó {fmtDate(t.checked_in_at)}</div>}
                </div>
                <div className="flex items-center gap-2 whitespace-nowrap flex-wrap justify-end">
                  <StatusPill status={t.status} />
                  {t.status === 'valid' && (
                    <button type="button" data-testid={`check-in-${t.code}`} className={ui.btn} style={{ marginTop: 0, padding: '5px 14px', fontSize: '0.78rem' }}
                      onClick={() => checkIn(t)} disabled={busy === t.public_token}>
                      Check-in
                    </button>
                  )}
                  {t.status === 'used' && (
                    <ConfirmAction testId={`undo-${t.code}`} label="Deshacer check-in" confirmLabel="Sí, deshacer"
                      prompt="¿Deshacer el check-in?" busy={busy === t.public_token} onConfirm={() => undo(t)} />
                  )}
                  {t.status !== 'void' && (
                    <ConfirmAction testId={`void-${t.code}`} label="Anular" confirmLabel="Sí, anular"
                      prompt="¿Anular esta entrada?" busy={busy === t.public_token} onConfirm={() => voidIt(t)} />
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
