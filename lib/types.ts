// lib/types.ts

export interface Song {
  id: string
  title: string
  artist: string
  enabled: boolean
}

export interface SongsData {
  songs: Song[]
}

export interface Setlist {
  id: string
  name: string
  songIds: string[]
}

export interface SetlistWithSongs {
  id: string
  name: string
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

const SETLIST_COLORS: Record<string, string> = {
  'bloque-1': '#ff1493',
  'bloque-2': '#ffd700',
  'bloque-3': '#00e5ff',
  'bloque-4': '#bf00ff',
  'extras': '#888888',
}

export function getSetlistColor(id: string): string {
  return SETLIST_COLORS[id] || '#ff1493'
}
