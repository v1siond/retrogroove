export type Bloque = 1 | 2 | 3 | 4 | 'extras'

export interface Song {
  id: string
  title: string
  artist: string
  bloque: Bloque
  youtubePosition: number
  enabled: boolean
}

export interface SongsData {
  songs: Song[]
}

export interface Event {
  date: string
  name: string
  venue?: string
  notes?: string
}

export interface Request {
  songId: string
  opNumber: string
  screenshot?: string
  name?: string
  timestamp: string
}

export interface RequestWithCount {
  song: Song
  count: number
  requests: Request[]
}

export function getBloqueFromPosition(position: number): Bloque {
  if (position <= 14) return 1
  if (position <= 30) return 2
  if (position <= 45) return 3
  if (position <= 60) return 4
  return 'extras'
}

export function getBloqueColor(bloque: Bloque): string {
  switch (bloque) {
    case 1: return '#ff1493' // pink
    case 2: return '#ffd700' // gold
    case 3: return '#00e5ff' // cyan
    case 4: return '#bf00ff' // purple
    case 'extras': return '#888888' // gray
  }
}

export function getBloqueName(bloque: Bloque): string {
  if (bloque === 'extras') return 'Extras'
  return `Bloque ${bloque}`
}
