# Ticketing Redesign — Batch 3: Fan Flow Pages (F1–F5) — Implementation Plan

> Batch 3 of the roadmap. Spec `docs/superpowers/specs/2026-06-17-ticketing-redesign-design.md` §5.
> Visual contract: `docs/design/ticketing-redesign/` (`F1`–`F5`, `01`–`04`, `_brainstorm-source/seat-layouts.html`).
> Build on the Batch-2 design system (`components/ui/`, `@theme` tokens). Execute with TDD + visual fidelity.
> Frontend toolchain: `export PATH="/home/visiond/.nvm/versions/node/v22.21.1/bin:$PATH"`.

**Goal:** Rebuild the fan-facing buy lifecycle pixel-faithful to the mockups, with the locked UX wins:
no upfront buyer form, auto-applied combo pricing with savings, realistic seat maps from the new backend
geometry, Mapa↔Lista toggle, 20-min hold, and a polished tickets page wired to the PDF download.

**Read first:** the `components/ui/*` exports + props (Button variant primary/ghost/secondary, Card, Chip,
Badge, Money `value`+`prefix`, SeatLegend, OrderSummary `{items, comboDiscount, total}`, SectionEyebrow, Nav,
Footer); `lib/ticketing/api.ts` (getEvent, createOrder, createGeneralOrder, payOrder, getTicket);
`lib/ticketing/culqi.ts` (getCulqiToken — currently throws; window.__CULQI_TEST_TOKEN__ test path);
the current `app/evento/EventBuy.tsx`, `app/t/TicketView.tsx`; the mock `e2e/ticketing/fixtures.ts`.

## Global constraints (bind every task — copy to reviewer)
- **Pixel-faithful to the mockups.** Translate each `F*`/`0*` mockup's layout + component CSS 1:1 using the
  Batch-2 tokens/components. Surface any deviation; do not silently drift. Visual diff is the gate.
- **Static export** → keep `?slug=` / `?token=` query-param routing (no `[id]` routes).
- **No upfront buyer form** anywhere in the flow. Name/email come from the Culqi charge; ask name AFTER paying
  only if the charge returned none.
- **Combo auto-applies**: the order summary shows subtotal → combo discount (gold) → TOTAL, with savings,
  computed from the event's bundles (backend `Pricing.bundle_total` greedy-pack; surface the saving amount).
- Money everywhere via `<Money>` → `S/ 340.00`; "Desde S/ XX" on listing/pricing.
- Body text `#ECE6F0`, never pure `#FFF`. Tokens only — no new hardcoded hex that duplicates a token.
- Keep the existing mocked-API e2e flow GREEN (update selectors for the new UI), and the Culqi test-stub path working.

---

### Task 1: F1 — Event detail page
**Files:** `app/evento/EventBuy.tsx` (the "detail/select-entry" view), maybe split a presentational
`app/evento/EventDetail.tsx`. Mockup: `F1-event-page.html`, `01-event-detail.html`.
- Hero (flyer image, title in Bebas, date in cyan, venue name); **venue section** (venue_photo_url + venue_address
  + "Cómo llegar" linking `map_url`); description; pricing list (per-section `Desde S/ XX` + combo notes);
  **sticky buy box** (`top: 84px`) with primary CTA "Comprar entradas" / "Seleccionar asientos".
- Consume the new serialized fields: `venue_address`, `venue_photo_url`, `map_url`, `description`.
- [ ] TDD: a Playwright test (mocked API) asserting F1 renders the title, venue address, a working "Cómo llegar"
      link (href = map_url), the `Desde S/ XX` price, and the sticky CTA. RED→GREEN.
- [ ] Update `e2e/ticketing/fixtures.ts` so the mock event includes the new fields (venue/map/stage/table size).
- [ ] Commit: `feat: F1 event detail — hero, venue + map, pricing, sticky buy box`

### Task 2: F2 — Seat selection (the centerpiece)
**Files:** `app/evento/EventBuy.tsx` select step + a `SeatMap` component (`app/evento/SeatMap.tsx`).
Mockups: `F2-seat-selection-page.html`, `_brainstorm-source/seat-layouts.html`, `02-seat-selection.html`.
- **Realistic floor plan to scale:** render the **stage** from `stage_x/stage_y/stage_w/stage_h`; render **tables**
  at true `pos_x/pos_y` sized by `size` with seats arranged around; seat dots ~11px (cyan ring = disponible,
  solid pink + glow = seleccionado, faint = ocupado) — use `<SeatLegend>`.
- **Three layouts** by section seating style: mesas (tables), teatro (rows/filas), arena (zonas — zone-first
  drill-down). Pick layout per section type from the serialized data.
