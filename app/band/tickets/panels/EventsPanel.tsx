'use client';

// Events resource: list every event (any status), create, edit, delete,
// publish, and drill into a single event's orders + tickets. The drill-down
// reuses the per-event endpoints; the global Orders/Tickets panels cover the
// cross-event views.

import { useEffect, useState, useCallback, FormEvent } from 'react';
import Link from 'next/link';
import { adminApi, ApiError } from '@/lib/ticketing/admin';
import { ui } from '@/lib/ticketing/ui';
import type { AdminEventSummary, AdminOrder, AdminTicket } from '@/lib/ticketing/admin';
import { StatusPill, fmtDate, Feedback, ConfirmAction } from '../shared';

function buyerName(o: AdminOrder): string {
  const name = [o.buyer_first_name, o.buyer_last_name].filter(Boolean).join(' ').trim();
  return name || o.buyer_email;
}

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

const EMPTY_FORM: EditForm = {
  name: '', starts_at: '', venue_name: '', venue_address: '',
  venue_photo_url: '', flyer_url: '', map_url: '', description: '',
};

// Convert an ISO timestamp to the value a datetime-local input expects.
function toLocalInput(iso: string): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function formAttrs(form: EditForm): Record<string, unknown> {
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
  return attrs;
}

// ── create-event form ────────────────────────────────────────────────────────

function CreateEvent({ onCreated, onCancel }: { onCreated: () => void; onCancel: () => void }) {
  const [form, setForm] = useState<EditForm>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const set = (k: keyof EditForm, v: string) => setForm((f) => ({ ...f, [k]: v }));

  async function submit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      await adminApi.createEvent(formAttrs(form));
      onCreated();
    } catch {
      setError('No se pudo crear el evento.');
      setSaving(false);
    }
  }

  return (
    <form className={ui.card} onSubmit={submit} data-testid="create-event-form">
      <h2 className={ui.h2}>Nuevo evento</h2>
      {error && <Feedback kind="error">{error}</Feedback>}
      <label className={ui.label} htmlFor="new-name">Nombre</label>
      <input id="new-name" className={ui.input} value={form.name} onChange={(e) => set('name', e.target.value)} required />
      <label className={ui.label} htmlFor="new-date">Fecha y hora</label>
      <input id="new-date" type="datetime-local" className={ui.input} value={form.starts_at} onChange={(e) => set('starts_at', e.target.value)} />
      <label className={ui.label} htmlFor="new-venue">Lugar (venue)</label>
      <input id="new-venue" className={ui.input} value={form.venue_name} onChange={(e) => set('venue_name', e.target.value)} />
      <label className={ui.label} htmlFor="new-desc">Descripción</label>
      <textarea id="new-desc" className={`${ui.input} min-h-24`} value={form.description} onChange={(e) => set('description', e.target.value)} />
      <div className="flex gap-3 items-center">
        <button type="submit" className={ui.btn} disabled={saving}>{saving ? 'Creando...' : 'Crear evento'}</button>
        <button type="button" className="underline text-[var(--color-text-muted)] cursor-pointer" onClick={onCancel}>Cancelar</button>
      </div>
      <p className={ui.muted} style={{ marginTop: '10px', marginBottom: 0 }}>
        Para configurar secciones, mesas y precios usa el constructor visual:{' '}
        <Link href="/band/tickets/nuevo" className="text-[#00e5ff] underline">abrir constructor →</Link>
      </p>
    </form>
  );
}

// ── event detail (orders / tickets / edit / delete / publish) ────────────────

