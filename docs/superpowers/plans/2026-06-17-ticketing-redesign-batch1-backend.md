# Ticketing Redesign — Batch 1: Backend Foundation & API (Implementation Plan)

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:subagent-driven-development
> (recommended) or superpowers:executing-plans. Steps use `- [ ]` for tracking. This is Batch 1
> of `2026-06-17-ticketing-redesign-roadmap.md`. Spec:
> `docs/superpowers/specs/2026-06-17-ticketing-redesign-design.md`.

**Goal:** Land the API/data changes the redesign needs so the frontend builds against the final
shape: configurable stage + table size, venue/map fields, the no-upfront-buyer-form flow, and
locked combo (bundle) pricing.

**Architecture:** Phoenix/Ecto in `/home/visiond/projects/retrogroove_api`. TDD with ExUnit.
Culqi is mocked via the existing `Retrogroove.Culqi.Stub`/behaviour.

**Tech Stack:** Elixir, Ecto, ExUnit. Run tests with `PORT=4123 mix test` (memory:
backend tests need `PORT=4123`; toolchain = asdf elixir + docker postgres).

**Setup once:** ensure docker postgres is up and `PORT=4123 mix ecto.migrate` runs clean
before starting.

---

### Task 1: Event — venue + stage placement fields

**Files:**
- Migration: `priv/repo/migrations/<ts>_add_venue_and_stage_to_events.exs` (via `mix ecto.gen.migration`)
- Modify: `lib/retrogroove/events/event.ex`
- Test: `test/retrogroove/events_test.exs` (create if missing)

Existing Event fields already include `description` and `flyer_url`; do NOT re-add them.

- [ ] **Step 1: Failing test** — add to `test/retrogroove/events_test.exs`:

```elixir
defmodule Retrogroove.EventsTest do
  use Retrogroove.DataCase, async: true
  alias Retrogroove.Events
  alias Retrogroove.Events.Event

  test "changeset casts venue + stage fields" do
    attrs = %{
      name: "Grupo 5", starts_at: ~U[2026-12-27 21:00:00Z],
      venue_address: "Av. La Rosa Toro 1234, San Borja, Lima",
      venue_photo_url: "https://x/v.jpg", map_url: "https://maps/x",
      stage_x: 312, stage_y: 40, stage_w: 900, stage_h: 120
    }
    cs = Event.changeset(%Event{}, attrs)
    assert cs.valid?
    assert get_change(cs, :venue_address) == "Av. La Rosa Toro 1234, San Borja, Lima"
    assert get_change(cs, :stage_w) == 900
  end
end
```

- [ ] **Step 2: Run, expect fail**

Run: `PORT=4123 mix test test/retrogroove/events_test.exs` — Expected: FAIL (fields not cast).

- [ ] **Step 3: Generate + write migration**

Run: `mix ecto.gen.migration add_venue_and_stage_to_events`, then fill the generated file:

```elixir
def change do
  alter table(:events) do
    add :venue_address, :string
    add :venue_photo_url, :string
    add :map_url, :string
    add :stage_x, :integer
    add :stage_y, :integer
    add :stage_w, :integer
    add :stage_h, :integer
  end
end
```

- [ ] **Step 4: Add fields + castable** in `lib/retrogroove/events/event.ex`

In the `schema "events"` block add:
```elixir
    field :venue_address, :string
    field :venue_photo_url, :string
    field :map_url, :string
    field :stage_x, :integer
    field :stage_y, :integer
    field :stage_w, :integer
    field :stage_h, :integer
```
And add those seven atoms to the `@castable` list.

- [ ] **Step 5: Migrate + test**

Run: `PORT=4123 mix ecto.migrate && PORT=4123 mix test test/retrogroove/events_test.exs` — Expected: PASS.

- [ ] **Step 6: Commit** (ask first per repo convention)

```bash
git add lib/retrogroove/events/event.ex priv/repo/migrations test/retrogroove/events_test.exs
git commit -m "feat: add venue + configurable stage fields to events"
```

---

### Task 2: Table — explicit `size`

**Files:**
- Migration: `priv/repo/migrations/<ts>_add_size_to_tables.exs`
- Modify: `lib/retrogroove/events/table.ex`
- Test: `test/retrogroove/events_test.exs`

- [ ] **Step 1: Failing test**

