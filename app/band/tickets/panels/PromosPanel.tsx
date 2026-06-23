'use client';

// Códigos (promo) resource — promo codes are scoped to an event, so first pick
// an event, then manage its codes: table (code · tipo · valor · estado) with
// create / edit / delete. Edit + create happen in the detail drawer.

import { useEffect, useState, useCallback, FormEvent } from 'react';
import { adminApi, ApiError } from '@/lib/ticketing/admin';
import type { AdminPromoCode, AdminEventSummary } from '@/lib/ticketing/admin';
import {
  DataTable, Column, Drawer, Field, FieldList, Toolbar, SearchBox, Select,
  Button, ConfirmAction, Feedback, EmptyState, ToastStack, useToasts,
  StatusBadge, CopyId, IconTag, IconPlus,
} from '../console/ui';

const KIND_LABEL: Record<string, string> = { percent: '% Porcentaje', fixed: 'S/ Fijo' };

function promoValue(p: AdminPromoCode): string {
  return p.kind === 'percent' ? `${p.value}%` : `S/ ${p.value}`;
}

interface PromoForm { code: string; kind: string; value: string; active: boolean }

function PromoDrawer({
  eventId, promo, onSaved, onDeleted, onClose, notify,
}: {
  eventId: string;
  promo: AdminPromoCode | null; // null = create
  onSaved: () => void;
  onDeleted: (id: string) => void;
  onClose: () => void;
  notify: (kind: 'ok' | 'error', msg: string) => void;
}) {
  const [form, setForm] = useState<PromoForm>({
    code: promo?.code ?? '',
    kind: promo?.kind ?? 'percent',
    value: promo?.value ?? '',
    active: promo?.active ?? true,
  });
  const [busy, setBusy] = useState(false);
  const set = (k: keyof PromoForm, v: string | boolean) => setForm((f) => ({ ...f, [k]: v }));

  async function save(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      const attrs = { code: form.code, kind: form.kind, value: form.value, active: form.active };
      if (promo) await adminApi.updatePromo(promo.id, attrs);
      else await adminApi.createPromo(eventId, attrs);
      notify('ok', promo ? `Código ${form.code} guardado.` : `Código ${form.code} creado.`);
      onSaved();
      onClose();
    } catch {
      notify('error', 'No se pudo guardar el código.');
      setBusy(false);
    }
  }

  async function doDelete() {
    if (!promo) return;
    try {
      await adminApi.deletePromo(promo.id);
      notify('ok', `Código ${promo.code} eliminado.`);
      onDeleted(promo.id);
      onClose();
    } catch {
      notify('error', 'No se pudo eliminar el código.');
    }
  }

  const footer = (
    <>
      <Button variant="primary" type="submit" form="promo-form" disabled={busy}>
        {busy ? 'Guardando…' : promo ? 'Guardar' : 'Crear código'}
      </Button>
      {promo && (
        <ConfirmAction testId={`delete-promo-${promo.id}`} label="Eliminar" confirmLabel="Sí, eliminar"
          prompt="¿Eliminar el código?" onConfirm={doDelete} />
      )}
    </>
  );

  return (
    <Drawer open onClose={onClose} testId="promo-detail"
      title={promo ? promo.code : 'Nuevo código'}
      subtitle={promo ? <StatusBadge status={promo.active ? 'active' : 'expired'} /> : 'Crea un código promocional'}
      footer={footer}>
      {promo && (
        <FieldList>
          <Field label="ID" copy={promo.id} />
        </FieldList>
      )}
      <form id="promo-form" data-testid="promo-form" onSubmit={save} style={{ marginTop: promo ? 12 : 0 }}>
        <div className="rg-field">
          <label className="rg-label" htmlFor="promo-code">Código</label>
          <input id="promo-code" className="rg-input" data-mono="true" value={form.code} onChange={(e) => set('code', e.target.value)} required />
        </div>
        <div className="rg-form-grid">
          <div className="rg-field">
            <label className="rg-label" htmlFor="promo-kind">Tipo</label>
            <select id="promo-kind" className="rg-select" style={{ width: '100%' }} value={form.kind} onChange={(e) => set('kind', e.target.value)}>
              <option value="percent">Porcentaje (%)</option>
              <option value="fixed">Monto fijo (S/)</option>
            </select>
          </div>
          <div className="rg-field">
            <label className="rg-label" htmlFor="promo-value">Valor</label>
            <input id="promo-value" className="rg-input" data-mono="true" value={form.value} onChange={(e) => set('value', e.target.value)} required />
          </div>
        </div>
        <label style={{ display: 'inline-flex', gap: 8, alignItems: 'center', fontSize: 13 }}>
          <input type="checkbox" checked={form.active} onChange={(e) => set('active', e.target.checked)} />
          Activo
        </label>
      </form>
    </Drawer>
  );
}

