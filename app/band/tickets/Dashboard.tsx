'use client';

import { useEffect, useState, useCallback, FormEvent } from 'react';
import Link from 'next/link';
import { adminApi, ApiError } from '@/lib/ticketing/admin';
import { ui } from '@/lib/ticketing/ui';
import type { AdminEventSummary, AdminOrder, AdminTicket } from '@/lib/ticketing/admin';

// ── helpers ──────────────────────────────────────────────────────────────────

function fmtDate(iso: string | null | undefined): string {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleString('es-PE', {
      day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit',
    });
  } catch {
    return iso;
  }
}

function buyerName(o: AdminOrder): string {
  const name = [o.buyer_first_name, o.buyer_last_name].filter(Boolean).join(' ').trim();
  return name || o.buyer_email;
}

const STATUS_COLORS: Record<string, string> = {
  paid: 'var(--color-green)',
  comp: 'var(--color-cyan)',
  pending: 'var(--color-gold)',
  expired: 'var(--color-text-faint)',
  cancelled: 'var(--color-red)',
  valid: 'var(--color-green)',
  used: 'var(--color-text-faint)',
  void: 'var(--color-red)',
  published: 'var(--color-green)',
  draft: 'var(--color-gold)',
};

function StatusPill({ status }: { status: string }) {
  const color = STATUS_COLORS[status] || 'var(--color-text-muted)';
  return (
    <span
      data-status={status}
      style={{
        fontSize: '0.62rem', letterSpacing: '0.08em', textTransform: 'uppercase', fontWeight: 600,
        color, border: `1px solid ${color}`, borderRadius: 'var(--radius-pill)', padding: '3px 10px',
        whiteSpace: 'nowrap',
      }}
    >
      {status}
    </span>
  );
}

// ── editable event fields ────────────────────────────────────────────────────

interface EditForm {
  name: string;
  starts_at: string;
  venue_name: string;
  venue_address: string;
  venue_photo_url: string;
  flyer_url: string;
  map_url: string;
  description: string;
}

// Convert an ISO timestamp to the value a datetime-local input expects.
function toLocalInput(iso: string): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

// ── event detail (orders / tickets / edit / delete) ──────────────────────────

