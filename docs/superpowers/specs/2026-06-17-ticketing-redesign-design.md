# RetroGroove Ticketing Redesign — Design Spec

- **Date:** 2026-06-17
- **Branch:** `feat/ticketing`
- **Status:** Approved (design); ready for implementation planning
- **Visual contract:** `docs/design/ticketing-redesign/` (mockups + `DESIGN-TOKENS.md` + `README.md`)

## 1. Summary

Bring the whole ticketing lifecycle up to the home page's polish, in a **Neon Editorial**
aesthetic, with targeted UX improvements drawn from Joinnus, Teleticket, DICE, Shotgun,
Resident Advisor, Eventbrite, and Ticketmaster. Keep the current architecture; do **not**
rewrite the flow wholesale. The approved mockups are the pixel-faithful contract.

**Aesthetic:** dark near-black `#08020e`, off-white body text `#ECE6F0` (never pure white),
neon (`#ff1493` pink primary, `#ffd700` gold, `#00e5ff` cyan, `#bf00ff` purple) for accents/
CTA/price/states only. Bebas Neue for display/CTA/prices; Outfit for body. Full token list in
`docs/design/ticketing-redesign/DESIGN-TOKENS.md`.

## 2. Scope

**In scope (Phase 1 / launch):** full lifecycle, fan + admin —
event listing & detail, seat selection (tables / theater rows / arena zones), checkout,
success, "Mis entradas", PDF e-ticket, admin event/stage builder, door check-in (manual entry).

**Deferred to Phase 2 (post-launch):**
- Camera QR scan at the door (launch = manual code entry / hardware-scanner paste).
- Real Apple/Google Wallet passes ("Agregar a Wallet" visible but stubbed).
- DICE-style "Activar entrada" time-gated/animated QR.

**Out of scope (separate stream):** the narrated end-to-end **video demo** — recorded
*after* this redesign ships, against the new UI (auditechme/hot-tub voiceover pipeline).

## 3. UX flow (locked)

`select tickets → pay → show tickets`. **No buyer form upfront.** The buyer's name/email come
from the Culqi charge; if Culqi returns no name, ask for it **after** paying (optional, to
personalize the ticket). This is the one intentional flow change vs. today.

## 4. Design system → implementation

- Frontend stack: **Next.js static export + Tailwind v4 (CSS-first)**. Static export → use
  `?id=` query params, not `[id]` routes.
- Centralize every token from `DESIGN-TOKENS.md` into the Tailwind v4 `@theme` block (one
  definition each), then build surfaces with **utility classes**, not per-component plain CSS.
  Replace the ad-hoc `lib/ticketing/ui.ts` strings with theme-driven utilities/components.
- The mockups' inline CSS is the visual source of truth; translate values 1:1 into tokens.

## 5. Surface-by-surface map (mockup → code)

| Surface | Mockup | Key implementation notes |
|---|---|---|
| Event listing (home) | (home, F1 cards) | Cards show `Desde S/ XX`; photo-forward; link via `?id=`. |
| Event detail | `F1-event-page.html` | Flyer hero, description, **venue section** (photo + address + "Cómo llegar" map), pricing list with combo notes, sticky buy box. New venue/description/map data (see §7). |
| Seat selection | `F2-seat-selection-page.html`, `_brainstorm-source/seat-layouts.html` | Realistic tables drawn to scale w/ seats around; **Mapa ↔ Lista** toggle (Lista primary on mobile); deal chips; neon legend; sticky order summary with **auto-applied combo + savings**; 20-min hold. Three layouts: mesas / teatro filas / arena zonas (zone-first drill-down). Rework `app/evento/EventBuy.tsx`. |
| Checkout / payment | `F3-payment-page.html`, `03-checkout.html` | **Remove buyer form.** Order summary + single "Pagar con Culqi" → `getCulqiToken()` → `payOrder`. Powered-by glyphs informational only. (See §6, §8.) |
| Success | `F4-success-page.html` | Confirmation + ticket links + optional ask-name-after card (shown only if charge had no name). |
| Mis entradas | `F5-tickets-page.html` | Each ticket as a card (reuse `04-ticket-qr.html`), QR on white, Wallet (stub) / Compartir / Descargar PDF. |
| PDF e-ticket | `F6-ticket-pdf.html` | A4, brand-dark, QR on white patch, tear-off door stub. Generation in §8. |
| Admin event builder | `05-admin-event-builder.html` | Positionable + resizable **stage**; tables at true `pos_x/pos_y` with **per-table size + shape**; snap-to-grid; **tarifa/bundle editor** (qty→price, add tiers beyond 2). Rework `app/band/tickets/nuevo/page.tsx`. |
| Door check-in | `_brainstorm-source/admin-and-checkin.html` | Restyle to Neon Editorial; big result states (Válida/Ya usada/No encontrada); manual code entry now, camera scan Phase 2. |

