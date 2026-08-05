'use client';

// Equipo resource — the band's own gear. Two jobs behind one nav entry:
//   Inventario — what we own (CRUD; gear is retired, never deleted, so past event
//                lists keep their line).
//   Por evento — pick an event, tick what travels and how many, save. From there the
//                venue checklist and the printable list take over.

import { useEffect, useState, useCallback, FormEvent, useMemo } from 'react';
import Link from 'next/link';
import { adminApi, ApiError } from '@/lib/ticketing/admin';
import type { AdminEquipmentItem, AdminEventEquipment, AdminEventSummary } from '@/lib/ticketing/admin';
import { buildEquipmentPdf, downloadPdf } from '@/lib/ticketing/equipment-pdf';
import {
  DataTable, Column, Drawer, Toolbar, SearchBox, Select, Button, ConfirmAction,
  Feedback, EmptyState, ToastStack, useToasts, StatusBadge, IconPlus, IconCase,
} from '../console/ui';

type Tab = 'inventory' | 'event';

interface ItemForm { name: string; category: string; quantity: string; notes: string }

const EMPTY_ITEM: ItemForm = { name: '', category: '', quantity: '1', notes: '' };

function formFromItem(item: AdminEquipmentItem): ItemForm {
  return {
    name: item.name,
    category: item.category || '',
    quantity: String(item.quantity),
    notes: item.notes || '',
  };
}

// Group by category so a list can be read (and packed) one crate at a time.
function byCategory<T extends { category: string | null }>(rows: T[]): [string, T[]][] {
  const groups = new Map<string, T[]>();
  for (const row of rows) {
    const key = row.category || 'Sin categoría';
    groups.set(key, [...(groups.get(key) || []), row]);
  }
  return [...groups.entries()].sort(([a], [b]) => a.localeCompare(b));
}

// ── Inventory drawer ─────────────────────────────────────────────────────────

