# RetroGroove Setlist & Song Request System

**Date:** 2026-04-25  
**Status:** Approved  

## Overview

Enhance the RetroGroove band website with:
1. Decap CMS for content management
2. Song database seeded from YouTube playlist with bloque assignments
3. Pre-seeded setlists (Bloque 1-4 + Extras)
4. Fan song request system with Yape donation verification
5. Band dashboard for managing requests during live shows
6. Enhanced print layout grouped by bloques

## Requirements Summary

| # | Requirement | Details |
|---|-------------|---------|
| 1 | Decap CMS | Manage songs, events, view requests |
| 2 | Seed songs | From YouTube playlist, assign bloques by position |
| 3 | Pre-seed setlists | Bloque 1 (1-14), Bloque 2 (15-30), Bloque 3 (31-45), Bloque 4 (46-60), Extras (61+) |
| 4 | Print layout | Bloques grouped, QR on both pages, max 2 pages (front/back) |
| 5 | Request system | Fan submits via /pedir with Yape op number + optional screenshot |
| 6 | Band dashboard | /band with password auth, ranked requests, "Tocada" toggle |
| 7 | Events | Explicit in Decap + auto-group requests by date |
| 8 | CI | Current setup (push to main → deploy) works, verify Decap compatibility |

---

## 1. Data Architecture

### File Structure

```
retrogroove-site/
├── content/
│   ├── songs.json              # All songs with metadata
│   ├── events/
│   │   └── YYYY-MM-DD.json     # Event definitions
│   └── requests/
│       └── YYYY-MM-DD_<id>.json  # Individual fan requests
│
├── public/
│   └── admin/
│       └── index.html          # Decap CMS entry point
│
├── netlify/
│   └── functions/
│       └── submit-request.ts   # API for fan submissions
│
└── app/
    ├── pedir/page.tsx          # Fan request page
    └── band/page.tsx           # Band dashboard
```

### Song Schema

```typescript
interface Song {
  id: string              // slug: "musica-ligera"
  title: string           // "Música Ligera"
  artist: string          // "Soda Stereo"
  bloque: 1 | 2 | 3 | 4 | 'extras'
  youtubePosition: number // Position in YouTube playlist (1-indexed)
  enabled: boolean        // Can be disabled per-event in dashboard
}
```

### Bloque Assignment Rules

| YouTube Position | Bloque |
|------------------|--------|
| 1 – 14           | Bloque 1 |
| 15 – 30          | Bloque 2 |
| 31 – 45          | Bloque 3 |
| 46 – 60          | Bloque 4 |
| 61+              | Extras |

### Event Schema

```typescript
interface Event {
  date: string      // "2026-04-26"
  name: string      // "Sábado en La Noche"
  venue?: string    // "Bar XYZ"
  notes?: string    // Internal notes
}
```

### Request Schema

```typescript
interface Request {
  songId: string        // References song.id
  opNumber: string      // Yape operation number
  screenshot?: string   // Optional base64 or URL
  name?: string         // Fan's name (optional)
  timestamp: string     // ISO timestamp
}
```

**Filename format:** `YYYY-MM-DD_<nanoid>.json`

Example: `2026-04-26_a1b2c3d4.json`

---

## 2. Pages & Routes

| Route | Purpose | Auth |
|-------|---------|------|
| `/` | Landing page | Public |
| `/setlist` | Full repertoire | Public |
| `/setlist/imprimir` | Print view with bloques | Public |
| `/pedir` | Fan song request form | Public |
| `/band` | Band dashboard | Password |
| `/admin` | Decap CMS | GitHub OAuth |

---

## 3. Fan Request Flow (`/pedir`)

### User Journey

1. **Scan QR** at venue (or access URL directly)
2. **See guide:** "1. Yapea al número X → 2. Copia el número de operación → 3. Pide tu canción"
3. **Browse songs** grouped by bloque (only enabled songs shown)
4. **Select song** to request
5. **Fill form:**
   - Operation number (required)
   - Screenshot upload (optional, for faster verification)
   - Name (optional)
6. **Submit** → Netlify function creates request file
7. **Confirmation** shown

### UI Components

- Visual Yape guide with band's phone number
- Song browser with bloque tabs/sections
- Form with validation
- Success/error feedback

### Netlify Function: `submit-request.ts`

```typescript
// POST /api/submit-request
// Body: { songId, opNumber, screenshot?, name? }
// Creates: content/requests/YYYY-MM-DD_<nanoid>.json
// Uses GitHub API to commit file
```

---

## 4. Band Dashboard (`/band`)

### Authentication

- Simple password gate
- Password: `RetroGroove$B4nd` (stored as bcrypt hash in env var)
- Session stored in localStorage after successful auth

### Features

1. **Today's requests** — auto-filtered by current date
2. **Request ranking** — songs sorted by request count (descending)
3. **"Tocada" toggle** — marks song as played, grays it out
4. **Date picker** — view requests from other dates
5. **Event info** — shows event name/venue if defined in Decap

### UI Mockup

```
┌─────────────────────────────────────────────────┐
│ 🔥 Sábado 26 Abril — Bar XYZ                    │
├─────────────────────────────────────────────────┤
│ Música Ligera — Soda Stereo          [12] [✓]  │
│ Lamento Boliviano — Enanitos Verdes  [8]  [✓]  │
│ ░░ Persiana Americana ░░ (ya tocada) ░░░░░░░░  │
│ Zombie — The Cranberries             [5]  [✓]  │
└─────────────────────────────────────────────────┘
```

### Data Flow

- Reads all `content/requests/YYYY-MM-DD_*.json` files
- Groups by songId, counts occurrences
- Joins with songs.json for metadata
- "Tocada" state stored in localStorage (per-date, per-song)

