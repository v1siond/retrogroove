'use client';

import { Suspense, useEffect, useRef, useState, FormEvent } from 'react';
import { useSearchParams } from 'next/navigation';
import { AdminGate } from '@/components/admin2/AdminGate';
import { adminApi, ApiError } from '@/lib/ticketing/admin';
import type { Ticket } from '@/lib/ticketing/types';

// ─── result state type ──────────────────────────────────────────────────────

type ResultState = 'valid' | 'used' | 'notfound' | 'checked' | null;

// ─── helpers ────────────────────────────────────────────────────────────────

function fmtDate(iso: string | null | undefined): string {
  if (!iso) return '';
  try {
    return new Date(iso).toLocaleString('es-PE', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return iso;
  }
}

// ─── result panel sub-components ────────────────────────────────────────────

function ValidPanel({
  ticket,
  onRegistrar,
  onSiguiente,
  working,
}: {
  ticket: Ticket;
  onRegistrar: () => void;
  onSiguiente: () => void;
  working: boolean;
}) {
  return (
    <div
      data-testid="result-panel"
      data-result="valid"
      style={{
        marginTop: 16,
        border: '1px solid rgba(34,197,94,.5)',
        background: 'rgba(34,197,94,.08)',
        borderRadius: 14,
        padding: 16,
        textAlign: 'center',
      }}
    >
      <div
        style={{
          fontFamily: 'var(--font-display)',
          fontSize: '2rem',
          color: 'var(--color-green)',
          letterSpacing: '.04em',
          lineHeight: 1,
        }}
      >
        ● VÁLIDA
      </div>
      <div
        style={{
          fontSize: '.8rem',
          color: 'rgba(236,230,240,.85)',
          marginTop: 8,
          lineHeight: 1.5,
        }}
      >
        {ticket.section_name && <span>{ticket.section_name} · </span>}
        {ticket.seat_label && <span>{ticket.seat_label}</span>}
        {ticket.event_name && (
          <div style={{ marginTop: 4, color: 'var(--color-cyan)', fontSize: '.74rem' }}>
            {ticket.event_name}
          </div>
        )}
      </div>
      <button
        data-testid="btn-registrar"
        type="button"
        onClick={onRegistrar}
        disabled={working}
        style={{
          marginTop: 14,
          display: 'block',
          width: '100%',
          padding: '13px 0',
          borderRadius: 'var(--radius-pill)',
          background: 'var(--color-pink)',
          border: 'none',
          color: '#fff',
          fontFamily: 'var(--font-display)',
          letterSpacing: '.05em',
          fontSize: '1.05rem',
          boxShadow: 'var(--shadow-cta)',
          cursor: working ? 'not-allowed' : 'pointer',
          opacity: working ? 0.6 : 1,
        }}
      >
        REGISTRAR ENTRADA
      </button>
      <button
        data-testid="btn-siguiente"
        type="button"
        onClick={onSiguiente}
        style={{
          marginTop: 10,
          background: 'none',
          border: 'none',
          color: 'var(--color-text-muted)',
          fontSize: '.7rem',
          textDecoration: 'underline',
          cursor: 'pointer',
        }}
      >
        Siguiente →
      </button>
    </div>
  );
}

function CheckedPanel({
  ticket,
  onSiguiente,
}: {
  ticket: Ticket;
  onSiguiente: () => void;
}) {
  return (
    <div
      data-testid="result-panel"
      data-result="checked"
      style={{
        marginTop: 16,
        border: '1px solid rgba(34,197,94,.6)',
        background: 'rgba(34,197,94,.1)',
        borderRadius: 14,
        padding: 16,
        textAlign: 'center',
      }}
    >
      <div
        style={{
          fontFamily: 'var(--font-display)',
          fontSize: '1.8rem',
          color: 'var(--color-green)',
          letterSpacing: '.04em',
          lineHeight: 1,
        }}
      >
        ✓ ENTRADA REGISTRADA
      </div>
      <div style={{ fontSize: '.76rem', color: 'rgba(236,230,240,.7)', marginTop: 8 }}>
        {ticket.section_name} · {ticket.seat_label}
      </div>
      <button
        data-testid="btn-siguiente"
        type="button"
        onClick={onSiguiente}
        style={{
          marginTop: 14,
          display: 'block',
          width: '100%',
          padding: '11px 0',
          borderRadius: 'var(--radius-pill)',
          background: 'rgba(34,197,94,.18)',
          border: '1px solid rgba(34,197,94,.4)',
          color: 'var(--color-green)',
          fontFamily: 'var(--font-display)',
          letterSpacing: '.05em',
          fontSize: '.95rem',
          cursor: 'pointer',
        }}
      >
        SIGUIENTE →
      </button>
    </div>
  );
}

function UsedPanel({
  ticket,
  onSiguiente,
}: {
  ticket: Ticket;
  onSiguiente: () => void;
}) {
  return (
    <div
      data-testid="result-panel"
      data-result="used"
      style={{
        marginTop: 16,
        border: '1px solid rgba(255,90,110,.5)',
        background: 'rgba(255,90,110,.08)',
        borderRadius: 14,
        padding: 16,
        textAlign: 'center',
      }}
    >
      <div
        style={{
          fontFamily: 'var(--font-display)',
          fontSize: '2rem',
          color: 'var(--color-red)',
          letterSpacing: '.04em',
          lineHeight: 1,
        }}
      >
        ● YA USADA
      </div>
      {ticket.checked_in_at && (
        <div style={{ fontSize: '.76rem', color: 'rgba(236,230,240,.65)', marginTop: 8 }}>
          Ingresó el {fmtDate(ticket.checked_in_at)}
        </div>
      )}
      <button
        data-testid="btn-siguiente"
        type="button"
        onClick={onSiguiente}
        style={{
          marginTop: 14,
          display: 'block',
          width: '100%',
          padding: '11px 0',
          borderRadius: 'var(--radius-pill)',
          background: 'rgba(255,90,110,.14)',
          border: '1px solid rgba(255,90,110,.35)',
          color: 'var(--color-red)',
          fontFamily: 'var(--font-display)',
          letterSpacing: '.05em',
          fontSize: '.95rem',
          cursor: 'pointer',
        }}
      >
        SIGUIENTE →
      </button>
    </div>
  );
}

function NotFoundPanel({ onSiguiente }: { onSiguiente: () => void }) {
  return (
    <div
      data-testid="result-panel"
      data-result="notfound"
      style={{
        marginTop: 16,
        border: '1px solid rgba(255,255,255,.15)',
        background: 'rgba(255,255,255,.04)',
        borderRadius: 14,
        padding: 16,
        textAlign: 'center',
      }}
    >
      <div
        style={{
          fontFamily: 'var(--font-display)',
          fontSize: '2rem',
          color: 'rgba(236,230,240,.45)',
          letterSpacing: '.04em',
          lineHeight: 1,
        }}
      >
        ● NO ENCONTRADA
      </div>
      <div style={{ fontSize: '.74rem', color: 'var(--color-text-muted)', marginTop: 8 }}>
        Código inválido o ticket no existe.
      </div>
      <button
        data-testid="btn-siguiente"
        type="button"
        onClick={onSiguiente}
        style={{
          marginTop: 14,
          display: 'block',
          width: '100%',
          padding: '11px 0',
          borderRadius: 'var(--radius-pill)',
          background: 'rgba(255,255,255,.06)',
          border: '1px solid rgba(255,255,255,.18)',
          color: 'var(--color-text-muted)',
          fontFamily: 'var(--font-display)',
          letterSpacing: '.05em',
          fontSize: '.95rem',
          cursor: 'pointer',
        }}
      >
        SIGUIENTE →
      </button>
    </div>
  );
}

// ─── main check-in component ─────────────────────────────────────────────────

function CheckIn({ scannedToken }: { scannedToken: string }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [token, setTokenValue] = useState(scannedToken);
  const [ticket, setTicket] = useState<Ticket | null>(null);
  const [result, setResult] = useState<ResultState>(null);
  const [count, setCount] = useState(0);
  const [working, setWorking] = useState(false);

  // Focus input on mount
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  async function runLookup(raw: string) {
    const tok = raw.trim();
    if (!tok) return;
    setWorking(true);
    setTicket(null);
    setResult(null);
    try {
      const { ticket: t } = await adminApi.getTicket(tok);
      setTicket(t);
      if (t.status === 'used') {
        setResult('used');
      } else if (t.status === 'valid') {
        setResult('valid');
      } else {
        setResult('notfound');
      }
    } catch {
      setResult('notfound');
    } finally {
      setWorking(false);
    }
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    void runLookup(token);
  }

  // Auto-verify when ?token= is present
  useEffect(() => {
    if (scannedToken) {
      setTokenValue(scannedToken);
      void runLookup(scannedToken);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scannedToken]);

  async function doCheckIn() {
    if (!ticket?.public_token) return;
    setWorking(true);
    try {
      const { ticket: used } = await adminApi.checkIn(ticket.public_token);
      setTicket(used);
      setResult('checked');
      setCount((c) => c + 1);
    } catch (err) {
      const data = (err as ApiError)?.data as { reason?: string } | undefined;
      if (data?.reason === 'already_used') {
        setResult('used');
      } else {
        setResult('notfound');
      }
    } finally {
      setWorking(false);
    }
  }

  function reset() {
    setTokenValue('');
    setTicket(null);
    setResult(null);
    inputRef.current?.focus();
  }

  return (
    <main
      style={{
        minHeight: '100vh',
        background: 'var(--color-bg)',
        display: 'flex',
        justifyContent: 'center',
        padding: '20px 16px 48px',
      }}
    >
      <div style={{ width: '100%', maxWidth: 360, fontFamily: 'var(--font-body)', color: 'var(--color-text)' }}>

        {/* ── Header ── */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <span
            data-testid="checkin-title"
            style={{
              fontFamily: 'var(--font-display)',
              letterSpacing: '.04em',
              fontSize: '1.25rem',
            }}
          >
            CONTROL DE PUERTA
          </span>
          <span
            data-testid="ingress-count"
            style={{
              fontSize: '.64rem',
              padding: '3px 11px',
              borderRadius: 'var(--radius-pill)',
              background: 'rgba(0,229,255,.12)',
              border: '1px solid rgba(0,229,255,.5)',
              color: 'var(--color-cyan)',
              fontWeight: 600,
            }}
          >
            {count} ingresos
          </span>
        </div>

        {/* ── Divider ── */}
        <div
          style={{
            textAlign: 'center',
            fontSize: '.6rem',
            color: 'var(--color-text-faint)',
            margin: '8px 0',
          }}
        >
          Ingresa el código del ticket
        </div>

        {/* ── Manual entry form ── */}
        <form onSubmit={handleSubmit}>
          <input
            ref={inputRef}
            data-testid="token-input"
            placeholder="Código o token del ticket"
            value={token}
            onChange={(e) => setTokenValue(e.target.value)}
            autoFocus
            autoComplete="off"
            style={{
              display: 'block',
              width: '100%',
              padding: '12px 14px',
              borderRadius: 10,
              background: 'rgba(255,255,255,.05)',
              border: '1px solid rgba(255,255,255,.15)',
              color: 'var(--color-text)',
              fontFamily: 'var(--font-body)',
              fontSize: '1rem',
              outline: 'none',
              marginBottom: 8,
            }}
          />
          <button
            data-testid="btn-validar"
            type="submit"
            disabled={working}
            style={{
              display: 'block',
              width: '100%',
              padding: '13px 0',
              borderRadius: 'var(--radius-pill)',
              background: working ? 'rgba(255,20,147,.5)' : 'var(--color-pink)',
              border: 'none',
              color: '#fff',
              fontFamily: 'var(--font-display)',
              letterSpacing: '.06em',
              fontSize: '1.1rem',
              boxShadow: working ? 'none' : 'var(--shadow-cta)',
              cursor: working ? 'not-allowed' : 'pointer',
            }}
          >
            VALIDAR
          </button>
        </form>

        {/* ── Result panels ── */}
        {result === 'valid' && ticket && (
          <ValidPanel
            ticket={ticket}
            onRegistrar={doCheckIn}
            onSiguiente={reset}
            working={working}
          />
        )}
        {result === 'checked' && ticket && (
          <CheckedPanel ticket={ticket} onSiguiente={reset} />
        )}
        {result === 'used' && ticket && (
          <UsedPanel ticket={ticket} onSiguiente={reset} />
        )}
        {result === 'notfound' && (
          <NotFoundPanel onSiguiente={reset} />
        )}

        {/* ── States legend ── */}
        <div
          style={{
            marginTop: 16,
            display: 'flex',
            gap: 10,
            justifyContent: 'center',
            fontSize: '.6rem',
            color: 'var(--color-text-faint)',
          }}
        >
          <span style={{ color: 'var(--color-green)' }}>● Válida</span>
          <span style={{ color: 'var(--color-red)' }}>● Ya usada</span>
          <span style={{ color: 'var(--color-text-faint)' }}>● No encontrada</span>
        </div>
      </div>
    </main>
  );
}

// ─── wrapper with AdminGate + Suspense ───────────────────────────────────────

function CheckInScreen() {
  const scannedToken = useSearchParams().get('token') || '';
  return (
    <AdminGate>
      <CheckIn scannedToken={scannedToken} />
    </AdminGate>
  );
}

export default function CheckInPage() {
  return (
    <Suspense fallback={null}>
      <CheckInScreen />
    </Suspense>
  );
}
