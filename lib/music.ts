import { Song, Setlist } from './types'

// Songs and setlists are served by the RetroGroove API (retrogroove_api) so the
// band can edit the repertoire without redeploying the site. Mirrors the
// lib/ticketing/api.ts request pattern.

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api'

export class ApiError extends Error {
  constructor(public status: number, public data: unknown) {
    super(`API error ${status}`)
  }
}

async function request<T>(path: string): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { 'Content-Type': 'application/json' },
  })

  if (!res.ok) {
    const data = await res.json().catch(() => ({}))
    throw new ApiError(res.status, data)
  }

  return res.json()
}

// The API returns setlists with snake_case song_ids; the rest of the site uses
// the camelCase Setlist type, so we map at the boundary.
interface ApiSetlist {
  id: string
  name: string
  song_ids: string[]
}

// Songs are cached after the first fetch so the legacy requests flow
// (lib/requests.ts) can resolve a song id synchronously without re-fetching.
let songCache: Map<string, Song> | null = null

export const musicApi = {
  async getSongs(): Promise<Song[]> {
    const { songs } = await request<{ songs: Song[] }>('/songs')
    songCache = new Map(songs.map(s => [s.id, s]))
    return songs
  },

  // Synchronous lookup against the cache populated by getSongs(). Returns
  // undefined until songs have been fetched at least once.
  getCachedSong(id: string): Song | undefined {
    return songCache?.get(id)
  },

  async getSetlists(): Promise<Setlist[]> {
    const { setlists } = await request<{ setlists: ApiSetlist[] }>('/setlists')
    return setlists.map(s => ({ id: s.id, name: s.name, songIds: s.song_ids }))
  },
}
