'use client';

// Entradas resource — a GLOBAL table across every event. Filter by status +
// event, search by code/buyer/event. Inline row actions for the common door
// operations (check-in / undo / void); clicking the row opens a drawer with
// every ticket field and the same actions. The dedicated door-control screen is
// linked for fast scanning.

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { adminApi, ApiError } from '@/lib/ticketing/admin';
import type { AdminTicket, AdminEventSummary } from '@/lib/ticketing/admin';
import {
  DataTable, Column, Drawer, Field, FieldList, DrawerSectionTitle, StatusBadge,
  Toolbar, SearchBox, Select, Button, ConfirmAction, Feedback, EmptyState,
  ToastStack, useToasts, fmtDate, IconTicket,
} from '../console/ui';

type TicketPatch = { status?: string; checked_in_at?: string | null };

function TicketDrawer({
  ticket, busy, onClose, onCheckIn, onUndo, onVoid,
}: {
  ticket: AdminTicket;
  busy: boolean;
  onClose: () => void;
  onCheckIn: () => void;
  onUndo: () => void;
  onVoid: () => void;
}) {
  const footer = (
    <>
      {ticket.status === 'valid' && (
        <Button variant="primary" data-testid={`drawer-check-in-${ticket.code}`} disabled={busy} onClick={onCheckIn}>Check-in</Button>
      )}
      {ticket.status === 'used' && (
        <ConfirmAction testId={`drawer-undo-${ticket.code}`} label="Deshacer check-in" confirmLabel="Sí, deshacer"
          prompt="¿Deshacer el check-in?" busy={busy} onConfirm={onUndo} />
      )}
      {ticket.status !== 'void' && (
        <ConfirmAction testId={`drawer-void-${ticket.code}`} label="Anular" confirmLabel="Sí, anular"
          prompt="¿Anular esta entrada?" busy={busy} onConfirm={onVoid} />
      )}
    </>
  );

  return (
    <Drawer open onClose={onClose} testId="ticket-detail" title={ticket.code}
      subtitle={<><StatusBadge status={ticket.status} /> · {ticket.event_name || '—'}</>} footer={footer}>
      <FieldList>
        <Field label="Código" copy={ticket.code} />
        <Field label="Token" copy={ticket.public_token} />
        <Field label="Estado"><StatusBadge status={ticket.status} /></Field>
        <Field label="Evento">{ticket.event_name}</Field>
        <Field label="Asiento">{ticket.seat_label || 'General'}</Field>
        <Field label="Comprador">{ticket.buyer_email}</Field>
        <Field label="ID orden" copy={ticket.order_id ?? undefined} />
        <Field label="Check-in" mono>{fmtDate(ticket.checked_in_at)}</Field>
      </FieldList>

      <DrawerSectionTitle>Enlace</DrawerSectionTitle>
      <FieldList>
        <Field label="Ver entrada">
          {ticket.public_token ? <Link href={`/t?token=${ticket.public_token}`} className="rg-link">Abrir entrada →</Link> : undefined}
        </Field>
      </FieldList>
    </Drawer>
  );
}

