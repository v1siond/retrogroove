'use client'

import { getGroupedByBloque } from '@/lib/songs'
import { Bloque, Song, getBloqueColor, getBloqueName } from '@/lib/types'

export default function SetlistPrint() {
  const grouped = getGroupedByBloque()
  const mainBloques: Bloque[] = [1, 2, 3, 4]
  const hasExtras = grouped['extras'].length > 0

  const extrasLeft = grouped['extras'].filter((_, i) => i % 2 === 0)
  const extrasRight = grouped['extras'].filter((_, i) => i % 2 === 1)

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
          font-size: 0.85rem; letter-spacing: 0.05em; transition: color 0.2s;
        }
        .toolbar a:hover { color: var(--gold); }
        .export-btn {
          display: inline-flex; align-items: center; gap: 0.5rem;
          padding: 0.45rem 1.2rem;
          background: linear-gradient(135deg, var(--pink), var(--purple));
          color: #fff; border: none; border-radius: 8px;
          font-family: 'Outfit', sans-serif; font-size: 0.85rem;
          font-weight: 600; letter-spacing: 0.05em;
          cursor: pointer; transition: opacity 0.2s, transform 0.2s;
          box-shadow: 0 0 20px rgba(255,20,147,0.2);
        }
        .export-btn:hover { opacity: 0.9; transform: translateY(-1px); }

        /* ── Content ── */
        .print-content {
          max-width: 1280px; margin: 0 auto;
          padding: 1.5rem 2rem 1rem;
          position: relative; z-index: 10;
        }

        /* ── Page Container ── */
        .page {
          min-height: 100vh;
        }
        .page + .page {
          page-break-before: always;
        }

        /* ── Header ── */
        .print-header {
          text-align: center;
          padding-bottom: 1.5rem; position: relative;
        }
        .print-header h1 {
          font-family: 'Bebas Neue', sans-serif;
          font-size: 3.8rem; letter-spacing: 0.15em;
          color: #fff; margin: 0; line-height: 1;
          text-shadow: 0 0 10px rgba(255,20,147,0.4), 0 0 30px rgba(255,20,147,0.2);
        }
        .print-header .sub {
          font-weight: 300; font-size: 1rem; letter-spacing: 0.35em;
          text-transform: uppercase; color: rgba(255,255,255,0.6); margin: 0.4rem 0 0;
        }

        /* ── Bloque Grid ── */
        .bloque-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 1.5rem;
          margin-bottom: 1.5rem;
        }

        .bloque-card {
          background: rgba(255,255,255,0.025);
          backdrop-filter: blur(8px); -webkit-backdrop-filter: blur(8px);
          border: 1px solid rgba(255,255,255,0.06);
          border-radius: 14px;
          overflow: hidden;
          page-break-inside: avoid;
        }

        .bloque-header {
          padding: 0.6rem 1rem;
          font-family: 'Bebas Neue', sans-serif;
          font-size: 1.4rem;
          letter-spacing: 0.1em;
          color: #fff;
          text-shadow: 0 0 8px currentColor;
        }

        .bloque-songs {
          padding: 0.5rem 1rem 1rem;
        }

        .bloque-song {
          display: flex;
          justify-content: space-between;
          align-items: baseline;
          padding: 0.2rem 0;
          font-size: 0.95rem;
          line-height: 1.4;
        }

        .song-title {
          font-weight: 500;
          color: #eee;
        }

        .song-artist {
          font-weight: 400;
          color: #c4a24e;
          font-size: 0.85rem;
          text-align: right;
          margin-left: 0.5rem;
          flex-shrink: 0;
        }

        /* ── Extras Section ── */
        .extras-header {
          text-align: center;
          padding: 1.5rem 0;
        }
        .extras-header h2 {
          font-family: 'Bebas Neue', sans-serif;
          font-size: 3rem; letter-spacing: 0.12em;
          color: #fff; margin: 0; line-height: 1;
          text-shadow: 0 0 10px rgba(136,136,136,0.4);
        }
        .extras-header .sub {
          font-weight: 300; font-size: 0.9rem; letter-spacing: 0.3em;
          text-transform: uppercase; color: rgba(255,255,255,0.5); margin: 0.3rem 0 0;
        }

        .extras-card {
          background: rgba(255,255,255,0.025);
          backdrop-filter: blur(8px); -webkit-backdrop-filter: blur(8px);
          border: 1px solid rgba(255,255,255,0.06);
          border-radius: 14px;
          padding: 1rem 1.2rem;
          margin-bottom: 1.5rem;
          position: relative;
          overflow: hidden;
        }
        .extras-card::before {
          content: ''; position: absolute; top: 0; left: 0; right: 0; height: 1.5px;
          background: linear-gradient(90deg, #888, #aaa, #888);
        }

        .extras-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 0 2rem;
        }
        .extras-grid > div:first-child {
          border-right: 1px solid rgba(255,255,255,0.04);
          padding-right: 1rem;
        }
        .extras-grid > div:last-child {
          padding-left: 1rem;
        }

        /* ── QR Footer ── */
        .qr-footer {
          display: flex; align-items: center; justify-content: center; text-align: left; gap: 1rem;
          padding: 1rem 1.4rem;
          background: rgba(255,255,255,0.03);
          border: 1px solid rgba(255,255,255,0.08);
          border-radius: 14px;
          margin-top: auto;
          position: relative; overflow: hidden;
        }
        .qr-footer::before {
          content: ''; position: absolute; inset: 0; border-radius: 14px; padding: 1px;
          background: linear-gradient(135deg, var(--pink), var(--gold), var(--cyan), var(--purple));
          -webkit-mask: linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0);
          -webkit-mask-composite: xor; mask-composite: exclude; pointer-events: none;
        }
        .qr-frame {
          width: 80px; height: 80px; min-width: 80px;
          background: #fff; border-radius: 8px;
          display: flex; align-items: center; justify-content: center;
          overflow: hidden;
          box-shadow: 0 0 15px rgba(255,20,147,0.15), 0 0 30px rgba(191,0,255,0.08);
        }
        .qr-frame img { width: 100%; height: 100%; object-fit: contain; padding: 0.35rem; }
        .qr-text h3 {
          font-family: 'Bebas Neue', sans-serif; font-size: 1.2rem;
          letter-spacing: 0.05em; color: #fff; margin: 0 0 0.15rem;
          text-shadow: 0 0 12px rgba(255,20,147,0.3);
        }
        .qr-text p {
          font-weight: 300; font-size: 0.82rem;
          color: rgba(255,255,255,0.5); margin: 0; line-height: 1.5;
        }
        .qr-text strong { color: var(--gold); font-weight: 600; }

        /* ── Print Overrides ── */
        @media print {
          @page { size: A4; margin: 0; }
          * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
          .toolbar { display: none !important; }
          .print-page {
            background: linear-gradient(180deg, #050010 0%, #0d0025 50%, #050010 100%) !important;
            min-height: auto;
          }
          .print-content { padding: 10mm 12mm 8mm; max-width: 100%; }

          .page {
            min-height: auto;
            height: 100vh;
            display: flex;
            flex-direction: column;
          }
          .page + .page {
            page-break-before: always;
          }

          .print-header { padding-bottom: 0.8rem; }
          .print-header h1 { font-size: 2rem; }
          .print-header .sub { font-size: 0.7rem; margin-top: 0.15rem; }

          .bloque-grid {
            gap: 1rem;
            margin-bottom: 1rem;
            flex: 1;
          }
          .bloque-card {
            backdrop-filter: none;
            page-break-inside: avoid;
          }
          .bloque-header {
            padding: 0.4rem 0.8rem;
            font-size: 1.1rem;
          }
          .bloque-songs {
            padding: 0.3rem 0.8rem 0.6rem;
          }
          .bloque-song {
            font-size: 0.8rem;
            padding: 0.12rem 0;
          }
          .song-artist { font-size: 0.7rem; }

          .extras-header { padding: 0.8rem 0; }
          .extras-header h2 { font-size: 2rem; }
          .extras-header .sub { font-size: 0.65rem; }
          .extras-card {
            backdrop-filter: none;
            padding: 0.6rem 0.8rem;
            margin-bottom: 1rem;
            flex: 1;
          }
          .extras-grid > div:first-child { padding-right: 0.7rem; }
          .extras-grid > div:last-child { padding-left: 0.7rem; }

          .qr-footer {
            padding: 0.5rem 1rem;
            backdrop-filter: none;
            background: rgba(255,255,255,0.06) !important;
            border: 1px solid rgba(255,255,255,0.2) !important;
          }
          .qr-footer::before { display: none !important; }
          .qr-frame { width: 70px; height: 70px; min-width: 70px; box-shadow: none !important; }
          .qr-text h3 { font-size: 1rem; text-shadow: none !important; margin-bottom: 0.05rem; }
          .qr-text p { font-size: 0.75rem; color: rgba(255,255,255,0.8) !important; line-height: 1.4; }
          .qr-text strong { color: #ffd700 !important; }
        }

        @media (max-width: 640px) {
          .bloque-grid { grid-template-columns: 1fr; }
          .extras-grid { grid-template-columns: 1fr; }
          .extras-grid > div:first-child { border-right: none; padding-right: 0; }
          .extras-grid > div:last-child { padding-left: 0; }
          .qr-footer { flex-direction: column; text-align: center; }
        }
      `}</style>

      <div className="print-page">
        <div className="toolbar">
          <a href="/setlist">&#8592; Volver al repertorio</a>
          <button className="export-btn" onClick={() => window.print()}>
            <span>&#128424;</span>
            Imprimir / PDF
          </button>
        </div>

        <div className="print-content">
          {/* Page 1: Main Bloques */}
          <div className="page">
            <header className="print-header">
              <h1>RETROGROOVE — REPERTORIO</h1>
              <p className="sub">Disco &bull; Rock &bull; En Vivo</p>
            </header>

            <div className="bloque-grid">
              {mainBloques.map((bloque) => (
                <div key={bloque} className="bloque-card">
                  <div
                    className="bloque-header"
                    style={{ backgroundColor: getBloqueColor(bloque) }}
                  >
                    {getBloqueName(bloque)}
                  </div>
                  <div className="bloque-songs">
                    {grouped[bloque].map((song) => (
                      <div key={song.id} className="bloque-song">
                        <span className="song-title">{song.title}</span>
                        <span className="song-artist">{song.artist}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>

            <div className="qr-footer">
              <div className="qr-frame">
                <img src="/images/plin-qr.jpg" alt="QR Plin" />
              </div>
              <div className="qr-text">
                <h3>¡Pide tu canción!</h3>
                <p>Escanea el QR, yapea y pide tu favorita.<br /><strong>¡Gracias por el apoyo!</strong></p>
              </div>
            </div>
          </div>

          {/* Page 2: Extras (only if extras exist) */}
          {hasExtras && (
            <div className="page">
              <header className="extras-header">
                <h2>EXTRAS</h2>
                <p className="sub">Encores &bull; Favoritos &bull; Deep Cuts</p>
              </header>

              <div className="extras-card">
                <div className="extras-grid">
                  <div>
                    {extrasLeft.map((song) => (
                      <div key={song.id} className="bloque-song">
                        <span className="song-title">{song.title}</span>
                        <span className="song-artist">{song.artist}</span>
                      </div>
                    ))}
                  </div>
                  <div>
                    {extrasRight.map((song) => (
                      <div key={song.id} className="bloque-song">
                        <span className="song-title">{song.title}</span>
                        <span className="song-artist">{song.artist}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div className="qr-footer">
                <div className="qr-frame">
                  <img src="/images/plin-qr.jpg" alt="QR Plin" />
                </div>
                <div className="qr-text">
                  <h3>¡Pide tu canción!</h3>
                  <p>Escanea el QR, yapea y pide tu favorita.<br /><strong>¡Gracias por el apoyo!</strong></p>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  )
}
