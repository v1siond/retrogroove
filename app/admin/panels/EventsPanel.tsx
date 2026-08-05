'use client';

// Eventos resource. Table (name · status · date · venue) with an Activos /
// Pasados / Todos filter and search. Clicking a row opens the detail drawer:
// EVERY event field as label/value rows, an inline edit form, delete + publish
// actions, this event's orders and tickets, and quick links into the per-event
// flows. The drawer keeps the legacy event-detail / event-orders-panel /
// event-tickets-panel / edit-form selectors the e2e contract drills into.

import { useEffect, useState, useCallback, FormEvent } from 'react';
import Link from 'next/link';
import { adminApi, ApiError } from '@/lib/ticketing/admin';
import type { AdminEventSummary, AdminOrder, AdminTicket, EventFilter } from '@/lib/ticketing/admin';
import type { TicketEvent } from '@/lib/ticketing/types';
import {
  DataTable, Column, Drawer, Field, FieldList, DrawerSectionTitle, StatusBadge,
  Toolbar, SearchBox, Segmented, Button, ConfirmAction, Feedback, EmptyState,
  ToastStack, useToasts, fmtDate, fmtMoney, IconPlus, IconCalendar,
} from '../console/ui';

const EVENT_FILTERS: { key: EventFilter; label: string }[] = [
  { key: 'active', label: 'Activos' },
  { key: 'past', label: 'Pasados' },
  { key: 'all', label: 'Todos' },
];

// The four event statuses the API accepts (Event @statuses). updateEvent({status})
// drives every transition — publish, unpublish (→draft), cancel, complete.
const STATUS_OPTIONS: { value: string; label: string }[] = [
  { value: 'draft', label: 'Borrador' },
  { value: 'published', label: 'Publicado' },
  { value: 'cancelled', label: 'Cancelado' },
  { value: 'completed', label: 'Completado' },
];
const STATUS_LABELS: Record<string, string> = Object.fromEntries(
  STATUS_OPTIONS.map((o) => [o.value, o.label])
);

const EMPTY_BY_FILTER: Record<EventFilter, string> = {
  active: 'No hay eventos activos ni próximos.',
  past: 'No hay eventos pasados.',
  all: 'Aún no has creado ningún evento.',
};

function buyerName(o: AdminOrder): string {
  const name = [o.buyer_first_name, o.buyer_last_name].filter(Boolean).join(' ').trim();
  return name || o.buyer_email;
}

interface EditForm {
  name: string; starts_at: string; venue_name: string; venue_address: string;
  venue_photo_url: string; flyer_url: string; map_url: string; external_url: string;
  instagram_url: string; description: string;
}

const EMPTY_FORM: EditForm = {
  name: '', starts_at: '', venue_name: '', venue_address: '', venue_photo_url: '',
  flyer_url: '', map_url: '', external_url: '', instagram_url: '', description: '',
};

function toLocalInput(iso: string): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function formAttrs(form: EditForm): Record<string, unknown> {
  const attrs: Record<string, unknown> = {
    name: form.name, venue_name: form.venue_name, venue_address: form.venue_address,
    venue_photo_url: form.venue_photo_url, flyer_url: form.flyer_url, map_url: form.map_url,
    external_url: form.external_url, instagram_url: form.instagram_url, description: form.description,
  };
  if (form.starts_at) attrs.starts_at = new Date(form.starts_at).toISOString();
  return attrs;
}

function formFromEvent(e: TicketEvent): EditForm {
  return {
    name: e.name || '', starts_at: toLocalInput(e.starts_at), venue_name: e.venue_name || '',
    venue_address: e.venue_address || '', venue_photo_url: e.venue_photo_url || '',
    flyer_url: e.flyer_url || '', map_url: e.map_url || '', external_url: e.external_url || '',
    instagram_url: e.instagram_url || '', description: e.description || '',
  };
}

// ── Create-event drawer ──────────────────────────────────────────────────────

