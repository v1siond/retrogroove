'use client'

import { useEffect, useState, useMemo } from 'react'
import { ALL_SONGS, type Song } from '@/data/setlist'

type SortMode = 'song' | 'artist'

const ACCENT_COLORS = ['#ff69b4', '#ffd700', '#67f0ff', '#d4a0ff']

function seededRandom(seed: number) {
  const x = Math.sin(seed + 1) * 10000
  return x - Math.floor(x)
}

const STARS = Array.from({ length: 50 }, (_, i) => ({
  left: seededRandom(i * 3) * 100,
  top: seededRandom(i * 3 + 1) * 100,
  delay: seededRandom(i * 3 + 2) * 4,
  size: seededRandom(i * 7) * 3 + 1,
}))

const REFLECTIONS = Array.from({ length: 14 }, (_, i) => ({
  left: seededRandom(i * 5 + 100) * 100,
  top: seededRandom(i * 5 + 101) * 100,
  delay: seededRandom(i * 5 + 102) * 6,
  duration: seededRandom(i * 5 + 103) * 4 + 3,
  color: ACCENT_COLORS[Math.floor(seededRandom(i * 5 + 104) * 4)],
  size: seededRandom(i * 5 + 105) * 6 + 3,
}))

function groupByArtist(songs: Song[]) {
  const map = new Map<string, Song[]>()
  for (const s of songs) {
    const existing = map.get(s.artist)
    if (existing) existing.push(s)
    else map.set(s.artist, [s])
  }
  return [...map.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([artist, tracks]) => ({
      artist,
      tracks: tracks.sort((a, b) => a.title.localeCompare(b.title)),
    }))
}