---

## 5. Print Layout (`/setlist/imprimir`)

### Changes from Current

| Current | New |
|---------|-----|
| Flat alphabetical list | Grouped by bloque |
| Single QR footer | QR footer on BOTH pages |
| No bloque headers | Colored bloque headers |
| Arbitrary pagination | Smart pagination (max 2 pages) |

### Layout Structure

**Page 1 (Front):**
```
┌─────────────────────────────────────────┐
│           RETROGROOVE REPERTORIO        │
├──────────────────┬──────────────────────┤
│ BLOQUE 1 (pink)  │ BLOQUE 2 (gold)      │
│ 1. Song          │ 15. Song             │
│ 2. Song          │ 16. Song             │
│ ...              │ ...                  │
├──────────────────┼──────────────────────┤
│ BLOQUE 3 (cyan)  │ BLOQUE 4 (purple)    │
│ 31. Song         │ 46. Song             │
│ ...              │ ...                  │
├──────────────────┴──────────────────────┤
│ [QR] ¡Pide tu canción! Escanea con Yape │
└─────────────────────────────────────────┘
```

**Page 2 (Back):**
```
┌─────────────────────────────────────────┐
│              EXTRAS                     │
│ 61. Song          62. Song              │
│ 63. Song          64. Song              │
│ ...               ...                   │
├─────────────────────────────────────────┤
│ [QR] ¡Pide tu canción! Escanea con Yape │
└─────────────────────────────────────────┘
```

### Pagination Rules

- Try to fit Bloques 1-4 on page 1
- Extras on page 2
- If bloques overflow, they flow to page 2 (never split mid-bloque)
- Max 2 pages total (front and back of one sheet)
- Use CSS `page-break-inside: avoid` on bloque containers

---

## 6. Decap CMS Configuration

### Collections

**Songs:**
- Fields: id, title, artist, bloque (select), youtubePosition, enabled (boolean)
- File: `content/songs.json` (single file with array)

**Events:**
- Fields: date, name, venue, notes
- Folder: `content/events/`
- Filename: `{{date}}.json`

**Requests:**
- Fields: songId, opNumber, screenshot, name, timestamp
- Folder: `content/requests/`
- View/delete only (created by API, not manually)

### Config File: `public/admin/config.yml`

```yaml
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
    slug: "{{date}}"
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
    fields:
      - { name: songId, label: Song ID, widget: string }
      - { name: opNumber, label: Operation Number, widget: string }
      - { name: screenshot, label: Screenshot, widget: image, required: false }
      - { name: name, label: Name, widget: string, required: false }
      - { name: timestamp, label: Timestamp, widget: datetime }
```

---

## 7. Seeding Strategy

### Source

YouTube playlist: https://www.youtube.com/playlist?list=PLiDkOLwlS9hTwxnQ-dX6pUsd1_jLNbehW

### Process

1. Extract song list from playlist (title + artist from video titles)
2. Cross-reference with existing `data/setlist.ts` (84 songs already there)
3. Assign bloque based on position:
   - Position 1-14 → Bloque 1
   - Position 15-30 → Bloque 2
   - Position 31-45 → Bloque 3
   - Position 46-60 → Bloque 4
   - Position 61+ → Extras
4. Generate `content/songs.json` with all songs
5. All songs enabled by default

### Pre-seeded Setlists

The bloques ARE the setlists. They're pre-defined by the YouTube playlist order:

- **Bloque 1:** First 14 songs (opening set)
- **Bloque 2:** Songs 15-30 (second set)
- **Bloque 3:** Songs 31-45 (third set)
- **Bloque 4:** Songs 46-60 (fourth set)
- **Extras:** Songs 61+ (encores, fan favorites, deep cuts)

---

## 8. CI/CD Considerations

### Current Setup

- Netlify detects push to `main` → auto-deploy
- Only Alexander has push access

### Decap Compatibility

- Decap uses git-gateway which commits to repo
- Each Decap save = git commit → triggers Netlify deploy
- This is expected behavior, no changes needed

### Environment Variables Needed

```
GITHUB_TOKEN=<for submit-request function>
BAND_PASSWORD_HASH=<bcrypt hash of RetroGroove$B4nd>
```

### Netlify Functions

- Add `netlify/functions/` directory
- Function `submit-request.ts` needs GitHub API access to create request files

---

## 9. Technical Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| CMS | Decap | Git-based, free, fits Netlify |
| Request storage | Individual JSON files | No race conditions, easy cleanup |
| Auth (band) | Hashed password | Simple, band-only access |
| Auth (admin) | GitHub OAuth via Decap | Standard Decap flow |
| Screenshot storage | Base64 in request JSON | Keep it simple, optional field, cleaned up with requests |
| Real-time updates | None (page refresh) | Sufficient for venue use |

---

## 10. Out of Scope

- Real-time WebSocket updates
- Multiple simultaneous events
- Payment verification (trust-based with op number)
- User accounts for fans
- Mobile app

---

## Implementation Order

1. **Decap setup** — config, admin page, git-gateway
2. **Seed songs** — extract from playlist, create songs.json
3. **Print layout** — adapt existing page for bloques
4. **Request page** — /pedir with form and Netlify function
5. **Band dashboard** — /band with password auth
6. **Testing** — end-to-end flow verification
7. **QR code** — generate for /pedir URL

---

## Success Criteria

- [ ] Decap CMS accessible at /admin with GitHub login
- [ ] All songs seeded with correct bloque assignments
- [ ] Print view shows bloques grouped, QR on both pages
- [ ] Fans can submit requests via /pedir
- [ ] Band can view ranked requests at /band
- [ ] Band can mark songs as "Tocada"
- [ ] Requests grouped by date automatically
- [ ] Events can be created in Decap
