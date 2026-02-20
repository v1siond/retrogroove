'use client'

import { useState, useCallback, useRef, useEffect, useMemo } from 'react'
import { ALL_SONGS } from '@/data/setlist'

function sr(seed: number) {
  const x = Math.sin(seed + 1) * 10000
  return x - Math.floor(x)
}

const STARS = Array.from({ length: 35 }, (_, i) => ({
  left: sr(i * 3 + 300) * 100,
  top: sr(i * 3 + 301) * 100,
  delay: sr(i * 3 + 302) * 4,
  size: sr(i * 7 + 300) * 2.5 + 0.8,
}))

const alphabetical = [...ALL_SONGS].sort((a, b) => a.title.localeCompare(b.title))
const songKey = (s: typeof ALL_SONGS[0]) => `${s.title}---${s.artist}`

export default function SetlistPrint() {
  const [mounted, setMounted] = useState(false)
  const [songs, setSongs] = useState(alphabetical)
  const [isCustomOrder, setIsCustomOrder] = useState(false)
  const [selected, setSelected] = useState<Set<string>>(
    () => new Set(alphabetical.map(songKey))
  )
  const dragIdx = useRef<number | null>(null)
  const [overIdx, setOverIdx] = useState<number | null>(null)

  useEffect(() => { setMounted(true) }, [])

  const selectedCount = selected.size
  const allSelected = selectedCount === songs.length

  const mid = Math.ceil(songs.length / 2)
  const colLeft = songs.slice(0, mid)
  const colRight = songs.slice(mid)

  const flatIdx = (col: 'left' | 'right', i: number) =>
    col === 'left' ? i : mid + i

  const toggleSong = useCallback((key: string) => {
    setSelected(prev => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }, [])

  const selectAll = () => setSelected(new Set(songs.map(songKey)))
  const deselectAll = () => setSelected(new Set())

  const onDragStart = useCallback((idx: number) => {
    dragIdx.current = idx
  }, [])

  const onDragOver = useCallback((e: React.DragEvent, idx: number) => {
    e.preventDefault()
    setOverIdx(idx)
  }, [])

  const onDrop = useCallback((toIdx: number) => {
    const fromIdx = dragIdx.current
    if (fromIdx === null || fromIdx === toIdx) {
      dragIdx.current = null
      setOverIdx(null)
      return
    }
    setSongs(prev => {
      const next = [...prev]
      const [moved] = next.splice(fromIdx, 1)
      next.splice(toIdx, 0, moved)
      return next
    })
    setIsCustomOrder(true)
    dragIdx.current = null
    setOverIdx(null)
  }, [])

  const onDragEnd = useCallback(() => {
    dragIdx.current = null
    setOverIdx(null)
  }, [])

  const resetAll = () => {
    setSongs(alphabetical)
    setIsCustomOrder(false)
    setSelected(new Set(alphabetical.map(songKey)))
  }

  const renderSong = (song: typeof songs[0], i: number, col: 'left' | 'right') => {
    const idx = flatIdx(col, i)
    const key = songKey(song)
    const isSelected = selected.has(key)
    return (
      <div
        key={`${idx}-${song.title}`}
        className={`p-song ${overIdx === idx ? 'drag-over' : ''} ${!isSelected ? 'deselected' : ''}`}
        draggable
        onDragStart={() => onDragStart(idx)}
        onDragOver={(e) => onDragOver(e, idx)}
        onDrop={() => onDrop(idx)}
        onDragEnd={onDragEnd}
      >
        <button
          className={`p-check ${isSelected ? 'checked' : ''}`}
          onClick={(e) => { e.stopPropagation(); toggleSong(key) }}
          aria-label={isSelected ? 'Deseleccionar' : 'Seleccionar'}
        />
        <span className="p-handle" title="Arrastrá para mover">⋮⋮</span>
        <span className="p-title">{song.title}</span>
        <span className="p-artist">{song.artist}</span>
      </div>
    )
  }

  return (
    <>
      <title>Repertorio Imprimible — RetroGroove</title>

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700&family=Bebas+Neue&display=swap');

        .print-page {
          --pink: #ff1493;
          --gold: #ffd700;
          --cyan: #00e5ff;
          --purple: #bf00ff;
          min-height: 100vh;
          background: linear-gradient(180deg, #050010 0%, #0d0025 40%, #100020 70%, #050010 100%);
          color: #e8e8e8;
          font-family: 'Outfit', sans-serif;
          position: relative;
          overflow-x: hidden;
        }

        .star {
          position: fixed; border-radius: 50%; background: #fff;
          pointer-events: none; animation: twinkle 3s ease-in-out infinite; z-index: 0;
        }
        @keyframes twinkle {
          0%, 100% { opacity: 0.08; transform: scale(0.8); }
          50% { opacity: 0.6; transform: scale(1.1); }
        }

        /* ── Toolbar ── */
        .toolbar {
          position: sticky; top: 0; z-index: 100;
          display: flex; align-items: center; justify-content: space-between;
          padding: 0.6rem 1.5rem;
          background: rgba(5,0,16,0.85);
          backdrop-filter: blur(16px); -webkit-backdrop-filter: blur(16px);
          border-bottom: 1px solid rgba(255,255,255,0.06);
        }
        .toolbar-left { display: flex; align-items: center; gap: 1rem; }
        .toolbar a {
          color: rgba(255,255,255,0.5); text-decoration: none;
          font-size: 0.75rem; letter-spacing: 0.05em; transition: color 0.2s;
        }
        .toolbar a:hover { color: var(--gold); }
        .toolbar-btns { display: flex; align-items: center; gap: 0.5rem; flex-wrap: wrap; justify-content: flex-end; }
        .tb-btn {
          padding: 0.35rem 0.8rem;
          background: rgba(255,255,255,0.06);
          border: 1px solid rgba(255,255,255,0.12);
          color: rgba(255,255,255,0.5); border-radius: 6px;
          font-family: 'Outfit', sans-serif; font-size: 0.65rem;
          font-weight: 500; cursor: pointer; transition: all 0.2s;
          white-space: nowrap;
        }
        .tb-btn:hover { color: #fff; border-color: rgba(255,255,255,0.3); }
        .export-btn {
          display: inline-flex; align-items: center; gap: 0.5rem;
          padding: 0.45rem 1.2rem;
          background: linear-gradient(135deg, var(--pink), var(--purple));
          color: #fff; border: none; border-radius: 8px;
          font-family: 'Outfit', sans-serif; font-size: 0.75rem;
          font-weight: 600; letter-spacing: 0.05em;
          cursor: pointer; transition: opacity 0.2s, transform 0.2s;
          box-shadow: 0 0 20px rgba(255,20,147,0.2);
        }
        .export-btn:hover { opacity: 0.9; transform: translateY(-1px); }

        /* ── Content ── */
        .print-content {
          max-width: 920px; margin: 0 auto;
          padding: 1.5rem 2rem 1rem;
          position: relative; z-index: 10;
        }

        /* ── Header ── */
        .print-header {
          text-align: center; margin-bottom: 1.2rem;
          padding-bottom: 0.8rem; position: relative;
        }
        .print-header::after {
          content: ''; position: absolute; bottom: 0; left: 50%;
          transform: translateX(-50%); width: 200px; height: 2px;
          background: linear-gradient(90deg, var(--pink), var(--gold), var(--cyan), var(--purple));
          border-radius: 1px;
        }
        .print-header h1 {
          font-family: 'Bebas Neue', sans-serif;
          font-size: 3rem; letter-spacing: 0.15em;
          color: #fff; margin: 0; line-height: 1;
          text-shadow: 0 0 10px rgba(255,20,147,0.4), 0 0 30px rgba(255,20,147,0.2);
        }
        .print-header .sub {
          font-weight: 300; font-size: 0.75rem; letter-spacing: 0.35em;
          text-transform: uppercase; color: rgba(255,255,255,0.55); margin: 0.3rem 0 0;
        }
        .print-header .count {
          font-weight: 300; font-size: 0.7rem;
          color: rgba(255,255,255,0.4); margin: 0.3rem 0 0; letter-spacing: 0.05em;
        }
        .print-header .count strong { color: var(--gold); font-weight: 600; }
        .drag-hint {
          font-size: 0.6rem; color: rgba(255,255,255,0.25);
          margin-top: 0.3rem; letter-spacing: 0.03em;
        }

        /* ── Song Grid Card ── */
        .songs-card {
          background: rgba(255,255,255,0.025);
          backdrop-filter: blur(8px); -webkit-backdrop-filter: blur(8px);
          border: 1px solid rgba(255,255,255,0.06);
          border-radius: 14px; padding: 1rem 1.2rem;
          margin-bottom: 1.2rem; position: relative; overflow: hidden;
        }
        .songs-card::before {
          content: ''; position: absolute; top: 0; left: 0; right: 0; height: 1.5px;
          background: linear-gradient(90deg, var(--pink), var(--gold), var(--cyan), var(--purple));
        }

        .songs-grid {
          display: grid; grid-template-columns: 1fr 1fr;
          gap: 0 2rem;
        }

        .p-song {
          display: grid; grid-template-columns: auto auto 1fr auto;
          gap: 0.3rem; align-items: center;
          padding: 0.15rem 0.4rem; font-size: 0.76rem; line-height: 1.4;
          border-radius: 4px; transition: background 0.15s, border-color 0.15s, opacity 0.2s;
          cursor: grab; border: 1px solid transparent;
          user-select: none;
        }
        .p-song:hover { background: rgba(255,255,255,0.04); }
        .p-song:active { cursor: grabbing; }
        .p-song.drag-over {
          border-color: var(--gold);
          background: rgba(255,215,0,0.06);
        }
        .p-song.deselected {
          opacity: 0.3;
        }
        .p-song.deselected .p-title {
          text-decoration: line-through;
          text-decoration-color: rgba(255,255,255,0.3);
        }

        /* ── Checkbox ── */
        .p-check {
          width: 15px; height: 15px; min-width: 15px; border-radius: 3px;
          border: 1.5px solid rgba(255,255,255,0.2);
          background: transparent; cursor: pointer;
          display: flex; align-items: center; justify-content: center;
          transition: all 0.15s; padding: 0;
          color: transparent; font-size: 0.55rem; font-weight: 700;
        }
        .p-check:hover { border-color: rgba(255,255,255,0.4); }
        .p-check.checked {
          background: var(--gold); border-color: var(--gold);
          color: #000;
        }
        .p-check.checked::after { content: '✓'; }

        .p-handle {
          font-size: 0.65rem; color: rgba(255,255,255,0.15);
          letter-spacing: -0.1em; cursor: grab; user-select: none;
          transition: color 0.2s;
        }
        .p-song:hover .p-handle { color: rgba(255,255,255,0.4); }
        .p-title { font-weight: 500; color: #eee; }
        .p-artist {
          font-weight: 400; color: #c4a24e;
          font-size: 0.72rem; text-align: right;
        }
        .p-song:hover .p-artist { color: #ffd700; }

        .songs-grid > div:first-child {
          border-right: 1px solid rgba(255,255,255,0.04);
          padding-right: 1rem;
        }
        .songs-grid > div:last-child {
          padding-left: 1rem;
        }

        /* ── QR Footer ── */
        .qr-footer {
          display: flex; flex-direction: column; align-items: center; text-align: center; gap: 0.8rem;
          padding: 1.2rem 1.4rem;
          background: rgba(255,255,255,0.03);
          border: 1px solid rgba(255,255,255,0.08);
          border-radius: 14px; margin-bottom: 1rem;
          position: relative; overflow: hidden;
        }
        .qr-footer::before {
          content: ''; position: absolute; inset: 0; border-radius: 14px; padding: 1px;
          background: linear-gradient(135deg, var(--pink), var(--gold), var(--cyan), var(--purple));
          -webkit-mask: linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0);
          -webkit-mask-composite: xor; mask-composite: exclude; pointer-events: none;
        }
        .qr-footer-frame {
          width: 80px; height: 80px; min-width: 80px;
          background: #fff; border-radius: 8px;
          display: flex; align-items: center; justify-content: center;
          overflow: hidden;
          box-shadow: 0 0 15px rgba(255,20,147,0.15), 0 0 30px rgba(191,0,255,0.08);
        }
        .qr-footer-frame img { width: 100%; height: 100%; object-fit: contain; }
        .qr-placeholder {
          display: flex; flex-direction: column; align-items: center;
          gap: 0.2rem; color: #aaa;
        }
        .qr-placeholder svg { opacity: 0.35; }
        .qr-placeholder span {
          font-size: 0.5rem; font-weight: 600;
          letter-spacing: 0.12em; text-transform: uppercase; color: #999;
        }
        .qr-footer-text h3 {
          font-family: 'Bebas Neue', sans-serif; font-size: 1.2rem;
          letter-spacing: 0.05em; color: #fff; margin: 0 0 0.15rem;
          text-shadow: 0 0 12px rgba(255,20,147,0.3);
        }
        .qr-footer-text p {
          font-weight: 300; font-size: 0.72rem;
          color: rgba(255,255,255,0.4); margin: 0; line-height: 1.5;
        }
        .qr-footer-text strong { color: var(--gold); font-weight: 600; }

        .bottom-footer {
          text-align: center; padding: 1rem;
          color: rgba(255,255,255,0.12); font-size: 0.65rem;
          letter-spacing: 0.15em; text-transform: uppercase;
          position: relative; z-index: 10;
        }

        /* ── Print Overrides ── */
        @media print {
          @page { size: A4; margin: 8mm 10mm; }
          * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
          .toolbar { display: none !important; }
          .star { display: none !important; }
          .drag-hint { display: none !important; }
          .p-handle { display: none !important; }
          .p-check { display: none !important; }
          .p-song.deselected { display: none !important; }
          .print-page {
            background: linear-gradient(180deg, #050010 0%, #0d0025 50%, #050010 100%) !important;
            min-height: auto;
          }
          .print-content { padding: 0.5rem 0 0; max-width: 100%; }
          .print-header { margin-bottom: 0.8rem; padding-bottom: 0.5rem; }
          .print-header h1 { font-size: 2.2rem; }
          .songs-card { padding: 0.6rem 0.8rem; margin-bottom: 0.8rem; backdrop-filter: none; }
          .songs-grid { gap: 0 1.5rem; }
          .songs-grid > div:first-child { padding-right: 0.7rem; }
          .songs-grid > div:last-child { padding-left: 0.7rem; }
          .p-song {
            font-size: 0.68rem; padding: 0.1rem 0.2rem;
            cursor: default; border: none !important;
            grid-template-columns: 1fr auto;
          }
          .p-song:hover { background: none; }
          .p-artist { font-size: 0.6rem; }
          .qr-footer {
            padding: 0.8rem 1.2rem; backdrop-filter: none;
            flex-direction: column; align-items: center; text-align: center; gap: 0.6rem;
            background: rgba(255,255,255,0.06) !important;
            border: 1px solid rgba(255,255,255,0.2) !important;
          }
          .qr-footer::before { display: none !important; }
          .qr-footer-frame { width: 70px; height: 70px; min-width: 70px; box-shadow: none !important; }
          .qr-footer-text h3 { font-size: 1rem; text-shadow: none !important; }
          .qr-footer-text p { font-size: 0.65rem; color: rgba(255,255,255,0.6) !important; }
          .qr-footer-text strong { color: #ffd700 !important; }
          .bottom-footer { display: none; }
        }

        @media (max-width: 640px) {
          .songs-grid { grid-template-columns: 1fr; }
          .songs-grid > div:first-child { border-right: none; padding-right: 0; }
          .songs-grid > div:last-child { padding-left: 0; }
          .qr-footer { text-align: center; }
          .toolbar-left { flex-direction: column; align-items: flex-start; gap: 0.3rem; }
        }
      `}</style>

      <div className="print-page">
        {mounted && STARS.map((s, i) => (
          <div key={`s-${i}`} className="star" style={{ left: `${s.left}%`, top: `${s.top}%`, width: s.size, height: s.size, animationDelay: `${s.delay}s` }} />
        ))}

        <div className="toolbar">
          <div className="toolbar-left">
            <a href="/setlist">&#8592; Volver al repertorio</a>
          </div>
          <div className="toolbar-btns">
            {!allSelected && (
              <button className="tb-btn" onClick={selectAll}>
                Seleccionar todo
              </button>
            )}
            {selectedCount > 0 && (
              <button className="tb-btn" onClick={deselectAll}>
                Deseleccionar todo
              </button>
            )}
            {(isCustomOrder || !allSelected) && (
              <button className="tb-btn" onClick={resetAll}>
                Resetear
              </button>
            )}
            <button className="export-btn" onClick={() => window.print()}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <polyline points="7 10 12 15 17 10" />
                <line x1="12" y1="15" x2="12" y2="3" />
              </svg>
              Exportar PDF
            </button>
          </div>
        </div>

        <div className="print-content">
          <header className="print-header">
            <h1>REPERTORIO</h1>
            <p className="sub">Disco &bull; Rock &bull; En Vivo</p>
            <p className="count">
              <strong>{selectedCount}</strong> de {songs.length} temas
              {isCustomOrder ? ' — orden personalizado' : ' — ordenados por canción'}
            </p>
            <p className="drag-hint">Hacé click para seleccionar/deseleccionar &middot; Arrastrá para reordenar</p>
          </header>

          <div className="songs-card">
            <div className="songs-grid">
              <div>
                {colLeft.map((song, i) => renderSong(song, i, 'left'))}
              </div>
              <div>
                {colRight.map((song, i) => renderSong(song, i, 'right'))}
              </div>
            </div>
          </div>

          <div className="qr-footer">
            <div className="qr-footer-frame">
              <div className="qr-placeholder">
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <rect x="3" y="3" width="7" height="7" rx="1" />
                  <rect x="14" y="3" width="7" height="7" rx="1" />
                  <rect x="3" y="14" width="7" height="7" rx="1" />
                  <rect x="14" y="14" width="3" height="3" />
                  <rect x="18" y="14" width="3" height="3" />
                  <rect x="14" y="18" width="3" height="3" />
                  <rect x="18" y="18" width="3" height="3" />
                </svg>
                <span>QR</span>
              </div>
            </div>
            <div className="qr-footer-text">
              <h3>¡Pídenos tu canción favorita!</h3>
              <p>Escaneá el código y apoyá a la banda</p>
              <p>Con tu aporte nos ayudas a seguir tocando.<br /><strong>¡Gracias por el apoyo!</strong></p>
            </div>
          </div>
        </div>

        <div className="bottom-footer">Que no pare la música</div>
      </div>
    </>
  )
}