```elixir
test "table changeset casts size" do
  cs = Retrogroove.Events.Table.changeset(%Retrogroove.Events.Table{},
        %{section_id: Ecto.UUID.generate(), label: "Mesa 1", seat_count: 6, size: 90})
  assert cs.valid?
  assert get_change(cs, :size) == 90
end
```

- [ ] **Step 2: Run, expect fail** — `PORT=4123 mix test test/retrogroove/events_test.exs`

- [ ] **Step 3: Migration** — `mix ecto.gen.migration add_size_to_tables`:

```elixir
def change do
  alter table(:tables) do
    add :size, :integer
  end
end
```

- [ ] **Step 4: Schema + cast** in `lib/retrogroove/events/table.ex`: add `field :size, :integer`
  to the schema and `:size` to the `cast(attrs, [...])` list. (`size` is in the same relative
  canvas units as `pos_x/pos_y`; null = derive from `seat_count` as today.)

- [ ] **Step 5: Migrate + test** — Expected: PASS.

- [ ] **Step 6: Commit** — `feat: add per-table size`

---

### Task 3: Order — buyer email optional at creation

**Files:**
- Modify: `lib/retrogroove/ticketing/order.ex` (changeset `validate_required`)
- Test: `test/retrogroove/ticketing_test.exs`

First read `lib/retrogroove/ticketing.ex` `create_order/5` to confirm its return shape
(`{:ok, order}` vs `{:ok, %{order: order}}`) and adapt the assertions below.

- [ ] **Step 1: Failing test** — order creatable without a buyer email; bad email still rejected:

```elixir
test "create_order succeeds with no buyer info (pending)" do
  %{event: event, seat_ids: seat_ids} = setup_event_with_seats()   # use existing test helper/fixture
  assert {:ok, order} = Retrogroove.Ticketing.create_order(event.id, seat_ids, %{})
  assert order.status == "pending"
  assert is_nil(order.buyer_email)
end

test "order changeset still rejects a malformed email when present" do
  cs = Retrogroove.Ticketing.Order.changeset(%Retrogroove.Ticketing.Order{},
        %{event_id: Ecto.UUID.generate(), buyer_email: "nope"})
  refute cs.valid?
  assert %{buyer_email: _} = errors_on(cs)
end
```

- [ ] **Step 2: Run, expect fail** — `PORT=4123 mix test test/retrogroove/ticketing_test.exs`

- [ ] **Step 3: Implement** — in `order.ex`, change
  `|> validate_required([:event_id, :buyer_email])` to `|> validate_required([:event_id])`.
  Keep `|> validate_format(:buyer_email, @email_re)` (Ecto skips format validation on nil, so
  empty orders pass and malformed emails still fail).

- [ ] **Step 4: Run, expect pass**

- [ ] **Step 5: Commit** — `feat: allow pending orders without buyer email (name/email come from Culqi)`

---

### Task 4: Fill buyer email + name from the Culqi charge

**Files:**
- Modify: `lib/retrogroove/ticketing.ex` (`confirm_paid/3`, `buyer_name/1`)
- Test: `test/retrogroove/ticketing_test.exs`

Read `confirm_paid/3` (~lines 211-235) and `buyer_name/1` (~236-240) first. Today `confirm_paid`
merges `%{status: "paid", paid_at: now, payment_ref: charge["id"]}` with `buyer_name(charge)`
(name from `charge["antifraud_details"]`). Add email extraction from `charge["email"]`.

- [ ] **Step 1: Failing test** — pay an order created without buyer info; assert email+name filled:

```elixir
test "paying fills buyer email + name from the charge" do
  %{event: event, seat_ids: seat_ids} = setup_event_with_seats()
  {:ok, order} = Retrogroove.Ticketing.create_order(event.id, seat_ids, %{})
  # Culqi.Stub returns a minimal charge; for this test, stub a charge with email + name.
  charge = %{"id" => "chr_x", "email" => "ana@example.com",
             "antifraud_details" => %{"first_name" => "Ana", "last_name" => "López"}}
  paid = Retrogroove.Ticketing.confirm_paid(order, charge, DateTime.utc_now())
  assert paid.status == "paid"
  assert paid.buyer_email == "ana@example.com"
  assert paid.buyer_first_name == "Ana"
end
```
If `confirm_paid/3` is private, either make it testable (e.g. `@doc false` public) or test via
the public `pay/3` with a Culqi mock that returns the charge above (preferred — set
`config :retrogroove, :culqi_client` to a test stub returning that charge).

- [ ] **Step 2: Run, expect fail**

