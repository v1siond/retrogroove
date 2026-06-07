# RetroGroove Ticketing — Design Spec

- **Date:** 2026-06-07
- **Status:** Approved (verbal) — build backend-first with TDD
- **Repos:** `retrogroove_api` (Elixir/Phoenix, the source of truth) · `retrogroove-site` (Next.js, static export)

## 1. Summary

A seat-level ticketing system. An admin lays out a venue (sections of tables and/or
rows of seats positioned across the stage), sets tiered + phased + bundled pricing,
and publishes an event. Fans see the venue map, choose how many seats they want,
pick specific available seats, and pay with **Culqi** (card / Yape). Each ticket is
linked to exactly one seat, delivered by **email** as a **printable public link with
a QR code**. The QR validates at the door; a **CSV buyer export** is the fallback.
Admins can also **manually issue/comp tickets** (pick seats, hand out tickets,
handle payment outside the app).

The design is **general**, not tuned to one venue: it must support a center-stage
table layout (~85 seats, couple + shared tables) *and* a theater with multiple
priced sections — from the same primitives.

## 2. Goals / Non-goals

**Goals**
- Seat-level inventory; one ticket ⇄ one seat; no double-selling (race-safe).
- Flexible layouts: sections containing tables-with-seats and/or rows-of-seats.
- Flexible pricing: per-section tiers × time phases × quantity bundles.
- Culqi payment; 15-minute seat hold; email delivery; QR validation.
- Admin: layout + pricing editor, sales/ticket management, manual issue/comp, CSV export.
- **TDD throughout, backend first.** Unit + flow/user-simulation + e2e.

**Non-goals (for now)**
- WhatsApp delivery, scheduled reminders, refunds UI (refund handled via Culqi webhook only).
- Buyer accounts (guest checkout).
- Reserved-seating algorithms beyond "pick your own seat".

## 3. Domain model (backend)

```
Event
  slug, name, description, venue_name, starts_at (door datetime), status: draft|published|cancelled|completed
  flyer_url, canvas_width, canvas_height        # venue map dimensions
  has_many Sections, Phases, Orders

Section            # = a price tier AND a layout group
  event_id, name, layout_type: tables | rows
  position {x, y, w, h}                          # placement on the venue canvas
  has_many Tables (when tables), Seats

Table              # only for layout_type = tables
  section_id, label, position {x, y}, seat_count
  has_many Seats

Seat
  section_id, table_id (nullable), label, row (nullable), number, position {x, y}
  status: available | locked | sold | blocked
  has_one Ticket
  # price comes from the seat's Section (tier) via the pricing engine

Phase              # a sales window
  event_id, name (e.g. "Preventa", "Puerta"), starts_at, ends_at (nullable)
  # "current phase" = the phase whose window contains now()

PriceBundle        # pricing for (section, phase, quantity)
  section_id, phase_id, quantity, price          # e.g. (VIP, Preventa, 1)=40, (VIP, Preventa, 2)=70

Order
  event_id, status: pending | paid | expired | comp | cancelled
  buyer_first_name, buyer_last_name, buyer_email, buyer_phone
  total, phase_id, payment_provider (culqi|manual), payment_ref (Culqi charge id)
  expires_at (now + 15m for pending), paid_at, issued_by_user_id (admin, for manual)
  has_many Tickets, has_many Seats (through tickets)

Ticket
  order_id, seat_id, code (unique), qr_svg, public_token (unguessable)
  status: valid | used | void
  checked_in_at, checked_in_by_user_id

User (admin/staff)  # Guardian JWT auth, unchanged concept from before
```

Statuses are the seat lifecycle: `available → locked` (on selection) `→ sold` (on
paid) or `→ available` (on expiry). `blocked` is admin-held (not for sale).

## 4. Pricing engine

Price is a pure function: **`price(section, phase, quantity) → total`**.

- Each `(section, phase)` has a **bundle table**: `{1 → 40, 2 → 70, …}`.
- **Current phase** is selected by `now()` against phase windows (Preventa until the
  event date, Puerta on the day). Pricing always uses the current phase.
- **Greedy packing** for any quantity: apply the largest available bundle repeatedly,
  charge the remainder at the `quantity:1` price.
  - `3 seats` with bundles `{1:40, 2:70}` → `70 + 40 = 110`.
  - `4 seats` → `70 + 70 = 140`.
- Mixed sections in one order: total = sum of each section's greedy price for the
  seats chosen in that section.

This is a standalone, heavily unit-tested module (`Retrogroove.Pricing`). No DB writes.

## 5. Seat locking & concurrency

- Selecting seats issues `POST /orders` with `seat_ids`. In a **single transaction**:
  `SELECT … FOR UPDATE` the seats, assert all are `available`, flip them to `locked`,
  create a `pending` Order with `expires_at = now + 15m`.
- **First request wins.** A concurrent request for an overlapping seat finds it no
  longer `available` and gets **`422 {error: "seats_unavailable", seat_ids: [...]}`**.
- A background sweeper (`expire_stale_orders/0`, runnable via a scheduled task) flips
  expired `pending` orders to `expired` and their seats back to `available`.

## 6. Purchase flow

