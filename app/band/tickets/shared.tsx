'use client';

// Shared building blocks for the admin dashboard panels: date formatting, the
// status pill, a destructive-action confirm button, and an inline feedback
// banner. Kept here so every resource panel renders consistently.

import { useState, ReactNode } from 'react';

export function fmtDate(iso: string | null | undefined): string {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleString('es-PE', {
      day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit',
    });
  } catch {
    return iso;
  }
}

const STATUS_COLORS: Record<string, string> = {
  paid: 'var(--color-green)',
  comp: 'var(--color-cyan)',
  pending: 'var(--color-gold)',
  expired: 'var(--color-text-faint)',
  cancelled: 'var(--color-red)',
  valid: 'var(--color-green)',
  used: 'var(--color-text-faint)',
  void: 'var(--color-red)',
  published: 'var(--color-green)',
  draft: 'var(--color-gold)',
};

export function StatusPill({ status }: { status: string }) {
  const color = STATUS_COLORS[status] || 'var(--color-text-muted)';
  return (
    <span
      data-status={status}
      style={{
        fontSize: '0.62rem', letterSpacing: '0.08em', textTransform: 'uppercase', fontWeight: 600,
        color, border: `1px solid ${color}`, borderRadius: 'var(--radius-pill)', padding: '3px 10px',
        whiteSpace: 'nowrap',
      }}
    >
      {status}
    </span>
  );
}

// Inline feedback banner — success (green) or error (red).
export function Feedback({ kind, children }: { kind: 'ok' | 'error'; children: ReactNode }) {
  const color = kind === 'ok' ? 'var(--color-green)' : 'var(--color-red)';
  return (
    <p
      role={kind === 'error' ? 'alert' : 'status'}
      data-testid={`feedback-${kind}`}
      style={{
        background: `color-mix(in srgb, ${color} 12%, transparent)`,
        border: `1px solid color-mix(in srgb, ${color} 50%, transparent)`,
        color, padding: '10px 14px', borderRadius: '12px', margin: '12px 0', fontSize: '0.88rem',
      }}
    >
      {children}
    </p>
  );
}

// A destructive-action button that requires an inline confirm click. Renders
// the trigger; on click swaps to a "¿Seguro? Sí / Cancelar" row.
export function ConfirmAction({
  label,
  confirmLabel,
  prompt,
  onConfirm,
  testId,
  busy,
}: {
  label: string;
  confirmLabel: string;
  prompt: string;
  onConfirm: () => void | Promise<void>;
  testId: string;
  busy?: boolean;
}) {
  const [confirming, setConfirming] = useState(false);

  if (!confirming) {
    return (
      <button
        type="button"
        data-testid={testId}
        onClick={() => setConfirming(true)}
        style={{
          background: 'none', border: '1px solid var(--color-border)', color: 'var(--color-red)',
          borderRadius: 'var(--radius-pill)', padding: '5px 14px', fontSize: '0.78rem', cursor: 'pointer',
        }}
      >
        {label}
      </button>
    );
  }

  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
      <span style={{ color: 'var(--color-red)', fontSize: '0.78rem' }}>{prompt}</span>
      <button
        type="button"
        data-testid={`${testId}-confirm`}
        onClick={async () => { await onConfirm(); setConfirming(false); }}
        disabled={busy}
        style={{
          background: 'var(--color-red)', color: '#fff', border: 'none',
          borderRadius: 'var(--radius-pill)', padding: '5px 14px', fontSize: '0.78rem',
          cursor: busy ? 'not-allowed' : 'pointer', opacity: busy ? 0.5 : 1,
        }}
      >
        {confirmLabel}
      </button>
      <button
        type="button"
        onClick={() => setConfirming(false)}
        style={{ background: 'none', border: 'none', color: 'var(--color-text-muted)', textDecoration: 'underline', fontSize: '0.78rem', cursor: 'pointer' }}
      >
        Cancelar
      </button>
    </span>
  );
}

// Filter/search toolbar shell.
export function Toolbar({ children }: { children: ReactNode }) {
  return (
    <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap', marginBottom: '4px' }}>
      {children}
    </div>
  );
}

export const selectStyle: React.CSSProperties = {
  background: 'var(--color-surface)', border: '1px solid var(--color-border)', color: 'var(--color-text)',
  borderRadius: '10px', padding: '8px 12px', fontSize: '0.85rem', outline: 'none',
};

export const searchStyle: React.CSSProperties = {
  background: 'var(--color-surface)', border: '1px solid var(--color-border)', color: 'var(--color-text)',
  borderRadius: '10px', padding: '8px 12px', fontSize: '0.85rem', outline: 'none', minWidth: '200px', flex: '1 1 200px',
};
