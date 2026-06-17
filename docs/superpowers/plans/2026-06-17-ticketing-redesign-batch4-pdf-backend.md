# Ticketing Redesign — Batch 4 (backend): server-side PDF e-ticket (F6) — Implementation Plan

> Batch 4 of the roadmap, **backend portion** (API repo `/home/visiond/projects/retrogroove_api`).
> The frontend "Descargar PDF" button wiring is a small follow-up folded into the fan flow (F5).
> Spec §8. Visual contract: `docs/design/ticketing-redesign/F6-ticket-pdf.html` (in the SITE repo at
> `/home/visiond/projects/retrogroove-site/docs/design/ticketing-redesign/F6-ticket-pdf.html`).
> Execute with TDD (ExUnit). Run tests `PORT=4123 mix test`. asdf: `export PATH="/home/visiond/.asdf/shims:$PATH"`.

**Goal:** Generate a pixel-faithful PDF e-ticket per ticket, server-side, from an HEEx template that
reproduces `F6-ticket-pdf.html`. Used by (a) a download endpoint and (b) the existing ticket email
as an attachment. Headless Chrome is available in dev (`/usr/bin/google-chrome`).

**Decision (locked):** use **ChromicPDF** (`{:chromic_pdf, "~> 1.17"}`) — drives Chrome to render the
F6 HTML exactly. Railway needs a Chromium buildpack (documented in the deploy guide, not here).

## Global constraints (bind every task)
- The PDF must reproduce `F6-ticket-pdf.html`: A4, brand-dark, **QR on its white patch**, tear-off door
  stub. `print-color-adjust: exact` so colors/QR survive. Translate the mockup's inline CSS 1:1.
- Reuse the existing QR (`eqrcode`) and ticket token already used by the email/`/t?token=` link — do
  NOT invent a new token. Read how the notifier builds the QR today and reuse it.
- No secrets/logging of PII. The endpoint must authorize by the ticket's public token only (same trust
  model as the existing `GET /tickets/:token`).

---

### Task 0 (read-first): understand the current ticket email + ticket data
Read `lib/retrogroove/ticketing/notifier.ex`, `lib/retrogroove/mailer.ex`, the ticket struct/schema, and
how `GET /tickets/:token` serializes a ticket (`serializer.ex`) + how the QR SVG is produced today
(`eqrcode`). Note the fields available on a ticket (token, seat label, event name/date/venue, holder).
Confirm the Swoosh adapter + how the email is currently assembled (so you attach, not rewrite).

### Task 1: add ChromicPDF + a PDF supervisor child
**Files:** `mix.exs`, `lib/retrogroove/application.ex`.
- [ ] Add `{:chromic_pdf, "~> 1.17"}`; `mix deps.get`.
- [ ] Start `ChromicPDF` in the supervision tree (`{ChromicPDF, chromic_pdf_opts()}`), pointing at the
      system Chrome if needed. Make it **optional/lazy** so test runs and Chrome-less CI don't crash:
      gate the child on a config flag (e.g. `config :retrogroove, :pdf_enabled`), default true in dev/prod,
      and allow tests to render through it only in the focused PDF test (tag `:pdf`).
- [ ] **Test:** app boots with ChromicPDF child present (`PORT=4123 mix test` still green).
- [ ] Commit: `feat: add chromic_pdf and start it in the supervision tree`

### Task 2: faithful HEEx ticket template + renderer
**Files:** new `lib/retrogroove_web/templates/ticket_pdf.html.heex` (or a render module), new
`lib/retrogroove/ticketing/ticket_pdf.ex` with `render(ticket) :: {:ok, binary} | {:error, term}`.
- [ ] Port `F6-ticket-pdf.html` into the HEEx template — same layout (tear-off stub + main ticket),
      same inline CSS/tokens, QR embedded on the white patch (inline SVG or data URI from `eqrcode`).
      Interpolate real ticket fields (event, date, venue, seat/zone, token, holder).
- [ ] `TicketPdf.render(ticket)` builds the HTML and calls `ChromicPDF.print_to_pdf({:html, html})`
      returning the PDF binary.
- [ ] **Test (tag `:pdf`, RED→GREEN):** `render/1` on a fixture ticket returns `{:ok, bin}` where
      `binary_part(bin, 0, 5) == "%PDF-"`. Also a fast unit test on the **HTML builder** (no Chrome):
      assert the HTML contains the event name, the seat label, the token, and the QR markup — this
      gives template-content coverage without requiring Chrome in every test run.
- [ ] Commit: `feat: render a pixel-faithful F6 ticket pdf via chromic_pdf`

### Task 3: download endpoint `GET /api/tickets/:token/pdf`
**Files:** `router.ex`, a controller action (e.g. `TicketController.pdf/2`).
- [ ] Look up the ticket by public token (reuse existing lookup); 404 if missing. Render via
      `TicketPdf.render/1`; respond `200` with `content-type: application/pdf` and a
      `content-disposition: attachment; filename="entrada-<token>.pdf"`.
- [ ] **Test (RED→GREEN):** a controller test hitting the route returns `application/pdf` and a body
      starting `%PDF-` for a real ticket; unknown token → 404. (Tag the Chrome-dependent assertion `:pdf`.)
- [ ] Commit: `feat: download a ticket as pdf at /tickets/:token/pdf`

### Task 4: attach the PDF to the ticket email
**Files:** `lib/retrogroove/ticketing/notifier.ex`.
- [ ] Where the ticket email is built, attach the rendered PDF (Swoosh `attachment/2` with the binary,
      filename `entrada-<token>.pdf`, content_type `application/pdf`). Keep the existing link + inline QR.
      If `pdf_enabled` is false or render fails, send the email WITHOUT the attachment (don't block delivery).
- [ ] **Test (RED→GREEN):** with PDF rendering stubbed/enabled, the delivered email has a PDF attachment
      named `entrada-<token>.pdf`; with rendering disabled, the email still sends (no attachment, no crash).
- [ ] Commit: `feat: attach the pdf e-ticket to the confirmation email`

### Task 5 (fold in the deferred Batch-1 Minors here — same repo)
- [ ] Add a `seat → "locked"` assertion to the "create_order succeeds without buyer email" test in
      `test/retrogroove/orders_test.exs`.
- [ ] Add `assert json.venue_photo_url == nil` to the event serializer test in `serializer_test.exs`.
- [ ] Commit: `test: harden order-lock + serializer coverage (batch-1 review follow-ups)`

---

## Done-when
`PORT=4123 mix test` green (Chrome-dependent tests tagged `:pdf`; run them with
`PORT=4123 mix test --include pdf` and confirm they pass locally where Chrome exists). A ticket renders a
`%PDF-` binary matching F6; `GET /tickets/:token/pdf` downloads it; the confirmation email carries it as
an attachment; disabling PDF degrades gracefully. Deploy guide must note the Railway Chromium requirement.

## Self-review (plan vs spec §8)
Server-side render of F6 (Task 2) → download (Task 3) + email attachment (Task 4); QR on white patch kept;
graceful degradation so a Chrome-less env still emails. Batch-1 review Minors cleared in Task 5.
