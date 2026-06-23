'use client';

// Setlists resource — reusable ordered blocks of songs. Table (name · #songs).
// Create from the toolbar; clicking a row opens the editor drawer to rename and
// add / remove / reorder its song_ids. Needs the song catalog to resolve ids to
// titles and to offer songs for adding.

import { useEffect, useState, useCallback, FormEvent } from 'react';
import { adminApi, ApiError } from '@/lib/ticketing/admin';
import type { AdminSetlist, AdminSong } from '@/lib/ticketing/admin';
import {
  DataTable, Column, Drawer, Toolbar, SearchBox, Button, ConfirmAction,
  Feedback, EmptyState, ToastStack, useToasts, CopyId, IconList, IconPlus,
} from '../console/ui';

function move<T>(arr: T[], from: number, to: number): T[] {
  if (to < 0 || to >= arr.length) return arr;
  const next = [...arr];
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item);
  return next;
}

function SetlistDrawer({
  setlist, songs, onSaved, onClose, onDeleted, notify,
}: {
  setlist: AdminSetlist;
  songs: AdminSong[];
  onSaved: (s: AdminSetlist) => void;
  onClose: () => void;
  onDeleted: (id: string) => void;
  notify: (kind: 'ok' | 'error', msg: string) => void;
}) {
  const [name, setName] = useState(setlist.name);
  const [ids, setIds] = useState<string[]>(setlist.song_ids);
  const [busy, setBusy] = useState(false);

  const byId = new Map(songs.map((s) => [s.id, s]));
  const available = songs.filter((s) => !ids.includes(s.id));

  async function save(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      const { setlist: updated } = await adminApi.updateSetlist(setlist.id, { name, song_ids: ids });
      onSaved(updated);
      notify('ok', `Setlist “${updated.name}” guardado.`);
      onClose();
    } catch {
      notify('error', 'No se pudo guardar el setlist.');
      setBusy(false);
    }
  }

  async function doDelete() {
    try {
      await adminApi.deleteSetlist(setlist.id);
      onDeleted(setlist.id);
      notify('ok', `Setlist “${setlist.name}” eliminado.`);
      onClose();
    } catch {
      notify('error', 'No se pudo eliminar el setlist.');
    }
  }

  const footer = (
    <>
      <Button variant="primary" type="submit" form={`setlist-edit-${setlist.id}`} disabled={busy}>
        {busy ? 'Guardando…' : 'Guardar setlist'}
      </Button>
      <ConfirmAction testId={`delete-setlist-${setlist.id}`} label="Eliminar" confirmLabel="Sí, eliminar"
        prompt="¿Eliminar el setlist?" onConfirm={doDelete} />
    </>
  );

  return (
    <Drawer open onClose={onClose} testId="setlist-detail" title={setlist.name}
      subtitle={`${ids.length} canción${ids.length === 1 ? '' : 'es'}`} footer={footer}>
      <form id={`setlist-edit-${setlist.id}`} data-testid={`setlist-edit-${setlist.id}`} onSubmit={save}>
        <div className="rg-field">
          <label className="rg-label" htmlFor={`sl-name-${setlist.id}`}>Nombre</label>
          <input id={`sl-name-${setlist.id}`} className="rg-input" value={name} onChange={(e) => setName(e.target.value)} required />
        </div>

        <label className="rg-label">Canciones ({ids.length})</label>
        <div data-testid="setlist-songs" style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          {ids.length === 0 && <p className="rg-cell-sub">Vacío — añade canciones abajo.</p>}
          {ids.map((id, i) => {
            const song = byId.get(id);
            return (
              <div key={id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '7px 10px', borderRadius: 7, background: 'var(--neutral-bg)' }}>
                <span className="rg-mono" style={{ color: 'var(--accent)', width: 22, textAlign: 'center', fontSize: 12 }}>{i + 1}</span>
                <span style={{ flex: 1, fontSize: 13, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {song ? `${song.title} — ${song.artist}` : id}
                </span>
                <button type="button" aria-label="Subir" data-testid={`sl-up-${id}`} className="rg-btn rg-btn-ghost rg-btn-sm"
                  onClick={() => setIds((c) => move(c, i, i - 1))} disabled={i === 0}>↑</button>
                <button type="button" aria-label="Bajar" data-testid={`sl-down-${id}`} className="rg-btn rg-btn-ghost rg-btn-sm"
                  onClick={() => setIds((c) => move(c, i, i + 1))} disabled={i === ids.length - 1}>↓</button>
                <button type="button" aria-label="Quitar" data-testid={`sl-remove-${id}`} className="rg-btn rg-btn-ghost rg-btn-sm"
                  style={{ color: 'var(--bad-fg)' }} onClick={() => setIds((c) => c.filter((x) => x !== id))}>✕</button>
              </div>
            );
          })}
        </div>

        {available.length > 0 && (
          <div style={{ marginTop: 12 }}>
            <label className="rg-label" htmlFor={`sl-add-${setlist.id}`}>Añadir canción</label>
            <select id={`sl-add-${setlist.id}`} data-testid="setlist-add-song" className="rg-select" defaultValue=""
              style={{ width: '100%' }}
              onChange={(e) => { if (e.target.value) { setIds((c) => [...c, e.target.value]); e.target.value = ''; } }}>
              <option value="">— elige una canción —</option>
              {available.map((s) => <option key={s.id} value={s.id}>{s.title} — {s.artist}</option>)}
            </select>
          </div>
        )}
      </form>
    </Drawer>
  );
}

