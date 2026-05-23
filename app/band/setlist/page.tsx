'use client'

import { useState, useCallback, useRef, useEffect, useMemo } from 'react'
import { getAllSongs } from '@/lib/songs'
import { Song, Setlist, getSetlistColor } from '@/lib/types'

import bloque1Data from '@/content/setlists/bloque-1.json'
import bloque2Data from '@/content/setlists/bloque-2.json'
import bloque3Data from '@/content/setlists/bloque-3.json'
import bloque4Data from '@/content/setlists/bloque-4.json'
import extrasData from '@/content/setlists/extras.json'

const initialSetlists: Setlist[] = [
  bloque1Data as Setlist,
  bloque2Data as Setlist,
  bloque3Data as Setlist,
  bloque4Data as Setlist,
  extrasData as Setlist,
]

const songKey = (s: Song) => s.id

export default function SetlistPrint() {
  const allSongs = useMemo(() => getAllSongs(), [])
  const songsMap = useMemo(() => new Map(allSongs.map(s => [s.id, s])), [allSongs])

  const [mounted, setMounted] = useState(false)
  const [setlists, setSetlists] = useState<Setlist[]>(initialSetlists)
  const [activeSetlist, setActiveSetlist] = useState<string>('bloque-1')
  const [selectedForPrint, setSelectedForPrint] = useState<Set<string>>(new Set(['bloque-1', 'bloque-2', 'bloque-3', 'bloque-4', 'extras']))

  const dragSongId = useRef<string | null>(null)
  const [dragOverSetlist, setDragOverSetlist] = useState<string | null>(null)

  useEffect(() => { setMounted(true) }, [])

  const currentSetlist = setlists.find(s => s.id === activeSetlist)
  const currentSongs = currentSetlist ? currentSetlist.songIds.map(id => songsMap.get(id)).filter((s): s is Song => !!s) : []
  const usedSongIds = new Set(setlists.flatMap(s => s.songIds))
  const availableSongs = allSongs.filter(s => !usedSongIds.has(s.id)).sort((a, b) => a.title.localeCompare(b.title))

  const addSongToSetlist = (songId: string, setlistId: string) => {
    setSetlists(prev => prev.map(s =>
      s.id === setlistId ? { ...s, songIds: [...s.songIds, songId] } : s
    ))
  }

  const removeSongFromSetlist = (songId: string, setlistId: string) => {
    setSetlists(prev => prev.map(s =>
      s.id === setlistId ? { ...s, songIds: s.songIds.filter(id => id !== songId) } : s
    ))
  }

  const moveSongInSetlist = (setlistId: string, fromIdx: number, toIdx: number) => {
    setSetlists(prev => prev.map(s => {
      if (s.id !== setlistId) return s
      const newIds = [...s.songIds]
      const [moved] = newIds.splice(fromIdx, 1)
      newIds.splice(toIdx, 0, moved)
      return { ...s, songIds: newIds }
    }))
  }

  const togglePrintSetlist = (id: string) => {
    setSelectedForPrint(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const printSetlists = setlists.filter(s => selectedForPrint.has(s.id))
  const totalPrintSongs = printSetlists.reduce((sum, s) => sum + s.songIds.length, 0)

  if (!mounted) return null

  return (
    <>
      <title>Armar Setlist — RetroGroove</title>

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

        .toolbar {
          position: sticky; top: 0; z-index: 100;
          display: flex; align-items: center; justify-content: space-between;
          padding: 0.6rem 1.5rem;
          background: rgba(5,0,16,0.9);
          backdrop-filter: blur(16px);
          border-bottom: 1px solid rgba(255,255,255,0.06);
        }
        .toolbar a { color: rgba(255,255,255,0.5); text-decoration: none; font-size: 0.85rem; }
        .toolbar a:hover { color: var(--gold); }
        .toolbar-btns { display: flex; gap: 0.5rem; }
        .btn {
          padding: 0.5rem 1rem;
          background: linear-gradient(135deg, var(--pink), var(--purple));
          color: #fff; border: none; border-radius: 8px;
          font-family: 'Outfit', sans-serif; font-size: 0.9rem; font-weight: 600;
          cursor: pointer;
        }
        .btn:hover { opacity: 0.9; }
        .btn:disabled { opacity: 0.4; cursor: not-allowed; }

        .container {
          display: grid;
          grid-template-columns: 300px 1fr;
          gap: 1.5rem;
          padding: 1.5rem;
          max-width: 1400px;
          margin: 0 auto;
        }

        .sidebar {
          background: rgba(255,255,255,0.03);
          border: 1px solid rgba(255,255,255,0.06);
          border-radius: 12px;
          padding: 1rem;
          height: calc(100vh - 120px);
          overflow-y: auto;
        }

        .sidebar h3 {
          font-family: 'Bebas Neue', sans-serif;
          font-size: 1.2rem;
          letter-spacing: 0.05em;
          color: var(--gold);
          margin: 0 0 0.8rem;
        }

        .available-song {
          padding: 0.5rem 0.8rem;
          background: rgba(255,255,255,0.03);
          border: 1px solid rgba(255,255,255,0.06);
          border-radius: 6px;
          margin-bottom: 0.4rem;
          cursor: grab;
          font-size: 0.85rem;
        }
        .available-song:hover { background: rgba(255,255,255,0.08); }
        .available-song .title { color: #fff; font-weight: 500; }
        .available-song .artist { color: rgba(255,255,255,0.5); font-size: 0.75rem; }

        .main {
          display: flex;
          flex-direction: column;
          gap: 1rem;
        }

        .setlist-tabs {
          display: flex;
          gap: 0.5rem;
          flex-wrap: wrap;
        }

        .setlist-tab {
          padding: 0.6rem 1.2rem;
          background: rgba(255,255,255,0.05);
          border: 2px solid transparent;
          border-radius: 8px;
          cursor: pointer;
          font-family: 'Bebas Neue', sans-serif;
          font-size: 1rem;
          letter-spacing: 0.05em;
          color: rgba(255,255,255,0.6);
          transition: all 0.2s;
          display: flex;
          align-items: center;
          gap: 0.5rem;
        }
        .setlist-tab:hover { background: rgba(255,255,255,0.1); }
        .setlist-tab.active { border-color: currentColor; color: #fff; }
        .setlist-tab .count {
          background: rgba(255,255,255,0.2);
          padding: 0.1rem 0.5rem;
          border-radius: 10px;
          font-size: 0.8rem;
        }
        .setlist-tab .print-check {
          width: 16px; height: 16px;
          border: 2px solid currentColor;
          border-radius: 3px;
          display: flex; align-items: center; justify-content: center;
          font-size: 0.7rem;
        }
        .setlist-tab .print-check.checked { background: currentColor; color: #000; }

        .setlist-content {
          flex: 1;
          background: rgba(255,255,255,0.03);
          border: 1px solid rgba(255,255,255,0.06);
          border-radius: 12px;
          padding: 1rem;
          min-height: 400px;
        }
        .setlist-content.drag-over {
          border-color: var(--gold);
          background: rgba(255,215,0,0.05);
        }

        .setlist-song {
          display: flex;
          align-items: center;
          gap: 0.8rem;
          padding: 0.6rem 0.8rem;
          background: rgba(255,255,255,0.03);
          border: 1px solid rgba(255,255,255,0.06);
          border-radius: 6px;
          margin-bottom: 0.4rem;
          cursor: grab;
        }
        .setlist-song:hover { background: rgba(255,255,255,0.08); }
        .setlist-song.drag-over { border-color: var(--gold); }
        .setlist-song .num {
          width: 24px;
          color: rgba(255,255,255,0.4);
          font-size: 0.8rem;
          text-align: center;
        }
        .setlist-song .info { flex: 1; }
        .setlist-song .title { color: #fff; font-weight: 500; font-size: 0.95rem; }
        .setlist-song .artist { color: rgba(255,255,255,0.5); font-size: 0.8rem; }
        .setlist-song .remove {
          padding: 0.3rem 0.6rem;
          background: rgba(255,0,0,0.2);
          border: none;
          border-radius: 4px;
          color: #ff6b6b;
          font-size: 0.75rem;
          cursor: pointer;
        }
        .setlist-song .remove:hover { background: rgba(255,0,0,0.4); }

        .empty-state {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          height: 200px;
          color: rgba(255,255,255,0.4);
          font-size: 0.9rem;
        }

        /* Print Preview */
        .print-preview {
          display: none;
        }

        @media print {
          .page { background: #fff !important; }
          .toolbar, .sidebar, .setlist-tabs, .setlist-content, .container { display: none !important; }
          .print-preview {
            display: block !important;
            background: linear-gradient(180deg, #050010 0%, #0d0025 50%, #050010 100%) !important;
            color: #fff;
            padding: 8mm;
          }
          @page { size: A4; margin: 0; }
          * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }

          .print-setlist {
            margin-bottom: 0.8rem;
          }
          .print-setlist h2 {
            font-family: 'Bebas Neue', sans-serif;
            font-size: 1.3rem;
            letter-spacing: 0.1em;
            margin: 0 0 0.4rem;
            padding-bottom: 0.2rem;
            border-bottom: 2px solid currentColor;
          }
          .print-song {
            display: flex;
            justify-content: space-between;
            padding: 0.15rem 0;
            font-size: 0.85rem;
            line-height: 1.3;
          }
          .print-song .title { font-weight: 500; }
          .print-song .artist { color: rgba(255,255,255,0.6); font-size: 0.75rem; }

          .print-header {
            text-align: center;
            margin-bottom: 0.8rem;
          }
          .print-header h1 {
            font-family: 'Bebas Neue', sans-serif;
            font-size: 1.8rem;
            letter-spacing: 0.15em;
            margin: 0;
          }
          .print-grid {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 1rem;
            flex: 1;
          }
          .print-page {
            page-break-after: always;
            min-height: calc(297mm - 16mm);
            display: flex;
            flex-direction: column;
          }
          .print-page:last-child {
            page-break-after: avoid;
          }

          .qr-footer {
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 1rem;
            margin-top: auto;
            padding: 0.6rem;
            background: rgba(255,255,255,0.05);
            border-radius: 8px;
          }
          .qr-footer img {
            width: 55px;
            height: 55px;
            background: #fff;
            padding: 4px;
            border-radius: 4px;
          }
          .qr-footer-text { text-align: left; }
          .qr-footer-text h3 { margin: 0; font-size: 1rem; }
          .qr-footer-text p { margin: 0.2rem 0 0; font-size: 0.8rem; color: rgba(255,255,255,0.7); }
        }
      `}</style>

      <div className="page">
        <div className="toolbar">
          <a href="/band">← Volver al dashboard</a>
          <div className="toolbar-btns">
            <span style={{ color: 'rgba(255,255,255,0.5)', fontSize: '0.85rem', marginRight: '0.5rem' }}>
              {selectedForPrint.size} setlists, {totalPrintSongs} canciones
            </span>
            <button className="btn" onClick={() => window.print()} disabled={totalPrintSongs === 0}>
              Imprimir / PDF
            </button>
          </div>
        </div>

        <div className="container">
          <div className="sidebar">
            <h3>Canciones Disponibles ({availableSongs.length})</h3>
            {availableSongs.map(song => (
              <div
                key={song.id}
                className="available-song"
                draggable
                onDragStart={() => { dragSongId.current = song.id }}
                onDragEnd={() => { dragSongId.current = null; setDragOverSetlist(null) }}
                onClick={() => addSongToSetlist(song.id, activeSetlist)}
              >
                <div className="title">{song.title}</div>
                <div className="artist">{song.artist}</div>
              </div>
            ))}
          </div>

          <div className="main">
            <div className="setlist-tabs">
              {setlists.map(s => (
                <div
                  key={s.id}
                  className={`setlist-tab ${activeSetlist === s.id ? 'active' : ''}`}
                  style={{ color: getSetlistColor(s.id) }}
                  onClick={() => setActiveSetlist(s.id)}
                >
                  <span
                    className={`print-check ${selectedForPrint.has(s.id) ? 'checked' : ''}`}
                    onClick={(e) => { e.stopPropagation(); togglePrintSetlist(s.id) }}
                  >
                    {selectedForPrint.has(s.id) ? '✓' : ''}
                  </span>
                  {s.name}
                  <span className="count">{s.songIds.length}</span>
                </div>
              ))}
            </div>

            <div
              className={`setlist-content ${dragOverSetlist === activeSetlist ? 'drag-over' : ''}`}
              onDragOver={(e) => { e.preventDefault(); setDragOverSetlist(activeSetlist) }}
              onDragLeave={() => setDragOverSetlist(null)}
              onDrop={() => {
                if (dragSongId.current) {
                  addSongToSetlist(dragSongId.current, activeSetlist)
                  dragSongId.current = null
                }
                setDragOverSetlist(null)
              }}
            >
              {currentSongs.length === 0 ? (
                <div className="empty-state">
                  <p>Arrastra canciones aquí o haz click en ellas</p>
                </div>
              ) : (
                currentSongs.map((song, idx) => (
                  <div key={song.id} className="setlist-song">
                    <span className="num">{idx + 1}</span>
                    <div className="info">
                      <div className="title">{song.title}</div>
                      <div className="artist">{song.artist}</div>
                    </div>
                    <button className="remove" onClick={() => removeSongFromSetlist(song.id, activeSetlist)}>
                      Quitar
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Print Preview */}
        <div className="print-preview">
          {/* Page 1: Bloques 1-4 */}
          <div className="print-page">
            <div className="print-header">
              <h1>RETROGROOVE — REPERTORIO</h1>
            </div>
            <div className="print-grid">
              {printSetlists.filter(s => s.id !== 'extras').map(s => (
                <div key={s.id} className="print-setlist" style={{ color: getSetlistColor(s.id) }}>
                  <h2>{s.name}</h2>
                  {s.songIds.map(id => songsMap.get(id)).filter((song): song is Song => !!song).map(song => (
                    <div key={song.id} className="print-song">
                      <span className="title">{song.title}</span>
                      <span className="artist">{song.artist}</span>
                    </div>
                  ))}
                </div>
              ))}
            </div>
            <div className="qr-footer">
              <img src="/images/plin-qr.jpg" alt="QR" />
              <div className="qr-footer-text">
                <h3>¡Pide tu canción!</h3>
                <p>Escanea el QR y yapea para pedir tu favorita</p>
              </div>
            </div>
          </div>
          {/* Page 2: Extras */}
          {printSetlists.some(s => s.id === 'extras') && (
            <div className="print-page">
              <div className="print-header">
                <h1>RETROGROOVE — EXTRAS</h1>
              </div>
              <div className="print-grid">
                {(() => {
                  const extras = printSetlists.find(s => s.id === 'extras')
                  if (!extras) return null
                  const songs = extras.songIds.map(id => songsMap.get(id)).filter((song): song is Song => !!song)
                  const mid = Math.ceil(songs.length / 2)
                  return (
                    <>
                      <div className="print-setlist" style={{ color: getSetlistColor('extras') }}>
                        <h2>Extras (1-{mid})</h2>
                        {songs.slice(0, mid).map(song => (
                          <div key={song.id} className="print-song">
                            <span className="title">{song.title}</span>
                            <span className="artist">{song.artist}</span>
                          </div>
                        ))}
                      </div>
                      <div className="print-setlist" style={{ color: getSetlistColor('extras') }}>
                        <h2>Extras ({mid + 1}-{songs.length})</h2>
                        {songs.slice(mid).map(song => (
                          <div key={song.id} className="print-song">
                            <span className="title">{song.title}</span>
                            <span className="artist">{song.artist}</span>
                          </div>
                        ))}
                      </div>
                    </>
                  )
                })()}
              </div>
              <div className="qr-footer">
                <img src="/images/plin-qr.jpg" alt="QR" />
                <div className="qr-footer-text">
                  <h3>¡Pide tu canción!</h3>
                  <p>Escanea el QR y yapea para pedir tu favorita</p>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  )
}