- **Mapa ↔ Lista** toggle (pill segmented; **Lista is primary on mobile**). Deal chips (gold) on combo sections.
- **Sticky order summary** via `<OrderSummary>`: subtotal, **auto-applied combo discount + savings**, TOTAL;
  **20-min hold countdown** once seats are selected (createOrder holds them).
- [ ] TDD: mocked-API test — select 2 seats in a combo section → summary shows the combo discount + savings +
      correct total; toggle Mapa/Lista renders both; selected seat reflects state. RED→GREEN.
- [ ] Commit: `feat: F2 seat selection — true-scale map, 3 layouts, Mapa/Lista, auto-combo summary, 20-min hold`

### Task 3: F3 — Checkout / payment (remove buyer form, wire Culqi)
**Files:** `app/evento/EventBuy.tsx` pay step, `app/layout.tsx` (load Culqi.js), `lib/ticketing/culqi.ts`,
`.env.example`. Mockups: `F3-payment-page.html`, `03-checkout.html`.
- **Remove the buyer form.** Render the order summary (line items, removes, subtotal, combo discount, TOTAL) and a
  single **"Pagar con Culqi"** button → `getCulqiToken()` → `payOrder(orderId, token)`. Powered-by glyphs are
  informational only.
- **Wire Culqi.js:** load `https://checkout.culqi.com/js/v3` in `layout.tsx`; set `Culqi.publicKey` from
  **`NEXT_PUBLIC_CULQI_PUBLIC_KEY`** (add to `.env.example`); implement `getCulqiToken()` to open the Culqi form
  and resolve the token. **Keep the `window.__CULQI_TEST_TOKEN__` test path** so e2e/demo still work without real Culqi.
- [ ] TDD: mocked-API test — checkout shows NO buyer-info inputs; clicking "Pagar con Culqi" (test token) calls
      payOrder and advances to success. RED→GREEN.
- [ ] Commit: `feat: F3 checkout — no buyer form, single Pagar con Culqi, wire Culqi.js via env`

### Task 4: F4 — Success page
**Files:** `app/evento/EventBuy.tsx` confirm step. Mockup: `F4-success-page.html`.
- Confirmation + ticket links (open `/t?token=`). **Ask-name-after card shown ONLY when the charge returned no
  name** (the paid order/response indicates missing name). If present, no card.
- [ ] TDD: mocked-API — paid order WITHOUT name → ask-name card visible + submitting it patches the name; paid
      order WITH name → no card. RED→GREEN.
- [ ] Commit: `feat: F4 success — ticket links + ask-name-after only when missing`

### Task 5: F5 — Mis entradas (tickets page) + PDF download
**Files:** `app/t/TicketView.tsx`, maybe `app/t/page.tsx`. Mockups: `F5-tickets-page.html`, `04-ticket-qr.html`.
- Each ticket as a card: QR **on white**, code, seat/zone, event/date, check-in status. Actions: Wallet (stub —
  Phase 2), Compartir, **Descargar PDF** → `GET {API}/tickets/:token/pdf` (from Batch 4).
- [ ] TDD: mocked-API — ticket card renders QR + code + seat; "Descargar PDF" points at the pdf endpoint URL.
- [ ] Commit: `feat: F5 mis entradas — ticket cards, QR on white, descargar PDF`

### Task 6: Visual fidelity pass (anti-drift gate)
- [ ] Run `npx playwright test --config playwright.visual.config.ts` to screenshot the built F1–F5 pages and
      compare against the mockups. Document any **intentional** deviation in `docs/design/ticketing-redesign/`.
      Fix unintended drift. (Real data will differ from the mockups' sample text — match LAYOUT/STYLING, not sample copy.)
- [ ] Confirm `npm run build` clean and the full `e2e/ticketing/*` suite green.
- [ ] Commit: `style: F1–F5 visual fidelity pass against the mockups`

---

## Done-when
Mocked-API flow select→pay(test token)→success→tickets green; combo auto-applies with savings; NO buyer form;
ask-name only when missing; F5 wired to PDF download; visual diff vs F1–F5 acceptable (deviations documented);
`npm run build` clean. New env documented: `NEXT_PUBLIC_CULQI_PUBLIC_KEY`. Then write Batch 5 (admin) + Batch 6 (check-in) plans.

## Self-review (plan vs spec §5)
F1→T1, F2→T2 (new stage/table geometry from B1), F3→T3 (+Culqi wiring), F4→T4, F5→T5 (+B4 PDF), anti-drift→T6.
No buyer form (§3) enforced in T3. Combo auto-apply (§6.5) in T2/T3 summary.
