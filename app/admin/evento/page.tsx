'use client';

import { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { AdminGate } from '@/components/admin2/AdminGate';
import EventAdmin from './EventAdmin';

function EventAdminWithParams() {
  const slug = useSearchParams().get('slug') || '';
  if (!slug) return <main className="event-admin"><p>Evento no especificado</p></main>;
  return <EventAdmin slug={slug} />;
}

export default function EventAdminPage() {
  return (
    <AdminGate>
      <Suspense fallback={null}>
        <EventAdminWithParams />
      </Suspense>
    </AdminGate>
  );
}
