'use client'

import { useState, useEffect, useCallback } from 'react'
import { checkSession, setSession, verifyPassword, getTocadaSongs, setTocada } from '@/lib/auth'
import { aggregateRequests, formatDate, formatDisplayDate, getRequestsForDate } from '@/lib/requests'
import { Request, RequestWithCount } from '@/lib/types'

export default function BandDashboard() {
  const [mounted, setMounted] = useState(false)
  const [authenticated, setAuthenticated] = useState(false)
  const [password, setPassword] = useState('')
  const [authError, setAuthError] = useState('')
  const [verifying, setVerifying] = useState(false)

  const [selectedDate, setSelectedDate] = useState(() => formatDate(new Date()))
  const [requests, setRequests] = useState<Request[]>([])
  const [loading, setLoading] = useState(false)
  const [tocadaSongs, setTocadaSongs] = useState<Set<string>>(new Set())

  useEffect(() => {
    setMounted(true)
    if (checkSession()) {
      setAuthenticated(true)
    }
  }, [])

  const fetchRequests = useCallback(async (date: string) => {
    setLoading(true)
    try {
      const data = await getRequestsForDate(date)
      setRequests(data)
      setTocadaSongs(getTocadaSongs(date))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (authenticated) {
      fetchRequests(selectedDate)
    }
  }, [authenticated, selectedDate, fetchRequests])

  const handleLogin = async () => {
    if (!password.trim()) {
      setAuthError('Ingresa la contrasena')
      return
    }

    setVerifying(true)
    setAuthError('')

    try {
      const valid = await verifyPassword(password)
      if (valid) {
        setSession()
        setAuthenticated(true)
      } else {
        setAuthError('Contrasena incorrecta')
      }
    } catch {
      setAuthError('Error al verificar')
    } finally {
      setVerifying(false)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleLogin()
    }
  }

  const handleToggleTocada = (songId: string) => {
    const isTocada = tocadaSongs.has(songId)
    setTocada(selectedDate, songId, !isTocada)
    setTocadaSongs(getTocadaSongs(selectedDate))
  }

  const aggregated = aggregateRequests(requests)
  const totalRequests = requests.length
  const uniqueSongs = aggregated.length
  const songsPlayed = aggregated.filter(r => tocadaSongs.has(r.song.id)).length

  if (!mounted) return null

  return (
    <>
      <title>Band Dashboard - RetroGroove</title>

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;600;700;800;900&family=Bebas+Neue&display=swap');

        .band-page {
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

        .band-container {
          max-width: 600px;
          margin: 0 auto;
          padding: 1rem;
        }

        .band-header {
          text-align: center;
          margin-bottom: 1.5rem;
        }

        .band-brand {
          font-family: 'Bebas Neue', sans-serif;
          font-size: 2rem;
          letter-spacing: 0.1em;
          color: #fff;
          text-shadow: 0 0 7px #fff, 0 0 15px #fff, 0 0 30px var(--pink);
          margin: 0;
          text-decoration: none;
          display: inline-block;
        }

        .band-brand:hover {
          text-shadow: 0 0 10px #fff, 0 0 20px #fff, 0 0 40px var(--pink);
        }

        .band-title {
          font-family: 'Bebas Neue', sans-serif;
          font-size: 1.5rem;
          letter-spacing: 0.05em;
          color: var(--gold);
          text-shadow: 0 0 15px rgba(255,215,0,0.3);
          margin: 0.5rem 0 0;
        }

        .band-card {
          background: rgba(255,255,255,0.04);
          backdrop-filter: blur(16px);
          -webkit-backdrop-filter: blur(16px);
          border-radius: 16px;
          padding: 1.5rem;
          border: 1px solid rgba(255,255,255,0.1);
          margin-bottom: 1rem;
        }

        .form-group {
          margin-bottom: 1.2rem;
        }

        .form-label {
          display: block;
          font-size: 0.9rem;
          color: rgba(255,255,255,0.7);
          margin-bottom: 0.5rem;
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

        .band-btn {
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

        .band-btn:hover:not(:disabled) {
          background: linear-gradient(135deg, rgba(255,20,147,0.5), rgba(191,0,255,0.5));
          transform: translateY(-2px);
          box-shadow: 0 0 30px rgba(255,20,147,0.4);
        }

        .band-btn:disabled {
          opacity: 0.5;
          cursor: not-allowed;
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

        .date-picker-row {
          display: flex;
          align-items: center;
          gap: 1rem;
          margin-bottom: 1rem;
        }

        .date-input {
          flex: 1;
          padding: 0.6rem 1rem;
          font-family: 'Outfit', sans-serif;
          font-size: 1rem;
          color: #fff;
          background: rgba(255,255,255,0.05);
          border: 1px solid rgba(255,255,255,0.15);
          border-radius: 10px;
          outline: none;
        }

        .date-input:focus {
          border-color: var(--cyan);
        }

        .date-input::-webkit-calendar-picker-indicator {
          filter: invert(1);
        }

        .display-date {
          font-size: 1.1rem;
          color: var(--cyan);
          text-transform: capitalize;
        }

        .stats-row {
          display: flex;
          justify-content: space-around;
          gap: 1rem;
          margin-bottom: 1.5rem;
          flex-wrap: wrap;
        }

        .stat-item {
          text-align: center;
        }

        .stat-value {
          font-family: 'Bebas Neue', sans-serif;
          font-size: 2rem;
          color: var(--gold);
          text-shadow: 0 0 10px rgba(255,215,0,0.3);
        }

        .stat-label {
          font-size: 0.8rem;
          color: rgba(255,255,255,0.5);
          text-transform: uppercase;
          letter-spacing: 0.05em;
        }

        .request-list {
          display: flex;
          flex-direction: column;
          gap: 0.75rem;
        }

        .request-item {
          display: flex;
          align-items: center;
          gap: 1rem;
          padding: 0.75rem 1rem;
          background: rgba(255,255,255,0.03);
          border: 1px solid rgba(255,255,255,0.08);
          border-radius: 10px;
          transition: all 0.3s;
        }

        .request-item.tocada {
          opacity: 0.4;
        }

        .request-item.tocada .request-title,
        .request-item.tocada .request-artist {
          text-decoration: line-through;
        }

        .request-info {
          flex: 1;
          min-width: 0;
        }

        .request-title {
          font-weight: 600;
          font-size: 1rem;
          color: #fff;
          margin-bottom: 0.2rem;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .request-artist {
          font-size: 0.85rem;
          color: rgba(255,255,255,0.5);
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .count-badge {
          background: var(--pink);
          color: #fff;
          font-family: 'Bebas Neue', sans-serif;
          font-size: 1.2rem;
          padding: 0.3rem 0.6rem;
          border-radius: 8px;
          min-width: 2rem;
          text-align: center;
          flex-shrink: 0;
        }

        .tocada-btn {
          padding: 0.5rem 1rem;
          font-family: 'Bebas Neue', sans-serif;
          font-size: 0.9rem;
          letter-spacing: 0.05em;
          background: rgba(255,255,255,0.1);
          border: 1px solid rgba(255,255,255,0.2);
          border-radius: 20px;
          color: rgba(255,255,255,0.7);
          cursor: pointer;
          transition: all 0.3s;
          flex-shrink: 0;
        }

        .tocada-btn:hover {
          background: rgba(255,255,255,0.2);
        }

        .tocada-btn.active {
          background: var(--cyan);
          border-color: var(--cyan);
          color: #000;
        }

        .empty-state {
          text-align: center;
          padding: 2rem;
          color: rgba(255,255,255,0.5);
        }

        .empty-state-icon {
          font-size: 2.5rem;
          margin-bottom: 0.5rem;
        }

        .loading-state {
          text-align: center;
          padding: 2rem;
          color: rgba(255,255,255,0.6);
        }

        .back-link {
          display: block;
          text-align: center;
          color: rgba(255,255,255,0.4);
          font-size: 0.9rem;
          margin-top: 1rem;
          cursor: pointer;
          transition: color 0.3s;
          text-decoration: none;
        }

        .back-link:hover {
          color: rgba(255,255,255,0.7);
        }
      `}</style>

      <div className="band-page">
        <div className="band-container">
          <header className="band-header">
            <a href="/" className="band-brand">RETROGROOVE</a>
            <h1 className="band-title">Band Dashboard</h1>
          </header>

          {!authenticated ? (
            <div className="band-card">
              {authError && <div className="error-msg">{authError}</div>}

              <div className="form-group">
                <label className="form-label">Contrasena de la banda</label>
                <input
                  type="password"
                  className="form-input"
                  placeholder="Ingresa la contrasena"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  onKeyDown={handleKeyDown}
                  autoFocus
                />
              </div>

              <button
                className="band-btn"
                onClick={handleLogin}
                disabled={verifying}
              >
                {verifying ? 'Verificando...' : 'Entrar'}
              </button>

              <a href="/" className="back-link">Volver al inicio</a>
            </div>
          ) : (
            <>
              <div className="band-card">
                <div className="date-picker-row">
                  <input
                    type="date"
                    className="date-input"
                    value={selectedDate}
                    onChange={e => setSelectedDate(e.target.value)}
                  />
                </div>
                <div className="display-date">{formatDisplayDate(selectedDate)}</div>
              </div>

              <div className="stats-row">
                <div className="stat-item">
                  <div className="stat-value">{totalRequests}</div>
                  <div className="stat-label">Total Pedidos</div>
                </div>
                <div className="stat-item">
                  <div className="stat-value">{uniqueSongs}</div>
                  <div className="stat-label">Canciones</div>
                </div>
                <div className="stat-item">
                  <div className="stat-value">{songsPlayed}</div>
                  <div className="stat-label">Tocadas</div>
                </div>
              </div>

              <div className="band-card">
                {loading ? (
                  <div className="loading-state">Cargando pedidos...</div>
                ) : aggregated.length === 0 ? (
                  <div className="empty-state">
                    <div className="empty-state-icon">~</div>
                    <div>No hay pedidos para esta fecha</div>
                  </div>
                ) : (
                  <div className="request-list">
                    {aggregated.map(item => {
                      const isTocada = tocadaSongs.has(item.song.id)
                      return (
                        <div
                          key={item.song.id}
                          className={`request-item ${isTocada ? 'tocada' : ''}`}
                        >
                          <div className="request-info">
                            <div className="request-title">{item.song.title}</div>
                            <div className="request-artist">{item.song.artist}</div>
                          </div>
                          <div className="count-badge">{item.count}</div>
                          <button
                            className={`tocada-btn ${isTocada ? 'active' : ''}`}
                            onClick={() => handleToggleTocada(item.song.id)}
                          >
                            {isTocada ? 'Tocada' : 'Tocar'}
                          </button>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>

              <a href="/" className="back-link">Volver al inicio</a>
            </>
          )}
        </div>
      </div>
    </>
  )
}
