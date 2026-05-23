'use client'

import { useState, useRef, useEffect, useMemo } from 'react'
import { getAllSongs } from '@/lib/songs'
import { Song } from '@/lib/types'

type ViewMode = 'repertorio' | 'builder'

export default function SetlistPage() {
  const allSongs = useMemo(() => getAllSongs().sort((a, b) => a.title.localeCompare(b.title)), [])

  const [mounted, setMounted] = useState(false)
  const [viewMode, setViewMode] = useState<ViewMode>('repertorio')
  const [searchQuery, setSearchQuery] = useState('')
  const [mySetlist, setMySetlist] = useState<string[]>([])
  const [showCopied, setShowCopied] = useState(false)

  const dragSongId = useRef<string | null>(null)
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null)

  useEffect(() => { setMounted(true) }, [])

  const songsMap = useMemo(() => new Map(allSongs.map(s => [s.id, s])), [allSongs])

  const filteredSongs = useMemo(() => {
    if (!searchQuery.trim()) return allSongs
    const q = searchQuery.toLowerCase()
    return allSongs.filter(s =>
      s.title.toLowerCase().includes(q) ||
      s.artist.toLowerCase().includes(q)
    )
  }, [allSongs, searchQuery])

  const mySetlistSongs = mySetlist.map(id => songsMap.get(id)).filter((s): s is Song => !!s)
  const availableForBuilder = allSongs.filter(s => !mySetlist.includes(s.id))

  const addToSetlist = (songId: string) => {
    if (!mySetlist.includes(songId)) {
      setMySetlist(prev => [...prev, songId])
    }
  }

  const removeFromSetlist = (songId: string) => {
    setMySetlist(prev => prev.filter(id => id !== songId))
  }

  const moveSong = (fromIdx: number, toIdx: number) => {
    setMySetlist(prev => {
      const newList = [...prev]
      const [moved] = newList.splice(fromIdx, 1)
      newList.splice(toIdx, 0, moved)
      return newList
    })
  }

  const copySetlistToClipboard = () => {
    const text = mySetlistSongs.map((s, i) => `${i + 1}. ${s.title} - ${s.artist}`).join('\n')
    const header = `Mi Setlist RetroGroove (${mySetlistSongs.length} canciones)\n${'─'.repeat(40)}\n`
    navigator.clipboard.writeText(header + text)
    setShowCopied(true)
    setTimeout(() => setShowCopied(false), 2000)
  }

  const shareViaWhatsApp = () => {
    const text = mySetlistSongs.map((s, i) => `${i + 1}. ${s.title} - ${s.artist}`).join('\n')
    const message = encodeURIComponent(`¡Hola! Me interesa este setlist para mi evento:\n\n${text}\n\n¿Podemos coordinarlo?`)
    window.open(`https://wa.me/968622293?text=${message}`, '_blank')
  }

  if (!mounted) return null

  return (
    <>
      <title>Repertorio — RetroGroove</title>

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700&family=Bebas+Neue&display=swap');

        .page {
          --pink: #ff1493;
          --gold: #ffd700;
          --cyan: #00e5ff;
          --purple: #bf00ff;
          min-height: 100vh;
          background: linear-gradient(180deg, #050010 0%, #0d0025 40%, #100020 70%, #050010 100%);
          color: #e8e8e8;
          font-family: 'Outfit', sans-serif;
        }

        .header {
          position: sticky; top: 0; z-index: 100;
          padding: 1rem 1.5rem;
          background: rgba(5,0,16,0.95);
          backdrop-filter: blur(16px);
          border-bottom: 1px solid rgba(255,255,255,0.06);
        }
        .header-top {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 1rem;
        }
        .header a { color: rgba(255,255,255,0.5); text-decoration: none; font-size: 0.85rem; }
        .header a:hover { color: var(--gold); }
        .header-title {
          font-family: 'Bebas Neue', sans-serif;
          font-size: 1.5rem;
          letter-spacing: 0.1em;
          color: #fff;
        }
        .song-count {
          color: var(--gold);
          font-size: 0.9rem;
        }

        .tabs {
          display: flex;
          gap: 0.5rem;
        }
        .tab {
          padding: 0.7rem 1.5rem;
          background: rgba(255,255,255,0.05);
          border: 2px solid transparent;
          border-radius: 10px;
          cursor: pointer;
          font-family: 'Bebas Neue', sans-serif;
          font-size: 1.1rem;
          letter-spacing: 0.08em;
          color: rgba(255,255,255,0.5);
          transition: all 0.2s;
          display: flex;
          align-items: center;
          gap: 0.6rem;
        }
        .tab:hover { background: rgba(255,255,255,0.1); color: rgba(255,255,255,0.8); }
        .tab.active {
          border-color: var(--pink);
          color: #fff;
          background: rgba(255,20,147,0.1);
        }
        .tab .badge {
          background: var(--pink);
          color: #fff;
          padding: 0.15rem 0.5rem;
          border-radius: 10px;
          font-size: 0.8rem;
          font-family: 'Outfit', sans-serif;
        }

        .container {
          max-width: 1200px;
          margin: 0 auto;
          padding: 1.5rem;
        }

        /* Repertorio View */
        .search-bar {
          margin-bottom: 1.5rem;
        }
        .search-input {
          width: 100%;
          padding: 0.9rem 1.2rem;
          background: rgba(255,255,255,0.05);
          border: 1px solid rgba(255,255,255,0.1);
          border-radius: 12px;
          color: #fff;
          font-size: 1rem;
          font-family: 'Outfit', sans-serif;
        }
        .search-input::placeholder { color: rgba(255,255,255,0.4); }
        .search-input:focus {
          outline: none;
          border-color: var(--pink);
          background: rgba(255,255,255,0.08);
        }

        .songs-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
          gap: 0.8rem;
        }

        .song-card {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 1rem 1.2rem;
          background: rgba(255,255,255,0.03);
          border: 1px solid rgba(255,255,255,0.06);
          border-radius: 12px;
          transition: all 0.2s;
        }
        .song-card:hover {
          background: rgba(255,255,255,0.06);
          border-color: rgba(255,255,255,0.1);
        }
        .song-card.in-setlist {
          border-color: var(--pink);
          background: rgba(255,20,147,0.08);
        }
        .song-info { flex: 1; }
        .song-title {
          color: #fff;
          font-weight: 500;
          font-size: 1rem;
          margin-bottom: 0.2rem;
        }
        .song-artist {
          color: rgba(255,255,255,0.5);
          font-size: 0.85rem;
        }
        .song-action {
          padding: 0.5rem 1rem;
          border: none;
          border-radius: 8px;
          font-size: 0.85rem;
          font-weight: 500;
          cursor: pointer;
          transition: all 0.2s;
        }
        .song-action.add {
          background: linear-gradient(135deg, var(--pink), var(--purple));
          color: #fff;
        }
        .song-action.add:hover { opacity: 0.85; transform: scale(1.05); }
        .song-action.remove {
          background: rgba(255,255,255,0.1);
          color: rgba(255,255,255,0.7);
        }
        .song-action.remove:hover { background: rgba(255,100,100,0.2); color: #ff6b6b; }

        /* Builder View */
        .builder-layout {
          display: grid;
          grid-template-columns: 1fr 400px;
          gap: 1.5rem;
        }
        @media (max-width: 900px) {
          .builder-layout { grid-template-columns: 1fr; }
        }

        .available-section, .setlist-section {
          background: rgba(255,255,255,0.03);
          border: 1px solid rgba(255,255,255,0.06);
          border-radius: 16px;
          padding: 1.2rem;
        }

        .section-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 1rem;
        }
        .section-title {
          font-family: 'Bebas Neue', sans-serif;
          font-size: 1.3rem;
          letter-spacing: 0.05em;
          color: var(--gold);
        }

        .available-songs {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(250px, 1fr));
          gap: 0.5rem;
          max-height: 60vh;
          overflow-y: auto;
        }

        .available-song {
          padding: 0.6rem 0.9rem;
          background: rgba(255,255,255,0.03);
          border: 1px solid rgba(255,255,255,0.06);
          border-radius: 8px;
          cursor: pointer;
          transition: all 0.15s;
        }
        .available-song:hover {
          background: rgba(255,255,255,0.08);
          border-color: var(--pink);
        }
        .available-song .title { color: #fff; font-weight: 500; font-size: 0.9rem; }
        .available-song .artist { color: rgba(255,255,255,0.5); font-size: 0.75rem; }

        .setlist-section {
          position: sticky;
          top: 120px;
          height: fit-content;
          max-height: calc(100vh - 150px);
          display: flex;
          flex-direction: column;
        }

        .my-setlist {
          flex: 1;
          overflow-y: auto;
          min-height: 200px;
        }

        .setlist-song {
          display: flex;
          align-items: center;
          gap: 0.8rem;
          padding: 0.7rem 0.9rem;
          background: rgba(255,255,255,0.03);
          border: 1px solid rgba(255,255,255,0.06);
          border-radius: 8px;
          margin-bottom: 0.5rem;
          cursor: grab;
          transition: all 0.15s;
        }
        .setlist-song:hover { background: rgba(255,255,255,0.08); }
        .setlist-song.drag-over {
          border-color: var(--gold);
          background: rgba(255,215,0,0.1);
        }
        .setlist-song .num {
          width: 24px;
          height: 24px;
          display: flex;
          align-items: center;
          justify-content: center;
          background: rgba(255,255,255,0.1);
          border-radius: 6px;
          color: var(--gold);
          font-size: 0.8rem;
          font-weight: 600;
        }
        .setlist-song .info { flex: 1; }
        .setlist-song .title { color: #fff; font-weight: 500; font-size: 0.9rem; }
        .setlist-song .artist { color: rgba(255,255,255,0.5); font-size: 0.75rem; }
        .setlist-song .remove {
          padding: 0.3rem;
          background: none;
          border: none;
          color: rgba(255,255,255,0.4);
          font-size: 1.2rem;
          cursor: pointer;
          line-height: 1;
        }
        .setlist-song .remove:hover { color: #ff6b6b; }

        .empty-setlist {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          padding: 3rem 1rem;
          color: rgba(255,255,255,0.4);
          text-align: center;
        }
        .empty-setlist p { margin: 0.3rem 0; }

        .setlist-actions {
          display: flex;
          gap: 0.5rem;
          margin-top: 1rem;
          padding-top: 1rem;
          border-top: 1px solid rgba(255,255,255,0.06);
        }
        .btn {
          flex: 1;
          padding: 0.7rem 1rem;
          border: none;
          border-radius: 10px;
          font-family: 'Outfit', sans-serif;
          font-size: 0.9rem;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 0.4rem;
        }
        .btn:disabled { opacity: 0.4; cursor: not-allowed; }
        .btn.primary {
          background: linear-gradient(135deg, #25D366, #128C7E);
          color: #fff;
        }
        .btn.primary:hover:not(:disabled) { transform: translateY(-2px); box-shadow: 0 5px 20px rgba(37,211,102,0.3); }
        .btn.secondary {
          background: rgba(255,255,255,0.1);
          color: #fff;
        }
        .btn.secondary:hover:not(:disabled) { background: rgba(255,255,255,0.15); }

        .copied-toast {
          position: fixed;
          bottom: 2rem;
          left: 50%;
          transform: translateX(-50%);
          background: var(--gold);
          color: #000;
          padding: 0.8rem 1.5rem;
          border-radius: 10px;
          font-weight: 600;
          animation: fadeInOut 2s ease-in-out;
        }
        @keyframes fadeInOut {
          0%, 100% { opacity: 0; transform: translateX(-50%) translateY(10px); }
          10%, 90% { opacity: 1; transform: translateX(-50%) translateY(0); }
        }

        .no-results {
          text-align: center;
          padding: 3rem;
          color: rgba(255,255,255,0.4);
        }
      `}</style>

      <div className="page">
        <div className="header">
          <div className="header-top">
            <a href="/">← Volver al inicio</a>
            <span className="header-title">RETROGROOVE</span>
            <span className="song-count">{allSongs.length} canciones</span>
          </div>
          <div className="tabs">
            <div
              className={`tab ${viewMode === 'repertorio' ? 'active' : ''}`}
              onClick={() => setViewMode('repertorio')}
            >
              Repertorio
            </div>
            <div
              className={`tab ${viewMode === 'builder' ? 'active' : ''}`}
              onClick={() => setViewMode('builder')}
            >
              Armar Mi Setlist
              {mySetlist.length > 0 && <span className="badge">{mySetlist.length}</span>}
            </div>
          </div>
        </div>

        <div className="container">
          {viewMode === 'repertorio' && (
            <>
              <div className="search-bar">
                <input
                  type="text"
                  className="search-input"
                  placeholder="Buscar por canción o artista..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>

              {filteredSongs.length === 0 ? (
                <div className="no-results">
                  <p>No se encontraron canciones para "{searchQuery}"</p>
                </div>
              ) : (
                <div className="songs-grid">
                  {filteredSongs.map(song => {
                    const inSetlist = mySetlist.includes(song.id)
                    return (
                      <div key={song.id} className={`song-card ${inSetlist ? 'in-setlist' : ''}`}>
                        <div className="song-info">
                          <div className="song-title">{song.title}</div>
                          <div className="song-artist">{song.artist}</div>
                        </div>
                        <button
                          className={`song-action ${inSetlist ? 'remove' : 'add'}`}
                          onClick={() => inSetlist ? removeFromSetlist(song.id) : addToSetlist(song.id)}
                        >
                          {inSetlist ? '✓ Agregada' : '+ Agregar'}
                        </button>
                      </div>
                    )
                  })}
                </div>
              )}
            </>
          )}

          {viewMode === 'builder' && (
            <div className="builder-layout">
              <div className="available-section">
                <div className="section-header">
                  <span className="section-title">Canciones Disponibles ({availableForBuilder.length})</span>
                </div>
                <div className="available-songs">
                  {availableForBuilder.map(song => (
                    <div
                      key={song.id}
                      className="available-song"
                      onClick={() => addToSetlist(song.id)}
                    >
                      <div className="title">{song.title}</div>
                      <div className="artist">{song.artist}</div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="setlist-section">
                <div className="section-header">
                  <span className="section-title">Mi Setlist ({mySetlist.length})</span>
                </div>

                <div className="my-setlist">
                  {mySetlistSongs.length === 0 ? (
                    <div className="empty-setlist">
                      <p>Tu setlist está vacío</p>
                      <p style={{ fontSize: '0.85rem' }}>Haz click en las canciones para agregarlas</p>
                    </div>
                  ) : (
                    mySetlistSongs.map((song, idx) => (
                      <div
                        key={song.id}
                        className={`setlist-song ${dragOverIndex === idx ? 'drag-over' : ''}`}
                        draggable
                        onDragStart={() => { dragSongId.current = song.id }}
                        onDragOver={(e) => { e.preventDefault(); setDragOverIndex(idx) }}
                        onDragLeave={() => setDragOverIndex(null)}
                        onDrop={() => {
                          if (dragSongId.current) {
                            const fromIdx = mySetlist.indexOf(dragSongId.current)
                            if (fromIdx !== -1 && fromIdx !== idx) {
                              moveSong(fromIdx, idx)
                            }
                          }
                          dragSongId.current = null
                          setDragOverIndex(null)
                        }}
                        onDragEnd={() => { dragSongId.current = null; setDragOverIndex(null) }}
                      >
                        <span className="num">{idx + 1}</span>
                        <div className="info">
                          <div className="title">{song.title}</div>
                          <div className="artist">{song.artist}</div>
                        </div>
                        <button className="remove" onClick={() => removeFromSetlist(song.id)}>×</button>
                      </div>
                    ))
                  )}
                </div>

                <div className="setlist-actions">
                  <button
                    className="btn secondary"
                    onClick={copySetlistToClipboard}
                    disabled={mySetlist.length === 0}
                  >
                    📋 Copiar
                  </button>
                  <button
                    className="btn secondary"
                    onClick={() => window.open(`/band/setlist/imprimir?songs=${mySetlist.join(',')}`, '_blank')}
                    disabled={mySetlist.length === 0}
                  >
                    🖨️ Imprimir
                  </button>
                  <button
                    className="btn primary"
                    onClick={shareViaWhatsApp}
                    disabled={mySetlist.length === 0}
                  >
                    💬 WhatsApp
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        {showCopied && (
          <div className="copied-toast">¡Setlist copiado!</div>
        )}
      </div>
    </>
  )
}
