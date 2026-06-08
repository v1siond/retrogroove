'use client';

import { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import TicketView from './TicketView';

function TicketWithParams() {
  const token = useSearchParams().get('token') || '';
  if (!token) return <main className="ticket"><p>Entrada no especificada</p></main>;
  return <TicketView token={token} />;
}

export default function TicketPage() {
  return (
    <Suspense fallback={null}>
      <TicketWithParams />
    </Suspense>
  );
}
