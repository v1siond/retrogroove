'use client';

import { Suspense, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { AdminGate } from '@/components/admin2/AdminGate';
import { EventBuilder } from '../nuevo/page';
import { adminApi } from '@/lib/ticketing/admin';
import type { TicketEvent } from '@/lib/ticketing/types';

const wrap: React.CSSProperties = {
  minHeight: '100vh',
  background: 'var(--color-bg)',
  color: 'var(--color-text)',
  fontFamily: 'var(--font-body)',
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  gap: '14px',
  textAlign: 'center',
  padding: '2rem',
};

function EditLoader() {
  const slug = useSearchParams().get('slug');
  const [event, setEvent] = useState<TicketEvent | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!slug) {
      setError('Falta el parámetro ?slug= del evento a editar.');
      return;
    }
    adminApi
      .getEvent(slug)
      .then((r) => setEvent(r.event))
      .catch(() => setError('No se pudo cargar el evento. Verifica el enlace.'));
  }, [slug]);

  if (error) {
    return (
      <div style={wrap} data-testid="edit-error">
        <div style={{ fontSize: '2rem' }}>🎫</div>
        <h1 style={{ fontFamily: 'var(--font-display)', letterSpacing: '.03em', margin: 0 }}>
          {error}
        </h1>
        <Link href="/band/tickets" style={{ color: 'var(--color-cyan)', textDecoration: 'underline' }}>
          Volver al panel
        </Link>
      </div>
    );
  }

  if (!event) {
    return (
      <div style={wrap} aria-busy="true" data-testid="edit-loading">
        <div style={{ fontSize: '1.6rem' }}>Cargando evento…</div>
      </div>
    );
  }

  return <EventBuilder mode="edit" initialEvent={event} />;
}

export default function EditEventPage() {
  return (
    <AdminGate>
      <Suspense fallback={<div style={wrap}>Cargando…</div>}>
        <EditLoader />
      </Suspense>
    </AdminGate>
  );
}
