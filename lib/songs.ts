import { Song } from './types'
import { musicApi } from './music'

// Songs now live in the RetroGroove API. These helpers fetch at runtime from the
// client (the site is a static export, so there's no build-time data source).

// Warm the song cache as soon as this module loads in the browser so the legacy
// requests dashboard (which looks songs up synchronously via getSongById) has
// data ready by the time it renders. Client-only — never runs during the static
// build/SSR (where there's no API to reach).
if (typeof window !== 'undefined') {
  void musicApi.getSongs().catch(() => {})
}

export function getAllSongs(): Promise<Song[]> {
  return musicApi.getSongs()
}

export async function getEnabledSongs(): Promise<Song[]> {
  const songs = await musicApi.getSongs()
  return songs.filter(song => song.enabled)
}

// Synchronous lookup backed by the song cache (warmed by getAllSongs). Kept sync
// so the legacy requests aggregation in lib/requests.ts works without changes.
export function getSongById(id: string): Song | undefined {
  return musicApi.getCachedSong(id)
}

export async function getSongsByIds(ids: string[]): Promise<Song[]> {
  const songs = await musicApi.getSongs()
  const byId = new Map(songs.map(s => [s.id, s]))
  return ids.map(id => byId.get(id)).filter((s): s is Song => s !== undefined)
}
