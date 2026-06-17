# Ticketing Redesign — Batch 2: Frontend Design System (Tailwind v4) — Implementation Plan

> Batch 2 of `2026-06-17-ticketing-redesign-roadmap.md`. Spec:
> `docs/superpowers/specs/2026-06-17-ticketing-redesign-design.md`. Visual contract:
> `docs/design/ticketing-redesign/` (`DESIGN-TOKENS.md` + F1–F6 + `:root` vars in each mockup's
> `<head><style>`). Execute with superpowers:subagent-driven-development, TDD.

**Goal:** Stand up the **Neon Editorial** design system once — every token in a Tailwind v4
`@theme` block, fonts loaded globally, and a small set of shared `components/ui/` primitives that
match the mockups — so Batches 3/5/6 compose pages from tokens, not ad-hoc hex.

**Stack:** Next.js 16 (static export), React 19, Tailwind **v4 (CSS-first, no config file)**,
Playwright. Run frontend with `export PATH="/home/visiond/.nvm/versions/node/v22.21.1/bin:$PATH"`.
Tests: `npx playwright test e2e/ui/components.spec.ts` (default config auto-starts dev on :3333).

## Global constraints (bind every task — copy to reviewer)
- Every token in `DESIGN-TOKENS.md` is defined **once** in the `@theme` block. Components reference
  tokens (Tailwind utilities / `var(--…)`). **No hardcoded hex in a component that duplicates a token.**
- Match the mockups' `:root` CSS-var **values verbatim** — read F1/F2/F3 `<head><style>` before defining tokens.
- Body text is `#ECE6F0` (token `text`), **never pure `#FFF`**. Background `#08020e` (token `bg`).
- Bebas Neue → display/headings/CTA/prices; Outfit → body/labels/UI.
- Pill radius `999px` (CTA, chips, toggle); card radius `10–14px`; frame `16–18px`.
- Primary CTA: solid `#ff1493`, white Bebas Neue, radius `999px`, glow `0 0 22px rgba(255,20,147,.45)`.
- Money renders exactly `S/ 340.00` (space, dot, two decimals).

---

### Task 1: `@theme` tokens + global fonts + base layout

**Files:** `app/globals.css`, `app/layout.tsx`, `app/page.tsx` (remove the now-duplicate font `<style>`),
new `app/_ui-preview/page.tsx` (internal component showcase — not linked from nav; used by tests),
test `e2e/ui/components.spec.ts`.

