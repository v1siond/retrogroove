'use client';

// Canciones resource — the public request repertoire. Table (title · artist ·
// enabled) with search and a create form. Inline edit (drawer), delete, and a
// quick enabled toggle straight from the row.

import { useEffect, useState, useCallback, FormEvent } from 'react';
import { adminApi, ApiError } from '@/lib/ticketing/admin';
import type { AdminSong } from '@/lib/ticketing/admin';
import {
  DataTable, Column, Drawer, Field, FieldList, Toolbar, SearchBox, Button,
  ConfirmAction, Feedback, EmptyState, ToastStack, useToasts, StatusBadge,
  IconMusic, IconPlus,
} from '../console/ui';

function SongDrawer({
  song, onSaved, onClose, notify,
}: {
  song: AdminSong;
  onSaved: (s: AdminSong) => void;
  onClose: () => void;
  notify: (kind: 'ok' | 'error', msg: string) => void;
}) {
  const [title, setTitle] = useState(song.title);
  const [artist, setArtist] = useState(song.artist);
  const [enabled, setEnabled] = useState(song.enabled);
  const [busy, setBusy] = useState(false);

  async function save(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      const { song: updated } = await adminApi.updateSong(song.id, { title, artist, enabled });
      onSaved(updated);
      notify('ok', `Canción “${updated.title}” guardada.`);
      onClose();
    } catch {
      notify('error', 'No se pudo guardar.');
      setBusy(false);
    }
  }

  const footer = (
    <Button variant="primary" type="submit" form="song-edit-form" disabled={busy}>
      {busy ? 'Guardando…' : 'Guardar'}
    </Button>
  );

  return (
    <Drawer open onClose={onClose} testId="song-detail" title={song.title}
      subtitle={song.artist} footer={footer}>
      <FieldList>
        <Field label="ID" copy={song.id} />
      </FieldList>
      <form id="song-edit-form" data-testid={`song-edit-${song.id}`} onSubmit={save} style={{ marginTop: 12 }}>
        <div className="rg-field">
          <label className="rg-label" htmlFor={`song-title-${song.id}`}>Título</label>
          <input id={`song-title-${song.id}`} aria-label="Título" className="rg-input" value={title} onChange={(e) => setTitle(e.target.value)} required />
        </div>
        <div className="rg-field">
          <label className="rg-label" htmlFor={`song-artist-${song.id}`}>Artista</label>
          <input id={`song-artist-${song.id}`} aria-label="Artista" className="rg-input" value={artist} onChange={(e) => setArtist(e.target.value)} required />
        </div>
        <label style={{ display: 'inline-flex', gap: 8, alignItems: 'center', fontSize: 13 }}>
          <input type="checkbox" checked={enabled} onChange={(e) => setEnabled(e.target.checked)} />
          Visible en el repertorio público
        </label>
      </form>
    </Drawer>
  );
}