function EventDetail({
  event,
  onBack,
  onChanged,
}: {
  event: AdminEventSummary;
  onBack: () => void;
  onChanged: () => void;
}) {
  const [orders, setOrders] = useState<AdminOrder[] | null>(null);
  const [tickets, setTickets] = useState<AdminTicket[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState<EditForm | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [published, setPublished] = useState(event.status === 'published');

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
      if (!active) return;
      setForm({
        ...EMPTY_FORM,
        name: event.name || '',
        starts_at: toLocalInput(event.starts_at),
        venue_name: event.venue_name || '',
      });
    });
    return () => { active = false; };
  }, [event]);

  const setField = (k: keyof EditForm, v: string) => setForm((f) => (f ? { ...f, [k]: v } : f));

  async function save(e: FormEvent) {
    e.preventDefault();
    if (!form) return;
    setSaving(true);
    setSaved(false);
    setError(null);
    try {
      await adminApi.updateEvent(event.id, formAttrs(form));
      setSaved(true);
      onChanged();
    } catch {
      setError('No se pudo guardar el evento.');
    } finally {
      setSaving(false);
    }
  }

  async function publish() {
    setPublishing(true);
    setError(null);
    try {
      await adminApi.publishEvent(event.id);
      setPublished(true);
      onChanged();
    } catch {
      setError('No se pudo publicar el evento.');
    } finally {
      setPublishing(false);
    }
  }

  async function doDelete() {
    setError(null);
    try {
      await adminApi.deleteEvent(event.id);
      onBack();
      onChanged();
    } catch {
      setError('No se pudo eliminar el evento.');
    }
  }

  return (
    <div data-testid="event-detail">
      <button type="button" className="text-[#00e5ff] underline text-sm" onClick={onBack}>← Todos los eventos</button>
      <h1 className={ui.h1}>{event.name}</h1>
      <p className={ui.muted}>{fmtDate(event.starts_at)}{event.venue_name ? ` · ${event.venue_name}` : ''}</p>

      {error && <Feedback kind="error">{error}</Feedback>}

      {/* Actions */}
      <div className={`${ui.card} flex gap-4 items-center flex-wrap`}>
        <StatusPill status={published ? 'published' : event.status} />
        {!published && (
          <button type="button" data-testid="publish-event" className={ui.btn} style={{ marginTop: 0 }} onClick={publish} disabled={publishing}>
            {publishing ? 'Publicando...' : 'Publicar'}
          </button>
        )}
        <Link href={`/band/tickets/evento?slug=${event.slug}`} className="text-[#00e5ff] underline">Emitir comps / asientos →</Link>
      </div>

      {/* Orders */}
      <h2 className={ui.h2}>Órdenes</h2>
      <div className={ui.card} data-testid="event-orders-panel">
        {orders === null ? (
          <p className="text-[var(--color-text-muted)]">Cargando órdenes...</p>
        ) : orders.length === 0 ? (
          <p className="text-[var(--color-text-muted)]">Sin órdenes todavía.</p>
        ) : (
          <div className="flex flex-col gap-2">
            {orders.map((o) => (
              <div key={o.id} data-testid="order-row" className="flex items-center justify-between gap-3 py-2.5 border-b border-[var(--color-border)] last:border-0 flex-wrap">
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

      {/* Tickets */}
      <h2 className={ui.h2}>Entradas</h2>
      <div className={ui.card} data-testid="event-tickets-panel">
        {tickets === null ? (
          <p className="text-[var(--color-text-muted)]">Cargando entradas...</p>
        ) : tickets.length === 0 ? (
          <p className="text-[var(--color-text-muted)]">Sin entradas todavía.</p>
        ) : (
          <div className="flex flex-col gap-2">
            {tickets.map((t) => (
              <div key={t.code} data-testid="ticket-row" className="flex items-center justify-between gap-3 py-2.5 border-b border-[var(--color-border)] last:border-0 flex-wrap">
                <div className="min-w-0">
                  <div className="text-sm font-mono">{t.code}</div>
                  <div className="text-xs text-[var(--color-text-muted)]">{t.seat_label || 'General'} · {t.buyer_email}</div>
                  {t.checked_in_at && <div className="text-xs text-[var(--color-text-faint)]">Ingresó {fmtDate(t.checked_in_at)}</div>}
                </div>
                <StatusPill status={t.status} />
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Edit */}
      <h2 className={ui.h2}>Editar evento</h2>
      {form && (
        <form className={ui.card} onSubmit={save} data-testid="edit-form">
          {saved && <Feedback kind="ok">Guardado.</Feedback>}
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
          <textarea id="ev-desc" className={`${ui.input} min-h-24`} value={form.description} onChange={(e) => setField('description', e.target.value)} />
          <div><button type="submit" className={ui.btn} disabled={saving}>{saving ? 'Guardando...' : 'Guardar cambios'}</button></div>
        </form>
      )}

      {/* Delete */}
      <div className={ui.card}>
        <ConfirmAction
          testId="delete-event"
          label="Eliminar evento"
          confirmLabel="Sí, eliminar"
          prompt={`¿Eliminar “${event.name}”? No se puede deshacer.`}
          onConfirm={doDelete}
        />
      </div>
    </div>
  );
}

// ── panel root ───────────────────────────────────────────────────────────────

export default function EventsPanel() {
  const [events, setEvents] = useState<AdminEventSummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<AdminEventSummary | null>(null);
  const [creating, setCreating] = useState(false);
  const [statusFilter, setStatusFilter] = useState('');
  const [query, setQuery] = useState('');

  const load = useCallback(() => {
    setError(null);
    adminApi.listAllEvents()
      .then((r) => setEvents(r.events))
      .catch((err) => {
        const status = (err as ApiError)?.status;
        setError(status === 401 ? 'Sesión expirada.' : 'No se pudieron cargar los eventos.');
        setEvents([]);
      });
  }, []);

  useEffect(() => { load(); }, [load]);

  if (selected) {
    return <EventDetail event={selected} onBack={() => setSelected(null)} onChanged={load} />;
  }

  if (creating) {
    return <CreateEvent onCreated={() => { setCreating(false); load(); }} onCancel={() => setCreating(false)} />;
  }

  const filtered = (events || []).filter((ev) => {
    if (statusFilter && ev.status !== statusFilter) return false;
    if (query && !`${ev.name} ${ev.venue_name || ''}`.toLowerCase().includes(query.toLowerCase())) return false;
    return true;
  });

  return (
    <div>
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <h1 className={ui.h1}>Eventos</h1>
        <button type="button" data-testid="new-event" className={ui.btn} onClick={() => setCreating(true)}>Nuevo evento</button>
      </div>

      <div className={`${ui.card} flex gap-3 items-center flex-wrap`}>
        <select data-testid="event-status-filter" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}
          style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', color: 'var(--color-text)', borderRadius: '10px', padding: '8px 12px', fontSize: '0.85rem' }}>
          <option value="">Todos los estados</option>
          <option value="published">Publicados</option>
          <option value="draft">Borradores</option>
        </select>
        <input data-testid="event-search" placeholder="Buscar evento o lugar…" value={query} onChange={(e) => setQuery(e.target.value)}
          style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', color: 'var(--color-text)', borderRadius: '10px', padding: '8px 12px', fontSize: '0.85rem', minWidth: '200px', flex: '1 1 200px' }} />
      </div>

      {error && <Feedback kind="error">{error}</Feedback>}

      <div className={ui.card} data-testid="events-list">
        {events === null ? (
          <p className="text-[var(--color-text-muted)]">Cargando eventos...</p>
        ) : filtered.length === 0 ? (
          <p className="text-[var(--color-text-muted)]">No hay eventos.</p>
        ) : (
          <div className="flex flex-col gap-2">
            {filtered.map((ev) => (
              <button key={ev.id} type="button" data-testid="event-item" onClick={() => setSelected(ev)}
                className="flex items-center justify-between gap-3 py-3 px-3 rounded-xl text-left cursor-pointer border border-transparent hover:border-[var(--color-border)] hover:bg-white/5 transition">
                <div className="min-w-0">
                  <div className="text-base">{ev.name}</div>
                  <div className="text-xs text-[var(--color-text-muted)]">{fmtDate(ev.starts_at)}{ev.venue_name ? ` · ${ev.venue_name}` : ''}</div>
                </div>
                <StatusPill status={ev.status} />
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
