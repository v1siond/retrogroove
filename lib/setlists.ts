import { Setlist, SetlistWithSongs } from './types'
import { getSongsByIds } from './songs'

import bloque1 from '@/content/setlists/bloque-1.json'
import bloque2 from '@/content/setlists/bloque-2.json'
import bloque3 from '@/content/setlists/bloque-3.json'
import bloque4 from '@/content/setlists/bloque-4.json'
import extras from '@/content/setlists/extras.json'

const allSetlists: Setlist[] = [
  bloque1 as Setlist,
  bloque2 as Setlist,
  bloque3 as Setlist,
  bloque4 as Setlist,
  extras as Setlist,
]

export function getAllSetlists(): Setlist[] {
  return allSetlists
}

export function getSetlistById(id: string): Setlist | undefined {
  return allSetlists.find(s => s.id === id)
}

export function getSetlistWithSongs(setlist: Setlist): SetlistWithSongs {
  return {
    id: setlist.id,
    name: setlist.name,
    songs: getSongsByIds(setlist.songIds),
  }
}

export function getAllSetlistsWithSongs(): SetlistWithSongs[] {
  return allSetlists.map(getSetlistWithSongs)
}
