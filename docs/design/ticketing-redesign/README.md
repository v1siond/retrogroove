# RetroGroove Ticketing Redesign — Approved Design Reference

**The mockups in this folder are the visual contract for the ticketing/lifecycle redesign.**
Implementation must match them exactly. Drift from an approved design is not acceptable —
if a deviation becomes necessary, surface it and get agreement before diverging.

Aesthetic: **Neon Editorial** (approved 2026-06-17). Scope: full lifecycle (fan + admin),
visual + targeted UX, informed by Joinnus / Teleticket / DICE / Shotgun / RA / Eventbrite / Ticketmaster.

## Files

**Full-page flow (the primary contract — view at full size):**

| File | Surface | Status |
|---|---|---|
| `F1-event-page.html` | Full event page — flyer hero, description, venue + address/map, pricing list, CTA | ✅ approved |
| `F2-seat-selection-page.html` | Seat selection (realistic tables) + sticky combo order summary | ✅ approved |
| `F3-payment-page.html` | Payment — Culqi.js, **no upfront buyer form** | ✅ approved |
| `F4-success-page.html` | Success / confirmation — ticket links + optional "ask name after" | ✅ approved |
| `F5-tickets-page.html` | "Mis entradas" — each ticket as a card | ✅ approved |
| `F6-ticket-pdf.html` | Printable A4 PDF e-ticket (QR on white, tear-off door stub) | ✅ approved |
| `05-admin-event-builder.html` | Admin builder — positionable stage + true-position/size tables | ✅ approved |

**Component-level references (earlier compact mockups, still valid):**

| File | Surface | Status |
|---|---|---|
| `DESIGN-TOKENS.md` | Locked colors / type / radius / glow / components / Peru content kit | ✅ locked |
| `01-event-detail.html` · `02-seat-selection.html` · `03-checkout.html` · `04-ticket-qr.html` | Compact component mockups | ✅ approved |
| `seat-layouts` (in `_brainstorm-source/`) | 3 layouts: realistic mesas · teatro filas · arena zonas | ✅ approved |
| Door check-in (in `_brainstorm-source/admin-and-checkin.html`) | Mobile check-in (camera QR scan = **post-launch**) | ✅ approved |
| `_brainstorm-source/` | Raw visual-companion mockups, verbatim | reference |

## Flow (locked)

`select tickets → pay → show tickets`. We collect **no buyer form upfront** — the buyer's
name/email come from the Culqi charge; if Culqi doesn't return a name we ask for it **after**
paying (optional, to personalize the ticket). Backend tweak: create the pending order without
buyer info; populate `buyer_name`/`buyer_email` from the charge response in `confirm_paid`.

## Deferred to Phase 2 (post-launch)
- Camera QR scan at the door (launch uses manual code entry / hardware-scanner paste).
- Real Apple/Google Wallet passes ("Agregar a Wallet" button stays visible but stubbed).
- DICE-style "Activar entrada" time-gated/animated QR.

## Payment integration (Culqi.js — locked)

Checkout uses **Culqi.js tokenization**, confirmed against `lib/ticketing/culqi.ts`,
`app/evento/EventBuy.tsx`, and backend `lib/retrogroove/culqi.ex` + `ticketing.ex`:

1. Create pending order (seats only — **no buyer form**) → `createOrder`.
2. `getCulqiToken()` opens **Culqi's own secure form** (card/Yape, collects email) → returns a token.
3. `payOrder(order.id, token)` → backend `Culqi.create_charge(amount_cents, token, %{email})`
   → `POST https://api.culqi.com/v2/charges` (`amount`, `currency_code:"PEN"`, `email`, `source_id`).
4. Success → read name/email from the charge response, issue tickets; failure → retry.
   If no name returned, ask for it on the success page (optional).

**Culqi owns the payment-method UI** (card/Yape) inside its modal. Our checkout renders only:
order summary + one **"Pagar con Culqi"** button + success/failure handling.
No buyer form, payment-method picker, inline Yape QR, or Apple/Google Pay on our side.

Open the `.html` files directly in a browser to view each approved surface.

## Fidelity verification (anti-drift)

Implementation is verified against these mockups, not just "looks fine":
1. Tokens come from `DESIGN-TOKENS.md` (centralized in the Tailwind v4 `@theme`), not re-invented per component.
2. Built pages are screenshotted (this repo has `playwright.visual.config.ts`) and compared side-by-side against the corresponding mockup file here.
3. Any intentional deviation is documented here before it ships.