function CreateEventDrawer({ onCreated, onClose }: { onCreated: () => void; onClose: () => void }) {
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
    <Drawer open onClose={onClose} title="Nuevo evento" subtitle="Crea el evento, luego configúralo">
      <form onSubmit={submit} data-testid="create-event-form">
        {error && <Feedback kind="error">{error}</Feedback>}
        <div className="rg-field">
          <label className="rg-label" htmlFor="new-name">Nombre</label>
          <input id="new-name" className="rg-input" value={form.name} onChange={(e) => set('name', e.target.value)} required />
        </div>
        <div className="rg-field">
          <label className="rg-label" htmlFor="new-date">Fecha y hora</label>
          <input id="new-date" type="datetime-local" className="rg-input" value={form.starts_at} onChange={(e) => set('starts_at', e.target.value)} />
        </div>
        <div className="rg-field">
          <label className="rg-label" htmlFor="new-venue">Lugar (venue)</label>
          <input id="new-venue" className="rg-input" value={form.venue_name} onChange={(e) => set('venue_name', e.target.value)} />
        </div>
        <div className="rg-field">
          <label className="rg-label" htmlFor="new-desc">Descripción</label>
          <textarea id="new-desc" className="rg-textarea" value={form.description} onChange={(e) => set('description', e.target.value)} />
        </div>
        <div className="rg-form-row">
          <Button variant="primary" type="submit" disabled={saving}>{saving ? 'Creando…' : 'Crear evento'}</Button>
          <Button variant="ghost" onClick={onClose}>Cancelar</Button>
        </div>
        <p className="rg-cell-sub" style={{ marginTop: 14 }}>
          Para secciones, mesas y precios usa el constructor visual:{' '}
          <Link href="/admin/nuevo" className="rg-link">abrir constructor →</Link>
        </p>
      </form>
    </Drawer>
  );
}

// ── Event detail drawer ──────────────────────────────────────────────────────

