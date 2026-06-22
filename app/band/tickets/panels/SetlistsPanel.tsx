'use client';

// Setlists resource: list, create, edit (rename + add/remove/reorder the
// song_ids), and delete. Needs the song catalog to resolve ids to titles and to
// offer songs for adding.

import { useEffect, useState, useCallback, FormEvent } from 'react';
import { adminApi, ApiError } from '@/lib/ticketing/admin';
import { ui } from '@/lib/ticketing/ui';
import type { AdminSetlist, AdminSong } from '@/lib/ticketing/admin';
import { Feedback, ConfirmAction } from '../shared';

function move<T>(arr: T[], from: number, to: number): T[] {
  if (to < 0 || to >= arr.length) return arr;
  const next = [...arr];
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item);
  return next;
}

// Edit a setlist's name + ordered song_ids.
function SetlistEditor({
  setlist,
  songs,
  onSaved,
  onCancel,
}: {
  setlist: AdminSetlist;
  songs: AdminSong[];
  onSaved: (s: AdminSetlist) => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState(setlist.name);
  const [ids, setIds] = useState<string[]>(setlist.song_ids);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const byId = new Map(songs.map((s) => [s.id, s]));
  const available = songs.filter((s) => !ids.includes(s.id));

  async function save(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const { setlist: updated } = await adminApi.updateSetlist(setlist.id, { name, song_ids: ids });
      onSaved(updated);
    } catch {
      setError('No se pudo guardar el setlist.');
      setBusy(false);
    }
  }

  return (
    <form onSubmit={save} data-testid={`setlist-edit-${setlist.id}`} className="py-2">
      {error && <Feedback kind="error">{error}</Feedback>}
      <label className={ui.label} htmlFor={`sl-name-${setlist.id}`}>Nombre</label>
      <input id={`sl-name-${setlist.id}`} className={ui.input} value={name} onChange={(e) => setName(e.target.value)} required />

      <label className={ui.label}>Canciones ({ids.length})</label>
      <div data-testid="setlist-songs" className="flex flex-col gap-1">
        {ids.length === 0 && <p className="text-[var(--color-text-faint)] text-sm">Vacío — añade canciones abajo.</p>}
        {ids.map((id, i) => {
          const song = byId.get(id);
          return (
            <div key={id} className="flex items-center gap-2 py-1.5 px-2 rounded-lg bg-white/5">
              <span className="text-xs text-[var(--color-gold)] w-6 text-center">{i + 1}</span>
              <span className="flex-1 text-sm min-w-0 truncate">{song ? `${song.title} — ${song.artist}` : id}</span>
              <button type="button" aria-label="Subir" data-testid={`sl-up-${id}`} onClick={() => setIds((c) => move(c, i, i - 1))} disabled={i === 0}
                className="px-2 text-[var(--color-cyan)] disabled:opacity-30 cursor-pointer">↑</button>
              <button type="button" aria-label="Bajar" data-testid={`sl-down-${id}`} onClick={() => setIds((c) => move(c, i, i + 1))} disabled={i === ids.length - 1}
                className="px-2 text-[var(--color-cyan)] disabled:opacity-30 cursor-pointer">↓</button>
              <button type="button" aria-label="Quitar" data-testid={`sl-remove-${id}`} onClick={() => setIds((c) => c.filter((x) => x !== id))}
                className="px-2 text-[var(--color-red)] cursor-pointer">✕</button>
            </div>
          );
        })}
      </div>

      {available.length > 0 && (
        <div className="mt-3">
          <label className={ui.label} htmlFor={`sl-add-${setlist.id}`}>Añadir canción</label>
          <select id={`sl-add-${setlist.id}`} data-testid="setlist-add-song" defaultValue="" onChange={(e) => { if (e.target.value) { setIds((c) => [...c, e.target.value]); e.target.value = ''; } }}
            style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', color: 'var(--color-text)', borderRadius: '10px', padding: '8px 12px', fontSize: '0.85rem', width: '100%', maxWidth: '28rem' }}>
            <option value="">— elige una canción —</option>
            {available.map((s) => <option key={s.id} value={s.id}>{s.title} — {s.artist}</option>)}
          </select>
        </div>
      )}

      <div className="flex gap-3 items-center mt-3">
        <button type="submit" className={ui.btn} style={{ marginTop: 0 }} disabled={busy}>{busy ? 'Guardando...' : 'Guardar setlist'}</button>
        <button type="button" className="underline text-[var(--color-text-muted)] cursor-pointer text-sm" onClick={onCancel}>Cancelar</button>
      </div>
    </form>
  );
}