function EventDetail({
  event,
  onBack,
  onDeleted,
}: {
  event: AdminEventSummary;
  onBack: () => void;
  onDeleted: () => void;
}) {
  const [orders, setOrders] = useState<AdminOrder[] | null>(null);
  const [tickets, setTickets] = useState<AdminTicket[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState<EditForm | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    let active = true;
    setError(null);
    Promise.all([adminApi.listOrders(event.id), adminApi.listTickets(event.id)])
      .then(([o, t]) => {
        if (!active) return;
        setOrders(o.orders);
        setTickets(t.tickets);
      })
      .catch(() => active && setError('No se pudieron cargar las órdenes/entradas.'));
    return () => { active = false; };
  }, [event.id]);

  // Seed the edit form from the full event record.
  useEffect(() => {
    let active = true;
    adminApi.getEvent(event.slug).then((r) => {
      if (!active) return;
      const e = r.event;
      setForm({
        name: e.name || '',
        starts_at: toLocalInput(e.starts_at),
        venue_name: e.venue_name || '',
        venue_address: e.venue_address || '',
        venue_photo_url: e.venue_photo_url || '',
        flyer_url: e.flyer_url || '',
        map_url: e.map_url || '',
        description: e.description || '',
      });
    }).catch(() => {
      // Fall back to the summary fields if the full fetch fails.
      if (!active) return;
      setForm({
        name: event.name || '',
        starts_at: toLocalInput(event.starts_at),
        venue_name: event.venue_name || '',
        venue_address: '', venue_photo_url: '', flyer_url: '', map_url: '', description: '',
      });
    });
    return () => { active = false; };
  }, [event]);

  const setField = (k: keyof EditForm, v: string) =>
    setForm((f) => (f ? { ...f, [k]: v } : f));

  async function save(e: FormEvent) {
    e.preventDefault();
    if (!form) return;
    setSaving(true);
    setSaved(false);
    setError(null);
    try {
      const attrs: Record<string, unknown> = {
        name: form.name,
        venue_name: form.venue_name,
        venue_address: form.venue_address,
        venue_photo_url: form.venue_photo_url,
        flyer_url: form.flyer_url,
        map_url: form.map_url,
        description: form.description,
      };
      if (form.starts_at) attrs.starts_at = new Date(form.starts_at).toISOString();
      await adminApi.updateEvent(event.id, attrs);
      setSaved(true);
    } catch {
      setError('No se pudo guardar el evento.');
    } finally {
      setSaving(false);
    }
  }

  async function doDelete() {
    setDeleting(true);
    setError(null);
    try {
      await adminApi.deleteEvent(event.id);
      onDeleted();
    } catch {
      setError('No se pudo eliminar el evento.');
      setDeleting(false);
    }
  }

  return (
    <div data-testid="event-detail">
      <button type="button" className="text-[#00e5ff] underline text-sm" onClick={onBack}>
        ← Todos los eventos
      </button>
      <h1 className={ui.h1}>{event.name}</h1>
      <p className={ui.muted}>{fmtDate(event.starts_at)}{event.venue_name ? ` · ${event.venue_name}` : ''}</p>

      {error && <p className={ui.error} role="alert">{error}</p>}

      {/* ── Orders / payments ── */}
      <h2 className={ui.h2}>Órdenes</h2>
      <div className={ui.card} data-testid="orders-panel">
        {orders === null ? (
          <p className="text-[var(--color-text-muted)]">Cargando órdenes...</p>
        ) : orders.length === 0 ? (
          <p className="text-[var(--color-text-muted)]">Sin órdenes todavía.</p>
        ) : (
          <div className="flex flex-col gap-2">
            {orders.map((o) => (
              <div
                key={o.id}
                data-testid="order-row"
                className="flex items-center justify-between gap-3 py-2.5 border-b border-[var(--color-border)] last:border-0 flex-wrap"
              >
                <div className="min-w-0">
                  <div className="text-sm">{buyerName(o)}</div>
                  <div className="text-xs text-[var(--color-text-muted)]">
                    {o.buyer_email} · {o.ticket_count} entrada{o.ticket_count === 1 ? '' : 's'}
                  </div>
                  <div className="text-xs text-[var(--color-text-faint)]">
                    {o.paid_at ? `Pagado ${fmtDate(o.paid_at)}` : `Creado ${fmtDate(o.inserted_at)}`}
                    {o.payment_ref ? ` · ${o.payment_ref}` : ''}
                  </div>
                </div>
                <div className="flex items-center gap-3 whitespace-nowrap">
                  <StatusPill status={o.status} />
                  <span className="font-[Bebas_Neue] text-xl text-[var(--color-gold)]">S/ {o.total}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Tickets ── */}
      <h2 className={ui.h2}>Entradas</h2>
      <div className={ui.card} data-testid="tickets-panel">
        {tickets === null ? (
          <p className="text-[var(--color-text-muted)]">Cargando entradas...</p>
        ) : tickets.length === 0 ? (
          <p className="text-[var(--color-text-muted)]">Sin entradas todavía.</p>
        ) : (
          <div className="flex flex-col gap-2">
            {tickets.map((t) => (
              <div
                key={t.code}
                data-testid="ticket-row"
                className="flex items-center justify-between gap-3 py-2.5 border-b border-[var(--color-border)] last:border-0 flex-wrap"
              >
                <div className="min-w-0">
                  <div className="text-sm font-mono">{t.code}</div>
                  <div className="text-xs text-[var(--color-text-muted)]">
                    {t.seat_label || 'General'} · {t.buyer_email}
                  </div>
                  {t.checked_in_at && (
                    <div className="text-xs text-[var(--color-text-faint)]">Ingresó {fmtDate(t.checked_in_at)}</div>
                  )}
                </div>
                <StatusPill status={t.status} />
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Edit ── */}
      <h2 className={ui.h2}>Editar evento</h2>
      {form && (
        <form className={ui.card} onSubmit={save} data-testid="edit-form">
          {saved && <p className="text-[var(--color-green)] mb-2">Guardado.</p>}

          <label className={ui.label} htmlFor="ev-name">Nombre</label>
          <input id="ev-name" className={ui.input} value={form.name} onChange={(e) => setField('name', e.target.value)} required />

          <label className={ui.label} htmlFor="ev-date">Fecha y hora</label>
          <input id="ev-date" type="datetime-local" className={ui.input} value={form.starts_at} onChange={(e) => setField('starts_at', e.target.value)} />

          <label className={ui.label} htmlFor="ev-venue">Lugar (venue)</label>
          <input id="ev-venue" className={ui.input} value={form.venue_name} onChange={(e) => setField('venue_name', e.target.value)} />

          <label className={ui.label} htmlFor="ev-address">Dirección</label>
          <input id="ev-address" className={ui.input} value={form.venue_address} onChange={(e) => setField('venue_address', e.target.value)} />

          <label className={ui.label} htmlFor="ev-venue-photo">Foto del lugar (URL)</label>
          <input id="ev-venue-photo" className={ui.input} value={form.venue_photo_url} onChange={(e) => setField('venue_photo_url', e.target.value)} />

          <label className={ui.label} htmlFor="ev-flyer">Flyer (URL)</label>
          <input id="ev-flyer" className={ui.input} value={form.flyer_url} onChange={(e) => setField('flyer_url', e.target.value)} />

          <label className={ui.label} htmlFor="ev-map">Mapa (URL)</label>
          <input id="ev-map" className={ui.input} value={form.map_url} onChange={(e) => setField('map_url', e.target.value)} />

          <label className={ui.label} htmlFor="ev-desc">Descripción</label>
          <textarea
            id="ev-desc"
            className={`${ui.input} min-h-24`}
            value={form.description}
            onChange={(e) => setField('description', e.target.value)}
          />

          <div>
            <button type="submit" className={ui.btn} disabled={saving}>
              {saving ? 'Guardando...' : 'Guardar cambios'}
            </button>
          </div>
        </form>
      )}

      {/* ── Delete ── */}
      <div className={ui.card}>
        {!confirmDelete ? (
          <button
            type="button"
            data-testid="delete-event"
            className="text-[var(--color-red)] underline cursor-pointer"
            onClick={() => setConfirmDelete(true)}
          >
            Eliminar evento
          </button>
        ) : (
          <div className="flex items-center gap-3 flex-wrap">
            <span className="text-[var(--color-red)]">¿Eliminar “{event.name}”? Esta acción no se puede deshacer.</span>
            <button
              type="button"
              data-testid="confirm-delete"
              className="px-4 py-2 rounded-full bg-[var(--color-red)] text-white cursor-pointer disabled:opacity-50"
              onClick={doDelete}
              disabled={deleting}
            >
              {deleting ? 'Eliminando...' : 'Sí, eliminar'}
            </button>
            <button type="button" className="underline text-[var(--color-text-muted)] cursor-pointer" onClick={() => setConfirmDelete(false)}>
              Cancelar
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ── dashboard root (event list ⇄ detail) ─────────────────────────────────────

export default function Dashboard() {
  const [events, setEvents] = useState<AdminEventSummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<AdminEventSummary | null>(null);

  const load = useCallback(() => {
    setError(null);
    adminApi
      .listAllEvents()
      .then((r) => setEvents(r.events))
      .catch((err) => {
        const status = (err as ApiError)?.status;
        setError(status === 401 ? 'Sesión expirada.' : 'No se pudieron cargar los eventos.');
        setEvents([]);
      });
  }, []);

  useEffect(() => { load(); }, [load]);

  if (selected) {
    return (
      <main className={ui.page}>
        <EventDetail
          event={selected}
          onBack={() => setSelected(null)}
          onDeleted={() => { setSelected(null); load(); }}
        />
      </main>
    );
  }

  return (
    <main className={ui.page}>
      <h1 className={ui.h1}>Eventos</h1>
      <div className={`${ui.card} flex gap-4 items-center flex-wrap`}>
        <Link href="/band/tickets/nuevo" className={ui.btn}>Nuevo evento</Link>
        <Link href="/band/tickets/check-in" className="text-[#00e5ff] underline">Check-in</Link>
      </div>

      {error && <p className={ui.error} role="alert">{error}</p>}

      <div className={ui.card} data-testid="events-list">
        {events === null ? (
          <p className="text-[var(--color-text-muted)]">Cargando eventos...</p>
        ) : events.length === 0 ? (
          <p className="text-[var(--color-text-muted)]">No hay eventos todavía.</p>
        ) : (
          <div className="flex flex-col gap-2">
            {events.map((ev) => (
              <button
                key={ev.id}
                type="button"
                data-testid="event-item"
                onClick={() => setSelected(ev)}
                className="flex items-center justify-between gap-3 py-3 px-3 rounded-xl text-left cursor-pointer border border-transparent hover:border-[var(--color-border)] hover:bg-white/5 transition"
              >
                <div className="min-w-0">
                  <div className="text-base">{ev.name}</div>
                  <div className="text-xs text-[var(--color-text-muted)]">
                    {fmtDate(ev.starts_at)}{ev.venue_name ? ` · ${ev.venue_name}` : ''}
                  </div>
                </div>
                <StatusPill status={ev.status} />
              </button>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
