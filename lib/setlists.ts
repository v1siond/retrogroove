import { Setlist, SetlistWithSongs, Song } from './types'
import { musicApi } from './music'

// Setlists (and the songs they reference) come from the RetroGroove API. Fetched
// at runtime from the client, same as lib/songs.ts.

export function getAllSetlists(): Promise<Setlist[]> {
  return musicApi.getSetlists()
}

export async function getSetlistById(id: string): Promise<Setlist | undefined> {
  const setlists = await musicApi.getSetlists()
  return setlists.find(s => s.id === id)
}

function withSongs(setlist: Setlist, songsById: Map<string, Song>): SetlistWithSongs {
  return {
    id: setlist.id,
    name: setlist.name,
    songs: setlist.songIds.map(id => songsById.get(id)).filter((s): s is Song => !!s),
  }
}

export async function getAllSetlistsWithSongs(): Promise<SetlistWithSongs[]> {
  const [setlists, songs] = await Promise.all([musicApi.getSetlists(), musicApi.getSongs()])
  const songsById = new Map(songs.map(s => [s.id, s]))
  return setlists.map(setlist => withSongs(setlist, songsById))
}