export default function SetlistsPanel() {
  const [setlists, setSetlists] = useState<AdminSetlist[] | null>(null);
  const [songs, setSongs] = useState<AdminSong[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [editing, setEditing] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [newName, setNewName] = useState('');
  const [creating, setCreating] = useState(false);

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
    setError(null);
    setNotice(null);
    try {
      const { setlist } = await adminApi.createSetlist({ name: newName, song_ids: [] });
      setSetlists((cur) => (cur ? [...cur, setlist] : [setlist]));
      setNewName('');
      setEditing(setlist.id);
      setNotice(`Setlist “${setlist.name}” creado. Añade canciones.`);
    } catch {
      setError('No se pudo crear el setlist.');
    } finally {
      setCreating(false);
    }
  }

  async function remove(sl: AdminSetlist) {
    setBusy(sl.id);
    setError(null);
    setNotice(null);
    try {
      await adminApi.deleteSetlist(sl.id);
      setSetlists((cur) => (cur ? cur.filter((x) => x.id !== sl.id) : cur));
      setNotice(`Setlist “${sl.name}” eliminado.`);
    } catch {
      setError('No se pudo eliminar el setlist.');
    } finally {
      setBusy(null);
    }
  }

  return (
    <div>
      <h1 className={ui.h1}>Setlists</h1>
      <p className={ui.muted}>Bloques de canciones reutilizables para los shows.</p>

      {error && <Feedback kind="error">{error}</Feedback>}
      {notice && <Feedback kind="ok">{notice}</Feedback>}

      <form className={ui.card} onSubmit={create} data-testid="create-setlist-form">
        <h2 className={ui.h2}>Nuevo setlist</h2>
        <div className="flex items-end gap-3 flex-wrap">
          <div className="flex-1 min-w-[200px]">
            <label className={ui.label} htmlFor="setlist-name">Nombre</label>
            <input id="setlist-name" className={ui.input} value={newName} onChange={(e) => setNewName(e.target.value)} required />
          </div>
          <button type="submit" className={ui.btn} disabled={creating}>{creating ? 'Creando...' : 'Crear'}</button>
        </div>
      </form>

      <div className={ui.card} data-testid="setlists-list">
        {setlists === null ? (
          <p className="text-[var(--color-text-muted)]">Cargando setlists...</p>
        ) : setlists.length === 0 ? (
          <p className="text-[var(--color-text-muted)]">No hay setlists.</p>
        ) : (
          <div className="flex flex-col gap-1">
            {setlists.map((sl) => (
              <div key={sl.id} data-testid="setlist-row" className="border-b border-[var(--color-border)] last:border-0 py-2">
                {editing === sl.id ? (
                  <SetlistEditor
                    setlist={sl}
                    songs={songs}
                    onSaved={(updated) => { setSetlists((cur) => cur ? cur.map((x) => x.id === updated.id ? updated : x) : cur); setEditing(null); }}
                    onCancel={() => setEditing(null)}
                  />
                ) : (
                  <div className="flex items-center justify-between gap-3 flex-wrap">
                    <div className="min-w-0">
                      <div className="text-sm">{sl.name}</div>
                      <div className="text-xs text-[var(--color-text-muted)]">{sl.song_ids.length} canción{sl.song_ids.length === 1 ? '' : 'es'}</div>
                    </div>
                    <div className="flex items-center gap-3 whitespace-nowrap">
                      <button type="button" data-testid={`edit-setlist-${sl.id}`} onClick={() => setEditing(sl.id)} className="text-[#00e5ff] underline text-sm cursor-pointer">Editar</button>
                      <ConfirmAction testId={`delete-setlist-${sl.id}`} label="Eliminar" confirmLabel="Sí" prompt="¿Eliminar?" busy={busy === sl.id} onConfirm={() => remove(sl)} />
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
