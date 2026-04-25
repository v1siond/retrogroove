import songsData from '@/content/songs.json'
import { Song, SongsData, Bloque } from './types'

const data = songsData as SongsData

export function getAllSongs(): Song[] {
  return data.songs
}

export function getEnabledSongs(): Song[] {
  return data.songs.filter(song => song.enabled)
}

export function getSongById(id: string): Song | undefined {
  return data.songs.find(song => song.id === id)
}

export function getSongsByBloque(bloque: Bloque): Song[] {
  return data.songs
    .filter(song => song.bloque === bloque)
    .sort((a, b) => a.youtubePosition - b.youtubePosition)
}

export function getGroupedByBloque(): Record<Bloque, Song[]> {
  const groups: Record<Bloque, Song[]> = {
    1: [],
    2: [],
    3: [],
    4: [],
    'extras': [],
  }

  for (const song of data.songs) {
    groups[song.bloque].push(song)
  }

  // Sort each group by position
  for (const bloque of Object.keys(groups) as Bloque[]) {
    groups[bloque].sort((a, b) => a.youtubePosition - b.youtubePosition)
  }

  return groups
}
