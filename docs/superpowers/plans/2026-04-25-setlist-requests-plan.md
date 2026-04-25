# RetroGroove Setlist & Requests Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add Decap CMS, song request system with Yape verification, band dashboard, and bloque-based print layout to the RetroGroove band website.

**Architecture:** Next.js app router with Decap CMS for content, Netlify Functions for request submissions via GitHub API, static JSON files for songs/events/requests, localStorage for band session and "tocada" state.

**Tech Stack:** Next.js 16, React 19, TypeScript, Tailwind 4, Decap CMS, Netlify Functions, GitHub API, nanoid, bcryptjs

---

## File Structure Overview

```
retrogroove-site/
├── content/
│   ├── songs.json                    # All songs with bloque assignments
│   ├── events/                       # Event JSON files (created via Decap)
│   └── requests/                     # Request JSON files (created via API)
│
├── public/
│   └── admin/
│       ├── index.html                # Decap CMS entry
│       └── config.yml                # Decap configuration
│
├── netlify/
│   └── functions/
│       └── submit-request.ts         # Request submission API
│
├── lib/
│   ├── types.ts                      # Shared TypeScript interfaces
│   ├── songs.ts                      # Song data utilities
│   ├── requests.ts                   # Request utilities
│   └── auth.ts                       # Band auth utilities
│
├── app/
│   ├── pedir/
│   │   └── page.tsx                  # Fan request page
│   ├── band/
│   │   └── page.tsx                  # Band dashboard
│   └── setlist/
│       └── imprimir/
│           └── page.tsx              # Modified print page
│
└── scripts/
    └── seed-songs.ts                 # Song seeding script
```

---

## Task 1: Install Dependencies

**Files:**
- Modify: `package.json`

- [ ] **Step 1: Install production dependencies**

```bash
npm install nanoid bcryptjs
```

- [ ] **Step 2: Install dev dependencies for types**

```bash
npm install -D @types/bcryptjs
```

- [ ] **Step 3: Verify installation**

Run: `npm ls nanoid bcryptjs`
Expected: Both packages listed without errors

- [ ] **Step 4: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore: add nanoid and bcryptjs dependencies"
```

---

## Task 2: Create Shared Types

**Files:**
- Create: `lib/types.ts`

- [ ] **Step 1: Create lib directory**

```bash
mkdir -p lib
```

- [ ] **Step 2: Create types file**

```typescript
// lib/types.ts

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
```

- [ ] **Step 3: Commit**

```bash
git add lib/types.ts
git commit -m "feat: add shared types for songs, events, and requests"
```

---

## Task 3: Create Song Seeding Script

**Files:**
- Create: `scripts/seed-songs.ts`
- Create: `content/songs.json`

- [ ] **Step 1: Create scripts and content directories**

```bash
mkdir -p scripts content content/events content/requests
```

- [ ] **Step 2: Create the seeding script**

```typescript
// scripts/seed-songs.ts
// Run with: npx tsx scripts/seed-songs.ts

import * as fs from 'fs'
import * as path from 'path'

interface OldSong {
  title: string
  artist: string
}

interface NewSong {
  id: string
  title: string
  artist: string
  bloque: 1 | 2 | 3 | 4 | 'extras'
  youtubePosition: number
  enabled: boolean
}

// YouTube playlist order (from the playlist, these are the songs in order)
// This is the canonical order that determines bloques
const PLAYLIST_ORDER: OldSong[] = [
  // Bloque 1: 1-14
  { title: 'Celebration', artist: 'Kool & The Gang' },
  { title: 'September', artist: 'Earth, Wind & Fire' },
  { title: "Let's Groove", artist: 'Earth, Wind & Fire' },
  { title: 'Funkytown', artist: 'Lipps Inc.' },
  { title: 'Disco Inferno', artist: 'The Trammps' },
  { title: 'I Will Survive', artist: 'Gloria Gaynor' },
  { title: 'Hot Stuff', artist: 'Donna Summer' },
  { title: 'Bad Girls', artist: 'Donna Summer' },
  { title: 'Le Freak', artist: 'Chic' },
  { title: 'Get Down on It', artist: 'Kool & The Gang' },
  { title: 'Ladies Night', artist: 'Kool & The Gang' },
  { title: 'You Should Be Dancing', artist: 'Bee Gees' },
  { title: 'Rock With You', artist: 'Michael Jackson' },
  { title: 'Give It Up', artist: 'KC & The Sunshine Band' },

  // Bloque 2: 15-30
  { title: 'Take On Me', artist: 'a-ha' },
  { title: 'Footloose', artist: 'Kenny Loggins' },
  { title: 'Maniac', artist: 'Michael Sembello' },
  { title: 'Heart of Glass', artist: 'Blondie' },
  { title: 'One Way or Another', artist: 'Blondie' },
  { title: 'Like a Virgin', artist: 'Madonna' },
  { title: 'Mamma Mia', artist: 'ABBA' },
  { title: 'Dancing with Myself', artist: 'Billy Idol' },
  { title: 'A Little Respect', artist: 'Erasure' },
  { title: 'Dressed for Success', artist: 'Roxette' },
  { title: "Don't Get Me Wrong", artist: 'The Pretenders' },
  { title: 'Heartbreaker', artist: 'Pat Benatar' },
  { title: 'Goodbye to You', artist: 'Scandal' },
  { title: 'On the Radio', artist: 'Donna Summer' },
  { title: 'Crazy Little Thing Called Love', artist: 'Queen' },
  { title: 'Jump', artist: 'Van Halen' },

  // Bloque 3: 31-45
  { title: 'Música Ligera', artist: 'Soda Stereo' },
  { title: 'Persiana Americana', artist: 'Soda Stereo' },
  { title: 'Prófugos', artist: 'Soda Stereo' },
  { title: 'Lamento Boliviano', artist: 'Enanitos Verdes' },
  { title: 'La Muralla Verde', artist: 'Enanitos Verdes' },
  { title: 'Mil Horas', artist: 'Los Abuelos de la Nada' },
  { title: 'Pronta Entrega', artist: 'Virus' },
  { title: 'Luna de Miel', artist: 'Virus' },
  { title: 'Entre Dos Tierras', artist: 'Héroes del Silencio' },
  { title: 'Mujer Amante', artist: 'Rata Blanca' },
  { title: 'Devuélveme a Mi Chica', artist: 'Hombres G' },
  { title: 'Lobo-Hombre en París', artist: 'La Unión' },
  { title: 'Auto Rojo', artist: 'Vilma Palma e Vampiros' },
  { title: 'Cuando Seas Grande', artist: 'Miguel Mateos' },
  { title: 'La Calle Es Su Lugar', artist: 'GIT' },

  // Bloque 4: 46-60
  { title: 'Estoy Aquí', artist: 'Shakira' },
  { title: 'Antología', artist: 'Shakira' },
  { title: 'Ciega Sordomuda', artist: 'Shakira' },
  { title: 'Inevitable', artist: 'Shakira' },
  { title: 'Pies Descalzos', artist: 'Shakira' },
  { title: 'Te Aviso Te Anuncio', artist: 'Shakira' },
  { title: 'Azúcar Amargo', artist: 'Fey' },
  { title: 'Eternamente Bella', artist: 'Alejandra Guzmán' },
  { title: 'Mírala, Míralo', artist: 'Alejandra Guzmán' },
  { title: 'El Sol No Regresa', artist: 'La 5a Estación' },
  { title: 'Oye Mi Amor', artist: 'Maná' },
  { title: 'Contéstame', artist: 'Grupo Río' },
  { title: 'Decir Adiós', artist: 'Amén' },
  { title: 'Nada Fue un Error', artist: 'Coti' },
  { title: 'Avenida Larco', artist: 'Frágil' },

  // Extras: 61+
  { title: 'Me Estoy Enamorando', artist: 'Pedro Suárez-Vértiz' },
  { title: 'Triciclo Perú', artist: 'Los Mojarras' },
  { title: 'Suna', artist: 'Mar de Copas' },
  { title: 'Zombie', artist: 'The Cranberries' },
  { title: 'Creep', artist: 'Radiohead' },
  { title: 'Mr. Jones', artist: 'Counting Crows' },
  { title: 'Semi-Charmed Life', artist: 'Third Eye Blind' },
  { title: 'Santeria', artist: 'Sublime' },
  { title: 'Like a Stone', artist: 'Audioslave' },
  { title: 'You Oughta Know', artist: 'Alanis Morissette' },
  { title: 'Rehab', artist: 'Amy Winehouse' },
  { title: 'Take a Picture', artist: 'Filter' },
  { title: "New Year's Day", artist: 'U2' },
  { title: 'Dancing in the Dark', artist: 'Bruce Springsteen' },
  { title: 'Born to Be Wild', artist: 'Steppenwolf' },
  { title: 'Paranoid', artist: 'Black Sabbath' },
  { title: 'Are You Gonna Go My Way', artist: 'Lenny Kravitz' },
  { title: 'Voy en un Coche', artist: 'Christina Rosenvinge' },
]