export default function SetlistsPanel({ query: globalQuery }: { query: string }) {
  const [setlists, setSetlists] = useState<AdminSetlist[] | null>(null);
  const [songs, setSongs] = useState<AdminSong[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [selected, setSelected] = useState<AdminSetlist | null>(null);
  const [localQuery, setLocalQuery] = useState('');
  const [newName, setNewName] = useState('');
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
    Promise.all([adminApi.listSetlists(), adminApi.listSongs()])
      .then(([sl, sg]) => { setSetlists(sl.setlists); setSongs(sg.songs); })
      .catch((err) => {
        const s = (err as ApiError)?.status;
        setError(s === 401 ? 'Sesión expirada.' : 'No se pudieron cargar los setlists.');
        setSetlists([]);
      });
  }, []);

  useEffect(() => { load(); }, [load]);

  async function create(e: FormEvent) {
    e.preventDefault();
    setCreating(true);
    try {
      const { setlist } = await adminApi.createSetlist({ name: newName, song_ids: [] });
      setSetlists((cur) => (cur ? [...cur, setlist] : [setlist]));
      setNewName('');
      setSelected(setlist);
      notify('ok', `Setlist “${setlist.name}” creado. Añade canciones.`);
    } catch {
      notify('error', 'No se pudo crear el setlist.');
    } finally {
      setCreating(false);
    }
  }

  const filtered = (setlists || []).filter((s) => !query || s.name.toLowerCase().includes(query.toLowerCase()));

  const columns: Column<AdminSetlist>[] = [
    { key: 'name', header: 'Setlist', render: (s) => <span className="rg-cell-primary">{s.name}</span> },
    { key: 'id', header: 'ID', render: (s) => <CopyId value={s.id} label="ID" /> },
    { key: 'count', header: 'Canciones', align: 'right', render: (s) => (
      <span className="rg-mono">{s.song_ids.length}</span>
    ) },
    { key: 'actions', header: '', align: 'right', render: (s) => (
      <button type="button" className="rg-link" data-testid={`edit-setlist-${s.id}`}
        onClick={(e) => { e.stopPropagation(); setSelected(s); }}>Editar</button>
    ) },
  ];

  return (
    <div>
      <div className="rg-page-head">
        <div>
          <h1>Setlists</h1>
          <p>Bloques de canciones reutilizables para los shows.</p>
        </div>
      </div>

      {error && <Feedback kind="error">{error}</Feedback>}
      {notice && <Feedback kind="ok">{notice}</Feedback>}

      <div className="rg-card" style={{ marginBottom: 14 }}>
        <h3>Nuevo setlist</h3>
        <form onSubmit={create} data-testid="create-setlist-form" className="rg-form-row">
          <div className="rg-field" style={{ flex: '1 1 240px', marginBottom: 0 }}>
            <label className="rg-label" htmlFor="setlist-name">Nombre</label>
            <input id="setlist-name" className="rg-input" value={newName} onChange={(e) => setNewName(e.target.value)} required />
          </div>
          <Button variant="primary" type="submit" disabled={creating}><IconPlus /> {creating ? 'Creando…' : 'Crear'}</Button>
        </form>
      </div>

      <Toolbar>
        <SearchBox testId="setlist-search" placeholder="Buscar setlist…" value={localQuery} onChange={setLocalQuery} />
      </Toolbar>

      <div data-testid="setlists-list">
        <DataTable
          columns={columns}
          rows={setlists === null ? null : filtered}
          rowKey={(s) => s.id}
          rowTestId="setlist-row"
          onRowClick={setSelected}
          empty={<EmptyState icon={<IconList />} title="Sin setlists"
            description="Crea un setlist para agrupar canciones reutilizables." />}
        />
      </div>

      {selected && (
        <SetlistDrawer setlist={selected} songs={songs} notify={notify}
          onClose={() => setSelected(null)}
          onSaved={(s) => setSetlists((cur) => (cur ? cur.map((x) => (x.id === s.id ? s : x)) : cur))}
          onDeleted={(id) => setSetlists((cur) => (cur ? cur.filter((x) => x.id !== id) : cur))} />
      )}

      <ToastStack toasts={toasts} onDismiss={dismiss} />
    </div>
  );
}
