'use client'

import { useEffect, useState } from 'react'

const ACCENT = ['#ff1493', '#ffd700', '#00e5ff', '#bf00ff']

function sr(seed: number) {
  const x = Math.sin(seed + 1) * 10000
  return x - Math.floor(x)
}

const STARS = Array.from({ length: 80 }, (_, i) => ({
  left: sr(i * 3) * 100,
  top: sr(i * 3 + 1) * 100,
  delay: sr(i * 3 + 2) * 4,
  size: sr(i * 7) * 2 + 0.5,
}))

const REFLECTIONS = Array.from({ length: 20 }, (_, i) => ({
  left: sr(i * 5 + 200) * 100,
  top: sr(i * 5 + 201) * 100,
  delay: sr(i * 5 + 202) * 6,
  duration: sr(i * 5 + 203) * 4 + 3,
  color: ACCENT[Math.floor(sr(i * 5 + 204) * 4)],
  size: sr(i * 5 + 205) * 4 + 2,
}))

const UPCOMING_SHOWS: Array<{ date: string; title: string; venue: string; time?: string; tickets?: string; instagram?: string; website?: string; isPrivate?: boolean }> = [
  {
    date: '2026-06-10',
    title: 'Cafe Rock',
    venue: 'Lince, Lima',
    time: '9:00 PM',
    website: 'https://caferock.pe/',
    instagram: 'https://www.instagram.com/caferock_lince/',
  },
  {
    date: '2026-08-06',
    title: 'La Basílica 640',
    venue: 'Lima',
    time: '9:30 PM',
    tickets: '85 entradas disponibles — contacta a la banda',
    website: 'https://labasilica640.pe/',
    instagram: 'https://www.instagram.com/labasilica640/',
  },
  {
    date: '2026-08-08',
    title: 'Evento Privado',
    venue: 'Lima',
    isPrivate: true,
  },
]

const FAQ_ITEMS = [
  {
    category: 'EQUIPO',
    color: '#ff1493',
    question: '¿Qué equipo de sonido incluyen?',
    answer: `Nuestro rider de sonido incluye:
• 2 cornetas amplificadas de 120W (PA principal)
• Consola de mezcla de 8 canales
• 4 monitores de escenario
• Amplificador de guitarra 60W
• Amplificador de monitores 40W
• Rack de efectos y procesamiento
• Cableado completo y parales

Este equipo está dimensionado para eventos de hasta 200 personas en interiores o 150 en exteriores.`,
    isRider: true,
  },
  {
    category: 'EQUIPO',
    color: '#ff1493',
    question: '¿Qué backline traen?',
    answer: `Backline completo incluido:
• Batería electrónica profesional
• Batería acústica completa con platillos
• Percusión menor (cencerro, pandereta, etc.)
• Teclado/sintetizador
• Guitarra eléctrica
• Bajo eléctrico
• Set de micrófonos vocales e instrumentales
• Parales y stands para todo el equipo`,
    isRider: true,
  },
  {
    category: 'EQUIPO',
    color: '#ff1493',
    question: '¿Proveen tarima o escenario?',
    answer: `Sí, contamos con tarimas modulares tipo tatami que podemos montar según el espacio disponible. Ideal para elevar a la banda en espacios donde el piso está al mismo nivel que el público. Para escenarios más grandes, coordinamos con proveedores especializados.`,
  },
  {
    category: 'EQUIPO',
    color: '#ff1493',
    question: '¿Qué pasa si el evento necesita más potencia?',
    answer: `Para eventos grandes (más de 200 personas, exteriores amplios, o festivales), trabajamos con proveedores de sonido profesional de confianza. Coordinamos el rider técnico y supervisamos la instalación para garantizar la calidad de audio que nos caracteriza.`,
  },
  {
    category: 'EVENTOS',
    color: '#00e5ff',
    question: '¿Qué tipo de eventos cubren?',
    answer: `Nos especializamos en:
• Bodas y matrimonios
• Eventos corporativos y galas
• Cumpleaños y aniversarios
• Fiestas privadas y celebraciones
• Bares y locales nocturnos
• Festivales y eventos públicos

Cada show se adapta al formato y estilo del evento.`,
  },
  {
    category: 'EVENTOS',
    color: '#00e5ff',
    question: '¿Pueden tocar canciones específicas o primeros bailes?',
    answer: `Sí, podemos preparar canciones especiales para momentos clave como el primer baile, brindis, o entrada de los novios. Solo necesitamos el pedido con al menos 2 semanas de anticipación para ensayar y garantizar una ejecución perfecta.`,
  },
  {
    category: 'LOGÍSTICA',
    color: '#bf00ff',
    question: '¿Qué espacio necesitan en escenario?',
    answer: `Espacio mínimo: 4 × 3 metros
Espacio recomendado: 5 × 4 metros (con backline completo)

También necesitamos:
• Acceso a corriente eléctrica (2 tomas de 220V)
• Área para carga/descarga de equipos
• Idealmente 2 horas antes del evento para montaje y prueba de sonido`,
  },
  {
    category: 'LOGÍSTICA',
    color: '#bf00ff',
    question: '¿Con cuánta anticipación debo reservar?',
    answer: `Recomendamos reservar con 2-3 meses de anticipación. Las fechas en temporada alta se agotan rápido:
• Fin de año (Nov-Dic)
• San Valentín
• Fiestas Patrias (Jul)
• Temporada de bodas (Abr-Jun, Sep-Nov)

Para fechas próximas, consulta disponibilidad por WhatsApp.`,
  },
  {
    category: 'LOGÍSTICA',
    color: '#bf00ff',
    question: '¿Qué zonas atienden?',
    answer: `Cubrimos toda Lima Metropolitana y provincias. La movilidad del equipo (taxis, transporte) se cotiza por separado según la ubicación del evento. Para eventos fuera de Lima, coordinamos logística de transporte y hospedaje.`,
  },
  {
    category: 'COSTOS',
    color: '#ffd700',
    question: '¿El equipo de sonido tiene costo adicional?',
    answer: `Nuestro show base incluye instrumentos y backline. El equipo de sonido (PA, consola, monitores) se cotiza por separado según las necesidades del evento. Para espacios pequeños donde el venue ya tiene sonido, podemos prescindir de nuestro equipo.`,
  },
  {
    category: 'COSTOS',
    color: '#ffd700',
    question: '¿Cuál es la inversión por show?',
    answer: `El precio varía según:
• Duración del show (2, 3 o 4 horas)
• Ubicación del evento
• Fecha (temporada alta/baja)
• Requerimientos técnicos
• Inclusión de equipo de sonido

Contáctanos para una cotización personalizada sin compromiso.`,
    isCTA: true,
  },
]

