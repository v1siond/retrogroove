# Ticketing Redesign — Batch 6: Door Check-in — Implementation Plan

> Site repo, branch **main** (commit on main, DON'T switch branches). Rework `app/band/tickets/check-in/page.tsx`
> (currently 133 lines). Mockup: `docs/design/ticketing-redesign/_brainstorm-source/admin-and-checkin.html`.
> Build on Batch-2 design system. TDD (Playwright mocked-admin-API). Toolchain: nvm node22.

**Goal:** Restyle the door check-in to Neon Editorial with **big, unmistakable result states** for fast door work,
manual code entry + hardware-scanner paste. Camera QR scan stays **Phase 2** — leave a clear seam (a disabled/"próximamente"
"Escanear con cámara" affordance), don't build it.

**API:** `adminApi.checkIn(token)` → `POST /tickets/:token/check-in` → `{ ticket }`; `adminApi.getTicket(token)` to look up first.
Behind `AdminGate`. The backend returns the ticket with `checked_in_at`; a second check-in / unknown token are the error states.

## Global constraints
- Pixel-faithful to `admin-and-checkin.html`; Neon-Editorial tokens; body text never `#FFF`.
- Three big result states, each unmistakable at a glance under bad lighting:
  - **VÁLIDA** (green `--color-green`) — first successful check-in (show seat/zone, holder, event).
  - **YA USADA** (red `--color-red`) — already checked in (show when it was used: `checked_in_at`).
  - **NO ENCONTRADA** (red/neutral) — token not found.
- Input: a large text field for the **short code/token**; submitting on Enter (hardware scanners "type" the code then Enter).
  Big "Validar" button. After a result, quick "Siguiente" to clear and refocus for the next person.

## Tasks (TDD: failing mocked test → impl → green; commits per the messages)
1. **Restyle shell + manual-entry form** to the mockup (Neon Editorial, big input, focused-by-default, Enter submits).
   Commit: `feat: check-in — neon-editorial shell + manual code entry`
2. **Result states:** wire `checkIn`; render the three big states (Válida / Ya usada / No encontrada) with the right
   token-colors, ticket details on success, and the used-time on the already-used state. Auto-refocus for the next scan.
   Commit: `feat: check-in — big válida / ya usada / no encontrada result states`
3. **Phase-2 seam:** a visible but disabled "Escanear con cámara — próximamente" control (no camera code). 
   Commit: `feat: check-in — camera-scan seam (phase 2 stub)`

## Acceptance / Done-when
Playwright (mocked adminApi): a valid token → VÁLIDA with details; the same token again → YA USADA with the used time;
an unknown token → NO ENCONTRADA; Enter submits; focus returns after each. Visual diff vs the mockup. `npm run build` clean; no regression.