function EventDrawer({
  summary, onClose, onChanged, notify,
}: {
  summary: AdminEventSummary;
  onClose: () => void;
  onChanged: () => void;
  notify: (kind: 'ok' | 'error', msg: string) => void;
}) {
  const [full, setFull] = useState<TicketEvent | null>(null);
  const [orders, setOrders] = useState<AdminOrder[] | null>(null);
  const [tickets, setTickets] = useState<AdminTicket[] | null>(null);
  const [form, setForm] = useState<EditForm | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [statusBusy, setStatusBusy] = useState(false);
  const [status, setStatus] = useState<string>(summary.status);

  useEffect(() => {
    let on = true;
    adminApi.getEvent(summary.slug).then((r) => {
      if (!on) return;
      setFull(r.event);
      setForm(formFromEvent(r.event));
    }).catch(() => {
      if (!on) return;
      setForm({ ...EMPTY_FORM, name: summary.name, starts_at: toLocalInput(summary.starts_at), venue_name: summary.venue_name || '' });
    });
    Promise.all([adminApi.listOrders(summary.id), adminApi.listTickets(summary.id)])
      .then(([o, t]) => { if (on) { setOrders(o.orders); setTickets(t.tickets); } })
      .catch(() => { if (on) { setOrders([]); setTickets([]); } });
    return () => { on = false; };
  }, [summary]);

  const setField = (k: keyof EditForm, v: string) => setForm((f) => (f ? { ...f, [k]: v } : f));

  async function save(e: FormEvent) {
    e.preventDefault();
    if (!form) return;
    setSaving(true);
    setSaved(false);
    setError(null);
    try {
      const { event } = await adminApi.updateEvent(summary.id, formAttrs(form));
      setFull(event);
      setSaved(true);
      notify('ok', 'Evento actualizado.');
      onChanged();
    } catch {
      setError('No se pudo guardar el evento.');
    } finally {
      setSaving(false);
    }
  }

  // Any status transition — publish, unpublish, cancel, complete — via updateEvent.
  // Optimistic: flip the UI, revert if the request fails.
  async function changeStatus(next: string) {
    if (next === status || statusBusy) return;
    const prev = status;
    setStatus(next);
    setStatusBusy(true);
    try {
      await adminApi.updateEvent(summary.id, { status: next });
      notify('ok', `Estado: ${STATUS_LABELS[next] ?? next}.`);
      onChanged();
    } catch {
      setStatus(prev);
      notify('error', 'No se pudo cambiar el estado.');
    } finally {
      setStatusBusy(false);
    }
  }

  async function doDelete() {
    try {
      await adminApi.deleteEvent(summary.id);
      notify('ok', `“${summary.name}” eliminado.`);
      onClose();
      onChanged();
    } catch {
      notify('error', 'No se pudo eliminar el evento.');
    }
  }

  const footer = (
    <>
      <Button variant="primary" type="submit" form="event-edit-form" disabled={saving}>
        {saving ? 'Guardando…' : 'Guardar cambios'}
      </Button>
      <ConfirmAction testId="delete-event" label="Eliminar evento" confirmLabel="Sí, eliminar"
        prompt={`¿Eliminar “${summary.name}”?`} onConfirm={doDelete} />
    </>
  );

  return (
    <Drawer open onClose={onClose} testId="event-detail" title={summary.name}
      subtitle={<><StatusBadge status={status} /> · {fmtDate(summary.starts_at)}</>} footer={footer}>

      <button type="button" className="rg-link" onClick={onClose} style={{ marginBottom: 12 }}>
        ← Todos los eventos
      </button>

      {error && <Feedback kind="error">{error}</Feedback>}

      {/* Read-only identifiers + computed fields */}
      <FieldList>
        <Field label="ID" copy={full?.id ?? summary.id} />
        <Field label="Slug" mono>{full?.slug ?? summary.slug}</Field>
        <Field label="Estado"><StatusBadge status={status} /></Field>
        {full && <Field label="Lienzo" mono>{full.canvas_width} × {full.canvas_height}</Field>}
        {full && <Field label="Escenario" mono>x{full.stage_x ?? 0} y{full.stage_y ?? 0} · {full.stage_w ?? 0}×{full.stage_h ?? 0}</Field>}
        {full && <Field label="Secciones" mono>{full.sections?.length ?? 0}</Field>}
      </FieldList>

      {/* Aforo — the same figures as the list column, from the summary already in hand. */}
      <DrawerSectionTitle>Aforo</DrawerSectionTitle>
      <FieldList>
        <Field label="Aforo total" mono>{summary.capacity}</Field>
        <Field label="Vendidas" mono>{summary.sold}</Field>
        <Field label="Cortesía" mono>{summary.comp}</Field>
        <Field label="Quedan" mono>
          <span data-testid="event-available">
            {summary.capacity > 0 && summary.available === 0 ? 'Agotado' : summary.available}
          </span>
        </Field>
      </FieldList>

      {/* Status control — publish, unpublish (→ borrador), cancel, complete. One
          select drives every transition through updateEvent({ status }). */}
      <DrawerSectionTitle>Estado</DrawerSectionTitle>
      <div className="rg-field">
        <label className="rg-label" htmlFor="ev-status">Estado del evento</label>
        <select
          id="ev-status"
          data-testid="event-status"
          className="rg-input"
          value={status}
          disabled={statusBusy}
          onChange={(e) => changeStatus(e.target.value)}
        >
          {STATUS_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
        <p className="rg-cell-sub" style={{ marginTop: 6 }}>
          Cámbialo al instante: publica, regresa a borrador, cancela o marca como completado.
        </p>
      </div>

      {/* Editable fields — every event field, labelled. Saving on submit. */}
      <DrawerSectionTitle>Detalles del evento</DrawerSectionTitle>
      {form && (
        <form id="event-edit-form" onSubmit={save} data-testid="edit-form">
          {saved && <Feedback kind="ok">Guardado.</Feedback>}
          <EventFields form={form} setField={setField} />
        </form>
      )}

      {/* Per-event flows */}
      <DrawerSectionTitle>Acciones por evento</DrawerSectionTitle>
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
        <Link href={`/admin/evento?slug=${summary.slug}`} className="rg-link">Emitir comps / asientos →</Link>
        <Link href={`/admin/editar?slug=${summary.slug}`} className="rg-link">Editar en el constructor →</Link>
      </div>

      <DrawerSectionTitle>Órdenes ({orders?.length ?? '…'})</DrawerSectionTitle>
      <div data-testid="event-orders-panel">
            {orders === null ? (
              <p className="rg-cell-sub">Cargando…</p>
            ) : orders.length === 0 ? (
              <p className="rg-cell-sub">Sin órdenes todavía.</p>
            ) : (
              <FieldList>
                {orders.map((o) => (
                  <div key={o.id} data-testid="order-row" className="rg-fieldrow">
                    <dt style={{ textTransform: 'none', letterSpacing: 0 }}>
                      {buyerName(o)}
                      <div className="rg-cell-sub">{o.buyer_email}{o.payment_ref ? ` · ${o.payment_ref}` : ''}</div>
                    </dt>
                    <dd style={{ display: 'flex', gap: 8, alignItems: 'center', justifyContent: 'flex-end' }}>
                      <StatusBadge status={o.status} />
                      <span className="rg-mono">{fmtMoney(o.total)}</span>
                    </dd>
                  </div>
                ))}
              </FieldList>
            )}
          </div>

          <DrawerSectionTitle>Entradas ({tickets?.length ?? '…'})</DrawerSectionTitle>
          <div data-testid="event-tickets-panel">
            {tickets === null ? (
              <p className="rg-cell-sub">Cargando…</p>
            ) : tickets.length === 0 ? (
              <p className="rg-cell-sub">Sin entradas todavía.</p>
            ) : (
              <FieldList>
                {tickets.map((t) => (
                  <div key={t.code} data-testid="ticket-row" className="rg-fieldrow">
                    <dt style={{ textTransform: 'none', letterSpacing: 0 }}>
                      <span className="rg-mono">{t.code}</span>
                      <div className="rg-cell-sub">{t.seat_label || 'General'} · {t.buyer_email}</div>
                    </dt>
                    <dd style={{ textAlign: 'right' }}><StatusBadge status={t.status} /></dd>
                  </div>
                ))}
              </FieldList>
            )}
          </div>
    </Drawer>
  );
}

// How full an event is, at a glance. "Vendidas" is paid only; comps are shown apart
// because they aren't revenue — but they do take a seat, so `available` already has them
// subtracted (see the API's sales_counts). Seats mid-checkout still read as available.
function SalesCell({ event }: { event: AdminEventSummary }) {
  const soldOut = event.capacity > 0 && event.available === 0;

  return (
    <div data-testid="event-sales">
      <div className="rg-cell-primary rg-mono">
        {event.sold}<span style={{ color: 'var(--color-text-faint)' }}> / {event.capacity}</span>
      </div>
      <div className="rg-cell-sub">
        {soldOut
          ? <span style={{ color: 'var(--color-gold)' }}>Agotado</span>
          : <>{event.available} quedan</>}
        {event.comp > 0 && <> · {event.comp} cortesía</>}
      </div>
    </div>
  );
}

function EventFields({ form, setField }: { form: EditForm; setField: (k: keyof EditForm, v: string) => void }) {
  return (
    <>
      <div className="rg-field">
        <label className="rg-label" htmlFor="ev-name">Nombre</label>
        <input id="ev-name" className="rg-input" value={form.name} onChange={(e) => setField('name', e.target.value)} required />
      </div>
      <div className="rg-field">
        <label className="rg-label" htmlFor="ev-date">Fecha y hora</label>
        <input id="ev-date" type="datetime-local" className="rg-input" value={form.starts_at} onChange={(e) => setField('starts_at', e.target.value)} />
      </div>
      <div className="rg-field">
        <label className="rg-label" htmlFor="ev-venue">Lugar (venue)</label>
        <input id="ev-venue" className="rg-input" value={form.venue_name} onChange={(e) => setField('venue_name', e.target.value)} />
      </div>
      <div className="rg-field">
        <label className="rg-label" htmlFor="ev-address">Dirección</label>
        <input id="ev-address" className="rg-input" value={form.venue_address} onChange={(e) => setField('venue_address', e.target.value)} />
      </div>
      <div className="rg-form-grid">
        <div className="rg-field">
          <label className="rg-label" htmlFor="ev-photo">Foto del lugar (URL)</label>
          <input id="ev-photo" className="rg-input" value={form.venue_photo_url} onChange={(e) => setField('venue_photo_url', e.target.value)} />
        </div>
        <div className="rg-field">
          <label className="rg-label" htmlFor="ev-flyer">Flyer (URL)</label>
          <input id="ev-flyer" className="rg-input" value={form.flyer_url} onChange={(e) => setField('flyer_url', e.target.value)} />
        </div>
        <div className="rg-field">
          <label className="rg-label" htmlFor="ev-map">Mapa (URL)</label>
          <input id="ev-map" className="rg-input" value={form.map_url} onChange={(e) => setField('map_url', e.target.value)} />
        </div>
        <div className="rg-field">
          <label className="rg-label" htmlFor="ev-ext">Enlace externo (URL)</label>
          <input id="ev-ext" className="rg-input" value={form.external_url} onChange={(e) => setField('external_url', e.target.value)} />
        </div>
      </div>
      <div className="rg-field">
        <label className="rg-label" htmlFor="ev-ig">Instagram (URL)</label>
        <input id="ev-ig" className="rg-input" value={form.instagram_url} onChange={(e) => setField('instagram_url', e.target.value)} />
      </div>
      <div className="rg-field">
        <label className="rg-label" htmlFor="ev-desc">Descripción</label>
        <textarea id="ev-desc" className="rg-textarea" value={form.description} onChange={(e) => setField('description', e.target.value)} />
      </div>
    </>
  );
}

// ── Panel root ───────────────────────────────────────────────────────────────

export default function EventsPanel({ query: globalQuery }: { query: string }) {
  const [events, setEvents] = useState<AdminEventSummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<AdminEventSummary | null>(null);
  const [creating, setCreating] = useState(false);
  const [filter, setFilter] = useState<EventFilter>('active');
  const [localQuery, setLocalQuery] = useState('');
  const { toasts, push, dismiss } = useToasts();

  const query = globalQuery || localQuery;

  const load = useCallback((f: EventFilter) => {
    setEvents(null);
    setError(null);
    adminApi.listAllEvents(f)
      .then((r) => setEvents(r.events))
      .catch((err) => {
        const status = (err as ApiError)?.status;
        setError(status === 401 ? 'Sesión expirada.' : 'No se pudieron cargar los eventos.');
        setEvents([]);
      });
  }, []);

  useEffect(() => { load(filter); }, [load, filter]);

  // Backend already ordered; search filters client-side without re-sorting.
  const filtered = (events || []).filter((ev) =>
    !query || `${ev.name} ${ev.venue_name || ''}`.toLowerCase().includes(query.toLowerCase()));

  const columns: Column<AdminEventSummary>[] = [
    { key: 'name', header: 'Evento', render: (e) => (
      <div>
        <div className="rg-cell-primary">{e.name}</div>
        <div className="rg-cell-sub rg-mono">{e.slug}</div>
      </div>
    ) },
    { key: 'status', header: 'Estado', render: (e) => <StatusBadge status={e.status} /> },
    { key: 'sales', header: 'Entradas', align: 'right', render: (e) => <SalesCell event={e} /> },
    { key: 'date', header: 'Fecha', render: (e) => <span className="rg-mono">{fmtDate(e.starts_at)}</span> },
    { key: 'venue', header: 'Lugar', render: (e) => e.venue_name || '—' },
  ];

  return (
    <div>
      <div className="rg-page-head">
        <div>
          <h1>Eventos</h1>
          <p>Crea, publica y administra los shows.</p>
        </div>
        <div className="rg-page-head-actions">
          <Button variant="primary" data-testid="new-event" onClick={() => setCreating(true)}>
            <IconPlus /> Nuevo evento
          </Button>
        </div>
      </div>

      <Toolbar>
        <Segmented testId="event-filter" options={EVENT_FILTERS} value={filter} onChange={setFilter} />
        <SearchBox testId="event-search" placeholder="Buscar evento o lugar…" value={localQuery} onChange={setLocalQuery} />
      </Toolbar>

      {error && <Feedback kind="error">{error}</Feedback>}

      <div data-testid="events-list">
        <DataTable
          columns={columns}
          rows={events === null ? null : filtered}
          rowKey={(e) => e.id}
          rowTestId="event-item"
          onRowClick={setSelected}
          empty={<EmptyState icon={<IconCalendar />} title={query ? 'Sin coincidencias' : 'Sin eventos'}
            description={query ? 'Ningún evento coincide con la búsqueda.' : EMPTY_BY_FILTER[filter]} />}
        />
      </div>

      {selected && (
        <EventDrawer summary={selected} onClose={() => setSelected(null)}
          onChanged={() => load(filter)} notify={push} />
      )}
      {creating && (
        <CreateEventDrawer onClose={() => setCreating(false)}
          onCreated={() => { setCreating(false); load(filter); push('ok', 'Evento creado.'); }} />
      )}

      <ToastStack toasts={toasts} onDismiss={dismiss} />
    </div>
  );
}
