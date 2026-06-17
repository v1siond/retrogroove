'use client';

import { useEffect, useState } from 'react';
import { ticketingApi } from '@/lib/ticketing/api';
import type { Ticket } from '@/lib/ticketing/types';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api';

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

  useEffect(() => {
    ticketingApi
      .getTicket(token)
      .then((r) => setTicket(r.ticket))
      .catch(() => setTicket(null))
      .finally(() => setLoading(false));
  }, [token]);

  if (loading) return (
    <main style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--color-bg)', color: 'var(--color-text)', fontFamily: 'var(--font-body)' }}>
      <p>Cargando...</p>
    </main>
  );

  if (!ticket) return (
    <main style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--color-bg)', color: 'var(--color-text)', fontFamily: 'var(--font-body)' }}>
      <p>Entrada no encontrada</p>
    </main>
  );

  return (
    <main style={{ minHeight: '100vh', background: 'var(--color-bg)', color: 'var(--color-text)', fontFamily: 'var(--font-body)' }}>
      <div style={{ maxWidth: '1120px', margin: '0 auto', padding: '40px 28px 80px' }}>
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
        <div style={{ maxWidth: '480px' }}>
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
              {ticket.seat_label && (
                <p style={{ fontSize: '0.68rem', color: 'var(--color-text-faint)', margin: 0 }}>
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
                    maxWidth: '200px',
                  }}
                >
                  <div
                    style={{ width: '100%' }}
                    dangerouslySetInnerHTML={{ __html: ticket.qr_svg }}
                  />
                </div>
              )}
              <p style={{ fontSize: '0.55rem', letterSpacing: '0.1em', color: 'var(--color-text-faint)', textTransform: 'uppercase', margin: 0 }}>
                Código de entrada
              </p>
              <p
                data-testid="ticket-token"
                style={{ fontFamily: 'var(--font-display)', color: 'var(--color-gold)', letterSpacing: '0.32em', fontSize: '1.1rem', margin: 0 }}
              >
                {ticket.public_token}
              </p>
              <p style={{ fontSize: '0.6rem', color: 'var(--color-text-faint)', margin: 0, textAlign: 'center' }}>
                No transferible · Válida para una persona
              </p>
            </div>
          </div>

          {/* Action buttons — outside the card */}
          <div style={{ display: 'flex', gap: '8px', marginTop: '10px' }}>
            <button
              type="button"
              style={{ flex: 1, padding: '10px', background: 'transparent', color: 'var(--color-text)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-pill)', cursor: 'pointer', fontFamily: 'var(--font-display)', fontSize: '0.85rem', letterSpacing: '0.04em' }}
            >
              Agregar a Wallet
            </button>
            <button
              type="button"
              style={{ flex: 1, padding: '10px', background: 'transparent', color: 'var(--color-text)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-pill)', cursor: 'pointer', fontFamily: 'var(--font-display)', fontSize: '0.85rem', letterSpacing: '0.04em' }}
            >
              Compartir
            </button>
            <a
              data-testid="pdf-link"
              href={`${API_BASE}/tickets/${token}/pdf`}
              target="_blank"
              rel="noopener noreferrer"
              style={{ flex: 1, padding: '10px', background: 'var(--color-pink)', color: 'var(--color-text)', border: 'none', borderRadius: 'var(--radius-pill)', cursor: 'pointer', fontFamily: 'var(--font-display)', fontSize: '0.85rem', letterSpacing: '0.04em', textDecoration: 'none', textAlign: 'center', display: 'inline-block', boxShadow: 'var(--shadow-cta)' }}
            >
              Descargar PDF
            </a>
          </div>
        </div>
      </div>
    </main>
  );
}
