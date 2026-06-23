'use client';

import React, { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { ticketingApi, ApiError } from '@/lib/ticketing/api';
import { bundleTotal } from '@/lib/ticketing/pricing';
import { buildOrderPdf, downloadPdf, ticketFilename } from '@/lib/ticketing/pdf';
import { Nav, Footer, SeatLegend, Money } from '@/components/ui';
import type { TicketEvent, Order, Section, Seat, VenueTable } from '@/lib/ticketing/types';

const SECTION_COLORS = ['#ff1493', '#00e5ff', '#ffd700', '#bf00ff', '#22c55e', '#ff8c00'];

function seatName(seat: Seat): string {
  return seat.row ? `${seat.row}${seat.number}` : seat.label || String(seat.number);
}

// Human label for a price bundle, keyed by how many seats it covers.
// 1 → "1 asiento", 2 → "Combo · 2 asientos", n → "Combo · n asientos".
function bundleLabel(quantity: number): string {
  if (quantity <= 1) return '1 asiento';
  return `Combo · ${quantity} asientos`;
}

// Full seat label: "Mesa 1 — Asiento 3"
function seatFullLabel(seat: Seat, table?: VenueTable | null): string {
  if (table) return `${table.label} — Asiento ${seatName(seat)}`;
  return seat.label || seatName(seat);
}

function rowTagsFor(seats: Seat[]): { row: string; left: number; top: number }[] {
  const byRow = new Map<string, Seat>();
  for (const s of seats) {
    if (!s.row) continue;
    const cur = byRow.get(s.row);
    if (!cur || s.pos_x < cur.pos_x) byRow.set(s.row, s);
  }
  return Array.from(byRow.values()).map((s) => ({
    row: s.row as string,
    left: Math.max(1, s.pos_x - 4),
    top: s.pos_y,
  }));
}

function formatDate(iso: string): string {
  try {
    return new Intl.DateTimeFormat('es-PE', {
      weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit',
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

function formatHoldTime(secs: number): string {
  const m = Math.floor(secs / 60);
  const s = secs % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

// Compute evenly spaced positions around a table ring.
// startAngle=-PI/2 puts the first seat at the top; we offset so seats are
// distributed clockwise starting from top-left, which keeps their natural
// left-to-right order when sorted by pos_x.
function seatsAroundTable(count: number): { x: number; y: number }[] {
  // For 2 seats: start at 180° (left) so seat[0] is left, seat[1] is right
  // For other counts: start at -90° (top)
  const startAngle = count === 2 ? Math.PI : -Math.PI / 2;
  return Array.from({ length: count }, (_, i) => {
    const angle = startAngle + (i / count) * 2 * Math.PI;
    return {
      x: 50 + 42 * Math.cos(angle),
      y: 50 + 42 * Math.sin(angle),
    };
  });
}

type Step = 'detail' | 'select' | 'pay' | 'coordinate' | 'pending' | 'done';

// Manual-pay coordination: the band's Yape/Plin number (= their phone) + WhatsApp.
// Yape is keyed to a phone number; Plin pays the same number via Peru's QR interoperability,
// so one number covers both. Set NEXT_PUBLIC_BAND_PHONE in the env (DEPLOY.md: the Yape/Plin number).
const BAND_PHONE = process.env.NEXT_PUBLIC_BAND_PHONE || '969 622 293';
const WHATSAPP_DIGITS = '51' + BAND_PHONE.replace(/\D/g, '');
// Max seats per order — keep in sync with the backend @max_per_order (6). Stops one
// buyer grabbing/holding a big chunk of the room (esp. manual orders, 24h hold).
const MAX_SEATS_PER_ORDER = 6;
type MapView = 'map' | 'list';

interface SeatMapCanvasProps {
  seatedSections: Section[];
  isMesas: boolean;
  showNums: boolean;
  totalSeated: number;
  cw: number;
  ch: number;
  stageStyle: React.CSSProperties;
  selected: string[];
  /** When false the map is a read-only preview: no selection, no pointer events. */
  interactive: boolean;
  onToggle?: (id: string) => void;
}

// Presentational seat/table layout. Rendered interactive on the 'select' step
// and read-only on the 'detail' step so visitors can preview the distribution
// before buying. Layout math lives here; selection state is passed in.
function SeatMapCanvas({
  seatedSections,
  isMesas,
  showNums,
  totalSeated,
  cw,
  ch,
  stageStyle,
  selected,
  interactive,
  onToggle,
}: SeatMapCanvasProps) {
  const handleToggle = (id: string) => {
    if (interactive) onToggle?.(id);
  };

  // On a phone the canvas is squeezed to ~340px, which shrinks both table dots
  // and dense teatro seats below a tappable size. We give the canvas a minimum
  // width so it can pan horizontally inside .rg-seatmap-scroll instead of
  // shrinking — the whole map (and the gaps between seats) scales up. On desktop
  // the container is far wider than this floor, so width:100% wins and nothing
  // scrolls. Percent-based seat positions are untouched, so left-to-right
  // ordering — and the e2e bounding-box checks — hold either way.
  // Tables need room for the ring + dots; dense teatros scale with seat count.
  const tableCount = isMesas
    ? seatedSections.reduce((n, s) => n + s.tables.length, 0)
    : 0;
  const minCanvasWidth = isMesas
    ? Math.min(900, Math.max(440, tableCount * 120))
    : totalSeated > 60 && !showNums
      ? Math.min(900, Math.max(460, totalSeated * 6))
      : 0;

  const canvas = (
    <div
      data-testid={interactive ? 'seat-map' : 'seat-map-preview'}
      style={{
        position: 'relative',
        width: '100%',
        minWidth: minCanvasWidth ? `${minCanvasWidth}px` : undefined,
        borderRadius: '12px',
        border: '1px solid rgba(255,255,255,.1)',
        overflow: 'hidden',
        background: 'radial-gradient(circle at 50% 0%,rgba(255,20,147,.14),transparent 55%), #0b0020',
        aspectRatio: `${cw} / ${ch}`,
        marginTop: '16px',
      }}
    >
      {/* Stage — positioned from event data or fallback band */}
      <div data-testid="buyer-stage" style={stageStyle}>ESCENARIO</div>

      {seatedSections.map((section, si) => {
        const color = SECTION_COLORS[si % SECTION_COLORS.length];

        if (isMesas && section.layout_type === 'tables') {
          // Group seats by table, render table rings
          const tableMap = new Map<string, Seat[]>();
          const noTable: Seat[] = [];
          section.seats.forEach((seat) => {
            if (seat.table_id) {
              const grp = tableMap.get(seat.table_id) || [];
              grp.push(seat);
              tableMap.set(seat.table_id, grp);
            } else {
              noTable.push(seat);
            }
          });

          return (
            <section key={section.id} data-section-id={section.id} style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
              <span style={{ position: 'absolute', width: '1px', height: '1px', overflow: 'hidden', opacity: 0 }}>{section.name}</span>
              {/* Table rings */}
              {section.tables.map((tbl) => {
                const tableSeats = tableMap.get(tbl.id) || [];
                const isVip = section.name.toLowerCase().includes('vip');
                const ringColor = isVip ? 'rgba(255,20,147,.4)' : 'rgba(255,255,255,.12)';
                const surfaceBg = isVip
                  ? 'radial-gradient(circle at 50% 35%,#3a1030,#1e0a1a)'
                  : 'radial-gradient(circle at 50% 35%,#2a1430,#160a1e)';
                // Sort seats by pos_x so ring positions honor left-to-right order
                const sortedSeats = [...tableSeats].sort((a, b) => a.pos_x - b.pos_x);
                const seatPositions = seatsAroundTable(sortedSeats.length);
                // Table size as % of canvas (use tbl.size or default 56)
                const tsize = tbl.size || 56;
                const twPct = (tsize / cw) * 100;
                const thPct = (tsize / ch) * 100;

                return (
                  <div
                    key={tbl.id}
                    style={{
                      position: 'absolute',
                      left: `${tbl.pos_x - twPct / 2}%`,
                      top: `${tbl.pos_y - thPct / 2}%`,
                      width: `${twPct}%`,
                      // height (not paddingBottom): paddingBottom % is relative to
                      // container WIDTH, which stretched tables into tall ovals.
                      height: `${thPct}%`,
                      pointerEvents: 'none',
                    }}
                  >
                    {/* Table surface circle */}
                    <div style={{
                      position: 'absolute',
                      inset: '18%',
                      borderRadius: '50%',
                      border: `1px solid ${ringColor}`,
                      background: surfaceBg,
                    }} />
                    {/* Table label */}
                    <div style={{
                      position: 'absolute',
                      left: '50%',
                      top: '50%',
                      transform: 'translate(-50%, -50%)',
                      fontSize: '0.55rem',
                      color: isVip ? '#ff8fce' : 'rgba(236,230,240,.5)',
                      pointerEvents: 'none',
                      whiteSpace: 'nowrap',
                      textAlign: 'center',
                    }}>
                      {sortedSeats.length}
                    </div>
                    {/* Table name below */}
                    <div style={{
                      position: 'absolute',
                      left: '50%',
                      bottom: '-14%',
                      transform: 'translateX(-50%)',
                      whiteSpace: 'nowrap',
                      fontSize: '0.52rem',
                      letterSpacing: '0.06em',
                      color: isVip ? '#ff8fce' : 'rgba(236,230,240,.55)',
                      pointerEvents: 'none',
                    }}>
                      {tbl.label}
                    </div>
                    {/* Seat dots around ring */}
                    {sortedSeats.map((seat, idx) => {
                      const pos = seatPositions[idx] || { x: 50, y: 50 };
                      const isSel = interactive && selected.includes(seat.id);
                      const available = seat.status === 'available';
                      const seatColor = isVip ? 'var(--color-pink)' : color;
                      return (
                        <button
                          key={seat.id}
                          type="button"
                          data-seat-id={seat.id}
                          data-status={seat.status}
                          data-selected={isSel}
                          disabled={!interactive || !available}
                          aria-pressed={isSel}
                          aria-label={`${tbl.label} Asiento ${seatName(seat)}`}
                          title={`${section.name} · ${tbl.label} · Asiento ${seatName(seat)}`}
                          onClick={() => handleToggle(seat.id)}
                          style={{
                            position: 'absolute',
                            left: `${pos.x}%`,
                            top: `${pos.y}%`,
                            transform: 'translate(-50%, -50%)',
                            pointerEvents: interactive ? 'auto' : 'none',
                            borderRadius: '50%',
                            border: '1.5px solid',
                            width: '11px',
                            height: '11px',
                            cursor: interactive && available ? 'pointer' : 'default',
                            transition: 'all 0.15s',
                            padding: 0,
                            ...(isSel
                              ? { background: 'var(--color-pink)', borderColor: 'var(--color-pink)', boxShadow: '0 0 8px var(--color-pink)' }
                              : !available
                                ? { background: 'rgba(255,255,255,.08)', borderColor: 'rgba(255,255,255,.18)' }
                                : { background: isVip ? 'rgba(255,20,147,.18)' : `rgba(0,229,255,.15)`, borderColor: seatColor }),
                          }}
                        />
                      );
                    })}
                  </div>
                );
              })}

              {/* Seats not in any table (fallback) */}
              {noTable.map((seat) => {
                const isSel = interactive && selected.includes(seat.id);
                const available = seat.status === 'available';
                return (
                  <button
                    key={seat.id}
                    type="button"
                    data-seat-id={seat.id}
                    data-status={seat.status}
                    data-selected={isSel}
                    disabled={!interactive || !available}
                    aria-pressed={isSel}
                    aria-label={`Asiento ${seatName(seat)}`}
                    onClick={() => handleToggle(seat.id)}
                    style={{
                      position: 'absolute',
                      left: `${seat.pos_x}%`,
                      top: `${seat.pos_y}%`,
                      transform: 'translate(-50%, -50%)',
                      pointerEvents: interactive ? 'auto' : 'none',
                      borderRadius: '50%',
                      border: '1.5px solid',
                      width: showNums ? '24px' : '11px',
                      height: showNums ? '24px' : '11px',
                      cursor: interactive && available ? 'pointer' : 'default',
                      transition: 'all 0.15s',
                      padding: 0,
                      ...(isSel
                        ? { background: 'var(--color-pink)', borderColor: 'var(--color-pink)', boxShadow: '0 0 8px var(--color-pink)' }
                        : !available
                          ? { background: 'rgba(255,255,255,.08)', borderColor: 'rgba(255,255,255,.18)' }
                          : { background: `${color}26`, borderColor: color }),
                    }}
                  />
                );
              })}
            </section>
          );
        }

        // rows/teatro layout — rows of seats
        return (
          <section key={section.id} data-section-id={section.id} style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
            <span style={{ position: 'absolute', width: '1px', height: '1px', overflow: 'hidden', opacity: 0 }}>{section.name}</span>
            {rowTagsFor(section.seats).map((t) => (
              <span
                key={t.row}
                style={{
                  position: 'absolute',
                  left: `${t.left}%`,
                  top: `${t.top}%`,
                  transform: 'translateY(-50%)',
                  color: 'rgba(236,230,240,.35)',
                  fontSize: '0.6rem',
                  fontWeight: 600,
                  pointerEvents: 'none',
                }}
              >
                {t.row}
              </span>
            ))}
            {section.seats.map((seat) => {
              const isSel = interactive && selected.includes(seat.id);
              const available = seat.status === 'available';
              const label = seatName(seat);
              return (
                <button
                  key={seat.id}
                  type="button"
                  data-seat-id={seat.id}
                  data-status={seat.status}
                  data-selected={isSel}
                  disabled={!interactive || !available}
                  aria-pressed={isSel}
                  aria-label={`Asiento ${label}`}
                  title={`${section.name} · Asiento ${label}`}
                  onClick={() => handleToggle(seat.id)}
                  style={{
                    position: 'absolute',
                    left: `${seat.pos_x}%`,
                    top: `${seat.pos_y}%`,
                    transform: 'translate(-50%, -50%)',
                    pointerEvents: interactive ? 'auto' : 'none',
                    borderRadius: '50%',
                    border: '1px solid',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    transition: 'all 0.15s',
                    cursor: interactive && available ? 'pointer' : 'default',
                    width: showNums ? '24px' : totalSeated <= 800 ? '14px' : '8px',
                    height: showNums ? '24px' : totalSeated <= 800 ? '14px' : '8px',
                    fontSize: showNums ? '0.55rem' : '0',
                    ...(isSel
                      ? { background: 'var(--color-pink)', borderColor: 'var(--color-pink)', color: '#fff', boxShadow: '0 0 8px var(--color-pink)' }
                      : !available
                        ? { background: 'rgba(255,255,255,.05)', borderColor: 'rgba(255,255,255,.15)', color: 'rgba(255,255,255,.25)' }
                        : { background: `${color}26`, borderColor: color, color }),
                  }}
                >
                  {showNums ? seat.number : ''}
                </button>
              );
            })}
          </section>
        );
      })}
    </div>
  );

  // Dense maps get a horizontal-scroll shell + a "desliza para ver más" hint so
  // mobile users know the floor plan pans. Sparse maps render the canvas bare.
  if (!minCanvasWidth) return canvas;
  return (
    <div className="rg-seatmap-scroll" style={{ marginTop: '0' }}>
      {canvas}
      <p style={{ fontSize: '0.62rem', color: 'var(--color-text-faint)', textAlign: 'center', margin: '8px 0 0', letterSpacing: '0.08em' }}>
        ↔ Desliza para ver todo el mapa
      </p>
    </div>
  );
}

export default function EventBuy({ slug, orderId }: { slug: string; orderId?: string }) {
  const [event, setEvent] = useState<TicketEvent | null>(null);
  const [resolvedSlug, setResolvedSlug] = useState(slug);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<string[]>([]);
  const [gaQty, setGaQty] = useState<Record<string, number>>({});
  const [promo, setPromo] = useState('');
  const [step, setStep] = useState<Step>('detail');
  const [order, setOrder] = useState<Order | null>(null);
  // "Ya pagué" report form (manual Yape/Plin flow)
  const [repName, setRepName] = useState('');
  const [repEmail, setRepEmail] = useState('');
  const [repOp, setRepOp] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [working, setWorking] = useState(false);
  const [mapView, setMapView] = useState<MapView>('map');
  const [holdSecs, setHoldSecs] = useState<number | null>(null);
  const [askFirstName, setAskFirstName] = useState('');
  const [askLastName, setAskLastName] = useState('');
  const [nameSaved, setNameSaved] = useState(false);
  const [polling, setPolling] = useState(false);
  const [pdfBusy, setPdfBusy] = useState(false);

  // Load the event. Two entry points:
  //  1. ?slug=<slug> — normal buy flow: load the event directly.
  //  2. ?order=<id> with no slug — Izipay return URL: fetch the order, derive
  //     its event slug, load that event, then drop straight into the success
  //     view (paid → ticket; pending → CONFIRMANDO PAGO + poll).
  useEffect(() => {
    if (slug) {
      ticketingApi
        .getEvent(slug)
        .then((r) => setEvent(r.event))
        .catch(() => setError('No se pudo cargar el evento'))
        .finally(() => setLoading(false));
      return;
    }

    if (!orderId) {
      setLoading(false);
      return;
    }

    ticketingApi
      .getOrder(orderId)
      .then(async (r) => {
        const o = r.order;
        const orderSlug = o.event_slug;
        if (!orderSlug) {
          setError('No se pudo cargar el evento');
          return;
        }
        const { event: ev } = await ticketingApi.getEvent(orderSlug);
        setEvent(ev);
        setResolvedSlug(orderSlug);
        setOrder(o);
        // A still-pending manual order resumes to the "Pendiente de validación" view;
        // paid (or Izipay) orders go to 'done' (ticket / CONFIRMANDO PAGO poll).
        setStep(o.status !== 'paid' && o.payment_provider === 'manual' ? 'pending' : 'done');
      })
      .catch(() => setError('No se pudo cargar el evento'))
      .finally(() => setLoading(false));
  }, [slug, orderId]);

  // Resume after returning from Izipay: if a pending order for this event was
  // persisted before the redirect, jump straight to the success view. If it's
  // already paid we show the ticket; if not we land on 'done' which triggers
  // pollUntilPaid (the "CONFIRMANDO PAGO" interstitial) until it confirms.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    // The ?order= path already resumes from the order itself — skip the
    // localStorage path so they don't race.
    if (orderId) return;
    const raw = localStorage.getItem('rg_pending_order');
    if (!raw) return;
    let pending: { id?: string; slug?: string };
    try {
      pending = JSON.parse(raw);
    } catch {
      localStorage.removeItem('rg_pending_order');
      return;
    }
    if (!pending.id || (pending.slug && pending.slug !== slug)) return;

    ticketingApi
      .getOrder(pending.id)
      .then((r) => {
        setOrder(r.order);
        setStep('done');
        if (r.order.status === 'paid') {
          localStorage.removeItem('rg_pending_order');
        }
      })
      .catch(() => {
        // Order lookup failed — drop the stale key, stay on the detail view.
        localStorage.removeItem('rg_pending_order');
      });
  }, [slug, orderId]);

  // When arriving at the success page after Izipay redirect, confirmation is
  // async (IPN). Poll until order transitions to paid.
  useEffect(() => {
    if (step === 'done' && order && order.status !== 'paid') {
      pollUntilPaid(order.id);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step]);

  // Countdown for hold — clamp to 0, guard against absurd/far-future dates
  useEffect(() => {
    if (step !== 'pay' || !order?.expires_at) return;
    const expiresMs = new Date(order.expires_at).getTime();
    const maxMs = Date.now() + 25 * 60 * 1000; // cap at 25 min from now
    const clampedExpires = Math.min(expiresMs, maxMs);
    const tick = () => {
      const secs = Math.max(0, Math.floor((clampedExpires - Date.now()) / 1000));
      setHoldSecs(secs);
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [step, order]);

  const seatSection = useMemo(() => {
    const map = new Map<string, Section>();
    event?.sections.forEach((s) => s.seats.forEach((seat) => map.set(seat.id, s)));
    return map;
  }, [event]);

  // Build a table lookup: seat.id -> VenueTable
  const seatTable = useMemo(() => {
    const map = new Map<string, VenueTable>();
    event?.sections.forEach((s) =>
      s.seats.forEach((seat) => {
        if (seat.table_id) {
          const tbl = s.tables.find((t) => t.id === seat.table_id);
          if (tbl) map.set(seat.id, tbl);
        }
      })
    );
    return map;
  }, [event]);

  const comboDiscount = useMemo(() => {
    if (!event) return null;
    const bySection = new Map<string, number>();
    selected.forEach((id) => {
      const sec = seatSection.get(id);
      if (sec) bySection.set(sec.id, (bySection.get(sec.id) || 0) + 1);
    });
    let subtotal = 0;
    let bundled = 0;
    bySection.forEach((count, sectionId) => {
      const sec = event.sections.find((s) => s.id === sectionId);
      if (!sec) return;
      const unitPrice = Number(sec.price_bundles[0]?.price || 0);
      subtotal += unitPrice * count;
      bundled += bundleTotal(sec.price_bundles, count);
    });
    const saving = subtotal - bundled;
    return saving > 0 ? { label: 'Combo aplicado', amount: saving, subtotal, total: bundled } : null;
  }, [selected, event, seatSection]);

  const estimate = useMemo(() => {
    if (!event) return 0;
    const bySection = new Map<string, number>();
    selected.forEach((id) => {
      const sec = seatSection.get(id);
      if (sec) bySection.set(sec.id, (bySection.get(sec.id) || 0) + 1);
    });
    let total = 0;
    bySection.forEach((count, sectionId) => {
      const sec = event.sections.find((s) => s.id === sectionId);
      if (sec) total += bundleTotal(sec.price_bundles, count);
    });
    for (const sec of event.sections) {
      const q = gaQty[sec.id] || 0;
      if (q > 0) total += q * Number(sec.price_bundles[0]?.price || 0);
    }
    return total;
  }, [selected, event, seatSection, gaQty]);

  const gaTotalQty = Object.values(gaQty).reduce((a, b) => a + b, 0);
  const selectedCount = selected.length + gaTotalQty;

  const minPrice = useMemo(() => {
    if (!event) return 0;
    const prices = event.sections.flatMap((s) => s.price_bundles.map((b) => Number(b.price)));
    return prices.length > 0 ? Math.min(...prices) : 0;
  }, [event]);

  function toggleSeat(id: string) {
    setSelected((cur) => {
      if (cur.includes(id)) {
        setError(null);
        return cur.filter((s) => s !== id);
      }
      if (cur.length >= MAX_SEATS_PER_ORDER) {
        setError(`Máximo ${MAX_SEATS_PER_ORDER} entradas por compra.`);
        return cur;
      }
      return [...cur, id];
    });
  }

  function removeSeat(id: string) {
    setSelected((cur) => cur.filter((s) => s !== id));
  }

  function bumpGa(section: Section, delta: number) {
    setGaQty((cur) => {
      const next = Math.max(0, Math.min(section.available ?? 0, (cur[section.id] || 0) + delta));
      return { ...cur, [section.id]: next };
    });
  }

  async function handleBuy() {
    if (!event || selectedCount === 0) return;
    setWorking(true);
    setError(null);
    try {
      const ga = Object.entries(gaQty).find(([, q]) => q > 0);
      const { order } = ga
        ? await ticketingApi.createGeneralOrder(ga[0], ga[1], {})
        : await ticketingApi.createOrder(event.id, selected, {}, promo.trim() || undefined);
      setOrder(order);
      setStep('pay');
    } catch (err) {
      const data = (err as ApiError)?.data as { error?: string } | undefined;
      setError(
        data?.error === 'seats_unavailable'
          ? 'Algunos asientos ya no están disponibles. Elige otros.'
          : data?.error === 'sold_out'
            ? 'Ya no quedan entradas disponibles.'
            : data?.error === 'too_many'
              ? `Máximo ${MAX_SEATS_PER_ORDER} entradas por compra.`
              : data?.error === 'invalid_promo'
                ? 'El código de descuento no es válido.'
                : 'No se pudo crear la orden.'
      );
    } finally {
      setWorking(false);
    }
  }

  // Manual / coordinated pay: create the order tagged "manual" (held 24h, not 15min)
  // and show the coordina screen. The band confirms it in the admin once they see the Yapeo.
  async function handleManual() {
    if (!event || selectedCount === 0) return;
    if (Object.values(gaQty).some((q) => q > 0)) {
      setError('El pago coordinado por Yape/Plin aún no está disponible para entradas generales.');
      return;
    }
    setWorking(true);
    setError(null);
    try {
      const { order } = await ticketingApi.createOrder(event.id, selected, {}, promo.trim() || undefined, 'manual');
      setOrder(order);
      setStep('coordinate');
    } catch (err) {
      const data = (err as ApiError)?.data as { error?: string } | undefined;
      setError(
        data?.error === 'seats_unavailable'
          ? 'Algunos asientos ya no están disponibles. Elige otros.'
          : data?.error === 'too_many'
            ? `Máximo ${MAX_SEATS_PER_ORDER} entradas por compra.`
            : 'No se pudo crear la reserva.'
      );
    } finally {
      setWorking(false);
    }
  }

  // "Ya pagué": record the buyer's report (name/email + operation #) and alert the band,
  // then show their pending ticket. Does NOT mark paid — the band confirms in the admin.
  async function handleReport() {
    if (!order || !repEmail.trim()) return;
    setWorking(true);
    setError(null);
    try {
      const { order: updated } = await ticketingApi.reportPayment(
        order.id,
        { first_name: repName.trim() || undefined, email: repEmail.trim() || undefined },
        repOp.trim()
      );
      setOrder(updated);
      setStep('pending');
    } catch {
      setError('No se pudo registrar tu reporte. Intenta de nuevo o escríbenos por WhatsApp.');
    } finally {
      setWorking(false);
    }
  }

  async function handlePay() {
    if (!order) return;
    setWorking(true);
    setError(null);
    try {
      const { payment_url } = await ticketingApi.createPaymentLink(order.id);
      // Persist the pending order so we can resume the ticket view when Izipay
      // redirects back (it may land on the homepage, not here).
      if (typeof window !== 'undefined') {
        localStorage.setItem('rg_pending_order', JSON.stringify({ id: order.id, slug: resolvedSlug }));
      }
      // In tests, window.__IZIPAY_TEST_SKIP__ suppresses the redirect so the
      // mock can simulate a paid order without leaving the page.
      if (typeof window !== 'undefined' && (window as Window & { __IZIPAY_TEST_SKIP__?: boolean }).__IZIPAY_TEST_SKIP__) {
        // Test hook: poll once then advance to done.
        const { order: refreshed } = await ticketingApi.getOrder(order.id);
        setOrder(refreshed);
        setStep('done');
        return;
      }
      window.location.href = payment_url;
    } catch {
      setError('No se pudo generar el enlace de pago.');
    } finally {
      setWorking(false);
    }
  }

  // Poll order status after returning from Izipay (IPN is async).
  // Called on F4 mount when order.status is still 'pending'.
  async function pollUntilPaid(orderId: string, maxAttempts = 20) {
    setPolling(true);
    for (let i = 0; i < maxAttempts; i++) {
      await new Promise((r) => setTimeout(r, 2000));
      try {
        const { order: refreshed } = await ticketingApi.getOrder(orderId);
        if (refreshed.status === 'paid') {
          setOrder(refreshed);
          setPolling(false);
          if (typeof window !== 'undefined') localStorage.removeItem('rg_pending_order');
          return;
        }
      } catch {
        // keep retrying
      }
    }
    setPolling(false);
  }

  async function handleSaveName() {
    if (!order || !askFirstName) return;
    try {
      await ticketingApi.updateOrderBuyer(order.id, { first_name: askFirstName, last_name: askLastName });
      setNameSaved(true);
    } catch {
      // silent
    }
  }

  // Build the order's tickets into one PDF (a page per ticket) in the browser
  // and trigger a download. QR is rasterized from the backend qr_svg so it
  // scans identically to the on-screen ticket.
  async function handleDownloadPdf() {
    if (!order || !event || pdfBusy) return;
    setPdfBusy(true);
    try {
      const buyerName = [order.buyer_first_name, order.buyer_last_name]
        .filter(Boolean).join(' ').trim() || null;
      const bytes = await buildOrderPdf(order.tickets, {
        eventName: event.name,
        venue: event.venue_name,
        date: event.starts_at,
        buyerName,
      });
      downloadPdf(bytes, ticketFilename(event.name, order.tickets[0]?.public_token));
    } finally {
      setPdfBusy(false);
    }
  }

  if (loading) return (
    <div style={{ minHeight: '100vh', background: 'var(--color-bg)', color: 'var(--color-text)', fontFamily: 'var(--font-body)' }}>
      <Nav />
      <div className="rg-gutter" style={{ maxWidth: '1120px', margin: '0 auto', paddingTop: '36px', paddingBottom: '80px' }} aria-busy="true" aria-label="Cargando evento">
        {/* Branded skeleton that mirrors the F1 layout so the page doesn't jump */}
        <div className="rg-skeleton" style={{ height: 'clamp(220px, 40vw, 360px)', borderRadius: 'var(--radius-frame)', marginBottom: '28px' }} />
        <div className="rg-skeleton" style={{ height: '38px', width: '70%', marginBottom: '14px' }} />
        <div className="rg-skeleton" style={{ height: '20px', width: '45%', marginBottom: '28px' }} />
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {[0, 1, 2].map((i) => (
            <div key={i} className="rg-skeleton" style={{ height: '58px' }} />
          ))}
        </div>
      </div>
    </div>
  );
  if (!event) return (
    <div style={{ minHeight: '100vh', background: 'var(--color-bg)', color: 'var(--color-text)', fontFamily: 'var(--font-body)' }}>
      <Nav />
      <main className="rg-gutter" style={{ minHeight: 'calc(100vh - 57px)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', gap: '16px' }}>
        <div style={{ fontSize: '2.4rem' }}>🎫</div>
        <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 'clamp(1.8rem, 6vw, 2.6rem)', letterSpacing: '0.03em', margin: 0 }}>
          {error || 'Evento no encontrado'}
        </h1>
        <p style={{ color: 'var(--color-text-muted)', maxWidth: '360px' }}>
          Puede que el enlace haya cambiado o el evento ya no esté disponible.
        </p>
        <Link href="/" className="rg-cta" style={{ marginTop: '6px', background: 'var(--color-pink)', color: '#fff', padding: '13px 28px', borderRadius: 'var(--radius-pill)', fontFamily: 'var(--font-display)', letterSpacing: '0.05em', fontSize: '1.1rem', textDecoration: 'none', boxShadow: 'var(--shadow-cta)' }}>
          Volver al inicio
        </Link>
      </main>
    </div>
  );

  const seatedSections = event.sections.filter((s) => s.layout_type !== 'general');
  const gaSections = event.sections.filter((s) => s.layout_type === 'general');
  const totalSeated = seatedSections.reduce((n, s) => n + s.seats.length, 0);
  const showNums = totalSeated <= 120;
  const isMesas = seatedSections.some((s) => s.layout_type === 'tables');

  // Venue map: build a keyless Google Maps embed (output=embed) from the address.
  // Short links like maps.app.goo.gl can't be iframed — Google blocks them via
  // X-Frame-Options, only the output=embed form is embeddable without an API key.
  // "Cómo llegar" still uses the event's own map_url when set, since that opens
  // the real pinned place in the Maps app; otherwise it falls back to the query.
  const mapQuery = [event.venue_name, event.venue_address].filter(Boolean).join(', ');
  const mapEmbedSrc = mapQuery
    ? `https://www.google.com/maps?q=${encodeURIComponent(mapQuery)}&z=16&hl=es&output=embed`
    : null;
  const directionsHref =
    event.map_url || (mapQuery ? `https://www.google.com/maps?q=${encodeURIComponent(mapQuery)}` : null);

  // Stage positioning from event data (C1)
  const cw = event.canvas_width || 1600;
  const ch = event.canvas_height || 900;
  const hasStageData = event.stage_w != null && event.stage_h != null;
  const stageStyle: React.CSSProperties = hasStageData
    ? {
        position: 'absolute',
        left: `${((event.stage_x ?? 0) / cw) * 100}%`,
        top: `${((event.stage_y ?? 0) / ch) * 100}%`,
        width: `${((event.stage_w ?? 0) / cw) * 100}%`,
        height: `${((event.stage_h ?? 0) / ch) * 100}%`,
        background: 'linear-gradient(180deg, rgba(255,20,147,.25), transparent)',
        border: '1px solid rgba(255,20,147,.3)',
        borderRadius: '7px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontFamily: 'var(--font-display)',
        fontSize: '0.74rem',
        letterSpacing: '0.35em',
        color: 'rgba(236,230,240,.7)',
        pointerEvents: 'none',
        zIndex: 3,
      }
    : {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        padding: '8px',
        textAlign: 'center',
        color: 'rgba(236,230,240,.45)',
        fontSize: '0.6rem',
        letterSpacing: '0.35em',
        background: 'linear-gradient(to bottom, rgba(255,20,147,.2), transparent)',
        pointerEvents: 'none',
        zIndex: 10,
        fontFamily: 'var(--font-display)',
      };

  // ─── F1: Event Detail ───
  if (step === 'detail') {
    return (
      <div style={{ minHeight: '100vh', background: 'var(--color-bg)', color: 'var(--color-text)', fontFamily: 'var(--font-body)' }}>
        {/* Nav */}
        <Nav />

        <main>
          {/* Hero — neon gradient (no flyer background); the flyer renders as a
              contained poster at the top of the content below. */}
          <section className="rg-gutter" style={{
            position: 'relative',
            minHeight: 'clamp(380px, 58vh, 720px)',
            background: 'radial-gradient(80% 60% at 20% 0%,rgba(191,0,255,.4),transparent 55%), radial-gradient(70% 60% at 85% 5%,rgba(0,229,255,.32),transparent 55%), radial-gradient(120% 90% at 50% 120%,rgba(255,20,147,.5),transparent 55%), linear-gradient(180deg,#1a0626,#08020e)',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'flex-end',
            paddingTop: 'clamp(28px, 6vw, 40px)',
            paddingBottom: 'clamp(32px, 6vw, 48px)',
          }}>
            <div style={{ maxWidth: '1120px', margin: '0 auto', width: '100%', position: 'relative', zIndex: 2 }}>
              {/* Badges */}
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '20px' }}>
                <span style={{ background: 'rgba(0,229,255,.12)', border: '1px solid rgba(0,229,255,.5)', borderRadius: 'var(--radius-pill)', padding: '6px 12px', fontSize: '0.66rem', color: 'var(--color-cyan)', letterSpacing: '0.16em', fontWeight: 600, textTransform: 'uppercase' }}>
                  ● Preventa · hasta agotar stock
                </span>
                {event.status === 'published' && (
                  <span style={{ background: 'rgba(255,215,0,.1)', border: '1px solid rgba(255,215,0,.5)', borderRadius: 'var(--radius-pill)', padding: '6px 12px', fontSize: '0.66rem', color: 'var(--color-gold)', letterSpacing: '0.16em', fontWeight: 600, textTransform: 'uppercase' }}>
                    Rock & Disco
                  </span>
                )}
              </div>
              {/* Title */}
              <h1 style={{
                fontFamily: 'var(--font-display)',
                fontSize: 'clamp(3rem,9vw,6.5rem)',
                lineHeight: 0.9,
                letterSpacing: '0.01em',
                margin: 0,
                textShadow: '0 0 30px rgba(255,20,147,.35)',
                color: 'var(--color-text)',
              }}>
                {event.name}
              </h1>
              {event.venue_name && (
                <p style={{
                  fontFamily: 'var(--font-display)',
                  fontSize: 'clamp(1.4rem,4vw,2.4rem)',
                  letterSpacing: '0.04em',
                  color: 'var(--color-gold)',
                  margin: '8px 0 14px',
                }}>
                  {event.venue_name}
                </p>
              )}
              {/* Meta row */}
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '20px', fontSize: '0.95rem', color: 'var(--color-text)', alignItems: 'center', marginTop: '14px' }}>
                <span><span style={{ color: 'var(--color-cyan)', fontWeight: 600, letterSpacing: '0.04em' }}>{formatDate(event.starts_at)}</span></span>
                {event.venue_name && <span><span style={{ color: 'var(--color-cyan)', fontWeight: 600 }}>{event.venue_name}</span> · Lima</span>}
                {minPrice > 0 && <span><span style={{ color: 'var(--color-cyan)', fontWeight: 600 }}>Desde</span> <Money value={minPrice} /></span>}
              </div>
            </div>
          </section>

          {/* Two-column content — collapses to one column < 920px (.rg-buy-grid) */}
          <div className="rg-buy-grid rg-gutter" style={{
            maxWidth: '1120px',
            margin: '0 auto',
            paddingTop: '36px',
            paddingBottom: '80px',
          }}>
            {/* Left column */}
            <div>
              {/* Flyer — full poster, contained (object-contain) so it's never
                  cropped; sits at the top of the content, not behind the hero. */}
              {event.flyer_url && (
                <div style={{ marginBottom: '34px' }}>
                  <img
                    data-testid="event-flyer"
                    src={event.flyer_url}
                    alt={`Flyer de ${event.name}`}
                    style={{
                      display: 'block',
                      width: '100%',
                      maxHeight: '720px',
                      objectFit: 'contain',
                      borderRadius: 'var(--radius-frame)',
                      border: '1px solid var(--color-border)',
                      background: '#0b0020',
                    }}
                  />
                </div>
              )}

              {event.description && (
                <div style={{ marginBottom: '34px' }}>
                  <p style={{ fontSize: '0.6rem', letterSpacing: '0.18em', color: 'var(--color-cyan)', textTransform: 'uppercase', fontWeight: 600, marginBottom: '10px' }}>Acerca del evento</p>
                  <p style={{ color: 'var(--color-text-muted)', lineHeight: 1.7, whiteSpace: 'pre-line' }}>{event.description}</p>
                </div>
              )}

              {/* Venue card */}
              <div style={{ marginBottom: '34px' }}>
                <p style={{ fontSize: '0.6rem', letterSpacing: '0.18em', color: 'var(--color-cyan)', textTransform: 'uppercase', fontWeight: 600, marginBottom: '10px' }}>El lugar</p>
                <div className="rg-venue-card" style={{
                  background: 'var(--color-surface)',
                  border: '1px solid var(--color-border)',
                  borderRadius: 'var(--radius-frame)',
                  overflow: 'hidden',
                  display: 'grid',
                  gridTemplateColumns: '1fr 1fr',
                }}>
                  {/* Photo side — venue photo (not the flyer); gradient fallback when null */}
                  <div style={{
                    background: event.venue_photo_url
                      ? `url(${event.venue_photo_url}) center/cover`
                      : 'radial-gradient(70% 80% at 30% 20%,rgba(0,229,255,.25),transparent 60%), radial-gradient(80% 80% at 80% 90%,rgba(255,20,147,.3),transparent 60%), linear-gradient(135deg,#1a1230,#0c0820)',
                    minHeight: '200px',
                    display: 'flex',
                    alignItems: 'flex-end',
                    padding: '14px',
                  }}>
                    {event.venue_name && (
                      <span style={{
                        fontSize: '0.66rem',
                        color: 'rgba(255,255,255,.7)',
                        background: 'rgba(0,0,0,.35)',
                        padding: '4px 9px',
                        borderRadius: '6px',
                      }}>
                        {event.venue_name} · Lima
                      </span>
                    )}
                  </div>
                  {/* Info side */}
                  <div style={{ padding: '18px' }}>
                    <h3 style={{ fontFamily: 'var(--font-display)', fontSize: '1.4rem', margin: '0 0 6px', color: 'var(--color-text)', letterSpacing: '0.03em' }}>
                      {event.venue_name}
                    </h3>
                    {event.venue_address && (
                      <p style={{ fontSize: '0.88rem', color: 'var(--color-text-muted)', margin: '0 0 12px', lineHeight: 1.5 }}>
                        {event.venue_address}
                      </p>
                    )}
                    {/* Map — real embedded Google map (keyless output=embed); built
                        from the address since short links can't be iframed. map_url
                        stays as the "Cómo llegar" deep link. */}
                    {mapEmbedSrc ? (
                      <div style={{
                        marginTop: '14px',
                        height: '150px',
                        borderRadius: '12px',
                        border: '1px solid var(--color-border)',
                        position: 'relative',
                        overflow: 'hidden',
                      }}>
                        <iframe
                          title={`Mapa de ${event.venue_name || event.venue_address}`}
                          src={mapEmbedSrc}
                          style={{ border: 0, width: '100%', height: '100%', display: 'block' }}
                          loading="lazy"
                          referrerPolicy="no-referrer-when-downgrade"
                          allowFullScreen
                        />
                        {directionsHref && (
                          <a
                            href={directionsHref}
                            target="_blank"
                            rel="noopener noreferrer"
                            style={{ position: 'absolute', right: '10px', bottom: '10px', fontSize: '0.72rem', background: 'var(--color-pink)', color: '#fff', padding: '6px 12px', borderRadius: 'var(--radius-pill)', textDecoration: 'none', boxShadow: '0 2px 8px rgba(0,0,0,.45)' }}
                          >
                            Cómo llegar →
                          </a>
                        )}
                      </div>
                    ) : directionsHref ? (
                      <div style={{
                        marginTop: '14px',
                        height: '120px',
                        borderRadius: '12px',
                        border: '1px solid var(--color-border)',
                        position: 'relative',
                        overflow: 'hidden',
                        background: 'linear-gradient(0deg,rgba(0,229,255,.06),transparent), repeating-linear-gradient(0deg,rgba(255,255,255,.05) 0 1px,transparent 1px 26px), repeating-linear-gradient(90deg,rgba(255,255,255,.05) 0 1px,transparent 1px 26px),#0b0820',
                      }}>
                        <span style={{ position: 'absolute', left: '46%', top: '42%', color: 'var(--color-pink)', fontSize: '1.5rem', filter: 'drop-shadow(0 0 8px rgba(255,20,147,.7))' }}>📍</span>
                        <a
                          href={directionsHref}
                          target="_blank"
                          rel="noopener noreferrer"
                          style={{ position: 'absolute', right: '10px', bottom: '10px', fontSize: '0.72rem', background: 'var(--color-pink)', color: '#fff', padding: '6px 12px', borderRadius: 'var(--radius-pill)', textDecoration: 'none' }}
                        >
                          Cómo llegar →
                        </a>
                      </div>
                    ) : null}
                  </div>
                </div>
              </div>

              {/* Pricing list — render EVERY price bundle, not just the first.
                  e.g. S/40 (1 asiento) and the S/70 combo (2 asientos). */}
              <div>
                <p style={{ fontSize: '0.6rem', letterSpacing: '0.18em', color: 'var(--color-cyan)', textTransform: 'uppercase', fontWeight: 600, marginBottom: '10px' }}>Entradas</p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {event.sections.map((section) => {
                    const bundles = [...section.price_bundles].sort((a, b) => a.quantity - b.quantity);
                    return (
                      <div key={section.id} data-testid="price-section" className="rg-hover-card" style={{
                        background: 'var(--color-surface)',
                        border: '1px solid var(--color-border)',
                        borderRadius: 'var(--radius-card)',
                        padding: '14px 16px',
                      }}>
                        <p style={{ margin: '0 0 6px', fontWeight: 500 }}>{section.name}</p>
                        {bundles.length === 0 ? (
                          <p style={{ margin: 0, color: 'var(--color-text-muted)', fontSize: '0.85rem' }}>Precio por confirmar</p>
                        ) : (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                            {bundles.map((b) => (
                              <div key={b.quantity} data-testid="price-bundle" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: '10px' }}>
                                <span style={{ fontSize: '0.82rem', color: 'var(--color-text-muted)' }}>
                                  {bundleLabel(b.quantity)}
                                </span>
                                <span style={{ fontFamily: 'var(--font-display)', fontSize: '1.25rem', color: 'var(--color-pink)' }}>
                                  S/ {b.price}
                                </span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Seat-map preview — read-only, so visitors see the distribution before buying */}
              {seatedSections.length > 0 && (
                <div style={{ marginTop: '34px' }}>
                  <p style={{ fontSize: '0.6rem', letterSpacing: '0.18em', color: 'var(--color-cyan)', textTransform: 'uppercase', fontWeight: 600, marginBottom: '10px' }}>{isMesas ? 'Distribución de mesas' : 'Distribución'}</p>
                  <div style={{
                    background: 'var(--color-surface)',
                    border: '1px solid var(--color-border)',
                    borderRadius: '16px',
                    padding: '18px 20px',
                  }}>
                    <SeatMapCanvas
                      seatedSections={seatedSections}
                      isMesas={isMesas}
                      showNums={showNums}
                      totalSeated={totalSeated}
                      cw={cw}
                      ch={ch}
                      stageStyle={stageStyle}
                      selected={[]}
                      interactive={false}
                    />
                    <SeatLegend style={{ marginTop: '18px', justifyContent: 'center' }} />
                    <p style={{ fontSize: '0.66rem', color: 'var(--color-text-faint)', textAlign: 'center', margin: '12px 0 0' }}>
                      Elige tus asientos al comprar
                    </p>
                  </div>
                </div>
              )}
            </div>

            {/* Right column — sticky buy box (static + first on mobile) */}
            <aside className="rg-buy-aside-first">
              <div className="rg-buy-aside-sticky" style={{ top: '84px' }}>
                <div style={{
                  background: 'var(--color-surface)',
                  border: '1px solid var(--color-border)',
                  borderRadius: '18px',
                  padding: '20px',
                  boxShadow: 'var(--shadow-frame)',
                  alignSelf: 'start',
                }}>
                  {/* Date/venue */}
                  <p style={{ fontSize: '0.62rem', letterSpacing: '0.16em', textTransform: 'uppercase', color: 'var(--color-cyan)', fontWeight: 600 }}>
                    {formatDate(event.starts_at)}
                  </p>
                  {event.venue_name && (
                    <p style={{ fontSize: '0.85rem', color: 'var(--color-text-muted)', margin: '4px 0 14px' }}>
                      {event.venue_name} · Lima
                    </p>
                  )}

                  {/* Section prices — multi-row list per section */}
                  <p style={{ fontSize: '0.6rem', letterSpacing: '0.18em', color: 'var(--color-cyan)', textTransform: 'uppercase', fontWeight: 600, marginBottom: '8px' }}>Entradas</p>
                  {event.sections.map((section) => (
                    <div key={section.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '11px 0', borderBottom: '1px solid var(--color-border)' }}>
                      <div>
                        <p style={{ margin: 0, fontSize: '0.9rem' }}>{section.name}</p>
                        {section.price_bundles.length > 1 && (
                          <small style={{ display: 'block', color: 'var(--color-gold)', fontSize: '0.7rem', marginTop: '2px' }}>
                            Combo disponible
                          </small>
                        )}
                      </div>
                      <p style={{ fontFamily: 'var(--font-display)', fontSize: '1.3rem', color: 'var(--color-pink)', margin: 0 }}>
                        Desde <Money value={Number(section.price_bundles[0]?.price || 0)} />
                      </p>
                    </div>
                  ))}

                  {/* Min price */}
                  {minPrice > 0 && (
                    <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px', margin: '14px 0 4px' }}>
                      <span style={{ fontSize: '0.58rem', letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--color-text-faint)', fontWeight: 600 }}>Desde</span>
                      <span style={{ fontFamily: 'var(--font-display)', fontSize: '2rem', color: 'var(--color-gold)' }}>
                        <Money value={minPrice} />
                      </span>
                    </div>
                  )}

                  {/* CTA */}
                  <button
                    type="button"
                    className="rg-cta"
                    onClick={() => setStep('select')}
                    style={{
                      marginTop: '12px',
                      display: 'block',
                      width: '100%',
                      padding: '15px',
                      background: 'var(--color-pink)',
                      color: '#fff',
                      border: 'none',
                      borderRadius: 'var(--radius-pill)',
                      fontFamily: 'var(--font-display)',
                      fontSize: 'clamp(1.1rem, 4.2vw, 1.3rem)',
                      letterSpacing: '0.05em',
                      cursor: 'pointer',
                      boxShadow: 'var(--shadow-cta)',
                      textAlign: 'center',
                    }}
                  >
                    COMPRAR ENTRADAS
                  </button>
                  {/* Reassurance */}
                  <p style={{ fontSize: '0.62rem', color: 'var(--color-text-faint)', textAlign: 'center', margin: '10px 0 0' }}>
                    Precio final, sin cargos sorpresa · Yape · tarjeta
                  </p>
                  <p style={{ fontSize: '0.72rem', color: 'var(--color-cyan)', textAlign: 'center', margin: '12px 0 0' }}>
                    ● Preventa activa
                  </p>
                </div>
              </div>
            </aside>
          </div>
        </main>

        <Footer />
      </div>
    );
  }

  // ─── F2: Seat Selection ───
  if (step === 'select') {
    const orderItems = selected.map((id) => {
      const sec = seatSection.get(id);
      const seat = sec?.seats.find((s) => s.id === id);
      const tbl = seatTable.get(id);
      const label = seat ? seatFullLabel(seat, tbl) : id;
      return {
        label: `${sec?.name || 'Asiento'} · ${label}`,
        unitPrice: Number(sec?.price_bundles[0]?.price || 0),
        qty: 1,
        id,
      };
    });

    return (
      <div style={{ minHeight: '100vh', background: 'var(--color-bg)', color: 'var(--color-text)', fontFamily: 'var(--font-body)' }}>
        {/* Nav */}
        <Nav />

        <main>
          {/* Context bar */}
          <div className="rg-gutter" style={{
            position: 'sticky',
            top: '57px',
            zIndex: 40,
            background: 'rgba(8,2,14,.72)',
            backdropFilter: 'blur(10px)',
            WebkitBackdropFilter: 'blur(10px)',
            borderBottom: '1px solid var(--color-border)',
            paddingTop: '12px',
            paddingBottom: '12px',
          }}>
            <div style={{ maxWidth: '1120px', margin: '0 auto', display: 'flex', alignItems: 'center', gap: 'clamp(10px, 3vw, 18px)', flexWrap: 'wrap' }}>
              <button
                type="button"
                onClick={() => setStep('detail')}
                style={{ background: 'none', border: 'none', color: 'var(--color-cyan)', cursor: 'pointer', fontSize: '0.82rem', padding: 0, fontWeight: 500, whiteSpace: 'nowrap' }}
              >
                ← Volver
              </button>
              <span style={{ fontFamily: 'var(--font-display)', fontSize: 'clamp(1.2rem, 4.5vw, 1.45rem)', letterSpacing: '0.05em', lineHeight: 1, minWidth: 0 }}>{event.name}</span>
              <span style={{ marginLeft: 'auto', fontSize: '0.8rem', color: 'var(--color-text-muted)' }}>
                <span style={{ color: 'var(--color-cyan)', fontWeight: 600, letterSpacing: '0.03em' }}>{formatDate(event.starts_at)}</span>
                {event.venue_name && <span> · {event.venue_name}</span>}
              </span>
            </div>
          </div>

          {error && (
            <div className="rg-gutter" style={{ maxWidth: '1120px', margin: '16px auto 0' }}>
              <div role="alert" style={{ background: 'rgba(255,90,110,.08)', border: '1px solid rgba(255,90,110,.3)', borderRadius: 'var(--radius-card)', padding: '12px 16px', color: '#ff5a6e', fontSize: '0.88rem' }}>
                {error}
              </div>
            </div>
          )}

          <div className="rg-buy-grid rg-gutter" style={{
            maxWidth: '1120px',
            margin: '0 auto',
            paddingTop: '28px',
            paddingBottom: '80px',
          }}>
            {/* Left: map card */}
            <div style={{
              background: 'var(--color-surface)',
              border: '1px solid var(--color-border)',
              borderRadius: '16px',
              padding: 'clamp(14px, 4vw, 18px) clamp(14px, 4vw, 20px)',
            }}>
              {/* Mapa/Lista toggle + scarcity */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '10px', flexWrap: 'wrap', marginBottom: '0' }}>
                <div style={{ display: 'inline-flex', border: '1px solid rgba(255,255,255,.14)', borderRadius: 'var(--radius-pill)', overflow: 'hidden', fontSize: '0.78rem' }}>
                  {(['map', 'list'] as MapView[]).map((v) => (
                    <button
                      key={v}
                      type="button"
                      onClick={() => setMapView(v)}
                      style={{
                        padding: '7px 18px',
                        border: 'none',
                        cursor: 'pointer',
                        fontFamily: 'var(--font-body)',
                        fontSize: '0.78rem',
                        background: mapView === v ? 'var(--color-pink)' : 'transparent',
                        color: mapView === v ? '#fff' : 'var(--color-text-muted)',
                        fontWeight: mapView === v ? 600 : undefined,
                      }}
                    >
                      {v === 'map' ? 'Mapa' : 'Lista'}
                    </button>
                  ))}
                </div>
                <span style={{ fontSize: '0.66rem', fontWeight: 600, letterSpacing: '0.14em', color: 'var(--color-cyan)', textTransform: 'uppercase' }}>
                  {selectedCount > 0 ? `${selectedCount} seleccionado${selectedCount !== 1 ? 's' : ''}` : 'Preventa'}
                </span>
              </div>

              {/* Combo/deal pills — gold/amber */}
              {seatedSections.some((s) => s.price_bundles.length > 1) && (
                <div style={{ marginTop: '14px', display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                  {seatedSections.filter((s) => s.price_bundles.length > 1).map((s) => (
                    <span key={s.id} style={{ fontSize: '0.74rem', padding: '7px 12px', borderRadius: 'var(--radius-pill)', background: 'rgba(255,215,0,.1)', border: '1px solid rgba(255,215,0,.55)', color: 'var(--color-gold)' }}>
                      💎 {s.name} combo · {s.price_bundles.length > 1 ? `2 × S/ ${s.price_bundles[1]?.price}` : ''}
                    </span>
                  ))}
                </div>
              )}

              {/* Map view */}
              {mapView === 'map' && (
                <>
                  {seatedSections.length > 0 && (
                    <SeatMapCanvas
                      seatedSections={seatedSections}
                      isMesas={isMesas}
                      showNums={showNums}
                      totalSeated={totalSeated}
                      cw={cw}
                      ch={ch}
                      stageStyle={stageStyle}
                      selected={selected}
                      interactive
                      onToggle={toggleSeat}
                    />
                  )}

                  {gaSections.map((section) => (
                    <section key={section.id} data-section-id={section.id} style={{ marginTop: '16px', background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-card)', padding: '16px' }}>
                      <h3 style={{ fontFamily: 'var(--font-display)', fontSize: '1.1rem', margin: '0 0 12px', color: 'var(--color-cyan)' }}>
                        {section.name}
                        {section.price_bundles[0] && <span style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)', marginLeft: '8px' }}>desde S/ {section.price_bundles[0].price}</span>}
                      </h3>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <p data-testid="ga-available" style={{ color: 'var(--color-text-muted)', fontSize: '0.88rem', margin: 0 }}>{section.available ?? 0} disponibles</p>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                          <button type="button" data-testid="ga-minus" onClick={() => bumpGa(section, -1)} style={{ background: 'none', border: '1px solid var(--color-border)', color: 'var(--color-text)', width: '32px', height: '32px', borderRadius: '50%', cursor: 'pointer', fontSize: '1.1rem' }}>−</button>
                          <span data-testid="ga-qty" style={{ fontSize: '1.25rem', fontWeight: 600, minWidth: '2rem', textAlign: 'center' }}>{gaQty[section.id] || 0}</span>
                          <button type="button" data-testid="ga-plus" onClick={() => bumpGa(section, 1)} style={{ background: 'none', border: '1px solid var(--color-border)', color: 'var(--color-text)', width: '32px', height: '32px', borderRadius: '50%', cursor: 'pointer', fontSize: '1.1rem' }}>+</button>
                        </div>
                      </div>
                    </section>
                  ))}
                </>
              )}

              {/* Lista view */}
              {mapView === 'list' && (
                <div data-testid="seat-list" style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginTop: '16px' }}>
                  {seatedSections.map((section, si) => {
                    const color = SECTION_COLORS[si % SECTION_COLORS.length];
                    return (
                      <div key={section.id} style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-card)', padding: '16px' }}>
                        <p style={{ fontFamily: 'var(--font-display)', fontSize: '1rem', margin: '0 0 10px', color }}>
                          {section.name}
                          {section.price_bundles[0] && <span style={{ fontSize: '0.78rem', color: 'var(--color-text-muted)', marginLeft: '8px', fontFamily: 'var(--font-body)' }}>S/ {section.price_bundles[0].price}</span>}
                        </p>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                          {section.seats.map((seat) => {
                            const isSel = selected.includes(seat.id);
                            const available = seat.status === 'available';
                            return (
                              <button
                                key={seat.id}
                                type="button"
                                data-seat-id={seat.id}
                                data-status={seat.status}
                                data-selected={isSel}
                                disabled={!available}
                                onClick={() => toggleSeat(seat.id)}
                                style={{
                                  padding: '6px 12px',
                                  borderRadius: 'var(--radius-combo)',
                                  border: '1px solid',
                                  cursor: available ? 'pointer' : 'not-allowed',
                                  fontSize: '0.78rem',
                                  fontFamily: 'var(--font-body)',
                                  transition: 'all 0.15s',
                                  ...(isSel
                                    ? { background: 'var(--color-pink)', borderColor: 'var(--color-pink)', color: '#fff' }
                                    : !available
                                      ? { background: 'rgba(255,255,255,.03)', borderColor: 'rgba(255,255,255,.08)', color: 'rgba(236,230,240,.25)' }
                                      : { background: `${color}1a`, borderColor: color, color }),
                                }}
                              >
                                {seatName(seat)}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                  {gaSections.map((section) => (
                    <section key={section.id} data-section-id={section.id} style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-card)', padding: '16px' }}>
                      <h3 style={{ fontFamily: 'var(--font-display)', fontSize: '1rem', margin: '0 0 12px', color: 'var(--color-cyan)' }}>{section.name}</h3>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <p data-testid="ga-available" style={{ color: 'var(--color-text-muted)', fontSize: '0.88rem', margin: 0 }}>{section.available ?? 0} disponibles</p>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                          <button type="button" data-testid="ga-minus" onClick={() => bumpGa(section, -1)} style={{ background: 'none', border: '1px solid var(--color-border)', color: 'var(--color-text)', width: '32px', height: '32px', borderRadius: '50%', cursor: 'pointer', fontSize: '1.1rem' }}>−</button>
                          <span data-testid="ga-qty" style={{ fontSize: '1.25rem', fontWeight: 600, minWidth: '2rem', textAlign: 'center' }}>{gaQty[section.id] || 0}</span>
                          <button type="button" data-testid="ga-plus" onClick={() => bumpGa(section, 1)} style={{ background: 'none', border: '1px solid var(--color-border)', color: 'var(--color-text)', width: '32px', height: '32px', borderRadius: '50%', cursor: 'pointer', fontSize: '1.1rem' }}>+</button>
                        </div>
                      </div>
                    </section>
                  ))}
                </div>
              )}

              {/* Seat legend — use <SeatLegend> component; Ocupado label is built-in */}
              <SeatLegend
                data-testid="seat-legend"
                style={{ marginTop: '22px', justifyContent: 'center' }}
              />
            </div>

            {/* Right: sticky order summary (after the map on mobile) */}
            <aside>
              <div className="rg-buy-aside-sticky" style={{ top: '118px' }}>
                <div style={{
                  background: 'var(--color-surface)',
                  border: '1px solid var(--color-border)',
                  borderRadius: '18px',
                  padding: '20px',
                  boxShadow: 'var(--shadow-frame)',
                  alignSelf: 'start',
                }}>
                  <p style={{ fontFamily: 'var(--font-display)', fontSize: '1.3rem', letterSpacing: '0.06em', margin: '0 0 0', fontWeight: 400 }}>TU SELECCIÓN</p>
                  {holdSecs !== null && (
                    <p style={{ fontSize: '0.66rem', color: 'rgba(236,230,240,.5)', marginBottom: '14px' }}>
                      ⏱ Reservado por <span style={{ color: 'var(--color-cyan)', fontWeight: 600, letterSpacing: '0.04em' }}>{formatHoldTime(holdSecs)}</span>
                    </p>
                  )}

                  {selected.length === 0 && gaTotalQty === 0 && (
                    <p style={{ color: 'var(--color-text-faint)', fontSize: '0.82rem', margin: '14px 0' }}>Selecciona asientos en el mapa</p>
                  )}

                  {/* Selected seat items */}
                  {orderItems.map((item) => (
                    <div key={item.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '10px', fontSize: '0.84rem', padding: '9px 0', borderBottom: '1px solid var(--color-border)' }}>
                      <span style={{ color: 'var(--color-text-muted)' }}>
                        {item.label}
                        {' '}
                        <span
                          role="button"
                          tabIndex={0}
                          onClick={() => removeSeat(item.id)}
                          onKeyDown={(e) => e.key === 'Enter' && removeSeat(item.id)}
                          style={{ color: 'rgba(236,230,240,.4)', cursor: 'pointer' }}
                        >✕</span>
                      </span>
                      <span style={{ fontFamily: 'var(--font-display)', fontSize: '1.05rem', color: 'var(--color-pink)', whiteSpace: 'nowrap' }}>S/ {item.unitPrice}</span>
                    </div>
                  ))}

                  {/* Combo discount callout */}
                  {comboDiscount && (
                    <div style={{ marginTop: '11px', background: 'rgba(255,215,0,.08)', border: '1px solid rgba(255,215,0,.35)', borderRadius: '10px', padding: '10px 12px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.76rem', color: 'var(--color-gold)', fontWeight: 600 }}>
                        <span>💎 {comboDiscount.label}</span>
                        <span>−S/ {comboDiscount.amount.toFixed(2)}</span>
                      </div>
                      <div style={{ fontSize: '0.66rem', color: 'rgba(236,230,240,.55)', marginTop: '2px' }}>
                        2 entradas a precio de combo
                      </div>
                    </div>
                  )}

                  {/* Subtotal + Discount + Total */}
                  {selectedCount > 0 && (
                    <div style={{ marginTop: '13px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.78rem', color: 'rgba(236,230,240,.6)', marginTop: '13px' }}>
                        <span>Subtotal</span>
                        <span>S/ {(comboDiscount?.subtotal ?? estimate).toFixed(2)}</span>
                      </div>
                      {comboDiscount && (
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.78rem', color: 'var(--color-gold)', marginTop: '3px' }}>
                          <span>Descuento combo</span>
                          <span>−S/ {comboDiscount.amount.toFixed(2)}</span>
                        </div>
                      )}
                      <div style={{ height: '1px', background: 'rgba(255,255,255,.08)', margin: '11px 0' }} />
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                        <span style={{ fontFamily: 'var(--font-display)', letterSpacing: '0.05em', fontSize: '1.2rem' }}>TOTAL</span>
                        <span data-testid="order-total-value" style={{ fontFamily: 'var(--font-display)', fontSize: '2rem', color: 'var(--color-gold)' }}>
                          S/ {estimate.toFixed(2)}
                        </span>
                      </div>
                    </div>
                  )}

                  {/* Promo input */}
                  <div style={{ marginTop: '12px' }}>
                    <input
                      placeholder="Código de descuento (opcional)"
                      value={promo}
                      onChange={(e) => setPromo(e.target.value)}
                      style={{
                        width: '100%',
                        padding: '8px 12px',
                        background: 'var(--color-surface)',
                        border: '1px solid var(--color-border)',
                        borderRadius: 'var(--radius-card)',
                        color: 'var(--color-text)',
                        fontSize: '0.82rem',
                        outline: 'none',
                        boxSizing: 'border-box',
                      }}
                    />
                  </div>

                  {/* CTA — two ways to pay: card (Izipay, instant) or Yape/Plin (coordinated) */}
                  <button
                    type="button"
                    className="rg-cta"
                    data-testid="pay-card"
                    disabled={selectedCount === 0 || working}
                    onClick={handleBuy}
                    style={{
                      marginTop: '15px',
                      display: 'block',
                      width: '100%',
                      padding: '15px',
                      background: selectedCount > 0 ? 'var(--color-pink)' : 'rgba(255,255,255,.08)',
                      color: selectedCount > 0 ? '#fff' : 'var(--color-text-faint)',
                      border: 'none',
                      borderRadius: 'var(--radius-pill)',
                      fontFamily: 'var(--font-display)',
                      fontSize: 'clamp(1.1rem, 4.2vw, 1.3rem)',
                      letterSpacing: '0.05em',
                      cursor: selectedCount > 0 && !working ? 'pointer' : 'not-allowed',
                      boxShadow: selectedCount > 0 ? 'var(--shadow-cta)' : 'none',
                      textAlign: 'center',
                      opacity: working ? 0.6 : 1,
                    }}
                  >
                    {working ? 'PROCESANDO...' : 'PAGAR CON TARJETA'}
                  </button>
                  <button
                    type="button"
                    data-testid="pay-yape"
                    disabled={selectedCount === 0 || working}
                    onClick={handleManual}
                    style={{
                      marginTop: '10px',
                      display: 'block',
                      width: '100%',
                      padding: '14px',
                      background: 'transparent',
                      color: selectedCount > 0 ? 'var(--color-text)' : 'var(--color-text-faint)',
                      border: '1px solid var(--color-border)',
                      borderRadius: 'var(--radius-pill)',
                      fontFamily: 'var(--font-display)',
                      fontSize: 'clamp(1rem, 4vw, 1.2rem)',
                      letterSpacing: '0.05em',
                      cursor: selectedCount > 0 && !working ? 'pointer' : 'not-allowed',
                      textAlign: 'center',
                      opacity: working ? 0.6 : 1,
                    }}
                  >
                    YAPE / PLIN · COORDINAR
                  </button>
                  <div style={{ marginTop: '10px', fontSize: '0.64rem', color: 'var(--color-text-faint)', textAlign: 'center' }}>
                    Tarjeta: pago al instante con Izipay · Yape / Plin: coordinas por WhatsApp
                  </div>
                </div>
              </div>
            </aside>
          </div>
        </main>

        <Footer />
      </div>
    );
  }

  // ─── Coordina tu pago (Yape / Plin / transferencia · confirmación manual) ───
  if (step === 'coordinate' && order) {
    const ref = order.id.slice(0, 8).toUpperCase();
    const entradas = order.tickets?.length || selectedCount;
    const waText = encodeURIComponent(
      `¡Hola RetroGroove! Reservé ${entradas} entrada(s) para "${event.name}". ` +
        `Total S/ ${order.total}. Referencia ${ref}. Les envío mi comprobante de Yape/Plin.`
    );
    const repInput: React.CSSProperties = {
      width: '100%', boxSizing: 'border-box', padding: '11px 13px', background: 'var(--color-bg)',
      border: '1px solid var(--color-border)', borderRadius: 'var(--radius-card)',
      color: 'var(--color-text)', fontSize: '0.9rem', outline: 'none',
    };
    return (
      <div style={{ minHeight: '100vh', background: 'var(--color-bg)', color: 'var(--color-text)', fontFamily: 'var(--font-body)' }}>
        <Nav />
        <main className="rg-gutter" style={{ maxWidth: '560px', margin: '0 auto', padding: '28px 0 80px' }}>
          <button type="button" className="rg-link" onClick={() => setStep('select')} style={{ marginBottom: '14px' }}>
            ← Volver a los asientos
          </button>

          <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 'clamp(1.8rem,6vw,2.4rem)', letterSpacing: '0.03em', margin: '0 0 6px' }}>
            Coordina tu pago 🪩
          </h1>
          <p style={{ color: 'var(--color-text-muted)', marginBottom: '20px', lineHeight: 1.6 }}>
            Tus asientos están <strong style={{ color: 'var(--color-text)' }}>apartados por 24 horas</strong>. Paga con Yape o Plin y envíanos el comprobante por WhatsApp — apenas lo confirmemos te llegan tus entradas por correo.
          </p>

          <div data-testid="coordinate-card" style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-frame)', padding: '20px', marginBottom: '16px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '14px' }}>
              <span style={{ color: 'var(--color-text-muted)', fontSize: '0.82rem' }}>{entradas} entrada(s)</span>
              <span data-testid="coordinate-total" style={{ fontFamily: 'var(--font-display)', fontSize: '2rem', color: 'var(--color-gold)' }}>S/ {order.total}</span>
            </div>
            <div style={{ borderTop: '1px solid var(--color-border)', paddingTop: '14px' }}>
              <div style={{ fontSize: '0.66rem', letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--color-cyan)', marginBottom: '6px' }}>Yapea o Plinea a este número</div>
              <div data-testid="yape-number" style={{ fontFamily: 'var(--font-display)', fontSize: '1.8rem', letterSpacing: '0.08em', color: 'var(--color-text)' }}>{BAND_PHONE}</div>
              <div style={{ fontSize: '0.74rem', color: 'var(--color-text-muted)', marginTop: '8px' }}>
                Pon <strong style={{ color: 'var(--color-text)' }}>tu nombre</strong> y la referencia <strong style={{ color: 'var(--color-gold)' }}>{ref}</strong> en el mensaje del Yapeo.
              </div>
            </div>
          </div>

          {/* Primary: report the payment — flags the order in admin + alerts the band */}
          <div data-testid="report-form" style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-frame)', padding: '18px', marginBottom: '12px' }}>
            <div style={{ fontFamily: 'var(--font-display)', fontSize: '1.2rem', letterSpacing: '0.03em', marginBottom: '4px' }}>Ya pagué</div>
            <p style={{ fontSize: '0.74rem', color: 'var(--color-text-muted)', margin: '0 0 12px' }}>
              Déjanos tus datos y validamos tu pago para enviarte las entradas.
            </p>
            <input data-testid="report-name" placeholder="Tu nombre" value={repName} onChange={(e) => setRepName(e.target.value)} style={repInput} />
            <input data-testid="report-email" type="email" placeholder="Tu correo (te enviamos las entradas)" value={repEmail} onChange={(e) => setRepEmail(e.target.value)} style={{ ...repInput, marginTop: '8px' }} />
            <input data-testid="report-op" placeholder="N.° de operación Yape/Plin" value={repOp} onChange={(e) => setRepOp(e.target.value)} style={{ ...repInput, marginTop: '8px' }} />
            <button
              type="button"
              data-testid="report-submit"
              disabled={working || !repEmail.trim()}
              onClick={handleReport}
              style={{ marginTop: '12px', width: '100%', padding: '14px', background: 'var(--color-pink)', color: '#fff', border: 'none', borderRadius: 'var(--radius-pill)', fontFamily: 'var(--font-display)', fontSize: '1.1rem', letterSpacing: '0.04em', cursor: working || !repEmail.trim() ? 'not-allowed' : 'pointer', opacity: working || !repEmail.trim() ? 0.5 : 1 }}
            >
              {working ? 'Enviando…' : 'Reportar pago'}
            </button>
          </div>

          {/* Secondary: or just message us */}
          <a
            href={`https://wa.me/${WHATSAPP_DIGITS}?text=${waText}`}
            target="_blank"
            rel="noopener noreferrer"
            data-testid="whatsapp-cta"
            style={{ display: 'block', width: '100%', boxSizing: 'border-box', padding: '13px', background: 'transparent', color: '#25D366', border: '1px solid rgba(37,211,102,.5)', borderRadius: 'var(--radius-pill)', fontFamily: 'var(--font-display)', fontSize: '1rem', letterSpacing: '0.04em', textAlign: 'center', textDecoration: 'none' }}
          >
            O envíanos el comprobante por WhatsApp →
          </a>

          <div style={{ marginTop: '16px', fontSize: '0.74rem', color: 'var(--color-text-muted)', lineHeight: 1.6, background: 'rgba(255,255,255,.04)', border: '1px solid var(--color-border)', borderRadius: '12px', padding: '13px 15px' }}>
            <strong style={{ color: 'var(--color-text)' }}>¿Cómo sigue?</strong> Validamos tu pago y te enviamos las entradas con QR a tu correo. Si no alcanzas a pagar, los asientos se liberan en 24 h y quedan libres para otra persona.
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  // ─── Pendiente de validación (manual order, buyer reported payment) ───
  if (step === 'pending' && order) {
    const ref = order.id.slice(0, 8).toUpperCase();
    const entradas = order.tickets?.length || selectedCount;
    return (
      <div style={{ minHeight: '100vh', background: 'var(--color-bg)', color: 'var(--color-text)', fontFamily: 'var(--font-body)' }}>
        <Nav />
        <main className="rg-gutter" style={{ maxWidth: '560px', margin: '0 auto', padding: '36px 0 80px', textAlign: 'center' }}>
          <div style={{ fontSize: '2.6rem', marginBottom: '8px' }}>⏳</div>
          <h1 data-testid="pending-title" style={{ fontFamily: 'var(--font-display)', fontSize: 'clamp(1.8rem,6vw,2.4rem)', letterSpacing: '0.03em', margin: '0 0 8px' }}>
            Pendiente de validación
          </h1>
          <p style={{ color: 'var(--color-text-muted)', maxWidth: '420px', margin: '0 auto 24px', lineHeight: 1.6 }}>
            Recibimos tu reporte. Estamos validando tu pago — apenas lo confirmemos, tu entrada con QR queda lista y te llega por correo.
          </p>

          <div style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-frame)', padding: '20px', textAlign: 'left' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.86rem', marginBottom: '8px' }}>
              <span style={{ color: 'var(--color-text-muted)' }}>Entradas</span><span>{entradas}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.86rem', marginBottom: '8px' }}>
              <span style={{ color: 'var(--color-text-muted)' }}>Total</span><span style={{ color: 'var(--color-gold)' }}>S/ {order.total}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.86rem', marginBottom: '8px' }}>
              <span style={{ color: 'var(--color-text-muted)' }}>Referencia</span><span className="rg-mono">{ref}</span>
            </div>
            {order.payment_ref && (
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.86rem' }}>
                <span style={{ color: 'var(--color-text-muted)' }}>N.° de operación</span><span className="rg-mono">{order.payment_ref}</span>
              </div>
            )}
            <div data-testid="pending-qr-note" style={{ marginTop: '14px', paddingTop: '14px', borderTop: '1px solid var(--color-border)', textAlign: 'center', color: 'var(--color-cyan)', fontSize: '0.82rem' }}>
              ⏳ Tu QR aparece cuando confirmemos el pago
            </div>
          </div>

          <p style={{ fontSize: '0.72rem', color: 'var(--color-text-faint)', marginTop: '16px' }}>
            Guarda este enlace para ver el estado de tu entrada.
          </p>
        </main>
        <Footer />
      </div>
    );
  }

  // ─── F3: Checkout ───
  if (step === 'pay' && order) {
    // Build order items for breakdown
    const orderLineItems = selected.map((id) => {
      const sec = seatSection.get(id);
      const seat = sec?.seats.find((s) => s.id === id);
      const tbl = seatTable.get(id);
      const seatLabel = seat ? seatFullLabel(seat, tbl) : id;
      return {
        label: `${sec?.name || 'Asiento'} · ${seatLabel}`,
        price: Number(sec?.price_bundles[0]?.price || 0),
        id,
      };
    });

    const orderSubtotal = orderLineItems.reduce((a, b) => a + b.price, 0);
    const orderTotal = Number(order.total);
    const orderDiscount = orderSubtotal - orderTotal;

    return (
      <div style={{ minHeight: '100vh', background: 'var(--color-bg)', color: 'var(--color-text)', fontFamily: 'var(--font-body)' }}>
        {/* Nav */}
        <Nav />

        <main>
          {/* Slim event-context header */}
          <header style={{ borderBottom: '1px solid var(--color-border)', background: 'var(--color-surface)' }}>
            <div className="rg-gutter" style={{ maxWidth: '760px', margin: '0 auto', paddingTop: '14px', paddingBottom: '14px', display: 'flex', alignItems: 'center', gap: '16px', flexWrap: 'wrap' }}>
              <button
                type="button"
                onClick={() => setStep('select')}
                style={{ background: 'none', border: 'none', color: 'var(--color-text-muted)', cursor: 'pointer', fontSize: '0.8rem', padding: 0 }}
              >
                ← Volver
              </button>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', minWidth: 0 }}>
                <span style={{ fontFamily: 'var(--font-display)', fontSize: '1.15rem', letterSpacing: '0.06em' }}>{event.name}</span>
                <span style={{ fontSize: '0.74rem', color: 'var(--color-text-muted)' }}>
                  <span style={{ color: 'var(--color-cyan)', fontWeight: 600 }}>{formatDate(event.starts_at)}</span>
                  {event.venue_name && <span> · {event.venue_name}</span>}
                </span>
              </div>
            </div>
          </header>

          <div className="rg-gutter" style={{ maxWidth: '720px', margin: '0 auto', paddingTop: 'clamp(24px, 6vw, 34px)', paddingBottom: '64px' }}>
            {error && (
              <div role="alert" style={{ background: 'rgba(255,90,110,.08)', border: '1px solid rgba(255,90,110,.3)', borderRadius: 'var(--radius-card)', padding: '12px 16px', color: '#ff5a6e', fontSize: '0.88rem', marginBottom: '16px' }}>
                {error}
              </div>
            )}

            <div style={{
              background: 'var(--color-surface)',
              border: '1px solid var(--color-border)',
              borderRadius: '16px',
              padding: '22px',
              boxShadow: '0 24px 80px rgba(0,0,0,.6)',
            }}>
              <div style={{ fontFamily: 'var(--font-display)', letterSpacing: '0.06em', fontSize: '1.25rem' }}>TU ORDEN</div>

              {/* Countdown */}
              <div style={{ fontSize: '0.62rem', color: 'var(--color-text-faint)', margin: '2px 0 14px' }}>
                ⏱ Reservado por {holdSecs !== null ? formatHoldTime(holdSecs) : '20:00'}
              </div>

              {/* Order line items with seat label */}
              {orderLineItems.length > 0 ? (
                orderLineItems.map((item) => (
                  <div key={item.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '11px 0', borderBottom: '1px solid var(--color-border)' }}>
                    <span style={{ fontSize: '0.9rem' }}>{item.label}</span>
                    <span style={{ fontFamily: 'var(--font-display)', fontSize: '1.3rem', color: 'var(--color-pink)' }}>S/ {item.price.toFixed(0)}</span>
                  </div>
                ))
              ) : (
                order.tickets.map((t) => (
                  <div key={t.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '11px 0', borderBottom: '1px solid var(--color-border)' }}>
                    <span style={{ fontSize: '0.9rem' }}>Entrada</span>
                    <span style={{ fontFamily: 'var(--font-display)', fontSize: '1.3rem', color: 'var(--color-pink)' }}>—</span>
                  </div>
                ))
              )}

              {/* Combo callout box */}
              {comboDiscount && (
                <div style={{ marginTop: '12px', background: 'rgba(255,215,0,.1)', border: '1px solid rgba(255,215,0,.55)', borderRadius: '10px', padding: '11px 13px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.78rem', color: 'var(--color-gold)', fontWeight: 600 }}>
                    <span>💎 {comboDiscount.label}</span>
                    <span>−S/ {comboDiscount.amount.toFixed(2)}</span>
                  </div>
                  <div style={{ fontSize: '0.66rem', color: 'rgba(255,215,0,.7)', marginTop: '3px' }}>
                    Aplicado automáticamente — no tienes que elegirlo.
                  </div>
                </div>
              )}

              {/* Subtotal + Discount + Total breakdown */}
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.82rem', color: 'var(--color-text-muted)', marginTop: '14px' }}>
                <span>Subtotal</span>
                <span>S/ {orderSubtotal > 0 ? orderSubtotal.toFixed(2) : order.total}</span>
              </div>
              {orderDiscount > 0 && (
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.82rem', color: 'var(--color-gold)', marginTop: '4px' }}>
                  <span>Descuento combo</span>
                  <span>−S/ {orderDiscount.toFixed(2)}</span>
                </div>
              )}
              <div style={{ height: '1px', background: 'var(--color-border)', margin: '12px 0' }} />
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                <span style={{ fontFamily: 'var(--font-display)', fontSize: '1.15rem', letterSpacing: '0.04em' }}>TOTAL</span>
                <span data-testid="order-total" style={{ fontFamily: 'var(--font-display)', fontSize: '2rem', color: 'var(--color-gold)' }}>
                  S/ {order.total}
                </span>
              </div>
              <div style={{ marginTop: '8px', fontSize: '0.62rem', color: 'var(--color-text-faint)' }}>
                Precio final, sin cargos sorpresa
              </div>

              {/* Pay button */}
              <button
                type="button"
                className="rg-cta"
                disabled={working}
                onClick={handlePay}
                style={{
                  marginTop: '20px',
                  display: 'block',
                  width: '100%',
                  padding: '15px',
                  background: 'var(--color-pink)',
                  color: '#fff',
                  border: 'none',
                  borderRadius: 'var(--radius-pill)',
                  fontFamily: 'var(--font-display)',
                  fontSize: 'clamp(1.05rem, 4vw, 1.3rem)',
                  letterSpacing: '0.05em',
                  cursor: working ? 'not-allowed' : 'pointer',
                  boxShadow: 'var(--shadow-cta)',
                  textAlign: 'center',
                  opacity: working ? 0.6 : 1,
                }}
              >
                {working ? 'PROCESANDO...' : `PAGAR CON IZIPAY · S/ ${order.total}`}
              </button>

              <div style={{ marginTop: '10px', fontSize: '0.66rem', color: 'var(--color-text-muted)', textAlign: 'center' }}>
                🔒 Serás redirigido a la pasarela segura de <strong style={{ color: 'var(--color-text)' }}>Izipay</strong> — paga con <strong style={{ color: 'var(--color-text)' }}>tarjeta de crédito o débito</strong>. ¿Prefieres Yape o Plin? Vuelve y elige “Yape / Plin · coordinar”.
              </div>

              {/* Payment methods */}
              <div style={{ marginTop: '12px', display: 'flex', gap: '8px', justifyContent: 'center', alignItems: 'center', opacity: 0.7, userSelect: 'none', pointerEvents: 'none' }}>
                <span style={{ fontSize: '0.56rem', letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--color-text-faint)' }}>Tarjeta vía Izipay</span>
                {['VISA', 'Mastercard'].map((m) => (
                  <span key={m} style={{ padding: '3px 9px', border: '1px solid rgba(255,255,255,.18)', borderRadius: '5px', letterSpacing: '0.04em', fontSize: '0.62rem' }}>{m}</span>
                ))}
              </div>

              {/* Note */}
              <div style={{ marginTop: '20px', background: 'rgba(255,255,255,.05)', border: '1px solid var(--color-border)', borderRadius: '12px', padding: '13px 15px', fontSize: '0.78rem', color: 'var(--color-text-muted)', display: 'flex', gap: '11px', alignItems: 'flex-start' }}>
                <span style={{ color: 'var(--color-cyan)', fontSize: '1rem', lineHeight: 1.4 }}>✉</span>
                <span>Al volver de Izipay confirmamos tu pago y te enviamos las entradas. Si falta tu nombre, te lo pedimos aquí.</span>
              </div>
            </div>

            {/* How it works */}
            <div style={{ marginTop: '18px', border: '1px solid var(--color-border)', borderRadius: '12px', background: 'var(--color-surface)', padding: '14px 16px', display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap', fontSize: '0.72rem', color: 'var(--color-text-muted)' }}>
              <span style={{ fontWeight: 600, fontSize: '0.58rem', letterSpacing: '0.14em', color: 'var(--color-text-faint)', textTransform: 'uppercase', width: '100%' }}>Cómo funciona</span>
              <span style={{ padding: '6px 11px', borderRadius: 'var(--radius-pill)', background: 'rgba(255,20,147,.12)', border: '1px solid rgba(255,20,147,.4)', color: 'var(--color-text)' }}>1 · Pagar con Izipay</span>
              <span style={{ opacity: 0.5 }}>→</span>
              <span style={{ padding: '6px 11px', borderRadius: 'var(--radius-pill)', background: 'var(--color-surface)', border: '1px solid var(--color-border)' }}>2 · Pasarela Izipay (tarjeta)</span>
              <span style={{ opacity: 0.5 }}>→</span>
              <span style={{ padding: '6px 11px', borderRadius: 'var(--radius-pill)', background: 'rgba(34,197,94,.12)', border: '1px solid rgba(34,197,94,.4)', color: '#22c55e' }}>3 · ✓ Vuelves aquí, compra confirmada</span>
            </div>
          </div>
        </main>

        <Footer />
      </div>
    );
  }

  // ─── F4: Success ───
  if (step === 'done' && order) {
    // Still waiting for IPN confirmation (async from Izipay)
    if (polling || order.status !== 'paid') {
      return (
        <div style={{ minHeight: '100vh', background: 'radial-gradient(80% 50% at 50% 0%,rgba(255,20,147,.12),transparent 60%), var(--color-bg)', color: 'var(--color-text)', fontFamily: 'var(--font-body)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ textAlign: 'center', maxWidth: '400px', padding: '32px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '18px' }}>
            <div className="rg-spinner" aria-hidden="true" />
            <p style={{ fontFamily: 'var(--font-display)', fontSize: 'clamp(1.3rem, 5vw, 1.5rem)', letterSpacing: '0.06em', margin: 0 }}>CONFIRMANDO PAGO</p>
            <p style={{ color: 'var(--color-text-muted)', fontSize: '0.88rem', margin: 0 }}>Estamos confirmando tu pago con Izipay. Esto solo toma unos segundos...</p>
          </div>
        </div>
      );
    }

    const showAskName = !order.buyer_first_name && !nameSaved;
    const firstToken = order.tickets[0]?.public_token;

    return (
      <div style={{ minHeight: '100vh', background: 'var(--color-bg)', color: 'var(--color-text)', fontFamily: 'var(--font-body)', position: 'relative' }}>
        {/* Nav */}
        <Nav />

        <main className="rg-gutter" style={{
          position: 'relative',
          minHeight: 'calc(100vh - 56px)',
          paddingTop: 'clamp(40px, 9vw, 56px)',
          paddingBottom: '90px',
          background: 'radial-gradient(70% 50% at 50% -5%,rgba(34,197,94,.22),transparent 60%), radial-gradient(80% 70% at 50% 0%,rgba(255,20,147,.12),transparent 55%), linear-gradient(180deg,#0d0418,#08020e)',
        }}>
          <div style={{ maxWidth: '640px', margin: '0 auto', position: 'relative', zIndex: 2 }}>
            {/* Success hero */}
            <div style={{ textAlign: 'center', marginBottom: '34px' }}>
              <div style={{
                width: '88px',
                height: '88px',
                borderRadius: '50%',
                margin: '0 auto 22px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                background: 'radial-gradient(circle at 50% 35%,rgba(34,197,94,.32),rgba(34,197,94,.08))',
                border: '2px solid var(--color-green)',
                boxShadow: '0 0 0 8px rgba(34,197,94,.08), 0 0 34px rgba(34,197,94,.5)',
              }}>
                <svg viewBox="0 0 52 52" aria-hidden="true" style={{ width: '42px', height: '42px' }}>
                  <path d="M14 27 L23 36 L39 18" stroke="var(--color-green)" strokeWidth={5} fill="none" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </div>
              <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 'clamp(2.6rem,8vw,4.4rem)', lineHeight: 0.92, letterSpacing: '0.02em', textShadow: '0 0 28px rgba(34,197,94,.35)', margin: 0 }}>
                ¡COMPRA CONFIRMADA!
              </h1>
              <p style={{ color: 'var(--color-text-muted)', fontSize: '1rem', marginTop: '8px' }}>
                Te enviamos tus entradas a <span style={{ color: 'var(--color-cyan)', fontWeight: 500 }}>{order.buyer_email}</span>
              </p>
            </div>

            {/* Order recap card */}
            <section style={{ background: 'rgba(255,255,255,.05)', border: '1px solid var(--color-border)', borderRadius: '14px', padding: '20px 22px', marginBottom: '18px' }}>
              <p style={{ fontSize: '0.6rem', letterSpacing: '0.18em', textTransform: 'uppercase', color: 'var(--color-cyan)', fontWeight: 600, marginBottom: '10px' }}>Resumen de tu compra</p>
              <div style={{ marginBottom: '14px' }}>
                <div style={{ fontFamily: 'var(--font-display)', fontSize: '1.55rem', letterSpacing: '0.03em', lineHeight: 1.05 }}>{event.name}</div>
                <div style={{ fontSize: '0.62rem', letterSpacing: '0.16em', textTransform: 'uppercase', color: 'var(--color-cyan)', fontWeight: 600, marginTop: '6px' }}>
                  {formatDate(event.starts_at)}{event.venue_name ? ` · ${event.venue_name}` : ''}
                </div>
              </div>
              {order.tickets.map((t) => (
                <div key={t.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '11px 0', borderBottom: '1px solid var(--color-border)', fontSize: '0.9rem' }}>
                  <span style={{ color: 'var(--color-text-muted)' }}>
                    {t.section_name ? <>{t.section_name} · </>: ''}{t.seat_label || `Entrada #${t.code}`}
                  </span>
                  <span style={{ fontSize: '0.6rem', letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--color-pink)', fontWeight: 600, background: 'rgba(255,20,147,.1)', border: '1px solid rgba(255,20,147,.4)', borderRadius: 'var(--radius-pill)', padding: '4px 10px' }}>
                    {t.section_name || 'Entrada'}
                  </span>
                </div>
              ))}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: '14px', marginTop: '2px' }}>
                <span style={{ fontSize: '0.58rem', letterSpacing: '0.16em', textTransform: 'uppercase', color: 'var(--color-text-faint)', fontWeight: 600 }}>Total pagado</span>
                <span style={{ fontFamily: 'var(--font-display)', fontSize: '2rem', color: 'var(--color-gold)', letterSpacing: '0.02em' }}>S/ {order.total}</span>
              </div>
            </section>

            {/* Ticket links */}
            <section style={{ background: 'rgba(255,255,255,.05)', border: '1px solid var(--color-border)', borderRadius: '14px', padding: '20px 22px', marginBottom: '18px' }}>
              <p style={{ fontSize: '0.6rem', letterSpacing: '0.18em', textTransform: 'uppercase', color: 'var(--color-cyan)', fontWeight: 600, marginBottom: '12px' }}>Tus entradas</p>
              {order.tickets.map((t) => (
                <Link
                  key={t.id}
                  className="rg-ticket-link"
                  href={`/t?token=${t.public_token}`}
                  data-testid="ticket-link"
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    gap: '12px',
                    minHeight: '52px',
                    padding: '13px 14px',
                    borderRadius: '10px',
                    border: '1px solid rgba(0,229,255,.28)',
                    background: 'rgba(0,229,255,.05)',
                    marginBottom: '10px',
                    textDecoration: 'none',
                    transition: 'background .15s, border-color .15s',
                  }}
                >
                  <span style={{ fontSize: '0.9rem' }}>
                    {t.section_name ? <>{t.section_name} · </> : ''}{t.seat_label || `Entrada #${t.code}`}
                    <small style={{ display: 'block', color: 'var(--color-text-muted)', fontSize: '0.7rem', marginTop: '2px', letterSpacing: '0.04em' }}>
                      Entrada individual con QR
                    </small>
                  </span>
                  <span style={{ display: 'flex', alignItems: 'center', gap: '7px', color: 'var(--color-cyan)', fontWeight: 600, fontSize: '0.82rem', whiteSpace: 'nowrap' }}>
                    Ver entrada
                    <svg viewBox="0 0 24 24" aria-hidden="true" style={{ width: '15px', height: '15px' }}>
                      <path d="M7 17 L17 7 M9 7 H17 V15" stroke="var(--color-cyan)" strokeWidth={2} fill="none" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </span>
                </Link>
              ))}
            </section>

            {/* Primary actions */}
            <div style={{ marginTop: '26px' }}>
              {firstToken && (
                <Link
                  className="rg-cta"
                  href={`/t?token=${firstToken}`}
                  style={{
                    display: 'block',
                    textAlign: 'center',
                    background: 'var(--color-pink)',
                    color: '#fff',
                    padding: '15px',
                    borderRadius: 'var(--radius-pill)',
                    fontFamily: 'var(--font-display)',
                    letterSpacing: '0.05em',
                    fontSize: 'clamp(1.1rem, 4.2vw, 1.3rem)',
                    boxShadow: 'var(--shadow-cta)',
                    textDecoration: 'none',
                    marginBottom: '12px',
                  }}
                >
                  VER MIS ENTRADAS
                </Link>
              )}
              {/* Descargar PDF — built client-side from the order's tickets */}
              {firstToken && (
                <button
                  type="button"
                  className="rg-ghost-btn"
                  data-testid="download-pdf"
                  onClick={handleDownloadPdf}
                  disabled={pdfBusy}
                  style={{
                    display: 'block',
                    width: '100%',
                    textAlign: 'center',
                    background: 'transparent',
                    color: 'var(--color-text)',
                    padding: '13px',
                    borderRadius: 'var(--radius-pill)',
                    border: '1px solid var(--color-border)',
                    fontFamily: 'var(--font-display)',
                    letterSpacing: '0.06em',
                    fontSize: '1.05rem',
                    cursor: pdfBusy ? 'wait' : 'pointer',
                    marginBottom: '12px',
                    opacity: pdfBusy ? 0.7 : 1,
                  }}
                >
                  {pdfBusy ? 'Generando PDF...' : 'Descargar PDF'}
                </button>
              )}
            </div>

            {/* Ask name */}
            {showAskName && (
              <section
                data-testid="ask-name-card"
                style={{
                  marginTop: '26px',
                  background: 'var(--color-surface)',
                  border: '1px solid var(--color-border)',
                  borderRadius: '14px',
                  padding: '20px 22px',
                }}
              >
                <p style={{ fontFamily: 'var(--font-display)', fontSize: '1.25rem', letterSpacing: '0.02em', margin: '0 0 4px', color: 'var(--color-text)' }}>
                  ¿A nombre de quién emitimos las entradas?
                </p>
                <p style={{ fontSize: '0.72rem', color: 'var(--color-text-faint)', marginBottom: '14px' }}>
                  Opcional — para personalizar tus entradas.
                </p>
                <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                  <input
                    type="text"
                    placeholder="Nombre completo"
                    aria-label="Nombre del titular"
                    value={askFirstName}
                    onChange={(e) => setAskFirstName(e.target.value)}
                    style={{ flex: 1, minWidth: '200px', background: 'rgba(255,255,255,.04)', border: '1px solid var(--color-border)', borderRadius: '10px', padding: '12px 14px', color: 'var(--color-text)', fontSize: '0.92rem', outline: 'none' }}
                  />
                  <button
                    type="button"
                    onClick={handleSaveName}
                    disabled={!askFirstName}
                    style={{
                      background: 'transparent',
                      border: '1px solid var(--color-cyan)',
                      color: 'var(--color-cyan)',
                      borderRadius: 'var(--radius-pill)',
                      padding: '11px 22px',
                      fontFamily: 'var(--font-display)',
                      letterSpacing: '0.05em',
                      fontSize: '1.05rem',
                      cursor: askFirstName ? 'pointer' : 'not-allowed',
                    }}
                  >
                    Guardar
                  </button>
                </div>
              </section>
            )}

            <div style={{ marginTop: '20px', fontSize: '0.66rem', color: 'var(--color-text-faint)', textAlign: 'center' }}>
              Precio final, sin cargos sorpresa · Pago procesado con Izipay
            </div>
          </div>
        </main>

        <Footer />
      </div>
    );
  }

  return null;
}