function slugify(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
}

function getBloque(position: number): 1 | 2 | 3 | 4 | 'extras' {
  if (position <= 14) return 1
  if (position <= 30) return 2
  if (position <= 45) return 3
  if (position <= 60) return 4
  return 'extras'
}

const songs: NewSong[] = PLAYLIST_ORDER.map((song, index) => {
  const position = index + 1
  return {
    id: slugify(song.title),
    title: song.title,
    artist: song.artist,
    bloque: getBloque(position),
    youtubePosition: position,
    enabled: true,
  }
})

const output = { songs }
const outputPath = path.join(process.cwd(), 'content', 'songs.json')

fs.writeFileSync(outputPath, JSON.stringify(output, null, 2))
console.log(`✓ Seeded ${songs.length} songs to ${outputPath}`)

// Log bloque distribution
const bloqueCounts = songs.reduce((acc, song) => {
  const key = song.bloque === 'extras' ? 'extras' : `bloque${song.bloque}`
  acc[key] = (acc[key] || 0) + 1
  return acc
}, {} as Record<string, number>)

console.log('\nBloque distribution:')
Object.entries(bloqueCounts).forEach(([bloque, count]) => {
  console.log(`  ${bloque}: ${count} songs`)
})
```

- [ ] **Step 3: Install tsx for running TypeScript scripts**

```bash
npm install -D tsx
```

- [ ] **Step 4: Run the seeding script**

Run: `npx tsx scripts/seed-songs.ts`
Expected: Output showing 78 songs seeded with bloque distribution

- [ ] **Step 5: Verify content/songs.json was created**

Run: `head -30 content/songs.json`
Expected: JSON with songs array, first song has bloque: 1

- [ ] **Step 6: Commit**

```bash
git add scripts/seed-songs.ts content/songs.json package.json package-lock.json
git commit -m "feat: seed songs from playlist with bloque assignments"
```

---

## Task 4: Create Song Data Utilities

**Files:**
- Create: `lib/songs.ts`

- [ ] **Step 1: Create songs utility**

```typescript
// lib/songs.ts

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
```

- [ ] **Step 2: Update tsconfig to support JSON imports**

Add to `tsconfig.json` compilerOptions:

```json
{
  "compilerOptions": {
    "resolveJsonModule": true
  }
}
```

- [ ] **Step 3: Commit**

```bash
git add lib/songs.ts tsconfig.json
git commit -m "feat: add song data utilities with bloque grouping"
```

---

## Task 5: Set Up Decap CMS

**Files:**
- Create: `public/admin/index.html`
- Create: `public/admin/config.yml`

- [ ] **Step 1: Create admin directory**

```bash
mkdir -p public/admin
```

- [ ] **Step 2: Create Decap admin HTML**

```html
<!-- public/admin/index.html -->
<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta name="robots" content="noindex" />
  <title>RetroGroove Admin</title>
</head>
<body>
  <script src="https://unpkg.com/decap-cms@^3.0.0/dist/decap-cms.js"></script>
</body>
</html>
```

- [ ] **Step 3: Create Decap config**

```yaml
# public/admin/config.yml
backend:
  name: git-gateway
  branch: main

media_folder: public/images
public_folder: /images

collections:
  - name: songs
    label: Songs
    file: content/songs.json
    fields:
      - name: songs
        label: Songs
        widget: list
        fields:
          - { name: id, label: ID, widget: string }
          - { name: title, label: Title, widget: string }
          - { name: artist, label: Artist, widget: string }
          - { name: bloque, label: Bloque, widget: select, options: ["1", "2", "3", "4", "extras"] }
          - { name: youtubePosition, label: YouTube Position, widget: number }
          - { name: enabled, label: Enabled, widget: boolean, default: true }

  - name: events
    label: Events
    folder: content/events
    create: true
    slug: "{{fields.date}}"
    fields:
      - { name: date, label: Date, widget: datetime, format: "YYYY-MM-DD", date_format: "YYYY-MM-DD", time_format: false }
      - { name: name, label: Name, widget: string }
      - { name: venue, label: Venue, widget: string, required: false }
      - { name: notes, label: Notes, widget: text, required: false }

  - name: requests
    label: Requests
    folder: content/requests
    create: false
    delete: true
    extension: json
    fields:
      - { name: songId, label: Song ID, widget: string }
      - { name: opNumber, label: Operation Number, widget: string }
      - { name: screenshot, label: Screenshot, widget: image, required: false }
      - { name: name, label: Name, widget: string, required: false }
      - { name: timestamp, label: Timestamp, widget: datetime }
```

- [ ] **Step 4: Commit**

```bash
git add public/admin/
git commit -m "feat: add decap cms configuration"
```

---

## Task 6: Create Netlify Function for Request Submission

**Files:**
- Create: `netlify/functions/submit-request.ts`
- Create: `netlify.toml` (modify if exists)

- [ ] **Step 1: Create functions directory**

```bash
mkdir -p netlify/functions
```

- [ ] **Step 2: Create the submit-request function**

```typescript
// netlify/functions/submit-request.ts