function ItemDrawer({
  item, categories, onSaved, onClose, notify,
}: {
  item: AdminEquipmentItem | null; // null = create
  categories: string[];
  onSaved: () => void;
  onClose: () => void;
  notify: (kind: 'ok' | 'error', msg: string) => void;
}) {
  const [form, setForm] = useState<ItemForm>(item ? formFromItem(item) : EMPTY_ITEM);
  const [busy, setBusy] = useState(false);
  const set = (k: keyof ItemForm, v: string) => setForm((f) => ({ ...f, [k]: v }));

  // Optional event: the footer button calls this directly, the form calls it on submit
  // (Enter). Never a submit-button + form= pair — React reuses footer nodes across the
  // read/edit swap and a stale click can fire the default action on the new button.
  async function save(e?: FormEvent) {
    e?.preventDefault();
    setBusy(true);
    try {
      const attrs = {
        name: form.name,
        category: form.category || null,
        quantity: Number(form.quantity) || 1,
        notes: form.notes || null,
      };
      if (item) await adminApi.updateEquipment(item.id, attrs);
      else await adminApi.createEquipment(attrs);
      notify('ok', `${form.name} guardado.`);
      onSaved();
      onClose();
    } catch {
      notify('error', 'No se pudo guardar el equipo.');
      setBusy(false);
    }
  }

  async function toggleRetired() {
    if (!item) return;
    try {
      if (item.active) await adminApi.retireEquipment(item.id);
      else await adminApi.restoreEquipment(item.id);
      notify('ok', item.active ? `${item.name} retirado.` : `${item.name} de vuelta en servicio.`);
      onSaved();
      onClose();
    } catch {
      notify('error', 'No se pudo cambiar el estado.');
    }
  }

  const footer = (
    <>
      <Button variant="primary" data-testid="save-equipment" disabled={busy} onClick={() => save()}>
        {busy ? 'Guardando…' : item ? 'Guardar' : 'Agregar equipo'}
      </Button>
      {item?.active && (
        <ConfirmAction testId={`retire-equipment-${item.id}`} label="Retirar" confirmLabel="Sí, retirar"
          prompt="¿Retirar este equipo? Sale de las listas nuevas; las pasadas no cambian."
          onConfirm={toggleRetired} />
      )}
      {item && !item.active && (
        <Button variant="secondary" data-testid={`restore-equipment-${item.id}`} onClick={toggleRetired}>
          Volver a usar
        </Button>
      )}
    </>
  );

  return (
    <Drawer open onClose={onClose} testId="equipment-detail"
      title={item ? item.name : 'Nuevo equipo'}
      subtitle={item ? <StatusBadge status={item.active ? 'active' : 'expired'} /> : 'Algo que llevamos a los toques'}
      footer={footer}>
      <form id="equipment-form" data-testid="equipment-form" onSubmit={save}>
        <div className="rg-field">
          <label className="rg-label" htmlFor="eq-name">Nombre</label>
          <input id="eq-name" data-testid="eq-name" className="rg-input" value={form.name}
            onChange={(e) => set('name', e.target.value)} required />
        </div>
        <div className="rg-form-grid">
          <div className="rg-field">
            <label className="rg-label" htmlFor="eq-category">Categoría</label>
            <input id="eq-category" data-testid="eq-category" className="rg-input" list="eq-categories"
              value={form.category} onChange={(e) => set('category', e.target.value)} />
            <datalist id="eq-categories">
              {categories.map((c) => <option key={c} value={c} />)}
            </datalist>
          </div>
          <div className="rg-field">
            <label className="rg-label" htmlFor="eq-quantity">Cantidad que tenemos</label>
            <input id="eq-quantity" data-testid="eq-quantity" type="number" min="1" className="rg-input"
              value={form.quantity} onChange={(e) => set('quantity', e.target.value)} />
          </div>
        </div>
        <div className="rg-field">
          <label className="rg-label" htmlFor="eq-notes">Notas / estado</label>
          <textarea id="eq-notes" data-testid="eq-notes" className="rg-textarea" value={form.notes}
            onChange={(e) => set('notes', e.target.value)} />
        </div>
      </form>
    </Drawer>
  );
}

// ── Per-event list builder ───────────────────────────────────────────────────

