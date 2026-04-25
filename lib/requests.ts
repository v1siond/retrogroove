// lib/requests.ts

import { Request, RequestWithCount } from './types'
import { getSongById } from './songs'

export async function getRequestsForDate(date: string): Promise<Request[]> {
  try {
    const res = await fetch(`/api/requests?date=${date}`)
    if (!res.ok) return []
    return res.json()
  } catch {
    return []
  }
}

export function aggregateRequests(requests: Request[]): RequestWithCount[] {
  const counts = new Map<string, { count: number; requests: Request[] }>()

  for (const req of requests) {
    const existing = counts.get(req.songId)
    if (existing) {
      existing.count++
      existing.requests.push(req)
    } else {
      counts.set(req.songId, { count: 1, requests: [req] })
    }
  }

  const results: RequestWithCount[] = []
  for (const [songId, data] of counts) {
    const song = getSongById(songId)
    if (song) {
      results.push({
        song,
        count: data.count,
        requests: data.requests,
      })
    }
  }

  return results.sort((a, b) => b.count - a.count)
}

export function formatDate(date: Date): string {
  return date.toISOString().split('T')[0]
}

export function formatDisplayDate(dateStr: string): string {
  const date = new Date(dateStr + 'T12:00:00')
  return date.toLocaleDateString('es-PE', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  })
}
