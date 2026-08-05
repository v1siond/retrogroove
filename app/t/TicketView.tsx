'use client';

import { useEffect, useState } from 'react';
import { ticketingApi } from '@/lib/ticketing/api';
import { buildTicketPdf, downloadPdf, ticketFilename } from '@/lib/ticketing/pdf';
import type { Ticket } from '@/lib/ticketing/types';

function formatDate(iso: string): string {
  try {
    return new Intl.DateTimeFormat('es-PE', {
      weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit',
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

function statusLabel(status: Ticket['status']): string {
  switch (status) {
    case 'valid': return '● Válida';
    case 'used': return '● Usada';
    case 'pending': return '● Pendiente';
    default: return status;
  }
}

function statusColor(status: Ticket['status']): string {
  switch (status) {
    case 'valid': return 'var(--color-green)';
    case 'used': return 'var(--color-red)';
    case 'pending': return 'var(--color-gold)';
    default: return 'var(--color-text-muted)';
  }
}

export default function TicketView({ token }: { token: string }) {
  const [ticket, setTicket] = useState<Ticket | null>(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);

  useEffect(() => {
    ticketingApi
      .getTicket(token)
      .then((r) => setTicket(r.ticket))
      .catch(() => setTicket(null))
      .finally(() => setLoading(false));
  }, [token]);

  async function handleDownloadPdf() {
    if (!ticket || generating) return;
    setGenerating(true);
    try {
      const eventName = ticket.event_name || 'RetroGroove';
      const bytes = await buildTicketPdf(ticket, {
        eventName,
        date: ticket.event_starts_at,
      });
      downloadPdf(bytes, ticketFilename(eventName, ticket.public_token));
    } finally {
      setGenerating(false);
    }
  }

  if (loading) return (
    <main className="rg-gutter" style={{ minHeight: '100vh', background: 'var(--color-bg)', color: 'var(--color-text)', fontFamily: 'var(--font-body)' }} aria-busy="true" aria-label="Cargando entrada">
      <div style={{ maxWidth: '480px', margin: '0 auto', paddingTop: 'clamp(32px, 9vw, 56px)' }}>
        <div className="rg-skeleton" style={{ height: '24px', width: '50%', marginBottom: '28px' }} />
        <div className="rg-skeleton" style={{ height: '420px', borderRadius: 'var(--radius-frame)' }} />
      </div>
    </main>
  );

  if (!ticket) return (
    <main className="rg-gutter" style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', gap: '14px', background: 'var(--color-bg)', color: 'var(--color-text)', fontFamily: 'var(--font-body)' }}>
      <div style={{ fontSize: '2.2rem' }}>🎫</div>
      <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 'clamp(1.6rem, 6vw, 2.2rem)', letterSpacing: '0.03em', margin: 0 }}>Entrada no encontrada</h1>
      <p style={{ color: 'var(--color-text-muted)', maxWidth: '320px' }}>Verifica el enlace o vuelve a abrir el correo con tus entradas.</p>
    </main>
  );

  return (
    <main style={{ minHeight: '100vh', background: 'var(--color-bg)', color: 'var(--color-text)', fontFamily: 'var(--font-body)' }}>
      <div className="rg-gutter" style={{ maxWidth: '1120px', margin: '0 auto', paddingTop: 'clamp(28px, 7vw, 40px)', paddingBottom: '80px' }}>
        {/* Page head */}
        <div style={{ marginBottom: '32px' }}>
          <p style={{ fontSize: '0.62rem', letterSpacing: '0.14em', color: 'var(--color-text-faint)', textTransform: 'uppercase', margin: '0 0 8px' }}>
            Mis entradas · RetroGroove
          </p>
          <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 'clamp(2.6rem,7vw,4.4rem)', margin: 0, letterSpacing: '0.02em', color: 'var(--color-text)' }}>
            MIS ENTRADAS
          </h1>
        </div>

        {/* Ticket card — max 480px centered */}
        <div style={{ maxWidth: '480px', margin: '0 auto' }}>
          <div style={{
            background: 'var(--color-surface-card)',
            border: '1px solid var(--color-border)',
            borderRadius: 'var(--radius-frame)',
            overflow: 'hidden',
            boxShadow: 'var(--shadow-frame)',
          }}>
            {/* Header */}
            <div style={{ padding: '16px 16px 14px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                <span style={{ fontSize: '0.58rem', letterSpacing: '0.12em', color: 'var(--color-cyan)', textTransform: 'uppercase', fontWeight: 600 }}>
                  RetroGroove
                </span>
                <span
                  data-testid="ticket-status"
                  style={{ fontSize: '0.68rem', color: statusColor(ticket.status), fontWeight: 600 }}
                >
                  {statusLabel(ticket.status)}
                </span>
              </div>
              <p style={{ fontFamily: 'var(--font-display)', fontSize: '1.6rem', margin: '0 0 4px', lineHeight: 1.1, color: 'var(--color-text)' }}>
                {ticket.event_name || 'RetroGroove'}
              </p>
              {ticket.section_name && (
                <p style={{ fontFamily: 'var(--font-display)', fontSize: '1rem', color: 'var(--color-gold)', margin: '0 0 8px', letterSpacing: '0.04em' }}>
                  {ticket.section_name}
                </p>
              )}
              {ticket.event_starts_at && (
                <p style={{ fontSize: '0.72rem', color: 'var(--color-text-muted)', margin: '0 0 4px' }}>
                  {formatDate(ticket.event_starts_at)}
                </p>
              )}
              {/* Where to sit: mesa first — it's what the guest looks for on arrival. */}
              {(ticket.table_label || ticket.seat_label) && (
                <p data-testid="ticket-placement" style={{ fontSize: '0.68rem', color: 'var(--color-text-faint)', margin: 0 }}>
                  {ticket.table_label && (
                    <span style={{ color: 'var(--color-gold)', fontWeight: 600 }}>
                      Mesa {ticket.table_label}
                    </span>
                  )}
                  {ticket.table_label && ticket.seat_label && ' · '}
                  {ticket.seat_label}
                </p>
              )}
            </div>

            {/* Perforated divider */}
            <div style={{
              height: '1px',
              background: 'repeating-linear-gradient(90deg, var(--color-border) 0, var(--color-border) 8px, transparent 8px, transparent 16px)',
              margin: '0',
            }} />

            {/* QR area */}
            <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px' }}>
              {ticket.qr_svg && (
                <div
                  data-testid="ticket-qr"
                  style={{
                    background: '#fff',
                    padding: '12px',
                    borderRadius: '12px',
                    lineHeight: 0,
                    width: '200px',
                    maxWidth: '100%',
                    overflow: 'hidden',
                  }}
                >
                  <div
                    style={{ width: '100%', lineHeight: 0 }}
                    dangerouslySetInnerHTML={{ __html: ticket.qr_svg }}
                  />
                </div>
              )}
              <p style={{ fontSize: '0.55rem', letterSpacing: '0.1em', color: 'var(--color-text-faint)', textTransform: 'uppercase', margin: 0 }}>
                Código de entrada
              </p>
              <p
                data-testid="ticket-token"
                style={{ fontFamily: 'var(--font-display)', color: 'var(--color-gold)', letterSpacing: '0.32em', fontSize: '1.1rem', margin: 0, wordBreak: 'break-all' }}
              >
                {ticket.public_token}
              </p>
              <p style={{ fontSize: '0.6rem', color: 'var(--color-text-faint)', margin: 0, textAlign: 'center' }}>
                No transferible · Válida para una persona
              </p>
            </div>
          </div>

          {/* Action buttons — outside the card. Wrap on narrow screens so each
              stays a comfortable ≥44px tap target instead of three slivers. */}
          <div style={{ display: 'flex', gap: '8px', marginTop: '10px', flexWrap: 'wrap' }}>
            <button
              type="button"
              style={{ flex: '1 1 130px', minHeight: '44px', padding: '11px', background: 'transparent', color: 'var(--color-text)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-pill)', cursor: 'pointer', fontFamily: 'var(--font-display)', fontSize: '0.85rem', letterSpacing: '0.04em' }}
            >
              Agregar a Wallet
            </button>
            <button
              type="button"
              style={{ flex: '1 1 130px', minHeight: '44px', padding: '11px', background: 'transparent', color: 'var(--color-text)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-pill)', cursor: 'pointer', fontFamily: 'var(--font-display)', fontSize: '0.85rem', letterSpacing: '0.04em' }}
            >
              Compartir
            </button>
            <button
              type="button"
              data-testid="pdf-link"
              onClick={handleDownloadPdf}
              disabled={generating}
              style={{ flex: '1 1 130px', minHeight: '44px', padding: '11px', background: 'var(--color-pink)', color: '#fff', border: 'none', borderRadius: 'var(--radius-pill)', cursor: generating ? 'wait' : 'pointer', fontFamily: 'var(--font-display)', fontSize: '0.9rem', letterSpacing: '0.04em', textAlign: 'center', display: 'inline-block', boxShadow: 'var(--shadow-cta)', opacity: generating ? 0.7 : 1 }}
            >
              {generating ? 'Generando...' : 'Descargar PDF'}
            </button>
          </div>
        </div>
      </div>
    </main>
  );
}