import type { Handler, HandlerEvent, HandlerContext } from '@netlify/functions'
import { nanoid } from 'nanoid'

interface RequestBody {
  songId: string
  opNumber: string
  screenshot?: string
  name?: string
}

const handler: Handler = async (event: HandlerEvent, context: HandlerContext) => {
  // Only allow POST
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      body: JSON.stringify({ error: 'Method not allowed' }),
    }
  }

  // Parse body
  let body: RequestBody
  try {
    body = JSON.parse(event.body || '{}')
  } catch {
    return {
      statusCode: 400,
      body: JSON.stringify({ error: 'Invalid JSON' }),
    }
  }

  // Validate required fields
  if (!body.songId || !body.opNumber) {
    return {
      statusCode: 400,
      body: JSON.stringify({ error: 'songId and opNumber are required' }),
    }
  }

  // Create request object
  const now = new Date()
  const dateStr = now.toISOString().split('T')[0] // YYYY-MM-DD
  const requestId = nanoid(8)
  const filename = `${dateStr}_${requestId}.json`

  const request = {
    songId: body.songId,
    opNumber: body.opNumber,
    screenshot: body.screenshot || null,
    name: body.name || null,
    timestamp: now.toISOString(),
  }

  // Commit to GitHub via API
  const githubToken = process.env.GITHUB_TOKEN
  const repo = process.env.GITHUB_REPO || 'yourusername/retrogroove-site'

  if (!githubToken) {
    console.error('GITHUB_TOKEN not configured')
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Server configuration error' }),
    }
  }

  const filePath = `content/requests/${filename}`
  const content = Buffer.from(JSON.stringify(request, null, 2)).toString('base64')

  try {
    const response = await fetch(
      `https://api.github.com/repos/${repo}/contents/${filePath}`,
      {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${githubToken}`,
          'Content-Type': 'application/json',
          Accept: 'application/vnd.github.v3+json',
        },
        body: JSON.stringify({
          message: `request: ${body.songId} from ${body.name || 'anonymous'}`,
          content,
          branch: 'main',
        }),
      }
    )

    if (!response.ok) {
      const errorData = await response.text()
      console.error('GitHub API error:', errorData)
      return {
        statusCode: 500,
        body: JSON.stringify({ error: 'Failed to save request' }),
      }
    }

    return {
      statusCode: 200,
      body: JSON.stringify({ success: true, requestId }),
    }
  } catch (error) {
    console.error('Error saving request:', error)
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Failed to save request' }),
    }
  }
}

export { handler }
```

- [ ] **Step 3: Install Netlify Functions types**

```bash
npm install -D @netlify/functions
```

- [ ] **Step 4: Update netlify.toml**

```toml
# netlify.toml
[build]
  command = "npm run build"
  publish = ".next"

[functions]
  directory = "netlify/functions"

[[redirects]]
  from = "/api/*"
  to = "/.netlify/functions/:splat"
  status = 200
```

- [ ] **Step 5: Commit**

```bash
git add netlify/ package.json package-lock.json
git commit -m "feat: add netlify function for request submission"
```

---

## Task 7: Create Fan Request Page (/pedir)

**Files:**
- Create: `app/pedir/page.tsx`

- [ ] **Step 1: Create pedir directory**

```bash
mkdir -p app/pedir
```

- [ ] **Step 2: Create the request page**

```tsx
// app/pedir/page.tsx
'use client'

import { useState, useEffect, useMemo } from 'react'
import { getAllSongs } from '@/lib/songs'
import { Song, Bloque, getBloqueColor, getBloqueName } from '@/lib/types'

type Step = 'guide' | 'select' | 'form' | 'success'

const BLOQUES: Bloque[] = [1, 2, 3, 4, 'extras']

export default function PedirPage() {
  const [mounted, setMounted] = useState(false)
  const [step, setStep] = useState<Step>('guide')
  const [selectedSong, setSelectedSong] = useState<Song | null>(null)
  const [activeBloque, setActiveBloque] = useState<Bloque>(1)
  const [opNumber, setOpNumber] = useState('')
  const [name, setName] = useState('')
  const [screenshot, setScreenshot] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const songs = useMemo(() => getAllSongs().filter(s => s.enabled), [])
  const songsByBloque = useMemo(() => {
    const grouped: Record<Bloque, Song[]> = { 1: [], 2: [], 3: [], 4: [], 'extras': [] }
    songs.forEach(s => grouped[s.bloque].push(s))
    return grouped
  }, [songs])

  useEffect(() => { setMounted(true) }, [])

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    const reader = new FileReader()
    reader.onload = () => {
      setScreenshot(reader.result as string)
    }
    reader.readAsDataURL(file)
  }

  const handleSubmit = async () => {
    if (!selectedSong || !opNumber.trim()) return

    setSubmitting(true)
    setError(null)

    try {
      const res = await fetch('/api/submit-request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          songId: selectedSong.id,
          opNumber: opNumber.trim(),
          name: name.trim() || undefined,
          screenshot: screenshot || undefined,
        }),
      })

      if (!res.ok) {
        throw new Error('Error al enviar')
      }

      setStep('success')
    } catch (err) {
      setError('Hubo un error. Intenta de nuevo.')
    } finally {
      setSubmitting(false)
    }
  }

  if (!mounted) return null

  return (
    <>
      <title>Pide tu Canción — RetroGroove</title>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700&family=Bebas+Neue&display=swap');

        .pedir-page {
          --pink: #ff1493;
          --gold: #ffd700;
          --cyan: #00e5ff;
          --purple: #bf00ff;
          min-height: 100vh;
          background: linear-gradient(180deg, #050010 0%, #0d0025 50%, #050010 100%);
          color: #fff;
          font-family: 'Outfit', sans-serif;
          padding: 1rem;
        }

        .container {
          max-width: 480px;
          margin: 0 auto;
        }

        .header {
          text-align: center;
          margin-bottom: 1.5rem;
        }

        .header h1 {
          font-family: 'Bebas Neue', sans-serif;
          font-size: 2.5rem;
          letter-spacing: 0.1em;
          color: #fff;
          text-shadow: 0 0 20px rgba(255,20,147,0.5);
          margin: 0;
        }

        .header p {
          color: rgba(255,255,255,0.6);
          font-size: 0.9rem;
          margin: 0.5rem 0 0;
        }

        .card {
          background: rgba(255,255,255,0.03);
          border: 1px solid rgba(255,255,255,0.08);
          border-radius: 16px;
          padding: 1.5rem;
          margin-bottom: 1rem;
        }

        .guide-step {
          display: flex;
          align-items: flex-start;
          gap: 1rem;
          margin-bottom: 1rem;
          padding-bottom: 1rem;
          border-bottom: 1px solid rgba(255,255,255,0.05);
        }

        .guide-step:last-child {
          border-bottom: none;
          margin-bottom: 0;
          padding-bottom: 0;
        }

        .guide-num {
          width: 32px;
          height: 32px;
          border-radius: 50%;
          background: var(--gold);
          color: #000;
          display: flex;
          align-items: center;
          justify-content: center;
          font-weight: 700;
          flex-shrink: 0;
        }

        .guide-text h3 {
          margin: 0 0 0.3rem;
          font-size: 1rem;
          color: #fff;
        }

        .guide-text p {
          margin: 0;
          font-size: 0.85rem;
          color: rgba(255,255,255,0.6);
        }

        .yape-number {
          background: rgba(255,215,0,0.1);
          border: 1px solid rgba(255,215,0,0.3);
          border-radius: 8px;
          padding: 0.8rem;
          text-align: center;
          margin: 1rem 0;
        }

        .yape-number span {
          font-size: 1.5rem;
          font-weight: 700;
          color: var(--gold);
          letter-spacing: 0.1em;
        }

        .btn {
          width: 100%;
          padding: 0.9rem;
          border: none;
          border-radius: 10px;
          font-family: 'Outfit', sans-serif;
          font-size: 1rem;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s;
        }

        .btn-primary {
          background: linear-gradient(135deg, var(--pink), var(--purple));
          color: #fff;
        }

        .btn-primary:hover {
          opacity: 0.9;
          transform: translateY(-1px);
        }

        .btn-primary:disabled {
          opacity: 0.5;
          cursor: not-allowed;
          transform: none;
        }

        .btn-secondary {
          background: rgba(255,255,255,0.1);
          color: #fff;
          border: 1px solid rgba(255,255,255,0.2);
        }

        .bloque-tabs {
          display: flex;
          gap: 0.5rem;
          margin-bottom: 1rem;
          overflow-x: auto;
          padding-bottom: 0.5rem;
        }

        .bloque-tab {
          padding: 0.5rem 1rem;
          border-radius: 20px;
          border: 1px solid rgba(255,255,255,0.1);
          background: transparent;
          color: rgba(255,255,255,0.5);
          font-family: 'Outfit', sans-serif;
          font-size: 0.85rem;
          cursor: pointer;
          white-space: nowrap;
          transition: all 0.2s;
        }

        .bloque-tab.active {
          border-color: var(--tab-color);
          color: var(--tab-color);
          background: rgba(255,255,255,0.05);
        }

        .song-list {
          max-height: 300px;
          overflow-y: auto;
        }

        .song-item {
          padding: 0.8rem;
          border-radius: 8px;
          cursor: pointer;
          transition: background 0.2s;
          border: 1px solid transparent;
        }

        .song-item:hover {
          background: rgba(255,255,255,0.05);
        }

        .song-item.selected {
          background: rgba(255,215,0,0.1);
          border-color: var(--gold);
        }

        .song-item h4 {
          margin: 0 0 0.2rem;
          font-size: 0.95rem;
          color: #fff;
        }

        .song-item p {
          margin: 0;
          font-size: 0.8rem;
          color: rgba(255,255,255,0.5);
        }

        .form-group {
          margin-bottom: 1rem;
        }

        .form-group label {
          display: block;
          margin-bottom: 0.5rem;
          font-size: 0.85rem;
          color: rgba(255,255,255,0.7);
        }

        .form-group input {
          width: 100%;
          padding: 0.8rem;
          border: 1px solid rgba(255,255,255,0.1);
          border-radius: 8px;
          background: rgba(255,255,255,0.05);
          color: #fff;
          font-family: 'Outfit', sans-serif;
          font-size: 1rem;
        }

        .form-group input:focus {
          outline: none;
          border-color: var(--gold);
        }

        .form-group input::placeholder {
          color: rgba(255,255,255,0.3);
        }

        .file-upload {
          border: 2px dashed rgba(255,255,255,0.2);
          border-radius: 8px;
          padding: 1.5rem;
          text-align: center;
          cursor: pointer;
          transition: border-color 0.2s;
        }

        .file-upload:hover {
          border-color: rgba(255,255,255,0.4);
        }

        .file-upload.has-file {
          border-color: var(--gold);
          border-style: solid;
        }

        .file-upload input {
          display: none;
        }

        .file-upload p {
          margin: 0;
          color: rgba(255,255,255,0.5);
          font-size: 0.85rem;
        }

        .selected-song {
          background: rgba(255,215,0,0.1);
          border: 1px solid rgba(255,215,0,0.3);
          border-radius: 8px;
          padding: 1rem;
          margin-bottom: 1rem;
        }

        .selected-song h4 {
          margin: 0 0 0.2rem;
          color: var(--gold);
        }

        .selected-song p {
          margin: 0;
          color: rgba(255,255,255,0.6);
          font-size: 0.9rem;
        }

        .error {
          background: rgba(255,0,0,0.1);
          border: 1px solid rgba(255,0,0,0.3);
          color: #ff6b6b;
          padding: 0.8rem;
          border-radius: 8px;
          margin-bottom: 1rem;
          text-align: center;
        }

        .success-icon {
          font-size: 4rem;
          text-align: center;
          margin-bottom: 1rem;
        }

        .success-text {
          text-align: center;
        }

        .success-text h2 {
          color: var(--gold);
          margin: 0 0 0.5rem;
        }

        .success-text p {
          color: rgba(255,255,255,0.6);
          margin: 0;
        }

        .back-link {
          display: block;
          text-align: center;
          margin-top: 1rem;
          color: rgba(255,255,255,0.5);
          text-decoration: none;
          font-size: 0.9rem;
        }

        .back-link:hover {
          color: var(--gold);
        }
      `}</style>

      <div className="pedir-page">
        <div className="container">
          <div className="header">
            <h1>RETROGROOVE</h1>
            <p>¡Pide tu canción favorita!</p>
          </div>

          {step === 'guide' && (
            <div className="card">
              <div className="guide-step">
                <div className="guide-num">1</div>
                <div className="guide-text">
                  <h3>Yapea al número</h3>
                  <p>Envía tu aporte para apoyar a la banda</p>
                </div>
              </div>
              <div className="yape-number">
                <span>999 888 777</span>
              </div>
              <div className="guide-step">
                <div className="guide-num">2</div>
                <div className="guide-text">
                  <h3>Copia el número de operación</h3>
                  <p>Lo encuentras en el comprobante de Yape</p>
                </div>
              </div>
              <div className="guide-step">
                <div className="guide-num">3</div>
                <div className="guide-text">
                  <h3>Pide tu canción</h3>
                  <p>Selecciona la canción que quieres escuchar</p>
                </div>
              </div>
              <button className="btn btn-primary" onClick={() => setStep('select')}>
                Ya yapié, quiero pedir
              </button>
            </div>
          )}

          {step === 'select' && (
            <div className="card">
              <div className="bloque-tabs">
                {BLOQUES.map(bloque => (
                  <button
                    key={bloque}
                    className={`bloque-tab ${activeBloque === bloque ? 'active' : ''}`}
                    style={{ '--tab-color': getBloqueColor(bloque) } as React.CSSProperties}
                    onClick={() => setActiveBloque(bloque)}
                  >
                    {getBloqueName(bloque)}
                  </button>
                ))}
              </div>
              <div className="song-list">
                {songsByBloque[activeBloque].map(song => (
                  <div
                    key={song.id}
                    className={`song-item ${selectedSong?.id === song.id ? 'selected' : ''}`}
                    onClick={() => setSelectedSong(song)}
                  >
                    <h4>{song.title}</h4>
                    <p>{song.artist}</p>
                  </div>
                ))}
              </div>
              <button
                className="btn btn-primary"
                disabled={!selectedSong}
                onClick={() => setStep('form')}
                style={{ marginTop: '1rem' }}
              >
                Continuar
              </button>
              <button
                className="btn btn-secondary"
                onClick={() => setStep('guide')}
                style={{ marginTop: '0.5rem' }}
              >
                Volver
              </button>
            </div>
          )}

          {step === 'form' && selectedSong && (
            <div className="card">
              <div className="selected-song">
                <h4>{selectedSong.title}</h4>
                <p>{selectedSong.artist}</p>
              </div>

              {error && <div className="error">{error}</div>}

              <div className="form-group">
                <label>Número de operación Yape *</label>
                <input
                  type="text"
                  placeholder="Ej: 123456789"
                  value={opNumber}
                  onChange={e => setOpNumber(e.target.value)}
                />
              </div>

              <div className="form-group">
                <label>Tu nombre (opcional)</label>
                <input
                  type="text"
                  placeholder="Ej: Juan"
                  value={name}
                  onChange={e => setName(e.target.value)}
                />
              </div>

              <div className="form-group">
                <label>Screenshot del comprobante (opcional)</label>
                <label className={`file-upload ${screenshot ? 'has-file' : ''}`}>
                  <input type="file" accept="image/*" onChange={handleFileChange} />
                  <p>{screenshot ? '✓ Imagen cargada' : 'Toca para subir imagen'}</p>
                </label>
              </div>

              <button
                className="btn btn-primary"
                disabled={!opNumber.trim() || submitting}
                onClick={handleSubmit}
              >
                {submitting ? 'Enviando...' : 'Enviar Pedido'}
              </button>
              <button
                className="btn btn-secondary"
                onClick={() => setStep('select')}
                style={{ marginTop: '0.5rem' }}
              >
                Cambiar canción
              </button>
            </div>
          )}

          {step === 'success' && (
            <div className="card">
              <div className="success-icon">🎉</div>
              <div className="success-text">
                <h2>¡Pedido enviado!</h2>
                <p>Gracias por tu aporte. La banda revisará tu pedido.</p>
              </div>
              <button
                className="btn btn-primary"
                onClick={() => {
                  setStep('guide')
                  setSelectedSong(null)
                  setOpNumber('')
                  setName('')
                  setScreenshot(null)
                }}
                style={{ marginTop: '1.5rem' }}
              >
                Pedir otra canción
              </button>
              <a href="/" className="back-link">Volver al inicio</a>
            </div>
          )}
        </div>
      </div>
    </>
  )
}
```

- [ ] **Step 3: Commit**

```bash
git add app/pedir/
git commit -m "feat: add fan song request page with yape flow"
```

---

## Task 8: Create Band Auth Utilities

**Files:**
- Create: `lib/auth.ts`

- [ ] **Step 1: Create auth utility**

```typescript
// lib/auth.ts