function EventList({
  items, eventId, eventName, notify,
}: {
  items: AdminEquipmentItem[];
  eventId: string;
  eventName: string;
  notify: (kind: 'ok' | 'error', msg: string) => void;
}) {
  const [lines, setLines] = useState<AdminEventEquipment[] | null>(null);
  // item id -> how many travel. Absent means "not going".
  const [picked, setPicked] = useState<Record<string, number>>({});
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    adminApi.listEventEquipment(eventId)
      .then((r) => {
        setLines(r.equipment);
        setPicked(Object.fromEntries(r.equipment.map((l) => [l.equipment_item_id, l.quantity])));
      })
      .catch(() => setLines([]));
  }, [eventId]);

  useEffect(load, [load]);

  // Retired gear stays visible if it's already on this list — just not pickable anew.
  const pickable = items.filter((i) => i.active || picked[i.id] !== undefined);

  function toggle(item: AdminEquipmentItem) {
    setPicked((cur) => {
      // Unticking drops the key entirely — absent means "not going", so the saved
      // payload is just the picked entries.
      if (cur[item.id] === undefined) return { ...cur, [item.id]: item.quantity };
      return Object.fromEntries(Object.entries(cur).filter(([id]) => id !== item.id));
    });
  }

  function setQty(item: AdminEquipmentItem, value: string) {
    const n = Math.max(1, Number(value) || 1);
    setPicked((cur) => ({ ...cur, [item.id]: n }));
  }

  async function save() {
    setBusy(true);
    try {
      const payload = Object.entries(picked).map(([equipment_item_id, quantity]) => ({ equipment_item_id, quantity }));
      const { equipment } = await adminApi.setEventEquipment(eventId, payload);
      setLines(equipment);
      notify('ok', `Lista de ${eventName} guardada (${equipment.length} ítems).`);
    } catch {
      notify('error', 'No se pudo guardar la lista.');
    } finally {
      setBusy(false);
    }
  }

  async function printList() {
    const { equipment } = await adminApi.listEventEquipment(eventId);
    const bytes = await buildEquipmentPdf(equipment, { eventName });
    downloadPdf(bytes, `equipo-${eventName.toLowerCase().replace(/\s+/g, '-')}.pdf`);
  }

  const chosen = Object.keys(picked).length;
  const packed = (lines || []).filter((l) => l.packed_at).length;
  const returned = (lines || []).filter((l) => l.returned_at).length;

  return (
    <div data-testid="event-equipment">
      <Toolbar>
        <Button variant="primary" data-testid="save-event-equipment" disabled={busy} onClick={save}>
          {busy ? 'Guardando…' : `Guardar lista (${chosen})`}
        </Button>
        <Link className="rg-btn rg-btn-secondary" data-testid="open-checklist" href={`/admin/equipo/checklist?event=${eventId}`}>
          Abrir checklist →
        </Link>
        <Button variant="secondary" data-testid="print-event-equipment" onClick={printList}>
          Imprimir lista
        </Button>
      </Toolbar>

      {lines && lines.length > 0 && (
        <Feedback kind="ok">
          {packed}/{lines.length} cargados · {returned}/{lines.length} devueltos
        </Feedback>
      )}

      {byCategory(pickable).map(([category, group]) => (
        <div key={category} style={{ marginBottom: 18 }}>
          <div className="rg-drawer-section-title">{category}</div>
          {group.map((item) => {
            const on = picked[item.id] !== undefined;
            return (
              <label key={item.id} data-testid="equipment-pick"
                style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0', borderBottom: '1px solid var(--color-border)' }}>
                <input type="checkbox" checked={on} data-testid={`pick-${item.id}`} onChange={() => toggle(item)} />
                <span style={{ flex: 1 }}>
                  <span className="rg-cell-primary">{item.name}</span>
                  {!item.active && <span className="rg-cell-sub"> · retirado</span>}
                  {item.notes && <div className="rg-cell-sub">{item.notes}</div>}
                </span>
                <span className="rg-cell-sub">de {item.quantity}</span>
                <input type="number" min="1" max={item.quantity} disabled={!on} className="rg-input"
                  data-testid={`qty-${item.id}`} style={{ width: 72 }}
                  value={on ? picked[item.id] : ''} onChange={(e) => setQty(item, e.target.value)} />
              </label>
            );
          })}
        </div>
      ))}

      {pickable.length === 0 && (
        <EmptyState icon={<IconCase />} title="Sin equipo"
          description="Agrega equipo en la pestaña Inventario para armar la lista." />
      )}
    </div>
  );
}

// ── Panel root ───────────────────────────────────────────────────────────────

