# RetroGroove Ticketing Redesign — Implementation Roadmap

> **For agentic workers (incl. a fresh session):** This is the master roadmap. The full design
> is approved. Execute batch by batch with **superpowers:subagent-driven-development**. Each
> batch has its own detailed, bite-sized plan file (Batch 1 is written; write the next batch's
> detailed plan from this roadmap + the spec when you reach it). To resume after a session
> reset, read this file + the spec, then continue at the first unchecked batch.

**Goal:** Redesign the entire ticketing lifecycle (fan + admin) to the approved **Neon
Editorial** look with targeted UX wins, pixel-faithful to the mockups.

**Architecture:** Phoenix/Elixir JSON API (Railway) + Next.js static-export frontend
(Netlify, Tailwind v4). Backend changes land first (API shape), then the frontend design
system, then the surfaces. Culqi.js tokenization for payments.

**Tech Stack:** Elixir/Ecto/Phoenix, ExUnit; Next.js, Tailwind v4 (`@theme`), Playwright
(mocked-API e2e + `playwright.visual.config.ts` for fidelity).

## Source-of-truth documents
- **Spec:** `docs/superpowers/specs/2026-06-17-ticketing-redesign-design.md`
- **Visual contract (pixel-faithful):** `docs/design/ticketing-redesign/` — `DESIGN-TOKENS.md`,
  `F1`–`F6`, `05-admin-event-builder.html`, `_brainstorm-source/`, `README.md`
- **Anti-drift rule (memory):** approved mockups are the contract — implement exactly, verify
  with a screenshot diff against the `F*` files; surface any deviation before shipping.

## Repos
- API: `/home/visiond/projects/retrogroove_api` (branch `feat/ticketing`)
- Site: `/home/visiond/projects/retrogroove-site` (branch `feat/ticketing`)
- Toolchain (memory `retrogroove-dev-toolchain`): nvm node22 (frontend), asdf elixir + docker
  postgres (backend); backend tests need `PORT=4123`.

## Locked decisions (from brainstorming)
- Flow: **select → pay → tickets**, NO buyer form upfront; name/email from the Culqi charge,
  ask name AFTER paying only if missing.
- Combo pricing = generic `PriceBundle` (qty→price), greedy-packed; auto-applied + show savings.
- Admin: positionable/resizable **stage** + tables at true `pos_x/pos_y` with **per-table size**.
- Phase 2 (post-launch): camera QR scan, Apple/Google Wallet passes, time-gated QR.

---

## Batch sequence & dependencies

```
B1 Backend ──▶ B2 FE design system ──▶ B3 Fan flow ──┬──▶ B4 PDF e-ticket
                                                     ├──▶ B5 Admin builder
                                                     └──▶ B6 Door check-in
(later, separate stream) B7 Narrated video demo of the new UI
```

### Batch 1 — Backend foundation & API  ▶ DETAILED PLAN: `2026-06-17-ticketing-redesign-batch1-backend.md`
- [ ] Event: add `venue_address`, `venue_photo_url`, `map_url`, `stage_x`, `stage_y`,
      `stage_w`, `stage_h` (+ migration, castable). (`description`, `flyer_url` already exist.)
- [ ] Table: add `size` (+ migration, cast).
- [ ] Order: make `buyer_email` optional at creation (keep format validation when present).
- [ ] `Ticketing.confirm_paid`: set `buyer_email` from `charge["email"]` (+ existing name).
- [ ] `Pricing.bundle_total`: lock greedy-pack with qty-3/qty-4 tests (no code change expected).
- [ ] Serializer: expose new Event/Table fields.
- **Acceptance:** ExUnit green (`PORT=4123 mix test`); API returns new fields; order creatable
  without buyer email; paid order has email/name from the charge.

### Batch 2 — Frontend design system (Tailwind v4)
- **Files:** `app/globals.css` (`@theme` tokens from `DESIGN-TOKENS.md`); new
  `components/ui/` (Button, Input, Select, Card, Badge, Chip, SectionEyebrow, Money,
  OrderSummary, SeatLegend, Nav, Footer); deprecate/replace `lib/ticketing/ui.ts`.