- [ ] **Step 1 (RED):** write `e2e/ui/components.spec.ts` asserting the token pipeline on `/_ui-preview`:
  - `body` computed `background-color` == `rgb(8, 2, 14)` (#08020e) and `color` == `rgb(236, 230, 240)` (#ECE6F0).
  - an element using the Bebas display font has `font-family` containing `Bebas Neue`.
  Run it — FAILS (route 404 / tokens undefined).
- [ ] **Step 2 (GREEN):**
  - In `app/globals.css` after `@import "tailwindcss";` add a `@theme { … }` block defining every
    `DESIGN-TOKENS.md` color as `--color-*` (bg, bg-deep, surface, surface-card, border, pink, gold,
    cyan, purple, green, red, text, text-muted, text-faint), font families `--font-display: "Bebas Neue"`,
    `--font-body: "Outfit"`, radii, and the named shadows/glows. Set `body { background: var(--color-bg);
    color: var(--color-text); font-family: var(--font-body); }`. Keep the `hero-grad` as a reusable
    utility/custom property.
  - In `app/layout.tsx` `<head>`: load the Google Fonts link (Outfit 200–700 + Bebas Neue) globally;
    remove the per-page `<style>` font import from `app/page.tsx` (no behavior change to home).
  - Create `app/_ui-preview/page.tsx` rendering one of each component (built in later tasks; start with
    a heading + body text + the primary Button once it exists). For Task 1, render enough to satisfy the
    body/font assertions.
- [ ] **Step 3:** GREEN. Commit: `feat: neon-editorial design tokens in a tailwind v4 @theme + global fonts`

### Task 2: Core primitives — Button, Input, Select, Card, Badge, Chip

**Files:** `components/ui/{Button,Input,Select,Card,Badge,Chip}.tsx`, extend `app/_ui-preview/page.tsx`,
extend `e2e/ui/components.spec.ts`.

- [ ] **Step 1 (RED):** add assertions: render each on `/_ui-preview` and assert:
  - `Button` `variant="primary"`: computed `background-color` == `rgb(255, 20, 147)`, `border-radius` == `999px`,
    text content renders; `variant="ghost"`/`secondary` differ (transparent/bordered).
  - `Chip` (deal/gold): pill radius `999px`, gold border; `Badge` renders status color (green/red/cyan).
  - `Input`/`Select`: render label + control, token border color.
  - `Card`: token surface bg + border + radius 10–14px.
  Run — FAILS.
- [ ] **Step 2 (GREEN):** build each as a small typed component (props: `variant`, `size`, children, etc.)
  using only token utilities. Mirror the mockups' button/chip/card CSS. Mount all variants in `_ui-preview`.
- [ ] **Step 3:** GREEN. Commit: `feat: ui primitives — Button, Input, Select, Card, Badge, Chip`

### Task 3: Domain components — Money, SectionEyebrow, SeatLegend, OrderSummary, Nav, Footer

**Files:** `components/ui/{Money,SectionEyebrow,SeatLegend,OrderSummary,Nav,Footer}.tsx`,
extend `_ui-preview` + `components.spec.ts`.

- [ ] **Step 1 (RED):** assertions:
  - `<Money value={340} />` → text `S/ 340.00`; `<Money value={340} prefix="Desde" />` → `Desde S/ 340.00`.
  - `SectionEyebrow`: uppercase micro-label (computed `text-transform: uppercase`, letter-spacing set).
  - `SeatLegend`: three entries `disponible` (cyan), `seleccionado` (pink), `ocupado` (faint) — assert labels + swatch colors.
  - `OrderSummary`: given line items + a combo discount, renders subtotal, a gold discount line, and TOTAL
    in gold Bebas Neue; total math correct (assert rendered total text).
  - `Nav`/`Footer`: brand + key links render.
  Run — FAILS.
- [ ] **Step 2 (GREEN):** implement. `Money` is pure formatting (Intl or manual → `S/ X.XX`). `OrderSummary`
    takes `{ items, comboDiscount, total }` and renders the mockup F3 rail. Use tokens only.
- [ ] **Step 3:** GREEN. Commit: `feat: domain ui — Money, SectionEyebrow, SeatLegend, OrderSummary, Nav, Footer`

### Task 4: Retire `lib/ticketing/ui.ts` ad-hoc strings

**Files:** `lib/ticketing/ui.ts` (and any importers).

- [ ] Replace the exported ad-hoc class strings with token-driven equivalents (or re-export thin helpers that
  use the new components/utilities). Do NOT restyle full pages here — that's Batch 3; just ensure nothing
  imports a hardcoded-hex string that duplicates a token. If a page still imports `ui.ts`, keep its surface
  API working (so the app still builds) but back it with tokens.
- [ ] **Verify:** `npm run build` succeeds (static export); `npx playwright test e2e/ui/components.spec.ts` green;
  existing `e2e/ticketing/*` still pass (no regression to current pages).
- [ ] Commit: `refactor: back ticketing ui helpers with design tokens, drop hardcoded hex`

---

## Done-when
`@theme` holds every token once; `components/ui/` matches the mockups; `e2e/ui/components.spec.ts` green;
`npm run build` clean; no regression in `e2e/ticketing/*`. No per-component hex duplicating a token.
Then write the Batch 3 plan (fan flow F1–F5) from the roadmap + spec + `frontend-map.md`.

## Self-review (plan vs spec)
§4 design system → Tasks 1–4. Anti-drift (§10): tokens once in @theme (T1), components match mockups (T2–3),
visual diff deferred to B3 full pages. Token names/values pulled verbatim from DESIGN-TOKENS.md + mockup `:root`.
