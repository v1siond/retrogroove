'use client';

// Songs resource: list, create, edit (inline), delete, and toggle whether a
// song is enabled in the public request picker.

import { useEffect, useState, useCallback, FormEvent } from 'react';
import { adminApi, ApiError } from '@/lib/ticketing/admin';
import { ui } from '@/lib/ticketing/ui';
import type { AdminSong } from '@/lib/ticketing/admin';
import { Feedback, ConfirmAction, searchStyle } from '../shared';

function EditRow({ song, onSaved, onCancel }: { song: AdminSong; onSaved: (s: AdminSong) => void; onCancel: () => void }) {
  const [title, setTitle] = useState(song.title);
  const [artist, setArtist] = useState(song.artist);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const { song: updated } = await adminApi.updateSong(song.id, { title, artist });
      onSaved(updated);
    } catch {
      setError('No se pudo guardar.');
      setBusy(false);
    }
  }

  return (
    <form onSubmit={save} data-testid={`song-edit-${song.id}`} className="flex items-center gap-2 py-2 flex-wrap">
      <input aria-label="Título" value={title} onChange={(e) => setTitle(e.target.value)} required style={searchStyle} />
      <input aria-label="Artista" value={artist} onChange={(e) => setArtist(e.target.value)} required style={searchStyle} />
      <button type="submit" className={ui.btn} style={{ marginTop: 0, padding: '6px 16px', fontSize: '0.85rem' }} disabled={busy}>Guardar</button>
      <button type="button" className="underline text-[var(--color-text-muted)] cursor-pointer text-sm" onClick={onCancel}>Cancelar</button>
      {error && <span className="text-[var(--color-red)] text-xs">{error}</span>}
    </form>
  );
}

export default function SongsPanel() {
  const [songs, setSongs] = useState<AdminSong[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [editing, setEditing] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  // New-song form.
  const [newTitle, setNewTitle] = useState('');
  const [newArtist, setNewArtist] = useState('');
  const [creating, setCreating] = useState(false);

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
    setError(null);
    setNotice(null);
    try {
      const { song } = await adminApi.createSong({ title: newTitle, artist: newArtist, enabled: true });
      setSongs((cur) => (cur ? [...cur, song] : [song]));
      setNewTitle('');
      setNewArtist('');
      setNotice(`Canción “${song.title}” añadida.`);
    } catch {
      setError('No se pudo crear la canción.');
    } finally {
      setCreating(false);
    }
  }

  async function toggle(song: AdminSong) {
    setBusy(song.id);
    setError(null);
    try {
      const { song: updated } = await adminApi.updateSong(song.id, { enabled: !song.enabled });
      setSongs((cur) => (cur ? cur.map((s) => (s.id === song.id ? updated : s)) : cur));
    } catch {
      setError('No se pudo actualizar la canción.');
    } finally {
      setBusy(null);
    }
  }

  async function remove(song: AdminSong) {
    setBusy(song.id);
    setError(null);
    setNotice(null);
    try {
      await adminApi.deleteSong(song.id);
      setSongs((cur) => (cur ? cur.filter((s) => s.id !== song.id) : cur));
      setNotice(`Canción “${song.title}” eliminada.`);
    } catch {
      setError('No se pudo eliminar la canción.');
    } finally {
      setBusy(null);
    }
  }

  const filtered = (songs || []).filter((s) =>
    !query || `${s.title} ${s.artist}`.toLowerCase().includes(query.toLowerCase()));

  return (
    <div>
      <h1 className={ui.h1}>Canciones</h1>
      <p className={ui.muted}>El repertorio que ven los fans al pedir canciones.</p>

      {error && <Feedback kind="error">{error}</Feedback>}
      {notice && <Feedback kind="ok">{notice}</Feedback>}

      {/* Create */}
      <form className={ui.card} onSubmit={create} data-testid="create-song-form">
        <h2 className={ui.h2}>Añadir canción</h2>
        <div className="flex items-end gap-3 flex-wrap">
          <div className="flex-1 min-w-[180px]">
            <label className={ui.label} htmlFor="song-title">Título</label>
            <input id="song-title" className={ui.input} value={newTitle} onChange={(e) => setNewTitle(e.target.value)} required />
          </div>
          <div className="flex-1 min-w-[180px]">
            <label className={ui.label} htmlFor="song-artist">Artista</label>
            <input id="song-artist" className={ui.input} value={newArtist} onChange={(e) => setNewArtist(e.target.value)} required />
          </div>
          <button type="submit" className={ui.btn} disabled={creating}>{creating ? 'Añadiendo...' : 'Añadir'}</button>
        </div>
      </form>

      {/* Filter */}
      <div className={`${ui.card} flex gap-3 items-center flex-wrap`}>
        <input data-testid="song-search" placeholder="Buscar canción o artista…" value={query} onChange={(e) => setQuery(e.target.value)} style={searchStyle} />
      </div>

      {/* List */}
      <div className={ui.card} data-testid="songs-list">
        {songs === null ? (
          <p className="text-[var(--color-text-muted)]">Cargando canciones...</p>
        ) : filtered.length === 0 ? (
          <p className="text-[var(--color-text-muted)]">No hay canciones.</p>
        ) : (
          <div className="flex flex-col gap-1">
            {filtered.map((song) => (
              <div key={song.id} data-testid="song-row" className="border-b border-[var(--color-border)] last:border-0">
                {editing === song.id ? (
                  <EditRow song={song} onSaved={(s) => { setSongs((cur) => cur ? cur.map((x) => x.id === s.id ? s : x) : cur); setEditing(null); }} onCancel={() => setEditing(null)} />
                ) : (
                  <div className="flex items-center justify-between gap-3 py-2.5 flex-wrap">
                    <div className="min-w-0">
                      <div className="text-sm">{song.title}</div>
                      <div className="text-xs text-[var(--color-text-muted)]">{song.artist}</div>
                    </div>
                    <div className="flex items-center gap-2 whitespace-nowrap flex-wrap justify-end">
                      <button type="button" data-testid={`toggle-song-${song.id}`} onClick={() => toggle(song)} disabled={busy === song.id}
                        style={{ background: 'none', border: `1px solid ${song.enabled ? 'var(--color-green)' : 'var(--color-border)'}`,
                          color: song.enabled ? 'var(--color-green)' : 'var(--color-text-muted)', borderRadius: 'var(--radius-pill)',
                          padding: '4px 12px', fontSize: '0.72rem', cursor: 'pointer' }}>
                        {song.enabled ? 'Activa' : 'Oculta'}
                      </button>
                      <button type="button" data-testid={`edit-song-${song.id}`} onClick={() => setEditing(song.id)}
                        className="text-[#00e5ff] underline text-sm cursor-pointer">Editar</button>
                      <ConfirmAction testId={`delete-song-${song.id}`} label="Eliminar" confirmLabel="Sí" prompt="¿Eliminar?" busy={busy === song.id} onConfirm={() => remove(song)} />
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
