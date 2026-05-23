'use client'

import { useState, useMemo, useEffect } from 'react'
import { getAllSongs } from '@/lib/songs'
import { Song } from '@/lib/types'

type Step = 'guide' | 'select' | 'form' | 'success'

const BAND_PHONE = '969 622 293'

export default function PedirPage() {
  const [mounted, setMounted] = useState(false)
  const [step, setStep] = useState<Step>('guide')
  const [selectedSong, setSelectedSong] = useState<Song | null>(null)
  const [searchQuery, setSearchQuery] = useState('')

  const [opNumber, setOpNumber] = useState('')
  const [name, setName] = useState('')
  const [screenshot, setScreenshot] = useState<string>('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => { setMounted(true) }, [])

  const allSongs = useMemo(() => getAllSongs().filter(s => s.enabled).sort((a, b) => a.title.localeCompare(b.title)), [])

  const filteredSongs = useMemo(() => {
    if (!searchQuery.trim()) return allSongs
    const q = searchQuery.toLowerCase()
    return allSongs.filter(s => s.title.toLowerCase().includes(q) || s.artist.toLowerCase().includes(q))
  }, [allSongs, searchQuery])

  const handleScreenshotChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) { setScreenshot(''); return }
    const reader = new FileReader()
    reader.onload = () => setScreenshot(reader.result as string)
    reader.readAsDataURL(file)
  }

  const handleSubmit = async () => {
    if (!opNumber.trim()) { setError('Por favor ingresa el numero de operacion'); return }
    if (!selectedSong) { setError('Por favor selecciona una cancion'); return }
    setError('')
    setSubmitting(true)
    try {
      const res = await fetch('/api/submit-request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ songId: selectedSong.id, opNumber: opNumber.trim(), name: name.trim() || undefined, screenshot: screenshot || undefined }),
      })
      if (!res.ok) throw new Error('Error al enviar')
      setStep('success')
    } catch { setError('Error al enviar el pedido') }
    finally { setSubmitting(false) }
  }

  const handleReset = () => {
    setStep('guide'); setSelectedSong(null); setOpNumber(''); setName(''); setScreenshot(''); setError(''); setSearchQuery('')
  }

  if (!mounted) return null

  return (
    <>
      <title>Pedir Cancion - RetroGroove</title>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;600;700&family=Bebas+Neue&display=swap');
        .pedir-page { --pink: #ff1493; --gold: #ffd700; --cyan: #00e5ff; --purple: #bf00ff; min-height: 100vh; background: linear-gradient(180deg, #050010 0%, #0d0025 50%, #050010 100%); color: #fff; font-family: 'Outfit', sans-serif; padding: 1rem; }
        .container { max-width: 480px; margin: 0 auto; }
        .header { text-align: center; margin-bottom: 1.5rem; }
        .header h1 { font-family: 'Bebas Neue', sans-serif; font-size: 2rem; letter-spacing: 0.1em; color: #fff; text-shadow: 0 0 20px var(--pink); margin: 0; }
        .header p { color: var(--gold); margin: 0.3rem 0 0; }
        .card { background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.1); border-radius: 16px; padding: 1.5rem; margin-bottom: 1rem; }
        .qr-section { text-align: center; margin-bottom: 1rem; }
        .qr-frame { width: 120px; height: 120px; background: #fff; border-radius: 12px; padding: 8px; margin: 0 auto 0.5rem; }
        .qr-frame img { width: 100%; height: 100%; object-fit: contain; }
        .phone { font-family: 'Bebas Neue', sans-serif; font-size: 1.8rem; letter-spacing: 0.1em; color: var(--cyan); }
        .guide-step { display: flex; gap: 1rem; margin-bottom: 1rem; align-items: flex-start; }
        .guide-num { width: 28px; height: 28px; background: var(--pink); border-radius: 50%; display: flex; align-items: center; justify-content: center; font-weight: 700; font-size: 0.9rem; flex-shrink: 0; }
        .guide-text { color: rgba(255,255,255,0.8); font-size: 0.95rem; }
        .btn { display: block; width: 100%; padding: 0.9rem; background: linear-gradient(135deg, var(--pink), var(--purple)); border: none; border-radius: 10px; color: #fff; font-family: 'Bebas Neue', sans-serif; font-size: 1.2rem; letter-spacing: 0.05em; cursor: pointer; }
        .btn:hover { opacity: 0.9; }
        .btn:disabled { opacity: 0.5; cursor: not-allowed; }
        .back { display: block; text-align: center; color: rgba(255,255,255,0.5); font-size: 0.9rem; margin-top: 1rem; cursor: pointer; }
        .back:hover { color: var(--gold); }
        .search { width: 100%; padding: 0.8rem 1rem; background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); border-radius: 8px; color: #fff; font-size: 1rem; margin-bottom: 1rem; box-sizing: border-box; }
        .search::placeholder { color: rgba(255,255,255,0.3); }
        .song-list { max-height: 350px; overflow-y: auto; }
        .song-item { padding: 0.7rem 1rem; background: rgba(255,255,255,0.03); border: 1px solid transparent; border-radius: 8px; margin-bottom: 0.4rem; cursor: pointer; }
        .song-item:hover { background: rgba(255,255,255,0.08); }
        .song-item.selected { border-color: var(--gold); background: rgba(255,215,0,0.1); }
        .song-item .title { font-weight: 500; color: #fff; }
        .song-item .artist { font-size: 0.85rem; color: rgba(255,255,255,0.5); }
        .selected-preview { background: rgba(255,215,0,0.1); border: 1px solid var(--gold); border-radius: 10px; padding: 1rem; margin-bottom: 1rem; text-align: center; }
        .selected-preview .title { color: var(--gold); font-weight: 600; }
        .form-group { margin-bottom: 1rem; }
        .form-group label { display: block; color: rgba(255,255,255,0.7); font-size: 0.9rem; margin-bottom: 0.4rem; }
        .form-group input { width: 100%; padding: 0.8rem 1rem; background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); border-radius: 8px; color: #fff; font-size: 1rem; box-sizing: border-box; }
        .error { background: rgba(255,0,0,0.1); border: 1px solid rgba(255,0,0,0.3); border-radius: 8px; padding: 0.8rem; color: #ff6b6b; margin-bottom: 1rem; }
        .success-icon { font-size: 4rem; text-align: center; }
        .success-text { text-align: center; }
        .success-text h2 { color: var(--cyan); font-family: 'Bebas Neue', sans-serif; font-size: 1.8rem; }
      `}</style>

      <div className="pedir-page">
        <div className="container">
          <div className="header">
            <h1>RETROGROOVE</h1>
            <p>¡Pide tu canción!</p>
          </div>

          {step === 'guide' && (
            <div className="card">
              <div className="qr-section">
                <div className="qr-frame"><img src="/images/plin-qr.jpg" alt="QR" /></div>
                <div className="phone">{BAND_PHONE}</div>
              </div>
              <div className="guide-step"><div className="guide-num">1</div><div className="guide-text">Escanea el QR o yapea al número</div></div>
              <div className="guide-step"><div className="guide-num">2</div><div className="guide-text">Guarda el <strong>número de operación</strong></div></div>
              <div className="guide-step"><div className="guide-num">3</div><div className="guide-text">Elige tu canción y envía el pedido</div></div>
              <button className="btn" onClick={() => setStep('select')}>Ya yapié, quiero pedir</button>
              <a href="/" className="back">Volver al inicio</a>
            </div>
          )}

          {step === 'select' && (
            <div className="card">
              <input type="text" className="search" placeholder="Buscar canción o artista..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} />
              <div className="song-list">
                {filteredSongs.map(song => (
                  <div key={song.id} className={`song-item ${selectedSong?.id === song.id ? 'selected' : ''}`} onClick={() => setSelectedSong(song)}>
                    <div className="title">{song.title}</div>
                    <div className="artist">{song.artist}</div>
                  </div>
                ))}
              </div>
              <button className="btn" disabled={!selectedSong} onClick={() => setStep('form')}>Continuar</button>
              <span className="back" onClick={() => setStep('guide')}>Volver</span>
            </div>
          )}

          {step === 'form' && selectedSong && (
            <div className="card">
              <div className="selected-preview">
                <div className="title">{selectedSong.title}</div>
                <div className="artist">{selectedSong.artist}</div>
              </div>
              {error && <div className="error">{error}</div>}
              <div className="form-group">
                <label>Número de operación Yape *</label>
                <input type="text" placeholder="Ej: 123456789" value={opNumber} onChange={e => setOpNumber(e.target.value)} />
              </div>
              <div className="form-group">
                <label>Tu nombre (opcional)</label>
                <input type="text" placeholder="¿Cómo te llamas?" value={name} onChange={e => setName(e.target.value)} />
              </div>
              <div className="form-group">
                <label>Captura del Yape (opcional)</label>
                <input type="file" accept="image/*" onChange={handleScreenshotChange} />
              </div>
              <button className="btn" disabled={submitting} onClick={handleSubmit}>{submitting ? 'Enviando...' : 'Enviar Pedido'}</button>
              <span className="back" onClick={() => setStep('select')}>Cambiar canción</span>
            </div>
          )}

          {step === 'success' && (
            <div className="card">
              <div className="success-icon">🎉</div>
              <div className="success-text">
                <h2>¡Pedido enviado!</h2>
                <p>Gracias por tu aporte. La banda revisará tu pedido.</p>
              </div>
              <button className="btn" onClick={handleReset}>Pedir otra canción</button>
              <a href="/" className="back">Volver al inicio</a>
            </div>
          )}
        </div>
      </div>
    </>
  )
}
