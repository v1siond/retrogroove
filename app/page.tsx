'use client'

import { useEffect, useState } from 'react'

const ACCENT = ['#ff1493', '#ffd700', '#00e5ff', '#bf00ff']

function sr(seed: number) {
  const x = Math.sin(seed + 1) * 10000
  return x - Math.floor(x)
}

const STARS = Array.from({ length: 50 }, (_, i) => ({
  left: sr(i * 3) * 100,
  top: sr(i * 3 + 1) * 100,
  delay: sr(i * 3 + 2) * 4,
  size: sr(i * 7) * 3 + 1,
}))

const REFLECTIONS = Array.from({ length: 14 }, (_, i) => ({
  left: sr(i * 5 + 200) * 100,
  top: sr(i * 5 + 201) * 100,
  delay: sr(i * 5 + 202) * 6,
  duration: sr(i * 5 + 203) * 4 + 3,
  color: ACCENT[Math.floor(sr(i * 5 + 204) * 4)],
  size: sr(i * 5 + 205) * 6 + 3,
}))

export default function Home() {
  const [mounted, setMounted] = useState(false)

  useEffect(() => { setMounted(true) }, [])
  useEffect(() => {
    document.body.style.overflow = 'auto'
    return () => { document.body.style.overflow = '' }
  }, [])

  return (
    <>
      <title>RetroGroove — Disco &amp; Rock en Vivo</title>

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;600;700;800;900&family=Bebas+Neue&display=swap');

        .rg-page {
          --pink: #ff1493;
          --gold: #ffd700;
          --cyan: #00e5ff;
          --purple: #bf00ff;
          min-height: 100vh;
          background: linear-gradient(180deg, #050010 0%, #0d0025 40%, #100020 70%, #050010 100%);
          color: #fff;
          font-family: 'Outfit', sans-serif;
          overflow-x: hidden;
          position: relative;
        }

        /* ── Background effects ── */
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
          animation: rflash ease-in-out infinite; z-index: 1; filter: blur(0.5px);
        }
        @keyframes rflash {
          0%, 100% { opacity: 0; transform: scale(0.5) rotate(0deg); }
          50% { opacity: 0.8; transform: scale(1.2) rotate(90deg); }
        }

        /* ── Disco Ball ── */
        .disco-ball-wrap {
          position: relative; display: flex; flex-direction: column; align-items: center;
        }
        .disco-string {
          width: 2px; height: 60px;
          background: linear-gradient(to bottom, transparent, rgba(200,200,200,0.6));
        }
        .disco-ball {
          width: 150px; height: 150px; border-radius: 50%;
          background: radial-gradient(circle at 30% 25%, #fff 0%, #e0e0e0 8%, #b0b0b0 25%, #707070 50%, #404040 80%, #222 100%);
          position: relative;
          box-shadow:
            0 0 40px rgba(255,255,255,0.5), 0 0 80px rgba(255,0,255,0.25),
            0 0 120px rgba(0,229,255,0.15), 0 0 180px rgba(255,215,0,0.1),
            inset 0 -15px 30px rgba(0,0,0,0.4);
          animation: ball-spin 12s linear infinite;
        }
        .disco-ball::before {
          content: ''; position: absolute; inset: 3px; border-radius: 50%;
          background:
            repeating-linear-gradient(0deg, transparent, transparent 8px, rgba(255,255,255,0.12) 8px, rgba(255,255,255,0.12) 9px),
            repeating-linear-gradient(90deg, transparent, transparent 8px, rgba(255,255,255,0.12) 8px, rgba(255,255,255,0.12) 9px);
          mask-image: radial-gradient(circle, #000 60%, transparent 100%);
          -webkit-mask-image: radial-gradient(circle, #000 60%, transparent 100%);
        }
        .disco-ball::after {
          content: ''; position: absolute;
          top: 8%; left: 22%; width: 25%; height: 18%; border-radius: 50%;
          background: radial-gradient(ellipse, rgba(255,255,255,0.7) 0%, transparent 70%);
          filter: blur(3px);
        }
        @keyframes ball-spin { from { transform: rotateY(0deg); } to { transform: rotateY(360deg); } }

        /* ── Light Rays ── */
        .light-rays {
          position: absolute; top: -150px; left: 50%;
          width: 1000px; height: 1000px; transform: translateX(-50%);
          background: conic-gradient(
            from 0deg,
            transparent 0deg, rgba(255,20,147,0.07) 10deg, transparent 20deg,
            transparent 30deg, rgba(0,229,255,0.07) 40deg, transparent 50deg,
            transparent 60deg, rgba(255,215,0,0.07) 70deg, transparent 80deg,
            transparent 90deg, rgba(191,0,255,0.07) 100deg, transparent 110deg,
            transparent 120deg, rgba(255,20,147,0.07) 130deg, transparent 140deg,
            transparent 150deg, rgba(0,229,255,0.07) 160deg, transparent 170deg,
            transparent 180deg, rgba(255,215,0,0.07) 190deg, transparent 200deg,
            transparent 210deg, rgba(191,0,255,0.07) 220deg, transparent 230deg,
            transparent 240deg, rgba(255,20,147,0.07) 250deg, transparent 260deg,
            transparent 270deg, rgba(0,229,255,0.07) 280deg, transparent 290deg,
            transparent 300deg, rgba(255,215,0,0.07) 310deg, transparent 320deg,
            transparent 330deg, rgba(191,0,255,0.07) 340deg, transparent 360deg
          );
          border-radius: 50%;
          animation: rays-spin 25s linear infinite;
          pointer-events: none; z-index: 0;
        }
        @keyframes rays-spin { to { transform: translateX(-50%) rotate(360deg); } }

        /* ── Hero ── */
        .hero {
          position: relative; z-index: 10;
          min-height: 100vh;
          display: flex; flex-direction: column;
          align-items: center; justify-content: center;
          text-align: center;
          padding: 2rem 1rem;
        }
        .brand {
          font-family: 'Bebas Neue', sans-serif;
          font-size: clamp(3.5rem, 14vw, 9rem);
          letter-spacing: 0.12em;
          color: #fff;
          text-shadow:
            0 0 7px #fff, 0 0 15px #fff,
            0 0 30px var(--pink), 0 0 60px var(--pink), 0 0 80px var(--pink);
          animation: neon-pulse 3s ease-in-out infinite alternate;
          margin: 1rem 0 0; line-height: 1;
        }
        @keyframes neon-pulse {
          from { text-shadow: 0 0 7px #fff, 0 0 15px #fff, 0 0 30px var(--pink), 0 0 60px var(--pink), 0 0 80px var(--pink); }
          to { text-shadow: 0 0 5px #fff, 0 0 10px #fff, 0 0 20px var(--pink), 0 0 40px var(--pink), 0 0 60px var(--pink), 0 0 100px var(--pink); }
        }
        .tagline {
          font-weight: 300;
          font-size: clamp(1rem, 3vw, 1.4rem);
          letter-spacing: 0.4em;
          text-transform: uppercase;
          color: rgba(255,255,255,0.45);
          margin-top: 0.3rem;
        }

        /* ── EQ Bars ── */
        .eq-bars { display: flex; align-items: flex-end; gap: 3px; height: 24px; margin-top: 2rem; }
        .eq-bar { width: 4px; border-radius: 2px; animation: eq-bounce ease-in-out infinite; }
        @keyframes eq-bounce { 0%, 100% { height: 5px; } 50% { height: 22px; } }

        /* ── CTA ── */
        .cta {
          display: inline-block;
          margin-top: 2.5rem;
          padding: 0.85rem 2.8rem;
          font-family: 'Bebas Neue', sans-serif;
          font-size: 1.35rem;
          letter-spacing: 0.15em;
          color: #fff;
          background: linear-gradient(135deg, rgba(255,20,147,0.25), rgba(191,0,255,0.25));
          border: 1px solid rgba(255,255,255,0.2);
          border-radius: 40px;
          text-decoration: none;
          transition: all 0.4s;
          box-shadow: 0 0 25px rgba(255,20,147,0.2), 0 0 50px rgba(191,0,255,0.1);
        }
        .cta:hover {
          background: linear-gradient(135deg, rgba(255,20,147,0.45), rgba(191,0,255,0.45));
          border-color: rgba(255,255,255,0.4);
          box-shadow: 0 0 35px rgba(255,20,147,0.4), 0 0 70px rgba(191,0,255,0.2);
          transform: translateY(-3px);
        }

        .scroll-hint {
          position: absolute;
          bottom: 2rem;
          color: rgba(255,255,255,0.2);
          font-size: 0.8rem;
          letter-spacing: 0.2em;
          text-transform: uppercase;
          animation: bounce-hint 2s ease-in-out infinite;
        }
        @keyframes bounce-hint {
          0%, 100% { transform: translateY(0); opacity: 0.2; }
          50% { transform: translateY(6px); opacity: 0.5; }
        }

        /* ── Sections ── */
        .sections { position: relative; z-index: 10; max-width: 700px; margin: 0 auto; padding: 0 1rem 2rem; }

        .section-card {
          background: rgba(255,255,255,0.03);
          backdrop-filter: blur(10px);
          -webkit-backdrop-filter: blur(10px);
          border: 1px solid rgba(255,255,255,0.08);
          border-radius: 16px;
          padding: 2.5rem 2rem;
          text-align: center;
          margin-bottom: 2rem;
          position: relative;
          overflow: hidden;
        }
        .section-card::before {
          content: ''; position: absolute; top: 0; left: 0; right: 0; height: 2px;
          background: linear-gradient(90deg, var(--pink), var(--gold), var(--cyan), var(--purple));
        }
        .section-title {
          font-family: 'Bebas Neue', sans-serif;
          font-size: 1.6rem;
          letter-spacing: 0.1em;
          color: var(--gold);
          text-shadow: 0 0 15px rgba(255,215,0,0.3);
          margin-bottom: 0.8rem;
        }
        .section-text {
          font-weight: 300;
          font-size: 1.05rem;
          color: rgba(255,255,255,0.4);
          line-height: 1.6;
        }

        /* ── QR ── */
        .qr-card {
          position: relative;
          background: rgba(255,255,255,0.04);
          backdrop-filter: blur(16px);
          -webkit-backdrop-filter: blur(16px);
          border-radius: 20px;
          padding: 2.5rem 2rem;
          text-align: center;
          border: 1px solid rgba(255,255,255,0.1);
          overflow: hidden;
          max-width: 400px;
          margin: 0 auto 2rem;
        }
        .qr-card::before {
          content: ''; position: absolute; inset: 0; border-radius: 20px; padding: 1.5px;
          background: linear-gradient(135deg, var(--pink), var(--gold), var(--cyan), var(--purple));
          -webkit-mask: linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0);
          -webkit-mask-composite: xor; mask-composite: exclude; pointer-events: none;
        }
        .qr-card::after {
          content: ''; position: absolute; top: -50%; left: -50%; width: 200%; height: 200%;
          background: conic-gradient(from 0deg, transparent 0deg, rgba(255,20,147,0.08) 60deg, transparent 120deg, rgba(0,229,255,0.08) 180deg, transparent 240deg, rgba(255,215,0,0.08) 300deg, transparent 360deg);
          animation: qr-spin 8s linear infinite; pointer-events: none; z-index: 0;
        }
        @keyframes qr-spin { to { transform: rotate(360deg); } }
        .qr-card > * { position: relative; z-index: 1; }
        .qr-heading {
          font-family: 'Bebas Neue', sans-serif; font-size: 1.7rem; letter-spacing: 0.05em;
          color: #fff; text-shadow: 0 0 25px rgba(255,20,147,0.4);
          margin-bottom: 0.4rem; line-height: 1.2;
        }
        .qr-sub { font-weight: 300; font-size: 1.05rem; color: rgba(255,255,255,0.45); margin-bottom: 1.5rem; }
        .qr-frame {
          width: 180px; height: 180px; margin: 0 auto 1.5rem;
          background: #fff; border-radius: 14px;
          display: flex; align-items: center; justify-content: center;
          box-shadow: 0 0 25px rgba(255,20,147,0.2), 0 0 50px rgba(191,0,255,0.1);
          overflow: hidden;
        }
        .qr-frame img { width: 100%; height: 100%; object-fit: contain; padding: 0.6rem; }
        .qr-ph { display: flex; flex-direction: column; align-items: center; gap: 0.4rem; color: #bbb; }
        .qr-ph svg { opacity: 0.4; }
        .qr-ph span { font-size: 0.75rem; font-weight: 600; letter-spacing: 0.15em; text-transform: uppercase; color: #aaa; }
        .qr-support { font-weight: 300; font-size: 0.95rem; color: rgba(255,255,255,0.4); line-height: 1.7; margin: 0; }
        .qr-support strong { color: var(--gold); font-weight: 600; }

        /* ── Footer ── */
        .rg-footer {
          text-align: center; padding: 3rem 1rem 2rem;
          color: rgba(255,255,255,0.2); font-size: 0.9rem;
          letter-spacing: 0.15em; text-transform: uppercase;
          position: relative; z-index: 10;
        }
        .rg-footer .fline {
          width: 60px; height: 1px; margin: 1rem auto;
          background: linear-gradient(90deg, transparent, rgba(255,255,255,0.2), transparent);
        }

        @media (max-width: 640px) {
          .qr-card { margin-left: 1rem; margin-right: 1rem; }
          .qr-frame { width: 150px; height: 150px; }
        }
      `}</style>

      <div className="rg-page">
        {mounted && STARS.map((s, i) => (
          <div key={`s-${i}`} className="star" style={{ left: `${s.left}%`, top: `${s.top}%`, width: s.size, height: s.size, animationDelay: `${s.delay}s` }} />
        ))}
        {mounted && REFLECTIONS.map((r, i) => (
          <div key={`r-${i}`} className="reflection" style={{ left: `${r.left}%`, top: `${r.top}%`, width: r.size, height: r.size, background: r.color, animationDelay: `${r.delay}s`, animationDuration: `${r.duration}s` }} />
        ))}

        <section className="hero">
          <div className="light-rays" />
          <div className="disco-ball-wrap">
            <div className="disco-string" />
            <div className="disco-ball" />
          </div>
          <h1 className="brand">RETROGROOVE</h1>
          <p className="tagline">Disco &bull; Rock &bull; En Vivo</p>
          <div className="eq-bars">
            {Array.from({ length: 11 }).map((_, i) => (
              <div key={i} className="eq-bar" style={{ background: 'linear-gradient(to top, #ff1493, #ffd700)', animationDelay: `${i * 0.12}s`, animationDuration: `${0.5 + sr(i + 80) * 0.7}s` }} />
            ))}
          </div>
          <a href="/setlist" className="cta">Ver Repertorio</a>
          <span className="scroll-hint">&#8595;</span>
        </section>

        <div className="sections">
          <div className="section-card">
            <h2 className="section-title">Próximos Shows</h2>
            <p className="section-text">
              Estamos preparando nuevas fechas.<br />
              Pronto las anunciaremos por acá.
            </p>
          </div>

          <div className="section-card">
            <h2 className="section-title">Galería</h2>
            <p className="section-text">
              Fotos y videos de nuestros conciertos.<br />
              Próximamente...
            </p>
          </div>

          <div className="qr-card">
            <p className="qr-heading">¡Apoya a la banda!</p>
            <p className="qr-sub">Escanea el código con Plin y pide tu canción favorita</p>
            <div className="qr-frame">
              <img src="/images/plin-qr.jpg" alt="QR Plin — RetroGroove" />
            </div>
            <p className="qr-support">
              Con tu aporte nos ayudas a seguir tocando.<br />
              <strong>¡Gracias por el apoyo!</strong>
            </p>
          </div>
        </div>

        <footer className="rg-footer">
          <div className="fline" />
          Que no pare la música
          <div className="fline" />
        </footer>
      </div>
    </>
  )
}