1. `GET /events/:slug` → event + sections/tables/seats (+ statuses) + current-phase prices.
2. Fan picks N, selects N available seats → `POST /orders {seat_ids, buyer}` → seats locked, order `pending`, returns `{order, total, culqi_public_key}`.
3. Culqi.js (frontend) tokenizes card/Yape → `POST /orders/:id/pay {culqi_token}`.
4. API creates the Culqi **charge** for `order.total`. On success: order `paid`,
   seats `sold`, **Tickets issued** (code + QR + public_token), **customer email**
   sent with the ticket link, **band sale-alert** email sent. Cardholder name from
   Culqi fills buyer first/last name.
5. Culqi **webhook** (`POST /culqi/webhook`) is the async source of truth (confirm /
   refund); the synchronous path is the happy case, the webhook reconciles.

## 7. Tickets, QR & validation

- A ticket is a **public link** `/(/t/<public_token>)` rendering ticket details + a
  **QR** + a **print** button — same role as the current PDF/print export.
- The QR encodes the validate URL / token. Door staff scan → `GET /tickets/:token/validate`
  → `POST /tickets/:token/check-in` (auth) flips `valid → used`, records who/when.
- Re-scanning a `used` ticket returns an "already used" result.

## 8. Notifications

- **Customer:** email with the ticket link + QR on successful purchase (Swoosh).
- **Band/admin:** "new sale" alert email to a configurable address (`BAND_ALERT_EMAIL`).
- No WhatsApp, no reminders (non-goals).

## 9. Admin

- **Layout editor:** create/edit Event, Sections (position/type), Tables, Seats, and
  per-section/phase **PriceBundles**. Same data renders the public venue map.
- **Sales & tickets:** list orders/tickets per event, statuses, totals.
- **Manual issue / comp:** select seats → issue an Order with `payment_provider=manual`
  (status `comp` or `paid`), no Culqi charge, real Tickets + QR generated and emailable.
- **Buyer export:** `GET /events/:id/buyers.csv` → first name, last name, email, phone,
  seats, total, status — the QR-free fallback at the door.

## 10. API surface (Phoenix)

**Public:** `GET /events/:slug` · `POST /orders` · `POST /orders/:id/pay` ·
`GET /orders/:id` · `GET /tickets/:token` · `GET /tickets/:token/validate` ·
`POST /culqi/webhook`

**Admin (JWT):** events/sections/tables/seats CRUD · phases & price-bundles CRUD ·
`POST /events/:id/orders` (manual) · `GET /events/:id/orders` · `GET /events/:id/tickets` ·
`GET /events/:id/buyers.csv` · `POST /tickets/:token/check-in`

## 11. Frontend surface (Next.js, static export)

- **Public:** event page with venue **seat map** + seat selection + buyer form +
  **Culqi checkout**; **ticket page** `/t/[token]` (details + QR + print).
- **Admin (`/band`):** layout editor, pricing config, sales/tickets, manual issue,
  export. (Note: dynamic routes use `?token=`/`?id=` query params — static export
  cannot serve runtime path ids.)

## 12. Testing strategy — TDD, backend first

Per project standard: **understand the scenario, then write positive + negative tests;
use real module methods; mock only external services; validate full flows.**

- **Unit (ExUnit `DataCase`):** pricing engine (tiers/phases/greedy bundles, edge
  quantities), seat locking (concurrent → first wins), order lifecycle
  (create→pay→issue→expire), ticket validation/check-in, manual comp issuance.
- **Flow / user-simulation (ExUnit `ConnCase`, full HTTP):** end-to-end journeys —
  *browse event → select & lock seats → pay (Culqi mocked via Mox) → tickets issued +
  emails sent (Swoosh test adapter) → scan QR → check-in*; plus seat-conflict (two
  buyers, one seat), expiry/release, manual issue, CSV export, webhook reconciliation.
- **Frontend e2e (Playwright):** mirror the buyer + admin journeys with Culqi and the
  API mocked, **after** the backend suite is green.

External services are the only mocks: **Culqi** (behind a behaviour, mocked with Mox)
and **email** (Swoosh test adapter, asserting delivery + contents).

## 13. Implementation phases (TDD; styling LAST)

1. **Layout model** — Event/Section/Table/Seat schemas, migrations, `Events` context CRUD, factories. *(unit)*
2. **Pricing engine** — `Phase`, `PriceBundle`, `Retrogroove.Pricing.price/3` greedy packing. *(unit, pure)*
3. **Orders + locking** — `Orders.create/2` transactional lock, `expire_stale_orders/0`. *(unit incl. concurrency)*
4. **Culqi payment** — `Culqi` behaviour + charge, `Orders.pay/2`, webhook. *(unit, Mox)*
5. **Tickets** — issue (code/QR/token), validate, check-in. *(unit)*
6. **Notifications** — customer + band emails. *(unit, Swoosh test)*
7. **Admin** — manual issue/comp, buyer CSV export. *(unit)*
8. **Controllers + router** — wire endpoints; **full-flow ConnCase user-simulation tests**.
9. **Frontend API client + public buy flow** — seat map, selection, Culqi checkout, ticket page. *(Playwright)*
10. **Frontend admin** — layout editor, pricing, sales, manual issue, export. *(Playwright)*
11. **Styling / polish** — visual design pass, **last**.

## 14. Open items (resolve during build, don't block)

- Bundle packing only greedy-packs within a single section (confirmed sufficient).
- Max seats per order: default cap (e.g. 10) — configurable per event.
- Culqi.js version + exact charge/token API: confirm against `docs.culqi.com` when wiring phase 4/9.
