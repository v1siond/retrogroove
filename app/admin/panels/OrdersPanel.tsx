'use client';

// Órdenes resource — a GLOBAL table across every event. Filter by status + event,
// search by buyer/event/ref. Clicking a row opens the detail drawer with every
// order field plus its tickets; cancel a paid/pending/comp order from there.
// Comp orders are issued from the Emitir flow (linked).

import { useEffect, useState, useCallback, FormEvent } from 'react';
import Link from 'next/link';
import { adminApi, ApiError } from '@/lib/ticketing/admin';
import type { AdminGlobalOrder, AdminEventSummary } from '@/lib/ticketing/admin';
import type { Ticket } from '@/lib/ticketing/types';
import { ticketingApi } from '@/lib/ticketing/api';
import {
  DataTable, Column, Drawer, Field, FieldList, DrawerSectionTitle, StatusBadge,
  Toolbar, SearchBox, Select, Button, ConfirmAction, Feedback, EmptyState,
  ToastStack, useToasts, fmtDate, fmtMoney, IconReceipt,
} from '../console/ui';

const CANCELLABLE = new Set(['paid', 'pending', 'comp']);

function buyerName(o: AdminGlobalOrder): string {
  const name = [o.buyer_first_name, o.buyer_last_name].filter(Boolean).join(' ').trim();
  return name || o.buyer_email;
}

// ── Buyer edit form ──────────────────────────────────────────────────────────
// A Yapeo confirmed before the buyer sent their name/email leaves the order with empty
// contact fields; this is how the band fills them in without touching status or tickets.

interface OrderForm { first_name: string; last_name: string; email: string; phone: string; payment_ref: string }

function formFromOrder(o: AdminGlobalOrder): OrderForm {
  return {
    first_name: o.buyer_first_name || '',
    last_name: o.buyer_last_name || '',
    email: o.buyer_email || '',
    phone: o.buyer_phone || '',
    payment_ref: o.payment_ref || '',
  };
}

function OrderFields({
  form, setField, onSubmit,
}: {
  form: OrderForm;
  setField: (k: keyof OrderForm, v: string) => void;
  onSubmit: (e: FormEvent) => void;
}) {
  return (
    <form id="order-form" data-testid="order-form" onSubmit={onSubmit}>
      <DrawerSectionTitle>Comprador</DrawerSectionTitle>
      <div className="rg-form-grid">
        <div className="rg-field">
          <label className="rg-label" htmlFor="order-first-name">Nombre</label>
          <input id="order-first-name" data-testid="order-first-name" className="rg-input"
            value={form.first_name} onChange={(e) => setField('first_name', e.target.value)} />
        </div>
        <div className="rg-field">
          <label className="rg-label" htmlFor="order-last-name">Apellido</label>
          <input id="order-last-name" data-testid="order-last-name" className="rg-input"
            value={form.last_name} onChange={(e) => setField('last_name', e.target.value)} />
        </div>
      </div>
      <div className="rg-field">
        <label className="rg-label" htmlFor="order-email">Email</label>
        <input id="order-email" data-testid="order-email" type="email" className="rg-input"
          value={form.email} onChange={(e) => setField('email', e.target.value)} />
      </div>
      <div className="rg-field">
        <label className="rg-label" htmlFor="order-phone">Teléfono</label>
        <input id="order-phone" data-testid="order-phone" className="rg-input"
          value={form.phone} onChange={(e) => setField('phone', e.target.value)} />
      </div>

      <DrawerSectionTitle>Pago</DrawerSectionTitle>
      <div className="rg-field">
        <label className="rg-label" htmlFor="order-payment-ref">N.° de operación</label>
        <input id="order-payment-ref" data-testid="order-payment-ref" className="rg-input" data-mono="true"
          value={form.payment_ref} onChange={(e) => setField('payment_ref', e.target.value)} />
      </div>
    </form>
  );
}

// ── Order detail drawer ──────────────────────────────────────────────────────

