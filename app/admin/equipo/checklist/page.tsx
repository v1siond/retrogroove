'use client';

// The load-out checklist — used one-handed in the dark beside the van, so it follows the
// door-scanner's shape: big tap targets, a sticky progress header, no drawers or tables.
// Two legs per line: CARGADO on the way out, DEVUELTO on the way back. Each tap saves
// immediately (nothing is worth losing to a dead battery), and reverts if the call fails.

import { Suspense, useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { AdminGate } from '@/components/admin2/AdminGate';
import { adminApi } from '@/lib/ticketing/admin';
import type { AdminEventEquipment } from '@/lib/ticketing/admin';

type Leg = 'packed' | 'returned';

function groupByCategory(rows: AdminEventEquipment[]): [string, AdminEventEquipment[]][] {
  const groups = new Map<string, AdminEventEquipment[]>();
  for (const row of rows) {
    const key = row.category || 'Sin categoría';
    groups.set(key, [...(groups.get(key) || []), row]);
  }
  return [...groups.entries()].sort(([a], [b]) => a.localeCompare(b));
}

function LegButton({
  on, label, testId, onToggle,
}: {
  on: boolean;
  label: string;
  testId: string;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      data-testid={testId}
      data-on={on}
      onClick={onToggle}
      style={{
        flex: 1,
        minHeight: 52,
        borderRadius: 10,
        border: `1px solid ${on ? 'var(--color-green)' : 'rgba(255,255,255,.18)'}`,
        background: on ? 'rgba(58,214,133,.16)' : 'transparent',
        color: on ? 'var(--color-green)' : 'rgba(236,230,240,.75)',
        fontFamily: 'var(--font-display)',
        fontSize: '.92rem',
        letterSpacing: '.06em',
        cursor: 'pointer',
      }}
    >
      {on ? `✓ ${label}` : label}
    </button>
  );
}

function Checklist() {
  const eventId = useSearchParams().get('event') || '';
  const [rows, setRows] = useState<AdminEventEquipment[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    if (!eventId) { setRows([]); return; }
    adminApi.listEventEquipment(eventId)
      .then((r) => setRows(r.equipment))
      .catch(() => { setError('No se pudo cargar la lista.'); setRows([]); });
  }, [eventId]);

  useEffect(load, [load]);

  // Optimistic: the tick lands instantly, then reverts if the server refuses.
  async function toggle(row: AdminEventEquipment, leg: Leg) {
    const field = leg === 'packed' ? 'packed_at' : 'returned_at';
    const next = row[field] ? null : new Date().toISOString();

    setRows((cur) => (cur || []).map((r) => (r.id === row.id ? { ...r, [field]: next } : r)));

    try {
      await adminApi.markEventEquipment(row.id, { [leg]: next !== null });
    } catch {
      setError('No se pudo guardar el cambio.');
      setRows((cur) => (cur || []).map((r) => (r.id === row.id ? { ...r, [field]: row[field] } : r)));
    }
  }

  const all = rows || [];
  const packed = all.filter((r) => r.packed_at).length;
  const returned = all.filter((r) => r.returned_at).length;

  return (
    <main style={{ minHeight: '100vh', background: 'var(--color-bg)', color: 'var(--color-text)', fontFamily: 'var(--font-body)', paddingBottom: 40 }}>
      <header style={{ position: 'sticky', top: 0, zIndex: 5, background: 'var(--color-bg)', borderBottom: '1px solid var(--color-border)', padding: '14px 16px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 12 }}>
          <h1 data-testid="checklist-title" style={{ fontFamily: 'var(--font-display)', fontSize: '1.4rem', margin: 0, letterSpacing: '.04em' }}>
            EQUIPO
          </h1>
          <Link href="/admin/equipo" className="rg-link" style={{ fontSize: '.78rem' }}>← Equipo</Link>
        </div>
        <p data-testid="checklist-progress" style={{ margin: '6px 0 0', fontSize: '.82rem', color: 'var(--color-text-muted)' }}>
          {packed}/{all.length} cargados · {returned}/{all.length} devueltos
        </p>
      </header>

      {error && (
        <p data-testid="checklist-error" style={{ margin: '12px 16px', color: 'var(--color-red)', fontSize: '.82rem' }}>{error}</p>
      )}

      {rows === null && <p style={{ padding: 16, color: 'var(--color-text-muted)' }}>Cargando…</p>}

      {rows !== null && all.length === 0 && (
        <p data-testid="checklist-empty" style={{ padding: 16, color: 'var(--color-text-muted)', fontSize: '.88rem' }}>
          Este evento todavía no tiene lista de equipo. Ármala en Equipo → Por evento.
        </p>
      )}

      {groupByCategory(all).map(([category, group]) => (
        <section key={category} style={{ padding: '14px 16px 4px' }}>
          <h2 style={{ fontFamily: 'var(--font-display)', fontSize: '.82rem', letterSpacing: '.14em', color: 'var(--color-gold)', margin: '0 0 8px' }}>
            {category.toUpperCase()}
          </h2>

          {group.map((row) => (
            <article key={row.id} data-testid="checklist-row" data-item={row.name}
              style={{ border: '1px solid var(--color-border)', borderRadius: 12, padding: 12, marginBottom: 10, background: 'var(--color-surface)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, marginBottom: 10 }}>
                <span style={{ fontWeight: 600 }}>{row.name}</span>
                <span data-testid="checklist-qty" style={{ fontFamily: 'var(--font-display)', color: 'var(--color-gold)' }}>
                  {row.quantity}×
                </span>
              </div>
              {row.notes && (
                <p style={{ margin: '0 0 10px', fontSize: '.74rem', color: 'var(--color-text-muted)' }}>{row.notes}</p>
              )}
              <div style={{ display: 'flex', gap: 8 }}>
                <LegButton on={!!row.packed_at} label="CARGADO" testId={`packed-${row.id}`}
                  onToggle={() => toggle(row, 'packed')} />
                <LegButton on={!!row.returned_at} label="DEVUELTO" testId={`returned-${row.id}`}
                  onToggle={() => toggle(row, 'returned')} />
              </div>
            </article>
          ))}
        </section>
      ))}
    </main>
  );
}

export default function EquipmentChecklistPage() {
  return (
    <AdminGate>
      <Suspense fallback={null}>
        <Checklist />
      </Suspense>
    </AdminGate>
  );
}