- [ ] **Step 3: Implement** — add an email merge in `confirm_paid`:

```elixir
defp buyer_from_charge(charge) do
  charge
  |> buyer_name()
  |> maybe_put_email(charge["email"])
end

defp maybe_put_email(map, email) when is_binary(email), do: Map.put(map, :buyer_email, email)
defp maybe_put_email(map, _), do: map
```
and use `buyer_from_charge(charge)` where `buyer_name(charge)` is currently merged into the
paid-order attrs.

- [ ] **Step 4: Run, expect pass**

- [ ] **Step 5: Commit** — `feat: take buyer email + name from the Culqi charge on payment`

---

### Task 5: Lock combo (bundle) greedy-pack pricing

**Files:**
- Test: `test/retrogroove/pricing_test.exs` (create if missing)
- (No `lib/retrogroove/pricing.ex` change expected — this locks current behavior.)

- [ ] **Step 1: Tests**

```elixir
defmodule Retrogroove.PricingTest do
  use ExUnit.Case, async: true
  alias Retrogroove.Pricing

  @bundles %{1 => Decimal.new(40), 2 => Decimal.new(70)}

  test "1 seat = single price" do
    assert Decimal.equal?(Pricing.bundle_total(@bundles, 1), Decimal.new(40))
  end
  test "2 seats = combo" do
    assert Decimal.equal?(Pricing.bundle_total(@bundles, 2), Decimal.new(70))
  end
  test "3 seats = combo + single (greedy)" do
    assert Decimal.equal?(Pricing.bundle_total(@bundles, 3), Decimal.new(110))
  end
  test "4 seats = two combos" do
    assert Decimal.equal?(Pricing.bundle_total(@bundles, 4), Decimal.new(140))
  end
end
```

- [ ] **Step 2: Run** — `PORT=4123 mix test test/retrogroove/pricing_test.exs` — Expected: PASS
  (if any fail, fix `Pricing.bundle_total` to greedy-pack largest-first; spec §6.5).

- [ ] **Step 3: Commit** — `test: lock bundle greedy-pack pricing (qty 1–4)`

---

### Task 6: Serializer exposes the new fields

**Files:**
- Modify: `lib/retrogroove_web/serializer.ex` (event + table maps)
- Test: `test/retrogroove_web/serializer_test.exs` (create if missing) — or assert via an
  existing event-controller test.

Read `serializer.ex` first (the `event/1` and table-related functions) to match its style.

- [ ] **Step 1: Failing test** — serialized event includes stage + venue fields; serialized
  table includes `size`:

```elixir
test "event serialization includes stage + venue fields" do
  event = %Retrogroove.Events.Event{
    id: Ecto.UUID.generate(), name: "Grupo 5", starts_at: ~U[2026-12-27 21:00:00Z],
    venue_address: "Av. La Rosa Toro 1234", map_url: "https://maps/x",
    stage_x: 312, stage_y: 40, stage_w: 900, stage_h: 120, sections: [], phases: []
  }
  json = Retrogroove.Web.Serializer.event(event)   # use the real module name from serializer.ex
  assert json.stage_w == 900
  assert json.venue_address == "Av. La Rosa Toro 1234"
end
```

- [ ] **Step 2: Run, expect fail**

- [ ] **Step 3: Implement** — add `venue_address`, `venue_photo_url`, `map_url`, `stage_x`,
  `stage_y`, `stage_w`, `stage_h` to the event map, and `size` to the table map, in
  `serializer.ex`.

- [ ] **Step 4: Run, expect pass**

- [ ] **Step 5: Commit** — `feat: serialize venue + stage + table size fields`

---

## Batch 1 self-review
- Spec §6 (backend) items → Tasks 1–4, 6. §6.5 bundles → Task 5. §7 data (venue/map) → Task 1.
- No placeholders: migration/schema/changeset code is concrete. Two tasks (3, 4, 6) instruct a
  read-first to align with real function return shapes / module names before applying the shown
  change — intentional, since those exact signatures must be matched.
- Type consistency: field names match across schema, migration, serializer, and tests
  (`venue_address`, `stage_x/y/w/h`, `size`, `buyer_email`).

## Done-when
`PORT=4123 mix test` green; the events API returns the new fields; an order can be created
without buyer info and ends up with email/name after a (stubbed) Culqi charge. Then proceed to
**Batch 2** (write its detailed plan from the roadmap + spec).