export default function PromosPanel({ query: globalQuery }: { query: string }) {
  const [events, setEvents] = useState<AdminEventSummary[] | null>(null);
  const [eventId, setEventId] = useState('');
  const [promos, setPromos] = useState<AdminPromoCode[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [localQuery, setLocalQuery] = useState('');
  const [selected, setSelected] = useState<AdminPromoCode | null>(null);
  const [creating, setCreating] = useState(false);
  const { toasts, push, dismiss } = useToasts();

  const query = globalQuery || localQuery;

  const notify = useCallback((kind: 'ok' | 'error', msg: string) => {
    push(kind, msg);
    if (kind === 'ok') { setNotice(msg); setError(null); }
    else { setError(msg); setNotice(null); }
  }, [push]);

  useEffect(() => {
    adminApi.listAllEvents('all')
      .then((r) => {
        setEvents(r.events);
        if (r.events.length > 0) setEventId(r.events[0].id);
      })
      .catch(() => setEvents([]));
  }, []);

  const loadPromos = useCallback((id: string) => {
    if (!id) { setPromos([]); return; }
    setPromos(null);
    setError(null);
    adminApi.listPromoCodes(id)
      .then((r) => setPromos(r.promo_codes))
      .catch((err) => {
        const s = (err as ApiError)?.status;
        setError(s === 401 ? 'Sesión expirada.' : 'No se pudieron cargar los códigos.');
        setPromos([]);
      });
  }, []);

  useEffect(() => { if (eventId) loadPromos(eventId); }, [eventId, loadPromos]);

  const filtered = (promos || []).filter((p) => !query || p.code.toLowerCase().includes(query.toLowerCase()));

  const columns: Column<AdminPromoCode>[] = [
    { key: 'code', header: 'Código', render: (p) => <span className="rg-mono rg-cell-primary">{p.code}</span> },
    { key: 'kind', header: 'Tipo', render: (p) => KIND_LABEL[p.kind] ?? p.kind },
    { key: 'value', header: 'Valor', align: 'right', render: (p) => <span className="rg-mono">{promoValue(p)}</span> },
    { key: 'active', header: 'Estado', render: (p) => <StatusBadge status={p.active ? 'active' : 'expired'} /> },
    { key: 'id', header: 'ID', render: (p) => <CopyId value={p.id} label="ID" /> },
  ];

  return (
    <div>
      <div className="rg-page-head">
        <div>
          <h1>Códigos promocionales</h1>
          <p>Descuentos por evento.</p>
        </div>
        <div className="rg-page-head-actions">
          <Button variant="primary" data-testid="new-promo" disabled={!eventId} onClick={() => setCreating(true)}>
            <IconPlus /> Nuevo código
          </Button>
        </div>
      </div>

      <Toolbar>
        <Select testId="promo-event-select" ariaLabel="Elegir evento" value={eventId} onChange={setEventId}>
          {events === null && <option value="">Cargando…</option>}
          {events && events.length === 0 && <option value="">Sin eventos</option>}
          {(events || []).map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}
        </Select>
        <SearchBox testId="promo-search" placeholder="Buscar código…" value={localQuery} onChange={setLocalQuery} />
      </Toolbar>

      {error && <Feedback kind="error">{error}</Feedback>}
      {notice && <Feedback kind="ok">{notice}</Feedback>}

      <div data-testid="promos-list">
        <DataTable
          columns={columns}
          rows={!eventId ? [] : promos === null ? null : filtered}
          rowKey={(p) => p.id}
          rowTestId="promo-row"
          onRowClick={setSelected}
          empty={<EmptyState icon={<IconTag />} title="Sin códigos"
            description={eventId ? 'Este evento no tiene códigos promocionales.' : 'Elige un evento para ver sus códigos.'} />}
        />
      </div>

      {selected && (
        <PromoDrawer eventId={eventId} promo={selected} notify={notify}
          onClose={() => setSelected(null)}
          onSaved={() => loadPromos(eventId)}
          onDeleted={() => loadPromos(eventId)} />
      )}
      {creating && (
        <PromoDrawer eventId={eventId} promo={null} notify={notify}
          onClose={() => setCreating(false)}
          onSaved={() => loadPromos(eventId)}
          onDeleted={() => {}} />
      )}

      <ToastStack toasts={toasts} onDismiss={dismiss} />
    </div>
  );
}
