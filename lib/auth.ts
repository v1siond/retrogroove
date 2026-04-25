// lib/auth.ts

import bcrypt from 'bcryptjs'

const STORAGE_KEY = 'retrogroove_band_auth'
const SESSION_DURATION = 24 * 60 * 60 * 1000 // 24 hours

export async function verifyPassword(password: string): Promise<boolean> {
  const hash = process.env.NEXT_PUBLIC_BAND_PASSWORD_HASH
  const devPassword = process.env.NEXT_PUBLIC_BAND_PASSWORD

  // Dev fallback when hash not configured
  if (!hash) {
    if (devPassword) {
      return password === devPassword
    }
    console.error('NEXT_PUBLIC_BAND_PASSWORD_HASH or NEXT_PUBLIC_BAND_PASSWORD not configured')
    return false
  }

  return bcrypt.compare(password, hash)
}

export function setSession(): void {
  if (typeof window === 'undefined') return
  const expires = Date.now() + SESSION_DURATION
  localStorage.setItem(STORAGE_KEY, JSON.stringify({ expires }))
}

export function checkSession(): boolean {
  if (typeof window === 'undefined') return false
  try {
    const data = localStorage.getItem(STORAGE_KEY)
    if (!data) return false
    const { expires } = JSON.parse(data)
    if (Date.now() > expires) {
      localStorage.removeItem(STORAGE_KEY)
      return false
    }
    return true
  } catch {
    return false
  }
}

export function clearSession(): void {
  if (typeof window === 'undefined') return
  localStorage.removeItem(STORAGE_KEY)
}

// "Tocada" state management
const TOCADA_KEY = 'retrogroove_tocada'

export function getTocadaSongs(date: string): Set<string> {
  if (typeof window === 'undefined') return new Set()
  try {
    const data = localStorage.getItem(`${TOCADA_KEY}_${date}`)
    if (!data) return new Set()
    return new Set(JSON.parse(data))
  } catch {
    return new Set()
  }
}

export function setTocada(date: string, songId: string, tocada: boolean): void {
  if (typeof window === 'undefined') return
  const current = getTocadaSongs(date)
  if (tocada) {
    current.add(songId)
  } else {
    current.delete(songId)
  }
  localStorage.setItem(`${TOCADA_KEY}_${date}`, JSON.stringify([...current]))
}