function OrderDrawer({
  order, onClose, onUpdated, notify,
}: {
  order: AdminGlobalOrder;
  onClose: () => void;
  onUpdated: (o: AdminGlobalOrder) => void;
  notify: (kind: 'ok' | 'error', msg: string) => void;
}) {
  const [busy, setBusy] = useState(false);
  const [tickets, setTickets] = useState<Ticket[] | null>(null);
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState<OrderForm>(() => formFromOrder(order));
  const setField = (k: keyof OrderForm, v: string) => setForm((f) => ({ ...f, [k]: v }));

  useEffect(() => {
    let on = true;
    // The order's tickets come from the public order endpoint (it returns them by id).
    ticketingApi
      .getOrder(order.id)
      .then((r) => { if (on) setTickets(r.order.tickets || []); })
      .catch(() => { if (on) setTickets([]); });
    return () => { on = false; };
  }, [order.id]);

  async function cancel() {
    setBusy(true);
    try {
      const { order: updated } = await adminApi.cancelOrder(order.id);
      onUpdated({ ...order, ...updated });
      notify('ok', `Orden de ${buyerName(order)} cancelada.`);
    } catch {
      notify('error', 'No se pudo cancelar la orden.');
    } finally {
      setBusy(false);
    }
  }

  // Manual/Yape orders arrive as "pending"; the band verifies the Yapeo, then marks paid
  // here — which issues the tickets and emails the buyer (backend POST /orders/:id/confirm).
  async function confirm() {
    setBusy(true);
    try {
      const { order: updated } = await adminApi.confirmOrder(order.id);
      onUpdated({ ...order, ...updated });
      notify('ok', `Pago de ${buyerName(order)} confirmado — entradas emitidas.`);
    } catch {
      notify('error', 'No se pudo confirmar el pago.');
    } finally {
      setBusy(false);
    }
  }

  // Save the corrected buyer details. A failed save keeps the form open with what was
  // typed so nothing is lost. Sends no email — that's what "Reenviar entradas" is for.
  async function save(e?: FormEvent) {
    e?.preventDefault();
    setBusy(true);
    try {
      const { order: updated } = await adminApi.updateOrder(order.id, {
        buyer: {
          first_name: form.first_name,
          last_name: form.last_name,
          email: form.email,
          phone: form.phone,
        },
        payment_ref: form.payment_ref,
      });
      onUpdated({ ...order, ...updated });
      setEditing(false);
      notify('ok', 'Datos del comprador guardados.');
    } catch {
      notify('error', 'No se pudieron guardar los datos.');
    } finally {
      setBusy(false);
    }
  }

  function startEdit() {
    setForm(formFromOrder(order));
    setEditing(true);
  }

  // Re-send the ticket email (the buyer's link again) for a paid/comp order.
  async function resend() {
    setBusy(true);
    try {
      await adminApi.resendOrder(order.id);
      notify('ok', `Entradas reenviadas a ${order.buyer_email || buyerName(order)}.`);
    } catch {
      notify('error', 'No se pudo reenviar el correo.');
    } finally {
      setBusy(false);
    }
  }

  // While editing, the order actions step aside — one intent at a time, and it keeps
  // "Marcar como pagada" from firing on top of unsaved changes.
  const footer = editing ? (
    <>
      {/* Deliberately NOT type="submit" + form=: React reuses this DOM node when the
          footer swaps, so the click that opened edit mode would still carry its default
          action into the freshly-swapped button and submit an untouched form. */}
      <Button variant="primary" data-testid={`save-order-${order.id}`} disabled={busy} onClick={() => save()}>
        {busy ? 'Guardando…' : 'Guardar'}
      </Button>
      <Button variant="ghost" disabled={busy} onClick={() => setEditing(false)}>Cancelar</Button>
    </>
  ) : (
    <>
      <Button variant="secondary" data-testid={`edit-order-${order.id}`} disabled={busy} onClick={startEdit}>
        Editar datos
      </Button>
      {order.status === 'pending' && (
        <Button variant="primary" data-testid={`confirm-order-${order.id}`} disabled={busy} onClick={confirm}>
          {busy ? 'Confirmando…' : 'Marcar como pagada'}
        </Button>
      )}
      {(order.status === 'paid' || order.status === 'comp') && (
        <Button variant="secondary" data-testid={`resend-order-${order.id}`} disabled={busy} onClick={resend}>
          {busy ? 'Enviando…' : 'Reenviar entradas'}
        </Button>
      )}
      {CANCELLABLE.has(order.status) && (
        <ConfirmAction testId={`cancel-order-${order.id}`} label="Cancelar orden" confirmLabel="Sí, cancelar"
          prompt="¿Cancelar esta orden?" busy={busy} onConfirm={cancel} />
      )}
      {!CANCELLABLE.has(order.status) && order.status !== 'pending' && (
        <span className="rg-cell-sub">Una orden {order.status} solo admite editar sus datos.</span>
      )}
    </>
  );

  return (
    <Drawer open onClose={onClose} testId="order-detail" title={buyerName(order)}
      subtitle={<><StatusBadge status={order.status} /> · {order.event_name || '—'}</>} footer={footer}>
      <FieldList>
        <Field label="ID orden" copy={order.id} />
        <Field label="Estado"><StatusBadge status={order.status} /></Field>
        <Field label="Evento">{order.event_name}</Field>
        <Field label="ID evento" copy={order.event_id} />
        <Field label="Total" mono>{fmtMoney(order.total)}</Field>
        <Field label="Entradas" mono>{order.ticket_count}</Field>
      </FieldList>

      {editing ? (
        <OrderFields form={form} setField={setField} onSubmit={save} />
      ) : (
        <>
          <DrawerSectionTitle>Comprador</DrawerSectionTitle>
          <FieldList>
            <Field label="Nombre">{[order.buyer_first_name, order.buyer_last_name].filter(Boolean).join(' ')}</Field>
            <Field label="Email">{order.buyer_email}</Field>
            <Field label="Teléfono">{order.buyer_phone}</Field>
          </FieldList>

          <DrawerSectionTitle>Pago</DrawerSectionTitle>
          <FieldList>
            <Field label="N.° de operación" copy={order.payment_ref} />
            <Field label="Pagada" mono>{fmtDate(order.paid_at)}</Field>
            <Field label="Creada" mono>{fmtDate(order.inserted_at)}</Field>
          </FieldList>
          {order.status === 'pending' && (
            <Feedback kind="error">
              Verifica el Yapeo (monto, nombre y N.° de operación) en tu app antes de marcar como pagada.
            </Feedback>
          )}
        </>
      )}

      <DrawerSectionTitle>Entradas ({tickets?.length ?? order.ticket_count})</DrawerSectionTitle>
      <div data-testid="order-tickets">
        {tickets === null ? (
          <p className="rg-cell-sub">Cargando…</p>
        ) : tickets.length === 0 ? (
          <p className="rg-cell-sub">Sin entradas emitidas todavía.</p>
        ) : (
          <FieldList>
            {tickets.map((t) => (
              <div key={t.id} data-testid="order-ticket-row" className="rg-fieldrow">
                <dt style={{ textTransform: 'none', letterSpacing: 0 }}>
                  <span className="rg-mono">{t.code || '—'}</span>
                  <div className="rg-cell-sub">
                    {t.table_label && <strong>Mesa {t.table_label} · </strong>}
                    {t.seat_label || t.section_name || 'General'}
                  </div>
                </dt>
                <dd style={{ display: 'flex', gap: 8, alignItems: 'center', justifyContent: 'flex-end' }}>
                  <StatusBadge status={t.status} />
                  {t.public_token && (
                    <a href={`/t?token=${t.public_token}`} target="_blank" rel="noopener noreferrer" className="rg-link">ver →</a>
                  )}
                </dd>
              </div>
            ))}
          </FieldList>
        )}
      </div>
    </Drawer>
  );
}

