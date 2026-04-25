'use client'

import { useState, useMemo, useEffect } from 'react'
import { getAllSongs } from '@/lib/songs'
import { Song, Bloque, getBloqueColor, getBloqueName } from '@/lib/types'

type Step = 'guide' | 'select' | 'form' | 'success'

const BAND_PHONE = process.env.NEXT_PUBLIC_BAND_PHONE || '999 888 777'

export default function PedirPage() {
  const [mounted, setMounted] = useState(false)
  const [step, setStep] = useState<Step>('guide')
  const [selectedSong, setSelectedSong] = useState<Song | null>(null)
  const [activeBloque, setActiveBloque] = useState<Bloque>(1)

  const [opNumber, setOpNumber] = useState('')
  const [name, setName] = useState('')
  const [screenshot, setScreenshot] = useState<string>('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    setMounted(true)
  }, [])

  const allSongs = useMemo(() => getAllSongs(), [])

  const enabledSongs = useMemo(() => {
    return allSongs.filter(song => song.enabled)
  }, [allSongs])

  const songsByBloque = useMemo(() => {
    const groups: Partial<Record<Bloque, Song[]>> = {}
    for (const song of enabledSongs) {
      if (!groups[song.bloque]) {
        groups[song.bloque] = []
      }
      groups[song.bloque]!.push(song)
    }
    // Sort each group
    for (const bloque of Object.keys(groups) as Bloque[]) {
      groups[bloque]!.sort((a, b) => a.youtubePosition - b.youtubePosition)
    }
    return groups
  }, [enabledSongs])

  const availableBloques = useMemo(() => {
    return (Object.keys(songsByBloque) as (string | number)[])
      .map(k => (k === 'extras' ? k : Number(k)) as Bloque)
      .sort((a, b) => {
        if (a === 'extras') return 1
        if (b === 'extras') return -1
        return (a as number) - (b as number)
      })
  }, [songsByBloque])

  // Set default active bloque to first available
  useEffect(() => {
    if (availableBloques.length > 0 && !availableBloques.includes(activeBloque)) {
      setActiveBloque(availableBloques[0])
    }
  }, [availableBloques, activeBloque])

  const handleScreenshotChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) {
      setScreenshot('')
      return
    }
    const reader = new FileReader()
    reader.onload = () => {
      setScreenshot(reader.result as string)
    }
    reader.readAsDataURL(file)
  }

  const handleSubmit = async () => {
    if (!opNumber.trim()) {
      setError('Por favor ingresa el numero de operacion')
      return
    }
    if (!selectedSong) {
      setError('Por favor selecciona una cancion')
      return
    }

    setError('')
    setSubmitting(true)

    try {
      const res = await fetch('/api/submit-request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          songId: selectedSong.id,
          opNumber: opNumber.trim(),
          name: name.trim() || undefined,
          screenshot: screenshot || undefined,
        }),
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Error al enviar el pedido')
      }

      setStep('success')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al enviar el pedido')
    } finally {
      setSubmitting(false)
    }
  }

  const handleReset = () => {
    setStep('guide')
    setSelectedSong(null)
    setOpNumber('')
    setName('')
    setScreenshot('')
    setError('')
  }

  if (!mounted) return null

  return (
    <>
      <title>Pedir Cancion - RetroGroove</title>

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;600;700;800;900&family=Bebas+Neue&display=swap');

        .pedir-page {
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
          padding: 1rem;
        }

        .pedir-container {
          max-width: 480px;
          margin: 0 auto;
          padding: 1rem;
        }

        .pedir-header {
          text-align: center;
          margin-bottom: 1.5rem;
        }

        .pedir-brand {
          font-family: 'Bebas Neue', sans-serif;
          font-size: 2rem;
          letter-spacing: 0.1em;
          color: #fff;
          text-shadow: 0 0 7px #fff, 0 0 15px #fff, 0 0 30px var(--pink);
          margin: 0;
          text-decoration: none;
          display: inline-block;
        }

        .pedir-brand:hover {
          text-shadow: 0 0 10px #fff, 0 0 20px #fff, 0 0 40px var(--pink);
        }

        .pedir-title {
          font-family: 'Bebas Neue', sans-serif;
          font-size: 1.5rem;
          letter-spacing: 0.05em;
          color: var(--gold);
          text-shadow: 0 0 15px rgba(255,215,0,0.3);
          margin: 0.5rem 0 0;
        }

        .pedir-card {
          background: rgba(255,255,255,0.04);
          backdrop-filter: blur(16px);
          -webkit-backdrop-filter: blur(16px);
          border-radius: 16px;
          padding: 1.5rem;
          border: 1px solid rgba(255,255,255,0.1);
          margin-bottom: 1rem;
        }

        .guide-step {
          display: flex;
          align-items: flex-start;
          gap: 1rem;
          margin-bottom: 1.2rem;
        }

        .guide-number {
          width: 32px;
          height: 32px;
          background: linear-gradient(135deg, var(--pink), var(--purple));
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          font-family: 'Bebas Neue', sans-serif;
          font-size: 1.1rem;
          flex-shrink: 0;
        }

        .guide-text {
          font-size: 1rem;
          color: rgba(255,255,255,0.8);
          line-height: 1.5;
        }

        .guide-phone {
          font-family: 'Bebas Neue', sans-serif;
          font-size: 1.4rem;
          color: var(--cyan);
          text-shadow: 0 0 10px rgba(0,229,255,0.4);
        }

        .qr-section {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 1rem;
          padding: 1rem 0;
        }

        .qr-frame {
          width: 150px;
          height: 150px;
          background: #fff;
          border-radius: 12px;
          padding: 8px;
          box-shadow: 0 0 20px rgba(255,20,147,0.2), 0 0 40px rgba(191,0,255,0.1);
        }

        .qr-frame img {
          width: 100%;
          height: 100%;
          object-fit: contain;
        }

        .qr-info {
          text-align: center;
        }

        .qr-phone {
          font-family: 'Bebas Neue', sans-serif;
          font-size: 2rem;
          letter-spacing: 0.15em;
          color: var(--cyan);
          text-shadow: 0 0 15px rgba(0,229,255,0.5);
          margin: 0;
        }

        .qr-hint {
          font-size: 0.9rem;
          color: rgba(255,255,255,0.5);
          margin: 0.3rem 0 0;
        }

        .guide-divider {
          height: 1px;
          background: linear-gradient(90deg, transparent, rgba(255,255,255,0.15), transparent);
          margin: 1rem 0 1.2rem;
        }

        .pedir-btn {
          display: block;
          width: 100%;
          padding: 1rem 2rem;
          font-family: 'Bebas Neue', sans-serif;
          font-size: 1.3rem;
          letter-spacing: 0.1em;
          color: #fff;
          background: linear-gradient(135deg, rgba(255,20,147,0.3), rgba(191,0,255,0.3));
          border: 1px solid rgba(255,255,255,0.2);
          border-radius: 40px;
          cursor: pointer;
          transition: all 0.3s;
          box-shadow: 0 0 20px rgba(255,20,147,0.2);
          text-align: center;
          text-decoration: none;
        }

        .pedir-btn:hover:not(:disabled) {
          background: linear-gradient(135deg, rgba(255,20,147,0.5), rgba(191,0,255,0.5));
          transform: translateY(-2px);
          box-shadow: 0 0 30px rgba(255,20,147,0.4);
        }

        .pedir-btn:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        .back-link {
          display: block;
          text-align: center;
          color: rgba(255,255,255,0.4);
          font-size: 0.9rem;
          margin-top: 1rem;
          cursor: pointer;
          transition: color 0.3s;
        }

        .back-link:hover {
          color: rgba(255,255,255,0.7);
        }

        /* Song Selection */
        .bloque-tabs {
          display: flex;
          flex-wrap: wrap;
          gap: 0.5rem;
          margin-bottom: 1rem;
        }

        .bloque-tab {
          padding: 0.5rem 1rem;
          font-family: 'Bebas Neue', sans-serif;
          font-size: 1rem;
          letter-spacing: 0.05em;
          background: rgba(255,255,255,0.05);
          border: 1px solid rgba(255,255,255,0.1);
          border-radius: 20px;
          cursor: pointer;
          transition: all 0.3s;
          color: rgba(255,255,255,0.6);
        }

        .bloque-tab:hover {
          background: rgba(255,255,255,0.1);
        }

        .bloque-tab.active {
          color: #fff;
          border-color: currentColor;
        }

        .song-list {
          max-height: 350px;
          overflow-y: auto;
          margin-bottom: 1rem;
        }

        .song-item {
          padding: 0.75rem 1rem;
          background: rgba(255,255,255,0.03);
          border: 1px solid rgba(255,255,255,0.08);
          border-radius: 10px;
          margin-bottom: 0.5rem;
          cursor: pointer;
          transition: all 0.3s;
        }

        .song-item:hover {
          background: rgba(255,255,255,0.08);
          border-color: rgba(255,255,255,0.15);
        }

        .song-item.selected {
          background: rgba(255,20,147,0.15);
          border-color: var(--pink);
        }

        .song-title {
          font-weight: 600;
          font-size: 1rem;
          color: #fff;
          margin-bottom: 0.2rem;
        }

        .song-artist {
          font-size: 0.85rem;
          color: rgba(255,255,255,0.5);
        }

        .selected-song-preview {
          background: rgba(255,20,147,0.1);
          border: 1px solid var(--pink);
          border-radius: 12px;
          padding: 1rem;
          margin-bottom: 1rem;
          text-align: center;
        }

        .selected-song-label {
          font-size: 0.75rem;
          text-transform: uppercase;
          letter-spacing: 0.1em;
          color: var(--pink);
          margin-bottom: 0.3rem;
        }

        .selected-song-title {
          font-weight: 700;
          font-size: 1.1rem;
        }

        .selected-song-artist {
          font-size: 0.9rem;
          color: rgba(255,255,255,0.6);
        }

        /* Form */
        .form-group {
          margin-bottom: 1.2rem;
        }

        .form-label {
          display: block;
          font-size: 0.9rem;
          color: rgba(255,255,255,0.7);
          margin-bottom: 0.5rem;
        }

        .form-label .required {
          color: var(--pink);
        }

        .form-input {
          width: 100%;
          padding: 0.8rem 1rem;
          font-family: 'Outfit', sans-serif;
          font-size: 1rem;
          color: #fff;
          background: rgba(255,255,255,0.05);
          border: 1px solid rgba(255,255,255,0.15);
          border-radius: 10px;
          outline: none;
          transition: border-color 0.3s;
          box-sizing: border-box;
        }

        .form-input:focus {
          border-color: var(--cyan);
        }

        .form-input::placeholder {
          color: rgba(255,255,255,0.3);
        }

        .form-hint {
          font-size: 0.8rem;
          color: rgba(255,255,255,0.4);
          margin-top: 0.3rem;
        }

        .screenshot-preview {
          margin-top: 0.5rem;
          max-width: 150px;
          border-radius: 8px;
          border: 1px solid rgba(255,255,255,0.1);
        }

        .error-msg {
          background: rgba(255,50,50,0.2);
          border: 1px solid rgba(255,50,50,0.4);
          border-radius: 8px;
          padding: 0.8rem 1rem;
          color: #ff6b6b;
          font-size: 0.9rem;
          margin-bottom: 1rem;
        }

        /* Success */
        .success-icon {
          font-size: 4rem;
          text-align: center;
          margin-bottom: 1rem;
        }

        .success-title {
          font-family: 'Bebas Neue', sans-serif;
          font-size: 1.8rem;
          letter-spacing: 0.05em;
          color: var(--cyan);
          text-shadow: 0 0 20px rgba(0,229,255,0.4);
          text-align: center;
          margin-bottom: 0.5rem;
        }

        .success-text {
          text-align: center;
          color: rgba(255,255,255,0.7);
          font-size: 1rem;
          line-height: 1.6;
        }

        /* Scrollbar */
        .song-list::-webkit-scrollbar {
          width: 6px;
        }
        .song-list::-webkit-scrollbar-track {
          background: rgba(255,255,255,0.05);
          border-radius: 3px;
        }
        .song-list::-webkit-scrollbar-thumb {
          background: rgba(255,255,255,0.15);
          border-radius: 3px;
        }
        .song-list::-webkit-scrollbar-thumb:hover {
          background: rgba(255,255,255,0.25);
        }
      `}</style>

      <div className="pedir-page">
        <div className="pedir-container">
          <header className="pedir-header">
            <a href="/" className="pedir-brand">RETROGROOVE</a>
            <h1 className="pedir-title">Pide tu Cancion</h1>
          </header>

          {/* Step: Guide */}
          {step === 'guide' && (
            <div className="pedir-card">
              <div className="qr-section">
                <div className="qr-frame">
                  <img src="/images/plin-qr.jpg" alt="QR Plin/Yape" />
                </div>
                <div className="qr-info">
                  <p className="qr-phone">{BAND_PHONE}</p>
                  <p className="qr-hint">Escanea o yapea al numero</p>
                </div>
              </div>
              <div className="guide-divider"></div>
              <div className="guide-step">
                <div className="guide-number">1</div>
                <div className="guide-text">
                  Escanea el QR o yapea al numero de arriba
                </div>
              </div>
              <div className="guide-step">
                <div className="guide-number">2</div>
                <div className="guide-text">
                  Guarda el <strong>numero de operacion</strong> (lo vas a necesitar)
                </div>
              </div>
              <div className="guide-step">
                <div className="guide-number">3</div>
                <div className="guide-text">
                  Elige tu cancion y envianos el pedido
                </div>
              </div>
              <button className="pedir-btn" onClick={() => setStep('select')}>
                Ya yapie, quiero pedir
              </button>
              <a href="/" className="back-link">Volver al inicio</a>
            </div>
          )}

          {/* Step: Select Song */}
          {step === 'select' && (
            <div className="pedir-card">
              <div className="bloque-tabs">
                {availableBloques.map(bloque => (
                  <button
                    key={bloque}
                    className={`bloque-tab ${activeBloque === bloque ? 'active' : ''}`}
                    style={{
                      borderColor: activeBloque === bloque ? getBloqueColor(bloque) : undefined,
                      color: activeBloque === bloque ? getBloqueColor(bloque) : undefined,
                    }}
                    onClick={() => setActiveBloque(bloque)}
                  >
                    {getBloqueName(bloque)}
                  </button>
                ))}
              </div>

              <div className="song-list">
                {songsByBloque[activeBloque]?.map(song => (
                  <div
                    key={song.id}
                    className={`song-item ${selectedSong?.id === song.id ? 'selected' : ''}`}
                    onClick={() => setSelectedSong(song)}
                  >
                    <div className="song-title">{song.title}</div>
                    <div className="song-artist">{song.artist}</div>
                  </div>
                ))}
              </div>

              {selectedSong && (
                <div className="selected-song-preview">
                  <div className="selected-song-label">Cancion seleccionada</div>
                  <div className="selected-song-title">{selectedSong.title}</div>
                  <div className="selected-song-artist">{selectedSong.artist}</div>
                </div>
              )}

              <button
                className="pedir-btn"
                disabled={!selectedSong}
                onClick={() => setStep('form')}
              >
                Continuar
              </button>
              <span className="back-link" onClick={() => setStep('guide')}>
                Volver
              </span>
            </div>
          )}

          {/* Step: Form */}
          {step === 'form' && selectedSong && (
            <div className="pedir-card">
              <div className="selected-song-preview">
                <div className="selected-song-label">Tu pedido</div>
                <div className="selected-song-title">{selectedSong.title}</div>
                <div className="selected-song-artist">{selectedSong.artist}</div>
              </div>

              {error && <div className="error-msg">{error}</div>}

              <div className="form-group">
                <label className="form-label">
                  Numero de operacion Yape <span className="required">*</span>
                </label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="Ej: 123456789"
                  value={opNumber}
                  onChange={e => setOpNumber(e.target.value)}
                />
              </div>

              <div className="form-group">
                <label className="form-label">Tu nombre (opcional)</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="Como quieres que te mencionemos?"
                  value={name}
                  onChange={e => setName(e.target.value)}
                />
              </div>

              <div className="form-group">
                <label className="form-label">Captura del Yape (opcional)</label>
                <input
                  type="file"
                  accept="image/*"
                  className="form-input"
                  onChange={handleScreenshotChange}
                />
                <div className="form-hint">Sube una captura para verificar mas rapido</div>
                {screenshot && (
                  <img src={screenshot} alt="Preview" className="screenshot-preview" />
                )}
              </div>

              <button
                className="pedir-btn"
                disabled={submitting}
                onClick={handleSubmit}
              >
                {submitting ? 'Enviando...' : 'Enviar Pedido'}
              </button>
              <span className="back-link" onClick={() => setStep('select')}>
                Cambiar cancion
              </span>
            </div>
          )}

          {/* Step: Success */}
          {step === 'success' && (
            <div className="pedir-card">
              <div className="success-icon">*</div>
              <h2 className="success-title">Pedido Enviado!</h2>
              <p className="success-text">
                Gracias por tu pedido. Lo revisaremos y si todo esta bien,
                tu cancion sonara pronto!
              </p>
              <button className="pedir-btn" onClick={handleReset}>
                Pedir otra cancion
              </button>
              <a href="/" className="back-link">Volver al inicio</a>
            </div>
          )}
        </div>
      </div>
    </>
  )
}