export default function Setlist() {
  const [sort, setSort] = useState<SortMode>('song')

  const sortedSongs = useMemo(
    () => [...ALL_SONGS].sort((a, b) => a.title.localeCompare(b.title)),
    [],
  )

  const mid = Math.ceil(sortedSongs.length / 2)
  const colLeft = sortedSongs.slice(0, mid)
  const colRight = sortedSongs.slice(mid)

  const artistGroups = useMemo(() => groupByArtist(ALL_SONGS), [])

  useEffect(() => {
    document.body.style.overflow = 'auto'
    document.body.style.background = '#050010'
    return () => { document.body.style.background = '' }
  }, [])

  return (
    <>
      <title>Repertorio — RetroGroove</title>

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;600;700;800;900&family=Bebas+Neue&display=swap');

        .setlist-page {
          --pink: #ff1493;
          --gold: #ffd700;
          --cyan: #00e5ff;
          --purple: #bf00ff;
          min-height: 100vh;
          background: linear-gradient(180deg, #050010 0%, #0d0025 30%, #100020 60%, #050010 100%);
          color: #fff;
          font-family: 'Outfit', sans-serif;
          overflow-x: hidden;
          position: relative;
        }

        .star {
          position: fixed; border-radius: 50%; background: #fff;
          pointer-events: none; animation: twinkle 3s ease-in-out infinite; z-index: 0;
        }
        @keyframes twinkle {
          0%, 100% { opacity: 0.1; transform: scale(0.8); }
          50% { opacity: 0.9; transform: scale(1.2); }
        }
        .reflection {
          position: fixed; border-radius: 1px; pointer-events: none; opacity: 0;
          animation: reflect-flash ease-in-out infinite; z-index: 1; filter: blur(0.5px);
        }
        @keyframes reflect-flash {
          0%, 100% { opacity: 0; transform: scale(0.5) rotate(0deg); }
          50% { opacity: 0.9; transform: scale(1.2) rotate(90deg); }
        }

        /* ── Compact Hero ── */
        .hero {
          position: relative; z-index: 10;
          display: flex; flex-direction: column; align-items: center;
          text-align: center;
          padding: 1.5rem 1rem 1rem;
        }
        .light-rays {
          position: absolute; top: -200px; left: 50%;
          width: 800px; height: 800px; transform: translateX(-50%);
          background: conic-gradient(
            from 0deg,
            transparent, rgba(255,20,147,0.05) 5deg, transparent 10deg,
            transparent 15deg, rgba(0,229,255,0.05) 20deg, transparent 25deg,
            transparent 30deg, rgba(255,215,0,0.05) 35deg, transparent 40deg,
            transparent 45deg, rgba(191,0,255,0.05) 50deg, transparent 55deg,
            transparent 60deg, rgba(255,20,147,0.05) 65deg, transparent 70deg,
            transparent 75deg, rgba(0,229,255,0.05) 80deg, transparent 85deg,
            transparent 90deg, rgba(255,215,0,0.05) 95deg, transparent 100deg,
            transparent 105deg, rgba(191,0,255,0.05) 110deg, transparent 115deg,
            transparent 120deg, rgba(255,20,147,0.05) 125deg, transparent 130deg,
            transparent 135deg, rgba(0,229,255,0.05) 140deg, transparent 145deg,
            transparent 150deg, rgba(255,215,0,0.05) 155deg, transparent 160deg,
            transparent 165deg, rgba(191,0,255,0.05) 170deg, transparent 175deg,
            transparent 180deg, rgba(255,20,147,0.05) 185deg, transparent 190deg,
            transparent 195deg, rgba(0,229,255,0.05) 200deg, transparent 205deg,
            transparent 210deg, rgba(255,215,0,0.05) 215deg, transparent 220deg,
            transparent 225deg, rgba(191,0,255,0.05) 230deg, transparent 235deg,
            transparent 240deg, rgba(255,20,147,0.05) 245deg, transparent 250deg,
            transparent 255deg, rgba(0,229,255,0.05) 260deg, transparent 265deg,
            transparent 270deg, rgba(255,215,0,0.05) 275deg, transparent 280deg,
            transparent 285deg, rgba(191,0,255,0.05) 290deg, transparent 295deg,
            transparent 300deg, rgba(255,20,147,0.05) 305deg, transparent 310deg,
            transparent 315deg, rgba(0,229,255,0.05) 320deg, transparent 325deg,
            transparent 330deg, rgba(255,215,0,0.05) 335deg, transparent 340deg,
            transparent 345deg, rgba(191,0,255,0.05) 350deg, transparent 360deg
          );
          border-radius: 50%; animation: rays-spin 25s linear infinite;
          pointer-events: none; z-index: 0;
        }
        @keyframes rays-spin { to { transform: translateX(-50%) rotate(360deg); } }

        .disco-mini {
          display: flex; flex-direction: column; align-items: center;
        }
        .disco-string { width: 1.5px; height: 30px; background: linear-gradient(to bottom, transparent, rgba(200,200,200,0.5)); }
        .disco-ball {
          width: 70px; height: 70px; border-radius: 50%;
          background: radial-gradient(circle at 30% 25%, #fff 0%, #e0e0e0 8%, #b0b0b0 25%, #707070 50%, #404040 80%, #222 100%);
          position: relative;
          box-shadow: 0 0 20px rgba(255,255,255,0.4), 0 0 40px rgba(255,0,255,0.2), 0 0 60px rgba(0,229,255,0.1);
          animation: ball-spin 12s linear infinite;
        }
        .disco-ball::before {
          content: ''; position: absolute; inset: 2px; border-radius: 50%;
          background:
            repeating-linear-gradient(0deg, transparent, transparent 6px, rgba(255,255,255,0.12) 6px, rgba(255,255,255,0.12) 7px),
            repeating-linear-gradient(90deg, transparent, transparent 6px, rgba(255,255,255,0.12) 6px, rgba(255,255,255,0.12) 7px);
          mask-image: radial-gradient(circle, #000 60%, transparent 100%);
          -webkit-mask-image: radial-gradient(circle, #000 60%, transparent 100%);
        }
        .disco-ball::after {
          content: ''; position: absolute;
          top: 8%; left: 22%; width: 25%; height: 18%; border-radius: 50%;
          background: radial-gradient(ellipse, rgba(255,255,255,0.6) 0%, transparent 70%);
          filter: blur(2px);
        }
        @keyframes ball-spin { from { transform: rotateY(0deg); } to { transform: rotateY(360deg); } }

        .neon-title {
          font-family: 'Bebas Neue', sans-serif;
          font-size: clamp(2.2rem, 8vw, 4.5rem);
          letter-spacing: 0.12em;
          color: #fff;
          text-shadow: 0 0 7px #fff, 0 0 15px #fff, 0 0 30px var(--pink), 0 0 60px var(--pink);
          animation: neon-pulse 3s ease-in-out infinite alternate;
          margin: 0.5rem 0 0; line-height: 1;
        }
        @keyframes neon-pulse {
          from { text-shadow: 0 0 7px #fff, 0 0 15px #fff, 0 0 30px var(--pink), 0 0 60px var(--pink); }
          to { text-shadow: 0 0 5px #fff, 0 0 10px #fff, 0 0 20px var(--pink), 0 0 40px var(--pink), 0 0 80px var(--pink); }
        }
        .subtitle {
          font-weight: 300; font-size: 0.7rem; letter-spacing: 0.4em;
          text-transform: uppercase; color: rgba(255,255,255,0.65); margin-top: 0.2rem;
        }

        .hero-row {
          display: flex; align-items: center; gap: 1rem;
          margin-top: 0.8rem; flex-wrap: wrap; justify-content: center;
        }
        .eq-bars { display: flex; align-items: flex-end; gap: 2px; height: 16px; }
        .eq-bar { width: 3px; border-radius: 2px; animation: eq-bounce ease-in-out infinite; }
        @keyframes eq-bounce { 0%, 100% { height: 3px; } 50% { height: 14px; } }

        .nav-link {
          padding: 0.35rem 1.1rem; font-size: 0.65rem; font-weight: 400;
          letter-spacing: 0.12em; text-transform: uppercase;
          color: rgba(255,255,255,0.35); border: 1px solid rgba(255,255,255,0.1);
          border-radius: 20px; text-decoration: none; transition: all 0.3s;
        }
        .nav-link:hover { color: var(--gold); border-color: var(--gold); box-shadow: 0 0 12px rgba(255,215,0,0.15); }

        /* ── Content ── */
        .content { position: relative; z-index: 10; max-width: 960px; margin: 0 auto; padding: 0 1rem 1.5rem; }

        /* ── Sort Toggle ── */
        .sort-toggle {
          display: inline-flex; background: rgba(255,255,255,0.04);
          border: 1px solid rgba(255,255,255,0.08); border-radius: 24px; padding: 3px;
        }
        .sort-btn {
          padding: 0.4rem 1.1rem; font-family: 'Outfit', sans-serif;
          font-size: 0.72rem; font-weight: 500; letter-spacing: 0.06em;
          border: none; border-radius: 20px; background: transparent;
          color: rgba(255,255,255,0.35); cursor: pointer; transition: all 0.3s;
        }
        .sort-btn.active { background: rgba(255,255,255,0.08); color: var(--gold); text-shadow: 0 0 12px rgba(255,215,0,0.3); }
        .sort-btn:hover:not(.active) { color: rgba(255,255,255,0.6); }

        .song-count {
          font-weight: 300; font-size: 0.75rem; color: rgba(255,255,255,0.5);
          letter-spacing: 0.05em;
        }
        .toolbar-row {
          display: flex; align-items: center; justify-content: space-between;
          margin-bottom: 1rem; flex-wrap: wrap; gap: 0.5rem;
        }

        /* ── Song Card ── */
        .song-card {
          background: rgba(255,255,255,0.03); backdrop-filter: blur(10px);
          -webkit-backdrop-filter: blur(10px);
          border: 1px solid rgba(255,255,255,0.08); border-radius: 16px;
          padding: 1.2rem 1.5rem; position: relative; overflow: hidden;
        }
        .song-card::before {
          content: ''; position: absolute; top: 0; left: 0; right: 0; height: 2px;
          background: linear-gradient(90deg, var(--pink), var(--gold), var(--cyan), var(--purple));
        }

        /* ── Two-Column Song Grid ── */
        .songs-2col {
          display: grid; grid-template-columns: 1fr 1fr;
          gap: 0 1.5rem;
        }

        .song-row {
          display: grid; grid-template-columns: 1fr auto;
          gap: 0.3rem 0.6rem; align-items: baseline;
          padding: 0.3rem 0.5rem; border-radius: 6px;
          transition: background 0.2s; cursor: default;
        }
        .song-row:hover { background: rgba(255,255,255,0.05); }
        .song-title { font-weight: 600; font-size: 0.82rem; color: #fff; }
        .song-artist {
          font-weight: 400; font-size: 0.78rem; color: #c4a24e;
          white-space: nowrap; text-align: right;
        }
        .song-row:hover .song-artist { color: var(--gold); opacity: 1; }

        /* ── Artist Groups (single column) ── */
        .artists-wrap { display: grid; grid-template-columns: 1fr 1fr; gap: 0 1.5rem; }
        .artist-group { margin-bottom: 0.6rem; }
        .artist-name {
          font-family: 'Bebas Neue', sans-serif; font-size: 1rem;
          letter-spacing: 0.06em; color: var(--accent);
          padding: 0.2rem 0.5rem; display: flex; align-items: center; gap: 0.5rem;
        }
        .artist-name::after {
          content: ''; flex: 1; height: 1px;
          background: linear-gradient(to right, var(--accent), transparent); opacity: 0.2;
        }
        .artist-track {
          padding: 0.2rem 0.5rem 0.2rem 1.2rem;
          font-weight: 500; font-size: 0.8rem; color: rgba(255,255,255,0.75);
          border-radius: 6px; transition: background 0.2s; cursor: default;
        }
        .artist-track:hover { background: rgba(255,255,255,0.04); }

        /* ── QR Footer (compact horizontal) ── */
        .qr-footer {
          display: flex; flex-direction: column; align-items: center; text-align: center; gap: 0.8rem;
          margin-top: 1.5rem; padding: 1.5rem 1.4rem;
          background: rgba(255,255,255,0.03);
          border: 1px solid rgba(255,255,255,0.08);
          border-radius: 14px; position: relative; overflow: hidden;
        }
        .qr-footer::before {
          content: ''; position: absolute; inset: 0; border-radius: 14px; padding: 1px;
          background: linear-gradient(135deg, var(--pink), var(--gold), var(--cyan), var(--purple));
          -webkit-mask: linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0);
          -webkit-mask-composite: xor; mask-composite: exclude; pointer-events: none;
        }
        .qr-frame {
          width: 80px; height: 80px; min-width: 80px;
          background: #fff; border-radius: 10px;
          display: flex; align-items: center; justify-content: center;
          box-shadow: 0 0 15px rgba(255,20,147,0.15); overflow: hidden;
        }
        .qr-frame img { width: 100%; height: 100%; object-fit: contain; }
        .qr-ph { display: flex; flex-direction: column; align-items: center; gap: 0.2rem; color: #bbb; }
        .qr-ph svg { opacity: 0.35; }
        .qr-ph span { font-size: 0.5rem; font-weight: 600; letter-spacing: 0.12em; text-transform: uppercase; color: #aaa; }
        .qr-text h3 {
          font-family: 'Bebas Neue', sans-serif; font-size: 1.15rem;
          letter-spacing: 0.04em; color: #fff; margin: 0 0 0.15rem;
          text-shadow: 0 0 15px rgba(255,20,147,0.3);
        }
        .qr-text p { font-weight: 300; font-size: 0.78rem; color: rgba(255,255,255,0.5); margin: 0; line-height: 1.6; }
        .qr-text strong { color: var(--gold); font-weight: 600; }

        /* ── Footer ── */
        .page-footer {
          text-align: center; padding: 1.5rem 1rem;
          color: rgba(255,255,255,0.15); font-size: 0.7rem;
          letter-spacing: 0.15em; text-transform: uppercase;
          position: relative; z-index: 10;
        }
        .footer-line {
          width: 50px; height: 1px; margin: 0.6rem auto;
          background: linear-gradient(90deg, transparent, rgba(255,255,255,0.15), transparent);
        }

        @media (max-width: 700px) {
          .songs-2col { grid-template-columns: 1fr; }
          .artists-wrap { grid-template-columns: 1fr; }
          .qr-footer { text-align: center; }
          .song-card { padding: 1rem; }
        }
      `}</style>

      <div className="setlist-page">
        {STARS.map((s, i) => (
          <div key={`s-${i}`} className="star" style={{ left: `${s.left}%`, top: `${s.top}%`, width: s.size, height: s.size, animationDelay: `${s.delay}s` }} />
        ))}
        {REFLECTIONS.map((r, i) => (
          <div key={`r-${i}`} className="reflection" style={{ left: `${r.left}%`, top: `${r.top}%`, width: r.size, height: r.size, background: r.color, animationDelay: `${r.delay}s`, animationDuration: `${r.duration}s` }} />
        ))}

        <header className="hero">
          <div className="light-rays" />
          <div className="disco-mini">
            <div className="disco-string" />
            <div className="disco-ball" />
          </div>
          <h1 className="neon-title">REPERTORIO</h1>
          <p className="subtitle">Disco &bull; Rock &bull; En Vivo</p>
          <div className="hero-row">
            <div className="eq-bars">
              {Array.from({ length: 7 }).map((_, i) => (
                <div key={i} className="eq-bar" style={{ background: 'linear-gradient(to top, #ff1493, #ffd700)', animationDelay: `${i * 0.12}s`, animationDuration: `${0.5 + seededRandom(i + 50) * 0.6}s` }} />
              ))}
            </div>
            <a href="/" className="nav-link">Inicio</a>
            <a href="/setlist/imprimir" className="nav-link">Imprimir</a>
          </div>
        </header>

        <div className="content">
          <div className="toolbar-row">
            <div className="sort-toggle">
              <button className={`sort-btn ${sort === 'song' ? 'active' : ''}`} onClick={() => setSort('song')}>
                Por canción
              </button>
              <button className={`sort-btn ${sort === 'artist' ? 'active' : ''}`} onClick={() => setSort('artist')}>
                Por artista
              </button>
            </div>
            <span className="song-count">{ALL_SONGS.length} temas</span>
          </div>

          <div className="song-card">
            {sort === 'song' ? (
              <div className="songs-2col">
                <div>
                  {colLeft.map((song, i) => (
                    <div key={`${song.title}-${song.artist}`} className="song-row" style={{ '--accent': ACCENT_COLORS[i % ACCENT_COLORS.length] } as React.CSSProperties}>
                      <span className="song-title">{song.title}</span>
                      <span className="song-artist">{song.artist}</span>
                    </div>
                  ))}
                </div>
                <div>
                  {colRight.map((song, i) => (
                    <div key={`${song.title}-${song.artist}`} className="song-row" style={{ '--accent': ACCENT_COLORS[(i + mid) % ACCENT_COLORS.length] } as React.CSSProperties}>
                      <span className="song-title">{song.title}</span>
                      <span className="song-artist">{song.artist}</span>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="artists-wrap">
                {artistGroups.map((group, gi) => (
                  <div key={group.artist} className="artist-group" style={{ '--accent': ACCENT_COLORS[gi % ACCENT_COLORS.length] } as React.CSSProperties}>
                    <div className="artist-name">{group.artist}</div>
                    {group.tracks.map((song) => (
                      <div key={song.title} className="artist-track">{song.title}</div>
                    ))}
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="qr-footer">
            <div className="qr-frame">
              <div className="qr-ph">
                <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
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
            <div className="qr-text">
              <h3>¡Pídenos tu canción favorita!</h3>
              <p>Escaneá el código y apoyá a la banda</p>
              <p>Con tu aporte nos ayudas a seguir tocando. <strong>¡Gracias por el apoyo!</strong></p>
            </div>
          </div>
        </div>

        <footer className="page-footer">
          <div className="footer-line" />
          Que no pare la música
          <div className="footer-line" />
        </footer>
      </div>
    </>
  )
}
