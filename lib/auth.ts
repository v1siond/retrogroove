// lib/auth.ts
//
// Band-night "tocada" helpers (which requested songs were played on a given
// date). The old client-side password gate lived here too; it's gone — every
// /band* route now authenticates through the backend JWT via <AdminGate>.

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
