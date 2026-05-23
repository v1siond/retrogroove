import songsData from '@/content/songs.json'
import { Song, SongsData } from './types'

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

export function getSongsByIds(ids: string[]): Song[] {
  return ids.map(id => getSongById(id)).filter((s): s is Song => s !== undefined)
}
