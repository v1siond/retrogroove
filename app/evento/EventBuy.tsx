'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { ticketingApi, ApiError } from '@/lib/ticketing/api';
import { bundleTotal } from '@/lib/ticketing/pricing';
import { getCulqiToken } from '@/lib/ticketing/culqi';
import type { TicketEvent, Order, Section, Seat } from '@/lib/ticketing/types';

const SECTION_COLORS = ['#ff1493', '#00e5ff', '#ffd700', '#bf00ff', '#22c55e', '#ff8c00'];

function seatName(seat: Seat): string {
  return seat.row ? `${seat.row}${seat.number}` : seat.label || String(seat.number);
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

type Step = 'detail' | 'select' | 'pay' | 'done';
type MapView = 'map' | 'list';

export default function EventBuy({ slug }: { slug: string }) {
  const [event, setEvent] = useState<TicketEvent | null>(null);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<string[]>([]);
  const [gaQty, setGaQty] = useState<Record<string, number>>({});
  const [promo, setPromo] = useState('');
  const [step, setStep] = useState<Step>('detail');
  const [order, setOrder] = useState<Order | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [working, setWorking] = useState(false);
  const [mapView, setMapView] = useState<MapView>('map');
  const [holdSecs, setHoldSecs] = useState<number | null>(null);
  const [askFirstName, setAskFirstName] = useState('');
  const [askLastName, setAskLastName] = useState('');
  const [nameSaved, setNameSaved] = useState(false);

  useEffect(() => {
    ticketingApi
      .getEvent(slug)
      .then((r) => setEvent(r.event))
      .catch(() => setError('No se pudo cargar el evento'))
      .finally(() => setLoading(false));
  }, [slug]);

  // Countdown for hold
  useEffect(() => {
    if (step !== 'pay' || !order?.expires_at) return;
    const tick = () => {
      const secs = Math.max(0, Math.floor((new Date(order.expires_at!).getTime() - Date.now()) / 1000));
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
    setSelected((cur) => (cur.includes(id) ? cur.filter((s) => s !== id) : [...cur, id]));
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
        ? await ticketingApi.createGeneralOrder(ga[0], ga[1], { email: '' })
        : await ticketingApi.createOrder(event.id, selected, { email: '' }, promo.trim() || undefined);
      setOrder(order);
      setStep('pay');
    } catch (err) {
      const data = (err as ApiError)?.data as { error?: string } | undefined;
      setError(
        data?.error === 'seats_unavailable'
          ? 'Algunos asientos ya no están disponibles. Elige otros.'
          : data?.error === 'sold_out'
            ? 'Ya no quedan entradas disponibles.'
            : data?.error === 'invalid_promo'
              ? 'El código de descuento no es válido.'
              : 'No se pudo crear la orden.'
      );
    } finally {
      setWorking(false);
    }
  }

  async function handlePay() {
    if (!order) return;
    setWorking(true);
    setError(null);
    try {
      const token = await getCulqiToken();
      const { order: paid } = await ticketingApi.payOrder(order.id, token);
      setOrder(paid);
      setStep('done');
    } catch {
      setError('El pago no se pudo procesar.');
    } finally {
      setWorking(false);
    }
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

  if (loading) return (
    <main style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--color-bg)', color: 'var(--color-text)', fontFamily: 'var(--font-body)' }}>
      <p>Cargando...</p>
    </main>
  );
  if (!event) return (
    <main style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--color-bg)', color: 'var(--color-text)', fontFamily: 'var(--font-body)' }}>
      <p>{error || 'Evento no encontrado'}</p>
    </main>
  );

  const seatedSections = event.sections.filter((s) => s.layout_type !== 'general');
  const gaSections = event.sections.filter((s) => s.layout_type === 'general');
  const totalSeated = seatedSections.reduce((n, s) => n + s.seats.length, 0);
  const showNums = totalSeated <= 120;

  // ─── F1: Event Detail ───
  if (step === 'detail') {
    return (
      <main style={{ minHeight: '100vh', background: 'var(--color-bg)', color: 'var(--color-text)', fontFamily: 'var(--font-body)' }}>
        {/* Hero */}
        <section style={{
          minHeight: 'clamp(440px, 62vh, 720px)',
          background: 'radial-gradient(80% 60% at 20% 0%,rgba(191,0,255,.4),transparent 55%), radial-gradient(70% 60% at 85% 5%,rgba(0,229,255,.32),transparent 55%), radial-gradient(120% 90% at 50% 120%,rgba(255,20,147,.5),transparent 55%), linear-gradient(180deg,#1a0626,#08020e)',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'flex-end',
          padding: '40px 28px 48px',
        }}>
          <div style={{ maxWidth: '1120px', margin: '0 auto', width: '100%' }}>
            {/* Badges */}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '20px' }}>
              <span style={{ background: 'rgba(0,229,255,.12)', border: '1px solid rgba(0,229,255,.3)', borderRadius: 'var(--radius-pill)', padding: '4px 12px', fontSize: '0.72rem', color: 'var(--color-cyan)', letterSpacing: '0.04em' }}>
                ● Preventa · hasta agotar stock
              </span>
              {event.status === 'published' && (
                <span style={{ background: 'rgba(255,215,0,.1)', border: '1px solid rgba(255,215,0,.3)', borderRadius: 'var(--radius-pill)', padding: '4px 12px', fontSize: '0.72rem', color: 'var(--color-gold)', letterSpacing: '0.04em' }}>
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
                margin: '8px 0 20px',
              }}>
                {event.venue_name}
              </p>
            )}
            {/* Meta row */}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '16px', fontSize: '0.88rem', color: 'var(--color-text-muted)', alignItems: 'center' }}>
              <span style={{ color: 'var(--color-cyan)' }}>{formatDate(event.starts_at)}</span>
              {event.venue_name && <span>📍 {event.venue_name}</span>}
              {minPrice > 0 && <span>Desde S/ {minPrice}</span>}
            </div>
          </div>
        </section>

        {/* Two-column content */}
        <div style={{
          maxWidth: '1120px',
          margin: '0 auto',
          padding: '40px 28px 80px',
          display: 'grid',
          gridTemplateColumns: 'minmax(0, 1fr) 360px',
          gap: '34px',
          alignItems: 'start',
        }}>
          {/* Left column */}
          <div>
            {event.description && (
              <div style={{ marginBottom: '40px' }}>
                <p style={{ fontSize: '0.62rem', letterSpacing: '0.14em', color: 'var(--color-cyan)', textTransform: 'uppercase', marginBottom: '8px' }}>Acerca del evento</p>
                <p style={{ color: 'var(--color-text-muted)', lineHeight: 1.7 }}>{event.description}</p>
              </div>
            )}

            {/* Venue card */}
            <div style={{ marginBottom: '40px' }}>
              <p style={{ fontSize: '0.62rem', letterSpacing: '0.14em', color: 'var(--color-cyan)', textTransform: 'uppercase', marginBottom: '12px' }}>El lugar</p>
              <div style={{
                background: 'var(--color-surface-card)',
                border: '1px solid var(--color-border)',
                borderRadius: 'var(--radius-frame)',
                overflow: 'hidden',
              }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr' }}>
                  {/* Photo side */}
                  <div style={{
                    background: event.venue_photo_url
                      ? `url(${event.venue_photo_url}) center/cover`
                      : 'radial-gradient(circle at 30% 40%, rgba(191,0,255,.3), transparent 60%), radial-gradient(circle at 70% 60%, rgba(255,20,147,.2), transparent 60%), #1a0626',
                    minHeight: '180px',
                    position: 'relative',
                    display: 'flex',
                    alignItems: 'flex-end',
                    padding: '16px',
                  }}>
                    {event.venue_name && (
                      <span style={{
                        background: 'rgba(0,0,0,.6)',
                        borderRadius: 'var(--radius-pill)',
                        padding: '4px 10px',
                        fontSize: '0.7rem',
                        color: 'var(--color-text)',
                        backdropFilter: 'blur(4px)',
                      }}>
                        {event.venue_name}
                      </span>
                    )}
                  </div>
                  {/* Info side */}
                  <div style={{ padding: '20px' }}>
                    <h3 style={{ fontFamily: 'var(--font-display)', fontSize: '1.4rem', margin: '0 0 8px', color: 'var(--color-text)' }}>
                      {event.venue_name}
                    </h3>
                    {event.venue_address && (
                      <p style={{ fontSize: '0.82rem', color: 'var(--color-text-muted)', margin: '0 0 16px', lineHeight: 1.5 }}>
                        {event.venue_address}
                      </p>
                    )}
                  </div>
                </div>
                {/* Map placeholder */}
                <div style={{
                  background: 'repeating-linear-gradient(0deg, rgba(255,255,255,.03) 0, rgba(255,255,255,.03) 1px, transparent 1px, transparent 40px), repeating-linear-gradient(90deg, rgba(255,255,255,.03) 0, rgba(255,255,255,.03) 1px, transparent 1px, transparent 40px), #0d0016',
                  height: '140px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexDirection: 'column',
                  gap: '8px',
                  borderTop: '1px solid var(--color-border)',
                }}>
                  <span style={{ fontSize: '1.5rem' }}>📍</span>
                  {event.map_url && (
                    <a
                      href={event.map_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{ fontSize: '0.78rem', color: 'var(--color-cyan)', textDecoration: 'none' }}
                    >
                      Cómo llegar →
                    </a>
                  )}
                </div>
              </div>
            </div>

            {/* Pricing */}
            <div>
              <p style={{ fontSize: '0.62rem', letterSpacing: '0.14em', color: 'var(--color-cyan)', textTransform: 'uppercase', marginBottom: '12px' }}>Entradas</p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {event.sections.map((section) => (
                  <div key={section.id} style={{
                    background: 'var(--color-surface-card)',
                    border: '1px solid var(--color-border)',
                    borderRadius: 'var(--radius-card)',
                    padding: '14px 16px',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                  }}>
                    <div>
                      <p style={{ margin: 0, fontWeight: 500 }}>{section.name}</p>
                      {section.price_bundles.length > 1 && (
                        <p style={{ margin: '2px 0 0', fontSize: '0.72rem', color: 'var(--color-gold)' }}>
                          Combo disponible
                        </p>
                      )}
                    </div>
                    <p style={{ fontFamily: 'var(--font-display)', fontSize: '1.3rem', color: 'var(--color-pink)', margin: 0 }}>
                      S/ {section.price_bundles[0]?.price || '—'}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Right column — sticky buy box */}
          <div style={{ position: 'sticky', top: '84px' }}>
            <div style={{
              background: 'var(--color-surface-card)',
              border: '1px solid var(--color-border)',
              borderRadius: 'var(--radius-frame)',
              padding: '24px',
              boxShadow: 'var(--shadow-frame)',
            }}>
              {/* Date/venue */}
              <div style={{ borderBottom: '1px solid var(--color-border)', paddingBottom: '16px', marginBottom: '16px' }}>
                <p style={{ fontSize: '0.78rem', color: 'var(--color-cyan)', margin: '0 0 4px' }}>{formatDate(event.starts_at)}</p>
                {event.venue_name && <p style={{ fontSize: '0.82rem', color: 'var(--color-text-muted)', margin: 0 }}>📍 {event.venue_name}</p>}
              </div>
              {/* Section prices */}
              <p style={{ fontSize: '0.62rem', letterSpacing: '0.14em', color: 'var(--color-text-faint)', textTransform: 'uppercase', marginBottom: '10px' }}>Entradas</p>
              {event.sections.map((section) => (
                <div key={section.id} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', alignItems: 'center' }}>
                  <div>
                    <p style={{ margin: 0, fontSize: '0.88rem' }}>{section.name}</p>
                    {section.price_bundles.length > 1 && (
                      <p style={{ margin: 0, fontSize: '0.68rem', color: 'var(--color-gold)' }}>Combo disponible</p>
                    )}
                  </div>
                  <p style={{ fontFamily: 'var(--font-display)', color: 'var(--color-pink)', margin: 0 }}>
                    S/ {section.price_bundles[0]?.price}
                  </p>
                </div>
              ))}
              {/* Min price */}
              {minPrice > 0 && (
                <p style={{ margin: '16px 0 20px', fontSize: '0.72rem', color: 'var(--color-text-faint)' }}>
                  Desde{' '}
                  <span style={{ fontFamily: 'var(--font-display)', fontSize: '2rem', color: 'var(--color-gold)' }}>
                    S/ {minPrice}
                  </span>
                </p>
              )}
              {/* CTA */}
              <button
                type="button"
                onClick={() => setStep('select')}
                style={{
                  width: '100%',
                  padding: '14px',
                  background: 'var(--color-pink)',
                  color: 'var(--color-text)',
                  border: 'none',
                  borderRadius: 'var(--radius-pill)',
                  fontFamily: 'var(--font-display)',
                  fontSize: '1.15rem',
                  letterSpacing: '0.06em',
                  cursor: 'pointer',
                  boxShadow: 'var(--shadow-cta)',
                }}
              >
                COMPRAR ENTRADAS
              </button>
              {/* Reassurance */}
              <p style={{ fontSize: '0.68rem', color: 'var(--color-text-faint)', textAlign: 'center', margin: '12px 0 0' }}>
                Pago seguro · Visa · MC · Yape
              </p>
              <p style={{ fontSize: '0.68rem', color: 'var(--color-cyan)', textAlign: 'center', margin: '4px 0 0' }}>
                ⚡ Pocas entradas disponibles
              </p>
            </div>
          </div>
        </div>
      </main>
    );
  }

  // ─── F2: Seat Selection ───
  if (step === 'select') {
    const orderItems = selected.map((id) => {
      const sec = seatSection.get(id);
      const seat = sec?.seats.find((s) => s.id === id);
      return {
        label: `${sec?.name || 'Asiento'} · ${seatName(seat || { id, label: id, number: 0, row: null, status: 'available', table_id: null, pos_x: 0, pos_y: 0 })}`,
        unitPrice: Number(sec?.price_bundles[0]?.price || 0),
        qty: 1,
        id,
      };
    });

    return (
      <main style={{ minHeight: '100vh', background: 'var(--color-bg)', color: 'var(--color-text)', fontFamily: 'var(--font-body)' }}>
        {/* Context bar */}
        <div style={{
          position: 'sticky',
          top: 0,
          zIndex: 50,
          background: 'rgba(8,2,14,.85)',
          backdropFilter: 'blur(12px)',
          borderBottom: '1px solid var(--color-border)',
          padding: '10px 28px',
        }}>
          <div style={{ maxWidth: '1120px', margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
              <button
                type="button"
                onClick={() => setStep('detail')}
                style={{ background: 'none', border: 'none', color: 'var(--color-text-muted)', cursor: 'pointer', fontSize: '0.88rem', padding: 0 }}
              >
                ← Volver
              </button>
              <span style={{ fontFamily: 'var(--font-display)', fontSize: '1.1rem', letterSpacing: '0.06em' }}>{event.name}</span>
            </div>
            <div style={{ fontSize: '0.78rem', color: 'var(--color-text-muted)', textAlign: 'right' }}>
              {formatDate(event.starts_at)}
              {event.venue_name && <span> · {event.venue_name}</span>}
            </div>
          </div>
        </div>

        {error && (
          <div style={{ maxWidth: '1120px', margin: '16px auto 0', padding: '0 28px' }}>
            <div role="alert" style={{ background: 'rgba(255,90,110,.08)', border: '1px solid rgba(255,90,110,.3)', borderRadius: 'var(--radius-card)', padding: '12px 16px', color: '#ff5a6e', fontSize: '0.88rem' }}>
              {error}
            </div>
          </div>
        )}

        <div style={{
          maxWidth: '1120px',
          margin: '0 auto',
          padding: '24px 28px 80px',
          display: 'grid',
          gridTemplateColumns: 'minmax(0, 1fr) 360px',
          gap: '24px',
          alignItems: 'start',
        }}>
          {/* Left: map card */}
          <div style={{
            background: 'var(--color-surface-card)',
            border: '1px solid var(--color-border)',
            borderRadius: 'var(--radius-frame)',
            padding: '20px',
          }}>
            {/* Mapa/Lista toggle */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <div style={{ display: 'flex', gap: '4px', background: 'var(--color-surface)', borderRadius: 'var(--radius-pill)', padding: '4px' }}>
                {(['map', 'list'] as MapView[]).map((v) => (
                  <button
                    key={v}
                    type="button"
                    onClick={() => setMapView(v)}
                    style={{
                      padding: '6px 16px',
                      borderRadius: 'var(--radius-pill)',
                      border: 'none',
                      cursor: 'pointer',
                      fontFamily: 'var(--font-body)',
                      fontSize: '0.82rem',
                      transition: 'all 0.15s',
                      background: mapView === v ? 'var(--color-pink)' : 'transparent',
                      color: mapView === v ? '#fff' : 'var(--color-text-muted)',
                    }}
                  >
                    {v === 'map' ? 'Mapa' : 'Lista'}
                  </button>
                ))}
              </div>
              {selectedCount > 0 && (
                <span style={{ fontSize: '0.72rem', color: 'var(--color-cyan)' }}>
                  {selectedCount} seleccionado{selectedCount !== 1 ? 's' : ''}
                </span>
              )}
            </div>

            {/* Scarcity chip */}
            <div style={{ marginBottom: '12px', display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              <span style={{ background: 'rgba(0,229,255,.08)', border: '1px solid rgba(0,229,255,.25)', borderRadius: 'var(--radius-pill)', padding: '4px 10px', fontSize: '0.68rem', color: 'var(--color-cyan)' }}>
                ⚡ Quedan pocas entradas
              </span>
              {seatedSections.some((s) => s.price_bundles.length > 1) && (
                <span style={{ background: 'rgba(255,215,0,.08)', border: '1px solid rgba(255,215,0,.25)', borderRadius: 'var(--radius-pill)', padding: '4px 10px', fontSize: '0.68rem', color: 'var(--color-gold)' }}>
                  💎 Combo disponible
                </span>
              )}
            </div>

            {/* Map view */}
            {mapView === 'map' && (
              <>
                {seatedSections.length > 0 && (
                  <>
                    {/* Legend */}
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', marginBottom: '12px' }}>
                      {seatedSections.map((s, i) => (
                        <span key={s.id} style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.72rem', color: 'var(--color-text-muted)' }}>
                          <span style={{ width: '10px', height: '10px', borderRadius: '50%', background: SECTION_COLORS[i % SECTION_COLORS.length] }} />
                          {s.name}
                          {s.price_bundles[0] && <span style={{ color: 'var(--color-text-faint)' }}>· S/ {s.price_bundles[0].price}</span>}
                        </span>
                      ))}
                    </div>
                    <div
                      data-testid="seat-map"
                      style={{
                        position: 'relative',
                        width: '100%',
                        borderRadius: '12px',
                        border: '1px solid var(--color-border)',
                        overflow: 'hidden',
                        background: 'radial-gradient(circle at 50% 0%,rgba(255,20,147,0.12),transparent 55%), #0b0020',
                        aspectRatio: `${event.canvas_width || 1600} / ${event.canvas_height || 900}`,
                      }}
                    >
                      {/* Stage band */}
                      <div style={{
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
                      }}>
                        ESCENARIO
                      </div>
                      {seatedSections.map((section, si) => {
                        const color = SECTION_COLORS[si % SECTION_COLORS.length];
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
                              const isSel = selected.includes(seat.id);
                              const available = seat.status === 'available';
                              const label = seatName(seat);
                              return (
                                <button
                                  key={seat.id}
                                  type="button"
                                  data-seat-id={seat.id}
                                  data-status={seat.status}
                                  data-selected={isSel}
                                  disabled={!available}
                                  aria-pressed={isSel}
                                  aria-label={`Asiento ${label}`}
                                  title={`${section.name} · Asiento ${label}`}
                                  onClick={() => toggleSeat(seat.id)}
                                  style={{
                                    position: 'absolute',
                                    left: `${seat.pos_x}%`,
                                    top: `${seat.pos_y}%`,
                                    transform: 'translate(-50%, -50%)',
                                    pointerEvents: 'auto',
                                    borderRadius: '50%',
                                    border: '1px solid',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    transition: 'all 0.15s',
                                    cursor: available ? 'pointer' : 'not-allowed',
                                    width: showNums ? '24px' : totalSeated <= 800 ? '14px' : '8px',
                                    height: showNums ? '24px' : totalSeated <= 800 ? '14px' : '8px',
                                    fontSize: showNums ? '0.55rem' : '0',
                                    ...(isSel
                                      ? { background: '#ff1493', borderColor: '#ff1493', color: '#fff', boxShadow: '0 0 8px #ff1493' }
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
                  </>
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
              <div data-testid="seat-list" style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
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

            {/* Seat legend */}
            <div style={{ marginTop: '12px', display: 'flex', gap: '16px', flexWrap: 'wrap', fontSize: '0.7rem', color: 'var(--color-text-muted)' }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span style={{ width: '12px', height: '12px', borderRadius: '50%', background: 'rgba(0,229,255,.15)', border: '1px solid rgba(0,229,255,.6)', display: 'inline-block' }} />
                Disponible
              </span>
              <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span style={{ width: '12px', height: '12px', borderRadius: '50%', background: 'var(--color-pink)', border: '1px solid var(--color-pink)', display: 'inline-block' }} />
                Seleccionado
              </span>
              <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span style={{ width: '12px', height: '12px', borderRadius: '50%', background: 'rgba(255,255,255,.05)', border: '1px solid rgba(255,255,255,.15)', display: 'inline-block' }} />
                Vendido
              </span>
            </div>
          </div>

          {/* Right: sticky order summary */}
          <div style={{ position: 'sticky', top: '118px' }}>
            <div style={{
              background: 'var(--color-surface-card)',
              border: '1px solid var(--color-border)',
              borderRadius: 'var(--radius-frame)',
              padding: '20px',
              boxShadow: 'var(--shadow-frame)',
            }}>
              <p style={{ fontFamily: 'var(--font-display)', fontSize: '1.15rem', letterSpacing: '0.06em', margin: '0 0 16px' }}>TU SELECCIÓN</p>

              {selected.length === 0 && gaTotalQty === 0 && (
                <p style={{ color: 'var(--color-text-faint)', fontSize: '0.82rem', margin: '0 0 16px' }}>Selecciona asientos en el mapa</p>
              )}

              {/* Selected seat items */}
              {orderItems.map((item) => (
                <div key={item.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: '1px solid var(--color-border)', fontSize: '0.82rem' }}>
                  <span style={{ color: 'var(--color-text-muted)' }}>{item.label}</span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ fontFamily: 'var(--font-display)', color: 'var(--color-pink)' }}>S/ {item.unitPrice}</span>
                    <button
                      type="button"
                      onClick={() => removeSeat(item.id)}
                      style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-text-faint)', fontSize: '0.9rem', padding: '2px 4px', lineHeight: 1 }}
                    >
                      ✕
                    </button>
                  </div>
                </div>
              ))}

              {/* Combo discount */}
              {comboDiscount && (
                <div style={{ background: 'rgba(255,215,0,.08)', border: '1px solid rgba(255,215,0,.25)', borderRadius: 'var(--radius-combo)', padding: '10px 12px', margin: '12px 0' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.78rem', color: 'var(--color-gold)', fontWeight: 600 }}>
                    <span>{comboDiscount.label}</span>
                    <span>−S/ {comboDiscount.amount.toFixed(2)}</span>
                  </div>
                </div>
              )}

              {/* Total */}
              {selectedCount > 0 && (
                <div style={{ marginTop: '12px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.82rem', color: 'var(--color-text-muted)', marginBottom: '4px' }}>
                    <span>Subtotal</span>
                    <span>S/ {(comboDiscount?.subtotal ?? estimate).toFixed(2)}</span>
                  </div>
                  {comboDiscount && (
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.82rem', color: 'var(--color-gold)', marginBottom: '4px' }}>
                      <span>Descuento combo</span>
                      <span>−S/ {comboDiscount.amount.toFixed(2)}</span>
                    </div>
                  )}
                  <div style={{ height: '1px', background: 'var(--color-border)', margin: '10px 0' }} />
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                    <span style={{ fontFamily: 'var(--font-display)', fontSize: '1rem', letterSpacing: '0.04em' }}>TOTAL</span>
                    <span data-testid="order-total-value" style={{ fontFamily: 'var(--font-display)', fontSize: '1.8rem', color: 'var(--color-gold)' }}>
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

              {/* CTA */}
              <button
                type="button"
                disabled={selectedCount === 0 || working}
                onClick={handleBuy}
                style={{
                  marginTop: '14px',
                  width: '100%',
                  padding: '13px',
                  background: selectedCount > 0 ? 'var(--color-pink)' : 'rgba(255,255,255,.08)',
                  color: selectedCount > 0 ? 'var(--color-text)' : 'var(--color-text-faint)',
                  border: 'none',
                  borderRadius: 'var(--radius-pill)',
                  fontFamily: 'var(--font-display)',
                  fontSize: '1.1rem',
                  letterSpacing: '0.06em',
                  cursor: selectedCount > 0 && !working ? 'pointer' : 'not-allowed',
                  boxShadow: selectedCount > 0 ? 'var(--shadow-cta)' : 'none',
                  opacity: working ? 0.6 : 1,
                }}
              >
                {working ? 'PROCESANDO...' : 'IR A PAGAR'}
              </button>
            </div>
          </div>
        </div>
      </main>
    );
  }

  // ─── F3: Checkout ───
  if (step === 'pay' && order) {
    return (
      <main style={{ minHeight: '100vh', background: 'var(--color-bg)', color: 'var(--color-text)', fontFamily: 'var(--font-body)' }}>
        {/* Slim context header */}
        <div style={{ padding: '14px 28px', borderBottom: '1px solid var(--color-border)', display: 'flex', alignItems: 'center', gap: '16px' }}>
          <button
            type="button"
            onClick={() => setStep('select')}
            style={{ background: 'none', border: 'none', color: 'var(--color-text-muted)', cursor: 'pointer', fontSize: '0.88rem', padding: 0 }}
          >
            ← Volver
          </button>
          <span style={{ fontFamily: 'var(--font-display)', fontSize: '1.1rem', letterSpacing: '0.06em' }}>{event.name}</span>
          <span style={{ marginLeft: 'auto', fontSize: '0.78rem', color: 'var(--color-text-muted)' }}>{formatDate(event.starts_at)}</span>
        </div>

        <div style={{ maxWidth: '520px', margin: '0 auto', padding: '32px 28px 80px' }}>
          {error && (
            <div role="alert" style={{ background: 'rgba(255,90,110,.08)', border: '1px solid rgba(255,90,110,.3)', borderRadius: 'var(--radius-card)', padding: '12px 16px', color: '#ff5a6e', fontSize: '0.88rem', marginBottom: '16px' }}>
              {error}
            </div>
          )}

          <div style={{
            background: 'var(--color-surface-card)',
            border: '1px solid var(--color-border)',
            borderRadius: 'var(--radius-frame)',
            padding: '24px',
            boxShadow: 'var(--shadow-frame)',
          }}>
            <p style={{ fontFamily: 'var(--font-display)', fontSize: '1.2rem', letterSpacing: '0.06em', margin: '0 0 4px' }}>TU ORDEN</p>

            {/* Countdown */}
            <p style={{ fontSize: '0.72rem', color: 'var(--color-cyan)', margin: '0 0 20px' }}>
              ⏱ Reservado por {holdSecs !== null ? formatHoldTime(holdSecs) : '20:00'}
            </p>

            {/* Order items */}
            {order.tickets.length > 0 ? (
              order.tickets.map((t) => (
                <div key={t.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0', borderBottom: '1px solid var(--color-border)', fontSize: '0.88rem' }}>
                  <span style={{ color: 'var(--color-text-muted)' }}>Entrada</span>
                  <span style={{ fontFamily: 'var(--font-display)', color: 'var(--color-pink)' }}>—</span>
                </div>
              ))
            ) : (
              selected.map((id) => {
                const sec = seatSection.get(id);
                const seat = sec?.seats.find((s) => s.id === id);
                return (
                  <div key={id} style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0', borderBottom: '1px solid var(--color-border)', fontSize: '0.88rem' }}>
                    <span style={{ color: 'var(--color-text-muted)' }}>{sec?.name} · {seatName(seat || { id, label: id, number: 0, row: null, status: 'available', table_id: null, pos_x: 0, pos_y: 0 })}</span>
                    <span style={{ fontFamily: 'var(--font-display)', color: 'var(--color-pink)' }}>S/ {sec?.price_bundles[0]?.price}</span>
                  </div>
                );
              })
            )}

            {/* Total */}
            <div style={{ marginTop: '16px' }}>
              <div style={{ height: '1px', background: 'var(--color-border)', marginBottom: '12px' }} />
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                <span style={{ fontFamily: 'var(--font-display)', fontSize: '1rem', letterSpacing: '0.04em' }}>TOTAL</span>
                <span data-testid="order-total" style={{ fontFamily: 'var(--font-display)', fontSize: '2rem', color: 'var(--color-gold)' }}>
                  S/ {order.total}
                </span>
              </div>
            </div>

            {/* Pay button */}
            <button
              type="button"
              disabled={working}
              onClick={handlePay}
              style={{
                marginTop: '20px',
                width: '100%',
                padding: '15px',
                background: 'var(--color-pink)',
                color: 'var(--color-text)',
                border: 'none',
                borderRadius: 'var(--radius-pill)',
                fontFamily: 'var(--font-display)',
                fontSize: '1.15rem',
                letterSpacing: '0.06em',
                cursor: working ? 'not-allowed' : 'pointer',
                boxShadow: 'var(--shadow-cta)',
                opacity: working ? 0.6 : 1,
              }}
            >
              {working ? 'PROCESANDO...' : `PAGAR CON CULQI · S/ ${order.total}`}
            </button>

            {/* Payment icons note */}
            <p style={{ textAlign: 'center', fontSize: '0.68rem', color: 'var(--color-text-faint)', margin: '12px 0 0' }}>
              Visa · Mastercard · Yape
            </p>
            <p style={{ textAlign: 'center', fontSize: '0.66rem', color: 'var(--color-text-faint)', margin: '6px 0 0' }}>
              Tomamos tu nombre y correo de Culqi al momento del pago
            </p>
          </div>

          {/* How it works */}
          <div style={{ marginTop: '20px', padding: '16px', background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-card)', fontSize: '0.78rem', color: 'var(--color-text-muted)' }}>
            <p style={{ fontFamily: 'var(--font-display)', fontSize: '0.9rem', margin: '0 0 8px', color: 'var(--color-text)' }}>CÓMO FUNCIONA</p>
            <p style={{ margin: '0 0 4px' }}>1. Haz clic en &quot;Pagar con Culqi&quot; para abrir el formulario seguro</p>
            <p style={{ margin: '0 0 4px' }}>2. Ingresa tu tarjeta o usa Yape</p>
            <p style={{ margin: 0 }}>3. Recibirás tus entradas por email de inmediato</p>
          </div>
        </div>
      </main>
    );
  }

  // ─── F4: Success ───
  if (step === 'done' && order) {
    const showAskName = !order.buyer_first_name && !nameSaved;

    return (
      <main style={{ minHeight: '100vh', background: 'var(--color-bg)', color: 'var(--color-text)', fontFamily: 'var(--font-body)', position: 'relative' }}>
        {/* Green radial bg */}
        <div style={{
          position: 'fixed',
          inset: 0,
          background: 'radial-gradient(circle at 50% 0%, rgba(34,197,94,.15), transparent 60%)',
          pointerEvents: 'none',
          zIndex: 0,
        }} />

        <div style={{ position: 'relative', zIndex: 1, maxWidth: '640px', margin: '0 auto', padding: '60px 28px 80px', textAlign: 'center' }}>
          {/* Checkmark */}
          <div style={{
            width: '88px',
            height: '88px',
            borderRadius: '50%',
            border: '3px solid var(--color-green)',
            boxShadow: '0 0 24px rgba(34,197,94,.4)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto 24px',
            fontSize: '2rem',
          }}>
            ✓
          </div>

          <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 'clamp(2rem,7vw,3.5rem)', margin: '0 0 12px', color: 'var(--color-text)', letterSpacing: '0.04em' }}>
            ¡COMPRA CONFIRMADA!
          </h1>
          <p style={{ color: 'var(--color-text-muted)', margin: '0 0 32px' }}>
            Te enviamos tus entradas a {order.buyer_email}
          </p>

          {/* Order recap */}
          <div style={{ background: 'var(--color-surface-card)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-frame)', padding: '20px', textAlign: 'left', marginBottom: '20px' }}>
            <p style={{ fontFamily: 'var(--font-display)', fontSize: '1rem', letterSpacing: '0.06em', margin: '0 0 12px', color: 'var(--color-text)' }}>{event.name}</p>
            <p style={{ fontSize: '0.78rem', color: 'var(--color-text-muted)', margin: '0 0 12px' }}>{formatDate(event.starts_at)}</p>
            {order.tickets.map((t) => (
              <div key={t.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderTop: '1px solid var(--color-border)', fontSize: '0.82rem' }}>
                <span style={{ color: 'var(--color-text-muted)' }}>Entrada #{t.code}</span>
                <span style={{ background: 'rgba(0,229,255,.1)', border: '1px solid rgba(0,229,255,.25)', borderRadius: 'var(--radius-pill)', padding: '2px 8px', fontSize: '0.68rem', color: 'var(--color-cyan)' }}>
                  VIP
                </span>
              </div>
            ))}
          </div>

          {/* Ticket links */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '24px' }}>
            {order.tickets.map((t) => (
              <Link
                key={t.id}
                href={`/t?token=${t.public_token}`}
                data-testid="ticket-link"
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  background: 'var(--color-surface-card)',
                  border: '1px solid var(--color-border)',
                  borderRadius: 'var(--radius-card)',
                  padding: '14px 16px',
                  color: 'var(--color-text)',
                  textDecoration: 'none',
                  fontSize: '0.88rem',
                }}
              >
                <span>Entrada · {t.code}</span>
                <span style={{ color: 'var(--color-cyan)' }}>Ver entrada →</span>
              </Link>
            ))}
          </div>

          {/* Action buttons */}
          <div style={{ display: 'flex', gap: '12px', justifyContent: 'center', flexWrap: 'wrap', marginBottom: '32px' }}>
            {order.tickets[0]?.public_token && (
              <Link
                href={`/t?token=${order.tickets[0].public_token}`}
                style={{
                  padding: '13px 28px',
                  background: 'var(--color-pink)',
                  color: 'var(--color-text)',
                  border: 'none',
                  borderRadius: 'var(--radius-pill)',
                  fontFamily: 'var(--font-display)',
                  fontSize: '1rem',
                  letterSpacing: '0.06em',
                  cursor: 'pointer',
                  boxShadow: 'var(--shadow-cta)',
                  textDecoration: 'none',
                  display: 'inline-block',
                }}
              >
                VER MIS ENTRADAS
              </Link>
            )}
            <button
              type="button"
              style={{
                padding: '13px 28px',
                background: 'transparent',
                color: 'var(--color-text)',
                border: '1px solid var(--color-border)',
                borderRadius: 'var(--radius-pill)',
                fontFamily: 'var(--font-display)',
                fontSize: '1rem',
                letterSpacing: '0.06em',
                cursor: 'pointer',
              }}
            >
              Descargar PDF
            </button>
          </div>

          {/* Ask name */}
          {showAskName && (
            <div
              data-testid="ask-name-card"
              style={{
                background: 'var(--color-surface-card)',
                border: '1px solid var(--color-border)',
                borderRadius: 'var(--radius-frame)',
                padding: '24px',
                textAlign: 'left',
              }}
            >
              <p style={{ fontFamily: 'var(--font-display)', fontSize: '1.1rem', letterSpacing: '0.04em', margin: '0 0 16px', color: 'var(--color-text)' }}>
                ¿A nombre de quién emitimos las entradas?
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <input
                  placeholder="Nombre"
                  value={askFirstName}
                  onChange={(e) => setAskFirstName(e.target.value)}
                  style={{ padding: '10px 14px', background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-card)', color: 'var(--color-text)', fontSize: '0.9rem', outline: 'none' }}
                />
                <input
                  placeholder="Apellido"
                  value={askLastName}
                  onChange={(e) => setAskLastName(e.target.value)}
                  style={{ padding: '10px 14px', background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-card)', color: 'var(--color-text)', fontSize: '0.9rem', outline: 'none' }}
                />
                <button
                  type="button"
                  onClick={handleSaveName}
                  disabled={!askFirstName}
                  style={{
                    padding: '11px',
                    background: askFirstName ? 'var(--color-green)' : 'rgba(255,255,255,.08)',
                    color: 'var(--color-text)',
                    border: 'none',
                    borderRadius: 'var(--radius-pill)',
                    fontFamily: 'var(--font-display)',
                    fontSize: '1rem',
                    letterSpacing: '0.06em',
                    cursor: askFirstName ? 'pointer' : 'not-allowed',
                  }}
                >
                  Guardar
                </button>
              </div>
            </div>
          )}
        </div>
      </main>
    );
  }

  return null;
}