import bcrypt from 'bcryptjs'

const STORAGE_KEY = 'retrogroove_band_auth'
const SESSION_DURATION = 24 * 60 * 60 * 1000 // 24 hours

export async function verifyPassword(password: string): Promise<boolean> {
  const hash = process.env.NEXT_PUBLIC_BAND_PASSWORD_HASH
  if (!hash) {
    console.error('NEXT_PUBLIC_BAND_PASSWORD_HASH not configured')
    return false
  }
  return bcrypt.compare(password, hash)
}

export function setSession(): void {
  if (typeof window === 'undefined') return
  const expires = Date.now() + SESSION_DURATION
  localStorage.setItem(STORAGE_KEY, JSON.stringify({ expires }))
}

export function checkSession(): boolean {
  if (typeof window === 'undefined') return false
  try {
    const data = localStorage.getItem(STORAGE_KEY)
    if (!data) return false
    const { expires } = JSON.parse(data)
    if (Date.now() > expires) {
      localStorage.removeItem(STORAGE_KEY)
      return false
    }
    return true
  } catch {
    return false
  }
}

export function clearSession(): void {
  if (typeof window === 'undefined') return
  localStorage.removeItem(STORAGE_KEY)
}

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
```

- [ ] **Step 2: Generate password hash**

Run in terminal to generate hash for `RetroGroove$B4nd`:

```bash
node -e "const bcrypt = require('bcryptjs'); console.log(bcrypt.hashSync('RetroGroove\$B4nd', 10));"
```

Save the output hash for the environment variable.

- [ ] **Step 3: Commit**

```bash
git add lib/auth.ts
git commit -m "feat: add band auth utilities with session and tocada management"
```

---

## Task 9: Create Band Dashboard (/band)

**Files:**
- Create: `app/band/page.tsx`
- Create: `lib/requests.ts`

- [ ] **Step 1: Create requests utility**

```typescript
// lib/requests.ts

