# Ticketing Redesign — Batch 5: Admin Event Builder — Implementation Plan

> Site repo `/home/visiond/projects/retrogroove-site`, branch **main** (commit on main, DON'T switch branches).
> Mockup: `docs/design/ticketing-redesign/05-admin-event-builder.html` (+ `_brainstorm-source/admin-builder-positioning.html`).
> Build on Batch-2 design system + the now-redesigned buyer SeatMap (B3) so the admin preview is identical
> to what fans see ("lo que ves es lo que compran"). Toolchain: nvm node22. TDD (Playwright mocked-admin-API).

**Goal:** Rework `app/band/tickets/nuevo/page.tsx` into the Neon-Editorial event builder: event/venue/description/map
inputs, a **positionable + resizable stage**, **tables placed at true pos_x/pos_y with size + shape (+ snap grid)**,
and a **tarifa/bundle editor** (qty→price, add tiers beyond 2). The buyer map must render identically to the admin layout.

**Admin API (`lib/ticketing/admin.ts` `adminApi`):** `login`, `createEvent(attrs)`, `publishEvent(id)`,
`createSection(eventId, attrs)`, `createTable(sectionId, attrs)`, `createSeat`, `createPhase(eventId, attrs)`,
`createBundle(sectionId, attrs)` (POST /sections/:id/price-bundles, body `{price_bundle:{quantity,price,phase_id}}`),
`createPromo`, `compOrder`, `buyersCsv`. Gated by `AdminGate` (token in localStorage `rg_admin_token`).

## Global constraints
- Pixel-faithful to `05`; Neon-Editorial tokens only; body text never `#FFF`.
- Event attrs sent to `createEvent`: name, venue_name, venue_address, venue_photo_url, map_url, description,
  starts_at, canvas_width/height, **stage_x/stage_y/stage_w/stage_h**.
- Table attrs to `createTable`: label, seat_count, **size**, shape (round/rect), seating (around/rows), pos_x, pos_y.
- Bundle tiers: arbitrary `quantity` rows (1→price, 2→price, 3→price…) each `createBundle` with the section + phase.
- The admin canvas + the buyer `SeatMap` (from B3) must use the SAME coordinate model so the preview matches the buy page.

## Tasks (TDD: failing mocked-admin test → impl → green; each its own commit)
1. **Restyle shell + event/venue/description/map inputs** to `05` (Neon Editorial). Commit: `feat: admin builder — neon-editorial shell + event/venue/map inputs`
2. **Stage placement:** a canvas where the stage block can be dragged + resized (or numeric x/y/w/h inputs as a faithful fallback); writes `stage_*`. Show it on the same canvas the tables use. Commit: `feat: admin builder — positionable, resizable stage writes stage geometry`
3. **Section + table placement:** add sections (name, layout_type, capacity); place tables on the canvas at pos_x/pos_y with **size + shape + seat_count**, snap-to-grid; live preview reuses the buyer SeatMap render. Commit: `feat: admin builder — place sized tables on a snap grid with a live buyer preview`
4. **Tarifa/bundle editor:** rows of `quantity → price`; "Agregar tarifa" adds tiers beyond 2; on save, `createPhase` then `createBundle` per row (phase_id linked). Commit: `feat: admin builder — multi-tier tarifa/bundle editor`
5. **Publish + verify preview parity:** publish the event; assert the admin preview canvas and the buyer `/evento` seat map render the same stage/table positions. Commit: `feat: admin builder — publish + buyer-preview parity`

## Acceptance / Done-when
Playwright (mocked adminApi) builds an event end-to-end: event+venue+map, placed/sized stage + tables, ≥3 bundle tiers,
publish. The buyer map renders identically to the admin canvas. Visual diff vs `05`. `npm run build` clean; no e2e regression.
Pragmatic scope: drag-resize is ideal; numeric inputs are an acceptable faithful fallback if drag proves heavy — the
REQUIREMENT is that admin-set geometry round-trips and the buyer map matches. Document any drag-polish deferral.