## 6. Backend changes

1. **Order without buyer info (new flow).** `Order.changeset` currently
   `validate_required([:event_id, :buyer_email])`. Make `buyer_email` optional at *creation*
   (still validate format when present). `create_order/create_general_order` accept empty
   `buyer_attrs`. By `pay`, the order must end up with an email.
2. **Fill buyer from charge.** `confirm_paid` already merges `buyer_name(charge)` from
   `antifraud_details`. Extend to also set `buyer_email` from the charge response
   (`charge["email"]`), and keep `buyer_name` extraction. Charge call still passes
   `%{email: order.buyer_email}` — when nil at create, Culqi's form collects it; we persist
   what the charge returns.
3. **Table size.** Add `size` (integer; e.g. diameter/relative units) to `Table` schema +
   changeset + migration; render from it on both admin and buyer maps (today size is implied
   by `seat_count`).
4. **Stage placement.** Add `stage_x`, `stage_y`, `stage_w`, `stage_h` to `Event` (+ migration);
   admin positions/resizes the stage; both maps render the stage from these (today the
   ESCENARIO band is fixed top-center).
5. **Bundle tiers beyond qty-2.** No model change (`PriceBundle` + `Pricing.bundle_total`
   greedy-pack already generic). Admin `createBundle` loop must support arbitrary `quantity`
   rows from the tarifa editor.

## 7. Data / content additions

- Event needs **description**, **venue photo**, **venue description**, **address**, and
  **map link/coords** for F1. Confirm which already exist (`venue_name` exists); add fields as
  needed (`description`, `venue_address`, `venue_photo_url`, `map_url` or lat/lng) + migration +
  serializer + admin inputs.

## 8. PDF e-ticket generation

Render the `F6-ticket-pdf.html` template to PDF **server-side** (headless Chrome via
ChromicPDF, or equivalent), per ticket. Used for: the "Descargar PDF" action and email
attachment (notifier already emails tickets). `print-color-adjust:exact` is already set so the
brand colors and QR survive. Keep the QR on its white patch.

## 9. Testing strategy (TDD, both sides)

Per project convention, TDD backend **and** frontend; visual polish verified last against the
mockups.

- **Backend (ExUnit):** order creation without buyer email; `confirm_paid` populates
  email+name from a charge fixture; `Pricing.bundle_total` greedy packing incl. qty-3/qty-4
  (e.g. `%{1=>40,2=>70}` → 3 = 110, 4 = 140); table size + stage fields persist; serializer
  exposes new fields. Mock Culqi via the existing `Culqi.Stub`/behaviour.
- **Frontend (Playwright, mocked API):** select → pay (Culqi test token) → success → tickets;
  combo auto-applies and shows savings; no buyer form on checkout; ask-name-after appears only
  when charge has no name; admin places stage + sized tables + bundle tiers; the three seat
  layouts render. Validate template content per convention.
- **Visual fidelity (anti-drift):** screenshot built pages via `playwright.visual.config.ts`
  and compare against `docs/design/ticketing-redesign/F*.html`. Any intentional deviation is
  documented in the design folder before shipping.

## 10. Anti-drift

The mockups are the contract. Tokens are defined once in `@theme`. Built pages are diffed
against the mockups. Deviations are surfaced and agreed before they ship. (See
`docs/design/ticketing-redesign/README.md`.)

## 11. Phasing

- **Phase 1 (launch):** §5 surfaces, §6 backend, §7 data, §8 PDF, §9 tests.
- **Phase 2 (post-launch):** camera QR scan, wallet passes, time-gated QR.

## 12. Open questions

- Map: embed (Google Maps iframe/link) vs. static image + "Cómo llegar" link — pick simplest
  that works under static export.
- PDF: confirm ChromicPDF is acceptable as a backend dependency (headless Chrome) vs. a
  lighter HTML→PDF path.
