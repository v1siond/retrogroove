# RetroGroove Ticketing Redesign — Locked Design Tokens

> **This is a contract.** The approved mockups in this folder are the source of truth.
> Implementation must match them exactly. If a deviation is unavoidable, raise it and
> get agreement first — do not silently diverge. Aesthetic direction: **Neon Editorial**
> (approved 2026-06-17).

## Color

| Token | Hex / value | Use |
|---|---|---|
| `bg` | `#08020e` | Page/canvas background (near-black, faint purple) |
| `bg-deep` | `#020006` | Outer/letterbox background |
| `hero-grad` | `radial-gradient(120% 85% at 50% 0%, rgba(255,20,147,.42), transparent 60%), radial-gradient(70% 60% at 82% 8%, rgba(0,229,255,.28), transparent 55%), linear-gradient(180deg,#1c0628,#08020e)` | Event hero / stage glow |
| `surface` | `rgba(255,255,255,.02)` | Sticky summary rail / raised panels |
| `surface-card` | `rgba(255,255,255,.04)` | Cards |
| `border` | `rgba(255,255,255,.07–.08)` | Hairline dividers / card borders |
| `pink` | `#ff1493` | **Primary** — CTAs, selected state, VIP accent, primary price |
| `gold` | `#ffd700` | Price totals, combo/deal accent, "Desde" price |
| `cyan` | `#00e5ff` | Dates, secondary zone accent, "disponible" seat, scarcity label |
| `purple` | `#bf00ff` | Tertiary accent (gradients only; not body) |
| `green` | `#22c55e` | Valid/success status only |
| `red` | `#ff5a6e` | Error/used/invalid status only |
| `text` | `#ECE6F0` | **Body text — off-white, never pure #FFF** (avoids neon halation) |
| `text-muted` | `rgba(236,230,240,.6)` | Secondary text |
| `text-faint` | `rgba(236,230,240,.45)` | Labels / fine print |

**Guardrails (from competitor research):**
1. Body & small text = off-white `#ECE6F0`, never `#FFF`. Neon only for accents, large display type, borders, and active/hover/price states.
2. QR / barcode sits on a **light patch** even on a dark ticket so scanners read it.
3. Prices are **all-in** ("sin cargos sorpresa") — no fees sprung at the end.

## Type

- **Display / headings / CTAs / prices:** `Bebas Neue` (import from Google Fonts). Letter-spacing `.02–.06em` for titles, `.35em` for the `ESCENARIO` band.
- **Body / labels / UI:** `Outfit` (weights 200–700). Uppercase micro-labels use `font:600 .58–.68rem`, `letter-spacing:.14–.18em`, `text-transform:uppercase`.
- Import: `https://fonts.googleapis.com/css2?family=Outfit:wght@200;300;400;500;600;700&family=Bebas+Neue&display=swap`

## Radius & shape

| Token | Value |
|---|---|
| Pill (CTA, chips, toggle) | `999px` |
| Card / panel | `10–14px` |
| Frame (page wrapper) | `16–18px` |
| Seat dot | `50%` (circle) |
| Combo/deal callout | `10px` |

## Glow / shadow

| Token | Value | Use |
|---|---|---|
| CTA glow | `0 0 22px rgba(255,20,147,.45)` | Primary buttons |
| Selected seat | `0 0 6–8px #ff1493` | Selected seat dot |
| Frame depth | `0 24px 80px rgba(0,0,0,.6)` | Page elevation |

## Components (as built in the mockups)

- **Primary CTA:** solid `#ff1493`, white Bebas Neue, `border-radius:999px`, `padding:12–13px`, CTA glow. Labels: `COMPRAR ENTRADAS` / `IR A PAGAR` / `PAGAR`.
- **Deal chip (gold):** `background:rgba(255,215,0,.1)`, `border:1px solid rgba(255,215,0,.55)`, gold text, pill. Format: `💎 Combo pareja VIP · 2 × S/ 220 (ahorras S/ 20)`.
- **Combo-applied callout (summary):** gold-tinted card; top row `💎 Combo … aplicado  −S/ 20`; sub line explains it. Auto-applied from `PriceBundle` greedy packing — buyer never picks the deal.
- **Seat legend:** `Disponible` = cyan ring on `rgba(0,229,255,.12)`; `Seleccionado` = solid pink + glow; `Ocupado` = `rgba(255,255,255,.08)` + faint border.
- **Order summary rail:** `surface` bg, sticky; line items with ✕ remove; subtotal → combo discount (gold) → TOTAL in gold Bebas Neue; 20-min hold countdown; "sin cargos sorpresa · Yape · PLIN · tarjeta".
- **View toggle:** pill segmented `Mapa | Lista` (active = pink). Mobile uses Lista (tap zone → price-sorted seat list) as the primary path.
- **Scarcity:** honest only — `Preventa · quedan 38`, `hasta agotar stock`, `agotado`. No fake urgency.

## Peru content kit (verbatim)

- Money: `S/ 340.00` (space, dot, two decimals). Cards show `Desde S/ XX`.
- Verbs: `Comprar ahora` / `Comprar entradas` / `Seleccionar asientos` / `Ir a pagar` / `Pagar` / `Siguiente`.
- Vocabulary: `Zona/Sector`, `Fila`, `Asiento/Butaca`, `Puerta`, `Aforo`, `Preventa`, `Tarifa`, `Entrada General — De pie`, `Carrito de compras`, `Mis entradas`, `Devoluciones`.
- Legend: `disponible / ocupado / no disponible / seleccionado`.
- Payments: Yape, PLIN, PagoEfectivo (CIP), cuotas, cards (Izipay/Niubiz/Culqi), Apple/Google Pay express at top of pay step. **Guest checkout (email only).**