import { Request, RequestWithCount, Song } from './types'
import { getSongById } from './songs'

export async function getRequestsForDate(date: string): Promise<Request[]> {
  // In production, this reads from content/requests/
  // For now, we'll fetch from the API or read files at build time
  // Since this is client-side, we need an API endpoint

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
```

- [ ] **Step 2: Create band directory**

```bash
mkdir -p app/band
```

- [ ] **Step 3: Create the band dashboard page**

```tsx
// app/band/page.tsx
'use client'

import { useState, useEffect, useMemo } from 'react'
import { checkSession, setSession, verifyPassword, getTocadaSongs, setTocada } from '@/lib/auth'
import { aggregateRequests, formatDate, formatDisplayDate } from '@/lib/requests'
import { Request, RequestWithCount } from '@/lib/types'

export default function BandPage() {
  const [mounted, setMounted] = useState(false)
  const [authenticated, setAuthenticated] = useState(false)
  const [password, setPassword] = useState('')
  const [authError, setAuthError] = useState(false)
  const [checking, setChecking] = useState(true)

  const [selectedDate, setSelectedDate] = useState(formatDate(new Date()))
  const [requests, setRequests] = useState<Request[]>([])
  const [loading, setLoading] = useState(false)
  const [tocadaSongs, setTocadaSongsState] = useState<Set<string>>(new Set())

  useEffect(() => {
    setMounted(true)
    setAuthenticated(checkSession())
    setChecking(false)
  }, [])

  useEffect(() => {
    if (authenticated && selectedDate) {
      setTocadaSongsState(getTocadaSongs(selectedDate))
      loadRequests(selectedDate)
    }
  }, [authenticated, selectedDate])

  const loadRequests = async (date: string) => {
    setLoading(true)
    try {
      const res = await fetch(`/api/requests?date=${date}`)
      if (res.ok) {
        const data = await res.json()
        setRequests(data)
      }
    } catch (err) {
      console.error('Error loading requests:', err)
    } finally {
      setLoading(false)
    }
  }

  const handleLogin = async () => {
    const valid = await verifyPassword(password)
    if (valid) {
      setSession()
      setAuthenticated(true)
      setAuthError(false)
    } else {
      setAuthError(true)
    }
  }

  const handleTocada = (songId: string) => {
    const isTocada = tocadaSongs.has(songId)
    setTocada(selectedDate, songId, !isTocada)
    setTocadaSongsState(getTocadaSongs(selectedDate))
  }

  const aggregated = useMemo(() => aggregateRequests(requests), [requests])

  if (!mounted || checking) return null

  return (
    <>
      <title>Band Dashboard — RetroGroove</title>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700&family=Bebas+Neue&display=swap');

        .band-page {
          --pink: #ff1493;
          --gold: #ffd700;
          --cyan: #00e5ff;
          --purple: #bf00ff;
          min-height: 100vh;
          background: linear-gradient(180deg, #050010 0%, #0d0025 50%, #050010 100%);
          color: #fff;
          font-family: 'Outfit', sans-serif;
          padding: 1rem;
        }

        .container {
          max-width: 600px;
          margin: 0 auto;
        }

        .header {
          text-align: center;
          margin-bottom: 1.5rem;
        }

        .header h1 {
          font-family: 'Bebas Neue', sans-serif;
          font-size: 2rem;
          letter-spacing: 0.1em;
          color: var(--gold);
          margin: 0;
        }

        .card {
          background: rgba(255,255,255,0.03);
          border: 1px solid rgba(255,255,255,0.08);
          border-radius: 16px;
          padding: 1.5rem;
          margin-bottom: 1rem;
        }

        .login-form {
          text-align: center;
        }

        .login-form input {
          width: 100%;
          max-width: 300px;
          padding: 0.8rem;
          border: 1px solid rgba(255,255,255,0.1);
          border-radius: 8px;
          background: rgba(255,255,255,0.05);
          color: #fff;
          font-family: 'Outfit', sans-serif;
          font-size: 1rem;
          margin-bottom: 1rem;
        }

        .login-form input:focus {
          outline: none;
          border-color: var(--gold);
        }

        .btn {
          padding: 0.8rem 2rem;
          border: none;
          border-radius: 8px;
          font-family: 'Outfit', sans-serif;
          font-size: 1rem;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s;
        }

        .btn-primary {
          background: linear-gradient(135deg, var(--pink), var(--purple));
          color: #fff;
        }

        .btn-primary:hover {
          opacity: 0.9;
        }

        .error-msg {
          color: #ff6b6b;
          margin-bottom: 1rem;
        }

        .date-picker {
          display: flex;
          align-items: center;
          gap: 1rem;
          margin-bottom: 1rem;
        }

        .date-picker input {
          padding: 0.6rem;
          border: 1px solid rgba(255,255,255,0.1);
          border-radius: 8px;
          background: rgba(255,255,255,0.05);
          color: #fff;
          font-family: 'Outfit', sans-serif;
        }

        .date-display {
          font-size: 1.1rem;
          color: var(--gold);
          text-transform: capitalize;
        }

        .request-list {
          display: flex;
          flex-direction: column;
          gap: 0.5rem;
        }

        .request-item {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 0.8rem 1rem;
          background: rgba(255,255,255,0.03);
          border-radius: 8px;
          transition: opacity 0.2s;
        }

        .request-item.tocada {
          opacity: 0.4;
        }

        .request-item.tocada .song-title {
          text-decoration: line-through;
        }

        .song-info {
          flex: 1;
        }

        .song-title {
          font-weight: 500;
          color: #fff;
        }

        .song-artist {
          font-size: 0.85rem;
          color: rgba(255,255,255,0.5);
        }

        .request-actions {
          display: flex;
          align-items: center;
          gap: 0.8rem;
        }

        .count-badge {
          background: var(--pink);
          color: #fff;
          padding: 0.3rem 0.7rem;
          border-radius: 20px;
          font-size: 0.85rem;
          font-weight: 600;
        }

        .tocada-btn {
          padding: 0.4rem 0.8rem;
          border: 1px solid rgba(255,255,255,0.2);
          border-radius: 6px;
          background: transparent;
          color: rgba(255,255,255,0.6);
          font-size: 0.8rem;
          cursor: pointer;
          transition: all 0.2s;
        }

        .tocada-btn:hover {
          border-color: var(--gold);
          color: var(--gold);
        }

        .tocada-btn.active {
          background: var(--gold);
          border-color: var(--gold);
          color: #000;
        }

        .empty-state {
          text-align: center;
          padding: 2rem;
          color: rgba(255,255,255,0.5);
        }

        .loading {
          text-align: center;
          padding: 2rem;
          color: rgba(255,255,255,0.5);
        }

        .stats {
          display: flex;
          gap: 1rem;
          margin-bottom: 1rem;
          text-align: center;
        }

        .stat {
          flex: 1;
          padding: 1rem;
          background: rgba(255,255,255,0.03);
          border-radius: 8px;
        }

        .stat-value {
          font-size: 2rem;
          font-weight: 700;
          color: var(--gold);
        }

        .stat-label {
          font-size: 0.8rem;
          color: rgba(255,255,255,0.5);
        }
      `}</style>

      <div className="band-page">
        <div className="container">
          <div className="header">
            <h1>🎸 BAND DASHBOARD</h1>
          </div>

          {!authenticated ? (
            <div className="card login-form">
              <h2 style={{ marginBottom: '1rem' }}>Acceso Banda</h2>
              {authError && <p className="error-msg">Contraseña incorrecta</p>}
              <input
                type="password"
                placeholder="Contraseña"
                value={password}
                onChange={e => setPassword(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleLogin()}
              />
              <br />
              <button className="btn btn-primary" onClick={handleLogin}>
                Entrar
              </button>
            </div>
          ) : (
            <>
              <div className="date-picker">
                <input
                  type="date"
                  value={selectedDate}
                  onChange={e => setSelectedDate(e.target.value)}
                />
                <span className="date-display">{formatDisplayDate(selectedDate)}</span>
              </div>

              <div className="stats">
                <div className="stat">
                  <div className="stat-value">{requests.length}</div>
                  <div className="stat-label">Pedidos</div>
                </div>
                <div className="stat">
                  <div className="stat-value">{aggregated.length}</div>
                  <div className="stat-label">Canciones</div>
                </div>
                <div className="stat">
                  <div className="stat-value">{tocadaSongs.size}</div>
                  <div className="stat-label">Tocadas</div>
                </div>
              </div>

              <div className="card">
                {loading ? (
                  <div className="loading">Cargando...</div>
                ) : aggregated.length === 0 ? (
                  <div className="empty-state">
                    <p>No hay pedidos para esta fecha</p>
                  </div>
                ) : (
                  <div className="request-list">
                    {aggregated.map(item => (
                      <div
                        key={item.song.id}
                        className={`request-item ${tocadaSongs.has(item.song.id) ? 'tocada' : ''}`}
                      >
                        <div className="song-info">
                          <div className="song-title">{item.song.title}</div>
                          <div className="song-artist">{item.song.artist}</div>
                        </div>
                        <div className="request-actions">
                          <span className="count-badge">{item.count}</span>
                          <button
                            className={`tocada-btn ${tocadaSongs.has(item.song.id) ? 'active' : ''}`}
                            onClick={() => handleTocada(item.song.id)}
                          >
                            {tocadaSongs.has(item.song.id) ? '✓ Tocada' : 'Marcar'}
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </>
  )
}
```

- [ ] **Step 4: Commit**

```bash
git add app/band/ lib/requests.ts
git commit -m "feat: add band dashboard with request ranking and tocada toggle"
```

---

## Task 10: Create Requests API Endpoint

**Files:**
- Create: `netlify/functions/requests.ts`

- [ ] **Step 1: Create the requests API function**

```typescript
// netlify/functions/requests.ts

import type { Handler, HandlerEvent } from '@netlify/functions'

interface Request {
  songId: string
  opNumber: string
  screenshot?: string
  name?: string
  timestamp: string
}

const handler: Handler = async (event: HandlerEvent) => {
  if (event.httpMethod !== 'GET') {
    return {
      statusCode: 405,
      body: JSON.stringify({ error: 'Method not allowed' }),
    }
  }

  const date = event.queryStringParameters?.date
  if (!date) {
    return {
      statusCode: 400,
      body: JSON.stringify({ error: 'date parameter required' }),
    }
  }

  const githubToken = process.env.GITHUB_TOKEN
  const repo = process.env.GITHUB_REPO || 'yourusername/retrogroove-site'

  if (!githubToken) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Server configuration error' }),
    }
  }

  try {
    // List files in content/requests/
    const listRes = await fetch(
      `https://api.github.com/repos/${repo}/contents/content/requests`,
      {
        headers: {
          Authorization: `Bearer ${githubToken}`,
          Accept: 'application/vnd.github.v3+json',
        },
      }
    )

    if (!listRes.ok) {
      if (listRes.status === 404) {
        return {
          statusCode: 200,
          body: JSON.stringify([]),
        }
      }
      throw new Error('Failed to list requests')
    }

    const files = await listRes.json()
    
    // Filter files by date prefix
    const dateFiles = files.filter((f: { name: string }) => 
      f.name.startsWith(date) && f.name.endsWith('.json')
    )

    // Fetch each file's content
    const requests: Request[] = []
    for (const file of dateFiles) {
      const contentRes = await fetch(file.download_url)
      if (contentRes.ok) {
        const content = await contentRes.json()
        requests.push(content)
      }
    }

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-cache',
      },
      body: JSON.stringify(requests),
    }
  } catch (error) {
    console.error('Error fetching requests:', error)
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Failed to fetch requests' }),
    }
  }
}