- **Tasks:** define every token from `DESIGN-TOKENS.md` once in `@theme`; build the shared
  components to match the mockups' component CSS; Playwright component-content tests.
- **Acceptance:** components render the locked tokens; no per-component hardcoded hex that
  duplicates a token; visual spot-check vs. mockups.

### Batch 3 — Fan flow pages
- **Files:** event listing (home cards), `app/evento/EventBuy.tsx` (rework into event detail
  `F1` + seat selection `F2`), checkout `F3`, success `F4`, `app/t/*` tickets `F5`.
- **Tasks:** F1 (hero, description, venue+map, pricing list, sticky buy box); F2 (realistic
  tables to scale, 3 layouts mesas/teatro/arena, Mapa↔Lista, deal chips, neon legend, sticky
  summary with **auto-applied combo + savings**, 20-min hold); F3 (**remove buyer form**, single
  "Pagar con Culqi", powered-by glyphs); F4 (ticket links + ask-name-after only if missing);
  F5 ("Mis entradas", each ticket card, QR on white).
- **Acceptance:** Playwright mocked-API flow select→pay(test token)→success→tickets; combo
  auto-applies & shows savings; no buyer form; **visual diff vs. `F1`–`F5`**.

### Batch 4 — PDF e-ticket (`F6`)
- **Files:** backend PDF renderer (ChromicPDF or chosen HTML→PDF) + download endpoint +
  notifier attachment; frontend "Descargar PDF" wiring.
- **Tasks:** render the `F6` template per ticket (QR on white, tear-off stub); email + download.
- **Acceptance:** generated PDF matches `F6`; emailed + downloadable.

### Batch 5 — Admin event builder (`05`)
- **Files:** `app/band/tickets/nuevo/page.tsx` (+ admin event/section/table editors).
- **Tasks:** positionable/resizable **stage** (writes `stage_*`); tables at true `pos_x/pos_y`
  with **size + shape** controls + snap grid; **tarifa/bundle editor** (qty→price, add tiers
  beyond 2 → `createBundle` per row); venue/description/map inputs.
- **Acceptance:** Playwright admin builds an event with placed/sized stage+tables + multi-tier
  bundles; buyer map renders identically ("lo que ves es lo que compran"); **visual diff vs. `05`**.

### Batch 6 — Door check-in
- **Files:** `app/band/tickets/check-in/page.tsx`.
- **Tasks:** restyle to Neon Editorial; big result states (Válida/Ya usada/No encontrada);
  manual code entry + hardware-scanner paste. Camera QR scan = Phase 2 (leave a clear seam).
- **Acceptance:** Playwright check-in valid + already-used + not-found; **visual diff vs.
  `_brainstorm-source/admin-and-checkin.html`**.

### Batch 7 — Narrated video demo (separate stream, after the redesign ships)
- Record the full lifecycle of the **new** UI using the auditechme/hot-tub voiceover pipeline
  (`.claude-workspace/{auditechme,pmx}/voiceover/*`, `demo-video-playbook.md`): single
  mark-synced film, cursor + spotlight, edge-tts Spanish VO, captions, intro/outro. The repo
  already has `e2e/demo/` + `playwright.demo.config.ts` to build on.

## Cross-cutting acceptance (every batch)
- TDD: failing test → minimal code → green, both backend and frontend (per project memory).
- Visual fidelity: screenshot built page, diff against the matching `F*`/mockup; document any
  intentional deviation in `docs/design/ticketing-redesign/`.
- Commit frequently (ask before committing per repo convention).

## Self-review (roadmap vs. spec)
Every spec section maps to a batch: §3 flow → B1+B3; §4 design system → B2; §5 surfaces →
B3/B5/B6 + F1–F6; §6 backend → B1; §7 data → B1; §8 PDF → B4; §9 tests → all; §11 phasing →
B1–B6 (Phase 1) + Phase-2 deferrals noted in B6. No gaps.
