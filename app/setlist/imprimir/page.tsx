'use client'

import { useMemo } from 'react'
import { ALL_SONGS } from '@/data/setlist'

const ACCENT = ['#ff1493', '#ffd700', '#00e5ff', '#bf00ff']

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

export default function SetlistPrint() {
  const sorted = useMemo(
    () => [...ALL_SONGS].sort((a, b) => a.title.localeCompare(b.title)),
    [],
  )

  const mid = Math.ceil(sorted.length / 2)
  const colLeft = sorted.slice(0, mid)
  const colRight = sorted.slice(mid)

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

        /* ── Stars ── */
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
        .toolbar a {
          color: rgba(255,255,255,0.5); text-decoration: none;
          font-size: 0.75rem; letter-spacing: 0.05em; transition: color 0.2s;
        }
        .toolbar a:hover { color: var(--gold); }
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
          font-weight: 300; font-size: 0.75rem;           letter-spacing: 0.35em;
          text-transform: uppercase; color: rgba(255,255,255,0.55); margin: 0.3rem 0 0;
        }
        .print-header .count {
          font-weight: 300; font-size: 0.7rem;
          color: rgba(255,255,255,0.4); margin: 0.3rem 0 0; letter-spacing: 0.05em;
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
        .songs-grid .col-divider {
          display: none;
        }

        .p-song {
          display: grid; grid-template-columns: 1fr auto;
          gap: 0.3rem; align-items: baseline;
          padding: 0.2rem 0.4rem; font-size: 0.76rem; line-height: 1.4;
          border-radius: 4px; transition: background 0.2s;
        }
        .p-song:hover { background: rgba(255,255,255,0.04); }
        .p-song:nth-child(4n+1) .p-title { color: #fff; }
        .p-song:nth-child(4n+2) .p-title { color: rgba(255,255,255,0.95); }
        .p-title { font-weight: 500; color: #eee; }
        .p-artist {
          font-weight: 400; color: #c4a24e;
          font-size: 0.72rem; text-align: right;
        }
        .p-song:hover .p-artist { color: #ffd700; }

        /* ── Accent stripe between columns (screen only) ── */
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

        /* ── Page Footer ── */
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
          .p-song { font-size: 0.68rem; padding: 0.12rem 0.2rem; }
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
        }
      `}</style>

      <div className="print-page">
        {STARS.map((s, i) => (
          <div key={`s-${i}`} className="star" style={{ left: `${s.left}%`, top: `${s.top}%`, width: s.size, height: s.size, animationDelay: `${s.delay}s` }} />
        ))}

        <div className="toolbar">
          <a href="/setlist">&#8592; Volver al repertorio</a>
          <button className="export-btn" onClick={() => window.print()}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="7 10 12 15 17 10" />
              <line x1="12" y1="15" x2="12" y2="3" />
            </svg>
            Exportar PDF
          </button>
        </div>

        <div className="print-content">
          <header className="print-header">
            <h1>REPERTORIO</h1>
            <p className="sub">Disco &bull; Rock &bull; En Vivo</p>
            <p className="count">{sorted.length} temas &mdash; ordenados por canción</p>
          </header>

          <div className="songs-card">
            <div className="songs-grid">
              <div>
                {colLeft.map((song, i) => (
                  <div key={`${song.title}-${song.artist}`} className="p-song">
                    <span className="p-title">{song.title}</span>
                    <span className="p-artist">{song.artist}</span>
                  </div>
                ))}
              </div>
              <div>
                {colRight.map((song, i) => (
                  <div key={`${song.title}-${song.artist}`} className="p-song">
                    <span className="p-title">{song.title}</span>
                    <span className="p-artist">{song.artist}</span>
                  </div>
                ))}
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