export default function SongsPanel({ query: globalQuery }: { query: string }) {
  const [songs, setSongs] = useState<AdminSong[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [localQuery, setLocalQuery] = useState('');
  const [busy, setBusy] = useState<string | null>(null);
  const [selected, setSelected] = useState<AdminSong | null>(null);
  const [newTitle, setNewTitle] = useState('');
  const [newArtist, setNewArtist] = useState('');
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
    adminApi.listSongs()
      .then((r) => setSongs(r.songs))
      .catch((err) => {
        const s = (err as ApiError)?.status;
        setError(s === 401 ? 'Sesión expirada.' : 'No se pudieron cargar las canciones.');
        setSongs([]);
      });
  }, []);

  useEffect(() => { load(); }, [load]);

  async function create(e: FormEvent) {
    e.preventDefault();
    setCreating(true);
    try {
      const { song } = await adminApi.createSong({ title: newTitle, artist: newArtist, enabled: true });
      setSongs((cur) => (cur ? [...cur, song] : [song]));
      setNewTitle('');
      setNewArtist('');
      notify('ok', `Canción “${song.title}” añadida.`);
    } catch {
      notify('error', 'No se pudo crear la canción.');
    } finally {
      setCreating(false);
    }
  }

  async function toggle(song: AdminSong) {
    setBusy(song.id);
    try {
      const { song: updated } = await adminApi.updateSong(song.id, { enabled: !song.enabled });
      setSongs((cur) => (cur ? cur.map((s) => (s.id === song.id ? updated : s)) : cur));
    } catch {
      notify('error', 'No se pudo actualizar la canción.');
    } finally {
      setBusy(null);
    }
  }

  async function remove(song: AdminSong) {
    setBusy(song.id);
    try {
      await adminApi.deleteSong(song.id);
      setSongs((cur) => (cur ? cur.filter((s) => s.id !== song.id) : cur));
      notify('ok', `Canción “${song.title}” eliminada.`);
    } catch {
      notify('error', 'No se pudo eliminar la canción.');
    } finally {
      setBusy(null);
    }
  }

  const filtered = (songs || []).filter((s) =>
    !query || `${s.title} ${s.artist}`.toLowerCase().includes(query.toLowerCase()));

  const columns: Column<AdminSong>[] = [
    { key: 'title', header: 'Título', render: (s) => <span className="rg-cell-primary">{s.title}</span> },
    { key: 'artist', header: 'Artista', render: (s) => s.artist },
    { key: 'enabled', header: 'Estado', render: (s) => <StatusBadge status={s.enabled ? 'published' : 'draft'} /> },
    { key: 'actions', header: '', align: 'right', render: (s) => (
      <div style={{ display: 'inline-flex', gap: 8, alignItems: 'center' }} onClick={(e) => e.stopPropagation()}>
        <button type="button" className="rg-btn rg-btn-secondary rg-btn-sm" data-testid={`toggle-song-${s.id}`}
          onClick={() => toggle(s)} disabled={busy === s.id}
          style={s.enabled ? { color: 'var(--ok-fg)', borderColor: '#bbf7d0' } : undefined}>
          {s.enabled ? 'Activa' : 'Oculta'}
        </button>
        <button type="button" className="rg-link" data-testid={`edit-song-${s.id}`} onClick={() => setSelected(s)}>Editar</button>
        <ConfirmAction testId={`delete-song-${s.id}`} label="Eliminar" confirmLabel="Sí" prompt="¿Eliminar?"
          busy={busy === s.id} onConfirm={() => remove(s)} />
      </div>
    ) },
  ];

  return (
    <div>
      <div className="rg-page-head">
        <div>
          <h1>Canciones</h1>
          <p>El repertorio que ven los fans al pedir canciones.</p>
        </div>
      </div>

      {error && <Feedback kind="error">{error}</Feedback>}
      {notice && <Feedback kind="ok">{notice}</Feedback>}

      <div className="rg-card" style={{ marginBottom: 14 }}>
        <h3>Añadir canción</h3>
        <form onSubmit={create} data-testid="create-song-form" className="rg-form-row">
          <div className="rg-field" style={{ flex: '1 1 200px', marginBottom: 0 }}>
            <label className="rg-label" htmlFor="song-title">Título</label>
            <input id="song-title" aria-label="Título" className="rg-input" value={newTitle} onChange={(e) => setNewTitle(e.target.value)} required />
          </div>
          <div className="rg-field" style={{ flex: '1 1 200px', marginBottom: 0 }}>
            <label className="rg-label" htmlFor="song-artist">Artista</label>
            <input id="song-artist" aria-label="Artista" className="rg-input" value={newArtist} onChange={(e) => setNewArtist(e.target.value)} required />
          </div>
          <Button variant="primary" type="submit" disabled={creating}><IconPlus /> {creating ? 'Añadiendo…' : 'Añadir'}</Button>
        </form>
      </div>

      <Toolbar>
        <SearchBox testId="song-search" placeholder="Buscar canción…" value={localQuery} onChange={setLocalQuery} />
      </Toolbar>

      <div data-testid="songs-list">
        <DataTable
          columns={columns}
          rows={songs === null ? null : filtered}
          rowKey={(s) => s.id}
          rowTestId="song-row"
          onRowClick={setSelected}
          empty={<EmptyState icon={<IconMusic />} title="Sin canciones"
            description="Añade canciones para que aparezcan en el repertorio público." />}
        />
      </div>

      {selected && (
        <SongDrawer song={selected} notify={notify} onClose={() => setSelected(null)}
          onSaved={(s) => setSongs((cur) => (cur ? cur.map((x) => (x.id === s.id ? s : x)) : cur))} />
      )}

      <ToastStack toasts={toasts} onDismiss={dismiss} />
    </div>
  );
}