// ── Panel root ───────────────────────────────────────────────────────────────

export default function OrdersPanel({ query: globalQuery }: { query: string }) {
  const [orders, setOrders] = useState<AdminGlobalOrder[] | null>(null);
  const [events, setEvents] = useState<AdminEventSummary[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState('');
  const [eventFilter, setEventFilter] = useState('');
  const [localQuery, setLocalQuery] = useState('');
  const [selected, setSelected] = useState<AdminGlobalOrder | null>(null);
  const { toasts, push, dismiss } = useToasts();

  // Surface action results both as a toast (corporate touch) and as an inline
  // banner (in-context confirmation / the e2e feedback-ok|error contract).
  const notify = useCallback((kind: 'ok' | 'error', msg: string) => {
    push(kind, msg);
    if (kind === 'ok') { setNotice(msg); setError(null); }
    else { setError(msg); setNotice(null); }
  }, [push]);

  const query = globalQuery || localQuery;

  const load = useCallback((filters: { status?: string; event_id?: string }) => {
    setError(null);
    adminApi.listAllOrders(filters)
      .then((r) => setOrders(r.orders))
      .catch((err) => {
        const s = (err as ApiError)?.status;
        setError(s === 401 ? 'Sesión expirada.' : 'No se pudieron cargar las órdenes.');
        setOrders([]);
      });
  }, []);

  useEffect(() => {
    load({ status: statusFilter || undefined, event_id: eventFilter || undefined });
  }, [load, statusFilter, eventFilter]);

  // Event options for the filter — best-effort, all events.
  useEffect(() => {
    adminApi.listAllEvents('all').then((r) => setEvents(r.events)).catch(() => setEvents([]));
  }, []);

  const filtered = (orders || []).filter((o) => {
    if (!query) return true;
    const hay = `${o.buyer_email} ${o.buyer_first_name || ''} ${o.buyer_last_name || ''} ${o.event_name || ''} ${o.payment_ref || ''}`.toLowerCase();
    return hay.includes(query.toLowerCase());
  });

  const columns: Column<AdminGlobalOrder>[] = [
    { key: 'buyer', header: 'Comprador', render: (o) => (
      <div>
        <div className="rg-cell-primary">{buyerName(o)}</div>
        <div className="rg-cell-sub">{o.buyer_email}</div>
      </div>
    ) },
    { key: 'event', header: 'Evento', render: (o) => o.event_name || '—' },
    { key: 'status', header: 'Estado', render: (o) => <StatusBadge status={o.status} /> },
    { key: 'tickets', header: 'Entr.', align: 'right', render: (o) => <span className="rg-mono">{o.ticket_count}</span> },
    { key: 'total', header: 'Total', align: 'right', render: (o) => <span className="rg-mono">{fmtMoney(o.total)}</span> },
    { key: 'paid', header: 'Pagada', render: (o) => <span className="rg-mono">{o.paid_at ? fmtDate(o.paid_at) : '—'}</span> },
  ];

  return (
    <div>
      <div className="rg-page-head">
        <div>
          <h1>Órdenes</h1>
          <p>Todas las órdenes de todos los eventos.</p>
        </div>
        <div className="rg-page-head-actions">
          <Link href="/admin/evento" className="rg-btn rg-btn-primary">Crear comp →</Link>
        </div>
      </div>

      <Toolbar>
        <SearchBox testId="order-search" placeholder="Buscar comprador, evento o referencia…" value={localQuery} onChange={setLocalQuery} />
        <Select testId="order-status-filter" ariaLabel="Filtrar por estado" value={statusFilter} onChange={setStatusFilter}>
          <option value="">Todos los estados</option>
          <option value="paid">Pagadas</option>
          <option value="pending">Pendientes</option>
          <option value="comp">Comp</option>
          <option value="cancelled">Canceladas</option>
          <option value="expired">Expiradas</option>
        </Select>
        <Select testId="order-event-filter" ariaLabel="Filtrar por evento" value={eventFilter} onChange={setEventFilter}>
          <option value="">Todos los eventos</option>
          {events.map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}
        </Select>
      </Toolbar>

      {error && <Feedback kind="error">{error}</Feedback>}
      {notice && <Feedback kind="ok">{notice}</Feedback>}

      <div data-testid="orders-list">
        <DataTable
          columns={columns}
          rows={orders === null ? null : filtered}
          rowKey={(o) => o.id}
          rowTestId="order-row"
          onRowClick={setSelected}
          empty={<EmptyState icon={<IconReceipt />} title="Sin órdenes"
            description="No hay órdenes que coincidan con los filtros." />}
        />
      </div>

      {selected && (
        <OrderDrawer order={selected} notify={notify} onClose={() => setSelected(null)}
          onUpdated={(o) => {
            setOrders((cur) => (cur ? cur.map((x) => (x.id === o.id ? o : x)) : cur));
            setSelected(o);
          }} />
      )}

      <ToastStack toasts={toasts} onDismiss={dismiss} />
    </div>
  );
}