export default function EquipmentPanel({ query: globalQuery }: { query: string }) {
  const [tab, setTab] = useState<Tab>('inventory');
  const [items, setItems] = useState<AdminEquipmentItem[] | null>(null);
  const [events, setEvents] = useState<AdminEventSummary[]>([]);
  const [eventId, setEventId] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [localQuery, setLocalQuery] = useState('');
  const [selected, setSelected] = useState<AdminEquipmentItem | null>(null);
  const [creating, setCreating] = useState(false);
  const { toasts, push, dismiss } = useToasts();

  const query = globalQuery || localQuery;

  const notify = useCallback((kind: 'ok' | 'error', msg: string) => {
    push(kind, msg);
    if (kind === 'ok') { setNotice(msg); setError(null); }
    else { setError(msg); setNotice(null); }
  }, [push]);

  const load = useCallback(() => {
    setError(null);
    adminApi.listEquipment()
      .then((r) => setItems(r.equipment))
      .catch((err) => {
        const s = (err as ApiError)?.status;
        setError(s === 401 ? 'Sesión expirada.' : 'No se pudo cargar el equipo.');
        setItems([]);
      });
  }, []);

  useEffect(load, [load]);

  useEffect(() => {
    adminApi.listAllEvents('all')
      .then((r) => {
        setEvents(r.events);
        if (r.events.length > 0) setEventId((cur) => cur || r.events[0].id);
      })
      .catch(() => setEvents([]));
  }, []);

  const categories = useMemo(
    () => [...new Set((items || []).map((i) => i.category).filter(Boolean) as string[])].sort(),
    [items],
  );

  const filtered = (items || []).filter((i) => {
    if (!query) return true;
    return `${i.name} ${i.category || ''} ${i.notes || ''}`.toLowerCase().includes(query.toLowerCase());
  });

  const columns: Column<AdminEquipmentItem>[] = [
    { key: 'name', header: 'Equipo', render: (i) => (
      <div>
        <div className="rg-cell-primary">{i.name}</div>
        {i.notes && <div className="rg-cell-sub">{i.notes}</div>}
      </div>
    ) },
    { key: 'category', header: 'Categoría', render: (i) => i.category || '—' },
    { key: 'quantity', header: 'Cantidad', align: 'right', render: (i) => <span className="rg-mono">{i.quantity}</span> },
    { key: 'active', header: 'Estado', render: (i) => <StatusBadge status={i.active ? 'active' : 'expired'} /> },
  ];

  const selectedEvent = events.find((e) => e.id === eventId);

  return (
    <div>
      <div className="rg-page-head">
        <div>
          <h1>Equipo</h1>
          <p>Lo que tenemos y lo que va a cada toque.</p>
        </div>
        <div className="rg-page-head-actions">
          <Button variant="primary" data-testid="new-equipment" onClick={() => setCreating(true)}>
            <IconPlus /> Nuevo equipo
          </Button>
        </div>
      </div>

      <Toolbar>
        <Button variant={tab === 'inventory' ? 'primary' : 'secondary'} data-testid="tab-inventory"
          onClick={() => setTab('inventory')}>Inventario</Button>
        <Button variant={tab === 'event' ? 'primary' : 'secondary'} data-testid="tab-event"
          onClick={() => setTab('event')}>Por evento</Button>
        {tab === 'inventory'
          ? <SearchBox testId="equipment-search" placeholder="Buscar equipo…" value={localQuery} onChange={setLocalQuery} />
          : (
            <Select testId="equipment-event-select" ariaLabel="Elegir evento" value={eventId} onChange={setEventId}>
              {events.length === 0 && <option value="">Sin eventos</option>}
              {events.map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}
            </Select>
          )}
      </Toolbar>

      {error && <Feedback kind="error">{error}</Feedback>}
      {notice && <Feedback kind="ok">{notice}</Feedback>}

      {tab === 'inventory' ? (
        <div data-testid="equipment-list">
          <DataTable
            columns={columns}
            rows={items === null ? null : filtered}
            rowKey={(i) => i.id}
            rowTestId="equipment-row"
            onRowClick={setSelected}
            empty={<EmptyState icon={<IconCase />} title="Sin equipo"
              description="Agrega el primer parlante, micrófono o cable." />}
          />
        </div>
      ) : eventId && items ? (
        <EventList items={items} eventId={eventId} eventName={selectedEvent?.name || 'evento'} notify={notify} />
      ) : (
        <EmptyState icon={<IconCase />} title="Elige un evento" description="Selecciona un evento para armar su lista." />
      )}

      {selected && (
        <ItemDrawer item={selected} categories={categories} notify={notify}
          onClose={() => setSelected(null)} onSaved={load} />
      )}
      {creating && (
        <ItemDrawer item={null} categories={categories} notify={notify}
          onClose={() => setCreating(false)} onSaved={load} />
      )}

      <ToastStack toasts={toasts} onDismiss={dismiss} />
    </div>
  );
}