const GALLERY_IMAGES: Array<{ src: string; alt: string }> = [
  { src: '/images/gallery/620769037_17880318822454682_3625858137521918833_n.webp', alt: 'RetroGroove banda' },
  { src: '/images/gallery/636478504_17883668298454682_3099210929906830953_n.webp', alt: 'RetroGroove en escena' },
  { src: '/images/gallery/20251123_214937.jpg', alt: 'Show RetroGroove' },
  { src: '/images/gallery/20251123_231301.jpg', alt: 'Concierto en vivo' },
  { src: '/images/gallery/photo_2025-12-20_17-27-50.jpg', alt: 'RetroGroove en vivo' },
  { src: '/images/gallery/photo_2025-12-20_17-27-51.jpg', alt: 'RetroGroove en concierto' },
  { src: '/images/gallery/photo_2025-12-20_17-28-19.jpg', alt: 'Show en vivo' },
  { src: '/images/gallery/photo_2025-12-20_17-28-34.jpg', alt: 'Presentación RetroGroove' },
]

const WHATSAPP_PRIMARY = '968622293'
const WHATSAPP_SECONDARY = '948189289'
const INSTAGRAM_URL = 'https://instagram.com/retrogroove_band'

export default function Home() {
  const [mounted, setMounted] = useState(false)
  const [expandedFaq, setExpandedFaq] = useState<number | null>(null)

  useEffect(() => { setMounted(true) }, [])
  useEffect(() => {
    document.body.style.overflow = 'auto'
    return () => { document.body.style.overflow = '' }
  }, [])

  const formatDate = (dateStr: string) => {
    const [year, month, day] = dateStr.split('-').map(Number)
    const date = new Date(year, month - 1, day)
    const dayNum = date.getDate()
    const monthStr = date.toLocaleDateString('es-PE', { month: 'short' }).toUpperCase()
    return { day: dayNum, month: monthStr }
  }

  const isUpcoming = (dateStr: string) => {
    const [year, month, day] = dateStr.split('-').map(Number)
    const eventDate = new Date(year, month - 1, day, 23, 59, 59)
    return eventDate >= new Date()
  }

  const upcomingShows = UPCOMING_SHOWS.filter(show => isUpcoming(show.date))

  return (
    <>
      <title>RetroGroove — Banda de Covers Premium | Disco &amp; Rock en Vivo</title>
      <meta name="description" content="RetroGroove - La experiencia musical definitiva para tu evento. Especialistas en disco, rock y pop de los 70s, 80s y 90s. Bodas, corporativos y eventos exclusivos en Lima." />

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Outfit:wght@200;300;400;500;600;700&family=Bebas+Neue&display=swap');

        * { box-sizing: border-box; }

        .rg-page {
          --pink: #ff1493;
          --gold: #ffd700;
          --cyan: #00e5ff;
          --purple: #bf00ff;
          --bg-dark: #030008;
          --bg-mid: #0a0018;
          min-height: 100vh;
          background: linear-gradient(180deg, var(--bg-dark) 0%, var(--bg-mid) 50%, var(--bg-dark) 100%);
          color: #fff;
          font-family: 'Outfit', -apple-system, sans-serif;
          overflow-x: hidden;
          position: relative;
        }

        /* ── Ambient Background ── */
        .ambient-glow {
          position: fixed;
          width: 800px;
          height: 800px;
          border-radius: 50%;
          filter: blur(150px);
          opacity: 0.15;
          pointer-events: none;
          z-index: 0;
        }
        .ambient-glow.pink { background: var(--pink); top: -200px; left: -200px; }
        .ambient-glow.purple { background: var(--purple); bottom: 20%; right: -300px; }
        .ambient-glow.cyan { background: var(--cyan); bottom: -200px; left: 30%; opacity: 0.1; }

        .star {
          position: fixed; border-radius: 50%; background: #fff;
          pointer-events: none; animation: twinkle 4s ease-in-out infinite; z-index: 0;
        }
        @keyframes twinkle {
          0%, 100% { opacity: 0.15; }
          50% { opacity: 0.6; }
        }
        .reflection {
          position: fixed; border-radius: 50%; pointer-events: none; opacity: 0;
          animation: rflash ease-in-out infinite; z-index: 1; filter: blur(1px);
        }
        @keyframes rflash {
          0%, 100% { opacity: 0; transform: scale(0.8); }
          50% { opacity: 0.5; transform: scale(1); }
        }

        /* ── Disco Ball ── */
        .disco-ball-wrap {
          position: relative; display: flex; flex-direction: column; align-items: center;
          margin-bottom: 2rem;
        }
        .disco-string {
          width: 1px; height: 80px;
          background: linear-gradient(to bottom, transparent, rgba(255,255,255,0.3));
        }
        .disco-ball {
          width: 120px; height: 120px; border-radius: 50%;
          background: radial-gradient(circle at 30% 25%, #fff 0%, #e8e8e8 10%, #c0c0c0 30%, #808080 60%, #404040 90%);
          position: relative;
          box-shadow:
            0 0 60px rgba(255,255,255,0.4),
            0 0 120px rgba(255,20,147,0.2),
            0 0 180px rgba(191,0,255,0.1);
          animation: ball-spin 20s linear infinite;
        }
        .disco-ball::before {
          content: ''; position: absolute; inset: 2px; border-radius: 50%;
          background:
            repeating-linear-gradient(0deg, transparent, transparent 6px, rgba(255,255,255,0.08) 6px, rgba(255,255,255,0.08) 7px),
            repeating-linear-gradient(90deg, transparent, transparent 6px, rgba(255,255,255,0.08) 6px, rgba(255,255,255,0.08) 7px);
          mask-image: radial-gradient(circle, #000 55%, transparent 100%);
          -webkit-mask-image: radial-gradient(circle, #000 55%, transparent 100%);
        }
        .disco-ball::after {
          content: ''; position: absolute;
          top: 12%; left: 20%; width: 30%; height: 20%; border-radius: 50%;
          background: radial-gradient(ellipse, rgba(255,255,255,0.8) 0%, transparent 70%);
          filter: blur(4px);
        }
        @keyframes ball-spin { from { transform: rotateY(0deg); } to { transform: rotateY(360deg); } }

        /* ── Hero ── */
        .hero {
          position: relative; z-index: 10;
          min-height: 100vh;
          display: flex; flex-direction: column;
          align-items: center; justify-content: center;
          text-align: center;
          padding: 2rem 1.5rem;
        }
        .brand {
          font-family: 'Bebas Neue', sans-serif;
          font-size: clamp(4rem, 18vw, 12rem);
          letter-spacing: 0.15em;
          color: #fff;
          text-shadow:
            0 0 10px rgba(255,255,255,0.8),
            0 0 40px rgba(255,20,147,0.6),
            0 0 80px rgba(255,20,147,0.4),
            0 0 120px rgba(191,0,255,0.3);
          margin: 0; line-height: 0.9;
          animation: brand-glow 4s ease-in-out infinite alternate;
        }
        @keyframes brand-glow {
          from { filter: brightness(1); }
          to { filter: brightness(1.1); }
        }
        .tagline {
          font-weight: 300;
          font-size: clamp(0.9rem, 2.5vw, 1.2rem);
          letter-spacing: 0.5em;
          text-transform: uppercase;
          color: rgba(255,255,255,0.5);
          margin-top: 0.5rem;
        }
        .hero-subtitle {
          font-weight: 300;
          font-size: clamp(1rem, 2vw, 1.15rem);
          color: rgba(255,255,255,0.4);
          margin-top: 2rem;
          max-width: 500px;
          line-height: 1.7;
        }

        /* ── CTA Buttons ── */
        .hero-ctas {
          display: flex;
          gap: 1rem;
          margin-top: 2.5rem;
          flex-wrap: wrap;
          justify-content: center;
        }
        .cta {
          display: inline-block;
          padding: 1rem 2.5rem;
          font-family: 'Bebas Neue', sans-serif;
          font-size: 1.2rem;
          letter-spacing: 0.12em;
          color: #fff;
          background: linear-gradient(135deg, rgba(255,20,147,0.3), rgba(191,0,255,0.3));
          border: 1px solid rgba(255,255,255,0.15);
          border-radius: 50px;
          text-decoration: none;
          transition: all 0.4s cubic-bezier(0.4, 0, 0.2, 1);
          backdrop-filter: blur(10px);
        }
        .cta:hover {
          background: linear-gradient(135deg, rgba(255,20,147,0.5), rgba(191,0,255,0.5));
          border-color: rgba(255,255,255,0.3);
          transform: translateY(-2px);
          box-shadow: 0 10px 40px rgba(255,20,147,0.3);
        }
        .cta.secondary {
          background: transparent;
          border-color: rgba(255,255,255,0.2);
        }
        .cta.secondary:hover {
          background: rgba(255,255,255,0.05);
          border-color: rgba(255,255,255,0.3);
          box-shadow: 0 10px 40px rgba(255,255,255,0.1);
        }

        .scroll-indicator {
          position: absolute;
          bottom: 3rem;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 0.5rem;
          color: rgba(255,255,255,0.3);
          font-size: 0.7rem;
          letter-spacing: 0.2em;
          text-transform: uppercase;
        }
        .scroll-indicator .line {
          width: 1px;
          height: 40px;
          background: linear-gradient(to bottom, rgba(255,255,255,0.3), transparent);
          animation: scroll-pulse 2s ease-in-out infinite;
        }
        @keyframes scroll-pulse {
          0%, 100% { opacity: 0.3; transform: scaleY(1); }
          50% { opacity: 0.6; transform: scaleY(1.2); }
        }

        /* ── Sections Container ── */
        .sections {
          position: relative; z-index: 10;
          max-width: 900px;
          margin: 0 auto;
          padding: 4rem 1.5rem 6rem;
        }

        /* ── Section Headers ── */
        .section-header {
          text-align: center;
          margin-bottom: 3rem;
        }
        .section-label {
          font-size: 0.75rem;
          letter-spacing: 0.3em;
          text-transform: uppercase;
          color: var(--pink);
          margin-bottom: 0.8rem;
          font-weight: 500;
        }
        .section-title {
          font-family: 'Bebas Neue', sans-serif;
          font-size: clamp(2rem, 6vw, 3rem);
          letter-spacing: 0.08em;
          color: #fff;
          margin: 0;
        }
        .section-subtitle {
          font-weight: 300;
          font-size: 1rem;
          color: rgba(255,255,255,0.4);
          margin-top: 0.8rem;
          line-height: 1.6;
        }

        .section-divider {
          height: 1px;
          background: linear-gradient(90deg, transparent, rgba(255,255,255,0.1), transparent);
          margin: 5rem 0;
        }

        /* ── About Section ── */
        .about-content {
          display: grid;
          grid-template-columns: 1fr;
          gap: 2.5rem;
          align-items: center;
        }
        @media (min-width: 640px) {
          .about-content { grid-template-columns: 280px 1fr; }
        }
        .about-image {
          width: 280px;
          height: 280px;
          border-radius: 20px;
          margin: 0 auto;
          background: linear-gradient(135deg, rgba(255,20,147,0.2), rgba(191,0,255,0.2));
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 5rem;
          border: 1px solid rgba(255,255,255,0.1);
          position: relative;
          overflow: hidden;
        }
        .about-image::before {
          content: '';
          position: absolute;
          inset: 0;
          background: linear-gradient(135deg, transparent 40%, rgba(255,20,147,0.1));
        }
        .about-image img {
          width: 100%;
          height: 100%;
          object-fit: cover;
        }
        .about-text {
          text-align: center;
        }
        @media (min-width: 640px) {
          .about-text { text-align: left; }
        }
        .about-text h3 {
          font-family: 'Bebas Neue', sans-serif;
          font-size: 1.8rem;
          letter-spacing: 0.05em;
          color: #fff;
          margin: 0 0 1rem;
        }
        .about-text p {
          font-weight: 300;
          font-size: 1rem;
          color: rgba(255,255,255,0.6);
          line-height: 1.8;
          margin: 0;
        }
        .about-stats {
          display: flex;
          gap: 2rem;
          margin-top: 2rem;
          justify-content: center;
        }
        @media (min-width: 640px) {
          .about-stats { justify-content: flex-start; }
        }
        .stat {
          text-align: center;
        }
        .stat-value {
          font-family: 'Bebas Neue', sans-serif;
          font-size: 2.5rem;
          color: var(--gold);
          line-height: 1;
        }
        .stat-label {
          font-size: 0.75rem;
          color: rgba(255,255,255,0.4);
          text-transform: uppercase;
          letter-spacing: 0.1em;
          margin-top: 0.3rem;
        }

        /* ── Timeline (Shows) ── */
        .timeline-empty {
          text-align: center;
          padding: 3rem 2rem;
          background: rgba(255,255,255,0.02);
          border-radius: 20px;
          border: 1px solid rgba(255,255,255,0.05);
        }
        .timeline-empty p {
          color: rgba(255,255,255,0.4);
          font-weight: 300;
          margin: 0;
        }
        .timeline {
          display: flex;
          flex-direction: column;
          gap: 1rem;
        }
        .timeline-item {
          display: flex;
          align-items: center;
          gap: 1.5rem;
          padding: 1.5rem;
          background: rgba(255,255,255,0.03);
          border-radius: 16px;
          border: 1px solid rgba(255,255,255,0.05);
          transition: all 0.3s;
        }
        .timeline-item:hover {
          background: rgba(255,255,255,0.05);
          border-color: rgba(255,20,147,0.2);
        }
        .timeline-date-box {
          width: 70px;
          text-align: center;
          flex-shrink: 0;
        }
        .timeline-day {
          font-family: 'Bebas Neue', sans-serif;
          font-size: 2.5rem;
          color: var(--gold);
          line-height: 1;
        }
        .timeline-month {
          font-size: 0.75rem;
          color: rgba(255,255,255,0.5);
          letter-spacing: 0.1em;
          text-transform: uppercase;
        }
        .timeline-divider {
          width: 1px;
          height: 40px;
          background: linear-gradient(to bottom, var(--pink), var(--purple));
        }
        .timeline-info { flex: 1; }
        .timeline-title {
          font-size: 1.1rem;
          color: #fff;
          font-weight: 500;
          margin-bottom: 0.3rem;
        }
        .timeline-venue {
          font-size: 0.9rem;
          color: rgba(255,255,255,0.4);
          font-weight: 300;
        }
        .timeline-time {
          color: var(--gold);
        }
        .timeline-tickets {
          font-size: 0.8rem;
          color: var(--cyan);
          margin-top: 0.4rem;
          font-weight: 400;
        }
        .timeline-links {
          display: flex;
          gap: 0.8rem;
          margin-top: 0.5rem;
        }
        .timeline-link {
          font-size: 0.75rem;
          color: rgba(255,255,255,0.5);
          text-decoration: none;
          padding: 0.3rem 0.8rem;
          background: rgba(255,255,255,0.05);
          border-radius: 20px;
          transition: all 0.2s;
        }
        .timeline-link:hover {
          background: rgba(255,255,255,0.1);
          color: #fff;
        }

        /* ── Gallery ── */
        .gallery-empty {
          text-align: center;
          padding: 4rem 2rem;
          background: rgba(255,255,255,0.02);
          border-radius: 20px;
          border: 1px solid rgba(255,255,255,0.05);
        }
        .gallery-empty p {
          color: rgba(255,255,255,0.4);
          font-weight: 300;
          margin: 0;
        }
        .gallery-grid {
          columns: 2;
          column-gap: 1rem;
        }
        @media (min-width: 640px) {
          .gallery-grid { columns: 3; }
        }
        .gallery-item {
          break-inside: avoid;
          margin-bottom: 1rem;
          border-radius: 12px;
          overflow: hidden;
          position: relative;
          cursor: pointer;
        }
        .gallery-item::after {
          content: '';
          position: absolute;
          inset: 0;
          background: linear-gradient(to top, rgba(0,0,0,0.5), transparent);
          opacity: 0;
          transition: opacity 0.3s;
        }
        .gallery-item:hover::after { opacity: 1; }
        .gallery-item img {
          width: 100%;
          display: block;
          transition: transform 0.5s;
        }
        .gallery-item:hover img {
          transform: scale(1.05);
        }

        /* ── FAQ ── */
        .faq-list {
          display: flex;
          flex-direction: column;
          gap: 0.8rem;
        }
        .faq-item {
          background: rgba(255,255,255,0.02);
          border-radius: 16px;
          overflow: hidden;
          border: 1px solid rgba(255,255,255,0.05);
          transition: all 0.3s;
        }
        .faq-item:hover {
          border-color: rgba(255,255,255,0.1);
        }
        .faq-item.expanded {
          background: rgba(255,255,255,0.04);
          border-color: rgba(255,20,147,0.2);
        }
        .faq-header {
          padding: 1.2rem 1.5rem;
          display: flex;
          align-items: center;
          gap: 1rem;
          cursor: pointer;
          user-select: none;
        }
        .faq-category {
          font-size: 0.6rem;
          padding: 0.3rem 0.7rem;
          border-radius: 20px;
          letter-spacing: 0.08em;
          font-weight: 600;
          flex-shrink: 0;
        }
        .faq-question {
          flex: 1;
          color: #fff;
          font-size: 0.95rem;
          font-weight: 400;
        }
        .faq-toggle {
          width: 24px;
          height: 24px;
          border-radius: 50%;
          background: rgba(255,255,255,0.05);
          display: flex;
          align-items: center;
          justify-content: center;
          color: rgba(255,255,255,0.4);
          font-size: 1rem;
          transition: all 0.3s;
          flex-shrink: 0;
        }
        .faq-item.expanded .faq-toggle {
          background: var(--pink);
          color: #fff;
          transform: rotate(45deg);
        }
        .faq-answer {
          max-height: 0;
          overflow: hidden;
          transition: max-height 0.5s cubic-bezier(0.4, 0, 0.2, 1);
        }
        .faq-item.expanded .faq-answer {
          max-height: 500px;
        }
        .faq-answer-inner {
          padding: 0 1.5rem 1.5rem;
          padding-left: calc(1.5rem + 60px);
          color: rgba(255,255,255,0.6);
          font-size: 0.9rem;
          line-height: 1.8;
          font-weight: 300;
          white-space: pre-line;
        }
        .faq-answer-inner .rider-list {
          margin: 0.5rem 0;
          padding-left: 0;
          list-style: none;
        }
        .faq-answer-inner .rider-list li {
          position: relative;
          padding-left: 1.2rem;
          margin-bottom: 0.3rem;
        }
        .faq-answer-inner .rider-list li::before {
          content: '•';
          position: absolute;
          left: 0;
          color: var(--pink);
        }
        .faq-cta-btn {
          display: inline-flex;
          align-items: center;
          gap: 0.5rem;
          margin-top: 1rem;
          padding: 0.6rem 1.2rem;
          background: linear-gradient(135deg, #25D366, #128C7E);
          color: #fff;
          border-radius: 25px;
          text-decoration: none;
          font-size: 0.85rem;
          font-weight: 500;
          transition: all 0.3s;
        }
        .faq-cta-btn:hover {
          transform: scale(1.05);
          box-shadow: 0 5px 20px rgba(37,211,102,0.3);
        }

        /* ── Contact Section ── */
        .contact-section {
          text-align: center;
          padding: 4rem 2rem;
          background: linear-gradient(135deg, rgba(255,20,147,0.05), rgba(191,0,255,0.05));
          border-radius: 24px;
          border: 1px solid rgba(255,255,255,0.05);
          position: relative;
          overflow: hidden;
        }
        .contact-section::before {
          content: '';
          position: absolute;
          top: 0; left: 0; right: 0;
          height: 1px;
          background: linear-gradient(90deg, transparent, var(--pink), var(--gold), var(--cyan), transparent);
        }
        .contact-title {
          font-family: 'Bebas Neue', sans-serif;
          font-size: 2.2rem;
          letter-spacing: 0.08em;
          color: #fff;
          margin: 0 0 0.5rem;
        }
        .contact-subtitle {
          color: rgba(255,255,255,0.5);
          font-size: 1rem;
          font-weight: 300;
          margin-bottom: 2rem;
        }
        .contact-buttons {
          display: flex;
          gap: 1rem;
          justify-content: center;
          flex-wrap: wrap;
        }
        .contact-btn {
          display: inline-flex;
          align-items: center;
          gap: 0.6rem;
          padding: 1rem 2rem;
          border-radius: 50px;
          text-decoration: none;
          font-size: 1rem;
          font-weight: 500;
          transition: all 0.3s;
        }
        .contact-btn.whatsapp {
          background: linear-gradient(135deg, #25D366, #128C7E);
          color: #fff;
        }
        .contact-btn.whatsapp:hover {
          transform: translateY(-2px);
          box-shadow: 0 10px 30px rgba(37,211,102,0.3);
        }
        .contact-btn.instagram {
          background: linear-gradient(135deg, #f09433, #e6683c, #dc2743, #cc2366, #bc1888);
          color: #fff;
        }
        .contact-btn.instagram:hover {
          transform: translateY(-2px);
          box-shadow: 0 10px 30px rgba(225,48,108,0.3);
        }

        /* ── QR Support Card ── */
        .qr-section {
          text-align: center;
          padding: 3rem 2rem;
          background: rgba(255,255,255,0.02);
          border-radius: 24px;
          border: 1px solid rgba(255,255,255,0.05);
          margin-top: 2rem;
        }
        .qr-title {
          font-family: 'Bebas Neue', sans-serif;
          font-size: 1.6rem;
          letter-spacing: 0.05em;
          color: #fff;
          margin: 0 0 0.5rem;
        }
        .qr-subtitle {
          color: rgba(255,255,255,0.4);
          font-size: 0.95rem;
          font-weight: 300;
          margin-bottom: 1.5rem;
        }
        .qr-frame {
          width: 160px;
          height: 160px;
          margin: 0 auto 1.5rem;
          background: #fff;
          border-radius: 16px;
          display: flex;
          align-items: center;
          justify-content: center;
          box-shadow: 0 0 40px rgba(255,20,147,0.15);
          overflow: hidden;
        }
        .qr-frame img {
          width: 100%;
          height: 100%;
          object-fit: contain;
          padding: 0.5rem;
        }
        .qr-thanks {
          color: rgba(255,255,255,0.5);
          font-size: 0.9rem;
          font-weight: 300;
        }
        .qr-thanks strong {
          color: var(--gold);
          font-weight: 500;
        }

        /* ── Footer ── */
        .rg-footer {
          text-align: center;
          padding: 4rem 1.5rem 2rem;
          position: relative;
          z-index: 10;
        }
        .footer-brand {
          font-family: 'Bebas Neue', sans-serif;
          font-size: 1.5rem;
          letter-spacing: 0.15em;
          color: rgba(255,255,255,0.3);
          margin-bottom: 1rem;
        }
        .footer-tagline {
          color: rgba(255,255,255,0.2);
          font-size: 0.8rem;
          letter-spacing: 0.2em;
          text-transform: uppercase;
          font-weight: 300;
        }
        .footer-line {
          width: 60px;
          height: 1px;
          margin: 1.5rem auto 0;
          background: linear-gradient(90deg, transparent, rgba(255,255,255,0.15), transparent);
        }

        @media (max-width: 640px) {
          .about-image { width: 200px; height: 200px; font-size: 3.5rem; }
          .about-stats { gap: 1.5rem; }
          .stat-value { font-size: 2rem; }
          .faq-answer-inner { padding-left: 1.5rem; }
          .contact-section { padding: 3rem 1.5rem; }
        }
      `}</style>

      <div className="rg-page">
        {/* Ambient glows */}
        <div className="ambient-glow pink" />
        <div className="ambient-glow purple" />
        <div className="ambient-glow cyan" />

        {mounted && STARS.map((s, i) => (
          <div key={`s-${i}`} className="star" style={{ left: `${s.left}%`, top: `${s.top}%`, width: s.size, height: s.size, animationDelay: `${s.delay}s` }} />
        ))}
        {mounted && REFLECTIONS.map((r, i) => (
          <div key={`r-${i}`} className="reflection" style={{ left: `${r.left}%`, top: `${r.top}%`, width: r.size, height: r.size, background: r.color, animationDelay: `${r.delay}s`, animationDuration: `${r.duration}s` }} />
        ))}

        {/* Hero */}
        <section className="hero">
          <div className="disco-ball-wrap">
            <div className="disco-string" />
            <div className="disco-ball" />
          </div>
          <h1 className="brand">RETROGROOVE</h1>
          <p className="tagline">Disco • Rock • En Vivo</p>
          <p className="hero-subtitle">
            La experiencia musical que tu evento merece.<br />
            Clásicos del disco, rock y pop que hacen bailar a todos.
          </p>
          <div className="hero-ctas">
            <a href="/band/setlist" className="cta">Ver Repertorio</a>
            <a href="#contacto" className="cta secondary">Solicitar Cotización</a>
          </div>
          <div className="scroll-indicator">
            <div className="line" />
          </div>
        </section>

        <div className="sections">
          {/* About */}
          <section>
            <div className="section-header">
              <div className="section-label">Quiénes Somos</div>
              <h2 className="section-title">La Banda</h2>
            </div>
            <div className="about-content">
              <div className="about-image">
                <img src="/images/band-photo.jpg" alt="RetroGroove - Banda de Covers" />
              </div>
              <div className="about-text">
                <h3>Especialistas en hacer bailar</h3>
                <p>
                  RetroGroove reúne a músicos profesionales con una pasión compartida:
                  revivir los clásicos que marcaron generaciones. Desde los ritmos irresistibles
                  del disco hasta los himnos del rock y pop de los 70s, 80s y 90s,
                  llevamos la energía perfecta a cada escenario.
                </p>
                <div className="about-stats">
                  <div className="stat">
                    <div className="stat-value">100+</div>
                    <div className="stat-label">Shows</div>
                  </div>
                  <div className="stat">
                    <div className="stat-value">5</div>
                    <div className="stat-label">Años</div>
                  </div>
                  <div className="stat">
                    <div className="stat-value">150+</div>
                    <div className="stat-label">Canciones</div>
                  </div>
                </div>
              </div>
            </div>
          </section>

          <div className="section-divider" />

          {/* Shows */}
          <section>
            <div className="section-header">
              <div className="section-label">Agenda</div>
              <h2 className="section-title">Próximos Shows</h2>
              <p className="section-subtitle">Próximas presentaciones confirmadas</p>
            </div>
            {upcomingShows.length > 0 ? (
              <div className="timeline">
                {upcomingShows.map((show, i) => {
                  const { day, month } = formatDate(show.date)
                  return (
                    <div key={i} className="timeline-item">
                      <div className="timeline-date-box">
                        <div className="timeline-day">{day}</div>
                        <div className="timeline-month">{month}</div>
                      </div>
                      <div className="timeline-divider" />
                      <div className="timeline-info">
                        <div className="timeline-title">
                          {show.isPrivate ? 'Evento Privado' : show.title}
                        </div>
                        <div className="timeline-venue">
                          {show.isPrivate ? 'Lima' : show.venue}
                          {show.time && <span className="timeline-time"> · {show.time}</span>}
                        </div>
                        {show.tickets && (
                          <div className="timeline-tickets">{show.tickets}</div>
                        )}
                        {!show.isPrivate && (show.website || show.instagram) && (
                          <div className="timeline-links">
                            {show.website && (
                              <a href={show.website} target="_blank" rel="noopener noreferrer" className="timeline-link">Web</a>
                            )}
                            {show.instagram && (
                              <a href={show.instagram} target="_blank" rel="noopener noreferrer" className="timeline-link">Instagram</a>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            ) : (
              <div className="timeline-empty">
                <p>Estamos coordinando nuevas fechas.<br />Próximamente las anunciaremos.</p>
              </div>
            )}
          </section>

          <div className="section-divider" />

          {/* Gallery */}
          <section>
            <div className="section-header">
              <div className="section-label">En Escena</div>
              <h2 className="section-title">Galería</h2>
              <p className="section-subtitle">Momentos de nuestras presentaciones</p>
            </div>
            {GALLERY_IMAGES.length > 0 ? (
              <div className="gallery-grid">
                {GALLERY_IMAGES.map((img, i) => (
                  <div key={i} className="gallery-item">
                    <img src={img.src} alt={img.alt} />
                  </div>
                ))}
              </div>
            ) : (
              <div className="gallery-empty">
                <p>Pronto compartiremos fotos de nuestros shows.</p>
              </div>
            )}
          </section>

          <div className="section-divider" />

          {/* FAQ */}
          <section>
            <div className="section-header">
              <div className="section-label">Rider Técnico & FAQ</div>
              <h2 className="section-title">Información para tu Evento</h2>
              <p className="section-subtitle">Todo lo que necesitas saber sobre equipamiento, logística y contratación</p>
            </div>
            <div className="faq-list">
              {FAQ_ITEMS.map((item, i) => (
                <div
                  key={i}
                  className={`faq-item ${expandedFaq === i ? 'expanded' : ''}`}
                >
                  <div
                    className="faq-header"
                    onClick={() => setExpandedFaq(expandedFaq === i ? null : i)}
                  >
                    <span
                      className="faq-category"
                      style={{
                        background: `${item.color}15`,
                        color: item.color
                      }}
                    >
                      {item.category}
                    </span>
                    <span className="faq-question">{item.question}</span>
                    <span className="faq-toggle">+</span>
                  </div>
                  <div className="faq-answer">
                    <div className="faq-answer-inner">
                      {item.answer}
                      {item.isCTA && (
                        <a
                          href={`https://wa.me/${WHATSAPP_PRIMARY}?text=Hola, me interesa conocer más sobre RetroGroove para un evento.`}
                          className="faq-cta-btn"
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                            <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
                          </svg>
                          Solicitar cotización
                        </a>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </section>

          <div className="section-divider" />

          {/* Contact */}
          <section id="contacto">
            <div className="contact-section">
              <h2 className="contact-title">Reserva tu Fecha</h2>
              <p className="contact-subtitle">Escríbenos para cotizaciones y disponibilidad</p>
              <div className="contact-buttons">
                <a
                  href={`https://wa.me/${WHATSAPP_PRIMARY}?text=Hola, me interesa contratar a RetroGroove para un evento.`}
                  className="contact-btn whatsapp"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
                  </svg>
                  968 622 293
                </a>
                <a
                  href={`https://wa.me/${WHATSAPP_SECONDARY}?text=Hola, me interesa contratar a RetroGroove para un evento.`}
                  className="contact-btn whatsapp"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
                  </svg>
                  948 189 289
                </a>
                <a
                  href={INSTAGRAM_URL}
                  className="contact-btn instagram"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/>
                  </svg>
                  Instagram
                </a>
              </div>
            </div>

            <div className="qr-section">
              <h3 className="qr-title">¡Apoya a la banda!</h3>
              <p className="qr-subtitle">Escanea con Yape al 968 622 293 y pide tu canción</p>
              <div className="qr-frame">
                <img src="/images/plin-qr.jpg" alt="QR Yape — RetroGroove" />
              </div>
              <p className="qr-thanks">
                Tu apoyo nos ayuda a seguir tocando. <strong>¡Gracias!</strong>
              </p>
            </div>
          </section>
        </div>

        {/* Footer */}
        <footer className="rg-footer">
          <div className="footer-brand">RETROGROOVE</div>
          <div className="footer-tagline">Que no pare la música</div>
          <div className="footer-line" />
        </footer>
      </div>
    </>
  )
}