export default function TicketsPanel({ query: globalQuery }: { query: string }) {
  const [tickets, setTickets] = useState<AdminTicket[] | null>(null);
  const [events, setEvents] = useState<AdminEventSummary[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState('');
  const [eventFilter, setEventFilter] = useState('');
  const [localQuery, setLocalQuery] = useState('');
  const [busy, setBusy] = useState<string | null>(null);
  const [selected, setSelected] = useState<AdminTicket | null>(null);
  const { toasts, push, dismiss } = useToasts();

  const query = globalQuery || localQuery;

  const notify = useCallback((kind: 'ok' | 'error', msg: string) => {
    push(kind, msg);
    if (kind === 'ok') { setNotice(msg); setError(null); }
    else { setError(msg); setNotice(null); }
  }, [push]);

  const load = useCallback((filters: { status?: string; event_id?: string }) => {
    setError(null);
    adminApi.listAllTickets(filters)
      .then((r) => setTickets(r.tickets))
      .catch((err) => {
        const s = (err as ApiError)?.status;
        setError(s === 401 ? 'Sesión expirada.' : 'No se pudieron cargar las entradas.');
        setTickets([]);
      });
  }, []);

  useEffect(() => {
    load({ status: statusFilter || undefined, event_id: eventFilter || undefined });
  }, [load, statusFilter, eventFilter]);

  useEffect(() => {
    adminApi.listAllEvents('all').then((r) => setEvents(r.events)).catch(() => setEvents([]));
  }, []);

  function applyUpdate(token: string, patch: TicketPatch) {
    setTickets((cur) => (cur ? cur.map((t) => (t.public_token === token
      ? { ...t, status: patch.status ?? t.status, checked_in_at: patch.checked_in_at ?? t.checked_in_at }
      : t)) : cur));
    setSelected((cur) => (cur && cur.public_token === token
      ? { ...cur, status: patch.status ?? cur.status, checked_in_at: patch.checked_in_at ?? cur.checked_in_at }
      : cur));
  }

  async function run(t: AdminTicket, action: () => Promise<{ ticket: TicketPatch }>, msg: string) {
    setBusy(t.public_token);
    try {
      const { ticket } = await action();
      applyUpdate(t.public_token, ticket);
      notify('ok', msg);
    } catch {
      notify('error', 'No se pudo completar la acción.');
    } finally {
      setBusy(null);
    }
  }

  const checkIn = (t: AdminTicket) => run(t, () => adminApi.checkIn(t.public_token), `Entrada ${t.code} registrada.`);
  const undo = (t: AdminTicket) => run(t, () => adminApi.undoCheckIn(t.public_token), `Check-in de ${t.code} deshecho.`);
  const voidIt = (t: AdminTicket) => run(t, () => adminApi.voidTicket(t.public_token), `Entrada ${t.code} anulada.`);

  const filtered = (tickets || []).filter((t) => {
    if (!query) return true;
    const hay = `${t.code} ${t.buyer_email} ${t.event_name || ''} ${t.seat_label || ''}`.toLowerCase();
    return hay.includes(query.toLowerCase());
  });

  const columns: Column<AdminTicket>[] = [
    { key: 'code', header: 'Código', render: (t) => <span className="rg-mono rg-cell-primary">{t.code}</span> },
    { key: 'status', header: 'Estado', render: (t) => <StatusBadge status={t.status} /> },
    { key: 'event', header: 'Evento', render: (t) => t.event_name || '—' },
    { key: 'seat', header: 'Asiento', render: (t) => t.seat_label || 'General' },
    { key: 'buyer', header: 'Comprador', render: (t) => <span className="rg-cell-sub">{t.buyer_email}</span> },
    { key: 'actions', header: '', align: 'right', render: (t) => (
      <div style={{ display: 'inline-flex', gap: 6, alignItems: 'center' }}
        onClick={(e) => e.stopPropagation()}>
        {t.status === 'valid' && (
          <Button variant="primary" small data-testid={`check-in-${t.code}`} disabled={busy === t.public_token}
            onClick={() => checkIn(t)}>Check-in</Button>
        )}
        {t.status === 'used' && (
          <ConfirmAction testId={`undo-${t.code}`} label="Deshacer" confirmLabel="Sí" prompt="¿Deshacer?"
            busy={busy === t.public_token} onConfirm={() => undo(t)} />
        )}
        {t.status !== 'void' && (
          <ConfirmAction testId={`void-${t.code}`} label="Anular" confirmLabel="Sí, anular" prompt="¿Anular?"
            busy={busy === t.public_token} onConfirm={() => voidIt(t)} />
        )}
      </div>
    ) },
  ];

  return (
    <div>
      <div className="rg-page-head">
        <div>
          <h1>Entradas</h1>
          <p>Todas las entradas de todos los eventos.</p>
        </div>
        <div className="rg-page-head-actions">
          <Link href="/admin/check-in" className="rg-btn rg-btn-secondary">Control de puerta →</Link>
        </div>
      </div>

      <Toolbar>
        <SearchBox testId="ticket-search" placeholder="Buscar código, comprador o evento…" value={localQuery} onChange={setLocalQuery} />
        <Select testId="ticket-status-filter" ariaLabel="Filtrar por estado" value={statusFilter} onChange={setStatusFilter}>
          <option value="">Todos los estados</option>
          <option value="valid">Válidas</option>
          <option value="used">Usadas</option>
          <option value="void">Anuladas</option>
        </Select>
        <Select testId="ticket-event-filter" ariaLabel="Filtrar por evento" value={eventFilter} onChange={setEventFilter}>
          <option value="">Todos los eventos</option>
          {events.map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}
        </Select>
      </Toolbar>

      {error && <Feedback kind="error">{error}</Feedback>}
      {notice && <Feedback kind="ok">{notice}</Feedback>}

      <div data-testid="tickets-list">
        <DataTable
          columns={columns}
          rows={tickets === null ? null : filtered}
          rowKey={(t) => t.public_token}
          rowTestId="ticket-row"
          onRowClick={setSelected}
          empty={<EmptyState icon={<IconTicket />} title="Sin entradas"
            description="No hay entradas que coincidan con los filtros." />}
        />
      </div>

      {selected && (
        <TicketDrawer ticket={selected} busy={busy === selected.public_token}
          onClose={() => setSelected(null)}
          onCheckIn={() => checkIn(selected)}
          onUndo={() => undo(selected)}
          onVoid={() => voidIt(selected)} />
      )}

      <ToastStack toasts={toasts} onDismiss={dismiss} />
    </div>
  );
}