export { handler }
```

- [ ] **Step 2: Commit**

```bash
git add netlify/functions/requests.ts
git commit -m "feat: add api endpoint to fetch requests by date"
```

---

## Task 11: Update Print Layout for Bloques

**Files:**
- Modify: `app/setlist/imprimir/page.tsx`

- [ ] **Step 1: Read current print page**

Familiarize with the existing implementation at `app/setlist/imprimir/page.tsx`

- [ ] **Step 2: Update the print page for bloque grouping**

Replace the content of `app/setlist/imprimir/page.tsx` with the bloque-grouped version:

```tsx
// app/setlist/imprimir/page.tsx
'use client'

import { useState, useEffect, useMemo } from 'react'
import { getGroupedByBloque } from '@/lib/songs'
import { Bloque, Song, getBloqueColor, getBloqueName } from '@/lib/types'

const BLOQUES_MAIN: Bloque[] = [1, 2, 3, 4]

export default function SetlistPrint() {
  const [mounted, setMounted] = useState(false)

  const songsByBloque = useMemo(() => getGroupedByBloque(), [])
  const extras = songsByBloque['extras']
  const hasExtras = extras.length > 0

  useEffect(() => { setMounted(true) }, [])

  if (!mounted) return null

  return (
    <>
      <title>Repertorio Imprimible — RetroGroove</title>

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700&family=Bebas+Neue&display=swap');
        
        @page { size: A4; margin: 0; }
        
        * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }

        .print-page {
          --pink: #ff1493;
          --gold: #ffd700;
          --cyan: #00e5ff;
          --purple: #bf00ff;
          min-height: 100vh;
          background: linear-gradient(180deg, #050010 0%, #0d0025 50%, #050010 100%);
          color: #fff;
          font-family: 'Outfit', sans-serif;
        }

        .page {
          width: 210mm;
          min-height: 297mm;
          padding: 10mm;
          box-sizing: border-box;
          page-break-after: always;
          background: linear-gradient(180deg, #050010 0%, #0d0025 50%, #050010 100%);
          display: flex;
          flex-direction: column;
        }

        .page:last-child {
          page-break-after: auto;
        }

        .header {
          text-align: center;
          margin-bottom: 8mm;
        }

        .header h1 {
          font-family: 'Bebas Neue', sans-serif;
          font-size: 2.2rem;
          letter-spacing: 0.15em;
          color: #fff;
          text-shadow: 0 0 10px rgba(255,20,147,0.4);
          margin: 0;
        }

        .header .sub {
          font-size: 0.7rem;
          letter-spacing: 0.3em;
          color: rgba(255,255,255,0.6);
          text-transform: uppercase;
          margin-top: 2mm;
        }

        .bloques-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 5mm;
          flex: 1;
        }

        .bloque-card {
          background: rgba(255,255,255,0.03);
          border: 1px solid rgba(255,255,255,0.08);
          border-radius: 8px;
          padding: 4mm;
          page-break-inside: avoid;
        }

        .bloque-header {
          font-family: 'Bebas Neue', sans-serif;
          font-size: 1.1rem;
          letter-spacing: 0.08em;
          padding-bottom: 2mm;
          margin-bottom: 2mm;
          border-bottom: 1px solid rgba(255,255,255,0.1);
        }

        .song-list {
          display: flex;
          flex-direction: column;
          gap: 1mm;
        }

        .song-row {
          display: flex;
          justify-content: space-between;
          align-items: baseline;
          font-size: 0.75rem;
          line-height: 1.4;
        }

        .song-title {
          font-weight: 500;
          color: #eee;
        }

        .song-artist {
          font-size: 0.65rem;
          color: rgba(255,255,255,0.5);
          text-align: right;
          margin-left: 2mm;
        }

        .extras-section {
          flex: 1;
        }

        .extras-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 1mm 8mm;
        }

        .qr-footer {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 5mm;
          padding: 4mm;
          background: rgba(255,255,255,0.03);
          border: 1px solid rgba(255,255,255,0.1);
          border-radius: 8px;
          margin-top: auto;
        }

        .qr-frame {
          width: 18mm;
          height: 18mm;
          background: #fff;
          border-radius: 4px;
          display: flex;
          align-items: center;
          justify-content: center;
          overflow: hidden;
        }

        .qr-frame img {
          width: 100%;
          height: 100%;
          object-fit: contain;
          padding: 1mm;
        }

        .qr-text {
          text-align: left;
        }

        .qr-text h3 {
          font-family: 'Bebas Neue', sans-serif;
          font-size: 1rem;
          color: #fff;
          margin: 0 0 1mm;
        }

        .qr-text p {
          font-size: 0.7rem;
          color: rgba(255,255,255,0.6);
          margin: 0;
          line-height: 1.4;
        }

        .qr-text strong {
          color: var(--gold);
        }

        /* Screen only toolbar */
        @media screen {
          .toolbar {
            position: sticky;
            top: 0;
            z-index: 100;
            display: flex;
            align-items: center;
            justify-content: space-between;
            padding: 0.6rem 1.5rem;
            background: rgba(5,0,16,0.95);
            border-bottom: 1px solid rgba(255,255,255,0.1);
          }

          .toolbar a {
            color: rgba(255,255,255,0.5);
            text-decoration: none;
            font-size: 0.85rem;
          }

          .toolbar a:hover {
            color: var(--gold);
          }

          .print-btn {
            padding: 0.5rem 1.2rem;
            background: linear-gradient(135deg, var(--pink), var(--purple));
            color: #fff;
            border: none;
            border-radius: 8px;
            font-family: 'Outfit', sans-serif;
            font-weight: 600;
            cursor: pointer;
          }

          .print-btn:hover {
            opacity: 0.9;
          }
        }

        @media print {
          .toolbar {
            display: none !important;
          }
        }
      `}</style>

      <div className="print-page">
        <div className="toolbar">
          <a href="/setlist">← Volver al repertorio</a>
          <button className="print-btn" onClick={() => window.print()}>
            🖨️ Imprimir / PDF
          </button>
        </div>

        {/* Page 1: Main Bloques */}
        <div className="page">
          <div className="header">
            <h1>RETROGROOVE — REPERTORIO</h1>
            <p className="sub">Disco • Rock • En Vivo</p>
          </div>

          <div className="bloques-grid">
            {BLOQUES_MAIN.map(bloque => (
              <div key={bloque} className="bloque-card">
                <div className="bloque-header" style={{ color: getBloqueColor(bloque) }}>
                  {getBloqueName(bloque)}
                </div>
                <div className="song-list">
                  {songsByBloque[bloque].map(song => (
                    <div key={song.id} className="song-row">
                      <span className="song-title">{song.title}</span>
                      <span className="song-artist">{song.artist}</span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>

          <div className="qr-footer">
            <div className="qr-frame">
              <img src="/images/plin-qr.jpg" alt="QR Plin" />
            </div>
            <div className="qr-text">
              <h3>¡Pide tu canción!</h3>
              <p>Escanea el QR, yapea y pide tu favorita.<br /><strong>¡Gracias por el apoyo!</strong></p>
            </div>
          </div>
        </div>

        {/* Page 2: Extras */}
        {hasExtras && (
          <div className="page">
            <div className="header">
              <h1>EXTRAS</h1>
              <p className="sub">Encores • Favoritos • Deep Cuts</p>
            </div>

            <div className="extras-section">
              <div className="bloque-card" style={{ height: '100%' }}>
                <div className="extras-grid">
                  {extras.map(song => (
                    <div key={song.id} className="song-row">
                      <span className="song-title">{song.title}</span>
                      <span className="song-artist">{song.artist}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="qr-footer">
              <div className="qr-frame">
                <img src="/images/plin-qr.jpg" alt="QR Plin" />
              </div>
              <div className="qr-text">
                <h3>¡Pide tu canción!</h3>
                <p>Escanea el QR, yapea y pide tu favorita.<br /><strong>¡Gracias por el apoyo!</strong></p>
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  )
}
```

- [ ] **Step 3: Commit**

```bash
git add app/setlist/imprimir/page.tsx
git commit -m "feat: update print layout with bloque grouping and qr on both pages"
```

---

## Task 12: Environment Variables Setup

**Files:**
- Create: `.env.example`
- Update: `netlify.toml`

- [ ] **Step 1: Create environment example file**

```bash
# .env.example
# GitHub token with repo write access for the submit-request function
GITHUB_TOKEN=ghp_xxxxxxxxxxxxxxxxxxxx

# GitHub repo in format owner/repo
GITHUB_REPO=yourusername/retrogroove-site

# Bcrypt hash of the band password (RetroGroove$B4nd)
# Generate with: node -e "console.log(require('bcryptjs').hashSync('RetroGroove\$B4nd', 10))"
NEXT_PUBLIC_BAND_PASSWORD_HASH=$2a$10$xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

- [ ] **Step 2: Add .env to gitignore if not already**

```bash
grep -q "^\.env$" .gitignore || echo ".env" >> .gitignore
grep -q "^\.env\.local$" .gitignore || echo ".env.local" >> .gitignore
```

- [ ] **Step 3: Commit**

```bash
git add .env.example .gitignore
git commit -m "docs: add environment variables example"
```

---

## Task 13: Final Testing & Verification

- [ ] **Step 1: Install dependencies**

```bash
npm install
```

- [ ] **Step 2: Run the seed script**

```bash
npx tsx scripts/seed-songs.ts
```

- [ ] **Step 3: Start development server**

```bash
npm run dev
```

- [ ] **Step 4: Verify routes work**

Open in browser:
- http://localhost:3000 — Landing page
- http://localhost:3000/setlist — Repertoire
- http://localhost:3000/setlist/imprimir — Print view with bloques
- http://localhost:3000/pedir — Request page
- http://localhost:3000/band — Band dashboard (password: RetroGroove$B4nd)
- http://localhost:3000/admin — Decap CMS (needs Netlify Identity)

- [ ] **Step 5: Test print layout**

On `/setlist/imprimir`, click "Imprimir / PDF" and verify:
- Page 1 has Bloques 1-4 in 2x2 grid
- Page 2 has Extras
- QR footer appears on both pages

- [ ] **Step 6: Final commit**

```bash
git add -A
git commit -m "chore: final setup and verification"
```

---

## Environment Setup for Production (Netlify)

After deploying, configure these in Netlify:

1. **Enable Netlify Identity** for Decap CMS
2. **Enable Git Gateway** in Identity settings
3. **Add environment variables:**
   - `GITHUB_TOKEN` — Personal access token with repo write access
   - `GITHUB_REPO` — `yourusername/retrogroove-site`
   - `NEXT_PUBLIC_BAND_PASSWORD_HASH` — Bcrypt hash of `RetroGroove$B4nd`

---

## Summary

| Task | Description |
|------|-------------|
| 1 | Install dependencies (nanoid, bcryptjs) |
| 2 | Create shared TypeScript types |
| 3 | Create song seeding script |
| 4 | Create song data utilities |
| 5 | Set up Decap CMS |
| 6 | Create Netlify function for request submission |
| 7 | Create fan request page (/pedir) |
| 8 | Create band auth utilities |
| 9 | Create band dashboard (/band) |
| 10 | Create requests API endpoint |
| 11 | Update print layout for bloques |
| 12 | Environment variables setup |
| 13 | Final testing & verification |
