'use client';

// Orders resource: a GLOBAL list of every order across all events. Filter by
// status, search by buyer, expand a row for detail, and cancel a paid/pending
// order (with confirm). Comp orders are issued from the event flow — linked here.

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { adminApi, ApiError } from '@/lib/ticketing/admin';
import { ui } from '@/lib/ticketing/ui';
import type { AdminGlobalOrder } from '@/lib/ticketing/admin';
import { StatusPill, fmtDate, Feedback, ConfirmAction, selectStyle, searchStyle } from '../shared';

function buyerName(o: AdminGlobalOrder): string {
  const name = [o.buyer_first_name, o.buyer_last_name].filter(Boolean).join(' ').trim();
  return name || o.buyer_email;
}

// Orders that can still be cancelled.
const CANCELLABLE = new Set(['paid', 'pending', 'comp']);

export default function OrdersPanel() {
  const [orders, setOrders] = useState<AdminGlobalOrder[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState('');
  const [query, setQuery] = useState('');
  const [expanded, setExpanded] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback((status?: string) => {
    setError(null);
    adminApi.listAllOrders(status ? { status } : {})
      .then((r) => setOrders(r.orders))
      .catch((err) => {
        const s = (err as ApiError)?.status;
        setError(s === 401 ? 'Sesión expirada.' : 'No se pudieron cargar las órdenes.');
        setOrders([]);
      });
  }, []);

  useEffect(() => { load(statusFilter || undefined); }, [load, statusFilter]);

  async function cancel(o: AdminGlobalOrder) {
    setBusy(o.id);
    setError(null);
    setNotice(null);
    try {
      const { order } = await adminApi.cancelOrder(o.id);
      setOrders((cur) => (cur ? cur.map((x) => (x.id === o.id ? { ...x, ...order } : x)) : cur));
      setNotice(`Orden de ${buyerName(o)} cancelada.`);
    } catch {
      setError('No se pudo cancelar la orden.');
    } finally {
      setBusy(null);
    }
  }

  const filtered = (orders || []).filter((o) => {
    if (!query) return true;
    const hay = `${o.buyer_email} ${o.buyer_first_name || ''} ${o.buyer_last_name || ''} ${o.event_name || ''} ${o.payment_ref || ''}`.toLowerCase();
    return hay.includes(query.toLowerCase());
  });

  return (
    <div>
      <h1 className={ui.h1}>Órdenes</h1>
      <p className={ui.muted}>Todas las órdenes de todos los eventos.</p>

      <div className={`${ui.card} flex gap-3 items-center flex-wrap`}>
        <select data-testid="order-status-filter" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} style={selectStyle}>
          <option value="">Todos los estados</option>
          <option value="paid">Pagadas</option>
          <option value="pending">Pendientes</option>
          <option value="comp">Comp</option>
          <option value="cancelled">Canceladas</option>
          <option value="expired">Expiradas</option>
        </select>
        <input data-testid="order-search" placeholder="Buscar comprador, evento o referencia…" value={query} onChange={(e) => setQuery(e.target.value)} style={searchStyle} />
      </div>

      {error && <Feedback kind="error">{error}</Feedback>}
      {notice && <Feedback kind="ok">{notice}</Feedback>}

      <div className={ui.card} data-testid="orders-list">
        {orders === null ? (
          <p className="text-[var(--color-text-muted)]">Cargando órdenes...</p>
        ) : filtered.length === 0 ? (
          <p className="text-[var(--color-text-muted)]">No hay órdenes.</p>
        ) : (
          <div className="flex flex-col gap-2">
            {filtered.map((o) => (
              <div key={o.id} data-testid="order-row" className="py-2.5 border-b border-[var(--color-border)] last:border-0">
                <div className="flex items-center justify-between gap-3 flex-wrap">
                  <button type="button" className="min-w-0 text-left cursor-pointer flex-1" onClick={() => setExpanded((e) => (e === o.id ? null : o.id))}>
                    <div className="text-sm">{buyerName(o)}</div>
                    <div className="text-xs text-[var(--color-text-muted)]">
                      {o.event_name || '—'} · {o.ticket_count} entrada{o.ticket_count === 1 ? '' : 's'}
                    </div>
                  </button>
                  <div className="flex items-center gap-3 whitespace-nowrap">
                    <StatusPill status={o.status} />
                    <span className="font-[Bebas_Neue] text-xl text-[var(--color-gold)]">S/ {o.total}</span>
                  </div>
                </div>

                {expanded === o.id && (
                  <div data-testid="order-detail" className="mt-2 pl-2 border-l-2 border-[var(--color-border)] text-xs text-[var(--color-text-muted)] flex flex-col gap-1">
                    <div>{o.buyer_email}</div>
                    <div>{o.paid_at ? `Pagado ${fmtDate(o.paid_at)}` : `Creado ${fmtDate(o.inserted_at)}`}{o.payment_ref ? ` · ${o.payment_ref}` : ''}</div>
                    <div className="mt-1">
                      {CANCELLABLE.has(o.status) ? (
                        <ConfirmAction
                          testId={`cancel-order-${o.id}`}
                          label="Cancelar orden"
                          confirmLabel="Sí, cancelar"
                          prompt="¿Cancelar esta orden?"
                          busy={busy === o.id}
                          onConfirm={() => cancel(o)}
                        />
                      ) : (
                        <span className="text-[var(--color-text-faint)]">Sin acciones disponibles.</span>
                      )}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      <p className={ui.muted}>
        ¿Necesitas regalar entradas? Emite una orden comp desde un evento:{' '}
        <Link href="/band/tickets/evento" className="text-[#00e5ff] underline">elige el evento →</Link>
      </p>
    </div>
  );
}
